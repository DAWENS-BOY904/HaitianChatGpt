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

// Recording states
type RecordingState = 'idle' | 'recording' | 'processing';

export default function HomeScreen() {
  const [isAppActive, setIsAppActive] = useState(true);
  const [showBlurOverlay, setShowBlurOverlay] = useState(false);
  const { colors } = useTheme();
  const { settings, updateSetting } = useSettings();
  const { user } = useAuth();
  const { canSendMessage, incrementMessageCount, remainingMessages } = useGuestLimits();
  const { conversations, messages, currentConversation, sendMessage, updateMessage, updateMessageAndRegenerate, createConversation, loading, updateConversationTitle, deleteConversation } = useConversation();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  // State
  const [inputText, setInputText] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);
  const [toolsVisible, setToolsVisible] = useState(false);
  const [conversationMenuVisible, setConversationMenuVisible] = useState(false);
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

  // Auto-create conversation when user enters home page
  useEffect(() => {
    const initConversation = async () => {
      if (!currentConversation && user) {
        console.log('🆕 Auto-creating new conversation on mount');
        await createConversation();
      }
    };
    initConversation();
  }, []);

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

      // Set audio mode explicitly before recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      setRecordingState('recording');
      isRecordingRef.current = true;
      startRecordingTimer();

      // Create recording with specific options for better compatibility
      const { recording } = await Audio.Recording.createAsync({
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
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

  // IMPROVED: Transcribe audio with better error handling
  const transcribeAudio = async (base64Audio: string) => {
    try {
      // Validate audio data
      if (!base64Audio || base64Audio.length < 100) {
        throw new Error('Audio data is too short or invalid');
      }

      const { data, error } = await supabase.functions.invoke('transcribe-audio', {
        body: {
          audio: base64Audio,
          userId: user?.id,
          conversationId: currentConversation?.id,
        },
      });

      // Move this try-catch block inside the outer try block, after the supabase invoke call
      // to ensure `data` and `error` are defined.
      try { 
        // Check for content violation / account suspension
        if (error?.message?.includes('Content violation')) {
          Alert.alert(
            '🚫 Account Suspended',
            "Don't fucking say that! Your account has been suspended for 10 days due to scam/fraud content. This conversation has been terminated.",
            [{ text: 'OK', onPress: () => router.push('/suspended') }]
          );
          setRecordingState('idle');
          return;
        }

        if (error) {
          console.error('Transcription function error:', error);
          throw new Error(error.message || 'Transcription service error');
        }

        if (data?.text && data.text.trim()) {
          console.log('📝 Transcribed:', data.text);
          setInputText(prev => prev + (prev ? ' ' : '') + data.text.trim());
          setRecordingState('idle');
        } else if (data?.text === '') {
          // Empty transcription - speech not detected
          Alert.alert(
            'No Speech Detected',
            "We couldn't detect any speech in your recording. Please try speaking louder or closer to the microphone.",
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
        } else {
          throw new Error('No transcription received from service');
        }
      } catch (innerError: any) { // Catch block for transcription processing specific errors
        console.error('Transcription error:', innerError);
        
        Alert.alert(
          'Transcription Failed',
          innerError.message || 'Could not transcribe your audio. Please try again or type your message.',
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
      }
    } catch (outerError: any) { // Catch block for initial setup/invoke errors
      console.error('Transcription initiation error:', outerError);
      Alert.alert(
        'Transcription Failed',
        outerError.message || 'Could not initiate transcription. Please try again.',
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
      showAlert(
        'Login Required',
        `You have used your 2 free messages. Please log in to continue chatting.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log In', onPress: () => router.push('/login') },
        ]
      );
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
      let base64Image: string | undefined;
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

      await sendMessage(text || '[Image]', imageUrl, base64Image, currentAIModel);
      
      setShowCompletionStatus(true);
      setTimeout(() => {
        setShowCompletionStatus(false);
      }, 2000);
      
      await incrementMessageCount();
      
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
    headerButton: {
      padding: Spacing.xs,
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

  const renderMessage = ({ item, index }: { item: any; index: number }) => (
    <MessageItem
      message={item}
      onCancel={handleCancelGeneration}
      onEdit={(messageId, content) => handleEditMessage(messageId, content)}
      isGenerating={generating && index === messages.length - 1}
      streaming={generating && index === messages.length - 1}
    />
  );

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
          <TouchableOpacity style={styles.headerButton} onPress={() => setMenuVisible(true)}>
            <Ionicons name="menu" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {currentConversation?.title || 'HaitianChatGpt'}
          </Text>
        </View>
        
        <TouchableOpacity 
          style={styles.modelButton} 
          onPress={() => router.push('/model-selector')}
        >
          <Text style={styles.modelText}>{modelName}</Text>
          <Ionicons name="chevron-down" size={12} color={colors.text} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.headerButton} onPress={() => router.push('/upload-manager')}>
          <Ionicons name="cloud-upload-outline" size={22} color={colors.text} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.headerButton} onPress={() => router.push('/conversation-viewer')}>
          <Ionicons name="document-text-outline" size={22} color={colors.text} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.headerButton} onPress={() => router.push('/social')}>
          <Ionicons name="people" size={24} color={colors.text} />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.headerButton} onPress={() => setConversationMenuVisible(true)}>
          <Ionicons name="ellipsis-horizontal" size={24} color={colors.text} />
        </TouchableOpacity>
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
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>Recording...</Text>
              <Text style={styles.recordingDuration}>{formatDuration(recordingDuration)}</Text>
            </View>
          ) : isProcessing ? (
            <View style={styles.recordingIndicator}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={{ ...Typography.body, color: colors.text, marginLeft: Spacing.sm }}>
                Transcribing...
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
      {showBlurOverlay && (
  <View style={styles.blurOverlayContainer}>
    <BlurView intensity={80} tint="dark" style={styles.blurView}>
      <View style={styles.blurContent}>
        <Ionicons name="lock-closed" size={40} color="rgba(255,255,255,0.8)" />
        <Text style={styles.blurText}>HaitianChatGpt</Text>
        <Text style={styles.blurSubtext}>App locked for privacy</Text>
      </View>
    </BlurView>
  </View>
)}
    </KeyboardAvoidingView>
  );
}
