import React, { useState, useEffect, useCallback, useRef } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import Animated, {
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

// ── Conversation Action Mini-Menu ──
function ConvActionMenu({ visible, conv, onClose, onAction }: ConvActionMenuProps) {
  const { isDark } = useTheme();
  const fadeAnim = useSharedValue(0);
  const scaleAnim = useSharedValue(0.85);

  useEffect(() => {
    if (visible) {
      fadeAnim.value = withTiming(1, { duration: 160 });
      scaleAnim.value = withSpring(1, { damping: 20, stiffness: 300 });
    } else {
      fadeAnim.value = withTiming(0, { duration: 100 });
      scaleAnim.value = withTiming(0.85, { duration: 100 });
    }
  }, [visible]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
    transform: [{ scale: scaleAnim.value }],
  }));

  if (!visible || !conv) return null;

  const items = [
    { key: 'share', label: 'Share chat', icon: 'share-outline' },
    { key: 'pin', label: conv.isPinned ? 'Unpin' : 'Pin', icon: conv.isPinned ? 'pin' : 'pin-outline' },
    { key: 'rename', label: 'Rename', icon: 'pencil-outline' },
    { key: 'archive', label: 'Archive', icon: 'archive-outline' },
    { key: 'delete', label: 'Delete', icon: 'trash-outline', destructive: true },
  ] as const;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={cmStyles.backdrop} activeOpacity={1} onPress={onClose}>
        <Animated.View style={[cmStyles.menuWrap, animStyle]}>
          <BlurView intensity={85} tint="dark" style={cmStyles.blurBox}>
            <View style={cmStyles.titleRow}>
              <Text style={cmStyles.titleText} numberOfLines={1}>{conv.title || 'New chat'}</Text>
            </View>
            {items.map((item, i) => (
              <TouchableOpacity
                key={item.key}
                style={[cmStyles.menuItem, i > 0 && cmStyles.menuItemBorder]}
                activeOpacity={0.6}
                onPress={() => { onClose(); setTimeout(() => onAction(item.key as any), 60); }}
              >
                <Ionicons
                  name={item.icon as any}
                  size={20}
                  color={item.destructive ? '#FF453A' : 'rgba(255,255,255,0.9)'}
                />
                <Text style={[cmStyles.menuLabel, item.destructive && cmStyles.destructiveLabel]}>
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

const cmStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuWrap: {
    width: 260,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 24,
  },
  blurBox: { borderRadius: 18, overflow: 'hidden' },
  titleRow: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  titleText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 15,
    gap: 14,
  },
  menuItemBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  menuLabel: { fontSize: 17, color: 'rgba(255,255,255,0.92)', fontWeight: '400' },
  destructiveLabel: { color: '#FF453A' },
});

// ── Rename Modal ──
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

// Quick actions — upgrade excluded, handled dynamically below
const BASE_QUICK_ACTIONS = [
  { id: 'projects', icon: 'folder-outline', label: 'Projects', color: '#8B5CF6', route: '/new-project' },
  { id: 'images', icon: 'images-outline', label: 'Images', color: '#EC4899', route: '/images' },
  { id: 'apps', icon: 'grid-outline', label: 'Apps', color: '#6366F1', route: '/gpts' },
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
    updateConversationTitle,
  } = useConversation();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  // Determine if user has a paid plan (pro) — hide Upgrade button
  const isPro = isAdmin || isUnlimited;

  // Filter quick actions: remove Upgrade for pro users
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

  const [actionMenuConv, setActionMenuConv] = useState<{ id: string; title: string; isPinned?: boolean } | null>(null);
  const [actionMenuVisible, setActionMenuVisible] = useState(false);
  const [renameVisible, setRenameVisible] = useState(false);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());

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

  const containerStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));
  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
    pointerEvents: overlayOpacity.value > 0 ? 'auto' : 'none',
  }));

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

  const { searchConversations } = useConversation();
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

  const handleConvLongPress = (conv: { id: string; title: string }) => {
    setActionMenuConv({ ...conv, isPinned: pinnedIds.has(conv.id) });
    setActionMenuVisible(true);
  };

  const handleConvTap = (conv: { id: string; title: string }) => {
    selectConversation(conv.id);
    onClose();
  };

  const handleConvAction = async (action: 'share' | 'pin' | 'rename' | 'archive' | 'delete') => {
    if (!actionMenuConv) return;
    const conv = actionMenuConv;

    if (action === 'share') {
      try { await Share.share({ message: `Check out this conversation: ${conv.title}` }); } catch (e) {}
      return;
    }
    if (action === 'pin') {
      const newPinned = !pinnedIds.has(conv.id);
      await supabase.from('conversations').update({ is_pinned: newPinned }).eq('id', conv.id);
      setPinnedIds(prev => {
        const next = new Set(prev);
        newPinned ? next.add(conv.id) : next.delete(conv.id);
        return next;
      });
      return;
    }
    if (action === 'rename') { setRenameVisible(true); return; }
    if (action === 'archive') { await archiveConversation(conv.id); return; }
    if (action === 'delete') {
      Alert.alert('Delete Chat', 'This will permanently delete this chat.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => { await deleteConversation(conv.id); } },
      ]);
    }
  };

  const handleRenameConfirm = async (title: string) => {
    setRenameVisible(false);
    if (!actionMenuConv || !title) return;
    await updateConversationTitle(actionMenuConv.id, title);
    setActionMenuConv(prev => prev ? { ...prev, title } : null);
  };

  // ── Accent blur color for FAB ──
  const accentWithAlpha = accentColor + 'E6'; // ~90% opacity

  // ── GUEST MODE ──
  if (isGuest) {
    return (
      <>
        <Animated.View
          style={[styles.overlay, overlayStyle]}
          pointerEvents={visible ? 'auto' : 'none'}
        >
          <Pressable style={{ flex: 1 }} onPress={onClose} />
        </Animated.View>

        <GestureDetector gesture={panGesture}>
          <Animated.View
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
          </Animated.View>
        </GestureDetector>
      </>
    );
  }

  return (
    <>
      <Animated.View
        style={[styles.overlay, overlayStyle]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      <GestureDetector gesture={panGesture}>
        <Animated.View
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
              {currentProject?.name || 'Haitian AI Chat'}
            </Text>

            {/* Search + Profile icons — shared glassmorphism background */}
            <View style={styles.headerIconGroup}>
              {Platform.OS === 'ios' ? (
                <BlurView
                  intensity={isDark ? 60 : 50}
                  tint={isDark ? 'dark' : 'light'}
                  style={[styles.headerIconGroupBlur, {
                    borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.1)',
                  }]}
                >
                  {/* Search icon */}
                  <TouchableOpacity
                    style={styles.iconPillBtn}
                    onPress={() => setSearchActive(!searchActive)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="search" size={19} color={colors.text} />
                  </TouchableOpacity>

                  {/* Divider */}
                  <View style={[styles.iconPillDivider, {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                  }]} />

                  {/* Profile / avatar → Settings */}
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
                  style={[
                    styles.quickActionBtn,
                    qa.isUpgrade && { borderColor: qa.color, borderWidth: 1 },
                    QUICK_ACTIONS.length < 4 && { marginRight: 10 },
                    { overflow: 'hidden' },
                  ]}
                  activeOpacity={0.7}
                  onPress={() => handleQuickAction(qa)}
                >
                  {Platform.OS === 'ios' ? (
                    <BlurView
                      intensity={isDark ? 55 : 45}
                      tint={isDark ? 'dark' : 'light'}
                      style={styles.quickActionBlur}
                    >
                      <Ionicons
                        name={qa.icon as any}
                        size={26}
                        color={qa.isUpgrade ? qa.color : colors.text}
                      />
                      <Text style={[styles.quickActionLabel, { color: qa.isUpgrade ? qa.color : colors.text }]}>
                        {qa.label}
                      </Text>
                    </BlurView>
                  ) : (
                    <View style={[styles.quickActionBlur, {
                      backgroundColor: qa.isUpgrade
                        ? (isDark ? qa.color + '22' : qa.color + '15')
                        : (isDark ? '#1C1C1E' : '#F2F2F7'),
                    }]}>
                      <Ionicons
                        name={qa.icon as any}
                        size={26}
                        color={qa.isUpgrade ? qa.color : colors.text}
                      />
                      <Text style={[styles.quickActionLabel, { color: qa.isUpgrade ? qa.color : colors.text }]}>
                        {qa.label}
                      </Text>
                    </View>
                  )}
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
                    delayLongPress={400}
                  >
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {isPinned && <Ionicons name="pin" size={12} color={accentColor} />}
                      {renderConvTitle(conv.title || 'New conversation')}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
            <View style={{ height: insets.bottom + 100 }} />
          </ScrollView>

          {/* FLOATING NEW CHAT BUTTON — accent color + blur */}
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
        </Animated.View>
      </GestureDetector>

      {/* Conv Action Menu */}
      <ConvActionMenu
        visible={actionMenuVisible}
        conv={actionMenuConv}
        onClose={() => setActionMenuVisible(false)}
        onAction={handleConvAction}
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

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 998,
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

  // Header icon group (shared blurred pill for search + profile)
  headerIconGroup: {
    flexShrink: 0,
  },
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
  iconPillDivider: {
    width: StyleSheet.hairlineWidth,
    height: 18,
  },
  profilePhotoSmall: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  avatarMini: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarMiniText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 11,
  },

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
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  quickActionBtn: {
    flex: 1,
    borderRadius: 16,
    marginHorizontal: 5,
    overflow: 'hidden',
  },
  quickActionBlur: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
    borderRadius: 16,
  },
  quickActionLabel: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
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

  // New Chat FAB
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
  chatFabBlur: {
    borderRadius: 30,
    overflow: 'hidden',
  },
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
});
