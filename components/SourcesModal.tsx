import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Platform,
  ScrollView,
  Linking,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';

export interface Source {
  title: string;
  url: string;
  snippet?: string;
  domain?: string;
}

interface SourcesModalProps {
  visible: boolean;
  onClose: () => void;
  sources: Source[];
}

function getFaviconUrl(url: string): string {
  try {
    const { hostname } = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
  } catch {
    return '';
  }
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function SourcesModal({ visible, onClose, sources }: SourcesModalProps) {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const textC = isDark ? '#FFFFFF' : '#000000';
  const subC = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';

  const handleOpen = (url: string) => {
    Linking.openURL(url).catch(() => {});
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {Platform.OS === 'ios' ? (
          <BlurView
            intensity={isDark ? 30 : 20}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)' }]} />
        )}
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />

        <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          {Platform.OS === 'ios' ? (
            <BlurView
              intensity={isDark ? 90 : 80}
              tint={isDark ? 'dark' : 'extraLight'}
              style={styles.sheetBlur}
            >
              <SheetContent
                sources={sources}
                textC={textC}
                subC={subC}
                isDark={isDark}
                onOpen={handleOpen}
                onClose={onClose}
              />
            </BlurView>
          ) : (
            <View style={[styles.sheetBlur, { backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' }]}>
              <SheetContent
                sources={sources}
                textC={textC}
                subC={subC}
                isDark={isDark}
                onOpen={handleOpen}
                onClose={onClose}
              />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

// Legacy alias
export { SourcesModal as SourcesListModal };

function SheetContent({
  sources, textC, subC, isDark, onOpen, onClose,
}: {
  sources: Source[];
  textC: string;
  subC: string;
  isDark: boolean;
  onOpen: (url: string) => void;
  onClose: () => void;
}) {
  return (
    <View style={styles.inner}>
      {/* Handle */}
      <View style={[styles.handle, { backgroundColor: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.18)' }]} />

      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={[styles.headerTitle, { color: textC }]}>Sources</Text>
        <TouchableOpacity
          onPress={onClose}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={[styles.closeBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)' }]}
        >
          <Ionicons name="close" size={16} color={textC} />
        </TouchableOpacity>
      </View>

      {sources.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="document-text-outline" size={36} color={subC} />
          <Text style={[styles.emptyText, { color: subC }]}>No sources available</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          style={{ maxHeight: 440 }}
        >
          {sources.map((source, i) => {
            const faviconUrl = getFaviconUrl(source.url);
            const domain = source.domain || getDomain(source.url);
            return (
              <TouchableOpacity
                key={`source-${i}`}
                style={[
                  styles.sourceRow,
                  { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
                ]}
                onPress={() => onOpen(source.url)}
                activeOpacity={0.72}
              >
                {/* Favicon */}
                <View style={[styles.faviconWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)' }]}>
                  {faviconUrl ? (
                    <Image
                      source={{ uri: faviconUrl }}
                      style={styles.favicon}
                      contentFit="contain"
                      transition={120}
                    />
                  ) : (
                    <Ionicons name="globe-outline" size={16} color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)'} />
                  )}
                </View>

                {/* Text */}
                <View style={styles.sourceTextWrap}>
                  <Text style={[styles.sourceTitle, { color: textC }]} numberOfLines={2}>
                    {source.title || domain}
                  </Text>
                  <Text style={[styles.sourceDomain, { color: subC }]} numberOfLines={1}>
                    {domain}
                  </Text>
                  {source.snippet ? (
                    <Text style={[styles.sourceSnippet, { color: subC }]} numberOfLines={2}>
                      {source.snippet}
                    </Text>
                  ) : null}
                </View>

                <Ionicons name="open-outline" size={16} color={subC} style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

// ── Inline sources pill rendered inside chat messages ─────────────────────────
interface InlineSourcesPillProps {
  sources: Source[];
  onPress: () => void;
  isDark: boolean;
}

export function InlineSourcesPill({ sources, onPress, isDark }: InlineSourcesPillProps) {
  if (!sources || sources.length === 0) return null;

  const favicons = sources.slice(0, 3).map(s => getFaviconUrl(s.url)).filter(Boolean);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.78}
      style={[
        pillStyles.pill,
        {
          backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.09)',
        },
      ]}
    >
      <View style={pillStyles.faviconRow}>
        {favicons.map((uri, i) => (
          <View
            key={i}
            style={[
              pillStyles.faviconCircle,
              {
                marginLeft: i > 0 ? -6 : 0,
                backgroundColor: isDark ? '#3A3A3C' : '#E5E5EA',
                zIndex: favicons.length - i,
              },
            ]}
          >
            <Image source={{ uri }} style={pillStyles.pillFavicon} contentFit="contain" transition={100} />
          </View>
        ))}
      </View>
      <Text style={[pillStyles.label, { color: isDark ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.65)' }]}>
        {sources.length} {sources.length === 1 ? 'source' : 'sources'}
      </Text>
      <Ionicons name="chevron-forward" size={13} color={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)'} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  sheetBlur: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  inner: {
    paddingTop: 10,
    paddingHorizontal: 0,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 14,
    paddingBottom: 8,
    gap: 8,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  faviconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
  },
  favicon: {
    width: 22,
    height: 22,
    borderRadius: 4,
  },
  sourceTextWrap: {
    flex: 1,
    gap: 2,
  },
  sourceTitle: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  sourceDomain: {
    fontSize: 12,
    fontWeight: '400',
  },
  sourceSnippet: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  emptyText: {
    fontSize: 15,
  },
});

const pillStyles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
    marginTop: 8,
    marginBottom: 4,
  },
  faviconRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  faviconCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  pillFavicon: {
    width: 14,
    height: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
  },
});
