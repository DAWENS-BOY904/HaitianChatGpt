import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Platform,
  Modal,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { useTheme } from '../hooks/useTheme';
import { useAuth, useAlert } from '@/template';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';

export default function FamilyMemberScreen() {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  const [member, setMember] = useState<any>(null);
  const [dailyLimit, setDailyLimit] = useState(50);
  const [contentFilter, setContentFilter] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showUnlinkModal, setShowUnlinkModal] = useState(false);
  const [unlinkCountdown, setUnlinkCountdown] = useState(6);
  const [unlinkProgress] = useState(new Animated.Value(0));
  const [unlinking, setUnlinking] = useState(false);
  const countdownRef = useRef<any>(null);
  const animRef = useRef<any>(null);

  // Theme tokens
  const bg = isDark ? '#000000' : '#F2F2F7';
  const cardBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const primaryText = isDark ? '#FFFFFF' : '#000000';
  const secondaryText = '#8E8E93';
  const divider = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const backBtnBg = isDark ? '#2C2C2E' : 'rgba(0,0,0,0.08)';
  const headerBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

  useEffect(() => {
    loadMember();
  }, []);

  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (animRef.current) animRef.current.stop();
    };
  }, []);

  const loadMember = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('family_members')
      .select(`
        *,
        user_profiles!family_members_child_id_fkey(id, username, email, full_name, profile_photo_url)
      `)
      .eq('id', id)
      .single();

    if (data) {
      setMember(data);
      setDailyLimit(data.daily_message_limit);
      setContentFilter(data.content_filter_enabled);
    }
    setLoading(false);
  };

  const updateSettings = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('family_members')
      .update({ daily_message_limit: dailyLimit, content_filter_enabled: contentFilter })
      .eq('id', id);
    setSaving(false);

    if (error) {
      showAlert('Error', 'Failed to update settings');
    } else {
      showAlert('Saved', 'Settings updated successfully');
    }
  };

  const startUnlinkFlow = () => {
    setShowUnlinkModal(true);
    setUnlinkCountdown(6);
    unlinkProgress.setValue(0);

    // Animate progress bar over 6 seconds
    animRef.current = Animated.timing(unlinkProgress, {
      toValue: 1,
      duration: 6000,
      useNativeDriver: false,
    });
    animRef.current.start();

    // Countdown timer
    countdownRef.current = setInterval(() => {
      setUnlinkCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const cancelUnlink = () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (animRef.current) animRef.current.stop();
    unlinkProgress.setValue(0);
    setUnlinkCountdown(6);
    setShowUnlinkModal(false);
  };

  const confirmUnlink = async () => {
    if (unlinkCountdown > 0) return;
    setUnlinking(true);
    try {
      await supabase.from('family_members').delete().eq('id', id);
      setShowUnlinkModal(false);
      showAlert('Unlinked', 'Family member has been unlinked successfully.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      showAlert('Error', 'Failed to unlink. Please try again.');
    } finally {
      setUnlinking(false);
    }
  };

  const profile = member?.user_profiles;
  const displayName = profile?.full_name || profile?.username || 'User';
  const displayEmail = profile?.email || '';
  const initial = displayName[0]?.toUpperCase() || 'U';

  const limitOptions = [20, 50, 100, 200, 500];

  const progressBarWidth = unlinkProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#10A37F" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {/* Header */}
      {Platform.OS === 'ios' ? (
        <BlurView
          intensity={isDark ? 60 : 50}
          tint={isDark ? 'dark' : 'light'}
          style={{
            flexDirection: 'row', alignItems: 'center',
            paddingTop: insets.top + 12, paddingBottom: 12, paddingHorizontal: 16,
            borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: headerBorder,
            backgroundColor: 'transparent',
          }}
        >
          <TouchableOpacity
            style={{
              width: 34, height: 34, borderRadius: 17,
              backgroundColor: backBtnBg,
              alignItems: 'center', justifyContent: 'center', marginRight: 12,
            }}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={18} color={primaryText} />
          </TouchableOpacity>
          <Text style={{ fontSize: 17, fontWeight: '600', color: primaryText }}>Manage Member</Text>
        </BlurView>
      ) : (
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          paddingTop: insets.top + 12, paddingBottom: 12, paddingHorizontal: 16,
          backgroundColor: bg,
          borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: headerBorder,
        }}>
          <TouchableOpacity
            style={{
              width: 34, height: 34, borderRadius: 17,
              backgroundColor: backBtnBg,
              alignItems: 'center', justifyContent: 'center', marginRight: 12,
            }}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={18} color={primaryText} />
          </TouchableOpacity>
          <Text style={{ fontSize: 17, fontWeight: '600', color: primaryText }}>Manage Member</Text>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 40 }}>

        {/* Profile card */}
        <View style={{ alignItems: 'center', paddingVertical: 32 }}>
          <View style={{
            width: 80, height: 80, borderRadius: 40, overflow: 'hidden',
            backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA',
            alignItems: 'center', justifyContent: 'center',
            marginBottom: 14,
            shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15, shadowRadius: 8, elevation: 4,
          }}>
            {profile?.profile_photo_url ? (
              <Image source={{ uri: profile.profile_photo_url }} style={{ width: 80, height: 80 }} contentFit="cover" />
            ) : (
              <Text style={{ fontSize: 32, fontWeight: '700', color: primaryText }}>{initial}</Text>
            )}
          </View>
          <Text style={{ fontSize: 20, fontWeight: '700', color: primaryText, marginBottom: 4 }}>{displayName}</Text>
          <Text style={{ fontSize: 14, color: secondaryText }}>{displayEmail}</Text>

          {/* Status badge */}
          <View style={{
            marginTop: 10, paddingHorizontal: 14, paddingVertical: 6,
            borderRadius: 20, backgroundColor: '#10A37F22',
          }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#10A37F' }}>✓ Linked Member</Text>
          </View>
        </View>

        {/* Settings section */}
        <Text style={{ fontSize: 12, color: secondaryText, fontWeight: '600', letterSpacing: 0.5, marginBottom: 8, marginLeft: 4 }}>
          PARENTAL SETTINGS
        </Text>

        <View style={{
          backgroundColor: cardBg, borderRadius: 14, overflow: 'hidden', marginBottom: 8,
          shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
          shadowOpacity: isDark ? 0 : 0.06, shadowRadius: 4, elevation: isDark ? 0 : 1,
        }}>
          {/* Content filter */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingVertical: 16, paddingHorizontal: 16,
            borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: divider,
          }}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={{ fontSize: 16, color: primaryText, fontWeight: '500' }}>Content filter</Text>
              <Text style={{ fontSize: 13, color: secondaryText, marginTop: 2 }}>Block inappropriate content</Text>
            </View>
            <Switch
              value={contentFilter}
              onValueChange={setContentFilter}
              trackColor={{ true: '#34C759', false: isDark ? '#3A3A3C' : '#E5E5EA' }}
              thumbColor={Platform.OS === 'ios' ? undefined : '#FFFFFF'}
            />
          </View>

          {/* Daily limit */}
          <View style={{ paddingVertical: 16, paddingHorizontal: 16 }}>
            <Text style={{ fontSize: 16, color: primaryText, fontWeight: '500', marginBottom: 4 }}>Daily message limit</Text>
            <Text style={{ fontSize: 13, color: secondaryText, marginBottom: 14 }}>Maximum AI messages per day</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {limitOptions.map(limit => {
                const active = dailyLimit === limit;
                return (
                  <TouchableOpacity
                    key={limit}
                    style={{
                      paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20,
                      backgroundColor: active ? '#10A37F' : (isDark ? '#2C2C2E' : '#F2F2F7'),
                      borderWidth: 1,
                      borderColor: active ? '#10A37F' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'),
                    }}
                    onPress={() => setDailyLimit(limit)}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 15, fontWeight: '600', color: active ? '#FFF' : primaryText }}>{limit}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* Save button */}
        <TouchableOpacity
          style={{
            backgroundColor: '#10A37F', borderRadius: 50,
            paddingVertical: 15, alignItems: 'center', marginTop: 16,
            opacity: saving ? 0.7 : 1,
          }}
          onPress={updateSettings}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving
            ? <ActivityIndicator color="#FFF" />
            : <Text style={{ fontSize: 17, fontWeight: '700', color: '#FFF' }}>Save Settings</Text>}
        </TouchableOpacity>

        {/* Unlink button */}
        <TouchableOpacity
          style={{
            borderRadius: 50, paddingVertical: 15, alignItems: 'center', marginTop: 10,
            backgroundColor: isDark ? '#1C1C1E' : '#FFF',
            borderWidth: 1, borderColor: isDark ? 'rgba(255,69,58,0.3)' : 'rgba(255,69,58,0.2)',
          }}
          onPress={startUnlinkFlow}
          activeOpacity={0.8}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="person-remove-outline" size={18} color="#FF453A" />
            <Text style={{ fontSize: 17, fontWeight: '600', color: '#FF453A' }}>Unlink Family Member</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>

      {/* Unlink Confirmation Modal */}
      <Modal
        visible={showUnlinkModal}
        transparent
        animationType="fade"
        onRequestClose={cancelUnlink}
      >
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={isDark ? 50 : 40} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)' }]} />
          )}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.2)' }]} />

          <View style={{
            width: '88%', maxWidth: 360,
            borderRadius: 24, overflow: 'hidden',
            shadowColor: '#000', shadowOffset: { width: 0, height: 16 },
            shadowOpacity: 0.4, shadowRadius: 32, elevation: 32,
          }}>
            {Platform.OS === 'ios' ? (
              <BlurView intensity={isDark ? 90 : 80} tint={isDark ? 'dark' : 'light'} style={{ borderRadius: 24, overflow: 'hidden' }}>
                <UnlinkModalContent
                  isDark={isDark} primaryText={primaryText} secondaryText={secondaryText}
                  displayName={displayName} initial={initial} profile={profile}
                  unlinkCountdown={unlinkCountdown} progressBarWidth={progressBarWidth}
                  unlinking={unlinking}
                  onCancel={cancelUnlink} onConfirm={confirmUnlink}
                />
              </BlurView>
            ) : (
              <View style={{ backgroundColor: isDark ? '#1C1C1E' : '#FFF', borderRadius: 24 }}>
                <UnlinkModalContent
                  isDark={isDark} primaryText={primaryText} secondaryText={secondaryText}
                  displayName={displayName} initial={initial} profile={profile}
                  unlinkCountdown={unlinkCountdown} progressBarWidth={progressBarWidth}
                  unlinking={unlinking}
                  onCancel={cancelUnlink} onConfirm={confirmUnlink}
                />
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function UnlinkModalContent({ isDark, primaryText, secondaryText, displayName, initial, profile,
  unlinkCountdown, progressBarWidth, unlinking, onCancel, onConfirm }: any) {
  const canConfirm = unlinkCountdown === 0;
  return (
    <View style={{ padding: 24 }}>
      {/* Avatar */}
      <View style={{ alignItems: 'center', marginBottom: 20 }}>
        <View style={{
          width: 70, height: 70, borderRadius: 35, overflow: 'hidden',
          backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA',
          alignItems: 'center', justifyContent: 'center',
          borderWidth: 3, borderColor: '#FF453A33',
        }}>
          {profile?.profile_photo_url ? (
            <Image source={{ uri: profile.profile_photo_url }} style={{ width: 70, height: 70 }} contentFit="cover" />
          ) : (
            <Text style={{ fontSize: 28, fontWeight: '700', color: primaryText }}>{initial}</Text>
          )}
        </View>
      </View>

      <Text style={{ fontSize: 20, fontWeight: '700', color: primaryText, textAlign: 'center', marginBottom: 8 }}>
        Unlink {displayName}?
      </Text>
      <Text style={{ fontSize: 14, color: secondaryText, textAlign: 'center', lineHeight: 20, marginBottom: 24 }}>
        This will remove all parental controls and settings for this family member. This action cannot be undone.
      </Text>

      {/* Progress bar + countdown */}
      <View style={{
        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
        borderRadius: 12, overflow: 'hidden', height: 6, marginBottom: 10,
      }}>
        <Animated.View style={{
          height: 6, backgroundColor: '#FF453A',
          width: progressBarWidth, borderRadius: 12,
        }} />
      </View>

      {unlinkCountdown > 0 ? (
        <Text style={{ fontSize: 13, color: secondaryText, textAlign: 'center', marginBottom: 20 }}>
          Unlinking in {unlinkCountdown}s…
        </Text>
      ) : (
        <Text style={{ fontSize: 13, color: '#FF453A', fontWeight: '600', textAlign: 'center', marginBottom: 20 }}>
          Ready to unlink
        </Text>
      )}

      {/* Buttons */}
      <TouchableOpacity
        style={{
          borderRadius: 50, paddingVertical: 14, alignItems: 'center', marginBottom: 10,
          backgroundColor: canConfirm ? '#FF453A' : (isDark ? '#3A3A3C' : '#E5E5EA'),
          opacity: unlinking ? 0.7 : 1,
        }}
        onPress={onConfirm}
        disabled={!canConfirm || unlinking}
        activeOpacity={0.8}
      >
        {unlinking
          ? <ActivityIndicator color="#FFF" />
          : <Text style={{ fontSize: 17, fontWeight: '700', color: canConfirm ? '#FFF' : secondaryText }}>
              {canConfirm ? 'Confirm Unlink' : `Wait ${unlinkCountdown}s…`}
            </Text>}
      </TouchableOpacity>

      <TouchableOpacity
        style={{ borderRadius: 50, paddingVertical: 14, alignItems: 'center' }}
        onPress={onCancel}
        activeOpacity={0.7}
      >
        <Text style={{ fontSize: 17, color: secondaryText }}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}
