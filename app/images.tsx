/**
 * IMAGES PAGE
 * - Full blur-glass dark/light design
 * - When user picks a photo + sends: auto-navigates to home, creates a
 *   conversation and sends the image to AI automatically
 * - My Images gallery with real-time polling (every 5 s)
 * - Styles & Discover sections for quick AI transforms
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  StatusBar,
  Modal,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useTheme } from '../hooks/useTheme';
import { useAuth, useAlert } from '@/template';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';
import * as ImagePicker from 'expo-image-picker';
import { useConversation } from '../hooks/useConversation';
import * as FileSystem from 'expo-file-system';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COL_GAP = 4;
const GRID_COLS = 2;
const ITEM_SIZE = (SCREEN_WIDTH - 32 - COL_GAP * (GRID_COLS - 1)) / GRID_COLS;

// ─────────────────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────────────────
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
    icon: 'crown-outline' as const,
    color: '#FFD700',
    prompt: 'Transform the person in the uploaded photo into a majestic emperor with royal robes, golden crown, and a powerful commanding pose in an ancient palace setting.',
  },
  {
    id: 'pet-human',
    title: 'Reimagine my pet as a human',
    icon: 'paw-outline' as const,
    color: '#FF6B35',
    prompt: 'Transform the animal in the uploaded photo into a realistic human character that captures the same personality, colors, and energy of the original animal.',
  },
  {
    id: 'bowl-cut',
    title: 'Give them a bowl cut',
    icon: 'cut-outline' as const,
    color: '#5AC8FA',
    prompt: 'Give the person in the uploaded photo a perfectly round bowl haircut while keeping all other features exactly the same. Photorealistic, natural lighting.',
  },
];

// ─────────────────────────────────────────────────────────
// Image Viewer Modal (full-screen)
// ─────────────────────────────────────────────────────────
function ImageViewModal({
  visible,
  imageUrl,
  onClose,
}: {
  visible: boolean;
  imageUrl: string | null;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  if (!imageUrl) return null;
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={ivS.root}>
        <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
        <Image source={{ uri: imageUrl }} style={ivS.img} contentFit="contain" />
        <TouchableOpacity style={[ivS.closeBtn, { top: insets.top + 14 }]} onPress={onClose}>
          <BlurView intensity={70} tint="dark" style={ivS.closeBtnBlur}>
            <Ionicons name="close" size={22} color="#FFF" />
          </BlurView>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const ivS = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  img: { width: SCREEN_WIDTH, height: SCREEN_WIDTH * 1.2, maxHeight: '80%' },
  closeBtn: { position: 'absolute', right: 16, zIndex: 10 },
  closeBtnBlur: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});

// ─────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────
export default function ImagesScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();
  const { createConversation, sendMessage } = useConversation();

  const [myImages, setMyImages] = useState<any[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [customDescription, setCustomDescription] = useState('');
  const [customImage, setCustomImage] = useState<{ uri: string; base64: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const pollRef = useRef<any>(null);

  // ── Load my images ──
  const loadMyImages = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data } = await supabase
        .from('media_files')
        .select('*')
        .eq('user_id', user.id)
        .eq('file_type', 'image')
        .order('created_at', { ascending: false })
        .limit(50);
      if (data) setMyImages(data);
    } catch (_e) {}
  }, [user?.id, supabase]);

  useEffect(() => {
    setLoadingImages(true);
    loadMyImages().finally(() => setLoadingImages(false));

    // Real-time polling every 5 seconds
    pollRef.current = setInterval(loadMyImages, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadMyImages]);

  // ── Navigate to image-prompt page with selected photo + style ──
  const goToImagePromptPage = (imageUri: string, base64: string, stylePrompt: string) => {
    router.push({
      pathname: '/image-prompt',
      params: { imageUri, base64, stylePrompt },
    });
  };

  // ── Auto-send image to home page as a new conversation ──
  const sendImageToHome = useCallback(async (base64: string, userText: string) => {
    if (!user) {
      router.push('/login');
      return;
    }
    setSending(true);
    try {
      // Create or reuse a conversation
      const convId = await createConversation();
      if (!convId) throw new Error('Could not create conversation');

      // Navigate to home first so the user sees the chat
      router.replace('/home');

      // Small delay to ensure home is mounted before sending
      await new Promise(r => setTimeout(r, 400));

      // sendMessage with image
      const messageText = userText.trim() || 'Analyze and describe this image in detail. Tell me everything you see.';
      await sendMessage(messageText, undefined, base64, false, 'gemini');
    } catch (err: any) {
      showAlert('Error', err?.message || 'Failed to send image to AI');
    } finally {
      setSending(false);
    }
  }, [user, createConversation, sendMessage, router, showAlert]);

  // ── Style select handler ──
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

  // ── Discover idea select handler ──
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

  // ── Bottom bar: pick photo for custom send ──
  const handlePickForCustom = () => {
    Alert.alert('Add Image', '', [
      {
        text: 'Choose Photo',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') return;
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.85,
            base64: true,
          });
          if (!result.canceled && result.assets[0]) {
            setCustomImage({ uri: result.assets[0].uri, base64: result.assets[0].base64 || '' });
          }
        },
      },
      {
        text: 'Take Photo',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') return;
          const result = await ImagePicker.launchCameraAsync({
            quality: 0.85, base64: true,
          });
          if (!result.canceled && result.assets[0]) {
            setCustomImage({ uri: result.assets[0].uri, base64: result.assets[0].base64 || '' });
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // ── Bottom bar: send → goes to home with AI conversation ──
  const handleSendCustom = async () => {
    if (sending) return;
    if (!customImage && !customDescription.trim()) return;

    if (customImage) {
      // Send image to home + create AI conversation
      await sendImageToHome(customImage.base64, customDescription);
      setCustomDescription('');
      setCustomImage(null);
    } else {
      // Text-only → image prompt page
      router.push({
        pathname: '/image-prompt',
        params: { stylePrompt: customDescription },
      });
      setCustomDescription('');
    }
  };

  // Theme tokens
  const blurTint = (isDark ? 'dark' : 'light') as 'dark' | 'light';
  const surfaceBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
  const textSec = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';
  const accentColor = '#FF6B35';

  const canSend = (!!customImage || customDescription.trim().length > 0) && !sending;

  return (
    <View style={[s.root, { backgroundColor: isDark ? '#000' : '#F2F2F7' }]}>
      <StatusBar barStyle="light-content" />

      {/* Decorative blobs */}
      <View style={s.blob1} />
      <View style={s.blob2} />

      {/* HEADER */}
      <BlurView
        intensity={isDark ? 65 : 55}
        tint={blurTint}
        style={[s.header, { paddingTop: insets.top + 10, borderBottomColor: surfaceBorder }]}
      >
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={22} color={isDark ? '#FFF' : '#000'} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: isDark ? '#FFF' : '#000' }]}>Images</Text>
        <TouchableOpacity
          style={[s.refreshBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }]}
          onPress={() => loadMyImages()}
        >
          <Ionicons name="refresh-outline" size={18} color={isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)'} />
        </TouchableOpacity>
      </BlurView>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 140 }}
      >

        {/* ── STYLES ── */}
        <View style={s.sectionHeader}>
          <Text style={[s.sectionTitle, { color: isDark ? '#FFF' : '#000' }]}>Try a style</Text>
          <Text style={[s.sectionSub, { color: textSec }]}>Pick a photo, pick a style</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8, gap: 14 }}
        >
          {STYLES.map(st => (
            <TouchableOpacity
              key={st.id}
              style={s.styleItem}
              onPress={() => handleStyleSelect(st)}
              activeOpacity={0.82}
            >
              <View style={s.styleImgWrap}>
                <Image source={st.image} style={s.styleImg} contentFit="cover" transition={200} />
                <BlurView intensity={50} tint="dark" style={s.styleImgOverlay}>
                  <Text style={s.styleOverlayText}>{st.name.replace('\n', ' ')}</Text>
                </BlurView>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── DISCOVER ── */}
        <View style={[s.sectionHeader, { marginTop: 24 }]}>
          <Text style={[s.sectionTitle, { color: isDark ? '#FFF' : '#000' }]}>Discover</Text>
          <Text style={[s.sectionSub, { color: textSec }]}>AI-powered transformations</Text>
        </View>

        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          {DISCOVER_IDEAS.map(idea => (
            <TouchableOpacity
              key={idea.id}
              onPress={() => handleDiscoverSelect(idea)}
              activeOpacity={0.8}
            >
              <BlurView
                intensity={isDark ? 35 : 55}
                tint={blurTint}
                style={[s.discoverCard, { borderColor: surfaceBorder }]}
              >
                <View style={[s.discoverIconWrap, { backgroundColor: idea.color + '22' }]}>
                  <Ionicons name={idea.icon} size={24} color={idea.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.discoverTitle, { color: isDark ? '#FFF' : '#000' }]}>{idea.title}</Text>
                  <Text style={[s.discoverSub, { color: textSec }]}>Tap to upload a photo</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={textSec} />
              </BlurView>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── MY IMAGES ── */}
        <View style={[s.sectionHeader, { marginTop: 28 }]}>
          <Text style={[s.sectionTitle, { color: isDark ? '#FFF' : '#000' }]}>My Images</Text>
          <Text style={[s.sectionSub, { color: textSec }]}>
            {myImages.length > 0 ? `${myImages.length} photo${myImages.length !== 1 ? 's' : ''}` : 'Appears after AI generates one'}
          </Text>
        </View>

        {loadingImages ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={accentColor} />
          </View>
        ) : myImages.length === 0 ? (
          <BlurView intensity={isDark ? 30 : 50} tint={blurTint} style={[s.emptyCard, { marginHorizontal: 16, borderColor: surfaceBorder }]}>
            <Ionicons name="images-outline" size={40} color={textSec} />
            <Text style={[s.emptyTitle, { color: isDark ? '#FFF' : '#000' }]}>No images yet</Text>
            <Text style={[s.emptySub, { color: textSec }]}>Upload a photo above and the AI will transform it</Text>
          </BlurView>
        ) : (
          <View style={s.grid}>
            {myImages.map(img => (
              <TouchableOpacity
                key={img.id}
                style={s.gridItem}
                onPress={() => setViewerUrl(img.file_url)}
                activeOpacity={0.85}
              >
                <Image source={{ uri: img.file_url }} style={s.gridImg} contentFit="cover" transition={200} />
                <BlurView intensity={40} tint="dark" style={s.gridOverlay}>
                  <Ionicons name="expand-outline" size={14} color="rgba(255,255,255,0.7)" />
                </BlurView>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ── BOTTOM INPUT BAR ── */}
      <BlurView
        intensity={isDark ? 80 : 70}
        tint={blurTint}
        style={[s.bottomBar, { paddingBottom: insets.bottom + 14, borderTopColor: surfaceBorder }]}
      >
        {customImage ? (
          <View style={s.previewRow}>
            <Image source={{ uri: customImage.uri }} style={s.previewThumb} contentFit="cover" />
            <TouchableOpacity onPress={() => setCustomImage(null)} style={s.removePreview}>
              <Ionicons name="close" size={11} color="#FFF" />
            </TouchableOpacity>
            <Text style={[s.previewHint, { color: textSec }]}>
              This image will be sent to AI on home page
            </Text>
          </View>
        ) : null}

        <View style={[s.inputRow, {
          backgroundColor: isDark ? 'rgba(44,44,46,0.6)' : 'rgba(255,255,255,0.7)',
          borderColor: surfaceBorder,
        }]}>
          <TouchableOpacity onPress={handlePickForCustom} style={s.inputIcon} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="image-outline" size={22} color={isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.4)'} />
          </TouchableOpacity>

          <TextInput
            style={[s.textInput, { color: isDark ? '#FFF' : '#000' }]}
            placeholder={customImage ? 'What should AI do with this image?' : 'Describe an image to generate...'}
            placeholderTextColor={textSec}
            value={customDescription}
            onChangeText={setCustomDescription}
            multiline
            maxLength={500}
          />

          <TouchableOpacity
            onPress={handleSendCustom}
            disabled={!canSend}
            style={[s.sendBtn, { backgroundColor: canSend ? accentColor : (isDark ? 'rgba(255,107,53,0.25)' : 'rgba(255,107,53,0.2)') }]}
            activeOpacity={0.85}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Ionicons name="arrow-up" size={18} color={canSend ? '#FFF' : (isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)')} />
            )}
          </TouchableOpacity>
        </View>

        {customImage ? (
          <Text style={[s.sendHint, { color: textSec }]}>
            Tap ↑ to open a new AI chat with this image on the home page
          </Text>
        ) : null}
      </BlurView>

      {/* Full-screen image viewer */}
      <ImageViewModal
        visible={!!viewerUrl}
        imageUrl={viewerUrl}
        onClose={() => setViewerUrl(null)}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },

  // Background decorative blobs
  blob1: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(255,107,53,0.07)',
    top: -60,
    right: -80,
  },
  blob2: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(90,200,250,0.05)',
    bottom: 160,
    left: -60,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 19,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Section
  sectionHeader: {
    paddingHorizontal: 16,
    marginBottom: 14,
    marginTop: 22,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  sectionSub: {
    fontSize: 13,
    marginTop: 2,
  },

  // Style cards
  styleItem: { width: 114, alignItems: 'center' },
  styleImgWrap: { width: 114, height: 148, borderRadius: 18, overflow: 'hidden', position: 'relative' },
  styleImg: { width: '100%', height: '100%' },
  styleImgOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 8,
    paddingHorizontal: 8,
    overflow: 'hidden',
  },
  styleOverlayText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },

  // Discover cards
  discoverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    overflow: 'hidden',
  },
  discoverIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discoverTitle: { fontSize: 15, fontWeight: '600' },
  discoverSub: { fontSize: 12, marginTop: 2 },

  // Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: COL_GAP,
  },
  gridItem: {
    width: ITEM_SIZE,
    aspectRatio: 1,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  gridImg: { width: '100%', height: '100%' },
  gridOverlay: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Empty state
  emptyCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
    gap: 12,
    overflow: 'hidden',
  },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 19 },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 12,
    paddingHorizontal: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 4,
  },
  previewThumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
  },
  removePreview: {
    position: 'absolute',
    top: -4,
    left: 40,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewHint: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    marginLeft: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 28,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
    borderWidth: 1,
  },
  inputIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 8,
    maxHeight: 88,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendHint: {
    fontSize: 11,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
});
please ai if you see this dont skip make the change please fix all in real time for me take you time please it must go to home page and create chat id in side menu like others fok message save in real time and lel al nn homepage ai thinking and baw real photo model lan nn edg function ai dwe knw all photo yo When a user uploads a photo on the images page and taps send, show a loading overlay on the home page while AI analyzes the image, then display the AI response with an 'Save to My Images' button that stores the result in media_files table for the gallery.
