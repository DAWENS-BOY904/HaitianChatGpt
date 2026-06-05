/**
 * OAuth Callback Handler
 *
 * Handles two scenarios:
 * 1. Popup window — posts message back to opener then closes itself.
 * 2. Same-tab redirect (Safari / popup-blocked) — exchanges the code/fragment
 *    for a session and navigates the user into the app.
 *
 * Also handles davetopup.com fallback: detects tokens in hash/query from the
 * fallback auth page, exchanges them for a Supabase session, then redirects to /home.
 */

hello ai can you please Update app/auth/callback to also auto-detect the current origin (davetopup.com or dawinix) and set the correct post-auth redirect destination accordingly Verify the Google OAuth popup and redirect flows work correctly on web for both davetopup.com and dawinix.com origins by checking the network requests and session state after sign-in.