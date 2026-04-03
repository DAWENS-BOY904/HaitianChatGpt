import React, { useState } from 'react';
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
}: ToolsModalProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const [showWebOptions, setShowWebOptions] = useState(false);
  const [webMode, setWebMode] = useState<'auto' | 'off'>('auto');
  const [loading, setLoading] = useState<string | null>(null);
  const [rendered, setRendered] = useState(false);

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
      if (status !== 'granted') {
        alert('Camera permission is required.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        base64: true,
      });
      if (!result.canceled && result.assets[0]) {
        onPickMedia([{
          type: 'image',
          uri: result.assets[0].uri,
          base64: result.assets[0].base64,
          mimeType: 'image/jpeg',
        }]);
        onClose();
      }
    } catch (e) {
      console.error('Camera error:', e);
    } finally {
      setLoading(null);
    }
  };

  // ── REAL PHOTOS ──
  const handlePhotos = async () => {
    setLoading('photos');
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        alert('Photo library permission is required.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.85,
        base64: true,
        selectionLimit: 5,
      });
      if (!result.canceled && result.assets.length > 0) {
        onPickMedia(result.assets.map((a) => ({
          type: 'image',
          uri: a.uri,
          base64: a.base64,
          mimeType: a.mimeType || 'image/jpeg',
          name: a.fileName,
        })));
        onClose();
      }
    } catch (e) {
      console.error('Photo picker error:', e);
    } finally {
      setLoading(null);
    }
  };

  // ── REAL FILES ──
  const handleFiles = async () => {
    setLoading('files');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        onPickMedia([{
          type: 'document',
          uri: asset.uri,
          name: asset.name,
          mimeType: asset.mimeType,
          size: asset.size,
        }]);
        onClose();
      }
    } catch (e) {
      console.error('File picker error:', e);
    } finally {
      setLoading(null);
    }
  };

  const tools = [
    { id: 'camera', label: 'Camera', icon: 'camera-outline', color: '#5856D6', action: handleCamera },
    { id: 'photos', label: 'Photos', icon: 'image-outline', color: '#FF2D55', action: handlePhotos },
    { id: 'files', label: 'Files', icon: 'document-outline', color: '#007AFF', action: handleFiles },
    {
      id: 'voice',
      label: 'Call',
      icon: 'call-outline',
      color: '#34C759',
      action: () => { router.push('/voice-control'); onClose(); },
    },
    {
      id: 'presets',
      label: 'Presets',
      icon: 'cube-outline',
      color: '#FF9500',
      action: () => { onSelectTool?.('presets'); onClose(); },
    },
    {
      id: 'wechat',
      label: 'WeChat files',
      icon: 'chatbubble-ellipses-outline',
      color: '#30D158',
      action: () => { onClose(); },
    },
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
            {/* Handle */}
            <View style={styles.handleWrap}><View style={styles.handle} /></View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              bounces={false}
              contentContainerStyle={styles.scrollContent}
            >
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

              {/* Web Search Row */}
              <Animated.View entering={FadeInUp.delay(340).duration(350)}>
                <TouchableOpacity
                  style={styles.webRow}
                  activeOpacity={0.7}
                  onPress={() => setShowWebOptions(!showWebOptions)}
                >
                  <View style={styles.webLeft}>
                    <View style={[styles.webIcon, { backgroundColor: 'rgba(0,122,255,0.15)' }]}>
                      <Ionicons name="globe-outline" size={22} color={GLASS.accent} />
                    </View>
                    <Text style={styles.webLabel}>Web search</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.webBadge}>{webMode === 'auto' ? 'Auto' : 'Off'}</Text>
                    <Ionicons
                      name={showWebOptions ? 'chevron-down' : 'chevron-forward'}
                      size={18}
                      color={GLASS.sub}
                    />
                  </View>
                </TouchableOpacity>

                {showWebOptions && (
                  <View style={styles.webOptions}>
                    {(['auto', 'off'] as const).map((mode) => (
                      <TouchableOpacity
                        key={mode}
                        style={[styles.webOption, webMode === mode && styles.webOptionActive]}
                        onPress={() => { setWebMode(mode); setTimeout(() => setShowWebOptions(false), 250); }}
                      >
                        <View>
                          <Text style={styles.webOptTitle}>{mode === 'auto' ? 'Auto' : 'Off'}</Text>
                          <Text style={styles.webOptSub}>
                            {mode === 'auto' ? 'Browses the web when needed' : 'No web access'}
                          </Text>
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
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
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
  },
  webLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  webIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  webLabel: { fontSize: 16, fontWeight: '600', color: GLASS.text },
  webBadge: { fontSize: 15, color: GLASS.sub, fontWeight: '500' },
  webOptions: { backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 12, padding: 4, marginTop: 8 },
  webOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
  },
  webOptionActive: { backgroundColor: 'rgba(0,122,255,0.15)' },
  webOptTitle: { fontSize: 15, fontWeight: '600', color: GLASS.text, marginBottom: 2 },
  webOptSub: { fontSize: 13, color: GLASS.sub },
});
