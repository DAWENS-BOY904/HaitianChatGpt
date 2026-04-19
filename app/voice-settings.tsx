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
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Audio } from 'expo-av';
import { useSettings } from '../hooks/useSettings';
import { useAlert } from '@/template';
import { getSupabaseClient } from '@/template';

// Real AI voice persona images
const VOICE_IMAGES: Record<string, any> = {
  alloy: require('../assets/images/voice-alloy.jpg'),
  echo: require('../assets/images/voice-echo.jpg'),
  fable: require('../assets/images/voice-fable.jpg'),
  onyx: require('../assets/images/voice-onyx.jpg'),
  nova: require('../assets/images/voice-nova.jpg'),
  shimmer: require('../assets/images/voice-shimmer.jpg'),
  coral: require('../assets/images/voice-coral.jpg'),
};

const AI_VOICES = [
  {
    id: 'alloy',
    name: 'Alloy',
    description: 'Warm, friendly male voice',
    gender: 'male' as const,
    previewText: 'Hello! I am Alloy. How can I assist you today?',
    accent: 'American',
    color: '#007AFF',
  },
  {
    id: 'echo',
    name: 'Echo',
    description: 'Calm, clear male voice',
    gender: 'male' as const,
    previewText: 'Hello! I am Echo, ready to help you.',
    accent: 'British',
    color: '#5856D6',
  },
  {
    id: 'fable',
    name: 'Fable',
    description: 'Expressive, energetic male voice',
    gender: 'male' as const,
    previewText: 'Hello! Fable here, excited to work with you!',
    accent: 'British',
    color: '#FF9F0A',
  },
  {
    id: 'onyx',
    name: 'Onyx',
    description: 'Deep, authoritative male voice',
    gender: 'male' as const,
    previewText: 'Hello. I am Onyx. How may I help you?',
    accent: 'American',
    color: '#1C1C1E',
  },
  {
    id: 'nova',
    name: 'Nova',
    description: 'Warm, friendly female voice',
    gender: 'female' as const,
    previewText: 'Hello! I am Nova, here to assist you.',
    accent: 'American',
    color: '#FF2D55',
  },
  {
    id: 'shimmer',
    name: 'Shimmer',
    description: 'Bright, upbeat female voice',
    gender: 'female' as const,
    previewText: 'Hello! Shimmer here. What can I do for you?',
    accent: 'American',
    color: '#FFD60A',
  },
  {
    id: 'coral',
    name: 'Coral',
    description: 'Soft, gentle female voice',
    gender: 'female' as const,
    previewText: 'Hello, I am Coral. I am here for you.',
    accent: 'American',
    color: '#FF6B6B',
  },
];

const SPEECH_RATES = [
  { id: '0.8', label: 'Slow', speed: 0.8 },
  { id: '1.0', label: 'Normal', speed: 1.0 },
  { id: '1.2', label: 'Fast', speed: 1.2 },
  { id: '1.5', label: 'Fastest', speed: 1.5 },
];

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
  const [darkMode, setDarkMode] = useState<boolean>(true); // default dark for voice screen
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  // Derived theme
  const bg = darkMode ? '#000000' : '#F2F2F7';
  const card = darkMode ? '#1C1C1E' : '#FFFFFF';
  const border = darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const primaryText = darkMode ? '#FFFFFF' : '#000000';
  const secondary = darkMode ? 'rgba(255,255,255,0.45)' : '#8E8E93';
  const surface = darkMode ? '#2C2C2E' : '#F2F2F7';
  const accent = '#10A37F';

  const playVoicePreview = useCallback(async (voiceId: string, previewText: string) => {
    try {
      if (soundRef.current) {
        try { await soundRef.current.stopAsync(); await soundRef.current.unloadAsync(); } catch {}
        soundRef.current = null;
      }
      setPlayingVoice(voiceId);

      const { data, error } = await supabase.functions.invoke('generate-tts', {
        body: { text: previewText, voice: voiceId, speed: parseFloat(speechRate) },
      });

      const audioUrl = data?.audioUrl || data?.audio_url;
      if (error || !audioUrl) {
        let errMsg = 'Preview failed';
        if (error && (error as any).context) {
          try { const txt = await (error as any).context.text(); errMsg = txt || errMsg; } catch {}
        }
        throw new Error(errMsg);
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true, volume: 1.0 }
      );
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlayingVoice(null);
          sound.unloadAsync().catch(() => {});
          soundRef.current = null;
        }
      });
    } catch (e) {
      setPlayingVoice(null);
      showAlert('Preview Failed', 'Could not play voice preview. Please check your connection.');
    }
  }, [supabase, speechRate, showAlert]);

  const handleSave = useCallback(async () => {
    await updateSetting('voice_selection' as any, selectedVoice);
    await updateSetting('speech_rate' as any, parseFloat(speechRate));
    await updateSetting('voice_interruption' as any, voiceInterrupt);
    await updateSetting('auto_greeting' as any, autoGreeting);
    showAlert('Saved', 'Voice settings updated.');
    router.back();
  }, [selectedVoice, speechRate, voiceInterrupt, autoGreeting, updateSetting, showAlert, router]);

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: border, backgroundColor: bg }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={primaryText} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: primaryText }]}>Voice Settings</Text>
        <TouchableOpacity onPress={handleSave} style={[styles.saveBtn, { backgroundColor: accent }]}>
          <Text style={styles.saveBtnText}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>

        {/* APPEARANCE TOGGLE */}
        <View style={[styles.section, { marginTop: 20 }]}>
          <Text style={[styles.sectionTitle, { color: primaryText }]}>Appearance</Text>
          <View style={[styles.settingRow, { backgroundColor: card, borderColor: border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
              <View style={[styles.modeIcon, { backgroundColor: darkMode ? '#1C1C1E' : '#F2F2F7', borderColor: darkMode ? '#555' : '#DDD' }]}>
                <Ionicons name={darkMode ? 'moon' : 'sunny'} size={18} color={darkMode ? '#FFD60A' : '#FF9F0A'} />
              </View>
              <View>
                <Text style={[styles.settingTitle, { color: primaryText }]}>
                  {darkMode ? 'Dark Mode' : 'Light Mode'}
                </Text>
                <Text style={[styles.settingDesc, { color: secondary }]}>
                  Toggle voice screen appearance
                </Text>
              </View>
            </View>
            <Switch
              value={darkMode}
              onValueChange={setDarkMode}
              trackColor={{ false: '#D1D1D6', true: accent + '99' }}
              thumbColor={darkMode ? accent : '#FFFFFF'}
            />
          </View>
        </View>

        {/* VOICE INTERACTION */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: primaryText }]}>Voice Interaction</Text>

          <View style={[styles.settingRow, { backgroundColor: card, borderColor: border }]}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={[styles.settingTitle, { color: primaryText }]}>Voice Interrupt</Text>
              <Text style={[styles.settingDesc, { color: secondary }]}>
                Interrupt the AI while it speaks. When off, AI finishes before listening.
              </Text>
            </View>
            <Switch
              value={voiceInterrupt}
              onValueChange={setVoiceInterrupt}
              trackColor={{ false: darkMode ? '#3A3A3C' : '#D1D1D6', true: accent + '99' }}
              thumbColor={voiceInterrupt ? accent : (darkMode ? '#AEAEB2' : '#FFFFFF')}
            />
          </View>

          <View style={[styles.settingRow, { backgroundColor: card, borderColor: border, marginTop: 2 }]}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={[styles.settingTitle, { color: primaryText }]}>Auto Greeting</Text>
              <Text style={[styles.settingDesc, { color: secondary }]}>
                AI greets you automatically when voice control opens.
              </Text>
            </View>
            <Switch
              value={autoGreeting}
              onValueChange={setAutoGreeting}
              trackColor={{ false: darkMode ? '#3A3A3C' : '#D1D1D6', true: accent + '99' }}
              thumbColor={autoGreeting ? accent : (darkMode ? '#AEAEB2' : '#FFFFFF')}
            />
          </View>
        </View>

        {/* SPEECH SPEED */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: primaryText }]}>Speech Speed</Text>
          <View style={styles.rateRow}>
            {SPEECH_RATES.map((rate) => {
              const isSelected = speechRate === rate.id;
              return (
                <TouchableOpacity
                  key={rate.id}
                  style={[
                    styles.rateBtn,
                    {
                      backgroundColor: isSelected ? accent + '18' : card,
                      borderColor: isSelected ? accent : border,
                    },
                  ]}
                  onPress={() => setSpeechRate(rate.id)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.rateLabel, { color: isSelected ? accent : primaryText }]}>{rate.label}</Text>
                  <Text style={[styles.rateSpeed, { color: secondary }]}>{rate.speed}×</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* AI VOICE SELECTION */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: primaryText }]}>AI Voice</Text>
          <Text style={[styles.sectionDesc, { color: secondary }]}>
            Tap the play button to preview. Selected voice is used during conversation.
          </Text>

          {AI_VOICES.map((voice) => {
            const isSelected = selectedVoice === voice.id;
            const isPlaying = playingVoice === voice.id;

            return (
              <TouchableOpacity
                key={voice.id}
                style={[
                  styles.voiceCard,
                  {
                    backgroundColor: isSelected ? (darkMode ? accent + '15' : accent + '08') : card,
                    borderColor: isSelected ? accent : border,
                  },
                ]}
                onPress={() => setSelectedVoice(voice.id)}
                activeOpacity={0.8}
              >
                {/* Avatar image */}
                <View style={[styles.avatarWrap, { borderColor: isSelected ? accent : 'transparent' }]}>
                  <Image
                    source={VOICE_IMAGES[voice.id]}
                    style={styles.avatarImg}
                    contentFit="cover"
                    transition={200}
                  />
                  {/* Gender badge */}
                  <View style={[
                    styles.genderBadge,
                    { backgroundColor: voice.gender === 'male' ? '#007AFF' : '#FF2D55' },
                  ]}>
                    <Ionicons
                      name={voice.gender === 'male' ? 'male' : 'female'}
                      size={8}
                      color="#FFF"
                    />
                  </View>
                </View>

                {/* Info */}
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <Text style={[styles.voiceName, { color: primaryText }]}>{voice.name}</Text>
                    <View style={[styles.accentTag, { backgroundColor: voice.color + '22' }]}>
                      <Text style={[styles.accentText, { color: voice.color }]}>{voice.accent}</Text>
                    </View>
                  </View>
                  <Text style={[styles.voiceDesc, { color: secondary }]}>{voice.description}</Text>
                </View>

                {/* Controls */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {isSelected ? (
                    <View style={[styles.checkCircle, { backgroundColor: accent }]}>
                      <Ionicons name="checkmark" size={12} color="#FFF" />
                    </View>
                  ) : null}
                  <TouchableOpacity
                    style={[styles.playBtn, { backgroundColor: isSelected ? accent + '22' : surface }]}
                    onPress={() => playVoicePreview(voice.id, voice.previewText)}
                    disabled={playingVoice !== null && playingVoice !== voice.id}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    {isPlaying ? (
                      <ActivityIndicator size="small" color={accent} />
                    ) : (
                      <Ionicons
                        name="play"
                        size={16}
                        color={isSelected ? accent : secondary}
                      />
                    )}
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* BOTTOM INFO */}
        <View style={[styles.infoCard, { backgroundColor: card, borderColor: border, marginHorizontal: 16, marginTop: 8 }]}>
          <Ionicons name="information-circle-outline" size={18} color={accent} />
          <Text style={[styles.infoText, { color: secondary }]}>
            Voice is powered by real AI TTS. Preview plays a short sample in that voice. Your selected voice is used in every voice call.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  saveBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 28,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  sectionDesc: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 3,
  },
  settingDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  modeIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rateRow: {
    flexDirection: 'row',
    gap: 8,
  },
  rateBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  rateLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  rateSpeed: {
    fontSize: 12,
  },
  voiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1.5,
    marginBottom: 10,
  },
  avatarWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  avatarImg: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  genderBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
  voiceName: {
    fontSize: 15,
    fontWeight: '700',
  },
  voiceDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  accentTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  accentText: {
    fontSize: 10,
    fontWeight: '700',
  },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
});
