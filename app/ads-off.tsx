import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AdsOffScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const bg = '#000000';
  const primaryText = '#FFFFFF';
  const secondaryText = '#8E8E93';

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: bg },
    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingTop: insets.top + 12, paddingBottom: 12, paddingHorizontal: 16,
    },
    backBtn: {
      width: 34, height: 34, borderRadius: 17, backgroundColor: '#2C2C2E',
      alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { fontSize: 17, fontWeight: '600', color: primaryText, marginLeft: 12 },
    center: {
      flex: 1, alignItems: 'center', justifyContent: 'center',
      paddingHorizontal: 40, paddingBottom: 80,
    },
    icon: { marginBottom: 20 },
    title: { fontSize: 22, fontWeight: '700', color: primaryText, marginBottom: 12, textAlign: 'center' },
    desc: { fontSize: 15, color: secondaryText, textAlign: 'center', lineHeight: 22 },
    bottomBtn: {
      position: 'absolute', bottom: insets.bottom + 20,
      left: 20, right: 20,
      backgroundColor: '#FFFFFF', borderRadius: 50,
      paddingVertical: 16, alignItems: 'center',
    },
    bottomBtnText: { fontSize: 17, fontWeight: '700', color: '#000' },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={18} color={primaryText} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ads controls</Text>
      </View>

      <View style={styles.center}>
        <Ionicons name="eye-off-outline" size={56} color={secondaryText} style={styles.icon} />
        <Text style={styles.title}>Ads are off</Text>
        <Text style={styles.desc}>
          {"You're using Dawinix ad-free with reduced usage. Expand your access by upgrading your plan or turning on ads."}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.bottomBtn}
        onPress={() => router.push('/ads-controls')}
      >
        <Text style={styles.bottomBtnText}>Turn on ads</Text>
      </TouchableOpacity>
    </View>
  );
}
