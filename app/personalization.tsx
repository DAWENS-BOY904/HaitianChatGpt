import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Modal,
  Animated,
  Easing,
  StatusBar,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useTheme } from '../hooks/useTheme';
import { useSettings } from '../hooks/useSettings';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

// ── Types ──────────────────────────────────────────────────────────────────

type ToneOption = {
  value: string;
  label: string;
  description: string;
};

type LevelOption = {
  value: 'more' | 'default' | 'less' | 'none';
  label: string;
  description?: string;
};

// ── Data ───────────────────────────────────────────────────────────────────

const TONE_OPTIONS: ToneOption[] = [
  { value: 'default', label: 'Default', description: 'Preset style and tone' },
  { value: 'professional', label: 'Professional', description: 'Polished and precise' },
  { value: 'friendly', label: 'Friendly', description: 'Warm and chatty' },
  { value: 'candid', label: 'Candid', description: 'Direct and encouraging' },
  { value: 'quirky', label: 'Quirky', description: 'Playful and imaginative' },
  { value: 'efficient', label: 'Efficient', description: 'Concise and plain' },
  { value: 'cynical', label: 'Cynical', description: 'Critical and sarcastic' },
];

const LEVEL_OPTIONS: LevelOption[] = [
  { value: 'more', label: 'More' },
  { value: 'default', label: 'Default' },
  { value: 'less', label: 'Less' },
];

const EMOJI_OPTIONS: LevelOption[] = [
  { value: 'more', label: 'More', description: 'Use more emoji' },
  { value: 'default', label: 'Default' },
  { value: 'less', label: 'Less', description: "Don't use as many emoji" },
  { value: 'none', label: 'None', description: 'Never use emoji' },
];

// ── Selector Modal ─────────────────────────────────────────────────────────

function SelectorModal<T extends string>({
  visible,
  title,
  options,
  currentValue,
  onSelect,
  onClose,
  isDark,
}: {
  visible: boolean;
  title: string;
  options: Array<{ value: T; label: string; description?: string }>;
  currentValue: T;
  onSelect: (value: T) => void;
  onClose: () => void;
  isDark: boolean;
}) {
  const slideAnim = useRef(new Animated.Value(300)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacityAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 220, friction: 22, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacityAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 300, duration: 150, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const bg = isDark ? 'rgba(44,44,46,0.98)' : 'rgba(255,255,255,0.98)';
  const textC = isDark ? '#FFFFFF' : '#000000';
  const subC = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)';
  const divC = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
  const checkC = isDark ? '#FFFFFF' : '#000000';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={{ flex: 1, opacity: opacityAnim }}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose}>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={isDark ? 30 : 20} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)' }]} />
          )}
        </TouchableOpacity>

        {/* Dropdown card — positioned center-right like ChatGPT */}
        <Animated.View
          style={{
            position: 'absolute',
            right: 20,
            top: '30%',
            width: 260,
            borderRadius: 18,
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: isDark ? 0.5 : 0.18,
            shadowRadius: 24,
            elevation: 24,
            transform: [{ translateY: slideAnim }],
          }}
        >
          {Platform.OS === 'ios' ? (
            <BlurView intensity={isDark ? 88 : 78} tint={isDark ? 'dark' : 'extraLight'} style={{ borderRadius: 18, overflow: 'hidden' }}>
              {options.map((opt, i) => {
                const isSelected = currentValue === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      paddingHorizontal: 18,
                      paddingVertical: 14,
                      borderTopWidth: i > 0 ? StyleSheet.hairlineWidth : 0,
                      borderTopColor: divC,
                      gap: 12,
                    }}
                    activeOpacity={0.65}
                    onPress={() => {
                      Haptics.selectionAsync();
                      onSelect(opt.value);
                      onClose();
                    }}
                  >
                    <View style={{ width: 20, alignItems: 'center', paddingTop: 2 }}>
                      {isSelected && <Ionicons name="checkmark" size={16} color={checkC} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: textC, fontSize: 16, fontWeight: '400' }}>{opt.label}</Text>
                      {opt.description ? (
                        <Text style={{ color: subC, fontSize: 13, marginTop: 2 }}>{opt.description}</Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </BlurView>
          ) : (
            <View style={{ backgroundColor: bg, borderRadius: 18, overflow: 'hidden' }}>
              {options.map((opt, i) => {
                const isSelected = currentValue === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      paddingHorizontal: 18,
                      paddingVertical: 14,
                      borderTopWidth: i > 0 ? StyleSheet.hairlineWidth : 0,
                      borderTopColor: divC,
                      gap: 12,
                    }}
                    activeOpacity={0.65}
                    onPress={() => {
                      Haptics.selectionAsync();
                      onSelect(opt.value);
                      onClose();
                    }}
                  >
                    <View style={{ width: 20, alignItems: 'center', paddingTop: 2 }}>
                      {isSelected && <Ionicons name="checkmark" size={16} color={checkC} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: textC, fontSize: 16, fontWeight: '400' }}>{opt.label}</Text>
                      {opt.description ? (
                        <Text style={{ color: subC, fontSize: 13, marginTop: 2 }}>{opt.description}</Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ── Custom Instructions Full-Screen Modal ──────────────────────────────────

function CustomInstructionsModal({
  visible,
  value,
  onSave,
  onClose,
  isDark,
}: {
  visible: boolean;
  value: string;
  onSave: (text: string) => void;
  onClose: () => void;
  isDark: boolean;
}) {
  const [text, setText] = useState(value);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) setText(value);
  }, [visible, value]);

  const bg = isDark ? '#000000' : '#FFFFFF';
  const textC = isDark ? '#FFFFFF' : '#000000';
  const subC = isDark ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.35)';

  return (
    <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: bg }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={bg} />
        <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 12 }}>
          <Text style={{ color: textC, fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 0 }}>
            Custom instructions
          </Text>
        </View>

        <TextInput
          style={{
            flex: 1,
            color: textC,
            fontSize: 17,
            lineHeight: 26,
            paddingHorizontal: 24,
            paddingTop: 20,
            textAlignVertical: 'top',
          }}
          value={text}
          onChangeText={setText}
          placeholder={"Share anything else you'd like Dawinix to consider in its response."}
          placeholderTextColor={subC}
          multiline
          autoFocus
        />

        {/* Confirm button bottom-right */}
        <View style={{ position: 'absolute', bottom: insets.bottom + 20, right: 24 }}>
          <TouchableOpacity
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: textC,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 8,
              elevation: 6,
            }}
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              onSave(text.trim());
              onClose();
            }}
          >
            <Ionicons name="checkmark" size={22} color={isDark ? '#000' : '#FFF'} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Row component ──────────────────────────────────────────────────────────

function SettingRow({
  label,
  currentLabel,
  onPress,
  isDark,
  isLast = false,
}: {
  label: string;
  currentLabel: string;
  onPress: () => void;
  isDark: boolean;
  isLast?: boolean;
}) {
  const textC = isDark ? '#FFFFFF' : '#000000';
  const subC = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)';
  const divC = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';

  return (
    <TouchableOpacity
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 18,
        paddingVertical: 16,
        borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: divC,
      }}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      activeOpacity={0.65}
    >
      <Text style={{ color: textC, fontSize: 16, fontWeight: '400' }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Text style={{ color: subC, fontSize: 16 }}>{currentLabel}</Text>
        <Ionicons name="chevron-up-circle-outline" size={15} color={subC} style={{ opacity: 0.7 }} />
      </View>
    </TouchableOpacity>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────

export default function PersonalizationScreen() {
  const { isDark } = useTheme();
  const { settings, updateSetting } = useSettings();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Local state for pending changes (saved on "Save" button press)
  const [baseTone, setBaseTone] = useState<string>(settings.baseTone || 'default');
  const [warmth, setWarmth] = useState<string>((settings as any).warmth || 'default');
  const [enthusiasm, setEnthusiasm] = useState<string>((settings as any).enthusiasm || 'default');
  const [headerLists, setHeaderLists] = useState<string>((settings as any).headerLists || 'default');
  const [emoji, setEmoji] = useState<string>((settings as any).emoji || 'default');
  const [customInstructions, setCustomInstructions] = useState<string>(settings.customInstructions || '');

  // Modal visibility states
  const [toneModalVisible, setToneModalVisible] = useState(false);
  const [warmthModalVisible, setWarmthModalVisible] = useState(false);
  const [enthusiasmModalVisible, setEnthusiasmModalVisible] = useState(false);
  const [headerModalVisible, setHeaderModalVisible] = useState(false);
  const [emojiModalVisible, setEmojiModalVisible] = useState(false);
  const [customInstrModalVisible, setCustomInstrModalVisible] = useState(false);

  const isDirty = (
    baseTone !== (settings.baseTone || 'default') ||
    warmth !== ((settings as any).warmth || 'default') ||
    enthusiasm !== ((settings as any).enthusiasm || 'default') ||
    headerLists !== ((settings as any).headerLists || 'default') ||
    emoji !== ((settings as any).emoji || 'default') ||
    customInstructions !== (settings.customInstructions || '')
  );

  const handleSave = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await updateSetting('baseTone', baseTone);
    await updateSetting('warmth' as any, warmth);
    await updateSetting('enthusiasm' as any, enthusiasm);
    await updateSetting('headerLists' as any, headerLists);
    await updateSetting('emoji' as any, emoji);
    await updateSetting('customInstructions', customInstructions);
    router.back();
  };

  const getLevelLabel = (value: string): string => {
    switch (value) {
      case 'more': return 'More';
      case 'less': return 'Less';
      case 'none': return 'None';
      default: return 'Default';
    }
  };

  const getToneLabel = (value: string): string => {
    return TONE_OPTIONS.find(t => t.value === value)?.label || 'Default';
  };

  const bg = isDark ? '#000000' : '#EFEFEF';
  const cardBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const textC = isDark ? '#FFFFFF' : '#000000';
  const subC = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)';

  return (
    <View style={{ flex: 1, backgroundColor: bg, paddingTop: insets.top }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={bg} />

      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
      }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={20} color={textC} />
        </TouchableOpacity>

        <Text style={{ color: textC, fontSize: 17, fontWeight: '700' }}>Personalization</Text>

        <TouchableOpacity
          onPress={handleSave}
          style={{
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 20,
            backgroundColor: isDirty ? (isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)') : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'),
          }}
          activeOpacity={0.7}
        >
          <Text style={{
            fontSize: 16,
            fontWeight: '600',
            color: isDirty ? textC : subC,
          }}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 40 }}
      >
        {/* Base style and tone — standalone card */}
        <View style={{
          backgroundColor: cardBg,
          borderRadius: 16,
          overflow: 'hidden',
          marginBottom: 16,
          marginTop: 8,
        }}>
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 18,
              paddingVertical: 18,
            }}
            onPress={() => { Haptics.selectionAsync(); setToneModalVisible(true); }}
            activeOpacity={0.65}
          >
            <Text style={{ color: textC, fontSize: 16, fontWeight: '400' }}>Base style and tone</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ color: subC, fontSize: 16 }}>{getToneLabel(baseTone)}</Text>
              <Ionicons name="chevron-up-circle-outline" size={15} color={subC} style={{ opacity: 0.7 }} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Warmth / Enthusiasm / Header / Emoji — grouped card */}
        <View style={{
          backgroundColor: cardBg,
          borderRadius: 16,
          overflow: 'hidden',
          marginBottom: 24,
        }}>
          <SettingRow
            label="Warmth"
            currentLabel={getLevelLabel(warmth)}
            onPress={() => setWarmthModalVisible(true)}
            isDark={isDark}
          />
          <SettingRow
            label="Enthusiasm"
            currentLabel={getLevelLabel(enthusiasm)}
            onPress={() => setEnthusiasmModalVisible(true)}
            isDark={isDark}
          />
          <SettingRow
            label="Header and lists"
            currentLabel={getLevelLabel(headerLists)}
            onPress={() => setHeaderModalVisible(true)}
            isDark={isDark}
          />
          <SettingRow
            label="Emoji"
            currentLabel={getLevelLabel(emoji)}
            onPress={() => setEmojiModalVisible(true)}
            isDark={isDark}
            isLast
          />
        </View>

        {/* Custom instructions section label */}
        <Text style={{
          color: subC,
          fontSize: 14,
          fontWeight: '600',
          marginBottom: 8,
          paddingHorizontal: 4,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
        }}>
          Custom instructions
        </Text>

        {/* Custom Instructions input row */}
        <TouchableOpacity
          style={{
            backgroundColor: cardBg,
            borderRadius: 16,
            paddingHorizontal: 18,
            paddingVertical: 16,
            minHeight: 56,
            justifyContent: 'center',
          }}
          onPress={() => { Haptics.selectionAsync(); setCustomInstrModalVisible(true); }}
          activeOpacity={0.7}
        >
          <Text
            style={{
              color: customInstructions ? textC : subC,
              fontSize: 16,
              lineHeight: 22,
            }}
            numberOfLines={2}
          >
            {customInstructions || "Share anything else you'd like Dawinix to consider i..."}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Tone Selector */}
      <SelectorModal
        visible={toneModalVisible}
        title="Base style and tone"
        options={TONE_OPTIONS}
        currentValue={baseTone}
        onSelect={setBaseTone}
        onClose={() => setToneModalVisible(false)}
        isDark={isDark}
      />

      {/* Warmth Selector */}
      <SelectorModal
        visible={warmthModalVisible}
        title="Warmth"
        options={LEVEL_OPTIONS.map(o => ({
          ...o,
          description: o.value === 'more' ? 'Warmer and more personal' : o.value === 'less' ? 'Cooler and more neutral' : undefined,
        }))}
        currentValue={warmth}
        onSelect={setWarmth}
        onClose={() => setWarmthModalVisible(false)}
        isDark={isDark}
      />

      {/* Enthusiasm Selector */}
      <SelectorModal
        visible={enthusiasmModalVisible}
        title="Enthusiasm"
        options={LEVEL_OPTIONS.map(o => ({
          ...o,
          description: o.value === 'more' ? 'More energetic replies' : o.value === 'less' ? 'Calmer and reserved' : undefined,
        }))}
        currentValue={enthusiasm}
        onSelect={setEnthusiasm}
        onClose={() => setEnthusiasmModalVisible(false)}
        isDark={isDark}
      />

      {/* Header and lists Selector */}
      <SelectorModal
        visible={headerModalVisible}
        title="Header and lists"
        options={LEVEL_OPTIONS.map(o => ({
          ...o,
          description: o.value === 'more' ? 'Structured with sections and lists' : o.value === 'less' ? 'Minimal formatting' : undefined,
        }))}
        currentValue={headerLists}
        onSelect={setHeaderLists}
        onClose={() => setHeaderModalVisible(false)}
        isDark={isDark}
      />

      {/* Emoji Selector */}
      <SelectorModal
        visible={emojiModalVisible}
        title="Emoji"
        options={EMOJI_OPTIONS}
        currentValue={emoji}
        onSelect={setEmoji}
        onClose={() => setEmojiModalVisible(false)}
        isDark={isDark}
      />

      {/* Custom Instructions Full-Screen Modal */}
      <CustomInstructionsModal
        visible={customInstrModalVisible}
        value={customInstructions}
        onSave={setCustomInstructions}
        onClose={() => setCustomInstrModalVisible(false)}
        isDark={isDark}
      />
    </View>
  );
}
