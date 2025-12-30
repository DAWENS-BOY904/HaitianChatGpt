import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { CameraView, CameraType, FlashMode } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Slider from '@react-native-community/slider';

const { height } = Dimensions.get('window');

export default function CameraScreen() {
  const cameraRef = useRef<CameraView | null>(null);
  const router = useRouter();

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [zoom, setZoom] = useState(0);
  const [recording, setRecording] = useState(false);
  const [capturing, setCapturing] = useState(false);

  /* -------- PERMISSIONS -------- */
  useEffect(() => {
    (async () => {
      const cam = await CameraView.requestCameraPermissionsAsync();
      const gal = await ImagePicker.requestMediaLibraryPermissionsAsync();
      setHasPermission(
        cam.status === 'granted' && gal.status === 'granted'
      );
    })();
  }, []);

  /* -------- PHOTO -------- */
  const takePhoto = async () => {
    if (!cameraRef.current || recording) return;

    try {
      setCapturing(true);

      const photo = await cameraRef.current.takePictureAsync();

      const edited = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ adjust: { contrast: 1.1, saturation: 1.2 } }],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
      );

      router.push({
        pathname: 'preview',
        params: { uri: edited.uri, type: 'image' },
      });
    } finally {
      setCapturing(false);
    }
  };

  /* -------- VIDEO -------- */
  const startVideo = async () => {
    if (!cameraRef.current || recording) return;

    try {
      setRecording(true);
      const video = await cameraRef.current.recordAsync({ maxDuration: 60 });

      router.push({
        pathname: '/preview',
        params: { uri: video.uri, type: 'video' },
      });
    } finally {
      setRecording(false);
    }
  };

  const stopVideo = () => {
    if (recording && cameraRef.current) {
      cameraRef.current.stopRecording();
    }
  };

  /* -------- GALLERY -------- */
  const openGallery = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
    });

    if (!res.canceled) {
      const asset = res.assets[0];
      router.push({
        pathname: '/preview',
        params: {
          uri: asset.uri,
          type: asset.type === 'video' ? 'video' : 'image',
        },
      });
    }
  };

  /* -------- STATES -------- */
  if (hasPermission === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <Text style={{ color: '#fff' }}>Permission denied</Text>
      </View>
    );
  }

  /* -------- UI -------- */
  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        flash={flash}
        zoom={zoom}
      >
        {/* TOP */}
        <View style={styles.top}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setFlash(flash === 'on' ? 'off' : 'on')}
          >
            <Ionicons
              name={flash === 'on' ? 'flash' : 'flash-off'}
              size={26}
              color="#fff"
            />
          </TouchableOpacity>
        </View>

        {/* ZOOM */}
        <View style={styles.zoom}>
          <Slider
            minimumValue={0}
            maximumValue={1}
            value={zoom}
            onValueChange={setZoom}
            minimumTrackTintColor="#fff"
            maximumTrackTintColor="#666"
            style={{ width: 180 }}
          />
        </View>

        {/* BOTTOM */}
        <View style={styles.bottom}>
          <TouchableOpacity onPress={openGallery}>
            <Ionicons name="images" size={30} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.capture, recording && { backgroundColor: 'red' }]}
            onPress={takePhoto}
            onLongPress={startVideo}
            onPressOut={stopVideo}
            disabled={capturing}
          />

          <TouchableOpacity
            onPress={() =>
              setFacing(facing === 'back' ? 'front' : 'back')
            }
          >
            <Ionicons name="camera-reverse" size={30} color="#fff" />
          </TouchableOpacity>
        </View>
      </CameraView>
    </View>
  );
}

/* -------- STYLES -------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  center: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  top: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bottom: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  capture: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 5,
    borderColor: '#fff',
    backgroundColor: '#fff',
  },
  zoom: {
    position: 'absolute',
    right: -60,
    top: height / 2 - 60,
    transform: [{ rotate: '-90deg' }],
  },
});
