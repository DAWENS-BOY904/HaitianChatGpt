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
const DARK_T = {
  bg:       '#1e1e1e',
  header:   '#252526',
  border:   '#3c3c3c',
  keyword:  '#569CD6',
  control:  '#C586C0',
  string:   '#CE9178',
  template: '#CE9178',
  comment:  '#6A9955',
  number:   '#B5CEA8',
  type:     '#4EC9B0',
  func:     '#DCDCAA',
  operator: '#D4D4D4',
  attr:     '#9CDCFE',
  tag:      '#4EC9B0',
  tagAttr:  '#9CDCFE',
  attrVal:  '#CE9178',
  special:  '#FF8C00',
  lineNum:  '#858585',
  plain:    '#D4D4D4',
  phBg:     'rgba(255,140,0,0.15)',
  cursor:   '#AEAFAD',
};

// ── Light theme token colors ──────────────────────────
const LIGHT_T = {
  bg:       '#ffffff',
  header:   '#f6f8fa',
  border:   '#d0d7de',
  keyword:  '#0550ae',
  control:  '#8250df',
  string:   '#0a3069',
  template: '#0a3069',
  comment:  '#6e7781',
  number:   '#0550ae',
  type:     '#116329',
  func:     '#8250df',
  operator: '#24292f',
  attr:     '#0550ae',
  tag:      '#116329',
  tagAttr:  '#0550ae',
  attrVal:  '#0a3069',
  special:  '#cf222e',
  lineNum:  '#8c959f',
  plain:    '#24292f',
  phBg:     'rgba(207,34,46,0.08)',
  cursor:   '#586069',
};

function getTheme(isDark: boolean) {
  return isDark ? DARK_T : LIGHT_T;
}

interface LangInfo {
  label: string;
  dot: string;
  icon?: string;
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

type Token = { text: string; color: string; bold?: boolean; isPlaceholder?: boolean };

const PH_RE = /\b(YOUR_API_KEY|YOUR_SECRET_KEY|YOUR_PUBLIC_KEY|API_KEY_HERE|SECRET_KEY_HERE|YOUR_TOKEN|YOUR_ACCESS_TOKEN|INSERT_API_KEY|PUT_YOUR_KEY_HERE|your_api_key|your_secret|ADD_YOUR_KEY)\b/g;

function injectPlaceholders(tokens: Token[], T: typeof DARK_T): Token[] {
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

type TokenRule = { re: RegExp; color: string; group?: number };

function applyRules(line: string, rules: TokenRule[]): Token[] {
  const combined = new RegExp(rules.map((r, i) => `(?<g${i}>${r.re.source})`).join('|'), 'g');
  const tokens: Token[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = combined.exec(line)) !== null) {
    if (m.index > last) tokens.push({ text: line.slice(last, m.index), color: '' });
    for (let i = 0; i < rules.length; i++) {
      const key = `g${i}`;
      if (m.groups && m.groups[key] !== undefined && m.groups[key] !== null && m[0] !== undefined) {
        tokens.push({ text: m.groups[key], color: rules[i].color });
        break;
      }
    }
    last = combined.lastIndex;
  }
  if (last < line.length) tokens.push({ text: line.slice(last), color: '' });
  return tokens;
}

function tokenizeHTML(line: string, T: typeof DARK_T): Token[] {
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

function tokenizeJS(line: string, T: typeof DARK_T): Token[] {
  try {
    const raw = applyRules(line, [
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
    return raw.map(t => ({ ...t, color: t.color || T.plain }));
  } catch { return [{ text: line, color: T.plain }]; }
}

function tokenizeCSS(line: string, T: typeof DARK_T): Token[] {
  try {
    const raw = applyRules(line, [
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
    return raw.map(t => ({ ...t, color: t.color || T.plain }));
  } catch { return [{ text: line, color: T.plain }]; }
}

function tokenizePython(line: string, T: typeof DARK_T): Token[] {
  try {
    const raw = applyRules(line, [
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
    return raw.map(t => ({ ...t, color: t.color || T.plain }));
  } catch { return [{ text: line, color: T.plain }]; }
}

function tokenizeJSON(line: string, T: typeof DARK_T): Token[] {
  try {
    const raw = applyRules(line, [
      { re: /"(?:[^"\\]|\\.)*"\s*:/, color: T.attr },
      { re: /"(?:[^"\\]|\\.)*"/, color: T.string },
      { re: /\b(?:true|false|null)\b/, color: T.keyword },
      { re: /-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/, color: T.number },
      { re: /[{}[\]:,]/, color: T.operator },
    ]);
    return raw.map(t => ({ ...t, color: t.color || T.plain }));
  } catch { return [{ text: line, color: T.plain }]; }
}

function tokenizeBash(line: string, T: typeof DARK_T): Token[] {
  try {
    const raw = applyRules(line, [
      { re: /#[^\n]*/, color: T.comment },
      { re: /"(?:[^"\\]|\\.)*"|'[^']*'/, color: T.string },
      { re: /\$\{?[\w@#*!?-]+\}?/, color: T.attr },
      { re: /\b(?:if|then|else|elif|fi|for|while|do|done|case|esac|in|function|return|exit|local|export|source|readonly|declare|set|unset|shift|eval|exec|trap|wait|until|select)\b/, color: T.keyword },
      { re: /\b(?:echo|cd|ls|mkdir|rm|cp|mv|sudo|cat|grep|sed|awk|curl|wget|chmod|chown|kill|ps|find|which|head|tail|sort|uniq|wc|xargs|tr|cut|touch|date|pwd|env|export|alias|history)\b/, color: T.func },
      { re: /--?[\w-]+/, color: T.attr },
      { re: /\d+/, color: T.number },
      { re: /[|&;<>(){}!]/, color: T.operator },
    ]);
    return raw.map(t => ({ ...t, color: t.color || T.plain }));
  } catch { return [{ text: line, color: T.plain }]; }
}

function tokenizeSQL(line: string, T: typeof DARK_T): Token[] {
  try {
    const raw = applyRules(line, [
      { re: /--[^\n]*/, color: T.comment },
      { re: /'(?:[^'\\]|\\.)*'/, color: T.string },
      { re: /\b(?:SELECT|FROM|WHERE|INSERT|INTO|UPDATE|DELETE|CREATE|DROP|ALTER|TABLE|INDEX|DATABASE|SCHEMA|VIEW|JOIN|LEFT|RIGHT|INNER|OUTER|FULL|CROSS|ON|AS|AND|OR|NOT|IN|IS|NULL|ORDER|BY|GROUP|HAVING|LIMIT|OFFSET|DISTINCT|UNION|ALL|EXISTS|SET|VALUES|PRIMARY|KEY|FOREIGN|REFERENCES|CASCADE|DEFAULT|CONSTRAINT|UNIQUE|CHECK|TRIGGER|PROCEDURE|FUNCTION|BEGIN|COMMIT|ROLLBACK|TRANSACTION)\b/i, color: T.keyword },
      { re: /\b(?:COUNT|SUM|AVG|MAX|MIN|COALESCE|CONCAT|SUBSTRING|TRIM|UPPER|LOWER|CAST|CONVERT|NOW|DATE|DATEADD|DATEDIFF|ISNULL|NULLIF|IIF|CASE|WHEN|THEN|END)\b/i, color: T.func },
      { re: /\b[A-Z][A-Za-z0-9_]*\b/, color: T.type },
      { re: /\b\d+(?:\.\d+)?\b/, color: T.number },
      { re: /[=<>!+\-*/%(),;]/, color: T.operator },
    ]);
    return raw.map(t => ({ ...t, color: t.color || T.plain }));
  } catch { return [{ text: line, color: T.plain }]; }
}

function tokenizeLine(line: string, langKey: string, T: typeof DARK_T): Token[] {
  let raw: Token[];
  switch (langKey) {
    case 'html': case 'htm': case 'xml':   raw = tokenizeHTML(line, T);   break;
    case 'js':   case 'ts':  case 'jsx':
    case 'tsx':  case 'javascript':
    case 'typescript':                     raw = tokenizeJS(line, T);     break;
    case 'css':  case 'scss':              raw = tokenizeCSS(line, T);    break;
    case 'python': case 'py':              raw = tokenizePython(line, T); break;
    case 'json':                           raw = tokenizeJSON(line, T);   break;
    case 'bash': case 'sh': case 'shell':  raw = tokenizeBash(line, T);   break;
    case 'sql':                            raw = tokenizeSQL(line, T);    break;
    default:                               raw = [{ text: line, color: T.plain }]; break;
  }
  return injectPlaceholders(raw, T);
}

// ── Blinking cursor ───────────────────────────────────────────────────────────
const BlinkCursor = memo(function BlinkCursor({ color }: { color: string }) {
  const op = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(Animated.sequence([
      Animated.timing(op, { toValue: 0, duration: 520, useNativeDriver: true }),
      Animated.timing(op, { toValue: 1, duration: 520, useNativeDriver: true }),
    ]));
    anim.start();
    return () => anim.stop();
  }, []);
  return <Animated.View style={{ opacity: op, width: 2, height: 15, backgroundColor: color, marginLeft: 2, borderRadius: 1 }} />;
});

// ── Language badge ──────────────────────────────────────────────────────────
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
const CopyBtn = memo(function CopyBtn({ code, isDark }: { code: string; isDark: boolean }) {
  const [ok, setOk] = useState(false);
  const onPress = useCallback(() => {
    try { Clipboard.setString(code); } catch {}
    setOk(true);
    setTimeout(() => setOk(false), 1800);
  }, [code]);
  return (
    <TouchableOpacity onPress={onPress} style={st.actionBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} activeOpacity={0.7}>
      <Ionicons name={ok ? 'checkmark' : 'copy-outline'} size={15} color={ok ? '#98C379' : (isDark ? 'rgba(200,200,200,0.7)' : 'rgba(80,80,80,0.7)')} />
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

// ── Modals ────────────────────────────────────────────────────────────────────
const RunnerModal = memo(function RunnerModal({
  visible, code, langKey, onClose, isDark,
}: { visible: boolean; code: string; langKey: string; onClose: () => void; isDark: boolean }) {
  const info = getLang(langKey);
  const [tab, setTab] = useState<'preview' | 'code'>('preview');
  const [wvLoaded, setWvLoaded] = useState(false);
  const html = buildHTML(code, langKey);
  const isTerminal = ['bash', 'sh', 'shell'].includes(langKey);
  const isPython = ['python', 'py'].includes(langKey);
  const tabLabel = isTerminal ? 'Terminal' : isPython ? 'Output' : info.previewable ? 'Preview' : 'Run';
  const T = getTheme(isDark);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={[st.modalRoot, { backgroundColor: T.bg }]}>
        <View style={[st.modalHdr, { backgroundColor: T.header, borderBottomColor: T.border }]}>
          <TouchableOpacity onPress={onClose} style={st.modalClose} hitSlop={12}>
            <Ionicons name="chevron-down" size={22} color={isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)'} />
          </TouchableOpacity>
          <View style={st.modalTitle}>
            <LangDot langKey={langKey} />
            <Text style={[st.modalLangText, { color: info.dot }]}>{info.label}</Text>
          </View>
          <CopyBtn code={code} isDark={isDark} />
        </View>
        <View style={[st.modalTabBar, { backgroundColor: T.header, borderBottomColor: T.border }]}>
          <TouchableOpacity style={[st.modalTab, tab === 'preview' && { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }]} onPress={() => setTab('preview')}>
            <Ionicons name={isTerminal ? 'terminal-outline' : isPython ? 'code-working-outline' : 'globe-outline'} size={14} color={tab === 'preview' ? (isDark ? '#fff' : '#000') : T.lineNum} />
            <Text style={[st.modalTabText, { color: tab === 'preview' ? (isDark ? '#fff' : '#000') : T.lineNum }]}>{tabLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[st.modalTab, tab === 'code' && { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }]} onPress={() => setTab('code')}>
            <Ionicons name="code-slash" size={14} color={tab === 'code' ? (isDark ? '#fff' : '#000') : T.lineNum} />
            <Text style={[st.modalTabText, { color: tab === 'code' ? (isDark ? '#fff' : '#000') : T.lineNum }]}>Code</Text>
          </TouchableOpacity>
        </View>
        {tab === 'preview' ? (
          <View style={{ flex: 1 }}>
            {!wvLoaded && (
              <View style={[st.wvLoading, { backgroundColor: T.bg }]}>
                <Ionicons name="globe-outline" size={32} color={T.lineNum} />
                <Text style={[st.wvLoadingText, { color: T.lineNum }]}>Loading...</Text>
              </View>
            )}
            <WebView source={{ html }} style={{ flex: 1 }} javaScriptEnabled domStorageEnabled originWhitelist={['*']} onLoad={() => setWvLoaded(true)} />
          </View>
        ) : (
          <FullCodeView code={code} langKey={langKey} isDark={isDark} />
        )}
      </SafeAreaView>
    </Modal>
  );
});

const FullscreenModal = memo(function FullscreenModal({
  visible, code, langKey, onClose, isDark,
}: { visible: boolean; code: string; langKey: string; onClose: () => void; isDark: boolean }) {
  const info = getLang(langKey);
  const T = getTheme(isDark);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={[st.modalRoot, { backgroundColor: T.bg }]}>
        <View style={[st.modalHdr, { backgroundColor: T.header, borderBottomColor: T.border }]}>
          <TouchableOpacity onPress={onClose} style={st.modalClose} hitSlop={12}>
            <Ionicons name="chevron-down" size={22} color={isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)'} />
          </TouchableOpacity>
          <View style={st.modalTitle}>
            <LangDot langKey={langKey} />
            <Text style={[st.modalLangText, { color: info.dot }]}>{info.label}</Text>
          </View>
          <CopyBtn code={code} isDark={isDark} />
        </View>
        <FullCodeView code={code} langKey={langKey} isDark={isDark} />
      </SafeAreaView>
    </Modal>
  );
});

const FullCodeView = memo(function FullCodeView({ code, langKey, isDark }: { code: string; langKey: string; isDark: boolean }) {
  const lines = code.split('\n');
  const T = getTheme(isDark);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: T.bg }} nestedScrollEnabled showsVerticalScrollIndicator>
      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={[st.codeRow]}>
        <View style={[st.gutterCol, { borderRightColor: T.border }]}>
          {lines.map((_, i) => (
            <Text key={i} style={[st.gutterNum, { color: T.lineNum }]}>{i + 1}</Text>
          ))}
        </View>
        <View style={st.linesCol}>
          {lines.map((line, i) => (
            <View key={i} style={st.codeLine}>
              {tokenizeLine(line, langKey, T).map((tok, j) => (
                tok.isPlaceholder ? (
                  <View key={j} style={{ backgroundColor: T.phBg, borderRadius: 3, paddingHorizontal: 2 }}>
                    <Text style={[st.codeToken, { color: tok.color, fontWeight: '700' }]}>{tok.text}</Text>
                  </View>
                ) : (
                  <Text key={j} style={[st.codeToken, { color: tok.color || T.plain, fontWeight: tok.bold ? '700' : '400' }]}>{tok.text}</Text>
                )
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </ScrollView>
  );
});

const InlinePreview = memo(function InlinePreview({ code, langKey }: { code: string; langKey: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <View style={{ height: 300, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, overflow: 'hidden', backgroundColor: '#fff' }}>
      {!loaded && (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f5f5' }]}>
          <Ionicons name="globe-outline" size={24} color="#ccc" />
          <Text style={{ color: '#bbb', fontSize: 12, marginTop: 6 }}>Loading preview...</Text>
        </View>
      )}
      <WebView source={{ html: buildHTML(code, langKey) }} style={{ flex: 1 }} javaScriptEnabled domStorageEnabled originWhitelist={['*']} onLoad={() => setLoaded(true)} />
    </View>
  );
});

// ── Main CodeBlock component ──────────────────────────────────────────────────
interface CodeBlockProps {
  code: string;
  language?: string;
  fileName?: string;
  streaming?: boolean;
  speed?: number;
  isDark?: boolean;
}

// Show first 25 lines before collapsing
const COLLAPSE_AT = 25;

export const CodeBlock = memo(function CodeBlock({
  code,
  language = 'code',
  fileName,
  streaming = false,
  isDark = true,
}: CodeBlockProps) {
  const T = getTheme(isDark);
  const langKey = (language || 'code').toLowerCase().trim();
  const info = getLang(langKey);

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

  const [expanded, setExpanded] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [runnerOpen, setRunnerOpen] = useState(false);
  const [inlineTab, setInlineTab] = useState<'code' | 'preview'>('code');
  const [scrollAtBottom, setScrollAtBottom] = useState(false);
  const vertRef = useRef<ScrollView>(null);

  const rawLines = displayedCode.split('\n');
  const lineCount = rawLines.length;
  const isLong = lineCount > COLLAPSE_AT && !isStreaming;
  // Show first COLLAPSE_AT lines when not expanded; always show code
  const displayLines = (!expanded && isLong) ? rawLines.slice(0, COLLAPSE_AT) : rawLines;

  const hasPH = PH_RE.test(code);
  const showRunBtn = info.runnable && !isStreaming;
  const showPreviewInline = info.previewable && !isStreaming;
  const runLabel = ['bash','sh','shell'].includes(langKey) ? 'Terminal' : ['python','py'].includes(langKey) ? 'Output' : 'Preview';

  const headerBg = T.header;
  const borderC = T.border;
  const textSecondary = isDark ? 'rgba(200,200,200,0.55)' : 'rgba(60,60,60,0.55)';

  return (
    <>
      <View style={[cb.container, { backgroundColor: T.bg, borderColor: T.border, shadowColor: isDark ? '#000' : '#aaa' }]}>
        {/* Header */}
        <View style={[cb.header, { backgroundColor: headerBg, borderBottomColor: borderC }]}>
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
            <TouchableOpacity style={cb.actionBtn} onPress={() => setFullscreen(true)} hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }} activeOpacity={0.7}>
              <Ionicons name="expand-outline" size={15} color={textSecondary} />
            </TouchableOpacity>
            {showRunBtn && (
              <TouchableOpacity style={[cb.actionBtn, { backgroundColor: 'rgba(48,209,88,0.12)', marginHorizontal: 2 }]} onPress={() => setRunnerOpen(true)} hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }} activeOpacity={0.7}>
                <Ionicons name="play-circle-outline" size={15} color="#30D158" />
              </TouchableOpacity>
            )}
            <CopyBtn code={code} isDark={isDark} />
          </View>
        </View>

        {/* Tabs for previewable languages */}
        {showPreviewInline && (
          <View style={[cb.tabBar, { backgroundColor: headerBg, borderBottomColor: borderC }]}>
            <TouchableOpacity style={[cb.tabBtn, inlineTab === 'code' && { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }]} onPress={() => setInlineTab('code')}>
              <Ionicons name="code-slash" size={12} color={inlineTab === 'code' ? (isDark ? '#fff' : '#000') : T.lineNum} />
              <Text style={[cb.tabText, { color: inlineTab === 'code' ? (isDark ? '#fff' : '#000') : T.lineNum }]}>Code</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[cb.tabBtn, inlineTab === 'preview' && { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }]} onPress={() => setInlineTab('preview')}>
              <Ionicons name="globe-outline" size={12} color={inlineTab === 'preview' ? (isDark ? '#fff' : '#000') : T.lineNum} />
              <Text style={[cb.tabText, { color: inlineTab === 'preview' ? (isDark ? '#fff' : '#000') : T.lineNum }]}>{runLabel}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Placeholder warning */}
        {hasPH && (
          <View style={[cb.phBanner, { backgroundColor: isDark ? 'rgba(255,140,0,0.07)' : 'rgba(255,140,0,0.06)', borderBottomColor: 'rgba(255,140,0,0.2)' }]}>
            <Ionicons name="warning-outline" size={11} color={T.special} />
            <Text style={[cb.phBannerText, { color: T.special }]}>Replace highlighted placeholders before using</Text>
          </View>
        )}

        {/* Code content or inline preview */}
        {showPreviewInline && inlineTab === 'preview' ? (
          <InlinePreview code={code} langKey={langKey} />
        ) : (
          <View style={cb.scrollOuter}>
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
              <ScrollView horizontal showsHorizontalScrollIndicator indicatorStyle={isDark ? 'white' : 'black'} contentContainerStyle={cb.codeRow}>
                {/* Line numbers gutter */}
                <View style={[cb.gutter, { borderRightColor: T.border }]}>
                  {displayLines.map((_, i) => (
                    <Text key={i} style={[cb.gutterNum, { color: T.lineNum }]}>{i + 1}</Text>
                  ))}
                </View>
                {/* Code lines with syntax highlighting */}
                <View style={cb.linesArea}>
                  {displayLines.map((line, i) => {
                    const toks = tokenizeLine(line, langKey, T);
                    const isCursorLine = isStreaming && i === displayLines.length - 1;
                    return (
                      <View key={i} style={cb.codeLine}>
                        {toks.map((tok, j) => (
                          tok.isPlaceholder ? (
                            <View key={j} style={{ backgroundColor: T.phBg, borderRadius: 3, paddingHorizontal: 2 }}>
                              <Text style={[cb.token, { color: tok.color, fontWeight: '700' }]}>{tok.text}</Text>
                            </View>
                          ) : (
                            <Text key={j} style={[cb.token, { color: tok.color || T.plain, fontWeight: tok.bold ? '700' : '400' }]}>{tok.text}</Text>
                          )
                        ))}
                        {isCursorLine && <BlinkCursor color={T.cursor} />}
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            </ScrollView>

            {isLong && expanded && !scrollAtBottom && (
              <View style={cb.scrollIndicator} pointerEvents="box-none">
                <TouchableOpacity onPress={() => vertRef.current?.scrollToEnd({ animated: true })} style={[cb.scrollIndicatorBtn, { backgroundColor: isDark ? 'rgba(50,50,50,0.92)' : 'rgba(220,220,220,0.95)', borderColor: T.border }]} hitSlop={8}>
                  <Ionicons name="chevron-down" size={14} color={isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.6)'} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Expand/Collapse bar */}
        {isLong && inlineTab === 'code' && (
          <TouchableOpacity style={[cb.expandBar, { backgroundColor: headerBg, borderTopColor: borderC }]} onPress={() => setExpanded(e => !e)} activeOpacity={0.75}>
            <Text style={[cb.expandText, { color: textSecondary }]}>{expanded ? 'Show less' : `Expand · ${lineCount - COLLAPSE_AT} more lines`}</Text>
            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={13} color={textSecondary} />
          </TouchableOpacity>
        )}

        {/* Run / Preview strip */}
        {showRunBtn && inlineTab === 'code' && (
          <TouchableOpacity style={[cb.runStrip, { borderTopColor: 'rgba(48,209,88,0.18)', backgroundColor: 'rgba(48,209,88,0.06)' }]} onPress={() => setRunnerOpen(true)} activeOpacity={0.8}>
            <Ionicons name="play-circle" size={14} color="#30D158" />
            <Text style={cb.runStripText}>{runLabel}</Text>
            <Ionicons name="chevron-forward" size={13} color="rgba(48,209,88,0.5)" style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
        )}
      </View>

      <FullscreenModal visible={fullscreen} code={code} langKey={langKey} onClose={() => setFullscreen(false)} isDark={isDark} />
      <RunnerModal visible={runnerOpen} code={code} langKey={langKey} onClose={() => setRunnerOpen(false)} isDark={isDark} />
    </>
  );
});

export const StreamingCodeBlock = CodeBlock;

// ── Styles ───────────────────────────────────────────────────────────────────
const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

const st = StyleSheet.create({
  modalRoot: { flex: 1 },
  modalHdr: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalClose: { padding: 4 },
  modalTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalLangText: { fontSize: 15, fontWeight: '700' },
  modalTabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14, paddingBottom: 10, paddingTop: 8, gap: 8,
  },
  modalTab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  modalTabText: { fontSize: 13, fontWeight: '600' },
  wvLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center', zIndex: 1,
  },
  wvLoadingText: { fontSize: 13, marginTop: 10 },
  codeRow: { flexDirection: 'row', paddingVertical: 14, minWidth: '100%', alignItems: 'flex-start' },
  gutterCol: { paddingLeft: 12, paddingRight: 10, alignItems: 'flex-end', borderRightWidth: StyleSheet.hairlineWidth, minWidth: 40 },
  gutterNum: { fontSize: 12, lineHeight: 20, fontFamily: MONO, includeFontPadding: false },
  linesCol: { paddingLeft: 14, paddingRight: 28 },
  codeLine: { flexDirection: 'row', flexWrap: 'nowrap', minHeight: 20, alignItems: 'center' },
  codeToken: { fontSize: 13, lineHeight: 20, fontFamily: MONO, includeFontPadding: false },
  actionBtn: { padding: 5, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
});

const cb = StyleSheet.create({
  container: {
    borderRadius: 14,
    overflow: 'hidden',
    marginVertical: 3,      // Tight spacing between code blocks and text
    borderWidth: StyleSheet.hairlineWidth,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 5,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12, paddingBottom: 8, gap: 6,
  },
  tabBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  tabText: { fontSize: 12, fontWeight: '600' },
  phBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 5,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  phBannerText: { fontSize: 11, fontWeight: '500', flex: 1 },
  // Always show at least 60px, up to 480px - code is ALWAYS visible
  scrollOuter: { minHeight: 60, maxHeight: 480, position: 'relative' },
  codeRow: { flexDirection: 'row', paddingVertical: 12, minWidth: '100%', alignItems: 'flex-start' },
  gutter: {
    paddingLeft: 10, paddingRight: 10,
    borderRightWidth: StyleSheet.hairlineWidth,
    alignItems: 'flex-end', minWidth: 36,
  },
  gutterNum: { fontSize: 12, lineHeight: 19, fontFamily: MONO, includeFontPadding: false },
  linesArea: { paddingLeft: 14, paddingRight: 28, flexShrink: 0 },
  codeLine: { flexDirection: 'row', flexWrap: 'nowrap', minHeight: 19, alignItems: 'center' },
  token: { fontSize: 13, lineHeight: 19, fontFamily: MONO, includeFontPadding: false },
  scrollIndicator: { position: 'absolute', bottom: 10, left: 0, right: 0, alignItems: 'center' },
  scrollIndicatorBtn: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center', justifyContent: 'center',
  },
  expandBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  expandText: { fontSize: 12, fontWeight: '500' },
  runStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  runStripText: { fontSize: 12, color: '#30D158', fontWeight: '700', flex: 1 },
});
