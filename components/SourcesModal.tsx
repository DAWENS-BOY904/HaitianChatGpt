import React, { useState, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { useTheme } from '../hooks/useTheme';
import { Spacing, BorderRadius, Typography } from '../constants/theme';
import { WebViewModal } from './WebViewModal';

export interface Source {
  title: string;
  url: string;
  snippet?: string;
  favicon?: string;
  date?: string;
  domain?: string;
}

interface SourcesButtonProps {
  sources: Source[];
}

interface SourcesModalProps {
  visible: boolean;
  sources: Source[];
  onClose: () => void;
}

function getDomain(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace('www.', '');
  } catch {
    return url.slice(0, 30);
  }
}

function getFaviconUrl(url: string): string {
  try {
    const u = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=64`;
  } catch {
    return '';
  }
}

// Generate a deterministic tint color per domain for the favicon badge
function getDomainTint(domain: string): string {
  const palette = [
    '#FF6B6B', '#FF9F43', '#FECA57', '#48DBFB',
    '#1DD1A1', '#54A0FF', '#5F27CD', '#EE5A24',
    '#009432', '#0652DD',
  ];
  let hash = 0;
  for (let i = 0; i < domain.length; i++) hash = (hash * 31 + domain.charCodeAt(i)) & 0xffffff;
  return palette[Math.abs(hash) % palette.length];
}

// ── Full-screen sources list modal ──
export const SourcesListModal = memo(function SourcesListModal({
  visible,
  sources,
  onClose,
}: SourcesModalProps) {
  const { colors, isDark } = useTheme();
  const [selectedUrl, setSelectedUrl] = useState('');
  const [webViewVisible, setWebViewVisible] = useState(false);

  const renderSource = ({ item, index }: { item: Source; index: number }) => {
    const domain = item.domain || getDomain(item.url);
    const faviconUrl = item.favicon || getFaviconUrl(item.url);
    const tint = getDomainTint(domain);

    return (
      <TouchableOpacity
        style={[
          styles.card,
          {
            backgroundColor: isDark ? 'rgba(28,28,32,0.92)' : 'rgba(255,255,255,0.92)',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
            shadowColor: isDark ? '#000' : '#888',
          },
        ]}
        onPress={() => {
          setSelectedUrl(item.url);
          setWebViewVisible(true);
        }}
        activeOpacity={0.75}
      >
        {/* Favicon badge */}
        <View style={[styles.faviconBadge, { backgroundColor: tint + '22', borderColor: tint + '44' }]}>
          {faviconUrl ? (
            <Image
              source={{ uri: faviconUrl }}
              style={styles.faviconImg}
              contentFit="contain"
              transition={150}
            />
          ) : (
            <Ionicons name="globe-outline" size={20} color={tint} />
          )}
        </View>

        {/* Content */}
        <View style={styles.cardContent}>
          <Text style={[styles.cardDomain, { color: tint }]} numberOfLines={1}>
            {domain}
          </Text>
          <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
            {item.title}
          </Text>
          {item.snippet ? (
            <View style={[styles.snippetChip, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }]}>
              <Text style={[styles.snippetText, { color: colors.textSecondary }]} numberOfLines={2}>
                {item.snippet}
              </Text>
            </View>
          ) : null}
          {item.date ? (
            <Text style={[styles.cardDate, { color: colors.textSecondary }]}>{item.date}</Text>
          ) : null}
        </View>

        <Ionicons name="chevron-forward" size={16} color={isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)'} />
      </TouchableOpacity>
    );
  };

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        {/* Blurred background */}
        <View style={[styles.modalRoot, { backgroundColor: isDark ? 'rgba(10,10,12,0.96)' : 'rgba(240,240,245,0.96)' }]}>
          {Platform.OS === 'ios' ? (
            <BlurView
              intensity={isDark ? 80 : 70}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
          ) : null}

          {/* Header */}
          <View style={[styles.header, { borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }]}>
            <View style={[styles.handleBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)' }]} />
            <View style={styles.headerRow}>
              <Ionicons name="globe-outline" size={18} color={colors.primary} style={{ marginRight: 6 }} />
              <Text style={[styles.headerTitle, { color: colors.text }]}>
                Sources{sources.length > 0 ? ` (${sources.length})` : ''}
              </Text>
              <TouchableOpacity
                style={[styles.closeBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }]}
                onPress={onClose}
              >
                <Ionicons name="close" size={16} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>

          <FlatList
            data={sources}
            renderItem={renderSource}
            keyExtractor={(item, i) => `${i}-${item.url}`}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          />
        </View>
      </Modal>

      <WebViewModal
        visible={webViewVisible}
        url={selectedUrl}
        onClose={() => setWebViewVisible(false)}
      />
    </>
  );
});

// ── Inline "Sources" pill shown below an AI message (compact with favicons) ──
export const SourcesButton = memo(function SourcesButton({ sources }: SourcesButtonProps) {
  const { colors, isDark } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);

  if (!sources || sources.length === 0) return null;

  const firstThree = sources.slice(0, 3);

  return (
    <>
      <TouchableOpacity
        style={[styles.pill, { borderColor: colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.75}
      >
        {/* Stacked favicon circles */}
        <View style={styles.faviconStack}>
          {firstThree.map((s, i) => {
            const faviconUrl = s.favicon || getFaviconUrl(s.url);
            const domain = s.domain || getDomain(s.url);
            const tint = getDomainTint(domain);
            return (
              <View
                key={i}
                style={[
                  styles.faviconCircle,
                  { marginLeft: i === 0 ? 0 : -7, zIndex: 3 - i, borderColor: colors.background, backgroundColor: tint + '22' },
                ]}
              >
                {faviconUrl ? (
                  <Image
                    source={{ uri: faviconUrl }}
                    style={{ width: 20, height: 20, borderRadius: 10 }}
                    contentFit="contain"
                  />
                ) : (
                  <Ionicons name="globe-outline" size={11} color={tint} />
                )}
              </View>
            );
          })}
        </View>
        <Text style={[styles.pillText, { color: colors.text }]}>Sources</Text>
        <Ionicons name="chevron-forward" size={11} color={colors.textSecondary} />
      </TouchableOpacity>

      <SourcesListModal
        visible={modalVisible}
        sources={sources}
        onClose={() => setModalVisible(false)}
      />
    </>
  );
});

// ── Parse [SOURCES] blocks from AI response ──
export function parseSources(content: string): { text: string; sources: Source[] } {
  const startTag = '[SOURCES]';
  const endTag = '[/SOURCES]';
  const start = content.indexOf(startTag);
  const end = content.indexOf(endTag);

  if (start === -1 || end === -1) {
    return { text: content, sources: [] };
  }

  const sourcesJson = content.substring(start + startTag.length, end).trim();
  const textBefore = content.substring(0, start).trim();
  const textAfter = content.substring(end + endTag.length).trim();
  const text = [textBefore, textAfter].filter(Boolean).join('\n\n');

  try {
    const sources: Source[] = JSON.parse(sourcesJson);
    return { text, sources };
  } catch {
    return { text: content, sources: [] };
  }
}

const styles = StyleSheet.create({
  // Modal
  modalRoot: {
    flex: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 8 : 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
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
    paddingTop: 14,
    paddingBottom: 36,
  },
  // Card
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  faviconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  faviconImg: {
    width: 28,
    height: 28,
    borderRadius: 6,
  },
  cardContent: {
    flex: 1,
    gap: 4,
  },
  cardDomain: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  snippetChip: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 2,
  },
  snippetText: {
    fontSize: 12,
    lineHeight: 17,
  },
  cardDate: {
    fontSize: 11,
    marginTop: 2,
  },
  // Pill
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 5,
    marginTop: 6,
    marginBottom: 2,
  },
  faviconStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  faviconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pillText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
