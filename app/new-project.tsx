import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useAuth, useAlert } from '@/template';
import { useRouter } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type IconName = keyof typeof Ionicons.glyphMap;

export default function NewProjectScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [projectName, setProjectName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState<IconName>('folder');
  const [selectedColor, setSelectedColor] = useState('#10A37F');
  const [selectedCategory, setSelectedCategory] = useState('General');

  const icons: IconName[] = [
    'folder',
    'briefcase',
    'book',
    'school',
    'fitness',
    'medkit',
    'heart',
    'cash',
    'home',
    'car',
    'airplane',
    'restaurant',
  ];

  const colors_palette = [
    '#10A37F',
    '#0084FF',
    '#FF3B30',
    '#FF9500',
    '#5856D6',
    '#34C759',
    '#FF2D55',
    '#AF52DE',
  ];

  const categories = [
    'General',
    'Investing',
    'Homework',
    'Writing',
    'Health',
    'Travel',
    'Cooking',
    'Business',
  ];

  const handleCreate = () => {
    if (!projectName.trim()) {
      showAlert('Error', 'Please enter a project name');
      return;
    }

    // Generate project ID
    const projectId = `proj_${Date.now()}`;
    
    showAlert('Success', 'Project created successfully', [
      { 
        text: 'Continue', 
        onPress: () => {
          router.replace({
            pathname: '/project-upload',
            params: { 
              projectId, 
              projectName 
            }
          });
        }
      }
    ]);
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: Platform.select({
        ios: insets.top,
        android: insets.top,
      }),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    cancelButton: {
      padding: Spacing.xs,
    },
    cancelText: {
      ...Typography.body,
      color: colors.primary,
    },
    headerTitle: {
      ...Typography.heading,
      color: colors.text,
    },
    createButton: {
      padding: Spacing.xs,
    },
    createText: {
      ...Typography.body,
      color: colors.primary,
      fontWeight: '600',
    },
    content: {
      padding: Spacing.lg,
    },
    section: {
      marginBottom: Spacing.xl,
    },
    sectionTitle: {
      ...Typography.body,
      color: colors.text,
      fontWeight: '600',
      marginBottom: Spacing.md,
    },
    input: {
      backgroundColor: colors.inputBackground,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.text,
      fontSize: 16,
    },
    iconGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.md,
    },
    iconButton: {
      width: 56,
      height: 56,
      borderRadius: BorderRadius.md,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    iconButtonSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryLight,
    },
    colorGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.md,
    },
    colorButton: {
      width: 48,
      height: 48,
      borderRadius: BorderRadius.full,
      borderWidth: 3,
      borderColor: 'transparent',
    },
    colorButtonSelected: {
      borderColor: colors.text,
    },
    categoryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    categoryButton: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.full,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    categoryButtonSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    categoryText: {
      ...Typography.caption,
      color: colors.text,
    },
    categoryTextSelected: {
      color: '#FFFFFF',
    },
    preview: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.md,
      padding: Spacing.lg,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    previewIcon: {
      width: 80,
      height: 80,
      borderRadius: BorderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.md,
    },
    previewName: {
      ...Typography.heading,
      color: colors.text,
      marginBottom: Spacing.xs,
    },
    previewCategory: {
      ...Typography.caption,
      color: colors.textSecondary,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => router.back()}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Project</Text>
        <TouchableOpacity style={styles.createButton} onPress={handleCreate}>
          <Text style={styles.createText}>Create</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Project Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter project name"
            placeholderTextColor={colors.textSecondary}
            value={projectName}
            onChangeText={setProjectName}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Icon</Text>
          <View style={styles.iconGrid}>
            {icons.map((icon) => (
              <TouchableOpacity
                key={icon}
                style={[
                  styles.iconButton,
                  selectedIcon === icon && styles.iconButtonSelected,
                ]}
                onPress={() => setSelectedIcon(icon)}
              >
                <Ionicons
                  name={icon}
                  size={28}
                  color={
                    selectedIcon === icon ? colors.primary : colors.text
                  }
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Color</Text>
          <View style={styles.colorGrid}>
            {colors_palette.map((color) => (
              <TouchableOpacity
                key={color}
                style={[
                  styles.colorButton,
                  { backgroundColor: color },
                  selectedColor === color && styles.colorButtonSelected,
                ]}
                onPress={() => setSelectedColor(color)}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Category</Text>
          <View style={styles.categoryGrid}>
            {categories.map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryButton,
                  selectedCategory === category &&
                    styles.categoryButtonSelected,
                ]}
                onPress={() => setSelectedCategory(category)}
              >
                <Text
                  style={[
                    styles.categoryText,
                    selectedCategory === category &&
                      styles.categoryTextSelected,
                  ]}
                >
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preview</Text>
          <View style={styles.preview}>
            <View
              style={[
                styles.previewIcon,
                { backgroundColor: selectedColor },
              ]}
            >
              <Ionicons name={selectedIcon} size={40} color="#FFFFFF" />
            </View>
            <Text style={styles.previewName}>
              {projectName || 'Project Name'}
            </Text>
            <Text style={styles.previewCategory}>{selectedCategory}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
