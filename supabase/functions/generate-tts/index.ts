import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  // Handle OPTIONS first
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, voice = 'alloy', speed = 1.0 } = await req.json();

    if (!text || text.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Text is required for TTS generation' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`\ud83d\udd0a Generating TTS: voice=${voice}, speed=${speed}, length=${text.length}`);

    // Call OpenAI TTS API
    const ttsResponse = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1-hd',
        voice: voice,
        input: text.trim(),
        speed: Math.max(0.25, Math.min(4.0, speed)), // Clamp speed between 0.25-4.0
      }),
    });

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text();
      console.error('OpenAI TTS error:', errorText);
      return new Response(
        JSON.stringify({ error: `TTS generation failed: ${errorText}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get audio buffer
    const audioBuffer = await ttsResponse.arrayBuffer();
    const audioUint8 = new Uint8Array(audioBuffer);

    // Upload to Supabase Storage
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const fileName = `voice_preview_${Date.now()}.mp3`;
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('media-files')
      .upload(`voice-previews/${fileName}`, audioUint8, {
        contentType: 'audio/mpeg',
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Failed to store audio file' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from('media-files')
      .getPublicUrl(`voice-previews/${fileName}`);

    console.log(`\u2705 TTS generated successfully: ${urlData.publicUrl}`);

    return new Response(
      JSON.stringify({ audioUrl: urlData.publicUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('\u274c TTS generation error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown TTS error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
