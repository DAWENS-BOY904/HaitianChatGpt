import React, { useState, useCallback, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../hooks/useTheme';

interface StreamingCodeBlockProps {
  code: string;
  language?: string;
  isStreaming?: boolean;
}

// Language → display label
const LANGUAGE_LABELS: Record<string, string> = {
  javascript: 'JavaScript',
  js: 'JavaScript',
  typescript: 'TypeScript',
  ts: 'TypeScript',
  tsx: 'TSX',
  jsx: 'JSX',
  python: 'Python',
  py: 'Python',
  java: 'Java',
  c: 'C',
  cpp: 'C++',
  csharp: 'C#',
  cs: 'C#',
  go: 'Go',
  rust: 'Rust',
  ruby: 'Ruby',
  rb: 'Ruby',
  php: 'PHP',
  swift: 'Swift',
  kotlin: 'Kotlin',
  bash: 'Bash',
  sh: 'Shell',
  shell: 'Shell',
  zsh: 'Zsh',
  html: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  sql: 'SQL',
  json: 'JSON',
  yaml: 'YAML',
  yml: 'YAML',
  xml: 'XML',
  markdown: 'Markdown',
  md: 'Markdown',
  plaintext: 'Plain Text',
  text: 'Plain Text',
};

function getLanguageLabel(lang?: string): string {
  if (!lang) return 'Code';
  return LANGUAGE_LABELS[lang.toLowerCase()] || lang.toUpperCase();
}

// Simple syntax-aware token colors (dark theme)
const TOKEN_COLORS = {
  keyword: '#FF7AB2',
  string: '#FC9A59',
  comment: '#6C6C6C',
  number: '#D9C97C',
  function: '#6BDFFF',
  type: '#DABAFF',
  default: '#E4E4E4',
};

function tokenizeLine(line: string, lang: string): Array<{ text: string; color: string }> {
  const l = lang.toLowerCase();
  const isCode = ['javascript','js','typescript','ts','tsx','jsx','python','py',
    'java','c','cpp','csharp','cs','go','rust','ruby','rb','php','swift','kotlin'].includes(l);

  if (!isCode) return [{ text: line, color: TOKEN_COLORS.default }];

  const tokens: Array<{ text: string; color: string }> = [];

  // Simple tokenizer: comments → strings → keywords → numbers → rest
  const commentPatterns: Record<string, RegExp> = {
    python: /^(#.*)$/,
    rb: /^(#.*)$/,
  };
  const lineCommentRe = commentPatterns[l] || /^(\/\/.*)$/;
  const blockCommentRe = /^(\/\*.*?\*\/)(.*)$/s;
  const stringRe = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g;
  const keywords = /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|async|await|try|catch|throw|new|this|super|extends|implements|interface|type|enum|switch|case|break|continue|default|static|public|private|protected|void|null|undefined|true|false|in|of|do|yield|def|print|pass|not|and|or|lambda|with|as|assert|del|elif|except|finally|global|nonlocal|raise|None|True|False|package|func|struct|map|range|go|chan|select|defer|goto|fallthrough)\b/g;
  const numberRe = /\b(\d+\.?\d*)\b/g;
  const functionRe = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?=\()/g;

  // Check for full-line comment
  const commentMatch = line.match(lineCommentRe);
  if (commentMatch && line.trim().startsWith(l === 'python' || l === 'rb' ? '#' : '//')) {
    return [{ text: line, color: TOKEN_COLORS.comment }];
  }

  // Fall back to splitting by strings, then colorizing keywords in remaining text
  let remaining = line;
  let result: Array<{ text: string; color: string }> = [];

  // Split by string literals
  const parts = remaining.split(stringRe);
  for (const part of parts) {
    if (/^(".*"|'.*'|`.*`)$/s.test(part)) {
      result.push({ text: part, color: TOKEN_COLORS.string });
    } else {
      // Within non-string text, highlight keywords + numbers
      let sub = part;
      const subParts: Array<{ text: string; color: string }> = [];
      const combined = new RegExp(`(${keywords.source}|${numberRe.source}|${functionRe.source}|[^\\w]+|\\w+)`, 'g');
      let m: RegExpExecArray | null;
      combined.lastIndex = 0;
      while ((m = combined.exec(sub)) !== null) {
        const tok = m[0];
        if (/^(const|let|var|function|return|if|else|for|while|class|import|export|from|async|await|try|catch|throw|new|this|super|extends|implements|interface|type|enum|switch|case|break|continue|default|static|public|private|protected|void|null|undefined|true|false|in|of|do|yield|def|print|pass|not|and|or|lambda|with|as|assert|del|elif|except|finally|global|nonlocal|raise|None|True|False|package|func|struct|map|range|go|chan|select|defer|goto|fallthrough)$/.test(tok)) {
          subParts.push({ text: tok, color: TOKEN_COLORS.keyword });
        } else if (/^\d+\.?\d*$/.test(tok)) {
          subParts.push({ text: tok, color: TOKEN_COLORS.number });
        } else {
          subParts.push({ text: tok, color: TOKEN_COLORS.default });
        }
      }
      result = result.concat(subParts);
    }
  }

  return result.length > 0 ? result : [{ text: line, color: TOKEN_COLORS.default }];
}

const COLLAPSE_LINES = 20;

export const StreamingCodeBlock = memo(function StreamingCodeBlock({
  code,
  language = 'plaintext',
  isStreaming = false,
}: StreamingCodeBlockProps) {
  const { isDark } = useTheme();
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_e) {}
  }, [code]);

  const langLabel = getLanguageLabel(language);
  const lines = (code || '').split('\n');
  const isTall = lines.length > COLLAPSE_LINES;
  const displayLines = isTall && !expanded ? lines.slice(0, COLLAPSE_LINES) : lines;

  const bg = isDark ? '#1E1E1E' : '#F5F5F5';
  const headerBg = isDark ? '#252526' : '#E8E8E8';
  const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  const lineNumColor = isDark ? '#555' : '#AAA';
  const textColor = isDark ? TOKEN_COLORS.default : '#1A1A1A';

  return (
    <View style={[styles.container, { backgroundColor: bg, borderColor }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: headerBg, borderBottomColor: borderColor }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.langDot, { backgroundColor: isDark ? '#10A37F' : '#10A37F' }]} />
          <Text style={[styles.langLabel, { color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)' }]}>
            {langLabel}
          </Text>
          {isStreaming ? (
            <View style={[styles.streamingBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
              <Text style={[styles.streamingText, { color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }]}>●</Text>
            </View>
          ) : null}
        </View>
        <TouchableOpacity
          onPress={handleCopy}
          style={[styles.copyBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <Ionicons
            name={copied ? 'checkmark' : 'copy-outline'}
            size={14}
            color={copied ? '#34C759' : (isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)')}
          />
          <Text style={[styles.copyLabel, { color: copied ? '#34C759' : (isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)') }]}>
            {copied ? 'Copied!' : 'Copy'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Code content */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        bounces={false}
        style={{ maxHeight: isTall && !expanded ? 320 : undefined }}
      >
        <View style={styles.codeContent}>
          {displayLines.map((line, i) => {
            const tokens = tokenizeLine(line, language);
            const lineNum = i + 1;
            return (
              <View key={i} style={styles.codeLine}>
                <Text style={[styles.lineNumber, { color: lineNumColor }]}>
                  {String(lineNum).padStart(String(lines.length).length, ' ')}
                </Text>
                <Text style={styles.lineContent}>
                  {tokens.map((tok, ti) => (
                    <Text key={ti} style={{ color: isDark ? tok.color : textColor }}>
                      {tok.text}
                    </Text>
                  ))}
                </Text>
              </View>
            );
          })}
          {isTall && !expanded ? (
            <View style={styles.fadeOverlay} pointerEvents="none" />
          ) : null}
        </View>
      </ScrollView>

      {/* Expand / Collapse toggle */}
      {isTall ? (
        <TouchableOpacity
          style={[styles.expandBtn, { borderTopColor: borderColor, backgroundColor: headerBg }]}
          onPress={() => setExpanded(v => !v)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)'}
          />
          <Text style={[styles.expandLabel, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)' }]}>
            {expanded ? 'Show less' : `Show ${lines.length - COLLAPSE_LINES} more lines`}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginVertical: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  langDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  langLabel: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  streamingBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  streamingText: {
    fontSize: 10,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  copyLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  codeContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    minWidth: '100%',
  },
  codeLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 1,
  },
  lineNumber: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 20,
    marginRight: 12,
    minWidth: 20,
    textAlign: 'right',
    userSelect: 'none',
  },
  lineContent: {
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 20,
    flex: 1,
  },
  fadeOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 48,
  },
  expandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  expandLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
});

export default StreamingCodeBlock;
