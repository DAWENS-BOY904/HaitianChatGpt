# Dawinix — Complete Web Integration Guide
# Fetch Everything from the Mobile App into Your Web Version

> **Backend URL:** `https://njpuoozygqtpvlzhnjpu.backend.onspace.ai`
> **All tables, Edge Functions, and auth are 100% shared between mobile and web.**

---

## Table of Contents

1. [Authentication — Auto-Login & Account Sync](#1-authentication--auto-login--account-sync)
2. [Side Menu — Conversation History Auto-Load](#2-side-menu--conversation-history-auto-load)
3. [Settings Page — All Fields & Contexts](#3-settings-page--all-fields--contexts)
4. [ProfileContext — User Profile State](#4-profilecontext--user-profile-state)
5. [SettingsContext — App Settings State](#5-settingscontext--app-settings-state)
6. [ConversationMenuModal — Actions](#6-conversationmenumodal--actions)
7. [SourcesModal — AI Web Sources](#7-sourcesmodal--ai-web-sources)
8. [ThinkingIndicator — AI Loading State](#8-thinkingindicator--ai-loading-state)
9. [StreamingText — Word-by-Word AI Response](#9-streamingtext--word-by-word-ai-response)
10. [CalculatorModal — Inline Math](#10-calculatormodal--inline-math)
11. [Guest Conversations — Real Fetch](#11-guest-conversations--real-fetch)
12. [AI-Generated Images — Real Fetch](#12-ai-generated-images--real-fetch)
13. [Audio Transcription Edge Function](#13-audio-transcription-edge-function)
14. [Text-to-Speech (TTS) Edge Function](#14-text-to-speech-tts-edge-function)
15. [AI Providers — `_shared/ai-providers.ts`](#15-ai-providers--_sharedai-providersts)
16. [Content Moderation Edge Function](#16-content-moderation-edge-function)
17. [Apple Sign-In via `expo-apple-authentication`](#17-apple-sign-in-via-expo-apple-authentication)
18. [Google OAuth Sign-In](#18-google-oauth-sign-in)
19. [Complete Supabase Client Setup for Web](#19-complete-supabase-client-setup-for-web)

---

## 1. Authentication — Auto-Login & Account Sync

### How the mobile app handles auth

The mobile app uses OTP + password hybrid via `template/auth/supabase/service.ts`. The Supabase session (JWT token) is stored automatically by the JS client. Every user in the app maps 1:1 to `public.user_profiles`.

### Web implementation — tell OnSpace to do this:

```
Create a login page that authenticates with Supabase OTP.

On success, the user's JWT token must be passed in the Authorization header 
for all Edge Function calls and all database queries.

After login, immediately:
1. Fetch user_profiles WHERE id = auth.uid()
2. Fetch user_settings WHERE user_id = auth.uid()
3. Fetch conversations WHERE user_id = auth.uid() ORDER BY updated_at DESC
4. Store user object in React context
```

### JavaScript — Full Auth Implementation

```javascript
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://njpuoozygqtpvlzhnjpu.backend.onspace.ai';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_FROM_ENV'; // EXPO_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// ── Step 1: Send OTP ─────────────────────────────────────────────────────
async function sendOTP(email) {
  const { error } = await supabase.auth.signInWithOtp({ email });
  if (error) throw new Error(error.message);
  return { success: true };
}

// ── Step 2: Verify OTP (login or register) ───────────────────────────────
async function verifyOTP(email, otp, password = null) {
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token: otp,
    type: 'email',
  });
  if (error) throw new Error(error.message);

  // If password provided, update it for this new user
  if (password && data.user) {
    await supabase.auth.updateUser({ password });
  }

  return { user: data.user, session: data.session };
}

// ── Step 3: Load user profile + settings after login ─────────────────────
async function loadUserData(userId) {
  const [profileRes, settingsRes] = await Promise.all([
    supabase.from('user_profiles').select('*').eq('id', userId).single(),
    supabase.from('user_settings').select('*').eq('user_id', userId).single(),
  ]);

  return {
    profile: profileRes.data,
    settings: settingsRes.data,
  };
}

// ── Sign in with password ─────────────────────────────────────────────────
async function signInWithPassword(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return data;
}

// ── Logout ────────────────────────────────────────────────────────────────
async function logout() {
  await supabase.auth.signOut();
}

// ── Auth state listener ───────────────────────────────────────────────────
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' && session?.user) {
    // User logged in — auto-load their data
    loadUserData(session.user.id).then(({ profile, settings }) => {
      // Update your React state / context
    });
  }
  if (event === 'SIGNED_OUT') {
    // Clear all state
  }
});
```

### User profile table schema (from the app)

```sql
-- public.user_profiles
id                    uuid (= auth.users.id)
username              text
email                 text
role                  text  ('user' | 'admin')
subscription_tier     text  ('free' | 'go' | 'plus')
full_name             text
profile_photo_url     text
push_token            text
is_lifetime_member    boolean
```

---

## 2. Side Menu — Conversation History Auto-Load

### How the mobile app loads conversations (from `hooks/useConversation.tsx`)

The side menu (`SideMenu.tsx` + `ChatHistoryModal.tsx`) fetches all conversations from `public.conversations` for the logged-in user, ordered by `updated_at DESC`.

### Web fetch — complete implementation

```javascript
// ── Load all conversations for sidebar ───────────────────────────────────
async function loadConversations(userId) {
  const { data, error } = await supabase
    .from('conversations')
    .select('id, title, created_at, updated_at, is_archived, is_pinned, is_temporary')
    .eq('user_id', userId)
    .eq('is_archived', false)
    .order('is_pinned', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(100);

  if (error) throw error;
  return data;
}

// ── Load messages for a conversation ─────────────────────────────────────
async function loadMessages(conversationId) {
  const { data, error } = await supabase
    .from('messages')
    .select('id, role, content, image_url, image_urls, file_url, file_name, file_type, created_at, edited, edited_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data;
}

// ── Create new conversation ───────────────────────────────────────────────
async function createConversation(userId, title = 'New Chat') {
  const { data, error } = await supabase
    .from('conversations')
    .insert({ user_id: userId, title, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ── Rename conversation ───────────────────────────────────────────────────
async function renameConversation(conversationId, newTitle) {
  await supabase
    .from('conversations')
    .update({ title: newTitle, updated_at: new Date().toISOString() })
    .eq('id', conversationId);
}

// ── Archive conversation ──────────────────────────────────────────────────
async function archiveConversation(conversationId) {
  await supabase
    .from('conversations')
    .update({ is_archived: true, updated_at: new Date().toISOString() })
    .eq('id', conversationId);
}

// ── Delete conversation ───────────────────────────────────────────────────
async function deleteConversation(conversationId) {
  // Deleting conversation cascades to messages (FK ON DELETE CASCADE)
  await supabase.from('conversations').delete().eq('id', conversationId);
}

// ── Load archived chats ───────────────────────────────────────────────────
async function loadArchivedChats(userId) {
  const { data } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
    .eq('is_archived', true)
    .order('updated_at', { ascending: false });
  return data;
}

// ── React hook for sidebar auto-refresh ──────────────────────────────────
function useSidebarConversations(userId) {
  const [conversations, setConversations] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await loadConversations(userId);
      setConversations(data || []);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  React.useEffect(() => { refresh(); }, [refresh]);

  // Poll every 10s (app uses polling since Realtime is unavailable)
  React.useEffect(() => {
    if (!userId) return;
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, [userId, refresh]);

  return { conversations, loading, refresh };
}
```

### Conversation table schema

```sql
-- public.conversations
id              uuid
user_id         uuid (FK → user_profiles.id)
title           text  (default 'New Chat')
is_archived     boolean
is_pinned       boolean
is_temporary    boolean
created_at      timestamp
updated_at      timestamp
```

### Messages table schema

```sql
-- public.messages
id              uuid
conversation_id uuid (FK → conversations.id ON DELETE CASCADE)
role            text  ('user' | 'assistant')
content         text
image_url       text
image_urls      jsonb
file_url        text
file_name       text
file_type       text
created_at      timestamp
edited          boolean
edited_at       timestamp
```

---

## 3. Settings Page — All Fields & Contexts

### All settings fields (from `app/settings.tsx` + `contexts/SettingsContext.tsx`)

The settings page reads/writes the `user_settings` table. Here is the complete field mapping:

| App Setting Key (camelCase) | DB Column (snake_case) | Type | Default |
|---|---|---|---|
| `appLanguage` | `app_language` | text | `'English'` |
| `appearance` | `appearance` | text | `'System'` |
| `accentColor` | `accent_color` | text | `'#10A37F'` |
| `hapticFeedback` | `haptic_feedback` | boolean | `true` |
| `autoSpelling` | `auto_spelling` | boolean | `true` |
| `mainLanguage` | `main_language` | text | `'English'` |
| `voiceSelection` | `voice_selection` | text | ElevenLabs voice ID |
| `backgroundConversations` | `background_conversations` | boolean | `false` |
| `autocomplete` | `autocomplete` | boolean | `true` |
| `trendingSearches` | `trending_searches` | boolean | `true` |
| `followupSuggestions` | `followup_suggestions` | boolean | `true` |
| `preferredAiModel` | `preferred_ai_model` | text | `'gemini'` |
| `customInstructions` | `custom_instructions` | text | `null` |
| `nickname` | `nickname` | text | `null` |
| `occupation` | `occupation` | text | `null` |
| `interests` | `interests` | text[] | `null` |
| `baseTone` | `base_tone` | text | `'balanced'` |

### Web fetch & update settings

```javascript
// ── Load all settings ─────────────────────────────────────────────────────
async function loadSettings(userId) {
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    // Return defaults if no settings row exists yet
    return {
      app_language: 'English',
      appearance: 'System',
      accent_color: '#10A37F',
      haptic_feedback: true,
      auto_spelling: true,
      main_language: 'English',
      voice_selection: 'pNInz6obpgDQGcFmaJgB',
      background_conversations: false,
      autocomplete: true,
      trending_searches: true,
      followup_suggestions: true,
      preferred_ai_model: 'gemini',
    };
  }
  return data;
}

// ── Update a single setting ───────────────────────────────────────────────
async function updateSetting(userId, columnName, value) {
  // columnName is snake_case (e.g. 'accent_color', 'haptic_feedback')
  await supabase
    .from('user_settings')
    .upsert(
      { user_id: userId, [columnName]: value, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
}

// ── Example: toggle dark mode ─────────────────────────────────────────────
await updateSetting(user.id, 'appearance', 'Dark');

// ── Example: change accent color ─────────────────────────────────────────
await updateSetting(user.id, 'accent_color', '#FF453A');

// ── Example: update custom instructions ──────────────────────────────────
await updateSetting(user.id, 'custom_instructions', 'Always respond in French');

// ── Personalization fields (from personalization page) ────────────────────
await updateSetting(user.id, 'nickname', 'Jean-Pierre');
await updateSetting(user.id, 'occupation', 'Software Engineer');
await updateSetting(user.id, 'interests', ['Technology', 'Music', 'Travel']);
await updateSetting(user.id, 'base_tone', 'formal'); // 'balanced' | 'formal' | 'casual'
```

### Settings page sections (from `app/settings.tsx`)

The mobile settings screen has these exact sections:

```
ACCOUNT SECTION:
  - Email (read-only)
  - Subscription tier (free/go/plus)
  - Upgrade to Plus
  - Restore purchases → /subscription
  - Orders → /orders
  - Personalization → /personalization
  - Notifications → /notifications
  - Parental controls → /parental-controls
  - Data controls → /data-controls
  - Ads controls → /ads-controls
  - Apps & connectors → /app-connect
  - Archived chats → /archived-chats
  - Security → /security
  - Age verification (if not yet done)

APP SECTION:
  - App language
  - Appearance: System | Light | Dark
  - Accent color (12 color options)
  - Haptic feedback (toggle)
  - Correct spelling automatically (toggle)

SPEECH SECTION:
  - Main language → /Speech-Language

VOICE SECTION:
  - Voice selection → /voice-select  (ElevenLabs voices)
  - Background conversations (toggle)

SUGGESTIONS SECTION:
  - Autocomplete (toggle)
  - Trending searches (toggle)

ADMIN SECTION (only for admin emails):
  - Admin Dashboard → /admin
  - Apple JWT Key Generator
  - Send Email to Users

ABOUT SECTION:
  - Report bug
  - Help Center
  - Terms of Use
  - Privacy Policy
  - Check for updates

LOG OUT BUTTON
```

### Accent colors available (from `app/settings.tsx`)

```javascript
const ACCENT_COLORS = [
  { hex: '#10A37F', name: 'Green' },    // Default
  { hex: '#0A84FF', name: 'Blue' },
  { hex: '#FF9F0A', name: 'Orange' },
  { hex: '#FF453A', name: 'Red' },
  { hex: '#BF5AF2', name: 'Purple' },
  { hex: '#FF375F', name: 'Pink' },
  { hex: '#30D158', name: 'Mint' },
  { hex: '#5AC8FA', name: 'Sky' },
  { hex: '#FFD60A', name: 'Yellow' },
  { hex: '#FF6B00', name: 'Amber' },
  { hex: '#64D2FF', name: 'Cyan' },
  { hex: '#FF2D55', name: 'Rose' },
];
```

---

## 4. ProfileContext — User Profile State

### What it does (from `contexts/ProfileContext.tsx`)

`ProfileContext` stores global reactive state for the currently logged-in user's profile so any component can read it without re-fetching.

```typescript
interface ProfileContextType {
  profilePhotoUrl: string;   // CDN URL to profile photo
  displayName: string;       // full_name or username
  username: string;          // @username
  setProfilePhotoUrl: (url: string) => void;
  setDisplayName: (name: string) => void;
  setUsername: (username: string) => void;
  refreshKey: number;        // increment this to force re-renders
  triggerRefresh: () => void;
}
```

### Web equivalent (React Context)

```javascript
// ProfileContext.web.js
import React, { createContext, useContext, useState, useCallback } from 'react';

const ProfileContext = createContext(null);

export function ProfileProvider({ children }) {
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const triggerRefresh = useCallback(() => setRefreshKey(k => k + 1), []);

  return (
    <ProfileContext.Provider value={{
      profilePhotoUrl, setProfilePhotoUrl,
      displayName, setDisplayName,
      username, setUsername,
      refreshKey, triggerRefresh,
    }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider');
  return ctx;
}
```

### Profile photo upload flow (from `app/settings.tsx`)

```javascript
// Upload profile photo to Supabase Storage → profile-images bucket
async function uploadProfilePhoto(userId, file) {
  const ext = file.name.split('.').pop() || 'jpg';
  const filePath = `${userId}/avatar_${Date.now()}.${ext}`;
  
  // Upload the file
  const { error: uploadError } = await supabase.storage
    .from('profile-images')
    .upload(filePath, file, { contentType: file.type, upsert: true });
  
  if (uploadError) throw uploadError;
  
  // Get public URL
  const { data: urlData } = supabase.storage
    .from('profile-images')
    .getPublicUrl(filePath);
  
  const publicUrl = urlData.publicUrl;
  
  // Save to user_profiles
  await supabase
    .from('user_profiles')
    .update({ profile_photo_url: publicUrl })
    .eq('id', userId);
  
  return publicUrl;
}
```

---

## 5. SettingsContext — App Settings State

### What it does (from `contexts/SettingsContext.tsx`)

Loads user settings from DB on login and provides optimistic `updateSetting` that updates UI immediately then syncs to DB.

### Web equivalent

```javascript
// SettingsContext.web.js
import React, { createContext, useContext, useState, useEffect } from 'react';

const defaultSettings = {
  appLanguage: 'English',
  appearance: 'System',         // 'System' | 'Light' | 'Dark'
  accentColor: '#10A37F',
  hapticFeedback: true,
  autoSpelling: true,
  mainLanguage: 'English',
  voiceSelection: 'pNInz6obpgDQGcFmaJgB',
  backgroundConversations: false,
  autocomplete: true,
  trendingSearches: true,
  followupSuggestions: true,
  preferredAiModel: 'gemini',
};

const SettingsContext = createContext(null);

export function SettingsProvider({ children, supabase, user }) {
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadSettings();
  }, [user]);

  async function loadSettings() {
    setLoading(true);
    const { data } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (data) {
      setSettings({
        appLanguage: data.app_language ?? defaultSettings.appLanguage,
        appearance: data.appearance ?? defaultSettings.appearance,
        accentColor: data.accent_color || defaultSettings.accentColor,
        hapticFeedback: data.haptic_feedback ?? defaultSettings.hapticFeedback,
        autoSpelling: data.auto_spelling ?? defaultSettings.autoSpelling,
        mainLanguage: data.main_language ?? defaultSettings.mainLanguage,
        voiceSelection: data.voice_selection || defaultSettings.voiceSelection,
        backgroundConversations: data.background_conversations ?? defaultSettings.backgroundConversations,
        autocomplete: data.autocomplete ?? defaultSettings.autocomplete,
        trendingSearches: data.trending_searches ?? defaultSettings.trendingSearches,
        followupSuggestions: data.followup_suggestions ?? defaultSettings.followupSuggestions,
        preferredAiModel: data.preferred_ai_model || defaultSettings.preferredAiModel,
      });
    }
    setLoading(false);
  }

  // camelCase key → snake_case DB column
  async function updateSetting(key, value) {
    // Optimistic update
    setSettings(prev => ({ ...prev, [key]: value }));

    if (!user) return;
    const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();

    await supabase
      .from('user_settings')
      .upsert(
        { user_id: user.id, [dbKey]: value, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
  }

  return (
    <SettingsContext.Provider value={{ settings, loading, updateSetting }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
```

---

## 6. ConversationMenuModal — Actions

### What it does (from `components/ConversationMenuModal.tsx`)

A dropdown menu that appears in the top-right when chatting. Contains: **Share, Add people, Rename, Archive, Report, Delete**.

### Web equivalent — HTML/CSS/JS

```javascript
// ConversationMenu.web.jsx
const MENU_ITEMS = [
  { icon: '↗', label: 'Share', action: 'share' },
  { icon: '👤+', label: 'Add people', action: 'add_people' },
  { icon: '✏️', label: 'Rename', action: 'rename' },
  { icon: '📦', label: 'Archive', action: 'archive' },
  { icon: '🚩', label: 'Report', action: 'report' },
  { icon: '🗑', label: 'Delete', action: 'delete', destructive: true },
];

function ConversationMenu({ conversationId, title, onAction }) {
  const [open, setOpen] = React.useState(false);

  async function handleAction(action) {
    setOpen(false);
    switch (action) {
      case 'share':
        const messages = await loadMessages(conversationId);
        const text = messages.map(m => `${m.role === 'user' ? 'You' : 'AI'}: ${m.content}`).join('\n\n');
        navigator.share?.({ text, title }) || navigator.clipboard.writeText(text);
        break;

      case 'rename':
        const newTitle = prompt('Rename conversation:', title);
        if (newTitle) await renameConversation(conversationId, newTitle);
        break;

      case 'archive':
        if (confirm('Archive this conversation?')) await archiveConversation(conversationId);
        break;

      case 'delete':
        if (confirm('Delete this conversation? This cannot be undone.')) {
          await deleteConversation(conversationId);
        }
        break;

      default:
        onAction?.(action);
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(v => !v)}>⋯</button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '100%',
          background: 'rgba(28,28,30,0.95)', borderRadius: 14,
          minWidth: 220, zIndex: 100, overflow: 'hidden',
          boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
        }}>
          {title && (
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
              {title}
            </div>
          )}
          {MENU_ITEMS.map(item => (
            <button
              key={item.label}
              onClick={() => handleAction(item.action)}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                width: '100%', padding: '14px 16px',
                background: 'none', border: 'none', cursor: 'pointer',
                color: item.destructive ? '#FF453A' : '#FFFFFF',
                fontSize: 17, textAlign: 'left',
              }}
            >
              <span>{item.label}</span>
              <span style={{ opacity: 0.5 }}>{item.icon}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## 7. SourcesModal — AI Web Sources

### What it does (from `components/SourcesModal.tsx`)

Displays a bottom sheet with web sources that the AI used to answer. Sources come from the `[SOURCES][...][/SOURCES]` block in the AI message content.

### Parse sources from AI message

```javascript
// Parse [SOURCES] block from AI response text
function parseSources(aiContent) {
  const match = aiContent.match(/\[SOURCES\]([\s\S]*?)\[\/SOURCES\]/i);
  if (!match) return [];

  try {
    // Try JSON array first
    const jsonMatch = match[1].match(/\[\{[\s\S]*?\}\]/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);

    // Fallback: parse plain URL lines
    return match[1].trim().split('\n')
      .map(line => line.replace(/^[-*•]\s*/, '').trim())
      .filter(Boolean)
      .map(s => ({
        title: s.startsWith('http') ? new URL(s).hostname.replace('www.', '') : s,
        url: s.startsWith('http') ? s : `https://www.google.com/search?q=${encodeURIComponent(s)}`,
        snippet: '',
        domain: s.startsWith('http') ? new URL(s).hostname.replace('www.', '') : '',
      }));
  } catch {
    return [];
  }
}

// Get favicon URL (same as app)
function getFaviconUrl(url) {
  try {
    const { hostname } = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
  } catch {
    return '';
  }
}

// Web SourcesModal component
function SourcesModal({ sources, onClose }) {
  return (
    <div className="sources-modal">
      <div className="handle" />
      <div className="header">
        <h3>Sources</h3>
        <button onClick={onClose}>✕</button>
      </div>
      {sources.map((source, i) => (
        <a key={i} href={source.url} target="_blank" rel="noopener" className="source-row">
          <img src={getFaviconUrl(source.url)} width={16} height={16} alt="" />
          <div>
            <div className="source-title">{source.title}</div>
            {source.snippet && <div className="source-snippet">{source.snippet}</div>}
          </div>
        </a>
      ))}
    </div>
  );
}
```

---

## 8. ThinkingIndicator — AI Loading State

### What it does (from `components/ThinkingIndicator.tsx`)

Shows a pulsing dot + label while AI is generating. Modes: `thinking`, `creating_image`, `analyzing`, `editing_image`. Also handles link search mode.

### Web equivalent

```javascript
// ThinkingIndicator.web.jsx
function ThinkingIndicator({ mode, linkSearchUrl, onCancel }) {
  const [opacity, setOpacity] = React.useState(0.5);

  // Pulse animation
  React.useEffect(() => {
    let up = true;
    const interval = setInterval(() => {
      setOpacity(prev => {
        if (prev >= 1) { up = false; return 0.95; }
        if (prev <= 0.4) { up = true; return 0.45; }
        return up ? prev + 0.05 : prev - 0.05;
      });
    }, 60);
    return () => clearInterval(interval);
  }, []);

  const config = {
    thinking:       { label: 'Thinking',       color: '#FFFFFF' },
    creating_image: { label: 'Creating image', color: '#BF5AF2' },
    analyzing:      { label: 'Analyzing file', color: '#FF9F0A' },
    editing_image:  { label: 'Editing image',  color: '#FF453A' },
  };

  if (linkSearchUrl) {
    let displayUrl = linkSearchUrl;
    try {
      const u = new URL(linkSearchUrl);
      displayUrl = u.hostname.replace('www.', '') + (u.pathname.length > 1 ? u.pathname.slice(0, 20) : '');
    } catch {}

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px' }}>
        <div style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#5AC8FA', opacity }} />
        <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>
          Searching for <span style={{ color: '#5AC8FA' }}>{displayUrl}</span>...
        </span>
        {onCancel && <button onClick={onCancel} style={{ marginLeft: 'auto' }}>■</button>}
      </div>
    );
  }

  const { label, color } = config[mode] || config.thinking;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px' }}>
      <div style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, opacity }} />
      <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>
        {label}<span style={{ opacity: 0.4 }}>...</span>
      </span>
      {onCancel && (
        <button
          onClick={onCancel}
          style={{ marginLeft: 'auto', width: 22, height: 22, borderRadius: 11, background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', fontSize: 10 }}
        >■</button>
      )}
    </div>
  );
}
```

---

## 9. StreamingText — Word-by-Word AI Response

### What it does (from `components/StreamingText.tsx`)

Renders AI text character-by-character (word-by-word) with a blinking cursor. Uses `speed`, `variance`, and `pausePunctuation` for human-like feel.

### Web equivalent

```javascript
// StreamingText.web.jsx — word-by-word with blinking cursor
function StreamingText({ text, speed = 60, onComplete }) {
  const [displayed, setDisplayed] = React.useState('');
  const [showCursor, setShowCursor] = React.useState(true);
  const indexRef = React.useRef(0);
  const timerRef = React.useRef(null);

  // Blinking cursor
  React.useEffect(() => {
    const interval = setInterval(() => setShowCursor(v => !v), 480);
    return () => clearInterval(interval);
  }, []);

  React.useEffect(() => {
    indexRef.current = 0;
    setDisplayed('');
    if (!text) return;

    const CHUNK = 3; // 3 chars per tick

    function typeChunk() {
      if (indexRef.current >= text.length) {
        onComplete?.();
        return;
      }

      const end = Math.min(indexRef.current + CHUNK, text.length);
      const lastChar = text[end - 1];
      setDisplayed(text.substring(0, end));
      indexRef.current = end;

      // Pause on punctuation
      let delay = 1000 / speed;
      if ('.!?'.includes(lastChar)) delay += 200;
      else if (',;:'.includes(lastChar)) delay += 120;
      else if (lastChar === '\n') delay += 140;

      timerRef.current = setTimeout(typeChunk, delay);
    }

    timerRef.current = setTimeout(typeChunk, 0);
    return () => clearTimeout(timerRef.current);
  }, [text, speed]);

  return (
    <span>
      {displayed}
      <span style={{ opacity: showCursor ? 1 : 0, transition: 'opacity 0.1s' }}>|</span>
    </span>
  );
}
```

### Usage in chat message

```javascript
// In your chat UI:
{message.role === 'assistant' && isStreaming ? (
  <StreamingText text={streamedContent} speed={60} onComplete={() => setIsStreaming(false)} />
) : (
  <MarkdownRenderer content={message.content} />
)}
```

---

## 10. CalculatorModal — Inline Math

### What it does (from `components/CalculatorModal.tsx`)

Detects math expressions in user messages and shows an inline calculator card with live result.

### Web equivalent

```javascript
// detectMathExpression — matches the exact mobile logic
function detectMathExpression(text) {
  if (!text) return null;
  const wordCount = text.trim().split(/\s+/).length;
  if (wordCount > 25) return null;

  const mathPattern = /(\d+[\s]*[+\-*/×÷−][\s]*\d+(?:[\s]*[+\-*/×÷−][\s]*\d+)*)/;
  const match = text.match(mathPattern);
  if (!match) return null;

  try {
    const expr = match[1].trim();
    const sanitized = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/\s/g, '');
    if (!/^[\d+\-*/.()]+$/.test(sanitized)) return null;
    const val = Function('"use strict"; return (' + sanitized + ')')();
    if (!Number.isNaN(val) && Number.isFinite(val)) {
      return { expression: expr, result: String(parseFloat(val.toFixed(10))) };
    }
  } catch {}
  return null;
}

// CalculatorCard web component
function CalculatorCard({ expression, result }) {
  return (
    <div style={{ background: 'rgba(44,44,46,0.9)', borderRadius: 18, padding: 16, margin: '8px 16px' }}>
      <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 16 }}>{expression}</div>
      <div style={{ color: '#30D158', fontSize: 48, fontWeight: 300 }}>{result}</div>
    </div>
  );
}
```

---

## 11. Guest Conversations — Real Fetch

### How the app handles guest mode

Guests use the Supabase `anon` key for all requests. The `chat` Edge Function accepts requests with the anon key (no user auth).

```javascript
// Guest mode — use anon key directly
const guestSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Guest conversations are stored in localStorage (not DB) in the app
// For web, use sessionStorage or a local state array:
function useGuestConversations() {
  const [conversations, setConversations] = React.useState(() => {
    try { return JSON.parse(sessionStorage.getItem('guest_convs') || '[]'); }
    catch { return []; }
  });
  const [messages, setMessages] = React.useState([]);
  const [activeId, setActiveId] = React.useState(null);

  function createGuestConversation() {
    const id = `guest-${Date.now()}`;
    const conv = { id, title: 'Guest Chat', created_at: new Date().toISOString() };
    const updated = [conv, ...conversations];
    setConversations(updated);
    sessionStorage.setItem('guest_convs', JSON.stringify(updated));
    setActiveId(id);
    setMessages([]);
    return id;
  }

  function addGuestMessage(role, content) {
    const msg = { id: `msg-${Date.now()}`, role, content, created_at: new Date().toISOString() };
    setMessages(prev => {
      const updated = [...prev, msg];
      // Persist messages keyed by conversation
      if (activeId) sessionStorage.setItem(`guest_msgs_${activeId}`, JSON.stringify(updated));
      return updated;
    });
  }

  return { conversations, messages, activeId, createGuestConversation, addGuestMessage };
}

// Guest chat request — sends with anon key
async function sendGuestMessage(conversationId, userMessage) {
  // Create a temporary conversation ID for guest
  const tempConvId = conversationId || `00000000-0000-0000-0000-${Date.now().toString().padStart(12, '0')}`;

  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/chat`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, // Guest uses anon key
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: userMessage }],
        conversationId: tempConvId,
        aiModel: 'onspace-ai',
      }),
    }
  );

  return response; // Handle streaming as shown in Section 8 of WEB_CHATBOT_GUIDE.md
}
```

---

## 12. AI-Generated Images — Real Fetch

### How image generation works in the app

1. User types "create a logo for..." → `detectContentType()` returns `isImageTask: true`
2. `handleSend()` calls `sendMessage()` with the prompt
3. `chat` Edge Function calls `generateImageSmart()` in `_shared/ai-providers.ts`
4. Generated image URL is saved to `media_files` table AND returned in AI response
5. Image URL appears in `messages.image_url` column after streaming completes

### Fetch all AI-generated images for a user

```javascript
// Fetch from media_files table
async function fetchUserAIImages(userId) {
  const { data, error } = await supabase
    .from('media_files')
    .select('id, file_url, file_name, created_at')
    .eq('user_id', userId)
    .eq('file_type', 'image')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

// Generate image via chat Edge Function
async function generateImage(prompt, session) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: prompt }],
      conversationId: 'YOUR_CONV_ID',
      aiModel: 'gemini',  // or 'onspace-ai'
    }),
  });

  // Read streaming response — image URL will be in the AI text response
  // Look for https:// URLs in the streamed content pointing to .jpg/.png/.webp
  const reader = response.body?.getReader();
  let fullText = '';

  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = new TextDecoder().decode(value);
      for (const line of chunk.split('\n')) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            fullText += parsed.choices?.[0]?.delta?.content || parsed.content || '';
          } catch {}
        }
      }
    }
  }

  // Extract image URL from response
  const urlMatch = fullText.match(/https?:\/\/[^\s"']+\.(?:jpg|jpeg|png|webp|gif)/i);
  return urlMatch ? urlMatch[0] : null;
}
```

---

## 13. Audio Transcription Edge Function

### Edge function: `transcribe-audio`

The app sends base64-encoded audio to this function and gets back transcribed text.

```javascript
// Web audio transcription — matches mobile exactly
async function transcribeAudio(audioBlob, session, conversationId, userId) {
  // Convert Blob to base64
  const arrayBuffer = await audioBlob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64Audio = btoa(binary);

  // Call the same Edge Function used by the mobile app
  const { data, error } = await supabase.functions.invoke('transcribe-audio', {
    body: {
      audio: base64Audio,
      userId: userId,
      conversationId: conversationId,
      detectLanguage: true,   // Auto-detect language (Haitian Creole, French, English, etc.)
    },
  });

  if (error) throw new Error(error.message);

  return {
    text: data.text,
    detectedLanguage: data.detectedLanguage,
  };
}

// Web microphone recording
async function startWebRecording(onStop) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
  const chunks = [];

  recorder.ondataavailable = e => chunks.push(e.data);
  recorder.onstop = async () => {
    stream.getTracks().forEach(t => t.stop());
    const blob = new Blob(chunks, { type: 'audio/webm' });
    const result = await transcribeAudio(blob, session, conversationId, userId);
    onStop(result);
  };

  recorder.start();
  return recorder; // Call recorder.stop() when user clicks stop
}
```

---

## 14. Text-to-Speech (TTS) Edge Function

### Edge function: `generate-tts`

The app sends text and gets back an audio URL (ElevenLabs voices or device TTS fallback).

```javascript
// Fetch TTS audio — same Edge Function as mobile app
async function generateTTS(text, voiceId, session) {
  const { data, error } = await supabase.functions.invoke('generate-tts', {
    body: {
      text: text.replace(/[#*`>]/g, '').slice(0, 2000),  // Same cleanup as app
      voice: voiceId || 'pNInz6obpgDQGcFmaJgB',          // Default ElevenLabs voice
      speed: 1.0,
    },
  });

  if (error) throw new Error(error.message);

  // data.fallback === true means device TTS should be used
  if (data.fallback) {
    // Web: use SpeechSynthesis API
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = data.lang || 'en-US';
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
    return null;
  }

  // data.audioUrl is a publicly accessible URL to the audio file
  const audioUrl = data.audioUrl || data.audio_url;
  if (audioUrl) {
    const audio = new Audio(audioUrl);
    audio.play();
    return audio;
  }

  return null;
}

// ElevenLabs voice IDs used in the app (from voice-select page)
const ELEVENLABS_VOICES = {
  alloy:   'EXAVITQu4vr4xnSDxMaL',  // Alloy
  coral:   'XrExE9yKIg1WjnnlVkGX',  // Coral
  echo:    'VR6AewLTigWG4xSOukaG',  // Echo
  fable:   'pFZP5JQG7iQjIQuC4Bku',  // Fable
  nova:    'MF3mGyEYCl7XYWbV9V6O',  // Nova
  onyx:    'N2lVS1w4EtoT3dr4eOWO',  // Onyx
  shimmer: 'cgSgspJ2msm6clMCkdW9', // Shimmer
};
```

---

## 15. AI Providers — `_shared/ai-providers.ts`

### What it does

This shared file powers ALL AI calls in the app. It contains:
- `callAI()` — main router with automatic fallback
- `callOnSpaceAI()` — PRIMARY: Google Gemini via OnSpace AI gateway
- `callOpenAI()` — OpenAI GPT-4o fallback
- `callGemini()` — Direct Google Gemini API fallback
- `callClaude()` — Anthropic Claude fallback
- `callGroq()` — Groq Llama (fastest text fallback)
- `generateImageSmart()` — multi-provider image generation
- `searchImages()` — Unsplash image search
- `detectContentType()` — detects if message is image request, file request, or text

### Model fallback order (from the code)

```
1. onspace-ai (Google Gemini 3 Flash via OnSpace AI gateway)
2. groq-llama (Llama 3.3 70B — fastest)
3. claude-3 (Anthropic Claude 3.5 Sonnet)
4. openai-gpt4 (GPT-4o)
5. google-gemini (Direct Gemini 1.5 Flash)
```

### Image generation fallback order

```
1. gemini-nano-banana-2 (Gemini via OnSpace AI, image models)
2. dalle-3 (OpenAI DALL-E 3, HD quality)
3. elevenlabs (ElevenLabs text-to-image)
4. midjourney (via useapi.net)
5. stability-ai (SDXL)
6. gemini-image (Direct Google Gemini image generation)
7. onspace-ai (text-only fallback)
```

### `detectContentType()` — use on web to decide UI

```javascript
// Import the same logic from the Edge Function into your web app
function detectContentTypeWeb(userMessage) {
  const lowerMsg = userMessage.toLowerCase();

  const imageKeywords = [
    'create a logo', 'generate logo', 'make a logo', 'design a logo',
    'create an image', 'generate image', 'make an image',
    'draw me a', 'create art', 'generate art',
    'kreye logo', 'fe logo', 'kreye yon imaj', 'fe imaj',
    'créer un logo', 'générer une image',
  ];

  const searchKeywords = [
    'search for photos', 'find photos', 'show me photos', 'search images',
    'ban m foto', 'banm foto', 'cherche foto', 'montre m foto',
  ];

  const hasImage = imageKeywords.some(k => lowerMsg.includes(k));
  const hasSearch = searchKeywords.some(k => lowerMsg.includes(k));

  if (hasSearch) return { type: 'search', isImageTask: false };
  if (hasImage) return { type: 'image', isImageTask: true };
  return { type: 'text', isImageTask: false };
}
```

---

## 16. Content Moderation Edge Function

### Edge function: `moderate-content`

The app uses OpenAI's `omni-moderation-latest` for images and `text-moderation-latest` for text.

```javascript
// Moderate text before sending to AI
async function moderateText(text, session) {
  const { data, error } = await supabase.functions.invoke('moderate-content', {
    body: { text, type: 'text' },
  });

  if (error) return { blocked: false }; // Fail open

  return {
    blocked: data.blocked,
    categories: data.categories,
    scores: data.category_scores,
  };
}

// Moderate image before uploading
async function moderateImage(imageUrl, session) {
  const { data, error } = await supabase.functions.invoke('moderate-content', {
    body: { imageUrl, type: 'image' },
  });

  if (error) return { blocked: false };

  return { blocked: data.blocked };
}

// Usage in web chat send handler
async function handleSendWithModeration(text, imageFile) {
  // Text moderation
  if (text && text.length > 10) {
    const textMod = await moderateText(text, session);
    if (textMod.blocked) {
      appendAIMessage("I'm sorry, but this message was flagged by our content moderation system. Please rephrase.");
      return;
    }
  }

  // Image moderation
  if (imageFile) {
    const imageUrl = URL.createObjectURL(imageFile);
    const imgMod = await moderateImage(imageUrl, session);
    if (imgMod.blocked) {
      appendAIMessage("This image was flagged by our content moderation system and cannot be processed.");
      return;
    }
  }

  // Safe to send
  await sendMessage(text, imageFile);
}
```

---

## 17. Apple Sign-In via `expo-apple-authentication`

### How it works in the app

The mobile app uses `expo-apple-authentication` which calls native Apple APIs. For web, you use the Sign in with Apple JS SDK.

```javascript
// Web: Sign in with Apple (web SDK equivalent)
// Add this to your HTML <head>:
// <script src="https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js"></script>

// Initialize Apple Sign In
function initAppleSignIn() {
  window.AppleID.auth.init({
    clientId: 'YOUR_APPLE_SERVICES_ID',     // APPLE_SERVICES_ID secret
    scope: 'name email',
    redirectURI: 'https://YOUR_WEB_DOMAIN/auth/apple',
    state: generateRandomState(),
    usePopup: true,
  });
}

// Handle Apple Sign In response
async function handleAppleSignIn() {
  try {
    const response = await window.AppleID.auth.signIn();
    const identityToken = response.authorization.id_token;
    const authorizationCode = response.authorization.code;
    const firstName = response.user?.name?.firstName || '';
    const lastName = response.user?.name?.lastName || '';

    // Send to Supabase auth
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: identityToken,
    });

    if (error) throw error;

    // Update profile with name (only available on first sign in)
    if (firstName || lastName) {
      await supabase.from('user_profiles').upsert({
        id: data.user.id,
        full_name: `${firstName} ${lastName}`.trim(),
        email: data.user.email || '',
      });
    }

    return data;
  } catch (error) {
    console.error('Apple Sign In failed:', error);
    throw error;
  }
}

// For React Native (exact mobile code from template):
// import * as AppleAuthentication from 'expo-apple-authentication';
//
// const credential = await AppleAuthentication.signInAsync({
//   requestedScopes: [
//     AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
//     AppleAuthentication.AppleAuthenticationScope.EMAIL,
//   ],
// });
// const { data, error } = await supabase.auth.signInWithIdToken({
//   provider: 'apple',
//   token: credential.identityToken,
// });
```

### Required backend secrets for Apple Sign In

```
APPLE_BUNDLE_ID        → Your iOS app bundle ID
APPLE_TEAM_ID          → Apple Developer Team ID
APPLE_KEY_ID           → Private key ID from Apple Developer
APPLE_PRIVATE_KEY      → Private key content (.p8 file)
APPLE_SERVICES_ID      → Services ID for web sign in
APPLE_CLIENT_ID        → Same as APPLE_SERVICES_ID for web
```

---

## 18. Google OAuth Sign-In

### Web implementation (mirrors the mobile app)

The mobile app uses `expo-auth-session` + `expo-web-browser` for Google OAuth. Web uses Supabase's built-in Google provider.

```javascript
// Google Sign In for web — exact same Supabase backend
async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  if (error) throw error;
  // Supabase will redirect to Google, then back to redirectTo URL
}

// Handle OAuth callback (on your /auth/callback page)
async function handleOAuthCallback() {
  const { data, error } = await supabase.auth.getSession();

  if (error) throw error;
  if (data.session) {
    // User is now logged in — load their data
    await loadUserData(data.session.user.id);
  }
}
```

### Enable Google OAuth in OnSpace Cloud

Go to: OnSpace Cloud → Users → Auth Settings → Enable Google Provider
Then set:
- **Google Client ID**: from Google Cloud Console → OAuth 2.0 credentials
- **Google Client Secret**: from same credentials
- **Authorized redirect URI**: `https://njpuoozygqtpvlzhnjpu.backend.onspace.ai/auth/v1/callback`

---

## 19. Complete Supabase Client Setup for Web

### Full setup that matches the mobile app exactly

```javascript
// supabase.web.js — mirrors template/core/client.ts exactly
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://njpuoozygqtpvlzhnjpu.backend.onspace.ai';
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'dawinix-web-auth',
  },
  realtime: {
    params: { eventsPerSecond: 2 },
  },
  global: {
    headers: { 'x-client-type': 'web' },
  },
});

// FunctionsHttpError handling (same as mobile)
import { FunctionsHttpError } from '@supabase/supabase-js';

async function invokeEdgeFunction(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });

  if (error) {
    let errorMessage = error.message;
    if (error instanceof FunctionsHttpError) {
      try {
        const statusCode = error.context?.status ?? 500;
        const textContent = await error.context?.text();
        errorMessage = `[Code: ${statusCode}] ${textContent || error.message}`;
      } catch {
        errorMessage = error.message || 'Failed to read response';
      }
    }
    throw new Error(errorMessage);
  }
  return data;
}
```

### Tell OnSpace to create your web app with this exact prompt

```
Create a full web chatbot app (React + Vite) that is the web version of the Dawinix mobile AI assistant.

Backend (shared with mobile app):
  URL: https://njpuoozygqtpvlzhnjpu.backend.onspace.ai
  Anon Key: [paste EXPO_PUBLIC_SUPABASE_ANON_KEY]

Requirements:
1. OTP + password authentication (same flow as mobile app)
2. After login: fetch user_profiles, user_settings, and conversations for the user
3. Sidebar: show conversation list from `conversations` table, newest first
   - Create new chat button
   - Rename, archive, delete via context menu (right-click or ⋯ button)
4. Chat interface:
   - Load messages from `messages` table when conversation is selected
   - Send messages via POST /functions/v1/chat Edge Function with streaming (SSE)
   - Show ThinkingIndicator (pulsing dot) while AI is generating
   - Show word-by-word streaming text as AI responds
   - Detect [SOURCES] block in AI response and show Sources panel
   - Detect math expressions and show calculator card
5. Settings page: read/write all fields from user_settings table
   - Dark/Light/System theme from `appearance` column
   - Accent color picker (12 colors from accentColor column)
   - All toggle settings from the table
6. Profile: show name, username, profile photo from user_profiles
   - Allow photo upload to `profile-images` storage bucket
   - Allow username change (14-day cooldown same as mobile)
7. AI Image generation: detect image creation requests, show generated image
   - Auto-save to media_files table
8. Audio transcription: use Web Audio API + /functions/v1/transcribe-audio
9. Text-to-speech: use /functions/v1/generate-tts Edge Function
10. Content moderation: check text/images via /functions/v1/moderate-content before sending
11. Apple Sign In + Google OAuth login options
12. Match Dawinix dark theme: bg #000000, card bg #1C1C1E, accent #10A37F
13. All data shared with mobile — users see same conversations on web and mobile
```

---

## Quick Reference — All Edge Functions Available

| Function | Path | Purpose |
|---|---|---|
| Chat (AI) | `/functions/v1/chat` | Main streaming AI chat |
| Transcribe | `/functions/v1/transcribe-audio` | Voice to text |
| TTS | `/functions/v1/generate-tts` | Text to speech |
| Moderate | `/functions/v1/moderate-content` | Content moderation |
| Quiz | `/functions/v1/generate-quiz` | AI quiz generator |
| Code Project | `/functions/v1/generate-code-project` | Full project generator |
| Link Preview | `/functions/v1/fetch-link-preview` | URL metadata |
| Check Sub | `/functions/v1/check-subscription` | User plan status |
| Stripe Checkout | `/functions/v1/create-checkout-session` | Payment |
| Customer Portal | `/functions/v1/customer-portal` | Billing management |

---

## Data Flow Summary

```
Web User Types Message
        ↓
[moderate-content] → blocked? → Show safe response
        ↓ (not blocked)
[detectContentType()] → image? text? search?
        ↓
POST /functions/v1/chat
  headers: { Authorization: Bearer {user_jwt} }
  body: { messages, conversationId, aiModel }
        ↓
Stream SSE response → word-by-word display
        ↓
Parse [SOURCES] block → show SourcesModal
Parse image URL → show in message + save to media_files
        ↓
Update conversations.updated_at
        ↓
Sidebar auto-refreshes (polling every 10s)
```

This is the exact same flow as the mobile app — shared backend, shared data, shared users.
