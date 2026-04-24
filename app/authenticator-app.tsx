import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { useTheme } from '../hooks/useTheme';
import * as Clipboard from 'expo-clipboard';

export default function AuthenticatorAppScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const supabase = getSupabaseClient();
  const { isDark } = useTheme();

  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [enrolled, setEnrolled] = useState(false);
  const [screen, setScreen] = useState<'status' | 'setup' | 'verify'>('status');
  const [existingFactors, setExistingFactors] = useState<any[]>([]);
  const inputRef = useRef<TextInput>(null);

  // ── Theme tokens ──────────────────────────────────────────────────────────
  const bg = isDark ? '#000000' : '#F2F2F7';
  const cardBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const primaryText = isDark ? '#FFFFFF' : '#000000';
  const secondaryText = '#8E8E93';
  const divider = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const backBtnBg = isDark ? '#2C2C2E' : 'rgba(0,0,0,0.08)';
  const headerBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const actionBtnBg = isDark ? '#2C2C2E' : '#EBEBEB';
  const actionBtnBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  useEffect(() => {
    checkEnrollment();
  }, []);

  const checkEnrollment = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) return;
      const totpFactors = data?.totp || [];
      setExistingFactors(totpFactors);
      const verified = totpFactors.filter((f: any) => f.status === 'verified');
      setEnrolled(verified.length > 0);
    } catch (e) {
      console.log('MFA check error:', e);
    }
  };

  const handleStartSetup = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const unverified = existingFactors.filter((f: any) => f.status === 'unverified');
      for (const f of unverified) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `HaitianAI-${user.email?.split('@')[0] || 'user'}`,
      });

      if (error) {
        showAlert('Setup Error', error.message || 'Failed to start MFA setup');
        return;
      }

      if (data) {
        setFactorId(data.id);
        setQrCode(data.totp?.qr_code || null);
        setSecret(data.totp?.secret || null);
        setScreen('setup');
      }
    } catch (e: any) {
      showAlert('Error', e?.message || 'Failed to enroll TOTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!factorId || totpCode.length < 6) {
      showAlert('Error', 'Please enter the 6-digit code from your authenticator app');
      return;
    }
    setVerifying(true);
    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) {
        showAlert('Verification Error', challengeError.message || 'Failed to create challenge');
        return;
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: totpCode.trim(),
      });

      if (verifyError) {
        showAlert('Wrong Code', verifyError.message || 'Invalid code. Please try again.');
        setTotpCode('');
        return;
      }

      setEnrolled(true);
      setScreen('status');
      showAlert('Success', 'Authenticator app enabled! Your account is now protected with 2FA.');
      await checkEnrollment();
    } catch (e: any) {
      showAlert('Error', e?.message || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const handleDisable = () => {
    showAlert('Disable 2FA', 'Are you sure you want to disable your authenticator app?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disable', style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try {
            const verified = existingFactors.filter((f: any) => f.status === 'verified');
            for (const f of verified) {
              await supabase.auth.mfa.unenroll({ factorId: f.id });
            }
            setEnrolled(false);
            setFactorId(null);
            setQrCode(null);
            setSecret(null);
            setExistingFactors([]);
            showAlert('Disabled', 'Authenticator app has been disabled.');
          } catch (e: any) {
            showAlert('Error', e?.message || 'Failed to disable 2FA');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const copySecret = async () => {
    if (secret) {
      await Clipboard.setStringAsync(secret);
      showAlert('Copied', 'Secret key copied to clipboard');
    }
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: insets.top + 12,
      paddingBottom: 12,
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: headerBorder,
    },
    backBtn: {
      width: 34, height: 34, borderRadius: 17,
      backgroundColor: backBtnBg,
      alignItems: 'center', justifyContent: 'center', marginRight: 12,
    },
    headerTitle: { fontSize: 17, fontWeight: '600', color: primaryText },
    content: { paddingHorizontal: 16, paddingTop: 20 },
    sectionLabel: {
      fontSize: 13, color: secondaryText, fontWeight: '500',
      marginBottom: 8, marginLeft: 4, letterSpacing: 0.1,
    },
    card: {
      backgroundColor: cardBg, borderRadius: 14, overflow: 'hidden', marginBottom: 8,
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0 : 0.06, shadowRadius: 4, elevation: isDark ? 0 : 1,
    },
    row: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: 16, paddingHorizontal: 16,
    },
    rowLabel: { fontSize: 17, color: primaryText, fontWeight: '600' },
    rowSub: { fontSize: 13, color: secondaryText, marginTop: 2 },
    statusBadge: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
    statusText: { fontSize: 13, fontWeight: '700' },
    hint: {
      fontSize: 13, color: secondaryText,
      marginTop: 8, marginHorizontal: 4, lineHeight: 18, marginBottom: 4,
    },
    actionBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
      backgroundColor: actionBtnBg, borderRadius: 14,
      paddingVertical: 16, borderWidth: 1, borderColor: actionBtnBorder, marginTop: 10,
    },
    actionBtnText: { color: primaryText, fontSize: 16, fontWeight: '600' },
    cancelBtn: { alignItems: 'center', paddingVertical: 16, marginTop: 4 },
    cancelBtnText: { color: secondaryText, fontSize: 15 },
    setupHeader: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 16 },
    setupIconWrap: {
      width: 80, height: 80, borderRadius: 24,
      backgroundColor: isDark ? '#0A2A20' : '#D6F5EE',
      alignItems: 'center', justifyContent: 'center', marginBottom: 16,
    },
    setupTitle: { color: primaryText, fontSize: 22, fontWeight: '700', marginBottom: 10, textAlign: 'center' },
    setupSub: { color: secondaryText, fontSize: 14, textAlign: 'center', lineHeight: 22 },
    qrCard: {
      backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16,
      alignItems: 'center', marginBottom: 16,
      alignSelf: 'center', width: 220, height: 220,
    },
    qrImage: { width: 180, height: 180 },
    secretBox: {
      backgroundColor: cardBg, borderRadius: 14, padding: 14, marginBottom: 16,
    },
    secretLabel: { color: secondaryText, fontSize: 12, marginBottom: 8 },
    secretRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    secretText: {
      color: '#10A37F', fontSize: 14,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      flex: 1, letterSpacing: 1,
    },
    stepsBox: { backgroundColor: cardBg, borderRadius: 14, padding: 16, marginBottom: 20, gap: 12 },
    stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    stepNum: {
      width: 24, height: 24, borderRadius: 12,
      backgroundColor: 'rgba(10,163,127,0.2)',
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    stepNumText: { color: '#10A37F', fontSize: 13, fontWeight: '700' },
    stepText: { color: primaryText, fontSize: 14, flex: 1, lineHeight: 20 },
    codeInputBox: { alignItems: 'center', marginVertical: 24 },
    codeInput: {
      backgroundColor: cardBg, borderRadius: 16,
      paddingVertical: 20, paddingHorizontal: 24,
      fontSize: 36, fontWeight: '700', color: primaryText,
      letterSpacing: 12, width: 220,
      borderWidth: 1, borderColor: divider,
    },
    codeHint: { color: secondaryText, fontSize: 12, marginTop: 10 },
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.7)',
      alignItems: 'center', justifyContent: 'center',
    },
    loadingBox: {
      backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF', borderRadius: 20,
      padding: 32, alignItems: 'center', gap: 16, minWidth: 200,
    },
    loadingText: { fontSize: 15, color: primaryText },
  });

  const HeaderContent = () => (
    <>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={18} color={primaryText} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Authenticator App</Text>
    </>
  );

  return (
    <View style={styles.container}>
      {/* BlurView header on iOS */}
      {Platform.OS === 'ios' ? (
        <BlurView
          intensity={isDark ? 60 : 50}
          tint={isDark ? 'dark' : 'light'}
          style={[styles.header, { backgroundColor: 'transparent' }]}
        >
          <HeaderContent />
        </BlurView>
      ) : (
        <View style={[styles.header, { backgroundColor: bg }]}>
          <HeaderContent />
        </View>
      )}

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── STATUS SCREEN ── */}
        {screen === 'status' && (
          <>
            <Text style={styles.sectionLabel}>Two-Factor Authentication (2FA)</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>Authenticator App</Text>
                  <Text style={styles.rowSub}>{enrolled ? 'Active and protecting your account' : 'Not configured'}</Text>
                </View>
                <View style={[styles.statusBadge, {
                  backgroundColor: enrolled
                    ? (isDark ? '#1A3D20' : '#D4F5DC')
                    : (isDark ? '#3A2020' : '#FFE5E5'),
                }]}>
                  <Text style={[styles.statusText, { color: enrolled ? '#34C759' : '#FF453A' }]}>
                    {enrolled ? 'On' : 'Off'}
                  </Text>
                </View>
              </View>
            </View>
            <Text style={styles.hint}>
              Use an authenticator app (Google Authenticator, Authy, etc.) to generate one-time 6-digit codes when you sign in.
            </Text>

            {enrolled ? (
              <View style={{ gap: 10, marginTop: 10 }}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => { setTotpCode(''); setScreen('setup'); handleStartSetup(); }}
                  disabled={loading}
                >
                  <Ionicons name="refresh-outline" size={20} color={primaryText} />
                  <Text style={styles.actionBtnText}>Re-configure App</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, {
                    backgroundColor: isDark ? '#3A1A1A' : '#FFE5E5',
                    borderColor: isDark ? '#FF453A33' : '#FFCCCC',
                  }]}
                  onPress={handleDisable}
                  disabled={loading}
                >
                  <Ionicons name="shield-outline" size={20} color="#FF453A" />
                  <Text style={[styles.actionBtnText, { color: '#FF453A' }]}>Disable 2FA</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.actionBtn, {
                  backgroundColor: isDark ? '#10A37F22' : '#E8F7F3',
                  borderColor: isDark ? '#10A37F55' : '#A8DECE',
                }]}
                onPress={handleStartSetup}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#10A37F" />
                ) : (
                  <>
                    <Ionicons name="shield-checkmark-outline" size={20} color="#10A37F" />
                    <Text style={[styles.actionBtnText, { color: '#10A37F' }]}>Enable Authenticator App</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </>
        )}

        {/* ── SETUP SCREEN ── */}
        {screen === 'setup' && (
          <>
            <View style={styles.setupHeader}>
              <View style={styles.setupIconWrap}>
                <Ionicons name="scan-outline" size={36} color="#10A37F" />
              </View>
              <Text style={styles.setupTitle}>Scan QR Code</Text>
              <Text style={styles.setupSub}>
                Open your authenticator app and scan the QR code below, or enter the secret key manually.
              </Text>
            </View>

            {qrCode ? (
              <View style={styles.qrCard}>
                <Image source={{ uri: qrCode }} style={styles.qrImage} resizeMode="contain" />
              </View>
            ) : (
              <View style={[styles.qrCard, { justifyContent: 'center', alignItems: 'center', height: 220 }]}>
                <ActivityIndicator color="#10A37F" size="large" />
                <Text style={{ color: secondaryText, marginTop: 12, fontSize: 14 }}>Generating QR Code...</Text>
              </View>
            )}

            {secret && (
              <View style={styles.secretBox}>
                <Text style={styles.secretLabel}>Or enter key manually:</Text>
                <TouchableOpacity style={styles.secretRow} onPress={copySecret} activeOpacity={0.7}>
                  <Text style={styles.secretText} selectable>{secret}</Text>
                  <Ionicons name="copy-outline" size={18} color="#10A37F" />
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.stepsBox}>
              {[
                'Open Google Authenticator, Authy, or any TOTP app',
                'Tap "+" or "Add account"',
                'Scan the QR code above',
                'Enter the 6-digit code below',
              ].map((step, i) => (
                <View key={i} style={styles.stepRow}>
                  <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.actionBtn, { marginTop: 4 }]}
              onPress={() => { setScreen('verify'); setTimeout(() => inputRef.current?.focus(), 300); }}
            >
              <Ionicons name="arrow-forward" size={18} color={primaryText} />
              <Text style={styles.actionBtnText}>I have scanned the code</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setScreen('status')}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── VERIFY SCREEN ── */}
        {screen === 'verify' && (
          <>
            <View style={styles.setupHeader}>
              <View style={[styles.setupIconWrap, {
                backgroundColor: isDark ? '#1A2A40' : '#D6EEF9',
              }]}>
                <Ionicons name="keypad-outline" size={36} color="#5AC8FA" />
              </View>
              <Text style={styles.setupTitle}>Enter Verification Code</Text>
              <Text style={styles.setupSub}>
                Enter the 6-digit code from your authenticator app to complete setup.
              </Text>
            </View>

            <View style={styles.codeInputBox}>
              <TextInput
                ref={inputRef}
                style={styles.codeInput}
                value={totpCode}
                onChangeText={(t) => setTotpCode(t.replace(/[^0-9]/g, '').slice(0, 6))}
                keyboardType="number-pad"
                placeholder="000000"
                placeholderTextColor={secondaryText}
                maxLength={6}
                autoFocus
                textAlign="center"
              />
              <Text style={styles.codeHint}>Code refreshes every 30 seconds</Text>
            </View>

            <TouchableOpacity
              style={[styles.actionBtn, {
                backgroundColor: totpCode.length === 6 ? '#10A37F' : actionBtnBg,
              }]}
              onPress={handleVerify}
              disabled={verifying || totpCode.length < 6}
            >
              {verifying ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={20} color={totpCode.length === 6 ? '#FFF' : primaryText} />
                  <Text style={[styles.actionBtnText, totpCode.length === 6 && { color: '#FFF' }]}>Verify & Enable</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setScreen('setup')}>
              <Text style={styles.cancelBtnText}>Back to QR code</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: insets.bottom + 40 }} />
      </ScrollView>

      {loading && screen === 'status' && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={primaryText} />
            <Text style={styles.loadingText}>Setting up authenticator...</Text>
          </View>
        </View>
      )}
    </View>
  );
}
please connect this with a real authenticator expo or other please no demo connect all real; with real qr code for my app real authenticator please blur mode effect only real.
