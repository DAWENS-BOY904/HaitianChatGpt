import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

// ── Deno env helpers ────────────────────────────────────────────────────────
const OPENAI_KEY  = Deno.env.get('OPENAI_API_KEY')  ?? '';
const GROQ_KEY    = Deno.env.get('GROQ_API_KEY')    ?? '';
const ONSPACE_URL = Deno.env.get('ONSPACE_AI_BASE_URL') ?? 'https://api.onspace.ai/v1';
const ONSPACE_KEY = Deno.env.get('ONSPACE_AI_API_KEY')  ?? '';

interface QuizQuestion {
  question: string;
  options: string[];
  answer: number;
  explanation?: string;
}

// ── Difficulty hint map ─────────────────────────────────────────────────────
const DIFFICULTY_HINTS: Record<string, string> = {
  Easy:   'Make the questions simple and beginner-friendly. Use straightforward facts and obvious distractors.',
  Medium: 'Make the questions moderately challenging with plausible distractors. Suitable for general knowledge.',
  Hard:   'Make the questions difficult and detailed, requiring deeper knowledge. Distractors should be close to the correct answer.',
  Expert: 'Make the questions expert-level. Include tricky edge cases, specialized knowledge, and very similar-looking options that require deep understanding.',
};

// ── Build prompt ────────────────────────────────────────────────────────────
function buildPrompt(topic: string, difficulty: string): string {
  const hint = DIFFICULTY_HINTS[difficulty] ?? DIFFICULTY_HINTS.Medium;
  return `Generate exactly 10 multiple-choice quiz questions about ${topic}. Difficulty: ${difficulty}. ${hint}
Return ONLY a valid JSON array with no extra text, markdown, or code fences.
Use this exact format:
[{"question":"...","options":["Option A","Option B","Option C","Option D"],"answer":0,"explanation":"..."}]
The "answer" field must be the 0-based index of the correct option (0-3).`;
}

// ── Parse AI response into QuizQuestion[] ──────────────────────────────────
function parseQuestions(raw: string): QuizQuestion[] {
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('No JSON array found in AI response');
  const parsed = JSON.parse(jsonMatch[0]);
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Empty or invalid question array');
  return parsed.slice(0, 10).map((q: any, i: number) => ({
    question:    String(q.question || `Question ${i + 1}`),
    options:     Array.isArray(q.options) ? q.options.slice(0, 4).map(String) : ['A', 'B', 'C', 'D'],
    answer:      typeof q.answer === 'number' ? Math.min(3, Math.max(0, q.answer)) : 0,
    explanation: String(q.explanation ?? ''),
  }));
}

// ── OpenAI provider ─────────────────────────────────────────────────────────
async function generateWithOpenAI(prompt: string): Promise<QuizQuestion[]> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI error: ${res.status}`);
  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content ?? '';
  return parseQuestions(raw);
}

// ── Groq provider ───────────────────────────────────────────────────────────
async function generateWithGroq(prompt: string): Promise<QuizQuestion[]> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` },
    body: JSON.stringify({
      model: 'llama3-8b-8192',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });
  if (!res.ok) throw new Error(`Groq error: ${res.status}`);
  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content ?? '';
  return parseQuestions(raw);
}

// ── OnSpace AI provider (Gemini) ─────────────────────────────────────────────
async function generateWithOnspace(prompt: string): Promise<QuizQuestion[]> {
  const res = await fetch(`${ONSPACE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ONSPACE_KEY}` },
    body: JSON.stringify({
      model: 'gemini-2.0-flash',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });
  if (!res.ok) throw new Error(`OnSpace AI error: ${res.status}`);
  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content ?? '';
  return parseQuestions(raw);
}

// ── Fallback static questions ────────────────────────────────────────────────
function fallbackQuestions(): QuizQuestion[] {
  return [
    { question: 'What is the capital of France?', options: ['Berlin', 'Madrid', 'Rome', 'Paris'], answer: 3, explanation: 'Paris is the capital and largest city of France.' },
    { question: 'Chemical symbol for Gold?', options: ['Go', 'Gd', 'Au', 'Ag'], answer: 2, explanation: 'Au comes from the Latin word Aurum.' },
    { question: 'How many continents are there?', options: ['5', '6', '7', '8'], answer: 2, explanation: 'There are 7 continents on Earth.' },
    { question: 'Closest planet to the Sun?', options: ['Venus', 'Mercury', 'Earth', 'Mars'], answer: 1, explanation: 'Mercury is the closest planet to the Sun.' },
    { question: 'What is 5 x 6?', options: ['25', '30', '35', '36'], answer: 1, explanation: '5 times 6 equals 30.' },
    { question: 'Who wrote Romeo and Juliet?', options: ['Dickens', 'Hemingway', 'Tolkien', 'Shakespeare'], answer: 3, explanation: 'William Shakespeare wrote this famous play.' },
    { question: 'What gas do plants absorb?', options: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'], answer: 2, explanation: 'Plants absorb CO2 during photosynthesis.' },
    { question: 'Largest ocean?', options: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], answer: 3, explanation: 'The Pacific Ocean is the largest and deepest.' },
    { question: 'Boiling point of water (C)?', options: ['90', '95', '100', '110'], answer: 2, explanation: 'Water boils at 100 degrees Celsius at sea level.' },
    { question: 'Fastest land animal?', options: ['Lion', 'Cheetah', 'Horse', 'Leopard'], answer: 1, explanation: 'The cheetah can run up to 120 km/h.' },
  ];
}

// ── Main handler ─────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { topic = 'General Knowledge', difficulty = 'Medium' } = await req.json();
    const prompt = buildPrompt(topic, difficulty);

    let questions: QuizQuestion[] | null = null;
    const errors: string[] = [];

    // Try providers in order
    if (OPENAI_KEY) {
      try { questions = await generateWithOpenAI(prompt); } catch (e: any) { errors.push(`OpenAI: ${e.message}`); }
    }
    if (!questions && GROQ_KEY) {
      try { questions = await generateWithGroq(prompt); } catch (e: any) { errors.push(`Groq: ${e.message}`); }
    }
    if (!questions && ONSPACE_KEY) {
      try { questions = await generateWithOnspace(prompt); } catch (e: any) { errors.push(`OnSpace: ${e.message}`); }
    }

    // Fall back to static questions
    if (!questions) {
      console.warn('[generate-quiz] All providers failed, using fallback:', errors.join(' | '));
      questions = fallbackQuestions();
    }

    return new Response(JSON.stringify({ questions, topic, difficulty }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[generate-quiz] Fatal error:', err);
    return new Response(
      JSON.stringify({ error: err.message, questions: fallbackQuestions() }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
