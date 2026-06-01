# App Connect — Complete Fetch & Integration Guide

> **Stack**: React Native (Expo) + Supabase Edge Functions  
> **Last updated**: June 2026  
> Covers: `app-connect.tsx`, `shazam-connect.tsx`, `spotify-connect.tsx`, `ConnectedAppsModal.tsx`, `SpotifyMusicCard.tsx`, `ImageSearchResults.tsx`, `LinkPreviewCard.tsx`, all their edge functions, and how to replicate everything in your web app.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [App Connect Hub — `app-connect.tsx`](#2-app-connect-hub)
3. [Shazam Integration — `shazam-connect.tsx`](#3-shazam-integration)
4. [Spotify Integration — `spotify-connect.tsx`](#4-spotify-integration)
5. [Edge Functions Deep Dive](#5-edge-functions)
6. [ConnectedAppsModal — `@` Mention Picker](#6-connectedappsmodal)
7. [SpotifyMusicCard — In-Chat Music Player](#7-spotifymusiccard)
8. [ImageSearchResults — AI Image Carousel](#8-imagesearchresults)
9. [LinkPreviewCard — Rich URL Cards](#9-linkpreviewcard)
10. [How to Wire Everything in Home Chat](#10-wiring-in-home-chat)
11. [Web App Fetch Guide](#11-web-app-fetch-guide)

---

## 1. Architecture Overview

```
User types "@Spotify play workout music"
         │
         ▼
ConnectedAppsModal (@ mention popup)
         │  user selects Spotify
         ▼
home.tsx → sends message to chat edge function
         │  chat function detects Spotify intent
         ▼
spotify-connect edge function → Spotify API → results
         │
         ▼
SpotifyMusicCard renders in MessageItem
```

**AsyncStorage keys used by the entire app-connect system:**

| Key | Value | Purpose |
|-----|-------|---------|
| `connected_apps` | JSON array of IDs | `["spotify","shazam"]` — which apps are connected |
| `spotify_connected` | `"true"` / `"false"` | Quick check for Spotify connection |
| `spotify_has_account` | `"true"` / `"false"` | Has OAuth token (vs anonymous) |
| `spotify_access_token` | JWT string | Spotify API access token |
| `spotify_refresh_token` | JWT string | Token to get new access_token |
| `spotify_token_expiry` | Unix ms timestamp | When access_token expires |
| `shazam_connected` | `"true"` / `"false"` | Quick check for Shazam connection |

---

## 2. App Connect Hub

**File**: `app/app-connect.tsx`

This is the main "Apps" page — like ChatGPT's "Enabled apps" settings screen.

### What it does

- Shows all available integrations (Spotify, Shazam, Apple Music coming soon)
- Category tabs: Featured / Music / Productivity
- Search bar to filter apps
- Featured hero card for the primary app
- Shows "Connected" badge when user has linked an app
- Navigates to individual app connect pages

### Key logic

```tsx
// Load which apps are already connected
useEffect(() => {
  AsyncStorage.getItem('connected_apps').then(raw => {
    if (raw) {
      try { setConnectedApps(new Set(JSON.parse(raw))); } catch (_e) {}
    }
  });
}, []);

// Navigate to individual app
router.push('/spotify-connect');  // or '/shazam-connect'
```

### App data structure

```ts
const ALL_APPS = [
  {
    id: 'spotify',           // used as key in connected_apps AsyncStorage
    name: 'Spotify',
    description: 'Music and podcasts for you',
    category: ['Featured', 'Music'],
    route: '/spotify-connect',  // Expo Router path
    comingSoon: false,
  },
  {
    id: 'shazam',
    name: 'Shazam',
    description: 'Identify any song playing around you',
    category: ['Featured', 'Music'],
    route: '/shazam-connect',
    comingSoon: false,
  },
  {
    id: 'apple-music',
    name: 'Apple Music',
    category: ['Music'],
    route: '',
    comingSoon: true,          // Grayed out, no navigation
  },
];
```

### Adding a new app to the hub

```ts
// 1. Add entry to ALL_APPS
{ id: 'canva', name: 'Canva', description: 'Design with AI', category: ['Productivity'], route: '/canva-connect', comingSoon: false }

// 2. Add its logo component
function CanvaLogo({ size = 52 }) { /* your styled logo */ }

// 3. Add it to AppIcon switch inside AppListRow
if (app.id === 'canva') return <CanvaLogo size={size} />;

// 4. Create app/canva-connect.tsx following the same pattern as shazam-connect.tsx
```

### Web equivalent

```jsx
// React web — same data, different navigation
import { useNavigate } from 'react-router-dom';
const navigate = useNavigate();

// App cards
ALL_APPS.map(app => (
  <div key={app.id} onClick={() => !app.comingSoon && navigate(`/apps/${app.id}`)}>
    <AppLogo id={app.id} />
    <h3>{app.name}</h3>
    <p>{app.description}</p>
    {connectedApps.has(app.id) && <span className="badge">Connected</span>}
  </div>
))
```

---

## 3. Shazam Integration

**File**: `app/shazam-connect.tsx`  
**Edge function**: `supabase/functions/shazam-identify/index.ts`

### What Shazam does in this app

Shazam is used for **audio fingerprinting** — identifying songs by recording a short audio sample. When connected, users can use `@Shazam` in chat and the AI will trigger audio recording.

### Connect flow

```
User taps "Connect" → ShazamConnectModal opens (privacy consent + memory toggle)
→ User taps "Connect Shazam"
→ handleConnect() saves to AsyncStorage
→ connected_apps: ["shazam"] stored
→ User sees "Connected" badge
```

### Disconnect flow

```ts
const handleDisconnect = () => {
  AsyncStorage.multiRemove(['shazam_connected']).then(() => {
    AsyncStorage.getItem('connected_apps').then(raw => {
      if (raw) {
        const apps = JSON.parse(raw).filter((a: string) => a !== 'shazam');
        AsyncStorage.setItem('connected_apps', JSON.stringify(apps));
      }
    });
    setConnected(false);
  });
};
```

### Edge Function: `shazam-identify`

**Endpoint**: `POST /functions/v1/shazam-identify`

**Required secret**: `SHAZAM_API_KEY` (RapidAPI key for `shazam.p.rapidapi.com`)

#### Request body

```json
{
  "audio": "<base64-encoded raw audio bytes>",
  "sampleMs": 4000
}
```

#### Response

```json
{
  "track": {
    "title": "That's So True",
    "artist": "Gracie Abrams",
    "album": "Short n' Sweet",
    "coverUrl": "https://is1-ssl.mzstatic.com/image/...",
    "previewUrl": "https://audio-ssl.itunes.apple.com/...",
    "appleUrl": "music://music.apple.com/...",
    "spotifyUrl": "spotify:track:3...",
    "genres": "Pop",
    "releaseDate": "2024-08-23",
    "shazamUrl": "https://www.shazam.com/track/...",
    "key": "715116504",
    "lyrics": "I hate myself...",
    "bpm": "120"
  },
  "matches": [...]
}
```

#### How to call from app

```ts
import { getSupabaseClient } from '@/template';
import { Audio } from 'expo-av';

async function identifySong() {
  const supabase = getSupabaseClient();

  // 1. Record audio (4 seconds)
  const recording = new Audio.Recording();
  await Audio.requestPermissionsAsync();
  await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
  await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
  await recording.startAsync();
  await new Promise(r => setTimeout(r, 4000));
  await recording.stopAndUnloadAsync();

  // 2. Convert to base64
  const uri = recording.getURI();
  const base64 = await FileSystem.readAsStringAsync(uri!, { encoding: 'base64' });

  // 3. Send to edge function
  const { data, error } = await supabase.functions.invoke('shazam-identify', {
    body: { audio: base64, sampleMs: 4000 }
  });

  if (error) throw error;
  return data.track; // ShazamTrack | null
}
```

#### Full ShazamTrack type

```ts
interface ShazamTrack {
  title: string;       // Song title
  artist: string;      // Artist name
  album: string;       // Album name
  coverUrl: string;    // Album art URL (high-res)
  previewUrl: string;  // 30s audio preview (Apple CDN)
  appleUrl: string;    // Deep link: music://...
  spotifyUrl: string;  // Deep link: spotify:track:...
  genres: string;      // "Pop" | "Hip-Hop" etc.
  releaseDate: string; // "2024-08-23"
  shazamUrl: string;   // https://www.shazam.com/track/...
  key: string;         // Shazam internal ID
  lyrics: string;      // First 8 lines of lyrics
  bpm: string;         // "120"
}
```

#### Web implementation

```ts
// Web: record via MediaRecorder API
async function identifySongWeb() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream);
  const chunks: BlobPart[] = [];

  recorder.ondataavailable = e => chunks.push(e.data);
  recorder.start();
  await new Promise(r => setTimeout(r, 4000));
  recorder.stop();

  await new Promise(r => { recorder.onstop = r; });
  stream.getTracks().forEach(t => t.stop());

  const blob = new Blob(chunks, { type: 'audio/webm' });
  const buffer = await blob.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));

  // Same edge function call
  const res = await fetch(`${SUPABASE_URL}/functions/v1/shazam-identify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify({ audio: base64 })
  });
  return res.json();
}
```

---

## 4. Spotify Integration

**File**: `app/spotify-connect.tsx`  
**Edge function**: `supabase/functions/spotify-connect/index.ts`

### Connect flow (two modes)

#### Mode 1: Connect without account (anonymous)
```
User → "Continue without account" 
→ AsyncStorage: spotify_connected=true, spotify_has_account=false
→ Can search Spotify using client_credentials token (server-side)
→ Cannot save to library, create playlists, or play full tracks
```

#### Mode 2: Connect with Spotify account (OAuth)
```
User → "Connect Spotify" → Alert confirmation
→ WebView opens accounts.spotify.com OAuth page
→ User logs in and approves scopes
→ Spotify redirects to: https://njpuoozygqtpvlzhnjpu.backend.onspace.ai/spotify/callback?code=xxx
→ WebView intercepts the callback URL in onShouldStartLoadWithRequest
→ Extracts code, calls exchange_code edge function
→ Stores access_token + refresh_token in AsyncStorage
→ AsyncStorage: spotify_connected=true, spotify_has_account=true
```

### Required Expo env variable

```env
EXPO_PUBLIC_SPOTIFY_CLIENT_ID=your_spotify_client_id
```

### Required edge function secrets

```
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
```

### OAuth Scopes used

```
user-library-modify   → save tracks
user-read-private     → read user profile
user-read-email       → read email
streaming             → play full tracks (Premium only)
```

---

## 5. Edge Functions

### `spotify-connect` — All supported actions

**Endpoint**: `POST /functions/v1/spotify-connect`

#### `action: exchange_code`

Exchange OAuth code for tokens after WebView redirect.

```ts
const { data } = await supabase.functions.invoke('spotify-connect', {
  body: {
    action: 'exchange_code',
    code: 'AQD...',                                                    // from OAuth redirect
    redirectUri: 'https://njpuoozygqtpvlzhnjpu.backend.onspace.ai/spotify/callback'
  }
});
// Returns: { access_token, refresh_token, expires_in, token_type }
```

#### `action: refresh_token`

Refresh an expired access_token.

```ts
const { data } = await supabase.functions.invoke('spotify-connect', {
  body: {
    action: 'refresh_token',
    refreshToken: 'AQA...'
  }
});
// Returns: { access_token, refresh_token?, expires_in }
```

#### `action: search`

Search for songs and playlists. Uses user token if provided, falls back to client_credentials.

```ts
const { data } = await supabase.functions.invoke('spotify-connect', {
  body: {
    action: 'search',
    query: 'best workout songs gym energy',
    accessToken: 'BQD...'  // optional — omit for anonymous search
  }
});
// Returns: { results: SpotifyTrack[] }
```

**SpotifyTrack object returned:**

```ts
{
  id: "3n3Ppam7vgaVa1iaRUIOKE",
  name: "Eye of the Tiger",
  owner: "Survivor",            // artist or playlist owner
  type: "Song" | "Playlist",
  imageUrl: "https://i.scdn.co/image/...",
  previewUrl: "https://p.scdn.co/mp3-preview/...",  // null if not available
  spotifyUrl: "https://open.spotify.com/track/...",
  uri: "spotify:track:3n3Ppam7vgaVa1iaRUIOKE"
}
```

#### `action: save_to_library`

Save a track to the user's Spotify library (requires user token + Premium).

```ts
await supabase.functions.invoke('spotify-connect', {
  body: {
    action: 'save_to_library',
    accessToken: 'BQD...',
    trackId: '3n3Ppam7vgaVa1iaRUIOKE'
  }
});
// Returns: { success: true, status: 200 }
```

#### `action: follow_playlist`

Follow/save a playlist to the user's library.

```ts
await supabase.functions.invoke('spotify-connect', {
  body: {
    action: 'follow_playlist',
    accessToken: 'BQD...',
    trackId: '37i9dQZF1DX...'  // playlist ID
  }
});
```

### Token refresh helper (client-side utility)

```ts
// utils/spotify-token.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseClient } from '@/template';

const TOKEN_EXPIRY_KEY = 'spotify_token_expiry';

export async function getValidSpotifyToken(): Promise<string | null> {
  const supabase = getSupabaseClient();
  try {
    const [tokenResult, refreshResult, expiryResult] = await AsyncStorage.multiGet([
      'spotify_access_token', 'spotify_refresh_token', TOKEN_EXPIRY_KEY
    ]);
    const token = tokenResult[1];
    const refresh = refreshResult[1];
    const expiry = expiryResult[1] ? parseInt(expiryResult[1], 10) : 0;

    // Token still valid (with 2-minute buffer)
    if (token && Date.now() < expiry - 120_000) return token;

    // Token expired — try to refresh
    if (!refresh) return null;
    const { data, error } = await supabase.functions.invoke('spotify-connect', {
      body: { action: 'refresh_token', refreshToken: refresh }
    });
    if (error || !data?.access_token) return null;

    const newExpiry = Date.now() + (data.expires_in || 3600) * 1000;
    await AsyncStorage.multiSet([
      ['spotify_access_token', data.access_token],
      [TOKEN_EXPIRY_KEY, String(newExpiry)],
      ...(data.refresh_token ? [['spotify_refresh_token', data.refresh_token] as [string, string]] : [])
    ]);
    return data.access_token;
  } catch { return null; }
}
```

### `fetch-link-preview` — OG metadata fetcher

**Endpoint**: `POST /functions/v1/fetch-link-preview`

Scrapes Open Graph tags + oEmbed for any URL.

```ts
const { data } = await supabase.functions.invoke('fetch-link-preview', {
  body: { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }
});

// Returns:
{
  title: "Rick Astley - Never Gonna Give You Up",
  description: "The official video for ...",
  image: "https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
  author: "RickAstleyVEVO",
  siteName: "YouTube",
  platform: "youtube",
  url: "https://www.youtube.com/watch?v=..."
}
```

**Supported platforms with oEmbed (most accurate):**
- TikTok → `tiktok.com/oembed`
- YouTube → `youtube.com/oembed` + HD thumbnail
- Twitter/X → `publish.twitter.com/oembed`

**Generic OG scraping for all other URLs:**
- Reads first 80KB of HTML `<head>`
- Parses `og:title`, `og:image`, `og:description`
- Falls back to `twitter:*` tags
- Falls back to JSON-LD structured data
- 1-hour CDN cache via `Cache-Control` header

---

## 6. ConnectedAppsModal

**File**: `components/ConnectedAppsModal.tsx`

### Two modes

#### Mode 1: `mentionMode=true` — `@` mention popup above input bar

Triggered when user types `@` in the chat input. Shows a floating card above the keyboard.

```tsx
<ConnectedAppsModal
  visible={showMentionPicker}
  onClose={() => setShowMentionPicker(false)}
  connectedApps={connectedApps}
  onSelectApp={(app) => {
    // Insert "@AppName " into input text
    setInputText(prev => prev.replace(/@\w*$/, `@${app.name} `));
    setShowMentionPicker(false);
  }}
  mentionMode={true}
  mentionQuery={mentionQuery}  // "spo" filters to Spotify
/>
```

**How to detect `@` mention in input:**

```ts
const handleInputChange = (text: string) => {
  setInputText(text);
  const mentionMatch = text.match(/@(\w*)$/);
  if (mentionMatch) {
    setMentionQuery(mentionMatch[1]);
    setShowMentionPicker(true);
  } else {
    setShowMentionPicker(false);
  }
};
```

#### Mode 2: Full bottom sheet — connected apps list

Triggered when user taps the `@` button in the toolbar.

```tsx
<ConnectedAppsModal
  visible={showAppsModal}
  onClose={() => setShowAppsModal(false)}
  connectedApps={connectedApps}
  onSelectApp={(app) => {
    // Insert app mention into chat
    setInputText(`@${app.name} `);
    setShowAppsModal(false);
  }}
/>
```

### Loading connected apps

```ts
// In home.tsx or wherever you use the modal
const [connectedApps, setConnectedApps] = useState<ConnectedApp[]>([]);

useEffect(() => {
  const load = async () => {
    const raw = await AsyncStorage.getItem('connected_apps');
    if (!raw) return;
    const ids: string[] = JSON.parse(raw);
    const appDefs: ConnectedApp[] = ids.map(id => ({
      id,
      name: id === 'spotify' ? 'Spotify' : id === 'shazam' ? 'Shazam' : id,
      description: id === 'spotify' ? 'Music and podcasts' : 'Song identification',
      color: id === 'spotify' ? '#1DB954' : '#0D72EA',
    }));
    setConnectedApps(appDefs);
  };
  load();
}, []);
```

### ConnectedApp interface

```ts
export interface ConnectedApp {
  id: string;           // 'spotify' | 'shazam' | 'apple-music'
  name: string;         // Display name
  description: string;  // Short description shown in modal
  color: string;        // Brand color (used as fallback icon bg)
}
```

---

## 7. SpotifyMusicCard

**File**: `components/SpotifyMusicCard.tsx`

### What it renders

A rich music player card in the chat — shows album art, track name, artist, preview button (30s audio playback), + save button, and ▶ open in Spotify button.

### Usage in MessageItem

```tsx
import { SpotifyMusicCard } from './SpotifyMusicCard';

// In your message rendering logic:
{message.spotifyData && (
  <SpotifyMusicCard
    tracks={message.spotifyData.tracks}
    hasAccount={message.spotifyData.hasAccount}
    isDark={isDark}
    isGuest={isGuest}
    isLoading={false}
    searchQuery={message.spotifyData.query}
    onConnectSpotify={() => router.push('/spotify-connect')}
  />
)}
```

### SpotifyTrack interface (required for tracks prop)

```ts
export interface SpotifyTrack {
  id: string;              // Spotify track/playlist ID
  name: string;            // Track name
  owner: string;           // Artist or playlist creator
  type: string;            // 'Song' | 'Playlist'
  imageUrl: string | null; // Album art URL
  previewUrl: string | null; // 30s preview URL (null if unavailable)
  spotifyUrl: string;      // Full spotify.com URL
  uri: string;             // Deep link: spotify:track:...
}
```

### SpotifyLoadingOverlay

Show while the edge function is fetching results:

```tsx
import { SpotifyLoadingOverlay } from './SpotifyMusicCard';

<SpotifyLoadingOverlay 
  visible={isSearchingSpotify} 
  query="workout songs"
/>
```

### Full flow: detect Spotify intent → search → display

```ts
// In home.tsx sendMessage handler:
const text = inputText.trim();

// Detect Spotify intent
const hasSpotifyMention = text.toLowerCase().includes('@spotify') || 
  text.toLowerCase().includes('play ') || 
  text.toLowerCase().includes('music for');

if (hasSpotifyMention && isSpotifyConnected) {
  // Extract music query
  const query = text
    .replace(/@spotify/i, '')
    .replace(/play\s/i, '')
    .trim();

  setIsSearchingSpotify(true);
  const supabase = getSupabaseClient();
  const accessToken = await getValidSpotifyToken();

  const { data } = await supabase.functions.invoke('spotify-connect', {
    body: { 
      action: 'search', 
      query,
      ...(accessToken ? { accessToken } : {})
    }
  });

  setIsSearchingSpotify(false);

  // Attach Spotify data to the AI response message
  const aiMessage = {
    id: uuid(),
    role: 'assistant',
    content: `Here are some tracks for "${query}":`,
    spotifyData: {
      tracks: data?.results || [],
      query,
      hasAccount: hasSpotifyAccountLinked
    }
  };
  setMessages(prev => [...prev, aiMessage]);
}
```

---

## 8. ImageSearchResults

**File**: `components/ImageSearchResults.tsx`

### What it renders

A 2-column image grid carousel in the chat. Used when the AI performs a web/image search and returns image URLs.

### Usage in MessageItem or home.tsx

```tsx
import { ImageSearchResults } from './ImageSearchResults';

// When AI returns images in its response:
{message.imageResults && message.imageResults.length > 0 && (
  <ImageSearchResults
    query={message.imageQuery || ''}
    images={message.imageResults}
    onImagePress={(url) => {
      // Open full-screen viewer
      router.push({ pathname: '/image-viewer', params: { url } });
    }}
  />
)}
```

### SearchImage interface

```ts
interface SearchImage {
  url: string;         // Direct image URL
  title?: string;      // Image caption / page title
  source?: string;     // Domain name (e.g. "unsplash.com")
  resolution?: string; // "1920x1080" (optional)
}
```

### How to parse images from AI chat response

The chat edge function returns images in the response JSON. Parse them like this:

```ts
// In your chat response handler:
if (response.images && Array.isArray(response.images)) {
  const images: SearchImage[] = response.images.map((img: any) => ({
    url: img.url || img.src || img.imageUrl,
    title: img.title || img.alt,
    source: img.source || img.domain,
  }));
  
  // Add to message
  setMessages(prev => prev.map(m => 
    m.id === aiMessageId 
      ? { ...m, imageResults: images, imageQuery: userQuery }
      : m
  ));
}
```

### Download feature

The component includes a built-in download button using `expo-media-library`:

```ts
// Automatically handles:
// 1. Requests MediaLibrary permission
// 2. Downloads image to app's document directory
// 3. Saves to camera roll / photo album named "Dawinix"
// 4. Shows success alert
```

### How AI sends images (chat edge function side)

The chat edge function can return image search results. Make sure your edge function response includes:

```json
{
  "content": "Here are some images of mountain landscapes:",
  "images": [
    {
      "url": "https://images.unsplash.com/photo-...",
      "title": "Snow-capped Mountain",
      "source": "unsplash.com"
    },
    {
      "url": "https://upload.wikimedia.org/...",
      "title": "Alpine Lake",
      "source": "wikipedia.org"
    }
  ]
}
```

In `supabase/functions/_shared/ai-providers.ts`, the search tool results are structured to include image arrays when the Brave Search API returns image results.

---

## 9. LinkPreviewCard

**File**: `components/LinkPreviewCard.tsx`

### What it renders

A glassmorphism URL preview card — shows platform badge, thumbnail, title, description, author, and an "Open" button. Also includes a compact `UrlChip` inline variant.

### Usage in MessageItem

```tsx
import { LinkPreviewCard, UrlChip, extractFirstUrl, detectLinkPlatform } from './LinkPreviewCard';

// Full card (below message text):
{message.linkUrl && (
  <LinkPreviewCard
    url={message.linkUrl}
    isDark={isDark}
    colors={colors}
    compact={false}
  />
)}

// Inline chip (inside message bubble):
{message.linkUrl && (
  <UrlChip
    url={message.linkUrl}
    isDark={isDark}
    colors={colors}
  />
)}
```

### Auto-detect links in messages

```ts
import { extractFirstUrl } from './LinkPreviewCard';

// When rendering a message, check for URLs:
const linkUrl = extractFirstUrl(message.content);

// Then render:
{linkUrl && <LinkPreviewCard url={linkUrl} isDark={isDark} colors={colors} />}
```

### Fetch metadata manually

```ts
import { getSupabaseClient } from '@/template';
import { detectLinkPlatform } from './LinkPreviewCard';

async function fetchLinkMeta(url: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke('fetch-link-preview', {
    body: { url }
  });
  if (error || !data) return null;
  return {
    title: data.title,
    description: data.description,
    thumbnail: data.image,
    author: data.author,
    siteName: data.siteName,
    platform: detectLinkPlatform(url),
    url
  };
}
```

### Pass pre-fetched metadata (skip network request)

If you fetch metadata server-side (in your edge function) and include it in the message response, pass it directly to skip the client-side fetch:

```tsx
<LinkPreviewCard
  url={message.linkUrl}
  metadata={message.linkMeta}  // { title, description, thumbnail, platform, url }
  isDark={isDark}
  colors={colors}
/>
```

### UrlChip

Compact inline variant — shows brand icon + domain + "open" icon:

```tsx
import { UrlChip } from './LinkPreviewCard';

<UrlChip
  url="https://open.spotify.com/track/..."
  isDark={isDark}
  colors={colors}
/>
// Renders: 🎵 open.spotify.com/track/...  ↗
```

### Supported platforms with brand colors

| Platform | Icon | Background | Auto-detected from |
|----------|------|------------|-------------------|
| TikTok | `logo-tiktok` | `#010101` | `tiktok.com`, `vm.tiktok.com` |
| YouTube | `logo-youtube` | `#FF0000` | `youtube.com`, `youtu.be` |
| Instagram | `logo-instagram` | `#E1306C` | `instagram.com` |
| Facebook | `logo-facebook` | `#1877F2` | `facebook.com`, `fb.com` |
| Twitter/X | `logo-twitter` | `#000000` | `twitter.com`, `x.com` |
| Reddit | `logo-reddit` | `#FF4500` | `reddit.com` |
| GitHub | `logo-github` | `#24292E` | `github.com` |
| LinkedIn | `business` | `#0A66C2` | `linkedin.com` |
| Spotify | `musical-notes` | `#1DB954` | `spotify.com` |
| Amazon | `cart` | `#FF9900` | `amazon.com`, `amzn.to` |
| Medium/Substack | `document-text` | `#607D8B` | `medium.com`, `substack.com` |
| Default | `globe-outline` | `#007AFF` | any other URL |

---

## 10. Wiring Everything in Home Chat

### Complete home.tsx integration pattern

```tsx
// State declarations
const [connectedApps, setConnectedApps] = useState<ConnectedApp[]>([]);
const [isSpotifyConnected, setIsSpotifyConnected] = useState(false);
const [showMentionPicker, setShowMentionPicker] = useState(false);
const [mentionQuery, setMentionQuery] = useState('');
const [isSearchingSpotify, setIsSearchingSpotify] = useState(false);

// Load connected apps on mount
useEffect(() => {
  const loadApps = async () => {
    const raw = await AsyncStorage.getItem('connected_apps');
    if (!raw) return;
    const ids: string[] = JSON.parse(raw);
    setIsSpotifyConnected(ids.includes('spotify'));
    setConnectedApps(ids.map(id => ({
      id,
      name: { spotify: 'Spotify', shazam: 'Shazam' }[id] || id,
      description: { spotify: 'Music and podcasts', shazam: 'Song identification' }[id] || '',
      color: { spotify: '#1DB954', shazam: '#0D72EA' }[id] || '#888',
    })));
  };
  loadApps();
}, []);

// Input change handler with @ detection
const handleInputChange = (text: string) => {
  setInputText(text);
  const mentionMatch = text.match(/@(\w*)$/);
  if (mentionMatch) {
    setMentionQuery(mentionMatch[1]);
    setShowMentionPicker(true);
  } else {
    setShowMentionPicker(false);
  }
};

// In your JSX:
return (
  <View style={{ flex: 1 }}>
    {/* Chat messages list */}
    <FlatList
      data={messages}
      renderItem={({ item }) => (
        <MessageItem
          message={item}
          isDark={isDark}
          colors={colors}
        />
      )}
    />

    {/* Spotify loading overlay */}
    <SpotifyLoadingOverlay
      visible={isSearchingSpotify}
      query={lastSpotifyQuery}
    />

    {/* @ mention picker — appears ABOVE input bar */}
    <ConnectedAppsModal
      visible={showMentionPicker}
      onClose={() => setShowMentionPicker(false)}
      connectedApps={connectedApps}
      onSelectApp={(app) => {
        setInputText(prev => prev.replace(/@\w*$/, `@${app.name} `));
        setShowMentionPicker(false);
      }}
      mentionMode={true}
      mentionQuery={mentionQuery}
    />

    {/* Input bar */}
    <TextInput
      value={inputText}
      onChangeText={handleInputChange}
    />
  </View>
);
```

### MessageItem — rendering Spotify + Images + Links

```tsx
// Inside MessageItem.tsx, in the AI message render:

// 1. Spotify Music Card
{message.spotifyTracks && message.spotifyTracks.length > 0 && (
  <SpotifyMusicCard
    tracks={message.spotifyTracks}
    hasAccount={spotifyHasAccount}
    isDark={isDark}
    onConnectSpotify={() => router.push('/spotify-connect')}
  />
)}

// 2. Image search results grid
{message.images && message.images.length > 0 && (
  <ImageSearchResults
    query={message.imageQuery || ''}
    images={message.images}
    onImagePress={(url) => setViewerUrl(url)}
  />
)}

// 3. Link preview card (auto-detect URL in message)
{(() => {
  const url = extractFirstUrl(message.content);
  return url ? (
    <LinkPreviewCard
      url={url}
      isDark={isDark}
      colors={colors}
    />
  ) : null;
})()}
```

---

## 11. Web App Fetch Guide

### Setup

```ts
// lib/supabase.ts (web)
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://njpuoozygqtpvlzhnjpu.backend.onspace.ai',
  'YOUR_SUPABASE_ANON_KEY'
);
```

### Fetch App Connect state (connected apps)

The connected apps are stored in **AsyncStorage on device**, not in the database. For a web app, you should store in `localStorage`:

```ts
// web: utils/connected-apps.ts
export function getConnectedApps(): string[] {
  try {
    return JSON.parse(localStorage.getItem('connected_apps') || '[]');
  } catch { return []; }
}

export function addConnectedApp(id: string) {
  const apps = getConnectedApps();
  if (!apps.includes(id)) apps.push(id);
  localStorage.setItem('connected_apps', JSON.stringify(apps));
}

export function removeConnectedApp(id: string) {
  const apps = getConnectedApps().filter(a => a !== id);
  localStorage.setItem('connected_apps', JSON.stringify(apps));
}
```

### Fetch Spotify search on web

```ts
async function searchSpotify(query: string, accessToken?: string) {
  const res = await fetch(
    'https://njpuoozygqtpvlzhnjpu.backend.onspace.ai/functions/v1/spotify-connect',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        action: 'search',
        query,
        ...(accessToken ? { accessToken } : {})
      })
    }
  );
  const data = await res.json();
  return data.results as SpotifyTrack[];
}
```

### Spotify OAuth flow on web

```ts
// 1. Get OAuth URL
const res = await fetch('.../spotify-connect', {
  method: 'POST',
  body: JSON.stringify({
    action: 'exchange_code',      // After user returns from Spotify
    code: urlParams.get('code'),
    redirectUri: `${window.location.origin}/auth/spotify/callback`
  })
});
const { access_token, refresh_token, expires_in } = await res.json();
localStorage.setItem('spotify_access_token', access_token);
localStorage.setItem('spotify_refresh_token', refresh_token);
localStorage.setItem('spotify_token_expiry', String(Date.now() + expires_in * 1000));
```

### Fetch Shazam on web

```ts
async function identifySongWeb(audioBase64: string) {
  const res = await fetch(
    'https://njpuoozygqtpvlzhnjpu.backend.onspace.ai/functions/v1/shazam-identify',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ audio: audioBase64 })
    }
  );
  return res.json(); // { track: ShazamTrack | null }
}
```

### Fetch link preview on web

```ts
async function getLinkPreview(url: string) {
  const res = await fetch(
    'https://njpuoozygqtpvlzhnjpu.backend.onspace.ai/functions/v1/fetch-link-preview',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ url })
    }
  );
  return res.json();
  // { title, description, image, author, siteName, platform, url }
}
```

### Render SpotifyMusicCard equivalent on web (React)

```tsx
// components/SpotifyCard.tsx (web)
import React, { useState } from 'react';

export function SpotifyCard({ tracks }: { tracks: SpotifyTrack[] }) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = React.useRef<HTMLAudioElement>(null);

  const playPreview = (track: SpotifyTrack) => {
    if (!track.previewUrl) {
      window.open(track.spotifyUrl, '_blank');
      return;
    }
    if (playingId === track.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.src = track.previewUrl;
      audioRef.current.play();
      setPlayingId(track.id);
    }
  };

  return (
    <div className="spotify-card">
      <audio ref={audioRef} onEnded={() => setPlayingId(null)} />
      <div className="spotify-header">
        <SpotifyLogo size={20} />
        <span>Spotify</span>
      </div>
      {tracks.map(track => (
        <div key={track.id} className="track-row">
          {track.imageUrl && <img src={track.imageUrl} alt={track.name} width={68} height={68} />}
          <div className="track-info">
            <strong>{track.name}</strong>
            <span>{track.owner} · {track.type}</span>
            <button onClick={() => playPreview(track)}>
              {playingId === track.id ? '⏸ Playing...' : '▶ Preview'}
            </button>
          </div>
          <button onClick={() => window.open(track.spotifyUrl, '_blank')}>
            Open in Spotify ↗
          </button>
        </div>
      ))}
    </div>
  );
}
```

### Render LinkPreviewCard equivalent on web

```tsx
// components/LinkPreview.tsx (web)
import { useEffect, useState } from 'react';

export function LinkPreview({ url }: { url: string }) {
  const [meta, setMeta] = useState<any>(null);

  useEffect(() => {
    getLinkPreview(url).then(setMeta);
  }, [url]);

  if (!meta) return <div className="link-skeleton" />;

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="link-card">
      {meta.image && <img src={meta.image} alt={meta.title} className="link-thumbnail" />}
      <div className="link-info">
        <h4>{meta.title}</h4>
        {meta.description && <p>{meta.description}</p>}
        <span>{meta.siteName || meta.platform}</span>
      </div>
    </a>
  );
}
```

### ImageSearchResults equivalent on web

```tsx
// components/ImageGrid.tsx (web)
export function ImageGrid({ images, query }: { images: SearchImage[]; query: string }) {
  const downloadImage = async (url: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `image-${Date.now()}.jpg`;
    a.target = '_blank';
    a.click();
  };

  return (
    <div className="image-grid">
      <p className="query-label">{query}</p>
      <div className="grid-2col">
        {images.map((img, i) => (
          <div key={i} className="image-card" onClick={() => window.open(img.url, '_blank')}>
            <img src={img.url} alt={img.title} loading="lazy" />
            <div className="image-overlay">
              {img.title && <span>{img.title}</span>}
              <button onClick={e => { e.stopPropagation(); downloadImage(img.url); }}>⬇</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## App Logo Sources (for Web)

All app logos in the native app are rendered as **native vector components** (no images). For web, use these official CDN URLs:

| App | Official Logo URL |
|-----|-------------------|
| Spotify | `https://storage.googleapis.com/pr-newsroom-wp/1/2018/11/Spotify_Logo_RGB_Green.png` |
| Shazam | `https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Shazam_logo.svg/640px-Shazam_logo.svg.png` |
| Apple Music | `https://upload.wikimedia.org/wikipedia/commons/5/5f/Apple_Music_icon.svg` |

For brand-accurate colors in CSS:

```css
.spotify-brand { background-color: #1DB954; }
.shazam-brand  { background-color: #0D72EA; }
.apple-music   { background: linear-gradient(135deg, #FA233B, #FB5C74); }
```

---

## Quick Reference Card

| Feature | File | Edge Function | Key Storage |
|---------|------|---------------|-------------|
| App hub | `app/app-connect.tsx` | none | `connected_apps` (array) |
| Shazam | `app/shazam-connect.tsx` | `shazam-identify` | `shazam_connected` |
| Spotify OAuth | `app/spotify-connect.tsx` | `spotify-connect` | `spotify_access_token` |
| Spotify search | `SpotifyMusicCard.tsx` | `spotify-connect` | `spotify_refresh_token` |
| App mention | `ConnectedAppsModal.tsx` | none | `connected_apps` |
| Image grid | `ImageSearchResults.tsx` | `chat` (search results) | none |
| Link card | `LinkPreviewCard.tsx` | `fetch-link-preview` | in-memory cache |
