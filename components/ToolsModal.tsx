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
  FadeIn,
  FadeInUp,
  SlideInDown,
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

// Glassmorphism colors - translucent dark grays, not black/white
const GLASS_COLORS = {
  background: 'rgba(28, 28, 30, 0.85)', // iOS system gray6 with opacity
  surface: 'rgba(44, 44, 46, 0.60)',    // iOS system gray5 with opacity
  border: 'rgba(120, 120, 128, 0.20)',  // iOS system gray with low opacity
  text: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.60)',
  accent: '#0A84FF', // iOS system blue
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
  const [showAISelector, setShowAISelector] = useState(false);
  const [loadingTool, setLoadingTool] = useState<string | null>(null);

  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);

  // Spring animation for modal appearance
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

  // Pan gesture to dismiss
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

  const handlePickVideo = async () => {
    setLoadingTool('video');
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') return;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        onPickMedia([
          {
            type: 'video',
            uri: result.assets[0].uri,
          },
        ]);
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

  /* ---------------- AI MODELS ---------------- */

  const aiModels = [
    { id: 'openai', name: 'GPT-4o', icon: 'flash', color: '#10A37F', provider: 'OpenAI' },
    { id: 'gemini', name: 'Gemini Pro', icon: 'diamond', color: '#4285F4', provider: 'Google' },
    { id: 'claude', name: 'Claude 3', icon: 'cube', color: '#CC785C', provider: 'Anthropic' },
    { id: 'llama', name: 'Llama 3', icon: 'paw', color: '#0467DF', provider: 'Meta' },
  ];

  /* ---------------- TOOLS CONFIG ---------------- */

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
      id: 'images',
      label: 'Photos',
      icon: 'image-outline',
      action: handlePickImages,
    },
    {
      id: 'file',
      label: 'Files',
      icon: 'folder-open-outline',
      action: handlePickFile,
    },
    {
      id: 'video',
      label: 'Video',
      icon: 'videocam-outline',
      action: handlePickVideo,
    },
    {
      id: 'ai-model',
      label: 'AI Model',
      icon: 'hardware-chip-outline',
      subtitle: aiModels.find(m => m.id === currentModel)?.name || 'Gemini',
      action: () => setShowAISelector(true),
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

  const featureTools = [
    {
      id: 'create-image',
      label: 'Create image',
      icon: 'color-wand-outline',
      action: () => {
        onSelectTool?.('create-image');
        onClose();
      },
    },
    {
      id: 'thinking',
      label: 'Think mode',
      icon: 'bulb-outline',
      action: () => {
        onSelectTool?.('thinking');
        onClose();
      },
    },
    {
      id: 'research',
      label: 'Deep research',
      icon: 'search-outline',
      action: () => {
        onSelectTool?.('research');
        onClose();
      },
    },
    {
      id: 'web-search',
      label: 'Web search',
      icon: 'globe-outline',
      badge: 'Auto',
      action: () => {
        onSelectTool?.('web-search');
        onClose();
      },
    },
    {
      id: 'study',
      label: 'Study',
      icon: 'school-outline',
      action: () => {
        onSelectTool?.('study');
        onClose();
      },
    },
    {
      id: 'code',
      label: 'Code',
      icon: 'code-slash-outline',
      action: () => {
        onSelectTool?.('code');
        onClose();
      },
    },
  ];

  /* ---------------- RENDER HELPERS ---------------- */

  const renderToolButton = (tool: any, index: number, size: 'large' | 'small' = 'large') => {
    const isLoading = loadingTool === tool.id;
    const isLarge = size === 'large';
    
    return (
      <Animated.View
        entering={FadeInUp.delay(index * 50).duration(400)}
        style={isLarge ? styles.toolButtonLarge : styles.toolButtonSmall}
      >
        <TouchableOpacity
          style={[
            styles.toolContent,
            isLarge ? styles.toolContentLarge : styles.toolContentSmall,
          ]}
          onPress={() => handleToolPress(tool.id, tool.action)}
          activeOpacity={0.7}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={GLASS_COLORS.accent} />
          ) : (
            <Ionicons
              name={tool.icon}
              size={isLarge ? 28 : 24}
              color={GLASS_COLORS.text}
              style={styles.toolIcon}
            />
          )}
          <Text style={[styles.toolLabel, isLarge && styles.toolLabelLarge]}>
            {tool.label}
          </Text>
          {tool.subtitle && (
            <Text style={styles.toolSubtitle}>{tool.subtitle}</Text>
          )}
          {tool.badge && (
            <View style={styles.badgeContainer}>
              <Text style={styles.badgeText}>{tool.badge}</Text>
              <Ionicons name="chevron-forward" size={12} color={GLASS_COLORS.textSecondary} />
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  /* ---------------- RENDER ---------------- */

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Blur background */}
        <BlurView
          intensity={20}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
        
        {/* Semi-transparent dark overlay */}
        <View style={styles.darkOverlay} />

        <TouchableOpacity
          style={styles.dismissArea}
          activeOpacity={1}
          onPress={onClose}
        />

        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.container, modalAnimatedStyle]}>
            {/* Handle bar */}
            <View style={styles.handleBar} />

            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Tools</Text>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Ionicons name="close" size={24} color={GLASS_COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Main Tools Grid - 3 columns */}
              <View style={styles.mainGrid}>
                {mainTools.map((tool, index) => renderToolButton(tool, index, 'large'))}
              </View>

              {/* Divider */}
              <View style={styles.divider} />

              {/* Feature Tools Grid */}
              <View style={styles.featureGrid}>
                {featureTools.map((tool, index) => renderToolButton(tool, index + 6, 'small'))}
              </View>

              {/* Web Search Row */}
              <Animated.View entering={FadeInUp.delay(800).duration(400)}>
                <TouchableOpacity
                  style={styles.webSearchRow}
                  onPress={() => {
                    onSelectTool?.('web-search');
                    onClose();
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.webSearchLeft}>
                    <Ionicons name="globe" size={22} color={GLASS_COLORS.text} />
                    <Text style={styles.webSearchText}>Web search</Text>
                  </View>
                  <View style={styles.webSearchRight}>
                    <Text style={styles.webSearchBadge}>Auto</Text>
                    <Ionicons name="chevron-forward" size={18} color={GLASS_COLORS.textSecondary} />
                  </View>
                </TouchableOpacity>
              </Animated.View>
            </ScrollView>
          </Animated.View>
        </GestureDetector>
      </View>

      {/* AI Model Selector Sub-Modal */}
      <Modal
        visible={showAISelector}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAISelector(false)}
      >
        <View style={styles.subModalOverlay}>
          <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
          <TouchableOpacity
            style={styles.subModalDismiss}
            activeOpacity={1}
            onPress={() => setShowAISelector(false)}
          />
          <Animated.View entering={SlideInDown} style={styles.aiSelectorContainer}>
            <View style={styles.aiSelectorHandle} />
            <Text style={styles.aiSelectorTitle}>Select AI Model</Text>
            
            {aiModels.map((model, index) => (
              <TouchableOpacity
                key={model.id}
                style={[
                  styles.aiModelItem,
                  currentModel === model.id && styles.aiModelItemActive,
                ]}
                onPress={() => {
                  onSelectAIModel?.(model.id);
                  setShowAISelector(false);
                  onClose();
                }}
              >
                <View style={[styles.aiModelIcon, { backgroundColor: model.color }]}>
                  <Ionicons name={model.icon as any} size={20} color="#FFF" />
                </View>
                <View style={styles.aiModelInfo}>
                  <Text style={styles.aiModelName}>{model.name}</Text>
                  <Text style={styles.aiModelProvider}>{model.provider}</Text>
                </View>
                {currentModel === model.id && (
                  <Ionicons name="checkmark-circle" size={24} color={GLASS_COLORS.accent} />
                )}
              </TouchableOpacity>
            ))}
          </Animated.View>
        </View>
      </Modal>
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
    backgroundColor: 'rgba(0, 0, 0, 0.3)', // Soft dark overlay, not pure black
  },
  dismissArea: {
    flex: 1,
  },
  container: {
    backgroundColor: GLASS_COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.85,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    // Glass border effect
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
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: GLASS_COLORS.text,
    letterSpacing: -0.5,
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: GLASS_COLORS.surface,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 8,
  },
  
  // Main Grid - 3 columns like reference image
  mainGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  toolButtonLarge: {
    width: '31%',
    marginBottom: 12,
  },
  toolContentLarge: {
    aspectRatio: 1.1,
    backgroundColor: GLASS_COLORS.surface,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: GLASS_COLORS.border,
    // Subtle shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  
  // Feature Grid
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  toolButtonSmall: {
    width: '31%',
    marginBottom: 12,
  },
  toolContentSmall: {
    aspectRatio: 1.3,
    backgroundColor: GLASS_COLORS.surface,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: GLASS_COLORS.border,
  },
  
  toolContent: {
    padding: 12,
  },
  toolIcon: {
    marginBottom: 8,
    opacity: 0.9,
  },
  toolLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: GLASS_COLORS.text,
    textAlign: 'center',
  },
  toolLabelLarge: {
    fontSize: 14,
    fontWeight: '600',
  },
  toolSubtitle: {
    fontSize: 11,
    color: GLASS_COLORS.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    backgroundColor: 'rgba(120, 120, 128, 0.24)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 11,
    color: GLASS_COLORS.textSecondary,
    marginRight: 2,
  },
  
  // Divider
  divider: {
    height: 1,
    backgroundColor: GLASS_COLORS.border,
    marginVertical: 16,
    marginHorizontal: 8,
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
  
  // AI Selector Sub-Modal
  subModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  subModalDismiss: {
    flex: 1,
  },
  aiSelectorContainer: {
    backgroundColor: GLASS_COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    borderTopWidth: 1,
    borderColor: GLASS_COLORS.border,
  },
  aiSelectorHandle: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  aiSelectorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: GLASS_COLORS.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  aiModelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: GLASS_COLORS.surface,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  aiModelItemActive: {
    borderColor: GLASS_COLORS.accent,
    backgroundColor: 'rgba(10, 132, 255, 0.1)',
  },
  aiModelIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  aiModelInfo: {
    flex: 1,
  },
  aiModelName: {
    fontSize: 16,
    fontWeight: '600',
    color: GLASS_COLORS.text,
  },
  aiModelProvider: {
    fontSize: 13,
    color: GLASS_COLORS.textSecondary,
    marginTop: 2,
  },
});

