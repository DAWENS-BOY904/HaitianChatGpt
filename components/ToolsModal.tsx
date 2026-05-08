import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Dimensions,
  Platform,
  ActivityIndicator,
  BackHandler,
  Alert,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useTheme } from '../hooks/useTheme';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as MediaLibrary from 'expo-media-library';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSubscription } from '../hooks/useSubscription';
import { useAuth } from '@/template';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const ADMIN_EMAILS = ['berryxoe@gmail.com', 'newdawens@gmail.com', 'kontgithub@gmail.com'];

// Photo selection limits
const FREE_PHOTO_LIMIT = 3;
const PRO_PHOTO_LIMIT = 10;

interface ToolsModalProps {
  visible: boolean;
  onClose: () => void;
  onPickMedia: (media: any[]) => void;
  onSelectTool?: (toolId: string) => void;
  onSelectAIModel?: (model: string) => void;
  onOpenCamera?: () => void;
  currentModel?: string;
  onOpenQuiz?: () => void;
  onOpenPresets?: () => void;
  onDeepResearch?: () => void;
  onConnectApp?: () => void;
}

interface RecentPhoto {
  uri: string;
  id: string;
}

interface SelectedPhoto {
  uri: string;
  order: number;
}

export function ToolsModal({
  visible,
  onClose,
  onPickMedia,
  onSelectTool,
  onSelectAIModel,
  onOpenCamera,
  currentModel = 'gemini',
  onOpenQuiz,
  onOpenPresets,
  onDeepResearch,
  onConnectApp,
}: ToolsModalProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const { tier } = useSubscription();
  const { user } = useAuth();

  const isAdmin = user?.email ? ADMIN_EMAILS.includes(user.email.toLowerCase()) : false;
  const isPro = isAdmin || tier === 'plus' || tier === 'go';
  const isGuest = !user;

  const photoLimit = isPro ? PRO_PHOTO_LIMIT : FREE_PHOTO_LIMIT;

  const [loading, setLoading] = useState<string | null>(null);
  const [rendered, setRendered] = useState(false);
  const [recentPhotos, setRecentPhotos] = useState<RecentPhoto[]>([]);
  // Map of uri -> selection order (1-based)
  const [selectedPhotos, setSelectedPhotos] = useState<Map<string, number>>(new Map());
  const selectionCounter = useRef(0);

  const translateY = useSharedValue(SCREEN_HEIGHT);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      selectionCounter.current = 0;
      setSelectedPhotos(new Map());
      translateY.value = withSpring(0, { damping: 26, stiffness: 300, mass: 0.8 });
      opacity.value = withTiming(1, { duration: 220 });
      loadRecentPhotos();
    } else {
      translateY.value = withSpring(SCREEN_HEIGHT, { damping: 26, stiffness: 300 });
      opacity.value = withTiming(0, { duration: 180 });
      const t = setTimeout(() => {
        setRendered(false);
        setSelectedPhotos(new Map());
        selectionCounter.current = 0;
      }, 280);
      return () => clearTimeout(t);
    }
  }, [visible]);

  const loadRecentPhotos = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') return;
      const { assets } = await MediaLibrary.getAssetsAsync({
        mediaType: MediaLibrary.MediaType.photo,
        first: 20,
        sortBy: MediaLibrary.SortBy.creationTime,
      });
      setRecentPhotos(assets.map(a => ({ uri: a.uri, id: a.id })));
    } catch (_e) {}
  };

  const togglePhoto = useCallback((uri: string) => {
    setSelectedPhotos(prev => {
      const next = new Map(prev);
      if (next.has(uri)) {
        // Deselect — re-number remaining in order
        next.delete(uri);
        // Rebuild order numbers
        const entries = Array.from(next.entries()).sort((a, b) => a[1] - b[1]);
        next.clear();
        entries.forEach(([u], i) => next.set(u, i + 1));
        selectionCounter.current = next.size;
      } else {
        if (next.size >= photoLimit) return prev; // blocked
        selectionCounter.current += 1;
        next.set(uri, selectionCounter.current);
      }
      return next;
    });
  }, [photoLimit]);

  const handleAddPhotos = async () => {
    if (selectedPhotos.size === 0) return;
    setLoading('photos_send');
    try {
      const ordered = Array.from(selectedPhotos.entries()).sort((a, b) => a[1] - b[1]);
      const medias = ordered.map(([uri]) => ({
        type: 'image' as const,
        uri,
        mimeType: 'image/jpeg',
      }));
      onPickMedia(medias);
      onClose();
    } catch (_e) {}
    finally { setLoading(null); }
  };

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (visible) { onClose(); return true; }
      return false;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  const modalStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(opacity.value, [0, 1], [0, 1], Extrapolate.CLAMP),
  }));

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationY > 0) {
        translateY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      if (e.translationY > 100 || e.velocityY > 500) {
        runOnJS(onClose)();
      } else {
        translateY.value = withSpring(0, { damping: 26, stiffness: 300 });
      }
    });

  const handleCamera = async () => {
    setLoading('camera');
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Camera permission is required.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.85,
        base64: true,
      });
      if (!result.canceled && result.assets[0]) {
        const isVideo = result.assets[0].mimeType?.startsWith('video/');
        onPickMedia([{
          type: isVideo ? 'video' : 'image',
          uri: result.assets[0].uri,
          base64: result.assets[0].base64,
          mimeType: result.assets[0].mimeType || 'image/jpeg',
        }]);
        onClose();
      }
    } catch (_e) {}
    finally { setLoading(null); }
  };

  const handleAllPhotos = async () => {
    setLoading('allphotos');
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Photo library permission is required.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsMultipleSelection: true,
        quality: 0.85,
        base64: true,
        selectionLimit: photoLimit,
      });
      if (!result.canceled && result.assets.length > 0) {
        onPickMedia(result.assets.map(a => ({
          type: a.mimeType?.startsWith('video/') ? 'video' : 'image',
          uri: a.uri,
          base64: a.base64,
          mimeType: a.mimeType || 'image/jpeg',
          name: a.fileName,
        })));
        onClose();
      }
    } catch (_e) {}
    finally { setLoading(null); }
  };

  const handleFiles = async () => {
    setLoading('files');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: true,
      });
      if (!result.canceled && result.assets?.length > 0) {
        const medias = result.assets.map(asset => {
          const mime = (asset.mimeType || 'application/octet-stream').toLowerCase();
          const isImg = mime.startsWith('image/');
          const ext = (asset.name || '').split('.').pop()?.toLowerCase() || '';
          const isVideo = mime.startsWith('video/') || ['mp4','mov','avi','mkv','webm'].includes(ext);
          return {
            type: isImg ? 'image' : isVideo ? 'video' : 'document',
            uri: asset.uri,
            name: asset.name,
            mimeType: mime,
            size: asset.size,
          };
        });
        onPickMedia(medias);
        onClose();
      }
    } catch (_e) {}
    finally { setLoading(null); }
  };

  if (!visible && !rendered) return null;

  const bottomPad = Math.max(insets.bottom, 16);
  const selectedCount = selectedPhotos.size;
  const hasSelectedPhotos = selectedCount > 0;

  // ── Color tokens ──────────────────────────────────────────────────────────
  const textPrimary = isDark ? '#FFFFFF' : '#000000';
  const textSecondary = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)';
  const dividerColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  const rowBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)';
  const accentBlue = '#007AFF';

  // ── TOOLS LIST ────────────────────────────────────────────────────────────
  // Pro has full list, free/guest has limited
  const toolItems = isGuest ? [
    { id: 'create-image', icon: 'color-palette-outline', iconColor: '#FF6B6B', label: 'Create image', sub: 'Visualize anything', onPress: () => { onSelectTool?.('create-image'); onClose(); } },
    { id: 'web-search',   icon: 'globe-outline',         iconColor: '#007AFF', label: 'Web Search',   sub: 'Find real-time news and info', onPress: () => { onSelectTool?.('web-search'); onClose(); } },
    { id: 'deep-research',icon: 'search-outline',         iconColor: '#5AC8FA', label: 'Deep research',sub: 'Get a detailed report', onPress: () => { onDeepResearch?.(); onClose(); } },
    { id: 'thinking',     icon: 'bulb-outline',           iconColor: '#FFD60A', label: 'Thinking',     sub: 'Think longer for better answers', onPress: () => { onSelectTool?.('thinking'); onClose(); } },
    { id: 'add-files',    icon: 'attach-outline',         iconColor: '#8E8E93', label: 'Add files',    sub: 'Analyze or summarize', onPress: () => { handleFiles(); } },
  ] : isPro ? [
    { id: 'create-image', icon: 'color-palette-outline', iconColor: '#FF6B6B', label: 'Create image', sub: 'Visualize anything', onPress: () => { onSelectTool?.('create-image'); onClose(); } },
    { id: 'thinking',     icon: 'bulb-outline',           iconColor: '#FFD60A', label: 'Thinking',     sub: 'Think longer for better answers', onPress: () => { onSelectTool?.('thinking'); onClose(); } },
    { id: 'deep-research',icon: 'search-outline',         iconColor: '#5AC8FA', label: 'Deep research',sub: 'Get a detailed report', onPress: () => { onDeepResearch?.(); onClose(); } },
    { id: 'web-search',   icon: 'globe-outline',         iconColor: '#007AFF', label: 'Web search',   sub: 'Find real-time news and info', onPress: () => { onSelectTool?.('web-search'); onClose(); } },
    { id: 'add-files',    icon: 'attach-outline',         iconColor: '#8E8E93', label: 'Add files',    sub: 'Analyze or summarize', onPress: () => { handleFiles(); } },
    { id: 'quiz',         icon: 'albums-outline',         iconColor: '#5AC8FA', label: 'Study & Quiz', sub: 'Test your knowledge', onPress: () => { onOpenQuiz?.(); onClose(); } },
    { id: 'voice',        icon: 'mic-outline',            iconColor: '#34C759', label: 'Voice mode',   sub: 'Talk to your AI assistant', onPress: () => { router.push('/voice-control'); onClose(); } },
    { id: 'presets',      icon: 'cube-outline',           iconColor: '#AF52DE', label: 'Presets',      sub: 'Quick behavior templates', onPress: () => { onOpenPresets?.(); onClose(); } },
    { id: 'apps',         icon: 'apps-outline',           iconColor: '#FF9F0A', label: 'Explore apps', sub: 'Chat with apps in Dawinix', onPress: () => { onConnectApp?.(); onClose(); }, chevron: true },
  ] : [
    // Free plan
    { id: 'create-image', icon: 'color-palette-outline', iconColor: '#FF6B6B', label: 'Create image', sub: 'Visualize anything', onPress: () => { onSelectTool?.('create-image'); onClose(); } },
    { id: 'thinking',     icon: 'bulb-outline',           iconColor: '#FFD60A', label: 'Thinking',     sub: 'Think longer for better answers', onPress: () => { onSelectTool?.('thinking'); onClose(); } },
    { id: 'deep-research',icon: 'search-outline',         iconColor: '#5AC8FA', label: 'Deep research',sub: 'Get a detailed report', onPress: () => { onDeepResearch?.(); onClose(); } },
    { id: 'web-search',   icon: 'globe-outline',         iconColor: '#007AFF', label: 'Web search',   sub: 'Find real-time news and info', onPress: () => { onSelectTool?.('web-search'); onClose(); } },
    { id: 'add-files',    icon: 'attach-outline',         iconColor: '#8E8E93', label: 'Add files',    sub: 'Analyze or summarize', onPress: () => { handleFiles(); } },
    { id: 'quiz',         icon: 'albums-outline',         iconColor: '#5AC8FA', label: 'Study & learn',sub: 'Quiz and flashcard mode', onPress: () => { onOpenQuiz?.(); onClose(); } },
    { id: 'apps',         icon: 'apps-outline',           iconColor: '#FF9F0A', label: 'Explore apps', sub: 'Chat with apps in Dawinix', onPress: () => { onConnectApp?.(); onClose(); }, chevron: true },
  ];

  // ── SHEET CONTENT ─────────────────────────────────────────────────────────
  const sheetContent = (
    <View style={{ flex: 0 }}>
      {/* Drag Handle */}
      <View style={styles.handleWrap}>
        <View style={[styles.handle, { backgroundColor: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.2)' }]} />
      </View>

      {/* Header row */}
      <View style={styles.headerRow}>
        <Text style={[styles.headerTitle, { color: textPrimary }]}>Dawinix</Text>
        <TouchableOpacity onPress={handleAllPhotos} disabled={loading === 'allphotos'} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          {loading === 'allphotos'
            ? <ActivityIndicator size="small" color={accentBlue} />
            : <Text style={[styles.allPhotosBtn, { color: accentBlue }]}>All Photos</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: bottomPad }}
      >
        {/* ── Photo Strip ─────────────────────────────────────────────── */}
        {!isGuest ? (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.photoStrip}
            >
              {/* Camera tile */}
              <TouchableOpacity
                style={[styles.cameraTile, { backgroundColor: isDark ? 'rgba(60,60,67,0.5)' : 'rgba(0,0,0,0.07)' }]}
                onPress={handleCamera}
                disabled={!!loading}
                activeOpacity={0.75}
              >
                {loading === 'camera'
                  ? <ActivityIndicator color={isDark ? '#FFF' : '#555'} />
                  : <Ionicons name="camera" size={28} color={isDark ? 'rgba(255,255,255,0.65)' : '#8E8E93'} />}
              </TouchableOpacity>

              {/* Recent photos */}
              {recentPhotos.map((photo) => {
                const order = selectedPhotos.get(photo.uri);
                const isSelected = order !== undefined;
                const isLimitReached = selectedPhotos.size >= photoLimit && !isSelected;

                return (
                  <TouchableOpacity
                    key={photo.id}
                    style={[styles.photoTile, isLimitReached && styles.photoTileBlocked]}
                    onPress={() => !isLimitReached && togglePhoto(photo.uri)}
                    activeOpacity={isLimitReached ? 1 : 0.85}
                    disabled={isLimitReached}
                  >
                    <Image
                      source={{ uri: photo.uri }}
                      style={[StyleSheet.absoluteFill, { borderRadius: 10 }]}
                      contentFit="cover"
                      transition={100}
                    />
                    {/* Dim overlay when limit reached and not selected */}
                    {isLimitReached && (
                      <View style={styles.photoBlockOverlay} />
                    )}
                    {/* Selection badge / circle */}
                    <View style={[
                      styles.selCircle,
                      isSelected && styles.selCircleActive,
                    ]}>
                      {isSelected
                        ? <Text style={styles.selNumber}>{order}</Text>
                        : null}
                    </View>
                    {/* Blue border when selected */}
                    {isSelected && <View style={styles.selectedBorder} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Divider */}
            <View style={[styles.divider, { backgroundColor: dividerColor }]} />
          </>
        ) : null}

        {/* ── Tool List ───────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 0 }}>
          {toolItems.map((tool, i) => (
            <TouchableOpacity
              key={tool.id}
              style={[
                styles.toolRow,
                i < toolItems.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: dividerColor },
              ]}
              onPress={tool.onPress}
              activeOpacity={0.65}
            >
              {/* Icon */}
              <View style={[styles.toolIconWrap, { backgroundColor: (tool.iconColor || '#888') + '1A' }]}>
                <Ionicons name={tool.icon as any} size={22} color={tool.iconColor || textPrimary} />
              </View>
              {/* Text */}
              <View style={styles.toolTextWrap}>
                <Text style={[styles.toolLabel, { color: textPrimary }]}>{tool.label}</Text>
                <Text style={[styles.toolSub, { color: textSecondary }]} numberOfLines={1}>{tool.sub}</Text>
              </View>
              {(tool as any).chevron
                ? <Ionicons name="chevron-forward" size={16} color={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)'} />
                : null}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* ── "Add N photos" CTA ─────────────────────────────────────────── */}
      {hasSelectedPhotos && (
        <View style={[styles.addPhotosBtnWrap, { paddingBottom: bottomPad }]}>
          <TouchableOpacity
            style={[styles.addPhotosBtn, { backgroundColor: isDark ? '#FFFFFF' : '#000000' }]}
            onPress={handleAddPhotos}
            disabled={loading === 'photos_send'}
            activeOpacity={0.88}
          >
            {loading === 'photos_send'
              ? <ActivityIndicator color={isDark ? '#000' : '#FFF'} />
              : <Text style={[styles.addPhotosBtnText, { color: isDark ? '#000000' : '#FFFFFF' }]}>
                  Add {selectedCount} photo{selectedCount !== 1 ? 's' : ''}
                </Text>}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        {/* Backdrop — semi-transparent, tap to close */}
        <Animated.View style={[StyleSheet.absoluteFill, backdropOpacity]}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={onClose} />
        </Animated.View>

        {/* Bottom sheet — BLUR is on the sheet itself, not the backdrop */}
        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.sheetOuter, modalStyle]}>
            {Platform.OS === 'ios' ? (
              <BlurView
                intensity={isDark ? 82 : 75}
                tint={isDark ? 'dark' : 'extraLight'}
                style={styles.sheetBlur}
                experimentalBlurMethod="dimezisBlurView"
              >
                {sheetContent}
              </BlurView>
            ) : (
              <View style={[styles.sheetBlur, { backgroundColor: isDark ? 'rgba(22,22,24,0.97)' : 'rgba(248,248,250,0.98)' }]}>
                {sheetContent}
              </View>
            )}
          </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
}

const TILE_SIZE = 82;

const styles = StyleSheet.create({
  sheetOuter: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 28,
  },
  sheetBlur: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },

  handleWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 2 },
  handle: { width: 36, height: 5, borderRadius: 3 },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  allPhotosBtn: { fontSize: 15, fontWeight: '500' },

  // Photo strip
  photoStrip: {
    paddingHorizontal: 14,
    gap: 8,
    paddingBottom: 14,
  },
  cameraTile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoTile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  photoTileBlocked: {
    opacity: 0.35,
  },
  photoBlockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 10,
  },
  selectedBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 10,
    borderWidth: 2.5,
    borderColor: '#007AFF',
  },
  selCircle: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.9)',
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selCircleActive: {
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderColor: '#FFF',
  },
  selNumber: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 14,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    marginBottom: 4,
  },

  // Tool rows
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 14,
  },
  toolIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolTextWrap: { flex: 1 },
  toolLabel: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  toolSub: { fontSize: 13, lineHeight: 17 },

  // Add photos CTA
  addPhotosBtnWrap: {
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.15)',
  },
  addPhotosBtn: {
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotosBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
