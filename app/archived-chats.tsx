import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Platform,
  ActivityIndicator,
  Modal,
  ScrollView,
  TextInput,
  Animated,
  SectionList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { useTheme } from '../hooks/useTheme';
import { useAuth, useAlert } from '@/template';
import { useRouter } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';

interface ArchivedConversation {
  id: string;
  title: string;
  updated_at: string;
  created_at: string;
}

interface ArchivedMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  image_url?: string;
}

// ── Blur Context Menu ──
function BlurContextMenu({ visible, title, items, onClose }: {
  visible: boolean;
  title?: string;
  items: Array<{ label: string; icon: string; destructive?: boolean; onPress: () => void; }>;
  onClose: () => void;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.88)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 320, friction: 26, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 0.88, duration: 100, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={ctxStyles.backdrop} activeOpacity={1} onPress={onClose}>
        <Animated.View style={[ctxStyles.menuWrap, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
          <BlurView intensity={80} tint="dark" style={ctxStyles.blurBox}>
            {title ? (
              <View style={ctxStyles.titleRow}>
                <Text style={ctxStyles.titleText} numberOfLines={1}>{title}</Text>
              </View>
            ) : null}
            {items.map((item, i) => (
              <TouchableOpacity
                key={item.label}
                style={[ctxStyles.menuItem, i > 0 && ctxStyles.menuItemBorder]}
                activeOpacity={0.6}
                onPress={() => { onClose(); setTimeout(item.onPress, 50); }}
              >
                <Ionicons
                  name={item.icon as any}
                  size={20}
                  color={item.destructive ? '#FF453A' : 'rgba(255,255,255,0.85)'}
                />
                <Text style={[ctxStyles.menuItemLabel, item.destructive && ctxStyles.destructiveLabel]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </BlurView>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const ctxStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' },
  menuWrap: { width: 240, borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 20 },
  blurBox: { borderRadius: 16, overflow: 'hidden' },
  titleRow: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.12)' },
  titleText: { fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', fontWeight: '500' },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14, gap: 14 },
  menuItemBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.1)' },
  menuItemLabel: { fontSize: 17, color: 'rgba(255,255,255,0.92)', fontWeight: '400' },
  destructiveLabel: { color: '#FF453A' },
});

// ── Full Conversation Viewer Modal ──
function ConversationViewerModal({ visible, conversation, onClose }: {
  visible: boolean;
  conversation: ArchivedConversation | null;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<ArchivedMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = getSupabaseClient();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible && conversation) loadMessages();
  }, [visible, conversation]);

  const loadMessages = async () => {
    if (!conversation) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true });
      setMessages(data || []);
    } catch (e) {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
        {/* Header */}
        <BlurView intensity={80} tint="dark" style={[vStyles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={vStyles.closeBtn} onPress={onClose}>
            <Text style={vStyles.closeBtnText}>Close</Text>
          </TouchableOpacity>
          <Text style={vStyles.headerTitle} numberOfLines={1}>{conversation?.title || 'Conversation'}</Text>
          <View style={{ width: 60 }} />
        </BlurView>

        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color="#10A37F" size="large" />
          </View>
        ) : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingTop: 80 }} showsVerticalScrollIndicator={false}>
            {messages.length === 0 ? (
              <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 60 }}>
                <Ionicons name="chatbubbles-outline" size={48} color="rgba(255,255,255,0.3)" />
                <Text style={{ color: 'rgba(255,255,255,0.5)', marginTop: 12, fontSize: 16 }}>No messages</Text>
              </View>
            ) : messages.map(msg => (
              <View key={msg.id} style={[vStyles.bubble, msg.role === 'user' ? vStyles.userBubble : vStyles.aiBubble]}>
                {msg.role === 'assistant' && (
                  <Text style={vStyles.aiLabel}>Haitian AI</Text>
                )}
                {msg.image_url ? (
                  <Image source={{ uri: msg.image_url }} style={vStyles.msgImage} contentFit="cover" />
                ) : null}
                <Text style={[vStyles.bubbleText, msg.role === 'user' ? vStyles.userText : vStyles.aiText]}>
                  {msg.content}
                </Text>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const vStyles = StyleSheet.create({
  header: {
    position: 'absolute',
    top: 0, left: 0, right: 0, zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  closeBtn: { width: 60, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center' },
  closeBtnText: { color: '#FFF', fontSize: 14, fontWeight: '500' },
  headerTitle: { flex: 1, color: '#FFF', fontSize: 17, fontWeight: '700', textAlign: 'center' },
  bubble: { maxWidth: '85%', marginBottom: 12, borderRadius: 18, padding: 14 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#2C2C3A' },
  aiBubble: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.07)' },
  aiLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '600', marginBottom: 6 },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  userText: { color: '#FFF' },
  aiText: { color: 'rgba(255,255,255,0.9)' },
  msgImage: { width: 200, height: 150, borderRadius: 10, marginBottom: 8 },
});

// ── Main Screen ──
export default function ArchivedChatsScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  const [archivedChats, setArchivedChats] = useState<ArchivedConversation[]>([]);
  const [filtered, setFiltered] = useState<ArchivedConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChat, setSelectedChat] = useState<ArchivedConversation | null>(null);
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewingChat, setViewingChat] = useState<ArchivedConversation | null>(null);
  const [searchText, setSearchText] = useState('');

  useEffect(() => { loadArchivedChats(); }, [user?.id]);

  useEffect(() => {
    if (searchText.trim()) {
      setFiltered(archivedChats.filter(c => (c.title || '').toLowerCase().includes(searchText.toLowerCase())));
    } else {
      setFiltered(archivedChats);
    }
  }, [searchText, archivedChats]);

  const loadArchivedChats = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('id, title, updated_at, created_at')
        .eq('user_id', user.id)
        .eq('is_archived', true)
        .order('updated_at', { ascending: false });

      if (!error && data) {
        setArchivedChats(data || []);
        setFiltered(data || []);
      }
    } catch (e) {
      setArchivedChats([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUnarchive = async (chat: ArchivedConversation) => {
    try {
      await supabase.from('conversations').update({ is_archived: false } as any).eq('id', chat.id);
      setArchivedChats(prev => prev.filter(c => c.id !== chat.id));
      showAlert('Restored', 'Chat moved back to your conversations');
    } catch (e) {
      showAlert('Error', 'Failed to unarchive chat');
    }
  };

  const handleDeleteForever = async (chat: ArchivedConversation) => {
    showAlert('Delete Forever', 'This will permanently delete this conversation and all its messages.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await supabase.from('messages').delete().eq('conversation_id', chat.id);
            await supabase.from('conversations').delete().eq('id', chat.id);
            setArchivedChats(prev => prev.filter(c => c.id !== chat.id));
            showAlert('Deleted', 'Conversation deleted permanently');
          } catch (e) {
            showAlert('Error', 'Failed to delete conversation');
          }
        }
      }
    ]);
  };

  // Group chats by date section (like ChatGPT)
  const getSectionedChats = (chats: ArchivedConversation[]) => {
    const sections: Array<{ title: string; data: ArchivedConversation[] }> = [];
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const lastWeekStart = new Date(today);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastMonthStart = new Date(today);
    lastMonthStart.setDate(lastMonthStart.getDate() - 30);

    const groups: Record<string, ArchivedConversation[]> = {
      'Today': [],
      'Yesterday': [],
      'Last week': [],
      'Last month': [],
      'Older': [],
    };

    chats.forEach(chat => {
      const d = new Date(chat.updated_at || chat.created_at);
      if (d.toDateString() === today.toDateString()) groups['Today'].push(chat);
      else if (d.toDateString() === yesterday.toDateString()) groups['Yesterday'].push(chat);
      else if (d >= lastWeekStart) groups['Last week'].push(chat);
      else if (d >= lastMonthStart) groups['Last month'].push(chat);
      else groups['Older'].push(chat);
    });

    Object.entries(groups).forEach(([title, data]) => {
      if (data.length > 0) sections.push({ title, data });
    });

    return sections;
  };

  const contextMenuItems = selectedChat ? [
    { label: 'View', icon: 'eye-outline', onPress: () => { setViewingChat(selectedChat); setViewerVisible(true); } },
    { label: 'Unarchive', icon: 'archive-outline', onPress: () => handleUnarchive(selectedChat) },
    { label: 'Delete', icon: 'trash-outline', destructive: true, onPress: () => handleDeleteForever(selectedChat) },
  ] : [];

  const sections = getSectionedChats(filtered);

  return (
    <View style={[s.container, { backgroundColor: isDark ? '#0A0A0A' : '#F2F2F7', paddingTop: insets.top }]}>
      {/* Header — back button + title (like photo) */}
      <View style={[s.header, { borderBottomColor: isDark ? '#1C1C1E' : '#DDD' }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <View style={[s.backCircle, { backgroundColor: isDark ? '#1C1C1E' : '#E5E5EA' }]}>
            <Ionicons name="chevron-back" size={18} color={isDark ? '#FFF' : '#000'} />
          </View>
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: isDark ? '#FFF' : '#000' }]}>Archived chats</Text>
        <View style={{ width: 44 }} />
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#10A37F" />
        </View>
      ) : archivedChats.length === 0 ? (
        <View style={s.emptyState}>
          <Ionicons name="archive-outline" size={56} color={isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)'} />
          <Text style={[s.emptyTitle, { color: isDark ? '#FFF' : '#000' }]}>No archived chats</Text>
          <Text style={[s.emptyText, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }]}>
            Conversations you archive will appear here.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section: { title } }) => (
            <Text style={[s.sectionHeader, { color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }]}>
              {title}
            </Text>
          )}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[s.chatItem, { borderBottomColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' }]}
              activeOpacity={0.7}
              onPress={() => { setViewingChat(item); setViewerVisible(true); }}
              onLongPress={() => { setSelectedChat(item); setContextMenuVisible(true); }}
              delayLongPress={350}
            >
              <Text style={[s.chatTitle, { color: isDark ? '#FFF' : '#000' }]} numberOfLines={1}>
                {item.title || 'Untitled chat'}
              </Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Search bar at bottom (like photo) */}
      {archivedChats.length > 0 && (
        <View style={[s.searchBarWrap, { bottom: insets.bottom + 16, backgroundColor: isDark ? '#1C1C1E' : '#E5E5EA' }]}>
          <Ionicons name="search" size={18} color={isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)'} />
          <TextInput
            style={[s.searchInput, { color: isDark ? '#FFF' : '#000' }]}
            placeholder="Search"
            placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'}
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText('')}>
              <Ionicons name="close-circle" size={18} color={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'} />
            </TouchableOpacity>
          )}
        </View>
      )}

      <BlurContextMenu
        visible={contextMenuVisible}
        title={selectedChat?.title}
        items={contextMenuItems}
        onClose={() => setContextMenuVisible(false)}
      />

      <ConversationViewerModal
        visible={viewerVisible}
        conversation={viewingChat}
        onClose={() => setViewerVisible(false)}
      />
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
    justifyContent: 'space-between',
  },
  backBtn: { padding: 4 },
  backCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 6,
    textTransform: 'none',
    letterSpacing: 0,
  },
  chatItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  chatTitle: { fontSize: 16, fontWeight: '400' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  emptyText: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  searchBarWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 0 },
});
