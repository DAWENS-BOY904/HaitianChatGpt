import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react';
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

  const tones = ['Balanced', 'Creative', 'Precise', 'Casual', 'Professional'];
  
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: Platform.select({ ios: insets.top, android: insets.top, default: 0 }),
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
    },
    sectionDescription: {
      ...Typography.caption,
      color: colors.textSecondary,
      marginBottom: Spacing.md,
    },
    input: {
      backgroundColor: colors.inputBackground,
      borderRadius: BorderRadius.sm,
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
    toneOptions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    toneOption: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    toneOptionSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    toneText: {
      ...Typography.caption,
      color: colors.text,
    },
    toneTextSelected: {
      color: '#FFFFFF',
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Personalization</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Base style and tone</Text>
          <Text style={styles.sectionDescription}>
            How would you like the AI to respond?
          </Text>
          <View style={styles.toneOptions}>
            {tones.map(tone => (
              <TouchableOpacity
                key={tone}
                style={[
                  styles.toneOption,
                  settings.baseTone === tone.toLowerCase() && styles.toneOptionSelected,
                ]}
                onPress={() => updateSetting('baseTone', tone.toLowerCase())}
              >
                <Text style={[
                  styles.toneText,
                  settings.baseTone === tone.toLowerCase() && styles.toneTextSelected,
                ]}>
                  {tone}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal details</Text>
          <Text style={styles.sectionDescription}>
            Help the AI personalize responses for you
          </Text>
          
          <Text style={[styles.sectionTitle, { fontSize: 14, marginTop: Spacing.md }]}>
            Nickname
          </Text>
          <TextInput
            style={styles.input}
            placeholder="What should I call you?"
            placeholderTextColor={colors.textSecondary}
            value={settings.nickname || ''}
            onChangeText={(value) => updateSetting('nickname', value)}
          />

          <Text style={[styles.sectionTitle, { fontSize: 14, marginTop: Spacing.md }]}>
            Occupation
          </Text>
          <TextInput
            style={styles.input}
            placeholder="What do you do?"
            placeholderTextColor={colors.textSecondary}
            value={settings.occupation || ''}
            onChangeText={(value) => updateSetting('occupation', value)}
          />

          <Text style={[styles.sectionTitle, { fontSize: 14, marginTop: Spacing.md }]}>
            Interests
          </Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="What are you interested in? (comma-separated)"
            placeholderTextColor={colors.textSecondary}
            value={settings.interests?.join(', ') || ''}
            onChangeText={(value) => {
              const interests = value.split(',').map(i => i.trim()).filter(Boolean);
              updateSetting('interests', interests);
            }}
            multiline
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Memory</Text>
          <Text style={styles.sectionDescription}>
            The AI remembers details from your conversations to provide better responses
          </Text>
          <TouchableOpacity style={[styles.input, { justifyContent: 'center' }]}>
            <Text style={{ color: colors.primary }}>Manage memory</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
