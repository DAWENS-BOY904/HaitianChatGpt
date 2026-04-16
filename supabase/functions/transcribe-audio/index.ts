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

    const { audio, userId, conversationId } = body;

    if (!audio || typeof audio !== 'string' || audio.length < 100) {
      return new Response(
        JSON.stringify({ error: 'No valid audio data provided', warning: 'No speech detected. Please try again.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

    if (!OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Transcription service not configured. Please add OPENAI_API_KEY to Secrets.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Decode base64 audio safely
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

    const MAX_SIZE = 25 * 1024 * 1024; // 25 MB
    if (audioBuffer.length > MAX_SIZE) {
      return new Response(
        JSON.stringify({ error: 'Audio file too large. Maximum 25MB allowed.' }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Transcribing audio: ${audioBuffer.length} bytes`);

    // Build FormData for Whisper
    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
    formData.append('file', audioBlob, 'audio.m4a');
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'json');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);

    let whisperResult: { text: string; language?: string };
    try {
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errText = await response.text();
        console.error('Whisper API error:', response.status, errText);
        throw new Error(`Whisper API error ${response.status}: ${errText}`);
      }

      whisperResult = await response.json();
    } catch (err: any) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        return new Response(
          JSON.stringify({ error: 'Transcription timed out. Please try a shorter recording.' }),
          { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw err;
    }

    const text = (whisperResult.text || '').trim();

    if (!text) {
      return new Response(
        JSON.stringify({ text: '', warning: 'No speech detected. Please speak clearly and try again.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Transcription successful: "${text.substring(0, 80)}..."`);

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
          details: { length: audioBuffer.length, textLength: text.length, conversationId },
        }).catch(() => {});
      } catch (_e) {}
    }

    return new Response(
      JSON.stringify({
        success: true,
        text,
        language: whisperResult.language || 'auto',
        confidence: 0.9,
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
