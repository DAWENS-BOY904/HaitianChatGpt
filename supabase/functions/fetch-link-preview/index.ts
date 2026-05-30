import { corsHeaders } from '../_shared/cors.ts';

// ── Types ──────────────────────────────────────────────────────────────────────
interface OGMetadata {
  title: string;
  description?: string;
  image?: string;
  author?: string;
  siteName?: string;
  platform: string;
  url: string;
}

// ── Platform detection ─────────────────────────────────────────────────────────
function detectPlatform(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes('tiktok.com') || host.includes('vm.tiktok.com')) return 'tiktok';
    if (host.includes('youtube.com') || host.includes('youtu.be')) return 'youtube';
    if (host.includes('twitter.com') || host.includes('x.com')) return 'twitter';
    if (host.includes('instagram.com')) return 'instagram';
    if (host.includes('facebook.com') || host.includes('fb.com') || host.includes('fb.watch')) return 'facebook';
    if (host.includes('reddit.com')) return 'reddit';
    if (host.includes('github.com')) return 'github';
    if (host.includes('linkedin.com')) return 'linkedin';
    if (host.includes('spotify.com')) return 'spotify';
    if (host.includes('amazon.com') || host.includes('amzn.to')) return 'amazon';
    if (host.includes('medium.com') || host.includes('substack.com')) return 'article';
  } catch (_e) {}
  return 'web';
}

// ── Meta tag parser ────────────────────────────────────────────────────────────
function parseMetaTags(html: string): Record<string, string> {
  const tags: Record<string, string> = {};
  const metaRegex = /<meta\s[^>]+>/gi;
  let m: RegExpExecArray | null;
  while ((m = metaRegex.exec(html)) !== null) {
    const tag = m[0];
    const propMatch = tag.match(/(?:property|name)=["']([^"']+)["']/i);
    const contentMatch = tag.match(/content=["']([^"'<>]+)["']/i);
    if (propMatch && contentMatch) {
      const key = propMatch[1].toLowerCase();
      const val = contentMatch[1]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();
      if (val) tags[key] = val;
    }
  }
  // Page title fallback
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    tags['_pagetitle'] = titleMatch[1]
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').trim();
  }
  // JSON-LD structured data fallback
  const jsonLdMatch = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  if (jsonLdMatch) {
    try {
      const ld = JSON.parse(jsonLdMatch[1]);
      if (!tags['og:title'] && (ld.name || ld.headline)) tags['_ld_title'] = ld.name || ld.headline;
      if (!tags['og:description'] && ld.description) tags['_ld_desc'] = ld.description;
      if (!tags['og:image']) {
        const img = ld.image;
        if (typeof img === 'string') tags['_ld_image'] = img;
        else if (img?.url) tags['_ld_image'] = img.url;
        else if (Array.isArray(img) && img[0]) tags['_ld_image'] = typeof img[0] === 'string' ? img[0] : img[0].url;
      }
      const author = ld.author;
      if (!tags['author'] && author) {
        tags['_ld_author'] = typeof author === 'string' ? author : author.name || '';
      }
    } catch (_e) {}
  }
  return tags;
}

// ── Timeout fetch ──────────────────────────────────────────────────────────────
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ── Generic OG scraper ─────────────────────────────────────────────────────────
async function scrapeOGMetadata(
  url: string,
  platform: string
): Promise<Partial<OGMetadata>> {
  const userAgentMap: Record<string, string> = {
    instagram: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    facebook:  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    twitter:   'Twitterbot/1.0',
    linkedin:  'LinkedInBot/1.0 (compatible; compatible; +https://www.linkedin.com)',
  };
  const ua = userAgentMap[platform] || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  try {
    const response = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': ua,
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.9',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
    }, 10000);

    if (!response.ok) return {};
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return {};

    // Read only the <head> section (first ~80 KB) for efficiency
    let html = '';
    const reader = response.body?.getReader();
    if (reader) {
      const decoder = new TextDecoder();
      let bytesRead = 0;
      while (bytesRead < 80000) {
        const { done, value } = await reader.read();
        if (done) break;
        html += decoder.decode(value, { stream: true });
        bytesRead += value?.length || 0;
        // Stop once we have </head> — all OG tags are in <head>
        if (html.toLowerCase().includes('</head>')) break;
      }
      reader.cancel().catch(() => {});
    } else {
      html = (await response.text()).slice(0, 80000);
    }

    const tags = parseMetaTags(html);

    return {
      title: tags['og:title'] || tags['twitter:title'] || tags['_ld_title'] || tags['_pagetitle'] || undefined,
      description: tags['og:description'] || tags['twitter:description'] || tags['_ld_desc'] || undefined,
      image:
        tags['og:image'] ||
        tags['og:image:secure_url'] ||
        tags['twitter:image'] ||
        tags['twitter:image:src'] ||
        tags['_ld_image'] ||
        undefined,
      author: tags['og:article:author'] || tags['author'] || tags['twitter:creator'] || tags['_ld_author'] || undefined,
      siteName: tags['og:site_name'] || tags['application-name'] || undefined,
    };
  } catch (e) {
    console.log(`[preview] OG scrape failed for ${url}:`, (e as Error).message);
    return {};
  }
}

// ── TikTok oEmbed ──────────────────────────────────────────────────────────────
async function fetchTikTokOEmbed(url: string): Promise<Partial<OGMetadata>> {
  try {
    const res = await fetchWithTimeout(
      `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DawinixBot/1.0)' } },
      8000
    );
    if (!res.ok) return {};
    const d = await res.json();
    return {
      title: d.title || 'TikTok Video',
      description: d.author_name ? `@${d.author_name} on TikTok` : 'TikTok Video',
      image: d.thumbnail_url || undefined,
      author: d.author_name ? `@${d.author_name}` : undefined,
      siteName: 'TikTok',
    };
  } catch (_e) { return {}; }
}

// ── YouTube oEmbed ─────────────────────────────────────────────────────────────
async function fetchYouTubeOEmbed(url: string): Promise<Partial<OGMetadata>> {
  try {
    const res = await fetchWithTimeout(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } },
      8000
    );
    if (!res.ok) return {};
    const d = await res.json();
    // Get high-res thumbnail from video ID
    let thumbnail = d.thumbnail_url;
    const idMatch = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    if (idMatch) thumbnail = `https://img.youtube.com/vi/${idMatch[1]}/maxresdefault.jpg`;
    return {
      title: d.title || 'YouTube Video',
      description: d.author_name ? `YouTube · ${d.author_name}` : 'YouTube Video',
      image: thumbnail,
      author: d.author_name || undefined,
      siteName: 'YouTube',
    };
  } catch (_e) { return {}; }
}

// ── Twitter/X oEmbed ───────────────────────────────────────────────────────────
async function fetchTwitterOEmbed(url: string): Promise<Partial<OGMetadata>> {
  try {
    const res = await fetchWithTimeout(
      `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=true`,
      { headers: { 'User-Agent': 'Twitterbot/1.0' } },
      8000
    );
    if (!res.ok) return {};
    const d = await res.json();
    const text = (d.html || '')
      .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 220);
    return {
      title: d.author_name ? `@${d.author_name}` : 'Tweet',
      description: text || undefined,
      author: d.author_name || undefined,
      siteName: 'Twitter / X',
    };
  } catch (_e) { return {}; }
}

// ── Main handler ───────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const rawUrl: unknown = body?.url;

    if (!rawUrl || typeof rawUrl !== 'string') {
      return new Response(JSON.stringify({ error: 'url required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawUrl);
      if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') throw new Error('bad protocol');
    } catch (_e) {
      return new Response(JSON.stringify({ error: 'Invalid URL' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = rawUrl.split(' ')[0]; // strip trailing spaces/garbage
    const platform = detectPlatform(url);
    let partial: Partial<OGMetadata> = {};

    // 1. Try platform-specific oEmbed (fastest, most accurate)
    if (platform === 'tiktok') {
      partial = await fetchTikTokOEmbed(url);
    } else if (platform === 'youtube') {
      partial = await fetchYouTubeOEmbed(url);
    } else if (platform === 'twitter') {
      partial = await fetchTwitterOEmbed(url);
    }

    // 2. Always fall back to / supplement with OG scraping
    // Skip only if we already have both title + image from oEmbed
    if (!partial.title || !partial.image) {
      const og = await scrapeOGMetadata(url, platform);
      partial = {
        title:       partial.title       || og.title,
        description: partial.description || og.description,
        image:       partial.image       || og.image,
        author:      partial.author      || og.author,
        siteName:    partial.siteName    || og.siteName,
      };
    }

    // 3. Final domain fallback
    const hostname = parsedUrl.hostname.replace('www.', '');
    const metadata: OGMetadata = {
      title:       partial.title       || hostname,
      description: partial.description,
      image:       partial.image,
      author:      partial.author,
      siteName:    partial.siteName    || hostname,
      platform,
      url,
    };

    console.log(`[preview] ${platform} | ${url.slice(0, 60)} | title="${metadata.title.slice(0, 40)}" img=${!!metadata.image}`);

    return new Response(JSON.stringify(metadata), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600', // CDN-cacheable for 1 hour
      },
    });
  } catch (err) {
    console.error('[preview] Unhandled error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
