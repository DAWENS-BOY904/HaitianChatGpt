import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useSettings } from '../hooks/useSettings';
import { useRouter } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function PersonalizationScreen() {
  const { colors } = useTheme();
  const { settings, updateSetting } = useSettings();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [memory, setMemory] = useState(true);
  const [webSearch, setWebSearch] = useState(true);
  const [codeExecution, setCodeExecution] = useState(false);
  const [canvas, setCanvas] = useState(true);
  const [advancedVoice, setAdvancedVoice] = useState(false);

  const tones = ['Balanced', 'Creative', 'Precise', 'Casual', 'Professional'];
  const traits = [
    'Chatty',
    'Witty',
    'Straight shooting',
    'Encouraging',
    'Gen Z',
  ];

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
      padding: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      padding: Spacing.xs,
      marginRight: Spacing.sm,
    },
    headerTitle: {
      ...Typography.heading,
      color: colors.text,
    },
    content: {
      padding: Spacing.md,
    },
    section: {
      marginBottom: Spacing.xl,
    },
    sectionTitle: {
      ...Typography.body,
      color: colors.text,
      fontWeight: '600',
      marginBottom: Spacing.sm,
      fontSize: 16,
    },
    sectionDescription: {
      ...Typography.caption,
      color: colors.textSecondary,
      marginBottom: Spacing.md,
      fontSize: 13,
    },
    input: {
      backgroundColor: colors.inputBackground,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      ...Typography.body,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: Spacing.md,
    },
    textArea: {
      minHeight: 100,
      textAlignVertical: 'top',
    },
    optionsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    option: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    optionSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    optionText: {
      ...Typography.caption,
      color: colors.text,
      fontSize: 14,
    },
    optionTextSelected: {
      color: '#FFFFFF',
    },
    switchRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.card,
      padding: Spacing.md,
      borderRadius: BorderRadius.md,
      marginBottom: Spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    switchLabel: {
      ...Typography.body,
      color: colors.text,
      flex: 1,
      marginRight: Spacing.md,
    },
    advancedSection: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.md,
      padding: Spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    advancedTitle: {
      ...Typography.heading,
      color: colors.text,
      fontSize: 18,
      marginBottom: Spacing.md,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Personalization</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Base Style and Tone */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Base style and tone</Text>
          <Text style={styles.sectionDescription}>
            How would you like the AI to respond?
          </Text>
          <View style={styles.optionsGrid}>
            {tones.map((tone) => (
              <TouchableOpacity
                key={tone}
                style={[
                  styles.option,
                  settings.baseTone === tone.toLowerCase() &&
                    styles.optionSelected,
                ]}
                onPress={() => updateSetting('baseTone', tone.toLowerCase())}
              >
                <Text
                  style={[
                    styles.optionText,
                    settings.baseTone === tone.toLowerCase() &&
                      styles.optionTextSelected,
                  ]}
                >
                  {tone}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Traits */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Traits</Text>
          <Text style={styles.sectionDescription}>
            Select personality traits for the AI
          </Text>
          <View style={styles.optionsGrid}>
            {traits.map((trait) => (
              <TouchableOpacity key={trait} style={styles.option}>
                <Text style={styles.optionText}>{trait}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Custom Instructions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Custom instructions</Text>
          <Text style={styles.sectionDescription}>
            Add specific instructions for how the AI should behave
          </Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Example: Always respond in a friendly and helpful manner..."
            placeholderTextColor={colors.textSecondary}
            value={settings.customInstructions || ''}
            onChangeText={(value) => updateSetting('customInstructions', value)}
            multiline
          />
        </View>

        {/* Personal Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal details</Text>
          <Text style={styles.sectionDescription}>
            Help the AI personalize responses for you
          </Text>

          <Text
            style={[
              styles.sectionTitle,
              { fontSize: 14, marginTop: Spacing.md },
            ]}
          >
            Nickname
          </Text>
          <TextInput
            style={styles.input}
            placeholder="What should I call you?"
            placeholderTextColor={colors.textSecondary}
            value={settings.nickname || ''}
            onChangeText={(value) => updateSetting('nickname', value)}
          />

          <Text
            style={[
              styles.sectionTitle,
              { fontSize: 14, marginTop: Spacing.md },
            ]}
          >
            Occupation
          </Text>
          <TextInput
            style={styles.input}
            placeholder="What do you do?"
            placeholderTextColor={colors.textSecondary}
            value={settings.occupation || ''}
            onChangeText={(value) => updateSetting('occupation', value)}
          />

          <Text
            style={[
              styles.sectionTitle,
              { fontSize: 14, marginTop: Spacing.md },
            ]}
          >
            Interests and preferences
          </Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="What are you interested in? (comma-separated)"
            placeholderTextColor={colors.textSecondary}
            value={settings.interests?.join(', ') || ''}
            onChangeText={(value) => {
              const interests = value
                .split(',')
                .map((i) => i.trim())
                .filter(Boolean);
              updateSetting('interests', interests);
            }}
            multiline
          />
        </View>

        {/* Memory */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Memory</Text>
          <Text style={styles.sectionDescription}>
            Allow the AI to remember details from your conversations
          </Text>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Enable memory</Text>
            <Switch
              value={memory}
              onValueChange={setMemory}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </View>
        </View>

        {/* Advanced Options */}
        <View style={styles.section}>
          <View style={styles.advancedSection}>
            <Text style={styles.advancedTitle}>Advanced options</Text>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Web search</Text>
              <Switch
                value={webSearch}
                onValueChange={setWebSearch}
                trackColor={{ true: colors.primary, false: colors.border }}
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Code execution</Text>
              <Switch
                value={codeExecution}
                onValueChange={setCodeExecution}
                trackColor={{ true: colors.primary, false: colors.border }}
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Canvas</Text>
              <Switch
                value={canvas}
                onValueChange={setCanvas}
                trackColor={{ true: colors.primary, false: colors.border }}
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Advanced voice</Text>
              <Switch
                value={advancedVoice}
                onValueChange={setAdvancedVoice}
                trackColor={{ true: colors.primary, false: colors.border }}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
