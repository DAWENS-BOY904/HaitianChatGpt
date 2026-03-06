import React, { useState, useCallback, useEffect } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

// Premium Glassmorphism Design System
const GLASS_COLORS = {
  background: 'rgba(28, 28, 30, 0.98)',
  surface: 'rgba(44, 44, 46, 0.85)',
  surfaceHover: 'rgba(58, 58, 60, 0.90)',
  border: 'rgba(255, 255, 255, 0.08)',
  text: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.65)',
  accent: '#007AFF',
  accentGlow: 'rgba(0, 122, 255, 0.25)',
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
  const [isRendered, setIsRendered] = useState(false);

  // Animation values
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.95);

  // Handle visibility changes with proper animation
  useEffect(() => {
    if (visible) {
      setIsRendered(true);
      // Animate in
      translateY.value = withSpring(0, { 
        damping: 25, 
        stiffness: 300,
        mass: 0.8,
      });
      opacity.value = withTiming(1, { duration: 250 });
      scale.value = withSpring(1, { damping: 25, stiffness: 300 });
    } else {
      // Animate out
      translateY.value = withSpring(SCREEN_HEIGHT, { 
        damping: 25, 
        stiffness: 300 
      });
      opacity.value = withTiming(0, { duration: 200 });
      scale.value = withSpring(0.95, { damping: 25, stiffness: 300 });
      
      // Delay unmounting to allow animation to complete
      const timer = setTimeout(() => {
        setIsRendered(false);
        setShowWebSearchOptions(false);
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [visible]);

  // Handle back button on Android
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (visible) {
        onClose();
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [visible, onClose]);

  const modalAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value }
    ],
    opacity: opacity.value,
  }));

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      opacity.value,
      [0, 1],
      [0, 1],
      Extrapolate.CLAMP
    ),
  }));

  // Pan gesture for swipe down to close
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationY > 0) {
        translateY.value = e.translationY;
        opacity.value = 1 - (e.translationY / (SCREEN_HEIGHT * 0.5));
        scale.value = 1 - (e.translationY / (SCREEN_HEIGHT * 2));
      }
    })
    .onEnd((e) => {
      if (e.translationY > 100 || e.velocityY > 500) {
        runOnJS(onClose)();
      } else {
        translateY.value = withSpring(0, { damping: 25, stiffness: 300 });
        opacity.value = withTiming(1, { duration: 200 });
        scale.value = withSpring(1, { damping: 25, stiffness: 300 });
      }
    });

  /* ---------------- MEDIA PICKERS ---------------- */
  const handlePickImages = async () => {
    setLoadingTool('photos');
    try {
      // Check daily photo upload limit
      const today = new Date().toDateString();
      const uploadedToday = await AsyncStorage.getItem(`photo_uploads_${today}`);
      const uploadCount = uploadedToday ? parseInt(uploadedToday) : 0;

      if (uploadCount >= 10) {
        alert('You have reached the daily limit of 10 photo uploads. Please try again tomorrow.');
        return;
      }

      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        alert('Permission to access media library is required!');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets.length > 0) {
        // Check if this would exceed the limit
        const newCount = uploadCount + result.assets.length;
        if (newCount > 10) {
          alert(`You can only upload ${10 - uploadCount} more photos today.`);
          return;
        }

        // Update upload count
        await AsyncStorage.setItem(`photo_uploads_${today}`, newCount.toString());

        onPickMedia(
          result.assets.map(asset => ({
            type: 'image',
            uri: asset.uri,
            base64: asset.base64,
          })),
        );
        onClose();
      }
    } catch (error) {
      console.error('Error picking images:', error);
    } finally {
      setLoadingTool(null);
    }
  };

  const handlePickFile = async () => {
    setLoadingTool('files');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
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
    } catch (error) {
      console.error('Error picking file:', error);
    } finally {
      setLoadingTool(null);
    }
  };

  const handleToolPress = useCallback((toolId: string, action: () => void) => {
    if (loadingTool) return;
    action();
  }, [loadingTool]);

  /* ---------------- TOOLS CONFIG (3x2 GRID) ---------------- */
  const mainTools = [
    {
      id: 'camera',
      label: 'Camera',
      icon: 'camera-outline',
      gradient: ['#667eea', '#764ba2'],
      action: () => {
        onOpenCamera?.();
        onClose();
      },
    },
    {
      id: 'photos',
      label: 'Photos',
      icon: 'image-outline',
      gradient: ['#f093fb', '#f5576c'],
      action: handlePickImages,
    },
    {
      id: 'files',
      label: 'Files',
      icon: 'folder-open-outline',
      gradient: ['#4facfe', '#00f2fe'],
      action: handlePickFile,
    },
    {
      id: 'wechat',
      label: 'WeChat files',
      icon: 'chatbubble-ellipses-outline',
      gradient: ['#43e97b', '#38f9d7'],
      action: () => {
        // Handle WeChat files
        onClose();
      },
    },
    {
      id: 'call',
      label: 'Call',
      icon: 'call-outline',
      gradient: ['#fa709a', '#fee140'],
      action: () => {
        navigation.navigate('voice-control');
        onClose();
      },
    },
    {
      id: 'presets',
      label: 'Presets',
      icon: 'cube-outline',
      gradient: ['#30cfd0', '#330867'],
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
        entering={FadeInUp.delay(index * 60).duration(400).springify()}
        style={styles.toolButtonContainer}
      >
        <TouchableOpacity
          style={[
            styles.toolButton,
            { backgroundColor: GLASS_COLORS.surface }
          ]}
          onPress={() => handleToolPress(tool.id, tool.action)}
          activeOpacity={0.7}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={GLASS_COLORS.accent} />
          ) : (
            <>
              <View style={[
                styles.iconContainer,
                { backgroundColor: `${tool.gradient[0]}20` }
              ]}>
                <Ionicons name={tool.icon} size={26} color={tool.gradient[0]} />
              </View>
              <Text style={styles.toolLabel}>{tool.label}</Text>
            </>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // Don't render if not visible and not rendered yet
  if (!visible && !isRendered) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none" // We handle animation manually with Reanimated
      statusBarTranslucent
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
    >
      <View style={styles.overlay}>
        {/* Animated Backdrop */}
        <Animated.View style={[styles.backdrop, backdropAnimatedStyle]}>
          <BlurView 
            intensity={30} 
            tint="dark" 
            style={StyleSheet.absoluteFill} 
          />
          <TouchableOpacity
            style={styles.dismissArea}
            activeOpacity={1}
            onPress={onClose}
          />
        </Animated.View>

        {/* Modal Content */}
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.container, modalAnimatedStyle]}>
            {/* Handle Bar */}
            <View style={styles.handleBarContainer}>
              <View style={styles.handleBar} />
            </View>

            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {/* Main Tools Grid - 3 columns, 2 rows */}
              <View style={styles.mainGrid}>
                {mainTools.map((tool, index) => renderToolButton(tool, index))}
              </View>

              {/* Web Search Row with Toggle */}
              <Animated.View entering={FadeInUp.delay(400).duration(400)}>
                <TouchableOpacity
                  style={styles.webSearchRow}
                  onPress={() => setShowWebSearchOptions(!showWebSearchOptions)}
                  activeOpacity={0.7}
                >
                  <View style={styles.webSearchLeft}>
                    <View style={[styles.webSearchIconContainer, { backgroundColor: 'rgba(0, 122, 255, 0.15)' }]}>
                      <Ionicons name="globe-outline" size={22} color={GLASS_COLORS.accent} />
                    </View>
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
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  dismissArea: {
    flex: 1,
  },
  container: {
    backgroundColor: GLASS_COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    // CRITICAL FIX: Use flexible height instead of maxHeight
    minHeight: SCREEN_HEIGHT * 0.4,
    maxHeight: SCREEN_HEIGHT * 0.85, // Increased from 0.7
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderTopWidth: 1,
    borderColor: GLASS_COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 20,
    // CRITICAL: Ensure modal is always visible
    position: 'relative',
  },
  handleBarContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  handleBar: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  scrollView: {
    flex: 1,
    // CRITICAL FIX: Ensure scroll works properly
  },
  scrollContent: {
    padding: 20,
    paddingTop: 12,
    // CRITICAL FIX: Add bottom padding for safe scrolling
    paddingBottom: 40,
  },
  // 3x2 Grid - 3 columns, 2 rows
  mainGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 12,
  },
  toolButtonContainer: {
    width: (SCREEN_WIDTH - 64) / 3, // 3 columns with padding
    maxWidth: 120,
  },
  toolButton: {
    backgroundColor: GLASS_COLORS.surface,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 8,
    minHeight: 110,
    borderWidth: 1,
    borderColor: GLASS_COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  toolLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: GLASS_COLORS.text,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  // Web Search Row
  webSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: GLASS_COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: GLASS_COLORS.border,
    marginTop: 4,
  },
  webSearchLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  webSearchIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webSearchText: {
    fontSize: 16,
    fontWeight: '600',
    color: GLASS_COLORS.text,
  },
  webSearchRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  webSearchBadge: {
    fontSize: 15,
    color: GLASS_COLORS.textSecondary,
    fontWeight: '500',
  },
  // Web Search Options
  webSearchOptions: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 12,
    padding: 4,
    marginTop: 8,
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
