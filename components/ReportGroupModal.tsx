import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Platform, TextInput, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const REPORT_CATEGORIES = [
  { label: 'Violence & self-harm', subs: ['Threats or incitement to violence', 'Weapons', 'Suicide & self-harm', 'Human trafficking', 'Terrorism'] },
  { label: 'Sexual exploitation & abuse', subs: ['Non-consensual intimate images', 'Sexual extortion'] },
  { label: 'Bullying & harassment', subs: ['Targeted harassment', 'Hate speech', 'Doxxing'] },
  { label: 'Spam, fraud & deception', subs: ['Phishing', 'Scams', 'Misinformation'] },
  { label: 'Privacy violation', subs: ['Sharing personal info', 'Non-consensual recording'] },
  { label: 'Something else', subs: ['Other concern'] },
];

interface ReportGroupModalProps {
  visible: boolean;
  onClose: () => void;
  isDark: boolean;
}

export function ReportGroupModal({ visible, onClose, isDark }: ReportGroupModalProps) {
  const [step, setStep] = useState<'main' | 'sub' | 'detail'>('main');
  const [selCategory, setSelCategory] = useState<typeof REPORT_CATEGORIES[0] | null>(null);
  const [selSub, setSelSub] = useState('');
  const [detail, setDetail] = useState('');

  useEffect(() => {
    if (!visible) { setStep('main'); setSelCategory(null); setSelSub(''); setDetail(''); }
  }, [visible]);

  const bg = isDark ? '#111113' : '#F2F2F7';
  const cardBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const textC = isDark ? '#FFF' : '#000';
  const subC = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';
  const borderC = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 56 : 28, paddingHorizontal: 16, paddingBottom: 16 }}>
          {step !== 'main' ? (
            <TouchableOpacity onPress={() => setStep(step === 'detail' ? 'sub' : 'main')} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Ionicons name="chevron-back" size={20} color={textC} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={onClose} style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, marginRight: 12 }}>
              <Text style={{ color: textC, fontSize: 15, fontWeight: '500' }}>Cancel</Text>
            </TouchableOpacity>
          )}
          <Text style={{ flex: 1, fontSize: 17, fontWeight: '700', color: textC, textAlign: 'center', marginRight: step === 'detail' ? 0 : 48 }}>Report conversation</Text>
          {step === 'detail' ? (
            <TouchableOpacity onPress={onClose} style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 }}>
              <Text style={{ color: textC, fontSize: 15, fontWeight: '600' }}>Submit</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {step === 'main' && (
          <>
            <Text style={{ color: subC, fontSize: 15, textAlign: 'center', marginBottom: 24, paddingHorizontal: 24 }}>Why are you reporting this conversation?</Text>
            <View style={{ marginHorizontal: 16, borderRadius: 18, overflow: 'hidden', backgroundColor: cardBg }}>
              {REPORT_CATEGORIES.map((cat, i) => (
                <TouchableOpacity key={cat.label} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 16, borderTopWidth: i > 0 ? StyleSheet.hairlineWidth : 0, borderTopColor: borderC }} onPress={() => { setSelCategory(cat); setStep('sub'); }}>
                  <Text style={{ color: textC, fontSize: 16 }}>{cat.label}</Text>
                  <Ionicons name="chevron-forward" size={18} color={subC} />
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
        {step === 'sub' && selCategory && (
          <>
            <Text style={{ color: textC, fontSize: 17, fontWeight: '600', textAlign: 'center', marginBottom: 20 }}>{selCategory.label}</Text>
            <View style={{ marginHorizontal: 16, borderRadius: 18, overflow: 'hidden', backgroundColor: cardBg }}>
              {selCategory.subs.map((sub, i) => (
                <TouchableOpacity key={sub} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 16, borderTopWidth: i > 0 ? StyleSheet.hairlineWidth : 0, borderTopColor: borderC }} onPress={() => { setSelSub(sub); setStep('detail'); }}>
                  <Text style={{ color: textC, fontSize: 16 }}>{sub}</Text>
                  <Ionicons name="chevron-forward" size={18} color={subC} />
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
        {step === 'detail' && (
          <>
            <Text style={{ color: textC, fontSize: 17, fontWeight: '600', textAlign: 'center', marginBottom: 20, paddingHorizontal: 24 }}>{selSub}</Text>
            <View style={{ marginHorizontal: 16, borderRadius: 18, overflow: 'hidden', backgroundColor: cardBg, padding: 16 }}>
              <TextInput style={{ color: textC, fontSize: 16, minHeight: 120, textAlignVertical: 'top' }} placeholder="Please provide more details" placeholderTextColor={subC} value={detail} onChangeText={setDetail} multiline autoFocus />
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}
