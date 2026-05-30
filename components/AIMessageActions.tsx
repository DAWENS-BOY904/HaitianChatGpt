/**
 * AIMessageActions — modern iPhone-style floating action bar for long-pressed messages.
 * Shows: Ask AI | Copy | Select All | Share | Edit (user messages only)
 */
import React, { useEffect, useRef, memo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Animated,
  Platform,
  Share,
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
  createdAt?: string;
}

interface AIMessageActionsProps {
  visible: boolean;
  onClose: () => void;
  message: Message;
  isUserMessage?: boolean;
  onAskAI?: (text: string) => void;
  onEdit?: (msgId: string, content: string) => void;
}

export const AIMessageActions = memo(function AIMessageActions({
  visible,
  onClose,
  message,
  isUserMessage = false,
  onAskAI,
  onEdit,
}: AIMessageActionsProps) {
  const { isDark, colors } = useTheme();
  const { settings } = useSettings();
  const accentColor = (settings as any)?.accentColor || '#10A37F';

  const slideAnim = useRef(new Animated.Value(120)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 220, friction: 22, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 160, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 120, duration: 160, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const safeContent: string = (() => {
    try {
      if (!message) return '';
      if (typeof message.content === 'string') return message.content;
      return String(message.content ?? '');
    } catch { return ''; }
  })();

  const cleanContent = safeContent
    .replace(/[#*`>]/g, '')
    .replace(/\[SOURCES\][\s\S]*?\[\/SOURCES\]/gi, '')
    .replace(/\[TIKTOK_CARD\][\s\S]*?\[\/TIKTOK_CARD\]/gi, '')
    .replace(/\[MESSAGE_CARD\][\s\S]*?\[\/MESSAGE_CARD\]/gi, '')
    .trim();

  const handleCopy = useCallback(async () => {
    onClose();
    await Clipboard.setStringAsync(cleanContent);
  }, [cleanContent, onClose]);

  const handleSelectAll = useCallback(async () => {
    onClose();
    await Clipboard.setStringAsync(cleanContent);
  }, [cleanContent, onClose]);

  const handleShare = useCallback(async () => {
    onClose();
    try {
      await Share.share({ message: cleanContent });
    } catch (_e) {}
  }, [cleanContent, onClose]);

  const handleAskAI = useCallback(() => {
    onClose();
    onAskAI?.(cleanContent);
  }, [cleanContent, onClose, onAskAI]);

  const handleEdit = useCallback(() => {
    onClose();
    onEdit?.(message.id, cleanContent);
  }, [message.id, cleanContent, onClose, onEdit]);

  if (!visible) return null;

  const actions = [
    ...(!isUserMessage ? [{ label: 'Ask AI', icon: 'sparkles-outline', onPress: handleAskAI }] : []),
    { label: 'Copy', icon: 'copy-outline', onPress: handleCopy },
    { label: 'Select All', icon: 'text-outline', onPress: handleSelectAll },
    { label: 'Share', icon: 'share-outline', onPress: handleShare },
    ...(isUserMessage && onEdit ? [{ label: 'Edit', icon: 'pencil-outline', onPress: handleEdit }] : []),
  ];

  const pillBg = isDark ? 'rgba(28,28,32,0.97)' : 'rgba(255,255,255,0.97)';
  const dividerColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  const textColor = isDark ? '#FFFFFF' : '#000000';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {/* Backdrop */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.28)' }} activeOpacity={1} onPress={onClose} />
      </Animated.View>

      {/* Floating pill bar */}
      <Animated.View
        style={[
          styles.pillContainer,
          { transform: [{ translateY: slideAnim }], opacity: fadeAnim },
        ]}
      >
        {Platform.OS === 'ios' ? (
          <BlurView intensity={isDark ? 90 : 80} tint={isDark ? 'dark' : 'extraLight'} style={[styles.pill, styles.pillOverflow]}>
            <PillContent
              actions={actions}
              textColor={textColor}
              dividerColor={dividerColor}
              accentColor={accentColor}
              isDark={isDark}
            />
          </BlurView>
        ) : (
          <View style={[styles.pill, { backgroundColor: pillBg }]}>
            <PillContent
              actions={actions}
              textColor={textColor}
              dividerColor={dividerColor}
              accentColor={accentColor}
              isDark={isDark}
            />
          </View>
        )}
      </Animated.View>
    </Modal>
  );
});

interface PillAction {
  label: string;
  icon: string;
  onPress: () => void;
}

function PillContent({ actions, textColor, dividerColor, accentColor, isDark }: {
  actions: PillAction[];
  textColor: string;
  dividerColor: string;
  accentColor: string;
  isDark: boolean;
}) {
  return (
    <View style={styles.pillInner}>
      {actions.map((action, index) => (
        <React.Fragment key={action.label}>
          {index > 0 && (
            <View style={[styles.divider, { backgroundColor: dividerColor }]} />
          )}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={action.onPress}
            activeOpacity={0.6}
          >
            <Ionicons
              name={action.icon as any}
              size={18}
              color={action.label === 'Ask AI' ? accentColor : textColor}
            />
            <Text
              style={[
                styles.actionLabel,
                {
                  color: action.label === 'Ask AI' ? accentColor : textColor,
                  fontWeight: action.label === 'Ask AI' ? '700' : '500',
                },
              ]}
            >
              {action.label}
            </Text>
          </TouchableOpacity>
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pillContainer: {
    position: 'absolute',
    bottom: 90,
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 9999,
  },
  pill: {
    borderRadius: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 18,
    maxWidth: 480,
    width: '100%',
  },
  pillOverflow: {
    overflow: 'hidden',
  },
  pillInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 24,
    marginHorizontal: 2,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    gap: 4,
    minWidth: 56,
  },
  actionLabel: {
    fontSize: 11,
    textAlign: 'center',
  },
});
