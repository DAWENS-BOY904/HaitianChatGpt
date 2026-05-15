import React, { useState, useEffect, useRef } from 'react';
import { getSupabaseClient } from '@/template';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
  TextInput,
  StatusBar,
  Platform,
  Pressable,
  Modal,
  Share,
  Alert,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import ReAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { useSettings } from '../hooks/useSettings';
import { useAuth } from '@/template';
import { useConversation } from '../hooks/useConversation';
import { BorderRadius } from '../constants/theme';
import { useRouter } from 'expo-router';
import { useProfile } from '../contexts/ProfileContext';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export type AIMode = 'instant' | 'deep-thinking' | 'agent';

interface SideMenuProps {
  visible: boolean;
  onClose: () => void;
  currentProject?: { name: string; logo?: string };
  currentAIMode: AIMode;
  onSelectAIMode: (mode: AIMode) => void;
  onNewChat: () => void;
  onChatHistory: () => void;
  onSettings: () => void;
  onProfile: () => void;
  userCoins?: number;
  isUnlimited?: boolean;
  isAdmin?: boolean;
  isGuest?: boolean;
}

interface ConvActionMenuProps {
  visible: boolean;
  conv: { id: string; title: string; isPinned?: boolean } | null;
  onClose: () => void;
  onAction: (action: 'share' | 'pin' | 'rename' | 'archive' | 'delete') => void;
}

// ── iOS-style Chat Preview + Action Modal ──────────────────────────────────

interface ChatPreviewModalProps {
  visible: boolean;
  conv: { id: string; title: string; isPinned?: boolean } | null;
  previewMessages: Array<{ role: string; content: string }>;
  onClose: () => void;
  onAction: (action: 'pin' | 'rename' | 'archive' | 'delete') => void;
  isDark: boolean;
}

function ChatPreviewModal({ visible, conv, previewMessages, onClose, onAction, isDark }: ChatPreviewModalProps) {
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const previewScaleAnim = useRef(new Animated.Value(0.94)).current;
  const actionsOpacityAnim = useRef(new Animated.Value(0)).current;
  const actionsScaleAnim = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacityAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(previewScaleAnim, { toValue: 1, tension: 260, friction: 22, useNativeDriver: true }),
      ]).start(() => {
        Animated.parallel([
          Animated.timing(actionsOpacityAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
          Animated.spring(actionsScaleAnim, { toValue: 1, tension: 260, friction: 22, useNativeDriver: true }),
        ]).start();
      });
    } else {
      Animated.parallel([
        Animated.timing(opacityAnim, { toValue: 0, duration: 160, useNativeDriver: true }),
        Animated.timing(previewScaleAnim, { toValue: 0.94, duration: 130, useNativeDriver: true }),
        Animated.timing(actionsOpacityAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
        Animated.timing(actionsScaleAnim, { toValue: 0.92, duration: 100, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!conv) return null;

  const previewBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const previewTextC = isDark ? '#FFFFFF' : '#000000';
  const previewSubC = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)';
  const actionsTextC = isDark ? '#FFFFFF' : '#000000';
  const actionsDivC = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.07)';
  const actionsBg = isDark ? 'rgba(44,44,46,0.97)' : 'rgba(255,255,255,0.97)';

  const actionItems = [
    { key: 'pin', label: conv.isPinned ? 'Unpin' : 'Pin', icon: conv.isPinned ? 'pin' : 'pin-outline', destructive: false },
    { key: 'rename', label: 'Rename', icon: 'pencil-outline', destructive: false },
    { key: 'archive', label: 'Archive', icon: 'archivebox-outline', destructive: false },
    { key: 'delete', label: 'Delete', icon: 'trash-outline', destructive: true },
  ] as const;

  const recentMessages = previewMessages.slice(-5);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: opacityAnim }]}>
        {/* Dimmed blur background */}
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose}>
          {Platform.OS === 'ios' ? (
            <BlurView
              intensity={isDark ? 55 : 38}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(0,0,0,0.62)' : 'rgba(0,0,0,0.32)' }]} />
          )}
        </TouchableOpacity>

        {/* Content container */}
        <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 80, paddingBottom: 40 }}>
          {/* Chat Preview Card */}
          <Animated.View
            style={[{
              backgroundColor: previewBg,
              borderRadius: 20,
              overflow: 'hidden',
              maxHeight: SCREEN_HEIGHT * 0.52,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 14 },
              shadowOpacity: isDark ? 0.55 : 0.18,
              shadowRadius: 28,
              elevation: 28,
            }, { transform: [{ scale: previewScaleAnim }] }]}
          >
            {/* Chat title header */}
            <View style={{
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: actionsDivC,
              alignItems: 'center',
            }}>
              <Text style={{ color: previewSubC, fontSize: 13, fontWeight: '500' }}>
                {conv.title || 'New chat'}
              </Text>
            </View>

            {/* Messages preview */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              scrollEnabled={false}
              contentContainerStyle={{ padding: 14, gap: 10 }}
            >
              {recentMessages.length === 0 ? (
                <Text style={{ color: previewSubC, fontSize: 15, textAlign: 'center', paddingVertical: 24 }}>
                  No messages yet
                </Text>
              ) : (
                recentMessages.map((msg, i) => (
                  <View
                    key={i}
                    style={[
                      {
                        maxWidth: '80%',
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        borderRadius: 18,
                      },
                      msg.role === 'user'
                        ? { alignSelf: 'flex-end', backgroundColor: '#D1F2D3' }
                        : { alignSelf: 'flex-start', backgroundColor: isDark ? '#2C2C2E' : '#F0F0F5' },
                    ]}
                  >
                    <Text
                      style={{
                        color: msg.role === 'user' ? '#1A3A1E' : previewTextC,
                        fontSize: 14,
                        lineHeight: 20,
                      }}
                      numberOfLines={4}
                    >
                      {(msg.content || '').replace(/[#*`\[\]]/g, '').trim()}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>
          </Animated.View>

          {/* Action Buttons — floating below preview */}
          <Animated.View
            style={[{
              marginTop: 10,
              width: 264,
              borderRadius: 17,
              overflow: 'hidden',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: isDark ? 0.42 : 0.14,
              shadowRadius: 20,
              elevation: 20,
            }, {
              opacity: actionsOpacityAnim,
              transform: [{ scale: actionsScaleAnim }],
            }]}
          >
            {Platform.OS === 'ios' ? (
              <BlurView intensity={isDark ? 90 : 80} tint={isDark ? 'dark' : 'extraLight'} style={{ borderRadius: 17, overflow: 'hidden' }}>
                {actionItems.map((item, i) => (
                  <TouchableOpacity
                    key={item.key}
                    style={[{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 18,
                      paddingVertical: 15,
                      gap: 16,
                    }, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: actionsDivC }]}
                    activeOpacity={0.65}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onClose();
                      setTimeout(() => onAction(item.key as any), 70);
                    }}
                  >
                    <Ionicons name={item.icon as any} size={21} color={item.destructive ? '#FF3B30' : actionsTextC} />
                    <Text style={{ fontSize: 17, fontWeight: '400', color: item.destructive ? '#FF3B30' : actionsTextC }}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </BlurView>
            ) : (
              <View style={{ backgroundColor: actionsBg, borderRadius: 17 }}>
                {actionItems.map((item, i) => (
                  <TouchableOpacity
                    key={item.key}
                    style={[{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 18,
                      paddingVertical: 15,
                      gap: 16,
                    }, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: actionsDivC }]}
                    activeOpacity={0.65}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onClose();
                      setTimeout(() => onAction(item.key as any), 70);
                    }}
                  >
                    <Ionicons name={item.icon as any} size={21} color={item.destructive ? '#FF3B30' : actionsTextC} />
                    <Text style={{ fontSize: 17, fontWeight: '400', color: item.destructive ? '#FF3B30' : actionsTextC }}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </Animated.View>
        </View>
      </Animated.View>
    </Modal>
  );
}

// ── Rename Modal ──────────────────────────────────────────────────────────
function RenameModal({ visible, currentTitle, onConfirm, onCancel }: {
  visible: boolean; currentTitle: string; onConfirm: (t: string) => void; onCancel: () => void;
}) {
  const [text, setText] = useState(currentTitle);
  useEffect(() => { if (visible) setText(currentTitle); }, [visible, currentTitle]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={rnStyles.backdrop}>
        <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={rnStyles.card}>
          <BlurView intensity={90} tint="dark" style={rnStyles.cardInner}>
            <Text style={rnStyles.title}>Rename chat</Text>
            <TextInput
              style={rnStyles.input}
              value={text}
              onChangeText={setText}
              autoFocus
              selectTextOnFocus
              placeholderTextColor="rgba(255,255,255,0.4)"
              placeholder="Chat name..."
            />
            <View style={rnStyles.btnRow}>
              <TouchableOpacity style={rnStyles.btn} onPress={onCancel}>
                <Text style={rnStyles.btnLabel}>Cancel</Text>
              </TouchableOpacity>
              <View style={rnStyles.divider} />
              <TouchableOpacity style={rnStyles.btn} onPress={() => onConfirm(text.trim())}>
                <Text style={[rnStyles.btnLabel, { fontWeight: '700' }]}>OK</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      </View>
    </Modal>
  );
}

const rnStyles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    width: '80%',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 24,
  },
  cardInner: { padding: 22, alignItems: 'center' },
  title: { color: '#FFF', fontSize: 17, fontWeight: '700', marginBottom: 16 },
  input: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#FFF',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  btnRow: { flexDirection: 'row', width: '100%' },
  btn: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  btnLabel: { color: '#FFF', fontSize: 17 },
  divider: { width: 1, backgroundColor: 'rgba(255,255,255,0.12)' },
});

// Quick actions
const BASE_QUICK_ACTIONS = [
  { id: 'projects', icon: 'folder-outline', label: 'Projects', color: '#8B5CF6', route: '/project-get' },
  { id: 'images', icon: 'images-outline', label: 'Images', color: '#EC4899', route: '/images' },
  { id: 'apps', icon: 'grid-outline', label: 'Apps', color: '#6366F1', route: '/app-connect' },
  { id: 'upgrade', icon: 'sparkles', label: 'Upgrade', color: '#7C3AED', isUpgrade: true },
];

export function SideMenu({
  visible,
  onClose,
  currentProject,
  currentAIMode,
  onSelectAIMode,
  onNewChat,
  onChatHistory,
  onSettings,
  onProfile,
  userCoins = 0,
  isUnlimited = false,
  isAdmin = false,
  isGuest = false,
}: SideMenuProps) {
  const { colors, isDark } = useTheme();
  const { settings } = useSettings();
  const { user } = useAuth();
  const router = useRouter();
  const {
    conversations,
    currentConversation,
    selectConversation,
    deleteConversation,
    archiveConversation,
    archiveAllConversations,
    deleteAllConversations,
    updateConversationTitle,
    searchConversations,
  } = useConversation();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  const isPro = isAdmin || isUnlimited;
  const QUICK_ACTIONS = isPro
    ? BASE_QUICK_ACTIONS.filter(qa => !qa.isUpgrade)
    : BASE_QUICK_ACTIONS;

  const handleQuickAction = (action: { id: string; route?: string; isUpgrade?: boolean }) => {
    if (action.isUpgrade) { onClose(); router.push('/subscription'); return; }
    if (action.route) { onClose(); router.push(action.route as any); }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [searchActive, setSearchActive] = useState(false);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const { profilePhotoUrl: globalPhotoUrl, displayName: globalDisplayName, refreshKey } = useProfile();

  const [actionMenuConv, setActionMenuConv] = useState<{ id: string; title: string; isPinned?: boolean } | null>(null);
  const [chatPreviewVisible, setChatPreviewVisible] = useState(false);
  const [chatPreviewMessages, setChatPreviewMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [renameVisible, setRenameVisible] = useState(false);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (globalPhotoUrl) setProfilePhotoUrl(globalPhotoUrl);
  }, [globalPhotoUrl, refreshKey]);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from('user_profiles').select('profile_photo_url').eq('id', user.id).single()
      .then(({ data }) => { if (data?.profile_photo_url) setProfilePhotoUrl(data.profile_photo_url); });
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from('conversations').select('id, is_pinned').eq('user_id', user.id).eq('is_pinned', true)
      .then(({ data }) => {
        if (data) setPinnedIds(new Set(data.map((c: any) => c.id)));
      });
  }, [user?.id, visible]);

  const accentColor = settings.accentColor || '#10A37F';

  const translateX = useSharedValue(-SCREEN_WIDTH);
  const overlayOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateX.value = withSpring(0, { damping: 28, stiffness: 280, mass: 0.9 });
      overlayOpacity.value = withTiming(1, { duration: 220 });
    } else {
      translateX.value = withSpring(-SCREEN_WIDTH, { damping: 28, stiffness: 280 });
      overlayOpacity.value = withTiming(0, { duration: 180 });
    }
  }, [visible]);

  const containerStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] } as any));
  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value } as any));

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onUpdate((e) => {
      if (e.translationX < 0) {
        translateX.value = Math.max(-SCREEN_WIDTH, e.translationX);
        overlayOpacity.value = interpolate(e.translationX, [-SCREEN_WIDTH, 0], [0, 1], Extrapolate.CLAMP);
      }
    })
    .onEnd((e) => {
      if (e.translationX < -SCREEN_WIDTH * 0.3 || e.velocityX < -600) {
        runOnJS(onClose)();
      } else {
        translateX.value = withSpring(0, { damping: 28, stiffness: 280 });
        overlayOpacity.value = withTiming(1, { duration: 200 });
      }
    });

  const sortedConversations = [...conversations].sort((a, b) => {
    const aPinned = pinnedIds.has(a.id) ? 1 : 0;
    const bPinned = pinnedIds.has(b.id) ? 1 : 0;
    return bPinned - aPinned;
  });

  const filteredConversations = searchQuery.trim()
    ? searchConversations(searchQuery)
    : sortedConversations;

  const renderConvTitle = (title: string) => {
    if (!searchQuery.trim()) return <Text style={[styles.convTitle, { color: colors.text }]} numberOfLines={1}>{title || 'New conversation'}</Text>;
    const lowerTitle = (title || '').toLowerCase();
    const lowerQuery = searchQuery.toLowerCase();
    const idx = lowerTitle.indexOf(lowerQuery);
    if (idx === -1) return <Text style={[styles.convTitle, { color: colors.text }]} numberOfLines={1}>{title || 'New conversation'}</Text>;
    return (
      <Text style={[styles.convTitle, { color: colors.text }]} numberOfLines={1}>
        {title.slice(0, idx)}
        <Text style={{ backgroundColor: '#10A37F33', color: '#10A37F', fontWeight: '700' }}>{title.slice(idx, idx + searchQuery.length)}</Text>
        {title.slice(idx + searchQuery.length)}
      </Text>
    );
  };

  const getUserInitials = () => {
    if (user?.email) {
      const parts = user.email.split('@')[0].split('.');
      return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0].substring(0, 2).toUpperCase();
    }
    return 'DH';
  };

  // Long press → iOS preview modal
  const handleConvLongPress = async (conv: { id: string; title: string }) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActionMenuConv({ ...conv, isPinned: pinnedIds.has(conv.id) });
    // Fetch recent messages for preview
    try {
      const { data } = await supabase
        .from('messages')
        .select('role, content')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: false })
        .limit(5);
      setChatPreviewMessages(data ? [...data].reverse() : []);
    } catch (_e) {
      setChatPreviewMessages([]);
    }
    setChatPreviewVisible(true);
  };

  const handleConvTap = (conv: { id: string; title: string }) => {
    selectConversation(conv.id);
    onClose();
  };

  // Actions from preview modal
  const handleConvPreviewAction = async (action: 'pin' | 'rename' | 'archive' | 'delete') => {
    if (!actionMenuConv) return;
    if (action === 'rename') { setRenameVisible(true); return; }
    if (action === 'pin') {
      const newPinned = !pinnedIds.has(actionMenuConv.id);
      await supabase.from('conversations').update({ is_pinned: newPinned }).eq('id', actionMenuConv.id);
      setPinnedIds(prev => {
        const next = new Set(prev);
        newPinned ? next.add(actionMenuConv.id) : next.delete(actionMenuConv.id);
        return next;
      });
      return;
    }
    if (action === 'archive') { await archiveConversation(actionMenuConv.id); return; }
    if (action === 'delete') {
      Alert.alert('Delete Chat', 'This will permanently delete this chat.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => { await deleteConversation(actionMenuConv.id); } },
      ]);
    }
  };

  const handleRenameConfirm = async (title: string) => {
    setRenameVisible(false);
    if (!actionMenuConv || !title) return;
    await updateConversationTitle(actionMenuConv.id, title);
    setActionMenuConv(prev => prev ? { ...prev, title } : null);
  };

  const handleArchiveAll = () => {
    Alert.alert('Archive all chats?', 'All conversations will be archived and hidden from the list.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Archive All', style: 'destructive', onPress: async () => { await archiveAllConversations(); } },
    ]);
  };

  const handleDeleteAll = () => {
    Alert.alert('Delete all chats?', 'This will permanently delete all your conversations. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete All', style: 'destructive', onPress: async () => { await deleteAllConversations(); } },
    ]);
  };

  // ── GUEST MODE ──
  if (isGuest) {
    return (
      <>
        <ReAnimated.View
          style={[styles.overlay, overlayStyle]}
          pointerEvents={visible ? 'auto' : 'none'}
        >
          <Pressable style={{ flex: 1 }} onPress={onClose} />
        </ReAnimated.View>

        <GestureDetector gesture={panGesture}>
          <ReAnimated.View
            style={[
              styles.drawer,
              {
                backgroundColor: '#000000',
                paddingTop: insets.top + (Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0),
              },
              containerStyle,
            ]}
          >
            <View style={styles.topHeader}>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                onPress={() => { onClose(); onNewChat(); }}
              >
                <Ionicons name="create-outline" size={22} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '600' }}>New chat</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.divider, { backgroundColor: 'rgba(255,255,255,0.1)' }]} />

            <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 8 }}>
              {[
                { label: 'Terms of Use', route: '/terms-of-use' },
                { label: 'Privacy Policy', route: '/privacy-policy' },
                { label: 'Settings', route: '/settings' },
              ].map((item) => (
                <TouchableOpacity
                  key={item.label}
                  style={{ paddingVertical: 18 }}
                  onPress={() => { onClose(); router.push(item.route as any); }}
                >
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 17 }}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}>
              <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, textAlign: 'center', marginBottom: 14 }}>
                Save your chat history, share chats, and personalize your experience.
              </Text>
              <TouchableOpacity
                style={{ backgroundColor: '#FFFFFF', borderRadius: 50, paddingVertical: 16, alignItems: 'center' }}
                onPress={() => { onClose(); router.push('/login'); }}
              >
                <Text style={{ color: '#000000', fontSize: 17, fontWeight: '700' }}>Sign up or log in</Text>
              </TouchableOpacity>
            </View>
          </ReAnimated.View>
        </GestureDetector>
      </>
    );
  }

  return (
    <>
      <ReAnimated.View
        style={[styles.overlay, overlayStyle]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </ReAnimated.View>

      <GestureDetector gesture={panGesture}>
        <ReAnimated.View
          style={[
            styles.drawer,
            {
              backgroundColor: isDark ? '#000000' : '#FFFFFF',
              paddingTop: insets.top + (Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0),
            },
            containerStyle,
          ]}
        >
          {/* TOP HEADER */}
          <View style={styles.topHeader}>
            <Text style={[styles.appTitle, { color: colors.text }]}>
              {currentProject?.name || 'Dawinix'}
            </Text>

            <View style={styles.headerIconGroup}>
              {Platform.OS === 'ios' ? (
                <BlurView
                  intensity={isDark ? 60 : 50}
                  tint={isDark ? 'dark' : 'light'}
                  style={[styles.headerIconGroupBlur, {
                    borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.1)',
                  }]}
                >
                  <TouchableOpacity
                    style={styles.iconPillBtn}
                    onPress={() => setSearchActive(!searchActive)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="search" size={19} color={colors.text} />
                  </TouchableOpacity>
                  <View style={[styles.iconPillDivider, {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                  }]} />
                  <TouchableOpacity
                    style={styles.iconPillBtn}
                    onPress={() => { onClose(); router.push('/settings'); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    {profilePhotoUrl ? (
                      <Image source={{ uri: profilePhotoUrl }} style={styles.profilePhotoSmall} contentFit="cover" />
                    ) : (
                      <View style={[styles.avatarMini, { backgroundColor: accentColor }]}>
                        <Text style={styles.avatarMiniText}>{getUserInitials()}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </BlurView>
              ) : (
                <View style={[styles.headerIconGroupBlur, {
                  backgroundColor: isDark ? 'rgba(44,44,46,0.88)' : 'rgba(242,242,247,0.88)',
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                }]}>
                  <TouchableOpacity
                    style={styles.iconPillBtn}
                    onPress={() => setSearchActive(!searchActive)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="search" size={19} color={colors.text} />
                  </TouchableOpacity>
                  <View style={[styles.iconPillDivider, {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                  }]} />
                  <TouchableOpacity
                    style={styles.iconPillBtn}
                    onPress={() => { onClose(); router.push('/settings'); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    {profilePhotoUrl ? (
                      <Image source={{ uri: profilePhotoUrl }} style={styles.profilePhotoSmall} contentFit="cover" />
                    ) : (
                      <View style={[styles.avatarMini, { backgroundColor: accentColor }]}>
                        <Text style={styles.avatarMiniText}>{getUserInitials()}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          {/* SEARCH BAR */}
          {searchActive && (
            Platform.OS === 'ios' ? (
              <BlurView
                intensity={isDark ? 55 : 45}
                tint={isDark ? 'dark' : 'light'}
                style={[styles.searchBar, {
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                  overflow: 'hidden',
                }]}
              >
                <Ionicons name="search" size={18} color={colors.textSecondary} />
                <TextInput
                  style={[styles.searchInput, { color: colors.text }]}
                  placeholder="Search conversations..."
                  placeholderTextColor={colors.textSecondary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoFocus
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </BlurView>
            ) : (
              <View style={[styles.searchBar, {
                backgroundColor: isDark ? 'rgba(44,44,46,0.9)' : 'rgba(242,242,247,0.9)',
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
              }]}>
                <Ionicons name="search" size={18} color={colors.textSecondary} />
                <TextInput
                  style={[styles.searchInput, { color: colors.text }]}
                  placeholder="Search conversations..."
                  placeholderTextColor={colors.textSecondary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoFocus
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
            )
          )}

          {/* QUICK ACTIONS */}
          {!searchActive && (
            <View style={[
              styles.quickActionsGrid,
              { justifyContent: QUICK_ACTIONS.length < 4 ? 'flex-start' : 'space-between' },
            ]}>
              {QUICK_ACTIONS.map((qa) => (
                <TouchableOpacity
                  key={qa.id}
                  style={styles.quickActionBtn}
                  activeOpacity={0.7}
                  onPress={() => handleQuickAction(qa)}
                >
                  <View style={[styles.quickActionCircle, { backgroundColor: qa.color + '28' }]}>
                    <Ionicons name={qa.icon as any} size={22} color={qa.color} />
                  </View>
                  <Text style={[styles.quickActionLabel, { color: colors.text }]} numberOfLines={1}>
                    {qa.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {!searchActive && <View style={[styles.divider, { backgroundColor: colors.border }]} />}

          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
            {searchActive && searchQuery ? 'Results' : 'Recents'}
          </Text>

          {/* CONVERSATIONS */}
          <ScrollView
            style={styles.conversationList}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {filteredConversations.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {searchQuery ? 'No results found' : 'No conversations yet'}
              </Text>
            ) : (
              filteredConversations.slice(0, 50).map((conv) => {
                const isActive = currentConversation?.id === conv.id;
                const isPinned = pinnedIds.has(conv.id);
                return (
                  <TouchableOpacity
                    key={conv.id}
                    style={[
                      styles.convItem,
                      isActive && { backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7', borderRadius: 12 },
                    ]}
                    activeOpacity={0.7}
                    onPress={() => handleConvTap(conv)}
                    onLongPress={() => handleConvLongPress(conv)}
                    delayLongPress={380}
                  >
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {isPinned && <Ionicons name="pin" size={12} color={accentColor} />}
                      {renderConvTitle(conv.title || 'New conversation')}
                    </View>
                    {((conv.title || '').toLowerCase().includes('group') || (conv as any).is_group) ? (
                      profilePhotoUrl ? (
                        <Image source={{ uri: profilePhotoUrl }} style={{ width: 28, height: 28, borderRadius: 14, marginLeft: 8 }} contentFit="cover" />
                      ) : (
                        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: isDark ? '#3A3A3C' : '#E5E5EA', alignItems: 'center', justifyContent: 'center', marginLeft: 8 }}>
                          <Text style={{ color: isDark ? '#FFF' : '#000', fontSize: 11, fontWeight: '700' }}>{getUserInitials()[0]}</Text>
                        </View>
                      )
                    ) : null}
                  </TouchableOpacity>
                );
              })
            )}
            <View style={{ height: insets.bottom + 100 }} />
          </ScrollView>

          {/* BULK CHAT ACTIONS */}
          {conversations.length > 0 && !searchActive && (
            <View style={[styles.bulkActionsRow, { borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
              <TouchableOpacity style={styles.bulkActionBtn} onPress={handleArchiveAll} activeOpacity={0.7}>
                <Ionicons name="archive-outline" size={15} color={colors.textSecondary} />
                <Text style={[styles.bulkActionText, { color: colors.textSecondary }]}>Archive All</Text>
              </TouchableOpacity>
              <View style={[styles.bulkActionDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]} />
              <TouchableOpacity style={styles.bulkActionBtn} onPress={handleDeleteAll} activeOpacity={0.7}>
                <Ionicons name="trash-outline" size={15} color="#FF453A" />
                <Text style={[styles.bulkActionText, { color: '#FF453A' }]}>Delete All</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* FLOATING NEW CHAT BUTTON */}
          {Platform.OS === 'ios' ? (
            <View style={[styles.chatFabWrap, { bottom: insets.bottom + 20 }]}>
              <BlurView
                intensity={70}
                tint="dark"
                style={[styles.chatFabBlur, {
                  shadowColor: accentColor,
                  backgroundColor: accentColor + 'BF',
                }]}
              >
                <TouchableOpacity
                  style={styles.chatFabInner}
                  activeOpacity={0.85}
                  onPress={() => { onNewChat(); onClose(); }}
                >
                  <Ionicons name="create-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.chatFabText}>New Chat</Text>
                </TouchableOpacity>
              </BlurView>
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.chatFab,
                { backgroundColor: accentColor, bottom: insets.bottom + 20 },
              ]}
              activeOpacity={0.85}
              onPress={() => { onNewChat(); onClose(); }}
            >
              <Ionicons name="create-outline" size={20} color="#FFFFFF" />
              <Text style={styles.chatFabText}>New Chat</Text>
            </TouchableOpacity>
          )}
        </ReAnimated.View>
      </GestureDetector>

      {/* iOS-style Chat Preview Modal (long press) */}
      <ChatPreviewModal
        visible={chatPreviewVisible}
        conv={actionMenuConv}
        previewMessages={chatPreviewMessages}
        onClose={() => setChatPreviewVisible(false)}
        onAction={handleConvPreviewAction}
        isDark={isDark}
      />

      {/* Rename Modal */}
      <RenameModal
        visible={renameVisible}
        currentTitle={actionMenuConv?.title || ''}
        onConfirm={handleRenameConfirm}
        onCancel={() => setRenameVisible(false)}
      />
    </>
  );
}

// Re-export useAnimatedStyle alias for internal use
const { useAnimatedStyle } = require('react-native-reanimated');

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 998,
    overflow: 'hidden',
  },
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    zIndex: 999,
    elevation: 20,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  appTitle: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3, flex: 1 },
  headerIconGroup: { flexShrink: 0 },
  headerIconGroupBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconPillBtn: {
    width: 40,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPillDivider: { width: StyleSheet.hairlineWidth, height: 18 },
  profilePhotoSmall: { width: 26, height: 26, borderRadius: 13 },
  avatarMini: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  avatarMiniText: { color: '#FFFFFF', fontWeight: '700', fontSize: 11 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 0 },
  quickActionsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    marginBottom: 4,
    justifyContent: 'space-between',
  },
  quickActionBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 6,
  },
  quickActionCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: { fontSize: 11, fontWeight: '500', textAlign: 'center' },
  divider: { height: 0.5, marginHorizontal: 16, marginVertical: 16 },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 20,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  conversationList: { flex: 1, paddingHorizontal: 8 },
  convItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 13,
    marginBottom: 2,
  },
  convTitle: { fontSize: 16, fontWeight: '400', flex: 1 },
  emptyText: { textAlign: 'center', marginTop: 32, fontSize: 15 },
  chatFabWrap: {
    position: 'absolute',
    right: 20,
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 10,
  },
  chatFabBlur: { borderRadius: 30, overflow: 'hidden' },
  chatFabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 14,
    gap: 8,
  },
  chatFab: {
    position: 'absolute',
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 30,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  chatFabText: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
  profilePhoto: { width: 30, height: 30, borderRadius: 15 },
  bulkActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  bulkActionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 8,
  },
  bulkActionText: { fontSize: 13, fontWeight: '500' },
  bulkActionDivider: { width: 1, height: 20 },
});
