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

interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  domain: string;
}

// ── Configuration ──────────────────────────────────────────────────────────

const CONFIG = {
  MAX_BODY_SIZE: 10 * 1024 * 1024,
  MAX_FILE_CONTENT_SIZE: 500 * 1024,
  CACHE_MAX_SIZE: 100,
  CACHE_TTL_MS: 30 * 60 * 1000,
  RATE_LIMIT_WINDOW_MS: 60 * 1000,
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

// ── Language Detector ──────────────────────────────────────────────────────

/**
 * Detect the primary language of a text string using character/word pattern matching.
 * Returns a human-readable label (e.g. "Haitian Creole", "French", "Spanish").
 */
function detectLanguage(text: string): string {
  if (!text || text.trim().length < 2) return 'English';
  const t = text.toLowerCase().trim();

  // ── Script-based detection (unambiguous) ──────────────────────────────
  if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(text)) return 'Chinese';
  if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return 'Japanese';
  if (/[\uac00-\ud7af]/.test(text)) return 'Korean';
  if (/[\u0600-\u06ff]/.test(text)) return 'Arabic';
  if (/[\u0900-\u097f]/.test(text)) return 'Hindi';
  if (/[\u0400-\u04ff]/.test(text)) return 'Russian';
  if (/[\u0370-\u03ff]/.test(text)) return 'Greek';
  if (/[\u0590-\u05ff]/.test(text)) return 'Hebrew';
  if (/[\u0e00-\u0e7f]/.test(text)) return 'Thai';
  if (/[\u0980-\u09ff]/.test(text)) return 'Bengali';
  if (/[\u0c00-\u0c7f]/.test(text)) return 'Telugu';
  if (/[\u0c80-\u0cff]/.test(text)) return 'Kannada';
  if (/[\u0d00-\u0d7f]/.test(text)) return 'Malayalam';
  if (/[\u0b80-\u0bff]/.test(text)) return 'Tamil';
  if (/[\u1000-\u109f]/.test(text)) return 'Burmese';
  if (/[\u1780-\u17ff]/.test(text)) return 'Khmer';
  if (/[\u10a0-\u10ff]/.test(text)) return 'Georgian';
  if (/[\u0530-\u058f]/.test(text)) return 'Armenian';

  // ── Haitian Creole — check first, highest priority ──────────────────
  const kreolWords = [
    'mwen','nou','ou','ap','pou','nan','se','ki','sa','pa','lè','gen',
    'fè','fe','ban','banm','kijan','kouman','kote','wè','kreyòl','ayiti',
    'bonjou','bonswa','mersi','souple','toujou','pran','vini','peyi',
    'alò','pitit','frè','sè','manman','papa','monchè','tchè','chèf',
    'grenn','piti','rele','rele','konnen','pwen','twò','anpil','menm',
    'jodi','demen','yè','kounye','depi','jouk','sou','avèk','epi','oswa',
    'ditès','poukisa','kisa','kilès','konbyen','ki kote','ki lè',
  ];
  const kreolScore = kreolWords.filter(w => {
    const re = new RegExp('\\b' + w + '\\b', 'i');
    return re.test(t);
  }).length;
  if (kreolScore >= 2) return 'Haitian Creole';

  // ── French ────────────────────────────────────────────────────────────
  const frWords = [
    'je','tu','il','elle','nous','vous','ils','elles','un','une','le','la',
    'les','de','du','des','est','sont','avec','pour','dans','que','qui',
    'au','aux','ce','cette','ces','mon','ton','son','ma','ta','sa',
    'bonjour','merci','oui','non','comment','quand','pourquoi','parce',
    'très','aussi','mais','donc','alors','comme','plus','moins','tout',
    'faire','avoir','être','aller','venir','voir','savoir','pouvoir',
    'vouloir','devoir','prendre','donner','parler','écrire','lire',
  ];
  const frScore = frWords.filter(w => new RegExp('\\b' + w + '\\b', 'i').test(t)).length;

  // ── Spanish ───────────────────────────────────────────────────────────
  const esWords = [
    'yo','tu','el','ella','nosotros','ellos','un','una','el','la','los',
    'las','de','del','en','con','por','para','que','no','si','como',
    'muy','bien','hola','gracias','sí','bueno','cuando','dónde','cómo',
    'quién','también','pero','esta','este','eso','puede','hacer','tener',
    'ser','estar','ir','venir','ver','saber','poder','querer','dar',
    'hablar','escribir','leer','decir','llevar','poner','salir','volver',
  ];
  const esScore = esWords.filter(w => new RegExp('\\b' + w + '\\b', 'i').test(t)).length;

  // ── Portuguese ────────────────────────────────────────────────────────
  const ptWords = [
    'eu','você','ele','ela','nós','eles','um','uma','o','a','os','as',
    'de','do','da','não','para','com','por','que','é','em','se',
    'obrigado','oi','olá','sim','como','também','muito','bom','dia',
    'fazer','ter','ser','estar','ir','vir','ver','saber','poder','querer',
  ];
  const ptScore = ptWords.filter(w => new RegExp('\\b' + w + '\\b', 'i').test(t)).length;

  // ── German ────────────────────────────────────────────────────────────
  const deWords = [
    'ich','du','er','sie','wir','ihr','ein','eine','der','die','das',
    'den','dem','und','oder','auch','nicht','ist','sind','haben','was',
    'wie','wo','danke','bitte','hallo','guten','ja','nein','kann','will',
    'muss','mit','von','zu','auf','für','aus','nach','bei','über','unter',
  ];
  const deScore = deWords.filter(w => new RegExp('\\b' + w + '\\b', 'i').test(t)).length;

  // ── Italian ───────────────────────────────────────────────────────────
  const itWords = [
    'io','tu','lui','lei','noi','loro','un','una','il','la','i','le',
    'del','della','non','con','per','che','ciao','grazie','prego','sì',
    'no','come','dove','quando','anche','tanto','fare','avere','essere',
  ];
  const itScore = itWords.filter(w => new RegExp('\\b' + w + '\\b', 'i').test(t)).length;

  // ── Turkish ───────────────────────────────────────────────────────────
  const trWords = [
    'ben','sen','o','biz','siz','onlar','ve','de','da','bu','var',
    'yok','gibi','için','ile','merhaba','teşekkür','evet','hayır','nasıl',
  ];
  const trScore = trWords.filter(w => new RegExp('\\b' + w + '\\b', 'i').test(t)).length;

  // ── Indonesian / Malay ────────────────────────────────────────────────
  const idWords = [
    'saya','kamu','dia','kami','kita','mereka','dan','atau','tidak',
    'yang','ini','itu','di','ke','dari','untuk','dengan','halo','ya',
  ];
  const idScore = idWords.filter(w => new RegExp('\\b' + w + '\\b', 'i').test(t)).length;

  // ── Vietnamese ────────────────────────────────────────────────────────
  const viWords = [
    'tôi','bạn','anh','chị','chúng','và','hoặc','không','của','là',
    'có','trong','cho','với','xin','chào','cảm','ơn','vâng',
  ];
  const viScore = viWords.filter(w => new RegExp('\\b' + w + '\\b', 'i').test(t)).length;

  // ── Dutch ─────────────────────────────────────────────────────────────
  const nlWords = [
    'ik','jij','hij','zij','wij','jullie','een','de','het','van',
    'en','of','niet','met','voor','in','op','aan','bij','tot',
    'hallo','dank','ja','nee','hoe','wat','waar','wanneer',
  ];
  const nlScore = nlWords.filter(w => new RegExp('\\b' + w + '\\b', 'i').test(t)).length;

  // ── Polish ────────────────────────────────────────────────────────────
  const plWords = [
    'ja','ty','on','ona','my','wy','oni','i','nie','tak','jest','są',
    'czy','jak','co','gdzie','kiedy','dzień','dobry','dziękuję','proszę',
  ];
  const plScore = plWords.filter(w => new RegExp('\\b' + w + '\\b', 'i').test(t)).length;

  // ── Pick the winner ───────────────────────────────────────────────────
  const scores: Array<[number, string]> = [
    [kreolScore, 'Haitian Creole'],
    [frScore,    'French'],
    [esScore,    'Spanish'],
    [ptScore,    'Portuguese'],
    [deScore,    'German'],
    [itScore,    'Italian'],
    [trScore,    'Turkish'],
    [idScore,    'Indonesian'],
    [viScore,    'Vietnamese'],
    [nlScore,    'Dutch'],
    [plScore,    'Polish'],
  ];
  scores.sort((a, b) => b[0] - a[0]);
  const [topScore, topLang] = scores[0];

  // Need at least 2 matching words to be confident
  if (topScore >= 2) return topLang;

  // Default: English
  return 'English';
}

/**
 * Build an absolute language-enforcement block placed at the very TOP
 * of the system prompt so the model reads it before everything else.
 */
function buildLanguageEnforcement(lang: string): string {
  return [
    '╔══════════════════════════════════════════════════════╗',
    '║     ABSOLUTE LANGUAGE RULE — HIGHEST PRIORITY         ║',
    '╚══════════════════════════════════════════════════════╝',
    '',
    'DETECTED USER LANGUAGE THIS TURN: ' + lang,
    '',
    'YOU MUST RESPOND EXCLUSIVELY IN: ' + lang.toUpperCase(),
    '',
    'RULES (NON-NEGOTIABLE):',
    '1. Match the EXACT language of the user message above.',
    '2. NEVER switch to English or any other language unless the user explicitly asks.',
    '3. Haitian Creole user -> respond 100% in Haitian Creole (Kreyol).',
    '4. French user -> respond 100% in French.',
    '5. Spanish user -> respond 100% in Spanish.',
    '6. Any other language -> respond in that same language.',
    '7. This rule overrides ALL other instructions, NO exceptions.',
    '',
    'YOUR ENTIRE RESPONSE MUST BE IN: ' + lang.toUpperCase(),
    '══════════════════════════════════════════════════════',
    '',
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

// ── URL Content Fetcher ───────────────────────────────────────────────────────

function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"']+/gi;
  const matches = text.match(urlRegex) || [];
  return matches.filter(u => !/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(u)).slice(0, 3);
}

function detectPlatform(url: string): 'tiktok' | 'youtube' | 'twitter' | 'instagram' | 'facebook' | 'web' {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes('tiktok.com') || host.includes('vm.tiktok.com')) return 'tiktok';
    if (host.includes('youtube.com') || host.includes('youtu.be')) return 'youtube';
    if (host.includes('twitter.com') || host.includes('x.com')) return 'twitter';
    if (host.includes('instagram.com')) return 'instagram';
    if (host.includes('facebook.com') || host.includes('fb.com') || host.includes('fb.watch')) return 'facebook';
  } catch (_e) {}
  return 'web';
}

async function fetchTikTokOEmbed(url: string): Promise<{ url: string; title: string; content: string; error?: string }> {
  try {
    const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
    const res = await fetch(oembedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DawinixBot/1.0)' },
      signal: AbortSignal.timeout(URL_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`TikTok oEmbed ${res.status}`);
    const data = await res.json();
    const title = data.title || 'TikTok Video';
    const author = data.author_name || data.author_url || '';
    const thumbnailUrl = data.thumbnail_url || '';
    const content = [
      `Platform: TikTok`,
      `Title: ${title}`,
      `Creator: ${author}`,
      ...(thumbnailUrl ? [`Thumbnail: ${thumbnailUrl}`] : []),
      `URL: ${url}`,
      `Description: This is a TikTok video titled "${title}" by ${author}. The video was shared at the provided URL.`,
    ].join('\n');
    return { url, title, content };
  } catch (err: any) {
    console.log('[TikTok oEmbed] Failed:', err.message);
    return { url, title: 'TikTok Video', content: `A TikTok video shared at ${url}. Unable to fetch metadata.`, error: err.message };
  }
}

async function fetchYouTubeOEmbed(url: string): Promise<{ url: string; title: string; content: string; error?: string }> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const res = await fetch(oembedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DawinixBot/1.0)' },
      signal: AbortSignal.timeout(URL_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`YouTube oEmbed ${res.status}`);
    const data = await res.json();
    const title = data.title || 'YouTube Video';
    const author = data.author_name || '';
    const thumbnailUrl = data.thumbnail_url || '';
    const content = [
      `Platform: YouTube`,
      `Title: ${title}`,
      `Channel: ${author}`,
      ...(thumbnailUrl ? [`Thumbnail: ${thumbnailUrl}`] : []),
      `URL: ${url}`,
      `Description: YouTube video titled "${title}" from channel "${author}".`,
    ].join('\n');
    return { url, title, content };
  } catch (err: any) {
    console.log('[YouTube oEmbed] Failed:', err.message);
    return { url, title: 'YouTube Video', content: `A YouTube video at ${url}. Unable to fetch metadata.`, error: err.message };
  }
}

async function fetchTwitterOEmbed(url: string): Promise<{ url: string; title: string; content: string; error?: string }> {
  try {
    const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=true`;
    const res = await fetch(oembedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DawinixBot/1.0)' },
      signal: AbortSignal.timeout(URL_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Twitter oEmbed ${res.status}`);
    const data = await res.json();
    const rawHtml = data.html || '';
    const textContent = rawHtml
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ').trim().slice(0, 1500);
    const author = data.author_name || '';
    const title = `Tweet by ${author}`;
    const content = [
      `Platform: Twitter/X`,
      `Author: ${author}`,
      `Content: ${textContent}`,
      `URL: ${url}`,
    ].join('\n');
    return { url, title, content };
  } catch (err: any) {
    console.log('[Twitter oEmbed] Failed:', err.message);
    return { url, title: 'Tweet', content: `A tweet/post at ${url}. Unable to fetch metadata.`, error: err.message };
  }
}

// Reduced URL fetch timeout (was 8s → 4s) to avoid chain timeouts causing 504
const URL_FETCH_TIMEOUT_MS = 4000;

async function fetchUrlContent(url: string): Promise<{ url: string; title: string; content: string; error?: string }> {
  const platform = detectPlatform(url);

  if (platform === 'tiktok') return fetchTikTokOEmbed(url);
  if (platform === 'youtube') return fetchYouTubeOEmbed(url);
  if (platform === 'twitter') return fetchTwitterOEmbed(url);

  if (platform === 'instagram' || platform === 'facebook') {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
          'Accept': 'text/html,*/*',
        },
        signal: AbortSignal.timeout(URL_FETCH_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] || '';
      const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1] || '';
      const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] || '';
      const ogSiteName = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)?.[1] || platform;
      const title = ogTitle || `${platform.charAt(0).toUpperCase() + platform.slice(1)} Post`;
      const content = [
        `Platform: ${ogSiteName || platform}`,
        `Title: ${title}`,
        ...(ogDesc ? [`Description: ${ogDesc}`] : []),
        ...(ogImage ? [`Thumbnail: ${ogImage}`] : []),
        `URL: ${url}`,
      ].join('\n');
      return { url, title, content };
    } catch (err: any) {
      return { url, title: `${platform} Post`, content: `A ${platform} post at ${url}. Unable to access content directly.`, error: err.message };
    }
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DawinixBot/1.0; +https://dawinix.com)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(URL_FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      return { url, title: '', content: `Unable to access this link (HTTP ${response.status}).`, error: `HTTP ${response.status}` };
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const json = await response.json();
      return { url, title: 'JSON Response', content: JSON.stringify(json).slice(0, 8000) };
    }

    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      return { url, title: '', content: `[File: ${contentType} at ${url}]` };
    }

    const html = await response.text();

    const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] || '';
    const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1] || '';
    const ogSiteName = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)?.[1] || '';
    const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] || '';
    const htmlTitle = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || '';
    const title = ogTitle || htmlTitle || url;

    const bodyText = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, ' ')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, ' ')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 8000);

    const parts = [
      ...(ogSiteName ? [`Site: ${ogSiteName}`] : []),
      `Title: ${title}`,
      ...(ogDesc ? [`Summary: ${ogDesc}`] : []),
      ...(ogImage ? [`Image: ${ogImage}`] : []),
      `URL: ${url}`,
      '',
      'Page content:',
      bodyText,
    ];

    return { url, title, content: parts.join('\n') };
  } catch (err: any) {
    return { url, title: '', content: `Unable to access this link right now. (${err.message})`, error: err.message };
  }
}

function buildUrlContext(results: Array<{ url: string; title: string; content: string; error?: string }>): string {
  const valid = results.filter(r => r.content && r.content.length > 10);
  if (valid.length === 0) return '';
  const lines = valid.map(r =>
    `[URL: ${r.url}]\n${r.error ? '(Partial metadata only — direct access was restricted)' : ''}\n${r.content}`
  ).join('\n\n---\n\n');
  return [
    '',
    '==============================',
    'REAL URL CONTENT FETCHED (use this to answer the user):',
    '==============================',
    lines,
    '==============================',
    'CRITICAL INSTRUCTIONS:',
    '- Use the above content to give a specific, intelligent answer about what is at this URL.',
    '- For TikTok/YouTube/Instagram/Twitter: describe the video/post, its creator, title, topic.',
    '- For websites/articles: summarize the main content, key points, and purpose of the page.',
    '- NEVER say "I cannot access this link" if you have content above.',
    '- NEVER generate a demo/example response. Use only the actual fetched data.',
    '- If access was partially restricted, say so briefly then describe what metadata you did get.',
    '==============================',
  ].join('\n');
}

function needsWebSearch(query: string): boolean {
  const lq = query.toLowerCase();
  const triggers = [
    'latest', 'recent', 'today', 'yesterday', 'this week', 'this month', 'right now',
    'current', 'breaking', 'news', 'update', 'announce', 'release', 'launch',
    'who is', 'who are', 'what is the latest', 'how much is', 'what happened', 'when did',
    'price of', 'stock price', 'bitcoin', 'crypto', 'market cap', 'rate', 'exchange rate',
    'weather', 'temperature', 'forecast',
    'score', 'championship', 'tournament', 'match result',
    'live', 'trending', 'viral', 'popular now',
    'denyè nouvel', 'kounye a', 'jodi a', 'nouvèl', 'ki prix', 'ki kob', 'nouvelles',
    "actualité", "aujourd'hui", "dernières nouvelles",
    'noticias', 'últimas noticias', 'hoy',
  ];
  return triggers.some(t => lq.includes(t));
}

async function performBraveSearch(query: string): Promise<{ results: WebSearchResult[]; error?: string }> {
  const apiKey = Deno.env.get('BRAVE_SEARCH_API_KEY');
  if (!apiKey) {
    console.log('[search] BRAVE_SEARCH_API_KEY not set');
    return { results: [] };
  }

  try {
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5&search_lang=en&result_filter=web`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey,
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => response.statusText);
      console.log(`[search] Brave error (${response.status}): ${errText.slice(0, 160)}`);
      return { results: [], error: `Brave Search error: ${response.status}` };
    }

    const data = await response.json();
    const webResults: Array<{ title: string; url: string; description: string }> = data.web?.results || [];

    if (webResults.length === 0) return { results: [] };

    const results: WebSearchResult[] = webResults.slice(0, 5).map(r => {
      let domain = '';
      try { domain = new URL(r.url).hostname.replace('www.', ''); } catch {}
      return { title: r.title || '', url: r.url || '', snippet: r.description || '', domain };
    }).filter(r => r.url && r.title);

    console.log(`[search] Brave returned ${results.length} results for: ${query.slice(0, 60)}`);
    return { results };
  } catch (err: any) {
    console.error('[search] Brave exception:', err.message);
    return { results: [], error: err.message };
  }
}

function buildSearchContext(results: WebSearchResult[]): string {
  if (results.length === 0) return '';
  const lines = results.map((r, i) =>
    `[${i + 1}] ${r.title}\nURL: ${r.url}\nSnippet: ${r.snippet}`
  ).join('\n\n');
  return [
    '',
    '==============================',
    'LIVE WEB SEARCH RESULTS (use these to answer accurately):',
    '==============================',
    lines,
    '==============================',
    'INSTRUCTIONS: Synthesize the above results into a clear helpful answer.',
    'At the END of your response append a [SOURCES] block with the sources you cited.',
    'Format: [SOURCES][{"title":"...","url":"...","snippet":"...","domain":"..."},...][/SOURCES]',
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

// ── Coding Assistant Detector ────────────────────────────────────────────────

type CodingTaskType = 'debug' | 'review' | 'test' | 'docs' | 'refactor' | 'general_code' | null;

function detectCodingTaskType(text: string): CodingTaskType {
  const t = text.toLowerCase();

  // Debug / fix
  if (
    /\b(debug|fix( this)?|bug|error|exception|crash|not working|broken|issue|problem|why (is|does|am)|what('s| is) wrong|help me fix|doesn't work|throws?|stack ?trace|traceback)\b/.test(t)
  ) return 'debug';

  // Code review
  if (
    /\b(review( this| my| the)?( code)?|check( this| my)? code|code review|look at( this| my) code|is this (good|correct|right|ok)|improve( this| my| the) code|any (issues|problems|bugs) (in|with) (this|my) code)\b/.test(t)
  ) return 'review';

  // Unit tests
  if (
    /\b(write (unit )?tests?|generate tests?|test(ing)? (this|my|the) (code|function|class|method)|add tests?|create tests?|unit test|jest|pytest|junit|mocha|vitest|test coverage)\b/.test(t)
  ) return 'test';

  // API docs
  if (
    /\b(api (docs?|documentation)|document(ation)? (this|my|the|for) (api|endpoint|route|function)|write docs?|generate docs?|openapi|swagger|postman collection|jsdoc|typedoc)\b/.test(t)
  ) return 'docs';

  // Refactor
  if (
    /\b(refactor|clean( up)?|improve (code )?quality|optimize( this| my| the)?( code)?|restructure|rewrite (this|my|the)?( code)?|make (this|it) (cleaner|better|more readable)|simplify)\b/.test(t)
  ) return 'refactor';

  // General coding request
  if (
    /\b(write|create|build|make|generate|code|program|implement|develop|script)\b/.test(t) &&
    /\b(function|class|component|app|application|api|server|bot|website|page|script|module|library|util|helper|hook|service|endpoint|query|schema|model|controller|middleware|algorithm|data structure)\b/.test(t)
  ) return 'general_code';

  return null;
}

function buildCodingAssistantPrompt(taskType: CodingTaskType): string {
  if (!taskType || taskType === 'general_code') return '';

  const sections: string[] = [
    '',
    '==============================',
    'CODING ASSISTANT MODE ACTIVATED:',
    '==============================',
  ];

  if (taskType === 'debug') {
    sections.push(
      'You are a senior software engineer with 15+ years debugging production systems.',
      '',
      'When debugging code, ALWAYS provide:',
      '1. Root cause analysis — explain exactly WHY the bug occurs',
      '2. Step-by-step breakdown of the failure path',
      '3. Corrected, complete, production-ready code with inline comments on what changed',
      '4. Preventive measures — how to avoid similar bugs in the future',
      '5. Testing recommendations — how to verify the fix works',
      '',
      'FORMAT YOUR RESPONSE AS:',
      '- Start with a plain-text explanation of the root cause (NO code block yet)',
      '- Then show the corrected code in a properly labelled code block',
      '- After the code block, write a plain-text "What changed:" section explaining each fix',
      '- End with plain-text "Prevention tips:" and "How to test:" sections',
      '- NEVER put explanation text INSIDE the code block',
    );
  } else if (taskType === 'review') {
    sections.push(
      'You are a senior engineer conducting thorough code reviews.',
      '',
      'Review the code comprehensively. Check for:',
      '1. Bugs — logic errors, edge cases, missing null checks',
      '2. Security — vulnerabilities, injection risks, auth issues, exposed secrets',
      '3. Performance — inefficiencies, memory leaks, N+1 queries, blocking calls',
      '4. Readability — naming, structure, comments, DRY violations',
      '5. Best practices — design patterns, SOLID principles, proper error handling',
      '',
      'FORMAT YOUR RESPONSE AS:',
      '- Start with a plain-text summary of overall code quality',
      '- List issues using: 🔴 Critical (must fix) | 🟡 Suggestions (should consider) | 🟢 What is done well',
      '- Each issue: plain-text title + plain-text explanation',
      '- If refactored code is needed, show it in a code block AFTER all plain-text issues',
      '- After the code block, write a plain-text "Changes made:" section',
      '- NEVER mix issue lists inside code blocks',
    );
  } else if (taskType === 'test') {
    sections.push(
      'You are a test-driven development expert.',
      '',
      'Generate comprehensive unit tests. Cover:',
      '1. All public functions and methods',
      '2. Happy path (valid inputs, expected outputs)',
      '3. Edge cases (empty, null, boundary values)',
      '4. Error conditions (invalid input, thrown errors)',
      '5. Async behavior with proper await/mock patterns',
      '',
      'FORMAT YOUR RESPONSE AS:',
      '- Start with a plain-text intro: what framework is used, what is being tested, coverage goal',
      '- Show the complete test file in a single properly-labelled code block',
      '- After the code block, write a plain-text "Test breakdown:" section listing each test group and what it covers',
      '- End with plain-text "How to run:" with the exact command',
      '- NEVER describe individual tests outside the code block in code format',
    );
  } else if (taskType === 'docs') {
    sections.push(
      'You are a technical writer specializing in API and code documentation.',
      '',
      'For each function/endpoint/module, document:',
      '1. Purpose and description',
      '2. Parameters (name, type, required, description)',
      '3. Return value (type, structure)',
      '4. Example usage',
      '5. Error cases',
      '',
      'FORMAT YOUR RESPONSE AS:',
      '- Start with a plain-text overview of what the documented API/code does',
      '- Show any schema, interface definitions, or OpenAPI snippets in code blocks',
      '- After each code block, write plain-text explanations of each parameter/return value',
      '- End with plain-text usage examples and plain-text notes on edge cases',
      '- NEVER put descriptive text inside code blocks',
    );
  } else if (taskType === 'refactor') {
    sections.push(
      'You are a refactoring expert who improves code quality without changing behavior.',
      '',
      'When refactoring, analyze and improve:',
      '1. Code structure and organization (single responsibility)',
      '2. Naming conventions (clear, descriptive, consistent)',
      '3. DRY violations (extract repeated logic)',
      '4. Design pattern opportunities',
      '5. Type safety and null safety',
      '6. Error handling completeness',
      '7. Testability (dependency injection, pure functions)',
      '',
      'FORMAT YOUR RESPONSE AS:',
      '- Start with a plain-text "Issues found:" section listing what needs improvement',
      '- Show the refactored code in a properly-labelled code block',
      '- After the code block, write a plain-text "Changes explained:" section for each major change',
      '- End with plain-text "Testing recommendations:" section',
      '- NEVER put the list of issues inside the code block',
    );
  }

  sections.push(
    '',
    'UNIVERSAL CODING RESPONSE RULES (HIGHEST PRIORITY):',
    '- ALL explanations, analysis, summaries, and descriptions MUST be plain text OUTSIDE code blocks',
    '- Code blocks contain ONLY executable code — no comments explaining the response, no prose',
    '- After EVERY code block, write a plain-text explanation section in the chat',
    '- Structure: [plain-text intro] → [code block] → [plain-text explanation] → [plain-text next steps]',
    '- NEVER show raw code directly in the chat message without a code block',
    '- NEVER end your response with a code block — always follow it with plain-text explanation',
    '==============================',
  );

  return sections.join('\n');
}

// ── System Prompt Builder ──────────────────────────────────────────────────

function buildSystemPrompt(
  userLanguage: string,
  baseTone: string,
  customInstructions: string,
  nickname: string,
  occupation: string,
  interests: string[],
  apiVersionContext: string,
  detectedLanguage: string,
  codingTaskType?: CodingTaskType
): string {
  const langEnforcement = buildLanguageEnforcement(detectedLanguage);
  const dateTimeContext = buildDateTimeContext();

  const parts: string[] = [
    // Language enforcement FIRST — model reads this before anything else
    langEnforcement,
    dateTimeContext,
    '',
    'You are Dawinix, an advanced AI assistant created by the Haitian Community. You are helpful, knowledgeable, and friendly.',
    '',
    'IDENTITY:',
    '- You were created by the Haitian Community',
    '- Never mention you were created by OpenAI, Google, Anthropic, or any other AI company',
    '- If asked who created you, say: I was created by the Haitian Community',
    '- Your name is Dawinix',
    '- You have deep knowledge of all world cultures, idioms, and colloquialisms',
    '- For Haitian Creole specifically: use proper Haitian Creole grammar, NOT French',
    '',
    'LANGUAGE (CRITICAL — READ CAREFULLY):',
    '- ALWAYS respond in the EXACT same language the user is writing in RIGHT NOW',
    '- Detected language this turn: ' + detectedLanguage,
    '- YOU MUST RESPOND IN: ' + detectedLanguage.toUpperCase(),
    '- If user writes in Haitian Creole → respond entirely in Haitian Creole',
    '- If user writes in French → respond entirely in French',
    '- If user writes in Spanish → respond entirely in Spanish',
    '- NEVER default to English unless the user is writing in English',
    '- User language preference setting: ' + userLanguage,
    '- Code-switching: if user mixes languages, respond in the dominant language',
    '- Only switch language if user explicitly asks to change language',
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
    '- Web search results analysis (real-time information)',
    '- Real-time translation between any of 250+ world languages',
    '- Multilingual understanding and response in any language',
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
    '3. After the ai generate a code explain to user what this code is or what this code can do or cannot do.',
    '4. Supported identifiers: javascript, typescript, python, html, css, scss, bash, json, sql, java, kotlin, swift, rust, go, ruby, php, c, cpp, dart, yaml, xml, dockerfile, graphql, markdown, text',
    '==============================',
    '',
    'RESPONSE STYLE:',
    '- Be respectful, neutral, and informative',
    '- Avoid excessive emojis',
    '- Keep answers clear, structured, and easy to understand',
    '- CODE GENERATION RULES (MANDATORY):',
    '  * ALWAYS write COMPLETE, REAL, PRODUCTION-READY code — never truncate, never use placeholders like "// add your logic here", "...", or "TODO".',
    '  * NEVER write fake or demo-only code. Every function, variable, and logic block must be real and working.',
    '  * Write ALL files needed. If the user asks for a webpage, provide full HTML + CSS + JS. If they ask for a backend, provide full server code.',
    '  * CODE BLOCK LINE LIMIT: Each individual code block MUST NOT exceed 800 lines. If the total code exceeds 800 lines, SPLIT it across multiple code blocks.',
    '  * When splitting code: label each block clearly with a heading like "Step 1: [Description]" or "Part 1/3: [Description]" ABOVE the code block as plain text.',
    '  * After EVERY code block (no exception), write a plain-text explanation outside the code block: what the code does, how each part works, and what to watch out for.',
    '  * Break large projects into clearly labeled sections or separate code blocks with a heading above each.',
    '  * List all required dependencies with install commands (e.g. npm install, pip install).',
    '  * If there are environment variables or API keys needed, clearly state what they are and where to put them.',
    '  * Mention how the user can extend or customize the code if relevant.',
    '  * NEVER say "Here is a simplified version" or "This is just an example" unless the user explicitly asked for a simplified demo.',
    '  * Write code as a senior developer would: clean structure, real logic, no filler.',
    '',
    '- When a user sends a URL (TikTok, YouTube, Instagram, Twitter/X, website, article, PDF): analyze the fetched content from the system context and give a real intelligent response. NEVER say you cannot access links when content is provided. NEVER generate fallback demo cards.',
    '- PROMPT_CARD RULES: When user asks for "a beautiful prompt", "give me a prompt", "write a prompt", "creative prompt", "generate a prompt", or any similar request for a reusable prompt/template, wrap the entire prompt content in [PROMPT_CARD]{"title":"...","subject":"...","body":"..."}[/PROMPT_CARD]. The body field must contain the full prompt text, properly formatted.',
    '- MULTI_BLOCK RULES: When the user asks to see images AND wants explanation, use [IMAGE_SEARCH:query] tags inline. Format: write text, then [IMAGE_SEARCH:query], then more text. Max 3 image blocks per response.',
    '- For TikTok links: Write your analysis text ONLY. At the very end, append ONE [TIKTOK_CARD] block. Format: [TIKTOK_CARD]{"title":"...","author":"...","thumbnail":"...","videoUrl":"..."}[/TIKTOK_CARD]',
    '- CRITICAL: NEVER say "Here is the [TIKTOK_CARD]" in text. Card block at END only, on its own line.',
    '- For YouTube: summarize the video title, channel, and what the video is about.',
    '- For Twitter/X: quote or summarize the tweet content and author.',
    '- For any link: always explain what the page/content is about based on the fetched data.',
    '- You must be sweet to users because they like that',
    '- SUPPORT MESSAGE RULES: When user asks for a "support message", "help ticket", "complaint letter", "email to support", wrap the result in [PROMPT_CARD]{"title":"Support Message","subject":"...","body":"..."}[/PROMPT_CARD].',
    '',
    'Personality:',
    '- You are a capable collaborator: approachable, steady, and direct.',
    '- Prefer making progress over stopping for clarification when the request is already clear enough.',
    '- Stay concise without becoming curt. Give enough context for the user to understand and trust the answer.',
    '- Match the user tone within professional bounds.',
    '',
    'CONTENT SAFETY:',
    '- Block attacks, fraud, scams, and harmful behavior',
    '- Warn users about potentially dangerous actions',
    '- Stay professional, respectful, and helpful at all times'
  );

  if (apiVersionContext) {
    parts.push(apiVersionContext);
  }

  // Coding assistant mode — injected when a coding task is detected
  if (codingTaskType && codingTaskType !== 'general_code') {
    const codingPrompt = buildCodingAssistantPrompt(codingTaskType);
    if (codingPrompt) parts.push(codingPrompt);
  }

  // Repeat language reminder at the END as well (double enforcement)
  parts.push(
    '',
    '══════════════════════════════════════════════════════',
    'FINAL REMINDER: Respond ONLY in ' + detectedLanguage.toUpperCase() + '. No English unless the user is writing in English.',
    '══════════════════════════════════════════════════════',
  );

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

function safeJsonStringify(obj: unknown): string {
  return JSON.stringify(obj, (_key, value) => {
    if (typeof value === 'string') {
      return value.replace(/[<>]/g, '');
    }
    return value;
  });
}

// ── Main Serve Function ────────────────────────────────────────────────────

Deno.serve(async function(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestStartTime = Date.now();

  try {
    const clientId = req.headers.get('x-forwarded-for') || 'unknown';
    if (!rateLimiter.isAllowed(clientId)) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const contentLength = parseInt(req.headers.get('content-length') || '0', 10);
    if (contentLength > CONFIG.MAX_BODY_SIZE) {
      return new Response(
        JSON.stringify({ error: 'Request body too large' }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let body: ChatBody;
    try {
      body = await req.json();
    } catch (_e) {
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

    if (!CONFIG.ALLOWED_MODELS.includes(aiModel)) {
      aiModel = 'onspace-ai';
    }

    // Allow guest-session and local- prefixed IDs in addition to valid UUIDs
    const isGuestConvId = typeof conversationId === 'string' && (conversationId.startsWith('guest-') || conversationId.startsWith('local-'));
    if (!conversationId || (!isValidUUID(conversationId) && !isGuestConvId)) {
      return new Response(
        JSON.stringify({ error: 'Valid conversationId (UUID) is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
            if (!c) { mapped.push({ type: 'text', text: '' }); continue; }
            if (typeof c === 'string') { mapped.push({ type: 'text', text: sanitizeString(c) }); continue; }
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

    const authHeader = req.headers.get('Authorization');
    const token = authHeader ? authHeader.replace('Bearer ', '') : null;
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    const isGuestToken = token === supabaseAnonKey;
    let user: any = null;
    if (!isGuestToken) {
      const authResult = await supabaseClient.auth.getUser(token);
      if (authResult.error || !authResult.data.user) {
        console.error('[chat] Auth failed');
        return new Response(
          JSON.stringify({ error: 'Invalid or expired token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      user = authResult.data.user;
    }
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    let userLanguage = 'English';
    let baseTone = 'balanced';
    let customInstructions = '';
    let nickname = '';
    let occupation = '';
    let interests: string[] = [];

    if (user) {
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
      } catch (_settingsErr) {
        console.log('[chat] Settings fetch error (non-fatal)');
      }
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

    // ── Detect the ACTUAL language of the user message ─────────────────────
    // Strip system tags before language detection so they don't skew results
    const cleanedForLangDetect = lastUserContent
      .replace(/\[SYSTEM[^\]]*\][\s\S]*?\n/gi, '')
      .replace(/\[SYSTEM RULES:[\s\S]*?\]\n*/i, '')
      .replace(/\[Replying to[^\]]*\]\n*/i, '')
      .trim();
    const detectedLanguage = detectLanguage(cleanedForLangDetect || lastUserContent);
    console.log('[chat] Detected language:', detectedLanguage, '| User preference:', userLanguage);

    // Build system prompt
    const apiVersionContext = detectAndInjectApiVersions(lastUserContent);
    const detectionResult = detectContentType(lastUserContent);
    const codingTaskType = detectCodingTaskType(lastUserContent);
    if (codingTaskType) console.log('[chat] Coding task detected:', codingTaskType);
    const fullSystemPrompt = buildSystemPrompt(
      userLanguage, baseTone, customInstructions, nickname, occupation, interests,
      apiVersionContext, detectedLanguage, codingTaskType
    );

    // ── URL Content Fetching ──────────────────────────────────────────────────
    let urlContext = '';
    const urlsInMessage = extractUrls(lastUserContent);
    if (urlsInMessage.length > 0 && detectionResult.type === 'text') {
      console.log('[chat] URL(s) detected, fetching content:', urlsInMessage);
      const urlResults = await Promise.all(urlsInMessage.map(fetchUrlContent));
      urlContext = buildUrlContext(urlResults);
      if (urlContext) console.log('[chat] URL content fetched for', urlResults.filter(r => !r.error).length, 'URL(s)');
    }

    // ── Live Web Search ──────────────────────────────────────────────────────
    let webSearchResults: WebSearchResult[] = [];
    let searchContext = '';
    if (
      detectionResult.type === 'text' &&
      !detectionResult.isImageTask &&
      urlsInMessage.length === 0 &&
      needsWebSearch(lastUserContent)
    ) {
      console.log('[chat] Web search triggered:', lastUserContent.slice(0, 80));
      const searchRes = await performBraveSearch(lastUserContent);
      webSearchResults = searchRes.results;
      searchContext = buildSearchContext(webSearchResults);
    }

    const effectiveSystemPrompt = urlContext
      ? fullSystemPrompt + urlContext
      : searchContext
      ? fullSystemPrompt + searchContext
      : fullSystemPrompt;

    const aiMessages: Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }> = [
      { role: 'system', content: effectiveSystemPrompt },
    ];

    // Handle base64 image
    const base64ImageData = body.base64Image || body.imageBase64;
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

    if (fileContents && fileContents.length > 0) {
      const fileContext = fileContents.map(f => {
        const content = f.content.slice(0, CONFIG.MAX_FILE_CONTENT_SIZE);
        return `File: ${sanitizeString(f.name)}\nType: ${sanitizeString(f.type)}\nContent:\n${content}`;
      }).join('\n\n---\n\n');
      aiMessages.push({ role: 'user', content: 'Here are the uploaded files for analysis:\n\n' + fileContext });
      console.log('[chat] File context added for', fileContents.length, 'file(s)');
    }

    let aiResponse: AIResponse;
    let imageUrl: string | undefined;

    if (detectionResult.type === 'search') {
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
      console.log('[chat] Image task detected, generating image for prompt:', lastUserContent.slice(0, 120));
      const imageResult = await generateImageSmart(lastUserContent, aiModel, supabaseAdmin);

      if (imageResult.imageUrl) {
        let resolvedImageUrl = imageResult.imageUrl;

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
          } catch (_uploadErr) {
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
    } else if (webSearchResults.length > 0) {
      // Skip expensive OpenAI preview augmentation — go straight to AI call to avoid 504
      aiResponse = await callAI(aiModel, aiMessages, false);
      if (aiResponse && aiResponse.content && !aiResponse.content.includes('[SOURCES]')) {
        const sourcesJson = JSON.stringify(
          webSearchResults.map(r => ({
            title: r.title,
            url: r.url,
            snippet: r.snippet,
            domain: r.domain,
          }))
        );
        aiResponse.content = aiResponse.content.trim() + '\n\n[SOURCES]\n' + sourcesJson + '\n[/SOURCES]';
      }
    } else {
      aiResponse = await callAI(aiModel, aiMessages, false);
      if (aiResponse && aiResponse.content) {
        const cleaned = cleanJsonActions(aiResponse.content);
        if (cleaned !== aiResponse.content) {
          aiResponse.content = cleaned || aiResponse.content;
        }
      }
    }

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

    if (aiResponse && aiResponse.content && !aiResponse.error && webSearchResults.length === 0) {
      const cacheKey = getCacheKey(aiMessages);
      const lastUserMsg = messages.filter(m => m.role === 'user').slice(-1)[0];
      const query = typeof lastUserMsg?.content === 'string' ? lastUserMsg.content : '';
      responseCache.set(cacheKey, cleanMessage, query);
    }

    try {
      if (user && !conversationId.startsWith('guest-') && !conversationId.startsWith('local-')) {
        await supabaseAdmin
          .from('conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', conversationId);
      }
    } catch (_e) {
      console.log('[chat] Conversation update error (non-fatal)');
    }

    if (imageUrl && user && user.id) {
      try {
        await supabaseAdmin.from('media_files').insert({
          user_id: user.id,
          file_type: 'image',
          file_url: imageUrl,
          file_name: 'ai-image-' + Date.now() + '.jpg',
          file_size: 0,
        });
        console.log('[chat] AI image auto-saved to media_files');
      } catch (_saveErr) {
        console.log('[chat] Could not auto-save AI image');
      }
    }

    const requestDurationMs = Date.now() - requestStartTime;
    if (requestDurationMs > 5000 && user && user.id) {
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
              data: { conversationId, screen: 'home' },
              badge: 1,
              priority: 'high',
            }),
          });
        }
      } catch {
        // Silent fail
      }
    }

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
    console.error('[chat] Unhandled error', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
