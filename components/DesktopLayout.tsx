/**
 * DesktopLayout.tsx
 * ChatGPT-style desktop layout for web (≥1024px)
 * Includes: slim icon sidebar (logged out) / full sidebar (logged in),
 * login modal, conversation context menu, user menu, desktop settings panel.
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
// LOGIN MODAL (desktop overlay)
// ════════════════════════════════════════════════════════════════════════════
function DesktopLoginModal({ visible, onClose, onSuccess }: {
  visible: boolean; onClose: () => void; onSuccess: () => void;
}) {
  const { sendOTP, verifyOTPAndLogin, signInWithPassword, signUpWithPassword, signInWithGoogle, operationLoading } = useAuth();
  const { showAlert } = useAlert();
  const { isDark } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'main' | 'otp' | 'password'>('main');
  const [isLogin, setIsLogin] = useState(true);
  const [showNumber, setShowNumber] = useState(false);
  const [phone, setPhone] = useState('');

  const bg = isDark ? '#1e1e1e' : '#FFFFFF';
  const overlay = isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.4)';
  const textC = isDark ? '#FFF' : '#000';
  const sub = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)';
  const borderC = isDark ? 'rgba(255,255,255,0.15)' : '#D1D1D6';
  const inputBg = isDark ? 'rgba(255,255,255,0.07)' : '#F5F5F7';

  const reset = () => { setEmail(''); setPassword(''); setOtp(''); setStep('main'); setShowNumber(false); setPhone(''); };

  const handleSendOTP = async () => {
    if (!email.trim()) { showAlert('Error', 'Please enter your email'); return; }
    const { error } = await sendOTP(email.trim());
    if (error) { showAlert('Error', error); return; }
    setStep('otp');
  };

  const handleVerifyOTP = async () => {
    const { error } = await verifyOTPAndLogin(email.trim(), otp.trim());
    if (error) { showAlert('Error', error); return; }
    reset(); onSuccess();
  };

  const handleContinue = async () => {
    if (!email.trim()) { showAlert('Error', 'Please enter your email'); return; }
    await handleSendOTP();
  };

  const handleGoogle = async () => {
    const { error } = await signInWithGoogle();
    if (error) showAlert('Error', error);
    else { reset(); onSuccess(); }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[dls.modalOverlay, { backgroundColor: overlay }]} onPress={onClose}>
        <Pressable style={[dls.loginCard, { backgroundColor: bg }]} onPress={() => {}}>
          {/* Close */}
          <TouchableOpacity style={dls.closeBtn} onPress={() => { reset(); onClose(); }}>
            <Ionicons name="close" size={20} color={sub} />
          </TouchableOpacity>

          <Text style={[dls.loginTitle, { color: textC }]}>Log in or sign up</Text>
          <Text style={[dls.loginSub, { color: sub }]}>
            {"You'll get smarter responses and can upload files, images, and more."}
          </Text>

          {step === 'main' && (
            <>
              {/* Google */}
              <TouchableOpacity style={[dls.socialBtn, { borderColor: borderC }]} onPress={handleGoogle} activeOpacity={0.8} disabled={operationLoading}>
                <Ionicons name="logo-google" size={18} color={textC} />
                <Text style={[dls.socialBtnText, { color: textC }]}>Continue with Google</Text>
              </TouchableOpacity>

              {/* Phone / Number toggle */}
              {showNumber ? (
                <View style={{ width: '100%', marginBottom: 10 }}>
                  <View style={[dls.inputRow, { backgroundColor: inputBg, borderColor: borderC }]}>
                    <Ionicons name="call-outline" size={17} color={sub} style={{ marginRight: 8 }} />
                    <TextInput
                      style={[dls.input, { color: textC }]}
                      placeholder="+1 (555) 000-0000"
                      placeholderTextColor={sub}
                      value={phone}
                      onChangeText={setPhone}
                      keyboardType="phone-pad"
                    />
                  </View>
                  <TouchableOpacity style={{ alignItems: 'center', marginTop: 6 }} onPress={() => setShowNumber(false)}>
                    <Text style={{ color: ACCENT, fontSize: 13 }}>Use email instead</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={[dls.socialBtn, { borderColor: borderC }]} onPress={() => setShowNumber(true)} activeOpacity={0.8}>
                  <Ionicons name="call-outline" size={18} color={textC} />
                  <Text style={[dls.socialBtnText, { color: textC }]}>Continue with phone</Text>
                </TouchableOpacity>
              )}

              <View style={dls.orRow}>
                <View style={[dls.orLine, { backgroundColor: borderC }]} />
                <Text style={[dls.orText, { color: sub }]}>OR</Text>
                <View style={[dls.orLine, { backgroundColor: borderC }]} />
              </View>

              {/* Email input */}
              <View style={[dls.inputRow, { backgroundColor: inputBg, borderColor: borderC, marginBottom: 12 }]}>
                <TextInput
                  style={[dls.input, { color: textC, flex: 1 }]}
                  placeholder="Email address"
                  placeholderTextColor={sub}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <TouchableOpacity
                style={[dls.primaryBtn, { opacity: operationLoading ? 0.7 : 1 }]}
                onPress={handleContinue}
                disabled={operationLoading}
              >
                {operationLoading ? <ActivityIndicator color="#FFF" /> : <Text style={dls.primaryBtnText}>Continue</Text>}
              </TouchableOpacity>
            </>
          )}

          {step === 'otp' && (
            <>
              <Text style={[{ color: sub, fontSize: 14, marginBottom: 16, textAlign: 'center' }]}>
                We sent a code to {email}
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
                />
              </View>
              <TouchableOpacity
                style={[dls.primaryBtn, { opacity: operationLoading ? 0.7 : 1 }]}
                onPress={handleVerifyOTP}
                disabled={operationLoading}
              >
                {operationLoading ? <ActivityIndicator color="#FFF" /> : <Text style={dls.primaryBtnText}>Verify</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={{ marginTop: 12, alignItems: 'center' }} onPress={() => setStep('main')}>
                <Text style={{ color: ACCENT, fontSize: 14 }}>Back</Text>
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
    { icon: 'help-circle-outline', label: 'Help', action: () => {} },
    { icon: 'log-out-outline', label: 'Log out', action: onLogout, destructive: true },
  ];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1 }} onPress={onClose}>
        <View style={[dls.userMenu, { backgroundColor: bg, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 16 }]}>
          {/* User header */}
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
          {/* Menu items */}
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
// DESKTOP SETTINGS PANEL (photo 6 style — left nav + content)
// ════════════════════════════════════════════════════════════════════════════
function DesktopSettingsPanel({ visible, onClose, isDark }: {
  visible: boolean; onClose: () => void; isDark: boolean;
}) {
  const { settings, updateSetting } = useSettings();
  const { user, logout } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();

  const bg = isDark ? '#1C1C1E' : '#FFFFFF';
  const overlayBg = 'rgba(0,0,0,0.45)';
  const textC = isDark ? '#FFF' : '#000';
  const sub = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)';
  const borderC = isDark ? 'rgba(255,255,255,0.1)' : '#E5E5EA';
  const activeNavBg = isDark ? 'rgba(255,255,255,0.1)' : '#F0F0F5';
  const inputBg = isDark ? 'rgba(255,255,255,0.07)' : '#F5F5F7';
  const switchTrackTrue = '#34C759';
  const switchTrackFalse = isDark ? '#3A3A3C' : '#E5E5EA';

  const [activeSection, setActiveSection] = useState('general');

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

  const Row = ({ label, right }: { label: string; right: React.ReactNode }) => (
    <View style={[dls.settingsRow, { borderBottomColor: borderC }]}>
      <Text style={{ color: textC, fontSize: 15 }}>{label}</Text>
      <View>{right}</View>
    </View>
  );

  const renderContent = () => {
    switch (activeSection) {
      case 'general':
        return (
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* MFA Banner */}
            <View style={[dls.mfaBanner, { backgroundColor: isDark ? '#2C2C2E' : '#F5F5F7', borderColor: borderC }]}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14, flex: 1 }}>
                <Ionicons name="shield-checkmark-outline" size={28} color={textC} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: textC, fontSize: 16, fontWeight: '700', marginBottom: 4 }}>Secure your account</Text>
                  <Text style={{ color: sub, fontSize: 14, lineHeight: 20 }}>
                    Add multi-factor authentication (MFA), like a text message or authenticator app, to help protect your account when logging in.
                  </Text>
                  <TouchableOpacity
                    style={[dls.mfaBtn, { borderColor: borderC }]}
                    onPress={() => { onClose(); router.push('/authenticator-app'); }}
                  >
                    <Text style={{ color: textC, fontSize: 14, fontWeight: '600' }}>Set up MFA</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <Row label="App updates" right={
              <TouchableOpacity style={[dls.outlineBtn, { borderColor: borderC }]}>
                <Text style={{ color: textC, fontSize: 14 }}>Check for updates</Text>
              </TouchableOpacity>
            } />
            <Row label="Launch at Login" right={<Text style={{ color: sub }}>On ↗</Text>} />
            <Row label="Appearance" right={
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {['System', 'Light', 'Dark'].map(opt => (
                  <TouchableOpacity
                    key={opt}
                    style={[dls.appearanceChip, {
                      backgroundColor: settings.appearance === opt ? ACCENT : (isDark ? 'rgba(255,255,255,0.1)' : '#EBEBF0'),
                    }]}
                    onPress={() => updateSetting('appearance', opt)}
                  >
                    <Text style={{ color: settings.appearance === opt ? '#FFF' : textC, fontSize: 13, fontWeight: '500' }}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            } />
            <Row label="Accent color" right={
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {ACCENT_COLORS.map(c => (
                  <TouchableOpacity
                    key={c.hex}
                    onPress={() => updateSetting('accentColor', c.hex)}
                    style={[{
                      width: 22, height: 22, borderRadius: 11, backgroundColor: c.hex,
                      borderWidth: (settings.accentColor || '#10A37F') === c.hex ? 3 : 0,
                      borderColor: isDark ? '#FFF' : '#000',
                    }]}
                  />
                ))}
              </View>
            } />
            <Row label="Haptic feedback" right={
              <Switch
                value={settings.hapticFeedback}
                onValueChange={v => updateSetting('hapticFeedback', v)}
                trackColor={{ true: switchTrackTrue, false: switchTrackFalse }}
              />
            } />
            <Row label="Auto spelling correction" right={
              <Switch
                value={settings.autoSpelling}
                onValueChange={v => updateSetting('autoSpelling', v)}
                trackColor={{ true: switchTrackTrue, false: switchTrackFalse }}
              />
            } />
            <Row label="Autocomplete" right={
              <Switch
                value={settings.autocomplete}
                onValueChange={v => updateSetting('autocomplete', v)}
                trackColor={{ true: switchTrackTrue, false: switchTrackFalse }}
              />
            } />
            <Row label="Trending searches" right={
              <Switch
                value={settings.trendingSearches}
                onValueChange={v => updateSetting('trendingSearches', v)}
                trackColor={{ true: switchTrackTrue, false: switchTrackFalse }}
              />
            } />
            <Row label="Follow-up suggestions" right={
              <Switch
                value={settings.followupSuggestions !== false}
                onValueChange={v => updateSetting('followupSuggestions', v)}
                trackColor={{ true: switchTrackTrue, false: switchTrackFalse }}
              />
            } />
          </ScrollView>
        );
      case 'account':
        return (
          <ScrollView showsVerticalScrollIndicator={false}>
            <Row label="Email" right={<Text style={{ color: sub, fontSize: 14 }}>{user?.email || '—'}</Text>} />
            <Row label="Username" right={<Text style={{ color: sub, fontSize: 14 }}>{user?.email?.split('@')[0] || '—'}</Text>} />
            <Row label="Delete account" right={
              <TouchableOpacity style={[dls.outlineBtn, { borderColor: '#FF3B30' }]}>
                <Text style={{ color: '#FF3B30', fontSize: 14 }}>Delete</Text>
              </TouchableOpacity>
            } />
          </ScrollView>
        );
      default:
        return (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={(SECTIONS.find(s => s.id === activeSection)?.icon as any) || 'settings-outline'} size={40} color={sub} />
            <Text style={{ color: sub, fontSize: 15, marginTop: 12 }}>
              {SECTIONS.find(s => s.id === activeSection)?.label} settings
            </Text>
            <TouchableOpacity
              style={[dls.outlineBtn, { borderColor: ACCENT, marginTop: 20 }]}
              onPress={() => { onClose(); router.push('/settings'); }}
            >
              <Text style={{ color: ACCENT, fontWeight: '600' }}>Open in full settings</Text>
            </TouchableOpacity>
          </View>
        );
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[dls.modalOverlay, { backgroundColor: overlayBg }]} onPress={onClose}>
        <Pressable style={[dls.settingsPanel, { backgroundColor: isDark ? '#111' : '#F5F5F7' }]} onPress={() => {}}>
          {/* Header */}
          <View style={[dls.settingsPanelHeader, { borderBottomColor: borderC }]}>
            <TouchableOpacity onPress={onClose} style={dls.settingsCloseBtn}>
              <Ionicons name="close" size={18} color={textC} />
            </TouchableOpacity>
          </View>
          <View style={dls.settingsPanelBody}>
            {/* Left Nav */}
            <View style={[dls.settingsNav, { borderRightColor: borderC }]}>
              {SECTIONS.map(s => (
                <TouchableOpacity
                  key={s.id}
                  style={[dls.settingsNavItem, activeSection === s.id && { backgroundColor: activeNavBg, borderRadius: 10 }]}
                  onPress={() => setActiveSection(s.id)}
                  activeOpacity={0.7}
                >
                  <Ionicons name={s.icon as any} size={18} color={activeSection === s.id ? ACCENT : sub} />
                  <Text style={{ color: activeSection === s.id ? textC : sub, fontSize: 14, fontWeight: activeSection === s.id ? '600' : '400', marginLeft: 10 }}>
                    {s.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {/* Content */}
            <View style={[dls.settingsContent, { backgroundColor: bg }]}>
              <Text style={[dls.settingsSectionTitle, { color: textC, borderBottomColor: borderC }]}>
                {SECTIONS.find(s => s.id === activeSection)?.label}
              </Text>
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
  const supabase = getSupabaseClient();

  const accentColor = settings.accentColor || ACCENT;
  const isDesktop = useIsDesktop();

  const [loginModalVisible, setLoginModalVisible] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [convMenuConv, setConvMenuConv] = useState<{ id: string; title: string } | null>(null);
  const [convMenuPos, setConvMenuPos] = useState({ top: 0, left: 0 });
  const [userMenuVisible, setUserMenuVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const bg = isDark ? '#0a0a0a' : '#FAFAFA';
  const sidebarBg = isDark ? '#111111' : '#F7F7F7';
  const sidebarBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const textC = isDark ? '#FFF' : '#000';
  const sub = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';
  const hoverBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
  const activeConvBg = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';

  const displayedConvs = searchQuery.trim() ? searchConversations(searchQuery) : conversations;
  const displayNameFinal = displayName || user?.email?.split('@')[0] || 'User';

  const handleNewChat = async () => {
    if (!user) { setLoginModalVisible(true); return; }
    await createConversation();
  };

  const handleSelectConv = (id: string) => {
    if (!user) { setLoginModalVisible(true); return; }
    selectConversation(id);
  };

  const handleLogout = () => {
    showAlert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: async () => { await logout(); setUserMenuVisible(false); } },
    ]);
  };

  const handleConvAction = async (action: string) => {
    if (!convMenuConv) return;
    if (action === 'delete') {
      showAlert('Delete Chat', 'This will permanently delete this chat.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteConversation(convMenuConv.id) },
      ]);
    } else if (action === 'archive') {
      await archiveConversation(convMenuConv.id);
    } else if (action === 'rename') {
      showAlert('Rename Chat', '', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Rename', onPress: () => {} },
      ]);
    }
  };

  if (!isDesktop) {
    return <>{children}</>;
  }

  // ── SLIM SIDEBAR (not logged in) ──────────────────────────────────────────
  if (!user) {
    return (
      <View style={[dls.desktopRoot, { backgroundColor: bg }]}>
        {/* Slim icon sidebar */}
        <View style={[dls.slimSidebar, { backgroundColor: sidebarBg, borderRightColor: sidebarBorder }]}>
          {/* Logo */}
          <View style={dls.slimLogoWrap}>
            <View style={[dls.logoCircle, { backgroundColor: accentColor }]}>
              <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 14 }}>D</Text>
            </View>
          </View>
          {/* Icon buttons */}
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
          {/* Bottom settings icon */}
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
            <TouchableOpacity
              style={[dls.loginBtn, { backgroundColor: isDark ? '#FFF' : '#000' }]}
              onPress={() => setLoginModalVisible(true)}
            >
              <Text style={{ color: isDark ? '#000' : '#FFF', fontWeight: '700', fontSize: 14 }}>Log in</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[dls.signupBtn, { borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }]}
              onPress={() => setLoginModalVisible(true)}
            >
              <Text style={{ color: textC, fontWeight: '600', fontSize: 14 }}>Sign up for free</Text>
            </TouchableOpacity>
          </View>
          {/* Chat area */}
          <View style={{ flex: 1 }}>{children}</View>
        </View>

        <DesktopLoginModal
          visible={loginModalVisible}
          onClose={() => setLoginModalVisible(false)}
          onSuccess={() => setLoginModalVisible(false)}
        />
        <DesktopSettingsPanel visible={settingsVisible} onClose={() => setSettingsVisible(false)} isDark={isDark} />
      </View>
    );
  }

  // ── FULL SIDEBAR (logged in) ──────────────────────────────────────────────
  return (
    <View style={[dls.desktopRoot, { backgroundColor: bg }]}>
      {/* Full sidebar */}
      {sidebarExpanded && (
        <View style={[dls.fullSidebar, { backgroundColor: sidebarBg, borderRightColor: sidebarBorder }]}>
          {/* Sidebar header */}
          <View style={dls.sidebarHeader}>
            <View style={[dls.logoCircle, { backgroundColor: accentColor }]}>
              <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 14 }}>D</Text>
            </View>
            <TouchableOpacity
              style={[dls.sidebarIconBtn]}
              onPress={() => setSidebarExpanded(false)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
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

          {/* GPTs / Recents label */}
          <Text style={[dls.sidebarSectionLabel, { color: sub }]}>Recents</Text>

          {/* Conversations list */}
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
                  {/* … button */}
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

          {/* Upgrade + Settings */}
          {tier === 'free' && (
            <TouchableOpacity
              style={[dls.sidebarUpgradeBtn, { borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#E0E0E5' }]}
              onPress={() => router.push('/subscription')}
            >
              <Ionicons name="arrow-up-circle-outline" size={16} color={sub} />
              <Text style={{ color: sub, fontSize: 14, marginLeft: 8 }}>See plans and pricing</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[dls.sidebarSettingsBtn, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E0E0E5' }]}
            onPress={() => router.push('/settings')}
          >
            <Ionicons name="settings-outline" size={16} color={sub} />
            <Text style={{ color: sub, fontSize: 14, marginLeft: 8 }}>Settings</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={dls.sidebarSettingsBtn}
            onPress={() => router.push('/bugreport')}
          >
            <Ionicons name="help-circle-outline" size={16} color={sub} />
            <Text style={{ color: sub, fontSize: 14, marginLeft: 8 }}>Help</Text>
          </TouchableOpacity>

          <View style={[dls.sidebarDivider, { backgroundColor: sidebarBorder }]} />

          {/* User row at bottom */}
          <TouchableOpacity
            style={dls.sidebarUserRow}
            onPress={() => setUserMenuVisible(true)}
            activeOpacity={0.8}
          >
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
              <TouchableOpacity
                style={[dls.upgradeSmall, { borderColor: isDark ? 'rgba(255,255,255,0.15)' : '#D0D0D5' }]}
                onPress={() => router.push('/subscription')}
              >
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

      {/* Main content */}
      <View style={dls.desktopMain}>
        {/* Top bar */}
        <View style={[dls.topBar, { borderBottomColor: sidebarBorder }]}>
          <TouchableOpacity style={dls.brandRow} activeOpacity={0.8}>
            <Text style={[dls.brandText, { color: textC }]}>Dawinix</Text>
            <Ionicons name="chevron-down" size={14} color={sub} style={{ marginLeft: 4 }} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            {tier !== 'plus' && (
              <TouchableOpacity
                style={[dls.upgradeTopBtn, { borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }]}
                onPress={() => router.push('/subscription')}
              >
                <Ionicons name="sparkles" size={14} color={accentColor} />
                <Text style={{ color: accentColor, fontSize: 14, fontWeight: '600', marginLeft: 5 }}>Upgrade</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity style={dls.sidebarIconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="radio-button-off-outline" size={20} color={sub} />
          </TouchableOpacity>
        </View>
        {/* Chat content */}
        <View style={{ flex: 1 }}>{children}</View>
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
      <DesktopSettingsPanel visible={settingsVisible} onClose={() => setSettingsVisible(false)} isDark={isDark} />
      <DesktopLoginModal
        visible={loginModalVisible}
        onClose={() => setLoginModalVisible(false)}
        onSuccess={() => setLoginModalVisible(false)}
      />
    </View>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// STYLES
// ════════════════════════════════════════════════════════════════════════════
const dls = StyleSheet.create({
  desktopRoot: { flex: 1, flexDirection: 'row' },
  desktopMain: { flex: 1, flexDirection: 'column' },

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
    width: 740, maxWidth: '92%', height: 560, maxHeight: '88%',
    borderRadius: 20, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.28, shadowRadius: 40, elevation: 40,
  },
  settingsPanelHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    height: 48,
  },
  settingsCloseBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  settingsPanelBody: { flex: 1, flexDirection: 'row' },
  settingsNav: { width: 200, borderRightWidth: StyleSheet.hairlineWidth, paddingTop: 12, paddingHorizontal: 8 },
  settingsNavItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, marginBottom: 2 },
  settingsContent: { flex: 1, padding: 24 },
  settingsSectionTitle: { fontSize: 20, fontWeight: '700', marginBottom: 20, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
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
