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

type LocationStatus = 'unknown' | 'granted' | 'denied';

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
  const green = '#34C759';
  const dangerRed = '#FF453A';
  const accentBlue = '#0A84FF';

  useEffect(() => {
    checkLocationPermission();
  }, []);

  const checkLocationPermission = async () => {
    if (!Location) return;
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      setLocationStatus(status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'unknown');
    } catch {}
  };

  // When toggle is ON → request permission (system dialog appears)
  // When toggle is OFF → guide user to Settings
  const handleLocationToggle = async (val: boolean) => {
    if (!val) {
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
        if (status === 'denied') {
          showAlert(
            'Permission denied',
            'Location access was denied. You can enable it in your device Settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ]
          );
        }
      }
    } catch (e: any) {
      showAlert('Error', e?.message || 'Failed to request location permission');
    } finally {
      setLocationLoading(false);
    }
  };

  const handleArchiveAll = () => {
    showAlert(
      'Archive all chats?',
      'All your conversations will be moved to Archived Chats.',
      [
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
              showAlert('Done', 'All chats archived.');
            } catch {
              showAlert('Error', 'Failed to archive chats.');
            } finally {
              setArchiving(false);
            }
          },
        },
      ]
    );
  };

  const handleDeleteAll = () => {
    showAlert(
      'Delete all chats?',
      'This permanently deletes all your conversations and messages. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            if (!user) return;
            setDeleting(true);
            try {
              await supabase.from('conversations').delete().eq('user_id', user.id);
              showAlert('Done', 'All chats deleted.');
            } catch {
              showAlert('Error', 'Failed to delete chats.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const confirmExport = async () => {
    setExportRequested(true);
    try {
      await supabase.from('activity_logs').insert({
        user_id: user?.id,
        action: 'data_export_requested',
        action_type: 'data',
        details: { email: user?.email, requested_at: new Date().toISOString() },
      });
    } catch {}
    setTimeout(() => {
      setShowExportModal(false);
      setExportRequested(false);
      showAlert(
        'Export requested',
        'Your data will be sent to your email address within 24 hours.'
      );
    }, 1400);
  };

  const handleDeleteAccount = () => {
    showAlert(
      'Delete Account',
      'This permanently deletes your account and ALL associated data. This cannot be undone.',
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
    content: { paddingHorizontal: 16, paddingTop: 24 },
    sectionLabel: {
      fontSize: 13, color: secondaryText, fontWeight: '500',
      marginBottom: 8, marginLeft: 4,
    },
    hint: {
      fontSize: 13, color: secondaryText, lineHeight: 18,
      marginBottom: 20, marginTop: 6, marginLeft: 4, marginRight: 4,
    },
    card: {
      backgroundColor: cardBg, borderRadius: 14, overflow: 'hidden', marginBottom: 4,
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0 : 0.06, shadowRadius: 4, elevation: isDark ? 0 : 1,
    },
    // Toggle rows (text + switch, no icons)
    toggleRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: 14, paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: divider,
    },
    toggleRowLast: { borderBottomWidth: 0 },
    toggleLabel: { fontSize: 17, color: primaryText, flex: 1, marginRight: 12 },
    toggleSub: { fontSize: 13, color: secondaryText, marginTop: 2 },
    // Tappable rows (text + chevron, no icons)
    tappableRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: 15, paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: divider,
    },
    tappableRowLast: { borderBottomWidth: 0 },
    tappableLabel: { fontSize: 17, color: primaryText, flex: 1 },
    tappableSub: { fontSize: 13, color: secondaryText, marginTop: 2 },
    // Danger rows
    dangerLabel: { fontSize: 17, color: dangerRed, flex: 1 },
    dangerSub: { fontSize: 13, color: secondaryText, marginTop: 2 },
    // Export modal
    modalOverlay: { flex: 1, justifyContent: 'flex-end' },
    modalSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
    modalHandle: {
      width: 36, height: 4, borderRadius: 2,
      backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)',
      alignSelf: 'center', marginTop: 12, marginBottom: 20,
    },
    modalTitle: {
      fontSize: 20, fontWeight: '700', color: primaryText,
      marginBottom: 8, paddingHorizontal: 20,
    },
    modalSub: {
      fontSize: 15, color: secondaryText, lineHeight: 22,
      marginBottom: 24, paddingHorizontal: 20,
    },
    exportBtn: {
      marginHorizontal: 20, marginBottom: 12, borderRadius: 50,
      paddingVertical: 15, alignItems: 'center', backgroundColor: accentBlue,
    },
    exportBtnText: { fontSize: 17, fontWeight: '700', color: '#FFF' },
    cancelBtn: { marginHorizontal: 20, borderRadius: 50, paddingVertical: 15, alignItems: 'center' },
    cancelBtnText: { fontSize: 17, color: secondaryText },
  });

  const HeaderContent = () => (
    <>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={18} color={primaryText} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Data Controls</Text>
    </>
  );

  return (
    <View style={styles.container}>
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
          <Text style={styles.sectionLabel}>Improve the model for everyone</Text>
          <View style={styles.card}>
            <View style={[styles.toggleRow, styles.toggleRowLast]}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={styles.toggleLabel}>Improve the model for everyone</Text>
                <Text style={styles.toggleSub}>Allow your chats to train our AI models</Text>
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
            Conversations may be reviewed by our team to improve safety and model quality. Sensitive information is removed before training.
          </Text>

          {/* ── Recording Settings ── */}
          <Text style={styles.sectionLabel}>Recording settings</Text>
          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Audio recordings</Text>
              <Switch
                value={settings.audioRecordingsEnabled}
                onValueChange={(v) => updateSetting('audioRecordingsEnabled', v)}
                trackColor={{ true: green, false: isDark ? '#3A3A3C' : '#E5E5EA' }}
                thumbColor={Platform.OS === 'ios' ? undefined : '#FFFFFF'}
              />
            </View>
            <View style={[styles.toggleRow, styles.toggleRowLast]}>
              <Text style={styles.toggleLabel}>Video recordings</Text>
              <Switch
                value={settings.videoRecordingsEnabled}
                onValueChange={(v) => updateSetting('videoRecordingsEnabled', v)}
                trackColor={{ true: green, false: isDark ? '#3A3A3C' : '#E5E5EA' }}
                thumbColor={Platform.OS === 'ios' ? undefined : '#FFFFFF'}
              />
            </View>
          </View>
          <Text style={styles.hint}>
            Control whether audio and video recordings may be used to improve our services.
          </Text>

          {/* ── Location Services ── */}
          <Text style={styles.sectionLabel}>Location services</Text>
          <View style={styles.card}>
            <View style={[styles.toggleRow, styles.toggleRowLast]}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={styles.toggleLabel}>Location Services</Text>
                <Text style={styles.toggleSub}>
                  {locationGranted ? 'Enabled — location-aware responses active' : 'Enable for location-aware AI responses'}
                </Text>
              </View>
              {locationLoading ? (
                <ActivityIndicator size="small" color={green} />
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
              ? 'Your location is shared when you ask location-based questions.'
              : 'Tap to enable. Your device will prompt you to allow location access.'}
          </Text>

          {/* ── Archive Chats ── */}
          <Text style={styles.sectionLabel}>Archive chats</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={[styles.tappableRow, styles.tappableRowLast]}
              onPress={handleArchiveAll}
              disabled={archiving}
              activeOpacity={0.6}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.tappableLabel}>Archive all chats</Text>
                <Text style={styles.tappableSub}>Move all conversations to Archived Chats</Text>
              </View>
              {archiving
                ? <ActivityIndicator size="small" color={secondaryText} />
                : <Ionicons name="chevron-forward" size={17} color={secondaryText} />}
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>
            Archived chats are hidden from your history but can be accessed from your profile settings.
          </Text>

          {/* ── Delete Chats ── */}
          <Text style={styles.sectionLabel}>Delete chats</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={[styles.tappableRow, styles.tappableRowLast]}
              onPress={handleDeleteAll}
              disabled={deleting}
              activeOpacity={0.6}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.tappableLabel, { color: dangerRed }]}>Delete all chats</Text>
                <Text style={styles.tappableSub}>Permanently delete all conversations</Text>
              </View>
              {deleting
                ? <ActivityIndicator size="small" color={dangerRed} />
                : <Ionicons name="chevron-forward" size={17} color={dangerRed} />}
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>
            This action cannot be undone. All messages will be permanently removed.
          </Text>

          {/* ── Export Data ── */}
          <Text style={styles.sectionLabel}>Export data</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={[styles.tappableRow, styles.tappableRowLast]}
              onPress={() => setShowExportModal(true)}
              activeOpacity={0.6}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.tappableLabel}>Export data</Text>
                <Text style={styles.tappableSub}>Request a download of all your data</Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color={secondaryText} />
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>
            Your exported data will be prepared and sent to your email within 24 hours.
          </Text>

          {/* ── Delete Account ── */}
          <Text style={styles.sectionLabel}>Delete account</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={[styles.tappableRow, styles.tappableRowLast]}
              onPress={handleDeleteAccount}
              activeOpacity={0.6}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.dangerLabel}>Delete account</Text>
                <Text style={styles.dangerSub}>Permanently delete your account and all data</Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color={dangerRed} />
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>
            Deleting your account is permanent and cannot be reversed. All your data will be erased.
          </Text>

          <View style={{ height: insets.bottom + 40 }} />
        </View>
      </ScrollView>

      {/* ── Export Data Modal ── */}
      <Modal
        visible={showExportModal}
        transparent
        animationType="slide"
        onRequestClose={() => !exportRequested && setShowExportModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => !exportRequested && setShowExportModal(false)}
        >
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
                  primaryText={primaryText}
                  secondaryText={secondaryText}
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
                  primaryText={primaryText}
                  secondaryText={secondaryText}
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
      <Text style={styles.modalTitle}>Export your data</Text>
      <Text style={styles.modalSub}>
        We will prepare a complete export of your account data including conversations, settings, and profile information. It will be delivered to your email within 24 hours.
      </Text>
      <TouchableOpacity style={styles.exportBtn} onPress={onExport} disabled={exportRequested}>
        {exportRequested
          ? <ActivityIndicator color="#FFF" />
          : <Text style={styles.exportBtnText}>Request Export</Text>}
      </TouchableOpacity>
      <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} disabled={exportRequested}>
        <Text style={styles.cancelBtnText}>Cancel</Text>
      </TouchableOpacity>
    </>
  );
}
