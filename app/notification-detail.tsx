import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Switch, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useAuth, useAlert } from '@/template';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';

export default function NotificationDetailScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const { category } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('notification_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (data) {
      const pushKey = `${category}_push` as keyof typeof data;
      const emailKey = `${category}_email` as keyof typeof data;
      setPushEnabled(data[pushKey] as boolean);
      setEmailEnabled(data[emailKey] as boolean);
    }

    setLoading(false);
  };

  const updateSetting = async (type: 'push' | 'email', value: boolean) => {
    if (!user) return;

    const key = `${category}_${type}`;
    
    await supabase
      .from('notification_settings')
      .update({ [key]: value })
      .eq('user_id', user.id);

    if (type === 'push') {
      setPushEnabled(value);
    } else {
      setEmailEnabled(value);
    }
  };

  const categoryLabels: Record<string, string> = {
    responses: 'Responses',
    group_chats: 'Group chats',
    tasks: 'Tasks',
    projects: 'Projects',
    recommendations: 'Recommendations',
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
    settingItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: Spacing.md,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    settingLeft: {
      flex: 1,
    },
    settingTitle: {
      ...Typography.body,
      color: colors.text,
      marginBottom: 4,
    },
    settingDescription: {
      ...Typography.caption,
      color: colors.textSecondary,
    },
  });

  if (loading) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{categoryLabels[category as string]}</Text>
      </View>

      <View style={styles.settingItem}>
        <View style={styles.settingLeft}>
          <Text style={styles.settingTitle}>Push notifications</Text>
          <Text style={styles.settingDescription}>
            Receive push notifications on your device
          </Text>
        </View>
        <Switch
          value={pushEnabled}
          onValueChange={(value) => updateSetting('push', value)}
          trackColor={{ true: colors.primary, false: colors.border }}
        />
      </View>

      <View style={styles.settingItem}>
        <View style={styles.settingLeft}>
          <Text style={styles.settingTitle}>Email notifications</Text>
          <Text style={styles.settingDescription}>
            Receive notifications via email
          </Text>
        </View>
        <Switch
          value={emailEnabled}
          onValueChange={(value) => updateSetting('email', value)}
          trackColor={{ true: colors.primary, false: colors.border }}
        />
      </View>
    </View>
  );
}
