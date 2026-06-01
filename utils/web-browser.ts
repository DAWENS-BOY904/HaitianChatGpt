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

/**
 * No-op on web — maybeCompleteAuthSession is not needed on web.
 */
export function maybeCompleteAuthSession(_options?: any): { type: string } {
  return { type: 'success' };
}

/**
 * Opens an auth session. On web, just opens the URL in the browser.
 */
export async function openAuthSessionAsync(
  url: string,
  redirectUrl?: string,
  options?: any
): Promise<{ type: string; url?: string }> {
  try {
    await Linking.openURL(url);
    return { type: 'opened' };
  } catch {
    return { type: 'cancel' };
  }
}
