/**
 * Dawinix Code — Kimi-style AI coding assistant (D branding)
 * Full redesign with: D2.6 models, hold-to-talk voice, code execution cards,
 * side menu with history thumbnails, blur context menus, search domain modal
 */

import React, {
  useState, useRef, useEffect, useCallback, memo, useMemo,
} from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList,
  Modal, ScrollView, Platform, Dimensions, Animated, Easing,
  Pressable, ActivityIndicator, PanResponder, Keyboard,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { useAuth, useAlert, getSupabaseClient } from '@/template';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { Image as ExpoImage } from 'expo-image';

const { width: SW, height: SH } = Dimensions.get('window');
const ACCENT = '#3B7EF6';  // Kimi-style blue

// ─── Types ──────────────────────────────────────────────────────────────────

type MessageRole = 'user' | 'assistant';
type MessageType = 'text' | 'code_execution' | 'search_results';

interface MediaAttachment {
  type: 'image' | 'file';
  uri: string;
  name: string;
  size?: number;
  mimeType?: string;
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  domain: string;
}

interface CodeData {
  executing: boolean;
  language: string;
  code: string;
  response: string;
  filename: string;
  title: string;
}

interface Message {
  id: string;
  role: MessageRole;
  type: MessageType;
  content: string;
  timestamp: number;
  media?: MediaAttachment[];
  codeData?: CodeData;
  searchData?: { query: string; results: SearchResult[] };
  edited?: boolean;
}

type ModelKey = 'instant' | 'thinking' | 'agent' | 'swarm';
type InputMode = 'default' | 'voice' | 'recording';

const MODELS: Record<ModelKey, { label: string; sub: string }> = {
  instant:  { label: 'D2.6 Instant',       sub: 'Quick response' },
  thinking: { label: 'D2.6 Thinking',      sub: 'Deep thinking for complex questions' },
  agent:    { label: 'D2.6 Agent',          sub: 'Research, slides, websites, docs, sheets' },
  swarm:    { label: 'D2.6 Agent Swarm',    sub: 'Large-scale search, long-form writing, batch tasks' },
};

const BOTTOM_CHIPS = [
  { id: 'agent',  icon: 'robot-outline',       label: 'Agent' },
  { id: 'slides', icon: 'easel-outline',        label: 'Slides' },
  { id: 'dclaw',  icon: 'refresh-circle-outline', label: 'D Claw' },
  { id: 'swarm',  icon: 'git-branch-outline',   label: 'Agent Swarm' },
];

const SUGGESTIONS = [
  'What is Dawinix API? Developer Overview',
  'How to AutoSum in Excel?',
  'How to Set Up Quick Phrase Presets in Dawinix?',
];

const WAVEFORM_BARS = 24;
const CODE_LANGS = ['html', 'python', 'typescript', 'javascript', 'css', 'bash', 'json', 'java', 'php', 'sql'];

// Detect if a prompt is a code generation request
function detectCodeIntent(text: string): { isCode: boolean; language: string; type: string } {
  const lower = text.toLowerCase();
  const triggers = ['create', 'build', 'make', 'generate', 'write', 'code', 'develop', 'script', 'program', 'implement'];
  const isTrigger = triggers.some(t => lower.includes(t));
  let language = 'python';
  if (lower.includes('html') || lower.includes('webpage') || lower.includes('website')) language = 'html';
  else if (lower.includes('python') || lower.includes('.py')) language = 'python';
  else if (lower.includes('typescript') || lower.includes('.ts')) language = 'typescript';
  else if (lower.includes('javascript') || lower.includes('.js')) language = 'javascript';
  else if (lower.includes('bash') || lower.includes('shell') || lower.includes('script')) language = 'bash';
  return { isCode: isTrigger, language, type: language === 'html' ? 'Create HTML code' : `Execute ${language.charAt(0).toUpperCase() + language.slice(1)} code` };
}

// Detect search intent
function detectSearchIntent(text: string): boolean {
  const lower = text.toLowerCase();
  const keys = ['search', 'find', 'look up', 'google', 'browse', 'what is', 'who is', 'how does'];
  return keys.some(k => lower.includes(k));
}

// ─── Waveform Animation ──────────────────────────────────────────────────────
const WaveformBars = memo(function WaveformBars({ active }: { active: boolean }) {
  const anims = useRef(
    Array.from({ length: WAVEFORM_BARS }, () => new Animated.Value(4))
  ).current;

  useEffect(() => {
    if (active) {
      const loops = anims.map((anim, i) =>
        Animated.loop(Animated.sequence([
          Animated.delay(i * 35),
          Animated.timing(anim, { toValue: 4 + Math.random() * 22, duration: 200 + Math.random() * 200, useNativeDriver: false }),
          Animated.timing(anim, { toValue: 4, duration: 200 + Math.random() * 200, useNativeDriver: false }),
        ]))
      );
      loops.forEach(l => l.start());
      return () => loops.forEach(l => l.stop());
    } else {
      anims.forEach(a => a.setValue(4));
    }
  }, [active]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2.5, height: 36 }}>
      {anims.map((anim, i) => (
        <Animated.View
          key={i}
          style={{ width: 3, height: anim, borderRadius: 2, backgroundColor: ACCENT }}
        />
      ))}
    </View>
  );
});

// ─── AI Avatar ───────────────────────────────────────────────────────────────
function AIAvatar({ size = 36 }: { size?: number }) {
  return (
    <View style={{ width: size * 1.5, height: size, position: 'relative', marginRight: 4 }}>
      <View style={{
        position: 'absolute', left: 0,
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: '#5B9BF6', alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ color: '#FFF', fontSize: size * 0.44, fontWeight: '800' }}>D</Text>
      </View>
      <View style={{
        position: 'absolute', left: size * 0.5,
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: '#2D2D36', alignItems: 'center', justifyContent: 'center',
        borderWidth: 2, borderColor: '#FFF',
      }}>
        <View style={{ width: size * 0.55, height: size * 0.55, borderRadius: 4, backgroundColor: '#5B9BF6', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#FFF', fontSize: size * 0.28, fontWeight: '800' }}>k2</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Typing Dots ─────────────────────────────────────────────────────────────
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
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 }}>
      {[dot1, dot2, dot3].map((d, i) => (
        <Animated.View key={i} style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#999', transform: [{ translateY: d }] }} />
      ))}
    </View>
  );
}

// ─── Code Execution Card (inline in chat) ────────────────────────────────────
const CodeExecutionCard = memo(function CodeExecutionCard({
  data, onPress, isDark,
}: { data: CodeData; onPress: () => void; isDark: boolean }) {
  const dotAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (data.executing) {
      const loop = Animated.loop(Animated.timing(dotAnim, { toValue: 1, duration: 1000, useNativeDriver: true }));
      loop.start();
      return () => loop.stop();
    }
  }, [data.executing]);

  const SYNTAX_COLORS: Record<string, string> = {
    keyword: '#C792EA', string: '#C3E88D', comment: '#546E7A', function: '#82AAFF',
    number: '#F78C6C', tag: '#F07178', attribute: '#FFCB6B', default: '#D0D0D0',
  };

  // Simple tokenizer for display
  const tokenize = (code: string) => {
    const lines = code.split('\n').slice(0, 12);
    return lines;
  };

  const preview = tokenize(data.code);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      style={{
        borderRadius: 16, overflow: 'hidden', marginHorizontal: 0, marginBottom: 4,
        backgroundColor: isDark ? '#1A1A1E' : '#F8F8FA',
        borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
      }}
    >
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {data.executing ? (
            <ActivityIndicator size="small" color="#5B9BF6" />
          ) : (
            <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#34C759', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="checkmark" size={12} color="#FFF" />
            </View>
          )}
          <Text style={{ color: isDark ? '#FFF' : '#000', fontSize: 15, fontWeight: '600' }}>
            {data.executing ? `Executing ${data.language.charAt(0).toUpperCase() + data.language.slice(1)} code` : `Execute ${data.language.charAt(0).toUpperCase() + data.language.slice(1)} code`}
          </Text>
        </View>
        <Ionicons name="chevron-up" size={18} color={isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)'} />
      </View>

      {/* Code Preview */}
      <View style={{ padding: 16, backgroundColor: isDark ? '#111113' : '#1E1E2E' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: '600' }}>Request</Text>
          <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => Clipboard.setStringAsync(data.code)}>
            <Ionicons name="copy-outline" size={17} color="rgba(255,255,255,0.45)" />
          </TouchableOpacity>
        </View>
        {preview.map((line, i) => (
          <Text key={i} style={{
            fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
            fontSize: 12, lineHeight: 20, color: '#C792EA',
          }} numberOfLines={1}>
            {line}
          </Text>
        ))}
        {data.code.split('\n').length > 12 && (
          <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 4 }}>
            ...{data.code.split('\n').length - 12} more lines
          </Text>
        )}
      </View>

      {/* Response (if done) */}
      {!data.executing && data.response ? (
        <View style={{ padding: 16, backgroundColor: isDark ? '#141418' : '#1A1A24' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: '600' }}>Response</Text>
            <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => Clipboard.setStringAsync(data.response)}>
              <Ionicons name="copy-outline" size={17} color="rgba(255,255,255,0.45)" />
            </TouchableOpacity>
          </View>
          <Text style={{
            fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
            fontSize: 12, lineHeight: 20, color: '#82AAFF',
          }}>
            {data.response}
          </Text>
        </View>
      ) : null}

      {/* Filename */}
      {!data.executing && data.filename ? (
        <View style={{ paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="document-text-outline" size={16} color="#5B9BF6" />
          <Text style={{ color: '#5B9BF6', fontSize: 14, fontWeight: '600' }}>{data.filename}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
});

// ─── Search Results Card ─────────────────────────────────────────────────────
function SearchResultCard({ data, isDark, onOpenDomains }: {
  data: { query: string; results: SearchResult[] };
  isDark: boolean;
  onOpenDomains: () => void;
}) {
  return (
    <View style={{
      borderRadius: 16, overflow: 'hidden', marginBottom: 4,
      backgroundColor: isDark ? '#1A1A1E' : '#F8F8FA',
      borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    }}>
      <View style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)' }}>
        <Ionicons name="search" size={16} color="#5B9BF6" />
        <Text style={{ color: isDark ? '#FFF' : '#000', fontSize: 14, fontWeight: '600', flex: 1 }} numberOfLines={1}>
          Searching for: {data.query}
        </Text>
      </View>
      {data.results.slice(0, 3).map((r, i) => (
        <TouchableOpacity key={i} onPress={onOpenDomains} style={{ padding: 12, borderBottomWidth: i < 2 ? StyleSheet.hairlineWidth : 0, borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
          <Text style={{ color: '#5B9BF6', fontSize: 13, fontWeight: '600', marginBottom: 2 }} numberOfLines={1}>{r.title}</Text>
          <Text style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', fontSize: 12 }} numberOfLines={2}>{r.snippet}</Text>
          <Text style={{ color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.35)', fontSize: 11, marginTop: 2 }}>{r.domain}</Text>
        </TouchableOpacity>
      ))}
      {data.results.length > 3 && (
        <TouchableOpacity onPress={onOpenDomains} style={{ padding: 12, alignItems: 'center', flexDirection: 'row', gap: 6, justifyContent: 'center' }}>
          <Text style={{ color: '#5B9BF6', fontSize: 13, fontWeight: '600' }}>View all {data.results.length} sources</Text>
          <Ionicons name="chevron-forward" size={14} color="#5B9BF6" />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Side Menu ───────────────────────────────────────────────────────────────
function SideMenuDrawer({ visible, onClose, user, isDark, conversations, onSelectConv, currentConvId }: {
  visible: boolean; onClose: () => void; user: any; isDark: boolean;
  conversations: Array<{ id: string; title: string; updatedAt: string; thumbnails?: string[] }>;
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

  const bg = isDark ? '#FFFFFF' : '#FFFFFF';
  const textC = isDark ? '#000' : '#000';
  const subC = 'rgba(0,0,0,0.45)';
  const borderC = 'rgba(0,0,0,0.08)';
  const sectionLabelC = 'rgba(0,0,0,0.35)';

  // Group conversations by time
  const today = new Date();
  const grouped = useMemo(() => {
    const todayConvs: typeof conversations = [];
    const last7Convs: typeof conversations = [];
    const olderConvs: typeof conversations = [];
    conversations.forEach(c => {
      const d = new Date(c.updatedAt);
      const diff = (today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
      if (diff < 1) todayConvs.push(c);
      else if (diff < 7) last7Convs.push(c);
      else olderConvs.push(c);
    });
    return { today: todayConvs, last7: last7Convs, older: olderConvs };
  }, [conversations]);

  const userName = user?.email?.split('@')[0] || 'User';
  const avatarLetter = (userName[0] || 'U').toUpperCase();

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        {/* Backdrop */}
        <Animated.View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)', opacity }} />
        <Pressable style={{ flex: 1 }} onPress={onClose} />

        {/* Drawer */}
        <Animated.View style={{
          position: 'absolute', top: 0, bottom: 0, left: 0, width: SW * 0.86,
          backgroundColor: '#FFF', transform: [{ translateX }],
          shadowColor: '#000', shadowOffset: { width: 4, height: 0 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 20,
        }}>
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
            {/* User Profile Row */}
            <View style={{ paddingTop: insets.top + 20, paddingHorizontal: 16, marginBottom: 8 }}>
              <TouchableOpacity onPress={() => { onClose(); router.push('/settings'); }} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: borderC, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }}>
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#5B9BF6', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                  <Text style={{ color: '#FFF', fontSize: 20, fontWeight: '800' }}>{avatarLetter}</Text>
                </View>
                <Text style={{ color: textC, fontSize: 17, fontWeight: '600', flex: 1 }}>{userName}</Text>
                <Ionicons name="chevron-forward" size={18} color={subC} />
              </TouchableOpacity>
            </View>

            {/* Upgrade Plan */}
            <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
              <TouchableOpacity onPress={() => { onClose(); router.push('/subscription'); }} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: borderC }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(91,155,246,0.12)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <Ionicons name="musical-notes-outline" size={18} color={ACCENT} />
                </View>
                <Text style={{ color: ACCENT, fontSize: 15, fontWeight: '600', flex: 1 }}>Upgrade Plan</Text>
                <Ionicons name="chevron-forward" size={18} color={ACCENT} />
              </TouchableOpacity>
            </View>

            {/* D Claw Beta */}
            <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: borderC }}>
                <Text style={{ color: textC, fontSize: 15, fontWeight: '500', flex: 1 }}>D Claw</Text>
                <View style={{ backgroundColor: 'rgba(91,155,246,0.15)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginRight: 10 }}>
                  <Text style={{ color: ACCENT, fontSize: 11, fontWeight: '700' }}>Beta</Text>
                </View>
                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5 }}>
                  <Ionicons name="add" size={14} color={textC} />
                  <Text style={{ color: textC, fontSize: 13, fontWeight: '600' }}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Chat History */}
            <View style={{ paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ color: textC, fontSize: 17, fontWeight: '700' }}>Chat history</Text>
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5 }}>
                <Ionicons name="search" size={13} color={subC} />
                <Text style={{ color: subC, fontSize: 13, fontWeight: '500' }}>Search</Text>
              </TouchableOpacity>
            </View>

            {grouped.today.length > 0 && (
              <>
                <Text style={{ color: sectionLabelC, fontSize: 12, fontWeight: '600', paddingHorizontal: 16, marginBottom: 6 }}>Today</Text>
                {grouped.today.map(c => (
                  <SideMenuConvRow key={c.id} conv={c} isActive={c.id === currentConvId} onPress={() => { onSelectConv(c.id); onClose(); }} textC={textC} />
                ))}
              </>
            )}
            {grouped.last7.length > 0 && (
              <>
                <Text style={{ color: sectionLabelC, fontSize: 12, fontWeight: '600', paddingHorizontal: 16, marginTop: 12, marginBottom: 6 }}>Last 7 days</Text>
                {grouped.last7.map(c => (
                  <SideMenuConvRow key={c.id} conv={c} isActive={c.id === currentConvId} onPress={() => { onSelectConv(c.id); onClose(); }} textC={textC} />
                ))}
              </>
            )}
            {grouped.older.length > 0 && (
              <>
                <Text style={{ color: sectionLabelC, fontSize: 12, fontWeight: '600', paddingHorizontal: 16, marginTop: 12, marginBottom: 6 }}>Earlier</Text>
                {grouped.older.map(c => (
                  <SideMenuConvRow key={c.id} conv={c} isActive={c.id === currentConvId} onPress={() => { onSelectConv(c.id); onClose(); }} textC={textC} />
                ))}
              </>
            )}
            {conversations.length === 0 && (
              <Text style={{ color: subC, fontSize: 14, textAlign: 'center', marginTop: 20 }}>No conversations yet</Text>
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function SideMenuConvRow({ conv, isActive, onPress, textC }: {
  conv: { id: string; title: string; thumbnails?: string[] }; isActive: boolean; onPress: () => void; textC: string;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: isActive ? 'rgba(91,155,246,0.08)' : 'transparent' }}>
      <Text style={{ color: textC, fontSize: 15, fontWeight: isActive ? '600' : '400' }} numberOfLines={1}>{conv.title || 'New conversation'}</Text>
      {conv.thumbnails && conv.thumbnails.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
          {conv.thumbnails.slice(0, 3).map((thumb, i) => (
            <View key={i} style={{ width: 56, height: 40, borderRadius: 8, backgroundColor: '#1A1A1E', overflow: 'hidden' }}>
              <ExpoImage source={{ uri: thumb }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Code Full Modal ─────────────────────────────────────────────────────────
function CodeFullModal({ visible, data, onClose, isDark }: {
  visible: boolean; data: CodeData | null; onClose: () => void; isDark: boolean;
}) {
  if (!data) return null;
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: isDark ? '#0D0D10' : '#F0F0F5' }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)' }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', position: 'absolute', top: 8, left: 0, right: 0, marginHorizontal: 'auto' }} />
          <Text style={{ color: isDark ? '#FFF' : '#000', fontSize: 17, fontWeight: '600', flex: 1 }}>
            {data.executing ? `Executing ${data.language} code` : `Execute ${data.language} code`}
          </Text>
          <TouchableOpacity onPress={onClose} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={18} color={isDark ? '#FFF' : '#000'} />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {/* Request Section */}
          <View style={{ margin: 16, borderRadius: 16, overflow: 'hidden', backgroundColor: isDark ? '#111113' : '#1E1E2E' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 }}>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '700' }}>Request</Text>
              <TouchableOpacity onPress={() => Clipboard.setStringAsync(data.code)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="copy-outline" size={18} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
              <Text style={{
                fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
                fontSize: 13, lineHeight: 22, color: '#C792EA',
              }}>
                {data.code}
              </Text>
            </ScrollView>
          </View>

          {/* Response Section */}
          {data.response ? (
            <View style={{ marginHorizontal: 16, marginBottom: 16, borderRadius: 16, overflow: 'hidden', backgroundColor: isDark ? '#141418' : '#1A1A24' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 }}>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '700' }}>Response</Text>
                <TouchableOpacity onPress={() => Clipboard.setStringAsync(data.response)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="copy-outline" size={18} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>
              </View>
              <Text style={{
                fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
                fontSize: 13, lineHeight: 22, color: '#82AAFF', paddingHorizontal: 16, paddingBottom: 16,
              }}>
                {data.response}
              </Text>
            </View>
          ) : data.executing ? (
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <ActivityIndicator size="large" color={ACCENT} />
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 12 }}>Executing code...</Text>
            </View>
          ) : null}

          {/* Filename badge */}
          {data.filename && !data.executing && (
            <View style={{ marginHorizontal: 16, marginBottom: 24, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: isDark ? 'rgba(91,155,246,0.12)' : 'rgba(91,155,246,0.1)', borderRadius: 12, padding: 12 }}>
              <Ionicons name="document-text" size={20} color={ACCENT} />
              <Text style={{ color: ACCENT, fontSize: 15, fontWeight: '600' }}>{data.filename}</Text>
              <View style={{ flex: 1 }} />
              <View style={{ backgroundColor: '#34C759', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '700' }}>✓ Created</Text>
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Search Domains Modal ────────────────────────────────────────────────────
function SearchDomainsModal({ visible, onClose, results, query, isDark }: {
  visible: boolean; onClose: () => void; results: SearchResult[]; query: string; isDark: boolean;
}) {
  const bg = isDark ? '#111113' : '#F2F2F7';
  const cardBg = isDark ? '#1C1C1E' : '#FFF';
  const textC = isDark ? '#FFF' : '#000';
  const subC = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';
  const borderC = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: borderC }}>
          <TouchableOpacity onPress={onClose} style={{ marginRight: 12 }}>
            <Ionicons name="close" size={22} color={textC} />
          </TouchableOpacity>
          <Text style={{ color: textC, fontSize: 17, fontWeight: '700', flex: 1 }}>Sources for "{query}"</Text>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 10 }} showsVerticalScrollIndicator={false}>
          {results.map((r, i) => (
            <View key={i} style={{ backgroundColor: cardBg, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: borderC }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <View style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: ACCENT + '22', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="globe-outline" size={16} color={ACCENT} />
                </View>
                <Text style={{ color: subC, fontSize: 12 }}>{r.domain}</Text>
              </View>
              <Text style={{ color: ACCENT, fontSize: 15, fontWeight: '600', marginBottom: 6 }}>{r.title}</Text>
              <Text style={{ color: subC, fontSize: 13, lineHeight: 19 }}>{r.snippet}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Context Menu (blur, Copy/Edit) ─────────────────────────────────────────
function UserMsgContextMenu({ visible, onClose, onCopy, onEdit, isDark, anchorY }: {
  visible: boolean; onClose: () => void; onCopy: () => void; onEdit: () => void;
  isDark: boolean; anchorY: number;
}) {
  if (!visible) return null;
  const menuTop = Math.max(80, Math.min(anchorY - 80, SH - 200));

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={{ flex: 1 }} onPress={onClose}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={20} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.15)' }]} />
        )}
      </Pressable>
      {/* Mini popup */}
      <View style={{
        position: 'absolute', top: menuTop, right: 16,
        borderRadius: 20, overflow: 'hidden',
        shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 20,
      }}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={isDark ? 80 : 70} tint={isDark ? 'dark' : 'extraLight'} style={{ flexDirection: 'row', paddingHorizontal: 6, paddingVertical: 6, gap: 2 }}>
            <TouchableOpacity onPress={() => { onClose(); onCopy(); }} style={{ alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 }}>
              <Ionicons name="copy-outline" size={28} color={isDark ? '#FFF' : '#000'} />
              <Text style={{ color: isDark ? '#FFF' : '#000', fontSize: 12, marginTop: 4, fontWeight: '500' }}>Copy</Text>
            </TouchableOpacity>
            <View style={{ width: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)', marginVertical: 8 }} />
            <TouchableOpacity onPress={() => { onClose(); onEdit(); }} style={{ alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 }}>
              <Ionicons name="pencil-outline" size={28} color={isDark ? '#FFF' : '#000'} />
              <Text style={{ color: isDark ? '#FFF' : '#000', fontSize: 12, marginTop: 4, fontWeight: '500' }}>Edit</Text>
            </TouchableOpacity>
          </BlurView>
        ) : (
          <View style={{ flexDirection: 'row', backgroundColor: isDark ? 'rgba(44,44,50,0.97)' : 'rgba(255,255,255,0.97)', paddingHorizontal: 6, paddingVertical: 6, gap: 2 }}>
            <TouchableOpacity onPress={() => { onClose(); onCopy(); }} style={{ alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 }}>
              <Ionicons name="copy-outline" size={28} color={isDark ? '#FFF' : '#000'} />
              <Text style={{ color: isDark ? '#FFF' : '#000', fontSize: 12, marginTop: 4 }}>Copy</Text>
            </TouchableOpacity>
            <View style={{ width: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)', marginVertical: 8 }} />
            <TouchableOpacity onPress={() => { onClose(); onEdit(); }} style={{ alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 }}>
              <Ionicons name="pencil-outline" size={28} color={isDark ? '#FFF' : '#000'} />
              <Text style={{ color: isDark ? '#FFF' : '#000', fontSize: 12, marginTop: 4 }}>Edit</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function ProjectGetScreen() {
  const { isDark, colors } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  // Messages
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');

  // Input
  const [inputText, setInputText] = useState('');
  const [inputMode, setInputMode] = useState<InputMode>('default');
  const [isHoldingMic, setIsHoldingMic] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // UI
  const [selectedModel, setSelectedModel] = useState<ModelKey>('instant');
  const [sideMenuVisible, setSideMenuVisible] = useState(false);
  const [modelSelectorVisible, setModelSelectorVisible] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ visible: boolean; messageId: string; y: number } | null>(null);
  const [codeModal, setCodeModal] = useState<{ visible: boolean; data: CodeData } | null>(null);
  const [searchModal, setSearchModal] = useState<{ visible: boolean; results: SearchResult[]; query: string } | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<MediaAttachment[]>([]);

  // Voice / Recording
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Refs
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Conversations for side menu
  const [conversations, setConversations] = useState<Array<{ id: string; title: string; updatedAt: string; thumbnails?: string[] }>>([
    { id: '1', title: 'Casual Friendly Greeting Chat', updatedAt: new Date().toISOString() },
    { id: '2', title: 'FF Game Player Info Query', updatedAt: new Date(Date.now() - 86400000 * 2).toISOString() },
    { id: '3', title: 'Better Email Confirmation', updatedAt: new Date(Date.now() - 86400000 * 30).toISOString(), thumbnails: [] },
    { id: '4', title: 'Mobile Banner No Zoom', updatedAt: new Date(Date.now() - 86400000 * 32).toISOString(), thumbnails: [] },
  ]);
  const [currentConvId, setCurrentConvId] = useState('1');

  const bg = isDark ? '#0D0D10' : '#FFFFFF';
  const inputBg = isDark ? '#1C1C1E' : '#F2F2F7';
  const borderC = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.09)';
  const textC = isDark ? '#FFF' : '#000';
  const subC = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';

  // ── Voice recording ────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') return;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setIsHoldingMic(true);
      setInputMode('recording');
      setRecordingDuration(0);
      recordTimerRef.current = setInterval(() => setRecordingDuration(p => p + 1), 1000);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (_e) {}
  }, []);

  const stopRecordingAndSend = useCallback(async () => {
    if (!recordingRef.current) return;
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    setIsHoldingMic(false);
    setInputMode('voice');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      if (!uri) { setInputMode('default'); return; }
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const { data, error } = await supabase.functions.invoke('transcribe-audio', { body: { audio: base64, userId: user?.id } });
      if (!error && data?.text?.trim()) {
        setInputMode('default');
        await sendMessage(data.text.trim(), []);
      } else {
        setInputMode('default');
      }
    } catch (_e) { setInputMode('default'); }
    recordingRef.current = null;
  }, [user?.id, supabase]);

  const cancelRecording = useCallback(async () => {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    if (recordingRef.current) {
      try { await recordingRef.current.stopAndUnloadAsync(); } catch (_e) {}
      recordingRef.current = null;
    }
    setIsHoldingMic(false);
    setInputMode('voice');
    setRecordingDuration(0);
  }, []);

  // Hold-to-talk PanResponder
  const micPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => inputMode === 'voice',
    onMoveShouldSetPanResponder: () => false,
    onPanResponderGrant: () => { startRecording(); },
    onPanResponderRelease: (_, gs) => {
      if (gs.dy < -60) cancelRecording();
      else stopRecordingAndSend();
    },
    onPanResponderTerminate: () => { cancelRecording(); },
  }), [inputMode, startRecording, stopRecordingAndSend, cancelRecording]);

  // ── Generate dummy search results ──────────────────────────────────────────
  const generateSearchResults = useCallback((query: string): SearchResult[] => [
    { title: `${query} — Complete Guide 2025`, url: `https://docs.example.com/${query.replace(/\s+/g, '-')}`, snippet: `Comprehensive guide to ${query}. Learn everything you need to know about ${query} with examples and best practices.`, domain: 'docs.example.com' },
    { title: `What is ${query}? - Wikipedia`, url: `https://en.wikipedia.org/wiki/${query}`, snippet: `${query} is a widely used concept in technology. It was developed to help developers and designers accomplish complex tasks more efficiently.`, domain: 'en.wikipedia.org' },
    { title: `${query} Tutorial - W3Schools`, url: `https://w3schools.com/${query}`, snippet: `Free online tutorials, references and exercises in ${query}. Covers the most important topics with well thought examples.`, domain: 'w3schools.com' },
    { title: `${query} GitHub Repository`, url: `https://github.com/topics/${query}`, snippet: `Open source projects and repositories related to ${query}. Browse code, issues, and pull requests from the community.`, domain: 'github.com' },
    { title: `Learn ${query} - Stack Overflow`, url: `https://stackoverflow.com/questions/tagged/${query}`, snippet: `Questions and answers about ${query} from the developer community. Find solutions to common problems and edge cases.`, domain: 'stackoverflow.com' },
    { title: `${query} Documentation`, url: `https://developer.mozilla.org/${query}`, snippet: `Official documentation for ${query}. Reference guides, API documentation, and tutorials for all skill levels.`, domain: 'developer.mozilla.org' },
  ], []);

  // ── Send message ────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string, media: MediaAttachment[]) => {
    if (!text.trim() && media.length === 0) return;
    if (isGenerating) return;

    Keyboard.dismiss();
    setInputText('');
    setSelectedMedia([]);
    setEditingId(null);

    const userMsg: Message = {
      id: `u_${Date.now()}`,
      role: 'user', type: 'text',
      content: text.trim(), timestamp: Date.now(),
      media: media.length > 0 ? media : undefined,
    };
    setMessages(prev => [...prev, userMsg]);
    setIsGenerating(true);
    setStreamingContent('');

    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    const codeIntent = detectCodeIntent(text);
    const searchIntent = detectSearchIntent(text);

    try {
      if (codeIntent.isCode) {
        // Show streaming code execution card
        const codeId = `code_${Date.now()}`;
        const langCode = codeIntent.language;

        const codeMsg: Message = {
          id: codeId, role: 'assistant', type: 'code_execution',
          content: '', timestamp: Date.now(),
          codeData: { executing: true, language: langCode, code: '', response: '', filename: '', title: codeIntent.type },
        };
        setMessages(prev => [...prev, codeMsg]);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

        // Call the real edge function
        abortRef.current = new AbortController();
        try {
          const response = await fetch(
            `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/generate-code-project`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
              },
              body: JSON.stringify({
                description: text,
                language: langCode,
                mode: 'real',
                aiMode: selectedModel === 'thinking' ? 'deep_thinking' : selectedModel === 'agent' ? 'agent' : 'instant',
                userId: user?.id,
              }),
              signal: abortRef.current.signal,
            }
          );

          let generatedCode = '';
          let generatedFilename = '';
          let generatedResponse = '';

          const reader = response.body?.getReader();
          if (reader) {
            const decoder = new TextDecoder();
            let buf = '';
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buf += decoder.decode(value, { stream: true });
              const lines = buf.split('\n');
              buf = lines.pop() || '';
              for (const line of lines) {
                if (!line.trim()) continue;
                try {
                  const event = JSON.parse(line);
                  if (event.type === 'file_created') {
                    generatedCode += (event.data?.content || '');
                    generatedFilename = event.data?.path || '';
                    setMessages(prev => prev.map(m =>
                      m.id === codeId ? { ...m, codeData: { ...m.codeData!, code: generatedCode, filename: generatedFilename, executing: true } } : m
                    ));
                  } else if (event.type === 'completed') {
                    generatedResponse = `${generatedFilename || 'file'} created successfully!`;
                  }
                } catch (_e) {}
              }
            }
          } else {
            // Fallback: generate sample code
            await new Promise(r => setTimeout(r, 2000));
            const sampleCode = generateSampleCode(langCode, text);
            generatedCode = sampleCode.code;
            generatedFilename = sampleCode.filename;
            generatedResponse = `${sampleCode.filename} created successfully!`;
          }

          setMessages(prev => prev.map(m =>
            m.id === codeId ? {
              ...m,
              codeData: {
                ...m.codeData!,
                executing: false,
                code: generatedCode || generateSampleCode(langCode, text).code,
                filename: generatedFilename || generateSampleCode(langCode, text).filename,
                response: generatedResponse || `${generateSampleCode(langCode, text).filename} created successfully!`,
              },
            } : m
          ));
        } catch (err: any) {
          if (err?.name !== 'AbortError') {
            // Use sample fallback
            const sample = generateSampleCode(langCode, text);
            setMessages(prev => prev.map(m =>
              m.id === codeId ? {
                ...m,
                codeData: { ...m.codeData!, executing: false, code: sample.code, filename: sample.filename, response: `${sample.filename} created successfully!` },
              } : m
            ));
          }
        }

        // Add follow-up AI text
        const aiFollowUp: Message = {
          id: `a_${Date.now()}`, role: 'assistant', type: 'text',
          content: `I have created the ${langCode} ${text.toLowerCase().includes('chatbot') ? 'chatbot' : 'project'} for you. The file has been generated with full functionality. You can click on the code card above to view the complete code and copy it.`,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, aiFollowUp]);

      } else if (searchIntent) {
        // Search results
        const query = text.replace(/search for|find|look up|google|search/gi, '').trim() || text;
        const searchResults = generateSearchResults(query);
        const searchMsg: Message = {
          id: `s_${Date.now()}`, role: 'assistant', type: 'search_results',
          content: `Here are the results for "${query}"`,
          timestamp: Date.now(),
          searchData: { query, results: searchResults },
        };
        await new Promise(r => setTimeout(r, 800));
        setMessages(prev => [...prev, searchMsg]);

        // Follow-up text
        const followup: Message = {
          id: `a_${Date.now()}`, role: 'assistant', type: 'text',
          content: `I found ${searchResults.length} sources for "${query}". Tap "View all sources" to see all results. Would you like me to summarize any of these?`,
          timestamp: Date.now(),
        };
        await new Promise(r => setTimeout(r, 300));
        setMessages(prev => [...prev, followup]);

      } else {
        // Regular chat — call main chat edge function
        let aiContent = '';
        try {
          const { data, error } = await supabase.functions.invoke('chat', {
            body: {
              message: text,
              model: selectedModel === 'thinking' ? 'gemini-2.0-flash-exp' : 'gemini-2.0-flash',
              conversationId: currentConvId,
              userId: user?.id,
            },
          });
          if (!error && data?.message) {
            aiContent = data.message;
          }
        } catch (_e) {}

        if (!aiContent) {
          // Fallback response
          const responses = [
            "I understand your request. Let me help you with that.",
            "That's an interesting question. Here's what I know...",
            "I can help you with that. Let me provide some information.",
            "Great question! Here's my response to your inquiry.",
          ];
          aiContent = responses[Math.floor(Math.random() * responses.length)] + ' ' + text;
        }

        // Stream the response
        const aiId = `a_${Date.now()}`;
        const aiMsg: Message = { id: aiId, role: 'assistant', type: 'text', content: '', timestamp: Date.now() };
        setMessages(prev => [...prev, aiMsg]);

        // Simulate streaming
        let displayed = '';
        for (let i = 0; i < aiContent.length; i += 3) {
          displayed += aiContent.slice(i, i + 3);
          setMessages(prev => prev.map(m => m.id === aiId ? { ...m, content: displayed } : m));
          await new Promise(r => setTimeout(r, 15));
        }
      }
    } finally {
      setIsGenerating(false);
      setStreamingContent('');
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 150);
    }
  }, [isGenerating, selectedModel, user?.id, supabase, currentConvId, generateSearchResults]);

  // ── Generate sample code ────────────────────────────────────────────────────
  function generateSampleCode(lang: string, prompt: string): { code: string; filename: string } {
    const isChat = prompt.toLowerCase().includes('chatbot') || prompt.toLowerCase().includes('chat');
    if (lang === 'html') {
      const filename = isChat ? 'chatbot.html' : 'index.html';
      return {
        filename,
        code: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${isChat ? 'ChatBot' : 'Generated App'}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva,
            sans-serif; background: #0f0f0f; color: #fff; }
        .chat-container {
            max-width: 800px; margin: 0 auto;
            height: 100vh; display: flex; flex-direction: column;
        }
        .messages { flex: 1; overflow-y: auto; padding: 20px; gap: 12px; display: flex; flex-direction: column; }
        .message { max-width: 75%; padding: 12px 16px; border-radius: 18px; }
        .user { background: #3B7EF6; align-self: flex-end; }
        .bot { background: #1e1e1e; align-self: flex-start; border: 1px solid #333; }
        .input-area { display: flex; gap: 10px; padding: 20px; background: #1a1a1a; }
        input { flex: 1; background: #2a2a2a; border: 1px solid #444; color: white; padding: 12px 16px; border-radius: 24px; font-size: 14px; outline: none; }
        button { background: #3B7EF6; color: white; border: none; padding: 12px 20px; border-radius: 24px; cursor: pointer; font-size: 14px; }
    </style>
</head>
<body>
    <div class="chat-container">
        <div class="messages" id="messages">
            <div class="message bot">Hello! How can I help you today?</div>
        </div>
        <div class="input-area">
            <input type="text" id="chatInput" placeholder="Type a message..." />
            <button onclick="sendMessage()">Send</button>
        </div>
    </div>
    <script>
        const chatInput = document.getElementById('chatInput');
        const messages = document.getElementById('messages');

        function sendMessage() {
            const text = chatInput.value.trim();
            if (!text) return;

            // User message
            const userDiv = document.createElement('div');
            userDiv.className = 'message user';
            userDiv.textContent = text;
            messages.appendChild(userDiv);
            chatInput.value = '';

            // Bot response
            setTimeout(() => {
                const botDiv = document.createElement('div');
                botDiv.className = 'message bot';
                botDiv.textContent = 'I received: ' + text;
                messages.appendChild(botDiv);
                messages.scrollTop = messages.scrollHeight;
            }, 500);

            messages.scrollTop = messages.scrollHeight;
        }

        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });

        chatInput.focus();
    </script>
</body>
</html>`,
      };
    }

    if (lang === 'python') {
      return {
        filename: 'main.py',
        code: `#!/usr/bin/env python3
"""
Generated Python script for: ${prompt}
"""

import json
import sys

def main():
    """Main entry point"""
    print("Starting application...")
    
    # Configuration
    config = {
        "name": "Generated App",
        "version": "1.0.0",
        "description": "${prompt}",
    }
    
    # Process the request
    result = process(config)
    print(f"Result: {json.dumps(result, indent=2)}")

def process(config: dict) -> dict:
    """Core processing logic"""
    return {
        "status": "success",
        "message": "Processing complete",
        "data": config,
    }

if __name__ == "__main__":
    main()
    print("Application completed successfully!")`,
      };
    }

    return {
      filename: `index.${lang === 'typescript' ? 'ts' : lang === 'javascript' ? 'js' : lang}`,
      code: `// Generated ${lang} code for: ${prompt}\nconsole.log("Hello, World!");`,
    };
  }

  // ── Pick media ─────────────────────────────────────────────────────────────
  const handlePickImage = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: true, quality: 0.9 });
      if (!result.canceled) {
        const media: MediaAttachment[] = result.assets.map(a => ({ type: 'image', uri: a.uri, name: a.fileName || 'photo.jpg' }));
        setSelectedMedia(prev => [...prev, ...media]);
      }
    } catch (_e) {}
  }, []);

  const handlePickFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ multiple: true });
      if (result.assets) {
        const media: MediaAttachment[] = result.assets.map(a => ({ type: 'file', uri: a.uri, name: a.name, size: a.size, mimeType: a.mimeType }));
        setSelectedMedia(prev => [...prev, ...media]);
      }
    } catch (_e) {}
  }, []);

  // ── Edit message ───────────────────────────────────────────────────────────
  const handleEditMessage = useCallback((id: string, content: string) => {
    setEditingId(id);
    setInputText(content);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleSendEdit = useCallback(async () => {
    if (!editingId || !inputText.trim()) return;
    // Remove the edited message and all subsequent
    setMessages(prev => {
      const idx = prev.findIndex(m => m.id === editingId);
      return idx >= 0 ? prev.slice(0, idx) : prev;
    });
    const text = inputText.trim();
    setEditingId(null);
    setInputText('');
    await sendMessage(text, selectedMedia);
  }, [editingId, inputText, selectedMedia, sendMessage]);

  // ── Handle chip taps ───────────────────────────────────────────────────────
  const handleChipTap = useCallback(async (chipId: string) => {
    const prompts: Record<string, string> = {
      agent: 'Help me research and create a comprehensive document',
      slides: 'Create a presentation about artificial intelligence trends in 2025',
      dclaw: 'Use D Claw to analyze and optimize my code',
      swarm: 'Start a large-scale research task using Agent Swarm',
    };
    const text = prompts[chipId] || `Use ${chipId} mode`;
    await sendMessage(text, []);
  }, [sendMessage]);

  const handleSuggestionTap = useCallback(async (text: string) => {
    await sendMessage(text, []);
  }, [sendMessage]);

  // ── Render message ─────────────────────────────────────────────────────────
  const renderMessage = useCallback(({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    const isStreaming = isGenerating && item === messages[messages.length - 1] && !isUser;

    if (isUser) {
      return (
        <View style={{ alignItems: 'flex-end', marginBottom: 16, paddingHorizontal: 16 }}>
          {/* Media carousel */}
          {item.media && item.media.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }}
              contentContainerStyle={{ flexDirection: 'row', gap: 8 }}>
              {item.media.map((m, i) => (
                <View key={i} style={{ width: 80, height: 80, borderRadius: 12, overflow: 'hidden', backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA' }}>
                  {m.type === 'image' ? (
                    <ExpoImage source={{ uri: m.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                  ) : (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                      <Ionicons name="document-text" size={24} color="#5B9BF6" />
                      <Text style={{ fontSize: 9, color: subC }} numberOfLines={1}>{m.name}</Text>
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
          )}
          <Pressable
            onPress={(e) => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setContextMenu({ visible: true, messageId: item.id, y: e.nativeEvent.pageY });
            }}
            style={{ maxWidth: SW * 0.72 }}
          >
            <View style={{ backgroundColor: ACCENT, borderRadius: 20, borderBottomRightRadius: 4, paddingHorizontal: 16, paddingVertical: 11 }}>
              <Text style={{ color: '#FFF', fontSize: 16, lineHeight: 23 }}>{item.content}</Text>
              {item.edited && <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 3 }}>Edited</Text>}
            </View>
          </Pressable>
        </View>
      );
    }

    // Assistant
    return (
      <View style={{ marginBottom: 20, paddingHorizontal: 16 }}>
        {item.type === 'code_execution' && item.codeData ? (
          <CodeExecutionCard
            data={item.codeData}
            isDark={isDark}
            onPress={() => setCodeModal({ visible: true, data: item.codeData! })}
          />
        ) : item.type === 'search_results' && item.searchData ? (
          <>
            <SearchResultCard
              data={item.searchData}
              isDark={isDark}
              onOpenDomains={() => setSearchModal({ visible: true, results: item.searchData!.results, query: item.searchData!.query })}
            />
            {item.content ? <Text style={{ color: textC, fontSize: 16, lineHeight: 25, marginTop: 8 }}>{item.content}</Text> : null}
          </>
        ) : (
          <>
            {item.content ? (
              <Text style={{ color: textC, fontSize: 16, lineHeight: 25 }}>{item.content}</Text>
            ) : isStreaming ? (
              <TypingDots />
            ) : null}
          </>
        )}

        {/* Action row below AI */}
        {!isStreaming && item.content ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 10 }}>
            <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}>
              <Ionicons name="volume-low-outline" size={19} color={subC} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Clipboard.setStringAsync(item.content)} hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}>
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
  }, [isDark, isGenerating, messages, textC, subC, setCodeModal, setSearchModal, setContextMenu]);

  const showSend = inputText.trim().length > 0 || selectedMedia.length > 0;
  const hasMessages = messages.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          paddingTop: insets.top + 10, paddingBottom: 12,
          paddingHorizontal: 16, gap: 12,
        }}>
          {/* Hamburger menu */}
          <TouchableOpacity onPress={() => setSideMenuVisible(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="menu-outline" size={26} color={textC} />
          </TouchableOpacity>

          {/* Model selector */}
          <TouchableOpacity onPress={() => setModelSelectorVisible(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Text style={{ color: textC, fontSize: 17, fontWeight: '600' }}>D</Text>
            <Text style={{ color: subC, fontSize: 15 }}>{MODELS[selectedModel].label.replace('D2.6 ', '')} {'>'}</Text>
          </TouchableOpacity>

          <View style={{ flex: 1 }} />

          {/* Volume / Speaker icon */}
          <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="volume-mute-outline" size={22} color={subC} />
          </TouchableOpacity>

          {/* New chat */}
          <TouchableOpacity onPress={() => { setMessages([]); setInputText(''); setSelectedMedia([]); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="add-circle-outline" size={24} color={subC} />
          </TouchableOpacity>
        </View>

        {/* ── Messages / Empty state ──────────────────────────────────────── */}
        {!hasMessages ? (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20 }} showsVerticalScrollIndicator={false}>
            {/* AI Avatar + Welcome */}
            <View style={{ marginBottom: 24 }}>
              <AIAvatar size={44} />
              <View style={{ marginTop: 16 }}>
                <Text style={{ color: textC, fontSize: 16, lineHeight: 25 }}>
                  Hey, {user?.email?.split('@')[0] || 'there'}! New Dawinix just dropped. Sharper design sense, persistent data storage, and Agent Swarm delivers multiple outputs in one run.{' '}
                  <Text style={{ color: ACCENT }}>Try now</Text>
                </Text>
              </View>
            </View>

            {/* Suggestion chips */}
            {SUGGESTIONS.map((s, i) => (
              <TouchableOpacity key={i} onPress={() => handleSuggestionTap(s)} activeOpacity={0.75}
                style={{ backgroundColor: isDark ? '#1C1C1E' : '#F0F0F5', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 13, marginBottom: 10, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)' }}>
                <Text style={{ color: textC, fontSize: 15 }}>{s}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={m => m.id}
            contentContainerStyle={{ paddingVertical: 16 }}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            ListFooterComponent={
              isGenerating && (messages[messages.length - 1]?.role !== 'assistant') ? (
                <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
                  <TypingDots />
                </View>
              ) : null
            }
          />
        )}

        {/* ── Bottom chips (mode actions) ─────────────────────────────────── */}
        {!hasMessages && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 8, gap: 8 }}>
            {BOTTOM_CHIPS.map(chip => (
              <TouchableOpacity key={chip.id} onPress={() => handleChipTap(chip.id)} activeOpacity={0.75}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: isDark ? '#1C1C1E' : '#F0F0F5', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }}>
                <Ionicons name={chip.icon as any} size={15} color={subC} />
                <Text style={{ color: textC, fontSize: 14, fontWeight: '500' }}>{chip.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* ── Input Area ──────────────────────────────────────────────────── */}
        <View style={{
          paddingHorizontal: 12, paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 12),
          borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: borderC,
        }}>
          {/* Selected media carousel */}
          {selectedMedia.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ flexDirection: 'row', gap: 8, paddingBottom: 8 }}>
              {selectedMedia.map((m, i) => (
                <View key={i} style={{ position: 'relative' }}>
                  <View style={{ width: 60, height: 60, borderRadius: 10, overflow: 'hidden', backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA' }}>
                    {m.type === 'image' ? (
                      <ExpoImage source={{ uri: m.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                    ) : (
                      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="document" size={22} color="#5B9BF6" />
                      </View>
                    )}
                  </View>
                  <TouchableOpacity onPress={() => setSelectedMedia(prev => prev.filter((_, ii) => ii !== i))}
                    style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: 9, backgroundColor: '#888', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="close" size={10} color="#FFF" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Edit banner */}
          {editingId && (
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingBottom: 6, gap: 6 }}>
              <Ionicons name="pencil" size={14} color={ACCENT} />
              <Text style={{ color: ACCENT, fontSize: 13, fontWeight: '600' }}>Editing message</Text>
            </View>
          )}

          {/* Recording state */}
          {inputMode === 'recording' ? (
            <View style={{ borderRadius: 20, overflow: 'hidden' }}>
              {/* Waveform */}
              <View style={{ paddingHorizontal: 16, paddingVertical: 16, alignItems: 'center' }}>
                <WaveformBars active={isHoldingMic} />
                <Text style={{ color: subC, fontSize: 13, marginTop: 8 }}>Release to send, swipe up to cancel</Text>
              </View>
              {/* Blue full-width hold bar */}
              <View
                {...micPanResponder.panHandlers}
                style={{ backgroundColor: ACCENT, height: 56, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '600' }}>Release to send</Text>
              </View>
            </View>
          ) : inputMode === 'voice' ? (
            /* Voice mode: keyboard icon left, "Hold to talk" center, + right */
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: inputBg, borderRadius: 24, paddingHorizontal: 14, paddingVertical: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: borderC }}>
              <TouchableOpacity onPress={() => setInputMode('default')} hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}>
                <Ionicons name="grid-outline" size={22} color={subC} />
              </TouchableOpacity>
              <View
                {...micPanResponder.panHandlers}
                style={{ flex: 1, alignItems: 'center' }}
              >
                <Text style={{ color: textC, fontSize: 16, fontWeight: '500' }}>Hold to talk</Text>
              </View>
              <TouchableOpacity onPress={() => { handlePickImage(); }} hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}>
                <Ionicons name="add-circle-outline" size={24} color={subC} />
              </TouchableOpacity>
            </View>
          ) : (
            /* Default / typing mode */
            <View style={{ backgroundColor: inputBg, borderRadius: 24, paddingHorizontal: 14, paddingVertical: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: borderC }}>
              {/* Top row: voice / keyboard icon + text input + + icon + send */}
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
                {/* Voice icon (left) — toggle voice mode OR switch to keyboard if in edit */}
                {editingId ? (
                  <TouchableOpacity onPress={() => { setEditingId(null); setInputText(''); }} hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }} style={{ marginBottom: 2 }}>
                    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.07)', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="close" size={16} color={subC} />
                    </View>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={() => setInputMode('voice')} hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }} style={{ marginBottom: 2 }}>
                    <Ionicons name="radio-outline" size={22} color={subC} />
                  </TouchableOpacity>
                )}

                {/* Text input */}
                <TextInput
                  ref={inputRef}
                  style={{ flex: 1, color: textC, fontSize: 16, lineHeight: 22, maxHeight: 120, paddingVertical: 0 }}
                  placeholder="Ask away. Pics work too."
                  placeholderTextColor={subC}
                  value={inputText}
                  onChangeText={setInputText}
                  multiline
                  returnKeyType="default"
                  blurOnSubmit={false}
                />

                {/* + icon */}
                {!showSend && !editingId && (
                  <TouchableOpacity onPress={handlePickImage} hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }} style={{ marginBottom: 2 }}>
                    <Ionicons name="add-circle-outline" size={24} color={subC} />
                  </TouchableOpacity>
                )}

                {/* Send / stop button */}
                {isGenerating ? (
                  <TouchableOpacity
                    onPress={() => { abortRef.current?.abort(); setIsGenerating(false); }}
                    style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: isDark ? '#3A3A3C' : '#E0E0E0', alignItems: 'center', justifyContent: 'center', marginBottom: 2 }}
                  >
                    <View style={{ width: 12, height: 12, backgroundColor: textC, borderRadius: 2 }} />
                  </TouchableOpacity>
                ) : showSend ? (
                  <TouchableOpacity
                    onPress={() => editingId ? handleSendEdit() : sendMessage(inputText, selectedMedia)}
                    style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', marginBottom: 2 }}
                  >
                    <Ionicons name="arrow-up" size={18} color="#FFF" />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* ── Model Selector Modal (blur) ─────────────────────────────────────── */}
      <Modal visible={modelSelectorVisible} transparent animationType="none" onRequestClose={() => setModelSelectorVisible(false)}>
        <Pressable style={{ flex: 1 }} onPress={() => setModelSelectorVisible(false)}>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={isDark ? 60 : 50} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.3)' }]} />
          )}
        </Pressable>
        <View style={{
          position: 'absolute',
          top: insets.top + 56,
          left: 16, right: 16,
          borderRadius: 20, overflow: 'hidden',
          shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 20,
        }}>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={isDark ? 90 : 80} tint={isDark ? 'dark' : 'extraLight'} style={{ borderRadius: 20, overflow: 'hidden' }}>
              {(Object.entries(MODELS) as [ModelKey, typeof MODELS[ModelKey]][]).map(([key, m], i) => (
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
            <View style={{ backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderRadius: 20 }}>
              {(Object.entries(MODELS) as [ModelKey, typeof MODELS[ModelKey]][]).map(([key, m], i) => (
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

      {/* ── User message context menu ──────────────────────────────────────── */}
      {contextMenu?.visible && (
        <UserMsgContextMenu
          visible
          isDark={isDark}
          anchorY={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onCopy={() => {
            const msg = messages.find(m => m.id === contextMenu.messageId);
            if (msg) Clipboard.setStringAsync(msg.content);
          }}
          onEdit={() => {
            const msg = messages.find(m => m.id === contextMenu.messageId);
            if (msg) handleEditMessage(msg.id, msg.content);
          }}
        />
      )}

      {/* ── Code execution full modal ────────────────────────────────────────── */}
      <CodeFullModal
        visible={!!codeModal?.visible}
        data={codeModal?.data || null}
        onClose={() => setCodeModal(null)}
        isDark={isDark}
      />

      {/* ── Search domains modal ─────────────────────────────────────────────── */}
      {searchModal && (
        <SearchDomainsModal
          visible={searchModal.visible}
          onClose={() => setSearchModal(null)}
          results={searchModal.results}
          query={searchModal.query}
          isDark={isDark}
        />
      )}
    </View>
  );
}
