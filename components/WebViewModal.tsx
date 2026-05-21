import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { useTheme } from '../hooks/useTheme';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface WebViewModalProps {
  visible: boolean;
  url: string;
  onClose: () => void;
}

export function WebViewModal({ visible, url, onClose }: WebViewModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const webViewRef = useRef<WebView>(null);

  const handleGoBack = () => {
    webViewRef.current?.goBack();
  };

  const handleGoForward = () => {
    webViewRef.current?.goForward();
  };

  const handleRefresh = () => {
    webViewRef.current?.reload();
  };

  // 🔗 OPEN IN SAFARI / ANDROID BROWSER
  const openExternal = () => {
    Linking.openURL(url).catch(err =>
      console.warn('Failed to open URL:', err),
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: Platform.select({
        ios: insets.top,
        android: insets.top,
        default: 0,
      }),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      flex: 1,
    },
    closeButton: {
      width: 36,
      height: 36,
      borderRadius: BorderRadius.full,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    urlText: {
      ...Typography.body,
      color: colors.text,
      fontSize: 14,
      flex: 1,
    },
    webView: {
      flex: 1,
      backgroundColor: colors.background,
    },
    loadingContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      padding: Spacing.md,
      paddingBottom: Platform.select({
        ios: insets.bottom + Spacing.md,
        android: insets.bottom + Spacing.md,
        default: Spacing.md,
      }),
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    footerButton: {
      width: 44,
      height: 44,
      borderRadius: BorderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    footerButtonDisabled: {
      opacity: 0.3,
    },
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={20} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.urlText} numberOfLines={1}>
              {url}
            </Text>
          </View>
        </View>

        {/* WEBVIEW */}
        <WebView
          ref={webViewRef}
          source={{ uri: url }}
          style={styles.webView}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onNavigationStateChange={navState => {
            setCanGoBack(navState.canGoBack);
            setCanGoForward(navState.canGoForward);
          }}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          scalesPageToFit
        />

        {/* LOADING */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )}

        {/* FOOTER */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.footerButton,
              !canGoBack && styles.footerButtonDisabled,
            ]}
            onPress={handleGoBack}
            disabled={!canGoBack}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.footerButton,
              !canGoForward && styles.footerButtonDisabled,
            ]}
            onPress={handleGoForward}
            disabled={!canGoForward}
          >
            <Ionicons name="chevron-forward" size={24} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.footerButton}
            onPress={handleRefresh}
          >
            <Ionicons name="refresh" size={24} color={colors.text} />
          </TouchableOpacity>

          {/* 🆕 OPEN IN SAFARI / ANDROID */}
          <TouchableOpacity
            style={styles.footerButton}
            onPress={openExternal}
          >
            <Ionicons
              name={Platform.OS === 'ios' ? 'logo-apple' : 'logo-android'}
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.footerButton}
            onPress={onClose}
          >
            <Ionicons name="home" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
