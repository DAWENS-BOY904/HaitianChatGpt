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
  Linking,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import VersionCheck from 'react-native-version-check';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
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

// ═══════════════════════════════════════════════════════════════════════════════
// EDIT PROFILE MODAL
// ═══════════════════════════════════════════════════════════════════════════════
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
  const inputBg = isDark ? '#2C2C2E' : '#F2F2F7';
  const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  const canChange = canChangeUsername();
  const daysLeft = daysUntilUsernameChange();

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 16 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Drag handle */}
      <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)', marginBottom: 20 }} />

      <Text style={{ fontSize: 20, fontWeight: '700', color: primaryText, textAlign: 'center', marginBottom: 6 }}>Edit Profile</Text>
      <Text style={{ fontSize: 13, color: secondaryText, textAlign: 'center', marginBottom: 16 }}>Your profile helps people recognize you.</Text>

      {/* Avatar */}
      <TouchableOpacity onPress={onPickPhoto} style={{ alignSelf: 'center', marginBottom: 18 }} activeOpacity={0.8}>
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
          paddingVertical: 12, fontSize: 16, color: primaryText, marginBottom: 12,
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
          color: canChange ? primaryText : secondaryText, marginBottom: 6,
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
        <Text style={{ fontSize: 12, color: secondaryText, marginBottom: 12, marginLeft: 2 }}>
          Username can be changed in {daysLeft} day{daysLeft !== 1 ? 's' : ''}
        </Text>
      )}
      {canChange && <View style={{ marginBottom: 12 }} />}

      {/* Save */}
      <TouchableOpacity
        style={{
          backgroundColor: '#10A37F', borderRadius: 50, paddingVertical: 14,
          alignItems: 'center', marginBottom: 10,
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
      <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 10 }} onPress={onClose}>
        <Text style={{ fontSize: 17, color: secondaryText }}>Cancel</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// GUEST SETTINGS
// ═══════════════════════════════════════════════════════════════════════════════
function GuestSettings() {
  const { isDark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const bg = isDark ? '#000000' : '#F2F2F7';
  const cardBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const primaryText = isDark ? '#FFFFFF' : '#000000';
  const secondaryText = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)';
  const divider = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingTop: insets.top + 12, paddingBottom: 12, paddingHorizontal: 20,
      }}>
        <Text style={{ fontSize: 19, fontWeight: '700', color: primaryText }}>Settings</Text>
        <TouchableOpacity
          style={{ position: 'absolute', right: 16, top: insets.top + 8, width: 34, height: 34, borderRadius: 17, backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.09)', alignItems: 'center', justifyContent: 'center' }}
          onPress={() => router.back()}
        >
          <Ionicons name="close" size={18} color={primaryText} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
        {/* Account */}
        <View style={{ marginTop: 8, paddingHorizontal: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: secondaryText, marginBottom: 8, marginLeft: 4, textTransform: 'uppercase' }}>Account</Text>
          <View style={{ backgroundColor: cardBg, borderRadius: 12, overflow: 'hidden' }}>
            {[
              { icon: 'megaphone-outline', label: 'Ads controls', route: '/ads-controls' },
              { icon: 'document-lock-outline', label: 'Data controls', route: '/data-controls' },
            ].map((item, i, arr) => (
              <TouchableOpacity
                key={item.label}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  paddingVertical: 14, paddingHorizontal: 16,
                  borderBottomWidth: i < arr.length - 1 ? StyleSheet.hairlineWidth : 0,
                  borderBottomColor: divider,
                }}
                onPress={() => router.push(item.route as any)}
                activeOpacity={0.6}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Ionicons name={item.icon as any} size={20} color={secondaryText} />
                  <Text style={{ fontSize: 16, color: primaryText }}>{item.label}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={secondaryText} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Sign up CTA */}
        <View style={{ marginHorizontal: 16, marginTop: 24 }}>
          <View style={{ backgroundColor: cardBg, borderRadius: 12, overflow: 'hidden' }}>
            <View style={{ padding: 24, alignItems: 'center' }}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#10A37F22', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <Ionicons name="lock-open-outline" size={28} color="#10A37F" />
              </View>
              <Text style={{ color: primaryText, fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 6 }}>Unlock all settings</Text>
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
        </View>
      </ScrollView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACCENT COLOR PICKER
// ═══════════════════════════════════════════════════════════════════════════════
const ACCENT_COLORS = [
  '#10A37F', '#0A84FF', '#FF9F0A', '#FF453A', '#BF5AF2',
  '#FF375F', '#30D158', '#5AC8FA', '#FFD60A', '#FF6B00',
];

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SETTINGS SCREEN — ChatGPT Style Redesign
// ═══════════════════════════════════════════════════════════════════════════════
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
  const [accentPickerVisible, setAccentPickerVisible] = useState(false);

  const currentVersion = Constants.expoConfig?.version || '1.0.0';
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'update' | 'no-update' | 'version'>('idle');

  // ── Design tokens ─────────────────────────────────────────────────────
  const bg = isDark ? '#000000' : '#F2F2F7';
  const cardBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const primaryText = isDark ? '#FFFFFF' : '#000000';
  const secondaryText = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)';
  const sectionLabel = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)';
  const divider = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const switchTrackFalse = isDark ? '#3A3A3C' : '#E5E5EA';
  const switchTrackTrue = '#34C759';

  useEffect(() => {
    checkAdminAccess();
    loadProfile();
  }, [user]);

  const checkAdminAccess = async () => {
    if (!user) return;
    const adminEmails = ['berryxoe@gmail.com', 'newdawens@gmail.com'];
    setIsAdmin(adminEmails.includes(user.email || ''));
  };

  const checkUpdate = async () => {
    setUpdateStatus('checking');
    try {
      const latest = await VersionCheck.getLatestVersion();
      const current = VersionCheck.getCurrentVersion();
      if (latest !== current) {
        setUpdateStatus('update');
      } else {
        setUpdateStatus('no-update');
        setTimeout(() => {
          setUpdateStatus('version');
          setTimeout(() => { setUpdateStatus('no-update'); }, 3000);
        }, 3000);
      }
    } catch (e) {
      setUpdateStatus('idle');
    }
  };

  const openStore = () => {
    const url = VersionCheck.getStoreUrl();
    Linking.openURL(url);
  };

  const handleUpdatePress = () => {
    if (updateStatus === 'update') { openStore(); } else { checkUpdate(); }
  };

  const getUpdateLabel = () => {
    switch (updateStatus) {
      case 'checking': return 'Checking...';
      case 'update': return 'Update';
      case 'no-update': return 'Up to date';
      case 'version': return `v${currentVersion}`;
      default: return 'Check update';
    }
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
    setEditModalVisible(false);
    setTimeout(() => setPhotoPickerVisible(true), 350);
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
    await new Promise(r => setTimeout(r, 350));
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permission needed', 'Please allow photo access to change your profile picture.');
      setEditModalVisible(true);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.8, base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      await uploadAsset(result.assets[0]);
    }
    setEditModalVisible(true);
  };

  const pickFromCamera = async () => {
    setPhotoPickerVisible(false);
    await new Promise(r => setTimeout(r, 350));
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permission needed', 'Please allow camera access to take a profile photo.');
      setEditModalVisible(true);
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true, aspect: [1, 1], quality: 0.8, base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      await uploadAsset(result.assets[0]);
    }
    setEditModalVisible(true);
  };

  const saveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    try {
      const updates: any = { full_name: editName, profile_photo_url: editPhoto };
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
      setFullName(editName);
      setUsername(editUsername);
      setProfilePhoto(editPhoto);
      if (usernameChanged) setUsernameLastChanged(new Date().toISOString());
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
        text: 'Log Out', style: 'destructive',
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

  if (!user) return <GuestSettings />;

  const displayName = fullName || username || user?.email?.split('@')[0] || 'User';
  const displayUsername = username || '';
  const initials = (displayName[0] || 'U').toUpperCase();

  // ── Reusable Card Component ──────────────────────────────────────────
  const Card = ({ children }: { children: React.ReactNode }) => (
    <View style={{
      backgroundColor: cardBg,
      borderRadius: 12,
      overflow: 'hidden',
      marginHorizontal: 16,
    }}>
      {children}
    </View>
  );

  // ── Section Label ────────────────────────────────────────────────────
  const SectionLabel = ({ text }: { text: string }) => (
    <Text style={{
      fontSize: 13,
      fontWeight: '600',
      color: sectionLabel,
      marginBottom: 8,
      marginLeft: 20,
      marginTop: 24,
      textTransform: 'uppercase',
    }}>
      {text}
    </Text>
  );

  // ── Row Component ────────────────────────────────────────────────────
  const Row = ({ icon, label, value, onPress, isLast, rightEl }: {
    icon: string; label: string; value?: string; onPress?: () => void; isLast?: boolean; rightEl?: React.ReactNode;
  }) => (
    <TouchableOpacity
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: divider,
      }}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.6 : 1}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
        <Ionicons name={icon as any} size={20} color={secondaryText} />
        <Text style={{ fontSize: 16, color: primaryText, fontWeight: '400' }}>{label}</Text>
      </View>
      {rightEl ? rightEl : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {value ? <Text style={{ fontSize: 15, color: secondaryText }}>{value}</Text> : null}
          {onPress ? <Ionicons name="chevron-forward" size={16} color={secondaryText} /> : null}
        </View>
      )}
    </TouchableOpacity>
  );

  // ── Switch Row ───────────────────────────────────────────────────────
  const SwitchRow = ({ icon, label, value, onChange, isLast }: {
    icon: string; label: string; value: boolean; onChange: (v: boolean) => void; isLast?: boolean;
  }) => (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
      borderBottomColor: divider,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
        <Ionicons name={icon as any} size={20} color={secondaryText} />
        <Text style={{ fontSize: 16, color: primaryText, fontWeight: '400' }}>{label}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: switchTrackTrue, false: switchTrackFalse }}
        thumbColor={Platform.OS === 'ios' ? undefined : '#FFFFFF'}
      />
    </View>
  );

  // ── Accent Color Row ─────────────────────────────────────────────────
  const AccentColorRow = () => {
    const current = settings.accentColor || '#10A37F';
    const colorNames: Record<string, string> = {
      '#10A37F': 'Green', '#0A84FF': 'Blue', '#FF9F0A': 'Orange',
      '#FF453A': 'Red', '#BF5AF2': 'Purple', '#FF375F': 'Pink',
      '#30D158': 'Mint', '#5AC8FA': 'Sky', '#FFD60A': 'Yellow', '#FF6B00': 'Orange',
    };
    return (
      <TouchableOpacity
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: divider,
        }}
        onPress={() => setAccentPickerVisible(true)}
        activeOpacity={0.6}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
          <Ionicons name="color-palette-outline" size={20} color={secondaryText} />
          <Text style={{ fontSize: 16, color: primaryText, fontWeight: '400' }}>Accent color</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: current }} />
          <Text style={{ fontSize: 15, color: secondaryText }}>{colorNames[current] || 'Green'}</Text>
          <Ionicons name="chevron-forward" size={16} color={secondaryText} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {/* ═══════════════════════════════════════════════════════════════
          HEADER — Centered title + X button top right
          ═══════════════════════════════════════════════════════════════ */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: insets.top + 12,
        paddingBottom: 12,
        paddingHorizontal: 20,
      }}>
        <Text style={{ fontSize: 19, fontWeight: '700', color: primaryText }}>Settings</Text>
        <TouchableOpacity
          style={{
            position: 'absolute',
            right: 16,
            top: insets.top + 8,
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.09)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onPress={() => router.back()}
        >
          <Ionicons name="close" size={18} color={primaryText} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {/* ═══════════════════════════════════════════════════════════════
            PROFILE SECTION — Centered avatar, name, username, edit button
            ═══════════════════════════════════════════════════════════════ */}
        <View style={{ alignItems: 'center', paddingVertical: 20 }}>
          <View style={{
            width: 84,
            height: 84,
            borderRadius: 42,
            overflow: 'hidden',
            backgroundColor: isDark ? '#3A3A3C' : '#E5E5EA',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 12,
          }}>
            {profilePhoto ? (
              <Image source={{ uri: profilePhoto }} style={{ width: 84, height: 84 }} contentFit="cover" />
            ) : (
              <Text style={{ fontSize: 34, fontWeight: '700', color: primaryText }}>{initials}</Text>
            )}
          </View>
          <Text style={{ fontSize: 22, fontWeight: '700', color: primaryText, marginBottom: 4 }}>{displayName}</Text>
          {displayUsername ? <Text style={{ fontSize: 15, color: secondaryText, marginBottom: 14 }}>{displayUsername}</Text> : null}
          <TouchableOpacity
            style={{
              paddingHorizontal: 22,
              paddingVertical: 9,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)',
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
            }}
            onPress={openEditModal}
          >
            <Text style={{ fontSize: 15, color: primaryText, fontWeight: '500' }}>Edit profile</Text>
          </TouchableOpacity>
        </View>

        {/* ═══════════════════════════════════════════════════════════════
            ACCOUNT SECTION
            ═══════════════════════════════════════════════════════════════ */}
        <SectionLabel text="Account" />
        <Card>
          <Row icon="mail-outline" label="Email" value={(user?.email?.length ?? 0) > 22 ? (user?.email?.slice(0, 20) + '...') : (user?.email || '')} />
          <Row icon="star-outline" label="Subscription" value={tierLabel()} onPress={() => router.push('/subscription')} />
          {!isPaidPlan && (
            <Row icon="arrow-up-circle-outline" label="Upgrade to Plus" onPress={() => router.push('/subscription')} />
          )}
          <Row icon="refresh-outline" label="Restore purchases" onPress={() => router.push('/subscription')} />
          <Row icon="receipt-outline" label="Orders" onPress={() => router.push('/orders')} />
          <Row icon="person-circle-outline" label="Personalization" onPress={() => router.push('/personalization')} />
          <Row icon="notifications-outline" label="Notifications" onPress={() => router.push('/notifications')} />
          <Row icon="people-outline" label="Parental controls" onPress={() => router.push('/parental-controls')} />
          <Row icon="document-lock-outline" label="Data controls" onPress={() => router.push('/data-controls')} />
          <Row icon="megaphone-outline" label="Ads controls" onPress={() => router.push('/ads-controls')} />
          <Row icon="archive-outline" label="Archived chats" onPress={() => router.push('/archived-chats')} />
          <Row icon="lock-closed-outline" label="Security" onPress={() => router.push('/security')} isLast />
        </Card>

        {/* ═══════════════════════════════════════════════════════════════
            APP SECTION
            ═══════════════════════════════════════════════════════════════ */}
        <SectionLabel text="App" />
        <Card>
          <Row icon="globe-outline" label="App language" value={settings.appLanguage || 'English'} onPress={() => router.push('/languages')} />
          <Row icon="moon-outline" label="Appearance" value={settings.appearance || 'System'} onPress={() => router.push('/appearance')} />
          <AccentColorRow />
          <SwitchRow icon="phone-portrait-outline" label="Haptic feedback" value={settings.hapticFeedback} onChange={v => updateSetting('hapticFeedback', v)} />
          <SwitchRow icon="text-outline" label="Correct spelling automatically" value={settings.autoSpelling} onChange={v => updateSetting('autoSpelling', v)} isLast />
        </Card>

        {/* ═══════════════════════════════════════════════════════════════
            SPEECH SECTION
            ═══════════════════════════════════════════════════════════════ */}
        <SectionLabel text="Speech" />
        <Card>
          <Row icon="globe-outline" label="Main language" value={settings.mainLanguage || 'English'} onPress={() => router.push('/languages')} isLast />
        </Card>
        <Text style={{
          fontSize: 13,
          color: secondaryText,
          marginTop: 8,
          marginHorizontal: 20,
          lineHeight: 18,
        }}>
          For best results, select the language you mainly speak. If it's not listed, it may still be supported via auto-detection.
        </Text>

        {/* ═══════════════════════════════════════════════════════════════
            VOICE SECTION
            ═══════════════════════════════════════════════════════════════ */}
        <SectionLabel text="Voice" />
        <Card>
          <Row icon="mic-outline" label="Voice" value={settings.voiceSelection || 'Juniper'} onPress={() => router.push('/voice-settings')} />
          <SwitchRow icon="chatbubbles-outline" label="Background conversations" value={settings.backgroundConversations} onChange={v => updateSetting('backgroundConversations', v)} isLast />
        </Card>
        <Text style={{
          fontSize: 13,
          color: secondaryText,
          marginTop: 8,
          marginHorizontal: 20,
          lineHeight: 18,
        }}>
          Background conversations keep the conversation going in other apps or while your screen is off.{' '}
          <Text style={{ color: '#0A84FF' }} onPress={() => {}}>Learn more</Text>
        </Text>

        {/* ═══════════════════════════════════════════════════════════════
            SUGGESTIONS SECTION
            ═══════════════════════════════════════════════════════════════ */}
        <SectionLabel text="Suggestions" />
        <Card>
          <SwitchRow icon="create-outline" label="Autocomplete" value={settings.autocomplete} onChange={v => updateSetting('autocomplete', v)} />
          <SwitchRow icon="trending-up-outline" label="Trending searches" value={settings.trendingSearches} onChange={v => updateSetting('trendingSearches', v)} isLast />
        </Card>

        {/* ═══════════════════════════════════════════════════════════════
            ADMIN SECTION
            ═══════════════════════════════════════════════════════════════ */}
        {isAdmin && (
          <>
            <SectionLabel text="Admin" />
            <Card>
              <Row icon="shield-outline" label="Admin Dashboard" onPress={() => router.push('/admin')} />
              <Row icon="key-outline" label="Apple JWT Key Generator" onPress={() => router.push('/AppleGenerateJWTkey')} />
              <Row icon="mail-outline" label="Send Email to Users" onPress={() => router.push('/admin-email')} isLast />
            </Card>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            ABOUT SECTION
            ═══════════════════════════════════════════════════════════════ */}
        <SectionLabel text="About" />
        <Card>
          <Row icon="bug-outline" label="Report bug" onPress={() => router.push('/bugreport')} />
          <Row icon="help-circle-outline" label="Help Center" onPress={() => router.push('/help-center')} />
          <Row icon="document-text-outline" label="Terms of Use" onPress={() => router.push('https://dawinix.com')} />
          <Row icon="shield-checkmark-outline" label="Privacy Policy" onPress={() => router.push('https://dawinix.com')} />
          <Row
            icon="cloud-download-outline"
            label="Check for updates"
            isLast
            onPress={handleUpdatePress}
            rightEl={
              updateStatus === 'checking' ? (
                <ActivityIndicator size="small" color={secondaryText} />
              ) : (
                <Text style={{ fontSize: 15, color: secondaryText }}>{getUpdateLabel()}</Text>
              )
            }
          />
        </Card>

        {/* ═══════════════════════════════════════════════════════════════
            LOG OUT
            ═══════════════════════════════════════════════════════════════ */}
        <View style={{ marginTop: 32, paddingHorizontal: 16 }}>
          <Card>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 16 }}
              onPress={handleLogout}
              activeOpacity={0.6}
            >
              <Ionicons name="log-out-outline" size={20} color="#FF453A" />
              <Text style={{ fontSize: 16, color: '#FF453A', fontWeight: '600', marginLeft: 12 }}>Log out</Text>
            </TouchableOpacity>
          </Card>
        </View>
      </ScrollView>

      {/* ═══════════════════════════════════════════════════════════════
          EDIT PROFILE MODAL
          ═══════════════════════════════════════════════════════════════ */}
      <Modal visible={editModalVisible} transparent animationType="slide" onRequestClose={() => setEditModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.3)' }}>
          <TouchableOpacity style={{ flex: 0.25 }} activeOpacity={1} onPress={() => setEditModalVisible(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 0.75, maxHeight: 560 }}>
            <View style={{
              flex: 1,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              overflow: 'hidden',
              backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
            }}>
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
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════
          PHOTO PICKER MODAL
          ═══════════════════════════════════════════════════════════════ */}
      <Modal visible={photoPickerVisible} transparent animationType="fade" onRequestClose={() => setPhotoPickerVisible(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.3)' }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setPhotoPickerVisible(false)} />
          <View style={{ paddingHorizontal: 12, paddingBottom: insets.bottom + 8 }}>
            <View style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 10, backgroundColor: cardBg }}>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 18, gap: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: divider }}
                onPress={pickFromCamera} activeOpacity={0.7}
              >
                <Ionicons name="camera" size={22} color="#10A37F" />
                <Text style={{ fontSize: 17, color: primaryText, fontWeight: '500' }}>Take Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 18, gap: 14 }}
                onPress={pickFromLibrary} activeOpacity={0.7}
              >
                <Ionicons name="images" size={22} color="#0A84FF" />
                <Text style={{ fontSize: 17, color: primaryText, fontWeight: '500' }}>Choose from Library</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={{ borderRadius: 16, overflow: 'hidden', backgroundColor: cardBg, paddingVertical: 18, alignItems: 'center' }}
              onPress={() => setPhotoPickerVisible(false)} activeOpacity={0.8}
            >
              <Text style={{ fontSize: 17, fontWeight: '600', color: primaryText }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════
          ACCENT COLOR PICKER MODAL
          ═══════════════════════════════════════════════════════════════ */}
      <Modal visible={accentPickerVisible} transparent animationType="fade" onRequestClose={() => setAccentPickerVisible(false)}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.3)' }}>
          <TouchableOpacity style={{ flex: 1, width: '100%' }} activeOpacity={1} onPress={() => setAccentPickerVisible(false)} />
          <View style={{
            width: '100%',
            maxWidth: 320,
            borderRadius: 20,
            overflow: 'hidden',
            backgroundColor: cardBg,
          }}>
            <View style={{ padding: 20, paddingBottom: insets.bottom > 0 ? insets.bottom + 12 : 20 }}>
              <Text style={{ fontSize: 17, fontWeight: '600', color: primaryText, textAlign: 'center', marginBottom: 16 }}>
                Choose Accent Color
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14 }}>
                {ACCENT_COLORS.map(color => {
                  const isSelected = (settings.accentColor || '#10A37F') === color;
                  return (
                    <TouchableOpacity
                      key={color}
                      onPress={() => { updateSetting('accentColor', color); setAccentPickerVisible(false); }}
                      activeOpacity={0.75}
                      style={{
                        width: 44, height: 44, borderRadius: 22,
                        backgroundColor: color,
                        alignItems: 'center', justifyContent: 'center',
                        borderWidth: isSelected ? 3.5 : 0,
                        borderColor: isDark ? '#FFF' : '#000',
                      }}
                    >
                      {isSelected ? <Ionicons name="checkmark" size={20} color="#FFF" /> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
          <TouchableOpacity style={{ flex: 1, width: '100%' }} activeOpacity={1} onPress={() => setAccentPickerVisible(false)} />
        </View>
      </Modal>
    </View>
  );
}
