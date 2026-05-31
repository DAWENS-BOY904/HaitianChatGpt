# 🌐 Complete Web Integration Guide — Dawinix Web App
### Connect Your Website to the Same Supabase Backend as the Mobile App

> **This guide covers everything:** Auth sync, chat history, guest conversations, AI image fetch, TTS audio, transcription, and how to use the shared Edge Functions directly from your web app.

---

## 📋 Table of Contents

1. [Setup — Connect Web to Supabase](#1-setup--connect-web-to-supabase)
2. [Auth Sync — Auto Login from App to Web](#2-auth-sync--auto-login-from-app-to-web)
3. [Load All Users (Same Database)](#3-load-all-users-same-database)
4. [Fetch Chat History — Side Menu Conversations](#4-fetch-chat-history--side-menu-conversations)
5. [Fetch Real Messages for Any Conversation](#5-fetch-real-messages-for-any-conversation)
6. [Fetch Guest Conversations](#6-fetch-guest-conversations)
7. [AI Chat — Call the Same Edge Function](#7-ai-chat--call-the-same-edge-function)
8. [Fetch Real AI-Generated Images](#8-fetch-real-ai-generated-images)
9. [Transcribe Audio via App Edge Function](#9-transcribe-audio-via-app-edge-function)
10. [Generate TTS (Text-to-Speech) Audio](#10-generate-tts-text-to-speech-audio)
11. [Use /_shared/ai-providers.ts in Your Web Backend](#11-use-_sharedai-providersts-in-your-web-backend)
12. [Real-Time Updates — Polling Pattern](#12-real-time-updates--polling-pattern)
13. [Full React Web Example](#13-full-react-web-example)

---

## 1. Setup — Connect Web to Supabase

### Install the Supabase client

```bash
npm install @supabase/supabase-js
```

### Create your client (same credentials as the app)

```javascript
// lib/supabase.js
import { createClient } from '@supabase/supabase-js';

// These are the EXACT same values from your app's .env file
const SUPABASE_URL = 'https://njpuoozygqtpvlzhnjpu.backend.onspace.ai';
const SUPABASE_ANON_KEY = 'your-anon-key-here'; // from .env EXPO_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // important for OAuth redirects
  },
});
```

> **Where to find your keys:**
> - Go to OnSpace Cloud Dashboard → right panel
> - Your `SUPABASE_URL` and `SUPABASE_ANON_KEY` are the same ones in your mobile app
> - These are safe to use client-side (they are the anon/public keys)

---

## 2. Auth Sync — Auto Login from App to Web

When a user is logged in on the mobile app, you want the web app to automatically recognize them — **no second login needed.**

### How it works

Both the app and web use the **same Supabase project**. When a user logs in (via email OTP, password, or Google), Supabase creates a session token. If you share that token with the web, the web can restore the session.

### Step 1 — On the Mobile App side: Export session token

In your React Native app, after login you can get the session:

```typescript
// In your mobile app — export session for web
import { getSupabaseClient } from '@/template';

const supabase = getSupabaseClient();

async function getSessionForWeb(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  // Return the access token — web will use this to restore session
  return session.access_token;
}

// Example: generate a deep link or QR code that embeds the token
// dawinixweb.com/auth/callback?token=ACCESS_TOKEN
```

### Step 2 — On the Web side: Restore session from token

```javascript
// pages/auth/callback.js (Next.js) or auth-callback.html

import { supabase } from '../lib/supabase';

async function handleAuthCallback() {
  // Option A: Token from URL query param (from deep link)
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  if (token) {
    // Set session using the access token from mobile app
    const { data, error } = await supabase.auth.setSession({
      access_token: token,
      refresh_token: token, // Supabase will handle refresh automatically
    });
    if (!error && data.session) {
      console.log('Session restored from mobile app!', data.session.user.email);
      // Redirect to main page
      window.location.href = '/';
    }
  }

  // Option B: Standard Supabase OAuth flow (works for Google login too)
  // Supabase auto-handles the OAuth callback when detectSessionInUrl: true
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    console.log('Already logged in:', session.user.email);
  }
}

handleAuthCallback();
```

### Step 3 — Standard Email/Password login (same as app)

```javascript
// login.js — same email/password used in mobile app
import { supabase } from '../lib/supabase';

async function loginWithPassword(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error('Login failed:', error.message);
    return null;
  }

  console.log('Logged in:', data.user.email);
  return data.user;
}

// OTP Login (same flow as mobile app)
async function sendOTP(email) {
  const { error } = await supabase.auth.signInWithOtp({ email });
  return error;
}

async function verifyOTP(email, otp) {
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token: otp,
    type: 'email',
  });
  return { data, error };
}
```

### Step 4 — Google OAuth (same provider as app)

```javascript
// Google login on web — same Google credentials as mobile app
async function loginWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: 'https://yourwebsite.com/auth/callback',
    },
  });
  if (error) console.error(error);
}
```

### Step 5 — Listen for auth state changes

```javascript
// Anywhere in your web app
import { supabase } from '../lib/supabase';

supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    console.log('User signed in:', session.user.email);
    // Update your UI
  }
  if (event === 'SIGNED_OUT') {
    console.log('User signed out');
    // Redirect to login
  }
});
```

---

## 3. Load All Users (Same Database)

All users that register in the mobile app are stored in `public.user_profiles`. Your web app reads the **exact same table**.

```javascript
// Get current logged-in user's profile
async function getMyProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, username, email, role, subscription_tier, profile_photo_url, full_name')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('Profile fetch error:', error.message);
    return null;
  }

  return data;
}

// Example result:
// {
//   id: "uuid-here",
//   username: "jean_paul",
//   email: "jean@example.com",
//   role: "user",               // or "admin"
//   subscription_tier: "free",  // or "plus" / "pro"
//   profile_photo_url: "https://...",
//   full_name: "Jean Paul"
// }

// Update user profile (same row as mobile app sees)
async function updateProfile(userId, updates) {
  const { data, error } = await supabase
    .from('user_profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();
  return { data, error };
}
```

---

## 4. Fetch Chat History — Side Menu Conversations

The side menu in the app shows conversations from the `conversations` table. Your web app reads the **same table**.

```javascript
// Fetch all conversations for logged-in user (exactly like the side menu)
async function fetchConversations() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('conversations')
    .select('id, title, created_at, updated_at, is_archived, is_pinned, is_temporary')
    .eq('user_id', user.id)
    .eq('is_archived', false)      // exclude archived chats
    .eq('is_temporary', false)     // exclude temporary chats
    .order('updated_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Conversations fetch error:', error.message);
    return [];
  }

  return data;
}

// Example result:
// [
//   {
//     id: "uuid",
//     title: "How to learn Python",
//     created_at: "2026-05-20T10:00:00Z",
//     updated_at: "2026-05-30T15:32:00Z",
//     is_pinned: false,
//     is_archived: false
//   },
//   ...
// ]

// Create a new conversation (same as app's createConversation)
async function createConversation(title = 'New Chat') {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('conversations')
    .insert({
      user_id: user.id,
      title,
    })
    .select()
    .single();

  if (error) {
    console.error('Create conversation error:', error.message);
    return null;
  }

  return data; // { id, title, ... }
}

// Rename a conversation
async function renameConversation(conversationId, newTitle) {
  const { error } = await supabase
    .from('conversations')
    .update({ title: newTitle, updated_at: new Date().toISOString() })
    .eq('id', conversationId);

  return !error;
}

// Delete a conversation (cascades to messages automatically)
async function deleteConversation(conversationId) {
  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', conversationId);

  return !error;
}

// Archive a conversation
async function archiveConversation(conversationId) {
  const { error } = await supabase
    .from('conversations')
    .update({ is_archived: true })
    .eq('id', conversationId);

  return !error;
}
```

---

## 5. Fetch Real Messages for Any Conversation

Messages are stored in the `messages` table with a `conversation_id` foreign key.

```javascript
// Fetch all messages for a conversation (same data the app sees)
async function fetchMessages(conversationId) {
  const { data, error } = await supabase
    .from('messages')
    .select('id, conversation_id, role, content, image_url, image_urls, file_url, file_name, file_type, created_at, edited, edited_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Messages fetch error:', error.message);
    return [];
  }

  return data;
}

// Message shape:
// {
//   id: "uuid",
//   conversation_id: "uuid",
//   role: "user" | "assistant",
//   content: "message text with markdown",
//   image_url: "https://..." | null,
//   image_urls: ["url1", "url2"] | null,  // JSON array
//   file_url: "https://..." | null,
//   file_name: "document.pdf" | null,
//   file_type: "application/pdf" | null,
//   created_at: "2026-05-30T10:00:00Z",
//   edited: false,
//   edited_at: null
// }

// Save a new user message
async function saveUserMessage(conversationId, content, imageUrl = null) {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      role: 'user',
      content,
      image_url: imageUrl,
    })
    .select()
    .single();

  return { data, error };
}

// Save an AI assistant message
async function saveAssistantMessage(conversationId, content, imageUrl = null) {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      role: 'assistant',
      content,
      image_url: imageUrl,
    })
    .select()
    .single();

  // Also update conversation's updated_at
  await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId);

  return { data, error };
}
```

---

## 6. Fetch Guest Conversations

Guest conversations are handled differently. Guest users use the **Supabase anonymous auth** feature (enabled in your backend). They get a real session but no email.

```javascript
// Sign in as guest (same as mobile app guest mode)
async function signInAsGuest() {
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) {
    console.error('Guest sign in error:', error.message);
    return null;
  }
  // data.session.user.is_anonymous === true
  return data.user;
}

// Check if current user is a guest
async function isGuestUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.is_anonymous === true;
}

// Guest conversations are in the same conversations table
// BUT the mobile app may also create local-only guest conversations
// that are prefixed with "guest-session-" — these are NOT in the database
// Real guest conversations that were saved will appear normally

async function fetchGuestConversations() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Guest users have conversations just like normal users
  const { data, error } = await supabase
    .from('conversations')
    .select('id, title, created_at, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) return [];
  return data;
}

// Upgrade guest to full account (link email to guest session)
async function upgradeGuestToEmail(email, password) {
  const { data, error } = await supabase.auth.updateUser({
    email,
    password,
  });
  return { data, error };
}
```

---

## 7. AI Chat — Call the Same Edge Function

The mobile app calls `supabase/functions/chat/index.ts` for all AI responses. Your web app can call the **exact same function** using the Supabase client.

```javascript
// Send a message and get streaming AI response
// This calls the SAME edge function as the mobile app
async function sendMessage(conversationId, messages, aiModel = 'onspace-ai') {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const SUPABASE_URL = 'https://njpuoozygqtpvlzhnjpu.backend.onspace.ai';

  // Call the chat edge function with streaming
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/chat`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        conversationId,
        messages, // Array of { role: 'user'|'assistant', content: string }
        aiModel,  // 'onspace-ai' | 'gemini' | 'openai' | 'claude' | 'llama'
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Chat error ${response.status}: ${errorText}`);
  }

  // Handle SSE streaming response (same as mobile app)
  return response;
}

// Parse streaming response (SSE — Server-Sent Events)
async function streamAIResponse(conversationId, userMessage, onChunk, onDone) {
  const { data: { session } } = await supabase.auth.getSession();

  // Build messages array from database
  const history = await fetchMessages(conversationId);
  const messages = history.map(m => ({
    role: m.role,
    content: m.content,
  }));

  // Add the new user message
  messages.push({ role: 'user', content: userMessage });

  // Save user message to DB
  await saveUserMessage(conversationId, userMessage);

  const SUPABASE_URL = 'https://njpuoozygqtpvlzhnjpu.backend.onspace.ai';

  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/chat`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        conversationId,
        messages,
        aiModel: 'onspace-ai',
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Chat error: ${response.status}`);
  }

  // Read the SSE stream
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullContent = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim();
        if (data === '[DONE]') {
          // Stream complete
          await saveAssistantMessage(conversationId, fullContent);
          onDone(fullContent);
          return;
        }
        try {
          const parsed = JSON.parse(data);
          const token = parsed.choices?.[0]?.delta?.content || parsed.content || '';
          if (token) {
            fullContent += token;
            onChunk(token, fullContent);
          }
        } catch {
          // Not JSON — might be plain text chunk
          if (data && data !== '[DONE]') {
            fullContent += data;
            onChunk(data, fullContent);
          }
        }
      }
    }
  }

  if (fullContent) {
    await saveAssistantMessage(conversationId, fullContent);
    onDone(fullContent);
  }
}

// Usage example:
// await streamAIResponse(
//   conversationId,
//   "Bonjou, kijan ou ye?",
//   (chunk, fullSoFar) => {
//     document.getElementById('response').textContent = fullSoFar;
//   },
//   (finalContent) => {
//     console.log('Done:', finalContent);
//   }
// );
```

### Send message with image (same as mobile app photo upload)

```javascript
async function sendMessageWithImage(conversationId, userMessage, imageBase64) {
  const { data: { session } } = await supabase.auth.getSession();
  const history = await fetchMessages(conversationId);
  const messages = history.map(m => ({ role: m.role, content: m.content }));
  messages.push({ role: 'user', content: userMessage || 'Analyze this image' });

  const SUPABASE_URL = 'https://njpuoozygqtpvlzhnjpu.backend.onspace.ai';

  const response = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      conversationId,
      messages,
      aiModel: 'onspace-ai',
      base64Image: imageBase64, // base64 string WITHOUT the data:image/... prefix
    }),
  });

  return response; // Handle as SSE stream same as above
}
```

---

## 8. Fetch Real AI-Generated Images

When the AI generates images, they are automatically saved to:
1. `storage/chat-images` bucket (public URL)
2. `media_files` table (for the user's gallery)

```javascript
// Fetch all AI-generated images for current user
async function fetchMyAIImages() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('media_files')
    .select('id, file_url, file_name, file_type, created_at')
    .eq('user_id', user.id)
    .eq('file_type', 'image')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('AI images fetch error:', error.message);
    return [];
  }

  return data;
}

// Fetch AI-generated images from messages directly
// (These are assistant messages that contain an image_url)
async function fetchAIImagesFromMessages(conversationId) {
  const { data, error } = await supabase
    .from('messages')
    .select('id, image_url, image_urls, content, created_at')
    .eq('conversation_id', conversationId)
    .eq('role', 'assistant')
    .not('image_url', 'is', null)
    .order('created_at', { ascending: false });

  if (error) return [];

  return data
    .filter(m => m.image_url)
    .map(m => ({
      id: m.id,
      url: m.image_url,
      prompt: m.content?.replace(/Here is your generated image.*$/i, '').trim() || '',
      created_at: m.created_at,
    }));
}

// Get public URL for an image stored in chat-images bucket
function getChatImagePublicUrl(filePath) {
  const { data } = supabase.storage
    .from('chat-images')
    .getPublicUrl(filePath);
  return data.publicUrl;
}

// Upload an image to the chat-images bucket (for user uploads)
async function uploadImageToStorage(file) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const fileExt = file.name.split('.').pop();
  const fileName = `${user.id}/${Date.now()}.${fileExt}`;

  const { data, error } = await supabase.storage
    .from('chat-images')
    .upload(fileName, file, {
      contentType: file.type,
      upsert: false,
    });

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from('chat-images')
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}
```

---

## 9. Transcribe Audio via App Edge Function

The `transcribe-audio` edge function accepts base64-encoded audio and returns transcribed text.

```javascript
// Transcribe audio using the same edge function as the mobile app
async function transcribeAudio(audioBase64) {
  const { data: { session } } = await supabase.auth.getSession();

  // Call the transcribe-audio edge function directly
  const { data, error } = await supabase.functions.invoke('transcribe-audio', {
    body: {
      audio: audioBase64,        // base64 encoded audio (m4a, wav, webm)
      detectLanguage: true,      // auto-detect spoken language
    },
  });

  if (error) {
    // Get detailed error message
    let errorMessage = error.message;
    if (error.context) {
      try {
        const text = await error.context.text();
        errorMessage = text || errorMessage;
      } catch {}
    }
    throw new Error(`Transcription error: ${errorMessage}`);
  }

  return {
    text: data.text,              // Transcribed text
    language: data.detectedLanguage, // e.g. "Haitian Creole", "French", "English"
    confidence: data.confidence,  // 0.0 to 1.0
  };
}

// Record audio from browser microphone and transcribe
async function recordAndTranscribe(onTranscribed) {
  // Request microphone permission
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  const mediaRecorder = new MediaRecorder(stream, {
    mimeType: 'audio/webm;codecs=opus',
  });

  const chunks = [];

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  mediaRecorder.onstop = async () => {
    stream.getTracks().forEach(track => track.stop());

    // Convert to base64
    const blob = new Blob(chunks, { type: 'audio/webm' });
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    bytes.forEach(b => binary += String.fromCharCode(b));
    const base64Audio = btoa(binary);

    try {
      const result = await transcribeAudio(base64Audio);
      onTranscribed(result.text, result.language);
    } catch (err) {
      console.error('Transcription failed:', err);
    }
  };

  // Start recording
  mediaRecorder.start();

  // Return stop function
  return () => mediaRecorder.stop();
}

// Usage example:
// let stopRecording;
// document.getElementById('recordBtn').onclick = async () => {
//   stopRecording = await recordAndTranscribe((text, lang) => {
//     console.log(`Transcribed (${lang}): ${text}`);
//     document.getElementById('input').value = text;
//   });
// };
// document.getElementById('stopBtn').onclick = () => stopRecording();
```

---

## 10. Generate TTS (Text-to-Speech) Audio

The `generate-tts` edge function converts text to audio using ElevenLabs voices — the same function the app uses for "Read Aloud".

```javascript
// Generate TTS audio using the same edge function as the mobile app
async function generateTTS(text, voiceId = 'pNInz6obpgDQGcFmaJgB') {
  const { data, error } = await supabase.functions.invoke('generate-tts', {
    body: {
      text: text.slice(0, 2000),  // max 2000 chars
      voice: voiceId,             // ElevenLabs voice ID
      speed: 1.0,                 // 0.5 to 2.0
    },
  });

  if (error) {
    let errorMessage = error.message;
    if (error.context) {
      try { errorMessage = await error.context.text(); } catch {}
    }
    throw new Error(`TTS error: ${errorMessage}`);
  }

  // data.audioUrl is a public URL to the audio file
  // data.fallback === true means use browser speech synthesis instead
  return data;
}

// Play TTS in browser
async function speakText(text, voiceId = 'pNInz6obpgDQGcFmaJgB') {
  try {
    const result = await generateTTS(text, voiceId);

    if (result.fallback === true) {
      // Use browser's built-in speech synthesis as fallback
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = result.lang || 'en-US';
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
      return null;
    }

    if (result.audioUrl) {
      const audio = new Audio(result.audioUrl);
      audio.play();
      return audio; // Return audio element so caller can pause/stop
    }
  } catch (err) {
    // Fallback to browser speech
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
  }
  return null;
}

// Available voices (same as mobile app voice-select page)
const DAWINIX_VOICES = [
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', gender: 'male' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', gender: 'female' },
  { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', gender: 'male' },
  { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli', gender: 'female' },
  { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', gender: 'male' },
  { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold', gender: 'male' },
  { id: 'pqHfZKP75CvOlQylNhV4', name: 'Bill', gender: 'male' },
  // Alloy / Coral / Echo / Fable / Nova / Onyx / Shimmer (OpenAI voices)
  { id: 'alloy', name: 'Alloy', gender: 'neutral' },
  { id: 'coral', name: 'Coral', gender: 'female' },
  { id: 'echo', name: 'Echo', gender: 'male' },
  { id: 'nova', name: 'Nova', gender: 'female' },
  { id: 'onyx', name: 'Onyx', gender: 'male' },
  { id: 'shimmer', name: 'Shimmer', gender: 'female' },
];

// Usage:
// const audio = await speakText("Bonjou! Kijan ou ye?", 'EXAVITQu4vr4xnSDxMaL');
// audio?.pause(); // to stop playback
```

---

## 11. Use `/_shared/ai-providers.ts` in Your Web Backend

If you are building a **Node.js or Deno backend** for your web app, you can import the same AI provider logic from the shared file. This gives you access to all 7+ AI providers (OnSpace AI, OpenAI, Claude, Gemini, Groq, DALL-E, Stability AI, etc.).

### Available exports from `_shared/ai-providers.ts`

```typescript
// The following functions are exported from supabase/functions/_shared/ai-providers.ts

import {
  callAI,              // Main router — auto-selects provider with fallback
  callOnSpaceAI,       // Primary: Gemini 3 Flash, 2.5 Flash via OnSpace
  callOpenAI,          // GPT-4o via OpenAI API
  callGemini,          // Google Gemini via direct API
  callClaude,          // Claude 3.5 Sonnet via Anthropic
  callGroq,            // Llama 3.3 70B via Groq (fastest fallback)
  generateImageSmart,  // Smart image generation router (7 providers)
  generateImageWithDalle,       // DALL-E 3
  generateImageWithGeminiOnSpace, // Gemini image via OnSpace AI
  generateImageWithElevenLabs,  // ElevenLabs images
  generateImageWithMidjourney,  // Midjourney
  generateImageWithStabilityAI, // Stability AI SDXL
  searchImages,        // Unsplash image search
  detectContentType,   // Detect if message is image/text/search/file task
  isTextOnlyModel,     // Check if model cannot generate images
} from './supabase/functions/_shared/ai-providers.ts';
```

### Use in a Deno Edge Function (for a web API backend)

```typescript
// Your web backend edge function — supabase/functions/web-chat/index.ts
import { corsHeaders } from '../_shared/cors.ts';
import { callAI, generateImageSmart, detectContentType } from '../_shared/ai-providers.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const { message, conversationHistory, model = 'onspace-ai' } = await req.json();

  // Detect if this is a text or image request
  const detection = detectContentType(message);

  if (detection.isImageTask) {
    // Generate image using smart router (tries all 7 providers)
    const result = await generateImageSmart(message, model);
    return new Response(
      JSON.stringify({ type: 'image', imageUrl: result.imageUrl, model: result.model }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Build messages array for AI
  const messages = [
    ...conversationHistory,
    { role: 'user', content: message },
  ];

  // Call AI with automatic provider fallback
  const response = await callAI(model, messages, false);

  return new Response(
    JSON.stringify({ type: 'text', content: response.content, model: response.model }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
```

### Provider fallback order (built into `callAI`)

```
1. OnSpace AI     → Gemini 3 Flash Preview, Gemini 2.5 Flash, Gemini 2.5 Flash Lite
2. OpenAI GPT-4o  → Requires OPENAI_API_KEY secret
3. Google Gemini  → Requires GOOGLE_AI_API_KEY secret
4. Claude 3.5     → Requires ANTHROPIC_API_KEY secret (already configured ✓)
5. Groq Llama     → Requires GROQ_API_KEY secret (already configured ✓)
6. Hard fallback  → Returns a friendly offline message (never crashes)
```

### Image generation fallback order (built into `generateImageSmart`)

```
1. Gemini OnSpace   → Gemini 3.1 Flash Image Preview
2. DALL-E 3         → Requires OPENAI_API_KEY
3. ElevenLabs       → Requires ELEVENLABS_API_KEY (already configured ✓)
4. Midjourney       → Requires MIDJOURNEY_API_KEY (already configured ✓)
5. Stability AI     → Requires STABILITY_AI_API_KEY (already configured ✓)
6. Gemini Native    → Requires GOOGLE_AI_API_KEY
7. OnSpace AI       → Gemini chat-based fallback
```

---

## 12. Real-Time Updates — Polling Pattern

**Important:** The Dawinix backend does NOT support Supabase Realtime subscriptions. Use polling instead — the same pattern as the mobile app.

```javascript
// Poll for new messages every 3 seconds (same as mobile app)
function startMessagePolling(conversationId, onNewMessages, intervalMs = 3000) {
  let lastMessageId = null;
  let isPolling = false;

  const poll = async () => {
    if (isPolling) return;
    isPolling = true;

    try {
      const messages = await fetchMessages(conversationId);
      const newestId = messages[messages.length - 1]?.id;

      if (lastMessageId && newestId !== lastMessageId) {
        // There are new messages
        onNewMessages(messages);
      }
      lastMessageId = newestId;
    } catch (err) {
      console.warn('Polling error:', err.message);
    } finally {
      isPolling = false;
    }
  };

  poll(); // Run immediately
  const intervalId = setInterval(poll, intervalMs);

  // Return cleanup function
  return () => clearInterval(intervalId);
}

// Poll for new conversations (for side menu updates)
function startConversationPolling(onUpdate, intervalMs = 10000) {
  const poll = async () => {
    const conversations = await fetchConversations();
    onUpdate(conversations);
  };

  poll();
  const intervalId = setInterval(poll, intervalMs);
  return () => clearInterval(intervalId);
}

// Usage:
// const stopPolling = startMessagePolling(conversationId, (messages) => {
//   renderMessages(messages);
// });
// 
// // When user leaves the page:
// stopPolling();
```

---

## 13. Full React Web Example

Here is a complete minimal React chat component that uses all the above features.

```jsx
// ChatApp.jsx — Full web chat connected to Dawinix Supabase
import { useState, useEffect, useRef } from 'react';
import { supabase } from './lib/supabase';

export default function ChatApp() {
  const [user, setUser] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const messagesEndRef = useRef(null);

  // ── Auth ──────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setUser(session?.user ?? null)
    );
    return () => subscription.unsubscribe();
  }, []);

  // ── Load conversations when user is set ───────────────────────────
  useEffect(() => {
    if (!user) return;
    fetchConversations().then(setConversations);
  }, [user]);

  // ── Load messages when conversation changes ───────────────────────
  useEffect(() => {
    if (!activeConvId) return;
    fetchMessages(activeConvId).then(setMessages);
  }, [activeConvId]);

  // ── Auto scroll to bottom ─────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // ── Create new conversation ───────────────────────────────────────
  async function handleNewChat() {
    const conv = await createConversation('New Chat');
    if (conv) {
      setConversations(prev => [conv, ...prev]);
      setActiveConvId(conv.id);
      setMessages([]);
    }
  }

  // ── Send message ──────────────────────────────────────────────────
  async function handleSend() {
    if (!input.trim() || isStreaming || !user) return;

    let convId = activeConvId;
    if (!convId) {
      const conv = await createConversation(input.slice(0, 40));
      if (!conv) return;
      setConversations(prev => [conv, ...prev]);
      setActiveConvId(conv.id);
      convId = conv.id;
    }

    const userText = input.trim();
    setInput('');

    // Add user message to UI immediately
    const tempUserMsg = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: userText,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMsg]);

    // Save user message to DB
    const { data: savedMsg } = await saveUserMessage(convId, userText);
    if (savedMsg) {
      setMessages(prev => prev.map(m => m.id === tempUserMsg.id ? savedMsg : m));
    }

    // Stream AI response
    setIsStreaming(true);
    setStreamingContent('');

    try {
      const history = await fetchMessages(convId);
      const { data: { session } } = await supabase.auth.getSession();
      const SUPABASE_URL = 'https://njpuoozygqtpvlzhnjpu.backend.onspace.ai';

      const response = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          conversationId: convId,
          messages: history.map(m => ({ role: m.role, content: m.content })),
          aiModel: 'onspace-ai',
        }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            const token = parsed.choices?.[0]?.delta?.content || parsed.content || '';
            if (token) {
              fullContent += token;
              setStreamingContent(fullContent);
            }
          } catch {
            if (data && data !== '[DONE]') {
              fullContent += data;
              setStreamingContent(fullContent);
            }
          }
        }
      }

      // Save AI message and add to messages list
      if (fullContent) {
        const { data: aiMsg } = await saveAssistantMessage(convId, fullContent);
        setMessages(prev => [...prev, aiMsg || {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: fullContent,
          created_at: new Date().toISOString(),
        }]);
      }
    } catch (err) {
      console.error('Stream error:', err);
    } finally {
      setIsStreaming(false);
      setStreamingContent('');
    }
  }

  // ── Guest mode ────────────────────────────────────────────────────
  async function handleGuestLogin() {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (!error) setUser(data.user);
  }

  // ── Render ────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 40 }}>
        <h1>Dawinix Web</h1>
        <button onClick={() => supabase.auth.signInWithOAuth({ provider: 'google' })}>
          Login with Google
        </button>
        <button onClick={handleGuestLogin} style={{ marginTop: 10 }}>
          Continue as Guest
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Sidebar — conversation list (same as app side menu) */}
      <div style={{ width: 260, borderRight: '1px solid #eee', overflowY: 'auto', padding: 12 }}>
        <button onClick={handleNewChat} style={{ width: '100%', marginBottom: 12 }}>
          + New Chat
        </button>
        {conversations.map(conv => (
          <div
            key={conv.id}
            onClick={() => setActiveConvId(conv.id)}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              cursor: 'pointer',
              backgroundColor: conv.id === activeConvId ? '#f0f0f0' : 'transparent',
              marginBottom: 4,
              fontSize: 14,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {conv.title || 'Untitled'}
          </div>
        ))}
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {messages.map(msg => (
            <div
              key={msg.id}
              style={{
                marginBottom: 16,
                textAlign: msg.role === 'user' ? 'right' : 'left',
              }}
            >
              <div
                style={{
                  display: 'inline-block',
                  maxWidth: '70%',
                  padding: '10px 14px',
                  borderRadius: 16,
                  backgroundColor: msg.role === 'user' ? '#007AFF' : '#f0f0f0',
                  color: msg.role === 'user' ? '#fff' : '#000',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {msg.content}
                {msg.image_url && (
                  <img
                    src={msg.image_url}
                    alt="AI generated"
                    style={{ maxWidth: '100%', borderRadius: 8, marginTop: 8 }}
                  />
                )}
              </div>
            </div>
          ))}

          {/* Streaming indicator */}
          {isStreaming && (
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  display: 'inline-block',
                  maxWidth: '70%',
                  padding: '10px 14px',
                  borderRadius: 16,
                  backgroundColor: '#f0f0f0',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {streamingContent || '●●●'}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        <div style={{ padding: 16, borderTop: '1px solid #eee', display: 'flex', gap: 8 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Ask anything..."
            style={{ flex: 1, padding: '10px 14px', borderRadius: 24, border: '1px solid #ddd', fontSize: 15 }}
          />
          <button
            onClick={handleSend}
            disabled={isStreaming || !input.trim()}
            style={{
              padding: '10px 20px',
              borderRadius: 24,
              backgroundColor: '#10A37F',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## 🔑 Key Points Summary

| Feature | Table / Function | Notes |
|---|---|---|
| Auth (login/signup) | `supabase.auth` | Same credentials as mobile app |
| User profiles | `user_profiles` | All app users visible on web |
| Conversations (side menu) | `conversations` | Filter by `user_id`, order by `updated_at` |
| Messages | `messages` | Join via `conversation_id` |
| AI chat | Edge: `chat` | SSE streaming, same model options |
| AI images (gallery) | `media_files` + `chat-images` bucket | Images auto-saved after generation |
| Transcription | Edge: `transcribe-audio` | Send base64 audio, get text back |
| Text-to-Speech | Edge: `generate-tts` | Returns audioUrl or fallback flag |
| Real-time | Polling (3-10 sec interval) | Realtime not supported on this backend |
| Guest mode | `supabase.auth.signInAnonymously()` | `user.is_anonymous === true` |
| AI providers | `_shared/ai-providers.ts` | Import in Deno edge functions only |

---

## 📝 Tell OnSpace AI to Build the Web Version

When you create a new OnSpace **WEBSITE** project, you can say:

> "Build me a web chatbot connected to my existing Supabase backend at `https://njpuoozygqtpvlzhnjpu.backend.onspace.ai`. Use the same `conversations` and `messages` tables. Implement auth with `@supabase/supabase-js`, load chat history from the `conversations` table ordered by `updated_at`, display messages from the `messages` table, and send messages by calling the `chat` edge function with SSE streaming. The user's `access_token` from the Supabase session must be included as the `Authorization: Bearer` header on every edge function call."

That single instruction gives OnSpace AI enough context to scaffold the complete web app.

---

*Generated for Dawinix HT — Web Integration Guide*
*Backend: OnSpace Cloud (Supabase-compatible) — `njpuoozygqtpvlzhnjpu.backend.onspace.ai`*
