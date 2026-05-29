// Web fallback — expo-web-browser is not available on web
import * as WebBrowser from 'expo-web-browser';
import { Linking, Platform } from 'react-native';

/**
 * Opens a URL in an in-app browser on native platforms (iOS/Android) 
 * to ensure the user never leaves the app context.
 * Falls back to Linking.openURL on web where expo-web-browser 
 * might not be available or desired.
 */
export async function openBrowserAsync(url: string, options?: WebBrowser.WebBrowserOpenOptions): Promise<void> {
  if (Platform.OS === 'web') {
    // On web, expo-web-browser typically just opens a new tab.
    // Using Linking.openURL is the standard fallback.
    await Linking.openURL(url);
  } else {
    // On native, this opens an SFSafariViewController (iOS) or 
    // Chrome Custom Tabs (Android), which keeps the user inside the app.
    await WebBrowser.openBrowserAsync(url, {
      ...options,
      // Ensure the browser appears as a modal/sheet where possible
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
    });
  }
}

/**
 * Dismisses the in-app browser. 
 * This is a no-op on web as there is no programmatic way to close a tab/window 
 * not opened by the script (and usually not desired for tabs).
 */
export function dismissBrowser(): void {
  if (Platform.OS !== 'web') {
    WebBrowser.dismissBrowser();
  }
}
