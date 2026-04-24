import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  ScrollView,
  Modal,
  Pressable,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAlert } from '@/template';
import { useTheme } from '../hooks/useTheme';

export default function AdsControlsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const { isDark } = useTheme();

  const [personalizeAds, setPersonalizeAds] = useState(true);
  const [pastChatsMemory, setPastChatsMemory] = useState(true);
  const [showAdFreeModal, setShowAdFreeModal] = useState(false);

  // ── Theme tokens ──────────────────────────────────────────────────────────
  const bg = isDark ? '#000000' : '#F2F2F7';
  const cardBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const primaryText = isDark ? '#FFFFFF' : '#000000';
  const secondaryText = '#8E8E93';
  const divider = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const backBtnBg = isDark ? '#2C2C2E' : 'rgba(0,0,0,0.08)';
  const headerBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const dangerRed = '#FF453A';
  const accentBlue = '#0A84FF';
  const green = '#34C759';

  const handleDeleteAdData = () => {
    showAlert(
      'Delete ad data?',
      'This will permanently delete your ad history and ads interests data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            showAlert('Deleted', 'Your ad history and interests have been cleared.');
          },
        },
      ]
    );
  };

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
      fontSize: 13, color: secondaryText, fontWeight: '500',
      marginBottom: 8, marginLeft: 4, letterSpacing: 0.1,
    },
    card: {
      backgroundColor: cardBg, borderRadius: 14, overflow: 'hidden', marginBottom: 8,
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0 : 0.06, shadowRadius: 4, elevation: isDark ? 0 : 1,
    },
    row: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: 16, paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: divider,
    },
    rowLast: { borderBottomWidth: 0 },
    rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    rowLabel: { fontSize: 17, color: primaryText },
    deleteCard: {
      backgroundColor: cardBg, borderRadius: 14, overflow: 'hidden',
      marginBottom: 8, paddingVertical: 16, paddingHorizontal: 16,
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0 : 0.06, shadowRadius: 4, elevation: isDark ? 0 : 1,
    },
    deleteText: { fontSize: 17, color: dangerRed, fontWeight: '500' },
    deleteHint: {
      fontSize: 13, color: secondaryText, marginTop: 2,
      marginHorizontal: 4, lineHeight: 18, marginBottom: 16,
    },
    switchCard: {
      backgroundColor: cardBg, borderRadius: 14, overflow: 'hidden', marginBottom: 8,
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0 : 0.06, shadowRadius: 4, elevation: isDark ? 0 : 1,
    },
    switchRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: 16, paddingHorizontal: 16,
    },
    switchHint: {
      fontSize: 13, color: secondaryText,
      paddingHorizontal: 16, paddingBottom: 14, lineHeight: 18,
    },
    linkText: { color: accentBlue },
    changePlanCard: {
      backgroundColor: cardBg, borderRadius: 14, overflow: 'hidden',
      paddingVertical: 16, paddingHorizontal: 16, marginBottom: 20,
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0 : 0.06, shadowRadius: 4, elevation: isDark ? 0 : 1,
    },
    changePlanText: { fontSize: 17, color: primaryText },
  });

  const HeaderContent = () => (
    <>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={18} color={primaryText} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Ads controls</Text>
    </>
  );

  // ── Ad-free modal content ─────────────────────────────────────────────────
  const AdFreeModalContent = () => (
    <View style={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 20 }}>
      <View style={{
        width: 40, height: 4,
        backgroundColor: isDark ? '#3A3A3C' : 'rgba(0,0,0,0.15)',
        borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 20,
      }} />
      <Text style={{ fontSize: 20, fontWeight: '700', color: primaryText, marginBottom: 8 }}>
        Go ad-free
      </Text>
      <Text style={{ fontSize: 15, color: secondaryText, marginBottom: 24, lineHeight: 22 }}>
        Upgrade your plan to enjoy an ad-free experience with more features and expanded access.
      </Text>
      <TouchableOpacity
        style={{
          borderRadius: 50, paddingVertical: 15,
          alignItems: 'center', marginBottom: 12,
          backgroundColor: accentBlue,
        }}
        onPress={() => { setShowAdFreeModal(false); router.push('/subscription'); }}
      >
        <Text style={{ fontSize: 17, fontWeight: '700', color: '#FFF' }}>Upgrade to Plus</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={{
          borderRadius: 50, paddingVertical: 15,
          alignItems: 'center', marginBottom: 12,
          backgroundColor: isDark ? '#3A3A3C' : '#E5E5EA',
        }}
        onPress={() => setShowAdFreeModal(false)}
      >
        <Text style={{ fontSize: 17, fontWeight: '600', color: primaryText }}>Never mind</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={{ paddingVertical: 15, alignItems: 'center' }}
        onPress={() => { setShowAdFreeModal(false); router.push('/ads-off'); }}
      >
        <Text style={{ fontSize: 17, color: dangerRed }}>Reduce message limit</Text>
      </TouchableOpacity>
    </View>
  );

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
          {/* Ads data */}
          <Text style={styles.sectionLabel}>Ads data</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.row} onPress={() => router.push('/ad-history')}>
              <View style={styles.rowLeft}>
                <Ionicons name="time-outline" size={20} color={secondaryText} />
                <Text style={styles.rowLabel}>History</Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color={secondaryText} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.row, styles.rowLast]} onPress={() => router.push('/ad-interests')}>
              <View style={styles.rowLeft}>
                <Ionicons name="thumbs-up-outline" size={20} color={secondaryText} />
                <Text style={styles.rowLabel}>Interests</Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color={secondaryText} />
            </TouchableOpacity>
          </View>

          {/* Delete */}
          <TouchableOpacity style={styles.deleteCard} onPress={handleDeleteAdData}>
            <Text style={styles.deleteText}>Delete ad data</Text>
          </TouchableOpacity>
          <Text style={styles.deleteHint}>
            Clear all ads history and interests data. This won't affect your chats.
          </Text>

          {/* Personalize ads */}
          <Text style={styles.sectionLabel}>Ads personalization</Text>
          <View style={styles.switchCard}>
            <View style={styles.switchRow}>
              <Text style={styles.rowLabel}>Personalize ads</Text>
              <Switch
                value={personalizeAds}
                onValueChange={setPersonalizeAds}
                trackColor={{ true: green, false: isDark ? '#3A3A3C' : '#E5E5EA' }}
                thumbColor={Platform.OS === 'ios' ? undefined : '#FFFFFF'}
              />
            </View>
            <Text style={styles.switchHint}>
              Use your ads history, interests, past and current chats, including model responses, to make the ads you see more relevant.{' '}
              <Text style={styles.linkText}>Learn more</Text>
            </Text>
          </View>

          <View style={styles.switchCard}>
            <View style={styles.switchRow}>
              <Text style={styles.rowLabel}>Past chats and memory</Text>
              <Switch
                value={pastChatsMemory}
                onValueChange={setPastChatsMemory}
                trackColor={{ true: green, false: isDark ? '#3A3A3C' : '#E5E5EA' }}
                thumbColor={Platform.OS === 'ios' ? undefined : '#FFFFFF'}
              />
            </View>
            <Text style={styles.switchHint}>
              Use past chats and memory to make the ads you see more relevant. Your chats and memories are never shared with advertisers.
            </Text>
          </View>

          {/* Change plan */}
          <TouchableOpacity style={styles.changePlanCard} onPress={() => setShowAdFreeModal(true)}>
            <Text style={styles.changePlanText}>Change plan to go ad-free</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── Ad-free modal with blur ── */}
      <Modal
        visible={showAdFreeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAdFreeModal(false)}
      >
        <Pressable
          style={{ flex: 1, justifyContent: 'flex-end' }}
          onPress={() => setShowAdFreeModal(false)}
        >
          {/* Backdrop blur */}
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

          {/* Sheet */}
          <Pressable
            style={{ overflow: 'hidden', borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
            onPress={e => e.stopPropagation()}
          >
            {Platform.OS === 'ios' ? (
              <BlurView
                intensity={isDark ? 90 : 80}
                tint={isDark ? 'dark' : 'light'}
                style={{ borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' }}
              >
                <AdFreeModalContent />
              </BlurView>
            ) : (
              <View style={{
                backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
                borderTopLeftRadius: 24, borderTopRightRadius: 24,
              }}>
                <AdFreeModalContent />
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
