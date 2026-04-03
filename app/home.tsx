import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  FlatList, 
  KeyboardAvoidingView, 
  Platform, 
  StatusBar, 
  ActivityIndicator,
  Alert,
  Linking,
  AppState,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useConversation } from '../hooks/useConversation';
import { useSettings } from '../hooks/useSettings';
import { useGuestLimits } from '../hooks/useGuestLimits';
import { useAlert, useAuth } from '@/template';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { MenuModal } from '../components/MenuModal';
import { ToolsModal } from '../components/ToolsModal';
import { StreamingText } from '../components/StreamingText';
import { ConversationMenuModal } from '../components/ConversationMenuModal';
import { MessageItem } from '../components/MessageItem';
import { ThinkingIndicator } from '../components/ThinkingIndicator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';
import { decode } from 'base64-arraybuffer';
import { useRouter } from 'expo-router';
import { Accelerometer } from 'expo-sensors';
import { Audio } from 'expo-av';
import { useFocusEffect } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import * as FileSystem from 'expo-file-system';
import { SideMenu } from '../components/SideMenu';
import { ChatHistoryModal } from '../components/ChatHistoryModal';
import { AIMode } from '../components/AIModeSelectorModal';

// Recording states
type RecordingState = 'idle' | 'recording' | 'processing';

export default function HomeScreen() {
  const [isAppActive, setIsAppActive] = useState(true);
  const [showBlurOverlay, setShowBlurOverlay] = useState(false);
  const { colors } = useTheme();
  const { settings, updateSetting } = useSettings();
  const { user } = useAuth();
  const { canSendMessage, canCreateProject, deductCoins, coins, isUnlimited, incrementMessageCount, remainingMessages, isAdmin } = useGuestLimits();
  const { conversations, messages, currentConversation, sendMessage, updateMessageAndRegenerate, createConversation, loading, streamingMessageId } = useConversation();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  // State
  const [inputText, setInputText] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);
  const [toolsVisible, setToolsVisible] = useState(false);
  const [conversationMenuVisible, setConversationMenuVisible] = useState(false);
  const [sideMenuVisible, setSideMenuVisible] = useState(false);
  const [chatHistoryVisible, setChatHistoryVisible] = useState(false);
  const [currentAIMode, setCurrentAIMode] = useState<AIMode>('instant');
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<any[]>([]);
  const [currentAIModel, setCurrentAIModel] = useState(settings.preferredAiModel || 'gemini');
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [lastShake, setLastShake] = useState(0);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [thinkingMode, setThinkingMode] = useState<'thinking' | 'creating_image' | 'analyzing' | 'editing_image'>('thinking');
  const [showCompletionStatus, setShowCompletionStatus] = useState(false);
  
  // Refs
  const flatListRef = useRef<FlatList>(null);
  const supabase = getSupabaseClient();
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioPermissionRef = useRef<boolean>(false);
  const isRecordingRef = useRef<boolean>(false);
  const stopTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize audio permissions on mount
  useEffect(() => {
    checkAudioPermissions();
    return () => {
      // Cleanup all timers on unmount
      if (stopTimeoutRef.current) {
        clearTimeout(stopTimeoutRef.current);
      }
    };
  }, []);

  const checkAudioPermissions = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      audioPermissionRef.current = status === 'granted';
      
      if (status === 'granted') {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      }
    } catch (error) {
      console.error('Audio permission error:', error);
      audioPermissionRef.current = false;
    }
  };

  // REMOVED: No auto-create conversation on mount
  // Conversation will be created when user sends first message
  // This prevents auto-greeting and keeps UI clean

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  useEffect(() => {
  const subscription = AppState.addEventListener('change', (nextAppState) => {
    if (nextAppState === 'background' || nextAppState === 'inactive') {
      setIsAppActive(false);
      setShowBlurOverlay(true);
    } else if (nextAppState === 'active') {
      setIsAppActive(true);
      setTimeout(() => setShowBlurOverlay(false), 300);
    }
  });

  return () => subscription.remove();
}, []);

// Gère focus navigation
useFocusEffect(
  useCallback(() => {
    setIsAppActive(true);
    setShowBlurOverlay(false);
    return () => {
      // Optional: setShowBlurOverlay(true);
    };
  }, [])
);

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      cleanupRecording();
    };
  }, []);

  // Shake detection for bug report
  useEffect(() => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      const subscription = Accelerometer.addListener(accelerometerData => {
        const { x, y, z } = accelerometerData;
        const acceleration = Math.sqrt(x * x + y * y + z * z);
        const now = Date.now();
        
        if (acceleration > 3.0 && now - lastShake > 1000) {
          setLastShake(now);
          router.push('/bugreport');
        }
      });

      Accelerometer.setUpdateInterval(100);
      return () => subscription.remove();
    }
    return () => {};
  }, [lastShake]);

  // Recording timer
  const startRecordingTimer = () => {
    setRecordingDuration(0);
    recordingTimerRef.current = setInterval(() => {
      setRecordingDuration(prev => prev + 1);
    }, 1000);
  };

  const stopRecordingTimer = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // IMPROVED: Cleanup function with better error handling
  const cleanupRecording = async () => {
    console.log('🧹 Cleaning up recording...');
    
    // Clear auto-stop timeout
    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }
    
    stopRecordingTimer();
    
    if (recordingRef.current) {
      try {
        const status = await recordingRef.current.getStatusAsync();
        if (status.isRecording) {
          console.log('⏹️ Stopping active recording...');
          await recordingRef.current.stopAndUnloadAsync();
        }
      } catch (e) {
        console.log('⚠️ Recording cleanup error (safe to ignore):', e);
      }
      recordingRef.current = null;
    }
    
    isRecordingRef.current = false;
    setRecordingState('idle');
  };

  // IMPROVED: Start voice recording with better error handling and stable auto-stop
  const startVoiceRecording = async () => {
    // Check permissions first
    if (!audioPermissionRef.current) {
      try {
        const { status } = await Audio.requestPermissionsAsync();
        audioPermissionRef.current = status === 'granted';
        
        if (status !== 'granted') {
          Alert.alert(
            'Microphone Access Required',
            'Please enable microphone access in Settings to use voice recording.',
            [
              { text: 'Cancel', style: 'cancel' },
              { 
                text: 'Open Settings', 
                onPress: () => {
                  if (Platform.OS === 'ios') {
                    Linking.openURL('app-settings:');
                  } else {
                    Linking.openSettings();
                  }
                }
              }
            ]
          );
          return;
        }
      } catch (permError) {
        console.error('Permission request failed:', permError);
        showAlert('Error', 'Unable to request microphone permissions. Please check your device settings.');
        return;
      }
    }

    try {
      // Clean up any existing recording first
      await cleanupRecording();

      // Set audio mode optimized for voice recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });

      setRecordingState('recording');
      isRecordingRef.current = true;
      startRecordingTimer();

      // Create recording with optimized settings for speech recognition
      const { recording } = await Audio.Recording.createAsync({
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 16000, // Optimal for speech recognition
          numberOfChannels: 1, // Mono for better processing
          bitRate: 64000, // Lower bitrate for speech
        },
        ios: {
          extension: '.m4a',
          audioQuality: Audio.IOSAudioQuality.MEDIUM, // Better for speech
          sampleRate: 16000, // Optimal for speech recognition
          numberOfChannels: 1, // Mono for better processing
          bitRate: 64000, // Lower bitrate for speech
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/webm;codecs=opus',
          bitsPerSecond: 64000, // Lower bitrate for speech
        },
      });

      recordingRef.current = recording;

      // FIXED: Auto-stop using stable ref with proper cleanup
      stopTimeoutRef.current = setTimeout(() => {
        console.log('⏱️ Auto-stopping recording after 60 seconds');
        if (isRecordingRef.current && recordingRef.current) {
          stopVoiceRecording().catch(err => {
            console.error('Auto-stop error:', err);
            cleanupRecording();
          });
        }
      }, 60000);

      console.log('🎤 Recording started successfully');

    } catch (error: any) {
      console.error('Failed to start recording:', error);
      await cleanupRecording();
      
      // Better error messages based on error type
      let errorMessage = 'Unable to start recording. ';
      
      if (error.message?.includes('E_AUDIO_NODATA')) {
        errorMessage += 'No audio data received. Please check your microphone.';
      } else if (error.message?.includes('E_AUDIO_PERMISSIONS')) {
        errorMessage += 'Microphone permission denied. Please enable it in Settings.';
      } else if (error.message?.includes('E_AUDIO_BUSY')) {
        errorMessage += 'Another app is using the microphone. Please close other apps and try again.';
      } else if (error.message?.includes('E_AUDIO_RECORDING')) {
        errorMessage += 'Recording is already in progress.';
      } else {
        errorMessage += 'Please try again or type your message manually.';
      }
      
      Alert.alert(
        'Recording Failed',
        errorMessage,
        [{ text: 'OK', style: 'default' }]
      );
    }
  };

  // IMPROVED: Stop voice recording with better error handling
  const stopVoiceRecording = async () => {
    if (!recordingRef.current || !isRecordingRef.current) {
      console.log('⚠️ No active recording to stop');
      return;
    }

    // Clear auto-stop timeout immediately
    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }

    stopRecordingTimer();
    setRecordingState('processing');
    isRecordingRef.current = false;

    try {
      // Stop recording
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      
      if (!uri) {
        throw new Error('Recording completed but no file URI available');
      }

      // Get file info
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists) {
        throw new Error('Recording file not found after saving');
      }

      // Validate file size (max 25MB for most transcription services)
      const maxSize = 25 * 1024 * 1024; // 25MB
      if (info.size && info.size > maxSize) {
        throw new Error('Recording is too large. Please record a shorter message.');
      }

      console.log('🎤 Recording saved:', uri, 'Size:', info.size);

      // Read file as base64
      const base64Audio = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (!base64Audio || base64Audio.length === 0) {
        throw new Error('Recording file is empty');
      }

      // Send to speech-to-text
      await transcribeAudio(base64Audio);

    } catch (error: any) {
      console.error('Recording processing error:', error);
      
      Alert.alert(
        'Processing Failed',
        error.message || 'Failed to process your recording. Please try again.',
        [
          { 
            text: 'Try Again', 
            onPress: () => {
              setRecordingState('idle');
              setTimeout(() => startVoiceRecording(), 300);
            }
          },
          { 
            text: 'Type Manually', 
            style: 'cancel',
            onPress: () => setRecordingState('idle')
          },
        ]
      );
      
      setRecordingState('idle');
    } finally {
      recordingRef.current = null;
    }
  };

  // FIXED: Transcribe audio with comprehensive error handling and content moderation
const transcribeAudio = async (base64Audio: string, retryCount = 0) => {
  const MAX_RETRIES = 2;
  
  try {
    // Validate audio data
    if (!base64Audio || base64Audio.length < 100) {
      throw new Error('Audio data is too short or invalid. Please speak clearly and try again.');
    }

    // Check file size (base64 is ~33% larger than binary)
    const estimatedSize = (base64Audio.length * 3) / 4;
    const maxSize = 25 * 1024 * 1024; // 25MB
    if (estimatedSize > maxSize) {
      throw new Error('Audio file is too large. Please record a shorter message (max 60 seconds).');
    }

    console.log('🎤 Sending audio for transcription...', {
      size: `${(estimatedSize / 1024).toFixed(1)}KB`,
      retry: retryCount,
      timestamp: new Date().toISOString()
    });

    const { data, error } = await supabase.functions.invoke('transcribe-audio', {
      body: {
        audio: base64Audio,
        userId: user?.id,
        conversationId: currentConversation?.id,
        metadata: {
          platform: Platform.OS,
          appVersion: '1.0.0', // Replace with your actual version
          timestamp: new Date().toISOString()
        }
      },
      // Add timeout for better error handling
      headers: {
        'x-timeout': '30000' // 30 seconds
      }
    });

    // Handle function invocation errors
    if (error) {
      console.error('❌ Transcription function error:', {
        message: error.message,
        context: error.context,
        retryCount
      });

      // CONTENT VIOLATION DETECTION - Check multiple patterns
      const violationPatterns = [
        'content violation',
        'content_violation',
        'scam',
        'fraud',
        'suspended',
        'banned',
        'inappropriate content',
        'hate speech',
        'harassment',
        'violence',
        'illegal',
        'spam',
        'abuse'
      ];

      const errorMessageLower = error.message?.toLowerCase() || '';
      const isViolation = violationPatterns.some(pattern => 
        errorMessageLower.includes(pattern)
      );

      if (isViolation) {
        console.warn('🚫 Content violation detected:', error.message);
        
        // Extract violation details if available
        const violationType = error.context?.violationType || 'inappropriate content';
        const suspensionDays = error.context?.suspensionDays || 10;
        
        Alert.alert(
          '🚫 Account Suspended',
          `Your account has been suspended for ${suspensionDays} days due to ${violationType}.\n\n` +
          `Reason: ${error.message}\n\n` +
          `This conversation has been terminated. Please review our community guidelines.`,
          [
            { 
              text: 'View Guidelines', 
              onPress: () => {
                // Open community guidelines
                Linking.openURL('https://your-app.com/guidelines').catch(() => {});
                router.push('/suspended');
              }
            },
            { 
              text: 'OK', 
              onPress: () => router.push('/suspended'),
              style: 'destructive'
            }
          ]
        );
        
        // Log violation for analytics/monitoring
        await logSecurityEvent('content_violation', {
          userId: user?.id,
          violationType,
          timestamp: new Date().toISOString(),
          conversationId: currentConversation?.id
        });
        
        setRecordingState('idle');
        return;
      }

      // NETWORK/TIMEOUT ERRORS - Retry logic
      const networkErrorPatterns = [
        'timeout',
        'network',
        'fetch',
        'connection',
        'offline',
        'unreachable',
        'econnrefused',
        'socket',
        'abort'
      ];
      
      const isNetworkError = networkErrorPatterns.some(pattern => 
        errorMessageLower.includes(pattern)
      );

      if (isNetworkError && retryCount < MAX_RETRIES) {
        console.log(`🔄 Retrying transcription (${retryCount + 1}/${MAX_RETRIES})...`);
        
        // Exponential backoff
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return transcribeAudio(base64Audio, retryCount + 1);
      }

      if (isNetworkError) {
        throw new Error(
          'Network connection issue. Please check your internet connection and try again. ' +
          'If the problem persists, try typing your message instead.'
        );
      }

      // AUTHENTICATION ERRORS
      if (errorMessageLower.includes('auth') || errorMessageLower.includes('unauthorized') || errorMessageLower.includes('401')) {
        throw new Error('Your session has expired. Please log in again.');
      }

      // RATE LIMITING
      if (errorMessageLower.includes('rate limit') || errorMessageLower.includes('too many requests') || errorMessageLower.includes('429')) {
        throw new Error('Too many requests. Please wait a moment and try again.');
      }

      // SERVER ERRORS
      if (errorMessageLower.includes('500') || errorMessageLower.includes('internal server error')) {
        throw new Error('Server error. Our team has been notified. Please try again later.');
      }

      // Default error
      throw new Error(error.message || 'Transcription service encountered an error. Please try again.');
    }

    // Validate response data
    if (!data) {
      throw new Error('No response received from transcription service. Please try again.');
    }

    console.log('✅ Transcription response:', {
      hasText: !!data.text,
      textLength: data.text?.length,
      hasWarning: !!data.warning,
      confidence: data.confidence,
      language: data.detectedLanguage
    });

    // Success case - Valid transcription
    if (data.text && data.text.trim()) {
      const transcribedText = data.text.trim();
      console.log('📝 Transcribed successfully:', transcribedText.substring(0, 50) + '...');
      
      setInputText(prev => prev + (prev ? ' ' : '') + transcribedText);
      setRecordingState('idle');

      // Show success feedback with confidence indicator
      const confidence = data.confidence || 0;
      if (confidence > 0.8) {
        showAlert('✅ Voice Transcribed', 'High confidence transcription!');
      } else if (confidence > 0.5) {
        showAlert('✅ Voice Transcribed', 'Please review for accuracy.');
      } else {
        showAlert('⚠️ Low Confidence', 'Please check the transcription and edit if needed.');
      }
      
      return;
    }

    // Warning case - No speech detected or unclear audio
    if (data.warning) {
      console.warn('⚠️ Transcription warning:', data.warning);
      
      Alert.alert(
        'No Speech Detected',
        data.warning + '\n\nTips:\n• Speak clearly and closer to the microphone\n• Reduce background noise\n• Try speaking louder',
        [
          {
            text: 'Try Again',
            onPress: () => {
              setRecordingState('idle');
              setTimeout(() => startVoiceRecording(), 300);
            }
          },
          {
            text: 'Type Manually',
            style: 'cancel',
            onPress: () => setRecordingState('idle')
          }
        ]
      );
      return;
    }

    // Empty response case
    throw new Error('No transcription received. The audio may be unclear or too short.');

  } catch (transcriptionError: any) {
    console.error('❌ Transcription error:', {
      message: transcriptionError.message,
      stack: transcriptionError.stack,
      retryCount
    });

    // Don't show alert if it's already handled (like violation)
    if (transcriptionError.message?.includes('suspended')) {
      return;
    }

    // Determine user-friendly error message
    let userMessage = 'Could not transcribe your audio. ';
    
    if (transcriptionError.message?.includes('too short')) {
      userMessage += 'Please speak for at least 2-3 seconds.';
    } else if (transcriptionError.message?.includes('internet')) {
      userMessage += 'Please check your connection and try again.';
    } else if (transcriptionError.message?.includes('expired')) {
      userMessage = 'Your session expired. Please log in again.';
      // Optionally redirect to login
      setTimeout(() => router.push('/login'), 2000);
    } else {
      userMessage += transcriptionError.message || 'Please try again or type your message.';
    }

    Alert.alert(
      'Transcription Failed',
      userMessage,
      [
        {
          text: 'Try Recording Again',
          onPress: () => {
            setRecordingState('idle');
            setTimeout(() => startVoiceRecording(), 500);
          }
        },
        {
          text: 'Type Manually',
          style: 'cancel',
          onPress: () => setRecordingState('idle')
        }
      ]
    );
  }
};

// Helper function to log security events
const logSecurityEvent = async (eventType: string, details: any) => {
  try {
    await supabase.from('security_logs').insert({
      event_type: eventType,
      user_id: details.userId,
      details: details,
      created_at: new Date().toISOString()
    });
  } catch (e) {
    console.error('Failed to log security event:', e);
  }
};

  // Toggle recording
  const toggleRecording = () => {
    if (recordingState === 'idle') {
      startVoiceRecording();
    } else if (recordingState === 'recording') {
      stopVoiceRecording();
    }
  };

  // Handle send message
  const handleSend = async () => {
    if ((!inputText.trim() && selectedMedia.length === 0) || sending) return;

    if (!editingMessageId && !canSendMessage()) {
      if (!user) {
        showAlert(
          'Login Required',
          `Please log in to start chatting with AI.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Log In', onPress: () => router.push('/login') },
          ]
        );
      } else {
        showAlert(
          'Coins Required',
          `You need coins to continue chatting. You have ${coins} coins remaining.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Buy Coins', onPress: () => router.push('/buy-coins') },
          ]
        );
      }
      return;
    }
    
    let conversationId = currentConversation?.id;
    if (!conversationId) {
      console.log('📝 Creating new conversation for first message');
      conversationId = await createConversation();
      if (!conversationId) {
        showAlert('Error', 'Failed to create conversation');
        return;
      }
    }

    setSending(true);
    setGenerating(true);
    const text = inputText;
    const media = selectedMedia;
    const editingId = editingMessageId;
    
    setInputText('');
    setSelectedMedia([]);
    setEditingMessageId(null);
    setThinkingMode('thinking');

    try {
      if (editingId) {
        console.log('🔄 Editing message:', editingId);
        await updateMessageAndRegenerate(editingId, text, currentAIModel);
        setGenerating(false);
        setSending(false);
        return;
      }

      console.log('📤 Sending new message with model:', currentAIModel);
      
      let imageUrl: string | undefined;
      if (media.length > 0) {
        const firstMedia = media[0];
        if (firstMedia.type === 'image' && firstMedia.base64) {
          const fileName = `${Date.now()}.jpg`;
          const filePath = `${conversationId}/${fileName}`;
          
          const { error: uploadError } = await supabase.storage
            .from('chat-images')
            .upload(filePath, decode(firstMedia.base64), {
              contentType: 'image/jpeg',
            });

          if (!uploadError) {
            const { data: urlData } = supabase.storage
              .from('chat-images')
              .getPublicUrl(filePath);
            imageUrl = urlData.publicUrl;
          }
        }
      }

      await sendMessage(text || '[Image]', imageUrl, currentAIModel);

      setShowCompletionStatus(true);
      setTimeout(() => {
        setShowCompletionStatus(false);
      }, 2000);

      // Deduct coins for non-free messages (admins and unlimited users don't get charged)
      if (user && !isUnlimited && !isAdmin) {
        await incrementMessageCount();
        // Note: Coin deduction happens on the backend when processing AI responses
      }

    } catch (error: any) {
      console.error('❌ Send error:', error);
      const errorMsg = error?.message || (editingId ? 'Failed to update message' : 'Failed to send message');
      showAlert('Error', errorMsg);
    } finally {
      setSending(false);
      setGenerating(false);
    }
  };

  const handleCancelGeneration = () => {
    setGenerating(false);
    showAlert('Cancelled', 'AI response generation stopped');
  };

  const handleEditMessage = (messageId: string, content: string) => {
    setEditingMessageId(messageId);
    setInputText(content);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setInputText('');
  };

  const handleMediaPicked = (media: any[]) => {
    setSelectedMedia(media);
  };

  const handleAIModelSelect = async (model: string) => {
    console.log('🤖 AI Model changed to:', model);
    setCurrentAIModel(model);
    await updateSetting('preferredAiModel', model);
    showAlert('Model Updated', `Now using ${model === 'gemini' ? 'Gemini' : model === 'openai' ? 'OpenAI' : model === 'claude' ? 'Claude' : 'Llama'} for all responses`);
  };

  const handleNewChat = () => {
    createConversation();
    setInputText('');
    setSelectedMedia([]);
  };

  const handleSelectAIMode = (mode: AIMode) => {
    setCurrentAIMode(mode);
    // Update AI behavior based on mode
    switch (mode) {
      case 'instant':
        setCurrentAIModel('gemini');
        break;
      case 'deep-thinking':
        setCurrentAIModel('gemini-2.0-flash-exp');
        break;
      case 'agent':
        setCurrentAIModel('onspace-ai');
        break;
    }
  };

  // Styles
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: Platform.select({ ios: insets.top, android: insets.top, default: 0 }),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerButton: {
      padding: Spacing.xs,
      marginLeft: Spacing.xs,
    },
    newChatButton: {
      padding: Spacing.xs,
      marginLeft: Spacing.sm,
    },
    headerTitle: {
      ...Typography.heading,
      color: colors.text,
      flex: 1,
      marginLeft: Spacing.sm,
    },
    // ============ AJOUTE NAN STYLE YO ============

blurOverlayContainer: {
  ...StyleSheet.absoluteFillObject,
  zIndex: 9999,
  justifyContent: 'center',
  alignItems: 'center',
},
blurView: {
  ...StyleSheet.absoluteFillObject,
  justifyContent: 'center',
  alignItems: 'center',
},
blurContent: {
  alignItems: 'center',
  justifyContent: 'center',
},
blurText: {
  fontSize: 24,
  fontWeight: 'bold',
  color: 'white',
  marginTop: 16,
},
blurSubtext: {
  fontSize: 14,
  color: 'rgba(255,255,255,0.7)',
  marginTop: 8,
},
    modelButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 4,
      borderRadius: BorderRadius.sm,
      marginRight: Spacing.sm,
    },
    modelText: {
      ...Typography.caption,
      color: colors.text,
      fontSize: 11,
      marginRight: 4,
    },
    messagesContainer: {
      flex: 1,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.md,
      paddingBottom: Platform.select({ ios: insets.bottom + Spacing.md, android: insets.bottom + Spacing.md, default: Spacing.md }),
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: Spacing.sm,
      backgroundColor: colors.background,
    },
    inputWrapper: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.inputBackground,
      borderRadius: BorderRadius.lg,
      paddingHorizontal: Spacing.md,
      minHeight: 44,
      maxHeight: 120,
    },
    input: {
      flex: 1,
      ...Typography.body,
      color: colors.text,
      paddingVertical: Spacing.sm,
      maxHeight: 100,
    },
    recordingIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: Spacing.sm,
    },
    recordingDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#FF3B30',
    },
    recordingDotActive: {
      backgroundColor: '#FF3B30',
      shadowColor: '#FF3B30',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.8,
      shadowRadius: 6,
      elevation: 8,
    },
    recordingText: {
      ...Typography.body,
      color: '#FF3B30',
      fontWeight: '600',
    },
    recordingDuration: {
      ...Typography.caption,
      color: colors.textSecondary,
      marginLeft: 'auto',
    },
    iconButton: {
      padding: Spacing.xs,
    },
    sendButton: {
      backgroundColor: colors.primary,
      borderRadius: BorderRadius.full,
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    recordingButton: {
      backgroundColor: '#FF3B30',
    },
    processingButton: {
      backgroundColor: colors.textSecondary,
    },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.xl,
    },
    emptyIcon: {
      marginBottom: Spacing.md,
    },
    emptyTitle: {
      ...Typography.heading,
      color: colors.text,
      marginBottom: Spacing.xs,
    },
    emptyText: {
      ...Typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    loadingContainer: {
      padding: Spacing.md,
      alignItems: 'center',
    },
    selectedMediaPreview: {
      flexDirection: 'row',
      gap: Spacing.xs,
      paddingHorizontal: Spacing.md,
      paddingBottom: Spacing.sm,
    },
    mediaPreviewItem: {
      width: 60,
      height: 60,
      borderRadius: BorderRadius.sm,
      backgroundColor: colors.surface,
      position: 'relative',
      overflow: 'hidden',
    },
    mediaImage: {
      width: '100%',
      height: '100%',
    },
    removeMediaButton: {
      position: 'absolute',
      top: -6,
      right: -6,
      backgroundColor: '#FF3B30',
      borderRadius: BorderRadius.full,
      width: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    editingIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      backgroundColor: `${colors.primary}20`,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    editingText: {
      ...Typography.caption,
      color: colors.primary,
      flex: 1,
    },
  });

const renderMessage = ({ item, index }: { item: any; index: number }) => {
  const isStreaming = streamingMessageId === item.id;
  
  return (
    <MessageItem
      message={item}
      onCancel={handleCancelGeneration}
      onEdit={handleEditMessage}
      isGenerating={isStreaming}
      streaming={isStreaming} // Only true for the specific streaming message
    />
  );
};

  const modelName = currentAIModel === 'gemini' ? 'Gemini' 
    : currentAIModel === 'openai' ? 'OpenAI' 
    : currentAIModel === 'claude' ? 'Claude'
    : 'Llama';

  // Determine send button state
  const showSendButton = inputText.trim() || selectedMedia.length > 0;
  const isRecording = recordingState === 'recording';
  const isProcessing = recordingState === 'processing';

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <StatusBar barStyle={colors.text === '#FFFFFF' ? 'light-content' : 'dark-content'} />
      
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.headerButton} onPress={() => setSideMenuVisible(true)}>
            <Ionicons name="menu" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {currentConversation?.title || 'Haitian AI Chat'}
          </Text>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setChatHistoryVisible(true)}
          >
            <Ionicons name="time-outline" size={22} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.newChatButton}
            onPress={handleNewChat}
          >
            <Ionicons name="add-circle" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : messages.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="chatbubbles-outline" size={64} color={colors.textSecondary} style={styles.emptyIcon} />
          <Text style={styles.emptyTitle}>Start a conversation</Text>
          <Text style={styles.emptyText}>
            Ask me anything! I can help with questions, creative writing, coding, analysis, and more.
          </Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingVertical: Spacing.md }}
          ListFooterComponent={generating ? (
            <ThinkingIndicator 
              userMessage={messages.length > 0 ? messages[messages.length - 1].content : inputText}
              completed={showCompletionStatus}
            />
          ) : null}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
      )}

      {selectedMedia.length > 0 && (
        <View style={styles.selectedMediaPreview}>
          {selectedMedia.map((media, index) => (
            <View key={index} style={styles.mediaPreviewItem}>
              {media.type === 'image' ? (
                <Image source={{ uri: media.uri }} style={styles.mediaImage} resizeMode="cover" />
              ) : (
                <Ionicons name="document" size={32} color={colors.textSecondary} style={{ margin: 14 }} />
              )}
              <TouchableOpacity
                style={styles.removeMediaButton}
                onPress={() => setSelectedMedia(prev => prev.filter((_, i) => i !== index))}
              >
                <Ionicons name="close" size={12} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {editingMessageId && (
        <View style={styles.editingIndicator}>
          <Ionicons name="pencil" size={16} color={colors.primary} />
          <Text style={styles.editingText}>Editing message</Text>
          <TouchableOpacity onPress={handleCancelEdit}>
            <Text style={{ ...Typography.caption, color: colors.primary, fontWeight: '600' }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.inputContainer}>

<TouchableOpacity 
  style={styles.iconButton} 
  onPress={() => setToolsVisible(true)} 
  disabled={editingMessageId !== null || isRecording || isProcessing}
>
  <Ionicons 
    name="add-circle-outline" 
    size={28} 
    color={editingMessageId || isRecording || isProcessing ? colors.textSecondary : colors.text} 
  />
</TouchableOpacity>


        <View style={styles.inputWrapper}>
          {isRecording ? (
            <View style={styles.recordingIndicator}>
              <View style={[styles.recordingDot, styles.recordingDotActive]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.recordingText}>Recording... (shake to cancel)</Text>
                <Text style={styles.recordingDuration}>{formatDuration(recordingDuration)}</Text>
              </View>
            </View>
          ) : isProcessing ? (
            <View style={styles.recordingIndicator}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={{ ...Typography.body, color: colors.text, marginLeft: Spacing.sm }}>
                Transcribing voice...
              </Text>
            </View>
          ) : (
            <TextInput
              style={styles.input}
              placeholder={editingMessageId ? "Edit message..." : "Message..."}
              placeholderTextColor={colors.textSecondary}
              value={inputText}
              onChangeText={setInputText}
              multiline
              editable={!sending && !isRecording && !isProcessing}
            />
          )}
        </View>


        {editingMessageId && (
          <TouchableOpacity 
            style={styles.iconButton} 
            onPress={handleCancelEdit}
          >
            <Ionicons name="close-circle-outline" size={24} color="#FF3B30" />
          </TouchableOpacity>
        )}

        {showSendButton ? (
          <TouchableOpacity 
            style={styles.sendButton} 
            onPress={handleSend}
            disabled={sending || isRecording || isProcessing}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={[
              styles.sendButton, 
              isRecording && styles.recordingButton,
              isProcessing && styles.processingButton
            ]} 
            onPress={toggleRecording}
            disabled={editingMessageId !== null || isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons 
                name={isRecording ? "stop" : "mic"} 
                size={20} 
                color="#FFFFFF" 
              />
            )}
          </TouchableOpacity>
        )}
      </View>

      <MenuModal visible={menuVisible} onClose={() => setMenuVisible(false)} />
      <ToolsModal
        visible={toolsVisible}
        onClose={() => setToolsVisible(false)}
        onSelectTool={(tool) => setInputText(`[${tool}] `)}
        onPickMedia={handleMediaPicked}
        onSelectAIModel={handleAIModelSelect}
        onOpenCamera={() => router.push('/camera')}
        currentModel={currentAIModel}
      />
      <ConversationMenuModal
        visible={conversationMenuVisible}
        onClose={() => setConversationMenuVisible(false)}
        onShare={() => {}}
        onRename={() => {}}
        onReport={() => router.push('/bugreport')}
        onArchive={() => {}}
        onDelete={async () => {
          if (currentConversation) {
            await deleteConversation(currentConversation.id);
            await createConversation();
          }
        }}
      />

      <SideMenu
        visible={sideMenuVisible}
        onClose={() => setSideMenuVisible(false)}
        currentProject={{ name: 'Haitian AI Chat' }}
        currentAIMode={currentAIMode}
        onSelectAIMode={handleSelectAIMode}
        onNewChat={handleNewChat}
        onChatHistory={() => {
          setSideMenuVisible(false);
          setChatHistoryVisible(true);
        }}
        onSettings={() => {
          setSideMenuVisible(false);
          router.push('/settings');
        }}
        onProfile={() => {
          setSideMenuVisible(false);
          router.push('/profile');
        }}
      />

      <ChatHistoryModal
        visible={chatHistoryVisible}
        onClose={() => setChatHistoryVisible(false)}
        onSelectChat={(chatId) => {
          // Handle chat selection
          setChatHistoryVisible(false);
        }}
        onNewChat={() => {
          handleNewChat();
          setChatHistoryVisible(false);
        }}
        currentChatId={currentConversation?.id}
      />

      {showBlurOverlay && (
        <View style={styles.blurOverlayContainer}>
          <BlurView intensity={80} tint="dark" style={styles.blurView}>
            <View style={styles.blurContent}>
              <Ionicons name="lock-closed" size={40} color="rgba(255,255,255,0.8)" />
              <Text style={styles.blurText}>Haitian AI Chat</Text>
              <Text style={styles.blurSubtext}>App locked for privacy</Text>
            </View>
          </BlurView>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
