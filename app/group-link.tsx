import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Share,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useAuth, useAlert } from '@/template';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';

function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  let result = '';
  for (let i = 0; i < 22; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateGroupId(): string {
  const hex = () => Math.floor(Math.random() * 16).toString(16);
  return Array.from({ length: 32 }, hex).join('');
}

export default function GroupLinkScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  const params = useLocalSearchParams<{
    groupId?: string;
    conversationId?: string;
    // When opened via an invite link, these come in
    inviteCode?: string;
    token?: string;
  }>();
  const groupId = params.groupId || '';
  const conversationId = params.conversationId || '';
  const incomingInviteCode = params.inviteCode || '';
  const incomingToken = params.token || '';

  const [groupName, setGroupName] = useState('Group Chat');
  const [inviteToken, setInviteToken] = useState('');
  const [inviteId, setInviteId] = useState('');
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [username, setUsername] = useState('');
  // Whether this screen is used to JOIN (via invite link) vs MANAGE
  const isJoinMode = !!(incomingInviteCode && incomingToken);

  const baseUrl = 'https://dawinix.com/gg/v';
  const inviteLink = inviteId && inviteToken
    ? `${baseUrl}/${inviteId}?token=${inviteToken}`
    : '';

  useEffect(() => {
    if (isJoinMode) {
      loadInviteInfo();
    } else {
      loadGroupData();
    }
  }, [groupId, incomingInviteCode]);

  // ── Load invite info when joining via a link ───────────────────────────
  const loadInviteInfo = async () => {
    setLoading(true);
    try {
      const { data: invite } = await supabase
        .from('group_invites')
        .select('group_id, invite_code, id, expires_at')
        .eq('invite_code', incomingToken)
        .single();

      if (!invite) {
        setGroupName('Invalid or expired link');
        setLoading(false);
        return;
      }

      const { data: group } = await supabase
        .from('chat_groups')
        .select('name')
        .eq('id', invite.group_id)
        .single();

      if (group) setGroupName(group.name || 'Group Chat');
      setInviteId(invite.id || incomingInviteCode);
      setInviteToken(invite.invite_code);
    } catch (_e) {
      setGroupName('Group Chat');
    } finally {
      setLoading(false);
    }
  };

  // ── Load group data for MANAGE mode ───────────────────────────────────
  const loadGroupData = async () => {
    setLoading(true);
    try {
      if (user?.id) {
        const { data: profileData } = await supabase
          .from('user_profiles')
          .select('username, full_name')
          .eq('id', user.id)
          .single();
        if (profileData) {
          setUsername(profileData.username || profileData.full_name || 'User');
        }
      }

      if (!groupId) {
        setInviteToken(generateToken());
        setInviteId(generateGroupId());
        setLoading(false);
        return;
      }

      const { data: groupData } = await supabase
        .from('chat_groups')
        .select('name')
        .eq('id', groupId)
        .single();

      if (groupData) setGroupName(groupData.name || 'Group Chat');

      const { data: inviteData } = await supabase
        .from('group_invites')
        .select('invite_code, id')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (inviteData) {
        setInviteId(inviteData.id || generateGroupId());
        setInviteToken(inviteData.invite_code);
      } else {
        // Create a new invite
        const newToken = generateToken();
        const { data: newInvite } = await supabase
          .from('group_invites')
          .insert({ group_id: groupId, invite_code: newToken, created_by: user?.id })
          .select()
          .single();
        if (newInvite) {
          setInviteToken(newToken);
          setInviteId(newInvite.id || generateGroupId());
        }
      }
    } catch (_e) {
      setInviteToken(generateToken());
      setInviteId(generateGroupId());
    } finally {
      setLoading(false);
    }
  };

  // ── JOIN via invite link ──────────────────────────────────────────────
  const handleJoinGroup = useCallback(async () => {
    if (!user?.id) {
      router.push('/login');
      return;
    }
    setJoining(true);
    try {
      // Find the invite
      const { data: invite } = await supabase
        .from('group_invites')
        .select('group_id, expires_at')
        .eq('invite_code', incomingToken)
        .single();

      if (!invite) {
        showAlert('Invalid Link', 'This invite link is invalid or has expired.');
        setJoining(false);
        return;
      }

      if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
        showAlert('Expired Link', 'This invite link has expired.');
        setJoining(false);
        return;
      }

      // Add user to group_members (ignore duplicate errors)
      await supabase
        .from('group_members')
        .upsert({ group_id: invite.group_id, user_id: user.id }, { onConflict: 'group_id,user_id' });

      // Create or find a conversation for this group
      let convId: string | null = null;
      const { data: existingConv } = await supabase
        .from('conversations')
        .select('id')
        .eq('user_id', user.id)
        .ilike('title', `%${groupName}%`)
        .limit(1)
        .single();

      if (existingConv?.id) {
        convId = existingConv.id;
      } else {
        const { data: newConv } = await supabase
          .from('conversations')
          .insert({ user_id: user.id, title: groupName })
          .select('id')
          .single();
        convId = newConv?.id || null;
      }

      // Navigate to home with the group conversation active
      router.replace('/home');
    } catch (e: any) {
      showAlert('Error', e?.message || 'Failed to join group');
    } finally {
      setJoining(false);
    }
  }, [user?.id, incomingToken, groupName, supabase, router, showAlert]);

  const handleCopy = useCallback(async () => {
    if (!inviteLink) return;
    await Clipboard.setStringAsync(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [inviteLink]);

  const handleShare = useCallback(async () => {
    if (!inviteLink) return;
    try {
      await Share.share({
        message: `Join my Dawinix group chat: ${inviteLink}`,
        url: inviteLink,
      });
    } catch (_e) {}
  }, [inviteLink]);

  const handleReset = useCallback(async () => {
    Alert.alert(
      'Reset Link',
      'This will invalidate the current link and generate a new one.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            setResetting(true);
            try {
              const newToken = generateToken();
              if (groupId) {
                await supabase.from('group_invites').delete().eq('group_id', groupId);
                const { data: newInvite } = await supabase
                  .from('group_invites')
                  .insert({ group_id: groupId, invite_code: newToken, created_by: user?.id })
                  .select()
                  .single();
                if (newInvite) {
                  setInviteToken(newToken);
                  setInviteId(newInvite.id || generateGroupId());
                }
              } else {
                setInviteToken(newToken);
                setInviteId(generateGroupId());
              }
              showAlert('Link Reset', 'A new group link has been generated.');
            } catch (_e) {
              showAlert('Error', 'Failed to reset group link.');
            } finally {
              setResetting(false);
            }
          },
        },
      ]
    );
  }, [groupId, user?.id, supabase, showAlert]);

  const handleDelete = useCallback(async () => {
    Alert.alert(
      'Delete Link',
      'This will permanently delete the group invite link.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              if (groupId) {
                await supabase.from('group_invites').delete().eq('group_id', groupId);
              }
              setInviteToken('');
              setInviteId('');
              showAlert('Link Deleted', 'The group invite link has been deleted.');
              setTimeout(() => router.back(), 800);
            } catch (_e) {
              showAlert('Error', 'Failed to delete group link.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  }, [groupId, supabase, showAlert, router]);

  const bgColor = isDark ? '#0A0A0A' : '#F2F2F7';
  const cardBg = isDark ? 'rgba(44,44,46,0.9)' : '#FFF';
  const borderCol = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  const textC = isDark ? '#FFF' : '#000';
  const subC = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)';

  const actions = [
    {
      icon: copied ? 'checkmark-outline' : 'copy-outline',
      label: copied ? 'Copied!' : 'Copy',
      color: copied ? '#34C759' : textC,
      onPress: handleCopy,
      loading: false,
    },
    {
      icon: 'share-outline',
      label: 'Share',
      color: textC,
      onPress: handleShare,
      loading: false,
    },
    {
      icon: 'refresh-outline',
      label: 'Reset',
      color: textC,
      onPress: handleReset,
      loading: resetting,
    },
    {
      icon: 'trash-outline',
      label: 'Delete',
      color: '#FF453A',
      onPress: handleDelete,
      loading: deleting,
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: bgColor, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: borderCol }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.07)' }]}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={24} color={textC} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textC }]}>
          {isJoinMode ? 'Join Group' : 'Group link'}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : isJoinMode ? (
        // ── JOIN MODE ────────────────────────────────────────────────────
        <View style={styles.joinContent}>
          <View style={[styles.joinCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
            <View style={styles.groupIconWrap}>
              <Ionicons name="people" size={36} color="#007AFF" />
            </View>
            <Text style={[styles.joinGroupName, { color: textC }]}>{groupName}</Text>
            <Text style={[styles.joinDesc, { color: subC }]}>
              You were invited to join this group chat. Everyone in the group can see all messages.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.joinBtn, joining && { opacity: 0.7 }]}
            onPress={handleJoinGroup}
            disabled={joining}
            activeOpacity={0.82}
          >
            {joining ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.joinBtnText}>Join Group Chat</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={() => router.replace('/home')}>
            <Text style={[styles.cancelBtnText, { color: subC }]}>Not now</Text>
          </TouchableOpacity>
        </View>
      ) : (
        // ── MANAGE MODE ──────────────────────────────────────────────────
        <View style={styles.content}>
          <View style={styles.linkSection}>
            {inviteLink ? (
              <Text style={styles.linkText} numberOfLines={2}>{inviteLink}</Text>
            ) : (
              <Text style={[styles.linkText, { color: subC }]}>
                No link — tap Reset to generate one
              </Text>
            )}
            <Text style={[styles.linkDescription, { color: subC }]}>
              Anyone can join your group chat with this link. Anyone who joins will be able to view the entire conversation history.
            </Text>
          </View>

          <View style={[styles.divider, { backgroundColor: borderCol }]} />

          <View style={[styles.actionsContainer, { backgroundColor: cardBg, borderColor: borderCol }]}>
            {actions.map((action, index) => (
              <React.Fragment key={action.label}>
                {index > 0 && <View style={[styles.actionDivider, { backgroundColor: borderCol }]} />}
                <TouchableOpacity
                  style={styles.actionRow}
                  onPress={action.onPress}
                  activeOpacity={0.6}
                  disabled={action.loading || (!inviteLink && action.label !== 'Reset')}
                >
                  <View style={{ width: 28, alignItems: 'center', opacity: (!inviteLink && action.label !== 'Reset' && action.label !== 'Delete') ? 0.35 : 1 }}>
                    {action.loading ? (
                      <ActivityIndicator size="small" color={action.color} />
                    ) : (
                      <Ionicons name={action.icon as any} size={24} color={action.color} />
                    )}
                  </View>
                  <Text style={[
                    styles.actionLabel, { color: action.color },
                    (!inviteLink && action.label !== 'Reset' && action.label !== 'Delete') && { opacity: 0.35 },
                  ]}>
                    {action.label}
                  </Text>
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  content: { flex: 1, paddingTop: 32, paddingHorizontal: 20 },
  linkSection: { marginBottom: 24 },
  linkText: { color: '#007AFF', fontSize: 15, lineHeight: 22, marginBottom: 10, fontWeight: '500' },
  linkDescription: { fontSize: 14, lineHeight: 20 },
  divider: { height: StyleSheet.hairlineWidth, marginBottom: 8 },
  actionsContainer: { borderRadius: 16, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  actionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20, gap: 18 },
  actionLabel: { fontSize: 17, fontWeight: '400' },
  actionDivider: { height: StyleSheet.hairlineWidth, marginLeft: 66 },

  // Join mode
  joinContent: { flex: 1, paddingHorizontal: 24, paddingTop: 40, alignItems: 'center' },
  joinCard: {
    width: '100%', borderRadius: 20, padding: 28,
    alignItems: 'center', borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 28,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 12, elevation: 6,
  },
  groupIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(0,122,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  joinGroupName: { fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 10 },
  joinDesc: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
  joinBtn: {
    width: '100%', backgroundColor: '#007AFF', borderRadius: 50,
    paddingVertical: 17, alignItems: 'center', marginBottom: 14,
    shadowColor: '#007AFF', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  joinBtnText: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  cancelBtn: { paddingVertical: 12, paddingHorizontal: 24 },
  cancelBtnText: { fontSize: 15 },
});
