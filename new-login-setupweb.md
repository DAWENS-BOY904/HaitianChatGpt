# Web Login & OAuth Origin Auto-Detection

This document covers the origin auto-detection logic implemented in `utils/google-auth.ts` and `app/auth/callback.tsx` for the `davetopup.com` and `dawinix.com` web deployments.

---

## Overview

When the app is served from different web domains, the Google OAuth redirect URL and post-auth navigation destination must match the current origin. Both files implement the same detection pattern:

```ts
const origin = window.location.origin.toLowerCase();
if (origin.includes('davetopup.com')) → use davetopup.com flow
if (origin.includes('dawinix'))       → use dawinix.com flow
otherwise                             → use Supabase default
```

---

## utils/google-auth.ts

### `getWebCallbackUrl(): string | undefined`

Runs only on `Platform.OS === 'web'`. Returns the OAuth redirect URI to pass to Supabase `signInWithOAuth`.

| Origin contains | Redirect URI |
|---|---|
| `davetopup.com` | `https://davetopup.com/auth/callback` |
| `dawinix` | `https://dawinix.com/auth/callback` |
| anything else | `undefined` (Supabase uses its configured Site URL) |

### Flow

1. `signInWithGoogleCrossPlatform()` dispatches to `signInWithGoogleBrowser()` on web.
2. `signInWithGoogleBrowser()` calls `getWebCallbackUrl()` and injects the result into the Supabase OAuth options.
3. A popup is opened. If the popup is blocked, the user is redirected in the same tab.
4. On popup success, a `postMessage` of type `supabase:oauth:callback` is sent to the opener, which exchanges the code/tokens for a session.

---

## app/auth/callback.tsx

### `getPostAuthRedirect(): string`

Determines where to navigate after a successful sign-in on the callback page.

| Origin contains | Post-auth destination |
|---|---|
| `davetopup.com` | `https://davetopup.com/home` (full redirect via `window.location.href`) |
| `dawinix` | `https://dawinix.com/home` (full redirect via `window.location.href`) |
| anything else | `/home` (in-app navigation via `router.replace`) |

### Scenarios handled

| Scenario | Handling |
|---|---|
| Opened as popup | Posts `supabase:oauth:callback` message to opener, then closes itself |
| PKCE code in query string | `supabase.auth.exchangeCodeForSession(url)` |
| Implicit tokens in URL fragment | `supabase.auth.setSession(...)` then `refreshSession()` |
| No tokens (session already set) | Checks `getSession()` and proceeds |
| Error param in URL | Displays error and redirects to `/login` after 3 seconds |

---

## Required Redirect URI Configuration

In your **Google Cloud Console** (APIs & Services → Credentials → Web Client):

```
Authorized redirect URIs:
  https://YOUR_SUPABASE_PROJECT.supabase.co/auth/v1/callback
  https://davetopup.com/auth/callback
  https://dawinix.com/auth/callback
```

In your **Supabase Dashboard** (Authentication → URL Configuration):

```
Site URL:
  https://davetopup.com   (or dawinix.com depending on primary domain)

Additional Redirect URLs:
  https://davetopup.com/auth/callback
  https://dawinix.com/auth/callback
  http://localhost:8081/auth/callback
```

---

## Environment Variables

```env
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=your-ios-client-id.apps.googleusercontent.com
```
