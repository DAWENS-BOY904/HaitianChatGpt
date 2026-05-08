import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  TextInput,
  Platform,
  Share,
  ActivityIndicator,
  KeyboardAvoidingView,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useAuth, useAlert } from '@/template';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function ImageViewerScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();
  const isMounted = useRef(true);

  const { imageUrl, prompt: initialPrompt } = useLocalSearchParams<{
    imageUrl: string;
    prompt?: string;
  }>();

  const [editPrompt, setEditPrompt] = useState('');
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Guard: invalid or missing imageUrl
  const validImageUrl = imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('http');

  useEffect(() => {
    if (!validImageUrl) {
      showAlert('Error', 'Invalid or missing image URL');
    }
  }, [validImageUrl, showAlert]);

  const safeSetState = useCallback(<T,>(setter: React.Dispatch<React.SetStateAction<T>>, value: T) => {
    if (isMounted.current) setter(value);
  }, []);

  const handleSave = useCallback(async () => {
    if (!validImageUrl) {
      showAlert('Error', 'No image to save');
      return;
    }

    try {
      safeSetState(setSaving, true);

      const { status, canAskAgain } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        if (canAskAgain) {
          showAlert('Permission required', 'Please allow access to save images');
        } else {
          showAlert('Permission denied', 'Enable photo access in Settings to save images');
        }
        safeSetState(setSaving, false);
        return;
      }

      const fileUri = `${FileSystem.cacheDirectory}image_${Date.now()}.png`;
      const downloadResult = await FileSystem.downloadAsync(imageUrl, fileUri, {
        sessionType: FileSystem.FileSystemSessionType.BACKGROUND,
      });

      if (downloadResult.status !== 200 || !downloadResult.uri) {
        throw new Error(`Download failed with status ${downloadResult.status}`);
      }

      const asset = await MediaLibrary.saveToLibraryAsync(downloadResult.uri);

      // Clean up cache file
      try {
        await FileSystem.deleteAsync(fileUri, { idempotent: true });
      } catch {
        // ignore cleanup errors
      }

      if (asset) {
        showAlert('Saved', 'Image saved to gallery');
      }
    } catch (error: any) {
      console.error('Save error:', error);
      showAlert('Error', error?.message || 'Failed to save image. Check your connection.');
    } finally {
      safeSetState(setSaving, false);
    }
  }, [validImageUrl, imageUrl, showAlert, safeSetState]);

  const handleShare = useCallback(async () => {
    if (!validImageUrl) {
      showAlert('Error', 'No image to share');
      return;
    }

    try {
      const shareOptions: any = { message: 'Made with HaitianChatGPT' };

      if (Platform.OS === 'ios') {
        shareOptions.url = imageUrl;
      } else {
        // Android: download first, then share local file
        const fileUri = `${FileSystem.cacheDirectory}share_${Date.now()}.png`;
        const result = await FileSystem.downloadAsync(imageUrl, fileUri);
        if (result.status === 200) {
          shareOptions.url = result.uri;
        } else {
          shareOptions.message += `\n${imageUrl}`;
        }
      }

      await Share.share(shareOptions);
    } catch (error: any) {
      // User cancelled share — don't show error
      if (error?.message?.includes('cancelled') || error?.message?.includes('Cancel')) {
        return;
      }
      console.error('Share error:', error);
      showAlert('Error', 'Failed to share image');
    }
  }, [validImageUrl, imageUrl, showAlert]);

  const handleDescribeEdits = useCallback(async () => {
    if (!editPrompt.trim() || processing || !validImageUrl) return;

    safeSetState(setProcessing, true);

    try {
      const { data, error } = await supabase.functions.invoke('chat', {
        body: {
          messages: [
            {
              role: 'user',
              content: `${initialPrompt || 'Edit this image'}: ${editPrompt}`,
              image_url: imageUrl,
            },
          ],
          model: 'google/gemini-2.5-flash-image-preview',
          modalities: ['image', 'text'],
          imageConfig: { aspectRatio: '1:1' },
        },
      });

      if (error) throw error;

      if (data?.image) {
        const fileName = `edited_${Date.now()}.png`;
        const filePath = `${user?.id}/${fileName}`;

        const base64Image = data.image.split(',')[1];
        const binaryStr = atob(base64Image);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

        const { error: uploadError } = await supabase.storage
          .from('media-files')
          .upload(filePath, bytes.buffer, {
            contentType: 'image/png',
          });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('media-files')
          .getPublicUrl(filePath);

        await supabase.from('media_files').insert({
          user_id: user?.id,
          file_type: 'image',
          file_url: urlData.publicUrl,
          file_name: fileName,
        });

        safeSetState(setEditPrompt, '');
        safeSetState(setImageLoading, true);
        safeSetState(setImageError, false);

        router.replace({
          pathname: '/image-viewer',
          params: {
            imageUrl: urlData.publicUrl,
            prompt: `${initialPrompt || ''} ${editPrompt}`.trim(),
          },
        });
      } else {
        throw new Error('No image returned from model');
      }
    } catch (error: any) {
      console.error('Edit error:', error);
      showAlert('Error', error?.message || 'Failed to edit image');
    } finally {
      safeSetState(setProcessing, false);
    }
  }, [editPrompt, processing, validImageUrl, imageUrl, initialPrompt, user, supabase, router, showAlert, safeSetState]);

  // Memoized styles
  const styles = React.useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000',
    },
    topBar: {
      position: 'absolute',
      top: Platform.select({
        ios: insets.top + 10,
        android: 20,
      }),
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      zIndex: 10,
    },
    topButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(0,0,0,0.6)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    topActions: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    imageContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    image: {
      width: SCREEN_W,
      height: SCREEN_H * 0.7,
    },
    imageLoader: {
      position: 'absolute',
    },
    errorContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.xl,
    },
    errorText: {
      ...Typography.body,
      color: '#FFF',
      marginTop: Spacing.md,
      textAlign: 'center',
    },
    bottomBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      paddingBottom: Platform.select({
        ios: insets.bottom + Spacing.md,
        android: Spacing.md,
      }),
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.md,
      backgroundColor: 'rgba(0,0,0,0.8)',
    },
    editContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.1)',
      borderRadius: BorderRadius.full,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      gap: Spacing.sm,
    },
    editIcon: {
      padding: Spacing.xs,
    },
    editInput: {
      flex: 1,
      ...Typography.body,
      color: '#FFF',
      maxHeight: 100,
    },
    sendButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: '#FFF',
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendButtonDisabled: {
      backgroundColor: 'rgba(255,255,255,0.3)',
    },
  }), [insets]);

  if (!validImageUrl) {
    return (
      <View style={[styles.container, styles.errorContainer]}>
        <Ionicons name="image-outline" size={64} color="rgba(255,255,255,0.3)" />
        <Text style={styles.errorText}>Invalid or missing image</Text>
        <TouchableOpacity style={[styles.topButton, { marginTop: Spacing.lg }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 44 : 0}
    >
      {/* TOP BAR */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topButton} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color="#FFF" />
        </TouchableOpacity>

        <View style={styles.topActions}>
          <TouchableOpacity style={styles.topButton}>
            <Ionicons name="information-circle-outline" size={24} color="#FFF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.topButton} onPress={handleSave} disabled={saving || imageLoading}>
            {saving ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Ionicons name="download-outline" size={24} color="#FFF" />
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.topButton} onPress={handleShare} disabled={imageLoading}>
            <Ionicons name="share-outline" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* IMAGE */}
      <View style={styles.imageContainer}>
        {imageLoading && (
          <ActivityIndicator style={styles.imageLoader} size="large" color="#FFF" />
        )}
        {imageError ? (
          <View style={styles.errorContainer}>
            <Ionicons name="image-outline" size={48} color="rgba(255,255,255,0.3)" />
            <Text style={styles.errorText}>Failed to load image</Text>
          </View>
        ) : (
          <Image
            source={{ uri: imageUrl }}
            style={styles.image}
            resizeMode="contain"
            onLoadStart={() => safeSetState(setImageLoading, true)}
            onLoadEnd={() => safeSetState(setImageLoading, false)}
            onError={() => {
              safeSetState(setImageLoading, false);
              safeSetState(setImageError, true);
            }}
          />
        )}
      </View>

      {/* BOTTOM BAR - DESCRIBE EDITS */}
      <View style={styles.bottomBar}>
        <View style={styles.editContainer}>
          <TouchableOpacity style={styles.editIcon}>
            <Ionicons name="sparkles-outline" size={20} color="#FFF" />
          </TouchableOpacity>

          <TextInput
            style={styles.editInput}
            placeholder="Describe edits"
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={editPrompt}
            onChangeText={setEditPrompt}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={handleDescribeEdits}
            blurOnSubmit
          />

          <TouchableOpacity
            style={[styles.sendButton, (!editPrompt.trim() || processing || imageLoading) && styles.sendButtonDisabled]}
            onPress={handleDescribeEdits}
            disabled={!editPrompt.trim() || processing || imageLoading}
          >
            {processing ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Ionicons name="arrow-up" size={20} color="#000" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
