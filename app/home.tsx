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
import { CalculatorModal, CalculatorCard, detectMathExpression } from '../components/CalculatorModal';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

// ==========================================
// TIP DEFINISYON YO
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

interface TranscriptionResult {
  text: string;
  confidence: number;
  detectedLanguage?: string;
  warning?: string;
}

// ==========================================
// KONSTANT YO
// ==========================================

const MAX_RECORDING_DURATION = 60; // segonn
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const SHAKE_THRESHOLD = 3.0;
const SHAKE_COOLDOWN = 1000; // ms
const AUTO_LOCK_DELAY = 30000; // 30 segonn pou sekirite
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
// KÒD PRENSIPAL LA
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
  
  const runOnJS_setSideMenu = useCallback((val: boolean) => setSideMenuVisible(val), []);

  // Swipe gesture to open side menu
  const swipeGesture = Gesture.Pan()
    .activeOffsetX([10, 10000])
    .onEnd((e) => {
      if (e.translationX > 60 && e.velocityX > 100 && !sideMenuVisible) {
        runOnJS(runOnJS_setSideMenu)(true);
      }
    });

  // Animasyon state
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

  // -------- EFFÈ YO --------

  // Initialize audio permissions
  useEffect(() => {
    checkAudioPermissions();
    setupNetworkListener();
    
    return () => {
      cleanupAll();
    };
  }, []);

  // Cleanup tout resous yo
  const cleanupAll = useCallback(() => {
    if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (autoLockTimerRef.current) clearTimeout(autoLockTimerRef.current);
    cleanupRecording();
  }, []);

  // App state handling (background/foreground) + Auto-lock sekirite
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextAppState;

      if (nextAppState === 'background' || nextAppState === 'inactive') {
        setIsAppActive(false);
        setShowBlurOverlay(true);
        
        // Kòmanse auto-lock timer
        autoLockTimerRef.current = setTimeout(() => {
          // Logout or secure app after 30 seconds in background
          console.log('🔒 Auto-locked for security');
        }, AUTO_LOCK_DELAY);
        
      } else if (nextAppState === 'active') {
        setIsAppActive(true);
        
        // Clear auto-lock timer
        if (autoLockTimerRef.current) {
          clearTimeout(autoLockTimerRef.current);
          autoLockTimerRef.current = null;
        }
        
        // Retire blur apre yon ti delè
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => setShowBlurOverlay(false));
        
        // Refresh data
        if (currentConversation?.id) {
          selectConversation(currentConversation.id);
        }
      }
    });

    return () => subscription.remove();
  }, [currentConversation?.id, fetchMessages, fadeAnim]);

  // Focus effect pou navigation
  useFocusEffect(
    useCallback(() => {
      setIsAppActive(true);
      setShowBlurOverlay(false);
      fadeAnim.setValue(1);
      
      // Animasyon antre
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
        // Cleanup lè soti
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

  // Shake detection pou bug report
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

  // -------- FONKSYON ÒTIL --------

  const setupNetworkListener = () => {
    // Network status monitoring
    const unsubscribe = () => {
      // Cleanup network listener
    };
    return unsubscribe;
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

  // -------- REKÒDING VWA --------

  const startRecordingTimer = useCallback(() => {
    setRecordingDuration(0);
    recordingTimerRef.current = setInterval(() => {
      setRecordingDuration(prev => {
        if (prev >= MAX_RECORDING_DURATION - 1) {
          // Auto-stop lè rive limit
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
    console.log('🧹 Cleaning up recording...');
    
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
        console.log('⚠️ Recording cleanup error:', e);
      }
      recordingRef.current = null;
    }
    
    isRecordingRef.current = false;
    setRecordingState('idle');
    setRecordingDuration(0);
  }, [stopRecordingTimer]);

  const startVoiceRecording = async () => {
    if (!audioPermissionRef.current) {
      const { status } = await Audio.requestPermissionsAsync();
      audioPermissionRef.current = status === 'granted';
      
      if (status !== 'granted') {
        Alert.alert(
          'Mikwofòn Bezwen',
          'Tanpri aktive aksè mikwofòn nan Paramèt pou itilize rekòd vwa.',
          [
            { text: 'Anile', style: 'cancel' },
            { 
              text: 'Louvri Paramèt', 
              onPress: () => Platform.OS === 'ios' 
                ? Linking.openURL('app-settings:') 
                : Linking.openSettings()
            }
          ]
        );
        return;
      }
    }

    try {
      await cleanupRecording();

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

      // Auto-stop apre 60 segonn
      stopTimeoutRef.current = setTimeout(() => {
        if (isRecordingRef.current) {
          stopVoiceRecording();
        }
      }, MAX_RECORDING_DURATION * 1000);

    } catch (error: any) {
      console.error('Failed to start recording:', error);
      await cleanupRecording();
      
      let errorMessage = 'Pa ka kòmanse rekòd. ';
      
      if (error.message?.includes('E_AUDIO_NODATA')) {
        errorMessage += 'Pa gen done odyo. Tcheke mikwofòn ou.';
      } else if (error.message?.includes('E_AUDIO_PERMISSIONS')) {
        errorMessage += 'Pa gen pèmisyon mikwofòn.';
      } else if (error.message?.includes('E_AUDIO_BUSY')) {
        errorMessage += 'Yon lòt aplikasyon ap itilize mikwofòn nan.';
      } else {
        errorMessage += 'Eseye ankò oswa tape mesaj ou.';
      }
      
      Alert.alert('Rekòd Echwe', errorMessage);
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
      
      if (!uri) throw new Error('Pa gen URI pou fichye a');
      
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists) throw new Error('Fichye rekòd la pa jwenn');
      
      if (info.size && info.size > MAX_FILE_SIZE) {
        throw new Error('Fichye twò gwo. Maksimòm 25MB.');
      }

      const base64Audio = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (!base64Audio || base64Audio.length === 0) {
        throw new Error('Fichye vid');
      }

      await transcribeAudio(base64Audio);

    } catch (error: any) {
      console.error('Recording processing error:', error);
      
      Alert.alert(
        'Pwosesing Echwe',
        error.message || 'Echec pou trete rekòd la.',
        [
          { 
            text: 'Eseye Ankò', 
            onPress: () => {
              setRecordingState('idle');
              setTimeout(startVoiceRecording, 300);
            }
          },
          { 
            text: 'Tape Manyèlman', 
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

  // -------- TRANSCRIPSYON --------

  const transcribeAudio = async (base64Audio: string, retryCount = 0) => {
    const MAX_RETRIES = 2;
    
    try {
      if (!base64Audio || base64Audio.length < 100) {
        throw new Error('Done odyo twò kout. Pale pi byen.');
      }

      const estimatedSize = (base64Audio.length * 3) / 4;
      if (estimatedSize > MAX_FILE_SIZE) {
        throw new Error('Fichye odyo twò gwo.');
      }

      const { data, error } = await supabase.functions.invoke('transcribe-audio', {
        body: {
          audio: base64Audio,
          userId: user?.id,
          conversationId: currentConversation?.id,
          metadata: {
            platform: Platform.OS,
            appVersion: settings.appVersion || '1.0.0',
            timestamp: new Date().toISOString()
          }
        },
        headers: { 'x-timeout': '30000' }
      });

      if (error) {
        // Gestion violasyon kontni
        const violationPatterns = ['content violation', 'scam', 'fraud', 'suspended', 'banned'];
        const isViolation = violationPatterns.some(p => 
          error.message?.toLowerCase().includes(p)
        );

        if (isViolation) {
          Alert.alert(
            '🚫 Kont Sispann',
            'Kont ou sispann akòz violasyon règleman.',
            [{ text: 'OK', onPress: () => router.push('/suspended') }]
          );
          return;
        }

        // Retry pou erè rezo
        const networkErrors = ['timeout', 'network', 'connection', 'offline'];
        const isNetworkError = networkErrors.some(p => 
          error.message?.toLowerCase().includes(p)
        );

        if (isNetworkError && retryCount < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, Math.pow(2, retryCount) * 1000));
          return transcribeAudio(base64Audio, retryCount + 1);
        }

        throw new Error(error.message || 'Erè transkripsyon');
      }

      if (!data?.text?.trim()) {
        if (data?.warning) {
          Alert.alert(
            'Pa Gen Diskou Detekte',
            data.warning + '\n\nKonsèy:\n• Pale pi byen\n• Redwi bri nan background',
            [
              { text: 'Eseye Ankò', onPress: () => startVoiceRecording() },
              { text: 'Manyèl', style: 'cancel', onPress: () => setRecordingState('idle') }
            ]
          );
          return;
        }
        throw new Error('Pa gen transkripsyon resevwa');
      }

      // Siksè
      setInputText(prev => prev + (prev ? ' ' : '') + data.text.trim());
      setRecordingState('idle');
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Feedback selon konfyans
      const confidence = data.confidence || 0;
      if (confidence > 0.8) {
        showAlert('✅ Transkripsyon Bon', 'Konfyans wo!');
      } else if (confidence < 0.5) {
        showAlert('⚠️ Konfyans Ba', 'Tcheke transkripsyon an.');
      }

    } catch (error: any) {
      if (error.message?.includes('suspended')) return;
      
      Alert.alert(
        'Transkripsyon Echwe',
        error.message || 'Echec pou transkri vwa ou.',
        [
          { text: 'Eseye Ankò', onPress: () => startVoiceRecording() },
          { text: 'Manyèl', style: 'cancel', onPress: () => setRecordingState('idle') }
        ]
      );
    }
  };

  // -------- JESYON MESAJ --------

  const handleSend = async () => {
    if ((!inputText.trim() && selectedMedia.length === 0) || sending) return;

    // Verifye limit
    if (!editingMessageId && !canSendMessage()) {
      if (!user) {
        showAlert(
          'Koneksyon Bezwen',
          'Konekte pou kòmanse chat ak AI.',
          [
            { text: 'Anile', style: 'cancel' },
            { text: 'Konekte', onPress: () => router.push('/login') },
          ]
        );
      } else {
        showAlert(
          'Kob Bezwen',
          `Ou bezwen kob pou kontinye. Ou gen ${coins} kob.`,
          [
            { text: 'Anile', style: 'cancel' },
            { text: 'Achte Kob', onPress: () => router.push('/buy-coins') },
          ]
        );
      }
      return;
    }
    
    // Kreye konvèsasyon si pa genyen
    let conversationId = currentConversation?.id;
    if (!conversationId) {
      conversationId = await createConversation();
      if (!conversationId) {
        showAlert('Erè', 'Echec pou kreye konvèsasyon');
        return;
      }
    }

    setSending(true);
    setGenerating(true);
    
    const text = inputText;
    const media = [...selectedMedia];
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

      // Upload imaj si genyen
      let imageUrl: string | undefined;
      if (media.length > 0 && media[0].type === 'image' && media[0].base64) {
        const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
        const filePath = `${conversationId}/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('chat-images')
          .upload(filePath, decode(media[0].base64), {
            contentType: 'image/jpeg',
            cacheControl: '3600',
          });

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('chat-images')
            .getPublicUrl(filePath);
          imageUrl = urlData.publicUrl;
        }
      }

      await sendMessage(text || '[Imaj]', imageUrl, currentAIModel);

      setShowCompletionStatus(true);
      setTimeout(() => setShowCompletionStatus(false), 2000);

      // Dediksyon kob
      if (user && !isUnlimited && !isAdmin) {
        await incrementMessageCount();
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    } catch (error: any) {
      console.error('❌ Send error:', error);
      showAlert('Erè', error?.message || 'Echec pou voye mesaj');
      
      // Restore input si echec
      setInputText(text);
      setSelectedMedia(media);
    } finally {
      setSending(false);
      setGenerating(false);
    }
  };

  const handleCancelGeneration = useCallback(() => {
    setGenerating(false);
    showAlert('Anile', 'Jenerasyon repons AI sispann');
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
      showAlert('Limit', 'Ou ka chwazi maksimòm 5 fichye');
      return;
    }
    setSelectedMedia(media);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [showAlert]);

  const removeMedia = useCallback((index: number) => {
    setSelectedMedia(prev => prev.filter((_, i) => i !== index));
  }, []);

  // -------- GESYON MODÈL AI --------

  const handleAIModelSelect = useCallback(async (model: AIModelKey) => {
    setCurrentAIModel(model);
    await updateSetting('preferredAiModel', model);
    showAlert('Modèl Mizajou', `Kounye a ap itilize ${SUPPORTED_AI_MODELS[model]}`);
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

  // -------- GESYON CHAT --------

  const handleNewChat = useCallback(async () => {
    await createConversation();
    setInputText('');
    setSelectedMedia([]);
    setEditingMessageId(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [createConversation]);

  const handleDeleteConversation = useCallback(async () => {
    if (!currentConversation) return;
    
    Alert.alert(
      'Efase Konvèsasyon',
      'Èske ou sèten ou vle efase konvèsasyon sa a?',
      [
        { text: 'Anile', style: 'cancel' },
        { 
          text: 'Efase', 
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteConversation(currentConversation.id);
              await createConversation();
              showAlert('Siksè', 'Konvèsasyon efase');
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error) {
              showAlert('Erè', 'Echec pou efase konvèsasyon');
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
        `${m.role === 'user' ? 'Ou' : 'AI'}: ${m.content}`
      ).join('\n\n');
      
      await Share.share({
        message: shareContent,
        title: currentConversation.title || 'Konvèsasyon AI',
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  }, [currentConversation, messages]);

  const handleCopyMessage = useCallback(async (content: string) => {
    await Clipboard.setString(content);
    showAlert('Kopye', 'Mesaj kopye nan clipboard');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [showAlert]);

  // -------- RÈNDRIJ KOMPOZAN --------

  const renderMessage = useCallback(({ item, index }: { item: Message; index: number }) => {
    const isStreaming = streamingMessageId === item.id;
    // Detect math in assistant messages
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
                  {media.name || 'Dokiman'}
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

  // -------- STIL YO (useMemo pou optimizasyon) --------

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
  }), [colors, insets]);

  // -------- KALKIL YO --------

  const displayMessages = isSearchMode && searchQuery ? filteredMessages : messages;
  const showSendButton = inputText.trim().length > 0 || selectedMedia.length > 0;
  const isRecording = recordingState === 'recording';
  const isProcessing = recordingState === 'processing';
  const modelDisplayName = SUPPORTED_AI_MODELS[currentAIModel] || 'AI';
  const accentColor = settings.accentColor || colors.primary;

  // -------- RETOU KOMPOZAN --------

  return (
    <ErrorBoundary>
    <GestureHandlerRootView style={{ flex: 1 }}>
    <GestureDetector gesture={swipeGesture}>
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <StatusBar 
        barStyle={isDark ? 'light-content' : 'dark-content'} 
        backgroundColor={colors.background}
      />
      
      {/* Offline Banner */}
      {isOffline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>⚠️ Offline - Kèk fonksyonalite pa disponib</Text>
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
              {isSearchMode ? 'Rechèch...' : (currentConversation?.title || 'Haitian AI Chat')}
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
            placeholder="Rechèch nan mesaj yo..."
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
            Chajman...
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
          <Text style={styles.emptyTitle}>Kòmanse yon Konvèsasyon</Text>
          <Text style={styles.emptyText}>
            Mande m anyen! Mwen ka ede ak kesyon, kreyasyon, kòd, analiz, ak plis ankò.
          </Text>
          
          {/* Quick Actions */}
          <View style={{ flexDirection: 'row', marginTop: Spacing.lg, gap: Spacing.md }}>
            {['Ekri yon pwezi', 'Ede m ak kòd', 'Rezoud yon pwoblèm'].map((suggestion) => (
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

      {/* Media Preview */}
      {renderMediaPreview()}

      {/* Editing Indicator */}
      {editingMessageId && (
        <View style={styles.editingIndicator}>
          <Ionicons name="pencil" size={16} color={colors.primary} />
          <Text style={styles.editingText}>Ap modifye mesaj...</Text>
          <TouchableOpacity onPress={handleCancelEdit}>
            <Text style={{ ...Typography.caption, color: colors.primary, fontWeight: '600' }}>
              Anile
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
                <Text style={styles.recordingText}>Ap rekòde... (souke pou anile)</Text>
                <Text style={styles.recordingDuration}>
                  {formatDuration(recordingDuration)} / 1:00
                </Text>
              </View>
            </View>
          ) : isProcessing ? (
            <View style={styles.recordingIndicator}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={{ ...Typography.body, color: colors.text, marginLeft: Spacing.sm }}>
                Transkripsyon an kou...
              </Text>
            </View>
          ) : (
            <TextInput
              style={styles.input}
              placeholder={editingMessageId ? "Modifye mesaj..." : "Mesaj..."}
              placeholderTextColor={colors.textSecondary}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={4000}
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
          // Load chat
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

      {/* Blur Overlay pou Sekirite */}
      {showBlurOverlay && (
        <Animated.View style={[
          styles.blurOverlayContainer,
          { opacity: fadeAnim }
        ]}>
          <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={styles.blurView}>
            <View style={styles.blurContent}>
              <Ionicons name="lock-closed" size={40} color="rgba(255,255,255,0.8)" />
              <Text style={styles.blurText}>Haitian AI Chat</Text>
              <Text style={styles.blurSubtext}>Aplikasyon fèmen pou vi prive</Text>
              
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
                <Text style={{ color: 'white', fontWeight: '600' }}>Devwouye</Text>
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

remove all croele tex add english only code and When the home screen mounts and the user is authenticated but no conversation is selected, automatically call `createConversation()` so users always land on a fresh ready-to-use chat instead of an empty state that requires manual action. Remove the broken `fetchMessages` reference in home.tsx useEffect (line that calls `fetchMessages` in the AppState change handler) and replace it with `selectConversation(currentConversation?.id)` which is the correct function from the ConversationContext, to prevent potential white screen issues on app load. Please avoid pasting text directly into source files via GitHub commits. If you want to request changes, use the chat here instead. I can apply all code changes safely without risking syntax errors in your files. Update supabase/functions/chat/index.ts to remove any unnecessary configuration request headers or extra setup calls, simplify the function to cleanly accept messages array and return AI responses without leaking model names or fallback indicators in the response text. Investigate the white screen on app load: check the fetchMessages reference error in home.tsx useEffect (it references a function that doesn't exist), verify all context providers initialize before rendering, and add a safe loading state so the home screen doesn't render blank while auth/conversation contexts are still loading.
