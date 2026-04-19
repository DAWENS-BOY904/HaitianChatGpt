import React, { useState, memo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Modal,
  SafeAreaView,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { WebView } from 'react-native-webview';
import { BorderRadius } from '../constants/theme';

interface CodeBlockProps {
  code: string;
  language?: string;
  previewHtml?: string;
  fileName?: string;
  apiVersion?: string;
  streaming?: boolean;
  speed?: number;
}

/* ────────────── DRACULA PALETTE ────────────── */
const D = {
  bg:           '#282A36',
  header:       '#21222C',
  border:       '#44475A',
  keyword:      '#FF79C6',
  string:       '#F1FA8C',
  comment:      '#6272A4',
  number:       '#BD93F9',
  tag:          '#FF5555',
  attr:         '#50FA7B',
  attrVal:      '#F1FA8C',
  type:         '#8BE9FD',
  plain:        '#F8F8F2',
  lineNum:      '#6272A4',
  purple:       '#BD93F9',
  placeholder:  '#FFB86C',
  placeholderBg:'rgba(255,184,108,0.15)',
};

/* ────────────── LANGUAGE ICONS ────────────── */
interface LangMeta {
  icon: string;
  color: string;
  bg: string;
  label: string;
}

const LANG_META: Record<string, LangMeta> = {
  python:     { icon: '🐍', color: '#3572A5', bg: 'rgba(53,114,165,0.18)', label: 'Python' },
  py:         { icon: '🐍', color: '#3572A5', bg: 'rgba(53,114,165,0.18)', label: 'Python' },
  javascript: { icon: '⚡', color: '#F7DF1E', bg: 'rgba(247,223,30,0.15)', label: 'JavaScript' },
  js:         { icon: '⚡', color: '#F7DF1E', bg: 'rgba(247,223,30,0.15)', label: 'JavaScript' },
  jsx:        { icon: '⚛️', color: '#61DAFB', bg: 'rgba(97,218,251,0.15)', label: 'React JSX' },
  typescript: { icon: '🔷', color: '#3178C6', bg: 'rgba(49,120,198,0.18)', label: 'TypeScript' },
  ts:         { icon: '🔷', color: '#3178C6', bg: 'rgba(49,120,198,0.18)', label: 'TypeScript' },
  tsx:        { icon: '⚛️', color: '#3178C6', bg: 'rgba(49,120,198,0.18)', label: 'TSX' },
  html:       { icon: '🔶', color: '#E34F26', bg: 'rgba(227,79,38,0.18)', label: 'HTML' },
  htm:        { icon: '🔶', color: '#E34F26', bg: 'rgba(227,79,38,0.18)', label: 'HTML' },
  css:        { icon: '🎨', color: '#264DE4', bg: 'rgba(38,77,228,0.18)', label: 'CSS' },
  scss:       { icon: '🎨', color: '#CF649A', bg: 'rgba(207,100,154,0.18)', label: 'SCSS' },
  bash:       { icon: '💻', color: '#4EAA25', bg: 'rgba(78,170,37,0.18)', label: 'Bash' },
  sh:         { icon: '💻', color: '#4EAA25', bg: 'rgba(78,170,37,0.18)', label: 'Shell' },
  json:       { icon: '{}', color: '#CB7700', bg: 'rgba(203,119,0,0.18)', label: 'JSON' },
  sql:        { icon: '🗄️', color: '#336791', bg: 'rgba(51,103,145,0.18)', label: 'SQL' },
  java:       { icon: '☕', color: '#B07219', bg: 'rgba(176,114,25,0.18)', label: 'Java' },
  kotlin:     { icon: '🟣', color: '#A97BFF', bg: 'rgba(169,123,255,0.18)', label: 'Kotlin' },
  swift:      { icon: '🦅', color: '#F05138', bg: 'rgba(240,81,56,0.18)', label: 'Swift' },
  rust:       { icon: '🦀', color: '#CE412B', bg: 'rgba(206,65,43,0.18)', label: 'Rust' },
  go:         { icon: '🐹', color: '#00ACD7', bg: 'rgba(0,172,215,0.18)', label: 'Go' },
  ruby:       { icon: '💎', color: '#CC342D', bg: 'rgba(204,52,45,0.18)', label: 'Ruby' },
  php:        { icon: '🐘', color: '#777BB4', bg: 'rgba(119,123,180,0.18)', label: 'PHP' },
  c:          { icon: '⚙️', color: '#555555', bg: 'rgba(85,85,85,0.18)', label: 'C' },
  cpp:        { icon: '⚙️', color: '#00599C', bg: 'rgba(0,89,156,0.18)', label: 'C++' },
  cs:         { icon: '🔵', color: '#239120', bg: 'rgba(35,145,32,0.18)', label: 'C#' },
  dart:       { icon: '🎯', color: '#0175C2', bg: 'rgba(1,117,194,0.18)', label: 'Dart' },
  yaml:       { icon: '📄', color: '#CB171E', bg: 'rgba(203,23,30,0.18)', label: 'YAML' },
  yml:        { icon: '📄', color: '#CB171E', bg: 'rgba(203,23,30,0.18)', label: 'YAML' },
  xml:        { icon: '📰', color: '#FF6600', bg: 'rgba(255,102,0,0.18)', label: 'XML' },
  markdown:   { icon: '📝', color: '#083FA1', bg: 'rgba(8,63,161,0.18)', label: 'Markdown' },
  md:         { icon: '📝', color: '#083FA1', bg: 'rgba(8,63,161,0.18)', label: 'Markdown' },
  dockerfile: { icon: '🐳', color: '#2496ED', bg: 'rgba(36,150,237,0.18)', label: 'Dockerfile' },
  graphql:    { icon: '🔮', color: '#E10098', bg: 'rgba(225,0,152,0.18)', label: 'GraphQL' },
  r:          { icon: '📊', color: '#198CE7', bg: 'rgba(25,140,231,0.18)', label: 'R' },
  lua:        { icon: '🌙', color: '#000080', bg: 'rgba(0,0,128,0.18)', label: 'Lua' },
};

function getLangMeta(lang: string): LangMeta {
  const key = (lang || '').toLowerCase();
  return LANG_META[key] || { icon: '📄', color: '#888', bg: 'rgba(136,136,136,0.15)', label: lang || 'Code' };
}

/* ────────────── PLACEHOLDER PATTERNS ────────────── */
const PLACEHOLDER_PATTERNS = [
  /\bYOUR_API_KEY\b/g, /\bYOUR_SECRET_KEY\b/g, /\bYOUR_PUBLIC_KEY\b/g,
  /\bAPI_KEY_HERE\b/g, /\bSECRET_KEY_HERE\b/g, /\bYOUR_TOKEN\b/g,
  /\bYOUR_ACCESS_TOKEN\b/g, /\bINSERT_API_KEY\b/g, /\bPUT_YOUR_KEY_HERE\b/g,
  /\bYOUR_OPENAI_KEY\b/g, /\bYOUR_STRIPE_KEY\b/g,
  /sk_test_[A-Za-z0-9]{4,}/g, /sk_live_[A-Za-z0-9]{4,}/g,
  /rk_test_[A-Za-z0-9]{4,}/g, /pk_test_[A-Za-z0-9]{4,}/g,
];

function hasApiKeyPlaceholders(code: string): boolean {
  return PLACEHOLDER_PATTERNS.some(re => { re.lastIndex = 0; return re.test(code); });
}

/* ────────────── TOKEN TYPE ────────────── */
type Token = { text: string; color: string; isPlaceholder?: boolean };

function checkPlaceholders(tokens: Token[]): Token[] {
  const result: Token[] = [];
  for (const token of tokens) {
    let remaining = token.text;
    let lastIdx = 0;
    const combined = new RegExp(PLACEHOLDER_PATTERNS.map(r => r.source).join('|'), 'g');
    let m: RegExpExecArray | null;
    const parts: Token[] = [];
    while ((m = combined.exec(remaining)) !== null) {
      if (m.index > lastIdx) parts.push({ text: remaining.slice(lastIdx, m.index), color: token.color });
      parts.push({ text: m[0], color: D.placeholder, isPlaceholder: true });
      lastIdx = combined.lastIndex;
    }
    if (lastIdx < remaining.length) parts.push({ text: remaining.slice(lastIdx), color: token.color });
    result.push(...(parts.length > 0 ? parts : [token]));
  }
  return result;
}

function tokenize(line: string, lang: string): Token[] {
  const l = (lang || '').toLowerCase();

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

  if (['js', 'ts', 'tsx', 'jsx', 'javascript', 'typescript'].includes(l)) {
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

  if (['css', 'scss'].includes(l)) {
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

  if (['python', 'py'].includes(l)) {
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

  if (['json'].includes(l)) {
    const tokens: Token[] = [];
    const re = /("(?:[^"\\]|\\.)*"\s*:)|("(?:[^"\\]|\\.)*")|(\b(?:true|false|null)\b)|(-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)/g;
    let last = 0, m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      if (m.index > last) tokens.push({ text: line.slice(last, m.index), color: D.plain });
      if (m[1])      tokens.push({ text: m[1], color: D.attr });
      else if (m[2]) tokens.push({ text: m[2], color: D.string });
      else if (m[3]) tokens.push({ text: m[3], color: D.keyword });
      else if (m[4]) tokens.push({ text: m[4], color: D.number });
      last = re.lastIndex;
    }
    if (last < line.length) tokens.push({ text: line.slice(last), color: D.plain });
    return checkPlaceholders(tokens);
  }

  return checkPlaceholders([{ text: line, color: D.plain }]);
}

/* ────────────── BLINKING CURSOR ────────────── */
const BlinkingCursor = memo(function BlinkingCursor() {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);
  return (
    <Animated.View style={{ opacity, width: 2, height: 14, backgroundColor: D.plain, marginLeft: 1, alignSelf: 'center' }} />
  );
});

/* ────────────── LANGUAGE BADGE ────────────── */
const LangBadge = memo(function LangBadge({ lang, fileName }: { lang: string; fileName?: string }) {
  const meta = getLangMeta(lang);
  const display = fileName || meta.label;
  return (
    <View style={[lbStyles.badge, { backgroundColor: meta.bg, borderColor: meta.color + '55' }]}>
      <Text style={lbStyles.icon}>{meta.icon}</Text>
      <Text style={[lbStyles.label, { color: meta.color }]}>{display}</Text>
    </View>
  );
});

const lbStyles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  icon: { fontSize: 11 },
  label: { fontSize: 11, fontWeight: '700', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
});

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
  const onCopy = async () => { await Clipboard.setStringAsync(code); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const rawLines = code.split('\n');

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={fsStyles.container}>
        <View style={fsStyles.header}>
          <TouchableOpacity onPress={onClose} style={fsStyles.iconBtn}>
            <Ionicons name="close" size={22} color="#FFF" />
          </TouchableOpacity>
          <LangBadge lang={language} fileName={fileName} />
          <View style={fsStyles.headerRight}>
            <TouchableOpacity style={fsStyles.iconBtn} onPress={onCopy}>
              <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={18} color={copied ? '#50FA7B' : '#AAA'} />
            </TouchableOpacity>
            {tab === 'code' && (
              <TouchableOpacity style={[fsStyles.iconBtn, wordWrap && { backgroundColor: '#44475A' }]} onPress={() => setWordWrap(w => !w)}>
                <Ionicons name="return-down-forward-outline" size={18} color={wordWrap ? '#BD93F9' : '#AAA'} />
              </TouchableOpacity>
            )}
            {canPreview && (
              <View style={fsStyles.tabs}>
                <TouchableOpacity style={[fsStyles.tab, tab === 'code' && fsStyles.tabActive]} onPress={() => setTab('code')}>
                  <Text style={[fsStyles.tabText, tab === 'code' && fsStyles.tabTextActive]}>Code</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[fsStyles.tab, tab === 'preview' && fsStyles.tabActive]} onPress={() => setTab('preview')}>
                  <Text style={[fsStyles.tabText, tab === 'preview' && fsStyles.tabTextActive]}>Preview</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {apiVersion ? (
          <View style={fsStyles.apiBadgeRow}>
            <View style={fsStyles.apiBadge}>
              <Ionicons name="cube-outline" size={12} color="#BD93F9" />
              <Text style={fsStyles.apiBadgeText}>{apiVersion}</Text>
            </View>
          </View>
        ) : null}

        {hasPlaceholders && tab === 'code' && (
          <View style={fsStyles.placeholderWarning}>
            <Ionicons name="warning-outline" size={14} color={D.placeholder} />
            <Text style={fsStyles.placeholderWarningText}>Replace highlighted API keys before using this code</Text>
          </View>
        )}

        {tab === 'preview' && canPreview ? (
          <WebView source={{ html: htmlToPreview }} style={{ flex: 1, backgroundColor: '#FFF' }} originWhitelist={['*']} javaScriptEnabled domStorageEnabled />
        ) : (
          <ScrollView style={{ flex: 1, backgroundColor: D.bg }} nestedScrollEnabled showsVerticalScrollIndicator indicatorStyle="white">
            <ScrollView horizontal={!wordWrap} showsHorizontalScrollIndicator={!wordWrap} indicatorStyle="white" decelerationRate="fast"
              contentContainerStyle={[fsStyles.codeContent, wordWrap && { flexShrink: 1, width: '100%' }]}>
              <View style={fsStyles.lineNumbers}>
                {rawLines.map((_, i) => <Text key={i} style={fsStyles.lineNum}>{i + 1}</Text>)}
              </View>
              <View style={fsStyles.codeLines}>
                {rawLines.map((line, i) => (
                  <View key={i} style={fsStyles.codeLine}>
                    {tokenize(line, language).map((t, ti) =>
                      t.isPlaceholder ? (
                        <View key={ti} style={fsStyles.placeholderToken}>
                          <Text style={[fsStyles.codeText, { color: t.color }, wordWrap && { flexWrap: 'wrap' }]}>{t.text}</Text>
                        </View>
                      ) : (
                        <Text key={ti} style={[fsStyles.codeText, { color: t.color }, wordWrap && { flexWrap: 'wrap' }]}>{t.text}</Text>
                      )
                    )}
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
  streaming = false,
  speed = 15,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [wordWrap, setWordWrap] = useState(false);
  const [tab, setTab] = useState<'code' | 'preview'>('code');
  const [fullScreen, setFullScreen] = useState(false);

  // Streaming: show characters progressively at natural typing pace
  const [displayedCode, setDisplayedCode] = useState(streaming ? '' : code);
  const streamRef = useRef<NodeJS.Timeout | null>(null);
  const charIndexRef = useRef(0);
  const codeRef = useRef(code);

  useEffect(() => {
    codeRef.current = code;
    if (!streaming) {
      // Cancel any in-progress animation and show full code immediately
      if (streamRef.current) clearTimeout(streamRef.current);
      setDisplayedCode(code);
      charIndexRef.current = code.length;
      return;
    }
    // Continue streaming from current position
    if (charIndexRef.current >= code.length) return;
    const tick = () => {
      const full = codeRef.current;
      const current = charIndexRef.current;
      if (current < full.length) {
        // Batch 8 chars per tick = less re-renders, less lag
        const end = Math.min(current + 8, full.length);
        setDisplayedCode(full.slice(0, end));
        charIndexRef.current = end;
        streamRef.current = setTimeout(tick, 20);
      }
    };
    streamRef.current = setTimeout(tick, 0);
    return () => { if (streamRef.current) clearTimeout(streamRef.current); };
  }, [code, streaming]);

  const onCopy = useCallback(async () => {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [code]);

  const canPreview = ['html', 'htm'].includes((language || '').toLowerCase()) || Boolean(previewHtml);
  const htmlToPreview = previewHtml || code;
  const hasPlaceholders = hasApiKeyPlaceholders(code);
  const isStreaming = streaming && displayedCode.length < code.length;

  const rawLines = displayedCode.split('\n');
  const lineCount = rawLines.length;
  const isLong = lineCount > 12;
  const displayLines = !expanded && isLong ? rawLines.slice(0, 12) : rawLines;
  const lastLineIdx = displayLines.length - 1;

  return (
    <>
      <View style={styles.wrapper}>
        {/* API badge */}
        {apiVersion ? (
          <View style={styles.apiBadgeRow}>
            <View style={styles.apiBadge}>
              <Ionicons name="cube-outline" size={11} color="#BD93F9" />
              <Text style={styles.apiBadgeText}>{apiVersion}</Text>
            </View>
          </View>
        ) : null}

        {/* Placeholder warning */}
        {hasPlaceholders && tab === 'code' && (
          <View style={styles.placeholderWarning}>
            <Ionicons name="warning-outline" size={13} color={D.placeholder} />
            <Text style={styles.placeholderWarningText}>Replace highlighted placeholders with your real API keys</Text>
          </View>
        )}

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.dots}>
            <View style={[styles.dot, { backgroundColor: '#FF5F57' }]} />
            <View style={[styles.dot, { backgroundColor: '#FEBC2E' }]} />
            <View style={[styles.dot, { backgroundColor: '#28C840' }]} />
          </View>

          <LangBadge lang={language} fileName={fileName} />

          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => setFullScreen(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="expand-outline" size={15} color="#6272A4" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={onCopy} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name={copied ? 'checkmark-circle' : 'copy-outline'} size={15} color={copied ? '#50FA7B' : '#6272A4'} />
            </TouchableOpacity>
            {tab === 'code' && (
              <TouchableOpacity style={[styles.iconBtn, wordWrap && { backgroundColor: '#44475A' }]} onPress={() => setWordWrap(w => !w)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="return-down-forward-outline" size={15} color={wordWrap ? '#BD93F9' : '#6272A4'} />
              </TouchableOpacity>
            )}
            {canPreview && (
              <View style={styles.tabs}>
                <TouchableOpacity style={[styles.tab, tab === 'code' && styles.tabActive]} onPress={() => setTab('code')}>
                  <Text style={[styles.tabText, tab === 'code' && styles.tabTextActive]}>Code</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tab, tab === 'preview' && styles.tabActive]} onPress={() => setTab('preview')}>
                  <Text style={[styles.tabText, tab === 'preview' && styles.tabTextActive]}>Preview</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Content */}
        {tab === 'preview' && canPreview ? (
          <View style={styles.previewContainer}>
            <WebView source={{ html: htmlToPreview }} style={{ flex: 1, minHeight: 280, backgroundColor: '#FFF' }}
              originWhitelist={['*']} javaScriptEnabled domStorageEnabled scrollEnabled />
            <TouchableOpacity style={styles.previewAllBtn} onPress={() => setFullScreen(true)}>
              <Ionicons name="expand-outline" size={14} color="#FFF" />
              <Text style={styles.previewAllText}>Preview All</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.scrollArea, expanded ? styles.scrollExpanded : styles.scrollCollapsed]}>
            <ScrollView style={{ flex: 1 }} nestedScrollEnabled showsVerticalScrollIndicator indicatorStyle="white" decelerationRate="fast">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={!wordWrap}
                persistentScrollbar={!wordWrap}
                indicatorStyle="white"
                decelerationRate={0.9}
                bounces
                contentContainerStyle={[styles.hContent, wordWrap && { flexShrink: 1, flexWrap: 'wrap' }]}
                scrollEventThrottle={16}
                directionalLockEnabled
              >
                {/* Line numbers */}
                <View style={styles.lineNumbers}>
                  {displayLines.map((_, i) => (
                    <Text key={i} style={styles.lineNumber}>{i + 1}</Text>
                  ))}
                </View>

                {/* Code lines */}
                <View style={[styles.codeLines, wordWrap && { flex: 1 }]}>
                  {displayLines.map((line, i) => {
                    const isLastLine = i === lastLineIdx;
                    return (
                      <View key={i} style={[styles.codeLine, wordWrap && { flexWrap: 'wrap' }]}>
                        {tokenize(line, language).map((t, ti) =>
                          t.isPlaceholder ? (
                            <View key={ti} style={styles.placeholderToken}>
                              <Text style={[styles.codeText, { color: t.color }]}>{t.text}</Text>
                            </View>
                          ) : (
                            <Text key={ti} style={[styles.codeText, { color: t.color }]}>{t.text}</Text>
                          )
                        )}
                        {/* Blinking cursor at end of last line during streaming */}
                        {isStreaming && isLastLine && <BlinkingCursor />}
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            </ScrollView>
          </View>
        )}

        {/* Show more/less */}
        {tab === 'code' && isLong && (
          <TouchableOpacity style={styles.expandBtn} onPress={() => setExpanded(e => !e)}>
            <Text style={styles.expandText}>{expanded ? 'Show less ▲' : `Show all ${lineCount} lines ▼`}</Text>
          </TouchableOpacity>
        )}
      </View>

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

/* StreamingCodeBlock = alias for CodeBlock (named export for MessageItem) */
export const StreamingCodeBlock = CodeBlock;

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
  apiBadgeRow: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4, backgroundColor: D.header, borderBottomWidth: 1, borderBottomColor: D.border },
  apiBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(189,147,249,0.12)', borderWidth: 1, borderColor: 'rgba(189,147,249,0.35)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  apiBadgeText: { fontSize: 11, color: '#BD93F9', fontWeight: '600', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  placeholderWarning: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(255,184,108,0.10)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,184,108,0.25)' },
  placeholderWarningText: { fontSize: 11, color: D.placeholder, fontWeight: '500', flex: 1 },
  placeholderToken: { backgroundColor: D.placeholderBg, borderRadius: 3, borderWidth: 1, borderColor: 'rgba(255,184,108,0.4)' },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: D.header, paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: D.border, gap: 6 },
  dots: { flexDirection: 'row', gap: 5 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' },
  iconBtn: { padding: 4, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', backgroundColor: '#1A1B26', borderRadius: 8, padding: 2, marginLeft: 4 },
  tab: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  tabActive: { backgroundColor: '#44475A' },
  tabText: { fontSize: 11, color: '#6272A4', fontWeight: '600' },
  tabTextActive: { color: '#F8F8F2' },
  scrollArea: { maxWidth: '100%', overflow: 'hidden' },
  scrollCollapsed: { height: 240 },
  scrollExpanded: { height: 480 },
  hContent: { paddingHorizontal: 0, paddingVertical: 10, flexDirection: 'row', alignItems: 'flex-start', minWidth: '100%' },
  lineNumbers: { paddingLeft: 12, paddingRight: 8, borderRightWidth: 1, borderRightColor: D.border, alignItems: 'flex-end', minWidth: 38 },
  lineNumber: { fontSize: 12, lineHeight: 18, color: D.lineNum, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', includeFontPadding: false },
  codeLines: { paddingLeft: 12, paddingRight: 20 },
  codeLine: { flexDirection: 'row', flexWrap: 'nowrap', minHeight: 18, alignItems: 'center' },
  codeText: { fontSize: 13, lineHeight: 18, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', includeFontPadding: false },
  expandBtn: { alignItems: 'center', paddingVertical: 8, backgroundColor: D.header, borderTopWidth: 1, borderTopColor: D.border },
  expandText: { fontSize: 12, color: D.purple, fontWeight: '600' },
  previewContainer: { height: 280, position: 'relative' },
  previewAllBtn: { position: 'absolute', bottom: 12, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.75)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  previewAllText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
});

const fsStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: D.bg },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: D.header, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: D.border, gap: 8 },
  iconBtn: { padding: 6, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' },
  tabs: { flexDirection: 'row', backgroundColor: '#1A1B26', borderRadius: 8, padding: 2, marginLeft: 4 },
  tab: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  tabActive: { backgroundColor: '#44475A' },
  tabText: { fontSize: 11, color: '#6272A4', fontWeight: '600' },
  tabTextActive: { color: '#F8F8F2' },
  apiBadgeRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: D.header, borderBottomWidth: 1, borderBottomColor: D.border },
  apiBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(189,147,249,0.12)', borderWidth: 1, borderColor: 'rgba(189,147,249,0.35)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  apiBadgeText: { fontSize: 12, color: '#BD93F9', fontWeight: '600', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  placeholderWarning: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: 'rgba(255,184,108,0.10)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,184,108,0.25)' },
  placeholderWarningText: { fontSize: 12, color: D.placeholder, fontWeight: '500', flex: 1 },
  placeholderToken: { backgroundColor: D.placeholderBg, borderRadius: 3, borderWidth: 1, borderColor: 'rgba(255,184,108,0.4)' },
  codeContent: { paddingVertical: 10, flexDirection: 'row', alignItems: 'flex-start', minWidth: '100%' },
  lineNumbers: { paddingLeft: 12, paddingRight: 8, borderRightWidth: 1, borderRightColor: D.border, alignItems: 'flex-end', minWidth: 44 },
  lineNum: { fontSize: 13, lineHeight: 20, color: D.lineNum, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', includeFontPadding: false },
  codeLines: { paddingLeft: 12, paddingRight: 24 },
  codeLine: { flexDirection: 'row', flexWrap: 'nowrap', minHeight: 20, alignItems: 'center' },
  codeText: { fontSize: 14, lineHeight: 20, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', includeFontPadding: false },
});

