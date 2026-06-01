import { Stack } from 'expo-router';

export default function AuthGroupLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="callback" />
    </Stack>
  );
}
