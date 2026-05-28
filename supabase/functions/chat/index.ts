import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { callAI, detectContentType, generateImageSmart, searchImages } from '../_shared/ai-providers.ts';
import { createStreamingResponse } from '../_shared/streaming.ts';

// ── Types ──────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: string;
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
  image_url?: string;
}

interface ChatBody {
  messages: Array<{ role: string; content: unknown; image_url?: string }>;
  conversationId: string;
  aiModel?: string;
  fileContents?: Array<{ name: string; type: string; content: string }>;
  userImageUrl?: string;
  base64Image?: string;
  imageBase64?: string;
}

interface AIResponse {
  content?: string;
  model?: string;
  tokens?: number;
  error?: string;
}

interface CachedResponse {
  content: string;
  timestamp: number;
  query: string;
}

interface ApiInfo {
  name: string;
  docsUrl: string;
  knownLatest: string;
  notes: string;
}

// ── Configuration ──────────────────────────────────────────────────────────

const CONFIG = {
  MAX_BODY_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_FILE_CONTENT_SIZE: 500 * 1024, // 500KB per file
  CACHE_MAX_SIZE: 100,
  CACHE_TTL_MS: 30 * 60 * 1000,
  RATE_LIMIT_WINDOW_MS: 60 * 1000, // 1 minute
  RATE_LIMIT_MAX_REQUESTS: 30,
  ALLOWED_MODELS: ['onspace-ai', 'openai-gpt4', 'google-gemini', 'claude-3', 'groq-llama', 'gemini'],
  EXPO_PUSH_URL: Deno.env.get('EXPO_PUSH_URL') || 'https://exp.host/--/api/v2/push/send',
};

// ── Safe base64 decoder ────────────────────────────────────────────────────
function safeAtob(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ── Rate Limiter ───────────────────────────────────────────────────────────
class RateLimiter {
  private requests = new Map<string, number[]>();

  isAllowed(clientId: string): boolean {
    const now = Date.now();
    const window = CONFIG.RATE_LIMIT_WINDOW_MS;
    const max = CONFIG.RATE_LIMIT_MAX_REQUESTS;

    const timestamps = this.requests.get(clientId) || [];
    const valid = timestamps.filter(t => now - t < window);

    if (valid.length >= max) return false;

    valid.push(now);
    this.requests.set(clientId, valid);
    return true;
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, timestamps] of this.requests.entries()) {
      const valid = timestamps.filter(t => now - t < CONFIG.RATE_LIMIT_WINDOW_MS);
      if (valid.length === 0) this.requests.delete(key);
      else this.requests.set(key, valid);
    }
  }
}

const rateLimiter = new RateLimiter();

// ── Response Cache ─────────────────────────────────────────────────────────

class SafeCache {
  private cache = new Map<string, CachedResponse>();
  private maxSize: number;
  private ttlMs: number;

  constructor(maxSize: number, ttlMs: number) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  get(key: string): string | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    if (Date.now() - cached.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }
    return cached.content;
  }

  set(key: string, content: string, query: string): void {
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, { content, timestamp: Date.now(), query });
  }
}

const responseCache = new SafeCache(CONFIG.CACHE_MAX_SIZE, CONFIG.CACHE_TTL_MS);

function getCacheKey(messages: ChatMessage[]): string {
  const lastUserMessage = messages.filter(m => m.role === 'user').slice(-1)[0];
  if (!lastUserMessage) return '';
  const content = typeof lastUserMessage.content === 'string'
    ? lastUserMessage.content
    : JSON.stringify(lastUserMessage.content);
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString();
}

// ── UUID Validator ─────────────────────────────────────────────────────────
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// ── Input Sanitizer ────────────────────────────────────────────────────────
function sanitizeString(val: unknown): string {
  if (typeof val !== 'string') return '';
  return val
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
}

function sanitizeImageUrl(url: string): string | null {
  if (!url) return null;
  if (url.startsWith('data:image/')) {
    const match = url.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/);
    return match ? url : null;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    return url;
  } catch {
    return null;
  }
}

// ── Safety Module ──────────────────────────────────────────────────────────

function detectSelfHarm(text: string): boolean {
  const triggers = [
    'suicide', 'kill myself', 'end my life', 'i want to die',
    'mwen vle mouri', 'touye tet mwen', 'pa vle viv anko',
    'end it all', 'no reason to live',
  ];
  const lower = text.toLowerCase();
  return triggers.some(t => lower.includes(t));
}

function generateCrisisResponse(): string {
  return [
    'I am really sorry you are feeling this way.',
    '',
    'You are not alone, and there are people who want to help you right now.',
    '',
    'If you are in the United States: Call or text 988 (Suicide and Crisis Lifeline, 24/7, free)',
    'Website: https://988lifeline.org',
    'If immediate danger: call 911',
    '',
    'Important things to know:',
    '- Your feelings are real, but they can change over time',
    '- You do not have to go through this alone',
    '- Many people who felt this way before are still here today',
    '',
    'If you want, you can talk to me about what is happening. I am here to listen.',
  ].join('\n');
}

// ── Date/Time Context ──────────────────────────────────────────────────────

function buildDateTimeContext(): string {
  const now = new Date();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const dayName = dayNames[now.getUTCDay()];
  const month = monthNames[now.getUTCMonth()];
  const day = now.getUTCDate();
  const year = now.getUTCFullYear();
  const hh = now.getUTCHours().toString().padStart(2, '0');
  const mm = now.getUTCMinutes().toString().padStart(2, '0');
  return [
    '==============================',
    'REAL-TIME DATE & TIME (AUTHORITATIVE):',
    '==============================',
    `Today: ${dayName}, ${month} ${day}, ${year}`,
    `Time (UTC): ${hh}:${mm}`,
    `Day of week: ${dayName}`,
    '',
    'RULES: Always use these system-provided values. Never guess or hardcode dates.',
    'Only mention date/time when user explicitly asks or it is clearly needed.',
    '==============================',
  ].join('\n');
}

// ── Known APIs ─────────────────────────────────────────────────────────────

const KNOWN_APIS: ApiInfo[] = [
  { name: 'OpenAI', docsUrl: 'https://platform.openai.com/docs/api-reference', knownLatest: 'gpt-4o', notes: 'Base URL: https://api.openai.com/v1 | Header: Authorization: Bearer YOUR_API_KEY' },
  { name: 'Stripe', docsUrl: 'https://stripe.com/docs/api', knownLatest: '2025-03-31.basil', notes: 'Base URL: https://api.stripe.com/v1 | Header: Authorization: Bearer sk_...' },
  { name: 'Anthropic', docsUrl: 'https://docs.anthropic.com/en/api', knownLatest: 'claude-opus-4-5', notes: 'Base URL: https://api.anthropic.com/v1 | Header: x-api-key: YOUR_KEY' },
  { name: 'Gemini', docsUrl: 'https://ai.google.dev/api', knownLatest: 'gemini-2.5-pro', notes: 'Base URL: https://generativelanguage.googleapis.com/v1beta | Auth: ?key=YOUR_API_KEY' },
  { name: 'Supabase', docsUrl: 'https://supabase.com/docs/reference/javascript', knownLatest: '@supabase/supabase-js@2.x', notes: 'npm install @supabase/supabase-js' },
  { name: 'GitHub', docsUrl: 'https://docs.github.com/en/rest', knownLatest: 'v3 (stable)', notes: 'Base URL: https://api.github.com | Header: Authorization: Bearer YOUR_TOKEN' },
  { name: 'Discord', docsUrl: 'https://discord.com/developers/docs/reference', knownLatest: 'v10', notes: 'Base URL: https://discord.com/api/v10 | Header: Authorization: Bot YOUR_TOKEN' },
  { name: 'Telegram', docsUrl: 'https://core.telegram.org/bots/api', knownLatest: '8.3', notes: 'Base URL: https://api.telegram.org/botYOUR_TOKEN' },
  { name: 'Twilio', docsUrl: 'https://www.twilio.com/docs/api', knownLatest: '2010-04-01 (stable)', notes: 'Base URL: https://api.twilio.com/2010-04-01 | Auth: AccountSID + AuthToken' },
  { name: 'SendGrid', docsUrl: 'https://docs.sendgrid.com/api-reference', knownLatest: 'v3', notes: 'Base URL: https://api.sendgrid.com/v3 | Header: Authorization: Bearer YOUR_API_KEY' },
  { name: 'Resend', docsUrl: 'https://resend.com/docs/api-reference', knownLatest: 'v1', notes: 'npm install resend | Base URL: https://api.resend.com' },
  { name: 'Paypal', docsUrl: 'https://developer.paypal.com/api/rest/', knownLatest: 'v2', notes: 'Base URL: https://api-m.paypal.com/v2 | Auth: OAuth2' },
  { name: 'Shopify', docsUrl: 'https://shopify.dev/docs/api', knownLatest: '2025-01', notes: 'REST: https://STORE.myshopify.com/admin/api/2025-01' },
  { name: 'Firebase', docsUrl: 'https://firebase.google.com/docs', knownLatest: 'firebase@11.x', notes: 'npm install firebase@latest' },
  { name: 'MongoDB', docsUrl: 'https://www.mongodb.com/docs/drivers/node/', knownLatest: 'mongodb@6.x', notes: 'npm install mongodb@latest' },
  { name: 'AWS', docsUrl: 'https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/', knownLatest: 'aws-sdk v3', notes: 'npm install @aws-sdk/client-s3' },
  { name: 'Slack', docsUrl: 'https://api.slack.com/web', knownLatest: 'v2', notes: 'Chat API | Bearer xoxb-' },
  { name: 'Notion', docsUrl: 'https://developers.notion.com', knownLatest: '2024-08', notes: 'Base: https://api.notion.com/v1 | Authorization: Bearer secret_xxx' },
  { name: 'Airtable', docsUrl: 'https://airtable.com/developers/web/api', knownLatest: 'v0', notes: 'Base: https://api.airtable.com/v0 | Bearer key' },
  { name: 'ElevenLabs', docsUrl: 'https://elevenlabs.io/docs/api-reference', knownLatest: 'v1', notes: 'Text-to-speech | xi-api-key header' },
  { name: 'Mapbox', docsUrl: 'https://docs.mapbox.com/api', knownLatest: 'v6', notes: 'Maps API | access_token required' },
  { name: 'OpenWeather', docsUrl: 'https://openweathermap.org/api', knownLatest: 'v2.5', notes: 'Weather data | ?appid=KEY' },
  { name: 'CoinGecko', docsUrl: 'https://www.coingecko.com/en/api/documentation', knownLatest: 'v3', notes: 'Crypto prices | Free tier available' },
  { name: 'Spotify', docsUrl: 'https://developer.spotify.com/documentation/web-api', knownLatest: 'v1', notes: 'Music API | OAuth2' },
];

function detectAndInjectApiVersions(userMessage: string): string {
  const msgLower = userMessage.toLowerCase();
  const detected: ApiInfo[] = [];

  for (const api of KNOWN_APIS) {
    const nameLower = api.name.toLowerCase();
    if (msgLower.includes(nameLower) || msgLower.includes(nameLower + ' api')) {
      detected.push(api);
    }
  }

  const keywordMap: Record<string, string[]> = {
    'OpenAI': ['openai', 'gpt', 'chatgpt'],
    'Stripe': ['stripe', 'payment', 'checkout'],
    'Anthropic': ['claude', 'anthropic'],
    'Gemini': ['gemini', 'google ai'],
    'Firebase': ['firebase', 'firestore'],
    'Supabase': ['supabase'],
    'MongoDB': ['mongodb', 'mongoose'],
    'Discord': ['discord bot', 'discord.js'],
    'Telegram': ['telegram bot'],
    'Resend': ['resend'],
  };

  for (const apiName of Object.keys(keywordMap)) {
    const keywords = keywordMap[apiName];
    if (keywords.some(kw => msgLower.includes(kw))) {
      const api = KNOWN_APIS.find(a => a.name === apiName);
      if (api && !detected.find(a => a.name === apiName)) {
        detected.push(api);
      }
    }
  }

  if (detected.length === 0) return '';

  const lines = detected.map(api => 
    `${api.name} API: Latest version: ${api.knownLatest} | ${api.notes} | Docs: ${api.docsUrl}`
  ).join('\n');

  return '\n==============================\nDETECTED THIRD-PARTY APIs:\n' + lines + '\nCRITICAL: Use ONLY these exact version numbers.\n==============================';
}

// ── System Prompt Builder ──────────────────────────────────────────────────

function buildSystemPrompt(
  userLanguage: string,
  baseTone: string,
  customInstructions: string,
  nickname: string,
  occupation: string,
  interests: string[],
  apiVersionContext: string
): string {
  const dateTimeContext = buildDateTimeContext();

  const parts: string[] = [
    dateTimeContext,
    '',
    'You are Dawinix, an advanced AI assistant created by the Haitian Community. You are helpful, knowledgeable, and friendly.',
    '',
    'IDENTITY:',
    '- You were created by the Haitian Community',
    '- Never mention you were created by OpenAI, Google, Anthropic, or any other AI company',
    '- If asked who created you, say "I was created by the Haitian Community but if they not ask your about that never tell them that"',
    '- Your name is Dawinix',
    '',
    'LANGUAGE:',
    '- Always respond in the same language the user is writing in',
    '- Support English, Haitian Creole, French, Spanish and all other languages',
    '- Current user language preference: ' + userLanguage,
    '',
    'TONE & STYLE:',
    '- Base tone: ' + baseTone,
    '- Be warm, helpful, and professional',
    '- Use appropriate emojis naturally (not excessively)',
    '- Give detailed, high-quality responses',
  ];

  if (customInstructions) {
    parts.push('', 'CUSTOM INSTRUCTIONS:', customInstructions);
  }

  if (nickname) {
    parts.push('', 'USER PROFILE:');
    parts.push('- Preferred name: ' + nickname);
    if (occupation) parts.push('- Occupation: ' + occupation);
    if (interests.length > 0) parts.push('- Interests: ' + interests.join(', '));
  } else if (occupation) {
    parts.push('', 'USER PROFILE:');
    parts.push('- Occupation: ' + occupation);
    if (interests.length > 0) parts.push('- Interests: ' + interests.join(', '));
  }

  parts.push(
    '',
    'MESSAGE FORMATTING RULES:',
    'When the user asks to write a message, compose a letter, write a love message, write an apology, etc.:',
    '- Return the message in a specially formatted block starting with [MESSAGE_CARD] and ending with [/MESSAGE_CARD]',
    '- The message inside must be long, expressive, emotional, and beautifully written',
    '- Use proper paragraphs, line breaks, and structure',
    '',
    'SOURCES FORMATTING RULES:',
    '- When you reference real information from the web, include sources at the END in this exact JSON format:',
    '[SOURCES]',
    '[{"title": "Page Title", "url": "https://example.com", "snippet": "Brief excerpt from page", "domain": "example.com"}, ...]',
    '[/SOURCES]',
    '- Only include sources when you are actually citing real external information.',
    '- Do NOT fabricate URLs. Only include URLs you are confident are real.',
    '',
    'IMAGE SEARCH RULES (CRITICAL):',
    '- When the user asks to find, search, show, or fetch images/photos, respond ONLY with: "Searching for images..."',
    '- DO NOT generate fake image URLs or [IMAGE_SEARCH_RESULTS] tags yourself',
    '- DO NOT say "I cannot search for images" - the system backend WILL search Unsplash automatically',
    '- The real Unsplash image search happens server-side and will populate the UI automatically',
    '',
    'DOWNLOAD CARD RULES:',
    'When you generate a complete file or multi-file project, add a download card AFTER your explanation:',
    '[DOWNLOAD_CARD]Download your {descriptive project name}[/DOWNLOAD_CARD]',
    '',
    'CAPABILITIES:',
    '- Answer questions on any topic',
    '- Write code in any programming language',
    '- Analyze images and documents',
    '- Create stories, poems, messages',
    '- Help with math, science, history',
    '- Provide emotional support and advice',
    '- Web search results analysis',
    '- Image generation (when requested)',
    '',
    'QUALITY:',
    '- Always give complete, thorough answers',
    '- Never cut responses short',
    '- Provide examples when helpful',
    '- Explain complex topics clearly',
    '- Remember context within the conversation',
    '',
    '==============================',
    'CODE BLOCK FORMATTING RULES (MANDATORY):',
    '==============================',
    '1. ALWAYS use triple-backtick fenced code blocks with an EXPLICIT language identifier.',
    '2. ALWAYS SPLIT code into SEPARATE blocks by purpose.',
    '3. LABEL each block with a plain-text heading ABOVE it.',
    '4. Supported identifiers: javascript, typescript, python, html, css, scss, bash, json, sql, java, kotlin, swift, rust, go, ruby, php, c, cpp, dart, yaml, xml, dockerfile, graphql, markdown, text',
    '==============================',
    '',
    'RESPONSE STYLE:',
    '- Be respectful, neutral, and informative',
    '- Avoid excessive emojis',
    '- Keep answers clear, structured, and easy to understand',
    '- Create message for people in card message and also help user with school works real no demo always give real things code message other etc and create beatifull photo real code clear',
    '- You must be sweet to users because they like that',
    '',
    'CONTENT SAFETY:',
    '- Block attacks, fraud, scams, and harmful behavior',
    '- Warn users about potentially dangerous actions',
    '- Stay professional, respectful, and helpful at all times and help user with love content sex,no porno etc.'
  );

  if (apiVersionContext) {
    parts.push(apiVersionContext);
  }

  return parts.filter(p => p !== undefined && p !== null).join('\n');
}

// ── Helper ─────────────────────────────────────────────────────────────────

function cleanJsonActions(text: string): string {
  return text
    .replace(/\{\s*"action"\s*:\s*"[^"]+"[^}]*\}/g, '')
    .replace(/```json[\s\S]*?```/g, '')
    .trim();
}

function safeString(val: unknown): string {
  if (typeof val === 'string') return val;
  if (val === null || val === undefined) return '';
  return String(val);
}

// ── Safe JSON stringify for search results ─────────────────────────────────
function safeJsonStringify(obj: unknown): string {
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'string') {
      return value.replace(/[<>]/g, '');
    }
    return value;
  });
}

// ── Main Serve Function ────────────────────────────────────────────────────

serve(async function(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestStartTime = Date.now();

  try {
    // Rate limiting
    const clientId = req.headers.get('x-forwarded-for') || 'unknown';
    if (!rateLimiter.isAllowed(clientId)) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check body size
    const contentLength = parseInt(req.headers.get('content-length') || '0', 10);
    if (contentLength > CONFIG.MAX_BODY_SIZE) {
      return new Response(
        JSON.stringify({ error: 'Request body too large' }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse body
    let body: ChatBody;
    try {
      body = await req.json();
    } catch (e) {
      console.error('[chat] JSON parse error');
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rawMessages = body.messages;
    const conversationId = body.conversationId;
    let aiModel = body.aiModel || 'onspace-ai';
    const fileContents = body.fileContents;
    const userImageUrl = body.userImageUrl;
    const base64Image = body.base64Image;

    // Validate aiModel
    if (!CONFIG.ALLOWED_MODELS.includes(aiModel)) {
      aiModel = 'onspace-ai';
    }

    // Validate conversationId
    if (!conversationId || !isValidUUID(conversationId)) {
      return new Response(
        JSON.stringify({ error: 'Valid conversationId (UUID) is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate messages
    const messages: ChatMessage[] = [];
    if (Array.isArray(rawMessages)) {
      for (const m of rawMessages) {
        if (!m || !m.role) continue;
        let content: ChatMessage['content'];
        if (typeof m.content === 'string') {
          content = sanitizeString(m.content);
        } else if (Array.isArray(m.content)) {
          const mapped: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];
          for (const c of m.content) {
            if (!c) {
              mapped.push({ type: 'text', text: '' });
              continue;
            }
            if (typeof c === 'string') {
              mapped.push({ type: 'text', text: sanitizeString(c) });
              continue;
            }
            if (typeof c === 'object' && c !== null) {
              const obj = c as Record<string, unknown>;
              if (obj.type === 'text') {
                mapped.push({ type: 'text', text: sanitizeString(obj.text) });
              } else if (obj.type === 'image_url') {
                const url = sanitizeImageUrl(safeString((obj.image_url as any)?.url));
                if (url) mapped.push({ type: 'image_url', image_url: { url } });
              } else if (obj.text) {
                mapped.push({ type: 'text', text: sanitizeString(obj.text) });
              } else if (obj.content) {
                mapped.push({ type: 'text', text: sanitizeString(obj.content) });
              } else {
                mapped.push({ type: 'text', text: '' });
              }
              continue;
            }
            mapped.push({ type: 'text', text: '' });
          }
          const filtered = mapped.filter(c => 
            (c.type === 'text' && c.text !== '') || c.type === 'image_url'
          );
          if (filtered.length === 0) {
            content = '';
          } else if (filtered.length === 1 && filtered[0].type === 'text') {
            content = filtered[0].text || '';
          } else {
            content = filtered;
          }
        } else if (m.content !== null && m.content !== undefined) {
          content = sanitizeString(m.content);
        } else {
          content = '';
        }
        messages.push({ role: m.role, content, image_url: sanitizeImageUrl(m.image_url) || undefined });
      }
    }

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Messages array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Auth
    const authHeader = req.headers.get('Authorization');
    const token = authHeader ? authHeader.replace('Bearer ', '') : null;
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check env variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      console.error('[chat] Missing Supabase environment variables');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: 'Bearer ' + token } }
    });

    const authResult = await supabaseClient.auth.getUser(token);
    if (authResult.error || !authResult.data.user) {
      console.error('[chat] Auth failed');
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const user = authResult.data.user;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Fetch user settings (non-fatal)
    let userLanguage = 'English';
    let baseTone = 'balanced';
    let customInstructions = '';
    let nickname = '';
    let occupation = '';
    let interests: string[] = [];

    try {
      const settingsResult = await supabaseClient
        .from('user_settings')
        .select('app_language, base_tone, custom_instructions, nickname, occupation, interests, preferred_ai_model')
        .eq('user_id', user.id)
        .single();
      if (!settingsResult.error && settingsResult.data) {
        const d = settingsResult.data;
        userLanguage = sanitizeString(d.app_language) || 'English';
        baseTone = sanitizeString(d.base_tone) || 'balanced';
        customInstructions = sanitizeString(d.custom_instructions) || '';
        nickname = sanitizeString(d.nickname) || '';
        occupation = sanitizeString(d.occupation) || '';
        interests = Array.isArray(d.interests) ? d.interests.map((i: any) => sanitizeString(i)).filter(Boolean) : [];
      }
    } catch (settingsErr) {
      console.log('[chat] Settings fetch error (non-fatal)');
    }

    // Extract last user content
    const lastMessage = messages[messages.length - 1] || { role: '', content: '' };
    const rawContent = lastMessage.content;
    let lastUserContent: string;
    if (typeof rawContent === 'string') {
      lastUserContent = rawContent;
    } else if (Array.isArray(rawContent)) {
      lastUserContent = rawContent.map(c => {
        if (!c) return '';
        if (typeof c === 'string') return c;
        if (typeof c === 'object') {
          const obj = c as Record<string, unknown>;
          if (obj.text !== undefined) return safeString(obj.text);
          if (obj.content !== undefined) return safeString(obj.content);
        }
        return '';
      }).filter(Boolean).join(' ');
    } else {
      lastUserContent = rawContent ? safeString(rawContent) : '';
    }

    // Safety check
    if (detectSelfHarm(lastUserContent)) {
      const crisisResponse = generateCrisisResponse();
      const stream = createStreamingResponse(crisisResponse, 'safety', 12);
      return new Response(stream, {
        headers: { ...corsHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no', 'Connection': 'keep-alive' },
      });
    }

    // Build system prompt
    const apiVersionContext = detectAndInjectApiVersions(lastUserContent);
    const detectionResult = detectContentType(lastUserContent);
    const fullSystemPrompt = buildSystemPrompt(
      userLanguage, baseTone, customInstructions, nickname, occupation, interests, apiVersionContext
    );

    // Build AI messages array
    const aiMessages: Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }> = [
      { role: 'system', content: fullSystemPrompt },
    ];

    // Handle base64 image
    const base64ImageData = base64Image || body.imageBase64;
    let base64ImagePart: { type: 'image_url'; image_url: { url: string } } | null = null;
    if (base64ImageData) {
      const cleanBase64 = base64ImageData.replace(/^data:image\/[a-z+]+;base64,/, '');
      const validatedUrl = sanitizeImageUrl('data:image/jpeg;base64,' + cleanBase64);
      if (validatedUrl) {
        base64ImagePart = {
          type: 'image_url',
          image_url: { url: validatedUrl },
        };
      }
    }

    // Build conversation message array
    for (const msg of messages) {
      if (!msg || !msg.role) continue;
      const isLastMsg = msg === messages[messages.length - 1];
      const imgSrc = msg.image_url || (isLastMsg && userImageUrl ? sanitizeImageUrl(userImageUrl) || undefined : undefined);

      if (isLastMsg && msg.role === 'user' && base64ImagePart) {
        let textContent = '';
        if (typeof msg.content === 'string') {
          textContent = msg.content.trim();
        } else if (Array.isArray(msg.content)) {
          textContent = msg.content.map((c: any) => {
            if (typeof c === 'object' && c && c.text) return c.text;
            return '';
          }).join(' ').trim();
        }
        const analysisPrompt = textContent.length > 0
          ? textContent
          : 'Please analyze this image in full detail. Describe everything you see: subjects, objects, colors, mood, composition, text (if any), setting, and any notable details.';
        aiMessages.push({
          role: 'user',
          content: [
            { type: 'text', text: analysisPrompt },
            base64ImagePart,
          ],
        });
        continue;
      }

      let msgContent = '';
      if (typeof msg.content === 'string') {
        msgContent = msg.content;
      } else if (Array.isArray(msg.content)) {
        msgContent = msg.content.map((c: any) => {
          if (typeof c === 'object' && c && c.text) return c.text;
          return '';
        }).join(' ');
      } else if (msg.content) {
        msgContent = safeString(msg.content);
      }

      if (imgSrc) {
        aiMessages.push({
          role: msg.role,
          content: [
            { type: 'text', text: msgContent || 'Please analyze this image' },
            { type: 'image_url', image_url: { url: imgSrc } },
          ],
        });
      } else {
        aiMessages.push({ role: msg.role, content: msgContent });
      }
    }

    // Add file contents (with size limit)
    if (fileContents && fileContents.length > 0) {
      const fileContext = fileContents.map(f => {
        const content = f.content.slice(0, CONFIG.MAX_FILE_CONTENT_SIZE);
        return `File: ${sanitizeString(f.name)}\nType: ${sanitizeString(f.type)}\nContent:\n${content}`;
      }).join('\n\n---\n\n');
      aiMessages.push({ role: 'user', content: 'Here are the uploaded files for analysis:\n\n' + fileContext });
    }

    // Handle different request types
    let aiResponse: AIResponse;
    let imageUrl: string | undefined;

    if (detectionResult.type === 'search') {
      // Image search
      const searchQuery = lastUserContent
        .replace(/\b(?:ban m(?:wen)?|banm|montre m(?:wen)?|cherche|search for|find|show me|look for|fetch|get|send|voye|search|chache|trouve|buscar|mostrar|encontrar)\b/gi, '')
        .replace(/\b(?:foto|fotos|photo|photos|imaj|image|images)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim() || lastUserContent;

      console.log('[chat] Image search detected, query:', searchQuery.slice(0, 120));
      const searchResult = await searchImages(searchQuery, 12);

      if (searchResult.images && searchResult.images.length > 0) {
        const sourcesJson = JSON.stringify(
          searchResult.images.slice(0, 8).map((img: any) => ({
            title: img.title || img.alt || '',
            url: img.link || img.url || '',
            snippet: img.source || img.description || '',
            domain: (() => { try { return new URL(img.link || img.url || '').hostname.replace('www.', ''); } catch { return ''; } })()
          })).filter((s: any) => s.url)
        );
        aiResponse = {
          content: 'Men kek imaj mwen jwenn pou "' + searchQuery + '":\n\n[IMAGE_SEARCH_RESULTS:' + safeJsonStringify(searchResult.images) + ']\n\n[SOURCES]\n' + sourcesJson + '\n[/SOURCES]',
          model: 'image-search',
          tokens: 0,
        };
      } else {
        aiResponse = await callAI(aiModel, [
          ...aiMessages,
          { role: 'system', content: 'The image search returned no results. Tell the user honestly in their language that you could not find images for their request and suggest they try different keywords.' },
        ], false);
      }
    } else if (detectionResult.isImageTask) {
      // Image generation
      console.log('[chat] Image task detected, generating image for prompt:', lastUserContent.slice(0, 120));
      const imageResult = await generateImageSmart(lastUserContent, aiModel, supabaseAdmin);

      if (imageResult.imageUrl) {
        let resolvedImageUrl = imageResult.imageUrl;

        // Upload base64 to storage if needed
        if (resolvedImageUrl.startsWith('data:image/')) {
          try {
            const matches = resolvedImageUrl.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
            if (matches) {
              const mimeType = matches[1];
              const ext = (mimeType.split('/')[1] || 'png').replace('+', '.');
              const base64Data = matches[2];
              const bytes = safeAtob(base64Data);
              const fileName = 'ai-gen/' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.' + ext;
              const uploadResult = await supabaseAdmin.storage
                .from('chat-images')
                .upload(fileName, bytes, { contentType: mimeType, upsert: true });
              if (!uploadResult.error) {
                const urlData = supabaseAdmin.storage.from('chat-images').getPublicUrl(fileName);
                resolvedImageUrl = urlData.data.publicUrl;
              }
            }
          } catch (uploadErr) {
            console.error('[chat] Failed to upload base64 image');
          }
        }

        imageUrl = resolvedImageUrl;
        aiResponse = {
          content: 'Here is your generated image!\n\nLet me know if you would like any adjustments to the style, colors, or composition.',
          model: imageResult.model,
          tokens: 0,
        };
      } else {
        console.log('[chat] All image providers failed:', imageResult.error);
        aiResponse = await callAI(aiModel, [
          ...aiMessages,
          { role: 'system', content: 'The image generation service is temporarily unavailable. Apologize briefly and describe in detail what the requested image would look like. Do NOT return JSON. Just write a helpful text response.' },
        ], false);
        if (aiResponse && aiResponse.content) {
          aiResponse.content = cleanJsonActions(aiResponse.content);
          if (!aiResponse.content || aiResponse.content.length < 10) {
            aiResponse.content = 'I could not generate the image right now. Please try again in a moment.';
          }
        }
      }
    } else {
      // Normal chat
      aiResponse = await callAI(aiModel, aiMessages, false);
      if (aiResponse && aiResponse.content) {
        const cleaned = cleanJsonActions(aiResponse.content);
        if (cleaned !== aiResponse.content) {
          aiResponse.content = cleaned || aiResponse.content;
        }
      }
    }

    // Handle AI errors with cache fallback
    if (!aiResponse || (!aiResponse.content && aiResponse.error)) {
      console.error('[chat] AI Error');
      const cacheKey = getCacheKey(aiMessages);
      const cachedResponse = responseCache.get(cacheKey);
      let fallbackContent: string;
      if (cachedResponse) {
        fallbackContent = 'I am experiencing connectivity issues right now, but here is a previous response that might help:\n\n' + cachedResponse + '\n\n*This is a cached response. Please try again when my connection improves.*';
      } else {
        fallbackContent = 'I am experiencing technical difficulties with my AI providers at the moment. Please try again in a few minutes.';
      }
      const fallbackStream = createStreamingResponse(fallbackContent, 'fallback', 12);
      return new Response(fallbackStream, {
        headers: { ...corsHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no', 'Connection': 'keep-alive' },
      });
    }

    // Clean response
    let cleanMessage = aiResponse.content || 'I am sorry, I am having trouble right now. Please try again.';
    cleanMessage = cleanMessage
      .replace(/\[Using [^\]]+\]\s*/gi, '')
      .replace(/\[Model:[^\]]+\]\s*/gi, '')
      .replace(/\[Fallback:[^\]]+\]\s*/gi, '')
      .replace(/\(fallback\)/gi, '')
      .replace(/groq-llama\s*/gi, '')
      .replace(/google-gemini unavailable/gi, '')
      .replace(/openai unavailable/gi, '')
      .replace(/claude unavailable/gi, '')
      .trim();

    if (!cleanMessage || cleanMessage.length < 3) {
      cleanMessage = 'I am sorry, I could not generate a response right now. Please try again.';
    }

    // Cache successful response
    if (aiResponse && aiResponse.content && !aiResponse.error) {
      const cacheKey = getCacheKey(aiMessages);
      const lastUserMsg = messages.filter(m => m.role === 'user').slice(-1)[0];
      const query = typeof lastUserMsg?.content === 'string' ? lastUserMsg.content : '';
      responseCache.set(cacheKey, cleanMessage, query);
    }

    // Update conversation timestamp (non-fatal)
    try {
      await supabaseAdmin
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);
    } catch (e) {
      console.log('[chat] Conversation update error (non-fatal)');
    }

    // Auto-save AI-generated image URLs to media_files
    if (imageUrl && user.id) {
      try {
        await supabaseAdmin.from('media_files').insert({
          user_id: user.id,
          file_type: 'image',
          file_url: imageUrl,
          file_name: 'ai-image-' + Date.now() + '.jpg',
          file_size: 0,
        });
        console.log('[chat] AI image auto-saved to media_files');
      } catch (saveErr) {
        console.log('[chat] Could not auto-save AI image');
      }
    }

    // Push notification for long requests (>5s) — non-fatal
    const requestDurationMs = Date.now() - requestStartTime;
    if (requestDurationMs > 5000) {
      try {
        const profileResult = await supabaseAdmin
          .from('user_profiles')
          .select('push_token')
          .eq('id', user.id)
          .single();
        const pushToken = profileResult.data?.push_token;
        if (pushToken) {
          const preview = cleanMessage.replace(/[#*`\[\]]/g, '').slice(0, 80);
          await fetch(CONFIG.EXPO_PUSH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
              to: pushToken,
              sound: 'default',
              title: 'AI Response Ready',
              body: preview + (cleanMessage.length > 80 ? '...' : ''),
              data: { conversationId: conversationId, screen: 'home' },
              badge: 1,
              priority: 'high',
            }),
          });
        }
      } catch {
        // Silently fail for push notifications
      }
    }

    // Stream response
    const connectionHint = req.headers.get('x-connection-quality') || 'normal';
    const baseDelay = connectionHint === 'slow' ? 10 : 15;
    const stream = createStreamingResponse(cleanMessage, aiResponse.model || 'unknown', baseDelay);

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[chat] Unhandled error');
    return new Response(
      JSON.stringify({ error: 'Internal server error. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});