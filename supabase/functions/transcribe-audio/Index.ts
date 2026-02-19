import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

serve(async (req) => {
  const { audio } = await req.json()
  
  // Convert base64 to file
  const audioBuffer = Uint8Array.from(atob(audio), c => c.charCodeAt(0))
  
  // Call OpenAI Whisper
  const formData = new FormData()
  formData.append('file', new Blob([audioBuffer], { type: 'audio/m4a' }), 'recording.m4a')
  formData.append('model', 'whisper-1')
  
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
    },
    body: formData,
  })
  
  const result = await response.json()
  
  return new Response(JSON.stringify({ text: result.text }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
