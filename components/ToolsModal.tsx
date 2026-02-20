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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeInUp,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { useTheme } from '../hooks/useTheme';
import { Spacing, Typography, BorderRadius } from '../constants/theme';

import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

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

// Glassmorphism colors
const GLASS_COLORS = {
  background: 'rgba(28, 28, 30, 0.95)',
  surface: 'rgba(44, 44, 46, 0.70)',
  border: 'rgba(120, 120, 128, 0.20)',
  text: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.60)',
  accent: '#0A84FF',
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
  const navigation = useNavigation<any>();
  const [showWebSearchOptions, setShowWebSearchOptions] = useState(false);
  const [webSearchMode, setWebSearchMode] = useState<'auto' | 'off'>('auto');
  const [loadingTool, setLoadingTool] = useState<string | null>(null);

  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);

  const modalAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  React.useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { damping: 25, stiffness: 300 });
      opacity.value = withTiming(1, { duration: 200 });
    } else {
      translateY.value = withSpring(SCREEN_HEIGHT, { damping: 25, stiffness: 300 });
      opacity.value = withTiming(0, { duration: 150 });
    }
  }, [visible]);

  const panGesture = Gesture.Pan()
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
        translateY.value = withSpring(0);
        opacity.value = withTiming(1);
      }
    });

  /* ---------------- MEDIA PICKERS ---------------- */

  const handlePickImages = async () => {
    setLoadingTool('images');
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') return;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets.length > 0) {
        onPickMedia(
          result.assets.map(asset => ({
            type: 'image',
            uri: asset.uri,
            base64: asset.base64,
          })),
        );
        onClose();
      }
    } finally {
      setLoadingTool(null);
    }
  };

  const handlePickFile = async () => {
    setLoadingTool('file');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        onPickMedia([
          {
            type: 'file',
            uri: result.assets[0].uri,
            name: result.assets[0].name,
            mimeType: result.assets[0].mimeType,
          },
        ]);
        onClose();
      }
    } finally {
      setLoadingTool(null);
    }
  };

  const handleToolPress = useCallback((toolId: string, action: () => void) => {
    if (loadingTool) return;
    action();
  }, [loadingTool]);

  /* ---------------- TOOLS CONFIG (MATCHING KIMI) ---------------- */

  const mainTools = [
    {
      id: 'camera',
      label: 'Camera',
      icon: 'camera-outline',
      action: () => {
        onOpenCamera?.();
        onClose();
      },
    },
    {
      id: 'photos',
      label: 'Photos',
      icon: 'image-outline',
      action: handlePickImages,
    },
    {
      id: 'files',
      label: 'Files',
      icon: 'folder-open-outline',
      action: handlePickFile,
    },
    {
      id: 'wechat-files',
      label: 'WeChat files',
      icon: 'chatbubbles-outline',
      action: () => {
        // WeChat integration placeholder
        onSelectTool?.('wechat-files');
        onClose();
      },
    },
    {
      id: 'call',
      label: 'Call',
      icon: 'call-outline',
      action: () => {
        navigation.navigate('voice-control');
        onClose();
      },
    },
    {
      id: 'presets',
      label: 'Presets',
      icon: 'cube-outline',
      action: () => {
        onSelectTool?.('presets');
        onClose();
      },
    },
  ];

  /* ---------------- RENDER ---------------- */

  const renderToolButton = (tool: any, index: number) => {
    const isLoading = loadingTool === tool.id;
    
    return (
      <Animated.View
        key={tool.id}
        entering={FadeInUp.delay(index * 50).duration(400)}
        style={styles.toolButtonContainer}
      >
        <TouchableOpacity
          style={styles.toolButton}
          onPress={() => handleToolPress(tool.id, tool.action)}
          activeOpacity={0.7}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={GLASS_COLORS.accent} />
          ) : (
            <>
              <Ionicons name={tool.icon} size={28} color={GLASS_COLORS.text} />
              <Text style={styles.toolLabel}>{tool.label}</Text>
            </>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.darkOverlay} />

        <TouchableOpacity
          style={styles.dismissArea}
          activeOpacity={1}
          onPress={onClose}
        />

        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.container, modalAnimatedStyle]}>
            <View style={styles.handleBar} />

            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Main Tools Grid - 3x2 */}
              <View style={styles.mainGrid}>
                {mainTools.slice(0, 5).map((tool, index) => renderToolButton(tool, index))}
              </View>

              {/* Web Search Row with Toggle */}
              <Animated.View entering={FadeInUp.delay(400).duration(400)}>
                <TouchableOpacity
                  style={styles.webSearchRow}
                  onPress={() => setShowWebSearchOptions(!showWebSearchOptions)}
                  activeOpacity={0.7}
                >
                  <View style={styles.webSearchLeft}>
                    <Ionicons name="globe" size={22} color={GLASS_COLORS.text} />
                    <Text style={styles.webSearchText}>Web search</Text>
                  </View>
                  <View style={styles.webSearchRight}>
                    <Text style={styles.webSearchBadge}>{webSearchMode === 'auto' ? 'Auto' : 'Off'}</Text>
                    <Ionicons name="chevron-forward" size={18} color={GLASS_COLORS.textSecondary} />
                  </View>
                </TouchableOpacity>

                {/* Web Search Options */}
                {showWebSearchOptions && (
                  <View style={styles.webSearchOptions}>
                    <TouchableOpacity
                      style={[styles.webSearchOption, webSearchMode === 'auto' && styles.webSearchOptionActive]}
                      onPress={() => {
                        setWebSearchMode('auto');
                        setTimeout(() => setShowWebSearchOptions(false), 300);
                      }}
                    >
                      <View style={styles.webSearchOptionContent}>
                        <Text style={styles.webSearchOptionTitle}>Auto</Text>
                        <Text style={styles.webSearchOptionDesc}>Browses the web when needed</Text>
                      </View>
                      {webSearchMode === 'auto' && (
                        <Ionicons name="checkmark" size={20} color={GLASS_COLORS.accent} />
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.webSearchOption, webSearchMode === 'off' && styles.webSearchOptionActive]}
                      onPress={() => {
                        setWebSearchMode('off');
                        setTimeout(() => setShowWebSearchOptions(false), 300);
                      }}
                    >
                      <View style={styles.webSearchOptionContent}>
                        <Text style={styles.webSearchOptionTitle}>Off</Text>
                        <Text style={styles.webSearchOptionDesc}>No web access</Text>
                      </View>
                      {webSearchMode === 'off' && (
                        <Ionicons name="checkmark" size={20} color={GLASS_COLORS.accent} />
                      )}
                    </TouchableOpacity>
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
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  dismissArea: {
    flex: 1,
  },
  container: {
    backgroundColor: GLASS_COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.70,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: GLASS_COLORS.border,
  },
  handleBar: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 8,
  },
  
  // Main Grid - 3x2 layout like Kimi
  mainGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  toolButtonContainer: {
    width: '31%',
    marginBottom: 16,
  },
  toolButton: {
    aspectRatio: 1.1,
    backgroundColor: GLASS_COLORS.surface,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: GLASS_COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  toolLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: GLASS_COLORS.text,
    marginTop: 8,
    textAlign: 'center',
  },
  
  // Web Search Row
  webSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: GLASS_COLORS.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: GLASS_COLORS.border,
    marginBottom: 12,
  },
  webSearchLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  webSearchText: {
    fontSize: 16,
    fontWeight: '500',
    color: GLASS_COLORS.text,
  },
  webSearchRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  webSearchBadge: {
    fontSize: 15,
    color: GLASS_COLORS.textSecondary,
    fontWeight: '400',
  },
  
  // Web Search Options
  webSearchOptions: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
    padding: 4,
    marginTop: -8,
    marginBottom: 12,
  },
  webSearchOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
  },
  webSearchOptionActive: {
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
  },
  webSearchOptionContent: {
    flex: 1,
  },
  webSearchOptionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: GLASS_COLORS.text,
    marginBottom: 2,
  },
  webSearchOptionDesc: {
    fontSize: 13,
    color: GLASS_COLORS.textSecondary,
  },
});
