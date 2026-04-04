import React, { useState, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
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
    const isFirst = index === 0;

    return (
      <TouchableOpacity
        style={[
          styles.sourceItem,
          { borderBottomColor: colors.border },
          isFirst && styles.sourceItemFirst,
        ]}
        onPress={() => {
          setSelectedUrl(item.url);
          setWebViewVisible(true);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.sourceIconWrap}>
          {faviconUrl ? (
            <Image
              source={{ uri: faviconUrl }}
              style={styles.favicon}
              contentFit="contain"
              transition={150}
            />
          ) : (
            <View style={[styles.favicon, { backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons name="globe-outline" size={16} color={colors.textSecondary} />
            </View>
          )}
        </View>

        <View style={styles.sourceContent}>
          <Text style={[styles.sourceDomain, { color: colors.textSecondary }]} numberOfLines={1}>
            {domain}
          </Text>
          <Text style={[styles.sourceTitle, { color: colors.text }]} numberOfLines={2}>
            {item.title}
          </Text>
          {item.snippet ? (
            <Text style={[styles.sourceSnippet, { color: colors.textSecondary }]} numberOfLines={2}>
              {item.snippet}
            </Text>
          ) : null}
          {item.date ? (
            <Text style={[styles.sourceDate, { color: colors.textSecondary }]}>
              {item.date}
            </Text>
          ) : null}
        </View>

        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
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
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Sources</Text>
            <TouchableOpacity
              style={[styles.closeBtn, { backgroundColor: colors.surface }]}
              onPress={onClose}
            >
              <Ionicons name="close" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={sources}
            renderItem={renderSource}
            keyExtractor={(item, i) => `${i}-${item.url}`}
            contentContainerStyle={{ paddingBottom: 32 }}
            showsVerticalScrollIndicator={false}
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

// ── Inline "Sources" pill shown below an AI message ──
export const SourcesButton = memo(function SourcesButton({ sources }: SourcesButtonProps) {
  const { colors } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);

  if (!sources || sources.length === 0) return null;

  return (
    <>
      <TouchableOpacity
        style={[styles.pill, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.75}
      >
        <View style={styles.pillIcon}>
          <Ionicons name="search-circle" size={18} color="#0084FF" />
        </View>
        <Text style={[styles.pillText, { color: colors.text }]}>Sources</Text>
        <View style={[styles.pillBadge, { backgroundColor: '#0084FF' }]}>
          <Text style={styles.pillBadgeText}>{sources.length}</Text>
        </View>
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
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
    marginTop: 6,
    marginBottom: 2,
  },
  pillIcon: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: {
    fontSize: 14,
    fontWeight: '500',
  },
  pillBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  pillBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  // Modal
  modalContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 16 : 24,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    position: 'relative',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  closeBtn: {
    position: 'absolute',
    right: 16,
    top: Platform.OS === 'ios' ? 14 : 22,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  sourceItemFirst: {
    marginTop: 8,
  },
  sourceIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    overflow: 'hidden',
  },
  favicon: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  sourceContent: {
    flex: 1,
    gap: 2,
  },
  sourceDomain: {
    fontSize: 12,
    fontWeight: '500',
  },
  sourceTitle: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
  },
  sourceSnippet: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  sourceDate: {
    fontSize: 11,
    marginTop: 3,
  },
});
