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
import { useSubscription } from '../hooks/useSubscription';
import { useSettings } from '../hooks/useSettings';
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
}

export default function ModelSelectorScreen() {
  const { colors } = useTheme();
  const { tier } = useSubscription();
  const { settings, updateSetting } = useSettings();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  const [models, setModels] = useState<AIModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedModel, setSelectedModel] = useState(
    settings.preferredAiModel || 'gemini'
  );

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('ai_models')
      .select('*')
      .eq('is_enabled', true)
      .order('is_pro', { ascending: true });

    if (!error && data) {
      setModels(data);
    }
    setLoading(false);
  };

  const handleSelectModel = async (modelName: string, isPro: boolean) => {
    if (isPro && tier === 'free') {
      router.push('/subscription');
      return;
    }

    setSelectedModel(modelName);
    await updateSetting('preferredAiModel', modelName);
    setTimeout(() => router.back(), 500);
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
    lockedCard: {
      opacity: 0.6,
    },
    modelHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: Spacing.sm,
    },
    modelName: {
      ...Typography.heading,
      color: colors.text,
      fontSize: 18,
      flex: 1,
    },
    proBadge: {
      backgroundColor: '#FFD700',
      paddingHorizontal: Spacing.sm,
      paddingVertical: 4,
      borderRadius: BorderRadius.sm,
      marginLeft: Spacing.sm,
    },
    proBadgeText: {
      ...Typography.caption,
      color: '#000000',
      fontWeight: '600',
      fontSize: 10,
    },
    lockIcon: {
      marginLeft: Spacing.sm,
    },
    modelDescription: {
      ...Typography.body,
      color: colors.textSecondary,
      marginBottom: Spacing.sm,
    },
    selectedIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      marginTop: Spacing.xs,
    },
    selectedText: {
      ...Typography.caption,
      color: colors.primary,
      fontWeight: '600',
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
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
        <Text style={styles.headerTitle}>Select AI Model</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.content}>
          {models.map((model) => {
            const isLocked = model.is_pro && tier === 'free';
            const isSelected = selectedModel === model.name;

            return (
              <TouchableOpacity
                key={model.id}
                style={[
                  styles.modelCard,
                  isSelected && styles.selectedCard,
                  isLocked && styles.lockedCard,
                ]}
                onPress={() => handleSelectModel(model.name, model.is_pro)}
              >
                <View style={styles.modelHeader}>
                  <Text style={styles.modelName}>{model.display_name}</Text>
                  {model.is_pro && (
                    <View style={styles.proBadge}>
                      <Text style={styles.proBadgeText}>PRO</Text>
                    </View>
                  )}
                  {isLocked && (
                    <Ionicons
                      name="lock-closed"
                      size={20}
                      color={colors.textSecondary}
                      style={styles.lockIcon}
                    />
                  )}
                </View>

                <Text style={styles.modelDescription}>
                  {model.description}
                </Text>

                {isSelected && (
                  <View style={styles.selectedIndicator}>
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color={colors.primary}
                    />
                    <Text style={styles.selectedText}>Currently selected</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
