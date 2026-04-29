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

// ═══════════════════════════════════════════════════════════════════════════════
// EDIT PROFILE MODAL CONTENT
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
  const inputBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const borderColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)';
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
// GUEST SETTINGS (Limited)
// ═══════════════════════════════════════════════════════════════════════════════
function GuestSettings() {
  const { isDark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const dividerColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const primaryText = isDark ? '#FFFFFF' : '#0A0A14';
  const secondaryText = isDark ? 'rgba(200,200,210,0.75)' : 'rgba(60,60,80,0.65)';
  const iconColor = isDark ? 'rgba(220,225,255,0.82)' : 'rgba(30,30,60,0.72)';

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      {Platform.OS === 'ios' ? (
        <BlurView intensity={isDark ? 72 : 60} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(16,16,22,0.96)' : 'rgba(228,230,240,0.97)' }]} />
      )}
      {/* Header */}
      {Platform.OS === 'ios' ? (
        <BlurView intensity={isDark ? 55 : 45} tint={isDark ? 'dark' : 'light'} style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
          paddingTop: insets.top + 16, paddingBottom: 16, paddingHorizontal: 20,
          borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: dividerColor,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="settings-outline" size={20} color={iconColor} />
            <Text style={{ fontSize: 19, fontWeight: '700', color: primaryText, letterSpacing: -0.3 }}>Settings</Text>
          </View>
          <TouchableOpacity
            style={{
              position: 'absolute', right: 16, top: insets.top + 10,
              width: 34, height: 34, borderRadius: 17,
              backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.09)',
              alignItems: 'center', justifyContent: 'center',
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
            }}
            onPress={() => router.back()}
          >
            <Ionicons name="close" size={16} color={primaryText} />
          </TouchableOpacity>
        </BlurView>
      ) : (
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
          paddingTop: insets.top + 16, paddingBottom: 16, paddingHorizontal: 20,
          backgroundColor: isDark ? 'rgba(20,20,30,0.92)' : 'rgba(235,237,248,0.92)',
          borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: dividerColor,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="settings-outline" size={20} color={iconColor} />
            <Text style={{ fontSize: 19, fontWeight: '700', color: primaryText }}>Settings</Text>
          </View>
          <TouchableOpacity
            style={{
              position: 'absolute', right: 16, top: insets.top + 10,
              width: 34, height: 34, borderRadius: 17,
              backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.09)',
              alignItems: 'center', justifyContent: 'center',
            }}
            onPress={() => router.back()}
          >
            <Ionicons name="close" size={16} color={primaryText} />
          </TouchableOpacity>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Account */}
        <View style={{ marginTop: 24, paddingHorizontal: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: secondaryText, marginBottom: 8, marginLeft: 4 }}>Account</Text>
          <GlassCard isDark={isDark}>
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
                  borderBottomColor: dividerColor,
                }}
                onPress={() => router.push(item.route as any)}
                activeOpacity={0.6}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={item.icon as any} size={17} color={iconColor} />
                  </View>
                  <Text style={{ fontSize: 16, color: primaryText }}>{item.label}</Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color={secondaryText} />
              </TouchableOpacity>
            ))}
          </GlassCard>
        </View>

        {/* Sign up CTA */}
        <View style={{ marginHorizontal: 16, marginTop: 32, marginBottom: 8 }}>
          <GlassCard isDark={isDark}>
            <View style={{ padding: 24, alignItems: 'center' }}>
              <View style={{
                width: 64, height: 64, borderRadius: 32,
                backgroundColor: '#10A37F22', alignItems: 'center', justifyContent: 'center', marginBottom: 14,
                borderWidth: 1, borderColor: '#10A37F44',
              }}>
                <Ionicons name="lock-open-outline" size={30} color="#10A37F" />
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
          </GlassCard>
        </View>

        <View style={{ height: insets.bottom + 40 }} />
      </ScrollView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// GLASS CARD COMPONENT — Reusable frosted glass card
// ═══════════════════════════════════════════════════════════════════════════════
function GlassCard({ children, isDark, style = {} }: { children: React.ReactNode; isDark: boolean; style?: any }) {
  if (Platform.OS === 'ios') {
    return (
      <BlurView
        intensity={isDark ? 40 : 28}
        tint={isDark ? 'dark' : 'light'}
        style={[{
          borderRadius: 18,
          overflow: 'hidden',
          backgroundColor: isDark ? 'rgba(36,36,52,0.5)' : 'rgba(255,255,255,0.68)',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)',
        }, style]}
      >
        {children}
      </BlurView>
    );
  }
  return (
    <View style={[{
      borderRadius: 18,
      overflow: 'hidden',
      backgroundColor: isDark ? 'rgba(36,36,52,0.88)' : 'rgba(255,255,255,0.88)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
    }, style]}>
      {children}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACCENT COLOR PICKER ROW — Inline palette inside settings card
// ═══════════════════════════════════════════════════════════════════════════════
const ACCENT_COLORS = [
  '#10A37F', // ChatGPT green (default)
  '#0A84FF', // iOS blue
  '#FF9F0A', // amber
  '#FF453A', // red
  '#BF5AF2', // purple
  '#FF375F', // pink
  '#30D158', // mint green
  '#5AC8FA', // sky blue
  '#FFD60A', // yellow
  '#FF6B00', // orange
];

function AccentColorRow({ isDark, dividerColor, iconColor, primaryText, current, onChange }: {
  isDark: boolean;
  dividerColor: string;
  iconColor: string;
  primaryText: string;
  secondaryText: string;
  current: string;
  onChange: (color: string) => void;
}) {
  return (
    <View style={{
      paddingVertical: 13,
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: dividerColor,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <View style={{
          width: 30, height: 30, borderRadius: 8,
          backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Ionicons name="color-palette-outline" size={17} color={iconColor} />
        </View>
        <Text style={{ fontSize: 16, color: primaryText, fontWeight: '400', flex: 1 }}>Accent color</Text>
        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: current, borderWidth: 2, borderColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.15)' }} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingLeft: 42 }}>
        {ACCENT_COLORS.map(color => {
          const isSelected = current === color;
          return (
            <TouchableOpacity
              key={color}
              onPress={() => onChange(color)}
              activeOpacity={0.75}
              style={{
                width: 32, height: 32, borderRadius: 16,
                backgroundColor: color,
                alignItems: 'center', justifyContent: 'center',
                borderWidth: isSelected ? 3 : 2,
                borderColor: isSelected
                  ? (isDark ? '#FFF' : '#000')
                  : 'transparent',
                shadowColor: color,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: isSelected ? 0.6 : 0.3,
                shadowRadius: 4,
                elevation: isSelected ? 6 : 2,
              }}
            >
              {isSelected ? <Ionicons name="checkmark" size={16} color="#FFF" /> : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SETTINGS SCREEN
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

  const currentVersion = Constants.expoConfig?.version || '1.0.0';
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'update' | 'no-update' | 'version'>('idle');

  // ── Design tokens — blur/glass theme ──────────────────────────────────
  const primaryText = isDark ? '#FFFFFF' : '#0A0A14';
  const secondaryText = isDark ? 'rgba(200,200,215,0.72)' : 'rgba(50,50,75,0.62)';
  const sectionLabelColor = isDark ? 'rgba(180,182,200,0.68)' : 'rgba(70,72,95,0.62)';
  const switchTrackFalse = isDark ? '#3A3A4C' : '#C8C8D8';
  const dividerColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const iconColor = isDark ? 'rgba(215,220,255,0.85)' : 'rgba(25,25,60,0.75)';

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
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
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
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
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

  if (!user) return <GuestSettings />;

  const displayName = fullName || username || user?.email?.split('@')[0] || 'User';
  const displayUsername = username || '';
  const initials = (displayName[0] || 'U').toUpperCase();

  // ── Styles ──────────────────────────────────────────────────────────────
  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent' },

    // Header — glass blur redesign
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: insets.top + 16,
      paddingBottom: 16,
      paddingHorizontal: 20,
      backgroundColor: 'transparent',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: dividerColor,
    },
    headerTitle: { fontSize: 19, fontWeight: '700', color: primaryText, letterSpacing: -0.3 },
    closeButton: {
      position: 'absolute',
      right: 16,
      top: insets.top + 10,
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.09)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
    },

    // Profile section
    profileSection: {
      alignItems: 'center',
      paddingVertical: 28,
      paddingHorizontal: 20,
    },
    avatarWrap: {
      width: 84,
      height: 84,
      borderRadius: 42,
      backgroundColor: isDark ? 'rgba(60,60,80,0.6)' : 'rgba(200,200,220,0.5)',
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
      borderWidth: 2,
      borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
    },
    avatarImg: { width: 84, height: 84, borderRadius: 42 },
    avatarInitial: { fontSize: 34, fontWeight: '700', color: primaryText },
    profileName: { fontSize: 22, fontWeight: '700', color: primaryText, marginBottom: 4 },
    profileUsername: { fontSize: 15, color: secondaryText, marginBottom: 14 },
    editBtn: {
      paddingHorizontal: 22,
      paddingVertical: 9,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)',
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
    },
    editBtnText: { fontSize: 15, color: primaryText, fontWeight: '600' },

    // Section labels
    sectionLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: sectionLabelColor,
      marginBottom: 8,
      marginLeft: 4,
      letterSpacing: 0.5,
      textTransform: 'uppercase' as any,
    },
    section: { marginTop: 24, paddingHorizontal: 16 },

    // Row styles
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
      width: 30,
      height: 30,
      borderRadius: 8,
      backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowLabel: { fontSize: 16, color: primaryText, fontWeight: '400', flex: 1 },
    rowValue: { fontSize: 14, color: secondaryText, marginRight: 4 },

    // Inline row (for appearance, accent color)
    inlineRow: {
      flexDirection: 'column',
      alignItems: 'flex-start',
      paddingVertical: 13,
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: dividerColor,
    },
    inlineRowLast: {
      flexDirection: 'column',
      alignItems: 'flex-start',
      paddingVertical: 13,
      paddingHorizontal: 16,
      borderBottomWidth: 0,
    },
    inlineRowHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 0,
    },
    inlineContent: { paddingLeft: 42, marginTop: 8 },

    // Appearance chips
    appearRow: { flexDirection: 'row', gap: 8 },
    appearChip: {
      paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10,
      backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
      borderWidth: 1, borderColor: 'transparent',
    },
    appearChipActive: { backgroundColor: '#0A84FF22', borderColor: '#0A84FF55' },
    appearChipText: { fontSize: 13, color: primaryText },
    appearChipTextActive: { fontSize: 13, color: '#0A84FF', fontWeight: '600' },

    // Switch row
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 13,
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: dividerColor,
    },
    switchRowLast: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 13,
      paddingHorizontal: 16,
      borderBottomWidth: 0,
    },

    // Descriptive text below sections
    descText: {
      fontSize: 13,
      color: secondaryText,
      marginTop: 8,
      marginHorizontal: 16,
      lineHeight: 18,
    },

    // Version text
    versionText: {
      fontSize: 12,
      color: secondaryText,
      textAlign: 'center',
      marginBottom: 40,
      marginTop: 8,
    },
  });

  // ── Row Components ──────────────────────────────────────────────────────
  const Row = ({ icon, label, value = '', onPress = null as any, isLast = false, rightEl = null as any }) => (
    <TouchableOpacity
      style={[styles.row, isLast && styles.rowLast]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.6 : 1}
    >
      <View style={styles.rowLeft}>
        <View style={styles.rowIcon}>
          <Ionicons name={icon as any} size={17} color={iconColor} />
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
    <View style={isLast ? styles.switchRowLast : styles.switchRow}>
      <View style={styles.rowLeft}>
        <View style={styles.rowIcon}>
          <Ionicons name={icon as any} size={17} color={iconColor} />
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
    <View style={isLast ? styles.inlineRowLast : styles.inlineRow}>
      <View style={styles.inlineRowHeader}>
        <View style={styles.rowIcon}>
          <Ionicons name={icon as any} size={17} color={iconColor} />
        </View>
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <View style={styles.inlineContent}>{children}</View>
    </View>
  );

  const appearOptions = ['System', 'Light', 'Dark'];

  return (
    <View style={styles.container}>
      {/* Full-screen blur background */}
      {Platform.OS === 'ios' ? (
        <BlurView
          intensity={isDark ? 72 : 60}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(16,16,22,0.96)' : 'rgba(228,230,240,0.97)' }]} />
      )}

      {/* ═══════════════════════════════════════════════════════════════
          HEADER — Glass blur redesign with icon + bold title
          ═══════════════════════════════════════════════════════════════ */}
      {Platform.OS === 'ios' ? (
        <BlurView
          intensity={isDark ? 55 : 45}
          tint={isDark ? 'dark' : 'light'}
          style={[styles.header]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="settings-outline" size={20} color={iconColor} />
            <Text style={styles.headerTitle}>Settings</Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
            <Ionicons name="close" size={16} color={primaryText} />
          </TouchableOpacity>
        </BlurView>
      ) : (
        <View style={[styles.header, { backgroundColor: isDark ? 'rgba(20,20,30,0.92)' : 'rgba(235,237,248,0.92)' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="settings-outline" size={20} color={iconColor} />
            <Text style={styles.headerTitle}>Settings</Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
            <Ionicons name="close" size={16} color={primaryText} />
          </TouchableOpacity>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ═══════════════════════════════════════════════════════════════
            PROFILE SECTION
            ═══════════════════════════════════════════════════════════════ */}
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

        {/* ═══════════════════════════════════════════════════════════════
            ACCOUNT SECTION
            ═══════════════════════════════════════════════════════════════ */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Account</Text>
          <GlassCard isDark={isDark}>
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
          </GlassCard>
        </View>

        {/* ═══════════════════════════════════════════════════════════════
            APP SETTINGS SECTION
            ═══════════════════════════════════════════════════════════════ */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>App</Text>
          <GlassCard isDark={isDark}>
            <Row icon="globe-outline" label="App language" value={settings.appLanguage || 'English'} onPress={() => router.push('/languages')} />
            <InlineRow icon="moon-outline" label="Appearance">
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
            <AccentColorRow
              isDark={isDark}
              dividerColor={dividerColor}
              iconColor={iconColor}
              primaryText={primaryText}
              secondaryText={secondaryText}
              current={settings.accentColor || '#10A37F'}
              onChange={v => updateSetting('accentColor', v)}
            />
            <SwitchRow icon="phone-portrait-outline" label="Haptic feedback"
              value={settings.hapticFeedback} onChange={v => updateSetting('hapticFeedback', v)} />
            <SwitchRow icon="text-outline" label="Correct spelling automatically"
              value={settings.autoSpelling} onChange={v => updateSetting('autoSpelling', v)} isLast />
          </GlassCard>
        </View>

        {/* ═══════════════════════════════════════════════════════════════
            SPEECH SECTION
            ═══════════════════════════════════════════════════════════════ */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Speech</Text>
          <GlassCard isDark={isDark}>
            <Row icon="globe-outline" label="Main language" value={settings.mainLanguage || 'English'} onPress={() => router.push('/languages')} isLast />
          </GlassCard>
          <Text style={styles.descText}>
            For best results, select the language you mainly speak. If not listed, it may still be supported via auto-detection.
          </Text>
        </View>

        {/* Voice subsection */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Voice</Text>
          <GlassCard isDark={isDark}>
            <Row icon="mic-outline" label="Voice" value={settings.voiceSelection || 'Juniper'} onPress={() => router.push('/voice-settings')} />
            <SwitchRow icon="chatbubbles-outline" label="Background conversations"
              value={settings.backgroundConversations} onChange={v => updateSetting('backgroundConversations', v)} isLast />
          </GlassCard>
          <Text style={styles.descText}>
            Background conversations keep the chat going in other apps or while the screen is off.{' '}
            <Text style={{ color: '#0A84FF' }} onPress={() => {}}>Learn more</Text>
          </Text>
        </View>

        {/* ═══════════════════════════════════════════════════════════════
            SUGGESTIONS SECTION
            ═══════════════════════════════════════════════════════════════ */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Suggestions</Text>
          <GlassCard isDark={isDark}>
            <SwitchRow icon="create-outline" label="Autocomplete"
              value={settings.autocomplete} onChange={v => updateSetting('autocomplete', v)} />
            <SwitchRow icon="trending-up-outline" label="Trending searches"
              value={settings.trendingSearches} onChange={v => updateSetting('trendingSearches', v)} isLast />
          </GlassCard>
        </View>

        {/* ═══════════════════════════════════════════════════════════════
            ADMIN SECTION
            ═══════════════════════════════════════════════════════════════ */}
        {isAdmin && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Admin</Text>
            <GlassCard isDark={isDark}>
              <Row icon="shield-outline" label="Admin Dashboard" onPress={() => router.push('/admin')} />
              <Row icon="key-outline" label="Apple JWT Key Generator" onPress={() => router.push('/AppleGenerateJWTkey')} />
              <Row icon="mail-outline" label="Send Email to Users" onPress={() => router.push('/admin-email')} isLast />
            </GlassCard>
          </View>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            ABOUT SECTION
            ═══════════════════════════════════════════════════════════════ */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>About</Text>
          <GlassCard isDark={isDark}>
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
                  <ActivityIndicator size="small" color={iconColor} />
                ) : (
                  <Text style={styles.rowValue}>{getUpdateLabel()}</Text>
                )
              }
            />
          </GlassCard>
        </View>

        {/* ═══════════════════════════════════════════════════════════════
            LOG OUT — Glass card with icon badge
            ═══════════════════════════════════════════════════════════════ */}
        <View style={{ marginTop: 32, paddingHorizontal: 16 }}>
          <GlassCard isDark={isDark}>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 16 }}
              onPress={handleLogout}
              activeOpacity={0.6}
            >
              <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: '#FF453A22', alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1, borderColor: '#FF453A33' }}>
                <Ionicons name="log-out-outline" size={17} color="#FF453A" />
              </View>
              <Text style={{ fontSize: 16, color: '#FF453A', fontWeight: '600' }}>Log out</Text>
            </TouchableOpacity>
          </GlassCard>
        </View>

        <View style={{ height: insets.bottom + 40 }} />
      </ScrollView>

      {/* ═══════════════════════════════════════════════════════════════
          EDIT PROFILE MODAL — with blur/glass effect
          ═══════════════════════════════════════════════════════════════ */}
      <Modal visible={editModalVisible} transparent animationType="slide" onRequestClose={() => setEditModalVisible(false)}>
        <View style={{ flex: 1 }}>
          <BlurView intensity={isDark ? 55 : 40} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.18)' }]} />
          <TouchableOpacity style={{ flex: 0.25 }} activeOpacity={1} onPress={() => setEditModalVisible(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 0.75, maxHeight: 560 }}>
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

      {/* ═══════════════════════════════════════════════════════════════
          PHOTO PICKER MODAL — with blur/glass effect
          ═══════════════════════════════════════════════════════════════ */}
      <Modal visible={photoPickerVisible} transparent animationType="fade" onRequestClose={() => setPhotoPickerVisible(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <BlurView intensity={isDark ? 55 : 40} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.22)' }]} />
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setPhotoPickerVisible(false)} />
          <View style={{ paddingHorizontal: 12, paddingBottom: insets.bottom + 8 }}>
            <View style={{
              borderRadius: 18, overflow: 'hidden', marginBottom: 10,
              shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 20,
            }}>
              {Platform.OS === 'ios' ? (
                <BlurView intensity={isDark ? 90 : 75} tint={isDark ? 'dark' : 'light'} style={{ borderRadius: 18, overflow: 'hidden' }}>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 18, gap: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }}
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
                </BlurView>
              ) : (
                <View style={{ backgroundColor: isDark ? 'rgba(36,36,52,0.95)' : 'rgba(255,255,255,0.95)', borderRadius: 18, overflow: 'hidden' }}>
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
                <View style={{ backgroundColor: isDark ? 'rgba(36,36,52,0.95)' : 'rgba(255,255,255,0.95)', borderRadius: 16, paddingVertical: 18, alignItems: 'center' }}>
                  <Text style={{ fontSize: 17, fontWeight: '600', color: primaryText }}>Cancel</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
