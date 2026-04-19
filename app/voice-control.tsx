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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type CallPhase = 'connecting' | 'active' | 'paused' | 'ended';

interface ConvMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

// Animated dots for connecting state
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

// Glowing orb for active state
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
      scaleAnim.setValue(1);
      opacityAnim.setValue(0.35);
      innerScaleAnim.setValue(1);
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

// Call ended summary card shown in home
function CallEndedBanner({ duration, onDismiss, onFeedback }: {
  duration: number;
  onDismiss: () => void;
  onFeedback: (type: 'up' | 'down') => void;
}) {
  const mins = Math.floor(duration / 60);
  const secs = duration % 60;
  const label = mins > 0 ? `${mins}m ${secs}s` : `${secs} seconds`;
  const progress = Math.min(duration / 300, 1); // max 5 min for bar

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
  const ringingRef = useRef<Audio.Sound | null>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const isRecordingRef = useRef(false);
  const isPausedRef = useRef(false);
  const allowInterruptRef = useRef(settings.voice_interruption ?? false);

  const selectedVoice = (settings as any).voice_selection || 'alloy';

  // ─── RING SOUND ───
  const playRingSound = useCallback(async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });
      // Use system ring simulation via repeating beep pattern
      // Play a short notification tone 3x to simulate ringing
      for (let i = 0; i < 3; i++) {
        if (phase !== 'connecting') break;
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await new Promise(r => setTimeout(r, 900));
      }
    } catch (e) {}
  }, []);

  // ─── CONNECT SEQUENCE ───
  useEffect(() => {
    let mounted = true;
    const connect = async () => {
      // Start ringing
      playRingSound();
      // After 3.5s → active
      await new Promise(r => setTimeout(r, 3500));
      if (!mounted) return;
      setPhase('active');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Create conversation in background
      const convId = await createConversation();
      if (mounted && convId) setCallConversationId(convId);
      // Start call timer
      callTimerRef.current = setInterval(() => {
        if (mounted) setCallDuration(d => d + 1);
      }, 1000);
      // AI greets first
      await greetUser();
    };
    connect();
    return () => {
      mounted = false;
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    };
  }, []);

  // ─── GREET ───
  const greetUser = useCallback(async () => {
    const greetings = [
      "Hey! Good to hear your voice. How can I help you today?",
      "Hello! I'm here and ready to assist you.",
      "Hi there! What's on your mind?",
    ];
    const text = greetings[Math.floor(Math.random() * greetings.length)];
    await speakText(text, true);
  }, []);

  // ─── TTS SPEAK ───
  const speakText = useCallback(async (text: string, isGreeting = false) => {
    if (isPausedRef.current && !isGreeting) return;
    try {
      if (soundRef.current) {
        try { await soundRef.current.stopAsync(); await soundRef.current.unloadAsync(); } catch {}
        soundRef.current = null;
      }
      setIsAISpeaking(true);
      setCurrentAIText(text);

      // Switch audio mode for playback before TTS call
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      const { data, error } = await supabase.functions.invoke('generate-tts', {
        body: { text: text.slice(0, 500), voice: selectedVoice, speed: 1.0 },
      });

      const audioUrl = data?.audioUrl || data?.audio_url;
      if (error || !audioUrl) {
        let errMsg = 'TTS failed';
        if (error && (error as any).context) {
          try { const txt = await (error as any).context.text(); errMsg = txt || errMsg; } catch {}
        }
        console.log('[Voice] TTS error:', errMsg);
        throw new Error(errMsg);
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
  }, [selectedVoice, supabase, startListening]);

  // ─── START LISTENING ───
  const startListening = useCallback(async () => {
    if (isPausedRef.current || phase === 'ended' || phase === 'connecting') return;
    if (isRecordingRef.current) return;
    try {
      // Clean up any existing recording first
      if (recordingRef.current) {
        try { await recordingRef.current.stopAndUnloadAsync(); } catch {}
        recordingRef.current = null;
      }

      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log('[Voice] Microphone permission denied');
        return;
      }

      // Small delay to let any previous audio session release
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
      // Auto-stop after 8 seconds of user speech
      setTimeout(() => { if (isRecordingRef.current) stopAndProcess(); }, 8000);
    } catch (e: any) {
      console.log('[Voice] startListening error:', e?.message);
      isRecordingRef.current = false;
      setIsUserSpeaking(false);
      recordingRef.current = null;
      // Retry once after brief delay if not paused
      if (!isPausedRef.current) {
        setTimeout(() => startListening(), 1000);
      }
    }
  }, [phase]);

  // ─── STOP + PROCESS ───
  const stopAndProcess = useCallback(async () => {
    if (!recordingRef.current || !isRecordingRef.current) return;
    isRecordingRef.current = false;
    setIsUserSpeaking(false);
    setStatusLabel('Processing...');

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

      // Save to conversation
      const convId = callConversationId || currentConversation?.id;
      if (convId) {
        try { await sendMessage(userText, convId as any, undefined, false, 'gemini'); } catch {}
      }

      // Get AI reply
      const contextMsgs = messages.slice(-6).map(m => ({ role: m.role, content: m.content }));
      const { data: aiData } = await supabase.functions.invoke('chat', {
        body: {
          messages: [...contextMsgs, { role: 'user', content: userText }],
          conversationId: convId || `voice-${Date.now()}`,
          model: 'gemini',
        },
      });

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
      // Stop recording and TTS
      if (isRecordingRef.current && recordingRef.current) {
        try { await recordingRef.current.stopAndUnloadAsync(); } catch {}
        recordingRef.current = null;
        isRecordingRef.current = false;
      }
      if (soundRef.current) {
        try { await soundRef.current.pauseAsync(); } catch {}
      }
      setIsUserSpeaking(false);
      setIsAISpeaking(false);
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

    if (recordingRef.current) {
      try { await recordingRef.current.stopAndUnloadAsync(); } catch {}
      recordingRef.current = null;
    }
    if (soundRef.current) {
      try { await soundRef.current.stopAsync(); await soundRef.current.unloadAsync(); } catch {}
      soundRef.current = null;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setPhase('ended');
    // Navigate to home after brief delay
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

    // Stop listening if recording
    if (isRecordingRef.current && recordingRef.current) {
      try { await recordingRef.current.stopAndUnloadAsync(); } catch {}
      recordingRef.current = null;
      isRecordingRef.current = false;
    }
    setIsUserSpeaking(false);

    const contextMsgs = messages.slice(-6).map(m => ({ role: m.role, content: m.content }));
    const { data: aiData } = await supabase.functions.invoke('chat', {
      body: {
        messages: [...contextMsgs, { role: 'user', content: text }],
        conversationId: callConversationId || `voice-${Date.now()}`,
        model: 'gemini',
      },
    });

    const aiReply = aiData?.message || aiData?.content || "I heard you. Let me help with that.";
    const aiMsg: ConvMessage = { role: 'assistant', content: aiReply, timestamp: Date.now() };
    setMessages(prev => [...prev, aiMsg]);
    await speakText(aiReply.slice(0, 400));
  }, [userInput, messages, callConversationId, supabase, speakText]);

  // Scroll to bottom on messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
      soundRef.current?.unloadAsync().catch(() => {});
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
      ringingRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // Gradient based on phase
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
        {/* Left: Text mode toggle */}
        <TouchableOpacity onPress={handleTextModeToggle} style={styles.headerBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons
            name={textModeOn ? 'document-text-outline' : 'document-text'}
            size={22}
            color={textModeOn ? 'rgba(255,255,255,0.55)' : '#FFFFFF'}
          />
        </TouchableOpacity>

        {/* Center: Title + timer */}
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Haitian AI</Text>
          {phase === 'active' && !isPaused ? (
            <Text style={styles.timerText}>{formatDuration(callDuration)}</Text>
          ) : phase === 'active' && isPaused ? (
            <Text style={styles.timerText}>Paused</Text>
          ) : null}
        </View>

        {/* Right: Settings */}
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
        /* Connecting state */
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 200 }}>
          <Text style={styles.connectingText}>Connecting...</Text>
          <View style={{ marginTop: 18 }}>
            <ConnectingDots />
          </View>
        </View>
      ) : (
        /* Active state */
        <View style={{ flex: 1 }}>
          {textModeOn && messages.length > 0 ? (
            /* Text mode conversation */
            <ScrollView
              ref={scrollRef}
              style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16 }}
              showsVerticalScrollIndicator={false}
            >
              {messages.map((msg, i) => (
                <View key={i} style={[
                  styles.bubble,
                  msg.role === 'user' ? styles.userBubble : styles.aiBubble,
                ]}>
                  <Text style={styles.bubbleText}>{msg.content}</Text>
                </View>
              ))}
              <View style={{ height: 24 }} />
            </ScrollView>
          ) : (
            /* Voice visual mode: orb */
            <View style={{ flex: 1, position: 'relative' }}>
              <GlowingOrb isAISpeaking={isAISpeaking} isUserSpeaking={isUserSpeaking} />
              {/* AI current spoken text overlay */}
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
        {/* End button */}
        <View style={{ alignItems: 'center' }}>
          <TouchableOpacity style={styles.endBtn} onPress={handleEnd} activeOpacity={0.8}>
            <Ionicons name="call" size={28} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} />
          </TouchableOpacity>
          <Text style={styles.ctrlLabel}>End</Text>
        </View>

        {/* Pause button */}
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
            onBlur={() => {}}
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
    pointerEvents: 'none' as any,
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
    borderWidth: 0,
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
  bubble: {
    maxWidth: '82%',
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: 'transparent',
    borderBottomLeftRadius: 4,
    paddingLeft: 0,
  },
  bubbleText: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 24,
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
