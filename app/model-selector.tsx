import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../hooks/useTheme';
import { useSettings } from '../hooks/useSettings';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const AI_MODELS = [
  { 
    id: 'gemini', 
    name: 'Gemini 2.0 Flash', 
    provider: 'Google', 
    icon: 'planet-outline', 
    free: true, 
    description: 'Fast and intelligent responses with excellent reasoning' 
  },
  { 
    id: 'openai', 
    name: 'GPT-4o', 
    provider: 'OpenAI', 
    icon: 'flash-outline', 
    free: true, 
    description: 'Advanced reasoning, creativity, and problem-solving' 
  },
  { 
    id: 'claude', 
    name: 'Claude 3.5 Sonnet', 
    provider: 'Anthropic', 
    icon: 'sparkles-outline', 
    free: true, 
    description: 'Thoughtful and nuanced responses with strong analysis' 
  },
  { 
    id: 'groq', 
    name: 'Llama 3.3 70B', 
    provider: 'Groq', 
    icon: 'rocket-outline', 
    free: true, 
    description: 'Ultra-fast processing with competitive performance' 
  },
  { 
    id: 'custom', 
    name: 'Custom AI', 
    provider: 'Local', 
    icon: 'terminal-outline', 
    free: true, 
    description: 'Use your own AI endpoint (coming soon)' 
  },
];

export default function ModelSelectorScreen() {
  const { colors } = useTheme();
  const { settings, updateSetting } = useSettings();
  const insets = useSafeAreaInsets();

  const [selectedModel, setSelectedModel] = useState(settings.preferredAiModel || 'gemini');

  const handleSelectModel = async (modelId: string) => {
    if (modelId === 'custom') {
      // Coming soon
      return;
    }
    
    setSelectedModel(modelId);
    await updateSetting('preferredAiModel', modelId);
    setTimeout(() => router.back(), 300);
  };

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
    modelCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: BorderRadius.md,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    selectedCard: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryLight,
    },
    disabledCard: {
      opacity: 0.5,
    },
    modelIcon: {
      marginRight: Spacing.md,
    },
    modelInfo: {
      flex: 1,
    },
    modelHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    modelName: {
      ...Typography.heading,
      fontSize: 16,
      color: colors.text,
      marginRight: Spacing.sm,
    },
    freeBadge: {
      backgroundColor: '#34C759',
      paddingHorizontal: Spacing.xs,
      paddingVertical: 2,
      borderRadius: BorderRadius.sm,
    },
    freeText: {
      ...Typography.caption,
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '600',
    },
    modelProvider: {
      ...Typography.caption,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    modelDescription: {
      ...Typography.caption,
      color: colors.textSecondary,
      fontSize: 12,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select AI Model</Text>
      </View>

      <ScrollView style={styles.content}>
        {AI_MODELS.map(model => (
          <TouchableOpacity
            key={model.id}
            style={[
              styles.modelCard,
              selectedModel === model.id && styles.selectedCard,
              model.id === 'custom' && styles.disabledCard,
            ]}
            onPress={() => handleSelectModel(model.id)}
            disabled={model.id === 'custom'}
          >
            <View style={styles.modelIcon}>
              <Ionicons 
                name={model.icon as any} 
                size={32} 
                color={selectedModel === model.id ? colors.primary : colors.text} 
              />
            </View>
            
            <View style={styles.modelInfo}>
              <View style={styles.modelHeader}>
                <Text style={styles.modelName}>{model.name}</Text>
                {model.free && (
                  <View style={styles.freeBadge}>
                    <Text style={styles.freeText}>FREE</Text>
                  </View>
                )}
              </View>
              <Text style={styles.modelProvider}>{model.provider}</Text>
              <Text style={styles.modelDescription}>{model.description}</Text>
            </View>

            {selectedModel === model.id && (
              <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
