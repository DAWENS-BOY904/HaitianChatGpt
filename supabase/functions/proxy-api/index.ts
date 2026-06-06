import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// Target chatbot endpoint at Dawinix
const DAWINIX_CHATBOT_URL = 'https://api.dawinix.com/chatbot';

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const apiKeyHeader = req.headers.get('x-api-key') ?? req.headers.get('X-Api-Key') ?? '';

    // ── Path 1: Dawinix API key (dwx_sk_...) — pass through directly ──
    if (apiKeyHeader.startsWith('dwx_sk_')) {
      const body = req.method !== 'GET' ? await req.text() : undefined;
      const forwardHeaders: HeadersInit = {
        'Content-Type': 'application/json',
        'x-api-key': apiKeyHeader,
        ...corsHeaders,
      };

      const upstreamRes = await fetch(DAWINIX_CHATBOT_URL, {
        method: req.method,
        headers: forwardHeaders,
        body,
      });

      const upstreamData = await upstreamRes.text();
      return new Response(upstreamData, {
        status: upstreamRes.status,
        headers: {
          'Content-Type': upstreamRes.headers.get('Content-Type') ?? 'application/json',
          ...corsHeaders,
        },
      });
    }

    // ── Path 2: Supabase JWT — validate before forwarding ──
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: missing token or API key' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Verify JWT using Supabase auth.getUser
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: invalid or expired token' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Token valid — forward request to Dawinix with user context headers
    const body = req.method !== 'GET' ? await req.text() : undefined;
    const forwardHeaders: HeadersInit = {
      'Content-Type': 'application/json',
      'x-user-id': user.id,
      'x-user-email': user.email ?? '',
      ...corsHeaders,
    };

    const upstreamRes = await fetch(DAWINIX_CHATBOT_URL, {
      method: req.method,
      headers: forwardHeaders,
      body,
    });

    const upstreamData = await upstreamRes.text();
    return new Response(upstreamData, {
      status: upstreamRes.status,
      headers: {
        'Content-Type': upstreamRes.headers.get('Content-Type') ?? 'application/json',
        ...corsHeaders,
      },
    });
  } catch (err: any) {
    console.error('proxy-api error:', err);
    return new Response(
      JSON.stringify({ error: err?.message ?? 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});
