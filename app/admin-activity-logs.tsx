import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  RefreshControl,
  Dimensions,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '@/template';
import { getSupabaseClient } from '@/template';

interface ActivityLog {
  id: string;
  user_id?: string;
  action: string;
  action_type: string;
  details?: Record<string, any>;
  ip_address?: string;
  created_at: string;
  email?: string;
  username?: string;
}

interface RevenueDay {
  date: string;
  label: string;
  revenue: number;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const IS_DESKTOP = SCREEN_WIDTH >= 1024;
const IS_TABLET = SCREEN_WIDTH >= 768;

const ADMIN_EMAILS = ['berryxoe@gmail.com', 'newdawens@gmail.com', 'kontgithub@gmail.com'];

const ACTION_TYPE_COLORS: Record<string, string> = {
  auth: '#007AFF',
  message: '#34C759',
  subscription: '#FF9F0A',
  admin: '#FF453A',
  profile: '#BF5AF2',
  error: '#FF3B30',
  default: '#8E8E93',
};

const ACTION_TYPE_ICONS: Record<string, any> = {
  auth: 'log-in-outline',
  message: 'chatbubble-outline',
  subscription: 'card-outline',
  admin: 'shield-outline',
  profile: 'person-outline',
  error: 'warning-outline',
  default: 'ellipse-outline',
};

export default function AdminActivityLogsScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  const isAdmin = user?.email ? ADMIN_EMAILS.includes(user.email.toLowerCase()) : false;

  const [activeTab, setActiveTab] = useState<'logs' | 'analytics' | 'push'>('logs');
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [revenueData, setRevenueData] = useState<RevenueDay[]>([]);
  const [revenueLoading, setRevenueLoading] = useState(false);
  const [totalRevenue7d, setTotalRevenue7d] = useState(0);
  const [pushTitle, setPushTitle] = useState('');
  const [pushBody, setPushBody] = useState('');
  const [pushSending, setPushSending] = useState(false);
  const [pushSent, setPushSent] = useState(false);
  const analyticsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isAdmin) { router.replace('/home'); return; }
    loadLogs();
    loadRevenueAnalytics();
    analyticsIntervalRef.current = setInterval(() => { loadRevenueAnalytics(); }, 60000);
    return () => { if (analyticsIntervalRef.current) clearInterval(analyticsIntervalRef.current); };
  }, [isAdmin]);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('activity_logs')
        .select('id, user_id, action, action_type, details, ip_address, created_at')
        .order('created_at', { ascending: false })
        .limit(80);

      if (data) {
        const enriched: ActivityLog[] = await Promise.all(
          data.map(async (log) => {
            if (!log.user_id) return log;
            const { data: prof } = await supabase
              .from('user_profiles')
              .select('email, username')
              .eq('id', log.user_id)
              .single();
            return { ...log, email: prof?.email, username: prof?.username };
          })
        );
        setLogs(enriched);
      }
    } catch (_e) {}
    finally { setLoading(false); }
  }, [supabase]);

  const loadRevenueAnalytics = useCallback(async () => {
    setRevenueLoading(true);
    try {
      const days: RevenueDay[] = [];
      const now = new Date();
      for (let d = 6; d >= 0; d--) {
        const day = new Date(now);
        day.setDate(day.getDate() - d);
        const startISO = new Date(day.getFullYear(), day.getMonth(), day.getDate()).toISOString();
        const endISO = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).toISOString();
        const label = d === 0 ? 'Today' : d === 1 ? 'Yd' : day.toLocaleDateString(undefined, { weekday: 'short' });
        const { data } = await supabase
          .from('subscription_purchases')
          .select('gross_amount')
          .gte('created_at', startISO)
          .lt('created_at', endISO)
          .eq('status', 'active');
        const revenue = (data || []).reduce((sum: number, row: any) => sum + parseFloat(row.gross_amount || '0'), 0);
        days.push({ date: startISO, label, revenue });
      }
      setRevenueData(days);
      setTotalRevenue7d(days.reduce((sum, d) => sum + d.revenue, 0));
    } catch (_e) {}
    finally { setRevenueLoading(false); }
  }, [supabase]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([loadLogs(), loadRevenueAnalytics()]).finally(() => setRefreshing(false));
  }, [loadLogs, loadRevenueAnalytics]);

  const handleSendPush = useCallback(async () => {
    if (!pushTitle.trim() || !pushBody.trim()) {
      Alert.alert('Missing Fields', 'Please fill in both title and message.');
      return;
    }
    setPushSending(true);
    try {
      const { data: usersWithTokens } = await supabase
        .from('user_profiles')
        .select('id, push_token')
        .not('push_token', 'is', null);

      const tokens = (usersWithTokens || []).map((u: any) => u.push_token).filter(Boolean);
      if (tokens.length === 0) {
        Alert.alert('No Tokens', 'No users have push notification tokens registered.');
        setPushSending(false);
        return;
      }

      await supabase.functions.invoke('send-admin-email', {
        body: {
          pushNotification: true,
          title: pushTitle.trim(),
          body: pushBody.trim(),
          tokens,
        },
      });

      setPushSent(true);
      setPushTitle('');
      setPushBody('');
      setTimeout(() => setPushSent(false), 3500);
    } catch (e: any) {
      Alert.alert('Send Failed', e?.message || 'Could not send push notification.');
    } finally {
      setPushSending(false);
    }
  }, [pushTitle, pushBody, supabase]);

  const filteredLogs = logs.filter(log => {
    const matchType = filterType === 'all' || log.action_type === filterType;
    const q = searchQuery.toLowerCase();
    const matchSearch = !q ||
      (log.action || '').toLowerCase().includes(q) ||
      (log.email || '').toLowerCase().includes(q) ||
      (log.username || '').toLowerCase().includes(q) ||
      (log.action_type || '').toLowerCase().includes(q);
    return matchType && matchSearch;
  });

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) return 'Just now';
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffH = Math.floor(diffMin / 60);
      if (diffH < 24) return `${diffH}h ago`;
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch { return iso; }
  };

  if (!isAdmin) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '600' }}>Access Denied</Text>
      </View>
    );
  }

  const cardBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const inputBg = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)';
  const inputBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.09)';

  const ACTION_TYPES = ['all', 'auth', 'message', 'subscription', 'admin', 'profile', 'error'];

  const maxRevenue = Math.max(...revenueData.map(d => d.revenue), 1);

  const TABS = [
    { id: 'logs', label: 'Activity Logs', icon: 'list-outline' },
    { id: 'analytics', label: 'Analytics', icon: 'bar-chart-outline' },
    { id: 'push', label: 'Push Notify', icon: 'notifications-outline' },
  ] as const;

  return (
    <View style={[s.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: cardBorder }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.text }]}>Activity & Analytics</Text>
        <TouchableOpacity onPress={handleRefresh} style={s.refreshBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          {loading || revenueLoading
            ? <ActivityIndicator size="small" color={colors.primary} />
            : <Ionicons name="refresh-outline" size={20} color={colors.text} />}
        </TouchableOpacity>
      </View>

      {/* Tab bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ maxHeight: 50, flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8, alignItems: 'center' }}
      >
        {TABS.map(tab => {
          const active = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={[s.tab, {
                backgroundColor: active ? colors.primary : (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)'),
                borderColor: active ? colors.primary : 'transparent',
              }]}
              activeOpacity={0.75}
            >
              <Ionicons name={tab.icon as any} size={14} color={active ? '#FFF' : colors.textSecondary} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: active ? '#FFF' : colors.textSecondary, marginLeft: 5 }}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 32,
          maxWidth: IS_DESKTOP ? 960 : undefined,
          alignSelf: IS_DESKTOP ? 'center' : undefined,
          width: '100%',
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── ACTIVITY LOGS TAB ─────────────────────────────────────────────── */}
        {activeTab === 'logs' ? (
          <View>
            {/* Search bar */}
            <View style={[s.searchBar, { backgroundColor: inputBg, borderColor: inputBorder }]}>
              <Ionicons name="search" size={16} color={colors.textSecondary} />
              <TextInput
                style={{ flex: 1, color: colors.text, fontSize: 15, marginLeft: 8, paddingVertical: 0 }}
                placeholder="Search logs..."
                placeholderTextColor={colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                clearButtonMode="while-editing"
              />
              {searchQuery.length > 0 ? (
                <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Type filter chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }} contentContainerStyle={{ gap: 7 }}>
              {ACTION_TYPES.map(type => {
                const active = filterType === type;
                const color = ACTION_TYPE_COLORS[type] || ACTION_TYPE_COLORS.default;
                return (
                  <TouchableOpacity
                    key={type}
                    onPress={() => setFilterType(type)}
                    style={[s.chip, { backgroundColor: active ? color + '22' : inputBg, borderColor: active ? color : inputBorder }]}
                    activeOpacity={0.75}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: active ? color : colors.textSecondary, textTransform: 'capitalize' }}>{type}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 10 }}>
              {filteredLogs.length} log{filteredLogs.length !== 1 ? 's' : ''} {searchQuery ? `matching "${searchQuery}"` : ''}
            </Text>

            {loading ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 32 }} />
            ) : filteredLogs.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 48 }}>
                <Ionicons name="document-text-outline" size={48} color={colors.textSecondary} />
                <Text style={{ color: colors.textSecondary, fontSize: 16, marginTop: 14 }}>No activity logs found</Text>
              </View>
            ) : (
              <View style={[s.card, { backgroundColor: cardBg, borderColor: cardBorder, padding: 0, overflow: 'hidden' }]}>
                {filteredLogs.map((log, i) => {
                  const typeColor = ACTION_TYPE_COLORS[log.action_type] || ACTION_TYPE_COLORS.default;
                  const typeIcon = ACTION_TYPE_ICONS[log.action_type] || ACTION_TYPE_ICONS.default;
                  return (
                    <View
                      key={log.id}
                      style={[s.logRow, { borderBottomColor: cardBorder, borderBottomWidth: i < filteredLogs.length - 1 ? StyleSheet.hairlineWidth : 0 }]}
                    >
                      <View style={[s.logIcon, { backgroundColor: typeColor + '18' }]}>
                        <Ionicons name={typeIcon} size={16} color={typeColor} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
                          {log.action}
                        </Text>
                        {log.email ? (
                          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 1 }} numberOfLines={1}>
                            {log.username || log.email}
                          </Text>
                        ) : null}
                        {log.ip_address ? (
                          <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 1 }} numberOfLines={1}>
                            IP: {log.ip_address}
                          </Text>
                        ) : null}
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 4, marginLeft: 8 }}>
                        <View style={{ backgroundColor: typeColor + '18', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 }}>
                          <Text style={{ color: typeColor, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }}>{log.action_type}</Text>
                        </View>
                        <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{formatDate(log.created_at)}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        ) : null}

        {/* ── ANALYTICS TAB ───────────────────────────────────────────────── */}
        {activeTab === 'analytics' ? (
          <View>
            {/* Summary card */}
            <View style={[s.card, { backgroundColor: cardBg, borderColor: cardBorder, marginBottom: 16 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={[s.sectionTitle, { color: colors.text }]}>Revenue — Last 7 Days</Text>
                {revenueLoading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
              </View>
              <Text style={{ color: colors.primary, fontSize: 32, fontWeight: '800', marginBottom: 2 }}>
                ${totalRevenue7d.toFixed(2)}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Total gross revenue this week</Text>
            </View>

            {/* Bar chart */}
            <View style={[s.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <Text style={[s.sectionTitle, { color: colors.text, marginBottom: 20 }]}>Daily Revenue</Text>
              {revenueData.length === 0 ? (
                <ActivityIndicator color={colors.primary} style={{ marginVertical: 32 }} />
              ) : (
                <View>
                  {/* Bars */}
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: IS_DESKTOP ? 16 : 8, height: 160, paddingBottom: 0 }}>
                    {revenueData.map((day, i) => {
                      const barH = maxRevenue > 0 ? Math.max(4, (day.revenue / maxRevenue) * 140) : 4;
                      const isToday = day.label === 'Today';
                      const isMax = day.revenue === maxRevenue && day.revenue > 0;
                      return (
                        <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: 160 }}>
                          {/* Value label */}
                          {day.revenue > 0 ? (
                            <Text style={{ color: isMax ? colors.primary : colors.textSecondary, fontSize: 10, fontWeight: '700', marginBottom: 4 }}>
                              ${day.revenue >= 1000 ? `${(day.revenue / 1000).toFixed(1)}k` : day.revenue.toFixed(0)}
                            </Text>
                          ) : (
                            <Text style={{ color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)', fontSize: 10, marginBottom: 4 }}>—</Text>
                          )}
                          {/* Bar */}
                          <View
                            style={{
                              width: '100%',
                              height: barH,
                              borderRadius: 6,
                              backgroundColor: isMax
                                ? colors.primary
                                : isToday
                                  ? colors.primary + 'AA'
                                  : (isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.1)'),
                              minHeight: 4,
                            }}
                          />
                        </View>
                      );
                    })}
                  </View>
                  {/* X-axis labels */}
                  <View style={{ flexDirection: 'row', gap: IS_DESKTOP ? 16 : 8, marginTop: 8 }}>
                    {revenueData.map((day, i) => (
                      <Text
                        key={i}
                        style={{
                          flex: 1,
                          textAlign: 'center',
                          fontSize: 11,
                          fontWeight: day.label === 'Today' ? '700' : '500',
                          color: day.label === 'Today' ? colors.primary : colors.textSecondary,
                        }}
                      >
                        {day.label}
                      </Text>
                    ))}
                  </View>
                </View>
              )}
            </View>

            {/* Desktop: extra metrics grid */}
            {IS_DESKTOP || IS_TABLET ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 }}>
                {[
                  { label: 'Avg Daily Revenue', value: `$${(totalRevenue7d / 7).toFixed(2)}`, icon: 'trending-up', color: '#34C759' },
                  { label: 'Peak Day Revenue', value: `$${Math.max(...revenueData.map(d => d.revenue)).toFixed(2)}`, icon: 'trophy', color: '#FFD60A' },
                  { label: 'Revenue Days', value: `${revenueData.filter(d => d.revenue > 0).length} / 7`, icon: 'calendar', color: '#007AFF' },
                ].map((stat, si) => (
                  <View key={si} style={[s.card, { backgroundColor: cardBg, borderColor: cardBorder, flex: 1, minWidth: 160 }]}>
                    <View style={[s.statIcon, { backgroundColor: stat.color + '1A' }]}>
                      <Ionicons name={stat.icon as any} size={20} color={stat.color} />
                    </View>
                    <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700', marginTop: 10 }}>{stat.value}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 3 }}>{stat.label}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <TouchableOpacity
              style={[s.refreshStatsBtn, { borderColor: colors.primary + '55', backgroundColor: colors.primary + '12', marginTop: 16 }]}
              onPress={loadRevenueAnalytics}
              activeOpacity={0.75}
            >
              <Ionicons name="refresh" size={16} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600', marginLeft: 8 }}>Refresh Analytics</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ── PUSH NOTIFICATIONS TAB ─────────────────────────────────────── */}
        {activeTab === 'push' ? (
          <View style={[IS_DESKTOP ? { flexDirection: 'row', gap: 20 } : {}]}>
            <View style={[{ flex: IS_DESKTOP ? 1 : undefined }, s.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <Text style={[s.sectionTitle, { color: colors.text }]}>Push Notification Broadcast</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 18 }}>
                Send a push notification to all users who have granted notification permissions.
              </Text>

              <Text style={[s.label, { color: colors.textSecondary }]}>Notification Title</Text>
              <TextInput
                style={[s.input, { backgroundColor: inputBg, borderColor: inputBorder, color: colors.text }]}
                placeholder="e.g. New Feature Available!"
                placeholderTextColor={colors.textSecondary}
                value={pushTitle}
                onChangeText={setPushTitle}
                returnKeyType="next"
              />

              <Text style={[s.label, { color: colors.textSecondary }]}>Message</Text>
              <TextInput
                style={[s.textarea, { backgroundColor: inputBg, borderColor: inputBorder, color: colors.text }]}
                placeholder="Write your push notification message here..."
                placeholderTextColor={colors.textSecondary}
                value={pushBody}
                onChangeText={setPushBody}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
              />

              {/* Preview card */}
              {(pushTitle.trim() || pushBody.trim()) ? (
                <View style={{ backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7', borderRadius: 14, padding: 14, marginBottom: 16 }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Preview</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="notifications" size={20} color="#FFF" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>{pushTitle || 'Notification Title'}</Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }} numberOfLines={2}>{pushBody || 'Your message here...'}</Text>
                    </View>
                  </View>
                </View>
              ) : null}

              {pushSent ? (
                <View style={[s.successBanner, { backgroundColor: 'rgba(52,199,89,0.12)', borderColor: 'rgba(52,199,89,0.3)', marginBottom: 14 }]}>
                  <Ionicons name="checkmark-circle" size={18} color="#34C759" />
                  <Text style={{ color: '#34C759', fontSize: 14, fontWeight: '600', marginLeft: 8 }}>Push notification sent successfully!</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[s.sendBtn, { backgroundColor: '#BF5AF2', opacity: pushSending ? 0.7 : 1 }]}
                onPress={handleSendPush}
                disabled={pushSending}
                activeOpacity={0.8}
              >
                {pushSending ? (
                  <ActivityIndicator size="small" color="#FFF" style={{ marginRight: 8 }} />
                ) : (
                  <Ionicons name="notifications" size={16} color="#FFF" style={{ marginRight: 8 }} />
                )}
                <Text style={s.sendBtnText}>{pushSending ? 'Sending...' : 'Send Push Notification'}</Text>
              </TouchableOpacity>
            </View>

            {IS_DESKTOP ? (
              <View style={{ width: 280 }}>
                <View style={[s.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                  <Text style={[s.sectionTitle, { color: colors.text, fontSize: 14 }]}>Push Tips</Text>
                  {[
                    'Keep titles under 50 characters',
                    'Messages should be concise (1-2 sentences)',
                    'Personalize when possible',
                    'Avoid sending more than 1-2 per week',
                    'Always provide value in the notification',
                  ].map((tip, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 10 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#BF5AF2', marginTop: 6 }} />
                      <Text style={{ color: colors.textSecondary, fontSize: 13, flex: 1, lineHeight: 19 }}>{tip}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  refreshBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginVertical: 6,
  },
  card: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 4 },
  input: {
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 12,
  },
  textarea: {
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 16,
    minHeight: 110,
  },
  chip: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
  },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 50,
    paddingVertical: 15,
    marginTop: 4,
  },
  sendBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
    gap: 6,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  logIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshStatsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 50,
    paddingVertical: 13,
  },
});
