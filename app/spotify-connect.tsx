import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Platform, Share, StatusBar, Modal, Linking, Switch,
  Alert, Dimensions, Animated, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { WebView } from 'react-native-webview';
import { Image as ExpoImage } from 'expo-image';
import { Audio } from 'expo-av';
import { useTheme } from '../hooks/useTheme';
import { getSupabaseClient } from '@/template';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from '../utils/web-browser';

const { width: SCREEN_W } = Dimensions.get('window');

const SPOTIFY_GREEN = '#1DB954';
const SPOTIFY_CLIENT_ID = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID ?? '';
const SPOTIFY_REDIRECT_URI = 'https://njpuoozygqtpvlzhnjpu.backend.onspace.ai/spotify/callback';
const SPOTIFY_SCOPES = [
  'user-library-modify',
  'user-read-private',
  'user-read-email',
  'streaming',
].join('%20');

function buildSpotifyAuthUrl(): string {
  if (!SPOTIFY_CLIENT_ID) return 'about:blank';
  return (
    `https://accounts.spotify.com/authorize` +
    `?response_type=code` +
    `&client_id=${encodeURIComponent(SPOTIFY_CLIENT_ID)}` +
    `&scope=${SPOTIFY_SCOPES}` +
    `&redirect_uri=${encodeURIComponent(SPOTIFY_REDIRECT_URI)}` +
    `&show_dialog=true`
  );
}

const TOKEN_EXPIRY_KEY = 'spotify_token_expiry';

async function getValidAccessToken(supabase: any): Promise<string | null> {
  try {
    const [tokenResult, refreshResult, expiryResult] = await AsyncStorage.multiGet([
      'spotify_access_token', 'spotify_refresh_token', TOKEN_EXPIRY_KEY,
    ]);
    const token = tokenResult[1];
    const refresh = refreshResult[1];
    const expiry = expiryResult[1] ? parseInt(expiryResult[1], 10) : 0;
    if (!token) return null;
    if (Date.now() < expiry - 120_000) return token;
    if (!refresh) return null;
    const { data, error } = await supabase.functions.invoke('spotify-connect', {
      body: { action: 'refresh_token', refreshToken: refresh },
    });
    if (error || !data?.access_token) return null;
    const newExpiry = Date.now() + (data.expires_in || 3600) * 1000;
    await AsyncStorage.multiSet([
      ['spotify_access_token', data.access_token],
      [TOKEN_EXPIRY_KEY, String(newExpiry)],
      ...(data.refresh_token ? [['spotify_refresh_token', data.refresh_token] as [string, string]] : []),
    ]);
    return data.access_token;
  } catch { return null; }
}

// ── Spotify Logo ────────────────────────────────────────────────────────────
function SpotifyLogo({ size = 80 }: { size?: number }) {
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: SPOTIFY_GREEN, alignItems: 'center', justifyContent: 'center',
    }}>
      <View style={{ alignItems: 'center', gap: 3 }}>
        {[1, 0.8, 0.6].map((w, i) => (
          <View key={i} style={{
            width: size * 0.52 * w, height: size * 0.065,
            borderRadius: 99, backgroundColor: '#000',
          }} />
        ))}
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

// ── Playback bars animation ─────────────────────────────────────────────────
function PlaybackBars({ playing }: { playing: boolean }) {
  const bars = [useRef(new Animated.Value(0.4)).current, useRef(new Animated.Value(0.7)).current, useRef(new Animated.Value(0.5)).current];
  useEffect(() => {
    if (playing) {
      const anims = bars.map((b, i) =>
        Animated.loop(Animated.sequence([
          Animated.delay(i * 120),
          Animated.timing(b, { toValue: 1, duration: 300 + i * 80, useNativeDriver: true }),
          Animated.timing(b, { toValue: 0.3, duration: 300 + i * 80, useNativeDriver: true }),
        ]))
      );
      anims.forEach(a => a.start());
      return () => anims.forEach(a => a.stop());
    } else { bars.forEach(b => b.setValue(0.4)); }
  }, [playing]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 14 }}>
      {bars.map((b, i) => (
        <Animated.View key={i} style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: SPOTIFY_GREEN, transform: [{ scaleY: b }] }} />
      ))}
    </View>
  );
}

// ── Fallback tracks shown when Spotify API returns nothing ──────────────────
const FALLBACK_TRACKS_WORKOUT = [
  {
    id: 'fallback_workout_1',
    name: 'All Night',
    owner: 'Beyonce',
    type: 'Song',
    imageUrl: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=200&q=80',
    previewUrl: 'https://videotourl.com/audio/1778875621467-fb69ff20-a294-4c84-948b-a29928d5a89b.mp3',
    spotifyUrl: 'https://rythm.fm/t/154008311430123520',
    uri: 'spotify:track:2HHtWyy5CgaQbC7XSoOb0e',
  },
  {
    id: 'fallback_workout_2',
    name: "Car's Outside",
    owner: 'James Arthur',
    type: 'Song',
    imageUrl: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=200&q=80',
    previewUrl: 'https://videotourl.com/audio/1778907472479-9a845047-ffe4-4b78-a905-38208d109c4d.mp3',
    spotifyUrl: 'https://open.spotify.com/track/0otRX6Z89qKkHkQ9OqJpKt?si=810f45ee20934a4c',
    uri: 'spotify:track:5Z01UMMf7V1o0MzF86s6WJ',
  },
];

const FALLBACK_TRACKS_CHILL = [
  {
    id: 'fallback_chill_1',
    name: 'WELL DONE',
    owner: 'feat. Eyo-E & Elge',
    type: 'Song',
    imageUrl: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=200&q=80',
    previewUrl: 'https://videotourl.com/audio/1778907642372-e0cc7c7a-38d2-42fb-a517-07d52dc6c186.mp3',
    spotifyUrl: 'https://open.spotify.com/track/7M9HGmhjYnzUFLMo8nYBtN',
    uri: 'spotify:track:7M9HGmhjYnzUFLMo8nYBtN',
  },
  {
    id: 'fallback_chill_2',
    name: 'NLE Choppa - Shotta Flow',
    owner: 'Blueface',
    type: 'Playlist',
    imageUrl: 'https://images.unsplash.com/photo-1483062288757-dde0b97b12b2?w=200&q=80',
    previewUrl: 'https://videotourl.com/audio/1778907867418-92ea8aa0-0938-4a16-b691-37a7ed3aa03e.mp3',
    spotifyUrl: 'https://open.spotify.com/playlist/0vvXsWCC9xrXsKd4euo806',
    uri: 'spotify:playlist:0vvXsWCC9xrXsKd4euo806',
  },
];

// ── Real Preview Card with Spotify data ─────────────────────────────────────
function RealPreviewCard({
  title,
  query,
  isDark,
  supabase,
  fallbackTracks,
}: {
  title: string;
  query: string;
  isDark: boolean;
  supabase: any;
  fallbackTracks: any[];
}) {
  const [tracks, setTracks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playbackSeconds, setPlaybackSeconds] = useState<Record<string, number>>({});
  const soundRef = useRef<Audio.Sound | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bg = isDark ? '#1A1A1D' : '#F5F5F7';
  const textC = isDark ? '#FFF' : '#000';
  const subC = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)';
  const borderC = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.07)';

  useEffect(() => {
    loadTracks();
    return () => {
      stopAndUnloadSound();
    };
  }, []);

  const stopAndUnloadSound = async () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (soundRef.current) {
      try { await soundRef.current.stopAsync(); } catch {}
      try { await soundRef.current.unloadAsync(); } catch {}
      soundRef.current = null;
    }
  };

  const loadTracks = async () => {
    setLoading(true);
    try {
      const cacheKey = `spotify_preview_${query.replace(/\s/g, '_')}`;
      const cachedRaw = await AsyncStorage.getItem(cacheKey);
      if (cachedRaw) {
        const { data, ts } = JSON.parse(cachedRaw);
        const age = Date.now() - ts;
        if (age < 30 * 60 * 1000 && Math.random() < 0.6 && Array.isArray(data) && data.length > 0) {
          setTracks(data.slice(0, 2));
          setLoading(false);
          return;
        }
      }
      const { data, error } = await supabase.functions.invoke('spotify-connect', {
        body: { action: 'search', query },
      });
      if (!error && data?.results && Array.isArray(data.results) && data.results.length > 0) {
        const results = data.results.slice(0, 2);
        setTracks(results);
        await AsyncStorage.setItem(cacheKey, JSON.stringify({ data: results, ts: Date.now() }));
      } else {
        // API failed or empty — use fallback tracks
        setTracks(fallbackTracks);
      }
    } catch {
      setTracks(fallbackTracks);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const handlePlay = async (track: any) => {
    // If this track is already playing — STOP it
    if (playingId === track.id) {
      await stopAndUnloadSound();
      setPlayingId(null);
      return;
    }

    // Stop any currently playing track first
    await stopAndUnloadSound();
    setPlayingId(null);

    if (track.previewUrl) {
      // Play audio INSIDE the app — never open outside
      try {
        setPlayingId(track.id);
        setPlaybackSeconds(prev => ({ ...prev, [track.id]: 0 }));
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          allowsRecordingIOS: false,
        });
        const { sound } = await Audio.Sound.createAsync(
          { uri: track.previewUrl },
          { shouldPlay: true, progressUpdateIntervalMillis: 1000 }
        );
        soundRef.current = sound;
        timerRef.current = setInterval(() => {
          setPlaybackSeconds(prev => ({ ...prev, [track.id]: (prev[track.id] || 0) + 1 }));
        }, 1000);
        sound.setOnPlaybackStatusUpdate((status: any) => {
          if (status.isLoaded && status.didJustFinish) {
            setPlayingId(null);
            if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
          }
          // Handle errors
          if (!status.isLoaded && status.error) {
            setPlayingId(null);
            if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
          }
        });
      } catch {
        setPlayingId(null);
        await stopAndUnloadSound();
      }
    } else {
      // No preview URL — open in Spotify app (full play, external)
      try {
        const deepLink = track.type === 'Playlist'
          ? `spotify:playlist:${track.id}`
          : `spotify:track:${track.id}`;
        const canOpen = await Linking.canOpenURL(deepLink);
        if (canOpen) { await Linking.openURL(deepLink); }
        else if (track.spotifyUrl) { await Linking.openURL(track.spotifyUrl); }
      } catch {}
    }
  };

  return (
    <View style={[pvStyles.card, { backgroundColor: bg, width: (SCREEN_W - 48) / 2 }]}>
      {/* Query bubble */}
      <View style={pvStyles.bubbleWrap}>
        <View style={[pvStyles.bubble, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }]}>
          <Text style={[pvStyles.bubbleText, { color: textC }]}>{title}</Text>
        </View>
      </View>

      {loading ? (
        <View style={{ paddingVertical: 20, alignItems: 'center' }}>
          <ActivityIndicator size="small" color={SPOTIFY_GREEN} />
        </View>
      ) : (
        tracks.map((track, i) => {
          const isPlaying = playingId === track.id;
          const secs = playbackSeconds[track.id] || 0;
          return (
            <View key={track.id + i} style={[pvStyles.trackRow, {
              borderTopColor: borderC,
              borderTopWidth: i > 0 ? StyleSheet.hairlineWidth : 0,
            }]}>
              {track.imageUrl ? (
                <ExpoImage source={{ uri: track.imageUrl }} style={pvStyles.albumArt} contentFit="cover" transition={200} />
              ) : (
                <View style={[pvStyles.albumArt, { backgroundColor: isDark ? '#2C2C2E' : '#DDD', alignItems: 'center', justifyContent: 'center' }]}>
                  <Ionicons name="musical-notes" size={14} color={SPOTIFY_GREEN} />
                </View>
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: textC, fontSize: 11, fontWeight: '600', lineHeight: 14 }} numberOfLines={2}>
                  {track.name}
                </Text>
                <Text style={{ color: subC, fontSize: 10, marginTop: 2 }} numberOfLines={1}>
                  {track.owner}
                </Text>
                {isPlaying ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <PlaybackBars playing={true} />
                    <Text style={{ color: SPOTIFY_GREEN, fontSize: 10 }}>{formatTime(secs)}</Text>
                  </View>
                ) : null}
              </View>
              <TouchableOpacity
                style={pvStyles.playBtn}
                onPress={() => handlePlay(track)}
                activeOpacity={0.8}
              >
                {isPlaying ? (
                  <Ionicons name="pause" size={12} color="#000" />
                ) : (
                  <Ionicons name="play" size={12} color="#000" style={{ marginLeft: 1 }} />
                )}
              </TouchableOpacity>
            </View>
          );
        })
      )}
    </View>
  );
}

const pvStyles = StyleSheet.create({
  card: { borderRadius: 18, padding: 14, minHeight: 180, overflow: 'hidden' },
  bubbleWrap: { marginBottom: 10 },
  bubble: { borderRadius: 14, padding: 10 },
  bubbleText: { fontSize: 11, lineHeight: 15, fontWeight: '500' },
  trackRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  albumArt: { width: 40, height: 40, borderRadius: 6, flexShrink: 0 },
  playBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: SPOTIFY_GREEN, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
});

// ── Connect Permission Modal ────────────────────────────────────────────────
function SpotifyConnectModal({
  visible, onClose, onConnectWithAccount, onContinueWithout, isDark,
}: {
  visible: boolean; onClose: () => void; onConnectWithAccount: () => void;
  onContinueWithout: () => void; isDark: boolean;
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
            <View style={cmStyles.closeBtnInner}><Ionicons name="close" size={15} color="#FFF" /></View>
          </TouchableOpacity>
          <View style={cmStyles.logoPair}>
            <DawinixLogo size={54} />
            <View style={cmStyles.logoDots}>
              {[0, 1, 2].map(i => <View key={i} style={cmStyles.logoDot} />)}
            </View>
            <SpotifyLogo size={54} />
          </View>
          <Text style={cmStyles.connectTitle}>Connect Spotify</Text>
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
              <Text style={{ color: subC }}>By adding this app, you allow it to access your music preferences and recent context within Dawinix.</Text>
            </Text>
            <View style={cmStyles.privacySep} />
            <View style={cmStyles.toggleRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600', marginBottom: 3 }}>Reference memories and chats</Text>
                <Text style={{ color: subC, fontSize: 12, lineHeight: 17 }}>Allow Dawinix to reference relevant memories when sharing data with Spotify.</Text>
              </View>
              <Switch value={shareMemories} onValueChange={setShareMemories} trackColor={{ true: SPOTIFY_GREEN, false: 'rgba(255,255,255,0.2)' }} thumbColor="#FFF" />
            </View>
          </View>
          <TouchableOpacity style={cmStyles.continueWithout} onPress={onContinueWithout}>
            <Text style={cmStyles.continueWithoutText}>Continue without account</Text>
          </TouchableOpacity>
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
  sheet: { backgroundColor: '#1A1A1D', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40, alignItems: 'center' },
  closeBtn: { position: 'absolute', top: 14, right: 16, zIndex: 10 },
  closeBtnInner: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  logoPair: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  logoDots: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  logoDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: 'rgba(255,255,255,0.4)' },
  connectTitle: { color: '#FFF', fontSize: 22, fontWeight: '700', marginBottom: 18 },
  privacyBox: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 14, width: '100%', marginBottom: 16 },
  privacyText: { fontSize: 13, lineHeight: 19, marginBottom: 4 },
  privacySep: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 10 },
  toggleRow: { flexDirection: 'row', alignItems: 'center' },
  continueWithout: { paddingVertical: 14, width: '100%', alignItems: 'center', marginBottom: 4 },
  continueWithoutText: { color: '#FFF', fontSize: 16, fontWeight: '400' },
  connectBtn: { backgroundColor: '#FFF', borderRadius: 50, paddingVertical: 17, width: '100%', alignItems: 'center' },
  connectBtnText: { color: '#000', fontSize: 17, fontWeight: '700' },
});

// ── Spotify OAuth WebView Modal ─────────────────────────────────────────────
function SpotifyWebViewModal({ visible, onClose, onSuccess, isDark }: {
  visible: boolean; onClose: () => void; onSuccess: (code: string) => void; isDark: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const authUrl = buildSpotifyAuthUrl();
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000', paddingTop: insets.top }}>
        <View style={wvStyles.header}>
          <TouchableOpacity style={[wvStyles.closeBtn, { backgroundColor: 'rgba(255,255,255,0.1)' }]} onPress={onClose}>
            <Ionicons name="close" size={18} color="#FFF" />
          </TouchableOpacity>
          <View style={wvStyles.titleRow}>
            <SpotifyLogo size={22} />
            <Text style={wvStyles.title}>spotify.com</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>
        <View style={wvStyles.progressBg}>
          <View style={[wvStyles.progressFill, { backgroundColor: SPOTIFY_GREEN }]} />
        </View>
        <WebView
          source={{ uri: authUrl }}
          style={{ flex: 1 }}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onShouldStartLoadWithRequest={(request) => {
            if (request.url.startsWith(SPOTIFY_REDIRECT_URI) || request.url.includes('spotify/callback')) {
              const url = request.url;
              const codeMatch = url.match(/code=([^&]+)/);
              if (codeMatch && codeMatch[1]) { onSuccess(codeMatch[1]); } else { onClose(); }
              return false;
            }
            return true;
          }}
          userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
          javaScriptEnabled domStorageEnabled startInLoadingState
        />
      </View>
    </Modal>
  );
}

const wvStyles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  progressBg: { height: 3, backgroundColor: 'rgba(255,255,255,0.1)' },
  progressFill: { height: 3, width: '60%' },
});

// ── Info table row ─────────────────────────────────────────────────────────
function InfoRow({ label, value, isDark, last, isLink, onPress, isLoading }: {
  label: string; value: string; isDark: boolean; last?: boolean;
  isLink?: boolean; onPress?: () => void; isLoading?: boolean;
}) {
  const blurColor = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)';
  const textColor = isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.75)';
  return (
    <TouchableOpacity
      style={[irStyles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }]}
      onPress={onPress} disabled={!isLink && !onPress} activeOpacity={isLink || onPress ? 0.5 : 1}
    >
      <Text style={[irStyles.label, { color: isLink ? blurColor : textColor }]}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {isLoading ? (
          <ActivityIndicator size="small" color={isDark ? '#FFF' : '#000'} />
        ) : !isLink ? (
          <Text style={[irStyles.value, { color: textColor }]}>{value}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const irStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 18 },
  label: { fontSize: 15, fontWeight: '400' },
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
  const [appVersion] = useState('3.0.0');

  useEffect(() => {
    AsyncStorage.multiGet(['spotify_connected', 'spotify_has_account']).then(results => {
      if (results[0][1] === 'true') setConnected(true);
      if (results[1][1] === 'true') setHasAccount(true);
    });
  }, []);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({ message: 'Check out Spotify in Dawinix! Search and play music with AI.\nhttps://dawinix.app/apps/spotify', title: 'Spotify on Dawinix' });
    } catch {}
  }, []);

  const handleConnectPress = () => setConnectModalVisible(true);

  const handleConnectWithAccount = () => {
    setConnectModalVisible(false);
    if (!SPOTIFY_CLIENT_ID) {
      Alert.alert('Configuration Required', 'Spotify Client ID is not configured. Please set EXPO_PUBLIC_SPOTIFY_CLIENT_ID in your .env file.', [{ text: 'OK', style: 'cancel' }]);
      return;
    }
    Alert.alert(
      '"Dawinix" Wants to Use "accounts.spotify.com" to Sign In',
      'This allows the app and website to share information about you.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', onPress: () => setTimeout(() => setWebViewVisible(true), 200) },
      ]
    );
  };

  const handleContinueWithoutAccount = async () => {
    setConnectModalVisible(false);
    await AsyncStorage.setItem('spotify_connected', 'true');
    await AsyncStorage.setItem('spotify_has_account', 'false');
    setConnected(true);
    setHasAccount(false);
    const raw = await AsyncStorage.getItem('connected_apps');
    const apps = raw ? JSON.parse(raw) : [];
    if (!apps.includes('spotify')) apps.push('spotify');
    await AsyncStorage.setItem('connected_apps', JSON.stringify(apps));
    setTimeout(() => router.replace('/home'), 300);
  };

  const handleOAuthSuccess = async (code: string) => {
    setWebViewVisible(false);
    try {
      const { data, error } = await supabase.functions.invoke('spotify-connect', {
        body: { action: 'exchange_code', code, redirectUri: SPOTIFY_REDIRECT_URI },
      });
      if (!error && data?.access_token) {
        const expiry = Date.now() + (data.expires_in || 3600) * 1000;
        await AsyncStorage.multiSet([
          ['spotify_access_token', data.access_token],
          [TOKEN_EXPIRY_KEY, String(expiry)],
          ...(data.refresh_token ? [['spotify_refresh_token', data.refresh_token] as [string, string]] : []),
        ]);
      }
    } catch {}
    await AsyncStorage.setItem('spotify_connected', 'true');
    await AsyncStorage.setItem('spotify_has_account', 'true');
    const raw = await AsyncStorage.getItem('connected_apps');
    const apps = raw ? JSON.parse(raw) : [];
    if (!apps.includes('spotify')) apps.push('spotify');
    await AsyncStorage.setItem('connected_apps', JSON.stringify(apps));
    setConnected(true);
    setHasAccount(true);
    setTimeout(() => router.replace('/home'), 300);
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
          setConnected(false);
          setHasAccount(false);
        },
      },
    ]);
  };

  const handleOpenInAppBrowser = async (url: string) => {
    try {
      await WebBrowser.openBrowserAsync(url, { toolbarColor: isDark ? '#000000' : '#FFFFFF', controlsColor: SPOTIFY_GREEN, showTitle: true });
    } catch { Linking.openURL(url); }
  };

  const bg = isDark ? '#000' : '#F2F2F7';
  const cardBg = isDark ? '#111113' : '#FFF';
  const textC = isDark ? '#FFF' : '#000';
  const subC = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';

  const description = `Explore a new way to discover music and podcasts, with recommendations picked just for you. Want music to power your next run, study session, or party? Just ask and Spotify will drop the right songs.`;
  const shortDesc = description.slice(0, 120) + '...';

  const infoRows = [
    { label: 'Category', value: 'Entertainment', isLink: false },
    { label: 'Capabilities', value: 'Interactive', isLink: false },
    { label: 'Developer', value: 'Spotify AB', isLink: false },
    { label: 'Version', value: appVersion, isLink: false },
    { label: 'Privacy Policy', value: '', isLink: true, onPress: () => handleOpenInAppBrowser('https://www.spotify.com/legal/privacy-policy/') },
    { label: 'Terms of Service', value: '', isLink: true, onPress: () => handleOpenInAppBrowser('https://www.spotify.com/legal/end-user-agreement/') },
    { label: 'Support', value: '', isLink: true, onPress: () => handleOpenInAppBrowser('https://support.spotify.com/') },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: bg, paddingTop: insets.top }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={bg} />

      {/* Header */}
      <View style={spStyles.header}>
        <TouchableOpacity
          style={[spStyles.headerIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)' }]}
          onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={20} color={textC} />
        </TouchableOpacity>
        <Text style={[spStyles.headerTitle, { color: textC }]}>Apps</Text>
        <TouchableOpacity
          style={[spStyles.headerIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)' }]}
          onPress={handleShare} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="share-outline" size={20} color={textC} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
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
              <TouchableOpacity style={[spStyles.connectBtn, { borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'transparent' }]} onPress={handleDisconnect}>
                <Text style={[spStyles.connectBtnText, { color: textC }]}>Disconnect</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={spStyles.connectBtn} onPress={handleConnectPress}>
              <Text style={[spStyles.connectBtnText, { color: textC }]}>Connect</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Real Preview Cards — fetch actual Spotify songs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: 4 }}
          style={{ marginBottom: 24 }}
        >
          <RealPreviewCard
            title="Recommend songs for my workout"
            query="best workout songs gym energy"
            isDark={isDark}
            supabase={supabase}
            fallbackTracks={FALLBACK_TRACKS_WORKOUT}
          />
          <RealPreviewCard
            title="Find me chill music for studying"
            query="chill music for studying focus"
            isDark={isDark}
            supabase={supabase}
            fallbackTracks={FALLBACK_TRACKS_CHILL}
          />
        </ScrollView>

        {/* Description */}
        <View style={{ paddingHorizontal: 16, marginBottom: 28 }}>
          <Text style={{ color: textC, fontSize: 15, lineHeight: 22 }}>
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
              key={row.label} label={row.label} value={row.value} isDark={isDark}
              last={i === arr.length - 1} isLink={row.isLink} onPress={row.onPress}
            />
          ))}
        </View>
      </ScrollView>

      <SpotifyConnectModal
        visible={connectModalVisible}
        onClose={() => setConnectModalVisible(false)}
        onConnectWithAccount={handleConnectWithAccount}
        onContinueWithout={handleContinueWithoutAccount}
        isDark={isDark}
      />
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, marginBottom: 8 },
  headerIconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  hero: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 24, marginBottom: 20 },
  heroTitle: { fontSize: 28, fontWeight: '700', marginTop: 14, marginBottom: 6 },
  heroSub: { fontSize: 16, marginBottom: 20 },
  connectedRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  connectedPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(29,185,84,0.12)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  connectedText: { fontSize: 14, fontWeight: '700' },
  connectBtn: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 50, paddingHorizontal: 28, paddingVertical: 11, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  connectBtnText: { fontSize: 16, fontWeight: '600' },
  sectionTitle: { fontSize: 22, fontWeight: '700', paddingHorizontal: 16, marginBottom: 12 },
  infoCard: { marginHorizontal: 16, borderRadius: 20, overflow: 'hidden' },
});
