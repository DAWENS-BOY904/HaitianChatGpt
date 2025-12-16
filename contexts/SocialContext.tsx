import React, { createContext, ReactNode, useState, useEffect } from 'react';
import { useAuth } from '../template';
import { getSupabaseClient } from '../template';

interface User {
  id: string;
  username: string;
  email: string;
}

interface Friend extends User {
  friendshipId: string;
}

interface FriendRequest {
  id: string;
  sender: User;
  receiver: User;
  status: string;
  createdAt: string;
}

interface ChatGroup {
  id: string;
  name: string;
  creatorId: string;
  createdAt: string;
  memberCount?: number;
}

interface ChatMessage {
  id: string;
  senderId: string;
  receiverId?: string;
  groupId?: string;
  content: string;
  status: string;
  createdAt: string;
  sender?: User;
}

interface SocialContextType {
  friends: Friend[];
  friendRequests: FriendRequest[];
  groups: ChatGroup[];
  loading: boolean;
  searchUsers: (query: string) => Promise<User[]>;
  sendFriendRequest: (userId: string) => Promise<{ error: string | null }>;
  acceptFriendRequest: (requestId: string) => Promise<{ error: string | null }>;
  rejectFriendRequest: (requestId: string) => Promise<{ error: string | null }>;
  removeFriend: (friendId: string) => Promise<{ error: string | null }>;
  createGroup: (name: string) => Promise<{ error: string | null; groupId?: string }>;
  generateGroupInvite: (groupId: string) => Promise<{ error: string | null; inviteCode?: string }>;
  joinGroupByCode: (code: string) => Promise<{ error: string | null }>;
  getMessages: (chatId: string, isGroup: boolean) => Promise<ChatMessage[]>;
  sendMessage: (content: string, receiverId?: string, groupId?: string) => Promise<{ error: string | null }>;
  markMessagesSeen: (chatId: string, isGroup: boolean) => Promise<void>;
  refreshData: () => Promise<void>;
}

export const SocialContext = createContext<SocialContextType | undefined>(undefined);

export function SocialProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = getSupabaseClient();

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    setLoading(true);
    await Promise.all([loadFriends(), loadFriendRequests(), loadGroups()]);
    setLoading(false);
  };

  const loadFriends = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('friends')
      .select(`
        id,
        friend_id,
        user_profiles!friends_friend_id_fkey (id, username, email)
      `)
      .eq('user_id', user.id);

    if (!error && data) {
      const friendsList: Friend[] = data.map((item: any) => ({
        friendshipId: item.id,
        id: item.user_profiles.id,
        username: item.user_profiles.username,
        email: item.user_profiles.email,
      }));
      setFriends(friendsList);
    }
  };

  const loadFriendRequests = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('friend_requests')
      .select(`
        id,
        status,
        created_at,
        sender:user_profiles!friend_requests_sender_id_fkey (id, username, email),
        receiver:user_profiles!friend_requests_receiver_id_fkey (id, username, email)
      `)
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .eq('status', 'pending');

    if (!error && data) {
      const requests: FriendRequest[] = data.map((item: any) => ({
        id: item.id,
        sender: item.sender,
        receiver: item.receiver,
        status: item.status,
        createdAt: item.created_at,
      }));
      setFriendRequests(requests);
    }
  };

  const loadGroups = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('group_members')
      .select(`
        group_id,
        chat_groups (
          id,
          name,
          creator_id,
          created_at
        )
      `)
      .eq('user_id', user.id);

    if (!error && data) {
      const groupsList: ChatGroup[] = data
        .filter((item: any) => item.chat_groups)
        .map((item: any) => ({
          id: item.chat_groups.id,
          name: item.chat_groups.name,
          creatorId: item.chat_groups.creator_id,
          createdAt: item.chat_groups.created_at,
        }));
      setGroups(groupsList);
    }
  };

  const searchUsers = async (query: string): Promise<User[]> => {
    if (!query.trim()) return [];

    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, username, email')
      .or(`username.ilike.%${query}%,email.ilike.%${query}%`)
      .neq('id', user?.id || '')
      .limit(20);

    if (error) return [];
    return data || [];
  };

  const sendFriendRequest = async (userId: string) => {
    if (!user) return { error: 'Not authenticated' };

    const { error } = await supabase
      .from('friend_requests')
      .insert({
        sender_id: user.id,
        receiver_id: userId,
      });

    if (!error) {
      await loadFriendRequests();
    }

    return { error: error?.message || null };
  };

  const acceptFriendRequest = async (requestId: string) => {
    if (!user) return { error: 'Not authenticated' };

    const { error } = await supabase
      .from('friend_requests')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', requestId);

    if (!error) {
      await Promise.all([loadFriends(), loadFriendRequests()]);
    }

    return { error: error?.message || null };
  };

  const rejectFriendRequest = async (requestId: string) => {
    if (!user) return { error: 'Not authenticated' };

    const { error } = await supabase
      .from('friend_requests')
      .delete()
      .eq('id', requestId);

    if (!error) {
      await loadFriendRequests();
    }

    return { error: error?.message || null };
  };

  const removeFriend = async (friendId: string) => {
    if (!user) return { error: 'Not authenticated' };

    const { error } = await supabase
      .from('friends')
      .delete()
      .or(`and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user.id})`);

    if (!error) {
      await loadFriends();
    }

    return { error: error?.message || null };
  };

  const createGroup = async (name: string) => {
    if (!user) return { error: 'Not authenticated' };

    const { data, error } = await supabase
      .from('chat_groups')
      .insert({
        name,
        creator_id: user.id,
      })
      .select()
      .single();

    if (!error) {
      await loadGroups();
    }

    return { error: error?.message || null, groupId: data?.id };
  };

  const generateGroupInvite = async (groupId: string) => {
    if (!user) return { error: 'Not authenticated' };

    const inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase();

    const { error } = await supabase
      .from('group_invites')
      .insert({
        group_id: groupId,
        invite_code: inviteCode,
        created_by: user.id,
      });

    return { error: error?.message || null, inviteCode: error ? undefined : inviteCode };
  };

  const joinGroupByCode = async (code: string) => {
    if (!user) return { error: 'Not authenticated' };

    const { data: inviteData, error: inviteError } = await supabase
      .from('group_invites')
      .select('group_id')
      .eq('invite_code', code.toUpperCase())
      .single();

    if (inviteError || !inviteData) {
      return { error: 'Invalid invite code' };
    }

    const { error } = await supabase
      .from('group_members')
      .insert({
        group_id: inviteData.group_id,
        user_id: user.id,
      });

    if (!error) {
      await loadGroups();
    }

    return { error: error?.message || null };
  };

  const getMessages = async (chatId: string, isGroup: boolean): Promise<ChatMessage[]> => {
    if (!user) return [];

    let query = supabase
      .from('chat_messages')
      .select(`
        id,
        sender_id,
        receiver_id,
        group_id,
        content,
        status,
        created_at,
        sender:user_profiles!chat_messages_sender_id_fkey (id, username, email)
      `)
      .order('created_at', { ascending: true });

    if (isGroup) {
      query = query.eq('group_id', chatId);
    } else {
      query = query.or(`and(sender_id.eq.${user.id},receiver_id.eq.${chatId}),and(sender_id.eq.${chatId},receiver_id.eq.${user.id})`);
    }

    const { data, error } = await query;

    if (error || !data) return [];

    return data.map((msg: any) => ({
      id: msg.id,
      senderId: msg.sender_id,
      receiverId: msg.receiver_id,
      groupId: msg.group_id,
      content: msg.content,
      status: msg.status,
      createdAt: msg.created_at,
      sender: msg.sender,
    }));
  };

  const sendMessage = async (content: string, receiverId?: string, groupId?: string) => {
    if (!user) return { error: 'Not authenticated' };

    const { error } = await supabase
      .from('chat_messages')
      .insert({
        sender_id: user.id,
        receiver_id: receiverId,
        group_id: groupId,
        content,
        status: 'sent',
      });

    return { error: error?.message || null };
  };

  const markMessagesSeen = async (chatId: string, isGroup: boolean) => {
    if (!user) return;

    let query = supabase
      .from('chat_messages')
      .update({ status: 'seen', updated_at: new Date().toISOString() })
      .neq('sender_id', user.id)
      .in('status', ['sent', 'delivered']);

    if (isGroup) {
      query = query.eq('group_id', chatId);
    } else {
      query = query.eq('sender_id', chatId).eq('receiver_id', user.id);
    }

    await query;
  };

  const refreshData = async () => {
    await loadData();
  };

  return (
    <SocialContext.Provider
      value={{
        friends,
        friendRequests,
        groups,
        loading,
        searchUsers,
        sendFriendRequest,
        acceptFriendRequest,
        rejectFriendRequest,
        removeFriend,
        createGroup,
        generateGroupInvite,
        joinGroupByCode,
        getMessages,
        sendMessage,
        markMessagesSeen,
        refreshData,
      }}
    >
      {children}
    </SocialContext.Provider>
  );
}
