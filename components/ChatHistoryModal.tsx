/**
 * ChatHistoryModal - Redesigned like ChatGPT side menu
 * Shows chat list with preview popup + action sheet (Share, Pin, Rename, Archive, Delete)
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  TextInput,
  Animated,
  Share,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useTheme } from '../hooks/useTheme';
import { getSupabaseClient } from '@/template';
import { useRouter } from 'expo-router';

const { width: SW, height: SH } = Dimensions.get('window');

interface ConvItem {
  id: string;
  title: string;
  isPinned: boolean;
  updatedAt: string;
  previewMessages?: Array<{ role: string; content: string }>;
}

interface ChatHistoryModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
  currentChatId?: string;
  conversations?: Array<{ id: string; title: string; updatedAt?: string }>;
}

// ─── Mini Chat Preview Card ───────────────────────────────────────────────────
function ChatPreviewCard({ conv, visible, onClose, onAction }: {
  conv: ConvItem | null;
  visible: boolean;
  onClose: () => void;
  onAction: (action: 'share' | 'pin' | 'rename' | 'archive' | 'delete') => void;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 200, friction: 20, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 0.92, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!conv) return null;

  const userMsgs = (conv.previewMessages || []).filter(m => m.role === 'user');
  const aiMsgs = (conv.previewMessages || []).filter(m => m.role === 'assistant');

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={pvStyles.backdrop} activeOpacity={1} onPress={onClose}>
        <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFill} />
      </TouchableOpacity>

      <Animated.View style={[pvStyles.container, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        {/* Chat preview panel */}
        <View style={pvStyles.previewPanel}>
          <View style={pvStyles.previewHeader}>
            {userMsgs.slice(0, 1).map((m, i) => (
              <View key={i} style={pvStyles.userBubble}>
                <Text style={pvStyles.userBubbleText} numberOfLines={3}>{m.content}</Text>
              </View>
            ))}
          </View>
          {aiMsgs.slice(0, 1).map((m, i) => (
            <View key={i} style={pvStyles.aiMessage}>
              <Text style={pvStyles.aiMessageText} numberOfLines={4}>{m.content}</Text>
            </View>
          ))}
          {(!conv.previewMessages || conv.previewMessages.length === 0) && (
            <View style={pvStyles.emptyPreview}>
              <Text style={pvStyles.emptyPreviewText}>No messages yet</Text>
            </View>
          )}
        </View>

        {/* Title row */}
        <View style={pvStyles.titleRow}>
          <Text style={pvStyles.convTitle} numberOfLines={1}>{conv.title}</Text>
        </View>

        {/* Action sheet */}
        <View style={pvStyles.actionSheet}>
          {[
            { id: 'share' as const, icon: 'arrow-up-outline', label: 'Share chat', color: '#000' },
            { id: 'pin' as const, icon: conv.isPinned ? 'pin' : 'pin-outline', label: conv.isPinned ? 'Unpin' : 'Pin', color: '#000' },
            { id: 'rename' as const, icon: 'pencil-outline', label: 'Rename', color: '#000' },
            { id: 'archive' as const, icon: 'archive-outline', label: 'Archive', color: '#000' },
            { id: 'delete' as const, icon: 'trash-outline', label: 'Delete', color: '#E53935' },
          ].map((item, idx) => (
            <TouchableOpacity
              key={item.id}
              style={[pvStyles.actionItem, idx > 0 && pvStyles.actionBorder]}
              onPress={() => { onClose(); setTimeout(() => onAction(item.id), 50); }}
            >
              <Ionicons name={item.icon as any} size={20} color={item.color} style={pvStyles.actionIcon} />
              <Text style={[pvStyles.actionLabel, { color: item.color }]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>
    </Modal>
  );
}

const pvStyles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  container: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
  },
  previewPanel: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 20,
    minHeight: 160,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 12,
  },
  previewHeader: {
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  userBubble: {
    backgroundColor: '#F2E8DC',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxWidth: '75%',
  },
  userBubbleText: {
    fontSize: 15,
    color: '#1a1a1a',
    lineHeight: 20,
  },
  aiMessage: {
    marginTop: 4,
  },
  aiMessageText: {
    fontSize: 15,
    color: '#1a1a1a',
    lineHeight: 22,
  },
  emptyPreview: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  emptyPreviewText: {
    color: '#999',
    fontSize: 14,
  },
  titleRow: {
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  convTitle: {
    fontSize: 14,
    color: '#555',
    fontWeight: '500',
  },
  actionSheet: {
    backgroundColor: '#F7F7F7',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFF',
  },
  actionBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  actionIcon: {
    marginRight: 16,
  },
  actionLabel: {
    fontSize: 17,
    fontWeight: '400',
  },
});

// ─── Rename Modal ─────────────────────────────────────────────────────────────
function RenameBlurModal({ visible, currentTitle, onConfirm, onCancel }: {
  visible: boolean; currentTitle: string;
  onConfirm: (t: string) => void; onCancel: () => void;
}) {
  const [text, setText] = useState(currentTitle);
  useEffect(() => { if (visible) setText(currentTitle); }, [visible, currentTitle]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={rnStyles.card}>
          <BlurView intensity={90} tint="dark" style={rnStyles.cardBlur}>
            <Text style={rnStyles.title}>Rename chat</Text>
            <TextInput
              style={rnStyles.input}
              value={text}
              onChangeText={setText}
              autoFocus
              selectTextOnFocus
              placeholderTextColor="rgba(255,255,255,0.4)"
              returnKeyType="done"
              onSubmitEditing={() => text.trim() && onConfirm(text.trim())}
            />
            <View style={rnStyles.btnRow}>
              <TouchableOpacity style={rnStyles.btn} onPress={onCancel}>
                <Text style={rnStyles.btnLabel}>Cancel</Text>
              </TouchableOpacity>
              <View style={rnStyles.divider} />
              <TouchableOpacity style={rnStyles.btn} onPress={() => text.trim() && onConfirm(text.trim())}>
                <Text style={[rnStyles.btnLabel, { fontWeight: '600' }]}>OK</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      </View>
    </Modal>
  );
}
const rnStyles = StyleSheet.create({
  card: { width: '80%', borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 20 },
  cardBlur: { padding: 20, alignItems: 'center' },
  title: { color: '#FFF', fontSize: 17, fontWeight: '600', marginBottom: 16 },
  input: { width: '100%', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: 14, fontSize: 16, color: '#FFF', marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  btnRow: { flexDirection: 'row', width: '100%' },
  btn: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  btnLabel: { color: '#FFF', fontSize: 17 },
  divider: { width: 1, backgroundColor: 'rgba(255,255,255,0.15)' },
});

// ─── Main ChatHistoryModal ────────────────────────────────────────────────────
export function ChatHistoryModal({
  visible,
  onClose,
  onSelectChat,
  onNewChat,
  currentChatId,
  conversations: propConversations,
}: ChatHistoryModalProps) {
  const { colors, isDark } = useTheme();
  const supabase = getSupabaseClient();
  const router = useRouter();

  const [convItems, setConvItems] = useState<ConvItem[]>([]);
  const [selectedConv, setSelectedConv] = useState<ConvItem | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [renameVisible, setRenameVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const slideAnim = useRef(new Animated.Value(SH)).current;

  useEffect(() => {
    if (visible) {
      loadConversations();
      Animated.spring(slideAnim, { toValue: 0, tension: 200, friction: 25, useNativeDriver: true }).start();
    } else {
      Animated.timing(slideAnim, { toValue: SH, duration: 250, useNativeDriver: true }).start();
    }
  }, [visible]);

  const loadConversations = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('id, title, updated_at, is_pinned')
        .or('is_archived.is.null,is_archived.eq.false')
        .order('is_pinned', { ascending: false })
        .order('updated_at', { ascending: false });

      if (!error && data) {
        setConvItems(data.map((c: any) => ({
          id: c.id,
          title: c.title || 'New Chat',
          isPinned: c.is_pinned || false,
          updatedAt: c.updated_at,
        })));
      }
    } catch (e) {
      console.error('Error loading convs:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadPreview = async (conv: ConvItem) => {
    try {
      const { data } = await supabase
        .from('messages')
        .select('role, content')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: true })
        .limit(6);
      return data || [];
    } catch {
      return [];
    }
  };

  const handleChatPress = async (conv: ConvItem) => {
    const msgs = await loadPreview(conv);
    setSelectedConv({ ...conv, previewMessages: msgs });
    setPreviewVisible(true);
  };

  const handleAction = useCallback(async (action: 'share' | 'pin' | 'rename' | 'archive' | 'delete') => {
    if (!selectedConv) return;
    const convId = selectedConv.id;

    if (action === 'share') {
      try {
        const { data } = await supabase
          .from('messages')
          .select('role, content')
          .eq('conversation_id', convId)
          .order('created_at', { ascending: true });
        const text = (data || []).map((m: any) => `${m.role === 'user' ? 'You' : 'AI'}: ${m.content}`).join('\n\n');
        await Share.share({ message: text, title: selectedConv.title });
      } catch {}
      return;
    }

    if (action === 'pin') {
      const newPinned = !selectedConv.isPinned;
      await supabase.from('conversations').update({ is_pinned: newPinned }).eq('id', convId);
      setConvItems(prev => {
        const updated = prev.map(c => c.id === convId ? { ...c, isPinned: newPinned } : c);
        return [...updated.filter(c => c.isPinned), ...updated.filter(c => !c.isPinned)];
      });
      return;
    }

    if (action === 'rename') {
      setRenameVisible(true);
      return;
    }

    if (action === 'archive') {
      await supabase.from('conversations').update({ is_archived: true } as any).eq('id', convId);
      setConvItems(prev => prev.filter(c => c.id !== convId));
      onClose();
      router.push('/archived-chats');
      return;
    }

    if (action === 'delete') {
      await supabase.from('conversations').delete().eq('id', convId);
      setConvItems(prev => prev.filter(c => c.id !== convId));
      if (currentChatId === convId) {
        onNewChat();
      }
      return;
    }
  }, [selectedConv, currentChatId, onNewChat, onClose, router, supabase]);

  const handleRename = async (newTitle: string) => {
    if (!selectedConv) return;
    await supabase.from('conversations').update({ title: newTitle }).eq('id', selectedConv.id);
    setConvItems(prev => prev.map(c => c.id === selectedConv.id ? { ...c, title: newTitle } : c));
    setRenameVisible(false);
  };

  const pinned = convItems.filter(c => c.isPinned);
  const recent = convItems.filter(c => !c.isPinned);

  const renderItem = ({ item }: { item: ConvItem }) => (
    <TouchableOpacity
      style={[
        histStyles.chatRow,
        currentChatId === item.id && { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)' },
      ]}
      onPress={() => { onSelectChat(item.id); onClose(); }}
      onLongPress={() => handleChatPress(item)}
    >
      {item.isPinned && (
        <Ionicons name="pin" size={14} color={colors.textSecondary} style={{ marginRight: 6, transform: [{ rotate: '45deg' }] }} />
      )}
      <Text style={[histStyles.chatTitle, { color: colors.text }]} numberOfLines={1}>
        {item.title}
      </Text>
      <TouchableOpacity
        style={histStyles.chatDotsBtn}
        onPress={() => handleChatPress(item)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="ellipsis-horizontal" size={16} color={colors.textSecondary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  if (!visible) return null;

  return (
    <>
      <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose}>
          <View style={{ flex: 1, backgroundColor: 'transparent' }} />
        </TouchableOpacity>

        <Animated.View style={[histStyles.sheet, { backgroundColor: isDark ? '#1C1C1E' : '#FFF', transform: [{ translateY: slideAnim }] }]}>
          {/* Handle */}
          <View style={histStyles.handle} />

          {/* Section: Pinned */}
          {pinned.length > 0 && (
            <>
              <Text style={[histStyles.sectionLabel, { color: colors.textSecondary }]}>Pinned</Text>
              {pinned.map(item => (
                <View key={item.id}>{renderItem({ item })}</View>
              ))}
            </>
          )}

          {/* Section: Recents */}
          <Text style={[histStyles.sectionLabel, { color: colors.textSecondary }]}>Recents</Text>
          <FlatList
            data={recent}
            renderItem={renderItem}
            keyExtractor={i => i.id}
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: SH * 0.5 }}
            ListEmptyComponent={
              <View style={histStyles.empty}>
                <Text style={{ color: colors.textSecondary, fontSize: 14 }}>No conversations yet</Text>
              </View>
            }
          />

          {/* New Chat Button */}
          <TouchableOpacity
            style={[histStyles.newChatBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }]}
            onPress={() => { onNewChat(); onClose(); }}
          >
            <Ionicons name="add" size={20} color={colors.text} />
            <Text style={[histStyles.newChatText, { color: colors.text }]}>New Chat</Text>
          </TouchableOpacity>
        </Animated.View>
      </Modal>

      <ChatPreviewCard
        conv={selectedConv}
        visible={previewVisible}
        onClose={() => setPreviewVisible(false)}
        onAction={handleAction}
      />

      <RenameBlurModal
        visible={renameVisible}
        currentTitle={selectedConv?.title || ''}
        onConfirm={handleRename}
        onCancel={() => setRenameVisible(false)}
      />
    </>
  );
}

const histStyles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 16,
    maxHeight: '85%',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(128,128,128,0.3)',
    alignSelf: 'center', marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 12, fontWeight: '600',
    letterSpacing: 0.5, textTransform: 'uppercase',
    marginBottom: 4, marginTop: 8,
  },
  chatRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 13,
    borderRadius: 10, marginBottom: 1,
  },
  chatTitle: {
    flex: 1, fontSize: 15, fontWeight: '400',
  },
  chatDotsBtn: {
    padding: 4,
  },
  newChatBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderRadius: 14, marginTop: 12, gap: 10,
  },
  newChatText: {
    fontSize: 15, fontWeight: '600',
  },
  empty: {
    paddingVertical: 20, alignItems: 'center',
  },
});
