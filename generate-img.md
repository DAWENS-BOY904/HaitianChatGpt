# Image Generation & Search Guide

## Overview

Two image systems run in this app:

| System | Tag | Trigger | Provider |
|---|---|---|---|
| **Inline Image Search** | `[IMAGE_SEARCH:query]` | AI embeds in any response | Pexels → Unsplash → Google CSE |
| **Contextual Photo** | `[CONTEXT_PHOTO:{...}]` | Auto-enrichment for visual topics | Pexels → Unsplash |
| **AI Image Generation** | Detected by `detectContentType()` | "Create a logo / generate image" | OnSpace AI → DALL-E 3 → ElevenLabs → Stability AI |

---

## 1. Inline Image Search (`[IMAGE_SEARCH:query]`)

### How it works
The AI emits `[IMAGE_SEARCH:query]` tags directly inside its text response. `MessageItem.tsx` detects all such tags, strips them from the rendered text, and renders an `InlineImageCard` component **below the relevant paragraph**.

### Client flow
```
AI text: "The lion is Africa's apex predator. [IMAGE_SEARCH:lion wildlife photo]"
         ↓ MessageItem parses tag
         ↓ Calls supabase.functions.invoke('image-search', { query, limit: 6 })
         ↓ Edge function: searchImages() → Pexels → Unsplash → Google CSE
         ↓ Renders horizontal scrollable photo cards inline
```

### Edge function: `image-search`
- **File**: `supabase/functions/image-search/index.ts`
- **Input**: `{ query: string, limit?: number }`
- **Output**: `{ images: Array<{ url, title, source, resolution }> }`
- **Auth**: Anon key (public, read-only)

### AI system prompt rule
```
When describing something visual (animal, place, food, person, product):
embed [IMAGE_SEARCH:descriptive query] inline — max 3 per response.
Example: "The Eiffel Tower [IMAGE_SEARCH:Eiffel Tower Paris France] stands 330 metres tall."
```

---

## 2. AI Image Generation

### Trigger keywords (subset)
```
"create a logo", "generate image", "draw me a", "fè yon imaj",
"créer une image", "hacer un logo", "kreye logo"
```

Detected by `detectContentType()` in `ai-providers.ts`.

### Provider chain
```
1. OnSpace AI DALL-E endpoint  → /images/generations (dall-e-3, dall-e-2)
2. Gemini OnSpace              → gemini-3.1-flash-image-preview
3. DALL-E 3 (direct OpenAI)   → api.openai.com/v1/images/generations
4. ElevenLabs                  → api.elevenlabs.io/v1/text-to-image
5. Midjourney                  → api.useapi.net/v2/jobs/imagine
6. Stability AI SDXL           → api.stability.ai/v1/generation/...
7. Gemini Native               → generativelanguage.googleapis.com
```

### Response format
```
imageUrl → uploaded to `chat-images` storage bucket
cleanMessage: "Here is your generated image!\n\nLet me know if you would like adjustments..."
```

---

## 3. Image Search Providers

### Priority order
```
Pexels API          (PEXELS_API_KEY)          — Best quality, 15 results/call
  ↓ fallback
Unsplash API        (UNSPLASH_ACCESS_KEY)     — High quality, 30 results/call
  ↓ fallback
Google Custom Search (GOOGLE_CUSTOM_SEARCH_API_KEY + GOOGLE_CUSTOM_SEARCH_CX)
```

### Required secrets (already configured)
- `PEXELS_API_KEY`
- `UNSPLASH_ACCESS_KEY`
- `GOOGLE_CUSTOM_SEARCH_API_KEY`
- `GOOGLE_CUSTOM_SEARCH_CX`

---

## 4. Rendered Components

### `InlineImageCard` (MessageItem.tsx)
- Triggered by `[IMAGE_SEARCH:query]` tags
- Shows loading spinner while fetching
- Renders horizontal scrollable cards (146×108 for multiple, 280×182 for single)
- Tappable → full-screen image viewer

### `ImageGrid` (MessageItem.tsx)
- Triggered by `[IMAGE_SEARCH_RESULTS:...]` tag (full search response)
- Shows up to 8 images in horizontal scroll

### Contextual photo (`[CONTEXT_PHOTO:{url,title,query}]`)
- Auto-appended by chat edge function for visual topics
- Renders full-width photo with caption below AI text

---

## 5. Never say "I cannot show images"

The system prompt enforces:
```
- You CAN and DO show images. The system automatically fetches and displays them.
- NEVER say "I am not capable of providing image links" or "I cannot display images".
- When user asks to see, show, find, or reference an image: respond with [IMAGE_SEARCH:query] inline.
```
