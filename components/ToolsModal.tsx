import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ToolsModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectTool: (tool: string) => void;
}

const tools = [
  { id: 'image', name: 'Create image', icon: 'image-outline' },
  { id: 'thinking', name: 'Thinking mode', icon: 'bulb-outline' },
  { id: 'research', name: 'Deep research', icon: 'search-outline' },
  { id: 'web', name: 'Web search', icon: 'globe-outline' },
  { id: 'study', name: 'Study and learn', icon: 'book-outline' },
  { id: 'files', name: 'Add files', icon: 'document-attach-outline' },
  { id: 'shopping', name: 'Shopping research', icon: 'cart-outline' },
];

export function ToolsModal({ visible, onClose, onSelectTool }: ToolsModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const handleSelectTool = (toolId: string) => {
    onSelectTool(toolId);
    onClose();
  };

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'flex-end',
    },
    container: {
      backgroundColor: colors.background,
      borderTopLeftRadius: BorderRadius.lg,
      borderTopRightRadius: BorderRadius.lg,
      maxHeight: '80%',
      paddingBottom: Platform.select({ ios: insets.bottom, android: insets.bottom, default: 0 }),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      ...Typography.heading,
      color: colors.text,
    },
    closeButton: {
      padding: Spacing.xs,
    },
    content: {
      padding: Spacing.md,
    },
    toolItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.md,
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.sm,
      marginBottom: Spacing.sm,
      gap: Spacing.md,
    },
    toolIcon: {
      width: 40,
      height: 40,
      borderRadius: BorderRadius.sm,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    toolText: {
      flex: 1,
      ...Typography.body,
      color: colors.text,
    },
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.container} onStartShouldSetResponder={() => true}>
          <View style={styles.header}>
            <Text style={styles.title}>Tools</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            {tools.map(tool => (
              <TouchableOpacity
                key={tool.id}
                style={styles.toolItem}
                onPress={() => handleSelectTool(tool.id)}
              >
                <View style={styles.toolIcon}>
                  <Ionicons name={tool.icon as any} size={20} color={colors.primary} />
                </View>
                <Text style={styles.toolText}>{tool.name}</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}
