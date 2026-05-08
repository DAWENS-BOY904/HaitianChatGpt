import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { getSupabaseClient } from '@/template';
import { router } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AdminActivityLogsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<any[]>([]);
  const [filterType, setFilterType] = useState<string | null>(null);
  const supabase = getSupabaseClient();

  useEffect(() => {
    loadActivityLogs();
  }, [filterType]);

  const loadActivityLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('activity_logs')
        .select('*, user_profiles(username, email)')
        .order('created_at', { ascending: false })
        .limit(100);

      if (filterType) {
        query = query.eq('action_type', filterType);
      }

      const { data } = await query;
      setLogs(data || []);
    } catch (error) {
      console.error('Activity logs load error:', error);
    }
    setLoading(false);
  };

  const getActionTypeColor = (type: string) => {
    switch (type) {
      case 'login': return colors.success;
      case 'settings_change': return colors.primary;
      case 'content_edit': return '#5856D6';
      case 'subscription_change': return '#FF9500';
      case 'team_change': return '#FF3B30';
      default: return colors.textSecondary;
    }
  };

  const getActionTypeIcon = (type: string) => {
    switch (type) {
      case 'login': return 'log-in-outline';
      case 'settings_change': return 'settings-outline';
      case 'content_edit': return 'create-outline';
      case 'subscription_change': return 'card-outline';
      case 'team_change': return 'people-outline';
      default: return 'information-circle-outline';
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
    filterContainer: {
      flexDirection: 'row',
      padding: Spacing.md,
      gap: Spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    filterButton: {
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderRadius: BorderRadius.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterButtonText: {
      ...Typography.caption,
      color: colors.text,
      fontSize: 12,
    },
    filterButtonTextActive: {
      color: '#FFFFFF',
      fontWeight: '600',
    },
    logItem: {
      flexDirection: 'row',
      padding: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: Spacing.md,
    },
    logIcon: {
      width: 40,
      height: 40,
      borderRadius: BorderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logContent: {
      flex: 1,
    },
    logAction: {
      ...Typography.body,
      color: colors.text,
      fontWeight: '600',
      marginBottom: 4,
    },
    logUser: {
      ...Typography.caption,
      color: colors.textSecondary,
      marginBottom: 2,
    },
    logTime: {
      ...Typography.caption,
      color: colors.textSecondary,
      fontSize: 11,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.xl,
    },
    emptyText: {
      ...Typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
    },
  });

  const actionTypes = [
    { value: null, label: 'All' },
    { value: 'login', label: 'Login' },
    { value: 'settings_change', label: 'Settings' },
    { value: 'content_edit', label: 'Content' },
    { value: 'subscription_change', label: 'Subscription' },
    { value: 'team_change', label: 'Team' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Activity Logs</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer}>
        {actionTypes.map(type => (
          <TouchableOpacity
            key={type.value || 'all'}
            style={[
              styles.filterButton,
              filterType === type.value && styles.filterButtonActive,
            ]}
            onPress={() => setFilterType(type.value)}
          >
            <Text
              style={[
                styles.filterButtonText,
                filterType === type.value && styles.filterButtonTextActive,
              ]}
            >
              {type.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : logs.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No activity logs found</Text>
        </View>
      ) : (
        <ScrollView style={styles.content}>
          {logs.map(log => (
            <View key={log.id} style={styles.logItem}>
              <View
                style={[
                  styles.logIcon,
                  { backgroundColor: `${getActionTypeColor(log.action_type)}20` },
                ]}
              >
                <Ionicons
                  name={getActionTypeIcon(log.action_type) as any}
                  size={20}
                  color={getActionTypeColor(log.action_type)}
                />
              </View>
              <View style={styles.logContent}>
                <Text style={styles.logAction}>{log.action}</Text>
                <Text style={styles.logUser}>
                  {log.user_profiles?.username || log.user_profiles?.email || 'Unknown User'}
                </Text>
                <Text style={styles.logTime}>
                  {new Date(log.created_at).toLocaleString()}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
