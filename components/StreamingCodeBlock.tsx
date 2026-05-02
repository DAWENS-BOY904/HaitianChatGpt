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
  Clipboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';

const { width: SCREEN_W } = Dimensions.get('window');

// ── Dark theme token colors (VS Code Dark+ inspired) ──────────────────────────
const T = {
  bg:       '#1e1e1e',
  header:   '#252526',
  border:   '#3c3c3c',
  // syntax
  keyword:  '#569CD6',   // blue  — const, let, return, if
  control:  '#C586C0',   // purple — function, class, import
  string:   '#CE9178',   // peach — "string"
  template: '#CE9178',   // template literal
  comment:  '#6A9955',   // green — // comment
  number:   '#B5CEA8',   // light green — 42, 3.14
  type:     '#4EC9B0',   // teal — ClassName, Type
  func:     '#DCDCAA',   // yellow — functionName()
  operator: '#D4D4D4',   // white — = + - * /
  attr:     '#9CDCFE',   // light blue — attribute
  tag:      '#4EC9B0',   // teal — <html-tag>
  tagAttr:  '#9CDCFE',   // <tag attr="">
  attrVal:  '#CE9178',   // attribute="value"
  special:  '#FF8C00',   // placeholder highlight
  lineNum:  '#858585',   // gutter numbers
  plain:    '#D4D4D4',   // default
  phBg:     'rgba(255,140,0,0.15)',
  cursor:   '#AEAFAD',
};

// ── Light theme token colors (GitHub Light / VS Code Light+) ───────────────
const TL = {
  bg:       '#FFFFFF',
  header:   '#F6F8FA',
  border:   '#D0D7DE',
  keyword:  '#CF222E',   // red — const, let, if
  control:  '#8250DF',   // purple — function, class, import
  string:   '#0A3069',   // dark blue — "string"
  template: '#0A3069',
  comment:  '#6E7781',   // gray — // comment
  number:   '#0550AE',   // blue — numbers
  type:     '#953800',   // orange-brown — TypeName
  func:     '#8250DF',   // purple — functionName()
  operator: '#24292F',   // near-black
  attr:     '#0550AE',   // blue — attributes
  tag:      '#116329',   // green — <html-tag>
  tagAttr:  '#0550AE',
  attrVal:  '#0A3069',
  special:  '#E36209',   // orange — placeholder
  lineNum:  '#8C959F',
  plain:    '#24292F',   // near-black default
  phBg:     'rgba(227,98,9,0.10)',
  cursor:   '#24292F',
};

// ── Language registry ─────────────────────────────────────────────────────────
interface LangInfo {
  label: string;
  dot: string;    // badge color
  icon?: string;  // remote png url for the icon badge
  runnable: boolean;
  previewable: boolean;
}

const LANGS: Record<string, LangInfo> = {
  javascript:  { label: 'JavaScript',  dot: '#F7DF1E', icon: 'https://upload.wikimedia.org/wikipedia/commons/6/6a/JavaScript-logo.png',      runnable: true,  previewable: true  },
  js:          { label: 'JavaScript',  dot: '#F7DF1E', icon: 'https://upload.wikimedia.org/wikipedia/commons/6/6a/JavaScript-logo.png',      runnable: true,  previewable: true  },
  jsx:         { label: 'JSX',         dot: '#61DAFB', icon: 'https://upload.wikimedia.org/wikipedia/commons/a/a7/React-icon.svg',            runnable: true,  previewable: true  },
  typescript:  { label: 'TypeScript',  dot: '#3178C6', icon: 'https://upload.wikimedia.org/wikipedia/commons/4/4c/Typescript_logo_2020.svg',  runnable: true,  previewable: true  },
  ts:          { label: 'TypeScript',  dot: '#3178C6', icon: 'https://upload.wikimedia.org/wikipedia/commons/4/4c/Typescript_logo_2020.svg',  runnable: true,  previewable: true  },
  tsx:         { label: 'TSX',         dot: '#3178C6', icon: 'https://upload.wikimedia.org/wikipedia/commons/4/4c/Typescript_logo_2020.svg',  runnable: true,  previewable: true  },
  html:        { label: 'HTML',        dot: '#E34F26', icon: 'https://www.w3.org/html/logo/downloads/HTML5_Logo_512.png',                    runnable: true,  previewable: true  },
  htm:         { label: 'HTML',        dot: '#E34F26', icon: 'https://www.w3.org/html/logo/downloads/HTML5_Logo_512.png',                    runnable: true,  previewable: true  },
  css:         { label: 'CSS',         dot: '#264DE4', icon: 'https://upload.wikimedia.org/wikipedia/commons/6/62/CSS3_logo.svg',            runnable: true,  previewable: true  },
  scss:        { label: 'SCSS',        dot: '#CF649A', icon: 'https://upload.wikimedia.org/wikipedia/commons/6/62/CSS3_logo.svg',            runnable: true,  previewable: true  },
  python:      { label: 'Python',      dot: '#3572A5', icon: 'https://s3.dualstack.us-east-2.amazonaws.com/pythondotorg-assets/media/community/logos/python-logo-only.png', runnable: true, previewable: false },
  py:          { label: 'Python',      dot: '#3572A5', icon: 'https://s3.dualstack.us-east-2.amazonaws.com/pythondotorg-assets/media/community/logos/python-logo-only.png', runnable: true, previewable: false },
  bash:        { label: 'Bash',        dot: '#4EAA25', runnable: true,  previewable: false },
  sh:          { label: 'Shell',       dot: '#4EAA25', runnable: true,  previewable: false },
  shell:       { label: 'Shell',       dot: '#4EAA25', runnable: true,  previewable: false },
  json:        { label: 'JSON',        dot: '#CB7700', runnable: false, previewable: false },
  sql:         { label: 'SQL',         dot: '#336791', runnable: false, previewable: false },
  java:        { label: 'Java',        dot: '#B07219', runnable: false, previewable: false },
  kotlin:      { label: 'Kotlin',      dot: '#A97BFF', runnable: false, previewable: false },
  swift:       { label: 'Swift',       dot: '#F05138', runnable: false, previewable: false },
  go:          { label: 'Go',          dot: '#00ACD7', runnable: false, previewable: false },
  rust:        { label: 'Rust',        dot: '#CE412B', runnable: false, previewable: false },
  ruby:        { label: 'Ruby',        dot: '#CC342D', runnable: false, previewable: false },
  php:         { label: 'PHP',         dot: '#777BB4', runnable: false, previewable: false },
  c:           { label: 'C',           dot: '#555555', runnable: false, previewable: false },
  cpp:         { label: 'C++',         dot: '#00599C', runnable: false, previewable: false },
  cs:          { label: 'C#',          dot: '#239120', runnable: false, previewable: false },
  dart:        { label: 'Dart',        dot: '#0175C2', runnable: false, previewable: false },
  r:           { label: 'R',           dot: '#198CE7', runnable: false, previewable: false },
  yaml:        { label: 'YAML',        dot: '#CB171E', runnable: false, previewable: false },
  yml:         { label: 'YAML',        dot: '#CB171E', runnable: false, previewable: false },
  xml:         { label: 'XML',         dot: '#FF6600', runnable: false, previewable: false },
  dockerfile:  { label: 'Dockerfile',  dot: '#2496ED', runnable: false, previewable: false },
  graphql:     { label: 'GraphQL',     dot: '#E10098', runnable: false, previewable: false },
  lua:         { label: 'Lua',         dot: '#000080', runnable: false, previewable: false },
  markdown:    { label: 'Markdown',    dot: '#083FA1', runnable: false, previewable: false },
  md:          { label: 'Markdown',    dot: '#083FA1', runnable: false, previewable: false },
  code:        { label: 'Code',        dot: '#888888', runnable: false, previewable: false },
  text:        { label: 'Text',        dot: '#888888', runnable: false, previewable: false },
  env:         { label: 'ENV',         dot: '#ECC94B', runnable: false, previewable: false },
};

function getLang(raw: string): LangInfo & { key: string } {
  const key = (raw || '').toLowerCase().trim();
  const info = LANGS[key] || { label: raw || 'Code', dot: '#888', runnable: false, previewable: false };
  return { ...info, key };
}

// ── Syntax token type ─────────────────────────────────────────────────────────
type Token = { text: string; color: string; bold?: boolean; isPlaceholder?: boolean };

// ── Placeholder detection ─────────────────────────────────────────────────────
const PH_RE = /\b(YOUR_API_KEY|YOUR_SECRET_KEY|YOUR_PUBLIC_KEY|API_KEY_HERE|SECRET_KEY_HERE|YOUR_TOKEN|YOUR_ACCESS_TOKEN|INSERT_API_KEY|PUT_YOUR_KEY_HERE|your_api_key|your_secret|ADD_YOUR_KEY)\b/g;

function injectPlaceholders(tokens: Token[]): Token[] {
  return tokens.flatMap(tok => {
    if (tok.isPlaceholder) return [tok];
    const parts: Token[] = [];
    let last = 0;
    const re = new RegExp(PH_RE.source, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(tok.text)) !== null) {
      if (m.index > last) parts.push({ text: tok.text.slice(last, m.index), color: tok.color });
      parts.push({ text: m[0], color: T.special, isPlaceholder: true, bold: true });
      last = re.lastIndex;
    }
    if (last < tok.text.length) parts.push({ text: tok.text.slice(last), color: tok.color });
    return parts.length ? parts : [tok];
  });
}

// ── Tokenizer engine ──────────────────────────────────────────────────────────
type TokenRule = { re: RegExp; color: string; group?: number };

function applyRules(line: string, rules: TokenRule[]): Token[] {
  // Build a combined regex that alternates all patterns
  const combined = new RegExp(rules.map((r, i) => `(?<g${i}>${r.re.source})`).join('|'), 'g');
  const tokens: Token[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = combined.exec(line)) !== null) {
    if (m.index > last) tokens.push({ text: line.slice(last, m.index), color: T.plain });
    for (let i = 0; i < rules.length; i++) {
      const key = `g${i}`;
      if (m.groups && m.groups[key] !== undefined && m.groups[key] !== null && m[0] !== undefined) {
        tokens.push({ text: m.groups[key], color: rules[i].color });
        break;
      }
    }
    last = combined.lastIndex;
  }
  if (last < line.length) tokens.push({ text: line.slice(last), color: T.plain });
  return tokens;
}

// ── Per-language tokenizers ───────────────────────────────────────────────────
function tokenizeHTML(line: string): Token[] {
  const tokens: Token[] = [];
  let last = 0;
  const re = /(<!--[\s\S]*?-->)|(<\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[\w:.-]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s/>]*))?)*)\s*(\/?>)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) tokens.push({ text: line.slice(last, m.index), color: T.plain });
    if (m[1]) {
      tokens.push({ text: m[1], color: T.comment });
    } else {
      if (m[2]) tokens.push({ text: m[2], color: T.tag });
      tokens.push({ text: m[3], color: T.tag, bold: true });
      if (m[4]) {
        const attrRe = /([\w:.-]+)(\s*=\s*)("([^"]*)"|'([^']*)')/g;
        let lastA = 0;
        let ma: RegExpExecArray | null;
        while ((ma = attrRe.exec(m[4])) !== null) {
          if (ma.index > lastA) tokens.push({ text: m[4].slice(lastA, ma.index), color: T.plain });
          tokens.push({ text: ma[1], color: T.tagAttr });
          if (ma[2]) tokens.push({ text: ma[2], color: T.operator });
          tokens.push({ text: ma[3], color: T.attrVal });
          lastA = attrRe.lastIndex;
        }
        if (lastA < m[4].length) tokens.push({ text: m[4].slice(lastA), color: T.tagAttr });
      }
      tokens.push({ text: m[5], color: T.tag });
    }
    last = re.lastIndex;
  }
  if (last < line.length) tokens.push({ text: line.slice(last), color: T.plain });
  return tokens;
}

function tokenizeJS(line: string): Token[] {
  try {
    return applyRules(line, [
      { re: /\/\/[^\n]*/, color: T.comment },
      { re: /\/\*[\s\S]*?\*\//, color: T.comment },
      { re: /`[^`\\]*(?:\\.[^`\\]*)*`/, color: T.template },
      { re: /"(?:[^"\\]|\\.)*"/, color: T.string },
      { re: /'(?:[^'\\]|\\.)*'/, color: T.string },
      { re: /\b(?:const|let|var|return|if|else|for|while|do|switch|case|break|continue|new|delete|typeof|instanceof|void|in|of|yield|async|await|try|catch|finally|throw|debugger|with|default)\b/, color: T.keyword },
      { re: /\b(?:function|class|extends|import|export|from|as|static|abstract|implements|interface|type|enum|namespace|module|declare|readonly|override|satisfies)\b/, color: T.control },
      { re: /\b(?:true|false|null|undefined|NaN|Infinity|this|super|arguments)\b/, color: T.keyword },
      { re: /\b[A-Z][A-Za-z0-9_]*(?=\s*[(<])/, color: T.type },
      { re: /\b[A-Z][A-Za-z0-9_]*\b/, color: T.type },
      { re: /\b[a-z_$][a-zA-Z0-9_$]*(?=\s*\()/, color: T.func },
      { re: /-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/, color: T.number },
      { re: /(?:===|!==|==|!=|>=|<=|=>|&&|\|\||[+\-*/%&|^~!<>=?:])/, color: T.operator },
    ]);
  } catch { return [{ text: line, color: T.plain }]; }
}

function tokenizeCSS(line: string): Token[] {
  try {
    return applyRules(line, [
      { re: /\/\*[\s\S]*?\*\//, color: T.comment },
      { re: /"[^"]*"|'[^']*'/, color: T.string },
      { re: /#[a-fA-F0-9]{3,8}\b/, color: T.string },
      { re: /\b\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|vmin|vmax|pt|cm|mm|s|ms|fr|ch|ex|deg|rad|turn|grad)\b/, color: T.number },
      { re: /\b(?:!important)\b/, color: T.keyword },
      { re: /\b(?:var|calc|rgb|rgba|hsl|hsla|url|linear-gradient|radial-gradient|conic-gradient)\b/, color: T.func },
      { re: /@[\w-]+/, color: T.control },
      { re: /[.#:]{1}[\w-]+/, color: T.tag },
      { re: /[\w-]+\s*(?=:)/, color: T.attr },
      { re: /[{}:;,>~+*]/, color: T.operator },
    ]);
  } catch { return [{ text: line, color: T.plain }]; }
}

function tokenizePython(line: string): Token[] {
  try {
    return applyRules(line, [
      { re: /#[^\n]*/, color: T.comment },
      { re: /"""[\s\S]*?"""|'''[\s\S]*?'''/, color: T.string },
      { re: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/, color: T.string },
      { re: /@[\w.]+/, color: T.control },
      { re: /\b(?:def|class|import|from|return|if|elif|else|for|while|in|not|and|or|is|lambda|with|as|try|except|finally|raise|pass|break|continue|yield|global|nonlocal|del|assert|async|await|match|case)\b/, color: T.keyword },
      { re: /\b(?:True|False|None)\b/, color: T.number },
      { re: /\b(?:print|len|range|list|dict|set|tuple|str|int|float|bool|type|isinstance|hasattr|getattr|setattr|enumerate|zip|map|filter|sorted|reversed|open|input|super|property|staticmethod|classmethod)\b/, color: T.func },
      { re: /\b[A-Z][A-Za-z0-9_]*\b/, color: T.type },
      { re: /\b[a-z_][a-zA-Z0-9_]*(?=\s*\()/, color: T.func },
      { re: /-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/, color: T.number },
      { re: /[=+\-*/%&|^~<>!]+/, color: T.operator },
    ]);
  } catch { return [{ text: line, color: T.plain }]; }
}

function tokenizeJSON(line: string): Token[] {
  try {
    return applyRules(line, [
      { re: /"(?:[^"\\]|\\.)*"\s*:/, color: T.attr },
      { re: /"(?:[^"\\]|\\.)*"/, color: T.string },
      { re: /\b(?:true|false|null)\b/, color: T.keyword },
      { re: /-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/, color: T.number },
      { re: /[{}[\]:,]/, color: T.operator },
    ]);
  } catch { return [{ text: line, color: T.plain }]; }
}

function tokenizeBash(line: string): Token[] {
  try {
    return applyRules(line, [
      { re: /#[^\n]*/, color: T.comment },
      { re: /"(?:[^"\\]|\\.)*"|'[^']*'/, color: T.string },
      { re: /\$\{?[\w@#*!?-]+\}?/, color: T.attr },
      { re: /\b(?:if|then|else|elif|fi|for|while|do|done|case|esac|in|function|return|exit|local|export|source|readonly|declare|set|unset|shift|eval|exec|trap|wait|until|select)\b/, color: T.keyword },
      { re: /\b(?:echo|cd|ls|mkdir|rm|cp|mv|sudo|cat|grep|sed|awk|curl|wget|chmod|chown|kill|ps|find|which|head|tail|sort|uniq|wc|xargs|tr|cut|touch|date|pwd|env|export|alias|history)\b/, color: T.func },
      { re: /--?[\w-]+/, color: T.attr },
      { re: /\d+/, color: T.number },
      { re: /[|&;<>(){}!]/, color: T.operator },
    ]);
  } catch { return [{ text: line, color: T.plain }]; }
}

function tokenizeSQL(line: string): Token[] {
  try {
    return applyRules(line, [
      { re: /--[^\n]*/, color: T.comment },
      { re: /'(?:[^'\\]|\\.)*'/, color: T.string },
      { re: /\b(?:SELECT|FROM|WHERE|INSERT|INTO|UPDATE|DELETE|CREATE|DROP|ALTER|TABLE|INDEX|DATABASE|SCHEMA|VIEW|JOIN|LEFT|RIGHT|INNER|OUTER|FULL|CROSS|ON|AS|AND|OR|NOT|IN|IS|NULL|ORDER|BY|GROUP|HAVING|LIMIT|OFFSET|DISTINCT|UNION|ALL|EXISTS|SET|VALUES|PRIMARY|KEY|FOREIGN|REFERENCES|CASCADE|DEFAULT|CONSTRAINT|UNIQUE|CHECK|TRIGGER|PROCEDURE|FUNCTION|BEGIN|COMMIT|ROLLBACK|TRANSACTION)\b/i, color: T.keyword },
      { re: /\b(?:COUNT|SUM|AVG|MAX|MIN|COALESCE|CONCAT|SUBSTRING|TRIM|UPPER|LOWER|CAST|CONVERT|NOW|DATE|DATEADD|DATEDIFF|ISNULL|NULLIF|IIF|CASE|WHEN|THEN|END)\b/i, color: T.func },
      { re: /\b[A-Z][A-Za-z0-9_]*\b/, color: T.type },
      { re: /\b\d+(?:\.\d+)?\b/, color: T.number },
      { re: /[=<>!+\-*/%(),;]/, color: T.operator },
    ]);
  } catch { return [{ text: line, color: T.plain }]; }
}

function tokenizePlain(line: string): Token[] {
  return [{ text: line, color: T.plain }];
}

function tokenizeLine(line: string, langKey: string): Token[] {
  let raw: Token[];
  switch (langKey) {
    case 'html': case 'htm': case 'xml':   raw = tokenizeHTML(line);   break;
    case 'js':   case 'ts':  case 'jsx':
    case 'tsx':  case 'javascript':
    case 'typescript':                     raw = tokenizeJS(line);     break;
    case 'css':  case 'scss':              raw = tokenizeCSS(line);    break;
    case 'python': case 'py':             raw = tokenizePython(line); break;
    case 'json':                           raw = tokenizeJSON(line);   break;
    case 'bash': case 'sh': case 'shell': raw = tokenizeBash(line);   break;
    case 'sql':                            raw = tokenizeSQL(line);    break;
    default:                               raw = tokenizePlain(line);  break;
  }
  return injectPlaceholders(raw);
}

// ── Blinking cursor ───────────────────────────────────────────────────────────
const BlinkCursor = memo(function BlinkCursor() {
  const op = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(Animated.sequence([
      Animated.timing(op, { toValue: 0, duration: 520, useNativeDriver: true }),
      Animated.timing(op, { toValue: 1, duration: 520, useNativeDriver: true }),
    ]));
    anim.start();
    return () => anim.stop();
  }, []);
  return <Animated.View style={{ opacity: op, width: 2, height: 15, backgroundColor: T.cursor, marginLeft: 2, borderRadius: 1 }} />;
});

// ── Language dot badge ────────────────────────────────────────────────────────
const LangDot = memo(function LangDot({ langKey }: { langKey: string }) {
  const info = getLang(langKey);
  if (info.icon) {
    return (
      <Image
        source={{ uri: info.icon }}
        style={{ width: 18, height: 18, borderRadius: 3 }}
        resizeMode="contain"
      />
    );
  }
  const initials = info.label.split(/[\s+]/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase();
  return (
    <View style={{
      width: 18, height: 18, borderRadius: 3,
      backgroundColor: info.dot + '28', borderWidth: 1, borderColor: info.dot + '55',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ fontSize: 7, fontWeight: '900', color: info.dot, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>
        {initials || '?'}
      </Text>
    </View>
  );
});

// ── Copy button ───────────────────────────────────────────────────────────────
const CopyBtn = memo(function CopyBtn({ code }: { code: string }) {
  const [ok, setOk] = useState(false);
  const onPress = useCallback(() => {
    try { Clipboard.setString(code); } catch {}
    setOk(true);
    setTimeout(() => setOk(false), 1800);
  }, [code]);
  return (
    <TouchableOpacity onPress={onPress} style={st.actionBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} activeOpacity={0.7}>
      {/* SVG-equivalent via Ionicons — cross-platform, no native-svg dep needed */}
      <Ionicons name={ok ? 'checkmark' : 'copy-outline'} size={15} color={ok ? '#98C379' : 'rgba(200,200,200,0.7)'} />
    </TouchableOpacity>
  );
});

// ── HTML preview builder ──────────────────────────────────────────────────────
function buildHTML(code: string, langKey: string): string {
  if (['html', 'htm'].includes(langKey)) {
    if (code.includes('<!DOCTYPE') || code.includes('<html')) return code;
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif}</style></head><body>${code}</body></html>`;
  }
  if (['css', 'scss'].includes(langKey)) {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:16px;font-family:system-ui,sans-serif}${code}</style></head><body><h1>CSS Preview</h1><p>Your styles are applied to this page.</p><button class="btn">Sample Button</button><div class="card">Sample Card</div></body></html>`;
  }
  if (['js', 'jsx', 'ts', 'tsx', 'javascript', 'typescript'].includes(langKey)) {
    // Strip TS types for safe eval
    const stripped = code
      .replace(/:\s*(string|number|boolean|any|void|never|unknown|object|null|undefined|[A-Z][A-Za-z<>[\], ]*?)(\[\])?\s*(?=[,)=;{]|=>)/g, '')
      .replace(/interface\s+\w+\s*\{[^}]*\}/g, '')
      .replace(/type\s+\w+\s*=\s*[^;]+;/g, '')
      .replace(/<[A-Z][a-zA-Z]*(\[\])?>/g, '');
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{margin:0;background:#0d1117;color:#c9d1d9;font-family:'Courier New',monospace;font-size:13px;padding:16px;line-height:1.6}#o{white-space:pre-wrap}.l{color:#58A6FF}.e{color:#FF7B72}.r{color:#3FB950}</style></head><body><div id="o"></div><script>
const el=document.getElementById('o');
const _log=console.log,_err=console.error,_warn=console.warn;
function put(t,c){const d=document.createElement('div');d.className=c||'l';d.textContent=t;el.appendChild(d);}
console.log=(...a)=>{_log(...a);put(a.map(x=>typeof x==='object'?JSON.stringify(x,null,2):String(x)).join(' '),'l');};
console.error=(...a)=>{_err(...a);put('ERR: '+a.join(' '),'e');};
console.warn=(...a)=>{_warn(...a);put('WARN: '+a.join(' '),'l');};
window.onerror=(m,s,l)=>{put('Runtime error (line '+l+'): '+m,'e');return true;};
try{${stripped}}catch(e){put('Error: '+e.message,'e');}
</script></body></html>`;
  }
  if (['python', 'py'].includes(langKey)) {
    const esc = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{box-sizing:border-box}body{margin:0;background:#1e1e1e;color:#d4d4d4;font-family:'Courier New',monospace;font-size:13px;padding:16px;line-height:1.6}.hdr{color:#4EC9B0;border-bottom:1px solid #3c3c3c;padding-bottom:8px;margin-bottom:12px;font-size:12px}.code{background:#252526;border:1px solid #3c3c3c;border-radius:6px;padding:12px;white-space:pre-wrap;margin-bottom:12px}.out-lbl{color:#3FB950;font-weight:bold;font-size:11px;margin-bottom:4px}.out{background:#0d1117;border:1px solid #30363d;border-radius:4px;padding:10px;color:#3FB950;min-height:44px;font-size:12px}.note{color:#6A9955;font-size:11px;margin-top:8px;font-style:italic}</style></head><body><div class="hdr">Python Preview</div><pre class="code">${esc}</pre><div class="out-lbl">Output</div><div class="out">[Run in a Python environment to see real output]</div><div class="note">Static preview only.</div></body></html>`;
  }
  if (['bash', 'sh', 'shell'].includes(langKey)) {
    const lines = code.split('\n').map(l => {
      const esc = l.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      if (l.trim().startsWith('#')) return `<div class="cmt">${esc}</div>`;
      if (!l.trim()) return '<div style="height:8px"></div>';
      return `<div><span class="prompt">$ </span><span class="cmd">${esc}</span></div>`;
    }).join('');
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{box-sizing:border-box}body{margin:0;background:#0d1117;color:#3FB950;font-family:'Courier New',monospace;font-size:13px;padding:16px;line-height:1.8}.prompt{color:#58A6FF;font-weight:bold}.cmd{color:#E6EDF3}.cmt{color:#6A9955;font-style:italic}.hdr{color:#58A6FF;border-bottom:1px solid #30363d;padding-bottom:8px;margin-bottom:12px;font-size:11px}</style></head><body><div class="hdr">Terminal Simulation</div>${lines}</body></html>`;
  }
  const esc = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{margin:16px;font-family:'Courier New',monospace;background:#1e1e1e;color:#d4d4d4;font-size:13px;white-space:pre-wrap}</style></head><body>${esc}</body></html>`;
}

// ── Code runner / preview modal ───────────────────────────────────────────────
const RunnerModal = memo(function RunnerModal({
  visible, code, langKey, isDark, onClose,
}: { visible: boolean; code: string; langKey: string; isDark?: boolean; onClose: () => void }) {
  const C = isDark !== false ? T : TL;
  const info = getLang(langKey);
  const [tab, setTab] = useState<'preview' | 'code'>('preview');
  const [wvLoaded, setWvLoaded] = useState(false);
  const html = buildHTML(code, langKey);
  const isTerminal = ['bash', 'sh', 'shell'].includes(langKey);
  const isPython = ['python', 'py'].includes(langKey);
  const tabLabel = isTerminal ? 'Terminal' : isPython ? 'Output' : info.previewable ? 'Preview' : 'Run';
  const dark = isDark !== false;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={[st.modalRoot, { backgroundColor: C.bg }]}>
        {/* Modal Header */}
        <View style={[st.modalHdr, { backgroundColor: C.header, borderBottomColor: C.border }]}>
          <TouchableOpacity onPress={onClose} style={st.modalClose} hitSlop={12}>
            <Ionicons name="chevron-down" size={22} color={dark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)'} />
          </TouchableOpacity>
          <View style={st.modalTitle}>
            <LangDot langKey={langKey} />
            <Text style={[st.modalLangText, { color: info.dot }]}>{info.label}</Text>
          </View>
          <CopyBtn code={code} />
        </View>
        {/* Tab bar */}
        <View style={[st.modalTabBar, { backgroundColor: C.header, borderBottomColor: C.border }]}>
          <TouchableOpacity
            style={[st.modalTab, tab === 'preview' && st.modalTabActive]}
            onPress={() => setTab('preview')}
          >
            <Ionicons
              name={isTerminal ? 'terminal-outline' : isPython ? 'code-working-outline' : 'globe-outline'}
              size={14}
              color={tab === 'preview' ? (dark ? '#fff' : '#000') : (dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)')}
            />
            <Text style={[st.modalTabText, tab === 'preview' && { color: dark ? '#fff' : '#000' }]}>{tabLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[st.modalTab, tab === 'code' && st.modalTabActive]}
            onPress={() => setTab('code')}
          >
            <Ionicons name="code-slash" size={14} color={tab === 'code' ? (dark ? '#fff' : '#000') : (dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)')} />
            <Text style={[st.modalTabText, tab === 'code' && { color: dark ? '#fff' : '#000' }]}>Code</Text>
          </TouchableOpacity>
        </View>
        {/* Content */}
        {tab === 'preview' ? (
          <View style={{ flex: 1 }}>
            {!wvLoaded && (
              <View style={st.wvLoading}>
                <Ionicons name="globe-outline" size={32} color="rgba(255,255,255,0.3)" />
                <Text style={st.wvLoadingText}>Loading...</Text>
              </View>
            )}
            <WebView
              source={{ html }}
              style={{ flex: 1 }}
              javaScriptEnabled
              domStorageEnabled
              originWhitelist={['*']}
              onLoad={() => setWvLoaded(true)}
            />
          </View>
        ) : (
          <FullCodeView code={code} langKey={langKey} isDark={dark} />
        )}
      </SafeAreaView>
    </Modal>
  );
});

// ── Fullscreen code viewer modal ──────────────────────────────────────────────
const FullscreenModal = memo(function FullscreenModal({
  visible, code, langKey, isDark, onClose,
}: { visible: boolean; code: string; langKey: string; isDark?: boolean; onClose: () => void }) {
  const C = isDark !== false ? T : TL;
  const dark = isDark !== false;
  const info = getLang(langKey);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={[st.modalRoot, { backgroundColor: C.bg }]}>
        <View style={[st.modalHdr, { backgroundColor: C.header, borderBottomColor: C.border }]}>
          <TouchableOpacity onPress={onClose} style={st.modalClose} hitSlop={12}>
            <Ionicons name="chevron-down" size={22} color={dark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)'} />
          </TouchableOpacity>
          <View style={st.modalTitle}>
            <LangDot langKey={langKey} />
            <Text style={[st.modalLangText, { color: info.dot }]}>{info.label}</Text>
          </View>
          <CopyBtn code={code} />
        </View>
        <FullCodeView code={code} langKey={langKey} isDark={dark} />
      </SafeAreaView>
    </Modal>
  );
});

const FullCodeView = memo(function FullCodeView({ code, langKey, isDark = true }: { code: string; langKey: string; isDark?: boolean }) {
  const C = isDark ? T : TL;
  const lines = code.split('\n');
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} nestedScrollEnabled showsVerticalScrollIndicator indicatorStyle={isDark ? 'white' : 'black'}>
      <ScrollView horizontal showsHorizontalScrollIndicator indicatorStyle={isDark ? 'white' : 'black'} contentContainerStyle={st.codeRow}>
        <View style={[st.gutterCol, { borderRightColor: C.border }]}>
          {lines.map((_, i) => (
            <Text key={i} style={[st.gutterNum, { color: C.lineNum }]}>{i + 1}</Text>
          ))}
        </View>
        <View style={st.linesCol}>
          {lines.map((line, i) => (
            <View key={i} style={st.codeLine}>
              {tokenizeLine(line, langKey).map((tok, j) => {
                const color = isDark ? tok.color : (() => {
                  if (tok.color === T.keyword)  return TL.keyword;
                  if (tok.color === T.control)  return TL.control;
                  if (tok.color === T.string || tok.color === T.template) return TL.string;
                  if (tok.color === T.comment)  return TL.comment;
                  if (tok.color === T.number)   return TL.number;
                  if (tok.color === T.type)     return TL.type;
                  if (tok.color === T.func)     return TL.func;
                  if (tok.color === T.operator) return TL.operator;
                  if (tok.color === T.attr || tok.color === T.tagAttr) return TL.attr;
                  if (tok.color === T.tag)      return TL.tag;
                  if (tok.color === T.attrVal)  return TL.attrVal;
                  if (tok.color === T.special)  return TL.special;
                  return TL.plain;
                })();
                return tok.isPlaceholder ? (
                  <View key={j} style={{ backgroundColor: C.phBg, borderRadius: 3, paddingHorizontal: 2 }}>
                    <Text style={[st.codeToken, { color, fontWeight: '700' }]}>{tok.text}</Text>
                  </View>
                ) : (
                  <Text key={j} style={[st.codeToken, { color, fontWeight: tok.bold ? '700' : '400' }]}>{tok.text}</Text>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </ScrollView>
  );
});

// ── Inline preview (inside chat bubble) ──────────────────────────────────────
const InlinePreview = memo(function InlinePreview({ code, langKey }: { code: string; langKey: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <View style={{ height: 240, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, overflow: 'hidden', backgroundColor: '#fff' }}>
      {!loaded && (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f5f5' }]}>
          <Ionicons name="globe-outline" size={24} color="#ccc" />
          <Text style={{ color: '#bbb', fontSize: 12, marginTop: 6 }}>Loading preview...</Text>
        </View>
      )}
      <WebView
        source={{ html: buildHTML(code, langKey) }}
        style={{ flex: 1 }}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        onLoad={() => setLoaded(true)}
      />
    </View>
  );
});

// ── Main CodeBlock component ──────────────────────────────────────────────────
interface CodeBlockProps {
  code: string;
  language?: string;
  fileName?: string;
  /** If true, code will animate in character by character */
  streaming?: boolean;
  /** Pass false to use light mode palette (GitHub Light). Defaults to true (dark mode). */
  isDark?: boolean;
}

const COLLAPSE_AT = 16;

export const CodeBlock = memo(function CodeBlock({
  code,
  language = 'code',
  fileName,
  streaming = false,
  isDark = true,
}: CodeBlockProps) {
  // Pick palette based on isDark
  const C = isDark ? T : TL;
  const langKey = (language || 'code').toLowerCase().trim();
  const info = getLang(langKey);

  // ── Streaming animation ──
  const [displayedCode, setDisplayedCode] = useState(streaming ? '' : code);
  const charIdxRef = useRef(streaming ? 0 : code.length);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const codeRef = useRef(code);

  useEffect(() => {
    codeRef.current = code;
    if (!streaming) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setDisplayedCode(code);
      charIdxRef.current = code.length;
      return;
    }
    if (charIdxRef.current >= code.length) {
      // All chars already shown — sync in case more arrived
      setDisplayedCode(code);
      return;
    }
    const tick = () => {
      const full = codeRef.current;
      if (charIdxRef.current >= full.length) return;
      const next = Math.min(charIdxRef.current + 10, full.length);
      setDisplayedCode(full.slice(0, next));
      charIdxRef.current = next;
      if (charIdxRef.current < full.length) timerRef.current = setTimeout(tick, 14);
    };
    timerRef.current = setTimeout(tick, 0);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [code, streaming]);

  const isStreaming = streaming && displayedCode.length < code.length;

  // ── Collapse / expand ──
  const [expanded, setExpanded] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [runnerOpen, setRunnerOpen] = useState(false);
  const [inlineTab, setInlineTab] = useState<'code' | 'preview'>('code');
  const [scrollAtBottom, setScrollAtBottom] = useState(false);
  const vertRef = useRef<ScrollView>(null);

  const rawLines = displayedCode.split('\n');
  const lineCount = rawLines.length;
  const isLong = lineCount > COLLAPSE_AT && !isStreaming;
  const displayLines = (!expanded && isLong) ? rawLines.slice(0, COLLAPSE_AT) : rawLines;

  const hasPH = PH_RE.test(code);
  const showRunBtn = info.runnable && !isStreaming;
  const showPreviewInline = info.previewable && !isStreaming;

  const runLabel = ['bash','sh','shell'].includes(langKey) ? 'Terminal'
    : ['python','py'].includes(langKey) ? 'Output' : 'Preview';

  return (
    <>
      <View style={[
        cb.container,
        { backgroundColor: C.bg, borderColor: C.border },
      ]}>
        {/* ── Header ── */}
        <View style={[cb.header, { backgroundColor: C.header, borderBottomColor: C.border }]}>
          <View style={cb.headerLeft}>
            <LangDot langKey={langKey} />
            <Text style={[cb.langLabel, { color: info.dot }]}>{fileName ? `${info.label} · ${fileName}` : info.label}</Text>
            {isStreaming && (
              <View style={cb.streamingBadge}>
                <Text style={cb.streamingText}>streaming</Text>
              </View>
            )}
          </View>
          <View style={cb.actions}>
            {/* Expand SVG via Ionicons */}
            <TouchableOpacity
              style={cb.actionBtn}
              onPress={() => setFullscreen(true)}
              hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <Ionicons name="expand-outline" size={15} color={isDark ? 'rgba(200,200,200,0.6)' : 'rgba(0,0,0,0.45)'} />
            </TouchableOpacity>
            {/* Run/Preview button */}
            {showRunBtn && (
              <TouchableOpacity
                style={[cb.actionBtn, { backgroundColor: 'rgba(48,209,88,0.12)', marginHorizontal: 2 }]}
                onPress={() => setRunnerOpen(true)}
                hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <Ionicons name="play-circle-outline" size={15} color="#30D158" />
              </TouchableOpacity>
            )}
            {/* Copy button */}
            <CopyBtn code={code} />
          </View>
        </View>

        {/* ── Preview/Code tabs (for runnable langs) ── */}
        {showPreviewInline && (
          <View style={[cb.tabBar, { backgroundColor: C.header, borderBottomColor: C.border }]}>
            <TouchableOpacity
              style={[cb.tabBtn, inlineTab === 'code' && cb.tabBtnActive]}
              onPress={() => setInlineTab('code')}
            >
              <Ionicons name="code-slash" size={12} color={inlineTab === 'code' ? (isDark ? '#fff' : '#000') : (isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)')} />
              <Text style={[cb.tabText, inlineTab === 'code' && { color: isDark ? '#fff' : '#000' }]}>Code</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[cb.tabBtn, inlineTab === 'preview' && cb.tabBtnActive]}
              onPress={() => setInlineTab('preview')}
            >
              <Ionicons name="globe-outline" size={12} color={inlineTab === 'preview' ? (isDark ? '#fff' : '#000') : (isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)')} />
              <Text style={[cb.tabText, inlineTab === 'preview' && { color: isDark ? '#fff' : '#000' }]}>{runLabel}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Placeholder warning ── */}
        {hasPH && (
          <View style={cb.phBanner}>
            <Ionicons name="warning-outline" size={11} color={T.special} />
            <Text style={cb.phBannerText}>Replace highlighted placeholders before using</Text>
          </View>
        )}

        {/* ── Code area or Preview ── */}
        {showPreviewInline && inlineTab === 'preview' ? (
          <InlinePreview code={code} langKey={langKey} />
        ) : (
          <View style={[cb.scrollOuter, { backgroundColor: C.bg }]}>
            <ScrollView
              ref={vertRef}
              style={{ flex: 1 }}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
              scrollEventThrottle={16}
              onScroll={(e) => {
                const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
                setScrollAtBottom(contentSize.height - layoutMeasurement.height - contentOffset.y < 40);
              }}
            >
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator
                indicatorStyle="white"
                contentContainerStyle={cb.codeRow}
              >
                {/* Gutter */}
                <View style={[cb.gutter, { borderRightColor: C.border }]}>
                  {displayLines.map((_, i) => (
                    <Text key={i} style={[cb.gutterNum, { color: C.lineNum }]}>{i + 1}</Text>
                  ))}
                </View>
                {/* Lines */}
                <View style={cb.linesArea}>
                  {displayLines.map((line, i) => {
                    const toks = tokenizeLine(line, langKey).map(tok => ({
                      ...tok,
                      // Remap dark-palette colors to light-palette equivalents when in light mode
                      color: isDark ? tok.color : (() => {
                        // Map the dark palette constant to light palette
                        if (tok.color === T.keyword)  return TL.keyword;
                        if (tok.color === T.control)  return TL.control;
                        if (tok.color === T.string || tok.color === T.template) return TL.string;
                        if (tok.color === T.comment)  return TL.comment;
                        if (tok.color === T.number)   return TL.number;
                        if (tok.color === T.type)     return TL.type;
                        if (tok.color === T.func)     return TL.func;
                        if (tok.color === T.operator) return TL.operator;
                        if (tok.color === T.attr || tok.color === T.tagAttr) return TL.attr;
                        if (tok.color === T.tag)      return TL.tag;
                        if (tok.color === T.attrVal)  return TL.attrVal;
                        if (tok.color === T.special)  return TL.special;
                        if (tok.color === T.plain)    return TL.plain;
                        return TL.plain;
                      })(),
                    }));
                    const isCursorLine = isStreaming && i === displayLines.length - 1;
                    return (
                      <View key={i} style={cb.codeLine}>
                        {toks.map((tok, j) => (
                          tok.isPlaceholder ? (
                            <View key={j} style={{ backgroundColor: C.phBg, borderRadius: 3, paddingHorizontal: 2 }}>
                              <Text style={[cb.token, { color: tok.color, fontWeight: '700' }]}>{tok.text}</Text>
                            </View>
                          ) : (
                            <Text key={j} style={[cb.token, { color: tok.color, fontWeight: tok.bold ? '700' : '400' }]}>{tok.text}</Text>
                          )
                        ))}
                        {isCursorLine && <BlinkCursor />}
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            </ScrollView>

            {/* Scroll to bottom indicator */}
            {isLong && expanded && !scrollAtBottom && (
              <View style={cb.scrollIndicator} pointerEvents="box-none">
                <TouchableOpacity
                  onPress={() => vertRef.current?.scrollToEnd({ animated: true })}
                  style={cb.scrollIndicatorBtn}
                  hitSlop={8}
                >
                  <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.75)" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* ── Expand / Collapse footer ── */}
        {isLong && inlineTab === 'code' && (
          <TouchableOpacity
            style={[cb.expandBar, { backgroundColor: C.header, borderTopColor: C.border }]}
            onPress={() => setExpanded(e => !e)}
            activeOpacity={0.75}
          >
            <Text style={[cb.expandText, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }]}>
              {expanded ? 'Show less' : `Expand · ${lineCount - COLLAPSE_AT} more lines`}
            </Text>
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={13}
              color="rgba(255,255,255,0.4)"
            />
          </TouchableOpacity>
        )}

        {/* ── Run strip at bottom ── */}
        {showRunBtn && inlineTab === 'code' && (
          <TouchableOpacity style={cb.runStrip} onPress={() => setRunnerOpen(true)} activeOpacity={0.8}>
            <Ionicons name="play-circle" size={14} color="#30D158" />
            <Text style={cb.runStripText}>{runLabel}</Text>
            <Ionicons name="chevron-forward" size={13} color="rgba(48,209,88,0.5)" style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Modals ── */}
      <FullscreenModal visible={fullscreen} code={code} langKey={langKey} isDark={isDark} onClose={() => setFullscreen(false)} />
      <RunnerModal visible={runnerOpen} code={code} langKey={langKey} isDark={isDark} onClose={() => setRunnerOpen(false)} />
    </>
  );
});

export const StreamingCodeBlock = CodeBlock;

// ── Styles ───────────────────────────────────────────────────────────────────
const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

const st = StyleSheet.create({
  modalRoot: { flex: 1, backgroundColor: T.bg },
  modalHdr: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: T.header, paddingHorizontal: 14, paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border,
  },
  modalClose: { padding: 4 },
  modalTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalLangText: { fontSize: 15, fontWeight: '700' },
  modalTabBar: {
    flexDirection: 'row', backgroundColor: T.header,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border,
    paddingHorizontal: 14, paddingBottom: 10, paddingTop: 8, gap: 8,
  },
  modalTab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  modalTabActive: { backgroundColor: 'rgba(255,255,255,0.1)' },
  modalTabText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.4)' },
  wvLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#0d1117', zIndex: 1,
  },
  wvLoadingText: { color: 'rgba(255,255,255,0.3)', fontSize: 13, marginTop: 10 },
  codeRow: { flexDirection: 'row', paddingVertical: 14, minWidth: '100%', alignItems: 'flex-start' },
  gutterCol: { paddingLeft: 12, paddingRight: 10, alignItems: 'flex-end', borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: T.border, minWidth: 40 },
  gutterNum: { fontSize: 12, lineHeight: 20, color: T.lineNum, fontFamily: MONO, includeFontPadding: false },
  linesCol: { paddingLeft: 14, paddingRight: 28 },
  codeLine: { flexDirection: 'row', flexWrap: 'nowrap', minHeight: 20, alignItems: 'center' },
  codeToken: { fontSize: 13, lineHeight: 20, fontFamily: MONO, includeFontPadding: false },
  actionBtn: { padding: 5, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
});

const cb = StyleSheet.create({
  container: {
    backgroundColor: T.bg,
    borderRadius: 14,
    overflow: 'hidden',
    marginVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 8,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: T.header, paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  langLabel: { fontSize: 13, fontWeight: '700', letterSpacing: 0.1 },
  streamingBadge: {
    backgroundColor: 'rgba(78,201,176,0.15)', borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(78,201,176,0.3)',
  },
  streamingText: { fontSize: 10, color: '#4EC9B0', fontWeight: '700', letterSpacing: 0.5 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  actionBtn: { padding: 5, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  tabBar: {
    flexDirection: 'row', backgroundColor: T.header,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border,
    paddingHorizontal: 12, paddingBottom: 8, gap: 6,
  },
  tabBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  tabBtnActive: { backgroundColor: 'rgba(255,255,255,0.1)' },
  tabText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.4)' },
  phBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 5,
    backgroundColor: 'rgba(255,140,0,0.07)',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,140,0,0.2)',
  },
  phBannerText: { fontSize: 11, color: T.special, fontWeight: '500', flex: 1 },
  scrollOuter: { maxHeight: 340, position: 'relative' },
  codeRow: { flexDirection: 'row', paddingVertical: 12, minWidth: '100%', alignItems: 'flex-start' },
  gutter: {
    paddingLeft: 10, paddingRight: 10,
    borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: T.border,
    alignItems: 'flex-end', minWidth: 36,
  },
  gutterNum: { fontSize: 12, lineHeight: 19, color: T.lineNum, fontFamily: MONO, includeFontPadding: false },
  linesArea: { paddingLeft: 14, paddingRight: 28, flexShrink: 0 },
  codeLine: { flexDirection: 'row', flexWrap: 'nowrap', minHeight: 19, alignItems: 'center' },
  token: { fontSize: 13, lineHeight: 19, fontFamily: MONO, includeFontPadding: false },
  scrollIndicator: {
    position: 'absolute', bottom: 10, left: 0, right: 0, alignItems: 'center',
  },
  scrollIndicatorBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(50,50,50,0.92)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: T.border,
    alignItems: 'center', justifyContent: 'center',
  },
  expandBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, backgroundColor: T.header,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.border,
  },
  expandText: { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
  runStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: 'rgba(48,209,88,0.06)',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(48,209,88,0.18)',
  },
  runStripText: { fontSize: 12, color: '#30D158', fontWeight: '700', flex: 1 },
});
