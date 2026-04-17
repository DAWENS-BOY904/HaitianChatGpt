import React, { useState, useRef, useEffect, useCallback, useMemo, Component } from 'react';
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
import { MenuModal } from '../components/MenuModal';
import { ToolsModal } from '../components/ToolsModal';
import { StreamingText } from '../components/StreamingText';
import { ConversationMenuModal } from '../components/ConversationMenuModal';
import { MessageItem } from '../components/MessageItem';
import { ThinkingIndicator } from '../components/ThinkingIndicator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';
import { useRouter } from 'expo-router';
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
const AUTO_LOCK_DELAY = 30000;
const GROUP_ACCENT_COLORS = ['#007AFF', '#34C759', '#FF3B30', '#FF9500', '#AF52DE', '#5AC8FA', '#FF2D55'];

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

const mentionStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 70,
    left: 60,
    right: 12,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 12,
  },
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

interface BlurContextMenuProps {
  visible: boolean;
  title?: string;
  items: Array<{ label: string; icon: string; color?: string; destructive?: boolean; onPress: () => void; }>;
  onClose: () => void;
}

function BlurContextMenu({ visible, title, items, onClose }: BlurContextMenuProps) {
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

function ArchiveConfirmModal({ visible, onConfirm, onCancel }: { visible: boolean; onConfirm: () => void; onCancel: () => void; }) {
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

function InviteLinkModal({ visible, onClose, isPlus, isGo }: { visible: boolean; onClose: () => void; isPlus: boolean; isGo?: boolean; }) {
  const maxUsers = isPlus ? 30 : (isGo ? 10 : 3);
  const link = `https://dawinix.com/invite`;
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

function NotificationPermissionModal({ visible, onAllow, onSkip }: { visible: boolean; onAllow: () => void; onSkip: () => void; }) {
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
  const { canSendMessage, coins, isUnlimited, incrementMessageCount, isAdmin } = useGuestLimits();
  const { conversations, messages, currentConversation, sendMessage, updateMessageAndRegenerate, createConversation, deleteConversation, loading, streamingMessageId, updateConversationTitle, archiveConversation, selectConversation, temporaryMode: ctxTempMode, setTemporaryMode: ctxSetTempMode } = useConversation();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  const [isAppActive, setIsAppActive] = useState(true);
  const [showBlurOverlay, setShowBlurOverlay] = useState(false);
  const [inputText, setInputText] = useState('');
  const [toolsVisible, setToolsVisible] = useState(false);
  const [conversationMenuVisible, setConversationMenuVisible] = useState(false);
  const [sideMenuVisible, setSideMenuVisible] = useState(false);
  const [chatHistoryVisible, setChatHistoryVisible] = useState(false);
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
  const [thinkingMode, setThinkingMode] = useState<'thinking' | 'creating_image' | 'analyzing' | 'editing_image'>('thinking');
  const [showCompletionStatus, setShowCompletionStatus] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
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
  // Keep local state in sync with context
  useEffect(() => {
    if (ctxSetTempMode) ctxSetTempMode(temporaryChatMode);
  }, [temporaryChatMode]);
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
  const pushTokenRef = useRef<string | null>(null);

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
      } catch (e) {
        setInputText(safeTxt);
      }
      return;
    }
    setInputText(safeTxt);
    try { setCodeLangChips(/```\w*$/.test(safeTxt)); } catch (_e) { setCodeLangChips(false); }
    if (groupChatMode) {
      const atMatch = safeTxt.match(/@(\w*)$/);
      if (atMatch !== null) {
        setMentionQuery(atMatch[1] || '');
        setShowMentionPopup(true);
      } else {
        setShowMentionPopup(false);
        setMentionQuery('');
      }
    }
  }, [groupChatMode, showAlert]);

  const wasGeneratingRef = useRef(false);
  const appStateForNotifRef = useRef(AppState.currentState);
  const [userProfilePhoto, setUserProfilePhoto] = useState<string | null>(null);
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
        const title = topics[0].slice(0, 30);
        if (title.length > 5) generated.push({ title: 'Continue: ' + title, sub: 'pick up from last time' });
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
    } else {
      pulseAnim.setValue(1);
    }
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
      await new Promise(r => setTimeout(r, 200));
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
        interruptionModeIOS: 1,
        interruptionModeAndroid: 1,
      });
      if (Platform.OS === 'android') await new Promise(r => setTimeout(r, 100));
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
      await cleanupRecording();
      Alert.alert('Recording Failed', Platform.OS === 'android' ? 'Could not start recording on Android. Please restart the app.' : 'Could not start recording. Please try again.');
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

  const handleSend = async () => {
    if ((!inputText.trim() && selectedMedia.length === 0) || sending) return;
    if (!editingMessageId && !canSendMessage() && sessionBonusMessages <= 0) {
      if (!user) {
        showAlert('Sign In Required', 'Sign in to start chatting with AI.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign In', onPress: () => router.push('/login') }]);
      } else {
        showAlert('Credits Required', 'You need credits to continue.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Buy Credits', onPress: () => router.push('/buy-coins') }]);
      }
      return;
    }
    let conversationId = currentConversation?.id;
    if (!conversationId) { conversationId = await createConversation(); if (!conversationId) { showAlert('Error', 'Failed to create conversation'); return; } }
    setSending(true); setGenerating(true);
    const text = inputText; const media = [...selectedMedia]; const editingId = editingMessageId;
    setInputText(''); setSelectedMedia([]); setEditingMessageId(null); setThinkingMode('thinking');
    try {
      if (editingId) { await updateMessageAndRegenerate(editingId, text, currentAIModel); return; }
      let base64Image: string | undefined;
      if (media.length > 0 && media[0].type === 'image') {
        if (media[0].base64) base64Image = media[0].base64;
        else if (media[0].uri) { try { base64Image = await FileSystem.readAsStringAsync(media[0].uri, { encoding: FileSystem.EncodingType.Base64 }); } catch (e) {} }
      }
      let finalText = text || (base64Image ? '[Image]' : '');
      if (groupChatMode && groupCustomInstructions && groupRespondAuto) finalText = `[System instruction: ${groupCustomInstructions}]\n\n${finalText}`;
      if (groupChatMode && !groupRespondAuto) { setSending(false); setGenerating(false); return; }
      const atTagMatch = finalText.match(/@(\w+)/);
      if (groupChatMode && atTagMatch) {
        const taggedName = atTagMatch[1].toLowerCase();
        if (groupMembers.some(m => m.username.toLowerCase() === taggedName)) { setSending(false); setGenerating(false); return; }
      }
      await sendMessage(finalText, undefined, base64Image, false, currentAIModel);
      setShowCompletionStatus(true); setTimeout(() => setShowCompletionStatus(false), 2000);
      if (user && !isUnlimited && !isAdmin) { if (sessionBonusMessages > 0) setSessionBonusMessages(prev => prev - 1); else await incrementMessageCount(); }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      showAlert('Error', error?.message || 'Failed to send message');
      setInputText(text); setSelectedMedia(media);
    } finally { setSending(false); setGenerating(false); }
  };

  const handleStopGeneration = useCallback(() => { setSending(false); setGenerating(false); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }, []);
  const handleCancelGeneration = useCallback(() => { setGenerating(false); }, []);
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

  const renderMessage = useCallback(({ item }: { item: Message }) => {
    const isStreaming = streamingMessageId === item.id;
    const mathData = item.role === 'assistant' ? detectMathExpression(item.content) : null;
    return (
      <View>
        <MessageItem message={item} onCancel={handleCancelGeneration} onEdit={handleEditMessage} onCopy={() => handleCopyMessage(item.content)} isGenerating={isStreaming} streaming={isStreaming} isOffline={isOffline} onChunkRendered={() => { flatListRef.current?.scrollToEnd({ animated: false }); }} />
        {mathData ? (<CalculatorCard expression={mathData.expression} result={mathData.result} onOpen={() => { setCalcExpression(mathData.expression); setCalcResult(mathData.result); setCalcVisible(true); }} />) : null}
      </View>
    );
  }, [streamingMessageId, handleCancelGeneration, handleEditMessage, handleCopyMessage, isOffline]);

  const renderMediaPreview = useCallback(() => {
    if (selectedMedia.length === 0) return null;
    return (
      <View style={styles.selectedMediaPreview}>
        {selectedMedia.map((media, index) => (
          <View key={`${media.uri}-${index}`} style={styles.mediaPreviewItem}>
            {media.type === 'image' ? (
              <Image source={{ uri: media.uri }} style={styles.mediaImage} resizeMode="cover" />
            ) : (
              <View style={styles.documentPreview}>
                <Ionicons name="document-text" size={24} color={colors.textSecondary} />
                <Text style={styles.documentName} numberOfLines={1}>{media.name || 'Document'}</Text>
              </View>
            )}
            <TouchableOpacity style={styles.removeMediaButton} onPress={() => removeMedia(index)}>
              <Ionicons name="close" size={12} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ))}
      </View>
    );
  }, [selectedMedia, removeMedia, colors]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, paddingTop: Platform.select({ ios: insets.top, android: StatusBar.currentHeight || 0, default: 0 }) },
    headerEmpty: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.background },
    upgradeBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2D2B5E', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, gap: 5 },
    upgradeBtnText: { color: '#7C6FF7', fontSize: 14, fontWeight: '600' },
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
    inputContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: Platform.select({ ios: insets.bottom + 8, android: insets.bottom + 8, default: 8 }), paddingTop: 8, gap: 8, backgroundColor: colors.background },
    inputWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7', borderRadius: 26, paddingHorizontal: 16, minHeight: 48, maxHeight: 120, gap: 8 },
    input: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: 12, maxHeight: 100 },
    recordingContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
    recordingDuration: { color: '#FF3B30', fontSize: 13, fontWeight: '600', minWidth: 36 },
    addBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7', alignItems: 'center', justifyContent: 'center' },
    micBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
    sendButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    stopButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FF3B30', alignItems: 'center', justifyContent: 'center' },
    emptyState: { flex: 1 },
    loadingContainer: { padding: Spacing.md, alignItems: 'center' },
    selectedMediaPreview: { flexDirection: 'row', gap: Spacing.xs, paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, maxHeight: 80 },
    mediaPreviewItem: { width: 60, height: 60, borderRadius: BorderRadius.sm, backgroundColor: colors.surface, position: 'relative', overflow: 'hidden' },
    mediaImage: { width: '100%', height: '100%' },
    documentPreview: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', padding: 4 },
    documentName: { fontSize: 8, color: colors.textSecondary, marginTop: 2 },
    removeMediaButton: { position: 'absolute', top: -6, right: -6, backgroundColor: '#FF3B30', borderRadius: BorderRadius.full, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
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

  const suggestionAnims = useRef((smartSuggestions.length > 0 ? smartSuggestions : [1,2,3,4]).map(() => ({
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
                  <TouchableOpacity onPress={() => setSideMenuVisible(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="menu" size={24} color={colors.text} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.upgradeBtn} onPress={() => router.push('/subscription')}>
                    <Ionicons name="sparkles" size={13} color="#7C6FF7" />
                    <Text style={styles.upgradeBtnText}>Upgrade</Text>
                  </TouchableOpacity>
                  <View style={styles.headerEmptyRight}>
                    <TouchableOpacity style={styles.headerIconBtn} onPress={() => setGroupStartModalVisible(true)}>
                      <Ionicons name="person-add-outline" size={22} color={colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.headerIconBtn} onPress={() => { setTemporaryChatMode(true); setGroupChatMode(false); }}>
                      <Ionicons name="timer-outline" size={22} color={colors.text} />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.headerChat}>
                  <TouchableOpacity style={styles.headerChatLeft} onPress={() => setSideMenuVisible(true)}>
                    <Ionicons name="menu" size={24} color={colors.text} />
                  </TouchableOpacity>
                  <Text style={styles.headerChatTitle} numberOfLines={1}>
                    {groupChatMode ? 'Group Chat' : (temporaryChatMode ? 'Temporary chat' : (currentConversation?.title || 'Haitian AI'))}
                  </Text>
                  <View style={styles.headerChatRight}>
                    <TouchableOpacity style={styles.headerChatEditBtn} onPress={handleNewChat} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="create-outline" size={17} color={colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => setConversationMenuVisible(true)}>
                      <Ionicons name="ellipsis-horizontal" size={21} color={colors.text} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Search Bar */}
              {isSearchMode ? (
                <View style={styles.searchContainer}>
                  <Ionicons name="search" size={20} color={colors.textSecondary} />
                  <TextInput style={styles.searchInput} placeholder="Search messages..." placeholderTextColor={colors.textSecondary} value={searchQuery} onChangeText={setSearchQuery} autoFocus />
                  <TouchableOpacity onPress={() => { setIsSearchMode(false); setSearchQuery(''); }}>
                    <Ionicons name="close" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              ) : null}

              {/* Messages Area */}
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
                        <View style={{ flex: 1 }}>
                          <View style={{ flex: 1 }} />
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
                      contentContainerStyle={{ paddingVertical: Spacing.md }}
                      onScroll={handleScrollEvent}
                      scrollEventThrottle={16}
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
                      ListFooterComponent={generating ? (
                        <ThinkingIndicator userMessage={(messages || []).length > 0 ? (messages || [])[(messages || []).length - 1].content : inputText} completed={showCompletionStatus} mode={thinkingMode} />
                      ) : null}
                      onContentSizeChange={() => { if (isAtBottom) flatListRef.current?.scrollToEnd({ animated: true }); }}
                      maxToRenderPerBatch={10}
                      windowSize={10}
                      removeClippedSubviews={Platform.OS === 'android'}
                    />
                  )}
                </View>
              </TouchableWithoutFeedback>

              {/* Code language chips */}
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
                <View style={styles.editingIndicator}>
                  <Ionicons name="pencil" size={16} color={colors.primary} />
                  <Text style={styles.editingText}>Editing message...</Text>
                  <TouchableOpacity onPress={handleCancelEdit}>
                    <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600' }}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {/* Input Area */}
              <View style={styles.inputContainer}>
                <TouchableOpacity style={styles.addBtn} onPress={() => setToolsVisible(true)} disabled={editingMessageId !== null || isRecording || isProcessing}>
                  <Ionicons name="add" size={24} color={editingMessageId || isRecording || isProcessing ? colors.textSecondary : colors.text} />
                </TouchableOpacity>

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
                </View>

                {editingMessageId ? (
                  <TouchableOpacity style={{ padding: 8 }} onPress={handleCancelEdit}>
                    <Ionicons name="close-circle-outline" size={24} color="#FF3B30" />
                  </TouchableOpacity>
                ) : null}

                {!showSendButton ? (
                  <TouchableOpacity
                    style={[styles.micBtn, { backgroundColor: isRecording ? '#FF3B30' : (isProcessing ? '#888' : '#E8460A') }]}
                    onPress={toggleRecording}
                    disabled={editingMessageId !== null}
                  >
                    {isProcessing ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Ionicons name={isRecording ? 'stop' : 'mic'} size={21} color="#FFFFFF" />
                    )}
                  </TouchableOpacity>
                ) : null}

                {sending ? (
                  <TouchableOpacity style={styles.stopButton} onPress={handleStopGeneration}>
                    <View style={{ width: 11, height: 11, backgroundColor: '#FFFFFF', borderRadius: 2 }} />
                  </TouchableOpacity>
                ) : showSendButton ? (
                  <TouchableOpacity style={[styles.sendButton, { backgroundColor: accentColor }]} onPress={handleSend} disabled={isRecording || isProcessing}>
                    <Ionicons name="arrow-up" size={19} color="#FFFFFF" />
                  </TouchableOpacity>
                ) : null}
              </View>
            </KeyboardAvoidingView>

            {/* @ Mention Popup */}
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

            {/* Scroll to Bottom floating button */}
            {showScrollToBottom && hasMessages && (
              <TouchableOpacity
                style={{
                  position: 'absolute',
                  bottom: 90,
                  right: 16,
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA',
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.25,
                  shadowRadius: 6,
                  elevation: 6,
                  zIndex: 50,
                }}
                onPress={() => {
                  flatListRef.current?.scrollToEnd({ animated: true });
                  setIsAtBottom(true);
                  setShowScrollToBottom(false);
                }}
              >
                <Ionicons name="chevron-down" size={20} color={colors.text} />
              </TouchableOpacity>
            )}

            <ToolsModal visible={toolsVisible} onClose={() => setToolsVisible(false)} onSelectTool={(tool) => setInputText(prev => `${prev}[${tool}] `)} onPickMedia={handleMediaPicked} onSelectAIModel={(model) => handleAIModelSelect(model as AIModelKey)} onOpenCamera={() => router.push('/camera')} currentModel={currentAIModel} />

            <ConversationMenuModal visible={conversationMenuVisible} onClose={() => setConversationMenuVisible(false)} onShare={handleShareConversation} onRename={(title) => { setConversationMenuVisible(false); setRenameModalVisible(true); }} onReport={() => router.push('/bugreport')} onArchive={() => { setConversationMenuVisible(false); setArchiveConfirmVisible(true); }} onDelete={() => { setConversationMenuVisible(false); handleDeleteConversation(); }} onAddPeople={handleAddPeople} conversationTitle={currentConversation?.title} />

            <SideMenu visible={sideMenuVisible} onClose={() => setSideMenuVisible(false)} currentProject={{ name: 'Haitian AI Chat' }} currentAIMode={currentAIMode} onSelectAIMode={handleSelectAIMode} onNewChat={handleNewChat} onChatHistory={() => { setSideMenuVisible(false); setChatHistoryVisible(true); }} onSettings={() => { setSideMenuVisible(false); router.push('/settings'); }} onProfile={() => { setSideMenuVisible(false); router.push('/profile'); }} userCoins={coins} isUnlimited={isUnlimited} isAdmin={isAdmin} />

            <ChatHistoryModal visible={chatHistoryVisible} onClose={() => setChatHistoryVisible(false)} onSelectChat={(id) => { setChatHistoryVisible(false); }} onNewChat={() => { handleNewChat(); setChatHistoryVisible(false); }} currentChatId={currentConversation?.id} />

            <CalculatorModal visible={calcVisible} onClose={() => setCalcVisible(false)} initialExpression={calcExpression} initialResult={calcResult} />

            {/* Expand Input Modal */}
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

            {/* Security Blur Overlay */}
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
