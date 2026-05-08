import React, { useState, useRef, useEffect, useCallback, useMemo, Component, memo } from 'react';
import { Image as ExpoImage } from 'expo-image';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  TouchableWithoutFeedback,
  Keyboard,
  StyleSheet, 
  FlatList, 
  KeyboardAvoidingView, 
  Platform, 
  StatusBar, 
  ActivityIndicator,
  Alert,
  Linking,
  AppState,
  Image,
  Share,
  Vibration,
  Dimensions,
  Animated,
  Easing,
  Modal,
  ScrollView,
  Switch,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useConversation } from '../hooks/useConversation';
import { useSettings } from '../hooks/useSettings';
import { useGuestLimits } from '../hooks/useGuestLimits';
import { useAlert, useAuth } from '@/template';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSubscription } from '../hooks/useSubscription';
import { MenuModal } from '../components/MenuModal';
import { MessageLimitModal } from '../components/MessageLimitModal';
import { ToolsModal } from '../components/ToolsModal';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { QuizModal, QuizView, QuizQuestion, QuizHistoryEntry } from '../components/QuizModal';
import { PresetsModal, loadBehaviorPresets } from '../components/PresetsModal';
import { MessageActionsModal } from '../components/MessageActionsModal';
import { StreamingText } from '../components/StreamingText';
import { ConversationMenuModal } from '../components/ConversationMenuModal';
import { MessageItem } from '../components/MessageItem';
import { ThinkingIndicator } from '../components/ThinkingIndicator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Accelerometer } from 'expo-sensors';
import { Audio } from 'expo-av';
import { useFocusEffect } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import * as FileSystem from 'expo-file-system';
import { SideMenu } from '../components/SideMenu';
import { ChatHistoryModal } from '../components/ChatHistoryModal';
import { ImageSearchResults } from '../components/ImageSearchResults';
import { AIMode } from '../components/AIModeSelectorModal';
import { CalculatorModal, CalculatorCard, detectMathExpression } from '../components/CalculatorModal';
import { SpotifyMusicCard, SpotifyTrack } from '../components/SpotifyMusicCard';
import { ConnectedAppsModal, ConnectedApp } from '../components/ConnectedAppsModal';

// Gesture handler — loaded conditionally to avoid native crash when reanimated/gesture-handler is not linked
const noopGesture = {
  activeOffsetX: () => noopGesture,
  failOffsetY: () => noopGesture,
  minDistance: () => noopGesture,
  onEnd: () => noopGesture,
};
let GestureHandlerRootView: any = ({ children, style }: any) => <View style={[{ flex: 1 }, style]}>{children}</View>;
let GestureDetector: any = ({ children }: any) => <>{children}</>;
let Gesture: any = { Pan: () => noopGesture };
let runOnJS: any = (fn: any) => fn;
try {
  const gh = require('react-native-gesture-handler');
  const ra = require('react-native-reanimated');
  GestureHandlerRootView = gh.GestureHandlerRootView;
  GestureDetector = gh.GestureDetector;
  Gesture = gh.Gesture;
  runOnJS = ra.runOnJS;
} catch (_e) {}
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Deep Researchs Progress Card ──────────────────────────────────────────────
const DeepResearchCard = memo(function DeepResearchCard({ step, label, done, colors }: { step: number; label: string; done: boolean; colors: any }) {
  const pulse = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    if (!done) {
      const anim = Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]));
      anim.start();
      return () => anim.stop();
    } else { pulse.setValue(1); }
  }, [done]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 14, gap: 10 }}>
      {done
        ? <Ionicons name="checkmark-circle" size={20} color="#34C759" />
        : <Animated.View style={{ opacity: pulse }}><Ionicons name="ellipse" size={10} color="#5AC8FA" /></Animated.View>}
      <Text style={{ color: colors.text, fontSize: 14, flex: 1 }}>{label}</Text>
    </View>
  );
});

function isValidBase64(str: string): boolean {
  try {
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(str)) return false;
    const padded = str.length % 4 === 0 ? str : str + '='.repeat(4 - (str.length % 4));
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    for (let i = 0; i < padded.length; i++) {
      if (chars.indexOf(padded[i]) === -1 && padded[i] !== '=') return false;
    }
    return true;
  } catch (_e) { return false; }
}

const INPUT_PERSIST_KEY = 'home_input_draft';
const CONV_PERSIST_KEY = 'home_current_conv_id';
const INPUT_PERSIST_TTL = 8 * 60 * 1000;
async function saveDraft(text: string) {
  try {
    if (!text.trim()) { await AsyncStorage.removeItem(INPUT_PERSIST_KEY); return; }
    await AsyncStorage.setItem(INPUT_PERSIST_KEY, JSON.stringify({ text, ts: Date.now() }));
  } catch (_e) {}
}
async function loadDraft(): Promise<string> {
  try {
    const raw = await AsyncStorage.getItem(INPUT_PERSIST_KEY);
    if (!raw) return '';
    const { text, ts } = JSON.parse(raw);
    if (Date.now() - ts > INPUT_PERSIST_TTL) { await AsyncStorage.removeItem(INPUT_PERSIST_KEY); return ''; }
    return text || '';
  } catch (_e) { return ''; }
}
async function clearDraft() {
  try { await AsyncStorage.removeItem(INPUT_PERSIST_KEY); } catch (_e) {}
}

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

async function registerForPushNotifications(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return null;
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;
    const tokenData = await Notifications.getExpoPushTokenAsync();
    return tokenData.data;
  } catch (e) { return null; }
}

async function sendLocalNotification(title: string, body: string) {
  try {
    if (Platform.OS === 'web') return;
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true, badge: 1 },
      trigger: null,
    });
  } catch (_e) {}
}

type RecordingState = 'idle' | 'recording' | 'processing';

interface MediaFile {
  type: 'image' | 'document' | 'video';
  uri: string;
  base64?: string;
  name?: string;
  size?: number;
  mimeType?: string;
}

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  createdAt: string;
  imageUrl?: string;
  image_url?: string;
  file_url?: string;
  isEdited?: boolean;
  isDeleted?: boolean;
  reactions?: string[];
}

interface GroupMember {
  id: string;
  username: string;
  profile_photo_url?: string;
  accent_color?: string;
}

const MAX_RECORDING_DURATION = 60;
const SHAKE_THRESHOLD = 3.0;
const SHAKE_COOLDOWN = 1000;

function MentionPopup({ members, onSelect, onClose }: {
  members: GroupMember[];
  onSelect: (member: GroupMember) => void;
  onClose: () => void;
}) {
  const { colors, isDark } = useTheme();
  if (members.length === 0) return null;
  return (
    <View style={[
      mentionStyles.container,
      { backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF', borderColor: isDark ? '#3A3A3C' : '#E0E0E5' }
    ]}>
      <ScrollView keyboardShouldPersistTaps="always" showsVerticalScrollIndicator={false} style={{ maxHeight: 220 }}>
        {members.map((m, i) => (
          <TouchableOpacity
            key={m.id}
            style={[
              mentionStyles.row,
              i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: isDark ? '#3A3A3C' : '#E5E5EA' }
            ]}
            onPress={() => { onSelect(m); onClose(); }}
            activeOpacity={0.7}
          >
            {m.profile_photo_url ? (
              <Image source={{ uri: m.profile_photo_url }} style={mentionStyles.avatar} />
            ) : (
              <View style={[mentionStyles.avatarFallback, { backgroundColor: m.accent_color || '#888' }]}>
                <Text style={mentionStyles.avatarLetter}>{(m.username?.[0] || '?').toUpperCase()}</Text>
              </View>
            )}
            <Text style={[mentionStyles.name, { color: colors.text }]}>@{m.username}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const headerIconGroupStyles = StyleSheet.create({
  glassWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  iconBtn: { width: 38, height: 36, alignItems: 'center', justifyContent: 'center' },
  divider: { width: StyleSheet.hairlineWidth, height: 18 },
});

const mentionStyles = StyleSheet.create({
  container: { position: 'absolute', bottom: 70, left: 60, right: 12, borderRadius: 14, borderWidth: 1, overflow: 'hidden', zIndex: 100, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.18, shadowRadius: 12, elevation: 12 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  avatar: { width: 34, height: 34, borderRadius: 17 },
  avatarFallback: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  name: { fontSize: 15, fontWeight: '500' },
});

const SUPPORTED_AI_MODELS = {
  gemini: 'Gemini',
  openai: 'OpenAI',
  claude: 'Claude',
  llama: 'Llama',
  'gemini-2.0-flash-exp': 'Gemini 2.0 Flash',
  'onspace-ai': 'OnSpace AI'
} as const;

type AIModelKey = keyof typeof SUPPORTED_AI_MODELS;

const ctxStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' },
  menuWrap: { width: 260, borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 20 },
  blurBox: { borderRadius: 16, overflow: 'hidden' },
  titleRow: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.12)' },
  titleText: { fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', fontWeight: '500' },
  menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  menuItemBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.1)' },
  menuItemLabel: { fontSize: 17, color: 'rgba(255,255,255,0.92)', fontWeight: '400' },
  destructiveLabel: { color: '#FF453A' },
});

function RenameModal({ visible, currentTitle, onConfirm, onCancel }: {
  visible: boolean; currentTitle: string; onConfirm: (title: string) => void; onCancel: () => void;
}) {
  const [text, setText] = useState(currentTitle);
  const { isDark } = useTheme();
  const textC = isDark ? '#FFF' : '#000';
  const inputBg = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)';
  const cardBg = isDark ? 'rgba(30,30,34,0.98)' : 'rgba(255,255,255,0.98)';
  const divC = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)';
  useEffect(() => { if (visible) setText(currentTitle); }, [visible, currentTitle]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={renameStyles.backdrop}>
        <BlurView intensity={60} tint={isDark ? 'dark' : 'light'} style={renameStyles.blurBg}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onCancel} />
        </BlurView>
        <Animated.View style={renameStyles.card}>
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

function ArchiveConfirmModal({ visible, onConfirm, onCancel }: { visible: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={archStyles.backdrop}>
        <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={archStyles.card}>
          <BlurView intensity={90} tint="dark" style={archStyles.blurCard}>
            <Text style={archStyles.title}>Archive Chat</Text>
            <Text style={archStyles.body}>Are you sure you want to archive this chat?{'\n'}You can view archived chats in Settings</Text>
            <TouchableOpacity style={archStyles.archBtn} onPress={onConfirm}><Text style={archStyles.archBtnText}>Archive</Text></TouchableOpacity>
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
  archBtn: { width: '100%', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  archBtnText: { color: '#FF453A', fontSize: 17, fontWeight: '600' },
});

function ProfileEditModal({ visible, user, profilePhotoUrl, onClose, onSave, isDark }: {
  visible: boolean; user: any; profilePhotoUrl: string | null; onClose: () => void;
  onSave: (name: string, username: string, photo?: string) => void; isDark: boolean;
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
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85, allowsEditing: true, aspect: [1, 1] });
      if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
    } catch (_e) {}
  };
  const bg = isDark ? 'rgba(28,28,30,0.98)' : 'rgba(255,255,255,0.98)';
  const textC = isDark ? '#FFFFFF' : '#000000';
  const inputBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';
  const subC = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
        {Platform.OS === 'ios' ? <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} /> : null}
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={{ backgroundColor: bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28, paddingBottom: 40 }}>
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
          <Text style={{ color: subC, fontSize: 12, textAlign: 'center', lineHeight: 18, marginBottom: 24 }}>{'Your profile helps people recognize you.'}</Text>
          <TouchableOpacity style={{ backgroundColor: textC, borderRadius: 30, paddingVertical: 15, alignItems: 'center', marginBottom: 12 }} onPress={() => { onSave(name, username, photoUri || undefined); onClose(); }}>
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

function GroupStartModal({ visible, user, profilePhotoUrl, onClose, onStartGroup, isDark, onSetupProfile }: {
  visible: boolean; user: any; profilePhotoUrl: string | null; onClose: () => void; onStartGroup: () => void;
  isDark?: boolean; onSetupProfile?: () => void;
}) {
  const bg = isDark ? 'rgba(28,28,30,0.97)' : 'rgba(255,255,255,0.97)';
  const textC = isDark ? '#FFFFFF' : '#000000';
  const subC = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)';
  const profileRowBg = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)';
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        {Platform.OS === 'ios' ? <BlurView intensity={isDark ? 60 : 50} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />}
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={{ backgroundColor: bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 16, paddingBottom: 40, paddingHorizontal: 20, minHeight: '55%' }}>
          <TouchableOpacity style={{ position: 'absolute', top: 16, right: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.07)', alignItems: 'center', justifyContent: 'center', zIndex: 10 }} onPress={onClose}>
            <Ionicons name="close" size={18} color={textC} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 40 }}>
            <Text style={{ color: textC, fontSize: 26, fontWeight: '700', textAlign: 'center', marginBottom: 12 }}>Use Dawinix together</Text>
            <Text style={{ color: subC, fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 36 }}>Add people to your chats to plan, share ideas, and get creative.</Text>
            <TouchableOpacity style={{ backgroundColor: textC, borderRadius: 30, paddingHorizontal: 48, paddingVertical: 17, width: '100%', alignItems: 'center' }} onPress={() => { onClose(); onStartGroup(); }}>
              <Text style={{ color: isDark ? '#000' : '#FFF', fontSize: 17, fontWeight: '700' }}>Start group chat</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: profileRowBg, borderRadius: 18, padding: 14, gap: 12 }} onPress={() => { onClose(); setTimeout(() => onSetupProfile?.(), 200); }} activeOpacity={0.75}>
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

function GroupChatActionsMenu({ visible, onClose, onPeople, onAddPeople, onManageLink, onRenameGroup, onCustomize, onMute, onReport, onDeleteGroup, isDark }: {
  visible: boolean; onClose: () => void; onPeople: () => void; onAddPeople: () => void;
  onManageLink: () => void; onRenameGroup: () => void; onCustomize: () => void;
  onMute: () => void; onReport: () => void; onDeleteGroup: () => void; isDark: boolean;
}) {
  const textC = isDark ? '#FFF' : '#000';
  const subC = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)';
  const borderC = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
  const items = [
    { sub: true, label: 'New group chat' },
    { icon: 'people-outline', label: 'People', onPress: () => { onClose(); onPeople(); } },
    { icon: 'person-add-outline', label: 'Add people', onPress: () => { onClose(); onAddPeople(); } },
    { icon: 'link-outline', label: 'Manage group link', onPress: () => { onClose(); onManageLink(); } },
    { icon: 'pencil-outline', label: 'Rename group', onPress: () => { onClose(); onRenameGroup(); } },
    { icon: 'settings-outline', label: 'Customize Dawinix', onPress: () => { onClose(); onCustomize(); } },
    { icon: 'notifications-off-outline', label: 'Mute notifications', onPress: () => { onClose(); onMute(); } },
    { icon: 'flag-outline', label: 'Report', onPress: () => { onClose(); onReport(); }, destructive: true },
    { icon: 'exit-outline', label: 'Leave group chat', onPress: () => { onClose(); onDeleteGroup(); }, destructive: true },
  ];
  if (!visible) return null;
  const bgCard = isDark ? 'rgba(40,40,44,0.97)' : 'rgba(255,255,255,0.97)';
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={{ flex: 1 }} onPress={onClose}>
        <View style={{ position: 'absolute', top: 80, right: 16, width: 250, borderRadius: 18, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 20 }}>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={isDark ? 80 : 70} tint={isDark ? 'dark' : 'extraLight'} style={{ borderRadius: 18, overflow: 'hidden', paddingVertical: 4 }}>
              {items.map((item: any, i) => (
                item.sub ? (
                  <Text key={`sub-${i}`} style={{ color: subC, fontSize: 12, fontWeight: '600', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 }}>{item.label}</Text>
                ) : (
                  <TouchableOpacity key={item.label} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, gap: 12, borderTopWidth: i > 1 ? StyleSheet.hairlineWidth : 0, borderTopColor: borderC }} onPress={item.onPress} activeOpacity={0.7}>
                    <Ionicons name={item.icon} size={20} color={item.destructive ? '#FF453A' : textC} />
                    <Text style={{ color: item.destructive ? '#FF453A' : textC, fontSize: 16 }}>{item.label}</Text>
                  </TouchableOpacity>
                )
              ))}
            </BlurView>
          ) : (
            <View style={{ backgroundColor: bgCard, borderRadius: 18, paddingVertical: 4 }}>
              {items.map((item: any, i) => (
                item.sub ? (
                  <Text key={`sub-${i}`} style={{ color: subC, fontSize: 12, fontWeight: '600', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 }}>{item.label}</Text>
                ) : (
                  <TouchableOpacity key={item.label} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, gap: 12, borderTopWidth: i > 1 ? StyleSheet.hairlineWidth : 0, borderTopColor: borderC }} onPress={item.onPress} activeOpacity={0.7}>
                    <Ionicons name={item.icon} size={20} color={item.destructive ? '#FF453A' : textC} />
                    <Text style={{ color: item.destructive ? '#FF453A' : textC, fontSize: 16 }}>{item.label}</Text>
                  </TouchableOpacity>
                )
              ))}
            </View>
          )}
        </View>
      </Pressable>
    </Modal>
  );
}

function PeopleModal({ visible, onClose, groupName, userName, profilePhotoUrl, isDark, isAdmin }: {
  visible: boolean; onClose: () => void; groupName: string; userName: string;
  profilePhotoUrl: string | null; isDark: boolean; isAdmin: boolean;
}) {
  const textC = isDark ? '#FFF' : '#000';
  const subC = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        {Platform.OS === 'ios' ? <BlurView intensity={40} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} />}
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
                  <Text style={{ color: subC, fontSize: 13, marginTop: 2 }}>{userName.toLowerCase().replace(/\s/g, '')} {String.fromCharCode(183)} you{isAdmin ? ` ${String.fromCharCode(183)} admin` : ''}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const GROUP_REPORT_CATEGORIES = [
  { label: 'Violence & self-harm', subs: ['Threats or incitement to violence', 'Weapons', 'Suicide & self-harm', 'Human trafficking', 'Terrorism'] },
  { label: 'Sexual exploitation & abuse', subs: ['Non-consensual intimate images', 'Sexual extortion'] },
  { label: 'Bullying & harassment', subs: ['Targeted harassment', 'Hate speech', 'Doxxing'] },
  { label: 'Spam, fraud & deception', subs: ['Phishing', 'Scams', 'Misinformation'] },
  { label: 'Privacy violation', subs: ['Sharing personal info', 'Non-consensual recording'] },
  { label: 'Something else', subs: ['Other concern'] },
];

function ReportGroupModal({ visible, onClose, isDark }: { visible: boolean; onClose: () => void; isDark: boolean }) {
  const [step, setStep] = useState<'main' | 'sub' | 'detail'>('main');
  const [selCategory, setSelCategory] = useState<typeof GROUP_REPORT_CATEGORIES[0] | null>(null);
  const [selSub, setSelSub] = useState('');
  const [detail, setDetail] = useState('');
  useEffect(() => { if (!visible) { setStep('main'); setSelCategory(null); setSelSub(''); setDetail(''); } }, [visible]);
  const bg = isDark ? '#111113' : '#F2F2F7';
  const cardBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const textC = isDark ? '#FFF' : '#000';
  const subC = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';
  const borderC = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  if (!visible) return null;
  return (
    <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 56 : 28, paddingHorizontal: 16, paddingBottom: 16 }}>
          {step !== 'main' ? (
            <TouchableOpacity onPress={() => setStep(step === 'detail' ? 'sub' : 'main')} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Ionicons name="chevron-back" size={20} color={textC} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={onClose} style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, marginRight: 12 }}>
              <Text style={{ color: textC, fontSize: 15, fontWeight: '500' }}>Cancel</Text>
            </TouchableOpacity>
          )}
          <Text style={{ flex: 1, fontSize: 17, fontWeight: '700', color: textC, textAlign: 'center', marginRight: step === 'detail' ? 0 : 48 }}>Report conversation</Text>
          {step === 'detail' ? (
            <TouchableOpacity onPress={() => onClose()} style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 }}>
              <Text style={{ color: textC, fontSize: 15, fontWeight: '600' }}>Submit</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {step === 'main' && (
          <>
            <Text style={{ color: subC, fontSize: 15, textAlign: 'center', marginBottom: 24, paddingHorizontal: 24 }}>Why are you reporting this conversation?</Text>
            <View style={{ marginHorizontal: 16, borderRadius: 18, overflow: 'hidden', backgroundColor: cardBg }}>
              {GROUP_REPORT_CATEGORIES.map((cat, i) => (
                <TouchableOpacity key={cat.label} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 16, borderTopWidth: i > 0 ? StyleSheet.hairlineWidth : 0, borderTopColor: borderC }} onPress={() => { setSelCategory(cat); setStep('sub'); }}>
                  <Text style={{ color: textC, fontSize: 16 }}>{cat.label}</Text>
                  <Ionicons name="chevron-forward" size={18} color={subC} />
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
        {step === 'sub' && selCategory && (
          <>
            <Text style={{ color: textC, fontSize: 17, fontWeight: '600', textAlign: 'center', marginBottom: 20 }}>{selCategory.label}</Text>
            <View style={{ marginHorizontal: 16, borderRadius: 18, overflow: 'hidden', backgroundColor: cardBg }}>
              {selCategory.subs.map((sub, i) => (
                <TouchableOpacity key={sub} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 16, borderTopWidth: i > 0 ? StyleSheet.hairlineWidth : 0, borderTopColor: borderC }} onPress={() => { setSelSub(sub); setStep('detail'); }}>
                  <Text style={{ color: textC, fontSize: 16 }}>{sub}</Text>
                  <Ionicons name="chevron-forward" size={18} color={subC} />
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
        {step === 'detail' && (
          <>
            <Text style={{ color: textC, fontSize: 17, fontWeight: '600', textAlign: 'center', marginBottom: 20, paddingHorizontal: 24 }}>{selSub}</Text>
            <View style={{ marginHorizontal: 16, borderRadius: 18, overflow: 'hidden', backgroundColor: cardBg, padding: 16 }}>
              <TextInput style={{ color: textC, fontSize: 16, minHeight: 120, textAlignVertical: 'top' }} placeholder="Please provide more details" placeholderTextColor={subC} value={detail} onChangeText={setDetail} multiline autoFocus />
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

function RenameGroupBox({ isDark, currentName, onSave, onCancel }: { isDark: boolean; currentName: string; onSave: (n: string) => void; onCancel: () => void }) {
  const [text, setText] = useState(currentName);
  useEffect(() => { setText(currentName); }, [currentName]);
  const textC = isDark ? '#FFF' : '#000';
  const inputBg = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)';
  return (
    <View style={{ width: '82%', borderRadius: 22, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.35, shadowRadius: 22, elevation: 22 }}>
      <View style={{ backgroundColor: isDark ? '#2C2C2E' : '#FFF', padding: 22, borderRadius: 22 }}>
        <Text style={{ color: textC, fontSize: 18, fontWeight: '700', marginBottom: 16 }}>Rename group</Text>
        <View style={{ backgroundColor: inputBg, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16 }}>
          <TextInput style={{ color: textC, fontSize: 16 }} value={text} onChangeText={setText} autoFocus selectTextOnFocus />
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: inputBg, borderRadius: 14, paddingVertical: 13, alignItems: 'center' }} onPress={onCancel}><Text style={{ color: textC, fontSize: 16, fontWeight: '600' }}>Cancel</Text></TouchableOpacity>
          <TouchableOpacity style={{ flex: 1, backgroundColor: inputBg, borderRadius: 14, paddingVertical: 13, alignItems: 'center' }} onPress={() => onSave(text.trim())}><Text style={{ color: textC, fontSize: 16, fontWeight: '600' }}>Save</Text></TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function CustomizeAIModal({ visible, onClose, onSave, initialInstructions, initialRespondAuto }: {
  visible: boolean; onClose: () => void; onSave: (instructions: string, respondAuto: boolean) => void; initialInstructions?: string; initialRespondAuto?: boolean;
}) {
  const [instructions, setInstructions] = useState(initialInstructions || '');
  const [respondAuto, setRespondAuto] = useState(initialRespondAuto !== false);
  useEffect(() => {
    if (visible) { setInstructions(initialInstructions || ''); setRespondAuto(initialRespondAuto !== false); }
  }, [visible]);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={customStyles.sheet}>
          <BlurView intensity={90} tint="dark" style={customStyles.sheetBlur}>
            <View style={customStyles.handle} />
            <Text style={customStyles.title}>Customize Dawinix</Text>
            <Text style={customStyles.sectionLabel}>Custom instructions</Text>
            <TextInput style={customStyles.textArea} value={instructions} onChangeText={setInstructions} placeholder="Get tailored responses by adding details about your group." placeholderTextColor="rgba(255,255,255,0.35)" multiline numberOfLines={4} />
            <View style={customStyles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={customStyles.toggleLabel}>Respond automatically</Text>
                <Text style={customStyles.toggleSub}>Answers automatically</Text>
              </View>
              <Switch value={respondAuto} onValueChange={setRespondAuto} trackColor={{ true: '#34C759', false: 'rgba(255,255,255,0.2)' }} thumbColor="#FFF" />
            </View>
            <Text style={customStyles.note}>Group chat custom instructions are separate from your personal Dawinix instructions.</Text>
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
  textArea: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 14, color: '#FFF', fontSize: 15, minHeight: 100, textAlignVertical: 'top', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 16 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  toggleLabel: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  toggleSub: { color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 2 },
  note: { color: 'rgba(255,255,255,0.4)', fontSize: 12, textAlign: 'center', marginBottom: 20, lineHeight: 18 },
  saveBtn: { backgroundColor: '#FFF', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { color: '#000', fontSize: 17, fontWeight: '600' },
});

function InviteLinkModal({ visible, onClose, isPlus, isDark }: { visible: boolean; onClose: () => void; isPlus: boolean; isDark?: boolean }) {
  const token = Math.random().toString(36).substring(2, 15);
  const id = Math.random().toString(36).substring(2, 14);
  const link = `https://dawinix.com/gg/v/${id}?token=${token}`;
  const textC = isDark !== false ? '#FFF' : '#000';
  const handleShare = async () => { try { await Share.share({ message: `Join my Dawinix group chat!\n\n${link}`, url: link }); } catch (e) {} onClose(); };
  const handleCopy = () => { Clipboard.setStringAsync(link); onClose(); };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
      <View style={{ borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' }}>
        <BlurView intensity={isDark !== false ? 90 : 75} tint={isDark !== false ? 'dark' : 'extraLight'} style={{ padding: 24 }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: isDark !== false ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)', alignSelf: 'center', marginBottom: 16 }} />
          <Text style={{ color: textC, fontSize: 18, fontWeight: '700', marginBottom: 6 }}>Group link</Text>
          <Text style={{ color: '#007AFF', fontSize: 13, marginBottom: 20 }} numberOfLines={1}>{link}</Text>
          {[
            { icon: 'copy-outline', label: 'Copy link', onPress: handleCopy },
            { icon: 'share-outline', label: 'Share link', onPress: handleShare },
          ].map((item, i) => (
            <TouchableOpacity key={item.label} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 16, borderTopWidth: i > 0 ? StyleSheet.hairlineWidth : 0, borderTopColor: isDark !== false ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }} onPress={item.onPress}>
              <Ionicons name={item.icon as any} size={22} color={textC} />
              <Text style={{ color: textC, fontSize: 17 }}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </BlurView>
      </View>
    </Modal>
  );
}

function TemporaryChatBanner() {
  return (
    <View style={tmpStyles.banner}>
      <Ionicons name="time-outline" size={18} color="rgba(255,255,255,0.6)" style={{ marginBottom: 8 }} />
      <Text style={tmpStyles.title}>Temporary chats</Text>
      <Text style={tmpStyles.body}>This chat will not appear in history, use or update Dawinix memory, or be used to train our models.{'\n\n'}For safety purposes, we may keep a copy of this chat for up to 30 days.</Text>
    </View>
  );
}

const tmpStyles = StyleSheet.create({
  banner: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  title: { color: '#FFF', fontSize: 17, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
  body: { color: 'rgba(255,255,255,0.55)', fontSize: 14, textAlign: 'center', lineHeight: 21 },
});

function WaveformAnimation({ isRecording }: { isRecording: boolean }) {
  const bars = 20;
  const anims = useRef(Array.from({ length: bars }, () => new Animated.Value(4))).current;
  useEffect(() => {
    if (isRecording) {
      const animations = anims.map((anim, i) =>
        Animated.loop(Animated.sequence([
          Animated.delay(i * 40),
          Animated.timing(anim, { toValue: 4 + Math.random() * 20, duration: 200 + Math.random() * 200, useNativeDriver: false }),
          Animated.timing(anim, { toValue: 4, duration: 200 + Math.random() * 200, useNativeDriver: false }),
        ]))
      );
      animations.forEach(a => a.start());
      return () => animations.forEach(a => a.stop());
    } else {
      anims.forEach(a => a.setValue(4));
    }
  }, [isRecording]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, flex: 1, height: 32 }}>
      {anims.map((anim, i) => (
        <Animated.View key={i} style={{ width: 3, height: anim, borderRadius: 2, backgroundColor: '#FF3B30' }} />
      ))}
    </View>
  );
}

function NotificationPermissionModal({ visible, onAllow, onSkip }: { visible: boolean; onAllow: () => void; onSkip: () => void }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 220, friction: 20, useNativeDriver: true }),
      ]).start();
    } else { fadeAnim.setValue(0); scaleAnim.setValue(0.85); }
  }, [visible]);
  if (!visible) return null;
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onSkip}>
      <View style={notifStyles.backdrop}>
        <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
        <Animated.View style={[notifStyles.card, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
          <BlurView intensity={95} tint="dark" style={notifStyles.blurCard}>
            <View style={notifStyles.iconWrap}><Ionicons name="notifications" size={32} color="#FFFFFF" /></View>
            <Text style={notifStyles.title}>Stay informed</Text>
            <Text style={notifStyles.body}>Dawinix can notify you when your AI response is ready.</Text>
            <View style={notifStyles.benefitRow}><Ionicons name="checkmark-circle" size={16} color="#34C759" /><Text style={notifStyles.benefitText}>Know when AI finishes responding</Text></View>
            <View style={notifStyles.benefitRow}><Ionicons name="checkmark-circle" size={16} color="#34C759" /><Text style={notifStyles.benefitText}>Get alerts for long research tasks</Text></View>
            <View style={notifStyles.benefitRow}><Ionicons name="checkmark-circle" size={16} color="#34C759" /><Text style={notifStyles.benefitText}>No spam — only task completions</Text></View>
            <TouchableOpacity style={notifStyles.allowBtn} onPress={onAllow}><Text style={notifStyles.allowBtnText}>Allow Notifications</Text></TouchableOpacity>
            <TouchableOpacity style={notifStyles.skipBtn} onPress={onSkip}><Text style={notifStyles.skipBtnText}>Not Now</Text></TouchableOpacity>
          </BlurView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const notifStyles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  card: { width: '100%', maxWidth: 360, borderRadius: 22, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.45, shadowRadius: 24, elevation: 24 },
  blurCard: { padding: 28, alignItems: 'center' },
  iconWrap: { width: 70, height: 70, borderRadius: 20, backgroundColor: '#10A37F', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title: { color: '#FFF', fontSize: 22, fontWeight: '700', marginBottom: 10, textAlign: 'center' },
  body: { color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center', lineHeight: 21, marginBottom: 18 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, width: '100%' },
  benefitText: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  allowBtn: { width: '100%', backgroundColor: '#10A37F', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 20, marginBottom: 10 },
  allowBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  skipBtn: { paddingVertical: 10, paddingHorizontal: 20 },
  skipBtnText: { color: 'rgba(255,255,255,0.45)', fontSize: 14 },
});

function ImageCreatingOverlay() {
  const dotCount = 64;
  const anims = useRef(Array.from({ length: dotCount }, () => new Animated.Value(0))).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const shimmerX = useRef(new Animated.Value(-300)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacityAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 200, friction: 20, useNativeDriver: true }),
    ]).start();
    const animations = anims.map((anim, i) => {
      const row = Math.floor(i / 8);
      const col = i % 8;
      const delay = (row + col) * 55;
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 600 + Math.random() * 400, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 600 + Math.random() * 400, useNativeDriver: true }),
        ])
      );
    });
    animations.forEach(a => a.start());
    const shimmerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerX, { toValue: 400, duration: 1800, useNativeDriver: true }),
        Animated.delay(600),
        Animated.timing(shimmerX, { toValue: -300, duration: 0, useNativeDriver: true }),
      ])
    );
    shimmerLoop.start();
    return () => { animations.forEach(a => a.stop()); shimmerLoop.stop(); };
  }, []);
  const { width: screenW } = Dimensions.get('window');
  const cardW = Math.min(screenW - 64, 320);
  const cardH = cardW * 1.1;
  return (
    <Animated.View style={[StyleSheet.absoluteFillObject, { zIndex: 999, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'center', alignItems: 'center', opacity: opacityAnim }]}>
      <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
      <Animated.View style={[imgOverlayStyles.card, { width: cardW, height: cardH, transform: [{ scale: scaleAnim }] }]}>
        <View style={imgOverlayStyles.dotGrid}>
          {anims.map((anim, i) => (
            <Animated.View key={i} style={[imgOverlayStyles.dot, { opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.65] }), transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.3] }) }] }]} />
          ))}
        </View>
        <Animated.View style={[imgOverlayStyles.shimmer, { transform: [{ translateX: shimmerX }] }]} />
        <View style={imgOverlayStyles.textRow}>
          <ActivityIndicator size="small" color="rgba(255,255,255,0.7)" style={{ marginRight: 8 }} />
          <Text style={imgOverlayStyles.label}>Creating image</Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const imgOverlayStyles = StyleSheet.create({
  card: { borderRadius: 28, backgroundColor: '#111113', overflow: 'hidden', justifyContent: 'flex-end', padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.55, shadowRadius: 28, elevation: 28 },
  dotGrid: { position: 'absolute', top: 20, left: 20, right: 20, bottom: 60, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.75)' },
  shimmer: { position: 'absolute', top: 0, bottom: 0, width: 80, backgroundColor: 'rgba(255,255,255,0.04)' },
  textRow: { flexDirection: 'row', alignItems: 'center', paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.08)' },
  label: { color: 'rgba(255,255,255,0.82)', fontSize: 16, fontWeight: '500', letterSpacing: 0.2 },
});

export default function HomeScreen() {
  const { colors, isDark } = useTheme();
  const { settings, updateSetting } = useSettings();
  const { user } = useAuth();
  const { canSendMessage, coins, isUnlimited, incrementMessageCount, isAdmin: rawIsAdmin } = useGuestLimits();
  const ADMIN_EMAILS = ['berryxoe@gmail.com', 'newdawens@gmail.com', 'kontgithub@gmail.com'];
  const isAdminEmail = user?.email ? ADMIN_EMAILS.includes(user.email.toLowerCase()) : false;
  const isAdmin = rawIsAdmin || isAdminEmail;
  const { isPro } = useSubscription();
  const {
    conversations, messages, currentConversation,
    sendMessage, updateMessageAndRegenerate, createConversation, deleteConversation,
    loading, streamingMessageId, updateConversationTitle, archiveConversation,
    selectConversation, temporaryMode: ctxTempMode, setTemporaryMode: ctxSetTempMode,
    cancelSendMessage, isOfflineMode,
  } = useConversation();
  const { showAlert } = useAlert();
  const router = useRouter();
  const params = useLocalSearchParams<{ fromImages?: string; imageBase64?: string; imagePrompt?: string }>();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  const [isAppActive, setIsAppActive] = useState(true);
  const [showBlurOverlay, setShowBlurOverlay] = useState(false);
  const [inputText, setInputText] = useState('');
  const draftSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [toolsVisible, setToolsVisible] = useState(false);
  const [conversationMenuVisible, setConversationMenuVisible] = useState(false);
  const [sideMenuVisible, setSideMenuVisible] = useState(false);
  const [chatHistoryVisible, setChatHistoryVisible] = useState(false);
  const [deepResearchMode, setDeepResearchMode] = useState(false);
  const [webSearchMode, setWebSearchMode] = useState(false);
  const [thinkingModeActive, setThinkingModeActive] = useState(false);
  const [deepResearchPlanVisible, setDeepResearchPlanVisible] = useState(false);
  const [deepResearchPlanSteps, setDeepResearchPlanSteps] = useState<string[]>([]);
  const [deepResearchPlanTitle, setDeepResearchPlanTitle] = useState('');
  const [deepResearchCountdown, setDeepResearchCountdown] = useState(58);
  const deepResearchCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [deepResearchRunning, setDeepResearchRunning] = useState(false);
  const [webSearchModalVisible, setWebSearchModalVisible] = useState(false);
  const [deepResearchSteps, setDeepResearchSteps] = useState<Array<{label:string;done:boolean}>>([]);
  const [deepResearchActive, setDeepResearchActive] = useState(false);
  const isGuest = !user;
  const [guestMessageCount, setGuestMessageCount] = useState(0);
  const GUEST_MESSAGE_LIMIT = 20;
  const [guestLoginModal, setGuestLoginModal] = useState(false);
  const [guestLockModal, setGuestLockModal] = useState(false);
  const [guestLockFeature, setGuestLockFeature] = useState('');
  const [guestPhotoCount, setGuestPhotoCount] = useState(0);
  const [guestPhotoResetTime, setGuestPhotoResetTime] = useState<number>(0);
  const GUEST_PHOTO_LIMIT = 3;
  const GUEST_PHOTO_BLOCK_MS = 20 * 60 * 60 * 1000; // 20 hours
  const [guestMessageLimitReached, setGuestMessageLimitReached] = useState(false);
  const [guestMessageLimitTime, setGuestMessageLimitTime] = useState<number>(0);
  const GUEST_LOCK_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
  const [currentAIMode, setCurrentAIMode] = useState<AIMode>('instant');
  const [photoUploadCount, setPhotoUploadCount] = useState(0);
  const [photoUploadResetTime, setPhotoUploadResetTime] = useState<number>(0);
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<MediaFile[]>([]);
  const [currentAIModel, setCurrentAIModel] = useState<AIModelKey>((settings.preferredAiModel as AIModelKey) || 'gemini');
  const inputRef = useRef<TextInput>(null);
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);
  const [badWordViolationCount, setBadWordViolationCount] = useState(0);
  const badWordViolationsRef = useRef(0);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [lastShake, setLastShake] = useState(0);
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [shakeEnabled, setShakeEnabled] = useState(true);
  const [shakeBugModalVisible, setShakeBugModalVisible] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [calcVisible, setCalcVisible] = useState(false);
  const [calcExpression, setCalcExpression] = useState('');
  const [calcResult, setCalcResult] = useState('');
  const [quizConnectVisible, setQuizConnectVisible] = useState(false);
  const [quizConnectDetailVisible, setQuizConnectDetailVisible] = useState(false);
  const [quizTopicVisible, setQuizTopicVisible] = useState(false);
  const [selectedQuizTopic, setSelectedQuizTopic] = useState('');
  const [quizGenerating, setQuizGenerating] = useState(false);
  const [quizMode, setQuizMode] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState('Medium');
  const [customTopicInput, setCustomTopicInput] = useState('');
  const [quizHistory, setQuizHistory] = useState<QuizHistoryEntry[]>([]);
  const [messageLimitModalVisible, setMessageLimitModalVisible] = useState(false);
  const messageLimitDismissedAtRef = useRef<number>(0);
  const [presetsModalVisible, setPresetsModalVisible] = useState(false);
  const [thinkingMode, setThinkingMode] = useState<'thinking' | 'creating_image' | 'analyzing' | 'editing_image'>('thinking');
  const [showCompletionStatus, setShowCompletionStatus] = useState(false);
  const [pendingNotifConvId, setPendingNotifConvId] = useState<string|null>(null);
  const [imageAnalyzingOverlay, setImageAnalyzingOverlay] = useState(false);
  const [savedImageUrls, setSavedImageUrls] = useState<Set<string>>(new Set());
  const [savingImageId, setSavingImageId] = useState<string | null>(null);
  const [isOffline] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredMessages, setFilteredMessages] = useState<Message[]>([]);
  const [timeUntilMidnight, setTimeUntilMidnight] = useState('');
  const [sessionBonusMessages, setSessionBonusMessages] = useState(0);
  const [hasUsedNewChatBonus, setHasUsedNewChatBonus] = useState(false);
  const [codeLangChips, setCodeLangChips] = useState(false);
  const [smartSuggestions, setSmartSuggestions] = useState<Array<{title: string; sub: string}>>([]);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [archiveConfirmVisible, setArchiveConfirmVisible] = useState(false);
  const [groupStartModalVisible, setGroupStartModalVisible] = useState(false);
  const [notifPermModalVisible, setNotifPermModalVisible] = useState(false);
  const [groupChatMode, setGroupChatMode] = useState(false);
  const [temporaryChatMode, setTemporaryChatModeLocal] = useState(false);
  const setTemporaryChatMode = (val: boolean) => {
    setTemporaryChatModeLocal(val);
    if (ctxSetTempMode) ctxSetTempMode(val);
  };
  const [customizeAIVisible, setCustomizeAIVisible] = useState(false);
  const [inviteLinkVisible, setInviteLinkVisible] = useState(false);
  const [groupCustomInstructions, setGroupCustomInstructions] = useState('');
  const [groupRespondAuto, setGroupRespondAuto] = useState(true);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [groupName, setGroupName] = useState('New group chat');
  const [groupChatActionsVisible, setGroupChatActionsVisible] = useState(false);
  const [renameGroupVisible, setRenameGroupVisible] = useState(false);
  const [peopleModalVisible, setPeopleModalVisible] = useState(false);
  const [reportGroupVisible, setReportGroupVisible] = useState(false);
  const [profileEditModalVisible, setProfileEditModalVisible] = useState(false);
  const [deleteGroupConfirm, setDeleteGroupConfirm] = useState(false);
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentionPopup, setShowMentionPopup] = useState(false);
  const [filteredMentionMembers, setFilteredMentionMembers] = useState<GroupMember[]>([]);
  const [userProfilePhoto, setUserProfilePhoto] = useState<string | null>(null);
  const pushTokenRef = useRef<string | null>(null);
  const [inlineQuizVisible, setInlineQuizVisible] = useState(false);
  const [inlineQuizQuestions, setInlineQuizQuestions] = useState<QuizQuestion[]>([]);
  const [preGeneratedQuestions, setPreGeneratedQuestions] = useState<QuizQuestion[] | null>(null);
  const preGenRunning = useRef(false);
  const [messageLikes, setMessageLikes] = useState<Record<string, 'like' | 'dislike' | null>>({});
  const [msgMenuVisible, setMsgMenuVisible] = useState(false);
  const [msgMenuMsg, setMsgMenuMsg] = useState<any>(null);
  const [msgMenuPageY, setMsgMenuPageY] = useState(0);
  const [msgActionsVisible, setMsgActionsVisible] = useState(false);
  const [msgActionsMsg, setMsgActionsMsg] = useState<any>(null);

  // ── Spotify state ────────────────────────────────────────────────────────
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [spotifyHasAccount, setSpotifyHasAccount] = useState(false);
  const [spotifyActive, setSpotifyActive] = useState(false);
  const [spotifyResults, setSpotifyResults] = useState<SpotifyTrack[]>([]);
  const [spotifySearching, setSpotifySearching] = useState(false);
  const [connectedAppsModalVisible, setConnectedAppsModalVisible] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  const handleOpenMessageActions = useCallback((msg: any) => {
    setMsgActionsMsg(msg);
    setMsgActionsVisible(true);
  }, []);

  const wasGeneratingRef = useRef(false);
  const appStateForNotifRef = useRef(AppState.currentState);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(100)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const flatListRef = useRef<FlatList>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioPermissionRef = useRef<boolean>(false);
  const isRecordingRef = useRef<boolean>(false);
  const stopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const autoLockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (params.fromImages === '1' && params.imageBase64) {
      setImageAnalyzingOverlay(true);
      const base64 = params.imageBase64;
      const promptText = (params.imagePrompt || '').trim() ||
        'Please analyze this image in full detail. Describe everything you see including subjects, colors, text, mood, and any important details.';
      (async () => {
        try {
          let convId = currentConversation?.id;
          if (!convId) { convId = await createConversation(); }
          if (!convId) return;
          setSending(true);
          setGenerating(true);
          setThinkingMode('analyzing');
          await sendMessage(promptText, undefined, base64, false, currentAIModel);
        } catch (e: any) {
          showAlert('Error', e?.message || 'Failed to analyze image');
        } finally {
          setImageAnalyzingOverlay(false);
          setSending(false);
          setGenerating(false);
        }
      })();
    }
  }, [params.fromImages]);

  const handleSaveToMyImages = useCallback(async (imageUrl: string, messageId: string) => {
    if (!user?.id || savingImageId) return;
    setSavingImageId(messageId);
    try {
      await supabase.from('media_files').insert({
        user_id: user.id,
        file_type: 'image',
        file_url: imageUrl,
        file_name: `ai-image-${Date.now()}.jpg`,
        file_size: 0,
      });
      setSavedImageUrls(prev => new Set([...prev, imageUrl]));
      showAlert('Saved!', 'Image saved to My Images gallery.');
    } catch (e: any) {
      showAlert('Error', 'Could not save image.');
    } finally {
      setSavingImageId(null);
    }
  }, [user?.id, supabase, showAlert, savingImageId]);

  useEffect(() => {
    // Load guest limits from AsyncStorage
    if (!user) {
      (async () => {
        try {
          const stored = await AsyncStorage.multiGet(['guest_msg_count','guest_msg_limit_time','guest_photo_count','guest_photo_reset_time']);
          const msgCount = parseInt(stored[0][1] || '0', 10);
          const msgLimitTime = parseInt(stored[1][1] || '0', 10);
          const photoCount = parseInt(stored[2][1] || '0', 10);
          const photoResetTime = parseInt(stored[3][1] || '0', 10);
          const now = Date.now();
          if (msgLimitTime > 0 && now - msgLimitTime > GUEST_LOCK_DURATION_MS) {
            await AsyncStorage.multiRemove(['guest_msg_count', 'guest_msg_limit_time']);
          } else {
            setGuestMessageCount(msgCount);
            if (msgLimitTime > 0) { setGuestMessageLimitReached(true); setGuestMessageLimitTime(msgLimitTime); }
          }
          if (photoResetTime > 0 && now - photoResetTime > GUEST_PHOTO_BLOCK_MS) {
            await AsyncStorage.multiRemove(['guest_photo_count', 'guest_photo_reset_time']);
          } else {
            setGuestPhotoCount(photoCount);
            setGuestPhotoResetTime(photoResetTime);
          }
        } catch (_e) {}
      })();
    }
    loadDraft().then(draft => { if (draft) setInputText(draft); });
    AsyncStorage.getItem(CONV_PERSIST_KEY).then(savedId => {
      if (savedId && selectConversation) {
        selectConversation(savedId).catch(() => {});
      }
    }).catch(() => {});
    const clearTimer = setTimeout(() => clearDraft(), INPUT_PERSIST_TTL);
    return () => {
      clearTimeout(clearTimer);
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (currentConversation?.id) {
      AsyncStorage.setItem(CONV_PERSIST_KEY, currentConversation.id).catch(() => {});
    }
  }, [currentConversation?.id]);

  const handleInputChange = useCallback(async (txt: string) => {
    const safeTxt = txt ?? '';
    setInputText(safeTxt);
    if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    draftSaveTimer.current = setTimeout(() => saveDraft(safeTxt), 300);
    try { setCodeLangChips(/```\w*$/.test(safeTxt)); } catch (_e) { setCodeLangChips(false); }
    if (groupChatMode) {
      const atMatch = safeTxt.match(/@(\w*)$/);
      if (atMatch !== null) { setMentionQuery(atMatch[1] || ''); setShowMentionPopup(true); }
      else { setShowMentionPopup(false); setMentionQuery(''); }
    }
  }, [groupChatMode]);

  useEffect(() => {
    if (user?.id) {
      supabase.from('user_profiles').select('profile_photo_url').eq('id', user.id).single().then(({ data }) => {
        if (data?.profile_photo_url) setUserProfilePhoto(data.profile_photo_url);
      });
    }
  }, [user?.id]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const convId = response.notification.request.content.data?.conversationId as string | undefined;
      if (convId) setPendingNotifConvId(convId);
    });
    if (Platform.OS !== 'web') {
      Notifications.getLastNotificationResponseAsync().then(response => {
        if (response) {
          const convId = response.notification.request.content.data?.conversationId as string | undefined;
          if (convId) setPendingNotifConvId(convId);
        }
      }).catch(() => {});
    }
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!pendingNotifConvId) return;
    const conv = conversations?.find((c: any) => c.id === pendingNotifConvId);
    if (conv) {
      selectConversation(pendingNotifConvId);
      setPendingNotifConvId(null);
    }
  }, [pendingNotifConvId, conversations]);

  useEffect(() => {
    registerForPushNotifications().then(token => { pushTokenRef.current = token; });
    const sub = AppState.addEventListener('change', s => { appStateForNotifRef.current = s; });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const checkAndShowNotifModal = async () => {
      try {
        const { status } = await Notifications.getPermissionsAsync();
        if (status === 'undetermined') {
          const timer = setTimeout(() => setNotifPermModalVisible(true), 2000);
          return () => clearTimeout(timer);
        }
      } catch (_e) {}
    };
    checkAndShowNotifModal();
  }, []);

  const handleAllowNotifications = useCallback(async () => {
    setNotifPermModalVisible(false);
    try {
      const token = await registerForPushNotifications();
      if (token && user?.id) {
        pushTokenRef.current = token;
        await supabase.from('user_profiles').update({ push_token: token } as any).eq('id', user.id).catch(() => {});
      }
    } catch (_e) {}
  }, [user?.id, supabase]);

  useEffect(() => {
    const isGeneratingNow = generating || sending;
    if (wasGeneratingRef.current && !isGeneratingNow) {
      if (appStateForNotifRef.current !== 'active') {
        const msgs = messages || [];
        const lastAI = [...msgs].reverse().find(m => m.role === 'assistant');
        if (lastAI) {
          const preview = lastAI.content.replace(/[#*`]/g, '').slice(0, 60);
          const ttl = currentConversation?.title || 'Dawinix';
          sendLocalNotification(ttl, preview + (lastAI.content.length > 60 ? '...' : ''));
        }
      }
    }
    wasGeneratingRef.current = isGeneratingNow;
  }, [generating, sending, messages, currentConversation]);

  useEffect(() => {
    if (showMentionPopup && groupChatMode) {
      const q = mentionQuery.toLowerCase();
      setFilteredMentionMembers(groupMembers.filter(m => !q || m.username.toLowerCase().includes(q)));
    }
  }, [mentionQuery, showMentionPopup, groupMembers, groupChatMode]);

  useEffect(() => { loadSmartSuggestions(); }, [user?.id]);

  const loadSmartSuggestions = async () => {
    const fallback = [
      { title: 'Create an image', sub: 'for my presentation' },
      { title: 'Write a report', sub: 'based on my data' },
      { title: 'Write a Python script', sub: 'to automate sending' },
      { title: 'Translate to English', sub: 'any text or document' },
    ];
    try {
      if (!user?.id) { setSmartSuggestions(fallback); return; }
      setSmartSuggestions(fallback);
    } catch (e) { setSmartSuggestions(fallback); }
  };

  const computeTimeUntilMidnight = useCallback(() => {
    const now = new Date();
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    const diff = midnight.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    setTimeUntilMidnight(`${hours}h ${minutes}m`);
  }, []);

  useEffect(() => {
    computeTimeUntilMidnight();
    const interval = setInterval(computeTimeUntilMidnight, 60000);
    return () => clearInterval(interval);
  }, [computeTimeUntilMidnight]);

  // Track keyboard visibility for + button placement
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setIsKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setIsKeyboardVisible(false));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const { refreshConversations } = useConversation();
  useEffect(() => {
    if (sideMenuVisible) {
      refreshConversations().catch(() => {});
    }
  }, [sideMenuVisible]);

  const swipeGesture = (() => {
    try {
      const pan = Gesture.Pan();
      if (!pan || typeof pan.activeOffsetX !== 'function') return null;
      return pan
        .activeOffsetX([55, 10000])
        .failOffsetY([-25, 25])
        .minDistance(55)
        .onEnd((e: any) => {
          if (e.translationX > 110 && e.velocityX > 250 && !sideMenuVisible) {
            runOnJS(setSideMenuVisible)(true);
          }
        });
    } catch (_e) { return null; }
  })();

  useEffect(() => {
    checkAudioPermissions();
    return () => { cleanupAll(); };
  }, []);

  const cleanupAll = useCallback(() => {
    if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (autoLockTimerRef.current) clearTimeout(autoLockTimerRef.current);
    cleanupRecording();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      appStateRef.current = nextAppState;
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        setIsAppActive(false);
        setShowBlurOverlay(true);
      } else if (nextAppState === 'active') {
        setIsAppActive(true);
        if (autoLockTimerRef.current) { clearTimeout(autoLockTimerRef.current); autoLockTimerRef.current = null; }
        Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => setShowBlurOverlay(false));
        if (currentConversation?.id && !currentConversation.id.startsWith('guest-') && !currentConversation.id.startsWith('local-') && !streamingMessageId) {
          selectConversation(currentConversation.id);
        }
      }
    });
    return () => subscription.remove();
  }, [currentConversation?.id, selectConversation, fadeAnim]);

  useFocusEffect(
    useCallback(() => {
      setIsAppActive(true);
      setShowBlurOverlay(false);
      fadeAnim.setValue(1);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
      // Load Spotify connection state — do NOT auto-activate chip; user must tap it or just connected
      AsyncStorage.multiGet(['spotify_connected', 'spotify_has_account']).then(results => {
        const isConn = results[0][1] === 'true';
        setSpotifyConnected(isConn);
        setSpotifyHasAccount(results[1][1] === 'true');
        // spotifyActive is intentionally NOT set here — chip only shows after explicit user action
      }).catch(() => {});
      return () => { slideAnim.setValue(100); };
    }, [])
  );

  const handleScrollEvent = useCallback((event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    const atBottom = distanceFromBottom < 80;
    setIsAtBottom(atBottom);
    setShowScrollToBottom(!atBottom);
  }, []);

  useEffect(() => {
    if ((messages || []).length > 0 && !isSearchMode && isAtBottom) {
      const timer = setTimeout(() => { flatListRef.current?.scrollToEnd({ animated: true }); }, 100);
      return () => clearTimeout(timer);
    }
  }, [messages, isSearchMode, isAtBottom]);

  useEffect(() => {
    if (searchQuery.trim()) {
      setFilteredMessages((messages || []).filter(msg => msg.content.toLowerCase().includes(searchQuery.toLowerCase())));
    } else {
      setFilteredMessages([]);
    }
  }, [searchQuery, messages]);

  useEffect(() => {
    if (!user) { setShakeEnabled(false); return; }
    AsyncStorage.getItem('shake_bug_enabled').then(v => {
      if (v !== null) setShakeEnabled(v === 'true');
      else setShakeEnabled(true);
    }).catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        const r = await Promise.race([
          fetch('https://www.google.com/generate_204', { method: 'HEAD', cache: 'no-cache' }),
          new Promise<Response>((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000)),
        ]) as Response;
        if (mounted) setIsConnected(r.status < 500);
      } catch { if (mounted) setIsConnected(false); }
    };
    check();
    const interval = setInterval(check, 10000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  useEffect(() => {
    if (!user || (Platform.OS !== 'ios' && Platform.OS !== 'android')) return;
    const subscription = Accelerometer.addListener(({ x, y, z }) => {
      const acceleration = Math.sqrt(x * x + y * y + z * z);
      const now = Date.now();
      if (shakeEnabled && acceleration > SHAKE_THRESHOLD && now - lastShake > SHAKE_COOLDOWN) {
        setLastShake(now);
        Vibration.vibrate(400);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setShakeBugModalVisible(true);
      }
    });
    Accelerometer.setUpdateInterval(100);
    return () => subscription.remove();
  }, [lastShake, shakeEnabled, user?.id]);

  useEffect(() => {
    if (recordingState === 'recording') {
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])).start();
    } else { pulseAnim.setValue(1); }
  }, [recordingState, pulseAnim]);

  const checkAudioPermissions = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      audioPermissionRef.current = status === 'granted';
      if (status === 'granted') {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true, staysActiveInBackground: false, shouldDuckAndroid: true, playThroughEarpieceAndroid: false });
      }
    } catch (error) { audioPermissionRef.current = false; }
  };

  const startRecordingTimer = useCallback(() => {
    setRecordingDuration(0);
    recordingTimerRef.current = setInterval(() => {
      setRecordingDuration(prev => {
        if (prev >= MAX_RECORDING_DURATION - 1) { stopVoiceRecording(); return prev; }
        return prev + 1;
      });
    }, 1000);
  }, []);

  const stopRecordingTimer = useCallback(() => {
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
  }, []);

  const formatDuration = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const cleanupRecording = useCallback(async () => {
    if (stopTimeoutRef.current) { clearTimeout(stopTimeoutRef.current); stopTimeoutRef.current = null; }
    stopRecordingTimer();
    if (recordingRef.current) {
      try {
        const status = await recordingRef.current.getStatusAsync();
        if (status.isRecording) await recordingRef.current.stopAndUnloadAsync();
      } catch (e) {}
      recordingRef.current = null;
    }
    isRecordingRef.current = false;
    setRecordingState('idle');
    setRecordingDuration(0);
  }, [stopRecordingTimer]);

  const startVoiceRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      audioPermissionRef.current = status === 'granted';
    } catch (e) { audioPermissionRef.current = false; }

    if (!audioPermissionRef.current) {
      Alert.alert('Microphone Required', 'Please enable microphone access in Settings.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Platform.OS === 'ios' ? Linking.openURL('app-settings:') : Linking.openSettings() }
      ]);
      return;
    }

    try {
      await cleanupRecording();
      await new Promise(r => setTimeout(r, 250));
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true, shouldDuckAndroid: true, playThroughEarpieceAndroid: false, staysActiveInBackground: false, interruptionModeIOS: 1, interruptionModeAndroid: 1 });
      if (Platform.OS === 'android') await new Promise(r => setTimeout(r, 200));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setRecordingState('recording');
      isRecordingRef.current = true;
      startRecordingTimer();
      const { recording } = await Audio.Recording.createAsync({
        android: { extension: '.m4a', outputFormat: Audio.AndroidOutputFormat.MPEG_4, audioEncoder: Audio.AndroidAudioEncoder.AAC, sampleRate: 16000, numberOfChannels: 1, bitRate: 128000 },
        ios: { extension: '.m4a', audioQuality: Audio.IOSAudioQuality.HIGH, sampleRate: 16000, numberOfChannels: 1, bitRate: 128000, linearPCMBitDepth: 16, linearPCMIsBigEndian: false, linearPCMIsFloat: false },
        web: { mimeType: 'audio/webm;codecs=opus', bitsPerSecond: 64000 },
      });
      recordingRef.current = recording;
      stopTimeoutRef.current = setTimeout(() => { if (isRecordingRef.current) stopVoiceRecording(); }, MAX_RECORDING_DURATION * 1000);
    } catch (error: any) {
      console.log('[Recording] Failed to start:', error?.message);
      await cleanupRecording();
      Alert.alert('Recording Failed', Platform.OS === 'android' ? 'Could not start microphone. Please close other apps using the mic and try again.' : 'Could not start recording.', [
        { text: 'Try Again', onPress: () => setTimeout(startVoiceRecording, 600) },
        { text: 'OK', style: 'cancel' },
      ]);
    }
  };

  const stopVoiceRecording = async () => {
    if (!recordingRef.current || !isRecordingRef.current) return;
    if (stopTimeoutRef.current) { clearTimeout(stopTimeoutRef.current); stopTimeoutRef.current = null; }
    stopRecordingTimer();
    setRecordingState('processing');
    isRecordingRef.current = false;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    processingTimeoutRef.current = setTimeout(() => { setRecordingState('idle'); processingTimeoutRef.current = null; }, 30000);
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      if (!uri) throw new Error('No recording URI');
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists) throw new Error('Recording file not found');
      const fileSize = (info as any).size || 0;
      if (fileSize < 500) throw new Error('Recording too short or empty');
      const base64Audio = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      if (!base64Audio || base64Audio.length < 100) throw new Error('Audio encoding failed. Please try again.');
      if (!isValidBase64(base64Audio.slice(0, 100))) { throw new Error('Audio format error. Please try again.'); }
      await transcribeAudio(base64Audio);
    } catch (error: any) {
      Alert.alert('Processing Failed', error.message || 'Failed to process recording.', [
        { text: 'Try Again', onPress: () => { setRecordingState('idle'); setTimeout(startVoiceRecording, 300); } },
        { text: 'Type Manually', style: 'cancel', onPress: () => setRecordingState('idle') },
      ]);
      setRecordingState('idle');
    } finally {
      recordingRef.current = null;
      if (Platform.OS === 'android') {
        Audio.setAudioModeAsync({ allowsRecordingIOS: false, shouldDuckAndroid: false, playThroughEarpieceAndroid: false, staysActiveInBackground: false }).catch(() => {});
      }
    }
  };

  const toggleRecording = useCallback(() => {
    if (processingTimeoutRef.current) { clearTimeout(processingTimeoutRef.current); processingTimeoutRef.current = null; }
    if (recordingState === 'idle') startVoiceRecording();
    else if (recordingState === 'recording') stopVoiceRecording();
    else if (recordingState === 'processing') { setRecordingState('idle'); isRecordingRef.current = false; }
  }, [recordingState]);

  const BAD_WORDS = ['fuck', 'shit', 'bitch', 'asshole', 'bastard', 'cunt', 'damn', 'dick', 'pussy', 'cock', 'nigger', 'nigga', 'faggot', 'whore', 'slut', 'ass', 'motherfucker', 'fucker', 'piss', 'retard', 'kaka', 'manman', 'degage'];

  const checkBadWord = useCallback((text: string): boolean => {
    const lowerText = text.toLowerCase();
    return BAD_WORDS.some(w => new RegExp(`\\b${w}\\b`, 'i').test(lowerText));
  }, []);

  const handleBadWordViolation = useCallback(async (text: string) => {
    badWordViolationsRef.current += 1;
    setBadWordViolationCount(badWordViolationsRef.current);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Alert.alert('Warning', `Inappropriate language detected. Warning #${badWordViolationsRef.current}.`, [{ text: 'I Understand', style: 'destructive' }]);
    if (badWordViolationsRef.current >= 3 && user?.id) {
      try {
        await supabase.functions.invoke('ban-user', { body: { userId: user.id, reason: `Repeated bad language violations (${badWordViolationsRef.current} times).`, duration: 7 } });
        Alert.alert('Account Suspended', 'Your account has been suspended for 7 days.', [{ text: 'OK', style: 'cancel' }]);
      } catch (e) {}
    }
  }, [user?.id, supabase]);

  const transcribeAudio = async (base64Audio: string, retryCount = 0) => {
    const MAX_RETRIES = 2;
    try {
      const { data, error } = await supabase.functions.invoke('transcribe-audio', {
        body: { audio: base64Audio, userId: user?.id, conversationId: currentConversation?.id, detectLanguage: true },
        headers: { 'x-timeout': '30000' }
      });
      if (error) {
        if (retryCount < MAX_RETRIES) { await new Promise(r => setTimeout(r, Math.pow(2, retryCount) * 1000)); return transcribeAudio(base64Audio, retryCount + 1); }
        throw new Error(error.message || 'Transcription failed');
      }
      if (!data?.text?.trim()) {
        if (data?.warning) { Alert.alert('No Speech Detected', 'Could not detect speech.', [{ text: 'Try Again', onPress: () => startVoiceRecording() }, { text: 'OK', style: 'cancel', onPress: () => setRecordingState('idle') }]); return; }
        throw new Error('No transcription received');
      }
      const transcribedText = data.text.trim();
      if (data.detectedLanguage) { setDetectedLanguage(data.detectedLanguage); setTimeout(() => setDetectedLanguage(null), 4000); }
      if (checkBadWord(transcribedText)) { await handleBadWordViolation(transcribedText); setRecordingState('idle'); if (processingTimeoutRef.current) { clearTimeout(processingTimeoutRef.current); processingTimeoutRef.current = null; } return; }
      setInputText(prev => prev + (prev ? ' ' : '') + transcribedText);
      setRecordingState('idle');
      if (processingTimeoutRef.current) { clearTimeout(processingTimeoutRef.current); processingTimeoutRef.current = null; }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      if (processingTimeoutRef.current) { clearTimeout(processingTimeoutRef.current); processingTimeoutRef.current = null; }
      setRecordingState('idle');
      Alert.alert('Transcription Failed', error.message || 'Failed to transcribe voice.', [{ text: 'Try Again', onPress: () => startVoiceRecording() }, { text: 'Type Manually', style: 'cancel', onPress: () => setRecordingState('idle') }]);
    }
  };

  const buildDeepResearchPlan = useCallback((query: string): { title: string; steps: string[] } => {
    const q = query.trim();
    return {
      title: q.length > 50 ? q.slice(0, 50) + '...' : q,
      steps: [
        `Identify key aspects of "${q.slice(0, 40)}".`,
        'Survey primary and secondary sources.',
        'Collect supporting examples and evidence.',
        'Compare multiple perspectives and findings.',
        'Summarize findings in a structured report.',
      ],
    };
  }, []);

  const startDeepResearchCountdown = useCallback((query: string) => {
    if (deepResearchCountdownRef.current) clearInterval(deepResearchCountdownRef.current);
    setDeepResearchCountdown(58);
    const plan = buildDeepResearchPlan(query);
    setDeepResearchPlanTitle(plan.title);
    setDeepResearchPlanSteps(plan.steps);
    setDeepResearchPlanVisible(true);
    let remaining = 58;
    deepResearchCountdownRef.current = setInterval(() => {
      remaining -= 1;
      setDeepResearchCountdown(remaining);
      if (remaining <= 0) {
        if (deepResearchCountdownRef.current) clearInterval(deepResearchCountdownRef.current);
        setDeepResearchPlanVisible(false);
        runDeepResearchActual(query);
      }
    }, 1000);
  }, [buildDeepResearchPlan]);

  const runDeepResearchActual = useCallback(async (query: string) => {
    const steps = [
      { label: 'Searching the web...', done: false },
      { label: 'Reading top sources...', done: false },
      { label: 'Synthesizing findings...', done: false },
      { label: 'Formatting report...', done: false },
    ];
    setDeepResearchSteps([...steps]);
    setDeepResearchActive(true);
    setDeepResearchRunning(true);
    setSending(true);
    setGenerating(true);
    setThinkingMode('thinking');
    let conversationId = currentConversation?.id;
    if (!conversationId) {
      conversationId = await createConversation();
      if (!conversationId) { setDeepResearchActive(false); setDeepResearchRunning(false); setSending(false); setGenerating(false); return; }
    }
    const markStep = (i: number) => {
      setDeepResearchSteps(prev => prev.map((s, idx) => idx === i ? { ...s, done: true } : s));
    };
    try {
      await new Promise(r => setTimeout(r, 1200)); markStep(0);
      await new Promise(r => setTimeout(r, 900)); markStep(1);
      const deepPrompt = `You are performing deep research on: "${query}"\n\nPlease provide a comprehensive, well-structured research report with:\n1. Executive Summary\n2. Key Findings (with citations)\n3. Detailed Analysis\n4. Sources & References\n\nFormat sources at the end using [SOURCES] block format.\nBe thorough and cite specific facts.`;
      markStep(2);
      await sendMessage(deepPrompt, undefined, undefined, false, currentAIModel);
      markStep(3);
      setShowCompletionStatus(true);
      setTimeout(() => setShowCompletionStatus(false), 2000);
    } catch (e: any) {
      showAlert('Error', e?.message || 'Deep research failed');
    } finally {
      setDeepResearchActive(false);
      setDeepResearchRunning(false);
      setSending(false);
      setGenerating(false);
      setDeepResearchMode(false);
      setDeepResearchSteps([]);
    }
  }, [currentConversation, createConversation, sendMessage, currentAIModel, showAlert]);

  const runDeepResearch = useCallback(async (query: string) => {
    startDeepResearchCountdown(query);
  }, [startDeepResearchCountdown]);

  const handleSend = async () => {
    if (deepResearchMode && inputText.trim()) {
      const query = inputText.trim();
      setInputText(''); setSelectedMedia([]); clearDraft(); Keyboard.dismiss();
      runDeepResearch(query);
      return;
    }

    if (webSearchMode && inputText.trim()) {
      const query = inputText.trim();
      setInputText(''); setSelectedMedia([]); clearDraft(); Keyboard.dismiss();
      setWebSearchMode(false);
      setSending(true); setGenerating(true); setThinkingMode('thinking');
      let conversationId = currentConversation?.id;
      if (!conversationId) { conversationId = await createConversation(); if (!conversationId) { setSending(false); setGenerating(false); return; } }
      try {
        const webPrompt = `[WEB SEARCH MODE] Search the web and provide current, accurate information about: "${query}"\n\nInclude relevant sources in [SOURCES] block format at the end. Be comprehensive and cite specific URLs.`;
        await sendMessage(webPrompt, undefined, undefined, false, currentAIModel);
        setShowCompletionStatus(true); setTimeout(() => setShowCompletionStatus(false), 2000);
      } catch (e: any) { showAlert('Error', e?.message || 'Web search failed'); }
      finally { setSending(false); setGenerating(false); }
      return;
    }

    if (thinkingModeActive && inputText.trim()) {
      const query = inputText.trim();
      setInputText(''); setSelectedMedia([]); clearDraft(); Keyboard.dismiss();
      setThinkingModeActive(false);
      setSending(true); setGenerating(true); setThinkingMode('thinking');
      let conversationId = currentConversation?.id;
      if (!conversationId) { conversationId = await createConversation(); if (!conversationId) { setSending(false); setGenerating(false); return; } }
      try {
        const thinkPrompt = `[THINKING MODE] Think deeply and carefully before responding. Provide an extensive, well-reasoned, thorough response to: "${query}"\n\nTake your time, explore multiple angles, consider edge cases, and provide a comprehensive answer with detailed explanations.`;
        await sendMessage(thinkPrompt, undefined, undefined, false, currentAIModel);
        setShowCompletionStatus(true); setTimeout(() => setShowCompletionStatus(false), 2000);
      } catch (e: any) { showAlert('Error', e?.message || 'Thinking mode failed'); }
      finally { setSending(false); setGenerating(false); }
      return;
    }

    const currentText = inputText.trim();
    const currentMedia = [...selectedMedia];
    const currentEditingId = editingMessageId;

    if ((!currentText && currentMedia.length === 0) || sending) return;

    if (!currentEditingId && currentMedia.length === 0 && currentText) {
      const mathData = detectMathExpression(currentText);
      if (mathData) {
        // Math detected — send to AI and show inline calculator card (no modal)
        setInputText('');
        clearDraft();
        setCalcExpression(mathData.expression);
        setCalcResult(mathData.result);
        setSending(true);
        setGenerating(true);
        setThinkingMode('thinking');
        try {
          await sendMessage(currentText, undefined, undefined, false, currentAIModel);
          setShowCompletionStatus(true);
          setTimeout(() => setShowCompletionStatus(false), 2000);
        } catch (_e) {}
        finally { setSending(false); setGenerating(false); }
        return;
      }
    }

    const QUIZ_KEYWORDS = ['quiz', 'quizz', 'make me a quiz', 'give me a quiz', 'create a quiz', 'generate a quiz', 'test my knowledge', 'trivia', 'make quiz', 'create quiz', 'generate quiz', 'fe yon quiz', 'ban mwen yon quiz', 'kreye yon quiz'];
    const lowerTextForQuiz = currentText.toLowerCase();
    const isQuizRequest = QUIZ_KEYWORDS.some(kw => lowerTextForQuiz.includes(kw));
    if (isQuizRequest && !currentEditingId) {
      Keyboard.dismiss();
      setInputText(''); setSelectedMedia([]); clearDraft();
      setQuizGenerating(true);
      let detectedTopic = 'General Knowledge';
      const topicMatch = currentText.match(/(?:quiz|trivia)\s+(?:about|on|sur|sou|sobre)?\s*(.+)/i);
      if (topicMatch && topicMatch[1]?.trim().length > 2) detectedTopic = topicMatch[1].trim().replace(/[?!.]+$/, '');
      setSelectedQuizTopic(detectedTopic);
      try {
        const questions = await generateAIQuizQuestions(detectedTopic, selectedDifficulty);
        showInlineQuiz(questions);
      } catch (_e) {
        showInlineQuiz(generateQuizQuestions(detectedTopic));
      } finally { setQuizGenerating(false); }
      return;
    }

    const imageFiles = currentMedia.filter(m => m.type === 'image');
    const docFiles2 = currentMedia.filter(m => m.type !== 'image');

    if (isGuest) {
      if (docFiles2.length > 0) { setGuestLockFeature('file upload'); setGuestLockModal(true); return; }
      // Guest photo upload: 3 per 20 hours
      if (imageFiles.length > 0) {
        const now = Date.now();
        const inBlock = guestPhotoResetTime > 0 && now - guestPhotoResetTime < GUEST_PHOTO_BLOCK_MS;
        const currentPhotoCount = inBlock ? guestPhotoCount : 0;
        if (currentPhotoCount + imageFiles.length > GUEST_PHOTO_LIMIT) {
          const hoursLeft = inBlock ? Math.ceil((GUEST_PHOTO_BLOCK_MS - (now - guestPhotoResetTime)) / (1000 * 60 * 60)) : 0;
          showAlert('Photo Limit Reached', `Guest mode allows ${GUEST_PHOTO_LIMIT} photos every 20 hours. ${hoursLeft > 0 ? `Try again in ${hoursLeft}h or sign in.` : 'Please sign in to continue.'}`);
          return;
        }
        if (!inBlock) {
          const resetTime = now;
          setGuestPhotoResetTime(resetTime);
          setGuestPhotoCount(imageFiles.length);
          AsyncStorage.multiSet([['guest_photo_count', String(imageFiles.length)], ['guest_photo_reset_time', String(resetTime)]]).catch(() => {});
        } else {
          const newPhotoCount = currentPhotoCount + imageFiles.length;
          setGuestPhotoCount(newPhotoCount);
          AsyncStorage.setItem('guest_photo_count', String(newPhotoCount)).catch(() => {});
        }
      }
    }

    if (imageFiles.length > 0 && !isGuest && !isAdmin) {
      if (isPro || isUnlimited) {
        if (photoUploadCount + imageFiles.length > 10) { showAlert('Session Limit', `Pro/Plus plan allows 10 photo uploads per session.`); return; }
        setPhotoUploadCount(prev => prev + imageFiles.length);
      } else {
        const now = Date.now();
        const isNewWindow = photoUploadResetTime === 0 || now - photoUploadResetTime > 60 * 60 * 1000;
        const currentCount = isNewWindow ? 0 : photoUploadCount;
        if (currentCount + imageFiles.length > 4) { showAlert('Hourly Photo Limit', 'Free plan allows 4 photos per hour. Upgrade to Pro for 10/session.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Get Plus', onPress: () => router.push('/subscription') }]); return; }
        if (isNewWindow) setPhotoUploadResetTime(now);
        setPhotoUploadCount(currentCount + imageFiles.length);
      }
    }

    const docFiles = currentMedia.filter(m => m.type !== 'image');
    if (!isGuest && !isPro && !isUnlimited && !isAdmin && docFiles.length > 0) {
      if (docFiles.length > 1) { showAlert('File Limit', 'Free plan allows 1 file per message.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Get Plus', onPress: () => router.push('/subscription') }]); return; }
      const file = docFiles[0];
      if (file.size && file.size > 5 * 1024 * 1024) { showAlert('File Too Large', 'Free plan supports files up to 5MB.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Get Plus', onPress: () => router.push('/subscription') }]); return; }
    }

    if (isGuest) {
      const now24 = Date.now();
      if (guestMessageLimitReached && now24 - guestMessageLimitTime < GUEST_LOCK_DURATION_MS) {
        setGuestLoginModal(true);
        return;
      }
      if (guestMessageLimitReached && now24 - guestMessageLimitTime >= GUEST_LOCK_DURATION_MS) {
        setGuestMessageLimitReached(false); setGuestMessageCount(0); setGuestMessageLimitTime(0);
        AsyncStorage.multiRemove(['guest_msg_count','guest_msg_limit_time']).catch(()=>{});
      }
      if (guestMessageCount >= GUEST_MESSAGE_LIMIT) {
        const lockTime = Date.now();
        setGuestMessageLimitReached(true); setGuestMessageLimitTime(lockTime);
        AsyncStorage.multiSet([['guest_msg_limit_time', String(lockTime)],['guest_msg_count', String(guestMessageCount)]]).catch(()=>{});
        setMessageLimitModalVisible(true);
        return;
      }
    } else if (!currentEditingId && !canSendMessage() && sessionBonusMessages <= 0) {
      if (!user) { showAlert('Sign In Required', 'Sign in to start chatting with AI.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign In', onPress: () => router.push('/login') }]); }
      else { showAlert('Credits Required', 'You need credits to continue.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Buy Credits', onPress: () => router.push('/buy-coins') }]); }
      return;
    }

    let conversationId = currentConversation?.id;
    if (!conversationId) {
      if (isGuest) {
        conversationId = `guest-session-${Date.now()}`;
        // Create a local guest conversation so messages persist in this session
        const guestConv = { id: conversationId, title: 'Guest Chat', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        // We don't call createConversation for guests (it would create a DB entry)
        // Instead just set local state via sendMessage which handles guest mode
      }
      else {
        try { conversationId = await createConversation(); } catch (convErr) { console.log('[Home] createConversation error:', convErr); }
        if (!conversationId) conversationId = `local-${Date.now()}`;
      }
    }

    setInputText(''); setSelectedMedia([]); setEditingMessageId(null); clearDraft();
    // Clear previous Spotify results on new message
    setSpotifyResults([]);
    const lowerText = (currentText || '').toLowerCase();
    const isImageIntent = ['create a logo', 'create logo', 'generate logo', 'make a logo', 'design a logo', 'generate a logo', 'make me a logo', 'create an image', 'create image', 'generate image', 'make an image', 'generate a photo', 'create a photo', 'make a photo', 'generate a picture', 'make a picture', 'create a picture', 'draw me a', 'draw me an', 'create art', 'generate art', 'make art', 'kreye logo', 'fe logo', 'fe imaj', 'kreye yon imaj', 'kreye imaj', 'fè logo', 'fè yon logo', 'fè imaj', 'fè yon imaj', 'créer un logo', 'générer une image', 'créer une image', 'crear un logo', 'generar una imagen'].some(kw => lowerText.includes(kw));
    setThinkingMode(isImageIntent ? 'creating_image' : 'thinking');
    setSending(true);
    setGenerating(true);

    try {
      if (currentEditingId) {
        await updateMessageAndRegenerate(currentEditingId, currentText, currentAIModel);
        return;
      }

      let base64Image: string | undefined;
      let fileContextStr = '';
      let filePayloadArr: Array<{name: string; type: string; content: string}> = [];
      for (const media of currentMedia) {
        if (media.type === 'image') {
          if (!base64Image) {
            if (media.base64) { base64Image = media.base64; }
            else if (media.uri) { try { base64Image = await FileSystem.readAsStringAsync(media.uri, { encoding: FileSystem.EncodingType.Base64 }); } catch (e) {} }
          }
        } else if (media.type === 'document') {
          try {
            const rawContent = await FileSystem.readAsStringAsync(media.uri, { encoding: FileSystem.EncodingType.UTF8 });
            const preview = rawContent.slice(0, 12000);
            filePayloadArr.push({ name: media.name || 'document', type: media.mimeType || 'text/plain', content: preview + (rawContent.length > 12000 ? '\n...(truncated)' : '') });
            fileContextStr += `\n\n[File: ${media.name || 'document'}]\n${preview}`;
          } catch (e) {
            fileContextStr += `\n\n[Attached file: ${media.name || 'document'} (${media.mimeType || 'binary'})]`;
          }
        } else if (media.type === 'video') {
          fileContextStr += `\n\n[Video attached: ${media.name || 'video.mp4'} — please describe/analyze this video content]`;
        }
      }

      let finalText = (currentText || '') + fileContextStr;
      if (groupChatMode && groupCustomInstructions && groupRespondAuto) finalText = `[System instruction: ${groupCustomInstructions}]\n\n${finalText}`;
      if (groupChatMode && !groupRespondAuto) { setSending(false); setGenerating(false); return; }

      let replyContext = '';
      if (replyingTo) {
        const replyRole = replyingTo.role === 'assistant' ? 'Dawinix' : 'You';
        replyContext = `[Replying to ${replyRole}: "${(replyingTo.content || '').slice(0, 200)}"]\n`;
        setReplyingTo(null);
      }

      let prefixedText = replyContext + finalText;
      if (groupChatMode) {
        const gSys = groupCustomInstructions ? `You are Dawinix in group chat "${groupName}". Instructions: ${groupCustomInstructions}. Respond helpfully for group conversations.` : `You are Dawinix in group chat "${groupName}". Respond helpfully and concisely.`;
        prefixedText = `[SYSTEM: ${gSys}]\n\n${prefixedText}`;
      }

      try {
        const behaviorRules = await loadBehaviorPresets();
        if (behaviorRules.length > 0) {
          const rulesBlock = `[SYSTEM RULES:\n${behaviorRules.map((r, i) => `${i + 1}. ${r}`).join('\n')}]\n\n`;
          prefixedText = rulesBlock + prefixedText;
        }
      } catch (_e) {}

      await sendMessage(prefixedText, filePayloadArr.length > 0 ? filePayloadArr : undefined, base64Image, false, currentAIModel);
      setShowCompletionStatus(true);
      setTimeout(() => setShowCompletionStatus(false), 2000);
      // Spotify search if active and music-related
      if (spotifyActive && isMusicQuery(currentText)) {
        searchSpotify(currentText);
      }
      if (user && !isUnlimited && !isAdmin) {
        if (sessionBonusMessages > 0) setSessionBonusMessages(prev => prev - 1);
        else await incrementMessageCount();
        const convMsgs = (messages || []).length + 1;
        const dismissed = messageLimitDismissedAtRef.current;
        const shouldShow = convMsgs >= 50 && (dismissed === 0 || convMsgs - dismissed >= 20);
        if (shouldShow) setMessageLimitModalVisible(true);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        showAlert('Error', error?.message || 'Failed to send message');
        setInputText(currentText);
        setSelectedMedia(currentMedia);
      }
    } finally {
      setSending(false);
      setGenerating(false);
      if (isGuest) {
        const newMsgCount = guestMessageCount + 1;
        setGuestMessageCount(newMsgCount);
        AsyncStorage.setItem('guest_msg_count', String(newMsgCount)).catch(()=>{});
        if (newMsgCount >= GUEST_MESSAGE_LIMIT) {
          const lockTime = Date.now();
          setGuestMessageLimitReached(true); setGuestMessageLimitTime(lockTime);
          AsyncStorage.multiSet([['guest_msg_limit_time',String(lockTime)],['guest_msg_count',String(newMsgCount)]]).catch(()=>{});
          setTimeout(() => setMessageLimitModalVisible(true), 800);
        }
      }
    }
  };

  const handleStopGeneration = useCallback(() => {
    // Cancel AI generation — keep users message visible, only remove empty AI placeholder
    cancelSendMessage();
    setSending(false);
    setGenerating(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [cancelSendMessage]);

  // ── Spotify music search ─────────────────────────────────────────────────
  const MUSIC_KEYWORDS_SPOTIFY = [
    'music', 'song', 'playlist', 'play', 'listen', 'artist', 'album', 'track',
    'beat', 'jazz', 'rock', 'pop', 'hip hop', 'rap', 'classical', 'acoustic',
    'spotify', 'tune', 'banger', 'vibe', 'musique', 'chanson', 'mizik', 'chante',
    'recommend', 'suggest music', 'find music', 'search music',
  ];

  const isMusicQuery = useCallback((text: string): boolean => {
    const lower = text.toLowerCase();
    return MUSIC_KEYWORDS_SPOTIFY.some(k => lower.includes(k));
  }, []);

  const searchSpotify = useCallback(async (query: string) => {
    setSpotifySearching(true);
    try {
      // Try to get a valid (possibly refreshed) access token
      const storedToken = await (async () => {
        try {
          const tokenRaw = await AsyncStorage.getItem('spotify_access_token');
          const expiryRaw = await AsyncStorage.getItem('spotify_token_expiry');
          if (!tokenRaw) return null;
          const expiry = expiryRaw ? parseInt(expiryRaw, 10) : 0;
          if (Date.now() < expiry - 120_000) return tokenRaw;
          // Refresh
          const refreshRaw = await AsyncStorage.getItem('spotify_refresh_token');
          if (!refreshRaw) return null;
          const { data: rd, error: re } = await supabase.functions.invoke('spotify-connect', {
            body: { action: 'refresh_token', refreshToken: refreshRaw },
          });
          if (re || !rd?.access_token) return null;
          const newExpiry = Date.now() + (rd.expires_in || 3600) * 1000;
          await AsyncStorage.multiSet([
            ['spotify_access_token', rd.access_token],
            ['spotify_token_expiry', String(newExpiry)],
            ...(rd.refresh_token ? [['spotify_refresh_token', rd.refresh_token] as [string, string]] : []),
          ]);
          return rd.access_token as string;
        } catch { return null; }
      })();

      const { data, error } = await supabase.functions.invoke('spotify-connect', {
        body: { action: 'search', query, ...(storedToken ? { accessToken: storedToken } : {}) },
      });
      if (!error && data?.results && Array.isArray(data.results)) {
        setSpotifyResults(data.results);
      }
    } catch (_e) {}
    finally { setSpotifySearching(false); }
  }, [supabase]);

  const connectedAppsList: ConnectedApp[] = spotifyConnected
    ? [{ id: 'spotify', name: 'Spotify', description: 'Music and podcasts for you', color: '#1DB954' }]
    : [];

  const handleCancelGeneration = useCallback(() => { setGenerating(false); }, []);

  const generateQuizQuestions = (_topic: string): QuizQuestion[] => [
    { question: 'What is the capital of France?', options: ['Berlin', 'Madrid', 'Rome', 'Paris'], answer: 3, explanation: 'Paris is the capital and largest city of France.' },
    { question: 'Chemical symbol for Gold?', options: ['Go', 'Gd', 'Au', 'Ag'], answer: 2, explanation: 'Au comes from the Latin word Aurum.' },
    { question: 'How many continents are there?', options: ['5', '6', '7', '8'], answer: 2, explanation: 'There are 7 continents on Earth.' },
    { question: 'Closest planet to the Sun?', options: ['Venus', 'Mercury', 'Earth', 'Mars'], answer: 1, explanation: 'Mercury is the closest planet to the Sun.' },
    { question: 'What is 5 x 6?', options: ['25', '30', '35', '36'], answer: 1, explanation: 'Basic multiplication: 5 times 6 equals 30.' },
    { question: 'Who wrote Romeo and Juliet?', options: ['Dickens', 'Hemingway', 'Tolkien', 'Shakespeare'], answer: 3, explanation: 'William Shakespeare wrote this famous play.' },
    { question: 'What gas do plants absorb?', options: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'], answer: 2, explanation: 'Plants absorb CO2 during photosynthesis.' },
    { question: 'Largest ocean?', options: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], answer: 3, explanation: 'The Pacific Ocean is the largest and deepest.' },
    { question: 'Boiling point of water (celsius)?', options: ['90C', '95C', '100C', '110C'], answer: 2, explanation: 'Water boils at 100C at sea level.' },
    { question: 'Fastest land animal?', options: ['Lion', 'Cheetah', 'Horse', 'Leopard'], answer: 1, explanation: 'The cheetah can run up to 120 km/h.' },
  ];

  const fetchQuizHistory = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data } = await supabase.from('quiz_scores').select('topic, difficulty, score, total, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10);
      if (data) setQuizHistory(data as QuizHistoryEntry[]);
    } catch (_e) {}
  }, [user?.id, supabase]);

  useEffect(() => {
    if (quizMode && user?.id) fetchQuizHistory();
  }, [quizMode, user?.id]);

  const generateAIQuizQuestions = async (topic: string, difficulty: string = 'Medium'): Promise<QuizQuestion[]> => {
    const topicLabel = (topic || 'General Knowledge').trim();
    // Always call the real edge function — it already has internal fallback
    try {
      const { data, error } = await supabase.functions.invoke('generate-quiz', {
        body: { topic: topicLabel, difficulty, count: 10 },
      });
      if (error) {
        console.warn('[Quiz] Edge function error:', error);
        return generateQuizQuestions(topicLabel);
      }
      const questions: QuizQuestion[] = data?.questions;
      if (!Array.isArray(questions) || questions.length === 0) {
        console.warn('[Quiz] No questions returned, using fallback');
        return generateQuizQuestions(topicLabel);
      }
      // Always return a fresh set — shuffle lightly so repeated calls give variety
      const shuffled = [...questions].sort(() => Math.random() - 0.5);
      return shuffled;
    } catch (err) {
      console.warn('[Quiz] Unexpected error, using fallback:', err);
      return generateQuizQuestions(topicLabel);
    }
  };

  const handleLaunchQuiz = async (topic: string) => {
    setQuizTopicVisible(false);
    setQuizConnectDetailVisible(false);
    setQuizGenerating(true);
    Keyboard.dismiss();
    try {
      const questions = await generateAIQuizQuestions(topic, selectedDifficulty);
      showInlineQuiz(questions);
    } catch (e) {
      showInlineQuiz(generateQuizQuestions(topic));
    } finally { setQuizGenerating(false); }
  };

  const showInlineQuiz = useCallback((questions: QuizQuestion[]) => {
    setInlineQuizQuestions(questions);
    setInlineQuizVisible(true);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
  }, []);

  const handleQuizViewResults = async (answers: any[], questions: QuizQuestion[]) => {
    setInlineQuizVisible(false);
    const correct = answers.filter(a => a.correct).length;
    const topic = customTopicInput.trim() || selectedQuizTopic || 'General Knowledge';
    if (user?.id) {
      try {
        await supabase.from('quiz_scores').insert({ user_id: user.id, topic, difficulty: selectedDifficulty, score: correct, total: questions.length });
        fetchQuizHistory();
      } catch (_e) {}
    }
    const resultLines = questions.map((q, i) => {
      const ans = answers.find((a: any) => a.questionIndex === i);
      const chosen = ans ? q.options[ans.chosenIndex] : 'Skipped';
      const isCorrect = ans?.correct;
      return `${i + 1}. **${q.question}**\n${isCorrect ? '\u2705' : '\u274c'} ${chosen}${!isCorrect ? ` (Correct: ${q.options[q.answer]})` : ''}`;
    }).join('\n');
    const pct = Math.round((correct / questions.length) * 100);
    const summaryPrompt = `The user scored ${correct}/${questions.length} (${pct}%) on a quiz about ${topic}. Present results clearly and encouragingly. Here are the answers:\n\n${resultLines}\n\nAsk if they want to try a harder quiz or different topic.`;
    try {
      setSending(true); setGenerating(true);
      await sendMessage(summaryPrompt, undefined, undefined, false, currentAIModel);
    } catch (_e) {}
    finally { setSending(false); setGenerating(false); }
  };

  const handleHarderQuiz = () => {
    setInlineQuizVisible(false);
    setInputText('Make me a harder quiz');
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleTryAnotherQuiz = () => {
    setSelectedQuizTopic('');
    setCustomTopicInput('');
    setQuizTopicVisible(true);
  };

  const handleNextQuizInline = useCallback(async () => {
    const topic = customTopicInput.trim() || selectedQuizTopic || 'General Knowledge';
    setQuizGenerating(true);
    try {
      // Call real edge function for a fresh new quiz
      const questions = await generateAIQuizQuestions(topic, selectedDifficulty);
      // Force re-render with new questions array reference
      setInlineQuizQuestions([]);
      setTimeout(() => setInlineQuizQuestions([...questions]), 50);
    } catch (_e) {
      setInlineQuizQuestions([...generateQuizQuestions(topic)]);
    } finally { setQuizGenerating(false); }
  }, [customTopicInput, selectedQuizTopic, selectedDifficulty]);

  const handleEditMessage = useCallback((messageId: string, content: string) => { setEditingMessageId(messageId); setInputText(content); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }, []);
  const handleCancelEdit = useCallback(() => { setEditingMessageId(null); setInputText(''); }, []);
  const handleMediaPicked = useCallback((media: MediaFile[]) => { if (media.length > 5) { showAlert('Limit', 'You can select a maximum of 5 files'); return; } setSelectedMedia(media); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }, [showAlert]);
  const removeMedia = useCallback((index: number) => { setSelectedMedia(prev => prev.filter((_, i) => i !== index)); }, []);
  const handleAIModelSelect = useCallback(async (model: AIModelKey) => { setCurrentAIModel(model); await updateSetting('preferredAiModel', model); }, [updateSetting]);
  const handleSelectAIMode = useCallback((mode: AIMode) => {
    setCurrentAIMode(mode);
    const modelMap: Record<AIMode, AIModelKey> = { 'instant': 'gemini', 'deep-thinking': 'gemini-2.0-flash-exp', 'agent': 'onspace-ai' };
    setCurrentAIModel(modelMap[mode]);
  }, []);

  const handleNewChat = useCallback(async () => {
    if ((messages || []).length > 0) await createConversation();
    setInputText(''); setSelectedMedia([]); setEditingMessageId(null);
    setGroupChatMode(false); setTemporaryChatMode(false);
    if (isPro || isUnlimited) setPhotoUploadCount(0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [createConversation, messages, isPro, isUnlimited]);

  const handleDeleteConversation = useCallback(async () => {
    if (!currentConversation) return;
    try { await deleteConversation(currentConversation.id); await createConversation(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
    catch (error) { showAlert('Error', 'Failed to delete conversation'); }
  }, [currentConversation, deleteConversation, createConversation, showAlert]);

  const handleRenameConversation = useCallback(async (newTitle: string) => {
    if (!currentConversation || !newTitle.trim()) return;
    await updateConversationTitle(currentConversation.id, newTitle.trim());
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [currentConversation, updateConversationTitle]);

  const handleShareConversation = useCallback(async () => {
    if (!currentConversation) return;
    try {
      const safeMessages = messages || [];
      const shareContent = safeMessages.map(m => `${m.role === 'user' ? 'You' : 'AI'}: ${m.content}`).join('\n\n');
      await Share.share({ message: shareContent, title: currentConversation.title || 'AI Conversation' });
    } catch (error) {}
  }, [currentConversation, messages]);

  const handleArchiveConversation = useCallback(async () => {
    if (!currentConversation) return;
    try { await archiveConversation(currentConversation.id); await createConversation(); showAlert('Archived', 'Chat archived. View it in Settings > Archived Chats'); }
    catch (e) { showAlert('Error', 'Failed to archive chat'); }
  }, [currentConversation, archiveConversation, createConversation, showAlert]);

  const handleLikeMessage = useCallback(async (messageId: string) => {
    const current = messageLikes[messageId];
    const isAlreadyLiked = current === 'like';
    setMessageLikes(prev => ({ ...prev, [messageId]: isAlreadyLiked ? null : 'like' }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!user?.id) return;
    try {
      if (isAlreadyLiked) {
        await supabase.from('message_likes').delete().eq('message_id', messageId).eq('user_id', user.id).eq('like_type', 'like');
      } else {
        await supabase.from('message_likes').delete().eq('message_id', messageId).eq('user_id', user.id);
        await supabase.from('message_likes').insert({ message_id: messageId, user_id: user.id, like_type: 'like' });
      }
    } catch (_e) { setMessageLikes(prev => ({ ...prev, [messageId]: current })); }
  }, [messageLikes, user?.id, supabase]);

  const handleUnlikeMessage = useCallback(async (messageId: string) => {
    const current = messageLikes[messageId];
    const isAlreadyDisliked = current === 'dislike';
    setMessageLikes(prev => ({ ...prev, [messageId]: isAlreadyDisliked ? null : 'dislike' }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!user?.id) return;
    try {
      if (isAlreadyDisliked) {
        await supabase.from('message_likes').delete().eq('message_id', messageId).eq('user_id', user.id).eq('like_type', 'dislike');
      } else {
        await supabase.from('message_likes').delete().eq('message_id', messageId).eq('user_id', user.id);
        await supabase.from('message_likes').insert({ message_id: messageId, user_id: user.id, like_type: 'dislike' });
        setTimeout(() => {
          router.push({ pathname: '/feedback', params: { messageId, conversationId: currentConversation?.id || '' } } as any);
        }, 150);
      }
    } catch (_e) { setMessageLikes(prev => ({ ...prev, [messageId]: current })); }
  }, [messageLikes, user?.id, supabase, router, currentConversation?.id]);

  const handleCopyMessage = useCallback(async (content: string) => { await Clipboard.setStringAsync(content); showAlert('Copied', 'Message copied to clipboard'); }, [showAlert]);

  const handleAddPeople = useCallback(async () => {
    setConversationMenuVisible(false);
    showAlert('Adding people...', 'Setting up group chat...');
    await new Promise(r => setTimeout(r, 1200));
    setGroupChatMode(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [showAlert]);

  const handleStartGroupChat = useCallback(async () => {
    setGroupStartModalVisible(false);
    setGroupChatMode(true);
    setTemporaryChatMode(false);
    const newGroupName = 'New group chat';
    setGroupName(newGroupName);
    try {
      const convId = await createConversation();
      if (convId) { await updateConversationTitle(convId, newGroupName); selectConversation(convId); }
    } catch (e) { console.log('[GroupChat] Failed to create conversation:', e); }
    setInputText(''); setSelectedMedia([]); setEditingMessageId(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [createConversation, updateConversationTitle, selectConversation]);

  const handleSaveGroupName = useCallback(async (newName: string) => {
    if (!newName.trim()) { setRenameGroupVisible(false); return; }
    setGroupName(newName.trim());
    setRenameGroupVisible(false);
    if (currentConversation?.id) await updateConversationTitle(currentConversation.id, newName.trim());
  }, [currentConversation, updateConversationTitle]);

  const handleDeleteGroup = useCallback(() => { setDeleteGroupConfirm(true); }, []);

  const handleUserMsgPress = useCallback((item: any, pageY: number) => {
    if (groupChatMode) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMsgMenuMsg(item);
    setMsgMenuPageY(pageY);
    setMsgMenuVisible(true);
  }, [groupChatMode]);

  const parseImageSearchResults = useCallback((content: string): { cleanContent: string; searchImages: Array<{ url: string; title?: string; source?: string }> | null } => {
    const match = content.match(/\[IMAGE_SEARCH_RESULTS:([\s\S]*?)\]/);
    if (!match) return { cleanContent: content, searchImages: null };
    try {
      const parsed = JSON.parse(match[1]);
      const cleanContent = content.replace(/\[IMAGE_SEARCH_RESULTS:[\s\S]*?\]/, '').trim();
      return { cleanContent, searchImages: Array.isArray(parsed) ? parsed : null };
    } catch {
      return { cleanContent: content, searchImages: null };
    }
  }, []);

  const displayMessages = isSearchMode && searchQuery ? filteredMessages : (messages || []);

  // Compute last user message that has a math expression (for inline calculator)
  const lastMathMessage = useMemo(() => {
    const msgs = displayMessages || [];
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i];
      if (m.role === 'user' && detectMathExpression(m.content)) return m;
    }
    return null;
  }, [displayMessages]);

  const renderMessage = useCallback(({ item }: { item: any }) => {
    const isStreaming = streamingMessageId === item.id;
    // Show calculator only for the latest math expression (inline, no modal)
    const mathData = item.role === 'user' && item.id === lastMathMessage?.id
      ? detectMathExpression(item.content)
      : null;
    const { cleanContent: msgCleanContent, searchImages: msgSearchImages } = item.role === 'assistant'
      ? parseImageSearchResults(item.content || '')
      : { cleanContent: item.content, searchImages: null };
    const imageUrlMatch = item.role === 'assistant'
      ? (msgCleanContent || '').match(/https?:\/\/[^\s"')]+\.(?:jpg|jpeg|png|webp|gif)/i)
      : null;
    const detectedImageUrl: string | null = imageUrlMatch ? imageUrlMatch[0] : (item.imageUrl || item.image_url || null);
    const alreadySaved = detectedImageUrl ? savedImageUrls.has(detectedImageUrl) : false;
    const isSavingThis = savingImageId === item.id;
    const isUserMsg = item.role === 'user';
    // Messages with image/file/video attachments cannot be edited
    const hasMediaAttachment = !!(item.imageUrl || item.image_url || item.file_url ||
      (item.content && (item.content.includes('[Attached file:') || item.content.includes('[Video attached:'))));

    const displayItem = msgSearchImages ? { ...item, content: msgCleanContent } : item;

    return (
      <View>
        <Pressable
          onPress={isUserMsg && !groupChatMode ? (e: any) => handleUserMsgPress(item, e.nativeEvent.pageY) : undefined}
          onLongPress={!isUserMsg ? () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); Clipboard.setStringAsync(item.content || ''); showAlert('Copied', 'Message copied'); } : undefined}
          delayLongPress={450}
        >
          <MessageItem
            message={displayItem}
            onCancel={handleCancelGeneration}
            onEdit={hasMediaAttachment ? undefined : handleEditMessage}
            onCopy={() => handleCopyMessage(item.content)}
            isGenerating={isStreaming || (generating && item.id === (messages || [])[(messages || []).length-1]?.id)}
            streaming={isStreaming}
            streamingSpeed={isStreaming ? 18 : 0}
            isOffline={isOffline}
            isImageTask={thinkingMode === 'creating_image' && (generating || isStreaming)}
            isAdmin={isAdmin}
            onReply={groupChatMode ? (msg) => setReplyingTo(msg) : undefined}
            onDelete={(msgId) => {}}
            onChunkRendered={() => { if (isAtBottom) flatListRef.current?.scrollToEnd({ animated: false }); }}
            isLiked={messageLikes[item.id] === 'like'}
            isUnliked={messageLikes[item.id] === 'dislike'}
            onLike={handleLikeMessage}
            onUnlike={handleUnlikeMessage}
            onOpenActions={handleOpenMessageActions}
          />
        </Pressable>
        {msgSearchImages && msgSearchImages.length > 0 ? (
          <View style={{ marginTop: 4, marginBottom: 8 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingBottom: 4 }}>
              {msgSearchImages.slice(0, 10).map((img, imgIdx) => (
                <View key={`search-img-${imgIdx}`} style={{ width: 160, borderRadius: 16, overflow: 'hidden', backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 3 }}>
                  <TouchableOpacity activeOpacity={0.88} onPress={() => { Clipboard.setStringAsync(img.url).catch(() => {}); }}>
                    <ExpoImage source={{ uri: img.url }} style={{ width: 160, height: 120 }} contentFit="cover" transition={200} />
                  </TouchableOpacity>
                  <View style={{ padding: 8 }}>
                    {img.title ? <Text style={{ color: isDark ? '#FFF' : '#000', fontSize: 11, fontWeight: '600', lineHeight: 15 }} numberOfLines={2}>{img.title}</Text> : null}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                      {img.source ? <Text style={{ color: colors.textSecondary, fontSize: 10 }} numberOfLines={1}>{img.source}</Text> : <View />}
                      <TouchableOpacity
                        onPress={async () => {
                          const media: MediaFile = { type: 'image', uri: img.url, name: img.title || 'photo.jpg', mimeType: 'image/jpeg' };
                          setSelectedMedia(prev => [...prev, media]);
                          inputRef.current?.focus();
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                        style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: accentColor + '22', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: accentColor + '44' }}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Ionicons name="send" size={12} color={accentColor} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
            <Text style={{ color: colors.textSecondary, fontSize: 11, paddingHorizontal: 16, marginTop: 4 }}>
              {msgSearchImages.length} photo{msgSearchImages.length !== 1 ? 's' : ''} • Tap send to add to message
            </Text>
          </View>
        ) : null}
        {mathData ? (
          <CalculatorCard
            expression={mathData.expression}
            result={mathData.result}
          />
        ) : null}
        {item.role === 'assistant' && detectedImageUrl && user?.id ? (
          <View style={{ paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: alreadySaved ? 'rgba(48,209,88,0.12)' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'), borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: alreadySaved ? 'rgba(48,209,88,0.35)' : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)') }}
              onPress={() => !alreadySaved && handleSaveToMyImages(detectedImageUrl, item.id)}
              disabled={alreadySaved || isSavingThis}
              activeOpacity={0.75}
            >
              {isSavingThis ? <ActivityIndicator size="small" color="#30D158" /> : <Ionicons name={alreadySaved ? 'checkmark-circle' : 'image-outline'} size={15} color={alreadySaved ? '#30D158' : colors.textSecondary} />}
              <Text style={{ fontSize: 13, fontWeight: '600', color: alreadySaved ? '#30D158' : colors.textSecondary }}>{alreadySaved ? 'Saved' : 'Save'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' }}
              onPress={async () => {
                const media: MediaFile = { type: 'image', uri: detectedImageUrl, name: 'ai-image.jpg', mimeType: 'image/jpeg' };
                setSelectedMedia(prev => [...prev, media]);
                inputRef.current?.focus();
              }}
              activeOpacity={0.75}
            >
              <Ionicons name="share-outline" size={15} color={accentColor} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: accentColor }}>Send</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  }, [streamingMessageId, handleCancelGeneration, handleEditMessage, handleCopyMessage, isOffline, isAtBottom, savedImageUrls, savingImageId, handleSaveToMyImages, user?.id, isDark, colors, groupChatMode, handleUserMsgPress, generating, messages, thinkingMode, isAdmin, showAlert]);

  const renderInlineMediaPreviews = useCallback(() => {
    if (selectedMedia.length === 0) return null;

    if (selectedMedia.length === 1 && selectedMedia[0].type === 'image') {
      const media = selectedMedia[0];
      return (
        <View style={{ marginBottom: 8, flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ position: 'relative' }}>
            <View style={{ width: 72, height: 72, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.1)' }}>
              <ExpoImage source={{ uri: media.uri }} style={{ width: 72, height: 72 }} contentFit="cover" />
            </View>
            <TouchableOpacity style={{ position: 'absolute', top: -7, right: -7, width: 22, height: 22, borderRadius: 11, backgroundColor: isDark ? '#555' : '#888', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: isDark ? '#1C1C1E' : '#F0F0F5', zIndex: 10 }} onPress={() => removeMedia(0)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Ionicons name="close" size={11} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (selectedMedia.length === 1 && selectedMedia[0].type === 'document') {
      const media = selectedMedia[0];
      return (
        <View style={{ marginBottom: 8 }}>
          <View style={{ position: 'relative', alignSelf: 'flex-start' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#2A2A2E' : '#EBEBF0', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8, gap: 8, maxWidth: 220, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)' }}>
              <View style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: isDark ? '#3A3A3C' : '#D1D1D6', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="document-text" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 12, color: colors.text, fontWeight: '600' }} numberOfLines={1}>{media.name || 'File'}</Text>
                <Text style={{ fontSize: 10, color: colors.textSecondary, marginTop: 2 }}>{(media.mimeType || '').split('/')[1]?.toUpperCase() || 'FILE'}</Text>
              </View>
            </View>
            <TouchableOpacity style={{ position: 'absolute', top: -7, right: -7, width: 22, height: 22, borderRadius: 11, backgroundColor: isDark ? '#555' : '#888', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: isDark ? '#1C1C1E' : '#F0F0F5', zIndex: 10 }} onPress={() => removeMedia(0)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Ionicons name="close" size={11} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View style={{ marginBottom: 8 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingBottom: 2 }}>
          {selectedMedia.map((media, index) => (
            <View key={`${media.uri}-${index}`} style={{ position: 'relative' }}>
              {media.type === 'image' ? (
                <View style={{ width: 64, height: 64, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.1)' }}>
                  <ExpoImage source={{ uri: media.uri }} style={{ width: 64, height: 64 }} contentFit="cover" />
                </View>
              ) : media.type === 'video' ? (
                <View style={{ width: 64, height: 64, borderRadius: 10, backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }}>
                  <Ionicons name="videocam" size={24} color={colors.textSecondary} />
                </View>
              ) : (
                <View style={{ width: 64, height: 64, borderRadius: 10, backgroundColor: isDark ? '#2A2A2E' : '#EBEBF0', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)' }}>
                  <Ionicons name="document-text" size={24} color={colors.primary} />
                  <Text style={{ fontSize: 8, color: colors.textSecondary, marginTop: 2, fontWeight: '700' }} numberOfLines={1}>{(media.name || '').slice(0, 6)}</Text>
                </View>
              )}
              <TouchableOpacity style={{ position: 'absolute', top: -7, right: -7, width: 20, height: 20, borderRadius: 10, backgroundColor: isDark ? '#555' : '#888', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: isDark ? '#1C1C1E' : '#F0F0F5', zIndex: 10 }} onPress={() => removeMedia(index)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Ionicons name="close" size={9} color="#FFF" />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }, [selectedMedia, removeMedia, colors, isDark]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, paddingTop: Platform.select({ ios: insets.top, android: StatusBar.currentHeight || 0, default: 0 }) },
    headerEmpty: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.background },
    upgradeBtn: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, gap: 4 },
    upgradeBtnText: { fontWeight: '600' },
    headerEmptyRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerChat: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, backgroundColor: colors.background, gap: 10 },
    headerChatLeft: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    headerChatTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.text },
    headerChatRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    blurOverlayContainer: { ...StyleSheet.absoluteFillObject, zIndex: 9999, justifyContent: 'center', alignItems: 'center' },
    blurView: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
    blurContent: { alignItems: 'center', justifyContent: 'center' },
    blurText: { fontSize: 24, fontWeight: 'bold', color: 'white', marginTop: 16 },
    messagesContainer: { flex: 1 },
    inputContainer: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 10, paddingBottom: Platform.select({ ios: insets.bottom + 6, android: insets.bottom + 6, default: 6 }), paddingTop: 6, gap: 8, backgroundColor: Platform.OS === 'ios' ? 'transparent' : colors.background },
    inputWrapper: { flex: 1, borderRadius: 28, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8, minHeight: 50, maxHeight: 420, borderWidth: 1 },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32 },
    input: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: 0, maxHeight: 160, minHeight: 22, lineHeight: 22 },
    recordingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36 },
    recordingDuration: { color: '#FF3B30', fontSize: 13, fontWeight: '600', minWidth: 36 },
    addBtn: { alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
    addBtnCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
    micBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    sendButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
    voiceOrbBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.35, shadowRadius: 5, elevation: 4 },
    emptyState: { flex: 1 },
    loadingContainer: { padding: Spacing.md, alignItems: 'center' },
    offlineBanner: { backgroundColor: '#FF9500', padding: Spacing.xs, alignItems: 'center' },
    offlineText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
    limitBanner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderTopWidth: 1, gap: Spacing.sm },
    limitBannerButton: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full },
    suggestionCard: { backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7', borderRadius: 14, padding: 12, width: 148, minHeight: 64, justifyContent: 'flex-end' },
    suggestionTitle: { color: colors.text, fontWeight: '700', fontSize: 13, marginBottom: 2 },
    suggestionSub: { color: colors.textSecondary, fontSize: 11, lineHeight: 15 },
    groupActionBtn: { borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(0,122,255,0.4)' },
    groupActionBtnText: { color: '#007AFF', fontSize: 15, fontWeight: '600' },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, margin: Spacing.md, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.lg, height: 40 },
    searchInput: { flex: 1, fontSize: 16, color: colors.text, marginLeft: Spacing.sm },
  }), [colors, insets, isDark]);

  const showSendButton = inputText.trim().length > 0 || selectedMedia.length > 0;
  // + button goes OUTSIDE input when keyboard is visible (regardless of text), inside when keyboard hidden
  const showPlusOutside = isKeyboardVisible && !editingMessageId && !isRecording && !isProcessing;
  const isGuestLocked = isGuest && guestMessageLimitReached && (Date.now() - guestMessageLimitTime < GUEST_LOCK_DURATION_MS);
  const isRecording = recordingState === 'recording';
  const isProcessing = recordingState === 'processing';
  const accentColor = settings.accentColor || colors.primary;
  const hasMessages = (messages || []).length > 0;

  const suggestionAnims = useRef((smartSuggestions.length > 0 ? smartSuggestions : [1, 2, 3, 4]).map(() => ({
    opacity: new Animated.Value(0),
    translateY: new Animated.Value(20),
  }))).current;

  useEffect(() => {
    if (!hasMessages && smartSuggestions.length > 0) {
      suggestionAnims.forEach(a => { a.opacity.setValue(0); a.translateY.setValue(20); });
      const anims = suggestionAnims.map((a, i) =>
        Animated.parallel([
          Animated.timing(a.opacity, { toValue: 1, duration: 260, delay: i * 60, useNativeDriver: true }),
          Animated.timing(a.translateY, { toValue: 0, duration: 260, delay: i * 60, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ])
      );
      Animated.stagger(60, anims).start();
    }
  }, [hasMessages, smartSuggestions]);

  const handleSuggestionTap = useCallback(async (suggestion: { title: string; sub: string }) => {
    const text = `${suggestion.title} - ${suggestion.sub}`;
    let conversationId = currentConversation?.id;
    if (!conversationId) { conversationId = await createConversation(); if (!conversationId) return; }
    setSending(true); setGenerating(true); setInputText(''); setThinkingMode('thinking');
    try {
      await sendMessage(text, undefined, undefined, false, currentAIModel);
      setShowCompletionStatus(true); setTimeout(() => setShowCompletionStatus(false), 2000);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) { showAlert('Error', e?.message || 'Failed to send'); setInputText(text); }
    finally { setSending(false); setGenerating(false); }
  }, [currentConversation, createConversation, sendMessage, currentAIModel, showAlert]);

  const userName = user?.email?.split('@')[0] || 'You';
  const showOfflineScreen = !isConnected && !isPro && !isUnlimited;

  if (showOfflineScreen) {
    return (
      <View style={{ flex: 1, backgroundColor: isDark ? '#000' : '#FFF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={isDark ? '#000' : '#FFF'} />
        <View style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <Ionicons name="logo-apple" size={52} color={isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.15)'} />
        </View>
        <View style={{ paddingBottom: 60, alignItems: 'center', width: '100%' }}>
          <Text style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)', fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 20 }}>
            {isGuest ? 'An internet connection is required to use Dawinix. Please check your connection.' : 'A connection is required for the free plan. Upgrade to Pro for offline access.'}
          </Text>
          {!isGuest ? (
            <TouchableOpacity style={{ backgroundColor: colors.primary, borderRadius: 30, paddingHorizontal: 32, paddingVertical: 14, marginBottom: 12, width: '100%', alignItems: 'center' }} onPress={() => router.push('/subscription')}>
              <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700' }}>Upgrade for Offline Access</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={{ paddingVertical: 12, width: '100%', alignItems: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', borderRadius: 30 }} onPress={() => setIsConnected(true)}>
            <Text style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)', fontSize: 15, fontWeight: '600' }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <GestureDetector gesture={swipeGesture ?? Gesture.Pan()}>
          <View style={{ flex: 1 }}>
            <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
              <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

              {isOfflineMode ? (
                <View style={{ backgroundColor: '#FF9500', paddingVertical: 4, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="cloud-offline-outline" size={14} color="#FFF" />
                  <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '600', flex: 1 }}>Offline — showing cached chats</Text>
                  <TouchableOpacity onPress={() => refreshConversations()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '700' }}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              {isOffline ? (
                <View style={styles.offlineBanner}>
                  <Text style={styles.offlineText}>No connection - some features unavailable</Text>
                </View>
              ) : null}

              {user && !isUnlimited && !isAdmin && !canSendMessage() && sessionBonusMessages <= 0 ? (
                <View style={[styles.limitBanner, { backgroundColor: colors.surface, borderColor: colors.border, flexWrap: 'wrap' }]}>
                  <View style={{ flex: 1, minWidth: 160 }}>
                    <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>Daily limit reached</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>{timeUntilMidnight ? `Resets in ${timeUntilMidnight}` : 'Resets at midnight'}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                    {!hasUsedNewChatBonus ? (
                      <TouchableOpacity style={[styles.limitBannerButton, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]} onPress={async () => { setHasUsedNewChatBonus(true); setSessionBonusMessages(100); await createConversation(); setInputText(''); setSelectedMedia([]); }}>
                        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>New Chat</Text>
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity style={[styles.limitBannerButton, { backgroundColor: accentColor }]} onPress={() => router.push('/subscription')}>
                      <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 13 }}>Get Plus</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}

              {/* HEADER */}
              {!hasMessages ? (
                <View style={styles.headerEmpty}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TouchableOpacity onPress={() => setSideMenuVisible(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Ionicons name="menu" size={24} color={colors.text} />
                    </TouchableOpacity>
                    {!isGuest && !isPro ? (
                      Platform.OS === 'ios' ? (
                        <BlurView intensity={isDark ? 55 : 45} tint={isDark ? 'dark' : 'light'} style={[styles.upgradeBtn, { overflow: 'hidden', borderWidth: 1, borderColor: accentColor + '50' }]}>
                          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5 }} onPress={() => router.push('/subscription')}>
                            <Ionicons name="sparkles" size={11} color={accentColor} />
                            <Text style={[styles.upgradeBtnText, { color: accentColor, fontSize: 12 }]}>Upgrade</Text>
                          </TouchableOpacity>
                        </BlurView>
                      ) : (
                        <TouchableOpacity style={[styles.upgradeBtn, { backgroundColor: isDark ? accentColor + '22' : accentColor + '18', borderWidth: 1, borderColor: accentColor + '50', paddingHorizontal: 10, paddingVertical: 5 }]} onPress={() => router.push('/subscription')}>
                          <Ionicons name="sparkles" size={11} color={accentColor} />
                          <Text style={[styles.upgradeBtnText, { color: accentColor, fontSize: 12 }]}>Upgrade</Text>
                        </TouchableOpacity>
                      )
                    ) : isGuest ? (
                      <TouchableOpacity style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : '#F0F0F5', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 5 }} onPress={() => router.push('/login')}>
                        <Text style={{ color: isDark ? '#FFF' : '#000', fontWeight: '600', fontSize: 13 }}>Sign up</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  {!isGuest ? (
                    <View style={styles.headerEmptyRight}>
                      {Platform.OS === 'ios' ? (
                        <BlurView intensity={55} tint={isDark ? 'dark' : 'light'} style={headerIconGroupStyles.glassWrap}>
                          <TouchableOpacity style={headerIconGroupStyles.iconBtn} onPress={() => setGroupStartModalVisible(true)}>
                            <Ionicons name="person-add-outline" size={18} color={colors.text} />
                          </TouchableOpacity>
                          <View style={[headerIconGroupStyles.divider, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' }]} />
                          <TouchableOpacity style={headerIconGroupStyles.iconBtn} onPress={() => { setTemporaryChatMode(!temporaryChatMode); setGroupChatMode(false); }}>
                            <Ionicons name="timer-outline" size={18} color={temporaryChatMode ? accentColor : colors.text} />
                          </TouchableOpacity>
                        </BlurView>
                      ) : (
                        <View style={[headerIconGroupStyles.glassWrap, { backgroundColor: isDark ? 'rgba(44,44,46,0.85)' : 'rgba(242,242,247,0.85)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }]}>
                          <TouchableOpacity style={headerIconGroupStyles.iconBtn} onPress={() => setGroupStartModalVisible(true)}>
                            <Ionicons name="person-add-outline" size={18} color={colors.text} />
                          </TouchableOpacity>
                          <View style={[headerIconGroupStyles.divider, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' }]} />
                          <TouchableOpacity style={headerIconGroupStyles.iconBtn} onPress={() => { setTemporaryChatMode(!temporaryChatMode); setGroupChatMode(false); }}>
                            <Ionicons name="timer-outline" size={18} color={colors.text} />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  ) : <View />}
                </View>
              ) : (
                <View style={styles.headerChat}>
                  {Platform.OS === 'ios' ? (
                    <TouchableOpacity style={styles.headerChatLeft} onPress={() => setSideMenuVisible(true)}>
                      <BlurView intensity={55} tint={isDark ? 'dark' : 'light'} style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }}>
                        <Ionicons name="menu" size={22} color={colors.text} />
                      </BlurView>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={styles.headerChatLeft} onPress={() => setSideMenuVisible(true)}>
                      <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(44,44,46,0.85)' : 'rgba(242,242,247,0.85)', borderWidth: StyleSheet.hairlineWidth, borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }}>
                        <Ionicons name="menu" size={22} color={colors.text} />
                      </View>
                    </TouchableOpacity>
                  )}
                  <Text style={styles.headerChatTitle} numberOfLines={1}>
                    {groupChatMode ? groupName : (temporaryChatMode ? 'Temporary chat' : (currentConversation?.title || 'Dawinix'))}
                  </Text>
                  <View style={styles.headerChatRight}>
                    {Platform.OS === 'ios' ? (
                      <TouchableOpacity onPress={handleNewChat} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <BlurView intensity={55} tint={isDark ? 'dark' : 'light'} style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }}>
                          <Ionicons name="create-outline" size={17} color={colors.text} />
                        </BlurView>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity onPress={handleNewChat} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(44,44,46,0.85)' : 'rgba(242,242,247,0.85)', borderWidth: StyleSheet.hairlineWidth, borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }}>
                          <Ionicons name="create-outline" size={17} color={colors.text} />
                        </View>
                      </TouchableOpacity>
                    )}
                    {groupChatMode ? (
                      <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => setGroupChatActionsVisible(true)}>
                        {userProfilePhoto ? (
                          <ExpoImage source={{ uri: userProfilePhoto }} style={{ width: 36, height: 36, borderRadius: 18 }} contentFit="cover" />
                        ) : (
                          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? 'rgba(44,44,46,0.85)' : 'rgba(242,242,247,0.85)', alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }}>
                            <Ionicons name="person" size={18} color={colors.text} />
                          </View>
                        )}
                      </TouchableOpacity>
                    ) : Platform.OS === 'ios' ? (
                      <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => setConversationMenuVisible(true)}>
                        <BlurView intensity={55} tint={isDark ? 'dark' : 'light'} style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }}>
                          <Ionicons name="ellipsis-horizontal" size={19} color={colors.text} />
                        </BlurView>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => setConversationMenuVisible(true)}>
                        <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(44,44,46,0.85)' : 'rgba(242,242,247,0.85)', borderWidth: StyleSheet.hairlineWidth, borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }}>
                          <Ionicons name="ellipsis-horizontal" size={19} color={colors.text} />
                        </View>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}

              {isSearchMode ? (
                <View style={styles.searchContainer}>
                  <Ionicons name="search" size={20} color={colors.textSecondary} />
                  <TextInput style={styles.searchInput} placeholder="Search messages..." placeholderTextColor={colors.textSecondary} value={searchQuery} onChangeText={setSearchQuery} autoFocus />
                  <TouchableOpacity onPress={() => { setIsSearchMode(false); setSearchQuery(''); }}>
                    <Ionicons name="close" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              ) : null}

              <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                <View style={styles.messagesContainer}>
                  {loading ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="large" color={colors.primary} />
                    </View>
                  ) : displayMessages.length === 0 ? (
                    <View style={styles.emptyState}>
                      {temporaryChatMode ? (
                        <TemporaryChatBanner />
                      ) : groupChatMode ? (
                        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
                          <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center', marginBottom: 20 }}>
                            <Text style={{ color: colors.text, fontWeight: '700' }}>{userName}</Text>
                            {' created the group chat.\nYour personal Dawinix memory is never used in group chats.'}
                          </Text>
                          <TouchableOpacity style={styles.groupActionBtn} onPress={() => setCustomizeAIVisible(true)}>
                            <Text style={styles.groupActionBtnText}>Customize Dawinix</Text>
                          </TouchableOpacity>
                          <View style={{ height: 12 }} />
                          <TouchableOpacity style={styles.groupActionBtn} onPress={() => setInviteLinkVisible(true)}>
                            <Text style={styles.groupActionBtnText}>Invite with link</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 14, gap: 10 }}>
                            {smartSuggestions.map((s, i) => {
                              const anim = suggestionAnims[i] || { opacity: new Animated.Value(1), translateY: new Animated.Value(0) };
                              return (
                                <Animated.View key={`${s.title}-${i}`} style={{ opacity: anim.opacity, transform: [{ translateY: anim.translateY }] }}>
                                  <TouchableOpacity style={styles.suggestionCard} activeOpacity={0.7} onPress={() => handleSuggestionTap(s)}>
                                    <Text style={styles.suggestionTitle}>{s.title}</Text>
                                    <Text style={styles.suggestionSub}>{s.sub}</Text>
                                  </TouchableOpacity>
                                </Animated.View>
                              );
                            })}
                          </ScrollView>
                        </View>
                      )}
                    </View>
                  ) : (
                    <FlatList
                      ref={flatListRef}
                      data={displayMessages}
                      renderItem={renderMessage}
                      keyExtractor={item => item.id}
                      key={currentConversation?.id || 'empty'}
                      contentContainerStyle={{ paddingVertical: Spacing.md, paddingBottom: 8 }}
                      onScroll={handleScrollEvent}
                      scrollEventThrottle={16}
                      maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
                      initialNumToRender={12}
                      updateCellsBatchingPeriod={50}
                      ListHeaderComponent={groupChatMode && (messages || []).length > 0 ? (
                        <View style={{ paddingHorizontal: 16, paddingBottom: 16, alignItems: 'center', gap: 10 }}>
                          <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: 'center' }}>
                            <Text style={{ color: colors.text, fontWeight: '700' }}>{userName}</Text>{' created the group chat.'}
                          </Text>
                          <View style={{ flexDirection: 'row', gap: 10 }}>
                            <TouchableOpacity style={styles.groupActionBtn} onPress={() => setCustomizeAIVisible(true)}>
                              <Text style={styles.groupActionBtnText}>Customize Dawinix</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.groupActionBtn} onPress={() => setInviteLinkVisible(true)}>
                              <Text style={styles.groupActionBtnText}>Invite with link</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : null}
                      ListFooterComponent={
                        <>
                          {inlineQuizVisible && inlineQuizQuestions.length > 0 ? (
                            <QuizView
                              questions={inlineQuizQuestions}
                              onClose={() => setInlineQuizVisible(false)}
                              onViewResults={handleQuizViewResults}
                              onTryAnother={handleTryAnotherQuiz}
                              onHarderQuiz={handleHarderQuiz}
                              quizHistory={quizHistory}
                              onNextQuiz={handleNextQuizInline}
                              preGeneratedQuestions={preGeneratedQuestions}
                            />
                          ) : null}
                                    {spotifySearching ? (
                            <View style={{ paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#1DB954', alignItems: 'center', justifyContent: 'center' }}>
                                <View style={{ gap: 2 }}>{[1, 0.78, 0.56].map((w, i) => <View key={i} style={{ width: 10 * w, height: 1.5, borderRadius: 1, backgroundColor: '#000' }} />)}</View>
                              </View>
                              <Text style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)', fontSize: 14 }}>Searching Spotify...</Text>
                            </View>
                          ) : null}
                          {spotifyResults.length > 0 && !spotifySearching ? (
                            <SpotifyMusicCard
                              tracks={spotifyResults}
                              hasAccount={spotifyHasAccount}
                              isDark={isDark}
                              isGuest={isGuest}
                            />
                          ) : null}
                          {(sending || generating) && !streamingMessageId ? (
                            <ThinkingIndicator
                              userMessage={(messages || []).length > 0 ? (messages || [])[(messages || []).length - 1].content : inputText}
                              completed={showCompletionStatus}
                              mode={thinkingMode}
                              onCancel={handleStopGeneration}
                              isGroupMode={groupChatMode}
                            />
                          ) : null}
                        </>
                      }
                      onContentSizeChange={() => { if (isAtBottom || generating || sending) flatListRef.current?.scrollToEnd({ animated: false }); }}
                      maxToRenderPerBatch={8}
                      windowSize={15}
                      removeClippedSubviews={Platform.OS === 'android'}
                      disableVirtualization={false}
                    />
                  )}
                </View>
              </TouchableWithoutFeedback>

              {codeLangChips ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 44 }} contentContainerStyle={{ paddingHorizontal: 12, gap: 6, alignItems: 'center' }}>
                  {['python', 'javascript', 'typescript', 'html', 'css', 'bash', 'json'].map(lang => (
                    <TouchableOpacity key={lang} style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 }} onPress={() => { setInputText(inputText.replace(/```\w*$/, '```' + lang + '\n')); setCodeLangChips(false); }}>
                      <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>{lang}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : null}

              {replyingTo ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingBottom: 6, gap: 8 }}>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', borderRadius: 14, borderLeftWidth: 3, borderLeftColor: accentColor, paddingHorizontal: 10, paddingVertical: 7, gap: 6 }}>
                    <Ionicons name="return-down-forward-outline" size={14} color={accentColor} />
                    <Text style={{ color: accentColor, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>{replyingTo.role === 'assistant' ? 'Dawinix' : 'You'}:</Text>
                    <Text style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)', fontSize: 13, flex: 1 }} numberOfLines={1}>{(replyingTo.content || '').slice(0, 60)}</Text>
                    <TouchableOpacity onPress={() => setReplyingTo(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close" size={16} color={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)'} />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}

              {editingMessageId ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingBottom: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#1A2030' : '#E8F0FE', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, gap: 7, alignSelf: 'flex-start', borderWidth: 1, borderColor: isDark ? 'rgba(0,122,255,0.3)' : 'rgba(0,122,255,0.2)' }}>
                    <Ionicons name="pencil" size={15} color="#007AFF" />
                    <Text style={{ color: '#007AFF', fontSize: 14, fontWeight: '700' }}>Edit</Text>
                    <TouchableOpacity onPress={handleCancelEdit} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close" size={15} color={isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.4)'} />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}

              {/* Deep Research Plan Card (countdown) */}
              {deepResearchPlanVisible && (
                <View style={{ marginHorizontal: 12, marginBottom: 8, backgroundColor: isDark ? '#FFFFFF' : '#FFFFFF', borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: isDark ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.08)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 }}>
                  <View style={{ padding: 16 }}>
                    <Text style={{ color: '#000', fontSize: 16, fontWeight: '700', marginBottom: 12 }}>{deepResearchPlanTitle}</Text>
                    {deepResearchPlanSteps.map((step, i) => (
                      <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6, gap: 12 }}>
                        <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.2)', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(0,0,0,0.3)' }} />
                        </View>
                        <Text style={{ color: '#111', fontSize: 14, flex: 1, lineHeight: 20 }}>{step}</Text>
                      </View>
                    ))}
                    <TouchableOpacity
                      style={{ marginTop: 12, backgroundColor: '#000', borderRadius: 50, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10 }}
                      onPress={() => {
                        if (deepResearchCountdownRef.current) clearInterval(deepResearchCountdownRef.current);
                        setDeepResearchPlanVisible(false);
                        runDeepResearchActual(deepResearchPlanTitle);
                      }}
                    >
                      <Text style={{ color: '#FFF', fontSize: 17, fontWeight: '700' }}>Start</Text>
                      <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700' }}>{deepResearchCountdown}</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Deep Research In-progress */}
              {deepResearchActive && deepResearchSteps.length > 0 ? (
                <View style={{ marginHorizontal: 12, marginBottom: 8, backgroundColor: isDark ? '#FFFFFF' : '#FFFFFF', borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 }}>
                  <View style={{ padding: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <Ionicons name="search" size={16} color="#111" />
                      <Text style={{ color: '#000', fontWeight: '700', fontSize: 14 }}>{deepResearchPlanTitle || 'Deep Research'}</Text>
                    </View>
                    {deepResearchSteps.map((step, i) => (
                      <DeepResearchCard key={i} step={i} label={step.label} done={step.done} colors={{ text: '#000', textSecondary: '#555' }} />
                    ))}
                    <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ color: '#555', fontSize: 13, flex: 1 }}>Researching...</Text>
                      <View style={{ flex: 1, height: 2, backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 1 }}>
                        <Animated.View style={{ height: 2, backgroundColor: '#000', borderRadius: 1, width: `${(deepResearchSteps.filter(s => s.done).length / deepResearchSteps.length) * 100}%` }} />
                      </View>
                      <TouchableOpacity
                        style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: '#000', alignItems: 'center', justifyContent: 'center' }}
                        onPress={() => {
                          setDeepResearchActive(false);
                          setDeepResearchRunning(false);
                          setSending(false);
                          setGenerating(false);
                          setDeepResearchSteps([]);
                          cancelSendMessage();
                        }}
                      >
                        <View style={{ width: 8, height: 8, backgroundColor: '#000', borderRadius: 1 }} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ) : null}

              {/* Web Search Modal */}
              <Modal visible={webSearchModalVisible} transparent animationType="slide" onRequestClose={() => setWebSearchModalVisible(false)}>
                <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                  {Platform.OS === 'ios' ? <BlurView intensity={isDark ? 60 : 45} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />}
                  <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setWebSearchModalVisible(false)} />
                  <View style={{ backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: insets.bottom + 24 }}>
                    <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.15)', alignSelf: 'center', marginBottom: 20 }} />
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#34C75922', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="globe-outline" size={20} color="#34C759" />
                      </View>
                      <View>
                        <Text style={{ color: isDark ? '#FFF' : '#000', fontSize: 18, fontWeight: '700' }}>Web Search</Text>
                        <Text style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', fontSize: 13 }}>Search the web with AI</Text>
                      </View>
                      <TouchableOpacity style={{ marginLeft: 'auto', width: 32, height: 32, borderRadius: 16, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)', alignItems: 'center', justifyContent: 'center' }} onPress={() => setWebSearchModalVisible(false)}>
                        <Ionicons name="close" size={16} color={isDark ? '#FFF' : '#000'} />
                      </TouchableOpacity>
                    </View>
                    <Text style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)', fontSize: 14, lineHeight: 20, marginBottom: 20 }}>
                      Web Search mode lets AI search the internet for current information and provide answers with cited sources.
                    </Text>
                    <TouchableOpacity
                      style={{ backgroundColor: '#34C759', borderRadius: 50, paddingVertical: 15, alignItems: 'center' }}
                      onPress={() => {
                        setWebSearchModalVisible(false);
                        setWebSearchMode(true);
                        setTimeout(() => inputRef.current?.focus(), 100);
                      }}
                    >
                      <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700' }}>Start Web Search</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Modal>

              {/* Input Area */}
              <View style={[styles.inputContainer, Platform.OS === 'ios' && { backgroundColor: 'transparent' }]}>
                {/* + button OUTSIDE input when keyboard is visible */}
                {showPlusOutside ? (
                  <TouchableOpacity style={styles.addBtn} onPress={() => setToolsVisible(true)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    {Platform.OS === 'ios' ? (
                      <BlurView intensity={isDark ? 60 : 50} tint={isDark ? 'dark' : 'light'} style={[styles.addBtnCircle, { overflow: 'hidden', borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.14)' }]}>
                        <Ionicons name="add" size={22} color={colors.text} />
                      </BlurView>
                    ) : (
                      <View style={[styles.addBtnCircle, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.09)', borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.14)' }]}>
                        <Ionicons name="add" size={22} color={colors.text} />
                      </View>
                    )}
                  </TouchableOpacity>
                ) : null}

                {Platform.OS === 'ios' ? (
                  <BlurView
                    intensity={isDark ? 70 : 55}
                    tint={isDark ? 'dark' : 'light'}
                    style={[styles.inputWrapper, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', overflow: 'hidden' }]}
                  >
                    <Pressable style={{ flex: 1 }} onPress={() => inputRef.current?.focus()}>
                      {/* Spotify chip */}
                      {spotifyActive ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: isDark ? '#1A1A1D' : '#111', borderRadius: 50, paddingHorizontal: 10, paddingVertical: 6 }}>
                            <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#1DB954', alignItems: 'center', justifyContent: 'center' }}>
                              <View style={{ gap: 2, alignItems: 'center' }}>
                                {[1, 0.78, 0.56].map((w, i) => (<View key={i} style={{ width: 11 * w, height: 1.5, borderRadius: 1, backgroundColor: '#000' }} />))}
                              </View>
                            </View>
                            <Text style={{ color: '#1DB954', fontSize: 14, fontWeight: '700' }}>Spotify</Text>
                            <TouchableOpacity onPress={() => { setSpotifyActive(false); setSpotifyResults([]); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                              <Ionicons name="close" size={14} color="rgba(255,255,255,0.55)" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : null}
                      {/* Mode chips */}
                      {(quizMode || deepResearchMode || webSearchMode || thinkingModeActive) ? (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                          {quizMode ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(90,200,250,0.15)', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(90,200,250,0.3)' }}>
                              <Ionicons name="albums-outline" size={14} color="#5AC8FA" />
                              <Text style={{ color: '#5AC8FA', fontSize: 13, fontWeight: '700' }}>Quizzes</Text>
                              <TouchableOpacity onPress={() => setQuizMode(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Ionicons name="close" size={12} color="#5AC8FA" /></TouchableOpacity>
                            </View>
                          ) : null}
                          {deepResearchMode ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(90,200,250,0.12)', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(90,200,250,0.3)' }}>
                              <Ionicons name="search" size={14} color="#5AC8FA" />
                              <Text style={{ color: '#5AC8FA', fontSize: 13, fontWeight: '700' }}>Research</Text>
                              <TouchableOpacity onPress={() => setDeepResearchMode(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Ionicons name="close" size={12} color="#5AC8FA" /></TouchableOpacity>
                            </View>
                          ) : null}
                          {webSearchMode ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(52,199,89,0.12)', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(52,199,89,0.3)' }}>
                              <Ionicons name="globe-outline" size={14} color="#34C759" />
                              <Text style={{ color: '#34C759', fontSize: 13, fontWeight: '700' }}>Web Search</Text>
                              <TouchableOpacity onPress={() => setWebSearchMode(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Ionicons name="close" size={12} color="#34C759" /></TouchableOpacity>
                            </View>
                          ) : null}
                          {thinkingModeActive ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(191,90,242,0.12)', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(191,90,242,0.3)' }}>
                              <Ionicons name="bulb-outline" size={14} color="#BF5AF2" />
                              <Text style={{ color: '#BF5AF2', fontSize: 13, fontWeight: '700' }}>Thinking</Text>
                              <TouchableOpacity onPress={() => setThinkingModeActive(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Ionicons name="close" size={12} color="#BF5AF2" /></TouchableOpacity>
                            </View>
                          ) : null}
                        </View>
                      ) : null}
                      {renderInlineMediaPreviews()}
                      {isRecording || isProcessing ? (
                        <View style={styles.recordingRow}>
                          <WaveformAnimation isRecording={isRecording} />
                          <Text style={styles.recordingDuration}>{isProcessing ? 'Processing...' : formatDuration(recordingDuration)}</Text>
                        </View>
                      ) : (
                        <View style={styles.inputRow}>
                          {/* + button INSIDE input when keyboard is NOT visible */}
                          {!isKeyboardVisible && !editingMessageId ? (
                            <TouchableOpacity onPress={() => setToolsVisible(true)} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }} style={{ paddingRight: 6 }}>
                              <Ionicons name="add" size={22} color={colors.textSecondary} />
                            </TouchableOpacity>
                          ) : null}
                          <TextInput
                            ref={inputRef}
                            style={styles.input}
                            value={inputText}
                            onChangeText={handleInputChange}
                            placeholder={isGuestLocked ? 'Chat locked for 24h. Sign in to continue.' : thinkingModeActive ? 'Ask AI' : webSearchMode ? 'Search the web...' : deepResearchMode ? 'Get a detailed report' : 'Ask anything'}
                            editable={!isGuestLocked}
                            placeholderTextColor={colors.textSecondary}
                            multiline
                            returnKeyType="default"
                            blurOnSubmit={false}
                            scrollEnabled
                            textAlignVertical="center"
                          />
                          <TouchableOpacity onPress={toggleRecording} hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }} style={{ opacity: isProcessing ? 0.5 : 1, paddingHorizontal: 4 }}>
                            <Ionicons name={isRecording ? 'stop-circle' : isProcessing ? 'hourglass-outline' : 'mic-outline'} size={21} color={isRecording ? '#FF3B30' : colors.textSecondary} />
                          </TouchableOpacity>
                          {sending ? (
                            <TouchableOpacity style={[styles.sendButton, { backgroundColor: accentColor }]} onPress={handleStopGeneration}>
                              <View style={{ width: 11, height: 11, backgroundColor: '#FFF', borderRadius: 2 }} />
                            </TouchableOpacity>
                          ) : showSendButton ? (
                            <TouchableOpacity style={[styles.sendButton, { backgroundColor: deepResearchMode ? '#5AC8FA' : webSearchMode ? '#34C759' : thinkingModeActive ? '#BF5AF2' : accentColor }]} onPress={handleSend} disabled={isRecording || isProcessing}>
                              <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
                            </TouchableOpacity>
                          ) : (
                            <TouchableOpacity style={[styles.voiceOrbBtn, { backgroundColor: accentColor }]} onPress={() => router.push('/voice-control')}>
                              <Ionicons name="pulse" size={17} color="#FFFFFF" />
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </Pressable>
                  </BlurView>
                ) : (
                  <Pressable style={[styles.inputWrapper, { backgroundColor: isDark ? '#1C1C1E' : '#EFEFEF', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]} onPress={() => inputRef.current?.focus()}>
                    {/* Spotify chip */}
                    {spotifyActive ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: isDark ? '#1A1A1D' : '#111', borderRadius: 50, paddingHorizontal: 10, paddingVertical: 6 }}>
                          <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#1DB954', alignItems: 'center', justifyContent: 'center' }}>
                            <View style={{ gap: 2, alignItems: 'center' }}>{[1, 0.78, 0.56].map((w, i) => (<View key={i} style={{ width: 11 * w, height: 1.5, borderRadius: 1, backgroundColor: '#000' }} />))}</View>
                          </View>
                          <Text style={{ color: '#1DB954', fontSize: 14, fontWeight: '700' }}>Spotify</Text>
                          <TouchableOpacity onPress={() => { setSpotifyActive(false); setSpotifyResults([]); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Ionicons name="close" size={14} color="rgba(255,255,255,0.55)" /></TouchableOpacity>
                        </View>
                      </View>
                    ) : null}
                    {/* Mode chips */}
                    {(quizMode || deepResearchMode || webSearchMode || thinkingModeActive) ? (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                        {quizMode ? (<View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(90,200,250,0.15)', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(90,200,250,0.3)' }}><Ionicons name="albums-outline" size={14} color="#5AC8FA" /><Text style={{ color: '#5AC8FA', fontSize: 13, fontWeight: '700' }}>Quizzes</Text><TouchableOpacity onPress={() => setQuizMode(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Ionicons name="close" size={12} color="#5AC8FA" /></TouchableOpacity></View>) : null}
                        {deepResearchMode ? (<View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(90,200,250,0.12)', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(90,200,250,0.3)' }}><Ionicons name="search" size={14} color="#5AC8FA" /><Text style={{ color: '#5AC8FA', fontSize: 13, fontWeight: '700' }}>Research</Text><TouchableOpacity onPress={() => setDeepResearchMode(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Ionicons name="close" size={12} color="#5AC8FA" /></TouchableOpacity></View>) : null}
                        {webSearchMode ? (<View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(52,199,89,0.12)', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(52,199,89,0.3)' }}><Ionicons name="globe-outline" size={14} color="#34C759" /><Text style={{ color: '#34C759', fontSize: 13, fontWeight: '700' }}>Web Search</Text><TouchableOpacity onPress={() => setWebSearchMode(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Ionicons name="close" size={12} color="#34C759" /></TouchableOpacity></View>) : null}
                        {thinkingModeActive ? (<View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(191,90,242,0.12)', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(191,90,242,0.3)' }}><Ionicons name="bulb-outline" size={14} color="#BF5AF2" /><Text style={{ color: '#BF5AF2', fontSize: 13, fontWeight: '700' }}>Thinking</Text><TouchableOpacity onPress={() => setThinkingModeActive(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Ionicons name="close" size={12} color="#BF5AF2" /></TouchableOpacity></View>) : null}
                      </View>
                    ) : null}
                    {renderInlineMediaPreviews()}
                    {isRecording || isProcessing ? (
                      <View style={styles.recordingRow}>
                        <WaveformAnimation isRecording={isRecording} />
                        <Text style={styles.recordingDuration}>{isProcessing ? 'Processing...' : formatDuration(recordingDuration)}</Text>
                      </View>
                    ) : (
                      <View style={styles.inputRow}>
                        {/* + button INSIDE input when keyboard is NOT visible (Android) */}
                        {!isKeyboardVisible && !editingMessageId ? (
                          <TouchableOpacity onPress={() => setToolsVisible(true)} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }} style={{ paddingRight: 6 }}>
                            <Ionicons name="add" size={22} color={colors.textSecondary} />
                          </TouchableOpacity>
                        ) : null}
                        <TextInput
                          ref={inputRef}
                          style={styles.input}
                          value={inputText}
                          onChangeText={handleInputChange}
                          placeholder={isGuestLocked ? 'Chat locked for 24h. Sign in to continue.' : thinkingModeActive ? 'Ask AI' : webSearchMode ? 'Search the web...' : deepResearchMode ? 'Get a detailed report' : 'Ask anything'}
                          editable={!isGuestLocked}
                          placeholderTextColor={colors.textSecondary}
                          multiline
                          returnKeyType="default"
                          blurOnSubmit={false}
                          scrollEnabled
                          textAlignVertical="center"
                        />
                        <TouchableOpacity onPress={toggleRecording} hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }} style={{ opacity: isProcessing ? 0.5 : 1, paddingHorizontal: 4 }}>
                          <Ionicons name={isRecording ? 'stop-circle' : isProcessing ? 'hourglass-outline' : 'mic-outline'} size={21} color={isRecording ? '#FF3B30' : colors.textSecondary} />
                        </TouchableOpacity>
                        {sending ? (
                          <TouchableOpacity style={[styles.sendButton, { backgroundColor: accentColor }]} onPress={handleStopGeneration}>
                            <View style={{ width: 11, height: 11, backgroundColor: '#FFF', borderRadius: 2 }} />
                          </TouchableOpacity>
                        ) : showSendButton ? (
                          <TouchableOpacity style={[styles.sendButton, { backgroundColor: deepResearchMode ? '#5AC8FA' : webSearchMode ? '#34C759' : thinkingModeActive ? '#BF5AF2' : accentColor }]} onPress={handleSend} disabled={isRecording || isProcessing}>
                            <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity style={[styles.voiceOrbBtn, { backgroundColor: accentColor }]} onPress={() => router.push('/voice-control')}>
                            <Ionicons name="pulse" size={17} color="#FFFFFF" />
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </Pressable>
                )}
              </View>
            </KeyboardAvoidingView>

            {showMentionPopup && groupChatMode && filteredMentionMembers.length > 0 ? (
              <MentionPopup
                members={filteredMentionMembers}
                onSelect={(member) => {
                  const newText = inputText.replace(/@\w*$/, `@${member.username} `);
                  setInputText(newText);
                  setShowMentionPopup(false);
                  setMentionQuery('');
                }}
                onClose={() => { setShowMentionPopup(false); setMentionQuery(''); }}
              />
            ) : null}

            {showScrollToBottom && hasMessages && (
              <TouchableOpacity
                style={{ position: 'absolute', bottom: 90, alignSelf: 'center', left: '50%', marginLeft: -20, width: 40, height: 40, borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8, zIndex: 50 }}
                onPress={() => { flatListRef.current?.scrollToEnd({ animated: true }); setIsAtBottom(true); setShowScrollToBottom(false); }}
              >
                {Platform.OS === 'ios' ? (
                  <BlurView intensity={isDark ? 70 : 55} tint={isDark ? 'dark' : 'light'} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="chevron-down" size={20} color={colors.text} />
                  </BlurView>
                ) : (
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(44,44,46,0.92)' : 'rgba(240,240,245,0.92)' }}>
                    <Ionicons name="chevron-down" size={20} color={colors.text} />
                  </View>
                )}
              </TouchableOpacity>
            )}

            <ToolsModal
              visible={toolsVisible}
              onClose={() => setToolsVisible(false)}
              onPickMedia={(media) => {
                if (isGuest) {
                  const imageFiles = media.filter(m => m.type === 'image');
                  const docFiles = media.filter(m => m.type !== 'image');
                  if (docFiles.length > 0) { setToolsVisible(false); setGuestLockFeature('file upload'); setGuestLockModal(true); return; }
                  const nowTools2 = Date.now();
                  const inPhotoBlock2 = guestPhotoResetTime > 0 && nowTools2 - guestPhotoResetTime < GUEST_PHOTO_BLOCK_MS;
                  const curPhotoCount2 = inPhotoBlock2 ? guestPhotoCount : 0;
                  if (curPhotoCount2 + imageFiles.length > GUEST_PHOTO_LIMIT) {
                    setToolsVisible(false);
                    const hoursLeft3 = inPhotoBlock2 ? Math.ceil((GUEST_PHOTO_BLOCK_MS-(nowTools2-guestPhotoResetTime))/(1000*60*60)) : 0;
                    showAlert('Photo Limit',`Guest: ${GUEST_PHOTO_LIMIT} photos per 20h.${hoursLeft3>0?` Try in ${hoursLeft3}h or sign in.`:' Sign in to continue.'}`);
                    return;
                  }
                  setToolsVisible(false);
                  handleMediaPicked(media);
                  return;
                }
                handleMediaPicked(media);
              }}
              onSelectTool={(toolId) => {
                if (isGuest) { setToolsVisible(false); setGuestLockFeature(toolId); setGuestLockModal(true); return; }
                setInputText(prev => `${prev}[${toolId}] `);
              }}
              onConnectApp={() => {
                setConnectedAppsModalVisible(true);
              }}
              onSelectAIModel={(model) => {
                if (isGuest) { setToolsVisible(false); setGuestLockFeature('AI model selection'); setGuestLockModal(true); return; }
                handleAIModelSelect(model as AIModelKey);
              }}
              onOpenCamera={() => {
                if (isGuest) { if (guestPhotoCount >= GUEST_PHOTO_LIMIT) { setToolsVisible(false); setGuestLoginModal(true); return; } setToolsVisible(false); router.push('/camera'); return; }
                router.push('/camera');
              }}
              currentModel={currentAIModel}
              onOpenQuiz={() => {
                if (isGuest) { setToolsVisible(false); setGuestLockFeature('quiz'); setGuestLockModal(true); return; }
                setQuizMode(true); setQuizConnectVisible(true);
              }}
              onOpenPresets={() => {
                if (isGuest) { setToolsVisible(false); setGuestLockFeature('presets'); setGuestLockModal(true); return; }
                setPresetsModalVisible(true);
              }}
              onDeepResearch={() => {
                if (isGuest) { setGuestLockFeature('deep research'); setGuestLockModal(true); return; }
                setDeepResearchMode(true);
                setWebSearchMode(false);
                setThinkingModeActive(false);
                setInputText('');
                setToolsVisible(false);
                setTimeout(() => inputRef.current?.focus(), 100);
              }}
              onWebSearch={() => {
                if (isGuest) { setGuestLockFeature('web search'); setGuestLockModal(true); return; }
                setWebSearchMode(true);
                setDeepResearchMode(false);
                setThinkingModeActive(false);
                setToolsVisible(false);
                setWebSearchModalVisible(true);
              }}
              onThinkingMode={() => {
                if (isGuest) { setGuestLockFeature('thinking mode'); setGuestLockModal(true); return; }
                setThinkingModeActive(true);
                setDeepResearchMode(false);
                setWebSearchMode(false);
                setToolsVisible(false);
                setTimeout(() => inputRef.current?.focus(), 100);
              }}
            />

            <ConversationMenuModal visible={conversationMenuVisible} onClose={() => setConversationMenuVisible(false)} onShare={handleShareConversation} onRename={() => { setConversationMenuVisible(false); setRenameModalVisible(true); }} onReport={() => router.push('/bugreport')} onArchive={() => { setConversationMenuVisible(false); setArchiveConfirmVisible(true); }} onDelete={() => { setConversationMenuVisible(false); handleDeleteConversation(); }} onAddPeople={handleAddPeople} conversationTitle={currentConversation?.title} topOffset={insets.top + 58} />

            <SideMenu visible={sideMenuVisible} onClose={() => setSideMenuVisible(false)} currentProject={{ name: 'Dawinix Chat' }} currentAIMode={currentAIMode} onSelectAIMode={handleSelectAIMode} onNewChat={handleNewChat} onChatHistory={() => { setSideMenuVisible(false); setChatHistoryVisible(true); }} onSettings={() => { setSideMenuVisible(false); router.push('/settings'); }} onProfile={() => { setSideMenuVisible(false); router.push('/profile'); }} userCoins={coins} isUnlimited={isUnlimited} isAdmin={isAdmin} isGuest={isGuest} />

            <ChatHistoryModal visible={chatHistoryVisible} onClose={() => setChatHistoryVisible(false)} onSelectChat={() => { setChatHistoryVisible(false); }} onNewChat={() => { handleNewChat(); setChatHistoryVisible(false); }} currentChatId={currentConversation?.id} />

            {/* CalculatorModal removed — calculator is now inline in chat */}

            {/* Quiz Connect */}
            <Modal visible={quizConnectVisible} transparent animationType="fade" onRequestClose={() => setQuizConnectVisible(false)}>
              <View style={{ flex: 1, backgroundColor: '#000' }}>
                <TouchableOpacity style={{ position: 'absolute', top: 60, right: 20, backgroundColor: 'rgba(52,199,89,0.85)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, zIndex: 10 }} onPress={() => { setQuizConnectVisible(false); setQuizConnectDetailVisible(true); }}>
                  <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}>Create a quiz</Text>
                </TouchableOpacity>
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
                  <View style={{ backgroundColor: 'rgba(28,28,32,0.95)', borderRadius: 20, padding: 28, width: '100%', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
                    <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: '#1A3050', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#5AC8FA', marginBottom: 16 }}>
                      <Ionicons name="albums-outline" size={26} color="#5AC8FA" />
                    </View>
                    <Text style={{ color: '#FFF', fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: 8 }}>Dawinix wants to connect to Quizzes</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center', marginBottom: 28 }}>Create quizzes to test your knowledge</Text>
                    <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
                      <TouchableOpacity style={{ flex: 1, borderRadius: 50, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', paddingVertical: 14, alignItems: 'center' }} onPress={() => { setQuizConnectVisible(false); setQuizMode(false); }}>
                        <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '600' }}>Not now</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={{ flex: 1, borderRadius: 50, backgroundColor: '#FFF', paddingVertical: 14, alignItems: 'center' }} onPress={() => { setQuizConnectVisible(false); setQuizConnectDetailVisible(true); }}>
                        <Text style={{ color: '#000', fontSize: 16, fontWeight: '700' }}>Connect</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            </Modal>

            {/* Quiz Topic */}
            <Modal visible={quizTopicVisible} transparent animationType="slide" onRequestClose={() => setQuizTopicVisible(false)}>
              <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setQuizTopicVisible(false)} />
                <View style={{ backgroundColor: '#1C1C1E', borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
                  <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24, paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
                    <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', alignSelf: 'center', marginBottom: 20 }} />
                    <Text style={{ color: '#FFF', fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 6 }}>Choose a Quiz Topic</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center', marginBottom: 20 }}>The AI will generate 10 real questions for you</Text>
                    {quizGenerating ? (
                      <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                        <ActivityIndicator size="large" color="#5AC8FA" />
                        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, marginTop: 14 }}>Generating your quiz...</Text>
                      </View>
                    ) : (
                      <>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 16 }}>
                          {[
                            { label: 'General Knowledge', value: 'General Knowledge' },
                            { label: 'Science', value: 'Science' },
                            { label: 'History', value: 'History' },
                            { label: 'Coding', value: 'Programming and Coding' },
                            { label: 'Geography', value: 'Geography' },
                            { label: 'Math', value: 'Mathematics' },
                            { label: 'Movies & Pop Culture', value: 'Movies and Pop Culture' },
                            { label: 'Sports', value: 'Sports' },
                          ].map((t) => (
                            <TouchableOpacity key={t.value} style={{ backgroundColor: selectedQuizTopic === t.value && !customTopicInput ? '#5AC8FA22' : 'rgba(255,255,255,0.07)', borderColor: selectedQuizTopic === t.value && !customTopicInput ? '#5AC8FA' : 'rgba(255,255,255,0.12)', borderWidth: 1.5, borderRadius: 50, paddingHorizontal: 16, paddingVertical: 10 }} activeOpacity={0.75} onPress={() => { setSelectedQuizTopic(t.value); setCustomTopicInput(''); }}>
                              <Text style={{ color: selectedQuizTopic === t.value && !customTopicInput ? '#5AC8FA' : 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '600' }}>{t.label}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '600', marginBottom: 8 }}>Custom topic...</Text>
                        <TextInput style={{ backgroundColor: customTopicInput ? 'rgba(90,200,250,0.1)' : 'rgba(255,255,255,0.07)', borderWidth: 1.5, borderColor: customTopicInput ? '#5AC8FA' : 'rgba(255,255,255,0.12)', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, color: '#FFF', fontSize: 15, marginBottom: 20 }} placeholder="e.g. JavaScript ES6, World War II battles..." placeholderTextColor="rgba(255,255,255,0.3)" value={customTopicInput} onChangeText={(txt) => { setCustomTopicInput(txt); if (txt) setSelectedQuizTopic(''); }} returnKeyType="done" />
                        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '600', marginBottom: 10 }}>Difficulty</Text>
                        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                          {[{ label: 'Easy', color: '#34C759' }, { label: 'Medium', color: '#5AC8FA' }, { label: 'Hard', color: '#FF9F0A' }, { label: 'Expert', color: '#FF453A' }].map((d) => {
                            const isSelected = selectedDifficulty === d.label;
                            return (
                              <TouchableOpacity key={d.label} style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: isSelected ? d.color : 'rgba(255,255,255,0.1)', backgroundColor: isSelected ? d.color + '22' : 'rgba(255,255,255,0.04)' }} activeOpacity={0.75} onPress={() => setSelectedDifficulty(d.label)}>
                                <Text style={{ color: isSelected ? d.color : 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '700' }}>{d.label}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                        <TouchableOpacity style={{ backgroundColor: (selectedQuizTopic || customTopicInput.trim()) ? '#5AC8FA' : 'rgba(255,255,255,0.1)', borderRadius: 50, paddingVertical: 16, alignItems: 'center' }} disabled={!selectedQuizTopic && !customTopicInput.trim()} onPress={() => handleLaunchQuiz(customTopicInput.trim() || selectedQuizTopic)}>
                          <Text style={{ color: (selectedQuizTopic || customTopicInput.trim()) ? '#000' : 'rgba(255,255,255,0.4)', fontSize: 17, fontWeight: '700' }}>Start Quiz</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </ScrollView>
                </View>
              </View>
            </Modal>

            <PresetsModal visible={presetsModalVisible} onClose={() => setPresetsModalVisible(false)} onSelectPreset={(phrase) => setInputText(phrase)} />

            <RenameModal visible={renameModalVisible} currentTitle={currentConversation?.title || ''} onConfirm={async (title) => { setRenameModalVisible(false); await handleRenameConversation(title); }} onCancel={() => setRenameModalVisible(false)} />
            <ArchiveConfirmModal visible={archiveConfirmVisible} onConfirm={() => { setArchiveConfirmVisible(false); handleArchiveConversation(); }} onCancel={() => setArchiveConfirmVisible(false)} />
            <GroupStartModal visible={groupStartModalVisible} user={user} profilePhotoUrl={userProfilePhoto} onClose={() => setGroupStartModalVisible(false)} onStartGroup={handleStartGroupChat} isDark={isDark} onSetupProfile={() => { setGroupStartModalVisible(false); setTimeout(() => setProfileEditModalVisible(true), 200); }} />
            <ProfileEditModal visible={profileEditModalVisible} user={user} profilePhotoUrl={userProfilePhoto} onClose={() => setProfileEditModalVisible(false)} isDark={isDark} onSave={(name, username, photo) => { if (photo) setUserProfilePhoto(photo); }} />
            <GroupChatActionsMenu visible={groupChatActionsVisible} onClose={() => setGroupChatActionsVisible(false)} onPeople={() => setPeopleModalVisible(true)} onAddPeople={handleAddPeople} onManageLink={() => setInviteLinkVisible(true)} onRenameGroup={() => setRenameGroupVisible(true)} onCustomize={() => setCustomizeAIVisible(true)} onMute={() => showAlert('Muted', 'Notifications muted for this group')} onReport={() => setReportGroupVisible(true)} onDeleteGroup={handleDeleteGroup} isDark={isDark} />
            <PeopleModal visible={peopleModalVisible} onClose={() => setPeopleModalVisible(false)} groupName={groupName} userName={userName} profilePhotoUrl={userProfilePhoto} isDark={isDark} isAdmin={isAdmin} />
            <ReportGroupModal visible={reportGroupVisible} onClose={() => setReportGroupVisible(false)} isDark={isDark} />

            <Modal visible={renameGroupVisible} transparent animationType="fade" onRequestClose={() => setRenameGroupVisible(false)}>
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.45)' }}>
                {Platform.OS === 'ios' ? <BlurView intensity={60} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} /> : null}
                <RenameGroupBox isDark={isDark} currentName={groupName} onSave={handleSaveGroupName} onCancel={() => setRenameGroupVisible(false)} />
              </View>
            </Modal>

            <Modal visible={deleteGroupConfirm} transparent animationType="fade" onRequestClose={() => setDeleteGroupConfirm(false)}>
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                {Platform.OS === 'ios' ? <BlurView intensity={65} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />}
                <View style={{ width: '80%', borderRadius: 22, overflow: 'hidden', backgroundColor: isDark ? '#2C2C2E' : '#FFF', padding: 26, alignItems: 'center' }}>
                  <Text style={{ color: isDark ? '#FFF' : '#000', fontSize: 19, fontWeight: '700', marginBottom: 10 }}>Delete group chat?</Text>
                  <Text style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)', fontSize: 14, textAlign: 'center', lineHeight: 21, marginBottom: 24 }}>This will permanently delete the group chat and all messages.</Text>
                  <TouchableOpacity style={{ width: '100%', backgroundColor: '#FF453A', borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginBottom: 10 }} onPress={() => { setDeleteGroupConfirm(false); setGroupChatMode(false); handleNewChat(); }}>
                    <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700' }}>Delete group</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={{ paddingVertical: 10 }} onPress={() => setDeleteGroupConfirm(false)}>
                    <Text style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)', fontSize: 15 }}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>

            <CustomizeAIModal visible={customizeAIVisible} onClose={() => setCustomizeAIVisible(false)} onSave={(instructions, respondAuto) => { setGroupCustomInstructions(instructions); setGroupRespondAuto(respondAuto); }} initialInstructions={groupCustomInstructions} initialRespondAuto={groupRespondAuto} />
            <InviteLinkModal visible={inviteLinkVisible} onClose={() => setInviteLinkVisible(false)} isPlus={isUnlimited} isDark={isDark} />
            <NotificationPermissionModal visible={notifPermModalVisible} onAllow={handleAllowNotifications} onSkip={() => setNotifPermModalVisible(false)} />

            {/* Shake to report bug modal */}
            <Modal visible={shakeBugModalVisible} transparent animationType="none" onRequestClose={() => setShakeBugModalVisible(false)}>
              <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                {Platform.OS === 'ios' ? <BlurView intensity={isDark ? 70 : 55} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }]} />}
                <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShakeBugModalVisible(false)} />
                <View style={{ borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' }}>
                  <View style={{ backgroundColor: isDark ? '#1C1C1E' : '#FFF', padding: 28, paddingBottom: insets.bottom + 28, borderTopLeftRadius: 28, borderTopRightRadius: 28 }}>
                    <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)', alignSelf: 'center', marginBottom: 24 }} />
                    <Text style={{ color: isDark ? '#FFF' : '#000', fontSize: 22, fontWeight: '800', marginBottom: 10 }}>Report a bug?</Text>
                    <Text style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)', fontSize: 15, lineHeight: 22, marginBottom: 28 }}>If something is not working correctly, you can report it to help improve Dawinix for everyone.</Text>
                    <TouchableOpacity style={{ backgroundColor: isDark ? '#FFF' : '#000', borderRadius: 50, paddingVertical: 17, alignItems: 'center', marginBottom: 16 }} onPress={() => { setShakeBugModalVisible(false); setTimeout(() => router.push('/bugreport'), 200); }}>
                      <Text style={{ color: isDark ? '#000' : '#FFF', fontSize: 17, fontWeight: '700' }}>Report bug</Text>
                    </TouchableOpacity>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6 }}>
                      <View>
                        <Text style={{ color: isDark ? '#FFF' : '#000', fontSize: 15, fontWeight: '600' }}>{Platform.OS === 'ios' ? 'Shake iPhone to report a bug' : 'Shake Android to report a bug'}</Text>
                        <Text style={{ color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', fontSize: 13, marginTop: 3 }}>Toggle off to disable</Text>
                      </View>
                      <Switch
                        value={shakeEnabled}
                        onValueChange={async (v) => {
                          setShakeEnabled(v);
                          await AsyncStorage.setItem('shake_bug_enabled', v ? 'true' : 'false');
                        }}
                        trackColor={{ true: '#34C759', false: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)' }}
                        thumbColor="#FFF"
                      />
                    </View>
                  </View>
                </View>
              </View>
            </Modal>

            {/* User message long-press menu — Copy only for media messages, Copy+Edit for text */}
            {msgMenuVisible && msgMenuMsg ? (() => {
              const menuBg = isDark ? 'rgba(36,36,40,0.98)' : 'rgba(255,255,255,0.97)';
              const menuTextC = isDark ? '#FFFFFF' : '#000000';
              const menuSubC = isDark ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.38)';
              const divC = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
              const createdAt = msgMenuMsg.created_at || msgMenuMsg.createdAt;
              const ts = createdAt ? new Date(createdAt) : new Date();
              const dateLabel = 'Today, ' + ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const { height: SCREEN_H } = Dimensions.get('window');
              const menuTop = Math.max(80, Math.min(msgMenuPageY - 10, SCREEN_H - 200));
              // Check if this message has media (image, file, video) — these cannot be edited
              const msgHasMedia = !!(msgMenuMsg.imageUrl || msgMenuMsg.image_url || msgMenuMsg.file_url ||
                (msgMenuMsg.content && (msgMenuMsg.content.includes('[Attached file:') || msgMenuMsg.content.includes('[Video attached:'))));
              return (
                <Modal visible={msgMenuVisible} transparent animationType="none" onRequestClose={() => setMsgMenuVisible(false)}>
                  <Pressable style={{ flex: 1 }} onPress={() => setMsgMenuVisible(false)}>
                    {Platform.OS === 'ios' ? (
                      <BlurView intensity={isDark ? 16 : 10} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
                    ) : (
                      <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(0,0,0,0.22)' : 'rgba(0,0,0,0.1)' }]} />
                    )}
                  </Pressable>
                  <View style={{ position: 'absolute', right: 14, top: menuTop, width: 218, borderRadius: 18, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: isDark ? 0.5 : 0.2, shadowRadius: 22, elevation: 22 }}>
                    {Platform.OS === 'ios' ? (
                      <BlurView intensity={isDark ? 88 : 78} tint={isDark ? 'dark' : 'extraLight'} style={{ borderRadius: 18, overflow: 'hidden' }}>
                        <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: divC }}>
                          <Text style={{ color: menuSubC, fontSize: 12, fontWeight: '500' }}>{dateLabel}</Text>
                        </View>
                        {/* Copy — always available */}
                        <TouchableOpacity
                          style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12, borderBottomWidth: msgHasMedia ? 0 : StyleSheet.hairlineWidth, borderBottomColor: divC }}
                          onPress={async () => { setMsgMenuVisible(false); await Clipboard.setStringAsync(msgMenuMsg.content || ''); showAlert('Copied', 'Message copied to clipboard'); }}
                          activeOpacity={0.65}
                        >
                          <Ionicons name="copy-outline" size={20} color={menuTextC} />
                          <Text style={{ fontSize: 17, color: menuTextC }}>Copy</Text>
                        </TouchableOpacity>
                        {/* Edit — only for plain text messages */}
                        {!msgHasMedia ? (
                          <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 }}
                            onPress={() => { setMsgMenuVisible(false); setTimeout(() => { handleEditMessage(msgMenuMsg.id, msgMenuMsg.content || ''); setTimeout(() => inputRef.current?.focus(), 100); }, 60); }}
                            activeOpacity={0.65}
                          >
                            <Ionicons name="pencil-outline" size={20} color={menuTextC} />
                            <Text style={{ fontSize: 17, color: menuTextC }}>Edit</Text>
                          </TouchableOpacity>
                        ) : null}
                      </BlurView>
                    ) : (
                      <View style={{ backgroundColor: menuBg, borderRadius: 18 }}>
                        <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: divC }}>
                          <Text style={{ color: menuSubC, fontSize: 12, fontWeight: '500' }}>{dateLabel}</Text>
                        </View>
                        {/* Copy — always available */}
                        <TouchableOpacity
                          style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12, borderBottomWidth: msgHasMedia ? 0 : StyleSheet.hairlineWidth, borderBottomColor: divC }}
                          onPress={async () => { setMsgMenuVisible(false); await Clipboard.setStringAsync(msgMenuMsg.content || ''); showAlert('Copied', 'Message copied to clipboard'); }}
                          activeOpacity={0.65}
                        >
                          <Ionicons name="copy-outline" size={20} color={menuTextC} />
                          <Text style={{ fontSize: 17, color: menuTextC }}>Copy</Text>
                        </TouchableOpacity>
                        {/* Edit — only for plain text messages */}
                        {!msgHasMedia ? (
                          <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 }}
                            onPress={() => { setMsgMenuVisible(false); setTimeout(() => { handleEditMessage(msgMenuMsg.id, msgMenuMsg.content || ''); setTimeout(() => inputRef.current?.focus(), 100); }, 60); }}
                            activeOpacity={0.65}
                          >
                            <Ionicons name="pencil-outline" size={20} color={menuTextC} />
                            <Text style={{ fontSize: 17, color: menuTextC }}>Edit</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    )}
                  </View>
                </Modal>
              );
            })() : null}

            <MessageLimitModal
              visible={messageLimitModalVisible}
              onClose={() => { messageLimitDismissedAtRef.current = (messages || []).length; setMessageLimitModalVisible(false); }}
              onNewChat={() => { setMessageLimitModalVisible(false); handleNewChat(); }}
            />

            {/* Guest mode modals */}
            <Modal visible={guestLoginModal} transparent animationType="fade" onRequestClose={() => setGuestLoginModal(false)}>
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
                <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
                <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setGuestLoginModal(false)} />
                <View style={{ backgroundColor: '#1C1C1E', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28, paddingBottom: insets.bottom + 28 }}>
                  <TouchableOpacity style={{ position: 'absolute', top: 14, right: 16, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }} onPress={() => setGuestLoginModal(false)}>
                    <Ionicons name="close" size={16} color="rgba(255,255,255,0.7)" />
                  </TouchableOpacity>
                  <Text style={{ color: '#FFF', fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 10, marginTop: 8 }}>Log in to keep chatting</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, textAlign: 'center', lineHeight: 21, marginBottom: 24 }}>You have reached your 35-message guest limit. Log in to continue chatting.</Text>
                  <View style={{ gap: 12 }}>
                    {Platform.OS === 'ios' ? (
                      <TouchableOpacity style={{ backgroundColor: '#FFFFFF', borderRadius: 50, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }} onPress={() => { setGuestLoginModal(false); router.push('/login'); }}>
                        <Ionicons name="logo-apple" size={20} color="#000" />
                        <Text style={{ color: '#000', fontSize: 16, fontWeight: '700' }}>Continue with Apple</Text>
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity style={{ backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 50, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }} onPress={() => { setGuestLoginModal(false); router.push('/login'); }}>
                      <Ionicons name="logo-google" size={20} color="#FFF" />
                      <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '600' }}>Continue with Google</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 50, paddingVertical: 15, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }} onPress={() => { setGuestLoginModal(false); router.push('/login'); }}>
                      <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '600' }}>Log in</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>

            <Modal visible={guestLockModal} transparent animationType="fade" onRequestClose={() => setGuestLockModal(false)}>
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
                <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
                <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setGuestLockModal(false)} />
                <View style={{ backgroundColor: '#1C1C1E', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28, paddingBottom: insets.bottom + 28 }}>
                  <TouchableOpacity style={{ position: 'absolute', top: 14, right: 16, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }} onPress={() => setGuestLockModal(false)}>
                    <Ionicons name="close" size={16} color="rgba(255,255,255,0.7)" />
                  </TouchableOpacity>
                  <Text style={{ color: '#FFF', fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 10, marginTop: 8 }}>Log in to try advanced features</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, textAlign: 'center', lineHeight: 21, marginBottom: 24 }}>Get smarter responses, upload files, analyze images, and more by logging in.</Text>
                  <View style={{ gap: 12 }}>
                    {Platform.OS === 'ios' ? (
                      <TouchableOpacity style={{ backgroundColor: '#FFFFFF', borderRadius: 50, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }} onPress={() => { setGuestLockModal(false); router.push('/login'); }}>
                        <Ionicons name="logo-apple" size={20} color="#000" />
                        <Text style={{ color: '#000', fontSize: 16, fontWeight: '700' }}>Continue with Apple</Text>
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity style={{ backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 50, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }} onPress={() => { setGuestLockModal(false); router.push('/login'); }}>
                      <Ionicons name="logo-google" size={20} color="#FFF" />
                      <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '600' }}>Continue with Google</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 50, paddingVertical: 15, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }} onPress={() => { setGuestLockModal(false); router.push('/login'); }}>
                      <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '600' }}>Log in</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>

            {/* Connected Apps Modal */}
            <ConnectedAppsModal
              visible={connectedAppsModalVisible}
              onClose={() => setConnectedAppsModalVisible(false)}
              connectedApps={connectedAppsList}
              onSelectApp={(app) => {
                if (app.id === 'spotify') {
                  setSpotifyActive(true);
                  inputRef.current?.focus();
                }
              }}
            />

            <MessageActionsModal
              visible={msgActionsVisible}
              onClose={() => setMsgActionsVisible(false)}
              message={msgActionsMsg || { id: '', role: 'assistant', content: '', created_at: new Date().toISOString() }}
              handleLikeMessage={handleLikeMessage}
              handleUnlikeMessage={handleUnlikeMessage}
              isLiked={msgActionsMsg ? messageLikes[msgActionsMsg.id] === 'like' : false}
              isUnliked={msgActionsMsg ? messageLikes[msgActionsMsg.id] === 'dislike' : false}
            />

            {thinkingMode === 'creating_image' && (generating || sending) ? <ImageCreatingOverlay /> : null}

            {imageAnalyzingOverlay ? (
              <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.78)', zIndex: 9998, alignItems: 'center', justifyContent: 'center' }}>
                <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
                <View style={{ alignItems: 'center', gap: 20 }}>
                  <ActivityIndicator size="large" color="#FF6B35" />
                  <Text style={{ color: '#FFF', fontSize: 19, fontWeight: '700', textAlign: 'center' }}>AI is analyzing your image...</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center' }}>This may take a moment</Text>
                </View>
              </View>
            ) : null}

            {showBlurOverlay ? (
              <Animated.View style={[styles.blurOverlayContainer, { opacity: fadeAnim }]}>
                <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={styles.blurView}>
                  <View style={styles.blurContent}>
                    <Ionicons name="lock-closed" size={40} color="rgba(255,255,255,0.8)" />
                    <Text style={styles.blurText}>Dawinix Chat</Text>
                    <TouchableOpacity style={{ marginTop: Spacing.lg, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderRadius: BorderRadius.lg }} onPress={() => { setShowBlurOverlay(false); setIsAppActive(true); }}>
                      <Text style={{ color: 'white', fontWeight: '600' }}>Unlock</Text>
                    </TouchableOpacity>
                  </View>
                </BlurView>
              </Animated.View>
            ) : null}
          </View>
        </GestureDetector>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) { console.error('HomeScreen error boundary caught:', error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>{'⚠️'}</Text>
          <Text style={{ color: '#FFF', fontSize: 22, fontWeight: '700', marginBottom: 8 }}>Something went wrong</Text>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, textAlign: 'center', marginBottom: 32 }}>{this.state.error?.message || 'An unexpected error occurred'}</Text>
          <TouchableOpacity style={{ backgroundColor: '#10A37F', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 }} onPress={() => this.setState({ hasError: false, error: null })}>
            <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '600' }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}