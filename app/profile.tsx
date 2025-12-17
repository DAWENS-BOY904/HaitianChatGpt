import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView, Platform, Image } from 'react-native';
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
      .select('username, profile_photo_url, username_last_changed')
      .eq('id', user.id)
      .single();

    if (data) {
      setUsername(data.username || '');
      setProfilePhoto(data.profile_photo_url || '');

      // Check if user can change username (14 days cooldown)
      const lastChanged = data.username_last_changed ? new Date(data.username_last_changed) : null;
      const now = new Date();
      const daysSinceChange = lastChanged ? (now.getTime() - lastChanged.getTime()) / (1000 * 60 * 60 * 24) : 999;
      setCanChangeUsername(daysSinceChange >= 14);
    }
  };

  const handleChangePhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      base64: true,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setLoading(true);

      try {
        const fileName = `${user?.id}_${Date.now()}.jpg`;
        const filePath = `${user?.id}/${fileName}`;

        const { data, error } = await supabase.storage
          .from('chat-images')
          .upload(filePath, decode(asset.base64!), {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (error) throw error;

        const { data: urlData } = supabase.storage
          .from('chat-images')
          .getPublicUrl(filePath);

        await supabase
          .from('user_profiles')
          .update({ profile_photo_url: urlData.publicUrl })
          .eq('id', user?.id);

        setProfilePhoto(urlData.publicUrl);
        showAlert('Success', 'Profile photo updated');
      } catch (error) {
        console.error('Upload error:', error);
        showAlert('Error', 'Failed to upload photo');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSaveUsername = async () => {
    if (!username.trim()) {
      showAlert('Error', 'Username cannot be empty');
      return;
    }

    if (!canChangeUsername) {
      showAlert('Error', 'You can only change your username once every 14 days');
      return;
    }

    setLoading(true);

    const { error } = await supabase
      .from('user_profiles')
      .update({
        username: username.trim(),
        username_last_changed: new Date().toISOString(),
      })
      .eq('id', user?.id);

    setLoading(false);

    if (error) {
      showAlert('Error', 'Username already taken or invalid');
    } else {
      showAlert('Success', 'Username updated. You can change it again in 14 days.');
      setCanChangeUsername(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: Platform.select({ ios: insets.top, android: insets.top, default: 0 }),
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
      color: '#FFFFFF',
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
      color: colors.text,
      fontWeight: '600',
      marginBottom: Spacing.sm,
    },
    input: {
      backgroundColor: colors.inputBackground,
      borderRadius: BorderRadius.sm,
      padding: Spacing.md,
      ...Typography.body,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
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
      borderRadius: BorderRadius.sm,
      padding: Spacing.md,
      alignItems: 'center',
      marginTop: Spacing.lg,
    },
    saveButtonDisabled: {
      opacity: 0.5,
    },
    saveButtonText: {
      ...Typography.body,
      color: '#FFFFFF',
      fontWeight: '600',
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
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
                {user?.email?.[0].toUpperCase() || 'U'}
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
          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter username"
            placeholderTextColor={colors.textSecondary}
            value={username}
            onChangeText={setUsername}
            editable={canChangeUsername && !loading}
          />
          {canChangeUsername ? (
            <Text style={styles.helperText}>
              Choose a unique username. You can change it again in 14 days.
            </Text>
          ) : (
            <Text style={styles.warningText}>
              You can change your username again in 14 days from last change.
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
          <Text style={styles.helperText}>Email cannot be changed</Text>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, (!canChangeUsername || loading) && styles.saveButtonDisabled]}
          onPress={handleSaveUsername}
          disabled={!canChangeUsername || loading}
        >
          <Text style={styles.saveButtonText}>
            {loading ? 'Saving...' : 'Save Changes'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
