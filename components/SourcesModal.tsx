import React, { useState, useCallback, useMemo, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  Platform,
  Dimensions,
  Animated,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { useTheme } from '../hooks/useTheme';
import { Spacing, BorderRadius, Typography } from '../constants/theme';
import { WebViewModal } from './WebViewModal';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

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

// ── Helpers ──
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
    return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=128`;
  } catch {
    return '';
  }
}

function getDomainTint(domain: string): string {
  const palette = [
    '#FF6B6B', '#FF9F43', '#FECA57', '#48DBFB',
    '#1DD1A1', '#54A0FF', '#5F27CD', '#EE5A24',
    '#009432', '#0652DD', '#9980FA', '#FDA7DF',
  ];
  let hash = 0;
  for (let i = 0; i < domain.length; i++) hash = (hash * 31 + domain.charCodeAt(i)) & 0xffffff;
  return palette[Math.abs(hash) % palette.length];
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

// ── Source Card Item ──
const SourceCard = memo(function SourceCard({
  item,
  onPress,
  isDark,
  colors,
}: {
  item: Source;
  onPress: () => void;
  isDark: boolean;
  colors: any;
}) {
  const domain = item.domain || getDomain(item.url);
  const faviconUrl = item.favicon || getFaviconUrl(item.url);
  const tint = getDomainTint(domain);
  const formattedDate = formatDate(item.date);

  const scaleAnim = useMemo(() => new Animated.Value(1), []);

  const onPressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      friction: 8,
    }).start();
  }, [scaleAnim]);

  const onPressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 5,
    }).start();
  }, [scaleAnim]);

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[
          cardStyles.card,
          {
            backgroundColor: isDark ? 'rgba(35,35,42,0.95)' : 'rgba(255,255,255,0.95)',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            shadowColor: isDark ? '#000' : '#888',
          },
        ]}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={0.85}
      >
        {/* Favicon */}
        <View style={[cardStyles.faviconBadge, { backgroundColor: tint + '18', borderColor: tint + '35' }]}>
          {faviconUrl ? (
            <Image
              source={{ uri: faviconUrl }}
              style={cardStyles.faviconImg}
              contentFit="contain"
              transition={200}
              cachePolicy="memory-disk"
            />
          ) : (
            <Ionicons name="globe-outline" size={22} color={tint} />
          )}
        </View>

        {/* Content */}
        <View style={cardStyles.cardContent}>
          <View style={cardStyles.domainRow}>
            <Text style={[cardStyles.cardDomain, { color: tint }]} numberOfLines={1}>
              {domain}
            </Text>
            {formattedDate ? (
              <Text style={[cardStyles.cardDate, { color: colors.textSecondary }]}>
                {formattedDate}
              </Text>
            ) : null}
          </View>

          <Text style={[cardStyles.cardTitle, { color: colors.text }]} numberOfLines={2}>
            {item.title}
          </Text>

          {item.snippet ? (
            <View style={[cardStyles.snippetChip, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}>
              <Text style={[cardStyles.snippetText, { color: colors.textSecondary }]} numberOfLines={2}>
                {item.snippet}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={[cardStyles.arrowBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}>
          <Ionicons name="arrow-up-forward" size={14} color={colors.textSecondary} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

const cardStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  faviconBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  faviconImg: {
    width: 30,
    height: 30,
  },
  cardContent: {
    flex: 1,
    gap: 5,
  },
  domainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardDomain: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  cardDate: {
    fontSize: 10,
    fontWeight: '500',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  snippetChip: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 2,
  },
  snippetText: {
    fontSize: 12,
    lineHeight: 17,
  },
  arrowBadge: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
});

// ── Sources List Modal ──
export const SourcesListModal = memo(function SourcesListModal({
  visible,
  sources,
  onClose,
}: SourcesModalProps) {
  const { colors, isDark } = useTheme();
  const [selectedUrl, setSelectedUrl] = useState('');
  const [webViewVisible, setWebViewVisible] = useState(false);
  const translateY = useMemo(() => new Animated.Value(SCREEN_HEIGHT), []);
  const opacity = useMemo(() => new Animated.Value(0), []);

  // Animate in/out
  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          friction: 9,
          tension: 50,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: SCREEN_HEIGHT,
          useNativeDriver: true,
          friction: 9,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, translateY, opacity]);

  const handleOpenUrl = useCallback((url: string) => {
    setSelectedUrl(url);
    setWebViewVisible(true);
  }, []);

  const handleCloseWebView = useCallback(() => {
    setWebViewVisible(false);
    setSelectedUrl('');
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: Source }) => (
      <SourceCard
        item={item}
        onPress={() => handleOpenUrl(item.url)}
        isDark={isDark}
        colors={colors}
      />
    ),
    [isDark, colors, handleOpenUrl]
  );

  const keyExtractor = useCallback((item: Source, index: number) => `${index}-${item.url}`, []);

  const ListEmptyComponent = useCallback(
    () => (
      <View style={styles.emptyContainer}>
        <Ionicons name="document-text-outline" size={48} color={colors.textSecondary} />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No sources available
        </Text>
      </View>
    ),
    [colors.textSecondary]
  );

  const ListHeaderComponent = useCallback(
    () => (
      <View style={styles.header}>
        <View style={[styles.handleBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)' }]} />
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <View style={[styles.headerIcon, { backgroundColor: colors.primary + '15' }]}>
              <Ionicons name="link" size={16} color={colors.primary} />
            </View>
            <View>
              <Text style={[styles.headerTitle, { color: colors.text }]}>
                Sources
              </Text>
              <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                {sources.length} {sources.length === 1 ? 'reference' : 'references'} found
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.closeBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }]}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={16} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>
    ),
    [isDark, colors, sources.length, onClose]
  );

  if (!visible && !webViewVisible) return null;

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={onClose}
      >
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />

        <Animated.View style={[styles.backdrop, { opacity }]}>
          <BlurView
            intensity={isDark ? 70 : 50}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: isDark ? 'rgba(18,18,22,0.98)' : 'rgba(245,245,248,0.98)',
              transform: [{ translateY }],
            },
          ]}
        >
          {Platform.OS === 'ios' && (
            <BlurView
              intensity={isDark ? 20 : 15}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
          )}

          <FlatList
            data={sources}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={ListHeaderComponent}
            ListEmptyComponent={ListEmptyComponent}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          />
        </Animated.View>
      </Modal>

      {/* WebView opens INSIDE the app - never Safari */}
      <WebViewModal
        visible={webViewVisible}
        url={selectedUrl}
        onClose={handleCloseWebView}
      />
    </>
  );
});

// ── Sources Button (Pill) ──
export const SourcesButton = memo(function SourcesButton({ sources }: SourcesButtonProps) {
  const { colors, isDark } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);

  if (!sources || sources.length === 0) return null;

  const firstThree = sources.slice(0, 3);

  return (
    <>
      <TouchableOpacity
        style={[
          pillStyles.pill,
          {
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
          },
        ]}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.75}
      >
        <View style={pillStyles.faviconStack}>
          {firstThree.map((s, i) => {
            const faviconUrl = s.favicon || getFaviconUrl(s.url);
            const domain = s.domain || getDomain(s.url);
            const tint = getDomainTint(domain);
            return (
              <View
                key={i}
                style={[
                  pillStyles.faviconCircle,
                  {
                    marginLeft: i === 0 ? 0 : -8,
                    zIndex: 3 - i,
                    borderColor: colors.background,
                    backgroundColor: tint + '20',
                  },
                ]}
              >
                {faviconUrl ? (
                  <Image
                    source={{ uri: faviconUrl }}
                    style={{ width: 18, height: 18 }}
                    contentFit="contain"
                    cachePolicy="memory"
                  />
                ) : (
                  <Ionicons name="globe-outline" size={10} color={tint} />
                )}
              </View>
            );
          })}
        </View>

        <Text style={[pillStyles.pillText, { color: colors.text }]}>
          {sources.length} {sources.length === 1 ? 'Source' : 'Sources'}
        </Text>

        <Ionicons name="chevron-forward" size={12} color={colors.textSecondary} />
      </TouchableOpacity>

      <SourcesListModal
        visible={modalVisible}
        sources={sources}
        onClose={() => setModalVisible(false)}
      />
    </>
  );
});

const pillStyles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
    marginTop: 8,
    marginBottom: 2,
  },
  faviconStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  faviconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pillText: {
    fontSize: 13,
    fontWeight: '500',
  },
});

// ── Parse [SOURCES] blocks ──
// Alias so MessageItem can import SourcesModal by name
export const SourcesModal = SourcesListModal;

export function parseSources(content: string): { text: string; sources: Source[] } {
  const startTag = '[SOURCES]';
  const endTag = '[/SOURCES]';
  const start = content.indexOf(startTag);
  const end = content.indexOf(endTag);

  if (start === -1 || end === -1 || end <= start) {
    return { text: content, sources: [] };
  }

  const sourcesJson = content.substring(start + startTag.length, end).trim();
  const textBefore = content.substring(0, start).trim();
  const textAfter = content.substring(end + endTag.length).trim();
  const text = [textBefore, textAfter].filter(Boolean).join('\\n\\n');

  try {
    const sources: Source[] = JSON.parse(sourcesJson);
    if (!Array.isArray(sources)) return { text: content, sources: [] };
    return { text, sources };
  } catch {
    return { text: content, sources: [] };
  }
}

// ── Styles ──
const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '88%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 10 : 16,
    paddingBottom: 12,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 14,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
