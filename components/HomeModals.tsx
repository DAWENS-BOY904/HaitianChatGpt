/**
 * HomeModals.tsx — Extracted inline modal components from home.tsx
 * to reduce file size and allow PhotoLimitModal to be added.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  Platform,
  Switch,
  Share,
  Animated,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../hooks/useTheme';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GroupMember {
  id: string;
  username: string;
  profile_photo_url?: string;
  accent_color?: string;
}

// ── RenameModal ───────────────────────────────────────────────────────────────

export function RenameModal({ visible, currentTitle, onConfirm, onCancel }: {
  visible: boolean;
  currentTitle: string;
  onConfirm: (title: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(currentTitle);
  const { isDark } = useTheme();
  const textC = isDark ? '#FFF' : '#000';
  const inputBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';
  const cardBg = isDark ? 'rgba(30,30,34,0.82)' : 'rgba(255,255,255,0.82)';
  const divC = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)';

  useEffect(() => {
    if (visible) setText(currentTitle);
  }, [visible, currentTitle]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={renameStyles.backdrop}>
        <BlurView intensity={isDark ? 55 : 75} tint={isDark ? 'dark' : 'light'} style={renameStyles.blurBg}experimentalBlurMethod="dimezisBlurView">
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onCancel} />
        </BlurView>
        <Animated.View style={renameStyles.card}>
          <BlurView intensity={isDark ? 40 : 60} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} experimentalBlurMethod="dimezisBlurView" />
          <View style={[renameStyles.cardInner, { backgroundColor: cardBg }]}>
            <Text style={[renameStyles.title, { color: textC }]}>Rename chat</Text>
            <TextInput
              style={[renameStyles.input, { backgroundColor: inputBg, color: textC, borderColor: divC }]}
              value={text}
              onChangeText={setText}
              autoFocus
              selectTextOnFocus
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)'}
            />
            <View style={[renameStyles.btnRow, { borderTopColor: divC }]}>
              <TouchableOpacity style={renameStyles.btn} onPress={onCancel}>
                <Text style={[renameStyles.btnLabel, { color: textC }]}>Cancel</Text>
              </TouchableOpacity>
              <View style={[renameStyles.btnDivider, { backgroundColor: divC }]} />
              <TouchableOpacity style={renameStyles.btn} onPress={() => onConfirm(text.trim())}>
                <Text style={[renameStyles.btnLabel, { color: textC, fontWeight: '600' }]}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const renameStyles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  blurBg: { ...StyleSheet.absoluteFillObject },
  card: { position: 'absolute', width: '80%', borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 20 },
  cardInner: { padding: 20, alignItems: 'center', borderRadius: 20 },
  title: { fontSize: 17, fontWeight: '600', marginBottom: 16 },
  input: { width: '100%', borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 0, borderWidth: 1 },
  btnRow: { flexDirection: 'row', width: '100%', borderTopWidth: StyleSheet.hairlineWidth, marginTop: 16, paddingTop: 4 },
  btn: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  btnLabel: { fontSize: 17 },
  btnDivider: { width: 1 },
});

// ── ArchiveConfirmModal ───────────────────────────────────────────────────────

export function ArchiveConfirmModal({ visible, onConfirm, onCancel }: {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { isDark } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={archStyles.backdrop}>
        <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} experimentalBlurMethod="dimezisBlurView" />
        <View style={archStyles.card}>
          <BlurView intensity={95} tint="dark" style={archStyles.blurCard}experimentalBlurMethod="dimezisBlurView">
            <Text style={archStyles.title}>Archive Chat</Text>
            <Text style={archStyles.body}>
              {'Are you sure you want to archive this chat?\nYou can view archived chats in Settings'}
            </Text>
            <TouchableOpacity style={archStyles.archBtn} onPress={onConfirm}>
              <Text style={archStyles.archBtnText}>Archive</Text>
            </TouchableOpacity>
          </BlurView>
        </View>
      </View>
    </Modal>
  );
}

const archStyles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { width: '80%', borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 20 },
  blurCard: { padding: 24, alignItems: 'center' },
  title: { color: '#FFF', fontSize: 20, fontWeight: '700', marginBottom: 12 },
  body: { color: 'rgba(255,255,255,0.6)', fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  archBtn: { width: '100%', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.08)' },
  archBtnText: { color: '#FF453A', fontSize: 17, fontWeight: '600' },
});

// ── ProfileEditModal ──────────────────────────────────────────────────────────

export function ProfileEditModal({ visible, user, profilePhotoUrl, onClose, onSave, isDark }: {
  visible: boolean;
  user: any;
  profilePhotoUrl: string | null;
  onClose: () => void;
  onSave: (name: string, username: string, photo?: string) => void;
  isDark: boolean;
}) {
  const [name, setName] = useState(user?.username || '');
  const [username, setUsername] = useState(user?.email?.split('@')[0] || '');
  const [photoUri, setPhotoUri] = useState<string | null>(profilePhotoUrl);

  useEffect(() => {
    if (visible) {
      setName(user?.username || user?.email?.split('@')[0] || '');
      setUsername(user?.email?.split('@')[0] || '');
      setPhotoUri(profilePhotoUrl);
    }
  }, [visible]);

  const pickPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        allowsEditing: true,
        aspect: [1, 1],
      });
      if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
    } catch (_e) {}
  };

  const bg = isDark ? 'rgba(28,28,30,0.78)' : 'rgba(255,255,255,0.78)';
  const textC = isDark ? '#FFFFFF' : '#000000';
  const inputBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  const subC = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <BlurView intensity={isDark ? 55 : 70} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} experimentalBlurMethod="dimezisBlurView" />
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={{ backgroundColor: bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28, paddingBottom: 40, overflow: 'hidden' }}>
          <BlurView intensity={isDark ? 35 : 50} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} experimentalBlurMethod="dimezisBlurView" />
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <TouchableOpacity onPress={pickPhoto} activeOpacity={0.8} style={{ position: 'relative' }}>
              {photoUri ? (
                <ExpoImage source={{ uri: photoUri }} style={{ width: 90, height: 90, borderRadius: 45 }} contentFit="cover" />
              ) : (
                <View style={{ width: 90, height: 90, borderRadius: 45, backgroundColor: isDark ? '#3A3A3C' : '#E5E5EA', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="person" size={40} color={isDark ? '#666' : '#999'} />
                </View>
              )}
              <View style={{ position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: isDark ? '#3A3A3C' : '#E5E5EA', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: isDark ? '#1C1C1E' : '#FFF' }}>
                <Ionicons name="camera" size={14} color={textC} />
              </View>
            </TouchableOpacity>
          </View>
          <Text style={{ color: subC, fontSize: 13, fontWeight: '600', marginBottom: 6 }}>Name</Text>
          <View style={{ backgroundColor: inputBg, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, marginBottom: 16 }}>
            <TextInput style={{ color: textC, fontSize: 16 }} value={name} onChangeText={setName} placeholderTextColor={subC} />
          </View>
          <Text style={{ color: subC, fontSize: 13, fontWeight: '600', marginBottom: 6 }}>Username</Text>
          <View style={{ backgroundColor: inputBg, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, marginBottom: 20 }}>
            <TextInput style={{ color: textC, fontSize: 16 }} value={username} onChangeText={setUsername} placeholderTextColor={subC} autoCapitalize="none" />
          </View>
          <Text style={{ color: subC, fontSize: 12, textAlign: 'center', lineHeight: 18, marginBottom: 24 }}>
            {'Your profile helps people recognize you.'}
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: textC, borderRadius: 30, paddingVertical: 15, alignItems: 'center', marginBottom: 12 }}
            onPress={() => { onSave(name, username, photoUri || undefined); onClose(); }}
          >
            <Text style={{ color: isDark ? '#000' : '#FFF', fontSize: 17, fontWeight: '700' }}>Save profile</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={{ alignItems: 'center', paddingVertical: 10 }}>
            <Text style={{ color: textC, fontSize: 16 }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── GroupStartModal ───────────────────────────────────────────────────────────

export function GroupStartModal({ visible, user, profilePhotoUrl, onClose, onStartGroup, isDark, onSetupProfile }: {
  visible: boolean;
  user: any;
  profilePhotoUrl: string | null;
  onClose: () => void;
  onStartGroup: () => void;
  isDark?: boolean;
  onSetupProfile?: () => void;
}) {
  const bg = isDark ? 'rgba(28,28,30,0.80)' : 'rgba(255,255,255,0.80)';
  const textC = isDark ? '#FFFFFF' : '#000000';
  const subC = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)';
  const profileRowBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <BlurView intensity={isDark ? 65 : 75} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} experimentalBlurMethod="dimezisBlurView" />
        {Platform.OS !== 'ios' ? <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.35)' }]} /> : null}
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={{ backgroundColor: bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 16, paddingBottom: 40, paddingHorizontal: 20, minHeight: '55%', overflow: 'hidden' }}>
          <BlurView intensity={isDark ? 40 : 55} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} experimentalBlurMethod="dimezisBlurView" />
          <TouchableOpacity
            style={{ position: 'absolute', top: 16, right: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.07)', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}
            onPress={onClose}
          >
            <Ionicons name="close" size={18} color={textC} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 40 }}>
            <Text style={{ color: textC, fontSize: 26, fontWeight: '700', textAlign: 'center', marginBottom: 12 }}>
              Use Dawinix together
            </Text>
            <Text style={{ color: subC, fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 36 }}>
              Add people to your chats to plan, share ideas, and get creative.
            </Text>
            <TouchableOpacity
              style={{ backgroundColor: textC, borderRadius: 30, paddingHorizontal: 48, paddingVertical: 17, width: '100%', alignItems: 'center' }}
              onPress={() => { onClose(); onStartGroup(); }}
            >
              <Text style={{ color: isDark ? '#000' : '#FFF', fontSize: 17, fontWeight: '700' }}>Start group chat</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: profileRowBg, borderRadius: 18, padding: 14, gap: 12 }}
            onPress={() => { onClose(); setTimeout(() => onSetupProfile?.(), 200); }}
            activeOpacity={0.75}
          >
            {profilePhotoUrl ? (
              <ExpoImage source={{ uri: profilePhotoUrl }} style={{ width: 44, height: 44, borderRadius: 22 }} contentFit="cover" />
            ) : (
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: isDark ? '#3A3A3C' : '#E5E5EA', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="person" size={22} color={isDark ? '#888' : '#999'} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ color: textC, fontSize: 16, fontWeight: '600' }}>Set up your profile</Text>
              <Text style={{ color: subC, fontSize: 13, marginTop: 2 }}>Choose a username and photo</Text>
            </View>
            <Ionicons name="pencil-outline" size={20} color={subC} />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── PeopleModal ───────────────────────────────────────────────────────────────

export function PeopleModal({ visible, onClose, groupName, userName, profilePhotoUrl, isDark, isAdmin }: {
  visible: boolean;
  onClose: () => void;
  groupName: string;
  userName: string;
  profilePhotoUrl: string | null;
  isDark: boolean;
  isAdmin: boolean;
}) {
  const textC = isDark ? '#FFF' : '#000';
  const subC = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <BlurView intensity={isDark ? 60 : 70} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} experimentalBlurMethod="dimezisBlurView" />
        {Platform.OS !== 'ios' ? <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.30)' }]} /> : null}
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={{ borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', minHeight: '55%' }}>
          <View style={{ backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7', paddingBottom: 40, minHeight: '100%' }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(128,128,128,0.4)', alignSelf: 'center', marginTop: 10, marginBottom: 16 }} />
            <Text style={{ color: textC, fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 16 }}>People</Text>
            <View style={{ paddingHorizontal: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 }}>
                {profilePhotoUrl ? (
                  <ExpoImage source={{ uri: profilePhotoUrl }} style={{ width: 44, height: 44, borderRadius: 22 }} contentFit="cover" />
                ) : (
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: isDark ? '#3A3A3C' : '#E5E5EA', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="person" size={22} color={isDark ? '#888' : '#999'} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: textC, fontSize: 16, fontWeight: '600' }}>{userName}</Text>
                  <Text style={{ color: subC, fontSize: 13, marginTop: 2 }}>
                    {userName.toLowerCase().replace(/\s/g, '')}
                    {' \u00B7 you'}
                    {isAdmin ? ' \u00B7 admin' : ''}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── RenameGroupBox ────────────────────────────────────────────────────────────

export function RenameGroupBox({ isDark, currentName, onSave, onCancel }: {
  isDark: boolean;
  currentName: string;
  onSave: (n: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(currentName);

  useEffect(() => { setText(currentName); }, [currentName]);

  const textC = isDark ? '#FFF' : '#000';
  const inputBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';

  return (
    <View style={{ width: '82%', borderRadius: 22, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.35, shadowRadius: 22, elevation: 22 }}>
      <BlurView intensity={isDark ? 50 : 70} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} experimentalBlurMethod="dimezisBlurView" />
      <View style={{ backgroundColor: isDark ? 'rgba(44,44,46,0.72)' : 'rgba(255,255,255,0.72)', padding: 22, borderRadius: 22 }}>
        <Text style={{ color: textC, fontSize: 18, fontWeight: '700', marginBottom: 16 }}>Rename group</Text>
        <View style={{ backgroundColor: inputBg, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16 }}>
          <TextInput style={{ color: textC, fontSize: 16 }} value={text} onChangeText={setText} autoFocus selectTextOnFocus />
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: inputBg, borderRadius: 14, paddingVertical: 13, alignItems: 'center' }} onPress={onCancel}>
            <Text style={{ color: textC, fontSize: 16, fontWeight: '600' }}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ flex: 1, backgroundColor: inputBg, borderRadius: 14, paddingVertical: 13, alignItems: 'center' }} onPress={() => onSave(text.trim())}>
            <Text style={{ color: textC, fontSize: 16, fontWeight: '600' }}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ── CustomizeAIModal ──────────────────────────────────────────────────────────

export function CustomizeAIModal({ visible, onClose, onSave, initialInstructions, initialRespondAuto }: {
  visible: boolean;
  onClose: () => void;
  onSave: (instructions: string, respondAuto: boolean) => void;
  initialInstructions?: string;
  initialRespondAuto?: boolean;
}) {
  const [instructions, setInstructions] = useState(initialInstructions || '');
  const [respondAuto, setRespondAuto] = useState(initialRespondAuto !== false);

  useEffect(() => {
    if (visible) {
      setInstructions(initialInstructions || '');
      setRespondAuto(initialRespondAuto !== false);
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={customStyles.sheet}>
          <BlurView intensity={95} tint="dark" style={customStyles.sheetBlur}experimentalBlurMethod="dimezisBlurView">
            <View style={customStyles.handle} />
            <Text style={customStyles.title}>Customize Dawinix</Text>
            <Text style={customStyles.sectionLabel}>Custom instructions</Text>
            <TextInput
              style={customStyles.textArea}
              value={instructions}
              onChangeText={setInstructions}
              placeholder="Get tailored responses by adding details about your group."
              placeholderTextColor="rgba(255,255,255,0.35)"
              multiline
              numberOfLines={4}
            />
            <View style={customStyles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={customStyles.toggleLabel}>Respond automatically</Text>
                <Text style={customStyles.toggleSub}>Answers automatically</Text>
              </View>
              <Switch
                value={respondAuto}
                onValueChange={setRespondAuto}
                trackColor={{ true: '#34C759', false: 'rgba(255,255,255,0.2)' }}
                thumbColor="#FFF"
              />
            </View>
            <Text style={customStyles.note}>
              Group chat custom instructions are separate from your personal Dawinix instructions.
            </Text>
            <TouchableOpacity style={customStyles.saveBtn} onPress={() => { onSave(instructions, respondAuto); onClose(); }}>
              <Text style={customStyles.saveBtnText}>Save</Text>
            </TouchableOpacity>
          </BlurView>
        </View>
      </View>
    </Modal>
  );
}

const customStyles = StyleSheet.create({
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
  sheetBlur: { padding: 24, paddingTop: 12 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', alignSelf: 'center', marginBottom: 16 },
  title: { color: '#FFF', fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 20 },
  sectionLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 14, marginBottom: 8 },
  textArea: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 14, color: '#FFF', fontSize: 15, minHeight: 100, textAlignVertical: 'top', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 16 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  toggleLabel: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  toggleSub: { color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 2 },
  note: { color: 'rgba(255,255,255,0.4)', fontSize: 12, textAlign: 'center', marginBottom: 20, lineHeight: 18 },
  saveBtn: { backgroundColor: '#FFF', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { color: '#000', fontSize: 17, fontWeight: '600' },
});

// ── InviteLinkModal ───────────────────────────────────────────────────────────

export function InviteLinkModal({ visible, onClose, isPlus, isDark }: {
  visible: boolean;
  onClose: () => void;
  isPlus: boolean;
  isDark?: boolean;
}) {
  const token = Math.random().toString(36).substring(2, 15);
  const id = Math.random().toString(36).substring(2, 14);
  const link = `https://dawinix.com/gg/v/${id}?token=${token}`;
  const textC = isDark !== false ? '#FFF' : '#000';

  const handleShare = async () => {
    try {
      await Share.share({ message: `Join my Dawinix group chat!\n\n${link}`, url: link });
    } catch (_e) {}
    onClose();
  };

  const handleCopy = () => {
    Clipboard.setStringAsync(link);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
      <View style={{ borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' }}>
        <BlurView
          intensity={isDark !== false ? 95 : 80}
          tint={isDark !== false ? 'dark' : 'light'}
          style={{ padding: 24 }}
        experimentalBlurMethod="dimezisBlurView">
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: isDark !== false ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)', alignSelf: 'center', marginBottom: 16 }} />
          <Text style={{ color: textC, fontSize: 18, fontWeight: '700', marginBottom: 6 }}>Group link</Text>
          <Text style={{ color: '#007AFF', fontSize: 13, marginBottom: 20 }} numberOfLines={1}>{link}</Text>
          {[
            { icon: 'copy-outline', label: 'Copy link', onPress: handleCopy },
            { icon: 'share-outline', label: 'Share link', onPress: handleShare },
          ].map((item, i) => (
            <TouchableOpacity
              key={item.label}
              style={{
                flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 16,
                borderTopWidth: i > 0 ? StyleSheet.hairlineWidth : 0,
                borderTopColor: isDark !== false ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              }}
              onPress={item.onPress}
            >
              <Ionicons name={item.icon as any} size={22} color={textC} />
              <Text style={{ color: textC, fontSize: 17 }}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </BlurView>
      </View>
    </Modal>
  );
}

// ── GroupMemberProfileContent ─────────────────────────────────────────────────

export function GroupMemberProfileContent({ member, isOwner, isAdmin, isDark, isSilenced, onClose, onRemove, onSilence, onReport, colors }: {
  member: GroupMember | null;
  isOwner: boolean;
  isAdmin: boolean;
  isDark: boolean;
  isSilenced: boolean;
  onClose: () => void;
  onRemove: (id: string) => void;
  onSilence: (id: string) => void;
  onReport: () => void;
  colors: any;
}) {
  if (!member) return null;
  const textC = isDark ? '#FFF' : '#000';
  const subC = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';
  const divC = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const initials = (member.username || '?').slice(0, 2).toUpperCase();
  const canManage = isOwner || isAdmin;

  return (
    <View>
      <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)', alignSelf: 'center', marginBottom: 24 }} />
      <View style={{ alignItems: 'center', marginBottom: 20 }}>
        {member.profile_photo_url ? (
          <ExpoImage source={{ uri: member.profile_photo_url }} style={{ width: 88, height: 88, borderRadius: 44 }} contentFit="cover" />
        ) : (
          <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: member.accent_color || '#555', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#FFF', fontSize: 28, fontWeight: '700' }}>{initials}</Text>
          </View>
        )}
        <Text style={{ color: textC, fontSize: 22, fontWeight: '700', marginTop: 12, textAlign: 'center' }}>{member.username}</Text>
        <Text style={{ color: subC, fontSize: 14, marginTop: 4 }}>@{member.username.toLowerCase().replace(/\s/g, '')}</Text>
      </View>
      <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: divC }}>
        {canManage ? (
          <>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: divC }}
              onPress={() => onRemove(member.id)}
            >
              <Ionicons name="exit-outline" size={22} color="#FF453A" />
              <Text style={{ color: '#FF453A', fontSize: 17, fontWeight: '500' }}>Remove from group</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: divC }}
              onPress={() => onSilence(member.id)}
            >
              <Ionicons name={isSilenced ? 'volume-high-outline' : 'volume-mute-outline'} size={22} color="#FF9F0A" />
              <Text style={{ color: '#FF9F0A', fontSize: 17, fontWeight: '500' }}>
                {isSilenced ? 'Unsilence user' : 'Silence user'}
              </Text>
            </TouchableOpacity>
          </>
        ) : null}
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 14 }} onPress={onReport}>
          <Ionicons name="flag-outline" size={22} color="#FF453A" />
          <Text style={{ color: '#FF453A', fontSize: 17, fontWeight: '500' }}>Report</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
