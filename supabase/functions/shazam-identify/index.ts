/**
 * Shazam Audio Recognition Edge Function
 * Only supports audio fingerprinting — no text search.
 * Uses the real Shazam API via RapidAPI to identify songs from audio.
 */

import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SHAZAM_API_KEY = Deno.env.get('SHAZAM_API_KEY') ?? '';

    const body = await req.json();
    const { audio, sample_ms } = body;

    // Only support audio recognition — no text search
    if (!audio) {
      return new Response(
        JSON.stringify({ error: 'Audio data is required for song recognition' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('🎵 Shazam: Identifying song from audio...');

    // Convert base64 to binary for Shazam API
    const audioBuffer = base64ToUint8Array(audio);
    
    // Try RapidAPI Shazam endpoint first
    let result = await tryRapidAPIShazam(audioBuffer, SHAZAM_API_KEY, sample_ms);
    
    if (!result) {
      // Fallback: try alternative Shazam endpoint
      result = await tryAlternativeShazam(audio, SHAZAM_API_KEY);
    }

    if (!result) {
      return new Response(
        JSON.stringify({ 
          identified: false,
          error: 'Could not identify the song. Make sure music is playing clearly and try again.' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ identified: true, track: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('Shazam function error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal error during song recognition' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

// ── RapidAPI Shazam (primary) ─────────────────────────────────────────────────
async function tryRapidAPIShazam(audioBuffer: Uint8Array, apiKey: string, sampleMs?: number): Promise<ShazamTrack | null> {
  try {
    const response = await fetch('https://shazam.p.rapidapi.com/songs/v2/detect', {
      method: 'POST',
      headers: {
        'content-type': 'text/plain',
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'shazam.p.rapidapi.com',
      },
      body: audioBuffer,
    });

    if (!response.ok) {
      console.error('RapidAPI Shazam error:', response.status, await response.text());
      return null;
    }

    const data = await response.json();
    console.log('Shazam response:', JSON.stringify(data).slice(0, 300));
    
    return extractTrackFromShazamResponse(data);
  } catch (err) {
    console.error('RapidAPI Shazam failed:', err);
    return null;
  }
}

// ── Alternative Shazam API ────────────────────────────────────────────────────
async function tryAlternativeShazam(audioBase64: string, apiKey: string): Promise<ShazamTrack | null> {
  try {
    const response = await fetch('https://shazam-api6.p.rapidapi.com/shazam/recognize/', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'shazam-api6.p.rapidapi.com',
      },
      body: JSON.stringify({ audio_file: audioBase64 }),
    });

    if (!response.ok) {
      console.error('Alternative Shazam error:', response.status);
      return null;
    }

    const data = await response.json();
    return extractTrackFromAlternativeResponse(data);
  } catch (err) {
    console.error('Alternative Shazam failed:', err);
    return null;
  }
}

// ── Response parsers ──────────────────────────────────────────────────────────
interface ShazamTrack {
  title: string;
  subtitle: string;
  imageUrl: string | null;
  shazamUrl: string | null;
  previewUrl: string | null;
  count: string | null;
  genres: string[];
  releaseDate: string | null;
  label: string | null;
}

function extractTrackFromShazamResponse(data: any): ShazamTrack | null {
  // Handle standard Shazam API response format
  const track = data?.track ?? data?.result?.track ?? data;
  
  if (!track?.title && !track?.title) return null;

  const title = track.title || track.name || '';
  const subtitle = track.subtitle || track.artist || '';
  
  if (!title) return null;

  const images = track.images || {};
  const imageUrl = images.coverarthq || images.coverart || images.background || null;
  
  const share = track.share || {};
  const shazamUrl = share.href || track.url || null;
  
  // Find preview URL from hub actions
  const hub = track.hub || {};
  const hubActions = hub.actions || [];
  const previewAction = hubActions.find((a: any) => a.type === 'uri' && a.name === 'apple-song-action');
  const previewUrl = previewAction?.uri || null;

  // Shazam count
  const stats = track.stats || {};
  const rawCount = stats.shazam || stats.count || 0;
  const count = rawCount > 0 ? formatShazamCount(rawCount) : null;

  // Genres
  const genresMeta = track.genres || {};
  const genres: string[] = [];
  if (genresMeta.primary) genres.push(genresMeta.primary);
  
  // Release date
  const releaseDate = track.releasedate || track.release_date || null;
  
  // Label
  const label = track.label || null;

  return { title, subtitle, imageUrl, shazamUrl, previewUrl, count, genres, releaseDate, label };
}

function extractTrackFromAlternativeResponse(data: any): ShazamTrack | null {
  // Handle alternative API response format
  const track = data?.track || data?.result || data;
  if (!track?.title) return null;

  return {
    title: track.title || '',
    subtitle: track.subtitle || track.artist || '',
    imageUrl: track.image || track.cover || track.artwork || null,
    shazamUrl: track.url || track.shazam_url || null,
    previewUrl: track.preview || track.preview_url || null,
    count: null,
    genres: track.genre ? [track.genre] : [],
    releaseDate: track.release_date || null,
    label: null,
  };
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function base64ToUint8Array(base64: string): Uint8Array {
  const cleanBase64 = base64.replace(/^data:[^;]+;base64,/, '');
  const binaryString = atob(cleanBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function formatShazamCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(0)}K`;
  return String(count);
}
