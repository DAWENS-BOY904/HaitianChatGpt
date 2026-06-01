# Settings Pages — Full Web Fetch Guide

This guide explains **how to fetch every Settings page** into your web app, connected to the same Supabase backend used in the mobile app.

---

## 🔐 1. Google Auth Fix (Web + App)

### Problem
Safari shows **"invalid address"** when `redirectTo` is `window.location.origin` inside an iframe (OnSpace Live Preview runs inside one).

### Fix (already applied in `utils/google-auth.ts` and `utils/web-browser.ts`)
```ts
// utils/google-auth.ts
const PUBLISHED_WEB_URL = 'https://dawinixht.onspace.app';

function getWebCallbackUrl(): string {
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    // Only use runtime origin if it's the real published domain
    const isTrusted = origin.includes('onspace.app') || origin.includes('dawinixht');
    if (isTrusted) return `${origin}/auth/callback`;
  }
  return `${PUBLISHED_WEB_URL}/auth/callback`;
}
```

### Required Supabase Redirect URLs
Go to **Supabase Dashboard → Authentication → URL Configuration → Redirect URLs** and add:
```
https://dawinixht.onspace.app/auth/callback
dawinixht://home
```

### Required Google Cloud OAuth Settings
Go to **Google Cloud Console → Credentials → OAuth 2.0 Client → Authorized Redirect URIs** and add:
```
https://dawinixht.onspace.app/auth/callback
```

### For your Web App
Add your web app URL too:
```
https://your-web-domain.com/auth/callback
```

---

## 📢 2. Notifications Page

**File:** `app/notifications.tsx`  
**Database:** `notification_settings` table (user_id → push/email toggles per category)

### Web Fetch
```ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Load notification settings
async function getNotificationSettings(userId: string) {
  const { data, error } = await supabase
    .from('notification_settings')
    .select('*')
    .eq('user_id', userId)
    .single();
  return data;
}

// Update a setting
async function updateNotificationSetting(userId: string, key: string, value: boolean) {
  await supabase
    .from('notification_settings')
    .upsert({ user_id: userId, [key]: value }, { onConflict: 'user_id' });
}
```

### Settings Keys in DB
| Key | Type | Description |
|-----|------|-------------|
| `responses_push` | boolean | AI response push notifications |
| `responses_email` | boolean | AI response email notifications |
| `group_chats_push` | boolean | Group chat push |
| `group_chats_email` | boolean | Group chat email |
| `tasks_push` | boolean | Task updates push |
| `tasks_email` | boolean | Task updates email |
| `projects_push` | boolean | Projects push |
| `projects_email` | boolean | Projects email |
| `recommendations_push` | boolean | Recommendations push |
| `recommendations_email` | boolean | Recommendations email |

---

## 👨‍👩‍👧 3. Parental Controls Page

**File:** `app/parental-controls.tsx`  
**Tables:** `family_members`, `parental_invitations`

### Web Fetch
```ts
// Get children list (if user is a parent)
async function getChildren(parentId: string) {
  const { data } = await supabase
    .from('family_members')
    .select(`
      id, daily_message_limit, content_filter_enabled, created_at,
      child:user_profiles!child_id(id, email, username, profile_photo_url)
    `)
    .eq('parent_id', parentId);
  return data;
}

// Send parental invitation
async function sendParentalInvitation(parentId: string, childEmail: string) {
  const code = Math.random().toString(36).substring(2, 10).toUpperCase();
  const { data } = await supabase.from('parental_invitations').insert({
    parent_id: parentId,
    child_email: childEmail,
    invitation_code: code,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  }).select().single();
  return data;
}

// Update child limits
async function updateChildLimits(memberId: string, dailyLimit: number, filterEnabled: boolean) {
  await supabase.from('family_members').update({
    daily_message_limit: dailyLimit,
    content_filter_enabled: filterEnabled,
  }).eq('id', memberId);
}

// Remove child
async function removeChild(parentId: string, childId: string) {
  await supabase.from('family_members')
    .delete()
    .eq('parent_id', parentId)
    .eq('child_id', childId);
}
```

---

## 🔒 4. Security Page

**File:** `app/security.tsx`  
**Tables:** `security_settings`, Supabase Auth MFA

### 4a. Password Change (Web → syncs to App)
```ts
// Edge Function: change-password
async function changePassword(newPassword: string) {
  const { data, error } = await supabase.functions.invoke('change-password', {
    body: { newPassword },
  });
  return { data, error };
}

// Or directly via supabase auth (requires re-auth):
async function changePasswordDirect(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  return error;
}
```

### 4b. MFA Status (Authenticator App)
```ts
// List all MFA factors
async function getMFAStatus() {
  const { data } = await supabase.auth.mfa.listFactors();
  const verified = data?.all?.filter(f => f.status === 'verified') || [];
  return {
    totpEnabled: verified.some(f => f.factor_type === 'totp'),
    phoneEnabled: verified.some(f => f.factor_type === 'phone'),
  };
}

// Enroll TOTP (returns QR code URL)
async function enrollTOTP() {
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
  return { qrCode: data?.totp?.qr_code, secret: data?.totp?.secret, error };
}

// Verify TOTP enrollment
async function verifyTOTP(factorId: string, code: string) {
  const { data: challenge } = await supabase.auth.mfa.challenge({ factorId });
  const { error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge!.id,
    code,
  });
  return error;
}

// Unenroll TOTP
async function unenrollMFA(factorId: string) {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  return error;
}
```

### 4c. Passkeys
```ts
// Passkeys are stored in user_api_keys with key_name = 'passkey'
async function getPasskeys(userId: string) {
  const { data } = await supabase
    .from('user_api_keys')
    .select('id, key_name, created_at')
    .eq('user_id', userId)
    .eq('key_name', 'passkey')
    .eq('is_active', true);
  return data;
}

// Delete passkey
async function deletePasskey(passkeyId: string) {
  await supabase.from('user_api_keys').update({ is_active: false }).eq('id', passkeyId);
}
```

### 4d. Log Out of All Devices
```ts
// Revokes ALL sessions for the user across all devices
async function logOutAllDevices() {
  const { error } = await supabase.auth.signOut({ scope: 'global' });
  return error;
}
```

---

## 🗃️ 5. Data Controls Page

**File:** `app/data-controls.tsx`

### 5a. Shared Links — Manage
```ts
// Fetch user's shared chat links (if you track them)
async function getSharedLinks(userId: string) {
  const { data } = await supabase
    .from('activity_logs')
    .select('id, details, created_at')
    .eq('user_id', userId)
    .eq('action_type', 'share')
    .order('created_at', { ascending: false });
  return data;
}

// Delete a shared link record
async function deleteSharedLink(logId: string) {
  await supabase.from('activity_logs').delete().eq('id', logId);
}
```

### 5b. Archived Chats — Manage
```ts
// Get all archived conversations
async function getArchivedChats(userId: string) {
  const { data } = await supabase
    .from('conversations')
    .select('id, title, created_at, updated_at')
    .eq('user_id', userId)
    .eq('is_archived', true)
    .order('updated_at', { ascending: false });
  return data;
}

// Unarchive a conversation
async function unarchiveChat(conversationId: string) {
  await supabase.from('conversations')
    .update({ is_archived: false })
    .eq('id', conversationId);
}
```

### 5c. Archive ALL Chats
```ts
async function archiveAllChats(userId: string) {
  const { error } = await supabase
    .from('conversations')
    .update({ is_archived: true })
    .eq('user_id', userId)
    .eq('is_archived', false);
  return error;
}
```

### 5d. Delete ALL Chats
```ts
// This cascades to messages via FK
async function deleteAllChats(userId: string) {
  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('user_id', userId);
  return error;
}
```

### 5e. Export Data
```ts
// Request data export — logs the request, email sent by backend
async function requestDataExport(userId: string, email: string) {
  await supabase.from('activity_logs').insert({
    user_id: userId,
    action: 'data_export_requested',
    action_type: 'data',
    details: { email, requested_at: new Date().toISOString() },
  });
  // Optionally trigger an edge function to generate the export
  // await supabase.functions.invoke('export-user-data', { body: { userId, email } });
}

// Full export: fetch everything
async function exportUserData(userId: string) {
  const [conversations, messages, settings, profile] = await Promise.all([
    supabase.from('conversations').select('*').eq('user_id', userId),
    supabase.from('messages').select('m.*').eq('c.user_id', userId), // via join
    supabase.from('user_settings').select('*').eq('user_id', userId).single(),
    supabase.from('user_profiles').select('*').eq('id', userId).single(),
  ]);
  return { conversations: conversations.data, settings: settings.data, profile: profile.data };
}
```

### 5f. Marketing Privacy Toggle
```ts
async function updateMarketingPrivacy(userId: string, enabled: boolean) {
  await supabase.from('user_settings').upsert({
    user_id: userId,
    marketing_privacy: enabled,
  }, { onConflict: 'user_id' });
}
```

---

## 📣 6. Ads Controls Page

**File:** `app/ads-controls.tsx`  
**Tables:** `ad_history`, user_settings

### 6a. Fetch Ad History
```ts
async function getAdHistory(userId: string) {
  const { data } = await supabase
    .from('ad_history')
    .select('id, query, source_name, source_icon, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  return data;
}

// Delete single ad history entry
async function deleteAdHistoryEntry(entryId: string) {
  await supabase.from('ad_history').delete().eq('id', entryId);
}
```

### 6b. Delete All Ad Data
```ts
async function deleteAllAdData(userId: string) {
  await supabase.from('ad_history').delete().eq('user_id', userId);
  // Also reset interest flags in user_settings
  await supabase.from('user_settings').update({
    personalize_ads: false,
    past_chats_memory: false,
  }).eq('user_id', userId);
}
```

### 6c. Ad Personalization Toggles
```ts
// Store in user_settings table
async function updateAdPersonalization(userId: string, key: 'personalize_ads' | 'past_chats_memory', value: boolean) {
  await supabase.from('user_settings').upsert({
    user_id: userId,
    [key]: value,
  }, { onConflict: 'user_id' });
}
```

---

## 🔌 7. App Connect (Spotify, Shazam, etc.)

**File:** `app/app-connect.tsx`, `app/spotify-connect.tsx`, `app/shazam-connect.tsx`

### 7a. Spotify Connect
```ts
// Spotify OAuth via our Edge Function
async function connectSpotify() {
  const { data, error } = await supabase.functions.invoke('spotify-connect', {
    body: { action: 'get_auth_url', redirectUri: `${window.location.origin}/auth/spotify` },
  });
  // Redirect user to data.authUrl
  window.location.href = data.authUrl;
}

// Fetch Spotify status (connected or not)
async function getSpotifyStatus(userId: string) {
  const { data } = await supabase
    .from('user_api_keys')
    .select('id, key_value, created_at')
    .eq('user_id', userId)
    .eq('key_name', 'spotify_access_token')
    .eq('is_active', true)
    .single();
  return { connected: !!data, token: data?.key_value };
}

// Disconnect Spotify
async function disconnectSpotify(userId: string) {
  await supabase.from('user_api_keys')
    .update({ is_active: false })
    .eq('user_id', userId)
    .eq('key_name', 'spotify_access_token');
}

// Fetch current playing track
async function getCurrentTrack(accessToken: string) {
  const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 204) return null; // nothing playing
  return res.json();
}

// Fetch user's Spotify profile
async function getSpotifyProfile(accessToken: string) {
  const res = await fetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.json();
}
```

### 7b. Shazam Identify (via Edge Function)
```ts
async function identifySong(audioBase64: string) {
  const { data, error } = await supabase.functions.invoke('shazam-identify', {
    body: { audio: audioBase64 },
  });
  return { track: data?.track, error };
}
```

### 7c. Connected Apps State (AsyncStorage → Web: localStorage)
```ts
// Web equivalent of AsyncStorage.getItem('connected_apps')
function getConnectedApps(): Set<string> {
  try {
    const raw = localStorage.getItem('connected_apps');
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function saveConnectedApps(apps: Set<string>) {
  localStorage.setItem('connected_apps', JSON.stringify(Array.from(apps)));
}
```

---

## 🎨 8. Personalization Page

**File:** `app/personalization.tsx`  
**Table:** `user_settings`

### Fetch & Save
```ts
// Load personalization settings
async function getPersonalizationSettings(userId: string) {
  const { data } = await supabase
    .from('user_settings')
    .select('base_tone, custom_instructions, nickname, occupation, interests')
    .eq('user_id', userId)
    .single();
  return data;
}

// Save all personalization settings
async function savePersonalizationSettings(userId: string, settings: {
  base_tone: string;
  custom_instructions: string;
  nickname?: string;
  occupation?: string;
  interests?: string[];
}) {
  await supabase.from('user_settings').upsert({
    user_id: userId,
    ...settings,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
}
```

### Delete Account (Web → Auto-logout App)
```ts
// Delete account — cascades to all user data via FK constraints
async function deleteAccount(userId: string) {
  // 1. Delete user profile (cascades to all tables with ON DELETE CASCADE)
  await supabase.from('user_profiles').delete().eq('id', userId);
  // 2. Sign out
  await supabase.auth.signOut();
  // Note: The auth.users record is deleted by the cascade trigger on user_profiles
  // The app will detect session loss and auto-logout immediately
}
```

---

## 🔊 9. Voice Select & Spoken Language

**File:** `app/voice-select.tsx`, `app/Speech-Language.tsx`  
**Table:** `user_settings`

### Fetch Voice Settings
```ts
async function getVoiceSettings(userId: string) {
  const { data } = await supabase
    .from('user_settings')
    .select('voice_selection, main_language, app_language')
    .eq('user_id', userId)
    .single();
  return data;
}

// Update voice selection
async function updateVoiceSelection(userId: string, voice: string) {
  await supabase.from('user_settings').upsert({
    user_id: userId,
    voice_selection: voice,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
}

// Update spoken language
async function updateSpokenLanguage(userId: string, language: string) {
  await supabase.from('user_settings').upsert({
    user_id: userId,
    main_language: language,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
}
```

### Available Voices (matches app)
```ts
const VOICES = ['Alloy', 'Coral', 'Echo', 'Fable', 'Nova', 'Onyx', 'Shimmer'];
// Images: assets/images/voice-{name.toLowerCase()}.jpg
```

### Generate TTS (via Edge Function)
```ts
async function generateTTS(text: string, voice: string) {
  const { data, error } = await supabase.functions.invoke('generate-tts', {
    body: { text, voice: voice.toLowerCase() },
  });
  return { audioUrl: data?.url, error };
}
```

---

## 💾 10. Storage Page

**File:** Referenced in settings  
**Tables:** `media_files`  
**Buckets:** `media-files`, `profile-images`, `chat-images`

### Fetch Storage Usage
```ts
// Get all user's files
async function getUserFiles(userId: string) {
  const { data } = await supabase
    .from('media_files')
    .select('id, file_name, file_type, file_url, file_size, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return data;
}

// Calculate total storage used
async function getStorageUsage(userId: string) {
  const { data } = await supabase
    .from('media_files')
    .select('file_size')
    .eq('user_id', userId);
  const totalBytes = data?.reduce((sum, f) => sum + (f.file_size || 0), 0) || 0;
  return {
    bytes: totalBytes,
    mb: (totalBytes / 1024 / 1024).toFixed(2),
    gb: (totalBytes / 1024 / 1024 / 1024).toFixed(3),
  };
}

// Delete a file
async function deleteFile(fileId: string, fileUrl: string, userId: string) {
  // Extract path from URL for storage deletion
  const path = fileUrl.split('/media-files/')[1];
  if (path) {
    await supabase.storage.from('media-files').remove([path]);
  }
  await supabase.from('media_files').delete().eq('id', fileId);
}

// Get profile photo
async function getProfilePhoto(userId: string) {
  const { data } = await supabase
    .from('user_profiles')
    .select('profile_photo_url')
    .eq('id', userId)
    .single();
  return data?.profile_photo_url;
}

// Upload new profile photo (web)
async function uploadProfilePhoto(userId: string, file: File) {
  const ext = file.name.split('.').pop();
  const path = `${userId}/avatar.${ext}`;
  const { error } = await supabase.storage
    .from('profile-images')
    .upload(path, file, { upsert: true });
  if (error) return { error };
  const { data: { publicUrl } } = supabase.storage
    .from('profile-images')
    .getPublicUrl(path);
  // Update user profile
  await supabase.from('user_profiles').update({ profile_photo_url: publicUrl }).eq('id', userId);
  return { url: publicUrl };
}
```

---

## 💳 11. Subscription — Lite, Super (Pro), Plus, Free

**File:** `app/subscription.tsx`, `app/billing.tsx`  
**Tables:** `subscription_purchases`, `coin_subscription_plans`, `user_coin_subscriptions`

### Fetch Current Subscription
```ts
async function getCurrentSubscription(userId: string) {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('subscription_tier, subscription_expires_at, is_lifetime_member')
    .eq('id', userId)
    .single();

  const { data: stripeSub } = await supabase
    .from('subscription_purchases')
    .select('plan_id, status, expiry_date, stripe_subscription_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return { profile, activePurchase: stripeSub };
}

// Check subscription via Edge Function
async function checkSubscription() {
  const { data } = await supabase.functions.invoke('check-subscription');
  return data;
}
```

### Create Stripe Checkout (for web)
```ts
async function createCheckoutSession(planId: string, billingCycle: 'monthly' | 'yearly') {
  const { data, error } = await supabase.functions.invoke('create-checkout-session', {
    body: { planId, billingCycle, successUrl: `${window.location.origin}/subscription-success`, cancelUrl: window.location.href },
  });
  if (data?.url) window.location.href = data.url;
  return { error };
}

// Open Stripe Customer Portal
async function openCustomerPortal() {
  const { data } = await supabase.functions.invoke('customer-portal', {
    body: { returnUrl: window.location.href },
  });
  if (data?.url) window.location.href = data.url;
}
```

### Subscription Tiers
```ts
const PLANS = {
  free: { name: 'Free', messageLimit: 35, features: ['Basic AI', '35 messages/day'] },
  lite: { name: 'Lite', price: '$4.99/mo', features: ['500 messages/day', 'Voice input'] },
  plus: { name: 'Plus', price: '$9.99/mo', features: ['Unlimited messages', 'Image generation', 'Web search'] },
  super: { name: 'Super', price: '$19.99/mo', features: ['Everything in Plus', 'Priority access', 'Advanced models'] },
};
```

---

## 💬 12. Temporary Chat

**Table:** `conversations` with `is_temporary = true`

```ts
// Create a temporary (no-history) conversation
async function createTemporaryChat(userId: string) {
  const { data } = await supabase
    .from('conversations')
    .insert({
      user_id: userId,
      title: 'Temporary Chat',
      is_temporary: true,
    })
    .select()
    .single();
  return data;
}

// Clean up old temporary conversations
async function cleanupTemporaryChats(userId: string) {
  await supabase
    .from('conversations')
    .delete()
    .eq('user_id', userId)
    .eq('is_temporary', true);
}

// Guest temporary chat (no userId needed — stored locally)
function createGuestTemporaryChat() {
  const id = `guest-${Date.now()}`;
  return { id, title: 'Guest Chat', messages: [] };
}
```

---

## 🌐 13. Full Web Login Integration

### Setup (Web App)
```ts
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  'https://njpuoozygqtpvlzhnjpu.backend.onspace.ai',  // OnSpace Cloud URL
  'YOUR_ANON_KEY',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,  // Handles OAuth callbacks automatically
    },
  }
);
```

### Auth State Listener (mirrors app behavior)
```ts
// In your web app's root component
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    // User logged in — redirect to home
    window.location.href = '/home';
  } else if (event === 'SIGNED_OUT') {
    // User logged out — redirect to login
    window.location.href = '/login';
  } else if (event === 'PASSWORD_RECOVERY') {
    // Show password reset form
  }
});
```

### Fetch All User Data (Dashboard equivalent)
```ts
async function fetchUserDashboard(userId: string) {
  const [profile, settings, coins, subscription] = await Promise.all([
    supabase.from('user_profiles').select('*').eq('id', userId).single(),
    supabase.from('user_settings').select('*').eq('user_id', userId).single(),
    supabase.from('user_coins').select('*').eq('user_id', userId).single(),
    supabase.from('subscription_purchases').select('*').eq('user_id', userId).eq('status', 'active').limit(1).single(),
  ]);

  return {
    profile: profile.data,
    settings: settings.data,
    coins: coins.data,
    subscription: subscription.data,
  };
}
```

---

## 📋 Context Files Reference

### ProfileContext.tsx
```ts
// contexts/ProfileContext.tsx — fetches:
// user_profiles → id, username, email, role, subscription_tier, profile_photo_url
// user_coins → total_coins, is_unlimited, is_admin
// Updates: updateProfile(), refreshProfile()
import { useProfile } from '../hooks/useProfile'; // or from ProfileContext directly
```

### SettingsContext.tsx
```ts
// contexts/SettingsContext.tsx — fetches:
// user_settings → all app settings (language, appearance, accent_color, etc.)
// auto-synced to Supabase on every change via updateSetting()
import { useSettings } from '../hooks/useSettings';
const { settings, updateSetting } = useSettings();
```

### ConversationContext.tsx
```ts
// contexts/ConversationContext.tsx — manages:
// conversations → list, create, delete, archive
// messages → load per conversation, add streaming messages
import { useConversation } from '../hooks/useConversation';
```

---

## 🔑 How App ↔ Web Session Sharing Works

Sessions are stored in Supabase Auth — the same JWT works on both platforms.

1. **User logs in on App** → Supabase issues JWT stored in AsyncStorage
2. **User logs in on Web** → Same Supabase issues JWT stored in localStorage
3. **Same user = same `user_id`** → All data queries return the same rows
4. **Password change on Web** → Token refreshed on App via `onAuthStateChange`
5. **Logout All Devices** (`supabase.auth.signOut({ scope: 'global' })`) → Invalidates ALL sessions across app + web simultaneously

---

## 🛑 Logout All Devices Implementation

```ts
// This signs out ALL active sessions (app + web + any other devices)
async function logoutAllDevices() {
  const { error } = await supabase.auth.signOut({ scope: 'global' });
  if (!error) {
    // Clear local state
    localStorage.clear();
    window.location.href = '/login';
  }
}
```

On the **mobile app**, this is automatically handled by `onAuthStateChange` — when the session is invalidated server-side, the next API call will fail and the auth listener will fire `SIGNED_OUT`, auto-redirecting to the login screen.
