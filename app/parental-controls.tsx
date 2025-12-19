import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  Platform,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useAuth, useAlert } from '@/template';
import { useRouter } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';

type FamilyRole = 'parent' | 'child';

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
  const [email, setEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState<FamilyRole | null>(null);
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
    if (!email.trim()) {
      showAlert('Error', 'Please enter an email address');
      return;
    }

    if (!selectedRole) {
      showAlert('Error', 'Please select a relationship');
      return;
    }

    if (email === user?.email) {
      showAlert('Error', 'You cannot add yourself');
      return;
    }

    setLoading(true);

    const invitationCode = Math.random().toString(36).substring(2, 15);

    const { error } = await supabase.from('parental_invitations').insert({
      parent_id: user?.id,
      child_email: email.trim().toLowerCase(),
      invitation_code: invitationCode,
      status: 'pending',
    });

    setLoading(false);

    if (error) {
      showAlert('Error', 'Failed to send invitation');
    } else {
      showAlert('Success', `Invitation sent to ${email}.`);
      setEmail('');
      setSelectedRole(null);
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
      showAlert('Success', 'Invitation accepted.');
      await loadData();
    }
  };

  const handleRejectInvitation = async (invitationId: string) => {
    await supabase.from('parental_invitations').update({ status: 'rejected' }).eq('id', invitationId);

    showAlert('Info', 'Invitation rejected');
    await loadData();
  };

  const canSend = email.trim().length > 0 && selectedRole !== null;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingTop: Platform.select({
        ios: insets.top + 10,
        android: insets.top + 10,
      }),
      paddingHorizontal: Spacing.md,
      paddingBottom: Spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
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
      fontSize: 18,
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
      borderRadius: BorderRadius.md,
      gap: Spacing.sm,
    },
    addButtonText: {
      ...Typography.body,
      color: '#FFFFFF',
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
      fontWeight: '500',
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

    // Modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.background,
      borderTopLeftRadius: BorderRadius.xl,
      borderTopRightRadius: BorderRadius.xl,
      paddingBottom: Platform.select({
        ios: insets.bottom + Spacing.lg,
        android: Spacing.lg,
      }),
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: Spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      ...Typography.heading,
      color: colors.text,
      fontSize: 18,
    },
    cancelText: {
      ...Typography.body,
      color: colors.text,
      fontSize: 16,
    },
    sendText: {
      ...Typography.body,
      color: colors.primary,
      fontSize: 16,
      fontWeight: '600',
    },
    sendTextDisabled: {
      opacity: 0.3,
    },
    modalBody: {
      padding: Spacing.lg,
    },
    inputLabel: {
      ...Typography.caption,
      color: colors.textSecondary,
      marginBottom: Spacing.xs,
    },
    input: {
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      ...Typography.body,
      color: colors.text,
      marginBottom: Spacing.lg,
    },
    helpText: {
      ...Typography.caption,
      color: colors.textSecondary,
      backgroundColor: colors.surface,
      padding: Spacing.md,
      borderRadius: BorderRadius.md,
      marginBottom: Spacing.lg,
    },
    roleLabel: {
      ...Typography.body,
      color: colors.text,
      marginBottom: Spacing.sm,
    },
    roleCard: {
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.lg,
      marginBottom: Spacing.sm,
    },
    roleOption: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    roleOptionLast: {
      borderBottomWidth: 0,
    },
    radioOuter: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: Spacing.md,
    },
    radioOuterSelected: {
      borderColor: colors.primary,
    },
    radioInner: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.primary,
    },
    roleText: {
      ...Typography.body,
      color: colors.text,
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
            {pendingInvites.map((invite) => (
              <View key={invite.id} style={styles.memberItem}>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>Parent Invitation</Text>
                  <Text style={styles.memberEmail}>You have been invited to link accounts</Text>
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

        <TouchableOpacity style={styles.addButton} onPress={() => setShowAddMember(true)}>
          <Ionicons name="person-add" size={20} color="#FFFFFF" />
          <Text style={styles.addButtonText}>Add Family Member</Text>
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Family Members</Text>
          {familyMembers.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                No family members yet. Add a family member to manage their settings.
              </Text>
            </View>
          ) : (
            familyMembers.map((member) => (
              <TouchableOpacity
                key={member.id}
                style={styles.memberItem}
                onPress={() => router.push(`/family-member?id=${member.id}`)}
              >
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{member.user_profiles?.username || 'User'}</Text>
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
            invitations.map((invite) => (
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
                        invite.status === 'accepted'
                          ? '#10A37F20'
                          : invite.status === 'rejected'
                          ? '#FF3B3020'
                          : '#FF950020',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      {
                        color:
                          invite.status === 'accepted'
                            ? '#10A37F'
                            : invite.status === 'rejected'
                            ? '#FF3B30'
                            : '#FF9500',
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

      {/* ADD MEMBER MODAL */}
      <Modal
        visible={showAddMember}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddMember(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAddMember(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            {/* HEADER */}
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowAddMember(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>

              <Text style={styles.modalTitle}>Invite family member</Text>

              <TouchableOpacity onPress={handleSendInvitation} disabled={!canSend || loading}>
                <Text style={[styles.sendText, (!canSend || loading) && styles.sendTextDisabled]}>
                  {loading ? 'Sending...' : 'Send'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* BODY */}
            <View style={styles.modalBody}>
              {/* EMAIL INPUT */}
              <Text style={styles.inputLabel}>Email address</Text>
              <TextInput
                style={styles.input}
                placeholder="name@email.com"
                placeholderTextColor={colors.textSecondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.helpText}>
                If your family member is new to ChatGPT, they'll be asked to create an account.
              </Text>

              {/* ROLE SELECTOR */}
              <Text style={styles.roleLabel}>This person is</Text>
              <View style={styles.roleCard}>
                <TouchableOpacity
                  style={styles.roleOption}
                  onPress={() => setSelectedRole('parent')}
                >
                  <View style={[styles.radioOuter, selectedRole === 'parent' && styles.radioOuterSelected]}>
                    {selectedRole === 'parent' && <View style={styles.radioInner} />}
                  </View>
                  <Text style={styles.roleText}>My parent or guardian</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.roleOption, styles.roleOptionLast]}
                  onPress={() => setSelectedRole('child')}
                >
                  <View style={[styles.radioOuter, selectedRole === 'child' && styles.radioOuterSelected]}>
                    {selectedRole === 'child' && <View style={styles.radioInner} />}
                  </View>
                  <Text style={styles.roleText}>My child</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
