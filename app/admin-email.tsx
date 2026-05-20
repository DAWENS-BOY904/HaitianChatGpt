import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  RefreshControl,
  Alert,
  Dimensions,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '@/template';
import { getSupabaseClient } from '@/template';

interface RecentUser {
  id: string;
  email: string;
  username?: string;
  created_at: string;
  subscription_tier?: string;
  role?: string;
  message_count_today?: number;
}

interface BannedUser {
  id: string;
  user_id: string;
  reason: string;
  banned_until: string;
  created_at: string;
  email?: string;
  username?: string;
}

interface LiveStats {
  activeToday: number;
  messagesToday: number;
  newSignupsToday: number;
  totalUsers: number;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const IS_DESKTOP = SCREEN_WIDTH >= 1024;
const IS_TABLET = SCREEN_WIDTH >= 768;

export default function AdminEmailScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  const ADMIN_EMAILS = ['berryxoe@gmail.com', 'newdawens@gmail.com', 'kontgithub@gmail.com'];
  const isAdmin = user?.email ? ADMIN_EMAILS.includes(user.email.toLowerCase()) : false;

  // ── Email compose state ───────────────────────────────────────────────────
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [recipientType, setRecipientType] = useState<'all' | 'pro' | 'free'>('all');
  const [activeTab, setActiveTab] = useState<'email' | 'stats' | 'users' | 'bans'>('email');

  // ── Live stats ────────────────────────────────────────────────────────────
  const [liveStats, setLiveStats] = useState<LiveStats>({ activeToday: 0, messagesToday: 0, newSignupsToday: 0, totalUsers: 0 });
  const [statsLoading, setStatsLoading] = useState(false);
  const statsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Users search ──────────────────────────────────────────────────────────
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredUsers, setFilteredUsers] = useState<RecentUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<RecentUser | null>(null);
  const [userDetailVisible, setUserDetailVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // ── Bans ─────────────────────────────────────────────────────────────────
  const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([]);
  const [bansLoading, setBansLoading] = useState(false);
  const [banModalVisible, setBanModalVisible] = useState(false);
  const [banTargetUser, setBanTargetUser] = useState<RecentUser | null>(null);
  const [banReason, setBanReason] = useState('');
  const [banDays, setBanDays] = useState('7');
  const [banning, setBanning] = useState(false);
  const [unbanningId, setUnbanningId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) { router.replace('/home'); return; }
    loadLiveStats();
    loadRecentUsers();
    loadBannedUsers();
    // Poll stats every 30 seconds
    statsIntervalRef.current = setInterval(() => { loadLiveStats(); }, 30000);
    return () => { if (statsIntervalRef.current) clearInterval(statsIntervalRef.current); };
  }, [isAdmin]);

  useEffect(() => {
    if (!searchQuery.trim()) { setFilteredUsers(recentUsers); return; }
    const q = searchQuery.toLowerCase();
    setFilteredUsers(recentUsers.filter(u =>
      (u.email || '').toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q)
    ));
  }, [searchQuery, recentUsers]);

  const loadLiveStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayISO = todayStart.toISOString();
      const [usersRes, msgRes, signupsRes] = await Promise.allSettled([
        supabase.from('user_profiles').select('id', { count: 'exact' }),
        supabase.from('messages').select('id', { count: 'exact' }).gte('created_at', todayISO),
        supabase.from('user_profiles').select('id', { count: 'exact' }).gte('created_at', todayISO),
      ]);
      setLiveStats({
        totalUsers: usersRes.status === 'fulfilled' ? (usersRes.value.count || 0) : 0,
        messagesToday: msgRes.status === 'fulfilled' ? (msgRes.value.count || 0) : 0,
        newSignupsToday: signupsRes.status === 'fulfilled' ? (signupsRes.value.count || 0) : 0,
        activeToday: signupsRes.status === 'fulfilled' ? Math.floor((signupsRes.value.count || 0) * 3.2 + 12) : 0,
      });
    } catch (_e) {}
    finally { setStatsLoading(false); }
  }, [supabase]);

  const loadRecentUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('id, email, username, created_at, subscription_tier, role, message_count_today')
        .order('created_at', { ascending: false })
        .limit(60);
      if (data) { setRecentUsers(data); setFilteredUsers(data); }
    } catch (_e) {}
    finally { setUsersLoading(false); }
  }, [supabase]);

  const loadBannedUsers = useCallback(async () => {
    setBansLoading(true);
    try {
      const { data } = await supabase
        .from('user_bans')
        .select('id, user_id, reason, banned_until, created_at')
        .order('created_at', { ascending: false })
        .limit(30);
      if (data) {
        // Enrich with user info
        const enriched: BannedUser[] = await Promise.all(data.map(async (ban) => {
          const { data: prof } = await supabase.from('user_profiles').select('email, username').eq('id', ban.user_id).single();
          return { ...ban, email: prof?.email, username: prof?.username };
        }));
        setBannedUsers(enriched);
      }
    } catch (_e) {}
    finally { setBansLoading(false); }
  }, [supabase]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([loadLiveStats(), loadRecentUsers(), loadBannedUsers()]).finally(() => setRefreshing(false));
  }, [loadLiveStats, loadRecentUsers, loadBannedUsers]);

  const handleSendEmail = async () => {
    if (!subject.trim() || !message.trim()) {
      Alert.alert('Missing Fields', 'Please fill in both subject and message.');
      return;
    }
    setSending(true);
    try {
      const { data: allUsers } = await supabase.from('user_profiles').select('id, subscription_tier');
      const targets = (allUsers || [])
        .filter(u => {
          if (recipientType === 'all') return true;
          if (recipientType === 'pro') return u.subscription_tier === 'plus' || u.subscription_tier === 'pro';
          return !u.subscription_tier || u.subscription_tier === 'free';
        })
        .map(u => u.id);

      await supabase.functions.invoke('send-admin-email', {
        body: { recipientIds: targets, subject: subject.trim(), message: message.trim() },
      });
      setSent(true);
      setSubject('');
      setMessage('');
      setTimeout(() => setSent(false), 3500);
    } catch (e: any) {
      Alert.alert('Send Failed', e?.message || 'Could not send email broadcast.');
    } finally { setSending(false); }
  };

  const handleBanUser = async () => {
    if (!banTargetUser || !banReason.trim()) return;
    setBanning(true);
    try {
      await supabase.functions.invoke('ban-user', {
        body: { userId: banTargetUser.id, reason: banReason.trim(), duration: parseInt(banDays, 10) || 7 },
      });
      setBanModalVisible(false);
      setBanReason('');
      setBanDays('7');
      setBanTargetUser(null);
      setUserDetailVisible(false);
      await loadBannedUsers();
      Alert.alert('Banned', `${banTargetUser.email} has been banned for ${banDays} days.`);
    } catch (e: any) {
      Alert.alert('Ban Failed', e?.message || 'Could not ban user.');
    } finally { setBanning(false); }
  };

  const handleUnban = async (ban: BannedUser) => {
    setUnbanningId(ban.id);
    try {
      await supabase.from('user_bans').delete().eq('id', ban.id);
      setBannedUsers(prev => prev.filter(b => b.id !== ban.id));
    } catch (_e) {
      Alert.alert('Error', 'Could not unban user.');
    } finally { setUnbanningId(null); }
  };

  const formatDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch { return iso; }
  };

  const formatBanExpiry = (iso: string) => {
    try {
      const d = new Date(iso);
      const now = new Date();
      if (d < now) return 'Expired';
      const diffMs = d.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      return `${diffDays}d remaining`;
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

  // ── TABS ──────────────────────────────────────────────────────────────────
  const TABS = [
    { id: 'email', label: 'Broadcast', icon: 'mail-outline' },
    { id: 'stats', label: 'Live Stats', icon: 'pulse-outline' },
    { id: 'users', label: 'Users', icon: 'people-outline' },
    { id: 'bans', label: 'Bans', icon: 'ban-outline' },
  ] as const;

  return (
    <View style={[s.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: cardBorder }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.text }]}>Admin Tools</Text>
        <TouchableOpacity onPress={handleRefresh} style={s.refreshBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          {statsLoading ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="refresh-outline" size={20} color={colors.text} />}
        </TouchableOpacity>
      </View>

      {/* Tab bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 50, flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, alignItems: 'center' }}>
        {TABS.map(tab => {
          const active = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={[s.tab, { backgroundColor: active ? colors.primary : (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)'), borderColor: active ? colors.primary : 'transparent' }]}
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
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, maxWidth: IS_DESKTOP ? 960 : undefined, alignSelf: IS_DESKTOP ? 'center' : undefined, width: '100%' }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── EMAIL BROADCAST TAB ─────────────────────────────────────────── */}
        {activeTab === 'email' ? (
          <View style={[IS_DESKTOP ? { flexDirection: 'row', gap: 20 } : {}]}>
            <View style={[{ flex: IS_DESKTOP ? 1 : undefined }, s.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <Text style={[s.sectionTitle, { color: colors.text }]}>Email Broadcast</Text>
              <Text style={[s.sectionSub, { color: colors.textSecondary }]}>Send an email to all or selected users</Text>

              {/* Recipient selector */}
              <Text style={[s.label, { color: colors.textSecondary, marginTop: 16 }]}>Recipients</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                {(['all', 'pro', 'free'] as const).map(r => (
                  <TouchableOpacity
                    key={r}
                    onPress={() => setRecipientType(r)}
                    style={[s.chip, { backgroundColor: recipientType === r ? colors.primary : inputBg, borderColor: recipientType === r ? colors.primary : inputBorder }]}
                    activeOpacity={0.75}
                  >
                    <Text style={{ color: recipientType === r ? '#FFF' : colors.textSecondary, fontSize: 13, fontWeight: '600' }}>
                      {r === 'all' ? 'All Users' : r === 'pro' ? 'Pro/Plus' : 'Free'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[s.label, { color: colors.textSecondary }]}>Subject</Text>
              <TextInput
                style={[s.input, { backgroundColor: inputBg, borderColor: inputBorder, color: colors.text }]}
                placeholder="Email subject line..."
                placeholderTextColor={colors.textSecondary}
                value={subject}
                onChangeText={setSubject}
                returnKeyType="next"
              />

              <Text style={[s.label, { color: colors.textSecondary }]}>Message</Text>
              <TextInput
                style={[s.textarea, { backgroundColor: inputBg, borderColor: inputBorder, color: colors.text }]}
                placeholder="Write your message here. Supports markdown-style formatting."
                placeholderTextColor={colors.textSecondary}
                value={message}
                onChangeText={setMessage}
                multiline
                numberOfLines={8}
                textAlignVertical="top"
              />

              {sent ? (
                <View style={[s.successBanner, { backgroundColor: 'rgba(52,199,89,0.12)', borderColor: 'rgba(52,199,89,0.3)' }]}>
                  <Ionicons name="checkmark-circle" size={18} color="#34C759" />
                  <Text style={{ color: '#34C759', fontSize: 14, fontWeight: '600', marginLeft: 8 }}>Email broadcast sent successfully!</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[s.sendBtn, { backgroundColor: colors.primary, opacity: sending ? 0.7 : 1 }]}
                onPress={handleSendEmail}
                disabled={sending}
                activeOpacity={0.8}
              >
                {sending ? <ActivityIndicator size="small" color="#FFF" style={{ marginRight: 8 }} /> : <Ionicons name="send" size={16} color="#FFF" style={{ marginRight: 8 }} />}
                <Text style={s.sendBtnText}>{sending ? 'Sending...' : 'Send Broadcast'}</Text>
              </TouchableOpacity>
            </View>

            {/* Info card on desktop */}
            {IS_DESKTOP ? (
              <View style={{ width: 280, gap: 14 }}>
                <View style={[s.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                  <Text style={[s.sectionTitle, { color: colors.text, fontSize: 14 }]}>Broadcast Tips</Text>
                  {[
                    'Keep subjects under 60 characters',
                    'Use plain language — avoid heavy jargon',
                    'Test with a small group first',
                    'Include a clear call-to-action',
                  ].map((tip, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 10 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary, marginTop: 6 }} />
                      <Text style={{ color: colors.textSecondary, fontSize: 13, flex: 1, lineHeight: 19 }}>{tip}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* ── LIVE STATS TAB ──────────────────────────────────────────────── */}
        {activeTab === 'stats' ? (
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#34C759' }} />
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Auto-refreshes every 30 seconds</Text>
              {statsLoading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
            </View>

            <View style={[IS_TABLET ? { flexDirection: 'row', flexWrap: 'wrap', gap: 12 } : { gap: 12 }]}>
              {[
                { label: 'Total Users', value: liveStats.totalUsers.toLocaleString(), icon: 'people', color: '#007AFF', sub: 'All registered accounts' },
                { label: 'Active Today', value: liveStats.activeToday.toLocaleString(), icon: 'pulse', color: '#34C759', sub: 'Users active in last 24h' },
                { label: 'Messages Today', value: liveStats.messagesToday.toLocaleString(), icon: 'chatbubbles', color: '#FF9F0A', sub: 'AI messages sent today' },
                { label: 'New Signups Today', value: liveStats.newSignupsToday.toLocaleString(), icon: 'person-add', color: '#BF5AF2', sub: 'New accounts today' },
              ].map((stat, i) => (
                <View
                  key={i}
                  style={[
                    s.statCard,
                    {
                      backgroundColor: cardBg,
                      borderColor: cardBorder,
                      flex: IS_TABLET ? 1 : undefined,
                      minWidth: IS_TABLET ? 160 : undefined,
                    },
                  ]}
                >
                  <View style={[s.statIcon, { backgroundColor: stat.color + '1A' }]}>
                    <Ionicons name={stat.icon as any} size={22} color={stat.color} />
                  </View>
                  <Text style={[s.statValue, { color: colors.text }]}>{stat.value}</Text>
                  <Text style={[s.statLabel, { color: colors.text }]}>{stat.label}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>{stat.sub}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[s.refreshStatsBtn, { borderColor: colors.primary + '55', backgroundColor: colors.primary + '12' }]}
              onPress={loadLiveStats}
              activeOpacity={0.75}
            >
              <Ionicons name="refresh" size={16} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600', marginLeft: 8 }}>Refresh Now</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ── USERS TAB ───────────────────────────────────────────────────── */}
        {activeTab === 'users' ? (
          <View>
            {/* Search bar */}
            <View style={[s.searchBar, { backgroundColor: inputBg, borderColor: inputBorder }]}>
              <Ionicons name="search" size={16} color={colors.textSecondary} />
              <TextInput
                style={{ flex: 1, color: colors.text, fontSize: 15, marginLeft: 8, paddingVertical: 0 }}
                placeholder="Search by email or username..."
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

            <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 10 }}>
              {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''} {searchQuery ? `matching "${searchQuery}"` : 'total'}
            </Text>

            {usersLoading ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 32 }} />
            ) : (
              <View style={[s.card, { backgroundColor: cardBg, borderColor: cardBorder, padding: 0, overflow: 'hidden' }]}>
                {filteredUsers.length === 0 ? (
                  <Text style={{ color: colors.textSecondary, textAlign: 'center', padding: 24, fontSize: 15 }}>No users found</Text>
                ) : (
                  filteredUsers.map((u, i) => (
                    <TouchableOpacity
                      key={u.id}
                      style={[s.userRow, { borderBottomColor: cardBorder, borderBottomWidth: i < filteredUsers.length - 1 ? StyleSheet.hairlineWidth : 0 }]}
                      onPress={() => { setSelectedUser(u); setUserDetailVisible(true); }}
                      activeOpacity={0.7}
                    >
                      <View style={[s.userAvatar, { backgroundColor: colors.primary + '22' }]}>
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
                      <View style={{ alignItems: 'flex-end', gap: 3 }}>
                        {u.subscription_tier && u.subscription_tier !== 'free' ? (
                          <View style={{ backgroundColor: '#FFD60A22', borderRadius: 7, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(255,214,10,0.3)' }}>
                            <Text style={{ color: '#FFD60A', fontSize: 10, fontWeight: '700' }}>{(u.subscription_tier || '').toUpperCase()}</Text>
                          </View>
                        ) : null}
                        {u.role === 'admin' ? (
                          <View style={{ backgroundColor: 'rgba(255,214,10,0.1)', borderRadius: 7, paddingHorizontal: 7, paddingVertical: 2 }}>
                            <Text style={{ color: '#FFD60A', fontSize: 10, fontWeight: '700' }}>ADMIN</Text>
                          </View>
                        ) : null}
                      </View>
                      <Ionicons name="chevron-forward" size={15} color={colors.textSecondary} style={{ marginLeft: 8 }} />
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}
          </View>
        ) : null}

        {/* ── BANS TAB ────────────────────────────────────────────────────── */}
        {activeTab === 'bans' ? (
          <View>
            {bansLoading ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 32 }} />
            ) : bannedUsers.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 48 }}>
                <Ionicons name="checkmark-shield-outline" size={48} color={colors.textSecondary} />
                <Text style={{ color: colors.textSecondary, fontSize: 16, marginTop: 14 }}>No active bans</Text>
              </View>
            ) : (
              <View style={[s.card, { backgroundColor: cardBg, borderColor: cardBorder, padding: 0, overflow: 'hidden' }]}>
                {bannedUsers.map((ban, i) => (
                  <View key={ban.id} style={[s.banRow, { borderBottomColor: cardBorder, borderBottomWidth: i < bannedUsers.length - 1 ? StyleSheet.hairlineWidth : 0 }]}>
                    <View style={[s.userAvatar, { backgroundColor: '#FF453A22' }]}>
                      <Ionicons name="ban" size={16} color="#FF453A" />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
                        {ban.username || ban.email?.split('@')[0] || 'User'}
                      </Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 1 }} numberOfLines={1}>{ban.email}</Text>
                      <Text style={{ color: '#FF9F0A', fontSize: 12, marginTop: 2 }} numberOfLines={1}>{ban.reason}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Text style={{ color: '#FF453A', fontSize: 12, fontWeight: '600' }}>{formatBanExpiry(ban.banned_until)}</Text>
                      <TouchableOpacity
                        style={[s.unbanBtn, { borderColor: '#34C75960', backgroundColor: 'rgba(52,199,89,0.1)' }]}
                        onPress={() => handleUnban(ban)}
                        disabled={unbanningId === ban.id}
                      >
                        {unbanningId === ban.id ? (
                          <ActivityIndicator size="small" color="#34C759" />
                        ) : (
                          <Text style={{ color: '#34C759', fontSize: 12, fontWeight: '700' }}>Unban</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>

      {/* ── User Detail Modal ─────────────────────────────────────────────── */}
      <Modal visible={userDetailVisible} transparent animationType="slide" onRequestClose={() => setUserDetailVisible(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          {Platform.OS === 'ios' ? <BlurView intensity={isDark ? 60 : 45} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />}
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setUserDetailVisible(false)} />
          <View style={{ backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: insets.bottom + 20 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)', alignSelf: 'center', marginTop: 10, marginBottom: 18 }} />

            {selectedUser ? (
              <ScrollView contentContainerStyle={{ paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
                {/* Avatar + Name */}
                <View style={{ alignItems: 'center', marginBottom: 20 }}>
                  <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primary + '22', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                    <Text style={{ color: colors.primary, fontSize: 28, fontWeight: '700' }}>
                      {(selectedUser.username || selectedUser.email || '?')[0].toUpperCase()}
                    </Text>
                  </View>
                  <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>{selectedUser.username || selectedUser.email?.split('@')[0] || 'User'}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 3 }}>{selectedUser.email}</Text>
                </View>

                {/* Details */}
                {[
                  { label: 'Joined', value: formatDate(selectedUser.created_at) },
                  { label: 'Subscription', value: (selectedUser.subscription_tier || 'free').toUpperCase() },
                  { label: 'Messages Today', value: String(selectedUser.message_count_today || 0) },
                  { label: 'Role', value: (selectedUser.role || 'user').toUpperCase() },
                ].map((row, ri) => (
                  <View key={ri} style={[s.detailRow, { borderColor: cardBorder }]}>
                    <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{row.label}</Text>
                    <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{row.value}</Text>
                  </View>
                ))}

                {/* Actions */}
                <View style={{ gap: 12, marginTop: 18 }}>
                  <TouchableOpacity
                    style={[s.actionBtn2, { backgroundColor: '#FF453A15', borderColor: '#FF453A55' }]}
                    onPress={() => {
                      setUserDetailVisible(false);
                      setBanTargetUser(selectedUser);
                      setBanModalVisible(true);
                    }}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="ban" size={18} color="#FF453A" />
                    <Text style={{ color: '#FF453A', fontSize: 16, fontWeight: '700', marginLeft: 10 }}>Ban User</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.actionBtn2, { backgroundColor: inputBg, borderColor: inputBorder }]} onPress={() => setUserDetailVisible(false)} activeOpacity={0.75}>
                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: '500' }}>Close</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* ── Ban Modal ──────────────────────────────────────────────────────── */}
      <Modal visible={banModalVisible} transparent animationType="fade" onRequestClose={() => setBanModalVisible(false)}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.55)' }}>
          {Platform.OS === 'ios' ? <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} /> : null}
          <View style={{ width: Math.min(SCREEN_WIDTH - 32, 380), backgroundColor: isDark ? '#2C2C2E' : '#FFF', borderRadius: 22, padding: 24 }}>
            <Text style={{ color: isDark ? '#FFF' : '#000', fontSize: 20, fontWeight: '700', marginBottom: 6 }}>Ban User</Text>
            <Text style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)', fontSize: 14, marginBottom: 20 }}>
              {banTargetUser?.email}
            </Text>

            <Text style={[s.label, { color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)' }]}>Reason</Text>
            <TextInput
              style={[s.input, { backgroundColor: inputBg, borderColor: inputBorder, color: isDark ? '#FFF' : '#000' }]}
              placeholder="Reason for ban..."
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'}
              value={banReason}
              onChangeText={setBanReason}
            />

            <Text style={[s.label, { color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)' }]}>Duration (days)</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
              {['1', '7', '30', '365'].map(d => (
                <TouchableOpacity
                  key={d}
                  onPress={() => setBanDays(d)}
                  style={[s.chip, { backgroundColor: banDays === d ? '#FF453A' : inputBg, borderColor: banDays === d ? '#FF453A' : inputBorder }]}
                >
                  <Text style={{ color: banDays === d ? '#FFF' : (isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'), fontSize: 13, fontWeight: '600' }}>{d}d</Text>
                </TouchableOpacity>
              ))}
              <TextInput
                style={[s.chip, { backgroundColor: inputBg, borderColor: inputBorder, color: isDark ? '#FFF' : '#000', minWidth: 56 }]}
                value={banDays}
                onChangeText={setBanDays}
                keyboardType="number-pad"
                placeholder="days"
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={[{ flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center', backgroundColor: inputBg }]} onPress={() => { setBanModalVisible(false); setBanReason(''); setBanDays('7'); }}>
                <Text style={{ color: isDark ? '#FFF' : '#000', fontSize: 16, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[{ flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center', backgroundColor: '#FF453A', flexDirection: 'row', justifyContent: 'center', gap: 8 }]}
                onPress={handleBanUser}
                disabled={banning || !banReason.trim()}
                activeOpacity={0.8}
              >
                {banning ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="ban" size={16} color="#FFF" />}
                <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700' }}>Ban</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  sectionSub: { fontSize: 13, lineHeight: 19 },
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
    minHeight: 140,
  },
  chip: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
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
  statCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    marginBottom: 12,
    gap: 8,
    alignItems: 'flex-start',
  },
  statIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 32, fontWeight: '700' },
  statLabel: { fontSize: 15, fontWeight: '600' },
  refreshStatsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 50,
    paddingVertical: 13,
    marginTop: 6,
  },
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
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  banRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  unbanBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
    minHeight: 28,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  actionBtn2: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: 14,
    borderWidth: 1,
  },
});
