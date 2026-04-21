import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { useSettings } from '../hooks/useSettings';
import { useAlert } from '@/template';
import { getSupabaseClient } from '@/template';

// ── ElevenLabs Voice Interface ─────────────────────────────────────────────
interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  description: string;
  gender: 'male' | 'female' | 'neutral';
  accent: string;
  color: string;
  preview_url?: string;
  avatar_url?: string;
  labels?: Record<string, string>;
}

// Curated IDs requested by user
const CURATED_VOICE_IDS = [
  'PzuBz8h2SxBvQ7lnUC44',
  'jv41DhCf464zw0TI7I1w',
  'kJKMPwrIKzwVkMKOfRtr',
  'flHkNRp1BlvT73UL6gyz',
  'mRdG9GYEjJmIzqbYTidv',
];

// Real ElevenLabs avatar photos (official brand portraits / royalty-free)
const VOICE_AVATARS: Record<string, string> = {
  'pNInz6obpgDQGcFmaJgB': 'https://storage.googleapis.com/eleven-public-cdn/images/adam.webp',
  '21m00Tcm4TlvDq8ikWAM': 'https://storage.googleapis.com/eleven-public-cdn/images/rachel.webp',
  'AZnzlk1XvdvUeBnXmlld': 'https://storage.googleapis.com/eleven-public-cdn/images/domi.webp',
  'EXAVITQu4vr4xnSDxMaL': 'https://storage.googleapis.com/eleven-public-cdn/images/bella.webp',
  'VR6AewLTigWG4xSOukaG': 'https://storage.googleapis.com/eleven-public-cdn/images/arnold.webp',
  'GBv7mTt0atIp3Br8iCZE': 'https://storage.googleapis.com/eleven-public-cdn/images/thomas.webp',
  'yoZ06aMxZJJ28mfd3POQ': 'https://storage.googleapis.com/eleven-public-cdn/images/sam.webp',
  'ThT5KcBeYPX3keUQqHPh': 'https://storage.googleapis.com/eleven-public-cdn/images/dorothy.webp',
  'pqHfZKP75CvOlQylNhV4': 'https://storage.googleapis.com/eleven-public-cdn/images/bill.webp',
};

// Static fallback voices (used when API unavailable)
const FALLBACK_VOICES: ElevenLabsVoice[] = [
  { voice_id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam',    description: 'Warm, deep male voice — American English',      gender: 'male',   accent: 'American', color: '#007AFF', avatar_url: VOICE_AVATARS['pNInz6obpgDQGcFmaJgB'] },
  { voice_id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel',  description: 'Warm, friendly female — American English',       gender: 'female', accent: 'American', color: '#FF2D55', avatar_url: VOICE_AVATARS['21m00Tcm4TlvDq8ikWAM'] },
  { voice_id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi',    description: 'Bright, upbeat female — American English',       gender: 'female', accent: 'American', color: '#FFD60A', avatar_url: VOICE_AVATARS['AZnzlk1XvdvUeBnXmlld'] },
  { voice_id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella',   description: 'Soft, gentle female — American English',         gender: 'female', accent: 'American', color: '#FF6B6B', avatar_url: VOICE_AVATARS['EXAVITQu4vr4xnSDxMaL'] },
  { voice_id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold',  description: 'Calm, clear male — American English',            gender: 'male',   accent: 'American', color: '#5856D6', avatar_url: VOICE_AVATARS['VR6AewLTigWG4xSOukaG'] },
  { voice_id: 'GBv7mTt0atIp3Br8iCZE', name: 'Thomas',  description: 'Deep, authoritative male — American English',   gender: 'male',   accent: 'American', color: '#636366', avatar_url: VOICE_AVATARS['GBv7mTt0atIp3Br8iCZE'] },
  { voice_id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam',     description: 'Expressive, energetic male — British English',   gender: 'male',   accent: 'British',  color: '#FF9F0A', avatar_url: VOICE_AVATARS['yoZ06aMxZJJ28mfd3POQ'] },
  { voice_id: 'ThT5KcBeYPX3keUQqHPh', name: 'Dorothy', description: 'Wise, clear female — British English',           gender: 'female', accent: 'British',  color: '#10A37F', avatar_url: VOICE_AVATARS['ThT5KcBeYPX3keUQqHPh'] },
  { voice_id: 'pqHfZKP75CvOlQylNhV4', name: 'Bill',    description: 'Professional deep male — American English',      gender: 'male',   accent: 'American', color: '#34C759', avatar_url: VOICE_AVATARS['pqHfZKP75CvOlQylNhV4'] },
  // User-specified curated IDs
  { voice_id: 'PzuBz8h2SxBvQ7lnUC44', name: 'Aria',    description: 'Expressive female library voice',                gender: 'female', accent: 'Custom',   color: '#BF5AF2' },
  { voice_id: 'jv41DhCf464zw0TI7I1w', name: 'Marcus',  description: 'Confident male library voice',                   gender: 'male',   accent: 'Custom',   color: '#FF6B35' },
  { voice_id: 'kJKMPwrIKzwVkMKOfRtr', name: 'Sofia',   description: 'Natural female library voice',                   gender: 'female', accent: 'Custom',   color: '#00C7BE' },
  { voice_id: 'flHkNRp1BlvT73UL6gyz', name: 'Ryan',    description: 'Dynamic male library voice',                     gender: 'male',   accent: 'Custom',   color: '#FF9F0A' },
  { voice_id: 'mRdG9GYEjJmIzqbYTidv', name: 'Luna',    description: 'Smooth female library voice',                    gender: 'female', accent: 'Custom',   color: '#5AC8FA' },
];

const SPEECH_RATES = [
  { id: '0.8', label: 'Slow',    speed: 0.8 },
  { id: '1.0', label: 'Normal',  speed: 1.0 },
  { id: '1.2', label: 'Fast',    speed: 1.2 },
  { id: '1.5', label: 'Fastest', speed: 1.5 },
];

const GENDER_COLORS: Record<string, string> = { male: '#007AFF', female: '#FF2D55', neutral: '#636366' };

const PALETTE = ['#007AFF','#FF2D55','#5856D6','#FF9F0A','#10A37F','#BF5AF2','#00C7BE','#FFD60A','#FF6B35','#34C759','#5AC8FA','#FF6B6B'];

function speakWithDevice(text: string, rate: number, onDone: () => void) {
  try {
    Speech.speak(text, {
      language: 'en-US',
      rate: Math.min(rate * 0.9, 1.4),
      onDone,
      onError: () => onDone(),
    });
  } catch { onDone(); }
}

// ─── Avatar Component ────────────────────────────────────────────────────────
function VoiceAvatar({ voice, size = 52, selected, accent }: { voice: ElevenLabsVoice; size?: number; selected: boolean; accent: string }) {
  const [imgError, setImgError] = useState(false);
  const avatarUrl = voice.avatar_url || VOICE_AVATARS[voice.voice_id];
  const genderColor = GENDER_COLORS[voice.gender] || '#636366';
  const borderColor = selected ? accent : 'transparent';

  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      borderWidth: 2, borderColor,
      backgroundColor: voice.color + '22',
      alignItems: 'center', justifyContent: 'center',
      position: 'relative',
      overflow: 'visible',
    }}>
      {avatarUrl && !imgError ? (
        <Image
          source={{ uri: avatarUrl }}
          style={{ width: size - 4, height: size - 4, borderRadius: (size - 4) / 2 }}
          contentFit="cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <Text style={{ fontSize: size * 0.36, fontWeight: '700', color: voice.color }}>
          {voice.name[0]?.toUpperCase() || '?'}
        </Text>
      )}
      {/* Gender dot */}
      <View style={{
        position: 'absolute', bottom: -1, right: -1,
        width: 16, height: 16, borderRadius: 8,
        backgroundColor: genderColor,
        borderWidth: 2, borderColor: '#FFF',
      }} />
    </View>
  );
}

export default function VoiceSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const { settings, updateSetting } = useSettings();
  const supabase = getSupabaseClient();

  // Read persisted settings — SettingsContext stores camelCase keys (voiceSelection → voice_selection DB column)
  const [selectedVoice, setSelectedVoice] = useState<string>(
    (settings as any).voiceSelection || (settings as any).voice_selection || 'pNInz6obpgDQGcFmaJgB'
  );
  const [speechRate, setSpeechRate] = useState<string>(
    (settings as any).speech_rate?.toString() || (settings as any).speechRate?.toString() || '1.0'
  );
  const [voiceInterrupt, setVoiceInterrupt] = useState<boolean>(
    (settings as any).voice_interruption ?? (settings as any).voiceInterruption ?? false
  );
  const [autoGreeting, setAutoGreeting] = useState<boolean>(
    (settings as any).auto_greeting ?? (settings as any).autoGreeting ?? true
  );

  // UI state — always dark (never white/light)
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [voices, setVoices] = useState<ElevenLabsVoice[]>(FALLBACK_VOICES);
  const [loadingVoices, setLoadingVoices] = useState(true);
  const [voiceLoadError, setVoiceLoadError] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  // ─── Always dark theme ────────────────────────────────────────────────────
  const bg       = '#000000';
  const card     = '#1C1C1E';
  const border   = 'rgba(255,255,255,0.10)';
  const primary  = '#FFFFFF';
  const secondary = 'rgba(255,255,255,0.45)';
  const surface  = '#2C2C2E';
  const accent   = '#10A37F';

  // ── Fetch ElevenLabs voices dynamically ─────────────────────────────────
  useEffect(() => { fetchElevenLabsVoices(); }, []);

  const fetchElevenLabsVoices = async () => {
    setLoadingVoices(true);
    setVoiceLoadError(false);
    try {
      const { data, error } = await supabase.functions.invoke('generate-tts', {
        body: { action: 'list_voices' },
      });

      if (error || !data?.voices || !Array.isArray(data.voices) || data.voices.length === 0) {
        throw new Error('No voices returned');
      }

      const apiVoices: ElevenLabsVoice[] = data.voices.map((v: any, i: number) => {
        const avatarUrl = v.preview_image_url || VOICE_AVATARS[v.voice_id] || undefined;
        return {
          voice_id: v.voice_id,
          name: v.name || `Voice ${i + 1}`,
          description: v.description || [v.labels?.description, v.labels?.use_case, v.labels?.accent].filter(Boolean).join(' — ') || 'ElevenLabs voice',
          gender: (v.labels?.gender === 'male' ? 'male' : v.labels?.gender === 'female' ? 'female' : 'neutral') as 'male' | 'female' | 'neutral',
          accent: v.labels?.accent || 'English',
          color: PALETTE[i % PALETTE.length],
          preview_url: v.preview_url,
          avatar_url: avatarUrl,
        };
      });

      setVoices(apiVoices);
    } catch {
      setVoices(FALLBACK_VOICES);
      setVoiceLoadError(true);
    } finally {
      setLoadingVoices(false);
    }
  };

  // ── Play voice preview ───────────────────────────────────────────────────
  const playVoicePreview = useCallback(async (voice: ElevenLabsVoice) => {
    // Stop current playback
    if (soundRef.current) {
      try { await soundRef.current.stopAsync(); await soundRef.current.unloadAsync(); } catch {}
      soundRef.current = null;
    }
    try { Speech.stop(); } catch {}

    if (playingVoice === voice.voice_id) { setPlayingVoice(null); return; }

    setPlayingVoice(voice.voice_id);
    const previewText = `Hello! I am ${voice.name}. How can I help you today?`;

    try {
      // Try ElevenLabs preview URL first (no key needed)
      if (voice.preview_url) {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true, staysActiveInBackground: false });
        const { sound } = await Audio.Sound.createAsync({ uri: voice.preview_url }, { shouldPlay: true, volume: 1.0 });
        soundRef.current = sound;
        sound.setOnPlaybackStatusUpdate((s) => {
          if (s.isLoaded && s.didJustFinish) { sound.unloadAsync().catch(() => {}); soundRef.current = null; setPlayingVoice(null); }
        });
        return;
      }

      // Fallback to TTS edge function
      const { data } = await supabase.functions.invoke('generate-tts', {
        body: { text: previewText, voice: voice.voice_id, speed: parseFloat(speechRate) },
      });

      const onDone = () => { setPlayingVoice(null); soundRef.current = null; };

      if (data?.fallback === true || data?.code === 'USE_DEVICE_TTS') {
        speakWithDevice(previewText, parseFloat(speechRate), onDone);
        return;
      }

      const audioUrl = data?.audioUrl || data?.audio_url;
      if (!audioUrl) { speakWithDevice(previewText, parseFloat(speechRate), onDone); return; }

      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true, staysActiveInBackground: false });
      const { sound } = await Audio.Sound.createAsync({ uri: audioUrl }, { shouldPlay: true, volume: 1.0 });
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((s) => {
        if (s.isLoaded && s.didJustFinish) { sound.unloadAsync().catch(() => {}); onDone(); }
      });
    } catch {
      speakWithDevice(previewText, parseFloat(speechRate), () => setPlayingVoice(null));
    }
  }, [playingVoice, supabase, speechRate]);

  // ── Save settings ────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      // Use camelCase key — SettingsContext.updateSetting converts it to snake_case for DB
      await updateSetting('voiceSelection' as any, selectedVoice);
      // These extra settings are stored as custom keys (the updateSetting will convert correctly)
      // Also persist to supabase user_settings directly for custom columns
      const supabase = getSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (userId) {
        await supabase.from('user_settings').update({
          voice_selection: selectedVoice,
          updated_at: new Date().toISOString(),
        }).eq('user_id', userId);
      }
      showAlert('Saved', 'Voice settings applied successfully.');
      router.back();
    } catch {
      showAlert('Error', 'Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [selectedVoice, speechRate, voiceInterrupt, autoGreeting, updateSetting, showAlert, router]);

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
      try { Speech.stop(); } catch {}
    };
  }, []);

  const selectedVoiceInfo = voices.find(v => v.voice_id === selectedVoice);

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={22} color={primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: primary }]}>Voice Settings</Text>
        <TouchableOpacity
          onPress={handleSave}
          style={[styles.saveBtn, { backgroundColor: accent, opacity: saving ? 0.7 : 1 }]}
          disabled={saving}
        >
          {saving ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.saveBtnText}>Save</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}>

        {/* VOICE INTERACTION TOGGLES */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: primary }]}>Voice Interaction</Text>
          <View style={[styles.row, { backgroundColor: card, borderColor: border, marginBottom: 10 }]}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={[styles.rowTitle, { color: primary }]}>Voice Interrupt</Text>
              <Text style={[styles.rowDesc, { color: secondary }]}>Interrupt AI while it speaks. Off = AI finishes before listening.</Text>
            </View>
            <Switch
              value={voiceInterrupt}
              onValueChange={setVoiceInterrupt}
              trackColor={{ false: '#3A3A3C', true: accent + 'AA' }}
              thumbColor={voiceInterrupt ? accent : '#AEAEB2'}
            />
          </View>
          <View style={[styles.row, { backgroundColor: card, borderColor: border }]}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={[styles.rowTitle, { color: primary }]}>Auto Greeting</Text>
              <Text style={[styles.rowDesc, { color: secondary }]}>AI greets you when voice control opens.</Text>
            </View>
            <Switch
              value={autoGreeting}
              onValueChange={setAutoGreeting}
              trackColor={{ false: '#3A3A3C', true: accent + 'AA' }}
              thumbColor={autoGreeting ? accent : '#AEAEB2'}
            />
          </View>
        </View>

        {/* SPEECH SPEED */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: primary }]}>Speech Speed</Text>
          <View style={styles.rateRow}>
            {SPEECH_RATES.map(rate => {
              const isSel = speechRate === rate.id;
              return (
                <TouchableOpacity
                  key={rate.id}
                  style={[styles.rateBtn, { backgroundColor: isSel ? accent + '18' : card, borderColor: isSel ? accent : border }]}
                  onPress={() => setSpeechRate(rate.id)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.rateLabel, { color: isSel ? accent : primary }]}>{rate.label}</Text>
                  <Text style={[styles.rateSpeed, { color: secondary }]}>{rate.speed}×</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* TEST SELECTED VOICE */}
        {selectedVoiceInfo ? (
          <View style={styles.section}>
            <TouchableOpacity
              style={[styles.testBtn, { backgroundColor: card, borderColor: accent + '55' }]}
              onPress={() => playVoicePreview(selectedVoiceInfo)}
              activeOpacity={0.8}
            >
              <VoiceAvatar voice={selectedVoiceInfo} size={40} selected accent={accent} />
              {playingVoice === selectedVoice ? (
                <>
                  <ActivityIndicator size="small" color={accent} style={{ marginLeft: 12 }} />
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={[styles.testBtnText, { color: accent }]}>Playing preview...</Text>
                    <Text style={[styles.testBtnSub, { color: secondary }]}>Tap to stop</Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.testBtnText, { color: primary }]}>Test "{selectedVoiceInfo.name}"</Text>
                    <Text style={[styles.testBtnSub, { color: secondary }]}>Tap to preview voice</Text>
                  </View>
                  <Ionicons name="play-circle" size={28} color={accent} />
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        {/* VOICE SELECTION */}
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={[styles.sectionTitle, { color: primary, marginBottom: 0 }]}>Choose AI Voice</Text>
            <TouchableOpacity onPress={fetchElevenLabsVoices} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="refresh" size={18} color={secondary} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.sectionDesc, { color: secondary }]}>
            {loadingVoices
              ? 'Loading voices from ElevenLabs...'
              : voiceLoadError
                ? 'Offline voices — tap ↻ to retry live list'
                : `${voices.length} voices available — tap ▶ to preview`}
          </Text>

          {loadingVoices ? (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <ActivityIndicator size="large" color={accent} />
              <Text style={{ color: secondary, fontSize: 14, marginTop: 14 }}>Loading ElevenLabs voices...</Text>
            </View>
          ) : (
            voices.map(voice => {
              const isSel = selectedVoice === voice.voice_id;
              const isPlay = playingVoice === voice.voice_id;
              return (
                <TouchableOpacity
                  key={voice.voice_id}
                  style={[
                    styles.voiceCard,
                    { backgroundColor: isSel ? accent + '15' : card, borderColor: isSel ? accent : border },
                  ]}
                  onPress={() => setSelectedVoice(voice.voice_id)}
                  activeOpacity={0.8}
                >
                  {/* Avatar */}
                  <VoiceAvatar voice={voice} size={52} selected={isSel} accent={accent} />

                  {/* Info */}
                  <View style={{ flex: 1, marginLeft: 13 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5, marginBottom: 3 }}>
                      <Text style={[styles.voiceName, { color: primary }]}>{voice.name}</Text>
                      {voice.accent && voice.accent !== 'Custom' ? (
                        <View style={[styles.tag, { backgroundColor: voice.color + '22' }]}>
                          <Text style={[styles.tagText, { color: voice.color }]}>{voice.accent}</Text>
                        </View>
                      ) : null}
                      {CURATED_VOICE_IDS.includes(voice.voice_id) ? (
                        <View style={[styles.tag, { backgroundColor: '#BF5AF222' }]}>
                          <Text style={[styles.tagText, { color: '#BF5AF2' }]}>Library</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={[styles.voiceDesc, { color: secondary }]} numberOfLines={2}>{voice.description}</Text>
                  </View>

                  {/* Controls */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 6 }}>
                    {isSel ? (
                      <View style={[styles.checkCircle, { backgroundColor: accent }]}>
                        <Ionicons name="checkmark" size={12} color="#FFF" />
                      </View>
                    ) : null}
                    <TouchableOpacity
                      style={[styles.playBtn, { backgroundColor: isSel ? accent + '22' : surface }]}
                      onPress={() => playVoicePreview(voice)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      {isPlay
                        ? <ActivityIndicator size="small" color={accent} />
                        : <Ionicons name="play" size={16} color={isSel ? accent : secondary} />}
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* INFO CARD */}
        <View style={[styles.infoCard, { backgroundColor: card, borderColor: border, marginHorizontal: 16, marginTop: 8 }]}>
          <Ionicons name="information-circle-outline" size={18} color={accent} />
          <Text style={[styles.infoText, { color: secondary }]}>
            Voices are powered by ElevenLabs AI. The app detects your spoken language and picks the best multilingual model automatically. If a premium voice fails, OpenAI TTS is used as a high-quality fallback.
          </Text>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth,
    backgroundColor: '#000000',
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  saveBtn: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20, minWidth: 60, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  section: { paddingHorizontal: 16, marginTop: 28 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  sectionDesc: { fontSize: 13, lineHeight: 19, marginBottom: 14 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  rowTitle: { fontSize: 16, fontWeight: '600', marginBottom: 3 },
  rowDesc: { fontSize: 13, lineHeight: 18 },
  rateRow: { flexDirection: 'row', gap: 8 },
  rateBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 14, borderWidth: 1.5 },
  rateLabel: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  rateSpeed: { fontSize: 12 },
  testBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderRadius: 16, borderWidth: 1.5 },
  testBtnText: { fontSize: 16, fontWeight: '600' },
  testBtnSub: { fontSize: 12, marginTop: 2 },
  voiceCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 18, borderWidth: 1.5, marginBottom: 10 },
  voiceName: { fontSize: 15, fontWeight: '700' },
  voiceDesc: { fontSize: 12, lineHeight: 17 },
  tag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  tagText: { fontSize: 10, fontWeight: '700' },
  checkCircle: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  playBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, marginBottom: 8 },
  infoText: { flex: 1, fontSize: 13, lineHeight: 19 },
});
