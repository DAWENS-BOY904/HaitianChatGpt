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
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useAuth, useAlert } from '@/template';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';
import { useTheme } from '../hooks/useTheme';

type FamilyRole = 'parent' | 'child';

export default function ParentalControlsScreen() {
  const { isDark } = useTheme();
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

  // ── Theme tokens ──────────────────────────────────────────────────────────
  const bg = isDark ? '#000000' : '#F2F2F7';
  const cardBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const primaryText = isDark ? '#FFFFFF' : '#000000';
  const secondaryText = '#8E8E93';
  const divider = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const backBtnBg = isDark ? '#2C2C2E' : 'rgba(0,0,0,0.08)';
  const headerBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const inputBg = isDark ? '#2C2C2E' : '#F2F2F7';
  const inputBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  const surfaceBg = isDark ? '#2C2C2E' : '#F2F2F7';
  const accentGreen = '#10A37F';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    if (!user) return;

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

    if (members) setFamilyMembers(members);

    const { data: sentInvites } = await supabase
      .from('parental_invitations')
      .select('*')
      .eq('parent_id', user.id)
      .order('created_at', { ascending: false });

    if (sentInvites) setInvitations(sentInvites);

    const { data: receivedInvites } = await supabase
      .from('parental_invitations')
      .select('*')
      .eq('child_email', user.email)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString());

    if (receivedInvites) setPendingInvites(receivedInvites);
  };

  const handleSendInvitation = async () => {
    if (!email.trim()) { showAlert('Error', 'Please enter an email address'); return; }
    if (!selectedRole) { showAlert('Error', 'Please select a relationship'); return; }
    if (email === user?.email) { showAlert('Error', 'You cannot add yourself'); return; }

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
    container: { flex: 1, backgroundColor: bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: insets.top + 12,
      paddingBottom: 12,
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: headerBorder,
    },
    backBtn: {
      width: 34, height: 34, borderRadius: 17,
      backgroundColor: backBtnBg,
      alignItems: 'center', justifyContent: 'center', marginRight: 12,
    },
    headerTitle: { fontSize: 17, fontWeight: '600', color: primaryText },
    content: { paddingHorizontal: 16 },
    sectionLabel: {
      fontSize: 12, color: secondaryText, fontWeight: '600',
      letterSpacing: 0.5, marginBottom: 8, marginTop: 24, marginLeft: 4,
    },
    card: {
      backgroundColor: cardBg, borderRadius: 14, overflow: 'hidden',
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0 : 0.06, shadowRadius: 4,
      elevation: isDark ? 0 : 1,
    },
    memberRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: 14, paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: divider,
    },
    memberRowLast: { borderBottomWidth: 0 },
    memberInfo: { flex: 1 },
    memberName: { fontSize: 16, color: primaryText, fontWeight: '500' },
    memberEmail: { fontSize: 13, color: secondaryText, marginTop: 2 },
    statusBadge: {
      paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
    },
    statusText: { fontSize: 12, fontWeight: '700' },
    inviteActions: { flexDirection: 'row', gap: 8 },
    emptyState: { padding: 32, alignItems: 'center' },
    emptyText: { fontSize: 14, color: secondaryText, textAlign: 'center', lineHeight: 20 },
    addBtn: {
      backgroundColor: accentGreen, borderRadius: 50,
      paddingVertical: 15, alignItems: 'center', marginTop: 24,
      flexDirection: 'row', justifyContent: 'center', gap: 8,
    },
    addBtnText: { fontSize: 17, fontWeight: '700', color: '#FFF' },
  });

  const HeaderContent = () => (
    <>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={18} color={primaryText} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Parental Controls</Text>
    </>
  );

  return (
    <View style={styles.container}>
      {/* BlurView header on iOS */}
      {Platform.OS === 'ios' ? (
        <BlurView
          intensity={isDark ? 60 : 50}
          tint={isDark ? 'dark' : 'light'}
          style={[styles.header, { backgroundColor: 'transparent' }]}
        >
          <HeaderContent />
        </BlurView>
      ) : (
        <View style={[styles.header, { backgroundColor: bg }]}>
          <HeaderContent />
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Pending received invitations */}
          {pendingInvites.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>PENDING INVITATIONS</Text>
              <View style={styles.card}>
                {pendingInvites.map((invite, idx) => (
                  <View
                    key={invite.id}
                    style={[styles.memberRow, idx === pendingInvites.length - 1 && styles.memberRowLast]}
                  >
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>Parent Invitation</Text>
                      <Text style={styles.memberEmail}>You have been invited to link accounts</Text>
                    </View>
                    <View style={styles.inviteActions}>
                      <TouchableOpacity onPress={() => handleAcceptInvitation(invite.invitation_code)}>
                        <Ionicons name="checkmark-circle" size={28} color="#34C759" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleRejectInvitation(invite.id)}>
                        <Ionicons name="close-circle" size={28} color="#FF453A" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Add button */}
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddMember(true)}>
            <Ionicons name="person-add" size={20} color="#FFF" />
            <Text style={styles.addBtnText}>Add Family Member</Text>
          </TouchableOpacity>

          {/* Family Members */}
          <Text style={styles.sectionLabel}>FAMILY MEMBERS</Text>
          <View style={styles.card}>
            {familyMembers.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={36} color={secondaryText} style={{ marginBottom: 10 }} />
                <Text style={styles.emptyText}>
                  No family members yet. Add one to manage their settings.
                </Text>
              </View>
            ) : (
              familyMembers.map((member, idx) => (
                <TouchableOpacity
                  key={member.id}
                  style={[styles.memberRow, idx === familyMembers.length - 1 && styles.memberRowLast]}
                  onPress={() => router.push(`/family-member?id=${member.id}`)}
                  activeOpacity={0.6}
                >
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{member.user_profiles?.username || 'User'}</Text>
                    <Text style={styles.memberEmail}>{member.user_profiles?.email}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={17} color={secondaryText} />
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* Sent Invitations */}
          <Text style={styles.sectionLabel}>SENT INVITATIONS</Text>
          <View style={styles.card}>
            {invitations.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No invitations sent</Text>
              </View>
            ) : (
              invitations.map((invite, idx) => (
                <View
                  key={invite.id}
                  style={[styles.memberRow, idx === invitations.length - 1 && styles.memberRowLast]}
                >
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{invite.child_email}</Text>
                    <Text style={styles.memberEmail}>
                      {new Date(invite.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, {
                    backgroundColor: invite.status === 'accepted' ? '#10A37F22'
                      : invite.status === 'rejected' ? '#FF453A22' : '#FF950022',
                  }]}>
                    <Text style={[styles.statusText, {
                      color: invite.status === 'accepted' ? '#34C759'
                        : invite.status === 'rejected' ? '#FF453A' : '#FF9500',
                    }]}>
                      {invite.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>

          <View style={{ height: insets.bottom + 40 }} />
        </View>
      </ScrollView>

      {/* ── Add Member Modal with BlurView ──────────────────────────────── */}
      <Modal
        visible={showAddMember}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddMember(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            {/* Backdrop */}
            {Platform.OS === 'ios' ? (
              <BlurView
                intensity={isDark ? 40 : 30}
                tint={isDark ? 'dark' : 'light'}
                style={StyleSheet.absoluteFill}
              />
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />
            )}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.15)' }]} />

            <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowAddMember(false)} />

            {/* Sheet */}
            <View style={{
              borderTopLeftRadius: 28, borderTopRightRadius: 28,
              overflow: 'hidden',
              shadowColor: '#000', shadowOffset: { width: 0, height: -8 },
              shadowOpacity: 0.35, shadowRadius: 24, elevation: 24,
            }}>
              {Platform.OS === 'ios' ? (
                <BlurView
                  intensity={isDark ? 90 : 75}
                  tint={isDark ? 'dark' : 'light'}
                  style={{ borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' }}
                >
                  <InviteModalBody
                    isDark={isDark}
                    primaryText={primaryText}
                    secondaryText={secondaryText}
                    inputBg={inputBg}
                    inputBorder={inputBorder}
                    surfaceBg={surfaceBg}
                    divider={divider}
                    insets={insets}
                    email={email}
                    setEmail={setEmail}
                    selectedRole={selectedRole}
                    setSelectedRole={setSelectedRole}
                    canSend={canSend}
                    loading={loading}
                    onSend={handleSendInvitation}
                    onCancel={() => setShowAddMember(false)}
                  />
                </BlurView>
              ) : (
                <View style={{ backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7', borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' }}>
                  <InviteModalBody
                    isDark={isDark}
                    primaryText={primaryText}
                    secondaryText={secondaryText}
                    inputBg={inputBg}
                    inputBorder={inputBorder}
                    surfaceBg={surfaceBg}
                    divider={divider}
                    insets={insets}
                    email={email}
                    setEmail={setEmail}
                    selectedRole={selectedRole}
                    setSelectedRole={setSelectedRole}
                    canSend={canSend}
                    loading={loading}
                    onSend={handleSendInvitation}
                    onCancel={() => setShowAddMember(false)}
                  />
                </View>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ── Invite Modal Body ─────────────────────────────────────────────────────
function InviteModalBody({
  isDark, primaryText, secondaryText, inputBg, inputBorder, surfaceBg, divider, insets,
  email, setEmail, selectedRole, setSelectedRole, canSend, loading, onSend, onCancel,
}: any) {
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      <View style={{ paddingBottom: insets.bottom + 24 }}>
        {/* Drag handle */}
        <View style={{
          alignSelf: 'center', width: 36, height: 4, borderRadius: 2,
          backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)',
          marginTop: 12, marginBottom: 16,
        }} />

        {/* Header row */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 20, marginBottom: 20,
        }}>
          <TouchableOpacity onPress={onCancel} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={{ fontSize: 17, color: secondaryText }}>Cancel</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 17, fontWeight: '700', color: primaryText }}>Invite family member</Text>
          <TouchableOpacity onPress={onSend} disabled={!canSend || loading} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            {loading ? (
              <ActivityIndicator size="small" color="#10A37F" />
            ) : (
              <Text style={{ fontSize: 17, fontWeight: '700', color: canSend ? '#10A37F' : secondaryText }}>Send</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ paddingHorizontal: 20 }}>
          {/* Email */}
          <Text style={{ fontSize: 13, color: secondaryText, fontWeight: '500', marginBottom: 6, marginLeft: 2 }}>
            Email address
          </Text>
          <TextInput
            style={{
              backgroundColor: inputBg, borderRadius: 12,
              paddingHorizontal: 16, paddingVertical: 14,
              fontSize: 16, color: primaryText, marginBottom: 16,
              borderWidth: StyleSheet.hairlineWidth, borderColor: inputBorder,
            }}
            placeholder="name@email.com"
            placeholderTextColor={secondaryText}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={{
            fontSize: 13, color: secondaryText, lineHeight: 18,
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
            borderRadius: 10, padding: 12, marginBottom: 20,
          }}>
            If your family member is new to Dawinix, they will be asked to create an account.
          </Text>

          {/* Role selector */}
          <Text style={{ fontSize: 16, color: primaryText, fontWeight: '500', marginBottom: 10 }}>This person is</Text>
          <View style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', borderRadius: 14, overflow: 'hidden' }}>
            {([
              { role: 'parent' as FamilyRole, label: 'My parent or guardian' },
              { role: 'child' as FamilyRole, label: 'My child' },
            ] as { role: FamilyRole; label: string }[]).map((item, idx, arr) => (
              <TouchableOpacity
                key={item.role}
                style={{
                  flexDirection: 'row', alignItems: 'center',
                  padding: 16,
                  borderBottomWidth: idx < arr.length - 1 ? StyleSheet.hairlineWidth : 0,
                  borderBottomColor: divider,
                }}
                onPress={() => setSelectedRole(item.role)}
                activeOpacity={0.6}
              >
                <View style={{
                  width: 22, height: 22, borderRadius: 11,
                  borderWidth: 2,
                  borderColor: selectedRole === item.role ? '#10A37F' : secondaryText,
                  alignItems: 'center', justifyContent: 'center', marginRight: 14,
                }}>
                  {selectedRole === item.role && (
                    <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: '#10A37F' }} />
                  )}
                </View>
                <Text style={{ fontSize: 16, color: primaryText }}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
