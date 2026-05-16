import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '@/template';
import { getSupabaseClient } from '@/template';

interface AdminStats {
  totalUsers: number;
  activeToday: number;
  totalMessages: number;
  totalRevenue: number;
  proUsers: number;
  bugReports: number;
}

interface RecentUser {
  id: string;
  email: string;
  username?: string;
  created_at: string;
  subscription_tier?: string;
  role?: string;
}

export default function AdminDashboard() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    activeToday: 0,
    totalMessages: 0,
    totalRevenue: 0,
    proUsers: 0,
    bugReports: 0,
  });
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'revenue' | 'bugs'>('overview');

  const ADMIN_EMAILS = ['berryxoe@gmail.com', 'newdawens@gmail.com', 'kontgithub@gmail.com'];
  const isAdmin = user?.email ? ADMIN_EMAILS.includes(user.email.toLowerCase()) : false;

  useEffect(() => {
    if (!isAdmin) {
      router.replace('/home');
      return;
    }
    loadData();
  }, [isAdmin]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const [usersRes, messagesRes, bugsRes] = await Promise.allSettled([
        supabase.from('user_profiles').select('id, email, username, created_at, subscription_tier, role', { count: 'exact' }).order('created_at', { ascending: false }).limit(20),
        supabase.from('messages').select('id', { count: 'exact' }),
        supabase.from('bug_reports').select('id', { count: 'exact' }).eq('status', 'pending'),
      ]);

      if (usersRes.status === 'fulfilled' && usersRes.value.data) {
        const users = usersRes.value.data as RecentUser[];
        setRecentUsers(users.slice(0, 10));
        const proCount = users.filter(u => u.subscription_tier === 'plus' || u.subscription_tier === 'pro').length;
        setStats(prev => ({
          ...prev,
          totalUsers: usersRes.value.count || users.length,
          proUsers: proCount,
        }));
      }

      if (messagesRes.status === 'fulfilled') {
        setStats(prev => ({ ...prev, totalMessages: messagesRes.value.count || 0 }));
      }

      if (bugsRes.status === 'fulfilled') {
        setStats(prev => ({ ...prev, bugReports: bugsRes.value.count || 0 }));
      }
    } catch (e) {
      console.log('[Admin] loadData error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [supabase]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  if (!isAdmin) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '600' }}>Access Denied</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 8 }}>Admin access required</Text>
      </View>
    );
  }

  const StatCard = ({ label, value, icon, color, onPress }: { label: string; value: string | number; icon: any; color: string; onPress?: () => void }) => (
    <TouchableOpacity
      style={[styles.statCard, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1}
    >
      <View style={[styles.statIcon, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={[styles.statValue, { color: colors.text }]}>{typeof value === 'number' ? value.toLocaleString() : value}</Text>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
    </TouchableOpacity>
  );

  const MenuRow = ({ label, icon, color, onPress, badge }: { label: string; icon: any; color: string; onPress: () => void; badge?: number }) => (
    <TouchableOpacity
      style={[styles.menuRow, { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.menuIcon, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon} size={19} color={color} />
      </View>
      <Text style={[styles.menuLabel, { color: colors.text }]}>{label}</Text>
      {badge ? (
        <View style={[styles.badge, { backgroundColor: '#FF453A' }]}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} style={{ marginLeft: 'auto' }} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Admin Panel</Text>
        <TouchableOpacity onPress={handleRefresh} style={styles.refreshBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="refresh-outline" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Admin badge */}
          <View style={styles.adminBadgeRow}>
            <View style={[styles.adminBadge, { backgroundColor: isDark ? 'rgba(255,200,0,0.15)' : 'rgba(255,200,0,0.12)', borderColor: 'rgba(255,200,0,0.35)' }]}>
              <Ionicons name="shield-checkmark" size={14} color="#FFD60A" />
              <Text style={{ color: '#FFD60A', fontSize: 13, fontWeight: '700', marginLeft: 5 }}>Administrator</Text>
            </View>
            <Text style={[styles.adminEmail, { color: colors.textSecondary }]}>{user?.email}</Text>
          </View>

          {/* Stats Grid */}
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Overview</Text>
          <View style={styles.statsGrid}>
            <StatCard label="Total Users" value={stats.totalUsers} icon="people-outline" color="#007AFF" onPress={() => router.push('/admin-team' as any)} />
            <StatCard label="Pro Users" value={stats.proUsers} icon="star-outline" color="#FFD60A" />
            <StatCard label="Messages" value={stats.totalMessages} icon="chatbubbles-outline" color="#34C759" />
            <StatCard label="Bug Reports" value={stats.bugReports} icon="bug-outline" color="#FF453A" onPress={() => router.push('/bugreport' as any)} />
          </View>

          {/* Quick Actions */}
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Management</Text>
          <View style={[styles.menuSection, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
            <MenuRow label="User Management" icon="people-outline" color="#007AFF" onPress={() => router.push('/admin-team' as any)} />
            <MenuRow label="Revenue & Analytics" icon="bar-chart-outline" color="#34C759" onPress={() => router.push('/admin-revenue' as any)} />
            <MenuRow label="Send Email Broadcast" icon="mail-outline" color="#FF9F0A" onPress={() => router.push('/admin-email' as any)} />
            <MenuRow label="App Content" icon="document-text-outline" color="#5AC8FA" onPress={() => router.push('/admin-content' as any)} />
            <MenuRow label="Activity Logs" icon="list-outline" color="#BF5AF2" onPress={() => router.push('/admin-activity-logs' as any)} />
            <MenuRow label="API Keys" icon="key-outline" color="#FF6B35" onPress={() => router.push('/admin-api-keys' as any)} />
            <MenuRow label="Payout Management" icon="cash-outline" color="#30D158" onPress={() => router.push('/admin-payout' as any)} />
            <MenuRow label="Verify Requests" icon="checkmark-circle-outline" color="#FFD60A" onPress={() => router.push('/admin-verify' as any)} badge={stats.bugReports > 0 ? stats.bugReports : undefined} />
          </View>

          {/* Recent Users */}
          {recentUsers.length > 0 ? (
            <>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Users</Text>
              <View style={[styles.menuSection, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
                {recentUsers.slice(0, 8).map((u, i) => (
                  <View key={u.id} style={[styles.userRow, { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', borderBottomWidth: i < Math.min(recentUsers.length, 8) - 1 ? StyleSheet.hairlineWidth : 0 }]}>
                    <View style={[styles.userAvatar, { backgroundColor: colors.primary + '22' }]}>
                      <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '700' }}>
                        {(u.username || u.email || '?')[0].toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
                        {u.username || u.email?.split('@')[0] || 'User'}
                      </Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 1 }} numberOfLines={1}>{u.email}</Text>
                    </View>
                    {u.subscription_tier && u.subscription_tier !== 'free' ? (
                      <View style={{ backgroundColor: '#FFD60A22', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(255,214,10,0.3)' }}>
                        <Text style={{ color: '#FFD60A', fontSize: 11, fontWeight: '700' }}>{(u.subscription_tier || '').toUpperCase()}</Text>
                      </View>
                    ) : null}
                    {u.role === 'admin' ? (
                      <Ionicons name="shield-checkmark" size={15} color="#FFD60A" style={{ marginLeft: 6 }} />
                    ) : null}
                  </View>
                ))}
              </View>
            </>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  refreshBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  adminEmail: {
    fontSize: 13,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 10,
    opacity: 0.6,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 10,
  },
  statCard: {
    width: '47%',
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'flex-start',
    gap: 8,
  },
  statIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  menuSection: {
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  userAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
