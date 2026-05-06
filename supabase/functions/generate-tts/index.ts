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

// Language name → ElevenLabs language code map
const LANG_NAME_TO_CODE: Record<string, string> = {
  'English': 'en', 'Chinese': 'zh', 'Spanish': 'es', 'Hindi': 'hi',
  'French': 'fr', 'German': 'de', 'Japanese': 'ja', 'Portuguese': 'pt',
  'Arabic': 'ar', 'Korean': 'ko', 'Italian': 'it', 'Dutch': 'nl',
  'Polish': 'pl', 'Russian': 'ru', 'Swedish': 'sv', 'Turkish': 'tr',
  'Indonesian': 'id', 'Filipino': 'fil', 'Malay': 'ms', 'Romanian': 'ro',
  'Ukrainian': 'uk', 'Greek': 'el', 'Czech': 'cs', 'Danish': 'da',
  'Finnish': 'fi', 'Norwegian': 'no', 'Hungarian': 'hu', 'Slovak': 'sk',
  'Bulgarian': 'bg', 'Croatian': 'hr', 'Tamil': 'ta', 'Vietnamese': 'vi',
  'Thai': 'th', 'Hebrew': 'he', 'Catalan': 'ca', 'Afrikaans': 'af',
  'Bengali': 'bn', 'Gujarati': 'gu', 'Malayalam': 'ml', 'Marathi': 'mr',
  'Telugu': 'te', 'Punjabi': 'pa', 'Urdu': 'ur', 'Swahili': 'sw',
  'Haitian Creole': 'ht', 'Lithuanian': 'lt', 'Latvian': 'lv',
  'Estonian': 'et', 'Slovenian': 'sl', 'Albanian': 'sq', 'Serbian': 'sr',
  'Macedonian': 'mk', 'Icelandic': 'is', 'Irish': 'ga', 'Welsh': 'cy',
  'Azerbaijani': 'az', 'Georgian': 'ka', 'Armenian': 'hy',
  'Persian': 'fa', 'Mongolian': 'mn', 'Nepali': 'ne',
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
  if (KNOWN_ELEVENLABS_VOICES[voice]) return voice;
  if (voice && voice.length >= 10 && /^[a-zA-Z0-9]+$/.test(voice)) return voice;
  return CONFIG.DEFAULT_VOICE;
}

function getElevenLabsModel(langCode?: string): string {
  if (!langCode) return 'eleven_turbo_v2_5';
  const lang = langCode.toLowerCase().split('-')[0];
  const multilingualSupported = [
    'de', 'pl', 'es', 'it', 'fr', 'pt', 'hi', 'ar', 'cs', 'sk', 'ro',
    'bg', 'uk', 'hr', 'fa', 'nl', 'ht', 'zh', 'ja', 'ko', 'tr', 'id',
    'sv', 'da', 'no', 'fi', 'el', 'hu', 'vi', 'ms', 'ta', 'fil',
  ];
  if (multilingualSupported.includes(lang)) return 'eleven_multilingual_v2';
  return 'eleven_turbo_v2_5';
}

function generateFileName(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `voice_${timestamp}_${random}.mp3`;
}

// ── ElevenLabs TTS ────────────────────────────────────────────────────────────
async function tryElevenLabsTTS(
  text: string,
  voiceId: string,
  langCode?: string,
  stability = 0.5,
  similarityBoost = 0.78,
): Promise<ArrayBuffer | null> {
  const apiKey = CONFIG.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.log('[TTS] ELEVENLABS_API_KEY not set');
    return null;
  }

  const modelId = getElevenLabsModel(langCode);

  // Build request body — only include language_code for multilingual model
  const requestBody: Record<string, unknown> = {
    text: text.slice(0, 5000),
    model_id: modelId,
    voice_settings: {
      stability,
      similarity_boost: similarityBoost,
      style: 0.0,
      use_speaker_boost: true,
    },
    output_format: 'mp3_44100_128',
  };

  // language_code only supported by multilingual model
  if (modelId === 'eleven_multilingual_v2' && langCode && langCode !== 'en') {
    requestBody.language_code = langCode;
  }

  try {
    console.log(`[TTS] ElevenLabs: voice=${voiceId}, model=${modelId}, lang=${langCode || 'auto'}`);
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify(requestBody),
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
function buildFallbackResponse(text: string, voice: string, langCode?: string): Response {
  const lang = langCode || 'en-US';
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

    // ── Resolve language: detectedLanguage → user mainLanguage setting ────────
    let resolvedLangCode: string | undefined = detectedLanguage;

    if (!resolvedLangCode && userId) {
      try {
        const supabaseAdmin = createClient(CONFIG.SUPABASE_URL!, CONFIG.SUPABASE_SERVICE_ROLE_KEY!);
        const { data: settingsData } = await supabaseAdmin
          .from('user_settings')
          .select('main_language')
          .eq('user_id', userId)
          .single();
        if (settingsData?.main_language) {
          const mapped = LANG_NAME_TO_CODE[settingsData.main_language];
          if (mapped) {
            resolvedLangCode = mapped;
            console.log(`[TTS] mainLanguage from settings: "${settingsData.main_language}" → "${mapped}"`);
          }
        }
      } catch (e: any) {
        console.log('[TTS] Could not fetch user mainLanguage:', e.message);
      }
    }

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

    console.log(`[TTS] Request: voice=${finalVoice} (${KNOWN_ELEVENLABS_VOICES[finalVoice] || 'custom'}), len=${finalText.length}, lang=${resolvedLangCode || 'auto'}`);

    const audioBuffer = await tryElevenLabsTTS(finalText, finalVoice, resolvedLangCode);

    if (!audioBuffer) {
      return buildFallbackResponse(finalText, finalVoice, resolvedLangCode);
    }

    const supabaseAdmin = createClient(CONFIG.SUPABASE_URL!, CONFIG.SUPABASE_SERVICE_ROLE_KEY!);
    const audioUint8 = new Uint8Array(audioBuffer);
    const audioUrl = await uploadAudio(audioUint8, supabaseAdmin);

    if (!audioUrl) {
      console.error('[TTS] Upload failed — fallback to device TTS');
      return buildFallbackResponse(finalText, finalVoice, resolvedLangCode);
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
          detectedLanguage: resolvedLangCode || null,
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
