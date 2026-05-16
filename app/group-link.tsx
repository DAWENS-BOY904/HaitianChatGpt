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
  ScrollView,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
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
    inviteCode?: string;
    token?: string;
  }>();
  const groupId = params.groupId || '';
  const conversationId = params.conversationId || '';
  const incomingInviteCode = params.inviteCode || '';
  const incomingToken = params.token || '';

  const [groupName, setGroupName] = useState('New group chat');
  const [inviteToken, setInviteToken] = useState('');
  const [inviteId, setInviteId] = useState('');
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [username, setUsername] = useState('');
  const [creatorPhotoUrl, setCreatorPhotoUrl] = useState<string | null>(null);
  const [creatorName, setCreatorName] = useState('');

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
        .select('group_id, invite_code, id, expires_at, created_by')
        .eq('invite_code', incomingToken)
        .single();

      if (!invite) {
        setGroupName('Invalid or expired link');
        setLoading(false);
        return;
      }

      const { data: group } = await supabase
        .from('chat_groups')
        .select('name, creator_id')
        .eq('id', invite.group_id)
        .single();

      if (group) setGroupName(group.name || 'New group chat');
      setInviteId(invite.id || incomingInviteCode);
      setInviteToken(invite.invite_code);

      // Load creator profile for the avatar shown in join screen
      const creatorId = group?.creator_id || invite.created_by;
      if (creatorId) {
        const { data: creator } = await supabase
          .from('user_profiles')
          .select('username, full_name, profile_photo_url')
          .eq('id', creatorId)
          .single();
        if (creator) {
          setCreatorPhotoUrl(creator.profile_photo_url || null);
          setCreatorName(creator.full_name || creator.username || 'User');
        }
      }
    } catch (_e) {
      setGroupName('New group chat');
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

      if (groupData) setGroupName(groupData.name || 'New group chat');

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

      // Add user to group_members
      await supabase
        .from('group_members')
        .upsert({ group_id: invite.group_id, user_id: user.id }, { onConflict: 'group_id,user_id' });

      // Create or find a conversation for this group
      const { data: existingConv } = await supabase
        .from('conversations')
        .select('id')
        .eq('user_id', user.id)
        .ilike('title', `%${groupName}%`)
        .limit(1)
        .single();

      if (!existingConv?.id) {
        await supabase
          .from('conversations')
          .insert({ user_id: user.id, title: groupName });
      }

      // Navigate to home and activate group mode
      router.replace({ pathname: '/home', params: { joinedGroupName: groupName, joinedGroupId: invite.group_id } } as any);
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

  // ── JOIN MODE — Full screen, ChatGPT-style ─────────────────────────
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#FFF" />
      </View>
    );
  }

  if (isJoinMode) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {/* Main content - centered */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          {/* Creator avatar */}
          <View style={{ marginBottom: 28 }}>
            {creatorPhotoUrl ? (
              <Image
                source={{ uri: creatorPhotoUrl }}
                style={{ width: 100, height: 100, borderRadius: 50 }}
                contentFit="cover"
              />
            ) : (
              <View style={{
                width: 100, height: 100, borderRadius: 50,
                backgroundColor: '#3A3A3C',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ color: '#FFF', fontSize: 40, fontWeight: '700' }}>
                  {(creatorName[0] || groupName[0] || 'G').toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          {/* Title */}
          <Text style={{ fontSize: 28, textAlign: 'center', marginBottom: 8, lineHeight: 36 }}>
            <Text style={{ fontWeight: '700', color: '#FFF' }}>Dawinix</Text>
            <Text style={{ color: 'rgba(255,255,255,0.55)', fontWeight: '300' }}> with </Text>
            <Text style={{ fontWeight: '700', color: '#FFF' }}>{creatorName || groupName}</Text>
          </Text>
          <Text style={{ fontSize: 17, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 44 }}>
            {groupName}
          </Text>

          {/* Join button */}
          <TouchableOpacity
            style={[{
              width: '100%', backgroundColor: '#FFFFFF', borderRadius: 50,
              paddingVertical: 17, alignItems: 'center', marginBottom: 16,
            }, joining && { opacity: 0.7 }]}
            onPress={handleJoinGroup}
            disabled={joining}
            activeOpacity={0.85}
          >
            {joining ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Text style={{ color: '#000', fontSize: 17, fontWeight: '700' }}>Join group chat</Text>
            )}
          </TouchableOpacity>

          {/* Ignore */}
          <TouchableOpacity
            onPress={() => router.replace('/home')}
            activeOpacity={0.7}
            style={{ paddingVertical: 12, paddingHorizontal: 24 }}
          >
            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 17 }}>Ignore</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom section */}
        <View style={{
          paddingHorizontal: 20, paddingTop: 16,
          paddingBottom: insets.bottom + 20,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: 'rgba(255,255,255,0.1)',
        }}>
          <Text style={{
            color: 'rgba(255,255,255,0.45)', fontSize: 13,
            textAlign: 'center', lineHeight: 19, marginBottom: 14,
          }}>
            {'Your personal Dawinix memory is never used in group chats.'}
          </Text>

          <TouchableOpacity
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 12,
              backgroundColor: 'rgba(255,255,255,0.07)',
              borderRadius: 18, padding: 14, marginBottom: 12,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: 'rgba(255,255,255,0.1)',
            }}
            onPress={() => router.push('/settings' as any)}
            activeOpacity={0.8}
          >
            <View style={{
              width: 46, height: 46, borderRadius: 23,
              backgroundColor: '#4A4A4E',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '700' }}>
                {(user?.email?.[0] || 'U').toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '600' }}>Set up your profile</Text>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 2 }}>
                Choose a username and photo
              </Text>
            </View>
            <Ionicons name="pencil-outline" size={20} color="rgba(255,255,255,0.45)" />
          </TouchableOpacity>

          <TouchableOpacity
            style={{ alignItems: 'center', paddingVertical: 10 }}
            onPress={() => {}}
          >
            <View style={{
              backgroundColor: 'rgba(255,255,255,0.12)',
              borderRadius: 50, paddingHorizontal: 20, paddingVertical: 10,
            }}>
              <Text style={{ color: '#FFF', fontSize: 15 }}>Learn more</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── MANAGE MODE ────────────────────────────────────────────────────
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
        <Text style={[styles.headerTitle, { color: textC }]}>Group link</Text>
        <View style={{ width: 36 }} />
      </View>

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
});
