import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-request-id, x-timeout',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
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

    const { audio, userId, conversationId, language } = body;

    if (!audio || typeof audio !== 'string' || audio.length < 100) {
      return new Response(
        JSON.stringify({ error: 'No valid audio data provided', warning: 'No speech detected. Please try again.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    const MAX_SIZE = 25 * 1024 * 1024; // 25 MB (Whisper limit)
    if (audioBuffer.length > MAX_SIZE) {
      return new Response(
        JSON.stringify({ error: 'Audio file too large. Maximum 25MB allowed.' }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Transcribe] Audio size: ${audioBuffer.length} bytes`);

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const ONSPACE_AI_API_KEY = Deno.env.get('ONSPACE_AI_API_KEY');
    const ONSPACE_AI_BASE_URL = Deno.env.get('ONSPACE_AI_BASE_URL');

    let transcribedText = '';
    let detectedLanguage = language || 'auto';
    let provider = '';

    // ── Provider 1: OpenAI Whisper (most accurate, fastest) ──────────────────
    if (OPENAI_API_KEY && !transcribedText) {
      try {
        console.log('[Transcribe] Trying OpenAI Whisper...');

        // Build multipart form data manually
        const boundary = `----FormBoundary${Math.random().toString(36).slice(2)}`;
        const CRLF = '\r\n';

        // File part
        const fileHeader = `--${boundary}${CRLF}Content-Disposition: form-data; name="file"; filename="audio.m4a"${CRLF}Content-Type: audio/mp4${CRLF}${CRLF}`;
        const modelPart = `${CRLF}--${boundary}${CRLF}Content-Disposition: form-data; name="model"${CRLF}${CRLF}whisper-1${CRLF}`;
        const responsePart = `--${boundary}${CRLF}Content-Disposition: form-data; name="response_format"${CRLF}${CRLF}json${CRLF}`;
        const langPart = language ? `--${boundary}${CRLF}Content-Disposition: form-data; name="language"${CRLF}${CRLF}${language}${CRLF}` : '';
        const closingBoundary = `--${boundary}--${CRLF}`;

        const enc = new TextEncoder();
        const fileHeaderBytes = enc.encode(fileHeader);
        const afterFileBytes = enc.encode(modelPart + responsePart + langPart + closingBoundary);

        const formData = new Uint8Array(
          fileHeaderBytes.length + audioBuffer.length + afterFileBytes.length
        );
        formData.set(fileHeaderBytes, 0);
        formData.set(audioBuffer, fileHeaderBytes.length);
        formData.set(afterFileBytes, fileHeaderBytes.length + audioBuffer.length);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);

        const whisperResp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
          },
          body: formData,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (whisperResp.ok) {
          const whisperData = await whisperResp.json();
          transcribedText = (whisperData.text || '').trim();
          provider = 'openai-whisper';
          console.log(`[Transcribe] Whisper success: "${transcribedText.slice(0, 60)}..."`);
        } else {
          const errTxt = await whisperResp.text().catch(() => '');
          console.log(`[Transcribe] Whisper failed ${whisperResp.status}: ${errTxt.slice(0, 150)}`);
        }
      } catch (e: any) {
        console.log('[Transcribe] Whisper exception:', e.message);
      }
    }

    // ── Provider 2: OnSpace AI (Gemini multimodal fallback) ──────────────────
    if (!transcribedText && ONSPACE_AI_API_KEY && ONSPACE_AI_BASE_URL) {
      console.log('[Transcribe] Trying OnSpace AI (Gemini multimodal)...');

      const langHint = language ? ` The audio is likely in ${language}.` : '';

      const models = [
        'google/gemini-3-flash-preview',
        'google/gemini-2.5-flash-lite',
        'google/gemini-2.5-flash',
      ];

      for (const model of models) {
        if (transcribedText) break;
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 45000);

          const response = await fetch(`${ONSPACE_AI_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${ONSPACE_AI_API_KEY}`,
            },
            body: JSON.stringify({
              model,
              messages: [
                {
                  role: 'system',
                  content: `You are a highly accurate speech transcription assistant. Transcribe EXACTLY what is spoken in the audio. Output ONLY the transcription text — no explanations, no labels, no JSON.${langHint}`,
                },
                {
                  role: 'user',
                  content: [
                    { type: 'text', text: 'Transcribe this audio. Return ONLY the spoken text:' },
                    { type: 'image_url', image_url: { url: `data:audio/m4a;base64,${audio}` } },
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
            const errTxt = await response.text().catch(() => '');
            console.log(`[Transcribe] OnSpace AI ${model} failed ${response.status}: ${errTxt.slice(0, 100)}`);
            continue;
          }

          const data = await response.json();
          const raw = (data.choices?.[0]?.message?.content || '').trim();

          if (raw && raw !== '[SILENCE]' && raw.length > 1) {
            transcribedText = raw;
            provider = `onspace-ai (${model})`;
            console.log(`[Transcribe] OnSpace AI success: "${raw.slice(0, 60)}..."`);
          }
        } catch (e: any) {
          console.log(`[Transcribe] OnSpace AI ${model} exception:`, e.message);
        }
      }
    }

    if (!transcribedText) {
      console.log('[Transcribe] All providers failed');
      return new Response(
        JSON.stringify({ text: '', warning: 'Could not transcribe audio. Please try speaking more clearly or check your microphone.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean up AI commentary
    let cleanText = transcribedText
      .replace(/^(transcription:|here is the transcription:|the speaker says:|i hear:|transcript:)/i, '')
      .replace(/^\[transcription\]:/i, '')
      .replace(/\[SILENCE\]/gi, '')
      .trim();

    if (!cleanText) {
      return new Response(
        JSON.stringify({ text: '', warning: 'No speech detected. Please speak clearly and try again.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Transcribe] Done via ${provider}: "${cleanText.slice(0, 80)}..."`);

    // Log (non-blocking)
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
          details: { length: audioBuffer.length, textLength: cleanText.length, conversationId, provider },
        }).catch(() => {});
      } catch (_e) {}
    }

    return new Response(
      JSON.stringify({
        success: true,
        text: cleanText,
        language: detectedLanguage,
        detectedLanguage: null,
        languageCode: null,
        confidence: 0.95,
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
