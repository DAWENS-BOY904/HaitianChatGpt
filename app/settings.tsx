import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Platform,
  Modal,
  Linking,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Animated,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useTheme } from '../hooks/useTheme';
import { useSettings } from '../hooks/useSettings';
import { useSubscription } from '../hooks/useSubscription';
import { useAuth, useAlert } from '@/template';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';
import * as ImagePicker from 'expo-image-picker';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useProfile } from '../contexts/ProfileContext';
import { Image as ExpoImageBadge } from 'expo-image';
import * as WebBrowser from '../utils/web-browser';
import { WebView } from 'react-native-webview';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

const PERSONA_LINK = 'https://perso.na/s/rKzyfH-XZ9663D';
const AGE_VERIFIED_KEY = 'age_verification_completed';

// ═══════════════════════════════════════════════════════════════════════════════
// AGE VERIFICATION MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function AgeVerificationModal({ visible, onClose, onVerified }: {
  visible: boolean; onClose: () => void; onVerified: () => void;
}) {
  const { isDark } = useTheme();
  const insets2 = useSafeAreaInsets();
  const [step, setStep] = useState<'consent' | 'camera' | 'device' | 'webview'>('consent');
  const [webviewLoading, setWebviewLoading] = useState(true);

  useEffect(() => {
    if (visible) setStep('consent');
  }, [visible]);

  const bg = isDark ? '#000000' : '#FFFFFF';
  const primaryText = isDark ? '#FFFFFF' : '#000000';
  const secondaryText = isDark ? 'rgba(255,255,255,0.55)' : '#475569';
  const tertiaryText = isDark ? 'rgba(255,255,255,0.35)' : '#94A3B8';
  const borderColor = isDark ? 'rgba(255,255,255,0.12)' : '#E2E8F0';
  const inputBg = isDark ? 'rgba(255,255,255,0.07)' : '#F1F5F9';
  const btnBg = isDark ? '#FFFFFF' : '#000000';
  const btnText = isDark ? '#000000' : '#FFFFFF';
  const outlineBtnBorder = isDark ? 'rgba(255,255,255,0.2)' : '#E2E8F0';
  const outlineBtnText = isDark ? '#FFFFFF' : '#000000';
  const iconColor = isDark ? 'rgba(255,255,255,0.2)' : '#CBD5E1';
  const personaText = '#6366F1';
  const qrIconColor = isDark ? '#E2E8F0' : '#1E293B';

  const handleCopyLink = async () => {
    try {
      const Clipboard = await import('expo-clipboard');
      await Clipboard.setStringAsync(PERSONA_LINK);
    } catch (_e) {
      try { await Share.share({ message: PERSONA_LINK }); } catch (_e2) {}
    }
  };

  const handleSendEmail = () => {
    Linking.openURL(`mailto:?subject=Age Verification&body=Continue your age verification: ${PERSONA_LINK}`);
  };

  const handleVerified = async () => {
    await AsyncStorage.setItem(AGE_VERIFIED_KEY, 'true');
    onVerified();
    onClose();
  };

  return (
    <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: bg }}>
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          paddingTop: insets2.top + 8, paddingHorizontal: 16, paddingBottom: 12,
          borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: borderColor,
        }}>
          {step !== 'consent' ? (
            <TouchableOpacity
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)', alignItems: 'center', justifyContent: 'center' }}
              onPress={() => setStep(step === 'webview' ? 'camera' : step === 'device' ? 'camera' : 'consent')}
            >
              <Ionicons name="chevron-back" size={20} color={primaryText} />
            </TouchableOpacity>
          ) : <View style={{ width: 36 }} />}
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: primaryText }}>Age Verification</Text>
          </View>
          <TouchableOpacity
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)', alignItems: 'center', justifyContent: 'center' }}
            onPress={onClose}
          >
            <Ionicons name="close" size={18} color={primaryText} />
          </TouchableOpacity>
        </View>

        {step === 'consent' && (
          <ScrollView contentContainerStyle={{ padding: 28, alignItems: 'center', flexGrow: 1 }} showsVerticalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 32, marginTop: 16 }}>
              <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: '#6366F1', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="star" size={28} color="#FFF" />
              </View>
              <View style={{ flexDirection: 'row', gap: 5 }}>
                {[0, 1, 2].map(i => <View key={i} style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: borderColor }} />)}
              </View>
              <View style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="shield-checkmark-outline" size={28} color={secondaryText} />
              </View>
            </View>
            <Text style={{ fontSize: 26, fontWeight: '700', color: primaryText, textAlign: 'center', marginBottom: 14 }}>We need to verify your age</Text>
            <Text style={{ fontSize: 15, color: secondaryText, textAlign: 'center', lineHeight: 22, marginBottom: 24 }}>
              This quick check helps confirm your age so we can give you the right Dawinix experience. You will need a smartphone or webcam.
            </Text>
            <Text style={{ fontSize: 12, color: tertiaryText, textAlign: 'center', lineHeight: 18, marginBottom: 40 }}>
              By clicking continue, you consent to Persona and its service providers collecting your biometric data to verify your age and identity on behalf of Dawinix, per Persona's Privacy Policy.
            </Text>
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              style={{ width: '100%', backgroundColor: btnBg, borderRadius: 50, paddingVertical: 17, alignItems: 'center', marginBottom: 16 }}
              onPress={() => setStep('camera')}
            >
              <Text style={{ color: btnText, fontSize: 17, fontWeight: '700' }}>Agree and Continue</Text>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: insets2.bottom + 8 }}>
              <Text style={{ color: tertiaryText, fontSize: 12 }}>SECURED WITH</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: '#6366F1', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="star" size={8} color="#FFF" />
                </View>
                <Text style={{ color: personaText, fontSize: 13, fontWeight: '700' }}>persona</Text>
              </View>
            </View>
          </ScrollView>
        )}

        {step === 'camera' && (
          <ScrollView contentContainerStyle={{ padding: 28, alignItems: 'center', flexGrow: 1 }} showsVerticalScrollIndicator={false}>
            <Text style={{ fontSize: 28, fontWeight: '700', color: primaryText, textAlign: 'left', width: '100%', marginBottom: 12 }}>
              {"Let's make sure it's you"}
            </Text>
            <Text style={{ fontSize: 15, color: secondaryText, textAlign: 'left', width: '100%', lineHeight: 22, marginBottom: 48 }}>
              Position yourself in the center of the camera, making sure its well-lit and clearly visible.
            </Text>
            <Ionicons name="person-circle-outline" size={140} color={iconColor} style={{ marginBottom: 56 }} />
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              style={{ width: '100%', backgroundColor: btnBg, borderRadius: 50, paddingVertical: 17, alignItems: 'center', marginBottom: 14 }}
              onPress={() => setStep('webview')}
            >
              <Text style={{ color: btnText, fontSize: 17, fontWeight: '700' }}>Get started</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ width: '100%', borderRadius: 50, paddingVertical: 17, alignItems: 'center', borderWidth: 1.5, borderColor: outlineBtnBorder, marginBottom: insets2.bottom + 8 }}
              onPress={() => setStep('device')}
            >
              <Text style={{ color: outlineBtnText, fontSize: 17, fontWeight: '600' }}>Continue on another device</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {step === 'device' && (
          <ScrollView contentContainerStyle={{ padding: 28 }} showsVerticalScrollIndicator={false}>
            <Text style={{ fontSize: 26, fontWeight: '700', color: primaryText, marginBottom: 12 }}>Continue on another device</Text>
            <Text style={{ fontSize: 15, color: secondaryText, lineHeight: 22, marginBottom: 36 }}>
              To verify your identity, we will need access to your camera. You can scan the QR code with your phone camera to continue on your mobile device. No app download is required.
            </Text>
            <View style={{ alignItems: 'center', marginBottom: 36 }}>
              <View style={{ width: 180, height: 180, borderRadius: 16, backgroundColor: inputBg, borderWidth: 1, borderColor, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="qr-code" size={140} color={qrIconColor} />
              </View>
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 }} onPress={handleCopyLink} activeOpacity={0.7}>
                <Text style={{ color: '#475569', fontSize: 13, textDecorationLine: 'underline' }} numberOfLines={1}>{PERSONA_LINK}</Text>
                <Ionicons name="link-outline" size={16} color={secondaryText} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={{ width: '100%', backgroundColor: btnBg, borderRadius: 50, paddingVertical: 17, alignItems: 'center', marginBottom: 14 }}
              onPress={handleSendEmail}
            >
              <Text style={{ color: btnText, fontSize: 17, fontWeight: '700' }}>Send Email</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 14 }} onPress={handleVerified}>
              <Text style={{ color: secondaryText, fontSize: 15 }}>I have completed verification</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {step === 'webview' && (
          <View style={{ flex: 1 }}>
            {webviewLoading && (
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', zIndex: 10, backgroundColor: bg }}>
                <ActivityIndicator size="large" color="#6366F1" />
                <Text style={{ color: secondaryText, fontSize: 14, marginTop: 12 }}>Loading verification...</Text>
              </View>
            )}
            <WebView
              source={{ uri: PERSONA_LINK }}
              style={{ flex: 1 }}
              onLoadStart={() => setWebviewLoading(true)}
              onLoadEnd={() => setWebviewLoading(false)}
              onNavigationStateChange={(state) => {
                if (state.url?.includes('success') || state.url?.includes('complete') || state.url?.includes('verified')) {
                  handleVerified();
                }
              }}
              javaScriptEnabled
              domStorageEnabled
            />
            <TouchableOpacity
              style={{ paddingVertical: 16, alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: borderColor, backgroundColor: bg, paddingBottom: insets2.bottom + 8 }}
              onPress={handleVerified}
            >
              <Text style={{ color: personaText, fontSize: 15, fontWeight: '600' }}>Verification complete</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VERIFIED BADGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
function VerifiedBadge({ onPress, tier }: { onPress: () => void; tier: 'pro' | 'plus' | 'go' | null }) {
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (tier) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0, duration: 1200, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [tier]);

  if (!tier) return null;

  const badgeSource = tier === 'plus'
    ? require('../assets/images/plus-badge.png')
    : tier === 'go'
    ? require('../assets/images/plan-go.png')
    : require('../assets/images/verified-badge.png');

  return (
    <TouchableOpacity onPress={onPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.75}>
      <Animated.View style={{
        opacity: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }),
        transform: [{ scale: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.05] }) }],
      }}>
        <ExpoImageBadge source={badgeSource} style={{ width: 22, height: 22 }} contentFit="contain" />
      </Animated.View>
    </TouchableOpacity>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VERIFIED BADGE MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function VerifiedBadgeModal({ visible, onClose, isDark, tier }: {
  visible: boolean; onClose: () => void; isDark: boolean; tier: 'pro' | 'plus' | 'go';
}) {
  const bg = isDark ? '#1C1C1E' : '#FFFFFF';
  const primaryText = isDark ? '#FFFFFF' : '#000000';
  const secondaryText = isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.6)';
  const isPlus = tier === 'plus';
  const isGo = tier === 'go';

  const proBenefits = [
    { icon: '💰', text: '$20 welcome reward (credited after verification approval)' },
    { icon: '🚀', text: 'Unlimited messaging access' },
    { icon: '📸', text: 'Unlimited photo uploads' },
    { icon: '💬', text: 'No message limits' },
    { icon: '⚡', text: 'Priority system performance' },
    { icon: '🎯', text: 'Full premium feature access' },
  ];
  const plusBenefits = [
    { icon: '✨', text: 'Advanced AI model access' },
    { icon: '🚀', text: 'Faster response times' },
    { icon: '📸', text: 'Higher quality outputs' },
    { icon: '💬', text: 'Extended context window' },
    { icon: '⚡', text: 'Priority support' },
    { icon: '🎯', text: 'Exclusive Plus features' },
  ];
  const goBenefits = [
    { icon: '🚀', text: 'Faster response times' },
    { icon: '📸', text: 'Photo upload access' },
    { icon: '💬', text: 'Extended message limits' },
    { icon: '⚡', text: 'Standard priority support' },
    { icon: '🎯', text: 'Go Plan features' },
  ];

  const benefits = isPlus ? plusBenefits : isGo ? goBenefits : proBenefits;
  const badgeSource = isPlus
    ? require('../assets/images/plus-badge.png')
    : isGo
    ? require('../assets/images/plan-go.png')
    : require('../assets/images/verified-badge.png');
  const title = isPlus ? '✔ Verified Plus Member' : isGo ? '✔ Verified Go Member' : '✔ Verified Pro Member';
  const subtitle = isPlus
    ? 'This badge confirms that the user is a Plus Plan Verified Member.'
    : isGo
    ? 'This badge confirms that the user is a Go Plan Verified Member.'
    : 'This badge confirms that the user is a Pro Plan Verified Member.';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 24 }}>
        <TouchableOpacity style={{ ...StyleSheet.absoluteFillObject }} activeOpacity={1} onPress={onClose} />
        <View style={{ width: '100%', maxWidth: 360, borderRadius: 24, overflow: 'hidden', backgroundColor: bg, shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.4, shadowRadius: 24, elevation: 24 }}>
          <TouchableOpacity
            style={{ position: 'absolute', top: 14, right: 14, width: 32, height: 32, borderRadius: 16, backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}
            onPress={onClose}
          >
            <Text style={{ color: primaryText, fontSize: 16, fontWeight: '600' }}>✕</Text>
          </TouchableOpacity>
          <View style={{ padding: 28, alignItems: 'center' }}>
            <ExpoImageBadge source={badgeSource} style={{ width: 72, height: 72, marginBottom: 16 }} contentFit="contain" />
            <Text style={{ fontSize: 22, fontWeight: '800', color: primaryText, marginBottom: 6, textAlign: 'center' }}>{title}</Text>
            <Text style={{ fontSize: 14, color: secondaryText, textAlign: 'center', lineHeight: 20, marginBottom: 24 }}>{subtitle}</Text>
            <View style={{ width: '100%', backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', borderRadius: 16, padding: 16, marginBottom: 20 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: secondaryText, marginBottom: 12, textTransform: 'uppercase' }}>
                {isPlus ? 'Plus Benefits' : 'Exclusive Benefits'}
              </Text>
              {benefits.map((b, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                  <Text style={{ fontSize: 16 }}>{b.icon}</Text>
                  <Text style={{ fontSize: 14, color: primaryText, flex: 1, lineHeight: 20 }}>{b.text}</Text>
                </View>
              ))}
            </View>
            <View style={{ backgroundColor: 'rgba(220,38,38,0.1)', borderRadius: 12, padding: 12, width: '100%', borderWidth: 1, borderColor: 'rgba(220,38,38,0.2)' }}>
              <Text style={{ fontSize: 12, color: '#DC2626', textAlign: 'center', fontWeight: '600', lineHeight: 18 }}>
                All benefits are activated only for verified {isPlus ? 'Plus' : 'Pro'} members. Badge status is controlled by the system only.
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EDIT PROFILE MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function EditModalContent({
  isDark, editPhoto, initials, uploadingPhoto, editName, editUsername,
  canChangeUsername, daysUntilUsernameChange, savingProfile,
  primaryText, secondaryText, insets,
  onPickPhoto, onChangeName, onChangeUsername, onSave, onClose,
}: {
  isDark: boolean; editPhoto: string; initials: string; uploadingPhoto: boolean;
  editName: string; editUsername: string;
  canChangeUsername: () => boolean; daysUntilUsernameChange: () => number;
  savingProfile: boolean; primaryText: string; secondaryText: string;
  insets: { bottom: number };
  onPickPhoto: () => void; onChangeName: (v: string) => void;
  onChangeUsername: (v: string) => void; onSave: () => void; onClose: () => void;
}) {
  const inputBg = isDark ? '#2C2C2E' : '#F2F2F7';
  const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  const canChange = canChangeUsername();
  const daysLeft = daysUntilUsernameChange();

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 16 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)', marginBottom: 20 }} />
      <Text style={{ fontSize: 20, fontWeight: '700', color: primaryText, textAlign: 'center', marginBottom: 6 }}>Edit Profile</Text>
      <Text style={{ fontSize: 13, color: secondaryText, textAlign: 'center', marginBottom: 16 }}>Your profile helps people recognize you.</Text>

      <TouchableOpacity onPress={onPickPhoto} style={{ alignSelf: 'center', marginBottom: 18 }} activeOpacity={0.8}>
        <View style={{ width: 90, height: 90, borderRadius: 45, overflow: 'hidden', backgroundColor: isDark ? '#3A3A3C' : '#E5E5EA', alignItems: 'center', justifyContent: 'center' }}>
          {uploadingPhoto ? (
            <ActivityIndicator color={primaryText} />
          ) : editPhoto ? (
            <Image source={{ uri: editPhoto }} style={{ width: 90, height: 90 }} contentFit="cover" />
          ) : (
            <Text style={{ fontSize: 36, fontWeight: '700', color: primaryText }}>{initials}</Text>
          )}
        </View>
        <View style={{ position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: '#10A37F', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: isDark ? '#1C1C1E' : '#F2F2F7' }}>
          <Ionicons name="camera" size={14} color="#FFF" />
        </View>
      </TouchableOpacity>

      <Text style={{ fontSize: 13, fontWeight: '500', color: secondaryText, marginBottom: 6, marginLeft: 2 }}>Display Name</Text>
      <TextInput
        style={{ backgroundColor: inputBg, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, color: primaryText, marginBottom: 12, borderWidth: 1, borderColor }}
        value={editName}
        onChangeText={onChangeName}
        placeholder="Your name"
        placeholderTextColor={secondaryText}
        returnKeyType="next"
      />

      <Text style={{ fontSize: 13, fontWeight: '500', color: secondaryText, marginBottom: 6, marginLeft: 2 }}>Username</Text>
      <TextInput
        style={{ backgroundColor: canChange ? inputBg : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'), borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: canChange ? primaryText : secondaryText, marginBottom: 6, borderWidth: 1, borderColor }}
        value={editUsername}
        onChangeText={onChangeUsername}
        placeholder="username"
        placeholderTextColor={secondaryText}
        editable={canChange}
        autoCapitalize="none"
        returnKeyType="done"
      />
      {!canChange && (
        <Text style={{ fontSize: 12, color: secondaryText, marginBottom: 12, marginLeft: 2 }}>
          Username can be changed in {daysLeft} day{daysLeft !== 1 ? 's' : ''}
        </Text>
      )}
      {canChange && <View style={{ marginBottom: 12 }} />}

      <TouchableOpacity
        style={{ backgroundColor: '#10A37F', borderRadius: 50, paddingVertical: 14, alignItems: 'center', marginBottom: 10, opacity: savingProfile ? 0.7 : 1 }}
        onPress={onSave}
        disabled={savingProfile}
        activeOpacity={0.8}
      >
        {savingProfile ? <ActivityIndicator color="#FFF" /> : <Text style={{ fontSize: 17, fontWeight: '700', color: '#FFF' }}>Save Changes</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 10 }} onPress={onClose}>
        <Text style={{ fontSize: 17, color: secondaryText }}>Cancel</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// GUEST SETTINGS
// ═══════════════════════════════════════════════════════════════════════════════
function GuestSettings() {
  const { isDark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const bg = isDark ? '#000000' : '#F2F2F7';
  const cardBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const primaryText = isDark ? '#FFFFFF' : '#000000';
  const secondaryText = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)';
  const divider = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: insets.top + 12, paddingBottom: 12, paddingHorizontal: 20 }}>
        <Text style={{ fontSize: 17, fontWeight: '700', color: primaryText }}>Settings</Text>
        <TouchableOpacity
          style={{ position: 'absolute', right: 16, top: insets.top + 4, width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)', alignItems: 'center', justifyContent: 'center' }}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={17} color={primaryText} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
        <View style={{ marginTop: 8, paddingHorizontal: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: secondaryText, marginBottom: 8, marginLeft: 4, textTransform: 'uppercase' }}>Account</Text>
          <View style={{ backgroundColor: cardBg, borderRadius: 16, overflow: 'hidden' }}>
            {[
              { icon: 'megaphone-outline', label: 'Ads controls', route: '/ads-controls' },
              { icon: 'document-lock-outline', label: 'Data controls', route: '/data-controls' },
            ].map((item, i, arr) => (
              <TouchableOpacity
                key={item.label}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: i < arr.length - 1 ? StyleSheet.hairlineWidth : 0, borderBottomColor: divider }}
                onPress={() => router.push(item.route as any)}
                activeOpacity={0.6}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Ionicons name={item.icon as any} size={20} color={secondaryText} />
                  <Text style={{ fontSize: 16, color: primaryText }}>{item.label}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={secondaryText} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ marginHorizontal: 16, marginTop: 24 }}>
          <View style={{ backgroundColor: cardBg, borderRadius: 16, overflow: 'hidden' }}>
            <View style={{ padding: 24, alignItems: 'center' }}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#10A37F22', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <Ionicons name="lock-open-outline" size={28} color="#10A37F" />
              </View>
              <Text style={{ color: primaryText, fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 6 }}>Unlock all settings</Text>
              <Text style={{ color: secondaryText, fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 20 }}>
                Create an account to access personalization, notifications, parental controls, and more.
              </Text>
              <TouchableOpacity
                style={{ backgroundColor: '#10A37F', borderRadius: 50, paddingVertical: 14, paddingHorizontal: 32, width: '100%', alignItems: 'center' }}
                onPress={() => router.push('/login')}
              >
                <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700' }}>Sign up for free</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ marginTop: 12, paddingVertical: 8 }} onPress={() => router.push('/login')}>
                <Text style={{ color: secondaryText, fontSize: 15 }}>Already have an account? Log in</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACCENT COLORS
// ═══════════════════════════════════════════════════════════════════════════════
const ACCENT_COLORS: Array<{ hex: string; name: string }> = [
  { hex: '#10A37F', name: 'Green' },
  { hex: '#0A84FF', name: 'Blue' },
  { hex: '#FF9F0A', name: 'Orange' },
  { hex: '#FF453A', name: 'Red' },
  { hex: '#BF5AF2', name: 'Purple' },
  { hex: '#FF375F', name: 'Pink' },
  { hex: '#30D158', name: 'Mint' },
  { hex: '#5AC8FA', name: 'Sky' },
  { hex: '#FFD60A', name: 'Yellow' },
  { hex: '#FF6B00', name: 'Amber' },
  { hex: '#64D2FF', name: 'Cyan' },
  { hex: '#FF2D55', name: 'Rose' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SETTINGS SCREEN
// ═══════════════════════════════════════════════════════════════════════════════
export default function SettingsScreen() {
  const { isDark } = useTheme();
  const { settings, updateSetting } = useSettings();
  const { tier } = useSubscription();
  const { user, logout } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();
  const { setProfilePhotoUrl: setGlobalPhoto, setDisplayName: setGlobalName, setUsername: setGlobalUsername } = useProfile();
  const { isConnected } = useNetworkStatus();

  const [isAdmin, setIsAdmin] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const PROFILE_CACHE_KEY = `settings_profile_${user?.id || 'unknown'}`;
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editPhoto, setEditPhoto] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [usernameLastChanged, setUsernameLastChanged] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoPickerVisible, setPhotoPickerVisible] = useState(false);
  const [accentPickerVisible, setAccentPickerVisible] = useState(false);
  const [verifiedBadgeModalVisible, setVerifiedBadgeModalVisible] = useState(false);
  const [ageVerifiedModalVisible, setAgeVerifiedModalVisible] = useState(false);
  const [isAgeVerified, setIsAgeVerified] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'update' | 'no-update' | 'version'>('idle');

  const currentVersion = Constants.expoConfig?.version || '1.0.0';

  const bg = isDark ? '#000000' : '#F2F2F7';
  const cardBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const primaryText = isDark ? '#FFFFFF' : '#000000';
  const secondaryText = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)';
  const sectionLabel = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)';
  const divider = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const switchTrackFalse = isDark ? '#3A3A3C' : '#E5E5EA';
  const switchTrackTrue = '#34C759';

  const openLink = async (url: string) => {
    if (url.startsWith('/')) {
      router.push(url as any);
    } else {
      try {
        await WebBrowser.openBrowserAsync(url, { toolbarColor: isDark ? '#000000' : '#FFFFFF', controlsColor: '#10A37F', showTitle: true });
      } catch (_e) {
        Linking.openURL(url);
      }
    }
  };

  useEffect(() => {
    checkAdminAccess();
    AsyncStorage.getItem(AGE_VERIFIED_KEY).then(val => {
      if (val === 'true') setIsAgeVerified(true);
    }).catch(() => {});
    AsyncStorage.getItem(PROFILE_CACHE_KEY).then(cached => {
      if (cached) {
        try {
          const data = JSON.parse(cached);
          if (data.username) setUsername(data.username);
          if (data.full_name) setFullName(data.full_name);
          if (data.profile_photo_url) { setProfilePhoto(data.profile_photo_url); setGlobalPhoto(data.profile_photo_url); }
          if (data.full_name || data.username) { setGlobalName(data.full_name || data.username || ''); setGlobalUsername(data.username || ''); }
        } catch (_e) {}
      }
    }).catch(() => {});
    loadProfile();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const checkAdminAccess = async () => {
    if (!user) return;
    setIsAdmin(['berryxoe@gmail.com', 'newdawens@gmail.com'].includes(user.email || ''));
  };

  const checkUpdate = async () => {
    setUpdateStatus('checking');
    try {
      if (Platform.OS === 'web') {
        await new Promise(r => setTimeout(r, 1000));
        setUpdateStatus('no-update');
        setTimeout(() => setUpdateStatus('idle'), 3000);
        return;
      }
      const Updates = await import('expo-updates');
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) {
        setUpdateStatus('update');
        showAlert(
          'Update Available',
          'A new version is available. Downloading now...',
          [
            { text: 'Later', style: 'cancel', onPress: () => setUpdateStatus('idle') },
            {
              text: 'Update',
              onPress: async () => {
                try {
                  await Updates.fetchUpdateAsync();
                  showAlert('Ready', 'Update downloaded. Restart to apply.', [
                    { text: 'Restart Now', onPress: () => Updates.reloadAsync() },
                    { text: 'Later', style: 'cancel' },
                  ]);
                } catch (fetchErr: any) {
                  showAlert('Error', fetchErr?.message || 'Failed to download update.');
                  setUpdateStatus('idle');
                }
              },
            },
          ]
        );
      } else {
        setUpdateStatus('no-update');
        showAlert('Up to Date', `You are running the latest version (${currentVersion}).`);
        setTimeout(() => setUpdateStatus('idle'), 4000);
      }
    } catch (e: any) {
      // expo-updates not available in dev/Expo Go — show version info
      setUpdateStatus('version');
      setTimeout(() => setUpdateStatus('idle'), 3000);
    }
  };

  const openStore = () => {
    const appId = 'app.onspace.dawinix2027';
    Linking.openURL(Platform.OS === 'ios' ? `https://apps.apple.com/app/id${appId}` : `https://play.google.com/store/apps/details?id=${appId}`);
  };

  const handleUpdatePress = () => {
    if (updateStatus === 'update') { openStore(); }
    else if (updateStatus === 'idle' || updateStatus === 'no-update' || updateStatus === 'version') { checkUpdate(); }
  };

  const loadProfile = async () => {
    if (!user) return;
    // Load from cache first (offline fallback)
    try {
      const cached = await AsyncStorage.getItem(PROFILE_CACHE_KEY);
      if (cached) {
        const d = JSON.parse(cached);
        if (d.username) setUsername(d.username);
        if (d.full_name) setFullName(d.full_name);
        if (d.profile_photo_url) { setProfilePhoto(d.profile_photo_url); setGlobalPhoto(d.profile_photo_url); }
        setGlobalName(d.full_name || d.username || ''); setGlobalUsername(d.username || '');
      }
    } catch (_e) {}
    // Only load fresh data when connected
    if (!isConnected) return;
    try {
      const { data } = await supabase.from('user_profiles').select('username, profile_photo_url, full_name, username_last_changed').eq('id', user.id).single();
      if (data) {
        setUsername(data.username || '');
        setFullName(data.full_name || '');
        setProfilePhoto(data.profile_photo_url || '');
        setUsernameLastChanged(data.username_last_changed || null);
        setGlobalPhoto(data.profile_photo_url || '');
        setGlobalName(data.full_name || data.username || '');
        setGlobalUsername(data.username || '');
        AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(data)).catch(() => {});
      }
    } catch (_e) {}
  };

  const canChangeUsername = (): boolean => {
    if (!usernameLastChanged) return true;
    const daysDiff = (new Date().getTime() - new Date(usernameLastChanged).getTime()) / (1000 * 60 * 60 * 24);
    return daysDiff >= 14;
  };

  const daysUntilUsernameChange = (): number => {
    if (!usernameLastChanged) return 0;
    const daysDiff = (new Date().getTime() - new Date(usernameLastChanged).getTime()) / (1000 * 60 * 60 * 24);
    return Math.max(0, Math.ceil(14 - daysDiff));
  };

  const openEditModal = () => {
    setEditName(fullName || username || '');
    setEditUsername(username || '');
    setEditPhoto(profilePhoto || '');
    setEditModalVisible(true);
  };

  const pickEditPhoto = () => {
    setEditModalVisible(false);
    setTimeout(() => setPhotoPickerVisible(true), 350);
  };

  const uploadAsset = async (asset: ImagePicker.ImagePickerAsset) => {
    setUploadingPhoto(true);
    try {
      const base64 = asset.base64;
      if (!base64) throw new Error('No base64');
      const arrayBuffer = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      const ext = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
      const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
      if (!user?.id) throw new Error('User not authenticated');
      const filePath = `${user.id}/avatar_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('profile-images').upload(filePath, arrayBuffer, { contentType: mimeType, upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('profile-images').getPublicUrl(filePath);
      setEditPhoto(urlData.publicUrl);
    } catch (e) {
      showAlert('Upload failed', 'Could not upload photo. Try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const pickFromLibrary = async () => {
    setPhotoPickerVisible(false);
    await new Promise(r => setTimeout(r, 350));
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { showAlert('Permission needed', 'Please allow photo access to change your profile picture.'); setEditModalVisible(true); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8, base64: true });
    if (!result.canceled && result.assets[0]) await uploadAsset(result.assets[0]);
    setEditModalVisible(true);
  };

  const pickFromCamera = async () => {
    setPhotoPickerVisible(false);
    await new Promise(r => setTimeout(r, 350));
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { showAlert('Permission needed', 'Please allow camera access to take a profile photo.'); setEditModalVisible(true); return; }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8, base64: true });
    if (!result.canceled && result.assets[0]) await uploadAsset(result.assets[0]);
    setEditModalVisible(true);
  };

  const saveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    try {
      const updates: any = { full_name: editName, profile_photo_url: editPhoto };
      const usernameChanged = editUsername !== username;
      if (usernameChanged) {
        if (!canChangeUsername()) { showAlert('Username locked', `You can change your username in ${daysUntilUsernameChange()} days.`); setSavingProfile(false); return; }
        updates.username = editUsername;
        updates.username_last_changed = new Date().toISOString();
      }
      const { error } = await supabase.from('user_profiles').update(updates).eq('id', user.id);
      if (error) throw error;
      setFullName(editName); setUsername(editUsername); setProfilePhoto(editPhoto);
      if (usernameChanged) setUsernameLastChanged(new Date().toISOString());
      setGlobalPhoto(editPhoto); setGlobalName(editName); setGlobalUsername(editUsername);
      setEditModalVisible(false);
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to save profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleLogout = () => {
    showAlert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out', style: 'destructive',
        onPress: async () => {
          try { await AsyncStorage.removeItem('passkey_session_active'); await AsyncStorage.removeItem('passkey_user_id'); } catch (_) {}
          await logout();
          router.replace('/login');
        },
      },
    ]);
  };

  const ADMIN_EMAILS_SETTINGS = ['berryxoe@gmail.com', 'newdawens@gmail.com', 'kontgithub@gmail.com'];
  const isAdminUser = ADMIN_EMAILS_SETTINGS.includes(user?.email?.toLowerCase() || '');
  const isPaidPlan = isAdminUser || ['go', 'plus'].includes(tier);

  const tierLabel = () => {
    if (isAdminUser) return 'Admin — Plus';
    if (tier === 'plus') return 'Plus';
    if (tier === 'go') return 'Go';
    return 'Free Plan';
  };

  if (!user) return <GuestSettings />;

  const displayName = fullName || username || user?.email?.split('@')[0] || 'User';
  const displayUsername = username || '';
  const initials = (displayName[0] || 'U').toUpperCase();

  const Card = ({ children }: { children: React.ReactNode }) => (
    <View style={{ backgroundColor: cardBg, borderRadius: 16, overflow: 'hidden', marginHorizontal: 16 }}>{children}</View>
  );

  const SectionLabel = ({ text }: { text: string }) => (
    <Text style={{ fontSize: 13, fontWeight: '600', color: sectionLabel, marginBottom: 8, marginLeft: 20, marginTop: 24, textTransform: 'uppercase' }}>{text}</Text>
  );

  const Row = ({ icon, label, value, onPress, isLast, showChevron = true, rightEl }: {
    icon?: string; label: string; value?: string; onPress?: () => void; isLast?: boolean; showChevron?: boolean; rightEl?: React.ReactNode;
  }) => (
    <TouchableOpacity
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth, borderBottomColor: divider }}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.6 : 1}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
        {icon ? <Ionicons name={icon as any} size={20} color={secondaryText} /> : null}
        <Text style={{ fontSize: 16, color: primaryText, fontWeight: '400' }}>{label}</Text>
      </View>
      {rightEl ? rightEl : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {value ? <Text style={{ fontSize: 15, color: secondaryText }}>{value}</Text> : null}
          {onPress && showChevron ? <Ionicons name="chevron-forward" size={16} color={secondaryText} /> : null}
        </View>
      )}
    </TouchableOpacity>
  );

  const SwitchRow = ({ icon, label, value, onChange, isLast }: {
    icon: string; label: string; value: boolean; onChange: (v: boolean) => void; isLast?: boolean;
  }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth, borderBottomColor: divider, opacity: isConnected ? 1 : 0.45 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
        <Ionicons name={icon as any} size={20} color={secondaryText} />
        <Text style={{ fontSize: 16, color: primaryText, fontWeight: '400' }}>{label}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={(v) => {
          if (!isConnected) { showAlert('No Internet', 'An internet connection is required to change settings.'); return; }
          onChange(v);
        }}
        trackColor={{ true: switchTrackTrue, false: switchTrackFalse }}
        thumbColor={Platform.OS === 'ios' ? undefined : '#FFFFFF'}
        disabled={!isConnected}
      />
    </View>
  );

  const AccentColorRow = () => {
    const current = settings.accentColor || '#10A37F';
    const currentName = ACCENT_COLORS.find(c => c.hex === current)?.name || 'Green';
    return (
      <TouchableOpacity
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: divider }}
        onPress={() => setAccentPickerVisible(true)}
        activeOpacity={0.6}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
          <Ionicons name="color-palette-outline" size={20} color={secondaryText} />
          <Text style={{ fontSize: 16, color: primaryText, fontWeight: '400' }}>Accent color</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: current, borderWidth: 1.5, borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.12)' }} />
          <Text style={{ fontSize: 15, color: secondaryText }}>{currentName}</Text>
          <Ionicons name="chevron-forward" size={16} color={secondaryText} />
        </View>
      </TouchableOpacity>
    );
  };

  const AppearanceRow = () => {
    const [showDropdown, setShowDropdown] = useState(false);
    const current = settings.appearance || 'System';
    const options = ['System', 'Light', 'Dark'];
    return (
      <>
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: showDropdown ? 0 : StyleSheet.hairlineWidth, borderBottomColor: divider }}
          onPress={() => setShowDropdown(!showDropdown)}
          activeOpacity={0.6}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
            <Ionicons name="moon-outline" size={20} color={secondaryText} />
            <Text style={{ fontSize: 16, color: primaryText, fontWeight: '400' }}>Appearance</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 15, color: secondaryText }}>{current}</Text>
            <Ionicons name={showDropdown ? 'chevron-up' : 'chevron-down'} size={16} color={secondaryText} />
          </View>
        </TouchableOpacity>
        {showDropdown && (
          <View style={{ backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7', marginHorizontal: 16, marginBottom: 8, borderRadius: 12, overflow: 'hidden' }}>
            {options.map((opt, i) => {
              const isSelected = current === opt;
              return (
                <TouchableOpacity
                  key={opt}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: i < options.length - 1 ? StyleSheet.hairlineWidth : 0, borderBottomColor: divider }}
                  onPress={() => { updateSetting('appearance', opt); setShowDropdown(false); }}
                  activeOpacity={0.6}
                >
                  <Text style={{ fontSize: 16, color: primaryText }}>{opt}</Text>
                  {isSelected ? <Ionicons name="checkmark" size={20} color="#34C759" /> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {/* HEADER */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: insets.top + 16, paddingBottom: 16, paddingHorizontal: 20 }}>
        <Text style={{ fontSize: 17, fontWeight: '700', color: primaryText }}>Settings</Text>
        <TouchableOpacity
          style={{ position: 'absolute', right: 16, top: insets.top + 8, width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)', alignItems: 'center', justifyContent: 'center' }}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={17} color={primaryText} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {/* OFFLINE BANNER */}
        {!isConnected ? (
          <View style={{ backgroundColor: '#FF9500', marginHorizontal: 16, marginTop: 8, marginBottom: 4, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="cloud-offline-outline" size={16} color="#FFF" />
            <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '600', flex: 1 }}>No internet — settings are read-only</Text>
          </View>
        ) : null}

        {/* PROFILE */}}
        <View style={{ alignItems: 'center', paddingVertical: 20 }}>
          <View style={{ width: 84, height: 84, borderRadius: 42, overflow: 'hidden', backgroundColor: isDark ? '#3A3A3C' : '#E5E5EA', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            {profilePhoto && isConnected ? (
              <Image source={{ uri: profilePhoto }} style={{ width: 84, height: 84 }} contentFit="cover" />
            ) : !isConnected ? (
              <Ionicons name="person-circle-outline" size={60} color={secondaryText} />
            ) : (
              <Text style={{ fontSize: 34, fontWeight: '700', color: primaryText }}>{initials}</Text>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: primaryText }}>{isConnected ? displayName : 'Profile (offline)'}</Text>
            <VerifiedBadge
              tier={isAdminUser ? 'plus' : tier === 'plus' ? 'plus' : tier === 'go' ? 'go' : null}
              onPress={() => setVerifiedBadgeModalVisible(true)}
            />
          </View>
          {displayUsername ? <Text style={{ fontSize: 15, color: secondaryText, marginBottom: 14 }}>{displayUsername}</Text> : null}
          <TouchableOpacity
            style={{ paddingHorizontal: 22, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)', backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', opacity: isConnected ? 1 : 0.4 }}
            onPress={() => {
              if (!isConnected) { showAlert('No Internet', 'An internet connection is required to edit your profile.'); return; }
              openEditModal();
            }}
          >
            <Text style={{ fontSize: 15, color: primaryText, fontWeight: '500' }}>Edit profile</Text>
          </TouchableOpacity>
        </View>

        {/* ACCOUNT */}
        <SectionLabel text="Account" />
        <Card>
          <Row icon="mail-outline" label="Email" value={(user?.email?.length ?? 0) > 22 ? (user?.email?.slice(0, 20) + '...') : (user?.email || '')} />
          <Row icon="star-outline" label="Subscription" value={tierLabel()} showChevron={false} />
          {!isPaidPlan ? <Row icon="arrow-up-circle-outline" label="Upgrade to Plus" showChevron={false} /> : null}
          <Row icon="refresh-outline" label="Restore purchases" onPress={() => router.push('/subscription')} />
          <Row icon="receipt-outline" label="Orders" onPress={() => router.push('/orders')} />
          <Row icon="person-circle-outline" label="Personalization" onPress={() => router.push('/personalization')} />
          <Row icon="notifications-outline" label="Notifications" onPress={() => router.push('/notifications')} />
          <Row icon="people-outline" label="Parental controls" onPress={() => router.push('/parental-controls')} />
          <Row icon="document-lock-outline" label="Data controls" onPress={() => router.push('/data-controls')} />
          <Row icon="megaphone-outline" label="Ads controls" onPress={() => router.push('/ads-controls')} />
          <Row icon="apps-outline" label="Apps & connectors" onPress={() => router.push('/app-connect')} />
          <Row icon="archive-outline" label="Archived chats" onPress={() => {
            if (!isConnected) { showAlert('No Internet', 'An internet connection is required to view archived chats.'); return; }
            router.push('/archived-chats');
          }} />
          <Row icon="lock-closed-outline" label="Security" onPress={() => {
            if (!isConnected) { showAlert('No Internet', 'An internet connection is required to access security settings.'); return; }
            router.push('/security');
          }} />
          {!isAgeVerified ? (
            <Row icon="shield-checkmark-outline" label="Age verification" onPress={() => setAgeVerifiedModalVisible(true)} isLast />
          ) : null}
        </Card>

        {/* APP */}
        <SectionLabel text="App" />
        <Card>
          <Row icon="globe-outline" label="App language" value={settings.appLanguage || 'English'} onPress={() => { if (Platform.OS === 'ios') { Linking.openURL('app-settings:'); } else { Linking.openSettings(); } }} />
          <AppearanceRow />
          <AccentColorRow />
          <SwitchRow icon="phone-portrait-outline" label="Haptic feedback" value={settings.hapticFeedback} onChange={v => updateSetting('hapticFeedback', v)} />
          <SwitchRow icon="text-outline" label="Correct spelling automatically" value={settings.autoSpelling} onChange={v => updateSetting('autoSpelling', v)} isLast />
        </Card>

        {/* SPEECH */}
        <SectionLabel text="Speech" />
        <Card>
          <Row icon="globe-outline" label="Main language" value={settings.mainLanguage || 'English'} onPress={() => router.push('/Speech-Language')} isLast />
        </Card>
        <Text style={{ fontSize: 13, color: secondaryText, marginTop: 8, marginHorizontal: 20, lineHeight: 18 }}>
          {"For best results, select the language you mainly speak."}
        </Text>

        {/* VOICE */}
        <SectionLabel text="Voice" />
        <Card>
          <Row icon="mic-outline" label="Voice" value={settings.voiceSelection || 'Juniper'} onPress={() => router.push('/voice-select')} />
          <SwitchRow icon="chatbubbles-outline" label="Background conversations" value={settings.backgroundConversations} onChange={v => updateSetting('backgroundConversations', v)} isLast />
        </Card>

        {/* SUGGESTIONS */}
        <SectionLabel text="Suggestions" />
        <Card>
          <SwitchRow icon="create-outline" label="Autocomplete" value={settings.autocomplete} onChange={v => updateSetting('autocomplete', v)} />
          <SwitchRow icon="trending-up-outline" label="Trending searches" value={settings.trendingSearches} onChange={v => updateSetting('trendingSearches', v)} isLast />
        </Card>
        <Text style={{ fontSize: 13, color: secondaryText, marginTop: 8, marginHorizontal: 20, lineHeight: 18 }}>
          Background conversations keep the conversation going in other apps or while your screen is off.{' '}
          <Text style={{ color: '#007AFF', fontWeight: '500' }} onPress={() => openLink('https://dawinix.com/voice-suggest/')}>
            Learn more
          </Text>
        </Text>

        {/* ADMIN */}
        {isAdmin ? (
          <>
            <SectionLabel text="Admin" />
            <Card>
              <Row icon="shield-outline" label="Admin Dashboard" onPress={() => router.push('/admin')} />
              <Row icon="key-outline" label="Apple JWT Key Generator" onPress={() => router.push('/AppleGenerateJWTkey')} />
              <Row icon="mail-outline" label="Send Email to Users" onPress={() => router.push('/admin-email')} isLast />
            </Card>
          </>
        ) : null}

        {/* ABOUT */}
        <SectionLabel text="About" />
        <Card>
          <Row icon="bug-outline" label="Report bug" showChevron={false} onPress={() => openLink('/bugreport')} />
          <Row icon="help-circle-outline" label="Help Center" showChevron={false} onPress={() => openLink('https://yourapp.com/help')} />
          <Row icon="document-text-outline" label="Terms of Use" showChevron={false} onPress={() => openLink('https://yourapp.com/terms')} />
          <Row icon="shield-outline" label="Privacy Policy" showChevron={false} onPress={() => openLink('https://yourapp.com/privacy')} />
          <Row
            icon="refresh-circle-outline"
            label="Check for updates"
            showChevron={false}
            onPress={handleUpdatePress}
            rightEl={
              updateStatus === 'checking' ? (
                <ActivityIndicator size="small" color={secondaryText} />
              ) : (
                <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: updateStatus === 'update' ? '#FF453A' : (updateStatus === 'no-update' ? '#34C759' : '#10A37F') }} />
              )
            }
            isLast
          />
        </Card>

        {/* LOG OUT */}
        <View style={{ marginTop: 24, marginHorizontal: 16, marginBottom: 8 }}>
          <TouchableOpacity
            style={{ backgroundColor: cardBg, borderRadius: 16, flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}
            onPress={handleLogout}
            activeOpacity={0.6}
          >
            <Ionicons name="arrow-forward-circle-outline" size={22} color={primaryText} />
            <Text style={{ fontSize: 16, color: primaryText, fontWeight: '500', marginLeft: 14, flex: 1 }}>Log out</Text>
          </TouchableOpacity>
        </View>

        {/* VERSION FOOTER */}
        <View style={{ alignItems: 'center', paddingBottom: 12, paddingTop: 4 }}>
          <Text style={{ fontSize: 13, color: secondaryText }}>Dawinix HT · Version {currentVersion}</Text>
        </View>
      </ScrollView>

      {/* EDIT PROFILE MODAL */}
      <Modal visible={editModalVisible} transparent animationType="slide" onRequestClose={() => setEditModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.3)' }}>
          <TouchableOpacity style={{ flex: 0.25 }} activeOpacity={1} onPress={() => setEditModalVisible(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 0.75, maxHeight: 560 }}>
            <View style={{ flex: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' }}>
              <EditModalContent
                isDark={isDark}
                editPhoto={editPhoto}
                initials={initials}
                uploadingPhoto={uploadingPhoto}
                editName={editName}
                editUsername={editUsername}
                canChangeUsername={canChangeUsername}
                daysUntilUsernameChange={daysUntilUsernameChange}
                savingProfile={savingProfile}
                primaryText={primaryText}
                secondaryText={secondaryText}
                insets={insets}
                onPickPhoto={pickEditPhoto}
                onChangeName={setEditName}
                onChangeUsername={setEditUsername}
                onSave={saveProfile}
                onClose={() => setEditModalVisible(false)}
              />
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* VERIFIED BADGE MODAL */}
      <VerifiedBadgeModal
        visible={verifiedBadgeModalVisible}
        onClose={() => setVerifiedBadgeModalVisible(false)}
        isDark={isDark}
        tier={isAdminUser ? 'plus' : tier === 'plus' ? 'plus' : 'pro'}
      />

      {/* AGE VERIFICATION MODAL */}
      <AgeVerificationModal
        visible={ageVerifiedModalVisible}
        onClose={() => setAgeVerifiedModalVisible(false)}
        onVerified={() => setIsAgeVerified(true)}
      />

      {/* PHOTO PICKER MODAL */}
      <Modal visible={photoPickerVisible} transparent animationType="fade" onRequestClose={() => setPhotoPickerVisible(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.3)' }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setPhotoPickerVisible(false)} />
          <View style={{ paddingHorizontal: 12, paddingBottom: insets.bottom + 8 }}>
            <View style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 10, backgroundColor: cardBg }}>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 18, gap: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: divider }}
                onPress={pickFromCamera} activeOpacity={0.7}
              >
                <Ionicons name="camera" size={22} color="#10A37F" />
                <Text style={{ fontSize: 17, color: primaryText, fontWeight: '500' }}>Take Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 18, gap: 14 }}
                onPress={pickFromLibrary} activeOpacity={0.7}
              >
                <Ionicons name="images" size={22} color="#0A84FF" />
                <Text style={{ fontSize: 17, color: primaryText, fontWeight: '500' }}>Choose from Library</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={{ borderRadius: 16, overflow: 'hidden', backgroundColor: cardBg, paddingVertical: 18, alignItems: 'center' }}
              onPress={() => setPhotoPickerVisible(false)} activeOpacity={0.8}
            >
              <Text style={{ fontSize: 17, fontWeight: '600', color: primaryText }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ACCENT COLOR PICKER MODAL */}
      <Modal visible={accentPickerVisible} transparent animationType="slide" onRequestClose={() => setAccentPickerVisible(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setAccentPickerVisible(false)} />
          <View style={{ backgroundColor: cardBg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: insets.bottom + 16 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)', alignSelf: 'center', marginTop: 12, marginBottom: 16 }} />
            <Text style={{ fontSize: 18, fontWeight: '700', color: primaryText, textAlign: 'center', marginBottom: 4 }}>Accent Color</Text>
            <Text style={{ fontSize: 13, color: secondaryText, textAlign: 'center', marginBottom: 20, paddingHorizontal: 24 }}>Choose a color that reflects your style</Text>
            {(settings.accentColor || '#10A37F') === '#10A37F' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 16 }}>
                <View style={{ backgroundColor: '#10A37F22', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: '#10A37F55' }}>
                  <Text style={{ color: '#10A37F', fontSize: 13, fontWeight: '600' }}>Default — Green</Text>
                </View>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: settings.accentColor }} />
                <Text style={{ color: primaryText, fontSize: 15, fontWeight: '600' }}>
                  {ACCENT_COLORS.find(c => c.hex === settings.accentColor)?.name || 'Custom'}
                </Text>
                <TouchableOpacity
                  onPress={() => updateSetting('accentColor', '#10A37F')}
                  style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 }}
                >
                  <Text style={{ color: secondaryText, fontSize: 12, fontWeight: '500' }}>Reset to default</Text>
                </TouchableOpacity>
              </View>
            )}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16, paddingHorizontal: 24 }}>
              {ACCENT_COLORS.map(item => {
                const isSelected = (settings.accentColor || '#10A37F') === item.hex;
                const isDefault = item.hex === '#10A37F';
                return (
                  <TouchableOpacity key={item.hex} onPress={() => updateSetting('accentColor', item.hex)} activeOpacity={0.75} style={{ alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: item.hex, alignItems: 'center', justifyContent: 'center', borderWidth: isSelected ? 3.5 : 0, borderColor: isDark ? '#FFF' : '#000', shadowColor: item.hex, shadowOffset: { width: 0, height: 2 }, shadowOpacity: isSelected ? 0.5 : 0.15, shadowRadius: isSelected ? 8 : 3, elevation: isSelected ? 6 : 2 }}>
                      {isSelected ? <Ionicons name="checkmark" size={22} color="#FFF" /> : null}
                    </View>
                    <Text style={{ fontSize: 11, color: isSelected ? primaryText : secondaryText, fontWeight: isSelected ? '600' : '400' }}>
                      {isDefault ? 'Default' : item.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={{ paddingHorizontal: 20, paddingTop: 24 }}>
              <TouchableOpacity
                style={{ backgroundColor: settings.accentColor || '#10A37F', borderRadius: 50, paddingVertical: 15, alignItems: 'center' }}
                onPress={() => setAccentPickerVisible(false)}
                activeOpacity={0.85}
              >
                <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700' }}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
hello ai can you please the top right x icon the background must be blur expo.