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
  useAnimatedReaction,
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

// Photo limits per plan
const PRO_PHOTO_LIMIT = 6;   // per session
const FREE_PHOTO_LIMIT = 3;  // per selection (20h block)

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
  onWebSearch?: () => void;
  onThinkingMode?: () => void;
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
  onWebSearch,
  onThinkingMode,
}: ToolsModalProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const { tier } = useSubscription();
  const { user } = useAuth();

  const isAdmin = user?.email ? ADMIN_EMAILS.includes(user.email.toLowerCase()) : false;
  const isPro = isAdmin || tier === 'plus' || tier === 'go';
  const isGuest = !user;

  const [loading, setLoading] = useState<string | null>(null);
  const [rendered, setRendered] = useState(false);
  const [recentPhotos, setRecentPhotos] = useState<RecentPhoto[]>([]);
  const [selectedPhotos, setSelectedPhotos] = useState<Map<string, number>>(new Map());
  const selectionCounter = useRef(0);

  const translateY = useSharedValue(SCREEN_HEIGHT);
  const opacity = useSharedValue(0);
  const backdropProgress = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      selectionCounter.current = 0;
      setSelectedPhotos(new Map());
      translateY.value = withSpring(0, { damping: 26, stiffness: 300, mass: 0.8 });
      opacity.value = withTiming(1, { duration: 220 });
      backdropProgress.value = withTiming(1, { duration: 280 });
      if (!isPro) loadRecentPhotos();
    } else {
      translateY.value = withSpring(SCREEN_HEIGHT, { damping: 26, stiffness: 300 });
      opacity.value = withTiming(0, { duration: 180 });
      backdropProgress.value = withTiming(0, { duration: 200 });
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

  const togglePhoto = useCallback((uri: string, limit: number) => {
    setSelectedPhotos(prev => {
      const next = new Map(prev);
      if (next.has(uri)) {
        next.delete(uri);
        const entries = Array.from(next.entries()).sort((a, b) => a[1] - b[1]);
        next.clear();
        entries.forEach(([u], i) => next.set(u, i + 1));
        selectionCounter.current = next.size;
      } else {
        if (next.size >= limit) return prev;
        selectionCounter.current += 1;
        next.set(uri, selectionCounter.current);
      }
      return next;
    });
  }, []);

  const handleAddPhotos = async (limit: number) => {
    if (selectedPhotos.size === 0) return;
    setLoading('photos_send');
    try {
      const ordered = Array.from(selectedPhotos.entries()).sort((a, b) => a[1] - b[1]);
      const medias = ordered.map(([uri]) => ({ type: 'image' as const, uri, mimeType: 'image/jpeg' }));
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
    opacity: interpolate(backdropProgress.value, [0, 1], [0, 1], Extrapolate.CLAMP),
  }));

  // Swipe gesture — supports both up and down with spring physics
  const pan = Gesture.Pan()
    .onUpdate((e) => {
      // Allow both directions but with resistance for upward swipe
      if (e.translationY > 0) {
        translateY.value = e.translationY;
      } else if (e.translationY < 0) {
        // Upward swipe with slight resistance (rubber band effect)
        translateY.value = e.translationY * 0.35;
      }
    })
    .onEnd((e) => {
      if (e.translationY > 100 || e.velocityY > 500) {
        runOnJS(onClose)();
      } else if (e.translationY < -80 || e.velocityY < -600) {
        // Swipe up to expand — snap to top with spring
        translateY.value = withSpring(0, { damping: 22, stiffness: 380, mass: 0.7 });
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

  const handleAllPhotos = async (limit = 5) => {
    setLoading('allphotos');
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission required', 'Photo library permission is required.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsMultipleSelection: true,
        quality: 0.85,
        base64: true,
        selectionLimit: limit,
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

  const sharedProps = {
    visible, onClose, isDark, insets,
    loading, pan, modalStyle, backdropOpacity,
    onDeepResearch, onConnectApp, onWebSearch, onThinkingMode, onSelectTool,
  };

  if (isPro) {
    return (
      <ProToolsModal
        {...sharedProps}
        onPickMedia={onPickMedia}
        onSelectTool={onSelectTool}
        onOpenCamera={onOpenCamera}
        onOpenQuiz={onOpenQuiz}
        onOpenPresets={onOpenPresets}
        handleCamera={handleCamera}
        handleAllPhotos={() => handleAllPhotos(PRO_PHOTO_LIMIT)}
        handleFiles={handleFiles}
        router={router}
      />
    );
  }

  const photoProps = {
    recentPhotos,
    selectedPhotos,
    togglePhoto: (uri: string) => togglePhoto(uri, FREE_PHOTO_LIMIT),
    handleAllPhotos: () => handleAllPhotos(FREE_PHOTO_LIMIT),
    handleCamera,
    handleAddPhotos: () => handleAddPhotos(FREE_PHOTO_LIMIT),
    photoLimit: FREE_PHOTO_LIMIT,
    handleFiles,
  };

  if (isGuest) {
    return <GuestToolsModal {...sharedProps} {...photoProps} />;
  }

  return <FreeToolsModal {...sharedProps} {...photoProps} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// PRO / PLUS MODAL — 3-column icon grid
// ─────────────────────────────────────────────────────────────────────────────
function ProToolsModal({
  visible, onClose, onPickMedia, onSelectTool, onOpenCamera, onOpenQuiz,
  onOpenPresets, onDeepResearch, onConnectApp, onWebSearch, onThinkingMode, isDark, insets,
  handleCamera, handleAllPhotos, handleFiles, loading, pan, modalStyle, backdropOpacity, router,
}: any) {
  const textPrimary = isDark ? '#FFFFFF' : '#000000';
  const textSecondary = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)';
  const dividerColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  const tileBg = isDark ? 'rgba(44,44,48,0.92)' : 'rgba(255,255,255,0.96)';
  const listCardBg = isDark ? 'rgba(44,44,48,0.92)' : 'rgba(255,255,255,0.96)';
  const bottomPad = Math.max(insets.bottom, 16);

  const gridTools = [
    { id: 'camera', icon: 'camera-outline', label: 'Camera', onPress: () => { handleCamera(); } },
    { id: 'photos', icon: 'image-outline', label: 'Photos', onPress: () => { handleAllPhotos(); } },
    { id: 'files', icon: 'arrow-up-circle-outline', label: 'Files', onPress: () => { handleFiles(); } },
    { id: 'quiz', icon: 'albums-outline', label: 'Quizzes', onPress: () => { onOpenQuiz?.(); onClose(); } },
    { id: 'voice', icon: 'call-outline', label: 'Call', onPress: () => { router.push('/voice-control'); onClose(); } },
    { id: 'presets', icon: 'cube-outline', label: 'Presets', onPress: () => { onOpenPresets?.(); onClose(); } },
    { id: 'research', icon: 'search-outline', label: 'Research', onPress: () => { onDeepResearch?.(); } },
  ];

  const listTools = [
    { id: 'connect', icon: 'apps-outline', label: 'Connect with App', badge: null, onPress: () => { onConnectApp?.(); onClose(); } },
  ];

  const HPADDING = 16;
  const GAP = 8;
  const tileW = (SCREEN_WIDTH - HPADDING * 2 - GAP * 2) / 3;
  const tileH = tileW * 0.82;

  const sheetContent = (
    <View>
      <View style={s.handleWrap}>
        <View style={[s.handle, { backgroundColor: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.18)' }]} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} bounces={false}
        contentContainerStyle={{ paddingHorizontal: HPADDING, paddingBottom: bottomPad, paddingTop: 8 }}>
        <View style={pro.grid}>
          {gridTools.map((tool) => (
            <TouchableOpacity key={tool.id}
              style={[pro.tile, { width: tileW, height: tileH, backgroundColor: tileBg }]}
              onPress={tool.onPress} activeOpacity={0.72}>
              {loading === tool.id
                ? <ActivityIndicator color={textPrimary} />
                : <Ionicons name={tool.icon as any} size={26} color={textPrimary} />}
              <Text style={[pro.tileLabel, { color: textPrimary }]}>{tool.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={[pro.listCard, { backgroundColor: listCardBg, marginTop: 12 }]}>
          {listTools.map((tool, i) => (
            <TouchableOpacity key={tool.id}
              style={[pro.listRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: dividerColor }]}
              onPress={tool.onPress} activeOpacity={0.7}>
              <View style={[pro.listIconWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }]}>
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
        {/* Blur backdrop */}
        <Animated.View style={[StyleSheet.absoluteFill, backdropOpacity]}>
          {Platform.OS === 'ios' ? (
            <BlurView
              intensity={isDark ? 45 : 35}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            >
              <Pressable style={{ flex: 1 }} onPress={onClose} />
            </BlurView>
          ) : (
            <Pressable
              style={{ flex: 1, backgroundColor: isDark ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.42)' }}
              onPress={onClose}
            />
          )}
        </Animated.View>
        <GestureDetector gesture={pan}>
          <Animated.View style={[s.sheetOuter, modalStyle]}>
            {Platform.OS === 'ios' ? (
              <BlurView intensity={isDark ? 85 : 78} tint={isDark ? 'dark' : 'extraLight'} style={s.sheetBlur}>
                {sheetContent}
              </BlurView>
            ) : (
              <View style={[s.sheetBlur, { backgroundColor: isDark ? 'rgba(22,22,24,0.98)' : 'rgba(242,242,244,0.99)' }]}>
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
// FREE PLAN MODAL — photo strip + tool list
// ─────────────────────────────────────────────────────────────────────────────
function FreeToolsModal({
  visible, onClose, onSelectTool, onDeepResearch, onConnectApp, onWebSearch, onThinkingMode, isDark, insets,
  handleFiles, loading, pan, modalStyle, backdropOpacity,
  recentPhotos, selectedPhotos, togglePhoto, handleAllPhotos, handleCamera, handleAddPhotos, photoLimit,
}: any) {
  const textPrimary = isDark ? '#FFFFFF' : '#000000';
  const textSecondary = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';
  const dividerColor = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.07)';
  const accentBlue = '#007AFF';
  const bottomPad = Math.max(insets.bottom, 16);
  const selectedCount = selectedPhotos.size;

  const toolItems = [
    { id: 'create-image', icon: 'color-palette-outline', iconColor: '#FF6B6B', label: 'Create image', sub: 'Visualize anything', onPress: () => { onSelectTool?.('create-image'); onClose(); } },
    { id: 'thinking', icon: 'bulb-outline', iconColor: '#FFD60A', label: 'Thinking', sub: 'Think longer for better answers', onPress: () => { onThinkingMode?.(); } },
    { id: 'deep-research', icon: 'search-outline', iconColor: '#5AC8FA', label: 'Deep research', sub: 'Get a detailed report', onPress: () => { onDeepResearch?.(); } },
    { id: 'web-search', icon: 'globe-outline', iconColor: '#007AFF', label: 'Web search', sub: 'Find real-time news and info', onPress: () => { onWebSearch?.(); } },
    { id: 'add-files', icon: 'attach-outline', iconColor: '#8E8E93', label: 'Add files', sub: 'Analyze or summarize', onPress: () => { handleFiles(); } },
    { id: 'spotify', icon: 'logo-spotify', iconColor: '#1DB954', label: 'Spotify', sub: 'Explore music and podcasts', onPress: () => { onConnectApp?.(); onClose(); } },
    { id: 'apps', icon: 'apps-outline', iconColor: '#007AFF', label: 'Explore apps', sub: 'Chat with apps in Dawinix', onPress: () => { onConnectApp?.(); onClose(); }, chevron: true },
  ];

  const sheetContent = (
    <View>
      <View style={s.handleWrap}>
        <View style={[s.handle, { backgroundColor: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.18)' }]} />
      </View>
      <View style={s.headerRow}>
        <Text style={[s.headerTitle, { color: textPrimary }]}>Dawinix</Text>
        <TouchableOpacity onPress={handleAllPhotos} disabled={loading === 'allphotos'} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          {loading === 'allphotos'
            ? <ActivityIndicator size="small" color={accentBlue} />
            : <Text style={[s.allPhotosBtn, { color: accentBlue }]}>All Photos</Text>}
        </TouchableOpacity>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} bounces={false} keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: selectedCount > 0 ? 68 : 8 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.photoStrip}>
          <TouchableOpacity style={[s.cameraTile, { backgroundColor: isDark ? 'rgba(60,60,67,0.5)' : 'rgba(0,0,0,0.07)' }]}
            onPress={handleCamera} disabled={!!loading} activeOpacity={0.75}>
            {loading === 'camera' ? <ActivityIndicator color={isDark ? '#FFF' : '#555'} /> : <Ionicons name="camera" size={26} color={isDark ? 'rgba(255,255,255,0.6)' : '#8E8E93'} />}
          </TouchableOpacity>
          {recentPhotos.map((photo: RecentPhoto) => {
            const order = selectedPhotos.get(photo.uri);
            const isSelected = order !== undefined;
            const isLimitReached = selectedPhotos.size >= photoLimit && !isSelected;
            return (
              <TouchableOpacity key={photo.id} style={[s.photoTile, isLimitReached && s.photoTileBlocked]}
                onPress={() => !isLimitReached && togglePhoto(photo.uri)} activeOpacity={isLimitReached ? 1 : 0.85} disabled={isLimitReached}>
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
        <View style={[s.toolListCard, { backgroundColor: isDark ? 'rgba(44,44,48,0.7)' : 'rgba(255,255,255,0.85)', marginHorizontal: 12, marginBottom: 8 }]}>
          {toolItems.map((tool, i) => (
            <TouchableOpacity key={tool.id}
              style={[s.toolRow, i < toolItems.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: dividerColor }]}
              onPress={tool.onPress} activeOpacity={0.65}>
              <View style={[s.toolIconWrap, { backgroundColor: (tool.iconColor || '#888') + '1A' }]}>
                <Ionicons name={tool.icon as any} size={20} color={tool.iconColor || textPrimary} />
              </View>
              <View style={s.toolTextWrap}>
                <Text style={[s.toolLabel, { color: textPrimary }]}>{tool.label}</Text>
                <Text style={[s.toolSub, { color: textSecondary }]} numberOfLines={1}>{tool.sub}</Text>
              </View>
              {(tool as any).chevron ? <Ionicons name="chevron-forward" size={16} color={isDark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.22)'} /> : null}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      {selectedCount > 0 && (
        <View style={[s.addPhotosBtnWrap, { paddingBottom: bottomPad, borderTopColor: dividerColor }]}>
          <TouchableOpacity style={[s.addPhotosBtn, { backgroundColor: isDark ? '#FFFFFF' : '#000000' }]}
            onPress={handleAddPhotos} disabled={loading === 'photos_send'} activeOpacity={0.88}>
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
        {/* Blur backdrop */}
        <Animated.View style={[StyleSheet.absoluteFill, backdropOpacity]}>
          {Platform.OS === 'ios' ? (
            <BlurView
              intensity={isDark ? 45 : 35}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            >
              <Pressable style={{ flex: 1 }} onPress={onClose} />
            </BlurView>
          ) : (
            <Pressable
              style={{ flex: 1, backgroundColor: isDark ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.42)' }}
              onPress={onClose}
            />
          )}
        </Animated.View>
        <GestureDetector gesture={pan}>
          <Animated.View style={[s.sheetOuter, modalStyle]}>
            {Platform.OS === 'ios' ? (
              <BlurView intensity={isDark ? 82 : 75} tint={isDark ? 'dark' : 'extraLight'} style={s.sheetBlur}>
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
// GUEST MODAL — photo strip + limited tools
// ─────────────────────────────────────────────────────────────────────────────
function GuestToolsModal({
  visible, onClose, onSelectTool, onDeepResearch, onConnectApp, onWebSearch, onThinkingMode, isDark, insets,
  handleFiles, loading, pan, modalStyle, backdropOpacity,
  recentPhotos, selectedPhotos, togglePhoto, handleAllPhotos, handleCamera, handleAddPhotos, photoLimit,
}: any) {
  const textPrimary = isDark ? '#FFFFFF' : '#000000';
  const textSecondary = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';
  const dividerColor = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.07)';
  const accentBlue = '#007AFF';
  const bottomPad = Math.max(insets.bottom, 16);
  const selectedCount = selectedPhotos.size;

  const toolItems = [
    { id: 'create-image', icon: 'color-palette-outline', iconColor: '#FF6B6B', label: 'Create image', sub: 'Visualize anything', onPress: () => { onSelectTool?.('create-image'); onClose(); } },
    { id: 'web-search', icon: 'globe-outline', iconColor: '#007AFF', label: 'Web Search', sub: 'Find real-time news and info', onPress: () => { onWebSearch?.(); } },
    { id: 'deep-research', icon: 'search-outline', iconColor: '#5AC8FA', label: 'Deep research', sub: 'Get a detailed report', onPress: () => { onDeepResearch?.(); } },
    { id: 'thinking', icon: 'bulb-outline', iconColor: '#FFD60A', label: 'Thinking', sub: 'Think longer for better answers', onPress: () => { onThinkingMode?.(); } },
    { id: 'add-files', icon: 'attach-outline', iconColor: '#8E8E93', label: 'Add files', sub: 'Analyze or summarize', onPress: () => { handleFiles(); } },
  ];

  const sheetContent = (
    <View>
      <View style={s.handleWrap}>
        <View style={[s.handle, { backgroundColor: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.18)' }]} />
      </View>
      <View style={s.headerRow}>
        <Text style={[s.headerTitle, { color: textPrimary }]}>Dawinix</Text>
        <TouchableOpacity onPress={handleAllPhotos} disabled={loading === 'allphotos'} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          {loading === 'allphotos'
            ? <ActivityIndicator size="small" color={accentBlue} />
            : <Text style={[s.allPhotosBtn, { color: accentBlue }]}>All Photos</Text>}
        </TouchableOpacity>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} bounces={false} keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: selectedCount > 0 ? 68 : 8 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.photoStrip}>
          <TouchableOpacity style={[s.cameraTile, { backgroundColor: isDark ? 'rgba(60,60,67,0.5)' : 'rgba(0,0,0,0.07)' }]}
            onPress={handleCamera} disabled={!!loading} activeOpacity={0.75}>
            {loading === 'camera' ? <ActivityIndicator color={isDark ? '#FFF' : '#555'} /> : <Ionicons name="camera" size={26} color={isDark ? 'rgba(255,255,255,0.6)' : '#8E8E93'} />}
          </TouchableOpacity>
          {recentPhotos.map((photo: RecentPhoto) => {
            const order = selectedPhotos.get(photo.uri);
            const isSelected = order !== undefined;
            const isLimitReached = selectedPhotos.size >= photoLimit && !isSelected;
            return (
              <TouchableOpacity key={photo.id} style={[s.photoTile, isLimitReached && s.photoTileBlocked]}
                onPress={() => !isLimitReached && togglePhoto(photo.uri)} activeOpacity={isLimitReached ? 1 : 0.85} disabled={isLimitReached}>
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
        <View style={[s.toolListCard, { backgroundColor: isDark ? 'rgba(44,44,48,0.7)' : 'rgba(255,255,255,0.85)', marginHorizontal: 12, marginBottom: 8 }]}>
          {toolItems.map((tool, i) => (
            <TouchableOpacity key={tool.id}
              style={[s.toolRow, i < toolItems.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: dividerColor }]}
              onPress={tool.onPress} activeOpacity={0.65}>
              <View style={[s.toolIconWrap, { backgroundColor: (tool.iconColor || '#888') + '1A' }]}>
                <Ionicons name={tool.icon as any} size={20} color={tool.iconColor || textPrimary} />
              </View>
              <View style={s.toolTextWrap}>
                <Text style={[s.toolLabel, { color: textPrimary }]}>{tool.label}</Text>
                <Text style={[s.toolSub, { color: textSecondary }]} numberOfLines={1}>{tool.sub}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      {selectedCount > 0 && (
        <View style={[s.addPhotosBtnWrap, { paddingBottom: bottomPad, borderTopColor: dividerColor }]}>
          <TouchableOpacity style={[s.addPhotosBtn, { backgroundColor: isDark ? '#FFFFFF' : '#000000' }]}
            onPress={handleAddPhotos} disabled={loading === 'photos_send'} activeOpacity={0.88}>
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
        {/* Blur backdrop */}
        <Animated.View style={[StyleSheet.absoluteFill, backdropOpacity]}>
          {Platform.OS === 'ios' ? (
            <BlurView
              intensity={isDark ? 45 : 35}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            >
              <Pressable style={{ flex: 1 }} onPress={onClose} />
            </BlurView>
          ) : (
            <Pressable
              style={{ flex: 1, backgroundColor: isDark ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.42)' }}
              onPress={onClose}
            />
          )}
        </Animated.View>
        <GestureDetector gesture={pan}>
          <Animated.View style={[s.sheetOuter, modalStyle]}>
            {Platform.OS === 'ios' ? (
              <BlurView intensity={isDark ? 82 : 75} tint={isDark ? 'dark' : 'extraLight'} style={s.sheetBlur}>
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
// SHARED STYLES
// ─────────────────────────────────────────────────────────────────────────────
const TILE_SIZE = 70;

const s = StyleSheet.create({
  sheetOuter: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.22, shadowRadius: 22, elevation: 26,
  },
  sheetBlur: { borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
  handleWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 0 },
  handle: { width: 36, height: 5, borderRadius: 3 },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8,
  },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  allPhotosBtn: { fontSize: 15, fontWeight: '500' },
  photoStrip: { paddingHorizontal: 14, gap: 7, paddingBottom: 10 },
  cameraTile: { width: TILE_SIZE, height: TILE_SIZE, borderRadius: 10, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photoTile: { width: TILE_SIZE, height: TILE_SIZE, borderRadius: 10, overflow: 'hidden', position: 'relative' },
  photoTileBlocked: { opacity: 0.3 },
  photoBlockOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.28)', borderRadius: 10 },
  selectedBorder: { ...StyleSheet.absoluteFillObject, borderRadius: 10, borderWidth: 2.5, borderColor: '#007AFF' },
  selCircle: {
    position: 'absolute', top: 5, right: 5, width: 22, height: 22, borderRadius: 11,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.9)', backgroundColor: 'rgba(0,0,0,0.22)',
    alignItems: 'center', justifyContent: 'center',
  },
  selCircleActive: { backgroundColor: 'rgba(0,0,0,0.72)', borderColor: '#FFF' },
  selNumber: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', lineHeight: 14 },
  divider: { height: StyleSheet.hairlineWidth, marginBottom: 2, marginHorizontal: 0 },
  toolListCard: { borderRadius: 16, overflow: 'hidden' },
  toolRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 7, gap: 12 },
  toolIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  toolTextWrap: { flex: 1 },
  toolLabel: { fontSize: 15, fontWeight: '600', marginBottom: 1 },
  toolSub: { fontSize: 12, lineHeight: 15 },
  addPhotosBtnWrap: { paddingHorizontal: 16, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  addPhotosBtn: { borderRadius: 50, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  addPhotosBtnText: { fontSize: 16, fontWeight: '700' },
});

const pro = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  tileLabel: { fontSize: 13, fontWeight: '500' },
  listCard: { borderRadius: 18, overflow: 'hidden' },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 15, gap: 14 },
  listIconWrap: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  listLabel: { flex: 1, fontSize: 16, fontWeight: '500' },
  badge: { fontSize: 14 },
});