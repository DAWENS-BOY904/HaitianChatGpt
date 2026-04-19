import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
  StyleSheet,
  Platform,
  StatusBar,
  Dimensions,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  TextInput,
  Animated,
  Easing,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { useConversation } from '../hooks/useConversation';
import { useSettings } from '../hooks/useSettings';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type CallPhase = 'connecting' | 'active' | 'paused' | 'ended';

interface ConvMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  /** animated words for assistant messages */
  displayedWords?: number;
}

// ─── Format timestamp ───
function formatTime(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = ((h % 12) || 12).toString();
  return `${h12}:${m} ${ampm}`;
}

// ─── Animated dots ───
function ConnectingDots() {
  const anims = useRef([
    new Animated.Value(0.3),
    new Animated.Value(0.3),
    new Animated.Value(0.3),
    new Animated.Value(0.3),
    new Animated.Value(0.3),
    new Animated.Value(0.3),
    new Animated.Value(0.3),
  ]).current;

  useEffect(() => {
    const animations = anims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 120),
          Animated.timing(anim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        ])
      )
    );
    animations.forEach(a => a.start());
    return () => animations.forEach(a => a.stop());
  }, []);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {anims.map((anim, i) => (
        <Animated.View
          key={i}
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: '#FFFFFF',
            opacity: anim,
          }}
        />
      ))}
    </View>
  );
}

// ─── Typing indicator (three bouncing dots) ───
function TypingIndicator() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const bounce = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: -6, duration: 250, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 250, useNativeDriver: true }),
          Animated.delay(500),
        ])
      );
    const a1 = bounce(dot1, 0);
    const a2 = bounce(dot2, 150);
    const a3 = bounce(dot3, 300);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, []);

  return (
    <View style={typStyles.wrap}>
      {[dot1, dot2, dot3].map((dot, i) => (
        <Animated.View
          key={i}
          style={[typStyles.dot, { transform: [{ translateY: dot }] }]}
        />
      ))}
    </View>
  );
}

const typStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
});

// ─── Word-by-word animated AI text bubble ───
function AnimatedAIBubble({ content, timestamp }: { content: string; timestamp: number }) {
  const words = content.split(' ');
  const [visibleCount, setVisibleCount] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setVisibleCount(0);
    let count = 0;
    intervalRef.current = setInterval(() => {
      count += 1;
      setVisibleCount(count);
      if (count >= words.length) {
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    }, 40); // ~40ms per word → natural reading speed
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [content]);

  const displayed = words.slice(0, visibleCount).join(' ');

  return (
    <View style={{ alignSelf: 'flex-start', marginBottom: 10, maxWidth: '82%' }}>
      <View style={bubStyles.aiBubble}>
        <Text style={bubStyles.aiText}>{displayed}</Text>
      </View>
      <Text style={bubStyles.timestamp}>{formatTime(timestamp)}</Text>
    </View>
  );
}

// ─── Static user bubble ───
function UserBubble({ content, timestamp }: { content: string; timestamp: number }) {
  return (
    <View style={{ alignSelf: 'flex-end', marginBottom: 10, maxWidth: '82%', alignItems: 'flex-end' }}>
      <View style={bubStyles.userBubble}>
        <Text style={bubStyles.userText}>{content}</Text>
      </View>
      <Text style={[bubStyles.timestamp, { textAlign: 'right' }]}>{formatTime(timestamp)}</Text>
    </View>
  );
}

const bubStyles = StyleSheet.create({
  aiBubble: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    padding: 14,
  },
  aiText: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
  },
  userBubble: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 18,
    borderBottomRightRadius: 4,
    padding: 14,
  },
  userText: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
  },
  timestamp: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    marginTop: 4,
    marginHorizontal: 4,
    fontWeight: '400',
  },
});

// ─── Glowing orb ───
function GlowingOrb({ isAISpeaking, isUserSpeaking }: { isAISpeaking: boolean; isUserSpeaking: boolean }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.5)).current;
  const innerScaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isAISpeaking) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, { toValue: 1.15, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(scaleAnim, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(opacityAnim, { toValue: 0.85, duration: 600, useNativeDriver: true }),
          Animated.timing(opacityAnim, { toValue: 0.45, duration: 600, useNativeDriver: true }),
        ])
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(innerScaleAnim, { toValue: 1.08, duration: 400, useNativeDriver: true }),
          Animated.timing(innerScaleAnim, { toValue: 0.95, duration: 400, useNativeDriver: true }),
        ])
      ).start();
    } else if (isUserSpeaking) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, { toValue: 1.1, duration: 300, useNativeDriver: true }),
          Animated.timing(scaleAnim, { toValue: 0.95, duration: 300, useNativeDriver: true }),
        ])
      ).start();
      opacityAnim.setValue(0.6);
    } else {
      scaleAnim.stopAnimation(() => scaleAnim.setValue(1));
      opacityAnim.stopAnimation(() => opacityAnim.setValue(0.35));
      innerScaleAnim.stopAnimation(() => innerScaleAnim.setValue(1));
    }
  }, [isAISpeaking, isUserSpeaking]);

  const orbColor = isAISpeaking ? '#1a3a6e' : '#0f1f3d';
  const glowColor = isAISpeaking ? '#2563eb' : '#1d4ed8';

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}>
      <Animated.View
        style={{
          width: 280,
          height: 280,
          borderRadius: 140,
          backgroundColor: orbColor,
          opacity: opacityAnim,
          transform: [{ scale: scaleAnim }],
          shadowColor: glowColor,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.8,
          shadowRadius: 60,
          elevation: 20,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Animated.View
          style={{
            width: 180,
            height: 180,
            borderRadius: 90,
            backgroundColor: glowColor,
            opacity: 0.3,
            transform: [{ scale: innerScaleAnim }],
          }}
        />
      </Animated.View>
    </View>
  );
}

// ─── Call ended banner ───
function CallEndedBanner({ duration, onDismiss, onFeedback }: {
  duration: number;
  onDismiss: () => void;
  onFeedback: (type: 'up' | 'down') => void;
}) {
  const mins = Math.floor(duration / 60);
  const secs = duration % 60;
  const label = mins > 0 ? `${mins}m ${secs}s` : `${secs} seconds`;
  const progress = Math.min(duration / 300, 1);

  return (
    <View style={bannerStyles.container}>
      <BlurView intensity={70} tint="dark" style={bannerStyles.blur}>
        <View style={bannerStyles.row}>
          <Ionicons name="call" size={18} color="rgba(255,255,255,0.7)" />
          <Text style={bannerStyles.label}>Call ended {label}</Text>
          <TouchableOpacity onPress={() => onFeedback('up')} style={{ marginLeft: 'auto' }}>
            <Ionicons name="thumbs-up-outline" size={20} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onFeedback('down')} style={{ marginLeft: 12 }}>
            <Ionicons name="thumbs-down-outline" size={20} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDismiss} style={{ marginLeft: 12 }}>
            <Ionicons name="close" size={18} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>
        </View>
        <View style={bannerStyles.progressBg}>
          <View style={[bannerStyles.progressFill, { width: `${progress * 100}%` as any }]} />
        </View>
      </BlurView>
    </View>
  );
}

const bannerStyles = StyleSheet.create({
  container: { borderRadius: 18, overflow: 'hidden', marginHorizontal: 16, marginBottom: 8 },
  blur: { paddingHorizontal: 16, paddingVertical: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  label: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '500' },
  progressBg: { height: 3, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2 },
  progressFill: { height: 3, backgroundColor: '#10A37F', borderRadius: 2 },
});

// ─── Ring tone using Haptics + Animated beep pattern ───
// A real phone ringtone simulation: haptic pulses timed like an actual phone ring
async function simulatePhoneRing(onStop: () => boolean) {
  // Classic phone ring: 2 short rings then a pause
  for (let cycle = 0; cycle < 3; cycle++) {
    if (onStop()) return;
    // First ring burst
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await new Promise(r => setTimeout(r, 200));
    if (onStop()) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await new Promise(r => setTimeout(r, 500));
    if (onStop()) return;
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await new Promise(r => setTimeout(r, 200));
    if (onStop()) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    // Pause between ring cycles
    await new Promise(r => setTimeout(r, 1100));
  }
}

// ─── Speak using expo-speech fallback ───
function speakWithSpeechAPI(text: string, voice: string, rate: number, onDone: () => void) {
  try {
    // Map our voice names to language hints
    const langMap: Record<string, string> = {
      echo: 'en-GB',
      fable: 'en-GB',
      alloy: 'en-US',
      onyx: 'en-US',
      nova: 'en-US',
      shimmer: 'en-US',
      coral: 'en-US',
    };
    const language = langMap[voice] || 'en-US';
    
    Speech.speak(text, {
      language,
      rate: Math.min(rate * 0.9, 1.4),
      pitch: voice === 'onyx' ? 0.8 : voice === 'shimmer' ? 1.2 : 1.0,
      onDone,
      onError: () => onDone(),
    });
  } catch (_e) {
    onDone();
  }
}

export default function VoiceControlScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const { sendMessage, currentConversation, createConversation } = useConversation();
  const { settings } = useSettings();
  const supabase = getSupabaseClient();

  const [phase, setPhase] = useState<CallPhase>('connecting');
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isAITyping, setIsAITyping] = useState(false);
  const [textModeOn, setTextModeOn] = useState(true);
  const [showTextModeToast, setShowTextModeToast] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [messages, setMessages] = useState<ConvMessage[]>([]);
  const [currentAIText, setCurrentAIText] = useState('');
  const [statusLabel, setStatusLabel] = useState('');
  const [callDuration, setCallDuration] = useState(0);
  const [callConversationId, setCallConversationId] = useState<string | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const isRecordingRef = useRef(false);
  const isPausedRef = useRef(false);
  const isConnectingRef = useRef(true);
  const allowInterruptRef = useRef((settings as any).voice_interruption ?? false);

  const selectedVoice = (settings as any).voice_selection || 'alloy';
  const speechRate = parseFloat((settings as any).speech_rate?.toString() || '1.0');

  // ─── RING SOUND ───
  useEffect(() => {
    isConnectingRef.current = true;
    let stopped = false;
    const stopCheck = () => stopped;
    
    // Start haptic ring simulation
    simulatePhoneRing(stopCheck);
    
    const connectTimer = setTimeout(async () => {
      stopped = true;
      isConnectingRef.current = false;
      if (!isPausedRef.current) {
        setPhase('active');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        
        // Create conversation in background
        try {
          const convId = await createConversation();
          if (convId) setCallConversationId(convId);
        } catch (_e) {}
        
        // Start call timer
        callTimerRef.current = setInterval(() => {
          setCallDuration(d => d + 1);
        }, 1000);
        
        // AI greets first
        await greetUser();
      }
    }, 3500);
    
    return () => {
      stopped = true;
      clearTimeout(connectTimer);
    };
  }, []);

  // ─── GREET ───
  const greetUser = useCallback(async () => {
    const greetings = [
      "Hey! Good to hear your voice. How can I help you today?",
      "Hello! I am here and ready to assist you.",
      "Hi there! What is on your mind?",
    ];
    const text = greetings[Math.floor(Math.random() * greetings.length)];
    await speakText(text, true);
  }, []);

  // ─── TTS SPEAK (with device Speech fallback) ───
  const speakText = useCallback(async (text: string, isGreeting = false) => {
    if (isPausedRef.current && !isGreeting) return;
    try {
      if (soundRef.current) {
        try { await soundRef.current.stopAsync(); await soundRef.current.unloadAsync(); } catch {}
        soundRef.current = null;
      }
      // Stop any ongoing Speech synthesis
      try { Speech.stop(); } catch {}
      
      setIsAISpeaking(true);
      setCurrentAIText(text);
      setIsAITyping(false);

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      const { data, error } = await supabase.functions.invoke('generate-tts', {
        body: { text: text.slice(0, 500), voice: selectedVoice, speed: speechRate },
      });

      // Check for device TTS fallback signal
      if (data?.fallback === true || data?.code === 'USE_DEVICE_TTS') {
        console.log('[Voice] Using device Speech API fallback');
        speakWithSpeechAPI(text, selectedVoice, speechRate, () => {
          setIsAISpeaking(false);
          setCurrentAIText('');
          if (!isPausedRef.current) {
            setTimeout(() => startListening(), 400);
          }
        });
        return;
      }

      const audioUrl = data?.audioUrl || data?.audio_url;
      if (error || !audioUrl) {
        // Fall back to device speech
        console.log('[Voice] No audio URL, using device Speech API');
        speakWithSpeechAPI(text, selectedVoice, speechRate, () => {
          setIsAISpeaking(false);
          setCurrentAIText('');
          if (!isPausedRef.current) setTimeout(() => startListening(), 400);
        });
        return;
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true, volume: 1.0 }
      );
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsAISpeaking(false);
          setCurrentAIText('');
          sound.unloadAsync().catch(() => {});
          soundRef.current = null;
          if (!isPausedRef.current) {
            setTimeout(() => startListening(), 400);
          }
        }
      });
    } catch (e: any) {
      console.log('[Voice] speakText error:', e?.message);
      setIsAISpeaking(false);
      setCurrentAIText('');
      // Still try to listen even if TTS failed
      if (!isPausedRef.current) setTimeout(() => startListening(), 600);
    }
  }, [selectedVoice, speechRate, supabase]);

  // ─── START LISTENING ───
  const startListening = useCallback(async () => {
    if (isPausedRef.current || isConnectingRef.current) return;
    if (isRecordingRef.current) return;
    try {
      if (recordingRef.current) {
        try { await recordingRef.current.stopAndUnloadAsync(); } catch {}
        recordingRef.current = null;
      }

      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') return;

      await new Promise(r => setTimeout(r, 150));

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        staysActiveInBackground: false,
        interruptionModeIOS: 1,
        interruptionModeAndroid: 1,
      });

      if (Platform.OS === 'android') await new Promise(r => setTimeout(r, 100));

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
        web: { mimeType: 'audio/webm', bitsPerSecond: 64000 },
      });

      recordingRef.current = recording;
      isRecordingRef.current = true;
      setIsUserSpeaking(true);
      setStatusLabel('Listening...');
      setTimeout(() => { if (isRecordingRef.current) stopAndProcess(); }, 8000);
    } catch (e: any) {
      console.log('[Voice] startListening error:', e?.message);
      isRecordingRef.current = false;
      setIsUserSpeaking(false);
      recordingRef.current = null;
      if (!isPausedRef.current) {
        setTimeout(() => startListening(), 1000);
      }
    }
  }, []);

  // ─── STOP + PROCESS ───
  const stopAndProcess = useCallback(async () => {
    if (!recordingRef.current || !isRecordingRef.current) return;
    isRecordingRef.current = false;
    setIsUserSpeaking(false);
    setStatusLabel('Processing...');
    setIsAITyping(false);

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      if (!uri) { setStatusLabel(''); return; }

      const base64Audio = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const { data: txData, error: txError } = await supabase.functions.invoke('transcribe-audio', {
        body: { audio: base64Audio, userId: user?.id },
      });

      if (txError || !txData?.text?.trim()) {
        setStatusLabel('');
        if (!isPausedRef.current) setTimeout(() => startListening(), 500);
        return;
      }

      const userText = txData.text.trim();
      const userMsg: ConvMessage = { role: 'user', content: userText, timestamp: Date.now() };
      setMessages(prev => [...prev, userMsg]);
      setStatusLabel('');

      // Show typing indicator while AI processes
      setIsAITyping(true);

      const convId = callConversationId || currentConversation?.id;
      if (convId) {
        try { await sendMessage(userText, convId as any, undefined, false, 'gemini'); } catch {}
      }

      const contextMsgs = messages.slice(-6).map(m => ({ role: m.role, content: m.content }));
      const { data: aiData } = await supabase.functions.invoke('chat', {
        body: {
          messages: [...contextMsgs, { role: 'user', content: userText }],
          conversationId: convId || `voice-${Date.now()}`,
          model: 'gemini',
        },
      });

      setIsAITyping(false);

      const aiReply = aiData?.message || aiData?.content || "I heard you. Let me help with that.";
      const spokenText = aiReply
        .replace(/```[\s\S]*?```/g, 'Here is the code.')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/#{1,6}\s/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .trim()
        .slice(0, 400);

      const aiMsg: ConvMessage = { role: 'assistant', content: aiReply, timestamp: Date.now() };
      setMessages(prev => [...prev, aiMsg]);
      await speakText(spokenText);
    } catch (e) {
      setIsAITyping(false);
      setStatusLabel('');
      if (!isPausedRef.current) setTimeout(() => startListening(), 500);
    }
  }, [messages, callConversationId, currentConversation, supabase, user, sendMessage, speakText, startListening]);

  // ─── INTERRUPT ───
  const handleInterrupt = useCallback(async () => {
    if (!allowInterruptRef.current) return;
    if (soundRef.current) {
      try { await soundRef.current.stopAsync(); } catch {}
    }
    try { Speech.stop(); } catch {}
    setIsAISpeaking(false);
    setCurrentAIText('');
    if (!isPausedRef.current) startListening();
  }, [startListening]);

  // ─── PAUSE ───
  const handlePause = useCallback(async () => {
    const newPaused = !isPaused;
    setIsPaused(newPaused);
    isPausedRef.current = newPaused;
    if (newPaused) {
      if (isRecordingRef.current && recordingRef.current) {
        try { await recordingRef.current.stopAndUnloadAsync(); } catch {}
        recordingRef.current = null;
        isRecordingRef.current = false;
      }
      if (soundRef.current) {
        try { await soundRef.current.pauseAsync(); } catch {}
      }
      try { Speech.stop(); } catch {}
      setIsUserSpeaking(false);
      setIsAISpeaking(false);
      setIsAITyping(false);
      setStatusLabel('Paused');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      setStatusLabel('');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setTimeout(() => startListening(), 400);
    }
  }, [isPaused, startListening]);

  // ─── END CALL ───
  const handleEnd = useCallback(async () => {
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    isRecordingRef.current = false;
    isPausedRef.current = true;
    isConnectingRef.current = false;

    if (recordingRef.current) {
      try { await recordingRef.current.stopAndUnloadAsync(); } catch {}
      recordingRef.current = null;
    }
    if (soundRef.current) {
      try { await soundRef.current.stopAsync(); await soundRef.current.unloadAsync(); } catch {}
      soundRef.current = null;
    }
    try { Speech.stop(); } catch {}

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setPhase('ended');
    setTimeout(() => router.replace('/home'), 300);
  }, [router]);

  // ─── TEXT MODE TOGGLE ───
  const handleTextModeToggle = useCallback(() => {
    const newVal = !textModeOn;
    setTextModeOn(newVal);
    setShowTextModeToast(true);
    setTimeout(() => setShowTextModeToast(false), 1800);
  }, [textModeOn]);

  // ─── SEND TEXT ───
  const handleSendText = useCallback(async () => {
    const text = userInput.trim();
    if (!text) return;
    setUserInput('');
    const msg: ConvMessage = { role: 'user', content: text, timestamp: Date.now() };
    setMessages(prev => [...prev, msg]);

    if (isRecordingRef.current && recordingRef.current) {
      try { await recordingRef.current.stopAndUnloadAsync(); } catch {}
      recordingRef.current = null;
      isRecordingRef.current = false;
    }
    setIsUserSpeaking(false);
    setIsAITyping(true);

    const contextMsgs = messages.slice(-6).map(m => ({ role: m.role, content: m.content }));
    const { data: aiData } = await supabase.functions.invoke('chat', {
      body: {
        messages: [...contextMsgs, { role: 'user', content: text }],
        conversationId: callConversationId || `voice-${Date.now()}`,
        model: 'gemini',
      },
    });

    setIsAITyping(false);
    const aiReply = aiData?.message || aiData?.content || "I heard you. Let me help with that.";
    const aiMsg: ConvMessage = { role: 'assistant', content: aiReply, timestamp: Date.now() };
    setMessages(prev => [...prev, aiMsg]);
    await speakText(aiReply.slice(0, 400));
  }, [userInput, messages, callConversationId, supabase, speakText]);

  // Scroll to bottom on new messages or typing indicator
  useEffect(() => {
    if (messages.length > 0 || isAITyping) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
    }
  }, [messages, isAITyping]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
      soundRef.current?.unloadAsync().catch(() => {});
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
      try { Speech.stop(); } catch {}
    };
  }, []);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const bgColors: [string, string, string, string] =
    phase === 'connecting'
      ? ['#0d1b3e', '#0f2460', '#132f6b', '#0a1a3a']
      : ['#050505', '#0a0a0a', '#0d0d0d', '#050505'];

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={bgColors} style={StyleSheet.absoluteFill} />

      {/* HEADER */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={handleTextModeToggle} style={styles.headerBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons
            name={textModeOn ? 'document-text-outline' : 'document-text'}
            size={22}
            color={textModeOn ? 'rgba(255,255,255,0.55)' : '#FFFFFF'}
          />
        </TouchableOpacity>

        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Haitian AI</Text>
          {phase === 'active' && !isPaused ? (
            <Text style={styles.timerText}>{formatDuration(callDuration)}</Text>
          ) : phase === 'active' && isPaused ? (
            <Text style={styles.timerText}>Paused</Text>
          ) : null}
        </View>

        <TouchableOpacity onPress={() => router.push('/voice-settings')} style={styles.headerBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="options-outline" size={22} color="rgba(255,255,255,0.75)" />
        </TouchableOpacity>
      </View>

      {/* TEXT MODE TOAST */}
      {showTextModeToast ? (
        <View style={styles.toastWrap} pointerEvents="none">
          <BlurView intensity={60} tint="dark" style={styles.toast}>
            <Text style={styles.toastText}>{textModeOn ? 'Text mode is on' : 'Text mode is off'}</Text>
          </BlurView>
        </View>
      ) : null}

      {/* MAIN CONTENT */}
      {phase === 'connecting' ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 200 }}>
          <Text style={styles.connectingText}>Connecting...</Text>
          <View style={{ marginTop: 18 }}>
            <ConnectingDots />
          </View>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {textModeOn && (messages.length > 0 || isAITyping) ? (
            /* Text mode: conversation with timestamps, typing indicator, animated AI text */
            <ScrollView
              ref={scrollRef}
              style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16 }}
              showsVerticalScrollIndicator={false}
            >
              {messages.map((msg, i) =>
                msg.role === 'user' ? (
                  <UserBubble key={i} content={msg.content} timestamp={msg.timestamp} />
                ) : (
                  <AnimatedAIBubble key={i} content={msg.content} timestamp={msg.timestamp} />
                )
              )}

              {/* Typing indicator while AI is processing */}
              {isAITyping ? <TypingIndicator /> : null}

              <View style={{ height: 24 }} />
            </ScrollView>
          ) : (
            /* Voice visual mode: glowing orb */
            <View style={{ flex: 1, position: 'relative' }}>
              <GlowingOrb isAISpeaking={isAISpeaking} isUserSpeaking={isUserSpeaking} />
              {currentAIText ? (
                <View style={styles.spokenTextWrap} pointerEvents="none">
                  <Text style={styles.spokenText} numberOfLines={4}>{currentAIText}</Text>
                </View>
              ) : null}
            </View>
          )}

          {/* Status / interrupt label */}
          <View style={{ alignItems: 'center', paddingBottom: 10 }}>
            {isAISpeaking && allowInterruptRef.current ? (
              <TouchableOpacity onPress={handleInterrupt} style={styles.interruptBtn}>
                <Text style={styles.interruptText}>Tap to interrupt</Text>
              </TouchableOpacity>
            ) : statusLabel ? (
              <Text style={styles.statusText}>{statusLabel}</Text>
            ) : isUserSpeaking ? (
              <Text style={styles.statusText}>Listening...</Text>
            ) : isAISpeaking ? (
              <Text style={styles.statusText}>Speaking...</Text>
            ) : isAITyping ? (
              <Text style={styles.statusText}>Thinking...</Text>
            ) : null}
          </View>

          {/* Dots decoration */}
          <View style={{ alignItems: 'center', paddingBottom: 20 }}>
            <ConnectingDots />
          </View>
        </View>
      )}

      {/* CONTROLS */}
      <View style={[styles.controls, { paddingBottom: insets.bottom + 12 }]}>
        <View style={{ alignItems: 'center' }}>
          <TouchableOpacity style={styles.endBtn} onPress={handleEnd} activeOpacity={0.8}>
            <Ionicons name="call" size={28} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} />
          </TouchableOpacity>
          <Text style={styles.ctrlLabel}>End</Text>
        </View>

        <View style={{ alignItems: 'center' }}>
          <TouchableOpacity
            style={[styles.pauseBtn, isPaused && styles.pauseBtnActive]}
            onPress={handlePause}
            disabled={phase !== 'active'}
            activeOpacity={0.8}
          >
            {isPaused ? (
              <Ionicons name="play" size={26} color="#FFFFFF" />
            ) : (
              <View style={{ flexDirection: 'row', gap: 5 }}>
                <View style={{ width: 5, height: 26, backgroundColor: '#FFFFFF', borderRadius: 3 }} />
                <View style={{ width: 5, height: 26, backgroundColor: '#FFFFFF', borderRadius: 3 }} />
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.ctrlLabel}>{isPaused ? 'Resume' : 'Pause'}</Text>
        </View>
      </View>

      {/* Keyboard toggle */}
      <TouchableOpacity
        style={[styles.keyboardRow, { bottom: insets.bottom + 5 }]}
        onPress={() => setShowKeyboard(k => !k)}
      >
        <Ionicons name="keypad-outline" size={15} color="rgba(255,255,255,0.45)" />
        <Text style={styles.keyboardText}>Tap to show keyboard</Text>
      </TouchableOpacity>

      {/* Keyboard input sheet */}
      {showKeyboard ? (
        <BlurView intensity={80} tint="dark" style={[styles.inputBar, { paddingBottom: insets.bottom + 14 }]}>
          <TextInput
            style={styles.textInput}
            placeholder="Type to continue chatting with Haitian AI"
            placeholderTextColor="rgba(255,255,255,0.35)"
            value={userInput}
            onChangeText={setUserInput}
            onSubmitEditing={handleSendText}
            returnKeyType="send"
            autoFocus
          />
          <TouchableOpacity
            style={[styles.sendBtn, { opacity: userInput.trim() ? 1 : 0.4 }]}
            onPress={handleSendText}
            disabled={!userInput.trim()}
          >
            <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </BlurView>
      ) : null}
    </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  timerText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
    textAlign: 'center',
  },
  connectingText: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '400',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  toastWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  toast: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 22,
    overflow: 'hidden',
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  spokenTextWrap: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: '35%',
  },
  spokenText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '400',
    lineHeight: 32,
  },
  interruptBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  interruptText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 16,
    fontWeight: '400',
  },
  statusText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 60,
    paddingTop: 16,
  },
  endBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#E8490A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#E8490A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  pauseBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  ctrlLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    marginTop: 8,
    fontWeight: '400',
  },
  keyboardRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  keyboardText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '400',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
    overflow: 'hidden',
  },
  textInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 13,
    fontSize: 16,
    color: '#FFF',
    maxHeight: 100,
  },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export { CallEndedBanner };
