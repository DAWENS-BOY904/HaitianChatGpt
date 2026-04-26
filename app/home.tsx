import React, { useState, useRef, useEffect, useCallback, useMemo, Component } from 'react';
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
  Clipboard,
  Share,
  Vibration,
  Dimensions,
  Animated,
  Easing,
  Modal,
  ScrollView,
  Switch,
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
import { ToolsModal } from '../components/ToolsModal';
import { QuizModal, QuizView, QuizQuestion, QuizHistoryEntry } from '../components/QuizModal';
import { PresetsModal } from '../components/PresetsModal';
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
import { AIMode } from '../components/AIModeSelectorModal';
import { CalculatorModal, CalculatorCard, detectMathExpression } from '../components/CalculatorModal';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Input persistence helpers (8-minute TTL)
const INPUT_PERSIST_KEY = 'home_input_draft';
const INPUT_PERSIST_TTL = 8 * 60 * 1000; // 8 minutes
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
  } catch (e) {
    return null;
  }
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
  iconBtn: {
    width: 38,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 18,
  },
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

function BlurContextMenu({ visible, title, items, onClose }: {
  visible: boolean; title?: string;
  items: Array<{ label: string; icon: string; color?: string; destructive?: boolean; onPress: () => void }>;
  onClose: () => void;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 300, friction: 25, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 0.85, duration: 120, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);
  if (!visible) return null;
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={ctxStyles.backdrop} activeOpacity={1} onPress={onClose}>
        <Animated.View style={[ctxStyles.menuWrap, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
          <BlurView intensity={80} tint="dark" style={ctxStyles.blurBox}>
            {title ? (<View style={ctxStyles.titleRow}><Text style={ctxStyles.titleText} numberOfLines={1}>{title}</Text></View>) : null}
            {items.map((item, i) => (
              <TouchableOpacity key={item.label} style={[ctxStyles.menuItem, i > 0 && ctxStyles.menuItemBorder]} activeOpacity={0.6} onPress={() => { onClose(); setTimeout(item.onPress, 50); }}>
                <Text style={[ctxStyles.menuItemLabel, item.destructive && ctxStyles.destructiveLabel]}>{item.label}</Text>
                <Ionicons name={item.icon as any} size={20} color={item.destructive ? '#FF453A' : 'rgba(255,255,255,0.85)'} />
              </TouchableOpacity>
            ))}
          </BlurView>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

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
  useEffect(() => { if (visible) setText(currentTitle); }, [visible, currentTitle]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={renameStyles.backdrop}>
        <BlurView intensity={60} tint="dark" style={renameStyles.blurBg}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onCancel} />
        </BlurView>
        <Animated.View style={renameStyles.card}>
          <BlurView intensity={90} tint="dark" style={renameStyles.cardBlur}>
            <Text style={renameStyles.title}>Rename chat</Text>
            <TextInput style={renameStyles.input} value={text} onChangeText={setText} autoFocus selectTextOnFocus placeholderTextColor="rgba(255,255,255,0.4)" />
            <View style={renameStyles.btnRow}>
              <TouchableOpacity style={renameStyles.btn} onPress={onCancel}><Text style={renameStyles.btnLabel}>Cancel</Text></TouchableOpacity>
              <View style={renameStyles.btnDivider} />
              <TouchableOpacity style={renameStyles.btn} onPress={() => onConfirm(text.trim())}><Text style={[renameStyles.btnLabel, { fontWeight: '600' }]}>OK</Text></TouchableOpacity>
            </View>
          </BlurView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const renameStyles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  blurBg: { ...StyleSheet.absoluteFillObject },
  card: { position: 'absolute', width: '80%', borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 20 },
  cardBlur: { padding: 20, alignItems: 'center' },
  title: { color: '#FFF', fontSize: 17, fontWeight: '600', marginBottom: 16 },
  input: { width: '100%', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: 14, fontSize: 16, color: '#FFF', marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  btnRow: { flexDirection: 'row', width: '100%' },
  btn: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  btnLabel: { color: '#FFF', fontSize: 17 },
  btnDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.15)' },
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

function GroupStartModal({ visible, user, profilePhotoUrl, onClose, onStartGroup }: {
  visible: boolean; user: any; profilePhotoUrl: string | null; onClose: () => void; onStartGroup: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <TouchableOpacity style={grpStartStyles.closeX} onPress={onClose}>
          <View style={grpStartStyles.closeXCircle}><Ionicons name="close" size={18} color="#FFF" /></View>
        </TouchableOpacity>
        <View style={grpStartStyles.center}>
          <Text style={grpStartStyles.title}>Use Haitian AI together</Text>
          <Text style={grpStartStyles.subtitle}>Add people to your chats to plan, share ideas, and get creative.</Text>
          <TouchableOpacity style={grpStartStyles.startBtn} onPress={() => { onClose(); onStartGroup(); }}>
            <Text style={grpStartStyles.startBtnText}>Start group chat</Text>
          </TouchableOpacity>
        </View>
        <View style={grpStartStyles.profileRow}>
          <View style={grpStartStyles.profileAvatar}>
            {profilePhotoUrl ? (
              <Image source={{ uri: profilePhotoUrl }} style={{ width: 44, height: 44, borderRadius: 22 }} />
            ) : (
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="person" size={22} color="#888" />
              </View>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={grpStartStyles.profileTitle}>Set up your profile</Text>
            <Text style={grpStartStyles.profileSub}>Choose a username and photo</Text>
          </View>
          <Ionicons name="pencil-outline" size={20} color="rgba(255,255,255,0.5)" />
        </View>
      </View>
    </Modal>
  );
}

const grpStartStyles = StyleSheet.create({
  closeX: { position: 'absolute', top: 60, right: 20, zIndex: 10 },
  closeXCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  title: { color: '#FFF', fontSize: 24, fontWeight: '700', textAlign: 'center', marginBottom: 12 },
  subtitle: { color: 'rgba(255,255,255,0.55)', fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  startBtn: { backgroundColor: '#FFF', borderRadius: 30, paddingHorizontal: 40, paddingVertical: 16 },
  startBtnText: { color: '#000', fontSize: 17, fontWeight: '700' },
  profileRow: { flexDirection: 'row', alignItems: 'center', margin: 16, marginBottom: 40, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 14, gap: 12 },
  profileAvatar: { marginRight: 4 },
  profileTitle: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  profileSub: { color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 2 },
});

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
            <Text style={customStyles.title}>Customize Haitian AI</Text>
            <Text style={customStyles.sectionLabel}>Custom instructions</Text>
            <TextInput style={customStyles.textArea} value={instructions} onChangeText={setInstructions} placeholder="Get tailored responses by adding details about your group." placeholderTextColor="rgba(255,255,255,0.35)" multiline numberOfLines={4} />
            <View style={customStyles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={customStyles.toggleLabel}>Respond automatically</Text>
                <Text style={customStyles.toggleSub}>Answers automatically</Text>
              </View>
              <Switch value={respondAuto} onValueChange={setRespondAuto} trackColor={{ true: '#34C759', false: 'rgba(255,255,255,0.2)' }} thumbColor="#FFF" />
            </View>
            <Text style={customStyles.note}>Group chat custom instructions are separate from your personal Haitian AI instructions.</Text>
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

function InviteLinkModal({ visible, onClose, isPlus }: { visible: boolean; onClose: () => void; isPlus: boolean }) {
  const link = 'https://dawinix.com/invite';
  const handleShare = async () => { try { await Share.share({ message: `Join my Haitian AI group chat!\n\n${link}`, url: link }); } catch (e) {} onClose(); };
  const handleCopy = () => { Clipboard.setString(link); onClose(); };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
      <View style={{ borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' }}>
        <BlurView intensity={90} tint="dark" style={{ padding: 24 }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', alignSelf: 'center', marginBottom: 16 }} />
          <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '700', marginBottom: 6 }}>Group link</Text>
          <Text style={{ color: '#007AFF', fontSize: 13, marginBottom: 20 }} numberOfLines={1}>{link}</Text>
          {[
            { icon: 'copy-outline', label: 'Copy link', onPress: handleCopy },
            { icon: 'share-outline', label: 'Share link', onPress: handleShare },
          ].map((item, i) => (
            <TouchableOpacity key={item.label} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 16, borderTopWidth: i > 0 ? StyleSheet.hairlineWidth : 0, borderTopColor: 'rgba(255,255,255,0.1)' }} onPress={item.onPress}>
              <Ionicons name={item.icon as any} size={22} color="#FFF" />
              <Text style={{ color: '#FFF', fontSize: 17 }}>{item.label}</Text>
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
      <Text style={tmpStyles.title}>Temporary chat</Text>
      <Text style={tmpStyles.body}>This chat will not appear in history, use or update Haitian AI memory, or be used to train our models.{'\n\n'}For safety purposes, we may keep a copy of this chat for up to 30 days.</Text>
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
            <Text style={notifStyles.body}>Haitian AI can notify you when your AI response is ready.</Text>
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

export default function HomeScreen() {
  const { colors, isDark } = useTheme();
  const { settings, updateSetting } = useSettings();
  const { user } = useAuth();
  const { canSendMessage, coins, isUnlimited, incrementMessageCount, isAdmin: rawIsAdmin } = useGuestLimits();
  // Admin emails always get both pro & plus plan access
  const ADMIN_EMAILS = ['berryxoe@gmail.com', 'newdawens@gmail.com', 'kontgithub@gmail.com'];
  const isAdminEmail = user?.email ? ADMIN_EMAILS.includes(user.email.toLowerCase()) : false;
  const isAdmin = rawIsAdmin || isAdminEmail;
  const { isPro } = useSubscription();
  const {
    conversations, messages, currentConversation,
    sendMessage, updateMessageAndRegenerate, createConversation, deleteConversation,
    loading, streamingMessageId, updateConversationTitle, archiveConversation,
    selectConversation, temporaryMode: ctxTempMode, setTemporaryMode: ctxSetTempMode,
    cancelSendMessage,
  } = useConversation();
  const { showAlert } = useAlert();
  const router = useRouter();
  const params = useLocalSearchParams<{ fromImages?: string; imageBase64?: string; imagePrompt?: string }>();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  const [isAppActive, setIsAppActive] = useState(true);
  const [showBlurOverlay, setShowBlurOverlay] = useState(false);
  const [inputText, setInputText] = useState('');
  const draftSaveTimer = useRef<NodeJS.Timeout | null>(null);
  const [toolsVisible, setToolsVisible] = useState(false);
  const [conversationMenuVisible, setConversationMenuVisible] = useState(false);
  const [sideMenuVisible, setSideMenuVisible] = useState(false);
  const [chatHistoryVisible, setChatHistoryVisible] = useState(false);
  const isGuest = !user;
  const [guestMessageCount, setGuestMessageCount] = useState(0);
  const GUEST_MESSAGE_LIMIT = 35;
  const [guestLoginModal, setGuestLoginModal] = useState(false);
  const [guestLockModal, setGuestLockModal] = useState(false);
  const [guestLockFeature, setGuestLockFeature] = useState('');
  const [currentAIMode, setCurrentAIMode] = useState<AIMode>('instant');
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
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [calcVisible, setCalcVisible] = useState(false);
  const [calcExpression, setCalcExpression] = useState('');
  const [calcResult, setCalcResult] = useState('');
  const [quizModalVisible, setQuizModalVisible] = useState(false);
  const [quizConnectVisible, setQuizConnectVisible] = useState(false);
  const [quizConnectDetailVisible, setQuizConnectDetailVisible] = useState(false);
  const [quizTopicVisible, setQuizTopicVisible] = useState(false);
  const [selectedQuizTopic, setSelectedQuizTopic] = useState('');
  const [quizGenerating, setQuizGenerating] = useState(false);
  const [quizMode, setQuizMode] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState('Medium');
  const [customTopicInput, setCustomTopicInput] = useState('');
  const [quizHistory, setQuizHistory] = useState<QuizHistoryEntry[]>([]);
  const [presetsModalVisible, setPresetsModalVisible] = useState(false);
  const [thinkingMode, setThinkingMode] = useState<'thinking' | 'creating_image' | 'analyzing' | 'editing_image'>('thinking');
  const [showCompletionStatus, setShowCompletionStatus] = useState(false);
  // Image-from-images-page overlay
  const [imageAnalyzingOverlay, setImageAnalyzingOverlay] = useState(false);
  const [savedImageUrls, setSavedImageUrls] = useState<Set<string>>(new Set());
  const [savingImageId, setSavingImageId] = useState<string | null>(null);
  // Message reactions
  const [likedMessages, setLikedMessages] = useState<Set<string>>(new Set());
  const [unlikedMessages, setUnlikedMessages] = useState<Set<string>>(new Set());
  const [feedbackToastId, setFeedbackToastId] = useState<string | null>(null);
  const [dislikeFeedbackVisible, setDislikeFeedbackVisible] = useState(false);
  const [dislikeTargetId, setDislikeTargetId] = useState<string | null>(null);
  const [dislikeIssue, setDislikeIssue] = useState('');
  const [dislikeCustomText, setDislikeCustomText] = useState('');
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
  useEffect(() => { if (ctxSetTempMode) ctxSetTempMode(temporaryChatMode); }, [temporaryChatMode]);
  const [customizeAIVisible, setCustomizeAIVisible] = useState(false);
  const [inviteLinkVisible, setInviteLinkVisible] = useState(false);
  const [groupCustomInstructions, setGroupCustomInstructions] = useState('');
  const [groupRespondAuto, setGroupRespondAuto] = useState(true);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [expandInputVisible, setExpandInputVisible] = useState(false);
  const [expandedText, setExpandedText] = useState('');
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentionPopup, setShowMentionPopup] = useState(false);
  const [filteredMentionMembers, setFilteredMentionMembers] = useState<GroupMember[]>([]);
  const [userProfilePhoto, setUserProfilePhoto] = useState<string | null>(null);
  const pushTokenRef = useRef<string | null>(null);

  // ── Handle incoming image from images page ──
  useEffect(() => {
    if (params.fromImages === '1' && params.imageBase64) {
      setImageAnalyzingOverlay(true);
      const base64 = params.imageBase64;
      const promptText = params.imagePrompt || 'Analyze and describe this image in detail. Tell me everything you see.';
      (async () => {
        try {
          let convId = currentConversation?.id;
          if (!convId) { convId = await createConversation(); }
          if (!convId) return;
          await sendMessage(promptText, undefined, base64, false, currentAIModel);
        } catch (e) {}
        finally { setImageAnalyzingOverlay(false); }
      })();
    }
  }, [params.fromImages]);

  // ── Save AI-generated image to My Images gallery ──
  const handleLikeMessage = useCallback((messageId: string) => {
    const alreadyLiked = likedMessages.has(messageId);
    if (alreadyLiked) {
      setLikedMessages(prev => { const s = new Set(prev); s.delete(messageId); return s; });
      setFeedbackToastId(null);
    } else {
      setLikedMessages(prev => new Set([...prev, messageId]));
      setUnlikedMessages(prev => { const s = new Set(prev); s.delete(messageId); return s; });
      setFeedbackToastId(messageId);
      setTimeout(() => setFeedbackToastId(curr => curr === messageId ? null : curr), 3500);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [likedMessages]);

  const handleUnlikeMessage = useCallback((messageId: string) => {
    const alreadyUnliked = unlikedMessages.has(messageId);
    if (alreadyUnliked) {
      setUnlikedMessages(prev => { const s = new Set(prev); s.delete(messageId); return s; });
    } else {
      setUnlikedMessages(prev => new Set([...prev, messageId]));
      setLikedMessages(prev => { const s = new Set(prev); s.delete(messageId); return s; });
      setFeedbackToastId(null);
      setDislikeTargetId(messageId);
      setDislikeIssue('');
      setDislikeCustomText('');
      setDislikeFeedbackVisible(true);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [unlikedMessages]);

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

  // Load persisted draft on mount
  useEffect(() => {
    loadDraft().then(draft => { if (draft) setInputText(draft); });
    // Clear stale draft after 8 min
    const clearTimer = setTimeout(() => clearDraft(), INPUT_PERSIST_TTL);
    return () => clearTimeout(clearTimer);
  }, []);

  const handleInputChange = useCallback(async (txt: string) => {
    const safeTxt = txt ?? '';
    const byteLength = new TextEncoder().encode(safeTxt).length;
    const looksLikeCode = /```|function |const |import |class |def |<\w+>|\{[\s\S]{40,}\}/.test(safeTxt);
    if (byteLength > 4000 && looksLikeCode) {
      try {
        const fileName = `code_${Date.now()}.txt`;
        const filePath = (FileSystem.cacheDirectory || '') + fileName;
        await FileSystem.writeAsStringAsync(filePath, safeTxt, { encoding: FileSystem.EncodingType.UTF8 });
        const newFile: MediaFile = { type: 'document', uri: filePath, name: fileName, mimeType: 'text/plain' };
        setSelectedMedia(prev => [...prev, newFile]);
        setInputText('');
        showAlert('Code file created', `Pasted code saved as "${fileName}" and attached.`);
      } catch (e) { setInputText(safeTxt); }
      return;
    }
    setInputText(safeTxt);
    // Debounce draft save (300ms)
    if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    draftSaveTimer.current = setTimeout(() => saveDraft(safeTxt), 300);
    try { setCodeLangChips(/```\w*$/.test(safeTxt)); } catch (_e) { setCodeLangChips(false); }
    if (groupChatMode) {
      const atMatch = safeTxt.match(/@(\w*)$/);
      if (atMatch !== null) { setMentionQuery(atMatch[1] || ''); setShowMentionPopup(true); }
      else { setShowMentionPopup(false); setMentionQuery(''); }
    }
  }, [groupChatMode, showAlert]);

  const wasGeneratingRef = useRef(false);
  const appStateForNotifRef = useRef(AppState.currentState);
  const runOnJS_setSideMenu = useCallback((val: boolean) => setSideMenuVisible(val), []);

  useEffect(() => {
    if (user?.id) {
      supabase.from('user_profiles').select('profile_photo_url').eq('id', user.id).single().then(({ data }) => {
        if (data?.profile_photo_url) setUserProfilePhoto(data.profile_photo_url);
      });
    }
  }, [user?.id]);

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
          const ttl = currentConversation?.title || 'Haitian AI';
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
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recentConvs } = await supabase.from('conversations').select('id').eq('user_id', user.id).gte('updated_at', sevenDaysAgo).limit(10);
      if (!recentConvs || recentConvs.length === 0) { setSmartSuggestions(fallback); return; }
      const convIds = recentConvs.map((c: any) => c.id);
      const { data: recentMsgs } = await supabase.from('messages').select('content').in('conversation_id', convIds).eq('role', 'user').gte('created_at', sevenDaysAgo).order('created_at', { ascending: false }).limit(20);
      if (!recentMsgs || recentMsgs.length === 0) { setSmartSuggestions(fallback); return; }
      const topics = recentMsgs.map((m: any) => (m.content || '').slice(0, 60)).filter(Boolean);
      const generated: Array<{title: string; sub: string}> = [];
      const allText = topics.join(' ').toLowerCase();
      if (allText.includes('html') || allText.includes('web')) generated.push({ title: 'Improve my HTML', sub: 'continue where we left off' });
      if (allText.includes('python') || allText.includes('script')) generated.push({ title: 'Write a Python script', sub: 'to automate your task' });
      if (allText.includes('translate') || allText.includes('tradiksyon')) generated.push({ title: 'Translate to English', sub: 'from Haitian Creole' });
      if (allText.includes('image') || allText.includes('logo')) generated.push({ title: 'Create an image', sub: 'like we discussed' });
      if (generated.length < 4 && topics.length > 0) {
        const t = topics[0].slice(0, 30);
        if (t.length > 5) generated.push({ title: 'Continue: ' + t, sub: 'pick up from last time' });
      }
      const merged = [...generated, ...fallback].slice(0, 4);
      setSmartSuggestions(merged.length > 0 ? merged : fallback);
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

  const swipeGesture = Gesture.Pan()
    .activeOffsetX([20, 10000])
    .failOffsetY([-10, 10])
    .onEnd((e) => {
      if (e.translationX > 60 && e.velocityX > 100 && !sideMenuVisible) {
        runOnJS(runOnJS_setSideMenu)(true);
      }
    });

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(100)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const flatListRef = useRef<FlatList>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioPermissionRef = useRef<boolean>(false);
  const isRecordingRef = useRef<boolean>(false);
  const stopTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const autoLockTimerRef = useRef<NodeJS.Timeout | null>(null);
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
        if (currentConversation?.id) selectConversation(currentConversation.id);
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
      return () => { slideAnim.setValue(100); };
    }, [fadeAnim, slideAnim])
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
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      const subscription = Accelerometer.addListener(({ x, y, z }) => {
        const acceleration = Math.sqrt(x * x + y * y + z * z);
        const now = Date.now();
        if (acceleration > SHAKE_THRESHOLD && now - lastShake > SHAKE_COOLDOWN) {
          setLastShake(now);
          Vibration.vibrate(500);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          router.push('/bugreport');
        }
      });
      Accelerometer.setUpdateInterval(100);
      return () => subscription.remove();
    }
    return () => {};
  }, [lastShake, router]);

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
    // Request fresh permission
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
      // Clean up first
      await cleanupRecording();
      await new Promise(r => setTimeout(r, 250));

      // Set audio mode for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
        interruptionModeIOS: 1,
        interruptionModeAndroid: 1,
      });

      // Extra Android stabilization
      if (Platform.OS === 'android') await new Promise(r => setTimeout(r, 200));

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setRecordingState('recording');
      isRecordingRef.current = true;
      startRecordingTimer();

      const { recording } = await Audio.Recording.createAsync({
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: { mimeType: 'audio/webm;codecs=opus', bitsPerSecond: 64000 },
      });

      recordingRef.current = recording;
      stopTimeoutRef.current = setTimeout(() => {
        if (isRecordingRef.current) stopVoiceRecording();
      }, MAX_RECORDING_DURATION * 1000);

    } catch (error: any) {
      console.log('[Recording] Failed to start:', error?.message);
      await cleanupRecording();

      // On Android, sometimes the audio session is locked — try resetting
      if (Platform.OS === 'android') {
        try {
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            shouldDuckAndroid: false,
            playThroughEarpieceAndroid: false,
            staysActiveInBackground: false,
          });
          await new Promise(r => setTimeout(r, 500));
        } catch {}
      }

      Alert.alert(
        'Recording Failed',
        Platform.OS === 'android'
          ? 'Could not start microphone. Please close other apps using the mic and try again.'
          : 'Could not start recording. Make sure no other app is using the microphone.',
        [
          { text: 'Try Again', onPress: () => setTimeout(startVoiceRecording, 600) },
          { text: 'OK', style: 'cancel' },
        ]
      );
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
      try { atob(base64Audio.slice(0, 100)); } catch (_e) { throw new Error('Audio format error. Please try again.'); }
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

  // ── handleSend: capture inputs before clearing state ──
  const handleSend = async () => {
    const currentText = inputText.trim();
    const currentMedia = [...selectedMedia];
    const currentEditingId = editingMessageId;

    if ((!currentText && currentMedia.length === 0) || sending) return;

    // Guest: block photo/file uploads
    if (isGuest && currentMedia.length > 0) {
      setGuestLockFeature('file upload');
      setGuestLockModal(true);
      return;
    }

    if (isGuest) {
      if (guestMessageCount >= GUEST_MESSAGE_LIMIT) {
        setGuestLoginModal(true);
        return;
      }
      // Guests CAN send messages (up to 35)
    } else if (!currentEditingId && !canSendMessage() && sessionBonusMessages <= 0) {
      if (!user) {
        showAlert('Sign In Required', 'Sign in to start chatting with AI.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign In', onPress: () => router.push('/login') }]);
      } else {
        showAlert('Credits Required', 'You need credits to continue.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Buy Credits', onPress: () => router.push('/buy-coins') }]);
      }
      return;
    }

    let conversationId = currentConversation?.id;
    if (!conversationId) {
      conversationId = await createConversation();
      if (!conversationId) { showAlert('Error', 'Failed to create conversation'); return; }
    }

    // Clear input immediately + clear draft
    setInputText('');
    setSelectedMedia([]);
    setEditingMessageId(null);
    clearDraft();
    // Detect intent for thinking indicator
    const lowerText = (currentText || '').toLowerCase();
    const isImageIntent = [
      'create a logo', 'create logo', 'generate logo', 'make a logo', 'design a logo',
      'generate a logo', 'make me a logo', 'design me a logo',
      'create an image', 'create image', 'generate image', 'make an image', 'generate an image of',
      'generate a photo', 'create a photo', 'make a photo',
      'generate a picture', 'make a picture', 'create a picture', 'generate a picture of',
      'draw me a', 'draw me an', 'paint me a', 'illustrate a', 'sketch me a',
      'create art', 'generate art', 'make art', 'create artwork', 'generate artwork',
      'create an icon', 'generate icon', 'make an icon', 'design an icon',
      'create a banner', 'generate banner', 'make a banner', 'design a banner',
      'generate thumbnail', 'create an illustration', 'generate an illustration',
      'kreye logo', 'fe logo', 'fe imaj', 'kreye yon imaj', 'kreye imaj',
      'fè logo', 'fè yon logo', 'fè imaj', 'fè yon imaj',
      'kreye foto', 'kreye yon foto', 'fè foto', 'fè yon foto',
      'créer un logo', 'générer une image', 'créer une image', 'faire un logo',
      'crear un logo', 'generar una imagen', 'crear una imagen', 'hacer un logo',
    ].some(kw => lowerText.includes(kw));
    setThinkingMode(isImageIntent ? 'creating_image' : 'thinking');
    setSending(true);
    setGenerating(true);

    try {
      if (currentEditingId) {
        await updateMessageAndRegenerate(currentEditingId, currentText, currentAIModel);
        return;
      }

      let base64Image: string | undefined;
      if (currentMedia.length > 0 && currentMedia[0].type === 'image') {
        if (currentMedia[0].base64) {
          base64Image = currentMedia[0].base64;
        } else if (currentMedia[0].uri) {
          try { base64Image = await FileSystem.readAsStringAsync(currentMedia[0].uri, { encoding: FileSystem.EncodingType.Base64 }); } catch (e) {}
        }
      }

      // Image-only: send empty string so AI knows it's a pure image analysis request
      let finalText = currentText || '';
      if (groupChatMode && groupCustomInstructions && groupRespondAuto) {
        finalText = `[System instruction: ${groupCustomInstructions}]\n\n${finalText}`;
      }
      if (groupChatMode && !groupRespondAuto) { setSending(false); setGenerating(false); return; }

      const atTagMatch = finalText.match(/@(\w+)/);
      if (groupChatMode && atTagMatch) {
        const taggedName = atTagMatch[1].toLowerCase();
        if (groupMembers.some(m => m.username.toLowerCase() === taggedName)) { setSending(false); setGenerating(false); return; }
      }

      await sendMessage(finalText, undefined, base64Image, false, currentAIModel);
      setShowCompletionStatus(true);
      setTimeout(() => setShowCompletionStatus(false), 2000);
      if (user && !isUnlimited && !isAdmin) {
        if (sessionBonusMessages > 0) setSessionBonusMessages(prev => prev - 1);
        else await incrementMessageCount();
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
      if (isGuest) setGuestMessageCount(prev => prev + 1);
    }
  };

  const handleStopGeneration = useCallback(() => {
    cancelSendMessage();
    setSending(false);
    setGenerating(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [cancelSendMessage]);

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
    { question: 'Boiling point of water (°C)?', options: ['90°C', '95°C', '100°C', '110°C'], answer: 2, explanation: 'Water boils at 100°C at sea level.' },
    { question: 'Fastest land animal?', options: ['Lion', 'Cheetah', 'Horse', 'Leopard'], answer: 1, explanation: 'The cheetah can run up to 120 km/h.' },
  ];

  // ── Fetch quiz history ──
  const fetchQuizHistory = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data } = await supabase
        .from('quiz_scores')
        .select('topic, difficulty, score, total, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);
      if (data) setQuizHistory(data as QuizHistoryEntry[]);
    } catch (_e) {}
  }, [user?.id, supabase]);

  useEffect(() => {
    if (quizMode && user?.id) fetchQuizHistory();
  }, [quizMode, user?.id]);

  // ── AI-powered quiz generation ──
  const generateAIQuizQuestions = async (topic: string, difficulty: string = 'Medium'): Promise<QuizQuestion[]> => {
    const topicLabel = topic || 'General Knowledge';
    const difficultyInstructions: Record<string, string> = {
      Easy: 'Make the questions simple and beginner-friendly. Use straightforward facts and obvious distractors.',
      Medium: 'Make the questions moderately challenging with plausible distractors. Suitable for general knowledge.',
      Hard: 'Make the questions difficult and detailed, requiring deeper knowledge. Distractors should be close to the correct answer.',
      Expert: 'Make the questions expert-level and very challenging. Include tricky edge cases, specialized knowledge, and very similar-looking options that require deep understanding.',
    };
    const difficultyHint = difficultyInstructions[difficulty] || difficultyInstructions.Medium;
    const prompt = `Generate exactly 10 multiple-choice quiz questions about ${topicLabel}. Difficulty: ${difficulty}. ${difficultyHint} Return ONLY a valid JSON array with no extra text, markdown, or code fences. Use this exact format:\n[{"question":"...","options":["Option A","Option B","Option C","Option D"],"answer":0,"explanation":"..."}]\nThe "answer" field must be the 0-based index of the correct option.`;
    try {
      const { data, error } = await supabase.functions.invoke('chat', {
        body: {
          messages: [{ role: 'user', content: prompt }],
          model: currentAIModel,
          conversationId: 'quiz-gen',
          userId: user?.id,
        },
      });
      if (error) throw error;
      const raw = data?.content || data?.message || data?.response || '';
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('No JSON array found in response');
      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Empty or invalid array');
      return parsed.slice(0, 10).map((q: any, i: number) => ({
        question: String(q.question || `Question ${i + 1}`),
        options: Array.isArray(q.options) ? q.options.slice(0, 4).map(String) : ['A', 'B', 'C', 'D'],
        answer: typeof q.answer === 'number' ? Math.min(3, Math.max(0, q.answer)) : 0,
        explanation: String(q.explanation || ''),
      }));
    } catch (err) {
      console.log('[Quiz] AI generation failed, using fallback:', err);
      return generateQuizQuestions(topicLabel);
    }
  };

  const handleLaunchQuiz = async (topic: string) => {
    setQuizTopicVisible(false);
    setQuizConnectDetailVisible(false);
    setQuizGenerating(true);
    // Close keyboard & scroll to bottom so quiz is fully visible
    Keyboard.dismiss();
    try {
      const questions = await generateAIQuizQuestions(topic, selectedDifficulty);
      showInlineQuiz(questions);
    } catch (e) {
      showInlineQuiz(generateQuizQuestions(topic));
    } finally {
      setQuizGenerating(false);
    }
  };

  // ── Show quiz inline in chat when AI generates one ──
  const [inlineQuizVisible, setInlineQuizVisible] = useState(false);
  const [inlineQuizQuestions, setInlineQuizQuestions] = useState<QuizQuestion[]>([]);

  const showInlineQuiz = useCallback((questions: QuizQuestion[]) => {
    setInlineQuizQuestions(questions);
    setInlineQuizVisible(true);
    // Scroll to bottom so quiz is visible
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
  }, []);

  const handleQuizViewResults = async (answers: any[], questions: QuizQuestion[]) => {
    setQuizModalVisible(false);
    setInlineQuizVisible(false);
    const correct = answers.filter(a => a.correct).length;
    const topic = customTopicInput.trim() || selectedQuizTopic || 'General Knowledge';

    // Save score to database
    if (user?.id) {
      try {
        await supabase.from('quiz_scores').insert({
          user_id: user.id,
          topic,
          difficulty: selectedDifficulty,
          score: correct,
          total: questions.length,
        });
        fetchQuizHistory();
      } catch (_e) {}
    }

    // AI sends the score summary (not the user)
    const resultLines = questions.map((q, i) => {
      const ans = answers.find((a: any) => a.questionIndex === i);
      const chosen = ans ? q.options[ans.chosenIndex] : 'Skipped';
      const isCorrect = ans?.correct;
      return `${i + 1}. **${q.question}**\n${isCorrect ? '\u2705' : '\u274c'} ${chosen}${!isCorrect ? ` (Correct: ${q.options[q.answer]})` : ''}`;
    }).join('\n');

    const pct = Math.round((correct / questions.length) * 100);
    const emoji = pct === 100 ? '\uD83C\uDF89' : pct >= 80 ? '\uD83D�' : pct >= 60 ? '\uD83D\uDC4D' : pct >= 40 ? '\uD83D\uDCDA' : '\uD83D\uDCAA';
    const summaryPrompt = `The user just completed a quiz on ${topic} (${selectedDifficulty} difficulty) and scored ${correct}/${questions.length} (${pct}%). Please present their quiz results clearly and encouragingly. Here are the answers:\n\n${resultLines}\n\nEnd your message by asking if they want to try a harder quiz or a different topic.`;
    // Send as user message so AI responds with the formatted results
    try {
      let convId = currentConversation?.id;
      if (!convId) { convId = await createConversation() || undefined; }
      setSending(true); setGenerating(true);
      await sendMessage(summaryPrompt, undefined, undefined, false, currentAIModel);
    } catch (_e) {}
    finally { setSending(false); setGenerating(false); }
  };

  const handleHarderQuiz = () => {
    setQuizModalVisible(false);
    setInlineQuizVisible(false);
    setQuizTopicVisible(false);
    setInputText('Make me a harder quiz');
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleTryAnotherQuiz = () => {
    setSelectedQuizTopic('');
    setCustomTopicInput('');
    setQuizTopicVisible(true);
  };
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [createConversation, messages]);

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

  const handleCopyMessage = useCallback(async (content: string) => { await Clipboard.setString(content); showAlert('Copied', 'Message copied to clipboard'); }, [showAlert]);

  const handleAddPeople = useCallback(async () => {
    setConversationMenuVisible(false);
    showAlert('Adding people...', 'Setting up group chat...');
    await new Promise(r => setTimeout(r, 1200));
    setGroupChatMode(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [showAlert]);

  const handleStartGroupChat = useCallback(() => {
    setGroupStartModalVisible(false);
    setGroupChatMode(true);
    setTemporaryChatMode(false);
    handleNewChat();
  }, [handleNewChat]);

  const renderMessage = useCallback(({ item }: { item: any }) => {
    const isStreaming = streamingMessageId === item.id;
    const mathData = item.role === 'assistant' ? detectMathExpression(item.content) : null;
    // Detect if the AI message contains an image URL
    const imageUrlMatch = item.role === 'assistant'
      ? (item.content || '').match(/https?:\/\/[^\s"')]+\.(?:jpg|jpeg|png|webp|gif)/i)
      : null;
    const detectedImageUrl: string | null = imageUrlMatch ? imageUrlMatch[0] : (item.imageUrl || null);
    const alreadySaved = detectedImageUrl ? savedImageUrls.has(detectedImageUrl) : false;
    const isSavingThis = savingImageId === item.id;
    const isLiked = likedMessages.has(item.id);
    const isUnliked = unlikedMessages.has(item.id);
    const showFeedbackToast = feedbackToastId === item.id;
    return (
      <View>
        <MessageItem
          message={item}
          onCancel={handleCancelGeneration}
          onEdit={handleEditMessage}
          onCopy={() => handleCopyMessage(item.content)}
          isGenerating={isStreaming}
          streaming={isStreaming}
          streamingSpeed={isStreaming ? 18 : 0}
          isOffline={isOffline}
          onChunkRendered={() => { if (isAtBottom) flatListRef.current?.scrollToEnd({ animated: false }); }}
        />
        {mathData ? (
          <CalculatorCard
            expression={mathData.expression}
            result={mathData.result}
            onOpen={() => { setCalcExpression(mathData.expression); setCalcResult(mathData.result); setCalcVisible(true); }}
          />
        ) : null}
        {/* Like/Unlike reaction row — AI messages only */}
        {item.role === 'assistant' && !item.isDeleted ? (
          <View style={{ paddingHorizontal: 16, paddingBottom: 4 }}>
            {showFeedbackToast ? (
              <View style={{ overflow: 'hidden', borderRadius: 14, alignSelf: 'flex-start', marginBottom: 6 }}>
                {Platform.OS === 'ios' ? (
                  <BlurView intensity={70} tint={isDark ? 'dark' : 'light'} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 9 }}>
                    <Ionicons name="checkmark-circle" size={15} color="#30D158" />
                    <Text style={{ color: isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.78)', fontSize: 13, fontWeight: '600' }}>Thank you for your feedback!</Text>
                    <TouchableOpacity onPress={() => setFeedbackToastId(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close" size={13} color={isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)'} />
                    </TouchableOpacity>
                  </BlurView>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: isDark ? 'rgba(44,44,46,0.95)' : 'rgba(242,242,247,0.97)', borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', borderRadius: 14 }}>
                    <Ionicons name="checkmark-circle" size={15} color="#30D158" />
                    <Text style={{ color: isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.78)', fontSize: 13, fontWeight: '600' }}>Thank you for your feedback!</Text>
                    <TouchableOpacity onPress={() => setFeedbackToastId(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close" size={13} color={isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)'} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <TouchableOpacity
                onPress={() => handleLikeMessage(item.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ padding: 4 }}
              >
                <Ionicons
                  name={isLiked ? 'thumbs-up' : 'thumbs-up-outline'}
                  size={17}
                  color={isLiked ? accentColor : colors.textSecondary}
                />
              </TouchableOpacity>
              {!isLiked ? (
                <TouchableOpacity
                  onPress={() => handleUnlikeMessage(item.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{ padding: 4 }}
                >
                  <Ionicons
                    name={isUnliked ? 'thumbs-down' : 'thumbs-down-outline'}
                    size={17}
                    color={isUnliked ? '#FF453A' : colors.textSecondary}
                  />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ) : null}
        {/* Save to My Images button — shown on AI messages with image URLs */}
        {item.role === 'assistant' && detectedImageUrl && user?.id ? (
          <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                alignSelf: 'flex-start',
                backgroundColor: alreadySaved ? 'rgba(48,209,88,0.12)' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
                borderRadius: 20,
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderWidth: 1,
                borderColor: alreadySaved ? 'rgba(48,209,88,0.35)' : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'),
              }}
              onPress={() => !alreadySaved && handleSaveToMyImages(detectedImageUrl, item.id)}
              disabled={alreadySaved || isSavingThis}
              activeOpacity={0.75}
            >
              {isSavingThis ? (
                <ActivityIndicator size="small" color="#30D158" />
              ) : (
                <Ionicons name={alreadySaved ? 'checkmark-circle' : 'image-outline'} size={15} color={alreadySaved ? '#30D158' : colors.textSecondary} />
              )}
              <Text style={{ fontSize: 13, fontWeight: '600', color: alreadySaved ? '#30D158' : colors.textSecondary }}>
                {alreadySaved ? 'Saved to My Images' : 'Save to My Images'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  }, [streamingMessageId, handleCancelGeneration, handleEditMessage, handleCopyMessage, isOffline, isAtBottom, savedImageUrls, savingImageId, handleSaveToMyImages, user?.id, isDark, colors]);

  const renderMediaPreview = useCallback(() => {
    if (selectedMedia.length === 0) return null;
    return (
      <View style={{ paddingHorizontal: 16, paddingBottom: 8, paddingTop: 6 }}>
        {selectedMedia.map((media, index) => (
          <View key={`${media.uri}-${index}`} style={{ position: 'relative', marginBottom: 6, alignSelf: 'flex-start' }}>
            {media.type === 'image' ? (
              <View style={{ width: 160, height: 160, borderRadius: 16, overflow: 'hidden', backgroundColor: '#222' }}>
                <ExpoImage source={{ uri: media.uri }} style={{ width: 160, height: 160 }} contentFit="cover" />
              </View>
            ) : (
              <View style={[styles.documentPreview, { width: 160 }]}>
                <Ionicons name="document-text" size={24} color={colors.textSecondary} />
                <Text style={styles.documentName} numberOfLines={1}>{media.name || 'Document'}</Text>
              </View>
            )}
            <TouchableOpacity
              style={{ position: 'absolute', top: -6, right: -6, backgroundColor: '#111', borderRadius: 16, width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#222' }}
              onPress={() => removeMedia(index)}
            >
              <Ionicons name="close" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ))}
      </View>
    );
  }, [selectedMedia, removeMedia, colors]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, paddingTop: Platform.select({ ios: insets.top, android: StatusBar.currentHeight || 0, default: 0 }) },
    headerEmpty: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.background },
    upgradeBtn: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, gap: 4 },
    upgradeBtnText: { fontWeight: '600' },
    headerEmptyRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerIconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
    headerChat: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, backgroundColor: colors.background, gap: 10 },
    headerChatLeft: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    headerChatTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.text },
    headerChatRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    headerChatEditBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7', borderRadius: 18, paddingHorizontal: 10, paddingVertical: 7, gap: 5 },
    blurOverlayContainer: { ...StyleSheet.absoluteFillObject, zIndex: 9999, justifyContent: 'center', alignItems: 'center' },
    blurView: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
    blurContent: { alignItems: 'center', justifyContent: 'center' },
    blurText: { fontSize: 24, fontWeight: 'bold', color: 'white', marginTop: 16 },
    messagesContainer: { flex: 1 },
    inputContainer: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 10, paddingBottom: Platform.select({ ios: insets.bottom + 8, android: insets.bottom + 8, default: 8 }), paddingTop: 8, gap: 8, backgroundColor: Platform.OS === 'ios' ? 'transparent' : colors.background },
    inputWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#1C1C1E' : '#F0F0F5', borderRadius: 28, paddingHorizontal: 14, paddingVertical: 4, minHeight: 48, maxHeight: 120, gap: 6 },
    input: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: 12, maxHeight: 100 },
    recordingContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
    recordingDuration: { color: '#FF3B30', fontSize: 13, fontWeight: '600', minWidth: 36 },
    addBtn: { width: 42, height: 42, borderRadius: 21, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
    micBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
    sendButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 2 },
    stopButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FF3B30', alignItems: 'center', justifyContent: 'center' },
    voiceOrbBtn: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', marginBottom: 2, shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: 4 },
    emptyState: { flex: 1 },
    loadingContainer: { padding: Spacing.md, alignItems: 'center' },
    documentPreview: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', padding: 4 },
    documentName: { fontSize: 8, color: colors.textSecondary, marginTop: 2 },
    editingIndicator: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, backgroundColor: `${colors.primary}20`, borderBottomWidth: 1, borderBottomColor: colors.border },
    editingText: { fontSize: 12, color: colors.primary, flex: 1 },
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

  const displayMessages = isSearchMode && searchQuery ? filteredMessages : (messages || []);
  const showSendButton = inputText.trim().length > 0 || selectedMedia.length > 0;
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
    const text = `${suggestion.title} — ${suggestion.sub}`;
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

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <GestureDetector gesture={swipeGesture}>
          <View style={{ flex: 1 }}>
            <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
              <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

              {isOffline ? (
                <View style={styles.offlineBanner}>
                  <Text style={styles.offlineText}>No connection — some features unavailable</Text>
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
                  {/* Left side: hamburger + compact upgrade pill */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TouchableOpacity onPress={() => setSideMenuVisible(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Ionicons name="menu" size={24} color={colors.text} />
                    </TouchableOpacity>
                    {!isGuest && !isPro ? (
                      Platform.OS === 'ios' ? (
                        <BlurView
                          intensity={isDark ? 55 : 45}
                          tint={isDark ? 'dark' : 'light'}
                          style={[styles.upgradeBtn, { overflow: 'hidden', borderWidth: 1, borderColor: accentColor + '50' }]}
                        >
                          <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5 }}
                            onPress={() => router.push('/subscription')}
                          >
                            <Ionicons name="sparkles" size={11} color={accentColor} />
                            <Text style={[styles.upgradeBtnText, { color: accentColor, fontSize: 12 }]}>Upgrade</Text>
                          </TouchableOpacity>
                        </BlurView>
                      ) : (
                        <TouchableOpacity
                          style={[styles.upgradeBtn, { backgroundColor: isDark ? accentColor + '22' : accentColor + '18', borderWidth: 1, borderColor: accentColor + '50', paddingHorizontal: 10, paddingVertical: 5 }]}
                          onPress={() => router.push('/subscription')}
                        >
                          <Ionicons name="sparkles" size={11} color={accentColor} />
                          <Text style={[styles.upgradeBtnText, { color: accentColor, fontSize: 12 }]}>Upgrade</Text>
                        </TouchableOpacity>
                      )
                    ) : isGuest ? (
                      <TouchableOpacity
                        style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : '#F0F0F5', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 5 }}
                        onPress={() => router.push('/login')}
                      >
                        <Text style={{ color: isDark ? '#FFF' : '#000', fontWeight: '600', fontSize: 13 }}>Sign up</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  {/* Right side: Group & Temporary chat buttons — logged-in users only */}
                  {!isGuest ? (
                    <View style={styles.headerEmptyRight}>
                      {Platform.OS === 'ios' ? (
                        <BlurView intensity={55} tint={isDark ? 'dark' : 'light'} style={headerIconGroupStyles.glassWrap}>
                          <TouchableOpacity style={headerIconGroupStyles.iconBtn} onPress={() => setGroupStartModalVisible(true)}>
                            <Ionicons name="person-add-outline" size={18} color={colors.text} />
                          </TouchableOpacity>
                          <View style={[headerIconGroupStyles.divider, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' }]} />
                          <TouchableOpacity style={headerIconGroupStyles.iconBtn} onPress={() => { setTemporaryChatMode(true); setGroupChatMode(false); }}>
                            <Ionicons name="timer-outline" size={18} color={colors.text} />
                          </TouchableOpacity>
                        </BlurView>
                      ) : (
                        <View style={[headerIconGroupStyles.glassWrap, { backgroundColor: isDark ? 'rgba(44,44,46,0.85)' : 'rgba(242,242,247,0.85)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }]}>
                          <TouchableOpacity style={headerIconGroupStyles.iconBtn} onPress={() => setGroupStartModalVisible(true)}>
                            <Ionicons name="person-add-outline" size={18} color={colors.text} />
                          </TouchableOpacity>
                          <View style={[headerIconGroupStyles.divider, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' }]} />
                          <TouchableOpacity style={headerIconGroupStyles.iconBtn} onPress={() => { setTemporaryChatMode(true); setGroupChatMode(false); }}>
                            <Ionicons name="timer-outline" size={18} color={colors.text} />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  ) : (
                    <View />
                  )}
                </View>
              ) : (
                <View style={styles.headerChat}>
                  {/* Menu button — blur pill */}
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
                    {groupChatMode ? 'Group Chat' : (temporaryChatMode ? 'Temporary chat' : (currentConversation?.title || 'Haitian AI'))}
                  </Text>
                  <View style={styles.headerChatRight}>
                    {/* New chat icon — blur pill */}
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
                    {/* Three-dots menu — blur pill */}
                    {Platform.OS === 'ios' ? (
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
                            {' created the group chat.\nYour personal Haitian AI memory is never used in group chats.'}
                          </Text>
                          <TouchableOpacity style={styles.groupActionBtn} onPress={() => setCustomizeAIVisible(true)}>
                            <Text style={styles.groupActionBtnText}>Customize Haitian AI</Text>
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
                      contentContainerStyle={{ paddingVertical: Spacing.md, paddingBottom: 8 }}
                      onScroll={handleScrollEvent}
                      scrollEventThrottle={16}
                      maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
                      initialNumToRender={12}
                      updateCellsBatchingPeriod={50}
                      ListHeaderComponent={groupChatMode && (messages || []).length > 0 ? (
                        <View style={{ paddingHorizontal: 16, paddingBottom: 16, alignItems: 'center', gap: 10 }}>
                          <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: 'center' }}>
                            <Text style={{ color: colors.text, fontWeight: '700' }}>{userName}</Text>
                            {' created the group chat.'}
                          </Text>
                          <View style={{ flexDirection: 'row', gap: 10 }}>
                            <TouchableOpacity style={styles.groupActionBtn} onPress={() => setCustomizeAIVisible(true)}>
                              <Text style={styles.groupActionBtnText}>Customize Haitian AI</Text>
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
                            />
                          ) : null}
                          {streamingMessageId ? null : generating ? (
                            <ThinkingIndicator
                              userMessage={(messages || []).length > 0 ? (messages || [])[(messages || []).length - 1].content : inputText}
                              completed={showCompletionStatus}
                              mode={thinkingMode}
                              onCancel={handleStopGeneration}
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

              {renderMediaPreview()}

              {editingMessageId ? (
                    <View style={[{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingBottom: 6 }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A2A', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, gap: 8 }}>
                        <Ionicons name="pencil" size={16} color="#007AFF" />
                        <Text style={{ color: '#007AFF', fontSize: 15, fontWeight: '600' }}>Edit</Text>
                        <TouchableOpacity onPress={handleCancelEdit} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Ionicons name="close" size={16} color="rgba(255,255,255,0.5)" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : null}

              {quizMode ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 6 }}>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1A1A2E', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(90,200,250,0.3)' }}
                    onPress={() => setQuizConnectVisible(true)}
                  >
                    <Ionicons name="albums-outline" size={16} color="#5AC8FA" />
                    <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}>Quizzes</Text>
                    <TouchableOpacity onPress={() => setQuizMode(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close" size={14} color="rgba(255,255,255,0.5)" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                </View>
              ) : null}

              {/* Input Area — reference design: [+] [input...mic] [voice-orb] */}
              <View style={[styles.inputContainer, Platform.OS === 'ios' && { backgroundColor: 'transparent' }]}>

                {/* + button: always outside, left of input */}
                {!editingMessageId && !isRecording && !isProcessing ? (
                  <TouchableOpacity
                    style={styles.addBtn}
                    onPress={() => setToolsVisible(true)}
                  >
                    {Platform.OS === 'ios' ? (
                      <BlurView intensity={60} tint={isDark ? 'dark' : 'light'} style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="add" size={24} color={colors.text} />
                      </BlurView>
                    ) : (
                      <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="add" size={24} color={colors.text} />
                      </View>
                    )}
                  </TouchableOpacity>
                ) : null}

                {/* Main input pill */}
                <View style={styles.inputWrapper}>
                  {isRecording ? (
                    <View style={styles.recordingContainer}>
                      <Text style={styles.recordingDuration}>{formatDuration(recordingDuration)}</Text>
                      <WaveformAnimation isRecording={isRecording} />
                    </View>
                  ) : isProcessing ? (
                    <View style={styles.recordingContainer}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={{ fontSize: 15, color: colors.text, marginLeft: 8 }}>Transcribing...</Text>
                    </View>
                  ) : detectedLanguage ? (
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 }}>
                      <View style={{ backgroundColor: accentColor + '22', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
                        <Text style={{ color: accentColor, fontSize: 12, fontWeight: '600' }}>{'🌐 ' + detectedLanguage}</Text>
                      </View>
                      <Text style={{ color: colors.text, fontSize: 14, flex: 1 }} numberOfLines={1}>{inputText}</Text>
                    </View>
                  ) : (
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                      <TextInput
                        ref={inputRef}
                        style={styles.input}
                        placeholder={temporaryChatMode ? 'Temporary chat' : (editingMessageId ? 'Edit message...' : 'Ask anything')}
                        placeholderTextColor={colors.textSecondary}
                        value={inputText}
                        onChangeText={handleInputChange}
                        multiline
                        maxLength={8000}
                        editable={!sending && !isRecording && !isProcessing}
                        returnKeyType="default"
                        blurOnSubmit={false}
                      />
                      {inputText.length > 120 ? (
                        <TouchableOpacity onPress={() => { setExpandedText(inputText); setExpandInputVisible(true); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ paddingLeft: 4 }}>
                          <Ionicons name="expand-outline" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  )}

                  {/* Mic inside pill (only when no text) */}
                  {!showSendButton && !editingMessageId ? (
                    <TouchableOpacity
                      onPress={toggleRecording}
                      style={{ paddingHorizontal: 8, paddingVertical: 4 }}
                      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                    >
                      {isProcessing ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <Ionicons
                          name={isRecording ? 'stop-circle' : 'mic-outline'}
                          size={22}
                          color={isRecording ? '#FF3B30' : colors.textSecondary}
                        />
                      )}
                    </TouchableOpacity>
                  ) : null}

                  {/* Send / Stop inside pill */}
                  {sending ? (
                    <TouchableOpacity
                      style={[styles.sendButton, { backgroundColor: isDark ? '#3A3A3C' : '#E5E5EA' }]}
                      onPress={handleStopGeneration}
                    >
                      <View style={{ width: 11, height: 11, backgroundColor: colors.text, borderRadius: 2 }} />
                    </TouchableOpacity>
                  ) : showSendButton ? (
                    <TouchableOpacity
                      style={[styles.sendButton, { backgroundColor: accentColor }]}
                      onPress={handleSend}
                      disabled={isRecording || isProcessing}
                    >
                      <Ionicons name="arrow-up" size={19} color="#FFFFFF" />
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* Cancel edit button */}
                {editingMessageId ? (
                  <TouchableOpacity style={{ padding: 8 }} onPress={handleCancelEdit}>
                    <Ionicons name="close-circle-outline" size={24} color="#FF3B30" />
                  </TouchableOpacity>
                ) : null}

                {/* Voice orb button — right of pill, always visible */}
                {!showSendButton && !sending && !editingMessageId ? (
                  <TouchableOpacity
                    style={[styles.voiceOrbBtn, { backgroundColor: isRecording ? '#FF3B30' : accentColor }]}
                    onPress={() => router.push('/voice-control')}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Ionicons name="pulse" size={21} color="#FFFFFF" />
                  </TouchableOpacity>
                ) : null}
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
                style={{ position: 'absolute', bottom: 90, right: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 6, zIndex: 50 }}
                onPress={() => { flatListRef.current?.scrollToEnd({ animated: true }); setIsAtBottom(true); setShowScrollToBottom(false); }}
              >
                <Ionicons name="chevron-down" size={20} color={colors.text} />
              </TouchableOpacity>
            )}

            <ToolsModal
              visible={toolsVisible}
              onClose={() => setToolsVisible(false)}
              onSelectTool={(tool) => {
                if (isGuest) { setToolsVisible(false); setGuestLockFeature(tool); setGuestLockModal(true); return; }
                setInputText(prev => `${prev}[${tool}] `);
              }}
              onPickMedia={(media) => {
                if (isGuest) { setToolsVisible(false); setGuestLockFeature('file upload'); setGuestLockModal(true); return; }
                handleMediaPicked(media);
              }}
              onSelectAIModel={(model) => {
                if (isGuest) { setToolsVisible(false); setGuestLockFeature('AI model selection'); setGuestLockModal(true); return; }
                handleAIModelSelect(model as AIModelKey);
              }}
              onOpenCamera={() => {
                if (isGuest) { setToolsVisible(false); setGuestLockFeature('camera'); setGuestLockModal(true); return; }
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
            />

            <ConversationMenuModal visible={conversationMenuVisible} onClose={() => setConversationMenuVisible(false)} onShare={handleShareConversation} onRename={() => { setConversationMenuVisible(false); setRenameModalVisible(true); }} onReport={() => router.push('/bugreport')} onArchive={() => { setConversationMenuVisible(false); setArchiveConfirmVisible(true); }} onDelete={() => { setConversationMenuVisible(false); handleDeleteConversation(); }} onAddPeople={handleAddPeople} conversationTitle={currentConversation?.title} />

            <SideMenu visible={sideMenuVisible} onClose={() => setSideMenuVisible(false)} currentProject={{ name: 'Haitian AI Chat' }} currentAIMode={currentAIMode} onSelectAIMode={handleSelectAIMode} onNewChat={handleNewChat} onChatHistory={() => { setSideMenuVisible(false); setChatHistoryVisible(true); }} onSettings={() => { setSideMenuVisible(false); router.push('/settings'); }} onProfile={() => { setSideMenuVisible(false); router.push('/profile'); }} userCoins={coins} isUnlimited={isUnlimited} isAdmin={isAdmin} isGuest={isGuest} />

            <ChatHistoryModal visible={chatHistoryVisible} onClose={() => setChatHistoryVisible(false)} onSelectChat={() => { setChatHistoryVisible(false); }} onNewChat={() => { handleNewChat(); setChatHistoryVisible(false); }} currentChatId={currentConversation?.id} />

            <CalculatorModal visible={calcVisible} onClose={() => setCalcVisible(false)} initialExpression={calcExpression} initialResult={calcResult} />

            {/* Quizzes Connect Prompt */}
            <Modal visible={quizConnectVisible} transparent animationType="fade" onRequestClose={() => setQuizConnectVisible(false)}>
              <View style={{ flex: 1, backgroundColor: '#000' }}>
                <TouchableOpacity style={{ position: 'absolute', top: 60, right: 20, backgroundColor: 'rgba(52,199,89,0.85)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, zIndex: 10 }}
                  onPress={() => { setQuizConnectVisible(false); setQuizConnectDetailVisible(true); }}>
                  <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}>Create a quiz</Text>
                </TouchableOpacity>
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginBottom: 24 }}>Running app request</Text>
                  <View style={{ backgroundColor: 'rgba(28,28,32,0.95)', borderRadius: 20, padding: 28, width: '100%', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
                    <View style={{ marginBottom: 16 }}>
                      <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: '#1A3050', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#5AC8FA' }}>
                        <Ionicons name="albums-outline" size={26} color="#5AC8FA" />
                      </View>
                    </View>
                    <Text style={{ color: '#FFF', fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: 8 }}>Haitian AI wants to connect to Quizzes</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center', marginBottom: 28 }}>Create quizzes to test your knowledge</Text>
                    <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
                      <TouchableOpacity style={{ flex: 1, borderRadius: 50, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', paddingVertical: 14, alignItems: 'center' }}
                        onPress={() => { setQuizConnectVisible(false); setQuizMode(false); }}>
                        <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '600' }}>Not now</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={{ flex: 1, borderRadius: 50, backgroundColor: '#FFF', paddingVertical: 14, alignItems: 'center' }}
                        onPress={() => { setQuizConnectVisible(false); setQuizConnectDetailVisible(true); }}>
                        <Text style={{ color: '#000', fontSize: 16, fontWeight: '700' }}>Connect</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            </Modal>

            {/* Quizzes Connect Detail */}
            <Modal visible={quizConnectDetailVisible} transparent animationType="slide" onRequestClose={() => setQuizConnectDetailVisible(false)}>
              <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setQuizConnectDetailVisible(false)} />
                <View style={{ backgroundColor: '#1C1C1E', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28, paddingBottom: insets.bottom + 24 }}>
                  <TouchableOpacity style={{ position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}
                    onPress={() => setQuizConnectDetailVisible(false)}>
                    <Ionicons name="close" size={16} color="rgba(255,255,255,0.7)" />
                  </TouchableOpacity>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 20 }}>
                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#10A37F', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="chatbubble-ellipses" size={22} color="#FFF" /></View>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 18 }}>{String.fromCharCode(8226, 8226, 8226)}</Text>
                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#1A3050', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#5AC8FA' }}><Ionicons name="albums-outline" size={22} color="#5AC8FA" /></View>
                  </View>
                  <Text style={{ color: '#FFF', fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 20 }}>Connect Quizzes</Text>
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 16, marginBottom: 20 }}>
                    {[
                      { bold: 'Built by Dawinix', text: ' This app is developed and maintained by Dawinix.' },
                      { bold: 'Works automatically', text: ' Haitian AI may use this app in chats when it is helpful.' },
                      { bold: 'Manage anytime', text: ' Review or turn off this app in Settings, under Apps.' },
                    ].map((item, i) => (
                      <Text key={i} style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, lineHeight: 22, marginBottom: 8 }}>
                        <Text style={{ fontWeight: '700', color: '#FFF' }}>{item.bold}</Text>{item.text}
                      </Text>
                    ))}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                      <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600', flex: 1, lineHeight: 20 }}>Reference memories and chats</Text>
                      <Switch value={true} onValueChange={() => {}} trackColor={{ true: '#34C759', false: '#3A3A3C' }} thumbColor="#FFF" />
                    </View>
                  </View>
                  <TouchableOpacity style={{ backgroundColor: '#FFF', borderRadius: 50, paddingVertical: 16, alignItems: 'center' }}
                    onPress={() => { setQuizConnectDetailVisible(false); setQuizTopicVisible(true); }}>
                    <Text style={{ color: '#000', fontSize: 17, fontWeight: '700' }}>Connect Quizzes</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>

            {/* Legacy modal — kept for Connect flow; inline view handles actual quiz display */}

            {/* Quiz Topic Picker Sheet */}
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
                        {/* Topic chips */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 16 }}>
                          {[
                            { label: '\uD83C\uDF0D General Knowledge', value: 'General Knowledge' },
                            { label: '\uD83D\uDD2C Science', value: 'Science' },
                            { label: '\uD83D\uDCDC History', value: 'History' },
                            { label: '\uD83D\uDCBB Coding', value: 'Programming and Coding' },
                            { label: '\uD83D\uDDFA\uFE0F Geography', value: 'Geography' },
                            { label: '\u2797 Math', value: 'Mathematics' },
                            { label: '\uD83C\uDFAC Movies & Pop Culture', value: 'Movies and Pop Culture' },
                            { label: '\u26BD Sports', value: 'Sports' },
                          ].map((t) => (
                            <TouchableOpacity
                              key={t.value}
                              style={{
                                backgroundColor: selectedQuizTopic === t.value && !customTopicInput ? '#5AC8FA22' : 'rgba(255,255,255,0.07)',
                                borderColor: selectedQuizTopic === t.value && !customTopicInput ? '#5AC8FA' : 'rgba(255,255,255,0.12)',
                                borderWidth: 1.5,
                                borderRadius: 50,
                                paddingHorizontal: 16,
                                paddingVertical: 10,
                              }}
                              activeOpacity={0.75}
                              onPress={() => { setSelectedQuizTopic(t.value); setCustomTopicInput(''); }}
                            >
                              <Text style={{ color: selectedQuizTopic === t.value && !customTopicInput ? '#5AC8FA' : 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '600' }}>{t.label}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>

                        {/* Custom topic input */}
                        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '600', marginBottom: 8 }}>Custom topic...</Text>
                        <TextInput
                          style={{
                            backgroundColor: customTopicInput ? 'rgba(90,200,250,0.1)' : 'rgba(255,255,255,0.07)',
                            borderWidth: 1.5,
                            borderColor: customTopicInput ? '#5AC8FA' : 'rgba(255,255,255,0.12)',
                            borderRadius: 14,
                            paddingHorizontal: 16,
                            paddingVertical: 12,
                            color: '#FFF',
                            fontSize: 15,
                            marginBottom: 20,
                          }}
                          placeholder="e.g. JavaScript ES6, World War II battles..."
                          placeholderTextColor="rgba(255,255,255,0.3)"
                          value={customTopicInput}
                          onChangeText={(txt) => { setCustomTopicInput(txt); if (txt) setSelectedQuizTopic(''); }}
                          returnKeyType="done"
                        />

                        {/* Difficulty picker */}
                        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '600', marginBottom: 10 }}>Difficulty</Text>
                        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                          {[
                            { label: 'Easy', color: '#34C759' },
                            { label: 'Medium', color: '#5AC8FA' },
                            { label: 'Hard', color: '#FF9F0A' },
                            { label: 'Expert', color: '#FF453A' },
                          ].map((d) => {
                            const isSelected = selectedDifficulty === d.label;
                            return (
                              <TouchableOpacity
                                key={d.label}
                                style={{
                                  flex: 1,
                                  alignItems: 'center',
                                  paddingVertical: 10,
                                  borderRadius: 12,
                                  borderWidth: 1.5,
                                  borderColor: isSelected ? d.color : 'rgba(255,255,255,0.1)',
                                  backgroundColor: isSelected ? d.color + '22' : 'rgba(255,255,255,0.04)',
                                }}
                                activeOpacity={0.75}
                                onPress={() => setSelectedDifficulty(d.label)}
                              >
                                <Text style={{ color: isSelected ? d.color : 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '700' }}>{d.label}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>

                        {/* Start button */}
                        <TouchableOpacity
                          style={{
                            backgroundColor: (selectedQuizTopic || customTopicInput.trim()) ? '#5AC8FA' : 'rgba(255,255,255,0.1)',
                            borderRadius: 50,
                            paddingVertical: 16,
                            alignItems: 'center',
                          }}
                          disabled={!selectedQuizTopic && !customTopicInput.trim()}
                          onPress={() => handleLaunchQuiz(customTopicInput.trim() || selectedQuizTopic)}
                        >
                          <Text style={{ color: (selectedQuizTopic || customTopicInput.trim()) ? '#000' : 'rgba(255,255,255,0.4)', fontSize: 17, fontWeight: '700' }}>Start Quiz</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </ScrollView>
                </View>
              </View>
            </Modal>

            {/* Dislike Feedback Modal */}
            <Modal visible={dislikeFeedbackVisible} transparent animationType="none" onRequestClose={() => setDislikeFeedbackVisible(false)}>
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
                <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setDislikeFeedbackVisible(false)} />
                <View style={{ width: '90%', maxWidth: 380, borderRadius: 22, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.45, shadowRadius: 24, elevation: 24 }}>
                  <BlurView intensity={90} tint="dark" style={{ padding: 24, borderRadius: 22 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                      <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '700' }}>Share your feedback</Text>
                      <TouchableOpacity onPress={() => setDislikeFeedbackVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="close" size={14} color="rgba(255,255,255,0.7)" />
                        </View>
                      </TouchableOpacity>
                    </View>
                    <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, marginBottom: 14 }}>What was the issue with this response?</Text>
                    {[
                      { label: "Didn't fully follow instructions", icon: 'alert-circle-outline' },
                      { label: 'Not factually correct', icon: 'close-circle-outline' },
                      { label: 'Refused when it should not have', icon: 'ban-outline' },
                      { label: 'Response was incomplete', icon: 'git-merge-outline' },
                      { label: 'Harmful or unsafe content', icon: 'warning-outline' },
                      { label: 'Other', icon: 'ellipsis-horizontal-circle-outline' },
                    ].map((issue, i) => (
                      <TouchableOpacity
                        key={issue.label}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: i > 0 ? StyleSheet.hairlineWidth : 0, borderTopColor: 'rgba(255,255,255,0.1)' }}
                        onPress={() => setDislikeIssue(issue.label)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name={issue.icon as any} size={20} color={dislikeIssue === issue.label ? accentColor : 'rgba(255,255,255,0.6)'} />
                        <Text style={{ flex: 1, color: dislikeIssue === issue.label ? accentColor : 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: dislikeIssue === issue.label ? '700' : '400' }}>{issue.label}</Text>
                        {dislikeIssue === issue.label ? <Ionicons name="checkmark" size={18} color={accentColor} /> : null}
                      </TouchableOpacity>
                    ))}
                    <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 14 }} />
                    <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, marginBottom: 8 }}>Additional details (optional)</Text>
                    <TextInput
                      style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: '#FFF', fontSize: 14, minHeight: 80, textAlignVertical: 'top', marginBottom: 6 }}
                      placeholder="Describe the issue..."
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      value={dislikeCustomText}
                      onChangeText={txt => { if (txt.length <= 2000) setDislikeCustomText(txt); }}
                      multiline
                      maxLength={2000}
                    />
                    <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, textAlign: 'right', marginBottom: 16 }}>{dislikeCustomText.length}/2000</Text>
                    <TouchableOpacity
                      style={{ marginBottom: 10 }}
                      onPress={() => { Linking.openURL('https://help.openai.com/en/articles/6825527-what-feedback-can-i-submit-in-chatgpt'); }}
                    >
                      <Text style={{ color: accentColor, fontSize: 13, fontWeight: '600', textAlign: 'center' }}>Learn more about our feedback policy</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ backgroundColor: accentColor, borderRadius: 14, paddingVertical: 14, alignItems: 'center', opacity: dislikeIssue ? 1 : 0.45 }}
                      disabled={!dislikeIssue}
                      onPress={() => {
                        setDislikeFeedbackVisible(false);
                        showAlert('Feedback submitted', 'Thank you! Your feedback helps us improve.');
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      }}
                    >
                      <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700' }}>Submit feedback</Text>
                    </TouchableOpacity>
                  </BlurView>
                </View>
              </View>
            </Modal>

            <PresetsModal
              visible={presetsModalVisible}
              onClose={() => setPresetsModalVisible(false)}
              onSelectPreset={(phrase) => setInputText(phrase)}
            />

            <Modal visible={expandInputVisible} animationType="slide" onRequestClose={() => setExpandInputVisible(false)}>
              <View style={{ flex: 1, backgroundColor: colors.background }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 12 }}>
                  <TouchableOpacity onPress={() => { setInputText(expandedText); setExpandInputVisible(false); }}>
                    <Ionicons name="chevron-down" size={24} color={colors.text} />
                  </TouchableOpacity>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>Message</Text>
                  <TouchableOpacity onPress={() => { const txt = expandedText; setInputText(txt); setExpandInputVisible(false); setTimeout(() => handleSend(), 100); }}>
                    <View style={{ backgroundColor: settings.accentColor || colors.primary, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="arrow-up" size={20} color="#FFF" />
                    </View>
                  </TouchableOpacity>
                </View>
                <TextInput style={{ flex: 1, fontSize: 16, color: colors.text, paddingHorizontal: 20, paddingTop: 8, textAlignVertical: 'top' }} value={expandedText} onChangeText={setExpandedText} multiline autoFocus placeholder="Type your message..." placeholderTextColor={colors.textSecondary} />
                <View style={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 16 }}>
                  <TouchableOpacity style={{ backgroundColor: settings.accentColor || colors.primary, borderRadius: 50, paddingVertical: 15, alignItems: 'center' }} onPress={() => { setInputText(expandedText); setExpandInputVisible(false); }}>
                    <Text style={{ color: '#FFF', fontSize: 17, fontWeight: '700' }}>Done</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>

            <RenameModal visible={renameModalVisible} currentTitle={currentConversation?.title || ''} onConfirm={async (title) => { setRenameModalVisible(false); await handleRenameConversation(title); }} onCancel={() => setRenameModalVisible(false)} />
            <ArchiveConfirmModal visible={archiveConfirmVisible} onConfirm={() => { setArchiveConfirmVisible(false); handleArchiveConversation(); }} onCancel={() => setArchiveConfirmVisible(false)} />
            <GroupStartModal visible={groupStartModalVisible} user={user} profilePhotoUrl={userProfilePhoto} onClose={() => setGroupStartModalVisible(false)} onStartGroup={handleStartGroupChat} />
            <CustomizeAIModal visible={customizeAIVisible} onClose={() => setCustomizeAIVisible(false)} onSave={(instructions, respondAuto) => { setGroupCustomInstructions(instructions); setGroupRespondAuto(respondAuto); }} initialInstructions={groupCustomInstructions} initialRespondAuto={groupRespondAuto} />
            <InviteLinkModal visible={inviteLinkVisible} onClose={() => setInviteLinkVisible(false)} isPlus={isUnlimited} />
            <NotificationPermissionModal visible={notifPermModalVisible} onAllow={handleAllowNotifications} onSkip={() => setNotifPermModalVisible(false)} />

            {/* Guest mode: 35-message limit modal (Photo 8 style) */}
            <Modal visible={guestLoginModal} transparent animationType="fade" onRequestClose={() => setGuestLoginModal(false)}>
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
                <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
                <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setGuestLoginModal(false)} />
                <View style={{ backgroundColor: '#1C1C1E', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28, paddingBottom: insets.bottom + 28 }}>
                  <TouchableOpacity style={{ position: 'absolute', top: 14, right: 16, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }} onPress={() => setGuestLoginModal(false)}>
                    <Ionicons name="close" size={16} color="rgba(255,255,255,0.7)" />
                  </TouchableOpacity>
                  <Text style={{ color: '#FFF', fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 10, marginTop: 8 }}>Log in to keep chatting</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, textAlign: 'center', lineHeight: 21, marginBottom: 24 }}>{'You have reached your 35-message guest limit. Log in to continue chatting or wait 24 hours.'}</Text>
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
                      <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '600' }}>Sign up</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 50, paddingVertical: 15, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }} onPress={() => { setGuestLoginModal(false); router.push('/login'); }}>
                      <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '600' }}>Log in</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>

            {/* Guest mode: feature lock modal (Photo 8 style) */}
            <Modal visible={guestLockModal} transparent animationType="fade" onRequestClose={() => setGuestLockModal(false)}>
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
                <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
                <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setGuestLockModal(false)} />
                <View style={{ backgroundColor: '#1C1C1E', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28, paddingBottom: insets.bottom + 28 }}>
                  <TouchableOpacity style={{ position: 'absolute', top: 14, right: 16, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }} onPress={() => setGuestLockModal(false)}>
                    <Ionicons name="close" size={16} color="rgba(255,255,255,0.7)" />
                  </TouchableOpacity>
                  <Text style={{ color: '#FFF', fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 10, marginTop: 8 }}>Log in to try advanced features</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, textAlign: 'center', lineHeight: 21, marginBottom: 24 }}>{'Get smarter responses, upload files, analyze images, and more by logging in.'}</Text>
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
                    <TouchableOpacity style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 50, paddingVertical: 15, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }} onPress={() => { setGuestLockModal(false); router.push('/login'); }}>
                      <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '600' }}>Sign up</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 50, paddingVertical: 15, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }} onPress={() => { setGuestLockModal(false); router.push('/login'); }}>
                      <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '600' }}>Log in</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>

            {/* Image analyzing overlay — shown when navigating from images page */}
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
                    <Text style={styles.blurText}>Haitian AI Chat</Text>
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

