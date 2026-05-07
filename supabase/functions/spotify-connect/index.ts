// @ts-nocheck
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, query, code, redirectUri, accessToken, trackId } = body;

    const clientId = Deno.env.get('SPOTIFY_CLIENT_ID') || '';
    const clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET') || '';

    const respond = (data: any, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    // Helper: get client credentials token
    const getClientToken = async (): Promise<string> => {
      const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        },
        body: 'grant_type=client_credentials',
      });
      const d = await res.json();
      if (!d.access_token) throw new Error('Failed to get Spotify token');
      return d.access_token;
    };

    // ── EXCHANGE CODES ──────────────────────────────────────────────────────
    if (action === 'exchange_code') {
      if (!code || !redirectUri) return respond({ error: 'Missing code or redirectUri' }, 400);
      const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
        }).toString(),
      });
      const data = await res.json();
      return respond(data);
    }

    // ── SEARCH ─────────────────────────────────────────────────────────────
    if (action === 'search') {
      if (!query) return respond({ error: 'Missing query' }, 400);
      const token = await getClientToken();
      const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track,playlist&limit=8&market=US`;
      const res = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      const results: any[] = [];

      // Playlists first
      if (Array.isArray(data.playlists?.items)) {
        for (const item of data.playlists.items) {
          if (!item || results.length >= 5) break;
          results.push({
            id: item.id,
            name: item.name,
            owner: item.owner?.display_name || 'Spotify',
            type: 'Playlist',
            imageUrl: item.images?.[0]?.url || null,
            previewUrl: null,
            spotifyUrl: item.external_urls?.spotify || `https://open.spotify.com/playlist/${item.id}`,
            uri: item.uri || `spotify:playlist:${item.id}`,
          });
        }
      }

      // Fill remaining with tracks
      if (Array.isArray(data.tracks?.items)) {
        for (const item of data.tracks.items) {
          if (!item || results.length >= 6) break;
          results.push({
            id: item.id,
            name: item.name,
            owner: item.artists?.map((a: any) => a.name).join(', ') || 'Unknown',
            type: 'Song',
            imageUrl: item.album?.images?.[0]?.url || null,
            previewUrl: item.preview_url || null,
            spotifyUrl: item.external_urls?.spotify || `https://open.spotify.com/track/${item.id}`,
            uri: item.uri || `spotify:track:${item.id}`,
          });
        }
      }

      return respond({ results });
    }

    // ── SAVE TO LIBRARY ────────────────────────────────────────────────────
    if (action === 'save_to_library') {
      if (!accessToken || !trackId) return respond({ error: 'Missing accessToken or trackId' }, 400);
      const res = await fetch(`https://api.spotify.com/v1/me/tracks?ids=${trackId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      return respond({ success: res.ok, status: res.status });
    }

    // ── SAVE PLAYLIST ──────────────────────────────────────────────────────
    if (action === 'follow_playlist') {
      if (!accessToken || !trackId) return respond({ error: 'Missing accessToken or playlistId' }, 400);
      const res = await fetch(`https://api.spotify.com/v1/playlists/${trackId}/followers`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      return respond({ success: res.ok });
    }

    return respond({ error: 'Unknown action' }, 400);
  } catch (err: any) {
    console.error('[spotify-connect]', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
