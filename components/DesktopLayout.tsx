/**
 * DesktopLayout.tsx
 * ChatGPT-style desktop layout for web (≥1024px)
 * - Fixed left sidebar, scrollable right content
 * - Complete settings panel with all sections (Security, Data, Storage, Billing, Notifications, etc.)
 * - Keyboard shortcuts: Ctrl+N, Ctrl+K, Ctrl+,, Escape, ?, Enter/Shift+Enter
 * - Desktop login modal with real OTP flow
 * - "Ready when you are." home state
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, Modal, Pressable, Dimensions, Platform,
  ActivityIndicator, Switch, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useTheme } from '../hooks/useTheme';
import { useAuth, useAlert, getSupabaseClient } from '@/template';
import { useConversation } from '../hooks/useConversation';
import { useSettings } from '../hooks/useSettings';
import { useSubscription } from '../hooks/useSubscription';
import { useRouter } from 'expo-router';
import { useProfile } from '../contexts/ProfileContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCENT = '#10A37F';

// ── Detect desktop ──────────────────────────────────────────────────────────
export function useIsDesktop() {
  const [width, setWidth] = useState(Dimensions.get('window').width);
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => setWidth(window.width));
    return () => sub.remove();
  }, []);
  return width >= 1024;
}

// ════════════════════════════════════════════════════════════════════════════
// KEYBOARD SHORTCUTS HOOK
// ════════════════════════════════════════════════════════════════════════════
function useKeyboardShortcuts({
  onNewChat, onOpenSearch, onOpenSettings, onCloseAll, onShowHelp,
}: {
  onNewChat: () => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  onCloseAll: () => void;
  onShowHelp: () => void;
}) {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onCloseAll(); return; }
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !(e.target as HTMLElement)?.matches('input,textarea')) {
        onShowHelp(); return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); onNewChat(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); onOpenSearch(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === ',') { e.preventDefault(); onOpenSettings(); return; }
    };
    (window as any).addEventListener('keydown', handler);
    return () => (window as any).removeEventListener('keydown', handler);
  }, [onNewChat, onOpenSearch, onOpenSettings, onCloseAll, onShowHelp]);
}

// ════════════════════════════════════════════════════════════════════════════
// KEYBOARD SHORTCUTS HELP MODAL
// ════════════════════════════════════════════════════════════════════════════
function KeyboardShortcutsModal({ visible, onClose, isDark }: {
  visible: boolean; onClose: () => void; isDark: boolean;
}) {
  const bg = isDark ? '#1C1C1E' : '#FFFFFF';
  const textC = isDark ? '#FFF' : '#000';
  const sub = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)';
  const borderC = isDark ? 'rgba(255,255,255,0.1)' : '#E5E5EA';
  const keyBg = isDark ? 'rgba(255,255,255,0.12)' : '#F5F5F7';

  const shortcuts = [
    { keys: ['Ctrl', 'N'], desc: 'New chat' },
    { keys: ['Ctrl', 'K'], desc: 'Open search' },
    { keys: ['Ctrl', ','], desc: 'Open settings' },
    { keys: ['Escape'], desc: 'Close modal / Cancel' },
    { keys: ['Enter'], desc: 'Send message' },
    { keys: ['Shift', 'Enter'], desc: 'New line in message' },
    { keys: ['?'], desc: 'Show keyboard shortcuts' },
  ];

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[dls.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.45)' }]} onPress={onClose}>
        <Pressable style={[dls.shortcutsCard, { backgroundColor: bg }]} onPress={() => {}}>
          <TouchableOpacity style={dls.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={18} color={sub} />
          </TouchableOpacity>
          <Text style={[dls.loginTitle, { color: textC, fontSize: 18, marginBottom: 20 }]}>Keyboard Shortcuts</Text>
          {shortcuts.map((s, i) => (
            <View key={i} style={[dls.shortcutRow, { borderBottomColor: borderC, borderBottomWidth: i < shortcuts.length - 1 ? StyleSheet.hairlineWidth : 0 }]}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {s.keys.map((k, ki) => (
                  <View key={ki} style={[dls.keyChip, { backgroundColor: keyBg }]}>
                    <Text style={{ color: textC, fontSize: 12, fontWeight: '600' }}>{k}</Text>
                  </View>
                ))}
              </View>
              <Text style={{ color: sub, fontSize: 14 }}>{s.desc}</Text>
            </View>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// LOGIN MODAL (desktop overlay)
// ════════════════════════════════════════════════════════════════════════════
function DesktopLoginModal({ visible, onClose, onSuccess }: {
  visible: boolean; onClose: () => void; onSuccess: () => void;
}) {
  const { sendOTP, verifyOTPAndLogin, signInWithGoogle, operationLoading } = useAuth();
  const { showAlert } = useAlert();
  const { isDark } = useTheme();

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'main' | 'otp'>('main');

  const bg = isDark ? '#1e1e1e' : '#FFFFFF';
  const overlay = isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.4)';
  const textC = isDark ? '#FFF' : '#000';
  const sub = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)';
  const borderC = isDark ? 'rgba(255,255,255,0.15)' : '#D1D1D6';
  const inputBg = isDark ? 'rgba(255,255,255,0.07)' : '#F5F5F7';

  const reset = () => { setEmail(''); setOtp(''); setStep('main'); };

  const handleSendOTP = async () => {
    if (!email.trim()) { showAlert('Error', 'Please enter your email'); return; }
    const { error } = await sendOTP(email.trim());
    if (error) { showAlert('Error', error); return; }
    setStep('otp');
  };

  const handleVerifyOTP = async () => {
    if (!otp.trim() || otp.trim().length < 6) { showAlert('Error', 'Please enter the 6-digit code'); return; }
    const { error } = await verifyOTPAndLogin(email.trim(), otp.trim());
    if (error) { showAlert('Error', error); return; }
    reset(); onSuccess();
  };

  const handleGoogle = async () => {
    const { error } = await signInWithGoogle();
    if (error) showAlert('Error', error);
    else { reset(); onSuccess(); }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { reset(); onClose(); }}>
      <Pressable style={[dls.modalOverlay, { backgroundColor: overlay }]} onPress={() => { reset(); onClose(); }}>
        <Pressable style={[dls.loginCard, { backgroundColor: bg }]} onPress={() => {}}>
          <TouchableOpacity style={dls.closeBtn} onPress={() => { reset(); onClose(); }}>
            <Ionicons name="close" size={20} color={sub} />
          </TouchableOpacity>

          <Text style={[dls.loginTitle, { color: textC }]}>Log in or sign up</Text>
          <Text style={[dls.loginSub, { color: sub }]}>
            {"You'll get smarter responses and can upload files, images, and more."}
          </Text>

          {step === 'main' && (
            <>
              <TouchableOpacity style={[dls.socialBtn, { borderColor: borderC }]} onPress={handleGoogle} activeOpacity={0.8} disabled={operationLoading}>
                <Ionicons name="logo-google" size={18} color={textC} />
                <Text style={[dls.socialBtnText, { color: textC }]}>Continue with Google</Text>
              </TouchableOpacity>

              <View style={dls.orRow}>
                <View style={[dls.orLine, { backgroundColor: borderC }]} />
                <Text style={[dls.orText, { color: sub }]}>OR</Text>
                <View style={[dls.orLine, { backgroundColor: borderC }]} />
              </View>

              <View style={[dls.inputRow, { backgroundColor: inputBg, borderColor: borderC, marginBottom: 12 }]}>
                <TextInput
                  style={[dls.input, { color: textC, flex: 1 }]}
                  placeholder="Email address"
                  placeholderTextColor={sub}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  onSubmitEditing={handleSendOTP}
                  returnKeyType="go"
                />
              </View>

              <TouchableOpacity
                style={[dls.primaryBtn, { opacity: operationLoading ? 0.7 : 1 }]}
                onPress={handleSendOTP}
                disabled={operationLoading}
              >
                {operationLoading ? <ActivityIndicator color="#FFF" /> : <Text style={dls.primaryBtnText}>Continue</Text>}
              </TouchableOpacity>
            </>
          )}

          {step === 'otp' && (
            <>
              <Text style={[{ color: sub, fontSize: 14, marginBottom: 16, textAlign: 'center' }]}>
                We sent a 6-digit code to {email}
              </Text>
              <View style={[dls.inputRow, { backgroundColor: inputBg, borderColor: borderC, marginBottom: 16 }]}>
                <TextInput
                  style={[dls.input, { color: textC, flex: 1, letterSpacing: 8, textAlign: 'center', fontSize: 22, fontWeight: '700' }]}
                  placeholder="000000"
                  placeholderTextColor={sub}
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                  onSubmitEditing={handleVerifyOTP}
                  returnKeyType="go"
                />
              </View>
              <TouchableOpacity
                style={[dls.primaryBtn, { opacity: operationLoading ? 0.7 : 1 }]}
                onPress={handleVerifyOTP}
                disabled={operationLoading}
              >
                {operationLoading ? <ActivityIndicator color="#FFF" /> : <Text style={dls.primaryBtnText}>Verify & Sign in</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={{ marginTop: 12, alignItems: 'center' }} onPress={() => setStep('main')}>
                <Text style={{ color: ACCENT, fontSize: 14 }}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ marginTop: 8, alignItems: 'center' }} onPress={handleSendOTP} disabled={operationLoading}>
                <Text style={{ color: sub, fontSize: 13 }}>Resend code</Text>
              </TouchableOpacity>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// CONVERSATION CONTEXT MENU (… button → small popup)
// ════════════════════════════════════════════════════════════════════════════
function ConvContextMenu({ conv, position, onClose, onAction, isDark }: {
  conv: { id: string; title: string } | null;
  position: { top: number; left: number };
  onClose: () => void;
  onAction: (action: 'share' | 'group' | 'rename' | 'pin' | 'archive' | 'delete') => void;
  isDark: boolean;
}) {
  const bg = isDark ? '#2C2C2E' : '#FFFFFF';
  const textC = isDark ? '#FFF' : '#000';
  const borderC = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)';
  const shadow = { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.22, shadowRadius: 16, elevation: 16 };

  const items = [
    { key: 'share', icon: 'arrow-redo-outline', label: 'Share' },
    { key: 'group', icon: 'person-add-outline', label: 'Start a group chat' },
    { key: 'rename', icon: 'pencil-outline', label: 'Rename' },
    { key: 'pin', icon: 'pin-outline', label: 'Pin chat' },
    { key: 'archive', icon: 'archive-outline', label: 'Archive' },
    { key: 'delete', icon: 'trash-outline', label: 'Delete', destructive: true },
  ] as const;

  if (!conv) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={{ flex: 1 }} onPress={onClose}>
        <View style={[dls.convMenu, shadow, { backgroundColor: bg, top: position.top, left: position.left }]}>
          {items.map((item, i) => (
            <TouchableOpacity
              key={item.key}
              style={[dls.convMenuItem, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: borderC }]}
              onPress={() => { onClose(); onAction(item.key as any); }}
              activeOpacity={0.7}
            >
              <Ionicons name={item.icon as any} size={16} color={(item as any).destructive ? '#FF3B30' : textC} />
              <Text style={[dls.convMenuText, { color: (item as any).destructive ? '#FF3B30' : textC }]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// USER BOTTOM MENU (click name/avatar at bottom of sidebar)
// ════════════════════════════════════════════════════════════════════════════
function UserBottomMenu({ visible, onClose, user, isDark, onLogout, profilePhotoUrl, displayName, tier, router }: {
  visible: boolean; onClose: () => void; user: any; isDark: boolean;
  onLogout: () => void; profilePhotoUrl: string | null; displayName: string; tier: string; router: any;
}) {
  const bg = isDark ? '#2C2C2E' : '#FFFFFF';
  const textC = isDark ? '#FFF' : '#000';
  const borderC = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)';
  const sub = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';

  if (!visible) return null;

  const items = [
    { icon: 'arrow-up-circle-outline', label: 'Upgrade plan', action: () => { onClose(); router.push('/subscription'); } },
    { icon: 'person-outline', label: 'Personalization', action: () => { onClose(); router.push('/personalization'); } },
    { icon: 'person-circle-outline', label: 'Profile', action: () => { onClose(); router.push('/settings'); } },
    { icon: 'settings-outline', label: 'Settings', action: () => { onClose(); router.push('/settings'); } },
    { icon: 'help-circle-outline', label: 'Help', action: () => { onClose(); router.push('/bugreport'); } },
    { icon: 'log-out-outline', label: 'Log out', action: onLogout, destructive: true },
  ];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1 }} onPress={onClose}>
        <View style={[dls.userMenu, { backgroundColor: bg, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 16 }]}>
          <View style={[dls.userMenuHeader, { borderBottomColor: borderC }]}>
            {profilePhotoUrl ? (
              <Image source={{ uri: profilePhotoUrl }} style={{ width: 40, height: 40, borderRadius: 20 }} contentFit="cover" />
            ) : (
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 16 }}>{(displayName[0] || 'U').toUpperCase()}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ color: textC, fontWeight: '700', fontSize: 15 }} numberOfLines={1}>{displayName}</Text>
              <Text style={{ color: sub, fontSize: 12, marginTop: 1 }}>{tier === 'plus' ? 'Plus' : tier === 'go' ? 'Go' : 'Free'}</Text>
            </View>
            {tier !== 'plus' && (
              <TouchableOpacity style={[dls.upgradeChip, { backgroundColor: isDark ? '#2A2A2A' : '#F0F0F0' }]} onPress={() => { onClose(); router.push('/subscription'); }}>
                <Text style={{ color: textC, fontSize: 12, fontWeight: '600' }}>Upgrade</Text>
              </TouchableOpacity>
            )}
          </View>
          {items.map((item, i) => (
            <TouchableOpacity
              key={item.label}
              style={[dls.convMenuItem, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: borderC }]}
              onPress={item.action}
              activeOpacity={0.7}
            >
              <Ionicons name={item.icon as any} size={17} color={(item as any).destructive ? '#FF3B30' : textC} />
              <Text style={[dls.convMenuText, { color: (item as any).destructive ? '#FF3B30' : textC }]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// DESKTOP SETTINGS PANEL — full content for all sections
// Left nav FIXED, right content SCROLLABLE
// ════════════════════════════════════════════════════════════════════════════
function DesktopSettingsPanel({ visible, onClose, isDark, user, tier, onLogout }: {
  visible: boolean; onClose: () => void; isDark: boolean;
  user?: any; tier?: string; onLogout?: () => void;
}) {
  const { settings, updateSetting } = useSettings();
  const { showAlert } = useAlert();
  const router = useRouter();

  const bg = isDark ? '#1C1C1E' : '#FFFFFF';
  const panelBg = isDark ? '#111' : '#F5F5F7';
  const textC = isDark ? '#FFF' : '#000';
  const sub = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)';
  const borderC = isDark ? 'rgba(255,255,255,0.1)' : '#E5E5EA';
  const activeNavBg = isDark ? 'rgba(255,255,255,0.1)' : '#F0F0F5';
  const inputBg = isDark ? 'rgba(255,255,255,0.07)' : '#F5F5F7';
  const switchTrackTrue = '#34C759';
  const switchTrackFalse = isDark ? '#3A3A3C' : '#E5E5EA';
  const rowBg = isDark ? 'rgba(255,255,255,0.03)' : '#FAFAFA';
  const accentColor = settings.accentColor || ACCENT;

  const [activeSection, setActiveSection] = useState('general');
  const [mfaAuthEnabled, setMfaAuthEnabled] = useState(false);
  const [mfaTextEnabled, setMfaTextEnabled] = useState(false);
  const [deviceCodeEnabled, setDeviceCodeEnabled] = useState(false);
  const [separateVoice, setSeparateVoice] = useState(false);
  const [dictationEnabled, setDictationEnabled] = useState(true);
  const [personalizeAds, setPersonalizeAds] = useState(true);
  const [pastChatsAds, setPastChatsAds] = useState(true);
  const [improveModel, setImproveModel] = useState(true);
  const [notifSettings, setNotifSettings] = useState<Record<string, string>>({
    codex: 'Push', groupChats: 'Push', projects: 'Email', recommendations: 'Push, Email',
    responses: 'Push', tasks: 'Push, Email', usage: 'Push, Email',
  });

  const SECTIONS = [
    { id: 'general', icon: 'settings-outline', label: 'General' },
    { id: 'notifications', icon: 'notifications-outline', label: 'Notifications' },
    { id: 'personalization', icon: 'person-outline', label: 'Personalization' },
    { id: 'apps', icon: 'grid-outline', label: 'Apps' },
    { id: 'billing', icon: 'card-outline', label: 'Billing' },
    { id: 'ads', icon: 'megaphone-outline', label: 'Ads controls' },
    { id: 'data', icon: 'document-lock-outline', label: 'Data controls' },
    { id: 'storage', icon: 'folder-outline', label: 'Storage' },
    { id: 'security', icon: 'shield-outline', label: 'Security' },
    { id: 'parental', icon: 'people-outline', label: 'Parental controls' },
    { id: 'account', icon: 'person-circle-outline', label: 'Account' },
  ] as const;

  const ACCENT_COLORS = [
    { hex: '#10A37F', name: 'Green' },
    { hex: '#0A84FF', name: 'Blue' },
    { hex: '#FF9F0A', name: 'Orange' },
    { hex: '#FF453A', name: 'Red' },
    { hex: '#BF5AF2', name: 'Purple' },
    { hex: '#FF375F', name: 'Pink' },
  ];

  if (!visible) return null;

  // Reusable row components
  const Row = ({ label, sub: subText, right }: { label: string; sub?: string; right: React.ReactNode }) => (
    <View style={[dls.settingsRow, { borderBottomColor: borderC }]}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: textC, fontSize: 15 }}>{label}</Text>
        {subText ? <Text style={{ color: sub, fontSize: 12, marginTop: 2, lineHeight: 16 }}>{subText}</Text> : null}
      </View>
      <View>{right}</View>
    </View>
  );

  const NavRow = ({ label, action }: { label: string; action: () => void }) => (
    <TouchableOpacity style={[dls.settingsRow, { borderBottomColor: borderC }]} onPress={action} activeOpacity={0.7}>
      <Text style={{ color: textC, fontSize: 15, flex: 1 }}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={sub} />
    </TouchableOpacity>
  );

  const SectionTitle = ({ title }: { title: string }) => (
    <Text style={{ color: textC, fontSize: 18, fontWeight: '700', marginBottom: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: borderC }}>
      {title}
    </Text>
  );

  const SubHeader = ({ text }: { text: string }) => (
    <Text style={{ color: textC, fontSize: 16, fontWeight: '700', marginTop: 24, marginBottom: 8 }}>{text}</Text>
  );

  const OutlineBtn = ({ label, color, onPress }: { label: string; color?: string; onPress: () => void }) => (
    <TouchableOpacity style={[dls.outlineBtn, { borderColor: color || borderC }]} onPress={onPress} activeOpacity={0.75}>
      <Text style={{ color: color || textC, fontSize: 14 }}>{label}</Text>
    </TouchableOpacity>
  );

  const renderContent = () => {
    switch (activeSection) {

      // ── GENERAL ──────────────────────────────────────────────────────────
      case 'general':
        return (
          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            <SectionTitle title="General" />

            {/* MFA Banner */}
            <View style={[dls.mfaBanner, { backgroundColor: isDark ? '#2C2C2E' : '#F5F5F7', borderColor: borderC }]}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
                <Ionicons name="shield-checkmark-outline" size={28} color={textC} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: textC, fontSize: 16, fontWeight: '700', marginBottom: 4 }}>Secure your account</Text>
                  <Text style={{ color: sub, fontSize: 14, lineHeight: 20 }}>
                    Add multi-factor authentication (MFA), like a text message or authenticator app, to help protect your account when logging in.
                  </Text>
                  <TouchableOpacity style={[dls.mfaBtn, { borderColor: borderC }]} onPress={() => { onClose(); router.push('/authenticator-app'); }}>
                    <Text style={{ color: textC, fontSize: 14, fontWeight: '600' }}>Set up MFA</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <Row label="App updates" sub={`Current version: 1.2026.133`} right={<OutlineBtn label="Check for updates" onPress={() => {}} />} />
            <Row label="Launch at Login" right={<Text style={{ color: sub }}>On {'>'}</Text>} />
            <Row label="Companion window hotkey" right={
              <View style={[dls.outlineBtn, { borderColor: borderC, paddingHorizontal: 10 }]}>
                <Text style={{ color: textC, fontSize: 13 }}>Alt + SPACE</Text>
              </View>
            } />
            <Row label="Appearance" right={
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {['System', 'Light', 'Dark'].map(opt => (
                  <TouchableOpacity key={opt} style={[dls.appearanceChip, { backgroundColor: settings.appearance === opt ? accentColor : (isDark ? 'rgba(255,255,255,0.1)' : '#EBEBF0') }]} onPress={() => updateSetting('appearance', opt)}>
                    <Text style={{ color: settings.appearance === opt ? '#FFF' : textC, fontSize: 13, fontWeight: '500' }}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            } />
            <Row label="Contrast" right={
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {['System', 'Standard', 'High'].map(opt => (
                  <TouchableOpacity key={opt} style={[dls.appearanceChip, { backgroundColor: opt === 'System' ? (isDark ? 'rgba(255,255,255,0.1)' : '#EBEBF0') : (isDark ? 'rgba(255,255,255,0.07)' : '#F5F5F7') }]}>
                    <Text style={{ color: textC, fontSize: 13 }}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            } />
            <Row label="Accent color" right={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: accentColor }} />
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {ACCENT_COLORS.map(c => (
                    <TouchableOpacity key={c.hex} onPress={() => updateSetting('accentColor', c.hex)} style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: c.hex, borderWidth: accentColor === c.hex ? 3 : 0, borderColor: isDark ? '#FFF' : '#000' }} />
                  ))}
                </View>
              </View>
            } />
            <Row label="Text size" right={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity style={[dls.outlineBtn, { borderColor: borderC, width: 32, height: 32, alignItems: 'center', justifyContent: 'center', padding: 0 }]}>
                  <Ionicons name="remove" size={16} color={textC} />
                </TouchableOpacity>
                <TouchableOpacity style={[dls.outlineBtn, { borderColor: borderC, width: 32, height: 32, alignItems: 'center', justifyContent: 'center', padding: 0 }]}>
                  <Ionicons name="add" size={16} color={textC} />
                </TouchableOpacity>
                <TouchableOpacity style={[dls.outlineBtn, { borderColor: borderC }]}>
                  <Text style={{ color: textC, fontSize: 14 }}>Reset</Text>
                </TouchableOpacity>
              </View>
            } />
            <Row label="Language" right={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ color: sub }}>{settings.appLanguage || 'Auto-detect'}</Text>
                <Ionicons name="chevron-down" size={14} color={sub} />
              </View>
            } />
            <Row label="Enable Dictation" sub="Use dictation in the chat composer." right={
              <Switch value={dictationEnabled} onValueChange={setDictationEnabled} trackColor={{ true: switchTrackTrue, false: switchTrackFalse }} />
            } />
            <Row label="Spoken language" sub="For best results, select the language you mainly speak. If it's not listed, it may still be supported via auto-detection." right={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ color: sub }}>Auto-detect</Text>
                <Ionicons name="chevron-down" size={14} color={sub} />
              </View>
            } />
            <Row label="Voice" right={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="play" size={14} color={textC} />
                  <Text style={{ color: textC, fontSize: 13 }}>Play</Text>
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ color: sub }}>{settings.voiceSelection || 'Ember'}</Text>
                  <Ionicons name="chevron-down" size={14} color={sub} />
                </View>
              </View>
            } />
            <Row label="Separate Voice" sub="Keep AI Voice in a separate full screen, without real time transcripts and visuals." right={
              <Switch value={separateVoice} onValueChange={setSeparateVoice} trackColor={{ true: switchTrackTrue, false: switchTrackFalse }} />
            } />
            <Row label="Haptic feedback" right={<Switch value={settings.hapticFeedback} onValueChange={v => updateSetting('hapticFeedback', v)} trackColor={{ true: switchTrackTrue, false: switchTrackFalse }} />} />
            <Row label="Auto spelling correction" right={<Switch value={settings.autoSpelling} onValueChange={v => updateSetting('autoSpelling', v)} trackColor={{ true: switchTrackTrue, false: switchTrackFalse }} />} />
            <Row label="Autocomplete" right={<Switch value={settings.autocomplete} onValueChange={v => updateSetting('autocomplete', v)} trackColor={{ true: switchTrackTrue, false: switchTrackFalse }} />} />
            <Row label="Trending searches" right={<Switch value={settings.trendingSearches} onValueChange={v => updateSetting('trendingSearches', v)} trackColor={{ true: switchTrackTrue, false: switchTrackFalse }} />} />
            <Row label="Follow-up suggestions" right={<Switch value={settings.followupSuggestions !== false} onValueChange={v => updateSetting('followupSuggestions', v)} trackColor={{ true: switchTrackTrue, false: switchTrackFalse }} />} />
          </ScrollView>
        );

      // ── NOTIFICATIONS ─────────────────────────────────────────────────────
      case 'notifications':
        return (
          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            <SectionTitle title="Notifications" />
            {[
              { key: 'codex', label: 'Codex', sub: 'Get notified about Codex tasks.' },
              { key: 'groupChats', label: 'Group chats', sub: "You'll receive notifications for new messages from group chats." },
              { key: 'projects', label: 'Projects', sub: 'Get notified when you receive an email invitation to a shared project.' },
              { key: 'recommendations', label: 'Recommendations', sub: 'Stay in the loop on new tools, tips, and features from Dawinix.' },
              { key: 'responses', label: 'Responses', sub: 'Get notified when AI responds to requests that take time, like research or image generation.' },
              { key: 'tasks', label: 'Tasks', sub: "Get notified when tasks you've created have updates." },
              { key: 'usage', label: 'Usage', sub: "We'll notify you when limits reset for features like image creation." },
            ].map((item, i) => (
              <Row key={item.key} label={item.label} sub={item.sub} right={
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ color: sub, fontSize: 14 }}>{notifSettings[item.key] || 'Push'}</Text>
                  <Ionicons name="chevron-down" size={14} color={sub} />
                </View>
              } />
            ))}
          </ScrollView>
        );

      // ── PERSONALIZATION ───────────────────────────────────────────────────
      case 'personalization':
        return (
          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            <SectionTitle title="Personalization" />
            <NavRow label="Custom instructions" action={() => { onClose(); router.push('/personalization'); }} />
            <NavRow label="Memory" action={() => { onClose(); router.push('/personalization'); }} />
            <NavRow label="Profile" action={() => { onClose(); router.push('/settings'); }} />

            <SubHeader text="GPT builder profile" />
            <Text style={{ color: sub, fontSize: 13, marginBottom: 16, lineHeight: 18 }}>
              Personalize your builder profile to connect with users of your GPTs. These settings apply to publicly shared GPTs.
            </Text>

            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                <Ionicons name="cube-outline" size={28} color={sub} />
              </View>
              <Text style={{ color: textC, fontSize: 15, fontWeight: '600' }}>{user?.email?.split('@')[0] || 'PlaceholderGPT'}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <Text style={{ color: sub, fontSize: 12 }}>By community builder</Text>
                <Ionicons name="lock-closed" size={10} color={sub} />
              </View>
              <TouchableOpacity style={{ marginTop: 4 }}>
                <Text style={{ color: accentColor, fontSize: 13 }}>Preview</Text>
              </TouchableOpacity>
            </View>

            <View style={{ backgroundColor: isDark ? '#2C2C2E' : '#F0F0F5', borderRadius: 12, padding: 14, marginBottom: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <Ionicons name="information-circle-outline" size={18} color={sub} style={{ marginTop: 1 }} />
              <Text style={{ color: sub, fontSize: 13, flex: 1, lineHeight: 18 }}>
                Complete verification to publish GPTs to everyone. Verify your identity by adding billing details or verifying ownership of a public domain name.
              </Text>
            </View>

            <SubHeader text="Links" />
            <Row label="" right={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ color: sub, fontSize: 13 }}>Select a domain</Text>
                <Ionicons name="chevron-down" size={14} color={sub} />
              </View>
            } />
            {[
              { icon: 'logo-linkedin', label: 'LinkedIn' },
              { icon: 'logo-github', label: 'GitHub' },
            ].map(link => (
              <Row key={link.label} label={link.label} right={<OutlineBtn label="Add" onPress={() => {}} />} />
            ))}

            <SubHeader text="Email" />
            <View style={[dls.settingsRow, { borderBottomColor: borderC }]}>
              <Ionicons name="mail-outline" size={16} color={sub} />
              <Text style={{ color: sub, fontSize: 14, flex: 1, marginLeft: 8 }}>{user?.email || 'email@example.com'}</Text>
            </View>
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 }} activeOpacity={0.7}>
              <View style={{ width: 16, height: 16, borderRadius: 2, borderWidth: 1.5, borderColor: borderC, backgroundColor: 'transparent' }} />
              <Text style={{ color: textC, fontSize: 14 }}>Receive feedback emails</Text>
            </TouchableOpacity>
          </ScrollView>
        );

      // ── APPS ──────────────────────────────────────────────────────────────
      case 'apps':
        return (
          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            <SectionTitle title="Apps" />
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <View style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: accentColor, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Ionicons name="sparkles" size={32} color="#FFF" />
              </View>
              <Text style={{ color: sub, fontSize: 14, textAlign: 'center', marginBottom: 16 }}>Add and manage apps Dawinix can use in your chats.</Text>
              <TouchableOpacity style={{ backgroundColor: textC, borderRadius: 50, paddingHorizontal: 24, paddingVertical: 12 }} onPress={() => { onClose(); router.push('/app-connect'); }}>
                <Text style={{ color: isDark ? '#000' : '#FFF', fontSize: 15, fontWeight: '700' }}>Explore apps</Text>
              </TouchableOpacity>
            </View>
            <Row label="Advanced settings" right={<OutlineBtn label="Create app" onPress={() => {}} />} />
          </ScrollView>
        );

      // ── BILLING ───────────────────────────────────────────────────────────
      case 'billing':
        return (
          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            <SectionTitle title="Billing" />
            <Row label={tier === 'plus' ? 'Dawinix Plus' : 'Dawinix Free'} sub={tier === 'plus' ? 'Advanced AI for professionals' : 'Intelligence for everyday tasks'} right={
              tier !== 'plus' ? <OutlineBtn label="Upgrade" onPress={() => { onClose(); router.push('/subscription'); }} /> : <Text style={{ color: '#34C759', fontSize: 14, fontWeight: '600' }}>Active</Text>
            } />

            <SubHeader text="Payment methods" />
            <Row label="No payment methods available." right={<OutlineBtn label="Add new" onPress={() => { onClose(); router.push('/billing'); }} />} />

            <SubHeader text="Invoices" />
            <View style={{ paddingVertical: 20, alignItems: 'center' }}>
              <Ionicons name="receipt-outline" size={32} color={sub} />
              <Text style={{ color: sub, fontSize: 14, marginTop: 8 }}>No invoices yet</Text>
            </View>
          </ScrollView>
        );

      // ── ADS CONTROLS ─────────────────────────────────────────────────────
      case 'ads':
        return (
          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            <SectionTitle title="Ads controls" />
            <NavRow label="History" action={() => { onClose(); router.push('/ad-history'); }} />
            <NavRow label="Interests" action={() => { onClose(); router.push('/ad-interests'); }} />
            <Row label="Delete ads data" sub="Clear all ads history and interests data. This won't affect your chats." right={
              <OutlineBtn label="Delete" color="#FF3B30" onPress={() => showAlert('Delete Ads Data', 'Clear all ad history and interest data?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => {} }])} />
            } />

            <SubHeader text="Ads personalization" />
            <Row label="Personalize ads" sub="Use your ads history, interests, past and current chats, including model responses, to make the ads you see more relevant." right={
              <Switch value={personalizeAds} onValueChange={setPersonalizeAds} trackColor={{ true: switchTrackTrue, false: switchTrackFalse }} />
            } />
            <Row label="Past chats and memory" sub="Use past chats and memory to make the ads you see more relevant. Your chats and memories are never shared with advertisers." right={
              <Switch value={pastChatsAds} onValueChange={setPastChatsAds} trackColor={{ true: switchTrackTrue, false: switchTrackFalse }} />
            } />
            <Row label="Change plan to go ad-free" right={<OutlineBtn label="Change plan" onPress={() => { onClose(); router.push('/subscription'); }} />} />
          </ScrollView>
        );

      // ── DATA CONTROLS ─────────────────────────────────────────────────────
      case 'data':
        return (
          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            <SectionTitle title="Data controls" />
            <Row label="Improve the model for everyone" right={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ color: sub }}>On</Text>
                <Ionicons name="chevron-forward" size={14} color={sub} />
              </View>
            } />
            <Row label="Location" sub="Allow Dawinix to use your device's precise location when providing information." right={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ color: sub }}>On</Text>
                <Ionicons name="chevron-forward" size={14} color={sub} />
              </View>
            } />
            <Row label="Shared links" right={<OutlineBtn label="Manage" onPress={() => {}} />} />
            <Row label="Archived chats" right={<OutlineBtn label="Manage" onPress={() => { onClose(); router.push('/archived-chats'); }} />} />
            <Row label="Archive all chats" right={<OutlineBtn label="Archive all" onPress={() => showAlert('Archive All', 'Archive all your chats?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Archive all', onPress: () => {} }])} />} />
            <Row label="Delete all chats" right={<OutlineBtn label="Delete all" color="#FF3B30" onPress={() => showAlert('Delete All Chats', 'This will permanently delete all your chats.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete all', style: 'destructive', onPress: () => {} }])} />} />
            <Row label="Export data" right={<OutlineBtn label="Export" onPress={() => showAlert('Export', 'Preparing your data export. You will receive an email when ready.')} />} />
            <NavRow label="Marketing privacy" action={() => {}} />
          </ScrollView>
        );

      // ── STORAGE ───────────────────────────────────────────────────────────
      case 'storage':
        return (
          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            <SectionTitle title="Storage" />
            <View style={{ backgroundColor: isDark ? '#2C2C2E' : '#F5F5F7', borderRadius: 14, padding: 18, marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                <Text style={{ color: textC, fontSize: 15, fontWeight: '600' }}>Storage used</Text>
                <Text style={{ color: sub, fontSize: 14 }}>0.2 MB / 5 GB</Text>
              </View>
              <View style={{ height: 8, backgroundColor: isDark ? '#3A3A3C' : '#E0E0E5', borderRadius: 4, overflow: 'hidden' }}>
                <View style={{ width: '1%', height: '100%', backgroundColor: accentColor, borderRadius: 4 }} />
              </View>
            </View>
            <Row label="Conversations" right={<Text style={{ color: sub }}>0.1 MB</Text>} />
            <Row label="Uploaded files" right={<Text style={{ color: sub }}>0.1 MB</Text>} />
            <Row label="Images" right={<Text style={{ color: sub }}>0.0 MB</Text>} />
            <Row label="Voice recordings" right={<Text style={{ color: sub }}>0.0 MB</Text>} />
            <View style={{ marginTop: 20 }}>
              <OutlineBtn label="Clear uploaded files" color="#FF3B30" onPress={() => showAlert('Clear Files', 'Delete all uploaded files?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Clear', style: 'destructive', onPress: () => {} }])} />
            </View>
          </ScrollView>
        );

      // ── SECURITY ──────────────────────────────────────────────────────────
      case 'security':
        return (
          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            <SectionTitle title="Security" />

            <Row label="Password" right={<OutlineBtn label="Add" onPress={() => { onClose(); router.push('/login-password'); }} />} />
            <Row label="Security keys & passkeys" sub="Use hardware security keys or passkeys to sign in. These phishing-resistant methods provide stronger protection than passwords." right={<OutlineBtn label="Add" onPress={() => { onClose(); router.push('/passkeys'); }} />} />

            <SubHeader text="Multi-factor authentication (MFA)" />
            <Row label="Authenticator app" sub="Use one-time codes from an authenticator app." right={
              <Switch value={mfaAuthEnabled} onValueChange={(v) => { setMfaAuthEnabled(v); if (v) { onClose(); router.push('/authenticator-app'); } }} trackColor={{ true: switchTrackTrue, false: switchTrackFalse }} />
            } />
            <Row label="Text message" sub="Get 6-digit verification codes by SMS or WhatsApp based on your country code" right={
              <Switch value={mfaTextEnabled} onValueChange={(v) => { setMfaTextEnabled(v); if (v) { onClose(); router.push('/text-messages-mfa'); } }} trackColor={{ true: switchTrackTrue, false: switchTrackFalse }} />
            } />

            <Row label="Trusted Devices" sub="When you sign in on another device, it will be added here and can automatically use device prompts for signing in." right={null} />

            <SubHeader text="Advanced security" />
            <Row label="Advanced account security" sub="Adds the highest level of account security by requiring stronger sign-in methods and applying stricter protections to help prevent unauthorized access." right={<OutlineBtn label="Enroll" onPress={() => { onClose(); router.push('/security'); }} />} />
            <Row label="Log out of this device" right={<OutlineBtn label="Log out" onPress={() => { onClose(); if (onLogout) onLogout(); }} />} />
            <Row label="Log out of all devices" sub="Log out of all active sessions across all devices, including your current session. It may take up to 30 minutes for other devices to be logged out." right={<OutlineBtn label="Log out all" color="#FF3B30" onPress={() => showAlert('Log Out All', 'This will log you out of all devices.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Log out all', style: 'destructive', onPress: () => { if (onLogout) onLogout(); onClose(); } }])} />} />

            <SubHeader text="Secure sign in with Dawinix" />
            <Text style={{ color: sub, fontSize: 13, lineHeight: 18, marginBottom: 12 }}>
              Sign in to websites and apps across the internet with the trusted security of Dawinix.
            </Text>
            <View style={{ backgroundColor: isDark ? '#2C2C2E' : '#F5F5F7', borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <Text style={{ color: sub, fontSize: 14, lineHeight: 20 }}>
                You have not used Dawinix to sign into any websites or apps yet. Once you do, they will show up here.
              </Text>
            </View>

            <Row label="Enable device code authorization for Codex" sub="Use device code sign-in for headless or remote environments where the normal browser flow is not available. Exercise caution in enabling, as device codes can be phished. Never share a device code." right={
              <Switch value={deviceCodeEnabled} onValueChange={setDeviceCodeEnabled} trackColor={{ true: switchTrackTrue, false: switchTrackFalse }} />
            } />
          </ScrollView>
        );

      // ── PARENTAL CONTROLS ─────────────────────────────────────────────────
      case 'parental':
        return (
          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            <SectionTitle title="Parental controls" />
            <View style={{ alignItems: 'center', paddingVertical: 28 }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: isDark ? '#2C2C2E' : '#F0F0F5', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Ionicons name="people-outline" size={32} color={sub} />
              </View>
              <Text style={{ color: textC, fontSize: 17, fontWeight: '700', marginBottom: 8 }}>Family Safety</Text>
              <Text style={{ color: sub, fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 20, maxWidth: 320 }}>
                Monitor and manage how family members use Dawinix. Set limits and content filters for a safer experience.
              </Text>
              <TouchableOpacity style={{ backgroundColor: accentColor, borderRadius: 50, paddingHorizontal: 24, paddingVertical: 12 }} onPress={() => { onClose(); router.push('/parental-controls'); }}>
                <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '700' }}>Set up parental controls</Text>
              </TouchableOpacity>
            </View>
            <NavRow label="View family members" action={() => { onClose(); router.push('/family-member'); }} />
            <NavRow label="Content filters" action={() => { onClose(); router.push('/parental-controls'); }} />
            <NavRow label="Usage reports" action={() => { onClose(); router.push('/parental-controls'); }} />
          </ScrollView>
        );

      // ── ACCOUNT ───────────────────────────────────────────────────────────
      case 'account':
        return (
          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            <SectionTitle title="Account" />
            <Row label="Name" right={<Text style={{ color: sub, fontSize: 14 }}>{user?.email?.split('@')[0] || '—'}</Text>} />
            <Row label="Email" right={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ color: sub, fontSize: 14 }}>{user?.email || '—'}</Text>
                <Ionicons name="chevron-forward" size={14} color={sub} />
              </View>
            } />
            <Row label="Age verification" sub="To help keep Dawinix appropriate for everyone, some settings require age verification." right={
              <TouchableOpacity style={{ backgroundColor: textC, borderRadius: 50, paddingHorizontal: 14, paddingVertical: 7 }}>
                <Text style={{ color: isDark ? '#000' : '#FFF', fontSize: 13, fontWeight: '700' }}>Verify age</Text>
              </TouchableOpacity>
            } />
            <Row label="Delete account" right={<OutlineBtn label="Delete" color="#FF3B30" onPress={() => showAlert('Delete Account', 'This will permanently delete your account and all data.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => {} }])} />} />

            <SubHeader text="GPT builder profile" />
            <Text style={{ color: sub, fontSize: 13, lineHeight: 18, marginBottom: 16 }}>
              Personalize your builder profile to connect with users of your GPTs. These settings apply to publicly shared GPTs.
            </Text>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                <Ionicons name="cube-outline" size={24} color={sub} />
              </View>
              <Text style={{ color: textC, fontSize: 14, fontWeight: '600' }}>PlaceholderGPT</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <Text style={{ color: sub, fontSize: 12 }}>By community builder</Text>
                <Ionicons name="lock-closed" size={10} color={sub} />
              </View>
            </View>
            <View style={{ backgroundColor: isDark ? '#2C2C2E' : '#F0F0F5', borderRadius: 12, padding: 14, flexDirection: 'row', gap: 10 }}>
              <Ionicons name="information-circle-outline" size={18} color={sub} style={{ marginTop: 1 }} />
              <Text style={{ color: sub, fontSize: 13, flex: 1, lineHeight: 18 }}>
                Complete verification to publish GPTs to everyone. Verify your identity by adding billing details or verifying ownership of a public domain name.
              </Text>
            </View>

            <SubHeader text="Links" />
            {[{ label: 'Domain', sub: 'Select a domain' }, { label: 'LinkedIn', sub: 'Add' }, { label: 'GitHub', sub: 'Add' }].map(link => (
              <Row key={link.label} label={link.label} right={<OutlineBtn label={link.sub} onPress={() => {}} />} />
            ))}
          </ScrollView>
        );

      default:
        return (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={(SECTIONS.find(s => s.id === activeSection)?.icon as any) || 'settings-outline'} size={40} color={sub} />
            <Text style={{ color: sub, fontSize: 15, marginTop: 12 }}>
              {SECTIONS.find(s => s.id === activeSection)?.label} settings
            </Text>
            <TouchableOpacity style={[dls.outlineBtn, { borderColor: accentColor, marginTop: 20 }]} onPress={() => { onClose(); router.push('/settings'); }}>
              <Text style={{ color: accentColor, fontWeight: '600' }}>Open full settings</Text>
            </TouchableOpacity>
          </View>
        );
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[dls.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.45)' }]} onPress={onClose}>
        <Pressable style={[dls.settingsPanel, { backgroundColor: panelBg }]} onPress={() => {}}>
          {/* Header */}
          <View style={[dls.settingsPanelHeader, { borderBottomColor: borderC }]}>
            <TouchableOpacity onPress={onClose} style={dls.settingsCloseBtn}>
              <Ionicons name="close" size={18} color={textC} />
            </TouchableOpacity>
          </View>
          <View style={dls.settingsPanelBody}>
            {/* Left Nav — FIXED (not in ScrollView) */}
            <View style={[dls.settingsNav, { borderRightColor: borderC }]}>
              {SECTIONS.map(s => (
                <TouchableOpacity
                  key={s.id}
                  style={[dls.settingsNavItem, activeSection === s.id && { backgroundColor: activeNavBg, borderRadius: 10 }]}
                  onPress={() => setActiveSection(s.id)}
                  activeOpacity={0.7}
                >
                  <Ionicons name={s.icon as any} size={18} color={activeSection === s.id ? accentColor : sub} />
                  <Text style={{ color: activeSection === s.id ? textC : sub, fontSize: 14, fontWeight: activeSection === s.id ? '600' : '400', marginLeft: 10 }}>
                    {s.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {/* Content — SCROLLABLE */}
            <View style={[dls.settingsContent, { backgroundColor: bg }]}>
              {renderContent()}
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN DESKTOP LAYOUT WRAPPER
// ════════════════════════════════════════════════════════════════════════════
export function DesktopLayout({ children }: { children: React.ReactNode }) {
  const { isDark, colors } = useTheme();
  const { user, logout } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const { settings } = useSettings();
  const { tier } = useSubscription();
  const {
    conversations, currentConversation, selectConversation,
    deleteConversation, archiveConversation, updateConversationTitle,
    createConversation, messages, searchConversations,
  } = useConversation();
  const { profilePhotoUrl, displayName } = useProfile();

  const accentColor = settings.accentColor || ACCENT;
  const isDesktop = useIsDesktop();

  const [loginModalVisible, setLoginModalVisible] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [convMenuConv, setConvMenuConv] = useState<{ id: string; title: string } | null>(null);
  const [convMenuPos, setConvMenuPos] = useState({ top: 0, left: 0 });
  const [userMenuVisible, setUserMenuVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [shortcutsVisible, setShortcutsVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const bg = isDark ? '#0a0a0a' : '#FAFAFA';
  const sidebarBg = isDark ? '#111111' : '#F7F7F7';
  const sidebarBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const textC = isDark ? '#FFF' : '#000';
  const sub = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';
  const hoverBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
  const activeConvBg = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';

  const displayedConvs = searchQuery.trim() ? searchConversations(searchQuery) : conversations;
  const displayNameFinal = displayName || user?.email?.split('@')[0] || 'User';

  const handleNewChat = useCallback(async () => {
    if (!user) { setLoginModalVisible(true); return; }
    await createConversation();
  }, [user, createConversation]);

  const handleSelectConv = (id: string) => {
    if (!user) { setLoginModalVisible(true); return; }
    selectConversation(id);
  };

  const handleLogout = useCallback(() => {
    showAlert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: async () => { await logout(); setUserMenuVisible(false); } },
    ]);
  }, [showAlert, logout]);

  const handleConvAction = useCallback(async (action: string) => {
    if (!convMenuConv) return;
    if (action === 'delete') {
      showAlert('Delete Chat', 'This will permanently delete this chat.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteConversation(convMenuConv.id) },
      ]);
    } else if (action === 'archive') {
      await archiveConversation(convMenuConv.id);
    } else if (action === 'rename') {
      showAlert('Rename Chat', 'Enter a new name for this chat.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Rename', onPress: () => {} },
      ]);
    }
  }, [convMenuConv, showAlert, deleteConversation, archiveConversation]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onNewChat: handleNewChat,
    onOpenSearch: () => setSearchFocused(true),
    onOpenSettings: () => setSettingsVisible(true),
    onCloseAll: () => {
      setSettingsVisible(false);
      setLoginModalVisible(false);
      setUserMenuVisible(false);
      setShortcutsVisible(false);
    },
    onShowHelp: () => setShortcutsVisible(true),
  });

  if (!isDesktop) {
    return <>{children}</>;
  }

  // ── SLIM SIDEBAR (not logged in) ──────────────────────────────────────────
  if (!user) {
    return (
      <View style={[dls.desktopRoot, { backgroundColor: bg }]}>
        {/* Slim icon sidebar */}
        <View style={[dls.slimSidebar, { backgroundColor: sidebarBg, borderRightColor: sidebarBorder }]}>
          <View style={dls.slimLogoWrap}>
            <View style={[dls.logoCircle, { backgroundColor: accentColor }]}>
              <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 14 }}>D</Text>
            </View>
          </View>
          <View style={dls.slimIcons}>
            <TouchableOpacity style={dls.slimIconBtn} onPress={handleNewChat} activeOpacity={0.7}>
              <Ionicons name="create-outline" size={20} color={sub} />
            </TouchableOpacity>
            <TouchableOpacity style={dls.slimIconBtn} onPress={() => setLoginModalVisible(true)} activeOpacity={0.7}>
              <Ionicons name="search-outline" size={20} color={sub} />
            </TouchableOpacity>
            <TouchableOpacity style={dls.slimIconBtn} onPress={() => setLoginModalVisible(true)} activeOpacity={0.7}>
              <Ionicons name="images-outline" size={20} color={sub} />
            </TouchableOpacity>
            <TouchableOpacity style={dls.slimIconBtn} onPress={() => router.push('/app-connect')} activeOpacity={0.7}>
              <Ionicons name="grid-outline" size={20} color={sub} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={[dls.slimIconBtn, { marginBottom: 16 }]} onPress={() => setSettingsVisible(true)} activeOpacity={0.7}>
            <Ionicons name="settings-outline" size={20} color={sub} />
          </TouchableOpacity>
        </View>

        {/* Main content */}
        <View style={dls.desktopMain}>
          {/* Top bar */}
          <View style={[dls.topBar, { borderBottomColor: sidebarBorder }]}>
            <TouchableOpacity style={dls.brandRow} activeOpacity={0.8}>
              <Text style={[dls.brandText, { color: textC }]}>Dawinix</Text>
              <Ionicons name="chevron-down" size={14} color={sub} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <TouchableOpacity style={[dls.loginBtn, { backgroundColor: isDark ? '#FFF' : '#000' }]} onPress={() => setLoginModalVisible(true)}>
              <Text style={{ color: isDark ? '#000' : '#FFF', fontWeight: '700', fontSize: 14 }}>Log in</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[dls.signupBtn, { borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }]} onPress={() => setLoginModalVisible(true)}>
              <Text style={{ color: textC, fontWeight: '600', fontSize: 14 }}>Sign up for free</Text>
            </TouchableOpacity>
          </View>

          {/* Home state — no conversation */}
          {!currentConversation || (messages || []).length === 0 ? (
            <View style={dls.homeEmptyState}>
              <Text style={[dls.homeEmptyTitle, { color: textC }]}>Ready when you are.</Text>
              <View style={{ height: 24 }} />
            </View>
          ) : null}

          <View style={{ flex: 1 }}>{children}</View>

          {/* Footer */}
          <View style={{ paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center' }}>
            <Text style={{ color: sub, fontSize: 11 }}>
              By messaging Dawinix, you agree to our{' '}
              <Text style={{ color: accentColor }}>Terms</Text> and have read our{' '}
              <Text style={{ color: accentColor }}>Privacy Policy</Text>. See{' '}
              <Text style={{ color: accentColor }}>Your privacy choices</Text>.
            </Text>
          </View>
        </View>

        <DesktopLoginModal visible={loginModalVisible} onClose={() => setLoginModalVisible(false)} onSuccess={() => setLoginModalVisible(false)} />
        <DesktopSettingsPanel visible={settingsVisible} onClose={() => setSettingsVisible(false)} isDark={isDark} user={user} tier={tier} onLogout={handleLogout} />
        <KeyboardShortcutsModal visible={shortcutsVisible} onClose={() => setShortcutsVisible(false)} isDark={isDark} />
      </View>
    );
  }

  // ── FULL SIDEBAR (logged in) ──────────────────────────────────────────────
  return (
    <View style={[dls.desktopRoot, { backgroundColor: bg }]}>
      {/* Full sidebar — FIXED, does not scroll with content */}
      {sidebarExpanded && (
        <View style={[dls.fullSidebar, { backgroundColor: sidebarBg, borderRightColor: sidebarBorder }]}>
          {/* Sidebar header */}
          <View style={dls.sidebarHeader}>
            <View style={[dls.logoCircle, { backgroundColor: accentColor }]}>
              <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 14 }}>D</Text>
            </View>
            <TouchableOpacity style={dls.sidebarIconBtn} onPress={() => setSidebarExpanded(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="reorder-three-outline" size={20} color={sub} />
            </TouchableOpacity>
          </View>

          {/* New chat */}
          <TouchableOpacity style={[dls.newChatBtn, { borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#E0E0E5' }]} onPress={handleNewChat} activeOpacity={0.8}>
            <Ionicons name="create-outline" size={17} color={textC} />
            <Text style={{ color: textC, fontSize: 15, fontWeight: '500', marginLeft: 8 }}>New chat</Text>
          </TouchableOpacity>

          {/* Search */}
          <View style={[dls.sidebarSearch, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E0E0E5' }]}>
            <Ionicons name="search-outline" size={15} color={sub} />
            <TextInput
              style={{ flex: 1, color: textC, fontSize: 14, marginLeft: 8, paddingVertical: 0 }}
              placeholder="Search chats"
              placeholderTextColor={sub}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus={searchFocused}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
          </View>

          {/* Nav items */}
          {[
            { icon: 'images-outline', label: 'Images', action: () => router.push('/images') },
            { icon: 'folder-outline', label: 'Projects', action: () => router.push('/project-get') },
            { icon: 'grid-outline', label: 'Apps', action: () => router.push('/app-connect') },
          ].map(item => (
            <TouchableOpacity key={item.label} style={dls.sidebarNavItem} onPress={item.action} activeOpacity={0.7}>
              <Ionicons name={item.icon as any} size={18} color={sub} />
              <Text style={{ color: sub, fontSize: 15, marginLeft: 10 }}>{item.label}</Text>
            </TouchableOpacity>
          ))}

          <View style={[dls.sidebarDivider, { backgroundColor: sidebarBorder }]} />

          {/* Recents label */}
          <Text style={[dls.sidebarSectionLabel, { color: sub }]}>Recents</Text>

          {/* Conversations list — scrollable WITHIN sidebar */}
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            {displayedConvs.length === 0 && (
              <Text style={{ color: sub, fontSize: 14, textAlign: 'center', marginTop: 20 }}>No conversations yet</Text>
            )}
            {displayedConvs.slice(0, 60).map(conv => {
              const isActive = currentConversation?.id === conv.id;
              return (
                <TouchableOpacity
                  key={conv.id}
                  style={[dls.convRow, isActive && { backgroundColor: activeConvBg, borderRadius: 10 }]}
                  onPress={() => handleSelectConv(conv.id)}
                  activeOpacity={0.7}
                >
                  <Text style={{ color: isActive ? textC : sub, fontSize: 14, flex: 1, fontWeight: isActive ? '500' : '400' }} numberOfLines={1}>
                    {conv.title || 'New conversation'}
                  </Text>
                  <TouchableOpacity
                    style={dls.convDotBtn}
                    onPress={(e) => {
                      const pageX = (e.nativeEvent as any).pageX ?? 260;
                      const pageY = (e.nativeEvent as any).pageY ?? 100;
                      setConvMenuConv(conv);
                      setConvMenuPos({ top: pageY, left: Math.min(pageX, Dimensions.get('window').width - 220) });
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="ellipsis-horizontal" size={15} color={sub} />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
            <View style={{ height: 80 }} />
          </ScrollView>

          {/* Bottom items */}
          {tier === 'free' && (
            <TouchableOpacity style={[dls.sidebarUpgradeBtn, { borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#E0E0E5' }]} onPress={() => router.push('/subscription')}>
              <Ionicons name="arrow-up-circle-outline" size={16} color={sub} />
              <Text style={{ color: sub, fontSize: 14, marginLeft: 8 }}>See plans and pricing</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[dls.sidebarSettingsBtn, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E0E0E5' }]} onPress={() => setSettingsVisible(true)}>
            <Ionicons name="settings-outline" size={16} color={sub} />
            <Text style={{ color: sub, fontSize: 14, marginLeft: 8 }}>Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity style={dls.sidebarSettingsBtn} onPress={() => router.push('/bugreport')}>
            <Ionicons name="help-circle-outline" size={16} color={sub} />
            <Text style={{ color: sub, fontSize: 14, marginLeft: 8 }}>Help</Text>
          </TouchableOpacity>

          {/* Keyboard shortcut hint */}
          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 }} onPress={() => setShortcutsVisible(true)}>
            <Ionicons name="keyboard-outline" size={14} color={sub} />
            <Text style={{ color: sub, fontSize: 12, marginLeft: 6 }}>Keyboard shortcuts</Text>
          </TouchableOpacity>

          <View style={[dls.sidebarDivider, { backgroundColor: sidebarBorder }]} />

          {/* User row at bottom */}
          <TouchableOpacity style={dls.sidebarUserRow} onPress={() => setUserMenuVisible(true)} activeOpacity={0.8}>
            {profilePhotoUrl ? (
              <Image source={{ uri: profilePhotoUrl }} style={{ width: 36, height: 36, borderRadius: 18 }} contentFit="cover" />
            ) : (
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: accentColor, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 14 }}>{(displayNameFinal[0] || 'U').toUpperCase()}</Text>
              </View>
            )}
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={{ color: textC, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>{displayNameFinal}</Text>
              <Text style={{ color: sub, fontSize: 12 }}>{tier === 'plus' ? 'Plus' : tier === 'go' ? 'Go' : 'Free'}</Text>
            </View>
            {tier === 'free' && (
              <TouchableOpacity style={[dls.upgradeSmall, { borderColor: isDark ? 'rgba(255,255,255,0.15)' : '#D0D0D5' }]} onPress={() => router.push('/subscription')}>
                <Text style={{ color: sub, fontSize: 12, fontWeight: '600' }}>Upgrade</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Collapsed sidebar toggle */}
      {!sidebarExpanded && (
        <View style={[dls.slimSidebar, { backgroundColor: sidebarBg, borderRightColor: sidebarBorder }]}>
          <View style={dls.slimLogoWrap}>
            <View style={[dls.logoCircle, { backgroundColor: accentColor }]}>
              <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 14 }}>D</Text>
            </View>
          </View>
          <TouchableOpacity style={dls.slimIconBtn} onPress={() => setSidebarExpanded(true)} activeOpacity={0.7}>
            <Ionicons name="reorder-three-outline" size={20} color={sub} />
          </TouchableOpacity>
          <TouchableOpacity style={dls.slimIconBtn} onPress={handleNewChat} activeOpacity={0.7}>
            <Ionicons name="create-outline" size={20} color={sub} />
          </TouchableOpacity>
          <TouchableOpacity style={dls.slimIconBtn} onPress={() => setSettingsVisible(true)} activeOpacity={0.7}>
            <Ionicons name="settings-outline" size={20} color={sub} />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={[dls.slimIconBtn, { marginBottom: 16 }]} onPress={() => setUserMenuVisible(true)}>
            {profilePhotoUrl ? (
              <Image source={{ uri: profilePhotoUrl }} style={{ width: 28, height: 28, borderRadius: 14 }} contentFit="cover" />
            ) : (
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: accentColor, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 12 }}>{(displayNameFinal[0] || 'U').toUpperCase()}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Main content — RIGHT SIDE SCROLLABLE via children */}
      <View style={dls.desktopMain}>
        {/* Top bar */}
        <View style={[dls.topBar, { borderBottomColor: sidebarBorder }]}>
          <TouchableOpacity style={dls.brandRow} activeOpacity={0.8}>
            <Text style={[dls.brandText, { color: textC }]}>Dawinix</Text>
            <Ionicons name="chevron-down" size={14} color={sub} style={{ marginLeft: 4 }} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            {tier !== 'plus' && (
              <TouchableOpacity style={[dls.upgradeTopBtn, { borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }]} onPress={() => router.push('/subscription')}>
                <Ionicons name="sparkles" size={14} color={accentColor} />
                <Text style={{ color: accentColor, fontSize: 14, fontWeight: '600', marginLeft: 5 }}>Upgrade</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity style={dls.sidebarIconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="radio-button-off-outline" size={20} color={sub} />
          </TouchableOpacity>
        </View>

        {/* Home empty state — "Ready when you are." */}
        {!currentConversation || (messages || []).length === 0 ? (
          <View style={[dls.homeEmptyState, { pointerEvents: 'none' } as any]}>
            <Text style={[dls.homeEmptyTitle, { color: textC }]}>Ready when you are.</Text>
          </View>
        ) : null}

        {/* Chat content */}
        <View style={{ flex: 1 }}>{children}</View>

        {/* Footer with keyboard shortcuts link */}
        <View style={{ paddingVertical: 8, paddingHorizontal: 16, alignItems: 'center' }}>
          <Text style={{ color: sub, fontSize: 11 }}>
            Dawinix can make mistakes. Consider checking important information.{' '}
            <Text style={{ color: accentColor }} onPress={() => setShortcutsVisible(true)}>Keyboard shortcuts</Text>
          </Text>
        </View>
      </View>

      {/* Modals */}
      {convMenuConv && (
        <ConvContextMenu
          conv={convMenuConv}
          position={convMenuPos}
          onClose={() => setConvMenuConv(null)}
          onAction={(action) => { setConvMenuConv(null); handleConvAction(action); }}
          isDark={isDark}
        />
      )}
      <UserBottomMenu
        visible={userMenuVisible}
        onClose={() => setUserMenuVisible(false)}
        user={user}
        isDark={isDark}
        onLogout={handleLogout}
        profilePhotoUrl={profilePhotoUrl}
        displayName={displayNameFinal}
        tier={tier}
        router={router}
      />
      <DesktopSettingsPanel visible={settingsVisible} onClose={() => setSettingsVisible(false)} isDark={isDark} user={user} tier={tier} onLogout={handleLogout} />
      <DesktopLoginModal visible={loginModalVisible} onClose={() => setLoginModalVisible(false)} onSuccess={() => setLoginModalVisible(false)} />
      <KeyboardShortcutsModal visible={shortcutsVisible} onClose={() => setShortcutsVisible(false)} isDark={isDark} />
    </View>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// STYLES
// ════════════════════════════════════════════════════════════════════════════
const dls = StyleSheet.create({
  desktopRoot: { flex: 1, flexDirection: 'row' },
  desktopMain: { flex: 1, flexDirection: 'column' },

  // Home empty state
  homeEmptyState: {
    position: 'absolute',
    top: 52, left: 0, right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    zIndex: 0,
  },
  homeEmptyTitle: {
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: -0.3,
  },

  // Slim sidebar
  slimSidebar: {
    width: 48,
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: 12,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  slimLogoWrap: { marginBottom: 12, marginTop: 4 },
  slimIcons: { flex: 1, alignItems: 'center', gap: 4 },
  slimIconBtn: {
    width: 36, height: 36, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },

  // Full sidebar
  fullSidebar: {
    width: 260,
    flexDirection: 'column',
    paddingTop: 12,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 12,
    gap: 8,
  },
  logoCircle: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sidebarIconBtn: { width: 32, height: 32, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  newChatBtn: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 12, marginBottom: 8,
    paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: 10, borderWidth: StyleSheet.hairlineWidth,
  },
  sidebarSearch: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 12, marginBottom: 8,
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 8, borderWidth: StyleSheet.hairlineWidth,
  },
  sidebarNavItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 9,
  },
  sidebarDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: 12, marginVertical: 6 },
  sidebarSectionLabel: { fontSize: 12, fontWeight: '600', paddingHorizontal: 16, marginBottom: 4, textTransform: 'uppercase' },
  convRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 8,
    marginHorizontal: 4, gap: 4,
  },
  convDotBtn: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 4 },
  sidebarUpgradeBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    marginHorizontal: 8, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, marginBottom: 4,
  },
  sidebarSettingsBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  sidebarUserRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8,
  },
  upgradeSmall: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },

  // Top bar
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    height: 52,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  brandText: { fontSize: 16, fontWeight: '700' },
  loginBtn: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 7, marginRight: 8 },
  signupBtn: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  upgradeTopBtn: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6,
  },

  // Login modal
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loginCard: {
    width: 440, maxWidth: '90%', borderRadius: 20,
    padding: 36, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3, shadowRadius: 40, elevation: 40,
  },
  closeBtn: { position: 'absolute', top: 14, right: 14, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  loginTitle: { fontSize: 24, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  loginSub: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 28, paddingHorizontal: 8 },
  socialBtn: {
    width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderRadius: 50, paddingVertical: 13, marginBottom: 10, gap: 10,
  },
  socialBtnText: { fontSize: 15, fontWeight: '500' },
  orRow: { flexDirection: 'row', alignItems: 'center', width: '100%', marginVertical: 14, gap: 10 },
  orLine: { flex: 1, height: 1 },
  orText: { fontSize: 14 },
  inputRow: {
    width: '100%', flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: 50, paddingHorizontal: 18, paddingVertical: 12,
  },
  input: { flex: 1, fontSize: 15, paddingVertical: 0 },
  primaryBtn: {
    width: '100%', backgroundColor: '#000', borderRadius: 50,
    paddingVertical: 14, alignItems: 'center', marginTop: 4,
  },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  // Keyboard shortcuts modal
  shortcutsCard: {
    width: 420, maxWidth: '90%', borderRadius: 18,
    padding: 28,
    shadowColor: '#000', shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.25, shadowRadius: 32, elevation: 32,
  },
  shortcutRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12,
  },
  keyChip: {
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
    minWidth: 32, alignItems: 'center',
  },

  // Conv context menu
  convMenu: {
    position: 'absolute', width: 210, borderRadius: 14, overflow: 'hidden',
    zIndex: 9999,
  },
  convMenuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  convMenuText: { fontSize: 15 },

  // User bottom menu
  userMenu: {
    position: 'absolute', bottom: 60, left: 12, width: 280,
    borderRadius: 16, overflow: 'hidden', zIndex: 9999,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 20, elevation: 20,
  },
  userMenuHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  upgradeChip: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },

  // Desktop settings panel
  settingsPanel: {
    width: 760, maxWidth: '94%', height: 580, maxHeight: '90%',
    borderRadius: 20, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.28, shadowRadius: 40, elevation: 40,
  },
  settingsPanelHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    height: 48,
  },
  settingsCloseBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  settingsPanelBody: { flex: 1, flexDirection: 'row', overflow: 'hidden' },
  settingsNav: {
    width: 200, borderRightWidth: StyleSheet.hairlineWidth,
    paddingTop: 12, paddingHorizontal: 8,
    // Fixed — no flex: 1, no overflow: scroll
  },
  settingsNavItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, marginBottom: 2 },
  settingsContent: { flex: 1, padding: 24, overflow: 'hidden' },
  settingsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, gap: 16,
  },
  outlineBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  appearanceChip: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  mfaBanner: {
    borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 16,
  },
  mfaBtn: { marginTop: 12, borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, alignSelf: 'flex-start' },
});
in desktop version add account delete function real if you delete the account eben if you in movile its must delete and add paswword change and all function in home page must match in desktop function connect them create real call chat edg function in desktop.
