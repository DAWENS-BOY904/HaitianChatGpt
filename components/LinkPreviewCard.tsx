/**
 * LinkPreviewCard — rich preview card for URLs detected in chat.
 * Fetches real OpenGraph/oEmbed metadata via the fetch-link-preview edge function.
 * Supports: TikTok, YouTube, Instagram, Facebook, Twitter/X, any website.
 */
import React, { useState, useEffect, useRef, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Platform,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { getSupabaseClient } from '@/template';
import { BlurView } from 'expo-blur';

// ── Module-level metadata cache (persists across renders, avoids re-fetching) ──
const _metadataCache = new Map<string, LinkMetadata>();
const _pendingFetches = new Set<string>(); // deduplicate in-flight requests

// ── Platform detection ────────────────────────────────────────────────────────
export type LinkPlatform =
  | 'tiktok'
  | 'youtube'
  | 'instagram'
  | 'facebook'
  | 'twitter'
  | 'reddit'
  | 'github'
  | 'linkedin'
  | 'spotify'
  | 'amazon'
  | 'article'
  | 'web';

export function detectLinkPlatform(url: string): LinkPlatform {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes('tiktok.com') || host.includes('vm.tiktok.com')) return 'tiktok';
    if (host.includes('youtube.com') || host.includes('youtu.be')) return 'youtube';
    if (host.includes('instagram.com')) return 'instagram';
    if (host.includes('facebook.com') || host.includes('fb.com') || host.includes('fb.watch')) return 'facebook';
    if (host.includes('twitter.com') || host.includes('x.com')) return 'twitter';
    if (host.includes('reddit.com')) return 'reddit';
    if (host.includes('github.com')) return 'github';
    if (host.includes('linkedin.com')) return 'linkedin';
    if (host.includes('spotify.com')) return 'spotify';
    if (host.includes('amazon.com') || host.includes('amzn.to')) return 'amazon';
    if (host.includes('medium.com') || host.includes('substack.com')) return 'article';
  } catch (_e) {}
  return 'web';
}

// ── Platform config ───────────────────────────────────────────────────────────
const PLATFORM_CONFIG: Record<LinkPlatform, { label: string; color: string; bgColor: string; iconName: string }> = {
  tiktok:   { label: 'TikTok',       color: '#FFFFFF', bgColor: '#010101',  iconName: 'logo-tiktok'    },
  youtube:  { label: 'YouTube',      color: '#FFFFFF', bgColor: '#FF0000',  iconName: 'logo-youtube'   },
  instagram:{ label: 'Instagram',    color: '#FFFFFF', bgColor: '#E1306C',  iconName: 'logo-instagram' },
  facebook: { label: 'Facebook',     color: '#FFFFFF', bgColor: '#1877F2',  iconName: 'logo-facebook'  },
  twitter:  { label: 'Twitter / X',  color: '#FFFFFF', bgColor: '#000000',  iconName: 'logo-twitter'   },
  reddit:   { label: 'Reddit',       color: '#FFFFFF', bgColor: '#FF4500',  iconName: 'logo-reddit'    },
  github:   { label: 'GitHub',       color: '#FFFFFF', bgColor: '#24292E',  iconName: 'logo-github'    },
  linkedin: { label: 'LinkedIn',     color: '#FFFFFF', bgColor: '#0A66C2',  iconName: 'business'       },
  spotify:  { label: 'Spotify',      color: '#000000', bgColor: '#1DB954',  iconName: 'musical-notes'  },
  amazon:   { label: 'Amazon',       color: '#FFFFFF', bgColor: '#FF9900',  iconName: 'cart'           },
  article:  { label: 'Article',      color: '#FFFFFF', bgColor: '#607D8B',  iconName: 'document-text'  },
  web:      { label: 'Open Link',    color: '#FFFFFF', bgColor: '#007AFF',  iconName: 'globe-outline'  },
};

// ── Open URL ──────────────────────────────────────────────────────────────────
async function openUrl(url: string) {
  try {
    if (await Linking.canOpenURL(url)) await Linking.openURL(url);
  } catch (_e) {}
}

// ── Metadata type ─────────────────────────────────────────────────────────────
export interface LinkMetadata {
  title: string;
  description?: string;
  thumbnail?: string;
  author?: string;
  siteName?: string;
  platform: LinkPlatform;
  url: string;
}

// ── Fallback metadata (shown while loading) ────────────────────────────────────
function buildFallbackMetadata(url: string): LinkMetadata {
  const platform = detectLinkPlatform(url);
  let domain = '';
  try { domain = new URL(url).hostname.replace('www.', ''); } catch {}
  return {
    title: domain || url,
    description: 'Tap to open this link',
    siteName: PLATFORM_CONFIG[platform].label,
    platform,
    url,
  };
}

// ── Skeleton card (loading state) ─────────────────────────────────────────────
const SkeletonCard = memo(function SkeletonCard({
  compact,
  isDark,
}: { compact: boolean; isDark: boolean }) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });
  const skelBg   = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)';
  const thumbH   = compact ? 120 : 160;
  const cardW: any = compact ? 260 : '100%';

  return (
    <View style={[styles.card, { width: cardW, alignSelf: 'flex-start', marginVertical: 6, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)', overflow: 'hidden' }]}>
      <BlurView intensity={isDark ? 35 : 55} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} experimentalBlurMethod="dimezisBlurView" />
      {/* Thumbnail skeleton */}
      <Animated.View style={{ width: '100%', height: thumbH, opacity, backgroundColor: skelBg, borderTopLeftRadius: 16, borderTopRightRadius: 16 }} />
      {/* Info skeleton */}
      <View style={{ padding: 12, gap: 7 }}>
        <Animated.View style={{ height: 13, width: '75%', borderRadius: 6, backgroundColor: skelBg, opacity }} />
        <Animated.View style={{ height: 10, width: '55%', borderRadius: 6, backgroundColor: skelBg, opacity }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, alignItems: 'center' }}>
          <Animated.View style={{ height: 9, width: '40%', borderRadius: 5, backgroundColor: skelBg, opacity }} />
          <Animated.View style={{ height: 24, width: 60, borderRadius: 12, backgroundColor: skelBg, opacity }} />
        </View>
      </View>
    </View>
  );
});

// ── Platform badge ─────────────────────────────────────────────────────────────
const PlatformBadge = memo(function PlatformBadge({ platform }: { platform: LinkPlatform }) {
  const cfg = PLATFORM_CONFIG[platform];
  return (
    <View style={[styles.platformBadge, { backgroundColor: cfg.bgColor }]}>
      <Ionicons name={cfg.iconName as any} size={11} color={cfg.color} />
      <Text style={[styles.platformLabel, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
});

// ── Thumbnail placeholder (no image) ──────────────────────────────────────────
const ThumbnailPlaceholder = memo(function ThumbnailPlaceholder({
  platform, isDark,
}: { platform: LinkPlatform; isDark: boolean }) {
  const cfg = PLATFORM_CONFIG[platform];
  return (
    <View style={[styles.thumbnailPlaceholder, { backgroundColor: isDark ? 'rgba(44,44,46,0.45)' : 'rgba(229,229,234,0.50)' }]}>
      <BlurView intensity={isDark ? 30 : 45} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} experimentalBlurMethod="dimezisBlurView" />
      <View style={[styles.thumbnailIcon, { backgroundColor: cfg.bgColor }]}>
        <Ionicons name={cfg.iconName as any} size={28} color={cfg.color} />
      </View>
    </View>
  );
});

// ── Main LinkPreviewCard ───────────────────────────────────────────────────────
interface LinkPreviewCardProps {
  url: string;
  metadata?: LinkMetadata | null; // optional: skip fetching if provided
  isDark: boolean;
  colors: any;
  compact?: boolean;
}

export const LinkPreviewCard = memo(function LinkPreviewCard({
  url,
  metadata: propMetadata,
  isDark,
  colors,
  compact = false,
}: LinkPreviewCardProps) {
  const [fetchedMeta, setFetchedMeta] = useState<LinkMetadata | null>(null);
  const [loading, setLoading] = useState(!propMetadata);
  const [imgError, setImgError] = useState(false);

  const platform = detectLinkPlatform(url);

  // ── Fetch real OG metadata from edge function ──────────────────────────────
  useEffect(() => {
    // If metadata was passed as prop, skip fetching
    if (propMetadata) { setLoading(false); return; }
    if (!url) { setLoading(false); return; }

    // Check module cache first (instant, no network)
    const cached = _metadataCache.get(url);
    if (cached) { setFetchedMeta(cached); setLoading(false); return; }

    // Deduplicate concurrent requests for the same URL
    if (_pendingFetches.has(url)) { setLoading(false); return; }

    let cancelled = false;
    _pendingFetches.add(url);

    const supabase = getSupabaseClient();
    supabase.functions
      .invoke('fetch-link-preview', { body: { url } })
      .then(({ data, error }) => {
        if (cancelled) return;
        _pendingFetches.delete(url);
        if (!error && data && (data.title || data.image)) {
          const meta: LinkMetadata = {
            title:       data.title       || url,
            description: data.description || undefined,
            thumbnail:   data.image       || undefined,
            author:      data.author      || undefined,
            siteName:    data.siteName    || undefined,
            platform:    detectLinkPlatform(url),
            url,
          };
          _metadataCache.set(url, meta);
          setFetchedMeta(meta);
          setImgError(false);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) { _pendingFetches.delete(url); setLoading(false); }
      });

    return () => { cancelled = true; };
  }, [url, propMetadata]);

  // ── Show skeleton while fetching ──────────────────────────────────────────
  if (loading) {
    return <SkeletonCard compact={compact} isDark={isDark} />;
  }

  // Best available metadata: prop → fetched → fallback
  const meta: LinkMetadata = propMetadata || fetchedMeta || buildFallbackMetadata(url);
  const cfg = PLATFORM_CONFIG[meta.platform];

  const cardBg      = isDark ? 'rgba(28,28,30,0.72)' : 'rgba(255,255,255,0.72)';
  const borderColor = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)';
  const textColor   = isDark ? '#FFFFFF' : '#000000';
  const subColor    = isDark ? 'rgba(255,255,255,0.60)' : 'rgba(0,0,0,0.55)';
  const thumbnailH  = compact ? 120 : 160;
  const cardW: any  = compact ? 260 : '100%';

  const hasThumbnail = !!(meta.thumbnail && !imgError);
  const isVideoPlat  = meta.platform === 'tiktok' || meta.platform === 'youtube';

  return (
    <TouchableOpacity
      onPress={() => openUrl(url)}
      activeOpacity={0.88}
      style={[styles.card, { backgroundColor: cardBg, borderColor, width: cardW, alignSelf: 'flex-start', marginVertical: 6, overflow: 'hidden' }]}
    >
      {/* Glassmorphism blur layer — iOS native, Android enhanced fallback */}
      <BlurView
        intensity={isDark ? 45 : 65}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
        experimentalBlurMethod="dimezisBlurView"
      />
      {/* ── Thumbnail ── */}
      <View style={{ width: '100%', height: thumbnailH, overflow: 'hidden', borderTopLeftRadius: 16, borderTopRightRadius: 16, position: 'relative' }}>
        {hasThumbnail ? (
          <Image
            source={{ uri: meta.thumbnail }}
            style={{ width: '100%', height: thumbnailH }}
            contentFit="cover"
            transition={220}
            onError={() => setImgError(true)}
          />
        ) : (
          <ThumbnailPlaceholder platform={meta.platform} isDark={isDark} />
        )}

        {/* Platform badge — top-left */}
        <View style={{ position: 'absolute', top: 8, left: 8 }}>
          <PlatformBadge platform={meta.platform} />
        </View>

        {/* Play button for video platforms */}
        {isVideoPlat && (
          <View style={styles.playBtn}>
            <Ionicons name="play" size={22} color="#FFF" style={{ marginLeft: 3 }} />
          </View>
        )}

        {/* Gradient overlay for readability when there's an image */}
        {hasThumbnail && (
          <View
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: 56,
              backgroundColor: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.25)',
            }}
          />
        )}
      </View>

      {/* ── Info ── */}
      <View style={{ padding: 12, gap: 4 }}>
        {meta.title ? (
          <Text
            style={{ color: textColor, fontSize: compact ? 13 : 14, fontWeight: '600', lineHeight: 20 }}
            numberOfLines={2}
          >
            {meta.title}
          </Text>
        ) : null}

        {meta.description ? (
          <Text
            style={{ color: subColor, fontSize: 12, lineHeight: 17 }}
            numberOfLines={compact ? 1 : 2}
          >
            {meta.description}
          </Text>
        ) : null}

        {/* Footer: author + open button */}
        <View style={styles.footer}>
          <View style={styles.authorRow}>
            {meta.author ? (
              <>
                <Ionicons name="person-circle-outline" size={13} color={subColor} />
                <Text style={{ color: subColor, fontSize: 11, marginLeft: 3 }} numberOfLines={1}>
                  {meta.author}
                </Text>
              </>
            ) : (
              <Text style={{ color: subColor, fontSize: 11 }} numberOfLines={1}>
                {meta.siteName || cfg.label}
              </Text>
            )}
          </View>

          <View style={[styles.openBtn, { backgroundColor: cfg.bgColor }]}>
            <Ionicons name="open-outline" size={11} color={cfg.color} />
            <Text style={{ color: cfg.color, fontSize: 11, fontWeight: '700' }}>Open</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

// ── Inline URL chip (compact, for text bubbles) ────────────────────────────────
interface UrlChipProps {
  url: string;
  isDark: boolean;
  colors: any;
}

export const UrlChip = memo(function UrlChip({ url, isDark, colors }: UrlChipProps) {
  const platform = detectLinkPlatform(url);
  const cfg = PLATFORM_CONFIG[platform];

  // Show fetched title if available in cache
  const cached = _metadataCache.get(url);
  let display = '';
  try {
    const u = new URL(url);
    display = u.hostname.replace('www.', '') + (u.pathname.length > 1 ? u.pathname.slice(0, 24) : '');
  } catch { display = url; }

  return (
    <TouchableOpacity
      onPress={() => openUrl(url)}
      activeOpacity={0.75}
      style={[
        styles.urlChip,
        {
          backgroundColor: isDark ? 'rgba(44,44,46,0.55)' : 'rgba(245,245,247,0.60)',
          borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)',
          overflow: 'hidden',
        },
      ]}
    >
      <BlurView
        intensity={isDark ? 40 : 60}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
        experimentalBlurMethod="dimezisBlurView"
      />
      <View style={[styles.urlChipIcon, { backgroundColor: cfg.bgColor }]}>
        <Ionicons name={cfg.iconName as any} size={11} color={cfg.color} />
      </View>
      <Text
        style={{ color: colors.primary || '#007AFF', fontSize: 12, fontWeight: '500', flex: 1 }}
        numberOfLines={1}
      >
        {cached?.title || display}
      </Text>
      <Ionicons name="open-outline" size={12} color={colors.textSecondary} />
    </TouchableOpacity>
  );
});

// ── Parse URL metadata from AI response content ────────────────────────────────
export function extractLinkMetadataFromAIResponse(
  content: string,
  url: string
): LinkMetadata | null {
  if (!content || !url) return null;
  const platform = detectLinkPlatform(url);

  // Try to extract from [TIKTOK_CARD] block
  const tiktokMatch = content.match(/\[TIKTOK_CARD\]([\s\S]*?)\[\/TIKTOK_CARD\]/);
  if (tiktokMatch && platform === 'tiktok') {
    try {
      const d = JSON.parse(tiktokMatch[1]);
      return {
        title: d.title || 'TikTok Video',
        author: d.author ? `@${d.author}` : undefined,
        thumbnail: d.thumbnail || undefined,
        platform: 'tiktok',
        url,
        siteName: 'TikTok',
      };
    } catch {}
  }

  // Extract from inline text patterns (AI sometimes describes OG metadata)
  const thumbMatch = content.match(/Thumbnail:\s*(https?:\/\/[^\s\n]+)/i);
  const titleMatch = content.match(/Title:\s*([^\n]+)/i);
  const authorMatch = content.match(/(?:Creator|Channel|Author|By|@):\s*([^\n]+)/i);
  const descMatch = content.match(/Description:\s*([^\n]+)/i);
  const siteMatch = content.match(/(?:Site|Platform):\s*([^\n]+)/i);

  if (titleMatch || thumbMatch) {
    return {
      title: titleMatch ? titleMatch[1].trim() : url,
      description: descMatch ? descMatch[1].trim().slice(0, 120) : undefined,
      thumbnail: thumbMatch ? thumbMatch[1].trim() : undefined,
      author: authorMatch ? authorMatch[1].trim().replace(/^@/, '@') : undefined,
      siteName: siteMatch ? siteMatch[1].trim() : PLATFORM_CONFIG[platform].label,
      platform,
      url,
    };
  }
  return null;
}

// ── Helper: extract first URL from text ───────────────────────────────────────
export function extractFirstUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s"'<>]+/i);
  return match ? match[0] : null;
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 5,
  },
  platformBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  platformLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  thumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbnailIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -24,
    marginTop: -24,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  urlChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 4,
    maxWidth: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  urlChipIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
