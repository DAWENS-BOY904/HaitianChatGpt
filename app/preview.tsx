import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';

export default function PreviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [uri, setUri] = useState<string | null>(null);
  const [type, setType] = useState<'image' | 'video'>('image');
  const [ready, setReady] = useState(false);

  // 🔑 WAIT FOR PARAMS
  useEffect(() => {
    if (typeof params.uri === 'string') {
      setUri(params.uri);
      setType(params.type === 'video' ? 'video' : 'image');
      setReady(true);
    }
  }, [params]);

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  if (!uri) {
    return (
      <View style={styles.center}>
        <Text style={{ color: '#fff' }}>No media found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: '#FFCC00', marginTop: 10 }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {type === 'video' ? (
        <Video
          source={{ uri }}
          style={styles.media}
          resizeMode={ResizeMode.CONTAIN}
          useNativeControls
        />
      ) : (
        <Image source={{ uri }} style={styles.media} resizeMode="contain" />
      )}

      <TouchableOpacity
        style={styles.close}
        onPress={() => router.back()}
      >
        <Ionicons name="close" size={26} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  media: { width: '100%', height: '100%' },
  close: {
    position: 'absolute',
    top: 50,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
