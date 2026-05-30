/**
 * StreamingCodeBlock — Premium frosted-glass code block
 *
 * Features:
 * - Semi-transparent BlurView backgrounds (frosted glass)
 * - HTML+JS → Play ▶ + Copy buttons; other languages → Copy only
 * - Tap Play → preview replaces code inside the block
 * - Tap code block while in Preview → opens full-screen Code/Preview modal
 * - Top-right console icon in modal → BlurView console bottom sheet
 * - Long/scrollable code (never wraps raw)
 * - Text selection with native clipboard menu
 * - All backgrounds semi-transparent so blur shines through
 */

import React, { useState, useCallback, useRef, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  Modal,
  ActivityIndicator,
  Pressable,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../hooks/useTheme';
import { BlurView } from 'expo-blur';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface StreamingCodeBlockProps {
  code: string;
  language?: string;
  isStreaming?: boolean;
  isAdmin?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Language helpers
// ─────────────────────────────────────────────────────────────────────────────
const LANGUAGE_LABELS: Record<string, string> = {
  javascript: 'JavaScript', js: 'JavaScript',
  typescript: 'TypeScript', ts: 'TypeScript',
  tsx: 'TSX', jsx: 'JSX',
  python: 'Python', py: 'Python',
  java: 'Java', c: 'C', cpp: 'C++',
  csharp: 'C#', cs: 'C#',
  go: 'Go', rust: 'Rust',
  ruby: 'Ruby', rb: 'Ruby',
  php: 'PHP', swift: 'Swift', kotlin: 'Kotlin',
  bash: 'Bash', sh: 'Shell', shell: 'Shell', zsh: 'Zsh',
  html: 'HTML', css: 'CSS', scss: 'SCSS',
  sql: 'SQL', json: 'JSON',
  yaml: 'YAML', yml: 'YAML',
  xml: 'XML', markdown: 'Markdown', md: 'Markdown',
  plaintext: 'Plain Text', text: 'Plain Text',
  r: 'R', dart: 'Dart', lua: 'Lua',
};

function getLanguageLabel(lang?: string): string {
  if (!lang) return 'Code';
  return LANGUAGE_LABELS[lang.toLowerCase()] || lang.toUpperCase();
}

const LANG_COLORS: Record<string, string> = {
  javascript: '#F7DF1E', js: '#F7DF1E',
  typescript: '#3178C6', ts: '#3178C6',
  tsx: '#3178C6', jsx: '#61DAFB',
  python: '#3572A5', py: '#3572A5',
  java: '#B07219', go: '#00ADD8',
  rust: '#DEA584', ruby: '#CC342D', rb: '#CC342D',
  html: '#E34C26', css: '#563D7C', scss: '#C6538C',
  swift: '#F05138', kotlin: '#7F52FF',
  php: '#4F5D95', bash: '#89E051',
  sh: '#89E051', shell: '#89E051',
  sql: '#E38C00', json: '#7B8C00',
  c: '#555555', cpp: '#F34B7D',
  csharp: '#178600', cs: '#178600',
  r: '#198CE7', dart: '#00B4AB',
};

function getLangColor(lang: string): string {
  return LANG_COLORS[lang.toLowerCase()] || '#10A37F';
}

function LanguageIcon({ lang, size = 14, color }: { lang: string; size?: number; color: string }) {
  const iconMap: Record<string, any> = {
    javascript: 'logo-javascript', js: 'logo-javascript',
    typescript: 'code-slash', ts: 'code-slash', tsx: 'code-slash', jsx: 'code-slash',
    python: 'logo-python', py: 'logo-python',
    html: 'logo-html5', css: 'logo-css3', scss: 'logo-css3',
    json: 'code', bash: 'terminal', sh: 'terminal', shell: 'terminal', zsh: 'terminal',
    sql: 'server', swift: 'logo-apple', java: 'cafe', go: 'logo-google',
    rust: 'hardware-chip', php: 'code', ruby: 'diamond', rb: 'diamond',
    dart: 'navigate', kotlin: 'code-slash',
    markdown: 'document-text', md: 'document-text',
    xml: 'code', yaml: 'document', yml: 'document',
  };
  return <Ionicons name={(iconMap[lang.toLowerCase()] || 'code-slash') as any} size={size} color={color} />;
}

// HTML + JS = previewable; others = copy only
const PREVIEWABLE_LANGS = new Set(['html', 'javascript', 'js', 'jsx', 'tsx', 'typescript', 'ts']);

// ─────────────────────────────────────────────────────────────────────────────
// Syntax tokenizer (same as before)
// ─────────────────────────────────────────────────────────────────────────────
const DARK_TOKENS = {
  keyword: '#FF7AB2', string: '#FC9A59', comment: '#6C7986',
  number: '#D9C97C', function: '#6BDFFF', type: '#DABAFF',
  operator: '#F8F8F2', default: '#E4E4E4',
};
const LIGHT_TOKENS = {
  keyword: '#D73A49', string: '#032F62', comment: '#6A737D',
  number: '#005CC5', function: '#6F42C1', type: '#6F42C1',
  operator: '#24292E', default: '#24292E',
};

type TokenType = keyof typeof DARK_TOKENS;

function tokenizeLine(line: string, lang: string): Array<{ text: string; type: TokenType }> {
  const l = lang.toLowerCase();
  const highlighted = ['javascript', 'js', 'typescript', 'ts', 'tsx', 'jsx',
    'python', 'py', 'java', 'c', 'cpp', 'csharp', 'cs', 'go', 'rust',
    'ruby', 'rb', 'php', 'swift', 'kotlin', 'bash', 'sh', 'shell', 'html', 'css'].includes(l);
  if (!highlighted) return [{ text: line, type: 'default' }];

  const isPyComment = ['python', 'py', 'ruby', 'rb', 'bash', 'sh', 'shell'].includes(l) && line.trim().startsWith('#');
  const isCLineComment = line.trim().startsWith('//');
  const isBlockComment = line.trim().startsWith('/*') || line.trim().startsWith('*');
  if (isPyComment || isCLineComment || isBlockComment) return [{ text: line, type: 'comment' }];

  const result: Array<{ text: string; type: TokenType }> = [];
  const stringRe = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g;
  const parts = line.split(stringRe);
  const KW = /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|async|await|try|catch|throw|new|this|super|extends|implements|interface|type|enum|switch|case|break|continue|default|static|public|private|protected|void|null|undefined|true|false|in|of|do|yield|def|print|pass|not|and|or|lambda|with|as|assert|del|elif|except|finally|global|nonlocal|raise|None|True|False|package|func|struct|map|range|go|chan|select|defer|goto|fallthrough|val|var|object|companion|fun|when|is|override|abstract|sealed|data|by|mut|impl|use|mod|trait|where|fn|let|pub|unsafe|extern|crate|ref|move|box|dyn|std|self|Self|end|begin|require|module|rescue|ensure|puts|attr_accessor|attr_reader|echo|fi|then|done|foreach)\b/;
  for (const part of parts) {
    if (/^(".*"|'.*'|`.*`)$/s.test(part)) { result.push({ text: part, type: 'string' }); continue; }
    const combined = /(\b(?:const|let|var|function|return|if|else|for|while|class|import|export|from|async|await|try|catch|throw|new|this|super|extends|implements|interface|type|enum|switch|case|break|continue|default|static|public|private|protected|void|null|undefined|true|false|in|of|do|yield|def|print|pass|not|and|or|lambda|with|as|assert|del|elif|except|finally|global|nonlocal|raise|None|True|False|package|func|struct|map|range|go|chan|select|defer|goto|fallthrough|val|object|companion|fun|when|is|override|abstract|sealed|data|by|mut|impl|use|mod|trait|where|fn|pub|unsafe|extern|crate|ref|move|box|dyn|std|self|Self|end|begin|require|module|rescue|ensure|puts|echo|fi|then|done|foreach)\b|\b\d+\.?\d*\b|[^\w]+|\w+)/g;
    let m: RegExpExecArray | null;
    while ((m = combined.exec(part)) !== null) {
      const tok = m[0];
      if (KW.test(tok)) result.push({ text: tok, type: 'keyword' });
      else if (/^\d+\.?\d*$/.test(tok)) result.push({ text: tok, type: 'number' });
      else if (/^[+\-*/%=<>!&|^~?:]+$/.test(tok)) result.push({ text: tok, type: 'operator' });
      else result.push({ text: tok, type: 'default' });
    }
  }
  return result.length > 0 ? result : [{ text: line, type: 'default' }];
}

// ─────────────────────────────────────────────────────────────────────────────
// Build preview HTML
// ─────────────────────────────────────────────────────────────────────────────
function buildPreviewHtml(code: string, lang: string): string {
  const l = lang.toLowerCase();
  if (l === 'html') return code;
  // JS/TS/JSX/TSX — run in console
  let runCode = code;
  if (['typescript', 'ts', 'tsx', 'jsx'].includes(l)) {
    runCode = code.replace(/:\s*[A-Za-z<>\[\]|&]+(\s*=)?/g, (m, eq) => eq || '').replace(/<[A-Za-z][^>]*>/g, '').replace(/<\/[A-Za-z]+>/g, '');
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, monospace; font-size: 13px;
         background: #0D0D0D; color: #E4E4E4; padding: 10px; word-break: break-word; }
  .out { white-space: pre-wrap; line-height: 1.6; padding: 2px 0; }
  .err { color: #FF6B6B; } .ok { color: #30D158; } .warn { color: #FFD60A; }
</style>
</head><body>
<div id="output"></div>
<script>
(function(){
  var out = document.getElementById('output');
  function appendLine(text, cls) {
    var d = document.createElement('div'); d.className = 'out ' + (cls||''); d.textContent = text; out.appendChild(d);
  }
  var _log = console.log; var _err = console.error; var _warn = console.warn;
  console.log = function(){ var a = Array.prototype.slice.call(arguments); appendLine(a.map(function(x){ try{return typeof x==='object'?JSON.stringify(x,null,2):String(x);}catch(e){return String(x);}}).join(' '), ''); _log.apply(console,arguments); };
  console.error = function(){ var a = Array.prototype.slice.call(arguments); appendLine(a.join(' '), 'err'); _err.apply(console,arguments); };
  console.warn = function(){ var a = Array.prototype.slice.call(arguments); appendLine(a.join(' '), 'warn'); _warn.apply(console,arguments); };
  window.onerror = function(msg,src,line){ appendLine('Error: '+msg+(line?' (line '+line+')':''), 'err'); return true; };
  try {
    var _result = (function(){ ${runCode} })();
    if(_result !== undefined) appendLine('→ '+(typeof _result==='object'?JSON.stringify(_result,null,2):String(_result)), 'ok');
  } catch(e) { appendLine('Error: '+e.message, 'err'); }
})();
<\/script>
</body></html>`;
}


// ─────────────────────────────────────────────────────────────────────────────
// Syntax-colored code lines (used by both inline block and modal)
// ─────────────────────────────────────────────────────────────────────────────
function SyntaxLines({ code, language, isDark }: { code: string; language: string; isDark: boolean }) {
  const lines = (code || '').split('\n');
  const mono = Platform.OS === 'ios' ? 'Menlo' : 'monospace';
  const tokenColors = isDark ? DARK_TOKENS : LIGHT_TOKENS;
  const lineNumColor = isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.22)';
  const lang = language || 'plaintext';
  return (
    <>
      {lines.map((line, i) => {
        const tokens = tokenizeLine(line, lang);
        return (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 1.5 }}>
            <Text style={{ fontFamily: mono, fontSize: 12, lineHeight: 20, color: lineNumColor, minWidth: String(lines.length).length * 8 + 8, textAlign: 'right', marginRight: 12 }}>
              {i + 1}
            </Text>
            <Text
              selectable
              selectionColor="rgba(100,180,255,0.35)"
              style={{ fontFamily: mono, fontSize: 13, lineHeight: 20, flex: 1 }}
            >
              {tokens.map((tok, ti) => (
                <Text key={ti} style={{ color: tokenColors[tok.type] }}>{tok.text}</Text>
              ))}
            </Text>
          </View>
        );
      })}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Console bottom sheet (photo 7)
// ─────────────────────────────────────────────────────────────────────────────
function ConsoleSheet({ visible, logs, onClose, onClear, isDark, insets }: {
  visible: boolean; logs: string[]; onClose: () => void; onClear: () => void;
  isDark: boolean; insets: any;
}) {
  if (!visible) return null;
  const mono = Platform.OS === 'ios' ? 'Menlo' : 'monospace';
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={{ borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: 'hidden', maxHeight: '55%' }}>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={95} tint={isDark ? 'dark' : 'light'} style={{ flex: 1 }}>
              <ConsoleContent mono={mono} logs={logs} onClose={onClose} onClear={onClear} isDark={isDark} insets={insets} />
            </BlurView>
          ) : (
            <View style={{ flex: 1, backgroundColor: isDark ? 'rgba(20,20,22,0.97)' : 'rgba(248,248,250,0.97)' }}>
              <ConsoleContent mono={mono} logs={logs} onClose={onClose} onClear={onClear} isDark={isDark} insets={insets} />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

function ConsoleContent({ mono, logs, onClose, onClear, isDark, insets }: any) {
  const textC = isDark ? '#FFFFFF' : '#000000';
  const subC = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)';
  return (
    <View style={{ flex: 1, paddingBottom: insets.bottom + 8 }}>
      {/* Handle */}
      <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)', alignSelf: 'center', marginTop: 10, marginBottom: 6 }} />
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 10 }}>
        <TouchableOpacity onPress={onClose} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="close" size={16} color={textC} />
        </TouchableOpacity>
        <Text style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: textC }}>Console</Text>
        <TouchableOpacity onPress={onClear} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="trash-outline" size={16} color={textC} />
        </TouchableOpacity>
      </View>
      {/* Logs */}
      <ScrollView style={{ flex: 1, paddingHorizontal: 16 }} showsVerticalScrollIndicator={false}>
        {logs.length === 0 ? (
          <Text style={{ color: subC, fontFamily: mono, fontSize: 13, marginTop: 20, textAlign: 'center' }}>Running code…</Text>
        ) : (
          logs.map((log: string, i: number) => (
            <Text key={i} selectable style={{ fontFamily: mono, fontSize: 12, lineHeight: 20, color: log.startsWith('Error:') ? '#FF6B6B' : log.startsWith('warn:') ? '#FFD60A' : isDark ? '#E4E4E4' : '#1A1A1A', marginBottom: 2 }}>{log}</Text>
          ))
        )}
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Full-screen Code/Preview modal (photos 5 & 6)
// ─────────────────────────────────────────────────────────────────────────────
function CodePreviewModal({ visible, onClose, code, language, isDark }: {
  visible: boolean; onClose: () => void; code: string; language: string; isDark: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'code' | 'preview'>('preview');
  const [consoleVisible, setConsoleVisible] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const [webKey, setWebKey] = useState(0);
  const textC = isDark ? '#FFFFFF' : '#000000';
  const subC = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';
  const bgAlpha = isDark ? 'rgba(12,12,14,0.96)' : 'rgba(248,248,250,0.96)';
  const borderC = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';

  const lang = language.toLowerCase();
  const canPreview = PREVIEWABLE_LANGS.has(lang);
  const previewHtml = canPreview ? buildPreviewHtml(code, lang) : '';
  const mono = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

  // inject console interceptor into preview html
  const injectedHtml = previewHtml.replace(
    '</body>',
    `<script>
window._nativeLogs = [];
var _origLog = console.log; var _origErr = console.error; var _origWarn = console.warn;
function _sendLog(type, msg){
  try { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({type, msg})); } catch(e){}
}
console.log = function(){ var s = Array.prototype.slice.call(arguments).map(function(x){try{return typeof x==='object'?JSON.stringify(x,null,2):String(x);}catch(e){return String(x);}}).join(' '); _sendLog('log', s); _origLog.apply(console,arguments); };
console.error = function(){ var s = Array.prototype.slice.call(arguments).join(' '); _sendLog('error', 'Error: '+s); _origErr.apply(console,arguments); };
console.warn = function(){ var s = Array.prototype.slice.call(arguments).join(' '); _sendLog('warn', 'warn: '+s); _origWarn.apply(console,arguments); };
window.onerror = function(msg,src,line){ _sendLog('error','Error: '+msg+(line?' (line '+line+')':'')); return true; };
<\/script></body>`
  );

  const handleWebMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      setConsoleLogs(prev => [...prev, data.msg || '']);
    } catch {}
  }, []);

  const handleOpenConsole = () => {
    setConsoleLogs([]);
    setWebKey(k => k + 1);
    setConsoleVisible(true);
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: isDark ? '#0C0C0E' : '#F8F8FA' }}>
        {/* Header */}
        <View style={{ paddingTop: insets.top + 8, paddingBottom: 10, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: bgAlpha, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: borderC }}>
          {/* Close */}
          <TouchableOpacity
            onPress={onClose}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)', alignItems: 'center', justifyContent: 'center' }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={18} color={textC} />
          </TouchableOpacity>

          {/* Code / Preview toggle */}
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            {(['code', 'preview'] as const).filter(t => t === 'code' || canPreview).map(t => (
              <TouchableOpacity
                key={t}
                onPress={() => setTab(t)}
                style={{ paddingHorizontal: 18, paddingVertical: 7, borderRadius: 20, backgroundColor: tab === t ? (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.09)') : 'transparent' }}
                activeOpacity={0.7}
              >
                <Text style={{ color: tab === t ? textC : subC, fontSize: 15, fontWeight: tab === t ? '600' : '400' }}>
                  {t === 'code' ? 'Code' : 'Preview'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Console icon (top right) */}
          <TouchableOpacity
            onPress={handleOpenConsole}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)', alignItems: 'center', justifyContent: 'center' }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="terminal-outline" size={18} color={textC} />
          </TouchableOpacity>
        </View>

        {/* Body */}
        <View style={{ flex: 1 }}>
          {tab === 'code' ? (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
              <SyntaxLines code={code} language={language} isDark={isDark} />
              <View style={{ height: insets.bottom + 20 }} />
            </ScrollView>
          ) : canPreview ? (
            <WebView
              key={`preview-modal-${webKey}`}
              source={{ html: injectedHtml }}
              style={{ flex: 1, backgroundColor: 'transparent' }}
              javaScriptEnabled
              domStorageEnabled
              scrollEnabled
              onMessage={handleWebMessage}
              originWhitelist={['*']}
              allowsInlineMediaPlayback
              backgroundColor={isDark ? '#0D0D0D' : '#FFFFFF'}
            />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: subC, fontSize: 15 }}>Preview not available for {getLanguageLabel(language)}</Text>
            </View>
          )}
        </View>

        {/* Console */}
        <ConsoleSheet
          visible={consoleVisible}
          logs={consoleLogs}
          onClose={() => setConsoleVisible(false)}
          onClear={() => setConsoleLogs([])}
          isDark={isDark}
          insets={insets}
        />
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main StreamingCodeBlock
// ─────────────────────────────────────────────────────────────────────────────
export const StreamingCodeBlock = memo(function StreamingCodeBlock({
  code,
  language = 'plaintext',
  isStreaming = false,
  isAdmin,
}: StreamingCodeBlockProps) {
  const { isDark } = useTheme();
  const [copied, setCopied] = useState(false);
  const [previewMode, setPreviewMode] = useState(false); // inline preview vs code
  const [modalVisible, setModalVisible] = useState(false);
  const [webReady, setWebReady] = useState(false);

  const lang = (language || 'plaintext').toLowerCase();
  const isPreviewable = PREVIEWABLE_LANGS.has(lang);
  const langLabel = getLanguageLabel(language);
  const langColor = getLangColor(lang);

  // Colors — all semi-transparent for blur
  const containerBg = isDark ? 'rgba(18,18,20,0.72)' : 'rgba(248,248,252,0.72)';
  const headerBg = isDark ? 'rgba(28,28,32,0.70)' : 'rgba(240,240,244,0.70)';
  const borderColor = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.09)';
  const subC = isDark ? 'rgba(255,255,255,0.48)' : 'rgba(0,0,0,0.44)';
  const textC = isDark ? '#FFFFFF' : '#000000';

  const previewHtml = isPreviewable ? buildPreviewHtml(code, lang) : '';

  const handleCopy = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }, [code]);

  const handlePlay = useCallback(() => {
    setWebReady(false);
    setPreviewMode(true);
  }, []);

  const handlePressPreview = useCallback(() => {
    if (previewMode) setModalVisible(true);
  }, [previewMode]);

  const mono = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

  return (
    <>
      <View style={[s.container, { borderColor }]}>
        {/* Frosted glass background */}
        {Platform.OS === 'ios' ? (
          <BlurView intensity={isDark ? 80 : 75} tint={isDark ? 'dark' : 'extraLight'} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: containerBg }]} />
        )}

        {/* Header */}
        <View style={[s.header, { borderBottomColor: borderColor }]}>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={isDark ? 70 : 65} tint={isDark ? 'dark' : 'extraLight'} style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: headerBg }]} />
          )}

          {/* Left: icon + lang label + lang dot */}
          <View style={s.headerLeft}>
            <View style={[s.langDot, { backgroundColor: langColor }]} />
            <LanguageIcon lang={lang} size={13} color={subC} />
            <Text style={[s.langLabel, { color: textC, fontFamily: mono }]}>{langLabel}</Text>
            {isStreaming ? (
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10A37F', marginLeft: 4 }} />
            ) : null}
          </View>

          {/* Right: Play (HTML/JS only) + Copy */}
          <View style={s.headerRight}>
            {isPreviewable && !isStreaming ? (
              <TouchableOpacity
                onPress={previewMode ? () => setPreviewMode(false) : handlePlay}
                style={[s.iconBtn, { backgroundColor: isDark ? 'rgba(48,209,88,0.15)' : 'rgba(48,209,88,0.12)', borderColor: isDark ? 'rgba(48,209,88,0.3)' : 'rgba(48,209,88,0.22)' }]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <Ionicons name={previewMode ? 'code-slash' : 'play'} size={14} color="#30D158" />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              onPress={handleCopy}
              style={[s.iconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.055)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={14} color={copied ? '#34C759' : subC} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Body — code view OR inline preview */}
        {previewMode && isPreviewable ? (
          <TouchableOpacity activeOpacity={0.85} onPress={handlePressPreview} style={{ height: 280 }}>
            <WebView
              key="inline-preview"
              source={{ html: previewHtml }}
              style={{ flex: 1, backgroundColor: 'transparent' }}
              javaScriptEnabled
              domStorageEnabled
              scrollEnabled
              onLoadEnd={() => setWebReady(true)}
              originWhitelist={['*']}
              allowsInlineMediaPlayback
              pointerEvents="none"
            />
            {!webReady ? (
              <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(12,12,14,0.8)' : 'rgba(248,248,250,0.8)' }]}>
                <ActivityIndicator color={isDark ? '#FFF' : '#000'} />
              </View>
            ) : null}
            {/* Tap hint */}
            <View style={{ position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5 }}>
              <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '500' }}>Tap to expand</Text>
            </View>
          </TouchableOpacity>
        ) : (
          /* Code view — horizontally scrollable, vertically as tall as needed */
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            bounces={false}
            keyboardShouldPersistTaps="handled"
          >
            <ScrollView
              showsVerticalScrollIndicator={false}
              scrollEnabled
              nestedScrollEnabled
              style={{ maxHeight: 420 }}
              keyboardShouldPersistTaps="handled"
            >
              <View style={s.codeBody}>
                <SyntaxLines code={code} language={language} isDark={isDark} />
              </View>
            </ScrollView>
          </ScrollView>
        )}
      </View>

      {/* Full-screen modal */}
      <CodePreviewModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        code={code}
        language={language}
        isDark={isDark}
      />
    </>
  );
});

// Re-exported alias
export { StreamingCodeBlock as CodeBlock };

// ─────────────────────────────────────────────────────────────────────────────
// Math expression detector (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
export function detectMathExpression(text: string): { expression: string; result: string } | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (trimmed.split(/\s+/).length > 25) return null;
  const mathPattern = /(\d+[\s]*[+\-*/×÷−][\s]*\d+(?:[\s]*[+\-*/×÷−][\s]*\d+)*)/;
  const match = text.match(mathPattern);
  if (!match) return null;
  const expr = match[1].trim();
  try {
    const sanitized = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/\s/g, '');
    if (!/^[\d+\-*/.()]+$/.test(sanitized)) return null;
    const val = Function('"use strict"; return (' + sanitized + ')')();
    if (!Number.isNaN(val) && Number.isFinite(val)) {
      return { expression: expr, result: String(parseFloat(val.toFixed(10))) };
    }
  } catch { return null; }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginVertical: 6,
    // Remove any solid background — let blur shine through
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  langDot: { width: 8, height: 8, borderRadius: 4 },
  langLabel: { fontSize: 12, fontWeight: '600' },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  codeBody: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    minWidth: '100%',
  },
});
In the StreamingCodeBlock, when user long-presses and selects code text, add a floating 'Copy Selection' pill button (BlurView on iOS) that appears above the selection and copies just the selected portion to clipboard.
