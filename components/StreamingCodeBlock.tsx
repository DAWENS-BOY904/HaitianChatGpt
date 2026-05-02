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
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { WebView } from 'react-native-webview';

const { width: SCREEN_W } = Dimensions.get('window');

// ═══════════════════════════════════════════════════
//  THEME
// ═══════════════════════════════════════════════════
const C = {
  bg:          '#1e1e1e',
  header:      '#2d2d2d',
  border:      '#3e3e3e',
  scrollBg:    '#161616',
  keyword:     '#c678dd',
  string:      '#98c379',
  comment:     '#5c6370',
  number:      '#d19a66',
  tag:         '#e06c75',
  attr:        '#e5c07b',
  attrVal:     '#98c379',
  type:        '#61afef',
  plain:       '#abb2bf',
  lineNum:     '#4a4a4a',
  placeholder: '#e5c07b',
  phBg:        'rgba(229,192,123,0.12)',
  termBg:      '#0d1117',
  termText:    '#39ff14',
  termPrompt:  '#58a6ff',
};

// ═══════════════════════════════════════════════════
//  LANGUAGE METADATA & ICONS
// ═══════════════════════════════════════════════════

interface LangMeta {
  label: string;
  color: string;
  iconUrl: string | null; // null = use fallback SVG
}

const ICONS = {
  js:      'https://upload.wikimedia.org/wikipedia/commons/6/6a/JavaScript-logo.png',
  ts:      'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Typescript_logo_2020.svg/960px-Typescript_logo_2020.svg.png',
  html:    'https://www.w3.org/html/logo/downloads/HTML5_Logo_512.png',
  css:     'https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/CSS3_logo.svg/512px-CSS3_logo.svg.png',
  python:  'https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media/python-programming-language-icon.png',
  java:    'https://images.vexels.com/media/users/3/166401/isolated/preview/b82aa7ac3f736dd78570dd3fa3fa9e24-java-programming-language-icon.png',
  react:   'https://images.icon-icons.com/2699/PNG/512/reactjs_logo_icon_170805.png',
  json:    'https://cdn-icons-png.flaticon.com/512/136/136525.png',
  go:      'https://go.dev/blog/go-brand/Go-Logo/SVG/Go-Logo_Blue.svg',
  rust:    'https://www.rust-lang.org/logos/rust-logo-512x512.png',
  php:     'https://www.php.net/images/logos/new-php-logo.svg',
  ruby:    'https://upload.wikimedia.org/wikipedia/commons/7/73/Ruby_logo.svg',
  swift:   'https://developer.apple.com/assets/elements/icons/swift/swift-64x64_2x.png',
  kotlin:  'https://upload.wikimedia.org/wikipedia/commons/7/74/Kotlin_Icon.png',
  dart:    'https://upload.wikimedia.org/wikipedia/commons/7/7e/Dart-logo.png',
  c:       'https://upload.wikimedia.org/wikipedia/commons/1/19/C_Logo.png',
  cpp:     'https://upload.wikimedia.org/wikipedia/commons/1/18/ISO_C%2B%2B_Logo.svg',
  cs:      'https://upload.wikimedia.org/wikipedia/commons/4/4f/Csharp_Logo.png',
  docker:  'https://www.docker.com/wp-content/uploads/2022/03/vertical-logo-monochromatic.png',
  graphql: 'https://upload.wikimedia.org/wikipedia/commons/1/17/GraphQL_Logo.svg',
  sql:     'https://www.svgrepo.com/show/331760/sql-database-generic.svg',
  bash:    'https://upload.wikimedia.org/wikipedia/commons/4/4b/Bash_Logo_Colored.svg',
  lua:     'https://upload.wikimedia.org/wikipedia/commons/c/cf/Lua-Logo.svg',
  r:       'https://www.r-project.org/logo/Rlogo.svg',
  markdown:'https://upload.wikimedia.org/wikipedia/commons/4/48/Markdown-mark.svg',
  xml:     'https://www.svgrepo.com/show/31053/xml.svg',
  yaml:    'https://www.svgrepo.com/show/374035/yaml.svg',
};

const LANG_META: Record<string, LangMeta> = {
  javascript:  { label: 'JavaScript',  color: '#f7df1e', iconUrl: ICONS.js },
  js:          { label: 'JavaScript',  color: '#f7df1e', iconUrl: ICONS.js },
  jsx:         { label: 'JSX',         color: '#61dafb', iconUrl: ICONS.react },
  typescript:  { label: 'TypeScript',  color: '#3178c6', iconUrl: ICONS.ts },
  ts:          { label: 'TypeScript',  color: '#3178c6', iconUrl: ICONS.ts },
  tsx:         { label: 'TSX',         color: '#3178c6', iconUrl: ICONS.react },
  python:      { label: 'Python',      color: '#3572a5', iconUrl: ICONS.python },
  py:          { label: 'Python',      color: '#3572a5', iconUrl: ICONS.python },
  html:        { label: 'HTML',        color: '#e34f26', iconUrl: ICONS.html },
  htm:         { label: 'HTML',        color: '#e34f26', iconUrl: ICONS.html },
  css:         { label: 'CSS',         color: '#264de4', iconUrl: ICONS.css },
  scss:        { label: 'SCSS',        color: '#cf649a', iconUrl: ICONS.css },
  bash:        { label: 'Bash',        color: '#4eaa25', iconUrl: ICONS.bash },
  sh:          { label: 'Shell',       color: '#4eaa25', iconUrl: ICONS.bash },
  json:        { label: 'JSON',        color: '#cb7700', iconUrl: ICONS.json },
  sql:         { label: 'SQL',         color: '#336791', iconUrl: ICONS.sql },
  java:        { label: 'Java',        color: '#b07219', iconUrl: ICONS.java },
  kotlin:      { label: 'Kotlin',      color: '#a97bff', iconUrl: ICONS.kotlin },
  swift:       { label: 'Swift',       color: '#f05138', iconUrl: ICONS.swift },
  rust:        { label: 'Rust',        color: '#ce412b', iconUrl: ICONS.rust },
  go:          { label: 'Go',          color: '#00acd7', iconUrl: ICONS.go },
  ruby:        { label: 'Ruby',        color: '#cc342d', iconUrl: ICONS.ruby },
  php:         { label: 'PHP',         color: '#777bb4', iconUrl: ICONS.php },
  c:           { label: 'C',           color: '#555555', iconUrl: ICONS.c },
  cpp:         { label: 'C++',         color: '#00599c', iconUrl: ICONS.cpp },
  cs:          { label: 'C#',          color: '#239120', iconUrl: ICONS.cs },
  dart:        { label: 'Dart',        color: '#0175c2', iconUrl: ICONS.dart },
  yaml:        { label: 'YAML',        color: '#cb171e', iconUrl: ICONS.yaml },
  yml:         { label: 'YAML',        color: '#cb171e', iconUrl: ICONS.yaml },
  xml:         { label: 'XML',         color: '#ff6600', iconUrl: ICONS.xml },
  dockerfile:  { label: 'Dockerfile',  color: '#2496ed', iconUrl: ICONS.docker },
  graphql:     { label: 'GraphQL',     color: '#e10098', iconUrl: ICONS.graphql },
  r:           { label: 'R',           color: '#198ce7', iconUrl: ICONS.r },
  lua:         { label: 'Lua',         color: '#000080', iconUrl: ICONS.lua },
  markdown:    { label: 'Markdown',    color: '#083fa1', iconUrl: ICONS.markdown },
  md:          { label: 'Markdown',    color: '#083fa1', iconUrl: ICONS.markdown },
  code:        { label: 'Code',        color: '#888888', iconUrl: null },
  text:        { label: 'Text',        color: '#888888', iconUrl: null },
};

function getLangMeta(lang: string): LangMeta {
  const key = (lang || '').toLowerCase().trim();
  return LANG_META[key] || { label: lang || 'Code', color: '#888', iconUrl: null };
}

// ═══════════════════════════════════════════════════
//  LANGUAGE HELPERS
// ═══════════════════════════════════════════════════

const RUNNABLE_LANGS = new Set([
  'html','htm','css','javascript','js','jsx','typescript','ts','tsx',
  'python','py','bash','sh'
]);
const PREVIEW_LANGS = new Set(['html','htm','css','javascript','js','jsx','typescript','ts','tsx']);
const TERMINAL_LANGS = new Set(['bash','sh','shell']);
const PYTHON_LANGS = new Set(['python','py']);

const canRun = (lang: string) => RUNNABLE_LANGS.has(lang.toLowerCase());
const hasPreviewTab = (lang: string) => PREVIEW_LANGS.has(lang.toLowerCase());
const isTerminalLang = (lang: string) => TERMINAL_LANGS.has(lang.toLowerCase());
const isPythonLang = (lang: string) => PYTHON_LANGS.has(lang.toLowerCase());

// ═══════════════════════════════════════════════════
//  REAL ICON BADGE COMPONENT
// ═══════════════════════════════════════════════════

const LangIconBadge = memo(function LangIconBadge({ lang, size = 20 }: { lang: string; size?: number }) {
  const meta = getLangMeta(lang);

  if (meta.iconUrl) {
    return (
      <Image
        source={{ uri: meta.iconUrl }}
        style={{ width: size, height: size, borderRadius: size * 0.15 }}
        resizeMode="contain"
      />
    );
  }

  // Fallback: colored badge with initials
  const initials = meta.label.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <View style={{
      width: size, height: size, borderRadius: 4,
      backgroundColor: meta.color + '28',
      borderWidth: 1, borderColor: meta.color + '55',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{
        fontSize: size * 0.35, fontWeight: '800',
        color: meta.color, letterSpacing: -0.5,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      }} numberOfLines={1}>
        {initials}
      </Text>
    </View>
  );
});

// ═══════════════════════════════════════════════════
//  PLACEHOLDER DETECTION
// ═══════════════════════════════════════════════════

const PLACEHOLDER_RE = /\b(YOUR_API_KEY|YOUR_SECRET_KEY|YOUR_PUBLIC_KEY|API_KEY_HERE|SECRET_KEY_HERE|YOUR_TOKEN|YOUR_ACCESS_TOKEN|INSERT_API_KEY|PUT_YOUR_KEY_HERE)\b/g;

const hasApiKeyPlaceholders = (code: string) => PLACEHOLDER_RE.test(code);

type Token = { text: string; color: string; isPlaceholder?: boolean };

function splitPlaceholders(tokens: Token[]): Token[] {
  return tokens.flatMap(token => {
    if (token.isPlaceholder) return [token];
    const parts: Token[] = [];
    let lastIdx = 0;
    let m: RegExpExecArray | null;
    const re = new RegExp(PLACEHOLDER_RE.source, 'g');
    while ((m = re.exec(token.text)) !== null) {
      if (m.index > lastIdx) parts.push({ text: token.text.slice(lastIdx, m.index), color: token.color });
      parts.push({ text: m[0], color: C.placeholder, isPlaceholder: true });
      lastIdx = re.lastIndex;
    }
    if (lastIdx < token.text.length) parts.push({ text: token.text.slice(lastIdx), color: token.color });
    return parts.length ? parts : [token];
  });
}

// ═══════════════════════════════════════════════════
//  SYNTAX TOKENIZER (Refactored per language)
// ═══════════════════════════════════════════════════

function tokenize(line: string, lang: string): Token[] {
  const l = lang.toLowerCase();
  const tokens = getTokenizer(l)(line);
  return splitPlaceholders(tokens);
}

type Tokenizer = (line: string) => Token[];

const makeTokenizer = (regex: RegExp, colorMap: Record<number, string>): Tokenizer => (line) => {
  const tokens: Token[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(line)) !== null) {
    if (m.index > last) tokens.push({ text: line.slice(last, m.index), color: C.plain });
    for (let i = 1; i < m.length; i++) {
      if (m[i] && colorMap[i]) tokens.push({ text: m[i], color: colorMap[i] });
    }
    last = regex.lastIndex;
  }
  if (last < line.length) tokens.push({ text: line.slice(last), color: C.plain });
  return tokens;
};

const tokenizers: Record<string, Tokenizer> = {
  html: (line) => {
    const tokens: Token[] = [];
    const re = /(<!--[\s\S]*?-->)|(<\/?)(\w[\w-]*)((?:\s+[\w:-]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*))?)*)\s*(\/?>)/g;
    let last = 0, m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      if (m.index > last) tokens.push({ text: line.slice(last, m.index), color: C.plain });
      if (m[1]) tokens.push({ text: m[1], color: C.comment });
      else {
        tokens.push({ text: m[2], color: C.tag });
        tokens.push({ text: m[3], color: C.tag });
        if (m[4]) {
          const attrRe = /([\w:-]+)(\s*=\s*)("[^"]*"|'[^']*')/g;
          let lastA = 0, ma: RegExpExecArray | null;
          while ((ma = attrRe.exec(m[4])) !== null) {
            if (ma.index > lastA) tokens.push({ text: m[4].slice(lastA, ma.index), color: C.plain });
            tokens.push({ text: ma[1], color: C.attr });
            if (ma[2]) tokens.push({ text: ma[2], color: C.plain });
            if (ma[3]) tokens.push({ text: ma[3], color: C.attrVal });
            lastA = attrRe.lastIndex;
          }
          if (lastA < m[4].length) tokens.push({ text: m[4].slice(lastA), color: C.attr });
        }
        tokens.push({ text: m[5], color: C.tag });
      }
      last = re.lastIndex;
    }
    if (last < line.length) tokens.push({ text: line.slice(last), color: C.plain });
    return tokens;
  },

  js: makeTokenizer(
    /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(["'`](?:[^"'`\\]|\\.)*["'`])|(\b(?:const|let|var|function|return|import|export|default|from|if|else|for|while|do|class|extends|new|typeof|instanceof|async|await|try|catch|finally|throw|of|in|switch|case|break|continue|void|null|undefined|true|false|this|super|type|interface|enum|implements|static|abstract|readonly|public|private|protected|declare|namespace|module|require|delete|debugger|yield|with)\b)|(\b[A-Z][a-zA-Z0-9_]*\b)|(\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)/g,
    { 1: C.comment, 2: C.string, 3: C.keyword, 4: C.type, 5: C.number }
  ),

  css: makeTokenizer(
    /(\/\*[\s\S]*?\*\/)|([.#]?[\w-]+\s*(?={))|([a-z-]+\s*(?=:))|(\b\d+(?:px|em|rem|%|vh|vw|s|ms|pt|cm|mm)?\b)|("([^"]*)")|('([^']*)')/g,
    { 1: C.comment, 2: C.tag, 3: C.attr, 4: C.number, 5: C.string }
  ),

  python: makeTokenizer(
    /(#[^\n]*)|("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b(?:def|class|import|from|return|if|elif|else|for|while|in|not|and|or|is|True|False|None|lambda|with|as|try|except|finally|raise|pass|break|continue|yield|async|await|global|nonlocal|del|assert|print)\b)|(\b[A-Z][a-zA-Z0-9_]*\b)|(@[\w.]+)|(\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)/g,
    { 1: C.comment, 2: C.string, 3: C.keyword, 4: C.type, 5: C.attr, 6: C.number }
  ),

  json: makeTokenizer(
    /("(?:[^"\\]|\\.)*"\s*:)|("(?:[^"\\]|\\.)*")|(\b(?:true|false|null)\b)|(-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)/g,
    { 1: C.attr, 2: C.string, 3: C.keyword, 4: C.number }
  ),

  bash: makeTokenizer(
    /(#[^\n]*)|(["'])(?:(?=(\\?))\3.)*?\2|(\b(?:echo|cd|ls|mkdir|rm|cp|mv|sudo|export|source|if|then|else|fi|for|do|done|while|case|esac|function|return|exit|set|unset|local|readonly|declare)\b)|(--?[\w-]+)|(\$[\w{][^)\s]*)/g,
    { 1: C.comment, 2: C.string, 4: C.keyword, 5: C.attr, 6: C.number }
  ),

  sql: (line) => {
    const tokens: Token[] = [];
    const re = /(--[^\n]*)|('(?:[^'\\]|\\.)*')|(\b(?:SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TABLE|INDEX|DATABASE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AS|AND|OR|NOT|IN|IS|NULL|ORDER|BY|GROUP|HAVING|LIMIT|OFFSET|DISTINCT|COUNT|SUM|AVG|MAX|MIN|UNION|ALL|EXISTS|INTO|VALUES|SET|PRIMARY|KEY|FOREIGN|REFERENCES|CASCADE)\b)/gi;
    let last = 0, m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      if (m.index > last) tokens.push({ text: line.slice(last, m.index), color: C.plain });
      if (m[1]) tokens.push({ text: m[1], color: C.comment });
      else if (m[2]) tokens.push({ text: m[2], color: C.string });
      else if (m[3]) tokens.push({ text: m[3].toUpperCase(), color: C.keyword });
      last = re.lastIndex;
    }
    if (last < line.length) tokens.push({ text: line.slice(last), color: C.plain });
    return tokens;
  },
};

function getTokenizer(lang: string): Tokenizer {
  if (['html', 'xml', 'htm'].includes(lang)) return tokenizers.html;
  if (['js', 'ts', 'tsx', 'jsx', 'javascript', 'typescript'].includes(lang)) return tokenizers.js;
  if (['css', 'scss'].includes(lang)) return tokenizers.css;
  if (['python', 'py'].includes(lang)) return tokenizers.python;
  if (lang === 'json') return tokenizers.json;
  if (['bash', 'sh', 'shell'].includes(lang)) return tokenizers.bash;
  if (lang === 'sql') return tokenizers.sql;
  return (line) => [{ text: line, color: C.plain }];
}

// ═══════════════════════════════════════════════════
//  UI COMPONENTS
// ═══════════════════════════════════════════════════

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

const CopyButton = memo(function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = useCallback(async () => {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }, [code]);
  return (
    <TouchableOpacity style={s.iconBtn} onPress={onCopy} hitSlop={10} activeOpacity={0.7}>
      <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={15} color={copied ? '#98c379' : 'rgba(255,255,255,0.55)'} />
    </TouchableOpacity>
  );
});

// ═══════════════════════════════════════════════════
//  HTML BUILDERS
// ═══════════════════════════════════════════════════

function buildPreviewHtml(code: string, lang: string): string {
  const l = lang.toLowerCase();

  if (['html', 'htm'].includes(l)) {
    if (code.includes('<!DOCTYPE') || code.includes('<html')) return code;
    return wrapHtml(code);
  }
  if (l === 'css' || l === 'scss') return buildCssPreview(code);
  if (['js', 'jsx', 'javascript', 'ts', 'tsx', 'typescript'].includes(l)) return buildJsPreview(code);
  return wrapHtml(`<pre>${escapeHtml(code)}</pre>`);
}

function wrapHtml(body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif;background:#fff}</style></head><body>${body}</body></html>`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function buildCssPreview(code: string): string {
  return wrapHtml(`<style>${code}</style><div class="container"><h1>CSS Preview</h1><p>Your styles are applied here.</p><button>Sample Button</button><div class="box">Sample Box</div></div>`);
}

function buildJsPreview(code: string): string {
  const js = code
    .replace(/:\s*(string|number|boolean|any|void|never|unknown|object|null|undefined)(\[\])?\b/g, '')
    .replace(/interface\s+\w+\s*\{[^}]*\}/g, '')
    .replace(/<[A-Z][a-zA-Z]*>/g, '')
    .replace(/\bconst\s+(\w+)\s*:\s*\w+\s*=/g, 'const $1 =');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{margin:0;font-family:monospace;background:#0d1117;color:#c9d1d9;padding:16px}#output{white-space:pre-wrap;font-size:14px;line-height:1.6}.log{color:#58a6ff}.error{color:#ff7b72}.result{color:#3fb950}</style></head><body><div id="output"></div><script>
    const out=document.getElementById('output');
    const origLog=console.log,origErr=console.error,origWarn=console.warn;
    function appendLine(t,c){const e=document.createElement('div');e.className=c||'log';e.textContent=t;out.appendChild(e);}
    console.log=(...a)=>{origLog(...a);appendLine(a.map(String).join(' '),'log');};
    console.error=(...a)=>{origErr(...a);appendLine('Error: '+a.join(' '),'error');};
    console.warn=(...a)=>{origWarn(...a);appendLine('Warning: '+a.join(' '),'log');};
    window.onerror=(m,s,l)=>appendLine('Runtime Error (line '+l+'): '+m,'error');
    try{${js}}catch(e){appendLine('Execution Error: '+e.message,'error');}
  </script></body></html>`;
}

function buildTerminalHtml(code: string): string {
  const lines = code.split('\n').map(line => {
    const esc = escapeHtml(line);
    if (line.trim().startsWith('#')) return `<div class="comment">${esc}</div>`;
    return `<div><span class="prompt">$ </span><span class="cmd">${esc}</span></div><div class="output">[Command output would appear here]</div>`;
  });
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    *{box-sizing:border-box}body{margin:0;background:${C.termBg};color:${C.termText};font-family:'Courier New',monospace;font-size:13px;padding:16px;line-height:1.7}
    .prompt{color:${C.termPrompt};font-weight:bold}.cmd{color:#e6edf3}.output{color:rgba(57,255,20,0.65);margin-left:14px;margin-bottom:4px;font-size:12px}
    .comment{color:#5c6370;font-style:italic}.header{color:${C.termPrompt};border-bottom:1px solid #30363d;padding-bottom:8px;margin-bottom:12px;font-size:12px}
  </style></head><body><div class="header">Terminal Simulation</div>${lines.join('\n')}</body></html>`;
}

function buildPythonHtml(code: string): string {
  const esc = escapeHtml(code);
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    *{box-sizing:border-box}body{margin:0;background:#0d1117;color:#c9d1d9;font-family:'Courier New',monospace;font-size:13px;padding:16px;line-height:1.7}
    .header{color:#58a6ff;border-bottom:1px solid #30363d;padding-bottom:8px;margin-bottom:12px;font-size:12px}
    .code-area{background:#161b22;border:1px solid #30363d;border-radius:6px;padding:12px;white-space:pre-wrap;margin-bottom:12px;color:#e6edf3}
    .output-label{color:#3fb950;font-weight:bold;margin-bottom:4px;font-size:12px}
    .output{background:#0d1117;border:1px solid #30363d;border-radius:4px;padding:10px;color:#3fb950;white-space:pre-wrap;font-size:12px;min-height:48px}
    .note{color:#8b949e;font-size:11px;margin-top:8px;font-style:italic}
  </style></head><body><div class="header">Python Code Preview</div><div class="code-area">${esc}</div><div class="output-label">Output</div><div class="output">[Python output — run in a Python environment to see real results]</div><div class="note">Note: Python runs server-side. This is a static preview.</div></body></html>`;
}

// ═══════════════════════════════════════════════════
//  MODALS
// ═══════════════════════════════════════════════════

const CodeRunnerModal = memo(function CodeRunnerModal({
  visible, code, language, fileName, onClose,
}: {
  visible: boolean; code: string; language: string; fileName?: string; onClose: () => void;
}) {
  const meta = getLangMeta(language);
  const [tab, setTab] = useState<'preview' | 'code'>('preview');
  const isTerminal = isTerminalLang(language);
  const isPython = isPythonLang(language);

  const previewHtml = isTerminal ? buildTerminalHtml(code) :
                      isPython ? buildPythonHtml(code) :
                      buildPreviewHtml(code, language);
  const tabLabel = isTerminal ? 'Terminal' : isPython ? 'Output' : 'Preview';
  const tabIcon = isTerminal ? 'terminal-outline' : isPython ? 'code-slash-outline' : 'globe-outline';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={s.root}>
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} style={s.closeBtn} hitSlop={12}>
            <Ionicons name="chevron-down" size={22} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
          <View style={s.headerTitle}>
            <LangIconBadge lang={language} size={22} />
            <Text style={[s.langLabel, { color: meta.color }]}>{fileName || meta.label}</Text>
          </View>
          <CopyButton code={code} />
        </View>

        <View style={s.tabBar}>
          <TabButton active={tab==='preview'} icon={tabIcon} label={tabLabel} onPress={() => setTab('preview')} />
          <TabButton active={tab==='code'} icon="code-slash" label="Code" onPress={() => setTab('code')} />
        </View>

        {tab === 'preview' ? (
          <View style={{ flex: 1, backgroundColor: isTerminal || isPython ? C.termBg : '#fff' }}>
            <WebView source={{ html: previewHtml }} style={{ flex: 1 }} javaScriptEnabled domStorageEnabled originWhitelist={['*']} />
          </View>
        ) : (
          <CodeScrollView code={code} language={language} />
        )}
      </SafeAreaView>
    </Modal>
  );
});

const FullScreenViewer = memo(function FullScreenViewer({
  visible, code, language, fileName, onClose,
}: {
  visible: boolean; code: string; language: string; fileName?: string; onClose: () => void;
}) {
  const meta = getLangMeta(language);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={s.root}>
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} style={s.closeBtn} hitSlop={10}>
            <Ionicons name="chevron-down" size={22} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
          <View style={s.headerTitle}>
            <LangIconBadge lang={language} size={22} />
            <Text style={[s.langLabel, { color: meta.color }]}>{fileName || meta.label}</Text>
          </View>
          <CopyButton code={code} />
        </View>
        <CodeScrollView code={code} language={language} />
      </SafeAreaView>
    </Modal>
  );
});

// ═══════════════════════════════════════════════════
//  SHARED SUB-COMPONENTS
// ═══════════════════════════════════════════════════

const TabButton = memo(function TabButton({ active, icon, label, onPress }: {
  active: boolean; icon: any; label: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[s.tab, active && s.tabActive]} onPress={onPress}>
      <Ionicons name={icon} size={15} color={active ? '#fff' : 'rgba(255,255,255,0.45)'} />
      <Text style={[s.tabText, active && s.tabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
});

const CodeScrollView = memo(function CodeScrollView({ code, language }: { code: string; language: string }) {
  const lines = code.split('\n');
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} nestedScrollEnabled showsVerticalScrollIndicator indicatorStyle="white">
      <ScrollView horizontal showsHorizontalScrollIndicator indicatorStyle="white" contentContainerStyle={s.codeContent}>
        <View style={s.lineNums}>
          {lines.map((_, i) => <Text key={i} style={s.lineNum}>{i + 1}</Text>)}
        </View>
        <View style={s.codeLines}>
          {lines.map((line, i) => (
            <View key={i} style={s.codeLine}>
              {tokenize(line, language).map((t, ti) => (
                t.isPlaceholder ? (
                  <View key={ti} style={{ backgroundColor: C.phBg, borderRadius: 3 }}>
                    <Text style={[s.codeText, { color: t.color }]}>{t.text}</Text>
                  </View>
                ) : (
                  <Text key={ti} style={[s.codeText, { color: t.color }]}>{t.text}</Text>
                )
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </ScrollView>
  );
});

const InlinePreviewTab = memo(function InlinePreviewTab({ code, language }: { code: string; language: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <View style={{ height: 260, backgroundColor: '#fff', borderBottomLeftRadius: 12, borderBottomRightRadius: 12, overflow: 'hidden' }}>
      {!loaded && (
        <View style={s.loadingOverlay}>
          <Ionicons name="globe-outline" size={28} color="#ccc" />
          <Text style={s.loadingText}>Loading preview...</Text>
        </View>
      )}
      <WebView source={{ html: buildPreviewHtml(code, language) }} style={{ flex: 1 }} javaScriptEnabled domStorageEnabled originWhitelist={['*']} onLoad={() => setLoaded(true)} />
    </View>
  );
});

// ═══════════════════════════════════════════════════
//  MAIN CODEBLOCK
// ═══════════════════════════════════════════════════

interface CodeBlockProps {
  code: string;
  language?: string;
  fileName?: string;
  streaming?: boolean;
}

const COLLAPSE_LINES = 14;

export const CodeBlock = memo(function CodeBlock({
  code, language = 'code', fileName, streaming = false,
}: CodeBlockProps) {
  const meta = getLangMeta(language);
  const [expanded, setExpanded] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  const [runnerOpen, setRunnerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'code' | 'preview'>('code');
  const [atBottom, setAtBottom] = useState(false);
  const vertScrollRef = useRef<ScrollView>(null);

  const showRunBtn = canRun(language);
  const showPreviewTab = hasPreviewTab(language);
  const isTerminal = isTerminalLang(language);
  const isPython = isPythonLang(language);

  // Streaming
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

  const runLabel = isTerminal ? 'Terminal' : isPython ? 'Output' : 'Preview';
  const runIcon: any = isTerminal ? 'terminal-outline' : 'play-circle-outline';

  return (
    <>
      <View style={card.wrapper}>
        {/* Header */}
        <View style={card.header}>
          <View style={card.headerLeft}>
            <LangIconBadge lang={language} size={20} />
            <Text style={card.langLabel}>{fileName || meta.label}</Text>
          </View>
          <View style={card.actions}>
            <IconBtn icon="expand-outline" onPress={() => setFullScreen(true)} />
            {showRunBtn && <IconBtn icon={runIcon} color="#30D158" bg="rgba(48,209,88,0.1)" onPress={() => setRunnerOpen(true)} />}
            <CopyButton code={code} />
          </View>
        </View>

        {/* Tabs */}
        {showPreviewTab && !isActivelyStreaming && (
          <View style={card.tabRow}>
            <TabPill active={activeTab==='code'} icon="code-slash" label="Code" onPress={() => setActiveTab('code')} />
            <TabPill active={activeTab==='preview'} icon="globe-outline" label="Preview" onPress={() => setActiveTab('preview')} />
          </View>
        )}

        {/* Placeholder Warning */}
        {hasPlaceholders && (
          <View style={card.phWarn}>
            <Ionicons name="warning-outline" size={12} color={C.placeholder} />
            <Text style={card.phWarnText}>Replace highlighted values before using</Text>
          </View>
        )}

        {/* Content */}
        {showPreviewTab && activeTab === 'preview' && !isActivelyStreaming ? (
          <InlinePreviewTab code={code} language={language} />
        ) : (
          <View style={card.scrollOuter}>
            <ScrollView
              ref={vertScrollRef}
              style={{ flex: 1 }}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
              onScroll={(e) => {
                const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
                setAtBottom(contentSize.height - layoutMeasurement.height - contentOffset.y < 40);
              }}
              scrollEventThrottle={16}
            >
              <ScrollView horizontal showsHorizontalScrollIndicator indicatorStyle="white" contentContainerStyle={card.codeContent}>
                <View style={card.lineNums}>
                  {displayLines.map((_, i) => <Text key={i} style={card.lineNum}>{i + 1}</Text>)}
                </View>
                <View style={card.codeLines}>
                  {displayLines.map((line, i) => (
                    <View key={i} style={card.codeLine}>
                      {tokenize(line, language).map((t, ti) => (
                        t.isPlaceholder ? (
                          <View key={ti} style={{ backgroundColor: C.phBg, borderRadius: 3 }}>
                            <Text style={[card.codeText, { color: t.color }]}>{t.text}</Text>
                          </View>
                        ) : (
                          <Text key={ti} style={[card.codeText, { color: t.color }]}>{t.text}</Text>
                        )
                      ))}
                      {isActivelyStreaming && i === displayLines.length - 1 && <BlinkingCursor />}
                    </View>
                  ))}
                </View>
              </ScrollView>
            </ScrollView>

            {isLong && expanded && !atBottom && (
              <TouchableOpacity style={card.scrollDownBtn} onPress={() => vertScrollRef.current?.scrollToEnd({ animated: true })} hitSlop={8}>
                <View style={card.scrollDownCircle}>
                  <Ionicons name="chevron-down" size={16} color="rgba(255,255,255,0.8)" />
                </View>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Expand / Collapse */}
        {isLong && activeTab === 'code' && (
          <TouchableOpacity style={card.expandRow} onPress={() => setExpanded(e => !e)} activeOpacity={0.7}>
            <Text style={card.expandText}>{expanded ? 'Show less' : `Show ${lineCount - COLLAPSE_LINES} more lines`}</Text>
            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={13} color="rgba(255,255,255,0.45)" />
          </TouchableOpacity>
        )}

        {/* Run Strip */}
        {showRunBtn && !isActivelyStreaming && activeTab === 'code' && (
          <TouchableOpacity style={card.runStrip} onPress={() => setRunnerOpen(true)} activeOpacity={0.8}>
            <Ionicons name={runIcon} size={14} color="#30D158" />
            <Text style={card.runStripText}>{runLabel}</Text>
            <Ionicons name="chevron-forward" size={13} color="rgba(48,209,88,0.6)" />
          </TouchableOpacity>
        )}
      </View>

      <FullScreenViewer visible={fullScreen} code={code} language={language} fileName={fileName} onClose={() => setFullScreen(false)} />
      <CodeRunnerModal visible={runnerOpen} code={code} language={language} fileName={fileName} onClose={() => setRunnerOpen(false)} />
    </>
  );
});

export const StreamingCodeBlock = CodeBlock;

// ═══════════════════════════════════════════════════
//  SMALL HELPERS
// ═══════════════════════════════════════════════════

const IconBtn = memo(function IconBtn({ icon, onPress, color, bg }: { icon: any; onPress: () => void; color?: string; bg?: string }) {
  return (
    <TouchableOpacity onPress={onPress} style={[s.iconBtn, bg && { backgroundColor: bg }]} hitSlop={10} activeOpacity={0.7}>
      <Ionicons name={icon} size={15} color={color || 'rgba(255,255,255,0.45)'} />
    </TouchableOpacity>
  );
});

const TabPill = memo(function TabPill({ active, icon, label, onPress }: {
  active: boolean; icon: any; label: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[card.tabBtn, active && card.tabBtnActive]} onPress={onPress}>
      <Ionicons name={icon} size={12} color={active ? '#fff' : 'rgba(255,255,255,0.4)'} />
      <Text style={[card.tabBtnText, active && { color: '#fff' }]}>{label}</Text>
    </TouchableOpacity>
  );
});

// ═══════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.header, paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border,
  },
  closeBtn: { padding: 4 },
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  langLabel: { fontSize: 14, fontWeight: '700' },
  tabBar: {
    flexDirection: 'row', backgroundColor: C.header,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border,
    paddingHorizontal: 14, paddingBottom: 10, paddingTop: 8, gap: 8,
  },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  tabActive: { backgroundColor: 'rgba(255,255,255,0.12)' },
  tabText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.45)' },
  tabTextActive: { color: '#fff' },
  iconBtn: { padding: 5, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  codeContent: { paddingVertical: 12, flexDirection: 'row', alignItems: 'flex-start', minWidth: '100%' },
  lineNums: { paddingLeft: 14, paddingRight: 10, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: C.border, alignItems: 'flex-end', minWidth: 42 },
  lineNum: { fontSize: 13, lineHeight: 20, color: C.lineNum, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', includeFontPadding: false },
  codeLines: { paddingLeft: 14, paddingRight: 28 },
  codeLine: { flexDirection: 'row', flexWrap: 'nowrap', minHeight: 20, alignItems: 'center' },
  codeText: { fontSize: 14, lineHeight: 20, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', includeFontPadding: false },
  loadingOverlay: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f5f5', zIndex: 1 },
  loadingText: { color: '#aaa', fontSize: 13, marginTop: 8 },
});

const card = StyleSheet.create({
  wrapper: {
    backgroundColor: C.bg, borderRadius: 12, overflow: 'hidden', marginVertical: 6,
    borderWidth: StyleSheet.hairlineWidth, borderColor: C.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.header, paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  langLabel: { fontSize: 13, fontWeight: '600', letterSpacing: 0.1, color: 'rgba(255,255,255,0.85)' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  tabRow: {
    flexDirection: 'row', backgroundColor: C.header,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border,
    paddingHorizontal: 12, paddingBottom: 8, gap: 6,
  },
  tabBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  tabBtnActive: { backgroundColor: 'rgba(255,255,255,0.1)' },
  tabBtnText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.4)' },
  phWarn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 5,
    backgroundColor: 'rgba(229,192,123,0.08)',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(229,192,123,0.2)',
  },
  phWarnText: { fontSize: 11, color: C.placeholder, fontWeight: '500', flex: 1 },
  scrollOuter: { maxHeight: 340, position: 'relative' },
  codeContent: { paddingVertical: 12, flexDirection: 'row', alignItems: 'flex-start', minWidth: '100%' },
  lineNums: { paddingLeft: 12, paddingRight: 10, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: C.border, alignItems: 'flex-end', minWidth: 36 },
  lineNum: { fontSize: 12, lineHeight: 19, color: C.lineNum, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', includeFontPadding: false },
  codeLines: { paddingLeft: 14, paddingRight: 24, flexShrink: 0 },
  codeLine: { flexDirection: 'row', flexWrap: 'nowrap', minHeight: 19, alignItems: 'center' },
  codeText: { fontSize: 13, lineHeight: 19, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', includeFontPadding: false },
  scrollDownBtn: { position: 'absolute', bottom: 10, alignSelf: 'center', left: 0, right: 0, alignItems: 'center' },
  scrollDownCircle: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(45,45,45,0.92)', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  expandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, backgroundColor: C.header, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  expandText: { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
  runStrip: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: 'rgba(48,209,88,0.06)', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(48,209,88,0.15)' },
  runStripText: { fontSize: 12, color: '#30D158', fontWeight: '600', flex: 1 },
});
