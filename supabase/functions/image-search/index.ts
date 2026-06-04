import { corsHeaders } from '../_shared/cors.ts';
import { searchImages } from '../_shared/ai-providers.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const { query, limit = 6 } = await req.json();
    if (!query || typeof query !== 'string') {
      return new Response(JSON.stringify({ images: [], error: 'Missing query' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const result = await searchImages(query.slice(0, 200), Math.min(limit, 12));
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ images: [], error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
