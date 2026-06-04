# Example Implementations

This document provides concrete examples of how to implement key features using the new systems.

---

## Example 1: Context-Aware Quiz Generation

### Before (Keyword-Based)

```typescript
// HaitianChatGpt/app/home.tsx
const QUIZ_KEYWORDS = ['quiz', 'quizz', 'make me a quiz', 'give me a quiz', ...];
const lowerTextForQuiz = currentText.toLowerCase();
const isQuizRequest = QUIZ_KEYWORDS.some(kw => lowerTextForQuiz.includes(kw));

if (isQuizRequest && !currentEditingId) {
  // Hardcoded quiz generation
  const detectedTopic = currentText.match(/(?:quiz|trivia)\s+(?:about|on|sur|sou|sobre)?\s*(.+)/i)?.[1] || 'General Knowledge';
  await generateQuizQuestions(detectedTopic);
}
```

### After (Context-Aware)

```typescript
// HaitianChatGpt/app/home.tsx
import { routeUserRequest, structuredResponseToMessage } from '../lib/ai/context_aware_ai_router';
import { withErrorHandling } from '../lib/errors/error_handling_system';

const handleSendMessage = async (userMessage: string) => {
  await withErrorHandling(
    async () => {
      const response = await routeUserRequest(
        userMessage,
        conversationHistory,
        callAI,
        {
          quiz: async (topic: string, difficulty: string) => {
            return await generateQuizQuestions(topic, difficulty);
          },
          imageGeneration: async (prompt: string) => {
            return await generateImageSmart(prompt);
          },
          videoGeneration: async (prompt: string, duration: number) => {
            return await generateVideoSmart(prompt, duration);
          },
        }
      );

      // The AI has already determined that this is a quiz request
      // and provided the topic and difficulty in the response
      const message = structuredResponseToMessage(response);
      
      // Add to conversation
      await addMessageToConversation(message);

      // If multimedia is included, it will be rendered automatically
      // If structured data is included (quiz), it will be rendered as a component
    },
    'send_message',
    {
      retry: { enabled: true, maxAttempts: 3, backoffMs: 1000 },
      userMessage: 'Failed to process your request. Please try again.',
      alertUser: true,
    }
  );
};
```

**Key Differences:**
- No keyword matching on the client
- AI determines intent and provides metadata
- Automatic retry on failure
- Structured response includes quiz data
- UI renders quiz component automatically

---

## Example 2: Intelligent Image Generation in Chat

### Before (Keyword-Based)

```typescript
// Dawinix/src/pages/ChatPage.tsx
function detectImageSearch(content: string): string | null {
  const tagMatch = content.match(/\[IMAGE_SEARCH:([^\]]{2,80})\]/i);
  if (tagMatch) return tagMatch[1].trim();

  const explicitPatterns: RegExp[] = [
    /(?:here are some |here's some |showing |displaying )?(?:photos?|pictures?|images?|pics?)\s+(?:of|about|showing|for)\s+([a-zA-Z][a-zA-Z\s]{2,50}?)(?:[.,!?]|\s*$)/i,
    // ... many more patterns
  ];
  
  for (const p of explicitPatterns) {
    const m = content.match(p);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

// In message rendering
const imageQuery = detectImageSearch(message.content);
if (imageQuery) {
  const images = await searchImages(imageQuery);
  return <ImageCarousel images={images} />;
}
```

### After (Context-Aware)

```typescript
// Dawinix/src/pages/ChatPage.tsx
import { buildStructuredResponse } from '@/lib/ai/context_aware_ai_router';

// When receiving AI response
const structuredResponse = await buildStructuredResponse(
  userMessage,
  aiResponse,
  conversationHistory,
  callAI,
  generateImageSmart,  // Will be called if AI determines images are needed
  generateVideoSmart,
  searchImages
);

// The response now includes:
// {
//   content: "Here are some beautiful sunset images...",
//   intent: "chat",
//   metadata: {
//     shouldGenerateImage: true,
//     imagePrompt: "beautiful sunset over mountains"
//   },
//   multimedia: {
//     images: [
//       { url: "...", caption: "...", alt: "..." },
//       { url: "...", caption: "...", alt: "..." }
//     ]
//   }
// }

// In MessageBubble component
export const MessageBubble = ({ message }: { message: Message }) => {
  return (
    <div>
      <MarkdownRenderer content={message.content} />
      
      {/* Images are automatically rendered if included */}
      {message.multimedia?.images && (
        <ImageCarousel images={message.multimedia.images} />
      )}
      
      {/* Videos are automatically rendered if included */}
      {message.multimedia?.videos && (
        <VideoPlayer videos={message.multimedia.videos} />
      )}
    </div>
  );
};
```

**Key Differences:**
- No regex parsing of AI responses
- AI decides when images are relevant
- Images are included in structured response
- UI renders images automatically
- Works for any type of image, not just searches

---

## Example 3: Proper Error Handling

### Before (Silent Errors)

```typescript
// HaitianChatGpt/app/home.tsx
try {
  await sendMessage(currentText);
} catch (_e) {}

try {
  const data = await supabase.from('conversations').select('*');
} catch (_e) {}

try {
  await AsyncStorage.setItem(key, value);
} catch (_e) {}
```

### After (Proper Error Handling)

```typescript
// HaitianChatGpt/app/home.tsx
import { withErrorHandling, errorLogger } from '../lib/errors/error_handling_system';

// For critical operations with retry
await withErrorHandling(
  () => sendMessage(currentText),
  'send_message',
  {
    retry: { enabled: true, maxAttempts: 3, backoffMs: 1000 },
    userMessage: 'Failed to send message. Retrying...',
    alertUser: true,
  },
  { conversationId: currentConversation?.id }
);

// For non-critical operations with fallback
const conversations = await withErrorHandling(
  () => supabase.from('conversations').select('*'),
  'load_conversations',
  {
    fallback: { enabled: true, value: [] },
    userMessage: 'Failed to load conversations',
  }
);

// For storage operations
const safeSaveToStorage = createSafeAsyncFunction(
  () => AsyncStorage.setItem(key, value),
  'save_to_storage',
  undefined,
  { key }
);

await safeSaveToStorage();
```

**Key Differences:**
- Errors are logged with context
- Automatic retry for transient failures
- Fallback values for non-critical operations
- User-friendly error messages
- Error tracking for debugging

---

## Example 4: Input Validation and Security

### Before (No Validation)

```typescript
// HaitianChatGpt/app/home.tsx
const handleSendMessage = (text: string) => {
  // No validation - text is sent directly to AI
  sendMessage(text);
};

// Admin API keys stored unencrypted
const saveAPIKey = async (apiKey: string) => {
  await supabase.from('api_keys').insert({
    key: apiKey,  // Stored in plain text!
  });
};
```

### After (Secure)

```typescript
// HaitianChatGpt/app/home.tsx
import { InputValidator } from '../lib/security/security_system';
import { DataEncryption } from '../lib/security/security_system';

const handleSendMessage = (text: string) => {
  // Validate input
  const sanitized = InputValidator.sanitizeString(text, 10000);
  
  if (sanitized.length === 0) {
    showAlert('Invalid Input', 'Message cannot be empty');
    return;
  }
  
  if (sanitized.length > 10000) {
    showAlert('Invalid Input', 'Message is too long');
    return;
  }

  // Send sanitized message
  sendMessage(sanitized);
};

// Admin API keys encrypted
const saveAPIKey = async (apiKey: string) => {
  // Validate API key format
  if (!InputValidator.validateAPIKey(apiKey)) {
    throw new Error('Invalid API key format');
  }

  // Encrypt before storing
  const encryption = new DataEncryption(process.env.ENCRYPTION_KEY);
  const encryptedKey = encryption.encrypt(apiKey);

  await supabase.from('api_keys').insert({
    key: encryptedKey,  // Stored encrypted
  });
};

// Retrieve and decrypt
const getAPIKey = async (keyId: string) => {
  const { data } = await supabase
    .from('api_keys')
    .select('key')
    .eq('id', keyId)
    .single();

  if (!data) return null;

  const encryption = new DataEncryption(process.env.ENCRYPTION_KEY);
  return encryption.decrypt(data.key);
};
```

**Key Differences:**
- All inputs are validated and sanitized
- Sensitive data is encrypted
- API key format is validated
- Clear error messages for invalid input
- Encryption key is from environment variables

---

## Example 5: Rate Limiting

### Before (No Rate Limiting)

```typescript
// HaitianChatGpt/app/home.tsx
const handleSendMessage = async (text: string) => {
  // No rate limiting - user can spam requests
  await sendMessage(text);
};
```

### After (Rate Limited)

```typescript
// HaitianChatGpt/app/home.tsx
import { InMemoryRateLimiter } from '../lib/security/security_system';

const rateLimiter = new InMemoryRateLimiter({
  maxRequests: 10,
  windowMs: 60000, // 1 minute
});

const handleSendMessage = async (text: string) => {
  const userId = user?.id || 'guest';
  
  // Check rate limit
  if (!rateLimiter.isAllowed(userId)) {
    const remaining = rateLimiter.getRemainingRequests(userId);
    const resetTime = rateLimiter.getResetTime(userId);
    const secondsUntilReset = Math.ceil((resetTime - Date.now()) / 1000);
    
    showAlert(
      'Rate Limited',
      `Too many requests. You have ${remaining} requests remaining. Try again in ${secondsUntilReset}s`
    );
    return;
  }

  await sendMessage(text);
};
```

**Server-Side Rate Limiting:**

```typescript
// HaitianChatGpt/supabase/functions/chat/index.ts
import { RedisRateLimiter } from '../_shared/security_system.ts';

const redis = new Redis(Deno.env.get('REDIS_URL'));
const rateLimiter = new RedisRateLimiter(redis, {
  maxRequests: 100,
  windowMs: 60000, // 1 minute per user
});

export const handler = async (req: Request) => {
  const userId = req.headers.get('x-user-id') || 'anonymous';
  
  // Check server-side rate limit
  if (!await rateLimiter.isAllowed(userId)) {
    const remaining = await rateLimiter.getRemainingRequests(userId);
    const resetTime = await rateLimiter.getResetTime(userId);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Rate limited',
        remaining,
        resetTime,
      }),
      { status: 429 }
    );
  }

  // Process request
  // ...
};
```

**Key Differences:**
- Client-side rate limiting provides immediate feedback
- Server-side rate limiting prevents abuse
- Exponential backoff prevents thundering herd
- Clear user feedback on rate limit status

---

## Example 6: Structured UI Components

### Before (Regex Parsing)

```typescript
// Dawinix/src/components/features/MessageBubble.tsx
function parseAppImageResults(content: string): Array<{ url: string; title: string }> | null {
  const match = content.match(/\[IMAGE_SEARCH_RESULTS:([\s\S]*?):IMAGE_SEARCH_END\]/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {}
  return null;
}

function parsePromptCard(content: string): { title?: string; subject?: string; body: string } | null {
  const match = content.match(/\[PROMPT_CARD\]([\s\S]*?)\[\/PROMPT_CARD\]/i);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    if (parsed.body) return parsed;
  } catch {}
  return null;
}

// In render
const imageResults = parseAppImageResults(message.content);
if (imageResults) {
  return <ImageCarousel images={imageResults} />;
}

const promptCard = parsePromptCard(message.content);
if (promptCard) {
  return <EmailComposerModal {...promptCard} />;
}
```

### After (Structured Data)

```typescript
// Dawinix/src/components/features/MessageBubble.tsx
import { componentRegistry } from '@/lib/ui/componentRegistry';

const MessageBubble = ({ message }: { message: Message }) => {
  // If message has structured data, render the appropriate component
  if (message.structuredData?.type) {
    const ComponentType = componentRegistry[message.structuredData.type];
    
    if (ComponentType) {
      return <ComponentType {...message.structuredData.props} />;
    }
  }

  // Otherwise render as markdown
  return <MarkdownRenderer content={message.content} />;
};

// Component registry
// Dawinix/src/lib/ui/componentRegistry.ts
export const componentRegistry: Record<string, React.ComponentType<any>> = {
  weather: WeatherWidget,
  map: MapCard,
  image_gallery: ImageCarousel,
  code_block: CodeBlock,
  calculator: CalculatorCard,
  email_composer: EmailComposerModal,
  quiz: QuizModal,
  table: TableComponent,
  timeline: TimelineComponent,
};
```

**Key Differences:**
- No regex parsing of content
- Structured data is passed as props
- Components are registered in a central registry
- Easy to add new component types
- UI is decoupled from content format

---

## Example 7: Streaming with Proper Error Handling

### Before (Basic Streaming)

```typescript
// Dawinix/src/pages/ChatPage.tsx
const response = await fetch('/api/chat', { body: JSON.stringify(messages) });
const reader = response.body?.getReader();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const text = new TextDecoder().decode(value);
  setStreamingContent(prev => prev + text);
}
```

### After (Robust Streaming)

```typescript
// Dawinix/src/pages/ChatPage.tsx
import { handleStreamingResponse } from '@/lib/errors/error_handling_system';
import { withErrorHandling } from '@/lib/errors/error_handling_system';

await withErrorHandling(
  async () => {
    const response = await fetch('/api/chat', {
      body: JSON.stringify(messages),
      signal: AbortSignal.timeout(60000), // 60 second timeout
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    await handleStreamingResponse(
      response,
      (chunk: string) => {
        // Process each chunk
        try {
          // Try to parse as JSON for structured data
          const data = JSON.parse(chunk);
          setStreamingContent(prev => prev + data.content);
        } catch {
          // If not JSON, treat as text
          setStreamingContent(prev => prev + chunk);
        }
      },
      'chat_streaming'
    );
  },
  'stream_chat',
  {
    retry: { enabled: true, maxAttempts: 2, backoffMs: 2000 },
    userMessage: 'Connection lost. Retrying...',
    alertUser: true,
  }
);
```

**Key Differences:**
- Automatic timeout after 60 seconds
- Proper error handling for network failures
- Automatic retry on failure
- Graceful handling of partial responses
- Cleanup on component unmount

---

## Summary

These examples demonstrate how the new systems work together to create a more robust, secure, and intelligent application:

1. **Context-aware routing** replaces keyword detection
2. **Structured responses** enable intelligent UI rendering
3. **Proper error handling** ensures stability
4. **Input validation** prevents security issues
5. **Rate limiting** prevents abuse
6. **Encryption** protects sensitive data

All of these work together to create an application that is smarter, more secure, and more reliable.

