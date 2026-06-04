// Updated image-search edge function with AI + Real image pairing

import { corsHeaders } from '../_shared/cors.ts';
import { searchImages } from '../_shared/ai-providers.ts';

const CORS_HEADERS = { ...corsHeaders, 'Content-Type': 'application/json' };

interface ImageSearchResponse {
  images: Array<{
    url: string;
    title?: string;
    source: string;
    resolution?: string;
    link?: string;
    isAiGenerated: boolean;
  }>;
  aiGenerated: Array<{
    url: string;
    title: string;
    source: string;
    isAiGenerated: boolean;
    revisedPrompt?: string;
  }>;
  query: string;
  total: number;
  error?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let body: { query?: string; limit?: number; includeAiGenerated?: boolean; conversationId?: string } = {};
    try {
      body = await req.json();
    } catch (_e) {
      return new Response(
        JSON.stringify({ images: [], aiGenerated: [], error: 'Invalid JSON body' } as ImageSearchResponse),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const { query, limit = 10, includeAiGenerated = true, conversationId } = body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return new Response(
        JSON.stringify({ images: [], aiGenerated: [], error: 'Missing or empty query' } as ImageSearchResponse),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const cleanQuery = query.trim().slice(0, 200);
    const maxLimit = Math.min(Number(limit) || 10, 15);

    // Fetch real images from search providers (Pexels → Unsplash → Google)
    console.log(`[image-search] Searching for: "${cleanQuery}" (limit: ${maxLimit})`);
    const result = await searchImages(cleanQuery, maxLimit);

    // Generate AI images for the top row (max 5)
    let aiGenerated: ImageSearchResponse['aiGenerated'] = [];

    if (includeAiGenerated) {
      try {
        const { generateImageSmart } = await import('../_shared/ai-providers.ts');

        // Generate up to 5 AI variations with diverse prompts
        const aiPrompts = [
          { prompt: `${cleanQuery}, high quality, detailed, professional`, style: 'Detailed' },
          { prompt: `${cleanQuery}, artistic style, vibrant colors, creative`, style: 'Artistic' },
          { prompt: `${cleanQuery}, professional photography, 4K resolution, sharp focus`, style: 'Photography' },
          { prompt: `${cleanQuery}, creative interpretation, unique angle, stylized`, style: 'Creative' },
          { prompt: `${cleanQuery}, realistic rendering, studio lighting, polished`, style: 'Realistic' },
        ];

        const aiPromises = aiPrompts.map((p) =>
          generateImageSmart(p.prompt, 'dalle-3').then((r) => ({ ...r, style: p.style }))
        );

        const aiResults = await Promise.all(aiPromises);
        aiGenerated = aiResults
          .map((r, i) =>
            r.imageUrl
              ? {
                  url: r.imageUrl,
                  title: `AI ${r.style}`,
                  source: 'AI (DALL-E 3)',
                  isAiGenerated: true,
                  revisedPrompt: r.revisedPrompt,
                }
              : null
          )
          .filter((r): r is NonNullable<typeof r> => r !== null)
          .slice(0, 5);

        console.log(`[image-search] Generated ${aiGenerated.length} AI images`);
      } catch (err: any) {
        console.log('[image-search] AI generation skipped or failed:', err?.message);
      }
    }

    // Mark real images
    const realImages = (result.images || []).map((img) => ({
      ...img,
      isAiGenerated: false as const,
      source: img.source || 'Web Search',
    }));

    const response: ImageSearchResponse = {
      images: realImages,
      aiGenerated,
      query: cleanQuery,
      total: realImages.length + aiGenerated.length,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: CORS_HEADERS,
    });
  } catch (err: any) {
    console.error('[image-search] Unhandled error:', err?.message || err);
    return new Response(
      JSON.stringify({
        images: [],
        aiGenerated: [],
        error: err?.message || 'Internal error',
      } as ImageSearchResponse),
      { status: 500, headers: CORS_HEADERS }
    );
  }
});
