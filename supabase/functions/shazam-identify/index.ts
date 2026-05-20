/**
 * Shazam Identify — audio-only song recognition
 * Only recognizes songs from audio, no text search.
 * Uses RapidAPI Shazam endpoint.
 */

import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SHAZAM_API_KEY = Deno.env.get('SHAZAM_API_KEY') ?? '';
    if (!SHAZAM_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Shazam API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { audio, sampleMs = 4000 } = body;

    if (!audio) {
      return new Response(
        JSON.stringify({ error: 'Missing audio field (base64 encoded audio required)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🎵 Shazam: identifying song from audio...');

    // Decode base64 to binary
    const binaryStr = atob(audio);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    // Call Shazam detect endpoint via RapidAPI
    const response = await fetch(
      `https://shazam.p.rapidapi.com/songs/v2/detect?timezone=America%2FChicago&locale=en-US`,
      {
        method: 'POST',
        headers: {
          'content-type': 'text/plain',
          'x-rapidapi-key': SHAZAM_API_KEY,
          'x-rapidapi-host': 'shazam.p.rapidapi.com',
        },
        body: bytes,
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error('Shazam API error:', response.status, errText);

      // Try alternate endpoint if first fails
      const response2 = await fetch(
        `https://shazam-api7.p.rapidapi.com/songs/detect`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            'x-rapidapi-key': SHAZAM_API_KEY,
            'x-rapidapi-host': 'shazam-api7.p.rapidapi.com',
          },
          body: bytes,
        }
      );

      if (!response2.ok) {
        const errText2 = await response2.text();
        return new Response(
          JSON.stringify({ error: `Shazam recognition failed: ${response2.status}`, details: errText2.slice(0, 200) }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data2 = await response2.json();
      return new Response(
        JSON.stringify(normalizeShazamResult(data2)),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('✅ Shazam result received');

    return new Response(
      JSON.stringify(normalizeShazamResult(data)),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('Shazam function error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Normalize Shazam API response into a clean track object
 */
function normalizeShazamResult(data: any): { track: ShazamTrack | null; matches: any[] } {
  // Handle no match
  if (!data || (!data.track && !data.matches?.length && !data.result)) {
    return { track: null, matches: [] };
  }

  // Primary track from RapidAPI shazam format
  const raw = data.track || data.result?.track || data;

  if (!raw || (!raw.title && !raw.subtitle)) {
    return { track: null, matches: data.matches || [] };
  }

  const track: ShazamTrack = {
    title: raw.title || 'Unknown',
    artist: raw.subtitle || raw.artist || '',
    album: raw.sections?.find((s: any) => s.type === 'SONG')?.metadata?.find((m: any) => m.title === 'Album')?.text || '',
    coverUrl: raw.images?.coverart || raw.images?.coverarthq || raw.share?.image || '',
    previewUrl: raw.hub?.actions?.find((a: any) => a.type === 'uri')?.uri || '',
    appleUrl: raw.hub?.options?.find((o: any) => o.caption === 'OPEN IN')?.actions?.[0]?.uri || '',
    spotifyUrl: raw.hub?.providers?.find((p: any) => p.caption?.toLowerCase().includes('spotify'))?.actions?.[0]?.uri || '',
    genres: raw.genres?.primary || '',
    releaseDate: raw.releasedate || '',
    shazamUrl: raw.url || raw.share?.href || '',
    key: raw.key || '',
    lyrics: raw.sections?.find((s: any) => s.type === 'LYRICS')?.text?.slice(0, 8)?.join('\n') || '',
    bpm: raw.sections?.find((s: any) => s.type === 'SONG')?.metadata?.find((m: any) => m.title === 'BPM')?.text || '',
  };

  return { track, matches: data.matches || [] };
}

interface ShazamTrack {
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
  previewUrl: string;
  appleUrl: string;
  spotifyUrl: string;
  genres: string;
  releaseDate: string;
  shazamUrl: string;
  key: string;
  lyrics: string;
  bpm: string;
}
