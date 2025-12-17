import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { Spacing, Typography, BorderRadius } from '../constants/theme';

interface ToolsModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectTool: (tool: string) => void;
  onPickMedia: (type: 'photo' | 'video' | 'file') => void;
}

export function ToolsModal({ visible, onClose, onSelectTool, onPickMedia }: ToolsModalProps) {
  const { colors } = useTheme();

  const tools = [
    { id: 'photo', label: 'Add photo', icon: 'image', action: () => onPickMedia('photo') },
    { id: 'video', label: 'Add video', icon: 'videocam', action: () => onPickMedia('video') },
    { id: 'file', label: 'Add file', icon: 'document', action: () => onPickMedia('file') },
    { id: 'create-image', label: 'Create image', icon: 'color-wand', action: () => onSelectTool('Create Image') },
    { id: 'thinking', label: 'Thinking mode', icon: 'bulb', action: () => onSelectTool('Thinking Mode') },
    { id: 'research', label: 'Deep research', icon: 'search', action: () => onSelectTool('Deep Research') },
    { id: 'web-search', label: 'Web search', icon: 'globe', action: () => onSelectTool('Web Search') },
    { id: 'study', label: 'Study and learn', icon: 'school', action: () => onSelectTool('Study and Learn') },
    { id: 'shopping', label: 'Shopping research', icon: 'cart', action: () => onSelectTool('Shopping Research') },
  ];

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    container: {
      backgroundColor: colors.card,
      borderTopLeftRadius: BorderRadius.xl,
      borderTopRightRadius: BorderRadius.xl,
      maxHeight: '80%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
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
    toolGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.md,
    },
    toolItem: {
      width: '30%',
      aspectRatio: 1,
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    toolIcon: {
      marginBottom: Spacing.xs,
    },
    toolLabel: {
      ...Typography.caption,
      color: colors.text,
      textAlign: 'center',
    },
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.overlay} 
        activeOpacity={1} 
        onPress={onClose}
      >
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          <View style={styles.container}>
            <View style={styles.header}>
              <Text style={styles.title}>Tools</Text>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.content}>
              <View style={styles.toolGrid}>
                {tools.map(tool => (
                  <TouchableOpacity
                    key={tool.id}
                    style={styles.toolItem}
                    onPress={() => {
                      tool.action();
                      onClose();
                    }}
                  >
                    <Ionicons 
                      name={tool.icon as any} 
                      size={32} 
                      color={colors.primary} 
                      style={styles.toolIcon}
                    />
                    <Text style={styles.toolLabel}>{tool.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
