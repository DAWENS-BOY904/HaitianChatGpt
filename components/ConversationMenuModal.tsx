import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { Spacing, Typography, BorderRadius } from '../constants/theme';

interface ConversationMenuModalProps {
  visible: boolean;
  onClose: () => void;
  onShare: () => void;
  onRename: () => void;
  onReport: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

export function ConversationMenuModal({
  visible,
  onClose,
  onShare,
  onRename,
  onReport,
  onArchive,
  onDelete,
}: ConversationMenuModalProps) {
  const { colors } = useTheme();

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modal: {
      backgroundColor: colors.card,
      borderTopLeftRadius: BorderRadius.lg,
      borderTopRightRadius: BorderRadius.lg,
      paddingBottom: Spacing.xl,
    },
    handle: {
      width: 40,
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
      alignSelf: 'center',
      marginTop: Spacing.sm,
      marginBottom: Spacing.md,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.md,
      gap: Spacing.md,
    },
    menuText: {
      ...Typography.body,
      color: colors.text,
    },
    dangerText: {
      color: '#FF3B30',
    },
  });

  const MenuItem = ({ 
    icon, 
    text, 
    onPress, 
    danger = false 
  }: { 
    icon: string; 
    text: string; 
    onPress: () => void; 
    danger?: boolean;
  }) => (
    <TouchableOpacity 
      style={styles.menuItem} 
      onPress={() => {
        onPress();
        onClose();
      }}
    >
      <Ionicons name={icon as any} size={24} color={danger ? '#FF3B30' : colors.text} />
      <Text style={[styles.menuText, danger && styles.dangerText]}>{text}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={e => e.stopPropagation()}>
          <View style={styles.modal}>
            <View style={styles.handle} />
            <MenuItem icon="share-outline" text="Share" onPress={onShare} />
            <MenuItem icon="folder-outline" text="Add to project" onPress={() => {}} />
            <MenuItem icon="create-outline" text="Rename" onPress={onRename} />
            <MenuItem icon="flag-outline" text="Report" onPress={onReport} />
            <MenuItem icon="archive-outline" text="Archive" onPress={onArchive} />
            <MenuItem icon="trash-outline" text="Delete" onPress={onDelete} danger />
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
