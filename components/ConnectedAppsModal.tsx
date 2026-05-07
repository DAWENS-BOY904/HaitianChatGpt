import React from 'react';
import {
  View, Text, TouchableOpacity, Modal,
  StyleSheet, Platform, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { useRouter } from 'expo-router';

export interface ConnectedApp {
  id: string;
  name: string;
  description: string;
  color: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  connectedApps: ConnectedApp[];
  onSelectApp: (app: ConnectedApp) => void;
}

function SpotifyIcon({ size = 44 }: { size?: number }) {
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: '#1DB954', alignItems: 'center', justifyContent: 'center',
    }}>
      <View style={{ gap: Math.ceil(size * 0.06), alignItems: 'center' }}>
        {[1, 0.78, 0.56].map((w, i) => (
          <View key={i} style={{
            width: size * 0.52 * w,
            height: Math.ceil(size * 0.07),
            borderRadius: 2,
            backgroundColor: '#000',
          }} />
        ))}
      </View>
    </View>
  );
}

export function ConnectedAppsModal({ visible, onClose, connectedApps, onSelectApp }: Props) {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const textC = isDark ? '#FFF' : '#000';
  const subC = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';
  const cardBg = isDark ? '#2C2C2E' : '#FFF';
  const sheetBg = isDark ? '#1C1C1E' : '#F2F2F7';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        {Platform.OS === 'ios' ? (
          <BlurView
            intensity={isDark ? 60 : 50}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />
        )}
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />

        <View style={[styles.sheet, { backgroundColor: sheetBg, paddingBottom: insets.bottom + 20 }]}>
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }]} />

          <Text style={[styles.title, { color: textC }]}>Connected Apps</Text>
          <Text style={[styles.subtitle, { color: subC }]}>
            Tap an app to use it in your conversation
          </Text>

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
          >
            {connectedApps.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={[styles.emptyIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
                  <Ionicons name="apps-outline" size={28} color={subC} />
                </View>
                <Text style={[styles.emptyTitle, { color: textC }]}>No apps connected</Text>
                <Text style={[styles.emptySub, { color: subC }]}>
                  Connect apps like Spotify to enhance your AI experience
                </Text>
                <TouchableOpacity
                  style={[styles.browseBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)' }]}
                  onPress={() => { onClose(); router.push('/app-connect'); }}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.browseBtnText, { color: textC }]}>Browse Apps</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {connectedApps.map((app) => (
                  <TouchableOpacity
                    key={app.id}
                    style={[styles.appRow, { backgroundColor: cardBg }]}
                    onPress={() => { onSelectApp(app); onClose(); }}
                    activeOpacity={0.72}
                  >
                    {app.id === 'spotify' ? (
                      <SpotifyIcon size={44} />
                    ) : (
                      <View style={[styles.appIconFallback, { backgroundColor: app.color }]}>
                        <Ionicons name="musical-notes" size={22} color="#FFF" />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: textC, fontSize: 16, fontWeight: '600' }}>{app.name}</Text>
                      <Text style={{ color: subC, fontSize: 13, marginTop: 2 }}>{app.description}</Text>
                    </View>
                    <View style={[styles.addChip, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)' }]}>
                      <Ionicons name="add" size={16} color={textC} />
                      <Text style={{ color: textC, fontSize: 13, fontWeight: '600' }}>Add</Text>
                    </View>
                  </TouchableOpacity>
                ))}

                {/* Browse more */}
                <TouchableOpacity
                  style={[styles.appRow, { backgroundColor: cardBg, marginTop: 8 }]}
                  onPress={() => { onClose(); router.push('/app-connect'); }}
                  activeOpacity={0.72}
                >
                  <View style={[styles.appIconFallback, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }]}>
                    <Ionicons name="grid-outline" size={22} color={textC} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: textC, fontSize: 16, fontWeight: '600' }}>Browse All Apps</Text>
                    <Text style={{ color: subC, fontSize: 13, marginTop: 2 }}>Connect more integrations</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={subC} />
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    alignSelf: 'center', marginBottom: 16,
  },
  title: {
    fontSize: 18, fontWeight: '700',
    textAlign: 'center', marginBottom: 4,
  },
  subtitle: {
    fontSize: 13, textAlign: 'center',
    marginBottom: 20, paddingHorizontal: 24,
  },
  emptyState: {
    alignItems: 'center', paddingVertical: 24, paddingHorizontal: 20,
  },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18, fontWeight: '700', marginBottom: 8,
  },
  emptySub: {
    fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24,
  },
  browseBtn: {
    borderRadius: 50, paddingHorizontal: 28, paddingVertical: 13,
    width: '100%', alignItems: 'center',
  },
  browseBtnText: { fontSize: 16, fontWeight: '600' },
  appRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 14, padding: 14,
    borderRadius: 16, marginBottom: 8,
  },
  appIconFallback: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  addChip: {
    flexDirection: 'row', alignItems: 'center',
    gap: 4, borderRadius: 50,
    paddingHorizontal: 12, paddingVertical: 7,
  },
});
