import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Animated,
  Platform,
  Share,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../hooks/useTheme';
import { useSettings } from '../hooks/useSettings';

interface AIMessageActionsProps {
  visible: boolean;
  onClose: () => void;
  message: {
    id: string;
    content: string;
    role: 'user' | 'assistant';
    created_at?: string;
  };
  onAskAI?: (text: string) => void;
  onEdit?: (messageId: string, content: string) => void;
  isUserMessage?: boolean;
}

const { width: SCREEN_W } = Dimensions.get('window');

export const AIMessageActions = memo(function AIMessageActions({
  visible,
  onClose,
  message,
  onAskAI,
  onEdit,
  isUserMessage = false,
}: AIMessageActionsProps) {
  const { isDark } = useTheme();
  const { settings } = useSettings();
  const accentColor = settings.accentColor || '#10A37F';

  const slideAnim = useRef(new Animated.Value(80)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  const [showMore, setShowMore] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (visible) {
      setShowMore(false);
      setCopied(false);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 280, friction: 24, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 280, friction: 24, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 140, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 80, duration: 140, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 0.85, duration: 140, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const handleCopy = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Clipboard.setStringAsync(message.content || '');
    setCopied(true);
    setTimeout(() => { setCopied(false); onClose(); }, 700);
  }, [message.content, onClose]);

  const handleSelectAll = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const clean = (message.content || '').replace(/[#*`>]/g, '').trim();
    await Clipboard.setStringAsync(clean);
    setCopied(true);
    setTimeout(() => { setCopied(false); onClose(); }, 700);
  }, [message.content, onClose]);

  const handleShare = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({ message: message.content || '', title: 'Dawinix AI' });
    } catch (_e) {}
    onClose();
  }, [message.content, onClose]);

  const handleAskAI = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
    if (onAskAI) setTimeout(() => onAskAI(message.content || ''), 200);
  }, [message.content, onAskAI, onClose]);

  const handleEdit = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
    if (onEdit) setTimeout(() => onEdit(message.id, message.content || ''), 200);
  }, [message.id, message.content, onEdit, onClose]);

  if (!visible) return null;

  const pillBg = isDark ? 'rgba(30,30,35,0.98)' : 'rgba(255,255,255,0.98)';
  const textC = isDark ? '#FFF' : '#000';
  const subC = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)';
  const divC = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {/* Backdrop — transparent so chat is visible */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim, backgroundColor: 'rgba(0,0,0,0.22)' }]}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
      </Animated.View>

      {/* Floating pill toolbar — centered bottom */}
      <Animated.View
        style={{
          position: 'absolute',
          bottom: Platform.OS === 'ios' ? 100 : 80,
          left: 16,
          right: 16,
          transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
          opacity: fadeAnim,
          zIndex: 100,
        }}
      >
        <View style={{
          borderRadius: 50,
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: isDark ? 0.55 : 0.18,
          shadowRadius: 20,
          elevation: 20,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: divC,
        }}>
          {Platform.OS === 'ios' ? (
            <BlurView
              intensity={isDark ? 90 : 80}
              tint={isDark ? 'chromeMaterialDark' : 'chromeMaterial'}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 2, paddingHorizontal: 4 }}
            >
              <PillContent
                isDark={isDark}
                textC={textC}
                subC={subC}
                divC={divC}
                copied={copied}
                showMore={showMore}
                accentColor={accentColor}
                isUserMessage={isUserMessage}
                onAskAI={handleAskAI}
                onCopy={handleCopy}
                onSelectAll={handleSelectAll}
                onShare={handleShare}
                onEdit={handleEdit}
                onMore={() => setShowMore(v => !v)}
                onClose={onClose}
              />
            </BlurView>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 2, paddingHorizontal: 4, backgroundColor: pillBg }}>
              <PillContent
                isDark={isDark}
                textC={textC}
                subC={subC}
                divC={divC}
                copied={copied}
                showMore={showMore}
                accentColor={accentColor}
                isUserMessage={isUserMessage}
                onAskAI={handleAskAI}
                onCopy={handleCopy}
                onSelectAll={handleSelectAll}
                onShare={handleShare}
                onEdit={handleEdit}
                onMore={() => setShowMore(v => !v)}
                onClose={onClose}
              />
            </View>
          )}
        </View>

        {/* Expanded more actions */}
        {showMore ? (
          <Animated.View style={{
            marginTop: 10,
            borderRadius: 22,
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.18,
            shadowRadius: 12,
            elevation: 12,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: divC,
          }}>
            {Platform.OS === 'ios' ? (
              <BlurView intensity={isDark ? 90 : 80} tint={isDark ? 'chromeMaterialDark' : 'chromeMaterial'}>
                <MoreActions
                  isDark={isDark}
                  textC={textC}
                  divC={divC}
                  accentColor={accentColor}
                  isUserMessage={isUserMessage}
                  onShare={handleShare}
                  onEdit={handleEdit}
                  onClose={onClose}
                />
              </BlurView>
            ) : (
              <View style={{ backgroundColor: pillBg }}>
                <MoreActions
                  isDark={isDark}
                  textC={textC}
                  divC={divC}
                  accentColor={accentColor}
                  isUserMessage={isUserMessage}
                  onShare={handleShare}
                  onEdit={handleEdit}
                  onClose={onClose}
                />
              </View>
            )}
          </Animated.View>
        ) : null}
      </Animated.View>
    </Modal>
  );
});

interface PillContentProps {
  isDark: boolean;
  textC: string;
  subC: string;
  divC: string;
  copied: boolean;
  showMore: boolean;
  accentColor: string;
  isUserMessage: boolean;
  onAskAI: () => void;
  onCopy: () => void;
  onSelectAll: () => void;
  onShare: () => void;
  onEdit: () => void;
  onMore: () => void;
  onClose: () => void;
}

const PillContent = memo(function PillContent({
  isDark, textC, divC, copied, showMore, accentColor, isUserMessage,
  onAskAI, onCopy, onSelectAll, onShare, onMore,
}: PillContentProps) {
  const items = [
    {
      key: 'ask',
      label: isUserMessage ? 'Ask Again' : 'Ask Dawinix',
      icon: 'sparkles-outline' as const,
      color: accentColor,
      onPress: onAskAI,
    },
    {
      key: 'copy',
      label: copied ? 'Copied!' : 'Copy',
      icon: copied ? 'checkmark' as const : 'copy-outline' as const,
      color: copied ? '#34C759' : textC,
      onPress: onCopy,
    },
    {
      key: 'all',
      label: 'Select All',
      icon: 'documents-outline' as const,
      color: textC,
      onPress: onSelectAll,
    },
    {
      key: 'share',
      label: 'Share',
      icon: 'share-outline' as const,
      color: textC,
      onPress: onShare,
    },
  ];

  return (
    <>
      {items.map((item, i) => (
        <React.Fragment key={item.key}>
          {i > 0 ? (
            <View style={{ width: StyleSheet.hairlineWidth, height: 28, backgroundColor: divC, marginHorizontal: 2 }} />
          ) : null}
          <TouchableOpacity
            onPress={item.onPress}
            activeOpacity={0.6}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 13,
              paddingHorizontal: 12,
              gap: 5,
            }}
          >
            <Ionicons name={item.icon} size={16} color={item.color} />
            <Text style={{ fontSize: 14, fontWeight: '500', color: item.color }}>
              {item.label}
            </Text>
          </TouchableOpacity>
        </React.Fragment>
      ))}
      {/* More / chevron button */}
      <View style={{ width: StyleSheet.hairlineWidth, height: 28, backgroundColor: divC, marginHorizontal: 2 }} />
      <TouchableOpacity
        onPress={onMore}
        activeOpacity={0.6}
        style={{
          width: 42,
          height: 42,
          borderRadius: 21,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: showMore
            ? (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)')
            : 'transparent',
          marginHorizontal: 4,
        }}
      >
        <Ionicons
          name={showMore ? 'chevron-down' : 'chevron-forward'}
          size={18}
          color={isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)'}
        />
      </TouchableOpacity>
    </>
  );
});

interface MoreActionsProps {
  isDark: boolean;
  textC: string;
  divC: string;
  accentColor: string;
  isUserMessage: boolean;
  onShare: () => void;
  onEdit: () => void;
  onClose: () => void;
}

const MoreActions = memo(function MoreActions({
  isDark, textC, divC, accentColor, isUserMessage, onShare, onEdit, onClose,
}: MoreActionsProps) {
  const items = [
    {
      key: 'forward',
      label: 'Forward',
      icon: 'arrow-forward-outline' as const,
      color: textC,
      onPress: onShare,
    },
    ...(isUserMessage ? [{
      key: 'edit',
      label: 'Edit Message',
      icon: 'pencil-outline' as const,
      color: '#007AFF',
      onPress: onEdit,
    }] : []),
  ];

  return (
    <View style={{ paddingVertical: 4, paddingHorizontal: 8 }}>
      {items.map((item, i) => (
        <React.Fragment key={item.key}>
          {i > 0 ? <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: divC, marginVertical: 2 }} /> : null}
          <TouchableOpacity
            onPress={item.onPress}
            activeOpacity={0.6}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 13,
              paddingHorizontal: 8,
              gap: 12,
            }}
          >
            <Ionicons name={item.icon} size={20} color={item.color} />
            <Text style={{ fontSize: 16, color: item.color, fontWeight: '400', flex: 1 }}>
              {item.label}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)'} />
          </TouchableOpacity>
        </React.Fragment>
      ))}
    </View>
  );
});
