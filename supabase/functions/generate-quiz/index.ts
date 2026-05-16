import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

// ═══════════════════════════════════════════════════════════════════════════════
//  CONFIGURATION & ENVIRONMENT
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
  OPENAI: {
    KEY:     Deno.env.get('OPENAI_API_KEY') ?? '',
    URL:     'https://api.openai.com/v1/chat/completions',
    MODEL:   'gpt-4o-mini',
    TIMEOUT: 15000, // 15s
    RETRIES: 2,
  },
  GROQ: {
    KEY:     Deno.env.get('GROQ_API_KEY') ?? '',
    URL:     'https://api.groq.com/openai/v1/chat/completions',
    MODEL:   'llama3-8b-8192',
    TIMEOUT: 15000,
    RETRIES: 2,
  },
  ONSPACE: {
    KEY:     Deno.env.get('ONSPACE_AI_API_KEY') ?? '',
    URL:     Deno.env.get('ONSPACE_AI_BASE_URL') ?? 'https://api.onspace.ai/v1',
    MODEL:   'gemini-2.0-flash',
    TIMEOUT: 15000,
    RETRIES: 2,
  },
  QUIZ: {
    QUESTION_COUNT: 10,
    OPTION_COUNT:   4,
    MAX_TOKENS:     2500,
    TEMPERATURE:    0.7,
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface QuizQuestion {
  question:    string;
  options:     string[];
  answer:      number;
  explanation: string;
}

interface QuizRequest {
  topic:      string;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Expert';
  count?:     number;
  language?:  string;
}

interface QuizResponse {
  success:    boolean;
  questions:  QuizQuestion[];
  topic:      string;
  difficulty: string;
  provider:   string;
  generatedAt: string;
  errors?:    string[];
}

interface ProviderResult {
  questions: QuizQuestion[] | null;
  provider:  string;
  error?:    string;
  duration:  number;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  DIFFICULTY ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

const DIFFICULTY_PROFILES: Record<string, { hint: string; tempBonus: number }> = {
  Easy:   {
    hint: 'Make questions simple and beginner-friendly. Use straightforward facts and obvious distractors. One-step reasoning.',
    tempBonus: 0.1,
  },
  Medium: {
    hint: 'Moderately challenging with plausible distractors. Suitable for general knowledge. Two-step reasoning.',
    tempBonus: 0.0,
  },
  Hard:   {
    hint: 'Difficult and detailed, requiring deeper knowledge. Distractors should be close to the correct answer. Multi-step reasoning.',
    tempBonus: -0.1,
  },
  Expert: {
    hint: 'Expert-level questions. Include tricky edge cases, specialized knowledge, and very similar-looking options requiring deep understanding.',
    tempBonus: -0.15,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
//  PROMPT BUILDER
// ═══════════════════════════════════════════════════════════════════════════════

function buildPrompt(topic: string, difficulty: string, count: number, language: string, seed: string): string {
  const profile = DIFFICULTY_PROFILES[difficulty] ?? DIFFICULTY_PROFILES.Medium;
  const langHint = language !== 'en' ? `Respond in ${language}. ` : '';

  return `${langHint}Generate exactly ${count} BRAND NEW, UNIQUE multiple-choice quiz questions about "${topic}".

IMPORTANT: This is request #${seed}. You MUST generate completely different questions from any previous requests. Do NOT repeat any questions that commonly appear in basic quizzes about this topic. Be creative, explore different angles, subtopics, historical facts, lesser-known details, and varied question formats.

DIFFICULTY: ${difficulty}
INSTRUCTIONS: ${profile.hint}

RULES:
- Each question must have exactly ${CONFIG.QUIZ.OPTION_COUNT} options (A, B, C, D)
- The "answer" field must be the 0-based index (0=A, 1=B, 2=C, 3=D)
- Include a brief explanation for each correct answer
- Ensure questions are factually accurate
- Avoid the most obvious/cliche questions about this topic
- Distractors must be plausible but clearly wrong
- Vary question types: some factual, some conceptual, some applied
- Shuffle the correct answer position randomly across questions (don't always put it at index 0 or 3)

OUTPUT FORMAT — Return ONLY a valid JSON array. No markdown, no code fences, no extra text:
[
  {
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "answer": 0,
    "explanation": "Brief explanation of why this is correct."
  }
]`;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  VALIDATION ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

class QuizValidator {
  static validate(raw: unknown): QuizQuestion[] {
    if (!Array.isArray(raw)) {
      throw new Error(`Expected array, got ${typeof raw}`);
    }

    const validated: QuizQuestion[] = [];

    for (let i = 0; i < raw.length; i++) {
      const q = raw[i];

      if (!q || typeof q !== 'object') {
        throw new Error(`Question ${i + 1}: expected object, got ${typeof q}`);
      }

      // Validate question text
      const question = String(q.question ?? '').trim();
      if (!question) {
        throw new Error(`Question ${i + 1}: missing question text`);
      }
      if (question.length < 5) {
        throw new Error(`Question ${i + 1}: question too short`);
      }

      // Validate options
      const opts = q.options;
      if (!Array.isArray(opts)) {
        throw new Error(`Question ${i + 1}: options must be an array`);
      }
      if (opts.length !== CONFIG.QUIZ.OPTION_COUNT) {
        throw new Error(`Question ${i + 1}: expected ${CONFIG.QUIZ.OPTION_COUNT} options, got ${opts.length}`);
      }
      const options = opts.map((o: unknown) => String(o ?? '').trim());
      if (options.some((o: string) => !o)) {
        throw new Error(`Question ${i + 1}: empty option detected`);
      }

      // Validate answer index
      let answer = typeof q.answer === 'number' ? q.answer : parseInt(String(q.answer), 10);
      if (isNaN(answer) || answer < 0 || answer >= CONFIG.QUIZ.OPTION_COUNT) {
        throw new Error(`Question ${i + 1}: invalid answer index ${q.answer}`);
      }

      // Validate explanation
      const explanation = String(q.explanation ?? '').trim();

      validated.push({ question, options, answer, explanation });
    }

    if (validated.length === 0) {
      throw new Error('No valid questions found');
    }

    return validated;
  }

  static parseAIResponse(raw: string): unknown {
    // Try to extract JSON from various formats
    const patterns = [
      // Code fence with json
      /```(?:json)?\s*([\s\S]*?)```/,
      // Code fence without json
      /```\s*([\s\S]*?)```/,
      // Raw array
      /(\[[\s\S]*\])/,
    ];

    for (const pattern of patterns) {
      const match = raw.match(pattern);
      if (match) {
        const candidate = match[1] ?? match[0];
        try {
          return JSON.parse(candidate.trim());
        } catch { /* continue */ }
      }
    }

    // Last resort: try parsing the whole thing
    return JSON.parse(raw.trim());
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  HTTP CLIENT WITH TIMEOUT & RETRY
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callProviderWithRetry(
  name: string,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  config: { timeout: number; retries: number }
): Promise<{ raw: string; duration: number }> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= config.retries; attempt++) {
    const start = Date.now();
    try {
      if (attempt > 0) {
        const delay = 1000 * Math.pow(2, attempt - 1);
        console.log(`[${name}] Retry ${attempt}/${config.retries} after ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }

      const res = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
      }, config.timeout);

      const duration = Date.now() - start;

      if (!res.ok) {
        const text = await res.text().catch(() => `HTTP ${res.status}`);
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      }

      const data = await res.json();
      const raw = data?.choices?.[0]?.message?.content ?? '';

      if (!raw.trim()) {
        throw new Error('Empty response content');
      }

      console.log(`[${name}] Success in ${duration}ms (attempt ${attempt + 1})`);
      return { raw, duration };

    } catch (err: any) {
      lastError = err;
      console.error(`[${name}] Attempt ${attempt + 1} failed:`, err.message);
    }
  }

  throw lastError ?? new Error(`${name}: All retries exhausted`);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  AI PROVIDERS
// ═══════════════════════════════════════════════════════════════════════════════

async function tryOpenAI(prompt: string): Promise<ProviderResult> {
  if (!CONFIG.OPENAI.KEY) {
    return { questions: null, provider: 'OpenAI', duration: 0, error: 'No API key configured' };
  }

  const start = Date.now();
  try {
    const { raw } = await callProviderWithRetry(
      'OpenAI',
      CONFIG.OPENAI.URL,
      { Authorization: `Bearer ${CONFIG.OPENAI.KEY}` },
      {
        model:       CONFIG.OPENAI.MODEL,
        messages:    [{ role: 'user', content: prompt }],
        temperature: CONFIG.QUIZ.TEMPERATURE,
        max_tokens:  CONFIG.QUIZ.MAX_TOKENS,
      },
      { timeout: CONFIG.OPENAI.TIMEOUT, retries: CONFIG.OPENAI.RETRIES }
    );

    const parsed = QuizValidator.parseAIResponse(raw);
    const questions = QuizValidator.validate(parsed);
    return { questions, provider: 'OpenAI', duration: Date.now() - start };

  } catch (err: any) {
    return { questions: null, provider: 'OpenAI', duration: Date.now() - start, error: err.message };
  }
}

async function tryGroq(prompt: string): Promise<ProviderResult> {
  if (!CONFIG.GROQ.KEY) {
    return { questions: null, provider: 'Groq', duration: 0, error: 'No API key configured' };
  }

  const start = Date.now();
  try {
    const { raw } = await callProviderWithRetry(
      'Groq',
      CONFIG.GROQ.URL,
      { Authorization: `Bearer ${CONFIG.GROQ.KEY}` },
      {
        model:       CONFIG.GROQ.MODEL,
        messages:    [{ role: 'user', content: prompt }],
        temperature: CONFIG.QUIZ.TEMPERATURE,
        max_tokens:  CONFIG.QUIZ.MAX_TOKENS,
      },
      { timeout: CONFIG.GROQ.TIMEOUT, retries: CONFIG.GROQ.RETRIES }
    );

    const parsed = QuizValidator.parseAIResponse(raw);
    const questions = QuizValidator.validate(parsed);
    return { questions, provider: 'Groq', duration: Date.now() - start };

  } catch (err: any) {
    return { questions: null, provider: 'Groq', duration: Date.now() - start, error: err.message };
  }
}

async function tryOnspace(prompt: string): Promise<ProviderResult> {
  if (!CONFIG.ONSPACE.KEY) {
    return { questions: null, provider: 'OnSpace', duration: 0, error: 'No API key configured' };
  }

  const start = Date.now();
  try {
    const { raw } = await callProviderWithRetry(
      'OnSpace',
      `${CONFIG.ONSPACE.URL}/chat/completions`,
      { Authorization: `Bearer ${CONFIG.ONSPACE.KEY}` },
      {
        model:       CONFIG.ONSPACE.MODEL,
        messages:    [{ role: 'user', content: prompt }],
        temperature: CONFIG.QUIZ.TEMPERATURE,
        max_tokens:  CONFIG.QUIZ.MAX_TOKENS,
      },
      { timeout: CONFIG.ONSPACE.TIMEOUT, retries: CONFIG.ONSPACE.RETRIES }
    );

    const parsed = QuizValidator.parseAIResponse(raw);
    const questions = QuizValidator.validate(parsed);
    return { questions, provider: 'OnSpace', duration: Date.now() - start };

  } catch (err: any) {
    return { questions: null, provider: 'OnSpace', duration: Date.now() - start, error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  FALLBACK QUESTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function getFallbackQuestions(count: number = 10): QuizQuestion[] {
  const all: QuizQuestion[] = [
    { question: 'What is the capital of France?', options: ['Berlin', 'Madrid', 'Rome', 'Paris'], answer: 3, explanation: 'Paris is the capital and largest city of France.' },
    { question: 'What is the chemical symbol for Gold?', options: ['Go', 'Gd', 'Au', 'Ag'], answer: 2, explanation: 'Au comes from the Latin word Aurum.' },
    { question: 'How many continents are there on Earth?', options: ['5', '6', '7', '8'], answer: 2, explanation: 'There are 7 continents: Africa, Antarctica, Asia, Australia, Europe, North America, and South America.' },
    { question: 'Which planet is closest to the Sun?', options: ['Venus', 'Mercury', 'Earth', 'Mars'], answer: 1, explanation: 'Mercury is the closest planet to the Sun.' },
    { question: 'What is the result of 5 × 6?', options: ['25', '30', '35', '36'], answer: 1, explanation: '5 times 6 equals 30.' },
    { question: 'Who wrote the play Romeo and Juliet?', options: ['Charles Dickens', 'Ernest Hemingway', 'J.R.R. Tolkien', 'William Shakespeare'], answer: 3, explanation: 'William Shakespeare wrote this famous tragedy around 1594-1596.' },
    { question: 'What gas do plants primarily absorb during photosynthesis?', options: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'], answer: 2, explanation: 'Plants absorb CO2 and release oxygen during photosynthesis.' },
    { question: 'What is the largest ocean on Earth?', options: ['Atlantic Ocean', 'Indian Ocean', 'Arctic Ocean', 'Pacific Ocean'], answer: 3, explanation: 'The Pacific Ocean covers about 63 million square miles.' },
    { question: 'At what temperature does water boil at sea level (Celsius)?', options: ['90°C', '95°C', '100°C', '110°C'], answer: 2, explanation: 'Water boils at 100°C at standard atmospheric pressure.' },
    { question: 'What is the fastest land animal?', options: ['Lion', 'Cheetah', 'Horse', 'Leopard'], answer: 1, explanation: 'The cheetah can reach speeds up to 120 km/h.' },
    { question: 'How many sides does a hexagon have?', options: ['5', '6', '7', '8'], answer: 1, explanation: 'Hex means 6 in Greek.' },
    { question: 'What is the largest planet in our solar system?', options: ['Saturn', 'Neptune', 'Jupiter', 'Uranus'], answer: 2, explanation: 'Jupiter is the largest planet, more massive than all others combined.' },
    { question: 'In what year did World War II end?', options: ['1943', '1944', '1945', '1946'], answer: 2, explanation: 'World War II ended in 1945 with Japan surrendering on September 2.' },
    { question: 'What is the hardest natural substance on Earth?', options: ['Gold', 'Iron', 'Diamond', 'Quartz'], answer: 2, explanation: 'Diamond rates 10 on the Mohs hardness scale.' },
    { question: 'How many bones are in the adult human body?', options: ['186', '196', '206', '216'], answer: 2, explanation: 'The adult human body has 206 bones.' },
    { question: 'Which language has the most native speakers?', options: ['English', 'Spanish', 'Hindi', 'Mandarin Chinese'], answer: 3, explanation: 'Mandarin Chinese has over 1 billion native speakers.' },
    { question: 'Who painted the Mona Lisa?', options: ['Michelangelo', 'Raphael', 'Leonardo da Vinci', 'Donatello'], answer: 2, explanation: 'Leonardo da Vinci painted the Mona Lisa around 1503-1519.' },
    { question: 'What is the smallest country in the world by area?', options: ['Monaco', 'San Marino', 'Vatican City', 'Liechtenstein'], answer: 2, explanation: 'Vatican City is the smallest country in the world at 0.44 km².' },
    { question: 'How many elements are in the modern periodic table?', options: ['108', '112', '118', '124'], answer: 2, explanation: 'There are 118 confirmed elements in the periodic table.' },
    { question: 'Approximately how fast does light travel in a vacuum?', options: ['200,000 km/s', '299,792 km/s', '350,000 km/s', '400,000 km/s'], answer: 1, explanation: 'Light travels at approximately 299,792 km/s in a vacuum.' },
  ];
  // Shuffle and return a random subset for variety on every call
  const shuffled = all.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  console.log(`[${requestId}] ▶ New quiz generation request`);

  try {
    // ── Parse & validate request ───────────────────────────────────────────
    let body: QuizRequest;
    try {
      body = await req.json();
    } catch {
      throw new Error('Invalid JSON body');
    }

    const topic      = String(body.topic ?? 'General Knowledge').trim() || 'General Knowledge';
    const difficulty = DIFFICULTY_PROFILES[body.difficulty] ? body.difficulty : 'Medium';
    const count      = Math.min(20, Math.max(1, Number(body.count) || CONFIG.QUIZ.QUESTION_COUNT));
    const language   = String(body.language ?? 'en').trim().toLowerCase();
    // Unique seed per request to guarantee variety across calls
    const seed       = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    console.log(`[${requestId}]   Topic: "${topic}" | Difficulty: ${difficulty} | Count: ${count} | Lang: ${language} | Seed: ${seed}`);

    // ── Build prompt ───────────────────────────────────────────────────────
    const prompt = buildPrompt(topic, difficulty, count, language, seed);

    // ── Try providers with failover (randomize order for better variety) ─────
    const allProviders = [tryOnspace, tryOpenAI, tryGroq];
    const providers = allProviders;
    const results: ProviderResult[] = [];
    let finalResult: ProviderResult | null = null;

    for (const providerFn of providers) {
      const result = await providerFn(prompt);
      results.push(result);

      if (result.questions && result.questions.length >= count) {
        finalResult = result;
        console.log(`[${requestId}] ✓ Provider "${result.provider}" succeeded with ${result.questions.length} questions`);
        break;
      }

      if (result.questions && result.questions.length > 0 && result.questions.length < count) {
        console.log(`[${requestId}] ⚠ Provider "${result.provider}" returned only ${result.questions.length}/${count} questions`);
      }
    }

    // ── Use fallback if all providers failed ───────────────────────────────
    let questions: QuizQuestion[];
    let usedProvider: string;

    if (finalResult?.questions) {
      questions = finalResult.questions.slice(0, count);
      usedProvider = finalResult.provider;
    } else {
      console.warn(`[${requestId}] ✗ All providers failed. Errors:`, results.map(r => `${r.provider}: ${r.error}`).join(' | '));
      questions = getFallbackQuestions(count);
      usedProvider = 'fallback';
    }

    // ── Build response ─────────────────────────────────────────────────────
    const response: QuizResponse = {
      success:     true,
      questions,
      topic,
      difficulty,
      provider:    usedProvider,
      generatedAt: new Date().toISOString(),
      ...(usedProvider === 'fallback' ? { errors: results.map(r => `${r.provider}: ${r.error}`) } : {}),
    };

    const duration = Date.now() - startTime;
    console.log(`[${requestId}] ✓ Completed in ${duration}ms | Provider: ${usedProvider} | Questions: ${questions.length}`);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    const duration = Date.now() - startTime;
    console.error(`[${requestId}] ✗ Fatal error after ${duration}ms:`, err.message);

    // Always return something useful, even on fatal error
    const fallback: QuizResponse = {
      success:     false,
      questions:   getFallbackQuestions(count),
      topic:       'General Knowledge',
      difficulty:  'Medium',
      provider:    'fallback',
      generatedAt: new Date().toISOString(),
      errors:      [err.message],
    };

    return new Response(JSON.stringify(fallback), {
      status: 200, // Return 200 so client can still show fallback quiz
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
