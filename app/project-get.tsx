/**
 * Dawinix Code — AI coding assistant
 * Redesigned: Kimi-style home, hold-to-talk, message actions, side menu with thumbnails,
 * executing-code card, real generate-code-project edge function call.
 */

import React, {
  useState, useRef, useEffect, useCallback, memo,
} from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList,
  Modal, ScrollView, Platform, Dimensions, Animated,
  Pressable, ActivityIndicator, Keyboard,
  KeyboardAvoidingView, PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useTheme } from '../hooks/useTheme';
import { useAuth, useAlert, getSupabaseClient } from '@/template';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Image as ExpoImage } from 'expo-image';
import { Audio } from 'expo-av';

const { width: SW, height: SH } = Dimensions.get('window');
const ACCENT = '#3B7EF6';

// ─── Syntax Token Colors ──────────────────────────────────────────────────────
const SYNTAX = {
  keyword: '#C792EA', string: '#C3E88D', comment: '#546E7A',
  number: '#F78C6C', tag: '#F07178', attribute: '#FFCB6B',
  function: '#82AAFF', default: '#D4D4D4', operator: '#89DDFF',
};

type SyntaxToken = { text: string; color: string };

function tokenizeLine(line: string, lang: string): SyntaxToken[] {
  const tokens: SyntaxToken[] = [];
  const patterns = [
    { regex: /\/\/.*$/, color: SYNTAX.comment },
    { regex: /#.*$/, color: SYNTAX.comment },
    { regex: /"([^"\\]|\\.)*"|'([^'\\]|\\.)*'|`([^`\\]|\\.)*`/, color: SYNTAX.string },
    { regex: /\b(const|let|var|function|class|import|export|default|return|if|else|for|while|async|await|try|catch|finally|throw)\b/, color: SYNTAX.keyword },
    { regex: /\b(def|import|from|class|return|if|elif|else|for|while|try|except|with|as|lambda|None|True|False|pass)\b/, color: SYNTAX.keyword },
    { regex: /\b\d+(\.\d+)?\b/, color: SYNTAX.number },
    { regex: /[<>{}()\[\]=+\-*\/!&|^~%]/, color: SYNTAX.operator },
  ];
  let remaining = line;
  while (remaining.length > 0) {
    let matched = false;
    for (const { regex, color } of patterns) {
      const m = remaining.match(regex);
      if (m && m.index !== undefined) {
        if (m.index > 0) tokens.push({ text: remaining.slice(0, m.index), color: SYNTAX.default });
        tokens.push({ text: m[0], color });
        remaining = remaining.slice(m.index + m[0].length);
        matched = true;
        break;
      }
    }
    if (!matched) { tokens.push({ text: remaining[0], color: SYNTAX.default }); remaining = remaining.slice(1); }
  }
  return tokens;
}

// ─── Types ────────────────────────────────────────────────────────────────────
type MessageRole = 'user' | 'assistant';

interface MediaAttachment {
  type: 'image' | 'file';
  uri: string;
  name: string;
  size?: number;
  mimeType?: string;
}

interface CodeBlock { type: 'code'; language: string; code: string; streaming?: boolean }
interface TextBlock { type: 'text'; content: string }
interface ExecutingBlock { type: 'executing'; language: string; filename?: string }
type MessageBlock = TextBlock | CodeBlock | ExecutingBlock;

interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  media?: MediaAttachment[];
  edited?: boolean;
  executing?: boolean;
  codeFiles?: Array<{ language: string; code: string; filename: string }>;
}

interface ConversationItem {
  id: string;
  title: string;
  updatedAt: string;
  preview?: string;
  thumbnails?: string[];
}

type ModelKey = 'instant' | 'thinking' | 'agent' | 'swarm';

const MODELS: Record<ModelKey, { label: string; sub: string }> = {
  instant:  { label: 'D2.6 Instant',    sub: 'Quick response' },
  thinking: { label: 'D2.6 Thinking',   sub: 'Deep reasoning' },
  agent:    { label: 'D2.6 Agent',       sub: 'Research & docs' },
  swarm:    { label: 'D2.6 Agent Swarm', sub: 'Large-scale tasks' },
};

const SUGGESTIONS = [
  'Create a chatbot HTML with preview',
  'Build a Python file renaming script',
  'Make a landing page with animations',
];

function parseMessageBlocks(raw: string, streaming = false): MessageBlock[] {
  const blocks: MessageBlock[] = [];
  const fenceRe = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = fenceRe.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      const text = raw.slice(lastIndex, match.index).trim();
      if (text) blocks.push({ type: 'text', content: text });
    }
    blocks.push({ type: 'code', language: (match[1] || 'text').toLowerCase(), code: match[2] || '' });
    lastIndex = match.index + match[0].length;
  }
  const remaining = raw.slice(lastIndex);
  const openFence = remaining.match(/```(\w*)\n?([\s\S]*)/);
  if (streaming && openFence) {
    const textBefore = remaining.slice(0, openFence.index ?? 0).trim();
    if (textBefore) blocks.push({ type: 'text', content: textBefore });
    blocks.push({ type: 'code', language: (openFence[1] || 'text').toLowerCase(), code: openFence[2] || '', streaming: true });
  } else if (remaining.trim()) {
    blocks.push({ type: 'text', content: remaining.trim() });
  }
  return blocks;
}

// ─── Typing Dots ──────────────────────────────────────────────────────────────
function TypingDots() {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  useEffect(() => {
    const anims = dots.map((d, i) => Animated.loop(Animated.sequence([
      Animated.delay(i * 150),
      Animated.timing(d, { toValue: -6, duration: 300, useNativeDriver: true }),
      Animated.timing(d, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.delay(400),
    ])));
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);
  return (
    <View style={{ flexDirection: 'row', gap: 5, paddingVertical: 4 }}>
      {dots.map((d, i) => (
        <Animated.View key={i} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#999', transform: [{ translateY: d }] }} />
      ))}
    </View>
  );
}

// ─── Waveform Animation ───────────────────────────────────────────────────────
function WaveformBars() {
  const bars = Array.from({ length: 30 }, (_, i) => useRef(new Animated.Value(0.3)).current);
  useEffect(() => {
    const anims = bars.map((b, i) => Animated.loop(Animated.sequence([
      Animated.delay(i * 50),
      Animated.timing(b, { toValue: 0.8 + Math.random() * 0.2, duration: 200 + Math.random() * 200, useNativeDriver: true }),
      Animated.timing(b, { toValue: 0.2 + Math.random() * 0.2, duration: 200 + Math.random() * 200, useNativeDriver: true }),
    ])));
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 48, gap: 3 }}>
      {bars.map((b, i) => (
        <Animated.View key={i} style={{
          width: 3, height: 32, borderRadius: 2, backgroundColor: ACCENT,
          transform: [{ scaleY: b }],
        }} />
      ))}
    </View>
  );
}

// ─── Executing Code Card ──────────────────────────────────────────────────────
function ExecutingCard({ language, filename, isDark, onPress }: {
  language: string; filename?: string; isDark: boolean; onPress: () => void;
}) {
  const bgC = isDark ? '#1C1C1E' : '#F5F5F7';
  const borderC = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const textC = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)';
  const dots = [useRef(new Animated.Value(1)).current, useRef(new Animated.Value(1)).current, useRef(new Animated.Value(1)).current];
  useEffect(() => {
    const anims = dots.map((d, i) => Animated.loop(Animated.sequence([
      Animated.delay(i * 200),
      Animated.timing(d, { toValue: 0.3, duration: 300, useNativeDriver: true }),
      Animated.timing(d, { toValue: 1, duration: 300, useNativeDriver: true }),
    ])));
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);

  const langLabel = (language || 'code').charAt(0).toUpperCase() + (language || 'code').slice(1);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75}
      style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: bgC, borderRadius: 14, borderWidth: 1, borderColor: borderC, paddingHorizontal: 16, paddingVertical: 14, marginVertical: 4 }}>
      <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
        <Ionicons name="code-slash-outline" size={16} color={ACCENT} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: textC, fontSize: 14, fontWeight: '500' }}>
          {`Executing ${langLabel} code`}
        </Text>
        {filename ? <Text style={{ color: textC, fontSize: 12, opacity: 0.7 }}>{filename}</Text> : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginRight: 8 }}>
        {dots.map((d, i) => (
          <Animated.View key={i} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: ACCENT, opacity: d }} />
        ))}
      </View>
      <Ionicons name="chevron-forward" size={14} color={textC} />
    </TouchableOpacity>
  );
}

// ─── Inline Code Block ─────────────────────────────────────────────────────────
function InlineCodeBlock({ block, isDark, onOpen }: { block: CodeBlock; isDark: boolean; onOpen: () => void }) {
  const [showPreview, setShowPreview] = useState(false);
  const isHtml = block.language === 'html' || block.language === 'xml';
  const bg = isDark ? '#1A1A1E' : '#F6F6F9';
  const codeBg = isDark ? '#111113' : '#FFFFFF';
  const borderC = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)';
  const labelC = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)';
  const lines = block.code.split('\n');
  return (
    <View style={{ borderRadius: 16, overflow: 'hidden', marginVertical: 6, backgroundColor: bg, borderWidth: 1, borderColor: borderC, elevation: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: borderC }}>
        <Text style={{ color: labelC, fontSize: 13, fontWeight: '700', flex: 1 }}>{(block.language || 'text').toUpperCase()}</Text>
        {block.streaming ? <ActivityIndicator size="small" color={ACCENT} style={{ marginRight: 10 }} /> : null}
        <TouchableOpacity onPress={() => Clipboard.setStringAsync(block.code)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginRight: 10 }}>
          <Ionicons name="copy-outline" size={18} color={labelC} />
        </TouchableOpacity>
        {!block.streaming ? (
          <TouchableOpacity onPress={() => isHtml ? setShowPreview(p => !p) : onOpen()}
            style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={showPreview ? 'code-slash-outline' : 'play'} size={15} color={isDark ? '#FFF' : '#000'} />
          </TouchableOpacity>
        ) : null}
      </View>
      {!showPreview ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ backgroundColor: codeBg, maxHeight: 280 }} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10 }}>
          <View>
            {lines.map((line, li) => (
              <View key={li} style={{ flexDirection: 'row', flexWrap: 'wrap', minHeight: 20 }}>
                {tokenizeLine(line, block.language).map((tok, ti) => (
                  <Text key={ti} style={{ fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }), fontSize: 13, lineHeight: 20, color: tok.color }}>{tok.text}</Text>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      ) : (
        <View style={{ height: 300, backgroundColor: '#FFF' }}>
          <WebView source={{ html: block.code }} style={{ flex: 1 }} javaScriptEnabled domStorageEnabled />
        </View>
      )}
    </View>
  );
}

// ─── Full Code Modal ──────────────────────────────────────────────────────────
function FullCodeModal({ visible, block, onClose, isDark }: { visible: boolean; block: CodeBlock | null; onClose: () => void; isDark: boolean }) {
  const [tab, setTab] = useState<'code' | 'preview'>('code');
  const [showConsole, setShowConsole] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const insets = useSafeAreaInsets();
  useEffect(() => { if (visible) { setTab('code'); setShowConsole(false); setConsoleLogs([]); } }, [visible]);
  if (!block) return null;
  const isHtml = block.language === 'html';
  const bg = isDark ? '#0D0D10' : '#F2F2F7';
  const textC = isDark ? '#FFF' : '#000';
  const subC = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';
  const borderC = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  const codeBg = isDark ? '#111113' : '#FFFFFF';
  const lines = block.code.split('\n');
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: bg }}>
        <View style={{ paddingTop: insets.top + 8, paddingBottom: 10, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: borderC }}>
          <TouchableOpacity onPress={onClose} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={18} color={textC} />
          </TouchableOpacity>
          <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'center' }}>
            <View style={{ flexDirection: 'row', backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)', borderRadius: 22, padding: 3 }}>
              {(['code', 'preview'] as const).map(t => (
                <TouchableOpacity key={t} onPress={() => setTab(t)} style={{ paddingHorizontal: 18, paddingVertical: 7, borderRadius: 18, backgroundColor: tab === t ? (isDark ? 'rgba(255,255,255,0.15)' : '#FFF') : 'transparent' }}>
                  <Text style={{ color: textC, fontSize: 14, fontWeight: tab === t ? '700' : '500', textTransform: 'capitalize' }}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <TouchableOpacity onPress={() => setShowConsole(true)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="terminal-outline" size={18} color={textC} />
          </TouchableOpacity>
        </View>
        {tab === 'code' ? (
          <ScrollView style={{ flex: 1, backgroundColor: codeBg }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16 }}>
              <View>
                {lines.map((line, li) => (
                  <View key={li} style={{ flexDirection: 'row', minHeight: 22, alignItems: 'center' }}>
                    <Text style={{ fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }), fontSize: 13, color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)', width: 32, textAlign: 'right', marginRight: 12, lineHeight: 22 }}>{li + 1}</Text>
                    {tokenizeLine(line, block.language).map((tok, ti) => (
                      <Text key={ti} style={{ fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }), fontSize: 13, lineHeight: 22, color: tok.color }}>{tok.text}</Text>
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
          </ScrollView>
        ) : (
          <View style={{ flex: 1, backgroundColor: '#FFF' }}>
            {isHtml ? (
              <WebView source={{ html: block.code }} style={{ flex: 1 }} javaScriptEnabled domStorageEnabled
                onMessage={e => setConsoleLogs(p => [...p, e.nativeEvent.data])}
                injectedJavaScript={`(function(){var o=console.log;console.log=function(){window.ReactNativeWebView.postMessage([...arguments].join(' '));o.apply(console,arguments);};})();true;`} />
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
                <Ionicons name="code-slash-outline" size={48} color={subC} />
                <Text style={{ color: subC, fontSize: 15, marginTop: 16, textAlign: 'center' }}>Preview available for HTML only.{'\n'}Run in your terminal.</Text>
              </View>
            )}
          </View>
        )}
        <Modal visible={showConsole} transparent animationType="slide" onRequestClose={() => setShowConsole(false)}>
          <Pressable style={{ flex: 1 }} onPress={() => setShowConsole(false)}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)' }]} />
          </Pressable>
          <View style={{ height: SH * 0.5, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7', padding: 20 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(128,128,128,0.35)', alignSelf: 'center', marginBottom: 16 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <TouchableOpacity onPress={() => setShowConsole(false)} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="close" size={16} color={textC} />
              </TouchableOpacity>
              <Text style={{ flex: 1, textAlign: 'center', color: textC, fontSize: 16, fontWeight: '700' }}>Console</Text>
              <TouchableOpacity onPress={() => setConsoleLogs([])} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="trash-outline" size={16} color={textC} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {consoleLogs.length === 0 ? (
                <Text style={{ color: subC, fontSize: 13, textAlign: 'center', marginTop: 24 }}>No output yet</Text>
              ) : consoleLogs.map((l, i) => (
                <Text key={i} style={{ fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }), fontSize: 13, color: subC, lineHeight: 20 }}>{l}</Text>
              ))}
            </ScrollView>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

// ─── Message Actions Blur Modal ───────────────────────────────────────────────
function MessageActionsModal({ visible, onClose, onCopy, onEdit, isDark }: {
  visible: boolean; onClose: () => void; onCopy: () => void; onEdit: () => void; isDark: boolean;
}) {
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'transparent' }} onPress={onClose}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={20} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.2)' }]} />
        )}
      </Pressable>
      <View style={{ position: 'absolute', bottom: SH * 0.35, right: 20 }}>
        <View style={{ borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 12 }}>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={isDark ? 90 : 80} tint={isDark ? 'dark' : 'extraLight'} style={{ borderRadius: 20, overflow: 'hidden' }}>
              <MsgActionsContent onCopy={onCopy} onEdit={onEdit} isDark={isDark} />
            </BlurView>
          ) : (
            <View style={{ backgroundColor: isDark ? '#2C2C2E' : '#FFF', borderRadius: 20 }}>
              <MsgActionsContent onCopy={onCopy} onEdit={onEdit} isDark={isDark} />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

function MsgActionsContent({ onCopy, onEdit, isDark }: { onCopy: () => void; onEdit: () => void; isDark: boolean }) {
  const textC = isDark ? '#FFF' : '#000';
  const borderC = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  return (
    <View style={{ flexDirection: 'row', paddingHorizontal: 4, paddingVertical: 4 }}>
      <TouchableOpacity onPress={onCopy} style={{ alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 }}>
        <Ionicons name="copy-outline" size={24} color={textC} />
        <Text style={{ color: textC, fontSize: 12, marginTop: 4, fontWeight: '500' }}>Copy</Text>
      </TouchableOpacity>
      <View style={{ width: 1, backgroundColor: borderC, marginVertical: 8 }} />
      <TouchableOpacity onPress={onEdit} style={{ alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 }}>
        <Ionicons name="pencil-outline" size={24} color={textC} />
        <Text style={{ color: textC, fontSize: 12, marginTop: 4, fontWeight: '500' }}>Edit</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Message Renderer ─────────────────────────────────────────────────────────
const MessageRenderer = memo(({ msg, isDark, isStreaming, onOpenCode, onLongPress }: {
  msg: Message; isDark: boolean; isStreaming: boolean;
  onOpenCode: (block: CodeBlock) => void; onLongPress: (msg: Message) => void;
}) => {
  const subC = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';
  const textC = isDark ? '#FFF' : '#000';

  if (msg.role === 'user') {
    return (
      <View style={{ alignItems: 'flex-end', marginBottom: 16, paddingHorizontal: 16 }}>
        {msg.media && msg.media.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }} contentContainerStyle={{ flexDirection: 'row', gap: 8 }}>
            {msg.media.map((m, i) => (
              <View key={i} style={{ width: 80, height: 80, borderRadius: 14, overflow: 'hidden' }}>
                {m.type === 'image' ? (
                  <ExpoImage source={{ uri: m.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                ) : (
                  <View style={{ flex: 1, backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    <Ionicons name="document-text" size={24} color={ACCENT} />
                    <Text style={{ fontSize: 9, color: subC }} numberOfLines={1}>{m.name}</Text>
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
        )}
        <Pressable
          onLongPress={() => onLongPress(msg)}
          delayLongPress={400}
          style={{ maxWidth: SW * 0.75 }}>
          <View style={{ backgroundColor: ACCENT, borderRadius: 20, borderBottomRightRadius: 4, paddingHorizontal: 16, paddingVertical: 11 }}>
            <Text style={{ color: '#FFF', fontSize: 16, lineHeight: 23 }}>{msg.content}</Text>
            {msg.edited ? <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 2 }}>Edited</Text> : null}
          </View>
        </Pressable>
      </View>
    );
  }

  // Assistant
  const blocks = parseMessageBlocks(msg.content, isStreaming);

  return (
    <View style={{ marginBottom: 20, paddingHorizontal: 16 }}>
      {/* Executing card if AI is generating code */}
      {msg.executing && (
        <ExecutingCard
          language={msg.codeFiles?.[0]?.language || 'code'}
          filename={msg.codeFiles?.[0]?.filename}
          isDark={isDark}
          onPress={() => {}}
        />
      )}

      {blocks.map((block, bi) => {
        if (block.type === 'text') {
          return block.content.trim() ? (
            <Text key={bi} style={{ color: textC, fontSize: 16, lineHeight: 26, marginBottom: blocks.length > 1 ? 6 : 0 }}>{block.content}</Text>
          ) : null;
        }
        if (block.type === 'code') {
          return (
            <InlineCodeBlock key={bi} block={block} isDark={isDark} onOpen={() => onOpenCode(block)} />
          );
        }
        return null;
      })}

      {isStreaming && blocks.length === 0 && <TypingDots />}

      {!isStreaming && msg.content ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 10 }}>
          <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}>
            <Ionicons name="volume-low-outline" size={19} color={subC} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Clipboard.setStringAsync(msg.content)} hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}>
            <Ionicons name="copy-outline" size={18} color={subC} />
          </TouchableOpacity>
          <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}>
            <Ionicons name="thumbs-up-outline" size={18} color={subC} />
          </TouchableOpacity>
          <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}>
            <Ionicons name="thumbs-down-outline" size={18} color={subC} />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}>
            <Ionicons name="arrow-redo-outline" size={18} color={subC} />
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
});

// ─── Side Menu ────────────────────────────────────────────────────────────────
function SideMenuDrawer({ visible, onClose, user, isDark, conversations, onSelectConv, currentConvId, onNewChat }: {
  visible: boolean; onClose: () => void; user: any; isDark: boolean;
  conversations: ConversationItem[];
  onSelectConv: (id: string) => void;
  currentConvId?: string;
  onNewChat: () => void;
}) {
  const translateX = useRef(new Animated.Value(-SW)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const router = useRouter();

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateX, { toValue: 0, damping: 20, stiffness: 200, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateX, { toValue: -SW, duration: 220, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  const now = Date.now();
  const todayConvs = conversations.filter(c => now - new Date(c.updatedAt).getTime() < 86400000);
  const week7 = conversations.filter(c => { const d = now - new Date(c.updatedAt).getTime(); return d >= 86400000 && d < 7 * 86400000; });
  const older = conversations.filter(c => now - new Date(c.updatedAt).getTime() >= 7 * 86400000);

  const userName = user?.email?.split('@')[0] || 'User';
  const avatarLetter = (userName[0] || 'U').toUpperCase();
  const menuBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const textC = isDark ? '#FFF' : '#000';
  const subC = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)';
  const borderC = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const hoverBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';

  const SectionGroup = ({ title, items }: { title: string; items: ConversationItem[] }) => {
    if (!items.length) return null;
    return (
      <>
        <Text style={{ color: subC, fontSize: 12, fontWeight: '600', paddingHorizontal: 16, marginTop: 16, marginBottom: 6, letterSpacing: 0.3 }}>{title}</Text>
        {items.map(c => (
          <TouchableOpacity key={c.id} onPress={() => { onSelectConv(c.id); onClose(); }}
            style={{ paddingHorizontal: 16, paddingVertical: 10, backgroundColor: c.id === currentConvId ? hoverBg : 'transparent', borderRadius: 12, marginHorizontal: 8 }}>
            <Text style={{ color: textC, fontSize: 14, fontWeight: c.id === currentConvId ? '600' : '400', marginBottom: c.thumbnails?.length ? 6 : 0 }} numberOfLines={1}>{c.title || 'New chat'}</Text>
            {c.thumbnails && c.thumbnails.length > 0 && (
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {c.thumbnails.slice(0, 3).map((uri, i) => (
                  <ExpoImage key={i} source={{ uri }} style={{ width: 40, height: 40, borderRadius: 8 }} contentFit="cover" />
                ))}
              </View>
            )}
          </TouchableOpacity>
        ))}
      </>
    );
  };

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <Animated.View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)', opacity }} />
        <Pressable style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: SW * 0.15 }} onPress={onClose} />
        <Animated.View style={{
          position: 'absolute', top: 0, bottom: 0, left: 0, width: SW * 0.85,
          backgroundColor: menuBg, transform: [{ translateX }],
          shadowColor: '#000', shadowOffset: { width: 4, height: 0 }, shadowOpacity: 0.18, shadowRadius: 20, elevation: 20,
        }}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
            {/* User profile */}
            <View style={{ paddingTop: insets.top + 16, paddingHorizontal: 16, marginBottom: 8 }}>
              <TouchableOpacity onPress={() => { onClose(); router.push('/settings'); }}
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: borderC }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '800' }}>{avatarLetter}</Text>
                </View>
                <Text style={{ color: textC, fontSize: 16, fontWeight: '600', flex: 1 }}>{userName}</Text>
                <Ionicons name="chevron-forward" size={16} color={subC} />
              </TouchableOpacity>
            </View>

            {/* Upgrade Plan */}
            <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
              <TouchableOpacity onPress={() => { onClose(); router.push('/subscription'); }}
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: borderC }}>
                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: ACCENT + '22', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                  <Ionicons name="musical-notes-outline" size={16} color={ACCENT} />
                </View>
                <Text style={{ color: ACCENT, fontSize: 14, fontWeight: '600', flex: 1 }}>Upgrade Plan</Text>
                <Ionicons name="chevron-forward" size={14} color={ACCENT} />
              </TouchableOpacity>
            </View>

            <View style={{ marginHorizontal: 16, height: 1, backgroundColor: borderC, marginVertical: 4 }} />

            {/* Chat History header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: 12, marginBottom: 4 }}>
              <Text style={{ color: textC, fontSize: 16, fontWeight: '700' }}>Chat history</Text>
              <TouchableOpacity onPress={onNewChat} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5 }}>
                <Ionicons name="add" size={14} color={subC} />
                <Text style={{ color: subC, fontSize: 13 }}>New</Text>
              </TouchableOpacity>
            </View>

            <SectionGroup title="Today" items={todayConvs} />
            <SectionGroup title="Last 7 days" items={week7} />
            <SectionGroup title="3 months" items={older} />
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── + Tools Modal ────────────────────────────────────────────────────────────
function ToolsModal({ visible, onClose, isDark, onPickImage, onPickFile }: {
  visible: boolean; onClose: () => void; isDark: boolean;
  onPickImage: () => void; onPickFile: () => void;
}) {
  const insets = useSafeAreaInsets();
  const textC = isDark ? '#FFF' : '#000';
  const subC = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';
  const borderC = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
  const items = [
    { icon: 'image-outline', label: 'Photo', sub: 'Upload an image for AI to read', onPress: () => { onClose(); onPickImage(); } },
    { icon: 'document-text-outline', label: 'File', sub: 'Upload docs, code, CSV...', onPress: () => { onClose(); onPickFile(); } },
    { icon: 'globe-outline', label: 'Web search', sub: 'Search the internet', onPress: onClose },
    { icon: 'code-slash-outline', label: 'Canvas', sub: 'Draw & create visuals', onPress: onClose },
  ];
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1 }} onPress={onClose}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={20} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)' }]} />
        )}
      </Pressable>
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' }}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={isDark ? 92 : 82} tint={isDark ? 'dark' : 'extraLight'} style={{ paddingBottom: insets.bottom + 20, paddingTop: 16, paddingHorizontal: 16 }}>
            <ToolsContent items={items} textC={textC} subC={subC} borderC={borderC} />
          </BlurView>
        ) : (
          <View style={{ backgroundColor: isDark ? '#1C1C1E' : '#FFF', paddingBottom: insets.bottom + 20, paddingTop: 16, paddingHorizontal: 16 }}>
            <ToolsContent items={items} textC={textC} subC={subC} borderC={borderC} />
          </View>
        )}
      </View>
    </Modal>
  );
}

function ToolsContent({ items, textC, subC, borderC }: any) {
  return (
    <>
      <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(128,128,128,0.35)', alignSelf: 'center', marginBottom: 20 }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {items.map((item: any, i: number) => (
          <TouchableOpacity key={i} onPress={item.onPress} activeOpacity={0.75}
            style={{ width: (SW - 56) / 2, backgroundColor: 'rgba(128,128,128,0.1)', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: borderC }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: ACCENT + '18', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
              <Ionicons name={item.icon} size={20} color={ACCENT} />
            </View>
            <Text style={{ color: textC, fontSize: 15, fontWeight: '600', marginBottom: 2 }}>{item.label}</Text>
            <Text style={{ color: subC, fontSize: 12, lineHeight: 16 }}>{item.sub}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );
}

// ─── Recording Overlay ────────────────────────────────────────────────────────
function RecordingOverlay({ visible, onRelease, onCancel, isDark }: {
  visible: boolean; onRelease: () => void; onCancel: () => void; isDark: boolean;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, { toValue: visible ? 1 : 0, duration: 180, useNativeDriver: true }).start();
  }, [visible]);
  if (!visible) return null;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity, zIndex: 999, backgroundColor: isDark ? 'rgba(0,0,0,0.92)' : 'rgba(255,255,255,0.96)', alignItems: 'center', justifyContent: 'center' }]}>
      <WaveformBars />
      <Text style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)', fontSize: 18, marginTop: 24, marginBottom: 40 }}>
        Release to send, swipe up to cancel
      </Text>
      <View style={{ position: 'absolute', bottom: 40, left: 20, right: 20 }}>
        <TouchableOpacity onPress={onRelease} style={{ backgroundColor: ACCENT, borderRadius: 20, paddingVertical: 22, alignItems: 'center' }}>
          <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700' }}>Release to Send</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ProjectGetScreen() {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  const [messages, setMessages] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);

  const [inputText, setInputText] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [voiceMode, setVoiceMode] = useState(true); // true = show voice, false = show keyboard
  const [isRecording, setIsRecording] = useState(false);
  const [recordingInstance, setRecordingInstance] = useState<Audio.Recording | null>(null);

  const [selectedMedia, setSelectedMedia] = useState<MediaAttachment[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [selectedModel, setSelectedModel] = useState<ModelKey>('instant');
  const [sideMenuVisible, setSideMenuVisible] = useState(false);
  const [modelSelectorVisible, setModelSelectorVisible] = useState(false);
  const [toolsVisible, setToolsVisible] = useState(false);
  const [openCodeBlock, setOpenCodeBlock] = useState<CodeBlock | null>(null);

  const [msgActionsVisible, setMsgActionsVisible] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState<Message | null>(null);

  const [conversations, setConversations] = useState<ConversationItem[]>([
    { id: '1', title: 'Casual Friendly Greeting Chat', updatedAt: new Date().toISOString(), thumbnails: [] },
    { id: '2', title: 'Better Email Confirmation', updatedAt: new Date(Date.now() - 86400000 * 3).toISOString(), thumbnails: [] },
    { id: '3', title: 'Mobile Banner No Zoom', updatedAt: new Date(Date.now() - 86400000 * 90).toISOString(), thumbnails: [] },
  ]);
  const [currentConvId, setCurrentConvId] = useState('1');

  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  const bg = isDark ? '#0D0D10' : '#FFFFFF';
  const inputBg = isDark ? '#1C1C1E' : '#F2F2F7';
  const borderC = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const textC = isDark ? '#FFF' : '#000';
  const subC = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';
  const hasMessages = messages.length > 0;
  const showSend = inputText.trim().length > 0 || selectedMedia.length > 0;

  // ── Voice recording ────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') { showAlert('Permission needed', 'Allow microphone access to use voice input.'); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecordingInstance(recording);
      setIsRecording(true);
    } catch { showAlert('Error', 'Could not start recording.'); }
  }, [showAlert]);

  const stopRecordingAndSend = useCallback(async () => {
    if (!recordingInstance) return;
    setIsRecording(false);
    try {
      await recordingInstance.stopAndUnloadAsync();
      const uri = recordingInstance.getURI();
      setRecordingInstance(null);
      if (!uri) return;

      // Transcribe via edge function
      const base64Audio = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const { data, error } = await supabase.functions.invoke('transcribe-audio', {
        body: { audio: base64Audio, mimeType: 'audio/m4a', language: 'en' },
      });
      if (!error && data?.text?.trim()) {
        setInputText(data.text.trim());
        setVoiceMode(false);
        setTimeout(() => inputRef.current?.focus(), 100);
        // Auto-send after transcription
        setTimeout(() => {
          handleSendWithText(data.text.trim());
        }, 300);
      } else {
        showAlert('Transcription failed', 'Could not understand the audio. Please try again.');
      }
    } catch { setRecordingInstance(null); }
  }, [recordingInstance, supabase, showAlert]);

  const cancelRecording = useCallback(async () => {
    setIsRecording(false);
    if (recordingInstance) {
      try { await recordingInstance.stopAndUnloadAsync(); } catch {}
      setRecordingInstance(null);
    }
  }, [recordingInstance]);

  // ── Pick image ─────────────────────────────────────────────────────────────
  const handlePickImage = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { showAlert('Permission needed', 'Allow photo library access.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: true, quality: 0.85 });
      if (!result.canceled) {
        const newMedia = result.assets.map(a => ({
          type: 'image' as const, uri: a.uri, name: a.fileName || `photo_${Date.now()}.jpg`, mimeType: a.mimeType || 'image/jpeg',
        }));
        setSelectedMedia(prev => [...prev, ...newMedia]);
        setVoiceMode(false);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    } catch { showAlert('Error', 'Could not open photo library.'); }
  }, [showAlert]);

  // ── Pick file ──────────────────────────────────────────────────────────────
  const handlePickFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
      if (result.assets) {
        const newMedia = result.assets.map(a => ({
          type: 'file' as const, uri: a.uri, name: a.name, size: a.size, mimeType: a.mimeType || 'application/octet-stream',
        }));
        setSelectedMedia(prev => [...prev, ...newMedia]);
        setVoiceMode(false);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    } catch {}
  }, []);

  // ── Detect if message needs code generation ────────────────────────────────
  const needsCodeGeneration = (text: string): { needs: boolean; language: string } => {
    const t = text.toLowerCase();
    const codeKeywords = ['create', 'build', 'make', 'write', 'generate', 'code', 'script', 'app', 'website', 'html', 'python', 'javascript', 'typescript', 'fix', 'debug', 'refactor', 'implement'];
    const langMap: Record<string, string> = { html: 'html', python: 'python', javascript: 'javascript', typescript: 'typescript', css: 'css', php: 'php', java: 'java', node: 'node' };
    const needs = codeKeywords.some(k => t.includes(k));
    let language = 'html';
    for (const [key, lang] of Object.entries(langMap)) {
      if (t.includes(key)) { language = lang; break; }
    }
    return { needs, language };
  };

  // ── Send ───────────────────────────────────────────────────────────────────
  const handleSendWithText = useCallback(async (textOverride?: string) => {
    const text = (textOverride ?? inputText).trim();
    if (!text && selectedMedia.length === 0) return;
    if (isGenerating) return;

    Keyboard.dismiss();

    const mediaToSend = [...selectedMedia];
    const userMsg: Message = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: text || (mediaToSend[0]?.type === 'image' ? '[Image uploaded]' : '[File uploaded]'),
      timestamp: Date.now(),
      media: mediaToSend.length > 0 ? mediaToSend : undefined,
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setSelectedMedia([]);
    setEditingId(null);
    setVoiceMode(true);
    setIsGenerating(true);

    // Update conversation thumbnails
    const imgThumbs = mediaToSend.filter(m => m.type === 'image').map(m => m.uri);
    if (imgThumbs.length > 0) {
      setConversations(prev => prev.map(c => c.id === currentConvId ? { ...c, thumbnails: [...(c.thumbnails || []), ...imgThumbs].slice(0, 5) } : c));
    }

    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    const aiId = `a_${Date.now()}`;
    const { needs: needsCode, language } = needsCodeGeneration(text);

    // Add placeholder AI message
    const aiMsg: Message = {
      id: aiId, role: 'assistant', content: '', timestamp: Date.now(),
      executing: needsCode, codeFiles: needsCode ? [{ language, code: '', filename: `main.${language}` }] : undefined,
    };
    setMessages(prev => [...prev, aiMsg]);
    setStreamingId(aiId);

    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 150);

    try {
      // Read file content if file attached
      let fileContent = '';
      const fileMedia = mediaToSend.filter(m => m.type === 'file');
      for (const f of fileMedia) {
        try {
          const content = await FileSystem.readAsStringAsync(f.uri, { encoding: FileSystem.EncodingType.UTF8 });
          fileContent += `\n\n--- File: ${f.name} ---\n${content.slice(0, 8000)}\n`;
        } catch {}
      }

      // Image as base64
      let base64Image: string | undefined;
      const imageMedia = mediaToSend.find(m => m.type === 'image');
      if (imageMedia) {
        try {
          base64Image = await FileSystem.readAsStringAsync(imageMedia.uri, { encoding: FileSystem.EncodingType.Base64 });
        } catch {}
      }

      if (needsCode) {
        // ── Call generate-code-project ────────────────────────────────────
        const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-code-project`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            description: text + fileContent,
            language,
            mode: 'real',
            aiMode: selectedModel === 'thinking' ? 'deep_thinking' : selectedModel === 'agent' ? 'agent' : 'instant',
            ...(base64Image ? { images: [base64Image] } : {}),
            userId: user?.id,
          }),
        });

        let fullCode = '';
        let aiResponse = '';

        const reader = response.body?.getReader();
        if (reader) {
          const decoder = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n').filter(l => l.trim());
            for (const line of lines) {
              try {
                const parsed = JSON.parse(line);
                if (parsed.type === 'log') {
                  // Update executing message
                  setMessages(prev => prev.map(m => m.id === aiId ? { ...m, content: `${m.content}` } : m));
                } else if (parsed.type === 'file_created') {
                  const f = parsed.data;
                  fullCode = f.content;
                  const langFence = f.language || language;
                  aiResponse += `Here's your **${f.path}**:\n\n\`\`\`${langFence}\n${f.content}\n\`\`\`\n\n`;
                } else if (parsed.type === 'instruction') {
                  aiResponse += parsed.data + '\n';
                } else if (parsed.type === 'completed') {
                  // Done
                }
              } catch {}
            }
            // Stream the response incrementally
            const snap = aiResponse;
            setMessages(prev => prev.map(m => m.id === aiId ? { ...m, content: snap, executing: false } : m));
          }
        } else {
          // Fallback
          const text2 = await response.text();
          try {
            const lines2 = text2.split('\n').filter(l => l.trim());
            for (const line of lines2) {
              try {
                const parsed = JSON.parse(line);
                if (parsed.type === 'file_created') {
                  const f = parsed.data;
                  aiResponse += `Here's your **${f.path}**:\n\n\`\`\`${f.language || language}\n${f.content}\n\`\`\`\n\n`;
                } else if (parsed.type === 'instruction') {
                  aiResponse += parsed.data + '\n';
                }
              } catch {}
            }
          } catch {}
          if (!aiResponse) aiResponse = text2.slice(0, 2000);
        }

        if (!aiResponse) {
          // fallback with chat edge function
          await callChatFallback(aiId, text, fileContent, base64Image, language);
          return;
        }

        // Final update
        setMessages(prev => prev.map(m => m.id === aiId ? { ...m, content: aiResponse, executing: false } : m));

      } else {
        // ── Regular chat edge function ────────────────────────────────────
        await callChatFallback(aiId, text, fileContent, base64Image, language);
        return;
      }

    } catch (err: any) {
      setMessages(prev => prev.map(m => m.id === aiId ? { ...m, content: 'Something went wrong. Please try again.', executing: false } : m));
    } finally {
      setIsGenerating(false);
      setStreamingId(null);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
    }
  }, [inputText, selectedMedia, isGenerating, selectedModel, user?.id, supabase, currentConvId]);

  const callChatFallback = async (aiId: string, text: string, fileContent: string, base64Image: string | undefined, language: string) => {
    try {
      const systemHint = `You are Dawinix, an expert AI coding assistant. When writing code, always use markdown code fences with the language label. You can write long, complete code — never truncate. If the user pastes code with errors, fix all of them and return the complete fixed code.`;

      const { data, error } = await supabase.functions.invoke('chat', {
        body: {
          message: systemHint + '\n\nUser: ' + text + fileContent,
          model: selectedModel === 'thinking' ? 'gemini-2.0-flash-exp' : 'gemini-2.0-flash',
          conversationId: currentConvId,
          userId: user?.id,
          ...(base64Image ? { image: base64Image } : {}),
        },
      });

      let aiContent = '';
      if (!error && data?.message) {
        aiContent = data.message;
      } else {
        aiContent = generateFallbackResponse(text);
      }

      // Stream character by character
      let displayed = '';
      const chunkSize = 6;
      for (let i = 0; i < aiContent.length; i += chunkSize) {
        displayed += aiContent.slice(i, i + chunkSize);
        const snap = displayed;
        setMessages(prev => prev.map(m => m.id === aiId ? { ...m, content: snap, executing: false } : m));
        await new Promise(r => setTimeout(r, 8));
      }
    } catch {
      setMessages(prev => prev.map(m => m.id === aiId ? { ...m, content: 'Could not get a response. Please try again.', executing: false } : m));
    } finally {
      setIsGenerating(false);
      setStreamingId(null);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
    }
  };

  const generateFallbackResponse = (text: string): string => {
    const t = text.toLowerCase();
    if (t.includes('chatbot') || t.includes('html')) {
      return `Here is a complete HTML chatbot:\n\n\`\`\`html\n<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>Chatbot</title>\n  <style>\n    *{margin:0;padding:0;box-sizing:border-box}\n    body{font-family:sans-serif;background:#f4f4f4;display:flex;justify-content:center;align-items:center;height:100vh}\n    .chat{width:380px;height:580px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.15);display:flex;flex-direction:column}\n    .header{background:#4a90e2;color:#fff;padding:16px;text-align:center;font-size:18px;font-weight:700}\n    .messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px}\n    .msg{max-width:75%;padding:10px 14px;border-radius:18px;font-size:14px}\n    .bot{background:#f0f0f0;align-self:flex-start}\n    .user{background:#4a90e2;color:#fff;align-self:flex-end}\n    .input-area{display:flex;padding:12px;gap:8px;border-top:1px solid #eee}\n    input{flex:1;padding:10px 14px;border:1px solid #ddd;border-radius:24px;font-size:14px;outline:none}\n    button{background:#4a90e2;color:#fff;border:none;border-radius:24px;padding:10px 20px;cursor:pointer}\n  </style>\n</head>\n<body>\n  <div class="chat">\n    <div class="header">Chatbot</div>\n    <div class="messages" id="msgs"><div class="msg bot">Hello! How can I help?</div></div>\n    <div class="input-area">\n      <input id="inp" placeholder="Type a message..." />\n      <button onclick="send()">Send</button>\n    </div>\n  </div>\n  <script>\n    function send(){\n      const inp=document.getElementById('inp');\n      const msgs=document.getElementById('msgs');\n      const text=inp.value.trim();\n      if(!text)return;\n      msgs.innerHTML+=\`<div class="msg user">\${text}</div>\`;\n      inp.value='';\n      setTimeout(()=>{\n        msgs.innerHTML+=\`<div class="msg bot">You said: \${text}</div>\`;\n        msgs.scrollTop=msgs.scrollHeight;\n      },500);\n      msgs.scrollTop=msgs.scrollHeight;\n    }\n    document.getElementById('inp').onkeydown=e=>e.key==='Enter'&&send();\n  </script>\n</body>\n</html>\n\`\`\`\n\nClick ▶ to preview the chatbot live!`;
    }
    return `I can help you with that! Here is a solution:\n\n\`\`\`javascript\n// Solution for: ${text.slice(0, 50)}\nfunction solution(input) {\n  // Process input\n  const result = input.trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');\n  console.log('Result:', result);\n  return result;\n}\n\nsolution('${text.slice(0, 20).replace(/'/g, '')}');\n\`\`\`\n\nFeel free to ask for a different approach or language!`;
  };

  // Long press message handler
  const handleLongPressMsg = useCallback((msg: Message) => {
    setSelectedMsg(msg);
    setMsgActionsVisible(true);
  }, []);

  const handleCopyMsg = useCallback(() => {
    if (selectedMsg) Clipboard.setStringAsync(selectedMsg.content);
    setMsgActionsVisible(false);
  }, [selectedMsg]);

  const handleEditMsg = useCallback(() => {
    if (selectedMsg && selectedMsg.role === 'user') {
      setInputText(selectedMsg.content);
      setEditingId(selectedMsg.id);
      setVoiceMode(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
    setMsgActionsVisible(false);
  }, [selectedMsg]);

  const renderMessage = useCallback(({ item }: { item: Message }) => (
    <MessageRenderer
      msg={item}
      isDark={isDark}
      isStreaming={streamingId === item.id}
      onOpenCode={setOpenCodeBlock}
      onLongPress={handleLongPressMsg}
    />
  ), [isDark, streamingId, handleLongPressMsg]);

  const keyExtractor = useCallback((item: Message) => item.id, []);

  // Voice hold pan responder
  const voiceHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCancelled = useRef(false);

  const handleVoicePressIn = () => {
    if (!voiceMode) return;
    voiceHoldTimer.current = setTimeout(() => {
      startRecording();
    }, 400);
  };

  const handleVoicePressOut = () => {
    if (voiceHoldTimer.current) {
      clearTimeout(voiceHoldTimer.current);
      voiceHoldTimer.current = null;
    }
    if (isRecording) {
      stopRecordingAndSend();
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {/* Recording Overlay */}
      <RecordingOverlay
        visible={isRecording}
        isDark={isDark}
        onRelease={stopRecordingAndSend}
        onCancel={cancelRecording}
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: insets.top + 10, paddingBottom: 12, paddingHorizontal: 16, gap: 10 }}>
          <TouchableOpacity onPress={() => setSideMenuVisible(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="menu-outline" size={26} color={textC} />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setModelSelectorVisible(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 }}>
            <Text style={{ color: textC, fontSize: 17, fontWeight: '700' }}>D</Text>
            <Text style={{ color: subC, fontSize: 15 }}>{MODELS[selectedModel].label.replace('D2.6 ', '')} {'>'}</Text>
          </TouchableOpacity>

          <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}>
            <Ionicons name="volume-mute-outline" size={22} color={subC} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { setMessages([]); setInputText(''); setSelectedMedia([]); setVoiceMode(true); }}
            hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}>
            <Ionicons name="add-circle-outline" size={24} color={subC} />
          </TouchableOpacity>
        </View>

        {/* ── Messages / Home ────────────────────────────────────────────── */}
        {!hasMessages ? (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12 }} showsVerticalScrollIndicator={false} keyboardDismissMode="on-drag">
            {/* Avatar + greeting */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
              <View style={{ marginRight: 4 }}>
                {/* Robot emoji avatar */}
                <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: isDark ? '#1C1C1E' : '#F0F0F0', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: borderC }}>
                  <Text style={{ fontSize: 28 }}>🤖</Text>
                </View>
              </View>
            </View>

            <Text style={{ color: textC, fontSize: 17, lineHeight: 28, marginBottom: 24 }}>
              {'Hey, '}<Text style={{ fontWeight: '700' }}>{user?.email?.split('@')[0] || 'there'}</Text>{'! I can write, execute, and debug code for you. '}
              <Text style={{ color: ACCENT }}>Try creating an app.</Text>
            </Text>

            {SUGGESTIONS.map((s, i) => (
              <TouchableOpacity key={i} onPress={() => { setInputText(s); setVoiceMode(false); setTimeout(() => inputRef.current?.focus(), 100); }}
                activeOpacity={0.75}
                style={{ borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 10, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', backgroundColor: 'transparent' }}>
                <Text style={{ color: textC, fontSize: 15 }}>{s}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={keyExtractor}
            contentContainerStyle={{ paddingVertical: 16 }}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            keyboardDismissMode="on-drag"
            initialNumToRender={10}
            maxToRenderPerBatch={6}
            windowSize={10}
          />
        )}

        {/* ── Input Area ─────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 12, paddingTop: 6, paddingBottom: Math.max(insets.bottom, 12), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: borderC }}>
          {/* Media previews */}
          {selectedMedia.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 8, paddingBottom: 8 }}>
              {selectedMedia.map((m, i) => (
                <View key={i} style={{ position: 'relative' }}>
                  <View style={{ width: 64, height: 64, borderRadius: 12, overflow: 'hidden', backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA' }}>
                    {m.type === 'image' ? (
                      <ExpoImage source={{ uri: m.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                    ) : (
                      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, padding: 4 }}>
                        <Ionicons name="document" size={22} color={ACCENT} />
                        <Text style={{ fontSize: 8, color: subC, textAlign: 'center' }} numberOfLines={2}>{m.name}</Text>
                      </View>
                    )}
                  </View>
                  <TouchableOpacity onPress={() => setSelectedMedia(p => p.filter((_, ii) => ii !== i))}
                    style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: 9, backgroundColor: '#666', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="close" size={10} color="#FFF" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Edit banner */}
          {editingId ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingBottom: 6, gap: 6 }}>
              <Ionicons name="pencil" size={13} color={ACCENT} />
              <Text style={{ color: ACCENT, fontSize: 13, fontWeight: '600', flex: 1 }}>Editing message</Text>
              <TouchableOpacity onPress={() => { setEditingId(null); setInputText(''); }}>
                <Ionicons name="close" size={16} color={subC} />
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Input box */}
          {voiceMode && !inputFocused && !inputText ? (
            /* Voice mode: "Hold to talk" bar */
            <View style={{ backgroundColor: inputBg, borderRadius: 26, paddingHorizontal: 16, paddingVertical: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: borderC, flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity
                onPress={() => { setVoiceMode(false); setTimeout(() => inputRef.current?.focus(), 100); }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Ionicons name="grid-outline" size={16} color={textC} />
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, alignItems: 'center' }}
                onPressIn={handleVoicePressIn}
                onPressOut={handleVoicePressOut}
                activeOpacity={0.7}
              >
                <Text style={{ color: textC, fontSize: 16, fontWeight: '600' }}>Hold to talk</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setToolsVisible(true)}
                style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', marginLeft: 12 }}>
                <Ionicons name="add" size={20} color={textC} />
              </TouchableOpacity>
            </View>
          ) : (
            /* Text mode */
            <View style={{ backgroundColor: inputBg, borderRadius: 26, paddingHorizontal: 14, paddingVertical: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: borderC }}>
              <TextInput
                ref={inputRef}
                style={{ color: textC, fontSize: 16, lineHeight: 22, maxHeight: 140, paddingVertical: 0, flex: 1 }}
                placeholder="Ask away. Pics work too."
                placeholderTextColor={subC}
                value={inputText}
                onChangeText={setInputText}
                multiline
                onFocus={() => setInputFocused(true)}
                onBlur={() => { setInputFocused(false); if (!inputText) setVoiceMode(true); }}
                returnKeyType="default"
                blurOnSubmit={false}
              />
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                {/* Left: voice icon circular */}
                <TouchableOpacity
                  onPress={() => { setVoiceMode(true); setInputText(''); Keyboard.dismiss(); }}
                  style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.25)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="radio-button-on-outline" size={16} color={subC} />
                </TouchableOpacity>

                <View style={{ flex: 1 }} />

                {/* Right buttons */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TouchableOpacity onPress={() => setToolsVisible(true)}
                    style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.25)', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="add" size={20} color={subC} />
                  </TouchableOpacity>

                  {isGenerating ? (
                    <TouchableOpacity
                      style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: isDark ? '#3A3A3C' : '#DCDCDC', alignItems: 'center', justifyContent: 'center' }}>
                      <View style={{ width: 10, height: 10, backgroundColor: textC, borderRadius: 2 }} />
                    </TouchableOpacity>
                  ) : showSend ? (
                    <TouchableOpacity onPress={() => handleSendWithText()}
                      style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: isDark ? '#FFF' : '#000', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="arrow-up" size={18} color={isDark ? '#000' : '#FFF'} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* ── Model Selector Modal ────────────────────────────────────────────── */}
      <Modal visible={modelSelectorVisible} transparent animationType="none" onRequestClose={() => setModelSelectorVisible(false)}>
        <Pressable style={{ flex: 1 }} onPress={() => setModelSelectorVisible(false)}>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={isDark ? 60 : 45} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} />
          )}
        </Pressable>
        <View style={{ position: 'absolute', top: insets.top + 58, left: 16, right: 16, borderRadius: 20, overflow: 'hidden', elevation: 20 }}>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={isDark ? 92 : 82} tint={isDark ? 'dark' : 'extraLight'} style={{ borderRadius: 20 }}>
              {(Object.entries(MODELS) as [ModelKey, (typeof MODELS)[ModelKey]][]).map(([key, m], i) => (
                <TouchableOpacity key={key} onPress={() => { setSelectedModel(key); setModelSelectorVisible(false); }}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: i > 0 ? StyleSheet.hairlineWidth : 0, borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: isDark ? '#FFF' : '#000', fontSize: 16, fontWeight: '600' }}>{m.label}</Text>
                    <Text style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)', fontSize: 13, marginTop: 2 }}>{m.sub}</Text>
                  </View>
                  {selectedModel === key && <Ionicons name="checkmark" size={20} color={ACCENT} />}
                </TouchableOpacity>
              ))}
            </BlurView>
          ) : (
            <View style={{ backgroundColor: isDark ? '#1C1C1E' : '#FFF', borderRadius: 20 }}>
              {(Object.entries(MODELS) as [ModelKey, (typeof MODELS)[ModelKey]][]).map(([key, m], i) => (
                <TouchableOpacity key={key} onPress={() => { setSelectedModel(key); setModelSelectorVisible(false); }}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: i > 0 ? StyleSheet.hairlineWidth : 0, borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: isDark ? '#FFF' : '#000', fontSize: 16, fontWeight: '600' }}>{m.label}</Text>
                    <Text style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)', fontSize: 13, marginTop: 2 }}>{m.sub}</Text>
                  </View>
                  {selectedModel === key && <Ionicons name="checkmark" size={20} color={ACCENT} />}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </Modal>

      {/* ── Side Menu ──────────────────────────────────────────────────────── */}
      <SideMenuDrawer
        visible={sideMenuVisible}
        onClose={() => setSideMenuVisible(false)}
        user={user}
        isDark={isDark}
        conversations={conversations}
        onSelectConv={id => setCurrentConvId(id)}
        currentConvId={currentConvId}
        onNewChat={() => { setMessages([]); setInputText(''); setSelectedMedia([]); setVoiceMode(true); setSideMenuVisible(false); }}
      />

      {/* ── Tools Modal ─────────────────────────────────────────────────────── */}
      <ToolsModal
        visible={toolsVisible}
        onClose={() => setToolsVisible(false)}
        isDark={isDark}
        onPickImage={handlePickImage}
        onPickFile={handlePickFile}
      />

      {/* ── Full Code Modal ──────────────────────────────────────────────────── */}
      <FullCodeModal
        visible={!!openCodeBlock}
        block={openCodeBlock}
        onClose={() => setOpenCodeBlock(null)}
        isDark={isDark}
      />

      {/* ── Message Actions Modal ────────────────────────────────────────────── */}
      <MessageActionsModal
        visible={msgActionsVisible}
        onClose={() => setMsgActionsVisible(false)}
        onCopy={handleCopyMsg}
        onEdit={handleEditMsg}
        isDark={isDark}
      />
    </View>
  );
}

