/**
 * IMAGE SEARCH RESULTS — horizontal carousel, up to 10 images.
 * Used in home chat to display AI image search results inline.
 */
import React, { useState, useRef, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Modal,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { useTheme } from '../hooks/useTheme';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = Math.min(SCREEN_W * 0.68, 280);
const CARD_H = CARD_W * 0.72;
const COMPACT_W = 160;
const COMPACT_H = 120;

export interface SearchImage {
  url: string;
  title?: string;
  source?: string;
  alt?: string;
  link?: string;
}

interface ImageSearchResultsProps {
  query: string;
  images: SearchImage[];
  onImagePress?: (url: string, index: number) => void;
  /** compact = small horizontal chips (e.g. inside a message paragraph) */
  compact?: boolean;
  /** Max images to show, default 10 */
  maxImages?: number;
}

export const ImageSearchResults = memo(function ImageSearchResults({
  query,
  images,
  onImagePress,
  compact = false,
  maxImages = 10,
}: ImageSearchResultsProps) {
  const { colors, isDark } = useTheme();
  const [downloading, setDownloading] = useState<string | null>(null);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const visibleImages = images.slice(0, maxImages);

  const handleDownload = async (imageUrl: string, idx: number) => {
    try {
      setDownloading(imageUrl);
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') { setDownloading(null); return; }
      const fileUri = `${FileSystem.documentDirectory}dawinix_img_${Date.now()}_${idx}.jpg`;
      const result = await FileSystem.downloadAsync(imageUrl, fileUri);
      if (result.status === 200) {
        const asset = await MediaLibrary.createAssetAsync(result.uri);
        await MediaLibrary.createAlbumAsync('Dawinix', asset, false);
      }
    } catch (_e) {}
    finally { setDownloading(null); }
  };

  const handlePress = (url: string, idx: number) => {
    if (onImagePress) { onImagePress(url, idx); return; }
    setViewerIndex(idx);
    setViewerVisible(true);
  };

  if (visibleImages.length === 0) return null;

  const cardW = compact ? COMPACT_W : CARD_W;
  const cardH = compact ? COMPACT_H : CARD_H;

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <Ionicons name="images-outline" size={15} color={colors.textSecondary} />
          <Text style={[styles.headerLabel, { color: colors.textSecondary }]}>
            {visibleImages.length} image{visibleImages.length !== 1 ? 's' : ''}
          </Text>
          {query ? (
            <Text style={[styles.headerQuery, { color: colors.text }]} numberOfLines={1}>
              · {query}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Horizontal carousel */}
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.carousel, compact && { paddingHorizontal: 0 }]}
        decelerationRate="fast"
        snapToInterval={cardW + 12}
        snapToAlignment="start"
      >
        {visibleImages.map((img, idx) => (
          <ImageCard
            key={`img-${idx}-${img.url}`}
            img={img}
            idx={idx}
            cardW={cardW}
            cardH={cardH}
            isDark={isDark}
            colors={colors}
            isDownloading={downloading === img.url}
            onPress={() => handlePress(img.url, idx)}
            onDownload={() => handleDownload(img.url, idx)}
            compact={compact}
          />
        ))}
      </ScrollView>

      {/* Full-screen viewer */}
      <ImageViewer
        visible={viewerVisible}
        images={visibleImages}
        initialIndex={viewerIndex}
        isDark={isDark}
        onClose={() => setViewerVisible(false)}
      />
    </View>
  );
});

// ── Single image card ─────────────────────────────────────────────────────────
const ImageCard = memo(function ImageCard({
  img, idx, cardW, cardH, isDark, colors,
  isDownloading, onPress, onDownload, compact,
}: {
  img: SearchImage; idx: number; cardW: number; cardH: number;
  isDark: boolean; colors: any; isDownloading: boolean;
  onPress: () => void; onDownload: () => void; compact: boolean;
}) {
  const [imgError, setImgError] = useState(false);

  return (
    <TouchableOpacity
      style={[styles.card, { width: cardW, height: cardH, backgroundColor: isDark ? '#1C1C1E' : '#EBEBF0' }]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      {!imgError ? (
        <Image
          source={{ uri: img.url }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={220}
          onError={() => setImgError(true)}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <Ionicons name="image-outline" size={32} color={isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)'} />
        </View>
      )}

      {/* Dark gradient overlay */}
      <View style={styles.gradient} />

      {/* Bottom info */}
      {!compact && (
        <View style={styles.infoRow}>
          {img.title ? (
            <Text style={styles.cardTitle} numberOfLines={2}>{img.title}</Text>
          ) : null}
          <View style={styles.metaRow}>
            {img.source ? (
              <Text style={styles.sourceText} numberOfLines={1}>{img.source}</Text>
            ) : <View style={{ flex: 1 }} />}
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation(); onDownload(); }}
              style={styles.dlBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {isDownloading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Ionicons name="arrow-down-circle" size={20} color="#FFF" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Index badge */}
      <View style={styles.indexBadge}>
        <Text style={styles.indexText}>{idx + 1}</Text>
      </View>

      {/* Expand icon top-right */}
      <View style={styles.expandIcon}>
        <Ionicons name="expand-outline" size={13} color="rgba(255,255,255,0.85)" />
      </View>
    </TouchableOpacity>
  );
});

// ── Full-screen image viewer ──────────────────────────────────────────────────
const ImageViewer = memo(function ImageViewer({
  visible, images, initialIndex, isDark, onClose,
}: { visible: boolean; images: SearchImage[]; initialIndex: number; isDark: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState(initialIndex);

  React.useEffect(() => { if (visible) setCurrent(initialIndex); }, [visible, initialIndex]);

  const img = images[current];
  if (!img) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' }]}>
        {Platform.OS === 'ios' ? <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} /> : null}

        {/* Close */}
        <TouchableOpacity
          style={{ position: 'absolute', top: Platform.OS === 'ios' ? 60 : 28, right: 20, zIndex: 10, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}
          onPress={onClose}
        >
          <Ionicons name="close" size={22} color="#FFF" />
        </TouchableOpacity>

        {/* Image */}
        <Image
          source={{ uri: img.url }}
          style={{ width: SCREEN_W, height: SCREEN_W }}
          contentFit="contain"
          transition={200}
        />

        {/* Info */}
        {img.title ? (
          <View style={{ position: 'absolute', bottom: 60, left: 20, right: 20 }}>
            <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '600', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 }} numberOfLines={3}>{img.title}</Text>
            {img.source ? <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, textAlign: 'center', marginTop: 4 }}>{img.source}</Text> : null}
          </View>
        ) : null}

        {/* Prev / Next */}
        {images.length > 1 ? (
          <View style={{ position: 'absolute', bottom: 20, flexDirection: 'row', alignItems: 'center', gap: 18 }}>
            <TouchableOpacity onPress={() => setCurrent(i => Math.max(0, i - 1))} disabled={current === 0} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: current === 0 ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="chevron-back" size={22} color="#FFF" />
            </TouchableOpacity>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>{current + 1} / {images.length}</Text>
            <TouchableOpacity onPress={() => setCurrent(i => Math.min(images.length - 1, i + 1))} disabled={current === images.length - 1} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: current === images.length - 1 ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="chevron-forward" size={22} color="#FFF" />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </Modal>
  );
});

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    marginVertical: 6,
  },
  header: {
    paddingHorizontal: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  headerQuery: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  carousel: {
    paddingLeft: 16,
    paddingRight: 8,
    gap: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  card: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '55%',
    backgroundColor: 'transparent',
    // Simulate gradient from transparent to dark
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  infoRow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingBottom: 10,
    paddingTop: 36,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    marginBottom: 5,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sourceText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '500',
    flex: 1,
  },
  dlBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  expandIcon: {
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
});
