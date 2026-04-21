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
  Alert,
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

// ── Real ElevenLabs voice IDs with metadata ────────────────────────────────
interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  description: string;
  gender: 'male' | 'female' | 'neutral';
  accent: string;
  color: string;
  preview_url?: string;
  labels?: Record<string, string>;
}

// Curated set — includes user-specified IDs + library voices
const CURATED_VOICE_IDS = [
  'PzuBz8h2SxBvQ7lnUC44',
  'jv41DhCf464zw0TI7I1w',
  'kJKMPwrIKzwVkMKOfRtr',
  'flHkNRp1BlvT73UL6gyz',
  'mRdG9GYEjJmIzqbYTidv',
];

// Static fallback voices (used when API unavailable)
const FALLBACK_VOICES: ElevenLabsVoice[] = [
  { voice_id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam',    description: 'Warm, deep male voice',      gender: 'male',   accent: 'American', color: '#007AFF' },
  { voice_id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel',  description: 'Warm, friendly female voice', gender: 'female', accent: 'American', color: '#FF2D55' },
  { voice_id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi',    description: 'Bright, upbeat female voice', gender: 'female', accent: 'American', color: '#FFD60A' },
  { voice_id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella',   description: 'Soft, gentle female voice',   gender: 'female', accent: 'American', color: '#FF6B6B' },
  { voice_id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold',  description: 'Calm, clear male voice',      gender: 'male',   accent: 'American', color: '#5856D6' },
  { voice_id: 'GBv7mTt0atIp3Br8iCZE', name: 'Thomas',  description: 'Deep, authoritative male',    gender: 'male',   accent: 'American', color: '#636366' },
  { voice_id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam',     description: 'Expressive, energetic male',  gender: 'male',   accent: 'British',  color: '#FF9F0A' },
  { voice_id: 'ThT5KcBeYPX3keUQqHPh', name: 'Dorothy', description: 'Wise, clear female voice',    gender: 'female', accent: 'British',  color: '#10A37F' },
  { voice_id: 'pqHfZKP75CvOlQylNhV4', name: 'Bill',    description: 'Professional deep male',      gender: 'male',   accent: 'American', color: '#34C759' },
  // User-specified voice IDs
  { voice_id: 'PzuBz8h2SxBvQ7lnUC44', name: 'Voice 1', description: 'Custom voice from ElevenLabs library', gender: 'female', accent: 'Custom', color: '#BF5AF2' },
  { voice_id: 'jv41DhCf464zw0TI7I1w', name: 'Voice 2', description: 'Custom voice from ElevenLabs library', gender: 'male',   accent: 'Custom', color: '#FF6B35' },
  { voice_id: 'kJKMPwrIKzwVkMKOfRtr', name: 'Voice 3', description: 'Custom voice from ElevenLabs library', gender: 'female', accent: 'Custom', color: '#00C7BE' },
  { voice_id: 'flHkNRp1BlvT73UL6gyz', name: 'Voice 4', description: 'Custom voice from ElevenLabs library', gender: 'male',   accent: 'Custom', color: '#FF9F0A' },
  { voice_id: 'mRdG9GYEjJmIzqbYTidv', name: 'Voice 5', description: 'Custom voice from ElevenLabs library', gender: 'female', accent: 'Custom', color: '#5AC8FA' },
];

const SPEECH_RATES = [
  { id: '0.8', label: 'Slow',    speed: 0.8 },
  { id: '1.0', label: 'Normal',  speed: 1.0 },
  { id: '1.2', label: 'Fast',    speed: 1.2 },
  { id: '1.5', label: 'Fastest', speed: 1.5 },
];

const GENDER_COLORS = { male: '#007AFF', female: '#FF2D55', neutral: '#636366' };

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

export default function VoiceSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const { settings, updateSetting } = useSettings();
  const supabase = getSupabaseClient();

  const [selectedVoice, setSelectedVoice] = useState<string>((settings as any).voice_selection || 'pNInz6obpgDQGcFmaJgB');
  const [speechRate, setSpeechRate] = useState<string>((settings as any).speech_rate?.toString() || '1.0');
  const [voiceInterrupt, setVoiceInterrupt] = useState<boolean>((settings as any).voice_interruption ?? false);
  const [autoGreeting, setAutoGreeting] = useState<boolean>((settings as any).auto_greeting ?? true);
  const [darkMode, setDarkMode] = useState<boolean>(true);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [voices, setVoices] = useState<ElevenLabsVoice[]>(FALLBACK_VOICES);
  const [loadingVoices, setLoadingVoices] = useState(true);
  const [voiceLoadError, setVoiceLoadError] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  const bg        = darkMode ? '#000000'               : '#F2F2F7';
  const card       = darkMode ? '#1C1C1E'               : '#FFFFFF';
  const border     = darkMode ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)';
  const primary    = darkMode ? '#FFFFFF'               : '#000000';
  const secondary  = darkMode ? 'rgba(255,255,255,0.45)' : '#8E8E93';
  const surface    = darkMode ? '#2C2C2E'               : '#F2F2F7';
  const accent     = '#10A37F';

  // ── Fetch ElevenLabs voices dynamically ─────────────────────────────────
  useEffect(() => {
    fetchElevenLabsVoices();
  }, []);

  const fetchElevenLabsVoices = async () => {
    setLoadingVoices(true);
    setVoiceLoadError(false);
    try {
      // Call via our edge function to keep API key server-side
      const { data, error } = await supabase.functions.invoke('generate-tts', {
        body: { action: 'list_voices' },
      });

      if (error || !data?.voices || !Array.isArray(data.voices)) {
        throw new Error('No voices returned');
      }

      // Map API response to our format + merge curated voices
      const apiVoices: ElevenLabsVoice[] = data.voices.map((v: any, i: number) => ({
        voice_id: v.voice_id,
        name: v.name || `Voice ${i + 1}`,
        description: v.description || [v.labels?.description, v.labels?.use_case, v.labels?.accent].filter(Boolean).join(' — ') || 'ElevenLabs voice',
        gender: (v.labels?.gender === 'male' ? 'male' : v.labels?.gender === 'female' ? 'female' : 'neutral') as 'male' | 'female' | 'neutral',
        accent: v.labels?.accent || 'English',
        color: ['#007AFF','#FF2D55','#5856D6','#FF9F0A','#10A37F','#BF5AF2','#00C7BE','#FFD60A'][i % 8],
        preview_url: v.preview_url,
      }));

      if (apiVoices.length === 0) throw new Error('Empty voice list');
      setVoices(apiVoices);
    } catch (e) {
      console.log('[VoiceSettings] Using fallback voices:', e);
      setVoices(FALLBACK_VOICES);
      setVoiceLoadError(true);
    } finally {
      setLoadingVoices(false);
    }
  };

  // ── Play ElevenLabs preview URL or device TTS fallback ──────────────────
  const playVoicePreview = useCallback(async (voice: ElevenLabsVoice) => {
    if (playingVoice !== null) {
      if (soundRef.current) {
        try { await soundRef.current.stopAsync(); await soundRef.current.unloadAsync(); } catch {}
        soundRef.current = null;
      }
      try { Speech.stop(); } catch {}
      if (playingVoice === voice.voice_id) { setPlayingVoice(null); return; }
    }

    setPlayingVoice(voice.voice_id);

    const previewText = `Hello! I am ${voice.name}. How can I help you today?`;

    try {
      // Try ElevenLabs preview URL first (no API key needed for preview_url)
      if (voice.preview_url) {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true, staysActiveInBackground: false });
        const { sound } = await Audio.Sound.createAsync({ uri: voice.preview_url }, { shouldPlay: true, volume: 1.0 });
        soundRef.current = sound;
        sound.setOnPlaybackStatusUpdate((s) => {
          if (s.isLoaded && s.didJustFinish) {
            sound.unloadAsync().catch(() => {});
            soundRef.current = null;
            setPlayingVoice(null);
          }
        });
        return;
      }

      // Fall back to TTS edge function
      const { data } = await supabase.functions.invoke('generate-tts', {
        body: { text: previewText, voice: voice.voice_id, speed: parseFloat(speechRate) },
      });

      const onDone = () => { setPlayingVoice(null); soundRef.current = null; };

      if (data?.fallback === true || data?.code === 'USE_DEVICE_TTS') {
        speakWithDevice(previewText, parseFloat(speechRate), onDone);
        return;
      }

      const audioUrl = data?.audioUrl || data?.audio_url;
      if (!audioUrl) {
        speakWithDevice(previewText, parseFloat(speechRate), onDone);
        return;
      }

      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true, staysActiveInBackground: false });
      const { sound } = await Audio.Sound.createAsync({ uri: audioUrl }, { shouldPlay: true, volume: 1.0 });
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((s) => {
        if (s.isLoaded && s.didJustFinish) {
          sound.unloadAsync().catch(() => {});
          onDone();
        }
      });
    } catch (_e) {
      speakWithDevice(previewText, parseFloat(speechRate), () => setPlayingVoice(null));
    }
  }, [playingVoice, supabase, speechRate]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await updateSetting('voice_selection' as any, selectedVoice);
      await updateSetting('speech_rate' as any, parseFloat(speechRate));
      await updateSetting('voice_interruption' as any, voiceInterrupt);
      await updateSetting('auto_greeting' as any, autoGreeting);
      showAlert('Saved', 'Voice settings applied successfully.');
      router.back();
    } catch (_e) {
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
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: border, backgroundColor: bg }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
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

        {/* APPEARANCE TOGGLE */}
        <View style={[styles.section, { marginTop: 20 }]}>
          <Text style={[styles.sectionTitle, { color: primary }]}>Appearance</Text>
          <View style={[styles.row, { backgroundColor: card, borderColor: border }]}>
            <View style={[styles.iconCircle, { backgroundColor: darkMode ? '#2C2C2E' : '#F2F2F7', borderColor: darkMode ? '#444' : '#DDD' }]}>
              <Ionicons name={darkMode ? 'moon' : 'sunny'} size={18} color={darkMode ? '#FFD60A' : '#FF9F0A'} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.rowTitle, { color: primary }]}>{darkMode ? 'Dark Mode' : 'Light Mode'}</Text>
              <Text style={[styles.rowDesc, { color: secondary }]}>Toggle voice screen appearance</Text>
            </View>
            <Switch value={darkMode} onValueChange={setDarkMode} trackColor={{ false: '#D1D1D6', true: accent + 'AA' }} thumbColor={darkMode ? accent : '#FFF'} />
          </View>
        </View>

        {/* VOICE INTERACTION */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: primary }]}>Voice Interaction</Text>
          <View style={[styles.row, { backgroundColor: card, borderColor: border, marginBottom: 8 }]}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={[styles.rowTitle, { color: primary }]}>Voice Interrupt</Text>
              <Text style={[styles.rowDesc, { color: secondary }]}>Interrupt AI while it speaks. Off = AI finishes before listening.</Text>
            </View>
            <Switch value={voiceInterrupt} onValueChange={setVoiceInterrupt} trackColor={{ false: darkMode ? '#3A3A3C' : '#D1D1D6', true: accent + 'AA' }} thumbColor={voiceInterrupt ? accent : (darkMode ? '#AEAEB2' : '#FFF')} />
          </View>
          <View style={[styles.row, { backgroundColor: card, borderColor: border }]}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={[styles.rowTitle, { color: primary }]}>Auto Greeting</Text>
              <Text style={[styles.rowDesc, { color: secondary }]}>AI greets you when voice control opens.</Text>
            </View>
            <Switch value={autoGreeting} onValueChange={setAutoGreeting} trackColor={{ false: darkMode ? '#3A3A3C' : '#D1D1D6', true: accent + 'AA' }} thumbColor={autoGreeting ? accent : (darkMode ? '#AEAEB2' : '#FFF')} />
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

        {/* SELECTED VOICE TEST */}
        {selectedVoiceInfo ? (
          <View style={styles.section}>
            <TouchableOpacity
              style={[styles.testBtn, { backgroundColor: card, borderColor: accent + '55' }]}
              onPress={() => playVoicePreview(selectedVoiceInfo)}
              activeOpacity={0.8}
            >
              {playingVoice === selectedVoice ? (
                <>
                  <ActivityIndicator size="small" color={accent} />
                  <Text style={[styles.testBtnText, { color: accent }]}>Playing preview...</Text>
                  <Text style={[styles.testBtnSub, { color: secondary }]}>Tap to stop</Text>
                </>
              ) : (
                <>
                  <Ionicons name="play-circle" size={28} color={accent} />
                  <Text style={[styles.testBtnText, { color: primary }]}>Test Selected Voice</Text>
                  <Text style={[styles.testBtnSub, { color: secondary }]}>
                    Preview "{selectedVoiceInfo.name}"
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        {/* VOICE SELECTION */}
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={[styles.sectionTitle, { color: primary, marginBottom: 0 }]}>Choose AI Voice</Text>
            <TouchableOpacity onPress={fetchElevenLabsVoices} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="refresh" size={18} color={secondary} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.sectionDesc, { color: secondary }]}>
            {loadingVoices ? 'Loading voices from ElevenLabs...' : voiceLoadError ? 'Using offline voices — tap ↻ to retry' : `${voices.length} voices available — tap ▶ to preview`}
          </Text>

          {loadingVoices ? (
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <ActivityIndicator size="large" color={accent} />
              <Text style={{ color: secondary, fontSize: 14, marginTop: 12 }}>Loading ElevenLabs voices...</Text>
            </View>
          ) : (
            voices.map(voice => {
              const isSel = selectedVoice === voice.voice_id;
              const isPlay = playingVoice === voice.voice_id;
              const genderColor = GENDER_COLORS[voice.gender] || '#636366';
              return (
                <TouchableOpacity
                  key={voice.voice_id}
                  style={[
                    styles.voiceCard,
                    { backgroundColor: isSel ? (darkMode ? accent + '15' : accent + '08') : card, borderColor: isSel ? accent : border }
                  ]}
                  onPress={() => setSelectedVoice(voice.voice_id)}
                  activeOpacity={0.8}
                >
                  {/* Avatar circle with initials */}
                  <View style={[
                    styles.avatarCircle,
                    { backgroundColor: voice.color + '22', borderColor: isSel ? accent : 'transparent' }
                  ]}>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: voice.color }}>
                      {voice.name[0]?.toUpperCase() || '?'}
                    </Text>
                    {/* Gender dot */}
                    <View style={[styles.genderDot, { backgroundColor: genderColor }]} />
                  </View>

                  {/* Voice info */}
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <Text style={[styles.voiceName, { color: primary }]}>{voice.name}</Text>
                      {voice.accent && voice.accent !== 'Custom' ? (
                        <View style={[styles.accentTag, { backgroundColor: voice.color + '22' }]}>
                          <Text style={[styles.accentText, { color: voice.color }]}>{voice.accent}</Text>
                        </View>
                      ) : null}
                      {voice.voice_id.length > 12 && !voice.name.startsWith('Voice') ? (
                        <View style={[styles.accentTag, { backgroundColor: '#BF5AF222' }]}>
                          <Text style={[styles.accentText, { color: '#BF5AF2' }]}>ElevenLabs</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={[styles.voiceDesc, { color: secondary }]} numberOfLines={1}>{voice.description}</Text>
                    {CURATED_VOICE_IDS.includes(voice.voice_id) ? (
                      <Text style={{ color: '#BF5AF2', fontSize: 10, fontWeight: '600', marginTop: 2 }}>Library Voice</Text>
                    ) : null}
                  </View>

                  {/* Controls */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
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
                      {isPlay ? (
                        <ActivityIndicator size="small" color={accent} />
                      ) : (
                        <Ionicons name="play" size={16} color={isSel ? accent : secondary} />
                      )}
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
            Voices are powered by ElevenLabs AI. The app automatically detects your spoken language and uses the correct multilingual voice model. If a voice is unavailable, device TTS is used as fallback.
          </Text>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  saveBtn: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20, minWidth: 60, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  section: { paddingHorizontal: 16, marginTop: 28 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  sectionDesc: { fontSize: 13, lineHeight: 19, marginBottom: 14 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  iconCircle: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 16, fontWeight: '600', marginBottom: 3 },
  rowDesc: { fontSize: 13, lineHeight: 18 },
  rateRow: { flexDirection: 'row', gap: 8 },
  rateBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 14, borderWidth: 1.5 },
  rateLabel: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  rateSpeed: { fontSize: 12 },
  testBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16, borderWidth: 1.5 },
  testBtnText: { fontSize: 16, fontWeight: '600', flex: 1 },
  testBtnSub: { fontSize: 13 },
  voiceCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 18, borderWidth: 1.5, marginBottom: 10 },
  avatarCircle: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  genderDot: { position: 'absolute', bottom: 0, right: 0, width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#FFF' },
  voiceName: { fontSize: 15, fontWeight: '700' },
  voiceDesc: { fontSize: 12, lineHeight: 17 },
  accentTag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  accentText: { fontSize: 10, fontWeight: '700' },
  checkCircle: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  playBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, marginBottom: 8 },
  infoText: { flex: 1, fontSize: 13, lineHeight: 19 },
});
if you read that message make sure you make all change fix this page better in mobile and for all voice elevenlabs add real logo photo for all better real and when i  click save white mode lipa rete so fix poul stay ni nn voice controle and The ElevenLabs 401 error says 'unusual activity on Free Tier'. Add logic to detect this specific error in generate-tts and immediately skip to OpenAI instead of returning a device TTS fallback, so users on a free ElevenLabs plan still hear high-quality AI voice output.
