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

export default function AdInterestsScreen() {
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
    emptyCenter: {
      flex: 1, alignItems: 'center', justifyContent: 'center',
      paddingHorizontal: 40, paddingBottom: 60,
    },
    iconCircle: {
      width: 60, height: 60, borderRadius: 30, backgroundColor: '#2C2C2E',
      alignItems: 'center', justifyContent: 'center', marginBottom: 16,
    },
    emptyTitle: { fontSize: 20, fontWeight: '700', color: primaryText, marginBottom: 10 },
    emptyDesc: { fontSize: 15, color: secondaryText, textAlign: 'center', lineHeight: 22 },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={18} color={primaryText} />
        </TouchableOpacity>
      </View>
      <View style={styles.emptyCenter}>
        <View style={styles.iconCircle}>
          <Ionicons name="thumbs-up-outline" size={28} color={secondaryText} />
        </View>
        <Text style={styles.emptyTitle}>No Ad Interests</Text>
        <Text style={styles.emptyDesc}>
          As you interact and give feedback on ads, your interests will be saved here.
        </Text>
      </View>
    </View>
  );
}
