import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Platform, Share, StatusBar, Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_W } = Dimensions.get('window');
const SPOTIFY_GREEN = '#1DB954';

// ── Spotify SVG-style logo ──────────────────────────────────────────────────
function SpotifyLogo({ size = 52 }: { size?: number }) {
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: SPOTIFY_GREEN, alignItems: 'center', justifyContent: 'center',
    }}>
      <View style={{ gap: Math.ceil(size * 0.065), alignItems: 'center' }}>
        {[1, 0.78, 0.56].map((w, i) => (
          <View key={i} style={{
            width: size * 0.54 * w,
            height: Math.max(2, Math.ceil(size * 0.075)),
            borderRadius: 10,
            backgroundColor: '#000',
          }} />
        ))}
      </View>
    </View>
  );
}

function AppleMusicLogo({ size = 52 }: { size?: number }) {
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: '#FC3C44', alignItems: 'center', justifyContent: 'center',
    }}>
      <Ionicons name="musical-notes" size={size * 0.5} color="#FFF" />
    </View>
  );
}

// ── Category tabs ──────────────────────────────────────────────────────────
const CATEGORIES = ['Featured', 'Music', 'Productivity'];

// ── All apps data ──────────────────────────────────────────────────────────
const ALL_APPS = [
  {
    id: 'spotify',
    name: 'Spotify',
    description: 'Music and podcasts for you',
    category: ['Featured', 'Music'],
    route: '/spotify-connect',
    comingSoon: false,
  },
  {
    id: 'apple-music',
    name: 'Apple Music',
    description: 'Build playlists and find music',
    category: ['Music'],
    route: '',
    comingSoon: true,
  },
];

// ── Featured Hero Card ─────────────────────────────────────────────────────
function FeaturedCard({
  app,
  connected,
  onPress,
  isDark,
}: {
  app: typeof ALL_APPS[0];
  connected: boolean;
  onPress: () => void;
  isDark: boolean;
}) {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  return (
    <Animated.View style={{ opacity: fadeAnim, marginHorizontal: 16, marginBottom: 24 }}>
      <TouchableOpacity
        style={[featStyles.hero, { backgroundColor: isDark ? '#111113' : '#1A1A1A' }]}
        onPress={onPress}
        activeOpacity={0.88}
        disabled={app.comingSoon}
      >
        {/* Gradient-like dark overlay layer */}
        <View style={featStyles.heroBg} />

        {/* Content */}
        <View style={featStyles.heroContent}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            {app.id === 'spotify' ? <SpotifyLogo size={52} /> : <AppleMusicLogo size={52} />}
            <View style={{ flex: 1 }}>
              <Text style={featStyles.heroName}>{app.name}</Text>
              <Text style={featStyles.heroDesc}>{app.description}</Text>
            </View>
          </View>
          {/* Fake chat bubble */}
          <View style={featStyles.chatBubble}>
            <Text style={featStyles.chatText}>
              {app.id === 'spotify'
                ? '@Spotify play something for my workout'
                : '@AppleMusic create a chill playlist'}
            </Text>
          </View>
        </View>

        {/* View badge */}
        <View style={featStyles.viewBadge}>
          <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '600' }}>
            {connected ? 'Connected' : app.comingSoon ? 'Soon' : 'View'}
          </Text>
        </View>

        {/* Connected dot */}
        {connected ? (
          <View style={featStyles.connectedDot} />
        ) : null}
      </TouchableOpacity>
    </Animated.View>
  );
}

const featStyles = StyleSheet.create({
  hero: {
    borderRadius: 20, overflow: 'hidden', minHeight: 180,
    justifyContent: 'flex-end',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 16, elevation: 12,
  },
  heroBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  heroContent: {
    padding: 18,
  },
  heroName: {
    color: '#FFF', fontSize: 20, fontWeight: '700',
  },
  heroDesc: {
    color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 2,
  },
  chatBubble: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14, padding: 10,
    alignSelf: 'flex-start', maxWidth: '85%',
  },
  chatText: {
    color: 'rgba(255,255,255,0.88)', fontSize: 13,
  },
  viewBadge: {
    position: 'absolute', top: 14, right: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6,
  },
  connectedDot: {
    position: 'absolute', bottom: 14, right: 14,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: SPOTIFY_GREEN,
    borderWidth: 2, borderColor: '#111',
  },
});

// ── App List Row ───────────────────────────────────────────────────────────
function AppListRow({
  app,
  connected,
  onPress,
  isDark,
  isLast,
}: {
  app: typeof ALL_APPS[0];
  connected: boolean;
  onPress: () => void;
  isDark: boolean;
  isLast: boolean;
}) {
  const textC = isDark ? '#FFF' : '#000';
  const subC = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';
  const borderC = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';

  return (
    <TouchableOpacity
      style={[
        rowStyles.row,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: borderC },
      ]}
      onPress={app.comingSoon ? undefined : onPress}
      activeOpacity={app.comingSoon ? 1 : 0.7}
    >
      {app.id === 'spotify' ? (
        <SpotifyLogo size={52} />
      ) : (
        <AppleMusicLogo size={52} />
      )}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: textC, fontSize: 16, fontWeight: '600' }}>{app.name}</Text>
          {connected ? (
            <View style={rowStyles.connBadge}>
              <Ionicons name="checkmark-circle" size={13} color={SPOTIFY_GREEN} />
              <Text style={rowStyles.connBadgeText}>Connected</Text>
            </View>
          ) : app.comingSoon ? (
            <View style={[rowStyles.connBadge, { backgroundColor: 'rgba(255,159,10,0.15)' }]}>
              <Text style={[rowStyles.connBadgeText, { color: '#FF9F0A' }]}>Coming soon</Text>
            </View>
          ) : null}
        </View>
        <Text style={{ color: subC, fontSize: 13, marginTop: 3 }}>{app.description}</Text>
      </View>
      {!app.comingSoon ? (
        <Ionicons name="chevron-forward" size={18} color={subC} />
      ) : null}
    </TouchableOpacity>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 14,
  },
  connBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(29,185,84,0.12)',
    borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3,
  },
  connBadgeText: { fontSize: 11, fontWeight: '700', color: SPOTIFY_GREEN },
});

// ── Main Screen ────────────────────────────────────────────────────────────
export default function AppConnectScreen() {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('Featured');
  const [connectedApps, setConnectedApps] = useState<Set<string>>(new Set());

  useEffect(() => {
    AsyncStorage.getItem('connected_apps').then(raw => {
      if (raw) {
        try { setConnectedApps(new Set(JSON.parse(raw))); } catch (_e) {}
      }
    });
  }, []);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: 'Check out Dawinix Apps — connect Spotify and chat with AI!\nhttps://dawinix.app/apps',
        title: 'Dawinix Apps',
      });
    } catch (_e) {}
  }, []);

  const filteredApps = ALL_APPS.filter(a => {
    const matchesSearch = !searchQuery.trim()
      || a.name.toLowerCase().includes(searchQuery.toLowerCase())
      || a.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = activeCategory === 'Featured'
      ? a.category.includes('Featured')
      : a.category.includes(activeCategory);
    return matchesSearch && matchesCat;
  });

  const allFiltered = searchQuery.trim()
    ? ALL_APPS.filter(a =>
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.description.toLowerCase().includes(searchQuery.toLowerCase()))
    : filteredApps;

  const featuredApp = ALL_APPS.find(a => a.category.includes('Featured') && a.id === 'spotify');

  const bg = isDark ? '#000' : '#F2F2F7';
  const cardBg = isDark ? '#111113' : '#FFF';
  const textC = isDark ? '#FFF' : '#000';
  const subC = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';
  const inputBg = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';

  return (
    <View style={{ flex: 1, backgroundColor: bg, paddingTop: insets.top }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={bg} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.headerBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)' }]}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={20} color={textC} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textC }]}>Apps</Text>
        <TouchableOpacity
          style={[styles.headerBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)' }]}
          onPress={handleShare}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="share-outline" size={20} color={textC} />
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={[styles.searchBar, { backgroundColor: inputBg }]}>
        <Ionicons name="search" size={16} color={subC} />
        <TextInput
          style={[styles.searchInput, { color: textC }]}
          placeholder="Search apps"
          placeholderTextColor={subC}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={16} color={subC} />
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {/* Featured hero — only when no search and on Featured tab */}
        {!searchQuery && activeCategory === 'Featured' && featuredApp ? (
          <FeaturedCard
            app={featuredApp}
            connected={connectedApps.has(featuredApp.id)}
            onPress={() => router.push('/spotify-connect')}
            isDark={isDark}
          />
        ) : null}

        {/* Beta banner */}
        <View style={styles.betaRow}>
          <Text style={[styles.betaText, { color: subC }]}>
            Chat with your favorite apps in Dawinix
          </Text>
          <View style={[styles.betaTag, { borderColor: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.18)' }]}>
            <Text style={[styles.betaTagText, { color: subC }]}>BETA</Text>
          </View>
        </View>

        {/* Category tabs — only when not searching */}
        {!searchQuery ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 16 }}
          >
            {CATEGORIES.map(cat => {
              const isActive = activeCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.catTab,
                    isActive
                      ? { backgroundColor: textC }
                      : { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)' },
                  ]}
                  onPress={() => setActiveCategory(cat)}
                  activeOpacity={0.75}
                >
                  <Text style={{
                    color: isActive ? (isDark ? '#000' : '#FFF') : textC,
                    fontSize: 15, fontWeight: '600',
                  }}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : null}

        {/* Apps list */}
        <View style={{ marginHorizontal: 16 }}>
          {(searchQuery ? allFiltered : filteredApps).length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 48 }}>
              <Text style={{ color: subC, fontSize: 15 }}>No apps found</Text>
            </View>
          ) : (
            <View style={[styles.appsList, { backgroundColor: cardBg }]}>
              {(searchQuery ? allFiltered : filteredApps).map((app, idx, arr) => (
                <AppListRow
                  key={app.id}
                  app={app}
                  connected={connectedApps.has(app.id)}
                  onPress={() => { if (app.route) router.push(app.route as any); }}
                  isDark={isDark}
                  isLast={idx === arr.length - 1}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  headerBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 11,
    gap: 10, marginBottom: 16,
  },
  searchInput: { flex: 1, fontSize: 15 },
  betaRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
    marginBottom: 16, paddingHorizontal: 16,
  },
  betaText: { fontSize: 13 },
  betaTag: {
    borderWidth: 1, borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  betaTagText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  catTab: {
    paddingHorizontal: 18, paddingVertical: 9,
    borderRadius: 50,
  },
  appsList: {
    borderRadius: 18, overflow: 'hidden',
  },
});
