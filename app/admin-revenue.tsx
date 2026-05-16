import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '@/template';
import { getSupabaseClient } from '@/template';

const SCREEN_WIDTH = Dimensions.get('window').width;
const IS_DESKTOP = SCREEN_WIDTH >= 1024;
const IS_TABLET = SCREEN_WIDTH >= 768;

const ADMIN_EMAILS = ['berryxoe@gmail.com', 'newdawens@gmail.com', 'kontgithub@gmail.com'];

interface RevenueDay {
  date: string;
  label: string;
  revenue: number;
  purchases: number;
}

interface RevenueStats {
  totalRevenue: number;
  totalPurchases: number;
  averageOrderValue: number;
  activeSubscriptions: number;
  cancelledSubscriptions: number;
  netRevenue: number;
  platformFees: number;
  mrrEstimate: number;
}

interface PlanBreakdown {
  plan: string;
  count: number;
  revenue: number;
  color: string;
}

const PLAN_COLORS: Record<string, string> = {
  plus: '#FFD60A',
  pro: '#FF9F0A',
  annual: '#34C759',
  monthly: '#007AFF',
  free: '#8E8E93',
};

function getPlanColor(plan: string): string {
  const lower = (plan || '').toLowerCase();
  for (const key of Object.keys(PLAN_COLORS)) {
    if (lower.includes(key)) return PLAN_COLORS[key];
  }
  return '#5AC8FA';
}

export default function AdminRevenueScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  const isAdmin = user?.email ? ADMIN_EMAILS.includes(user.email.toLowerCase()) : false;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'daily' | 'plans'>('overview');
  const [stats, setStats] = useState<RevenueStats>({
    totalRevenue: 0, totalPurchases: 0, averageOrderValue: 0,
    activeSubscriptions: 0, cancelledSubscriptions: 0, netRevenue: 0,
    platformFees: 0, mrrEstimate: 0,
  });
  const [revenueByDay, setRevenueByDay] = useState<RevenueDay[]>([]);
  const [planBreakdown, setPlanBreakdown] = useState<PlanBreakdown[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isAdmin) { router.replace('/home'); return; }
    loadData();
    pollRef.current = setInterval(() => loadData(true), 60000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [isAdmin]);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      await Promise.all([loadStats(), loadDailyRevenue(), loadPlanBreakdown()]);
    } catch (_e) {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const [allPurchases, activeSubs, cancelledSubs] = await Promise.allSettled([
        supabase.from('subscription_purchases').select('gross_amount, platform_fee, net_amount, status'),
        supabase.from('subscription_purchases').select('id', { count: 'exact' }).eq('status', 'active'),
        supabase.from('subscription_purchases').select('id', { count: 'exact' }).eq('status', 'cancelled'),
      ]);

      if (allPurchases.status === 'fulfilled' && allPurchases.value.data) {
        const purchases = allPurchases.value.data;
        const totalRevenue = purchases.reduce((s: number, p: any) => s + parseFloat(p.gross_amount || '0'), 0);
        const totalFees = purchases.reduce((s: number, p: any) => s + parseFloat(p.platform_fee || '0'), 0);
        const netRevenue = purchases.reduce((s: number, p: any) => s + parseFloat(p.net_amount || '0'), 0);
        const aov = purchases.length > 0 ? totalRevenue / purchases.length : 0;

        setStats(prev => ({
          ...prev,
          totalRevenue,
          totalPurchases: purchases.length,
          averageOrderValue: aov,
          platformFees: totalFees,
          netRevenue,
          activeSubscriptions: activeSubs.status === 'fulfilled' ? (activeSubs.value.count || 0) : 0,
          cancelledSubscriptions: cancelledSubs.status === 'fulfilled' ? (cancelledSubs.value.count || 0) : 0,
          mrrEstimate: totalRevenue / Math.max(1, 12),
        }));
      }
    } catch (_e) {}
  }, [supabase]);

  const loadDailyRevenue = useCallback(async () => {
    try {
      const days: RevenueDay[] = [];
      const now = new Date();
      for (let d = 6; d >= 0; d--) {
        const day = new Date(now);
        day.setDate(day.getDate() - d);
        const start = new Date(day.getFullYear(), day.getMonth(), day.getDate()).toISOString();
        const end = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).toISOString();
        const label = d === 0 ? 'Today' : d === 1 ? 'Yd' : day.toLocaleDateString(undefined, { weekday: 'short' });
        const { data } = await supabase
          .from('subscription_purchases')
          .select('gross_amount')
          .gte('created_at', start)
          .lt('created_at', end);
        const revenue = (data || []).reduce((s: number, r: any) => s + parseFloat(r.gross_amount || '0'), 0);
        days.push({ date: start, label, revenue, purchases: (data || []).length });
      }
      setRevenueByDay(days);
    } catch (_e) {}
  }, [supabase]);

  const loadPlanBreakdown = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('subscription_purchases')
        .select('plan_id, gross_amount')
        .eq('status', 'active');
      if (!data) return;
      const planMap: Record<string, { count: number; revenue: number }> = {};
      data.forEach((p: any) => {
        const plan = p.plan_id || 'unknown';
        if (!planMap[plan]) planMap[plan] = { count: 0, revenue: 0 };
        planMap[plan].count++;
        planMap[plan].revenue += parseFloat(p.gross_amount || '0');
      });
      const breakdown: PlanBreakdown[] = Object.entries(planMap).map(([plan, vals]) => ({
        plan,
        count: vals.count,
        revenue: vals.revenue,
        color: getPlanColor(plan),
      })).sort((a, b) => b.revenue - a.revenue);
      setPlanBreakdown(breakdown);
    } catch (_e) {}
  }, [supabase]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  if (!isAdmin) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '600' }}>Access Denied</Text>
      </View>
    );
  }

  const cardBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  const maxRevenue = Math.max(...revenueByDay.map(d => d.revenue), 1);
  const totalWeekRevenue = revenueByDay.reduce((s, d) => s + d.revenue, 0);
  const totalPlanRevenue = planBreakdown.reduce((s, p) => s + p.revenue, 0);

  const TABS = [
    { id: 'overview', label: 'Overview', icon: 'stats-chart-outline' },
    { id: 'daily', label: '7-Day Chart', icon: 'bar-chart-outline' },
    { id: 'plans', label: 'Plans', icon: 'card-outline' },
  ] as const;

  const StatCard = ({ label, value, icon, color, sub }: {
    label: string; value: string; icon: any; color: string; sub?: string;
  }) => (
    <View style={[s.statCard, { backgroundColor: cardBg, borderColor: cardBorder, flex: IS_TABLET ? 1 : undefined, minWidth: IS_TABLET ? 160 : undefined }]}>
      <View style={[s.statIcon, { backgroundColor: color + '1A' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={[s.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[s.statLabel, { color: colors.text }]}>{label}</Text>
      {sub ? <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>{sub}</Text> : null}
    </View>
  );

  return (
    <View style={[s.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: cardBorder }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.text }]}>Revenue Analytics</Text>
        <TouchableOpacity onPress={handleRefresh} style={s.refreshBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          {loading && !refreshing
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
              <Text style={{ fontSize: 13, fontWeight: '600', color: active ? '#FFF' : colors.textSecondary, marginLeft: 5 }}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading && !refreshing ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.textSecondary, marginTop: 12, fontSize: 14 }}>Loading revenue data...</Text>
        </View>
      ) : (
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
        >

          {/* ── OVERVIEW TAB ─────────────────────────────────────────────── */}
          {activeTab === 'overview' ? (
            <View>
              {/* Hero card */}
              <View style={[s.heroCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <View style={[s.heroIcon, { backgroundColor: '#34C75922' }]}>
                    <Ionicons name="trending-up" size={22} color="#34C759" />
                  </View>
                  <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: '600' }}>Total Revenue</Text>
                </View>
                <Text style={{ color: colors.text, fontSize: 40, fontWeight: '800', letterSpacing: -1 }}>
                  ${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
                <View style={{ flexDirection: 'row', gap: 20, marginTop: 12 }}>
                  <View>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Net Revenue</Text>
                    <Text style={{ color: '#34C759', fontSize: 16, fontWeight: '700' }}>
                      ${stats.netRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                  </View>
                  <View>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Platform Fees</Text>
                    <Text style={{ color: '#FF453A', fontSize: 16, fontWeight: '700' }}>
                      -${stats.platformFees.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                  </View>
                  <View>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Est. MRR</Text>
                    <Text style={{ color: '#007AFF', fontSize: 16, fontWeight: '700' }}>
                      ${stats.mrrEstimate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Stat cards grid */}
              <View style={[IS_TABLET ? { flexDirection: 'row', flexWrap: 'wrap', gap: 12 } : { gap: 12 }]}>
                <StatCard label="Total Orders" value={stats.totalPurchases.toLocaleString()} icon="receipt-outline" color="#007AFF" sub="All time purchases" />
                <StatCard label="Avg Order Value" value={`$${stats.averageOrderValue.toFixed(2)}`} icon="cash-outline" color="#FF9F0A" sub="Per purchase" />
                <StatCard label="Active Subscriptions" value={stats.activeSubscriptions.toLocaleString()} icon="checkmark-circle-outline" color="#34C759" sub="Currently active" />
                <StatCard label="Cancelled" value={stats.cancelledSubscriptions.toLocaleString()} icon="close-circle-outline" color="#FF453A" sub="Total cancellations" />
              </View>

              {/* Revenue retention rate */}
              {stats.activeSubscriptions + stats.cancelledSubscriptions > 0 ? (
                <View style={[s.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                  <Text style={[s.sectionTitle, { color: colors.text }]}>Retention Rate</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 12 }}>
                    Active vs total subscriptions
                  </Text>
                  {(() => {
                    const total = stats.activeSubscriptions + stats.cancelledSubscriptions;
                    const pct = total > 0 ? Math.round((stats.activeSubscriptions / total) * 100) : 0;
                    return (
                      <>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <Text style={{ color: colors.text, fontSize: 28, fontWeight: '800' }}>{pct}%</Text>
                          <Text style={{ color: pct >= 70 ? '#34C759' : pct >= 50 ? '#FF9F0A' : '#FF453A', fontSize: 14, fontWeight: '700' }}>
                            {pct >= 70 ? 'Healthy' : pct >= 50 ? 'Moderate' : 'Needs Attention'}
                          </Text>
                        </View>
                        <View style={{ height: 8, borderRadius: 4, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)', overflow: 'hidden' }}>
                          <View style={{ height: '100%', borderRadius: 4, width: `${pct}%`, backgroundColor: pct >= 70 ? '#34C759' : pct >= 50 ? '#FF9F0A' : '#FF453A' }} />
                        </View>
                        <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 6 }}>
                          {stats.activeSubscriptions} active · {stats.cancelledSubscriptions} cancelled
                        </Text>
                      </>
                    );
                  })()}
                </View>
              ) : null}
            </View>
          ) : null}

          {/* ── DAILY CHART TAB ───────────────────────────────────────────── */}
          {activeTab === 'daily' ? (
            <View>
              {/* Weekly summary */}
              <View style={[s.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                <Text style={[s.sectionTitle, { color: colors.text }]}>Revenue This Week</Text>
                <Text style={{ color: colors.primary, fontSize: 36, fontWeight: '800', marginTop: 4 }}>
                  ${totalWeekRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>Last 7 days</Text>
              </View>

              {/* Bar chart */}
              <View style={[s.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                <Text style={[s.sectionTitle, { color: colors.text, marginBottom: 20 }]}>Daily Revenue Breakdown</Text>

                {revenueByDay.length === 0 ? (
                  <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                    <Ionicons name="bar-chart-outline" size={40} color={colors.textSecondary} />
                    <Text style={{ color: colors.textSecondary, marginTop: 12, fontSize: 14 }}>No revenue data found</Text>
                  </View>
                ) : (
                  <>
                    {/* Bars */}
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: IS_TABLET ? 16 : 8, height: 180, marginBottom: 2 }}>
                      {revenueByDay.map((day, i) => {
                        const barH = maxRevenue > 0 ? Math.max(4, (day.revenue / maxRevenue) * 160) : 4;
                        const isToday = day.label === 'Today';
                        const isMax = day.revenue === maxRevenue && day.revenue > 0;
                        return (
                          <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: 180 }}>
                            {day.revenue > 0 ? (
                              <Text style={{
                                color: isMax ? colors.primary : colors.textSecondary,
                                fontSize: 9,
                                fontWeight: '700',
                                marginBottom: 4,
                                textAlign: 'center',
                              }}>
                                ${day.revenue >= 1000 ? `${(day.revenue / 1000).toFixed(1)}k` : day.revenue.toFixed(0)}
                              </Text>
                            ) : (
                              <Text style={{ color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)', fontSize: 9, marginBottom: 4 }}>—</Text>
                            )}
                            <View
                              style={{
                                width: '100%',
                                height: barH,
                                borderRadius: 6,
                                backgroundColor: isMax
                                  ? colors.primary
                                  : isToday
                                    ? colors.primary + 'AA'
                                    : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'),
                                minHeight: 4,
                              }}
                            />
                          </View>
                        );
                      })}
                    </View>

                    {/* X-axis labels */}
                    <View style={{ flexDirection: 'row', gap: IS_TABLET ? 16 : 8, marginTop: 8 }}>
                      {revenueByDay.map((day, i) => (
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
                  </>
                )}
              </View>

              {/* Day-by-day table */}
              <View style={[s.card, { backgroundColor: cardBg, borderColor: cardBorder, padding: 0, overflow: 'hidden' }]}>
                <Text style={[s.sectionTitle, { color: colors.text, padding: 16, paddingBottom: 8 }]}>Daily Breakdown</Text>
                {revenueByDay.map((day, i) => (
                  <View
                    key={i}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 16,
                      paddingVertical: 13,
                      borderBottomWidth: i < revenueByDay.length - 1 ? StyleSheet.hairlineWidth : 0,
                      borderBottomColor: cardBorder,
                    }}
                  >
                    <View style={[s.dayIcon, {
                      backgroundColor: day.label === 'Today' ? colors.primary + '22' : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                    }]}>
                      <Ionicons
                        name={day.label === 'Today' ? 'today-outline' : 'calendar-outline'}
                        size={16}
                        color={day.label === 'Today' ? colors.primary : colors.textSecondary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{day.label}</Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 1 }}>
                        {day.purchases} purchase{day.purchases !== 1 ? 's' : ''}
                      </Text>
                    </View>
                    <Text style={{
                      color: day.revenue > 0 ? colors.text : colors.textSecondary,
                      fontSize: 16,
                      fontWeight: '700',
                    }}>
                      {day.revenue > 0 ? `$${day.revenue.toFixed(2)}` : '—'}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Desktop extra metrics */}
              {IS_TABLET || IS_DESKTOP ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 }}>
                  {[
                    { label: 'Avg Daily Revenue', value: `$${(totalWeekRevenue / 7).toFixed(2)}`, icon: 'trending-up', color: '#34C759' },
                    { label: 'Peak Day', value: `$${Math.max(...revenueByDay.map(d => d.revenue)).toFixed(2)}`, icon: 'trophy', color: '#FFD60A' },
                    { label: 'Revenue Days', value: `${revenueByDay.filter(d => d.revenue > 0).length} / 7`, icon: 'calendar', color: '#007AFF' },
                  ].map((stat, si) => (
                    <View key={si} style={[s.card, { backgroundColor: cardBg, borderColor: cardBorder, flex: 1, minWidth: 150 }]}>
                      <View style={[s.statIcon, { backgroundColor: stat.color + '1A' }]}>
                        <Ionicons name={stat.icon as any} size={20} color={stat.color} />
                      </View>
                      <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700', marginTop: 10 }}>{stat.value}</Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 3 }}>{stat.label}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          {/* ── PLANS TAB ─────────────────────────────────────────────────── */}
          {activeTab === 'plans' ? (
            <View>
              <View style={[s.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                <Text style={[s.sectionTitle, { color: colors.text }]}>Active Plan Revenue</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 16 }}>
                  Revenue breakdown by subscription plan
                </Text>

                {planBreakdown.length === 0 ? (
                  <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                    <Ionicons name="card-outline" size={40} color={colors.textSecondary} />
                    <Text style={{ color: colors.textSecondary, marginTop: 12, fontSize: 14 }}>No plan data available</Text>
                  </View>
                ) : (
                  <>
                    {/* Donut-style progress bars */}
                    {planBreakdown.map((plan, pi) => {
                      const pct = totalPlanRevenue > 0 ? Math.round((plan.revenue / totalPlanRevenue) * 100) : 0;
                      return (
                        <View key={pi} style={{ marginBottom: 16 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: plan.color }} />
                              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600', textTransform: 'capitalize' }}>
                                {plan.plan.replace(/_/g, ' ')}
                              </Text>
                              <View style={{ backgroundColor: plan.color + '22', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 }}>
                                <Text style={{ color: plan.color, fontSize: 11, fontWeight: '700' }}>{plan.count} subs</Text>
                              </View>
                            </View>
                            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
                              ${plan.revenue.toFixed(2)}
                            </Text>
                          </View>
                          <View style={{ height: 7, borderRadius: 4, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                            <View style={{ height: '100%', borderRadius: 4, width: `${pct}%`, backgroundColor: plan.color }} />
                          </View>
                          <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 3 }}>{pct}% of total</Text>
                        </View>
                      );
                    })}
                  </>
                )}
              </View>

              {/* Plan table */}
              {planBreakdown.length > 0 ? (
                <View style={[s.card, { backgroundColor: cardBg, borderColor: cardBorder, padding: 0, overflow: 'hidden' }]}>
                  {/* Header */}
                  <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: cardBorder, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}>
                    <Text style={{ flex: 2, color: colors.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }}>Plan</Text>
                    <Text style={{ flex: 1, color: colors.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', textAlign: 'center' }}>Subs</Text>
                    <Text style={{ flex: 1, color: colors.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', textAlign: 'right' }}>Revenue</Text>
                    <Text style={{ flex: 1, color: colors.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', textAlign: 'right' }}>Avg</Text>
                  </View>
                  {planBreakdown.map((plan, pi) => (
                    <View
                      key={pi}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 16,
                        paddingVertical: 13,
                        borderBottomWidth: pi < planBreakdown.length - 1 ? StyleSheet.hairlineWidth : 0,
                        borderBottomColor: cardBorder,
                        backgroundColor: pi % 2 === 1 ? (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)') : 'transparent',
                      }}
                    >
                      <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: plan.color }} />
                        <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600', textTransform: 'capitalize' }} numberOfLines={1}>
                          {plan.plan.replace(/_/g, ' ')}
                        </Text>
                      </View>
                      <Text style={{ flex: 1, color: colors.text, fontSize: 13, textAlign: 'center' }}>{plan.count}</Text>
                      <Text style={{ flex: 1, color: '#34C759', fontSize: 13, fontWeight: '700', textAlign: 'right' }}>
                        ${plan.revenue.toFixed(0)}
                      </Text>
                      <Text style={{ flex: 1, color: colors.textSecondary, fontSize: 13, textAlign: 'right' }}>
                        ${plan.count > 0 ? (plan.revenue / plan.count).toFixed(2) : '0.00'}
                      </Text>
                    </View>
                  ))}
                  {/* Totals row */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: cardBorder }}>
                    <Text style={{ flex: 2, color: colors.text, fontSize: 13, fontWeight: '800' }}>Total</Text>
                    <Text style={{ flex: 1, color: colors.text, fontSize: 13, fontWeight: '700', textAlign: 'center' }}>
                      {planBreakdown.reduce((s, p) => s + p.count, 0)}
                    </Text>
                    <Text style={{ flex: 1, color: '#34C759', fontSize: 13, fontWeight: '800', textAlign: 'right' }}>
                      ${totalPlanRevenue.toFixed(0)}
                    </Text>
                    <View style={{ flex: 1 }} />
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}
        </ScrollView>
      )}
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
  heroCard: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 22,
    marginBottom: 16,
  },
  heroIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  statCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    marginBottom: 12,
    gap: 8,
    alignItems: 'flex-start',
  },
  statIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 28, fontWeight: '700' },
  statLabel: { fontSize: 14, fontWeight: '600' },
  dayIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
});
