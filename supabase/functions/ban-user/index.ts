import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface BanRequest {
  userId: string
  reason: string
  bannedUntil: string
  evidence?: any
  adminId?: string
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now()
  console.log('🚫 [ban-user] Request received at', new Date().toISOString())

  try {
    // Initialize Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    if (!Deno.env.get('SUPABASE_URL') || !Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) {
      console.error('❌ [ban-user] Missing Supabase credentials')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse and validate request body
    let body: BanRequest
    try {
      const requestText = await req.text()
      if (!requestText) {
        throw new Error('Empty request body')
      }
      body = JSON.parse(requestText)
    } catch (e) {
      console.error('❌ [ban-user] Invalid request body:', e.message)
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body', details: e.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { userId, reason, bannedUntil, evidence, adminId } = body

    // Validate required fields
    if (!userId || typeof userId !== 'string') {
      console.error('❌ [ban-user] Missing or invalid userId')
      return new Response(
        JSON.stringify({ error: 'Missing or invalid userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!reason || typeof reason !== 'string') {
      console.error('❌ [ban-user] Missing or invalid reason')
      return new Response(
        JSON.stringify({ error: 'Missing or invalid reason' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!bannedUntil || typeof bannedUntil !== 'string') {
      console.error('❌ [ban-user] Missing or invalid bannedUntil')
      return new Response(
        JSON.stringify({ error: 'Missing or invalid bannedUntil date' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate date format
    const banDate = new Date(bannedUntil)
    if (isNaN(banDate.getTime())) {
      console.error('❌ [ban-user] Invalid date format:', bannedUntil)
      return new Response(
        JSON.stringify({ error: 'Invalid date format for bannedUntil' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('📊 [ban-user] Processing ban request:')
    console.log('  - User ID:', userId)
    console.log('  - Reason:', reason)
    console.log('  - Banned Until:', bannedUntil)
    console.log('  - Admin ID:', adminId || 'system')

    // Check if user exists
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId)
    
    if (userError || !userData) {
      console.error('❌ [ban-user] User not found:', userId)
      return new Response(
        JSON.stringify({ error: 'User not found', userId }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ [ban-user] User found:', userData.user.email)

    // Update user metadata to mark as banned
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { 
        ban_duration: 'permanent',
        user_metadata: { 
          banned: true,
          banned_until: bannedUntil,
          ban_reason: reason,
          ban_evidence: evidence || null,
          banned_at: new Date().toISOString(),
        }
      }
    )

    if (updateError) {
      console.error('❌ [ban-user] Failed to update user metadata:', updateError)
      throw updateError
    }

    console.log('✅ [ban-user] User metadata updated successfully')

    // Insert ban record into user_bans table for tracking
    const { error: insertError } = await supabaseAdmin.from('user_bans').insert({
      user_id: userId,
      reason,
      banned_until: bannedUntil,
      evidence: evidence || null,
      created_by: adminId || null,
      created_at: new Date().toISOString(),
    })

    if (insertError) {
      console.error('⚠️ [ban-user] Failed to insert ban record (user still banned):', insertError)
      // Don't fail the entire operation - user is already banned in auth
    } else {
      console.log('✅ [ban-user] Ban record inserted successfully')
    }

    const totalTime = Date.now() - startTime
    console.log('🎉 [ban-user] User banned successfully in', totalTime, 'ms')
    console.log('  - User:', userData.user.email)
    console.log('  - Until:', bannedUntil)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'User banned successfully',
        userId,
        bannedUntil,
        reason,
        processingTime: totalTime
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    const totalTime = Date.now() - startTime
    console.error('❌ [ban-user] Function error after', totalTime, 'ms:', error)
    console.error('  Error type:', error.name)
    console.error('  Error message:', error.message)
    console.error('  Stack:', error.stack)
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error during ban operation',
        details: error.message,
        processingTime: totalTime
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
