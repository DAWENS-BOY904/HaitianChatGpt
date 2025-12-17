import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useAuth, useAlert } from '@/template';
import { useRouter } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';

export default function ParentalControlsScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  const [familyMembers, setFamilyMembers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [childEmail, setChildEmail] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    if (!user) return;

    // Load family members where current user is parent
    const { data: members } = await supabase
      .from('family_members')
      .select(`
        id,
        child_id,
        daily_message_limit,
        content_filter_enabled,
        user_profiles!family_members_child_id_fkey(username, email)
      `)
      .eq('parent_id', user.id);

    if (members) {
      setFamilyMembers(members);
    }

    // Load sent invitations
    const { data: sentInvites } = await supabase
      .from('parental_invitations')
      .select('*')
      .eq('parent_id', user.id)
      .order('created_at', { ascending: false });

    if (sentInvites) {
      setInvitations(sentInvites);
    }

    // Load received invitations (where user is the child)
    const { data: receivedInvites } = await supabase
      .from('parental_invitations')
      .select('*')
      .eq('child_email', user.email)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString());

    if (receivedInvites) {
      setPendingInvites(receivedInvites);
    }
  };

  const handleSendInvitation = async () => {
    if (!childEmail.trim()) {
      showAlert('Error', 'Please enter an email address');
      return;
    }

    if (childEmail === user?.email) {
      showAlert('Error', 'You cannot add yourself');
      return;
    }

    setLoading(true);

    const invitationCode = Math.random().toString(36).substring(2, 15);

    const { error } = await supabase
      .from('parental_invitations')
      .insert({
        parent_id: user?.id,
        child_email: childEmail.trim().toLowerCase(),
        invitation_code: invitationCode,
        status: 'pending',
      });

    setLoading(false);

    if (error) {
      showAlert('Error', 'Failed to send invitation');
    } else {
      showAlert('Success', `Invitation sent to ${childEmail}. They will receive an email to accept.`);
      setChildEmail('');
      setShowAddMember(false);
      await loadData();
    }
  };

  const handleAcceptInvitation = async (invitationCode: string) => {
    const { data, error } = await supabase.rpc('accept_parental_invitation', {
      invitation_code_param: invitationCode,
    });

    if (error || (data as any)?.error) {
      showAlert('Error', (data as any)?.error || 'Failed to accept invitation');
    } else {
      showAlert('Success', 'Invitation accepted. Your parent can now manage your settings.');
      await loadData();
    }
  };

  const handleRejectInvitation = async (invitationId: string) => {
    await supabase
      .from('parental_invitations')
      .update({ status: 'rejected' })
      .eq('id', invitationId);

    showAlert('Info', 'Invitation rejected');
    await loadData();
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
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      margin: Spacing.md,
      padding: Spacing.md,
      borderRadius: BorderRadius.sm,
      gap: Spacing.sm,
    },
    addButtonText: {
      ...Typography.body,
      color: '#FFFFFF',
      fontWeight: '600',
    },
    addForm: {
      backgroundColor: colors.card,
      padding: Spacing.md,
      margin: Spacing.md,
      borderRadius: BorderRadius.md,
      gap: Spacing.md,
    },
    input: {
      backgroundColor: colors.inputBackground,
      borderRadius: BorderRadius.sm,
      padding: Spacing.md,
      ...Typography.body,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
    },
    formButtons: {
      flexDirection: 'row',
      gap: Spacing.md,
    },
    button: {
      flex: 1,
      padding: Spacing.md,
      borderRadius: BorderRadius.sm,
      alignItems: 'center',
    },
    primaryButton: {
      backgroundColor: colors.primary,
    },
    secondaryButton: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    buttonText: {
      ...Typography.body,
      fontWeight: '600',
    },
    memberItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.md,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    memberInfo: {
      flex: 1,
    },
    memberName: {
      ...Typography.body,
      color: colors.text,
    },
    memberEmail: {
      ...Typography.caption,
      color: colors.textSecondary,
    },
    statusBadge: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: 4,
      borderRadius: BorderRadius.sm,
      marginLeft: Spacing.sm,
    },
    statusText: {
      ...Typography.small,
      fontWeight: '600',
    },
    inviteActions: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    iconButton: {
      padding: Spacing.xs,
    },
    emptyState: {
      padding: Spacing.xl,
      alignItems: 'center',
    },
    emptyText: {
      ...Typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Parental Controls</Text>
      </View>

      <ScrollView>
        {pendingInvites.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pending Invitations</Text>
            {pendingInvites.map(invite => (
              <View key={invite.id} style={styles.memberItem}>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>Parent Invitation</Text>
                  <Text style={styles.memberEmail}>
                    You have been invited to link accounts
                  </Text>
                </View>
                <View style={styles.inviteActions}>
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => handleAcceptInvitation(invite.invitation_code)}
                  >
                    <Ionicons name="checkmark-circle" size={28} color="#10A37F" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => handleRejectInvitation(invite.id)}
                  >
                    <Ionicons name="close-circle" size={28} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowAddMember(!showAddMember)}
        >
          <Ionicons name="person-add" size={20} color="#FFFFFF" />
          <Text style={styles.addButtonText}>Add Family Member</Text>
        </TouchableOpacity>

        {showAddMember && (
          <View style={styles.addForm}>
            <TextInput
              style={styles.input}
              placeholder="Child's email address"
              placeholderTextColor={colors.textSecondary}
              value={childEmail}
              onChangeText={setChildEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <View style={styles.formButtons}>
              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={() => {
                  setShowAddMember(false);
                  setChildEmail('');
                }}
              >
                <Text style={[styles.buttonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.primaryButton]}
                onPress={handleSendInvitation}
                disabled={loading}
              >
                <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>
                  {loading ? 'Sending...' : 'Send Invite'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Family Members</Text>
          {familyMembers.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                No family members yet. Add a family member to manage their settings.
              </Text>
            </View>
          ) : (
            familyMembers.map(member => (
              <TouchableOpacity
                key={member.id}
                style={styles.memberItem}
                onPress={() => router.push(`/family-member?id=${member.id}`)}
              >
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>
                    {member.user_profiles?.username || 'User'}
                  </Text>
                  <Text style={styles.memberEmail}>{member.user_profiles?.email}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sent Invitations</Text>
          {invitations.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No invitations sent</Text>
            </View>
          ) : (
            invitations.map(invite => (
              <View key={invite.id} style={styles.memberItem}>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{invite.child_email}</Text>
                  <Text style={styles.memberEmail}>
                    {new Date(invite.created_at).toLocaleDateString()}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        invite.status === 'accepted' ? '#10A37F20' :
                        invite.status === 'rejected' ? '#FF3B3020' :
                        '#FF950020',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      {
                        color:
                          invite.status === 'accepted' ? '#10A37F' :
                          invite.status === 'rejected' ? '#FF3B30' :
                          '#FF9500',
                      },
                    ]}
                  >
                    {invite.status.toUpperCase()}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}
