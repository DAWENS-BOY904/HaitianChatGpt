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
import { BlurView } from 'expo-blur';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { useSettings } from '../hooks/useSettings';
import { useAlert } from '@/template';
import { getSupabaseClient } from '@/template';

const VOICE_IMAGES: Record<string, any> = {
  alloy:   require('../assets/images/voice-alloy.jpg'),
  echo:    require('../assets/images/voice-echo.jpg'),
  fable:   require('../assets/images/voice-fable.jpg'),
  onyx:    require('../assets/images/voice-onyx.jpg'),
  nova:    require('../assets/images/voice-nova.jpg'),
  shimmer: require('../assets/images/voice-shimmer.jpg'),
  coral:   require('../assets/images/voice-coral.jpg'),
};

// Each voice has a UNIQUE ElevenLabs voice — no two share the same voice actor
const AI_VOICES = [
  { id: 'alloy',   name: 'Alloy',   description: 'Adam — Warm & neutral male (ElevenLabs)',        gender: 'male'   as const, previewText: 'Hello! I am Alloy. How can I help you today?',         accent: 'American', color: '#007AFF', elevenLabsId: 'pNInz6obpgDQGcFmaJgB' },
  { id: 'echo',    name: 'Echo',    description: 'Arnold — Calm & clear British male (ElevenLabs)',  gender: 'male'   as const, previewText: 'Hello, I am Echo. Ready to assist whenever you need.',  accent: 'British',  color: '#5856D6', elevenLabsId: 'VR6AewLTigWG4xSOukaG' },
  { id: 'fable',   name: 'Fable',   description: 'Sam — Expressive & energetic (ElevenLabs)',        gender: 'male'   as const, previewText: 'Hey there! Fable here, excited to work with you!',      accent: 'British',  color: '#FF9F0A', elevenLabsId: 'yoZ06aMxZJJ28mfd3POQ' },
  { id: 'onyx',    name: 'Onyx',    description: 'Thomas — Deep & authoritative (ElevenLabs)',        gender: 'male'   as const, previewText: 'Good day. I am Onyx. How may I be of service?',         accent: 'American', color: '#636366', elevenLabsId: 'GBv7mTt0atIp3Br8iCZE' },
  { id: 'nova',    name: 'Nova',    description: 'Rachel — Warm & friendly female (ElevenLabs)',      gender: 'female' as const, previewText: 'Hi! I am Nova, happy to help you with anything.',        accent: 'American', color: '#FF2D55', elevenLabsId: '21m00Tcm4TlvDq8ikWAM' },
  { id: 'shimmer', name: 'Shimmer', description: 'Domi — Bright & upbeat female (ElevenLabs)',        gender: 'female' as const, previewText: 'Hello! Shimmer here. What can I do for you today?',     accent: 'American', color: '#FFD60A', elevenLabsId: 'AZnzlk1XvdvUeBnXmlld' },
  { id: 'coral',   name: 'Coral',   description: 'Bella — Soft & gentle female (ElevenLabs)',         gender: 'female' as const, previewText: 'Hello, I am Coral. I am right here for you.',            accent: 'American', color: '#FF6B6B', elevenLabsId: 'EXAVITQu4vr4xnSDxMaL' },
];

const SPEECH_RATES = [
  { id: '0.8', label: 'Slow',    speed: 0.8 },
  { id: '1.0', label: 'Normal',  speed: 1.0 },
  { id: '1.2', label: 'Fast',    speed: 1.2 },
  { id: '1.5', label: 'Fastest', speed: 1.5 },
];

function speakWithDevice(text: string, voice: string, rate: number, onDone: () => void) {
  const langMap: Record<string, string> = {
    echo: 'en-GB', fable: 'en-GB',
    alloy: 'en-US', onyx: 'en-US', nova: 'en-US', shimmer: 'en-US', coral: 'en-US',
  };
  try {
    Speech.speak(text, {
      language: langMap[voice] ?? 'en-US',
      rate: Math.min(rate * 0.9, 1.4),
      pitch: voice === 'onyx' ? 0.8 : voice === 'shimmer' ? 1.2 : 1.0,
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

  const [selectedVoice, setSelectedVoice] = useState<string>((settings as any).voice_selection || 'alloy');
  const [speechRate, setSpeechRate] = useState<string>((settings as any).speech_rate?.toString() || '1.0');
  const [voiceInterrupt, setVoiceInterrupt] = useState<boolean>((settings as any).voice_interruption ?? false);
  const [autoGreeting, setAutoGreeting] = useState<boolean>((settings as any).auto_greeting ?? true);
  const [darkMode, setDarkMode] = useState<boolean>(true);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  // Theme tokens
  const bg       = darkMode ? '#000000'              : '#F2F2F7';
  const card      = darkMode ? '#1C1C1E'              : '#FFFFFF';
  const border    = darkMode ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)';
  const primary   = darkMode ? '#FFFFFF'              : '#000000';
  const secondary = darkMode ? 'rgba(255,255,255,0.45)' : '#8E8E93';
  const surface   = darkMode ? '#2C2C2E'              : '#F2F2F7';
  const accent    = '#10A37F';

  // Preview voice (TTS edge function first, expo-speech fallback)
  const playVoicePreview = useCallback(async (voiceId: string, previewText: string) => {
    if (playingVoice !== null) {
      // Stop current playback
      if (soundRef.current) {
        try { await soundRef.current.stopAsync(); await soundRef.current.unloadAsync(); } catch {}
        soundRef.current = null;
      }
      try { Speech.stop(); } catch {}
      if (playingVoice === voiceId) { setPlayingVoice(null); return; }
    }

    setPlayingVoice(voiceId);
    try {
      const { data } = await supabase.functions.invoke('generate-tts', {
        body: { text: previewText, voice: voiceId, speed: parseFloat(speechRate) },
      });

      const onDone = () => { setPlayingVoice(null); soundRef.current = null; };

      // Device TTS fallback
      if (data?.fallback === true || data?.code === 'USE_DEVICE_TTS') {
        speakWithDevice(previewText, voiceId, parseFloat(speechRate), onDone);
        return;
      }

      const audioUrl = data?.audioUrl || data?.audio_url;
      if (!audioUrl) {
        speakWithDevice(previewText, voiceId, parseFloat(speechRate), onDone);
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
      speakWithDevice(previewText, voiceId, parseFloat(speechRate), () => setPlayingVoice(null));
    }
  }, [playingVoice, supabase, speechRate]);

  // Test current selected voice
  const handleTestVoice = useCallback(async () => {
    const voice = AI_VOICES.find(v => v.id === selectedVoice);
    if (!voice) return;
    await playVoicePreview(voice.id, voice.previewText);
  }, [selectedVoice, playVoicePreview]);

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

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: border, backgroundColor: bg }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: primary }]}>Voice Settings</Text>
        <TouchableOpacity onPress={handleSave} style={[styles.saveBtn, { backgroundColor: accent, opacity: saving ? 0.7 : 1 }]} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.saveBtnText}>Save</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}>

        {/* APPEARANCE */}
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
              <Text style={[styles.rowDesc, { color: secondary }]}>Interrupt the AI while it speaks. When off, AI finishes before listening.</Text>
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

        {/* TEST VOICE BUTTON */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.testBtn, { backgroundColor: card, borderColor: accent + '55' }]}
            onPress={handleTestVoice}
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
                  Preview "{AI_VOICES.find(v => v.id === selectedVoice)?.name}" voice
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* AI VOICE SELECTION */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: primary }]}>Choose AI Voice</Text>
          <Text style={[styles.sectionDesc, { color: secondary }]}>Tap ▶ to preview. Selected voice is used in every conversation.</Text>

          {AI_VOICES.map(voice => {
            const isSel = selectedVoice === voice.id;
            const isPlay = playingVoice === voice.id;
            return (
              <TouchableOpacity
                key={voice.id}
                style={[styles.voiceCard, { backgroundColor: isSel ? (darkMode ? accent + '15' : accent + '08') : card, borderColor: isSel ? accent : border }]}
                onPress={() => { setSelectedVoice(voice.id); }}
                activeOpacity={0.8}
              >
                {/* Avatar */}
                <View style={[styles.avatarWrap, { borderColor: isSel ? accent : 'transparent' }]}>
                  <Image source={VOICE_IMAGES[voice.id]} style={styles.avatarImg} contentFit="cover" transition={200} />
                  <View style={[styles.genderBadge, { backgroundColor: voice.gender === 'male' ? '#007AFF' : '#FF2D55' }]}>
                    <Ionicons name={voice.gender === 'male' ? 'male' : 'female'} size={8} color="#FFF" />
                  </View>
                </View>

                {/* Info */}
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <Text style={[styles.voiceName, { color: primary }]}>{voice.name}</Text>
                    <View style={[styles.accentTag, { backgroundColor: voice.color + '22' }]}>
                      <Text style={[styles.accentText, { color: voice.color }]}>{voice.accent}</Text>
                    </View>
                  </View>
                  <Text style={[styles.voiceDesc, { color: secondary }]}>{voice.description}</Text>
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
                    onPress={() => playVoicePreview(voice.id, voice.previewText)}
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
          })}
        </View>

        {/* INFO CARD */}
        <View style={[styles.infoCard, { backgroundColor: card, borderColor: border, marginHorizontal: 16, marginTop: 8 }]}>
          <Ionicons name="information-circle-outline" size={18} color={accent} />
          <Text style={[styles.infoText, { color: secondary }]}>
            Voice is powered by AI TTS. If the AI voice is unavailable, the app uses your device speech as fallback. Settings apply immediately after saving.
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
  avatarWrap: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, overflow: 'hidden', position: 'relative' },
  avatarImg: { width: 56, height: 56, borderRadius: 28 },
  genderBadge: { position: 'absolute', bottom: 0, right: 0, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#FFF' },
  voiceName: { fontSize: 15, fontWeight: '700' },
  voiceDesc: { fontSize: 12, lineHeight: 17 },
  accentTag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  accentText: { fontSize: 10, fontWeight: '700' },
  checkCircle: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  playBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, marginBottom: 8 },
  infoText: { flex: 1, fontSize: 13, lineHeight: 19 },
});
