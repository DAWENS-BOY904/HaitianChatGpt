import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Animated,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useTheme } from '../hooks/useTheme';
import { BlurView } from 'expo-blur';

const { width: SCREEN_W } = Dimensions.get('window');

// ── Types ────────────────────────────────────────────────────────────────────

export interface ImageSearchResult {
  url: string;
  title?: string;
  source?: string;
  resolution?: string;
  link?: string;
  isAiGenerated?: boolean;
  revisedPrompt?: string;
}

export interface ImageSearchRowSet {
  id: string;
  aiImages: ImageSearchResult[];      // Top row: AI generated (max 5)
  realImages: ImageSearchResult[];    // Bottom row: Real search results (max 5)
  query: string;
  timestamp: number;
}

interface ImageSearchCarouselProps {
  rowSets: ImageSearchRowSet[];
  onImagePress: (url: string, allUrls: string[], index: number) => void;
  onSendToChat?: (url: string) => void;
  onLoadMore?: () => void;
  isLoading?: boolean;
}

// ── Single Image Card ────────────────────────────────────────────────────────

const ImageCard = memo(function ImageCard({
  item,
  index,
  isAi,
  onPress,
  onSend,
  isDark,
  colors,
}: {
  item: ImageSearchResult;
  index: number;
  isAi: boolean;
  onPress: () => void;
  onSend?: () => void;
  isDark: boolean;
  colors: any;
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.95, useNativeDriver: true, friction: 5 }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 5 }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.88}
        style={[
          styles.card,
          {
            backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
            borderColor: isAi
              ? (isDark ? 'rgba(16,163,127,0.4)' : 'rgba(16,163,127,0.3)')
              : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
          },
        ]}
      >
        {/* AI Badge */}
        {isAi && (
          <View style={[styles.aiBadge, { backgroundColor: isDark ? '#10A37F' : '#10A37F' }]}>
            <Ionicons name="sparkles" size={10} color="#FFF" />
            <Text style={styles.aiBadgeText}>AI</Text>
          </View>
        )}

        {/* Source Badge for real images */}
        {!isAi && item.source && (
          <View style={[styles.sourceBadge, { backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.5)' }]}>
            <Text style={styles.sourceBadgeText}>{item.source}</Text>
          </View>
        )}

        {/* Image */}
        <Image
          source={{ uri: item.url }}
          style={styles.cardImage}
          contentFit="cover"
          transition={300}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
        />

        {/* Loading placeholder */}
        {!loaded && !error && (
          <View style={[StyleSheet.absoluteFill, styles.placeholder, { backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA' }]}>
            <ActivityIndicator size="small" color={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'} />
          </View>
        )}

        {/* Error state */}
        {error && (
          <View style={[StyleSheet.absoluteFill, styles.placeholder, { backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA', justifyContent: 'center', alignItems: 'center' }]}>
            <Ionicons name="image-outline" size={24} color={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'} />
          </View>
        )}

        {/* Send to chat button */}
        {onSend && (
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation(); onSend(); }}
            style={styles.sendBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <BlurView intensity={70} tint="dark" style={styles.sendBtnBlur}>
              <Ionicons name="send" size={12} color="#FFF" />
            </BlurView>
          </TouchableOpacity>
        )}

        {/* Title overlay at bottom */}
        {item.title && (
          <View style={[styles.titleOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.85)' }]}>
            <Text style={[styles.titleText, { color: isDark ? '#FFF' : '#000' }]} numberOfLines={1}>
              {item.title}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
});

// ── Single Row (Horizontal Scroll) ──────────────────────────────────────────

const ImageRow = memo(function ImageRow({
  images,
  isAi,
  onImagePress,
  onSendToChat,
  isDark,
  colors,
  rowLabel,
}: {
  images: ImageSearchResult[];
  isAi: boolean;
  onImagePress: (url: string, allUrls: string[], index: number) => void;
  onSendToChat?: (url: string) => void;
  isDark: boolean;
  colors: any;
  rowLabel: string;
}) {
  if (!images || images.length === 0) return null;

  const allUrls = images.map((img) => img.url);
  const CARD_W = Math.min((SCREEN_W - 48) / 5, 110); // 5 items per row, accounting for gaps
  const CARD_H = CARD_W * 1.1;

  return (
    <View style={styles.rowContainer}>
      {/* Row Label */}
      <View style={styles.rowHeader}>
        {isAi ? (
          <Ionicons name="sparkles" size={14} color="#10A37F" />
        ) : (
          <Ionicons name="globe-outline" size={14} color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)'} />
        )}
        <Text style={[styles.rowLabel, { color: isAi ? '#10A37F' : colors.textSecondary }]}>
          {rowLabel}
        </Text>
      </View>

      {/* Horizontal Scroll Row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rowScrollContent}
        decelerationRate="fast"
        snapToInterval={CARD_W + 8}
        snapToAlignment="start"
      >
        {images.map((img, idx) => (
          <View key={`${isAi ? 'ai' : 'real'}-${idx}-${img.url}`} style={{ width: CARD_W, marginRight: idx < images.length - 1 ? 8 : 0 }}>
            <ImageCard
              item={img}
              index={idx}
              isAi={isAi}
              onPress={() => onImagePress(img.url, allUrls, idx)}
              onSend={onSendToChat ? () => onSendToChat(img.url) : undefined}
              isDark={isDark}
              colors={colors}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
});

// ── Paired Row Set (AI Top + Real Bottom) ───────────────────────────────────

const PairedRowSet = memo(function PairedRowSet({
  rowSet,
  onImagePress,
  onSendToChat,
  isDark,
  colors,
  isLatest,
}: {
  rowSet: ImageSearchRowSet;
  onImagePress: (url: string, allUrls: string[], index: number) => void;
  onSendToChat?: (url: string) => void;
  isDark: boolean;
  colors: any;
  isLatest: boolean;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.pairedSet,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
          backgroundColor: isDark ? 'rgba(28,28,30,0.6)' : 'rgba(242,242,247,0.6)',
          borderColor: isLatest ? (isDark ? 'rgba(16,163,127,0.2)' : 'rgba(16,163,127,0.15)') : 'transparent',
        },
      ]}
    >
      {/* Query header */}
      <View style={styles.queryHeader}>
        <Ionicons name="search" size={12} color={colors.textSecondary} />
        <Text style={[styles.queryText, { color: colors.textSecondary }]} numberOfLines={1}>
          {rowSet.query}
        </Text>
        {isLatest && (
          <View style={[styles.newBadge, { backgroundColor: isDark ? '#10A37F' : '#10A37F' }]}>
            <Text style={styles.newBadgeText}>NEW</Text>
          </View>
        )}
      </View>

      {/* AI Row (Top) */}
      <ImageRow
        images={rowSet.aiImages}
        isAi={true}
        onImagePress={onImagePress}
        onSendToChat={onSendToChat}
        isDark={isDark}
        colors={colors}
        rowLabel="AI Generated"
      />

      {/* Divider between rows */}
      {rowSet.aiImages.length > 0 && rowSet.realImages.length > 0 && (
        <View style={[styles.rowDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]} />
      )}

      {/* Real Images Row (Bottom) */}
      <ImageRow
        images={rowSet.realImages}
        isAi={false}
        onImagePress={onImagePress}
        onSendToChat={onSendToChat}
        isDark={isDark}
        colors={colors}
        rowLabel="Search Results"
      />
    </Animated.View>
  );
});

// ── Main Image Search Carousel Component ────────────────────────────────────

export const ImageSearchCarousel = memo(function ImageSearchCarousel({
  rowSets,
  onImagePress,
  onSendToChat,
  onLoadMore,
  isLoading,
}: ImageSearchCarouselProps) {
  const { isDark, colors } = useTheme();
  const flatListRef = useRef<FlatList>(null);

  // Auto-scroll to latest row set when new data arrives
  useEffect(() => {
    if (rowSets.length > 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [rowSets.length]);

  const renderItem = useCallback(
    ({ item, index }: { item: ImageSearchRowSet; index: number }) => (
      <PairedRowSet
        rowSet={item}
        onImagePress={onImagePress}
        onSendToChat={onSendToChat}
        isDark={isDark}
        colors={colors}
        isLatest={index === rowSets.length - 1}
      />
    ),
    [onImagePress, onSendToChat, isDark, colors, rowSets.length]
  );

  const keyExtractor = useCallback((item: ImageSearchRowSet) => item.id, []);

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={rowSets}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          isLoading ? (
            <View style={styles.loadingFooter}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading more images...</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
});

// ── Hook: Use Image Search State ─────────────────────────────────────────────

export function useImageSearch() {
  const [rowSets, setRowSets] = useState<ImageSearchRowSet[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const rowSetIdRef = useRef(0);

  const generateRowSetId = () => {
    rowSetIdRef.current += 1;
    return `imgset-${Date.now()}-${rowSetIdRef.current}`;
  };

  /**
   * Add a new paired row set after a message exchange.
   * Call this after each AI response that contains image search results.
   */
  const appendRowSet = useCallback(
    (query: string, aiImages: ImageSearchResult[], realImages: ImageSearchResult[]) => {
      const newSet: ImageSearchRowSet = {
        id: generateRowSetId(),
        aiImages: aiImages.slice(0, 5),
        realImages: realImages.slice(0, 5),
        query,
        timestamp: Date.now(),
      };
      setRowSets((prev) => [...prev, newSet]);
    },
    []
  );

  /**
   * Replace the latest row set (useful for streaming updates).
   */
  const updateLatestRowSet = useCallback(
    (updater: (prev: ImageSearchRowSet) => ImageSearchRowSet) => {
      setRowSets((prev) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        return [...prev.slice(0, -1), updater(last)];
      });
    },
    []
  );

  /**
   * Clear all row sets.
   */
  const clearRowSets = useCallback(() => {
    setRowSets([]);
    rowSetIdRef.current = 0;
  }, []);

  /**
   * Remove a specific row set by ID.
   */
  const removeRowSet = useCallback((id: string) => {
    setRowSets((prev) => prev.filter((set) => set.id !== id));
  }, []);

  return {
    rowSets,
    isLoading,
    setIsLoading,
    appendRowSet,
    updateLatestRowSet,
    clearRowSets,
    removeRowSet,
  };
}

// ── Integration Helper: Parse image search from AI response ─────────────────

/**
 * Parse [IMAGE_SEARCH_RESULTS:...:IMAGE_SEARCH_END] tags from AI response
 * and convert to ImageSearchResult arrays for the carousel.
 */
export function parseImageSearchResults(content: string): {
  aiImages: ImageSearchResult[];
  realImages: ImageSearchResult[];
  cleanContent: string;
} {
  const aiImages: ImageSearchResult[] = [];
  const realImages: ImageSearchResult[] = [];

  // Extract AI-generated images from [AI_IMAGE:...] tags
  const aiRegex = /\[AI_IMAGE:([^\]]+)\]/g;
  let aiMatch;
  while ((aiMatch = aiRegex.exec(content)) !== null) {
    try {
      const data = JSON.parse(aiMatch[1]);
      if (data.url) {
        aiImages.push({
          url: data.url,
          title: data.title || 'AI Generated',
          source: 'AI',
          isAiGenerated: true,
          revisedPrompt: data.revisedPrompt,
        });
      }
    } catch {}
  }

  // Extract real images from [IMAGE_SEARCH_RESULTS:...:IMAGE_SEARCH_END]
  const resultsRegex = /\[IMAGE_SEARCH_RESULTS:([\s\S]*?):IMAGE_SEARCH_END\]/;
  const resultsMatch = content.match(resultsRegex);
  if (resultsMatch) {
    try {
      const parsed = JSON.parse(resultsMatch[1]);
      if (Array.isArray(parsed)) {
        parsed.forEach((img: any) => {
          if (img.url) {
            realImages.push({
              url: img.url,
              title: img.title || img.alt || 'Image',
              source: img.source || 'Web',
              resolution: img.resolution,
              link: img.link,
              isAiGenerated: false,
            });
          }
        });
      }
    } catch {}
  }

  // Also check for inline [IMAGE_SEARCH:query] tags
  const inlineRegex = /\[IMAGE_SEARCH:([^\]]+)\]/g;
  let inlineMatch;
  while ((inlineMatch = inlineRegex.exec(content)) !== null) {
    // These are queries, not results — handled by the server
  }

  const cleanContent = content
    .replace(/\[AI_IMAGE:[^\]]+\]/g, '')
    .replace(/\[IMAGE_SEARCH_RESULTS:[\s\S]*?:IMAGE_SEARCH_END\]/g, '')
    .replace(/\[IMAGE_SEARCH:[^\]]+\]/g, '')
    .trim();

  return { aiImages, realImages, cleanContent };
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  pairedSet: {
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  queryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  queryText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  newBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  newBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  rowContainer: {
    marginBottom: 8,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  rowLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  rowScrollContent: {
    paddingRight: 12,
    gap: 0,
  },
  rowDivider: {
    height: 1,
    marginVertical: 10,
    marginHorizontal: 4,
  },
  card: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1.5,
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 14,
  },
  placeholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  aiBadgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '800',
  },
  sourceBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    zIndex: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sourceBadgeText: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: '700',
  },
  sendBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 10,
  },
  sendBtnBlur: {
    width: 26,
    height: 26,
    borderRadius: 13,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  titleText: {
    fontSize: 10,
    fontWeight: '600',
  },
  loadingFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  loadingText: {
    fontSize: 13,
  },
});
