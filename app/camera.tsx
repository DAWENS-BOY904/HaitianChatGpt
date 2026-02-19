import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Alert,
  AppState,
  AppStateStatus,
  Platform,
} from 'react-native';
import { CameraView, CameraType, FlashMode, CameraMode } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Slider from '@react-native-community/slider';
import Animated, { 
  FadeIn, 
  FadeOut, 
  useAnimatedStyle, 
  withSpring 
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Types
type CaptureMode = 'photo' | 'video';

interface CameraState {
  hasPermission: boolean | null;
  facing: CameraType;
  flash: FlashMode;
  zoom: number;
  mode: CaptureMode;
  isRecording: boolean;
  isCapturing: boolean;
  videoDuration: number;
}

export default function CameraScreen() {
  const cameraRef = useRef<CameraView>(null);
  const router = useRouter();
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Consolidated state
  const [state, setState] = useState<CameraState>({
    hasPermission: null,
    facing: 'back',
    flash: 'off',
    zoom: 0,
    mode: 'photo',
    isRecording: false,
    isCapturing: false,
    videoDuration: 0,
  });

  // Destructure for convenience
  const { hasPermission, facing, flash, zoom, mode, isRecording, isCapturing, videoDuration } = state;

  // Update state helper
  const updateState = useCallback((updates: Partial<CameraState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  /* -------- PERMISSIONS -------- */
  useEffect(() => {
    checkPermissions();
    
    // Handle app state changes (stop recording if app goes to background)
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
      stopRecordingTimer();
    };
  }, []);

  const checkPermissions = async () => {
    try {
      const [cameraStatus, libraryStatus, microphoneStatus] = await Promise.all([
        CameraView.requestCameraPermissionsAsync(),
        ImagePicker.requestMediaLibraryPermissionsAsync(),
        CameraView.requestMicrophonePermissionsAsync(),
      ]);

      const allGranted = 
        cameraStatus.status === 'granted' && 
        libraryStatus.status === 'granted' && 
        microphoneStatus.status === 'granted';

      updateState({ hasPermission: allGranted });

      if (!allGranted) {
        Alert.alert(
          'Permissions Required',
          'Camera, microphone, and photo library access are needed to use this feature.',
          [{ text: 'Open Settings', onPress: openSettings }, { text: 'Cancel' }]
        );
      }
    } catch (error) {
      console.error('Permission error:', error);
      updateState({ hasPermission: false });
    }
  };

  const openSettings = () => {
    // Linking.openSettings() - import from react-native if needed
    Alert.alert('Please enable permissions in Settings');
  };

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
      // App came to foreground
    } else if (nextAppState.match(/inactive|background/)) {
      // App went to background - stop recording
      if (isRecording) {
        stopVideo();
      }
    }
    appStateRef.current = nextAppState;
  };

  /* -------- CAPTURE HANDLERS -------- */
  const handleCapturePress = useCallback(async () => {
    if (mode === 'photo') {
      await takePhoto();
    } else {
      if (isRecording) {
        stopVideo();
      } else {
        startVideo();
      }
    }
  }, [mode, isRecording]);

  const takePhoto = async () => {
    if (!cameraRef.current || isRecording || isCapturing) return;

    try {
      updateState({ isCapturing: true });
      
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        skipProcessing: false,
      });

      if (!photo?.uri) throw new Error('Failed to capture photo');

      // Apply subtle enhancements
      const manipulated = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 1920 } }], // Resize to reasonable max dimension
        { 
          compress: 0.9, 
          format: ImageManipulator.SaveFormat.JPEG 
        }
      );

      router.push({
        pathname: '/preview',
        params: { uri: manipulated.uri, type: 'image' },
      });
    } catch (error) {
      console.error('Photo capture error:', error);
      Alert.alert('Error', 'Failed to capture photo');
    } finally {
      updateState({ isCapturing: false });
    }
  };

  const startVideo = async () => {
    if (!cameraRef.current || isRecording) return;

    try {
      updateState({ isRecording: true, mode: 'video' });
      
      // Start duration timer
      recordingTimerRef.current = setInterval(() => {
        setState(prev => ({ ...prev, videoDuration: prev.videoDuration + 1 }));
      }, 1000);

      const video = await cameraRef.current.recordAsync({
        maxDuration: 60,
        maxFileSize: 100 * 1024 * 1024, // 100MB limit
      });

      if (video?.uri) {
        router.push({
          pathname: '/preview',
          params: { uri: video.uri, type: 'video' },
        });
      }
    } catch (error) {
      console.error('Video recording error:', error);
      Alert.alert('Error', 'Failed to start recording');
      updateState({ isRecording: false, mode: 'photo' });
    } finally {
      stopRecordingTimer();
    }
  };

  const stopVideo = useCallback(() => {
    if (cameraRef.current && isRecording) {
      cameraRef.current.stopRecording();
    }
    stopRecordingTimer();
    updateState({ isRecording: false, mode: 'photo', videoDuration: 0 });
  }, [isRecording]);

  const stopRecordingTimer = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  /* -------- GALLERY -------- */
  const openGallery = async () => {
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
      console.error('Gallery error:', error);
      Alert.alert('Error', 'Failed to open gallery');
    }
  };

  /* -------- CONTROLS -------- */
  const toggleFacing = useCallback(() => {
    updateState({ facing: facing === 'back' ? 'front' : 'back' });
  }, [facing]);

  const toggleFlash = useCallback(() => {
    updateState({ flash: flash === 'on' ? 'off' : 'on' });
  }, [flash]);

  const toggleMode = useCallback(() => {
    updateState({ mode: mode === 'photo' ? 'video' : 'photo' });
  }, [mode]);

  /* -------- RENDER HELPERS -------- */
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  /* -------- RENDER STATES -------- */
  if (hasPermission === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Requesting permissions...</Text>
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <Ionicons name="camera-off" size={64} color="#666" />
        <Text style={styles.errorText}>Camera access denied</Text>
        <TouchableOpacity style={styles.retryButton} onPress={checkPermissions}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        flash={flash}
        zoom={zoom}
        mode={mode}
        enableZoomGesture
        responsiveOrientationWhenOrientationLocked
      >
        {/* TOP CONTROLS */}
        <View style={styles.topBar}>
          <TouchableOpacity 
            style={styles.iconButton} 
            onPress={() => router.back()}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.iconButton} 
            onPress={toggleFlash}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <Ionicons
              name={flash === 'on' ? 'flash' : 'flash-off'}
              size={24}
              color="#fff"
            />
          </TouchableOpacity>
        </View>

        {/* MODE SELECTOR */}
        <View style={styles.modeSelector}>
          <TouchableOpacity onPress={() => updateState({ mode: 'photo' })}>
            <Text style={[
              styles.modeText, 
              mode === 'photo' && styles.modeTextActive
            ]}>
              PHOTO
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => updateState({ mode: 'video' })}>
            <Text style={[
              styles.modeText, 
              mode === 'video' && styles.modeTextActive
            ]}>
              VIDEO
            </Text>
          </TouchableOpacity>
        </View>

        {/* ZOOM SLIDER */}
        <View style={styles.zoomContainer}>
          <Text style={styles.zoomText}>{Math.round(zoom * 100)}%</Text>
          <Slider
            minimumValue={0}
            maximumValue={1}
            value={zoom}
            onValueChange={(value) => updateState({ zoom: value })}
            minimumTrackTintColor="#fff"
            maximumTrackTintColor="rgba(255,255,255,0.3)"
            thumbTintColor="#fff"
            style={styles.zoomSlider}
          />
        </View>

        {/* RECORDING INDICATOR */}
        {isRecording && (
          <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.recordingIndicator}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>{formatDuration(videoDuration)}</Text>
          </Animated.View>
        )}

        {/* BOTTOM CONTROLS */}
        <View style={styles.bottomBar}>
          {/* Gallery Button */}
          <TouchableOpacity 
            style={styles.galleryButton} 
            onPress={openGallery}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <Ionicons name="images" size={28} color="#fff" />
          </TouchableOpacity>

          {/* Capture Button */}
          <View style={styles.captureContainer}>
            <TouchableOpacity
              style={[
                styles.captureButton,
                mode === 'video' && styles.videoCaptureButton,
                isRecording && styles.recordingButton,
              ]}
              onPress={handleCapturePress}
              disabled={isCapturing}
              activeOpacity={0.8}
            >
              {isRecording ? (
                <View style={styles.stopIcon} />
              ) : mode === 'video' ? (
                <View style={styles.videoIndicator} />
              ) : (
                <View style={styles.photoIndicator} />
              )}
            </TouchableOpacity>
            
            {mode === 'video' && !isRecording && (
              <Text style={styles.tapHint}>Tap to record</Text>
            )}
          </View>

          {/* Flip Camera Button */}
          <TouchableOpacity 
            style={styles.flipButton} 
            onPress={toggleFacing}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <Ionicons name="camera-reverse" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      </CameraView>
    </View>
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
  },
  errorText: {
    color: '#fff',
    fontSize: 18,
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  retryText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Top Bar
  topBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconButton: {
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 20,
  },
  
  // Mode Selector
  modeSelector: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 70,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 24,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  modeText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1,
  },
  modeTextActive: {
    color: '#fff',
  },
  
  // Zoom
  zoomContainer: {
    position: 'absolute',
    right: 16,
    top: SCREEN_HEIGHT / 2 - 100,
    height: 200,
    alignItems: 'center',
  },
  zoomText: {
    color: '#fff',
    fontSize: 12,
    marginBottom: 8,
    fontWeight: '600',
  },
  zoomSlider: {
    width: 200,
    transform: [{ rotate: '-90deg' }],
  },
  
  // Recording Indicator
  recordingIndicator: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 120 : 90,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff0000',
  },
  recordingText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  
  // Bottom Bar
  bottomBar: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 40 : 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  galleryButton: {
    padding: 12,
  },
  captureContainer: {
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
  photoIndicator: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#fff',
  },
  videoIndicator: {
    width: 30,
    height: 30,
    borderRadius: 4,
    backgroundColor: '#ff0000',
  },
  stopIcon: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  tapHint: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 8,
  },
  flipButton: {
    padding: 12,
  },
});
