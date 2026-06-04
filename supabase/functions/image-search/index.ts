import { corsHeaders } from '../_shared/cors.ts';

const CORS_HEADERS = { ...corsHeaders, 'Content-Type': 'application/json' };

// Lazy-load to avoid cold-start crashes
async function getSearchImages() {
  const mod = await import('../_shared/ai-providers.ts');
  return mod.searchImages;
}

Deno.serve(async (req: Request) => {
  // Always handle OPTIONS first
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let body: { query?: string; limit?: number } = {};
    try {
      body = await req.json();
    } catch (_e) {
      return new Response(JSON.stringify({ images: [], error: 'Invalid JSON body' }), {
        status: 400,
        headers: CORS_HEADERS,
      });
    }

    const { query, limit = 6 } = body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return new Response(JSON.stringify({ images: [], error: 'Missing or empty query' }), {
        status: 400,
        headers: CORS_HEADERS,
      });
    }

    const searchImages = await getSearchImages();
    const result = await searchImages(query.trim().slice(0, 200), Math.min(Number(limit) || 6, 12));

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: CORS_HEADERS,
    });
  } catch (err: any) {
    console.error('[image-search] Unhandled error:', err?.message || err);
    return new Response(JSON.stringify({ images: [], error: err?.message || 'Internal error' }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }
});
