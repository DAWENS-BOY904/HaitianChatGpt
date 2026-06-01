import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';
import { useTheme } from '../hooks/useTheme';

export default function NewDeviceVerifyScreen() {
  const { isDark, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ requestId?: string; sessionId?: string; platform?: string; location?: string }>();

  const [status, setStatus] = useState<'pending' | 'approved' | 'denied' | 'expired' | 'loading'>('loading');
  const [actionLoading, setActionLoading] = useState(false);

  const bg = isDark ? '#000' : '#F2F2F7';
  const cardBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const textC = isDark ? '#FFFFFF' : '#000000';
  const subC = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';
  const borderC = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  useEffect(() => {
    checkRequestStatus();
  }, []);

  const checkRequestStatus = async () => {
    setStatus('loading');
    try {
      const requestId = params.requestId;
      if (!requestId) {
        setStatus('pending');
        return;
      }
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('activity_logs')
        .select('details, created_at')
        .eq('id', requestId)
        .single();

      if (error || !data) {
        setStatus('pending');
        return;
      }

      const details = data.details as any;
      const expiresAt = details?.expires_at ? new Date(details.expires_at).getTime() : 0;
      if (expiresAt && Date.now() > expiresAt) {
        setStatus('expired');
        return;
      }

      const currentStatus = details?.approval_status;
      if (currentStatus === 'approved') setStatus('approved');
      else if (currentStatus === 'denied') setStatus('denied');
      else setStatus('pending');
    } catch {
      setStatus('pending');
    }
  };

  const handleAction = async (action: 'approve' | 'deny') => {
    setActionLoading(true);
    try {
      const requestId = params.requestId;
      const supabase = getSupabaseClient();

      if (requestId) {
        const { data: existing } = await supabase
          .from('activity_logs')
          .select('details')
          .eq('id', requestId)
          .single();

        const currentDetails = (existing?.details as any) || {};
        await supabase
          .from('activity_logs')
          .update({
            details: {
              ...currentDetails,
              approval_status: action === 'approve' ? 'approved' : 'denied',
              actioned_at: new Date().toISOString(),
            },
          })
          .eq('id', requestId);
      }

      setStatus(action === 'approve' ? 'approved' : 'denied');
    } catch {
      setStatus(action === 'approve' ? 'approved' : 'denied');
    } finally {
      setActionLoading(false);
    }
  };

  const renderContent = () => {
    if (status === 'loading') {
      return (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#10A37F" />
          <Text style={[styles.loadingText, { color: subC }]}>Checking request...</Text>
        </View>
      );
    }

    if (status === 'expired') {
      return (
        <View style={styles.centerContent}>
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(255,159,10,0.15)' }]}>
            <Ionicons name="time-outline" size={40} color="#FF9F0A" />
          </View>
          <Text style={[styles.statusTitle, { color: textC }]}>Request Expired</Text>
          <Text style={[styles.statusSub, { color: subC }]}>
            This web login approval request has expired. The session is no longer valid.
          </Text>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)' }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.actionBtnText, { color: textC }]}>Go Back</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (status === 'approved') {
      return (
        <View style={styles.centerContent}>
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(52,199,89,0.15)' }]}>
            <Ionicons name="checkmark-circle" size={40} color="#34C759" />
          </View>
          <Text style={[styles.statusTitle, { color: textC }]}>Login Approved</Text>
          <Text style={[styles.statusSub, { color: subC }]}>
            You have approved the web login request. The session is now active.
          </Text>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#34C759' }]}
            onPress={() => router.replace('/home')}
          >
            <Text style={[styles.actionBtnText, { color: '#FFF' }]}>Continue</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (status === 'denied') {
      return (
        <View style={styles.centerContent}>
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(255,69,58,0.15)' }]}>
            <Ionicons name="close-circle" size={40} color="#FF453A" />
          </View>
          <Text style={[styles.statusTitle, { color: textC }]}>Login Blocked</Text>
          <Text style={[styles.statusSub, { color: subC }]}>
            You have denied the web login request. The session has been blocked.
          </Text>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)' }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.actionBtnText, { color: textC }]}>Go Back</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // pending
    return (
      <View style={{ gap: 16 }}>
        {/* Warning card */}
        <View style={[styles.warningCard, { backgroundColor: 'rgba(255,159,10,0.12)', borderColor: 'rgba(255,159,10,0.25)' }]}>
          <Ionicons name="warning-outline" size={20} color="#FF9F0A" />
          <Text style={{ color: '#FF9F0A', fontSize: 14, fontWeight: '600', flex: 1 }}>
            New login attempt detected on web
          </Text>
        </View>

        {/* Info card */}
        <View style={[styles.infoCard, { backgroundColor: cardBg, borderColor: borderC }]}>
          <View style={styles.infoRow}>
            <Ionicons name="globe-outline" size={18} color={subC} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.infoLabel, { color: subC }]}>Platform</Text>
              <Text style={[styles.infoValue, { color: textC }]}>{params.platform || 'Web Browser'}</Text>
            </View>
          </View>
          <View style={[styles.separator, { backgroundColor: borderC }]} />
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={18} color={subC} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.infoLabel, { color: subC }]}>Location</Text>
              <Text style={[styles.infoValue, { color: textC }]}>{params.location || 'Unknown location'}</Text>
            </View>
          </View>
          <View style={[styles.separator, { backgroundColor: borderC }]} />
          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={18} color={subC} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.infoLabel, { color: subC }]}>Expires in</Text>
              <Text style={[styles.infoValue, { color: textC }]}>10 minutes</Text>
            </View>
          </View>
        </View>

        <Text style={[styles.question, { color: textC }]}>
          Was this you? Do you want to allow this login?
        </Text>

        {/* Action buttons */}
        <TouchableOpacity
          style={[styles.approveBtn, { opacity: actionLoading ? 0.7 : 1 }]}
          onPress={() => handleAction('approve')}
          disabled={actionLoading}
        >
          {actionLoading ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#FFF" />
              <Text style={styles.approveBtnText}>Yes, Allow Login</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.denyBtn, { borderColor: '#FF453A', opacity: actionLoading ? 0.7 : 1 }]}
          onPress={() => handleAction('deny')}
          disabled={actionLoading}
        >
          <Ionicons name="close-circle" size={20} color="#FF453A" />
          <Text style={[styles.denyBtnText]}>No, Block Login</Text>
        </TouchableOpacity>

        <Text style={[styles.securityNote, { color: subC }]}>
          If you did not attempt to log in, deny this request immediately and consider changing your password.
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: bg, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)' }]}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={20} color={textC} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textC }]}>Web Login Request</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Shield icon */}
        <View style={[styles.shieldWrap, { backgroundColor: isDark ? 'rgba(16,163,127,0.15)' : 'rgba(16,163,127,0.1)' }]}>
          <Ionicons name="shield-checkmark-outline" size={36} color="#10A37F" />
        </View>

        <Text style={[styles.title, { color: textC }]}>Web Login Verification</Text>
        <Text style={[styles.subtitle, { color: subC }]}>
          Someone is trying to access your account from a web browser. Approve or deny below.
        </Text>

        {renderContent()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  content: { paddingHorizontal: 20, paddingTop: 16 },
  shieldWrap: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginBottom: 16,
  },
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  warningCard: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, padding: 14, borderRadius: 14, borderWidth: 1,
  },
  infoCard: {
    borderRadius: 16, overflow: 'hidden', borderWidth: 1,
  },
  infoRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    gap: 12, paddingHorizontal: 16, paddingVertical: 14,
  },
  separator: { height: 1, marginHorizontal: 16 },
  infoLabel: { fontSize: 12, marginBottom: 2 },
  infoValue: { fontSize: 15, fontWeight: '500' },
  question: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  approveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#10A37F', borderRadius: 50,
    paddingVertical: 16,
  },
  approveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  denyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 50, paddingVertical: 16, borderWidth: 1.5,
  },
  denyBtnText: { color: '#FF453A', fontSize: 16, fontWeight: '700' },
  securityNote: { fontSize: 12, textAlign: 'center', lineHeight: 18 },
  centerContent: { alignItems: 'center', paddingVertical: 24, gap: 16 },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
  },
  statusTitle: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  statusSub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  actionBtn: {
    borderRadius: 50, paddingHorizontal: 32, paddingVertical: 14,
    alignItems: 'center', marginTop: 8,
  },
  actionBtnText: { fontSize: 16, fontWeight: '600' },
  loadingText: { fontSize: 14, marginTop: 12 },
});
