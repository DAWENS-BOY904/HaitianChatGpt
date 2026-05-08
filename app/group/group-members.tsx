import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../hooks/useTheme';
import { useAuth, useAlert } from '@/template';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';

interface GroupMember {
  id: string;
  user_id: string;
  joined_at: string;
  username?: string;
  full_name?: string;
  profile_photo_url?: string;
  isAdmin?: boolean;
  isCreator?: boolean;
}

export default function GroupMembersScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  const params = useLocalSearchParams<{ groupId?: string; conversationId?: string }>();
  const groupId = params.groupId || '';
  const conversationId = params.conversationId || '';

  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupName, setGroupName] = useState('Group Chat');
  const [creatorId, setCreatorId] = useState('');
  const [adminIds, setAdminIds] = useState<string[]>([]);
  const [isCurrentUserAdmin, setIsCurrentUserAdmin] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (groupId) loadGroupData();
  }, [groupId]);

  const loadGroupData = async () => {
    setLoading(true);
    try {
      // Load group info
      const { data: groupData } = await supabase
        .from('chat_groups')
        .select('name, creator_id')
        .eq('id', groupId)
        .single();

      if (groupData) {
        setGroupName(groupData.name || 'Group Chat');
        setCreatorId(groupData.creator_id || '');
        if (groupData.creator_id === user?.id) setIsCurrentUserAdmin(true);
      }

      // Load admins
      const { data: adminData } = await supabase
        .from('group_admins')
        .select('user_id')
        .eq('group_id', groupId);

      const adminUserIds = (adminData || []).map((a: any) => a.user_id);
      setAdminIds(adminUserIds);
      if (adminUserIds.includes(user?.id)) setIsCurrentUserAdmin(true);

      // Load members
      const { data: memberData } = await supabase
        .from('group_members')
        .select('id, user_id, joined_at')
        .eq('group_id', groupId)
        .order('joined_at', { ascending: true });

      if (memberData && memberData.length > 0) {
        // Fetch profiles for each member
        const userIds = memberData.map((m: any) => m.user_id);
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, username, full_name, profile_photo_url')
          .in('id', userIds);

        const profileMap: Record<string, any> = {};
        (profiles || []).forEach((p: any) => { profileMap[p.id] = p; });

        const enriched: GroupMember[] = memberData.map((m: any) => ({
          id: m.id,
          user_id: m.user_id,
          joined_at: m.joined_at,
          username: profileMap[m.user_id]?.username,
          full_name: profileMap[m.user_id]?.full_name,
          profile_photo_url: profileMap[m.user_id]?.profile_photo_url,
          isAdmin: adminUserIds.includes(m.user_id) || m.user_id === groupData?.creator_id,
          isCreator: m.user_id === groupData?.creator_id,
        }));

        setMembers(enriched);
      } else {
        setMembers([]);
      }
    } catch (e) {
      setMembers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleKick = useCallback(async (member: GroupMember) => {
    if (!isCurrentUserAdmin) return;
    if (member.user_id === user?.id) { showAlert('Error', 'You cannot kick yourself.'); return; }
    if (member.isCreator) { showAlert('Error', 'Cannot kick the group creator.'); return; }

    showAlert(
      'Kick Member',
      `Remove ${member.full_name || member.username || 'this user'} from the group?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Kick',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(member.user_id);
            try {
              await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', member.user_id);
              // Also remove from admins if they were one
              await supabase.from('group_admins').delete().eq('group_id', groupId).eq('user_id', member.user_id);
              setMembers(prev => prev.filter(m => m.user_id !== member.user_id));

              // System message
              if (conversationId) {
                const myProfile = members.find(m => m.user_id === user?.id);
                const myName = myProfile?.full_name || myProfile?.username || 'Admin';
                const kickedName = member.full_name || member.username || 'User';
                await supabase.from('messages').insert({
                  conversation_id: conversationId,
                  role: 'assistant',
                  content: `${myName} removed ${kickedName} from the group.`,
                });
              }
            } catch (e) {
              showAlert('Error', 'Failed to kick member.');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  }, [isCurrentUserAdmin, groupId, conversationId, user?.id, members, showAlert]);

  const handleMakeAdmin = useCallback(async (member: GroupMember) => {
    if (!isCurrentUserAdmin) return;
    if (member.isAdmin) {
      // Remove admin
      showAlert(
        'Remove Admin',
        `Remove admin role from ${member.full_name || member.username || 'this user'}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              setActionLoading(member.user_id);
              try {
                await supabase.from('group_admins').delete().eq('group_id', groupId).eq('user_id', member.user_id);
                setMembers(prev => prev.map(m => m.user_id === member.user_id ? { ...m, isAdmin: false } : m));
                setAdminIds(prev => prev.filter(id => id !== member.user_id));
              } catch (e) {
                showAlert('Error', 'Failed to update admin status.');
              } finally {
                setActionLoading(null);
              }
            },
          },
        ]
      );
    } else {
      setActionLoading(member.user_id);
      try {
        await supabase.from('group_admins').insert({ group_id: groupId, user_id: member.user_id });
        setMembers(prev => prev.map(m => m.user_id === member.user_id ? { ...m, isAdmin: true } : m));
        setAdminIds(prev => [...prev, member.user_id]);

        if (conversationId) {
          const myProfile = members.find(m => m.user_id === user?.id);
          const myName = myProfile?.full_name || myProfile?.username || 'Admin';
          const targetName = member.full_name || member.username || 'User';
          await supabase.from('messages').insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: `${myName} made ${targetName} an admin.`,
          });
        }
      } catch (e) {
        showAlert('Error', 'Failed to make admin.');
      } finally {
        setActionLoading(null);
      }
    }
  }, [isCurrentUserAdmin, groupId, conversationId, user?.id, members, showAlert]);

  const getDisplayName = (member: GroupMember) => member.full_name || member.username || 'User';
  const getInitial = (member: GroupMember) => (getDisplayName(member)[0] || 'U').toUpperCase();

  const renderMember = ({ item }: { item: GroupMember }) => {
    const isMe = item.user_id === user?.id;
    const isLoading = actionLoading === item.user_id;

    return (
      <View style={s.memberRow}>
        {/* Avatar */}
        <View style={s.avatarWrap}>
          {item.profile_photo_url ? (
            <Image source={{ uri: item.profile_photo_url }} style={s.avatar} contentFit="cover" />
          ) : (
            <View style={[s.avatarPlaceholder, { backgroundColor: '#10A37F' }]}>
              <Text style={s.avatarInitial}>{getInitial(item)}</Text>
            </View>
          )}
        </View>

        {/* Info */}
        <View style={s.memberInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={s.memberName} numberOfLines={1}>{getDisplayName(item)}</Text>
            {isMe && <Text style={s.badge}>you</Text>}
            {item.isCreator && <Text style={[s.badge, { backgroundColor: 'rgba(255,149,0,0.18)', color: '#FF9500' }]}>owner</Text>}
            {item.isAdmin && !item.isCreator && <Text style={[s.badge, { backgroundColor: 'rgba(0,122,255,0.18)', color: '#007AFF' }]}>admin</Text>}
          </View>
          {item.username ? (
            <Text style={s.memberUsername}>@{item.username}</Text>
          ) : null}
        </View>

        {/* Actions (only for admins, not for self or creator) */}
        {isCurrentUserAdmin && !isMe && !item.isCreator && (
          <View style={s.actions}>
            {isLoading ? (
              <ActivityIndicator size="small" color="rgba(255,255,255,0.5)" />
            ) : (
              <>
                <TouchableOpacity
                  style={[s.actionBtn, { borderColor: item.isAdmin ? 'rgba(255,149,0,0.4)' : 'rgba(0,122,255,0.4)' }]}
                  onPress={() => handleMakeAdmin(item)}
                >
                  <Text style={[s.actionBtnText, { color: item.isAdmin ? '#FF9500' : '#007AFF' }]}>
                    {item.isAdmin ? 'Remove admin' : 'Admin'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.actionBtn, { borderColor: 'rgba(255,69,58,0.4)' }]}
                  onPress={() => handleKick(item)}
                >
                  <Text style={[s.actionBtnText, { color: '#FF453A' }]}>Kick</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>
    );
  };

  const bgColor = '#0A0A0A';
  const borderCol = 'rgba(255,255,255,0.08)';

  return (
    <View style={[s.container, { paddingTop: insets.top, backgroundColor: bgColor }]}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: borderCol }]}>
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={s.headerTitle}>People</Text>
          {members.length > 0 && (
            <Text style={s.memberCount}>{members.length} {members.length === 1 ? 'member' : 'members'}</Text>
          )}
        </View>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : members.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
          <Ionicons name="people-outline" size={64} color="rgba(255,255,255,0.25)" />
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 18, fontWeight: '600', marginTop: 16 }}>No members</Text>
          <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14, textAlign: 'center', marginTop: 8 }}>
            Invite people to join this group chat.
          </Text>
        </View>
      ) : (
        <FlatList
          data={members}
          renderItem={renderMember}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: 8 }}
          ItemSeparatorComponent={() => <View style={[s.separator, { backgroundColor: borderCol }]} />}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
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
  headerTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  memberCount: { color: 'rgba(255,255,255,0.45)', fontSize: 13, marginTop: 1 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  avatarWrap: { position: 'relative' },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  avatarPlaceholder: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  memberInfo: { flex: 1, minWidth: 0 },
  memberName: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  memberUsername: { color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 2 },
  badge: {
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    color: 'rgba(255,255,255,0.6)',
    overflow: 'hidden',
  },
  actions: {
    flexDirection: 'row',
    gap: 6,
    flexShrink: 0,
  },
  actionBtn: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 74,
  },
});
