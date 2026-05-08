import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { getSupabaseClient } from '@/template';
import { router } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AdminRevenueScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [revenueData, setRevenueData] = useState<any>(null);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month' | 'year'>('month');
  const supabase = getSupabaseClient();

  useEffect(() => {
    loadRevenueData();
  }, [selectedPeriod]);

  const loadRevenueData = async () => {
    setLoading(true);
    try {
      // Calculate date range
      const now = new Date();
      let startDate: Date;
      
      switch (selectedPeriod) {
        case 'today':
          startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case 'week':
          startDate = new Date(now.setDate(now.getDate() - 7));
          break;
        case 'month':
          startDate = new Date(now.setMonth(now.getMonth() - 1));
          break;
        case 'year':
          startDate = new Date(now.setFullYear(now.getFullYear() - 1));
          break;
      }

      // Get revenue reports
      const { data: reports } = await supabase
        .from('revenue_reports')
        .select('*')
        .gte('report_date', startDate.toISOString().split('T')[0])
        .order('report_date', { ascending: false });

      // Get recent purchases
      const { data: recentPurchases } = await supabase
        .from('subscription_purchases')
        .select('*, user_profiles(username, email)')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(50);

      // Calculate totals
      const totalRevenue = reports?.reduce((sum, r) => sum + parseFloat(r.total_revenue || '0'), 0) || 0;
      const totalPlatformFees = reports?.reduce((sum, r) => sum + parseFloat(r.platform_fees || '0'), 0) || 0;
      const totalNetRevenue = reports?.reduce((sum, r) => sum + parseFloat(r.net_revenue || '0'), 0) || 0;
      const totalActiveSubscriptions = reports?.reduce((sum, r) => sum + (r.active_subscriptions || 0), 0) || 0;
      const totalNewSubscriptions = reports?.reduce((sum, r) => sum + (r.new_subscriptions || 0), 0) || 0;
      const totalIOSRevenue = reports?.reduce((sum, r) => sum + parseFloat(r.ios_revenue || '0'), 0) || 0;
      const totalAndroidRevenue = reports?.reduce((sum, r) => sum + parseFloat(r.android_revenue || '0'), 0) || 0;

      // Get payout data
      const { data: payoutData } = await supabase
        .from('payouts')
        .select('amount, status')
        .in('status', ['completed', 'processing']);

      const totalPayouts = payoutData?.reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0) || 0;
      const availableBalance = totalNetRevenue - totalPayouts;

      setRevenueData({
        totalRevenue,
        totalPlatformFees,
        totalNetRevenue,
        totalActiveSubscriptions,
        totalNewSubscriptions,
        totalIOSRevenue,
        totalAndroidRevenue,
        totalPayouts,
        availableBalance,
      });

      setPurchases(recentPurchases || []);
    } catch (error) {
      console.error('Revenue load error:', error);
    }
    setLoading(false);
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
    },
    headerTitle: {
      ...Typography.heading,
      color: colors.text,
      marginLeft: Spacing.sm,
      flex: 1,
    },
    content: {
      flex: 1,
    },
    periodSelector: {
      flexDirection: 'row',
      gap: Spacing.xs,
      padding: Spacing.md,
    },
    periodButton: {
      flex: 1,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderRadius: BorderRadius.sm,
      backgroundColor: colors.surface,
      alignItems: 'center',
    },
    periodButtonActive: {
      backgroundColor: colors.primary,
    },
    periodButtonText: {
      ...Typography.body,
      color: colors.text,
      fontSize: 14,
    },
    periodButtonTextActive: {
      color: '#FFFFFF',
      fontWeight: '600',
    },
    statsContainer: {
      padding: Spacing.md,
      gap: Spacing.md,
    },
    statCard: {
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
    },
    statLabel: {
      ...Typography.caption,
      color: colors.textSecondary,
      marginBottom: Spacing.xs,
    },
    statValue: {
      ...Typography.heading,
      fontSize: 28,
      color: colors.text,
      marginBottom: Spacing.xs,
    },
    statSubtext: {
      ...Typography.caption,
      color: colors.textSecondary,
      fontSize: 12,
    },
    balanceCard: {
      backgroundColor: colors.primary,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
    },
    balanceLabel: {
      ...Typography.caption,
      color: 'rgba(255, 255, 255, 0.8)',
      marginBottom: Spacing.xs,
    },
    balanceValue: {
      ...Typography.heading,
      fontSize: 32,
      color: '#FFFFFF',
      marginBottom: Spacing.md,
    },
    cashOutButton: {
      backgroundColor: '#FFFFFF',
      borderRadius: BorderRadius.sm,
      paddingVertical: Spacing.sm,
      alignItems: 'center',
    },
    cashOutButtonText: {
      ...Typography.body,
      color: colors.primary,
      fontWeight: '600',
    },
    sectionTitle: {
      ...Typography.heading,
      fontSize: 18,
      color: colors.text,
      padding: Spacing.md,
      paddingBottom: Spacing.sm,
    },
    purchaseItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    purchaseInfo: {
      flex: 1,
    },
    purchaseUser: {
      ...Typography.body,
      color: colors.text,
      fontWeight: '600',
    },
    purchasePlan: {
      ...Typography.caption,
      color: colors.textSecondary,
      marginTop: 2,
    },
    purchasePlatform: {
      ...Typography.caption,
      color: colors.textSecondary,
      fontSize: 11,
      marginTop: 2,
    },
    purchaseAmount: {
      alignItems: 'flex-end',
    },
    purchaseGross: {
      ...Typography.body,
      color: colors.text,
      fontWeight: '600',
    },
    purchaseNet: {
      ...Typography.caption,
      color: colors.success,
      marginTop: 2,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    platformRow: {
      flexDirection: 'row',
      gap: Spacing.md,
    },
    platformCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
    },
  });

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Revenue & Analytics</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Revenue & Analytics</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.periodSelector}>
          {(['today', 'week', 'month', 'year'] as const).map(period => (
            <TouchableOpacity
              key={period}
              style={[
                styles.periodButton,
                selectedPeriod === period && styles.periodButtonActive,
              ]}
              onPress={() => setSelectedPeriod(period)}
            >
              <Text
                style={[
                  styles.periodButtonText,
                  selectedPeriod === period && styles.periodButtonTextActive,
                ]}
              >
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Available Balance</Text>
            <Text style={styles.balanceValue}>
              ${revenueData?.availableBalance.toFixed(2)}
            </Text>
            <TouchableOpacity 
              style={styles.cashOutButton}
              onPress={() => router.push('/admin-payout')}
            >
              <Text style={styles.cashOutButtonText}>Cash Out</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total Revenue</Text>
            <Text style={styles.statValue}>
              ${revenueData?.totalRevenue.toFixed(2)}
            </Text>
            <Text style={styles.statSubtext}>
              Platform Fees: ${revenueData?.totalPlatformFees.toFixed(2)}
            </Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Net Earnings</Text>
            <Text style={styles.statValue} style={{ color: colors.success }}>
              ${revenueData?.totalNetRevenue.toFixed(2)}
            </Text>
            <Text style={styles.statSubtext}>
              After Apple/Google fees (30%)
            </Text>
          </View>

          <View style={styles.platformRow}>
            <View style={styles.platformCard}>
              <Ionicons name="logo-apple" size={24} color={colors.text} />
              <Text style={styles.statLabel}>iOS Revenue</Text>
              <Text style={[styles.statValue, { fontSize: 20 }]}>
                ${revenueData?.totalIOSRevenue.toFixed(2)}
              </Text>
            </View>

            <View style={styles.platformCard}>
              <Ionicons name="logo-google-playstore" size={24} color={colors.text} />
              <Text style={styles.statLabel}>Android Revenue</Text>
              <Text style={[styles.statValue, { fontSize: 20 }]}>
                ${revenueData?.totalAndroidRevenue.toFixed(2)}
              </Text>
            </View>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Active Subscriptions</Text>
            <Text style={styles.statValue}>
              {revenueData?.totalActiveSubscriptions}
            </Text>
            <Text style={styles.statSubtext}>
              New this period: {revenueData?.totalNewSubscriptions}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Recent Purchases</Text>
        
        {purchases.map(purchase => (
          <View key={purchase.id} style={styles.purchaseItem}>
            <View style={styles.purchaseInfo}>
              <Text style={styles.purchaseUser}>
                {purchase.user_profiles?.username || purchase.user_profiles?.email}
              </Text>
              <Text style={styles.purchasePlan}>
                {purchase.plan_id.replace('_', ' ')}
              </Text>
              <Text style={styles.purchasePlatform}>
                {purchase.platform === 'ios' ? '🍎 iOS' : '🤖 Android'} • {new Date(purchase.created_at).toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.purchaseAmount}>
              <Text style={styles.purchaseGross}>
                ${parseFloat(purchase.gross_amount).toFixed(2)}
              </Text>
              <Text style={styles.purchaseNet}>
                Net: ${parseFloat(purchase.net_amount).toFixed(2)}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
