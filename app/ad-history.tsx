import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/template';
import { getSupabaseClient } from '@/template';

interface AdEntry {
  id: string;
  query: string;
  source_icon: string | null;
  source_name: string | null;
  created_at: string;
}

interface GroupedEntries {
  group: string;
  items: AdEntry[];
}

function groupByDate(entries: AdEntry[]): GroupedEntries[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const threeDaysAgo = new Date(today.getTime() - 3 * 86400000);
  const lastWeek = new Date(today.getTime() - 7 * 86400000);

  const groups: Record<string, AdEntry[]> = {};

  for (const entry of entries) {
    const d = new Date(entry.created_at);
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    let label: string;

    if (day >= today) {
      label = 'Today';
    } else if (day >= yesterday) {
      label = 'Yesterday';
    } else if (day >= threeDaysAgo) {
      label = '3 days ago';
    } else if (day >= lastWeek) {
      label = 'Last week';
    } else {
      const diff = Math.floor((today.getTime() - day.getTime()) / 86400000);
      label = `${diff} days ago`;
    }

    if (!groups[label]) groups[label] = [];
    groups[label].push(entry);
  }

  const order = ['Today', 'Yesterday', '3 days ago', 'Last week'];
  const result: GroupedEntries[] = [];

  for (const key of order) {
    if (groups[key]) result.push({ group: key, items: groups[key] });
  }

  for (const key of Object.keys(groups)) {
    if (!order.includes(key)) result.push({ group: key, items: groups[key] });
  }

  return result;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const entryDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (entryDay >= today) {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) + ' Viewed';
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' at ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) + ' Viewed';
}

const ICON_COLORS = ['#6C6CF8', '#1DBF73', '#FF4F00', '#CC0000', '#FF6B35', '#0A84FF', '#AF52DE'];

export default function AdHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const supabase = getSupabaseClient();

  const [groups, setGroups] = useState<GroupedEntries[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const bg = '#000000';
  const cardBg = '#1C1C1E';
  const primaryText = '#FFFFFF';
  const secondaryText = '#8E8E93';
  const divider = 'rgba(255,255,255,0.08)';

  const loadHistory = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from('ad_history')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (!error && data) {
        setGroups(groupByDate(data as AdEntry[]));
      }
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadHistory();
  }, [loadHistory]);

  const getIconColor = (idx: number) => ICON_COLORS[idx % ICON_COLORS.length];

  const getInitial = (query: string) => (query?.[0] || 'Q').toUpperCase();

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

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primaryText} />}
      >
        <View style={styles.headerCard}>
          <View style={styles.iconBox}>
            <Ionicons name="time-outline" size={28} color={primaryText} />
          </View>
          <Text style={styles.headerTitle}>Ad History</Text>
          <Text style={styles.headerDesc}>
            See the ads you've viewed or interacted with. You're always in control — you can clear your history at any time.
          </Text>
        </View>

        {loading ? (
          <View style={[styles.emptyCenter, { flex: 0, paddingVertical: 40 }]}>
            <ActivityIndicator color={primaryText} />
          </View>
        ) : groups.length === 0 ? (
          <View style={styles.emptyCenter}>
            <View style={styles.iconCircle}>
              <Ionicons name="time-outline" size={28} color={secondaryText} />
            </View>
            <Text style={styles.emptyTitle}>No Ad History</Text>
            <Text style={styles.emptyDesc}>
              As you interact with AI web searches, your activity will appear here.
            </Text>
          </View>
        ) : (
          groups.map(group => (
            <View key={group.group}>
              <Text style={styles.groupLabel}>{group.group}</Text>
              <View style={styles.adCard}>
                {group.items.map((item, idx) => (
                  <View
                    key={item.id}
                    style={[styles.adRow, idx === group.items.length - 1 && styles.adRowLast]}
                  >
                    <View style={[styles.adIconCircle, { backgroundColor: getIconColor(idx) }]}>
                      <Text style={styles.adIconText}>{getInitial(item.query)}</Text>
                    </View>
                    <View style={styles.adInfo}>
                      <Text style={styles.adName} numberOfLines={1}>{item.query}</Text>
                      <Text style={styles.adMeta}>{formatTime(item.created_at)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ))
        )}

        <View style={{ height: insets.bottom + 20 }} />
      </ScrollView>
    </View>
  );
}
