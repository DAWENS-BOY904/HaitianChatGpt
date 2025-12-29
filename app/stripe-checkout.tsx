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
import { useAuth, useAlert } from '@/template';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';
import { Linking } from 'react-native';

export default function StripeCheckoutScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const params = useLocalSearchParams<{ priceId: string; planName: string; amount: string }>();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  const [loading, setLoading] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<'card' | 'apple_pay' | null>(null);

  const handleCheckout = async () => {
    if (!selectedMethod) {
      showAlert('Error', 'Please select a payment method');
      return;
    }

    setLoading(true);

    try {
      // Create Stripe Checkout Session via Edge Function
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          priceId: params.priceId,
          paymentMethod: selectedMethod,
        },
      });

      if (error) throw error;

      if (data?.url) {
        // Open Stripe Checkout in browser
        await Linking.openURL(data.url);
        
        // Go back after opening checkout
        setTimeout(() => {
          router.back();
        }, 1000);
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      showAlert('Error', error.message || 'Failed to create checkout session');
    } finally {
      setLoading(false);
    }
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
    planCard: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.md,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    planName: {
      ...Typography.heading,
      color: colors.text,
      marginBottom: Spacing.sm,
    },
    planPrice: {
      ...Typography.title,
      color: colors.text,
      fontSize: 32,
    },
    sectionTitle: {
      ...Typography.heading,
      color: colors.text,
      marginBottom: Spacing.md,
    },
    methodButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
      borderWidth: 2,
      borderColor: colors.border,
      gap: Spacing.md,
    },
    methodButtonSelected: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}15`,
    },
    methodInfo: {
      flex: 1,
    },
    methodName: {
      ...Typography.body,
      color: colors.text,
      fontWeight: '600',
    },
    methodDescription: {
      ...Typography.caption,
      color: colors.textSecondary,
    },
    checkoutButton: {
      backgroundColor: colors.text,
      borderRadius: BorderRadius.full,
      padding: Spacing.md,
      alignItems: 'center',
      marginTop: Spacing.xl,
    },
    checkoutButtonDisabled: {
      opacity: 0.5,
    },
    checkoutButtonText: {
      ...Typography.body,
      fontWeight: '600',
      color: colors.background,
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
        <Text style={styles.headerTitle}>Checkout</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.planCard}>
          <Text style={styles.planName}>{params.planName}</Text>
          <Text style={styles.planPrice}>${params.amount}</Text>
        </View>

        <Text style={styles.sectionTitle}>Payment method</Text>

        <TouchableOpacity
          style={[
            styles.methodButton,
            selectedMethod === 'card' && styles.methodButtonSelected,
          ]}
          onPress={() => setSelectedMethod('card')}
        >
          <Ionicons name="card" size={24} color={colors.text} />
          <View style={styles.methodInfo}>
            <Text style={styles.methodName}>Card</Text>
            <Text style={styles.methodDescription}>
              Credit or debit card
            </Text>
          </View>
          {selectedMethod === 'card' && (
            <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
          )}
        </TouchableOpacity>

        {Platform.OS === 'ios' && (
          <TouchableOpacity
            style={[
              styles.methodButton,
              selectedMethod === 'apple_pay' && styles.methodButtonSelected,
            ]}
            onPress={() => setSelectedMethod('apple_pay')}
          >
            <Ionicons name="logo-apple" size={24} color={colors.text} />
            <View style={styles.methodInfo}>
              <Text style={styles.methodName}>Apple Pay</Text>
              <Text style={styles.methodDescription}>
                Quick and secure checkout
              </Text>
            </View>
            {selectedMethod === 'apple_pay' && (
              <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.checkoutButton,
            (!selectedMethod || loading) && styles.checkoutButtonDisabled,
          ]}
          onPress={handleCheckout}
          disabled={!selectedMethod || loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.background} />
          ) : (
            <Text style={styles.checkoutButtonText}>
              Continue to Stripe Checkout
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
