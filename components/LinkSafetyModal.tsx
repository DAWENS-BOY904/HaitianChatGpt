import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as WebBrowser from 'expo-web-browser';
import { useTheme } from '../hooks/useTheme';

interface LinkSafetyModalProps {
  visible: boolean;
  url: string;
  onClose: () => void;
  onConfirm: () => void;
}

export function LinkSafetyModal({
  visible,
  url,
  onClose,
  onConfirm,
}: LinkSafetyModalProps) {
  const { colors, isDark } = useTheme();

  const handleOpen = useCallback(async () => {
    onConfirm();
    onClose();
    try {
      // Open inside the app using Expo WebBrowser — never leaves the app
      await WebBrowser.openBrowserAsync(url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        toolbarColor: isDark ? '#000000' : '#FFFFFF',
        controlsColor: '#10A37F',
        dismissButtonStyle: 'close',
        showTitle: true,
        enableBarCollapsing: true,
      });
    } catch {
      // Fallback: open in-app browser with default options
      try { await WebBrowser.openBrowserAsync(url); } catch {}
    }
  }, [url, onConfirm, onClose, isDark]);

  const displayUrl = url.length > 60 ? url.slice(0, 57) + '...' : url;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <BlurView
          intensity={Platform.OS === 'ios' ? 60 : 80}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={[styles.card, { borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' }]}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 90 : 95}
            tint={isDark ? 'dark' : 'light'}
            style={styles.blurCard}
          >
            {/* Icon */}
            <View style={[styles.iconWrap, { backgroundColor: '#FF9F0A22' }]}>
              <Ionicons name="shield-outline" size={32} color="#FF9F0A" />
            </View>

            <Text style={[styles.title, { color: isDark ? '#FFF' : '#000' }]}>
              Opening External Link
            </Text>
            <Text style={[styles.body, { color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)' }]}>
              You are about to leave Dawinix and open an external website. Make sure you trust this link before continuing.
            </Text>

            {/* URL preview */}
            <View style={[styles.urlBox, {
              backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
            }]}>
              <Ionicons name="link-outline" size={15} color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)'} />
              <Text style={[styles.urlText, { color: isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.65)' }]} numberOfLines={2}>
                {displayUrl}
              </Text>
            </View>

            {/* Buttons */}
            <View style={styles.btnRow}>
              <TouchableOpacity
                style={[styles.btn, styles.cancelBtn, {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                }]}
                onPress={onClose}
                activeOpacity={0.75}
              >
                <Text style={[styles.cancelText, { color: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.7)' }]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btn, styles.openBtn, { backgroundColor: '#FF9F0A' }]}
                onPress={handleOpen}
                activeOpacity={0.8}
              >
                <Ionicons name="open-outline" size={16} color="#FFF" style={{ marginRight: 6 }} />
                <Text style={styles.openText}>Open Link</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 20,
  },
  blurCard: {
    padding: 24,
    alignItems: 'center',
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },
  body: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 16,
  },
  urlBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    width: '100%',
    marginBottom: 22,
  },
  urlText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  btn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  cancelBtn: {
    borderWidth: 1,
  },
  openBtn: {},
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  openText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
});
