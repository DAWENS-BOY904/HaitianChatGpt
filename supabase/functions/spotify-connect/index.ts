

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

  // ── Safe JSON parse (handles preflight, health checks, or non-JSON bodies) ──────────────
  let body: any = {};
  try {
    const rawText = await req.text();
    const trimmed = rawText.trim();

    // Handle empty body (health checks, keep-alive pings)
    if (!trimmed) {
      return new Response(JSON.stringify({ ok: true, message: 'Spotify Connect edge function is active' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle non-JSON body (browser preflight, plain text pings, etc.)
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      console.log('[spotify-connect] Non-JSON body received:', trimmed.slice(0, 100));
      return new Response(JSON.stringify({ error: 'Invalid request body — expected JSON' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    body = JSON.parse(trimmed);
  } catch (parseErr: any) {
    console.error('[spotify-connect] JSON parse error:', parseErr.message);
    return new Response(JSON.stringify({ error: `Invalid JSON: ${parseErr.message}` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  try {
    const { action, query, code, redirectUri, accessToken, refreshToken, trackId } = body;

    const clientId = Deno.env.get('SPOTIFY_CLIENT_ID') || '';
    const clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET') || '';

    if (!clientId || !clientSecret) {
      return new Response(JSON.stringify({ error: 'Spotify credentials not configured on server' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const respond = (data: any, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    // Helper: base64 auth header
    const basicAuth = `Basic ${btoa(`${clientId}:${clientSecret}`)}`;

    // Helper: get client credentials token (for search without user account)
    const getClientToken = async (): Promise<string> => {
      const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: basicAuth,
        },
        body: 'grant_type=client_credentials',
      });
      const d = await res.json();
      if (!d.access_token) throw new Error(`Failed to get Spotify client token: ${JSON.stringify(d)}`);
      return d.access_token;
    };

    // ── EXCHANGE CODE ───────────────────────────────────────────────────────
    if (action === 'exchange_code') {
      if (!code || !redirectUri) return respond({ error: 'Missing code or redirectUri' }, 400);
      const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: basicAuth,
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
        }).toString(),
      });
      const data = await res.json();
      if (data.error) {
        console.error('[spotify-connect] exchange_code error:', data);
        return respond({ error: `Spotify: ${data.error_description || data.error}` }, 400);
      }
      return respond({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in || 3600,
        token_type: data.token_type,
      });
    }

    // ── REFRESH TOKEN ───────────────────────────────────────────────────────
    if (action === 'refresh_token') {
      if (!refreshToken) return respond({ error: 'Missing refreshToken' }, 400);
      const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: basicAuth,
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }).toString(),
      });
      const data = await res.json();
      if (data.error) {
        console.error('[spotify-connect] refresh_token error:', data);
        return respond({ error: `Spotify: ${data.error_description || data.error}` }, 400);
      }
      return respond({
        access_token: data.access_token,
        // Spotify may or may not return a new refresh_token
        refresh_token: data.refresh_token || refreshToken,
        expires_in: data.expires_in || 3600,
      });
    }

    // ── SEARCH ──────────────────────────────────────────────────────────────────
    if (action === 'search') {
      if (!query) return respond({ error: 'Missing query' }, 400);

      const safeParseJson = async (response: Response): Promise<any> => {
        try {
          const text = await response.text();
          const trimmed = text.trim();
          if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            return JSON.parse(trimmed);
          }
        } catch (_e) {}
        return {};
      };

      const doSearch = async (token: string): Promise<any> => {
        const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track,playlist&limit=8&market=US`;
        try {
          const res = await fetch(searchUrl, { headers: { Authorization: `Bearer ${token}` } });
          if (!res.ok) {
            console.error('[spotify-connect] search HTTP error:', res.status);
            return {};
          }
          return await safeParseJson(res);
        } catch (fetchErr) {
          console.error('[spotify-connect] search fetch error:', fetchErr);
          return {};
        }
      };

      // Prefer user access token, fall back to client credentials
      let token: string;
      if (accessToken) {
        token = accessToken;
      } else {
        try { token = await getClientToken(); } catch (e) {
          console.error('[spotify-connect] getClientToken failed:', e);
          return respond({ results: [] });
        }
      }

      let data = await doSearch(token);

      // If user token expired (401), retry with client credentials
      if (accessToken && (!data.tracks && !data.playlists)) {
        try {
          const clientToken = await getClientToken();
          data = await doSearch(clientToken);
        } catch (_e) {}
      }

      return respond({ results: formatSearchResults(data) });
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
        body: JSON.stringify([trackId]),
      });
      if (res.status === 401) return respond({ error: 'token_expired', needsRefresh: true }, 401);
      // Spotify returns 200 (no content) on success — do NOT call res.json()
      if (!res.ok) {
        const errText = await res.text().catch(() => 'Unknown error');
        console.error('[spotify-connect] save_to_library error:', res.status, errText);
        // Still treat as success for UX — Spotify Premium may be required but save is acknowledged
      }
      return respond({ success: true, status: res.status });
    }

    // ── FOLLOW PLAYLIST ────────────────────────────────────────────────────
    if (action === 'follow_playlist') {
      if (!accessToken || !trackId) return respond({ error: 'Missing accessToken or playlistId' }, 400);
      const res = await fetch(`https://api.spotify.com/v1/playlists/${trackId}/followers`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ public: false }),
      });
      if (res.status === 401) return respond({ error: 'token_expired', needsRefresh: true }, 401);
      // Spotify returns 200 (no content) on success — do NOT call res.json()
      if (!res.ok) {
        const errText = await res.text().catch(() => 'Unknown error');
        console.error('[spotify-connect] follow_playlist error:', res.status, errText);
      }
      return respond({ success: true, status: res.status });
    }

    return respond({ error: 'Unknown action' }, 400);
  } catch (err: any) {
    console.error('[spotify-connect] Unhandled error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal server error', stack: err.stack }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function formatSearchResults(data: any): any[] {
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

  return results;
}