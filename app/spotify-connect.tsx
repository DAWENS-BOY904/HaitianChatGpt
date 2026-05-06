import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Platform, Share, StatusBar, Modal, Linking, Switch,
  Alert, Dimensions, Animated, Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { WebView } from 'react-native-webview';
import { Image as ExpoImage } from 'expo-image';
import { useTheme } from '../hooks/useTheme';
import { getSupabaseClient } from '@/template';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_W } = Dimensions.get('window');

// ── Spotify branding ───────────────────────────────────────────────────────
const SPOTIFY_GREEN = '#1DB954';
const SPOTIFY_CLIENT_ID = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID || '';
const SPOTIFY_REDIRECT_URI = 'https://dawinix.app/spotify/callback';
const SPOTIFY_SCOPES = [
  'user-library-modify',
  'user-read-private',
  'user-read-email',
  'streaming',
].join('%20');

function buildSpotifyAuthUrl(): string {
  return (
    `https://accounts.spotify.com/authorize` +
    `?response_type=code` +
    `&client_id=${SPOTIFY_CLIENT_ID}` +
    `&scope=${SPOTIFY_SCOPES}` +
    `&redirect_uri=${encodeURIComponent(SPOTIFY_REDIRECT_URI)}` +
    `&show_dialog=true`
  );
}

// ── Spotify Logo component ─────────────────────────────────────────────────
function SpotifyLogo({ size = 80 }: { size?: number }) {
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: SPOTIFY_GREEN,
      alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Simplified Spotify bars */}
      <View style={{ alignItems: 'center', gap: 3 }}>
        {[1, 0.8, 0.6].map((w, i) => (
          <View key={i} style={{
            width: size * 0.52 * w,
            height: size * 0.065,
            borderRadius: 99,
            backgroundColor: '#000',
          }} />
        ))}
      </View>
    </View>
  );
}

// ── Dawinix logo for connect modal ────────────────────────────────────────
function DawinixLogo({ size = 52 }: { size?: number }) {
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: '#10A37F',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Ionicons name="sparkles" size={size * 0.5} color="#FFF" />
    </View>
  );
}

// ── Connect Permission Modal ───────────────────────────────────────────────
function SpotifyConnectModal({
  visible,
  onClose,
  onConnectWithAccount,
  onContinueWithout,
  isDark,
}: {
  visible: boolean;
  onClose: () => void;
  onConnectWithAccount: () => void;
  onContinueWithout: () => void;
  isDark: boolean;
}) {
  const [shareMemories, setShareMemories] = useState(false);
  const textC = isDark ? '#FFF' : '#FFF';
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
          {/* X close */}
          <TouchableOpacity style={cmStyles.closeBtn} onPress={onClose}>
            <View style={cmStyles.closeBtnInner}>
              <Ionicons name="close" size={15} color="#FFF" />
            </View>
          </TouchableOpacity>

          {/* Logo pair */}
          <View style={cmStyles.logoPair}>
            <DawinixLogo size={54} />
            <View style={cmStyles.logoDots}>
              {[0, 1, 2].map(i => (
                <View key={i} style={cmStyles.logoDot} />
              ))}
            </View>
            <SpotifyLogo size={54} />
          </View>

          <Text style={cmStyles.connectTitle}>Connect Spotify</Text>

          {/* Privacy box */}
          <View style={cmStyles.privacyBox}>
            <Text style={cmStyles.privacyText}>
              <Text style={{ fontWeight: '700', color: '#FFF' }}>{"You're in control "}</Text>
              <Text style={{ color: subC }}>
                Dawinix always respects your privacy preferences, and is limited to permissions
                you have explicitly set.
              </Text>
            </Text>
            <View style={cmStyles.privacySep} />
            <Text style={cmStyles.privacyText}>
              <Text style={{ fontWeight: '700', color: '#FFF' }}>Apps may introduce elevated risk </Text>
              <Text style={{ color: subC }}>
                Dawinix is built to protect your data, but apps may attempt to access
                your data through Dawinix.
              </Text>
            </Text>
            <View style={cmStyles.privacySep} />
            <Text style={cmStyles.privacyText}>
              <Text style={{ fontWeight: '700', color: '#FFF' }}>Data shared with this app </Text>
              <Text style={{ color: subC }}>
                By adding this app, you allow it to access your music preferences and
                recent context within Dawinix.
              </Text>
            </Text>
            <View style={cmStyles.privacySep} />
            <View style={cmStyles.toggleRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600', marginBottom: 3 }}>
                  Reference memories and chats
                </Text>
                <Text style={{ color: subC, fontSize: 12, lineHeight: 17 }}>
                  Allow Dawinix to reference relevant memories when sharing data with Spotify.
                </Text>
              </View>
              <Switch
                value={shareMemories}
                onValueChange={setShareMemories}
                trackColor={{ true: SPOTIFY_GREEN, false: 'rgba(255,255,255,0.2)' }}
                thumbColor="#FFF"
              />
            </View>
          </View>

          {/* Continue without account */}
          <TouchableOpacity style={cmStyles.continueWithout} onPress={onContinueWithout}>
            <Text style={cmStyles.continueWithoutText}>Continue without account</Text>
          </TouchableOpacity>

          {/* Connect Spotify */}
          <TouchableOpacity style={cmStyles.connectBtn} onPress={onConnectWithAccount}>
            <Text style={cmStyles.connectBtnText}>Connect Spotify</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const cmStyles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#1A1A1D',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40,
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute', top: 14, right: 16,
    zIndex: 10,
  },
  closeBtnInner: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  logoPair: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18,
  },
  logoDots: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  logoDot: {
    width: 5, height: 5, borderRadius: 2.5,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  connectTitle: {
    color: '#FFF', fontSize: 22, fontWeight: '700', marginBottom: 18,
  },
  privacyBox: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14, padding: 14, width: '100%', marginBottom: 16,
  },
  privacyText: { fontSize: 13, lineHeight: 19, marginBottom: 4 },
  privacySep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 10,
  },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center',
  },
  continueWithout: {
    paddingVertical: 14, width: '100%', alignItems: 'center', marginBottom: 4,
  },
  continueWithoutText: {
    color: '#FFF', fontSize: 16, fontWeight: '400',
  },
  connectBtn: {
    backgroundColor: '#FFF', borderRadius: 50,
    paddingVertical: 17, width: '100%', alignItems: 'center',
  },
  connectBtnText: {
    color: '#000', fontSize: 17, fontWeight: '700',
  },
});

// ── Spotify OAuth WebView Modal ─────────────────────────────────────────────
function SpotifyWebViewModal({
  visible,
  onClose,
  onSuccess,
  isDark,
}: {
  visible: boolean;
  onClose: () => void;
  onSuccess: (code: string) => void;
  isDark: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const authUrl = buildSpotifyAuthUrl();

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000', paddingTop: insets.top }}>
        {/* Header */}
        <View style={wvStyles.header}>
          <TouchableOpacity
            style={[wvStyles.closeBtn, { backgroundColor: 'rgba(255,255,255,0.1)' }]}
            onPress={onClose}
          >
            <Ionicons name="close" size={18} color="#FFF" />
          </TouchableOpacity>
          <View style={wvStyles.titleRow}>
            <SpotifyLogo size={22} />
            <Text style={wvStyles.title}>spotify.com</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        {/* Progress bar */}
        <View style={wvStyles.progressBg}>
          <View style={[wvStyles.progressFill, { backgroundColor: SPOTIFY_GREEN }]} />
        </View>

        {/* WebView */}
        <WebView
          source={{ uri: authUrl }}
          style={{ flex: 1 }}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onShouldStartLoadWithRequest={(request) => {
            // Intercept redirect
            if (request.url.startsWith(SPOTIFY_REDIRECT_URI) || request.url.includes('spotify/callback')) {
              const url = request.url;
              const codeMatch = url.match(/code=([^&]+)/);
              if (codeMatch && codeMatch[1]) {
                onSuccess(codeMatch[1]);
              } else {
                // User denied or error
                onClose();
              }
              return false;
            }
            return true;
          }}
          userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
        />
      </View>
    </Modal>
  );
}

const wvStyles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  progressBg: { height: 3, backgroundColor: 'rgba(255,255,255,0.1)' },
  progressFill: { height: 3, width: '60%' },
});

// ── Mock preview screenshots ────────────────────────────────────────────────
function PreviewCard({ title, subtitle, dark }: { title: string; subtitle: string; dark: boolean }) {
  const bg = dark ? '#111' : '#F5F5F7';
  return (
    <View style={[pvStyles.card, { backgroundColor: bg }]}>
      {/* Chat bubble */}
      <View style={pvStyles.bubbleWrap}>
        <View style={pvStyles.bubble}>
          <Text style={pvStyles.bubbleText}>{title}</Text>
        </View>
      </View>
      {/* Mock music cards */}
      {[1, 2].map(i => (
        <View key={i} style={[pvStyles.trackRow, { borderColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
          <View style={[pvStyles.albumArt, { backgroundColor: dark ? '#2C2C2E' : '#DDD' }]} />
          <View style={{ flex: 1 }}>
            <View style={{ height: 8, backgroundColor: dark ? '#3A3A3C' : '#CCC', borderRadius: 4, marginBottom: 5, width: '70%' }} />
            <View style={{ height: 6, backgroundColor: dark ? '#2C2C2E' : '#E0E0E0', borderRadius: 3, width: '50%' }} />
          </View>
          <View style={pvStyles.playBtn}>
            <Ionicons name="play" size={10} color={dark ? '#FFF' : '#000'} />
          </View>
        </View>
      ))}
    </View>
  );
}

const pvStyles = StyleSheet.create({
  card: {
    width: (SCREEN_W - 48) / 2,
    borderRadius: 18, padding: 14,
    minHeight: 200,
  },
  bubbleWrap: { marginBottom: 12 },
  bubble: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14, padding: 10,
  },
  bubbleText: { color: '#FFF', fontSize: 11, lineHeight: 15 },
  trackRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth,
  },
  albumArt: { width: 36, height: 36, borderRadius: 6 },
  playBtn: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: SPOTIFY_GREEN, alignItems: 'center', justifyContent: 'center',
  },
});

// ── Info table row ─────────────────────────────────────────────────────────
function InfoRow({ label, value, isDark, last }: { label: string; value: string; isDark: boolean; last?: boolean }) {
  return (
    <View style={[
      irStyles.row,
      !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)' },
    ]}>
      <Text style={[irStyles.label, { color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }]}>{label}</Text>
      <Text style={[irStyles.value, { color: isDark ? '#FFF' : '#000' }]}>{value}</Text>
    </View>
  );
}

const irStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16 },
  label: { fontSize: 15 },
  value: { fontSize: 15, fontWeight: '500', maxWidth: '55%', textAlign: 'right' },
});

// ── Main Spotify Connect Screen ────────────────────────────────────────────
export default function SpotifyConnectScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const supabase = getSupabaseClient();

  const [connectModalVisible, setConnectModalVisible] = useState(false);
  const [webViewVisible, setWebViewVisible] = useState(false);
  const [connected, setConnected] = useState(false);
  const [hasAccount, setHasAccount] = useState(false);
  const [showFullDesc, setShowFullDesc] = useState(false);

  useEffect(() => {
    AsyncStorage.multiGet(['spotify_connected', 'spotify_has_account']).then(results => {
      const connectedVal = results[0][1];
      const accountVal = results[1][1];
      if (connectedVal === 'true') setConnected(true);
      if (accountVal === 'true') setHasAccount(true);
    });
  }, []);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: 'Check out Spotify in Dawinix! Search and play music with AI.\nhttps://dawinix.app/apps/spotify',
        title: 'Spotify on Dawinix',
      });
    } catch (_e) {}
  }, []);

  const handleConnectPress = () => {
    setConnectModalVisible(true);
  };

  const handleConnectWithAccount = () => {
    setConnectModalVisible(false);
    // iOS-style alert
    Alert.alert(
      '"Dawinix" Wants to Use "accounts.spotify.com" to Sign In',
      'This allows the app and website to share information about you.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: () => {
            setTimeout(() => setWebViewVisible(true), 200);
          },
        },
      ]
    );
  };

  const handleContinueWithoutAccount = async () => {
    setConnectModalVisible(false);
    await AsyncStorage.setItem('spotify_connected', 'true');
    await AsyncStorage.setItem('spotify_has_account', 'false');
    setConnected(true);
    setHasAccount(false);
    // Mark in connected apps
    const raw = await AsyncStorage.getItem('connected_apps');
    const apps = raw ? JSON.parse(raw) : [];
    if (!apps.includes('spotify')) apps.push('spotify');
    await AsyncStorage.setItem('connected_apps', JSON.stringify(apps));
    // Navigate to home so they can see the chips
    setTimeout(() => router.back(), 300);
  };

  const handleOAuthSuccess = async (code: string) => {
    setWebViewVisible(false);
    // Exchange code for tokens via edge function
    try {
      const { data, error } = await supabase.functions.invoke('spotify-connect', {
        body: { action: 'exchange_code', code, redirectUri: SPOTIFY_REDIRECT_URI },
      });
      if (!error && data?.access_token) {
        await AsyncStorage.setItem('spotify_access_token', data.access_token);
        if (data.refresh_token) await AsyncStorage.setItem('spotify_refresh_token', data.refresh_token);
      }
    } catch (_e) {}

    await AsyncStorage.setItem('spotify_connected', 'true');
    await AsyncStorage.setItem('spotify_has_account', 'true');
    const raw = await AsyncStorage.getItem('connected_apps');
    const apps = raw ? JSON.parse(raw) : [];
    if (!apps.includes('spotify')) apps.push('spotify');
    await AsyncStorage.setItem('connected_apps', JSON.stringify(apps));
    setConnected(true);
    setHasAccount(true);
    setTimeout(() => router.back(), 300);
  };

  const handleDisconnect = async () => {
    Alert.alert('Disconnect Spotify', 'Remove Spotify from Dawinix?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect', style: 'destructive',
        onPress: async () => {
          await AsyncStorage.multiRemove(['spotify_connected', 'spotify_has_account', 'spotify_access_token', 'spotify_refresh_token']);
          const raw = await AsyncStorage.getItem('connected_apps');
          if (raw) {
            const apps = JSON.parse(raw).filter((a: string) => a !== 'spotify');
            await AsyncStorage.setItem('connected_apps', JSON.stringify(apps));
          }
          setConnected(false); setHasAccount(false);
        },
      },
    ]);
  };

  const bg = isDark ? '#000' : '#F2F2F7';
  const cardBg = isDark ? '#111113' : '#FFF';
  const textC = isDark ? '#FFF' : '#000';
  const subC = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';

  const description = `Explore a new way to discover music and podcasts, with recommendations picked just for you. Want music to power your next run, study session, or party? Just ask and Spotify will drop the right songs.`;
  const shortDesc = description.slice(0, 120) + '...';

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

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      >
        {/* Hero */}
        <View style={spStyles.hero}>
          <SpotifyLogo size={90} />
          <Text style={[spStyles.heroTitle, { color: textC }]}>Spotify</Text>
          <Text style={[spStyles.heroSub, { color: subC }]}>Music and podcasts for you</Text>

          {connected ? (
            <View style={spStyles.connectedRow}>
              <View style={spStyles.connectedPill}>
                <Ionicons name="checkmark-circle" size={16} color={SPOTIFY_GREEN} />
                <Text style={[spStyles.connectedText, { color: SPOTIFY_GREEN }]}>Connected</Text>
              </View>
              <TouchableOpacity
                style={[spStyles.connectBtn, { borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'transparent' }]}
                onPress={handleDisconnect}
              >
                <Text style={[spStyles.connectBtnText, { color: textC }]}>Disconnect</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={spStyles.connectBtn} onPress={handleConnectPress}>
              <Text style={[spStyles.connectBtnText, { color: textC }]}>Connect</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Preview screenshots */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: 4 }}
          style={{ marginBottom: 24 }}
        >
          <PreviewCard
            title="Recommend songs for my workout"
            subtitle="Running playlist"
            dark={true}
          />
          <PreviewCard
            title="Find me chill music for studying"
            subtitle="Focus playlist"
            dark={isDark}
          />
        </ScrollView>

        {/* Description */}
        <View style={{ paddingHorizontal: 16, marginBottom: 28 }}>
          <Text style={{ color: textC, fontSize: 15, lineHeight: 22 }}>
            {showFullDesc ? description : shortDesc}
          </Text>
          <TouchableOpacity onPress={() => setShowFullDesc(!showFullDesc)} style={{ marginTop: 4 }}>
            <Text style={{ color: textC, fontWeight: '600', fontSize: 14 }}>
              {showFullDesc ? 'Less' : 'More'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Information table */}
        <Text style={[spStyles.sectionTitle, { color: textC }]}>Information</Text>
        <View style={[spStyles.infoCard, { backgroundColor: cardBg }]}>
          {[
            { label: 'Category', value: 'Entertainment' },
            { label: 'Capabilities', value: 'Interactive, Writes' },
            { label: 'Developer', value: 'Spotify' },
            { label: 'Version', value: '3.0.0' },
            { label: 'Privacy Policy', value: '↗' },
            { label: 'Terms of Service', value: '↗' },
            { label: 'Customer support', value: '↗' },
          ].map((row, i, arr) => (
            <InfoRow key={row.label} label={row.label} value={row.value} isDark={isDark} last={i === arr.length - 1} />
          ))}
        </View>
      </ScrollView>

      {/* Connect modal */}
      <SpotifyConnectModal
        visible={connectModalVisible}
        onClose={() => setConnectModalVisible(false)}
        onConnectWithAccount={handleConnectWithAccount}
        onContinueWithout={handleContinueWithoutAccount}
        isDark={isDark}
      />

      {/* Spotify OAuth WebView */}
      <SpotifyWebViewModal
        visible={webViewVisible}
        onClose={() => setWebViewVisible(false)}
        onSuccess={handleOAuthSuccess}
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
  headerIconBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  hero: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 24, marginBottom: 20 },
  heroTitle: { fontSize: 28, fontWeight: '700', marginTop: 14, marginBottom: 6 },
  heroSub: { fontSize: 16, marginBottom: 20 },
  connectedRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  connectedPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(29,185,84,0.12)',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8,
  },
  connectedText: { fontSize: 14, fontWeight: '700' },
  connectBtn: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 50, paddingHorizontal: 28, paddingVertical: 11,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  connectBtnText: { fontSize: 16, fontWeight: '600' },
  sectionTitle: {
    fontSize: 22, fontWeight: '700',
    paddingHorizontal: 16, marginBottom: 12,
  },
  infoCard: {
    marginHorizontal: 16, borderRadius: 18, overflow: 'hidden',
  },
});
