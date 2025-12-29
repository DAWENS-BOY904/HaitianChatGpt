import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useAuth, useAlert } from '@/template';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { decode } from 'base64-arraybuffer';

interface UploadedFile {
  uri: string;
  name: string;
  type: string;
  size: number;
}

export default function ProjectUploadScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();
  const { projectId, projectName } = useLocalSearchParams<{ projectId: string; projectName: string }>();

  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string>('');

  const handleUploadPhotos = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permission Required', 'Please allow access to your photo library');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      const newFiles: UploadedFile[] = result.assets.map(asset => ({
        uri: asset.uri,
        name: asset.fileName || `photo_${Date.now()}.jpg`,
        type: 'image',
        size: asset.fileSize || 0,
      }));
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleUploadVideos = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permission Required', 'Please allow access to your photo library');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsMultipleSelection: true,
    });

    if (!result.canceled) {
      const newFiles: UploadedFile[] = result.assets.map(asset => ({
        uri: asset.uri,
        name: asset.fileName || `video_${Date.now()}.mp4`,
        type: 'video',
        size: asset.fileSize || 0,
      }));
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleUploadZip = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/zip', 'application/x-zip-compressed'],
      copyToCacheDirectory: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const newFile: UploadedFile = {
        uri: asset.uri,
        name: asset.name,
        type: 'zip',
        size: asset.size || 0,
      };
      setFiles(prev => [...prev, newFile]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleAnalyze = async () => {
    if (files.length === 0) {
      showAlert('No Files', 'Please upload at least one file to analyze');
      return;
    }

    setAnalyzing(true);
    setAnalysisResult('');

    try {
      // Upload files to storage
      const uploadedUrls: string[] = [];

      for (const file of files) {
        const fileName = `${projectId}/${Date.now()}_${file.name}`;
        const bucket = file.type === 'image' ? 'chat-images' : 'media-files';

        // Convert file to blob
        const response = await fetch(file.uri);
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();

        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(fileName, arrayBuffer, {
            contentType: file.type === 'image' ? 'image/jpeg' : 
                        file.type === 'video' ? 'video/mp4' : 
                        'application/zip',
          });

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from(bucket)
            .getPublicUrl(fileName);
          uploadedUrls.push(urlData.publicUrl);
        }
      }

      // Call AI to analyze files
      const { data: aiResponse, error: aiError } = await supabase.functions.invoke('chat', {
        body: {
          messages: [
            {
              role: 'user',
              content: `Analyze these ${files.length} files I uploaded for my project "${projectName}". Files: ${files.map(f => f.name).join(', ')}. Provide detailed analysis with insights and recommendations.`
            }
          ],
          conversationId: projectId,
          aiModel: 'google-gemini',
        },
      });

      if (aiError) {
        throw new Error('Failed to analyze files');
      }

      setAnalysisResult(aiResponse.message || 'Analysis complete! Files have been processed.');
    } catch (error: any) {
      console.error('Analysis error:', error);
      showAlert('Error', error.message || 'Failed to analyze files');
    } finally {
      setAnalyzing(false);
    }
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
      fontSize: 18,
    },
    upgradeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      backgroundColor: `${colors.primary}20`,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.full,
    },
    upgradeText: {
      ...Typography.caption,
      color: colors.primary,
      fontWeight: '600',
    },
    content: {
      flex: 1,
      padding: Spacing.lg,
    },
    projectInfo: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      marginBottom: Spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    projectIcon: {
      width: 50,
      height: 50,
      borderRadius: BorderRadius.md,
      backgroundColor: '#10A37F',
      alignItems: 'center',
      justifyContent: 'center',
    },
    projectDetails: {
      flex: 1,
    },
    projectName: {
      ...Typography.heading,
      color: colors.text,
      fontSize: 16,
      marginBottom: 4,
    },
    projectSubtitle: {
      ...Typography.caption,
      color: colors.textSecondary,
      fontSize: 12,
    },
    uploadButtons: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginBottom: Spacing.lg,
    },
    uploadButton: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: colors.border,
      borderStyle: 'dashed',
    },
    uploadButtonIcon: {
      marginBottom: Spacing.xs,
    },
    uploadButtonText: {
      ...Typography.caption,
      color: colors.text,
      fontSize: 12,
      fontWeight: '600',
    },
    filesContainer: {
      flex: 1,
      marginBottom: Spacing.lg,
    },
    fileCard: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    fileThumbnail: {
      width: 50,
      height: 50,
      borderRadius: BorderRadius.sm,
      backgroundColor: colors.surface,
      marginRight: Spacing.md,
      overflow: 'hidden',
    },
    fileIcon: {
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
      fontSize: 14,
      marginBottom: 4,
    },
    fileSize: {
      ...Typography.caption,
      color: colors.textSecondary,
      fontSize: 11,
    },
    removeButton: {
      padding: Spacing.xs,
    },
    analyzeButton: {
      backgroundColor: colors.primary,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    analyzeButtonDisabled: {
      opacity: 0.5,
    },
    analyzeButtonText: {
      ...Typography.body,
      color: '#FFFFFF',
      fontWeight: '600',
      fontSize: 16,
    },
    resultContainer: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    resultTitle: {
      ...Typography.heading,
      color: colors.text,
      fontSize: 16,
      marginBottom: Spacing.md,
    },
    resultText: {
      ...Typography.body,
      color: colors.text,
      fontSize: 14,
      lineHeight: 20,
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
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{projectName || 'Project'}</Text>
        </View>

        <TouchableOpacity 
          style={styles.upgradeButton}
          onPress={() => router.push('/subscription')}
        >
          <Ionicons name="flash" size={16} color={colors.primary} />
          <Text style={styles.upgradeText}>Upgrade</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.projectInfo}>
          <View style={styles.projectIcon}>
            <Ionicons name="folder" size={28} color="#FFFFFF" />
          </View>
          <View style={styles.projectDetails}>
            <Text style={styles.projectName}>{projectName || 'Untitled Project'}</Text>
            <Text style={styles.projectSubtitle}>
              Chats in this project will be visible here
            </Text>
          </View>
        </View>

        <View style={styles.uploadButtons}>
          <TouchableOpacity style={styles.uploadButton} onPress={handleUploadPhotos}>
            <Ionicons
              name="images-outline"
              size={32}
              color={colors.text}
              style={styles.uploadButtonIcon}
            />
            <Text style={styles.uploadButtonText}>Photos</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.uploadButton} onPress={handleUploadVideos}>
            <Ionicons
              name="videocam-outline"
              size={32}
              color={colors.text}
              style={styles.uploadButtonIcon}
            />
            <Text style={styles.uploadButtonText}>Videos</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.uploadButton} onPress={handleUploadZip}>
            <Ionicons
              name="file-tray-full-outline"
              size={32}
              color={colors.text}
              style={styles.uploadButtonIcon}
            />
            <Text style={styles.uploadButtonText}>ZIP Files</Text>
          </TouchableOpacity>
        </View>

        {files.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name="cloud-upload-outline"
              size={64}
              color={colors.textSecondary}
              style={styles.emptyIcon}
            />
            <Text style={styles.emptyTitle}>Add files to analyze</Text>
            <Text style={styles.emptyText}>
              Upload photos, videos, or ZIP files to get AI-powered insights
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.filesContainer}>
              {files.map((file, index) => (
                <View key={index} style={styles.fileCard}>
                  <View style={styles.fileThumbnail}>
                    {file.type === 'image' ? (
                      <Image
                        source={{ uri: file.uri }}
                        style={{ width: '100%', height: '100%' }}
                      />
                    ) : (
                      <View style={styles.fileIcon}>
                        <Ionicons
                          name={file.type === 'video' ? 'videocam' : 'file-tray-full'}
                          size={28}
                          color={colors.textSecondary}
                        />
                      </View>
                    )}
                  </View>

                  <View style={styles.fileInfo}>
                    <Text style={styles.fileName} numberOfLines={1}>
                      {file.name}
                    </Text>
                    <Text style={styles.fileSize}>
                      {formatFileSize(file.size)} • {file.type}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => handleRemoveFile(index)}
                  >
                    <Ionicons name="close-circle" size={24} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.analyzeButton, (analyzing || files.length === 0) && styles.analyzeButtonDisabled]}
              onPress={handleAnalyze}
              disabled={analyzing || files.length === 0}
            >
              {analyzing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="sparkles" size={20} color="#FFFFFF" />
              )}
              <Text style={styles.analyzeButtonText}>
                {analyzing ? 'Analyzing...' : 'Analyze Files'}
              </Text>
            </TouchableOpacity>

            {analysisResult && (
              <View style={styles.resultContainer}>
                <Text style={styles.resultTitle}>Analysis Result</Text>
                <Text style={styles.resultText}>{analysisResult}</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
