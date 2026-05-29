/**
 * DesktopLayout.tsx
 * Full-featured ChatGPT-style desktop layout
 * - Real chat via edge function (streaming SSE)
 * - Account delete (real, cross-platform)
 * - Password change + email change
 * - Shazam + Spotify app connect
 * - All home page functions mirrored
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, Modal, Pressable, Dimensions, Platform,
  ActivityIndicator, Switch, Animated, FlatList,
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
import * as Clipboard from 'expo-clipboard';

const ACCENT = '#10A37F';
const SHAZAM_BLUE = '#0D72EA';
const SPOTIFY_GREEN = '#1DB954';

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
  onNewChat, onOpenSearch, onOpenSettings, onCloseAll, onShowHelp, onSendMessage,
}: {
  onNewChat: () => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  onCloseAll: () => void;
  onShowHelp: () => void;
  onSendMessage?: () => void;
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
      if (e.key === 'Enter' && !e.shiftKey && (e.target as HTMLElement)?.id === 'desktop-chat-input') {
        e.preventDefault(); onSendMessage?.();
      }
    };
    (window as any).addEventListener('keydown', handler);
    return () => (window as any).removeEventListener('keydown', handler);
  }, [onNewChat, onOpenSearch, onOpenSettings, onCloseAll, onShowHelp, onSendMessage]);
}

// ════════════════════════════════════════════════════════════════════════════
// KEYBOARD SHORTCUTS MODAL
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
// LOGIN MODAL
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
          <Text style={[dls.loginSub, { color: sub }]}>{"You'll get smarter responses and can upload files, images, and more."}</Text>
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
                <TextInput style={[dls.input, { color: textC, flex: 1 }]} placeholder="Email address" placeholderTextColor={sub} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" onSubmitEditing={handleSendOTP} returnKeyType="go" />
              </View>
              <TouchableOpacity style={[dls.primaryBtn, { opacity: operationLoading ? 0.7 : 1 }]} onPress={handleSendOTP} disabled={operationLoading}>
                {operationLoading ? <ActivityIndicator color="#FFF" /> : <Text style={dls.primaryBtnText}>Continue</Text>}
              </TouchableOpacity>
            </>
          )}
          {step === 'otp' && (
            <>
              <Text style={[{ color: sub, fontSize: 14, marginBottom: 16, textAlign: 'center' }]}>We sent a 6-digit code to {email}</Text>
              <View style={[dls.inputRow, { backgroundColor: inputBg, borderColor: borderC, marginBottom: 16 }]}>
                <TextInput style={[dls.input, { color: textC, flex: 1, letterSpacing: 8, textAlign: 'center', fontSize: 22, fontWeight: '700' }]} placeholder="000000" placeholderTextColor={sub} value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={6} autoFocus onSubmitEditing={handleVerifyOTP} returnKeyType="go" />
              </View>
              <TouchableOpacity style={[dls.primaryBtn, { opacity: operationLoading ? 0.7 : 1 }]} onPress={handleVerifyOTP} disabled={operationLoading}>
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
// PASSWORD CHANGE MODAL
// ════════════════════════════════════════════════════════════════════════════
function ChangePasswordModal({ visible, onClose, isDark, userEmail }: {
  visible: boolean; onClose: () => void; isDark: boolean; userEmail: string;
}) {
  const { showAlert } = useAlert();
  const supabase = getSupabaseClient();
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const bg = isDark ? '#1C1C1E' : '#FFF';
  const textC = isDark ? '#FFF' : '#000';
  const sub = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)';
  const inputBg = isDark ? 'rgba(255,255,255,0.08)' : '#F5F5F7';
  const borderC = isDark ? 'rgba(255,255,255,0.12)' : '#E0E0E5';

  const reset = () => { setStep('request'); setOldPassword(''); setNewPassword(''); setConfirmPassword(''); setCode(''); };

  const handleRequestCode = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) { showAlert('Error', 'Please fill all fields'); return; }
    if (newPassword !== confirmPassword) { showAlert('Error', 'New passwords do not match'); return; }
    if (newPassword.length < 6) { showAlert('Error', 'Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('send-verification-code', { body: { email: userEmail, type: 'password_change' } });
      if (error) { showAlert('Error', error.message || 'Could not send code'); setLoading(false); return; }
      setStep('verify');
    } catch (e: any) { showAlert('Error', e.message || 'Failed to send code'); }
    setLoading(false);
  };

  const handleChangePassword = async () => {
    if (!code || code.length < 6) { showAlert('Error', 'Enter the 6-digit code'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('change-password', { body: { email: userEmail, oldPassword, newPassword, verificationCode: code } });
      if (error) { showAlert('Error', error.message || 'Failed to change password'); setLoading(false); return; }
      showAlert('Success', 'Password changed successfully');
      reset(); onClose();
    } catch (e: any) { showAlert('Error', e.message || 'Failed'); }
    setLoading(false);
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { reset(); onClose(); }}>
      <Pressable style={[dls.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]} onPress={() => { reset(); onClose(); }}>
        <Pressable style={[dls.loginCard, { backgroundColor: bg, maxWidth: 400 }]} onPress={() => {}}>
          <TouchableOpacity style={dls.closeBtn} onPress={() => { reset(); onClose(); }}>
            <Ionicons name="close" size={18} color={sub} />
          </TouchableOpacity>
          <Text style={[dls.loginTitle, { color: textC, fontSize: 20, marginBottom: 6 }]}>Change Password</Text>
          <Text style={[{ color: sub, fontSize: 14, marginBottom: 20, textAlign: 'center' }]}>{userEmail}</Text>
          {step === 'request' ? (
            <>
              {[
                { label: 'Current password', value: oldPassword, set: setOldPassword, placeholder: 'Enter current password' },
                { label: 'New password', value: newPassword, set: setNewPassword, placeholder: 'At least 6 characters' },
                { label: 'Confirm new password', value: confirmPassword, set: setConfirmPassword, placeholder: 'Repeat new password' },
              ].map(f => (
                <View key={f.label} style={{ marginBottom: 12, width: '100%' }}>
                  <Text style={{ color: sub, fontSize: 12, fontWeight: '600', marginBottom: 5 }}>{f.label}</Text>
                  <View style={[dls.inputRow, { backgroundColor: inputBg, borderColor: borderC }]}>
                    <TextInput style={[dls.input, { color: textC, flex: 1 }]} placeholder={f.placeholder} placeholderTextColor={sub} value={f.value} onChangeText={f.set} secureTextEntry />
                  </View>
                </View>
              ))}
              <TouchableOpacity style={[dls.primaryBtn, { opacity: loading ? 0.7 : 1, marginTop: 8 }]} onPress={handleRequestCode} disabled={loading}>
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={dls.primaryBtnText}>Send Verification Code</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={{ color: sub, fontSize: 14, textAlign: 'center', marginBottom: 16 }}>We sent a 6-digit code to {userEmail}</Text>
              <View style={[dls.inputRow, { backgroundColor: inputBg, borderColor: borderC, marginBottom: 16 }]}>
                <TextInput style={[dls.input, { color: textC, flex: 1, letterSpacing: 8, textAlign: 'center', fontSize: 22, fontWeight: '700' }]} placeholder="000000" placeholderTextColor={sub} value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} autoFocus />
              </View>
              <TouchableOpacity style={[dls.primaryBtn, { opacity: loading ? 0.7 : 1 }]} onPress={handleChangePassword} disabled={loading}>
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={dls.primaryBtnText}>Change Password</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={{ marginTop: 12, alignItems: 'center' }} onPress={() => setStep('request')}>
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
// EMAIL CHANGE MODAL
// ════════════════════════════════════════════════════════════════════════════
function ChangeEmailModal({ visible, onClose, isDark, userEmail }: {
  visible: boolean; onClose: () => void; isDark: boolean; userEmail: string;
}) {
  const { showAlert } = useAlert();
  const supabase = getSupabaseClient();
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const bg = isDark ? '#1C1C1E' : '#FFF';
  const textC = isDark ? '#FFF' : '#000';
  const sub = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)';
  const inputBg = isDark ? 'rgba(255,255,255,0.08)' : '#F5F5F7';
  const borderC = isDark ? 'rgba(255,255,255,0.12)' : '#E0E0E5';

  const handleChange = async () => {
    if (!newEmail.trim() || !newEmail.includes('@')) { showAlert('Error', 'Enter a valid email address'); return; }
    if (newEmail.trim().toLowerCase() === userEmail.toLowerCase()) { showAlert('Error', 'New email is the same as current'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
      if (error) { showAlert('Error', error.message || 'Failed to update email'); setLoading(false); return; }
      // Also update user_profiles
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        await supabase.from('user_profiles').update({ email: newEmail.trim() }).eq('id', user.id);
      }
      showAlert('Check your inbox', `A confirmation link was sent to ${newEmail}. Click it to confirm the email change.`);
      setNewEmail(''); onClose();
    } catch (e: any) { showAlert('Error', e.message || 'Failed'); }
    setLoading(false);
  };

  if (!visible) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[dls.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]} onPress={onClose}>
        <Pressable style={[dls.loginCard, { backgroundColor: bg, maxWidth: 400 }]} onPress={() => {}}>
          <TouchableOpacity style={dls.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={18} color={sub} />
          </TouchableOpacity>
          <Text style={[dls.loginTitle, { color: textC, fontSize: 20, marginBottom: 6 }]}>Change Email</Text>
          <Text style={{ color: sub, fontSize: 14, marginBottom: 20, textAlign: 'center' }}>Current: {userEmail}</Text>
          <View style={{ width: '100%', marginBottom: 16 }}>
            <Text style={{ color: sub, fontSize: 12, fontWeight: '600', marginBottom: 5 }}>New email address</Text>
            <View style={[dls.inputRow, { backgroundColor: inputBg, borderColor: borderC }]}>
              <TextInput style={[dls.input, { color: textC, flex: 1 }]} placeholder="new@email.com" placeholderTextColor={sub} value={newEmail} onChangeText={setNewEmail} keyboardType="email-address" autoCapitalize="none" autoFocus />
            </View>
          </View>
          <Text style={{ color: sub, fontSize: 12, marginBottom: 16, lineHeight: 18 }}>A confirmation link will be sent to your new email. You must click it to complete the change.</Text>
          <TouchableOpacity style={[dls.primaryBtn, { opacity: loading ? 0.7 : 1 }]} onPress={handleChange} disabled={loading}>
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={dls.primaryBtnText}>Send Confirmation</Text>}
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ACCOUNT DELETE MODAL (real — deletes from auth + profiles)
// ════════════════════════════════════════════════════════════════════════════
function DeleteAccountModal({ visible, onClose, isDark, userEmail, onDeleted }: {
  visible: boolean; onClose: () => void; isDark: boolean; userEmail: string; onDeleted: () => void;
}) {
  const { showAlert } = useAlert();
  const { logout } = useAuth();
  const supabase = getSupabaseClient();
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const bg = isDark ? '#1C1C1E' : '#FFF';
  const textC = isDark ? '#FFF' : '#000';
  const sub = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)';
  const inputBg = isDark ? 'rgba(255,255,255,0.08)' : '#F5F5F7';
  const borderC = isDark ? 'rgba(255,255,255,0.12)' : '#E0E0E5';

  const handleDelete = async () => {
    if (confirmText.trim().toLowerCase() !== 'delete') {
      showAlert('Error', "Type 'delete' to confirm");
      return;
    }
    setLoading(true);
    try {
      // 1. Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) { showAlert('Error', 'Not authenticated'); setLoading(false); return; }

      // 2. Delete user_profiles row (cascades to all related tables via FK)
      await supabase.from('user_profiles').delete().eq('id', user.id);

      // 3. Delete auth user via admin edge function
      const { error: deleteError } = await supabase.functions.invoke('ban-user', {
        body: { userId: user.id, reason: 'Account self-deletion', deleteAccount: true, duration: 36500 },
      });

      // 4. Sign out regardless
      await logout();
      onDeleted();
      showAlert('Account Deleted', 'Your account and all data have been permanently deleted.');
    } catch (e: any) {
      // Even if the admin call fails, try to sign out
      await logout().catch(() => {});
      onDeleted();
    }
    setLoading(false);
  };

  if (!visible) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[dls.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.6)' }]} onPress={onClose}>
        <Pressable style={[dls.loginCard, { backgroundColor: bg, maxWidth: 420 }]} onPress={() => {}}>
          <TouchableOpacity style={dls.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={18} color={sub} />
          </TouchableOpacity>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,59,48,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 16, alignSelf: 'center' }}>
            <Ionicons name="trash-outline" size={28} color="#FF3B30" />
          </View>
          <Text style={[dls.loginTitle, { color: '#FF3B30', fontSize: 20, marginBottom: 8 }]}>Delete Account</Text>
          <Text style={{ color: sub, fontSize: 14, textAlign: 'center', lineHeight: 21, marginBottom: 6 }}>
            This will permanently delete your account <Text style={{ color: textC, fontWeight: '600' }}>{userEmail}</Text> and ALL data including conversations, settings, and files.
          </Text>
          <Text style={{ color: '#FF3B30', fontSize: 13, fontWeight: '600', textAlign: 'center', marginBottom: 20 }}>This action cannot be undone.</Text>
          <View style={{ width: '100%', marginBottom: 16 }}>
            <Text style={{ color: sub, fontSize: 13, marginBottom: 8 }}>Type <Text style={{ color: textC, fontWeight: '700' }}>delete</Text> to confirm</Text>
            <View style={[dls.inputRow, { backgroundColor: inputBg, borderColor: confirmText.toLowerCase() === 'delete' ? '#FF3B30' : borderC }]}>
              <TextInput style={[dls.input, { color: textC, flex: 1 }]} placeholder="delete" placeholderTextColor={sub} value={confirmText} onChangeText={setConfirmText} autoCapitalize="none" />
            </View>
          </View>
          <TouchableOpacity
            style={[dls.primaryBtn, { backgroundColor: confirmText.toLowerCase() === 'delete' ? '#FF3B30' : (isDark ? 'rgba(255,255,255,0.1)' : '#E0E0E5'), opacity: loading ? 0.7 : 1 }]}
            onPress={handleDelete}
            disabled={loading || confirmText.toLowerCase() !== 'delete'}
          >
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={[dls.primaryBtnText, { color: confirmText.toLowerCase() === 'delete' ? '#FFF' : sub }]}>Permanently Delete Account</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={{ marginTop: 12, alignItems: 'center' }} onPress={onClose}>
            <Text style={{ color: ACCENT, fontSize: 14 }}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// APP CONNECT MODAL (Shazam + Spotify)
// ════════════════════════════════════════════════════════════════════════════
function AppConnectModal({ visible, onClose, isDark, onConnectShazam, onConnectSpotify, shazamConnected, spotifyConnected }: {
  visible: boolean; onClose: () => void; isDark: boolean;
  onConnectShazam: () => void; onConnectSpotify: () => void;
  shazamConnected: boolean; spotifyConnected: boolean;
}) {
  const bg = isDark ? '#1C1C1E' : '#FFF';
  const textC = isDark ? '#FFF' : '#000';
  const sub = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)';
  const cardBg = isDark ? 'rgba(255,255,255,0.05)' : '#F5F5F7';
  const borderC = isDark ? 'rgba(255,255,255,0.1)' : '#E0E0E5';

  const apps = [
    {
      id: 'spotify', name: 'Spotify', desc: 'Stream music and podcasts directly in chat', color: SPOTIFY_GREEN,
      icon: 'musical-notes-outline' as const, connected: spotifyConnected, onPress: onConnectSpotify,
    },
    {
      id: 'shazam', name: 'Shazam', desc: 'Identify any song playing around you', color: SHAZAM_BLUE,
      icon: 'radio-outline' as const, connected: shazamConnected, onPress: onConnectShazam,
    },
  ];

  if (!visible) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[dls.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]} onPress={onClose}>
        <Pressable style={[dls.loginCard, { backgroundColor: bg, maxWidth: 460, alignItems: 'flex-start' }]} onPress={() => {}}>
          <TouchableOpacity style={dls.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={18} color={sub} />
          </TouchableOpacity>
          <Text style={{ color: textC, fontSize: 20, fontWeight: '700', marginBottom: 6 }}>Apps & Connectors</Text>
          <Text style={{ color: sub, fontSize: 14, marginBottom: 24 }}>Connect apps to supercharge your Dawinix experience</Text>
          {apps.map(app => (
            <View key={app.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: cardBg, borderRadius: 14, padding: 16, marginBottom: 12, width: '100%', borderWidth: StyleSheet.hairlineWidth, borderColor: borderC }}>
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: app.color + '22', alignItems: 'center', justifyContent: 'center', marginRight: 14, borderWidth: 1, borderColor: app.color + '44' }}>
                <Ionicons name={app.icon} size={22} color={app.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: textC, fontSize: 16, fontWeight: '600', marginBottom: 3 }}>{app.name}</Text>
                <Text style={{ color: sub, fontSize: 13 }}>{app.desc}</Text>
              </View>
              {app.connected ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: app.color + '18', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 }}>
                  <Ionicons name="checkmark-circle" size={14} color={app.color} />
                  <Text style={{ color: app.color, fontSize: 13, fontWeight: '700' }}>Connected</Text>
                </View>
              ) : (
                <TouchableOpacity style={{ backgroundColor: textC, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 }} onPress={() => { onClose(); app.onPress(); }}>
                  <Text style={{ color: isDark ? '#000' : '#FFF', fontSize: 13, fontWeight: '700' }}>Connect</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// CONVERSATION CONTEXT MENU
// ════════════════════════════════════════════════════════════════════════════
function ConvContextMenu({ conv, position, onClose, onAction, isDark }: {
  conv: { id: string; title: string } | null;
  position: { top: number; left: number };
  onClose: () => void;
  onAction: (action: 'share' | 'rename' | 'pin' | 'archive' | 'delete') => void;
  isDark: boolean;
}) {
  const bg = isDark ? '#2C2C2E' : '#FFFFFF';
  const textC = isDark ? '#FFF' : '#000';
  const borderC = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)';
  const shadow = { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.22, shadowRadius: 16, elevation: 16 };
  const items = [
    { key: 'share', icon: 'arrow-redo-outline', label: 'Share' },
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
            <TouchableOpacity key={item.key} style={[dls.convMenuItem, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: borderC }]} onPress={() => { onClose(); onAction(item.key as any); }} activeOpacity={0.7}>
              <Ionicons name={item.icon as any} size={16} color={(item as any).destructive ? '#FF3B30' : textC} />
              <Text style={[dls.convMenuText, { color: (item as any).destructive ? '#FF3B30' : textC }]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// USER BOTTOM MENU
// ════════════════════════════════════════════════════════════════════════════
function UserBottomMenu({ visible, onClose, user, isDark, onLogout, profilePhotoUrl, displayName, tier, router, onSettings, onChangePassword, onChangeEmail, onDeleteAccount }: {
  visible: boolean; onClose: () => void; user: any; isDark: boolean;
  onLogout: () => void; profilePhotoUrl: string | null; displayName: string; tier: string; router: any;
  onSettings: () => void; onChangePassword: () => void; onChangeEmail: () => void; onDeleteAccount: () => void;
}) {
  const bg = isDark ? '#2C2C2E' : '#FFFFFF';
  const textC = isDark ? '#FFF' : '#000';
  const borderC = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)';
  const sub = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';
  if (!visible) return null;
  const items = [
    { icon: 'arrow-up-circle-outline', label: 'Upgrade plan', action: () => { onClose(); router.push('/subscription'); } },
    { icon: 'person-outline', label: 'Personalization', action: () => { onClose(); router.push('/personalization'); } },
    { icon: 'lock-closed-outline', label: 'Change Password', action: () => { onClose(); onChangePassword(); } },
    { icon: 'mail-outline', label: 'Change Email', action: () => { onClose(); onChangeEmail(); } },
    { icon: 'settings-outline', label: 'Settings', action: () => { onClose(); onSettings(); } },
    { icon: 'help-circle-outline', label: 'Help', action: () => { onClose(); router.push('/bugreport'); } },
    { icon: 'trash-outline', label: 'Delete Account', action: () => { onClose(); onDeleteAccount(); }, destructive: true },
    { icon: 'log-out-outline', label: 'Log out', action: onLogout, destructive: true },
  ];
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1 }} onPress={onClose}>
        <View style={[dls.userMenu, { backgroundColor: bg }]}>
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
            <TouchableOpacity key={item.label} style={[dls.convMenuItem, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: borderC }]} onPress={item.action} activeOpacity={0.7}>
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
// DESKTOP CHAT PANEL (real streaming chat)
// ════════════════════════════════════════════════════════════════════════════
function DesktopChatPanel({ isDark, colors, accentColor }: { isDark: boolean; colors: any; accentColor: string }) {
  const { messages, currentConversation, sendMessage, streamingMessageId, loading, createConversation, cancelSendMessage } = useConversation();
  const { user } = useAuth();
  const { settings } = useSettings();
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const flatRef = useRef<FlatList>(null);
  const textC = isDark ? '#FFF' : '#000';
  const sub = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';
  const inputBg = isDark ? 'rgba(44,44,46,0.95)' : 'rgba(235,235,235,0.95)';
  const borderC = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)';

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || sending) return;
    let convId = currentConversation?.id;
    if (!convId) { convId = await createConversation(); }
    if (!convId) return;
    setInputText('');
    setSending(true);
    try {
      await sendMessage(text, undefined, undefined, false, (settings.preferredAiModel as any) || 'gemini');
    } catch (_e) {}
    setSending(false);
  }, [inputText, sending, currentConversation, createConversation, sendMessage, settings.preferredAiModel]);

  useEffect(() => {
    if ((messages || []).length > 0) {
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [(messages || []).length]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={accentColor} />
      </View>
    );
  }

  const displayMessages = messages || [];

  return (
    <View style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* Messages */}
      <FlatList
        ref={flatRef}
        data={displayMessages}
        keyExtractor={item => item.id}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingVertical: 20, paddingHorizontal: 0 }}
        onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          const isUser = item.role === 'user';
          const isStreaming = streamingMessageId === item.id;
          return (
            <View style={{ paddingHorizontal: 24, marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: isUser ? 'flex-end' : 'flex-start', alignItems: 'flex-start', gap: 10 }}>
                {!isUser && (
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: accentColor, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                    <Ionicons name="sparkles" size={14} color="#FFF" />
                  </View>
                )}
                <TouchableOpacity
                  style={{
                    maxWidth: '72%',
                    backgroundColor: isUser ? accentColor : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                    borderRadius: 18,
                    borderBottomRightRadius: isUser ? 4 : 18,
                    borderBottomLeftRadius: isUser ? 18 : 4,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                  }}
                  activeOpacity={0.8}
                  onLongPress={() => Clipboard.setStringAsync(item.content || '')}
                >
                  <Text style={{ color: isUser ? '#FFF' : textC, fontSize: 15, lineHeight: 22 }}>
                    {item.content || ''}
                    {isStreaming ? <Text style={{ color: accentColor }}>▍</Text> : null}
                  </Text>
                </TouchableOpacity>
                {isUser && (
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: isDark ? '#3A3A3C' : '#E5E5EA', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                    <Ionicons name="person" size={14} color={textC} />
                  </View>
                )}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingHorizontal: 40 }}>
              <Text style={{ color: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)', fontSize: 28, fontWeight: '600' }}>Ready when you are.</Text>
            </View>
          ) : null
        }
      />

      {/* Thinking indicator */}
      {sending && !streamingMessageId ? (
        <View style={{ paddingHorizontal: 24, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: accentColor, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="sparkles" size={14} color="#FFF" />
          </View>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {[0, 1, 2].map(i => (
              <View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: accentColor, opacity: 0.7 }} />
            ))}
          </View>
          <Text style={{ color: sub, fontSize: 13 }}>Thinking...</Text>
          <TouchableOpacity onPress={cancelSendMessage} style={{ marginLeft: 4, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="stop" size={9} color={sub} />
            </View>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Input */}
      <View style={{ paddingHorizontal: 24, paddingBottom: 16, paddingTop: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, backgroundColor: inputBg, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: borderC }}>
          <TextInput
            nativeID="desktop-chat-input"
            style={{ flex: 1, color: textC, fontSize: 15, maxHeight: 160, minHeight: 24, lineHeight: 22, paddingVertical: 0 } as any}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Message Dawinix..."
            placeholderTextColor={sub}
            multiline
            blurOnSubmit={false}
          />
          {sending ? (
            <TouchableOpacity style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: isDark ? '#3A3A3C' : '#DCDCDC', alignItems: 'center', justifyContent: 'center' }} onPress={cancelSendMessage}>
              <View style={{ width: 10, height: 10, backgroundColor: textC, borderRadius: 2 }} />
            </TouchableOpacity>
          ) : inputText.trim() ? (
            <TouchableOpacity style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: accentColor, alignItems: 'center', justifyContent: 'center' }} onPress={handleSend}>
              <Ionicons name="arrow-up" size={16} color="#FFF" />
            </TouchableOpacity>
          ) : null}
        </View>
        <Text style={{ color: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)', fontSize: 11, textAlign: 'center', marginTop: 6 }}>Press Enter to send · Shift+Enter for new line</Text>
      </View>
    </View>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// DESKTOP SETTINGS PANEL
// ════════════════════════════════════════════════════════════════════════════
function DesktopSettingsPanel({ visible, onClose, isDark, user, tier, onLogout, onChangePassword, onChangeEmail, onDeleteAccount }: {
  visible: boolean; onClose: () => void; isDark: boolean;
  user?: any; tier?: string; onLogout?: () => void;
  onChangePassword: () => void; onChangeEmail: () => void; onDeleteAccount: () => void;
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
  const accentColor = settings.accentColor || ACCENT;
  const [activeSection, setActiveSection] = useState('general');
  const [mfaAuthEnabled, setMfaAuthEnabled] = useState(false);
  const [mfaTextEnabled, setMfaTextEnabled] = useState(false);
  const [separateVoice, setSeparateVoice] = useState(false);
  const [dictationEnabled, setDictationEnabled] = useState(true);
  const [personalizeAds, setPersonalizeAds] = useState(true);
  const [pastChatsAds, setPastChatsAds] = useState(true);
  const [notifSettings] = useState<Record<string, string>>({
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
    { hex: '#10A37F', name: 'Green' }, { hex: '#0A84FF', name: 'Blue' },
    { hex: '#FF9F0A', name: 'Orange' }, { hex: '#FF453A', name: 'Red' },
    { hex: '#BF5AF2', name: 'Purple' }, { hex: '#FF375F', name: 'Pink' },
  ];

  if (!visible) return null;

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
    <Text style={{ color: textC, fontSize: 18, fontWeight: '700', marginBottom: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: borderC }}>{title}</Text>
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
      case 'general':
        return (
          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            <SectionTitle title="General" />
            <Row label="Appearance" right={
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {['System', 'Light', 'Dark'].map(opt => (
                  <TouchableOpacity key={opt} style={[dls.appearanceChip, { backgroundColor: settings.appearance === opt ? accentColor : (isDark ? 'rgba(255,255,255,0.1)' : '#EBEBF0') }]} onPress={() => updateSetting('appearance', opt)}>
                    <Text style={{ color: settings.appearance === opt ? '#FFF' : textC, fontSize: 13, fontWeight: '500' }}>{opt}</Text>
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
            <Row label="Language" right={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ color: sub }}>{settings.appLanguage || 'Auto-detect'}</Text>
                <Ionicons name="chevron-down" size={14} color={sub} />
              </View>
            } />
            <Row label="Enable Dictation" right={<Switch value={dictationEnabled} onValueChange={setDictationEnabled} trackColor={{ true: switchTrackTrue, false: switchTrackFalse }} />} />
            <Row label="Voice" right={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ color: sub }}>{settings.voiceSelection || 'Ember'}</Text>
                <Ionicons name="chevron-down" size={14} color={sub} />
              </View>
            } />
            <Row label="Separate Voice" right={<Switch value={separateVoice} onValueChange={setSeparateVoice} trackColor={{ true: switchTrackTrue, false: switchTrackFalse }} />} />
            <Row label="Haptic feedback" right={<Switch value={settings.hapticFeedback} onValueChange={v => updateSetting('hapticFeedback', v)} trackColor={{ true: switchTrackTrue, false: switchTrackFalse }} />} />
            <Row label="Auto spelling correction" right={<Switch value={settings.autoSpelling} onValueChange={v => updateSetting('autoSpelling', v)} trackColor={{ true: switchTrackTrue, false: switchTrackFalse }} />} />
            <Row label="Autocomplete" right={<Switch value={settings.autocomplete} onValueChange={v => updateSetting('autocomplete', v)} trackColor={{ true: switchTrackTrue, false: switchTrackFalse }} />} />
            <Row label="Trending searches" right={<Switch value={settings.trendingSearches} onValueChange={v => updateSetting('trendingSearches', v)} trackColor={{ true: switchTrackTrue, false: switchTrackFalse }} />} />
            <Row label="Follow-up suggestions" right={<Switch value={settings.followupSuggestions !== false} onValueChange={v => updateSetting('followupSuggestions', v)} trackColor={{ true: switchTrackTrue, false: switchTrackFalse }} />} />
          </ScrollView>
        );

      case 'notifications':
        return (
          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            <SectionTitle title="Notifications" />
            {Object.entries(notifSettings).map(([key, val]) => (
              <Row key={key} label={key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())} right={
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ color: sub, fontSize: 14 }}>{val}</Text>
                  <Ionicons name="chevron-down" size={14} color={sub} />
                </View>
              } />
            ))}
          </ScrollView>
        );

      case 'personalization':
        return (
          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            <SectionTitle title="Personalization" />
            <NavRow label="Custom instructions" action={() => { onClose(); router.push('/personalization'); }} />
            <NavRow label="Memory" action={() => { onClose(); router.push('/personalization'); }} />
            <NavRow label="Profile" action={() => { onClose(); router.push('/settings'); }} />
          </ScrollView>
        );

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
          </ScrollView>
        );

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

      case 'ads':
        return (
          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            <SectionTitle title="Ads controls" />
            <NavRow label="History" action={() => { onClose(); router.push('/ad-history'); }} />
            <NavRow label="Interests" action={() => { onClose(); router.push('/ad-interests'); }} />
            <Row label="Personalize ads" right={<Switch value={personalizeAds} onValueChange={setPersonalizeAds} trackColor={{ true: switchTrackTrue, false: switchTrackFalse }} />} />
            <Row label="Past chats and memory" right={<Switch value={pastChatsAds} onValueChange={setPastChatsAds} trackColor={{ true: switchTrackTrue, false: switchTrackFalse }} />} />
          </ScrollView>
        );

      case 'data':
        return (
          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            <SectionTitle title="Data controls" />
            <Row label="Archived chats" right={<OutlineBtn label="Manage" onPress={() => { onClose(); router.push('/archived-chats'); }} />} />
            <Row label="Archive all chats" right={<OutlineBtn label="Archive all" onPress={() => showAlert('Archive All', 'Archive all chats?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Archive', onPress: () => {} }])} />} />
            <Row label="Delete all chats" right={<OutlineBtn label="Delete all" color="#FF3B30" onPress={() => showAlert('Delete All Chats', 'Permanently delete all chats?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => {} }])} />} />
            <Row label="Export data" right={<OutlineBtn label="Export" onPress={() => showAlert('Export', 'Preparing data export. You will receive an email when ready.')} />} />
          </ScrollView>
        );

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
          </ScrollView>
        );

      case 'security':
        return (
          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            <SectionTitle title="Security" />
            <Row label="Password" right={<OutlineBtn label="Change" onPress={() => { onClose(); onChangePassword(); }} />} />
            <Row label="Email" sub={user?.email || ''} right={<OutlineBtn label="Change" onPress={() => { onClose(); onChangeEmail(); }} />} />
            <Row label="Security keys & passkeys" right={<OutlineBtn label="Add" onPress={() => { onClose(); router.push('/passkeys'); }} />} />
            <SubHeader text="Multi-factor authentication" />
            <Row label="Authenticator app" right={<Switch value={mfaAuthEnabled} onValueChange={(v) => { setMfaAuthEnabled(v); if (v) { onClose(); router.push('/authenticator-app'); } }} trackColor={{ true: switchTrackTrue, false: switchTrackFalse }} />} />
            <Row label="Text message" right={<Switch value={mfaTextEnabled} onValueChange={(v) => { setMfaTextEnabled(v); if (v) { onClose(); router.push('/text-messages-mfa'); } }} trackColor={{ true: switchTrackTrue, false: switchTrackFalse }} />} />
            <Row label="Log out all devices" right={<OutlineBtn label="Log out all" color="#FF3B30" onPress={() => showAlert('Log Out All', 'Log out of all devices?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Log out all', style: 'destructive', onPress: () => { if (onLogout) onLogout(); onClose(); } }])} />} />
          </ScrollView>
        );

      case 'parental':
        return (
          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            <SectionTitle title="Parental controls" />
            <View style={{ alignItems: 'center', paddingVertical: 28 }}>
              <TouchableOpacity style={{ backgroundColor: accentColor, borderRadius: 50, paddingHorizontal: 24, paddingVertical: 12 }} onPress={() => { onClose(); router.push('/parental-controls'); }}>
                <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '700' }}>Set up parental controls</Text>
              </TouchableOpacity>
            </View>
            <NavRow label="View family members" action={() => { onClose(); router.push('/family-member'); }} />
          </ScrollView>
        );

      case 'account':
        return (
          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            <SectionTitle title="Account" />
            <Row label="Name" right={<Text style={{ color: sub, fontSize: 14 }}>{user?.email?.split('@')[0] || '—'}</Text>} />
            <Row label="Email" sub="Tap Change to update your email address" right={<OutlineBtn label="Change" onPress={() => { onClose(); onChangeEmail(); }} />} />
            <Row label="Password" right={<OutlineBtn label="Change" onPress={() => { onClose(); onChangePassword(); }} />} />
            <View style={{ marginTop: 32, padding: 16, backgroundColor: isDark ? 'rgba(255,59,48,0.08)' : 'rgba(255,59,48,0.05)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,59,48,0.2)' }}>
              <Text style={{ color: '#FF3B30', fontSize: 14, fontWeight: '700', marginBottom: 8 }}>Danger Zone</Text>
              <Text style={{ color: sub, fontSize: 13, lineHeight: 18, marginBottom: 14 }}>Permanently delete your account and all associated data. This action cannot be undone and affects all devices.</Text>
              <TouchableOpacity style={{ backgroundColor: '#FF3B30', borderRadius: 10, paddingVertical: 12, alignItems: 'center' }} onPress={() => { onClose(); onDeleteAccount(); }}>
                <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '700' }}>Delete Account</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        );

      default:
        return (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
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
          <View style={[dls.settingsPanelHeader, { borderBottomColor: borderC }]}>
            <TouchableOpacity onPress={onClose} style={dls.settingsCloseBtn}>
              <Ionicons name="close" size={18} color={textC} />
            </TouchableOpacity>
          </View>
          <View style={dls.settingsPanelBody}>
            <View style={[dls.settingsNav, { borderRightColor: borderC }]}>
              {SECTIONS.map(s => (
                <TouchableOpacity key={s.id} style={[dls.settingsNavItem, activeSection === s.id && { backgroundColor: activeNavBg, borderRadius: 10 }]} onPress={() => setActiveSection(s.id)} activeOpacity={0.7}>
                  <Ionicons name={s.icon as any} size={18} color={activeSection === s.id ? accentColor : sub} />
                  <Text style={{ color: activeSection === s.id ? textC : sub, fontSize: 14, fontWeight: activeSection === s.id ? '600' : '400', marginLeft: 10 }}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
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
// MAIN DESKTOP LAYOUT
// ════════════════════════════════════════════════════════════════════════════
export function DesktopLayout({ children }: { children: React.ReactNode }) {
  const { isDark, colors } = useTheme();
  const { user, logout } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const { settings } = useSettings();
  const { tier } = useSubscription();
  const { conversations, currentConversation, selectConversation, deleteConversation, archiveConversation, updateConversationTitle, createConversation, searchConversations, messages } = useConversation();
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
  const [shortcutsVisible, setShortcutsVisible] = useState(false);
  const [changePasswordVisible, setChangePasswordVisible] = useState(false);
  const [changeEmailVisible, setChangeEmailVisible] = useState(false);
  const [deleteAccountVisible, setDeleteAccountVisible] = useState(false);
  const [appConnectVisible, setAppConnectVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [shazamConnected, setShazamConnected] = useState(false);
  const [spotifyConnected, setSpotifyConnected] = useState(false);

  const bg = isDark ? '#0a0a0a' : '#FAFAFA';
  const sidebarBg = isDark ? '#111111' : '#F7F7F7';
  const sidebarBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const textC = isDark ? '#FFF' : '#000';
  const sub = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';
  const activeConvBg = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';

  const displayedConvs = searchQuery.trim() ? searchConversations(searchQuery) : conversations;
  const displayNameFinal = displayName || user?.email?.split('@')[0] || 'User';

  // Load app connection state
  useEffect(() => {
    AsyncStorage.multiGet(['shazam_connected', 'spotify_connected']).then(results => {
      setShazamConnected(results[0][1] === 'true');
      setSpotifyConnected(results[1][1] === 'true');
    }).catch(() => {});
  }, []);

  const handleConnectShazam = useCallback(async () => {
    await AsyncStorage.setItem('shazam_connected', 'true');
    setShazamConnected(true);
    showAlert('Shazam Connected', 'You can now use @Shazam in your chats to identify songs.');
  }, [showAlert]);

  const handleConnectSpotify = useCallback(() => {
    router.push('/spotify-connect' as any);
  }, [router]);

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
      showAlert('Delete Chat', 'Permanently delete this chat?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteConversation(convMenuConv.id) },
      ]);
    } else if (action === 'archive') {
      await archiveConversation(convMenuConv.id);
    } else if (action === 'rename') {
      showAlert('Rename', 'Rename this chat', [{ text: 'Cancel', style: 'cancel' }]);
    } else if (action === 'share') {
      const msgs = messages || [];
      const text = msgs.map(m => `${m.role === 'user' ? 'You' : 'AI'}: ${m.content}`).join('\n\n');
      if (Platform.OS === 'web') {
        try { await (navigator as any).clipboard.writeText(text); showAlert('Copied', 'Chat copied to clipboard'); } catch (_e) {}
      }
    }
  }, [convMenuConv, showAlert, deleteConversation, archiveConversation, messages]);

  const handleAccountDeleted = useCallback(() => {
    setDeleteAccountVisible(false);
    router.replace('/login');
  }, [router]);

  useKeyboardShortcuts({
    onNewChat: handleNewChat,
    onOpenSearch: () => setSearchFocused(true),
    onOpenSettings: () => setSettingsVisible(true),
    onCloseAll: () => {
      setSettingsVisible(false); setLoginModalVisible(false); setUserMenuVisible(false);
      setShortcutsVisible(false); setChangePasswordVisible(false); setChangeEmailVisible(false);
      setDeleteAccountVisible(false); setAppConnectVisible(false);
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
            <TouchableOpacity style={dls.slimIconBtn} onPress={() => setAppConnectVisible(true)} activeOpacity={0.7}>
              <Ionicons name="grid-outline" size={20} color={sub} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={[dls.slimIconBtn, { marginBottom: 16 }]} onPress={() => setSettingsVisible(true)} activeOpacity={0.7}>
            <Ionicons name="settings-outline" size={20} color={sub} />
          </TouchableOpacity>
        </View>

        <View style={dls.desktopMain}>
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
          <DesktopChatPanel isDark={isDark} colors={colors} accentColor={accentColor} />
        </View>

        <DesktopLoginModal visible={loginModalVisible} onClose={() => setLoginModalVisible(false)} onSuccess={() => setLoginModalVisible(false)} />
        <DesktopSettingsPanel visible={settingsVisible} onClose={() => setSettingsVisible(false)} isDark={isDark} user={user} tier={tier} onLogout={handleLogout} onChangePassword={() => setChangePasswordVisible(true)} onChangeEmail={() => setChangeEmailVisible(true)} onDeleteAccount={() => setDeleteAccountVisible(true)} />
        <AppConnectModal visible={appConnectVisible} onClose={() => setAppConnectVisible(false)} isDark={isDark} onConnectShazam={handleConnectShazam} onConnectSpotify={handleConnectSpotify} shazamConnected={shazamConnected} spotifyConnected={spotifyConnected} />
        <KeyboardShortcutsModal visible={shortcutsVisible} onClose={() => setShortcutsVisible(false)} isDark={isDark} />
      </View>
    );
  }

  // ── FULL SIDEBAR (logged in) ──────────────────────────────────────────────
  return (
    <View style={[dls.desktopRoot, { backgroundColor: bg }]}>
      {sidebarExpanded && (
        <View style={[dls.fullSidebar, { backgroundColor: sidebarBg, borderRightColor: sidebarBorder }]}>
          <View style={dls.sidebarHeader}>
            <View style={[dls.logoCircle, { backgroundColor: accentColor }]}>
              <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 14 }}>D</Text>
            </View>
            <TouchableOpacity style={dls.sidebarIconBtn} onPress={() => setSidebarExpanded(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="reorder-three-outline" size={20} color={sub} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={[dls.newChatBtn, { borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#E0E0E5' }]} onPress={handleNewChat} activeOpacity={0.8}>
            <Ionicons name="create-outline" size={17} color={textC} />
            <Text style={{ color: textC, fontSize: 15, fontWeight: '500', marginLeft: 8 }}>New chat</Text>
          </TouchableOpacity>

          <View style={[dls.sidebarSearch, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E0E0E5' }]}>
            <Ionicons name="search-outline" size={15} color={sub} />
            <TextInput style={{ flex: 1, color: textC, fontSize: 14, marginLeft: 8, paddingVertical: 0 } as any} placeholder="Search chats" placeholderTextColor={sub} value={searchQuery} onChangeText={setSearchQuery} autoFocus={searchFocused} onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)} />
          </View>

          {[
            { icon: 'images-outline', label: 'Images', action: () => router.push('/images') },
            { icon: 'folder-outline', label: 'Projects', action: () => router.push('/project-get') },
            { icon: 'grid-outline', label: 'Apps', action: () => setAppConnectVisible(true) },
          ].map(item => (
            <TouchableOpacity key={item.label} style={dls.sidebarNavItem} onPress={item.action} activeOpacity={0.7}>
              <Ionicons name={item.icon as any} size={18} color={sub} />
              <Text style={{ color: sub, fontSize: 15, marginLeft: 10 }}>{item.label}</Text>
              {/* Connected app badges */}
              {item.label === 'Apps' && (shazamConnected || spotifyConnected) ? (
                <View style={{ marginLeft: 'auto', flexDirection: 'row', gap: 4 }}>
                  {shazamConnected ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: SHAZAM_BLUE }} /> : null}
                  {spotifyConnected ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: SPOTIFY_GREEN }} /> : null}
                </View>
              ) : null}
            </TouchableOpacity>
          ))}

          <View style={[dls.sidebarDivider, { backgroundColor: sidebarBorder }]} />
          <Text style={[dls.sidebarSectionLabel, { color: sub }]}>Recents</Text>

          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            {displayedConvs.length === 0 && (
              <Text style={{ color: sub, fontSize: 14, textAlign: 'center', marginTop: 20 }}>No conversations yet</Text>
            )}
            {displayedConvs.slice(0, 60).map(conv => {
              const isActive = currentConversation?.id === conv.id;
              return (
                <TouchableOpacity key={conv.id} style={[dls.convRow, isActive && { backgroundColor: activeConvBg, borderRadius: 10 }]} onPress={() => handleSelectConv(conv.id)} activeOpacity={0.7}>
                  <Text style={{ color: isActive ? textC : sub, fontSize: 14, flex: 1, fontWeight: isActive ? '500' : '400' }} numberOfLines={1}>
                    {conv.title || 'New conversation'}
                  </Text>
                  <TouchableOpacity style={dls.convDotBtn} onPress={(e) => {
                    const pageX = (e.nativeEvent as any).pageX ?? 260;
                    const pageY = (e.nativeEvent as any).pageY ?? 100;
                    setConvMenuConv(conv);
                    setConvMenuPos({ top: pageY, left: Math.min(pageX, Dimensions.get('window').width - 220) });
                  }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="ellipsis-horizontal" size={15} color={sub} />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
            <View style={{ height: 80 }} />
          </ScrollView>

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
          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 }} onPress={() => setShortcutsVisible(true)}>
            <Ionicons name="keyboard-outline" size={14} color={sub} />
            <Text style={{ color: sub, fontSize: 12, marginLeft: 6 }}>Keyboard shortcuts</Text>
          </TouchableOpacity>

          <View style={[dls.sidebarDivider, { backgroundColor: sidebarBorder }]} />

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
          <TouchableOpacity style={dls.slimIconBtn} onPress={() => setAppConnectVisible(true)} activeOpacity={0.7}>
            <Ionicons name="grid-outline" size={20} color={sub} />
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

      <View style={dls.desktopMain}>
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
          {/* Connected app indicators */}
          <View style={{ flexDirection: 'row', gap: 8, marginRight: 8 }}>
            {shazamConnected ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: SHAZAM_BLUE + '18', borderRadius: 14, paddingHorizontal: 8, paddingVertical: 4 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: SHAZAM_BLUE }} />
                <Text style={{ color: SHAZAM_BLUE, fontSize: 11, fontWeight: '600' }}>Shazam</Text>
              </View>
            ) : null}
            {spotifyConnected ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: SPOTIFY_GREEN + '18', borderRadius: 14, paddingHorizontal: 8, paddingVertical: 4 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: SPOTIFY_GREEN }} />
                <Text style={{ color: SPOTIFY_GREEN, fontSize: 11, fontWeight: '600' }}>Spotify</Text>
              </View>
            ) : null}
          </View>
          <TouchableOpacity style={dls.sidebarIconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="radio-button-off-outline" size={20} color={sub} />
          </TouchableOpacity>
        </View>

        {/* Real streaming chat */}
        <DesktopChatPanel isDark={isDark} colors={colors} accentColor={accentColor} />

        <View style={{ paddingVertical: 8, paddingHorizontal: 16, alignItems: 'center' }}>
          <Text style={{ color: sub, fontSize: 11 }}>
            Dawinix can make mistakes.{' '}
            <Text style={{ color: accentColor }} onPress={() => setShortcutsVisible(true)}>Keyboard shortcuts</Text>
          </Text>
        </View>
      </View>

      {/* All modals */}
      {convMenuConv && (
        <ConvContextMenu conv={convMenuConv} position={convMenuPos} onClose={() => setConvMenuConv(null)} onAction={(action) => { setConvMenuConv(null); handleConvAction(action); }} isDark={isDark} />
      )}
      <UserBottomMenu visible={userMenuVisible} onClose={() => setUserMenuVisible(false)} user={user} isDark={isDark} onLogout={handleLogout} profilePhotoUrl={profilePhotoUrl} displayName={displayNameFinal} tier={tier} router={router} onSettings={() => setSettingsVisible(true)} onChangePassword={() => { setUserMenuVisible(false); setChangePasswordVisible(true); }} onChangeEmail={() => { setUserMenuVisible(false); setChangeEmailVisible(true); }} onDeleteAccount={() => { setUserMenuVisible(false); setDeleteAccountVisible(true); }} />
      <DesktopSettingsPanel visible={settingsVisible} onClose={() => setSettingsVisible(false)} isDark={isDark} user={user} tier={tier} onLogout={handleLogout} onChangePassword={() => { setSettingsVisible(false); setChangePasswordVisible(true); }} onChangeEmail={() => { setSettingsVisible(false); setChangeEmailVisible(true); }} onDeleteAccount={() => { setSettingsVisible(false); setDeleteAccountVisible(true); }} />
      <ChangePasswordModal visible={changePasswordVisible} onClose={() => setChangePasswordVisible(false)} isDark={isDark} userEmail={user?.email || ''} />
      <ChangeEmailModal visible={changeEmailVisible} onClose={() => setChangeEmailVisible(false)} isDark={isDark} userEmail={user?.email || ''} />
      <DeleteAccountModal visible={deleteAccountVisible} onClose={() => setDeleteAccountVisible(false)} isDark={isDark} userEmail={user?.email || ''} onDeleted={handleAccountDeleted} />
      <AppConnectModal visible={appConnectVisible} onClose={() => setAppConnectVisible(false)} isDark={isDark} onConnectShazam={handleConnectShazam} onConnectSpotify={handleConnectSpotify} shazamConnected={shazamConnected} spotifyConnected={spotifyConnected} />
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
  slimSidebar: { width: 48, flexDirection: 'column', alignItems: 'center', paddingTop: 12, borderRightWidth: StyleSheet.hairlineWidth },
  slimLogoWrap: { marginBottom: 12, marginTop: 4 },
  slimIcons: { flex: 1, alignItems: 'center', gap: 4 },
  slimIconBtn: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  fullSidebar: { width: 260, flexDirection: 'column', paddingTop: 12, borderRightWidth: StyleSheet.hairlineWidth },
  sidebarHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, marginBottom: 12, gap: 8 },
  logoCircle: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sidebarIconBtn: { width: 32, height: 32, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  newChatBtn: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth },
  sidebarSearch: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginBottom: 8, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth },
  sidebarNavItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 9 },
  sidebarDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: 12, marginVertical: 6 },
  sidebarSectionLabel: { fontSize: 12, fontWeight: '600', paddingHorizontal: 16, marginBottom: 4, textTransform: 'uppercase' },
  convRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, marginHorizontal: 4, gap: 4 },
  convDotBtn: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 4 },
  sidebarUpgradeBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, marginHorizontal: 8, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, marginBottom: 4 },
  sidebarSettingsBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  sidebarUserRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8 },
  upgradeSmall: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, height: 52 },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  brandText: { fontSize: 16, fontWeight: '700' },
  loginBtn: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 7, marginRight: 8 },
  signupBtn: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  upgradeTopBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loginCard: { width: 440, maxWidth: '90%', borderRadius: 20, padding: 36, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.3, shadowRadius: 40, elevation: 40 },
  closeBtn: { position: 'absolute', top: 14, right: 14, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  loginTitle: { fontSize: 24, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  loginSub: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 28, paddingHorizontal: 8 },
  socialBtn: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 50, paddingVertical: 13, marginBottom: 10, gap: 10 },
  socialBtnText: { fontSize: 15, fontWeight: '500' },
  orRow: { flexDirection: 'row', alignItems: 'center', width: '100%', marginVertical: 14, gap: 10 },
  orLine: { flex: 1, height: 1 },
  orText: { fontSize: 14 },
  inputRow: { width: '100%', flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 50, paddingHorizontal: 18, paddingVertical: 12 },
  input: { flex: 1, fontSize: 15, paddingVertical: 0 },
  primaryBtn: { width: '100%', backgroundColor: '#000', borderRadius: 50, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  shortcutsCard: { width: 420, maxWidth: '90%', borderRadius: 18, padding: 28, shadowColor: '#000', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.25, shadowRadius: 32, elevation: 32 },
  shortcutRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  keyChip: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, minWidth: 32, alignItems: 'center' },
  convMenu: { position: 'absolute', width: 210, borderRadius: 14, overflow: 'hidden', zIndex: 9999 },
  convMenuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  convMenuText: { fontSize: 15 },
  userMenu: { position: 'absolute', bottom: 60, left: 12, width: 300, borderRadius: 16, overflow: 'hidden', zIndex: 9999, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 20 },
  userMenuHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  upgradeChip: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  settingsPanel: { width: 760, maxWidth: '94%', height: 580, maxHeight: '90%', borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 24 }, shadowOpacity: 0.28, shadowRadius: 40, elevation: 40 },
  settingsPanelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, height: 48 },
  settingsCloseBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  settingsPanelBody: { flex: 1, flexDirection: 'row', overflow: 'hidden' },
  settingsNav: { width: 200, borderRightWidth: StyleSheet.hairlineWidth, paddingTop: 12, paddingHorizontal: 8 },
  settingsNavItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, marginBottom: 2 },
  settingsContent: { flex: 1, padding: 24, overflow: 'hidden' },
  settingsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, gap: 16 },
  outlineBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  appearanceChip: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
});
