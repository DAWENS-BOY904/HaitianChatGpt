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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../hooks/useTheme';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface StreamingCodeBlockProps {
  code: string;
  language?: string;
  isStreaming?: boolean;
  isAdmin?: boolean;
}

// ── Language → display label ──────────────────────────────────────────────────
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
  perl: 'Perl', scala: 'Scala', haskell: 'Haskell',
  elixir: 'Elixir', erlang: 'Erlang',
  objectivec: 'Objective-C', 'objective-c': 'Objective-C',
};

function getLanguageLabel(lang?: string): string {
  if (!lang) return 'Code';
  return LANGUAGE_LABELS[lang.toLowerCase()] || lang.toUpperCase();
}

// ── Language → icon ────────────────────────────────────────────────────────
function LanguageIcon({ lang, size = 14, color }: { lang: string; size?: number; color: string }) {
  const l = (lang || '').toLowerCase();
  const iconMap: Record<string, any> = {
    javascript: 'logo-javascript',
    js: 'logo-javascript',
    typescript: 'code-slash',
    ts: 'code-slash',
    tsx: 'code-slash',
    jsx: 'code-slash',
    python: 'logo-python',
    py: 'logo-python',
    html: 'logo-html5',
    css: 'logo-css3',
    json: 'code',
    bash: 'terminal',
    sh: 'terminal',
    shell: 'terminal',
    zsh: 'terminal',
    sql: 'server',
    swift: 'logo-apple',
    java: 'cafe',
    go: 'logo-google',
    rust: 'hardware-chip',
    php: 'code',
    ruby: 'diamond',
    rb: 'diamond',
    dart: 'navigate',
    kotlin: 'code-slash',
    markdown: 'document-text',
    md: 'document-text',
    xml: 'code',
    yaml: 'document',
    yml: 'document',
    scss: 'logo-css3',
    c: 'code',
    cpp: 'code',
    csharp: 'code',
    cs: 'code',
  };
  const iconName = iconMap[l] || 'code-slash';
  return <Ionicons name={iconName as any} size={size} color={color} />;
}

// ── Runnable languages ────────────────────────────────────────────────────────
const RUNNABLE_LANGS = new Set(['javascript', 'js', 'typescript', 'ts', 'python', 'py', 'html', 'jsx', 'tsx']);

// ── Language color dot ────────────────────────────────────────────────────────
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

// ── Syntax token colors ────────────────────────────────────────────────────────
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
  const isHighlighted = ['javascript', 'js', 'typescript', 'ts', 'tsx', 'jsx',
    'python', 'py', 'java', 'c', 'cpp', 'csharp', 'cs', 'go', 'rust',
    'ruby', 'rb', 'php', 'swift', 'kotlin', 'bash', 'sh', 'shell'].includes(l);

  if (!isHighlighted) return [{ text: line, type: 'default' }];

  // Full-line comment
  const isPyComment = (l === 'python' || l === 'py' || l === 'ruby' || l === 'rb' || l === 'bash' || l === 'sh' || l === 'shell') && line.trim().startsWith('#');
  const isCLineComment = line.trim().startsWith('//');
  const isBlockCommentStart = line.trim().startsWith('/*') || line.trim().startsWith('*');
  if (isPyComment || isCLineComment || isBlockCommentStart) {
    return [{ text: line, type: 'comment' }];
  }

  const ALL_KEYWORDS = /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|async|await|try|catch|throw|new|this|super|extends|implements|interface|type|enum|switch|case|break|continue|default|static|public|private|protected|void|null|undefined|true|false|in|of|do|yield|def|print|pass|not|and|or|lambda|with|as|assert|del|elif|except|finally|global|nonlocal|raise|None|True|False|package|func|struct|map|range|go|chan|select|defer|goto|fallthrough|val|var|object|companion|fun|when|is|override|abstract|sealed|data|by|mut|impl|use|mod|trait|where|fn|let|pub|unsafe|extern|crate|ref|move|box|dyn|std|self|Self|end|begin|require|module|do|rescue|ensure|puts|attr_accessor|attr_reader|echo|fi|then|done|foreach|foreach|in)\b/g;

  const result: Array<{ text: string; type: TokenType }> = [];
  const stringRe = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g;
  const parts = line.split(stringRe);

  for (const part of parts) {
    if (/^(".*"|'.*'|`.*`)$/s.test(part)) {
      result.push({ text: part, type: 'string' });
    } else {
      const combined = new RegExp(`(${ALL_KEYWORDS.source}|\\b\\d+\\.?\\d*\\b|[^\\w]+|\\w+)`, 'g');
      let m: RegExpExecArray | null;
      while ((m = combined.exec(part)) !== null) {
        const tok = m[0];
        if (/^(const|let|var|function|return|if|else|for|while|class|import|export|from|async|await|try|catch|throw|new|this|super|extends|implements|interface|type|enum|switch|case|break|continue|default|static|public|private|protected|void|null|undefined|true|false|in|of|do|yield|def|print|pass|not|and|or|lambda|with|as|assert|del|elif|except|finally|global|nonlocal|raise|None|True|False|package|func|struct|map|range|go|chan|select|defer|goto|fallthrough|val|var|object|companion|fun|when|is|override|abstract|sealed|data|by|mut|impl|use|mod|trait|where|fn|let|pub|unsafe|extern|crate|ref|move|box|dyn|std|self|Self|end|begin|require|module|do|rescue|ensure|puts|attr_accessor|attr_reader|echo|fi|then|done|foreach|in)$/.test(tok)) {
          result.push({ text: tok, type: 'keyword' });
        } else if (/^\d+\.?\d*$/.test(tok)) {
          result.push({ text: tok, type: 'number' });
        } else if (/^[+\-*/%=<>!&|^~?:]+$/.test(tok)) {
          result.push({ text: tok, type: 'operator' });
        } else {
          result.push({ text: tok, type: 'default' });
        }
      }
    }
  }
  return result.length > 0 ? result : [{ text: line, type: 'default' }];
}

// ── Build sandboxed HTML for JS/TS/HTML execution ──────────────────────────
function buildJsRunnerHtml(code: string, lang: string): string {
  const l = lang.toLowerCase();
  const isHtml = l === 'html';
  if (isHtml) {
    return code;
  }
  // For TypeScript strip type annotations (basic strip)
  let runCode = code;
  if (l === 'typescript' || l === 'ts' || l === 'tsx' || l === 'jsx') {
    runCode = code
      .replace(/:\s*[A-Za-z<>\[\]|&]+(\s*=)?/g, (m, eq) => eq || '')
      .replace(/<[A-Za-z][^>]*>/g, '')
      .replace(/<\/[A-Za-z]+>/g, '');
  }
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  body { margin:0; padding:10px; font-family: monospace; font-size:13px;
         background:#0E0E0E; color:#E4E4E4; word-break:break-word; }
  .out { white-space:pre-wrap; }
  .err { color:#FF6B6B; }
  .ok { color:#30D158; }
  hr { border-color:#333; margin:6px 0; }
</style>
</head>
<body>
<div id="output"></div>
<script>
(function(){
  var out = document.getElementById('output');
  var logs = [];
  var orig = { log: console.log, error: console.error, warn: console.warn, info: console.info };
  function appendLine(text, cls) {
    var d = document.createElement('div');
    d.className = 'out ' + (cls||'');
    d.textContent = text;
    out.appendChild(d);
  }
  ['log','info','warn'].forEach(function(m){
    console[m] = function(){
      var args = Array.prototype.slice.call(arguments);
      var text = args.map(function(a){ try { return typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a); } catch(e){ return String(a); } }).join(' ');
      appendLine(text, m === 'warn' ? 'err' : '');
      orig[m].apply(console, arguments);
    };
  });
  console.error = function(){
    var args = Array.prototype.slice.call(arguments);
    appendLine(args.join(' '), 'err');
    orig.error.apply(console, arguments);
  };
  window.onerror = function(msg, src, line, col, err){
    appendLine('Error: ' + msg + (line ? ' (line ' + line + ')' : ''), 'err');
    return true;
  };
  try {
    var result = (function(){ ${runCode} })();
    if(result !== undefined) appendLine('→ ' + (typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result)), 'ok');
  } catch(e) {
    appendLine('Error: ' + e.message, 'err');
  }
})();
<\/script>
</body>
</html>`;
}

// ── Python → JS transpiler (basic subset for demos) ──────────────────────────
function pythonToJsBasic(pyCode: string): string {
  return pyCode
    .replace(/^def (\w+)\(([^)]*)\):/gm, 'function $1($2) {')
    .replace(/^class (\w+):/gm, 'class $1 {')
    .replace(/\bprint\(([^)]*)\)/g, 'console.log($1)')
    .replace(/\blen\(([^)]*)\)/g, '($1).length')
    .replace(/\bstr\(([^)]*)\)/g, 'String($1)')
    .replace(/\bint\(([^)]*)\)/g, 'parseInt($1)')
    .replace(/\bfloat\(([^)]*)\)/g, 'parseFloat($1)')
    .replace(/\brange\((\d+),\s*(\d+)\)/g, '{*Array(($2)-($1)).keys()}.map(i=>i+($1))')
    .replace(/\brange\((\d+)\)/g, '[...Array($1).keys()]')
    .replace(/\bTrue\b/g, 'true').replace(/\bFalse\b/g, 'false').replace(/\bNone\b/g, 'null')
    .replace(/\belsif\b/g, 'else if').replace(/\belif /g, 'else if (').replace(/:$/gm, ') {')
    .replace(/\band\b/g, '&&').replace(/\bor\b/g, '||').replace(/\bnot\b/g, '!')
    .replace(/^(\s*)#(.*)$/gm, '$1//$2')
    .replace(/"""[\s\S]*?"""/g, '').replace(/'''[\s\S]*?'''/g, '');
}

const COLLAPSE_LINES = 22;

// ── Main component ────────────────────────────────────────────────────────────
export const StreamingCodeBlock = memo(function StreamingCodeBlock({
  code,
  language = 'plaintext',
  isStreaming = false,
  isAdmin,
}: StreamingCodeBlockProps) {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [highlightedLine, setHighlightedLine] = useState<number | null>(null);
  const [runnerVisible, setRunnerVisible] = useState(false);
  const [runnerReady, setRunnerReady] = useState(false);

  const lang = (language || 'plaintext').toLowerCase();
  const canRun = RUNNABLE_LANGS.has(lang);
  const langLabel = getLanguageLabel(language);
  const langColor = getLangColor(lang);
  const lines = (code || '').split('\n');
  const isTall = lines.length > COLLAPSE_LINES;
  const displayLines = isTall && !expanded ? lines.slice(0, COLLAPSE_LINES) : lines;

  const bg = isDark ? '#1A1B1E' : '#F8F8F8';
  const headerBg = isDark ? '#212225' : '#ECECEC';
  const borderColor = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.09)';
  const lineNumColor = isDark ? '#4A4A55' : '#BBBBBB';
  const tokenColors = isDark ? DARK_TOKENS : LIGHT_TOKENS;
  const highlightBg = isDark ? 'rgba(255,220,100,0.07)' : 'rgba(255,200,0,0.1)';

  const handleCopy = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_e) {}
  }, [code]);

  const handleRun = useCallback(() => {
    setRunnerReady(false);
    setRunnerVisible(true);
  }, []);

  // Build runner HTML
  const runnerHtml = (() => {
    if (lang === 'python' || lang === 'py') {
      const jsCode = pythonToJsBasic(code);
      return buildJsRunnerHtml(jsCode, 'javascript');
    }
    return buildJsRunnerHtml(code, lang);
  })();

  return (
    <>
      <View style={[codeStyles.container, { backgroundColor: bg, borderColor }]}>
        {/* Header */}
        <View style={[codeStyles.header, { backgroundColor: headerBg, borderBottomColor: borderColor }]}>
          <View style={codeStyles.headerLeft}>
            {/* Language color dot */}
            <View style={[codeStyles.langDot, { backgroundColor: langColor }]} />
            {/* Language icon */}
            <LanguageIcon lang={lang} size={13} color={isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)'} />
            <Text style={[codeStyles.langLabel, { color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)' }]}>
              {langLabel}
            </Text>
            {isStreaming ? (
              <View style={[codeStyles.streamDot, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)' }]}>
                <Text style={{ color: '#10A37F', fontSize: 10 }}>●</Text>
              </View>
            ) : null}
          </View>

          <View style={codeStyles.headerRight}>
            {/* Run button — JS/Python/HTML only */}
            {canRun && !isStreaming ? (
              <TouchableOpacity
                onPress={handleRun}
                style={[codeStyles.runBtn, { backgroundColor: isDark ? 'rgba(48,209,88,0.15)' : 'rgba(48,209,88,0.12)', borderColor: isDark ? 'rgba(48,209,88,0.35)' : 'rgba(48,209,88,0.25)' }]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <Ionicons name="play" size={12} color="#30D158" />
                <Text style={[codeStyles.runLabel, { color: '#30D158' }]}>Run</Text>
              </TouchableOpacity>
            ) : null}
            {/* Copy button */}
            <TouchableOpacity
              onPress={handleCopy}
              style={[codeStyles.copyBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <Ionicons
                name={copied ? 'checkmark' : 'copy-outline'}
                size={13}
                color={copied ? '#34C759' : (isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)')}
              />
              <Text style={[codeStyles.copyLabel, { color: copied ? '#34C759' : (isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)') }]}>
                {copied ? 'Copied!' : 'Copy'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Code body */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          bounces={false}
          style={{ maxHeight: isTall && !expanded ? 340 : undefined }}
        >
          <View style={codeStyles.codeContent}>
            {displayLines.map((line, i) => {
              const tokens = tokenizeLine(line, language);
              const lineNum = i + 1;
              const isHighlighted = highlightedLine === lineNum;
              return (
                <TouchableOpacity
                  key={`line-${i}`}
                  onPress={() => setHighlightedLine(prev => prev === lineNum ? null : lineNum)}
                  activeOpacity={0.6}
                  style={[
                    codeStyles.codeLine,
                    isHighlighted && { backgroundColor: highlightBg, borderRadius: 4 },
                  ]}
                >
                  <Text
                    style={[
                      codeStyles.lineNumber,
                      { color: isHighlighted ? (isDark ? 'rgba(255,200,100,0.7)' : 'rgba(180,120,0,0.7)') : lineNumColor },
                    ]}
                  >
                    {String(lineNum).padStart(String(lines.length).length, ' ')}
                  </Text>
                  <Text style={codeStyles.lineContent}>
                    {tokens.map((tok, ti) => (
                      <Text key={`tok-${i}-${ti}`} style={{ color: tokenColors[tok.type] }}>
                        {tok.text}
                      </Text>
                    ))}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {isTall && !expanded ? (
              <View
                style={[codeStyles.fadeOverlay, { backgroundColor: isDark ? 'rgba(26,27,30,0.92)' : 'rgba(248,248,248,0.92)' }]}
                pointerEvents="none"
              />
            ) : null}
          </View>
        </ScrollView>

        {/* Expand/collapse */}
        {isTall ? (
          <TouchableOpacity
            style={[codeStyles.expandBtn, { borderTopColor: borderColor, backgroundColor: headerBg }]}
            onPress={() => setExpanded(v => !v)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)'}
            />
            <Text style={[codeStyles.expandLabel, { color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)' }]}>
              {expanded ? 'Show less' : `Show ${lines.length - COLLAPSE_LINES} more lines`}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* ── Code Runner Modal ── */}
      <Modal visible={runnerVisible} animationType="slide" transparent={false} onRequestClose={() => setRunnerVisible(false)}>
        <View style={{ flex: 1, backgroundColor: '#0E0E0E', paddingTop: insets.top }}>
          {/* Runner header */}
          <View style={runnerStyles.header}>
            <TouchableOpacity
              onPress={() => setRunnerVisible(false)}
              style={runnerStyles.closeBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={18} color="#FFF" />
            </TouchableOpacity>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[runnerStyles.langDot, { backgroundColor: langColor }]} />
              <Text style={runnerStyles.headerTitle}>{langLabel} Runner</Text>
            </View>
            <TouchableOpacity
              onPress={() => { setRunnerReady(false); setTimeout(() => setRunnerReady(true), 50); }}
              style={runnerStyles.rerunBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="refresh" size={14} color="#30D158" />
              <Text style={{ color: '#30D158', fontSize: 12, fontWeight: '700', marginLeft: 4 }}>Re-run</Text>
            </TouchableOpacity>
          </View>

          {/* Code preview pane */}
          <View style={runnerStyles.codePanelHeader}>
            <Text style={runnerStyles.panelLabel}>Code</Text>
          </View>
          <ScrollView
            style={runnerStyles.codePane}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            <Text style={runnerStyles.codeText}>{code}</Text>
          </ScrollView>

          {/* Output pane */}
          <View style={runnerStyles.outputPanelHeader}>
            <Ionicons name="terminal" size={13} color="#30D158" />
            <Text style={[runnerStyles.panelLabel, { color: '#30D158', marginLeft: 6 }]}>Output</Text>
            {!runnerReady ? (
              <ActivityIndicator size="small" color="#30D158" style={{ marginLeft: 8 }} />
            ) : null}
          </View>

          <View style={runnerStyles.webViewContainer}>
            <WebView
              key={runnerReady ? 'ready' : 'loading'}
              source={{ html: runnerHtml }}
              style={runnerStyles.webView}
              javaScriptEnabled
              domStorageEnabled
              scrollEnabled
              onLoadEnd={() => setRunnerReady(true)}
              showsVerticalScrollIndicator={false}
              backgroundColor="#0E0E0E"
              originWhitelist={['*']}
              allowsInlineMediaPlayback
              // Sandboxed — no navigation
              onNavigationStateChange={(state) => {
                if (!state.url.startsWith('about:')) {
                  // Block navigation
                }
              }}
            />
          </View>

          <View style={{ paddingBottom: insets.bottom + 8, paddingHorizontal: 16, paddingTop: 8 }}>
            <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, textAlign: 'center' }}>
              Runs in sandboxed environment • No network access
            </Text>
          </View>
        </View>
      </Modal>
    </>
  );
});

// ── CodeBlock (re-exported alias) ─────────────────────────────────────────────
export { StreamingCodeBlock as CodeBlock };

// ── Styles ────────────────────────────────────────────────────────────────────
const codeStyles = StyleSheet.create({
  container: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginVertical: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  streamDot: {
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginLeft: 4,
  },
  runBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  runLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
    gap: 4,
  },
  copyLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  codeContent: {
    paddingHorizontal: 10,
    paddingVertical: 12,
    minWidth: '100%',
  },
  codeLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 1,
    paddingHorizontal: 2,
    marginBottom: 1,
  },
  lineNumber: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 20,
    marginRight: 14,
    minWidth: 20,
    textAlign: 'right',
  },
  lineContent: {
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 20,
    flex: 1,
  },
  fadeOverlay: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: 52,
  },
  expandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 5,
  },
  expandLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
});

const runnerStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#111',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    gap: 10,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  langDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  rerunBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(48,209,88,0.12)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(48,209,88,0.3)',
  },
  codePanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: '#161618',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  panelLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  codePane: {
    maxHeight: 160,
    backgroundColor: '#0E0E0E',
    padding: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  codeText: {
    color: '#9CDCFE',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 19,
  },
  outputPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: '#0A1A0A',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(48,209,88,0.15)',
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: '#0E0E0E',
  },
  webView: {
    flex: 1,
    backgroundColor: '#0E0E0E',
  },
});
