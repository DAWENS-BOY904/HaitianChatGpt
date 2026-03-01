import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
  Image,
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
  color: string;
  speed: string;
  bestFor: string;
}

/* 🖼️ PHOTOS DES MODÈLES */
const modelImages: Record<string, any> = {
  'openai-gpt4': require('../assets/models/IMG_0834.jpeg'),
  'google-gemini': require('../assets/models/IMG_0835.png'),
  'google-gemini-2.0-flash': require('../assets/models/IMG_0835.png'), // Using same Google icon
  'google-gemini-pro': require('../assets/models/IMG_0835.png'), // Using same Google icon
  'claude-3': require('../assets/models/IMG_0836.png'),
  'groq-llama': require('../assets/models/IMG_0837.png'),
  'mistral-large': require('../assets/models/IMG_0838.png'),
};

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
  const [selectedModel, setSelectedModel] = useState(
    settings.preferredAiModel || 'google-gemini'
  );

  // RECOMMENDED MODELS ONLY - PRODUCTION READY
  const modelMetadata: Record<
    string,
    { color: string; speed: string; bestFor: string }
  > = {
    'google-gemini': {
      color: '#4285F4',
      speed: 'Fast',
      bestFor: 'Best all-around AI - Fast responses, images, code, multilingual',
    },
    'google-gemini-2.0-flash': {
      color: '#4285F4',
      speed: 'Very Fast',
      bestFor: 'Latest Gemini - Image generation, multimodal AI, advanced reasoning',
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
      const enhanced = data.map((model) => ({
        ...model,
        ...(modelMetadata[model.name] || {
          color: colors.primary,
          speed: 'Moderate',
          bestFor: 'General purpose',
        }),
      }));
      setModels(enhanced);
    }

    setLoading(false);
  };

  const handleSelectModel = async (modelName: string, isPro: boolean) => {
    if (isPro && !isPremium) {
      showAlert(
        'Premium Required',
        'This model is for Premium users only.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade', onPress: () => router.push('/subscription') },
        ]
      );
      return;
    }

    setSelectedModel(modelName);
    await updateSetting('preferredAiModel', modelName);
    showAlert('Success', 'Model selected successfully');
    setTimeout(() => router.back(), 400);
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#FFF',
      paddingTop: Platform.select({ ios: insets.top, android: insets.top }),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: '#E5E5E5',
    },
    headerTitle: {
      ...Typography.heading,
      fontSize: 18,
      marginLeft: Spacing.sm,
    },
    content: {
      padding: Spacing.md,
    },
    modelCard: {
      backgroundColor: '#FFF',
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
      borderWidth: 2,
      borderColor: '#E5E5E5',
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
    imageContainer: {
      width: 52,
      height: 52,
      borderRadius: BorderRadius.md,
      backgroundColor: '#F5F5F5',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: Spacing.md,
    },
    modelImage: {
      width: 36,
      height: 36,
      resizeMode: 'contain',
    },
    modelName: {
      ...Typography.heading,
      fontSize: 16,
    },
    modelSpeed: {
      ...Typography.caption,
      fontSize: 12,
      color: '#666',
    },
    description: {
      ...Typography.body,
      color: '#666',
      marginBottom: Spacing.sm,
    },
    button: {
      backgroundColor: '#10A37F',
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.md,
      alignItems: 'center',
    },
    buttonDisabled: {
      backgroundColor: '#E5E5E5',
    },
    buttonText: {
      color: '#FFF',
      fontWeight: '600',
    },
  });

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#10A37F" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select AI Model</Text>
      </View>

      <ScrollView style={styles.content}>
        {models.map((model) => (
          <View
            key={model.id}
            style={[
              styles.modelCard,
              selectedModel === model.name && styles.modelCardSelected,
            ]}
          >
            <View style={styles.modelHeader}>
              <View style={styles.imageContainer}>
                <Image
                  source={modelImages[model.name]}
                  style={styles.modelImage}
                />
              </View>

              <View>
                <Text style={styles.modelName}>{model.display_name}</Text>
                <Text style={styles.modelSpeed}>
                  {model.speed} • {model.is_pro ? 'Premium' : 'Free'}
                </Text>
              </View>
            </View>

            <Text style={styles.description}>{model.description}</Text>

            <TouchableOpacity
              style={[
                styles.button,
                model.is_pro && !isPremium && styles.buttonDisabled,
              ]}
              disabled={selectedModel === model.name}
              onPress={() => handleSelectModel(model.name, model.is_pro)}
            >
              <Text style={styles.buttonText}>
                {selectedModel === model.name
                  ? 'Selected'
                  : model.is_pro && !isPremium
                  ? 'Upgrade to unlock'
                  : 'Select'}
              </Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
