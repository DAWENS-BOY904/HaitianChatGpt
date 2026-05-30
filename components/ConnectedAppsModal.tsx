// BY DAWENS
// BY DAWENS
import React, { useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Modal,
  StyleSheet, Platform, ScrollView, Animated,
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
  mentionMode?: boolean;
  mentionQuery?: string;
}

// Icon components (unchanged)
function SpotifyIcon({ size = 44 }: { size?: number }) { /* ... unchanged ... */ }
function ShazamIcon({ size = 44 }: { size?: number }) { /* ... unchanged ... */ }
function AppleMusicIcon({ size = 44 }: { size?: number }) { /* ... unchanged ... */ }
function AppIcon({ app, size = 44 }: { app: ConnectedApp; size?: number }) { /* ... unchanged ... */ }

const ALL_KNOWN_APPS = [ /* ... unchanged ... */ ];

export function ConnectedAppsModal({ visible, onClose, connectedApps, onSelectApp, mentionMode, mentionQuery }: Props) {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const textC = isDark ? '#FFF' : '#000';
  const subC = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';
  const divC = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

  const mentionSlideAnim = useRef(new Animated.Value(40)).current;
  const mentionFadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && mentionMode) {
      Animated.parallel([
        Animated.spring(mentionSlideAnim, { toValue: 0, tension: 340, friction: 28, useNativeDriver: true }),
        Animated.timing(mentionFadeAnim, { toValue: 1, duration: 160, useNativeDriver: true }),
      ]).start();
    } else {
      mentionSlideAnim.setValue(40);
      mentionFadeAnim.setValue(0);
    }
  }, [visible, mentionMode]);

  const filteredMentionApps = mentionQuery && mentionQuery.length > 0
    ? ALL_KNOWN_APPS.filter(a => a.name.toLowerCase().startsWith(mentionQuery.toLowerCase()))
    : ALL_KNOWN_APPS;

  const handleMentionAppSelect = (appId: string) => {
    const syntheticApp: ConnectedApp = {
      id: appId,
      name: ALL_KNOWN_APPS.find(a => a.id === appId)?.name || appId,
      description: ALL_KNOWN_APPS.find(a => a.id === appId)?.description || '',
      color: appId === 'spotify' ? '#1DB954' : appId === 'shazam' ? '#0D72EA' : '#FC3C44',
    };
    onSelectApp(syntheticApp);
    onClose();
  };

  // ── @ Mention Popup (Floating Blur Card) ─────────────────────────────────
  if (mentionMode) {
    return (
      <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />

        <Animated.View
          style={{
            paddingHorizontal: 12,
            paddingBottom: 80,
            opacity: mentionFadeAnim,
            transform: [{ translateY: mentionSlideAnim }],
          }}
        >
          {Platform.OS === 'ios' ? (
            <BlurView
              intensity={isDark ? 92 : 88}
              tint={isDark ? 'dark' : 'extraLight'}
              style={[mentionStyles.card, { overflow: 'hidden', borderWidth: 0.5, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' }]}
            >
              {filteredMentionApps.length === 0 ? (
                <View style={{ paddingHorizontal: 16, paddingVertical: 18, alignItems: 'center' }}>
                  <Text style={{ color: subC, fontSize: 14 }}>No apps match</Text>
                </View>
              ) : filteredMentionApps.map((app, i) => {
                const isConnected = !!connectedApps.find(c => c.id === app.id);
                return (
                  <TouchableOpacity
                    key={app.id}
                    style={[
                      mentionStyles.row,
                      i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: divC },
                    ]}
                    onPress={() => handleMentionAppSelect(app.id)}
                    activeOpacity={0.72}
                  >
                    <View style={[mentionStyles.iconWrap, { backgroundColor: app.color }]}>
                      <AppIcon app={{ ...app, description: '' }} size={36} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: textC, fontSize: 15, fontWeight: '600' }}>{app.name}</Text>
                      <Text style={{ color: subC, fontSize: 12, marginTop: 1 }} numberOfLines={1}>{app.description}</Text>
                    </View>
                    {isConnected ? (
                      <View style={[mentionStyles.badge, { backgroundColor: 'rgba(52,199,89,0.18)' }]}>
                        <Text style={{ color: '#34C759', fontSize: 10, fontWeight: '700' }}>Connected</Text>
                      </View>
                    ) : (
                      <View style={[mentionStyles.badge, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }]}>
                        <Text style={{ color: subC, fontSize: 10, fontWeight: '600' }}>Connect</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </BlurView>
          ) : (
            <View style={[mentionStyles.card, { 
              backgroundColor: isDark ? 'rgba(44,44,46,0.95)' : 'rgba(255,255,255,0.95)', 
              overflow: 'hidden' 
            }]}>
              {/* Same content as above - unchanged for Android */}
              {filteredMentionApps.length === 0 ? (
                <View style={{ paddingHorizontal: 16, paddingVertical: 18, alignItems: 'center' }}>
                  <Text style={{ color: subC, fontSize: 14 }}>No apps match</Text>
                </View>
              ) : filteredMentionApps.map((app, i) => { /* ... same mapping ... */ })}
            </View>
          )}
        </Animated.View>
      </Modal>
    );
  }

  // ── Main Bottom Sheet with Blur Card ─────────────────────────────────────
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        {/* Backdrop Blur */}
        {Platform.OS === 'ios' ? (
          <BlurView
            intensity={isDark ? 65 : 55}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)' }]} />
        )}

        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />

        {/* Main Blur Sheet */}
        {Platform.OS === 'ios' ? (
          <BlurView
            intensity={isDark ? 88 : 92}
            tint={isDark ? 'dark' : 'light'}
            style={[styles.sheet, { 
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              overflow: 'hidden',
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
            }]}
          >
            {/* Handle */}
            <View style={[styles.handle, { backgroundColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)' }]} />

            <Text style={[styles.title, { color: textC }]}>Connected Apps</Text>
            <Text style={[styles.subtitle, { color: subC }]}>
              Tap an app to use it in your conversation
            </Text>

            <ScrollView
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 20 }}
              showsVerticalScrollIndicator={false}
            >
              {connectedApps.length === 0 ? (
                /* Empty state - unchanged */
                <View style={styles.emptyState}>
                  <View style={[styles.emptyIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }]}>
                    <Ionicons name="apps-outline" size={28} color={subC} />
                  </View>
                  <Text style={[styles.emptyTitle, { color: textC }]}>No apps connected</Text>
                  <Text style={[styles.emptySub, { color: subC }]}>
                    Connect apps like Spotify and Shazam to enhance your AI experience
                  </Text>
                  <TouchableOpacity
                    style={[styles.browseBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }]}
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
                      style={[styles.appRow, { 
                        backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.75)',
                        borderWidth: StyleSheet.hairlineWidth,
                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                      }]}
                      onPress={() => { onSelectApp(app); onClose(); }}
                      activeOpacity={0.72}
                    >
                      <AppIcon app={app} size={44} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: textC, fontSize: 16, fontWeight: '600' }}>{app.name}</Text>
                        <Text style={{ color: subC, fontSize: 13, marginTop: 2 }}>{app.description}</Text>
                      </View>
                      <View style={[styles.addChip, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.07)' }]}>
                        <Ionicons name="add" size={16} color={textC} />
                        <Text style={{ color: textC, fontSize: 13, fontWeight: '600' }}>Add</Text>
                      </View>
                    </TouchableOpacity>
                  ))}

                  {/* Browse more */}
                  <TouchableOpacity
                    style={[styles.appRow, { 
                      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.75)',
                      borderWidth: StyleSheet.hairlineWidth,
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                      marginTop: 8 
                    }]}
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
          </BlurView>
        ) : (
          // Android fallback (semi-transparent card)
          <View style={[styles.sheet, { 
            backgroundColor: isDark ? 'rgba(28,28,30,0.95)' : 'rgba(242,242,247,0.95)',
            paddingBottom: insets.bottom + 20 
          }]}>
            {/* Same content as iOS BlurView above */}
            {/* ... (copy the content from the BlurView block) ... */}
          </View>
        )}
      </View>
    </Modal>
  );
}

// Styles
const mentionStyles = StyleSheet.create({
  card: {
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 16,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
});

const styles = StyleSheet.create({
  sheet: {
    paddingTop: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 24,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  browseBtn: {
    borderRadius: 50,
    paddingHorizontal: 28,
    paddingVertical: 13,
    width: '100%',
    alignItems: 'center',
  },
  browseBtnText: { fontSize: 16, fontWeight: '600' },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 16,
    marginBottom: 8,
  },
  appIconFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 50,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
});
