import React, { useState, useEffect, useCallback, useRef } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
}

const QUICK_ACTIONS = [
  { id: 'projects', icon: 'folder-outline', label: 'Projects', color: '#8B5CF6', route: '/projects' },
  { id: 'images', icon: 'images-outline', label: 'Images', color: '#EC4899', route: '/images' },
  { id: 'apps', icon: 'grid-outline', label: 'Apps', color: '#6366F1', route: '/apps' },
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
}: SideMenuProps) {
  const { colors, isDark } = useTheme();
  const { settings } = useSettings();
  const { user } = useAuth();
  const router = useRouter();
  const { conversations, currentConversation, selectConversation } = useConversation();
  const insets = useSafeAreaInsets();

  const handleQuickAction = (action) => {
  if (action.route) {
    router.push(action.route);
  }
};

  const [searchQuery, setSearchQuery] = useState('');
  const [searchActive, setSearchActive] = useState(false);

  const accentColor = settings.accentColor || '#10A37F';

  // Full-screen slide from left
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

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
    pointerEvents: overlayOpacity.value > 0 ? 'auto' : 'none',
  }));

  // Swipe-to-close gesture
  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onUpdate((e) => {
      if (e.translationX < 0) {
        translateX.value = Math.max(-SCREEN_WIDTH, e.translationX);
        overlayOpacity.value = interpolate(
          e.translationX,
          [-SCREEN_WIDTH, 0],
          [0, 1],
          Extrapolate.CLAMP
        );
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

  const filteredConversations = searchQuery.trim()
    ? conversations.filter((c) =>
        (c.title || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conversations;

  const getUserInitials = () => {
    if (user?.email) {
      const parts = user.email.split('@')[0].split('.');
      return parts.length > 1
        ? (parts[0][0] + parts[1][0]).toUpperCase()
        : parts[0].substring(0, 2).toUpperCase();
    }
    return 'DH';
  };

  const getUserName = () => user?.email?.split('@')[0] || 'Haitian User';

  return (
    <>
      {/* Dimmed overlay */}
      <Animated.View
        style={[styles.overlay, overlayStyle]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      {/* Full-width drawer */}
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            styles.drawer,
            {
              backgroundColor: isDark ? '#9CA3AF' : '#FFFFFF',
              paddingTop: insets.top + (Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0),
            },
            containerStyle,
          ]}
        >
          {/* ── TOP HEADER ── */}
          <View style={styles.topHeader}>
            <Text style={[styles.appTitle, { color: colors.text }]}>
              {currentProject?.name || 'Haitian ChatGPT'}
            </Text>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => setSearchActive(!searchActive)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="search" size={22} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.avatarBtn, { backgroundColor: accentColor }]}
                onPress={() => { onClose(); onSettings(); }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.avatarText}>{getUserInitials()}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── SEARCH BAR ── */}
          {searchActive && (
            <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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
          )}

          {/* ── QUICK ACTIONS GRID ── */}
          {!searchActive && (
            <View style={styles.quickActionsGrid}>
              {QUICK_ACTIONS.map((qa) => (
                <TouchableOpacity
                  key={qa.id}
                  style={[
                    styles.quickActionBtn,
                    { backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' },
                    (qa as any).isUpgrade && { borderColor: qa.color, borderWidth: 1 },
                  ]}
                  activeOpacity={0.7}
                  onPress={() => {
                    if (qa.id === 'upgrade') { onClose(); onSettings(); }
                  }}
                >
                  <Ionicons
                    name={qa.icon as any}
                    size={26}
                    color={(qa as any).isUpgrade ? qa.color : colors.text}
                  />
                  <Text
                    style={[
                      styles.quickActionLabel,
                      { color: (qa as any).isUpgrade ? qa.color : colors.text },
                    ]}
                  >
                    {qa.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ── DIVIDER ── */}
          {!searchActive && <View style={[styles.divider, { backgroundColor: colors.border }]} />}

          {/* ── RECENTS LABEL ── */}
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
            {searchActive && searchQuery ? 'Results' : 'Recents'}
          </Text>

          {/* ── CONVERSATIONS LIST ── */}
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
                return (
                  <TouchableOpacity
                    key={conv.id}
                    style={[
                      styles.convItem,
                      isActive && {
                        backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
                        borderRadius: 12,
                      },
                    ]}
                    activeOpacity={0.7}
                    onPress={() => {
                    selectConversation(conv.id);
                      onClose();
                    }}
                  >
                    <Text
                      style={[
                        styles.convTitle,
                        { color: colors.text },
                        isActive && { fontWeight: '600' },
                      ]}
                      numberOfLines={1}
                    >
                      {conv.title || 'New conversation'}
                    </Text>
                  </TouchableOpacity>
                );
              })
            )}
            <View style={{ height: insets.bottom + 100 }} />
          </ScrollView>

          {/* ── FLOATING CHAT BUTTON ── */}
          <TouchableOpacity
            style={[styles.chatFab, { backgroundColor: accentColor }]}
            activeOpacity={0.85}
            onPress={() => {
              onNewChat();
              onClose();
            }}
          >
            <Ionicons name="create-outline" size={20} color="#FFFFFF" />
            <Text style={styles.chatFabText}>Chat</Text>
          </TouchableOpacity>
        </Animated.View>
      </GestureDetector>
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
  appTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
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
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 4,
    gap: 10,
  },
  quickActionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  divider: {
    height: 0.5,
    marginHorizontal: 16,
    marginVertical: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 20,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  conversationList: {
    flex: 1,
    paddingHorizontal: 8,
  },
  convItem: {
    paddingHorizontal: 12,
    paddingVertical: 13,
    marginBottom: 2,
  },
  convTitle: {
    fontSize: 16,
    fontWeight: '400',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 32,
    fontSize: 15,
  },
  chatFab: {
    position: 'absolute',
    bottom: 36,
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
  chatFabText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
});
