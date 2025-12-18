import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useSettings } from '../hooks/useSettings';
import { useSubscription } from '../hooks/useSubscription';
import { useAlert } from '@/template';
import { useRouter } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';

interface AIModel {
  id: string;
  name: string;
  display_name: string;
  description: string;
  is_pro: boolean;
  is_enabled: boolean;
  icon: string;
  color: string;
  speed: string;
  bestFor: string;
}

export default function ModelSelectorScreen() {
  const { colors } = useTheme();
  const { settings, updateSetting } = useSettings();
  const { isPremium } = useSubscription();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  const [models, setModels] = useState<AIModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedModel, setSelectedModel] = useState(settings.preferredAiModel || 'google-gemini');

  // Enhanced model metadata
  const modelMetadata: Record<string, { icon: string; color: string; speed: string; bestFor: string }> = {
    'openai-gpt4': {
      icon: 'sparkles',
      color: '#10A37F',
      speed: 'Moderate',
      bestFor: 'Complex reasoning, detailed analysis, creative writing',
    },
    'google-gemini': {
      icon: 'flash',
      color: '#4285F4',
      speed: 'Fast',
      bestFor: 'Quick responses, general queries, multimodal tasks',
    },
    'claude-3': {
      icon: 'book',
      color: '#D97757',
      speed: 'Moderate',
      bestFor: 'Safe content, creative writing, detailed explanations',
    },
    'groq-llama': {
      icon: 'rocket',
      color: '#F55036',
      speed: 'Ultra Fast',
      bestFor: 'Real-time chat, instant responses, quick queries',
    },
    'mistral-large': {
      icon: 'code-slash',
      color: '#FF7000',
      speed: 'Fast',
      bestFor: 'Technical tasks, code generation, balanced performance',
    },
  };

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('ai_models')
      .select('*')
      .eq('is_enabled', true)
      .order('name');

    if (!error && data) {
      const enhancedModels = data.map(model => ({
        ...model,
        ...(modelMetadata[model.name] || {
          icon: 'cube',
          color: colors.primary,
          speed: 'Moderate',
          bestFor: 'General purpose',
        }),
      }));
      setModels(enhancedModels);
    }
    setLoading(false);
  };

  const handleSelectModel = async (modelName: string, isPro: boolean) => {
    if (isPro && !isPremium) {
      showAlert(
        'Premium Required',
        'This AI model is only available for Premium users. Upgrade to unlock!',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade', onPress: () => router.push('/subscription') },
        ]
      );
      return;
    }

    setSelectedModel(modelName);
    await updateSetting('preferredAiModel', modelName);
    showAlert('Success', `Switched to ${models.find(m => m.name === modelName)?.display_name}!`);
    setTimeout(() => router.back(), 500);
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#FFFFFF',
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
      borderBottomColor: '#E5E5E5',
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
      color: '#000000',
      fontSize: 18,
    },
    content: {
      flex: 1,
      padding: Spacing.md,
    },
    infoCard: {
      backgroundColor: '#F7F7F7',
      borderRadius: BorderRadius.md,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
    },
    infoTitle: {
      ...Typography.heading,
      color: '#000000',
      fontSize: 16,
      marginBottom: Spacing.xs,
    },
    infoText: {
      ...Typography.body,
      color: '#666666',
      fontSize: 14,
      lineHeight: 20,
    },
    modelCard: {
      backgroundColor: '#FFFFFF',
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
      borderWidth: 2,
      borderColor: '#E5E5E5',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    modelCardSelected: {
      borderColor: '#10A37F',
      backgroundColor: '#F0FFF4',
    },
    modelHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: BorderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: Spacing.md,
    },
    modelInfo: {
      flex: 1,
    },
    modelName: {
      ...Typography.heading,
      color: '#000000',
      fontSize: 17,
      marginBottom: 2,
    },
    modelSpeed: {
      ...Typography.caption,
      color: '#666666',
      fontSize: 12,
    },
    proBadge: {
      backgroundColor: '#10A37F',
      paddingHorizontal: Spacing.sm,
      paddingVertical: 4,
      borderRadius: BorderRadius.sm,
    },
    proBadgeText: {
      ...Typography.caption,
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '600',
    },
    modelDescription: {
      ...Typography.body,
      color: '#666666',
      fontSize: 14,
      lineHeight: 20,
      marginBottom: Spacing.sm,
    },
    bestForContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#F7F7F7',
      padding: Spacing.sm,
      borderRadius: BorderRadius.sm,
      marginBottom: Spacing.md,
    },
    bestForLabel: {
      ...Typography.caption,
      color: '#000000',
      fontSize: 12,
      fontWeight: '600',
      marginRight: Spacing.xs,
    },
    bestForText: {
      ...Typography.caption,
      color: '#666666',
      fontSize: 12,
      flex: 1,
    },
    selectButton: {
      backgroundColor: '#10A37F',
      borderRadius: BorderRadius.md,
      paddingVertical: Spacing.sm,
      alignItems: 'center',
    },
    selectButtonSelected: {
      backgroundColor: '#0D8A6A',
    },
    selectButtonDisabled: {
      backgroundColor: '#E5E5E5',
    },
    selectButtonText: {
      ...Typography.body,
      color: '#FFFFFF',
      fontWeight: '600',
      fontSize: 14,
    },
    selectButtonTextDisabled: {
      color: '#999999',
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#FFFFFF',
    },
  });

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#000000" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Select AI Model</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10A37F" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#000000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select AI Model</Text>
        </View>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Choose Your AI Assistant</Text>
          <Text style={styles.infoText}>
            Each AI model has unique strengths. Select the one that best fits your needs. You can switch anytime without losing your conversation.
          </Text>
        </View>

        {models.map((model) => (
          <View
            key={model.id}
            style={[
              styles.modelCard,
              selectedModel === model.name && styles.modelCardSelected,
            ]}
          >
            <View style={styles.modelHeader}>
              <View style={[styles.iconContainer, { backgroundColor: `${model.color}20` }]}>
                <Ionicons name={model.icon as any} size={24} color={model.color} />
              </View>

              <View style={styles.modelInfo}>
                <Text style={styles.modelName}>{model.display_name}</Text>
                <Text style={styles.modelSpeed}>{model.speed} • {model.is_pro ? 'Premium' : 'Free'}</Text>
              </View>

              {model.is_pro && (
                <View style={styles.proBadge}>
                  <Text style={styles.proBadgeText}>PRO</Text>
                </View>
              )}
            </View>

            <Text style={styles.modelDescription}>{model.description}</Text>

            <View style={styles.bestForContainer}>
              <Text style={styles.bestForLabel}>Best for:</Text>
              <Text style={styles.bestForText}>{model.bestFor}</Text>
            </View>

            <TouchableOpacity
              style={[
                styles.selectButton,
                selectedModel === model.name && styles.selectButtonSelected,
                model.is_pro && !isPremium && styles.selectButtonDisabled,
              ]}
              onPress={() => handleSelectModel(model.name, model.is_pro)}
              disabled={selectedModel === model.name}
            >
              <Text
                style={[
                  styles.selectButtonText,
                  model.is_pro && !isPremium && styles.selectButtonTextDisabled,
                ]}
              >
                {selectedModel === model.name ? 'Currently Selected' : model.is_pro && !isPremium ? 'Upgrade to Unlock' : 'Select This Model'}
              </Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
