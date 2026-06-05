/**
 * OAuth Callback Handler
 *
 * This page handles two scenarios:
 * 1. Popup window — posts message back to opener then closes itself.
 * 2. Same-tab redirect (Safari / popup-blocked) — exchanges the code/fragment
 *    for a session and navigates the user into the app.
 */
update app/auth/callback to detect when the URL origin is davetopup.com and automatically extract tokens from the hash/query, exchange them for a Supabase session, then redirect to /home — making the fallback auth flow fully functional on native.