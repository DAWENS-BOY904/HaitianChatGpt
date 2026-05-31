# How to Build a Web Chatbot Using the Same Supabase Backend as This App

This guide explains how to create a web version of Dawinix that shares the same Supabase backend — same users, same conversations, same messages — using OnSpace to generate it automatically.

---

## 1. What the Mobile App Uses (Backend Architecture)

| Feature | Supabase Resource |
|---|---|
| Authentication | `supabase.auth` (email OTP + Google OAuth) |
| Chat messages | `messages` table |
| Conversations | `conversations` table |
| User profiles | `user_profiles` table |
| User settings | `user_settings` table |
| AI responses | Edge Function: `chat` |
| File/image storage | `chat-images`, `media-files` buckets |
| Push tokens | `user_profiles.push_token` |

---

## 2. OnSpace Prompt to Generate the Web Version

Copy and paste this prompt when creating a new **WEBSITE** project on OnSpace:

```
Build a full-featured AI web chatbot (React, similar to ChatGPT) that connects to my existing Supabase backend.

Backend URL: https://njpuoozygqtpvlzhnjpu.backend.onspace.ai
Anon Key: [paste your EXPO_PUBLIC_SUPABASE_ANON_KEY here]

AUTHENTICATION:
- Use Supabase email OTP login (same as mobile app)
- Support Google OAuth sign-in
- Persist sessions via supabase.auth

CONVERSATIONS:
- Fetch from `conversations` table: id, title, user_id, created_at, updated_at
- RLS: users see only their own conversations (user_id = auth.uid())
- Show list in left sidebar sorted by updated_at DESC
- Allow create, rename, archive, delete

MESSAGES:
- Fetch from `messages` table: id, conversation_id, role, content, image_url, created_at
- RLS: users see only messages in their own conversations
- Render markdown (bold, italic, code blocks, tables, lists, dividers)
- Show user messages on the right (dark bubble), AI messages on the left (no bubble)

AI CHAT:
- Call Edge Function: POST /functions/v1/chat
- Headers: Authorization: Bearer [user JWT], Content-Type: application/json
- Body: { messages: [...], conversationId: "uuid", aiModel: "onspace-ai" }
- Handle streaming SSE response (text/event-stream)
- Show typing indicator while streaming

UI REQUIREMENTS:
- Left sidebar: conversation list + New Chat button + Settings link
- Main area: message list + input bar at bottom
- Input bar: text input, send button, file upload button, voice icon
- Fully responsive (mobile + desktop)
- Dark/light mode toggle
- Code blocks with syntax highlighting and copy button
- Support multiple code blocks in one message with descriptions between them

USER SETTINGS:
- Fetch/update `user_settings` table
- Show: language, appearance, accent color, custom instructions

FILE UPLOAD:
- Upload images to `chat-images` Supabase Storage bucket
- Path pattern: {user_id}/{timestamp}.jpg
- Get public URL and pass as userImageUrl in chat body

PROFILE:
- Read/update `user_profiles` table: username, email, profile_photo_url
- Show user avatar in top-right corner
```

---

## 3. Supabase Tables the Web App Needs Access To

### `conversations`
```sql
-- Already exists in your backend
-- RLS: SELECT/INSERT/UPDATE/DELETE WHERE user_id = auth.uid()
```

### `messages`
```sql
-- Already exists
-- RLS: SELECT/INSERT via conversation ownership
```

### `user_profiles`
```sql
-- Already exists
-- RLS: SELECT/UPDATE WHERE id = auth.uid()
```

### `user_settings`
```sql
-- Already exists
-- RLS: SELECT/INSERT/UPDATE WHERE user_id = auth.uid()
```

---

## 4. Edge Function: `chat`

The web app calls the same Edge Function as the mobile app:

```javascript
// Web client call (JavaScript)
const response = await fetch(
  'https://njpuoozygqtpvlzhnjpu.backend.onspace.ai/functions/v1/chat',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [
        { role: 'user', content: 'Hello!' }
      ],
      conversationId: 'your-uuid-here',
      aiModel: 'onspace-ai',
    }),
  }
);

// Handle streaming SSE
const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const chunk = decoder.decode(value);
  const lines = chunk.split('\n');
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6);
      if (data === '[DONE]') break;
      try {
        const parsed = JSON.parse(data);
        const text = parsed.choices?.[0]?.delta?.content || parsed.content || '';
        // Append text to message UI
      } catch {}
    }
  }
}
```

---

## 5. Authentication Flow (Web)

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://njpuoozygqtpvlzhnjpu.backend.onspace.ai',
  'YOUR_ANON_KEY'
);

// Send OTP
await supabase.auth.signInWithOtp({ email: 'user@example.com' });

// Verify OTP
await supabase.auth.verifyOtp({
  email: 'user@example.com',
  token: '123456',
  type: 'email',
});

// Google OAuth
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo: 'https://your-web-app.com/auth/callback' },
});

// Get current session
const { data: { session } } = await supabase.auth.getSession();
```

---

## 6. Rendering AI Messages with Markdown

The AI returns messages with markdown formatting. On the web, use a library:

```bash
npm install react-markdown remark-gfm
```

```jsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function AIMessage({ content }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ node, inline, className, children }) {
          const lang = /language-(\w+)/.exec(className || '')?.[1] || '';
          return inline
            ? <code style={{ background: '#1e1e2e', padding: '2px 6px', borderRadius: 4 }}>{children}</code>
            : <CodeBlock language={lang} code={String(children)} />;
        },
        table: ({ children }) => (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>{children}</table>
          </div>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
```

---

## 7. Special Message Formats to Handle

The AI returns special tags that the mobile app parses. Your web app should handle:

| Tag | Action |
|---|---|
| `[SOURCES][...][/SOURCES]` | Parse JSON array, show source links below message |
| `[IMAGE_SEARCH_RESULTS:{...}]` | Render image grid |
| `[TIKTOK_CARD]{...}[/TIKTOK_CARD]` | Render TikTok preview card |
| `[PROMPT_CARD]{...}[/PROMPT_CARD]` | Show copyable prompt card |
| `[DOWNLOAD_CARD]...[/DOWNLOAD_CARD]` | Show file download button |

---

## 8. Steps to Deploy on OnSpace

1. Go to **OnSpace** dashboard → click **WEBSITE** tab
2. Select **React** stack
3. Create a new project (e.g. "Dawinix Web")
4. Paste the prompt from Section 2 into the AI chat
5. The AI will build the full web app connected to your existing backend
6. Click **Publish** to deploy

Your web and mobile apps will share the same users, same conversations, and same AI — users can switch between both seamlessly.

---

## 9. Key Differences: Web vs Mobile

| Feature | Mobile (React Native) | Web (React) |
|---|---|---|
| Push notifications | expo-notifications | Web Push API |
| File picker | expo-document-picker | `<input type="file">` |
| Camera | expo-camera | MediaDevices API |
| Voice recording | expo-av | MediaRecorder API |
| Storage | AsyncStorage | localStorage / IndexedDB |
| Navigation | expo-router | react-router-dom |
| Safe area | react-native-safe-area-context | CSS padding/env() |
| Styling | StyleSheet | CSS / Tailwind |

---

*This guide was generated for the Dawinix app. Backend URL: `https://njpuoozygqtpvlzhnjpu.backend.onspace.ai`*
