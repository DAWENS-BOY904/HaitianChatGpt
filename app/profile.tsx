import React, { useState, useEffect, useCallback } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';

const PROFILE_BUCKET = 'profile-images';
const MAX_IMAGE_SIZE_MB = 5;

interface UserProfile {
  username: string | null;
  full_name: string | null;
  profile_photo_url: string | null;
  username_last_changed: string | null;
  is_lifetime_member: boolean;
  subscription_tier?: string;
  role?: string;
}

// ── Edit Profile Modal — full glassmorphism ──
function EditProfileModal({
  visible, profile, userId, isDark, onClose, onSaved,
}: {
  visible: boolean;
  profile: UserProfile | null;
  userId: string;
  isDark: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const supabase = getSupabaseClient();

  // Theme tokens for the modal
  const tint = isDark ? 'dark' : 'light';
  const labelColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';
  const inputBg = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)';
  const inputBorder = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)';
  const inputColor = isDark ? '#FFFFFF' : '#000000';
  const placeholderColor = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)';
  const noteColor = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)';
  const saveBg = isDark ? '#FFFFFF' : '#000000';
  const saveText = isDark ? '#000000' : '#FFFFFF';
  const cancelColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';
  const handleColor = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)';

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
        {/* Full backdrop blur */}
        <BlurView intensity={isDark ? 55 : 40} tint={tint} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.15)' }]} />

        <TouchableOpacity style={{ flex: 0.28 }} activeOpacity={1} onPress={onClose} />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 0.72 }}>
          <View style={[eStyles.sheet, { shadowColor: isDark ? '#000' : '#333' }]}>
            {/* Sheet glass layer */}
            {Platform.OS === 'ios' ? (
              <BlurView intensity={isDark ? 90 : 75} tint={tint} style={eStyles.sheetBlur}>
                <SheetContent
                  isDark={isDark}
                  photoUrl={photoUrl}
                  uploading={uploading}
                  saving={saving}
                  initial={initial}
                  fullName={fullName}
                  username={username}
                  handleColor={handleColor}
                  labelColor={labelColor}
                  inputBg={inputBg}
                  inputBorder={inputBorder}
                  inputColor={inputColor}
                  placeholderColor={placeholderColor}
                  noteColor={noteColor}
                  saveBg={saveBg}
                  saveText={saveText}
                  cancelColor={cancelColor}
                  onChangeName={setFullName}
                  onChangeUsername={(t) => setUsername(t.toLowerCase().replace(/\s/g, ''))}
                  onPickPhoto={handlePickPhoto}
                  onSave={handleSave}
                  onClose={onClose}
                />
              </BlurView>
            ) : (
              <View style={[eStyles.sheetBlur, { backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' }]}>
                <SheetContent
                  isDark={isDark}
                  photoUrl={photoUrl}
                  uploading={uploading}
                  saving={saving}
                  initial={initial}
                  fullName={fullName}
                  username={username}
                  handleColor={handleColor}
                  labelColor={labelColor}
                  inputBg={inputBg}
                  inputBorder={inputBorder}
                  inputColor={inputColor}
                  placeholderColor={placeholderColor}
                  noteColor={noteColor}
                  saveBg={saveBg}
                  saveText={saveText}
                  cancelColor={cancelColor}
                  onChangeName={setFullName}
                  onChangeUsername={(t) => setUsername(t.toLowerCase().replace(/\s/g, ''))}
                  onPickPhoto={handlePickPhoto}
                  onSave={handleSave}
                  onClose={onClose}
                />
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function SheetContent({
  isDark, photoUrl, uploading, saving, initial, fullName, username,
  handleColor, labelColor, inputBg, inputBorder, inputColor, placeholderColor,
  noteColor, saveBg, saveText, cancelColor,
  onChangeName, onChangeUsername, onPickPhoto, onSave, onClose,
}: any) {
  const textColor = isDark ? '#FFFFFF' : '#000000';
  return (
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={eStyles.scrollContent}>
      {/* Drag handle */}
      <View style={[eStyles.handle, { backgroundColor: handleColor }]} />

      {/* Title */}
      <Text style={[eStyles.sheetTitle, { color: textColor }]}>Edit Profile</Text>

      {/* Avatar picker */}
      <View style={eStyles.photoRow}>
        <TouchableOpacity style={eStyles.photoBtnWrap} onPress={onPickPhoto} disabled={uploading} activeOpacity={0.8}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={eStyles.photo} contentFit="cover" />
          ) : (
            <View style={[eStyles.photoPlaceholder, { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)' }]}>
              <Text style={[eStyles.photoInitial, { color: isDark ? '#FFF' : '#000' }]}>{initial}</Text>
            </View>
          )}
          {uploading ? (
            <View style={eStyles.photoOverlay}><ActivityIndicator color="#FFF" /></View>
          ) : (
            <View style={eStyles.cameraCircle}>
              <Ionicons name="camera" size={14} color="#FFF" />
            </View>
          )}
        </TouchableOpacity>
        <Text style={[eStyles.changePhotoText, { color: isDark ? '#10A37F' : '#007AFF' }]}>Change photo</Text>
      </View>

      {/* Name field */}
      <View style={eStyles.fieldGroup}>
        <Text style={[eStyles.fieldLabel, { color: labelColor }]}>NAME</Text>
        <View style={[eStyles.inputWrap, { backgroundColor: inputBg, borderColor: inputBorder }]}>
          <TextInput
            style={[eStyles.input, { color: inputColor }]}
            value={fullName}
            onChangeText={onChangeName}
            placeholder="Your name"
            placeholderTextColor={placeholderColor}
            autoCapitalize="words"
          />
        </View>
      </View>

      {/* Username field */}
      <View style={eStyles.fieldGroup}>
        <Text style={[eStyles.fieldLabel, { color: labelColor }]}>USERNAME</Text>
        <View style={[eStyles.inputWrap, { backgroundColor: inputBg, borderColor: inputBorder }]}>
          <Text style={[eStyles.atSign, { color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)' }]}>@</Text>
          <TextInput
            style={[eStyles.input, { color: inputColor, paddingLeft: 0 }]}
            value={username}
            onChangeText={onChangeUsername}
            placeholder="username"
            placeholderTextColor={placeholderColor}
            autoCapitalize="none"
          />
        </View>
      </View>

      <Text style={[eStyles.note, { color: noteColor }]}>
        Your name and username help people recognize you across the app.
      </Text>

      {/* Save */}
      <TouchableOpacity
        style={[eStyles.saveBtn, { backgroundColor: saveBg }]}
        onPress={onSave}
        disabled={saving || uploading}
        activeOpacity={0.85}
      >
        {saving ? (
          <ActivityIndicator color={saveText} />
        ) : (
          <Text style={[eStyles.saveBtnText, { color: saveText }]}>Save Changes</Text>
        )}
      </TouchableOpacity>

      {/* Cancel */}
      <TouchableOpacity style={eStyles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
        <Text style={[eStyles.cancelBtnText, { color: cancelColor }]}>Cancel</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const eStyles = StyleSheet.create({
  sheet: {
    flex: 1,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 24,
  },
  sheetBlur: { flex: 1, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 40 },
  handle: { width: 36, height: 5, borderRadius: 3, alignSelf: 'center', marginTop: 10, marginBottom: 20 },
  sheetTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 24 },
  photoRow: { alignItems: 'center', marginBottom: 28 },
  photoBtnWrap: { width: 96, height: 96, borderRadius: 48, position: 'relative', marginBottom: 10 },
  photo: { width: 96, height: 96, borderRadius: 48 },
  photoPlaceholder: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  photoInitial: { fontSize: 38, fontWeight: '700' },
  photoOverlay: { ...StyleSheet.absoluteFillObject, borderRadius: 48, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  cameraCircle: { position: 'absolute', bottom: 2, right: 2, width: 28, height: 28, borderRadius: 14, backgroundColor: '#10A37F', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.8)' },
  changePhotoText: { fontSize: 14, fontWeight: '600' },
  fieldGroup: { marginBottom: 16 },
  fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8, marginLeft: 4 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    minHeight: 52,
  },
  atSign: { fontSize: 16, fontWeight: '500', marginRight: 4 },
  input: { flex: 1, fontSize: 16, paddingVertical: 14 },
  note: { fontSize: 12, textAlign: 'center', lineHeight: 18, marginBottom: 24, marginTop: 8, paddingHorizontal: 8 },
  saveBtn: { borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 12 },
  saveBtnText: { fontSize: 17, fontWeight: '700' },
  cancelBtn: { alignItems: 'center', paddingVertical: 12 },
  cancelBtnText: { fontSize: 16, fontWeight: '500' },
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

  // Adaptive theme tokens
  const bgColor = isDark ? '#0A0A0A' : '#F2F2F7';
  const cardBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const textColor = isDark ? '#FFFFFF' : '#000000';
  const subColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';
  const borderCol = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
  const chevronColor = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)';
  const iconBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const iconColor = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)';
  const sectionLabelColor = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)';
  const signOutBorder = isDark ? 'rgba(255,59,48,0.25)' : 'rgba(255,59,48,0.3)';
  const editBtnBorder = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)';
  const editBtnBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';

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
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: borderCol,
      }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: editBtnBg, borderWidth: 1, borderColor: editBtnBorder, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="close" size={18} color={textColor} />
        </TouchableOpacity>
        <Text style={{ color: textColor, fontSize: 17, fontWeight: '700' }}>Profile</Text>
        <TouchableOpacity
          onPress={() => setEditVisible(true)}
          style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: editBtnBg, borderWidth: 1, borderColor: editBtnBorder }}
        >
          <Text style={{ color: isDark ? '#10A37F' : '#007AFF', fontSize: 14, fontWeight: '600' }}>Edit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

        {/* Hero profile section */}
        {Platform.OS === 'ios' ? (
          <View style={{ alignItems: 'center', paddingTop: 32, paddingBottom: 28, paddingHorizontal: 20, marginHorizontal: 16, marginTop: 20, marginBottom: 8, borderRadius: 24, overflow: 'hidden' }}>
            <BlurView intensity={isDark ? 50 : 35} tint={isDark ? 'dark' : 'light'} style={[StyleSheet.absoluteFill, { borderRadius: 24 }]} />
            <View style={[StyleSheet.absoluteFill, { borderRadius: 24, borderWidth: 1, borderColor: borderCol }]} />
            <ProfileHero
              profile={profile}
              initial={initial}
              isPlus={isPlus}
              textColor={textColor}
              subColor={subColor}
              editBtnBg={editBtnBg}
              editBtnBorder={editBtnBorder}
              onEdit={() => setEditVisible(true)}
            />
          </View>
        ) : (
          <View style={{ alignItems: 'center', paddingTop: 32, paddingBottom: 28, paddingHorizontal: 20, marginHorizontal: 16, marginTop: 20, marginBottom: 8, borderRadius: 24, backgroundColor: cardBg, borderWidth: 1, borderColor: borderCol }}>
            <ProfileHero
              profile={profile}
              initial={initial}
              isPlus={isPlus}
              textColor={textColor}
              subColor={subColor}
              editBtnBg={editBtnBg}
              editBtnBorder={editBtnBorder}
              onEdit={() => setEditVisible(true)}
            />
          </View>
        )}

        {/* Account section */}
        <Text style={{ color: sectionLabelColor, fontSize: 12, fontWeight: '700', paddingHorizontal: 20, marginBottom: 8, marginTop: 24, textTransform: 'uppercase', letterSpacing: 0.8 }}>Account</Text>
        <View style={{ marginHorizontal: 16, borderRadius: 20, overflow: 'hidden', backgroundColor: cardBg, borderWidth: 1, borderColor: borderCol, marginBottom: 24 }}>
          {[
            { label: 'Subscription', sub: isPlus ? 'Plus' : 'Free', icon: 'star-outline', iconColor: '#FFD700', onPress: () => router.push('/subscription') },
            { label: 'Personalization', sub: '', icon: 'person-outline', iconColor: '#5AC8FA', onPress: () => router.push('/personalization') },
            { label: 'Notifications', sub: '', icon: 'notifications-outline', iconColor: '#FF9F0A', onPress: () => router.push('/notifications') },
            { label: 'Data controls', sub: '', icon: 'shield-outline', iconColor: '#30D158', onPress: () => router.push('/data-controls') },
            { label: 'Parental controls', sub: '', icon: 'people-outline', iconColor: '#FF6B6B', onPress: () => router.push('/parental-controls') },
            { label: 'Archived chats', sub: '', icon: 'archive-outline', iconColor: '#8E8E93', onPress: () => router.push('/archived-chats') },
            { label: 'Security', sub: '', icon: 'lock-closed-outline', iconColor: '#10A37F', onPress: () => router.push('/security') },
          ].map((item, i, arr) => (
            <TouchableOpacity
              key={item.label}
              style={{
                flexDirection: 'row', alignItems: 'center', padding: 14,
                borderBottomWidth: i < arr.length - 1 ? StyleSheet.hairlineWidth : 0,
                borderBottomColor: borderCol,
              }}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: item.iconColor + '22', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Ionicons name={item.icon as any} size={18} color={item.iconColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: textColor, fontSize: 16, fontWeight: '500' }}>{item.label}</Text>
                {item.sub ? <Text style={{ color: subColor, fontSize: 13, marginTop: 1 }}>{item.sub}</Text> : null}
              </View>
              <Ionicons name="chevron-forward" size={16} color={chevronColor} />
            </TouchableOpacity>
          ))}
        </View>

        {/* App section */}
        <Text style={{ color: sectionLabelColor, fontSize: 12, fontWeight: '700', paddingHorizontal: 20, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>App</Text>
        <View style={{ marginHorizontal: 16, borderRadius: 20, overflow: 'hidden', backgroundColor: cardBg, borderWidth: 1, borderColor: borderCol, marginBottom: 24 }}>
          {[
            { label: 'Settings', icon: 'settings-outline', iconColor: '#8E8E93', onPress: () => router.push('/settings') },
            { label: 'About', icon: 'information-circle-outline', iconColor: '#5AC8FA', onPress: () => router.push('/about') },
            { label: 'Report a bug', icon: 'bug-outline', iconColor: '#FF9F0A', onPress: () => router.push('/bugreport') },
          ].map((item, i, arr) => (
            <TouchableOpacity
              key={item.label}
              style={{
                flexDirection: 'row', alignItems: 'center', padding: 14,
                borderBottomWidth: i < arr.length - 1 ? StyleSheet.hairlineWidth : 0,
                borderBottomColor: borderCol,
              }}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: item.iconColor + '22', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Ionicons name={item.icon as any} size={18} color={item.iconColor} />
              </View>
              <Text style={{ flex: 1, color: textColor, fontSize: 16, fontWeight: '500' }}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={chevronColor} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Sign out */}
        <View style={{ marginHorizontal: 16 }}>
          <TouchableOpacity
            style={{ backgroundColor: cardBg, borderRadius: 20, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: signOutBorder }}
            activeOpacity={0.8}
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
        isDark={isDark}
        onClose={() => setEditVisible(false)}
        onSaved={fetchProfile}
      />
    </View>
  );
}

// ── Profile hero sub-component ──
function ProfileHero({ profile, initial, isPlus, textColor, subColor, editBtnBg, editBtnBorder, onEdit }: {
  profile: UserProfile | null;
  initial: string;
  isPlus: boolean | undefined;
  textColor: string;
  subColor: string;
  editBtnBg: string;
  editBtnBorder: string;
  onEdit: () => void;
}) {
  return (
    <>
      {/* Avatar */}
      <View style={{ position: 'relative', marginBottom: 16 }}>
        {profile?.profile_photo_url ? (
          <Image source={{ uri: profile.profile_photo_url }} style={{ width: 96, height: 96, borderRadius: 48 }} contentFit="cover" />
        ) : (
          <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: '#10A37F', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#FFF', fontSize: 38, fontWeight: '700' }}>{initial}</Text>
          </View>
        )}
        {isPlus && (
          <View style={{ position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderRadius: 15, backgroundColor: '#FF3B30', alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.8)' }}>
            <Ionicons name="checkmark" size={15} color="#FFF" />
          </View>
        )}
      </View>

      {/* Name */}
      <Text style={{ color: textColor, fontSize: 22, fontWeight: '700', marginBottom: 4, textAlign: 'center' }}>
        {profile?.full_name || 'User'}
      </Text>

      {/* Username */}
      {profile?.username ? (
        <Text style={{ color: subColor, fontSize: 15, marginBottom: 6, textAlign: 'center' }}>
          @{profile.username}
        </Text>
      ) : null}

      {/* Plus badge */}
      {isPlus && (
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,59,48,0.12)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, gap: 5, marginTop: 4, marginBottom: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF3B30' }} />
          <Text style={{ color: '#FF3B30', fontSize: 13, fontWeight: '700' }}>
            {profile?.is_lifetime_member ? 'Lifetime Member' : 'Plus'}
          </Text>
        </View>
      )}

      {/* Edit profile CTA */}
      <TouchableOpacity
        style={{ marginTop: 16, borderWidth: 1, borderColor: editBtnBorder, borderRadius: 22, paddingHorizontal: 22, paddingVertical: 9, backgroundColor: editBtnBg }}
        onPress={onEdit}
        activeOpacity={0.7}
      >
        <Text style={{ color: textColor, fontSize: 14, fontWeight: '600' }}>Edit profile</Text>
      </TouchableOpacity>
    </>
  );
}

