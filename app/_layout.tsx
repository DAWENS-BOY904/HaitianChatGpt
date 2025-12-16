import { Stack } from 'expo-router';
import { AlertProvider, AuthProvider } from '@/template';
import { ThemeProvider } from '../contexts/ThemeContext';
import { ConversationProvider } from '../contexts/ConversationContext';
import { SettingsProvider } from '../contexts/SettingsContext';
import { SocialProvider } from '../contexts/SocialContext';

export default function RootLayout() {
  return (
    <AlertProvider>
      <AuthProvider>
        <ThemeProvider>
          <SettingsProvider>
            <SocialProvider>
              <ConversationProvider>
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="index" />
                  <Stack.Screen name="login" />
                  <Stack.Screen name="home" />
                  <Stack.Screen name="settings" />
                  <Stack.Screen name="social" />
                  <Stack.Screen name="chat" />
                  <Stack.Screen name="about" />
                </Stack>
              </ConversationProvider>
            </SocialProvider>
          </SettingsProvider>
        </ThemeProvider>
      </AuthProvider>
    </AlertProvider>
  );
}
