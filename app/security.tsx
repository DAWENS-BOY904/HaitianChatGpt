import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';
import { useTheme } from '../hooks/useTheme';

export default function SecurityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();
  const { isDark } = useTheme();

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

  const bg = isDark ? '#000000' : '#F2F2F7';
  const cardBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const primaryText = isDark ? '#FFFFFF' : '#000000';
  const secondaryText = '#8E8E93';
  const divider = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const backBtnBg = isDark ? '#2C2C2E' : 'rgba(0,0,0,0.08)';
  const headerBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

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
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: backBtnBg,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    headerTitle: { fontSize: 17, fontWeight: '600', color: primaryText },
    content: { paddingHorizontal: 16, paddingTop: 24 },
    sectionLabel: {
      fontSize: 13,
      fontWeight: '500',
      color: secondaryText,
      marginBottom: 8,
      marginLeft: 4,
      letterSpacing: 0.1,
    },
    card: {
      backgroundColor: cardBg,
      borderRadius: 14,
      overflow: 'hidden',
      marginBottom: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0 : 0.06,
      shadowRadius: 4,
      elevation: isDark ? 0 : 1,
    },
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
  });

  const CardRow = ({ label, value, isOn, loading, isLast, onPress }: {
    label: string; value: string | null; isOn?: boolean; loading?: boolean; isLast?: boolean; onPress: () => void;
  }) => {
    const rowStyle = [styles.row, isLast && styles.rowLast];

    if (Platform.OS === 'ios') {
      return (
        <TouchableOpacity style={rowStyle} onPress={onPress} activeOpacity={0.6}>
          <Text style={styles.rowLabel}>{label}</Text>
          <View style={styles.rowRight}>
            {loading
              ? <ActivityIndicator size="small" color={secondaryText} style={{ marginRight: 4 }} />
              : <Text style={[styles.rowValue, isOn && { color: '#34C759' }]}>{value ?? 'Off'}</Text>}
            <Ionicons name="chevron-forward" size={17} color={secondaryText} />
          </View>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity style={rowStyle} onPress={onPress} activeOpacity={0.6}>
        <Text style={styles.rowLabel}>{label}</Text>
        <View style={styles.rowRight}>
          {loading
            ? <ActivityIndicator size="small" color={secondaryText} style={{ marginRight: 4 }} />
            : <Text style={[styles.rowValue, isOn && { color: '#34C759' }]}>{value ?? 'Off'}</Text>}
          <Ionicons name="chevron-forward" size={17} color={secondaryText} />
        </View>
      </TouchableOpacity>
    );
  };

  // iOS glass header
  const HeaderContent = () => (
    <>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={18} color={primaryText} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Security</Text>
    </>
  );

  return (
    <View style={styles.container}>
      {/* Header with optional blur on iOS */}
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
        {/* MFA Section */}
        <Text style={styles.sectionLabel}>Multi-factor Authentication (MFA)</Text>
        <View style={styles.card}>
          <CardRow
            label="Authenticator app"
            value={totpStatus}
            isOn={totpStatus === 'On'}
            loading={loadingFactors}
            onPress={() => router.push('/authenticator-app')}
          />
          <CardRow
            label="Text messages"
            value={phoneStatus}
            isOn={phoneStatus === 'On'}
            loading={loadingFactors}
            isLast
            onPress={() => router.push('/text-messages-mfa')}
          />
        </View>

        <Text style={styles.mfaNote}>
          Require an extra security challenge when logging in. If you are unable to pass this challenge, you will have the option to recover your account via email.
        </Text>

        {/* Passkeys Section */}
        <Text style={styles.sectionLabel}>Passkeys</Text>
        <View style={styles.card}>
          <CardRow
            label="Passkeys"
            value="Add"
            isLast
            onPress={() => router.push('/passkeys')}
          />
        </View>
      </View>
    </View>
  );
}
