import React, { useState, memo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Modal,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { WebView } from 'react-native-webview';
import { BorderRadius } from '../constants/theme';

interface CodeBlockProps {
  code: string;
  language?: string;
  /** If provided, the preview tab renders this HTML string instead of code */
  previewHtml?: string;
  /** file name shown in header */
  fileName?: string;
  /** Optional API version badge e.g. "Stripe v2025-03-31" */
  apiVersion?: string;
}

/* ────────────── DRACULA PALETTE ────────────── */
const D = {
  bg:          '#282A36',
  header:      '#21222C',
  border:      '#44475A',
  keyword:     '#FF79C6',
  string:      '#F1FA8C',
  comment:     '#6272A4',
  number:      '#BD93F9',
  operator:    '#FF79C6',
  tag:         '#FF5555',
  attr:        '#50FA7B',
  attrVal:     '#F1FA8C',
  type:        '#8BE9FD',
  plain:       '#F8F8F2',
  lineNum:     '#6272A4',
  purple:      '#BD93F9',
  placeholder: '#FFB86C',   // orange for API key placeholders
  placeholderBg: 'rgba(255,184,108,0.15)',
};

/* ────────────── PLACEHOLDER PATTERNS ────────────── */
const PLACEHOLDER_PATTERNS = [
  /\bYOUR_API_KEY\b/g,
  /\bYOUR_SECRET_KEY\b/g,
  /\bYOUR_PUBLIC_KEY\b/g,
  /\bAPI_KEY_HERE\b/g,
  /\bSECRET_KEY_HERE\b/g,
  /\bYOUR_TOKEN\b/g,
  /\bYOUR_ACCESS_TOKEN\b/g,
  /\bINSERT_API_KEY\b/g,
  /\bPUT_YOUR_KEY_HERE\b/g,
  /\bYOUR_OPENAI_KEY\b/g,
  /\bYOUR_STRIPE_KEY\b/g,
  /sk_test_[A-Za-z0-9]{4,}/g,
  /sk_live_[A-Za-z0-9]{4,}/g,
  /rk_test_[A-Za-z0-9]{4,}/g,
  /pk_test_[A-Za-z0-9]{4,}/g,
  /re_[A-Za-z0-9]{4,}/g,
];

function isPlaceholder(text: string): boolean {
  return PLACEHOLDER_PATTERNS.some(re => { re.lastIndex = 0; return re.test(text); });
}

/* ────────────── TOKENISER ────────────── */
type Token = { text: string; color: string; isPlaceholder?: boolean };

function tokenize(line: string, lang: string): Token[] {
  const l = (lang || '').toLowerCase();

  // Helper: wrap tokens through placeholder detection
  function checkPlaceholders(tokens: Token[]): Token[] {
    const result: Token[] = [];
    for (const token of tokens) {
      // Split on placeholder patterns
      let remaining = token.text;
      let lastIdx = 0;
      const combined = new RegExp(PLACEHOLDER_PATTERNS.map(r => r.source).join('|'), 'g');
      let m: RegExpExecArray | null;
      const parts: Token[] = [];
      while ((m = combined.exec(remaining)) !== null) {
        if (m.index > lastIdx) {
          parts.push({ text: remaining.slice(lastIdx, m.index), color: token.color });
        }
        parts.push({ text: m[0], color: D.placeholder, isPlaceholder: true });
        lastIdx = combined.lastIndex;
      }
      if (lastIdx < remaining.length) {
        parts.push({ text: remaining.slice(lastIdx), color: token.color });
      }
      result.push(...(parts.length > 0 ? parts : [token]));
    }
    return result;
  }

  if (['html', 'xml'].includes(l)) {
    const tokens: Token[] = [];
    const re = /(<!--[\s\S]*?-->)|(<\/?[\w-]+)(\/?>)?|(\s[\w-:]+)(\s*=\s*)("[^"]*"|'[^']*')/g;
    let last = 0, m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      if (m.index > last) tokens.push({ text: line.slice(last, m.index), color: D.plain });
      if (m[1]) tokens.push({ text: m[1], color: D.comment });
      else {
        if (m[2]) tokens.push({ text: m[2], color: D.tag });
        if (m[3]) tokens.push({ text: m[3], color: D.tag });
        if (m[4]) tokens.push({ text: m[4], color: D.attr });
        if (m[5]) tokens.push({ text: m[5], color: D.plain });
        if (m[6]) tokens.push({ text: m[6], color: D.attrVal });
      }
      last = re.lastIndex;
    }
    if (last < line.length) tokens.push({ text: line.slice(last), color: D.plain });
    return checkPlaceholders(tokens);
  }

  if (['js','ts','tsx','jsx','javascript','typescript'].includes(l)) {
    const tokens: Token[] = [];
    const re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`[^`]*`)|(\b(?:const|let|var|function|return|import|export|default|from|if|else|for|while|class|extends|new|typeof|instanceof|async|await|try|catch|finally|throw|of|in|switch|case|break|continue|void|null|undefined|true|false|this|super|type|interface|enum)\b)|(\b[A-Z][a-zA-Z0-9_]*\b)|(\b\d+(?:\.\d+)?\b)/g;
    let last = 0, m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      if (m.index > last) tokens.push({ text: line.slice(last, m.index), color: D.plain });
      if (m[1])      tokens.push({ text: m[1], color: D.comment });
      else if (m[2]) tokens.push({ text: m[2], color: D.string });
      else if (m[3]) tokens.push({ text: m[3], color: D.keyword });
      else if (m[4]) tokens.push({ text: m[4], color: D.type });
      else if (m[5]) tokens.push({ text: m[5], color: D.number });
      last = re.lastIndex;
    }
    if (last < line.length) tokens.push({ text: line.slice(last), color: D.plain });
    return checkPlaceholders(tokens);
  }

  if (['css','scss'].includes(l)) {
    const tokens: Token[] = [];
    const re = /(\/\*[\s\S]*?\*\/)|([.#]?[\w-]+\s*(?={))|([a-z-]+\s*(?=:))|(\b\d+(?:px|em|rem|%|vh|vw|s|ms)?\b)|("[^"]*"|'[^']*')/g;
    let last = 0, m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      if (m.index > last) tokens.push({ text: line.slice(last, m.index), color: D.plain });
      if (m[1])      tokens.push({ text: m[1], color: D.comment });
      else if (m[2]) tokens.push({ text: m[2], color: D.tag });
      else if (m[3]) tokens.push({ text: m[3], color: D.attr });
      else if (m[4]) tokens.push({ text: m[4], color: D.number });
      else if (m[5]) tokens.push({ text: m[5], color: D.string });
      last = re.lastIndex;
    }
    if (last < line.length) tokens.push({ text: line.slice(last), color: D.plain });
    return checkPlaceholders(tokens);
  }

  if (['python','py'].includes(l)) {
    const tokens: Token[] = [];
    const re = /(#[^\n]*)|("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b(?:def|class|import|from|return|if|elif|else|for|while|in|not|and|or|is|True|False|None|lambda|with|as|try|except|finally|raise|pass|break|continue|yield)\b)|(\b[A-Z][a-zA-Z0-9_]*\b)|(\b\d+(?:\.\d+)?\b)/g;
    let last = 0, m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      if (m.index > last) tokens.push({ text: line.slice(last, m.index), color: D.plain });
      if (m[1])      tokens.push({ text: m[1], color: D.comment });
      else if (m[2]) tokens.push({ text: m[2], color: D.string });
      else if (m[3]) tokens.push({ text: m[3], color: D.keyword });
      else if (m[4]) tokens.push({ text: m[4], color: D.type });
      else if (m[5]) tokens.push({ text: m[5], color: D.number });
      last = re.lastIndex;
    }
    if (last < line.length) tokens.push({ text: line.slice(last), color: D.plain });
    return checkPlaceholders(tokens);
  }

  // Generic fallback — still check placeholders
  return checkPlaceholders([{ text: line, color: D.plain }]);
}

/* ────────────── PLACEHOLDER WARNING BADGE ────────────── */
function hasApiKeyPlaceholders(code: string): boolean {
  return PLACEHOLDER_PATTERNS.some(re => { re.lastIndex = 0; return re.test(code); });
}

/* ────────────── FULL-SCREEN MODAL ────────────── */
interface FullScreenProps {
  visible: boolean;
  code: string;
  language: string;
  previewHtml?: string;
  fileName?: string;
  apiVersion?: string;
  onClose: () => void;
}

const FullScreenModal = memo(function FullScreenModal({
  visible, code, language, previewHtml, fileName, apiVersion, onClose,
}: FullScreenProps) {
  const [tab, setTab] = useState<'code' | 'preview'>('code');
  const [wordWrap, setWordWrap] = useState(false);
  const [copied, setCopied] = useState(false);

  const canPreview = ['html', 'htm'].includes((language || '').toLowerCase()) || Boolean(previewHtml);
  const htmlToPreview = previewHtml || code;
  const hasPlaceholders = hasApiKeyPlaceholders(code);

  const onCopy = async () => {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const rawLines = code.split('\n');

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[fsStyles.container]}>
        {/* Header */}
        <View style={fsStyles.header}>
          <TouchableOpacity onPress={onClose} style={fsStyles.iconBtn}>
            <Ionicons name="close" size={22} color="#FFF" />
          </TouchableOpacity>

          <Text style={fsStyles.fileName} numberOfLines={1}>
            {fileName || language || 'code'}
          </Text>

          <View style={fsStyles.headerRight}>
            <TouchableOpacity style={fsStyles.iconBtn} onPress={() => {}}>
              <Ionicons name="expand-outline" size={18} color="#AAA" />
            </TouchableOpacity>

            <TouchableOpacity style={fsStyles.iconBtn} onPress={onCopy}>
              <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={18} color={copied ? '#50FA7B' : '#AAA'} />
            </TouchableOpacity>

            {tab === 'code' && (
              <TouchableOpacity
                style={[fsStyles.iconBtn, wordWrap && { backgroundColor: '#44475A' }]}
                onPress={() => setWordWrap(w => !w)}
              >
                <Ionicons name="return-down-forward-outline" size={18} color={wordWrap ? '#BD93F9' : '#AAA'} />
              </TouchableOpacity>
            )}

            {canPreview && (
              <View style={fsStyles.tabs}>
                <TouchableOpacity
                  style={[fsStyles.tab, tab === 'code' && fsStyles.tabActive]}
                  onPress={() => setTab('code')}
                >
                  <Text style={[fsStyles.tabText, tab === 'code' && fsStyles.tabTextActive]}>Code</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[fsStyles.tab, tab === 'preview' && fsStyles.tabActive]}
                  onPress={() => setTab('preview')}
                >
                  <Text style={[fsStyles.tabText, tab === 'preview' && fsStyles.tabTextActive]}>Preview</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* API version badge */}
        {apiVersion ? (
          <View style={fsStyles.apiBadgeRow}>
            <View style={fsStyles.apiBadge}>
              <Ionicons name="cube-outline" size={12} color="#BD93F9" />
              <Text style={fsStyles.apiBadgeText}>{apiVersion}</Text>
            </View>
          </View>
        ) : null}

        {/* Placeholder warning */}
        {hasPlaceholders && tab === 'code' && (
          <View style={fsStyles.placeholderWarning}>
            <Ionicons name="warning-outline" size={14} color={D.placeholder} />
            <Text style={fsStyles.placeholderWarningText}>
              Replace highlighted API keys before using this code
            </Text>
          </View>
        )}

        {/* Content */}
        {tab === 'preview' && canPreview ? (
          <WebView
            source={{ html: htmlToPreview }}
            style={{ flex: 1, backgroundColor: '#FFF' }}
            originWhitelist={['*']}
            javaScriptEnabled
            domStorageEnabled
          />
        ) : (
          <ScrollView
            style={{ flex: 1, backgroundColor: D.bg }}
            nestedScrollEnabled
            showsVerticalScrollIndicator
            indicatorStyle="white"
          >
            <ScrollView
              horizontal={!wordWrap}
              showsHorizontalScrollIndicator={!wordWrap}
              indicatorStyle="white"
              decelerationRate="fast"
              contentContainerStyle={[
                fsStyles.codeContent,
                wordWrap && { flexShrink: 1, width: '100%' },
              ]}
            >
              {/* Line numbers */}
              <View style={fsStyles.lineNumbers}>
                {rawLines.map((_, i) => (
                  <Text key={i} style={fsStyles.lineNum}>{i + 1}</Text>
                ))}
              </View>
              {/* Code */}
              <View style={fsStyles.codeLines}>
                {rawLines.map((line, i) => (
                  <View key={i} style={fsStyles.codeLine}>
                    {tokenize(line, language).map((t, ti) => (
                      t.isPlaceholder ? (
                        <View key={ti} style={fsStyles.placeholderToken}>
                          <Text style={[fsStyles.codeText, { color: t.color }, wordWrap && { flexWrap: 'wrap' }]}>
                            {t.text}
                          </Text>
                        </View>
                      ) : (
                        <Text
                          key={ti}
                          style={[fsStyles.codeText, { color: t.color }, wordWrap && { flexWrap: 'wrap' }]}
                        >
                          {t.text}
                        </Text>
                      )
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
});

/* ────────────── MAIN CODE BLOCK ────────────── */
export const CodeBlock = memo(function CodeBlock({
  code,
  language = 'code',
  previewHtml,
  fileName,
  apiVersion,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [wordWrap, setWordWrap] = useState(false);
  const [tab, setTab] = useState<'code' | 'preview'>('code');
  const [fullScreen, setFullScreen] = useState(false);

  const onCopy = useCallback(async () => {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [code]);

  const canPreview = ['html', 'htm'].includes((language || '').toLowerCase()) || Boolean(previewHtml);
  const htmlToPreview = previewHtml || code;
  const hasPlaceholders = hasApiKeyPlaceholders(code);

  const rawLines = code.split('\n');
  const lineCount = rawLines.length;
  const isLong = lineCount > 12;
  const displayLines = !expanded && isLong ? rawLines.slice(0, 12) : rawLines;

  return (
    <>
      <View style={styles.wrapper}>

        {/* ── API VERSION BADGE (above header) ── */}
        {apiVersion ? (
          <View style={styles.apiBadgeRow}>
            <View style={styles.apiBadge}>
              <Ionicons name="cube-outline" size={11} color="#BD93F9" />
              <Text style={styles.apiBadgeText}>{apiVersion}</Text>
            </View>
          </View>
        ) : null}

        {/* ── PLACEHOLDER WARNING BADGE ── */}
        {hasPlaceholders && tab === 'code' && (
          <View style={styles.placeholderWarning}>
            <Ionicons name="warning-outline" size={13} color={D.placeholder} />
            <Text style={styles.placeholderWarningText}>
              Replace highlighted placeholders with your real API keys
            </Text>
          </View>
        )}

        {/* ── HEADER ── */}
        <View style={styles.header}>
          {/* Mac dots */}
          <View style={styles.dots}>
            <View style={[styles.dot, { backgroundColor: '#FF5F57' }]} />
            <View style={[styles.dot, { backgroundColor: '#FEBC2E' }]} />
            <View style={[styles.dot, { backgroundColor: '#28C840' }]} />
          </View>

          <Text style={styles.langLabel}>{fileName || language}</Text>

          {/* Right icons */}
          <View style={styles.headerRight}>
            {/* Full-screen expand */}
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => setFullScreen(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="expand-outline" size={15} color="#6272A4" />
            </TouchableOpacity>

            {/* Copy */}
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={onCopy}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={copied ? 'checkmark-circle' : 'copy-outline'}
                size={15}
                color={copied ? '#50FA7B' : '#6272A4'}
              />
            </TouchableOpacity>

            {/* Word wrap toggle */}
            {tab === 'code' && (
              <TouchableOpacity
                style={[styles.iconBtn, wordWrap && { backgroundColor: '#44475A' }]}
                onPress={() => setWordWrap(w => !w)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name="return-down-forward-outline"
                  size={15}
                  color={wordWrap ? '#BD93F9' : '#6272A4'}
                />
              </TouchableOpacity>
            )}

            {/* Code / Preview tabs */}
            {canPreview && (
              <View style={styles.tabs}>
                <TouchableOpacity
                  style={[styles.tab, tab === 'code' && styles.tabActive]}
                  onPress={() => setTab('code')}
                >
                  <Text style={[styles.tabText, tab === 'code' && styles.tabTextActive]}>Code</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tab, tab === 'preview' && styles.tabActive]}
                  onPress={() => setTab('preview')}
                >
                  <Text style={[styles.tabText, tab === 'preview' && styles.tabTextActive]}>Preview</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* ── CONTENT ── */}
        {tab === 'preview' && canPreview ? (
          <View style={styles.previewContainer}>
            <WebView
              source={{ html: htmlToPreview }}
              style={{ flex: 1, minHeight: 280, backgroundColor: '#FFF' }}
              originWhitelist={['*']}
              javaScriptEnabled
              domStorageEnabled
              scrollEnabled
            />
            <TouchableOpacity
              style={styles.previewAllBtn}
              onPress={() => setFullScreen(true)}
            >
              <Ionicons name="expand-outline" size={14} color="#FFF" />
              <Text style={styles.previewAllText}>Preview All</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            style={[styles.scrollArea, expanded ? styles.scrollExpanded : styles.scrollCollapsed]}
            nestedScrollEnabled
            showsVerticalScrollIndicator
            persistentScrollbar
            indicatorStyle="white"
            decelerationRate="fast"
          >
            <ScrollView
              horizontal={!wordWrap}
              showsHorizontalScrollIndicator={!wordWrap}
              persistentScrollbar
              contentContainerStyle={[
                styles.hContent,
                wordWrap && { flexShrink: 1 },
              ]}
              indicatorStyle="white"
              decelerationRate="fast"
              scrollIndicatorInsets={{ bottom: 0 }}
              bounces
            >
              {/* Line numbers */}
              <View style={styles.lineNumbers}>
                {displayLines.map((_, i) => (
                  <Text key={i} style={styles.lineNumber}>{i + 1}</Text>
                ))}
              </View>

              {/* Code lines */}
              <View style={[styles.codeLines, wordWrap && { flex: 1 }]}>
                {displayLines.map((line, i) => (
                  <View key={i} style={[styles.codeLine, wordWrap && { flexWrap: 'wrap' }]}>
                    {tokenize(line, language).map((t, ti) => (
                      t.isPlaceholder ? (
                        <View key={ti} style={styles.placeholderToken}>
                          <Text style={[styles.codeText, { color: t.color }]}>{t.text}</Text>
                        </View>
                      ) : (
                        <Text key={ti} style={[styles.codeText, { color: t.color }]}>
                          {t.text}
                        </Text>
                      )
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
          </ScrollView>
        )}

        {/* ── SHOW MORE / LESS ── */}
        {tab === 'code' && isLong && (
          <TouchableOpacity style={styles.expandBtn} onPress={() => setExpanded(e => !e)}>
            <Text style={styles.expandText}>
              {expanded ? 'Show less ▲' : `Show all ${lineCount} lines ▼`}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Full-screen modal */}
      <FullScreenModal
        visible={fullScreen}
        code={code}
        language={language}
        previewHtml={previewHtml}
        fileName={fileName}
        apiVersion={apiVersion}
        onClose={() => setFullScreen(false)}
      />
    </>
  );
});

/* ────────────── STYLES ────────────── */
const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: D.bg,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    marginVertical: 6,
    borderWidth: 1,
    borderColor: D.border,
  },
  apiBadgeRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: D.header,
    borderBottomWidth: 1,
    borderBottomColor: D.border,
  },
  apiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(189,147,249,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(189,147,249,0.35)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  apiBadgeText: {
    fontSize: 11,
    color: '#BD93F9',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  placeholderWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,184,108,0.10)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,184,108,0.25)',
  },
  placeholderWarningText: {
    fontSize: 11,
    color: D.placeholder,
    fontWeight: '500',
    flex: 1,
  },
  placeholderToken: {
    backgroundColor: D.placeholderBg,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,184,108,0.4)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: D.header,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: D.border,
    gap: 6,
  },
  dots: { flexDirection: 'row', gap: 5 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  langLabel: {
    flex: 1,
    fontSize: 11,
    color: D.lineNum,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconBtn: {
    padding: 4,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#1A1B26',
    borderRadius: 8,
    padding: 2,
    marginLeft: 4,
  },
  tab: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tabActive: {
    backgroundColor: '#44475A',
  },
  tabText: {
    fontSize: 11,
    color: '#6272A4',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#F8F8F2',
  },
  scrollArea: { maxWidth: '100%' },
  scrollCollapsed: { maxHeight: 240 },
  scrollExpanded: { maxHeight: 480 },
  hContent: {
    paddingHorizontal: 0,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    minWidth: '100%',
  },
  lineNumbers: {
    paddingLeft: 12,
    paddingRight: 8,
    borderRightWidth: 1,
    borderRightColor: D.border,
    alignItems: 'flex-end',
    minWidth: 38,
  },
  lineNumber: {
    fontSize: 12,
    lineHeight: 18,
    color: D.lineNum,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    includeFontPadding: false,
  },
  codeLines: { paddingLeft: 12, paddingRight: 20 },
  codeLine: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    minHeight: 18,
    alignItems: 'flex-start',
  },
  codeText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    includeFontPadding: false,
  },
  expandBtn: {
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: D.header,
    borderTopWidth: 1,
    borderTopColor: D.border,
  },
  expandText: { fontSize: 12, color: D.purple, fontWeight: '600' },
  previewContainer: {
    height: 280,
    position: 'relative',
  },
  previewAllBtn: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  previewAllText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
});

/* ── Full-screen modal styles ── */
const fsStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: D.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: D.header,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: D.border,
    gap: 8,
  },
  iconBtn: {
    padding: 6,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileName: {
    flex: 1,
    fontSize: 13,
    color: '#F8F8F2',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#1A1B26',
    borderRadius: 8,
    padding: 2,
    marginLeft: 4,
  },
  tab: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tabActive: { backgroundColor: '#44475A' },
  tabText: { fontSize: 11, color: '#6272A4', fontWeight: '600' },
  tabTextActive: { color: '#F8F8F2' },
  apiBadgeRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: D.header,
    borderBottomWidth: 1,
    borderBottomColor: D.border,
  },
  apiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(189,147,249,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(189,147,249,0.35)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  apiBadgeText: {
    fontSize: 12,
    color: '#BD93F9',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  placeholderWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,184,108,0.10)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,184,108,0.25)',
  },
  placeholderWarningText: {
    fontSize: 12,
    color: D.placeholder,
    fontWeight: '500',
    flex: 1,
  },
  placeholderToken: {
    backgroundColor: D.placeholderBg,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,184,108,0.4)',
  },
  codeContent: {
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    minWidth: '100%',
  },
  lineNumbers: {
    paddingLeft: 12,
    paddingRight: 8,
    borderRightWidth: 1,
    borderRightColor: D.border,
    alignItems: 'flex-end',
    minWidth: 44,
  },
  lineNum: {
    fontSize: 13,
    lineHeight: 20,
    color: D.lineNum,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    includeFontPadding: false,
  },
  codeLines: { paddingLeft: 12, paddingRight: 24 },
  codeLine: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    minHeight: 20,
    alignItems: 'flex-start',
  },
  codeText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    includeFontPadding: false,
  },
});
