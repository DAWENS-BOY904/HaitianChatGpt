import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Platform,
  TextInput,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';

type Step = 'toggle' | 'phone' | 'verify';

export default function TextMessagesMFAScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const supabase = getSupabaseClient();

  const [enabled, setEnabled] = useState(false);
  const [step, setStep] = useState<Step>('toggle');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('United States (+1)');
  const [dialCode, setDialCode] = useState('+1');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendCount, setSendCount] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<any>(null);

  const bg = '#000000';
  const cardBg = '#1C1C1E';
  const primaryText = '#FFFFFF';
  const secondaryText = '#8E8E93';
  const accentBlue = '#4A90D9';

  useEffect(() => {
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); };
  }, []);

  const startCooldown = () => {
    setCooldown(30);
    cooldownRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) { clearInterval(cooldownRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleToggle = async (val: boolean) => {
    if (val) {
      // Show Apple Sign In prompt then go to phone step
      setEnabled(true);
      if (Platform.OS === 'ios') {
        try {
          const AppleAuthentication = require('expo-apple-authentication');
          const credential = await AppleAuthentication.signInAsync({
            requestedScopes: [
              AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
              AppleAuthentication.AppleAuthenticationScope.EMAIL,
            ],
          });
          if (credential.identityToken) {
            const { data, error } = await supabase.auth.signInWithIdToken({
              provider: 'apple',
              token: credential.identityToken,
            });
            if (!error) {
              setStep('phone');
              return;
            }
          }
        } catch (e: any) {
          if (e.code !== 'ERR_CANCELED') {
            showAlert('Apple Sign In failed', e.message || 'Please try again.');
          }
          setEnabled(false);
          return;
        }
      }
      setStep('phone');
    } else {
      setEnabled(false);
      setStep('toggle');
    }
  };

  const sendCode = async () => {
    if (!phone.trim()) {
      showAlert('Error', 'Please enter your phone number');
      return;
    }
    if (sendCount >= 3 && cooldown > 0) {
      showAlert('Wait', `Please wait ${cooldown}s before sending again.`);
      return;
    }
    if (sendCount >= 2) {
      startCooldown();
    }
    setLoading(true);
    try {
      const fullPhone = `${dialCode}${phone.replace(/\D/g, '')}`;
      const { error } = await supabase.auth.signInWithOtp({ phone: fullPhone });
      if (error) throw error;
      setSendCount(prev => prev + 1);
      setStep('verify');
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to send code');
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    if (cooldown > 0) {
      showAlert('Wait', `Please wait ${cooldown}s before resending.`);
      return;
    }
    if (sendCount >= 3) {
      startCooldown();
      showAlert('Limit reached', 'Please wait 30 seconds before sending again.');
      return;
    }
    await sendCode();
  };

  const verifyCode = async () => {
    if (!otp || otp.length < 6) {
      showAlert('Error', 'Please enter the 6-digit code');
      return;
    }
    setLoading(true);
    try {
      const fullPhone = `${dialCode}${phone.replace(/\D/g, '')}`;
      const { error } = await supabase.auth.verifyOtp({ phone: fullPhone, token: otp, type: 'sms' });
      if (error) throw error;
      if (user) {
        await supabase.from('security_settings').upsert({ user_id: user.id, mfa_enabled: true });
      }
      showAlert('Success', 'Phone number verified! Text message MFA is now enabled.', [
        { text: 'Done', onPress: () => router.replace('/security') },
      ]);
    } catch (e: any) {
      showAlert('Verification failed', e.message || 'Invalid code. Try again.');
    } finally {
      setLoading(false);
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
    content: { paddingHorizontal: 16, paddingTop: 20 },
    sectionLabel: { fontSize: 13, color: secondaryText, marginBottom: 8, marginLeft: 4 },
    card: { backgroundColor: cardBg, borderRadius: 14, overflow: 'hidden', marginBottom: 8 },
    row: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: 16, paddingHorizontal: 16,
    },
    rowLabel: { fontSize: 17, color: primaryText },
    hint: { fontSize: 13, color: secondaryText, marginTop: 8, marginHorizontal: 4, lineHeight: 18, marginBottom: 28 },
    // Phone step
    phoneTitle: { fontSize: 13, color: secondaryText, marginBottom: 12, marginLeft: 4 },
    countryBtn: {
      backgroundColor: cardBg, borderRadius: 12,
      paddingHorizontal: 16, paddingVertical: 14,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 12,
    },
    countryLabel: { fontSize: 12, color: secondaryText, marginBottom: 2 },
    countryValue: { fontSize: 16, color: primaryText },
    phoneInput: {
      backgroundColor: cardBg, borderRadius: 12,
      paddingHorizontal: 16, paddingVertical: 14,
      fontSize: 16, color: primaryText, marginBottom: 20,
    },
    sendBtn: {
      backgroundColor: '#3A3A3C', borderRadius: 50,
      paddingVertical: 15, alignItems: 'center', marginBottom: 12,
    },
    sendBtnActive: { backgroundColor: accentBlue },
    sendBtnText: { fontSize: 17, fontWeight: '600', color: primaryText },
    sendHint: { fontSize: 13, color: secondaryText, textAlign: 'center' },
    // Verify step
    verifyTitle: { fontSize: 13, color: secondaryText, marginBottom: 12, marginLeft: 4 },
    codeInput: {
      backgroundColor: cardBg, borderRadius: 12,
      paddingHorizontal: 16, paddingVertical: 14,
      fontSize: 24, color: primaryText, textAlign: 'center',
      letterSpacing: 8, marginBottom: 8,
    },
    sentHint: { fontSize: 13, color: secondaryText, marginBottom: 20, lineHeight: 18 },
    verifyBtn: {
      backgroundColor: '#3A3A3C', borderRadius: 50,
      paddingVertical: 15, alignItems: 'center', marginBottom: 16,
    },
    verifyBtnActive: { backgroundColor: accentBlue },
    verifyBtnText: { fontSize: 17, fontWeight: '600', color: primaryText },
    resendRow: { flexDirection: 'row', justifyContent: 'center', gap: 4 },
    resendLabel: { fontSize: 14, color: secondaryText },
    resendBtn: { fontSize: 14, color: accentBlue, fontWeight: '500' },
  });

  const title = step === 'verify' ? 'Phone Number Verification' : 'Text messages';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => {
          if (step === 'phone') { setStep('toggle'); setEnabled(false); }
          else if (step === 'verify') setStep('phone');
          else router.back();
        }}>
          <Ionicons name="chevron-back" size={18} color={primaryText} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
      </View>

      <View style={styles.content}>
        {step === 'toggle' && (
          <>
            <Text style={styles.sectionLabel}>Get codes to verify logins</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Text messages</Text>
                <Switch
                  value={enabled}
                  onValueChange={handleToggle}
                  trackColor={{ true: '#34C759', false: '#3A3A3C' }}
                  thumbColor={Platform.OS === 'ios' ? undefined : '#FFFFFF'}
                />
              </View>
            </View>
            <Text style={styles.hint}>
              Get 6-digit codes by SMS or WhatsApp based on your country code
            </Text>
          </>
        )}

        {step === 'phone' && (
          <>
            <Text style={styles.phoneTitle}>Add your phone number</Text>
            <TouchableOpacity style={styles.countryBtn} onPress={() => router.push('/phone-entry')}>
              <View>
                <Text style={styles.countryLabel}>Country/Region</Text>
                <Text style={styles.countryValue}>{country}</Text>
              </View>
              <Ionicons name="chevron-down" size={18} color={secondaryText} />
            </TouchableOpacity>
            <TextInput
              style={styles.phoneInput}
              value={phone}
              onChangeText={setPhone}
              placeholder="Phone number"
              placeholderTextColor="#555"
              keyboardType="phone-pad"
              autoFocus
            />
            <TouchableOpacity
              style={[styles.sendBtn, phone.length > 4 && styles.sendBtnActive]}
              onPress={sendCode}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={primaryText} />
                : <Text style={styles.sendBtnText}>Send code</Text>}
            </TouchableOpacity>
            <Text style={styles.sendHint}>{"We'll send a code to confirm it's really you"}</Text>
          </>
        )}

        {step === 'verify' && (
          <>
            <Text style={styles.verifyTitle}>Verify your phone number</Text>
            <TextInput
              style={styles.codeInput}
              value={otp}
              onChangeText={t => setOtp(t.replace(/\D/g, '').slice(0, 6))}
              placeholder="6-digit code"
              placeholderTextColor="#555"
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />
            <Text style={styles.sentHint}>
              Enter the 6-digit code we just sent to {dialCode} {phone} via SMS
            </Text>
            <TouchableOpacity
              style={[styles.verifyBtn, otp.length === 6 && styles.verifyBtnActive]}
              onPress={verifyCode}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={primaryText} />
                : <Text style={styles.verifyBtnText}>Verify</Text>}
            </TouchableOpacity>
            <View style={styles.resendRow}>
              <Text style={styles.resendLabel}>{"Didn't get a code?"}</Text>
              <TouchableOpacity onPress={resendCode} disabled={cooldown > 0}>
                <Text style={[styles.resendBtn, cooldown > 0 && { color: secondaryText }]}>
                  {cooldown > 0 ? `Send again (${cooldown}s)` : 'Send again'}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </View>
  );
}
