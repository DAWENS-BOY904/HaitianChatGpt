import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
  ActivityIndicator,
  Platform,
  Animated,
  PanResponder,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { useSettings } from '../hooks/useSettings';
import { useTheme } from '../hooks/useTheme';
import { useAlert } from '@/template';
import { getSupabaseClient } from '@/template';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ── Real ElevenLabs voices with gradient colors ─────────────────────────────
interface Voice {
  id: string;
  name: string;
  tagline: string;
  gender: 'male' | 'female';
  gradientStart: string;
  gradientEnd: string;
  previewText: string;
}

const REAL_VOICES: Voice[] = [
  {
    id: 'pNInz6obpgDQGcFmaJgB',
    name: 'Adam',
    tagline: 'Deep and authoritative',
    gender: 'male',
    gradientStart: '#1a1a2e',
    gradientEnd: '#16213e',
    previewText: 'Hello! I am Adam, ready to help you with anything.',
    
  },
  {
    id: '21m00Tcm4TlvDq8ikWAM',
    name: 'Rachel',
    tagline: 'Warm and friendly',
    gender: 'female',
    gradientStart: '#0d1b4b',
    gradientEnd: '#1a3a8a',
    previewText: 'Hi there! I am Rachel. How can I assist you today?',
    
  },
  {
    id: 'AZnzlk1XvdvUeBnXmlld',
    name: 'Domi',
    tagline: 'Bright and upbeat',
    gender: 'female',
    gradientStart: '#1e3a5f',
    gradientEnd: '#2d6a9f',
    previewText: 'Hey! Domi here. What can I do for you?',
    
  },
  {
    id: 'EXAVITQu4vr4xnSDxMaL',
    name: 'Bella',
    tagline: 'Soft and gentle',
    gender: 'female',
    gradientStart: '#2c1654',
    gradientEnd: '#4a2b87',
    previewText: 'Hello! I am Bella. I am here to help you.',
    
  },
  {
    id: 'VR6AewLTigWG4xSOukaG',
    name: 'Arnold',
    tagline: 'Clear and professional',
    gender: 'male',
    gradientStart: '#0a3d2e',
    gradientEnd: '#155d40',
    previewText: 'Good day. Arnold speaking. How may I assist you?',
    
  },
  {
    id: 'GBv7mTt0atIp3Br8iCZE',
    name: 'Thomas',
    tagline: 'Calm and reliable',
    gender: 'male',
    gradientStart: '#1a0a2e',
    gradientEnd: '#2d1554',
    previewText: 'Hello. Thomas here. What would you like to know?',
    
  },
  {
    id: 'yoZ06aMxZJJ28mfd3POQ',
    name: 'Sam',
    tagline: 'Energetic and engaging',
    gender: 'male',
    gradientStart: '#3d1a00',
    gradientEnd: '#7a3800',
    previewText: 'Hey! Sam here. Ready to chat anytime!',
    
  },
  {
    id: 'ThT5KcBeYPX3keUQqHPh',
    name: 'Dorothy',
    tagline: 'Wise and articulate',
    gender: 'female',
    gradientStart: '#0d3b3b',
    gradientEnd: '#1a6b6b',
    previewText: 'Hello! Dorothy here. Always happy to help.',
    
  },
  {
    id: 'pqHfZKP75CvOlQylNhV4',
    name: 'Bill',
    tagline: 'Confident and clear',
    gender: 'male',
    gradientStart: '#1a2a0d',
    gradientEnd: '#2d4a15',
    previewText: 'Hi there. Bill speaking. What can I help you with?',
    
  },
];

// ── Animated Orb for each voice ─────────────────────────────────────────────
function VoiceOrb({ voice, isActive, size = 220 }: { voice: Voice; isActive: boolean; size?: number }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (isActive) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.06, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        ])
      );
      const glow = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0.6, duration: 1000, useNativeDriver: true }),
        ])
      );
      pulse.start();
      glow.start();
      return () => { pulse.stop(); glow.stop(); };
    } else {
      pulseAnim.setValue(1);
      glowAnim.setValue(0.6);
    }
  }, [isActive]);

  return (
    <Animated.View style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      transform: [{ scale: pulseAnim }],
      shadowColor: voice.gradientEnd,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 1,
      shadowRadius: 40,
      elevation: 20,
    }}>
      {/* Outer glow ring */}
      <Animated.View style={{
        position: 'absolute',
        width: size + 20,
        height: size + 20,
        borderRadius: (size + 20) / 2,
        borderWidth: 1,
        borderColor: voice.gradientEnd + '44',
        top: -10,
        left: -10,
        opacity: glowAnim,
      }} />
      {/* Main orb — blue/white cloud gradient effect */}
      <View style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: voice.gradientStart,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {/* Cloud-like inner highlights */}
        <View style={{
          position: 'absolute',
          width: size * 0.75,
          height: size * 0.75,
          borderRadius: size * 0.375,
          backgroundColor: voice.gradientEnd,
          top: size * 0.05,
          left: size * 0.125,
          opacity: 0.7,
        }} />
        <View style={{
          position: 'absolute',
          width: size * 0.55,
          height: size * 0.55,
          borderRadius: size * 0.275,
          backgroundColor: 'rgba(150,190,255,0.35)',
          top: size * 0.1,
          left: size * 0.2,
        }} />
        <View style={{
          position: 'absolute',
          width: size * 0.4,
          height: size * 0.4,
          borderRadius: size * 0.2,
          backgroundColor: 'rgba(220,235,255,0.5)',
          top: size * 0.08,
          right: size * 0.15,
        }} />
        {/* White highlight spot */}
        <View style={{
          position: 'absolute',
          width: size * 0.22,
          height: size * 0.22,
          borderRadius: size * 0.11,
          backgroundColor: 'rgba(255,255,255,0.7)',
          top: size * 0.12,
          left: size * 0.28,
        }} />
        {/* Gender icon */}
        <Ionicons
          name={voice.gender === 'female' ? 'person-circle' : 'person'}
          size={size * 0.22}
          color="rgba(255,255,255,0.25)"
          style={{ position: 'absolute', bottom: size * 0.12, right: size * 0.18 }}
        />
      </View>
    </Animated.View>
  );
}

export default function VoiceSelectScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { settings, updateSetting } = useSettings();
  const { isDark } = useTheme();
  const { showAlert } = useAlert();
  const supabase = getSupabaseClient();

  const [currentIndex, setCurrentIndex] = useState(() => {
    const idx = REAL_VOICES.findIndex(v => v.id === settings.voiceSelection);
    return idx >= 0 ? idx : 0;
  });
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const didAutoPlay = useRef(false);

  const currentVoice = REAL_VOICES[currentIndex];

  // Auto-play sample when switching voice
  const playVoiceSample = useCallback(async (voice: Voice) => {
    if (soundRef.current) {
      try { await soundRef.current.stopAsync(); await soundRef.current.unloadAsync(); } catch {}
      soundRef.current = null;
    }
    try { Speech.stop(); } catch {}

    setPlayingId(voice.id);

    const onDone = () => setPlayingId(null);

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
      const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
      let authToken = supabaseAnonKey;
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.access_token) authToken = sessionData.session.access_token;
      } catch {}

      const ttsRes = await fetch(`${supabaseUrl}/functions/v1/generate-tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({ text: voice.previewText, voice: voice.id, speed: 1.0 }),
      }).catch(() => null);

      if (ttsRes && ttsRes.ok) {
        const data = await ttsRes.json().catch(() => null);
        const audioUrl = data?.audioUrl || data?.audio_url;
        if (audioUrl) {
          const { sound } = await Audio.Sound.createAsync({ uri: audioUrl }, { shouldPlay: true, volume: 1.0 });
          soundRef.current = sound;
          sound.setOnPlaybackStatusUpdate((s) => {
            if (s.isLoaded && s.didJustFinish) {
              sound.unloadAsync().catch(() => {});
              soundRef.current = null;
              onDone();
            }
          });
          return;
        }
      }

      // Fallback to device TTS
      Speech.speak(voice.previewText, {
        language: 'en-US',
        rate: 0.95,
        onDone,
        onError: () => onDone(),
      });
    } catch {
      try {
        Speech.speak(voice.previewText, { language: 'en-US', rate: 0.95, onDone, onError: () => onDone() });
      } catch {
        onDone();
      }
    }
  }, [supabase]);

  // Auto-play on first load
  useEffect(() => {
    if (!didAutoPlay.current) {
      didAutoPlay.current = true;
      setTimeout(() => playVoiceSample(REAL_VOICES[currentIndex]), 800);
    }
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
      try { Speech.stop(); } catch {}
    };
  }, []);

  const goTo = useCallback((index: number) => {
    if (index < 0 || index >= REAL_VOICES.length) return;
    setCurrentIndex(index);
    scrollRef.current?.scrollTo({ x: index * SCREEN_W, animated: true });
    setTimeout(() => playVoiceSample(REAL_VOICES[index]), 200);
  }, [playVoiceSample]);

  const handleDone = useCallback(async () => {
    setSaving(true);
    try {
      await updateSetting('voiceSelection', currentVoice.id);
    } catch {}
    setSaving(false);
    router.back();
  }, [currentVoice, updateSetting, router]);

  const handleCancel = useCallback(() => {
    soundRef.current?.unloadAsync().catch(() => {});
    try { Speech.stop(); } catch {}
    router.back();
  }, [router]);

  const handleScroll = useCallback((e: any) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    if (index !== currentIndex && index >= 0 && index < REAL_VOICES.length) {
      setCurrentIndex(index);
      setTimeout(() => playVoiceSample(REAL_VOICES[index]), 150);
    }
  }, [currentIndex, playVoiceSample]);

  // Theme-aware colors
  const rootBg = isDark ? '#000000' : '#F2F2F7';
  const cardBg = isDark ? '#111113' : '#FFFFFF';
  const textColor = isDark ? '#FFFFFF' : '#000000';
  const subTextColor = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)';
  const cancelBg = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';
  const adjNameColor = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.25)';
  const dotBg = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.15)';
  const dotActiveBg = isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.7)';
  const doneBtnBg = isDark ? '#FFFFFF' : '#000000';
  const doneBtnText = isDark ? '#000000' : '#FFFFFF';
  const replayTextColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)';

  return (
    <View style={[styles.root, { backgroundColor: rootBg }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: cancelBg }]} onPress={handleCancel} activeOpacity={0.7}>
          <Text style={[styles.cancelText, { color: textColor }]}>Cancel</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: textColor }]}>Choose a voice</Text>
        <View style={{ width: 80 }} />
      </View>

      {/* Swipeable voice cards */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
        contentOffset={{ x: currentIndex * SCREEN_W, y: 0 }}
      >
        {REAL_VOICES.map((voice, idx) => {
          const isActive = idx === currentIndex;
          return (
            <View key={voice.id} style={[styles.voiceCard, { width: SCREEN_W }]}>
              {/* Adjacent voice names (left/right) */}
              <View style={styles.adjacentRow}>
                {idx > 0 ? (
                  <TouchableOpacity onPress={() => goTo(idx - 1)} style={styles.adjBtn} activeOpacity={0.7}>
                    <Text style={[styles.adjText, { color: adjNameColor }]}>{REAL_VOICES[idx - 1].name}</Text>
                  </TouchableOpacity>
                ) : <View style={{ width: 80 }} />}
                {idx < REAL_VOICES.length - 1 ? (
                  <TouchableOpacity onPress={() => goTo(idx + 1)} style={styles.adjBtn} activeOpacity={0.7}>
                    <Text style={[styles.adjText, { color: adjNameColor }]}>{REAL_VOICES[idx + 1].name}</Text>
                  </TouchableOpacity>
                ) : <View style={{ width: 80 }} />}
              </View>

              {/* Orb */}
              <View style={styles.orbContainer}>
                <VoiceOrb voice={voice} isActive={isActive} size={Math.min(SCREEN_W * 0.6, 240)} />
                {/* Play indicator */}
                {playingId === voice.id ? (
                  <View style={styles.playingBadge}>
                    <View style={styles.speakingDot} />
                    <View style={[styles.speakingDot, { marginHorizontal: 3 }]} />
                    <View style={styles.speakingDot} />
                  </View>
                ) : null}
              </View>

              {/* Voice info */}
              <View style={styles.voiceInfo}>
                <Text style={[styles.voiceName, { color: textColor }]}>{voice.name}</Text>
                <Text style={[styles.voiceTagline, { color: subTextColor }]}>{voice.tagline}</Text>
              </View>

              {/* Replay button */}
              <TouchableOpacity
                style={styles.replayBtn}
                onPress={() => playVoiceSample(voice)}
                activeOpacity={0.7}
              >
                {playingId === voice.id ? (
                  <ActivityIndicator size="small" color={subTextColor} />
                ) : (
                  <Ionicons name="play-circle-outline" size={28} color={subTextColor} />
                )}
                <Text style={[styles.replayText, { color: replayTextColor }]}>
                  {playingId === voice.id ? 'Playing...' : 'Play sample'}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>

      {/* Dot indicators */}
      <View style={styles.dotsRow}>
        {REAL_VOICES.map((_, idx) => (
          <TouchableOpacity key={idx} onPress={() => goTo(idx)} hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}>
            <View style={[
              styles.dot,
              { backgroundColor: dotBg },
              idx === currentIndex && { backgroundColor: dotActiveBg, width: 9, height: 9, borderRadius: 4.5 },
            ]} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Done button */}
      <View style={[styles.doneWrap, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[styles.doneBtn, { backgroundColor: doneBtnBg }, saving && { opacity: 0.7 }]}
          onPress={handleDone}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color={doneBtnText} />
          ) : (
            <Text style={[styles.doneBtnText, { color: doneBtnText }]}>Done</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Bouncing speaking dots animation ─────────────────────────────────────────
function SpeakingDot() {
  const bounce = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: -6, duration: 300, useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0, duration: 300, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={[styles.speakingDot, { transform: [{ translateY: bounce }] }]} />
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  cancelBtn: {
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 9,
    minWidth: 80,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '500',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  voiceCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjacentRow: {
    position: 'absolute',
    top: '30%',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  adjBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  adjText: {
    fontSize: 18,
    fontWeight: '500',
  },
  orbContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  playingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  speakingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  voiceInfo: {
    alignItems: 'center',
    marginBottom: 24,
  },
  voiceName: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  voiceTagline: {
    fontSize: 16,
    textAlign: 'center',
  },
  replayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  replayText: {
    fontSize: 15,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  doneWrap: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  doneBtn: {
    borderRadius: 50,
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    fontSize: 17,
    fontWeight: '700',
  },
});
