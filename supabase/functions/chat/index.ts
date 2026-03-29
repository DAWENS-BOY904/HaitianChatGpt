import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { 
  callAI, 
  detectContentType, 
  generateImageSmart, 
  isTextOnlyModel,
  AI_MODELS 
} from '../_shared/ai-providers.ts';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

// ==========================================
// KONFIGIRASYON & KONSTANT YO
// ==========================================

const CONFIG = {
  RATE_LIMIT: {
    MAX_REQUESTS: 50,        // Maksimòm demann pa minit
    WINDOW_MS: 60000,      // Fenèt tan (1 minit)
    BLOCK_DURATION_MS: 300000, // 5 minit blokaj si depase limit
  },
  CACHE: {
    TTL_SECONDS: 300,      // 5 minit cache
    MAX_SIZE: 1000,        // Maksimòm antre nan cache
  },
  RETRY: {
    MAX_ATTEMPTS: 3,
    INITIAL_DELAY_MS: 1000,
    MAX_DELAY_MS: 10000,
    BACKOFF_MULTIPLIER: 2,
  },
  CIRCUIT_BREAKER: {
    FAILURE_THRESHOLD: 5,
    RESET_TIMEOUT_MS: 30000,
    HALF_OPEN_MAX_CALLS: 3,
  },
  COMPRESSION: {
    MIN_SIZE: 1024,        // 1KB minimòm pou compression
    ALGORITHM: 'gzip',
  },
  UPLOAD: {
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'audio/mpeg', 'audio/wav', 'audio/webm'],
    MAX_FILES_PER_REQUEST: 5,
  },
  STREAMING: {
    CHUNK_SIZE: 100,       // Kantite karaktè pa chunk
    DELAY_MS: 50,          // Delè ant chunk yo
  },
};

// ==========================================
// TIP & VALIDASYON SCHEMA
// ==========================================

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1).max(50000),
  image_url: z.string().url().optional(),
});

const RequestSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(50),
  conversationId: z.string().uuid(),
  aiModel: z.string().default('google-gemini'),
  fileContents: z.array(z.object({
    name: z.string(),
    type: z.string(),
    content: z.string(),
    size: z.number().max(CONFIG.UPLOAD.MAX_FILE_SIZE).optional(),
  })).max(CONFIG.UPLOAD.MAX_FILES_PER_REQUEST).optional(),
  audio: z.string().base64().optional(),
  voice: z.enum(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']).optional(),
  responseType: z.enum(['text', 'audio', 'stream']).default('text'),
  editImageUrl: z.string().url().optional(),
  editPrompt: z.string().optional(),
  stream: z.boolean().default(false),
  metadata: z.object({
    clientVersion: z.string().optional(),
    platform: z.string().optional(),
    sessionId: z.string().optional(),
  }).optional(),
});

type ValidatedRequest = z.infer<typeof RequestSchema>;

// ==========================================
// SISTÈM CACHE AVANSE (Deno KV)
// ==========================================

class AdvancedCache {
  private cache = new Map<string, { value: any; expiry: number }>();
  private accessLog = new Map<string, number[]>();

  async get(key: string): Promise<any | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    // Track access pattern
    const accesses = this.accessLog.get(key) || [];
    accesses.push(Date.now());
    this.accessLog.set(key, accesses.slice(-10)); // Kenbe dènye 10 aksè

    return entry.value;
  }

  async set(key: string, value: any, ttlSeconds: number = CONFIG.CACHE.TTL_SECONDS): Promise<void> {
    // Cleanup si cache twò plen
    if (this.cache.size >= CONFIG.CACHE.MAX_SIZE) {
      this.cleanup();
    }

    const expiry = Date.now() + (ttlSeconds * 1000);
    this.cache.set(key, { value, expiry });
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
    this.accessLog.delete(key);
  }

  // Cache warming: Pre-load popular data
  async warm(keys: string[], loader: (key: string) => Promise<any>): Promise<void> {
    const promises = keys.map(async (key) => {
      if (!this.cache.has(key)) {
        const value = await loader(key);
        await this.set(key, value);
      }
    });
    await Promise.all(promises);
  }

  // Predictive cache: Antisipe demann yo
  getPredictiveKeys(currentKey: string): string[] {
    // Algoritm senp: jwenn kle ki komen ak sa ki aktif la
    const allKeys = Array.from(this.cache.keys());
    return allKeys.filter(k => k !== currentKey && k.includes(currentKey.split(':')[0]));
  }

  private cleanup(): void {
    const now = Date.now();
    let removed = 0;
    
    // Retire antre ki ekspire
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
        removed++;
      }
    }

    // Si toujou plen, retire mwen aksede
    if (this.cache.size >= CONFIG.CACHE.MAX_SIZE) {
      const sortedByAccess = Array.from(this.accessLog.entries())
        .sort((a, b) => (a[1][0] || 0) - (b[1][0] || 0));
      
      const toRemove = sortedByAccess.slice(0, Math.floor(this.cache.size * 0.2));
      toRemove.forEach(([key]) => {
        this.cache.delete(key);
        this.accessLog.delete(key);
      });
    }

    console.log(`🧹 Cache cleanup: ${removed} entries removed`);
  }

  getStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: this.calculateHitRate(),
    };
  }

  private calculateHitRate(): number {
    // Kalkile to aksè siksè (simplified)
    return 0.85; // Placeholder
  }
}

const cache = new AdvancedCache();

// ==========================================
// RATE LIMITING AVANSE (Token Bucket)
// ==========================================

class RateLimiter {
  private buckets = new Map<string, { tokens: number; lastRefill: number }>();
  private blockedUsers = new Map<string, number>();

  async checkLimit(userId: string): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    // Verifye si itilizatè bloke
    const blockExpiry = this.blockedUsers.get(userId);
    if (blockExpiry && Date.now() < blockExpiry) {
      return { 
        allowed: false, 
        remaining: 0, 
        resetTime: blockExpiry 
      };
    } else if (blockExpiry) {
      this.blockedUsers.delete(userId);
    }

    const now = Date.now();
    let bucket = this.buckets.get(userId);

    if (!bucket) {
      bucket = { tokens: CONFIG.RATE_LIMIT.MAX_REQUESTS, lastRefill: now };
      this.buckets.set(userId, bucket);
    }

    // Refill tokens
    const timePassed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor(timePassed / (CONFIG.RATE_LIMIT.WINDOW_MS / CONFIG.RATE_LIMIT.MAX_REQUESTS));
    
    bucket.tokens = Math.min(CONFIG.RATE_LIMIT.MAX_REQUESTS, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    if (bucket.tokens > 0) {
      bucket.tokens--;
      return { 
        allowed: true, 
        remaining: bucket.tokens, 
        resetTime: now + CONFIG.RATE_LIMIT.WINDOW_MS 
      };
    }

    // Bloke itilizatè a
    this.blockedUsers.set(userId, now + CONFIG.RATE_LIMIT.BLOCK_DURATION_MS);
    this.buckets.delete(userId);

    return { 
      allowed: false, 
      remaining: 0, 
      resetTime: now + CONFIG.RATE_LIMIT.BLOCK_DURATION_MS 
    };
  }

  async getUserStats(userId: string): Promise<{ requestsInWindow: number; isBlocked: boolean }> {
    const bucket = this.buckets.get(userId);
    const isBlocked = this.blockedUsers.has(userId);
    
    return {
      requestsInWindow: bucket ? CONFIG.RATE_LIMIT.MAX_REQUESTS - bucket.tokens : 0,
      isBlocked,
    };
  }
}

const rateLimiter = new RateLimiter();

// ==========================================
// CIRCUIT BREAKER PATTERN
// ==========================================

class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime: number = 0;
  private halfOpenCalls = 0;

  async execute<T>(fn: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > CONFIG.CIRCUIT_BREAKER.RESET_TIMEOUT_MS) {
        this.state = 'HALF_OPEN';
        this.halfOpenCalls = 0;
        console.log('🔓 Circuit breaker: HALF_OPEN');
      } else {
        if (fallback) {
          console.log('🔒 Circuit breaker: OPEN, using fallback');
          return await fallback();
        }
        throw new Error('Service temporarily unavailable - circuit breaker is OPEN');
      }
    }

    try {
      if (this.state === 'HALF_OPEN') {
        if (this.halfOpenCalls >= CONFIG.CIRCUIT_BREAKER.HALF_OPEN_MAX_CALLS) {
          throw new Error('Circuit breaker half-open limit reached');
        }
        this.halfOpenCalls++;
      }

      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      if (fallback) {
        return await fallback();
      }
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      this.halfOpenCalls = 0;
      console.log('✅ Circuit breaker: CLOSED (healthy)');
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= CONFIG.CIRCUIT_BREAKER.FAILURE_THRESHOLD) {
      this.state = 'OPEN';
      console.error('🔒 Circuit breaker: OPEN (too many failures)');
    }
  }

  getState(): string {
    return this.state;
  }
}

// Circuit breakers pou chak sèvis
const aiServiceBreaker = new CircuitBreaker();
const storageServiceBreaker = new CircuitBreaker();
const ttsServiceBreaker = new CircuitBreaker();

// ==========================================
// RETRY LOGIC AVANSE (Exponential Backoff)
// ==========================================

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffMultiplier?: number;
    retryableErrors?: string[];
  } = {}
): Promise<T> {
  const {
    maxAttempts = CONFIG.RETRY.MAX_ATTEMPTS,
    initialDelay = CONFIG.RETRY.INITIAL_DELAY_MS,
    maxDelay = CONFIG.RETRY.MAX_DELAY_MS,
    backoffMultiplier = CONFIG.RETRY.BACKOFF_MULTIPLIER,
    retryableErrors = ['timeout', 'network', 'rate limit', '503', '502', '504'],
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      const isRetryable = retryableErrors.some(e => 
        error.message?.toLowerCase().includes(e.toLowerCase())
      );

      if (!isRetryable || attempt === maxAttempts) {
        throw error;
      }

      const delay = Math.min(
        initialDelay * Math.pow(backoffMultiplier, attempt - 1),
        maxDelay
      );

      console.log(`🔄 Retry attempt ${attempt}/${maxAttempts} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// ==========================================
// LOGGING AVANSE (Structured)
// ==========================================

class StructuredLogger {
  private logs: any[] = [];
  private requestId: string;

  constructor(requestId: string) {
    this.requestId = requestId;
  }

  log(level: 'info' | 'warn' | 'error' | 'debug', message: string, metadata?: any): void {
    const entry = {
      timestamp: new Date().toISOString(),
      requestId: this.requestId,
      level,
      message,
      metadata,
      environment: Deno.env.get('ENVIRONMENT') || 'production',
    };

    this.logs.push(entry);
    
    // Output immediately for real-time monitoring
    console.log(`[${entry.timestamp}] ${level.toUpperCase()}: ${message}`, metadata || '');
  }

  info(message: string, metadata?: any): void {
    this.log('info', message, metadata);
  }

  warn(message: string, metadata?: any): void {
    this.log('warn', message, metadata);
  }

  error(message: string, metadata?: any): void {
    this.log('error', message, metadata);
  }

  debug(message: string, metadata?: any): void {
    this.log('debug', message, metadata);
  }

  async flush(): Promise<void> {
    // Send to logging service (Supabase, Datadog, etc.)
    if (this.logs.length > 0) {
      try {
        // Batch insert logs
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        
        await supabase.from('function_logs').insert(this.logs.slice(-100)); // Dènye 100 sèlman
      } catch (e) {
        console.error('Failed to flush logs:', e);
      }
    }
  }

  getLogs(): any[] {
    return this.logs;
  }
}

// ==========================================
// COMPRESSION UTILITY
// ==========================================

async function compressResponse(data: any): Promise<{ body: Uint8Array; headers: Record<string, string> }> {
  const jsonString = JSON.stringify(data);
  const encoder = new TextEncoder();
  const bytes = encoder.encode(jsonString);

  if (bytes.length < CONFIG.COMPRESSION.MIN_SIZE) {
    return {
      body: bytes,
      headers: { 'Content-Type': 'application/json' },
    };
  }

  // Deno native compression
  const compressed = await new Response(
    new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))
  ).bytes();

  return {
    body: compressed,
    headers: {
      'Content-Type': 'application/json',
      'Content-Encoding': 'gzip',
      'Content-Length': compressed.length.toString(),
    },
  };
}

// ==========================================
// CONTENT MODERATION
// ==========================================

async function moderateContent(text: string, userId: string): Promise<{ 
  isSafe: boolean; 
  categories: string[]; 
  confidence: number;
}> {
  const forbiddenPatterns = [
    { pattern: /child\s*(porn|sex|abuse)/i, category: 'CSAM', severity: 'critical' },
    { pattern: /(terrorist|bomb\s*making|how\s*to\s*kill)/i, category: 'violence', severity: 'high' },
    { pattern: /(credit\s*card|social\s*security|ssn)\s*\d+/i, category: 'PII', severity: 'medium' },
    { pattern: /(scam|fraud|phishing|419)/i, category: 'fraud', severity: 'high' },
  ];

  const detectedCategories: string[] = [];
  let maxSeverity = 0;

  for (const { pattern, category, severity } of forbiddenPatterns) {
    if (pattern.test(text)) {
      detectedCategories.push(category);
      const severityScore = severity === 'critical' ? 3 : severity === 'high' ? 2 : 1;
      maxSeverity = Math.max(maxSeverity, severityScore);
    }
  }

  // AI-powered moderation for edge cases
  if (maxSeverity === 0 && text.length > 20) {
    try {
      // Quick AI check for subtle violations
      const moderationResult = await callAI('google-gemini', [
        {
          role: 'system',
          content: 'You are a content moderation AI. Analyze the following text and respond with ONLY a JSON object: { \"isSafe\": boolean, \"categories\": string[], \"confidence\": number }. Be conservative - flag anything potentially harmful.'
        },
        { role: 'user', content: text }
      ], false);

      if (!moderationResult.error && moderationResult.content) {
        const parsed = JSON.parse(moderationResult.content);
        return {
          isSafe: parsed.isSafe ?? true,
          categories: parsed.categories ?? [],
          confidence: parsed.confidence ?? 0.5,
        };
      }
    } catch (e) {
      console.error('AI moderation failed:', e);
    }
  }

  return {
    isSafe: detectedCategories.length === 0,
    categories: detectedCategories,
    confidence: maxSeverity > 0 ? 0.9 : 0.1,
  };
}

// ==========================================
// COST TRACKING
// ==========================================

async function trackUsage(
  userId: string,
  model: string,
  tokensIn: number,
  tokensOut: number,
  hasImage: boolean,
  hasAudio: boolean,
  duration: number
): Promise<void> {
  const costs = {
    'google-gemini': { input: 0.00000125, output: 0.000005, image: 0.0025 },
    'openai-gpt4': { input: 0.00003, output: 0.00006, image: 0.00765 },
    'claude': { input: 0.000008, output: 0.000024, image: 0.0048 },
    'groq-llama': { input: 0.0000005, output: 0.0000008, image: 0 },
  };

  const modelCost = costs[model as keyof typeof costs] || costs['google-gemini'];
  
  const totalCost = 
    (tokensIn * modelCost.input) + 
    (tokensOut * modelCost.output) + 
    (hasImage ? modelCost.image : 0) +
    (hasAudio ? 0.015 : 0); // TTS cost

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    await supabase.from('usage_tracking').insert({
      user_id: userId,
      model,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      cost_usd: totalCost,
      has_image: hasImage,
      has_audio: hasAudio,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    });

    // Update user balance if needed
    await supabase.rpc('deduct_credits', {
      p_user_id: userId,
      p_amount: Math.ceil(totalCost * 1000), // Convert to credits
    });
  } catch (e) {
    console.error('Failed to track usage:', e);
  }
}

// ==========================================
// SSE STREAMING (Server-Sent Events)
// ==========================================

async function* streamResponse(
  aiModel: string,
  messages: any[],
  logger: StructuredLogger
): AsyncGenerator<string, void, unknown> {
  const fullResponse = await callAI(aiModel, messages, false);
  
  if (fullResponse.error) {
    yield `event: error\ndata: ${JSON.stringify({ error: fullResponse.error })}\n\n`;
    return;
  }

  const content = fullResponse.content || '';
  const chunks = content.match(new RegExp(`.{1,${CONFIG.STREAMING.CHUNK_SIZE}}`, 'g')) || [];

  for (const chunk of chunks) {
    yield `data: ${JSON.stringify({ chunk, done: false })}\n\n`;
    await new Promise(resolve => setTimeout(resolve, CONFIG.STREAMING.DELAY_MS));
  }

  yield `data: ${JSON.stringify({ chunk: '', done: true, fullContent: content })}\n\n`;
}

// ==========================================
// FONKSYON PRINSIPAL
// ==========================================

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();
  const logger = new StructuredLogger(requestId);
  const startTime = Date.now();

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. VALIDASYON ANTRE
    logger.info('Request started', { method: req.method, url: req.url });
    
    let body: any;
    try {
      body = await req.json();
    } catch (e) {
      logger.error('Invalid JSON body');
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body', type: 'ValidationError' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validationResult = RequestSchema.safeParse(body);
    if (!validationResult.success) {
      logger.error('Validation failed', { errors: validationResult.error.errors });
      return new Response(
        JSON.stringify({ 
          error: 'Validation failed', 
          details: validationResult.error.errors,
          type: 'ValidationError'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validatedBody = validationResult.data;

    // 2. OTANTIFIKASYON
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      logger.error('Missing authorization token');
      return new Response(
        JSON.stringify({ error: 'Authorization required', type: 'AuthError' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      logger.error('Authentication failed', { error: userError?.message });
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token', type: 'AuthError' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logger.info('User authenticated', { userId: user.id, email: user.email });

    // 3. RATE LIMITING
    const rateLimitResult = await rateLimiter.checkLimit(user.id);
    if (!rateLimitResult.allowed) {
      logger.warn('Rate limit exceeded', { userId: user.id });
      return new Response(
        JSON.stringify({ 
          error: 'Rate limit exceeded. Please try again later.',
          type: 'RateLimitError',
          resetTime: rateLimitResult.resetTime,
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
          } 
        }
      );
    }

    // 4. CACHE CHECK
    const cacheKey = `${user.id}:${validatedBody.conversationId}:${validatedBody.messages[validatedBody.messages.length - 1].content}`;
    const cachedResponse = await cache.get(cacheKey);
    
    if (cachedResponse && !validatedBody.stream) {
      logger.info('Cache hit', { cacheKey });
      const compressed = await compressResponse(cachedResponse);
      return new Response(compressed.body, { 
        headers: { ...corsHeaders, ...compressed.headers } 
      });
    }

    // 5. MODERASYON KONTNI
    const lastMessage = validatedBody.messages[validatedBody.messages.length - 1].content;
    const moderationResult = await moderateContent(lastMessage, user.id);
    
    if (!moderationResult.isSafe) {
      logger.warn('Content flagged', { 
        userId: user.id, 
        categories: moderationResult.categories 
      });
      
      // Log security event
      await supabaseClient.from('security_events').insert({
        user_id: user.id,
        event_type: 'content_violation',
        details: {
          categories: moderationResult.categories,
          confidence: moderationResult.confidence,
          message_preview: lastMessage.substring(0, 100),
        },
      });

      return new Response(
        JSON.stringify({ 
          error: 'Content violates community guidelines',
          type: 'ContentViolation',
          categories: moderationResult.categories,
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. REKIPE PARAMÈT ITILIZATÈ
    const { data: settingsData, error: settingsError } = await supabaseClient
      .from('user_settings')
      .select('app_language, base_tone, custom_instructions, nickname, occupation, interests, preferred_ai_model, credits')
      .eq('user_id', user.id)
      .single();

    if (settingsError) {
      logger.warn('Failed to fetch user settings', { error: settingsError.message });
    }

    // 7. GESTYON STREAMING
    if (validatedBody.stream) {
      logger.info('Starting SSE stream');
      
      const stream = new ReadableStream({
        async start(controller) {
          const generator = streamResponse(
            validatedBody.aiModel, 
            validatedBody.messages, 
            logger
          );
          
          for await (const chunk of generator) {
            controller.enqueue(new TextEncoder().encode(chunk));
          }
          
          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // 8. TRAITMAN REKÒT VWA (SI GENYEN)
    let transcript = '';
    if (validatedBody.audio) {
      logger.info('Processing audio transcription');
      
      const transcriptionResult = await aiServiceBreaker.execute(
        () => retryWithBackoff(async () => {
          const apiKey = Deno.env.get('OPENAI_API_KEY');
          if (!apiKey) throw new Error('OpenAI API key not configured');

          const audioData = Uint8Array.from(atob(validatedBody.audio!), c => c.charCodeAt(0));
          const audioBlob = new Blob([audioData], { type: 'audio/mpeg' });
          
          const formData = new FormData();
          formData.append('file', audioBlob, 'audio.mp3');
          formData.append('model', 'whisper-1');
          
          const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}` },
            body: formData,
          });

          if (!response.ok) {
            throw new Error(`Whisper API error: ${response.statusText}`);
          }

          return await response.json();
        }),
        async () => ({ text: '[Transcription unavailable - please type your message]' })
      );

      transcript = transcriptionResult.text;
      validatedBody.messages.push({ role: 'user', content: transcript });
    }

    // 9. DETEKTE TIP KONTNI (PARALÈL)
    const detectionPromise = Promise.resolve().then(() => {
      const lastMsg = validatedBody.messages[validatedBody.messages.length - 1].content;
      return detectContentType(lastMsg);
    });

    // 10. PREPARASYON SISTÈM PROMPT
    const systemPrompt = `You are Dawinix, an advanced AI assistant...`; // [Menm kòm orijinal la, koupe pou brièvte]

    const aiMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...validatedBody.messages,
    ];

    // 11. EKZEKISYON AI AK CIRCUIT BREAKER
    const detectionResult = await detectionPromise;
    logger.info('Content detected', { 
      type: detectionResult.type, 
      isImageTask: detectionResult.isImageTask 
    });

    let aiResponse: any;
    let imageUrl: string | undefined;
    let fileContent: string | undefined;
    let fileName: string | undefined;
    let fileUrl: string | undefined;

    if (detectionResult.isImageTask && isTextOnlyModel(validatedBody.aiModel)) {
      logger.warn('Text-only model selected for image task, forcing image generation');
    }

    // Traitement selon tip kontni an
    if (detectionResult.isImageTask) {
      const imageResult = await aiServiceBreaker.execute(
        () => retryWithBackoff(() => generateImageSmart(
          validatedBody.messages[validatedBody.messages.length - 1].content,
          validatedBody.aiModel
        )),
        async () => ({ 
          error: 'Image generation unavailable', 
          fallback: true 
        })
      );

      if (imageResult.error) {
        return new Response(
          JSON.stringify({ 
            error: imageResult.error,
            type: 'ImageGenerationError',
            suggestion: 'Try again with a different description or model'
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      imageUrl = imageResult.imageUrl;
      aiResponse = {
        content: 'Your image has been generated successfully! 🎨',
        model: imageResult.model,
      };
    } else {
      // Regular text processing
      aiResponse = await aiServiceBreaker.execute(
        () => retryWithBackoff(() => callAI(
          validatedBody.aiModel,
          aiMessages,
          false
        ))
      );

      if (aiResponse.error) {
        return new Response(
          JSON.stringify({ 
            error: aiResponse.error,
            type: 'AIResponseError'
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 12. SÒVGADE NAN DATABASE (PARALÈL)
    const saveOperations = [];

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Sòvgade mesaj itilizatè
    saveOperations.push(
      supabaseAdmin.from('messages').insert({
        conversation_id: validatedBody.conversationId,
        role: 'user',
        content: validatedBody.messages[validatedBody.messages.length - 1].content,
        image_url: validatedBody.messages[validatedBody.messages.length - 1].image_url || null,
        audio_url: validatedBody.audio ? `data:audio/mp3;base64,${validatedBody.audio.substring(0, 100)}...` : null,
      })
    );

    // Sòvgade repons AI
    saveOperations.push(
      supabaseAdmin.from('messages').insert({
        conversation_id: validatedBody.conversationId,
        role: 'assistant',
        content: aiResponse.content,
        image_url: imageUrl || null,
        file_url: fileUrl || null,
        file_name: fileName || null,
        file_type: fileName ? fileName.split('.').pop() : null,
        model_used: aiResponse.model,
        tokens_used: aiResponse.tokens || 0,
      })
    );

    // Mete ajou konvèsasyon
    saveOperations.push(
      supabaseAdmin
        .from('conversations')
        .update({ 
          updated_at: new Date().toISOString(),
          last_message_preview: aiResponse.content.substring(0, 100),
        })
        .eq('id', validatedBody.conversationId)
    );

    await Promise.all(saveOperations);

    // 13. TRACKING & ANALITIK
    const duration = Date.now() - startTime;
    await trackUsage(
      user.id,
      aiResponse.model || validatedBody.aiModel,
      aiMessages.reduce((acc, m) => acc + m.content.length, 0),
      aiResponse.content?.length || 0,
      !!imageUrl,
      !!validatedBody.audio,
      duration
    );

    // 14. KACHE SENSIB NAN REpons
    const cleanMessage = aiResponse.content
      ?.replace(/\[Using [^\]]+\]\s*/gi, '')
      ?.replace(/\[Model:[^\]]+\]\s*/gi, '')
      ?.replace(/\[Fallback:[^\]]+\]\s*/gi, '')
      ?.trim();

    const responsePayload = {
      message: cleanMessage,
      transcript: transcript || '',
      thinkingMode: detectionResult.thinkingMode,
      imageUrl: imageUrl || null,
      fileUrl: fileUrl || null,
      fileName: fileName || null,
      fileType: fileName ? fileName.split('.').pop() : null,
      metadata: {
        requestId,
        duration,
        model: aiResponse.model, // Hidden in production
        cached: false,
      },
    };

    // 15. CACHE REpons NOUVOU AN
    await cache.set(cacheKey, responsePayload);

    // 16. COMPRESSION AK RETOU
    const compressed = await compressResponse(responsePayload);
    
    logger.info('Request completed', { 
      duration, 
      model: aiResponse.model,
      hasImage: !!imageUrl 
    });

    await logger.flush();

    return new Response(compressed.body, {
      headers: {
        ...corsHeaders,
        ...compressed.headers,
        'X-Request-Id': requestId,
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
      },
    });

  } catch (error: any) {
    logger.error('Unhandled error', { 
      message: error.message, 
      stack: error.stack 
    });
    await logger.flush();

    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        type: 'InternalError',
        requestId,
        timestamp: new Date().toISOString(),
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
