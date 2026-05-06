import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Platform, Share, StatusBar, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { useTheme } from '../hooks/useTheme';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Types ─────────────────────────────────────────────────────────────────

interface AppItem {
  id: string;
  name: string;
  description: string;
  icon: string; // emoji or image
  iconBg: string;
  connected: boolean;
  comingSoon?: boolean;
  route: string;
}

const APPS: AppItem[] = [
  {
    id: 'spotify',
    name: 'Spotify',
    description: 'Music and podcasts for you',
    icon: '🎵',
    iconBg: '#1DB954',
    connected: false,
    route: '/spotify-connect',
  },
  {
    id: 'apple-music',
    name: 'Apple Music',
    description: 'Build playlists and find music',
    icon: '🎶',
    iconBg: '#FC3C44',
    connected: false,
    comingSoon: true,
    route: '',
  },
];

// ── Spotify SVG-style icon ─────────────────────────────────────────────────
function SpotifyIcon({ size = 44 }: { size?: number }) {
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: '#1DB954',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ fontSize: size * 0.45 }}>♪</Text>
    </View>
  );
}

function AppleMusicIcon({ size = 44 }: { size?: number }) {
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: '#FC3C44',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Ionicons name="musical-notes" size={size * 0.5} color="#FFF" />
    </View>
  );
}

// ── App Row ────────────────────────────────────────────────────────────────
function AppRow({
  app,
  onPress,
  connected,
}: {
  app: AppItem;
  onPress: () => void;
  connected: boolean;
}) {
  const { colors, isDark } = useTheme();

  return (
    <TouchableOpacity
      style={[styles.appRow, { borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}
      onPress={app.comingSoon ? undefined : onPress}
      activeOpacity={app.comingSoon ? 1 : 0.7}
    >
      {/* Icon */}
      {app.id === 'spotify' ? (
        <SpotifyIcon size={52} />
      ) : (
        <AppleMusicIcon size={52} />
      )}

      {/* Info */}
      <View style={styles.appRowInfo}>
        <View style={styles.appRowNameRow}>
          <Text style={[styles.appRowName, { color: isDark ? '#FFF' : '#000' }]}>{app.name}</Text>
          {connected && !app.comingSoon ? (
            <View style={styles.connectedBadge}>
              <Ionicons name="checkmark-circle" size={14} color="#1DB954" />
              <Text style={styles.connectedBadgeText}>Connected</Text>
            </View>
          ) : null}
          {app.comingSoon ? (
            <View style={[styles.connectedBadge, { backgroundColor: 'rgba(255,159,10,0.15)' }]}>
              <Text style={[styles.connectedBadgeText, { color: '#FF9F0A' }]}>Coming soon</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.appRowDesc, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }]}>
          {app.description}
        </Text>
      </View>

      {/* Chevron */}
      {!app.comingSoon ? (
        <Ionicons name="chevron-forward" size={20} color={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'} />
      ) : null}
    </TouchableOpacity>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────
export default function AppConnectScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [connectedApps, setConnectedApps] = useState<Set<string>>(new Set());

  // Load connected apps on mount
  React.useEffect(() => {
    AsyncStorage.getItem('connected_apps').then(raw => {
      if (raw) {
        try { setConnectedApps(new Set(JSON.parse(raw))); } catch (_e) {}
      }
    });
  }, []);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: 'Check out Dawinix Apps — connect your favorite apps and chat with them using AI!\n\nhttps://dawinix.app/apps',
        title: 'Dawinix Apps',
      });
    } catch (_e) {}
  }, []);

  const filteredApps = APPS.filter(a =>
    !searchQuery.trim() ||
    a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const bg = isDark ? '#000' : '#F2F2F7';
  const cardBg = isDark ? '#111113' : '#FFF';
  const inputBg = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';

  return (
    <View style={[styles.container, { backgroundColor: bg, paddingTop: insets.top }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={bg} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.headerIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)' }]}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={20} color={isDark ? '#FFF' : '#000'} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: isDark ? '#FFF' : '#000' }]}>Apps</Text>

        <TouchableOpacity
          style={[styles.headerIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)' }]}
          onPress={handleShare}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="share-outline" size={20} color={isDark ? '#FFF' : '#000'} />
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={[styles.searchBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)' }]}>
        <Ionicons name="search" size={16} color={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)'} />
        <TextInput
          style={[styles.searchInput, { color: isDark ? '#FFF' : '#000' }]}
          placeholder="Search apps"
          placeholderTextColor={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={16} color={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)'} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Beta banner */}
      <View style={styles.betaBanner}>
        <Text style={[styles.betaBannerText, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)' }]}>
          Chat with your favorite apps in Dawinix
        </Text>
        <View style={[styles.betaTag, { borderColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)' }]}>
          <Text style={[styles.betaTagText, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)' }]}>BETA</Text>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' }]} />

      {/* Apps list */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        <View style={[styles.appsList, { backgroundColor: cardBg }]}>
          {filteredApps.map((app, index) => (
            <React.Fragment key={app.id}>
              {index > 0 ? (
                <View style={[styles.rowDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]} />
              ) : null}
              <AppRow
                app={app}
                onPress={() => {
                  if (app.route) router.push(app.route as any);
                }}
                connected={connectedApps.has(app.id)}
              />
            </React.Fragment>
          ))}
        </View>

        {filteredApps.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={{ color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', fontSize: 15, textAlign: 'center' }}>
              No apps found
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerIconBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17, fontWeight: '600',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1, fontSize: 15,
  },
  betaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  betaBannerText: { fontSize: 13 },
  betaTag: {
    borderWidth: 1, borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  betaTagText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  divider: { height: StyleSheet.hairlineWidth, marginBottom: 16 },
  appsList: {
    marginHorizontal: 16, borderRadius: 18,
    overflow: 'hidden',
  },
  appRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 14,
  },
  appRowInfo: { flex: 1 },
  appRowNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  appRowName: { fontSize: 16, fontWeight: '600' },
  appRowDesc: { fontSize: 13, lineHeight: 18 },
  connectedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(29,185,84,0.12)',
    borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3,
  },
  connectedBadgeText: { fontSize: 11, fontWeight: '700', color: '#1DB954' },
  rowDivider: { height: StyleSheet.hairlineWidth, marginLeft: 82 },
  emptyState: { paddingTop: 60, alignItems: 'center' },
});
