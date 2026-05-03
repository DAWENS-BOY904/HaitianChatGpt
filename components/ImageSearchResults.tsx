/**
 * IMAGE SEARCH RESULTS COMPONENT
 * Displays search results in grid layout with download/open actions
 * Shows real images from internet search
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
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
  const { colors, isDark } = useTheme();
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
      if (downloadResult.status !== 200) throw new Error('Download failed');
      const asset = await MediaLibrary.createAssetAsync(downloadResult.uri);
      await MediaLibrary.createAlbumAsync('Dawinix', asset, false);
      alert('Image saved to your library!');
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to save image');
    } finally {
      setDownloading(null);
    }
  };

  if (images.length === 0) {
    return (
      <View style={[styles.container, { paddingHorizontal: Spacing.md }]}>
        <Text style={[styles.headerTitle, { color: colors.textSecondary }]}>Image Search Results</Text>
        <Text style={[styles.query, { color: colors.text }]}>{query}</Text>
        <View style={styles.emptyState}>
          <Ionicons name="images-outline" size={48} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No images found</Text>
        </View>
      </View>
    );
  }

  // Build grid rows of 2
  const rows: SearchImage[][] = [];
  for (let i = 0; i < images.length; i += 2) {
    rows.push(images.slice(i, i + 2));
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.textSecondary }]}>
          {images.length} image{images.length !== 1 ? 's' : ''} found
        </Text>
        {query ? <Text style={[styles.query, { color: colors.text }]} numberOfLines={2}>{query}</Text> : null}
      </View>

      <View style={styles.grid}>
        {rows.map((row, rowIdx) => (
          <View key={rowIdx} style={styles.row}>
            {row.map((img, colIdx) => (
              <TouchableOpacity
                key={`${rowIdx}-${colIdx}`}
                style={[styles.imageCard, { backgroundColor: colors.surface }]}
                onPress={() => onImagePress?.(img.url)}
                activeOpacity={0.88}
              >
                <Image
                  source={{ uri: img.url }}
                  style={styles.image}
                  contentFit="cover"
                  transition={200}
                />
                {/* Gradient overlay with title + download */}
                <View style={styles.overlay}>
                  {img.title ? (
                    <Text style={styles.imageTitle} numberOfLines={2}>{img.title}</Text>
                  ) : null}
                  <View style={styles.actions}>
                    {img.source ? (
                      <Text style={styles.sourceText} numberOfLines={1}>{img.source}</Text>
                    ) : null}
                    <TouchableOpacity
                      style={styles.downloadBtn}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleDownload(img.url, rowIdx * 2 + colIdx);
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      {downloading === img.url ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Ionicons name="download-outline" size={16} color="#FFFFFF" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
                {/* Tap hint icon */}
                <View style={styles.tapHint}>
                  <Ionicons name="expand-outline" size={14} color="rgba(255,255,255,0.75)" />
                </View>
              </TouchableOpacity>
            ))}
            {/* Fill empty slot if odd count */}
            {row.length === 1 ? <View style={styles.imagePlaceholder} /> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  header: {
    paddingHorizontal: Spacing.md,
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  query: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  grid: {
    paddingHorizontal: Spacing.md,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 0,
  },
  imageCard: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 5,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingVertical: 8,
    paddingTop: 24,
    background: 'linear-gradient(transparent, rgba(0,0,0,0.65))',
    backgroundColor: 'rgba(0,0,0,0)',
    // Simulate gradient with a semi-transparent bottom
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  imageTitle: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sourceText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 10,
    fontWeight: '500',
    flex: 1,
  },
  downloadBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tapHint: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholder: {
    width: IMAGE_SIZE,
  },
  emptyState: {
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
