// Web fallback — expo-web-browser is not available on web platform
import { Linking } from 'react-native';

/**
 * Opens a URL. On web this uses Linking.openURL since expo-web-browser
 * is not available on the web platform.
 */
export async function openBrowserAsync(url: string, options?: any): Promise<void> {
  await Linking.openURL(url);
}

/**
 * No-op on web — there is no in-app browser to dismiss.
 */
export function dismissBrowser(): void {
  // no-op on web
}
