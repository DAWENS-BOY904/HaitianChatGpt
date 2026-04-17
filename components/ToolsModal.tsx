import React, { useState, useCallback } from 'react';
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

const GLASS = {
  bg: 'rgba(20, 20, 22, 0.98)',
  surface: 'rgba(44, 44, 46, 0.9)',
  border: 'rgba(255,255,255,0.08)',
  text: '#FFFFFF',
  sub: 'rgba(255,255,255,0.55)',
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
  const { colors } = useTheme();
  const router = useRouter();
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
      const t = setTimeout(() => { setRendered(false); setShowWebOptions(false); }, 280);
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

  // ── REAL CAMERA ──
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

  // ── REAL PHOTOS ──
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
    if (mime.includes('pdf')) return { icon: 'document-text-outline' as const, color: '#FF3B30' };
    if (mime.includes('word') || ext === 'docx' || ext === 'doc') return { icon: 'document-outline' as const, color: '#2B5CE6' };
    if (mime.includes('excel') || mime.includes('spreadsheet') || ext === 'xlsx') return { icon: 'grid-outline' as const, color: '#217346' };
    if (mime.includes('powerpoint') || mime.includes('presentation') || ext === 'pptx') return { icon: 'easel-outline' as const, color: '#D24726' };
    if (mime.includes('json') || mime.includes('xml')) return { icon: 'code-slash-outline' as const, color: '#CB7700' };
    if (['js','ts','tsx','jsx','py','rb','go','rs','java','kt','swift','sh','css','html'].includes(ext)) return { icon: 'code-outline' as const, color: '#007AFF' };
    if (mime.startsWith('text/') || ext === 'txt' || ext === 'md') return { icon: 'document-text-outline' as const, color: '#8E8E93' };
    return { icon: 'attach-outline' as const, color: '#636366' };
  };

  const handleFiles = async () => {
    setLoading('files');
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        const ext = (asset.name || '').split('.').pop()?.toLowerCase() || '';
        const mime = (asset.mimeType || '').toLowerCase();
        const isBlocked = mime.startsWith('video/') || mime.includes('zip') || mime.includes('x-rar') || mime.includes('7z')
          || ext === 'zip' || ext === 'rar' || ext === '7z' || ext === 'tar' || ext === 'gz' || mime.startsWith('audio/');
        if (isBlocked) { alert('File type not supported. Please upload documents, images, or code files.'); return; }
        const isImage = mime.startsWith('image/');
        setSelectedFilePreview({ name: asset.name || 'file', size: asset.size || 0, mimeType: mime, uri: asset.uri, isImage });
      }
    } catch (e) { console.error('File picker error:', e); }
    finally { setLoading(null); }
  };

  const confirmSendFile = () => {
    if (!selectedFilePreview) return;
    onPickMedia([{ type: selectedFilePreview.isImage ? 'image' : 'document', uri: selectedFilePreview.uri, name: selectedFilePreview.name, mimeType: selectedFilePreview.mimeType, size: selectedFilePreview.size }]);
    setSelectedFilePreview(null);
    onClose();
  };

  // ── Tools — 3 cols × 2 rows (Quizzes replaces WeChat) ──
  const tools = [
    { id: 'camera',  label: 'Camera',  icon: 'camera-outline',  color: '#5856D6', action: handleCamera },
    { id: 'photos',  label: 'Photos',  icon: 'image-outline',   color: '#FF2D55', action: handlePhotos },
    { id: 'files',   label: 'Files',   icon: 'document-outline',color: '#007AFF', action: handleFiles  },
    { id: 'quizzes', label: 'Quizzes', icon: 'albums-outline',  color: '#5AC8FA',
      action: () => { onOpenQuiz?.(); onClose(); } },
    { id: 'voice',   label: 'Call',    icon: 'call-outline',    color: '#34C759',
      action: () => { router.push('/voice-control'); onClose(); } },
    { id: 'presets', label: 'Presets', icon: 'cube-outline',    color: '#FF9500',
      action: () => { onOpenPresets?.(); onClose(); } },
  ];

  if (!visible && !rendered) return null;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)' }, backdropStyle]}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        </Animated.View>

        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.sheet, modalStyle]}>
            <View style={styles.handleWrap}><View style={styles.handle} /></View>

            <ScrollView showsVerticalScrollIndicator={false} bounces={false} contentContainerStyle={styles.scrollContent}>
              {/* 3×2 Grid */}
              <View style={styles.grid}>
                {tools.map((tool, i) => {
                  const isLoading = loading === tool.id;
                  return (
                    <Animated.View
                      key={tool.id}
                      entering={FadeInUp.delay(i * 50).duration(350).springify()}
                      style={styles.cellWrap}
                    >
                      <TouchableOpacity
                        style={[styles.cell, { backgroundColor: GLASS.surface }]}
                        activeOpacity={0.7}
                        onPress={tool.action}
                        disabled={!!loading}
                      >
                        {isLoading ? (
                          <ActivityIndicator color={tool.color} />
                        ) : (
                          <>
                            <View style={[styles.iconWrap, { backgroundColor: tool.color + '22' }]}>
                              <Ionicons name={tool.icon as any} size={28} color={tool.color} />
                            </View>
                            <Text style={styles.cellLabel}>{tool.label}</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </Animated.View>
                  );
                })}
              </View>

              {/* File Preview */}
              {selectedFilePreview && (
                <Animated.View entering={FadeInUp.duration(300)} style={fpStyles.previewCard}>
                  <View style={fpStyles.previewHeader}>
                    <Text style={fpStyles.previewTitle}>Ready to send</Text>
                    <TouchableOpacity onPress={() => setSelectedFilePreview(null)}>
                      <Ionicons name="close" size={18} color={GLASS.sub} />
                    </TouchableOpacity>
                  </View>
                  <View style={fpStyles.previewBody}>
                    {selectedFilePreview.isImage ? (
                      <Image source={{ uri: selectedFilePreview.uri }} style={fpStyles.previewThumb} contentFit="cover" />
                    ) : (
                      <View style={[fpStyles.previewIconBox, { backgroundColor: getMimeIcon(selectedFilePreview.mimeType, selectedFilePreview.name.split('.').pop() || '').color + '18' }]}>
                        <Ionicons name={getMimeIcon(selectedFilePreview.mimeType, selectedFilePreview.name.split('.').pop() || '').icon} size={36} color={getMimeIcon(selectedFilePreview.mimeType, selectedFilePreview.name.split('.').pop() || '').color} />
                      </View>
                    )}
                    <View style={fpStyles.previewMeta}>
                      <Text style={fpStyles.previewName} numberOfLines={2}>{selectedFilePreview.name}</Text>
                      <Text style={fpStyles.previewSize}>{formatBytes(selectedFilePreview.size)}</Text>
                      <Text style={fpStyles.previewMime}>{selectedFilePreview.mimeType.split('/')[1]?.toUpperCase() || 'FILE'}</Text>
                    </View>
                  </View>
                  <TouchableOpacity style={fpStyles.sendBtn} onPress={confirmSendFile}>
                    <Ionicons name="arrow-up-circle" size={18} color="#FFF" />
                    <Text style={fpStyles.sendBtnText}>Attach to message</Text>
                  </TouchableOpacity>
                </Animated.View>
              )}

              {/* Supported types info */}
              {!selectedFilePreview && (
                <Animated.View entering={FadeInUp.delay(300).duration(300)} style={fpStyles.chipsSection}>
                  <Text style={fpStyles.chipsTitle}>Supported types</Text>
                  <View style={fpStyles.typeRows}>
                    {[
                      { icon: 'image-outline', color: '#FF2D55', label: 'Images', ext: 'PNG, JPG, WEBP, SVG, GIF' },
                      { icon: 'document-text-outline', color: '#FF9500', label: 'Documents', ext: 'PDF, DOCX, XLSX, PPTX' },
                      { icon: 'code-slash-outline', color: '#007AFF', label: 'Code', ext: 'JS, TS, PY, GO, SWIFT, HTML...' },
                      { icon: 'text-outline', color: '#30D158', label: 'Text', ext: 'TXT, MD, CSV, JSON, XML' },
                    ].map(item => (
                      <View key={item.label} style={fpStyles.typeRow}>
                        <Ionicons name={item.icon as any} size={16} color={item.color} />
                        <Text style={fpStyles.typeLabel}>{item.label}</Text>
                        <Text style={fpStyles.typeExt}>{item.ext}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={fpStyles.limitRow}>
                    <Ionicons name="information-circle-outline" size={13} color={GLASS.sub} />
                    <Text style={fpStyles.limitText}>Max 25 MB · No ZIP or video files</Text>
                  </View>
                </Animated.View>
              )}

              {/* Web Search — full-width row */}
              <Animated.View entering={FadeInUp.delay(340).duration(350)}>
                <TouchableOpacity style={styles.webRow} activeOpacity={0.7} onPress={() => setShowWebOptions(!showWebOptions)}>
                  <View style={styles.webLeft}>
                    <View style={[styles.webIcon, { backgroundColor: 'rgba(0,122,255,0.15)' }]}>
                      <Ionicons name="globe-outline" size={22} color={GLASS.accent} />
                    </View>
                    <Text style={styles.webLabel}>Web search</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.webBadge}>{webMode === 'auto' ? 'Auto' : 'Off'}</Text>
                    <Ionicons name={showWebOptions ? 'chevron-down' : 'chevron-forward'} size={18} color={GLASS.sub} />
                  </View>
                </TouchableOpacity>
                {showWebOptions && (
                  <View style={styles.webOptions}>
                    {(['auto', 'off'] as const).map((mode) => (
                      <TouchableOpacity key={mode} style={[styles.webOption, webMode === mode && styles.webOptionActive]}
                        onPress={() => { setWebMode(mode); setTimeout(() => setShowWebOptions(false), 250); }}>
                        <View>
                          <Text style={styles.webOptTitle}>{mode === 'auto' ? 'Auto' : 'Off'}</Text>
                          <Text style={styles.webOptSub}>{mode === 'auto' ? 'Browses the web when needed' : 'No web access'}</Text>
                        </View>
                        {webMode === mode && <Ionicons name="checkmark" size={20} color={GLASS.accent} />}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </Animated.View>
            </ScrollView>
          </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: GLASS.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: SCREEN_HEIGHT * 0.42,
    maxHeight: SCREEN_HEIGHT * 0.85,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    borderTopWidth: 1,
    borderColor: GLASS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  handleWrap: { alignItems: 'center', paddingTop: 12, paddingBottom: 6 },
  handle: { width: 36, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)' },
  scrollContent: { padding: 20, paddingTop: 10, paddingBottom: 40 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, marginBottom: 16 },
  cellWrap: { width: (SCREEN_WIDTH - 64) / 3 },
  cell: {
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 6,
    minHeight: 108,
    borderWidth: 1,
    borderColor: GLASS.border,
  },
  iconWrap: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  cellLabel: { fontSize: 13, fontWeight: '600', color: GLASS.text, textAlign: 'center' },
  webRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: GLASS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: GLASS.border,
    marginBottom: 10,
  },
  webLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  webIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  webLabel: { fontSize: 16, fontWeight: '600', color: GLASS.text },
  webBadge: { fontSize: 15, color: GLASS.sub, fontWeight: '500' },
  webOptions: { backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 12, padding: 4, marginTop: 8 },
  webOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 8 },
  webOptionActive: { backgroundColor: 'rgba(0,122,255,0.15)' },
  webOptTitle: { fontSize: 15, fontWeight: '600', color: GLASS.text, marginBottom: 2 },
  webOptSub: { fontSize: 13, color: GLASS.sub },
});

const fpStyles = StyleSheet.create({
  previewCard: { backgroundColor: GLASS.surface, borderRadius: 16, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: GLASS.border },
  previewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  previewTitle: { fontSize: 13, fontWeight: '700', color: GLASS.text },
  previewBody: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  previewThumb: { width: 64, height: 64, borderRadius: 10 },
  previewIconBox: { width: 64, height: 64, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  previewMeta: { flex: 1, gap: 3 },
  previewName: { fontSize: 14, fontWeight: '600', color: GLASS.text },
  previewSize: { fontSize: 12, color: GLASS.sub },
  previewMime: { fontSize: 11, color: GLASS.sub, fontWeight: '500' },
  sendBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: GLASS.accent, borderRadius: 10, paddingVertical: 10 },
  sendBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  chipsSection: { marginBottom: 14 },
  chipsTitle: { fontSize: 12, fontWeight: '600', color: GLASS.sub, marginBottom: 10, marginLeft: 2 },
  typeRows: { gap: 6, marginBottom: 10 },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
  typeLabel: { fontSize: 13, fontWeight: '600', color: GLASS.text, width: 82 },
  typeExt: { fontSize: 12, color: GLASS.sub, flex: 1 },
  limitRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2, marginLeft: 2 },
  limitText: { fontSize: 12, color: GLASS.sub },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, minWidth: 80 },
  chipLabel: { fontSize: 12, fontWeight: '700', marginBottom: 2 },
  chipExt: { fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: '500' },
});
