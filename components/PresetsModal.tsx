import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../hooks/useTheme';

const { width: SW, height: SH } = Dimensions.get('window');

interface Preset {
  id: string;
  phrase: string;
  trigger: string;
  /** If true, this preset is an AI behavior instruction (not a quick phrase) */
  isBehavior?: boolean;
}

interface PresetsModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectPreset: (phrase: string) => void;
}

const QUICK_EXAMPLES = [
  'Summarize the main points in one concise sentence.',
  'Translate the following text to English and fix any grammar mistakes.',
  'Write a professional email responding to this message:',
  'Create a step-by-step guide for:',
  'Explain this concept in simple terms as if I am 10 years old:',
  'Generate 5 creative ideas for:',
  'Review and improve this code:',
  'Create a quiz about:',
];

const BEHAVIOR_EXAMPLES = [
  'Never use emojis in any response, even if the topic calls for them.',
  'Always respond in Haitian Creole.',
  'Always respond in French.',
  'Keep all responses under 3 sentences.',
  'Always format code with comments explaining each step.',
  'Never use bullet points; write in paragraph form only.',
  'Always include sources and citations when answering factual questions.',
];

const STORAGE_KEY = 'haitian_ai_presets_v2';
const BEHAVIOR_KEY = 'haitian_ai_behavior_presets_v2';

export function PresetsModal({ visible, onClose, onSelectPreset }: PresetsModalProps) {
  const { colors, isDark } = useTheme();
  const [tab, setTab] = useState<'quick' | 'behavior'>('quick');
  const [screen, setScreen] = useState<'list' | 'add' | 'examples'>('list');
  const [presets, setPresets] = useState<Preset[]>([]);
  const [behaviorPresets, setBehaviorPresets] = useState<Preset[]>([]);
  const [phraseText, setPhraseText] = useState('');
  const [triggerText, setTriggerText] = useState('');
  const [searchText, setSearchText] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      loadPresets();
      setScreen('list');
      setSearchText('');
    }
  }, [visible]);

  const loadPresets = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) setPresets(JSON.parse(stored));
      const storedB = await AsyncStorage.getItem(BEHAVIOR_KEY);
      if (storedB) setBehaviorPresets(JSON.parse(storedB));
    } catch {}
  };

  const savePresets = async (newPresets: Preset[]) => {
    try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newPresets)); } catch {}
  };

  const saveBehaviorPresets = async (newPresets: Preset[]) => {
    try { await AsyncStorage.setItem(BEHAVIOR_KEY, JSON.stringify(newPresets)); } catch {}
  };

  const isBehaviorTab = tab === 'behavior';
  const currentPresets = isBehaviorTab ? behaviorPresets : presets;

  const handleAdd = async () => {
    if (!phraseText.trim()) return;
    let updated: Preset[];
    const entry: Preset = {
      id: editId || Date.now().toString(),
      phrase: phraseText.trim(),
      trigger: triggerText.trim(),
      isBehavior: isBehaviorTab,
    };
    if (editId) {
      updated = currentPresets.map(p => p.id === editId ? entry : p);
      setEditId(null);
    } else {
      updated = [...currentPresets, entry];
    }
    if (isBehaviorTab) {
      setBehaviorPresets(updated);
      await saveBehaviorPresets(updated);
    } else {
      setPresets(updated);
      await savePresets(updated);
    }
    setPhraseText(''); setTriggerText('');
    setScreen('list');
  };

  const handleDelete = async (id: string) => {
    const updated = currentPresets.filter(p => p.id !== id);
    if (isBehaviorTab) { setBehaviorPresets(updated); await saveBehaviorPresets(updated); }
    else { setPresets(updated); await savePresets(updated); }
    setMenuOpenId(null);
  };

  const handleEdit = (preset: Preset) => {
    setEditId(preset.id);
    setPhraseText(preset.phrase);
    setTriggerText(preset.trigger);
    setMenuOpenId(null);
    setScreen('add');
  };

  const handleSelectExample = (ex: string) => {
    setPhraseText(ex);
    setScreen('add');
  };

  const filteredPresets = currentPresets.filter(p =>
    !searchText || p.phrase.toLowerCase().includes(searchText.toLowerCase()) || p.trigger.toLowerCase().includes(searchText.toLowerCase())
  );

  // Styling tokens
  const bg = isDark ? '#1C1C1E' : '#F2F2F7';
  const cardBg = isDark ? '#2C2C2E' : '#FFFFFF';
  const inputBg = isDark ? '#3A3A3C' : '#E5E5EA';
  const textC = isDark ? '#FFFFFF' : '#000000';
  const subC = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)';
  const borderC = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={isDark ? 30 : 20} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.35)' }]} />
        )}
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />

        <View style={{ backgroundColor: bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, minHeight: SH * 0.7, maxHeight: SH * 0.92, paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 24 }}>
          {/* Handle */}
          <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)' }} />
          </View>

          {/* ── LIST SCREEN ── */}
          {screen === 'list' && (
            <>
              {/* Tab selector */}
              <View style={{ flexDirection: 'row', backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA', borderRadius: 12, padding: 3, marginBottom: 16 }}>
                {(['quick', 'behavior'] as const).map(t => (
                  <TouchableOpacity
                    key={t}
                    style={{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', backgroundColor: tab === t ? (isDark ? '#3A3A3C' : '#FFFFFF') : 'transparent' }}
                    onPress={() => setTab(t)}
                  >
                    <Text style={{ color: tab === t ? textC : subC, fontWeight: tab === t ? '700' : '500', fontSize: 14 }}>
                      {t === 'quick' ? 'Quick Phrases' : 'AI Behavior'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {tab === 'behavior' && (
                <View style={{ backgroundColor: isDark ? 'rgba(255,159,10,0.12)' : 'rgba(255,159,10,0.1)', borderRadius: 12, padding: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                  <Ionicons name="information-circle" size={18} color="#FF9F0A" style={{ marginTop: 1 }} />
                  <Text style={{ color: '#FF9F0A', fontSize: 13, lineHeight: 19, flex: 1 }}>
                    {'Behavior presets are always sent to the AI as system instructions. Example: "Never use emojis".'}
                  </Text>
                </View>
              )}

              {/* Search + Add row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: inputBg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }}>
                  <Ionicons name="search" size={16} color={subC} />
                  <TextInput style={{ flex: 1, fontSize: 15, color: textC }} placeholder="Search" placeholderTextColor={subC} value={searchText} onChangeText={setSearchText} />
                </View>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 }}
                  onPress={() => { setEditId(null); setPhraseText(''); setTriggerText(''); setScreen('add'); }}
                >
                  <Ionicons name="add" size={16} color="#FFF" />
                  <Text style={{ fontSize: 15, color: '#FFF', fontWeight: '600' }}>Add</Text>
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                {filteredPresets.length === 0 ? (
                  <View style={{ alignItems: 'center', paddingTop: 60 }}>
                    <Ionicons name={tab === 'behavior' ? 'settings-outline' : 'chatbubble-outline'} size={48} color={subC} />
                    <Text style={{ color: subC, fontSize: 15, marginTop: 14, marginBottom: 20, textAlign: 'center' }}>
                      {tab === 'behavior' ? 'No behavior rules yet' : 'No quick phrases yet'}
                    </Text>
                    <TouchableOpacity
                      style={{ backgroundColor: colors.primary, borderRadius: 20, paddingHorizontal: 24, paddingVertical: 10 }}
                      onPress={() => { setEditId(null); setPhraseText(''); setTriggerText(''); setScreen('add'); }}
                    >
                      <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '600' }}>Add</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  filteredPresets.map((preset) => (
                    <View key={preset.id} style={{ backgroundColor: cardBg, borderRadius: 14, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'flex-start', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: isDark ? 0 : 0.06, shadowRadius: 4, elevation: isDark ? 0 : 2 }}>
                      <TouchableOpacity style={{ flex: 1 }} onPress={() => { if (tab === 'quick') { onSelectPreset(preset.phrase); onClose(); } }} activeOpacity={tab === 'quick' ? 0.7 : 1}>
                        {tab === 'behavior' && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                            <Ionicons name="shield-checkmark" size={12} color={colors.primary} />
                            <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>ALWAYS ACTIVE</Text>
                          </View>
                        )}
                        <Text style={{ color: textC, fontSize: 14, lineHeight: 20 }} numberOfLines={3}>{preset.phrase}</Text>
                        {preset.trigger ? <Text style={{ color: subC, fontSize: 12, marginTop: 4 }}>/{preset.trigger}</Text> : null}
                      </TouchableOpacity>
                      <TouchableOpacity style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginLeft: 8 }} onPress={() => setMenuOpenId(menuOpenId === preset.id ? null : preset.id)}>
                        <Ionicons name="ellipsis-horizontal" size={18} color={subC} />
                      </TouchableOpacity>
                      {menuOpenId === preset.id && (
                        <View style={{ position: 'absolute', right: 10, top: 44, backgroundColor: isDark ? '#3A3A3C' : '#FFFFFF', borderRadius: 12, overflow: 'hidden', zIndex: 100, minWidth: 130, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 10 }}>
                          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14 }} onPress={() => handleEdit(preset)}>
                            <Ionicons name="pencil-outline" size={18} color={textC} />
                            <Text style={{ color: textC, fontSize: 15, fontWeight: '500' }}>Edit</Text>
                          </TouchableOpacity>
                          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: borderC }} />
                          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14 }} onPress={() => handleDelete(preset.id)}>
                            <Ionicons name="trash-outline" size={18} color="#FF453A" />
                            <Text style={{ color: '#FF453A', fontSize: 15, fontWeight: '500' }}>Delete</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  ))
                )}
                <View style={{ height: 40 }} />
              </ScrollView>
            </>
          )}

          {/* ── ADD SCREEN ── */}
          {screen === 'add' && (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingTop: 4 }}>
                <TouchableOpacity onPress={() => setScreen('list')} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="chevron-back" size={22} color={textC} />
                </TouchableOpacity>
                <Text style={{ fontSize: 17, fontWeight: '600', color: textC, flex: 1, textAlign: 'center' }}>
                  {editId ? 'Edit' : (isBehaviorTab ? 'Add Behavior Rule' : 'Add Quick Phrase')}
                </Text>
                <TouchableOpacity
                  style={{ backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8, opacity: phraseText.trim() ? 1 : 0.4 }}
                  onPress={handleAdd}
                  disabled={!phraseText.trim()}
                >
                  <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '700' }}>Save</Text>
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
                <View style={{ backgroundColor: cardBg, borderRadius: 14, padding: 16, marginBottom: 20, minHeight: 160, borderLeftWidth: 3, borderLeftColor: isBehaviorTab ? '#FF9F0A' : colors.primary }}>
                  <Text style={{ color: subC, fontSize: 13, lineHeight: 20, marginBottom: 10 }}>
                    {isBehaviorTab
                      ? 'Write a rule for how the AI should behave in all messages.\n'
                      : 'Set a frequently used message as a quick phrase. '}
                    <Text style={{ color: colors.primary, fontWeight: '600' }} onPress={() => setScreen('examples')}>
                      {isBehaviorTab ? 'See examples' : 'Example for reference.'}
                    </Text>
                  </Text>
                  <TextInput
                    style={{ fontSize: 15, color: textC, minHeight: 80, textAlignVertical: 'top' }}
                    value={phraseText}
                    onChangeText={setPhraseText}
                    placeholder={isBehaviorTab ? 'e.g. Never use emojis in any response.' : 'Enter quick phrase...'}
                    placeholderTextColor={subC}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    autoFocus
                  />
                </View>

                {!isBehaviorTab && (
                  <>
                    <Text style={{ fontSize: 14, color: subC, marginBottom: 10, fontWeight: '500' }}>Trigger Word (Optional)</Text>
                    <View style={{ backgroundColor: cardBg, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
                      <TextInput
                        style={{ flex: 1, fontSize: 15, color: textC }}
                        value={triggerText}
                        onChangeText={(t) => setTriggerText(t.slice(0, 20))}
                        placeholder="Trigger word to quickly access this phrase"
                        placeholderTextColor={subC}
                        autoCapitalize="none"
                        maxLength={20}
                      />
                      <Text style={{ color: subC, fontSize: 12 }}>{triggerText.length}/20</Text>
                    </View>
                  </>
                )}
                <View style={{ height: 60 }} />
              </ScrollView>
            </>
          )}

          {/* ── EXAMPLES SCREEN ── */}
          {screen === 'examples' && (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingTop: 4 }}>
                <TouchableOpacity onPress={() => setScreen('add')} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="chevron-back" size={22} color={textC} />
                </TouchableOpacity>
                <Text style={{ fontSize: 17, fontWeight: '600', color: textC, flex: 1, textAlign: 'center' }}>Examples</Text>
                <View style={{ width: 36 }} />
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                {(isBehaviorTab ? BEHAVIOR_EXAMPLES : QUICK_EXAMPLES).map((ex, i) => (
                  <TouchableOpacity
                    key={i}
                    style={{ backgroundColor: cardBg, borderRadius: 14, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 }}
                    onPress={() => handleSelectExample(ex)}
                    activeOpacity={0.7}
                  >
                    <Text style={{ flex: 1, color: textC, fontSize: 14, lineHeight: 20 }}>{ex}</Text>
                    <Ionicons name="chevron-forward" size={18} color={subC} />
                  </TouchableOpacity>
                ))}
                <View style={{ height: 40 }} />
              </ScrollView>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

/** Load all active behavior presets so home.tsx can prepend them to every message */
export async function loadBehaviorPresets(): Promise<string[]> {
  try {
    const stored = await AsyncStorage.getItem('haitian_ai_behavior_presets_v2');
    if (!stored) return [];
    const presets: Array<{ phrase: string }> = JSON.parse(stored);
    return presets.map(p => p.phrase).filter(Boolean);
  } catch { return []; }
}
