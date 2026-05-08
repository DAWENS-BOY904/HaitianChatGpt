import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Dimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { WebView } from 'react-native-webview';
import { Spacing, BorderRadius } from '../constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const GLASS = {
  bg: 'rgba(18, 18, 18, 0.98)',
  surface: 'rgba(38, 38, 38, 0.90)',
  border: 'rgba(255, 255, 255, 0.08)',
  text: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.60)',
  accent: '#0A84FF',
};

interface CodeFile {
  name: string;
  path: string;
  content: string;
  language: string;
}

interface CodeProject {
  id: string;
  name: string;
  files: CodeFile[];
}

interface Props {
  visible: boolean;
  onClose: () => void;
  project: CodeProject;
}

export function CodePreviewModal({ visible, onClose, project }: Props) {
  const [loading, setLoading] = useState(true);

  // Generate HTML preview from project files
  const generatePreviewHTML = (): string => {
    // Find HTML, CSS, JS files
    const htmlFile = project.files.find(f => f.language === 'html');
    const cssFile = project.files.find(f => f.language === 'css');
    const jsFile = project.files.find(f => f.language === 'javascript');

    if (!htmlFile) {
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              margin: 0;
              padding: 40px;
              font-family: system-ui, -apple-system, sans-serif;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              text-align: center;
            }
            .container {
              max-width: 600px;
            }
            h1 {
              font-size: 32px;
              margin-bottom: 16px;
            }
            p {
              font-size: 18px;
              opacity: 0.9;
              line-height: 1.6;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>📄 Preview Not Available</h1>
            <p>This project does not contain HTML files. Preview is only available for web-based projects with HTML, CSS, and JavaScript.</p>
            <p><strong>Project:</strong> ${project.name}</p>
            <p><strong>Files:</strong> ${project.files.map(f => f.name).join(', ')}</p>
          </div>
        </body>
        </html>
      `;
    }

    // Combine HTML, CSS, JS into single preview
    let html = htmlFile.content;

    // Inject CSS
    if (cssFile) {
      html = html.replace('</head>', `<style>${cssFile.content}</style></head>`);
    }

    // Inject JS
    if (jsFile) {
      html = html.replace('</body>', `<script>${jsFile.content}</script></body>`);
    }

    return html;
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />

        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Ionicons name="close" size={24} color={GLASS.text} />
              </TouchableOpacity>
              <View>
                <Text style={styles.projectName}>Live Preview</Text>
                <Text style={styles.subtitle}>{project.name}</Text>
              </View>
            </View>

            <View style={styles.headerRight}>
              <View style={styles.statusBadge}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Live</Text>
              </View>
            </View>
          </View>

          {/* Preview Container */}
          <View style={styles.previewContainer}>
            {loading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color={GLASS.accent} />
                <Text style={styles.loadingText}>Loading preview...</Text>
              </View>
            )}

            <WebView
              source={{ html: generatePreviewHTML() }}
              style={styles.webview}
              onLoadStart={() => setLoading(true)}
              onLoadEnd={() => setLoading(false)}
              javaScriptEnabled
              domStorageEnabled
              startInLoadingState
              scalesPageToFit
              originWhitelist={['*']}
            />
          </View>

          {/* Footer Info */}
          <View style={styles.footer}>
            <Ionicons name="information-circle-outline" size={16} color={GLASS.textSecondary} />
            <Text style={styles.footerText}>
              This is a live sandbox preview. Changes are not published.
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  container: {
    flex: 1,
    marginTop: Platform.OS === 'ios' ? 50 : 30,
    backgroundColor: GLASS.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: GLASS.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: GLASS.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  closeButton: {
    padding: 8,
    marginRight: Spacing.sm,
  },
  projectName: {
    fontSize: 18,
    fontWeight: '700',
    color: GLASS.text,
  },
  subtitle: {
    fontSize: 13,
    color: GLASS.textSecondary,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(48, 209, 88, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(48, 209, 88, 0.3)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#30D158',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#30D158',
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    margin: Spacing.md,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: GLASS.border,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: GLASS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  loadingText: {
    fontSize: 14,
    color: GLASS.text,
    marginTop: Spacing.md,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: GLASS.border,
  },
  footerText: {
    fontSize: 12,
    color: GLASS.textSecondary,
  },
});
