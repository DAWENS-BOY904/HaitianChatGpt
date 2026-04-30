import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../hooks/useTheme';
import { useAlert } from '@/template';
import { Spacing, Typography, BorderRadius } from '../constants/theme';

interface LinkSafetyModalProps {
  visible: boolean;
  url: string;
  onClose: () => void;
  onOpenLink: (url: string) => void;
}

export function LinkSafetyModal({ visible, url, onClose, onOpenLink }: LinkSafetyModalProps) {
  const { colors } = useTheme();
  const { showAlert } = useAlert();

  const handleCopyLink = async () => {
    await Clipboard.setStringAsync(url);
    showAlert('Link Copied', 'The link has been copied to your clipboard');
    onClose();
  };

  const handleOpenLink = () => {
    onOpenLink(url);
    onClose();
  };

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    container: {
      backgroundColor: colors.background,
      borderTopLeftRadius: BorderRadius.xl,
      borderTopRightRadius: BorderRadius.xl,
      padding: Spacing.lg,
      paddingBottom: Spacing.xl * 2,
    },
    header: {
      width: 40,
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: Spacing.lg,
    },
    closeButton: {
      position: 'absolute',
      top: Spacing.lg,
      right: Spacing.lg,
      width: 32,
      height: 32,
      borderRadius: BorderRadius.full,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10,
    },
    title: {
      ...Typography.heading,
      fontSize: 22,
      color: colors.text,
      textAlign: 'center',
      marginBottom: Spacing.md,
      fontWeight: '600',
    },
    message: {
      ...Typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: Spacing.lg,
      lineHeight: 20,
    },
    urlContainer: {
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      marginBottom: Spacing.xl,
    },
    url: {
      ...Typography.body,
      color: colors.primary,
      textAlign: 'center',
      fontSize: 14,
    },
    openButton: {
      backgroundColor: '#000000',
      borderRadius: BorderRadius.xl,
      paddingVertical: Spacing.md + 2,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.md,
    },
    openButtonText: {
      ...Typography.body,
      color: '#FFFFFF',
      fontWeight: '600',
      fontSize: 16,
    },
    copyButton: {
      backgroundColor: colors.background,
      borderRadius: BorderRadius.xl,
      paddingVertical: Spacing.md + 2,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: Spacing.sm,
    },
    copyButtonText: {
      ...Typography.body,
      color: colors.text,
      fontWeight: '600',
      fontSize: 16,
    },
    learnMoreButton: {
      paddingVertical: Spacing.sm,
      alignItems: 'center',
    },
    learnMoreText: {
      ...Typography.body,
      color: colors.textSecondary,
      fontSize: 14,
    },
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.container} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header} />
          
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={20} color={colors.text} />
          </TouchableOpacity>

          <Text style={styles.title}>Check this link is safe</Text>
          
          <Text style={styles.message}>
            Some sites restrict our ability to check links. This link isn't verified and may include information from your conversation that could be shared with a third-party site. Make sure you trust this link before proceeding.
          </Text>

          <View style={styles.urlContainer}>
            <Text style={styles.url} numberOfLines={3}>
              {url}
            </Text>
          </View>

          <TouchableOpacity style={styles.openButton} onPress={handleOpenLink}>
            <Text style={styles.openButtonText}>Open link</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.copyButton} onPress={handleCopyLink}>
            <Text style={styles.copyButtonText}>Copy link</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.learnMoreButton} onPress={onClose}>
            <Text style={styles.learnMoreText}>Learn more</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
hello ai when i put a tex you read it dont fucking remove make change first please don’t skip make change this page add all this page in blur mode and when the user leaves home while the AI is generating, keep the conversation alive using a background task or AppState listener so the AI finishes responding then send a local push notification with the first 60 chars of the AI reply so users can tap to return and see the full response.
