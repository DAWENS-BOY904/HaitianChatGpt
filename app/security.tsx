import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';

export default function SecurityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  const [totpStatus, setTotpStatus] = useState<'On' | 'Off' | null>(null);
  const [phoneStatus, setPhoneStatus] = useState<'On' | 'Off' | null>(null);
  const [loadingFactors, setLoadingFactors] = useState(true);

  useEffect(() => {
    loadMFAStatus();
  }, []);

  const loadMFAStatus = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error || !data) {
        setTotpStatus('Off');
        setPhoneStatus('Off');
        return;
      }
      const verified = (data.all || []).filter((f: any) => f.status === 'verified');
      const hasTotp = verified.some((f: any) => f.factor_type === 'totp');
      const hasPhone = verified.some((f: any) => f.factor_type === 'phone');
      setTotpStatus(hasTotp ? 'On' : 'Off');
      setPhoneStatus(hasPhone ? 'On' : 'Off');
    } catch {
      setTotpStatus('Off');
      setPhoneStatus('Off');
    } finally {
      setLoadingFactors(false);
    }
  };

  const bg = '#000000';
  const cardBg = '#1C1C1E';
  const primaryText = '#FFFFFF';
  const secondaryText = '#8E8E93';
  const divider = 'rgba(255,255,255,0.08)';

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: insets.top + 12,
      paddingBottom: 12,
      paddingHorizontal: 16,
    },
    backBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: '#2C2C2E',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    headerTitle: { fontSize: 17, fontWeight: '600', color: primaryText },
    content: { paddingHorizontal: 16, paddingTop: 20 },
    sectionLabel: {
      fontSize: 13,
      color: secondaryText,
      marginBottom: 8,
      marginLeft: 4,
    },
    card: { backgroundColor: cardBg, borderRadius: 14, overflow: 'hidden', marginBottom: 8 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 16,
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: divider,
    },
    rowLast: { borderBottomWidth: 0 },
    rowLabel: { fontSize: 17, color: primaryText },
    rowRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    rowValue: { fontSize: 15, color: secondaryText },
    mfaNote: {
      fontSize: 13,
      color: secondaryText,
      marginTop: 8,
      marginBottom: 24,
      marginHorizontal: 4,
      lineHeight: 18,
    },
    sectionLabelPasskey: {
      fontSize: 13,
      color: secondaryText,
      marginBottom: 8,
      marginLeft: 4,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={18} color={primaryText} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Security</Text>
      </View>

      <View style={styles.content}>
        {/* MFA Section */}
        <Text style={styles.sectionLabel}>Multi-factor Authentication (MFA)</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => router.push('/authenticator-app')}
          >
            <Text style={styles.rowLabel}>Authenticator app</Text>
            <View style={styles.rowRight}>
              {loadingFactors
                ? <ActivityIndicator size="small" color={secondaryText} style={{ marginRight: 4 }} />
                : <Text style={[styles.rowValue, totpStatus === 'On' && { color: '#34C759' }]}>{totpStatus ?? 'Off'}</Text>}
              <Ionicons name="chevron-forward" size={17} color={secondaryText} />
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.row, styles.rowLast]}
            onPress={() => router.push('/text-messages-mfa')}
          >
            <Text style={styles.rowLabel}>Text messages</Text>
            <View style={styles.rowRight}>
              {loadingFactors
                ? <ActivityIndicator size="small" color={secondaryText} style={{ marginRight: 4 }} />
                : <Text style={[styles.rowValue, phoneStatus === 'On' && { color: '#34C759' }]}>{phoneStatus ?? 'Off'}</Text>}
              <Ionicons name="chevron-forward" size={17} color={secondaryText} />
            </View>
          </TouchableOpacity>
        </View>

        <Text style={styles.mfaNote}>
          Require an extra security challenge when logging in. If you are unable to pass this challenge, you will have the option to recover your account via email.
        </Text>

        {/* Passkeys Section */}
        <Text style={styles.sectionLabelPasskey}>Passkeys</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={[styles.row, styles.rowLast]}
            onPress={() => router.push('/passkeys')}
          >
            <Text style={styles.rowLabel}>Passkeys</Text>
            <View style={styles.rowRight}>
              <Text style={styles.rowValue}>Add</Text>
              <Ionicons name="chevron-forward" size={17} color={secondaryText} />
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
mske white/dark them and blurrr effect mode.
