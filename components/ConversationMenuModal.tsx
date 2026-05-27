import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Platform,
  Pressable,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';

interface ConversationMenuModalProps {
  visible: boolean;
  onClose: () => void;
  onShare: () => void;
  onRename: () => void;
  onReport: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onAddPeople: () => void;
  conversationTitle?: string;
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
  topOffset = 60,
}: ConversationMenuModalProps) {
  const { isDark, colors } = useTheme();

  const textC = isDark ? '#FFFFFF' : '#000000';
  const subC = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)';

  const menuItems = [
    {
      icon: 'share-outline' as const,
      label: 'Share',
      onPress: () => { onClose(); onShare(); },
    },
    {
      icon: 'person-add-outline' as const,
      label: 'Add people',
      onPress: () => { onClose(); onAddPeople(); },
    },
    {
      icon: 'pencil-outline' as const,
      label: 'Rename',
      onPress: () => { onClose(); onRename(); },
    },
    {
      icon: 'archive-outline' as const,
      label: 'Archive',
      onPress: () => { onClose(); onArchive(); },
    },
    {
      icon: 'flag-outline' as const,
      label: 'Report',
      onPress: () => { onClose(); onReport(); },
    },
    {
      icon: 'trash-outline' as const,
      label: 'Delete',
      onPress: () => { onClose(); onDelete(); },
      destructive: true,
    },
  ];

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        {Platform.OS === 'ios' ? (
          <BlurView
            intensity={isDark ? 20 : 12}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.15)' }]} />
        )}
      </Pressable>

      <View style={[styles.menuContainer, { top: topOffset, right: 14 }]}>
        {Platform.OS === 'ios' ? (
          <BlurView
            intensity={isDark ? 88 : 78}
            tint={isDark ? 'dark' : 'extraLight'}
            style={styles.blurWrap}
          >
            {conversationTitle ? (
              <View style={styles.titleRow}>
                <Text style={[styles.titleText, { color: subC }]} numberOfLines={1}>
                  {conversationTitle}
                </Text>
              </View>
            ) : null}
            {menuItems.map((item, i) => (
              <TouchableOpacity
                key={item.label}
                style={styles.menuItem}
                onPress={item.onPress}
                activeOpacity={0.65}
              >
                <Text style={[styles.menuLabel, item.destructive && styles.destructive, { color: item.destructive ? '#FF453A' : textC }]}>
                  {item.label}
                </Text>
                <Ionicons
                  name={item.icon}
                  size={20}
                  color={item.destructive ? '#FF453A' : subC}
                />
              </TouchableOpacity>
            ))}
          </BlurView>
        ) : (
          <View style={[styles.blurWrap, { backgroundColor: isDark ? 'rgba(36,36,40,0.98)' : 'rgba(255,255,255,0.98)' }]}>
            {conversationTitle ? (
              <View style={styles.titleRow}>
                <Text style={[styles.titleText, { color: subC }]} numberOfLines={1}>
                  {conversationTitle}
                </Text>
              </View>
            ) : null}
            {menuItems.map((item) => (
              <TouchableOpacity
                key={item.label}
                style={styles.menuItem}
                onPress={item.onPress}
                activeOpacity={0.65}
              >
                <Text style={[styles.menuLabel, { color: item.destructive ? '#FF453A' : textC }]}>
                  {item.label}
                </Text>
                <Ionicons
                  name={item.icon}
                  size={20}
                  color={item.destructive ? '#FF453A' : subC}
                />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  menuContainer: {
    position: 'absolute',
    width: 240,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 18,
  },
  blurWrap: {
    borderRadius: 18,
    overflow: 'hidden',
    paddingVertical: 4,
  },
  titleRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  titleText: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuLabel: {
    fontSize: 17,
    fontWeight: '400',
  },
  destructive: {
    color: '#FF453A',
  },
});
