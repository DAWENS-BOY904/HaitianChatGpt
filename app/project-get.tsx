import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '@/template';
import { useRouter } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';

interface APIKey {
  key: string;
  value: string;
  required: boolean;
}

export default function ProjectGetScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  const [projectDescription, setProjectDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [requiredKeys, setRequiredKeys] = useState<APIKey[]>([]);
  const [showKeysModal, setShowKeysModal] = useState(false);
  const [coins, setCoins] = useState(0);
  const [dailyCoins, setDailyCoins] = useState(1000);
  const [monthlyCoins, setMonthlyCoins] = useState(0);
  const [resetTime, setResetTime] = useState<string>('');
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    loadUserCoins();
  }, [user]);

  const loadUserCoins = async () => {
    if (!user) {
      setCoins(dailyCoins);
      return;
    }

    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('subscription_tier, daily_coins_used, last_coin_reset, monthly_coins_used')
        .eq('id', user.id)
        .single();

      if (profile) {
        const isProUser = profile.subscription_tier === 'pro' || profile.subscription_tier === 'premium';
        setIsPro(isProUser);

        // Check if daily reset is needed
        const now = new Date();
        const lastReset = profile.last_coin_reset ? new Date(profile.last_coin_reset) : new Date(0);
        const shouldReset = now.getTime() - lastReset.getTime() > 24 * 60 * 60 * 1000;

        if (shouldReset) {
          await supabase
            .from('user_profiles')
            .update({
              daily_coins_used: 0,
              last_coin_reset: now.toISOString(),
            })
            .eq('id', user.id);
          
          setCoins(isProUser ? 9000 : 1000);
        } else {
          const remainingDaily = 1000 - (profile.daily_coins_used || 0);
          const remainingMonthly = isProUser ? (9000 - (profile.monthly_coins_used || 0)) : 0;
          setCoins(isProUser ? remainingMonthly : remainingDaily);
        }

        // Calculate reset time
        const nextReset = new Date(lastReset.getTime() + 24 * 60 * 60 * 1000);
        const hoursLeft = Math.max(0, Math.floor((nextReset.getTime() - now.getTime()) / (1000 * 60 * 60)));
        setResetTime(`${hoursLeft}h`);
      }
    } catch (error) {
      console.error('Error loading coins:', error);
    }
  };

  const estimateCoins = (description: string): number => {
    const words = description.toLowerCase().split(' ');
    const complexity = {
      small: ['button', 'form', 'input', 'simple', 'basic', 'single'],
      medium: ['page', 'component', 'feature', 'dashboard', 'api', 'database'],
      large: ['app', 'system', 'platform', 'full', 'complete', 'project', 'website'],
    };

    let hasSmall = words.some(w => complexity.small.includes(w));
    let hasMedium = words.some(w => complexity.medium.includes(w));
    let hasLarge = words.some(w => complexity.large.includes(w));

    if (hasLarge) return Math.floor(Math.random() * 11) + 20; // 20-30 coins
    if (hasMedium) return Math.floor(Math.random() * 11) + 10; // 10-20 coins
    if (hasSmall) return Math.floor(Math.random() * 6) + 1; // 1-6 coins
    
    return Math.floor(Math.random() * 11) + 10; // Default 10-20 coins
  };

  const detectRequiredKeys = (description: string): APIKey[] => {
    const keys: APIKey[] = [];
    const lowerDesc = description.toLowerCase();

    if (lowerDesc.includes('ai') || lowerDesc.includes('chatbot') || lowerDesc.includes('openai')) {
      keys.push({
        key: 'OPENAI_API_KEY',
        value: '',
        required: true,
      });
    }

    if (lowerDesc.includes('payment') || lowerDesc.includes('stripe') || lowerDesc.includes('checkout')) {
      keys.push({
        key: 'STRIPE_SECRET_KEY',
        value: '',
        required: true,
      });
      keys.push({
        key: 'STRIPE_PUBLIC_KEY',
        value: '',
        required: true,
      });
    }

    if (lowerDesc.includes('email') || lowerDesc.includes('sendgrid') || lowerDesc.includes('mail')) {
      keys.push({
        key: 'SENDGRID_API_KEY',
        value: '',
        required: false,
      });
    }

    if (lowerDesc.includes('database') || lowerDesc.includes('supabase')) {
      keys.push({
        key: 'SUPABASE_URL',
        value: '',
        required: true,
      });
      keys.push({
        key: 'SUPABASE_ANON_KEY',
        value: '',
        required: true,
      });
    }

    return keys;
  };

  const handleGenerateProject = async () => {
    if (!projectDescription.trim()) {
      Alert.alert('Error', 'Please describe your project');
      return;
    }

    const coinsNeeded = estimateCoins(projectDescription);
    
    if (coins < coinsNeeded) {
      Alert.alert(
        'Insufficient Coins',
        `This project needs ${coinsNeeded} coins, but you only have ${coins} coins remaining.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade to Pro', onPress: () => router.push('/subscription') },
        ]
      );
      return;
    }

    const detectedKeys = detectRequiredKeys(projectDescription);
    
    if (detectedKeys.length > 0) {
      setRequiredKeys(detectedKeys);
      setShowKeysModal(true);
    } else {
      await startProjectGeneration(coinsNeeded, []);
    }
  };

  const startProjectGeneration = async (coinsNeeded: number, apiKeys: APIKey[]) => {
    setLoading(true);
    setShowKeysModal(false);

    try {
      // Deduct coins
      if (user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('daily_coins_used, monthly_coins_used')
          .eq('id', user.id)
          .single();

        if (profile) {
          await supabase
            .from('user_profiles')
            .update({
              daily_coins_used: (profile.daily_coins_used || 0) + coinsNeeded,
              monthly_coins_used: (profile.monthly_coins_used || 0) + coinsNeeded,
            })
            .eq('id', user.id);
        }
      }

      // Save API keys to database
      if (apiKeys.length > 0 && user) {
        for (const key of apiKeys.filter(k => k.value)) {
          await supabase
            .from('user_api_keys')
            .upsert({
              user_id: user.id,
              key_name: key.key,
              key_value: key.value,
              created_at: new Date().toISOString(),
            });
        }
      }

      // Call AI to generate project
      const { data, error } = await supabase.functions.invoke('generate-project', {
        body: {
          description: projectDescription,
          apiKeys: apiKeys.reduce((acc, k) => {
            if (k.value) acc[k.key] = k.value;
            return acc;
          }, {} as Record<string, string>),
          userId: user?.id,
        },
      });

      if (error) throw error;

      // Navigate to preview screen with project data
      router.push({
        pathname: '/preview',
        params: {
          projectData: JSON.stringify(data),
        },
      });

      // Reload coins
      await loadUserCoins();

    } catch (error: any) {
      console.error('Project generation error:', error);
      Alert.alert('Error', error.message || 'Failed to generate project');
    } finally {
      setLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: Platform.select({ ios: insets.top, android: insets.top }),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      ...Typography.heading,
      fontSize: 20,
      marginLeft: Spacing.sm,
      flex: 1,
    },
    coinButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.full,
      gap: Spacing.xs,
    },
    coinText: {
      ...Typography.body,
      fontWeight: '600',
      color: colors.primary,
    },
    content: {
      flex: 1,
      padding: Spacing.lg,
    },
    label: {
      ...Typography.body,
      fontWeight: '600',
      marginBottom: Spacing.sm,
    },
    input: {
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      ...Typography.body,
      color: colors.text,
      minHeight: 120,
      textAlignVertical: 'top',
      borderWidth: 1,
      borderColor: colors.border,
    },
    helperText: {
      ...Typography.caption,
      color: colors.textSecondary,
      marginTop: Spacing.sm,
    },
    generateButton: {
      backgroundColor: colors.primary,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      alignItems: 'center',
      marginTop: Spacing.lg,
    },
    generateButtonDisabled: {
      backgroundColor: colors.textSecondary,
    },
    generateButtonText: {
      ...Typography.body,
      color: '#FFFFFF',
      fontWeight: '600',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: colors.background,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      width: '90%',
      maxHeight: '80%',
    },
    modalTitle: {
      ...Typography.heading,
      fontSize: 20,
      marginBottom: Spacing.md,
    },
    keyInput: {
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      ...Typography.body,
      color: colors.text,
      marginBottom: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    keyLabel: {
      ...Typography.caption,
      fontWeight: '600',
      marginBottom: Spacing.xs,
    },
    requiredBadge: {
      color: '#FF3B30',
      fontSize: 10,
    },
    modalButtons: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginTop: Spacing.lg,
    },
    modalButton: {
      flex: 1,
      padding: Spacing.md,
      borderRadius: BorderRadius.md,
      alignItems: 'center',
    },
    cancelButton: {
      backgroundColor: colors.surface,
    },
    saveButton: {
      backgroundColor: colors.primary,
    },
    modalButtonText: {
      ...Typography.body,
      fontWeight: '600',
    },
    coinInfoModal: {
      backgroundColor: colors.background,
      borderRadius: BorderRadius.lg,
      padding: Spacing.xl,
      width: '80%',
    },
    coinInfoTitle: {
      ...Typography.heading,
      fontSize: 22,
      marginBottom: Spacing.md,
      textAlign: 'center',
    },
    coinInfoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    coinInfoLabel: {
      ...Typography.body,
      color: colors.textSecondary,
    },
    coinInfoValue: {
      ...Typography.body,
      fontWeight: '600',
    },
    upgradeButton: {
      backgroundColor: colors.primary,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      alignItems: 'center',
      marginTop: Spacing.lg,
    },
    upgradeButtonText: {
      ...Typography.body,
      color: '#FFFFFF',
      fontWeight: '600',
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Project</Text>
        <TouchableOpacity style={styles.coinButton} onPress={() => setShowKeysModal(true)}>
          <Ionicons name="cash-outline" size={20} color={colors.primary} />
          <Text style={styles.coinText}>{coins}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.label}>What do you want to build?</Text>
        <TextInput
          style={styles.input}
          placeholder="E.g., Create a chatbot with React and OpenAI..."
          placeholderTextColor={colors.textSecondary}
          value={projectDescription}
          onChangeText={setProjectDescription}
          multiline
          editable={!loading}
        />
        <Text style={styles.helperText}>
          Describe your project in detail. The AI will generate all required files, structure, and code.
        </Text>

        <TouchableOpacity
          style={[
            styles.generateButton,
            (!projectDescription.trim() || loading) && styles.generateButtonDisabled,
          ]}
          onPress={handleGenerateProject}
          disabled={!projectDescription.trim() || loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.generateButtonText}>Generate Project</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* API Keys Modal */}
      <Modal
        visible={showKeysModal && requiredKeys.length > 0}
        transparent
        animationType="fade"
        onRequestClose={() => setShowKeysModal(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalContent}
          >
            <ScrollView>
              <Text style={styles.modalTitle}>Required API Keys</Text>
              {requiredKeys.map((key, index) => (
                <View key={index}>
                  <Text style={styles.keyLabel}>
                    {key.key} {key.required && <Text style={styles.requiredBadge}>*</Text>}
                  </Text>
                  <TextInput
                    style={styles.keyInput}
                    placeholder={`Enter ${key.key}`}
                    placeholderTextColor={colors.textSecondary}
                    value={key.value}
                    onChangeText={(text) => {
                      setRequiredKeys(prev =>
                        prev.map((k, i) => (i === index ? { ...k, value: text } : k))
                      );
                    }}
                    secureTextEntry
                  />
                </View>
              ))}
            </ScrollView>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowKeysModal(false)}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={() => {
                  const missingRequired = requiredKeys.filter(k => k.required && !k.value);
                  if (missingRequired.length > 0) {
                    Alert.alert('Error', 'Please fill in all required API keys');
                    return;
                  }
                  startProjectGeneration(estimateCoins(projectDescription), requiredKeys);
                }}
              >
                <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>Save & Generate</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}
