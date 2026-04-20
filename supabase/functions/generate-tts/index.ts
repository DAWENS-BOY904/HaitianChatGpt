import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const BUCKET_NAME = 'media-files';
const FOLDER_PATH = 'voice-previews';

// Voice → Google TTS language / voice mapping
const VOICE_MAP: Record<string, { languageCode: string; name: string; ssmlGender: string }> = {
  alloy:   { languageCode: 'en-US', name: 'en-US-Neural2-D', ssmlGender: 'MALE' },
  echo:    { languageCode: 'en-GB', name: 'en-GB-Neural2-B', ssmlGender: 'MALE' },
  fable:   { languageCode: 'en-GB', name: 'en-GB-Neural2-D', ssmlGender: 'MALE' },
  onyx:    { languageCode: 'en-US', name: 'en-US-Neural2-J', ssmlGender: 'MALE' },
  nova:    { languageCode: 'en-US', name: 'en-US-Neural2-F', ssmlGender: 'FEMALE' },
  shimmer: { languageCode: 'en-US', name: 'en-US-Neural2-G', ssmlGender: 'FEMALE' },
  coral:   { languageCode: 'en-US', name: 'en-US-Neural2-E', ssmlGender: 'FEMALE' },
};

// Speed → Google TTS speaking rate
function toSpeakingRate(speed: number): number {
  // Google TTS range: 0.25 – 4.0  (1.0 = normal)
  return Math.max(0.5, Math.min(2.0, speed));
}

function generateFileName(): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `voice_${ts}_${rand}.mp3`;
}

// ─── Google TTS (Cloud Text-to-Speech REST API – no auth key needed for Basic voices,
//     Neural2 voices require an API key; we'll try Neural2 first, fall back to Wavenet) ──
async function tryGoogleTTS(
  text: string,
  voice: string,
  speed: number
): Promise<ArrayBuffer | null> {
  const googleApiKey = Deno.env.get('GOOGLE_TTS_API_KEY') ?? '';
  
  // Choose voice config
  const voiceCfg = VOICE_MAP[voice] ?? VOICE_MAP['alloy'];
  const speakingRate = toSpeakingRate(speed);

  // Try Neural2 voices (best quality, requires API key)
  if (googleApiKey) {
    try {
      const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${googleApiKey}`;
      const body = {
        input: { text: text.slice(0, 5000) },
        voice: { languageCode: voiceCfg.languageCode, name: voiceCfg.name, ssmlGender: voiceCfg.ssmlGender },
        audioConfig: { audioEncoding: 'MP3', speakingRate, pitch: 0.0, volumeGainDb: 0.0 },
      };
      console.log(`[TTS] Trying Google Neural2 TTS: ${voiceCfg.name}`);
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20000),
      });
      if (resp.ok) {
        const json = await resp.json();
        if (json.audioContent) {
          const binary = atob(json.audioContent);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          console.log(`[TTS] Google Neural2 success: ${bytes.length} bytes`);
          return bytes.buffer;
        }
      }
      const errText = await resp.text().catch(() => '');
      console.log(`[TTS] Google Neural2 failed (${resp.status}): ${errText.slice(0, 200)}`);
    } catch (e: any) {
      console.log('[TTS] Google Neural2 exception:', e.message);
    }

    // Fall back to Standard voice (same API key)
    try {
      const stdVoice = voiceCfg.name.replace('Neural2', 'Standard');
      const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${googleApiKey}`;
      const body = {
        input: { text: text.slice(0, 5000) },
        voice: { languageCode: voiceCfg.languageCode, name: stdVoice, ssmlGender: voiceCfg.ssmlGender },
        audioConfig: { audioEncoding: 'MP3', speakingRate },
      };
      console.log(`[TTS] Trying Google Standard TTS: ${stdVoice}`);
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20000),
      });
      if (resp.ok) {
        const json = await resp.json();
        if (json.audioContent) {
          const binary = atob(json.audioContent);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          console.log(`[TTS] Google Standard TTS success: ${bytes.length} bytes`);
          return bytes.buffer;
        }
      }
    } catch (e: any) {
      console.log('[TTS] Google Standard exception:', e.message);
    }
  }

  // Free Google TTS (no API key, limited to 200 chars but works for previews)
  try {
    const shortText = text.slice(0, 200);
    const lang = voiceCfg.languageCode;
    const encoded = encodeURIComponent(shortText);
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=${lang}&total=1&idx=0&textlen=${shortText.length}&client=tw-ob&prev=input&ttsspeed=${Math.min(speakingRate, 1.0)}`;
    console.log('[TTS] Trying free Google TTS...');
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VoiceApp/1.0)',
        'Referer': 'https://translate.google.com/',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (resp.ok) {
      const buffer = await resp.arrayBuffer();
      if (buffer.byteLength > 500) {
        console.log(`[TTS] Free Google TTS success: ${buffer.byteLength} bytes`);
        return buffer;
      }
    }
    console.log(`[TTS] Free Google TTS failed: ${resp.status}`);
  } catch (e: any) {
    console.log('[TTS] Free Google TTS exception:', e.message);
  }

  return null;
}

// ─── OpenAI TTS (kept as secondary, may fail on quota) ───────────────────────
async function tryOpenAITTS(text: string, voice: string, speed: number): Promise<ArrayBuffer | null> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) { console.log('[TTS] No OPENAI_API_KEY'); return null; }
  try {
    const validVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
    const oaiVoice = validVoices.includes(voice) ? voice : 'alloy';
    console.log('[TTS] Trying OpenAI TTS...');
    const resp = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'tts-1', voice: oaiVoice, input: text.slice(0, 4096), speed }),
      signal: AbortSignal.timeout(30000),
    });
    console.log(`[TTS] OpenAI response: ${resp.status}`);
    if (!resp.ok) {
      const err = await resp.text().catch(() => '');
      console.log(`[TTS] OpenAI failed (${resp.status}): ${err.slice(0, 200)}`);
      return null;
    }
    const buffer = await resp.arrayBuffer();
    if (buffer.byteLength > 100) {
      console.log(`[TTS] OpenAI success: ${buffer.byteLength} bytes`);
      return buffer;
    }
    return null;
  } catch (e: any) {
    console.log('[TTS] OpenAI exception:', e.message);
    return null;
  }
}

// ─── Upload to Supabase Storage ───────────────────────────────────────────────
async function uploadAudio(bytes: Uint8Array, supabaseAdmin: any): Promise<string | null> {
  const filePath = `${FOLDER_PATH}/${generateFileName()}`;
  const { error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .upload(filePath, bytes, { contentType: 'audio/mpeg', upsert: false, cacheControl: '3600' });
  if (error) { console.error('[TTS] Storage upload error:', error.message); return null; }
  const { data: urlData } = supabaseAdmin.storage.from(BUCKET_NAME).getPublicUrl(filePath);
  return urlData?.publicUrl ?? null;
}

// ─── Fallback signal → client uses expo-speech ───────────────────────────────
function deviceTTSFallback(text: string, voice: string): Response {
  const langMap: Record<string, string> = {
    alloy: 'en-US', echo: 'en-GB', fable: 'en-GB',
    onyx: 'en-US', nova: 'en-US', shimmer: 'en-US', coral: 'en-US',
  };
  return new Response(
    JSON.stringify({
      success: false, fallback: true, text, voice,
      lang: langMap[voice] ?? 'en-US',
      code: 'USE_DEVICE_TTS',
      error: 'TTS providers unavailable — using device speech',
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// ─── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    let body: any;
    try { body = await req.json(); }
    catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }

    const { text, voice = 'alloy', speed = 1.0 } = body;
    if (!text?.trim()) {
      return new Response(JSON.stringify({ error: 'text is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const finalText = String(text).trim().slice(0, 5000);
    const finalVoice = String(voice).toLowerCase();
    const finalSpeed = Math.max(0.5, Math.min(2.0, Number(speed) || 1.0));

    console.log(`[TTS] Request: voice=${finalVoice}, speed=${finalSpeed}, len=${finalText.length}`);

    // ── Provider chain: Google TTS → OpenAI → device fallback ──
    let audioBuffer: ArrayBuffer | null = null;
    let provider = '';

    // 1. Google TTS (best quality, free or paid)
    audioBuffer = await tryGoogleTTS(finalText, finalVoice, finalSpeed);
    if (audioBuffer) provider = 'google';

    // 2. OpenAI TTS (may have quota issues)
    if (!audioBuffer) {
      audioBuffer = await tryOpenAITTS(finalText, finalVoice, finalSpeed);
      if (audioBuffer) provider = 'openai';
    }

    // 3. Device TTS fallback
    if (!audioBuffer) {
      console.log('[TTS] All providers failed — device TTS fallback');
      return deviceTTSFallback(finalText, finalVoice);
    }

    // Upload to storage
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[TTS] Supabase not configured');
      return deviceTTSFallback(finalText, finalVoice);
    }
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const audioBytes = new Uint8Array(audioBuffer);
    const audioUrl = await uploadAudio(audioBytes, supabaseAdmin);

    if (!audioUrl) {
      console.error('[TTS] Upload failed — device TTS fallback');
      return deviceTTSFallback(finalText, finalVoice);
    }

    console.log(`[TTS] Done via ${provider}: ${audioUrl}`);
    return new Response(
      JSON.stringify({
        success: true, audioUrl, audio_url: audioUrl, fallback: false,
        metadata: { voice: finalVoice, speed: finalSpeed, provider, sizeKB: Math.round(audioBytes.length / 1024) },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[TTS] Fatal:', err);
    return new Response(JSON.stringify({ error: 'Internal error', details: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
