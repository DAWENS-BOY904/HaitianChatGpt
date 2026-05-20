/**
 * BUY COINS PAGE - PRODUCTION PAYMENT SYSTEM
 * Real Stripe/Payment integration with coin packages
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '@/template';
import { useRouter } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';

interface CoinPackage {
  id: string;
  coins: number;
  price: number;
  popular?: boolean;
  bonus?: number;
}

const COIN_PACKAGES: CoinPackage[] = [
  { id: 'basic', coins: 1000, price: 4.99 },
  { id: 'popular', coins: 5000, price: 19.99, popular: true, bonus: 500 },
  { id: 'pro', coins: 10000, price: 34.99, bonus: 2000 },
  { id: 'mega', coins: 25000, price: 79.99, bonus: 7500 },
];

export default function BuyCoinsScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  const [selectedPackage, setSelectedPackage] = useState<CoinPackage | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentCoins, setCurrentCoins] = useState(0);
  const [isUnlimited, setIsUnlimited] = useState(false);

  useEffect(() => {
    loadUserCoins();
  }, [user]);

  const loadUserCoins = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_coins')
        .select('total_coins, is_unlimited')
        .eq('user_id', user.id)
        .single();

      if (!error && data) {
        setCurrentCoins(data.total_coins || 0);
        setIsUnlimited(data.is_unlimited || false);
      }
    } catch (err) {
      console.error('Error loading coins:', err);
    }
  };

  const handleBuyPackage = async (pkg: CoinPackage) => {
    if (!user) {
      Alert.alert('Login Required', 'Please log in to purchase coins');
      router.push('/login');
      return;
    }

    setSelectedPackage(pkg);
    
    // Navigate to checkout with package info
    router.push({
      pathname: '/checkout',
      params: {
        packageId: pkg.id,
        coins: pkg.coins.toString(),
        bonus: (pkg.bonus || 0).toString(),
        price: pkg.price.toString(),
      },
    });
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingTop: insets.top + Spacing.sm,
      paddingBottom: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      padding: Spacing.sm,
    },
    headerTitle: {
      ...Typography.heading,
      fontSize: 20,
      marginLeft: Spacing.md,
      flex: 1,
    },
    content: {
      flex: 1,
    },
    balanceCard: {
      backgroundColor: colors.surface,
      margin: Spacing.md,
      padding: Spacing.lg,
      borderRadius: BorderRadius.lg,
      alignItems: 'center',
    },
    balanceLabel: {
      ...Typography.caption,
      color: colors.textSecondary,
      marginBottom: Spacing.xs,
    },
    balanceAmount: {
      ...Typography.heading,
      fontSize: 36,
      fontWeight: '700',
      color: colors.primary,
      marginBottom: Spacing.xs,
    },
    balanceUnlimited: {
      color: '#FFD700',
    },
    balanceSubtext: {
      ...Typography.caption,
      color: colors.textSecondary,
    },
    packagesSection: {
      padding: Spacing.md,
    },
    sectionTitle: {
      ...Typography.heading,
      fontSize: 18,
      marginBottom: Spacing.md,
    },
    packageCard: {
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    packageCardSelected: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}15`,
    },
    packageCardPopular: {
      borderColor: '#FFD700',
    },
    popularBadge: {
      position: 'absolute',
      top: -10,
      right: 16,
      backgroundColor: '#FFD700',
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.sm,
    },
    popularText: {
      ...Typography.caption,
      color: '#000',
      fontWeight: '700',
      fontSize: 10,
    },
    packageHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.sm,
    },
    packageCoins: {
      ...Typography.heading,
      fontSize: 24,
      fontWeight: '700',
    },
    packagePrice: {
      ...Typography.heading,
      fontSize: 24,
      color: colors.primary,
    },
    bonusText: {
      ...Typography.caption,
      color: '#4CAF50',
      marginTop: Spacing.xs,
      fontWeight: '600',
    },
    buyButton: {
      backgroundColor: colors.primary,
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.md,
      alignItems: 'center',
      marginTop: Spacing.md,
    },
    buyButtonText: {
      ...Typography.body,
      color: '#FFFFFF',
      fontWeight: '600',
    },
    adminBadge: {
      backgroundColor: '#4CAF50',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.sm,
      alignSelf: 'center',
      marginBottom: Spacing.sm,
    },
    adminText: {
      ...Typography.body,
      color: '#FFFFFF',
      fontWeight: '700',
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Buy Coins</Text>
      </View>

      <ScrollView style={styles.content}>
        {isUnlimited && (
          <View style={styles.adminBadge}>
            <Text style={styles.adminText}>✨ UNLIMITED ACCESS ✨</Text>
          </View>
        )}

        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Current Balance</Text>
          <Text style={[styles.balanceAmount, isUnlimited && styles.balanceUnlimited]}>
            {isUnlimited ? '∞' : currentCoins.toLocaleString()}
          </Text>
          <Text style={styles.balanceSubtext}>
            {isUnlimited ? 'Unlimited Coins' : 'Coins Available'}
          </Text>
        </View>

        <View style={styles.packagesSection}>
          <Text style={styles.sectionTitle}>Select Coin Package</Text>

          {COIN_PACKAGES.map((pkg) => (
            <TouchableOpacity
              key={pkg.id}
              style={[
                styles.packageCard,
                selectedPackage?.id === pkg.id && styles.packageCardSelected,
                pkg.popular && styles.packageCardPopular,
              ]}
              onPress={() => setSelectedPackage(pkg)}
            >
              {pkg.popular && (
                <View style={styles.popularBadge}>
                  <Text style={styles.popularText}>MOST POPULAR</Text>
                </View>
              )}

              <View style={styles.packageHeader}>
                <View>
                  <Text style={styles.packageCoins}>
                    {pkg.coins.toLocaleString()} Coins
                  </Text>
                  {pkg.bonus && (
                    <Text style={styles.bonusText}>
                      +{pkg.bonus.toLocaleString()} Bonus Coins!
                    </Text>
                  )}
                </View>
                <Text style={styles.packagePrice}>${pkg.price}</Text>
              </View>

              <TouchableOpacity
                style={styles.buyButton}
                onPress={() => handleBuyPackage(pkg)}
                disabled={loading}
              >
                {loading && selectedPackage?.id === pkg.id ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buyButtonText}>Purchase</Text>
                )}
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
