# How to Create a Web Chatbot Connected to This App's Supabase

This guide explains how to build a web version (website chatbot) that shares the same Supabase backend, authentication, and conversation data as this Dawinix mobile app.

---

## 1. What You Need

- Access to your OnSpace Cloud (Supabase-compatible) project
- Your Backend URL: `https://njpuoozygqtpvlzhnjpu.backend.onspace.ai`
- Your Anon Key (visible in `.env` as `EXPO_PUBLIC_SUPABASE_ANON_KEY`)

---

## 2. Tell OnSpace AI to Create the Web Version

Go to **OnSpace → WEBSITE tab → Create a new React web project**, then paste this prompt:

```
Create a web chatbot app that connects to my existing Supabase backend.

Backend URL: https://njpuoozygqtpvlzhnjpu.backend.onspace.ai
Anon Key: [paste your EXPO_PUBLIC_SUPABASE_ANON_KEY here]

Requirements:
1. Login page using Supabase email+OTP authentication (same as the mobile app)
2. After login, fetch all conversations from the `conversations` table for the logged-in user
3. Show conversation list in a sidebar (same as the mobile app's chat history)
4. When a conversation is selected, load messages from the `messages` table filtered by conversation_id
5. Send new messages by calling the Edge Function: POST /functions/v1/chat
   - Body: { messages, conversationId, aiModel: "onspace-ai" }
   - Header: Authorization: Bearer [user_jwt_token]
6. Stream the AI response (the Edge Function returns Server-Sent Events)
7. Display messages with proper markdown formatting and code blocks
8. Match the dark theme design of the Dawinix mobile app
9. Show user profile from `user_profiles` table
10. Settings page to update `user_settings` table

Database tables to use:
- user_profiles (id, username, email, role, subscription_tier)
- user_settings (user_id, app_language, appearance, custom_instructions)
- conversations (id, user_id, title, created_at, updated_at, is_archived, is_pinned)
- messages (id, conversation_id, role, content, image_url, created_at)
```

---

## 3. Database Tables Summary

| Table | Purpose |
|---|---|
| `user_profiles` | User account info (name, email, role, subscription) |
| `user_settings` | App preferences (language, theme, AI tone) |
| `conversations` | Chat sessions (one per topic) |
| `messages` | Individual chat messages (role: user/assistant) |
| `media_files` | AI-generated images and uploaded files |

---

## 4. Edge Functions Available

| Function | Method | Purpose |
|---|---|---|
| `/functions/v1/chat` | POST | Main AI chat (streaming SSE) |
| `/functions/v1/generate-tts` | POST | Text-to-speech |
| `/functions/v1/transcribe-audio` | POST | Voice-to-text |
| `/functions/v1/generate-quiz` | POST | AI quiz generator |
| `/functions/v1/fetch-link-preview` | POST | URL link preview |
| `/functions/v1/check-subscription` | POST | Check user subscription status |

---

## 5. Authentication Flow for Web

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://njpuoozygqtpvlzhnjpu.backend.onspace.ai',
  'YOUR_ANON_KEY'
);

// Send OTP
await supabase.auth.signInWithOtp({ email: 'user@example.com' });

// Verify OTP
const { data, error } = await supabase.auth.verifyOtp({
  email: 'user@example.com',
  token: '123456',
  type: 'email'
});
```

---

## 6. Fetch Conversations

```javascript
const { data: conversations } = await supabase
  .from('conversations')
  .select('*')
  .eq('user_id', user.id)
  .order('updated_at', { ascending: false });
```

---

## 7. Load Messages for a Conversation

```javascript
const { data: messages } = await supabase
  .from('messages')
  .select('*')
  .eq('conversation_id', conversationId)
  .order('created_at', { ascending: true });
```

---

## 8. Send a Chat Message (Streaming)

```javascript
const response = await fetch(
  'https://njpuoozygqtpvlzhnjpu.backend.onspace.ai/functions/v1/chat',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      messages: [...previousMessages, { role: 'user', content: userMessage }],
      conversationId: activeConversationId,
      aiModel: 'onspace-ai',
    }),
  }
);

// Read the streaming response
const reader = response.body.getReader();
const decoder = new TextDecoder();
let fullText = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const chunk = decoder.decode(value);
  // Parse SSE lines
  const lines = chunk.split('\n');
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6);
      if (data === '[DONE]') break;
      try {
        const parsed = JSON.parse(data);
        const token = parsed.choices?.[0]?.delta?.content || parsed.content || '';
        fullText += token;
        // Update UI with fullText
      } catch {}
    }
  }
}
```

---

## 9. Save Messages to Database

After streaming completes, save both the user message and AI response:

```javascript
// Save user message
await supabase.from('messages').insert({
  conversation_id: conversationId,
  role: 'user',
  content: userMessage,
});

// Save AI response
await supabase.from('messages').insert({
  conversation_id: conversationId,
  role: 'assistant',
  content: fullText,
});

// Update conversation timestamp
await supabase
  .from('conversations')
  .update({ updated_at: new Date().toISOString() })
  .eq('id', conversationId);
```

---

## 10. Row Level Security (RLS)

All tables use RLS. The user's JWT token must be sent with every request. The existing policies already allow:
- Users to read/write their own conversations and messages
- The chat Edge Function to update conversations

No additional RLS setup needed — the mobile app's existing policies work for the web too.

---

## Summary

The web version shares **100% of the same database, auth, and AI backend** as the mobile app. Users who log in on web will see the same conversations they had on mobile, because everything is stored in the shared Supabase backend.
