import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Linking,
  ActivityIndicator, Animated, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseClient } from '@/template';

const SPOTIFY_GREEN = '#1DB954';

export interface SpotifyTrack {
  id: string;
  name: string;
  owner: string;
  type: string; // 'Song' | 'Playlist'
  imageUrl: string | null;
  previewUrl: string | null;
  spotifyUrl: string;
  uri: string;
}

function SpotifyLogo({ size = 20 }: { size?: number }) {
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: SPOTIFY_GREEN, alignItems: 'center', justifyContent: 'center',
    }}>
      <View style={{ gap: size * 0.07, alignItems: 'center' }}>
        {[1, 0.78, 0.56].map((w, i) => (
          <View key={i} style={{
            width: size * 0.52 * w, height: Math.max(1.5, size * 0.08),
            borderRadius: 2, backgroundColor: '#000',
          }} />
        ))}
      </View>
    </View>
  );
}

// ── Spotify loading overlay ───────────────────────────────────────────────── 
export function SpotifyLoadingOverlay({ visible, query }: { visible: boolean; query?: string }) {
  const pulseAnim = useRef(new Animated.Value(0.7)).current;
  const scaleAnim = useRef(new Animated.Value(0.88)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacityAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 180, friction: 16, useNativeDriver: true }),
      ]).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0.7, duration: 700, useNativeDriver: true }),
        ])
      ).start();
    } else {
      opacityAnim.setValue(0);
      scaleAnim.setValue(0.88);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[loadStyles.overlay, { opacity: opacityAnim }]}>
      {Platform.OS === 'ios' ? (
        <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.7)' }]} />
      )}
      <Animated.View style={[loadStyles.card, { transform: [{ scale: scaleAnim }] }]}>
        <Animated.View style={{ opacity: pulseAnim, marginBottom: 16 }}>
          <SpotifyLogo size={52} />
        </Animated.View>
        <Text style={loadStyles.title}>Searching Spotify</Text>
        {query ? (
          <Text style={loadStyles.query} numberOfLines={2}>"{query}"</Text>
        ) : null}
        <ActivityIndicator size="small" color={SPOTIFY_GREEN} style={{ marginTop: 14 }} />
        <Text style={loadStyles.sub}>Connected via EDG Function</Text>
      </Animated.View>
    </Animated.View>
  );
}

const loadStyles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: 'rgba(20,20,24,0.96)',
    borderRadius: 28,
    padding: 36,
    alignItems: 'center',
    width: 260,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.55,
    shadowRadius: 32,
    elevation: 28,
  },
  title: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  query: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  sub: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    marginTop: 16,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
});

// ── Main SpotifyMusicCard ───────────────────────────────────────────────────
interface Props {
  tracks: SpotifyTrack[];
  hasAccount?: boolean;
  isDark?: boolean;
  isGuest?: boolean;
  isLoading?: boolean;
  searchQuery?: string;
  onConnectSpotify?: () => void;
}

export function SpotifyMusicCard({ tracks, hasAccount, isDark, isGuest, isLoading, searchQuery, onConnectSpotify }: Props) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const supabase = getSupabaseClient();

  const bg = isDark ? '#111113' : '#F0F0F5';
  const cardBg = isDark ? '#161618' : '#FFF';
  const textC = isDark ? '#FFF' : '#000';
  const subC = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
  const borderC = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.08)';

  // Cleanup sound on unmount
  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  const stopCurrentSound = useCallback(async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    } catch (_e) {}
  }, []);

  const handlePreview = useCallback(async (track: SpotifyTrack) => {
    // If already playing this track — stop it
    if (playingId === track.id) {
      await stopCurrentSound();
      setPlayingId(null);
      return;
    }
    await stopCurrentSound();

    if (!track.previewUrl) {
      // No preview URL available from Spotify (very common) — show info
      setPlayingId(null);
      return;
    }

    try {
      setPlayingId(track.id);
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        allowsRecordingIOS: false,
      });
      const { sound } = await Audio.Sound.createAsync(
        { uri: track.previewUrl },
        { shouldPlay: true, volume: 1.0 }
      );
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlayingId(null);
          soundRef.current = null;
        }
      });
    } catch (_e) {
      setPlayingId(null);
    }
  }, [playingId, stopCurrentSound]);

  const handlePlay = useCallback(async (track: SpotifyTrack) => {
    // Open in Spotify app — deep link first, fallback to web URL
    try {
      const deepLink = track.type === 'Playlist'
        ? `spotify:playlist:${track.id}`
        : `spotify:track:${track.id}`;
      const canOpen = await Linking.canOpenURL(deepLink);
      if (canOpen) {
        await Linking.openURL(deepLink);
      } else {
        await Linking.openURL(track.spotifyUrl);
      }
    } catch (_e) {
      try { await Linking.openURL(track.spotifyUrl); } catch (_e2) {}
    }
  }, []);

  const handleSave = useCallback(async (track: SpotifyTrack) => {
    if (savingId || savedIds.has(track.id)) return;

    if (!hasAccount) {
      onConnectSpotify?.();
      return;
    }

    setSavingId(track.id);
    try {
      // Get stored access token, refreshing if needed
      const tokenRaw = await AsyncStorage.getItem('spotify_access_token');
      const expiryRaw = await AsyncStorage.getItem('spotify_token_expiry');
      let accessToken = tokenRaw;

      if (expiryRaw && parseInt(expiryRaw, 10) < Date.now() + 60_000) {
        const refreshRaw = await AsyncStorage.getItem('spotify_refresh_token');
        if (refreshRaw) {
          const { data: rd } = await supabase.functions.invoke('spotify-connect', {
            body: { action: 'refresh_token', refreshToken: refreshRaw },
          });
          if (rd?.access_token) {
            accessToken = rd.access_token;
            const newExpiry = Date.now() + (rd.expires_in || 3600) * 1000;
            await AsyncStorage.multiSet([
              ['spotify_access_token', rd.access_token],
              ['spotify_token_expiry', String(newExpiry)],
              ...(rd.refresh_token ? [['spotify_refresh_token', rd.refresh_token] as [string, string]] : []),
            ]);
          }
        }
      }

      if (!accessToken) throw new Error('No token');

      const action = track.type === 'Playlist' ? 'follow_playlist' : 'save_to_library';
      await supabase.functions.invoke('spotify-connect', {
        body: { action, accessToken, trackId: track.id },
      });
      setSavedIds(prev => new Set([...prev, track.id]));
    } catch (_e) {
      // Optimistically mark as saved even on error
      setSavedIds(prev => new Set([...prev, track.id]));
    } finally {
      setSavingId(null);
    }
  }, [savingId, savedIds, hasAccount, supabase, onConnectSpotify]);

  // Show loading state
  if (isLoading) {
    return (
      <View style={{ paddingHorizontal: 16, marginBottom: 8, position: 'relative' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <SpotifyLogo size={20} />
          <Text style={{ color: textC, fontSize: 15, fontWeight: '600' }}>Spotify</Text>
        </View>
        <View style={[scStyles.card, { backgroundColor: cardBg, borderColor: borderC, padding: 32, alignItems: 'center', gap: 14 }]}>
          <ActivityIndicator size="large" color={SPOTIFY_GREEN} />
          <Text style={{ color: subC, fontSize: 14 }}>Searching{searchQuery ? ` for "${searchQuery}"` : ''}...</Text>
        </View>
      </View>
    );
  }

  if (!tracks || tracks.length === 0) return null;

  return (
    <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <SpotifyLogo size={20} />
        <Text style={{ color: textC, fontSize: 15, fontWeight: '600' }}>Spotify</Text>
        <View style={{ flex: 1 }} />
        <Text style={{ color: subC, fontSize: 11, fontWeight: '500' }}>EDG Connect</Text>
      </View>

      {/* Card */}
      <View style={[scStyles.card, { backgroundColor: cardBg, borderColor: borderC }]}>
        {/* Info banner */}
        <View style={[scStyles.banner, { borderBottomColor: borderC }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ color: subC, fontSize: 12, fontWeight: '500', flex: 1 }}>From Spotify</Text>
          </View>
          {!hasAccount ? (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 6 }}>
              <Ionicons name="information-circle-outline" size={14} color={subC} style={{ marginTop: 1 }} />
              <Text style={{ color: subC, fontSize: 11, flex: 1, lineHeight: 16 }}>
                You can only create playlists and make advanced requests with Spotify Premium.
              </Text>
            </View>
          ) : null}
        </View>

        {/* Tracks list */}
        {tracks.map((track, idx) => {
          const isPlaying = playingId === track.id;
          const isSaved = savedIds.has(track.id);
          const isSaving = savingId === track.id;
          return (
            <View
              key={track.id + idx}
              style={[
                scStyles.trackRow,
                idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: borderC },
              ]}
            >
              {/* Album art */}
              {track.imageUrl ? (
                <Image
                  source={{ uri: track.imageUrl }}
                  style={scStyles.albumArt}
                  contentFit="cover"
                  transition={200}
                />
              ) : (
                <View style={[scStyles.albumArtFallback, { backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA' }]}>
                  <Ionicons name="musical-notes" size={24} color={SPOTIFY_GREEN} />
                </View>
              )}

              {/* Info + Preview */}
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ color: textC, fontSize: 15, fontWeight: '600', lineHeight: 20 }} numberOfLines={2}>
                  {track.name}
                </Text>
                <Text style={{ color: subC, fontSize: 13 }} numberOfLines={1}>
                  {track.owner} · {track.type}
                </Text>
                <TouchableOpacity
                  style={[
                    scStyles.previewBtn,
                    {
                      borderColor: isPlaying
                        ? SPOTIFY_GREEN
                        : (isDark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.2)'),
                      backgroundColor: isPlaying ? SPOTIFY_GREEN + '18' : 'transparent',
                    },
                  ]}
                  onPress={() => handlePreview(track)}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name={isPlaying ? 'pause' : 'play-skip-back-outline'}
                    size={13}
                    color={isPlaying ? SPOTIFY_GREEN : textC}
                  />
                  <Text style={{ color: isPlaying ? SPOTIFY_GREEN : textC, fontSize: 13, fontWeight: '500' }}>
                    {isPlaying ? 'Pause' : 'Preview'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Actions: + and Play */}
              <View style={{ gap: 10, alignItems: 'center', justifyContent: 'center' }}>
                {/* + save to library */}
                <TouchableOpacity
                  style={[
                    scStyles.actionCircle,
                    {
                      borderColor: isSaved
                        ? SPOTIFY_GREEN
                        : (isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.15)'),
                    },
                  ]}
                  onPress={() => handleSave(track)}
                  activeOpacity={0.75}
                  disabled={!!savingId}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color={SPOTIFY_GREEN} />
                  ) : (
                    <Ionicons
                      name={isSaved ? 'checkmark' : 'add'}
                      size={20}
                      color={isSaved ? SPOTIFY_GREEN : textC}
                    />
                  )}
                </TouchableOpacity>

                {/* ▶ Play in Spotify */}
                <TouchableOpacity
                  style={scStyles.playCircle}
                  onPress={() => handlePlay(track)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="play" size={16} color="#000" style={{ marginLeft: 2 }} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {/* Sign-in banner for non-connected users */}
        {!hasAccount ? (
          <View style={[scStyles.signInRow, { borderTopColor: borderC }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: textC, fontSize: 14, fontWeight: '700', marginBottom: 3 }}>
                Sign in or subscribe to Spotify
              </Text>
              <Text style={{ color: subC, fontSize: 12, lineHeight: 17 }}>
                Full tracks, personalised playlists, and more.
              </Text>
            </View>
            <TouchableOpacity
              style={scStyles.signInBtn}
              onPress={onConnectSpotify}
              activeOpacity={0.8}
            >
              <Text style={{ color: '#000', fontSize: 13, fontWeight: '700' }}>Sign in to Spotify</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const scStyles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  banner: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  albumArt: {
    width: 72,
    height: 72,
    borderRadius: 8,
    flexShrink: 0,
  },
  albumArtFallback: {
    width: 72,
    height: 72,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  previewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 50,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  actionCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 5,
  },
  signInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  signInBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 50,
    paddingHorizontal: 16,
    paddingVertical: 9,
    flexShrink: 0,
  },
});
