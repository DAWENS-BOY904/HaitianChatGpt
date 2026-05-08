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
const PRO_PHOTO_LIMIT = 6;   // per session
const FREE_PHOTO_LIMIT = 3;  // per selection

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
      if (!isPro) loadRecentPhotos();
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
        next.delete(uri);
        const entries = Array.from(next.entries()).sort((a, b) => a[1] - b[1]);
        next.clear();
        entries.forEach(([u], i) => next.set(u, i + 1));
        selectionCounter.current = next.size;
      } else {
        if (next.size >= photoLimit) return prev;
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
      if (e.translationY > 0) translateY.value = e.translationY;
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
      if (status !== 'granted') { Alert.alert('Permission required', 'Camera permission is required.'); return; }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 0.85, base64: true });
      if (!result.canceled && result.assets[0]) {
        const isVideo = result.assets[0].mimeType?.startsWith('video/');
        onPickMedia([{ type: isVideo ? 'video' : 'image', uri: result.assets[0].uri, base64: result.assets[0].base64, mimeType: result.assets[0].mimeType || 'image/jpeg' }]);
        onClose();
      }
    } catch (_e) {}
    finally { setLoading(null); }
  };

  const handleAllPhotos = async () => {
    setLoading('allphotos');
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission required', 'Photo library permission is required.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsMultipleSelection: true,
        quality: 0.85,
        base64: true,
        selectionLimit: photoLimit,
      });
      if (!result.canceled && result.assets.length > 0) {
        onPickMedia(result.assets.map(a => ({ type: a.mimeType?.startsWith('video/') ? 'video' : 'image', uri: a.uri, base64: a.base64, mimeType: a.mimeType || 'image/jpeg', name: a.fileName })));
        onClose();
      }
    } catch (_e) {}
    finally { setLoading(null); }
  };

  const handleFiles = async () => {
    setLoading('files');
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: true });
      if (!result.canceled && result.assets?.length > 0) {
        const medias = result.assets.map(asset => {
          const mime = (asset.mimeType || 'application/octet-stream').toLowerCase();
          const isImg = mime.startsWith('image/');
          const ext = (asset.name || '').split('.').pop()?.toLowerCase() || '';
          const isVideo = mime.startsWith('video/') || ['mp4','mov','avi','mkv','webm'].includes(ext);
          return { type: isImg ? 'image' : isVideo ? 'video' : 'document', uri: asset.uri, name: asset.name, mimeType: mime, size: asset.size };
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

  // ── Render the correct sheet content based on plan ────────────────────────
  if (isPro) {
    return <ProToolsModal
      visible={visible}
      onClose={onClose}
      onPickMedia={onPickMedia}
      onSelectTool={onSelectTool}
      onOpenCamera={onOpenCamera}
      onOpenQuiz={onOpenQuiz}
      onOpenPresets={onOpenPresets}
      onDeepResearch={onDeepResearch}
      onConnectApp={onConnectApp}
      isDark={isDark}
      insets={insets}
      handleCamera={handleCamera}
      handleAllPhotos={handleAllPhotos}
      handleFiles={handleFiles}
      loading={loading}
      pan={pan}
      modalStyle={modalStyle}
      backdropOpacity={backdropOpacity}
      router={router}
    />;
  }

  // ── FREE / GUEST shared photo strip sheet ─────────────────────────────────
  const textPrimary = isDark ? '#FFFFFF' : '#000000';
  const textSecondary = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)';
  const dividerColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  const accentBlue = '#007AFF';

  // Tool list differs for guest vs free
  const toolItems = isGuest ? [
    { id: 'create-image', icon: 'color-palette-outline', iconColor: '#FF6B6B', label: 'Create image', sub: 'Visualize anything', onPress: () => { onSelectTool?.('create-image'); onClose(); } },
    { id: 'web-search', icon: 'globe-outline', iconColor: '#007AFF', label: 'Web Search', sub: 'Find real-time news and info', onPress: () => { onSelectTool?.('web-search'); onClose(); } },
    { id: 'deep-research', icon: 'search-outline', iconColor: '#5AC8FA', label: 'Deep research', sub: 'Get a detailed report', onPress: () => { onDeepResearch?.(); onClose(); } },
    { id: 'thinking', icon: 'bulb-outline', iconColor: '#FFD60A', label: 'Thinking', sub: 'Think longer for better answers', onPress: () => { onSelectTool?.('thinking'); onClose(); } },
    { id: 'add-files', icon: 'attach-outline', iconColor: '#8E8E93', label: 'Add files', sub: 'Analyze or summarize', onPress: () => { handleFiles(); } },
  ] : [
    // Free plan
    { id: 'create-image', icon: 'color-palette-outline', iconColor: '#FF6B6B', label: 'Create image', sub: 'Visualize anything', onPress: () => { onSelectTool?.('create-image'); onClose(); } },
    { id: 'thinking', icon: 'bulb-outline', iconColor: '#FFD60A', label: 'Thinking', sub: 'Think longer for better answers', onPress: () => { onSelectTool?.('thinking'); onClose(); } },
    { id: 'deep-research', icon: 'search-outline', iconColor: '#5AC8FA', label: 'Deep research', sub: 'Get a detailed report', onPress: () => { onDeepResearch?.(); onClose(); } },
    { id: 'web-search', icon: 'globe-outline', iconColor: '#007AFF', label: 'Web search', sub: 'Find real-time news and info', onPress: () => { onSelectTool?.('web-search'); onClose(); } },
    { id: 'add-files', icon: 'attach-outline', iconColor: '#8E8E93', label: 'Add files', sub: 'Analyze or summarize', onPress: () => { handleFiles(); } },
    { id: 'apple-music', icon: 'musical-notes', iconColor: '#FF2D55', label: 'Apple Music', sub: 'Connect to Apple Music to play songs', onPress: () => { onClose(); } },
    { id: 'spotify', icon: 'logo-spotify', iconColor: '#1DB954', label: 'Spotify', sub: 'Explore music and podcasts', onPress: () => { onConnectApp?.(); onClose(); } },
    { id: 'apps', icon: 'apps-outline', iconColor: '#007AFF', label: 'Explore apps', sub: 'Chat with apps in Dawinix', onPress: () => { onConnectApp?.(); onClose(); }, chevron: true },
  ];

  const sheetContent = (
    <View style={{ flex: 0 }}>
      {/* Drag Handle */}
      <View style={s.handleWrap}>
        <View style={[s.handle, { backgroundColor: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.2)' }]} />
      </View>

      {/* Header */}
      <View style={s.headerRow}>
        <Text style={[s.headerTitle, { color: textPrimary }]}>Dawinix</Text>
        <TouchableOpacity onPress={handleAllPhotos} disabled={loading === 'allphotos'} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          {loading === 'allphotos'
            ? <ActivityIndicator size="small" color={accentBlue} />
            : <Text style={[s.allPhotosBtn, { color: accentBlue }]}>All Photos</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} bounces={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: bottomPad }}>
        {/* Photo Strip — hidden for guest (they can't select photos freely) */}
        {!isGuest ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.photoStrip}>
              <TouchableOpacity
                style={[s.cameraTile, { backgroundColor: isDark ? 'rgba(60,60,67,0.5)' : 'rgba(0,0,0,0.07)' }]}
                onPress={handleCamera} disabled={!!loading} activeOpacity={0.75}
              >
                {loading === 'camera'
                  ? <ActivityIndicator color={isDark ? '#FFF' : '#555'} />
                  : <Ionicons name="camera" size={28} color={isDark ? 'rgba(255,255,255,0.65)' : '#8E8E93'} />}
              </TouchableOpacity>

              {recentPhotos.map((photo) => {
                const order = selectedPhotos.get(photo.uri);
                const isSelected = order !== undefined;
                const isLimitReached = selectedPhotos.size >= photoLimit && !isSelected;
                return (
                  <TouchableOpacity
                    key={photo.id}
                    style={[s.photoTile, isLimitReached && s.photoTileBlocked]}
                    onPress={() => !isLimitReached && togglePhoto(photo.uri)}
                    activeOpacity={isLimitReached ? 1 : 0.85}
                    disabled={isLimitReached}
                  >
                    <Image source={{ uri: photo.uri }} style={[StyleSheet.absoluteFill, { borderRadius: 10 }]} contentFit="cover" transition={100} />
                    {isLimitReached && <View style={s.photoBlockOverlay} />}
                    <View style={[s.selCircle, isSelected && s.selCircleActive]}>
                      {isSelected ? <Text style={s.selNumber}>{order}</Text> : null}
                    </View>
                    {isSelected && <View style={s.selectedBorder} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={[s.divider, { backgroundColor: dividerColor }]} />
          </>
        ) : null}

        {/* Tool list */}
        <View>
          {toolItems.map((tool, i) => (
            <TouchableOpacity
              key={tool.id}
              style={[s.toolRow, i < toolItems.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: dividerColor }]}
              onPress={tool.onPress}
              activeOpacity={0.65}
            >
              <View style={[s.toolIconWrap, { backgroundColor: (tool.iconColor || '#888') + '1A' }]}>
                <Ionicons name={tool.icon as any} size={22} color={tool.iconColor || textPrimary} />
              </View>
              <View style={s.toolTextWrap}>
                <Text style={[s.toolLabel, { color: textPrimary }]}>{tool.label}</Text>
                <Text style={[s.toolSub, { color: textSecondary }]} numberOfLines={1}>{tool.sub}</Text>
              </View>
              {(tool as any).chevron
                ? <Ionicons name="chevron-forward" size={16} color={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)'} />
                : null}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* "Add N photos" CTA */}
      {hasSelectedPhotos && (
        <View style={[s.addPhotosBtnWrap, { paddingBottom: bottomPad }]}>
          <TouchableOpacity
            style={[s.addPhotosBtn, { backgroundColor: isDark ? '#FFFFFF' : '#000000' }]}
            onPress={handleAddPhotos} disabled={loading === 'photos_send'} activeOpacity={0.88}
          >
            {loading === 'photos_send'
              ? <ActivityIndicator color={isDark ? '#000' : '#FFF'} />
              : <Text style={[s.addPhotosBtnText, { color: isDark ? '#000000' : '#FFFFFF' }]}>
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
        <Animated.View style={[StyleSheet.absoluteFill, backdropOpacity]}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={onClose} />
        </Animated.View>
        <GestureDetector gesture={pan}>
          <Animated.View style={[s.sheetOuter, modalStyle]}>
            {Platform.OS === 'ios' ? (
              <BlurView intensity={isDark ? 82 : 75} tint={isDark ? 'dark' : 'extraLight'} style={s.sheetBlur} experimentalBlurMethod="dimezisBlurView">
                {sheetContent}
              </BlurView>
            ) : (
              <View style={[s.sheetBlur, { backgroundColor: isDark ? 'rgba(22,22,24,0.97)' : 'rgba(248,248,250,0.98)' }]}>
                {sheetContent}
              </View>
            )}
          </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PRO / PLUS MODAL — grid layout like Photo 1
// ─────────────────────────────────────────────────────────────────────────────
function ProToolsModal({
  visible, onClose, onPickMedia, onSelectTool, onOpenCamera, onOpenQuiz,
  onOpenPresets, onDeepResearch, onConnectApp, isDark, insets,
  handleCamera, handleAllPhotos, handleFiles, loading, pan, modalStyle, backdropOpacity, router,
}: any) {
  const textPrimary = isDark ? '#FFFFFF' : '#000000';
  const textSecondary = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)';
  const dividerColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  const tileBg = isDark ? 'rgba(44,44,48,0.85)' : 'rgba(255,255,255,0.92)';
  const accentBlue = '#007AFF';
  const bottomPad = Math.max(insets.bottom, 16);

  const gridTools = [
    { id: 'camera', icon: 'camera-outline', label: 'Camera', onPress: () => { handleCamera(); } },
    { id: 'photos', icon: 'images-outline', label: 'Photos', onPress: () => { handleAllPhotos(); } },
    { id: 'files', icon: 'cloud-upload-outline', label: 'Files', onPress: () => { handleFiles(); } },
    { id: 'quiz', icon: 'albums-outline', label: 'Quizzes', onPress: () => { onOpenQuiz?.(); onClose(); } },
    { id: 'voice', icon: 'call-outline', label: 'Call', onPress: () => { router.push('/voice-control'); onClose(); } },
    { id: 'presets', icon: 'cube-outline', label: 'Presets', onPress: () => { onOpenPresets?.(); onClose(); } },
    { id: 'research', icon: 'search-outline', label: 'Research', onPress: () => { onDeepResearch?.(); onClose(); } },
  ];

  const listTools = [
    {
      id: 'web-search', icon: 'globe-outline', iconBg: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
      label: 'Web search', badge: 'Auto', chevron: true,
      onPress: () => { onSelectTool?.('web-search'); onClose(); },
    },
    {
      id: 'connect', icon: 'apps-outline', iconBg: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
      label: 'Connect with App', badge: null, chevron: true,
      onPress: () => { onConnectApp?.(); onClose(); },
    },
  ];

  const tileSize = (SCREEN_WIDTH - 32 - 16) / 3;

  const sheetContent = (
    <View style={{ flex: 0 }}>
      <View style={s.handleWrap}>
        <View style={[s.handle, { backgroundColor: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.2)' }]} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} bounces={false} contentContainerStyle={{ paddingBottom: bottomPad, paddingHorizontal: 16 }}>
        {/* Grid */}
        <View style={pro.grid}>
          {gridTools.map((tool) => (
            <TouchableOpacity
              key={tool.id}
              style={[pro.tile, { width: tileSize, height: tileSize * 0.85, backgroundColor: tileBg }]}
              onPress={tool.onPress}
              activeOpacity={0.75}
            >
              {loading === tool.id
                ? <ActivityIndicator color={textPrimary} />
                : <Ionicons name={tool.icon as any} size={28} color={textPrimary} />}
              <Text style={[pro.tileLabel, { color: textPrimary }]}>{tool.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Divider */}
        <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: dividerColor, marginVertical: 14 }]} />

        {/* List rows */}
        <View style={[pro.listCard, { backgroundColor: tileBg }]}>
          {listTools.map((tool, i) => (
            <TouchableOpacity
              key={tool.id}
              style={[pro.listRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: dividerColor }]}
              onPress={tool.onPress}
              activeOpacity={0.7}
            >
              <View style={[pro.listIconWrap, { backgroundColor: tool.iconBg }]}>
                <Ionicons name={tool.icon as any} size={20} color={textPrimary} />
              </View>
              <Text style={[pro.listLabel, { color: textPrimary }]}>{tool.label}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {tool.badge ? <Text style={[pro.badge, { color: textSecondary }]}>{tool.badge}</Text> : null}
                <Ionicons name="chevron-forward" size={16} color={textSecondary} />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View style={[StyleSheet.absoluteFill, backdropOpacity]}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} onPress={onClose} />
        </Animated.View>
        <GestureDetector gesture={pan}>
          <Animated.View style={[s.sheetOuter, modalStyle]}>
            {Platform.OS === 'ios' ? (
              <BlurView intensity={isDark ? 85 : 78} tint={isDark ? 'dark' : 'extraLight'} style={s.sheetBlur} experimentalBlurMethod="dimezisBlurView">
                {sheetContent}
              </BlurView>
            ) : (
              <View style={[s.sheetBlur, { backgroundColor: isDark ? 'rgba(22,22,24,0.97)' : 'rgba(242,242,244,0.98)' }]}>
                {sheetContent}
              </View>
            )}
          </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED STYLES
// ─────────────────────────────────────────────────────────────────────────────
const TILE_SIZE = 82;

const s = StyleSheet.create({
  sheetOuter: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.25, shadowRadius: 24, elevation: 28,
  },
  sheetBlur: { borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
  handleWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 2 },
  handle: { width: 36, height: 5, borderRadius: 3 },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12,
  },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  allPhotosBtn: { fontSize: 15, fontWeight: '500' },
  photoStrip: { paddingHorizontal: 14, gap: 8, paddingBottom: 14 },
  cameraTile: { width: TILE_SIZE, height: TILE_SIZE, borderRadius: 10, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photoTile: { width: TILE_SIZE, height: TILE_SIZE, borderRadius: 10, overflow: 'hidden', position: 'relative' },
  photoTileBlocked: { opacity: 0.35 },
  photoBlockOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 10 },
  selectedBorder: { ...StyleSheet.absoluteFillObject, borderRadius: 10, borderWidth: 2.5, borderColor: '#007AFF' },
  selCircle: {
    position: 'absolute', top: 5, right: 5, width: 22, height: 22, borderRadius: 11,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.9)', backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  selCircleActive: { backgroundColor: 'rgba(0,0,0,0.75)', borderColor: '#FFF' },
  selNumber: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', lineHeight: 14 },
  divider: { height: StyleSheet.hairlineWidth, marginBottom: 4 },
  toolRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 14 },
  toolIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  toolTextWrap: { flex: 1 },
  toolLabel: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  toolSub: { fontSize: 13, lineHeight: 17 },
  addPhotosBtnWrap: { paddingHorizontal: 16, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(128,128,128,0.15)' },
  addPhotosBtn: { borderRadius: 50, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  addPhotosBtnText: { fontSize: 16, fontWeight: '700' },
});

const pro = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 4 },
  tile: {
    borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  tileLabel: { fontSize: 13, fontWeight: '500' },
  listCard: { borderRadius: 18, overflow: 'hidden' },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, gap: 14 },
  listIconWrap: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  listLabel: { flex: 1, fontSize: 16, fontWeight: '500' },
  badge: { fontSize: 14 },
});
