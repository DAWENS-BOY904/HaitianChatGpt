import React, { useState, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { BorderRadius } from '../constants/theme';

interface CodeBlockProps {
  code: string;
  language?: string;
}

/* ────────────── SYNTAX HIGHLIGHT ────────────── */

type Token = { text: string; color: string };

const COLORS = {
  keyword:  '#FF79C6',   // pink
  string:   '#F1FA8C',   // yellow
  comment:  '#6272A4',   // muted blue
  number:   '#BD93F9',   // purple
  operator: '#FF79C6',   // pink
  tag:      '#FF5555',   // red
  attr:     '#50FA7B',   // green
  attrVal:  '#F1FA8C',   // yellow
  type:     '#8BE9FD',   // cyan
  fn:       '#50FA7B',   // green
  plain:    '#F8F8F2',   // foreground
};

function tokenize(code: string, lang: string): Token[] {
  const l = lang.toLowerCase();

  // HTML / XML
  if (l === 'html' || l === 'xml' || l === 'jsx') {
    const tokens: Token[] = [];
    const re = /(<!--[\s\S]*?-->)|(<\/?[\w-]+)|(\/?>)|(\s[\w-:]+)(\s*=\s*)("[^"]*"|'[^']*')/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(code)) !== null) {
      if (m.index > last) tokens.push({ text: code.slice(last, m.index), color: COLORS.plain });
      if (m[1])  tokens.push({ text: m[1], color: COLORS.comment });
      else if (m[2]) {
        tokens.push({ text: m[2], color: COLORS.tag });
        if (m[3]) tokens.push({ text: m[3], color: COLORS.tag });
        if (m[4]) tokens.push({ text: m[4], color: COLORS.attr });
        if (m[5]) tokens.push({ text: m[5], color: COLORS.plain });
        if (m[6]) tokens.push({ text: m[6], color: COLORS.attrVal });
      } else if (m[3]) tokens.push({ text: m[3], color: COLORS.tag });
      last = re.lastIndex;
    }
    if (last < code.length) tokens.push({ text: code.slice(last), color: COLORS.plain });
    return tokens;
  }

  // JS / TS / TSX
  if (['js','ts','tsx','javascript','typescript','jsx'].includes(l)) {
    const tokens: Token[] = [];
    const re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`[^`]*`)|(\b(?:const|let|var|function|return|import|export|default|from|if|else|for|while|class|extends|new|typeof|instanceof|async|await|try|catch|finally|throw|of|in|switch|case|break|continue|void|null|undefined|true|false|this|super)\b)|(\b[A-Z][a-zA-Z0-9_]*\b)|(\b\d+(\.\d+)?\b)|([+\-*/%=<>!&|?:,;.{}[\]()]+)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(code)) !== null) {
      if (m.index > last) tokens.push({ text: code.slice(last, m.index), color: COLORS.plain });
      if (m[1])      tokens.push({ text: m[1], color: COLORS.comment });
      else if (m[2]) tokens.push({ text: m[2], color: COLORS.string });
      else if (m[3]) tokens.push({ text: m[3], color: COLORS.keyword });
      else if (m[4]) tokens.push({ text: m[4], color: COLORS.type });
      else if (m[5]) tokens.push({ text: m[5], color: COLORS.number });
      else if (m[7]) tokens.push({ text: m[7], color: COLORS.operator });
      last = re.lastIndex;
    }
    if (last < code.length) tokens.push({ text: code.slice(last), color: COLORS.plain });
    return tokens;
  }

  // CSS
  if (l === 'css' || l === 'scss') {
    const tokens: Token[] = [];
    const re = /(\/\*[\s\S]*?\*\/)|([.#]?[\w-]+\s*(?={))|({|})|([a-z-]+\s*(?=:))|(:)|(["'][^"']*["'])|(\b\d+(?:px|em|rem|%|vh|vw|s|ms)?\b)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(code)) !== null) {
      if (m.index > last) tokens.push({ text: code.slice(last, m.index), color: COLORS.plain });
      if (m[1])      tokens.push({ text: m[1], color: COLORS.comment });
      else if (m[2]) tokens.push({ text: m[2], color: COLORS.tag });
      else if (m[3]) tokens.push({ text: m[3], color: COLORS.operator });
      else if (m[4]) tokens.push({ text: m[4], color: COLORS.attr });
      else if (m[5]) tokens.push({ text: m[5], color: COLORS.operator });
      else if (m[6]) tokens.push({ text: m[6], color: COLORS.string });
      else if (m[7]) tokens.push({ text: m[7], color: COLORS.number });
      last = re.lastIndex;
    }
    if (last < code.length) tokens.push({ text: code.slice(last), color: COLORS.plain });
    return tokens;
  }

  // Python
  if (l === 'python' || l === 'py') {
    const tokens: Token[] = [];
    const re = /(#[^\n]*)|("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b(?:def|class|import|from|return|if|elif|else|for|while|in|not|and|or|is|True|False|None|lambda|with|as|try|except|finally|raise|pass|break|continue|yield|global|nonlocal|del|assert)\b)|(\b[A-Z][a-zA-Z0-9_]*\b)|(\b\d+(\.\d+)?\b)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(code)) !== null) {
      if (m.index > last) tokens.push({ text: code.slice(last, m.index), color: COLORS.plain });
      if (m[1])      tokens.push({ text: m[1], color: COLORS.comment });
      else if (m[2]) tokens.push({ text: m[2], color: COLORS.string });
      else if (m[3]) tokens.push({ text: m[3], color: COLORS.keyword });
      else if (m[4]) tokens.push({ text: m[4], color: COLORS.type });
      else if (m[5]) tokens.push({ text: m[5], color: COLORS.number });
      last = re.lastIndex;
    }
    if (last < code.length) tokens.push({ text: code.slice(last), color: COLORS.plain });
    return tokens;
  }

  // Fallback — no highlight
  return [{ text: code, color: COLORS.plain }];
}

/* ────────────── LINE NUMBERS ────────────── */

function buildLines(code: string, lang: string): { tokens: Token[]; lineNum: number }[] {
  const rawLines = code.split('\n');
  return rawLines.map((line, i) => ({
    tokens: tokenize(line, lang),
    lineNum: i + 1,
  }));
}

/* ────────────── COMPONENT ────────────── */

export const CodeBlock = memo(function CodeBlock({
  code,
  language = 'code',
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const onCopy = async () => {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const lineCount = (code.match(/\n/g) || []).length + 1;
  const isLong = lineCount > 12;
  const displayCode = (!expanded && isLong)
    ? code.split('\n').slice(0, 12).join('\n')
    : code;

  const lines = buildLines(displayCode, language);

  return (
    <View style={styles.wrapper}>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.dots}>
          <View style={[styles.dot, { backgroundColor: '#FF5F57' }]} />
          <View style={[styles.dot, { backgroundColor: '#FEBC2E' }]} />
          <View style={[styles.dot, { backgroundColor: '#28C840' }]} />
        </View>
        <Text style={styles.langLabel}>{language}</Text>
        <TouchableOpacity onPress={onCopy} style={styles.copyBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons
            name={copied ? 'checkmark-circle' : 'copy-outline'}
            size={15}
            color={copied ? '#50FA7B' : '#888'}
          />
          <Text style={[styles.copyText, copied && styles.copiedText]}>
            {copied ? 'Copied!' : 'Copy'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* CODE AREA — vertical scroll */}
      <ScrollView
        style={[styles.scrollArea, expanded ? styles.scrollExpanded : styles.scrollCollapsed]}
        nestedScrollEnabled
        showsVerticalScrollIndicator={true}
        persistentScrollbar={true}
        indicatorStyle="white"
      >
        {/* horizontal scroll inside */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={true}
          contentContainerStyle={styles.hContent}
          indicatorStyle="white"
        >
          {/* Line numbers */}
          <View style={styles.lineNumbers}>
            {lines.map(l => (
              <Text key={l.lineNum} style={styles.lineNumber}>{l.lineNum}</Text>
            ))}
          </View>

          {/* Code lines */}
          <View style={styles.codeLines}>
            {lines.map((l, i) => (
              <View key={i} style={styles.codeLine}>
                {l.tokens.map((t, ti) => (
                  <Text key={ti} style={[styles.codeText, { color: t.color }]}>
                    {t.text}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      </ScrollView>

      {/* SHOW MORE / LESS */}
      {isLong && (
        <TouchableOpacity style={styles.expandBtn} onPress={() => setExpanded(e => !e)}>
          <Text style={styles.expandText}>
            {expanded ? 'Show less ▲' : `Show all ${lineCount} lines ▼`}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

/* ────────────── STYLES ────────────── */

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#282A36',
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#44475A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#21222C',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#44475A',
    gap: 8,
  },
  dots: {
    flexDirection: 'row',
    gap: 5,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  langLabel: {
    flex: 1,
    fontSize: 11,
    color: '#6272A4',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'center',
    textTransform: 'lowercase',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  copyText: {
    fontSize: 12,
    color: '#888',
  },
  copiedText: {
    color: '#50FA7B',
  },
  scrollArea: {
    maxWidth: '100%',
  },
  scrollCollapsed: {
    maxHeight: 240,
  },
  scrollExpanded: {
    maxHeight: 480,
  },
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
    borderRightColor: '#44475A',
    alignItems: 'flex-end',
    minWidth: 38,
  },
  lineNumber: {
    fontSize: 12,
    lineHeight: 18,
    color: '#6272A4',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    includeFontPadding: false,
  },
  codeLines: {
    paddingLeft: 12,
    paddingRight: 20,
    flex: 1,
  },
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
    backgroundColor: '#21222C',
    borderTopWidth: 1,
    borderTopColor: '#44475A',
  },
  expandText: {
    fontSize: 12,
    color: '#BD93F9',
    fontWeight: '600',
  },
});
