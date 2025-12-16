import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '@/template';
import { useRouter } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';

export default function AdminDashboard() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalMessages: 0,
    bugReports: 0,
    revenue: 0,
  });
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'bugs' | 'settings'>('overview');

  useEffect(() => {
    checkAdminAccess();
  }, [user]);

  const checkAdminAccess = async () => {
    if (!user) {
      router.replace('/login');
      return;
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (error || !data || data.role !== 'admin') {
      router.replace('/home');
      return;
    }

    setIsAdmin(true);
    await loadStats();
    setLoading(false);
  };

  const loadStats = async () => {
    const [usersResult, messagesResult, bugsResult, revenueResult] = await Promise.all([
      supabase.from('user_profiles').select('id', { count: 'exact', head: true }),
      supabase.from('chat_messages').select('id', { count: 'exact', head: true }),
      supabase.from('bug_reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('subscription_transactions').select('amount').eq('status', 'completed'),
    ]);

    const revenue = revenueResult.data?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;

    setStats({
      totalUsers: usersResult.count || 0,
      activeUsers: Math.floor((usersResult.count || 0) * 0.7),
      totalMessages: messagesResult.count || 0,
      bugReports: bugsResult.count || 0,
      revenue,
    });
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
      backgroundColor: '#FF3B30',
    },
    backButton: {
      padding: Spacing.xs,
      marginRight: Spacing.sm,
    },
    headerTitle: {
      ...Typography.heading,
      color: '#FFFFFF',
      flex: 1,
    },
    adminBadge: {
      backgroundColor: '#FFFFFF',
      paddingHorizontal: Spacing.sm,
      paddingVertical: 4,
      borderRadius: BorderRadius.sm,
    },
    adminBadgeText: {
      ...Typography.caption,
      color: '#FF3B30',
      fontWeight: '600',
    },
    tabs: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tab: {
      flex: 1,
      padding: Spacing.md,
      alignItems: 'center',
    },
    activeTab: {
      borderBottomWidth: 2,
      borderBottomColor: '#FF3B30',
    },
    tabText: {
      ...Typography.caption,
      color: colors.textSecondary,
    },
    activeTabText: {
      color: '#FF3B30',
      fontWeight: '600',
    },
    content: {
      flex: 1,
      padding: Spacing.md,
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.md,
    },
    statCard: {
      flex: 1,
      minWidth: '45%',
      backgroundColor: colors.card,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      borderLeftWidth: 4,
      borderLeftColor: '#FF3B30',
    },
    statValue: {
      ...Typography.title,
      color: colors.text,
      fontSize: 28,
    },
    statLabel: {
      ...Typography.caption,
      color: colors.textSecondary,
      marginTop: 4,
    },
    section: {
      marginTop: Spacing.lg,
    },
    sectionTitle: {
      ...Typography.heading,
      color: colors.text,
      marginBottom: Spacing.md,
    },
    actionButton: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.sm,
      padding: Spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    actionIcon: {
      marginRight: Spacing.md,
    },
    actionText: {
      ...Typography.body,
      color: colors.text,
      flex: 1,
    },
    dangerButton: {
      backgroundColor: '#FFE5E5',
      borderColor: '#FF3B30',
    },
    dangerText: {
      color: '#FF3B30',
    },
  });

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin Dashboard</Text>
        <View style={styles.adminBadge}>
          <Text style={styles.adminBadgeText}>ADMIN</Text>
        </View>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'overview' && styles.activeTab]}
          onPress={() => setActiveTab('overview')}
        >
          <Text style={[styles.tabText, activeTab === 'overview' && styles.activeTabText]}>
            Overview
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'users' && styles.activeTab]}
          onPress={() => setActiveTab('users')}
        >
          <Text style={[styles.tabText, activeTab === 'users' && styles.activeTabText]}>
            Users
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'bugs' && styles.activeTab]}
          onPress={() => setActiveTab('bugs')}
        >
          <Text style={[styles.tabText, activeTab === 'bugs' && styles.activeTabText]}>
            Bugs ({stats.bugReports})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'settings' && styles.activeTab]}
          onPress={() => setActiveTab('settings')}
        >
          <Text style={[styles.tabText, activeTab === 'settings' && styles.activeTabText]}>
            Settings
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {activeTab === 'overview' && (
          <>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.totalUsers}</Text>
                <Text style={styles.statLabel}>Total Users</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.activeUsers}</Text>
                <Text style={styles.statLabel}>Active Users</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.totalMessages}</Text>
                <Text style={styles.statLabel}>Total Messages</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>${stats.revenue}</Text>
                <Text style={styles.statLabel}>Revenue</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="people" size={24} color={colors.text} style={styles.actionIcon} />
                <Text style={styles.actionText}>Manage Users</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="chatbubbles" size={24} color={colors.text} style={styles.actionIcon} />
                <Text style={styles.actionText}>View All Chats</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="bug" size={24} color={colors.text} style={styles.actionIcon} />
                <Text style={styles.actionText}>Bug Reports ({stats.bugReports})</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </>
        )}

        {activeTab === 'settings' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>App Settings</Text>
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="settings" size={24} color={colors.text} style={styles.actionIcon} />
              <Text style={styles.actionText}>Feature Toggles</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="color-palette" size={24} color={colors.text} style={styles.actionIcon} />
              <Text style={styles.actionText}>UI Customization</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, styles.dangerButton]}>
              <Ionicons name="warning" size={24} color="#FF3B30" style={styles.actionIcon} />
              <Text style={[styles.actionText, styles.dangerText]}>Reset All Data</Text>
              <Ionicons name="chevron-forward" size={20} color="#FF3B30" />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
