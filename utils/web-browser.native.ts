/**
 * Native platform — use expo-web-browser (SFSafariViewController / Chrome Custom Tabs)
 * Stays fully in-app, never launches external Safari or Chrome.
 */
export { openBrowserAsync, openAuthSessionAsync, dismissBrowser, warmUpAsync, coolDownAsync, maybeCompleteAuthSession } from 'expo-web-browser';
