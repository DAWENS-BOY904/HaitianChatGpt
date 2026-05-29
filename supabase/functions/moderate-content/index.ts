import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { imageUrl, text, type = 'image' } = body;
    const openaiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openaiKey) {
      return new Response(
        JSON.stringify({ blocked: false, flagged: false, error: 'No OpenAI key configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Text moderation ──────────────────────────────────────────────────────
    if (type === 'text' && text) {
      try {
        const res = await fetch('https://api.openai.com/v1/moderations', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ model: 'text-moderation-latest', input: text }),
          signal: AbortSignal.timeout(10000),
        });

        if (!res.ok) {
          const err = await res.text();
          console.log('[moderate-text] OpenAI error:', err.slice(0, 200));
          return new Response(
            JSON.stringify({ blocked: false, flagged: false }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const data = await res.json();
        const result = data.results?.[0];
        if (!result) {
          return new Response(
            JSON.stringify({ blocked: false, flagged: false }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`[moderate-text] flagged=${result.flagged}`, result.categories);

        return new Response(
          JSON.stringify({
            blocked: result.flagged,
            flagged: result.flagged,
            categories: result.categories,
            categoryScores: result.category_scores,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (e: any) {
        console.error('[moderate-text] error:', e.message);
        return new Response(
          JSON.stringify({ blocked: false, flagged: false }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ── Image / omni moderation ───────────────────────────────────────────────
    if (type === 'image' && imageUrl) {
      try {
        const res = await fetch('https://api.openai.com/v1/moderations', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'omni-moderation-latest',
            input: [
              {
                type: 'image_url',
                image_url: { url: imageUrl },
              },
            ],
          }),
          signal: AbortSignal.timeout(20000),
        });

        if (!res.ok) {
          const err = await res.text();
          console.log('[moderate-image] OpenAI error:', err.slice(0, 200));
          // Non-blocking fallback: don't block upload on API error
          return new Response(
            JSON.stringify({ blocked: false, flagged: false }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const data = await res.json();
        const result = data.results?.[0];
        if (!result) {
          return new Response(
            JSON.stringify({ blocked: false, flagged: false }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`[moderate-image] flagged=${result.flagged}`, result.categories);

        return new Response(
          JSON.stringify({
            blocked: result.flagged,
            flagged: result.flagged,
            categories: result.categories,
            categoryScores: result.category_scores,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (e: any) {
        console.error('[moderate-image] error:', e.message);
        // Non-blocking: if moderation times out/fails, allow the upload
        return new Response(
          JSON.stringify({ blocked: false, flagged: false }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({ blocked: false, flagged: false, error: 'Invalid request' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    console.error('[moderate-content] Unhandled error:', e.message);
    return new Response(
      JSON.stringify({ blocked: false, flagged: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
