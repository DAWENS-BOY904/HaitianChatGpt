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
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAlert } from '@/template';

export default function AdsControlsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();

  const [personalizeAds, setPersonalizeAds] = useState(true);
  const [pastChatsMemory, setPastChatsMemory] = useState(true);
  const [showAdFreeModal, setShowAdFreeModal] = useState(false);

  const bg = '#000000';
  const cardBg = '#1C1C1E';
  const primaryText = '#FFFFFF';
  const secondaryText = '#8E8E93';
  const divider = 'rgba(255,255,255,0.08)';
  const dangerRed = '#FF453A';
  const accentBlue = '#4A90D9';
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
    },
    backBtn: {
      width: 34, height: 34, borderRadius: 17, backgroundColor: '#2C2C2E',
      alignItems: 'center', justifyContent: 'center', marginRight: 12,
    },
    headerTitle: { fontSize: 17, fontWeight: '600', color: primaryText },
    content: { paddingHorizontal: 16, paddingTop: 20 },
    sectionLabel: { fontSize: 13, color: secondaryText, marginBottom: 8, marginLeft: 4 },
    card: { backgroundColor: cardBg, borderRadius: 14, overflow: 'hidden', marginBottom: 8 },
    row: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: 16, paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: divider,
    },
    rowLast: { borderBottomWidth: 0 },
    rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    rowLabel: { fontSize: 17, color: primaryText },
    rowChevron: { flexDirection: 'row', alignItems: 'center' },
    deleteCard: {
      backgroundColor: cardBg, borderRadius: 14, overflow: 'hidden',
      marginBottom: 8, paddingVertical: 16, paddingHorizontal: 16,
    },
    deleteText: { fontSize: 17, color: dangerRed, fontWeight: '500' },
    deleteHint: { fontSize: 13, color: secondaryText, marginTop: 8, marginHorizontal: 4, lineHeight: 18, marginBottom: 16 },
    switchCard: {
      backgroundColor: cardBg, borderRadius: 14, overflow: 'hidden', marginBottom: 8,
    },
    switchRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: 16, paddingHorizontal: 16,
    },
    switchHint: { fontSize: 13, color: secondaryText, paddingHorizontal: 16, paddingBottom: 14, lineHeight: 18 },
    linkText: { color: accentBlue },
    changePlanCard: {
      backgroundColor: cardBg, borderRadius: 14, overflow: 'hidden',
      paddingVertical: 16, paddingHorizontal: 16, marginBottom: 20,
    },
    changePlanText: { fontSize: 17, color: primaryText },
    // Ad-free modal
    modalOverlay: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
      justifyContent: 'flex-end',
    },
    modalSheet: {
      backgroundColor: '#1C1C1E', borderTopLeftRadius: 20, borderTopRightRadius: 20,
      paddingHorizontal: 20, paddingTop: 20, paddingBottom: insets.bottom + 20,
    },
    modalHandle: {
      width: 40, height: 4, backgroundColor: '#3A3A3C',
      borderRadius: 2, alignSelf: 'center', marginBottom: 20,
    },
    modalTitle: { fontSize: 20, fontWeight: '700', color: primaryText, marginBottom: 8 },
    modalSubtitle: { fontSize: 15, color: secondaryText, marginBottom: 24, lineHeight: 22 },
    modalBtn: {
      borderRadius: 50, paddingVertical: 15,
      alignItems: 'center', marginBottom: 12,
    },
    modalBtnBlue: { backgroundColor: accentBlue },
    modalBtnGray: { backgroundColor: '#3A3A3C' },
    modalBtnText: { fontSize: 17, fontWeight: '600', color: '#000' },
    modalBtnTextWhite: { fontSize: 17, fontWeight: '600', color: primaryText },
    modalBtnDanger: { backgroundColor: 'transparent', paddingVertical: 15, alignItems: 'center' },
    modalBtnDangerText: { fontSize: 17, color: dangerRed },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={18} color={primaryText} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ads controls</Text>
      </View>

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
                trackColor={{ true: green, false: '#3A3A3C' }}
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
                trackColor={{ true: green, false: '#3A3A3C' }}
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

      {/* Ad-free modal */}
      <Modal visible={showAdFreeModal} transparent animationType="slide" onRequestClose={() => setShowAdFreeModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowAdFreeModal(false)}>
          <Pressable style={styles.modalSheet} onPress={e => e.stopPropagation()}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Go ad-free</Text>
            <Text style={styles.modalSubtitle}>
              Upgrade your plan to enjoy an ad-free experience with more features and expanded access.
            </Text>
            <TouchableOpacity
              style={[styles.modalBtn, styles.modalBtnBlue]}
              onPress={() => { setShowAdFreeModal(false); router.push('/subscription'); }}
            >
              <Text style={styles.modalBtnText}>Upgrade to Plus</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, styles.modalBtnGray]}
              onPress={() => setShowAdFreeModal(false)}
            >
              <Text style={styles.modalBtnTextWhite}>Never mind</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalBtnDanger}
              onPress={() => {
                setShowAdFreeModal(false);
                // Reduce message limit - show ads-off screen
                router.push('/ads-off');
              }}
            >
              <Text style={styles.modalBtnDangerText}>Reduce message limit</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
add white/dark theme function and in history fix it real when the ai search something for you its apear all search and date lan anle li fix all in blur even the modal blur mode.
