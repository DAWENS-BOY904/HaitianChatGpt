# Integration Guide: Image Search, Email Composer & Quiz

This guide explains how to use and extend the three major AI-powered features in Dawinix — **Image Search**, **Email Composer**, and **Quiz** — including how to fetch data and render results from the mobile app to any web context.

---

## 1. Image Search (Unsplash API)

### How it works (App → Edge Function → Unsplash)

```
User types: "show me photos of Paris"
     ↓
home.tsx detects search intent (detectContentType → type: 'search')
     ↓
supabase/functions/chat/index.ts calls searchImages()
     ↓
_shared/ai-providers.ts → Unsplash API https://api.unsplash.com/search/photos
     ↓
Returns: [IMAGE_SEARCH_RESULTS:{...}:IMAGE_SEARCH_END]
     ↓
home.tsx parseImageSearchResults() renders horizontal scroll of photo cards
```

### Edge Function Call (Backend)

```typescript
// supabase/functions/_shared/ai-providers.ts
export async function searchImages(query: string, limit = 10) {
  const accessKey = Deno.env.get('UNSPLASH_ACCESS_KEY');
  const res = await fetch(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${limit}`,
    { headers: { 'Authorization': `Client-ID ${accessKey}` } }
  );
  const data = await res.json();
  return data.results.map(img => ({
    url: img.urls.regular,        // Display URL (800px wide)
    title: img.description,
    source: 'Unsplash',
    resolution: `${img.width}x${img.height}`,
  }));
}
```

### Client-Side Parsing (Mobile App)

```typescript
// app/home.tsx
const parseImageSearchResults = (content: string) => {
  const match = content.match(/\[IMAGE_SEARCH_RESULTS:([\s\S]*?):IMAGE_SEARCH_END\]/);
  if (!match) return { cleanContent: content, searchImages: null };
  const parsed = JSON.parse(match[1]);
  const cleanContent = content
    .replace(/\[IMAGE_SEARCH_RESULTS:[\s\S]*?:IMAGE_SEARCH_END\]/, '')
    .trim();
  return { cleanContent, searchImages: parsed };
};
```

### Rendering in chat (Mobile)

```tsx
{msgSearchImages.map((img, i) => (
  <TouchableOpacity key={i} onPress={() => Linking.openURL(img.url)}>
    <ExpoImage source={{ uri: img.url }} style={{ width: 160, height: 120 }} />
    <Text>{img.title}</Text>
  </TouchableOpacity>
))}
```

### Web Integration Example (React / HTML)

To fetch and display image search results from a web app calling the same edge function:

```typescript
// web/imageSearch.ts
async function searchImagesWeb(query: string): Promise<Array<{ url: string; title: string }>> {
  const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
  const ANON_KEY = 'YOUR_ANON_KEY';

  const response = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ANON_KEY}`,
      'apikey': ANON_KEY,
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: `show me photos of ${query}` }],
      conversationId: 'web-search-' + Date.now(),
      aiModel: 'google-gemini',
    }),
  });

  let fullText = '';
  const reader = response.body?.getReader();
  if (reader) {
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data:')) continue;
        try {
          const data = JSON.parse(line.slice(5));
          fullText += data.content || '';
        } catch {}
      }
    }
  }

  // Parse image results from response
  const match = fullText.match(/\[IMAGE_SEARCH_RESULTS:([\s\S]*?):IMAGE_SEARCH_END\]/);
  if (!match) return [];
  return JSON.parse(match[1]);
}

// Usage
const images = await searchImagesWeb('Paris');
images.forEach(img => {
  const el = document.createElement('img');
  el.src = img.url;
  el.alt = img.title;
  document.getElementById('gallery').appendChild(el);
});
```

### Trigger Keywords (Auto-detected)

The edge function auto-detects image search requests based on these patterns:
- English: `show me photos`, `find images`, `search for photos`
- Haitian Creole: `ban m foto`, `montre m foto`, `chache foto`
- French: `cherche des photos`, `montre moi des images`
- Spanish: `buscar fotos`, `mostrar imágenes`

---

## 2. Email Composer Modal

### Overview

`EmailComposerModal` renders a full email composer UI that:
- Pre-populates subject & body from AI-generated content (`PROMPT_CARD`)
- Supports `support`, `relations`, `custom`, and `ai_prompt` templates
- Opens automatically when AI returns a `[PROMPT_CARD]` block

### Component API

```typescript
// components/EmailComposerModal.tsx
interface EmailComposerModalProps {
  visible: boolean;
  onClose: () => void;
  template: 'support' | 'relations' | 'custom' | 'ai_prompt';
  aiContent?: {
    title?: string;
    subject?: string;
    body: string;
  };
}
```

### Using It in a Screen

```tsx
import { EmailComposerModal } from '../components/EmailComposerModal';

function MyScreen() {
  const [visible, setVisible] = useState(false);
  const [aiContent, setAiContent] = useState(null);

  // Auto-open when AI returns a PROMPT_CARD
  useEffect(() => {
    const lastAI = messages.find(m => m.role === 'assistant');
    const match = lastAI?.content.match(/\[PROMPT_CARD\]([\s\S]*?)\[\/PROMPT_CARD\]/);
    if (match) {
      const card = JSON.parse(match[1]);
      setAiContent({ title: card.title, subject: card.subject, body: card.body });
      setVisible(true);
    }
  }, [messages]);

  return (
    <EmailComposerModal
      visible={visible}
      onClose={() => setVisible(false)}
      template="ai_prompt"
      aiContent={aiContent}
    />
  );
}
```

### AI Trigger (Ask AI to write a message)

When users type:
- `"Write me a support email"`
- `"Compose a letter to my boss"`
- `"Write a professional apology"`

The AI returns a `[PROMPT_CARD]` block:
```
[PROMPT_CARD]{"title":"Support Request","subject":"Technical Issue","body":"Dear Support Team,..."}[/PROMPT_CARD]
```

The app auto-detects this and opens `EmailComposerModal` with pre-filled content.

### Web Integration (Mailto Link)

```typescript
// web/emailComposer.ts
function openEmailComposer(subject: string, body: string, to = '') {
  const params = new URLSearchParams({
    subject: subject,
    body: body,
    ...(to && { to }),
  });
  window.open(`mailto:?${params.toString()}`);
}

// With SendGrid / Resend API
async function sendEmail(to: string, subject: string, body: string) {
  const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
  const response = await fetch(`${SUPABASE_URL}/functions/v1/send-admin-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer YOUR_SERVICE_ROLE_KEY`,
    },
    body: JSON.stringify({
      recipientIds: ['USER_UUID'],
      subject,
      message: body,
    }),
  });
  return response.json();
}
```

---

## 3. Quiz Feature

### Overview

The quiz system generates 10 AI-powered questions on any topic, supports multiple difficulty levels, saves scores to the database, and renders inline within the chat.

### Edge Function: `generate-quiz`

```typescript
// supabase/functions/generate-quiz/index.ts
// POST body:
{
  topic: string;          // e.g. "JavaScript ES6"
  difficulty: string;     // "Easy" | "Medium" | "Hard" | "Expert"
  count: number;          // default 10
  seed: string;           // for unique generation per request
}

// Response:
{
  questions: Array<{
    question: string;
    options: string[];    // 4 options
    answer: number;       // index of correct answer (0-3)
    explanation: string;  // why it's correct
  }>
}
```

### Calling the Quiz Edge Function

```typescript
// In your component
const generateQuiz = async (topic: string, difficulty = 'Medium') => {
  const { data, error } = await supabase.functions.invoke('generate-quiz', {
    body: {
      topic,
      difficulty,
      count: 10,
      seed: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    },
  });

  if (error) throw error;
  return data.questions; // QuizQuestion[]
};
```

### QuizView Component Usage

```tsx
import { QuizView } from '../components/QuizModal';

<QuizView
  questions={questions}
  onClose={() => setVisible(false)}
  onViewResults={(answers, questions) => {
    const score = answers.filter(a => a.correct).length;
    console.log(`Score: ${score}/${questions.length}`);
    // Save to DB
    supabase.from('quiz_scores').insert({
      user_id: user.id,
      topic,
      difficulty,
      score,
      total: questions.length,
    });
  }}
  onTryAnother={() => generateNewQuiz()}
  onHarderQuiz={() => setDifficulty('Hard')}
  quizHistory={history}
/>
```

### Database Schema

```sql
-- quiz_scores table (already exists)
SELECT * FROM quiz_scores WHERE user_id = auth.uid()
ORDER BY created_at DESC LIMIT 20;

-- Columns:
-- id, user_id, topic, difficulty, score, total, created_at
```

### Auto-Trigger from Chat

When users type any of these phrases, the quiz engine auto-launches:
```
"make me a quiz about Python"
"give me a trivia on history"
"quiz sou matematik"          -- Haitian Creole
"créer un quiz sur la chimie" -- French
```

The flow:
1. `handleSend()` detects quiz keywords
2. Calls `generateAIQuizQuestions(topic, difficulty)`
3. Shows `QuizLoadingCard` animation
4. Renders `QuizView` inline in chat

### Web Integration (REST API)

```typescript
// web/quiz.ts
async function generateWebQuiz(topic: string) {
  const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
  const ANON_KEY = 'YOUR_ANON_KEY';

  const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-quiz`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ANON_KEY}`,
      'apikey': ANON_KEY,
    },
    body: JSON.stringify({ topic, difficulty: 'Medium', count: 10 }),
  });

  const { questions } = await response.json();

  // Render in HTML
  questions.forEach((q, i) => {
    const div = document.createElement('div');
    div.innerHTML = `
      <h3>${i + 1}. ${q.question}</h3>
      ${q.options.map((opt, idx) => `
        <label>
          <input type="radio" name="q${i}" value="${idx}"> ${opt}
        </label>
      `).join('')}
    `;
    document.getElementById('quiz').appendChild(div);
  });
}
```

---

## Environment Variables Required

| Variable | Service | Required |
|----------|---------|----------|
| `UNSPLASH_ACCESS_KEY` | Image Search | ✅ |
| `UNSPLASH_SECRET_KEY` | Image Search (upload) | Optional |
| `RESEND_API_KEY` | Email Sending | ✅ for email |
| `ONSPACE_AI_API_KEY` | Quiz Generation | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin operations | ✅ |

## Quick Reference

| Feature | Trigger | Component | Edge Function |
|---------|---------|-----------|--------------|
| Image Search | `show me photos of X` | `home.tsx` inline | `chat` → `searchImages()` |
| Email Composer | `write me an email` | `EmailComposerModal` | `send-admin-email` |
| Quiz | `make me a quiz` | `QuizView` | `generate-quiz` |
| Image Editing | Tap edit on AI image | `ImageEditModal` | `chat` (vision mode) |
