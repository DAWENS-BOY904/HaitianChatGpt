import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
  Dimensions,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '@/template';
import { getSupabaseClient } from '@/template';

const SCREEN_WIDTH = Dimensions.get('window').width;
const IS_DESKTOP = SCREEN_WIDTH >= 1024;
const IS_TABLET = SCREEN_WIDTH >= 768;
const ADMIN_EMAILS = ['berryxoe@gmail.com', 'newdawens@gmail.com', 'kontgithub@gmail.com'];

interface Payout {
  id: string;
  admin_id: string;
  payout_method_id?: string;
  amount: number;
  currency: string;
  status: string;
  requested_at: string;
  completed_at?: string;
  failure_reason?: string;
  transaction_reference?: string;
  email?: string;
  username?: string;
  method_type?: string;
  account_name?: string;
}

interface PayoutMethod {
  id: string;
  admin_id: string;
  method_type: string;
  account_name: string;
  account_number: string;
  routing_number?: string;
  bank_name?: string;
  card_last_four?: string;
  is_default: boolean;
  is_verified: boolean;
  created_at: string;
}

interface PayoutStats {
  totalPaid: number;
  totalPending: number;
  totalFailed: number;
  pendingCount: number;
  paidCount: number;
  failedCount: number;
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#FF9F0A',
  processing: '#007AFF',
  completed: '#34C759',
  failed: '#FF453A',
  cancelled: '#8E8E93',
};

const STATUS_ICONS: Record<string, any> = {
  pending: 'time-outline',
  processing: 'sync-outline',
  completed: 'checkmark-circle',
  failed: 'close-circle-outline',
  cancelled: 'ban-outline',
};

const METHOD_ICONS: Record<string, any> = {
  bank_transfer: 'business-outline',
  paypal: 'logo-paypal',
  card: 'card-outline',
  crypto: 'logo-bitcoin',
  check: 'document-text-outline',
};

export default function AdminPayoutScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  const isAdmin = user?.email ? ADMIN_EMAILS.includes(user.email.toLowerCase()) : false;

  const [activeTab, setActiveTab] = useState<'overview' | 'payouts' | 'methods'>('overview');
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [methods, setMethods] = useState<PayoutMethod[]>([]);
  const [stats, setStats] = useState<PayoutStats>({
    totalPaid: 0, totalPending: 0, totalFailed: 0,
    pendingCount: 0, paidCount: 0, failedCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [addMethodVisible, setAddMethodVisible] = useState(false);
  const [newMethod, setNewMethod] = useState({
    method_type: 'bank_transfer',
    account_name: '',
    account_number: '',
    routing_number: '',
    bank_name: '',
  });
  const [savingMethod, setSavingMethod] = useState(false);

  useEffect(() => {
    if (!isAdmin) { router.replace('/home'); return; }
    loadAll();
  }, [isAdmin]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.allSettled([loadPayouts(), loadMethods()]);
    setLoading(false);
  }, []);

  const loadPayouts = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('payouts')
        .select(`
          id, admin_id, payout_method_id, amount, currency, status,
          requested_at, completed_at, failure_reason, transaction_reference
        `)
        .order('requested_at', { ascending: false })
        .limit(60);

      if (data) {
        const enriched: Payout[] = await Promise.all(
          data.map(async (p: any) => {
            const { data: prof } = await supabase
              .from('user_profiles')
              .select('email, username')
              .eq('id', p.admin_id)
              .single();

            let methodInfo: Partial<Payout> = {};
            if (p.payout_method_id) {
              const { data: method } = await supabase
                .from('payout_methods')
                .select('method_type, account_name')
                .eq('id', p.payout_method_id)
                .single();
              if (method) {
                methodInfo = { method_type: method.method_type, account_name: method.account_name };
              }
            }

            return {
              ...p,
              amount: parseFloat(p.amount || '0'),
              email: prof?.email,
              username: prof?.username,
              ...methodInfo,
            };
          })
        );
        setPayouts(enriched);

        // Compute stats
        const totalPaid = enriched.filter(p => p.status === 'completed').reduce((s, p) => s + p.amount, 0);
        const totalPending = enriched.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount, 0);
        const totalFailed = enriched.filter(p => p.status === 'failed').reduce((s, p) => s + p.amount, 0);
        setStats({
          totalPaid,
          totalPending,
          totalFailed,
          paidCount: enriched.filter(p => p.status === 'completed').length,
          pendingCount: enriched.filter(p => p.status === 'pending').length,
          failedCount: enriched.filter(p => p.status === 'failed').length,
        });
      }
    } catch (_e) {}
  }, [supabase]);

  const loadMethods = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('payout_methods')
        .select('*')
        .order('created_at', { ascending: false });
      if (data) setMethods(data as PayoutMethod[]);
    } catch (_e) {}
  }, [supabase]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadAll().finally(() => setRefreshing(false));
  }, [loadAll]);

  const handleUpdatePayoutStatus = useCallback(async (payoutId: string, status: string, ref?: string) => {
    setUpdating(true);
    try {
      const update: any = { status };
      if (status === 'completed') update.completed_at = new Date().toISOString();
      if (ref) update.transaction_reference = ref;
      const { error } = await supabase.from('payouts').update(update).eq('id', payoutId);
      if (error) throw error;
      setPayouts(prev => prev.map(p => p.id === payoutId ? { ...p, status, ...update } : p));
      if (selectedPayout?.id === payoutId) setSelectedPayout(prev => prev ? { ...prev, status, ...update } : null);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not update payout status.');
    } finally { setUpdating(false); }
  }, [supabase, selectedPayout]);

  const handleSaveMethod = useCallback(async () => {
    if (!newMethod.account_name.trim() || !newMethod.account_number.trim()) {
      Alert.alert('Missing Fields', 'Please fill in account name and number.');
      return;
    }
    setSavingMethod(true);
    try {
      const { error } = await supabase.from('payout_methods').insert({
        admin_id: user?.id,
        method_type: newMethod.method_type,
        account_name: newMethod.account_name.trim(),
        account_number: newMethod.account_number.trim(),
        routing_number: newMethod.routing_number.trim() || null,
        bank_name: newMethod.bank_name.trim() || null,
        is_default: methods.length === 0,
        is_verified: false,
      });
      if (error) throw error;
      setAddMethodVisible(false);
      setNewMethod({ method_type: 'bank_transfer', account_name: '', account_number: '', routing_number: '', bank_name: '' });
      await loadMethods();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not save payout method.');
    } finally { setSavingMethod(false); }
  }, [supabase, user?.id, newMethod, methods.length, loadMethods]);

  const handleRequestPayout = useCallback(async () => {
    const defaultMethod = methods.find(m => m.is_default) || methods[0];
    if (!defaultMethod) {
      Alert.alert('No Payout Method', 'Please add a payout method first.');
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke('request-payout', {
        body: { methodId: defaultMethod.id },
      });
      if (error) throw error;
      Alert.alert('Success', 'Payout request submitted successfully.');
      await loadPayouts();
    } catch (e: any) {
      Alert.alert('Request Failed', e?.message || 'Could not submit payout request.');
    }
  }, [methods, supabase, loadPayouts]);

  const formatCurrency = (amount: number, currency = 'USD') =>
    `${currency === 'USD' ? '$' : currency + ' '}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatDate = (iso?: string) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) return 'Just now';
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffH = Math.floor(diffMin / 60);
      if (diffH < 24) return `${diffH}h ago`;
      const diffD = Math.floor(diffH / 24);
      if (diffD < 7) return `${diffD}d ago`;
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

  const STATUSES = ['all', 'pending', 'processing', 'completed', 'failed', 'cancelled'];
  const METHOD_TYPES = ['bank_transfer', 'paypal', 'card', 'crypto', 'check'];

  const filteredPayouts = payouts.filter(p => {
    const matchStatus = filterStatus === 'all' || p.status === filterStatus;
    const q = searchQuery.toLowerCase();
    const matchSearch = !q ||
      (p.email || '').toLowerCase().includes(q) ||
      (p.username || '').toLowerCase().includes(q) ||
      (p.transaction_reference || '').toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const TABS = [
    { id: 'overview', label: 'Overview', icon: 'stats-chart-outline' },
    { id: 'payouts', label: 'Payouts', icon: 'cash-outline' },
    { id: 'methods', label: 'Methods', icon: 'card-outline' },
  ] as const;

  // ── Payout Detail View ───────────────────────────────────────────────────
  if (selectedPayout && detailVisible) {
    const statusColor = STATUS_COLORS[selectedPayout.status] || '#8E8E93';
    return (
      <View style={[s.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={[s.header, { borderBottomColor: cardBorder }]}>
          <TouchableOpacity onPress={() => { setDetailVisible(false); setSelectedPayout(null); }} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.text }]}>Payout Detail</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, maxWidth: IS_DESKTOP ? 720 : undefined, alignSelf: IS_DESKTOP ? 'center' : undefined, width: '100%' }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Amount hero */}
          <View style={[s.card, { backgroundColor: cardBg, borderColor: cardBorder, alignItems: 'center', paddingVertical: 28 }]}>
            <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 6 }}>Payout Amount</Text>
            <Text style={{ color: colors.text, fontSize: 44, fontWeight: '800', letterSpacing: -1 }}>
              {formatCurrency(selectedPayout.amount, selectedPayout.currency)}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
              <View style={{ backgroundColor: statusColor + '20', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: statusColor + '40', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name={STATUS_ICONS[selectedPayout.status] || 'ellipse-outline'} size={14} color={statusColor} />
                <Text style={{ color: statusColor, fontSize: 13, fontWeight: '700', textTransform: 'capitalize' }}>{selectedPayout.status}</Text>
              </View>
            </View>
          </View>

          {/* Details */}
          <View style={[s.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <Text style={[s.cardLabel, { color: colors.textSecondary }]}>Details</Text>
            {[
              { label: 'Requested By', value: selectedPayout.username || selectedPayout.email || 'Unknown' },
              { label: 'Email', value: selectedPayout.email || '—' },
              { label: 'Method', value: (selectedPayout.method_type || '—').replace(/_/g, ' ') },
              { label: 'Account Name', value: selectedPayout.account_name || '—' },
              { label: 'Requested', value: formatDate(selectedPayout.requested_at) },
              { label: 'Completed', value: formatDate(selectedPayout.completed_at) },
              { label: 'Transaction Ref', value: selectedPayout.transaction_reference || '—' },
            ].map((row, i) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: cardBorder }}>
                <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{row.label}</Text>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: '500', maxWidth: '55%', textAlign: 'right' }} numberOfLines={1}>{row.value}</Text>
              </View>
            ))}
            {selectedPayout.failure_reason ? (
              <View style={{ marginTop: 10, backgroundColor: 'rgba(255,69,58,0.1)', borderRadius: 10, padding: 12 }}>
                <Text style={{ color: '#FF453A', fontSize: 13, fontWeight: '600' }}>Failure Reason</Text>
                <Text style={{ color: '#FF453A', fontSize: 13, marginTop: 4 }}>{selectedPayout.failure_reason}</Text>
              </View>
            ) : null}
          </View>

          {/* Status actions */}
          <View style={[s.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <Text style={[s.cardLabel, { color: colors.textSecondary, marginBottom: 12 }]}>Update Status</Text>
            <View style={{ gap: 10 }}>
              {selectedPayout.status !== 'completed' ? (
                <TouchableOpacity
                  style={[s.actionBtn, { backgroundColor: 'rgba(52,199,89,0.12)', borderColor: 'rgba(52,199,89,0.35)' }]}
                  onPress={() => handleUpdatePayoutStatus(selectedPayout.id, 'completed')}
                  disabled={updating}
                  activeOpacity={0.8}
                >
                  {updating ? <ActivityIndicator size="small" color="#34C759" /> : <Ionicons name="checkmark-circle" size={18} color="#34C759" />}
                  <Text style={{ color: '#34C759', fontSize: 16, fontWeight: '700', marginLeft: 8 }}>Mark Completed</Text>
                </TouchableOpacity>
              ) : null}
              {selectedPayout.status === 'pending' ? (
                <TouchableOpacity
                  style={[s.actionBtn, { backgroundColor: 'rgba(0,122,255,0.12)', borderColor: 'rgba(0,122,255,0.35)' }]}
                  onPress={() => handleUpdatePayoutStatus(selectedPayout.id, 'processing')}
                  disabled={updating}
                  activeOpacity={0.8}
                >
                  <Ionicons name="sync-outline" size={18} color="#007AFF" />
                  <Text style={{ color: '#007AFF', fontSize: 16, fontWeight: '700', marginLeft: 8 }}>Mark Processing</Text>
                </TouchableOpacity>
              ) : null}
              {selectedPayout.status !== 'failed' && selectedPayout.status !== 'completed' ? (
                <TouchableOpacity
                  style={[s.actionBtn, { backgroundColor: 'rgba(255,69,58,0.12)', borderColor: 'rgba(255,69,58,0.35)' }]}
                  onPress={() => handleUpdatePayoutStatus(selectedPayout.id, 'failed')}
                  disabled={updating}
                  activeOpacity={0.8}
                >
                  <Ionicons name="close-circle" size={18} color="#FF453A" />
                  <Text style={{ color: '#FF453A', fontSize: 16, fontWeight: '700', marginLeft: 8 }}>Mark Failed</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── Main List View ───────────────────────────────────────────────────────
  return (
    <View style={[s.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: cardBorder }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.text }]}>Payout Management</Text>
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
              <Text style={{ fontSize: 13, fontWeight: '600', color: active ? '#FFF' : colors.textSecondary, marginLeft: 5 }}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: 16, paddingBottom: insets.bottom + 32,
          maxWidth: IS_DESKTOP ? 960 : undefined,
          alignSelf: IS_DESKTOP ? 'center' : undefined,
          width: '100%',
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── OVERVIEW TAB ─────────────────────────────────────────────── */}
        {activeTab === 'overview' ? (
          <View>
            {/* Hero total paid */}
            <View style={[s.card, { backgroundColor: cardBg, borderColor: cardBorder, alignItems: 'flex-start' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <View style={[s.iconBox, { backgroundColor: '#34C75922' }]}>
                  <Ionicons name="checkmark-circle" size={20} color="#34C759" />
                </View>
                <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: '600' }}>Total Paid Out</Text>
              </View>
              <Text style={{ color: colors.text, fontSize: 40, fontWeight: '800', letterSpacing: -1 }}>
                {formatCurrency(stats.totalPaid)}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>
                {stats.paidCount} completed payout{stats.paidCount !== 1 ? 's' : ''}
              </Text>
            </View>

            {/* Stats grid */}
            <View style={{ flexDirection: IS_TABLET ? 'row' : 'column', gap: 12 }}>
              {[
                { label: 'Pending Amount', value: formatCurrency(stats.totalPending), count: `${stats.pendingCount} pending`, icon: 'time-outline', color: '#FF9F0A' },
                { label: 'Failed Amount', value: formatCurrency(stats.totalFailed), count: `${stats.failedCount} failed`, icon: 'close-circle-outline', color: '#FF453A' },
                { label: 'Total Payouts', value: String(payouts.length), count: 'All time', icon: 'receipt-outline', color: '#007AFF' },
                { label: 'Payout Methods', value: String(methods.length), count: `${methods.filter(m => m.is_verified).length} verified`, icon: 'card-outline', color: '#BF5AF2' },
              ].map((stat, si) => (
                <View key={si} style={[s.card, { backgroundColor: cardBg, borderColor: cardBorder, flex: IS_TABLET ? 1 : undefined }]}>
                  <View style={[s.iconBox, { backgroundColor: stat.color + '1A' }]}>
                    <Ionicons name={stat.icon as any} size={20} color={stat.color} />
                  </View>
                  <Text style={{ color: colors.text, fontSize: 26, fontWeight: '700', marginTop: 10 }}>{stat.value}</Text>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600', marginTop: 2 }}>{stat.label}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>{stat.count}</Text>
                </View>
              ))}
            </View>

            {/* Quick action */}
            <TouchableOpacity
              style={[s.card, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '44', flexDirection: 'row', alignItems: 'center', gap: 14 }]}
              onPress={handleRequestPayout}
              activeOpacity={0.8}
            >
              <View style={[s.iconBox, { backgroundColor: colors.primary + '22' }]}>
                <Ionicons name="arrow-up-circle" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '700' }}>Request Payout</Text>
                <Text style={{ color: colors.primary, fontSize: 13, opacity: 0.7, marginTop: 2 }}>
                  {methods.find(m => m.is_default)?.account_name || 'Set up a payout method first'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ── PAYOUTS TAB ──────────────────────────────────────────────── */}
        {activeTab === 'payouts' ? (
          <View>
            {/* Search */}
            <View style={[s.searchBar, { backgroundColor: inputBg, borderColor: inputBorder }]}>
              <Ionicons name="search" size={16} color={colors.textSecondary} />
              <TextInput
                style={{ flex: 1, color: colors.text, fontSize: 15, marginLeft: 8, paddingVertical: 0 }}
                placeholder="Search payouts..."
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

            {/* Status chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }} contentContainerStyle={{ gap: 7 }}>
              {STATUSES.map(st => {
                const isActive = filterStatus === st;
                const stColor = STATUS_COLORS[st] || colors.primary;
                return (
                  <TouchableOpacity
                    key={st}
                    onPress={() => setFilterStatus(st)}
                    style={[s.chip, { backgroundColor: isActive ? stColor + '22' : inputBg, borderColor: isActive ? stColor : inputBorder }]}
                    activeOpacity={0.75}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: isActive ? stColor : colors.textSecondary, textTransform: 'capitalize' }}>{st}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 10 }}>
              {filteredPayouts.length} payout{filteredPayouts.length !== 1 ? 's' : ''}
            </Text>

            {loading ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
            ) : filteredPayouts.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 48 }}>
                <Ionicons name="cash-outline" size={48} color={colors.textSecondary} />
                <Text style={{ color: colors.textSecondary, fontSize: 16, marginTop: 14 }}>No payouts found</Text>
              </View>
            ) : (
              <View style={[s.card, { backgroundColor: cardBg, borderColor: cardBorder, padding: 0, overflow: 'hidden' }]}>
                {filteredPayouts.map((payout, i) => {
                  const statusColor = STATUS_COLORS[payout.status] || '#8E8E93';
                  return (
                    <TouchableOpacity
                      key={payout.id}
                      style={[s.payoutRow, { borderBottomColor: cardBorder, borderBottomWidth: i < filteredPayouts.length - 1 ? StyleSheet.hairlineWidth : 0 }]}
                      onPress={() => { setSelectedPayout(payout); setDetailVisible(true); }}
                      activeOpacity={0.7}
                    >
                      <View style={[s.iconBox, { backgroundColor: statusColor + '18', width: 38, height: 38 }]}>
                        <Ionicons name={STATUS_ICONS[payout.status] || 'cash-outline'} size={17} color={statusColor} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>
                          {formatCurrency(payout.amount, payout.currency)}
                        </Text>
                        <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                          {payout.username || payout.email || 'Unknown'} · {formatDate(payout.requested_at)}
                        </Text>
                        {payout.method_type ? (
                          <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 1 }} numberOfLines={1}>
                            via {(payout.method_type || '').replace(/_/g, ' ')}
                          </Text>
                        ) : null}
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 4, marginLeft: 8 }}>
                        <View style={{ backgroundColor: statusColor + '18', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 }}>
                          <Text style={{ color: statusColor, fontSize: 10, fontWeight: '700', textTransform: 'capitalize' }}>{payout.status}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        ) : null}

        {/* ── METHODS TAB ──────────────────────────────────────────────── */}
        {activeTab === 'methods' ? (
          <View>
            <TouchableOpacity
              style={[s.addMethodBtn, { backgroundColor: colors.primary, marginBottom: 16 }]}
              onPress={() => setAddMethodVisible(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="add-circle-outline" size={18} color="#FFF" />
              <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700', marginLeft: 8 }}>Add Payout Method</Text>
            </TouchableOpacity>

            {loading ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
            ) : methods.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 48 }}>
                <Ionicons name="card-outline" size={48} color={colors.textSecondary} />
                <Text style={{ color: colors.textSecondary, fontSize: 16, marginTop: 14 }}>No payout methods yet</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 6, textAlign: 'center', maxWidth: 280 }}>
                  Add a bank account, PayPal, or other method to receive payouts.
                </Text>
              </View>
            ) : (
              <View style={[s.card, { backgroundColor: cardBg, borderColor: cardBorder, padding: 0, overflow: 'hidden' }]}>
                {methods.map((method, i) => (
                  <View
                    key={method.id}
                    style={[s.methodRow, { borderBottomColor: cardBorder, borderBottomWidth: i < methods.length - 1 ? StyleSheet.hairlineWidth : 0 }]}
                  >
                    <View style={[s.iconBox, { backgroundColor: '#007AFF18', width: 42, height: 42 }]}>
                      <Ionicons name={METHOD_ICONS[method.method_type] || 'card-outline'} size={19} color="#007AFF" />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>{method.account_name}</Text>
                        {method.is_default ? (
                          <View style={{ backgroundColor: colors.primary + '22', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                            <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '700' }}>DEFAULT</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2, textTransform: 'capitalize' }}>
                        {(method.method_type || '').replace(/_/g, ' ')}
                        {method.bank_name ? ` · ${method.bank_name}` : ''}
                      </Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 1 }}>
                        ****{method.account_number?.slice(-4) || '----'}
                      </Text>
                    </View>
                    {method.is_verified ? (
                      <Ionicons name="checkmark-circle" size={18} color="#34C759" />
                    ) : (
                      <View style={{ backgroundColor: '#FF9F0A22', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4 }}>
                        <Text style={{ color: '#FF9F0A', fontSize: 11, fontWeight: '700' }}>UNVERIFIED</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>

      {/* ── Add Method Modal ────────────────────────────────────────────── */}
      <Modal visible={addMethodVisible} transparent animationType="slide" onRequestClose={() => setAddMethodVisible(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          {Platform.OS === 'ios'
            ? <BlurView intensity={isDark ? 60 : 45} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
            : <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />}
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setAddMethodVisible(false)} />
          <View style={{ backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: insets.bottom + 20 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)', alignSelf: 'center', marginTop: 10, marginBottom: 18 }} />
            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 18 }}>Add Payout Method</Text>

              {/* Method type picker */}
              <Text style={[s.label, { color: colors.textSecondary }]}>Method Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }} contentContainerStyle={{ gap: 8 }}>
                {METHOD_TYPES.map(mt => (
                  <TouchableOpacity
                    key={mt}
                    onPress={() => setNewMethod(prev => ({ ...prev, method_type: mt }))}
                    style={[s.chip, {
                      backgroundColor: newMethod.method_type === mt ? colors.primary : inputBg,
                      borderColor: newMethod.method_type === mt ? colors.primary : inputBorder,
                      flexDirection: 'row', alignItems: 'center', gap: 6,
                    }]}
                    activeOpacity={0.75}
                  >
                    <Ionicons name={METHOD_ICONS[mt] || 'card-outline'} size={14} color={newMethod.method_type === mt ? '#FFF' : colors.textSecondary} />
                    <Text style={{ color: newMethod.method_type === mt ? '#FFF' : colors.textSecondary, fontSize: 13, fontWeight: '600', textTransform: 'capitalize' }}>
                      {mt.replace(/_/g, ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {[
                { label: 'Account Name', key: 'account_name', placeholder: 'e.g. John Doe' },
                { label: 'Account Number / ID', key: 'account_number', placeholder: 'Account number or PayPal email' },
                { label: 'Routing Number (optional)', key: 'routing_number', placeholder: 'For bank transfers' },
                { label: 'Bank Name (optional)', key: 'bank_name', placeholder: 'e.g. Chase Bank' },
              ].map(field => (
                <View key={field.key}>
                  <Text style={[s.label, { color: colors.textSecondary }]}>{field.label}</Text>
                  <TextInput
                    style={[s.input, { backgroundColor: inputBg, borderColor: inputBorder, color: colors.text }]}
                    placeholder={field.placeholder}
                    placeholderTextColor={colors.textSecondary}
                    value={(newMethod as any)[field.key]}
                    onChangeText={val => setNewMethod(prev => ({ ...prev, [field.key]: val }))}
                    autoCapitalize="none"
                  />
                </View>
              ))}

              <TouchableOpacity
                style={[s.addMethodBtn, { backgroundColor: colors.primary, marginTop: 8, opacity: savingMethod ? 0.7 : 1 }]}
                onPress={handleSaveMethod}
                disabled={savingMethod}
                activeOpacity={0.85}
              >
                {savingMethod ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="save-outline" size={18} color="#FFF" />}
                <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700', marginLeft: 8 }}>{savingMethod ? 'Saving...' : 'Save Method'}</Text>
              </TouchableOpacity>
            </ScrollView>
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
  cardLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
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
  chip: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
  },
  addMethodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 50,
    paddingVertical: 15,
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 4,
  },
  input: {
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 12,
  },
});
