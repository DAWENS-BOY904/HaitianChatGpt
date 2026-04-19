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
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import { useTheme } from '../hooks/useTheme';
import { useSettings } from '../hooks/useSettings';
import { useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import * as FileSystem from 'expo-file-system';

const AI_VOICES = [
  {
    id: 'alloy',
    name: 'Alloy',
    description: 'Warm, friendly male voice',
    gender: 'male' as const,
    icon: 'person-circle-outline',
    previewText: 'Hello! I am Alloy. How can I assist you today?',
  },
  {
    id: 'echo',
    name: 'Echo',
    description: 'Calm, clear male voice',
    gender: 'male' as const,
    icon: 'man-outline',
    previewText: 'Hello! I am Echo, ready to help you.',
  },
  {
    id: 'fable',
    name: 'Fable',
    description: 'Expressive, energetic male voice',
    gender: 'male' as const,
    icon: 'happy-outline',
    previewText: 'Hello! Fable here, excited to work with you!',
  },
  {
    id: 'onyx',
    name: 'Onyx',
    description: 'Deep, authoritative male voice',
    gender: 'male' as const,
    icon: 'mic-outline',
    previewText: 'Hello. I am Onyx. How may I help you?',
  },
  {
    id: 'nova',
    name: 'Nova',
    description: 'Warm, friendly female voice',
    gender: 'female' as const,
    icon: 'woman-outline',
    previewText: 'Hello! I am Nova, here to assist you.',
  },
  {
    id: 'shimmer',
    name: 'Shimmer',
    description: 'Bright, upbeat female voice',
    gender: 'female' as const,
    icon: 'sparkles-outline',
    previewText: 'Hello! Shimmer here. What can I do for you?',
  },
  {
    id: 'coral',
    name: 'Coral',
    description: 'Soft, gentle female voice',
    gender: 'female' as const,
    icon: 'heart-outline',
    previewText: 'Hello, I am Coral. I am here for you.',
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
  const { colors, isDark } = useTheme();
  const { showAlert } = useAlert();
  const { settings, updateSetting } = useSettings();
  const supabase = getSupabaseClient();

  const [selectedVoice, setSelectedVoice] = useState<string>((settings as any).voice_selection || 'alloy');
  const [speechRate, setSpeechRate] = useState<string>((settings as any).speech_rate?.toString() || '1.0');
  const [voiceInterrupt, setVoiceInterrupt] = useState<boolean>((settings as any).voice_interruption ?? false);
  const [autoGreeting, setAutoGreeting] = useState<boolean>((settings as any).auto_greeting ?? true);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

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

      if (error || !data?.audioUrl) {
        let errMsg = 'Preview failed';
        if (error && (error as any).context) {
          try { const txt = await (error as any).context.text(); errMsg = txt || errMsg; } catch {}
        }
        throw new Error(errMsg);
      }

      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(
        { uri: data.audioUrl },
        { shouldPlay: true }
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
      showAlert('Preview Failed', 'Could not play voice preview. Check your connection.');
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

  const bg = isDark ? '#000000' : '#F2F2F7';
  const card = isDark ? '#1C1C1E' : '#FFFFFF';
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const primaryText = isDark ? '#FFFFFF' : '#000000';
  const secondary = isDark ? 'rgba(255,255,255,0.45)' : '#8E8E93';
  const accent = '#10A37F';

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={primaryText} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: primaryText }]}>Voice Settings</Text>
        <TouchableOpacity
          onPress={handleSave}
          style={[styles.saveBtn, { backgroundColor: accent }]}
        >
          <Text style={styles.saveBtnText}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        {/* VOICE INTERRUPT */}
        <View style={[styles.section, { marginTop: 24 }]}>
          <Text style={[styles.sectionTitle, { color: primaryText }]}>Voice Interaction</Text>
          <View style={[styles.settingRow, { backgroundColor: card, borderColor: border }]}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={[styles.settingTitle, { color: primaryText }]}>Voice Interrupt</Text>
              <Text style={[styles.settingDesc, { color: secondary }]}>
                When enabled, you can interrupt the AI while it speaks. When disabled, the AI finishes its response before listening.
              </Text>
            </View>
            <Switch
              value={voiceInterrupt}
              onValueChange={setVoiceInterrupt}
              trackColor={{ false: isDark ? '#3A3A3C' : '#D1D1D6', true: accent + '99' }}
              thumbColor={voiceInterrupt ? accent : (isDark ? '#AEAEB2' : '#FFFFFF')}
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
              trackColor={{ false: isDark ? '#3A3A3C' : '#D1D1D6', true: accent + '99' }}
              thumbColor={autoGreeting ? accent : (isDark ? '#AEAEB2' : '#FFFFFF')}
            />
          </View>
        </View>

        {/* SPEECH RATE */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: primaryText }]}>Speech Speed</Text>
          <View style={[styles.rateRow]}>
            {SPEECH_RATES.map((rate) => {
              const isSelected = speechRate === rate.id;
              return (
                <TouchableOpacity
                  key={rate.id}
                  style={[
                    styles.rateBtn,
                    { backgroundColor: card, borderColor: isSelected ? accent : border },
                    isSelected && { backgroundColor: accent + '18' },
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

        {/* VOICE SELECTION */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: primaryText }]}>AI Voice</Text>
          <Text style={[styles.sectionDesc, { color: secondary }]}>
            Tap the play button to preview. The selected voice is used during your conversation.
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
                    backgroundColor: card,
                    borderColor: isSelected ? accent : border,
                  },
                  isSelected && { backgroundColor: accent + '10' },
                ]}
                onPress={() => setSelectedVoice(voice.id)}
                activeOpacity={0.8}
              >
                {/* Left: icon */}
                <View style={[styles.voiceIcon, { backgroundColor: isSelected ? accent + '22' : (isDark ? '#2C2C2E' : '#F2F2F7') }]}>
                  <Ionicons
                    name={voice.icon as any}
                    size={24}
                    color={isSelected ? accent : secondary}
                  />
                </View>

                {/* Middle: info */}
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={[styles.voiceName, { color: primaryText }]}>{voice.name}</Text>
                    <View style={[styles.genderTag, { backgroundColor: voice.gender === 'male' ? '#007AFF22' : '#FF2D5522' }]}>
                      <Text style={[styles.genderText, { color: voice.gender === 'male' ? '#007AFF' : '#FF2D55' }]}>
                        {voice.gender}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.voiceDesc, { color: secondary }]}>{voice.description}</Text>
                </View>

                {/* Right: play + selected */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  {isSelected ? (
                    <View style={[styles.checkCircle, { backgroundColor: accent }]}>
                      <Ionicons name="checkmark" size={14} color="#FFF" />
                    </View>
                  ) : null}
                  <TouchableOpacity
                    style={styles.playBtn}
                    onPress={() => playVoicePreview(voice.id, voice.previewText)}
                    disabled={playingVoice !== null}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    {isPlaying ? (
                      <ActivityIndicator size="small" color={accent} />
                    ) : (
                      <Ionicons name="play-circle" size={34} color={isSelected ? accent : secondary} />
                    )}
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}
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
    marginBottom: 4,
  },
  settingDesc: {
    fontSize: 13,
    lineHeight: 18,
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
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: 10,
    gap: 12,
  },
  voiceIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceName: {
    fontSize: 15,
    fontWeight: '700',
  },
  voiceDesc: {
    fontSize: 13,
    marginTop: 2,
  },
  genderTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  genderText: {
    fontSize: 11,
    fontWeight: '600',
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
  },
});
