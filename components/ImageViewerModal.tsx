import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Platform,
  Share as RNShare,
  Animated,
  Pressable,
  Dimensions,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import { useTheme } from '../hooks/useTheme';
import { useAlert } from '@/template';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: W, height: H } = Dimensions.get('window');
const HELP_CENTER_URL = 'https://help.openai.com/en/';

interface ImageViewerModalProps {
  visible: boolean;
  imageUrl: string;
  onClose: () => void;
  onEdit?: () => void;
  title?: string;
  isUserImage?: boolean; // true = photo sent by user (no AI overlay actions)
}

// ── Pill blur button ──
function BlurBtn({
  icon,
  label,
  onPress,
  danger,
  white,
  loading,
}: {
  icon: string;
  label?: string;
  onPress: () => void;
  danger?: boolean;
  white?: boolean;
  loading?: boolean;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} disabled={loading}>
      <BlurView
        intensity={80}
        tint="dark"
        style={[
          btnS.wrap,
          label ? btnS.pill : btnS.circle,
          white && btnS.whiteWrap,
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={white ? '#000' : '#FFF'} />
        ) : (
          <>
            <Ionicons
              name={icon as any}
              size={20}
              color={danger ? '#FF453A' : white ? '#000' : '#FFF'}
            />
            {label ? (
              <Text
                style={[
                  btnS.label,
                  danger && { color: '#FF453A' },
                  white && { color: '#000' },
                ]}
              >
                {label}
              </Text>
            ) : null}
          </>
        )}
      </BlurView>
    </TouchableOpacity>
  );
}

const btnS = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  circle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center' },
  pill: { borderRadius: 22, paddingHorizontal: 14, height: 44, justifyContent: 'center' },
  whiteWrap: { backgroundColor: 'rgba(255,255,255,0.92)', borderColor: 'rgba(255,255,255,0.6)' },
  label: { color: '#FFF', fontSize: 15, fontWeight: '600' },
});

// ── "…" dropdown menu ──
function DotMenu({
  visible,
  onClose,
  onGood,
  onBad,
  onHelp,
  insets,
}: {
  visible: boolean;
  onClose: () => void;
  onGood: () => void;
  onBad: () => void;
  onHelp: () => void;
  insets: any;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 300, friction: 22, useNativeDriver: true }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.85);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <>
      {/* backdrop */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <Animated.View
        style={[
          dotMenuS.card,
          { top: insets.top + 58, right: 12, opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
        ]}
      >
        <BlurView intensity={90} tint="dark" style={dotMenuS.blur}>
          {[
            { icon: 'thumbs-up-outline', label: 'Good response', onPress: onGood },
            { icon: 'thumbs-down-outline', label: 'Bad response', onPress: onBad },
            { icon: 'help-circle-outline', label: 'Help Center', onPress: onHelp },
          ].map((item, i) => (
            <TouchableOpacity
              key={item.label}
              style={[dotMenuS.row, i > 0 && dotMenuS.rowBorder]}
              onPress={() => { onClose(); setTimeout(item.onPress, 80); }}
              activeOpacity={0.65}
            >
              <Ionicons name={item.icon as any} size={20} color="rgba(255,255,255,0.85)" />
              <Text style={dotMenuS.rowLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </BlurView>
      </Animated.View>
    </>
  );
}

const dotMenuS = StyleSheet.create({
  card: {
    position: 'absolute',
    width: 210,
    borderRadius: 16,
    overflow: 'hidden',
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 20,
  },
  blur: { borderRadius: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.1)' },
  rowLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 15, fontWeight: '400' },
});

// ── Main Modal ──
export function ImageViewerModal({
  visible,
  imageUrl,
  onClose,
  onEdit,
  title = 'Image created',
  isUserImage = false,
}: ImageViewerModalProps) {
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [liked, setLiked] = useState<'like' | 'dislike' | null>(null);
  const [dotMenuVisible, setDotMenuVisible] = useState(false);

  // Entrance anim
  const bgOpacity = useRef(new Animated.Value(0)).current;
  const imgScale = useRef(new Animated.Value(0.92)).current;
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(bgOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(imgScale, { toValue: 1, tension: 200, friction: 20, useNativeDriver: true }),
      ]).start();
    } else {
      bgOpacity.setValue(0);
      imgScale.setValue(0.92);
    }
  }, [visible]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Permission Required', 'Please allow photo library access.');
        return;
      }
      const ext = imageUrl.split('.').pop()?.split('?')[0] || 'jpg';
      const fileUri = `${FileSystem.documentDirectory}hcgpt_img_${Date.now()}.${ext}`;
      const { uri } = await FileSystem.downloadAsync(imageUrl, fileUri);
      await MediaLibrary.saveToLibraryAsync(uri);
      showAlert('Saved!', 'Image saved to your photo library.');
    } catch {
      showAlert('Error', 'Failed to save image.');
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    try {
      setSharing(true);
      // Download first so native share works on iOS/Android
      const ext = imageUrl.split('.').pop()?.split('?')[0] || 'jpg';
      const fileUri = `${FileSystem.documentDirectory}share_img_${Date.now()}.${ext}`;
      const { uri } = await FileSystem.downloadAsync(imageUrl, fileUri);
      if (Platform.OS === 'web') {
        await RNShare.share({ message: imageUrl });
      } else {
        await RNShare.share({ url: uri, message: title });
      }
    } catch (_e) {}
    finally { setSharing(false); }
  };

  const handleGood = () => {
    setLiked('like');
    showAlert('Thanks!', 'Good response recorded.');
  };

  const handleBad = () => {
    setLiked('dislike');
    showAlert('Thanks!', 'Bad response recorded. We will use this to improve.');
  };

  const handleHelp = () => {
    Linking.openURL(HELP_CENTER_URL).catch(() => showAlert('Error', 'Could not open Help Center.'));
  };

  return (
    <Modal
      visible={visible}
      animationType="none"
      presentationStyle="overFullScreen"
      transparent
      onRequestClose={onClose}
    >
      <Animated.View style={[vS.root, { opacity: bgOpacity }]}>
        {/* Blurred dark background */}
        <BlurView intensity={98} tint="dark" style={StyleSheet.absoluteFill} />

        {/* ── HEADER ── */}
        <View style={[vS.header, { paddingTop: insets.top + 10 }]}>
          {/* Left: close */}
          <BlurBtn icon="close" onPress={onClose} />

          {/* Center: title */}
          <Text style={vS.title} numberOfLines={1}>{isUserImage ? 'Photo' : title}</Text>

          {/* Right: share (always white pill) + "…" */}
          <View style={vS.headerRight}>
            <BlurBtn icon={sharing ? 'hourglass-outline' : 'share-outline'} label="Share" onPress={handleShare} white loading={sharing} />
            {!isUserImage ? (
              <BlurBtn icon="ellipsis-horizontal" onPress={() => setDotMenuVisible(v => !v)} />
            ) : null}
          </View>
        </View>

        {/* ── IMAGE ── */}
        <Animated.View style={[vS.imgWrap, { transform: [{ scale: imgScale }] }]}>
          <Image
            source={{ uri: imageUrl }}
            style={vS.image}
            contentFit="contain"
            transition={200}
          />
        </Animated.View>

        {/* ── BOTTOM ACTIONS ── */}
        {!isUserImage ? (
          <View style={[vS.footer, { paddingBottom: insets.bottom + 18 }]}>
            <BlurView intensity={70} tint="dark" style={vS.footerBlur}>
              {/* Save */}
              <TouchableOpacity style={vS.footerBtn} onPress={handleSave} disabled={saving} activeOpacity={0.75}>
                {saving ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Ionicons name="arrow-down-circle-outline" size={26} color="#FFF" />
                )}
                <Text style={vS.footerBtnLabel}>Save</Text>
              </TouchableOpacity>

              <View style={vS.footerDivider} />

              {/* Edit */}
              {onEdit ? (
                <>
                  <TouchableOpacity style={vS.footerBtn} onPress={() => { onClose(); setTimeout(() => onEdit(), 150); }} activeOpacity={0.75}>
                    <Ionicons name="pencil-outline" size={26} color="#FFF" />
                    <Text style={vS.footerBtnLabel}>Edit</Text>
                  </TouchableOpacity>
                  <View style={vS.footerDivider} />
                </>
              ) : null}

              {/* Good */}
              <TouchableOpacity style={vS.footerBtn} onPress={handleGood} activeOpacity={0.75}>
                <Ionicons name={liked === 'like' ? 'thumbs-up' : 'thumbs-up-outline'} size={26} color={liked === 'like' ? '#34C759' : '#FFF'} />
                <Text style={[vS.footerBtnLabel, liked === 'like' && { color: '#34C759' }]}>Good</Text>
              </TouchableOpacity>

              <View style={vS.footerDivider} />

              {/* Bad */}
              <TouchableOpacity style={vS.footerBtn} onPress={handleBad} activeOpacity={0.75}>
                <Ionicons name={liked === 'dislike' ? 'thumbs-down' : 'thumbs-down-outline'} size={26} color={liked === 'dislike' ? '#FF453A' : '#FFF'} />
                <Text style={[vS.footerBtnLabel, liked === 'dislike' && { color: '#FF453A' }]}>Bad</Text>
              </TouchableOpacity>
            </BlurView>
          </View>
        ) : (
          /* User image: just save & share in bottom bar */
          <View style={[vS.footer, { paddingBottom: insets.bottom + 18 }]}>
            <BlurView intensity={70} tint="dark" style={vS.footerBlur}>
              <TouchableOpacity style={vS.footerBtn} onPress={handleSave} disabled={saving} activeOpacity={0.75}>
                {saving ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="arrow-down-circle-outline" size={26} color="#FFF" />}
                <Text style={vS.footerBtnLabel}>Save</Text>
              </TouchableOpacity>
              <View style={vS.footerDivider} />
              <TouchableOpacity style={vS.footerBtn} onPress={handleShare} disabled={sharing} activeOpacity={0.75}>
                {sharing ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="share-outline" size={26} color="#FFF" />}
                <Text style={vS.footerBtnLabel}>Share</Text>
              </TouchableOpacity>
            </BlurView>
          </View>
        )}

        {/* "…" dropdown */}
        <DotMenu
          visible={dotMenuVisible}
          onClose={() => setDotMenuVisible(false)}
          onGood={handleGood}
          onBad={handleBad}
          onHelp={handleHelp}
          insets={insets}
        />
      </Animated.View>
    </Modal>
  );
}

const vS = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 10,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  imgWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  image: { width: W - 16, height: H * 0.62, borderRadius: 16 },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    alignItems: 'center',
  },
  footerBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 8,
  },
  footerBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 14,
    gap: 4,
  },
  footerBtnLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '600' },
  footerDivider: { width: StyleSheet.hairlineWidth, height: 36, backgroundColor: 'rgba(255,255,255,0.15)' },
});
