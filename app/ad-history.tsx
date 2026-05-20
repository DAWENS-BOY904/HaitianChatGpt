import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/template';
import { getSupabaseClient } from '@/template';
import { useTheme } from '../hooks/useTheme';

interface SearchEntry {
  id: string;
  query: string;
  source: string;
  created_at: string;
}

interface GroupedEntries {
  group: string;
  items: SearchEntry[];
}

function groupByDate(entries: SearchEntry[]): GroupedEntries[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const threeDaysAgo = new Date(today.getTime() - 3 * 86400000);
  const lastWeek = new Date(today.getTime() - 7 * 86400000);
  const lastMonth = new Date(today.getTime() - 30 * 86400000);

  const groups: Record<string, SearchEntry[]> = {};

  for (const entry of entries) {
    const d = new Date(entry.created_at);
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    let label: string;

    if (day >= today) {
      label = 'Today';
    } else if (day >= yesterday) {
      label = 'Yesterday';
    } else if (day >= threeDaysAgo) {
      label = 'Previous 3 days';
    } else if (day >= lastWeek) {
      label = 'Last week';
    } else if (day >= lastMonth) {
      label = 'Last month';
    } else {
      label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }

    if (!groups[label]) groups[label] = [];
    groups[label].push(entry);
  }

  const order = ['Today', 'Yesterday', 'Previous 3 days', 'Last week', 'Last month'];
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
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
  return (
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  );
}

// Detect if a message looks like a web/AI search query
function isLikelySearch(content: string): boolean {
  if (!content) return false;
  const c = content.toLowerCase().trim();
  // Short questions, search-like phrases
  const searchPatterns = [
    /^(what|who|where|when|why|how|which|is|are|can|does|do|did|will|was|were|has|have)\s/i,
    /\?$/,
    /^search\s/i,
    /^find\s/i,
    /^look up\s/i,
    /^tell me about\s/i,
    /^show me\s/i,
    /^latest\s/i,
    /^news about\s/i,
    /^price of\s/i,
    /^weather\s/i,
    /^define\s/i,
    /^meaning of\s/i,
  ];
  return content.length <= 200 && searchPatterns.some(p => p.test(c));
}

const ICON_COLORS = ['#6C6CF8', '#1DBF73', '#FF4F00', '#CC0000', '#FF6B35', '#0A84FF', '#AF52DE', '#FF9500', '#34C759'];

const SOURCE_ICONS: Record<string, string> = {
  'web_search': 'globe-outline',
  'deep_research': 'search-circle-outline',
  'conversation': 'chatbubble-outline',
  'ai': 'sparkles-outline',
};

export default function AdHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const supabase = getSupabaseClient();

  const [groups, setGroups] = useState<GroupedEntries[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ── Theme tokens ──────────────────────────────────────────────────────────
  const bg = isDark ? '#000000' : '#F2F2F7';
  const cardBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const primaryText = isDark ? '#FFFFFF' : '#000000';
  const secondaryText = '#8E8E93';
  const divider = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const backBtnBg = isDark ? '#2C2C2E' : 'rgba(0,0,0,0.08)';
  const headerBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

  const loadHistory = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      // 1. Load from ad_history table (explicit ad searches)
      const { data: adData } = await supabase
        .from('ad_history')
        .select('id, query, source_name, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(200);

      // 2. Load real AI search queries from messages (user role, from their conversations)
      const { data: convData } = await supabase
        .from('conversations')
        .select('id')
        .eq('user_id', user.id)
        .limit(100);

      const convIds = (convData || []).map((c: any) => c.id);
      let messageEntries: SearchEntry[] = [];

      if (convIds.length > 0) {
        const { data: msgData } = await supabase
          .from('messages')
          .select('id, content, created_at, conversation_id')
          .in('conversation_id', convIds)
          .eq('role', 'user')
          .order('created_at', { ascending: false })
          .limit(300);

        messageEntries = (msgData || [])
          .filter((m: any) => isLikelySearch(m.content))
          .map((m: any) => ({
            id: `msg_${m.id}`,
            query: m.content.trim(),
            source: 'conversation',
            created_at: m.created_at,
          }));
      }

      // Combine and deduplicate
      const adEntries: SearchEntry[] = (adData || []).map((a: any) => ({
        id: a.id,
        query: a.query,
        source: a.source_name || 'web_search',
        created_at: a.created_at,
      }));

      const allEntries = [...adEntries, ...messageEntries];

      // Sort by date desc and deduplicate by query (keep latest)
      const seen = new Set<string>();
      const unique = allEntries
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .filter(e => {
          const key = e.query.toLowerCase().trim();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

      setGroups(groupByDate(unique));
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
  const getSourceIcon = (source: string): string => SOURCE_ICONS[source] || 'search-outline';

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: bg },
    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingTop: insets.top + 12, paddingBottom: 12, paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: headerBorder,
    },
    backBtn: {
      width: 34, height: 34, borderRadius: 17, backgroundColor: backBtnBg,
      alignItems: 'center', justifyContent: 'center', marginRight: 12,
    },
    headerTitle: { fontSize: 17, fontWeight: '600', color: primaryText },
    headerCard: {
      backgroundColor: cardBg, borderRadius: 16, margin: 16,
      padding: 20, alignItems: 'center',
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0 : 0.06, shadowRadius: 4, elevation: isDark ? 0 : 1,
    },
    iconBox: {
      width: 56, height: 56, borderRadius: 14,
      backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA',
      alignItems: 'center', justifyContent: 'center', marginBottom: 12,
    },
    headerCardTitle: { fontSize: 20, fontWeight: '700', color: primaryText, marginBottom: 8 },
    headerCardDesc: {
      fontSize: 14, color: secondaryText, textAlign: 'center', lineHeight: 20,
    },
    groupLabel: {
      fontSize: 12, color: secondaryText, fontWeight: '600',
      letterSpacing: 0.5,
      marginHorizontal: 16, marginBottom: 8, marginTop: 20,
    },
    adCard: {
      backgroundColor: cardBg, borderRadius: 14, overflow: 'hidden', marginHorizontal: 16,
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0 : 0.06, shadowRadius: 4, elevation: isDark ? 0 : 1,
    },
    adRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: 14, paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: divider,
    },
    adRowLast: { borderBottomWidth: 0 },
    adIconCircle: {
      width: 44, height: 44, borderRadius: 22,
      alignItems: 'center', justifyContent: 'center', marginRight: 14, flexShrink: 0,
    },
    adIconText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
    adInfo: { flex: 1, marginRight: 8 },
    adName: { fontSize: 15, color: primaryText, fontWeight: '500', marginBottom: 3 },
    adMeta: { fontSize: 12, color: secondaryText },
    sourceIcon: { opacity: 0.5 },
    emptyCenter: {
      alignItems: 'center', justifyContent: 'center',
      paddingHorizontal: 40, paddingVertical: 60,
    },
    iconCircle: {
      width: 70, height: 70, borderRadius: 35,
      backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA',
      alignItems: 'center', justifyContent: 'center', marginBottom: 18,
    },
    emptyTitle: { fontSize: 20, fontWeight: '700', color: primaryText, marginBottom: 10, textAlign: 'center' },
    emptyDesc: { fontSize: 15, color: secondaryText, textAlign: 'center', lineHeight: 22 },
  });

  const HeaderContent = () => (
    <>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={18} color={primaryText} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Search History</Text>
    </>
  );

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
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

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={secondaryText}
          />
        }
      >
        {/* Info card */}
        <View style={styles.headerCard}>
          <View style={styles.iconBox}>
            <Ionicons name="search-outline" size={28} color={primaryText} />
          </View>
          <Text style={styles.headerCardTitle}>AI Search History</Text>
          <Text style={styles.headerCardDesc}>
            Every search and question you've asked the AI appears here, grouped by date. You're always in control — clear your history at any time.
          </Text>
        </View>

        {loading ? (
          <View style={[styles.emptyCenter, { paddingVertical: 40 }]}>
            <ActivityIndicator color={secondaryText} />
          </View>
        ) : groups.length === 0 ? (
          <View style={styles.emptyCenter}>
            <View style={styles.iconCircle}>
              <Ionicons name="search-outline" size={32} color={secondaryText} />
            </View>
            <Text style={styles.emptyTitle}>No searches yet</Text>
            <Text style={styles.emptyDesc}>
              Your AI web searches and queries will appear here as you use the app.
            </Text>
          </View>
        ) : (
          groups.map(group => (
            <View key={group.group}>
              <Text style={styles.groupLabel}>{group.group.toUpperCase()}</Text>
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
                      <Text style={styles.adName} numberOfLines={2}>{item.query}</Text>
                      <Text style={styles.adMeta}>{formatTime(item.created_at)}</Text>
                    </View>
                    <Ionicons
                      name={getSourceIcon(item.source) as any}
                      size={16}
                      color={secondaryText}
                      style={styles.sourceIcon}
                    />
                  </View>
                ))}
              </View>
            </View>
          ))
        )}

        <View style={{ height: insets.bottom + 40 }} />
      </ScrollView>
    </View>
  );
}
