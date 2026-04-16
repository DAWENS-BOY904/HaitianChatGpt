import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  TextInput,
  Share,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useTheme } from '../hooks/useTheme';
import { getSupabaseClient } from '@/template';
import { useConversation } from '../hooks/useConversation';

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface ChatHistoryModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
  currentChatId?: string;
  conversations?: Conversation[];
}

export function ChatHistoryModal({
  visible,
  onClose,
  onSelectChat,
  onNewChat,
  currentChatId,
  conversations: propConversations,
}: ChatHistoryModalProps) {
  const { colors, isDark } = useTheme();
  const { conversations: ctxConversations, selectConversation, deleteConversation, archiveConversation, updateConversationTitle } = useConversation();
  const supabase = getSupabaseClient();

  const conversations = propConversations || ctxConversations;

  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');

  useEffect(() => {
    if (visible) {
      supabase.from('conversations').select('id').eq('is_pinned', true)
        .then(({ data }) => {
          if (data) setPinnedIds(new Set(data.map((c: any) => c.id)));
        });
    }
  }, [visible]);

  const sortedConvs = [...conversations].sort((a, b) => {
    const aPinned = pinnedIds.has(a.id) ? 1 : 0;
    const bPinned = pinnedIds.has(b.id) ? 1 : 0;
    return bPinned - aPinned;
  });

  const handlePin = async (id: string) => {
    const newPinned = !pinnedIds.has(id);
    await supabase.from('conversations').update({ is_pinned: newPinned }).eq('id', id);
    setPinnedIds(prev => {
      const next = new Set(prev);
      newPinned ? next.add(id) : next.delete(id);
      return next;
    });
  };

  const handleArchive = async (id: string) => {
    await archiveConversation(id);
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Chat', 'Permanently delete this chat?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteConversation(id) },
    ]);
  };

  const handleShare = async (conv: Conversation) => {
    await Share.share({ message: `Check out this conversation: ${conv.title}` });
  };

  const startRename = (conv: Conversation) => {
    setRenameId(conv.id);
    setRenameText(conv.title || '');
  };

  const confirmRename = async () => {
    if (renameId && renameText.trim()) {
      await updateConversationTitle(renameId, renameText.trim());
    }
    setRenameId(null);
    setRenameText('');
  };

  const renderItem = ({ item }: { item: Conversation }) => {
    const isActive = currentChatId === item.id;
    const isPinned = pinnedIds.has(item.id);

    return (
      <TouchableOpacity
        style={[
          s.item,
          isActive && { backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' },
        ]}
        activeOpacity={0.7}
        onPress={() => { selectConversation(item.id); onSelectChat(item.id); onClose(); }}
      >
        <View style={s.itemLeft}>
          {isPinned && <Ionicons name="pin" size={12} color="#7C6FF7" style={{ marginRight: 4 }} />}
          {renameId === item.id ? (
            <TextInput
              style={[s.renameInput, { color: colors.text }]}
              value={renameText}
              onChangeText={setRenameText}
              onBlur={confirmRename}
              onSubmitEditing={confirmRename}
              autoFocus
            />
          ) : (
            <Text style={[s.itemTitle, { color: colors.text }]} numberOfLines={1}>
              {item.title || 'New conversation'}
            </Text>
          )}
        </View>
        {/* Action row */}
        <View style={s.actions}>
          <TouchableOpacity onPress={() => handleShare(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="share-outline" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handlePin(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name={isPinned ? 'pin' : 'pin-outline'} size={16} color={isPinned ? '#7C6FF7' : colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => startRename(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="pencil-outline" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleArchive(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="archive-outline" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="trash-outline" size={16} color="#FF453A" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[s.container, { backgroundColor: isDark ? '#0A0A0A' : '#F2F2F7' }]}>
          {/* Header */}
          <View style={[s.header, { borderBottomColor: isDark ? '#222' : '#DDD' }]}>
            <Text style={[s.headerTitle, { color: colors.text }]}>Chats</Text>
            <TouchableOpacity
              style={[s.newBtn, { backgroundColor: '#7C6FF7' }]}
              onPress={() => { onNewChat(); onClose(); }}
            >
              <Ionicons name="add" size={18} color="#FFF" />
              <Text style={s.newBtnText}>New Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={{ padding: 8 }}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={sortedConvs}
            renderItem={renderItem}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingVertical: 8 }}
            ListEmptyComponent={
              <View style={s.empty}>
                <Ionicons name="chatbubble-outline" size={44} color={colors.textSecondary} />
                <Text style={[s.emptyText, { color: colors.textSecondary }]}>No conversations yet</Text>
              </View>
            }
          />
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  container: {
    flex: 1,
    marginTop: 60,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '700' },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  newBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    marginHorizontal: 8,
    borderRadius: 12,
    marginBottom: 2,
  },
  itemLeft: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  itemTitle: { fontSize: 16, fontWeight: '400', flex: 1 },
  renameInput: {
    flex: 1,
    fontSize: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#7C6FF7',
    paddingVertical: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginLeft: 8,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 16, fontWeight: '500' },
});
