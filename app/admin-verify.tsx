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
const ADMIN_EMAILS = ['berryxoe@gmail.com', 'newdawens@gmail.com', 'kontgithub@gmail.com'];

interface BugReport {
  id: string;
  user_id?: string;
  description: string;
  device_info?: Record<string, any>;
  status: string;
  created_at: string;
  updated_at: string;
  email?: string;
  username?: string;
}

interface RoleApplication {
  id: string;
  full_name: string;
  email: string;
  desired_role: string;
  skills: string;
  experience_level: string;
  portfolio_url?: string;
  github_url?: string;
  availability: string;
  motivation: string;
  status: string;
  reviewed_by?: string;
  reviewed_at?: string;
  notes?: string;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#FF9F0A',
  reviewing: '#007AFF',
  resolved: '#34C759',
  rejected: '#FF453A',
  approved: '#34C759',
  closed: '#8E8E93',
};

const STATUS_ICONS: Record<string, any> = {
  pending: 'time-outline',
  reviewing: 'eye-outline',
  resolved: 'checkmark-circle-outline',
  rejected: 'close-circle-outline',
  approved: 'checkmark-circle',
  closed: 'archive-outline',
};

export default function AdminVerifyScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  const isAdmin = user?.email ? ADMIN_EMAILS.includes(user.email.toLowerCase()) : false;

  const [activeTab, setActiveTab] = useState<'bugs' | 'applications'>('bugs');
  const [bugReports, setBugReports] = useState<BugReport[]>([]);
  const [applications, setApplications] = useState<RoleApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [selectedBug, setSelectedBug] = useState<BugReport | null>(null);
  const [selectedApp, setSelectedApp] = useState<RoleApplication | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [updating, setUpdating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!isAdmin) { router.replace('/home'); return; }
    loadAll();
  }, [isAdmin]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.allSettled([loadBugReports(), loadApplications()]);
    setLoading(false);
  }, []);

  const loadBugReports = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('bug_reports')
        .select('id, user_id, description, device_info, status, created_at, updated_at')
        .order('created_at', { ascending: false })
        .limit(50);
      if (data) {
        const enriched: BugReport[] = await Promise.all(
          data.map(async (report) => {
            if (!report.user_id) return report;
            const { data: prof } = await supabase
              .from('user_profiles')
              .select('email, username')
              .eq('id', report.user_id)
              .single();
            return { ...report, email: prof?.email, username: prof?.username };
          })
        );
        setBugReports(enriched);
      }
    } catch (_e) {}
  }, [supabase]);

  const loadApplications = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('role_applications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (data) setApplications(data as RoleApplication[]);
    } catch (_e) {}
  }, [supabase]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadAll().finally(() => setRefreshing(false));
  }, [loadAll]);

  const handleUpdateBugStatus = useCallback(async (bugId: string, status: string) => {
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('bug_reports')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', bugId);
      if (error) throw error;
      setBugReports(prev => prev.map(b => b.id === bugId ? { ...b, status } : b));
      if (selectedBug?.id === bugId) setSelectedBug(prev => prev ? { ...prev, status } : null);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not update status.');
    } finally { setUpdating(false); }
  }, [supabase, selectedBug]);

  const handleUpdateApplicationStatus = useCallback(async (appId: string, status: string) => {
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('role_applications')
        .update({
          status,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          notes: reviewNotes.trim() || null,
        })
        .eq('id', appId);
      if (error) throw error;
      setApplications(prev => prev.map(a => a.id === appId ? { ...a, status, notes: reviewNotes } : a));
      if (selectedApp?.id === appId) setSelectedApp(prev => prev ? { ...prev, status, notes: reviewNotes } : null);
      setReviewNotes('');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not update application.');
    } finally { setUpdating(false); }
  }, [supabase, user?.id, reviewNotes, selectedApp]);

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

  const BUG_STATUSES = ['pending', 'reviewing', 'resolved', 'closed'];
  const APP_STATUSES = ['pending', 'reviewing', 'approved', 'rejected'];

  const filteredBugs = bugReports.filter(b => {
    const matchStatus = filterStatus === 'all' || b.status === filterStatus;
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || (b.description || '').toLowerCase().includes(q) || (b.email || '').toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const filteredApps = applications.filter(a => {
    const matchStatus = filterStatus === 'all' || a.status === filterStatus;
    const q = searchQuery.toLowerCase();
    const matchSearch = !q ||
      (a.full_name || '').toLowerCase().includes(q) ||
      (a.email || '').toLowerCase().includes(q) ||
      (a.desired_role || '').toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const TABS = [
    { id: 'bugs', label: 'Bug Reports', icon: 'bug-outline', count: bugReports.filter(b => b.status === 'pending').length },
    { id: 'applications', label: 'Applications', icon: 'person-add-outline', count: applications.filter(a => a.status === 'pending').length },
  ] as const;

  // ── Detail View: Bug Report ──────────────────────────────────────────────
  if (selectedBug) {
    const statusColor = STATUS_COLORS[selectedBug.status] || '#8E8E93';
    return (
      <View style={[s.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={[s.header, { borderBottomColor: cardBorder }]}>
          <TouchableOpacity onPress={() => setSelectedBug(null)} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.text }]}>Bug Report</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, maxWidth: IS_DESKTOP ? 720 : undefined, alignSelf: IS_DESKTOP ? 'center' : undefined, width: '100%' }}
          showsVerticalScrollIndicator={false}
        >
          {/* Status badge */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <View style={{ backgroundColor: statusColor + '20', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: statusColor + '40', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name={STATUS_ICONS[selectedBug.status] || 'ellipse-outline'} size={14} color={statusColor} />
              <Text style={{ color: statusColor, fontSize: 13, fontWeight: '700', textTransform: 'capitalize' }}>{selectedBug.status}</Text>
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{formatDate(selectedBug.created_at)}</Text>
          </View>

          {/* Reporter info */}
          {selectedBug.email ? (
            <View style={[s.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <Text style={[s.cardLabel, { color: colors.textSecondary }]}>Reporter</Text>
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600', marginTop: 4 }}>
                {selectedBug.username || selectedBug.email.split('@')[0]}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>{selectedBug.email}</Text>
            </View>
          ) : null}

          {/* Description */}
          <View style={[s.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <Text style={[s.cardLabel, { color: colors.textSecondary }]}>Description</Text>
            <Text style={{ color: colors.text, fontSize: 15, lineHeight: 22, marginTop: 6 }}>{selectedBug.description}</Text>
          </View>

          {/* Device info */}
          {selectedBug.device_info && Object.keys(selectedBug.device_info).length > 0 ? (
            <View style={[s.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <Text style={[s.cardLabel, { color: colors.textSecondary }]}>Device Info</Text>
              {Object.entries(selectedBug.device_info).map(([key, val]) => (
                <View key={key} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: cardBorder }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 13, textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</Text>
                  <Text style={{ color: colors.text, fontSize: 13, fontWeight: '500', maxWidth: '60%', textAlign: 'right' }} numberOfLines={2}>{String(val)}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Status update actions */}
          <View style={[s.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <Text style={[s.cardLabel, { color: colors.textSecondary, marginBottom: 12 }]}>Update Status</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {BUG_STATUSES.map(st => {
                const stColor = STATUS_COLORS[st] || '#8E8E93';
                const isActive = selectedBug.status === st;
                return (
                  <TouchableOpacity
                    key={st}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 6,
                      backgroundColor: isActive ? stColor + '20' : inputBg,
                      borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
                      borderWidth: 1, borderColor: isActive ? stColor : inputBorder,
                    }}
                    onPress={() => handleUpdateBugStatus(selectedBug.id, st)}
                    disabled={updating || isActive}
                    activeOpacity={0.75}
                  >
                    <Ionicons name={STATUS_ICONS[st] || 'ellipse-outline'} size={14} color={isActive ? stColor : colors.textSecondary} />
                    <Text style={{ color: isActive ? stColor : colors.textSecondary, fontSize: 13, fontWeight: '600', textTransform: 'capitalize' }}>{st}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {updating ? <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 12 }} /> : null}
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── Detail View: Role Application ────────────────────────────────────────
  if (selectedApp) {
    const statusColor = STATUS_COLORS[selectedApp.status] || '#8E8E93';
    return (
      <View style={[s.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={[s.header, { borderBottomColor: cardBorder }]}>
          <TouchableOpacity onPress={() => { setSelectedApp(null); setReviewNotes(''); }} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.text }]}>Application</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, maxWidth: IS_DESKTOP ? 720 : undefined, alignSelf: IS_DESKTOP ? 'center' : undefined, width: '100%' }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <View style={{ backgroundColor: statusColor + '20', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: statusColor + '40', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name={STATUS_ICONS[selectedApp.status] || 'ellipse-outline'} size={14} color={statusColor} />
              <Text style={{ color: statusColor, fontSize: 13, fontWeight: '700', textTransform: 'capitalize' }}>{selectedApp.status}</Text>
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{formatDate(selectedApp.created_at)}</Text>
          </View>

          {/* Applicant */}
          <View style={[s.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primary + '22', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: colors.primary, fontSize: 22, fontWeight: '700' }}>
                  {(selectedApp.full_name || '?')[0].toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>{selectedApp.full_name}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>{selectedApp.email}</Text>
              </View>
            </View>
            {[
              { label: 'Desired Role', value: selectedApp.desired_role },
              { label: 'Experience', value: selectedApp.experience_level },
              { label: 'Availability', value: selectedApp.availability },
            ].map((row, i) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: cardBorder }}>
                <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{row.label}</Text>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{row.value}</Text>
              </View>
            ))}
          </View>

          {/* Skills */}
          <View style={[s.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <Text style={[s.cardLabel, { color: colors.textSecondary }]}>Skills</Text>
            <Text style={{ color: colors.text, fontSize: 14, lineHeight: 21, marginTop: 6 }}>{selectedApp.skills}</Text>
          </View>

          {/* Motivation */}
          <View style={[s.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <Text style={[s.cardLabel, { color: colors.textSecondary }]}>Motivation</Text>
            <Text style={{ color: colors.text, fontSize: 14, lineHeight: 21, marginTop: 6 }}>{selectedApp.motivation}</Text>
          </View>

          {/* Links */}
          {(selectedApp.portfolio_url || selectedApp.github_url) ? (
            <View style={[s.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <Text style={[s.cardLabel, { color: colors.textSecondary, marginBottom: 10 }]}>Links</Text>
              {selectedApp.portfolio_url ? (
                <Text style={{ color: colors.primary, fontSize: 14, marginBottom: 6 }} numberOfLines={1}>{selectedApp.portfolio_url}</Text>
              ) : null}
              {selectedApp.github_url ? (
                <Text style={{ color: colors.primary, fontSize: 14 }} numberOfLines={1}>{selectedApp.github_url}</Text>
              ) : null}
            </View>
          ) : null}

          {/* Previous notes */}
          {selectedApp.notes ? (
            <View style={[s.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <Text style={[s.cardLabel, { color: colors.textSecondary }]}>Previous Notes</Text>
              <Text style={{ color: colors.text, fontSize: 14, lineHeight: 21, marginTop: 6 }}>{selectedApp.notes}</Text>
            </View>
          ) : null}

          {/* Review notes */}
          <View style={[s.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <Text style={[s.cardLabel, { color: colors.textSecondary, marginBottom: 8 }]}>Review Notes</Text>
            <TextInput
              style={[s.textarea, { backgroundColor: inputBg, borderColor: inputBorder, color: colors.text }]}
              placeholder="Add notes about this application..."
              placeholderTextColor={colors.textSecondary}
              value={reviewNotes}
              onChangeText={setReviewNotes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Action buttons */}
          <View style={[s.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <Text style={[s.cardLabel, { color: colors.textSecondary, marginBottom: 12 }]}>Decision</Text>
            <View style={{ gap: 10 }}>
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: 'rgba(52,199,89,0.12)', borderColor: 'rgba(52,199,89,0.35)', opacity: updating ? 0.6 : 1 }]}
                onPress={() => handleUpdateApplicationStatus(selectedApp.id, 'approved')}
                disabled={updating || selectedApp.status === 'approved'}
                activeOpacity={0.8}
              >
                {updating ? <ActivityIndicator size="small" color="#34C759" /> : <Ionicons name="checkmark-circle" size={18} color="#34C759" />}
                <Text style={{ color: '#34C759', fontSize: 16, fontWeight: '700', marginLeft: 8 }}>Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: 'rgba(255,69,58,0.12)', borderColor: 'rgba(255,69,58,0.35)', opacity: updating ? 0.6 : 1 }]}
                onPress={() => handleUpdateApplicationStatus(selectedApp.id, 'rejected')}
                disabled={updating || selectedApp.status === 'rejected'}
                activeOpacity={0.8}
              >
                <Ionicons name="close-circle" size={18} color="#FF453A" />
                <Text style={{ color: '#FF453A', fontSize: 16, fontWeight: '700', marginLeft: 8 }}>Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: 'rgba(0,122,255,0.12)', borderColor: 'rgba(0,122,255,0.35)', opacity: updating ? 0.6 : 1 }]}
                onPress={() => handleUpdateApplicationStatus(selectedApp.id, 'reviewing')}
                disabled={updating || selectedApp.status === 'reviewing'}
                activeOpacity={0.8}
              >
                <Ionicons name="eye" size={18} color="#007AFF" />
                <Text style={{ color: '#007AFF', fontSize: 16, fontWeight: '700', marginLeft: 8 }}>Mark as Reviewing</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── List View ─────────────────────────────────────────────────────────────
  return (
    <View style={[s.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: cardBorder }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.text }]}>Verify & Review</Text>
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
              onPress={() => { setActiveTab(tab.id); setFilterStatus('pending'); setSearchQuery(''); }}
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
              {tab.count > 0 ? (
                <View style={{ backgroundColor: active ? 'rgba(255,255,255,0.3)' : '#FF453A', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1, marginLeft: 2 }}>
                  <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '800' }}>{tab.count}</Text>
                </View>
              ) : null}
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
        {/* Search bar */}
        <View style={[s.searchBar, { backgroundColor: inputBg, borderColor: inputBorder }]}>
          <Ionicons name="search" size={16} color={colors.textSecondary} />
          <TextInput
            style={{ flex: 1, color: colors.text, fontSize: 15, marginLeft: 8, paddingVertical: 0 }}
            placeholder={activeTab === 'bugs' ? 'Search bug reports...' : 'Search applications...'}
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

        {/* Status filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }} contentContainerStyle={{ gap: 7 }}>
          {['all', ...(activeTab === 'bugs' ? BUG_STATUSES : APP_STATUSES)].map(st => {
            const isActive = filterStatus === st;
            const stColor = STATUS_COLORS[st] || colors.primary;
            return (
              <TouchableOpacity
                key={st}
                onPress={() => setFilterStatus(st)}
                style={[s.chip, {
                  backgroundColor: isActive ? stColor + '22' : inputBg,
                  borderColor: isActive ? stColor : inputBorder,
                }]}
                activeOpacity={0.75}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: isActive ? stColor : colors.textSecondary, textTransform: 'capitalize' }}>{st}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 48 }} />
        ) : activeTab === 'bugs' ? (
          <>
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 10 }}>
              {filteredBugs.length} report{filteredBugs.length !== 1 ? 's' : ''}
            </Text>
            {filteredBugs.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 48 }}>
                <Ionicons name="bug-outline" size={48} color={colors.textSecondary} />
                <Text style={{ color: colors.textSecondary, fontSize: 16, marginTop: 14 }}>No bug reports found</Text>
              </View>
            ) : (
              <View style={[s.card, { backgroundColor: cardBg, borderColor: cardBorder, padding: 0, overflow: 'hidden' }]}>
                {filteredBugs.map((bug, i) => {
                  const statusColor = STATUS_COLORS[bug.status] || '#8E8E93';
                  return (
                    <TouchableOpacity
                      key={bug.id}
                      style={[s.listRow, { borderBottomColor: cardBorder, borderBottomWidth: i < filteredBugs.length - 1 ? StyleSheet.hairlineWidth : 0 }]}
                      onPress={() => setSelectedBug(bug)}
                      activeOpacity={0.7}
                    >
                      <View style={[s.listIcon, { backgroundColor: statusColor + '18' }]}>
                        <Ionicons name={STATUS_ICONS[bug.status] || 'bug-outline'} size={16} color={statusColor} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }} numberOfLines={2}>{bug.description}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
                          {bug.email ? (
                            <Text style={{ color: colors.textSecondary, fontSize: 11 }} numberOfLines={1}>{bug.email}</Text>
                          ) : null}
                          <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{formatDate(bug.created_at)}</Text>
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 4, marginLeft: 8 }}>
                        <View style={{ backgroundColor: statusColor + '18', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 }}>
                          <Text style={{ color: statusColor, fontSize: 10, fontWeight: '700', textTransform: 'capitalize' }}>{bug.status}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </>
        ) : (
          <>
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 10 }}>
              {filteredApps.length} application{filteredApps.length !== 1 ? 's' : ''}
            </Text>
            {filteredApps.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 48 }}>
                <Ionicons name="person-add-outline" size={48} color={colors.textSecondary} />
                <Text style={{ color: colors.textSecondary, fontSize: 16, marginTop: 14 }}>No applications found</Text>
              </View>
            ) : (
              <View style={[s.card, { backgroundColor: cardBg, borderColor: cardBorder, padding: 0, overflow: 'hidden' }]}>
                {filteredApps.map((app, i) => {
                  const statusColor = STATUS_COLORS[app.status] || '#8E8E93';
                  return (
                    <TouchableOpacity
                      key={app.id}
                      style={[s.listRow, { borderBottomColor: cardBorder, borderBottomWidth: i < filteredApps.length - 1 ? StyleSheet.hairlineWidth : 0 }]}
                      onPress={() => setSelectedApp(app)}
                      activeOpacity={0.7}
                    >
                      <View style={[s.userAvatar, { backgroundColor: colors.primary + '22' }]}>
                        <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '700' }}>
                          {(app.full_name || '?')[0].toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>{app.full_name}</Text>
                        <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 1 }} numberOfLines={1}>{app.desired_role}</Text>
                        <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>{formatDate(app.created_at)}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 4, marginLeft: 8 }}>
                        <View style={{ backgroundColor: statusColor + '18', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 }}>
                          <Text style={{ color: statusColor, fontSize: 10, fontWeight: '700', textTransform: 'capitalize' }}>{app.status}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </>
        )}
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
  cardLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  listIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textarea: {
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 100,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
  },
});
