import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ============================================
// KONFIGIRASYON
// ============================================

const CONFIG = {
  // Supabase credentials
  SUPABASE_URL: Deno.env.get('SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  
  // Security
  REQUIRE_ADMIN_AUTH: true, // Set to false if you want to allow system bans
  MAX_BAN_DURATION_DAYS: 365, // 1 year max
  MIN_BAN_DURATION_HOURS: 1, // 1 hour minimum
  
  // Rate limiting
  MAX_BANS_PER_HOUR: 100,
  
  // Audit logging
  ENABLE_AUDIT_LOG: true,
}

// ============================================
// CORS HEADERS
// ============================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  'Access-Control-Max-Age': '86400',
}

// ============================================
// TIP KI DEFINI
// ============================================

interface BanRequest {
  userId: string
  reason: string
  bannedUntil: string
  evidence?: any
  adminId?: string
  permanent?: boolean
  notifyUser?: boolean
}

interface BanResponse {
  success: boolean
  message: string
  userId: string
  bannedUntil: string
  reason: string
  permanent: boolean
  processingTime: number
  requestId: string
  timestamp: string
}

interface ErrorResponse {
  success: false
  error: string
  details?: string
  code: string
  requestId: string
  timestamp: string
}

// ============================================
// RATE LIMITER POU BAN
// ============================================

class BanRateLimiter {
  private bans: Map<string, number[]> = new Map()
  
  checkLimit(adminId: string): { allowed: boolean; remaining: number; resetTime?: number } {
    const now = Date.now()
    const hourAgo = now - 3600000
    
    const adminBans = this.bans.get(adminId) || []
    const recentBans = adminBans.filter(time => time > hourAgo)
    
    if (recentBans.length >= CONFIG.MAX_BANS_PER_HOUR) {
      const oldestBan = Math.min(...recentBans)
      return {
        allowed: false,
        remaining: 0,
        resetTime: oldestBan + 3600000
      }
    }
    
    recentBans.push(now)
    this.bans.set(adminId, recentBans)
    
    return {
      allowed: true,
      remaining: CONFIG.MAX_BANS_PER_HOUR - recentBans.length
    }
  }
}

const rateLimiter = new BanRateLimiter()

// ============================================
// VALIDATION FUNCTIONS
// ============================================

function validateUserId(userId: unknown): { valid: boolean; error?: string } {
  if (!userId) {
    return { valid: false, error: 'userId is required' }
  }
  
  if (typeof userId !== 'string') {
    return { valid: false, error: 'userId must be a string' }
  }
  
  // UUID format validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(userId)) {
    return { valid: false, error: 'userId must be a valid UUID format' }
  }
  
  return { valid: true }
}

function validateReason(reason: unknown): { valid: boolean; error?: string; sanitized?: string } {
  if (!reason) {
    return { valid: false, error: 'reason is required' }
  }
  
  if (typeof reason !== 'string') {
    return { valid: false, error: 'reason must be a string' }
  }
  
  const trimmed = reason.trim()
  
  if (trimmed.length === 0) {
    return { valid: false, error: 'reason cannot be empty' }
  }
  
  if (trimmed.length < 10) {
    return { valid: false, error: 'reason must be at least 10 characters long' }
  }
  
  if (trimmed.length > 500) {
    return { valid: false, error: 'reason cannot exceed 500 characters' }
  }
  
  // Sanitize - remove potentially dangerous characters
  const sanitized = trimmed
    .replace(/[<>]/g, '') // Remove < and > to prevent HTML injection
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
  
  return { valid: true, sanitized }
}

function validateBannedUntil(
  bannedUntil: unknown, 
  permanent: boolean
): { valid: boolean; error?: string; date?: Date; isPermanent?: boolean } {
  // If permanent, ignore bannedUntil
  if (permanent === true) {
    const farFuture = new Date()
    farFuture.setFullYear(farFuture.getFullYear() + 100)
    return { valid: true, date: farFuture, isPermanent: true }
  }
  
  if (!bannedUntil) {
    return { valid: false, error: 'bannedUntil is required (or set permanent: true)' }
  }
  
  if (typeof bannedUntil !== 'string') {
    return { valid: false, error: 'bannedUntil must be a string (ISO 8601 date)' }
  }
  
  const date = new Date(bannedUntil)
  
  if (isNaN(date.getTime())) {
    return { valid: false, error: 'bannedUntil must be a valid date (ISO 8601 format)' }
  }
  
  const now = new Date()
  
  // Check if date is in the past
  if (date < now) {
    return { valid: false, error: 'bannedUntil cannot be in the past' }
  }
  
  // Check minimum duration
  const minDate = new Date(now.getTime() + CONFIG.MIN_BAN_DURATION_HOURS * 3600000)
  if (date < minDate) {
    return { 
      valid: false, 
      error: `Ban duration must be at least ${CONFIG.MIN_BAN_DURATION_HOURS} hour(s)` 
    }
  }
  
  // Check maximum duration
  const maxDate = new Date(now.getTime() + CONFIG.MAX_BAN_DURATION_DAYS * 86400000)
  if (date > maxDate) {
    return { 
      valid: false, 
      error: `Ban duration cannot exceed ${CONFIG.MAX_BAN_DURATION_DAYS} days` 
    }
  }
  
  return { valid: true, date, isPermanent: false }
}

function validateEvidence(evidence: unknown): { valid: boolean; error?: string; sanitized?: any } {
  if (evidence === undefined || evidence === null) {
    return { valid: true }
  }
  
  // Check size (max 10KB)
  const evidenceString = JSON.stringify(evidence)
  if (evidenceString.length > 10240) {
    return { valid: false, error: 'Evidence too large (max 10KB)' }
  }
  
  // Basic validation that it's an object
  if (typeof evidence !== 'object') {
    return { valid: false, error: 'Evidence must be an object' }
  }
  
  // Sanitize - remove any functions or circular references
  try {
    const sanitized = JSON.parse(JSON.stringify(evidence))
    return { valid: true, sanitized }
  } catch (e) {
    return { valid: false, error: 'Evidence contains invalid data' }
  }
}

// ============================================
// ADMIN AUTHENTICATION
// ============================================

async function verifyAdmin(
  req: Request, 
  supabase: any
): Promise<{ valid: boolean; adminId?: string; error?: string }> {
  if (!CONFIG.REQUIRE_ADMIN_AUTH) {
    return { valid: true, adminId: 'system' }
  }
  
  // Get admin token from header
  const adminToken = req.headers.get('x-admin-token')
  const authHeader = req.headers.get('authorization')
  
  // Option 1: Custom admin token (for service-to-service)
  if (adminToken) {
    // In production, verify against a secure token store
    // For now, we'll check if it matches a hash of service role key
    const expectedToken = await hashString(CONFIG.SUPABASE_SERVICE_ROLE_KEY!.slice(-32))
    if (adminToken === expectedToken) {
      return { valid: true, adminId: 'service' }
    }
  }
  
  // Option 2: JWT token (for admin users)
  if (authHeader?.startsWith('Bearer ')) {
    const jwt = authHeader.slice(7)
    
    try {
      // Verify the JWT and check if user has admin role
      const { data: { user }, error } = await supabase.auth.getUser(jwt)
      
      if (error || !user) {
        return { valid: false, error: 'Invalid authentication token' }
      }
      
      // Check if user has admin role in metadata
      const isAdmin = user.user_metadata?.role === 'admin' || 
                      user.user_metadata?.is_admin === true ||
                      user.app_metadata?.role === 'admin'
      
      if (!isAdmin) {
        return { valid: false, error: 'User does not have admin privileges' }
      }
      
      return { valid: true, adminId: user.id }
    } catch (e) {
      return { valid: false, error: 'Authentication verification failed' }
    }
  }
  
  return { valid: false, error: 'Admin authentication required' }
}

async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(str)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// ============================================
// NOTIFICATION SYSTEM
// ============================================

async function notifyUserOfBan(
  supabase: any,
  userId: string,
  reason: string,
  bannedUntil: string,
  isPermanent: boolean
): Promise<boolean> {
  try {
    // Get user email
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId)
    
    if (userError || !userData?.user?.email) {
      console.warn('Could not get user email for notification:', userError)
      return false
    }
    
    // Insert notification into database (to be processed by a separate service)
    const { error: notifError } = await supabase.from('notifications').insert({
      user_id: userId,
      type: 'account_banned',
      title: isPermanent ? 'Account Permanently Banned' : 'Account Temporarily Suspended',
      message: `Your account has been ${isPermanent ? 'permanently banned' : 'suspended until ' + new Date(bannedUntil).toLocaleString()}. Reason: ${reason}`,
      data: {
        reason,
        bannedUntil,
        isPermanent,
        appealUrl: '/appeal'
      },
      created_at: new Date().toISOString(),
      read: false
    })
    
    if (notifError) {
      console.warn('Failed to create notification:', notifError)
      return false
    }
    
    // TODO: Send email notification
    // This would typically be handled by a separate edge function or service
    
    return true
  } catch (e) {
    console.error('Failed to notify user:', e)
    return false
  }
}

// ============================================
// AUDIT LOGGING
// ============================================

async function logAuditEvent(
  supabase: any,
  event: {
    action: string
    adminId: string
    targetUserId: string
    details: any
    success: boolean
    errorMessage?: string
  }
): Promise<void> {
  if (!CONFIG.ENABLE_AUDIT_LOG) return
  
  try {
    await supabase.from('audit_logs').insert({
      action: event.action,
      actor_id: event.adminId,
      target_id: event.targetUserId,
      details: event.details,
      success: event.success,
      error_message: event.errorMessage,
      ip_address: null, // Could be passed from request
      user_agent: null, // Could be passed from request
      created_at: new Date().toISOString()
    })
  } catch (e) {
    console.error('Failed to write audit log:', e)
  }
}

// ============================================
// MAIN HANDLER
// ============================================

serve(async (req) => {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()
  
  console.log(`[${requestId}] 🚫 Ban request started at ${new Date().toISOString()}`)
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Method not allowed. Only POST requests are accepted.',
        code: 'METHOD_NOT_ALLOWED',
        requestId,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
  
  try {
    // Check configuration
    if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_SERVICE_ROLE_KEY) {
      console.error(`[${requestId}] ❌ Missing Supabase credentials`)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Server configuration error: Missing Supabase credentials',
          code: 'CONFIG_ERROR',
          requestId,
          timestamp: new Date().toISOString()
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
    
    // Initialize Supabase client
    const supabaseAdmin = createClient(
      CONFIG.SUPABASE_URL,
      CONFIG.SUPABASE_SERVICE_ROLE_KEY
    )
    
    // Verify admin authentication
    const authResult = await verifyAdmin(req, supabaseAdmin)
    if (!authResult.valid) {
      console.warn(`[${requestId}] ⚠️ Admin auth failed:`, authResult.error)
      return new Response(
        JSON.stringify({
          success: false,
          error: authResult.error,
          code: 'UNAUTHORIZED',
          requestId,
          timestamp: new Date().toISOString()
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
    
    const adminId = authResult.adminId!
    
    // Check rate limit
    const rateCheck = rateLimiter.checkLimit(adminId)
    if (!rateCheck.allowed) {
      const resetSeconds = Math.ceil((rateCheck.resetTime! - Date.now()) / 1000)
      console.warn(`[${requestId}] ⚠️ Rate limit exceeded for admin ${adminId}`)
      
      return new Response(
        JSON.stringify({
          success: false,
          error: `Rate limit exceeded. Maximum ${CONFIG.MAX_BANS_PER_HOUR} bans per hour. Try again in ${resetSeconds} seconds.`,
          code: 'RATE_LIMIT',
          requestId,
          timestamp: new Date().toISOString()
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': String(resetSeconds)
          } 
        }
      )
    }
    
    // Parse request body
    let body: BanRequest
    try {
      body = await req.json()
    } catch (e) {
      console.error(`[${requestId}] ❌ Invalid JSON:`, e.message)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid JSON in request body',
          details: e.message,
          code: 'INVALID_JSON',
          requestId,
          timestamp: new Date().toISOString()
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
    
    console.log(`[${requestId}] Request details:`, {
      targetUserId: body.userId,
      adminId,
      permanent: body.permanent,
      hasEvidence: !!body.evidence
    })
    
    // Validate all fields
    const userIdValidation = validateUserId(body.userId)
    if (!userIdValidation.valid) {
      await logAuditEvent(supabaseAdmin, {
        action: 'ban_attempt',
        adminId,
        targetUserId: String(body.userId) || 'unknown',
        details: { error: userIdValidation.error },
        success: false,
        errorMessage: userIdValidation.error
      })
      
      return new Response(
        JSON.stringify({
          success: false,
          error: userIdValidation.error,
          code: 'VALIDATION_ERROR',
          requestId,
          timestamp: new Date().toISOString()
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
    
    const reasonValidation = validateReason(body.reason)
    if (!reasonValidation.valid) {
      await logAuditEvent(supabaseAdmin, {
        action: 'ban_attempt',
        adminId,
        targetUserId: body.userId,
        details: { error: reasonValidation.error },
        success: false,
        errorMessage: reasonValidation.error
      })
      
      return new Response(
        JSON.stringify({
          success: false,
          error: reasonValidation.error,
          code: 'VALIDATION_ERROR',
          requestId,
          timestamp: new Date().toISOString()
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
    
    const dateValidation = validateBannedUntil(body.bannedUntil, body.permanent || false)
    if (!dateValidation.valid) {
      await logAuditEvent(supabaseAdmin, {
        action: 'ban_attempt',
        adminId,
        targetUserId: body.userId,
        details: { error: dateValidation.error },
        success: false,
        errorMessage: dateValidation.error
      })
      
      return new Response(
        JSON.stringify({
          success: false,
          error: dateValidation.error,
          code: 'VALIDATION_ERROR',
          requestId,
          timestamp: new Date().toISOString()
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
    
    const evidenceValidation = validateEvidence(body.evidence)
    if (!evidenceValidation.valid) {
      await logAuditEvent(supabaseAdmin, {
        action: 'ban_attempt',
        adminId,
        targetUserId: body.userId,
        details: { error: evidenceValidation.error },
        success: false,
        errorMessage: evidenceValidation.error
      })
      
      return new Response(
        JSON.stringify({
          success: false,
          error: evidenceValidation.error,
          code: 'VALIDATION_ERROR',
          requestId,
          timestamp: new Date().toISOString()
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
    
    const targetUserId = body.userId
    const finalReason = reasonValidation.sanitized!
    const banDate = dateValidation.date!
    const isPermanent = dateValidation.isPermanent!
    const finalEvidence = evidenceValidation.sanitized
    
    // Check if user exists
    console.log(`[${requestId}] 🔍 Checking if user exists: ${targetUserId}`)
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(targetUserId)
    
    if (userError) {
      console.error(`[${requestId}] ❌ Error fetching user:`, userError)
      await logAuditEvent(supabaseAdmin, {
        action: 'ban_attempt',
        adminId,
        targetUserId,
        details: { error: userError.message },
        success: false,
        errorMessage: userError.message
      })
      
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to verify user existence',
          details: userError.message,
          code: 'DATABASE_ERROR',
          requestId,
          timestamp: new Date().toISOString()
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
    
    if (!userData?.user) {
      console.warn(`[${requestId}] ⚠️ User not found: ${targetUserId}`)
      await logAuditEvent(supabaseAdmin, {
        action: 'ban_attempt',
        adminId,
        targetUserId,
        details: { error: 'User not found' },
        success: false,
        errorMessage: 'User not found'
      })
      
      return new Response(
        JSON.stringify({
          success: false,
          error: 'User not found',
          userId: targetUserId,
          code: 'USER_NOT_FOUND',
          requestId,
          timestamp: new Date().toISOString()
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
    
    console.log(`[${requestId}] ✅ User found: ${userData.user.email}`)
    
    // Check if user is already banned
    const existingBan = userData.user.user_metadata?.banned
    if (existingBan) {
      console.warn(`[${requestId}] ⚠️ User already banned: ${targetUserId}`)
      // Continue to update ban (extend or modify)
    }
    
    // Update user metadata to mark as banned
    console.log(`[${requestId}] 📝 Updating user metadata...`)
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      targetUserId,
      {
        user_metadata: {
          ...userData.user.user_metadata,
          banned: true,
          banned_until: isPermanent ? null : banDate.toISOString(),
          ban_reason: finalReason,
          ban_evidence: finalEvidence || null,
          banned_at: new Date().toISOString(),
          banned_by: adminId,
          ban_permanent: isPermanent
        },
        // Also disable the user if permanent
        ...(isPermanent ? { banned_until: 'permanent' } : {})
      }
    )
    
    if (updateError) {
      console.error(`[${requestId}] ❌ Failed to update user:`, updateError)
      await logAuditEvent(supabaseAdmin, {
        action: 'ban',
        adminId,
        targetUserId,
        details: { reason: finalReason, isPermanent },
        success: false,
        errorMessage: updateError.message
      })
      
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to ban user',
          details: updateError.message,
          code: 'BAN_FAILED',
          requestId,
          timestamp: new Date().toISOString()
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
    
    console.log(`[${requestId}] ✅ User metadata updated`)
    
    // Insert ban record for tracking
    console.log(`[${requestId}] 📝 Creating ban record...`)
    const { error: insertError } = await supabaseAdmin.from('user_bans').insert({
      user_id: targetUserId,
      reason: finalReason,
      banned_until: isPermanent ? null : banDate.toISOString(),
      is_permanent: isPermanent,
      evidence: finalEvidence || null,
      created_by: adminId,
      created_at: new Date().toISOString(),
      active: true
    })
    
    if (insertError) {
      console.error(`[${requestId}] ⚠️ Failed to insert ban record:`, insertError)
      // Don't fail - user is already banned
    } else {
      console.log(`[${requestId}] ✅ Ban record created`)
    }
    
    // Notify user if requested
    let notified = false
    if (body.notifyUser !== false) {
      console.log(`[${requestId}] 📧 Notifying user...`)
      notified = await notifyUserOfBan(
        supabaseAdmin,
        targetUserId,
        finalReason,
        banDate.toISOString(),
        isPermanent
      )
    }
    
    // Log audit event
    await logAuditEvent(supabaseAdmin, {
      action: isPermanent ? 'ban_permanent' : 'ban_temporary',
      adminId,
      targetUserId,
      details: {
        reason: finalReason,
        bannedUntil: isPermanent ? null : banDate.toISOString(),
        isPermanent,
        notified
      },
      success: true
    })
    
    const processingTime = Date.now() - startTime
    
    console.log(`[${requestId}] 🎉 Ban successful in ${processingTime}ms`)
    console.log(`  - User: ${userData.user.email}`)
    console.log(`  - Permanent: ${isPermanent}`)
    console.log(`  - Until: ${isPermanent ? 'Never' : banDate.toISOString()}`)
    
    // Success response
    const response: BanResponse = {
      success: true,
      message: isPermanent 
        ? 'User permanently banned successfully' 
        : `User banned until ${banDate.toLocaleString()}`,
      userId: targetUserId,
      bannedUntil: isPermanent ? 'permanent' : banDate.toISOString(),
      reason: finalReason,
      permanent: isPermanent,
      processingTime,
      requestId,
      timestamp: new Date().toISOString()
    }
    
    return new Response(
      JSON.stringify(response),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'X-Request-ID': requestId
        } 
      }
    )
    
  } catch (error: any) {
    const processingTime = Date.now() - startTime
    console.error(`[${requestId}] ❌ Fatal error after ${processingTime}ms:`, error)
    console.error('  Stack:', error.stack)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error during ban operation',
        details: error.message || 'Unknown error',
        code: 'INTERNAL_ERROR',
        requestId,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
