import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Animated, Platform, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

const { width: SCREEN_W } = Dimensions.get('window');

interface ConversationMenuModalProps {
  visible: boolean;
  onClose: () => void;
  onShare: () => void;
  onRename: (title: string) => void;
  onReport: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onAddPeople?: () => void;
  conversationTitle?: string;
  /** top inset (safe area + header height) so menu opens below the header */
  topOffset?: number;
}

export function ConversationMenuModal({
  visible,
  onClose,
  onShare,
  onRename,
  onReport,
  onArchive,
  onDelete,
  onAddPeople,
  conversationTitle,
  topOffset = 100,
}: ConversationMenuModalProps) {

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.82)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 190, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 280, friction: 22, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 130, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 0.86, duration: 130, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const items = [
    { key: 'share',   icon: 'share-outline',      label: 'Share',      onPress: onShare },
    { key: 'add',     icon: 'person-add-outline',  label: 'Add people', onPress: onAddPeople || (() => {}) },
    { key: 'rename',  icon: 'pencil-outline',      label: 'Rename',     onPress: () => onRename(conversationTitle || '') },
    { key: 'archive', icon: 'archive-outline',     label: 'Archive',    onPress: onArchive },
    { key: 'delete',  icon: 'trash-outline',       label: 'Delete',     onPress: onDelete, destructive: true },
  ];

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      {/* Blurred full-screen backdrop */}
      <BlurView
        intensity={Platform.OS === 'ios' ? 30 : 50}
        tint="dark"
        style={StyleSheet.absoluteFill}
      />
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        {/* Anchored menu — top-right below the header ... button */}
        <Animated.View
          style={[
            styles.menuWrap,
            {
              top: topOffset,
              right: 12,
              opacity: fadeAnim,
              transform: [
                { scale: scaleAnim },
                { translateY: scaleAnim.interpolate({ inputRange: [0.82, 1], outputRange: [-10, 0] }) },
              ],
            },
          ]}
        >
          <BlurView intensity={Platform.OS === 'ios' ? 92 : 98} tint="dark" style={styles.blurBox}>
            {conversationTitle ? (
              <View style={styles.titleRow}>
                <Text style={styles.titleText} numberOfLines={1}>{conversationTitle}</Text>
              </View>
            ) : null}
            {items.map((item, i) => (
              <TouchableOpacity
                key={item.key}
                style={[styles.menuItem, i > 0 && styles.menuItemBorder]}
                activeOpacity={0.6}
                onPress={(e) => {
                  e.stopPropagation();
                  onClose();
                  setTimeout(item.onPress, 60);
                }}
              >
                <Text style={[styles.menuLabel, item.destructive && styles.destructiveLabel]}>
                  {item.label}
                </Text>
                <Ionicons
                  name={item.icon as any}
                  size={20}
                  color={item.destructive ? '#FF453A' : 'rgba(255,255,255,0.85)'}
                />
              </TouchableOpacity>
            ))}
          </BlurView>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  menuWrap: {
    position: 'absolute',
    width: 252,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  blurBox: { borderRadius: 16, overflow: 'hidden' },
  titleRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  titleText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuItemBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  menuLabel: { fontSize: 16, color: 'rgba(255,255,255,0.92)', fontWeight: '400' },
  destructiveLabel: { color: '#FF453A' },
});

please ai don’t skip make change in components/MessageItem, add selectable={true} to the AI message Text component so users can long-press to select and copy specific text spans natively, without opening any modal Update ConversationMenuModal to remove the full-screen BlurView backdrop so the chat background stays clear, and only the menu card itself has a blurred background with rounded borders (borderRadius 20+).
