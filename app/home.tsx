import React, { useState, useRef, useEffect, useCallback, useMemo, Component } from 'react';
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
  Clipboard,
  Share,
  Vibration,
  Dimensions,
  Animated,
  Easing,
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
import { useRouter } from 'expo-router';
import { Accelerometer } from 'expo-sensors';
import { Audio } from 'expo-av';
import { useFocusEffect } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import * as FileSystem from 'expo-file-system';
import { SideMenu } from '../components/SideMenu';
import { ChatHistoryModal } from '../components/ChatHistoryModal';
import { AIMode } from '../components/AIModeSelectorModal';
import { CalculatorModal, CalculatorCard, detectMathExpression } from '../components/CalculatorModal';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

// ==========================================
// TYPE DEFINITIONS
// ==========================================

type RecordingState = 'idle' | 'recording' | 'processing';

interface MediaFile {
  type: 'image' | 'document' | 'video';
  uri: string;
  base64?: string;
  name?: string;
  size?: number;
  mimeType?: string;
}

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  createdAt: string;
  imageUrl?: string;
  isEdited?: boolean;
  isDeleted?: boolean;
  reactions?: string[];
}

// ==========================================
// CONSTANTS
// ==========================================

const MAX_RECORDING_DURATION = 60; // seconds
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const SHAKE_THRESHOLD = 3.0;
const SHAKE_COOLDOWN = 1000; // ms
const AUTO_LOCK_DELAY = 30000; // 30 seconds for security
const SUPPORTED_AI_MODELS = {
  gemini: 'Gemini',
  openai: 'OpenAI',
  claude: 'Claude',
  llama: 'Llama',
  'gemini-2.0-flash-exp': 'Gemini 2.0 Flash',
  'onspace-ai': 'OnSpace AI'
} as const;

type AIModelKey = keyof typeof SUPPORTED_AI_MODELS;

// ==========================================
// MAIN COMPONENT
// ==========================================

export default function HomeScreen() {
  // -------- Hooks & Refs --------
  const { colors, isDark } = useTheme();
  const { settings, updateSetting } = useSettings();
  const { user } = useAuth();
  const { 
    canSendMessage, 
    coins, 
    isUnlimited, 
    incrementMessageCount, 
    isAdmin 
  } = useGuestLimits();
  
  const { 
    conversations, 
    messages, 
    currentConversation, 
    sendMessage, 
    updateMessageAndRegenerate, 
    createConversation, 
    deleteConversation,
    loading, 
    streamingMessageId,
    updateConversationTitle,
    archiveConversation,
    selectConversation,
  } = useConversation();
  
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();
  
  // -------- State --------
  const [isAppActive, setIsAppActive] = useState(true);
  const [showBlurOverlay, setShowBlurOverlay] = useState(false);
  const [inputText, setInputText] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);
  const [toolsVisible, setToolsVisible] = useState(false);
  const [conversationMenuVisible, setConversationMenuVisible] = useState(false);
  const [sideMenuVisible, setSideMenuVisible] = useState(false);
  const [chatHistoryVisible, setChatHistoryVisible] = useState(false);
  const [currentAIMode, setCurrentAIMode] = useState<AIMode>('instant');
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<MediaFile[]>([]);
  const [currentAIModel, setCurrentAIModel] = useState<AIModelKey>(
    (settings.preferredAiModel as AIModelKey) || 'gemini'
  );
  const inputRef = useRef<TextInput>(null);
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [lastShake, setLastShake] = useState(0);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [calcVisible, setCalcVisible] = useState(false);
  const [calcExpression, setCalcExpression] = useState('');
  const [calcResult, setCalcResult] = useState('');
  const [thinkingMode, setThinkingMode] = useState<'thinking' | 'creating_image' | 'analyzing' | 'editing_image'>('thinking');
  const [showCompletionStatus, setShowCompletionStatus] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredMessages, setFilteredMessages] = useState<Message[]>([]);
  const [timeUntilMidnight, setTimeUntilMidnight] = useState('');
  const [sessionBonusMessages, setSessionBonusMessages] = useState(0);
  const [hasUsedNewChatBonus, setHasUsedNewChatBonus] = useState(false);
  const [codeLangChips, setCodeLangChips] = useState(false);
  
  const runOnJS_setSideMenu = useCallback((val: boolean) => setSideMenuVisible(val), []);

  // Compute time until midnight and update every minute
  const computeTimeUntilMidnight = useCallback(() => {
    const now = new Date();
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    const diff = midnight.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    setTimeUntilMidnight(`${hours}h ${minutes}m`);
  }, []);

  useEffect(() => {
    computeTimeUntilMidnight();
    const interval = setInterval(computeTimeUntilMidnight, 60000);
    return () => clearInterval(interval);
  }, [computeTimeUntilMidnight]);

  // Swipe gesture to open side menu
  const swipeGesture = Gesture.Pan()
    .activeOffsetX([10, 10000])
    .onEnd((e) => {
      if (e.translationX > 60 && e.velocityX > 100 && !sideMenuVisible) {
        runOnJS(runOnJS_setSideMenu)(true);
      }
    });

  // Animation state
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(100)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  // Refs
  const flatListRef = useRef<FlatList>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioPermissionRef = useRef<boolean>(false);
  const isRecordingRef = useRef<boolean>(false);
  const stopTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const autoLockTimerRef = useRef<NodeJS.Timeout | null>(null);

  // -------- EFFECTS --------

  // Initialize audio permissions
  useEffect(() => {
    checkAudioPermissions();
    setupNetworkListener();
    return () => {
      cleanupAll();
    };
  }, []);

  // Do NOT auto-create empty conversations — only create on first real send

  // Cleanup all resources
  const cleanupAll = useCallback(() => {
    if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (autoLockTimerRef.current) clearTimeout(autoLockTimerRef.current);
    cleanupRecording();
  }, []);

  // App state handling (background/foreground) + Auto-lock security
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      appStateRef.current = nextAppState;

      if (nextAppState === 'background' || nextAppState === 'inactive') {
        setIsAppActive(false);
        setShowBlurOverlay(true);
        
        autoLockTimerRef.current = setTimeout(() => {
          console.log('Auto-locked for security');
        }, AUTO_LOCK_DELAY);
        
      } else if (nextAppState === 'active') {
        setIsAppActive(true);
        
        if (autoLockTimerRef.current) {
          clearTimeout(autoLockTimerRef.current);
          autoLockTimerRef.current = null;
        }
        
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => setShowBlurOverlay(false));
        
        if (currentConversation?.id) {
          selectConversation(currentConversation.id);
        }
      }
    });

    return () => subscription.remove();
  }, [currentConversation?.id, selectConversation, fadeAnim]);

  // Focus effect for navigation
  useFocusEffect(
    useCallback(() => {
      setIsAppActive(true);
      setShowBlurOverlay(false);
      fadeAnim.setValue(1);
      
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();

      return () => {
        slideAnim.setValue(100);
      };
    }, [fadeAnim, slideAnim])
  );

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0 && !isSearchMode) {
      const timer = setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [messages, isSearchMode]);

  // Search functionality
  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = messages.filter(msg => 
        msg.content.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredMessages(filtered);
    } else {
      setFilteredMessages([]);
    }
  }, [searchQuery, messages]);

  // Shake detection for bug report
  useEffect(() => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      const subscription = Accelerometer.addListener(accelerometerData => {
        const { x, y, z } = accelerometerData;
        const acceleration = Math.sqrt(x * x + y * y + z * z);
        const now = Date.now();
        
        if (acceleration > SHAKE_THRESHOLD && now - lastShake > SHAKE_COOLDOWN) {
          setLastShake(now);
          Vibration.vibrate(500);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          router.push('/bugreport');
        }
      });

      Accelerometer.setUpdateInterval(100);
      return () => subscription.remove();
    }
    return () => {};
  }, [lastShake, router]);

  // Recording pulse animation
  useEffect(() => {
    if (recordingState === 'recording') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [recordingState, pulseAnim]);

  // -------- UTILITY FUNCTIONS --------

  const setupNetworkListener = () => {
    return () => {};
  };

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

  // -------- VOICE RECORDING --------

  const startRecordingTimer = useCallback(() => {
    setRecordingDuration(0);
    recordingTimerRef.current = setInterval(() => {
      setRecordingDuration(prev => {
        if (prev >= MAX_RECORDING_DURATION - 1) {
          stopVoiceRecording();
          return prev;
        }
        return prev + 1;
      });
    }, 1000);
  }, []);

  const stopRecordingTimer = useCallback(() => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }, []);

  const formatDuration = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const cleanupRecording = useCallback(async () => {
    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }
    
    stopRecordingTimer();
    
    if (recordingRef.current) {
      try {
        const status = await recordingRef.current.getStatusAsync();
        if (status.isRecording) {
          await recordingRef.current.stopAndUnloadAsync();
        }
      } catch (e) {
        console.log('Recording cleanup error:', e);
      }
      recordingRef.current = null;
    }
    
    isRecordingRef.current = false;
    setRecordingState('idle');
    setRecordingDuration(0);
  }, [stopRecordingTimer]);

  const startVoiceRecording = async () => {
    // Always re-request permissions to ensure they are current
    try {
      const { status } = await Audio.requestPermissionsAsync();
      audioPermissionRef.current = status === 'granted';
    } catch (e) {
      audioPermissionRef.current = false;
    }

    if (!audioPermissionRef.current) {
      Alert.alert(
        'Microphone Required',
        'Please enable microphone access in Settings to use voice recording.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Open Settings', 
            onPress: () => Platform.OS === 'ios' 
              ? Linking.openURL('app-settings:') 
              : Linking.openSettings()
          }
        ]
      );
      return;
    }

    try {
      // Fully clean up any previous recording, then wait for audio session to release
      await cleanupRecording();
      await new Promise(r => setTimeout(r, 150));

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setRecordingState('recording');
      isRecordingRef.current = true;
      startRecordingTimer();

      const { recording } = await Audio.Recording.createAsync({
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 64000,
        },
        ios: {
          extension: '.m4a',
          audioQuality: Audio.IOSAudioQuality.MEDIUM,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 64000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/webm;codecs=opus',
          bitsPerSecond: 64000,
        },
      });

      recordingRef.current = recording;

      stopTimeoutRef.current = setTimeout(() => {
        if (isRecordingRef.current) {
          stopVoiceRecording();
        }
      }, MAX_RECORDING_DURATION * 1000);

    } catch (error: any) {
      console.error('Failed to start recording:', error);
      await cleanupRecording();
      
      let errorMessage = 'Could not start recording. ';
      if (error.message?.includes('E_AUDIO_NODATA')) {
        errorMessage += 'No audio data detected. Check your microphone.';
      } else if (error.message?.includes('E_AUDIO_PERMISSIONS') || error.message?.includes('permission')) {
        errorMessage = 'Microphone permission denied. Please enable it in Settings.';
      } else if (error.message?.includes('E_AUDIO_BUSY') || error.message?.includes('busy')) {
        errorMessage += 'Another app is using the microphone. Close it and try again.';
      } else if (error.message?.includes('E_AUDIO_FOCUS')) {
        errorMessage += 'Audio focus could not be obtained. Try again.';
      } else {
        errorMessage += 'Please try again or type your message.';
      }
      
      Alert.alert('Recording Failed', errorMessage);
    }
  };

  const stopVoiceRecording = async () => {
    if (!recordingRef.current || !isRecordingRef.current) return;

    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }

    stopRecordingTimer();
    setRecordingState('processing');
    isRecordingRef.current = false;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      
      if (!uri) throw new Error('No URI for recording file');
      
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists) throw new Error('Recording file not found');
      
      if (info.size && info.size > MAX_FILE_SIZE) {
        throw new Error('File too large. Maximum 25MB.');
      }

      const base64Audio = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (!base64Audio || base64Audio.length === 0) {
        throw new Error('Empty audio file');
      }

      await transcribeAudio(base64Audio);

    } catch (error: any) {
      console.error('Recording processing error:', error);
      
      Alert.alert(
        'Processing Failed',
        error.message || 'Failed to process recording.',
        [
          { 
            text: 'Try Again', 
            onPress: () => {
              setRecordingState('idle');
              setTimeout(startVoiceRecording, 300);
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

  const toggleRecording = useCallback(() => {
    if (recordingState === 'idle') {
      startVoiceRecording();
    } else if (recordingState === 'recording') {
      stopVoiceRecording();
    }
  }, [recordingState]);

  // -------- TRANSCRIPTION --------

  const transcribeAudio = async (base64Audio: string, retryCount = 0) => {
    const MAX_RETRIES = 2;
    
    try {
      if (!base64Audio || base64Audio.length < 100) {
        throw new Error('Audio too short. Please speak clearly.');
      }

      const estimatedSize = (base64Audio.length * 3) / 4;
      if (estimatedSize > MAX_FILE_SIZE) {
        throw new Error('Audio file too large.');
      }

      const { data, error } = await supabase.functions.invoke('transcribe-audio', {
        body: {
          audio: base64Audio,
          userId: user?.id,
          conversationId: currentConversation?.id,
          metadata: {
            platform: Platform.OS,
            timestamp: new Date().toISOString()
          }
        },
        headers: { 'x-timeout': '30000' }
      });

      if (error) {
        const violationPatterns = ['content violation', 'scam', 'fraud', 'suspended', 'banned'];
        const isViolation = violationPatterns.some(p => 
          error.message?.toLowerCase().includes(p)
        );

        if (isViolation) {
          Alert.alert(
            'Account Suspended',
            'Your account has been suspended due to a policy violation.',
            [{ text: 'OK' }]
          );
          return;
        }

        const networkErrors = ['timeout', 'network', 'connection', 'offline'];
        const isNetworkError = networkErrors.some(p => 
          error.message?.toLowerCase().includes(p)
        );

        if (isNetworkError && retryCount < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, Math.pow(2, retryCount) * 1000));
          return transcribeAudio(base64Audio, retryCount + 1);
        }

        throw new Error(error.message || 'Transcription error');
      }

      if (!data?.text?.trim()) {
        if (data?.warning) {
          Alert.alert(
            'No Speech Detected',
            data.warning + '\n\nTips:\n- Speak more clearly\n- Reduce background noise',
            [
              { text: 'Try Again', onPress: () => startVoiceRecording() },
              { text: 'Type Manually', style: 'cancel', onPress: () => setRecordingState('idle') }
            ]
          );
          return;
        }
        throw new Error('No transcription received');
      }

      setInputText(prev => prev + (prev ? ' ' : '') + data.text.trim());
      setRecordingState('idle');
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    } catch (error: any) {
      if (error.message?.includes('suspended')) return;
      
      Alert.alert(
        'Transcription Failed',
        error.message || 'Failed to transcribe voice.',
        [
          { text: 'Try Again', onPress: () => startVoiceRecording() },
          { text: 'Type Manually', style: 'cancel', onPress: () => setRecordingState('idle') }
        ]
      );
    }
  };

  // -------- MESSAGE HANDLING --------

  const handleSend = async () => {
    if ((!inputText.trim() && selectedMedia.length === 0) || sending) return;

    // Auto-convert large pastes (>4000 chars) to a txt file attachment
    let autoTxtFile: MediaFile | null = null;
    let textToSend = inputText;
    if (inputText.length > 4000 && selectedMedia.length === 0) {
      try {
        const fileName = `paste_${Date.now()}.txt`;
        const fileUri = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(fileUri, inputText, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        autoTxtFile = {
          type: 'document',
          uri: fileUri,
          name: fileName,
          mimeType: 'text/plain',
          size: inputText.length,
        };
        textToSend = `[Attached file: ${fileName}]\n\n${inputText.slice(0, 200)}...`;
      } catch (e) {
        // fallback: just truncate
        textToSend = inputText.slice(0, 4000);
      }
    }
    if (!editingMessageId && !canSendMessage() && sessionBonusMessages <= 0) {
      if (!user) {
        showAlert(
          'Sign In Required',
          'Sign in to start chatting with AI.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign In', onPress: () => router.push('/login') },
          ]
        );
      } else {
        showAlert(
          'Credits Required',
          `You need credits to continue. You have ${coins} credits.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Buy Credits', onPress: () => router.push('/buy-coins') },
          ]
        );
      }
      return;
    }
    
    let conversationId = currentConversation?.id;
    if (!conversationId) {
      conversationId = await createConversation();
      if (!conversationId) {
        showAlert('Error', 'Failed to create conversation');
        return;
      }
    }

    setSending(true);
    setGenerating(true);
    
    const text = autoTxtFile ? textToSend : inputText;
    const media = autoTxtFile ? [autoTxtFile, ...selectedMedia] : [...selectedMedia];
    const editingId = editingMessageId;
    
    setInputText('');
    setSelectedMedia([]);
    setEditingMessageId(null);
    setThinkingMode('thinking');

    try {
      if (editingId) {
        await updateMessageAndRegenerate(editingId, text, currentAIModel);
        return;
      }

      let imageUrl: string | undefined;
      let base64Image: string | undefined;

      if (media.length > 0 && media[0].type === 'image') {
        if (media[0].base64) {
          base64Image = media[0].base64;
        } else if (media[0].uri) {
          try {
            base64Image = await FileSystem.readAsStringAsync(media[0].uri, {
              encoding: FileSystem.EncodingType.Base64,
            });
          } catch (e) {
            console.error('Failed to read image as base64:', e);
          }
        }
      }

      await sendMessage(text || (base64Image ? '[Image]' : ''), imageUrl, base64Image, false, currentAIModel);

      setShowCompletionStatus(true);
      setTimeout(() => setShowCompletionStatus(false), 2000);

      if (user && !isUnlimited && !isAdmin) {
        if (sessionBonusMessages > 0) {
          setSessionBonusMessages(prev => prev - 1);
        } else {
          await incrementMessageCount();
        }
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    } catch (error: any) {
      console.error('Send error:', error);
      showAlert('Error', error?.message || 'Failed to send message');
      setInputText(text);
      setSelectedMedia(media);
    } finally {
      setSending(false);
      setGenerating(false);
    }
  };

  const handleCancelGeneration = useCallback(() => {
    setGenerating(false);
    showAlert('Cancelled', 'AI response generation stopped');
  }, [showAlert]);

  const handleEditMessage = useCallback((messageId: string, content: string) => {
    setEditingMessageId(messageId);
    setInputText(content);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingMessageId(null);
    setInputText('');
  }, []);

  const handleMediaPicked = useCallback((media: MediaFile[]) => {
    if (media.length > 5) {
      showAlert('Limit', 'You can select a maximum of 5 files');
      return;
    }
    setSelectedMedia(media);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [showAlert]);

  const removeMedia = useCallback((index: number) => {
    setSelectedMedia(prev => prev.filter((_, i) => i !== index));
  }, []);

  // -------- AI MODEL HANDLING --------

  const handleAIModelSelect = useCallback(async (model: AIModelKey) => {
    setCurrentAIModel(model);
    await updateSetting('preferredAiModel', model);
    showAlert('Model Updated', `Now using ${SUPPORTED_AI_MODELS[model]}`);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [updateSetting, showAlert]);

  const handleSelectAIMode = useCallback((mode: AIMode) => {
    setCurrentAIMode(mode);
    
    const modelMap: Record<AIMode, AIModelKey> = {
      'instant': 'gemini',
      'deep-thinking': 'gemini-2.0-flash-exp',
      'agent': 'onspace-ai',
    };
    
    setCurrentAIModel(modelMap[mode]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  // -------- CHAT HANDLING --------

  const handleNewChat = useCallback(async () => {
    // Only create a new conversation if current one has messages
    if (messages.length > 0) {
      await createConversation();
    }
    setInputText('');
    setSelectedMedia([]);
    setEditingMessageId(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [createConversation, messages.length]);

  const handleDeleteConversation = useCallback(async () => {
    if (!currentConversation) return;
    
    Alert.alert(
      'Delete Conversation',
      'Are you sure you want to delete this conversation?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteConversation(currentConversation.id);
              await createConversation();
              showAlert('Success', 'Conversation deleted');
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error) {
              showAlert('Error', 'Failed to delete conversation');
            }
          }
        }
      ]
    );
  }, [currentConversation, deleteConversation, createConversation, showAlert]);

  const handleRenameConversation = useCallback(async (newTitle: string) => {
    if (!currentConversation) return;
    await updateConversationTitle(currentConversation.id, newTitle);
  }, [currentConversation, updateConversationTitle]);

  const handleShareConversation = useCallback(async () => {
    if (!currentConversation) return;
    
    try {
      const shareContent = messages.map(m => 
        `${m.role === 'user' ? 'You' : 'AI'}: ${m.content}`
      ).join('\n\n');
      
      await Share.share({
        message: shareContent,
        title: currentConversation.title || 'AI Conversation',
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  }, [currentConversation, messages]);

  const handleCopyMessage = useCallback(async (content: string) => {
    await Clipboard.setString(content);
    showAlert('Copied', 'Message copied to clipboard');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [showAlert]);

  // -------- RENDER FUNCTIONS --------

  const renderMessage = useCallback(({ item, index }: { item: Message; index: number }) => {
    const isStreaming = streamingMessageId === item.id;
    const mathData = item.role === 'assistant' ? detectMathExpression(item.content) : null;
    
    return (
      <View>
        <MessageItem
          message={item}
          onCancel={handleCancelGeneration}
          onEdit={handleEditMessage}
          onCopy={() => handleCopyMessage(item.content)}
          isGenerating={isStreaming}
          streaming={isStreaming}
          isOffline={isOffline}
          onChunkRendered={() => {
            flatListRef.current?.scrollToEnd({ animated: false });
          }}
        />
        {mathData && (
          <CalculatorCard
            expression={mathData.expression}
            result={mathData.result}
            onOpen={() => {
              setCalcExpression(mathData.expression);
              setCalcResult(mathData.result);
              setCalcVisible(true);
            }}
          />
        )}
      </View>
    );
  }, [streamingMessageId, handleCancelGeneration, handleEditMessage, handleCopyMessage, isOffline]);

  const renderMediaPreview = useCallback(() => {
    if (selectedMedia.length === 0) return null;
    
    return (
      <View style={styles.selectedMediaPreview}>
        {selectedMedia.map((media, index) => (
          <Animated.View 
            key={`${media.uri}-${index}`} 
            style={[
              styles.mediaPreviewItem,
              { transform: [{ scale: pulseAnim }] }
            ]}
          >
            {media.type === 'image' ? (
              <Image source={{ uri: media.uri }} style={styles.mediaImage} resizeMode="cover" />
            ) : (
              <View style={styles.documentPreview}>
                <Ionicons name="document-text" size={24} color={colors.textSecondary} />
                <Text style={styles.documentName} numberOfLines={1}>
                  {media.name || 'Document'}
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.removeMediaButton}
              onPress={() => removeMedia(index)}
            >
              <Ionicons name="close" size={12} color="#FFFFFF" />
            </TouchableOpacity>
          </Animated.View>
        ))}
      </View>
    );
  }, [selectedMedia, removeMedia, pulseAnim, colors]);

  // -------- STYLES --------

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: Platform.select({ ios: insets.top, android: StatusBar.currentHeight || 0, default: 0 }),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
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
      borderRadius: BorderRadius.sm,
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
      fontSize: 18,
    },
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
      paddingBottom: Platform.select({ 
        ios: insets.bottom + Spacing.md, 
        android: insets.bottom + Spacing.md, 
        default: Spacing.md 
      }),
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
      borderRadius: BorderRadius.full,
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
      lineHeight: 22,
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
      maxHeight: 80,
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
    documentPreview: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 4,
    },
    documentName: {
      ...Typography.caption,
      fontSize: 8,
      color: colors.textSecondary,
      marginTop: 2,
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
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
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
    offlineBanner: {
      backgroundColor: '#FF9500',
      padding: Spacing.xs,
      alignItems: 'center',
    },
    offlineText: {
      color: '#FFFFFF',
      ...Typography.caption,
      fontWeight: '600',
    },
    limitBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderTopWidth: 1,
      gap: Spacing.sm,
    },
    limitBannerButton: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.full,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      margin: Spacing.md,
      paddingHorizontal: Spacing.md,
      borderRadius: BorderRadius.lg,
      height: 40,
    },
    searchInput: {
      flex: 1,
      ...Typography.body,
      color: colors.text,
      marginLeft: Spacing.sm,
    },
    langChipsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      paddingHorizontal: Spacing.md,
      paddingVertical: 8,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    langChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
    },
    langChipText: {
      fontSize: 13,
      fontWeight: '600',
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
  }), [colors, insets]);

  // -------- COMPUTED VALUES --------

  const displayMessages = isSearchMode && searchQuery ? filteredMessages : messages;
  const showSendButton = inputText.trim().length > 0 || selectedMedia.length > 0;
  const isRecording = recordingState === 'recording';
  const isProcessing = recordingState === 'processing';
  const accentColor = settings.accentColor || colors.primary;

  // -------- RENDER --------

  return (
    <ErrorBoundary>
    <GestureHandlerRootView style={{ flex: 1 }}>
    <GestureDetector gesture={swipeGesture}>
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <StatusBar 
        barStyle={isDark ? 'light-content' : 'dark-content'} 
        backgroundColor={colors.background}
      />
      
      {/* Offline Banner */}
      {isOffline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>No connection — some features unavailable</Text>
        </View>
      )}

      {/* Daily Limit Banner */}
      {user && !isUnlimited && !isAdmin && !canSendMessage() && sessionBonusMessages <= 0 && (
        <View style={[
          styles.limitBanner,
          { backgroundColor: colors.surface, borderColor: colors.border, flexWrap: 'wrap' }
        ]}>
          <View style={{ flex: 1, minWidth: 160 }}>
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>
              Daily limit reached
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
              {timeUntilMidnight ? `Resets in ${timeUntilMidnight}` : 'Resets at midnight'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
            {!hasUsedNewChatBonus && (
              <TouchableOpacity
                style={[styles.limitBannerButton, { backgroundColor: colors.surfaceSecondary || '#2C2C2E', borderWidth: 1, borderColor: colors.border }]}
                onPress={async () => {
                  setHasUsedNewChatBonus(true);
                  setSessionBonusMessages(100);
                  await createConversation();
                  setInputText('');
                  setSelectedMedia([]);
                }}
              >
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>New Chat</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.limitBannerButton, { backgroundColor: accentColor }]}
              onPress={() => router.push('/subscription')}
            >
              <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 13 }}>Get Plus</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity 
            style={styles.headerButton} 
            onPress={() => setSideMenuVisible(true)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="menu" size={24} color={colors.text} />
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => setIsSearchMode(!isSearchMode)}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {isSearchMode ? 'Search...' : (currentConversation?.title || 'Haitian AI Chat')}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.headerRight}>
          {unreadCount > 0 && (
            <View style={[styles.modelButton, { backgroundColor: colors.primary }]}>
              <Text style={[styles.modelText, { color: '#FFF' }]}>{unreadCount}</Text>
            </View>
          )}
          
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setChatHistoryVisible(true)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="time-outline" size={22} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.newChatButton}
            onPress={handleNewChat}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="add-circle" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      {isSearchMode && (
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search messages..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          <TouchableOpacity onPress={() => {
            setIsSearchMode(false);
            setSearchQuery('');
          }}>
            <Ionicons name="close" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Messages List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ ...Typography.caption, color: colors.textSecondary, marginTop: Spacing.sm }}>
            Loading...
          </Text>
        </View>
      ) : displayMessages.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons 
            name="chatbubbles-outline" 
            size={64} 
            color={colors.textSecondary} 
            style={styles.emptyIcon} 
          />
          <Text style={styles.emptyTitle}>Start a Conversation</Text>
          <Text style={styles.emptyText}>
            Ask me anything! I can help with questions, writing, code, analysis, and much more.
          </Text>
          
          {/* Quick Actions */}
          <View style={{ flexDirection: 'row', marginTop: Spacing.lg, gap: Spacing.md, flexWrap: 'wrap', justifyContent: 'center' }}>
            {['Write a poem', 'Help with code', 'Solve a problem'].map((suggestion) => (
              <TouchableOpacity
                key={suggestion}
                onPress={() => setInputText(suggestion)}
                style={{
                  backgroundColor: colors.surface,
                  padding: Spacing.sm,
                  borderRadius: BorderRadius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ ...Typography.caption, color: colors.text }}>{suggestion}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={displayMessages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingVertical: Spacing.md }}
          ListFooterComponent={generating ? (
            <ThinkingIndicator 
              userMessage={messages.length > 0 ? messages[messages.length - 1].content : inputText}
              completed={showCompletionStatus}
              mode={thinkingMode}
            />
          ) : null}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          maxToRenderPerBatch={10}
          windowSize={10}
          removeClippedSubviews={Platform.OS === 'android'}
        />
      )}

      {/* Code language suggestion chips */}
      {codeLangChips && (
        <View style={styles.langChipsContainer}>
          {['python', 'javascript', 'typescript', 'html', 'css', 'bash', 'json'].map(lang => (
            <TouchableOpacity
              key={lang}
              style={[styles.langChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => {
                const newText = inputText.replace(/```\w*$/, '```' + lang + '\n');
                setInputText(newText);
                setCodeLangChips(false);
              }}
            >
              <Text style={[styles.langChipText, { color: colors.text }]}>{lang}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Media Preview */}
      {renderMediaPreview()}

      {/* Editing Indicator */}
      {editingMessageId && (
        <View style={styles.editingIndicator}>
          <Ionicons name="pencil" size={16} color={colors.primary} />
          <Text style={styles.editingText}>Editing message...</Text>
          <TouchableOpacity onPress={handleCancelEdit}>
            <Text style={{ ...Typography.caption, color: colors.primary, fontWeight: '600' }}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Input Area */}
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
              <Animated.View style={[
                styles.recordingDot, 
                styles.recordingDotActive,
                { transform: [{ scale: pulseAnim }] }
              ]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.recordingText}>Recording...</Text>
                <Text style={styles.recordingDuration}>
                  {formatDuration(recordingDuration)} / 1:00
                </Text>
              </View>
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
              ref={inputRef}
              style={styles.input}
              placeholder={editingMessageId ? "Edit message..." : "Message..."}
              placeholderTextColor={colors.textSecondary}
              value={inputText}
              onChangeText={(txt) => {
                setInputText(txt);
                setCodeLangChips(/```\w*$/.test(txt));
              }}              multiline
              maxLength={4000}
              editable={!sending && !isRecording && !isProcessing}
              returnKeyType="default"
              blurOnSubmit={false}
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
            style={[styles.sendButton, { backgroundColor: accentColor }]} 
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

      {/* Modals */}
      <MenuModal 
        visible={menuVisible} 
        onClose={() => setMenuVisible(false)} 
      />
      
      <ToolsModal
        visible={toolsVisible}
        onClose={() => setToolsVisible(false)}
        onSelectTool={(tool) => setInputText(prev => `${prev}[${tool}] `)}
        onPickMedia={handleMediaPicked}
        onSelectAIModel={(model) => handleAIModelSelect(model as AIModelKey)}
        onOpenCamera={() => router.push('/camera')}
        currentModel={currentAIModel}
      />
      
      <ConversationMenuModal
        visible={conversationMenuVisible}
        onClose={() => setConversationMenuVisible(false)}
        onShare={handleShareConversation}
        onRename={handleRenameConversation}
        onReport={() => router.push('/bugreport')}
        onArchive={() => archiveConversation(currentConversation?.id || '')}
        onDelete={handleDeleteConversation}
        conversationTitle={currentConversation?.title}
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
        userCoins={coins}
        isUnlimited={isUnlimited}
        isAdmin={isAdmin}
      />

      <ChatHistoryModal
        visible={chatHistoryVisible}
        onClose={() => setChatHistoryVisible(false)}
        onSelectChat={(chatId) => {
          setChatHistoryVisible(false);
        }}
        onNewChat={() => {
          handleNewChat();
          setChatHistoryVisible(false);
        }}
        currentChatId={currentConversation?.id}
        conversations={conversations}
      />

      {/* Calculator Modal */}
      <CalculatorModal
        visible={calcVisible}
        onClose={() => setCalcVisible(false)}
        initialExpression={calcExpression}
        initialResult={calcResult}
      />

      {/* Security Blur Overlay */}
      {showBlurOverlay && (
        <Animated.View style={[
          styles.blurOverlayContainer,
          { opacity: fadeAnim }
        ]}>
          <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={styles.blurView}>
            <View style={styles.blurContent}>
              <Ionicons name="lock-closed" size={40} color="rgba(255,255,255,0.8)" />
              <Text style={styles.blurText}>Haitian AI Chat</Text>
              <Text style={styles.blurSubtext}>App locked for privacy</Text>
              
              <TouchableOpacity
                style={{
                  marginTop: Spacing.lg,
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  paddingHorizontal: Spacing.lg,
                  paddingVertical: Spacing.md,
                  borderRadius: BorderRadius.lg,
                }}
                onPress={() => {
                  setShowBlurOverlay(false);
                  setIsAppActive(true);
                }}
              >
                <Text style={{ color: 'white', fontWeight: '600' }}>Unlock</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </Animated.View>
      )}
    </KeyboardAvoidingView>
    </GestureDetector>
    </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

// ── Error Boundary ──
class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('HomeScreen error boundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>⚠️</Text>
          <Text style={{ color: '#FFF', fontSize: 22, fontWeight: '700', marginBottom: 8 }}>Something went wrong</Text>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, textAlign: 'center', marginBottom: 32 }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: '#10A37F', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 }}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '600' }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}
hello ai dont skip:In app/home.tsx, audit the onChangeText handler and codeLangChips detection logic (/```\w*$/.test(txt)) to ensure no exceptions can be thrown during text input — add try/catch and null guards around all regex operations.In app/login-password.tsx, ensure that when the user arrives from login.tsx with an email param via useLocalSearchParams, the email field is automatically pre-filled and focused on the password input so the user is not asked for their email again.
