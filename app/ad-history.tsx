import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface AdEntry {
  id: string;
  name: string;
  iconBg: string;
  iconLetter: string;
  time: string;
  action: string;
}

const MOCK_AD_HISTORY: Array<{ group: string; items: AdEntry[] }> = [
  {
    group: 'Today',
    items: [
      { id: '1', name: 'Dev Mode', iconBg: '#6C6CF8', iconLetter: 'D', time: '3:42 AM', action: 'Viewed' },
    ],
  },
  {
    group: '3 days ago',
    items: [
      { id: '2', name: 'Time to Hire an App Developer', iconBg: '#1DBF73', iconLetter: 'fi', time: '8:30 AM', action: 'Viewed' },
    ],
  },
  {
    group: '4 days ago',
    items: [
      { id: '3', name: 'Try Zapier Free', iconBg: '#FF4F00', iconLetter: 'Z', time: '5:52 PM', action: 'Viewed' },
    ],
  },
  {
    group: 'Last week',
    items: [
      { id: '4', name: 'X-keys Gaming @ B&H', iconBg: '#CC0000', iconLetter: 'B', time: 'Apr 7, 2026 at 9:32 PM', action: 'Viewed' },
      { id: '5', name: 'Instrument OpenAI in 5 min', iconBg: '#FF6B35', iconLetter: 'I', time: 'Apr 4, 2026 at 7:03 PM', action: 'Viewed' },
    ],
  },
];

export default function AdHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const bg = '#000000';
  const cardBg = '#1C1C1E';
  const primaryText = '#FFFFFF';
  const secondaryText = '#8E8E93';
  const divider = 'rgba(255,255,255,0.08)';

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
    headerCard: {
      backgroundColor: cardBg, borderRadius: 16, margin: 16,
      padding: 20, alignItems: 'center',
    },
    iconBox: {
      width: 56, height: 56, borderRadius: 14, backgroundColor: '#3A3A3C',
      alignItems: 'center', justifyContent: 'center', marginBottom: 12,
    },
    headerTitle: { fontSize: 20, fontWeight: '700', color: primaryText, marginBottom: 8 },
    headerDesc: { fontSize: 14, color: secondaryText, textAlign: 'center', lineHeight: 20 },
    groupLabel: {
      fontSize: 13, color: secondaryText,
      marginHorizontal: 16, marginBottom: 8, marginTop: 16,
    },
    adCard: { backgroundColor: cardBg, borderRadius: 14, overflow: 'hidden', marginHorizontal: 16 },
    adRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: 14, paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: divider,
    },
    adRowLast: { borderBottomWidth: 0 },
    adIconCircle: {
      width: 44, height: 44, borderRadius: 22,
      alignItems: 'center', justifyContent: 'center', marginRight: 14,
    },
    adIconText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
    adInfo: { flex: 1 },
    adName: { fontSize: 16, color: primaryText, fontWeight: '500', marginBottom: 3 },
    adMeta: { fontSize: 13, color: secondaryText },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={18} color={primaryText} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}>
          <View style={styles.iconBox}>
            <Ionicons name="time-outline" size={28} color={primaryText} />
          </View>
          <Text style={styles.headerTitle}>Ad History</Text>
          <Text style={styles.headerDesc}>
            See the ads you've viewed or interacted with. You're always in control — you can clear your history at any time.
          </Text>
        </View>

        {MOCK_AD_HISTORY.map(group => (
          <View key={group.group}>
            <Text style={styles.groupLabel}>{group.group}</Text>
            <View style={styles.adCard}>
              {group.items.map((item, idx) => (
                <View
                  key={item.id}
                  style={[styles.adRow, idx === group.items.length - 1 && styles.adRowLast]}
                >
                  <View style={[styles.adIconCircle, { backgroundColor: item.iconBg }]}>
                    <Text style={styles.adIconText}>{item.iconLetter}</Text>
                  </View>
                  <View style={styles.adInfo}>
                    <Text style={styles.adName}>{item.name}</Text>
                    <Text style={styles.adMeta}>{item.time} {item.action}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ))}
        <View style={{ height: insets.bottom + 20 }} />
      </ScrollView>
    </View>
  );
}
