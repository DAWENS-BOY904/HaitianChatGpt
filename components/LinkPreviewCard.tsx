/**
 * LinkPreviewCard — rich preview card for URLs detected in chat.
 * Supports: TikTok, YouTube, Instagram, Facebook, Twitter/X, generic websites.
 * Usage: <LinkPreviewCard url="https://..." isDark={isDark} colors={colors} />
 */
import React, { useState, useEffect, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

// ── Platform detection ────────────────────────────────────────────────────────
export type LinkPlatform = 'tiktok' | 'youtube' | 'instagram' | 'facebook' | 'twitter' | 'web';

export function detectLinkPlatform(url: string): LinkPlatform {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes('tiktok.com') || host.includes('vm.tiktok.com')) return 'tiktok';
    if (host.includes('youtube.com') || host.includes('youtu.be')) return 'youtube';
    if (host.includes('instagram.com')) return 'instagram';
    if (host.includes('facebook.com') || host.includes('fb.com') || host.includes('fb.watch')) return 'facebook';
    if (host.includes('twitter.com') || host.includes('x.com')) return 'twitter';
  } catch (_e) {}
  return 'web';
}

// ── Platform config (icon, color, label) ────────────────────────────────────
const PLATFORM_CONFIG: Record<LinkPlatform, { label: string; color: string; bgColor: string; iconName: string }> = {
  tiktok: { label: 'TikTok', color: '#FFFFFF', bgColor: '#010101', iconName: 'logo-tiktok' },
  youtube: { label: 'YouTube', color: '#FFFFFF', bgColor: '#FF0000', iconName: 'logo-youtube' },
  instagram: { label: 'Instagram', color: '#FFFFFF', bgColor: '#E1306C', iconName: 'logo-instagram' },
  facebook: { label: 'Facebook', color: '#FFFFFF', bgColor: '#1877F2', iconName: 'logo-facebook' },
  twitter: { label: 'Twitter / X', color: '#FFFFFF', bgColor: '#000000', iconName: 'logo-twitter' },
  web: { label: 'Open Link', color: '#FFFFFF', bgColor: '#007AFF', iconName: 'globe-outline' },
};

// ── Open URL helper ───────────────────────────────────────────────────────────
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

// ── Minimal metadata extractor (client-side, best-effort) ─────────────────────
// Most metadata comes from the edge function (AI response context), so this
// is only used as a fallback when the edge function hasn't provided data.
function buildFallbackMetadata(url: string): LinkMetadata {
  const platform = detectLinkPlatform(url);
  let domain = '';
  try { domain = new URL(url).hostname.replace('www.', ''); } catch {}
  const platformConfig = PLATFORM_CONFIG[platform];
  return {
    title: domain || url,
    description: 'Tap to open this link',
    siteName: platformConfig.label,
    platform,
    url,
    thumbnail: undefined,
    author: undefined,
  };
}

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

// ── Thumbnail placeholder ──────────────────────────────────────────────────────
const ThumbnailPlaceholder = memo(function ThumbnailPlaceholder({
  platform, isDark,
}: { platform: LinkPlatform; isDark: boolean }) {
  const cfg = PLATFORM_CONFIG[platform];
  return (
    <View style={[styles.thumbnailPlaceholder, { backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA' }]}>
      <View style={[styles.thumbnailIcon, { backgroundColor: cfg.bgColor }]}>
        <Ionicons name={cfg.iconName as any} size={28} color={cfg.color} />
      </View>
    </View>
  );
});

// ── Main LinkPreviewCard ───────────────────────────────────────────────────────
interface LinkPreviewCardProps {
  url: string;
  metadata?: LinkMetadata | null;
  isDark: boolean;
  colors: any;
  compact?: boolean; // smaller card for user bubbles
}

export const LinkPreviewCard = memo(function LinkPreviewCard({
  url,
  metadata,
  isDark,
  colors,
  compact = false,
}: LinkPreviewCardProps) {
  const [imgError, setImgError] = useState(false);
  const platform = detectLinkPlatform(url);
  const cfg = PLATFORM_CONFIG[platform];

  // Use provided metadata or fallback
  const meta: LinkMetadata = metadata || buildFallbackMetadata(url);

  const cardBg = isDark ? '#1C1C1E' : '#F8F8FA';
  const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  const textColor = isDark ? '#FFFFFF' : '#000000';
  const subColor = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)';
  const thumbnailH = compact ? 120 : 160;
  const cardW = compact ? 260 : '100%' as any;

  const hasThumbnail = !!(meta.thumbnail && !imgError);

  return (
    <TouchableOpacity
      onPress={() => openUrl(url)}
      activeOpacity={0.88}
      style={[
        styles.card,
        {
          backgroundColor: cardBg,
          borderColor,
          width: cardW,
          alignSelf: 'flex-start',
          marginVertical: 6,
        },
      ]}
    >
      {/* Thumbnail area */}
      <View style={{ width: '100%', height: thumbnailH, overflow: 'hidden', borderTopLeftRadius: 16, borderTopRightRadius: 16, position: 'relative' }}>
        {hasThumbnail ? (
          <Image
            source={{ uri: meta.thumbnail }}
            style={{ width: '100%', height: thumbnailH }}
            contentFit="cover"
            transition={200}
            onError={() => setImgError(true)}
          />
        ) : (
          <ThumbnailPlaceholder platform={platform} isDark={isDark} />
        )}
        {/* Platform badge top-left */}
        <View style={{ position: 'absolute', top: 8, left: 8 }}>
          <PlatformBadge platform={platform} />
        </View>
        {/* Play button for video platforms */}
        {(platform === 'tiktok' || platform === 'youtube') && (
          <View style={styles.playBtn}>
            <Ionicons name="play" size={20} color="#FFF" style={{ marginLeft: 2 }} />
          </View>
        )}
      </View>

      {/* Info */}
      <View style={{ padding: 12, gap: 3 }}>
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
        {/* Author / footer */}
        <View style={styles.footer}>
          {meta.author ? (
            <View style={styles.authorRow}>
              <Ionicons name="person-circle-outline" size={13} color={subColor} />
              <Text style={{ color: subColor, fontSize: 11 }} numberOfLines={1}>
                {meta.author}
              </Text>
            </View>
          ) : (
            <Text style={{ color: subColor, fontSize: 11 }} numberOfLines={1}>
              {meta.siteName || cfg.label}
            </Text>
          )}
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
  let display = url;
  try {
    const u = new URL(url);
    display = u.hostname.replace('www.', '') + (u.pathname.length > 1 ? u.pathname.slice(0, 24) : '');
  } catch {}

  return (
    <TouchableOpacity
      onPress={() => openUrl(url)}
      activeOpacity={0.75}
      style={[
        styles.urlChip,
        {
          backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
          borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.1)',
        },
      ]}
    >
      <View style={[styles.urlChipIcon, { backgroundColor: cfg.bgColor }]}>
        <Ionicons name={cfg.iconName as any} size={11} color={cfg.color} />
      </View>
      <Text
        style={{ color: colors.primary || '#007AFF', fontSize: 12, fontWeight: '500', flex: 1 }}
        numberOfLines={1}
      >
        {display}
      </Text>
      <Ionicons name="open-outline" size={12} color={colors.textSecondary} />
    </TouchableOpacity>
  );
});

// ── Parse URL metadata from AI response content ────────────────────────────────
// The edge function injects URL content into the system context; the AI response
// sometimes echoes the metadata. This utility extracts it from raw content.
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

  // Extract thumbnail from content (image URL mentioned)
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

// ── Helper to extract first URL from text ─────────────────────────────────────
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -22,
    marginTop: -22,
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
    gap: 4,
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
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 4,
    maxWidth: 280,
  },
  urlChipIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});