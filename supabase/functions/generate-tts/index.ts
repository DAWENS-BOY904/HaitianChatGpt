import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CONFIG = {
  ONSPACE_AI_API_KEY: Deno.env.get('ONSPACE_AI_API_KEY'),
  ONSPACE_AI_BASE_URL: (Deno.env.get('ONSPACE_AI_BASE_URL') || 'https://ai.gateway.onspace.ai').replace(/\\/v1\\/?$/, ''),
  OPENAI_API_KEY: Deno.env.get('OPENAI_API_KEY'),
  ELEVENLABS_API_KEY: Deno.env.get('ELEVENLABS_API_KEY'),
  SUPABASE_URL: Deno.env.get('SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  DEFAULT_VOICE: 'alloy',
  DEFAULT_SPEED: 1.0,
  MAX_TEXT_LENGTH: 4096,
  BUCKET_NAME: 'media-files',
  FOLDER_PATH: 'voice-previews',
  VALID_VOICES: [
    'alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer', 'coral', 'ash', 'sage',
    'PzuBz8h2SxBvQ7lnUC44',
    'jv41DhCf464zw0TI7I1w',
    'kJKMPwrIKzwVkMKOfRtr',
    'flHkNRp1BlvT73UL6gyz',
    'mRdG9GYEjJmIzqbYTidv',
  ] as const,
};

type VoiceType = typeof CONFIG.VALID_VOICES[number];

// ── Voice metadata ──────────────────────────────────────────────────────────
const VOICE_LANG_MAP: Record<string, { lang: string; gender: string }> = {
  alloy:   { lang: 'en-US', gender: 'neutral' },
  echo:    { lang: 'en-GB', gender: 'male'    },
  fable:   { lang: 'en-GB', gender: 'male'    },
  onyx:    { lang: 'en-US', gender: 'male'    },
  nova:    { lang: 'en-US', gender: 'female'  },
  shimmer: { lang: 'en-US', gender: 'female'  },
  coral:   { lang: 'en-US', gender: 'female'  },
  ash:     { lang: 'en-US', gender: 'male'    },
  sage:    { lang: 'en-US', gender: 'female'  },
  'PzuBz8h2SxBvQ7lnUC44': { lang: 'en-US', gender: 'female' },
  'jv41DhCf464zw0TI7I1w': { lang: 'en-US', gender: 'male'   },
  'kJKMPwrIKzwVkMKOfRtr': { lang: 'en-US', gender: 'female' },
  'flHkNRp1BlvT73UL6gyz': { lang: 'en-US', gender: 'male'   },
  'mRdG9GYEjJmIzqbYTidv': { lang: 'en-US', gender: 'female' },
};

// Map named voices to ElevenLabs voice IDs
const ELEVENLABS_VOICE_MAP: Record<string, string> = {
  alloy:   'pNInz6obpgDQGcFmaJgB',
  echo:    'VR6AewLTigWG4xSOukaG',
  fable:   'yoZ06aMxZJJ28mfd3POQ',
  onyx:    'GBv7mTt0atIp3Br8iCZE',
  nova:    '21m00Tcm4TlvDq8ikWAM',
  shimmer: 'AZnzlk1XvdvUeBnXmlld',
  coral:   'EXAVITQu4vr4xnSDxMaL',
  ash:     'pqHfZKP75CvOlQylNhV4',
  sage:    'ThT5KcBeYPX3keUQqHPh',
  'PzuBz8h2SxBvQ7lnUC44': 'PzuBz8h2SxBvQ7lnUC44',
  'jv41DhCf464zw0TI7I1w': 'jv41DhCf464zw0TI7I1w',
  'kJKMPwrIKzwVkMKOfRtr': 'kJKMPwrIKzwVkMKOfRtr',
  'flHkNRp1BlvT73UL6gyz': 'flHkNRp1BlvT73UL6gyz',
  'mRdG9GYEjJmIzqbYTidv': 'mRdG9GYEjJmIzqbYTidv',
  'pNInz6obpgDQGcFmaJgB': 'pNInz6obpgDQGcFmaJgB',
  '21m00Tcm4TlvDq8ikWAM': '21m00Tcm4TlvDq8ikWAM',
  'AZnzlk1XvdvUeBnXmlld': 'AZnzlk1XvdvUeBnXmlld',
  'EXAVITQu4vr4xnSDxMaL': 'EXAVITQu4vr4xnSDxMaL',
  'VR6AewLTigWG4xSOukaG': 'VR6AewLTigWG4xSOukaG',
  'GBv7mTt0atIp3Br8iCZE': 'GBv7mTt0atIp3Br8iCZE',
  'yoZ06aMxZJJ28mfd3POQ': 'yoZ06aMxZJJ28mfd3POQ',
  'ThT5KcBeYPX3keUQqHPh': 'ThT5KcBeYPX3keUQqHPh',
  'pqHfZKP75CvOlQylNhV4': 'pqHfZKP75CvOlQylNhV4',
};

function resolveElevenLabsVoiceId(voice: string): string {
  if (ELEVENLABS_VOICE_MAP[voice]) return ELEVENLABS_VOICE_MAP[voice];
  if (voice.length >= 10) return voice;
  return 'pNInz6obpgDQGcFmaJgB';
}

function getElevenLabsModel(detectedLang?: string): string {
  if (!detectedLang) return 'eleven_turbo_v2_5';
  const lang = detectedLang.toLowerCase().split('-')[0];
  const multilingualSupported = ['de','pl','es','it','fr','pt','hi','ar','cs','sk','ro','bg','uk','hr','fa','nl','ht'];
  if (multilingualSupported.includes(lang)) return 'eleven_multilingual_v2';
  return 'eleven_turbo_v2_5';
}

function generateFileName(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `voice_${timestamp}_${random}.mp3`;
}

// ── Provider 1: OpenAI TTS ────────────────────────────────────────────────
async function tryOpenAITTS(text: string, voice: string, speed: number, lang?: string): Promise<ArrayBuffer | null> {
  const apiKey = CONFIG.OPENAI_API_KEY;
  if (!apiKey) {
    console.log('[TTS] OPENAI_API_KEY not set — skipping OpenAI');
    return null;
  }
  const isCustomId = voice.length > 12;
  const openaiVoice = isCustomId ? 'nova' : voice;

  try {
    console.log('[TTS] Trying OpenAI TTS...');
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1-hd',
        voice: openaiVoice,
        input: text,
        speed: Math.max(0.25, Math.min(4.0, speed)),
        response_format: 'mp3',
      }),
      signal: AbortSignal.timeout(40000),
    });

    console.log(`[TTS] OpenAI response: ${response.status}`);

    if (!response.ok) {
      const errText = await response.text().catch(() => response.statusText);
      console.log(`[TTS] OpenAI failed (${response.status}): ${errText.slice(0, 200)}`);
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
    console.log('[TTS] OpenAI exception:', e.message);
    return null;
  }
}

// ── Provider 2: ElevenLabs TTS ─────────────────────────────────────────────
async function tryElevenLabsTTS(text: string, voice: string, detectedLang?: string): Promise<ArrayBuffer | null> {
  const apiKey = CONFIG.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.log('[TTS] ELEVENLABS_API_KEY not set — skipping ElevenLabs');
    return null;
  }

  const voiceId = resolveElevenLabsVoiceId(voice);
  const modelId = getElevenLabsModel(detectedLang);

  try {
    console.log(`[TTS] Trying ElevenLabs TTS — voice: ${voiceId}, model: ${modelId}`);
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text: text.slice(0, 5000),
        model_id: modelId,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true,
        },
      }),
      signal: AbortSignal.timeout(45000),
    });

    console.log(`[TTS] ElevenLabs response: ${response.status}`);

    if (!response.ok) {
      const errText = await response.text().catch(() => response.statusText);
      console.log(`[TTS] ElevenLabs failed (${response.status}): ${errText.slice(0, 300)}`);
      if (response.status === 401 || response.status === 403) {
        const isUnusualActivity = errText.includes('unusual_activity') || errText.includes('Unusual activity');
        if (isUnusualActivity) {
          console.log('[TTS] ElevenLabs Free Tier unusual activity — skipping to OpenAI');
        }
      }
      return null;
    }

    const buffer = await response.arrayBuffer();
    if (!buffer || buffer.byteLength < 100) {
      console.log('[TTS] ElevenLabs returned empty buffer');
      return null;
    }
    console.log(`[TTS] ElevenLabs TTS success: ${buffer.byteLength} bytes`);
    return buffer;
  } catch (e: any) {
    console.log('[TTS] ElevenLabs exception:', e.message);
    return null;
  }
}

// ── Provider 3: OnSpace AI ─────────────────────────────────────────────────
async function tryOnSpaceAISpeech(text: string, voice: string, speed: number): Promise<ArrayBuffer | null> {
  const apiKey = CONFIG.ONSPACE_AI_API_KEY;
  const baseUrl = CONFIG.ONSPACE_AI_BASE_URL;
  if (!apiKey || !baseUrl) {
    console.log('[TTS] OnSpace AI keys not set — skipping');
    return null;
  }

  const isCustomId = voice.length > 12;
  const openaiVoice = isCustomId ? 'nova' : voice;
  const endpoint = `${baseUrl}/v1/audio/speech`;

  try {
    console.log(`[TTS] Trying OnSpace AI speech at: ${endpoint}`);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        voice: openaiVoice,
        input: text,
        speed: Math.max(0.25, Math.min(4.0, speed)),
        response_format: 'mp3',
      }),
      signal: AbortSignal.timeout(35000),
    });

    console.log(`[TTS] OnSpace AI speech: ${response.status}`);

    if (!response.ok) {
      const errText = await response.text().catch(() => response.statusText);
      console.log(`[TTS] OnSpace AI failed (${response.status}): ${errText.slice(0, 150)}`);
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const json = await response.json().catch(() => ({}));
      const b64 = json.audio || json.data || json.audio_data;
      if (b64 && typeof b64 === 'string') {
        try {
          const decoded = atob(b64.replace(/^data:audio\\/[^;]+;base64,/, ''));
          const bytes = Uint8Array.from(decoded, c => c.charCodeAt(0));
          if (bytes.length > 100) {
            console.log(`[TTS] OnSpace AI audio from JSON: ${bytes.length} bytes`);
            return bytes.buffer;
          }
        } catch {}
      }
      return null;
    }

    const buffer = await response.arrayBuffer();
    if (!buffer || buffer.byteLength < 100) {
      console.log('[TTS] OnSpace AI returned too-small buffer');
      return null;
    }
    console.log(`[TTS] OnSpace AI speech success: ${buffer.byteLength} bytes`);
    return buffer;
  } catch (e: any) {
    console.log(`[TTS] OnSpace AI exception:`, e.message);
    return null;
  }
}

// ── Device TTS fallback ────────────────────────────────────────────────────
function buildFallbackResponse(text: string, voice: string, detectedLang?: string): Response {
  const voiceInfo = VOICE_LANG_MAP[voice] || { lang: 'en-US', gender: 'neutral' };
  const lang = detectedLang || voiceInfo.lang;
  console.log('[TTS] All providers failed — returning device TTS fallback signal');
  return new Response(
    JSON.stringify({
      success: false,
      fallback: true,
      text,
      voice,
      lang,
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

// ── Upload audio buffer to Supabase storage ──────────────────────────────────
async function uploadAudio(audioBytes: Uint8Array, supabaseAdmin: any): Promise<string | null> {
  const fileName = generateFileName();
  const filePath = `${CONFIG.FOLDER_PATH}/${fileName}`;

  try {
    const { data, error } = await supabaseAdmin.storage
      .from(CONFIG.BUCKET_NAME)
      .upload(filePath, audioBytes, {
        contentType: 'audio/mpeg',
        upsert: false,
        cacheControl: '3600',
      });

    if (error) {
      console.error('[TTS] Storage upload error:', error.message);
      const altPath = `tts/${fileName}`;
      const { error: altErr } = await supabaseAdmin.storage
        .from(CONFIG.BUCKET_NAME)
        .upload(altPath, audioBytes, { contentType: 'audio/mpeg', upsert: true });
      if (altErr) {
        console.error('[TTS] Alt storage upload error:', altErr.message);
        return null;
      }
      const { data: altUrl } = supabaseAdmin.storage.from(CONFIG.BUCKET_NAME).getPublicUrl(altPath);
      return altUrl?.publicUrl || null;
    }

    const { data: urlData } = supabaseAdmin.storage.from(CONFIG.BUCKET_NAME).getPublicUrl(filePath);
    return urlData?.publicUrl || null;
  } catch (e: any) {
    console.error('[TTS] Upload exception:', e.message);
    return null;
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────
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

    const { text, voice, speed, detectedLanguage, action } = body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const finalText = text.trim().slice(0, CONFIG.MAX_TEXT_LENGTH);
    const isValidVoice = CONFIG.VALID_VOICES.includes(voice as VoiceType) || (typeof voice === 'string' && voice.length > 5);
    const finalVoice = isValidVoice ? voice : CONFIG.DEFAULT_VOICE;
    const finalSpeed = Math.max(0.25, Math.min(4.0, Number(speed) || CONFIG.DEFAULT_SPEED));

    console.log(`[TTS] Request: voice=${finalVoice}, speed=${finalSpeed}, len=${finalText.length}, lang=${detectedLanguage || 'auto'}`);
    console.log(`[TTS] Available keys: OpenAI=${!!CONFIG.OPENAI_API_KEY}, ElevenLabs=${!!CONFIG.ELEVENLABS_API_KEY}, OnSpace=${!!CONFIG.ONSPACE_AI_API_KEY}`);

    let audioBuffer: ArrayBuffer | null = null;
    let usedProvider = '';

    audioBuffer = await tryOpenAITTS(finalText, finalVoice, finalSpeed, detectedLanguage);
    if (audioBuffer) usedProvider = 'openai';

    if (!audioBuffer) {
      audioBuffer = await tryElevenLabsTTS(finalText, finalVoice, detectedLanguage);
      if (audioBuffer) usedProvider = 'elevenlabs';
    }

    if (!audioBuffer) {
      audioBuffer = await tryOnSpaceAISpeech(finalText, finalVoice, finalSpeed);
      if (audioBuffer) usedProvider = 'onspace-speech';
    }

    if (!audioBuffer) {
      return buildFallbackResponse(finalText, finalVoice, detectedLanguage);
    }

    const supabaseAdmin = createClient(CONFIG.SUPABASE_URL!, CONFIG.SUPABASE_SERVICE_ROLE_KEY!);
    const audioUint8 = new Uint8Array(audioBuffer);
    const audioUrl = await uploadAudio(audioUint8, supabaseAdmin);

    if (!audioUrl) {
      console.error('[TTS] Upload failed — falling back to device TTS');
      return buildFallbackResponse(finalText, finalVoice, detectedLanguage);
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
          detectedLanguage: detectedLanguage || null,
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
