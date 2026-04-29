im fucking tell you no zip allowed no .12 allowed allow video upload ai can read video. import React, { useState, useCallback } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeInUp,
  runOnJS,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useTheme } from '../hooks/useTheme';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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
}

const THEME = {
  bg: '#F2F2F7',
  surface: '#FFFFFF',
  border: '#E5E5EA',
  text: '#1C1C1E',
  sub: '#8E8E93',
  accent: '#007AFF',
};

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
}: ToolsModalProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const [showWebOptions, setShowWebOptions] = useState(false);
  const [webMode, setWebMode] = useState<'auto' | 'off'>('auto');
  const [loading, setLoading] = useState<string | null>(null);
  const [rendered, setRendered] = useState(false);
  const [selectedFilePreview, setSelectedFilePreview] = useState<{
    name: string;
    size: number;
    mimeType: string;
    uri: string;
    isImage: boolean;
  } | null>(null);

  const translateY = useSharedValue(SCREEN_HEIGHT);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      translateY.value = withSpring(0, { damping: 26, stiffness: 300, mass: 0.8 });
      opacity.value = withTiming(1, { duration: 240 });
    } else {
      translateY.value = withSpring(SCREEN_HEIGHT, { damping: 26, stiffness: 300 });
      opacity.value = withTiming(0, { duration: 180 });
      const t = setTimeout(() => { setRendered(false); setShowWebOptions(false); setSelectedFilePreview(null); }, 280);
      return () => clearTimeout(t);
    }
  }, [visible]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (visible) { onClose(); return true; }
      return false;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  const modalStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(opacity.value, [0, 1], [0, 1], Extrapolate.CLAMP),
  }));

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationY > 0) {
        translateY.value = e.translationY;
        opacity.value = 1 - e.translationY / (SCREEN_HEIGHT * 0.5);
      }
    })
    .onEnd((e) => {
      if (e.translationY > 100 || e.velocityY > 500) {
        runOnJS(onClose)();
      } else {
        translateY.value = withSpring(0, { damping: 26, stiffness: 300 });
        opacity.value = withTiming(1, { duration: 200 });
      }
    });

  // ── REAL CAMERA ──────────────────────────────────────────────────────────
  const handleCamera = async () => {
    setLoading('camera');
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { alert('Camera permission is required.'); return; }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        base64: true,
      });
      if (!result.canceled && result.assets[0]) {
        onPickMedia([{ type: 'image', uri: result.assets[0].uri, base64: result.assets[0].base64, mimeType: 'image/jpeg' }]);
        onClose();
      }
    } catch (e) { console.error('Camera error:', e); }
    finally { setLoading(null); }
  };

  // ── REAL PHOTOS ──────────────────────────────────────────────────────────
  const handlePhotos = async () => {
    setLoading('photos');
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { alert('Photo library permission is required.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.85,
        base64: true,
        selectionLimit: 5,
      });
      if (!result.canceled && result.assets.length > 0) {
        onPickMedia(result.assets.map((a) => ({
          type: 'image', uri: a.uri, base64: a.base64, mimeType: a.mimeType || 'image/jpeg', name: a.fileName,
        })));
        onClose();
      }
    } catch (e) { console.error('Photo picker error:', e); }
    finally { setLoading(null); }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getMimeIcon = (mime: string, ext: string) => {
    if (mime.startsWith('image/')) return { icon: 'image-outline' as const, color: '#FF2D55' };
    if (mime.startsWith('video/')) return { icon: 'videocam-outline' as const, color: '#FF9500' };
    if (mime.startsWith('audio/')) return { icon: 'musical-notes-outline' as const, color: '#AF52DE' };
    if (mime.includes('pdf')) return { icon: 'document-text-outline' as const, color: '#FF3B30' };
    if (mime.includes('word') || ext === 'docx' || ext === 'doc') return { icon: 'document-outline' as const, color: '#2B5CE6' };
    if (mime.includes('excel') || mime.includes('spreadsheet') || ext === 'xlsx') return { icon: 'grid-outline' as const, color: '#217346' };
    if (mime.includes('json') || mime.includes('xml')) return { icon: 'code-slash-outline' as const, color: '#CB7700' };
    if (['js','ts','tsx','jsx','py','rb','go','rs','java','kt','swift','sh','css','html'].includes(ext)) return { icon: 'code-outline' as const, color: '#007AFF' };
    if (mime.startsWith('text/') || ext === 'txt' || ext === 'md') return { icon: 'document-text-outline' as const, color: '#8E8E93' };
    if (['zip','rar','7z','tar','gz','bz2'].includes(ext)) return { icon: 'archive-outline' as const, color: '#FF9F0A' };
    return { icon: 'attach-outline' as const, color: '#636366' };
  };

  // ── FILES — all types allowed (video, audio, zip, etc.) ──────────────────
  const handleFiles = async () => {
    setLoading('files');
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        const ext = (asset.name || '').split('.').pop()?.toLowerCase() || '';
        const mime = (asset.mimeType || 'application/octet-stream').toLowerCase();
        const isImage = mime.startsWith('image/');
        setSelectedFilePreview({ name: asset.name || 'file', size: asset.size || 0, mimeType: mime, uri: asset.uri, isImage });
      }
    } catch (e) { console.error('File picker error:', e); }
    finally { setLoading(null); }
  };

  const confirmSendFile = () => {
    if (!selectedFilePreview) return;
    onPickMedia([{
      type: selectedFilePreview.isImage ? 'image' : 'document',
      uri: selectedFilePreview.uri,
      name: selectedFilePreview.name,
      mimeType: selectedFilePreview.mimeType,
      size: selectedFilePreview.size,
    }]);
    setSelectedFilePreview(null);
    onClose();
  };

  // ── Tools grid ──
  const tools = [
    { id: 'camera',  label: 'Camera',  icon: 'camera-outline',          action: handleCamera },
    { id: 'photos',  label: 'Photos',  icon: 'image-outline',           action: handlePhotos },
    { id: 'files',   label: 'Files',   icon: 'arrow-up-circle-outline', action: handleFiles  },
    { id: 'quizzes', label: 'Quizzes', icon: 'albums-outline',
      action: () => { onOpenQuiz?.(); onClose(); } },
    { id: 'voice',   label: 'Call',    icon: 'call-outline',
      action: () => { router.push('/voice-control'); onClose(); } },
    { id: 'presets', label: 'Presets', icon: 'cube-outline',
      action: () => { onOpenPresets?.(); onClose(); } },
  ];

  if (!visible && !rendered) return null;

  const bottomPad = Math.max(insets.bottom, 8);

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>

        {/* Blurred backdrop */}
        <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={50} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          ) : null}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.25)' }]} />
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        </Animated.View>

        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.sheetOuter, modalStyle]}>
            {Platform.OS === 'ios' ? (
              <BlurView
                intensity={isDark ? 80 : 70}
                tint={isDark ? 'dark' : 'extraLight'}
                style={[styles.sheetInner, { paddingBottom: bottomPad }]}
              >
                <SheetContents
                  isDark={isDark}
                  tools={tools}
                  loading={loading}
                  selectedFilePreview={selectedFilePreview}
                  setSelectedFilePreview={setSelectedFilePreview}
                  showWebOptions={showWebOptions}
                  setShowWebOptions={setShowWebOptions}
                  webMode={webMode}
                  setWebMode={setWebMode}
                  confirmSendFile={confirmSendFile}
                  getMimeIcon={getMimeIcon}
                  formatBytes={formatBytes}
                  router={router}
                  onClose={onClose}
                />
              </BlurView>
            ) : (
              <View style={[
                styles.sheetInner,
                { backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7', paddingBottom: bottomPad },
              ]}>
                <SheetContents
                  isDark={isDark}
                  tools={tools}
                  loading={loading}
                  selectedFilePreview={selectedFilePreview}
                  setSelectedFilePreview={setSelectedFilePreview}
                  showWebOptions={showWebOptions}
                  setShowWebOptions={setShowWebOptions}
                  webMode={webMode}
                  setWebMode={setWebMode}
                  confirmSendFile={confirmSendFile}
                  getMimeIcon={getMimeIcon}
                  formatBytes={formatBytes}
                  router={router}
                  onClose={onClose}
                />
              </View>
            )}
          </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
}

// ── Inner sheet content ──────────────────────────────────────────────────────
function SheetContents({
  isDark, tools, loading, selectedFilePreview, setSelectedFilePreview,
  showWebOptions, setShowWebOptions, webMode, setWebMode,
  confirmSendFile, getMimeIcon, formatBytes, router, onClose,
}: any) {
  return (
    <>
      {/* Drag handle */}
      <View style={styles.handleWrap}>
        <View style={[styles.handle, { backgroundColor: isDark ? 'rgba(255,255,255,0.3)' : '#C7C7CC' }]} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* 3×2 Icon Grid */}
        <View style={styles.grid}>
          {tools.map((tool: any, i: number) => {
            const isLoading = loading === tool.id;
            return (
              <Animated.View
                key={tool.id}
                entering={FadeInUp.delay(i * 45).duration(300).springify()}
                style={styles.cellWrap}
              >
                <TouchableOpacity
                  style={[
                    styles.cell,
                    {
                      backgroundColor: isDark
                        ? 'rgba(60,60,67,0.6)'
                        : 'rgba(255,255,255,0.85)',
                    },
                  ]}
                  activeOpacity={0.7}
                  onPress={tool.action}
                  disabled={!!loading}
                >
                  {isLoading ? (
                    <ActivityIndicator color={isDark ? '#FFF' : '#555'} />
                  ) : (
                    <>
                      <View style={styles.iconWrap}>
                        <Ionicons
                          name={tool.icon as any}
                          size={28}
                          color={isDark ? '#FFFFFF' : THEME.text}
                        />
                      </View>
                      <Text style={[styles.cellLabel, { color: isDark ? '#FFFFFF' : THEME.text }]}>
                        {tool.label}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>

        {/* File Preview Card */}
        {selectedFilePreview && (
          <Animated.View entering={FadeInUp.duration(300)} style={[
            fpStyles.previewCard,
            { backgroundColor: isDark ? 'rgba(60,60,67,0.6)' : 'rgba(255,255,255,0.85)' },
          ]}>
            <View style={fpStyles.previewHeader}>
              <Text style={[fpStyles.previewTitle, { color: isDark ? '#FFF' : THEME.text }]}>
                Ready to send
              </Text>
              <TouchableOpacity onPress={() => setSelectedFilePreview(null)}>
                <Ionicons name="close" size={18} color={THEME.sub} />
              </TouchableOpacity>
            </View>
            <View style={fpStyles.previewBody}>
              {selectedFilePreview.isImage ? (
                <Image source={{ uri: selectedFilePreview.uri }} style={fpStyles.previewThumb} contentFit="cover" />
              ) : (
                <View style={[fpStyles.previewIconBox, {
                  backgroundColor: getMimeIcon(selectedFilePreview.mimeType, selectedFilePreview.name.split('.').pop() || '').color + '18',
                }]}>
                  <Ionicons
                    name={getMimeIcon(selectedFilePreview.mimeType, selectedFilePreview.name.split('.').pop() || '').icon}
                    size={36}
                    color={getMimeIcon(selectedFilePreview.mimeType, selectedFilePreview.name.split('.').pop() || '').color}
                  />
                </View>
              )}
              <View style={fpStyles.previewMeta}>
                <Text style={[fpStyles.previewName, { color: isDark ? '#FFF' : THEME.text }]} numberOfLines={2}>
                  {selectedFilePreview.name}
                </Text>
                <Text style={fpStyles.previewSize}>{formatBytes(selectedFilePreview.size)}</Text>
                <Text style={fpStyles.previewMime}>
                  {selectedFilePreview.mimeType.split('/')[1]?.toUpperCase() || 'FILE'}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={fpStyles.sendBtn} onPress={confirmSendFile}>
              <Ionicons name="arrow-up-circle" size={18} color="#FFF" />
              <Text style={fpStyles.sendBtnText}>Attach to message</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Rows container */}
        <Animated.View
          entering={FadeInUp.delay(200).duration(300)}
          style={[
            styles.rowsContainer,
            { backgroundColor: isDark ? 'rgba(60,60,67,0.6)' : 'rgba(255,255,255,0.85)' },
          ]}
        >
          {/* Web search */}
          <TouchableOpacity
            style={styles.rowItem}
            activeOpacity={0.7}
            onPress={() => setShowWebOptions(!showWebOptions)}
          >
            <View style={styles.rowLeft}>
              <View style={[styles.rowIconWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#F2F2F7' }]}>
                <Ionicons name="globe-outline" size={20} color={isDark ? '#FFFFFF' : THEME.text} />
              </View>
              <Text style={[styles.rowItemLabel, { color: isDark ? '#FFFFFF' : THEME.text }]}>Web search</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={styles.rowItemRight}>{webMode === 'auto' ? 'Auto' : 'Off'}</Text>
              <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
            </View>
          </TouchableOpacity>

          {showWebOptions && (
            <View style={[styles.webOptions, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
              {(['auto', 'off'] as const).map((mode) => (
                <TouchableOpacity
                  key={mode}
                  style={[styles.webOption, webMode === mode && styles.webOptionActive]}
                  onPress={() => { setWebMode(mode); setTimeout(() => setShowWebOptions(false), 250); }}
                >
                  <View>
                    <Text style={[styles.webOptTitle, { color: isDark ? '#FFF' : THEME.text }]}>
                      {mode === 'auto' ? 'Auto' : 'Off'}
                    </Text>
                    <Text style={styles.webOptSub}>
                      {mode === 'auto' ? 'Browses the web when needed' : 'No web access'}
                    </Text>
                  </View>
                  {webMode === mode && <Ionicons name="checkmark" size={20} color={THEME.accent} />}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Separator */}
          <View style={[styles.rowDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : THEME.border }]} />

          {/* Professional Data */}
          <TouchableOpacity
            style={styles.rowItem}
            activeOpacity={0.7}
            onPress={() => { router.push('/data-controls'); onClose(); }}
          >
            <View style={styles.rowLeft}>
              <View style={[styles.rowIconWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#F2F2F7' }]}>
                <Ionicons name="server-outline" size={20} color={isDark ? '#FFFFFF' : THEME.text} />
              </View>
              <Text style={[styles.rowItemLabel, { color: isDark ? '#FFFFFF' : THEME.text }]}>Professional Data</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  sheetOuter: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 24,
  },
  sheetInner: {
    // No explicit minHeight/maxHeight — let content drive the size naturally
  },
  handleWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 6 },
  handle: { width: 36, height: 5, borderRadius: 3 },
  scrollContent: { paddingHorizontal: 14, paddingTop: 4, paddingBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10, marginBottom: 12 },
  cellWrap: { width: (SCREEN_WIDTH - 48) / 3 },
  cell: {
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
    minHeight: 92,
  },
  iconWrap: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  cellLabel: { fontSize: 13, fontWeight: '500', textAlign: 'center' },
  rowsContainer: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 0,
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowIconWrap: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rowItemLabel: { fontSize: 16, fontWeight: '400' },
  rowItemRight: { fontSize: 15, color: THEME.sub },
  rowDivider: { height: StyleSheet.hairlineWidth, marginLeft: 60 },
  webOptions: {
    marginHorizontal: 8,
    marginBottom: 8,
    borderRadius: 12,
    padding: 4,
  },
  webOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 8 },
  webOptionActive: { backgroundColor: 'rgba(0,122,255,0.08)' },
  webOptTitle: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  webOptSub: { fontSize: 13, color: THEME.sub },
});

const fpStyles = StyleSheet.create({
  previewCard: { borderRadius: 14, padding: 14, marginBottom: 12 },
  previewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  previewTitle: { fontSize: 13, fontWeight: '700' },
  previewBody: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  previewThumb: { width: 64, height: 64, borderRadius: 10 },
  previewIconBox: { width: 64, height: 64, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  previewMeta: { flex: 1, gap: 3 },
  previewName: { fontSize: 14, fontWeight: '600' },
  previewSize: { fontSize: 12, color: THEME.sub },
  previewMime: { fontSize: 11, color: THEME.sub, fontWeight: '500' },
  sendBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: THEME.accent, borderRadius: 10, paddingVertical: 10 },
  sendBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});
