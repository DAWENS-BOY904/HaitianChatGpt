import Deno from "https://deno.land/x/deno@v1.37.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SHAZAM_API_KEY = Deno.env.get("SHAZAM_API_KEY") ?? "";
    const SHAZAM_BASE_URL = "https://shazam-api.com/api";

    const body = await req.json();
    const { action, audio, query, track_id } = body;

    // ── Identify by audio ─────────────────────────────────────────────────
    if (action === "identify" && audio) {
      // POST audio base64 to Shazam API
      const response = await fetch(`${SHAZAM_BASE_URL}/detect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-rapidapi-key": SHAZAM_API_KEY,
          "x-rapidapi-host": "shazam-api.com",
        },
        body: JSON.stringify({ audio }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Shazam identify error:", errText);
        return new Response(
          JSON.stringify({ error: `Shazam API: ${response.status} ${errText}` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }

      const data = await response.json();
      return new Response(
        JSON.stringify({ result: data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Search by text query ──────────────────────────────────────────────
    if (action === "search" && query) {
      const searchUrl = `${SHAZAM_BASE_URL}/search_song?query=${encodeURIComponent(query)}&limit=5`;
      const response = await fetch(searchUrl, {
        method: "GET",
        headers: {
          "x-rapidapi-key": SHAZAM_API_KEY,
          "x-rapidapi-host": "shazam-api.com",
        },
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Shazam search error:", errText);
        return new Response(
          JSON.stringify({ error: `Shazam API: ${response.status} ${errText}` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }

      const data = await response.json();
      // Normalize results
      const results = Array.isArray(data?.result?.tracks?.hits)
        ? data.result.tracks.hits.map((h: any) => ({
            id: h.track?.key || h.track?.id || String(Math.random()),
            title: h.track?.title || "Unknown",
            subtitle: h.track?.subtitle || "",
            images: h.track?.images || {},
            share: h.track?.share || {},
            hub: h.track?.hub || {},
            shazam_count: h.track?.stats?.count || 0,
          }))
        : [];

      return new Response(
        JSON.stringify({ results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Get track details ─────────────────────────────────────────────────
    if (action === "track_detail" && track_id) {
      const url = `${SHAZAM_BASE_URL}/get_song?id=${encodeURIComponent(track_id)}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "x-rapidapi-key": SHAZAM_API_KEY,
          "x-rapidapi-host": "shazam-api.com",
        },
      });

      if (!response.ok) {
        const errText = await response.text();
        return new Response(
          JSON.stringify({ error: `Shazam API: ${response.status} ${errText}` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }

      const data = await response.json();
      return new Response(
        JSON.stringify({ track: data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  } catch (err: any) {
    console.error("Shazam function error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
