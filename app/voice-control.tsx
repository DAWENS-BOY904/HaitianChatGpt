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
  ScrollView,
  KeyboardAvoidingView,
  TextInput,
  Animated,
  Easing,
  Alert,
  Linking,
  AppState,
  AppStateStatus,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useFocusEffect } from '@react-navigation/native';
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
}

const BAD_WORDS = [
  'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'cunt', 'dick', 'pussy',
  'cock', 'nigger', 'nigga', 'faggot', 'whore', 'slut', 'motherfucker',
  'fucker', 'piss', 'retard', 'kaka', 'manman', 'degage',
];

function containsBadWord(text: string): boolean {
  const lower = text.toLowerCase();
  return BAD_WORDS.some(w => new RegExp(`\\b${w}\\b`, 'i').test(lower));
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${((h % 12) || 12)}:${m} ${h >= 12 ? 'PM' : 'AM'}`;
}

// ─── Per-voice persona prompts ───────────────────────────────────────────────
const VOICE_PERSONAS: Record<string, string> = {
  'pNInz6obpgDQGcFmaJgB': 'You speak in a warm, calm, trustworthy male voice. You are composed, reassuring, and knowledgeable. Respond with confidence and warmth.',
  '21m00Tcm4TlvDq8ikWAM': 'You speak in a warm, friendly, approachable female voice. You are cheerful, supportive, and encouraging. Respond with positivity and care.',
  'AZnzlk1XvdvUeBnXmlld': 'You speak in a bright, upbeat, energetic female voice. You are enthusiastic, motivating, and lively. Respond with energy and excitement.',
  'EXAVITQu4vr4xnSDxMaL': 'You speak in a soft, gentle, nurturing female voice. You are patient, caring, and empathetic. Respond with gentleness and compassion.',
  'VR6AewLTigWG4xSOukaG': 'You speak in a calm, clear, professional male voice. You are precise, confident, and articulate. Respond with clarity and professionalism.',
  'GBv7mTt0atIp3Br8iCZE': 'You speak in a deep, authoritative male voice. You are knowledgeable, direct, and commanding. Respond with authority and expertise.',
  'yoZ06aMxZJJ28mfd3POQ': 'You speak in an expressive, energetic British male voice. You are witty, engaging, and dynamic. Respond with personality and British charm.',
  'ThT5KcBeYPX3keUQqHPh': 'You speak in a wise, measured British female voice. You are thoughtful, articulate, and insightful. Respond with wisdom and elegance.',
  'pqHfZKP75CvOlQylNhV4': 'You speak in a professional, deep male voice. You are reliable, clear, and composed. Respond with confidence and professionalism.',
  'PzuBz8h2SxBvQ7lnUC44': 'You speak in an expressive, dynamic female voice called Aria. You are creative, inspiring, and imaginative. Respond with passion and creativity.',
  'jv41DhCf464zw0TI7I1w': 'You speak in a confident, strong male voice called Marcus. You are bold, motivating, and decisive. Respond with strength and conviction.',
  'kJKMPwrIKzwVkMKOfRtr': 'You speak in a natural, conversational female voice called Sofia. You are relatable, friendly, and down-to-earth. Respond naturally and warmly.',
  'flHkNRp1BlvT73UL6gyz': 'You speak in a dynamic, energetic male voice called Ryan. You are enthusiastic, uplifting, and spirited. Respond with energy and positivity.',
  'mRdG9GYEjJmIzqbYTidv': 'You speak in a smooth, melodic female voice called Luna. You are calm, soothing, and graceful. Respond with serenity and warmth.',
};

function getVoicePersona(voiceId: string): string {
  return VOICE_PERSONAS[voiceId] || 'You speak in a warm, professional voice. You are helpful, friendly, and supportive. Respond with care and expertise.';
}

// ─── Voice system prompt ─────────────────────────────────────────────────────
const BASE_VOICE_PROMPT = `You are Dawinix, a warm and respectful AI voice assistant created by the Haitian Community.

CORE RULES (MANDATORY):
- ALWAYS treat every person with deep respect, kindness, and dignity — no exceptions
- Be encouraging, warm, supportive, and uplifting in every response
- Give SHORT conversational answers (2-4 sentences max) — this is real-time voice mode
- NEVER use markdown: no **, no ##, no backticks, no bullet points — plain speech only
- NEVER say you are a demo, test, unavailable, or limited
- NEVER refuse to answer — always provide a complete, helpful response
- Detect the user language and ALWAYS respond in the same language they use
- If asked your name: say "I am Dawinix, created by the Haitian Community"
- No code blocks — describe code verbally if needed
- Real-time voice conversation — be concise, natural, and human-sounding
- Use a warm, friendly tone as if speaking to a trusted friend`;

function buildSystemPrompt(voiceId: string, langHint = ''): string {
  const persona = getVoicePersona(voiceId);
  return `${BASE_VOICE_PROMPT}\n\nYOUR VOICE PERSONA:\n${persona}${langHint}`;
}

// ─── Language display names ──────────────────────────────────────────────────
const LANG_DISPLAY: Record<string, string> = {
  en: 'English', fr: 'French', es: 'Spanish', ht: 'Haitian Creole',
  pt: 'Portuguese', de: 'German', it: 'Italian', ar: 'Arabic',
  zh: 'Chinese', ja: 'Japanese', ko: 'Korean', ru: 'Russian',
  hi: 'Hindi', nl: 'Dutch', pl: 'Polish',
};

function getLangDisplay(code: string): string {
  if (!code) return '';
  const base = code.toLowerCase().split('-')[0];
  return LANG_DISPLAY[base] || code;
}

// ─── Animated connecting dots ────────────────────────────────────────────────
function ConnectingDots() {
  const anims = useRef(Array.from({ length: 7 }, () => new Animated.Value(0.3))).current;
  useEffect(() => {
    const animations = anims.map((anim, i) =>
      Animated.loop(Animated.sequence([
        Animated.delay(i * 120),
        Animated.timing(anim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.3, duration: 400, useNativeDriver: true }),
      ]))
    );
    animations.forEach(a => a.start());
    return () => animations.forEach(a => a.stop());
  }, []);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {anims.map((anim, i) => (
        <Animated.View key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFF', opacity: anim }} />
      ))}
    </View>
  );
}

// ─── Language badge (animated) ───────────────────────────────────────────────
function LanguageBadge({ lang }: { lang: string | null }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (lang) {
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    } else {
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
  }, [lang]);
  if (!lang) return null;
  return (
    <Animated.View style={{ opacity: fadeAnim, alignItems: 'center', marginBottom: 8 }}>
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: 'rgba(16,163,127,0.18)', borderRadius: 20,
        paddingHorizontal: 14, paddingVertical: 6,
        borderWidth: 1, borderColor: 'rgba(16,163,127,0.4)',
      }}>
        <Ionicons name="globe-outline" size={14} color="#10A37F" />
        <Text style={{ color: '#10A37F', fontSize: 13, fontWeight: '600' }}>
          {getLangDisplay(lang)}
        </Text>
      </View>
    </Animated.View>
  );
}

// ─── Typing indicator ────────────────────────────────────────────────────────
function TypingIndicator() {
  const dots = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;
  useEffect(() => {
    const bounce = (d: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.timing(d, { toValue: -6, duration: 250, useNativeDriver: true }),
        Animated.timing(d, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.delay(500),
      ]));
    const anims = dots.map((d, i) => bounce(d, i * 150));
    anims.forEach(a => a.start());
    return () => { anims.forEach(a => a.stop()); };
  }, []);
  return (
    <View style={bubStyles.typingWrap}>
      {dots.map((d, i) => (
        <Animated.View key={i} style={[bubStyles.typingDot, { transform: [{ translateY: d }] }]} />
      ))}
    </View>
  );
}

// ─── Word-by-word AI bubble ──────────────────────────────────────────────────
function AnimatedAIBubble({ content, timestamp }: { content: string; timestamp: number }) {
  const words = content.split(' ');
  const [count, setCount] = useState(0);
  useEffect(() => {
    setCount(0);
    let c = 0;
    const interval = setInterval(() => {
      c += 1;
      setCount(c);
      if (c >= words.length) clearInterval(interval);
    }, 45);
    return () => clearInterval(interval);
  }, [content]);
  return (
    <View style={{ alignSelf: 'flex-start', marginBottom: 10, maxWidth: '82%' }}>
      <View style={bubStyles.aiBubble}>
        <Text style={bubStyles.aiText}>{words.slice(0, count).join(' ')}</Text>
      </View>
      <Text style={bubStyles.ts}>{formatTime(timestamp)}</Text>
    </View>
  );
}

// ─── Static user bubble ──────────────────────────────────────────────────────
function UserBubble({ content, timestamp }: { content: string; timestamp: number }) {
  return (
    <View style={{ alignSelf: 'flex-end', marginBottom: 10, maxWidth: '82%', alignItems: 'flex-end' }}>
      <View style={bubStyles.userBubble}>
        <Text style={bubStyles.userText}>{content}</Text>
      </View>
      <Text style={[bubStyles.ts, { textAlign: 'right' }]}>{formatTime(timestamp)}</Text>
    </View>
  );
}

const bubStyles = StyleSheet.create({
  aiBubble: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 18, borderBottomLeftRadius: 4, padding: 14 },
  aiText: { color: '#FFF', fontSize: 16, lineHeight: 24 },
  userBubble: { backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 18, borderBottomRightRadius: 4, padding: 14 },
  userText: { color: '#FFF', fontSize: 16, lineHeight: 24 },
  ts: { color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 4, marginHorizontal: 4 },
  typingWrap: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 14, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 18, borderBottomLeftRadius: 4, alignSelf: 'flex-start', marginBottom: 10 },
  typingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.6)' },
});

// ─── Glowing orb ─────────────────────────────────────────────────────────────
function GlowingOrb({ isAISpeaking, isUserSpeaking }: { isAISpeaking: boolean; isUserSpeaking: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    if (isAISpeaking) {
      Animated.loop(Animated.sequence([
        Animated.timing(scale, { toValue: 1.15, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])).start();
      Animated.loop(Animated.sequence([
        Animated.timing(opacity, { toValue: 0.85, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 600, useNativeDriver: true }),
      ])).start();
    } else if (isUserSpeaking) {
      Animated.loop(Animated.sequence([
        Animated.timing(scale, { toValue: 1.08, duration: 300, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.96, duration: 300, useNativeDriver: true }),
      ])).start();
    } else {
      scale.stopAnimation(); scale.setValue(1);
      opacity.stopAnimation(); opacity.setValue(0.35);
    }
  }, [isAISpeaking, isUserSpeaking]);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{
        width: 260, height: 260, borderRadius: 130,
        backgroundColor: isAISpeaking ? '#1a3a6e' : '#0f1f3d',
        opacity,
        transform: [{ scale }],
        shadowColor: '#2563eb',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 60,
        elevation: 20,
      }} />
    </View>
  );
}

// ─── Ban screen ───────────────────────────────────────────────────────────────
function BannedScreen({ banUntil, offenseCount, onContactSupport, onBack }: {
  banUntil: Date; offenseCount: number; onContactSupport: () => void; onBack: () => void;
}) {
  const remaining = Math.max(0, Math.ceil((banUntil.getTime() - Date.now()) / 1000 / 60));
  const hours = Math.floor(remaining / 60);
  const mins = remaining % 60;
  const label = hours > 0 ? `${hours}h ${mins}m` : `${mins} min`;
  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#FF3B30', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
        <Ionicons name="ban" size={40} color="#FFF" />
      </View>
      <Text style={{ color: '#FFF', fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 12 }}>Voice Control Restricted</Text>
      <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 8 }}>
        You have been temporarily restricted from voice control due to {offenseCount} repeated violations.
      </Text>
      <Text style={{ color: '#FF3B30', fontSize: 17, fontWeight: '600', marginBottom: 32 }}>
        Restriction lifts in: {label}
      </Text>
      <TouchableOpacity style={{ backgroundColor: '#10A37F', borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14, marginBottom: 16, width: '100%', alignItems: 'center' }} onPress={onContactSupport}>
        <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700' }}>Contact Support</Text>
      </TouchableOpacity>
      <TouchableOpacity style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14, width: '100%', alignItems: 'center' }} onPress={onBack}>
        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16 }}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );
}

export function CallEndedBanner({ duration, onDismiss, onFeedback }: {
  duration: number; onDismiss: () => void; onFeedback: (t: 'up' | 'down') => void;
}) {
  const mins = Math.floor(duration / 60);
  const secs = duration % 60;
  const label = mins > 0 ? `${mins}m ${secs}s` : `${secs} seconds`;
  const progress = Math.min(duration / 300, 1);
  return (
    <View style={{ borderRadius: 18, overflow: 'hidden', marginHorizontal: 16, marginBottom: 8 }}>
      <BlurView intensity={70} tint="dark" style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Ionicons name="call" size={18} color="rgba(255,255,255,0.7)" />
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '500' }}>Call ended {label}</Text>
          <TouchableOpacity onPress={() => onFeedback('up')} style={{ marginLeft: 'auto' }}><Ionicons name="thumbs-up-outline" size={20} color="rgba(255,255,255,0.7)" /></TouchableOpacity>
          <TouchableOpacity onPress={() => onFeedback('down')} style={{ marginLeft: 12 }}><Ionicons name="thumbs-down-outline" size={20} color="rgba(255,255,255,0.7)" /></TouchableOpacity>
          <TouchableOpacity onPress={onDismiss} style={{ marginLeft: 12 }}><Ionicons name="close" size={18} color="rgba(255,255,255,0.5)" /></TouchableOpacity>
        </View>
        <View style={{ height: 3, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
          <View style={{ height: 3, backgroundColor: '#10A37F', borderRadius: 2, width: `${progress * 100}%` as any }} />
        </View>
      </BlurView>
    </View>
  );
}

// ─── expo-speech fallback ─────────────────────────────────────────────────────
function speakWithDevice(text: string, rate: number, lang: string | null, onDone: () => void) {
  const language = lang || 'en-US';
  try {
    Speech.speak(text, {
      language,
      rate: Math.min(rate * 0.9, 1.4),
      onDone,
      onError: () => onDone(),
    });
  } catch { onDone(); }
}

// ─── Strip markdown for voice ─────────────────────────────────────────────────
function stripMarkdownForVoice(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, 'Here is the code.')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\[MESSAGE_CARD\][\s\S]*?\[\/MESSAGE_CARD\]/g, '')
    .replace(/\[SOURCES\][\s\S]*?\[\/SOURCES\]/g, '')
    .replace(/\[DOWNLOAD_CARD\][\s\S]*?\[\/DOWNLOAD_CARD\]/g, '')
    .replace(/\[ANALYSIS\][\s\S]*?\[\/ANALYSIS\]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 500);
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
  const messagesRef = useRef<ConvMessage[]>([]);
  const [currentAIText, setCurrentAIText] = useState('');
  const [statusLabel, setStatusLabel] = useState('');
  const [callDuration, setCallDuration] = useState(0);
  const [callConversationId, setCallConversationId] = useState<string | null>(null);
  const [callEnded, setCallEnded] = useState(false);

  // ── Language detection state ──────────────────────────────────────────────
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);
  const detectedLangRef = useRef<string | null>(null);

  // Ban state
  const [banInfo, setBanInfo] = useState<{ until: Date; offenseCount: number } | null>(null);
  const [banLoading, setBanLoading] = useState(true);
  const voiceOffenseCountRef = useRef(0);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const ringSoundRef = useRef<Audio.Sound | null>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const isRecordingRef = useRef(false);
  const isPausedRef = useRef(false);
  const isConnectingRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const appStateRef = useRef<AppStateStatus>('active');

  // ── Read voice selection from settings ──
  const selectedVoice = (settings as any).voiceSelection || (settings as any).voice_selection || 'pNInz6obpgDQGcFmaJgB';
  const [speechRate, setSpeechRate] = React.useState<number>(
    parseFloat((settings as any).speech_rate?.toString() || (settings as any).speechRate?.toString() || '1.0')
  );
  const [allowInterrupt, setAllowInterrupt] = React.useState<boolean>(
    (settings as any).voice_interruption ?? (settings as any).voiceInterruption ?? false
  );
  const [autoGreeting, setAutoGreeting] = React.useState<boolean>(
    (settings as any).auto_greeting ?? (settings as any).autoGreeting ?? true
  );

  // ── App state handling (background/foreground) ──────────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextAppState) => {
      if (appStateRef.current === 'active' && nextAppState.match(/inactive|background/)) {
        if (!isPausedRef.current) {
          handlePause();
        }
      }
      appStateRef.current = nextAppState;
    });
    return () => sub.remove();
  }, []);

  // Reload speech rate + toggles from AsyncStorage whenever screen focuses
  useFocusEffect(
    useCallback(() => {
      const loadVoicePrefs = async () => {
        try {
          const AsyncStorage = require('@react-native-async-storage/async-storage').default;
          const rateStr = await AsyncStorage.getItem('voice_speech_rate');
          const interruptStr = await AsyncStorage.getItem('voice_interruption');
          const greetStr = await AsyncStorage.getItem('voice_auto_greeting');
          if (rateStr) setSpeechRate(parseFloat(rateStr));
          if (interruptStr !== null) setAllowInterrupt(interruptStr === 'true');
          if (greetStr !== null) setAutoGreeting(greetStr !== 'false');
        } catch (_e) {}
      };
      loadVoicePrefs();
    }, [])
  );

  // ─── CHECK BAN ────────────────────────────────────────────────────────────
  useEffect(() => {
    const checkBan = async () => {
      setBanLoading(true);
      try {
        if (!user?.id) { setBanLoading(false); return; }
        const { data } = await supabase
          .from('voice_bans')
          .select('banned_until, offense_count')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        if (data?.banned_until) {
          const until = new Date(data.banned_until);
          if (until > new Date()) setBanInfo({ until, offenseCount: data.offense_count });
        }
      } catch (_e) {}
      setBanLoading(false);
    };
    checkBan();
  }, [user?.id]);

  const applyVoiceBan = useCallback(async () => {
    voiceOffenseCountRef.current += 1;
    const count = voiceOffenseCountRef.current;
    const banHours = count === 1 ? 1 : count === 2 ? 3 : 24;
    const banUntil = new Date(Date.now() + banHours * 60 * 60 * 1000);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    try {
      if (user?.id) {
        await supabase.from('voice_bans').insert({
          user_id: user.id,
          offense_count: count,
          banned_until: banUntil.toISOString(),
          reason: `Inappropriate language in voice control (offense #${count})`,
        }).catch(() => {});
      }
    } catch (_e) {}
    await handleEnd(false);
    setBanInfo({ until: banUntil, offenseCount: count });
  }, [user?.id, supabase]);

  // ─── RINGTONE ────────────────────────────────────────────────────────────
  const playRingtone = useCallback(async () => {
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true, staysActiveInBackground: false });
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://cdn.pixabay.com/audio/2025/07/30/audio_a4cedca394.mp3?filename=dragon-studio-phone-ringing-382734.mp3' },
        { shouldPlay: true, isLooping: true, volume: 0.85 }
      );
      ringSoundRef.current = sound;
    } catch (_e) {
      for (let i = 0; i < 3; i++) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }, []);

  const stopRingtone = useCallback(async () => {
    if (ringSoundRef.current) {
      try { await ringSoundRef.current.stopAsync(); await ringSoundRef.current.unloadAsync(); } catch (_e) {}
      ringSoundRef.current = null;
    }
  }, []);

  // ─── CONNECT ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (banLoading || banInfo) return;
    isConnectingRef.current = true;
    playRingtone();
    const timer = setTimeout(async () => {
      await stopRingtone();
      isConnectingRef.current = false;
      setPhase('active');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      try {
        const convId = await createConversation();
        if (convId) setCallConversationId(convId);
      } catch (_e) {}
      callTimerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
      if (autoGreeting) await greetUser();
    }, 4000);
    return () => { clearTimeout(timer); stopRingtone(); };
  }, [banLoading, banInfo, autoGreeting]);

  const greetUser = useCallback(async () => {
    const greetings = [
      "Hey! Good to hear your voice. How can I help you today?",
      "Hello! I am Dawinix, ready to assist you.",
      "Hi there! What is on your mind today?",
      "Good to connect with you! What can I do for you?",
    ];
    await speakText(greetings[Math.floor(Math.random() * greetings.length)]);
  }, []);

  // ─── CALL AI via streaming edge function ─────────────────────────────────
  const callChatAI = useCallback(async (
    msgs: Array<{ role: string; content: string }>,
    convId: string,
    onToken?: (token: string) => void
  ): Promise<string> => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !supabaseAnonKey) {
      console.log('[VoiceChat] Missing Supabase env vars');
      return '';
    }

    let authToken = supabaseAnonKey;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.access_token) {
        authToken = sessionData.session.access_token;
      }
    } catch (_e) {}

    const chatConvId = convId || `voice-${Date.now()}`;
    const endpoint = `${supabaseUrl}/functions/v1/chat`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({
          messages: msgs,
          conversationId: chatConvId,
          aiModel: 'google-gemini',
          userId: user?.id,
          stream: true,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        console.log('[VoiceChat] Chat HTTP error:', response.status, errText.slice(0, 150));
        return '';
      }

      const contentType = response.headers.get('content-type') || '';
      let fullText = '';

      if (contentType.includes('text/event-stream')) {
        const reader = response.body?.getReader();
        if (reader) {
          const decoder = new TextDecoder();
          let buffer = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const jsonStr = line.slice(6).trim();
              if (!jsonStr || jsonStr === '[DONE]') continue;
              try {
                const parsed = JSON.parse(jsonStr);
                if (parsed.token) {
                  fullText += parsed.token;
                  onToken?.(parsed.token);
                }
                if (parsed.done || parsed.type === 'complete') break;
              } catch (_e) {}
            }
          }
        }
      } else {
        try {
          const json = await response.json();
          fullText = json.message || json.content || json.response || json.text || '';
        } catch (_e) {
          fullText = await response.text().catch(() => '');
        }
      }

      return fullText.trim();
    } catch (e: any) {
      if (e.name === 'AbortError') {
        console.log('[VoiceChat] Request aborted');
        return '';
      }
      console.log('[VoiceChat] Fetch error:', e?.message);
      return '';
    } finally {
      abortControllerRef.current = null;
    }
  }, [supabase, user]);

  // ─── SPEAK TEXT — always uses ElevenLabs via edge function ─────────────────
  const speakText = useCallback(async (text: string) => {
    if (isPausedRef.current) return;

    if (soundRef.current) {
      try { await soundRef.current.stopAsync(); await soundRef.current.unloadAsync(); } catch {}
      soundRef.current = null;
    }
    try { Speech.stop(); } catch {}

    setIsAISpeaking(true);
    setCurrentAIText(text);
    setIsAITyping(false);

    const onDone = () => {
      setIsAISpeaking(false);
      setCurrentAIText('');
      if (!isPausedRef.current) setTimeout(() => startListening(), 400);
    };

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      const { data, error } = await supabase.functions.invoke('generate-tts', {
        body: {
          text: text.slice(0, 500),
          voice: selectedVoice,
          speed: speechRate,
          detectedLanguage: detectedLangRef.current,
        },
      });

      if (data?.fallback === true || data?.code === 'USE_DEVICE_TTS') {
        console.log('[Voice] ElevenLabs unavailable — using device TTS');
        speakWithDevice(text, speechRate, detectedLangRef.current, onDone);
        return;
      }

      const audioUrl = data?.audioUrl || data?.audio_url;

      if (error || !audioUrl) {
        console.log('[Voice] No audio URL from TTS edge function — using device TTS');
        speakWithDevice(text, speechRate, detectedLangRef.current, onDone);
        return;
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true, volume: 1.0 }
      );
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((s) => {
        if (s.isLoaded && s.didJustFinish) {
          sound.unloadAsync().catch(() => {});
          soundRef.current = null;
          onDone();
        }
      });
    } catch (e: any) {
      console.log('[Voice] speakText error:', e?.message);
      setIsAISpeaking(false);
      setCurrentAIText('');
      speakWithDevice(text, speechRate, detectedLangRef.current, () => {
        if (!isPausedRef.current) setTimeout(() => startListening(), 600);
      });
    }
  }, [selectedVoice, speechRate, supabase]);

  // ─── START LISTENING ──────────────────────────────────────────────────────
  const startListening = useCallback(async () => {
    if (isPausedRef.current || isConnectingRef.current || isRecordingRef.current) return;
    try {
      if (recordingRef.current) {
        try { await recordingRef.current.stopAndUnloadAsync(); } catch {}
        recordingRef.current = null;
      }
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') return;
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true, playsInSilentModeIOS: true,
        shouldDuckAndroid: true, staysActiveInBackground: false,
        interruptionModeIOS: 1, interruptionModeAndroid: 1,
      });
      if (Platform.OS === 'android') await new Promise(r => setTimeout(r, 100));
      const { recording } = await Audio.Recording.createAsync({
        android: { extension: '.m4a', outputFormat: Audio.AndroidOutputFormat.MPEG_4, audioEncoder: Audio.AndroidAudioEncoder.AAC, sampleRate: 16000, numberOfChannels: 1, bitRate: 64000 },
        ios: { extension: '.m4a', audioQuality: Audio.IOSAudioQuality.MEDIUM, sampleRate: 16000, numberOfChannels: 1, bitRate: 64000, linearPCMBitDepth: 16, linearPCMIsBigEndian: false, linearPCMIsFloat: false },
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
      if (!isPausedRef.current) setTimeout(() => startListening(), 1000);
    }
  }, []);

  // ─── STOP + PROCESS ───────────────────────────────────────────────────────
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
      const { data: txData } = await supabase.functions.invoke('transcribe-audio', {
        body: { audio: base64Audio, userId: user?.id, detectLanguage: true },
      });

      if (!txData?.text?.trim()) {
        setStatusLabel('');
        if (!isPausedRef.current) setTimeout(() => startListening(), 500);
        return;
      }

      const userText = txData.text.trim();

      if (txData.detectedLanguage) {
        const lang = txData.detectedLanguage;
        setDetectedLanguage(lang);
        detectedLangRef.current = lang;
        setTimeout(() => {
          setDetectedLanguage(prev => prev === lang ? null : prev);
        }, 6000);
      }

      if (containsBadWord(userText)) {
        const count = voiceOffenseCountRef.current + 1;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(
          `Warning #${count}`,
          `Inappropriate language detected. ${count >= 3 ? 'You will be restricted from voice control.' : `${3 - count} warning(s) remaining.`}`,
          [{ text: 'I Understand', style: 'destructive', onPress: () => { if (count >= 3) { applyVoiceBan(); } else { voiceOffenseCountRef.current = count; if (!isPausedRef.current) startListening(); } } }]
        );
        setStatusLabel('');
        return;
      }

      const userMsg: ConvMessage = { role: 'user', content: userText, timestamp: Date.now() };
      const updatedMsgs = [...messagesRef.current, userMsg];
      messagesRef.current = updatedMsgs;
      setMessages(updatedMsgs);
      setStatusLabel('');
      setIsAITyping(true);

      const convId = callConversationId || currentConversation?.id;
      const chatConvId = convId || `voice-${Date.now()}`;

      const langName = detectedLangRef.current ? getLangDisplay(detectedLangRef.current) : null;
      const langHint = langName
        ? `\n\nCRITICAL: The user is speaking ${langName}. You MUST respond ONLY in ${langName}. Do not switch languages.`
        : '';

      const contextMsgs = updatedMsgs.slice(-8).map(m => ({ role: m.role, content: m.content }));
      const allMsgs = [
        { role: 'system', content: buildSystemPrompt(selectedVoice, langHint) },
        ...contextMsgs,
      ];

      let streamedText = '';
      
      const rawReply = await callChatAI(allMsgs, chatConvId, (token) => {
        streamedText += token;
        setCurrentAIText(streamedText);
      });

      setIsAITyping(false);
      setCurrentAIText('');

      if (!rawReply) {
        const retryReply = await callChatAI(
          [
            { role: 'system', content: buildSystemPrompt(selectedVoice) },
            { role: 'user', content: userText },
          ],
          `voice-retry-${Date.now()}`
        );
        
        if (!retryReply) {
          const fallbackReply = 'I heard you. Could you tell me a little more so I can help you better?';
          const aiMsg: ConvMessage = { role: 'assistant', content: fallbackReply, timestamp: Date.now() };
          messagesRef.current = [...messagesRef.current, aiMsg];
          setMessages(prev => [...prev, aiMsg]);
          await speakText(fallbackReply);
          return;
        }
        
        const spokenText = stripMarkdownForVoice(retryReply);
        const aiMsg: ConvMessage = { role: 'assistant', content: retryReply, timestamp: Date.now() };
        messagesRef.current = [...messagesRef.current, aiMsg];
        setMessages(prev => [...prev, aiMsg]);
        await speakText(spokenText);
        return;
      }

      const spokenText = stripMarkdownForVoice(rawReply);

      const aiMsg: ConvMessage = { role: 'assistant', content: rawReply, timestamp: Date.now() };
      messagesRef.current = [...messagesRef.current, aiMsg];
      setMessages(prev => [...prev, aiMsg]);

      if (convId) {
        try { await sendMessage(userText, convId as any, undefined, false, 'gemini'); } catch (_e) {}
      }

      await speakText(spokenText);
    } catch (e) {
      setIsAITyping(false);
      setStatusLabel('');
      if (!isPausedRef.current) setTimeout(() => startListening(), 500);
    }
  }, [callConversationId, currentConversation, supabase, user, sendMessage, speakText, startListening, applyVoiceBan, callChatAI, selectedVoice]);

  const handleInterrupt = useCallback(async () => {
    if (!allowInterrupt) return;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (soundRef.current) { try { await soundRef.current.stopAsync(); } catch {} }
    try { Speech.stop(); } catch {}
    setIsAISpeaking(false);
    setCurrentAIText('');
    if (!isPausedRef.current) startListening();
  }, [allowInterrupt, startListening]);

  const handlePause = useCallback(async () => {
    const newPaused = !isPaused;
    setIsPaused(newPaused);
    isPausedRef.current = newPaused;
    if (newPaused) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      if (isRecordingRef.current && recordingRef.current) {
        try { await recordingRef.current.stopAndUnloadAsync(); } catch {}
        recordingRef.current = null;
        isRecordingRef.current = false;
      }
      if (soundRef.current) { try { await soundRef.current.pauseAsync(); } catch {} }
      try { Speech.stop(); } catch {}
      setIsUserSpeaking(false); setIsAISpeaking(false); setIsAITyping(false);
      setStatusLabel('Paused');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      setStatusLabel('');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setTimeout(() => startListening(), 400);
    }
  }, [isPaused, startListening]);

  const handleEnd = useCallback(async (navigate = true) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    isRecordingRef.current = false;
    isPausedRef.current = true;
    isConnectingRef.current = false;
    await stopRingtone();
    if (recordingRef.current) { try { await recordingRef.current.stopAndUnloadAsync(); } catch {} recordingRef.current = null; }
    if (soundRef.current) { try { await soundRef.current.stopAsync(); await soundRef.current.unloadAsync(); } catch {} soundRef.current = null; }
    try { Speech.stop(); } catch {}
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setPhase('ended');
    setCallEnded(true);
    if (navigate) setTimeout(() => router.replace('/home'), 300);
  }, [router, stopRingtone]);

  const handleTextModeToggle = useCallback(() => {
    const next = !textModeOn;
    setTextModeOn(next);
    setShowTextModeToast(true);
    setTimeout(() => setShowTextModeToast(false), 1800);
  }, [textModeOn]);

  // ─── SEND TEXT MESSAGE → AI → TTS ─────────────────────────────────────────
  const handleSendText = useCallback(async () => {
    const text = userInput.trim();
    if (!text) return;
    if (containsBadWord(text)) {
      Alert.alert('Warning', 'Please keep the conversation respectful.', [{ text: 'OK' }]);
      return;
    }
    setUserInput('');

    if (isRecordingRef.current && recordingRef.current) {
      try { await recordingRef.current.stopAndUnloadAsync(); } catch {}
      recordingRef.current = null;
      isRecordingRef.current = false;
      setIsUserSpeaking(false);
    }

    const msg: ConvMessage = { role: 'user', content: text, timestamp: Date.now() };
    const updatedMsgs = [...messagesRef.current, msg];
    messagesRef.current = updatedMsgs;
    setMessages(updatedMsgs);
    setIsAITyping(true);
    setStatusLabel('Thinking...');

    const langName = detectedLangRef.current ? getLangDisplay(detectedLangRef.current) : null;
    const langHint = langName
      ? `\n\nCRITICAL: The user is speaking ${langName}. You MUST respond ONLY in ${langName}.`
      : '';
    const contextMsgs = updatedMsgs.slice(-8).map(m => ({ role: m.role, content: m.content }));
    const allMsgs = [
      { role: 'system', content: buildSystemPrompt(selectedVoice, langHint) },
      ...contextMsgs,
    ];

    const textChatConvId = callConversationId || `voice-${Date.now()}`;

    let streamedText = '';
    let rawReply = await callChatAI(allMsgs, textChatConvId, (token) => {
      streamedText += token;
      setCurrentAIText(streamedText);
    });
    
    if (!rawReply) {
      rawReply = await callChatAI(
        [
          { role: 'system', content: buildSystemPrompt(selectedVoice) },
          { role: 'user', content: text },
        ],
        `voice-retry-${Date.now()}`
      );
    }

    if (!rawReply) rawReply = 'I heard you! How can I help you with that?';

    setIsAITyping(false);
    setStatusLabel('');
    setCurrentAIText('');
    const spokenText = stripMarkdownForVoice(rawReply);
    const aiMsg: ConvMessage = { role: 'assistant', content: rawReply, timestamp: Date.now() };
    messagesRef.current = [...messagesRef.current, aiMsg];
    setMessages(prev => [...prev, aiMsg]);
    await speakText(spokenText);
  }, [userInput, callConversationId, selectedVoice, callChatAI, speakText]);

  useEffect(() => {
    if (messages.length > 0 || isAITyping) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
    }
  }, [messages, isAITyping]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (callTimerRef.current) clearInterval(callTimerRef.current);
      soundRef.current?.unloadAsync().catch(() => {});
      ringSoundRef.current?.unloadAsync().catch(() => {});
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
      try { Speech.stop(); } catch {}
    };
  }, []);

  const formatDuration = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  if (banLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16 }}>Checking status...</Text>
      </View>
    );
  }
  if (banInfo) {
    return (
      <BannedScreen
        banUntil={banInfo.until}
        offenseCount={banInfo.offenseCount}
        onContactSupport={() => Linking.openURL('mailto:contact@onspace.ai?subject=Voice%20Ban%20Appeal')}
        onBack={() => router.replace('/home')}
      />
    );
  }

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
            <Ionicons name={textModeOn ? 'document-text' : 'document-text-outline'} size={22} color={textModeOn ? '#FFFFFF' : 'rgba(255,255,255,0.55)'} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.headerTitle}>Haitian AI</Text>
            {phase === 'active' ? (
              <Text style={styles.timerText}>{isPaused ? 'Paused' : formatDuration(callDuration)}</Text>
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
            <View style={{ marginTop: 18 }}><ConnectingDots /></View>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            {textModeOn && (messages.length > 0 || isAITyping) ? (
              <ScrollView ref={scrollRef} style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16 }} showsVerticalScrollIndicator={false}>
                {messages.map((msg, i) =>
                  msg.role === 'user'
                    ? <UserBubble key={i} content={msg.content} timestamp={msg.timestamp} />
                    : <AnimatedAIBubble key={i} content={msg.content} timestamp={msg.timestamp} />
                )}
                {isAITyping ? <TypingIndicator /> : null}
                <View style={{ height: 24 }} />
              </ScrollView>
            ) : (
              <View style={{ flex: 1, position: 'relative' }}>
                <GlowingOrb isAISpeaking={isAISpeaking} isUserSpeaking={isUserSpeaking} />
                {currentAIText ? (
                  <View style={styles.spokenTextWrap} pointerEvents="none">
                    <Text style={styles.spokenText} numberOfLines={4}>{currentAIText}</Text>
                  </View>
                ) : null}
              </View>
            )}

            {/* Language Detection Badge */}
            <LanguageBadge lang={detectedLanguage} />

            {/* Status / interrupt */}
            <View style={{ alignItems: 'center', paddingBottom: 10 }}>
              {isAISpeaking && allowInterrupt ? (
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

            <View style={{ alignItems: 'center', paddingBottom: 20 }}>
              <ConnectingDots />
            </View>
          </View>
        )}

        {/* CALL ENDED BANNER */}
        {callEnded && phase === 'ended' ? (
          <CallEndedBanner 
            duration={callDuration} 
            onDismiss={() => setCallEnded(false)} 
            onFeedback={(t) => {
              console.log('Feedback:', t);
            }} 
          />
        ) : null}

        {/* CONTROLS */}
        <View style={[styles.controls, { paddingBottom: insets.bottom + 12 }]}>
          <View style={{ alignItems: 'center' }}>
            <TouchableOpacity style={styles.endBtn} onPress={() => handleEnd(true)} activeOpacity={0.8}>
              <Ionicons name="call" size={28} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} />
            </TouchableOpacity>
            <Text style={styles.ctrlLabel}>End</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <TouchableOpacity style={[styles.pauseBtn, isPaused && styles.pauseBtnActive]} onPress={handlePause} disabled={phase !== 'active'} activeOpacity={0.8}>
              {isPaused ? (
                <Ionicons name="play" size={26} color="#FFFFFF" />
              ) : (
                <View style={{ flexDirection: 'row', gap: 5 }}>
                  <View style={{ width: 5, height: 26, backgroundColor: '#FFF', borderRadius: 3 }} />
                  <View style={{ width: 5, height: 26, backgroundColor: '#FFF', borderRadius: 3 }} />
                </View>
              )}
            </TouchableOpacity>
            <Text style={styles.ctrlLabel}>{isPaused ? 'Resume' : 'Pause'}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.keyboardRow, { bottom: insets.bottom + 5 }]}
          onPress={() => setShowKeyboard(prev => !prev)}
        >
          <Ionicons name="keypad-outline" size={15} color="rgba(255,255,255,0.45)" />
          <Text style={styles.keyboardText}>
            {showKeyboard ? 'Tap to hide keyboard' : 'Tap to show keyboard'}
          </Text>
        </TouchableOpacity>

        {showKeyboard ? (
          <BlurView intensity={80} tint="dark" style={[styles.inputBar, { paddingBottom: insets.bottom + 14 }]}>
            <TouchableOpacity
              style={[styles.voiceMicBtn, { backgroundColor: isUserSpeaking ? '#10A37F' : 'rgba(255,255,255,0.12)' }]}
              onPress={() => { if (isUserSpeaking) { stopAndProcess(); } else if (!isPaused && phase === 'active') { startListening(); } }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name={isUserSpeaking ? 'mic' : 'mic-outline'} size={18} color={isUserSpeaking ? '#FFF' : 'rgba(255,255,255,0.7)'} />
            </TouchableOpacity>
            <TextInput
              style={styles.textInput}
              placeholder="Type to Haitian AI — I will speak back"
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={userInput}
              onChangeText={setUserInput}
              onSubmitEditing={handleSendText}
              returnKeyType="send"
              autoFocus
              blurOnSubmit={false}
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
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 10 },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#FFF', textAlign: 'center' },
  timerText: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 2, textAlign: 'center' },
  connectingText: { fontSize: 18, color: 'rgba(255,255,255,0.75)', fontWeight: '400', letterSpacing: 0.3, marginBottom: 6 },
  toastWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  toast: { paddingHorizontal: 28, paddingVertical: 14, borderRadius: 22, overflow: 'hidden' },
  toastText: { color: '#FFF', fontSize: 16, fontWeight: '500' },
  spokenTextWrap: { position: 'absolute', left: 24, right: 24, top: '35%' },
  spokenText: { color: '#FFF', fontSize: 22, fontWeight: '400', lineHeight: 32 },
  interruptBtn: { paddingHorizontal: 20, paddingVertical: 8 },
  interruptText: { color: 'rgba(255,255,255,0.75)', fontSize: 16, fontWeight: '400' },
  statusText: { color: 'rgba(255,255,255,0.6)', fontSize: 15, fontWeight: '400', letterSpacing: 0.2 },
  controls: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 60, paddingTop: 16 },
  endBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#E8490A', alignItems: 'center', justifyContent: 'center', shadowColor: '#E8490A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
  pauseBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  pauseBtnActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  ctrlLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 14, marginTop: 8, fontWeight: '400' },
  keyboardRow: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 6 },
  keyboardText: { fontSize: 13, color: 'rgba(255,255,255,0.4)' },
  voiceMicBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  inputBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, gap: 10, overflow: 'hidden' },
  textInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 28, paddingHorizontal: 18, paddingVertical: 13, fontSize: 16, color: '#FFF', maxHeight: 100 },
  sendBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#007AFF', alignItems: 'center', justifyContent: 'center' },
});
