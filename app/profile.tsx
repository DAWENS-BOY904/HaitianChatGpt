import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useAuth, useAlert } from '@/template';
import { useRouter } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';

export default function ProfileScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [profilePhoto, setProfilePhoto] = useState('');
  const [canChangeUsername, setCanChangeUsername] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('user_profiles')
      .select(
        'username, full_name, profile_photo_url, username_last_changed'
      )
      .eq('id', user.id)
      .single();

    if (data) {
      setUsername(data.username || '');
      setFullName(data.full_name || '');
      setProfilePhoto(data.profile_photo_url || '');

      const lastChanged = data.username_last_changed
        ? new Date(data.username_last_changed)
        : null;

      const daysSinceChange = lastChanged
        ? (Date.now() - lastChanged.getTime()) / (1000 * 60 * 60 * 24)
        : 999;

      setCanChangeUsername(daysSinceChange >= 14);
    }
  };

  const handleChangePhoto = async () => {
    const { status } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      base64: true,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (result.canceled || !result.assets[0]) return;

    setLoading(true);

    try {
      const asset = result.assets[0];
      const filePath = `${user?.id}/${Date.now()}.jpg`;

      await supabase.storage
        .from('chat-images')
        .upload(filePath, decode(asset.base64!), {
          contentType: 'image/jpeg',
          upsert: true,
        });

      const { data: urlData } = supabase.storage
        .from('chat-images')
        .getPublicUrl(filePath);

      await supabase
        .from('user_profiles')
        .update({ profile_photo_url: urlData.publicUrl })
        .eq('id', user?.id);

      setProfilePhoto(urlData.publicUrl);
      showAlert('Success', 'Photo updated');
    } catch {
      showAlert('Error', 'Photo upload failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!fullName.trim()) {
      showAlert('Error', 'Name cannot be empty');
      return;
    }

    setLoading(true);

    const updates: any = {
      full_name: fullName.trim(),
    };

    if (canChangeUsername && username.trim()) {
      updates.username = username.trim();
      updates.username_last_changed = new Date().toISOString();
    }

    const { error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', user?.id);

    setLoading(false);

    if (error) {
      showAlert('Error', 'Failed to update profile');
    } else {
      showAlert('Success', 'Profile updated');

      if (canChangeUsername) {
        setCanChangeUsername(false);
      }
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: Platform.select({
        ios: insets.top,
        android: insets.top,
      }),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      padding: Spacing.xs,
      marginRight: Spacing.sm,
    },
    headerTitle: {
      ...Typography.heading,
      color: colors.text,
    },
    content: {
      padding: Spacing.md,
    },
    photoSection: {
      alignItems: 'center',
      marginBottom: Spacing.xl,
    },
    photoContainer: {
      width: 120,
      height: 120,
      borderRadius: BorderRadius.full,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.md,
      overflow: 'hidden',
    },
    photo: {
      width: '100%',
      height: '100%',
    },
    photoText: {
      ...Typography.title,
      color: '#fff',
      fontSize: 48,
    },
    changePhotoButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    changePhotoText: {
      ...Typography.body,
      color: colors.primary,
    },
    section: {
      marginBottom: Spacing.xl,
    },
    label: {
      ...Typography.body,
      fontWeight: '600',
      color: colors.text,
      marginBottom: Spacing.sm,
    },
    input: {
      backgroundColor: colors.inputBackground,
      borderRadius: BorderRadius.sm,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.text,
    },
    helperText: {
      ...Typography.caption,
      color: colors.textSecondary,
      marginTop: Spacing.xs,
    },
    warningText: {
      ...Typography.caption,
      color: '#FF9500',
      marginTop: Spacing.xs,
    },
    saveButton: {
      backgroundColor: colors.primary,
      padding: Spacing.md,
      borderRadius: BorderRadius.sm,
      alignItems: 'center',
    },
    saveButtonDisabled: {
      opacity: 0.6,
    },
    saveButtonText: {
      ...Typography.body,
      color: '#fff',
      fontWeight: '600',
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.photoSection}>
          <View style={styles.photoContainer}>
            {profilePhoto ? (
              <Image source={{ uri: profilePhoto }} style={styles.photo} />
            ) : (
              <Text style={styles.photoText}>
                {fullName?.[0]?.toUpperCase() ||
                  user?.email?.[0]?.toUpperCase() ||
                  'U'}
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={styles.changePhotoButton}
            onPress={handleChangePhoto}
            disabled={loading}
          >
            <Ionicons name="camera" size={20} color={colors.primary} />
            <Text style={styles.changePhotoText}>Change photo</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your name"
            placeholderTextColor={colors.textSecondary}
            value={fullName}
            onChangeText={setFullName}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            editable={canChangeUsername}
          />
          {!canChangeUsername && (
            <Text style={styles.warningText}>
              Username locked for 14 days. You can still update your name.
            </Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={user?.email || ''}
            editable={false}
          />
        </View>

        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSaveProfile}
          disabled={loading}
        >
          <Text style={styles.saveButtonText}>
            {loading ? 'Saving...' : 'Save Changes'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
