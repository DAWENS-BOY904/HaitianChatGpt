import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
  Share,
  Alert,
  Animated,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useAuth, useAlert } from '@/template';
import { router } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { decode } from 'base64-arraybuffer';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface UploadedFile {
  id: string;
  file_type: string;
  file_url: string;
  file_name: string;
  file_size: number;
  created_at: string;
}

interface UploadProgress {
  [key: string]: {
    progress: number;
    status: 'pending' | 'uploading' | 'completed' | 'error';
    error?: string;
  };
}

// ═══════════════════════════════════════════════════════════════════════
// BLOCKED FILE TYPES - Security restrictions
// ═══════════════════════════════════════════════════════════════════════
const BLOCKED_EXTENSIONS = [
  // Archives (can be used to hide malicious files)
  'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'lz', 'lzma', 'zst',
  'cab', 'jar', 'war', 'ear',
  // Executables
  'exe', 'msi', 'bat', 'cmd', 'com', 'scr', 'app', 'out', 'bin', 'elf',
  'so', 'dll', 'dylib', 'deb', 'rpm', 'pkg', 'dmg',
  // Scripts that can execute
  'sh', 'bash', 'zsh', 'ps1', 'vbs',
  // Disk images
  'iso', 'img', 'vmdk', 'vhd', 'qcow2',
  // Mobile packages
  'apk', 'ipa', 'xap', 'sis', 'sisx',
];

const BLOCKED_MIME_TYPES = [
  'application/x-msdownload',
  'application/x-executable',
  'application/x-dosexec',
  'application/x-sh',
  'application/x-bat',
  'application/x-msdos-program',
  'application/vnd.android.package-archive',
];

// ═══════════════════════════════════════════════════════════════════════
// ALLOWED CODE EXTENSIONS - These are safe text/code files
// ═══════════════════════════════════════════════════════════════════════
const ALLOWED_CODE_EXTENSIONS = [
  'js', 'ts', 'tsx', 'jsx', 'py', 'rb', 'go', 'rs', 'java', 'kt', 'swift',
  'css', 'scss', 'sass', 'html', 'htm', 'xml', 'json', 'yaml', 'yml',
  'toml', 'ini', 'cfg', 'conf', 'sql', 'php', 'c', 'cpp', 'h', 'hpp',
  'cs', 'r', 'pl', 'lua', 'dart', 'scala', 'groovy', 'vue', 'svelte',
  'md', 'txt', 'log', 'csv',
];

// Check if file is allowed
function isFileAllowed(fileName: string, mimeType?: string): { allowed: boolean; reason?: string; isCode?: boolean } {
  const ext = (fileName || '').split('.').pop()?.toLowerCase() || '';

  // Code files are always allowed
  if (ALLOWED_CODE_EXTENSIONS.includes(ext)) {
    return { allowed: true, isCode: true };
  }

  // Check blocked extensions
  if (BLOCKED_EXTENSIONS.includes(ext)) {
    return { allowed: false, reason: `.${ext.toUpperCase()} files are not allowed for security reasons.` };
  }

  // Check blocked MIME types
  if (mimeType && BLOCKED_MIME_TYPES.some(blocked => mimeType.toLowerCase().includes(blocked))) {
    return { allowed: false, reason: 'This file type is not allowed for security reasons.' };
  }

  return { allowed: true, isCode: false };
}

// Get file icon based on type
function getFileIcon(fileType: string, fileName: string): { icon: keyof typeof Ionicons.glyphMap; color: string } {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  // Images
  if (fileType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico'].includes(ext)) {
    return { icon: 'image-outline', color: '#FF2D55' };
  }

  // Videos
  if (fileType.startsWith('video/') || ['mp4', 'mov', 'avi', 'mkv', 'wmv', 'flv', 'webm', 'm4v', '3gp'].includes(ext)) {
    return { icon: 'videocam-outline', color: '#FF9500' };
  }

  // Audio
  if (fileType.startsWith('audio/') || ['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a', 'wma'].includes(ext)) {
    return { icon: 'musical-notes-outline', color: '#AF52DE' };
  }

  // PDF
  if (ext === 'pdf' || fileType.includes('pdf')) {
    return { icon: 'document-text-outline', color: '#FF3B30' };
  }

  // Code files
  if (ALLOWED_CODE_EXTENSIONS.includes(ext)) {
    return { icon: 'code-outline', color: '#007AFF' };
  }

  // Documents
  if (['doc', 'docx', 'odt', 'rtf'].includes(ext)) {
    return { icon: 'document-outline', color: '#2B5CE6' };
  }

  // Spreadsheets
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) {
    return { icon: 'grid-outline', color: '#217346' };
  }

  // Presentations
  if (['ppt', 'pptx', 'odp'].includes(ext)) {
    return { icon: 'easel-outline', color: '#D24726' };
  }

  return { icon: 'document-outline', color: '#8E8E93' };
}

// Format file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Format date
function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();

    // Less than 1 hour
    if (diff < 3600000) {
      const mins = Math.floor(diff / 60000);
      return mins < 1 ? 'Just now' : `${mins}m ago`;
    }

    // Less than 24 hours
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours}h ago`;
    }

    // Less than 7 days
    if (diff < 604800000) {
      const days = Math.floor(diff / 86400000);
      return `${days}d ago`;
    }

    return d.toLocaleDateString();
  } catch {
    return dateStr;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// UPLOAD PROGRESS COMPONENT
// ═══════════════════════════════════════════════════════════════════════
function UploadProgressBar({ fileName, progress, status, onRetry, onCancel }: {
  fileName: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  onRetry?: () => void;
  onCancel?: () => void;
}) {
  const { colors } = useTheme();
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const widthInterpolated = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={[progressStyles.container, { backgroundColor: colors.surface }]}>
      <View style={progressStyles.header}>
        <Text style={[progressStyles.fileName, { color: colors.text }]} numberOfLines={1}>
          {fileName}
        </Text>
        <Text style={[progressStyles.status, { color: status === 'error' ? '#FF3B30' : colors.primary }]}>
          {status === 'pending' && 'Waiting...'}
          {status === 'uploading' && `${Math.round(progress)}%`}
          {status === 'completed' && 'Done'}
          {status === 'error' && 'Failed'}
        </Text>
      </View>

      <View style={[progressStyles.barContainer, { backgroundColor: colors.border }]}>
        <Animated.View style={[
          progressStyles.bar,
          {
            width: widthInterpolated,
            backgroundColor: status === 'error' ? '#FF3B30' : status === 'completed' ? '#34C759' : colors.primary,
          },
        ]} />
      </View>

      {status === 'error' && (
        <View style={progressStyles.actions}>
          <TouchableOpacity onPress={onRetry} style={progressStyles.retryBtn}>
            <Ionicons name="refresh" size={14} color={colors.primary} />
            <Text style={[progressStyles.retryText, { color: colors.primary }]}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onCancel} style={progressStyles.cancelBtn}>
            <Ionicons name="close" size={14} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const progressStyles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  fileName: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  status: {
    fontSize: 12,
    fontWeight: '700',
  },
  barContainer: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: 2,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  retryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cancelBtn: {
    padding: 4,
  },
});

// ═══════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════
export default function UploadManagerScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({});
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);

  // Load files on mount
  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('media_files')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFiles(data || []);
    } catch (error: any) {
      showAlert('Error', error?.message || 'Failed to load files');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadFiles();
  }, []);

  // ═══════════════════════════════════════════════════════════════════════
  // UPLOAD IMAGE / VIDEO
  // ═══════════════════════════════════════════════════════════════════════
  const handleUploadImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Permission Required', 'Please allow access to photo library');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.8,
        base64: true,
        allowsMultipleSelection: true,
        selectionLimit: 10,
      });

      if (!result.canceled && result.assets.length > 0) {
        await uploadFiles(result.assets.map(asset => ({
          uri: asset.uri,
          name: asset.fileName || `${Date.now()}_${Math.random().toString(36).substring(7)}.${asset.type === 'video' ? 'mp4' : 'jpg'}`,
          mimeType: asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg'),
          size: asset.fileSize || 0,
          base64: asset.base64,
          type: asset.type === 'video' ? 'video' : 'image',
        })));
      }
    } catch (error: any) {
      showAlert('Error', error?.message || 'Failed to pick media');
    }
  };

  // ═══════════════════════════════════════════════════════════════════════
  // UPLOAD FILE (Document)
  // ═══════════════════════════════════════════════════════════════════════
  const handleUploadFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (!result.canceled && result.assets?.length > 0) {
        const filesToUpload = result.assets.map(asset => ({
          uri: asset.uri,
          name: asset.name || 'file',
          mimeType: asset.mimeType || 'application/octet-stream',
          size: asset.size || 0,
          type: 'document' as const,
        }));

        // Check security
        const blocked = filesToUpload.filter(f => !isFileAllowed(f.name, f.mimeType).allowed);
        if (blocked.length > 0) {
          showAlert('File Blocked', `${blocked.length} file(s) blocked for security reasons.`);
          if (blocked.length === filesToUpload.length) return;
        }

        const allowed = filesToUpload.filter(f => isFileAllowed(f.name, f.mimeType).allowed);
        await uploadFiles(allowed);
      }
    } catch (error: any) {
      showAlert('Error', error?.message || 'Failed to pick file');
    }
  };

  // ═══════════════════════════════════════════════════════════════════════
  // CORE UPLOAD LOGIC
  // ═══════════════════════════════════════════════════════════════════════
  const uploadFiles = async (filesToUpload: Array<{
    uri: string;
    name: string;
    mimeType: string;
    size: number;
    base64?: string | null;
    type: string;
  }>) => {
    if (!user) return;

    // Initialize progress
    const initialProgress: UploadProgress = {};
    filesToUpload.forEach((file, index) => {
      initialProgress[`${file.name}_${index}`] = {
        progress: 0,
        status: 'pending',
      };
    });
    setUploadProgress(initialProgress);

    // Upload each file
    for (let i = 0; i < filesToUpload.length; i++) {
      const file = filesToUpload[i];
      const progressKey = `${file.name}_${i}`;

      try {
        // Update status to uploading
        setUploadProgress(prev => ({
          ...prev,
          [progressKey]: { ...prev[progressKey], status: 'uploading', progress: 10 },
        }));

        const filePath = `${user.id}/${Date.now()}_${file.name}`;
        const bucket = file.type === 'video' ? 'media-files' : 'chat-images';

        let uploadError;

        if (file.base64) {
          // For images with base64
          const { error } = await supabase.storage
            .from(bucket)
            .upload(filePath, decode(file.base64), {
              contentType: file.mimeType,
            });
          uploadError = error;
        } else {
          // For files without base64 (documents)
          const response = await fetch(file.uri);
          const blob = await response.blob();
          const arrayBuffer = await blob.arrayBuffer();

          const { error } = await supabase.storage
            .from(bucket)
            .upload(filePath, arrayBuffer, {
              contentType: file.mimeType,
            });
          uploadError = error;
        }

        if (uploadError) throw uploadError;

        // Update progress
        setUploadProgress(prev => ({
          ...prev,
          [progressKey]: { ...prev[progressKey], progress: 80 },
        }));

        // Get public URL
        const { data: urlData } = supabase.storage
          .from(bucket)
          .getPublicUrl(filePath);

        // Save to database
        const { error: dbError } = await supabase.from('media_files').insert({
          user_id: user.id,
          file_type: file.type,
          file_url: urlData.publicUrl,
          file_name: file.name,
          file_size: file.size,
        });

        if (dbError) throw dbError;

        // Mark as completed
        setUploadProgress(prev => ({
          ...prev,
          [progressKey]: { ...prev[progressKey], status: 'completed', progress: 100 },
        }));

      } catch (error: any) {
        console.error('Upload error:', error);
        setUploadProgress(prev => ({
          ...prev,
          [progressKey]: {
            ...prev[progressKey],
            status: 'error',
            error: error?.message || 'Upload failed',
          },
        }));
      }
    }

    // Clear completed uploads after delay
    setTimeout(() => {
      setUploadProgress(prev => {
        const filtered: UploadProgress = {};
        Object.entries(prev).forEach(([key, value]) => {
          if (value.status !== 'completed') {
            filtered[key] = value;
          }
        });
        return filtered;
      });
      loadFiles();
    }, 2000);
  };

  // ═══════════════════════════════════════════════════════════════════════
  // FILE ACTIONS
  // ═══════════════════════════════════════════════════════════════════════
  const handleShareFile = async (file: UploadedFile) => {
    try {
      await Share.share({
        message: file.file_url,
        title: file.file_name,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    Alert.alert('Delete File', 'Are you sure you want to delete this file?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await supabase.from('media_files').delete().eq('id', fileId);
            setFiles(prev => prev.filter(f => f.id !== fileId));
            showAlert('Deleted', 'File deleted successfully');
          } catch (error: any) {
            showAlert('Error', error?.message || 'Failed to delete file');
          }
        },
      },
    ]);
  };

  const handleDeleteSelected = async () => {
    if (selectedFiles.size === 0) return;

    Alert.alert(
      'Delete Files',
      `Delete ${selectedFiles.size} selected file(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const ids = Array.from(selectedFiles);
              await supabase.from('media_files').delete().in('id', ids);
              setFiles(prev => prev.filter(f => !selectedFiles.has(f.id)));
              setSelectedFiles(new Set());
              setSelectionMode(false);
              showAlert('Deleted', `${ids.length} file(s) deleted`);
            } catch (error: any) {
              showAlert('Error', error?.message || 'Failed to delete files');
            }
          },
        },
      ]
    );
  };

  const toggleSelection = (fileId: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  };

  const toggleSelectionMode = () => {
    setSelectionMode(prev => !prev);
    if (selectionMode) {
      setSelectedFiles(new Set());
    }
  };

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER HELPERS
  // ═══════════════════════════════════════════════════════════════════════
  const renderFileThumbnail = (file: UploadedFile) => {
    const { icon, color } = getFileIcon(file.file_type, file.file_name);

    if (file.file_type === 'image' || file.file_type === 'video') {
      return (
        <Image
          source={{ uri: file.file_url }}
          style={styles.thumbnailImage}
          contentFit="cover"
          transition={200}
        />
      );
    }

    return (
      <View style={[styles.fileIconContainer, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={28} color={color} />
      </View>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════
  // STYLES
  // ═══════════════════════════════════════════════════════════════════════
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: insets.top,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    backButton: {
      padding: Spacing.xs,
      marginRight: Spacing.sm,
    },
    headerTitle: {
      ...Typography.heading,
      color: colors.text,
      fontSize: 18,
    },
    headerActions: {
      flexDirection: 'row',
      gap: Spacing.sm,
      alignItems: 'center',
    },
    uploadButtons: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    uploadButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
    },
    selectionButton: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    selectionButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      padding: Spacing.md,
      paddingBottom: insets.bottom + Spacing.md,
    },
    fileCard: {
      backgroundColor: colors.card || colors.surface,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      marginBottom: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    fileCardSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '08',
    },
    fileHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    thumbnail: {
      width: 56,
      height: 56,
      borderRadius: BorderRadius.sm,
      backgroundColor: colors.surface,
      marginRight: Spacing.md,
      overflow: 'hidden',
    },
    thumbnailImage: {
      width: '100%',
      height: '100%',
    },
    fileIconContainer: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
    fileInfo: {
      flex: 1,
    },
    fileName: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    fileMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    fileSize: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    fileDate: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    fileActions: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginTop: Spacing.sm,
      paddingTop: Spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.sm,
      backgroundColor: colors.surface,
    },
    actionButtonText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
    },
    selectionCheckbox: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
      marginRight: Spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    selectionCheckboxActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.xl,
    },
    emptyIcon: {
      marginBottom: Spacing.md,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginBottom: Spacing.xs,
    },
    emptyText: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    progressContainer: {
      padding: Spacing.md,
      paddingBottom: 0,
    },
    selectionBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      backgroundColor: colors.primary + '10',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    selectionBarText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    selectionBarActions: {
      flexDirection: 'row',
      gap: Spacing.md,
    },
  });

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════
  const hasActiveUploads = Object.values(uploadProgress).some(
    p => p.status === 'pending' || p.status === 'uploading' || p.status === 'error'
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Files</Text>
          {files.length > 0 && (
            <Text style={{ marginLeft: 8, fontSize: 13, color: colors.textSecondary }}>
              ({files.length})
            </Text>
          )}
        </View>

        <View style={styles.headerActions}>
          {files.length > 0 && (
            <TouchableOpacity style={styles.selectionButton} onPress={toggleSelectionMode}>
              <Text style={styles.selectionButtonText}>
                {selectionMode ? 'Done' : 'Select'}
              </Text>
            </TouchableOpacity>
          )}
          <View style={styles.uploadButtons}>
            <TouchableOpacity style={styles.uploadButton} onPress={handleUploadImage} disabled={hasActiveUploads}>
              <Ionicons name="images-outline" size={20} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.uploadButton} onPress={handleUploadFile} disabled={hasActiveUploads}>
              <Ionicons name="document-outline" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Selection Bar */}
      {selectionMode && (
        <View style={styles.selectionBar}>
          <Text style={styles.selectionBarText}>
            {selectedFiles.size} selected
          </Text>
          <View style={styles.selectionBarActions}>
            <TouchableOpacity onPress={() => setSelectedFiles(new Set(files.map(f => f.id)))}>
              <Text style={{ color: colors.primary, fontWeight: '600' }}>Select All</Text>
            </TouchableOpacity>
            {selectedFiles.size > 0 && (
              <TouchableOpacity onPress={handleDeleteSelected}>
                <Text style={{ color: '#FF3B30', fontWeight: '600' }}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Upload Progress */}
      {hasActiveUploads && (
        <View style={styles.progressContainer}>
          {Object.entries(uploadProgress).map(([key, progress]) => (
            progress.status !== 'completed' && (
              <UploadProgressBar
                key={key}
                fileName={key.split('_')[0]}
                progress={progress.progress}
                status={progress.status}
                onRetry={() => {
                  // Retry logic would go here
                  showAlert('Retry', 'Retry functionality coming soon');
                }}
                onCancel={() => {
                  setUploadProgress(prev => {
                    const next = { ...prev };
                    delete next[key];
                    return next;
                  });
                }}
              />
            )
          ))}
        </View>
      )}

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : files.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons
            name="cloud-upload-outline"
            size={64}
            color={colors.textSecondary}
            style={styles.emptyIcon}
          />
          <Text style={styles.emptyTitle}>No files yet</Text>
          <Text style={styles.emptyText}>
            Upload images, videos, documents, and code files to access them anytime
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          {files.map((file) => (
            <TouchableOpacity
              key={file.id}
              style={[
                styles.fileCard,
                selectedFiles.has(file.id) && styles.fileCardSelected,
              ]}
              onPress={() => selectionMode ? toggleSelection(file.id) : null}
              onLongPress={() => {
                if (!selectionMode) {
                  setSelectionMode(true);
                  toggleSelection(file.id);
                }
              }}
              activeOpacity={selectionMode ? 0.7 : 1}
            >
              <View style={styles.fileHeader}>
                {selectionMode && (
                  <View style={[
                    styles.selectionCheckbox,
                    selectedFiles.has(file.id) && styles.selectionCheckboxActive,
                  ]}>
                    {selectedFiles.has(file.id) && (
                      <Ionicons name="checkmark" size={14} color="#FFF" />
                    )}
                  </View>
                )}

                <View style={styles.thumbnail}>
                  {renderFileThumbnail(file)}
                </View>

                <View style={styles.fileInfo}>
                  <Text style={styles.fileName} numberOfLines={2}>
                    {file.file_name}
                  </Text>
                  <View style={styles.fileMeta}>
                    <Text style={styles.fileSize}>
                      {formatFileSize(file.file_size)}
                    </Text>
                    <Text style={styles.fileDate}>
                      {formatDate(file.created_at)}
                    </Text>
                  </View>
                </View>
              </View>

              {!selectionMode && (
                <View style={styles.fileActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleShareFile(file)}
                  >
                    <Ionicons name="share-outline" size={16} color={colors.text} />
                    <Text style={styles.actionButtonText}>Share</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleDeleteFile(file.id)}
                  >
                    <Ionicons name="trash-outline" size={16} color="#FF3B30" />
                    <Text style={[styles.actionButtonText, { color: '#FF3B30' }]}>
                      Delete
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
