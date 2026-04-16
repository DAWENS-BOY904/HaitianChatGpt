import React, { useState, useRef, useEffect, useCallback, useMemo, Component } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
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

// ==========================================
// TYPE DEFINITIONS
// ==========================================

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

// ==========================================
// CONSTANTS
// ==========================================

const MAX_RECORDING_DURATION = 60;
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const SHAKE_THRESHOLD = 3.0;
const SHAKE_COOLDOWN = 1000;
const AUTO_LOCK_DELAY = 30000;
const SUPPORTED_AI_MODELS = {
  gemini: 'Gemini',
  openai: 'OpenAI',
  claude: 'Claude',
  llama: 'Llama',
  'gemini-2.0-flash-exp': 'Gemini 2.0 Flash',
  'onspace-ai': 'OnSpace AI'
} as const;

type AIModelKey = keyof typeof SUPPORTED_AI_MODELS;

// ==========================================
// BLUR CONTEXT MENU (iOS 26 style)
// ==========================================

interface BlurContextMenuProps {
  visible: boolean;
  title?: string;
  items: Array<{
    label: string;
    icon: string;
    color?: string;
    destructive?: boolean;
    onPress: () => void;
  }>;
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
            {title ? (
              <View style={ctxStyles.titleRow}>
                <Text style={ctxStyles.titleText} numberOfLines={1}>{title}</Text>
              </View>
            ) : null}
            {items.map((item, i) => (
              <TouchableOpacity
                key={item.label}
                style={[ctxStyles.menuItem, i > 0 && ctxStyles.menuItemBorder]}
                activeOpacity={0.6}
                onPress={() => { onClose(); setTimeout(item.onPress, 50); }}
              >
                <Text style={[ctxStyles.menuItemLabel, item.destructive && ctxStyles.destructiveLabel]}>
                  {item.label}
                </Text>
                <Ionicons
                  name={item.icon as any}
                  size={20}
                  color={item.destructive ? '#FF453A' : 'rgba(255,255,255,0.85)'}
                />
              </TouchableOpacity>
            ))}
          </BlurView>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const ctxStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuWrap: {
    width: 260,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 20,
  },
  blurBox: { borderRadius: 16, overflow: 'hidden' },
  titleRow: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  titleText: { fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', fontWeight: '500' },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuItemBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.1)' },
  menuItemLabel: { fontSize: 17, color: 'rgba(255,255,255,0.92)', fontWeight: '400' },
  destructiveLabel: { color: '#FF453A' },
});

// ==========================================
// RENAME MODAL (iOS blur style)
// ==========================================

function RenameModal({ visible, currentTitle, onConfirm, onCancel }: {
  visible: boolean;
  currentTitle: string;
  onConfirm: (title: string) => void;
  onCancel: () => void;
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
            <TextInput
              style={renameStyles.input}
              value={text}
              onChangeText={setText}
              autoFocus
              selectTextOnFocus
              placeholderTextColor="rgba(255,255,255,0.4)"
            />
            <View style={renameStyles.btnRow}>
              <TouchableOpacity style={renameStyles.btn} onPress={onCancel}>
                <Text style={renameStyles.btnLabel}>Cancel</Text>
              </TouchableOpacity>
              <View style={renameStyles.btnDivider} />
              <TouchableOpacity style={renameStyles.btn} onPress={() => onConfirm(text.trim())}>
                <Text style={[renameStyles.btnLabel, { fontWeight: '600' }]}>OK</Text>
              </TouchableOpacity>
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
  card: {
    position: 'absolute',
    width: '80%',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 20,
  },
  cardBlur: { padding: 20, alignItems: 'center' },
  title: { color: '#FFF', fontSize: 17, fontWeight: '600', marginBottom: 16 },
  input: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#FFF',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  btnRow: { flexDirection: 'row', width: '100%' },
  btn: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  btnLabel: { color: '#FFF', fontSize: 17 },
  btnDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.15)' },
});

// ==========================================
// ARCHIVE CONFIRMATION MODAL
// ==========================================

function ArchiveConfirmModal({ visible, onConfirm, onCancel }: {
  visible: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={archStyles.backdrop}>
        <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={archStyles.card}>
          <BlurView intensity={90} tint="dark" style={archStyles.blurCard}>
            <Text style={archStyles.title}>Archive Chat</Text>
            <Text style={archStyles.body}>
              Are you sure you want to archive this chat?{'\n'}You can view archived chats in Settings
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
  card: {
    width: '80%',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 20,
  },
  blurCard: { padding: 24, alignItems: 'center' },
  title: { color: '#FFF', fontSize: 20, fontWeight: '700', marginBottom: 12 },
  body: { color: 'rgba(255,255,255,0.6)', fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  archBtn: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  archBtnText: { color: '#FF453A', fontSize: 17, fontWeight: '600' },
});

// ==========================================
// CUSTOMIZE AI MODAL
// ==========================================

function CustomizeAIModal({ visible, onClose, onSave }: {
  visible: boolean;
  onClose: () => void;
  onSave: (instructions: string, respondAuto: boolean) => void;
}) {
  const [instructions, setInstructions] = useState('');
  const [respondAuto, setRespondAuto] = useState(true);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
      <View style={customStyles.sheet}>
        <BlurView intensity={90} tint="dark" style={customStyles.sheetBlur}>
          <Text style={customStyles.title}>Customize Haitian AI</Text>
          <Text style={customStyles.sectionLabel}>Custom instructions</Text>
          <TextInput
            style={customStyles.textArea}
            value={instructions}
            onChangeText={setInstructions}
            placeholder="Get tailored responses by adding details about your group, such as goals, preferences, or inside jokes."
            placeholderTextColor="rgba(255,255,255,0.35)"
            multiline
            numberOfLines={4}
          />
          <View style={customStyles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={customStyles.toggleLabel}>Respond automatically</Text>
              <Text style={customStyles.toggleSub}>Answers automatically</Text>
            </View>
            <Switch value={respondAuto} onValueChange={setRespondAuto} trackColor={{ true: '#34C759', false: 'rgba(255,255,255,0.2)' }} />
          </View>
          <Text style={customStyles.note}>Group chat custom instructions are separate from custom instructions for your personal Haitian AI.</Text>
          <TouchableOpacity style={customStyles.saveBtn} onPress={() => { onSave(instructions, respondAuto); onClose(); }}>
            <Text style={customStyles.saveBtnText}>Save</Text>
          </TouchableOpacity>
        </BlurView>
      </View>
    </Modal>
  );
}

const customStyles = StyleSheet.create({
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
  sheetBlur: { padding: 24 },
  title: { color: '#FFF', fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 20 },
  sectionLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 14, marginBottom: 8 },
  textArea: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 14,
    color: '#FFF',
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 16,
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  toggleLabel: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  toggleSub: { color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 2 },
  note: { color: 'rgba(255,255,255,0.4)', fontSize: 12, textAlign: 'center', marginBottom: 20, lineHeight: 18 },
  saveBtn: { backgroundColor: '#FFF', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { color: '#000', fontSize: 17, fontWeight: '600' },
});

// ==========================================
// INVITE LINK MODAL
// ==========================================

function InviteLinkModal({ visible, onClose, isPlus }: {
  visible: boolean; onClose: () => void; isPlus: boolean;
}) {
  const maxUsers = isPlus ? 30 : 3;
  const token = '5eG_yBPqUFOFvKauYwY48Q';
  const link = `https://dawinix.com/gg/v/69d3c02eae1081a29cca0022d3bb37f5?token=${token}`;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
      <View style={{ borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' }}>
        <BlurView intensity={90} tint="dark" style={{ padding: 24 }}>
          <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '700', marginBottom: 6 }}>Group link</Text>
          <Text style={{ color: '#007AFF', fontSize: 14, marginBottom: 6 }} numberOfLines={1}>{link}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginBottom: 20 }}>
            Anyone can join your group chat with this link. Max {maxUsers} users.
          </Text>
          <View style={{ gap: 2 }}>
            {[
              { icon: 'copy-outline', label: 'Copy', onPress: () => { Clipboard.setString(link); } },
              { icon: 'share-outline', label: 'Share', onPress: () => Share.share({ message: link, url: link }) },
              { icon: 'refresh-outline', label: 'Reset', onPress: () => {} },
              { icon: 'trash-outline', label: 'Delete', color: '#FF453A', onPress: () => { onClose(); } },
            ].map((item, i) => (
              <TouchableOpacity
                key={item.label}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 16, borderTopWidth: i > 0 ? StyleSheet.hairlineWidth : 0, borderTopColor: 'rgba(255,255,255,0.1)' }}
                onPress={item.onPress}
              >
                <Ionicons name={item.icon as any} size={22} color={item.color || '#FFF'} />
                <Text style={{ color: item.color || '#FFF', fontSize: 17 }}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </BlurView>
      </View>
    </Modal>
  );
}

// ==========================================
// PROFILE SETUP MODAL
// ==========================================

function ProfileSetupModal({ visible, user, onClose }: {
  visible: boolean; user: any; onClose: () => void;
}) {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [saving, setSaving] = useState(false);
  const supabase = getSupabaseClient();

  useEffect(() => {
    if (visible && user?.id) {
      supabase.from('user_profiles').select('full_name,username').eq('id', user.id).single().then(({ data }) => {
        if (data) { setFullName(data.full_name || ''); setUsername(data.username || ''); }
      });
    }
  }, [visible, user?.id]);

  const handleSave = async () => {
    if (!fullName.trim()) return;
    setSaving(true);
    await supabase.from('user_profiles').update({ full_name: fullName.trim(), username: username.trim().toLowerCase() }).eq('id', user?.id);
    setSaving(false);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={{ borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' }}>
          <BlurView intensity={90} tint="dark" style={{ padding: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '700' }}>Set up your profile</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 6 }}>Name</Text>
            <TextInput
              style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 14, color: '#FFF', fontSize: 16, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Your name"
              placeholderTextColor="rgba(255,255,255,0.35)"
            />
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 6 }}>Username</Text>
            <TextInput
              style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 14, color: '#FFF', fontSize: 16, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
              value={username}
              onChangeText={(t) => setUsername(t.toLowerCase().replace(/\s/g, ''))}
              placeholder="username"
              placeholderTextColor="rgba(255,255,255,0.35)"
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={{ backgroundColor: '#FFF', borderRadius: 14, paddingVertical: 14, alignItems: 'center', opacity: saving ? 0.7 : 1 }}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#000" /> : <Text style={{ color: '#000', fontSize: 17, fontWeight: '600' }}>Save profile</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={{ alignItems: 'center', marginTop: 12 }} onPress={onClose}>
              <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
          </BlurView>
        </View>
      </View>
    </Modal>
  );
}

// ==========================================
// TEMPORARY CHAT BANNER
// ==========================================

function TemporaryChatBanner({ onClose }: { onClose: () => void }) {
  return (
    <View style={tmpStyles.banner}>
      <Ionicons name="time-outline" size={18} color="rgba(255,255,255,0.6)" style={{ marginBottom: 8 }} />
      <Text style={tmpStyles.title}>Temporary chat</Text>
      <Text style={tmpStyles.body}>
        This chat won't appear in history, use or update Haitian AI's memory, or be used to train our models.{'\n'}
        For safety purposes, we may keep a copy of this chat for up to 30 days.
      </Text>
    </View>
  );
}

const tmpStyles = StyleSheet.create({
  banner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  title: { color: '#FFF', fontSize: 17, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
  body: { color: 'rgba(255,255,255,0.55)', fontSize: 14, textAlign: 'center', lineHeight: 21 },
});

// ==========================================
// MAIN COMPONENT
// ==========================================

export default function HomeScreen() {
  const { colors, isDark } = useTheme();
  const { settings, updateSetting } = useSettings();
  const { user } = useAuth();
  const { 
    canSendMessage, 
    coins, 
    isUnlimited, 
    incrementMessageCount, 
    isAdmin 
  } = useGuestLimits();
  
  const { 
    conversations, 
    messages, 
    currentConversation, 
    sendMessage, 
    updateMessageAndRegenerate, 
    createConversation, 
    deleteConversation,
    loading, 
    streamingMessageId,
    updateConversationTitle,
    archiveConversation,
    selectConversation,
  } = useConversation();
  
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();
  
  // -------- State --------
  const [isAppActive, setIsAppActive] = useState(true);
  const [showBlurOverlay, setShowBlurOverlay] = useState(false);
  const [inputText, setInputText] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);
  const [toolsVisible, setToolsVisible] = useState(false);
  const [conversationMenuVisible, setConversationMenuVisible] = useState(false);
  const [sideMenuVisible, setSideMenuVisible] = useState(false);
  const [chatHistoryVisible, setChatHistoryVisible] = useState(false);
  const [currentAIMode, setCurrentAIMode] = useState<AIMode>('instant');
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<MediaFile[]>([]);
  const [currentAIModel, setCurrentAIModel] = useState<AIModelKey>(
    (settings.preferredAiModel as AIModelKey) || 'gemini'
  );
  const inputRef = useRef<TextInput>(null);
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [lastShake, setLastShake] = useState(0);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [calcVisible, setCalcVisible] = useState(false);
  const [calcExpression, setCalcExpression] = useState('');
  const [calcResult, setCalcResult] = useState('');
  const [thinkingMode, setThinkingMode] = useState<'thinking' | 'creating_image' | 'analyzing' | 'editing_image'>('thinking');
  const [showCompletionStatus, setShowCompletionStatus] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredMessages, setFilteredMessages] = useState<Message[]>([]);
  const [timeUntilMidnight, setTimeUntilMidnight] = useState('');
  const [sessionBonusMessages, setSessionBonusMessages] = useState(0);
  const [hasUsedNewChatBonus, setHasUsedNewChatBonus] = useState(false);
  const [codeLangChips, setCodeLangChips] = useState(false);

  // Modals state
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [archiveConfirmVisible, setArchiveConfirmVisible] = useState(false);
  const [profileSetupVisible, setProfileSetupVisible] = useState(false);

  // Group chat mode
  const [groupChatMode, setGroupChatMode] = useState(false);
  const [temporaryChatMode, setTemporaryChatMode] = useState(false);
  const [customizeAIVisible, setCustomizeAIVisible] = useState(false);
  const [inviteLinkVisible, setInviteLinkVisible] = useState(false);
  const [groupCustomInstructions, setGroupCustomInstructions] = useState('');
  const [groupRespondAuto, setGroupRespondAuto] = useState(true);

  // User profile for avatar
  const [userProfilePhoto, setUserProfilePhoto] = useState<string | null>(null);
  
  const runOnJS_setSideMenu = useCallback((val: boolean) => setSideMenuVisible(val), []);

  useEffect(() => {
    if (user?.id) {
      supabase.from('user_profiles').select('profile_photo_url').eq('id', user.id).single().then(({ data }) => {
        if (data?.profile_photo_url) setUserProfilePhoto(data.profile_photo_url);
      });
    }
  }, [user?.id]);

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
    setupNetworkListener();
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
        autoLockTimerRef.current = setTimeout(() => {}, AUTO_LOCK_DELAY);
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

  useEffect(() => {
    if (messages.length > 0 && !isSearchMode) {
      const timer = setTimeout(() => { flatListRef.current?.scrollToEnd({ animated: true }); }, 100);
      return () => clearTimeout(timer);
    }
  }, [messages, isSearchMode]);

  useEffect(() => {
    if (searchQuery.trim()) {
      setFilteredMessages(messages.filter(msg => msg.content.toLowerCase().includes(searchQuery.toLowerCase())));
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
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [recordingState, pulseAnim]);

  const setupNetworkListener = () => { return () => {}; };

  const checkAudioPermissions = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      audioPermissionRef.current = status === 'granted';
      if (status === 'granted') {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      }
    } catch (error) {
      audioPermissionRef.current = false;
    }
  };

  // -------- VOICE RECORDING --------

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
      await new Promise(r => setTimeout(r, 150));
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setRecordingState('recording');
      isRecordingRef.current = true;
      startRecordingTimer();

      const { recording } = await Audio.Recording.createAsync({
        android: { extension: '.m4a', outputFormat: Audio.AndroidOutputFormat.MPEG_4, audioEncoder: Audio.AndroidAudioEncoder.AAC, sampleRate: 16000, numberOfChannels: 1, bitRate: 64000 },
        ios: { extension: '.m4a', audioQuality: Audio.IOSAudioQuality.MEDIUM, sampleRate: 16000, numberOfChannels: 1, bitRate: 64000, linearPCMBitDepth: 16, linearPCMIsBigEndian: false, linearPCMIsFloat: false },
        web: { mimeType: 'audio/webm;codecs=opus', bitsPerSecond: 64000 },
      });

      recordingRef.current = recording;
      stopTimeoutRef.current = setTimeout(() => { if (isRecordingRef.current) stopVoiceRecording(); }, MAX_RECORDING_DURATION * 1000);

    } catch (error: any) {
      await cleanupRecording();
      let msg = 'Could not start recording. Please try again.';
      if (error.message?.includes('permission')) msg = 'Microphone permission denied.';
      Alert.alert('Recording Failed', msg);
    }
  };

  const stopVoiceRecording = async () => {
    if (!recordingRef.current || !isRecordingRef.current) return;
    if (stopTimeoutRef.current) { clearTimeout(stopTimeoutRef.current); stopTimeoutRef.current = null; }
    stopRecordingTimer();
    setRecordingState('processing');
    isRecordingRef.current = false;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    processingTimeoutRef.current = setTimeout(() => {
      setRecordingState('idle');
      processingTimeoutRef.current = null;
    }, 30000);

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      if (!uri) throw new Error('No URI for recording file');
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists) throw new Error('Recording file not found');
      const base64Audio = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      if (!base64Audio || base64Audio.length === 0) throw new Error('Empty audio file');
      await transcribeAudio(base64Audio);
    } catch (error: any) {
      Alert.alert('Processing Failed', error.message || 'Failed to process recording.', [
        { text: 'Try Again', onPress: () => { setRecordingState('idle'); setTimeout(startVoiceRecording, 300); } },
        { text: 'Type Manually', style: 'cancel', onPress: () => setRecordingState('idle') },
      ]);
      setRecordingState('idle');
    } finally {
      recordingRef.current = null;
    }
  };

  const toggleRecording = useCallback(() => {
    if (processingTimeoutRef.current) { clearTimeout(processingTimeoutRef.current); processingTimeoutRef.current = null; }
    if (recordingState === 'idle') startVoiceRecording();
    else if (recordingState === 'recording') stopVoiceRecording();
    else if (recordingState === 'processing') { setRecordingState('idle'); isRecordingRef.current = false; }
  }, [recordingState]);

  const transcribeAudio = async (base64Audio: string, retryCount = 0) => {
    const MAX_RETRIES = 2;
    try {
      if (!base64Audio || base64Audio.length < 100) throw new Error('Audio too short.');
      const { data, error } = await supabase.functions.invoke('transcribe-audio', {
        body: { audio: base64Audio, userId: user?.id, conversationId: currentConversation?.id, metadata: { platform: Platform.OS, timestamp: new Date().toISOString() } },
        headers: { 'x-timeout': '30000' }
      });
      if (error) {
        const isNetworkError = ['timeout', 'network', 'connection', 'offline'].some(p => error.message?.toLowerCase().includes(p));
        if (isNetworkError && retryCount < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, Math.pow(2, retryCount) * 1000));
          return transcribeAudio(base64Audio, retryCount + 1);
        }
        throw new Error(error.message || 'Transcription error');
      }
      if (!data?.text?.trim()) {
        if (data?.warning) {
          Alert.alert('No Speech Detected', data.warning, [
            { text: 'Try Again', onPress: () => startVoiceRecording() },
            { text: 'Type Manually', style: 'cancel', onPress: () => setRecordingState('idle') }
          ]);
          return;
        }
        throw new Error('No transcription received');
      }
      setInputText(prev => prev + (prev ? ' ' : '') + data.text.trim());
      setRecordingState('idle');
      if (processingTimeoutRef.current) { clearTimeout(processingTimeoutRef.current); processingTimeoutRef.current = null; }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      if (processingTimeoutRef.current) { clearTimeout(processingTimeoutRef.current); processingTimeoutRef.current = null; }
      setRecordingState('idle');
      Alert.alert('Transcription Failed', error.message || 'Failed to transcribe voice.', [
        { text: 'Try Again', onPress: () => startVoiceRecording() },
        { text: 'Type Manually', style: 'cancel', onPress: () => setRecordingState('idle') }
      ]);
    }
  };

  // -------- MESSAGE HANDLING --------

  const handleSend = async () => {
    if ((!inputText.trim() && selectedMedia.length === 0) || sending) return;

    let autoTxtFile: MediaFile | null = null;
    let textToSend = inputText;
    if (inputText.length > 4000 && selectedMedia.length === 0) {
      try {
        const fileName = `paste_${Date.now()}.txt`;
        const fileUri = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(fileUri, inputText, { encoding: FileSystem.EncodingType.UTF8 });
        autoTxtFile = { type: 'document', uri: fileUri, name: fileName, mimeType: 'text/plain', size: inputText.length };
        textToSend = `[Attached file: ${fileName}]\n\n${inputText.slice(0, 200)}...`;
      } catch (e) { textToSend = inputText.slice(0, 4000); }
    }

    if (!editingMessageId && !canSendMessage() && sessionBonusMessages <= 0) {
      if (!user) {
        showAlert('Sign In Required', 'Sign in to start chatting with AI.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => router.push('/login') },
        ]);
      } else {
        showAlert('Credits Required', 'You need credits to continue.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Buy Credits', onPress: () => router.push('/buy-coins') },
        ]);
      }
      return;
    }
    
    let conversationId = currentConversation?.id;
    if (!conversationId) {
      conversationId = await createConversation();
      if (!conversationId) { showAlert('Error', 'Failed to create conversation'); return; }
    }

    setSending(true);
    setGenerating(true);
    
    const text = autoTxtFile ? textToSend : inputText;
    const media = autoTxtFile ? [autoTxtFile, ...selectedMedia] : [...selectedMedia];
    const editingId = editingMessageId;
    
    setInputText('');
    setSelectedMedia([]);
    setEditingMessageId(null);
    setThinkingMode('thinking');

    try {
      if (editingId) { await updateMessageAndRegenerate(editingId, text, currentAIModel); return; }

      let base64Image: string | undefined;
      if (media.length > 0 && media[0].type === 'image') {
        if (media[0].base64) base64Image = media[0].base64;
        else if (media[0].uri) {
          try { base64Image = await FileSystem.readAsStringAsync(media[0].uri, { encoding: FileSystem.EncodingType.Base64 }); } catch (e) {}
        }
      }

      let finalText = text || (base64Image ? '[Image]' : '');
      if (groupChatMode && groupCustomInstructions && groupRespondAuto) {
        finalText = `[System: ${groupCustomInstructions}]\n${finalText}`;
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
      showAlert('Error', error?.message || 'Failed to send message');
      setInputText(text);
      setSelectedMedia(media);
    } finally {
      setSending(false);
      setGenerating(false);
    }
  };

  const handleCancelGeneration = useCallback(() => { setGenerating(false); showAlert('Cancelled', 'AI response generation stopped'); }, [showAlert]);

  const handleEditMessage = useCallback((messageId: string, content: string) => {
    setEditingMessageId(messageId);
    setInputText(content);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleCancelEdit = useCallback(() => { setEditingMessageId(null); setInputText(''); }, []);

  const handleMediaPicked = useCallback((media: MediaFile[]) => {
    if (media.length > 5) { showAlert('Limit', 'You can select a maximum of 5 files'); return; }
    setSelectedMedia(media);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [showAlert]);

  const removeMedia = useCallback((index: number) => { setSelectedMedia(prev => prev.filter((_, i) => i !== index)); }, []);

  const handleAIModelSelect = useCallback(async (model: AIModelKey) => {
    setCurrentAIModel(model);
    await updateSetting('preferredAiModel', model);
    showAlert('Model Updated', `Now using ${SUPPORTED_AI_MODELS[model]}`);
  }, [updateSetting, showAlert]);

  const handleSelectAIMode = useCallback((mode: AIMode) => {
    setCurrentAIMode(mode);
    const modelMap: Record<AIMode, AIModelKey> = { 'instant': 'gemini', 'deep-thinking': 'gemini-2.0-flash-exp', 'agent': 'onspace-ai' };
    setCurrentAIModel(modelMap[mode]);
  }, []);

  const handleNewChat = useCallback(async () => {
    if (messages.length > 0) await createConversation();
    setInputText(''); setSelectedMedia([]); setEditingMessageId(null);
    setGroupChatMode(false); setTemporaryChatMode(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [createConversation, messages.length]);

  const handleDeleteConversation = useCallback(async () => {
    if (!currentConversation) return;
    try {
      await deleteConversation(currentConversation.id);
      await createConversation();
      showAlert('Deleted', 'Conversation deleted');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) { showAlert('Error', 'Failed to delete conversation'); }
  }, [currentConversation, deleteConversation, createConversation, showAlert]);

  const handleRenameConversation = useCallback(async (newTitle: string) => {
    if (!currentConversation || !newTitle.trim()) return;
    await updateConversationTitle(currentConversation.id, newTitle.trim());
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [currentConversation, updateConversationTitle]);

  const handleShareConversation = useCallback(async () => {
    if (!currentConversation) return;
    try {
      const shareContent = messages.map(m => `${m.role === 'user' ? 'You' : 'AI'}: ${m.content}`).join('\n\n');
      await Share.share({ message: shareContent, title: currentConversation.title || 'AI Conversation' });
    } catch (error) {}
  }, [currentConversation, messages]);

  const handleArchiveConversation = useCallback(async () => {
    if (!currentConversation) return;
    try {
      await archiveConversation(currentConversation.id);
      await createConversation();
      showAlert('Archived', 'Chat archived. View it in Settings > Archived Chats');
    } catch (e) { showAlert('Error', 'Failed to archive chat'); }
  }, [currentConversation, archiveConversation, createConversation, showAlert]);

  const handleCopyMessage = useCallback(async (content: string) => {
    await Clipboard.setString(content);
    showAlert('Copied', 'Message copied to clipboard');
  }, [showAlert]);

  const handleAddPeople = useCallback(async () => {
    setConversationMenuVisible(false);
    showAlert('Adding people...', 'Setting up group chat...');
    await new Promise(r => setTimeout(r, 1200));
    setGroupChatMode(true);
    showAlert('Group Chat Ready', 'You can now invite people with a link!');
  }, [showAlert]);

  // -------- RENDER --------

  const renderMessage = useCallback(({ item }: { item: Message; index: number }) => {
    const isStreaming = streamingMessageId === item.id;
    const mathData = item.role === 'assistant' ? detectMathExpression(item.content) : null;
    return (
      <View>
        <MessageItem
          message={item}
          onCancel={handleCancelGeneration}
          onEdit={handleEditMessage}
          onCopy={() => handleCopyMessage(item.content)}
          isGenerating={isStreaming}
          streaming={isStreaming}
          isOffline={isOffline}
          onChunkRendered={() => { flatListRef.current?.scrollToEnd({ animated: false }); }}
        />
        {mathData && (
          <CalculatorCard
            expression={mathData.expression}
            result={mathData.result}
            onOpen={() => { setCalcExpression(mathData.expression); setCalcResult(mathData.result); setCalcVisible(true); }}
          />
        )}
      </View>
    );
  }, [streamingMessageId, handleCancelGeneration, handleEditMessage, handleCopyMessage, isOffline]);

  const renderMediaPreview = useCallback(() => {
    if (selectedMedia.length === 0) return null;
    return (
      <View style={styles.selectedMediaPreview}>
        {selectedMedia.map((media, index) => (
          <Animated.View key={`${media.uri}-${index}`} style={[styles.mediaPreviewItem, { transform: [{ scale: pulseAnim }] }]}>
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
          </Animated.View>
        ))}
      </View>
    );
  }, [selectedMedia, removeMedia, pulseAnim, colors]);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: Platform.select({ ios: insets.top, android: StatusBar.currentHeight || 0, default: 0 }),
    },
    // ── HEADER: Before Chat (No Messages) ──
    headerEmpty: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.background,
    },
    upgradeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#2D2B5E',
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 8,
      gap: 6,
    },
    upgradeBtnText: { color: '#7C6FF7', fontSize: 15, fontWeight: '600' },
    headerEmptyRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    headerIconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    // ── HEADER: After Chat (Has Messages) ──
    headerChat: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: colors.background,
      gap: 12,
    },
    headerChatLeft: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerChatTitle: { flex: 1, fontSize: 17, fontWeight: '600', color: colors.text },
    headerChatRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    headerChatEditBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 8,
      gap: 6,
    },
    blurOverlayContainer: { ...StyleSheet.absoluteFillObject, zIndex: 9999, justifyContent: 'center', alignItems: 'center' },
    blurView: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
    blurContent: { alignItems: 'center', justifyContent: 'center' },
    blurText: { fontSize: 24, fontWeight: 'bold', color: 'white', marginTop: 16 },
    blurSubtext: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 8 },
    messagesContainer: { flex: 1 },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingBottom: Platform.select({ ios: insets.bottom + 8, android: insets.bottom + 8, default: 8 }),
      paddingTop: 8,
      gap: 8,
      backgroundColor: colors.background,
    },
    inputWrapper: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
      borderRadius: 26,
      paddingHorizontal: 16,
      minHeight: 48,
      maxHeight: 120,
    },
    input: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: 12, maxHeight: 100 },
    recordingIndicator: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: Spacing.sm },
    recordingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF3B30' },
    recordingDotActive: { backgroundColor: '#FF3B30', shadowColor: '#FF3B30', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 6, elevation: 8 },
    recordingText: { ...Typography.body, color: '#FF3B30', fontWeight: '600' },
    recordingDuration: { ...Typography.caption, color: colors.textSecondary, marginLeft: 'auto' },
    addBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
      alignItems: 'center',
      justifyContent: 'center',
    },
    micBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendButton: { backgroundColor: colors.primary, borderRadius: BorderRadius.full, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    recordingButton: { backgroundColor: '#FF3B30' },
    processingButton: { backgroundColor: colors.textSecondary },
    // Empty state
    emptyState: { flex: 1 },
    emptyCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 40 },
    loadingContainer: { padding: Spacing.md, alignItems: 'center' },
    selectedMediaPreview: { flexDirection: 'row', gap: Spacing.xs, paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, maxHeight: 80 },
    mediaPreviewItem: { width: 60, height: 60, borderRadius: BorderRadius.sm, backgroundColor: colors.surface, position: 'relative', overflow: 'hidden' },
    mediaImage: { width: '100%', height: '100%' },
    documentPreview: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', padding: 4 },
    documentName: { ...Typography.caption, fontSize: 8, color: colors.textSecondary, marginTop: 2 },
    removeMediaButton: { position: 'absolute', top: -6, right: -6, backgroundColor: '#FF3B30', borderRadius: BorderRadius.full, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
    editingIndicator: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, backgroundColor: `${colors.primary}20`, borderBottomWidth: 1, borderBottomColor: colors.border },
    editingText: { ...Typography.caption, color: colors.primary, flex: 1 },
    offlineBanner: { backgroundColor: '#FF9500', padding: Spacing.xs, alignItems: 'center' },
    offlineText: { color: '#FFFFFF', ...Typography.caption, fontWeight: '600' },
    limitBanner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderTopWidth: 1, gap: Spacing.sm },
    limitBannerButton: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full },
    langChipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: Spacing.md, paddingVertical: 8, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
    langChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
    langChipText: { fontSize: 13, fontWeight: '600', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
    userAvatarBtn: { width: 34, height: 34, borderRadius: 17, overflow: 'hidden', backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
    userAvatar: { width: 34, height: 34, borderRadius: 17 },
    suggestionsRow: { paddingHorizontal: 16, paddingBottom: 16 },
    suggestionCard: {
      backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
      borderRadius: 16,
      padding: 14,
      width: 160,
      minHeight: 70,
      justifyContent: 'flex-end',
    },
    suggestionTitle: { color: colors.text, fontWeight: '700', fontSize: 14, marginBottom: 2 },
    suggestionSub: { color: colors.textSecondary, fontSize: 12 },
    groupActionBtn: { borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(0,122,255,0.4)' },
    groupActionBtnText: { color: '#007AFF', fontSize: 15, fontWeight: '600' },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, margin: Spacing.md, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.lg, height: 40 },
    searchInput: { flex: 1, ...Typography.body, color: colors.text, marginLeft: Spacing.sm },
  }), [colors, insets, isDark]);

  const displayMessages = isSearchMode && searchQuery ? filteredMessages : messages;
  const showSendButton = inputText.trim().length > 0 || selectedMedia.length > 0;
  const isRecording = recordingState === 'recording';
  const isProcessing = recordingState === 'processing';
  const accentColor = settings.accentColor || colors.primary;
  const hasMessages = (messages || []).length > 0;

  const suggestions = [
    { title: 'Create a cartoon', sub: 'illustration of my pet' },
    { title: 'Write an email', sub: 'to request a quote from local plumbers' },
    { title: 'Help with code', sub: 'debug or write code' },
    { title: 'Summarize text', sub: 'paste any article' },
  ];

  const suggestionAnims = useRef(suggestions.map(() => ({
    opacity: new Animated.Value(0),
    translateY: new Animated.Value(24),
  }))).current;

  useEffect(() => {
    if (!hasMessages) {
      suggestionAnims.forEach(a => { a.opacity.setValue(0); a.translateY.setValue(24); });
      const animations = suggestionAnims.map((a, i) =>
        Animated.parallel([
          Animated.timing(a.opacity, { toValue: 1, duration: 300, delay: i * 80, useNativeDriver: true }),
          Animated.timing(a.translateY, { toValue: 0, duration: 300, delay: i * 80, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ])
      );
      Animated.stagger(80, animations).start();
    }
  }, [hasMessages]);

  const handleSuggestionTap = useCallback(async (suggestion: { title: string; sub: string }) => {
    const text = `${suggestion.title} — ${suggestion.sub}`;
    setTimeout(async () => {
      let conversationId = currentConversation?.id;
      if (!conversationId) {
        conversationId = await createConversation();
        if (!conversationId) return;
      }
      setSending(true);
      setGenerating(true);
      setInputText('');
      setThinkingMode('thinking');
      try {
        await sendMessage(text, undefined, undefined, false, currentAIModel);
        setShowCompletionStatus(true);
        setTimeout(() => setShowCompletionStatus(false), 2000);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (e: any) {
        showAlert('Error', e?.message || 'Failed to send');
        setInputText(text);
      } finally {
        setSending(false);
        setGenerating(false);
      }
    }, 50);
  }, [currentConversation, createConversation, sendMessage, currentAIModel, showAlert]);

  const userName = user?.email?.split('@')[0] || 'You';

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <GestureDetector gesture={swipeGesture}>
          <View style={{ flex: 1 }}>
            <KeyboardAvoidingView
              style={styles.container}
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={0}
            >
              <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

              {isOffline && (
                <View style={styles.offlineBanner}>
                  <Text style={styles.offlineText}>No connection — some features unavailable</Text>
                </View>
              )}

              {user && !isUnlimited && !isAdmin && !canSendMessage() && sessionBonusMessages <= 0 && (
                <View style={[styles.limitBanner, { backgroundColor: colors.surface, borderColor: colors.border, flexWrap: 'wrap' }]}>
                  <View style={{ flex: 1, minWidth: 160 }}>
                    <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>Daily limit reached</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>{timeUntilMidnight ? `Resets in ${timeUntilMidnight}` : 'Resets at midnight'}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                    {!hasUsedNewChatBonus && (
                      <TouchableOpacity
                        style={[styles.limitBannerButton, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}
                        onPress={async () => { setHasUsedNewChatBonus(true); setSessionBonusMessages(100); await createConversation(); setInputText(''); setSelectedMedia([]); }}
                      >
                        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>New Chat</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={[styles.limitBannerButton, { backgroundColor: accentColor }]} onPress={() => router.push('/subscription')}>
                      <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 13 }}>Get Plus</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* ══ HEADER ══ */}
              {!hasMessages ? (
                // Empty state header (Photo 2 style)
                <View style={styles.headerEmpty}>
                  <TouchableOpacity onPress={() => setSideMenuVisible(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="menu" size={26} color={colors.text} />
                  </TouchableOpacity>

                  {/* Center: Upgrade button */}
                  <TouchableOpacity style={styles.upgradeBtn} onPress={() => router.push('/subscription')}>
                    <Ionicons name="sparkles" size={15} color="#7C6FF7" />
                    <Text style={styles.upgradeBtnText}>Upgrade</Text>
                  </TouchableOpacity>

                  {/* Right: Group chat + Temporary chat icons */}
                  <View style={styles.headerEmptyRight}>
                    <TouchableOpacity
                      style={styles.headerIconBtn}
                      onPress={() => {
                        setGroupChatMode(true);
                        setTemporaryChatMode(false);
                        handleNewChat();
                      }}
                    >
                      <Ionicons name="person-add-outline" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.headerIconBtn}
                      onPress={() => {
                        setTemporaryChatMode(true);
                        setGroupChatMode(false);
                      }}
                    >
                      <Ionicons name="timer-outline" size={24} color={colors.text} />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                // Chat active header (Photo 5 style)
                <View style={styles.headerChat}>
                  <TouchableOpacity style={styles.headerChatLeft} onPress={() => setSideMenuVisible(true)}>
                    <Ionicons name="menu" size={26} color={colors.text} />
                  </TouchableOpacity>

                  <Text style={styles.headerChatTitle} numberOfLines={1}>
                    {groupChatMode ? 'Group Chat' : (temporaryChatMode ? 'Temporary chat' : (currentConversation?.title || 'Haitian AI'))}
                  </Text>

                  <View style={styles.headerChatRight}>
                    {/* Pencil/New chat icon */}
                    <TouchableOpacity
                      style={styles.headerChatEditBtn}
                      onPress={handleNewChat}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="create-outline" size={18} color={colors.text} />
                    </TouchableOpacity>

                    {/* Ellipsis menu */}
                    <TouchableOpacity
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      onPress={() => setConversationMenuVisible(true)}
                    >
                      <Ionicons name="ellipsis-horizontal" size={22} color={colors.text} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Search Bar */}
              {isSearchMode && (
                <View style={styles.searchContainer}>
                  <Ionicons name="search" size={20} color={colors.textSecondary} />
                  <TextInput style={styles.searchInput} placeholder="Search messages..." placeholderTextColor={colors.textSecondary} value={searchQuery} onChangeText={setSearchQuery} autoFocus />
                  <TouchableOpacity onPress={() => { setIsSearchMode(false); setSearchQuery(''); }}>
                    <Ionicons name="close" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              )}

              {/* Messages List */}
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              ) : (displayMessages || []).length === 0 ? (
                <View style={styles.emptyState}>
                  {temporaryChatMode ? (
                    <TemporaryChatBanner onClose={() => setTemporaryChatMode(false)} />
                  ) : groupChatMode ? (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
                      <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center', marginBottom: 20 }}>
                        <Text style={{ color: colors.text, fontWeight: '700' }}>{userName}</Text>
                        {' created the group chat.\n'}Your personal Haitian AI memory is never used in group chats.
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
                    // Normal empty state with suggestions
                    <View style={{ flex: 1 }}>
                      <View style={{ flex: 1 }} />
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={[styles.suggestionsRow, { gap: 10 }]}
                      >
                        {suggestions.map((s, i) => (
                          <Animated.View
                            key={s.title}
                            style={{ opacity: suggestionAnims[i].opacity, transform: [{ translateY: suggestionAnims[i].translateY }] }}
                          >
                            <TouchableOpacity style={styles.suggestionCard} activeOpacity={0.7} onPress={() => handleSuggestionTap(s)}>
                              <Text style={styles.suggestionTitle}>{s.title}</Text>
                              <Text style={styles.suggestionSub}>{s.sub}</Text>
                            </TouchableOpacity>
                          </Animated.View>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
              ) : (
                <FlatList
                  ref={flatListRef}
                  data={displayMessages || []}
                  renderItem={renderMessage}
                  keyExtractor={item => item.id}
                  contentContainerStyle={{ paddingVertical: Spacing.md }}
                  ListHeaderComponent={groupChatMode && (messages || []).length > 0 ? (
                    <View style={{ paddingHorizontal: 16, paddingBottom: 16, alignItems: 'center', gap: 10 }}>
                      <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: 'center' }}>
                        <Text style={{ color: colors.text, fontWeight: '700' }}>{userName}</Text>
                        {' created the group chat.'}
                      </Text>
                      {groupCustomInstructions ? (
                        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                          {userName} set Haitian AI to {groupRespondAuto ? 'automatically respond' : 'only respond when mentioned'}.
                        </Text>
                      ) : null}
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
                    <ThinkingIndicator userMessage={(messages || []).length > 0 ? (messages || [])[messages.length - 1].content : inputText} completed={showCompletionStatus} mode={thinkingMode} />
                  ) : null}
                  onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                  maxToRenderPerBatch={10}
                  windowSize={10}
                  removeClippedSubviews={Platform.OS === 'android'}
                />
              )}

              {/* Code language chips */}
              {codeLangChips && (
                <View style={styles.langChipsContainer}>
                  {['python', 'javascript', 'typescript', 'html', 'css', 'bash', 'json'].map(lang => (
                    <TouchableOpacity
                      key={lang}
                      style={[styles.langChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
                      onPress={() => { setInputText(inputText.replace(/```\w*$/, '```' + lang + '\n')); setCodeLangChips(false); }}
                    >
                      <Text style={[styles.langChipText, { color: colors.text }]}>{lang}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {renderMediaPreview()}

              {editingMessageId && (
                <View style={styles.editingIndicator}>
                  <Ionicons name="pencil" size={16} color={colors.primary} />
                  <Text style={styles.editingText}>Editing message...</Text>
                  <TouchableOpacity onPress={handleCancelEdit}>
                    <Text style={{ ...Typography.caption, color: colors.primary, fontWeight: '600' }}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Input Area */}
              <View style={styles.inputContainer}>
                <TouchableOpacity
                  style={styles.addBtn}
                  onPress={() => setToolsVisible(true)}
                  disabled={editingMessageId !== null || isRecording || isProcessing}
                >
                  <Ionicons name="add" size={26} color={editingMessageId || isRecording || isProcessing ? colors.textSecondary : colors.text} />
                </TouchableOpacity>

                <View style={styles.inputWrapper}>
                  {isRecording ? (
                    <View style={styles.recordingIndicator}>
                      <Animated.View style={[styles.recordingDot, styles.recordingDotActive, { transform: [{ scale: pulseAnim }] }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.recordingText}>Recording...</Text>
                        <Text style={styles.recordingDuration}>{formatDuration(recordingDuration)} / 1:00</Text>
                      </View>
                    </View>
                  ) : isProcessing ? (
                    <View style={styles.recordingIndicator}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={{ fontSize: 16, color: colors.text, marginLeft: Spacing.sm }}>Transcribing...</Text>
                    </View>
                  ) : (
                    <TextInput
                      ref={inputRef}
                      style={styles.input}
                      placeholder={temporaryChatMode ? 'Temporary chat' : (editingMessageId ? 'Edit message...' : 'Ask anything')}
                      placeholderTextColor={colors.textSecondary}
                      value={inputText}
                      onChangeText={(txt) => {
                        const safeTxt = txt ?? '';
                        setInputText(safeTxt);
                        try { setCodeLangChips(/```\w*$/.test(safeTxt)); } catch (_e) { setCodeLangChips(false); }
                      }}
                      multiline
                      maxLength={4000}
                      editable={!sending && !isRecording && !isProcessing}
                      returnKeyType="default"
                      blurOnSubmit={false}
                    />
                  )}
                </View>

                {editingMessageId && (
                  <TouchableOpacity style={{ padding: 8 }} onPress={handleCancelEdit}>
                    <Ionicons name="close-circle-outline" size={24} color="#FF3B30" />
                  </TouchableOpacity>
                )}

                {/* Microphone button (standalone, orange/red) */}
                <TouchableOpacity
                  style={[
                    styles.micBtn,
                    { backgroundColor: isRecording ? '#FF3B30' : (isProcessing ? '#888' : '#E8460A') }
                  ]}
                  onPress={toggleRecording}
                  disabled={editingMessageId !== null}
                >
                  {isProcessing ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Ionicons name={isRecording ? 'stop' : 'mic'} size={22} color="#FFFFFF" />
                  )}
                </TouchableOpacity>

                {/* Send button (only when text) */}
                {sending ? (
                  <TouchableOpacity style={[styles.sendButton, { backgroundColor: '#FF3B30' }]} onPress={() => { setSending(false); setGenerating(false); }}>
                    <View style={{ width: 12, height: 12, backgroundColor: '#FFFFFF', borderRadius: 2 }} />
                  </TouchableOpacity>
                ) : showSendButton ? (
                  <TouchableOpacity style={[styles.sendButton, { backgroundColor: accentColor }]} onPress={handleSend} disabled={isRecording || isProcessing}>
                    <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                ) : null}
              </View>
            </KeyboardAvoidingView>

            {/* Modals */}
            <MenuModal visible={menuVisible} onClose={() => setMenuVisible(false)} />

            <ToolsModal
              visible={toolsVisible}
              onClose={() => setToolsVisible(false)}
              onSelectTool={(tool) => setInputText(prev => `${prev}[${tool}] `)}
              onPickMedia={handleMediaPicked}
              onSelectAIModel={(model) => handleAIModelSelect(model as AIModelKey)}
              onOpenCamera={() => router.push('/camera')}
              currentModel={currentAIModel}
            />

            <ConversationMenuModal
              visible={conversationMenuVisible}
              onClose={() => setConversationMenuVisible(false)}
              onShare={handleShareConversation}
              onRename={(title) => { setConversationMenuVisible(false); setRenameModalVisible(true); }}
              onReport={() => router.push('/bugreport')}
              onArchive={() => { setConversationMenuVisible(false); setArchiveConfirmVisible(true); }}
              onDelete={() => { setConversationMenuVisible(false); handleDeleteConversation(); }}
              onAddPeople={handleAddPeople}
              conversationTitle={currentConversation?.title}
            />

            <SideMenu
              visible={sideMenuVisible}
              onClose={() => setSideMenuVisible(false)}
              currentProject={{ name: 'Haitian AI Chat' }}
              currentAIMode={currentAIMode}
              onSelectAIMode={handleSelectAIMode}
              onNewChat={handleNewChat}
              onChatHistory={() => { setSideMenuVisible(false); setChatHistoryVisible(true); }}
              onSettings={() => { setSideMenuVisible(false); router.push('/settings'); }}
              onProfile={() => { setSideMenuVisible(false); router.push('/profile'); }}
              userCoins={coins}
              isUnlimited={isUnlimited}
              isAdmin={isAdmin}
            />

            <ChatHistoryModal
              visible={chatHistoryVisible}
              onClose={() => setChatHistoryVisible(false)}
              onSelectChat={(id) => { setChatHistoryVisible(false); }}
              onNewChat={() => { handleNewChat(); setChatHistoryVisible(false); }}
              currentChatId={currentConversation?.id}
            />

            <CalculatorModal visible={calcVisible} onClose={() => setCalcVisible(false)} initialExpression={calcExpression} initialResult={calcResult} />

            <RenameModal
              visible={renameModalVisible}
              currentTitle={currentConversation?.title || ''}
              onConfirm={async (title) => { setRenameModalVisible(false); await handleRenameConversation(title); }}
              onCancel={() => setRenameModalVisible(false)}
            />

            <ArchiveConfirmModal
              visible={archiveConfirmVisible}
              onConfirm={() => { setArchiveConfirmVisible(false); handleArchiveConversation(); }}
              onCancel={() => setArchiveConfirmVisible(false)}
            />

            <ProfileSetupModal visible={profileSetupVisible} user={user} onClose={() => setProfileSetupVisible(false)} />

            <CustomizeAIModal
              visible={customizeAIVisible}
              onClose={() => setCustomizeAIVisible(false)}
              onSave={(instructions, respondAuto) => { setGroupCustomInstructions(instructions); setGroupRespondAuto(respondAuto); }}
            />

            <InviteLinkModal visible={inviteLinkVisible} onClose={() => setInviteLinkVisible(false)} isPlus={isUnlimited} />

            {/* Security Blur Overlay */}
            {showBlurOverlay && (
              <Animated.View style={[styles.blurOverlayContainer, { opacity: fadeAnim }]}>
                <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={styles.blurView}>
                  <View style={styles.blurContent}>
                    <Ionicons name="lock-closed" size={40} color="rgba(255,255,255,0.8)" />
                    <Text style={styles.blurText}>Haitian AI Chat</Text>
                    <Text style={styles.blurSubtext}>App locked for privacy</Text>
                    <TouchableOpacity
                      style={{ marginTop: Spacing.lg, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderRadius: BorderRadius.lg }}
                      onPress={() => { setShowBlurOverlay(false); setIsAppActive(true); }}
                    >
                      <Text style={{ color: 'white', fontWeight: '600' }}>Unlock</Text>
                    </TouchableOpacity>
                  </View>
                </BlurView>
              </Animated.View>
            )}
          </View>
        </GestureDetector>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

// ── Error Boundary ──
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
          <Text style={{ fontSize: 48, marginBottom: 16 }}>⚠️</Text>
          <Text style={{ color: '#FFF', fontSize: 22, fontWeight: '700', marginBottom: 8 }}>Something went wrong</Text>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, textAlign: 'center', marginBottom: 32 }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: '#10A37F', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 }}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '600' }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}
