import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Platform, Share, StatusBar, Modal, Switch, Animated,
  ActivityIndicator, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Image as ExpoImage } from 'expo-image';
import { useTheme } from '../hooks/useTheme';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SHAZAM_BLUE = '#0D72EA';
const SHAZAM_BLUE_DARK = '#0A5CC8';

// ── Shazam Logo ──────────────────────────────────────────────────────────────
function ShazamLogo({ size = 80 }: { size?: number }) {
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      overflow: 'hidden',
    }}>
      {/* Blue gradient circle */}
      <View style={{
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: SHAZAM_BLUE,
        alignItems: 'center', justifyContent: 'center',
      }}>
        {/* "S" wave mark */}
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          {/* Top arc */}
          <View style={{
            width: size * 0.54, height: size * 0.54,
            borderRadius: size * 0.27,
            borderWidth: size * 0.075,
            borderColor: 'rgba(255,255,255,0.9)',
            borderBottomColor: 'transparent',
            borderLeftColor: 'transparent',
            transform: [{ rotate: '-45deg' }],
            marginBottom: -size * 0.1,
          }} />
          {/* Bottom arc */}
          <View style={{
            width: size * 0.54, height: size * 0.54,
            borderRadius: size * 0.27,
            borderWidth: size * 0.075,
            borderColor: 'rgba(255,255,255,0.9)',
            borderTopColor: 'transparent',
            borderRightColor: 'transparent',
            transform: [{ rotate: '-45deg' }],
            marginTop: -size * 0.1,
          }} />
        </View>
      </View>
    </View>
  );
}

function DawinixLogo({ size = 52 }: { size?: number }) {
  return (
    <ExpoImage
      source={require('../assets/images/logo.png')}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      contentFit="cover"
    />
  );
}

// ── Info Row ──────────────────────────────────────────────────────────────────
function InfoRow({ label, value, isDark, last, isLink, onPress }: {
  label: string; value: string; isDark: boolean; last?: boolean;
  isLink?: boolean; onPress?: () => void;
}) {
  const textColor = isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.75)';
  const linkColor = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)';
  return (
    <TouchableOpacity
      style={[
        irStyles.row,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' },
      ]}
      onPress={onPress}
      disabled={!isLink && !onPress}
      activeOpacity={isLink || onPress ? 0.5 : 1}
    >
      <Text style={[irStyles.label, { color: isLink ? linkColor : textColor }]}>{label}</Text>
      {!isLink ? (
        <Text style={[irStyles.value, { color: textColor }]}>{value}</Text>
      ) : (
        <Ionicons name="open-outline" size={16} color={linkColor} />
      )}
    </TouchableOpacity>
  );
}

const irStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 15, paddingHorizontal: 18,
  },
  label: { fontSize: 15, fontWeight: '400' },
  value: { fontSize: 15, fontWeight: '500', maxWidth: '55%', textAlign: 'right' },
});

// ── Connect Modal (photo 3 style) ─────────────────────────────────────────────
function ShazamConnectModal({
  visible, onClose, onConnect, isDark,
}: {
  visible: boolean; onClose: () => void; onConnect: () => void; isDark: boolean;
}) {
  const [shareMemories, setShareMemories] = useState(false);
  const subC = 'rgba(255,255,255,0.65)';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={cmStyles.backdrop}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.75)' }]} />
        )}
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={cmStyles.sheet}>
          <TouchableOpacity style={cmStyles.closeBtn} onPress={onClose}>
            <View style={cmStyles.closeBtnInner}>
              <Ionicons name="close" size={15} color="#FFF" />
            </View>
          </TouchableOpacity>

          {/* Logo pair */}
          <View style={cmStyles.logoPair}>
            <DawinixLogo size={54} />
            <View style={cmStyles.logoDots}>
              {[0, 1, 2].map(i => <View key={i} style={cmStyles.logoDot} />)}
            </View>
            <ShazamLogo size={54} />
          </View>

          <Text style={cmStyles.connectTitle}>Connect Shazam</Text>

          <View style={cmStyles.privacyBox}>
            <Text style={cmStyles.privacyText}>
              <Text style={{ fontWeight: '700', color: '#FFF' }}>{"You're in control "}</Text>
              <Text style={{ color: subC }}>Dawinix always respects your privacy preferences, and is limited to permissions you have explicitly set.</Text>
            </Text>
            <View style={cmStyles.privacySep} />
            <Text style={cmStyles.privacyText}>
              <Text style={{ fontWeight: '700', color: '#FFF' }}>Apps may introduce elevated risk </Text>
              <Text style={{ color: subC }}>Dawinix is built to protect your data, but apps may attempt to access your data through Dawinix.</Text>
            </Text>
            <View style={cmStyles.privacySep} />
            <Text style={cmStyles.privacyText}>
              <Text style={{ fontWeight: '700', color: '#FFF' }}>Data shared with this app </Text>
              <Text style={{ color: subC }}>By adding this app, you allow it to access: (1) basic information typically shared when you visit a website, and (2) a summary of your recent context within Dawinix.</Text>
            </Text>
            <View style={cmStyles.privacySep} />
            <View style={cmStyles.toggleRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600', marginBottom: 3 }}>Reference memories and chats</Text>
                <Text style={{ color: subC, fontSize: 12, lineHeight: 17 }}>Allow Dawinix to reference relevant memories when sharing data with Shazam.</Text>
              </View>
              <Switch
                value={shareMemories}
                onValueChange={setShareMemories}
                trackColor={{ true: SHAZAM_BLUE, false: 'rgba(255,255,255,0.2)' }}
                thumbColor="#FFF"
              />
            </View>
          </View>

          <TouchableOpacity style={cmStyles.connectBtn} onPress={onConnect}>
            <Text style={cmStyles.connectBtnText}>Connect Shazam</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const cmStyles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#1A1A1D', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40, alignItems: 'center',
  },
  closeBtn: { position: 'absolute', top: 14, right: 16, zIndex: 10 },
  closeBtnInner: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  logoPair: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  logoDots: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  logoDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: 'rgba(255,255,255,0.4)' },
  connectTitle: { color: '#FFF', fontSize: 22, fontWeight: '700', marginBottom: 18 },
  privacyBox: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14,
    padding: 14, width: '100%', marginBottom: 20,
  },
  privacyText: { fontSize: 13, lineHeight: 19, marginBottom: 4 },
  privacySep: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 10 },
  toggleRow: { flexDirection: 'row', alignItems: 'center' },
  connectBtn: {
    backgroundColor: '#FFF', borderRadius: 50, paddingVertical: 17,
    width: '100%', alignItems: 'center',
  },
  connectBtnText: { color: '#000', fontSize: 17, fontWeight: '700' },
});

// ── Main Screen ────────────────────────────────────────────────────────────────
export default function ShazamConnectScreen() {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [connected, setConnected] = useState(false);
  const [connectModalVisible, setConnectModalVisible] = useState(false);
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [appVersion] = useState('2.0.0');

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    AsyncStorage.getItem('shazam_connected').then(val => {
      if (val === 'true') setConnected(true);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (connected) {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]));
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [connected]);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: "Check out Shazam in Dawinix! Identify any song playing around you.\nhttps://dawinix.app/apps/shazam",
        title: 'Shazam on Dawinix',
      });
    } catch (_e) {}
  }, []);

  const handleConnect = async () => {
    setConnectModalVisible(false);
    await AsyncStorage.setItem('shazam_connected', 'true');
    const raw = await AsyncStorage.getItem('connected_apps');
    const apps = raw ? JSON.parse(raw) : [];
    if (!apps.includes('shazam')) apps.push('shazam');
    await AsyncStorage.setItem('connected_apps', JSON.stringify(apps));
    setConnected(true);
  };

  const handleDisconnect = () => {
    AsyncStorage.multiRemove(['shazam_connected']).then(() => {
      AsyncStorage.getItem('connected_apps').then(raw => {
        if (raw) {
          const apps = JSON.parse(raw).filter((a: string) => a !== 'shazam');
          AsyncStorage.setItem('connected_apps', JSON.stringify(apps));
        }
      });
      setConnected(false);
    }).catch(() => {});
  };

  const handleOpenLink = async (url: string) => {
    try { await Linking.openURL(url); } catch (_e) {}
  };

  const bg = isDark ? '#000' : '#F2F2F7';
  const cardBg = isDark ? '#111113' : '#FFF';
  const textC = isDark ? '#FFF' : '#000';
  const subC = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';

  const description = `Identify any song playing around you, right within Dawinix. Use @Shazam in your prompt to discover music with the same powerful recognition technology trusted by hundreds of millions worldwide. Preview your music, see lyrics, and find out what song is playing in seconds.`;
  const shortDesc = description.slice(0, 130) + '...';

  const infoRows = [
    { label: 'Category', value: 'Entertainment', isLink: false },
    { label: 'Capabilities', value: 'Interactive', isLink: false },
    { label: 'Developer', value: 'Apple Inc.', isLink: false },
    { label: 'Website', value: '', isLink: true, onPress: () => handleOpenLink('https://www.shazam.com') },
    { label: 'Version', value: appVersion, isLink: false },
    { label: 'Privacy Policy', value: '', isLink: true, onPress: () => handleOpenLink('https://www.apple.com/legal/privacy/') },
    { label: 'Terms of Service', value: '', isLink: true, onPress: () => handleOpenLink('https://www.shazam.com/company/terms-of-service/') },
    { label: 'Customer support', value: '', isLink: true, onPress: () => handleOpenLink('https://support.shazam.com') },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: bg, paddingTop: insets.top }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={bg} />

      {/* Header */}
      <View style={spStyles.header}>
        <TouchableOpacity
          style={[spStyles.headerIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)' }]}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={20} color={textC} />
        </TouchableOpacity>
        <Text style={[spStyles.headerTitle, { color: textC }]}>Apps</Text>
        <TouchableOpacity
          style={[spStyles.headerIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)' }]}
          onPress={handleShare}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="share-outline" size={20} color={textC} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>

        {/* Hero */}
        <View style={spStyles.hero}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <ShazamLogo size={90} />
          </Animated.View>
          <Text style={[spStyles.heroTitle, { color: textC }]}>Shazam</Text>
          <Text style={[spStyles.heroSub, { color: subC }]}>Identify songs instantly</Text>

          {connected ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
              <View style={spStyles.connectedPill}>
                <Ionicons name="checkmark-circle" size={16} color={SHAZAM_BLUE} />
                <Text style={[spStyles.connectedText, { color: SHAZAM_BLUE }]}>Connected</Text>
              </View>
              <TouchableOpacity
                style={[spStyles.actionBtn, { backgroundColor: SHAZAM_BLUE }]}
                onPress={() => {
                  // Navigate to home and activate Shazam
                  router.replace('/home');
                }}
              >
                <Text style={[spStyles.actionBtnText, { color: '#FFF' }]}>Start chatting</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[spStyles.actionBtn, { borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'transparent' }]}
                onPress={handleDisconnect}
              >
                <Text style={[spStyles.actionBtnText, { color: textC }]}>Disconnect</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[spStyles.actionBtn, { backgroundColor: isDark ? '#FFF' : '#000', paddingHorizontal: 32 }]}
              onPress={() => setConnectModalVisible(true)}
            >
              <Text style={[spStyles.actionBtnText, { color: isDark ? '#000' : '#FFF' }]}>Connect</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Preview card — shows chat bubble demo */}
        <View style={[spStyles.previewCard, { backgroundColor: isDark ? '#111113' : '#EEF4FF', marginHorizontal: 16, marginBottom: 24 }]}>
          {/* Background gradient-like */}
          <View style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            borderRadius: 20,
            backgroundColor: isDark
              ? 'rgba(13,114,234,0.12)'
              : 'rgba(13,114,234,0.08)',
          }} />

          {/* Chat bubble */}
          <View style={spStyles.chatBubble}>
            <Text style={spStyles.chatBubbleText}>
              <Text style={{ color: SHAZAM_BLUE, fontWeight: '700' }}>@Shazam</Text>
              <Text style={{ color: isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.85)' }}> what{"'"}s this song?</Text>
            </Text>
          </View>

          {/* Music card */}
          <View style={[spStyles.musicCard, { backgroundColor: isDark ? '#1C1C1E' : '#FFF' }]}>
            <ExpoImage
              source={{ uri: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&q=80' }}
              style={spStyles.musicArt}
              contentFit="cover"
            />
            <View style={{ flex: 1, padding: 12 }}>
              <Text style={{ color: isDark ? '#FFF' : '#000', fontSize: 15, fontWeight: '700', marginBottom: 4 }}>
                {"That's So True"}
              </Text>
              <Text style={{ color: subC, fontSize: 13 }}>Gracie Abrams</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                <ShazamLogo size={14} />
                <Text style={{ color: subC, fontSize: 11 }}>5.4M</Text>
              </View>
            </View>
            <View style={[spStyles.playCircle, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }]}>
              <Ionicons name="play" size={14} color={isDark ? '#FFF' : '#000'} style={{ marginLeft: 2 }} />
            </View>
          </View>
        </View>

        {/* Description */}
        <View style={{ paddingHorizontal: 16, marginBottom: 28 }}>
          <Text style={{ color: isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.75)', fontSize: 15, lineHeight: 22 }}>
            {showFullDesc ? description : shortDesc}
          </Text>
          <TouchableOpacity onPress={() => setShowFullDesc(!showFullDesc)} style={{ marginTop: 4 }}>
            <Text style={{ color: textC, fontWeight: '600', fontSize: 14 }}>{showFullDesc ? 'Less' : 'More'}</Text>
          </TouchableOpacity>
        </View>

        {/* Information */}
        <Text style={[spStyles.sectionTitle, { color: textC }]}>Information</Text>
        <View style={[spStyles.infoCard, { backgroundColor: cardBg, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
          {infoRows.map((row, i, arr) => (
            <InfoRow
              key={row.label}
              label={row.label}
              value={row.value}
              isDark={isDark}
              last={i === arr.length - 1}
              isLink={row.isLink}
              onPress={row.onPress}
            />
          ))}
        </View>
      </ScrollView>

      <ShazamConnectModal
        visible={connectModalVisible}
        onClose={() => setConnectModalVisible(false)}
        onConnect={handleConnect}
        isDark={isDark}
      />
    </View>
  );
}

const spStyles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, marginBottom: 8,
  },
  headerIconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  hero: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 24, marginBottom: 20 },
  heroTitle: { fontSize: 28, fontWeight: '700', marginTop: 14, marginBottom: 6 },
  heroSub: { fontSize: 16, marginBottom: 20 },
  connectedPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(13,114,234,0.12)', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  connectedText: { fontSize: 14, fontWeight: '700' },
  actionBtn: {
    borderRadius: 50, paddingHorizontal: 28, paddingVertical: 11,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  actionBtnText: { fontSize: 16, fontWeight: '600' },
  previewCard: {
    borderRadius: 20, overflow: 'hidden', padding: 16,
    minHeight: 200, justifyContent: 'space-between',
  },
  chatBubble: {
    backgroundColor: 'rgba(13,114,234,0.15)', borderRadius: 18,
    paddingHorizontal: 14, paddingVertical: 10,
    alignSelf: 'flex-end', marginBottom: 14,
  },
  chatBubbleText: { fontSize: 14, lineHeight: 20 },
  musicCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 4,
  },
  musicArt: { width: 100, height: 100 },
  playCircle: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 22, fontWeight: '700',
    paddingHorizontal: 16, marginBottom: 12,
  },
  infoCard: { marginHorizontal: 16, borderRadius: 20, overflow: 'hidden' },
});
