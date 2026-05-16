import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

const SHAZAM_API_BASE = 'https://shazam-api.com/api';
const SHAZAM_API_KEY = Deno.env.get('SHAZAM_API_KEY') ?? 'GjVYLcKi2D74wZLX3Jd7MDfWvXjwbxBAHptjCwWYh4pSjRKPl7uq4bJ8fjle3c8V';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, query, audioBase64 } = body;

    if (action === 'search') {
      // Search Shazam by text query (for "@Shazam ki music sa" type queries)
      const searchUrl = `${SHAZAM_API_BASE}/search?query=${encodeURIComponent(query || '')}&limit=5`;
      
      let result: any = null;
      
      try {
        const response = await fetch(searchUrl, {
          headers: {
            'x-rapidapi-key': SHAZAM_API_KEY,
            'x-rapidapi-host': 'shazam-api.com',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          result = data;
        }
      } catch (fetchErr) {
        console.log('Shazam API fetch error:', fetchErr);
      }

      // If API fails or no results, return a structured response from the query
      if (!result || !result.tracks?.hits?.length) {
        // Try alternative endpoint
        try {
          const altUrl = `https://shazam.p.rapidapi.com/search?term=${encodeURIComponent(query || '')}&locale=en-US&offset=0&limit=5`;
          const altResp = await fetch(altUrl, {
            headers: {
              'x-rapidapi-key': SHAZAM_API_KEY,
              'x-rapidapi-host': 'shazam.p.rapidapi.com',
            },
          });
          if (altResp.ok) {
            result = await altResp.json();
          }
        } catch (_e) {}
      }

      // Parse tracks from result
      const tracks: any[] = [];
      
      if (result?.tracks?.hits) {
        for (const hit of result.tracks.hits.slice(0, 3)) {
          const t = hit.track;
          if (t) {
            tracks.push({
              id: t.key || t.id || Math.random().toString(36),
              name: t.title || t.name || query,
              artist: t.subtitle || t.artist || '',
              imageUrl: t.images?.coverart || t.share?.image || t.albumadamid
                ? `https://is1-ssl.mzstatic.com/image/thumb/${t.albumadamid}/400x400bb.jpg`
                : 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&q=80',
              shazamCount: t.shazamcounts?.text || '',
              shazamUrl: t.url || `https://www.shazam.com/track/${t.key}`,
              previewUrl: t.hub?.actions?.find((a: any) => a.type === 'uri')?.uri || null,
            });
          }
        }
      }

      // If still no tracks, return a fallback based on query
      if (tracks.length === 0) {
        tracks.push({
          id: 'shazam_fallback_1',
          name: query || 'Unknown Song',
          artist: 'Tap to identify with Shazam',
          imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&q=80',
          shazamCount: '',
          shazamUrl: `https://www.shazam.com`,
          previewUrl: null,
        });
      }

      return new Response(JSON.stringify({ success: true, tracks }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'identify') {
      // Identify song from audio base64
      if (!audioBase64) {
        return new Response(JSON.stringify({ error: 'No audio provided' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let identified: any = null;
      
      try {
        const resp = await fetch(`${SHAZAM_API_BASE}/identify`, {
          method: 'POST',
          headers: {
            'x-rapidapi-key': SHAZAM_API_KEY,
            'x-rapidapi-host': 'shazam-api.com',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ audio: audioBase64 }),
        });
        
        if (resp.ok) {
          identified = await resp.json();
        }
      } catch (e) {
        console.log('Shazam identify error:', e);
      }

      if (identified?.track) {
        const t = identified.track;
        return new Response(JSON.stringify({
          success: true,
          track: {
            id: t.key || t.id,
            name: t.title || t.name,
            artist: t.subtitle || t.artist,
            imageUrl: t.images?.coverart || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&q=80',
            shazamCount: t.shazamcounts?.text || '',
            shazamUrl: t.url || `https://www.shazam.com/track/${t.key}`,
            previewUrl: t.hub?.actions?.find((a: any) => a.type === 'uri')?.uri || null,
          },
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: false, error: 'Could not identify song' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Shazam edge function error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
