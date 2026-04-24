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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { useTheme } from '../hooks/useTheme';

type Step = 'toggle' | 'phone' | 'verify';

export default function TextMessagesMFAScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const supabase = getSupabaseClient();
  const { isDark } = useTheme();

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

  // Theme tokens
  const bg = isDark ? '#000000' : '#F2F2F7';
  const cardBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const primaryText = isDark ? '#FFFFFF' : '#000000';
  const secondaryText = '#8E8E93';
  const divider = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const backBtnBg = isDark ? '#2C2C2E' : 'rgba(0,0,0,0.08)';
  const headerBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const inputBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const inputBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const accentBlue = '#0A84FF';
  const switchTrackFalse = isDark ? '#3A3A3C' : '#E5E5EA';

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
      setEnabled(true);
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
      marginBottom: 8, marginLeft: 4,
    },
    card: {
      backgroundColor: cardBg, borderRadius: 14, overflow: 'hidden', marginBottom: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0 : 0.06,
      shadowRadius: 4,
      elevation: isDark ? 0 : 1,
    },
    row: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: 16, paddingHorizontal: 16,
    },
    rowLabel: { fontSize: 17, color: primaryText },
    hint: {
      fontSize: 13, color: secondaryText,
      marginTop: 8, marginHorizontal: 4, lineHeight: 18, marginBottom: 28,
    },
    phoneTitle: { fontSize: 13, color: secondaryText, fontWeight: '500', marginBottom: 12, marginLeft: 4 },
    countryBtn: {
      backgroundColor: cardBg, borderRadius: 12,
      paddingHorizontal: 16, paddingVertical: 14,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: inputBorder,
    },
    countryLabel: { fontSize: 12, color: secondaryText, marginBottom: 2 },
    countryValue: { fontSize: 16, color: primaryText },
    phoneInput: {
      backgroundColor: inputBg, borderRadius: 12,
      paddingHorizontal: 16, paddingVertical: 14,
      fontSize: 16, color: primaryText, marginBottom: 20,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: inputBorder,
    },
    sendBtn: {
      backgroundColor: isDark ? '#3A3A3C' : '#E5E5EA',
      borderRadius: 50,
      paddingVertical: 15, alignItems: 'center', marginBottom: 12,
    },
    sendBtnActive: { backgroundColor: accentBlue },
    sendBtnText: { fontSize: 17, fontWeight: '600', color: primaryText },
    sendBtnTextActive: { fontSize: 17, fontWeight: '600', color: '#FFFFFF' },
    sendHint: { fontSize: 13, color: secondaryText, textAlign: 'center' },
    verifyTitle: { fontSize: 13, color: secondaryText, fontWeight: '500', marginBottom: 12, marginLeft: 4 },
    codeInput: {
      backgroundColor: inputBg, borderRadius: 12,
      paddingHorizontal: 16, paddingVertical: 14,
      fontSize: 24, color: primaryText, textAlign: 'center',
      letterSpacing: 8, marginBottom: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: inputBorder,
    },
    sentHint: { fontSize: 13, color: secondaryText, marginBottom: 20, lineHeight: 18 },
    verifyBtn: {
      backgroundColor: isDark ? '#3A3A3C' : '#E5E5EA',
      borderRadius: 50,
      paddingVertical: 15, alignItems: 'center', marginBottom: 16,
    },
    verifyBtnActive: { backgroundColor: accentBlue },
    verifyBtnText: { fontSize: 17, fontWeight: '600', color: primaryText },
    verifyBtnTextActive: { fontSize: 17, fontWeight: '600', color: '#FFFFFF' },
    resendRow: { flexDirection: 'row', justifyContent: 'center', gap: 4 },
    resendLabel: { fontSize: 14, color: secondaryText },
    resendBtn: { fontSize: 14, color: accentBlue, fontWeight: '500' },
  });

  const title = step === 'verify' ? 'Phone Verification' : 'Text messages';

  const HeaderContent = () => (
    <>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => {
          if (step === 'phone') { setStep('toggle'); setEnabled(false); }
          else if (step === 'verify') setStep('phone');
          else router.back();
        }}
      >
        <Ionicons name="chevron-back" size={18} color={primaryText} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
    </>
  );

  return (
    <View style={styles.container}>
      {/* Header with BlurView on iOS */}
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
                  trackColor={{ true: '#34C759', false: switchTrackFalse }}
                  thumbColor={Platform.OS === 'ios' ? undefined : '#FFFFFF'}
                />
              </View>
            </View>
            <Text style={styles.hint}>
              Get 6-digit codes by SMS based on your country code to verify your identity when signing in.
            </Text>
          </>
        )}

        {step === 'phone' && (
          <>
            <Text style={styles.phoneTitle}>Add your phone number</Text>
            <TouchableOpacity style={styles.countryBtn} onPress={() => router.push('/phone-entry')}>
              <View>
                <Text style={styles.countryLabel}>Country / Region</Text>
                <Text style={styles.countryValue}>{country}</Text>
              </View>
              <Ionicons name="chevron-down" size={18} color={secondaryText} />
            </TouchableOpacity>
            <TextInput
              style={styles.phoneInput}
              value={phone}
              onChangeText={setPhone}
              placeholder="Phone number"
              placeholderTextColor={secondaryText}
              keyboardType="phone-pad"
              autoFocus
            />
            <TouchableOpacity
              style={[styles.sendBtn, phone.length > 4 && styles.sendBtnActive]}
              onPress={sendCode}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={phone.length > 4 ? '#FFFFFF' : primaryText} />
                : <Text style={phone.length > 4 ? styles.sendBtnTextActive : styles.sendBtnText}>Send code</Text>}
            </TouchableOpacity>
            <Text style={styles.sendHint}>{"We'll send a 6-digit code to confirm it's really you."}</Text>
          </>
        )}

        {step === 'verify' && (
          <>
            <Text style={styles.verifyTitle}>Verify your phone number</Text>
            <TextInput
              style={styles.codeInput}
              value={otp}
              onChangeText={t => setOtp(t.replace(/\D/g, '').slice(0, 6))}
              placeholder="------"
              placeholderTextColor={secondaryText}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />
            <Text style={styles.sentHint}>
              Enter the 6-digit code sent to {dialCode} {phone} via SMS.
            </Text>
            <TouchableOpacity
              style={[styles.verifyBtn, otp.length === 6 && styles.verifyBtnActive]}
              onPress={verifyCode}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={otp.length === 6 ? '#FFFFFF' : primaryText} />
                : <Text style={otp.length === 6 ? styles.verifyBtnTextActive : styles.verifyBtnText}>Verify</Text>}
            </TouchableOpacity>
            <View style={styles.resendRow}>
              <Text style={styles.resendLabel}>{"Didn't get a code?"}</Text>
              <TouchableOpacity onPress={resendCode} disabled={cooldown > 0}>
                <Text style={[styles.resendBtn, cooldown > 0 && { color: secondaryText }]}>
                  {cooldown > 0 ? ` Send again (${cooldown}s)` : ' Send again'}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </View>
  );
}
