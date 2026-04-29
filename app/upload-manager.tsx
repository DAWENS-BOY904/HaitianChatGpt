import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Image,
  ActivityIndicator,
  Share,
} from 'react-native';
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

interface UploadedFile {
  id: string;
  file_type: string;
  file_url: string;
  file_name: string;
  file_size: number;
  created_at: string;
}

// ═══════════════════════════════════════════════════════════════════════
// BLOCKED FILE TYPES - these are NOT allowed to upload
// ═══════════════════════════════════════════════════════════════════════
const BLOCKED_EXTENSIONS = [
  // Archives
  'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'lz', 'lzma', 'zst',
  'cab', 'jar', 'war', 'ear',
  // Executables
  'exe', 'msi', 'bat', 'cmd', 'com', 'scr', 'app', 'out', 'bin', 'elf',
  'so', 'dll', 'dylib', 'deb', 'rpm', 'pkg', 'dmg',
  // Scripts
  'sh', 'bash', 'zsh', 'ps1', 'vbs', 'js', 'jar',
  // Disk images
  'iso', 'img', 'vmdk', 'vhd', 'qcow2',
  // Other dangerous
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

// Check if file is allowed
function isFileAllowed(fileName: string, mimeType?: string): { allowed: boolean; reason?: string } {
  const ext = (fileName || '').split('.').pop()?.toLowerCase() || '';
  
  if (BLOCKED_EXTENSIONS.includes(ext)) {
    return { allowed: false, reason: `.${ext.toUpperCase()} files are not allowed for security reasons.` };
  }
  
  if (mimeType && BLOCKED_MIME_TYPES.some(blocked => mimeType.toLowerCase().includes(blocked))) {
    return { allowed: false, reason: 'This file type is not allowed for security reasons.' };
  }
  
  return { allowed: true };
}

export default function UploadManagerScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('media_files')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setFiles(data);
    }
    setLoading(false);
  };

  const handleUploadImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.8,
      base64: true,
      allowsMultipleSelection: true,
    });

    if (!result.canceled && result.assets.length > 0) {
      setUploading(true);
      let uploadedCount = 0;
      let blockedCount = 0;

      for (const asset of result.assets) {
        try {
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${
            asset.type === 'video' ? 'mp4' : 'jpg'
          }`;
          
          // Check if allowed (images/videos should always pass, but safety check)
          const check = isFileAllowed(fileName, asset.mimeType || undefined);
          if (!check.allowed) {
            blockedCount++;
            continue;
          }

          const filePath = `${user?.id}/${fileName}`;
          const bucket = asset.type === 'video' ? 'media-files' : 'chat-images';

          const { error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(filePath, decode(asset.base64!), {
              contentType: asset.type === 'video' ? 'video/mp4' : 'image/jpeg',
            });

          if (uploadError) throw uploadError;

          const { data: urlData } = supabase.storage
            .from(bucket)
            .getPublicUrl(filePath);

          await supabase.from('media_files').insert({
            user_id: user?.id,
            file_type: asset.type || 'image',
            file_url: urlData.publicUrl,
            file_name: fileName,
            file_size: asset.fileSize || 0,
          });
          uploadedCount++;
        } catch (error) {
          console.error('Upload error:', error);
        }
      }

      setUploading(false);
      loadFiles();
      
      if (blockedCount > 0) {
        showAlert('Notice', `${uploadedCount} file(s) uploaded. ${blockedCount} file(s) blocked for security.`);
      } else {
        showAlert('Success', `Uploaded ${uploadedCount} file(s)`);
      }
    }
  };

  const handleUploadFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      
      // ═══════════════════════════════════════════════════════════════
      // SECURITY CHECK - Block dangerous file types
      // ═══════════════════════════════════════════════════════════════
      const check = isFileAllowed(asset.name, asset.mimeType || undefined);
      if (!check.allowed) {
        showAlert('File Not Allowed', check.reason || 'This file type is not permitted.');
        return;
      }

      setUploading(true);

      try {
        const fileName = asset.name;
        const filePath = `${user?.id}/${fileName}`;

        const response = await fetch(asset.uri);
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();

        const { error: uploadError } = await supabase.storage
          .from('media-files')
          .upload(filePath, arrayBuffer, {
            contentType: asset.mimeType || 'application/octet-stream',
          });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('media-files')
          .getPublicUrl(filePath);

        await supabase.from('media_files').insert({
          user_id: user?.id,
          file_type: 'document',
          file_url: urlData.publicUrl,
          file_name: fileName,
          file_size: asset.size || 0,
        });

        loadFiles();
        showAlert('Success', 'File uploaded successfully');
      } catch (error) {
        console.error('Upload error:', error);
        showAlert('Error', 'Failed to upload file');
      } finally {
        setUploading(false);
      }
    }
  };

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
    showAlert('Delete File', 'Are you sure you want to delete this file?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('media_files').delete().eq('id', fileId);
          loadFiles();
        },
      },
    ]);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: Platform.select({
        ios: insets.top,
        android: insets.top,
      }),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: Spacing.md,
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
    },
    uploadButtons: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    uploadButton: {
      padding: Spacing.xs,
    },
    content: {
      flex: 1,
      padding: Spacing.md,
    },
    fileCard: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      marginBottom: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    fileHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.sm,
    },
    thumbnail: {
      width: 60,
      height: 60,
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
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fileInfo: {
      flex: 1,
    },
    fileName: {
      ...Typography.body,
      color: colors.text,
      fontWeight: '600',
      marginBottom: Spacing.xs,
    },
    fileSize: {
      ...Typography.caption,
      color: colors.textSecondary,
      fontSize: 11,
    },
    fileActions: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginTop: Spacing.sm,
      paddingTop: Spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
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
      ...Typography.caption,
      color: colors.text,
      fontSize: 12,
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
      ...Typography.heading,
      color: colors.text,
      marginBottom: Spacing.xs,
    },
    emptyText: {
      ...Typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    blockedBadge: {
      position: 'absolute',
      top: 8,
      right: 8,
      backgroundColor: '#FF3B30',
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    blockedBadgeText: {
      color: '#FFF',
      fontSize: 10,
      fontWeight: '700',
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Upload Manager</Text>
        </View>

        <View style={styles.uploadButtons}>
          <TouchableOpacity
            style={styles.uploadButton}
            onPress={handleUploadImage}
            disabled={uploading}
          >
            <Ionicons name="images" size={24} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.uploadButton}
            onPress={handleUploadFile}
            disabled={uploading}
          >
            <Ionicons name="document" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

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
            Upload images, videos, or documents to access them anytime
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.content}>
          {files.map((file) => (
            <View key={file.id} style={styles.fileCard}>
              <View style={styles.fileHeader}>
                <View style={styles.thumbnail}>
                  {file.file_type === 'image' || file.file_type === 'video' ? (
                    <Image
                      source={{ uri: file.file_url }}
                      style={styles.thumbnailImage}
                    />
                  ) : (
                    <View style={styles.fileIconContainer}>
                      <Ionicons
                        name="document-outline"
                        size={32}
                        color={colors.textSecondary}
                      />
                    </View>
                  )}
                </View>

                <View style={styles.fileInfo}>
                  <Text style={styles.fileName} numberOfLines={2}>
                    {file.file_name}
                  </Text>
                  <Text style={styles.fileSize}>
                    {formatFileSize(file.file_size)} • {file.file_type}
                  </Text>
                </View>
              </View>

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
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
