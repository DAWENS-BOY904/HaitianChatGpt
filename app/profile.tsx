import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  Platform,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Alert,
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
import Animated, { 
  FadeIn, 
  FadeInUp, 
  Layout 
} from 'react-native-reanimated';

// Constants
const USERNAME_CHANGE_COOLDOWN_DAYS = 14;
const PROFILE_BUCKET = 'profile-images'; // Separate bucket for profiles
const MAX_IMAGE_SIZE_MB = 5;

// Types
interface UserProfile {
  username: string | null;
  full_name: string | null;
  profile_photo_url: string | null;
  username_last_changed: string | null;
  is_lifetime_member: boolean;
}

interface ProfileUpdatePayload {
  full_name: string;
  username?: string;
  username_last_changed?: string;
}

// Custom hook for profile data management
const useProfileData = (userId: string | undefined) => {
  const supabase = getSupabaseClient();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!userId) return;
    
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('user_profiles')
        .select('username, full_name, profile_photo_url, username_last_changed, is_lifetime_member')
        .eq('id', userId)
        .single();

      if (fetchError) throw fetchError;
      setProfile(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [userId, supabase]);

  const updateProfile = useCallback(async (payload: ProfileUpdatePayload) => {
    if (!userId) throw new Error('No user ID');
    
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update(payload)
      .eq('id', userId);

    if (updateError) throw updateError;
    
    // Optimistic update
    setProfile(prev => prev ? { ...prev, ...payload } : null);
  }, [userId, supabase]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { profile, loading, error, refetch: fetchProfile, updateProfile };
};

// Utility functions
const getDaysSinceDate = (dateString: string | null): number => {
  if (!dateString) return Infinity;
  const date = new Date(dateString);
  const diff = Date.now() - date.getTime();
  return diff / (1000 * 60 * 60 * 24);
};

const validateUsername = (username: string): string | null => {
  if (!username.trim()) return 'Username is required';
  if (username.length < 3) return 'Username must be at least 3 characters';
  if (!/^[a-zA-Z0-9_]+$/.test(username)) return 'Username can only contain letters, numbers, and underscores';
  return null;
};

// Sub-components
const ProfileAvatar = memo(({ 
  photoUrl, 
  name, 
  email, 
  onPress, 
  loading 
}: { 
  photoUrl: string | null; 
  name: string; 
  email: string | undefined; 
  onPress: () => void;
  loading: boolean;
}) => {
  const { colors } = useTheme();
  const initial = (name?.[0] || email?.[0] || 'U').toUpperCase();

  return (
    <TouchableOpacity 
      style={[styles.photoContainer, { backgroundColor: colors.primary }]} 
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.8}
    >
      {photoUrl ? (
        <Image 
          source={{ uri: photoUrl }} 
          style={styles.photo}
          resizeMode="cover"
        />
      ) : (
        <Text style={[styles.photoText, { color: colors.background }]}>
          {initial}
        </Text>
      )}
      {loading && (
        <View style={[StyleSheet.absoluteFill, styles.photoOverlay]}>
          <ActivityIndicator color="#fff" />
        </View>
      )}
      <View style={styles.cameraIconContainer}>
        <Ionicons name="camera" size={16} color="#fff" />
      </View>
    </TouchableOpacity>
  );
});

const LifetimeBadge = memo(() => (
  <Animated.View 
    entering={FadeInUp.delay(200)}
    style={styles.lifetimeBadge}
  >
    <Ionicons name="star" size={14} color="#FFFFFF" />
    <Text style={styles.lifetimeBadgeText}>LIFETIME MEMBER</Text>
  </Animated.View>
));

const InputField = memo(({
  label,
  value,
  onChangeText,
  editable = true,
  placeholder,
  helperText,
  warningText,
  keyboardType = 'default',
  autoCapitalize = 'none',
}: {
  label: string;
  value: string;
  onChangeText?: (text: string) => void;
  editable?: boolean;
  placeholder?: string;
  helperText?: string;
  warningText?: string;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'words';
}) => {
  const { colors } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.section}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: colors.inputBackground,
            borderColor: isFocused ? colors.primary : colors.border,
            color: colors.text,
            opacity: editable ? 1 : 0.6,
          },
        ]}
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
      {helperText && !warningText && (
        <Text style={[styles.helperText, { color: colors.textSecondary }]}>
          {helperText}
        </Text>
      )}
      {warningText && (
        <Text style={styles.warningText}>{warningText}</Text>
      )}
    </View>
  );
});

// Main Component
export default function ProfileScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  // Custom hook for data
  const { 
    profile, 
    loading: profileLoading, 
    error: profileError, 
    updateProfile 
  } = useProfileData(user?.id);

  // Local state
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  // Derived state
  const daysSinceUsernameChange = getDaysSinceDate(profile?.username_last_changed || null);
  const canChangeUsername = daysSinceUsernameChange >= USERNAME_CHANGE_COOLDOWN_DAYS;
  const isLoading = profileLoading || isUploading || isSaving;

  // Initialize form values from profile
  useEffect(() => {
    if (profile) {
      setUsername(profile.username || '');
      setFullName(profile.full_name || '');
      setProfilePhoto(profile.profile_photo_url);
    }
  }, [profile]);

  // Handle errors
  useEffect(() => {
    if (profileError) {
      showAlert('Error', profileError);
    }
  }, [profileError, showAlert]);

  const handleImagePick = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please allow access to your photo library to change your profile picture.',
          [{ text: 'OK' }]
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        base64: true,
        allowsEditing: true,
        aspect: [1, 1],
      });

      if (result.canceled || !result.assets[0]?.base64) return;

      const asset = result.assets[0];
      
      // Validate file size (approximate)
      const sizeInMB = (asset.base64.length * 0.75) / (1024 * 1024);
      if (sizeInMB > MAX_IMAGE_SIZE_MB) {
        showAlert('Error', `Image too large. Max size is ${MAX_IMAGE_SIZE_MB}MB`);
        return;
      }

      setIsUploading(true);

      const fileExt = asset.uri.split('.').pop() || 'jpg';
      const filePath = `${user?.id}/avatar-${Date.now()}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from(PROFILE_BUCKET)
        .upload(filePath, decode(asset.base64), {
          contentType: asset.mimeType || 'image/jpeg',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(PROFILE_BUCKET)
        .getPublicUrl(filePath);

      // Update database
      await supabase
        .from('user_profiles')
        .update({ profile_photo_url: urlData.publicUrl })
        .eq('id', user?.id);

      setProfilePhoto(urlData.publicUrl);
      showAlert('Success', 'Profile photo updated');
    } catch (error) {
      console.error('Upload error:', error);
      showAlert('Error', 'Failed to upload photo. Please try again.');
    } finally {
      setIsUploading(false);
    }
  }, [user?.id, supabase, showAlert]);

  const handleSave = useCallback(async () => {
    if (!fullName.trim()) {
      showAlert('Error', 'Please enter your full name');
      return;
    }

    // Validate username if changing
    if (canChangeUsername && username.trim() !== profile?.username) {
      const validationError = validateUsername(username);
      if (validationError) {
        setUsernameError(validationError);
        return;
      }
    }

    setIsSaving(true);
    setUsernameError(null);

    try {
      const payload: ProfileUpdatePayload = {
        full_name: fullName.trim(),
      };

      if (canChangeUsername && username.trim() !== profile?.username) {
        payload.username = username.trim().toLowerCase();
        payload.username_last_changed = new Date().toISOString();
      }

      await updateProfile(payload);
      showAlert('Success', 'Profile updated successfully');
    } catch (error) {
      console.error('Save error:', error);
      showAlert('Error', 'Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [fullName, username, canChangeUsername, profile?.username, updateProfile, showAlert]);

  const handleUsernameChange = useCallback((text: string) => {
    // Auto-format: lowercase, no spaces
    const formatted = text.toLowerCase().replace(/\s/g, '');
    setUsername(formatted);
    setUsernameError(null);
  }, []);

  if (profileLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Edit Profile</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View 
          entering={FadeInUp.duration(400)}
          style={styles.photoSection}
        >
          <ProfileAvatar
            photoUrl={profilePhoto}
            name={fullName}
            email={user?.email}
            onPress={handleImagePick}
            loading={isUploading}
          />

          <TouchableOpacity
            style={styles.changePhotoButton}
            onPress={handleImagePick}
            disabled={isUploading}
          >
            <Ionicons name="camera-outline" size={20} color={colors.primary} />
            <Text style={[styles.changePhotoText, { color: colors.primary }]}>
              {isUploading ? 'Uploading...' : 'Change Photo'}
            </Text>
          </TouchableOpacity>

          {profile?.is_lifetime_member && <LifetimeBadge />}
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(100).duration(400)}>
          <InputField
            label="Full Name"
            value={fullName}
            onChangeText={setFullName}
            placeholder="Enter your full name"
            autoCapitalize="words"
          />
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(200).duration(400)}>
          <InputField
            label="Username"
            value={username}
            onChangeText={handleUsernameChange}
            editable={canChangeUsername}
            placeholder="username"
            helperText={canChangeUsername ? "You can change your username once every 14 days" : undefined}
            warningText={!canChangeUsername ? `Username can be changed in ${Math.ceil(USERNAME_CHANGE_COOLDOWN_DAYS - daysSinceUsernameChange)} days` : undefined}
          />
          {usernameError && (
            <Text style={styles.errorText}>{usernameError}</Text>
          )}
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(300).duration(400)}>
          <InputField
            label="Email"
            value={user?.email || ''}
            editable={false}
            helperText="Email cannot be changed"
            keyboardType="email-address"
          />
        </Animated.View>

        <Animated.View 
          entering={FadeInUp.delay(400).duration(400)}
          style={styles.buttonContainer}
        >
          <TouchableOpacity
            style={[
              styles.saveButton,
              { backgroundColor: colors.primary },
              (isLoading || !fullName.trim()) && styles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={isLoading || !fullName.trim()}
            activeOpacity={0.8}
          >
            {isSaving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    padding: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  headerTitle: {
    ...Typography.heading,
    fontSize: 18,
    fontWeight: '600',
  },
  headerRight: {
    width: 40, // Balance layout
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  photoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoText: {
    ...Typography.title,
    fontSize: 48,
    fontWeight: 'bold',
  },
  photoOverlay: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  changePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
    padding: Spacing.sm,
    gap: Spacing.xs,
  },
  changePhotoText: {
    ...Typography.body,
    fontWeight: '500',
  },
  lifetimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF9500',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.md,
    gap: 6,
    shadowColor: '#FF9500',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  lifetimeBadgeText: {
    ...Typography.caption,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  label: {
    ...Typography.body,
    fontWeight: '600',
    marginBottom: Spacing.sm,
    fontSize: 14,
  },
  input: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1.5,
    fontSize: 16,
    ...Typography.body,
  },
  helperText: {
    ...Typography.caption,
    marginTop: Spacing.xs,
    fontSize: 12,
  },
  warningText: {
    ...Typography.caption,
    color: '#FF9500',
    marginTop: Spacing.xs,
    fontSize: 12,
  },
  errorText: {
    ...Typography.caption,
    color: '#FF3B30',
    marginTop: Spacing.xs,
    fontSize: 12,
  },
  buttonContainer: {
    marginTop: Spacing.md,
  },
  saveButton: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    ...Typography.body,
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
