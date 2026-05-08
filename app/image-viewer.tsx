
import React, { useState } from 'react';
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

export default function ImageViewerScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  const { imageUrl, prompt: initialPrompt } = useLocalSearchParams<{
    imageUrl: string;
    prompt?: string;
  }>();

  const [editPrompt, setEditPrompt] = useState('');
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);

      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Permission required', 'Please allow access to save images');
        return;
      }

      // Download image
      const fileUri = `${FileSystem.cacheDirectory}image_${Date.now()}.png`;
      const downloadResult = await FileSystem.downloadAsync(imageUrl, fileUri);

      if (downloadResult.uri) {
        await MediaLibrary.saveToLibraryAsync(downloadResult.uri);
        showAlert('Saved', 'Image saved to gallery');
      }
    } catch (error) {
      console.error('Save error:', error);
      showAlert('Error', 'Failed to save image');
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: 'Made with HaitianChatGPT',
        url: imageUrl,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleDescribeEdits = async () => {
    if (!editPrompt.trim() || processing) return;

    setProcessing(true);

    try {
      // Call Edge Function to re-edit image
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

      if (data.image) {
        // Save new version to media_files
        const fileName = `edited_${Date.now()}.png`;
        const filePath = `${user?.id}/${fileName}`;

        const base64Image = data.image.split(',')[1];
        // Decode base64 to ArrayBuffer inline (avoids base64-arraybuffer dependency)
        const binaryStr = atob(base64Image);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
        const { error: uploadError } = await supabase.storage
          .from('media-files')
          .upload(filePath, bytes.buffer, {
            contentType: 'image/png',
          });

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('media-files')
            .getPublicUrl(filePath);

          // Save to media_files table
          await supabase.from('media_files').insert({
            user_id: user?.id,
            file_type: 'image',
            file_url: urlData.publicUrl,
            file_name: fileName,
          });

          // Replace current view with new image
          router.replace({
            pathname: '/image-viewer',
            params: {
              imageUrl: urlData.publicUrl,
              prompt: `${initialPrompt || ''} ${editPrompt}`,
            },
          });

          setEditPrompt('');
        }
      }
    } catch (error) {
      console.error('Edit error:', error);
      showAlert('Error', 'Failed to edit image');
    } finally {
      setProcessing(false);
    }
  };

  const styles = StyleSheet.create({
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
      width: '100%',
      height: '100%',
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
    },
    sendButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: '#FFF',
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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

          <TouchableOpacity style={styles.topButton} onPress={handleSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Ionicons name="download-outline" size={24} color="#FFF" />
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.topButton} onPress={handleShare}>
            <Ionicons name="share-outline" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* IMAGE */}
      <View style={styles.imageContainer}>
        <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="contain" />
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
          />

          <TouchableOpacity
            style={styles.sendButton}
            onPress={handleDescribeEdits}
            disabled={!editPrompt.trim() || processing}
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
