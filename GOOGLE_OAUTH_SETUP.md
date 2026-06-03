# Google OAuth & Apple Sign-In Setup Guide

Complete setup guide for Google OAuth and Apple Sign-In in the Dawinix app, including web integration.

---

## 1. Google OAuth Setup

### Step 1: Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Navigate to **APIs & Services → Credentials**
4. Click **+ Create Credentials → OAuth 2.0 Client ID**

#### For Mobile (iOS / Android):

**iOS:**
- Application type: **iOS**
- Bundle ID: `com.dawinix.app` (match your `app.json`)
- Download the `GoogleService-Info.plist`

**Android:**
- Application type: **Android**
- Package name: `com.dawinix.app`
- SHA-1 certificate fingerprint (run: `keytool -list -v -keystore ~/.android/debug.keystore`)

#### For Web:
- Application type: **Web application**
- Authorized JavaScript origins:
  ```
  http://localhost:3000
  https://yourdomain.com
  https://YOUR_PROJECT.supabase.co
  ```
- Authorized redirect URIs:
  ```
  https://YOUR_PROJECT.supabase.co/auth/v1/callback
  https://yourdomain.com/auth/callback
  http://localhost:3000/auth/callback
  ```

### Step 2: Enable Google Provider in Supabase

1. Open **OnSpace Cloud Dashboard → Users → Auth Settings**
2. Enable **Google** provider
3. Paste your **Client ID** and **Client Secret**
4. Set Redirect URL to: `https://YOUR_PROJECT.supabase.co/auth/v1/callback`

### Step 3: Mobile App Implementation (Current Setup)

The app uses `utils/google-auth.ts` for cross-platform Google sign-in:

```typescript
// utils/google-auth.ts
import { signInWithGoogleCrossPlatform } from '../utils/google-auth';

// In your login screen:
const { error } = await signInWithGoogleCrossPlatform();
if (error) {
  showAlert('Error', error);
  return;
}
// AuthRouter handles navigation automatically
```

### Step 4: Web Integration — Fetch Google OAuth Token

```typescript
// web/googleAuth.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://YOUR_PROJECT.supabase.co',
  'YOUR_ANON_KEY'
);

// Trigger Google OAuth redirect
async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: 'https://yourdomain.com/auth/callback',
      scopes: 'openid email profile',
      queryParams: {
        access_type: 'offline',  // Request refresh token
        prompt: 'consent',
      },
    },
  });

  if (error) {
    console.error('Google OAuth error:', error.message);
    return;
  }

  // Browser redirects to Google — after consent, redirected back to redirectTo URL
  console.log('Redirecting to Google...', data.url);
}

// Handle callback (on your /auth/callback page)
async function handleOAuthCallback() {
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error) {
    console.error('Session error:', error.message);
    return null;
  }

  if (session) {
    console.log('Logged in as:', session.user.email);
    console.log('Access token:', session.access_token);
    return session;
  }

  return null;
}
```

### Step 5: Fetch User Data After Google Login

```typescript
// After successful OAuth, fetch user profile
async function fetchUserAfterGoogleLogin(supabase: any) {
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) return null;

  // Get profile from your database
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return {
    id: user.id,
    email: user.email,
    name: user.user_metadata?.full_name,
    avatar: user.user_metadata?.avatar_url,
    profile,
  };
}
```

---

## 2. Apple Sign-In Setup

### Step 1: Apple Developer Configuration

1. Go to [Apple Developer Portal](https://developer.apple.com/)
2. Navigate to **Certificates, Identifiers & Profiles → Identifiers**
3. Select your App ID → Enable **Sign In with Apple**
4. Under **Keys**, create a new key:
   - Enable **Sign In with Apple**
   - Download the `.p8` key file (save it — you can only download once)
   - Note the **Key ID** and **Team ID**

### Step 2: Enable Apple Provider in Supabase

1. Open **OnSpace Cloud Dashboard → Users → Auth Settings**
2. Enable **Apple** provider
3. Configure:
   - **Service ID**: `com.dawinix.app.web` (create in Apple Developer Portal)
   - **Team ID**: From your Apple Developer account
   - **Key ID**: From the key you created
   - **Private Key**: Contents of the `.p8` file

### Step 3: Current Mobile Implementation (Production-Ready)

The current `app/login.tsx` already has a complete production Apple Sign-In implementation:

```typescript
// app/login.tsx — Apple Sign-In (already implemented)
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { createClient } from '@supabase/supabase-js';

// Separate Supabase client for Apple (uses your own Supabase project)
const appleSupabase = createClient(MY_SUPABASE_URL, MY_SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

const handleAppleSignIn = async () => {
  // 1. Generate secure nonce
  const rawNonce = generateRandomString(32);
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce
  );

  // 2. Generate state for CSRF protection
  const state = generateRandomString(16);

  // 3. Request Apple credential
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
    state,
  });

  // 4. Validate state (CSRF check)
  if (credential.state !== state) throw new Error('Invalid state');

  // 5. Exchange with Supabase
  const { data, error } = await appleSupabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce: rawNonce,  // Raw (unhashed) nonce
  });

  // 6. Sync session to main Supabase client
  if (data?.session) {
    const mainSupabase = getSupabaseClient();
    await mainSupabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
  }
};
```

### Step 4: Apple Sign-In for Web

Apple Sign-In on web requires a Service ID (different from App ID):

```typescript
// web/appleAuth.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://YOUR_PROJECT.supabase.co',
  'YOUR_ANON_KEY'
);

async function signInWithAppleWeb() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'apple',
    options: {
      redirectTo: 'https://yourdomain.com/auth/callback',
      scopes: 'name email',
    },
  });

  if (error) {
    console.error('Apple OAuth error:', error.message);
    return;
  }

  // Redirects to Apple sign-in page
  window.location.href = data.url;
}
```

### Step 5: Redirect URL Configuration for Apple

In the Apple Developer Portal, add these URLs to your Service ID:

**Domains and Subdomains:**
```
yourdomain.com
YOUR_PROJECT.supabase.co
```

**Return URLs:**
```
https://YOUR_PROJECT.supabase.co/auth/v1/callback
https://yourdomain.com/auth/callback
```

---

## 3. Auth Callback Handler (Web)

Create a `/auth/callback` page that handles the OAuth return:

```typescript
// pages/auth/callback.tsx (Next.js) or web/authCallback.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function AuthCallback() {
  // Supabase automatically handles the token exchange
  // Just need to check for the session
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error) {
    console.error('Auth callback error:', error);
    // Redirect to login with error
    window.location.href = '/login?error=' + encodeURIComponent(error.message);
    return;
  }

  if (session) {
    console.log('Auth successful for:', session.user.email);
    // Redirect to dashboard
    window.location.href = '/dashboard';
  } else {
    window.location.href = '/login';
  }
}
```

---

## 4. Environment Variables

### Supabase Dashboard (Secrets)
```
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
APPLE_CLIENT_ID=com.dawinix.app           # iOS Bundle ID
APPLE_SERVICES_ID=com.dawinix.app.web     # Web Service ID
APPLE_TEAM_ID=YOUR_TEAM_ID
APPLE_KEY_ID=YOUR_KEY_ID
APPLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
```

### App `.env` (Client-side)
```
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

---

## 5. Testing OAuth Flows

### Mobile Testing
- **iOS Simulator**: Apple Sign-In works, Google requires a physical device
- **Physical iPhone**: Both Apple and Google work
- **Android**: Google works; Apple not available

### Web Testing
```bash
# Local development
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Start dev server
npm run dev
# Navigate to http://localhost:3000/login
```

---

## 6. Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `ERR_REQUEST_CANCELED` | User dismissed Apple dialog | Expected behavior, ignore |
| `invalid_client` | Wrong Client ID/Secret | Verify credentials in Supabase dashboard |
| `redirect_uri_mismatch` | URL not whitelisted | Add URL to Google/Apple developer console |
| `invalid state` | CSRF check failed | Regenerate state parameter |
| `nonce mismatch` | Hashed vs raw nonce | Pass `rawNonce` to Supabase, `hashedNonce` to Apple |
| Token expired | Session not refreshed | Call `supabase.auth.refreshSession()` |

---

## Quick Reference

| Provider | Mobile | Web | Requires |
|----------|--------|-----|---------|
| Google | ✅ `signInWithGoogleCrossPlatform()` | ✅ `signInWithOAuth({ provider: 'google' })` | OAuth credentials |
| Apple | ✅ iOS only via `expo-apple-authentication` | ✅ via Supabase OAuth | Apple Developer account |
