import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { getSupabaseClient } from '@/template';
import { useAlert } from '@/template';
import { router } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AdminTeamScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [email, setEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState<'admin' | 'developer' | 'editor' | 'support' | 'viewer'>('admin');
  const supabase = getSupabaseClient();

  useEffect(() => {
    loadTeamData();
  }, []);

  const loadTeamData = async () => {
    setLoading(true);
    try {
      const { data: members } = await supabase
        .from('team_members')
        .select('*, user_profiles(username, email)')
        .order('created_at', { ascending: false });

      const { data: invites } = await supabase
        .from('team_invitations')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      setTeamMembers(members || []);
      setInvitations(invites || []);
    } catch (error) {
      console.error('Team data load error:', error);
    }
    setLoading(false);
  };

  const handleSendInvitation = async () => {
    if (!email.trim()) {
      showAlert('Error', 'Please enter an email address');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-team-invitation', {
        body: { email, role: selectedRole },
      });

      if (error) throw error;

      showAlert('Success', 'Invitation sent successfully');
      setShowInviteForm(false);
      setEmail('');
      await loadTeamData();
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to send invitation');
    }
    setLoading(false);
  };

  const handleChangeRole = async (memberId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from('team_members')
        .update({ role: newRole })
        .eq('id', memberId);

      if (error) throw error;

      showAlert('Success', 'Role updated successfully');
      await loadTeamData();
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to update role');
    }
  };

  const handleToggleStatus = async (memberId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
    
    try {
      const { error } = await supabase
        .from('team_members')
        .update({ status: newStatus })
        .eq('id', memberId);

      if (error) throw error;

      showAlert('Success', `Member ${newStatus === 'active' ? 'enabled' : 'disabled'} successfully`);
      await loadTeamData();
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to update status');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    showAlert('Confirm', 'Are you sure you want to remove this team member?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase
              .from('team_members')
              .delete()
              .eq('id', memberId);

            if (error) throw error;

            showAlert('Success', 'Team member removed successfully');
            await loadTeamData();
          } catch (error: any) {
            showAlert('Error', error.message || 'Failed to remove member');
          }
        },
      },
    ]);
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner': return '#FF3B30';
      case 'admin': return '#FF9500';
      case 'developer': return '#0084FF';
      case 'editor': return '#5856D6';
      case 'support': return '#34C759';
      case 'viewer': return colors.textSecondary;
      default: return colors.text;
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
    section: {
      padding: Spacing.md,
    },
    sectionTitle: {
      ...Typography.heading,
      fontSize: 18,
      color: colors.text,
      marginBottom: Spacing.md,
    },
    inviteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      backgroundColor: colors.primary,
      borderRadius: BorderRadius.sm,
      paddingVertical: Spacing.md,
      marginBottom: Spacing.md,
    },
    inviteButtonText: {
      ...Typography.body,
      color: '#FFFFFF',
      fontWeight: '600',
    },
    formCard: {
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      marginBottom: Spacing.md,
    },
    label: {
      ...Typography.body,
      color: colors.text,
      marginBottom: Spacing.xs,
      fontWeight: '600',
    },
    input: {
      backgroundColor: colors.inputBackground,
      borderRadius: BorderRadius.sm,
      padding: Spacing.md,
      ...Typography.body,
      color: colors.text,
      marginBottom: Spacing.md,
    },
    roleSelector: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    roleButton: {
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderRadius: BorderRadius.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    roleButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    roleButtonText: {
      ...Typography.body,
      color: colors.text,
      fontSize: 14,
    },
    roleButtonTextActive: {
      color: '#FFFFFF',
      fontWeight: '600',
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: BorderRadius.sm,
      paddingVertical: Spacing.md,
      alignItems: 'center',
      marginBottom: Spacing.sm,
    },
    buttonText: {
      ...Typography.body,
      color: '#FFFFFF',
      fontWeight: '600',
    },
    secondaryButton: {
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.sm,
      paddingVertical: Spacing.md,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    secondaryButtonText: {
      ...Typography.body,
      color: colors.text,
      fontWeight: '600',
    },
    memberCard: {
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.sm,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
      borderLeftWidth: 4,
    },
    memberHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.xs,
    },
    memberName: {
      ...Typography.body,
      color: colors.text,
      fontWeight: '600',
    },
    memberEmail: {
      ...Typography.caption,
      color: colors.textSecondary,
      marginBottom: Spacing.sm,
    },
    roleBadge: {
      paddingVertical: 4,
      paddingHorizontal: Spacing.sm,
      borderRadius: BorderRadius.sm,
      alignSelf: 'flex-start',
    },
    roleBadgeText: {
      ...Typography.caption,
      fontSize: 11,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    statusBadge: {
      paddingVertical: 4,
      paddingHorizontal: Spacing.sm,
      borderRadius: BorderRadius.sm,
      marginLeft: Spacing.sm,
    },
    statusText: {
      ...Typography.caption,
      fontSize: 11,
      fontWeight: '600',
    },
    memberActions: {
      flexDirection: 'row',
      gap: Spacing.md,
      marginTop: Spacing.sm,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    actionButtonText: {
      ...Typography.caption,
      color: colors.primary,
      fontSize: 14,
    },
    invitationCard: {
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.sm,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
      borderLeftWidth: 4,
      borderLeftColor: colors.warning,
    },
    invitationEmail: {
      ...Typography.body,
      color: colors.text,
      fontWeight: '600',
      marginBottom: Spacing.xs,
    },
    invitationMeta: {
      ...Typography.caption,
      color: colors.textSecondary,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Team Management</Text>
        <TouchableOpacity onPress={() => router.push('/admin-activity-logs')}>
          <Ionicons name="time-outline" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.inviteButton}
            onPress={() => setShowInviteForm(!showInviteForm)}
          >
            <Ionicons name="person-add" size={20} color="#FFFFFF" />
            <Text style={styles.inviteButtonText}>Invite Team Member</Text>
          </TouchableOpacity>

          {showInviteForm && (
            <View style={styles.formCard}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                placeholder="team@example.com"
                placeholderTextColor={colors.textSecondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.label}>Role</Text>
              <View style={styles.roleSelector}>
                {(['admin', 'developer', 'editor', 'support', 'viewer'] as const).map(role => (
                  <TouchableOpacity
                    key={role}
                    style={[
                      styles.roleButton,
                      selectedRole === role && styles.roleButtonActive,
                    ]}
                    onPress={() => setSelectedRole(role)}
                  >
                    <Text
                      style={[
                        styles.roleButtonText,
                        selectedRole === role && styles.roleButtonTextActive,
                      ]}
                    >
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={styles.button}
                onPress={handleSendInvitation}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>Send Invitation</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => {
                  setShowInviteForm(false);
                  setEmail('');
                }}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {invitations.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pending Invitations</Text>
            {invitations.map(invite => (
              <View key={invite.id} style={styles.invitationCard}>
                <Text style={styles.invitationEmail}>{invite.email}</Text>
                <Text style={styles.invitationMeta}>
                  Role: {invite.role} • Expires: {new Date(invite.expires_at).toLocaleDateString()}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Team Members</Text>
          {teamMembers.map(member => (
            <View
              key={member.id}
              style={[
                styles.memberCard,
                { borderLeftColor: getRoleColor(member.role) },
              ]}
            >
              <View style={styles.memberHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberName}>
                    {member.user_profiles?.username || 'User'}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={[styles.roleBadge, { backgroundColor: getRoleColor(member.role) }]}>
                    <Text style={styles.roleBadgeText}>
                      {member.role.toUpperCase()}
                    </Text>
                  </View>
                  {member.status === 'disabled' && (
                    <View style={[styles.statusBadge, { backgroundColor: `${colors.danger}20` }]}>
                      <Text style={[styles.statusText, { color: colors.danger }]}>
                        DISABLED
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              
              <Text style={styles.memberEmail}>{member.user_profiles?.email}</Text>

              {member.role !== 'owner' && (
                <View style={styles.memberActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleToggleStatus(member.id, member.status)}
                  >
                    <Ionicons
                      name={member.status === 'active' ? 'pause-circle-outline' : 'play-circle-outline'}
                      size={16}
                      color={colors.primary}
                    />
                    <Text style={styles.actionButtonText}>
                      {member.status === 'active' ? 'Disable' : 'Enable'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleRemoveMember(member.id)}
                  >
                    <Ionicons name="trash-outline" size={16} color={colors.danger} />
                    <Text style={[styles.actionButtonText, { color: colors.danger }]}>
                      Remove
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
