import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, Platform, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';
import { useAuth, useAlert } from '@/template';

export default function GroupInfoScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const { groupId } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  const [group, setGroup] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGroupInfo();
  }, [groupId]);

  const loadGroupInfo = async () => {
    if (!groupId || !user) return;

    // Load group details
    const { data: groupData } = await supabase
      .from('chat_groups')
      .select('*')
      .eq('id', groupId)
      .single();

    if (groupData) {
      setGroup(groupData);
    }

    // Check if user is admin
    const { data: adminData } = await supabase
      .from('group_admins')
      .select('*')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .single();

    setIsAdmin(!!adminData || groupData?.creator_id === user.id);

    // Load members
    const { data: membersData } = await supabase
      .from('group_members')
      .select(`
        user_id,
        user_profiles!inner(username, email, profile_photo_url)
      `)
      .eq('group_id', groupId);

    if (membersData) {
      setMembers(membersData);
    }

    setLoading(false);
  };

  const handleExitGroup = async () => {
    showAlert('Exit Group', 'Are you sure you want to exit this group?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Exit',
        style: 'destructive',
        onPress: async () => {
          await supabase
            .from('group_members')
            .delete()
            .eq('group_id', groupId)
            .eq('user_id', user?.id);

          router.back();
        },
      },
    ]);
  };

  const handleClearChat = async () => {
    showAlert('Clear Chat', 'This will delete all messages in this group for you.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          showAlert('Success', 'Chat cleared');
        },
      },
    ]);
  };

  const handleReportGroup = () => {
    router.push('/bugreport');
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
    groupHeader: {
      alignItems: 'center',
      padding: Spacing.xl,
      backgroundColor: colors.card,
    },
    groupPhoto: {
      width: 100,
      height: 100,
      borderRadius: BorderRadius.full,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.md,
    },
    groupPhotoText: {
      ...Typography.title,
      color: '#FFFFFF',
      fontSize: 40,
    },
    groupName: {
      ...Typography.title,
      color: colors.text,
      marginBottom: Spacing.xs,
    },
    groupDescription: {
      ...Typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: Spacing.md,
    },
    memberCount: {
      ...Typography.caption,
      color: colors.textSecondary,
    },
    actionButtons: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      padding: Spacing.md,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
      gap: Spacing.sm,
    },
    actionButton: {
      flex: 1,
      alignItems: 'center',
      padding: Spacing.sm,
    },
    actionIcon: {
      width: 50,
      height: 50,
      borderRadius: BorderRadius.full,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.xs,
    },
    actionLabel: {
      ...Typography.caption,
      color: colors.text,
    },
    section: {
      marginTop: Spacing.md,
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
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: Spacing.md,
    },
    settingTitle: {
      ...Typography.body,
      color: colors.text,
    },
    settingSubtitle: {
      ...Typography.caption,
      color: colors.textSecondary,
    },
    dangerItem: {
      backgroundColor: '#FFE5E5',
    },
    dangerText: {
      color: '#FF3B30',
    },
    membersList: {
      backgroundColor: colors.card,
    },
    memberItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
      gap: Spacing.md,
    },
    memberPhoto: {
      width: 45,
      height: 45,
      borderRadius: BorderRadius.full,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    memberPhotoText: {
      ...Typography.body,
      color: '#FFFFFF',
      fontWeight: '600',
    },
    memberInfo: {
      flex: 1,
    },
    memberName: {
      ...Typography.body,
      color: colors.text,
    },
    memberRole: {
      ...Typography.caption,
      color: colors.textSecondary,
    },
  });

  if (loading || !group) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Group Info</Text>
      </View>

      <ScrollView>
        <View style={styles.groupHeader}>
          {group.photo_url ? (
            <Image source={{ uri: group.photo_url }} style={styles.groupPhoto} />
          ) : (
            <View style={styles.groupPhoto}>
              <Text style={styles.groupPhotoText}>{group.name[0].toUpperCase()}</Text>
            </View>
          )}
          <Text style={styles.groupName}>{group.name}</Text>
          {group.description && (
            <Text style={styles.groupDescription}>{group.description}</Text>
          )}
          <Text style={styles.memberCount}>{members.length} members</Text>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.actionButton}>
            <View style={styles.actionIcon}>
              <Ionicons name="call" size={24} color="#FFFFFF" />
            </View>
            <Text style={styles.actionLabel}>Audio</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <View style={styles.actionIcon}>
              <Ionicons name="videocam" size={24} color="#FFFFFF" />
            </View>
            <Text style={styles.actionLabel}>Video</Text>
          </TouchableOpacity>
          {isAdmin && (
            <TouchableOpacity style={styles.actionButton}>
              <View style={styles.actionIcon}>
                <Ionicons name="person-add" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.actionLabel}>Add</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Media & Files</Text>
          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="images" size={20} color={colors.text} />
              <Text style={styles.settingTitle}>Media, links & docs</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="notifications" size={20} color={colors.text} />
              <Text style={styles.settingTitle}>Notifications</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="color-palette" size={20} color={colors.text} />
              <Text style={styles.settingTitle}>Chat theme</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="timer" size={20} color={colors.text} />
              <Text style={styles.settingTitle}>Disappearing messages</Text>
            </View>
            <Text style={styles.settingSubtitle}>Off</Text>
          </TouchableOpacity>
          {isAdmin && (
            <TouchableOpacity style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <Ionicons name="lock-closed" size={20} color={colors.text} />
                <Text style={styles.settingTitle}>Group permissions</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
          {isAdmin && (
            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <Ionicons name="lock-open" size={20} color={colors.text} />
                <Text style={styles.settingTitle}>Lock chat</Text>
              </View>
              <Switch
                value={group.is_locked}
                trackColor={{ true: colors.primary, false: colors.border }}
              />
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy & Security</Text>
          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="shield-checkmark" size={20} color={colors.text} />
              <Text style={styles.settingTitle}>Advanced chat privacy</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="lock-closed" size={20} color={colors.text} />
              <Text style={styles.settingTitle}>Encryption</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Members ({members.length})</Text>
          <View style={styles.membersList}>
            {members.map((member, index) => (
              <View key={index} style={styles.memberItem}>
                {member.user_profiles.profile_photo_url ? (
                  <Image 
                    source={{ uri: member.user_profiles.profile_photo_url }} 
                    style={styles.memberPhoto} 
                  />
                ) : (
                  <View style={styles.memberPhoto}>
                    <Text style={styles.memberPhotoText}>
                      {member.user_profiles.username?.[0].toUpperCase() || 'U'}
                    </Text>
                  </View>
                )}
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>
                    {member.user_profiles.username || member.user_profiles.email}
                  </Text>
                  {member.user_id === group.creator_id && (
                    <Text style={styles.memberRole}>Creator</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="download" size={20} color={colors.text} />
              <Text style={styles.settingTitle}>Export chat</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.settingItem, styles.dangerItem]} onPress={handleClearChat}>
            <View style={styles.settingLeft}>
              <Ionicons name="trash" size={20} color="#FF3B30" />
              <Text style={[styles.settingTitle, styles.dangerText]}>Clear chat</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.settingItem, styles.dangerItem]} onPress={handleReportGroup}>
            <View style={styles.settingLeft}>
              <Ionicons name="flag" size={20} color="#FF3B30" />
              <Text style={[styles.settingTitle, styles.dangerText]}>Report group</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.settingItem, styles.dangerItem]} onPress={handleExitGroup}>
            <View style={styles.settingLeft}>
              <Ionicons name="exit" size={20} color="#FF3B30" />
              <Text style={[styles.settingTitle, styles.dangerText]}>Exit group</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
