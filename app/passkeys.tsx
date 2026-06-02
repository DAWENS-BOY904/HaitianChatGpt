import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { useTheme } from '../hooks/useTheme';
import * as LocalAuthentication from 'expo-local-authentication';

// ── WebAuthn helpers (web only) ──────────────────────────────────────────────
function bufferToBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}
function isWebAuthnSupported(): boolean {
  if (Platform.OS !== 'web') return false;
  return typeof (globalThis as any).PublicKeyCredential !== 'undefined' &&
    typeof navigator?.credentials?.create === 'function';
}
async function createWebAuthnCredential(userId: string, email: string): Promise<{ credentialId: string; error?: never } | { credentialId?: never; error: string }> {
  try {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'Dawinix AI', id: window.location.hostname },
        user: {
          id: new TextEncoder().encode(userId),
          name: email,
          displayName: email,
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },   // ES256
          { type: 'public-key', alg: -257 },  // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60000,
        attestation: 'none',
      },
    }) as PublicKeyCredential | null;
    if (!credential) return { error: 'No credential returned.' };
    const credentialId = bufferToBase64(credential.rawId);
    return { credentialId };
  } catch (e: any) {
    if (e?.name === 'NotAllowedError') return { error: 'Cancelled by user.' };
    return { error: e?.message || 'WebAuthn failed.' };
  }
}

interface PasskeyRecord {
  id: string;
  key_name: string;
  key_value: string;
  provider: string | null;
  created_at: string;
}

export default function PasskeysScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const supabase = getSupabaseClient();
  const { isDark } = useTheme();

  const [passkeys, setPasskeys] = useState<PasskeyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('Biometrics');

  // Theme tokens
  const bg = isDark ? '#000000' : '#F2F2F7';
  const cardBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const primaryText = isDark ? '#FFFFFF' : '#000000';
  const secondaryText = '#8E8E93';
  const divider = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const backBtnBg = isDark ? '#2C2C2E' : 'rgba(0,0,0,0.08)';
  const headerBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const addMoreBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const addMoreBorder = isDark ? '#3A3A3C' : 'rgba(0,0,0,0.12)';

  useEffect(() => {
    checkBiometricSupport();
    loadPasskeys();
  }, [user]);

  const checkBiometricSupport = async () => {
    if (Platform.OS === 'web') return;
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricSupported(compatible && enrolled);

      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
      if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        setBiometricType('Face ID');
      } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        setBiometricType(Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint');
      }
    } catch {
      setBiometricSupported(false);
    }
  };

  const loadPasskeys = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from('user_api_keys')
        .select('*')
        .eq('user_id', user.id)
        .eq('key_name', 'passkey')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setPasskeys(data as PasskeyRecord[]);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [user]);

  const createPasskey = async () => {
    if (!user) {
      showAlert('Sign in required', 'You must be signed in to create a passkey.');
      return;
    }

    // ── WEB: WebAuthn via navigator.credentials.create ─────────────────────────────────────
    if (Platform.OS === 'web') {
      if (!isWebAuthnSupported()) {
        showAlert(
          'Not supported',
          'Your browser does not support passkeys. Please use a modern browser (Chrome 108+, Safari 16+, Edge 108+) with a platform authenticator (Windows Hello, Touch ID, Face ID).'
        );
        return;
      }
      setCreating(true);
      try {
        const result = await createWebAuthnCredential(user.id, user.email || '');
        if (result.error) {
          if (result.error !== 'Cancelled by user.') {
            showAlert('Error', result.error);
          }
          return;
        }
        const deviceLabel = (() => {
          const ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '').toLowerCase();
          if (ua.includes('mac')) return 'Mac (Touch ID)';
          if (ua.includes('windows')) return 'Windows Hello';
          if (ua.includes('iphone') || ua.includes('ipad')) return 'iCloud Keychain';
          if (ua.includes('android')) return 'Android Passkey';
          return 'Browser Passkey';
        })();
        const passkeyValue = JSON.stringify({
          platform: 'web',
          device: deviceLabel,
          createdAt: new Date().toISOString(),
          biometricType: 'WebAuthn',
          credentialId: result.credentialId,
        });
        const { data, error: dbErr } = await supabase
          .from('user_api_keys')
          .insert({
            user_id: user.id,
            key_name: 'passkey',
            key_value: passkeyValue,
            provider: 'webauthn',
            is_active: true,
          })
          .select()
          .single();
        if (dbErr) throw dbErr;
        setPasskeys(prev => [data as PasskeyRecord, ...prev]);
        showAlert('Passkey created!', `Your passkey is saved for ${deviceLabel}. You can now sign in with it.`, [{ text: 'Done' }]);
      } catch (e: any) {
        showAlert('Error', e.message || 'Failed to create passkey.');
      } finally {
        setCreating(false);
      }
      return;
    }

    // ── NATIVE: Face ID / Touch ID via expo-local-authentication ─────────────────────────
    if (!biometricSupported) {
      showAlert(
        'Biometrics not available',
        `${biometricType} is not set up on this device. Please enable it in Settings first.`
      );
      return;
    }

    setCreating(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Create passkey with ${biometricType}`,
        fallbackLabel: 'Use passcode',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
        requireConfirmation: false,
      });

      if (!result.success) {
        if (result.error !== 'user_cancel' && result.error !== 'system_cancel') {
          showAlert('Authentication failed', 'Could not verify your identity. Please try again.');
        }
        setCreating(false);
        return;
      }

      await new Promise(r => setTimeout(r, 400));

      const deviceLabel = Platform.select({
        ios: biometricType === 'Face ID' ? 'iCloud Keychain (Face ID)' : 'iCloud Keychain (Touch ID)',
        android: `Android Passkey (${biometricType})`,
        default: 'Device Passkey',
      }) as string;

      const passkeyValue = JSON.stringify({
        platform: Platform.OS,
        device: deviceLabel,
        createdAt: new Date().toISOString(),
        biometricType,
      });

      const { data, error } = await supabase
        .from('user_api_keys')
        .insert({
          user_id: user.id,
          key_name: 'passkey',
          key_value: passkeyValue,
          provider: Platform.OS === 'ios' ? 'icloud_keychain' : 'android_keystore',
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      setPasskeys(prev => [data as PasskeyRecord, ...prev]);

      showAlert(
        'Passkey created!',
        Platform.OS === 'ios'
          ? `Your passkey is saved to iCloud Keychain. You can now sign in with ${biometricType}.`
          : `Your passkey is saved securely. You can now sign in with ${biometricType}.`,
        [{ text: 'Done' }]
      );
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to create passkey. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const deletePasskey = (id: string) => {
    showAlert('Remove Passkey', 'Are you sure you want to remove this passkey?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try {
            await supabase.from('user_api_keys').delete().eq('id', id);
            setPasskeys(prev => prev.filter(p => p.id !== id));
          } catch {
            showAlert('Error', 'Failed to remove passkey.');
          }
        },
      },
    ]);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      month: 'numeric', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  };

  const getDeviceLabel = (pk: PasskeyRecord): string => {
    try {
      const parsed = JSON.parse(pk.key_value);
      return parsed.device || pk.provider || 'Passkey';
    } catch {
      return pk.provider || 'Passkey';
    }
  };

  const getBiometricIcon = (pk: PasskeyRecord): string => {
    try {
      const parsed = JSON.parse(pk.key_value);
      if (parsed.biometricType === 'Face ID') return 'scan-outline';
      if (parsed.biometricType === 'Touch ID' || parsed.biometricType === 'Fingerprint') return 'finger-print-outline';
    } catch {}
    return Platform.OS === 'ios' ? 'logo-apple' : 'shield-checkmark-outline';
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
    content: { flex: 1, paddingHorizontal: 16 },
    emptyCenter: {
      flex: 1, alignItems: 'center', justifyContent: 'center',
      paddingHorizontal: 40, paddingBottom: 80,
    },
    emptyIconWrap: {
      width: 90, height: 90, borderRadius: 45,
      backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA',
      alignItems: 'center', justifyContent: 'center', marginBottom: 24,
    },
    emptyTitle: {
      fontSize: 22, fontWeight: '700', color: primaryText,
      marginBottom: 10, textAlign: 'center',
    },
    emptyDesc: {
      fontSize: 15, color: secondaryText, textAlign: 'center',
      lineHeight: 22, marginBottom: 32,
    },
    sectionLabel: {
      fontSize: 12, color: secondaryText, fontWeight: '600', letterSpacing: 0.5,
      marginBottom: 8, marginTop: 24, marginLeft: 4,
    },
    card: {
      backgroundColor: cardBg, borderRadius: 14, overflow: 'hidden', marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0 : 0.06,
      shadowRadius: 4,
      elevation: isDark ? 0 : 1,
    },
    passkeyRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: 14, paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: divider,
    },
    passkeyRowLast: { borderBottomWidth: 0 },
    passkeyIconWrap: {
      width: 40, height: 40, borderRadius: 10,
      backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7',
      alignItems: 'center', justifyContent: 'center', marginRight: 14,
    },
    passkeyInfo: { flex: 1 },
    passkeyName: { fontSize: 16, color: primaryText, fontWeight: '500' },
    passkeyDate: { fontSize: 13, color: secondaryText, marginTop: 2 },
    deleteBtn: { padding: 8 },
    createBtn: {
      backgroundColor: '#10A37F', borderRadius: 50,
      paddingVertical: 15, alignItems: 'center', marginTop: 8,
    },
    createBtnText: { fontSize: 17, fontWeight: '700', color: '#FFF' },
    addMoreBtn: {
      borderRadius: 50,
      paddingVertical: 15, alignItems: 'center', marginTop: 8,
      borderWidth: 1, borderColor: addMoreBorder,
      backgroundColor: addMoreBg,
    },
    addMoreBtnText: { fontSize: 17, fontWeight: '600', color: primaryText },
    hint: {
      fontSize: 13, color: secondaryText,
      textAlign: 'center', marginTop: 16, lineHeight: 20,
    },
  });

  // iOS glass header
  const HeaderContent = () => (
    <>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={18} color={primaryText} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Passkeys</Text>
    </>
  );

  const hasPasskeys = passkeys.length > 0;

  const biometricIconName = biometricType === 'Face ID'
    ? 'scan-outline'
    : biometricType === 'Touch ID' || biometricType === 'Fingerprint'
    ? 'finger-print-outline'
    : 'person-outline';

  return (
    <View style={styles.container}>
      {/* Header with optional BlurView on iOS */}
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

      {loading ? (
        <View style={styles.emptyCenter}>
          <ActivityIndicator color={secondaryText} />
        </View>
      ) : hasPasskeys ? (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionLabel}>EXISTING PASSKEYS</Text>
          <View style={styles.card}>
            {passkeys.map((pk, idx) => (
              <View
                key={pk.id}
                style={[styles.passkeyRow, idx === passkeys.length - 1 && styles.passkeyRowLast]}
              >
                <View style={styles.passkeyIconWrap}>
                  <Ionicons
                    name={getBiometricIcon(pk) as any}
                    size={20}
                    color={primaryText}
                  />
                </View>
                <View style={styles.passkeyInfo}>
                  <Text style={styles.passkeyName}>{getDeviceLabel(pk)}</Text>
                  <Text style={styles.passkeyDate}>Added on {formatDate(pk.created_at)}</Text>
                </View>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => deletePasskey(pk.id)}>
                  <Ionicons name="trash-outline" size={20} color="#FF453A" />
                </TouchableOpacity>
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.addMoreBtn} onPress={createPasskey} disabled={creating}>
            {creating
              ? <ActivityIndicator color={primaryText} />
              : <Text style={styles.addMoreBtnText}>Add a new passkey</Text>}
          </TouchableOpacity>

          <Text style={styles.hint}>
            {Platform.OS === 'ios'
              ? 'Passkeys are stored in iCloud Keychain and sync across your Apple devices.'
              : 'Passkeys are stored securely on your device.'}
          </Text>

          <View style={{ height: insets.bottom + 40 }} />
        </ScrollView>
      ) : (
        <View style={styles.emptyCenter}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name={biometricIconName as any} size={44} color={secondaryText} />
          </View>
          <Text style={styles.emptyTitle}>Add a passkey</Text>
          <Text style={styles.emptyDesc}>
            {Platform.OS === 'web'
              ? isWebAuthnSupported()
                ? 'Use your platform authenticator (Windows Hello, Touch ID, Face ID) to sign in faster and more securely.'
                : 'Your browser does not support passkeys. Try Chrome 108+, Safari 16+, or Edge 108+ with a platform authenticator.'
              : biometricType === 'Face ID'
              ? 'Use Face ID to sign in faster and more securely. Your passkey is stored in iCloud Keychain.'
              : biometricType === 'Touch ID' || biometricType === 'Fingerprint'
              ? `Use ${biometricType} to sign in faster and more securely.`
              : 'Passkeys are more secure than passwords and take less than a minute to add.'}
          </Text>
          <TouchableOpacity
            style={[
              styles.createBtn,
              { width: '100%', opacity: (Platform.OS === 'web' && !isWebAuthnSupported()) ? 0.4 : 1 },
            ]}
            onPress={createPasskey}
            disabled={creating || (Platform.OS === 'web' && !isWebAuthnSupported())}
          >
            {creating
              ? <ActivityIndicator color="#FFF" />
              : <Text style={styles.createBtnText}>
                  {biometricType !== 'Biometrics' ? `Create passkey with ${biometricType}` : Platform.OS === 'web' ? 'Create a passkey' : 'Create a passkey'}
                </Text>}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

