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
import { WebView } from 'react-native-webview';
import { BorderRadius } from '../constants/theme';

const { width: SCREEN_W } = Dimensions.get('window');

// ─────────────────────────────────────────────
//  ChatGPT-inspired dark theme (One Dark Pro)
// ─────────────────────────────────────────────
const C = {
  bg:         '#1e1e1e',
  header:     '#2d2d2d',
  border:     '#3e3e3e',
  scrollBg:   '#161616',
  keyword:    '#c678dd',
  string:     '#98c379',
  comment:    '#5c6370',
  number:     '#d19a66',
  tag:        '#e06c75',
  attr:       '#e5c07b',
  attrVal:    '#98c379',
  type:       '#61afef',
  plain:      '#abb2bf',
  lineNum:    '#4a4a4a',
  placeholder:'#e5c07b',
  phBg:       'rgba(229,192,123,0.12)',
  // terminal
  termBg:     '#0d1117',
  termText:   '#39ff14',
  termPrompt: '#58a6ff',
};

// ─────────────────────────────────────────────
//  Language metadata
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

// ─── Which languages get run/play button ─────────────────────────────────────
function canRun(lang: string): boolean {
  const l = (lang || '').toLowerCase();
  return ['html', 'htm', 'css', 'javascript', 'js', 'jsx', 'typescript', 'ts', 'tsx',
          'python', 'py', 'bash', 'sh'].includes(l);
}

// ─── Which languages get live preview tab ────────────────────────────────────
function hasPreviewTab(lang: string): boolean {
  const l = (lang || '').toLowerCase();
  return ['html', 'htm', 'css', 'javascript', 'js', 'jsx', 'typescript', 'ts', 'tsx'].includes(l);
}

// ─── Is terminal/bash ─────────────────────────────────────────────────────────
function isTerminalLang(lang: string): boolean {
  return ['bash', 'sh', 'shell'].includes((lang || '').toLowerCase());
}

// ─── Is Python ────────────────────────────────────────────────────────────────
function isPythonLang(lang: string): boolean {
  return ['python', 'py'].includes((lang || '').toLowerCase());
}

// ─────────────────────────────────────────────
//  Language icon badge
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
//  Syntax tokenizer
// ─────────────────────────────────────────────
function tokenize(line: string, lang: string): Token[] {
  const l = (lang || '').toLowerCase();

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
    <Animated.View style={{ opacity, width: 2, height: 14, backgroundColor: C.plain, marginLeft: 1, alignSelf: 'center' }} />
  );
});

// ─────────────────────────────────────────────
//  Copy button
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
      style={hdrStyles.iconBtn}
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
//  Build HTML for WebView preview
// ─────────────────────────────────────────────
function buildPreviewHtml(code: string, lang: string): string {
  const l = (lang || '').toLowerCase();

  // If the code is already a full HTML document
  if (['html', 'htm'].includes(l)) {
    if (code.includes('<!DOCTYPE') || code.includes('<html')) {
      return code;
    }
    // Partial HTML — wrap it
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, sans-serif; background: #fff; }
  </style>
</head>
<body>${code}</body>
</html>`;
  }

  // CSS only
  if (l === 'css' || l === 'scss') {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>${code}</style>
</head>
<body>
  <div class="container">
    <h1>CSS Preview</h1>
    <p>Your styles are applied here.</p>
    <button>Sample Button</button>
    <div class="box">Sample Box</div>
  </div>
</body>
</html>`;
  }

  // JavaScript / TypeScript
  if (['js', 'jsx', 'javascript', 'ts', 'tsx', 'typescript'].includes(l)) {
    // Strip TS-only syntax for browser execution
    const jsCode = code
      .replace(/:\s*(string|number|boolean|any|void|never|unknown|object|null|undefined)(\[\])?\b/g, '')
      .replace(/interface\s+\w+\s*\{[^}]*\}/g, '')
      .replace(/<[A-Z][a-zA-Z]*>/g, '')
      .replace(/\bconst\s+(\w+)\s*:\s*\w+\s*=/g, 'const $1 =');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { margin: 0; font-family: monospace; background: #0d1117; color: #c9d1d9; padding: 16px; }
    #output { white-space: pre-wrap; font-size: 14px; line-height: 1.6; }
    .log { color: #58a6ff; }
    .error { color: #ff7b72; }
    .result { color: #3fb950; }
  </style>
</head>
<body>
  <div id="output"></div>
  <script>
    const out = document.getElementById('output');
    const origLog = console.log;
    const origErr = console.error;
    const origWarn = console.warn;
    function appendLine(text, cls) {
      const el = document.createElement('div');
      el.className = cls || 'log';
      el.textContent = text;
      out.appendChild(el);
    }
    console.log = (...args) => { origLog(...args); appendLine(args.map(String).join(' '), 'log'); };
    console.error = (...args) => { origErr(...args); appendLine('Error: ' + args.join(' '), 'error'); };
    console.warn = (...args) => { origWarn(...args); appendLine('Warning: ' + args.join(' '), 'log'); };
    window.onerror = (msg, src, line) => { appendLine('Runtime Error (line ' + line + '): ' + msg, 'error'); };
    try {
      ${jsCode}
    } catch(e) { appendLine('Execution Error: ' + e.message, 'error'); }
  </script>
</body>
</html>`;
  }

  return `<!DOCTYPE html><html><body><pre>${code}</pre></body></html>`;
}

// ─────────────────────────────────────────────
//  Build terminal HTML for bash output
// ─────────────────────────────────────────────
function buildTerminalHtml(code: string): string {
  const lines = code.split('\n');
  const linesHtml = lines.map(line => {
    const escaped = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    if (line.trim().startsWith('#')) {
      return `<div class="comment">${escaped}</div>`;
    }
    return `<div><span class="prompt">$ </span><span class="cmd">${escaped}</span></div>
<div class="output">[Command output would appear here]</div>`;
  });
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: ${C.termBg}; color: ${C.termText}; font-family: 'Courier New', monospace; font-size: 13px; padding: 16px; line-height: 1.7; }
    .prompt { color: ${C.termPrompt}; font-weight: bold; }
    .cmd { color: #e6edf3; }
    .output { color: rgba(57,255,20,0.65); margin-left: 14px; margin-bottom: 4px; font-size: 12px; }
    .comment { color: #5c6370; font-style: italic; }
    .header { color: ${C.termPrompt}; border-bottom: 1px solid #30363d; padding-bottom: 8px; margin-bottom: 12px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">Terminal Simulation — commands shown below</div>
  ${linesHtml.join('\n')}
</body>
</html>`;
}

// ─────────────────────────────────────────────
//  Build Python simulation HTML
// ─────────────────────────────────────────────
function buildPythonHtml(code: string): string {
  const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #0d1117; color: #c9d1d9; font-family: 'Courier New', monospace; font-size: 13px; padding: 16px; line-height: 1.7; }
    .header { color: #58a6ff; border-bottom: 1px solid #30363d; padding-bottom: 8px; margin-bottom: 12px; font-size: 12px; }
    .code-area { background: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 12px; white-space: pre-wrap; margin-bottom: 12px; color: #e6edf3; }
    .output-label { color: #3fb950; font-weight: bold; margin-bottom: 4px; font-size: 12px; }
    .output { background: #0d1117; border: 1px solid #30363d; border-radius: 4px; padding: 10px; color: #3fb950; white-space: pre-wrap; font-size: 12px; min-height: 48px; }
    .note { color: #8b949e; font-size: 11px; margin-top: 8px; font-style: italic; }
  </style>
</head>
<body>
  <div class="header">Python Code Preview</div>
  <div class="code-area">${escaped}</div>
  <div class="output-label">Output</div>
  <div class="output">[Python output — run in a Python environment to see real results]</div>
  <div class="note">Note: Python runs server-side. This is a static preview of your code.</div>
</body>
</html>`;
}

// ─────────────────────────────────────────────
//  Full-screen code runner modal
// ─────────────────────────────────────────────
const CodeRunnerModal = memo(function CodeRunnerModal({
  visible, code, language, fileName, onClose,
}: {
  visible: boolean; code: string; language: string; fileName?: string; onClose: () => void;
}) {
  const meta = getLangMeta(language);
  const [tab, setTab] = useState<'preview' | 'code'>('preview');
  const isTerminal = isTerminalLang(language);
  const isPython = isPythonLang(language);
  const isHtmlLike = hasPreviewTab(language);

  let previewHtml = '';
  let tabLabel = 'Preview';
  if (isTerminal) { previewHtml = buildTerminalHtml(code); tabLabel = 'Terminal'; }
  else if (isPython) { previewHtml = buildPythonHtml(code); tabLabel = 'Output'; }
  else { previewHtml = buildPreviewHtml(code, language); tabLabel = 'Preview'; }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={runStyles.root}>
        {/* Header */}
        <View style={runStyles.header}>
          <TouchableOpacity onPress={onClose} style={runStyles.closeBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="chevron-down" size={22} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <LangIconBadge lang={language} size={22} />
            <Text style={[runStyles.langLabel, { color: meta.color }]}>{fileName || meta.label}</Text>
          </View>
          <CopyButton code={code} />
        </View>

        {/* Tab bar */}
        <View style={runStyles.tabBar}>
          <TouchableOpacity
            style={[runStyles.tab, tab === 'preview' && runStyles.tabActive]}
            onPress={() => setTab('preview')}
          >
            <Ionicons
              name={isTerminal ? 'terminal-outline' : isPython ? 'code-slash-outline' : 'globe-outline'}
              size={15}
              color={tab === 'preview' ? '#fff' : 'rgba(255,255,255,0.45)'}
            />
            <Text style={[runStyles.tabText, tab === 'preview' && runStyles.tabTextActive]}>{tabLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[runStyles.tab, tab === 'code' && runStyles.tabActive]}
            onPress={() => setTab('code')}
          >
            <Ionicons name="code-slash" size={15} color={tab === 'code' ? '#fff' : 'rgba(255,255,255,0.45)'} />
            <Text style={[runStyles.tabText, tab === 'code' && runStyles.tabTextActive]}>Code</Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        {tab === 'preview' ? (
          <View style={{ flex: 1, backgroundColor: isTerminal || isPython ? C.termBg : '#fff' }}>
            <WebView
              source={{ html: previewHtml }}
              style={{ flex: 1 }}
              javaScriptEnabled
              domStorageEnabled
              originWhitelist={['*']}
              scrollEnabled
            />
          </View>
        ) : (
          // Code tab — full scrollable view
          <ScrollView style={{ flex: 1, backgroundColor: C.bg }} nestedScrollEnabled showsVerticalScrollIndicator indicatorStyle="white">
            <ScrollView horizontal showsHorizontalScrollIndicator indicatorStyle="white" contentContainerStyle={fsStyles.codeContent}>
              <View style={fsStyles.lineNums}>
                {code.split('\n').map((_, i) => (
                  <Text key={i} style={fsStyles.lineNum}>{i + 1}</Text>
                ))}
              </View>
              <View style={fsStyles.codeLines}>
                {code.split('\n').map((line, i) => (
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
        )}
      </SafeAreaView>
    </Modal>
  );
});

// ─────────────────────────────────────────────
//  Full-screen code viewer (existing, kept for expand button)
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
        <ScrollView style={{ flex: 1, backgroundColor: C.bg }} nestedScrollEnabled showsVerticalScrollIndicator indicatorStyle="white">
          <ScrollView horizontal showsHorizontalScrollIndicator indicatorStyle="white" contentContainerStyle={fsStyles.codeContent}>
            <View style={fsStyles.lineNums}>
              {lines.map((_, i) => (
                <Text key={i} style={fsStyles.lineNum}>{i + 1}</Text>
              ))}
            </View>
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
//  Inline Preview Tab (HTML/JS only — inside card)
// ─────────────────────────────────────────────
const InlinePreviewTab = memo(function InlinePreviewTab({ code, language }: { code: string; language: string }) {
  const html = buildPreviewHtml(code, language);
  const [loaded, setLoaded] = useState(false);
  return (
    <View style={{ height: 260, backgroundColor: '#fff', borderBottomLeftRadius: 12, borderBottomRightRadius: 12, overflow: 'hidden' }}>
      {!loaded && (
        <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f5f5', zIndex: 1 }}>
          <Ionicons name="globe-outline" size={28} color="#ccc" />
          <Text style={{ color: '#aaa', fontSize: 13, marginTop: 8 }}>Loading preview...</Text>
        </View>
      )}
      <WebView
        source={{ html }}
        style={{ flex: 1 }}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        onLoad={() => setLoaded(true)}
        scrollEnabled
      />
    </View>
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

const COLLAPSE_LINES = 14;

export const CodeBlock = memo(function CodeBlock({
  code,
  language = 'code',
  fileName,
  streaming = false,
}: CodeBlockProps) {
  const meta = getLangMeta(language);
  const [expanded, setExpanded] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  const [runnerOpen, setRunnerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'code' | 'preview'>('code');
  const [atBottom, setAtBottom] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const vertScrollRef = useRef<ScrollView>(null);

  const showRunBtn = canRun(language);
  const showPreviewTab = hasPreviewTab(language);
  const isTerminal = isTerminalLang(language);
  const isPython = isPythonLang(language);

  // ── Streaming display ──
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

  const handleScrollToBottom = useCallback(() => {
    vertScrollRef.current?.scrollToEnd({ animated: true });
  }, []);

  // Run/play button label
  const runLabel = isTerminal ? 'Terminal' : isPython ? 'Output' : 'Preview';
  const runIcon: any = isTerminal ? 'terminal-outline' : isPython ? 'play-circle-outline' : 'play-circle-outline';

  return (
    <>
      <View style={cardStyles.wrapper}>

        {/* ── Header ── */}
        <View style={cardStyles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <LangIconBadge lang={language} size={20} />
            <Text style={[cardStyles.langLabel, { color: 'rgba(255,255,255,0.85)' }]}>
              {fileName || meta.label}
            </Text>
          </View>
          <View style={hdrStyles.actions}>
            {/* Expand button */}
            <TouchableOpacity
              onPress={() => setFullScreen(true)}
              style={hdrStyles.iconBtn}
              hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            >
              <Ionicons name="expand-outline" size={15} color="rgba(255,255,255,0.45)" />
            </TouchableOpacity>

            {/* Run / Play button — only for supported languages */}
            {showRunBtn && (
              <TouchableOpacity
                onPress={() => setRunnerOpen(true)}
                style={[hdrStyles.iconBtn, hdrStyles.runBtn]}
                hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
              >
                <Ionicons name={runIcon} size={15} color="#30D158" />
              </TouchableOpacity>
            )}

            <CopyButton code={code} />
          </View>
        </View>

        {/* ── Preview tab selector (HTML/JS only) ── */}
        {showPreviewTab && !isActivelyStreaming && (
          <View style={cardStyles.tabRow}>
            <TouchableOpacity
              style={[cardStyles.tabBtn, activeTab === 'code' && cardStyles.tabBtnActive]}
              onPress={() => setActiveTab('code')}
            >
              <Ionicons name="code-slash" size={12} color={activeTab === 'code' ? '#fff' : 'rgba(255,255,255,0.4)'} />
              <Text style={[cardStyles.tabBtnText, activeTab === 'code' && { color: '#fff' }]}>Code</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[cardStyles.tabBtn, activeTab === 'preview' && cardStyles.tabBtnActive]}
              onPress={() => setActiveTab('preview')}
            >
              <Ionicons name="globe-outline" size={12} color={activeTab === 'preview' ? '#fff' : 'rgba(255,255,255,0.4)'} />
              <Text style={[cardStyles.tabBtnText, activeTab === 'preview' && { color: '#fff' }]}>Preview</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Placeholder warning ── */}
        {hasPlaceholders && (
          <View style={cardStyles.phWarn}>
            <Ionicons name="warning-outline" size={12} color={C.placeholder} />
            <Text style={cardStyles.phWarnText}>Replace highlighted values before using</Text>
          </View>
        )}

        {/* ── Preview tab content ── */}
        {showPreviewTab && activeTab === 'preview' && !isActivelyStreaming ? (
          <InlinePreviewTab code={code} language={language} />
        ) : (
          /* ── Code scroll area ── */
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
                <View style={cardStyles.lineNums}>
                  {displayLines.map((_, i) => (
                    <Text key={i} style={cardStyles.lineNum}>{i + 1}</Text>
                  ))}
                </View>
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
        )}

        {/* ── Show more / less ── */}
        {isLong && activeTab === 'code' && (
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

        {/* ── Run button strip at bottom (terminal feel) ── */}
        {showRunBtn && !isActivelyStreaming && activeTab === 'code' && (
          <TouchableOpacity style={cardStyles.runStrip} onPress={() => setRunnerOpen(true)} activeOpacity={0.8}>
            <Ionicons name={runIcon} size={14} color="#30D158" />
            <Text style={cardStyles.runStripText}>{runLabel}</Text>
            <Ionicons name="chevron-forward" size={13} color="rgba(48,209,88,0.6)" />
          </TouchableOpacity>
        )}
      </View>

      {/* Modals */}
      <FullScreenViewer
        visible={fullScreen}
        code={code}
        language={language}
        fileName={fileName}
        onClose={() => setFullScreen(false)}
      />
      <CodeRunnerModal
        visible={runnerOpen}
        code={code}
        language={language}
        fileName={fileName}
        onClose={() => setRunnerOpen(false)}
      />
    </>
  );
});

export const StreamingCodeBlock = CodeBlock;

// ─────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────
const hdrStyles = StyleSheet.create({
  actions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  iconBtn: { padding: 5, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  runBtn: { backgroundColor: 'rgba(48,209,88,0.1)', borderRadius: 6 },
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
  langLabel: { fontSize: 13, fontWeight: '600', letterSpacing: 0.1 },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: C.header,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 6,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  tabBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
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
  scrollOuter: { maxHeight: 340, position: 'relative' },
  codeContent: { paddingVertical: 12, flexDirection: 'row', alignItems: 'flex-start', minWidth: '100%' },
  lineNums: {
    paddingLeft: 12,
    paddingRight: 10,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: C.border,
    alignItems: 'flex-end',
    minWidth: 36,
  },
  lineNum: {
    fontSize: 12, lineHeight: 19, color: C.lineNum,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    includeFontPadding: false,
  },
  codeLines: { paddingLeft: 14, paddingRight: 24, flexShrink: 0 },
  codeLine: { flexDirection: 'row', flexWrap: 'nowrap', minHeight: 19, alignItems: 'center' },
  codeText: {
    fontSize: 13, lineHeight: 19,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    includeFontPadding: false,
  },
  scrollDownBtn: { position: 'absolute', bottom: 10, alignSelf: 'center', left: 0, right: 0, alignItems: 'center' },
  scrollDownCircle: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(45,45,45,0.92)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  expandRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 9, backgroundColor: C.header,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border,
  },
  expandText: { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
  runStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: 'rgba(48,209,88,0.06)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(48,209,88,0.15)',
  },
  runStripText: { fontSize: 12, color: '#30D158', fontWeight: '600', flex: 1 },
});

const fsStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.header, paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border,
  },
  closeBtn: { padding: 4 },
  langLabel: { fontSize: 14, fontWeight: '700' },
  codeContent: { paddingVertical: 12, flexDirection: 'row', alignItems: 'flex-start', minWidth: '100%' },
  lineNums: {
    paddingLeft: 14, paddingRight: 10,
    borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: C.border,
    alignItems: 'flex-end', minWidth: 42,
  },
  lineNum: {
    fontSize: 13, lineHeight: 20, color: C.lineNum,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    includeFontPadding: false,
  },
  codeLines: { paddingLeft: 14, paddingRight: 28 },
  codeLine: { flexDirection: 'row', flexWrap: 'nowrap', minHeight: 20, alignItems: 'center' },
  codeText: {
    fontSize: 14, lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    includeFontPadding: false,
  },
});

const runStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.header, paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border,
  },
  closeBtn: { padding: 4 },
  langLabel: { fontSize: 14, fontWeight: '700' },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: C.header,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
    paddingHorizontal: 14,
    paddingBottom: 10,
    paddingTop: 8,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'transparent',
  },
  tabActive: { backgroundColor: 'rgba(255,255,255,0.12)' },
  tabText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.45)' },
  tabTextActive: { color: '#fff' },
});
if you see this make the change in real time all make this better li kite space san message re look photo an and make it better also make thinking better and fix home page lag and bug le message yo ap ekri fix all better good real.
