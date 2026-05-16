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
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SW } = Dimensions.get('window');

interface Preset {
  id: string;
  phrase: string;
  trigger: string;
}

interface PresetsModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectPreset: (phrase: string) => void;
}

const EXAMPLES = [
  "Haitian AI, please summarize the main points of the article in one concise sentence.",
  "Translate the following text to English and fix any grammar mistakes.",
  "Write a professional email responding to this message:",
  "Create a step-by-step guide for:",
  "Explain this concept in simple terms as if I'm 10 years old:",
  "Generate 5 creative ideas for:",
  "Review and improve this code:",
  "Create a quiz about:",
];

const STORAGE_KEY = 'haitian_ai_presets';

export function PresetsModal({ visible, onClose, onSelectPreset }: PresetsModalProps) {
  const [screen, setScreen] = useState<'list' | 'add' | 'examples'>('list');
  const [presets, setPresets] = useState<Preset[]>([]);
  const [phraseText, setPhraseText] = useState('');
  const [triggerText, setTriggerText] = useState('');
  const [searchText, setSearchText] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      loadPresets();
      setScreen('list');
    }
  }, [visible]);

  const loadPresets = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) setPresets(JSON.parse(stored));
    } catch {}
  };

  const savePresets = async (newPresets: Preset[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newPresets));
    } catch {}
  };

  const handleAdd = async () => {
    if (!phraseText.trim()) return;
    let newPresets: Preset[];
    if (editId) {
      newPresets = presets.map(p => p.id === editId ? { ...p, phrase: phraseText.trim(), trigger: triggerText.trim() } : p);
      setEditId(null);
    } else {
      const newPreset: Preset = {
        id: Date.now().toString(),
        phrase: phraseText.trim(),
        trigger: triggerText.trim(),
      };
      newPresets = [...presets, newPreset];
    }
    setPresets(newPresets);
    await savePresets(newPresets);
    setPhraseText('');
    setTriggerText('');
    setScreen('list');
  };

  const handleDelete = async (id: string) => {
    const newPresets = presets.filter(p => p.id !== id);
    setPresets(newPresets);
    await savePresets(newPresets);
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

  const filteredPresets = presets.filter(p =>
    !searchText || p.phrase.toLowerCase().includes(searchText.toLowerCase()) || p.trigger.toLowerCase().includes(searchText.toLowerCase())
  );

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={s.sheet}>
          {/* Handle */}
          <View style={s.handleWrap}><View style={s.handle} /></View>

          {/* ── LIST SCREEN ── */}
          {screen === 'list' && (
            <>
              <Text style={s.sheetTitle}>Common Phrases</Text>

              {/* Search + Add row */}
              <View style={s.searchRow}>
                <View style={s.searchBox}>
                  <Ionicons name="search" size={16} color="rgba(255,255,255,0.4)" />
                  <TextInput
                    style={s.searchInput}
                    placeholder="Search"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={searchText}
                    onChangeText={setSearchText}
                  />
                </View>
                <TouchableOpacity style={s.addBtn} onPress={() => { setEditId(null); setPhraseText(''); setTriggerText(''); setScreen('add'); }}>
                  <Ionicons name="add" size={16} color="#FFF" />
                  <Text style={s.addBtnText}>Add</Text>
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                {filteredPresets.length === 0 ? (
                  <View style={s.emptyState}>
                    <Text style={s.emptyText}>No common phrases added</Text>
                    <TouchableOpacity style={s.emptyAddBtn} onPress={() => { setEditId(null); setPhraseText(''); setTriggerText(''); setScreen('add'); }}>
                      <Text style={s.emptyAddBtnText}>Add</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  filteredPresets.map((preset) => (
                    <View key={preset.id} style={s.presetCard}>
                      <TouchableOpacity style={s.presetTap} onPress={() => { onSelectPreset(preset.phrase); onClose(); }} activeOpacity={0.7}>
                        <Text style={s.presetPhrase} numberOfLines={2}>{preset.phrase}</Text>
                        {preset.trigger ? <Text style={s.presetTrigger}>/{preset.trigger}</Text> : null}
                      </TouchableOpacity>
                      <TouchableOpacity style={s.menuDots} onPress={() => setMenuOpenId(menuOpenId === preset.id ? null : preset.id)}>
                        <Ionicons name="ellipsis-horizontal" size={18} color="rgba(255,255,255,0.5)" />
                      </TouchableOpacity>
                      {menuOpenId === preset.id && (
                        <View style={s.dropMenu}>
                          <TouchableOpacity style={s.dropItem} onPress={() => handleEdit(preset)}>
                            <Ionicons name="pencil-outline" size={18} color="#FFF" />
                            <Text style={s.dropItemText}>Edit</Text>
                          </TouchableOpacity>
                          <View style={s.dropDivider} />
                          <TouchableOpacity style={s.dropItem} onPress={() => handleDelete(preset.id)}>
                            <Ionicons name="trash-outline" size={18} color="#FF453A" />
                            <Text style={[s.dropItemText, { color: '#FF453A' }]}>Delete</Text>
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
              <View style={s.addHeader}>
                <TouchableOpacity onPress={() => setScreen('list')} style={s.backBtn}>
                  <Ionicons name="chevron-back" size={22} color="#FFF" />
                </TouchableOpacity>
                <Text style={s.sheetTitle}>{editId ? 'Edit Phrase' : 'Add Common Phrase'}</Text>
                <TouchableOpacity style={s.completeBtn} onPress={handleAdd} disabled={!phraseText.trim()}>
                  <Text style={[s.completeBtnText, !phraseText.trim() && { opacity: 0.4 }]}>Complete</Text>
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
                {/* Phrase area */}
                <View style={s.phraseBox}>
                  <View style={s.blueBorder} />
                  <Text style={s.phraseLabel}>
                    {'Set frequently sent messages to Haitian AI as common phrases '}
                    <Text style={s.exampleLink} onPress={() => setScreen('examples')}>Example for reference.</Text>
                  </Text>
                  <TextInput
                    style={s.phraseInput}
                    value={phraseText}
                    onChangeText={setPhraseText}
                    placeholder="Enter common phrase..."
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    autoFocus
                  />
                </View>

                <Text style={s.triggerLabel}>Trigger Word (Optional)</Text>
                <View style={s.triggerBox}>
                  <TextInput
                    style={s.triggerInput}
                    value={triggerText}
                    onChangeText={(t) => setTriggerText(t.slice(0, 20))}
                    placeholder="Enter the trigger word to quickly access this phrase"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    autoCapitalize="none"
                    maxLength={20}
                  />
                  <Text style={s.triggerCount}>{triggerText.length}/20</Text>
                </View>
                <View style={{ height: 60 }} />
              </ScrollView>
            </>
          )}

          {/* ── EXAMPLES SCREEN ── */}
          {screen === 'examples' && (
            <>
              <View style={s.addHeader}>
                <TouchableOpacity onPress={() => setScreen('add')} style={s.backBtn}>
                  <Ionicons name="chevron-back" size={22} color="#FFF" />
                </TouchableOpacity>
                <Text style={s.sheetTitle}>Examples</Text>
                <View style={{ width: 80 }} />
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                {EXAMPLES.map((ex, i) => (
                  <TouchableOpacity key={i} style={s.exampleCard} onPress={() => handleSelectExample(ex)} activeOpacity={0.7}>
                    <Text style={s.exampleText}>{ex}</Text>
                    <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
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

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: {
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: Dimensions.get('window').height * 0.7,
    maxHeight: Dimensions.get('window').height * 0.92,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  handleWrap: { alignItems: 'center', paddingTop: 12, paddingBottom: 4 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' },
  sheetTitle: { fontSize: 17, fontWeight: '600', color: '#FFFFFF', textAlign: 'center', flex: 1 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#FFFFFF' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#3A3A3C',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  addBtnText: { fontSize: 15, color: '#FFFFFF', fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingTop: 80 },
  emptyText: { color: 'rgba(255,255,255,0.35)', fontSize: 15, marginBottom: 20 },
  emptyAddBtn: {
    backgroundColor: '#3A3A3C',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  emptyAddBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  presetCard: {
    backgroundColor: '#2C2C2E',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  presetTap: { flex: 1 },
  presetPhrase: { color: '#FFFFFF', fontSize: 14, lineHeight: 20 },
  presetTrigger: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 4 },
  menuDots: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  dropMenu: {
    position: 'absolute',
    right: 10,
    top: 40,
    backgroundColor: '#3A3A3C',
    borderRadius: 12,
    overflow: 'hidden',
    zIndex: 100,
    minWidth: 130,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  dropItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
  dropItemText: { color: '#FFF', fontSize: 15, fontWeight: '500' },
  dropDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.1)' },
  // Add screen
  addHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingTop: 4,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  completeBtn: {
    backgroundColor: '#4A7EFF',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  completeBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  phraseBox: {
    backgroundColor: '#2C2C2E',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    minHeight: 160,
  },
  blueBorder: { width: 3, borderRadius: 2, backgroundColor: '#4A7EFF', position: 'absolute', left: 16, top: 16, bottom: 16 },
  phraseLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 14, lineHeight: 22, marginBottom: 10, paddingLeft: 14 },
  exampleLink: { color: '#4A7EFF', fontWeight: '600' },
  phraseInput: {
    fontSize: 15,
    color: '#FFFFFF',
    minHeight: 80,
    textAlignVertical: 'top',
    paddingLeft: 14,
  },
  triggerLabel: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 10, fontWeight: '500' },
  triggerBox: {
    backgroundColor: '#2C2C2E',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  triggerInput: { flex: 1, fontSize: 15, color: '#FFFFFF' },
  triggerCount: { color: 'rgba(255,255,255,0.3)', fontSize: 12 },
  // Examples screen
  exampleCard: {
    backgroundColor: '#2C2C2E',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  exampleText: { flex: 1, color: '#FFFFFF', fontSize: 14, lineHeight: 20 },
});
