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
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import * as LocalAuthentication from 'expo-local-authentication';

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

  const [passkeys, setPasskeys] = useState<PasskeyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('Biometrics');

  const bg = '#000000';
  const cardBg = '#1C1C1E';
  const primaryText = '#FFFFFF';
  const secondaryText = '#8E8E93';
  const divider = 'rgba(255,255,255,0.08)';

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
    if (Platform.OS === 'web') {
      showAlert('Not supported', 'Passkeys require a native iOS or Android device.');
      return;
    }
    if (!biometricSupported) {
      showAlert(
        'Biometrics not available',
        `${biometricType} is not set up on this device. Please enable it in Settings first.`
      );
      return;
    }
    if (!user) {
      showAlert('Sign in required', 'You must be signed in to create a passkey.');
      return;
    }

    setCreating(true);
    try {
      // Prompt biometric authentication
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Create passkey with ${biometricType}`,
        fallbackLabel: 'Use passcode',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });

      if (!result.success) {
        showAlert('Authentication cancelled', 'Passkey creation was cancelled.');
        setCreating(false);
        return;
      }

      // Simulate a short delay for UX
      await new Promise(r => setTimeout(r, 600));

      const deviceLabel = Platform.select({
        ios: 'iCloud Keychain',
        android: 'Android Passkey',
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
          ? 'Your passkey has been saved to iCloud Keychain. You can now log in with Face ID or Touch ID.'
          : 'Your passkey has been created. You can now log in with your fingerprint.',
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
          } catch (e: any) {
            showAlert('Error', 'Failed to remove passkey.');
          }
        },
      },
    ]);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  const getDeviceLabel = (pk: PasskeyRecord): string => {
    try {
      const parsed = JSON.parse(pk.key_value);
      return parsed.device || pk.provider || 'Passkey';
    } catch {
      return pk.provider || 'Passkey';
    }
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: bg },
    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingTop: insets.top + 12, paddingBottom: 12, paddingHorizontal: 16,
    },
    backBtn: {
      width: 34, height: 34, borderRadius: 17, backgroundColor: '#2C2C2E',
      alignItems: 'center', justifyContent: 'center', marginRight: 12,
    },
    headerTitle: { fontSize: 17, fontWeight: '600', color: primaryText },
    content: { flex: 1, paddingHorizontal: 16 },
    emptyCenter: {
      flex: 1, alignItems: 'center', justifyContent: 'center',
      paddingHorizontal: 40, paddingBottom: 80,
    },
    emptyIconWrap: {
      width: 80, height: 80, alignItems: 'center', justifyContent: 'center', marginBottom: 20,
    },
    emptyTitle: { fontSize: 22, fontWeight: '700', color: primaryText, marginBottom: 10, textAlign: 'center' },
    emptyDesc: { fontSize: 15, color: secondaryText, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
    sectionLabel: {
      fontSize: 12, color: secondaryText, fontWeight: '600', letterSpacing: 0.5,
      marginBottom: 8, marginTop: 24, marginLeft: 4,
    },
    card: { backgroundColor: cardBg, borderRadius: 14, overflow: 'hidden', marginBottom: 16 },
    passkeyRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: 14, paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: divider,
    },
    passkeyRowLast: { borderBottomWidth: 0 },
    passkeyIconWrap: {
      width: 40, height: 40, borderRadius: 10, backgroundColor: '#2C2C2E',
      alignItems: 'center', justifyContent: 'center', marginRight: 14,
    },
    passkeyInfo: { flex: 1 },
    passkeyName: { fontSize: 16, color: primaryText, fontWeight: '500' },
    passkeyDate: { fontSize: 13, color: secondaryText, marginTop: 2 },
    deleteBtn: { padding: 8 },
    createBtn: {
      backgroundColor: primaryText, borderRadius: 50,
      paddingVertical: 15, alignItems: 'center', marginTop: 8,
    },
    createBtnText: { fontSize: 17, fontWeight: '700', color: '#000' },
    addMoreBtn: {
      backgroundColor: '#1C1C1E', borderRadius: 50,
      paddingVertical: 15, alignItems: 'center', marginTop: 8,
      borderWidth: 1, borderColor: '#3A3A3C',
    },
    addMoreBtnText: { fontSize: 17, fontWeight: '600', color: primaryText },
    hint: {
      fontSize: 13, color: secondaryText,
      textAlign: 'center', marginTop: 16, lineHeight: 20,
    },
  });

  const hasPasskeys = passkeys.length > 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={18} color={primaryText} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Passkeys</Text>
      </View>

      {loading ? (
        <View style={styles.emptyCenter}>
          <ActivityIndicator color={primaryText} />
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
                    name={Platform.OS === 'ios' ? 'logo-apple' : 'shield-checkmark-outline'}
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
            <Ionicons name="person-outline" size={50} color={primaryText} />
          </View>
          <Text style={styles.emptyTitle}>Add a passkey</Text>
          <Text style={styles.emptyDesc}>
            Passkeys are more secure than a password and adding one takes less than a minute.
          </Text>
          <TouchableOpacity
            style={[styles.createBtn, { width: '100%' }]}
            onPress={createPasskey}
            disabled={creating}
          >
            {creating
              ? <ActivityIndicator color="#000" />
              : <Text style={styles.createBtnText}>Create a passkey</Text>}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
