import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Platform,
  ActionSheetIOS,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useAuth, useAlert } from '@/template';
import { useRouter } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';
import * as ImagePicker from 'expo-image-picker';

const STYLES = [
  {
    id: 'sketch',
    name: 'Sketch',
    image: require('@/assets/models/sketch-style.png'),
    color: '#8E8E93',
    prompt: 'Create a detailed pencil sketch of the person in the uploaded photo. Show them drawing themselves, with realistic shading and pencil texture on white paper.',
  },
  {
    id: 'holiday',
    name: 'Holiday portrait',
    image: require('@/assets/models/holiday-style.png'),
    color: '#FF3B30',
    prompt: 'Create a festive holiday portrait of the person in the uploaded photo with warm lighting, Christmas decorations, and a cozy atmosphere.',
  },
  {
    id: 'dramatic',
    name: 'Dramatic',
    image: require('@/assets/models/dramatic-style.png'),
    color: '#000000',
    prompt: 'Create a dramatic black and white portrait of the person in the uploaded photo with intense contrast, moody lighting, and powerful expression.',
  },
  {
    id: 'plushie',
    name: 'Plushie',
    image: require('@/assets/models/plushie-style.png'),
    color: '#FF9500',
    prompt: 'Transform the person in the uploaded photo into an adorable soft plushie toy with cute features, fabric texture, and gentle colors.',
  },
  {
    id: 'baseball',
    name: 'Baseball bobblehead',
    image: require('@/assets/models/baseball-style.png'),
    color: '#007AFF',
    prompt: 'Create a fun baseball bobblehead figurine of the person in the uploaded photo wearing team uniform, with exaggerated head and cute proportions.',
  },
];

const DISCOVER_IDEAS = [
  {
    id: 'holiday-card',
    title: 'Create a holiday card',
    icon: 'card-outline',
    color: '#34C759',
  },
  {
    id: 'kpop',
    title: 'What would I look like as a K-Pop star?',
    icon: 'musical-notes-outline',
    color: '#AF52DE',
  },
  {
    id: 'pearl',
    title: 'Me as The Girl with a Pearl',
    icon: 'diamond-outline',
    color: '#5856D6',
  },
];

export default function ImagesScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  const [myImages, setMyImages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<any>(null);
  const [customDescription, setCustomDescription] = useState('');
  const [customImage, setCustomImage] = useState<string | null>(null);

  useEffect(() => {
    loadMyImages();
  }, []);

  const loadMyImages = async () => {
    if (!user) return;

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('media_files')
        .select('*')
        .eq('user_id', user.id)
        .eq('file_type', 'image')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setMyImages(data || []);
    } catch (error) {
      console.error('Load images error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStyleSelect = (style: any) => {
    setSelectedStyle(style);

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: style.name,
          message: 'Choose a photo to get started.',
          options: ['Choose a photo', 'Take a selfie', 'Cancel'],
          cancelButtonIndex: 2,
        },
        (buttonIndex) => {
          if (buttonIndex === 0) {
            handleChoosePhoto(style);
          } else if (buttonIndex === 1) {
            handleTakeSelfie(style);
          }
        }
      );
    } else {
      Alert.alert(
        style.name,
        'Choose a photo to get started.',
        [
          { text: 'Choose a photo', onPress: () => handleChoosePhoto(style) },
          { text: 'Take a selfie', onPress: () => handleTakeSelfie(style) },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  };

  const handleChoosePhoto = async (style?: any) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permission required', 'Please allow access to your photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      if (style) {
        // Style preset flow
        router.push({
          pathname: '/image-prompt',
          params: {
            image: result.assets[0].uri,
            base64: result.assets[0].base64,
            stylePrompt: style.prompt,
            styleName: style.name,
          },
        });
      } else {
        // Custom description flow - store image and wait for description
        setCustomImage(result.assets[0].uri);
      }
    }
  };

  const handleTakeSelfie = async (style?: any) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permission required', 'Please allow access to your camera');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 1,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      if (style) {
        router.push({
          pathname: '/image-prompt',
          params: {
            image: result.assets[0].uri,
            base64: result.assets[0].base64,
            stylePrompt: style.prompt,
            styleName: style.name,
          },
        });
      } else {
        setCustomImage(result.assets[0].uri);
      }
    }
  };

  const handleCustomImageGeneration = async () => {
    if (!customDescription.trim()) {
      showAlert('Description required', 'Please describe the image you want to create');
      return;
    }

    if (customImage) {
      // User uploaded an image with custom description
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        router.push({
          pathname: '/image-prompt',
          params: {
            image: result.assets[0].uri,
            base64: result.assets[0].base64,
            stylePrompt: customDescription,
            styleName: 'Custom',
          },
        });
      }
    } else {
      // Generate from text only
      router.push({
        pathname: '/image-prompt',
        params: {
          stylePrompt: customDescription,
          styleName: 'Custom',
        },
      });
    }

    setCustomDescription('');
    setCustomImage(null);
  };

  const handleImagePress = (image: any) => {
    router.push({
      pathname: '/image-viewer',
      params: {
        imageId: image.id,
        imageUrl: image.file_url,
      },
    });
  };

  const handlePickImageForCustom = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: 'Choose a photo',
          options: ['Choose from library', 'Take a photo', 'Cancel'],
          cancelButtonIndex: 2,
        },
        (buttonIndex) => {
          if (buttonIndex === 0) {
            handleChoosePhoto();
          } else if (buttonIndex === 1) {
            handleTakeSelfie();
          }
        }
      );
    } else {
      Alert.alert(
        'Choose a photo',
        '',
        [
          { text: 'Choose from library', onPress: () => handleChoosePhoto() },
          { text: 'Take a photo', onPress: () => handleTakeSelfie() },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
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
      justifyContent: 'space-between',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      padding: Spacing.xs,
    },
    headerTitle: {
      ...Typography.heading,
      color: colors.text,
      fontSize: 20,
    },
    content: {
      flex: 1,
    },
    section: {
      marginBottom: Spacing.xl,
    },
    sectionTitle: {
      ...Typography.heading,
      color: colors.text,
      fontSize: 18,
      paddingHorizontal: Spacing.md,
      marginBottom: Spacing.md,
      marginTop: Spacing.lg,
    },
    stylesScroll: {
      paddingHorizontal: Spacing.md,
    },
    styleItem: {
      marginRight: Spacing.md,
      alignItems: 'center',
      width: 140,
    },
    styleImage: {
      width: 140,
      height: 180,
      borderRadius: BorderRadius.lg,
      backgroundColor: colors.surface,
      marginBottom: Spacing.xs,
      overflow: 'hidden',
    },
    stylePreviewImage: {
      width: '100%',
      height: '100%',
    },
    styleName: {
      ...Typography.caption,
      color: colors.text,
      textAlign: 'center',
    },
    discoverItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.md,
      backgroundColor: colors.card,
      marginHorizontal: Spacing.md,
      marginBottom: Spacing.sm,
      borderRadius: BorderRadius.md,
    },
    discoverImage: {
      width: 60,
      height: 60,
      borderRadius: BorderRadius.md,
      backgroundColor: colors.surface,
      marginRight: Spacing.md,
      justifyContent: 'center',
      alignItems: 'center',
    },
    discoverTitle: {
      ...Typography.body,
      color: colors.text,
      flex: 1,
    },
    imagesGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: Spacing.md - 4,
    },
    imageItem: {
      width: '50%',
      padding: 4,
    },
    gridImage: {
      width: '100%',
      aspectRatio: 1,
      borderRadius: BorderRadius.md,
      backgroundColor: colors.surface,
    },
    emptyState: {
      padding: Spacing.xl,
      alignItems: 'center',
    },
    emptyText: {
      ...Typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    bottomBar: {
      padding: Spacing.md,
      paddingBottom: Platform.select({
        ios: insets.bottom + Spacing.md,
        android: Spacing.md,
      }),
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.full,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      gap: Spacing.sm,
    },
    input: {
      flex: 1,
      ...Typography.body,
      color: colors.text,
      maxHeight: 100,
    },
    iconButton: {
      padding: Spacing.xs,
    },
    customImagePreview: {
      width: 40,
      height: 40,
      borderRadius: BorderRadius.sm,
      overflow: 'hidden',
      backgroundColor: colors.surface,
    },
    customImagePreviewImage: {
      width: '100%',
      height: '100%',
    },
  });

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="menu" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Images</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* CONTENT */}
      <ScrollView style={styles.content}>
        {/* STYLES SECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Try a style on an image</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stylesScroll}>
            {STYLES.map((style) => (
              <TouchableOpacity key={style.id} style={styles.styleItem} onPress={() => handleStyleSelect(style)}>
                <View style={styles.styleImage}>
                  <Image 
                    source={style.image} 
                    style={styles.stylePreviewImage}
                    resizeMode="cover"
                  />
                </View>
                <Text style={styles.styleName}>{style.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* DISCOVER SECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Discover something new</Text>
          {DISCOVER_IDEAS.map((idea) => (
            <TouchableOpacity key={idea.id} style={styles.discoverItem}>
              <View style={[styles.discoverImage, { backgroundColor: idea.color }]}>
                <Ionicons name={idea.icon as any} size={32} color="#FFFFFF" />
              </View>
              <Text style={styles.discoverTitle}>{idea.title}</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>

        {/* MY IMAGES SECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My images</Text>
          {loading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : myImages.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No images yet. Try a style above to get started!</Text>
            </View>
          ) : (
            <View style={styles.imagesGrid}>
              {myImages.map((image) => (
                <TouchableOpacity key={image.id} style={styles.imageItem} onPress={() => handleImagePress(image)}>
                  <Image source={{ uri: image.file_url }} style={styles.gridImage} resizeMode="cover" />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* BOTTOM INPUT BAR - NOW FUNCTIONAL */}
      <View style={styles.bottomBar}>
        <View style={styles.inputContainer}>
          <TouchableOpacity style={styles.iconButton} onPress={handlePickImageForCustom}>
            {customImage ? (
              <View style={styles.customImagePreview}>
                <Image source={{ uri: customImage }} style={styles.customImagePreviewImage} />
              </View>
            ) : (
              <Ionicons name="image-outline" size={24} color={colors.text} />
            )}
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="Describe an image"
            placeholderTextColor={colors.textSecondary}
            value={customDescription}
            onChangeText={setCustomDescription}
            multiline
            maxLength={500}
          />
          <TouchableOpacity style={styles.iconButton}>
            <Ionicons name="mic-outline" size={24} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.iconButton} 
            onPress={handleCustomImageGeneration}
            disabled={!customDescription.trim()}
          >
            <Ionicons 
              name="arrow-up-circle" 
              size={32} 
              color={customDescription.trim() ? colors.primary : colors.textSecondary} 
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
