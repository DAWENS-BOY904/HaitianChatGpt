import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CONFIG = {
  ELEVENLABS_API_KEY: Deno.env.get('ELEVENLABS_API_KEY'),
  SUPABASE_URL: Deno.env.get('SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  DEFAULT_VOICE: 'pNInz6obpgDQGcFmaJgB', // Adam — default ElevenLabs voice
  DEFAULT_SPEED: 1.0,
  MAX_TEXT_LENGTH: 5000,
  BUCKET_NAME: 'media-files',
  FOLDER_PATH: 'voice-previews',
};

// ── All valid ElevenLabs voice IDs used in the app ──────────────────────────
const KNOWN_ELEVENLABS_VOICES: Record<string, string> = {
  'pNInz6obpgDQGcFmaJgB': 'Adam',
  '21m00Tcm4TlvDq8ikWAM': 'Rachel',
  'AZnzlk1XvdvUeBnXmlld': 'Domi',
  'EXAVITQu4vr4xnSDxMaL': 'Bella',
  'VR6AewLTigWG4xSOukaG': 'Arnold',
  'GBv7mTt0atIp3Br8iCZE': 'Thomas',
  'yoZ06aMxZJJ28mfd3POQ': 'Sam',
  'ThT5KcBeYPX3keUQqHPh': 'Dorothy',
  'pqHfZKP75CvOlQylNhV4': 'Bill',
};

function resolveElevenLabsVoiceId(voice: string): string {
  // Direct match — known voice ID
  if (KNOWN_ELEVENLABS_VOICES[voice]) return voice;
  // Looks like a custom ElevenLabs ID (alphanumeric, 10+ chars)
  if (voice && voice.length >= 10 && /^[a-zA-Z0-9]+$/.test(voice)) return voice;
  // Fallback to Adam
  return CONFIG.DEFAULT_VOICE;
}

function getElevenLabsModel(detectedLang?: string): string {
  if (!detectedLang) return 'eleven_turbo_v2_5';
  const lang = detectedLang.toLowerCase().split('-')[0];
  // Use multilingual model for non-English languages
  const multilingualSupported = [
    'de', 'pl', 'es', 'it', 'fr', 'pt', 'hi', 'ar', 'cs', 'sk', 'ro',
    'bg', 'uk', 'hr', 'fa', 'nl', 'ht', 'zh', 'ja', 'ko', 'tr', 'id',
    'sv', 'da', 'no', 'fi', 'el', 'hu', 'vi', 'ms',
  ];
  if (multilingualSupported.includes(lang)) return 'eleven_multilingual_v2';
  return 'eleven_turbo_v2_5';
}

function generateFileName(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `voice_${timestamp}_${random}.mp3`;
}

// ── ElevenLabs TTS (sole provider) ──────────────────────────────────────────
async function tryElevenLabsTTS(
  text: string,
  voiceId: string,
  detectedLang?: string,
  stability = 0.5,
  similarityBoost = 0.78,
): Promise<ArrayBuffer | null> {
  const apiKey = CONFIG.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.log('[TTS] ELEVENLABS_API_KEY not set');
    return null;
  }

  const modelId = getElevenLabsModel(detectedLang);

  try {
    console.log(`[TTS] ElevenLabs: voice=${voiceId}, model=${modelId}, lang=${detectedLang || 'auto'}`);
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
          stability,
          similarity_boost: similarityBoost,
          style: 0.0,
          use_speaker_boost: true,
        },
        output_format: 'mp3_44100_128',
      }),
      signal: AbortSignal.timeout(45000),
    });

    console.log(`[TTS] ElevenLabs response: ${response.status}`);

    if (!response.ok) {
      const errText = await response.text().catch(() => response.statusText);
      console.log(`[TTS] ElevenLabs failed (${response.status}): ${errText.slice(0, 300)}`);
      return null;
    }

    const buffer = await response.arrayBuffer();
    if (!buffer || buffer.byteLength < 100) {
      console.log('[TTS] ElevenLabs: empty or too-small buffer');
      return null;
    }
    console.log(`[TTS] ElevenLabs success: ${buffer.byteLength} bytes`);
    return buffer;
  } catch (e: any) {
    console.log('[TTS] ElevenLabs exception:', e.message);
    return null;
  }
}

// ── Device TTS fallback ────────────────────────────────────────────────────
function buildFallbackResponse(text: string, voice: string, detectedLang?: string): Response {
  const lang = detectedLang || 'en-US';
  console.log('[TTS] ElevenLabs unavailable — returning device TTS fallback');
  return new Response(
    JSON.stringify({
      success: false,
      fallback: true,
      text,
      voice,
      lang,
      error: 'ElevenLabs unavailable — use device speech synthesis',
      code: 'USE_DEVICE_TTS',
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

// ── Upload audio to Supabase Storage ─────────────────────────────────────────
async function uploadAudio(audioBytes: Uint8Array, supabaseAdmin: any): Promise<string | null> {
  const fileName = generateFileName();
  const filePath = `${CONFIG.FOLDER_PATH}/${fileName}`;

  try {
    const { error } = await supabaseAdmin.storage
      .from(CONFIG.BUCKET_NAME)
      .upload(filePath, audioBytes, {
        contentType: 'audio/mpeg',
        upsert: false,
        cacheControl: '3600',
      });

    if (error) {
      console.error('[TTS] Storage upload error:', error.message);
      // Retry with alt path
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

// ── Language name → ElevenLabs language code map ───────────────────────────
const LANGUAGE_NAME_TO_CODE: Record<string, string> = {
  'english': 'en', 'french': 'fr', 'spanish': 'es', 'haitian creole': 'ht',
  'portuguese': 'pt', 'german': 'de', 'italian': 'it', 'arabic': 'ar',
  'chinese': 'zh', 'japanese': 'ja', 'korean': 'ko', 'russian': 'ru',
  'hindi': 'hi', 'dutch': 'nl', 'polish': 'pl', 'swedish': 'sv',
  'danish': 'da', 'norwegian': 'no', 'finnish': 'fi', 'greek': 'el',
  'hungarian': 'hu', 'czech': 'cs', 'slovak': 'sk', 'romanian': 'ro',
  'bulgarian': 'bg', 'ukrainian': 'uk', 'croatian': 'hr', 'turkish': 'tr',
  'indonesian': 'id', 'malay': 'ms', 'vietnamese': 'vi', 'thai': 'th',
  'hebrew': 'he', 'persian': 'fa', 'catalan': 'ca', 'afrikaans': 'af',
  'bengali': 'bn', 'gujarati': 'gu', 'malayalam': 'ml', 'marathi': 'mr',
  'telugu': 'te', 'punjabi': 'pa', 'urdu': 'ur', 'swahili': 'sw',
  'tamil': 'ta', 'nepali': 'ne', 'sinhala': 'si', 'khmer': 'km',
  'lao': 'lo', 'burmese': 'my', 'amharic': 'am', 'somali': 'so',
  'yoruba': 'yo', 'hausa': 'ha', 'zulu': 'zu', 'xhosa': 'xh',
  'albanian': 'sq', 'serbian': 'sr', 'macedonian': 'mk', 'icelandic': 'is',
  'irish': 'ga', 'welsh': 'cy', 'basque': 'eu', 'galician': 'gl',
  'azerbaijani': 'az', 'kazakh': 'kk', 'uzbek': 'uz', 'georgian': 'ka',
  'armenian': 'hy', 'mongolian': 'mn', 'pashto': 'ps', 'kurdish': 'ku',
  'luxembourgish': 'lb', 'maltese': 'mt', 'bosnian': 'bs',
};

function resolveLanguageCode(mainLanguage?: string, detectedLanguage?: string): string | undefined {
  if (detectedLanguage) return detectedLanguage;
  if (!mainLanguage) return undefined;
  const key = mainLanguage.toLowerCase().trim();
  return LANGUAGE_NAME_TO_CODE[key] || undefined;
}

// ── Fetch user mainLanguage from user_settings ────────────────────────────
async function getUserMainLanguage(userId: string | undefined, supabaseAdmin: any): Promise<string | undefined> {
  if (!userId) return undefined;
  try {
    const { data } = await supabaseAdmin
      .from('user_settings')
      .select('main_language')
      .eq('user_id', userId)
      .single();
    return data?.main_language || undefined;
  } catch (_e) {
    return undefined;
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

    const { text, voice, detectedLanguage, userId } = body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const finalText = text.trim().slice(0, CONFIG.MAX_TEXT_LENGTH);
    const finalVoice = (typeof voice === 'string' && voice.trim().length > 0)
      ? resolveElevenLabsVoiceId(voice.trim())
      : CONFIG.DEFAULT_VOICE;

    // ── Resolve language: detectedLanguage > user mainLanguage setting > auto ──
    const supabaseAdmin = createClient(CONFIG.SUPABASE_URL!, CONFIG.SUPABASE_SERVICE_ROLE_KEY!);
    const userMainLang = await getUserMainLanguage(userId, supabaseAdmin);
    const resolvedLang = resolveLanguageCode(userMainLang, detectedLanguage);

    console.log(`[TTS] Request: voice=${finalVoice} (${KNOWN_ELEVENLABS_VOICES[finalVoice] || 'custom'}), lang=${resolvedLang || 'auto'} (detected=${detectedLanguage}, mainLang=${userMainLang}), len=${finalText.length}`);

    // ElevenLabs is the sole provider
    const audioBuffer = await tryElevenLabsTTS(finalText, finalVoice, resolvedLang);

    if (!audioBuffer) {
      return buildFallbackResponse(finalText, finalVoice, resolvedLang);
    }

    const audioUint8 = new Uint8Array(audioBuffer);
    const audioUrl = await uploadAudio(audioUint8, supabaseAdmin);

    if (!audioUrl) {
      console.error('[TTS] Upload failed — fallback to device TTS');
      return buildFallbackResponse(finalText, finalVoice, resolvedLang);
    }

    console.log(`[TTS] Done via ElevenLabs: ${audioUrl}`);

    return new Response(
      JSON.stringify({
        success: true,
        audioUrl,
        audio_url: audioUrl,
        fallback: false,
        metadata: {
          voice: finalVoice,
          voiceName: KNOWN_ELEVENLABS_VOICES[finalVoice] || 'custom',
          textLength: finalText.length,
          audioSizeKB: parseFloat((audioUint8.length / 1024).toFixed(1)),
          provider: 'elevenlabs',
          detectedLanguage: resolvedLang || null,
          mainLanguage: userMainLang || null,
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
