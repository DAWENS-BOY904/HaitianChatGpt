import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

// ── Types ──────────────────────────────────────────────────────────────────

interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ name: string }>;
  album: {
    name: string;
    images: Array<{ url: string; width: number; height: number }>;
  };
  duration_ms: number;
  preview_url: string | null;
  external_urls: { spotify: string };
  uri: string;
}

interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string;
  images: Array<{ url: string }>;
  tracks: { total: number };
  external_urls: { spotify: string };
  uri: string;
  owner: { display_name: string };
}

interface SpotifySearchResult {
  tracks?: {
    items: SpotifyTrack[];
    total: number;
  };
  playlists?: {
    items: SpotifyPlaylist[];
    total: number;
  };
}

// ── Spotify API Helpers ────────────────────────────────────────────────────

async function getClientCredentialsToken(clientId: string, clientSecret: string): Promise<string> {
  const credentials = btoa(`${clientId}:${clientSecret}`);
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Spotify token error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const credentials = btoa(`${clientId}:${clientSecret}`);
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<{ access_token: string; expires_in: number }> {
  const credentials = btoa(`${clientId}:${clientSecret}`);
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token refresh failed: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

async function searchSpotify(
  query: string,
  type: string = 'track,playlist',
  accessToken: string,
  limit: number = 10
): Promise<SpotifySearchResult> {
  const params = new URLSearchParams({
    q: query,
    type,
    limit: String(limit),
    market: 'US',
  });

  const response = await fetch(`https://api.spotify.com/v1/search?${params}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Spotify search failed: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

async function addTrackToLibrary(
  trackId: string,
  accessToken: string
): Promise<void> {
  const response = await fetch(`https://api.spotify.com/v1/me/tracks`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ids: [trackId] }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to add to library: ${response.status} - ${errorText}`);
  }
}

function formatTrackResult(track: SpotifyTrack) {
  const artists = track.artists.map((a) => a.name).join(', ');
  const albumArt = track.album.images?.[0]?.url || null;
  const durationMin = Math.floor(track.duration_ms / 60000);
  const durationSec = Math.floor((track.duration_ms % 60000) / 1000).toString().padStart(2, '0');

  return {
    id: track.id,
    name: track.name,
    artists,
    album: track.album.name,
    albumArt,
    duration: `${durationMin}:${durationSec}`,
    previewUrl: track.preview_url,
    spotifyUrl: track.external_urls.spotify,
    uri: track.uri,
    type: 'track',
  };
}

function formatPlaylistResult(playlist: SpotifyPlaylist) {
  return {
    id: playlist.id,
    name: playlist.name,
    description: playlist.description || '',
    albumArt: playlist.images?.[0]?.url || null,
    trackCount: playlist.tracks.total,
    owner: playlist.owner.display_name,
    spotifyUrl: playlist.external_urls.spotify,
    uri: playlist.uri,
    type: 'playlist',
  };
}

// ── Main Serve ─────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const spotifyClientId = Deno.env.get('SPOTIFY_CLIENT_ID');
    const spotifyClientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET');

    if (!spotifyClientId || !spotifyClientSecret) {
      console.error('[spotify-connect] Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET');
      return new Response(
        JSON.stringify({ error: 'Spotify credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch (_e) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const action = body.action as string;

    // ── Exchange OAuth code for tokens ──────────────────────────────────
    if (action === 'exchange_code') {
      const { code, redirectUri } = body;
      if (!code || !redirectUri) {
        return new Response(
          JSON.stringify({ error: 'code and redirectUri are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        const tokens = await exchangeCodeForTokens(code, redirectUri, spotifyClientId, spotifyClientSecret);
        console.log('[spotify-connect] OAuth exchange successful');
        return new Response(
          JSON.stringify({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_in: tokens.expires_in,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (err: any) {
        console.error('[spotify-connect] OAuth exchange error:', err.message);
        return new Response(
          JSON.stringify({ error: `OAuth exchange failed: ${err.message}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ── Refresh access token ─────────────────────────────────────────────
    if (action === 'refresh_token') {
      const { refreshToken } = body;
      if (!refreshToken) {
        return new Response(
          JSON.stringify({ error: 'refreshToken is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        const tokens = await refreshAccessToken(refreshToken, spotifyClientId, spotifyClientSecret);
        return new Response(
          JSON.stringify({
            access_token: tokens.access_token,
            expires_in: tokens.expires_in,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (err: any) {
        console.error('[spotify-connect] Token refresh error:', err.message);
        return new Response(
          JSON.stringify({ error: `Token refresh failed: ${err.message}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ── Search Spotify ─────────────────────────────────────────────────
    if (action === 'search') {
      const { query, type = 'track,playlist', limit = 10, accessToken: userToken } = body;

      if (!query) {
        return new Response(
          JSON.stringify({ error: 'query is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        // Use user token if available, otherwise use client credentials
        let token = userToken;
        if (!token) {
          token = await getClientCredentialsToken(spotifyClientId, spotifyClientSecret);
        }

        const results = await searchSpotify(query, type, token, Math.min(limit, 20));

        const tracks = (results.tracks?.items || []).map(formatTrackResult);
        const playlists = (results.playlists?.items || []).map(formatPlaylistResult);

        console.log(`[spotify-connect] Search "${query}": ${tracks.length} tracks, ${playlists.length} playlists`);

        return new Response(
          JSON.stringify({
            tracks,
            playlists,
            total: {
              tracks: results.tracks?.total || 0,
              playlists: results.playlists?.total || 0,
            },
            query,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (err: any) {
        console.error('[spotify-connect] Search error:', err.message);
        return new Response(
          JSON.stringify({ error: `Search failed: ${err.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ── Add track to library ────────────────────────────────────────────
    if (action === 'add_to_library') {
      const { trackId, accessToken: userToken } = body;

      if (!trackId || !userToken) {
        return new Response(
          JSON.stringify({ error: 'trackId and accessToken are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        await addTrackToLibrary(trackId, userToken);
        console.log(`[spotify-connect] Track ${trackId} added to library`);
        return new Response(
          JSON.stringify({ success: true, message: 'Track added to your Spotify library' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (err: any) {
        console.error('[spotify-connect] Add to library error:', err.message);
        return new Response(
          JSON.stringify({ error: `Failed to add track: ${err.message}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ── Get Spotify recommendations by mood/genre ───────────────────────
    if (action === 'recommendations') {
      const { seed_genres, seed_tracks, limit = 10, accessToken: userToken } = body;

      try {
        let token = userToken;
        if (!token) {
          token = await getClientCredentialsToken(spotifyClientId, spotifyClientSecret);
        }

        const params = new URLSearchParams({ limit: String(Math.min(limit, 20)), market: 'US' });
        if (seed_genres) params.set('seed_genres', seed_genres);
        if (seed_tracks) params.set('seed_tracks', seed_tracks);

        const response = await fetch(`https://api.spotify.com/v1/recommendations?${params}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });

        if (!response.ok) {
          throw new Error(`Recommendations failed: ${response.status}`);
        }

        const data = await response.json();
        const tracks = (data.tracks || []).map(formatTrackResult);

        return new Response(
          JSON.stringify({ tracks }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (err: any) {
        console.error('[spotify-connect] Recommendations error:', err.message);
        return new Response(
          JSON.stringify({ error: `Recommendations failed: ${err.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ── Unknown action ──────────────────────────────────────────────────
    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[spotify-connect] Unhandled error:', msg);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
