import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

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
}: ConversationMenuModalProps) {

  const items = [
    { key: 'share', icon: 'share-outline', label: 'Share', onPress: onShare },
    { key: 'add', icon: 'person-add-outline', label: 'Add people', onPress: onAddPeople || (() => {}) },
    { key: 'rename', icon: 'pencil-outline', label: 'Rename', onPress: () => onRename(conversationTitle || '') },
    { key: 'archive', icon: 'archive-outline', label: 'Archive', onPress: onArchive },
    { key: 'delete', icon: 'trash-outline', label: 'Delete', onPress: onDelete, destructive: true },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <View style={styles.menuWrap}>
          <BlurView intensity={85} tint="dark" style={styles.blurBox}>
            {conversationTitle ? (
              <View style={styles.titleRow}>
                <Text style={styles.titleText} numberOfLines={1}>{conversationTitle}</Text>
              </View>
            ) : null}
            {items.map((item, i) => (
              <TouchableOpacity
                key={item.key}
                style={[styles.menuItem, i > 0 && styles.menuItemBorder]}
                activeOpacity={0.65}
                onPress={() => {
                  onClose();
                  setTimeout(item.onPress, 60);
                }}
              >
                <Ionicons
                  name={item.icon as any}
                  size={21}
                  color={item.destructive ? '#FF453A' : 'rgba(255,255,255,0.9)'}
                />
                <Text style={[styles.menuLabel, item.destructive && styles.destructiveLabel]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </BlurView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuWrap: {
    width: 270,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 28,
    elevation: 28,
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
