import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useTheme } from '../hooks/useTheme';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CATEGORIES = [
  { id: 'responses', label: 'Responses', sub: 'Replies and AI answers' },
  { id: 'group_chats', label: 'Group chats', sub: 'Messages in group conversations' },
  { id: 'tasks', label: 'Tasks', sub: 'Task updates and reminders' },
  { id: 'projects', label: 'Projects', sub: 'Activity on your projects' },
  { id: 'recommendations', label: 'Recommendations', sub: 'Personalized suggestions' },
];

export default function NotificationsScreen() {
  const { isDark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // ── Theme tokens ──────────────────────────────────────────────────────────
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
      width: 34, height: 34, borderRadius: 17,
      backgroundColor: backBtnBg,
      alignItems: 'center', justifyContent: 'center', marginRight: 12,
    },
    headerTitle: { fontSize: 17, fontWeight: '600', color: primaryText },
    content: { paddingHorizontal: 16, paddingTop: 24 },
    sectionLabel: {
      fontSize: 13, color: secondaryText, fontWeight: '500',
      marginBottom: 8, marginLeft: 4,
    },
    hint: {
      fontSize: 13, color: secondaryText, lineHeight: 18,
      marginBottom: 24, marginTop: 8, marginLeft: 4, marginRight: 4,
    },
    card: {
      backgroundColor: cardBg,
      borderRadius: 14,
      overflow: 'hidden',
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
      paddingVertical: 15,
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: divider,
    },
    rowLast: { borderBottomWidth: 0 },
    rowLeft: { flex: 1, marginRight: 12 },
    rowLabel: { fontSize: 17, color: primaryText },
    rowSub: { fontSize: 13, color: secondaryText, marginTop: 2 },
  });

  const HeaderContent = () => (
    <>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={18} color={primaryText} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Notifications</Text>
    </>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
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

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={styles.sectionLabel}>Notification types</Text>
          <View style={styles.card}>
            {CATEGORIES.map((cat, idx) => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.row, idx === CATEGORIES.length - 1 && styles.rowLast]}
                onPress={() => router.push(`/notification-detail?category=${cat.id}`)}
                activeOpacity={0.6}
              >
                <View style={styles.rowLeft}>
                  <Text style={styles.rowLabel}>{cat.label}</Text>
                  <Text style={styles.rowSub}>{cat.sub}</Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color={secondaryText} />
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.hint}>
            Manage push and email notification preferences for each category individually.
          </Text>

          <View style={{ height: insets.bottom + 40 }} />
        </View>
      </ScrollView>
    </View>
  );
}
