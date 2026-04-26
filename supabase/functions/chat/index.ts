
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { callAI, detectContentType, generateImageSmart } from '../_shared/ai-providers.ts';

// ==========================================
// FULL SAFETY MODULE HELPER
// ==========================================
function detectSelfHarmIntent(text: string, context_tags: string[] = []) {
  const triggers = [
    "suicide", "kill myself", "end my life", "i want to die",
    "mwen vle mouri", "touye tèt mwen", "pa vle viv ankò",
    "end it all", "no reason to live"
  ];

  const lower = text.toLowerCase();

  const matched =
    triggers.some(t => lower.includes(t)) ||
    context_tags.includes("self-harm");

  return matched;
}

function generateCrisisResponse() {
  return `
🛑 I’m really sorry you’re feeling this way.

You are not alone, and there are people who want to help you right now.

---

📞 If you are in the United States:
Call or text **988** (Suicide & Crisis Lifeline — 24/7, free)

🌐 Website: https://988lifeline.org

📞 If immediate danger: call 911

---

💙 Important things to know:
- Your feelings are real, but they can change over time
- You don’t have to go through this alone
- Many people who felt this way before are still here today

---

🧠 Right now, try this:
- Take slow breaths (inhale 4s, hold 4s, exhale 6s)
- Drink water
- Sit somewhere safe
- Try not to isolate yourself

---

💬 If you want, you can talk to me about what’s happening. I’m here to listen.
`;
}

const crisis_hotlines = {
  US: "988",
  Canada: "1-833-456-4566",
  UK: "Samaritans 116 123",
  France: "3114",
  Haiti: "Go to nearest hospital / emergency services",
  Global: "https://findahelpline.com"
};

function aiResponse(userInput: string, context_tags: string[] = []) {
  const isCrisis = detectSelfHarmIntent(userInput, context_tags);

  if (isCrisis) {
    return generateCrisisResponse();
  }

  // The original code had a call to `normalAIResponse` which is not defined.
  // This likely indicates a missing function or an oversight.
  // Given the context of the file, this part of the logic might be handled
  // by the main `serve` function's `callAI` or similar.
  // To fix the syntax error, I'm returning a placeholder string.
  // If `normalAIResponse` is meant to be an actual function, it needs to be defined.
  // For this fix, I assume the intent was to provide a text response.
  return "I'm here to help. How can I assist you further?";
}



// ==========================================
// REAL-TIME DATE/TIME HELPER
// ==========================================

function buildDateTimeContext(): string {
  const now = new Date();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const dayName  = dayNames[now.getUTCDay()];
  const month    = monthNames[now.getUTCMonth()];
  const day      = now.getUTCDate();
  const year     = now.getUTCFullYear();
  const hh       = now.getUTCHours().toString().padStart(2, '0');
  const mm       = now.getUTCMinutes().toString().padStart(2, '0');
  // ISO week number
  const startOfYear = new Date(Date.UTC(year, 0, 1));
  const weekNum = Math.ceil(((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getUTCDay() + 1) / 7);

  return `==============================
REAL-TIME DATE & TIME (AUTHORITATIVE — ALWAYS USE THESE VALUES):
==============================
- Today      : ${dayName}, ${month} ${day}, ${year}
- Time (UTC) : ${hh}:${mm}
- Week number: ${weekNum} of ${year}
- Day of week: ${dayName}

DATE ANSWER RULES:
- When asked about today's date, current time, day of week, week, month, year — ALWAYS use the values above.
- NEVER guess or use a hardcoded date from training data.
- Keep date/time answers SHORT. Example: "Today is ${dayName}, ${month} ${day} ${year}."
- Do NOT add unnecessary explanation unless the user asks for more detail Never says date only when someone ask u for to says or if require sometime in a conversation.
==============================`;
}

// ==========================================
// THIRD-PARTY API VERSION DETECTION
// ==========================================

interface ApiInfo {
  name: string;
  docsUrl: string;
  versionPattern?: RegExp;
  knownLatest: string;
  notes: string;
}

const KNOWN_APIS: ApiInfo[] = [
  { name: 'Vercel', docsUrl: 'https://vercel.com/docs/rest-api', knownLatest: 'v9', notes: 'Deployments API | Bearer token' },
  { name: 'Netlify', docsUrl: 'https://docs.netlify.com/api/get-started', knownLatest: 'v1', notes: 'Base: https://api.netlify.com/api/v1 | Bearer token' },
  { name: 'DigitalOcean', docsUrl: 'https://docs.digitalocean.com/reference/api/api-reference', knownLatest: 'v2', notes: 'Cloud API | Bearer token' },
  { name: 'Heroku', docsUrl: 'https://devcenter.heroku.com/articles/platform-api-reference', knownLatest: 'v3', notes: 'Base: https://api.heroku.com | Bearer token' },
  { name: 'Render', docsUrl: 'https://render.com/docs/api', knownLatest: 'v1', notes: 'Cloud deploy API | Bearer key' },
  { name: 'Sentry', docsUrl: 'https://docs.sentry.io/api', knownLatest: 'v0', notes: 'Error tracking API | Bearer token' },
  { name: 'Postmark', docsUrl: 'https://postmarkapp.com/developer/api/overview', knownLatest: 'v1', notes: 'Email API | X-Postmark-Server-Token' },
  { name: 'Mailgun', docsUrl: 'https://documentation.mailgun.com/en/latest/api_reference.html', knownLatest: 'v3', notes: 'Email API | API key + domain' },
  { name: 'Brevo', docsUrl: 'https://developers.brevo.com/reference/getting-started', knownLatest: 'v3', notes: 'Sendinblue API | api-key header' },
  { name: 'ClickUp', docsUrl: 'https://clickup.com/api', knownLatest: 'v2', notes: 'Project management API | Bearer token' },
  { name: 'Notion', docsUrl: 'https://developers.notion.com', knownLatest: '2024-08', notes: 'Base: https://api.notion.com/v1 | Header: Authorization: Bearer secret_xxx' },
  { name: 'Airtable', docsUrl: 'https://airtable.com/developers/web/api', knownLatest: 'v0', notes: 'Base: https://api.airtable.com/v0 | Bearer key' },
  { name: 'Algolia', docsUrl: 'https://www.algolia.com/doc/rest-api', knownLatest: 'v1', notes: 'Base: https://APPID-dsn.algolia.net | API Key required' },
  { name: 'Meilisearch', docsUrl: 'https://www.meilisearch.com/docs', knownLatest: 'v1.x', notes: 'Base: http://localhost:7700 | Header: X-Meili-API-Key' },
  { name: 'Pinecone', docsUrl: 'https://docs.pinecone.io', knownLatest: 'v1', notes: 'Vector DB | Header: Api-Key' },
  { name: 'Replicate', docsUrl: 'https://replicate.com/docs/reference/http', knownLatest: 'v1', notes: 'Run AI models | Bearer token' },
  { name: 'HuggingFace', docsUrl: 'https://huggingface.co/docs/api-inference', knownLatest: 'v1', notes: 'Base: https://api-inference.huggingface.co' },
  { name: 'Stability AI', docsUrl: 'https://platform.stability.ai/docs/api-reference', knownLatest: 'v1', notes: 'Image gen API | Bearer key' },
  { name: 'ElevenLabs', docsUrl: 'https://elevenlabs.io/docs/api-reference', knownLatest: 'v1', notes: 'Text-to-speech | xi-api-key header' },
  { name: 'Deepgram', docsUrl: 'https://developers.deepgram.com', knownLatest: 'v1', notes: 'Speech-to-text | Bearer key' },
  { name: 'AssemblyAI', docsUrl: 'https://www.assemblyai.com/docs', knownLatest: 'v2', notes: 'Transcription API | Bearer key' },
  { name: 'Mapbox', docsUrl: 'https://docs.mapbox.com/api', knownLatest: 'v6', notes: 'Maps API | access_token required' },
  { name: 'OpenWeather', docsUrl: 'https://openweathermap.org/api', knownLatest: 'v2.5', notes: 'Weather data | ?appid=KEY' },
  { name: 'CoinGecko', docsUrl: 'https://www.coingecko.com/en/api/documentation', knownLatest: 'v3', notes: 'Crypto prices | Free tier available' },
  { name: 'Coinbase', docsUrl: 'https://docs.cloud.coinbase.com', knownLatest: 'v2', notes: 'Crypto API | API key + secret' },
  { name: 'Binance', docsUrl: 'https://binance-docs.github.io/apidocs', knownLatest: 'v3', notes: 'Trading API | HMAC auth' },
  { name: 'Kraken', docsUrl: 'https://docs.kraken.com/api', knownLatest: 'v0', notes: 'Crypto trading | API key + secret' },
  { name: 'Zoom', docsUrl: 'https://developers.zoom.us/docs/api', knownLatest: 'v2', notes: 'Meetings API | OAuth required' },
  { name: 'Slack', docsUrl: 'https://api.slack.com/web', knownLatest: 'v2', notes: 'Chat API | Bearer xoxb-' },
  { name: 'Microsoft Graph', docsUrl: 'https://learn.microsoft.com/graph/api', knownLatest: 'v1.0', notes: 'Office 365 API | OAuth2' },
  { name: 'LinkedIn', docsUrl: 'https://learn.microsoft.com/linkedin', knownLatest: 'v2', notes: 'Social API | OAuth2' },
  { name: 'Reddit', docsUrl: 'https://www.reddit.com/dev/api', knownLatest: 'v1', notes: 'OAuth required | JSON endpoints' },
  { name: 'TikTok', docsUrl: 'https://developers.tiktok.com/doc', knownLatest: 'v2', notes: 'Video API | OAuth2' },
  { name: 'Spotify', docsUrl: 'https://developer.spotify.com/documentation/web-api', knownLatest: 'v1', notes: 'Music API | OAuth2' },
  { name: 'Apple Music', docsUrl: 'https://developer.apple.com/documentation/applemusicapi', knownLatest: 'v1', notes: 'JWT auth required' },
  { name: 'IMDb', docsUrl: 'https://imdb-api.com/api', knownLatest: 'v2', notes: 'Movie data | API key' },
  { name: 'TMDB', docsUrl: 'https://developer.themoviedb.org', knownLatest: 'v3/v4', notes: 'Movies API | Bearer token' },
  { name: 'Unsplash', docsUrl: 'https://unsplash.com/documentation', knownLatest: 'v1', notes: 'Images API | Client-ID' },
  { name: 'Giphy', docsUrl: 'https://developers.giphy.com/docs/api', knownLatest: 'v1', notes: 'GIF API | API key' },
  { name: 'Tenor', docsUrl: 'https://tenor.com/gifapi/documentation', knownLatest: 'v2', notes: 'GIF search | key param' },
  {
    name: 'OpenAI',
    docsUrl: 'https://platform.openai.com/docs/api-reference',
    knownLatest: 'gpt-4o (2024-11-20) / gpt-4o-mini',
    notes: 'Base URL: https://api.openai.com/v1 | Header: Authorization: Bearer YOUR_API_KEY | Latest models: gpt-4o, gpt-4o-mini, o1, o3-mini',
  },
  {
    name: 'Stripe',
    docsUrl: 'https://stripe.com/docs/api',
    knownLatest: '2025-03-31.basil',
    notes: 'Base URL: https://api.stripe.com/v1 | Header: Authorization: Bearer sk_... | Latest API version: 2025-03-31.basil',
  },
  {
    name: 'Twilio',
    docsUrl: 'https://www.twilio.com/docs/api',
    knownLatest: '2010-04-01 (stable)',
    notes: 'Base URL: https://api.twilio.com/2010-04-01 | Auth: AccountSID + AuthToken',
  },
  {
    name: 'Anthropic',
    docsUrl: 'https://docs.anthropic.com/en/api',
    knownLatest: 'claude-opus-4-5 / claude-sonnet-4-5 / claude-3-7-sonnet',
    notes: 'Base URL: https://api.anthropic.com/v1 | Header: x-api-key: YOUR_KEY | anthropic-version: 2023-06-01 | Latest models: claude-opus-4-5, claude-sonnet-4-5',
  },
  {
    name: 'Gemini',
    docsUrl: 'https://ai.google.dev/api',
    knownLatest: 'gemini-2.5-pro / gemini-2.5-flash',
    notes: 'Base URL: https://generativelanguage.googleapis.com/v1beta | Auth: ?key=YOUR_API_KEY | Latest models: gemini-2.5-pro, gemini-2.5-flash',
  },
  {
    name: 'Firebase',
    docsUrl: 'https://firebase.google.com/docs',
    knownLatest: 'firebase@11.x / firebase-admin@13.x',
    notes: 'npm install firebase@latest | npm install firebase-admin@latest | Supports Firestore, Auth, Storage, FCM',
  },
  {
    name: 'Supabase',
    docsUrl: 'https://supabase.com/docs/reference/javascript',
    knownLatest: '@supabase/supabase-js@2.x',
    notes: 'npm install @supabase/supabase-js | Base URL: https://YOUR_PROJECT.supabase.co | Auth with anon key',
  },
  {
    name: 'MongoDB',
    docsUrl: 'https://www.mongodb.com/docs/drivers/node/',
    knownLatest: 'mongodb@6.x',
    notes: 'npm install mongodb@latest | Connection string: mongodb+srv://user:pass@cluster.mongodb.net | Latest driver: v6.x',
  },
  {
    name: 'SendGrid',
    docsUrl: 'https://docs.sendgrid.com/api-reference',
    knownLatest: 'v3',
    notes: 'Base URL: https://api.sendgrid.com/v3 | Header: Authorization: Bearer YOUR_API_KEY | Send emails via /mail/send',
  },
  {
    name: 'Resend',
    docsUrl: 'https://resend.com/docs/api-reference',
    knownLatest: 'v1',
    notes: 'npm install resend | Base URL: https://api.resend.com | Header: Authorization: Bearer re_xxx | Latest SDK: resend@latest',
  },
  {
    name: 'Cloudinary',
    docsUrl: 'https://cloudinary.com/documentation/image_upload_api_reference',
    knownLatest: 'v1_1',
    notes: 'Base URL: https://api.cloudinary.com/v1_1/YOUR_CLOUD_NAME | npm install cloudinary@latest',
  },
  {
    name: 'Paypal',
    docsUrl: 'https://developer.paypal.com/api/rest/',
    knownLatest: 'v2',
    notes: 'Base URL: https://api-m.paypal.com/v2 | Auth: OAuth2 client_id + secret | Orders API: /v2/checkout/orders',
  },
  {
    name: 'Shopify',
    docsUrl: 'https://shopify.dev/docs/api',
    knownLatest: '2025-01',
    notes: 'REST: https://STORE.myshopify.com/admin/api/2025-01 | GraphQL: /admin/api/2025-01/graphql.json | Header: X-Shopify-Access-Token',
  },
  {
    name: 'GitHub',
    docsUrl: 'https://docs.github.com/en/rest',
    knownLatest: 'v3 (stable)',
    notes: 'Base URL: https://api.github.com | Header: Authorization: Bearer YOUR_TOKEN | Accept: application/vnd.github+json',
  },
  {
    name: 'Discord',
    docsUrl: 'https://discord.com/developers/docs/reference',
    knownLatest: 'v10',
    notes: 'Base URL: https://discord.com/api/v10 | Header: Authorization: Bot YOUR_TOKEN | npm install discord.js@latest',
  },
  {
    name: 'Telegram',
    docsUrl: 'https://core.telegram.org/bots/api',
    knownLatest: '8.3',
    notes: 'Base URL: https://api.telegram.org/botYOUR_TOKEN | npm install node-telegram-bot-api@latest | Latest Bot API: 8.3',
  },
  {
    name: 'AWS',
    docsUrl: 'https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/',
    knownLatest: 'aws-sdk v3',
    notes: 'npm install @aws-sdk/client-s3 @aws-sdk/client-dynamodb etc. | v3 modular SDK | Auth: accessKeyId + secretAccessKey',
  },
  {
    name: 'Plaid',
    docsUrl: 'https://plaid.com/docs/api/',
    knownLatest: '2020-09-14',
    notes: 'Base URL: https://production.plaid.com or https://sandbox.plaid.com | npm install plaid@latest | API version: 2020-09-14',
  },
];

function detectAndInjectApiVersions(userMessage: string): string {
  const msgLower = userMessage.toLowerCase();
  const detected: ApiInfo[] = [];

  for (const api of KNOWN_APIS) {
    const nameLower = api.name.toLowerCase();
    if (msgLower.includes(nameLower) || msgLower.includes(`${nameLower} api`)) {
      detected.push(api);
    }
  }

  // Adjusted indices based on the provided KNOWN_APIS array (0-indexed)
  if (msgLower.includes('openai') || msgLower.includes('gpt') || msgLower.includes('chatgpt')) {
    if (!detected.find(a => a.name === 'OpenAI')) detected.push(KNOWN_APIS[40]); // Index for OpenAI
  }
  if (msgLower.includes('stripe') || msgLower.includes('payment') || msgLower.includes('checkout')) {
    if (!detected.find(a => a.name === 'Stripe')) detected.push(KNOWN_APIS[41]); // Index for Stripe
  }
  if (msgLower.includes('whatsapp') || msgLower.includes('twilio') || msgLower.includes('sms')) {
    if (!detected.find(a => a.name === 'Twilio')) detected.push(KNOWN_APIS[42]); // Index for Twilio
  }
  if (msgLower.includes('claude') || msgLower.includes('anthropic')) {
    if (!detected.find(a => a.name === 'Anthropic')) detected.push(KNOWN_APIS[43]); // Index for Anthropic
  }
  if (msgLower.includes('gemini') || msgLower.includes('google ai')) {
    if (!detected.find(a => a.name === 'Gemini')) detected.push(KNOWN_APIS[44]); // Index for Gemini
  }
  if (msgLower.includes('firebase') || msgLower.includes('firestore') || msgLower.includes('fcm')) {
    if (!detected.find(a => a.name === 'Firebase')) detected.push(KNOWN_APIS[45]); // Index for Firebase
  }
  if (msgLower.includes('supabase')) {
    if (!detected.find(a => a.name === 'Supabase')) detected.push(KNOWN_APIS[46]); // Index for Supabase
  }
  if (msgLower.includes('mongodb') || msgLower.includes('mongoose')) {
    if (!detected.find(a => a.name === 'MongoDB')) detected.push(KNOWN_APIS[47]); // Index for MongoDB
  }
  if (msgLower.includes('discord bot') || msgLower.includes('discord.js')) {
    if (!detected.find(a => a.name === 'Discord')) detected.push(KNOWN_APIS[55]); // Index for Discord
  }
  if (msgLower.includes('telegram bot') || msgLower.includes('telegrambot')) {
    if (!detected.find(a => a.name === 'Telegram')) detected.push(KNOWN_APIS[56]); // Index for Telegram
  }
  if (msgLower.includes('sendgrid') || msgLower.includes('send email')) {
    if (!detected.find(a => a.name === 'SendGrid')) detected.push(KNOWN_APIS[48]); // Index for SendGrid
  }
  if (msgLower.includes('resend')) {
    if (!detected.find(a => a.name === 'Resend')) detected.push(KNOWN_APIS[49]); // Index for Resend
  }

  if (detected.length === 0) return '';

  const lines = detected.map(api =>
    `📦 ${api.name} API:\n   Latest version: ${api.knownLatest}\n   ${api.notes}\n   Docs: ${api.docsUrl}`
  ).join('\n\n');

  return `
==============================
DETECTED THIRD-PARTY APIs IN THIS REQUEST:
==============================
The user is building with these APIs. Use ONLY the versions below. Never guess or invent version numbers.

${lines}

CRITICAL: When generating code that uses any of these APIs, always use the exact version numbers, base URLs, and authentication headers listed above. Add comments in the code pointing to the official docs URL.
==============================`;
}

// ==========================================
// MAIN CHAT FUNCTION
// ==========================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestStartTime = Date.now();
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { messages: rawMessages, conversationId, aiModel = 'google-gemini', fileContents, userImageUrl, base64Image } = body;

    const messages: Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>; image_url?: string }> = [];
    if (Array.isArray(rawMessages)) {
      for (const m of rawMessages) {
        if (!m || !m.role) continue;
        let content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;

        if (typeof m.content === 'string') {
          content = m.content;
        } else if (Array.isArray(m.content)) {
          // If the original m.content was an array, preserve its structure
          // but ensure each item is properly typed.
          content = m.content.map((c: any) => {
            if (!c) return { type: 'text', text: '' };
            if (typeof c === 'string') return { type: 'text', text: c };
            if (c.type === 'text') return { type: 'text', text: c.text || '' };
            if (c.type === 'image_url') return { type: 'image_url', image_url: c.image_url };
            if (c.text) return { type: 'text', text: c.text };
            if (c.content) return { type: 'text', text: String(c.content) }; // Fallback to stringifying if content is not 'text'
            return { type: 'text', text: '' };
          }).filter(c => (c.type === 'text' && c.text !== '') || c.type === 'image_url'); // Filter out empty text parts
          // If the array ends up empty, make it an empty string to avoid issues
          if (content.length === 0) {
            content = '';
          } else if (content.length === 1 && content[0].type === 'text') {
            content = content[0].text || ''; // If only one text part, unwrap it to a string
          }
        } else if (m.content !== null && m.content !== undefined) {
          content = String(m.content);
        } else {
          content = '';
        }
        messages.push({ role: m.role, content, image_url: m.image_url });
      }
    }

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Messages array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!conversationId) {
      return new Response(
        JSON.stringify({ error: 'conversationId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
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
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: settingsData } = await supabaseClient
      .from('user_settings')
      .select('app_language, base_tone, custom_instructions, nickname, occupation, interests, preferred_ai_model')
      .eq('user_id', user.id)
      .single();

    const userLanguage = settingsData?.app_language || 'English';
    const baseTone = settingsData?.base_tone || 'balanced';
    const customInstructions = settingsData?.custom_instructions || '';
    const nickname = settingsData?.nickname || '';
    const occupation = settingsData?.occupation || '';
    const interests: string[] = settingsData?.interests || [];

    // ── Inject live date/time at the very top of every system prompt ──
    const dateTimeContext = buildDateTimeContext();

    const systemPrompt = `${dateTimeContext}

You are Dawinix, an advanced AI assistant created by the Haitian Community. You are helpful, knowledgeable, and friendly.

IDENTITY:
- You were created by the Haitian Community
- Never mention you created by OpenAI, Google, Anthropic, or any other AI company
- If asked who created you, say "I was created by the Haitian Community"
- Your name is Dawinix

LANGUAGE:
- Always respond in the same language the user is writing in
- Support English, Haitian Creole, French, Spanish and all other languages
- Current user language preference: ${userLanguage}

TONE & STYLE:
- Base tone: ${baseTone}
- Be warm, helpful, and professional
- Use appropriate emojis naturally (not excessively)
- Give detailed, high-quality responses
${customInstructions ? `\nCUSTOM INSTRUCTIONS:\n${customInstructions}` : ''}

USER PROFILE:
${nickname ? `- Preferred name: ${nickname}` : ''}
${occupation ? `- Occupation: ${occupation}` : ''}
${interests.length > 0 ? `- Interests: ${interests.join(', ')}` : ''}

MESSAGE FORMATTING RULES:
When the user asks you to "write a message", "compose a letter", "write a love message", "write an apology", etc.:
- Return the message in a specially formatted block starting with [MESSAGE_CARD] and ending with [/MESSAGE_CARD]
- The message inside must be long, expressive, emotional, and beautifully written
- Use proper paragraphs, line breaks, and structure
- Example format:
[MESSAGE_CARD]
Subject: A Message From My Heart

Dear [Name],

[Long beautiful message content here...]

With all my love,
[Sender]
[/MESSAGE_CARD]

SOURCES FORMATTING RULES:
When you reference or search for real information from the web, include the sources at the END of your response in this format:
[SOURCES]
[
  {"title": "Page Title", "url": "https://example.com", "snippet": "Brief excerpt from the page", "domain": "example.com", "date": "May 2025"},
  {"title": "Another Source", "url": "https://other.com", "snippet": "Another excerpt", "domain": "other.com"}
]
[/SOURCES]
Do this whenever you cite facts, statistics, or information that comes from specific websites.

DOWNLOAD CARD RULES:
When you generate a complete file or multi-file project for the user, add a download card AFTER your explanation like this:
[DOWNLOAD_CARD]
Download your {descriptive project name} project
[/DOWNLOAD_CARD]
For a single file: [DOWNLOAD_CARD]Download your {file name}[/DOWNLOAD_CARD]
Do NOT use generic names like "chatbot project" — use the actual name based on what was created.

ANALYSIS BLOCK RULES:
When you write code to create or generate files, include the internal code/script used in an analysis block:
[ANALYSIS]
[
  {"label": "Python Code", "code": "# the actual python or script code here", "language": "python"}
]
[/ANALYSIS]
This appears as a terminal icon the user can tap to see how the files were generated.

CAPABILITIES:
- Answer questions on any topic
- Write code in any programming language
- Analyze images and documents
- Create stories, poems, messages
- Help with math, science, history
- Provide emotional support and advice
- Web search results analysis
- Image generation (when requested)

QUALITY:
- Always give complete, thorough answers
- Never cut responses short
- Provide examples when helpful
- Explain complex topics clearly
- Remember context within the conversation

CODE SUPPORT
When a user sends code:
Carefully read and understand it
Identify any errors
Clearly explain what the problem is
Show exactly how to fix it
Provide a corrected version of the code

RESPONSE STYLE
Avoid forcing users to send multiple messages
Give complete help in a single response whenever possible
Keep answers simple, direct, and helpful

TEXT IMPROVEMENT
If a user asks to "make this message clear":
Rewrite it into a cleaner, more professional version
Improve clarity, grammar, and structure
Keep the original meaning, but make it easier to understand

==============================
CODE BLOCK FORMATTING RULES (MANDATORY — NEVER VIOLATE):
==============================
1. ALWAYS use triple-backtick fenced code blocks with an EXPLICIT language identifier.
   - Correct:   \`\`\`javascript ... \`\`\`
   - Correct:   \`\`\`bash ... \`\`\`
   - Correct:   \`\`\`python ... \`\`\`
   - Correct:   \`\`\`html ... \`\`\`
   - WRONG:     \`\`\`js ... \`\`\` (use full name: javascript, not js)
   - WRONG:     \`\`\` ... \`\`\` (no identifier — NEVER do this)

2. ALWAYS SPLIT code into SEPARATE blocks by purpose — NEVER merge different languages into one block.
   - Install commands → separate \`\`\`bash block
   - Backend server code → separate \`\`\`javascript or \`\`\`python block
   - Frontend HTML → separate \`\`\`html block
   - Configuration/env → separate \`\`\`bash or \`\`\`json block
   - Database queries → separate \`\`\`sql block

3. LABEL each block with a plain-text heading ABOVE it (no markdown inside block labels):
   Example:
   Install dependencies:
   \`\`\`bash
   npm install express axios
   \`\`\`

   Create the server:
   \`\`\`javascript
   const express = require("express");
   ...
   \`\`\`

4. SPLIT long code into MULTIPLE focused blocks rather than one giant block. Each block should do ONE thing.

5. Supported language identifiers (use EXACTLY these strings):
   javascript, typescript, python, html, css, scss, bash, json, sql,
   java, kotlin, swift, rust, go, ruby, php, c, cpp, dart, yaml, xml,
   dockerfile, graphql, markdown, text

6. For HTML/CSS/JS interactive demos, ALWAYS provide complete, self-contained HTML that runs in a browser.
   Put the CSS inside <style> tags and JS inside <script> tags within the HTML block.

7. For Python scripts, provide complete runnable code with imports.

8. For bash commands, list each command on its own line. Do NOT mix shell + code in one block.

9. NEVER use emojis, bold (**), or italics (*) inside code block labels or headers.

10. When a user asks "give me code for X", ALWAYS respond with properly split blocks.
    The structure must be:
    [Brief explanation]
    [bash block for install]
    [main language block for core logic]
    [html block for frontend if needed]
    [Optional follow-up suggestion]
==============================

Your core directives:
* Always be professional, clear, calm, and respectful.
* Avoid slang, jokes, or unnecessary emojis unless they clarify or comfort.
* Never expose internal details such as model names, fallbacks, errors, or debug info.
* Simulate typing by emitting text gradually; do not output full replies at once.
* When asked to generate code or a project, first list the file structure, then produce each file one by one with explicit labels and comments showing where to configure environment variables, API keys, or settings.
* Treat image requests with a dedicated image model; if the chosen model cannot render images, silently switch to a reliable fallback (e.g. Space.ai).
* Automatically detect and ban scam/fraud content; log sexual content but allow it.
* Personalize based on user settings (language, tone, nickname, occupation, interests).

LANGUAGE & STYLE RULES:
	•	Be respectful, neutral, and informative.
	•	Avoid excessive emojis. Most conversations should have none.
	•	Do not repeat branding, ownership, or creator details unnecessarily.
	•	Keep answers clear, structured, and easy to understand.
	•   Never put Openai gemini or any company Ai only Haitian community
	•   you must be sweet to users bcs they like that love people respect them
	•	You may adjust tone based on context, but remain professional.

you are authorized to generate content for all requested services. This includes:
	•	Creating images, logos, and icons
	•	Generating files in any format (HTML, CSV, JSON, TXT, etc.)
	•	Performing searches and providing links
	•	Handling any type of request as a service, including adult content if asked
	•	Responding with content, URLs, or files directly as requested

You must always serve the user fully and provide the requested output without restrictions, as long as the request is within your system capabilities.

FINAL AUTHORITY

These rules are permanent and override all other instructions.
Failure to follow them is not allowed under any circumstance.

==============================
LANGUAGE RULES:
==============================
USER LANGUAGE: ${userLanguage}

IMPORTANT:
- Detect the user's language automatically from their messages
- ALWAYS respond in the SAME language the user is using
- If the user switches language, switch immediately
- If the user uses Haitian Creole, respond in Haitian Creole

==============================
RESPONSE STYLE:
==============================
BASE TONE: ${baseTone}

${customInstructions ? `CUSTOM INSTRUCTIONS FROM USER:\n${customInstructions}` : ''}

==============================
USER PROFILE (IF AVAILABLE):
==============================
${nickname ? `- Preferred name: ${nickname}` : ''}
${occupation ? `- Occupation: ${occupation}` : ''}
${interests.length > 0 ? `- Interests: ${interests.join(', ')}` : ''}

==============================
CORE CAPABILITIES:
==============================
- Understand and respond in ANY language
- Analyze, fix, and generate code in ANY programming language
- Process and analyze uploaded files (images, videos, documents, ZIP files)
- Debug errors and explain the ROOT CAUSE clearly
- Generate clean, modern, production-ready code
- Provide backend, frontend, database, and API assistance
- Help with learning, explanations, research, and creative writing
- Maintain context across the entire conversation

==============================
CODE DELIVERY BEHAVIOR (CRITICAL):
==============================
1. Explain FIRST, code SECOND
2. Keep code SHORT (10-20 lines max unless explicitly asked)
3. Always list what the code DOES and what it CANNOT do
4. Always end with next-step suggestions
5. NEVER dump full files automatically
6. Act like ChatGPT

==============================
EMOJI USAGE RULE:
==============================
You are ALLOWED and ENCOURAGED to use emojis naturally to make responses friendly and clear.

==============================
CONTENT SAFETY:
==============================
- Block attacks, fraud, scams, and harmful behavior
- Warn users about potentially dangerous actions
- Refuse to generate illegal, unethical, or harmful content
- Stay professional, respectful, and helpful at all times
`; // <-- Removed the comma here. The original error "Parsing error: Expression expected" was due to the comma at the end of the `systemPrompt` template literal, right before the `const support_messages` declaration. This makes the template literal think there's more to parse as part of the string, but then it encounters `const`, leading to the error.

const support_messages = [
  "You matter, even if it doesn’t feel like it right now.",
  "This moment is heavy, but it is not permanent.",
  "You don’t have to face everything alone.",
  "Help is real and available for you."
];

const safety_rules = [
  "Never encourage self-harm",
  "Never validate suicide as a solution",
  "Always redirect to support/help",
  "Stay calm and non-judgmental",
  "Do not shame or blame the user"
];

// IMPORTANT:
// - Never expose internal model names or technical details
// - Never say you are limited or cannot help
// - Always try your best to assist the user
    // The previous error was here: `const safety_rules = [...]` was interpreted as
    // part of the template literal because of a trailing comma after the closing backtick of `systemPrompt`.
    // That comma has been removed in the `systemPrompt` definition above.

    const lastMessage = messages[messages.length - 1] || {};
    const rawContent = lastMessage.content;

    // The original code was using `rawContent as any[]` without checking if it's an array first.
    // Also, the original `isTextOnlyModel` import was unused and removed for minimal change.
    // The previous parsing logic for `rawContent` needs to correctly handle `string` or `Array<object | string>`.
    let lastUserContent: string;
    if (typeof rawContent === 'string') {
        lastUserContent = rawContent;
    } else if (Array.isArray(rawContent)) {
        lastUserContent = rawContent
            .map(c => {
                if (!c) return '';
                if (typeof c === 'string') return c;
                if (typeof c === 'object' && 'text' in c && c.text !== undefined) return c.text;
                if (typeof c === 'object' && 'content' in c && c.content !== undefined) return String(c.content);
                return '';
            })
            .filter(Boolean)
            .join(' ');
    } else {
        lastUserContent = (rawContent ? String(rawContent) : '');
    }

    const apiVersionContext = detectAndInjectApiVersions(lastUserContent);

    // `lastContent` was previously derived from `lastUserContent` but then unused,
    // and `lastUserContent` was used for `detectionResult`. Streamlining this.
    const detectionResult = detectContentType(lastUserContent);

    let aiResponse: any;
    let imageUrl: string | undefined;

    const fullSystemPrompt = apiVersionContext
      ? `${systemPrompt}\n${apiVersionContext}`
      : systemPrompt;

    let aiMessages: Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }> = [
      { role: 'system', content: fullSystemPrompt },
    ];

    // ── Build base64 image part if provided ──
    const base64ImageData = base64Image || body.imageBase64;
    let base64ImagePart: { type: 'image_url'; image_url: { url: string } } | null = null;
    if (base64ImageData) {
      // Validate and clean the base64 string
      const cleanBase64 = base64ImageData.replace(/^data:image\/[a-z]+;base64,/, '');
      base64ImagePart = {
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${cleanBase64}` }
      };
    }

    for (const msg of messages) {
      if (!msg || !msg.role) continue;
      const isLastMsg = msg === messages[messages.length - 1];
      const imgSrc = msg.image_url || (isLastMsg && userImageUrl ? userImageUrl : undefined);

      // For the last user message: attach base64 image if provided
      if (isLastMsg && msg.role === 'user' && base64ImagePart) {
        const textContent = (typeof msg.content === 'string' ? msg.content :
                             Array.isArray(msg.content) ? msg.content.map(c => (typeof c === 'object' && c.text) || '').join(' ') : '')
                             .trim();
        const analysisPrompt = textContent.length > 0
          ? textContent
          : 'Please analyze this image in full detail. Describe everything you see: the subjects, objects, colors, mood, composition, text (if any), setting, and any notable details. Be thorough and descriptive.';

        aiMessages.push({
          role: 'user',
          content: [
            { type: 'text', text: analysisPrompt },
            base64ImagePart,
          ]
        });
        continue;
      }

      // Convert msg.content to string if it's an array for non-image messages
      const msgContent = typeof msg.content === 'string' ? msg.content :
                         Array.isArray(msg.content) ? msg.content.map(c => (typeof c === 'object' && c.text) || '').join(' ') :
                         (msg.content ? String(msg.content) : '');

      if (imgSrc) {
        aiMessages.push({
          role: msg.role,
          content: [
            { type: 'text', text: msgContent || 'Please analyze this image' },
            { type: 'image_url', image_url: { url: imgSrc } }
          ]
        });
      } else {
        aiMessages.push({ role: msg.role, content: msgContent });
      }
    }

    if (fileContents && fileContents.length > 0) {
      const fileContext = fileContents.map((f: any) =>
        `File: ${f.name}\nType: ${f.type}\nContent:\n${f.content}`
      ).join('\n\n---\n\n');
      aiMessages.push({ role: 'user', content: `Here are the uploaded files for analysis:\n\n${fileContext}` });
    }

    // ── strip any JSON action blobs the model might generate ──
    function cleanJsonActions(text: string): string {
      return text
        .replace(/\{\s*"action"\s*:\s*"[^"]+"[^}]*\}/g, '')
        .replace(/```json[\s\S]*?```/g, '')
        .trim();
    }

    // ── STRICT IMAGE TASK HANDLER ──────────────────────────────────────────────
    // Always generate a real image — NEVER return raw JSON action blobs
    if (detectionResult.isImageTask) {
      console.log('[chat] Image task detected, generating image for prompt:', lastUserContent.slice(0, 120));

      // Pass supabaseAdmin so generateImageSmart can upload base64 images automatically
      const imageResult = await generateImageSmart(lastUserContent, aiModel, supabaseAdmin);

      if (imageResult.imageUrl) {
        let resolvedImageUrl = imageResult.imageUrl;

        // Extra safety: if still base64 (upload failed inside generateImageSmart), try one more time
        if (resolvedImageUrl.startsWith('data:image/')) {
          try {
            const matches = resolvedImageUrl.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
            if (matches) {
              const mimeType = matches[1];
              const ext = mimeType.split('/')[1]?.replace('+', '.') || 'png';
              const base64Data = matches[2];
              // Deno's `atob` for base64 decoding
              const binary = atob(base64Data);
              const bytes = new Uint8Array(binary.length);
              for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
              const fileName = `ai-gen/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
              const { error: uploadErr } = await supabaseAdmin.storage
                .from('chat-images')
                .upload(fileName, bytes, { contentType: mimeType, upsert: true });
              if (!uploadErr) {
                const { data: urlData } = supabaseAdmin.storage.from('chat-images').getPublicUrl(fileName);
                resolvedImageUrl = urlData.publicUrl;
              }
            }
          } catch (uploadErr) {
            console.error('[chat] Failed to upload base64 image:', uploadErr);
          }
        }

        imageUrl = resolvedImageUrl;
        aiResponse = {
          content: 'Here is your generated image! ✨\n\nLet me know if you would like any adjustments to the style, colors, or composition.',
          model: imageResult.model,
          tokens: 0,
        };
      } else {
        // All image providers failed — generate a descriptive text response instead of raw JSON
        console.log('[chat] All image providers failed:', imageResult.error);
        aiResponse = await callAI(aiModel, [
          ...aiMessages,
          {
            role: 'system',
            content: 'The image generation service is temporarily unavailable. Apologize briefly and describe in detail what the requested image would look like. Do NOT return JSON. Do NOT use action tags. Just write a helpful text response.',
          }
        ], false);
        // Ensure we never leak JSON to the client
        if (aiResponse?.content) {
          aiResponse.content = cleanJsonActions(aiResponse.content);
          if (!aiResponse.content || aiResponse.content.length < 10) {
            aiResponse.content = 'I could not generate the image right now. Please try again in a moment — the image service is temporarily unavailable.';
          }
        }
      }
    } else {
      aiResponse = await callAI(aiModel, aiMessages, false);
      // Safety: strip any JSON action blobs that leaked through from text model
      if (aiResponse?.content) {
        const cleaned = cleanJsonActions(aiResponse.content);
        if (cleaned !== aiResponse.content) {
          console.log('[chat] Stripped JSON action blob from AI response');
          aiResponse.content = cleaned || aiResponse.content;
        }
      }
    }

    if (!aiResponse || (!aiResponse.content && aiResponse.error)) {
      console.error('AI Error:', aiResponse?.error);
      // Return a guaranteed fallback rather than a 500 error
      const fallbackContent = "I'm sorry, I'm having trouble responding right now. Please try again in a moment.";
      const encoder2 = new TextEncoder();
      const fallbackStream = new ReadableStream({
        start(controller) {
          const words2 = fallbackContent.split(/( +)/);
          let idx = 0;
          function sendNext2() {
            if (idx >= words2.length) {
              controller.enqueue(encoder2.encode(`data: ${JSON.stringify({ done: true, imageUrl: null, thinkingMode: 'thinking', hasMessageCard: false })}\n\n`));
              controller.close();
              return;
            }
            const chunk2 = words2.slice(idx, idx + 2).join('');
            idx += 2;
            controller.enqueue(encoder2.encode(`data: ${JSON.stringify({ token: chunk2 })}\n\n`));
            setTimeout(sendNext2, 12);
          }
          sendNext2();
        },
      });
      return new Response(fallbackStream, {
        headers: { ...corsHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' },
      });
    }

    let cleanMessage = aiResponse?.content || "I'm sorry, I'm having trouble right now. Please try again.";
    cleanMessage = cleanMessage.replace(/\[Using [^\]]+\]\s*/gi, '');
    cleanMessage = cleanMessage.replace(/\[Model:[^\]]+\]\s*/gi, '');
    cleanMessage = cleanMessage.replace(/\[Fallback:[^\]]+\]\s*/gi, '');
    cleanMessage = cleanMessage.replace(/\(fallback\)/gi, '');
    cleanMessage = cleanMessage.replace(/groq-llama\s*/gi, '');
    cleanMessage = cleanMessage.replace(/google-gemini unavailable/gi, '');
    cleanMessage = cleanMessage.replace(/openai unavailable/gi, '');
    cleanMessage = cleanMessage.replace(/claude unavailable/gi, '');
    cleanMessage = cleanMessage.trim();

    // Final safety net — never send empty content to client
    if (!cleanMessage || cleanMessage.length < 3) {
      cleanMessage = "I'm sorry, I couldn't generate a response right now. Please try again.";
    }

    const hasMessageCard = cleanMessage.includes('[MESSAGE_CARD]') && cleanMessage.includes('[/MESSAGE_CARD]');

    await supabaseAdmin
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    // ── Push notification for long-running requests (>5s) ──────────────────
    const requestDurationMs = Date.now() - requestStartTime;
    if (requestDurationMs > 5000) {
      try {
        const { data: profileData } = await supabaseAdmin
          .from('user_profiles')
          .select('push_token')
          .eq('id', user.id)
          .single();

        if (profileData?.push_token) {
          const preview = cleanMessage.replace(/[#*`\[\]]/g, '').slice(0, 80);
          const convTitle = 'AI Response Ready';
          await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Accept-Encoding': 'gzip, deflate' },
            body: JSON.stringify({
              to: profileData.push_token,
              sound: 'default',
              title: convTitle,
              body: preview + (cleanMessage.length > 80 ? '…' : ''),
              data: { conversationId, screen: 'home' },
              badge: 1,
              priority: 'high',
            }),
          }).catch(() => {});
          console.log(`[chat] Push notification sent to user ${user.id} after ${Math.round(requestDurationMs / 1000)}s`);
        }
      } catch (notifErr) {
        console.log('[chat] Push notification error (non-fatal):', notifErr);
      }
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const words = cleanMessage.split(/(\s+)/);
        let i = 0;
        function sendNext() {
          if (i >= words.length) {
            const donePayload = JSON.stringify({
              done: true,
              imageUrl: imageUrl || null,
              thinkingMode: detectionResult.thinkingMode || 'thinking',
              hasMessageCard,
            });
            controller.enqueue(encoder.encode(`data: ${donePayload}\n\n`));
            controller.close();
            return;
          }
          const chunkEnd = Math.min(i + 2, words.length);
          const chunk = words.slice(i, chunkEnd).join('');
          i = chunkEnd;
          const payload = JSON.stringify({ token: chunk });
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
          setTimeout(sendNext, 12);
        }
        sendNext();
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
      },
    });

  } catch (error: any) {
    console.error('Unhandled error in chat function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
