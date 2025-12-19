import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as MediaLibrary from 'expo-media-library';
import { useTheme } from '../hooks/useTheme';
import { useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { useAuth } from '@/template';
import { Spacing, Typography } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function PreviewScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { uri, type } = useLocalSearchParams<{
    uri: string;
    type: 'image' | 'video';
  }>();

  const { showAlert } = useAlert();
  const { user } = useAuth();
  const supabase = getSupabaseClient();

  const [loading, setLoading] = useState(false);

  /* ---------------- RETAKE ---------------- */
  const handleRetake = () => {
    router.back();
  };

  /* ---------------- SAVE TO GALLERY ---------------- */
  const handleSave = async () => {
    try {
      setLoading(true);

      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Permission denied', 'Allow access to save media');
        return;
      }

      await MediaLibrary.saveToLibraryAsync(uri);
      showAlert('Saved', 'Media saved to gallery');
    } catch (e) {
      console.error(e);
      showAlert('Error', 'Failed to save media');
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- SEND TO CHAT (SUPABASE) ---------------- */
  const handleSendToChat = async () => {
    try {
      if (!user) {
        showAlert('Error', 'Please login first');
        return;
      }

      setLoading(true);

      const extension = type === 'video' ? 'mp4' : 'jpg';
      const contentType = type === 'video' ? 'video/mp4' : 'image/jpeg';
      const fileName = `${Date.now()}_${user.id}.${extension}`;
      const filePath = `${user.id}/${fileName}`;

      const { error } = await supabase.storage
        .from('media-files')
        .upload(
          filePath,
          {
            uri,
            name: fileName,
            type: contentType,
          } as any
        );

      if (error) throw error;

      const { data } = supabase.storage
        .from('media-files')
        .getPublicUrl(filePath);

      router.replace({
        pathname: '/home',
        params: {
          mediaUrl: data.publicUrl,
          mediaType: type,
        },
      });

      showAlert('Success', 'Media sent successfully');
    } catch (e) {
      console.error(e);
      showAlert('Error', 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- UI ---------------- */
  return (
    <View style={styles.container}>
      {/* MEDIA */}
      {type === 'video' ? (
        <Video
          source={{ uri }}
          style={styles.media}
          resizeMode={ResizeMode.CONTAIN}
          useNativeControls
          shouldPlay
          isLooping
        />
      ) : (
        <Image source={{ uri }} style={styles.media} resizeMode="contain" />
      )}

      {/* TOP BAR */}
      <View
        style={[
          styles.topBar,
          { top: Platform.OS === 'ios' ? insets.top + 10 : 20 },
        ]}
      >
        <TouchableOpacity style={styles.closeBtn} onPress={router.back}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* BOTTOM BAR */}
      <View
        style={[
          styles.bottomBar,
          { bottom: Platform.OS === 'ios' ? insets.bottom + 20 : 30 },
        ]}
      >
        {/* RETAKE */}
        <ActionButton
          icon="refresh"
          label="Retake"
          onPress={handleRetake}
          loading={loading}
        />

        {/* SEND */}
        <ActionButton
          icon="send"
          label="Send"
          onPress={handleSendToChat}
          primary
          loading={loading}
        />

        {/* SAVE */}
        <ActionButton
          icon="download"
          label="Save"
          onPress={handleSave}
          loading={loading}
        />
      </View>
    </View>
  );
}

/* ---------------- BUTTON ---------------- */
function ActionButton({
  icon,
  label,
  onPress,
  loading,
  primary,
}: {
  icon: any;
  label: string;
  onPress: () => void;
  loading?: boolean;
  primary?: boolean;
}) {
  return (
    <TouchableOpacity onPress={onPress} disabled={loading}>
      <View
        style={[
          styles.iconButton,
          primary && styles.primaryButton,
        ]}
      >
        {loading ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Ionicons name={icon} size={28} color="#000" />
        )}
      </View>
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ---------------- STYLES ---------------- */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  media: {
    width: '100%',
    height: '100%',
  },
  topBar: {
    position: 'absolute',
    left: 20,
  },
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
    alignItems: 'center',
  },
  iconButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FFCC00',
  },
  label: {
    ...Typography.caption,
    color: '#fff',
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
});
