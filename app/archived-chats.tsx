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
  Animated,
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
  lastMessage?: string;
}

interface ArchivedMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  image_url?: string;
}

// ── Blur Context Menu ──
function BlurContextMenu({ visible, title, items, onClose, anchorY }: {
  visible: boolean;
  title?: string;
  items: Array<{ label: string; icon: string; destructive?: boolean; onPress: () => void; }>;
  onClose: () => void;
  anchorY?: number;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 320, friction: 26, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 110, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 0.85, duration: 110, useNativeDriver: true }),
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
                <Text style={[ctxStyles.menuItemLabel, item.destructive && ctxStyles.destructiveLabel]}>{item.label}</Text>
                <Ionicons name={item.icon as any} size={20} color={item.destructive ? '#FF453A' : 'rgba(255,255,255,0.85)'} />
              </TouchableOpacity>
            ))}
          </BlurView>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const ctxStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  menuWrap: { width: 260, borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 20 },
  blurBox: { borderRadius: 16, overflow: 'hidden' },
  titleRow: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.12)' },
  titleText: { fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', fontWeight: '500' },
  menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  menuItemBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.1)' },
  menuItemLabel: { fontSize: 17, color: 'rgba(255,255,255,0.92)' },
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

  useEffect(() => {
    if (visible && conversation) {
      loadMessages();
    }
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
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Header */}
        <BlurView intensity={80} tint="dark" style={viewerStyles.header}>
          <TouchableOpacity style={viewerStyles.closeBtn} onPress={onClose}>
            <Text style={viewerStyles.closeBtnText}>Close</Text>
          </TouchableOpacity>
          <Text style={viewerStyles.headerTitle} numberOfLines={1}>{conversation?.title || 'Conversation'}</Text>
          <View style={{ width: 60 }} />
        </BlurView>

        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, paddingTop: 80 }}
            showsVerticalScrollIndicator={false}
          >
            {messages.length === 0 ? (
              <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 60 }}>
                <Ionicons name="chatbubbles-outline" size={48} color={colors.textSecondary} />
                <Text style={{ color: colors.textSecondary, marginTop: 12, fontSize: 16 }}>No messages</Text>
              </View>
            ) : (
              messages.map((msg) => (
                <View
                  key={msg.id}
                  style={[
                    viewerStyles.bubble,
                    msg.role === 'user' ? viewerStyles.userBubble : viewerStyles.aiBubble,
                  ]}
                >
                  {msg.role === 'assistant' && (
                    <Text style={viewerStyles.aiLabel}>Haitian AI</Text>
                  )}
                  {msg.image_url ? (
                    <Image source={{ uri: msg.image_url }} style={viewerStyles.msgImage} contentFit="cover" />
                  ) : null}
                  <Text style={[viewerStyles.bubbleText, msg.role === 'user' ? viewerStyles.userText : viewerStyles.aiText]}>
                    {msg.content}
                  </Text>
                </View>
              ))
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const viewerStyles = StyleSheet.create({
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  closeBtn: {
    width: 60,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
  },
  closeBtnText: { color: '#FFF', fontSize: 14, fontWeight: '500' },
  headerTitle: { flex: 1, color: '#FFF', fontSize: 17, fontWeight: '700', textAlign: 'center' },
  bubble: { maxWidth: '85%', marginBottom: 12, borderRadius: 18, padding: 14 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#6B3A2A' },
  aiBubble: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.08)' },
  aiLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '600', marginBottom: 6 },
  bubbleText: { fontSize: 16, lineHeight: 22 },
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
  const [loading, setLoading] = useState(true);
  const [selectedChat, setSelectedChat] = useState<ArchivedConversation | null>(null);
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewingChat, setViewingChat] = useState<ArchivedConversation | null>(null);

  useEffect(() => { loadArchivedChats(); }, []);

  const loadArchivedChats = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      // Check if conversations table has is_archived column
      const { data, error } = await supabase
        .from('conversations')
        .select('id, title, updated_at, created_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (!error && data) {
        // Filter archived ones - store archived IDs in AsyncStorage locally
        // For now show all conversations marked archived
        const archived = data.filter((c: any) => c.is_archived === true || (c as any).archived === true);
        setArchivedChats(archived.length > 0 ? archived : []);
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
    showAlert('Delete Forever', 'This will permanently delete this conversation and all messages.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            // Delete messages first
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

  const handleView = (chat: ArchivedConversation) => {
    setViewingChat(chat);
    setViewerVisible(true);
  };

  const contextMenuItems = selectedChat ? [
    { label: 'View', icon: 'eye-outline', onPress: () => handleView(selectedChat) },
    { label: 'Unarchive', icon: 'archive-outline', onPress: () => handleUnarchive(selectedChat) },
    { label: 'Delete', icon: 'trash-outline', destructive: true, onPress: () => handleDeleteForever(selectedChat) },
  ] : [];

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
    backButton: { padding: Spacing.xs, marginRight: Spacing.sm },
    headerTitle: { ...Typography.heading, color: colors.text, fontSize: 20 },
    chatItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    chatIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    chatInfo: { flex: 1 },
    chatTitle: { color: colors.text, fontWeight: '600', fontSize: 16, marginBottom: 2 },
    chatDate: { color: colors.textSecondary, fontSize: 13 },
    moreBtn: { padding: 8 },
    emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
    emptyTitle: { ...Typography.heading, color: colors.text, marginTop: 16, marginBottom: 8 },
    emptyText: { ...Typography.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  });

  const renderChatItem = ({ item }: { item: ArchivedConversation }) => (
    <TouchableOpacity
      style={styles.chatItem}
      activeOpacity={0.7}
      onPress={() => handleView(item)}
      onLongPress={() => { setSelectedChat(item); setContextMenuVisible(true); }}
    >
      <View style={styles.chatIconWrap}>
        <Ionicons name="archive" size={20} color={colors.textSecondary} />
      </View>
      <View style={styles.chatInfo}>
        <Text style={styles.chatTitle} numberOfLines={1}>{item.title || 'Untitled Chat'}</Text>
        <Text style={styles.chatDate}>{formatDate(item.updated_at || item.created_at)}</Text>
      </View>
      <TouchableOpacity
        style={styles.moreBtn}
        onPress={() => { setSelectedChat(item); setContextMenuVisible(true); }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Archived Chats</Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : archivedChats.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="archive-outline" size={64} color={colors.textSecondary} />
          <Text style={styles.emptyTitle}>No archived chats</Text>
          <Text style={styles.emptyText}>
            Conversations you archive will appear here.{'\n'}You can unarchive them at any time.
          </Text>
        </View>
      ) : (
        <FlatList
          data={archivedChats}
          renderItem={renderChatItem}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Blur Context Menu (View, Unarchive, Delete) */}
      <BlurContextMenu
        visible={contextMenuVisible}
        title={selectedChat?.title}
        items={contextMenuItems}
        onClose={() => { setContextMenuVisible(false); }}
      />

      {/* Full Conversation Viewer */}
      <ConversationViewerModal
        visible={viewerVisible}
        conversation={viewingChat}
        onClose={() => setViewerVisible(false)}
      />
    </View>
  );
}
