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
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { BorderRadius } from '../constants/theme';

const { width: SCREEN_W } = Dimensions.get('window');

// ─────────────────────────────────────────────
//  ChatGPT-inspired dark theme (One Dark Pro)
// ─────────────────────────────────────────────
const C = {
  bg:         '#1e1e1e',   // card background
  header:     '#2d2d2d',   // header bar
  border:     '#3e3e3e',   // card border
  scrollBg:   '#161616',   // scroll area bg
  // syntax
  keyword:    '#c678dd',   // purple   — const, let, import, async …
  string:     '#98c379',   // green    — "strings"
  comment:    '#5c6370',   // grey     — // comments
  number:     '#d19a66',   // orange   — 42, 3.14
  tag:        '#e06c75',   // red      — HTML tags
  attr:       '#e5c07b',   // yellow   — attributes
  attrVal:    '#98c379',   // green    — attribute values
  type:       '#61afef',   // blue     — ClassName, Type
  plain:      '#abb2bf',   // grey-white — default
  lineNum:    '#4a4a4a',   // dim line numbers
  placeholder:'#e5c07b',  // orange   — YOUR_API_KEY
  phBg:       'rgba(229,192,123,0.12)',
};

// ─────────────────────────────────────────────
//  Language metadata (label + color)
// ─────────────────────────────────────────────
interface LangMeta { label: string; color: string; abbr: string }

const LANG_META: Record<string, LangMeta> = {
  javascript:  { label: 'JavaScript', color: '#f7df1e', abbr: 'JS'  },
  js:          { label: 'JavaScript', color: '#f7df1e', abbr: 'JS'  },
  jsx:         { label: 'JSX',        color: '#61dafb', abbr: 'JSX' },
  typescript:  { label: 'TypeScript', color: '#3178c6', abbr: 'TS'  },
  ts:          { label: 'TypeScript', color: '#3178c6', abbr: 'TS'  },
  tsx:         { label: 'TSX',        color: '#3178c6', abbr: 'TSX' },
  python:      { label: 'Python',     color: '#3572a5', abbr: 'PY'  },
  py:          { label: 'Python',     color: '#3572a5', abbr: 'PY'  },
  html:        { label: 'HTML',       color: '#e34f26', abbr: 'HTM' },
  htm:         { label: 'HTML',       color: '#e34f26', abbr: 'HTM' },
  css:         { label: 'CSS',        color: '#264de4', abbr: 'CSS' },
  scss:        { label: 'SCSS',       color: '#cf649a', abbr: 'CSS' },
  bash:        { label: 'Bash',       color: '#4eaa25', abbr: 'SH'  },
  sh:          { label: 'Shell',      color: '#4eaa25', abbr: 'SH'  },
  json:        { label: 'JSON',       color: '#cb7700', abbr: '{}'  },
  sql:         { label: 'SQL',        color: '#336791', abbr: 'SQL' },
  java:        { label: 'Java',       color: '#b07219', abbr: 'JV'  },
  kotlin:      { label: 'Kotlin',     color: '#a97bff', abbr: 'KT'  },
  swift:       { label: 'Swift',      color: '#f05138', abbr: 'SW'  },
  rust:        { label: 'Rust',       color: '#ce412b', abbr: 'RS'  },
  go:          { label: 'Go',         color: '#00acd7', abbr: 'GO'  },
  ruby:        { label: 'Ruby',       color: '#cc342d', abbr: 'RB'  },
  php:         { label: 'PHP',        color: '#777bb4', abbr: 'PHP' },
  c:           { label: 'C',          color: '#555555', abbr: 'C'   },
  cpp:         { label: 'C++',        color: '#00599c', abbr: 'C++' },
  cs:          { label: 'C#',         color: '#239120', abbr: 'C#'  },
  dart:        { label: 'Dart',       color: '#0175c2', abbr: 'DT'  },
  yaml:        { label: 'YAML',       color: '#cb171e', abbr: 'YML' },
  yml:         { label: 'YAML',       color: '#cb171e', abbr: 'YML' },
  xml:         { label: 'XML',        color: '#ff6600', abbr: 'XML' },
  dockerfile:  { label: 'Dockerfile', color: '#2496ed', abbr: 'DKR' },
  graphql:     { label: 'GraphQL',    color: '#e10098', abbr: 'GQL' },
  r:           { label: 'R',          color: '#198ce7', abbr: 'R'   },
  lua:         { label: 'Lua',        color: '#000080', abbr: 'LUA' },
  markdown:    { label: 'Markdown',   color: '#083fa1', abbr: 'MD'  },
  md:          { label: 'Markdown',   color: '#083fa1', abbr: 'MD'  },
  code:        { label: 'Code',       color: '#888888', abbr: '</>' },
  text:        { label: 'Text',       color: '#888888', abbr: 'TXT' },
};

function getLangMeta(lang: string): LangMeta {
  const key = (lang || '').toLowerCase().trim();
  return LANG_META[key] || { label: lang || 'Code', color: '#888', abbr: '</>' };
}

// ─────────────────────────────────────────────
//  Language icon badge (colored letter/abbr block)
// ─────────────────────────────────────────────
const LangIconBadge = memo(function LangIconBadge({ lang, size = 20 }: { lang: string; size?: number }) {
  const meta = getLangMeta(lang);
  return (
    <View style={{
      width: size, height: size, borderRadius: 4,
      backgroundColor: meta.color + '28',
      borderWidth: 1, borderColor: meta.color + '55',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{
        fontSize: size * 0.32, fontWeight: '800',
        color: meta.color, letterSpacing: -0.5,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      }} numberOfLines={1}>
        {meta.abbr.slice(0, 3)}
      </Text>
    </View>
  );
});

// ─────────────────────────────────────────────
//  Placeholder detection
// ─────────────────────────────────────────────
const PLACEHOLDER_PATTERNS = [
  /\bYOUR_API_KEY\b/g, /\bYOUR_SECRET_KEY\b/g, /\bYOUR_PUBLIC_KEY\b/g,
  /\bAPI_KEY_HERE\b/g, /\bSECRET_KEY_HERE\b/g, /\bYOUR_TOKEN\b/g,
  /\bYOUR_ACCESS_TOKEN\b/g, /\bINSERT_API_KEY\b/g, /\bPUT_YOUR_KEY_HERE\b/g,
];

function hasApiKeyPlaceholders(code: string): boolean {
  return PLACEHOLDER_PATTERNS.some(re => { re.lastIndex = 0; return re.test(code); });
}

// ─────────────────────────────────────────────
//  Token type
// ─────────────────────────────────────────────
type Token = { text: string; color: string; isPlaceholder?: boolean };

function checkPlaceholders(tokens: Token[]): Token[] {
  const result: Token[] = [];
  for (const token of tokens) {
    const combined = new RegExp(PLACEHOLDER_PATTERNS.map(r => r.source).join('|'), 'g');
    let remaining = token.text;
    let lastIdx = 0;
    let m: RegExpExecArray | null;
    const parts: Token[] = [];
    while ((m = combined.exec(remaining)) !== null) {
      if (m.index > lastIdx) parts.push({ text: remaining.slice(lastIdx, m.index), color: token.color });
      parts.push({ text: m[0], color: C.placeholder, isPlaceholder: true });
      lastIdx = combined.lastIndex;
    }
    if (lastIdx < remaining.length) parts.push({ text: remaining.slice(lastIdx), color: token.color });
    result.push(...(parts.length > 0 ? parts : [token]));
  }
  return result;
}

// ─────────────────────────────────────────────
//  Syntax tokenizer (One Dark Pro inspired)
// ─────────────────────────────────────────────
function tokenize(line: string, lang: string): Token[] {
  const l = (lang || '').toLowerCase();

  // HTML / XML
  if (['html', 'xml', 'htm'].includes(l)) {
    const tokens: Token[] = [];
    const re = /(<!--[\s\S]*?-->)|(<\/?)(\w[\w-]*)((?:\s+[\w:-]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*))?)*)\s*(\/?>)/g;
    let last = 0, m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      if (m.index > last) tokens.push({ text: line.slice(last, m.index), color: C.plain });
      if (m[1]) { tokens.push({ text: m[1], color: C.comment }); }
      else {
        tokens.push({ text: m[2], color: C.tag });
        tokens.push({ text: m[3], color: C.tag });
        if (m[4]) {
          // Fixed attr regex: match name=("val" | 'val')
          const attrRe = /([\w:-]+)(\s*=\s*)("[^"]*"|'[^']*')/g;
          let lastA = 0, ma: RegExpExecArray | null;
          const attrStr = m[4];
          while ((ma = attrRe.exec(attrStr)) !== null) {
            if (ma.index > lastA) tokens.push({ text: attrStr.slice(lastA, ma.index), color: C.plain });
            tokens.push({ text: ma[1], color: C.attr });
            if (ma[2]) tokens.push({ text: ma[2], color: C.plain });
            if (ma[3]) tokens.push({ text: ma[3], color: C.attrVal });
            lastA = attrRe.lastIndex;
          }
          if (lastA < attrStr.length) tokens.push({ text: attrStr.slice(lastA), color: C.attr });
        }
        tokens.push({ text: m[5], color: C.tag });
      }
      last = re.lastIndex;
    }
    if (last < line.length) tokens.push({ text: line.slice(last), color: C.plain });
    return checkPlaceholders(tokens);
  }

  // JS / TS / JSX / TSX
  if (['js', 'ts', 'tsx', 'jsx', 'javascript', 'typescript'].includes(l)) {
    const tokens: Token[] = [];
    const re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(["'`](?:[^"'`\\]|\\.)*["'`])|(\b(?:const|let|var|function|return|import|export|default|from|if|else|for|while|do|class|extends|new|typeof|instanceof|async|await|try|catch|finally|throw|of|in|switch|case|break|continue|void|null|undefined|true|false|this|super|type|interface|enum|implements|static|abstract|readonly|public|private|protected|declare|namespace|module|require|delete|debugger|yield|with)\b)|(\b[A-Z][a-zA-Z0-9_]*\b)|(\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)/g;
    let last = 0, m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      if (m.index > last) tokens.push({ text: line.slice(last, m.index), color: C.plain });
      if (m[1])      tokens.push({ text: m[1], color: C.comment });
      else if (m[2]) tokens.push({ text: m[2], color: C.string });
      else if (m[3]) tokens.push({ text: m[3], color: C.keyword });
      else if (m[4]) tokens.push({ text: m[4], color: C.type });
      else if (m[5]) tokens.push({ text: m[5], color: C.number });
      last = re.lastIndex;
    }
    if (last < line.length) tokens.push({ text: line.slice(last), color: C.plain });
    return checkPlaceholders(tokens);
  }

  // CSS / SCSS
  if (['css', 'scss'].includes(l)) {
    const tokens: Token[] = [];
    const re = /(\/\*[\s\S]*?\*\/)|([.#]?[\w-]+\s*(?={))|([a-z-]+\s*(?=:))|(\b\d+(?:px|em|rem|%|vh|vw|s|ms|pt|cm|mm)?\b)|("([^"]*)")|('([^']*)')/g;
    let last = 0, m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      if (m.index > last) tokens.push({ text: line.slice(last, m.index), color: C.plain });
      if (m[1])      tokens.push({ text: m[1], color: C.comment });
      else if (m[2]) tokens.push({ text: m[2], color: C.tag });
      else if (m[3]) tokens.push({ text: m[3], color: C.attr });
      else if (m[4]) tokens.push({ text: m[4], color: C.number });
      else if (m[5]) tokens.push({ text: m[5], color: C.string });
      last = re.lastIndex;
    }
    if (last < line.length) tokens.push({ text: line.slice(last), color: C.plain });
    return checkPlaceholders(tokens);
  }

  // Python
  if (['python', 'py'].includes(l)) {
    const tokens: Token[] = [];
    const re = /(#[^\n]*)|("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b(?:def|class|import|from|return|if|elif|else|for|while|in|not|and|or|is|True|False|None|lambda|with|as|try|except|finally|raise|pass|break|continue|yield|async|await|global|nonlocal|del|assert|print)\b)|(\b[A-Z][a-zA-Z0-9_]*\b)|(@[\w.]+)|(\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)/g;
    let last = 0, m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      if (m.index > last) tokens.push({ text: line.slice(last, m.index), color: C.plain });
      if (m[1])      tokens.push({ text: m[1], color: C.comment });
      else if (m[2]) tokens.push({ text: m[2], color: C.string });
      else if (m[3]) tokens.push({ text: m[3], color: C.keyword });
      else if (m[4]) tokens.push({ text: m[4], color: C.type });
      else if (m[5]) tokens.push({ text: m[5], color: C.attr });
      else if (m[6]) tokens.push({ text: m[6], color: C.number });
      last = re.lastIndex;
    }
    if (last < line.length) tokens.push({ text: line.slice(last), color: C.plain });
    return checkPlaceholders(tokens);
  }

  // JSON
  if (l === 'json') {
    const tokens: Token[] = [];
    const re = /("(?:[^"\\]|\\.)*"\s*:)|("(?:[^"\\]|\\.)*")|(\b(?:true|false|null)\b)|(-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)/g;
    let last = 0, m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      if (m.index > last) tokens.push({ text: line.slice(last, m.index), color: C.plain });
      if (m[1])      tokens.push({ text: m[1], color: C.attr });
      else if (m[2]) tokens.push({ text: m[2], color: C.string });
      else if (m[3]) tokens.push({ text: m[3], color: C.keyword });
      else if (m[4]) tokens.push({ text: m[4], color: C.number });
      last = re.lastIndex;
    }
    if (last < line.length) tokens.push({ text: line.slice(last), color: C.plain });
    return checkPlaceholders(tokens);
  }

  // Bash / Shell
  if (['bash', 'sh', 'shell'].includes(l)) {
    const tokens: Token[] = [];
    const re = /(#[^\n]*)|(["'])(?:(?=(\\?))\3.)*?\2|(\b(?:echo|cd|ls|mkdir|rm|cp|mv|sudo|export|source|if|then|else|fi|for|do|done|while|case|esac|function|return|exit|set|unset|local|readonly|declare)\b)|(--?[\w-]+)|(\$[\w{][^)\s]*)/g;
    let last = 0, m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      if (m.index > last) tokens.push({ text: line.slice(last, m.index), color: C.plain });
      if (m[1])      tokens.push({ text: m[1], color: C.comment });
      else if (m[2]) tokens.push({ text: m[0], color: C.string });
      else if (m[4]) tokens.push({ text: m[4], color: C.keyword });
      else if (m[5]) tokens.push({ text: m[5], color: C.attr });
      else if (m[6]) tokens.push({ text: m[6], color: C.number });
      last = re.lastIndex;
    }
    if (last < line.length) tokens.push({ text: line.slice(last), color: C.plain });
    return checkPlaceholders(tokens);
  }

  // SQL
  if (l === 'sql') {
    const tokens: Token[] = [];
    const re = /(--[^\n]*)|('(?:[^'\\]|\\.)*')|(\b(?:SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TABLE|INDEX|DATABASE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AS|AND|OR|NOT|IN|IS|NULL|ORDER|BY|GROUP|HAVING|LIMIT|OFFSET|DISTINCT|COUNT|SUM|AVG|MAX|MIN|UNION|ALL|EXISTS|INTO|VALUES|SET|PRIMARY|KEY|FOREIGN|REFERENCES|CASCADE)\b)/gi;
    let last = 0, m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      if (m.index > last) tokens.push({ text: line.slice(last, m.index), color: C.plain });
      if (m[1])      tokens.push({ text: m[1], color: C.comment });
      else if (m[2]) tokens.push({ text: m[2], color: C.string });
      else if (m[3]) tokens.push({ text: m[3].toUpperCase(), color: C.keyword });
      last = re.lastIndex;
    }
    if (last < line.length) tokens.push({ text: line.slice(last), color: C.plain });
    return checkPlaceholders(tokens);
  }

  // Default — plain text with placeholder check
  return checkPlaceholders([{ text: line, color: C.plain }]);
}

// ─────────────────────────────────────────────
//  Blinking cursor
// ─────────────────────────────────────────────
const BlinkingCursor = memo(function BlinkingCursor() {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 0, duration: 500, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]));
    anim.start();
    return () => anim.stop();
  }, []);
  return (
    <Animated.View style={{
      opacity, width: 2, height: 14,
      backgroundColor: C.plain, marginLeft: 1,
      alignSelf: 'center',
    }} />
  );
});

// ─────────────────────────────────────────────
//  Copy button with success flash
// ─────────────────────────────────────────────
const CopyButton = memo(function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = useCallback(async () => {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }, [code]);
  return (
    <TouchableOpacity
      style={hdrStyles.copyBtn}
      onPress={onCopy}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      activeOpacity={0.7}
    >
      <Ionicons
        name={copied ? 'checkmark' : 'copy-outline'}
        size={15}
        color={copied ? '#98c379' : 'rgba(255,255,255,0.55)'}
      />
    </TouchableOpacity>
  );
});

// ─────────────────────────────────────────────
//  Full-screen code viewer (slide-up modal)
// ─────────────────────────────────────────────
const FullScreenViewer = memo(function FullScreenViewer({
  visible, code, language, fileName, onClose,
}: {
  visible: boolean; code: string; language: string; fileName?: string; onClose: () => void;
}) {
  const meta = getLangMeta(language);
  const lines = code.split('\n');
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={fsStyles.root}>
        {/* header */}
        <View style={fsStyles.header}>
          <TouchableOpacity onPress={onClose} style={fsStyles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-down" size={22} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <LangIconBadge lang={language} size={22} />
            <Text style={[fsStyles.langLabel, { color: meta.color }]}>{fileName || meta.label}</Text>
          </View>
          <CopyButton code={code} />
        </View>
        {/* code */}
        <ScrollView style={{ flex: 1, backgroundColor: C.bg }} nestedScrollEnabled showsVerticalScrollIndicator indicatorStyle="white">
          <ScrollView horizontal showsHorizontalScrollIndicator indicatorStyle="white" contentContainerStyle={fsStyles.codeContent}>
            {/* line numbers */}
            <View style={fsStyles.lineNums}>
              {lines.map((_, i) => (
                <Text key={i} style={fsStyles.lineNum}>{i + 1}</Text>
              ))}
            </View>
            {/* code */}
            <View style={fsStyles.codeLines}>
              {lines.map((line, i) => (
                <View key={i} style={fsStyles.codeLine}>
                  {tokenize(line, language).map((t, ti) =>
                    t.isPlaceholder ? (
                      <View key={ti} style={{ backgroundColor: C.phBg, borderRadius: 3 }}>
                        <Text style={[fsStyles.codeText, { color: t.color }]}>{t.text}</Text>
                      </View>
                    ) : (
                      <Text key={ti} style={[fsStyles.codeText, { color: t.color }]}>{t.text}</Text>
                    )
                  )}
                </View>
              ))}
            </View>
          </ScrollView>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
});

// ─────────────────────────────────────────────
//  Main CodeBlock — ChatGPT card style
// ─────────────────────────────────────────────
interface CodeBlockProps {
  code: string;
  language?: string;
  previewHtml?: string;
  fileName?: string;
  apiVersion?: string;
  streaming?: boolean;
  speed?: number;
}

const COLLAPSE_LINES = 14; // lines shown before "Show more"

export const CodeBlock = memo(function CodeBlock({
  code,
  language = 'code',
  fileName,
  streaming = false,
}: CodeBlockProps) {
  const meta = getLangMeta(language);
  const [expanded, setExpanded] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  const [atBottom, setAtBottom] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const vertScrollRef = useRef<ScrollView>(null);

  // ── Streaming character-by-character display ──
  const [displayedCode, setDisplayedCode] = useState(streaming ? '' : code);
  const streamTimerRef = useRef<NodeJS.Timeout | null>(null);
  const charIdxRef = useRef(streaming ? 0 : code.length);
  const codeRef = useRef(code);

  useEffect(() => {
    codeRef.current = code;
    if (!streaming) {
      if (streamTimerRef.current) clearTimeout(streamTimerRef.current);
      setDisplayedCode(code);
      charIdxRef.current = code.length;
      return;
    }
    if (charIdxRef.current >= code.length) {
      setDisplayedCode(code);
      return;
    }
    const tick = () => {
      const full = codeRef.current;
      if (charIdxRef.current < full.length) {
        const end = Math.min(charIdxRef.current + 12, full.length);
        setDisplayedCode(full.slice(0, end));
        charIdxRef.current = end;
        streamTimerRef.current = setTimeout(tick, 16);
      }
    };
    streamTimerRef.current = setTimeout(tick, 0);
    return () => { if (streamTimerRef.current) clearTimeout(streamTimerRef.current); };
  }, [code, streaming]);

  const isActivelyStreaming = streaming && displayedCode.length < code.length;

  const rawLines = displayedCode.split('\n');
  const lineCount = rawLines.length;
  const isLong = lineCount > COLLAPSE_LINES;
  const displayLines = !expanded && isLong ? rawLines.slice(0, COLLAPSE_LINES) : rawLines;

  const hasPlaceholders = hasApiKeyPlaceholders(code);

  // Scroll-to-bottom button inside card
  const handleScrollToBottom = useCallback(() => {
    vertScrollRef.current?.scrollToEnd({ animated: true });
  }, []);

  return (
    <>
      {/* ── Card wrapper ── */}
      <View style={cardStyles.wrapper}>

        {/* ── Header row: [icon + label] ──────── [expand] [copy] ── */}
        <View style={cardStyles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <LangIconBadge lang={language} size={20} />
            <Text style={[cardStyles.langLabel, { color: 'rgba(255,255,255,0.85)' }]}>
              {fileName || meta.label}
            </Text>
          </View>
          <View style={hdrStyles.actions}>
            <TouchableOpacity
              onPress={() => setFullScreen(true)}
              style={hdrStyles.iconBtn}
              hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            >
              <Ionicons name="expand-outline" size={15} color="rgba(255,255,255,0.45)" />
            </TouchableOpacity>
            <CopyButton code={code} />
          </View>
        </View>

        {/* ── Placeholder warning ── */}
        {hasPlaceholders && (
          <View style={cardStyles.phWarn}>
            <Ionicons name="warning-outline" size={12} color={C.placeholder} />
            <Text style={cardStyles.phWarnText}>Replace highlighted values before using</Text>
          </View>
        )}

        {/* ── Code scroll area ── */}
        <View style={cardStyles.scrollOuter}>
          <ScrollView
            ref={vertScrollRef}
            style={{ flex: 1 }}
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            onScroll={(e) => {
              const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
              const dist = contentSize.height - layoutMeasurement.height - contentOffset.y;
              setAtBottom(dist < 40);
            }}
            scrollEventThrottle={16}
          >
            <ScrollView
              ref={scrollRef}
              horizontal
              showsHorizontalScrollIndicator
              indicatorStyle="white"
              decelerationRate="fast"
              contentContainerStyle={cardStyles.codeContent}
            >
              {/* Line numbers */}
              <View style={cardStyles.lineNums}>
                {displayLines.map((_, i) => (
                  <Text key={i} style={cardStyles.lineNum}>{i + 1}</Text>
                ))}
              </View>

              {/* Code lines */}
              <View style={cardStyles.codeLines}>
                {displayLines.map((line, i) => {
                  const isLastLine = i === displayLines.length - 1;
                  return (
                    <View key={i} style={cardStyles.codeLine}>
                      {tokenize(line, language).map((t, ti) =>
                        t.isPlaceholder ? (
                          <View key={ti} style={{ backgroundColor: C.phBg, borderRadius: 3 }}>
                            <Text style={[cardStyles.codeText, { color: t.color }]}>{t.text}</Text>
                          </View>
                        ) : (
                          <Text key={ti} style={[cardStyles.codeText, { color: t.color }]}>{t.text}</Text>
                        )
                      )}
                      {isActivelyStreaming && isLastLine && <BlinkingCursor />}
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </ScrollView>

          {/* Scroll-to-bottom chevron (ChatGPT style) */}
          {isLong && expanded && !atBottom && (
            <TouchableOpacity
              style={cardStyles.scrollDownBtn}
              onPress={handleScrollToBottom}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <View style={cardStyles.scrollDownCircle}>
                <Ionicons name="chevron-down" size={16} color="rgba(255,255,255,0.8)" />
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Show more / less ── */}
        {isLong && (
          <TouchableOpacity style={cardStyles.expandRow} onPress={() => setExpanded(e => !e)} activeOpacity={0.7}>
            <Text style={cardStyles.expandText}>
              {expanded ? 'Show less' : `Show ${lineCount - COLLAPSE_LINES} more lines`}
            </Text>
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={13}
              color="rgba(255,255,255,0.45)"
            />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Full-screen viewer ── */}
      <FullScreenViewer
        visible={fullScreen}
        code={code}
        language={language}
        fileName={fileName}
        onClose={() => setFullScreen(false)}
      />
    </>
  );
});

// Alias
export const StreamingCodeBlock = CodeBlock;

// ─────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────
const hdrStyles = StyleSheet.create({
  actions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  iconBtn: { padding: 5, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  copyBtn: { padding: 5, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
});

const cardStyles = StyleSheet.create({
  wrapper: {
    backgroundColor: C.bg,
    borderRadius: 12,
    overflow: 'hidden',
    marginVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.header,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  langLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  phWarn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 5,
    backgroundColor: 'rgba(229,192,123,0.08)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(229,192,123,0.2)',
  },
  phWarnText: { fontSize: 11, color: C.placeholder, fontWeight: '500', flex: 1 },
  scrollOuter: {
    maxHeight: 340,
    position: 'relative',
  },
  codeContent: {
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    minWidth: '100%',
  },
  lineNums: {
    paddingLeft: 12,
    paddingRight: 10,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: C.border,
    alignItems: 'flex-end',
    minWidth: 36,
  },
  lineNum: {
    fontSize: 12,
    lineHeight: 19,
    color: C.lineNum,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    includeFontPadding: false,
  },
  codeLines: { paddingLeft: 14, paddingRight: 24, flexShrink: 0 },
  codeLine: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    minHeight: 19,
    alignItems: 'center',
  },
  codeText: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    includeFontPadding: false,
  },
  scrollDownBtn: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  scrollDownCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(45,45,45,0.92)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    backgroundColor: C.header,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
  },
  expandText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
  },
});

const fsStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.header,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  closeBtn: { padding: 4 },
  langLabel: { fontSize: 14, fontWeight: '700' },
  codeContent: {
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    minWidth: '100%',
  },
  lineNums: {
    paddingLeft: 14,
    paddingRight: 10,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: C.border,
    alignItems: 'flex-end',
    minWidth: 42,
  },
  lineNum: {
    fontSize: 13,
    lineHeight: 20,
    color: C.lineNum,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    includeFontPadding: false,
  },
  codeLines: { paddingLeft: 14, paddingRight: 28 },
  codeLine: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    minHeight: 20,
    alignItems: 'center',
  },
  codeText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    includeFontPadding: false,
  },
});
