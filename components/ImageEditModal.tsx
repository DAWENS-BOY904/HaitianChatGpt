import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useAlert } from '@/template';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ImageEditModalProps {
  visible: boolean;
  imageUrl: string;
  onClose: () => void;
  onApplyEdits: (editPrompt: string) => Promise<void>;
}

export function ImageEditModal({
  visible,
  imageUrl,
  onClose,
  onApplyEdits,
}: ImageEditModalProps) {
  const { colors } = useTheme();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();
  const [editPrompt, setEditPrompt] = useState('');
  const [applying, setApplying] = useState(false);

  const handleApply = async () => {
    if (!editPrompt.trim()) {
      showAlert('Error', 'Please describe the edits you want to make');
      return;
    }

    setApplying(true);
    try {
      await onApplyEdits(editPrompt);
      setEditPrompt('');
      onClose();
    } catch (error) {
      console.error('Edit error:', error);
      showAlert('Error', 'Failed to apply edits');
    } finally {
      setApplying(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: Spacing.md,
      paddingTop: Platform.select({
        ios: insets.top + Spacing.md,
        android: insets.top + Spacing.md,
        default: Spacing.md,
      }),
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerButton: {
      padding: Spacing.xs,
    },
    headerTitle: {
      ...Typography.heading,
      color: colors.text,
      fontSize: 18,
    },
    content: {
      flex: 1,
      padding: Spacing.md,
    },
    imagePreview: {
      width: '100%',
      aspectRatio: 1,
      borderRadius: BorderRadius.md,
      marginBottom: Spacing.md,
    },
    optionsContainer: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    optionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      backgroundColor: colors.surface,
      padding: Spacing.md,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    optionText: {
      ...Typography.caption,
      color: colors.text,
      fontSize: 12,
    },
    inputContainer: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    inputLabel: {
      ...Typography.caption,
      color: colors.textSecondary,
      marginBottom: Spacing.xs,
      fontWeight: '600',
    },
    textInput: {
      ...Typography.body,
      color: colors.text,
      minHeight: 100,
      textAlignVertical: 'top',
    },
    footer: {
      padding: Spacing.md,
      paddingBottom: Platform.select({
        ios: insets.bottom + Spacing.md,
        android: insets.bottom + Spacing.md,
        default: Spacing.md,
      }),
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    applyButton: {
      backgroundColor: colors.primary,
      padding: Spacing.md,
      borderRadius: BorderRadius.lg,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      gap: Spacing.sm,
    },
    applyButtonDisabled: {
      opacity: 0.5,
    },
    applyButtonText: {
      ...Typography.body,
      color: '#FFFFFF',
      fontWeight: '600',
      fontSize: 16,
    },
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton} onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Image</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.content}>
          <Image source={{ uri: imageUrl }} style={styles.imagePreview} />

          <View style={styles.optionsContainer}>
            <TouchableOpacity style={styles.optionButton}>
              <Ionicons name="scan-outline" size={18} color={colors.text} />
              <Text style={styles.optionText}>Select area</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.optionButton}>
              <Ionicons name="camera-outline" size={18} color={colors.text} />
              <Text style={styles.optionText}>Take photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.optionButton}>
              <Ionicons name="images-outline" size={18} color={colors.text} />
              <Text style={styles.optionText}>Blend photo</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Describe edits</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Describe the changes you want to make..."
              placeholderTextColor={colors.textSecondary}
              value={editPrompt}
              onChangeText={setEditPrompt}
              multiline
              editable={!applying}
            />
          </View>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.applyButton,
              (!editPrompt.trim() || applying) && styles.applyButtonDisabled,
            ]}
            onPress={handleApply}
            disabled={!editPrompt.trim() || applying}
          >
            {applying ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
                <Text style={styles.applyButtonText}>Apply Edits</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
