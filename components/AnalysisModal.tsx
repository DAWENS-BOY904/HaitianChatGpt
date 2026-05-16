import React, { memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { BorderRadius, Spacing } from '../constants/theme';
import { CodeBlock } from './CodeBlock';

interface AnalysisEntry {
  label: string;        // e.g. "Python Code"
  code: string;
  language: string;
}

interface AnalysisModalProps {
  visible: boolean;
  onClose: () => void;
  entries: AnalysisEntry[];
  title?: string;
}

export const AnalysisModal = memo(function AnalysisModal({
  visible,
  onClose,
  entries,
  title = 'Analysis',
}: AnalysisModalProps) {
  const { colors } = useTheme();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <TouchableOpacity
            style={[styles.closeBtn, { backgroundColor: colors.surface }]}
            onPress={onClose}
          >
            <Ionicons name="close" size={18} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: Spacing.md, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
        >
          {entries.map((entry, i) => (
            <View key={i} style={{ marginBottom: Spacing.md }}>
              <Text style={[styles.entryLabel, { color: colors.textSecondary }]}>
                {entry.label}
              </Text>
              <CodeBlock code={entry.code} language={entry.language} />
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
});

// ── Terminal button shown in assistant message actions bar ──
interface TerminalButtonProps {
  onPress: () => void;
}

export const TerminalButton = memo(function TerminalButton({ onPress }: TerminalButtonProps) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[styles.terminalBtn, { backgroundColor: colors.background }]}
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons name="terminal" size={14} color={colors.text} />
    </TouchableOpacity>
  );
});

// ── Extract [ANALYSIS] blocks from AI content ──
export function parseAnalysis(content: string): {
  text: string;
  entries: AnalysisEntry[];
} {
  const startTag = '[ANALYSIS]';
  const endTag = '[/ANALYSIS]';
  const start = content.indexOf(startTag);
  const end = content.indexOf(endTag);

  if (start === -1 || end === -1) return { text: content, entries: [] };

  const jsonStr = content.substring(start + startTag.length, end).trim();
  const textBefore = content.substring(0, start).trim();
  const textAfter = content.substring(end + endTag.length).trim();
  const text = [textBefore, textAfter].filter(Boolean).join('\n\n');

  try {
    const entries: AnalysisEntry[] = JSON.parse(jsonStr);
    return { text, entries };
  } catch {
    return { text: content, entries: [] };
  }
}

const styles = StyleSheet.create({
  container: {
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
  title: {
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
  entryLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginLeft: 4,
  },
  terminalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
  },
});
