import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Clipboard,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import QRCode from 'react-native-qrcode-svg';

export default function MFATOTPSetupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const supabase = getSupabaseClient();

  const [secret, setSecret] = useState('');
  const [qrUri, setQrUri] = useState('');
  const [factorId, setFactorId] = useState('');
  const [code, setCode] = useState('');
  const [showQR, setShowQR] = useState(false);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [copied, setCopied] = useState(false);

  const bg = '#000000';
  const cardBg = '#1C1C1E';
  const primaryText = '#FFFFFF';
  const secondaryText = '#8E8E93';
  const accentBlue = '#4A90D9';

  useEffect(() => {
    enrollTOTP();
  }, []);

  const enrollTOTP = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
      if (error) throw error;
      setFactorId(data.id);
      setSecret(data.totp?.secret || '');
      setQrUri(data.totp?.uri || '');
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to set up authenticator');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const copySecret = () => {
    Clipboard.setString(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const verifyAndEnable = async () => {
    if (!code || code.length !== 6) {
      showAlert('Error', 'Please enter a 6-digit code');
      return;
    }
    if (!factorId) {
      showAlert('Error', 'Setup not complete. Please restart the setup.');
      return;
    }
    setVerifying(true);
    try {
      // Step 1: Create a challenge for this factor
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;

      // Step 2: Verify the challenge with the user's 6-digit TOTP code
      const { data: verifyData, error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: code.trim(),
      });
      if (verifyError) throw verifyError;

      // Step 3: Persist MFA enabled status in security_settings
      if (user) {
        await supabase.from('security_settings').upsert(
          { user_id: user.id, mfa_enabled: true },
          { onConflict: 'user_id' }
        );
      }

      showAlert(
        '✅ Authenticator Enabled',
        'Your account is now protected with two-factor authentication. Next time you log in, you will need to provide a code from your authenticator app.',
        [{ text: 'Done', onPress: () => router.replace('/security') }]
      );
    } catch (e: any) {
      const msg = e.message || 'Invalid code. Please check your authenticator app and try again.';
      showAlert('Verification Failed', msg);
    } finally {
      setVerifying(false);
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
    content: { paddingHorizontal: 20, paddingTop: 24 },
    desc: { fontSize: 15, color: primaryText, lineHeight: 22, marginBottom: 24 },
    secretBox: {
      backgroundColor: cardBg, borderRadius: 12,
      paddingHorizontal: 16, paddingVertical: 14,
      flexDirection: 'row', alignItems: 'center',
      marginBottom: 16,
    },
    secretText: { flex: 1, fontSize: 14, color: secondaryText, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', letterSpacing: 1 },
    copyIcon: { padding: 4 },
    copyBtn: {
      backgroundColor: accentBlue, borderRadius: 50,
      paddingVertical: 15, alignItems: 'center', marginBottom: 16,
    },
    copyBtnText: { fontSize: 17, fontWeight: '700', color: '#000' },
    switchLink: { alignItems: 'center', marginBottom: 28 },
    switchLinkText: { fontSize: 15, color: accentBlue, fontWeight: '500' },
    inputLabel: { fontSize: 15, color: primaryText, marginBottom: 8 },
    input: {
      backgroundColor: cardBg, borderRadius: 12,
      paddingHorizontal: 16, paddingVertical: 14,
      fontSize: 22, color: primaryText, textAlign: 'center',
      letterSpacing: 6, marginBottom: 20,
    },
    verifyBtn: {
      backgroundColor: accentBlue, borderRadius: 50,
      paddingVertical: 15, alignItems: 'center',
    },
    verifyBtnText: { fontSize: 17, fontWeight: '700', color: '#000' },
    qrContainer: { alignItems: 'center', marginBottom: 24 },
    qrImage: { width: 200, height: 200, borderRadius: 12, backgroundColor: '#1C1C1E' },
    loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  });

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={18} color={primaryText} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Authenticator app</Text>
        </View>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={primaryText} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={18} color={primaryText} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Authenticator app</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {!showQR ? (
          <>
            <Text style={styles.desc}>
              Copy this code into your authenticator app, then enter the 6-digit code it generates.
            </Text>

            <View style={styles.secretBox}>
              <Text style={styles.secretText} numberOfLines={2}>{secret}</Text>
              <TouchableOpacity style={styles.copyIcon} onPress={copySecret}>
                <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={20} color={secondaryText} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.copyBtn} onPress={copySecret}>
              <Text style={styles.copyBtnText}>{copied ? 'Copied!' : 'Copy code'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.switchLink} onPress={() => setShowQR(true)}>
              <Text style={styles.switchLinkText}>Use QR code instead</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.desc}>
              Scan the QR code using your authenticator app, then enter the 6-digit code from the app.
            </Text>

            <View style={styles.qrContainer}>
              {qrUri ? (
                <View style={[styles.qrImage, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#000000', padding: 12, borderRadius: 12 }]}>
                  <QRCode
                    value={qrUri}
                    size={176}
                    color="#FFFFFF"
                    backgroundColor="#000000"
                  />
                </View>
              ) : (
                <View style={[styles.qrImage, { alignItems: 'center', justifyContent: 'center' }]}>
                  <ActivityIndicator color={primaryText} />
                </View>
              )}
            </View>

            <TouchableOpacity style={styles.switchLink} onPress={() => setShowQR(false)}>
              <Text style={styles.switchLinkText}>Copy code instead</Text>
            </TouchableOpacity>
          </>
        )}

        <Text style={styles.inputLabel}>Enter 6-digit code</Text>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={t => setCode(t.replace(/\D/g, '').slice(0, 6))}
          placeholder="______"
          placeholderTextColor="#555"
          keyboardType="number-pad"
          maxLength={6}
        />

        <TouchableOpacity style={styles.verifyBtn} onPress={verifyAndEnable} disabled={verifying}>
          {verifying
            ? <ActivityIndicator color="#000" />
            : <Text style={styles.verifyBtnText}>Verify</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
