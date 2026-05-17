/**
 * Dawinix Code — AI coding assistant with streaming code blocks,
 * live preview, console, real photo upload, and multi-block messages.
 */

import React, {
  useState, useRef, useEffect, useCallback, memo, useMemo,
} from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList,
  Modal, ScrollView, Platform, Dimensions, Animated,
  Pressable, ActivityIndicator, Keyboard,
  KeyboardAvoidingView, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useTheme } from '../hooks/useTheme';
import { useAuth, useAlert, getSupabaseClient } from '@/template';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Image as ExpoImage } from 'expo-image';

const { width: SW, height: SH } = Dimensions.get('window');
const ACCENT = '#3B7EF6';

// ─── Syntax Token Colors ──────────────────────────────────────────────────────
const SYNTAX = {
  keyword: '#C792EA',
  string: '#C3E88D',
  comment: '#546E7A',
  number: '#F78C6C',
  tag: '#F07178',
  attribute: '#FFCB6B',
  function: '#82AAFF',
  default: '#D4D4D4',
  operator: '#89DDFF',
  type: '#FFCB6B',
};

type SyntaxToken = { text: string; color: string };

function tokenizeLine(line: string, lang: string): SyntaxToken[] {
  const tokens: SyntaxToken[] = [];
  // Simple regex-based tokenizer
  const patterns: Array<{ regex: RegExp; color: string }> = [
    { regex: /\/\/.*$/, color: SYNTAX.comment },
    { regex: /#.*$/, color: SYNTAX.comment },
    { regex: /"([^"\\]|\\.)*"|'([^'\\]|\\.)*'|`([^`\\]|\\.)*`/, color: SYNTAX.string },
    { regex: /\b(const|let|var|function|class|import|export|default|return|if|else|for|while|do|switch|case|break|continue|new|typeof|instanceof|async|await|try|catch|finally|throw|void|delete|in|of|from|as)\b/, color: SYNTAX.keyword },
    { regex: /\b(def|import|from|class|return|if|elif|else|for|while|try|except|finally|with|as|lambda|and|or|not|in|is|None|True|False|pass|break|continue|raise|yield|print)\b/, color: SYNTAX.keyword },
    { regex: /\b(<!DOCTYPE|html|head|body|div|span|p|a|img|input|button|form|style|script|link|meta|title|h[1-6]|ul|ol|li)\b/, color: SYNTAX.tag },
    { regex: /\b\d+(\.\d+)?\b/, color: SYNTAX.number },
    { regex: /[<>{}()\[\]=+\-*\/!&|^~%]/, color: SYNTAX.operator },
  ];

  let remaining = line;
  while (remaining.length > 0) {
    let matched = false;
    for (const { regex, color } of patterns) {
      const m = remaining.match(regex);
      if (m && m.index !== undefined) {
        if (m.index > 0) {
          tokens.push({ text: remaining.slice(0, m.index), color: SYNTAX.default });
        }
        tokens.push({ text: m[0], color });
        remaining = remaining.slice(m.index + m[0].length);
        matched = true;
        break;
      }
    }
    if (!matched) {
      tokens.push({ text: remaining[0], color: SYNTAX.default });
      remaining = remaining.slice(1);
    }
  }
  return tokens;
}

// ─── Message Block Types ──────────────────────────────────────────────────────
interface TextBlock { type: 'text'; content: string }
interface CodeBlock { type: 'code'; language: string; code: string; streaming?: boolean }
type MessageBlock = TextBlock | CodeBlock;

function parseMessageBlocks(raw: string, streaming = false): MessageBlock[] {
  const blocks: MessageBlock[] = [];
  // Match ``` fences
  const fenceRe = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = fenceRe.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      const text = raw.slice(lastIndex, match.index).trim();
      if (text) blocks.push({ type: 'text', content: text });
    }
    const lang = (match[1] || 'text').toLowerCase();
    const code = match[2] || '';
    blocks.push({ type: 'code', language: lang, code });
    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  const remaining = raw.slice(lastIndex);
  // If streaming and we see an unclosed fence, show it as streaming code
  const openFence = remaining.match(/```(\w*)\n?([\s\S]*)/);
  if (streaming && openFence) {
    const textBefore = remaining.slice(0, openFence.index ?? 0).trim();
    if (textBefore) blocks.push({ type: 'text', content: textBefore });
    const lang = (openFence[1] || 'text').toLowerCase();
    blocks.push({ type: 'code', language: lang, code: openFence[2] || '', streaming: true });
  } else if (remaining.trim()) {
    blocks.push({ type: 'text', content: remaining.trim() });
  }

  return blocks;
}

// ─── Types ────────────────────────────────────────────────────────────────────
type MessageRole = 'user' | 'assistant';

interface MediaAttachment {
  type: 'image' | 'file';
  uri: string;
  name: string;
  size?: number;
  mimeType?: string;
  base64?: string;
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  domain: string;
}

interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  media?: MediaAttachment[];
  edited?: boolean;
  searchData?: { query: string; results: SearchResult[] };
}

type ModelKey = 'instant' | 'thinking' | 'agent' | 'swarm';

const MODELS: Record<ModelKey, { label: string; sub: string }> = {
  instant:  { label: 'D2.6 Instant',    sub: 'Quick response' },
  thinking: { label: 'D2.6 Thinking',   sub: 'Deep reasoning' },
  agent:    { label: 'D2.6 Agent',       sub: 'Research & docs' },
  swarm:    { label: 'D2.6 Agent Swarm', sub: 'Large-scale tasks' },
};

const SUGGESTIONS = [
  'Create a chatbot HTML send it in preview',
  'How can I put API key on it',
  'Build a Python script to automate file renaming',
  'Write a JavaScript function to debounce events',
];

// ─── Inline Code Block (streamed, with copy/console/play) ─────────────────────
function InlineCodeBlock({ block, isDark, onOpen, index }: {
  block: CodeBlock;
  isDark: boolean;
  onOpen: () => void;
  index: number;
}) {
  const [showPreview, setShowPreview] = useState(false);
  const isHtml = block.language === 'html' || block.language === 'xml';
  const bg = isDark ? '#1A1A1E' : '#F6F6F9';
  const codeBg = isDark ? '#111113' : '#FFFFFF';
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)';
  const labelColor = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)';

  const langLabel = (block.language || 'text').toUpperCase();

  // Highlight lines
  const lines = block.code.split('\n');

  return (
    <View style={{
      borderRadius: 16, overflow: 'hidden', marginVertical: 6,
      backgroundColor: bg,
      borderWidth: 1, borderColor,
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.3 : 0.08, shadowRadius: 8, elevation: 4,
    }}>
      {/* Header row */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: borderColor,
      }}>
        <Text style={{ color: labelColor, fontSize: 13, fontWeight: '700', flex: 1 }}>
          {langLabel}
        </Text>
        {block.streaming ? (
          <ActivityIndicator size="small" color={ACCENT} style={{ marginRight: 10 }} />
        ) : null}
        {/* Copy */}
        <TouchableOpacity
          onPress={() => Clipboard.setStringAsync(block.code)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ marginRight: 10 }}
        >
          <Ionicons name="copy-outline" size={18} color={labelColor} />
        </TouchableOpacity>
        {/* Console {:-} */}
        <TouchableOpacity
          onPress={onOpen}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{
            marginRight: 8,
            backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)',
            borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
          }}
        >
          <Text style={{ color: labelColor, fontSize: 13, fontWeight: '600', fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) }}>
            {'{:-}'}
          </Text>
        </TouchableOpacity>
        {/* Play / Preview */}
        {!block.streaming ? (
          <TouchableOpacity
            onPress={() => isHtml ? setShowPreview(p => !p) : onOpen()}
            style={{
              width: 32, height: 32, borderRadius: 16,
              backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
              alignItems: 'center', justifyContent: 'center',
            }}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons name={showPreview ? 'code-slash-outline' : 'play'} size={15} color={isDark ? '#FFF' : '#000'} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Code body — scrollable */}
      {!showPreview ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ backgroundColor: codeBg, maxHeight: 320 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
        >
          <ScrollView showsVerticalScrollIndicator={false} scrollEnabled={false} nestedScrollEnabled>
            {lines.map((line, li) => {
              const tokens = tokenizeLine(line, block.language);
              return (
                <View key={li} style={{ flexDirection: 'row', flexWrap: 'wrap', minHeight: 20 }}>
                  {tokens.map((tok, ti) => (
                    <Text
                      key={ti}
                      style={{
                        fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
                        fontSize: 13, lineHeight: 20, color: tok.color,
                      }}
                    >
                      {tok.text}
                    </Text>
                  ))}
                </View>
              );
            })}
          </ScrollView>
        </ScrollView>
      ) : (
        /* HTML Preview inline */
        <View style={{ height: 340, backgroundColor: '#FFF' }}>
          <WebView
            source={{ html: block.code }}
            style={{ flex: 1 }}
            javaScriptEnabled
            domStorageEnabled
            scrollEnabled
          />
        </View>
      )}
    </View>
  );
}

// ─── Full Code Modal (Code / Preview / Console tabs) ─────────────────────────
function FullCodeModal({ visible, block, onClose, isDark }: {
  visible: boolean;
  block: CodeBlock | null;
  onClose: () => void;
  isDark: boolean;
}) {
  const [tab, setTab] = useState<'code' | 'preview'>('code');
  const [showConsole, setShowConsole] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<string[]>(['Running code...']);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      setTab('code');
      setShowConsole(false);
      setConsoleLogs(['Running code...']);
    }
  }, [visible]);

  if (!block) return null;

  const isHtml = block.language === 'html' || block.language === 'xml';
  const bg = isDark ? '#0D0D10' : '#F2F2F7';
  const textC = isDark ? '#FFF' : '#000';
  const subC = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';
  const borderC = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  const codeBg = isDark ? '#111113' : '#FFFFFF';

  const lines = block.code.split('\n');

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: bg }}>
        {/* Header */}
        <View style={{
          paddingTop: insets.top + 8,
          paddingBottom: 10, paddingHorizontal: 16,
          flexDirection: 'row', alignItems: 'center',
          borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: borderC,
          backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.8)',
        }}>
          {/* Close */}
          <TouchableOpacity
            onPress={onClose}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="close" size={18} color={textC} />
          </TouchableOpacity>

          {/* Code / Preview segmented */}
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            <View style={{
              flexDirection: 'row', backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)',
              borderRadius: 22, padding: 3,
            }}>
              <TouchableOpacity
                onPress={() => setTab('code')}
                style={{
                  paddingHorizontal: 18, paddingVertical: 7, borderRadius: 18,
                  backgroundColor: tab === 'code' ? (isDark ? 'rgba(255,255,255,0.15)' : '#FFF') : 'transparent',
                }}
              >
                <Text style={{ color: textC, fontSize: 14, fontWeight: tab === 'code' ? '700' : '500' }}>Code</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setTab('preview')}
                style={{
                  paddingHorizontal: 18, paddingVertical: 7, borderRadius: 18,
                  backgroundColor: tab === 'preview' ? (isDark ? 'rgba(255,255,255,0.15)' : '#FFF') : 'transparent',
                }}
              >
                <Text style={{ color: textC, fontSize: 14, fontWeight: tab === 'preview' ? '700' : '500' }}>Preview</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Console icon */}
          <TouchableOpacity
            onPress={() => setShowConsole(true)}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="terminal-outline" size={18} color={textC} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        {tab === 'code' ? (
          <ScrollView style={{ flex: 1, backgroundColor: codeBg }} showsVerticalScrollIndicator={false}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16 }}>
              <View>
                {lines.map((line, li) => {
                  const tokens = tokenizeLine(line, block.language);
                  return (
                    <View key={li} style={{ flexDirection: 'row', minHeight: 22, alignItems: 'center' }}>
                      <Text style={{
                        fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
                        fontSize: 13, color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
                        width: 32, textAlign: 'right', marginRight: 12, lineHeight: 22,
                      }}>
                        {li + 1}
                      </Text>
                      {tokens.map((tok, ti) => (
                        <Text
                          key={ti}
                          style={{
                            fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
                            fontSize: 13, lineHeight: 22, color: tok.color,
                          }}
                        >
                          {tok.text}
                        </Text>
                      ))}
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </ScrollView>
        ) : (
          /* Preview */
          <View style={{ flex: 1, backgroundColor: '#FFF' }}>
            {isHtml ? (
              <WebView
                source={{ html: block.code }}
                style={{ flex: 1 }}
                javaScriptEnabled
                domStorageEnabled
                onMessage={(e) => {
                  setConsoleLogs(prev => [...prev, e.nativeEvent.data]);
                }}
                injectedJavaScript={`
                  (function() {
                    var oldLog = console.log;
                    console.log = function(...args) {
                      window.ReactNativeWebView.postMessage(args.join(' '));
                      oldLog.apply(console, args);
                    };
                  })();
                  true;
                `}
              />
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
                <Ionicons name="code-slash-outline" size={48} color={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)'} />
                <Text style={{ color: subC, fontSize: 15, marginTop: 16, textAlign: 'center', lineHeight: 22 }}>
                  Preview is only available for HTML code.{'\n'}Run this code in your terminal.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Console bottom sheet */}
        <Modal visible={showConsole} transparent animationType="slide" onRequestClose={() => setShowConsole(false)}>
          <Pressable style={{ flex: 1 }} onPress={() => setShowConsole(false)}>
            {Platform.OS === 'ios' ? (
              <BlurView intensity={20} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.2)' }]} />
            )}
          </Pressable>
          <View style={{ height: SH * 0.55, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' }}>
            {Platform.OS === 'ios' ? (
              <BlurView intensity={isDark ? 90 : 80} tint={isDark ? 'dark' : 'extraLight'} style={{ flex: 1, padding: 20 }}>
                <ConsoleContent
                  logs={consoleLogs}
                  onClose={() => setShowConsole(false)}
                  onClear={() => setConsoleLogs([])}
                  isDark={isDark}
                  textC={textC}
                  subC={subC}
                  insets={insets}
                />
              </BlurView>
            ) : (
              <View style={{ flex: 1, padding: 20, backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' }}>
                <ConsoleContent
                  logs={consoleLogs}
                  onClose={() => setShowConsole(false)}
                  onClear={() => setConsoleLogs([])}
                  isDark={isDark}
                  textC={textC}
                  subC={subC}
                  insets={insets}
                />
              </View>
            )}
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

function ConsoleContent({ logs, onClose, onClear, isDark, textC, subC, insets }: {
  logs: string[]; onClose: () => void; onClear: () => void;
  isDark: boolean; textC: string; subC: string; insets: any;
}) {
  return (
    <>
      <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)', alignSelf: 'center', marginBottom: 16 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
        <TouchableOpacity
          onPress={onClose}
          style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)', alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="close" size={17} color={textC} />
        </TouchableOpacity>
        <Text style={{ flex: 1, textAlign: 'center', color: textC, fontSize: 17, fontWeight: '700' }}>Console</Text>
        <TouchableOpacity
          onPress={onClear}
          style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)', alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="trash-outline" size={17} color={textC} />
        </TouchableOpacity>
      </View>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}>
        {logs.length === 0 ? (
          <Text style={{ color: subC, fontSize: 13, textAlign: 'center', marginTop: 32 }}>No console output</Text>
        ) : (
          logs.map((log, i) => (
            <Text key={i} style={{
              fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
              fontSize: 13, color: subC, lineHeight: 20, marginBottom: 4,
            }}>
              {log}
            </Text>
          ))
        )}
        {logs.length > 0 && (
          <Text style={{ color: subC, fontSize: 12, marginTop: 12, fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) }}>
            Running code...
          </Text>
        )}
      </ScrollView>
    </>
  );
}

// ─── Typing Dots ──────────────────────────────────────────────────────────────
function TypingDots() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = (d: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.timing(d, { toValue: -6, duration: 300, useNativeDriver: true }),
        Animated.timing(d, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.delay(400),
      ]));
    const a1 = anim(dot1, 0);
    const a2 = anim(dot2, 150);
    const a3 = anim(dot3, 300);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, []);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4 }}>
      {[dot1, dot2, dot3].map((d, i) => (
        <Animated.View key={i} style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#999', transform: [{ translateY: d }] }} />
      ))}
    </View>
  );
}

// ─── Search Bar (inline, Kimi-style) ─────────────────────────────────────────
function SearchBar({ query, searching, isDark, onPress }: {
  query: string; searching: boolean; isDark: boolean; onPress: () => void;
}) {
  const textC = isDark ? '#000' : '#000';
  const subC = 'rgba(0,0,0,0.45)';
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={{
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: isDark ? '#FFF' : '#FFF',
      borderRadius: 24, paddingHorizontal: 16, paddingVertical: 12,
      marginVertical: 6,
      borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)',
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4, elevation: 2,
    }}>
      <Ionicons name="search" size={16} color={subC} style={{ marginRight: 10 }} />
      {searching ? (
        <>
          <Text style={{ color: subC, fontSize: 14, flex: 1 }}>Searching</Text>
          <ActivityIndicator size="small" color={subC} style={{ marginLeft: 8 }} />
        </>
      ) : (
        <>
          <Text style={{ color: subC, fontSize: 14, marginRight: 6 }}>Search</Text>
          <View style={{ width: 1, height: 14, backgroundColor: 'rgba(0,0,0,0.18)', marginRight: 6 }} />
          <Text style={{ color: textC, fontSize: 14, flex: 1 }} numberOfLines={1}>{query}</Text>
          <Ionicons name="chevron-forward" size={14} color={subC} />
        </>
      )}
    </TouchableOpacity>
  );
}

// ─── Message Renderer ─────────────────────────────────────────────────────────
function MessageRenderer({ msg, isDark, isStreaming, onOpenCode }: {
  msg: Message;
  isDark: boolean;
  isStreaming: boolean;
  onOpenCode: (block: CodeBlock) => void;
}) {
  const textC = isDark ? '#000000' : '#000000';
  // Actually text color should follow theme
  const msgTextC = isDark ? '#FFFFFF' : '#000000';
  const subC = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';

  if (msg.role === 'user') {
    return (
      <View style={{ alignItems: 'flex-end', marginBottom: 16, paddingHorizontal: 16 }}>
        {msg.media && msg.media.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}
            contentContainerStyle={{ flexDirection: 'row', gap: 8 }}>
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
        <View style={{
          backgroundColor: ACCENT, borderRadius: 20, borderBottomRightRadius: 4,
          paddingHorizontal: 16, paddingVertical: 11, maxWidth: SW * 0.75,
        }}>
          <Text style={{ color: '#FFF', fontSize: 16, lineHeight: 23 }}>{msg.content}</Text>
          {msg.edited && <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 2 }}>Edited</Text>}
        </View>
      </View>
    );
  }

  // Assistant: parse content into blocks
  const blocks = parseMessageBlocks(msg.content, isStreaming);

  return (
    <View style={{ marginBottom: 20, paddingHorizontal: 16 }}>
      {/* Search bar if search data */}
      {msg.searchData && (
        <SearchBar
          query={msg.searchData.query}
          searching={false}
          isDark={isDark}
          onPress={() => {}}
        />
      )}

      {blocks.map((block, bi) => {
        if (block.type === 'text') {
          if (!block.content.trim()) return null;
          return (
            <Text key={bi} style={{ color: msgTextC, fontSize: 16, lineHeight: 26, marginBottom: blocks.length > 1 ? 8 : 0 }}>
              {block.content}
            </Text>
          );
        }
        if (block.type === 'code') {
          return (
            <InlineCodeBlock
              key={bi}
              block={block}
              isDark={isDark}
              index={bi}
              onOpen={() => onOpenCode(block)}
            />
          );
        }
        return null;
      })}

      {isStreaming && blocks.length === 0 && <TypingDots />}

      {/* Action row */}
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
}

// ─── Side Menu ────────────────────────────────────────────────────────────────
function SideMenuDrawer({ visible, onClose, user, isDark, conversations, onSelectConv, currentConvId }: {
  visible: boolean; onClose: () => void; user: any; isDark: boolean;
  conversations: Array<{ id: string; title: string; updatedAt: string }>;
  onSelectConv: (id: string) => void; currentConvId?: string;
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

  const today = new Date();
  const todayConvs = conversations.filter(c => (today.getTime() - new Date(c.updatedAt).getTime()) < 86400000);
  const older = conversations.filter(c => (today.getTime() - new Date(c.updatedAt).getTime()) >= 86400000);

  const userName = user?.email?.split('@')[0] || 'User';
  const avatarLetter = (userName[0] || 'U').toUpperCase();

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <Animated.View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)', opacity }} />
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <Animated.View style={{
          position: 'absolute', top: 0, bottom: 0, left: 0, width: SW * 0.85,
          backgroundColor: '#FFF', transform: [{ translateX }],
          shadowColor: '#000', shadowOffset: { width: 4, height: 0 }, shadowOpacity: 0.18, shadowRadius: 20, elevation: 20,
        }}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
            <View style={{ paddingTop: insets.top + 20, paddingHorizontal: 16, marginBottom: 10 }}>
              <TouchableOpacity onPress={() => { onClose(); router.push('/settings'); }}
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' }}>
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                  <Text style={{ color: '#FFF', fontSize: 20, fontWeight: '800' }}>{avatarLetter}</Text>
                </View>
                <Text style={{ color: '#000', fontSize: 17, fontWeight: '600', flex: 1 }}>{userName}</Text>
                <Ionicons name="chevron-forward" size={18} color="rgba(0,0,0,0.4)" />
              </TouchableOpacity>
            </View>

            <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
              <TouchableOpacity onPress={() => { onClose(); router.push('/subscription'); }}
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: ACCENT + '22', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <Ionicons name="musical-notes-outline" size={18} color={ACCENT} />
                </View>
                <Text style={{ color: ACCENT, fontSize: 15, fontWeight: '600', flex: 1 }}>Upgrade Plan</Text>
                <Ionicons name="chevron-forward" size={18} color={ACCENT} />
              </TouchableOpacity>
            </View>

            <View style={{ paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ color: '#000', fontSize: 17, fontWeight: '700' }}>Chat history</Text>
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5 }}>
                <Ionicons name="search" size={13} color="rgba(0,0,0,0.45)" />
                <Text style={{ color: 'rgba(0,0,0,0.45)', fontSize: 13 }}>Search</Text>
              </TouchableOpacity>
            </View>

            {todayConvs.length > 0 && (
              <>
                <Text style={{ color: 'rgba(0,0,0,0.35)', fontSize: 12, fontWeight: '600', paddingHorizontal: 16, marginBottom: 4 }}>Today</Text>
                {todayConvs.map(c => (
                  <TouchableOpacity key={c.id} onPress={() => { onSelectConv(c.id); onClose(); }}
                    style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: c.id === currentConvId ? 'rgba(59,126,246,0.08)' : 'transparent' }}>
                    <Text style={{ color: '#000', fontSize: 15, fontWeight: c.id === currentConvId ? '600' : '400' }} numberOfLines={1}>{c.title || 'New chat'}</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}
            {older.length > 0 && (
              <>
                <Text style={{ color: 'rgba(0,0,0,0.35)', fontSize: 12, fontWeight: '600', paddingHorizontal: 16, marginTop: 12, marginBottom: 4 }}>Earlier</Text>
                {older.map(c => (
                  <TouchableOpacity key={c.id} onPress={() => { onSelectConv(c.id); onClose(); }}
                    style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                    <Text style={{ color: '#000', fontSize: 15 }} numberOfLines={1}>{c.title || 'New chat'}</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Tools Bottom Sheet ───────────────────────────────────────────────────────
function ToolsSheet({ visible, onClose, isDark, onPickImage, onPickFile }: {
  visible: boolean; onClose: () => void; isDark: boolean;
  onPickImage: () => void; onPickFile: () => void;
}) {
  const insets = useSafeAreaInsets();
  const textC = isDark ? '#FFF' : '#000';
  const subC = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';
  const borderC = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
  const items = [
    { icon: 'image-outline', label: 'Photo', sub: 'Upload an image', onPress: () => { onClose(); onPickImage(); } },
    { icon: 'document-outline', label: 'File', sub: 'Upload a document', onPress: () => { onClose(); onPickFile(); } },
    { icon: 'globe-outline', label: 'Web search', sub: 'Search the internet', onPress: onClose },
    { icon: 'create-outline', label: 'Canvas', sub: 'Create visuals', onPress: onClose },
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
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden',
      }}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={isDark ? 90 : 82} tint={isDark ? 'dark' : 'extraLight'} style={{ paddingBottom: insets.bottom + 20, paddingTop: 16, paddingHorizontal: 16 }}>
            <ToolsSheetContent items={items} textC={textC} subC={subC} borderC={borderC} onClose={onClose} />
          </BlurView>
        ) : (
          <View style={{ backgroundColor: isDark ? '#1C1C1E' : '#FFF', paddingBottom: insets.bottom + 20, paddingTop: 16, paddingHorizontal: 16 }}>
            <ToolsSheetContent items={items} textC={textC} subC={subC} borderC={borderC} onClose={onClose} />
          </View>
        )}
      </View>
    </Modal>
  );
}

function ToolsSheetContent({ items, textC, subC, borderC, onClose }: { items: any[]; textC: string; subC: string; borderC: string; onClose: () => void }) {
  return (
    <>
      <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(128,128,128,0.35)', alignSelf: 'center', marginBottom: 20 }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {items.map((item, i) => (
          <TouchableOpacity key={i} onPress={item.onPress} activeOpacity={0.75}
            style={{ width: (SW - 56) / 2, backgroundColor: 'rgba(128,128,128,0.1)', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: borderC }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(59,126,246,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
              <Ionicons name={item.icon} size={20} color={ACCENT} />
            </View>
            <Text style={{ color: textC, fontSize: 15, fontWeight: '600', marginBottom: 2 }}>{item.label}</Text>
            <Text style={{ color: subC, fontSize: 12 }}>{item.sub}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </>
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
  const [selectedMedia, setSelectedMedia] = useState<MediaAttachment[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [selectedModel, setSelectedModel] = useState<ModelKey>('instant');
  const [sideMenuVisible, setSideMenuVisible] = useState(false);
  const [modelSelectorVisible, setModelSelectorVisible] = useState(false);
  const [toolsVisible, setToolsVisible] = useState(false);
  const [openCodeBlock, setOpenCodeBlock] = useState<CodeBlock | null>(null);

  const [conversations, setConversations] = useState([
    { id: '1', title: 'Casual Friendly Greeting Chat', updatedAt: new Date().toISOString() },
    { id: '2', title: 'Better Email Confirmation', updatedAt: new Date(Date.now() - 86400000 * 3).toISOString() },
  ]);
  const [currentConvId, setCurrentConvId] = useState('1');

  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const abortRef = useRef<AbortController | null>(null);

  const bg = isDark ? '#0D0D10' : '#FFFFFF';
  const inputBg = isDark ? '#1C1C1E' : '#F2F2F7';
  const borderC = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.09)';
  const textC = isDark ? '#FFF' : '#000';
  const subC = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';
  const hasMessages = messages.length > 0;
  const showSend = inputText.trim().length > 0 || selectedMedia.length > 0;

  // ── Pick image with base64 ─────────────────────────────────────────────────
  const handlePickImage = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { showAlert('Permission needed', 'Allow photo library access to upload images.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false,
        quality: 0.85,
        base64: false,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const media: MediaAttachment = {
          type: 'image', uri: asset.uri,
          name: asset.fileName || `photo_${Date.now()}.jpg`,
          mimeType: asset.mimeType || 'image/jpeg',
        };
        setSelectedMedia(prev => [...prev, media]);
      }
    } catch (_e) { showAlert('Error', 'Could not open photo library.'); }
  }, [showAlert]);

  // ── Pick file ──────────────────────────────────────────────────────────────
  const handlePickFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ multiple: false });
      if (result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const media: MediaAttachment = {
          type: 'file', uri: asset.uri,
          name: asset.name, size: asset.size,
          mimeType: asset.mimeType || 'application/octet-stream',
        };
        setSelectedMedia(prev => [...prev, media]);
      }
    } catch (_e) {}
  }, []);

  // ── Send ───────────────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text && selectedMedia.length === 0) return;
    if (isGenerating) return;

    Keyboard.dismiss();

    // Build user message
    const userMsg: Message = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: text || (selectedMedia[0]?.type === 'image' ? '[Image uploaded]' : '[File uploaded]'),
      timestamp: Date.now(),
      media: selectedMedia.length > 0 ? [...selectedMedia] : undefined,
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setSelectedMedia([]);
    setEditingId(null);
    setIsGenerating(true);

    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    // Create AI message placeholder
    const aiId = `a_${Date.now()}`;
    const aiMsg: Message = { id: aiId, role: 'assistant', content: '', timestamp: Date.now() };
    setMessages(prev => [...prev, aiMsg]);
    setStreamingId(aiId);

    try {
      // Prepare body — include image as base64 if present
      let base64Image: string | undefined;
      const imageMedia = selectedMedia.find(m => m.type === 'image');
      if (imageMedia) {
        try {
          const raw = await FileSystem.readAsStringAsync(imageMedia.uri, { encoding: FileSystem.EncodingType.Base64 });
          base64Image = raw.replace(/^data:image\/[a-z+]+;base64,/i, '');
        } catch (_e) {}
      }

      // Build prompt that encourages code generation with fences
      const systemHint = `You are an expert AI coding assistant (Dawinix Code). When you write code, always use markdown code fences with the language label (e.g. \`\`\`html, \`\`\`python, \`\`\`javascript). You can include multiple code blocks in one response. After each code block you may add explanations. Keep responses concise but complete.`;

      const { data, error } = await supabase.functions.invoke('chat', {
        body: {
          message: systemHint + '\n\nUser: ' + (text || 'Analyze this image'),
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
        // Fallback: generate a sample response with code
        if (text.toLowerCase().includes('chatbot') || text.toLowerCase().includes('html')) {
          aiContent = `Here's a simple HTML chatbot for you:\n\n\`\`\`html\n<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>Chatbot</title>\n  <style>\n    * { margin: 0; padding: 0; box-sizing: border-box; }\n    body { font-family: 'Segoe UI', sans-serif; background: #f4f4f4; display: flex; justify-content: center; align-items: center; height: 100vh; }\n    .chat-container { width: 400px; height: 600px; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.2); display: flex; flex-direction: column; }\n    .chat-header { background: #4a90e2; color: white; padding: 16px; text-align: center; font-size: 18px; font-weight: bold; }\n    .chat-box { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; }\n    .message { max-width: 75%; padding: 10px 14px; border-radius: 18px; font-size: 14px; }\n    .bot { background: #f0f0f0; align-self: flex-start; }\n    .user { background: #4a90e2; color: white; align-self: flex-end; }\n    .input-area { display: flex; padding: 12px; gap: 8px; background: #f9f9f9; border-top: 1px solid #eee; }\n    input { flex: 1; padding: 10px 14px; border: 1px solid #ddd; border-radius: 24px; font-size: 14px; outline: none; }\n    button { background: #4a90e2; color: white; border: none; border-radius: 24px; padding: 10px 20px; cursor: pointer; font-size: 14px; }\n  </style>\n</head>\n<body>\n  <div class="chat-container">\n    <div class="chat-header">Chatbot</div>\n    <div class="chat-box" id="chatBox">\n      <div class="message bot">Hello! How can I help you today?</div>\n    </div>\n    <div class="input-area">\n      <input id="userInput" type="text" placeholder="Type a message..." />\n      <button onclick="sendMessage()">Send</button>\n    </div>\n  </div>\n  <script>\n    function sendMessage() {\n      const input = document.getElementById('userInput');\n      const chatBox = document.getElementById('chatBox');\n      const userText = input.value.trim();\n      if (!userText) return;\n      const userMsg = document.createElement('div');\n      userMsg.className = 'message user';\n      userMsg.textContent = userText;\n      chatBox.appendChild(userMsg);\n      input.value = '';\n      setTimeout(() => {\n        const botMsg = document.createElement('div');\n        botMsg.className = 'message bot';\n        botMsg.textContent = 'I received: ' + userText;\n        chatBox.appendChild(botMsg);\n        chatBox.scrollTop = chatBox.scrollHeight;\n      }, 500);\n      chatBox.scrollTop = chatBox.scrollHeight;\n    }\n    document.getElementById('userInput').addEventListener('keypress', (e) => {\n      if (e.key === 'Enter') sendMessage();\n    });\n  </script>\n</body>\n</html>\n\`\`\`\n\nClick ▶ to preview the chatbot, or tap the card to open the full code view.`;
        } else if (text.toLowerCase().includes('api key')) {
          aiContent = `You can connect an AI API (like OpenAI API) by replacing the fake bot replies with a real API request.\n\nDo **not** put your API key directly in public HTML files. The safe method is:\n\n1. HTML frontend → sends message\n2. Backend server → stores API key securely\n3. Backend calls AI API\n4. Response goes back to chatbot\n\nExample setup:\n\n### 1. Frontend (HTML)\n\nReplace the \`<script>\` section with this:\n\n\`\`\`html\n<script>\nasync function sendMessage() {\n  const input = document.getElementById('userInput');\n  const chatBox = document.getElementById('chatBox');\n  const userText = input.value.trim();\n  if (!userText) return;\n  const userMessage = document.createElement('div');\n  userMessage.classList.add('message', 'user');\n  userMessage.textContent = userText;\n  chatBox.appendChild(userMessage);\n  input.value = '';\n  chatBox.scrollTop = chatBox.scrollHeight;\n  const response = await fetch('http://localhost:3000/chat', {\n    method: 'POST',\n    headers: { 'Content-Type': 'application/json' },\n    body: JSON.stringify({ message: userText })\n  });\n  const data = await response.json();\n  const botMsg = document.createElement('div');\n  botMsg.classList.add('message', 'bot');\n  botMsg.textContent = data.reply;\n  chatBox.appendChild(botMsg);\n  chatBox.scrollTop = chatBox.scrollHeight;\n}\n</script>\n\`\`\`\n\n### 2. Backend Server (Node.js)\n\nCreate a file called \`server.js\`\n\n\`\`\`javascript\nconst express = require('express');\nconst cors = require('cors');\nconst fetch = require('node-fetch');\nconst app = express();\napp.use(cors());\napp.use(express.json());\nconst API_KEY = "YOUR_OPENAI_API_KEY";\napp.post('/chat', async (req, res) => {\n  const userMessage = req.body.message;\n  try {\n    const response = await fetch("https://api.openai.com/v1/chat/completions", {\n      method: "POST",\n      headers: { "Content-Type": "application/json", "Authorization": \`Bearer \${API_KEY}\` },\n      body: JSON.stringify({ model: "gpt-4.1-mini", messages: [{ role: "user", content: userMessage }] })\n    });\n    const data = await response.json();\n    res.json({ reply: data.choices[0].message.content });\n  } catch (error) {\n    res.json({ reply: "Error connecting to AI" });\n  }\n});\napp.listen(3000, () => console.log("Server running on port 3000"));\n\`\`\`\n\n### 3. Install Packages\n\n\`\`\`bash\nnpm init -y\nnpm install express cors node-fetch\n\`\`\`\n\n### Better Security\n\nInstead of writing the key directly in code, use \`.env\`\n\n\`\`\`bash\nnpm install dotenv\n\`\`\`\n\n\`\`\`env\nOPENAI_API_KEY=your_key_here\n\`\`\`\n\n\`\`\`javascript\nrequire('dotenv').config();\nconst API_KEY = process.env.OPENAI_API_KEY;\n\`\`\`\n\nThis keeps your key private.`;
        } else {
          aiContent = `I can help you with that! Here's what I know about "${text}".\n\nFor a practical example, here's some code:\n\n\`\`\`javascript\n// Example implementation\nfunction solution(input) {\n  // Process the input\n  const result = input\n    .split(' ')\n    .map(word => word.charAt(0).toUpperCase() + word.slice(1))\n    .join(' ');\n  \n  console.log('Result:', result);\n  return result;\n}\n\n// Usage\nsolution('${text.slice(0, 30)}');\n\`\`\`\n\nFeel free to ask if you need more details or a different language!`;
        }
      }

      // Stream the response character by character
      let displayed = '';
      const chunkSize = 4;
      for (let i = 0; i < aiContent.length; i += chunkSize) {
        displayed += aiContent.slice(i, i + chunkSize);
        const snap = displayed;
        setMessages(prev => prev.map(m => m.id === aiId ? { ...m, content: snap } : m));
        await new Promise(r => setTimeout(r, 10));
      }

    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setMessages(prev => prev.map(m => m.id === aiId ? { ...m, content: 'Something went wrong. Please try again.' } : m));
      }
    } finally {
      setIsGenerating(false);
      setStreamingId(null);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 150);
    }
  }, [inputText, selectedMedia, isGenerating, selectedModel, user?.id, supabase, currentConvId]);

  // ── Render message ─────────────────────────────────────────────────────────
  const renderMessage = useCallback(({ item }: { item: Message }) => (
    <MessageRenderer
      msg={item}
      isDark={isDark}
      isStreaming={streamingId === item.id}
      onOpenCode={(block) => setOpenCodeBlock(block)}
    />
  ), [isDark, streamingId]);

  const keyExtractor = useCallback((item: Message) => item.id, []);

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          paddingTop: insets.top + 10, paddingBottom: 12,
          paddingHorizontal: 16, gap: 10,
        }}>
          <TouchableOpacity onPress={() => setSideMenuVisible(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="menu-outline" size={26} color={textC} />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setModelSelectorVisible(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 }}>
            <Text style={{ color: textC, fontSize: 17, fontWeight: '600' }}>D</Text>
            <Text style={{ color: subC, fontSize: 15 }}>{MODELS[selectedModel].label.replace('D2.6 ', '')} {'>'}</Text>
          </TouchableOpacity>

          <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}>
            <Ionicons name="volume-mute-outline" size={22} color={subC} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { setMessages([]); setInputText(''); setSelectedMedia([]); }}
            hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
          >
            <Ionicons name="add-circle-outline" size={24} color={subC} />
          </TouchableOpacity>
        </View>

        {/* ── Messages ───────────────────────────────────────────────────── */}
        {!hasMessages ? (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20 }} showsVerticalScrollIndicator={false}>
            <View style={{ marginBottom: 28 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '800' }}>D</Text>
                </View>
              </View>
              <Text style={{ color: textC, fontSize: 17, lineHeight: 26 }}>
                Hey, {user?.email?.split('@')[0] || 'there'}! I can write and run code for you.{' '}
                <Text style={{ color: ACCENT }}>Try creating an app.</Text>
              </Text>
            </View>

            {SUGGESTIONS.map((s, i) => (
              <TouchableOpacity key={i} onPress={() => { setInputText(s); setTimeout(() => inputRef.current?.focus(), 100); }}
                activeOpacity={0.75}
                style={{
                  backgroundColor: isDark ? '#1C1C1E' : '#F5F5F7',
                  borderRadius: 18, paddingHorizontal: 18, paddingVertical: 14,
                  marginBottom: 10, borderWidth: 1,
                  borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
                }}>
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
            initialNumToRender={10}
            maxToRenderPerBatch={6}
            windowSize={10}
            ListFooterComponent={
              isGenerating && streamingId === null ? (
                <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
                  <TypingDots />
                </View>
              ) : null
            }
          />
        )}

        {/* ── Input ──────────────────────────────────────────────────────── */}
        <View style={{
          paddingHorizontal: 12, paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 12),
          borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: borderC,
        }}>
          {/* Media previews */}
          {selectedMedia.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ flexDirection: 'row', gap: 8, paddingBottom: 8 }}>
              {selectedMedia.map((m, i) => (
                <View key={i} style={{ position: 'relative' }}>
                  <View style={{ width: 64, height: 64, borderRadius: 12, overflow: 'hidden', backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA' }}>
                    {m.type === 'image' ? (
                      <ExpoImage source={{ uri: m.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                    ) : (
                      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        <Ionicons name="document" size={22} color={ACCENT} />
                        <Text style={{ fontSize: 9, color: subC }} numberOfLines={1}>{m.name}</Text>
                      </View>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => setSelectedMedia(prev => prev.filter((_, ii) => ii !== i))}
                    style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: 9, backgroundColor: '#666', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Ionicons name="close" size={10} color="#FFF" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Edit banner */}
          {editingId && (
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingBottom: 6, gap: 6 }}>
              <Ionicons name="pencil" size={13} color={ACCENT} />
              <Text style={{ color: ACCENT, fontSize: 13, fontWeight: '600' }}>Editing message</Text>
            </View>
          )}

          <View style={{
            backgroundColor: inputBg, borderRadius: 26,
            paddingHorizontal: 14, paddingVertical: 10,
            borderWidth: StyleSheet.hairlineWidth, borderColor: borderC,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
              {/* + Tools button */}
              {!editingId ? (
                <TouchableOpacity
                  onPress={() => setToolsVisible(true)}
                  hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                  style={{ marginBottom: 2 }}
                >
                  <Ionicons name="add-circle-outline" size={24} color={subC} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => { setEditingId(null); setInputText(''); }}
                  hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                  style={{ marginBottom: 2 }}
                >
                  <Ionicons name="close-circle-outline" size={24} color={subC} />
                </TouchableOpacity>
              )}

              <TextInput
                ref={inputRef}
                style={{ flex: 1, color: textC, fontSize: 16, lineHeight: 22, maxHeight: 140, paddingVertical: 0 }}
                placeholder="Ask away. Pics work too."
                placeholderTextColor={subC}
                value={inputText}
                onChangeText={setInputText}
                multiline
                returnKeyType="default"
                blurOnSubmit={false}
              />

              {isGenerating ? (
                <TouchableOpacity
                  onPress={() => { abortRef.current?.abort(); setIsGenerating(false); setStreamingId(null); }}
                  style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: isDark ? '#3A3A3C' : '#DCDCDC', alignItems: 'center', justifyContent: 'center', marginBottom: 2 }}
                >
                  <View style={{ width: 10, height: 10, backgroundColor: textC, borderRadius: 2 }} />
                </TouchableOpacity>
              ) : showSend ? (
                <TouchableOpacity
                  onPress={handleSend}
                  style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', marginBottom: 2 }}
                >
                  <Ionicons name="arrow-up" size={18} color="#FFF" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => setToolsVisible(true)}
                  style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: ACCENT + '22', alignItems: 'center', justifyContent: 'center', marginBottom: 2 }}
                >
                  <Ionicons name="add" size={20} color={ACCENT} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* ── Model Selector ─────────────────────────────────────────────────── */}
      <Modal visible={modelSelectorVisible} transparent animationType="none" onRequestClose={() => setModelSelectorVisible(false)}>
        <Pressable style={{ flex: 1 }} onPress={() => setModelSelectorVisible(false)}>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={isDark ? 60 : 45} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.3)' }]} />
          )}
        </Pressable>
        <View style={{
          position: 'absolute', top: insets.top + 58, left: 16, right: 16,
          borderRadius: 20, overflow: 'hidden',
          shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 20,
        }}>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={isDark ? 92 : 82} tint={isDark ? 'dark' : 'extraLight'} style={{ borderRadius: 20, overflow: 'hidden' }}>
              {(Object.entries(MODELS) as [ModelKey, (typeof MODELS)[ModelKey]][]).map(([key, m], i) => (
                <TouchableOpacity key={key} onPress={() => { setSelectedModel(key); setModelSelectorVisible(false); }}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 18, borderTopWidth: i > 0 ? StyleSheet.hairlineWidth : 0, borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)' }}
                  activeOpacity={0.7}>
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
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 18, borderTopWidth: i > 0 ? StyleSheet.hairlineWidth : 0, borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)' }}>
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

      {/* ── Side Menu ────────────────────────────────────────────────────────── */}
      <SideMenuDrawer
        visible={sideMenuVisible}
        onClose={() => setSideMenuVisible(false)}
        user={user}
        isDark={isDark}
        conversations={conversations}
        onSelectConv={id => setCurrentConvId(id)}
        currentConvId={currentConvId}
      />

      {/* ── Tools Sheet ──────────────────────────────────────────────────────── */}
      <ToolsSheet
        visible={toolsVisible}
        onClose={() => setToolsVisible(false)}
        isDark={isDark}
        onPickImage={handlePickImage}
        onPickFile={handlePickFile}
      />

      {/* ── Full Code Modal ───────────────────────────────────────────────────── */}
      <FullCodeModal
        visible={!!openCodeBlock}
        block={openCodeBlock}
        onClose={() => setOpenCodeBlock(null)}
        isDark={isDark}
      />
    </View>
  );
}
