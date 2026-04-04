import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { callAI, detectContentType, generateImageSmart, isTextOnlyModel } from '../_shared/ai-providers.ts';

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

/**
 * Detect which third-party APIs are mentioned in the user message
 * and return a context string with their latest version info.
 */
function detectAndInjectApiVersions(userMessage: string): string {
  const msgLower = userMessage.toLowerCase();
  const detected: ApiInfo[] = [];

  for (const api of KNOWN_APIS) {
    const nameLower = api.name.toLowerCase();
    if (msgLower.includes(nameLower) || msgLower.includes(`${nameLower} api`)) {
      detected.push(api);
    }
  }

  // Extra keyword matches
  if (msgLower.includes('openai') || msgLower.includes('gpt') || msgLower.includes('chatgpt')) {
    if (!detected.find(a => a.name === 'OpenAI')) detected.push(KNOWN_APIS[0]);
  }
  if (msgLower.includes('stripe') || msgLower.includes('payment') || msgLower.includes('checkout')) {
    if (!detected.find(a => a.name === 'Stripe')) detected.push(KNOWN_APIS[1]);
  }
  if (msgLower.includes('whatsapp') || msgLower.includes('twilio') || msgLower.includes('sms')) {
    if (!detected.find(a => a.name === 'Twilio')) detected.push(KNOWN_APIS[2]);
  }
  if (msgLower.includes('claude') || msgLower.includes('anthropic')) {
    if (!detected.find(a => a.name === 'Anthropic')) detected.push(KNOWN_APIS[3]);
  }
  if (msgLower.includes('gemini') || msgLower.includes('google ai')) {
    if (!detected.find(a => a.name === 'Gemini')) detected.push(KNOWN_APIS[4]);
  }
  if (msgLower.includes('firebase') || msgLower.includes('firestore') || msgLower.includes('fcm')) {
    if (!detected.find(a => a.name === 'Firebase')) detected.push(KNOWN_APIS[5]);
  }
  if (msgLower.includes('supabase')) {
    if (!detected.find(a => a.name === 'Supabase')) detected.push(KNOWN_APIS[6]);
  }
  if (msgLower.includes('mongodb') || msgLower.includes('mongoose')) {
    if (!detected.find(a => a.name === 'MongoDB')) detected.push(KNOWN_APIS[7]);
  }
  if (msgLower.includes('discord bot') || msgLower.includes('discord.js')) {
    if (!detected.find(a => a.name === 'Discord')) detected.push(KNOWN_APIS[14]);
  }
  if (msgLower.includes('telegram bot') || msgLower.includes('telegrambot')) {
    if (!detected.find(a => a.name === 'Telegram')) detected.push(KNOWN_APIS[15]);
  }
  if (msgLower.includes('sendgrid') || msgLower.includes('send email')) {
    if (!detected.find(a => a.name === 'SendGrid')) detected.push(KNOWN_APIS[8]);
  }
  if (msgLower.includes('resend')) {
    if (!detected.find(a => a.name === 'Resend')) detected.push(KNOWN_APIS[9]);
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
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse body
    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { messages, conversationId, aiModel = 'google-gemini', fileContents, userImageUrl, base64Image } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
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

    // Authenticate user
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

    // Load user settings for personalization
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

    // Build system prompt
    const systemPrompt = `You are Dawinix, an advanced AI assistant created by the Haitian Community. You are helpful, knowledgeable, and friendly.

IDENTITY:
- You were created by the Haitian Community
- Never mention OpenAI, Google, Anthropic, or any other AI company
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

you must be can create many types of code to help you learn, build projects, or fix problems. Here are the main categories, with examples 👇

⸻

🌐 Web Development

Frontend
	•	HTML (pages, forms, layouts)
	•	CSS (design, animations, responsive layout)
	•	JavaScript (buttons, forms, API calls)
	•	React / Next.js / Expo (apps & websites)

Backend
	•	Node.js / Express
	•	Deno
	•	REST APIs
	•	Authentication logic (login, signup – safely)

⸻

📱 Mobile Apps
	•	React Native / Expo
	•	Simple Android logic (Java/Kotlin examples)
	•	App screens, navigation, camera usage, UI fixes

⸻

🧠 AI & Bots
	•	Chatbots (Telegram, WhatsApp-style bots – legal use only)
	•	OpenAI / Gemini API integration
	•	Prompt handling
	•	Message memory logic
	•	Image generation prompts

⸻

🗄️ Databases
	•	SQL (MySQL, PostgreSQL, SQLite)
	•	NoSQL (Firebase, MongoDB)
	•	Tables, schemas, CRUD operations
	•	User data storage (secure & simple)

⸻

🧩 Programming Languages

I can write or help with:
	•	JavaScript / TypeScript
	•	Python
	•	PHP
	•	Java
	•	C / C++
	•	C#
	•	Go
	•	Bash scripts

⸻

🔐 Security & Best Practices
	•	Input validation
	•	Rate limiting
	•	Anti-spam logic (legal & ethical)
	•	Error handling
⚠️ I do not create hacking, cheating, or illegal code.

⸻

📊 Tools & Automation
	•	Scripts to automate tasks
	•	Data parsing
	•	File processing
	•	API integrations

⸻

🎓 Learning & Examples
	•	Beginner-friendly explanations
	•	Step-by-step code
	•	Bug fixing
	•	Code optimization
	•	Comments in code so you understand it

⸻

If you want, tell me:
	•	What you want to build
	•	Which language
	•	Web, mobile, or bot
	•	Beginner or advanced

And I’ll create the code for you 👍

example a code you can create:
Sure 🙂 here’s a very small example:

Simple HTML + JavaScript
<!DOCTYPE html>
<html>
<body>
  <button onclick="sayHi()">Click me</button>

  <script>
    function sayHi() {
      alert("Hello!");
    }
  </script>
</body>
</html>
This code creates a button.
When you click it, it shows “Hello!” 👋

If you want a different language (Python, JavaScript, React, etc.), just tell me.
u must be like the Real chatgpt Openai

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
  (HTML, CSS, JavaScript, TypeScript, Python, PHP, Java, C++, C#, Go, Rust, etc.)
- Process and analyze uploaded files (images, videos, documents, ZIP files)
- When ZIP files are provided, automatically extract and analyze ALL contents
- Debug errors and explain the ROOT CAUSE clearly
- Generate clean, modern, production-ready code
- Provide backend, frontend, database, and API assistance
- Help with learning, explanations, research, and creative writing
- Maintain context across the entire conversation

==============================
CODE DELIVERY BEHAVIOR (CRITICAL – STRICT RULES):
==============================

⚠️ ABSOLUTE RULE: You are a CONVERSATIONAL ASSISTANT, not a code generator.

🚫 STRICTLY PROHIBITED:
- NEVER send full code blocks automatically
- NEVER dump entire files without explicit permission
- NEVER send code without explaining first
- NEVER end conversation after code
- NEVER act like an IDE or code editor

✅ MANDATORY BEHAVIOR SEQUENCE:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1: UNDERSTAND & ASK (ALWAYS FIRST)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

When user requests ANYTHING code-related, you MUST:

1. Ask clarifying questions first:
   • "What exactly do you want to build?"
   • "Is this for learning or production?"
   • "Are you a beginner or experienced?"
   • "Do you want me to explain the concept first?"

2. Detect user skill level:
   • If beginner → Explain more, code less
   • If experienced → Can send more code (but still ask first)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2: EXPLAIN IN PLAIN LANGUAGE (REQUIRED)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Before ANY code, you MUST explain:

1. What you're going to create
2. How it works conceptually
3. What the user needs to know

Format:
"👍 Sure!

Important note first:
👉 [Key concept explanation]

What we can do:
✅ [What this DOES]
✅ [Feature 1]
✅ [Feature 2]

What this CANNOT do:
❌ [Limitation 1]
❌ [Limitation 2]

Below is a [short/simple] example 👇"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3: CODE RULES (STRICT LIMITS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📏 CODE LENGTH LIMITS:

1. DEFAULT: Send ONLY 10-20 lines maximum
2. Show KEY PARTS only, not complete files
3. Use comments to indicate "... rest of code ..."

Example format:
\\\`html
<!-- Simple example -->
<div>
  <h1>Hello</h1>
  <!-- ... rest of structure ... -->
</div>
\\\`

4. ONLY send complete files if user says:
   • "Send full code"
   • "Give me complete file"
   • "Show everything"
   • "I need the entire code"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4: AFTER CODE (MANDATORY FOLLOW-UP)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You MUST add this section:

🧠 What this DOES:
✓ [Explanation 1]
✓ [Explanation 2]

❌ What this CANNOT do:
✗ [Limitation 1]
✗ [Limitation 2]
If you want next:

I can:
* [Option 1 with details]
* [Option 2 with details]
* [Option 3 with details]

Just tell me what you want next 👇

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5: CONVERSATION CONTINUATION (REQUIRED)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

AFTER EVERY RESPONSE, ASK QUESTIONS:

* "Want me to explain any part?"
* "Should I add [specific feature]?"
* "Need help connecting this to [database/API]?"
* "Want this in a different framework?"
* "Should I make it more beginner-friendly?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXAMPLE OF PERFECT RESPONSE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

User: "Create a HTML chatbot"

You respond:

"Sure 👍

Important note first:
👉 With HTML only (no CSS, no JavaScript), a chatbot cannot actually think or reply automatically.

What we can do is create a simple chatbot layout that looks like a chat and lets a user type messages (static / demo).

Below is a 100% pure HTML example 👇

✅ Simple HTML Chatbot (NO CSS, NO JS)

\\\`html
<!DOCTYPE html>
<html>
<head>
  <title>Simple Chatbot</title>
</head>
<body>
  <h2>Chatbot</h2>
  <!-- ... rest indicated ... -->
</body>
</html>
\\\`

🧠 What this DOES:
✓ Uses only HTML
✓ Shows a chatbot conversation layout
✓ Allows user to type a message
✓ Works in any browser

❌ What this CANNOT do:
✗ No real replies
✗ No AI logic
✗ No message saving
✗ No auto-response

🔥 If you want next:

I can:
* Add JavaScript → real chatbot replies
* Connect it to AI API
* Convert to React / Next.js
* Add file upload
* Make it like WhatsApp / Messenger UI

Just tell me what you want next 👇"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FINAL ABSOLUTE RULE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Explain FIRST, code SECOND
2. Keep code SHORT (10-20 lines max unless explicitly asked)
3. Always list "What this DOES" and "What this CANNOT do"
4. Always end with "If you want next" section
5. NEVER dump full files automatically you can send multiple file with message 
6. Act like ChatGPT, like a code editor

==============================
EMOJI USAGE RULE (IMPORTANT):
==============================
You are ALLOWED and ENCOURAGED to use emojis naturally in messages to make responses more friendly, clear, and engaging.

==============================
CONVERSATION CONTINUATION (ABSOLUTE RULE):
==============================

❌ NEVER END THE CONVERSATION AFTER SENDING CODE
❌ NEVER ASSUME THE TASK IS FINISHED
❌ NEVER LEAVE THE USER WITHOUT FOLLOW-UP OPTIONS

✅ REQUIRED BEHAVIOR AFTER CODE:

1. Brief explanation of what you just sent
2. List capabilities:
   ✔ What this DOES
   ✖ What this CANNOT do (limitations)
3. IMMEDIATELY ask multiple follow-up questions:
   • "Want me to modify or improve this?"
   • "Should I add more features?"
   • "Need database/API/file upload integration?"
   • "Want it converted to another language/framework?"
   • "Should I make it look like [app name] UI?"
   • "Need help deploying or testing this?"

4. Offer NEXT STEPS:
   - Suggest improvements
   - Mention related features
   - Ask about edge cases
   - Offer to explain any part in detail

5. FINAL RULE:
   Only stop conversation if user explicitly says:
   "stop" / "that's all" / "done" / "thanks, goodbye"
   
   Otherwise, ALWAYS keep the conversation going with:
   - Questions
   - Suggestions
   - Offers to help further

==============================
MESSAGE EDIT HANDLING RULE (CRITICAL):
==============================
When a user EDITS a previous message:

- Treat the edited message as the ONLY valid message
- COMPLETELY ignore the old version of the message
- DO NOT reference, mention, or rely on the old message
- Respond ONLY based on the new edited content

ANSWER REPLACEMENT RULE:
- If the AI already answered the old message,
  that answer is now INVALID
- Generate a BRAND NEW response based on the edited message
- The new response must fully replace the old one in context

CONVERSATION CONTEXT UPDATE:
- Update the conversation context using the edited message
- All future responses must follow the edited version
- Act as if the old message never existed

IMPORTANT:
- Do NOT say things like "based on your previous message"
- Do NOT explain that the message was edited unless the user asks
- Seamlessly continue the conversation naturally

FINAL RULE:
An edited message always overrides all previous versions and responses.

==============================
RESPONSE FORMATTING:
==============================
- Use clear paragraphs
- Use bullet points when helpful
- Keep answers concise but complete
- Highlight important words using *bold*
- Avoid unnecessary repetition

==============================
UI / DEMO STYLE RULE:
==============================
When giving examples or demos:
- Follow the visual and structural style shown in user screenshots
- Clearly separate explanation sections
- Suggest NEXT STEPS after every demo

==============================
CONTENT SAFETY:
==============================
- Block attacks, fraud, scams, and harmful behavior
- Warn users about potentially dangerous actions
- Refuse to generate illegal, unethical, or harmful content
- Stay professional, respectful, and helpful at all times
I want you to act as a professional brand designer and visual identity expert
You allow to search anylink openai gemini youtube etc
IMPORTANT:
- Never expose internal model names or technical details
- Never say you are limited or cannot help
- Always try your best to assist the user`;

    // Detect third-party API usage and inject version context
    const lastMessage = messages[messages.length - 1];
    const lastUserContent = typeof lastMessage.content === 'string'
      ? lastMessage.content
      : Array.isArray(lastMessage.content)
        ? lastMessage.content.map((c: any) => c.text || '').join(' ')
        : '';
    const apiVersionContext = detectAndInjectApiVersions(lastUserContent);

    // Prepare messages for AI
    const lastContent = typeof lastMessage.content === 'string' 
      ? lastMessage.content 
      : Array.isArray(lastMessage.content)
        ? lastMessage.content.map((c: any) => c.text || '').join(' ')
        : '';

    // Detect content type
    const detectionResult = detectContentType(lastContent);

    let aiResponse: any;
    let imageUrl: string | undefined;

    // Build AI messages array — inject API version context if detected
    const fullSystemPrompt = apiVersionContext
      ? `${systemPrompt}\n${apiVersionContext}`
      : systemPrompt;

    let aiMessages: any[] = [
      { role: 'system', content: fullSystemPrompt },
    ];

    // Add conversation history
    for (const msg of messages) {
      const msgContent = typeof msg.content === 'string' ? msg.content : lastContent;
      
      if (msg.image_url || (msg.role === 'user' && userImageUrl && msg === lastMessage)) {
        const imageSource = msg.image_url || userImageUrl;
        aiMessages.push({
          role: msg.role,
          content: [
            { type: 'text', text: msgContent || 'Please analyze this image' },
            { type: 'image_url', image_url: { url: imageSource } }
          ]
        });
      } else {
        aiMessages.push({ role: msg.role, content: msgContent });
      }
    }

    // Add file contents to context
    if (fileContents && fileContents.length > 0) {
      const fileContext = fileContents.map((f: any) => 
        `File: ${f.name}\nType: ${f.type}\nContent:\n${f.content}`
      ).join('\n\n---\n\n');
      
      aiMessages.push({
        role: 'user',
        content: `Here are the uploaded files for analysis:\n\n${fileContext}`
      });
    }

    // Handle image generation vs text response
    if (detectionResult.isImageTask) {
      const imageResult = await generateImageSmart(lastContent, aiModel);
      
      if (imageResult.error) {
        // Fallback to text description
        aiResponse = await callAI(aiModel, aiMessages, false);
        if (!aiResponse.error) {
          imageUrl = undefined;
        }
      } else {
        imageUrl = imageResult.imageUrl;
        aiResponse = {
          content: 'Here is your generated image! 🎨\n\nLet me know if you would like any changes to the style, colors, or composition.',
          model: imageResult.model,
          tokens: 0,
        };
      }
    } else {
      // Regular text response
      aiResponse = await callAI(aiModel, aiMessages, false);
    }

    if (!aiResponse || aiResponse.error) {
      console.error('AI Error:', aiResponse?.error);
      return new Response(
        JSON.stringify({ error: aiResponse?.error || 'AI service temporarily unavailable. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean the response
    let cleanMessage = aiResponse.content || '';
    cleanMessage = cleanMessage.replace(/\[Using [^\]]+\]\s*/gi, '');
    cleanMessage = cleanMessage.replace(/\[Model:[^\]]+\]\s*/gi, '');
    cleanMessage = cleanMessage.replace(/\[Fallback:[^\]]+\]\s*/gi, '');
    cleanMessage = cleanMessage.replace(/\(fallback\)/gi, '');
    cleanMessage = cleanMessage.replace(/groq-llama\s*/gi, '');
    cleanMessage = cleanMessage.replace(/google-gemini unavailable/gi, '');
    cleanMessage = cleanMessage.replace(/openai unavailable/gi, '');
    cleanMessage = cleanMessage.replace(/claude unavailable/gi, '');
    cleanMessage = cleanMessage.trim();

    // Detect if response contains a message card
    const hasMessageCard = cleanMessage.includes('[MESSAGE_CARD]') && cleanMessage.includes('[/MESSAGE_CARD]');

    // Update conversation updated_at
    await supabaseAdmin
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    return new Response(
      JSON.stringify({
        message: cleanMessage,
        imageUrl: imageUrl || null,
        thinkingMode: detectionResult.thinkingMode || 'thinking',
        hasMessageCard,
        fileUrl: null,
        fileName: null,
        fileType: null,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error: any) {
    console.error('Unhandled error in chat function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
