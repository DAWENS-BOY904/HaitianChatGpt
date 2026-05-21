// Web fallback — expo-web-browser is not available on web
import { Linking } from 'react-native';

export async function openBrowserAsync(url: string, _options?: any): Promise<void> {
  await Linking.openURL(url);
}

export function dismissBrowser(): void {
  // no-op on web
}
