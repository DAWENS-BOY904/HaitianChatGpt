/**
 * FILE CARD COMPONENT
 * Displays generated files with Download, Open, Preview, and Copy actions
 * Professional file viewer with syntax highlighting
 */

import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Modal,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../hooks/useTheme';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { CodeBlock } from './CodeBlock';

interface FileCardProps {
  fileName: string;
  fileContent: string;
  fileType: string;
  fileSize?: string;
}

// Get file icon based on type
const getFileIcon = (fileType: string): keyof typeof Ionicons.glyphMap => {
  const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
    html: 'logo-html5',
    css: 'logo-css3',
    js: 'logo-javascript',
    ts: 'code-slash',
    tsx: 'code-slash',
    jsx: 'logo-react',
    python: 'logo-python',
    py: 'logo-python',
    java: 'logo-java',
    php: 'code-slash',
    json: 'code',
    xml: 'code',
    md: 'document-text',
    txt: 'document-text',
    default: 'document',
  };
  return iconMap[fileType.toLowerCase()] || iconMap.default;
};

// Get language for syntax highlighting
const getLanguage = (fileType: string): string => {
  const languageMap: Record<string, string> = {
    html: 'html',
    css: 'css',
    js: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    jsx: 'javascript',
    python: 'python',
    py: 'python',
    java: 'java',
    php: 'php',
    json: 'json',
    xml: 'xml',
    md: 'markdown',
    txt: 'text',
  };
  return languageMap[fileType.toLowerCase()] || 'text';
};

export function FileCard({ fileName, fileContent, fileType, fileSize }: FileCardProps) {
  const { colors } = useTheme();
  const [showViewer, setShowViewer] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(fileContent);
    Alert.alert('Copied!', 'File content copied to clipboard');
  };

  const handleDownload = async () => {
    try {
      setDownloading(true);

      if (Platform.OS === 'web') {
        // Web: Create download link
        const blob = new Blob([fileContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
        Alert.alert('Success', 'File downloaded successfully!');
      } else {
        // Mobile: Save to file system and share
        const fileUri = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(fileUri, fileContent);

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri);
        } else {
          Alert.alert('Success', `File saved to ${fileUri}`);
        }
      }
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Error', 'Failed to download file');
    } finally {
      setDownloading(false);
    }
  };

  const handlePreview = () => {
    setShowViewer(true);
  };

  const styles = StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.lg,
      marginVertical: Spacing.xs,
      marginHorizontal: Spacing.md,
      maxWidth: '85%',
      alignSelf: 'flex-start',
      marginLeft: Spacing.sm,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
      borderWidth: 1,
      borderColor: colors.border,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: BorderRadius.md,
      backgroundColor: `${colors.primary}15`,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: Spacing.md,
    },
    fileInfo: {
      flex: 1,
    },
    fileName: {
      ...Typography.body,
      color: colors.text,
      fontWeight: '600',
      fontSize: 15,
      marginBottom: 2,
    },
    fileMeta: {
      ...Typography.caption,
      color: colors.textSecondary,
      fontSize: 12,
    },
    actions: {
      flexDirection: 'row',
      padding: Spacing.sm,
      gap: Spacing.xs,
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      padding: Spacing.sm,
      borderRadius: BorderRadius.md,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    primaryButton: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    actionText: {
      ...Typography.caption,
      color: colors.text,
      fontSize: 12,
      fontWeight: '600',
    },
    primaryText: {
      color: '#FFFFFF',
    },
    // Modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    modalTitle: {
      ...Typography.heading,
      color: colors.text,
      fontSize: 18,
      flex: 1,
      marginLeft: Spacing.sm,
    },
    modalContent: {
      flex: 1,
      backgroundColor: colors.background,
    },
    codeContainer: {
      padding: Spacing.md,
    },
    modalActions: {
      flexDirection: 'row',
      gap: Spacing.sm,
      padding: Spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    modalButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      padding: Spacing.md,
      borderRadius: BorderRadius.md,
      backgroundColor: colors.surface,
    },
    modalButtonPrimary: {
      backgroundColor: colors.primary,
    },
    modalButtonText: {
      ...Typography.body,
      color: colors.text,
      fontWeight: '600',
    },
    modalButtonTextPrimary: {
      color: '#FFFFFF',
    },
  });

  return (
    <>
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons 
              name={getFileIcon(fileType)} 
              size={26} 
              color={colors.primary} 
            />
          </View>
          <View style={styles.fileInfo}>
            <Text style={styles.fileName} numberOfLines={1}>{fileName}</Text>
            <Text style={styles.fileMeta}>
              {fileType.toUpperCase()} • {fileSize || `${(fileContent.length / 1024).toFixed(1)} KB`}
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.primaryButton]} 
            onPress={handlePreview}
          >
            <Ionicons name="eye" size={16} color="#FFFFFF" />
            <Text style={[styles.actionText, styles.primaryText]}>Open</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleDownload}>
            <Ionicons name="download" size={16} color={colors.text} />
            <Text style={styles.actionText}>Download</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleCopy}>
            <Ionicons name="copy" size={16} color={colors.text} />
            <Text style={styles.actionText}>Copy</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* File Viewer Modal */}
      <Modal
        visible={showViewer}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowViewer(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowViewer(false)}>
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle} numberOfLines={1}>{fileName}</Text>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.codeContainer}>
              <CodeBlock 
                code={fileContent} 
                language={getLanguage(fileType)}
              />
            </View>
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity 
              style={styles.modalButton} 
              onPress={handleCopy}
            >
              <Ionicons name="copy-outline" size={20} color={colors.text} />
              <Text style={styles.modalButtonText}>Copy Code</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.modalButton, styles.modalButtonPrimary]} 
              onPress={handleDownload}
            >
              <Ionicons name="download-outline" size={20} color="#FFFFFF" />
              <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>
                {downloading ? 'Downloading...' : 'Download'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}
