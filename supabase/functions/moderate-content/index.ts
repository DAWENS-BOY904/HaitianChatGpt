import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

// ── Types ──────────────────────────────────────────────────────────────────

interface ModerationBody {
  /** Public URL of the image to moderate */
  imageUrl?: string;
  /** Raw text to moderate */
  text?: string;
  /** 'image' | 'text' | 'video' */
  type?: string;
}

interface ModerationResult {
  blocked: boolean;
  flagged?: boolean;
  categories?: Record<string, boolean>;
  category_scores?: Record<string, number>;
  model?: string;
  error?: string;
}

// ── Helper: sanitise URL ────────────────────────────────────────────────────

function isValidImageUrl(url: string): boolean {
  if (!url) return false;
  if (url.startsWith('data:image/')) return true;
  try {
    const p = new URL(url);
    return p.protocol === 'https:' || p.protocol === 'http:';
  } catch {
    return false;
  }
}

// ── Image moderation via omni-moderation-latest ─────────────────────────────

async function moderateImage(imageUrl: string, apiKey: string): Promise<ModerationResult> {
  try {
    // Build the input — for data URIs we use the full data URL, for remote URLs we use image_url type
    const inputItem = imageUrl.startsWith('data:image/')
      ? { type: 'image_url', image_url: { url: imageUrl } }
      : { type: 'image_url', image_url: { url: imageUrl } };

    const response = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'omni-moderation-latest',
        input: [inputItem],
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => response.statusText);
      console.error(`[moderate-image] OpenAI error (${response.status}): ${errText.slice(0, 200)}`);
      // On API error, default to NOT blocking to avoid false positives
      return { blocked: false, error: `OpenAI: ${response.status} ${errText.slice(0, 100)}` };
    }

    const data = await response.json();
    const result = data?.results?.[0];
    if (!result) return { blocked: false, error: 'No moderation result' };

    console.log(`[moderate-image] flagged=${result.flagged}, categories=${JSON.stringify(result.categories)}`);

    return {
      blocked: result.flagged === true,
      flagged: result.flagged,
      categories: result.categories,
      category_scores: result.category_scores,
      model: 'omni-moderation-latest',
    };
  } catch (err: any) {
    console.error('[moderate-image] Exception:', err.message);
    // Fail open (don't block on network errors)
    return { blocked: false, error: err.message };
  }
}

// ── Text moderation via text-moderation-latest ──────────────────────────────

async function moderateText(text: string, apiKey: string): Promise<ModerationResult> {
  if (!text || text.trim().length < 10) {
    return { blocked: false, model: 'text-moderation-latest' };
  }

  try {
    const response = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'text-moderation-latest',
        input: text.slice(0, 4000), // API max input length safety
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => response.statusText);
      console.error(`[moderate-text] OpenAI error (${response.status}): ${errText.slice(0, 200)}`);
      return { blocked: false, error: `OpenAI: ${response.status} ${errText.slice(0, 100)}` };
    }

    const data = await response.json();
    const result = data?.results?.[0];
    if (!result) return { blocked: false, error: 'No moderation result' };

    console.log(`[moderate-text] flagged=${result.flagged}`);

    return {
      blocked: result.flagged === true,
      flagged: result.flagged,
      categories: result.categories,
      category_scores: result.category_scores,
      model: 'text-moderation-latest',
    };
  } catch (err: any) {
    console.error('[moderate-text] Exception:', err.message);
    return { blocked: false, error: err.message };
  }
}

// ── Main handler ───────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      console.error('[moderate-content] OPENAI_API_KEY not configured');
      // Fail open — don't block content if we have no API key
      return new Response(
        JSON.stringify({ blocked: false, error: 'Moderation service not configured' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let body: ModerationBody;
    try {
      body = await req.json();
    } catch (_e) {
      return new Response(
        JSON.stringify({ blocked: false, error: 'Invalid JSON' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { imageUrl, text, type } = body;

    // ── Image moderation ─────────────────────────────────────────────────────
    if (type === 'image' || (imageUrl && !text)) {
      if (!imageUrl || !isValidImageUrl(imageUrl)) {
        return new Response(
          JSON.stringify({ blocked: false, error: 'Invalid or missing imageUrl' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const result = await moderateImage(imageUrl, apiKey);
      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Text moderation ──────────────────────────────────────────────────────
    if (type === 'text' || (text && !imageUrl)) {
      if (!text) {
        return new Response(
          JSON.stringify({ blocked: false }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const result = await moderateText(text, apiKey);
      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Both image + text ─────────────────────────────────────────────────────
    if (imageUrl && text) {
      const [imgResult, txtResult] = await Promise.all([
        isValidImageUrl(imageUrl) ? moderateImage(imageUrl, apiKey) : Promise.resolve({ blocked: false }),
        moderateText(text, apiKey),
      ]);
      const blocked = imgResult.blocked || txtResult.blocked;
      return new Response(
        JSON.stringify({
          blocked,
          imageModeration: imgResult,
          textModeration: txtResult,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ blocked: false, error: 'No content provided' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('[moderate-content] Unhandled error:', err.message);
    // Fail open
    return new Response(
      JSON.stringify({ blocked: false, error: 'Internal error' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
