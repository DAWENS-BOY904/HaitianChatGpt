import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Platform,
  Dimensions,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as MediaLibrary from 'expo-media-library';
import { useTheme } from '../hooks/useTheme';
import { useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { useAuth } from '@/template';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system';

const { width, height } = Dimensions.get('window');

export default function PreviewScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { uri, type } = params;
  const { showAlert } = useAlert();
  const { user } = useAuth();
  const supabase = getSupabaseClient();
  const [saving, setSaving] = useState(false);

  const handleRetake = () => {
    router.back();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Request media library permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Permission Denied', 'Please allow access to save media');
        setSaving(false);
        return;
      }

      // Save to device gallery
      await MediaLibrary.saveToLibraryAsync(uri as string);
      showAlert('Success', 'Media saved to gallery');
      
      router.back();
    } catch (error) {
      console.error('Save error:', error);
      showAlert('Error', 'Failed to save media');
    }
    setSaving(false);
  };

  const handleSendToChat = async () => {
    setSaving(true);
    try {
      if (!user) {
        showAlert('Error', 'Please login first');
        setSaving(false);
        return;
      }

      // Read file as base64
      const base64 = await FileSystem.readAsStringAsync(uri as string, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Determine file type and extension
      const fileType = type === 'video' ? 'video/mp4' : 'image/jpeg';
      const fileExtension = type === 'video' ? 'mp4' : 'jpg';
      const fileName = `${Date.now()}_${user.id}.${fileExtension}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('media-files')
        .upload(`${user.id}/${fileName}`, decode(base64), {
          contentType: fileType,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('media-files')
        .getPublicUrl(`${user.id}/${fileName}`);

      // Navigate to home with the media URL
      router.replace({
        pathname: '/home',
        params: {
          mediaUrl: urlData.publicUrl,
          mediaType: type,
        },
      });

      showAlert('Success', 'Media uploaded successfully');
    } catch (error) {
      console.error('Upload error:', error);
      showAlert('Error', 'Failed to upload media');
    }
    setSaving(false);
  };

  // Helper function to decode base64
  const decode = (base64: string) => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000',
    },
    mediaContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    image: {
      width: width,
      height: height,
    },
    video: {
      width: width,
      height: height,
    },
    topBar: {
      position: 'absolute',
      top: Platform.select({ ios: insets.top + 10, android: 40, default: 40 }),
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
    },
    closeButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    bottomBar: {
      position: 'absolute',
      bottom: Platform.select({ ios: insets.bottom + 20, android: 40, default: 40 }),
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      paddingHorizontal: Spacing.xl,
    },
    actionButton: {
      alignItems: 'center',
      gap: Spacing.xs,
    },
    iconButton: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: 'rgba(255,255,255,0.9)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButton: {
      width: 70,
      height: 70,
      borderRadius: 35,
      backgroundColor: '#FFCC00',
    },
    buttonLabel: {
      ...Typography.caption,
      color: '#FFF',
      fontSize: 12,
      fontWeight: '600',
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.mediaContainer}>
        {type === 'video' ? (
          <Video
            source={{ uri: uri as string }}
            style={styles.video}
            useNativeControls
            resizeMode={ResizeMode.CONTAIN}
            isLooping
            shouldPlay
          />
        ) : (
          <Image
            source={{ uri: uri as string }}
            style={styles.image}
            resizeMode="contain"
          />
        )}
      </View>

      <View style={styles.topBar}>
        <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleRetake}
          disabled={saving}
        >
          <View style={styles.iconButton}>
            <Ionicons name="refresh" size={28} color="#000" />
          </View>
          <Text style={styles.buttonLabel}>Retake</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleSendToChat}
          disabled={saving}
        >
          <View style={[styles.iconButton, styles.primaryButton]}>
            {saving ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Ionicons name="send" size={32} color="#000" />
            )}
          </View>
          <Text style={styles.buttonLabel}>Send to Chat</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleSave}
          disabled={saving}
        >
          <View style={styles.iconButton}>
            <Ionicons name="download" size={28} color="#000" />
          </View>
          <Text style={styles.buttonLabel}>Save</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
