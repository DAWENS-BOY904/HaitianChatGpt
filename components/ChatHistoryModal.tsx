import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Dimensions,
  FlatList,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useTheme } from '../hooks/useTheme';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { getSupabaseClient } from '@/template';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ChatItem {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: string;
  isPinned: boolean;
  messageCount: number;
}

interface ChatHistoryModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
  currentChatId?: string;
}

export function ChatHistoryModal({
  visible,
  onClose,
  onSelectChat,
  onNewChat,
  currentChatId,
}: ChatHistoryModalProps) {
  const { colors } = useTheme();
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const supabase = getSupabaseClient();

  useEffect(() => {
    if (visible) {
      loadChats();
    }
  }, [visible]);

  const loadChats = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const formattedChats: ChatItem[] = data.map(chat => ({
        id: chat.id,
        title: chat.title || `Chat ${new Date(chat.created_at).toLocaleDateString()}`,
        lastMessage: chat.last_message || 'No messages yet',
        timestamp: new Date(chat.updated_at).toLocaleString(),
        isPinned: chat.is_pinned || false,
        messageCount: chat.message_count || 0,
      }));

      setChats(formattedChats);
    } catch (error) {
      console.error('Error loading chats:', error);
      Alert.alert('Error', 'Failed to load chat history');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectChat = (chat: ChatItem) => {
    onSelectChat(chat.id);
    onClose();
  };

  const handlePinChat = async (chatId: string, isPinned: boolean) => {
    try {
      const { error } = await supabase
        .from('conversations')
        .update({ is_pinned: !isPinned })
        .eq('id', chatId);

      if (error) throw error;

      setChats(prev => prev.map(chat =>
        chat.id === chatId ? { ...chat, isPinned: !isPinned } : chat
      ));
    } catch (error) {
      console.error('Error pinning chat:', error);
      Alert.alert('Error', 'Failed to pin/unpin chat');
    }
  };

  const handleDeleteChat = (chatId: string) => {
    Alert.alert(
      'Delete Chat',
      'Are you sure you want to delete this chat? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('conversations')
                .delete()
                .eq('id', chatId);

              if (error) throw error;

              setChats(prev => prev.filter(chat => chat.id !== chatId));
            } catch (error) {
              console.error('Error deleting chat:', error);
              Alert.alert('Error', 'Failed to delete chat');
            }
          }
        }
      ]
    );
  };

  const handleRenameChat = async (chatId: string) => {
    if (!editTitle.trim()) return;

    try {
      const { error } = await supabase
        .from('conversations')
        .update({ title: editTitle.trim() })
        .eq('id', chatId);

      if (error) throw error;

      setChats(prev => prev.map(chat =>
        chat.id === chatId ? { ...chat, title: editTitle.trim() } : chat
      ));
      setEditingChatId(null);
      setEditTitle('');
    } catch (error) {
      console.error('Error renaming chat:', error);
      Alert.alert('Error', 'Failed to rename chat');
    }
  };

  const startEditing = (chat: ChatItem) => {
    setEditingChatId(chat.id);
    setEditTitle(chat.title);
  };

  const renderChatItem = ({ item }: { item: ChatItem }) => (
    <TouchableOpacity
      style={[
        styles.chatItem,
        {
          backgroundColor: currentChatId === item.id ? colors.primary + '20' : colors.surface,
          borderColor: currentChatId === item.id ? colors.primary : colors.border,
        }
      ]}
      onPress={() => handleSelectChat(item)}
    >
      <View style={styles.chatContent}>
        <View style={styles.chatHeader}>
          {item.isPinned && (
            <Ionicons name="pin" size={16} color={colors.primary} style={styles.pinIcon} />
          )}
          {editingChatId === item.id ? (
            <TextInput
              style={[styles.titleInput, { color: colors.text }]}
              value={editTitle}
              onChangeText={setEditTitle}
              onBlur={() => handleRenameChat(item.id)}
              onSubmitEditing={() => handleRenameChat(item.id)}
              autoFocus
              selectTextOnFocus
            />
          ) : (
            <Text
              style={[styles.chatTitle, { color: colors.text }]}
              numberOfLines={1}
            >
              {item.title}
            </Text>
          )}
        </View>
        <Text
          style={[styles.chatMessage, { color: colors.textSecondary }]}
          numberOfLines={2}
        >
          {item.lastMessage}
        </Text>
        <View style={styles.chatFooter}>
          <Text style={[styles.timestamp, { color: colors.textSecondary }]}>
            {item.timestamp}
          </Text>
          <Text style={[styles.messageCount, { color: colors.textSecondary }]}>
            {item.messageCount} messages
          </Text>
        </View>
      </View>

      <View style={styles.chatActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => startEditing(item)}
        >
          <Ionicons name="pencil" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handlePinChat(item.id, item.isPinned)}
        >
          <Ionicons
            name={item.isPinned ? "pin" : "pin-outline"}
            size={20}
            color={item.isPinned ? colors.primary : colors.textSecondary}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleDeleteChat(item.id)}
        >
          <Ionicons name="trash-outline" size={20} color="#FF3B30" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const pinnedChats = chats.filter(chat => chat.isPinned);
  const unpinnedChats = chats.filter(chat => !chat.isPinned);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <BlurView intensity={20} style={styles.overlay}>
        <View style={styles.container}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]}>
              Chat History
            </Text>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={[styles.newChatButton, { backgroundColor: colors.primary }]}
                onPress={() => {
                  onNewChat();
                  onClose();
                }}
              >
                <Ionicons name="add" size={20} color="#FFFFFF" />
                <Text style={styles.newChatText}>New Chat</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                Loading chats...
              </Text>
            </View>
          ) : (
            <FlatList
              data={[...pinnedChats, ...unpinnedChats]}
              renderItem={renderChatItem}
              keyExtractor={(item) => item.id}
              style={styles.chatList}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="chatbubble-outline" size={48} color={colors.textSecondary} />
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    No chats yet
                  </Text>
                  <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                    Start a new conversation to see it here
                  </Text>
                </View>
              }
            />
          )}
        </View>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  container: {
    flex: 1,
    backgroundColor: 'rgba(28, 28, 30, 0.98)',
    marginTop: 50,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: Typography.h2.fontSize,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  newChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginRight: Spacing.md,
  },
  newChatText: {
    color: '#FFFFFF',
    fontSize: Typography.body.fontSize,
    fontWeight: '600',
    marginLeft: Spacing.xs,
  },
  closeButton: {
    padding: Spacing.sm,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: Typography.body.fontSize,
  },
  chatList: {
    flex: 1,
    padding: Spacing.md,
  },
  chatItem: {
    flexDirection: 'row',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  chatContent: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  pinIcon: {
    marginRight: Spacing.xs,
  },
  chatTitle: {
    fontSize: Typography.body.fontSize,
    fontWeight: '600',
    flex: 1,
  },
  titleInput: {
    fontSize: Typography.body.fontSize,
    fontWeight: '600',
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  chatMessage: {
    fontSize: Typography.caption.fontSize,
    marginBottom: Spacing.xs,
    lineHeight: 18,
  },
  chatFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timestamp: {
    fontSize: Typography.caption.fontSize,
  },
  messageCount: {
    fontSize: Typography.caption.fontSize,
  },
  chatActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: Spacing.sm,
  },
  actionButton: {
    padding: Spacing.xs,
    marginLeft: Spacing.xs,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: Typography.h2.fontSize,
    fontWeight: '600',
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  emptySubtext: {
    fontSize: Typography.body.fontSize,
    textAlign: 'center',
  },
});