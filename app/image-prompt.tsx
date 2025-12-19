import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  TextInput,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useAuth, useAlert } from '@/template';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';
import { decode } from 'base64-arraybuffer';

export default function ImagePromptScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  const { image, base64, stylePrompt, styleName } = useLocalSearchParams<{
    image: string;
    base64: string;
    stylePrompt: string;
    styleName: string;
  }>();

  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    // Auto-generate prompt based on style
    setPrompt(stylePrompt || 'Generate an image from the uploaded photo.');
  }, [stylePrompt]);

  const handleGenerate = async () => {
    if (!prompt.trim() || generating) return;

    setGenerating(true);

    try {
      // Upload the image to storage first
      const fileName = `${Date.now()}_${user?.id}.jpg`;
      const filePath = `${user?.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('media-files')
        .upload(filePath, decode(base64), {
          contentType: 'image/jpeg',
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('media-files')
        .getPublicUrl(filePath);

      const imageUrl = urlData.publicUrl;

      // Call Edge Function to generate image
      const { data, error } = await supabase.functions.invoke('chat', {
        body: {
          messages: [
            {
              role: 'user',
              content: prompt,
              image_url: imageUrl,
            },
          ],
          model: 'google/gemini-2.5-flash-image-preview',
          modalities: ['image', 'text'],
          imageConfig: { aspectRatio: '1:1' },
        },
      });

      if (error) throw error;

      if (data.image) {
        // Save generated image to media_files
        const generatedFileName = `generated_${Date.now()}.png`;
        const generatedFilePath = `${user?.id}/${generatedFileName}`;

        // Convert base64 to blob
        const base64Image = data.image.split(',')[1];
        const { error: generatedUploadError } = await supabase.storage
          .from('media-files')
          .upload(generatedFilePath, decode(base64Image), {
            contentType: 'image/png',
          });

        if (!generatedUploadError) {
          const { data: generatedUrlData } = supabase.storage
            .from('media-files')
            .getPublicUrl(generatedFilePath);

          // Save to media_files table
          await supabase.from('media_files').insert({
            user_id: user?.id,
            file_type: 'image',
            file_url: generatedUrlData.publicUrl,
            file_name: generatedFileName,
          });

          // Navigate to image viewer
          router.replace({
            pathname: '/image-viewer',
            params: {
              imageUrl: generatedUrlData.publicUrl,
              prompt: prompt,
            },
          });
        }
      }
    } catch (error) {
      console.error('Image generation error:', error);
      showAlert('Error', 'Failed to generate image');
    } finally {
      setGenerating(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingTop: Platform.select({
        ios: insets.top + 10,
        android: insets.top + 10,
      }),
      paddingHorizontal: Spacing.md,
      paddingBottom: Spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      padding: Spacing.xs,
      marginRight: Spacing.sm,
    },
    headerTitle: {
      ...Typography.heading,
      color: colors.text,
      fontSize: 18,
    },
    content: {
      flex: 1,
      padding: Spacing.lg,
    },
    imagePreview: {
      width: 120,
      height: 120,
      borderRadius: BorderRadius.md,
      backgroundColor: colors.surface,
      alignSelf: 'center',
      marginBottom: Spacing.lg,
    },
    promptBubble: {
      backgroundColor: `${colors.primary}20`,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      marginBottom: Spacing.lg,
    },
    prompt: {
      ...Typography.body,
      color: colors.text,
      lineHeight: 22,
    },
    editButton: {
      marginTop: Spacing.sm,
      alignSelf: 'flex-end',
    },
    editButtonText: {
      ...Typography.caption,
      color: colors.primary,
      fontWeight: '600',
    },
    inputContainer: {
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      minHeight: 100,
      marginBottom: Spacing.lg,
    },
    input: {
      ...Typography.body,
      color: colors.text,
      flex: 1,
    },
    generateButton: {
      backgroundColor: colors.text,
      borderRadius: BorderRadius.full,
      padding: Spacing.md,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      gap: Spacing.sm,
    },
    generateButtonText: {
      ...Typography.body,
      color: colors.background,
      fontWeight: '600',
      fontSize: 16,
    },
  });

  const [isEditing, setIsEditing] = useState(false);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="close" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{styleName || 'Generate Image'}</Text>
      </View>

      <View style={styles.content}>
        {/* IMAGE PREVIEW */}
        <Image source={{ uri: image }} style={styles.imagePreview} resizeMode="cover" />

        {/* PROMPT */}
        {!isEditing ? (
          <View style={styles.promptBubble}>
            <Text style={styles.prompt}>{prompt}</Text>
            <TouchableOpacity style={styles.editButton} onPress={() => setIsEditing(true)}>
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={prompt}
              onChangeText={setPrompt}
              multiline
              autoFocus
              placeholder="Describe how you want the image..."
              placeholderTextColor={colors.textSecondary}
            />
            <TouchableOpacity style={styles.editButton} onPress={() => setIsEditing(false)}>
              <Text style={styles.editButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* GENERATE BUTTON */}
        <TouchableOpacity style={styles.generateButton} onPress={handleGenerate} disabled={generating}>
          {generating ? (
            <ActivityIndicator size="small" color={colors.background} />
          ) : (
            <>
              <Ionicons name="sparkles" size={20} color={colors.background} />
              <Text style={styles.generateButtonText}>Generate</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
