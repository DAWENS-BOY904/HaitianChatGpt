import React, { useEffect, useRef, memo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Animated,
  Platform,
  Dimensions,
  Share,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../hooks/useTheme';
import { useSettings } from '../hooks/useSettings';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
  image_url?: string;
}

interface AIMessageActionsProps {
  visible: boolean;
  onClose: () => void;
  message: Message;
  isUserMessage?: boolean;
  onAskAI?: (text: string) => void;
  onEdit?: (msgId: string, content: string) => void;
  onShare?: (text: string) => void;
}

// ── Action item definition ────────────────────────────────────────────────────
interface ActionItem {
  id: string;
  label: string;
  icon: string;
  color?: string;
  onPress: () => void;
  dividerAfter?: boolean;
}

export const AIMessageActions = memo(function AIMessageActions({
  visible,
  onClose,
  message,
  isUserMessage = false,
  onAskAI,
  onEdit,
  onShare,
}: AIMessageActionsProps) {
  const { isDark } = useTheme();
  const { settings } = useSettings();
  const accentColor = (settings as any)?.accentColor || '#10A37F';

  const slideAnim = useRef(new Animated.Value(80)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.88)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 210,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 260,
          friction: 22,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 260,
          friction: 22,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 80,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const cleanContent = useCallback(() => {
    return (message.content || '')
      .replace(/[#*`>]/g, '')
      .replace(/\[SOURCES\][\s\S]*?\[\/SOURCES\]/gi, '')
      .replace(/\[TIKTOK_CARD\][\s\S]*?\[\/TIKTOK_CARD\]/gi, '')
      .replace(/\[IMAGE_SEARCH_RESULTS:[\s\S]*?\]/gi, '')
      .trim();
  }, [message.content]);

  const handleCopy = useCallback(async () => {
    onClose();
    await Clipboard.setStringAsync(cleanContent());
  }, [cleanContent, onClose]);

  const handleCopyAll = useCallback(async () => {
    onClose();
    await Clipboard.setStringAsync(cleanContent());
  }, [cleanContent, onClose]);

  const handleAskAI = useCallback(() => {
    onClose();
    const text = cleanContent();
    const prompt = isUserMessage
      ? text
      : `Regarding: "${text.slice(0, 150)}${text.length > 150 ? '...' : ''}" — can you explain this further?`;
    onAskAI?.(prompt);
  }, [cleanContent, isUserMessage, onAskAI, onClose]);

  const handleEdit = useCallback(() => {
    onClose();
    onEdit?.(message.id, message.content);
  }, [message.id, message.content, onEdit, onClose]);

  const handleShare = useCallback(async () => {
    onClose();
    const text = cleanContent();
    try {
      if (onShare) {
        onShare(text);
      } else {
        await Share.share({ message: text });
      }
    } catch (_e) {}
  }, [cleanContent, onClose, onShare]);

  const handleSelectAll = useCallback(() => {
    // Close the modal and open the text selection overlay via copy
    handleCopyAll();
  }, [handleCopyAll]);

  if (!visible) return null;

  // ── Build action items ───────────────────────────────────────────────────
  const actions: ActionItem[] = [
    {
      id: 'ask-ai',
      label: 'Ask Dawinix',
      icon: 'sparkles',
      color: accentColor,
      onPress: handleAskAI,
      dividerAfter: true,
    },
    {
      id: 'copy',
      label: 'Copy',
      icon: 'copy-outline',
      onPress: handleCopy,
    },
    {
      id: 'select-all',
      label: 'Select All',
      icon: 'text-outline',
      onPress: handleSelectAll,
      dividerAfter: true,
    },
    {
      id: 'share',
      label: 'Share',
      icon: 'share-outline',
      onPress: handleShare,
    },
    ...(isUserMessage && onEdit
      ? [
          {
            id: 'edit',
            label: 'Edit',
            icon: 'pencil-outline' as string,
            onPress: handleEdit,
          },
        ]
      : []),
  ];

  const textColor = isDark ? '#FFFFFF' : '#000000';
  const subColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';
  const dividerColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)';
  const pillBg = isDark ? 'rgba(30,30,34,0.97)' : 'rgba(248,248,252,0.97)';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* ── Backdrop ── */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: 'rgba(0,0,0,0.28)', opacity: fadeAnim },
        ]}
      >
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={onClose}
        />
      </Animated.View>

      {/* ── Floating pill bar (bottom) ── */}
      <Animated.View
        style={[
          styles.pillContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
          },
        ]}
        pointerEvents="box-none"
      >
        <View style={styles.pillOuter}>
          {Platform.OS === 'ios' ? (
            <BlurView
              intensity={isDark ? 85 : 72}
              tint={isDark ? 'dark' : 'extraLight'}
              style={[styles.pill, { overflow: 'hidden' }]}
            >
              <ActionRow
                actions={actions}
                textColor={textColor}
                subColor={subColor}
                dividerColor={dividerColor}
                accentColor={accentColor}
              />
            </BlurView>
          ) : (
            <View style={[styles.pill, { backgroundColor: pillBg }]}>
              <ActionRow
                actions={actions}
                textColor={textColor}
                subColor={subColor}
                dividerColor={dividerColor}
                accentColor={accentColor}
              />
            </View>
          )}
        </View>
      </Animated.View>
    </Modal>
  );
});

// ── ActionRow sub-component ───────────────────────────────────────────────────
const ActionRow = memo(function ActionRow({
  actions,
  textColor,
  subColor,
  dividerColor,
  accentColor,
}: {
  actions: ActionItem[];
  textColor: string;
  subColor: string;
  dividerColor: string;
  accentColor: string;
}) {
  return (
    <View style={styles.rowInner}>
      {actions.map((action, index) => (
        <React.Fragment key={action.id}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={action.onPress}
            activeOpacity={0.55}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            <Text
              style={[
                styles.actionLabel,
                { color: action.color || textColor },
              ]}
              numberOfLines={1}
            >
              {action.label}
            </Text>
          </TouchableOpacity>
          {/* Divider */}
          {action.dividerAfter && index < actions.length - 1 ? (
            <View
              style={[styles.divider, { backgroundColor: dividerColor }]}
            />
          ) : index < actions.length - 1 ? (
            <View
              style={[styles.thinDivider, { backgroundColor: dividerColor }]}
            />
          ) : null}
        </React.Fragment>
      ))}

      {/* Forward/More chevron button */}
      <View style={[styles.thinDivider, { backgroundColor: dividerColor }]} />
      <View style={styles.chevronWrap}>
        <Ionicons name="chevron-forward" size={15} color={textColor} />
      </View>
    </View>
  );
});

// ── Styles ────────────────────────────────────────────────────────────────────
const { width: SCREEN_W } = Dimensions.get('window');

const styles = StyleSheet.create({
  pillContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: Platform.select({ ios: 48, android: 32, default: 24 }),
    paddingHorizontal: 16,
    pointerEvents: 'box-none',
  } as any,
  pillOuter: {
    // shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 14,
    borderRadius: 50,
  },
  pill: {
    flexDirection: 'row',
    borderRadius: 50,
    height: 52,
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(128,128,128,0.18)',
    maxWidth: SCREEN_W - 32,
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    flex: 1,
  },
  actionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 44,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  divider: {
    width: 1,
    height: 28,
    borderRadius: 0.5,
    marginHorizontal: 1,
  },
  thinDivider: {
    width: StyleSheet.hairlineWidth,
    height: 24,
    borderRadius: 0.5,
    marginHorizontal: 2,
  },
  chevronWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(128,128,128,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
    marginRight: 4,
  },
});
