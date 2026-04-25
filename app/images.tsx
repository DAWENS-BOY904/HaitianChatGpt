import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  Dimensions,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useAuth, useAlert } from '@/template';
import { useRouter } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';
import * as ImagePicker from 'expo-image-picker';
import { useConversation } from '../hooks/useConversation';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const STYLES = [
  {
    id: 'caricature',
    name: 'Caricature\nTrend',
    image: require('@/assets/models/sketch-style.png'),
    prompt: 'Transform the person in the uploaded photo into a modern caricature trend art style. Exaggerate features in a fun and stylized anime-inspired way with vibrant colors.',
  },
  {
    id: 'flower',
    name: 'Flower petals',
    image: require('@/assets/models/plushie-style.png'),
    prompt: 'Transform the person in the uploaded photo into a figure made entirely from layered flower petals. Use realistic petal textures, delicate edges, and natural overlaps. Soft daylight, gentle shadows, clean minimal background. Photoreal, high-detail, elegant.',
  },
  {
    id: 'gold',
    name: 'Gold',
    image: require('@/assets/models/dramatic-style.png'),
    prompt: 'Transform the person in the uploaded photo into a luxurious golden statue with rich metallic gold texture, dramatic lighting, and an elegant pose. Highly detailed, photorealistic golden sculpture.',
  },
  {
    id: 'crayon',
    name: 'Crayon',
    image: require('@/assets/models/holiday-style.png'),
    prompt: 'Reimagine the person in the uploaded photo as a cute crayon-drawn cartoon character. Bright colors, thick outlines, childlike charm, white paper background.',
  },
  {
    id: 'paparazzi',
    name: 'Paparazzi',
    image: require('@/assets/models/baseball-style.png'),
    prompt: 'Create a dramatic paparazzi-style photo of the person in the uploaded photo. Flash photography, candid moment, celebrity aesthetic, high contrast lighting.',
  },
];

const DISCOVER_IDEAS = [
  {
    id: 'emperor',
    title: 'Me as an emperor',
    prompt: 'Transform the person in the uploaded photo into a majestic emperor with royal robes, golden crown, and a powerful commanding pose in an ancient palace setting.',
  },
  {
    id: 'pet-human',
    title: 'Reimagine my pet as a human',
    prompt: 'Transform the animal in the uploaded photo into a realistic human character that captures the same personality, colors, and energy of the original animal.',
  },
  {
    id: 'bowl-cut',
    title: 'Give them a bowl cut',
    prompt: 'Give the person in the uploaded photo a perfectly round bowl haircut while keeping all other features exactly the same. Photorealistic, natural lighting.',
  },
];

export default function ImagesScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();
  const { sendMessage } = useConversation();

  const [myImages, setMyImages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [customDescription, setCustomDescription] = useState('');
  const [customImage, setCustomImage] = useState<{ uri: string; base64: string } | null>(null);

  useEffect(() => { loadMyImages(); }, []);

  const loadMyImages = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('media_files')
        .select('*')
        .eq('user_id', user.id)
        .eq('file_type', 'image')
        .order('created_at', { ascending: false });
      setMyImages(data || []);
    } catch {}
    finally { setLoading(false); }
  };

  // ── Save an AI-generated or user-sent image URL to My Images ──
  const saveImageToMyPhotos = async (imageUrl: string, fileName?: string) => {
    if (!user || !imageUrl) return;
    try {
      // Check for duplicate
      const { data: existing } = await supabase
        .from('media_files')
        .select('id')
        .eq('user_id', user.id)
        .eq('file_url', imageUrl)
        .maybeSingle();
      if (existing) return; // already saved
      await supabase.from('media_files').insert({
        user_id: user.id,
        file_type: 'image',
        file_url: imageUrl,
        file_name: fileName || `image_${Date.now()}.jpg`,
      });
      // Refresh gallery
      loadMyImages();
    } catch (_e) {}
  };

  // ── Navigate to image-prompt page with selected photo + style ──
  const goToImagePromptPage = (imageUri: string, base64: string, stylePrompt: string) => {
    router.push({
      pathname: '/image-prompt',
      params: { imageUri, base64, stylePrompt },
    });
  };

  const handleStyleSelect = (style: any) => {
    Alert.alert(
      style.name.replace('\n', ' '),
      'Choose a photo to get started.',
      [
        {
          text: 'Choose Photo',
          onPress: async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') { showAlert('Permission required', 'Please allow photo access'); return; }
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.9,
              base64: true,
            });
            if (!result.canceled && result.assets[0]) {
              goToImagePromptPage(result.assets[0].uri, result.assets[0].base64 || '', style.prompt);
            }
          },
        },
        {
          text: 'Take Selfie',
          onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') { showAlert('Permission required', 'Please allow camera access'); return; }
            const result = await ImagePicker.launchCameraAsync({
              quality: 0.9,
              base64: true,
              cameraType: ImagePicker.CameraType.front,
            });
            if (!result.canceled && result.assets[0]) {
              goToImagePromptPage(result.assets[0].uri, result.assets[0].base64 || '', style.prompt);
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleDiscoverSelect = (idea: any) => {
    Alert.alert(
      idea.title,
      'Choose a photo.',
      [
        {
          text: 'Choose Photo',
          onPress: async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') { showAlert('Permission required', 'Please allow photo access'); return; }
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.9,
              base64: true,
            });
            if (!result.canceled && result.assets[0]) {
              goToImagePromptPage(result.assets[0].uri, result.assets[0].base64 || '', idea.prompt);
            }
          },
        },
        {
          text: 'Take Selfie',
          onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') return;
            const result = await ImagePicker.launchCameraAsync({
              quality: 0.9, base64: true, cameraType: ImagePicker.CameraType.front,
            });
            if (!result.canceled && result.assets[0]) {
              goToImagePromptPage(result.assets[0].uri, result.assets[0].base64 || '', idea.prompt);
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  // Bottom bar pick photo
  const handlePickForCustom = () => {
    Alert.alert('Add Image', '', [
      {
        text: 'Choose Photo',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') return;
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.9,
            base64: true,
          });
          if (!result.canceled && result.assets[0]) {
            setCustomImage({ uri: result.assets[0].uri, base64: result.assets[0].base64 || '' });
          }
        },
      },
      {
        text: 'Take Selfie',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') return;
          const result = await ImagePicker.launchCameraAsync({
            quality: 0.9, base64: true, cameraType: ImagePicker.CameraType.front,
          });
          if (!result.canceled && result.assets[0]) {
            setCustomImage({ uri: result.assets[0].uri, base64: result.assets[0].base64 || '' });
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleSendCustom = async () => {
    if (!customDescription.trim() && !customImage) return;
    if (customImage) {
      goToImagePromptPage(customImage.uri, customImage.base64, customDescription || 'Describe this image');
    } else {
      // Navigate to image prompt with only text
      router.push({
        pathname: '/image-prompt',
        params: { stylePrompt: customDescription },
      });
    }
    setCustomDescription('');
    setCustomImage(null);
  };

  const handleImagePress = (image: any) => {
    router.push({ pathname: '/image-viewer', params: { imageUrl: image.file_url } });
  };

  const bg = isDark ? '#000' : colors.background;
  const cardBg = isDark ? '#111' : colors.surface;

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          style={[styles.menuBtn, { backgroundColor: isDark ? '#1C1C1E' : colors.surface }]}
          onPress={() => router.back()}
        >
          <Ionicons name="menu" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Images</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>

        {/* STYLES */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Try a style on an image</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8, gap: 14 }}
        >
          {STYLES.map(s => (
            <TouchableOpacity key={s.id} style={styles.styleItem} onPress={() => handleStyleSelect(s)} activeOpacity={0.8}>
              <Image
                source={s.image}
                style={styles.styleImg}
                contentFit="cover"
                transition={200}
              />
              <Text style={[styles.styleName, { color: colors.text }]}>{s.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* DISCOVER */}
        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 24 }]}>Discover something new</Text>
        {DISCOVER_IDEAS.map(idea => (
          <TouchableOpacity
            key={idea.id}
            style={[styles.discoverRow, { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : colors.border }]}
            onPress={() => handleDiscoverSelect(idea)}
            activeOpacity={0.7}
          >
            <View style={[styles.discoverThumbWrap, { backgroundColor: isDark ? '#1C1C1E' : colors.surface }]}>
              <Ionicons name="sparkles" size={24} color={colors.text} />
            </View>
            <Text style={[styles.discoverTitle, { color: colors.text }]}>{idea.title}</Text>
            {/* Right example thumb placeholder */}
            <View style={[styles.discoverRightThumb, { backgroundColor: isDark ? '#1C1C1E' : colors.surface }]}>
              <Ionicons name="image-outline" size={20} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>
        ))}

        {/* MY IMAGES */}
        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 24 }]}>My images</Text>
        {loading ? (
          <View style={{ padding: 32, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : myImages.length === 0 ? (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
              No images yet. Try a style above!
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {myImages.map(img => (
              <TouchableOpacity key={img.id} style={styles.gridItem} onPress={() => handleImagePress(img)} activeOpacity={0.85}>
                <Image
                  source={{ uri: img.file_url }}
                  style={styles.gridImg}
                  contentFit="cover"
                  transition={200}
                />
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* BOTTOM INPUT BAR */}
      <View style={[styles.bottomBar, {
        paddingBottom: insets.bottom + 12,
        backgroundColor: isDark ? '#000' : colors.background,
        borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : colors.border,
      }]}>
        {customImage && (
          <View style={styles.previewRow}>
            <Image source={{ uri: customImage.uri }} style={styles.previewThumb} contentFit="cover" />
            <TouchableOpacity onPress={() => setCustomImage(null)} style={styles.removePreview}>
              <Ionicons name="close" size={10} color="#FFF" />
            </TouchableOpacity>
          </View>
        )}
        <View style={[styles.inputRow, { backgroundColor: isDark ? '#1C1C1E' : colors.surface }]}>
          <TouchableOpacity onPress={handlePickForCustom} style={styles.inputIcon}>
            <Ionicons name="image-outline" size={22} color={isDark ? 'rgba(255,255,255,0.6)' : colors.textSecondary} />
          </TouchableOpacity>
          <TextInput
            style={[styles.textInput, { color: colors.text }]}
            placeholder="Describe an image"
            placeholderTextColor={colors.textSecondary}
            value={customDescription}
            onChangeText={setCustomDescription}
            multiline
            maxLength={500}
          />
          <TouchableOpacity style={styles.inputIcon}>
            <Ionicons name="mic-outline" size={22} color={isDark ? 'rgba(255,255,255,0.6)' : colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSendCustom}
            style={[
              styles.sendBtn,
              { backgroundColor: (customDescription.trim() || customImage) ? '#FF6B35' : 'rgba(255,107,53,0.3)' }
            ]}
            disabled={!customDescription.trim() && !customImage}
          >
            <Ionicons name="arrow-up" size={18} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  menuBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    paddingHorizontal: 16,
    marginBottom: 14,
    letterSpacing: -0.3,
  },
  styleItem: {
    width: 120,
    alignItems: 'center',
  },
  styleImg: {
    width: 120,
    height: 156,
    borderRadius: 16,
    marginBottom: 8,
  },
  styleName: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 16,
  },
  discoverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 14,
  },
  discoverThumbWrap: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discoverTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22,
  },
  discoverRightThumb: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 4,
  },
  gridItem: {
    width: (SCREEN_WIDTH - 32) / 2,
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  gridImg: {
    width: '100%',
    height: '100%',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 10,
    paddingHorizontal: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  previewRow: {
    flexDirection: 'row',
    paddingBottom: 6,
    position: 'relative',
    alignSelf: 'flex-start',
    marginLeft: 4,
  },
  previewThumb: {
    width: 52,
    height: 52,
    borderRadius: 10,
  },
  removePreview: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 28,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
  },
  inputIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 6,
    maxHeight: 80,
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
fix this when u upload photo and the ai  must send it to home page auto create conversation chat in side menu and wait the ai to do what yo ask let the ai know all images in real time and design images page in blur mode.
