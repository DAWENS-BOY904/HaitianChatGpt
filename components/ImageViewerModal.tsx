import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Image,
  TouchableOpacity,
  Platform,
  Share as RNShare,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import { useTheme } from '../hooks/useTheme';
import { useAlert } from '@/template';
import { Spacing, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ImageViewerModalProps {
  visible: boolean;
  imageUrl: string;
  onClose: () => void;
  onEdit?: () => void;
  title?: string;
}

export function ImageViewerModal({
  visible,
  imageUrl,
  onClose,
  onEdit,
  title = 'Image created',
}: ImageViewerModalProps) {
  const { colors } = useTheme();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);

      // Request permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Permission Required', 'Please grant photo library access to save images');
        return;
      }

      // Download image
      const fileUri = FileSystem.documentDirectory + 'temp_image.jpg';
      const { uri } = await FileSystem.downloadAsync(imageUrl, fileUri);

      // Save to photo library
      await MediaLibrary.saveToLibraryAsync(uri);

      showAlert('Success', 'Image saved to Photos');
    } catch (error) {
      console.error('Save error:', error);
      showAlert('Error', 'Failed to save image');
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    try {
      if (Platform.OS === 'web') {
        // Web fallback
        await RNShare.share({
          message: 'Check out this image!',
          url: imageUrl,
        });
      } else {
        // iOS/Android native share
        await RNShare.share({
          url: imageUrl,
          title: title,
        });
      }
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleInfo = () => {
    showAlert(
      'Image Information',
      `Title: ${title}\nSource: ${imageUrl.includes('chatgpt.com') ? 'ChatGPT' : 'AI Generated'}\n\nThis image was created using AI technology.`
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000000',
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
    },
    headerLeft: {
      flexDirection: 'row',
      gap: Spacing.md,
    },
    headerRight: {
      flexDirection: 'row',
      gap: Spacing.md,
    },
    headerButton: {
      width: 44,
      height: 44,
      borderRadius: BorderRadius.full,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    shareButton: {
      backgroundColor: '#FFFFFF',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.full,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    shareButtonText: {
      color: '#000000',
      fontWeight: '600',
      fontSize: 16,
    },
    imageContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    image: {
      width: '100%',
      height: '100%',
      resizeMode: 'contain',
    },
    footer: {
      padding: Spacing.md,
      paddingBottom: Platform.select({
        ios: insets.bottom + Spacing.md,
        android: insets.bottom + Spacing.md,
        default: Spacing.md,
      }),
    },
    editButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      padding: Spacing.md,
      borderRadius: BorderRadius.lg,
    },
    editButtonText: {
      color: '#FFFFFF',
      fontWeight: '600',
      fontSize: 16,
    },
  });

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity style={styles.headerButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton} onPress={handleInfo}>
              <Ionicons name="information-circle-outline" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.headerRight}>
            <TouchableOpacity 
              style={styles.headerButton} 
              onPress={handleSave}
              disabled={saving}
            >
              <Ionicons name="download-outline" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
              <Ionicons name="share-outline" size={20} color="#000000" />
              <Text style={styles.shareButtonText}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.imageContainer}>
          <Image source={{ uri: imageUrl }} style={styles.image} />
        </View>

        {onEdit && (
          <View style={styles.footer}>
            <TouchableOpacity style={styles.editButton} onPress={onEdit}>
              <Ionicons name="options-outline" size={20} color="#FFFFFF" />
              <Text style={styles.editButtonText}>Describe edits</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}
