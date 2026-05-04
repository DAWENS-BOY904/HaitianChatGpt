/**
 * IMAGE CARD COMPONENT
 * Displays generated images with Preview, Download, and Save actions
 * Full-screen viewer with swipe gestures
 */


import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { useTheme } from '../hooks/useTheme';
import { Spacing, Typography, BorderRadius } from '../constants/theme';

interface ImageCardProps {
  imageUrl: string;
  title?: string;
  resolution?: string;
  size?: string;
  onEdit?: () => void;
}

export function ImageCard({ 
  imageUrl, 
  title = 'Generated Image',
  resolution,
  size,
  onEdit 
}: ImageCardProps) {
  const { colors } = useTheme();
  const [showViewer, setShowViewer] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  const handleDownload = async () => {
    try {
      setDownloading(true);

      if (Platform.OS === 'web') {
        // Web: Download image
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = `image_${Date.now()}.jpg`;
        link.click();
        Alert.alert('Success', 'Image downloaded successfully!');
      } else {
        // Mobile: Save to photo library
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Please allow access to save images to your library.');
          return;
        }

        const ext = imageUrl.split('.').pop()?.split('?')[0] || 'jpg';
        const fileUri = `${FileSystem.documentDirectory}temp_image_${Date.now()}.${ext}`;
        const downloadResult = await FileSystem.downloadAsync(imageUrl, fileUri);

        if (downloadResult.status !== 200) {
          throw new Error('Download failed');
        }

        const asset = await MediaLibrary.createAssetAsync(downloadResult.uri);
        await MediaLibrary.createAlbumAsync('HaitianChatGPT', asset, false);

        Alert.alert('Success', 'Image saved to your photo library!');
      }
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Error', 'Failed to save image. Please try again.');
    } finally {
      setDownloading(false);
    }
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
      overflow: 'hidden',
    },
    imageContainer: {
      position: 'relative',
      backgroundColor: colors.background,
    },
    image: {
      width: '100%',
      height: 250,
      backgroundColor: colors.background,
    },
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    imageInfo: {
      padding: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    imageTitle: {
      ...Typography.body,
      color: colors.text,
      fontWeight: '600',
      fontSize: 15,
      marginBottom: 4,
    },
    imageMeta: {
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
      backgroundColor: 'rgba(0, 0, 0, 0.95)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalHeader: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: Spacing.md,
      paddingTop: Platform.select({ ios: 50, android: 20, default: 20 }),
      zIndex: 10,
    },
    closeButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    fullImage: {
      width: '100%',
      height: '100%',
    },
    modalActions: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      gap: Spacing.sm,
      padding: Spacing.md,
      paddingBottom: Platform.select({ ios: 30, android: 20, default: 20 }),
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      padding: Spacing.md,
      borderRadius: BorderRadius.md,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    modalButtonPrimary: {
      backgroundColor: colors.primary,
    },
    modalButtonText: {
      ...Typography.body,
      color: '#FFFFFF',
      fontWeight: '600',
    },
  });

  return (
    <>
      <View style={styles.card}>
        <TouchableOpacity 
          style={styles.imageContainer} 
          onPress={() => setShowViewer(true)}
          activeOpacity={0.9}
        >
          <Image
            source={{ uri: imageUrl }}
            style={styles.image}
            resizeMode="cover"
            onLoadStart={() => setImageLoading(true)}
            onLoadEnd={() => setImageLoading(false)}
          />
          {imageLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.imageInfo}>
          <Text style={styles.imageTitle}>{title}</Text>
          <Text style={styles.imageMeta}>
            {resolution || 'High Quality'} {size && `• ${size}`}
          </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.primaryButton]}
            onPress={() => setShowViewer(true)}
          >
            <Ionicons name="expand" size={16} color="#FFFFFF" />
            <Text style={[styles.actionText, styles.primaryText]}>Open</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleDownload}
            disabled={downloading}
          >
            <Ionicons name="download" size={16} color={colors.text} />
            <Text style={styles.actionText}>
              {downloading ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>

          {onEdit && (
            <TouchableOpacity style={styles.actionButton} onPress={onEdit}>
              <Ionicons name="create" size={16} color={colors.text} />
              <Text style={styles.actionText}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Full-screen Image Viewer Modal */}
      <Modal
        visible={showViewer}
        animationType="fade"
        transparent
        onRequestClose={() => setShowViewer(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowViewer(false)}
            >
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <Image
            source={{ uri: imageUrl }}
            style={styles.fullImage}
            resizeMode="contain"
          />

          <View style={styles.modalActions}>
            {onEdit && (
              <TouchableOpacity style={styles.modalButton} onPress={onEdit}>
                <Ionicons name="create-outline" size={20} color="#FFFFFF" />
                <Text style={styles.modalButtonText}>Edit</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonPrimary]}
              onPress={handleDownload}
              disabled={downloading}
            >
              <Ionicons name="download-outline" size={20} color="#FFFFFF" />
              <Text style={styles.modalButtonText}>
                {downloading ? 'Saving...' : 'Save Image'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}
hello ai please fix image generate in home page gen yon kote ki pa gen inag fix position card image bien koz gen yon bo image la fini and li paret make sure fix its
