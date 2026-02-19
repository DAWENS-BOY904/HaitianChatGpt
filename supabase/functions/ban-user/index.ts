import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { userId, reason, bannedUntil, evidence } = await req.json()

    if (!userId) {
      return new Response(JSON.stringify({ error: 'No userId' }), { status: 400 })
    }

    // Update user metadata to ban
    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { 
        ban_duration: '10 days',
        user_metadata: { 
          banned: true,
          banned_until: bannedUntil,
          ban_reason: reason,
          ban_evidence: evidence,
        }
      }
    )

    if (error) throw error

    // Insert into bans table for tracking
    await supabaseAdmin.from('user_bans').insert({
      user_id: userId,
      reason,
      banned_until: bannedUntil,
      evidence,
      created_at: new Date().toISOString(),
    })

    console.log('✅ User banned:', userId, 'until', bannedUntil)

    return new Response(
      JSON.stringify({ success: true, message: 'User banned' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Ban error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
