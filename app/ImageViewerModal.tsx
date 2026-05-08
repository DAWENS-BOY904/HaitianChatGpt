import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Dimensions,
  Platform,
  StatusBar,
  FlatList,
  Share,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ImageViewerModalProps {
  visible: boolean;
  images: string[];
  initialIndex?: number;
  onClose: () => void;
}

export function ImageViewerModal({
  visible,
  images,
  initialIndex = 0,
  onClose,
}: ImageViewerModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const flatListRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();
  const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

  const handleShare = useCallback(async () => {
    try {
      await Share.share({ url: images[currentIndex], message: images[currentIndex] });
    } catch (_e) {}
  }, [images, currentIndex]);

  const handleViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index ?? 0);
    }
  }, []);

  const viewabilityConfig = { viewAreaCoveragePercentThreshold: 50 };

  if (!visible || images.length === 0) return null;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? insets.top : (StatusBar.currentHeight || 0) + 8 }]}>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          ) : null}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <View style={styles.closeBtnInner}>
              <Ionicons name="close" size={20} color="#FFF" />
            </View>
          </TouchableOpacity>
          {images.length > 1 ? (
            <Text style={styles.counter}>{currentIndex + 1} / {images.length}</Text>
          ) : (
            <View />
          )}
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <View style={styles.closeBtnInner}>
              <Ionicons name="share-outline" size={20} color="#FFF" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Image list */}
        <FlatList
          ref={flatListRef}
          data={images}
          keyExtractor={(item, i) => `${item}-${i}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, index) => ({ length: SCREEN_W, offset: SCREEN_W * index, index })}
          onViewableItemsChanged={handleViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          renderItem={({ item }) => (
            <View style={{ width: SCREEN_W, height: SCREEN_H, justifyContent: 'center', alignItems: 'center' }}>
              <Image
                source={{ uri: item }}
                style={{ width: SCREEN_W, height: SCREEN_H * 0.78 }}
                contentFit="contain"
                transition={200}
              />
            </View>
          )}
        />

        {/* Dot indicators */}
        {images.length > 1 ? (
          <View style={[styles.dots, { bottom: insets.bottom + 16 }]}>
            {images.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === currentIndex && styles.dotActive]}
              />
            ))}
          </View>
        ) : null}

        {/* Navigation arrows for multiple images */}
        {images.length > 1 ? (
          <>
            {currentIndex > 0 ? (
              <TouchableOpacity
                style={[styles.navBtn, styles.navBtnLeft]}
                onPress={() => {
                  const next = currentIndex - 1;
                  flatListRef.current?.scrollToIndex({ index: next, animated: true });
                  setCurrentIndex(next);
                }}
              >
                <BlurView intensity={50} tint="dark" style={styles.navBtnBlur}>
                  <Ionicons name="chevron-back" size={24} color="#FFF" />
                </BlurView>
              </TouchableOpacity>
            ) : null}
            {currentIndex < images.length - 1 ? (
              <TouchableOpacity
                style={[styles.navBtn, styles.navBtnRight]}
                onPress={() => {
                  const next = currentIndex + 1;
                  flatListRef.current?.scrollToIndex({ index: next, animated: true });
                  setCurrentIndex(next);
                }}
              >
                <BlurView intensity={50} tint="dark" style={styles.navBtnBlur}>
                  <Ionicons name="chevron-forward" size={24} color="#FFF" />
                </BlurView>
              </TouchableOpacity>
            ) : null}
          </>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  closeBtn: {
    zIndex: 1,
  },
  shareBtn: {
    zIndex: 1,
  },
  closeBtnInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 15,
    fontWeight: '600',
  },
  dots: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  dotActive: {
    backgroundColor: '#FFF',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  navBtn: {
    position: 'absolute',
    top: '50%',
    marginTop: -24,
    zIndex: 5,
  },
  navBtnLeft: {
    left: 12,
  },
  navBtnRight: {
    right: 12,
  },
  navBtnBlur: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
