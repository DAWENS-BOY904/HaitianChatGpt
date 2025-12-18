import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Switch,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useSettings } from '../hooks/useSettings';
import { router } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';

const VOICE_MODELS = [
  { id: 'default', name: 'Default Voice', description: 'Natural and clear', gender: 'neutral' },
  { id: 'male-1', name: 'Professional Male', description: 'Deep and authoritative', gender: 'male' },
  { id: 'female-1', name: 'Professional Female', description: 'Warm and friendly', gender: 'female' },
  { id: 'male-2', name: 'Casual Male', description: 'Relaxed and conversational', gender: 'male' },
  { id: 'female-2', name: 'Casual Female', description: 'Energetic and upbeat', gender: 'female' },
  { id: 'narrator', name: 'Narrator', description: 'Storytelling voice', gender: 'neutral' },
  { id: 'assistant', name: 'AI Assistant', description: 'Helpful and clear', gender: 'neutral' },
];

export default function VoiceControlScreen() {
  const { colors } = useTheme();
  const { settings, updateSetting } = useSettings();
  const insets = useSafeAreaInsets();

  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState(settings.voiceSelection || 'default');
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isListening]);

  const handleVoiceSelect = async (voiceId: string) => {
    setSelectedVoice(voiceId);
    await updateSetting('voiceSelection', voiceId);
  };

  const handleToggleListen = async () => {
    if (!isListening) {
      // Request microphone permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') return;
    }
    
    setIsListening(!isListening);
  };

  const handleToggleMute = () => {
    setIsMuted(!isMuted);
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: Platform.select({
        ios: insets.top,
        android: insets.top,
      }),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    backButton: {
      padding: Spacing.xs,
      marginRight: Spacing.sm,
    },
    headerTitle: {
      ...Typography.heading,
      color: colors.text,
    },
    muteButton: {
      padding: Spacing.xs,
    },
    voiceVisualizer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.xxxl,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    micButton: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.lg,
    },
    micButtonListening: {
      backgroundColor: '#FF3B30',
    },
    statusText: {
      ...Typography.heading,
      color: colors.text,
      marginBottom: Spacing.xs,
    },
    statusSubtext: {
      ...Typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
      paddingHorizontal: Spacing.xl,
    },
    content: {
      flex: 1,
      padding: Spacing.md,
    },
    section: {
      marginBottom: Spacing.lg,
    },
    sectionTitle: {
      ...Typography.heading,
      color: colors.text,
      fontSize: 16,
      marginBottom: Spacing.md,
    },
    voiceItem: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    voiceItemSelected: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}20`,
    },
    voiceHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.xs,
    },
    voiceNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    voiceName: {
      ...Typography.body,
      color: colors.text,
      fontWeight: '600',
    },
    genderBadge: {
      paddingHorizontal: Spacing.xs,
      paddingVertical: 2,
      borderRadius: BorderRadius.sm,
      backgroundColor: colors.surface,
    },
    genderText: {
      ...Typography.caption,
      color: colors.textSecondary,
      fontSize: 10,
      textTransform: 'uppercase',
    },
    voiceDescription: {
      ...Typography.caption,
      color: colors.textSecondary,
    },
    testButton: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: 4,
      borderRadius: BorderRadius.sm,
      backgroundColor: colors.primary,
    },
    testButtonText: {
      ...Typography.caption,
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '600',
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Voice Control</Text>
        </View>

        <TouchableOpacity style={styles.muteButton} onPress={handleToggleMute}>
          <Ionicons
            name={isMuted ? 'volume-mute' : 'volume-high'}
            size={24}
            color={colors.text}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.voiceVisualizer}>
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <TouchableOpacity
            style={[
              styles.micButton,
              isListening && styles.micButtonListening,
            ]}
            onPress={handleToggleListen}
          >
            <Ionicons
              name={isListening ? 'stop' : 'mic'}
              size={48}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        </Animated.View>

        <Text style={styles.statusText}>
          {isListening ? 'Listening...' : 'Tap to speak'}
        </Text>
        <Text style={styles.statusSubtext}>
          {isListening
            ? 'I\'m listening. Speak naturally in any language.'
            : 'Start a voice conversation with AI'}
        </Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Voice</Text>

          {VOICE_MODELS.map((voice) => (
            <TouchableOpacity
              key={voice.id}
              style={[
                styles.voiceItem,
                selectedVoice === voice.id && styles.voiceItemSelected,
              ]}
              onPress={() => handleVoiceSelect(voice.id)}
            >
              <View style={styles.voiceHeader}>
                <View style={styles.voiceNameRow}>
                  <Text style={styles.voiceName}>{voice.name}</Text>
                  <View style={styles.genderBadge}>
                    <Text style={styles.genderText}>{voice.gender}</Text>
                  </View>
                </View>

                {selectedVoice === voice.id ? (
                  <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                ) : (
                  <TouchableOpacity style={styles.testButton}>
                    <Text style={styles.testButtonText}>Test</Text>
                  </TouchableOpacity>
                )}
              </View>

              <Text style={styles.voiceDescription}>{voice.description}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
