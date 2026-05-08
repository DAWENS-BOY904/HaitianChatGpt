import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Linking,
  Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
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

function SpotifyLogoSmall({ size = 20 }: { size?: number }) {
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: SPOTIFY_GREEN, alignItems: 'center', justifyContent: 'center',
    }}>
      <View style={{ gap: 2, alignItems: 'center' }}>
        {[1, 0.78, 0.56].map((w, i) => (
          <View key={i} style={{
            width: size * 0.52 * w, height: size * 0.07,
            borderRadius: 2, backgroundColor: '#000',
          }} />
        ))}
      </View>
    </View>
  );
}

interface Props {
  tracks: SpotifyTrack[];
  hasAccount?: boolean;
  isDark?: boolean;
  isGuest?: boolean;
}

export function SpotifyMusicCard({ tracks, hasAccount, isDark, isGuest }: Props) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const supabase = getSupabaseClient();

  const bg = isDark ? '#111113' : '#F0F0F5';
  const cardBg = isDark ? '#1A1A1D' : '#FFF';
  const textC = isDark ? '#FFF' : '#000';
  const subC = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
  const borderC = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';

  const stopCurrentSound = async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    } catch (_e) {}
  };

  const handlePreview = async (track: SpotifyTrack) => {
    if (!track.previewUrl) {
      try { await Linking.openURL(track.spotifyUrl); } catch (_e) {}
      return;
    }
    try {
      if (playingId === track.id) {
        await stopCurrentSound();
        setPlayingId(null);
        return;
      }
      await stopCurrentSound();
      setPlayingId(track.id);
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false });
      const { sound } = await Audio.Sound.createAsync({ uri: track.previewUrl }, { shouldPlay: true });
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
  };

  const handlePlay = async (track: SpotifyTrack) => {
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
  };

  const handleSave = async (track: SpotifyTrack) => {
    if (savingId || savedIds.has(track.id)) return;
    if (!hasAccount) {
      Alert.alert('Spotify Account Required',
        'Connect your Spotify account to save to your library.',
        [{ text: 'OK' }]);
      return;
    }
    setSavingId(track.id);
    try {
      const accessToken = await AsyncStorage.getItem('spotify_access_token');
      if (!accessToken) throw new Error('No token');
      const action = track.type === 'Playlist' ? 'follow_playlist' : 'save_to_library';
      await supabase.functions.invoke('spotify-connect', {
        body: { action, accessToken, trackId: track.id },
      });
      setSavedIds(prev => new Set([...prev, track.id]));
    } catch (_e) {
      setSavedIds(prev => new Set([...prev, track.id]));
    } finally {
      setSavingId(null);
    }
  };

  if (!tracks || tracks.length === 0) return null;

  return (
    <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <SpotifyLogoSmall size={20} />
        <Text style={{ color: textC, fontSize: 15, fontWeight: '600' }}>Spotify</Text>
      </View>

      {/* Card */}
      <View style={[scStyles.card, { backgroundColor: cardBg, borderColor: borderC }]}>
        {/* Info banner */}
        <View style={[scStyles.banner, { borderBottomColor: borderC }]}>
          <Text style={{ color: subC, fontSize: 12, fontWeight: '500', flex: 1 }}>From Spotify</Text>
          {!hasAccount ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="information-circle-outline" size={14} color={subC} />
              <Text style={{ color: subC, fontSize: 11 }}>
                You can only create playlists and make advanced requests with Spotify Premium.
              </Text>
            </View>
          ) : null}
        </View>

        {/* Tracks */}
        {tracks.map((track, idx) => {
          const isPlaying = playingId === track.id;
          const isSaved = savedIds.has(track.id);
          const isSaving = savingId === track.id;
          return (
            <View key={track.id + idx} style={[scStyles.trackRow, idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: borderC }]}>
              {/* Album art */}
              {track.imageUrl ? (
                <Image source={{ uri: track.imageUrl }} style={scStyles.albumArt} contentFit="cover" transition={200} />
              ) : (
                <View style={[scStyles.albumArtFallback, { backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA' }]}>
                  <Ionicons name="musical-notes" size={22} color={SPOTIFY_GREEN} />
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
                  style={[scStyles.previewBtn, { borderColor: isDark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.2)' }]}
                  onPress={() => handlePreview(track)}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name={isPlaying ? 'pause' : 'play-skip-back-outline'}
                    size={13}
                    color={textC}
                  />
                  <Text style={{ color: textC, fontSize: 13, fontWeight: '500' }}>
                    {isPlaying ? 'Pause' : 'Preview'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Actions */}
              <View style={{ gap: 10, alignItems: 'center' }}>
                <TouchableOpacity
                  style={[scStyles.actionCircle, { borderColor: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.15)' }]}
                  onPress={() => handleSave(track)}
                  activeOpacity={0.75}
                  disabled={!!savingId}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color={SPOTIFY_GREEN} />
                  ) : (
                    <Ionicons name={isSaved ? 'checkmark' : 'add'} size={20} color={isSaved ? SPOTIFY_GREEN : textC} />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={scStyles.playCircle}
                  onPress={() => handlePlay(track)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="play" size={18} color={isDark ? '#000' : '#000'} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {/* Sign in footerS for guest */}
        {!hasAccount ? (
          <View style={[scStyles.signInRow, { borderTopColor: borderC }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: textC, fontSize: 14, fontWeight: '600', marginBottom: 2 }}>
                Sign in or subscribe to Spotify
              </Text>
              <Text style={{ color: subC, fontSize: 12, lineHeight: 17 }}>
                Full tracks, personalised playlists, and more.
              </Text>
            </View>
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
    alignItems: 'flex-start',
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
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  signInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
});
