import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { useTheme } from '../hooks/useTheme';
import { useAuth, useAlert } from '@/template';
import { useRouter } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import Animated, { FadeInUp } from 'react-native-reanimated';

const PROFILE_BUCKET = 'profile-images';
const MAX_IMAGE_SIZE_MB = 5;
const USERNAME_CHANGE_COOLDOWN_DAYS = 14;

interface UserProfile {
  username: string | null;
  full_name: string | null;
  profile_photo_url: string | null;
  username_last_changed: string | null;
  is_lifetime_member: boolean;
  subscription_tier?: string;
  role?: string;
}

// ── Edit Profile Modal (blur style) ──
function EditProfileModal({ visible, profile, userId, onClose, onSaved }: {
  visible: boolean;
  profile: UserProfile | null;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const supabase = getSupabaseClient();

  useEffect(() => {
    if (visible && profile) {
      setFullName(profile.full_name || '');
      setUsername(profile.username || '');
      setPhotoUrl(profile.profile_photo_url);
    }
  }, [visible, profile]);

  const handlePickPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission Required', 'Allow access to your photos.'); return; }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        base64: true,
        allowsEditing: true,
        aspect: [1, 1],
      });

      if (result.canceled || !result.assets[0]?.base64) return;
      const asset = result.assets[0];
      const sizeInMB = (asset.base64.length * 0.75) / (1024 * 1024);
      if (sizeInMB > MAX_IMAGE_SIZE_MB) { Alert.alert('Error', `Image too large. Max ${MAX_IMAGE_SIZE_MB}MB`); return; }

      setUploading(true);
      const fileExt = asset.uri.split('.').pop() || 'jpg';
      const filePath = `${userId}/avatar-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from(PROFILE_BUCKET)
        .upload(filePath, decode(asset.base64), { contentType: asset.mimeType || 'image/jpeg', upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from(PROFILE_BUCKET).getPublicUrl(filePath);
      await supabase.from('user_profiles').update({ profile_photo_url: urlData.publicUrl }).eq('id', userId);
      setPhotoUrl(urlData.publicUrl);
    } catch (e) {
      Alert.alert('Error', 'Failed to upload photo.');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!fullName.trim()) { Alert.alert('Error', 'Name is required'); return; }
    setSaving(true);
    try {
      const payload: any = { full_name: fullName.trim() };
      if (username.trim()) payload.username = username.trim().toLowerCase();
      await supabase.from('user_profiles').update(payload).eq('id', userId);
      onSaved();
      onClose();
    } catch (e) {
      Alert.alert('Error', 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const initial = (fullName?.[0] || 'U').toUpperCase();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
        <TouchableOpacity style={{ flex: 0.3 }} activeOpacity={1} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 0.7 }}>
          <View style={editStyles.sheet}>
            <BlurView intensity={95} tint="dark" style={editStyles.sheetBlur}>
              {/* Photo */}
              <View style={editStyles.photoRow}>
                <TouchableOpacity style={editStyles.photoBtnWrap} onPress={handlePickPhoto} disabled={uploading}>
                  {photoUrl ? (
                    <Image source={{ uri: photoUrl }} style={editStyles.photo} contentFit="cover" />
                  ) : (
                    <View style={editStyles.photoPlaceholder}>
                      <Text style={editStyles.photoInitial}>{initial}</Text>
                    </View>
                  )}
                  {uploading ? (
                    <View style={editStyles.photoOverlay}><ActivityIndicator color="#FFF" /></View>
                  ) : (
                    <View style={editStyles.cameraIcon}>
                      <Ionicons name="camera" size={14} color="#FFF" />
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              {/* Name */}
              <Text style={editStyles.label}>Name</Text>
              <TextInput
                style={editStyles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Your name"
                placeholderTextColor="rgba(255,255,255,0.35)"
                autoCapitalize="words"
              />

              {/* Username */}
              <Text style={editStyles.label}>Username</Text>
              <TextInput
                style={editStyles.input}
                value={username}
                onChangeText={(t) => setUsername(t.toLowerCase().replace(/\s/g, ''))}
                placeholder="username"
                placeholderTextColor="rgba(255,255,255,0.35)"
                autoCapitalize="none"
              />

              <Text style={editStyles.note}>Your profile helps people recognize you. Your name and username are also used in the app.</Text>

              <TouchableOpacity style={editStyles.saveBtn} onPress={handleSave} disabled={saving || uploading}>
                {saving ? <ActivityIndicator color="#000" /> : <Text style={editStyles.saveBtnText}>Save profile</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={editStyles.cancelBtn} onPress={onClose}>
                <Text style={editStyles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </BlurView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const editStyles = StyleSheet.create({
  sheet: { flex: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  sheetBlur: { flex: 1, padding: 24, paddingTop: 16 },
  photoRow: { alignItems: 'center', marginBottom: 20 },
  photoBtnWrap: { width: 88, height: 88, borderRadius: 44, position: 'relative' },
  photo: { width: 88, height: 88, borderRadius: 44 },
  photoPlaceholder: { width: 88, height: 88, borderRadius: 44, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  photoInitial: { color: '#FFF', fontSize: 36, fontWeight: '700' },
  photoOverlay: { ...StyleSheet.absoluteFillObject, borderRadius: 44, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  cameraIcon: { position: 'absolute', bottom: 2, right: 2, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#FFF' },
  label: { color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 6, marginLeft: 2 },
  input: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 14, padding: 14, color: '#FFF', fontSize: 16, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  note: { color: 'rgba(255,255,255,0.35)', fontSize: 12, textAlign: 'center', lineHeight: 18, marginBottom: 20 },
  saveBtn: { backgroundColor: '#FFF', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  saveBtnText: { color: '#000', fontSize: 17, fontWeight: '600' },
  cancelBtn: { alignItems: 'center', paddingVertical: 12 },
  cancelBtnText: { color: 'rgba(255,255,255,0.55)', fontSize: 16 },
});

// ── Main Profile Screen ──
export default function ProfileScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editVisible, setEditVisible] = useState(false);

  const isPlus = profile?.subscription_tier === 'plus' || profile?.subscription_tier === 'pro' || profile?.is_lifetime_member;

  const fetchProfile = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('username, full_name, profile_photo_url, username_last_changed, is_lifetime_member, subscription_tier, role')
        .eq('id', user.id)
        .single();
      if (data) setProfile(data);
    } catch (e) {}
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const initial = (profile?.full_name?.[0] || user?.email?.[0] || 'U').toUpperCase();

  const bgColor = '#1C1C1E';
  const cardBg = '#2C2C2E';
  const textColor = '#FFFFFF';
  const subColor = 'rgba(255,255,255,0.5)';
  const borderCol = 'rgba(255,255,255,0.08)';

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: bgColor, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#10A37F" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: bgColor, paddingTop: Platform.select({ ios: insets.top, android: insets.top, default: 0 }) }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: borderCol }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="close" size={18} color={textColor} />
        </TouchableOpacity>
        <Text style={{ color: textColor, fontSize: 17, fontWeight: '600' }}>Settings</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Profile section */}
        <View style={{ alignItems: 'center', paddingTop: 32, paddingBottom: 24 }}>
          {/* Avatar */}
          <View style={{ position: 'relative', marginBottom: 14 }}>
            {profile?.profile_photo_url ? (
              <Image source={{ uri: profile.profile_photo_url }} style={{ width: 90, height: 90, borderRadius: 45 }} contentFit="cover" />
            ) : (
              <View style={{ width: 90, height: 90, borderRadius: 45, backgroundColor: '#10A37F', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#FFF', fontSize: 36, fontWeight: '700' }}>{initial}</Text>
              </View>
            )}
            {/* Plus verification badge (red) */}
            {isPlus && (
              <View style={{ position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: '#FF3B30', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: bgColor }}>
                <Ionicons name="checkmark" size={14} color="#FFF" />
              </View>
            )}
          </View>

          {/* Name */}
          <Text style={{ color: textColor, fontSize: 22, fontWeight: '700', marginBottom: 3 }}>
            {profile?.full_name || user?.email?.split('@')[0] || 'User'}
          </Text>

          {/* Username */}
          <Text style={{ color: subColor, fontSize: 15, marginBottom: 4 }}>
            {profile?.username ? `@${profile.username}` : ''}
          </Text>

          {/* Plus badge text */}
          {isPlus && (
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,59,48,0.15)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, gap: 5, marginTop: 4 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF3B30' }} />
              <Text style={{ color: '#FF3B30', fontSize: 13, fontWeight: '700' }}>
                {profile?.is_lifetime_member ? 'Lifetime Member' : 'Plus'}
              </Text>
            </View>
          )}

          {/* Edit profile button */}
          <TouchableOpacity
            style={{ marginTop: 16, borderWidth: 1, borderColor: borderCol, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8 }}
            onPress={() => setEditVisible(true)}
          >
            <Text style={{ color: textColor, fontSize: 14, fontWeight: '500' }}>Edit profile</Text>
          </TouchableOpacity>
        </View>

        {/* Account section */}
        <Text style={{ color: subColor, fontSize: 13, fontWeight: '600', paddingHorizontal: 20, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Account</Text>
        <View style={{ marginHorizontal: 16, borderRadius: 16, overflow: 'hidden', backgroundColor: cardBg, marginBottom: 24 }}>
          {[
            { label: 'Subscription', sub: isPlus ? 'Plus' : 'Free', icon: 'star-outline', onPress: () => router.push('/subscription') },
            { label: 'Personalization', sub: '', icon: 'person-outline', onPress: () => router.push('/personalization') },
            { label: 'Notifications', sub: '', icon: 'notifications-outline', onPress: () => router.push('/notifications') },
            { label: 'Data controls', sub: '', icon: 'shield-outline', onPress: () => router.push('/data-controls') },
            { label: 'Parental controls', sub: '', icon: 'people-outline', onPress: () => router.push('/parental-controls') },
            { label: 'Archived chats', sub: '', icon: 'archive-outline', onPress: () => router.push('/archived-chats') },
            { label: 'Security', sub: '', icon: 'lock-closed-outline', onPress: () => router.push('/security') },
          ].map((item, i, arr) => (
            <TouchableOpacity
              key={item.label}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 14,
                borderBottomWidth: i < arr.length - 1 ? StyleSheet.hairlineWidth : 0,
                borderBottomColor: borderCol,
              }}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Ionicons name={item.icon as any} size={18} color="rgba(255,255,255,0.7)" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: textColor, fontSize: 16, fontWeight: '500' }}>{item.label}</Text>
                {item.sub ? <Text style={{ color: subColor, fontSize: 13, marginTop: 1 }}>{item.sub}</Text> : null}
              </View>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
            </TouchableOpacity>
          ))}
        </View>

        {/* App settings */}
        <Text style={{ color: subColor, fontSize: 13, fontWeight: '600', paddingHorizontal: 20, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>App</Text>
        <View style={{ marginHorizontal: 16, borderRadius: 16, overflow: 'hidden', backgroundColor: cardBg, marginBottom: 24 }}>
          {[
            { label: 'Settings', sub: '', icon: 'settings-outline', onPress: () => router.push('/settings') },
            { label: 'About', sub: '', icon: 'information-circle-outline', onPress: () => router.push('/about') },
            { label: 'Report a bug', sub: '', icon: 'bug-outline', onPress: () => router.push('/bugreport') },
          ].map((item, i, arr) => (
            <TouchableOpacity
              key={item.label}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 14,
                borderBottomWidth: i < arr.length - 1 ? StyleSheet.hairlineWidth : 0,
                borderBottomColor: borderCol,
              }}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Ionicons name={item.icon as any} size={18} color="rgba(255,255,255,0.7)" />
              </View>
              <Text style={{ flex: 1, color: textColor, fontSize: 16, fontWeight: '500' }}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Sign out */}
        <View style={{ marginHorizontal: 16 }}>
          <TouchableOpacity
            style={{ backgroundColor: cardBg, borderRadius: 16, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,59,48,0.2)' }}
            onPress={() => showAlert('Sign Out', 'Are you sure you want to sign out?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign Out', style: 'destructive', onPress: () => router.replace('/login') },
            ])}
          >
            <Text style={{ color: '#FF3B30', fontSize: 17, fontWeight: '600' }}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <EditProfileModal
        visible={editVisible}
        profile={profile}
        userId={user?.id || ''}
        onClose={() => setEditVisible(false)}
        onSaved={fetchProfile}
      />
    </View>
  );
}
