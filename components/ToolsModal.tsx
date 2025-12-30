import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { useTheme } from '../hooks/useTheme';
import { Spacing, Typography, BorderRadius } from '../constants/theme';

import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

interface ToolsModalProps {
  visible: boolean;
  onClose: () => void;
  onPickMedia: (media: any[]) => void;
  onSelectAIModel?: (model: string) => void;
  onOpenCamera?: () => void;
  currentModel?: string;
}

export function ToolsModal({
  visible,
  onClose,
  onPickMedia,
  onSelectAIModel,
  onOpenCamera,
  currentModel = 'gemini',
}: ToolsModalProps) {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const [showAISelector, setShowAISelector] = useState(false);

  /* ---------------- MEDIA PICKERS ---------------- */

  const handlePickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets.length > 0) {
      onPickMedia(
        result.assets.map(asset => ({
          type: 'image',
          uri: asset.uri,
          base64: asset.base64,
        })),
      );
      onClose();
    }
  };

  const handlePickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      onPickMedia([
        {
          type: 'video',
          uri: result.assets[0].uri,
        },
      ]);
      onClose();
    }
  };

  const handlePickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });

    if (!result.canceled && result.assets[0]) {
      onPickMedia([
        {
          type: 'file',
          uri: result.assets[0].uri,
          name: result.assets[0].name,
          mimeType: result.assets[0].mimeType,
        },
      ]);
      onClose();
    }
  };

  /* ---------------- AI MODELS ---------------- */

  const aiModels = [
    { id: 'openai', name: 'OpenAI', icon: 'flash', color: '#10A37F' },
    { id: 'gemini', name: 'Gemini', icon: 'diamond', color: '#4285F4' },
    { id: 'claude', name: 'Claude', icon: 'cube', color: '#CC785C' },
    { id: 'llama', name: 'Llama', icon: 'paw', color: '#0467DF' },
  ];

  /* ---------------- TOOLS ---------------- */

  const tools = [
    {
      id: 'camera',
      label: 'Camera',
      icon: 'camera',
      action: () => {
        onOpenCamera?.();
        onClose();
      },
    },
    {
      id: 'images',
      label: 'Add images',
      icon: 'images',
      subtitle: 'Upload up to 10+',
      action: handlePickImages,
    },
    {
      id: 'video',
      label: 'Add video',
      icon: 'videocam',
      action: handlePickVideo,
    },
    {
      id: 'file',
      label: 'Add file',
      icon: 'document',
      subtitle: 'PDF, ZIP, etc.',
      action: handlePickFile,
    },
    {
      id: 'ai-model',
      label: 'AI Model',
      icon: 'settings',
      subtitle: currentModel.toUpperCase(),
      action: () => setShowAISelector(true),
    },

  ];
  /* ---------------- STYLES ---------------- */

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
      gap: Spacing.sm,
    },
    toolItem: {
      width: '31%',
      aspectRatio: 1.2,
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
      fontWeight: '600',
    },
    toolSubtitle: {
      ...Typography.small,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 2,
    },
  });

  /* ---------------- RENDER ---------------- */

  return (
    <Modal visible={visible} transparent animationType="slide">
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1}>
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
                    onPress={tool.action}
                  >
                    <Ionicons
                      name={tool.icon as any}
                      size={28}
                      color={colors.primary}
                      style={styles.toolIcon}
                    />
                    <Text style={styles.toolLabel}>{tool.label}</Text>
                    {tool.subtitle && (
                      <Text style={styles.toolSubtitle}>{tool.subtitle}</Text>
                    )}
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
