
/**
 * IMAGE SEARCH RESULTS COMPONENT
 * Displays search results in grid layout with download/open actions
 * Shows real images from internet search
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { useTheme } from '../hooks/useTheme';
import { Spacing, Typography, BorderRadius } from '../constants/theme';

const { width } = Dimensions.get('window');
const IMAGE_SIZE = (width - Spacing.md * 3) / 2;

interface SearchImage {
  url: string;
  title?: string;
  source?: string;
  resolution?: string;
}

interface ImageSearchResultsProps {
  query: string;
  images: SearchImage[];
  onImagePress?: (url: string) => void;
}

export function ImageSearchResults({ 
  query, 
  images,
  onImagePress 
}: ImageSearchResultsProps) {
  const { colors } = useTheme();
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownload = async (imageUrl: string, index: number) => {
    try {
      setDownloading(imageUrl);

      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        alert('Permission required to save images');
        return;
      }

      const fileUri = `${FileSystem.documentDirectory}search_image_${Date.now()}_${index}.jpg`;
      const downloadResult = await FileSystem.downloadAsync(imageUrl, fileUri);

      if (downloadResult.status !== 200) {
        throw new Error('Download failed');
      }

      const asset = await MediaLibrary.createAssetAsync(downloadResult.uri);
      await MediaLibrary.createAlbumAsync('HaitianChatGPT', asset, false);

      alert('Image saved to your library!');
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to save image');
    } finally {
      setDownloading(null);
    }
  };

  const styles = StyleSheet.create({
    container: {
      marginVertical: Spacing.sm,
    },
    header: {
      paddingHorizontal: Spacing.md,
      marginBottom: Spacing.sm,
    },
    headerTitle: {
      ...Typography.body,
      color: colors.textSecondary,
      fontSize: 14,
      marginBottom: 4,
    },
    query: {
      ...Typography.heading,
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    grid: {
      paddingHorizontal: Spacing.md,
    },
    gridContent: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    imageCard: {
      width: IMAGE_SIZE,
      aspectRatio: 1,
      borderRadius: BorderRadius.md,
      backgroundColor: colors.surface,
      overflow: 'hidden',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    image: {
      width: '100%',
      height: '100%',
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
      justifyContent: 'flex-end',
      padding: Spacing.sm,
    },
    actions: {
      flexDirection: 'row',
      gap: Spacing.xs,
    },
    actionButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    infoButton: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      padding: 6,
      borderRadius: BorderRadius.sm,
      alignItems: 'center',
    },
    resolutionText: {
      ...Typography.caption,
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '600',
    },
    emptyState: {
      padding: Spacing.xl,
      alignItems: 'center',
    },
    emptyText: {
      ...Typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
    },
  });

  if (images.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Image Search Results</Text>
          <Text style={styles.query}>{query}</Text>
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="images-outline" size={48} color={colors.textSecondary} />
          <Text style={styles.emptyText}>No images found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          Found {images.length} image{images.length !== 1 ? 's' : ''}
        </Text>
        <Text style={styles.query}>{query}</Text>
      </View>

      <ScrollView 
        style={styles.grid}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.gridContent}>
          {images.map((img, index) => (
            <TouchableOpacity
              key={index}
              style={styles.imageCard}
              onPress={() => onImagePress?.(img.url)}
              activeOpacity={0.9}
            >
              <Image 
                source={{ uri: img.url }} 
                style={styles.image}
                resizeMode="cover"
              />
              <View style={styles.overlay}>
                <View style={styles.actions}>
                  {img.resolution && (
                    <View style={styles.infoButton}>
                      <Text style={styles.resolutionText}>{img.resolution}</Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleDownload(img.url, index);
                    }}
                  >
                    {downloading === img.url ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Ionicons name="download" size={18} color="#FFFFFF" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
