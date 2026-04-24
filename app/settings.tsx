import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Platform,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { useTheme } from '../hooks/useTheme';
import { useSettings } from '../hooks/useSettings';
import { useSubscription } from '../hooks/useSubscription';
import { useAuth, useAlert } from '@/template';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';
import * as ImagePicker from 'expo-image-picker';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useProfile } from '../contexts/ProfileContext';

// ── Edit Profile Modal Content ─────────────────────────────────────────────
function EditModalContent({
  isDark, editPhoto, initials, uploadingPhoto, editName, editUsername,
  canChangeUsername, daysUntilUsernameChange, savingProfile,
  primaryText, secondaryText, insets,
  onPickPhoto, onChangeName, onChangeUsername, onSave, onClose,
}: {
  isDark: boolean; editPhoto: string; initials: string; uploadingPhoto: boolean;
  editName: string; editUsername: string;
  canChangeUsername: () => boolean; daysUntilUsernameChange: () => number;
  savingProfile: boolean; primaryText: string; secondaryText: string;
  insets: { bottom: number };
  onPickPhoto: () => void; onChangeName: (v: string) => void;
  onChangeUsername: (v: string) => void; onSave: () => void; onClose: () => void;
}) {
  const inputBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const borderColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)';
  const canChange = canChangeUsername();
  const daysLeft = daysUntilUsernameChange();

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 24, paddingBottom: insets.bottom + 32 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Drag handle */}
      <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)', marginBottom: 20 }} />

      <Text style={{ fontSize: 20, fontWeight: '700', color: primaryText, textAlign: 'center', marginBottom: 6 }}>Edit Profile</Text>
      <Text style={{ fontSize: 13, color: secondaryText, textAlign: 'center', marginBottom: 24 }}>Your profile helps people recognize you.</Text>

      {/* Avatar */}
      <TouchableOpacity onPress={onPickPhoto} style={{ alignSelf: 'center', marginBottom: 28 }} activeOpacity={0.8}>
        <View style={{ width: 90, height: 90, borderRadius: 45, overflow: 'hidden', backgroundColor: isDark ? '#3A3A3C' : '#E5E5EA', alignItems: 'center', justifyContent: 'center' }}>
          {uploadingPhoto ? (
            <ActivityIndicator color={primaryText} />
          ) : editPhoto ? (
            <Image source={{ uri: editPhoto }} style={{ width: 90, height: 90 }} contentFit="cover" />
          ) : (
            <Text style={{ fontSize: 36, fontWeight: '700', color: primaryText }}>{initials}</Text>
          )}
        </View>
        <View style={{
          position: 'absolute', bottom: 0, right: 0,
          width: 28, height: 28, borderRadius: 14,
          backgroundColor: '#10A37F', alignItems: 'center', justifyContent: 'center',
          borderWidth: 2, borderColor: isDark ? '#1C1C1E' : '#F2F2F7',
        }}>
          <Ionicons name="camera" size={14} color="#FFF" />
        </View>
      </TouchableOpacity>

      {/* Name */}
      <Text style={{ fontSize: 13, fontWeight: '500', color: secondaryText, marginBottom: 6, marginLeft: 2 }}>Display Name</Text>
      <TextInput
        style={{
          backgroundColor: inputBg, borderRadius: 12, paddingHorizontal: 16,
          paddingVertical: 14, fontSize: 16, color: primaryText, marginBottom: 16,
          borderWidth: 1, borderColor,
        }}
        value={editName}
        onChangeText={onChangeName}
        placeholder="Your name"
        placeholderTextColor={secondaryText}
        returnKeyType="next"
      />

      {/* Username */}
      <Text style={{ fontSize: 13, fontWeight: '500', color: secondaryText, marginBottom: 6, marginLeft: 2 }}>Username</Text>
      <TextInput
        style={{
          backgroundColor: canChange ? inputBg : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'),
          borderRadius: 12, paddingHorizontal: 16,
          paddingVertical: 14, fontSize: 16,
          color: canChange ? primaryText : secondaryText, marginBottom: 8,
          borderWidth: 1, borderColor,
        }}
        value={editUsername}
        onChangeText={onChangeUsername}
        placeholder="username"
        placeholderTextColor={secondaryText}
        editable={canChange}
        autoCapitalize="none"
        returnKeyType="done"
      />
      {!canChange && (
        <Text style={{ fontSize: 12, color: secondaryText, marginBottom: 16, marginLeft: 2 }}>
          Username can be changed in {daysLeft} day{daysLeft !== 1 ? 's' : ''}
        </Text>
      )}
      {canChange && <View style={{ marginBottom: 16 }} />}

      {/* Save */}
      <TouchableOpacity
        style={{
          backgroundColor: '#10A37F', borderRadius: 50, paddingVertical: 16,
          alignItems: 'center', marginBottom: 12,
          opacity: savingProfile ? 0.7 : 1,
        }}
        onPress={onSave}
        disabled={savingProfile}
        activeOpacity={0.8}
      >
        {savingProfile ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={{ fontSize: 17, fontWeight: '700', color: '#FFF' }}>Save Changes</Text>
        )}
      </TouchableOpacity>

      {/* Cancel */}
      <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 12 }} onPress={onClose}>
        <Text style={{ fontSize: 17, color: secondaryText }}>Cancel</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ── Guest-mode limited settings view ──────────────────────────────────────
function GuestSettings() {
  const { isDark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const bg = isDark ? '#000000' : '#F2F2F7';
  const cardBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const dividerColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const primaryText = isDark ? '#FFFFFF' : '#000000';
  const secondaryText = '#8E8E93';

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingTop: insets.top + 14, paddingBottom: 14, paddingHorizontal: 20,
        backgroundColor: bg,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: dividerColor,
      }}>
        <Text style={{ fontSize: 17, fontWeight: '600', color: primaryText }}>Settings</Text>
        <TouchableOpacity
          style={{
            position: 'absolute', right: 16, top: insets.top + 8,
            width: 32, height: 32, borderRadius: 16,
            backgroundColor: isDark ? '#2C2C2E' : 'rgba(0,0,0,0.08)',
            alignItems: 'center', justifyContent: 'center',
          }}
          onPress={() => router.back()}
        >
          <Ionicons name="close" size={18} color={primaryText} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Account — limited */}
        <View style={{ marginTop: 24, paddingHorizontal: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: '500', color: secondaryText, marginBottom: 8, marginLeft: 4 }}>Account</Text>
          <View style={{ backgroundColor: cardBg, borderRadius: 14, overflow: 'hidden' }}>
            {[
              { icon: 'megaphone-outline', label: 'Ads controls', route: '/ads-controls' },
              { icon: 'document-lock-outline', label: 'Data controls', route: '/data-controls' },
            ].map((item, i, arr) => (
              <TouchableOpacity
                key={item.label}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  paddingVertical: 13, paddingHorizontal: 16,
                  borderBottomWidth: i < arr.length - 1 ? StyleSheet.hairlineWidth : 0,
                  borderBottomColor: dividerColor,
                }}
                onPress={() => router.push(item.route as any)}
                activeOpacity={0.6}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Ionicons name={item.icon as any} size={20} color={secondaryText} />
                  <Text style={{ fontSize: 16, color: primaryText }}>{item.label}</Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color={secondaryText} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* App Settings — language only */}
        <View style={{ marginTop: 24, paddingHorizontal: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: '500', color: secondaryText, marginBottom: 8, marginLeft: 4 }}>App Settings</Text>
          <View style={{ backgroundColor: cardBg, borderRadius: 14, overflow: 'hidden' }}>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 16 }}
              onPress={() => router.push('/languages')}
              activeOpacity={0.6}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Ionicons name="globe-outline" size={20} color={secondaryText} />
                <Text style={{ fontSize: 16, color: primaryText }}>App language</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ fontSize: 15, color: secondaryText }}>English</Text>
                <Ionicons name="chevron-forward" size={17} color={secondaryText} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* About */}
        <View style={{ marginTop: 24, paddingHorizontal: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: '500', color: secondaryText, marginBottom: 8, marginLeft: 4 }}>About</Text>
          <View style={{ backgroundColor: cardBg, borderRadius: 14, overflow: 'hidden' }}>
            {[
              { icon: 'document-text-outline', label: 'Terms of Use', route: '/terms-of-use' },
              { icon: 'shield-checkmark-outline', label: 'Privacy Policy', route: '/privacy-policy' },
            ].map((item, i, arr) => (
              <TouchableOpacity
                key={item.label}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  paddingVertical: 13, paddingHorizontal: 16,
                  borderBottomWidth: i < arr.length - 1 ? StyleSheet.hairlineWidth : 0,
                  borderBottomColor: dividerColor,
                }}
                onPress={() => router.push(item.route as any)}
                activeOpacity={0.6}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Ionicons name={item.icon as any} size={20} color={secondaryText} />
                  <Text style={{ fontSize: 16, color: primaryText }}>{item.label}</Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color={secondaryText} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Sign up CTA */}
        <View style={{ marginHorizontal: 16, marginTop: 36, marginBottom: 8 }}>
          <View style={{
            backgroundColor: cardBg, borderRadius: 18, padding: 24, alignItems: 'center',
            borderWidth: StyleSheet.hairlineWidth, borderColor: dividerColor,
          }}>
            <View style={{
              width: 60, height: 60, borderRadius: 30,
              backgroundColor: '#10A37F22', alignItems: 'center', justifyContent: 'center', marginBottom: 14,
            }}>
              <Ionicons name="lock-open-outline" size={28} color="#10A37F" />
            </View>
            <Text style={{ color: primaryText, fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 8 }}>
              Unlock all settings
            </Text>
            <Text style={{ color: secondaryText, fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 20 }}>
              Create an account to access personalization, notifications, parental controls, and more.
            </Text>
            <TouchableOpacity
              style={{ backgroundColor: '#10A37F', borderRadius: 50, paddingVertical: 14, paddingHorizontal: 32, width: '100%', alignItems: 'center' }}
              onPress={() => router.push('/login')}
            >
              <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700' }}>Sign up for free</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ marginTop: 12, paddingVertical: 8 }} onPress={() => router.push('/login')}>
              <Text style={{ color: secondaryText, fontSize: 15 }}>Already have an account? Log in</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: insets.bottom + 40 }} />
      </ScrollView>
    </View>
  );
}


export default function SettingsScreen() {
  const { colors, isDark } = useTheme();
  const { settings, updateSetting } = useSettings();
  const { tier } = useSubscription();
  const { user, logout } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();
  const { setProfilePhotoUrl: setGlobalPhoto, setDisplayName: setGlobalName, setUsername: setGlobalUsername } = useProfile();

  const [isAdmin, setIsAdmin] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editPhoto, setEditPhoto] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [usernameLastChanged, setUsernameLastChanged] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoPickerVisible, setPhotoPickerVisible] = useState(false);

  const currentVersion = Constants.expoConfig?.version || '1.0.0';

  const bg = isDark ? '#000000' : '#F2F2F7';
  const cardBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const dividerColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const primaryText = isDark ? '#FFFFFF' : '#000000';
  const secondaryText = '#8E8E93';
  const sectionLabelColor = '#8E8E93';
  const switchTrackFalse = isDark ? '#3A3A3C' : '#E5E5EA';

  useEffect(() => {
    checkAdminAccess();
    loadProfile();
  }, [user]);

  const checkAdminAccess = async () => {
    if (!user) return;
    const adminEmails = ['berryxoe@gmail.com', 'newdawens@gmail.com'];
    setIsAdmin(adminEmails.includes(user.email || ''));
  };

  const loadProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_profiles')
      .select('username, profile_photo_url, full_name, username_last_changed')
      .eq('id', user.id)
      .single();
    if (data) {
      setUsername(data.username || '');
      setFullName(data.full_name || '');
      setProfilePhoto(data.profile_photo_url || '');
      setUsernameLastChanged(data.username_last_changed || null);
      // Sync initial values to global context
      setGlobalPhoto(data.profile_photo_url || '');
      setGlobalName(data.full_name || data.username || '');
      setGlobalUsername(data.username || '');
    }
  };

  const canChangeUsername = (): boolean => {
    if (!usernameLastChanged) return true;
    const lastChanged = new Date(usernameLastChanged);
    const now = new Date();
    const daysDiff = (now.getTime() - lastChanged.getTime()) / (1000 * 60 * 60 * 24);
    return daysDiff >= 14;
  };

  const daysUntilUsernameChange = (): number => {
    if (!usernameLastChanged) return 0;
    const lastChanged = new Date(usernameLastChanged);
    const now = new Date();
    const daysDiff = (now.getTime() - lastChanged.getTime()) / (1000 * 60 * 60 * 24);
    return Math.max(0, Math.ceil(14 - daysDiff));
  };

  const openEditModal = () => {
    setEditName(fullName || username || '');
    setEditUsername(username || '');
    setEditPhoto(profilePhoto || '');
    setEditModalVisible(true);
  };

  const pickEditPhoto = () => {
    setPhotoPickerVisible(true);
  };

  const uploadAsset = async (asset: ImagePicker.ImagePickerAsset) => {
    setUploadingPhoto(true);
    try {
      const base64 = asset.base64;
      if (!base64) throw new Error('No base64');
      const arrayBuffer = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      const ext = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
      const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
      const filePath = `${user!.id}/avatar_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('profile-images')
        .upload(filePath, arrayBuffer, { contentType: mimeType, upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage
        .from('profile-images')
        .getPublicUrl(filePath);
      setEditPhoto(urlData.publicUrl);
    } catch (e) {
      showAlert('Upload failed', 'Could not upload photo. Try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const pickFromLibrary = async () => {
    setPhotoPickerVisible(false);
    await new Promise(r => setTimeout(r, 300));
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permission needed', 'Please allow photo access to change your profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) await uploadAsset(result.assets[0]);
  };

  const pickFromCamera = async () => {
    setPhotoPickerVisible(false);
    await new Promise(r => setTimeout(r, 300));
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permission needed', 'Please allow camera access to take a profile photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) await uploadAsset(result.assets[0]);
  };

  const saveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    try {
      const updates: any = {
        full_name: editName,
        profile_photo_url: editPhoto,
      };
      const usernameChanged = editUsername !== username;
      if (usernameChanged) {
        if (!canChangeUsername()) {
          showAlert('Username locked', `You can change your username in ${daysUntilUsernameChange()} days.`);
          setSavingProfile(false);
          return;
        }
        updates.username = editUsername;
        updates.username_last_changed = new Date().toISOString();
      }
      const { error } = await supabase.from('user_profiles').update(updates).eq('id', user.id);
      if (error) throw error;

      // Update local state
      setFullName(editName);
      setUsername(editUsername);
      setProfilePhoto(editPhoto);
      if (usernameChanged) setUsernameLastChanged(new Date().toISOString());

      // ── Instantly sync to global ProfileContext → SideMenu updates immediately ──
      setGlobalPhoto(editPhoto);
      setGlobalName(editName);
      setGlobalUsername(editUsername);

      setEditModalVisible(false);
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to save profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleLogout = () => {
    showAlert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await AsyncStorage.removeItem('passkey_session_active');
            await AsyncStorage.removeItem('passkey_user_id');
          } catch (_) {}
          await logout();
          router.replace('/login');
        },
      },
    ]);
  };

  const ADMIN_EMAILS_SETTINGS = ['berryxoe@gmail.com', 'newdawens@gmail.com', 'kontgithub@gmail.com'];
  const isAdminUser = ADMIN_EMAILS_SETTINGS.includes(user?.email?.toLowerCase() || '');
  const isPaidPlan = isAdminUser || ['go', 'plus', 'premium_monthly', 'premium_yearly', 'lifetime'].includes(tier);

  const tierLabel = () => {
    if (isAdminUser) return 'Admin — Pro';
    if (tier === 'lifetime') return 'Lifetime Pro';
    if (tier === 'plus' || tier === 'premium_yearly') return 'Plus';
    if (tier === 'go' || tier === 'premium_monthly') return 'Go';
    return 'Free Plan';
  };

  // Guest mode: show limited settings
  if (!user) return <GuestSettings />;

  const displayName = fullName || username || user?.email?.split('@')[0] || 'User';
  const displayUsername = username || '';
  const initials = (displayName[0] || 'U').toUpperCase();

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: insets.top + 14,
      paddingBottom: 14,
      paddingHorizontal: 20,
      backgroundColor: bg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: dividerColor,
    },
    headerTitle: { fontSize: 17, fontWeight: '600', color: primaryText },
    closeButton: {
      position: 'absolute',
      right: 16,
      top: insets.top + 8,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: isDark ? '#2C2C2E' : 'rgba(0,0,0,0.08)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    profileSection: {
      alignItems: 'center',
      paddingVertical: 28,
      paddingHorizontal: 20,
    },
    avatarWrap: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA',
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.4 : 0.12,
      shadowRadius: 6,
      elevation: 4,
    },
    avatarImg: { width: 80, height: 80, borderRadius: 40 },
    avatarInitial: { fontSize: 32, fontWeight: '600', color: primaryText },
    profileName: { fontSize: 24, fontWeight: '600', color: primaryText, marginBottom: 4 },
    profileUsername: { fontSize: 15, color: secondaryText, marginBottom: 14 },
    editBtn: {
      paddingHorizontal: 20,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: isDark ? '#3A3A3C' : 'rgba(0,0,0,0.15)',
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
    },
    editBtnText: { fontSize: 15, color: primaryText, fontWeight: '500' },
    sectionLabel: {
      fontSize: 13,
      fontWeight: '500',
      color: sectionLabelColor,
      marginBottom: 8,
      marginLeft: 4,
      letterSpacing: 0.1,
    },
    section: { marginTop: 24, paddingHorizontal: 16 },
    card: {
      backgroundColor: cardBg,
      borderRadius: 14,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0 : 0.06,
      shadowRadius: 4,
      elevation: isDark ? 0 : 1,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 13,
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: dividerColor,
    },
    rowLast: { borderBottomWidth: 0 },
    rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
    rowIcon: {
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowLabel: { fontSize: 16, color: primaryText, fontWeight: '400', flex: 1 },
    rowValue: { fontSize: 15, color: secondaryText, marginRight: 4 },
    logoutBtn: {
      marginHorizontal: 16,
      marginTop: 32,
      marginBottom: 8,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
      alignItems: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: dividerColor,
    },
    logoutText: { fontSize: 17, color: '#FF453A', fontWeight: '600' },
    versionText: {
      fontSize: 12,
      color: secondaryText,
      textAlign: 'center',
      marginBottom: 40,
      marginTop: 8,
    },
    colorRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
    colorDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: 'transparent' },
    colorDotSelected: { borderColor: isDark ? '#FFFFFF' : '#000000' },
    appearRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
    appearChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, backgroundColor: isDark ? '#3A3A3C' : '#E5E5EA' },
    appearChipActive: { backgroundColor: '#0A84FF' },
    appearChipText: { fontSize: 13, color: primaryText },
    appearChipTextActive: { fontSize: 13, color: '#FFFFFF' },
  });

  const Row = ({ icon, label, value = '', onPress = null as any, isLast = false, rightEl = null as any }) => (
    <TouchableOpacity
      style={[styles.row, isLast && styles.rowLast]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.6 : 1}
    >
      <View style={styles.rowLeft}>
        <View style={styles.rowIcon}>
          <Ionicons name={icon as any} size={20} color={secondaryText} />
        </View>
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      {rightEl ? rightEl : (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {value ? <Text style={styles.rowValue}>{value}</Text> : null}
          {onPress ? <Ionicons name="chevron-forward" size={17} color={secondaryText} /> : null}
        </View>
      )}
    </TouchableOpacity>
  );

  const SwitchRow = ({ icon, label, value, onChange, isLast = false }) => (
    <View style={[styles.row, isLast && styles.rowLast]}>
      <View style={styles.rowLeft}>
        <View style={styles.rowIcon}>
          <Ionicons name={icon as any} size={20} color={secondaryText} />
        </View>
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: '#34C759', false: switchTrackFalse }}
        thumbColor={Platform.OS === 'ios' ? undefined : '#FFFFFF'}
      />
    </View>
  );

  const InlineRow = ({ icon, label, children, isLast = false }) => (
    <View style={[styles.row, isLast && styles.rowLast, { flexDirection: 'column', alignItems: 'flex-start' }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 0 }}>
        <View style={styles.rowIcon}>
          <Ionicons name={icon as any} size={20} color={secondaryText} />
        </View>
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <View style={{ paddingLeft: 36 }}>{children}</View>
    </View>
  );

  const accentColors = ['#10A37F', '#0084FF', '#FF3B30', '#FF9500', '#5856D6'];
  const appearOptions = ['System', 'Light', 'Dark'];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
        <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
          <Ionicons name="close" size={18} color={primaryText} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile */}
        <View style={styles.profileSection}>
          <View style={styles.avatarWrap}>
            {profilePhoto ? (
              <Image source={{ uri: profilePhoto }} style={styles.avatarImg} contentFit="cover" />
            ) : (
              <Text style={styles.avatarInitial}>{initials}</Text>
            )}
          </View>
          <Text style={styles.profileName}>{displayName}</Text>
          {displayUsername ? <Text style={styles.profileUsername}>{displayUsername}</Text> : null}
          <TouchableOpacity style={styles.editBtn} onPress={openEditModal}>
            <Text style={styles.editBtnText}>Edit profile</Text>
          </TouchableOpacity>
        </View>

        {/* Account */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Account</Text>
          <View style={styles.card}>
            <Row icon="mail-outline" label="Email" value={(user?.email?.length ?? 0) > 22 ? (user?.email?.slice(0, 20) + '...') : (user?.email || '')} />
            <Row icon="add-circle-outline" label="Subscription" value={tierLabel()} onPress={() => router.push('/subscription')} />
            {!isPaidPlan && (
              <Row icon="arrow-up-circle-outline" label="Upgrade to Dawinix Plus" onPress={() => router.push('/subscription')} />
            )}
            <Row icon="refresh-outline" label="Restore purchases" onPress={() => router.push('/subscription')} />
            <Row icon="receipt-outline" label="Orders" onPress={() => router.push('/orders')} />
            <Row icon="person-circle-outline" label="Personalization" onPress={() => router.push('/personalization')} />
            <Row icon="notifications-outline" label="Notifications" onPress={() => router.push('/notifications')} />
            <Row icon="lock-closed-outline" label="Security" onPress={() => router.push('/security')} />
            <Row icon="people-outline" label="Parental controls" onPress={() => router.push('/parental-controls')} />
            <Row icon="document-lock-outline" label="Data controls" onPress={() => router.push('/data-controls')} />
            <Row icon="megaphone-outline" label="Ads controls" onPress={() => router.push('/ads-controls')} />
            <Row icon="archive-outline" label="Archived chats" onPress={() => router.push('/archived-chats')} isLast />
          </View>
        </View>

        {/* App Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>App Settings</Text>
          <View style={styles.card}>
            <InlineRow icon="contrast-outline" label="Appearance">
              <View style={styles.appearRow}>
                {appearOptions.map(opt => {
                  const active = settings.appearance === opt;
                  return (
                    <TouchableOpacity key={opt} onPress={() => updateSetting('appearance', opt)}
                      style={[styles.appearChip, active && styles.appearChipActive]}>
                      <Text style={active ? styles.appearChipTextActive : styles.appearChipText}>{opt}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </InlineRow>
            <InlineRow icon="color-palette-outline" label="Accent color">
              <View style={styles.colorRow}>
                {accentColors.map(c => (
                  <TouchableOpacity key={c} onPress={() => updateSetting('accentColor', c)}
                    style={[styles.colorDot, { backgroundColor: c }, settings.accentColor === c && styles.colorDotSelected]} />
                ))}
              </View>
            </InlineRow>
            <SwitchRow icon="phone-portrait-outline" label="Haptic feedback"
              value={settings.hapticFeedback} onChange={v => updateSetting('hapticFeedback', v)} />
            <SwitchRow icon="text-outline" label="Auto spelling correction"
              value={settings.autoSpelling} onChange={v => updateSetting('autoSpelling', v)} />
            <Row icon="globe-outline" label="App language" value={settings.appLanguage} onPress={() => router.push('/languages')} />
            <Row icon="language-outline" label="Main language for speech" value={settings.mainLanguage} onPress={() => router.push('/languages')} />
            <Row icon="mic-outline" label="Voice selection" value={settings.voiceSelection} onPress={() => router.push('/voice-settings')} />
            <SwitchRow icon="chatbubbles-outline" label="Background conversations"
              value={settings.backgroundConversations} onChange={v => updateSetting('backgroundConversations', v)} />
            <SwitchRow icon="create-outline" label="Autocomplete"
              value={settings.autocomplete} onChange={v => updateSetting('autocomplete', v)} />
            <SwitchRow icon="trending-up-outline" label="Trending searches"
              value={settings.trendingSearches} onChange={v => updateSetting('trendingSearches', v)} />
            <SwitchRow icon="list-outline" label="Follow-up suggestions"
              value={settings.followupSuggestions} onChange={v => updateSetting('followupSuggestions', v)} isLast />
          </View>
        </View>

        {/* Admin */}
        {isAdmin && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Admin</Text>
            <View style={styles.card}>
              <Row icon="shield-outline" label="Admin Dashboard" onPress={() => router.push('/admin')} />
              <Row icon="key-outline" label="Apple JWT Key Generator" onPress={() => router.push('/AppleGenerateJWTkey')} />
              <Row icon="mail-outline" label="Send Email to Users" onPress={() => router.push('/admin-email')} isLast />
            </View>
          </View>
        )}

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>About</Text>
          <View style={styles.card}>
            <Row icon="bug-outline" label="Report bug" onPress={() => router.push('/bugreport')} />
            <Row icon="document-text-outline" label="Terms of Use" onPress={() => router.push('/terms-of-use')} />
            <Row icon="shield-checkmark-outline" label="Privacy Policy" onPress={() => router.push('/privacy-policy')} isLast />
          </View>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>Dawinix v{currentVersion}</Text>
      </ScrollView>

      {/* Photo Picker Action Sheet */}
      <Modal visible={photoPickerVisible} transparent animationType="fade" onRequestClose={() => setPhotoPickerVisible(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <BlurView intensity={isDark ? 55 : 40} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.22)' }]} />
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setPhotoPickerVisible(false)} />
          <View style={{ paddingHorizontal: 12, paddingBottom: insets.bottom + 8 }}>
            {/* Options card */}
            <View style={{
              borderRadius: 18, overflow: 'hidden', marginBottom: 10,
              shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 20,
            }}>
              {Platform.OS === 'ios' ? (
                <BlurView intensity={isDark ? 90 : 75} tint={isDark ? 'dark' : 'light'} style={{ borderRadius: 18, overflow: 'hidden' }}>
                  {/* Camera */}
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 18, gap: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }}
                    onPress={pickFromCamera} activeOpacity={0.7}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#10A37F22', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="camera" size={20} color="#10A37F" />
                    </View>
                    <Text style={{ fontSize: 17, color: primaryText, fontWeight: '500' }}>Take Photo</Text>
                  </TouchableOpacity>
                  {/* Library */}
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 18, gap: 14 }}
                    onPress={pickFromLibrary} activeOpacity={0.7}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#0A84FF22', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="images" size={20} color="#0A84FF" />
                    </View>
                    <Text style={{ fontSize: 17, color: primaryText, fontWeight: '500' }}>Choose from Library</Text>
                  </TouchableOpacity>
                </BlurView>
              ) : (
                <View style={{ backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderRadius: 18, overflow: 'hidden' }}>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 18, gap: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
                    onPress={pickFromCamera} activeOpacity={0.7}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#10A37F22', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="camera" size={20} color="#10A37F" />
                    </View>
                    <Text style={{ fontSize: 17, color: primaryText, fontWeight: '500' }}>Take Photo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 18, gap: 14 }}
                    onPress={pickFromLibrary} activeOpacity={0.7}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#0A84FF22', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="images" size={20} color="#0A84FF" />
                    </View>
                    <Text style={{ fontSize: 17, color: primaryText, fontWeight: '500' }}>Choose from Library</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
            {/* Cancel */}
            <TouchableOpacity
              style={{
                borderRadius: 16, overflow: 'hidden',
                shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 10,
              }}
              onPress={() => setPhotoPickerVisible(false)} activeOpacity={0.8}
            >
              {Platform.OS === 'ios' ? (
                <BlurView intensity={isDark ? 90 : 75} tint={isDark ? 'dark' : 'light'} style={{ borderRadius: 16, overflow: 'hidden', paddingVertical: 18, alignItems: 'center' }}>
                  <Text style={{ fontSize: 17, fontWeight: '600', color: primaryText }}>Cancel</Text>
                </BlurView>
              ) : (
                <View style={{ backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderRadius: 16, paddingVertical: 18, alignItems: 'center' }}>
                  <Text style={{ fontSize: 17, fontWeight: '600', color: primaryText }}>Cancel</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Edit Profile Modal — glassmorphism */}
      <Modal visible={editModalVisible} transparent animationType="slide" onRequestClose={() => setEditModalVisible(false)}>
        <View style={{ flex: 1 }}>
          <BlurView intensity={isDark ? 55 : 40} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.18)' }]} />
          <TouchableOpacity style={{ flex: 0.3 }} activeOpacity={1} onPress={() => setEditModalVisible(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 0.7 }}>
            <View style={{
              flex: 1, borderTopLeftRadius: 28, borderTopRightRadius: 28,
              overflow: 'hidden',
              shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.35, shadowRadius: 24, elevation: 24,
            }}>
              {Platform.OS === 'ios' ? (
                <BlurView intensity={isDark ? 90 : 75} tint={isDark ? 'dark' : 'light'} style={{ flex: 1, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' }}>
                  <EditModalContent
                    isDark={isDark}
                    editPhoto={editPhoto}
                    initials={initials}
                    uploadingPhoto={uploadingPhoto}
                    editName={editName}
                    editUsername={editUsername}
                    canChangeUsername={canChangeUsername}
                    daysUntilUsernameChange={daysUntilUsernameChange}
                    savingProfile={savingProfile}
                    primaryText={primaryText}
                    secondaryText={secondaryText}
                    insets={insets}
                    onPickPhoto={pickEditPhoto}
                    onChangeName={setEditName}
                    onChangeUsername={setEditUsername}
                    onSave={saveProfile}
                    onClose={() => setEditModalVisible(false)}
                  />
                </BlurView>
              ) : (
                <View style={{ flex: 1, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' }}>
                  <EditModalContent
                    isDark={isDark}
                    editPhoto={editPhoto}
                    initials={initials}
                    uploadingPhoto={uploadingPhoto}
                    editName={editName}
                    editUsername={editUsername}
                    canChangeUsername={canChangeUsername}
                    daysUntilUsernameChange={daysUntilUsernameChange}
                    savingProfile={savingProfile}
                    primaryText={primaryText}
                    secondaryText={secondaryText}
                    insets={insets}
                    onPickPhoto={pickEditPhoto}
                    onChangeName={setEditName}
                    onChangeUsername={setEditUsername}
                    onSave={saveProfile}
                    onClose={() => setEditModalVisible(false)}
                  />
                </View>
              )}
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

fix modal edit profile longe make it more kout li tro longue anpil  on simple modal fix and fix photo upload lan li pa mache.
