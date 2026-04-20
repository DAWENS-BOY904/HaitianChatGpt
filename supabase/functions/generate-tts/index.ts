import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CONFIG = {
  ONSPACE_AI_API_KEY: Deno.env.get('ONSPACE_AI_API_KEY'),
  ONSPACE_AI_BASE_URL: Deno.env.get('ONSPACE_AI_BASE_URL') || 'https://api.onspace.ai',
  OPENAI_API_KEY: Deno.env.get('OPENAI_API_KEY'),
  SUPABASE_URL: Deno.env.get('SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  DEFAULT_VOICE: 'alloy',
  DEFAULT_SPEED: 1.0,
  MAX_TEXT_LENGTH: 4096,
  BUCKET_NAME: 'media-files',
  FOLDER_PATH: 'voice-previews',
  VALID_VOICES: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer', 'coral', 'ash', 'sage'] as const,
};

type VoiceType = typeof CONFIG.VALID_VOICES[number];

function generateFileName(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `voice_${timestamp}_${random}.mp3`;
}

// ── Voice map for language/pitch hints ──────────────────────────────────────
const VOICE_LANG_MAP: Record<string, { lang: string; gender: string }> = {
  alloy:   { lang: 'en-US', gender: 'neutral' },
  echo:    { lang: 'en-GB', gender: 'male'    },
  fable:   { lang: 'en-GB', gender: 'male'    },
  onyx:    { lang: 'en-US', gender: 'male'    },
  nova:    { lang: 'en-US', gender: 'female'  },
  shimmer: { lang: 'en-US', gender: 'female'  },
  coral:   { lang: 'en-US', gender: 'female'  },
};

// ── Try OpenAI TTS (most reliable for audio quality) ──────────────────────
async function tryOpenAITTS(text: string, voice: string, speed: number): Promise<ArrayBuffer | null> {
  const apiKey = CONFIG.OPENAI_API_KEY;
  if (!apiKey) {
    console.log('[TTS] OPENAI_API_KEY not set, skipping OpenAI TTS');
    return null;
  }
  try {
    console.log('[TTS] Trying OpenAI TTS...');
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        voice,
        input: text,
        speed: Math.max(0.25, Math.min(4.0, speed)),
        response_format: 'mp3',
      }),
      signal: AbortSignal.timeout(45000),
    });

    console.log(`[TTS] OpenAI response: ${response.status}`);

    if (!response.ok) {
      const errText = await response.text().catch(() => response.statusText);
      console.log(`[TTS] OpenAI TTS failed (${response.status}): ${errText.slice(0, 200)}`);
      return null;
    }
    const buffer = await response.arrayBuffer();
    if (!buffer || buffer.byteLength < 100) {
      console.log('[TTS] OpenAI returned empty buffer');
      return null;
    }
    console.log(`[TTS] OpenAI TTS success: ${buffer.byteLength} bytes`);
    return buffer;
  } catch (e: any) {
    console.log('[TTS] OpenAI TTS exception:', e.message);
    return null;
  }
}

// ── Try OnSpace AI TTS via chat/completions → base64 audio ─────────────────
// OnSpace AI uses the /v1/audio/speech endpoint (OpenAI-compatible TTS)
async function tryOnSpaceAITTS(text: string, voice: string, speed: number): Promise<ArrayBuffer | null> {
  const apiKey = CONFIG.ONSPACE_AI_API_KEY;
  const baseUrl = CONFIG.ONSPACE_AI_BASE_URL;
  if (!apiKey) {
    console.log('[TTS] ONSPACE_AI_API_KEY not set, skipping OnSpace AI TTS');
    return null;
  }

  // Try multiple endpoint patterns
  const endpoints = [
    `${baseUrl}/v1/audio/speech`,
    `${baseUrl}/audio/speech`,
    `${baseUrl}/tts`,
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`[TTS] Trying OnSpace AI TTS at: ${endpoint}`);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1-hd',
          voice,
          input: text,
          speed: Math.max(0.25, Math.min(4.0, speed)),
          response_format: 'mp3',
        }),
        signal: AbortSignal.timeout(30000),
      });

      console.log(`[TTS] OnSpace AI response: ${response.status} at ${endpoint}`);

      if (!response.ok) {
        const errText = await response.text().catch(() => response.statusText);
        console.log(`[TTS] OnSpace AI failed (${response.status}): ${errText.slice(0, 150)}`);
        continue;
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await response.json().catch(() => ({}));
        console.log('[TTS] OnSpace AI returned JSON instead of audio:', JSON.stringify(json).slice(0, 200));
        // Check if JSON contains base64 audio
        if (json.audio || json.data) {
          try {
            const b64 = json.audio || json.data;
            const decoded = atob(b64);
            const bytes = Uint8Array.from(decoded, c => c.charCodeAt(0));
            if (bytes.length > 100) {
              console.log(`[TTS] OnSpace AI audio from JSON: ${bytes.length} bytes`);
              return bytes.buffer;
            }
          } catch {}
        }
        continue;
      }

      const buffer = await response.arrayBuffer();
      if (!buffer || buffer.byteLength < 100) {
        console.log('[TTS] OnSpace AI returned empty/small buffer');
        continue;
      }
      console.log(`[TTS] OnSpace AI TTS success: ${buffer.byteLength} bytes`);
      return buffer;
    } catch (e: any) {
      console.log(`[TTS] OnSpace AI exception at ${endpoint}:`, e.message);
    }
  }

  return null;
}

// ── Generate TTS via OnSpace AI chat/completions (text-based approach) ──────
// This uses the AI to confirm TTS is requested, then falls back gracefully
async function tryOnSpaceAIChatTTS(text: string, voice: string): Promise<ArrayBuffer | null> {
  const apiKey = CONFIG.ONSPACE_AI_API_KEY;
  const baseUrl = CONFIG.ONSPACE_AI_BASE_URL;
  if (!apiKey || !baseUrl) return null;

  // This is a last-resort attempt using the chat endpoint to get audio if supported
  try {
    console.log('[TTS] Trying OnSpace AI chat/completions for TTS...');
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [{ role: 'user', content: text }],
        modalities: ['audio'],
        audio: { voice, format: 'mp3' },
      }),
      signal: AbortSignal.timeout(25000),
    });

    if (!response.ok) return null;

    const data = await response.json().catch(() => null);
    if (!data) return null;

    // Check for audio in response
    const audioContent = data.choices?.[0]?.message?.audio?.data
      || data.choices?.[0]?.message?.content;

    if (audioContent && typeof audioContent === 'string' && audioContent.length > 100) {
      try {
        // Try to decode as base64
        const decoded = atob(audioContent.replace(/^data:audio\/[^;]+;base64,/, ''));
        const bytes = Uint8Array.from(decoded, c => c.charCodeAt(0));
        if (bytes.length > 100) {
          console.log(`[TTS] OnSpace AI chat TTS audio: ${bytes.length} bytes`);
          return bytes.buffer;
        }
      } catch {}
    }
  } catch (e: any) {
    console.log('[TTS] OnSpace AI chat TTS exception:', e.message);
  }
  return null;
}

// ── Device TTS fallback response ────────────────────────────────────────────
function buildFallbackResponse(text: string, voice: string): Response {
  const voiceInfo = VOICE_LANG_MAP[voice] || { lang: 'en-US', gender: 'neutral' };
  return new Response(
    JSON.stringify({
      success: false,
      fallback: true,
      text,
      voice,
      lang: voiceInfo.lang,
      gender: voiceInfo.gender,
      error: 'TTS providers unavailable — use device speech synthesis',
      code: 'USE_DEVICE_TTS',
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

// ── Upload audio to Supabase storage ────────────────────────────────────────
async function uploadAudio(audioBytes: Uint8Array, supabaseAdmin: any): Promise<string | null> {
  const fileName = generateFileName();
  const filePath = `${CONFIG.FOLDER_PATH}/${fileName}`;

  const { data, error } = await supabaseAdmin.storage
    .from(CONFIG.BUCKET_NAME)
    .upload(filePath, audioBytes, {
      contentType: 'audio/mpeg',
      upsert: false,
      cacheControl: '3600',
    });

  if (error) {
    console.error('[TTS] Storage upload error:', error.message);
    return null;
  }

  const { data: urlData } = supabaseAdmin.storage
    .from(CONFIG.BUCKET_NAME)
    .getPublicUrl(filePath);

  return urlData?.publicUrl || null;
}

// ── Main handler ────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[TTS] Supabase not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Storage not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { text, voice, speed, userId } = body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const finalText = text.trim().slice(0, CONFIG.MAX_TEXT_LENGTH);
    const finalVoice: VoiceType = CONFIG.VALID_VOICES.includes(voice as VoiceType)
      ? (voice as VoiceType)
      : (CONFIG.DEFAULT_VOICE as VoiceType);
    const finalSpeed = Math.max(0.25, Math.min(4.0, Number(speed) || CONFIG.DEFAULT_SPEED));

    console.log(`[TTS] Request: voice=${finalVoice}, speed=${finalSpeed}, len=${finalText.length}, user=${userId || 'anon'}`);
    console.log(`[TTS] Keys: OnSpace=${!!CONFIG.ONSPACE_AI_API_KEY}, OpenAI=${!!CONFIG.OPENAI_API_KEY}`);
    console.log(`[TTS] BaseURL: ${CONFIG.ONSPACE_AI_BASE_URL}`);

    // ── Provider priority: OpenAI → OnSpace AI → OnSpace Chat → device fallback ──
    let audioBuffer: ArrayBuffer | null = null;
    let usedProvider = '';

    // 1. Try OpenAI first (most reliable audio quality)
    audioBuffer = await tryOpenAITTS(finalText, finalVoice, finalSpeed);
    if (audioBuffer) usedProvider = 'openai';

    // 2. Try OnSpace AI /v1/audio/speech
    if (!audioBuffer) {
      audioBuffer = await tryOnSpaceAITTS(finalText, finalVoice, finalSpeed);
      if (audioBuffer) usedProvider = 'onspace-ai';
    }

    // 3. Try OnSpace AI via chat/completions with audio modality
    if (!audioBuffer) {
      audioBuffer = await tryOnSpaceAIChatTTS(finalText, finalVoice);
      if (audioBuffer) usedProvider = 'onspace-ai-chat';
    }

    // 4. All providers failed → device TTS fallback
    if (!audioBuffer) {
      console.log('[TTS] All providers failed — returning device TTS fallback signal');
      return buildFallbackResponse(finalText, finalVoice);
    }

    // Upload to Supabase storage
    const supabaseAdmin = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_SERVICE_ROLE_KEY);
    const audioUint8 = new Uint8Array(audioBuffer);
    const audioUrl = await uploadAudio(audioUint8, supabaseAdmin);

    if (!audioUrl) {
      console.error('[TTS] Upload failed — returning device TTS fallback');
      return buildFallbackResponse(finalText, finalVoice);
    }

    console.log(`[TTS] Done via ${usedProvider}: ${audioUrl}`);

    return new Response(
      JSON.stringify({
        success: true,
        audioUrl,
        audio_url: audioUrl,
        fallback: false,
        metadata: {
          voice: finalVoice,
          speed: finalSpeed,
          textLength: finalText.length,
          audioSizeKB: parseFloat((audioUint8.length / 1024).toFixed(1)),
          provider: usedProvider,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[TTS] Fatal error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
