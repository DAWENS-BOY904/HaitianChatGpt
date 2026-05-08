import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Dimensions,
  Platform,
  Clipboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Animated, {
  FadeIn,
  SlideInRight,
} from 'react-native-reanimated';
import { Spacing, BorderRadius } from '../constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const GLASS = {
  bg: 'rgba(18, 18, 18, 0.98)',
  surface: 'rgba(38, 38, 38, 0.90)',
  border: 'rgba(255, 255, 255, 0.08)',
  text: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.60)',
  accent: '#0A84FF',
  success: '#30D158',
  code: '#1E1E1E',
};

interface CodeFile {
  name: string;
  path: string;
  content: string;
  language: string;
  size: number;
}

interface CodeProject {
  id: string;
  name: string;
  files: CodeFile[];
  structure: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  project: CodeProject;
}

export function CodeViewModal({ visible, onClose, project }: Props) {
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [showStructure, setShowStructure] = useState(true);

  const currentFile = project.files[selectedFileIndex];

  const handleCopyFile = () => {
    if (currentFile) {
      Clipboard.setString(currentFile.content);
      // TODO: Show toast notification
    }
  };

  const handleCopyAll = () => {
    const allCode = project.files
      .map(file => `// ${file.path}\n${file.content}`)
      .join('\n\n');
    Clipboard.setString(allCode);
  };

  const handleDownloadAll = () => {
    // TODO: Implement ZIP download
    console.log('Download all files as ZIP');
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />

        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Ionicons name="close" size={24} color={GLASS.text} />
              </TouchableOpacity>
              <View>
                <Text style={styles.projectName}>{project.name}</Text>
                <Text style={styles.fileCount}>{project.files.length} files</Text>
              </View>
            </View>

            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.iconButton} onPress={handleCopyAll}>
                <Ionicons name="copy-outline" size={22} color={GLASS.text} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconButton} onPress={handleDownloadAll}>
                <Ionicons name="download-outline" size={22} color={GLASS.text} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Toggle Structure/Files */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tab, showStructure && styles.tabActive]}
              onPress={() => setShowStructure(true)}
            >
              <Ionicons 
                name="file-tray-stacked-outline" 
                size={18} 
                color={showStructure ? GLASS.accent : GLASS.textSecondary} 
              />
              <Text style={[styles.tabText, showStructure && styles.tabTextActive]}>
                Structure
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, !showStructure && styles.tabActive]}
              onPress={() => setShowStructure(false)}
            >
              <Ionicons 
                name="code-slash-outline" 
                size={18} 
                color={!showStructure ? GLASS.accent : GLASS.textSecondary} 
              />
              <Text style={[styles.tabText, !showStructure && styles.tabTextActive]}>
                Code
              </Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {showStructure ? (
              <ScrollView style={styles.structureView}>
                <Text style={styles.structureText}>{project.structure}</Text>

                <View style={styles.divider} />

                <Text style={styles.sectionTitle}>All Files</Text>
                {project.files.map((file, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.fileListItem}
                    onPress={() => {
                      setSelectedFileIndex(index);
                      setShowStructure(false);
                    }}
                  >
                    <Ionicons name="document-text-outline" size={20} color={GLASS.accent} />
                    <View style={styles.fileInfo}>
                      <Text style={styles.fileName}>{file.path}</Text>
                      <Text style={styles.fileSize}>
                        {file.language} · {Math.ceil(file.size / 1024)}KB
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={GLASS.textSecondary} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.codeView}>
                {/* File Tabs */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.fileTabs}
                  contentContainerStyle={styles.fileTabsContent}
                >
                  {project.files.map((file, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.fileTab,
                        selectedFileIndex === index && styles.fileTabActive,
                      ]}
                      onPress={() => setSelectedFileIndex(index)}
                    >
                      <Text
                        style={[
                          styles.fileTabText,
                          selectedFileIndex === index && styles.fileTabTextActive,
                        ]}
                        numberOfLines={1}
                      >
                        {file.name}
                      </Text>
                      {selectedFileIndex === index && (
                        <TouchableOpacity style={styles.copyIconInTab} onPress={handleCopyFile}>
                          <Ionicons name="copy-outline" size={14} color={GLASS.text} />
                        </TouchableOpacity>
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Code Content */}
                <ScrollView style={styles.codeScroll}>
                  <View style={styles.codeBlock}>
                    <Text style={styles.codeText}>{currentFile?.content}</Text>
                  </View>
                </ScrollView>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  container: {
    flex: 1,
    marginTop: Platform.OS === 'ios' ? 50 : 30,
    backgroundColor: GLASS.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: GLASS.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: GLASS.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  closeButton: {
    padding: 8,
    marginRight: Spacing.sm,
  },
  projectName: {
    fontSize: 18,
    fontWeight: '700',
    color: GLASS.text,
  },
  fileCount: {
    fontSize: 13,
    color: GLASS.textSecondary,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  iconButton: {
    padding: 8,
    backgroundColor: GLASS.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: GLASS.border,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: GLASS.border,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    marginRight: Spacing.sm,
  },
  tabActive: {
    backgroundColor: GLASS.surface,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: GLASS.textSecondary,
  },
  tabTextActive: {
    color: GLASS.text,
  },
  content: {
    flex: 1,
  },
  structureView: {
    flex: 1,
    padding: Spacing.md,
  },
  structureText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    color: GLASS.text,
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: GLASS.border,
    marginVertical: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: GLASS.text,
    marginBottom: Spacing.sm,
  },
  fileListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: GLASS.surface,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
    borderWidth: 1,
    borderColor: GLASS.border,
  },
  fileInfo: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '500',
    color: GLASS.text,
    marginBottom: 2,
  },
  fileSize: {
    fontSize: 12,
    color: GLASS.textSecondary,
  },
  codeView: {
    flex: 1,
  },
  fileTabs: {
    borderBottomWidth: 1,
    borderBottomColor: GLASS.border,
  },
  fileTabsContent: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  fileTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: Spacing.xs,
    borderRadius: BorderRadius.sm,
    backgroundColor: GLASS.surface,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  fileTabActive: {
    borderColor: GLASS.accent,
    backgroundColor: 'rgba(10, 132, 255, 0.1)',
  },
  fileTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: GLASS.textSecondary,
    maxWidth: 120,
  },
  fileTabTextActive: {
    color: GLASS.text,
  },
  copyIconInTab: {
    marginLeft: 6,
    padding: 2,
  },
  codeScroll: {
    flex: 1,
  },
  codeBlock: {
    padding: Spacing.md,
    backgroundColor: GLASS.code,
  },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    color: '#D4D4D4',
    lineHeight: 18,
  },
});
