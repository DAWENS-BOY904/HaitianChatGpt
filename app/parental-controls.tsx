import React, { useState, useEffect, useRef } from 'react';
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
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { useAuth, useAlert } from '@/template';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';
import { useTheme } from '../hooks/useTheme';
import { useSubscription } from '../hooks/useSubscription';

type FamilyRole = 'parent' | 'child';

export default function ParentalControlsScreen() {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();
  const { tier } = useSubscription();

  const [familyMembers, setFamilyMembers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [email, setEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState<FamilyRole | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);

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

  // Determine limit based on subscription
  const ADMIN_EMAILS = ['berryxoe@gmail.com', 'newdawens@gmail.com'];
  const isAdminUser = ADMIN_EMAILS.includes(user?.email?.toLowerCase() || '');
  const isPro = isAdminUser || ['go', 'plus', 'premium_monthly', 'premium_yearly', 'lifetime'].includes(tier);
  const memberLimit = isPro ? 20 : 3;

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
        user_profiles!family_members_child_id_fkey(id, username, email, full_name, profile_photo_url)
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

  const totalAdded = familyMembers.length + invitations.filter(i => i.status === 'pending' || i.status === 'accepted').length;

  const handleSendInvitation = async () => {
    if (!email.trim()) { showAlert('Error', 'Please enter an email address'); return; }
    if (!selectedRole) { showAlert('Error', 'Please select a relationship'); return; }
    if (email === user?.email) { showAlert('Error', 'You cannot add yourself'); return; }

    if (totalAdded >= memberLimit) {
      showAlert(
        isPro ? 'Limit reached' : 'Upgrade required',
        isPro
          ? `You can have up to ${memberLimit} family members.`
          : `Free accounts can have up to ${memberLimit} family members. Upgrade to Plus for up to 20.`
      );
      return;
    }

    setLoading(true);
    const invitationCode = Math.random().toString(36).substring(2, 15);
    const { data: insertData, error } = await supabase.from('parental_invitations').insert({
      parent_id: user?.id,
      child_email: email.trim().toLowerCase(),
      invitation_code: invitationCode,
      status: 'pending',
    }).select().single();
    setLoading(false);

    if (error) {
      showAlert('Error', 'Failed to send invitation');
      return;
    }

    // Send invitation email via edge function
    sendInvitationEmail(email.trim().toLowerCase(), invitationCode, user?.email || '');

    showAlert('Invitation sent', `An invitation has been sent to ${email}.`);
    setEmail('');
    setSelectedRole(null);
    setShowAddMember(false);
    await loadData();
  };

  const sendInvitationEmail = async (toEmail: string, code: string, fromEmail: string) => {
    try {
      await supabase.functions.invoke('send-parental-invitation', {
        body: { toEmail, invitationCode: code, fromEmail },
      });
    } catch (e) {
      console.log('Email send failed silently:', e);
    }
  };

  const handleResendInvitation = async (invite: any) => {
    setResendingId(invite.id);
    try {
      // Generate new code and update expiry
      const newCode = Math.random().toString(36).substring(2, 15);
      await supabase.from('parental_invitations').update({
        invitation_code: newCode,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }).eq('id', invite.id);

      sendInvitationEmail(invite.child_email, newCode, user?.email || '');
      showAlert('Resent', `Invitation email resent to ${invite.child_email}`);
    } catch (e) {
      showAlert('Error', 'Failed to resend invitation');
    } finally {
      setResendingId(null);
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
    inviteActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    emptyState: { padding: 32, alignItems: 'center' },
    emptyText: { fontSize: 14, color: secondaryText, textAlign: 'center', lineHeight: 20 },
    addBtn: {
      backgroundColor: accentGreen, borderRadius: 50,
      paddingVertical: 15, alignItems: 'center', marginTop: 24,
      flexDirection: 'row', justifyContent: 'center', gap: 8,
    },
    addBtnText: { fontSize: 17, fontWeight: '700', color: '#FFF' },
    limitBadge: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      paddingVertical: 8, gap: 6, marginTop: 10,
    },
    limitText: { fontSize: 13, color: secondaryText },
    avatarCircle: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA',
      alignItems: 'center', justifyContent: 'center',
      marginRight: 12, overflow: 'hidden',
    },
    avatarInitial: { fontSize: 16, fontWeight: '700', color: primaryText },
  });

  const HeaderContent = () => (
    <>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={18} color={primaryText} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Parental Controls</Text>
    </>
  );

  const MemberAvatar = ({ profile }: { profile: any }) => {
    const name = profile?.full_name || profile?.username || 'U';
    const initial = name[0].toUpperCase();
    return (
      <View style={styles.avatarCircle}>
        {profile?.profile_photo_url ? (
          <Image source={{ uri: profile.profile_photo_url }} style={{ width: 40, height: 40 }} contentFit="cover" />
        ) : (
          <Text style={styles.avatarInitial}>{initial}</Text>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {Platform.OS === 'ios' ? (
        <BlurView intensity={isDark ? 60 : 50} tint={isDark ? 'dark' : 'light'}
          style={[styles.header, { backgroundColor: 'transparent' }]}>
          <HeaderContent />
        </BlurView>
      ) : (
        <View style={[styles.header, { backgroundColor: bg }]}>
          <HeaderContent />
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>

          {/* Pending received invitations */}
          {pendingInvites.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>PENDING INVITATIONS FOR YOU</Text>
              <View style={styles.card}>
                {pendingInvites.map((invite, idx) => (
                  <View
                    key={invite.id}
                    style={[styles.memberRow, idx === pendingInvites.length - 1 && styles.memberRowLast]}
                  >
                    <View style={[styles.avatarCircle, { backgroundColor: '#10A37F22' }]}>
                      <Ionicons name="people" size={18} color={accentGreen} />
                    </View>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>Parent Invitation</Text>
                      <Text style={styles.memberEmail}>Someone invited you to link accounts</Text>
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
          <TouchableOpacity
            style={[styles.addBtn, totalAdded >= memberLimit && { opacity: 0.6 }]}
            onPress={() => {
              if (totalAdded >= memberLimit && !isPro) {
                showAlert('Upgrade to Plus', `Free accounts support up to ${memberLimit} family members. Upgrade for up to 20.`, [
                  { text: 'Upgrade', onPress: () => router.push('/subscription') },
                  { text: 'Cancel', style: 'cancel' },
                ]);
              } else {
                setShowAddMember(true);
              }
            }}
          >
            <Ionicons name="person-add" size={20} color="#FFF" />
            <Text style={styles.addBtnText}>Add Family Member</Text>
          </TouchableOpacity>

          <View style={styles.limitBadge}>
            <Ionicons name={isPro ? 'star' : 'people-outline'} size={14} color={secondaryText} />
            <Text style={styles.limitText}>
              {totalAdded}/{memberLimit} family members {isPro ? '(Plus)' : '(Free)'}
            </Text>
          </View>

          {/* Active Family Members */}
          <Text style={styles.sectionLabel}>FAMILY MEMBERS</Text>
          <View style={styles.card}>
            {familyMembers.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={36} color={secondaryText} style={{ marginBottom: 10 }} />
                <Text style={styles.emptyText}>No family members yet. Add one to manage their settings.</Text>
              </View>
            ) : (
              familyMembers.map((member, idx) => {
                const profile = member.user_profiles;
                const name = profile?.full_name || profile?.username || 'User';
                return (
                  <TouchableOpacity
                    key={member.id}
                    style={[styles.memberRow, idx === familyMembers.length - 1 && styles.memberRowLast]}
                    onPress={() => router.push(`/family-member?id=${member.id}`)}
                    activeOpacity={0.6}
                  >
                    <MemberAvatar profile={profile} />
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{name}</Text>
                      <Text style={styles.memberEmail}>{profile?.email}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={17} color={secondaryText} />
                  </TouchableOpacity>
                );
              })
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
                  <View style={[styles.avatarCircle, {
                    backgroundColor: invite.status === 'pending' ? '#FF950022' : invite.status === 'accepted' ? '#34C75922' : '#FF453A22',
                  }]}>
                    <Ionicons
                      name={invite.status === 'accepted' ? 'checkmark' : invite.status === 'rejected' ? 'close' : 'time'}
                      size={18}
                      color={invite.status === 'accepted' ? '#34C759' : invite.status === 'rejected' ? '#FF453A' : '#FF9500'}
                    />
                  </View>
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{invite.child_email}</Text>
                    <Text style={styles.memberEmail}>
                      {new Date(invite.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
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
                    {invite.status === 'pending' && (
                      <TouchableOpacity
                        onPress={() => handleResendInvitation(invite)}
                        disabled={resendingId === invite.id}
                        style={{
                          paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
                          backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7',
                          flexDirection: 'row', alignItems: 'center', gap: 4,
                        }}
                      >
                        {resendingId === invite.id
                          ? <ActivityIndicator size="small" color={accentGreen} />
                          : <Ionicons name="send" size={12} color={accentGreen} />}
                        <Text style={{ fontSize: 12, color: accentGreen, fontWeight: '600' }}>Resend</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>

          <View style={{ height: insets.bottom + 40 }} />
        </View>
      </ScrollView>

      {/* ── Add Member Modal ──────────────────────────────────────────────── */}
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
              <BlurView intensity={isDark ? 40 : 30} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }]} />
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
                <BlurView intensity={isDark ? 90 : 80} tint={isDark ? 'dark' : 'light'}
                  style={{ borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' }}>
                  <InviteModalBody
                    isDark={isDark} primaryText={primaryText} secondaryText={secondaryText}
                    inputBg={inputBg} inputBorder={inputBorder} surfaceBg={surfaceBg}
                    divider={divider} insets={insets} email={email} setEmail={setEmail}
                    selectedRole={selectedRole} setSelectedRole={setSelectedRole}
                    canSend={canSend} loading={loading}
                    onSend={handleSendInvitation}
                    onCancel={() => setShowAddMember(false)}
                    accentGreen={accentGreen}
                  />
                </BlurView>
              ) : (
                <View style={{ backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7', borderTopLeftRadius: 28, borderTopRightRadius: 28 }}>
                  <InviteModalBody
                    isDark={isDark} primaryText={primaryText} secondaryText={secondaryText}
                    inputBg={inputBg} inputBorder={inputBorder} surfaceBg={surfaceBg}
                    divider={divider} insets={insets} email={email} setEmail={setEmail}
                    selectedRole={selectedRole} setSelectedRole={setSelectedRole}
                    canSend={canSend} loading={loading}
                    onSend={handleSendInvitation}
                    onCancel={() => setShowAddMember(false)}
                    accentGreen={accentGreen}
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
  isDark, primaryText, secondaryText, inputBg, inputBorder, divider, insets,
  email, setEmail, selectedRole, setSelectedRole, canSend, loading, onSend, onCancel, accentGreen,
}: any) {
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      bounces={false}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
    >
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
        <Text style={{ fontSize: 17, fontWeight: '700', color: primaryText }}>Add Family Member</Text>
        <TouchableOpacity onPress={onSend} disabled={!canSend || loading} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          {loading ? (
            <ActivityIndicator size="small" color={accentGreen} />
          ) : (
            <Text style={{ fontSize: 17, fontWeight: '700', color: canSend ? accentGreen : secondaryText }}>Send</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: 20 }}>
        {/* Role selector first */}
        <Text style={{ fontSize: 16, color: primaryText, fontWeight: '600', marginBottom: 12 }}>
          This person is…
        </Text>

        <View style={{
          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
          borderRadius: 16, overflow: 'hidden', marginBottom: 20,
        }}>
          {([
            { role: 'child' as FamilyRole, label: 'My child', sub: 'You manage their account and limits', icon: 'happy-outline', color: '#FF9500' },
            { role: 'parent' as FamilyRole, label: 'My parent or guardian', sub: 'They can manage your account', icon: 'shield-outline', color: '#0A84FF' },
          ] as { role: FamilyRole; label: string; sub: string; icon: string; color: string }[]).map((item, idx, arr) => (
            <TouchableOpacity
              key={item.role}
              style={{
                flexDirection: 'row', alignItems: 'center',
                padding: 16,
                borderBottomWidth: idx < arr.length - 1 ? StyleSheet.hairlineWidth : 0,
                borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                backgroundColor: selectedRole === item.role
                  ? (isDark ? 'rgba(10,163,127,0.1)' : 'rgba(10,163,127,0.06)')
                  : 'transparent',
              }}
              onPress={() => setSelectedRole(item.role)}
              activeOpacity={0.6}
            >
              <View style={{
                width: 40, height: 40, borderRadius: 20,
                backgroundColor: `${item.color}22`,
                alignItems: 'center', justifyContent: 'center', marginRight: 14,
              }}>
                <Ionicons name={item.icon as any} size={20} color={item.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, color: primaryText, fontWeight: '500' }}>{item.label}</Text>
                <Text style={{ fontSize: 13, color: secondaryText, marginTop: 2 }}>{item.sub}</Text>
              </View>
              <View style={{
                width: 22, height: 22, borderRadius: 11,
                borderWidth: 2,
                borderColor: selectedRole === item.role ? accentGreen : secondaryText,
                alignItems: 'center', justifyContent: 'center',
              }}>
                {selectedRole === item.role && (
                  <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: accentGreen }} />
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Contextual message after role selection */}
        {selectedRole === 'child' && (
          <View style={{
            backgroundColor: isDark ? 'rgba(255,149,0,0.1)' : 'rgba(255,149,0,0.08)',
            borderRadius: 14, padding: 14, marginBottom: 16,
            borderWidth: 1, borderColor: isDark ? 'rgba(255,149,0,0.2)' : 'rgba(255,149,0,0.15)',
            flexDirection: 'row', gap: 12, alignItems: 'flex-start',
          }}>
            <Text style={{ fontSize: 24 }}>👶</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#FF9500', marginBottom: 4 }}>
                Adding a child account
              </Text>
              <Text style={{ fontSize: 13, color: secondaryText, lineHeight: 18 }}>
                You will be able to set daily message limits, enable content filters, and monitor their activity. The child will receive an email invitation to link their account.
              </Text>
            </View>
          </View>
        )}

        {selectedRole === 'parent' && (
          <View style={{
            backgroundColor: isDark ? 'rgba(10,132,255,0.1)' : 'rgba(10,132,255,0.08)',
            borderRadius: 14, padding: 14, marginBottom: 16,
            borderWidth: 1, borderColor: isDark ? 'rgba(10,132,255,0.2)' : 'rgba(10,132,255,0.15)',
            flexDirection: 'row', gap: 12, alignItems: 'flex-start',
          }}>
            <Text style={{ fontSize: 24 }}>🛡️</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#0A84FF', marginBottom: 4 }}>
                Adding a parent or guardian
              </Text>
              <Text style={{ fontSize: 13, color: secondaryText, lineHeight: 18 }}>
                Your parent or guardian will be able to monitor and manage your account settings. They will receive an email invitation to link.
              </Text>
            </View>
          </View>
        )}

        {/* Email */}
        <Text style={{ fontSize: 13, color: secondaryText, fontWeight: '500', marginBottom: 6, marginLeft: 2 }}>
          Their email address
        </Text>
        <TextInput
          style={{
            backgroundColor: inputBg, borderRadius: 12,
            paddingHorizontal: 16, paddingVertical: 14,
            fontSize: 16, color: primaryText, marginBottom: 12,
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
          borderRadius: 10, padding: 12,
        }}>
          If your family member is new to Dawinix, they will be asked to create an account before linking.
        </Text>
      </View>
    </ScrollView>
  );
}

