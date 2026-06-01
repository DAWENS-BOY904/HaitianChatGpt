import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { useAuth, getSupabaseClient, useAlert } from '@/template';

export default function NewDeviceVerifyScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showAlert } = useAlert();
  const { user } = useAuth();
  const params = useLocalSearchParams<{
    device?: string;
    location?: string;
    time?: string;
    sessionId?: string;
  }>();

  const [approving, setApproving] = useState(false);
  const [denying, setDenying] = useState(false);
  const [status, setStatus] = useState<'pending' | 'approved' | 'denied'>('pending');

  const deviceName = params.device || 'Web Browser';
  const location = params.location || 'Unknown location';
  const loginTime = params.time
    ? new Date(params.time).toLocaleString()
    : new Date().toLocaleString();

  const handleApprove = async () => {
    setApproving(true);
    try {
      const supabase = getSupabaseClient();
      // Log the approval in activity_logs
      if (user?.id) {
        await supabase.from('activity_logs').insert({
          user_id: user.id,
          action: 'Web login approved from mobile device',
          action_type: 'web_login_approved',
          details: {
            device: deviceName,
            location,
            loginTime,
            sessionId: params.sessionId,
            approvedAt: new Date().toISOString(),
            platform: Platform.OS,
          },
        });
      }
      setStatus('approved');
      setTimeout(() => router.back(), 1800);
    } catch (e: any) {
      showAlert('Error', e?.message || 'Failed to approve. Please try again.');
    } finally {
      setApproving(false);
    }
  };

  const handleDeny = async () => {
    setDenying(true);
    try {
      const supabase = getSupabaseClient();
      if (user?.id) {
        await supabase.from('activity_logs').insert({
          user_id: user.id,
          action: 'Web login denied from mobile device',
          action_type: 'web_login_denied',
          details: {
            device: deviceName,
            location,
            loginTime,
            sessionId: params.sessionId,
            deniedAt: new Date().toISOString(),
            platform: Platform.OS,
          },
        });
      }
      setStatus('denied');
      setTimeout(() => router.back(), 1800);
    } catch (e: any) {
      showAlert('Error', e?.message || 'Failed to deny. Please try again.');
    } finally {
      setDenying(false);
    }
  };

  const bg = isDark ? '#000' : '#F2F2F7';
  const cardBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const textC = colors.text;
  const subC = colors.textSecondary;
  const borderC = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

  if (status === 'approved') {
    return (
      <View style={[styles.container, { backgroundColor: bg, paddingTop: insets.top }]}>
        <View style={styles.resultContainer}>
          <View style={[styles.resultIcon, { backgroundColor: 'rgba(52,199,89,0.15)' }]}>
            <Ionicons name="checkmark-circle" size={56} color="#34C759" />
          </View>
          <Text style={[styles.resultTitle, { color: textC }]}>Access Approved</Text>
          <Text style={[styles.resultSub, { color: subC }]}>
            The web session has been granted access. You can now continue on the web.
          </Text>
        </View>
      </View>
    );
  }

  if (status === 'denied') {
    return (
      <View style={[styles.container, { backgroundColor: bg, paddingTop: insets.top }]}>
        <View style={styles.resultContainer}>
          <View style={[styles.resultIcon, { backgroundColor: 'rgba(255,59,48,0.12)' }]}>
            <Ionicons name="close-circle" size={56} color="#FF3B30" />
          </View>
          <Text style={[styles.resultTitle, { color: textC }]}>Access Denied</Text>
          <Text style={[styles.resultSub, { color: subC }]}>
            The web login attempt has been blocked. If this was not you, please change your password immediately.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bg, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)' }]}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={20} color={textC} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textC }]}>New Login Alert</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Warning icon */}
        <View style={styles.iconArea}>
          <View style={[styles.alertIconRing, { backgroundColor: 'rgba(255,159,10,0.12)', borderColor: 'rgba(255,159,10,0.25)' }]}>
            <Ionicons name="shield-checkmark-outline" size={44} color="#FF9F0A" />
          </View>
        </View>

        <Text style={[styles.title, { color: textC }]}>New Web Login</Text>
        <Text style={[styles.subtitle, { color: subC }]}>
          Someone is trying to sign in to your account from a web browser. Was this you?
        </Text>

        {/* Details card */}
        <View style={[styles.detailsCard, { backgroundColor: cardBg, borderColor: borderC }]}>
          <DetailRow
            icon="globe-outline"
            label="Device"
            value={deviceName}
            textC={textC}
            subC={subC}
            borderC={borderC}
          />
          <DetailRow
            icon="location-outline"
            label="Location"
            value={location}
            textC={textC}
            subC={subC}
            borderC={borderC}
          />
          <DetailRow
            icon="time-outline"
            label="Time"
            value={loginTime}
            textC={textC}
            subC={subC}
            borderC={borderC}
            last
          />
        </View>

        {/* Info notice */}
        <View style={[styles.noticeBox, { backgroundColor: isDark ? 'rgba(255,159,10,0.08)' : 'rgba(255,159,10,0.06)', borderColor: 'rgba(255,159,10,0.2)' }]}>
          <Ionicons name="information-circle-outline" size={16} color="#FF9F0A" />
          <Text style={[styles.noticeText, { color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)' }]}>
            If you did not initiate this login, tap <Text style={{ fontWeight: '700' }}>"Deny Access"</Text> immediately and change your password.
          </Text>
        </View>

        {/* Action buttons */}
        <TouchableOpacity
          style={[styles.approveBtn, { opacity: approving ? 0.7 : 1 }]}
          onPress={handleApprove}
          disabled={approving || denying}
        >
          {approving ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#FFF" />
              <Text style={styles.approveBtnText}>Yes, Approve Access</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.denyBtn, { backgroundColor: isDark ? 'rgba(255,59,48,0.12)' : 'rgba(255,59,48,0.08)', borderColor: 'rgba(255,59,48,0.25)', opacity: denying ? 0.7 : 1 }]}
          onPress={handleDeny}
          disabled={approving || denying}
        >
          {denying ? (
            <ActivityIndicator color="#FF3B30" size="small" />
          ) : (
            <>
              <Ionicons name="close-circle" size={20} color="#FF3B30" />
              <Text style={[styles.denyBtnText, { color: '#FF3B30' }]}>Deny Access</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={[styles.footerNote, { color: subC }]}>
          This notification was sent to protect your account from unauthorized access.
        </Text>
      </ScrollView>
    </View>
  );
}

function DetailRow({
  icon,
  label,
  value,
  textC,
  subC,
  borderC,
  last,
}: {
  icon: any;
  label: string;
  value: string;
  textC: string;
  subC: string;
  borderC: string;
  last?: boolean;
}) {
  return (
    <View style={[detailStyles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: borderC }]}>
      <View style={detailStyles.iconWrap}>
        <Ionicons name={icon} size={18} color={subC} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[detailStyles.label, { color: subC }]}>{label}</Text>
        <Text style={[detailStyles.value, { color: textC }]}>{value}</Text>
      </View>
    </View>
  );
}

const detailStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  value: {
    fontSize: 15,
    fontWeight: '500',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  iconArea: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  alertIconRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  detailsCard: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
    overflow: 'hidden',
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 28,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  approveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#34C759',
    borderRadius: 50,
    paddingVertical: 16,
    marginBottom: 12,
  },
  approveBtnText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
  },
  denyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 50,
    paddingVertical: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  denyBtnText: {
    fontSize: 17,
    fontWeight: '700',
  },
  footerNote: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  resultContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  resultIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  resultTitle: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  resultSub: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
});
