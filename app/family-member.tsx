import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useAuth, useAlert } from '@/template';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';

export default function FamilyMemberScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  const [member, setMember] = useState<any>(null);
  const [dailyLimit, setDailyLimit] = useState(50);
  const [contentFilter, setContentFilter] = useState(true);

  useEffect(() => {
    loadMember();
  }, []);

  const loadMember = async () => {
    const { data } = await supabase
      .from('family_members')
      .select(`
        *,
        user_profiles!family_members_child_id_fkey(username, email)
      `)
      .eq('id', id)
      .single();

    if (data) {
      setMember(data);
      setDailyLimit(data.daily_message_limit);
      setContentFilter(data.content_filter_enabled);
    }
  };

  const updateSettings = async () => {
    const { error } = await supabase
      .from('family_members')
      .update({
        daily_message_limit: dailyLimit,
        content_filter_enabled: contentFilter,
      })
      .eq('id', id);

    if (error) {
      showAlert('Error', 'Failed to update settings');
    } else {
      showAlert('Success', 'Settings updated');
    }
  };

  const handleRemoveMember = async () => {
    showAlert('Remove Family Member', 'Are you sure you want to remove this family member?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('family_members').delete().eq('id', id);
          router.back();
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
    content: {
      padding: Spacing.md,
    },
    section: {
      marginBottom: Spacing.xl,
    },
    sectionTitle: {
      ...Typography.heading,
      color: colors.text,
      marginBottom: Spacing.md,
    },
    memberCard: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.md,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
    },
    memberName: {
      ...Typography.title,
      color: colors.text,
      marginBottom: Spacing.xs,
    },
    memberEmail: {
      ...Typography.body,
      color: colors.textSecondary,
    },
    settingItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: Spacing.md,
      backgroundColor: colors.card,
      borderRadius: BorderRadius.md,
      marginBottom: Spacing.sm,
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
    limitOptions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      marginTop: Spacing.sm,
    },
    limitOption: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    limitOptionSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    limitText: {
      ...Typography.body,
      color: colors.text,
    },
    limitTextSelected: {
      color: '#FFFFFF',
    },
    saveButton: {
      backgroundColor: colors.primary,
      borderRadius: BorderRadius.sm,
      padding: Spacing.md,
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    saveButtonText: {
      ...Typography.body,
      color: '#FFFFFF',
      fontWeight: '600',
    },
    removeButton: {
      backgroundColor: '#FF3B30',
      borderRadius: BorderRadius.sm,
      padding: Spacing.md,
      alignItems: 'center',
    },
    removeButtonText: {
      ...Typography.body,
      color: '#FFFFFF',
      fontWeight: '600',
    },
  });

  if (!member) {
    return <View style={styles.container} />;
  }

  const limitOptions = [20, 50, 100, 200, 500];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Child</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.memberCard}>
          <Text style={styles.memberName}>
            {member.user_profiles?.username || 'User'}
          </Text>
          <Text style={styles.memberEmail}>{member.user_profiles?.email}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>

          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Text style={styles.settingTitle}>Daily message limit</Text>
              <Text style={styles.settingDescription}>
                Maximum messages per day
              </Text>
              <View style={styles.limitOptions}>
                {limitOptions.map(limit => (
                  <TouchableOpacity
                    key={limit}
                    style={[
                      styles.limitOption,
                      dailyLimit === limit && styles.limitOptionSelected,
                    ]}
                    onPress={() => setDailyLimit(limit)}
                  >
                    <Text
                      style={[
                        styles.limitText,
                        dailyLimit === limit && styles.limitTextSelected,
                      ]}
                    >
                      {limit}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Text style={styles.settingTitle}>Content filter</Text>
              <Text style={styles.settingDescription}>
                Filter inappropriate content
              </Text>
            </View>
            <Switch
              value={contentFilter}
              onValueChange={setContentFilter}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </View>
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={updateSettings}>
          <Text style={styles.saveButtonText}>Save Changes</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.removeButton} onPress={handleRemoveMember}>
          <Text style={styles.removeButtonText}>Remove Family Member</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
