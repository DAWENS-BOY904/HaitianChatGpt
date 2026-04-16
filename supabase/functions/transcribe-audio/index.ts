import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-request-id, x-timeout',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse body safely
    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { audio, userId, conversationId, language } = body;

    if (!audio || typeof audio !== 'string' || audio.length < 100) {
      return new Response(
        JSON.stringify({ error: 'No valid audio data provided', warning: 'No speech detected. Please try again.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use OnSpace AI (Gemini multimodal — supports audio input → text output)
    const ONSPACE_AI_API_KEY = Deno.env.get('ONSPACE_AI_API_KEY');
    const ONSPACE_AI_BASE_URL = Deno.env.get('ONSPACE_AI_BASE_URL');

    if (!ONSPACE_AI_API_KEY || !ONSPACE_AI_BASE_URL) {
      console.error('OnSpace AI not configured');
      return new Response(
        JSON.stringify({ error: 'Transcription service not configured. Please contact support.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate base64
    let audioBuffer: Uint8Array;
    try {
      const decoded = atob(audio);
      audioBuffer = Uint8Array.from(decoded, (c) => c.charCodeAt(0));
    } catch (e) {
      return new Response(
        JSON.stringify({ error: 'Invalid base64 audio encoding' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (audioBuffer.length < 1000) {
      return new Response(
        JSON.stringify({ text: '', warning: 'Audio too short. Please speak for at least 1 second.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const MAX_SIZE = 20 * 1024 * 1024; // 20 MB
    if (audioBuffer.length > MAX_SIZE) {
      return new Response(
        JSON.stringify({ error: 'Audio file too large. Maximum 20MB allowed.' }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Transcribing audio via OnSpace AI: ${audioBuffer.length} bytes`);

    // Build the language hint
    const langHint = language ? ` The audio is likely in ${language}.` : '';

    // Call OnSpace AI with Gemini multimodal (audio → text)
    // Gemini 3 flash supports audio input natively
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);

    let transcribedText = '';
    try {
      const response = await fetch(`${ONSPACE_AI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ONSPACE_AI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [
            {
              role: 'system',
              content: `You are a highly accurate speech transcription assistant. 
Your ONLY job is to transcribe exactly what is spoken in the audio.
Rules:
- Output ONLY the transcribed text, nothing else
- Do NOT add explanations, commentary, or notes
- Do NOT add punctuation unless it was clearly spoken
- Preserve the original language (English, Haitian Creole, French, Spanish, etc.)
- If audio is silent or inaudible, output only: [SILENCE]
- If speech is unclear, transcribe your best attempt${langHint}`,
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Please transcribe the speech in this audio file exactly as spoken:',
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:audio/m4a;base64,${audio}`,
                  },
                },
              ],
            },
          ],
          max_tokens: 1000,
          temperature: 0.0,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errText = await response.text();
        console.error('OnSpace AI transcription error:', response.status, errText);

        // Fallback: try with a smaller, lighter model if the multimodal one fails
        throw new Error(`OnSpace AI error ${response.status}: ${errText}`);
      }

      const data = await response.json();
      transcribedText = (data.choices?.[0]?.message?.content || '').trim();

    } catch (err: any) {
      clearTimeout(timeout);

      if (err.name === 'AbortError') {
        return new Response(
          JSON.stringify({ error: 'Transcription timed out. Please try a shorter recording.' }),
          { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // If primary model failed, attempt fallback with gemini-2.5-flash-lite
      console.log('Primary model failed, trying fallback model...');
      try {
        const fallbackController = new AbortController();
        const fallbackTimeout = setTimeout(() => fallbackController.abort(), 30000);

        const fallbackResponse = await fetch(`${ONSPACE_AI_BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ONSPACE_AI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash-lite',
            messages: [
              {
                role: 'system',
                content: `You are a speech transcription assistant. Transcribe ONLY what is spoken in the audio. Output only the transcription text, nothing else.${langHint}`,
              },
              {
                role: 'user',
                content: [
                  { type: 'text', text: 'Transcribe this audio:' },
                  {
                    type: 'image_url',
                    image_url: { url: `data:audio/m4a;base64,${audio}` },
                  },
                ],
              },
            ],
            max_tokens: 800,
            temperature: 0.0,
          }),
          signal: fallbackController.signal,
        });

        clearTimeout(fallbackTimeout);

        if (!fallbackResponse.ok) {
          const fallbackErr = await fallbackResponse.text();
          throw new Error(`Fallback model error: ${fallbackErr}`);
        }

        const fallbackData = await fallbackResponse.json();
        transcribedText = (fallbackData.choices?.[0]?.message?.content || '').trim();

      } catch (fallbackErr: any) {
        console.error('Fallback transcription also failed:', fallbackErr);
        return new Response(
          JSON.stringify({ error: 'Transcription service temporarily unavailable. Please try again.' }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Handle silence marker
    if (!transcribedText || transcribedText === '[SILENCE]' || transcribedText.toLowerCase().includes('no speech')) {
      return new Response(
        JSON.stringify({ text: '', warning: 'No speech detected. Please speak clearly and try again.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean up any potential AI commentary that leaked through
    let cleanText = transcribedText
      .replace(/^(transcription:|here is the transcription:|the speaker says:|i hear:)/i, '')
      .replace(/^\[transcription\]:/i, '')
      .trim();

    console.log(`Transcription successful: "${cleanText.substring(0, 80)}..."`);

    // Log to activity_logs (non-blocking)
    if (userId) {
      try {
        const supabaseAdmin = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        await supabaseAdmin.from('activity_logs').insert({
          user_id: userId,
          action: 'voice_transcription',
          action_type: 'audio',
          details: { length: audioBuffer.length, textLength: cleanText.length, conversationId, provider: 'onspace-ai' },
        }).catch(() => {});
      } catch (_e) {}
    }

    return new Response(
      JSON.stringify({
        success: true,
        text: cleanText,
        language: language || 'auto',
        confidence: 0.92,
        provider: 'onspace-ai',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Fatal transcribe-audio error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error during transcription' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
