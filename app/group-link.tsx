import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Share,
  Clipboard,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
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

  const params = useLocalSearchParams<{ groupId?: string; conversationId?: string }>();
  const groupId = params.groupId || '';
  const conversationId = params.conversationId || '';

  const [groupName, setGroupName] = useState('Group Chat');
  const [inviteToken, setInviteToken] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [username, setUsername] = useState('');

  const baseUrl = 'https://dawinix.com/gg/v';

  const inviteLink = inviteCode && inviteToken
    ? `${baseUrl}/${inviteCode}?token=${inviteToken}`
    : inviteToken
    ? `${baseUrl}/${generateGroupId()}?token=${inviteToken}`
    : '';

  useEffect(() => {
    loadGroupData();
  }, [groupId]);

  const loadGroupData = async () => {
    setLoading(true);
    try {
      // Load user profile for username
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
        // Generate a new token for display
        const newToken = generateToken();
        const newCode = generateGroupId();
        setInviteToken(newToken);
        setInviteCode(newCode);
        setLoading(false);
        return;
      }

      const { data: groupData } = await supabase
        .from('chat_groups')
        .select('name, invite_code')
        .eq('id', groupId)
        .single();

      if (groupData) {
        setGroupName(groupData.name || 'Group Chat');
      }

      // Load invite from group_invites
      const { data: inviteData } = await supabase
        .from('group_invites')
        .select('invite_code, id')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (inviteData) {
        setInviteCode(inviteData.id || inviteData.invite_code);
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
          setInviteCode(newInvite.id || generateGroupId());
        }
      }
    } catch (e) {
      // Fallback token
      setInviteToken(generateToken());
      setInviteCode(generateGroupId());
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = useCallback(() => {
    if (!inviteLink) return;
    Clipboard.setString(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [inviteLink]);

  const handleShare = useCallback(async () => {
    if (!inviteLink) return;
    try {
      await Share.share({
        message: `Join my Haitian AI group chat: ${inviteLink}`,
        url: inviteLink,
      });
    } catch (e) {}
  }, [inviteLink]);

  const handleReset = useCallback(async () => {
    showAlert(
      'Reset Link',
      'This will invalidate the current link and generate a new one. Anyone with the old link will no longer be able to join.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            setResetting(true);
            try {
              const newToken = generateToken();
              const newCode = generateGroupId();

              if (groupId) {
                // Delete old invites and create new one
                await supabase
                  .from('group_invites')
                  .delete()
                  .eq('group_id', groupId);

                await supabase
                  .from('group_invites')
                  .insert({ group_id: groupId, invite_code: newToken, created_by: user?.id });

                // Insert system message in conversation
                if (conversationId) {
                  await supabase.from('messages').insert({
                    conversation_id: conversationId,
                    role: 'assistant',
                    content: `${username} reset the group link.`,
                  });
                }
              }

              setInviteToken(newToken);
              setInviteCode(newCode);
              showAlert('Link Reset', 'A new group link has been generated.');
            } catch (e) {
              showAlert('Error', 'Failed to reset group link.');
            } finally {
              setResetting(false);
            }
          },
        },
      ]
    );
  }, [groupId, conversationId, username, showAlert, user?.id]);

  const handleDelete = useCallback(() => {
    showAlert(
      'Delete Link',
      'This will permanently delete the group invite link. No one will be able to join with this link.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              if (groupId) {
                await supabase
                  .from('group_invites')
                  .delete()
                  .eq('group_id', groupId);
              }
              setInviteToken('');
              setInviteCode('');
              showAlert('Link Deleted', 'The group invite link has been deleted.');
              setTimeout(() => router.back(), 800);
            } catch (e) {
              showAlert('Error', 'Failed to delete group link.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  }, [groupId, showAlert, router]);

  const bgColor = '#0A0A0A';
  const cardBg = 'rgba(44,44,46,0.9)';
  const borderCol = 'rgba(255,255,255,0.1)';

  const actions = [
    {
      icon: copied ? 'checkmark-outline' : 'copy-outline',
      label: copied ? 'Copied!' : 'Copy',
      color: copied ? '#34C759' : '#FFFFFF',
      onPress: handleCopy,
      loading: false,
    },
    {
      icon: 'share-outline',
      label: 'Share',
      color: '#FFFFFF',
      onPress: handleShare,
      loading: false,
    },
    {
      icon: 'refresh-outline',
      label: 'Reset',
      color: '#FFFFFF',
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
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: bgColor }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: borderCol }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Group link</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <View style={styles.content}>
          {/* Link Display */}
          <View style={styles.linkSection}>
            {inviteLink ? (
              <Text style={styles.linkText} numberOfLines={2}>
                {inviteLink}
              </Text>
            ) : (
              <Text style={[styles.linkText, { color: 'rgba(255,255,255,0.35)' }]}>
                No link — tap Reset to generate one
              </Text>
            )}
            <Text style={styles.linkDescription}>
              Anyone can join your group chat with this link. Anyone who joins this chat will be able to view the entire conversation history.
            </Text>
          </View>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: borderCol }]} />

          {/* Actions */}
          <View style={styles.actionsContainer}>
            {actions.map((action, index) => (
              <React.Fragment key={action.label}>
                {index > 0 && <View style={[styles.actionDivider, { backgroundColor: borderCol }]} />}
                <TouchableOpacity
                  style={styles.actionRow}
                  onPress={action.onPress}
                  activeOpacity={0.6}
                  disabled={action.loading || (!inviteLink && action.label !== 'Reset')}
                >
                  <View style={[
                    styles.actionIconWrap,
                    { opacity: (!inviteLink && action.label !== 'Reset' && action.label !== 'Delete') ? 0.35 : 1 }
                  ]}>
                    {action.loading ? (
                      <ActivityIndicator size="small" color={action.color} />
                    ) : (
                      <Ionicons name={action.icon as any} size={24} color={action.color} />
                    )}
                  </View>
                  <Text style={[
                    styles.actionLabel,
                    { color: action.color },
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
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    paddingTop: 32,
    paddingHorizontal: 20,
  },
  linkSection: {
    marginBottom: 24,
  },
  linkText: {
    color: '#007AFF',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 10,
    fontWeight: '500',
  },
  linkDescription: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 14,
    lineHeight: 20,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  actionsContainer: {
    backgroundColor: 'rgba(44,44,46,0.6)',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 18,
  },
  actionIconWrap: {
    width: 28,
    alignItems: 'center',
  },
  actionLabel: {
    fontSize: 17,
    fontWeight: '400',
  },
  actionDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 66,
  },
});
