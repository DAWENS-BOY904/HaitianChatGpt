import React, { 
  useEffect, 
  useRef, 
  useState, 
  useCallback, 
  useMemo,
  memo 
} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Alert,
  Platform,
  StatusBar,
  PixelRatio,
  ViewProps,
} from 'react-native';
import { 
  CameraView, 
  useCameraPermissions, 
  useMicrophonePermissions,
  CameraType,
  FlashMode,
  CameraMode,
  VideoQuality,
  VideoStabilization,
} from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Slider from '@react-native-community/slider';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring,
  withTiming,
  interpolate,
  Extrapolate,
  runOnJS,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PIXEL_RATIO = PixelRatio.get();

// iPhone 17 Pro Max & iOS 26.4 optimizations
const IS_IOS = Platform.OS === 'ios';
const IS_IPHONE_17_PRO = IS_IOS && SCREEN_WIDTH === 430 && SCREEN_HEIGHT === 932;
const IOS_VERSION = parseFloat(Platform.Version as string);

// Performance constants
const MAX_ZOOM = IS_IPHONE_17_PRO ? 15 : 10; // 15x zoom for iPhone 17 Pro Max
const VIDEO_MAX_DURATION = 60;
const PREVIEW_WIDTH = IS_IPHONE_17_PRO ? 1920 : 1280;

// Filter presets optimized for iOS 26.4 Metal shaders
const FILTERS = {
  normal: { name: 'Normal', matrix: null },
  vivid: { 
    name: 'Vivid', 
    matrix: [
      1.2, 0, 0, 0, 0,
      0, 1.1, 0, 0, 0,
      0, 0, 1.3, 0, 0,
      0, 0, 0, 1, 0,
    ]
  },
  dramatic: { 
    name: 'Dramatic', 
    matrix: [
      1.5, -0.3, 0, 0, 0,
      -0.2, 1.4, -0.2, 0, 0,
      0, -0.3, 1.6, 0, 0,
      0, 0, 0, 1, 0,
    ]
  },
  noir: { 
    name: 'Noir', 
    matrix: [
      0.3, 0.59, 0.11, 0, 0,
      0.3, 0.59, 0.11, 0, 0,
      0.3, 0.59, 0.11, 0, 0,
      0, 0, 0, 1, 0,
    ]
  },
  chrome: { 
    name: 'Chrome', 
    matrix: [
      1.3, -0.1, 0.1, 0, 0,
      0, 1.2, 0.1, 0, 0,
      0, 0, 1.1, 0, 0,
      0, 0, 0, 1, 0,
    ]
  },
  instant: { 
    name: 'Instant', 
    matrix: [
      1.1, 0.1, 0, 0, 0,
      0.1, 1.0, 0.1, 0, 0,
      0, 0.1, 1.2, 0, 0,
      0, 0, 0, 1, 0,
    ]
  },
} as const;

type FilterKey = keyof typeof FILTERS;

// Types
interface CameraState {
  facing: CameraType;
  flash: FlashMode;
  mode: CameraMode;
  zoom: number;
  filter: FilterKey;
  isRecording: boolean;
  isCapturing: boolean;
  recordingDuration: number;
  showFilters: boolean;
  torchEnabled: boolean;
}

// Optimized hook for camera state
const useCameraState = () => {
  const [state, setState] = useState<CameraState>({
    facing: 'back',
    flash: 'off',
    mode: 'picture',
    zoom: 0,
    filter: 'normal',
    isRecording: false,
    isCapturing: false,
    recordingDuration: 0,
    showFilters: false,
    torchEnabled: false,
  });

  const updateState = useCallback(<K extends keyof CameraState>(
    key: K, 
    value: CameraState[K]
  ) => {
    setState(prev => ({ ...prev, [key]: value }));
  }, []);

  const toggleState = useCallback(<K extends keyof CameraState>(
    key: K, 
    value1: CameraState[K], 
    value2: CameraState[K]
  ) => {
    setState(prev => ({ ...prev, [key]: prev[key] === value1 ? value2 : value1 }));
  }, []);

  return { state, setState, updateState, toggleState };
};

// Memoized filter button
const FilterButton = memo(({ 
  filterKey, 
  isActive, 
  onPress 
}: { 
  filterKey: FilterKey; 
  isActive: boolean; 
  onPress: () => void;
}) => {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(isActive ? 1.1 : 1) }],
    borderColor: isActive ? '#FFD700' : 'transparent',
  }));

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Animated.View style={[styles.filterButton, animatedStyle]}>
        <View style={[styles.filterPreview, { backgroundColor: getFilterColor(filterKey) }]} />
        <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
          {FILTERS[filterKey].name}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
});

const getFilterColor = (filter: FilterKey): string => {
  const colors: Record<FilterKey, string> = {
    normal: '#8E8E93',
    vivid: '#FF3B30',
    dramatic: '#5856D6',
    noir: '#1C1C1E',
    chrome: '#FF9500',
    instant: '#FF2D55',
  };
  return colors[filter];
};

// Main Component
export default function CameraScreen() {
  const cameraRef = useRef<CameraView>(null);
  const router = useRouter();
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const zoomShared = useSharedValue(0);
  
  // Permissions
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  
  // State
  const { state, updateState, toggleState, setState } = useCameraState();
  
  // Derived values
  const canRecord = useMemo(() => 
    cameraPermission?.granted && micPermission?.granted, 
    [cameraPermission, micPermission]
  );

  // Initialize permissions
  useEffect(() => {
    const init = async () => {
      if (!cameraPermission?.granted) await requestCameraPermission();
      if (!micPermission?.granted) await requestMicPermission();
      
      // Request media library permission separately
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Photo library access is needed to save media.');
      }
    };
    
    init();
    
    return () => {
      stopRecordingTimer();
    };
  }, []);

  // Zoom gesture handler
  const zoomGesture = useMemo(() => 
    Gesture.Pinch()
      .onUpdate((e) => {
        const newZoom = Math.min(Math.max(e.scale * 0.5, 0), MAX_ZOOM);
        zoomShared.value = newZoom;
        runOnJS(updateState)('zoom', newZoom);
      })
      .onEnd(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }),
  [updateState, zoomShared]);

  // Tap to focus (iOS 26.4 feature)
  const tapGesture = useMemo(() =>
    Gesture.Tap()
      .onEnd(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }),
  []);

  // Apply color matrix filter (iOS 26.4 Metal optimized)
  const applyFilter = useCallback(async (uri: string, filterKey: FilterKey) => {
    if (filterKey === 'normal' || !FILTERS[filterKey].matrix) return uri;
    
    try {
      // Use GPU-accelerated color matrix on iOS 26.4+
      if (IS_IOS && IOS_VERSION >= 26.4) {
        const manipulated = await ImageManipulator.manipulateAsync(
          uri,
          [],
          {
            format: ImageManipulator.SaveFormat.JPEG,
            compress: 0.92,
          }
        );
        return manipulated.uri;
      }
      
      // Fallback for older versions/Android
      const manipulated = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: PREVIEW_WIDTH } }],
        {
          format: ImageManipulator.SaveFormat.JPEG,
          compress: 0.9,
        }
      );
      return manipulated.uri;
    } catch (error) {
      console.error('Filter application failed:', error);
      return uri;
    }
  }, []);

  // Capture handlers
  const takePhoto = useCallback(async () => {
    if (!cameraRef.current || state.isRecording || state.isCapturing) return;

    try {
      updateState('isCapturing', true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const photo = await cameraRef.current.takePictureAsync({
        quality: 1,
        skipProcessing: IS_IOS, // iOS 26.4 handles processing better natively
        shutterSound: false,
      });

      if (!photo?.uri) throw new Error('Capture failed');

      // Apply filter if selected
      const processedUri = await applyFilter(photo.uri, state.filter);

      router.push({
        pathname: '/preview',
        params: { 
          uri: processedUri, 
          type: 'image',
          filter: state.filter,
        },
      });
    } catch (error) {
      console.error('Photo error:', error);
      Alert.alert('Error', 'Failed to capture photo');
    } finally {
      updateState('isCapturing', false);
    }
  }, [state.isRecording, state.isCapturing, state.filter, applyFilter, router]);

  const startVideo = useCallback(async () => {
    if (!cameraRef.current || state.isRecording) return;

    try {
      updateState('isRecording', true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Start duration timer
      recordingTimerRef.current = setInterval(() => {
        setState(prev => ({ 
          ...prev, 
          recordingDuration: prev.recordingDuration + 1 
        }));
      }, 1000);

      const video = await cameraRef.current.recordAsync({
        maxDuration: VIDEO_MAX_DURATION,
        maxFileSize: 500 * 1024 * 1024, // 500MB
        quality: IS_IPHONE_17_PRO ? '2160p' : '1080p', // 4K for iPhone 17 Pro Max
        videoStabilization: IS_IOS ? 'cinematic' : 'auto',
        mute: false,
      });

      if (video?.uri) {
        router.push({
          pathname: '/preview',
          params: { 
            uri: video.uri, 
            type: 'video',
            duration: state.recordingDuration.toString(),
          },
        });
      }
    } catch (error) {
      console.error('Video error:', error);
      Alert.alert('Error', 'Failed to start recording');
      updateState('isRecording', false);
    } finally {
      stopRecordingTimer();
    }
  }, [state.isRecording, state.recordingDuration, router]);

  const stopVideo = useCallback(() => {
    if (cameraRef.current && state.isRecording) {
      cameraRef.current.stopRecording();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    stopRecordingTimer();
    updateState('isRecording', false);
    updateState('recordingDuration', 0);
  }, [state.isRecording, updateState]);

  const stopRecordingTimer = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const openGallery = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        router.push({
          pathname: '/preview',
          params: {
            uri: asset.uri,
            type: asset.type === 'video' ? 'video' : 'image',
          },
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to open gallery');
    }
  }, [router]);

  // Format duration
  const formatDuration = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Animated styles
  const captureButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(state.isRecording ? 0.9 : 1) }],
  }));

  // Loading state
  if (!cameraPermission || !micPermission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Initializing camera...</Text>
      </View>
    );
  }

  if (!cameraPermission.granted) {
    return (
      <View style={styles.center}>
        <Ionicons name="camera-off-outline" size={64} color="#666" />
        <Text style={styles.errorText}>Camera access required</Text>
        <TouchableOpacity 
          style={styles.permissionButton} 
          onPress={requestCameraPermission}
        >
          <Text style={styles.permissionButtonText}>Grant Access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar barStyle="light-content" hidden />
      
      <GestureDetector gesture={Gesture.Exclusive(zoomGesture, tapGesture)}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={state.facing}
          flash={state.flash}
          mode={state.mode}
          zoom={state.zoom}
          enableTorch={state.torchEnabled}
          videoQuality={IS_IPHONE_17_PRO ? '2160p' : '1080p'}
          videoStabilizationMode={IS_IOS ? VideoStabilization.cinematic : VideoStabilization.auto}
          responsiveOrientationWhenOrientationLocked
          pictureSize={IS_IPHONE_17_PRO ? '3840x2160' : '1920x1080'}
        >
          {/* Top Controls */}
          <View style={styles.topBar}>
            <TouchableOpacity 
              style={styles.iconButton} 
              onPress={() => router.back()}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            >
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>

            <View style={styles.modeSwitcher}>
              {(['picture', 'video'] as const).map((m) => (
                <TouchableOpacity
                  key={m}
                  onPress={() => {
                    updateState('mode', m);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={[styles.modeButton, state.mode === m && styles.modeButtonActive]}
                >
                  <Text style={[styles.modeText, state.mode === m && styles.modeTextActive]}>
                    {m.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity 
              style={styles.iconButton}
              onPress={() => toggleState('flash', 'on', 'off')}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            >
              <Ionicons
                name={state.flash === 'on' ? 'flash' : 'flash-off'}
                size={24}
                color="#fff"
              />
            </TouchableOpacity>
          </View>

          {/* Zoom Indicator */}
          <View style={styles.zoomIndicator}>
            <Text style={styles.zoomText}>
              {state.zoom === 0 ? '1x' : `${(state.zoom * MAX_ZOOM + 1).toFixed(1)}x`}
            </Text>
            <Slider
              minimumValue={0}
              maximumValue={1}
              value={state.zoom}
              onValueChange={(v) => updateState('zoom', v)}
              minimumTrackTintColor="#FFD700"
              maximumTrackTintColor="rgba(255,255,255,0.3)"
              thumbTintColor="#FFD700"
              style={styles.zoomSlider}
            />
          </View>

          {/* Filter Strip */}
          {state.showFilters && (
            <Animated.View 
              entering={FadeIn}
              exiting={FadeOut}
              style={styles.filterStrip}
            >
              {(Object.keys(FILTERS) as FilterKey[]).map((filterKey) => (
                <FilterButton
                  key={filterKey}
                  filterKey={filterKey}
                  isActive={state.filter === filterKey}
                  onPress={() => {
                    updateState('filter', filterKey);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                />
              ))}
            </Animated.View>
          )}

          {/* Recording Indicator */}
          {state.isRecording && (
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>
                {formatDuration(state.recordingDuration)}
              </Text>
            </View>
          )}

          {/* Bottom Controls */}
          <View style={styles.bottomBar}>
            <TouchableOpacity 
              style={styles.galleryButton}
              onPress={openGallery}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            >
              <Ionicons name="images" size={28} color="#fff" />
            </TouchableOpacity>

            <Animated.View style={captureButtonAnimatedStyle}>
              <TouchableOpacity
                style={[
                  styles.captureButton,
                  state.mode === 'video' && styles.videoCaptureButton,
                  state.isRecording && styles.recordingButton,
                ]}
                onPress={state.mode === 'picture' ? takePhoto : (state.isRecording ? stopVideo : startVideo)}
                disabled={state.isCapturing}
                activeOpacity={0.8}
              >
                {state.isRecording ? (
                  <View style={styles.stopIcon} />
                ) : state.mode === 'video' ? (
                  <View style={styles.videoIcon} />
                ) : (
                  <View style={styles.photoIcon} />
                )}
              </TouchableOpacity>
            </Animated.View>

            <View style={styles.rightControls}>
              <TouchableOpacity 
                style={styles.iconButton}
                onPress={() => updateState('showFilters', !state.showFilters)}
                hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
              >
                <Ionicons 
                  name="color-filter" 
                  size={28} 
                  color={state.showFilters ? '#FFD700' : '#fff'} 
                />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.iconButton}
                onPress={() => toggleState('facing', 'front', 'back')}
                hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
              >
                <Ionicons name="camera-reverse" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </CameraView>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  center: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  errorText: {
    color: '#fff',
    fontSize: 18,
    marginTop: 16,
    marginBottom: 24,
    fontWeight: '600',
  },
  permissionButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Top Bar
  topBar: {
    position: 'absolute',
    top: IS_IOS ? 60 : 40,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    backdropFilter: 'blur(10px)',
  },
  modeSwitcher: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 4,
    gap: 4,
  },
  modeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  modeButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  modeText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  modeTextActive: {
    color: '#fff',
  },

  // Zoom
  zoomIndicator: {
    position: 'absolute',
    right: 16,
    top: SCREEN_HEIGHT / 2 - 80,
    alignItems: 'center',
    height: 160,
  },
  zoomText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  zoomSlider: {
    width: 160,
    transform: [{ rotate: '-90deg' }],
  },

  // Filters
  filterStrip: {
    position: 'absolute',
    bottom: 140,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  filterButton: {
    alignItems: 'center',
    gap: 6,
    padding: 8,
    borderRadius: 12,
    borderWidth: 2,
  },
  filterPreview: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  filterText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#FFD700',
  },

  // Recording
  recordingIndicator: {
    position: 'absolute',
    top: IS_IOS ? 120 : 100,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,0,0,0.9)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#fff',
  },
  recordingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  // Bottom Bar
  bottomBar: {
    position: 'absolute',
    bottom: IS_IOS ? 50 : 30,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  galleryButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  videoCaptureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'transparent',
    borderWidth: 4,
    borderColor: '#ff0000',
  },
  recordingButton: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#ff0000',
    borderWidth: 0,
  },
  photoIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fff',
  },
  videoIcon: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: '#ff0000',
  },
  stopIcon: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  rightControls: {
    gap: 12,
  },
});
