import React, { useState, useEffect } from 'react';
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
import { Audio } from 'expo-av';
import { useTheme } from '../hooks/useTheme';
import { useSettings } from '../hooks/useSettings';
import { useAlert } from '@/template';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { getSupabaseClient } from '@/template';

// Real TTS Voices (OpenAI TTS-1-HD)
const AI_VOICES = [
  {
    id: 'alloy',
    name: 'Warm Male',
    description: 'Friendly and professional voice',
    gender: 'male',
    sampleText: 'Hello! I\'m a warm and friendly voice. How can I assist you today?',
  },
  {
    id: 'echo',
    name: 'Calm Female',
    description: 'Soothing and clear voice',
    gender: 'female',
    sampleText: 'Hi there. I\'m here to help you with a calm, gentle tone.',
  },
  {
    id: 'fable',
    name: 'Energetic Male',
    description: 'Dynamic and expressive voice',
    gender: 'male',
    sampleText: 'Hey! Ready to get things done with energy and enthusiasm!',
  },
  {
    id: 'onyx',
    name: 'Soft Female',
    description: 'Gentle and reassuring voice',
    gender: 'female',
    sampleText: 'Welcome. I\'m designed to provide you with a soft, caring experience.',
  },
  {
    id: 'nova',
    name: 'Professional Male',
    description: 'Clear and authoritative voice',
    gender: 'male',
    sampleText: 'Good day. I deliver information with clarity and professionalism.',
  },
  {
    id: 'shimmer',
    name: 'Friendly Female',
    description: 'Upbeat and engaging voice',
    gender: 'female',
    sampleText: 'Hi! I\'m thrilled to assist you with a positive, friendly tone.',
  },
  {
    id: 'echo-balanced',
    name: 'Neutral AI',
    description: 'Balanced and neutral voice',
    gender: 'neutral',
    sampleText: 'Greetings. I provide balanced, neutral assistance for all users.',
  },
];

const SPEECH_RATES = [
  { id: '0.8', label: 'Slower', speed: 0.8 },
  { id: '1.0', label: 'Normal', speed: 1.0 },
  { id: '1.2', label: 'Faster', speed: 1.2 },
  { id: '1.5', label: 'Fastest', speed: 1.5 },
];

export default function VoiceSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { showAlert } = useAlert();
  const { settings, updateSetting } = useSettings();
  const supabase = getSupabaseClient();

  const [selectedVoice, setSelectedVoice] = useState(settings.voice_selection || 'alloy');
  const [speechRate, setSpeechRate] = useState(settings.speech_rate?.toString() || '1.0');
  const [allowInterruption, setAllowInterruption] = useState(settings.voice_interruption || false);
  const [autoGreeting, setAutoGreeting] = useState(settings.auto_greeting || true);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);

  // Real voice preview using OpenAI TTS
  const playVoicePreview = async (voiceId: string, sampleText: string) => {
    try {
      // Stop any currently playing sound
      if (sound) {
        await sound.unloadAsync();
      }

      setPlayingVoice(voiceId);

      // Call TTS Edge Function
      const { data, error } = await supabase.functions.invoke('generate-tts', {
        body: {
          text: sampleText,
          voice: voiceId,
          speed: parseFloat(speechRate),
        },
      });

      if (error || !data?.audioUrl) {
        throw new Error(error?.message || 'Failed to generate voice preview');
      }

      // Play audio
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: data.audioUrl },
        { shouldPlay: true }
      );

      setSound(newSound);

      newSound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.didJustFinish) {
          setPlayingVoice(null);
        }
      });
    } catch (error: any) {
      console.error('Voice preview error:', error);
      showAlert('Preview Failed', 'Unable to play voice preview. Please try again.');
      setPlayingVoice(null);
    }
  };

  const handleSaveSettings = async () => {
    await updateSetting('voice_selection', selectedVoice);
    await updateSetting('speech_rate', parseFloat(speechRate));
    await updateSetting('voice_interruption', allowInterruption);
    await updateSetting('auto_greeting', autoGreeting);

    showAlert('Settings Saved', 'Your voice preferences have been updated successfully.');
    router.back();
  };

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingTop: Platform.select({
        ios: insets.top + 10,
        android: insets.top + 10,
      }),
      paddingHorizontal: Spacing.md,
      paddingBottom: Spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      padding: Spacing.xs,
    },
    headerTitle: {
      ...Typography.heading,
      color: colors.text,
      fontSize: 20,
      marginLeft: Spacing.md,
      flex: 1,
    },
    saveButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: Spacing.md,
      paddingVertical: 8,
      borderRadius: BorderRadius.md,
    },
    saveButtonText: {
      ...Typography.body,
      color: '#FFFFFF',
      fontWeight: '600',
    },
    content: {
      flex: 1,
    },
    section: {
      paddingVertical: Spacing.lg,
      paddingHorizontal: Spacing.md,
    },
    sectionTitle: {
      ...Typography.heading,
      color: colors.text,
      fontSize: 18,
      marginBottom: Spacing.md,
    },
    sectionDescription: {
      ...Typography.caption,
      color: colors.textSecondary,
      marginBottom: Spacing.md,
    },
    voiceCard: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    voiceCardSelected: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}15`,
    },
    voiceIcon: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: Spacing.md,
    },
    voiceInfo: {
      flex: 1,
    },
    voiceName: {
      ...Typography.body,
      color: colors.text,
      fontWeight: '600',
      marginBottom: 2,
    },
    voiceDescription: {
      ...Typography.caption,
      color: colors.textSecondary,
    },
    playButton: {
      padding: Spacing.sm,
    },
    rateRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: Spacing.sm,
    },
    rateButton: {
      flex: 1,
      backgroundColor: colors.surface,
      padding: Spacing.md,
      borderRadius: BorderRadius.md,
      alignItems: 'center',
      marginHorizontal: 4,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    rateButtonSelected: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}15`,
    },
    rateLabel: {
      ...Typography.body,
      color: colors.text,
      fontWeight: '600',
    },
    rateSpeed: {
      ...Typography.caption,
      color: colors.textSecondary,
      marginTop: 2,
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    settingLeft: {
      flex: 1,
    },
    settingTitle: {
      ...Typography.body,
      color: colors.text,
      fontWeight: '600',
      marginBottom: 4,
    },
    settingDescription: {
      ...Typography.caption,
      color: colors.textSecondary,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: Spacing.lg,
    },
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Voice Settings</Text>
        <TouchableOpacity style={styles.saveButton} onPress={handleSaveSettings}>
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Voice Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Voice Selection</Text>
          <Text style={styles.sectionDescription}>
            Choose your preferred AI voice. Tap play to preview each voice.
          </Text>

          {AI_VOICES.map((voice) => (
            <TouchableOpacity
              key={voice.id}
              style={[
                styles.voiceCard,
                selectedVoice === voice.id && styles.voiceCardSelected,
              ]}
              onPress={() => setSelectedVoice(voice.id)}
            >
              <View style={styles.voiceIcon}>
                <Ionicons
                  name={voice.gender === 'male' ? 'man' : voice.gender === 'female' ? 'woman' : 'person'}
                  size={28}
                  color={selectedVoice === voice.id ? colors.primary : colors.textSecondary}
                />
              </View>
              <View style={styles.voiceInfo}>
                <Text style={styles.voiceName}>{voice.name}</Text>
                <Text style={styles.voiceDescription}>{voice.description}</Text>
              </View>
              <TouchableOpacity
                style={styles.playButton}
                onPress={() => playVoicePreview(voice.id, voice.sampleText)}
                disabled={playingVoice !== null}
              >
                {playingVoice === voice.id ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons name="play-circle" size={32} color={colors.primary} />
                )}
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.divider} />

        {/* Speech Rate */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Speech Rate</Text>
          <Text style={styles.sectionDescription}>
            Adjust how fast the AI speaks.
          </Text>

          <View style={styles.rateRow}>
            {SPEECH_RATES.map((rate) => (
              <TouchableOpacity
                key={rate.id}
                style={[
                  styles.rateButton,
                  speechRate === rate.id && styles.rateButtonSelected,
                ]}
                onPress={() => setSpeechRate(rate.id)}
              >
                <Text style={styles.rateLabel}>{rate.label}</Text>
                <Text style={styles.rateSpeed}>{rate.speed}x</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.divider} />

        {/* Voice Interruption */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Voice Interaction</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Text style={styles.settingTitle}>Allow Interruption</Text>
              <Text style={styles.settingDescription}>
                Interrupt the AI while it's speaking to ask new questions
              </Text>
            </View>
            <Switch
              value={allowInterruption}
              onValueChange={setAllowInterruption}
              trackColor={{ false: colors.surface, true: `${colors.primary}50` }}
              thumbColor={allowInterruption ? colors.primary : colors.textSecondary}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Text style={styles.settingTitle}>Auto Greeting</Text>
              <Text style={styles.settingDescription}>
                AI greets you automatically when you open the app (once per session)
              </Text>
            </View>
            <Switch
              value={autoGreeting}
              onValueChange={setAutoGreeting}
              trackColor={{ false: colors.surface, true: `${colors.primary}50` }}
              thumbColor={autoGreeting ? colors.primary : colors.textSecondary}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
