import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Slider from '@react-native-community/slider';

const { height } = Dimensions.get('window');

export default function CameraScreen() {
  const cameraRef = useRef<CameraView | null>(null);
  const router = useRouter();

  // Use the specific hooks provided by Expo for better stability
  const [permission, requestPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [mode, setMode] = useState<'picture' | 'video'>('picture');
  const [zoom, setZoom] = useState(0);
  const [recording, setRecording] = useState(false);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    (async () => {
      await requestPermission();
      await requestMicPermission();
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    })();
  }, []);

  /* -------- PHOTO -------- */
  const takePhoto = async () => {
    if (!cameraRef.current || recording || mode !== 'picture') return;

    try {
      setCapturing(true);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 1,
        exif: false,
      });

      if (photo) {
        // Note: 'adjust' isn't a standard ImageManipulator action in all versions. 
        // If this fails, use 'resize' or 'flip'.
        router.push({
          pathname: '/preview',
          params: { uri: photo.uri, type: 'image' },
        });
      }
    } catch (e) {
      console.error("Photo error:", e);
    } finally {
      setCapturing(false);
    }
  };

  /* -------- VIDEO -------- */
  // It is safer to switch modes via UI or a dedicated button 
  // rather than toggling inside the function.
  const startVideo = async () => {
    if (!cameraRef.current || recording) return;

    try {
      setRecording(true);
      const video = await cameraRef.current.recordAsync();
      if (video) {
        router.push({
          pathname: '/preview',
          params: { uri: video.uri, type: 'video' },
        });
      }
    } catch (e) {
      console.error("Video error:", e);
      setRecording(false);
    }
  };

  const stopVideo = () => {
    if (recording && cameraRef.current) {
      cameraRef.current.stopRecording();
      setRecording(false);
    }
  };

  if (!permission || !micPermission) {
    return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={{ color: '#fff', marginBottom: 20 }}>Camera access denied</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.button}>
          <Text style={{color: '#000'}}>Grant Permission</Text>
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
        enableTorch={flash === 'on'}
        zoom={zoom}
        mode={mode}
      >
        <View style={styles.top}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>

          {/* Mode Switcher: Vital for preventing crashes */}
          <View style={styles.modeContainer}>
            <TouchableOpacity onPress={() => setMode('picture')}>
              <Text style={[styles.modeText, mode === 'picture' && styles.activeMode]}>PHOTO</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setMode('video')}>
              <Text style={[styles.modeText, mode === 'video' && styles.activeMode]}>VIDEO</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => setFlash(prev => (prev === 'on' ? 'off' : 'on'))}>
            <Ionicons name={flash === 'on' ? 'flash' : 'flash-off'} size={26} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.bottom}>
          <TouchableOpacity onPress={() => {/* openGallery logic */}}>
            <Ionicons name="images" size={30} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.capture, recording && { backgroundColor: 'red' }]}
            onPress={mode === 'picture' ? takePhoto : (recording ? stopVideo : startVideo)}
            disabled={capturing}
          />

          <TouchableOpacity onPress={() => setFacing(prev => (prev === 'back' ? 'front' : 'back'))}>
            <Ionicons name="camera-reverse" size={30} color="#fff" />
          </TouchableOpacity>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  center: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  top: { position: 'absolute', top: 60, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bottom: { position: 'absolute', bottom: 40, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  capture: { width: 75, height: 75, borderRadius: 40, borderWidth: 4, borderColor: '#fff', backgroundColor: 'rgba(255, 255, 255, 0.3)' },
  modeContainer: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 5 },
  modeText: { color: '#aaa', marginHorizontal: 10, fontWeight: 'bold', fontSize: 12 },
  activeMode: { color: '#fff' },
  button: { backgroundColor: '#fff', padding: 12, borderRadius: 8 }
});
