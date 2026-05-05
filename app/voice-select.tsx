import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { useSettings } from '../hooks/useSettings';
import { useAlert, getSupabaseClient } from '@/template';
import { useTheme } from '../hooks/useTheme';

// ── ElevenLabs Voice Definition ──────────────────────────────────────────────
interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  description: string;
  gender: 'male' | 'female' | 'neutral';
  accent: string;
  color: string;
  preview_url?: string;
  avatar_url?: string;
}

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

const PALETTE = ['#007AFF','#FF2D55','#5856D6','#FF9F0A','#10A37F','#BF5AF2','#00C7BE','#FFD60A','#FF6B35','#34C759','#5AC8FA','#FF6B6B'];

// Curated ElevenLabs-only fallback voices (NO OpenAI)
const FALLBACK_VOICES: ElevenLabsVoice[] = [
  { voice_id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam',    description: 'Warm, deep male — American English',           gender: 'male',   accent: 'American', color: '#007AFF', avatar_url: VOICE_AVATARS['pNInz6obpgDQGcFmaJgB'] },
  { voice_id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel',  description: 'Warm, friendly female — American English',      gender: 'female', accent: 'American', color: '#FF2D55', avatar_url: VOICE_AVATARS['21m00Tcm4TlvDq8ikWAM'] },
  { voice_id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi',    description: 'Bright, upbeat female — American English',      gender: 'female', accent: 'American', color: '#FFD60A', avatar_url: VOICE_AVATARS['AZnzlk1XvdvUeBnXmlld'] },
  { voice_id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella',   description: 'Soft, gentle female — American English',        gender: 'female', accent: 'American', color: '#FF6B6B', avatar_url: VOICE_AVATARS['EXAVITQu4vr4xnSDxMaL'] },
  { voice_id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold',  description: 'Calm, clear male — American English',           gender: 'male',   accent: 'American', color: '#5856D6', avatar_url: VOICE_AVATARS['VR6AewLTigWG4xSOukaG'] },
  { voice_id: 'GBv7mTt0atIp3Br8iCZE', name: 'Thomas',  description: 'Deep, authoritative male — American English',   gender: 'male',   accent: 'American', color: '#636366', avatar_url: VOICE_AVATARS['GBv7mTt0atIp3Br8iCZE'] },
  { voice_id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam',     description: 'Expressive, energetic male — British English',  gender: 'male',   accent: 'British',  color: '#FF9F0A', avatar_url: VOICE_AVATARS['yoZ06aMxZJJ28mfd3POQ'] },
  { voice_id: 'ThT5KcBeYPX3keUQqHPh', name: 'Dorothy', description: 'Wise, clear female — British English',          gender: 'female', accent: 'British',  color: '#10A37F', avatar_url: VOICE_AVATARS['ThT5KcBeYPX3keUQqHPh'] },
  { voice_id: 'pqHfZKP75CvOlQylNhV4', name: 'Bill',    description: 'Professional deep male — American English',     gender: 'male',   accent: 'American', color: '#34C759', avatar_url: VOICE_AVATARS['pqHfZKP75CvOlQylNhV4'] },
  { voice_id: 'PzuBz8h2SxBvQ7lnUC44', name: 'Aria',    description: 'Expressive library voice — ElevenLabs',         gender: 'female', accent: 'Custom',   color: '#BF5AF2' },
  { voice_id: 'jv41DhCf464zw0TI7I1w', name: 'Marcus',  description: 'Confident library voice — ElevenLabs',          gender: 'male',   accent: 'Custom',   color: '#FF6B35' },
  { voice_id: 'kJKMPwrIKzwVkMKOfRtr', name: 'Sofia',   description: 'Natural library voice — ElevenLabs',            gender: 'female', accent: 'Custom',   color: '#00C7BE' },
  { voice_id: 'flHkNRp1BlvT73UL6gyz', name: 'Ryan',    description: 'Dynamic library voice — ElevenLabs',            gender: 'male',   accent: 'Custom',   color: '#FF9F0A' },
  { voice_id: 'mRdG9GYEjJmIzqbYTidv', name: 'Luna',    description: 'Smooth library voice — ElevenLabs',             gender: 'female', accent: 'Custom',   color: '#5AC8FA' },
];

const GENDER_COLORS: Record<string, string> = { male: '#007AFF', female: '#FF2D55', neutral: '#636366' };

// ── Avatar ────────────────────────────────────────────────────────────────────
function VoiceAvatar({ voice, size = 52, selected, accent }: { voice: ElevenLabsVoice; size?: number; selected: boolean; accent: string }) {
  const [imgErr, setImgErr] = useState(false);
  const avatarUrl = voice.avatar_url || VOICE_AVATARS[voice.voice_id];
  const genderColor = GENDER_COLORS[voice.gender] || '#636366';
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: selected ? accent : 'transparent', backgroundColor: voice.color + '22', alignItems: 'center', justifyContent: 'center' }}>
      {avatarUrl && !imgErr ? (
        <Image source={{ uri: avatarUrl }} style={{ width: size - 4, height: size - 4, borderRadius: (size - 4) / 2 }} contentFit="cover" onError={() => setImgErr(true)} />
      ) : (
        <Text style={{ fontSize: size * 0.36, fontWeight: '700', color: voice.color }}>{(voice.name[0] || '?').toUpperCase()}</Text>
      )}
      <View style={{ position: 'absolute', bottom: -1, right: -1, width: 16, height: 16, borderRadius: 8, backgroundColor: genderColor, borderWidth: 2, borderColor: '#FFF' }} />
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function VoiceSelectScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const { settings, updateSetting } = useSettings();
  const { colors, isDark } = useTheme();
  const supabase = getSupabaseClient();

  const [selectedVoice, setSelectedVoice] = useState<string>(
    (settings as any).voiceSelection || (settings as any).voice_selection || 'pNInz6obpgDQGcFmaJgB'
  );
  const [voices, setVoices] = useState<ElevenLabsVoice[]>(FALLBACK_VOICES);
  const [loadingVoices, setLoadingVoices] = useState(true);
  const [voiceLoadError, setVoiceLoadError] = useState(false);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const accent = (settings as any).accentColor || colors.primary;

  // Theme tokens
  const bg = isDark ? '#000000' : '#F2F2F7';
  const headerBg = isDark ? '#000000' : '#F2F2F7';
  const cardBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const border = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';
  const textC = isDark ? '#FFFFFF' : '#000000';
  const subC = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)';
  const surface = isDark ? '#2C2C2E' : '#E5E5EA';

  useEffect(() => {
    fetchVoices();
    return () => { soundRef.current?.unloadAsync().catch(() => {}); try { Speech.stop(); } catch {} };
  }, []);

  const fetchVoices = async () => {
    setLoadingVoices(true);
    setVoiceLoadError(false);
    try {
      const { data, error } = await supabase.functions.invoke('generate-tts', { body: { action: 'list_voices' } });
      if (error || !data?.voices || !Array.isArray(data.voices) || data.voices.length === 0) throw new Error('no voices');
      const apiVoices: ElevenLabsVoice[] = data.voices.map((v: any, i: number) => ({
        voice_id: v.voice_id,
        name: v.name || `Voice ${i + 1}`,
        description: v.description || [v.labels?.description, v.labels?.use_case, v.labels?.accent].filter(Boolean).join(' — ') || 'ElevenLabs voice',
        gender: (v.labels?.gender === 'male' ? 'male' : v.labels?.gender === 'female' ? 'female' : 'neutral') as 'male' | 'female' | 'neutral',
        accent: v.labels?.accent || 'English',
        color: PALETTE[i % PALETTE.length],
        preview_url: v.preview_url,
        avatar_url: v.preview_image_url || VOICE_AVATARS[v.voice_id] || undefined,
      }));
      setVoices(apiVoices);
    } catch {
      setVoices(FALLBACK_VOICES);
      setVoiceLoadError(true);
    } finally {
      setLoadingVoices(false);
    }
  };

  const playPreview = useCallback(async (voice: ElevenLabsVoice) => {
    if (soundRef.current) {
      try { await soundRef.current.stopAsync(); await soundRef.current.unloadAsync(); } catch {}
      soundRef.current = null;
    }
    try { Speech.stop(); } catch {}
    if (playingVoice === voice.voice_id) { setPlayingVoice(null); return; }
    setPlayingVoice(voice.voice_id);
    const previewText = `Hello! I am ${voice.name}. How can I help you today?`;
    try {
      if (voice.preview_url) {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true, staysActiveInBackground: false });
        const { sound } = await Audio.Sound.createAsync({ uri: voice.preview_url }, { shouldPlay: true, volume: 1.0 });
        soundRef.current = sound;
        sound.setOnPlaybackStatusUpdate((s) => {
          if (s.isLoaded && s.didJustFinish) { sound.unloadAsync().catch(() => {}); soundRef.current = null; setPlayingVoice(null); }
        });
        return;
      }
      const { data } = await supabase.functions.invoke('generate-tts', { body: { text: previewText, voice: voice.voice_id } });
      const audioUrl = data?.audioUrl || data?.audio_url;
      if (!audioUrl) { Speech.speak(previewText, { language: 'en-US', onDone: () => setPlayingVoice(null) }); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true, staysActiveInBackground: false });
      const { sound } = await Audio.Sound.createAsync({ uri: audioUrl }, { shouldPlay: true, volume: 1.0 });
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((s) => {
        if (s.isLoaded && s.didJustFinish) { sound.unloadAsync().catch(() => {}); soundRef.current = null; setPlayingVoice(null); }
      });
    } catch { Speech.speak(previewText, { language: 'en-US', onDone: () => setPlayingVoice(null) }); }
  }, [playingVoice, supabase]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await updateSetting('voiceSelection' as any, selectedVoice);
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess?.session?.user?.id;
      if (uid) {
        await supabase.from('user_settings').update({ voice_selection: selectedVoice, updated_at: new Date().toISOString() }).eq('user_id', uid).catch(() => {});
      }
      showAlert('Saved', 'Voice saved successfully.');
      router.back();
    } catch {
      showAlert('Error', 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [selectedVoice, updateSetting, supabase, showAlert, router]);

  const selectedInfo = voices.find(v => v.voice_id === selectedVoice);

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: headerBg, borderBottomColor: border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={22} color={textC} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textC }]}>Select Voice</Text>
        <TouchableOpacity
          onPress={handleSave}
          style={[styles.saveBtn, { backgroundColor: accent, opacity: saving ? 0.7 : 1 }]}
          disabled={saving}
        >
          {saving ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.saveBtnText}>Save</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}>

        {/* ElevenLabs badge */}
        <View style={[styles.badgeRow, { borderBottomColor: border }]}>
          <View style={[styles.badge, { backgroundColor: isDark ? 'rgba(191,90,242,0.15)' : 'rgba(191,90,242,0.1)', borderColor: '#BF5AF255' }]}>
            <Ionicons name="mic-circle" size={16} color="#BF5AF2" />
            <Text style={[styles.badgeText, { color: '#BF5AF2' }]}>Powered by ElevenLabs AI</Text>
          </View>
          <Text style={[styles.badgeDesc, { color: subC }]}>
            {loadingVoices ? 'Loading voices...' : voiceLoadError ? `${voices.length} offline voices — tap ↻ to retry` : `${voices.length} voices available`}
          </Text>
        </View>

        {/* Selected voice test card */}
        {selectedInfo ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 }}>
            <Text style={[styles.sectionLabel, { color: subC }]}>Currently Selected</Text>
            <TouchableOpacity
              style={[styles.testCard, { backgroundColor: cardBg, borderColor: accent + '66' }]}
              onPress={() => playPreview(selectedInfo)}
              activeOpacity={0.82}
            >
              <VoiceAvatar voice={selectedInfo} size={44} selected accent={accent} />
              {playingVoice === selectedVoice ? (
                <>
                  <ActivityIndicator size="small" color={accent} style={{ marginLeft: 12 }} />
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={[styles.testCardTitle, { color: accent }]}>Playing preview…</Text>
                    <Text style={[styles.testCardSub, { color: subC }]}>Tap to stop</Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.testCardTitle, { color: textC }]}>Test "{selectedInfo.name}"</Text>
                    <Text style={[styles.testCardSub, { color: subC }]}>Tap to hear preview</Text>
                  </View>
                  <Ionicons name="play-circle" size={30} color={accent} />
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Voice list */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={[styles.sectionLabel, { color: subC }]}>All Voices</Text>
            <TouchableOpacity onPress={fetchVoices} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="refresh" size={18} color={subC} />
            </TouchableOpacity>
          </View>

          {loadingVoices ? (
            <View style={{ alignItems: 'center', paddingVertical: 48 }}>
              <ActivityIndicator size="large" color={accent} />
              <Text style={[styles.loadingText, { color: subC }]}>Loading ElevenLabs voices…</Text>
            </View>
          ) : (
            voices.map((voice) => {
              const isSel = selectedVoice === voice.voice_id;
              const isPlay = playingVoice === voice.voice_id;
              return (
                <TouchableOpacity
                  key={voice.voice_id}
                  style={[styles.voiceCard, { backgroundColor: isSel ? accent + '15' : cardBg, borderColor: isSel ? accent : border }]}
                  onPress={() => setSelectedVoice(voice.voice_id)}
                  activeOpacity={0.82}
                >
                  <VoiceAvatar voice={voice} size={52} selected={isSel} accent={accent} />
                  <View style={{ flex: 1, marginLeft: 13 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <Text style={[styles.voiceName, { color: textC }]}>{voice.name}</Text>
                      {voice.accent && voice.accent !== 'Custom' ? (
                        <View style={[styles.tag, { backgroundColor: voice.color + '22' }]}>
                          <Text style={[styles.tagText, { color: voice.color }]}>{voice.accent}</Text>
                        </View>
                      ) : null}
                      {voice.accent === 'Custom' ? (
                        <View style={[styles.tag, { backgroundColor: '#BF5AF222' }]}>
                          <Text style={[styles.tagText, { color: '#BF5AF2' }]}>Library</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={[styles.voiceDesc, { color: subC }]} numberOfLines={2}>{voice.description}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 6 }}>
                    {isSel ? (
                      <View style={[styles.checkCircle, { backgroundColor: accent }]}>
                        <Ionicons name="checkmark" size={12} color="#FFF" />
                      </View>
                    ) : null}
                    <TouchableOpacity
                      style={[styles.playBtn, { backgroundColor: isSel ? accent + '22' : surface }]}
                      onPress={() => playPreview(voice)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      {isPlay
                        ? <ActivityIndicator size="small" color={accent} />
                        : <Ionicons name="play" size={16} color={isSel ? accent : subC} />}
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Info card */}
        <View style={[styles.infoCard, { backgroundColor: cardBg, borderColor: border }]}>
          <Ionicons name="information-circle-outline" size={18} color={accent} />
          <Text style={[styles.infoText, { color: subC }]}>
            All voices are powered exclusively by ElevenLabs AI. Tap the play button to preview any voice before selecting. Your choice applies everywhere voice is used in the app.
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
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  saveBtn: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20, minWidth: 60, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  badgeRow: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, gap: 6 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  badgeText: { fontSize: 13, fontWeight: '600' },
  badgeDesc: { fontSize: 13 },
  sectionLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  testCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 18, borderWidth: 1.5 },
  testCardTitle: { fontSize: 16, fontWeight: '600' },
  testCardSub: { fontSize: 12, marginTop: 2 },
  loadingText: { fontSize: 14, marginTop: 14 },
  voiceCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 18, borderWidth: 1.5, marginBottom: 10 },
  voiceName: { fontSize: 15, fontWeight: '700' },
  voiceDesc: { fontSize: 12, lineHeight: 17 },
  tag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  tagText: { fontSize: 10, fontWeight: '700' },
  checkCircle: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  playBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, margin: 16, marginTop: 8 },
  infoText: { flex: 1, fontSize: 13, lineHeight: 19 },
});
