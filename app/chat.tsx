import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';

export default function ChatScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </TouchableOpacity>
      <View style={styles.center}>
        <Ionicons name="chatbubbles-outline" size={64} color={colors.textSecondary} />
        <Text style={[styles.title, { color: colors.text }]}>Chat</Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>
          Go to the home screen to start an AI conversation.
        </Text>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.primary }]}
          onPress={() => router.replace('/home')}
        >
          <Text style={styles.btnText}>Go to Home</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backBtn: {
    position: 'absolute',
    top: 56,
    left: 16,
    zIndex: 10,
    padding: 8,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  sub: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  btn: {
    marginTop: 8,
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 24,
  },
  btnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
