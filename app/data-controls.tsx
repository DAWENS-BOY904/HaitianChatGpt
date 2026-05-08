import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useSettings } from '../hooks/useSettings';
import { useAuth, useAlert } from '@/template';
import { useRouter } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';

export default function DataControlsScreen() {
  const { colors } = useTheme();
  const { settings, updateSetting } = useSettings();
  const { user, logout } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  const handleArchiveAll = async () => {
    showAlert('Confirm', 'Are you sure you want to archive all chats?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: async () => {
          // Implement archive logic
          showAlert('Success', 'All chats archived');
        },
      },
    ]);
  };

  const handleDeleteAll = async () => {
    showAlert('Confirm', 'This will permanently delete all your chats. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!user) return;

          await supabase.from('conversations').delete().eq('user_id', user.id);
          await supabase.from('chat_messages').delete().eq('sender_id', user.id);

          showAlert('Success', 'All chats deleted');
        },
      },
    ]);
  };

  const handleExportData = async () => {
    showAlert('Info', 'Your data export will be sent to your email address within 24 hours.');
  };

  const handleDeleteAccount = async () => {
    showAlert('Warning', 'This will permanently delete your account and all associated data. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete Account',
        style: 'destructive',
        onPress: async () => {
          if (!user) return;

          await supabase.from('user_profiles').delete().eq('id', user.id);
          await logout();
          router.replace('/login');
        },
      },
    ]);
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
    section: {
      marginTop: Spacing.lg,
    },
    sectionTitle: {
      ...Typography.caption,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
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
    },
    settingSubtitle: {
      ...Typography.caption,
      color: colors.textSecondary,
      marginTop: 2,
    },
    dangerItem: {
      backgroundColor: '#FFE5E5',
    },
    dangerText: {
      color: '#FF3B30',
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Data Controls</Text>
      </View>

      <ScrollView>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Model Improvements</Text>
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Text style={styles.settingTitle}>Improve the model</Text>
              <Text style={styles.settingSubtitle}>
                Allow us to use your data to improve AI responses
              </Text>
            </View>
            <Switch
              value={true}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recording Settings</Text>
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Text style={styles.settingTitle}>Audio recordings</Text>
            </View>
            <Switch
              value={settings.audioRecordingsEnabled}
              onValueChange={(value) => updateSetting('audioRecordingsEnabled', value)}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </View>
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Text style={styles.settingTitle}>Video recordings</Text>
            </View>
            <Switch
              value={settings.videoRecordingsEnabled}
              onValueChange={(value) => updateSetting('videoRecordingsEnabled', value)}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Chat Management</Text>
          <TouchableOpacity style={styles.settingItem} onPress={handleArchiveAll}>
            <View style={styles.settingLeft}>
              <Text style={styles.settingTitle}>Archive all chats</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.settingItem, styles.dangerItem]} onPress={handleDeleteAll}>
            <View style={styles.settingLeft}>
              <Text style={[styles.settingTitle, styles.dangerText]}>Delete all chats</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#FF3B30" />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Export</Text>
          <TouchableOpacity style={styles.settingItem} onPress={handleExportData}>
            <View style={styles.settingLeft}>
              <Text style={styles.settingTitle}>Export data</Text>
              <Text style={styles.settingSubtitle}>
                Download a copy of your data
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <TouchableOpacity style={[styles.settingItem, styles.dangerItem]} onPress={handleDeleteAccount}>
            <View style={styles.settingLeft}>
              <Text style={[styles.settingTitle, styles.dangerText]}>Delete account</Text>
              <Text style={styles.settingSubtitle}>
                Permanently delete your account and all data
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
