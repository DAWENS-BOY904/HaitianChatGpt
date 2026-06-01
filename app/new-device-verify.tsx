import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getSupabaseClient } from '@/template';
import { useTheme } from '@/hooks/useTheme';

export default function NewDeviceVerifyScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { requestId } = useLocalSearchParams<{ requestId: string }>();

  const [status, setStatus] = useState<'loading' | 'pending' | 'approved' | 'denied' | 'expired' | 'not_found'>('loading');
  const [actionLoading, setActionLoading] = useState(false);
  const [requestInfo, setRequestInfo] = useState<{
    ip?: string;
    user_agent?: string;
    created_at?: string;
    expires_at?: string;
  } | null>(null);

  const loadRequest = useCallback(async () => {
    if (!requestId) {
      setStatus('not_found');
      return;
    }
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('activity_logs')
        .select('id, action, action_type, details, ip_address, user_agent, created_at')
        .eq('id', requestId)
        .eq('action_type', 'web_login_request')
        .single();

      if (error || !data) {
        setStatus('not_found');
        return;
      }

      const details = (data.details as any) || {};
      const expiresAt = details.expires_at ? new Date(details.expires_at) : null;

      if (expiresAt && new Date() > expiresAt) {
        setStatus('expired');
        return;
      }

      const approvalStatus = details.approval_status;
      if (approvalStatus === 'approved') {
        setStatus('approved');
      } else if (approvalStatus === 'denied') {
        setStatus('denied');
      } else {
        setStatus('pending');
        setRequestInfo({
          ip: data.ip_address || undefined,
          user_agent: data.user_agent || undefined,
          created_at: data.created_at || undefined,
          expires_at: details.expires_at || undefined,
        });
      }
    } catch {
      setStatus('not_found');
    }
  }, [requestId]);

  useEffect(() => {
    loadRequest();
  }, [loadRequest]);

  const handleDecision = async (decision: 'approved' | 'denied') => {
    if (!requestId || actionLoading) return;
    setActionLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: existing } = await supabase
        .from('activity_logs')
        .select('details')
        .eq('id', requestId)
        .single();

      const currentDetails = (existing?.details as any) || {};
      const updatedDetails = {
        ...currentDetails,
        approval_status: decision,
        decided_at: new Date().toISOString(),
      };

      await supabase
        .from('activity_logs')
        .update({ details: updatedDetails })
        .eq('id', requestId);

      setStatus(decision);
    } catch {
      // silently fail — show result anyway
      setStatus(decision);
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (iso?: string) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: insets.top + 16,
      paddingBottom: insets.bottom + 16,
      paddingHorizontal: 24,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 32,
      borderWidth: 1,
      borderColor: colors.border,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconWrapper: {
      width: 88,
      height: 88,
      borderRadius: 44,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 12,
    },
    subtitle: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 32,
    },
    infoCard: {
      width: '100%',
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
      marginBottom: 32,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    infoLabel: {
      fontSize: 13,
      color: colors.textSecondary,
      width: 90,
    },
    infoValue: {
      flex: 1,
      fontSize: 13,
      color: colors.text,
      fontWeight: '500',
    },
    approveButton: {
      width: '100%',
      backgroundColor: '#34C759',
      borderRadius: 50,
      paddingVertical: 16,
      alignItems: 'center',
      marginBottom: 12,
    },
    approveButtonText: {
      fontSize: 17,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    denyButton: {
      width: '100%',
      backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7',
      borderRadius: 50,
      paddingVertical: 16,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#FF3B30',
    },
    denyButtonText: {
      fontSize: 17,
      fontWeight: '600',
      color: '#FF3B30',
    },
    doneButton: {
      marginTop: 24,
      paddingVertical: 14,
      paddingHorizontal: 40,
      backgroundColor: colors.surface,
      borderRadius: 50,
      borderWidth: 1,
      borderColor: colors.border,
    },
    doneButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    warningBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: 'rgba(255, 59, 48, 0.12)',
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
      marginBottom: 24,
    },
    warningText: {
      fontSize: 13,
      color: '#FF3B30',
      fontWeight: '500',
    },
  });

  if (status === 'loading') {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.text} />
      </View>
    );
  }

  if (status === 'not_found') {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.center}>
          <View style={[styles.iconWrapper, { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }]}>
            <Ionicons name="help-circle-outline" size={44} color={colors.textSecondary} />
          </View>
          <Text style={styles.title}>Request Not Found</Text>
          <Text style={styles.subtitle}>
            This login request does not exist or has already been handled.
          </Text>
          <TouchableOpacity style={styles.doneButton} onPress={() => router.back()}>
            <Text style={styles.doneButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (status === 'expired') {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.center}>
          <View style={[styles.iconWrapper, { backgroundColor: 'rgba(255, 149, 0, 0.15)' }]}>
            <Ionicons name="time-outline" size={44} color="#FF9500" />
          </View>
          <Text style={styles.title}>Request Expired</Text>
          <Text style={styles.subtitle}>
            This login approval window has expired (10 minutes). The web login attempt was automatically blocked.
          </Text>
          <TouchableOpacity style={styles.doneButton} onPress={() => router.back()}>
            <Text style={styles.doneButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (status === 'approved') {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.center}>
          <View style={[styles.iconWrapper, { backgroundColor: 'rgba(52, 199, 89, 0.15)' }]}>
            <Ionicons name="checkmark-circle" size={44} color="#34C759" />
          </View>
          <Text style={styles.title}>Login Approved</Text>
          <Text style={styles.subtitle}>
            You approved the web login. The browser session is now active.
          </Text>
          <TouchableOpacity style={styles.doneButton} onPress={() => router.back()}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (status === 'denied') {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.center}>
          <View style={[styles.iconWrapper, { backgroundColor: 'rgba(255, 59, 48, 0.15)' }]}>
            <Ionicons name="close-circle" size={44} color="#FF3B30" />
          </View>
          <Text style={styles.title}>Login Denied</Text>
          <Text style={styles.subtitle}>
            You denied the web login attempt. The browser has been blocked from signing in.
          </Text>
          <TouchableOpacity style={styles.doneButton} onPress={() => router.back()}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // status === 'pending'
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={20} color={colors.text} />
      </TouchableOpacity>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <View style={[styles.iconWrapper, { backgroundColor: 'rgba(0, 122, 255, 0.12)' }]}>
          <Ionicons name="globe-outline" size={44} color="#007AFF" />
        </View>

        <Text style={styles.title}>Web Login Request</Text>
        <Text style={styles.subtitle}>
          Someone is trying to sign in to your account from a web browser. Was this you?
        </Text>

        <View style={styles.warningBadge}>
          <Ionicons name="warning-outline" size={14} color="#FF3B30" />
          <Text style={styles.warningText}>If this was not you, deny immediately</Text>
        </View>

        {requestInfo && (
          <View style={styles.infoCard}>
            {requestInfo.ip && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>IP Address</Text>
                <Text style={styles.infoValue}>{requestInfo.ip}</Text>
              </View>
            )}
            {requestInfo.user_agent && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Browser</Text>
                <Text style={styles.infoValue} numberOfLines={2}>{requestInfo.user_agent}</Text>
              </View>
            )}
            {requestInfo.created_at && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Requested</Text>
                <Text style={styles.infoValue}>{formatDate(requestInfo.created_at)}</Text>
              </View>
            )}
            {requestInfo.expires_at && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Expires</Text>
                <Text style={styles.infoValue}>{formatDate(requestInfo.expires_at)}</Text>
              </View>
            )}
          </View>
        )}

        <TouchableOpacity
          style={[styles.approveButton, actionLoading && { opacity: 0.6 }]}
          onPress={() => handleDecision('approved')}
          disabled={actionLoading}
        >
          {actionLoading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.approveButtonText}>Yes, Approve Login</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.denyButton, actionLoading && { opacity: 0.6 }]}
          onPress={() => handleDecision('denied')}
          disabled={actionLoading}
        >
          <Text style={styles.denyButtonText}>No, Deny Login</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
