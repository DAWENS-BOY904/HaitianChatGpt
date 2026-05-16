import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Platform,
  Share as RNShare,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../hooks/useTheme';
import { useAlert } from '@/template';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface FileDownloadModalProps {
  visible: boolean;
  fileName: string;
  fileContent: string;
  fileType: string;
  onClose: () => void;
}

export function FileDownloadModal({
  visible,
  fileName,
  fileContent,
  fileType,
  onClose,
}: FileDownloadModalProps) {
  const { colors } = useTheme();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    try {
      setDownloading(true);

      if (Platform.OS === 'web') {
        // Web download
        const blob = new Blob([fileContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
        showAlert('Success', 'File downloaded');
      } else {
        // Mobile download
        const fileUri = FileSystem.documentDirectory + fileName;
        await FileSystem.writeAsStringAsync(fileUri, fileContent);
        
        // Share file
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri);
        } else {
          showAlert('Success', `File saved to: ${fileUri}`);
        }
      }
    } catch (error) {
      console.error('Download error:', error);
      showAlert('Error', 'Failed to download file');
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = async () => {
    try {
      if (Platform.OS === 'web') {
        await RNShare.share({
          message: fileContent,
          title: fileName,
        });
      } else {
        const fileUri = FileSystem.documentDirectory + fileName;
        await FileSystem.writeAsStringAsync(fileUri, fileContent);
        await Sharing.shareAsync(fileUri);
      }
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: Spacing.md,
      paddingTop: Platform.select({
        ios: insets.top + Spacing.md,
        android: insets.top + Spacing.md,
        default: Spacing.md,
      }),
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerButton: {
      padding: Spacing.xs,
    },
    headerTitle: {
      ...Typography.heading,
      color: colors.text,
      fontSize: 16,
      flex: 1,
      textAlign: 'center',
    },
    content: {
      flex: 1,
    },
    fileInfo: {
      backgroundColor: colors.surface,
      padding: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    fileName: {
      ...Typography.body,
      color: colors.text,
      fontWeight: '600',
      marginBottom: Spacing.xs,
    },
    fileType: {
      ...Typography.caption,
      color: colors.textSecondary,
      fontSize: 12,
    },
    preview: {
      flex: 1,
      padding: Spacing.md,
    },
    previewLabel: {
      ...Typography.caption,
      color: colors.textSecondary,
      marginBottom: Spacing.sm,
      fontWeight: '600',
      textTransform: 'uppercase',
      fontSize: 11,
    },
    codeContainer: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
    },
    codeText: {
      ...Typography.body,
      color: colors.text,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 13,
      lineHeight: 18,
    },
    footer: {
      flexDirection: 'row',
      gap: Spacing.sm,
      padding: Spacing.md,
      paddingBottom: Platform.select({
        ios: insets.bottom + Spacing.md,
        android: insets.bottom + Spacing.md,
        default: Spacing.md,
      }),
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      backgroundColor: colors.surface,
      padding: Spacing.md,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    downloadButton: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    actionButtonText: {
      ...Typography.body,
      color: colors.text,
      fontWeight: '600',
    },
    downloadButtonText: {
      color: '#FFFFFF',
    },
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton} onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {fileName}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.content}>
          <View style={styles.fileInfo}>
            <Text style={styles.fileName}>{fileName}</Text>
            <Text style={styles.fileType}>{fileType.toUpperCase()} File</Text>
          </View>

          <ScrollView style={styles.preview}>
            <Text style={styles.previewLabel}>Preview</Text>
            <View style={styles.codeContainer}>
              <Text style={styles.codeText}>{fileContent}</Text>
            </View>
          </ScrollView>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
            <Ionicons name="share-outline" size={20} color={colors.text} />
            <Text style={styles.actionButtonText}>Share</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.downloadButton]}
            onPress={handleDownload}
            disabled={downloading}
          >
            <Ionicons name="download-outline" size={20} color="#FFFFFF" />
            <Text style={[styles.actionButtonText, styles.downloadButtonText]}>
              {downloading ? 'Downloading...' : 'Download'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
