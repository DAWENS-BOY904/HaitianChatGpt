import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useAlert, getSupabaseClient } from '@/template';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ImageEditModalProps {
  visible: boolean;
  imageUrl: string;
  onClose: () => void;
  onApplyEdits: (editedImageUrl: string, prompt: string) => void;
}

// Quick-edit preset prompts
const EDIT_PRESETS = [
  { label: 'Remove background', icon: 'cut-outline', prompt: 'Remove the background completely, make it transparent or white' },
  { label: 'Make brighter', icon: 'sunny-outline', prompt: 'Make the image brighter, increase exposure and vibrancy' },
  { label: 'Cartoon style', icon: 'color-palette-outline', prompt: 'Transform this image into a colorful cartoon or animated art style' },
  { label: 'Oil painting', icon: 'brush-outline', prompt: 'Transform this image into a realistic oil painting with visible brushstrokes' },
  { label: 'B&W photo', icon: 'contrast-outline', prompt: 'Convert to dramatic black and white photography with high contrast' },
  { label: 'Blur background', icon: 'aperture-outline', prompt: 'Keep the subject sharp but blur the background with a professional bokeh effect' },
  { label: 'Add text', icon: 'text-outline', prompt: 'Add stylish text overlay or a title to this image' },
  { label: 'Vintage look', icon: 'film-outline', prompt: 'Apply a vintage retro filter with warm tones and film grain effect' },
];

export function ImageEditModal({
  visible,
  imageUrl,
  onClose,
  onApplyEdits,
}: ImageEditModalProps) {
  const { colors, isDark } = useTheme();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  const [editPrompt, setEditPrompt] = useState('');
  const [applying, setApplying] = useState(false);
  const [editedUrl, setEditedUrl] = useState<string | null>(null);
  const [editingStep, setEditingStep] = useState<'idle' | 'analyzing' | 'generating' | 'done'>('idle');

  const applyPreset = useCallback((prompt: string) => {
    setEditPrompt(prompt);
  }, []);

  const handleApply = async () => {
    const prompt = editPrompt.trim();
    if (!prompt) {
      showAlert('Error', 'Please describe the edits you want to make');
      return;
    }
    if (!imageUrl) {
      showAlert('Error', 'No image to edit');
      return;
    }

    setApplying(true);
    setEditingStep('analyzing');
    setEditedUrl(null);

    try {
      // Build AI prompt for image editing
      const editingPrompt = `You are an AI image editor. The user wants to edit an existing image.

Original image is provided as context.
Edit instruction: "${prompt}"

Please generate a new version of this image with the requested edits applied. 
Maintain the core subject and composition while applying the requested changes.
Generate a high-quality, realistic result. Do not add watermarks.`;

      // Call the chat edge function with vision + generation mode
      const { data: sessionData } = await supabase.auth.getSession();
      const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
      const token = sessionData?.session?.access_token || anonKey;
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';

      setEditingStep('generating');

      // Fetch image as base64 for edge function
      let base64Image: string | undefined;
      try {
        const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(8000) });
        if (imgRes.ok) {
          const blob = await imgRes.arrayBuffer();
          const bytes = new Uint8Array(blob);
          let binary = '';
          for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
          base64Image = (globalThis as any).btoa ? (globalThis as any).btoa(binary) : '';
        }
      } catch (_fetchErr) {
        // Will proceed without base64 — edge function uses URL
      }

      const requestBody: any = {
        messages: [
          {
            role: 'user',
            content: `[SYSTEM: The user wants to edit an image. Generate a new AI image based on this description: ${prompt}. Create a high-quality image that represents the edited version. The original image shows: ${imageUrl}]\n\nPlease create: ${prompt}`,
          },
        ],
        conversationId: 'img-edit-' + Date.now(),
        aiModel: 'google-gemini',
        isImageGeneration: true,
      };

      if (base64Image) {
        requestBody.base64Image = base64Image;
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': anonKey,
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(60000),
      });

      if (!response.ok) {
        throw new Error(`Edge function error: ${response.status}`);
      }

      // Parse streamed response for image URL
      let resultImageUrl: string | null = null;
      let textContent = '';

      const reader = response.body?.getReader();
      if (reader) {
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.trim().startsWith('data:')) continue;
            try {
              const parsed = JSON.parse(line.trim().slice(5).trim());
              if (parsed.imageUrl) resultImageUrl = parsed.imageUrl;
              if (parsed.content) textContent += parsed.content;
            } catch (_e) {}
          }
        }
      } else {
        const full = await response.text();
        for (const line of full.split('\n')) {
          if (!line.trim().startsWith('data:')) continue;
          try {
            const parsed = JSON.parse(line.trim().slice(5).trim());
            if (parsed.imageUrl) resultImageUrl = parsed.imageUrl;
            if (parsed.content) textContent += parsed.content;
          } catch (_e) {}
        }
      }

      // Extract image URL from text content if not found directly
      if (!resultImageUrl && textContent) {
        const urlMatch = textContent.match(/https?:\/\/[^\s"')]+\.(?:jpg|jpeg|png|webp|gif)/i);
        if (urlMatch) resultImageUrl = urlMatch[0];
      }

      if (resultImageUrl) {
        setEditedUrl(resultImageUrl);
        setEditingStep('done');
      } else {
        throw new Error('Image editing did not produce a result. Try a different prompt.');
      }
    } catch (error: any) {
      setEditingStep('idle');
      showAlert('Edit Failed', error?.message || 'Could not apply edits. Please try again.');
    } finally {
      setApplying(false);
    }
  };

  const handleSave = () => {
    if (!editedUrl) return;
    onApplyEdits(editedUrl, editPrompt.trim());
    setEditedUrl(null);
    setEditPrompt('');
    setEditingStep('idle');
    onClose();
  };

  const handleClose = () => {
    setEditedUrl(null);
    setEditPrompt('');
    setEditingStep('idle');
    onClose();
  };

  const stepLabel = editingStep === 'analyzing'
    ? 'Analyzing image...'
    : editingStep === 'generating'
    ? 'Generating edited image...'
    : '';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={[s.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[s.header, { borderBottomColor: colors.border, paddingTop: Platform.select({ ios: insets.top + 12, android: insets.top + 12, default: 12 }) }]}>
          <TouchableOpacity onPress={handleClose} style={s.headerBtn}>
            <Ionicons name="close" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.text }]}>Edit Image</Text>
          {editedUrl ? (
            <TouchableOpacity onPress={handleSave} style={[s.saveBtn, { backgroundColor: colors.primary }]}>
              <Text style={s.saveBtnText}>Use</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 52 }} />
          )}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}>
          {/* Image preview — shows edited result when available */}
          <View style={s.imageWrap}>
            <Image
              source={{ uri: editedUrl || imageUrl }}
              style={s.imagePreview}
              contentFit="contain"
              transition={300}
            />
            {editedUrl ? (
              <View style={s.editedBadge}>
                <Ionicons name="checkmark-circle" size={14} color="#FFF" />
                <Text style={s.editedBadgeText}>Edited</Text>
              </View>
            ) : null}
          </View>

          {/* Preset chips */}
          <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>Quick edits</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }} style={{ marginBottom: 16 }}>
            {EDIT_PRESETS.map((preset) => (
              <TouchableOpacity
                key={preset.label}
                onPress={() => applyPreset(preset.prompt)}
                activeOpacity={0.75}
                style={[
                  s.presetChip,
                  {
                    backgroundColor: editPrompt === preset.prompt
                      ? (colors.primary + '22')
                      : (isDark ? '#2C2C2E' : '#F2F2F7'),
                    borderColor: editPrompt === preset.prompt
                      ? colors.primary
                      : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'),
                  },
                ]}
              >
                <Ionicons
                  name={preset.icon as any}
                  size={14}
                  color={editPrompt === preset.prompt ? colors.primary : colors.textSecondary}
                />
                <Text style={[s.presetLabel, { color: editPrompt === preset.prompt ? colors.primary : colors.text }]}>
                  {preset.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Custom prompt input */}
          <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>Custom instruction</Text>
          <View style={[s.inputBox, { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}>
            <TextInput
              style={[s.textInput, { color: colors.text }]}
              placeholder="Describe the changes you want to make..."
              placeholderTextColor={colors.textSecondary}
              value={editPrompt}
              onChangeText={setEditPrompt}
              multiline
              editable={!applying}
            />
          </View>

          {/* Loading state */}
          {applying ? (
            <View style={s.loadingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[s.loadingText, { color: colors.textSecondary }]}>{stepLabel}</Text>
            </View>
          ) : null}

          {/* Apply button */}
          <TouchableOpacity
            onPress={handleApply}
            disabled={!editPrompt.trim() || applying}
            activeOpacity={0.8}
            style={[
              s.applyBtn,
              { backgroundColor: colors.primary },
              (!editPrompt.trim() || applying) && { opacity: 0.4 },
            ]}
          >
            {applying ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="color-wand-outline" size={18} color="#FFF" />
                <Text style={s.applyBtnText}>{editedUrl ? 'Re-apply Edits' : 'Apply Edits with AI'}</Text>
              </>
            )}
          </TouchableOpacity>

          {editedUrl ? (
            <TouchableOpacity
              onPress={handleSave}
              activeOpacity={0.8}
              style={[s.useBtn, { borderColor: colors.primary }]}
            >
              <Ionicons name="checkmark-circle-outline" size={18} color={colors.primary} />
              <Text style={[s.useBtnText, { color: colors.primary }]}>Use Edited Image</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  saveBtn: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 7 },
  saveBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  imageWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#111',
    marginBottom: 20,
    position: 'relative',
  },
  imagePreview: { width: '100%', height: '100%' },
  editedBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#34C759',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  editedBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  sectionLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  presetLabel: { fontSize: 13, fontWeight: '500' },
  inputBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  textInput: { fontSize: 15, lineHeight: 22, minHeight: 80, textAlignVertical: 'top' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  loadingText: { fontSize: 14 },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 28,
    paddingVertical: 16,
    marginBottom: 12,
  },
  applyBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  useBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 28,
    paddingVertical: 14,
    borderWidth: 1.5,
  },
  useBtnText: { fontSize: 15, fontWeight: '600' },
});
