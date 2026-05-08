// Powered by OnSpace.AI
import { Stack } from 'expo-router';

// Minimal layout wrapper for the (tabs) group
// The index screen redirects immediately to /home
export default function TabLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
