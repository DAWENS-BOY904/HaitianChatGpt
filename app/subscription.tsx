import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useSubscription } from '../hooks/useSubscription';
import { useRouter } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAlert } from '@/template';

export default function SubscriptionScreen() {
  const { colors } = useTheme();
  const { tier, upgradeSubscription, restorePurchases } = useSubscription();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const plans = [
    {
      id: 'free' as const,
      name: 'Free',
      price: '$0',
      period: 'Forever',
      features: [
        '20 messages per day',
        'Basic AI responses',
        'No media uploads',
        'No group creation',
      ],
      color: '#6B7280',
    },
    {
      id: 'premium_monthly' as const,
      name: 'Premium Monthly',
      price: '$10',
      period: 'per month',
      features: [
        '1,000 messages per day',
        'Advanced AI features',
        'Media uploads',
        'Create groups (256 members)',
        'Priority support',
      ],
      color: '#10A37F',
      popular: true,
    },
    {
      id: 'premium_yearly' as const,
      name: 'Premium Yearly',
      price: '$20',
      period: 'per year',
      savings: 'Save $100/year',
      features: [
        '1,000 messages per day',
        'Advanced AI features',
        'Media uploads',
        'Create groups (256 members)',
        'Priority support',
      ],
      color: '#0084FF',
    },
    {
      id: 'lifetime' as const,
      name: 'Lifetime',
      price: '$80',
      period: 'one-time',
      savings: 'Best Value',
      features: [
        'Unlimited messages',
        'All premium features',
        'Media uploads',
        'Large groups (512 members)',
        'Lifetime updates',
        'VIP support',
      ],
      color: '#FF9500',
      recommended: true,
    },
  ];

  const handleSubscribe = async (planId: typeof tier) => {
    if (planId === tier) {
      showAlert('Info', 'You already have this plan');
      return;
    }

    const { error } = await upgradeSubscription(planId);
    if (error) {
      showAlert('Error', error);
    } else {
      showAlert('Success', `Successfully upgraded to ${plans.find(p => p.id === planId)?.name}`);
      router.back();
    }
  };

  const handleRestore = async () => {
    const { error } = await restorePurchases();
    if (error) {
      showAlert('Error', error);
    } else {
      showAlert('Success', 'Purchases restored successfully');
    }
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
    planCard: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.md,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    activePlan: {
      borderColor: colors.primary,
    },
    planHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.sm,
    },
    planName: {
      ...Typography.heading,
      color: colors.text,
    },
    badge: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: 4,
      borderRadius: BorderRadius.sm,
      backgroundColor: colors.primary,
    },
    badgeText: {
      ...Typography.small,
      color: '#FFFFFF',
      fontWeight: '600',
    },
    priceContainer: {
      marginBottom: Spacing.md,
    },
    price: {
      ...Typography.title,
      color: colors.text,
      fontSize: 32,
    },
    period: {
      ...Typography.body,
      color: colors.textSecondary,
    },
    savings: {
      ...Typography.caption,
      color: '#10A37F',
      fontWeight: '600',
      marginTop: 4,
    },
    features: {
      marginBottom: Spacing.md,
    },
    feature: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.xs,
      gap: Spacing.sm,
    },
    featureText: {
      ...Typography.body,
      color: colors.text,
    },
    subscribeButton: {
      backgroundColor: colors.primary,
      borderRadius: BorderRadius.sm,
      padding: Spacing.md,
      alignItems: 'center',
    },
    subscribedButton: {
      backgroundColor: colors.border,
    },
    buttonText: {
      ...Typography.body,
      color: '#FFFFFF',
      fontWeight: '600',
    },
    restoreButton: {
      padding: Spacing.md,
      alignItems: 'center',
      marginTop: Spacing.lg,
    },
    restoreText: {
      ...Typography.body,
      color: colors.primary,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Subscription Plans</Text>
      </View>

      <ScrollView style={styles.content}>
        {plans.map(plan => (
          <View
            key={plan.id}
            style={[
              styles.planCard,
              tier === plan.id && styles.activePlan,
            ]}
          >
            <View style={styles.planHeader}>
              <Text style={styles.planName}>{plan.name}</Text>
              {plan.popular && (
                <View style={[styles.badge, { backgroundColor: plan.color }]}>
                  <Text style={styles.badgeText}>POPULAR</Text>
                </View>
              )}
              {plan.recommended && (
                <View style={[styles.badge, { backgroundColor: plan.color }]}>
                  <Text style={styles.badgeText}>BEST VALUE</Text>
                </View>
              )}
              {tier === plan.id && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>CURRENT</Text>
                </View>
              )}
            </View>

            <View style={styles.priceContainer}>
              <Text style={styles.price}>{plan.price}</Text>
              <Text style={styles.period}>{plan.period}</Text>
              {plan.savings && <Text style={styles.savings}>{plan.savings}</Text>}
            </View>

            <View style={styles.features}>
              {plan.features.map((feature, index) => (
                <View key={index} style={styles.feature}>
                  <Ionicons name="checkmark-circle" size={20} color={plan.color} />
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[
                styles.subscribeButton,
                { backgroundColor: plan.color },
                tier === plan.id && styles.subscribedButton,
              ]}
              onPress={() => handleSubscribe(plan.id)}
              disabled={tier === plan.id}
            >
              <Text style={styles.buttonText}>
                {tier === plan.id ? 'Current Plan' : plan.id === 'free' ? 'Downgrade' : 'Subscribe'}
              </Text>
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity style={styles.restoreButton} onPress={handleRestore}>
          <Text style={styles.restoreText}>Restore Purchases</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
