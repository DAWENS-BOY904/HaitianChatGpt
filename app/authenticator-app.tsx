import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Clipboard,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';

export default function AuthenticatorAppScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const supabase = getSupabaseClient();

  const [enabled, setEnabled] = useState(false);
  const [enabling, setEnabling] = useState(false);

  const bg = '#000000';
  const cardBg = '#1C1C1E';
  const primaryText = '#FFFFFF';
  const secondaryText = '#8E8E93';
  const divider = 'rgba(255,255,255,0.08)';

  const handleToggle = async (value: boolean) => {
    if (!value) {
      // Disable TOTP
      setEnabled(false);
      return;
    }
    // Enable: 3s delay then navigate to setup
    setEnabling(true);
    setEnabled(true);
    await new Promise(r => setTimeout(r, 3000));
    setEnabling(false);
    router.push('/mfa-totp-setup');
  };

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
      width: 34, height: 34, borderRadius: 17,
      backgroundColor: '#2C2C2E',
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
    hint: { fontSize: 13, color: secondaryText, marginTop: 8, marginHorizontal: 4, lineHeight: 18 },
    loadingOverlay: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)',
      alignItems: 'center', justifyContent: 'center',
    },
    loadingBox: {
      backgroundColor: '#2C2C2E', borderRadius: 16,
      padding: 28, alignItems: 'center', gap: 12,
    },
    loadingText: { fontSize: 15, color: primaryText },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={18} color={primaryText} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Authenticator app</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionLabel}>Get codes to verify logins</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Authenticator app</Text>
            <Switch
              value={enabled}
              onValueChange={handleToggle}
              trackColor={{ true: '#34C759', false: '#3A3A3C' }}
              thumbColor={Platform.OS === 'ios' ? undefined : '#FFFFFF'}
              disabled={enabling}
            />
          </View>
        </View>
        <Text style={styles.hint}>
          Use an authenticator app to generate one-time codes when you sign in. Turning this on will guide you through setup.
        </Text>
      </View>

      {enabling && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.loadingText}>Setting up authenticator...</Text>
          </View>
        </View>
      )}
    </View>
  );
}
