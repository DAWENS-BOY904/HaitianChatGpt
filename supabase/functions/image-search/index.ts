import { corsHeaders } from '../_shared/cors.ts';
import { searchImages } from '../_shared/ai-providers.ts';

const CORS_HEADERS = { ...corsHeaders, 'Content-Type': 'application/json' };

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let body: { query?: string; limit?: number; includeAiGenerated?: boolean } = {};
    try {
      body = await req.json();
    } catch (_e) {
      return new Response(JSON.stringify({ images: [], aiGenerated: [], error: 'Invalid JSON body' }), {
        status: 400,
        headers: CORS_HEADERS,
      });
    }

    const { query, limit = 10, includeAiGenerated = true } = body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return new Response(JSON.stringify({ images: [], aiGenerated: [], error: 'Missing or empty query' }), {
        status: 400,
        headers: CORS_HEADERS,
      });
    }

    // Fetch real images from search providers (Pexels → Unsplash → Google)
    const result = await searchImages(query.trim().slice(0, 200), Math.min(Number(limit) || 10, 15));

    // Generate AI images for the top row
    let aiGenerated: Array<{
      url: string;
      title: string;
      source: string;
      isAiGenerated: boolean;
      revisedPrompt?: string;
    }> = [];

    if (includeAiGenerated) {
      try {
        const { generateImageSmart } = await import('../_shared/ai-providers.ts');

        // Generate up to 5 AI variations with staggered prompts
        const aiPromises = [
          generateImageSmart(`${query}, high quality, detailed`, 'dalle-3'),
          generateImageSmart(`${query}, artistic style, vibrant colors`, 'dalle-3'),
          generateImageSmart(`${query}, professional photography, 4K`, 'dalle-3'),
          generateImageSmart(`${query}, creative interpretation, unique angle`, 'dalle-3'),
          generateImageSmart(`${query}, realistic rendering, studio lighting`, 'dalle-3'),
        ];

        const aiResults = await Promise.all(aiPromises);
        aiGenerated = aiResults
          .map((r, i) => r.imageUrl ? {
            url: r.imageUrl,
            title: `AI Generated ${i + 1}`,
            source: 'AI (DALL-E 3)',
            isAiGenerated: true,
            revisedPrompt: r.revisedPrompt
          } : null)
          .filter((r): r is NonNullable<typeof r> => r !== null)
          .slice(0, 5);
      } catch (_e) {
        console.log('[image-search] AI generation skipped or failed');
      }
    }

    // Mark real images
    const realImages = (result.images || []).map(img => ({
      ...img,
      isAiGenerated: false,
      source: img.source || 'Web Search'
    }));

    return new Response(JSON.stringify({
      images: realImages,
      aiGenerated,
      query: query.trim(),
      total: realImages.length + aiGenerated.length,
    }), {
      status: 200,
      headers: CORS_HEADERS,
    });
  } catch (err: any) {
    console.error('[image-search] Unhandled error:', err?.message || err);
    return new Response(JSON.stringify({ images: [], aiGenerated: [], error: err?.message || 'Internal error' }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }
});
