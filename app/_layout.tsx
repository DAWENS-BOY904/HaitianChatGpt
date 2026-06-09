import { Stack } from 'expo-router';
import { AlertProvider, AuthProvider } from '@/template';
import { ThemeProvider } from '../contexts/ThemeContext';
import { ConversationProvider } from '../contexts/ConversationContext';
import { SettingsProvider } from '../contexts/SettingsContext';

export default function RootLayout() {
  return (
    <AlertProvider>
      <AuthProvider>
        <ThemeProvider>
          <SettingsProvider>
            <ConversationProvider>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="login" />
                <Stack.Screen name="home" />
                <Stack.Screen name="settings" />
              </Stack>
            </ConversationProvider>
          </SettingsProvider>
        </ThemeProvider>
      </AuthProvider>
    </AlertProvider>
  );
}
