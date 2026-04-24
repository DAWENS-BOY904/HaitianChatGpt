import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Platform,
  Modal,
  Pressable,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { useTheme } from '../hooks/useTheme';
import { useSettings } from '../hooks/useSettings';

// Location permission — expo-location (graceful fallback if not linked)
let Location: any = null;
try { Location = require('expo-location'); } catch {}

type LocationStatus = 'unknown' | 'granted' | 'denied' | 'asking';

export default function DataControlsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { showAlert } = useAlert();
  const { isDark } = useTheme();
  const { settings, updateSetting } = useSettings();
  const supabase = getSupabaseClient();

  const [improveModel, setImproveModel] = useState(true);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('unknown');
  const [locationLoading, setLocationLoading] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportRequested, setExportRequested] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Theme tokens ──────────────────────────────────────────────────────────
  const bg = isDark ? '#000000' : '#F2F2F7';
  const cardBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const primaryText = isDark ? '#FFFFFF' : '#000000';
  const secondaryText = '#8E8E93';
  const divider = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const backBtnBg = isDark ? '#2C2C2E' : 'rgba(0,0,0,0.08)';
  const headerBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const dangerRed = '#FF453A';
  const green = '#34C759';

  // Check location permission on mount
  useEffect(() => {
    checkLocationPermission();
  }, []);

  const checkLocationPermission = async () => {
    if (!Location) return;
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      setLocationStatus(status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'unknown');
    } catch { }
  };

  const handleLocationToggle = async (val: boolean) => {
    if (!val) {
      // Direct user to system settings to revoke
      showAlert(
        'Disable Location',
        'To disable location access, go to your device Settings and revoke permission for this app.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }
    if (!Location) {
      showAlert('Not available', 'Location services are not available on this platform.');
      return;
    }
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setLocationStatus('granted');
      } else {
        setLocationStatus('denied');
        showAlert(
          'Permission denied',
          'Location access was denied. You can enable it in your device Settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
      }
    } catch (e: any) {
      showAlert('Error', e?.message || 'Failed to request location permission');
    } finally {
      setLocationLoading(false);
    }
  };

  const handleArchiveAll = async () => {
    showAlert('Archive all chats?', 'All your conversations will be archived. You can find them in Archived Chats.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive All',
        style: 'destructive',
        onPress: async () => {
          if (!user) return;
          setArchiving(true);
          try {
            await supabase
              .from('conversations')
              .update({ is_archived: true })
              .eq('user_id', user.id)
              .eq('is_archived', false);
            showAlert('Done', 'All chats have been archived.');
          } catch {
            showAlert('Error', 'Failed to archive chats. Please try again.');
          } finally {
            setArchiving(false);
          }
        },
      },
    ]);
  };

  const handleDeleteAll = async () => {
    showAlert(
      'Delete all chats?',
      'This will permanently delete all your conversations and messages. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            if (!user) return;
            setDeleting(true);
            try {
              // Delete all conversations (messages cascade via FK)
              await supabase.from('conversations').delete().eq('user_id', user.id);
              showAlert('Done', 'All chats have been permanently deleted.');
            } catch {
              showAlert('Error', 'Failed to delete chats. Please try again.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const handleExportData = () => {
    setShowExportModal(true);
  };

  const confirmExport = async () => {
    setExportRequested(true);
    // In a real app, trigger an admin-side export job
    try {
      // Log export request
      await supabase.from('activity_logs').insert({
        user_id: user?.id,
        action: 'data_export_requested',
        action_type: 'data',
        details: { email: user?.email, requested_at: new Date().toISOString() },
      });
    } catch { }

    setTimeout(() => {
      setShowExportModal(false);
      setExportRequested(false);
      showAlert('Export requested', 'Your data export has been requested. An admin will prepare and deliver your data to your email within 24 hours.');
    }, 1500);
  };

  const handleDeleteAccount = () => {
    showAlert(
      'Delete Account',
      'This will permanently delete your account and ALL associated data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            if (!user) return;
            await supabase.from('user_profiles').delete().eq('id', user.id);
            await logout();
            router.replace('/login');
          },
        },
      ]
    );
  };

  const locationGranted = locationStatus === 'granted';

  // ─────────────────────────────────────────────────────────────────────────
  const HeaderContent = () => (
    <>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={18} color={primaryText} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Data Controls</Text>
    </>
  );

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
    content: { paddingHorizontal: 16, paddingTop: 20 },
    sectionLabel: {
      fontSize: 12, color: secondaryText, fontWeight: '600',
      letterSpacing: 0.5, marginBottom: 8, marginLeft: 4,
    },
    card: {
      backgroundColor: cardBg, borderRadius: 14, overflow: 'hidden', marginBottom: 8,
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0 : 0.06, shadowRadius: 4, elevation: isDark ? 0 : 1,
    },
    row: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: 15, paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: divider,
    },
    rowLast: { borderBottomWidth: 0 },
    rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    iconCircle: {
      width: 32, height: 32, borderRadius: 8,
      alignItems: 'center', justifyContent: 'center',
    },
    rowLabel: { fontSize: 16, color: primaryText, fontWeight: '500' },
    rowSub: { fontSize: 13, color: secondaryText, marginTop: 2, lineHeight: 17 },
    hint: {
      fontSize: 13, color: secondaryText, lineHeight: 18,
      marginBottom: 20, marginLeft: 4,
    },
    dangerRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: 15, paddingHorizontal: 16,
    },
    dangerLabel: { fontSize: 16, color: dangerRed, fontWeight: '500' },
    dangerSub: { fontSize: 13, color: secondaryText, marginTop: 2 },
    // Export modal
    modalOverlay: { flex: 1, justifyContent: 'flex-end' },
    modalSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
    modalHandle: {
      width: 36, height: 4, borderRadius: 2,
      backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)',
      alignSelf: 'center', marginTop: 12, marginBottom: 20,
    },
    modalTitle: { fontSize: 20, fontWeight: '700', color: primaryText, marginBottom: 8, paddingHorizontal: 20 },
    modalSub: { fontSize: 15, color: secondaryText, lineHeight: 22, marginBottom: 24, paddingHorizontal: 20 },
    exportBtn: {
      marginHorizontal: 20, marginBottom: 12, borderRadius: 50,
      paddingVertical: 15, alignItems: 'center',
      backgroundColor: '#0A84FF',
    },
    exportBtnText: { fontSize: 17, fontWeight: '700', color: '#FFF' },
    cancelBtn: { marginHorizontal: 20, borderRadius: 50, paddingVertical: 15, alignItems: 'center' },
    cancelBtnText: { fontSize: 17, color: secondaryText },
  });

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

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.content}>

          {/* ── Model Improvements ── */}
          <Text style={[styles.sectionLabel, { marginTop: 4 }]}>MODEL IMPROVEMENTS</Text>
          <View style={styles.card}>
            <View style={[styles.row, styles.rowLast]}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconCircle, { backgroundColor: '#34C75922' }]}>
                  <Ionicons name="sparkles" size={16} color={green} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>Improve the model</Text>
                  <Text style={styles.rowSub}>Allow us to use your data to improve AI responses</Text>
                </View>
              </View>
              <Switch
                value={improveModel}
                onValueChange={setImproveModel}
                trackColor={{ true: green, false: isDark ? '#3A3A3C' : '#E5E5EA' }}
                thumbColor={Platform.OS === 'ios' ? undefined : '#FFFFFF'}
              />
            </View>
          </View>
          <Text style={styles.hint}>
            Conversations may be reviewed by our team to improve safety and model quality.
          </Text>

          {/* ── Recording Settings ── */}
          <Text style={styles.sectionLabel}>RECORDING SETTINGS</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconCircle, { backgroundColor: '#FF950022' }]}>
                  <Ionicons name="mic" size={16} color="#FF9500" />
                </View>
                <Text style={styles.rowLabel}>Audio recordings</Text>
              </View>
              <Switch
                value={settings.audioRecordingsEnabled}
                onValueChange={(v) => updateSetting('audioRecordingsEnabled', v)}
                trackColor={{ true: green, false: isDark ? '#3A3A3C' : '#E5E5EA' }}
                thumbColor={Platform.OS === 'ios' ? undefined : '#FFFFFF'}
              />
            </View>
            <View style={[styles.row, styles.rowLast]}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconCircle, { backgroundColor: '#AF52DE22' }]}>
                  <Ionicons name="videocam" size={16} color="#AF52DE" />
                </View>
                <Text style={styles.rowLabel}>Video recordings</Text>
              </View>
              <Switch
                value={settings.videoRecordingsEnabled}
                onValueChange={(v) => updateSetting('videoRecordingsEnabled', v)}
                trackColor={{ true: green, false: isDark ? '#3A3A3C' : '#E5E5EA' }}
                thumbColor={Platform.OS === 'ios' ? undefined : '#FFFFFF'}
              />
            </View>
          </View>

          {/* ── Location ── */}
          <Text style={styles.sectionLabel}>LOCATION</Text>
          <View style={styles.card}>
            <View style={[styles.row, styles.rowLast]}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconCircle, { backgroundColor: '#0A84FF22' }]}>
                  <Ionicons name="location" size={16} color="#0A84FF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>Allow location access</Text>
                  <Text style={styles.rowSub}>
                    {locationGranted ? 'Location access is enabled' : 'Enable for location-aware AI responses'}
                  </Text>
                </View>
              </View>
              {locationLoading ? (
                <ActivityIndicator size="small" color="#0A84FF" />
              ) : (
                <Switch
                  value={locationGranted}
                  onValueChange={handleLocationToggle}
                  trackColor={{ true: green, false: isDark ? '#3A3A3C' : '#E5E5EA' }}
                  thumbColor={Platform.OS === 'ios' ? undefined : '#FFFFFF'}
                />
              )}
            </View>
          </View>
          <Text style={styles.hint}>
            {locationGranted
              ? 'Your location is accessible when you ask location-based questions.'
              : 'Tap to allow location access. Your device will show a system permission dialog.'}
          </Text>

          {/* ── Chat Management ── */}
          <Text style={styles.sectionLabel}>CHAT MANAGEMENT</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.row} onPress={handleArchiveAll} disabled={archiving}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconCircle, { backgroundColor: '#FF950022' }]}>
                  {archiving
                    ? <ActivityIndicator size="small" color="#FF9500" />
                    : <Ionicons name="archive-outline" size={16} color="#FF9500" />}
                </View>
                <Text style={styles.rowLabel}>Archive all chats</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={secondaryText} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.row, styles.rowLast]} onPress={handleDeleteAll} disabled={deleting}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconCircle, { backgroundColor: '#FF453A22' }]}>
                  {deleting
                    ? <ActivityIndicator size="small" color={dangerRed} />
                    : <Ionicons name="trash-outline" size={16} color={dangerRed} />}
                </View>
                <Text style={[styles.rowLabel, { color: dangerRed }]}>Delete all chats</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={dangerRed} />
            </TouchableOpacity>
          </View>

          {/* ── Data Export ── */}
          <Text style={styles.sectionLabel}>DATA EXPORT</Text>
          <View style={styles.card}>
            <TouchableOpacity style={[styles.row, styles.rowLast]} onPress={handleExportData}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconCircle, { backgroundColor: '#0A84FF22' }]}>
                  <Ionicons name="download-outline" size={16} color="#0A84FF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>Export data</Text>
                  <Text style={styles.rowSub}>Request a download of all your data</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={secondaryText} />
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>
            Your exported data will be prepared by our team and sent to your email address within 24 hours.
          </Text>

          {/* ── Account ── */}
          <Text style={styles.sectionLabel}>ACCOUNT</Text>
          <View style={styles.card}>
            <TouchableOpacity style={[styles.dangerRow]} onPress={handleDeleteAccount}>
              <View style={{ flex: 1 }}>
                <Text style={styles.dangerLabel}>Delete account</Text>
                <Text style={styles.rowSub}>Permanently delete your account and all data</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={dangerRed} />
            </TouchableOpacity>
          </View>

          <View style={{ height: insets.bottom + 40 }} />
        </View>
      </ScrollView>

      {/* ── Export Data Modal ── */}
      <Modal
        visible={showExportModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowExportModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => !exportRequested && setShowExportModal(false)}>
          {Platform.OS === 'ios' ? (
            <BlurView
              intensity={isDark ? 40 : 30}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }]} />
          )}
          <View style={[StyleSheet.absoluteFill, {
            backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.15)',
          }]} />

          <Pressable
            style={styles.modalSheet}
            onPress={e => e.stopPropagation()}
          >
            {Platform.OS === 'ios' ? (
              <BlurView
                intensity={isDark ? 90 : 80}
                tint={isDark ? 'dark' : 'light'}
                style={[styles.modalSheet, { paddingBottom: insets.bottom + 20 }]}
              >
                <ExportModalBody
                  primaryText={primaryText} secondaryText={secondaryText}
                  exportRequested={exportRequested}
                  onExport={confirmExport}
                  onCancel={() => setShowExportModal(false)}
                  styles={styles}
                />
              </BlurView>
            ) : (
              <View style={[styles.modalSheet, {
                backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
                paddingBottom: insets.bottom + 20,
              }]}>
                <ExportModalBody
                  primaryText={primaryText} secondaryText={secondaryText}
                  exportRequested={exportRequested}
                  onExport={confirmExport}
                  onCancel={() => setShowExportModal(false)}
                  styles={styles}
                />
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function ExportModalBody({ primaryText, secondaryText, exportRequested, onExport, onCancel, styles }: any) {
  return (
    <>
      <View style={styles.modalHandle} />
      <View style={{ alignItems: 'center', paddingHorizontal: 20, marginBottom: 16 }}>
        <View style={{
          width: 64, height: 64, borderRadius: 20,
          backgroundColor: 'rgba(10,132,255,0.15)',
          alignItems: 'center', justifyContent: 'center', marginBottom: 16,
        }}>
          <Ionicons name="cloud-download-outline" size={32} color="#0A84FF" />
        </View>
      </View>
      <Text style={styles.modalTitle}>Export your data</Text>
      <Text style={styles.modalSub}>
        We will prepare a complete export of your account data including conversations, settings, and profile information. It will be delivered to your email address within 24 hours.
      </Text>

      <TouchableOpacity style={styles.exportBtn} onPress={onExport} disabled={exportRequested}>
        {exportRequested ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.exportBtnText}>Request Export</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} disabled={exportRequested}>
        <Text style={styles.cancelBtnText}>Cancel</Text>
      </TouchableOpacity>
    </>
  );
}
