# Implementation Guide: AI System Upgrade

This guide provides step-by-step instructions for integrating the new context-aware AI engine, error handling system, and security infrastructure into both **HaitianChatGpt** and **Dawinix** repositories.

---

## Overview of New Systems

### 1. Context-Aware AI Router (`context_aware_ai_router.ts`)
- Replaces keyword-based intent detection with semantic understanding
- Provides structured response format with multimedia support
- Enables intelligent routing to appropriate AI functions

### 2. Error Handling System (`error_handling_system.ts`)
- Replaces silent error suppression with proper logging
- Implements retry logic with exponential backoff
- Provides standardized edge function responses

### 3. Security System (`security_system.ts`)
- Implements encryption for sensitive data
- Provides comprehensive input validation
- Implements rate limiting (in-memory and Redis)
- Includes security audit logging

---

## Phase 3: Integration Steps

### Step 1: Set Up New Modules

#### For HaitianChatGpt (React Native):

1. **Create new directories:**
   ```bash
   mkdir -p HaitianChatGpt/lib/ai
   mkdir -p HaitianChatGpt/lib/errors
   mkdir -p HaitianChatGpt/lib/security
   ```

2. **Copy the new modules:**
   ```bash
   cp context_aware_ai_router.ts HaitianChatGpt/lib/ai/
   cp error_handling_system.ts HaitianChatGpt/lib/errors/
   cp security_system.ts HaitianChatGpt/lib/security/
   ```

3. **Install additional dependencies:**
   ```bash
   cd HaitianChatGpt
   npm install crypto-js tweetnacl ioredis
   ```

#### For Dawinix (React Web):

1. **Create new directories:**
   ```bash
   mkdir -p Dawinix/src/lib/ai
   mkdir -p Dawinix/src/lib/errors
   mkdir -p Dawinix/src/lib/security
   ```

2. **Copy the new modules:**
   ```bash
   cp context_aware_ai_router.ts Dawinix/src/lib/ai/
   cp error_handling_system.ts Dawinix/src/lib/errors/
   cp security_system.ts Dawinix/src/lib/security/
   ```

3. **Install additional dependencies:**
   ```bash
   cd Dawinix
   npm install crypto-js tweetnacl
   ```

### Step 2: Update Message Interface

Update the `Message` type in both applications to support multimedia:

#### HaitianChatGpt (`app/types.ts` or similar):

```typescript
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  image_url?: string;
  image_urls?: string[];
  video_url?: string;
  multimedia?: Array<{
    type: 'image' | 'video' | 'chart' | 'diagram';
    url: string;
    caption?: string;
    alt?: string;
  }>;
  structuredData?: {
    type: string;
    data: any;
  };
  created_at?: string;
  updated_at?: string;
}
```

#### Dawinix (`src/types/index.ts` or similar):

```typescript
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  image_url?: string;
  image_urls?: string[];
  video_url?: string;
  multimedia?: Array<{
    type: 'image' | 'video' | 'chart' | 'diagram';
    url: string;
    caption?: string;
    alt?: string;
  }>;
  structuredData?: {
    type: string;
    data: any;
  };
  created_at?: string;
  updated_at?: string;
}
```

### Step 3: Replace Keyword-Based Detection

#### In HaitianChatGpt (`app/home.tsx`):

**Before:**
```typescript
const QUIZ_KEYWORDS = ['quiz', 'quizz', 'make me a quiz', ...];
const lowerTextForQuiz = currentText.toLowerCase();
const isQuizRequest = QUIZ_KEYWORDS.some(kw => lowerTextForQuiz.includes(kw));
if (isQuizRequest && !currentEditingId) {
  // Handle quiz generation
}
```

**After:**
```typescript
import { routeUserRequest } from '../lib/ai/context_aware_ai_router';

// Remove the keyword-based detection
// Instead, use the context-aware router:

const handleSendMessage = async (text: string) => {
  const response = await routeUserRequest(
    text,
    conversationHistory,
    callAI,
    {
      quiz: generateQuizHandler,
      imageGeneration: generateImageHandler,
      videoGeneration: generateVideoHandler,
      webSearch: searchWebHandler,
    }
  );

  // Process the structured response
  const message = structuredResponseToMessage(response);
  addMessageToConversation(message);
};
```

#### In Dawinix (`src/pages/ChatPage.tsx`):

**Before:**
```typescript
const detectQuizIntent = (text: string): boolean => {
  return /\b(quiz|test|practice|trivia)\b/i.test(text);
};

if (detectQuizIntent(userMessage)) {
  // Handle quiz generation
}
```

**After:**
```typescript
import { routeUserRequest } from '@/lib/ai/context_aware_ai_router';

const handleSendMessage = async (text: string) => {
  const response = await routeUserRequest(
    text,
    conversationHistory,
    callAI,
    {
      quiz: generateQuizHandler,
      imageGeneration: generateImageHandler,
      videoGeneration: generateVideoHandler,
      webSearch: searchWebHandler,
    }
  );

  const message = structuredResponseToMessage(response);
  addMessageToConversation(message);
};
```

### Step 4: Update Message Rendering

#### In HaitianChatGpt (`components/MessageItem.tsx`):

```typescript
import { structuredResponseToMessage } from '../lib/ai/context_aware_ai_router';

export const MessageItem = ({ message }: { message: Message }) => {
  return (
    <View>
      {/* Render text content */}
      <MarkdownRenderer content={message.content} />

      {/* Render multimedia */}
      {message.multimedia?.images && (
        <ImageCarousel images={message.multimedia.images} />
      )}

      {message.multimedia?.videos && (
        <VideoPlayer videos={message.multimedia.videos} />
      )}

      {/* Render structured data */}
      {message.structuredData && (
        <StructuredDataRenderer data={message.structuredData} />
      )}
    </View>
  );
};
```

#### In Dawinix (`src/components/features/MessageBubble.tsx`):

```typescript
import { structuredResponseToMessage } from '@/lib/ai/context_aware_ai_router';

export const MessageBubble = ({ message }: { message: Message }) => {
  return (
    <div>
      {/* Render text content */}
      <MarkdownRenderer content={message.content} />

      {/* Render multimedia */}
      {message.multimedia?.images && (
        <ImageCarousel images={message.multimedia.images} />
      )}

      {message.multimedia?.videos && (
        <VideoPlayer videos={message.multimedia.videos} />
      )}

      {/* Render structured data */}
      {message.structuredData && (
        <StructuredDataRenderer data={message.structuredData} />
      )}
    </div>
  );
};
```

### Step 5: Update AI Edge Function

Update `HaitianChatGpt/supabase/functions/chat/index.ts`:

```typescript
import { 
  buildStructuredResponse, 
  CONTEXT_AWARE_SYSTEM_PROMPT 
} from '../_shared/context_aware_ai_router.ts';
import { 
  withEdgeFunctionErrorHandling, 
  createEdgeFunctionResponse 
} from '../_shared/error_handling_system.ts';

export const handler = async (req: Request) => {
  return withEdgeFunctionErrorHandling(async () => {
    const body = await req.json();
    const { messages, model } = body;

    // Validate input
    if (!messages || !Array.isArray(messages)) {
      return createEdgeFunctionResponse(false, undefined, 'Invalid messages format', 'INVALID_INPUT', 400);
    }

    // Add system prompt for context-aware routing
    const messagesWithSystem = [
      { role: 'system', content: CONTEXT_AWARE_SYSTEM_PROMPT },
      ...messages,
    ];

    // Call AI with context-aware system prompt
    const aiResponse = await callAI(model, messagesWithSystem);

    // Build structured response
    const structuredResponse = await buildStructuredResponse(
      messages[messages.length - 1].content,
      aiResponse.content,
      messages,
      (msgs) => callAI(model, msgs),
      generateImageSmart,
      generateVideoSmart,
      searchImages
    );

    return createEdgeFunctionResponse(true, structuredResponse);
  }, 'chat-handler');
};
```

---

## Phase 4: Error Handling Integration

### Step 1: Replace Silent Error Catches

#### In HaitianChatGpt (`app/home.tsx`):

**Before:**
```typescript
try {
  await sendMessage(currentText);
} catch (_e) {}
```

**After:**
```typescript
import { withErrorHandling, errorLogger } from '../lib/errors/error_handling_system';

await withErrorHandling(
  () => sendMessage(currentText),
  'send_message',
  {
    retry: { enabled: true, maxAttempts: 3, backoffMs: 1000 },
    userMessage: 'Failed to send message. Please try again.',
    alertUser: true,
  },
  { conversationId: currentConversation?.id }
);
```

### Step 2: Set Up Global Error Handlers

In both applications' main entry point:

#### HaitianChatGpt (`app/_layout.tsx`):

```typescript
import { setupGlobalErrorHandlers } from '../lib/errors/error_handling_system';

export default function RootLayout() {
  useEffect(() => {
    setupGlobalErrorHandlers();
  }, []);

  return <Stack />;
}
```

#### Dawinix (`src/main.tsx`):

```typescript
import { setupGlobalErrorHandlers } from '@/lib/errors/error_handling_system';

setupGlobalErrorHandlers();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### Step 3: Update API Calls

Replace all direct fetch calls with the new error-handling wrapper:

```typescript
import { makeAPICall } from '../lib/errors/error_handling_system';

const response = await makeAPICall<ChatResponse>(
  '/api/chat',
  {
    method: 'POST',
    body: JSON.stringify({ message: userMessage }),
  },
  'chat_api_call'
);

if (!response.success) {
  showError('Failed to send message', response.error);
  return;
}

// Use response.data
```

---

## Phase 5: Security Integration

### Step 1: Implement Input Validation

```typescript
import { InputValidator } from '../lib/security/security_system';

// Validate user input before sending
const sanitizedMessage = InputValidator.sanitizeString(userMessage);
const isValid = sanitizedMessage.length > 0 && sanitizedMessage.length <= 10000;

if (!isValid) {
  showError('Invalid input', 'Message must be between 1 and 10000 characters');
  return;
}
```

### Step 2: Implement Rate Limiting

#### For HaitianChatGpt (client-side):

```typescript
import { InMemoryRateLimiter } from '../lib/security/security_system';

const rateLimiter = new InMemoryRateLimiter({
  maxRequests: 10,
  windowMs: 60000, // 1 minute
});

const handleSendMessage = (text: string) => {
  const userId = user?.id || 'guest';
  
  if (!rateLimiter.isAllowed(userId)) {
    const remaining = rateLimiter.getRemainingRequests(userId);
    const resetTime = rateLimiter.getResetTime(userId);
    showAlert('Rate Limited', `Too many requests. Try again in ${Math.ceil((resetTime - Date.now()) / 1000)}s`);
    return;
  }

  sendMessage(text);
};
```

#### For Supabase Edge Functions (server-side):

```typescript
import { RedisRateLimiter } from '../_shared/security_system.ts';

const redis = new Redis(Deno.env.get('REDIS_URL'));
const rateLimiter = new RedisRateLimiter(redis, {
  maxRequests: 100,
  windowMs: 60000, // 1 minute
});

export const handler = async (req: Request) => {
  const clientId = req.headers.get('x-client-id') || 'anonymous';
  
  if (!await rateLimiter.isAllowed(clientId)) {
    return new Response(
      JSON.stringify({ error: 'Rate limited' }),
      { status: 429 }
    );
  }

  // Process request
};
```

### Step 3: Encrypt Sensitive Data

```typescript
import { DataEncryption } from '../lib/security/security_system';

const encryption = new DataEncryption(process.env.ENCRYPTION_KEY);

// Encrypt API keys before storing
const encryptedApiKey = encryption.encrypt(apiKey);
await saveToDatabase({ encryptedApiKey });

// Decrypt when needed
const decryptedApiKey = encryption.decrypt(encryptedApiKey);
```

---

## Phase 6: UI/UX Enhancements

### Step 1: Add Image Gallery to Home Page

#### HaitianChatGpt (`app/home.tsx`):

```typescript
import { ImageCarousel } from '../components/ImageCarousel';

export default function HomeScreen() {
  const [recentImages, setRecentImages] = useState<string[]>([]);

  useEffect(() => {
    loadRecentImages();
  }, []);

  return (
    <ScrollView>
      {recentImages.length > 0 && (
        <View>
          <Text style={styles.title}>Recent Images</Text>
          <ImageCarousel images={recentImages} />
        </View>
      )}
      {/* Rest of home screen */}
    </ScrollView>
  );
}
```

#### Dawinix (`src/pages/HomePage.tsx`):

```typescript
import { ImageCarousel } from '@/components/ImageCarousel';

export default function HomePage() {
  const [recentImages, setRecentImages] = useState<string[]>([]);

  useEffect(() => {
    loadRecentImages();
  }, []);

  return (
    <div>
      {recentImages.length > 0 && (
        <div>
          <h2>Recent Images</h2>
          <ImageCarousel images={recentImages} />
        </div>
      )}
      {/* Rest of home page */}
    </div>
  );
}
```

### Step 2: Implement Image Lightbox

Create a reusable lightbox component for viewing full-resolution images:

```typescript
// HaitianChatGpt/components/ImageLightbox.tsx
// Dawinix/src/components/ImageLightbox.tsx

export const ImageLightbox = ({ 
  isOpen, 
  imageUrl, 
  onClose 
}: { 
  isOpen: boolean; 
  imageUrl?: string; 
  onClose: () => void;
}) => {
  return (
    <Modal visible={isOpen} transparent onRequestClose={onClose}>
      {/* Lightbox UI */}
    </Modal>
  );
};
```

---

## Testing Checklist

- [ ] Context-aware routing works for all intent types
- [ ] Images are generated and displayed inline in chat
- [ ] Error handling doesn't crash the application
- [ ] Rate limiting prevents abuse
- [ ] Input validation prevents XSS attacks
- [ ] Encryption works for sensitive data
- [ ] UI is responsive and smooth
- [ ] All features work on both web and mobile
- [ ] App Store guidelines are met

---

## Deployment Checklist

- [ ] All new modules are properly imported
- [ ] Environment variables are configured
- [ ] Database migrations are run
- [ ] Edge functions are deployed
- [ ] Tests pass
- [ ] Performance is acceptable
- [ ] Security audit is complete
- [ ] Monitoring is set up

---

## Rollback Plan

If issues arise during deployment:

1. **Revert to previous version:** `git revert <commit-hash>`
2. **Restore database:** Use database backups
3. **Notify users:** Send notification about temporary issues
4. **Investigate:** Review logs and error reports
5. **Fix and redeploy:** Once issues are resolved

---

## Support and Troubleshooting

### Common Issues

**Issue: "Context-aware router is not working"**
- Check that the system prompt is being included in the AI call
- Verify that the JSON metadata block is properly formatted in the AI response
- Check error logs for parsing errors

**Issue: "Images are not displaying in chat"**
- Verify that image URLs are valid and accessible
- Check that the multimedia array is properly populated
- Ensure image rendering components are properly imported

**Issue: "Rate limiting is too strict"**
- Adjust `maxRequests` and `windowMs` in the rate limiter configuration
- Consider implementing user-tier-based rate limiting

**Issue: "Encryption key is not working"**
- Verify that the encryption key is properly set in environment variables
- Ensure the key is at least 32 characters long
- Check that the key is consistent across all instances

---

## Next Steps

1. **Review and test** each integration step thoroughly
2. **Gather feedback** from users and team members
3. **Optimize performance** based on usage patterns
4. **Plan Phase 7** (final testing and deployment)
5. **Prepare release notes** for App Store submission

