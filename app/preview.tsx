import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as MediaLibrary from 'expo-media-library';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function PreviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { uri, type } = useLocalSearchParams<{
    uri?: string;
    type?: 'image' | 'video';
  }>();

  const [loading, setLoading] = useState(false);

  if (!uri || !type) {
    return (
      <View style={styles.center}>
        <Text style={{ color: '#fff' }}>Invalid media</Text>
      </View>
    );
  }

  /* -------- RETAKE -------- */
  const handleRetake = () => router.back();

  /* -------- SAVE -------- */
  const handleSave = async () => {
    try {
      setLoading(true);
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied');
        return;
      }
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('Saved', 'Media saved to gallery');
    } catch {
      Alert.alert('Error', 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  /* -------- SEND (TEMP) -------- */
  const handleSend = () => {
    Alert.alert('Send', 'Send logic goes here');
  };

  return (
    <View style={styles.container}>
      {/* MEDIA */}
      {type === 'video' ? (
        <Video
          source={{ uri }}
          style={styles.media}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay
          useNativeControls
        />
      ) : (
        <Image source={{ uri }} style={styles.media} resizeMode="contain" />
      )}

      {/* TOP */}
      <View style={[styles.topBar, { top: insets.top + 10 }]}>
        <TouchableOpacity style={styles.closeBtn} onPress={router.back}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* BOTTOM */}
      <View style={[styles.bottomBar, { bottom: insets.bottom + 20 }]}>
        <Action icon="refresh" label="Retake" onPress={handleRetake} />
        <Action
          icon="send"
          label="Send"
          primary
          onPress={handleSend}
        />
        <Action icon="download" label="Save" onPress={handleSave} />
      </View>

      {loading && (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}
    </View>
  );
}

/* -------- BUTTON -------- */
function Action({
  icon,
  label,
  onPress,
  primary,
}: {
  icon: any;
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <TouchableOpacity onPress={onPress}>
      <View style={[styles.btn, primary && styles.primary]}>
        <Ionicons name={icon} size={26} color="#000" />
      </View>
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
}

/* -------- STYLES -------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  media: { width: '100%', height: '100%' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  topBar: { position: 'absolute', left: 20 },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },

  btn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FFCC00',
  },
  label: { color: '#fff', textAlign: 'center', marginTop: 6 },

  loading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
