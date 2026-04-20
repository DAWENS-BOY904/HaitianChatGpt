import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-request-id, x-timeout',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ONSPACE_AI_API_KEY = () => Deno.env.get('ONSPACE_AI_API_KEY') || '';
const ONSPACE_AI_BASE_URL = () => Deno.env.get('ONSPACE_AI_BASE_URL') || 'https://api.onspace.ai';
const OPENAI_API_KEY = () => Deno.env.get('OPENAI_API_KEY') || '';

// ── OpenAI Whisper transcription (most reliable) ────────────────────────────
async function transcribeWithWhisper(audioBase64: string, language?: string): Promise<{ text: string; detectedLanguage?: string } | null> {
  const apiKey = OPENAI_API_KEY();
  if (!apiKey) {
    console.log('[Transcribe] No OPENAI_API_KEY, skipping Whisper');
    return null;
  }

  try {
    console.log('[Transcribe] Trying OpenAI Whisper...');

    // Decode base64 to binary
    const decoded = atob(audioBase64);
    const bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);

    const formData = new FormData();
    const audioBlob = new Blob([bytes], { type: 'audio/m4a' });
    formData.append('file', audioBlob, 'audio.m4a');
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');
    if (language && language !== 'auto') formData.append('language', language.slice(0, 2).toLowerCase());

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: formData,
      signal: AbortSignal.timeout(45000),
    });

    console.log(`[Transcribe] Whisper response: ${response.status}`);

    if (!response.ok) {
      const errText = await response.text().catch(() => response.statusText);
      console.log(`[Transcribe] Whisper failed (${response.status}): ${errText.slice(0, 200)}`);
      return null;
    }

    const data = await response.json();
    const text = (data.text || '').trim();
    const detectedLanguage = data.language || undefined;

    if (!text) return null;
    console.log(`[Transcribe] Whisper success: "${text.slice(0, 60)}..." (lang: ${detectedLanguage})`);
    return { text, detectedLanguage };
  } catch (e: any) {
    console.log('[Transcribe] Whisper exception:', e.message);
    return null;
  }
}

// ── OnSpace AI multimodal transcription ─────────────────────────────────────
async function transcribeWithOnSpaceAI(audioBase64: string, language?: string): Promise<{ text: string; detectedLanguage?: string } | null> {
  const apiKey = ONSPACE_AI_API_KEY();
  const baseUrl = ONSPACE_AI_BASE_URL();

  if (!apiKey) {
    console.log('[Transcribe] No ONSPACE_AI_API_KEY, skipping OnSpace AI');
    return null;
  }

  const langHint = language ? ` The audio language is likely ${language}.` : '';
  const systemPrompt = `You are a highly accurate speech transcription assistant. Transcribe exactly what is spoken in the audio.${langHint}

Rules:
- Output ONLY the transcribed text, nothing else
- Preserve the original language of the speaker
- Do not add commentary or explanations
- If the audio is silent or inaudible, output exactly: [SILENCE]
- Transcribe Haitian Creole, English, French, Spanish exactly as spoken`;

  const models = [
    'google/gemini-3-flash-preview',
    'google/gemini-2.5-flash',
    'google/gemini-2.5-flash-lite',
  ];

  for (const model of models) {
    try {
      console.log(`[Transcribe] Trying OnSpace AI model: ${model}`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 40000);

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Transcribe this audio:' },
                { type: 'image_url', image_url: { url: `data:audio/m4a;base64,${audioBase64}` } },
              ],
            },
          ],
          max_tokens: 1000,
          temperature: 0.0,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      console.log(`[Transcribe] OnSpace AI ${model} response: ${response.status}`);

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        console.log(`[Transcribe] ${model} failed: ${errText.slice(0, 150)}`);
        continue;
      }

      const data = await response.json();
      const text = (data.choices?.[0]?.message?.content || '').trim();

      if (!text || text === '[SILENCE]') {
        console.log(`[Transcribe] ${model} returned empty/silence`);
        if (text === '[SILENCE]') return { text: '' };
        continue;
      }

      console.log(`[Transcribe] OnSpace AI success (${model}): "${text.slice(0, 60)}..."`);
      return { text };
    } catch (e: any) {
      if (e.name === 'AbortError') {
        console.log(`[Transcribe] ${model} timed out`);
      } else {
        console.log(`[Transcribe] ${model} exception:`, e.message);
      }
    }
  }

  return null;
}

// ── Detect language from text ────────────────────────────────────────────────
function detectLanguageFromText(text: string): string | null {
  const lower = text.toLowerCase();
  // Haitian Creole markers
  if (/\b(mwen|ou|li|nou|yo|pa|pou|ki|ak|nan|an|se|ka|te|ap|fè|tè|pitit|zanmi|bonjou|bonswa|mèsi|kòman|kreye|ayiti)\b/.test(lower)) {
    return 'Haitian Creole';
  }
  // French markers
  if (/\b(je|tu|il|elle|nous|vous|ils|que|qui|dans|avec|pour|sur|par|les|des|une|est|sont|avoir|être)\b/.test(lower)) {
    return 'French';
  }
  // Spanish markers
  if (/\b(yo|tú|él|ella|nosotros|que|con|para|por|las|los|una|es|son|estar|haber|como|pero|muy)\b/.test(lower)) {
    return 'Spanish';
  }
  return null;
}

// ── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

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

    const { audio, userId, conversationId, language, detectLanguage } = body;

    // Validate audio
    if (!audio || typeof audio !== 'string' || audio.length < 100) {
      return new Response(
        JSON.stringify({ error: 'No valid audio data provided', warning: 'No speech detected. Please try again.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate base64 and size
    let audioBytes: Uint8Array;
    try {
      const decoded = atob(audio);
      audioBytes = Uint8Array.from(decoded, c => c.charCodeAt(0));
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid base64 audio encoding' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (audioBytes.length < 1000) {
      return new Response(
        JSON.stringify({ text: '', warning: 'Audio too short. Please speak for at least 1 second.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (audioBytes.length > 25 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: 'Audio file too large. Maximum 25MB allowed.' }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Transcribe] Audio: ${audioBytes.length} bytes, lang hint: ${language || 'auto'}, user: ${userId || 'anon'}`);
    console.log(`[Transcribe] Keys: OpenAI=${!!OPENAI_API_KEY()}, OnSpace=${!!ONSPACE_AI_API_KEY()}`);

    // ── Provider priority: OpenAI Whisper → OnSpace AI ──
    let result: { text: string; detectedLanguage?: string } | null = null;
    let provider = '';

    // 1. Try OpenAI Whisper (best accuracy, supports Haitian Creole)
    result = await transcribeWithWhisper(audio, language);
    if (result) provider = 'openai-whisper';

    // 2. Try OnSpace AI multimodal
    if (!result) {
      result = await transcribeWithOnSpaceAI(audio, language);
      if (result) provider = 'onspace-ai';
    }

    // All providers failed
    if (!result) {
      console.error('[Transcribe] All providers failed');
      return new Response(
        JSON.stringify({ error: 'Transcription service temporarily unavailable. Please try again.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Empty transcription (silence)
    if (!result.text || result.text === '[SILENCE]') {
      return new Response(
        JSON.stringify({ text: '', warning: 'No speech detected. Please speak clearly and try again.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean up the transcription
    let cleanText = result.text
      .replace(/^(transcription:|here is the transcription:|the speaker says:|i hear:)/i, '')
      .replace(/^\[transcription\]:/i, '')
      .trim();

    // Language detection from text if not already detected
    let detectedLanguage = result.detectedLanguage || null;
    if (!detectedLanguage && detectLanguage) {
      detectedLanguage = detectLanguageFromText(cleanText);
    }

    // Map short language codes to full names
    const langCodeMap: Record<string, string> = {
      en: 'English', fr: 'French', es: 'Spanish', ht: 'Haitian Creole',
      pt: 'Portuguese', de: 'German', zh: 'Chinese', ja: 'Japanese', ar: 'Arabic',
    };
    if (detectedLanguage && langCodeMap[detectedLanguage.toLowerCase()]) {
      detectedLanguage = langCodeMap[detectedLanguage.toLowerCase()];
    }

    console.log(`[Transcribe] Success via ${provider}: "${cleanText.slice(0, 80)}..."`);

    // Log to activity (non-blocking)
    if (userId) {
      try {
        const supabaseAdmin = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        supabaseAdmin.from('activity_logs').insert({
          user_id: userId,
          action: 'voice_transcription',
          action_type: 'audio',
          details: {
            audioBytes: audioBytes.length,
            textLength: cleanText.length,
            conversationId,
            provider,
            language: detectedLanguage,
          },
        }).catch(() => {});
      } catch {}
    }

    return new Response(
      JSON.stringify({
        success: true,
        text: cleanText,
        language: language || detectedLanguage || 'auto',
        detectedLanguage: detectedLanguage || null,
        confidence: provider === 'openai-whisper' ? 0.95 : 0.88,
        provider,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[Transcribe] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error during transcription' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
