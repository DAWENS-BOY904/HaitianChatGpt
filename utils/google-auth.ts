/**
 * google-auth.ts
 *
 * Platform-aware Google OAuth helper using YOUR OWN Google Console credentials.
 *
 * ─── SETUP (REQUIRED) ────────────────────────────────────────────────────────
 * 1. Go to https://console.cloud.google.com/ → APIs & Services → Credentials
 * 2. Create OAuth 2.0 Client IDs:
 *    - iOS:     Application type = iOS, Bundle ID = com.dawinix.app
 *    - Android: Application type = Android, Package name = com.dawinix.app
 *    - Web:     Application type = Web application
 *               Authorized redirect URIs: https://YOUR_SUPABASE_PROJECT.supabase.co/auth/v1/callback
 *
 * 3. Replace the placeholder values below with your real Client IDs
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * STRATEGY:
 * - iOS/Android: Uses @react-native-google-signin/google-signin (native SDK)
 *   → Gets an idToken from Google directly, then exchanges it with Supabase
 * - Web: Uses Supabase signInWithOAuth with your Web Client ID via popup/redirect
 */
please ai Update utils/google-auth so that on web, signInWithGoogleBrowser auto-detects the current origin: if it contains 'davetopup.com' it routes through the davetopup auth flow, and if it contains 'dawinix' it uses the dawinix.com callback — replacing the current hardcoded PUBLISHED_WEB_URL fallback logic.