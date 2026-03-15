import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

// ============================================
// KONFIGIRASYON
// ============================================

const CONFIG = {
  // API Settings
  OPENAI_API_KEY: Deno.env.get('OPENAI_API_KEY'),
  SUPABASE_URL: Deno.env.get('SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  
  // TTS Settings
  DEFAULT_VOICE: 'alloy',
  DEFAULT_SPEED: 1.0,
  MIN_SPEED: 0.25,
  MAX_SPEED: 4.0,
  MAX_TEXT_LENGTH: 4096, // OpenAI limit
  MIN_TEXT_LENGTH: 1,
  
  // Storage Settings
  BUCKET_NAME: 'media-files',
  FOLDER_PATH: 'voice-previews',
  FILE_EXTENSION: 'mp3',
  CONTENT_TYPE: 'audio/mpeg',
  
  // Rate Limiting
  MAX_REQUESTS_PER_MINUTE: 30,
  
  // Timeout
  REQUEST_TIMEOUT_MS: 60000,
  
  // Available voices
  VALID_VOICES: [
    'alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer',
    'coral', 'ash', 'sage' // Newer voices
  ] as const
};

type VoiceType = typeof CONFIG.VALID_VOICES[number];

// ============================================
// RATE LIMITER
// ============================================

class SimpleRateLimiter {
  private requests: Map<string, number[]> = new Map();
  
  checkLimit(identifier: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const windowStart = now - 60000; // 1 minute
    
    const requests = this.requests.get(identifier) || [];
    const recentRequests = requests.filter(time => time > windowStart);
    
    if (recentRequests.length >= CONFIG.MAX_REQUESTS_PER_MINUTE) {
      const oldestRequest = Math.min(...recentRequests);
      return {
        allowed: false,
        remaining: 0,
        resetTime: oldestRequest + 60000
      };
    }
    
    recentRequests.push(now);
    this.requests.set(identifier, recentRequests);
    
    return {
      allowed: true,
      remaining: CONFIG.MAX_REQUESTS_PER_MINUTE - recentRequests.length,
      resetTime: now + 60000
    };
  }
}

const rateLimiter = new SimpleRateLimiter();

// ============================================
// VALIDATION FUNCTIONS
// ============================================

function validateText(text: unknown): { valid: boolean; error?: string; sanitized?: string } {
  // Check if text exists
  if (text === undefined || text === null) {
    return { valid: false, error: 'Text is required for TTS generation' };
  }
  
  // Check if string
  if (typeof text !== 'string') {
    return { valid: false, error: 'Text must be a string' };
  }
  
  const trimmed = text.trim();
  
  // Check length
  if (trimmed.length === 0) {
    return { valid: false, error: 'Text cannot be empty' };
  }
  
  if (trimmed.length < CONFIG.MIN_TEXT_LENGTH) {
    return { valid: false, error: `Text must be at least ${CONFIG.MIN_TEXT_LENGTH} character` };
  }
  
  if (trimmed.length > CONFIG.MAX_TEXT_LENGTH) {
    return { 
      valid: false, 
      error: `Text is too long. Maximum ${CONFIG.MAX_TEXT_LENGTH} characters allowed (you have ${trimmed.length})` 
    };
  }
  
  // Check for dangerous content (basic XSS prevention)
  const dangerousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi, // onclick, onerror, etc.
    /<iframe/gi,
    /<object/gi,
    /<embed/gi
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(trimmed)) {
      return { valid: false, error: 'Text contains potentially dangerous content' };
    }
  }
  
  // Sanitize: remove excessive whitespace
  const sanitized = trimmed.replace(/\s+/g, ' ');
  
  return { valid: true, sanitized };
}

function validateVoice(voice: unknown): { valid: boolean; error?: string; voice?: VoiceType } {
  if (voice === undefined || voice === null) {
    return { valid: true, voice: CONFIG.DEFAULT_VOICE as VoiceType };
  }
  
  if (typeof voice !== 'string') {
    return { valid: false, error: 'Voice must be a string' };
  }
  
  const normalizedVoice = voice.toLowerCase().trim() as VoiceType;
  
  if (!CONFIG.VALID_VOICES.includes(normalizedVoice)) {
    return { 
      valid: false, 
      error: `Invalid voice "${voice}". Valid voices are: ${CONFIG.VALID_VOICES.join(', ')}` 
    };
  }
  
  return { valid: true, voice: normalizedVoice };
}

function validateSpeed(speed: unknown): { valid: boolean; error?: string; speed?: number } {
  if (speed === undefined || speed === null) {
    return { valid: true, speed: CONFIG.DEFAULT_SPEED };
  }
  
  const numSpeed = Number(speed);
  
  if (isNaN(numSpeed)) {
    return { valid: false, error: 'Speed must be a number' };
  }
  
  if (numSpeed < CONFIG.MIN_SPEED || numSpeed > CONFIG.MAX_SPEED) {
    return { 
      valid: false, 
      error: `Speed must be between ${CONFIG.MIN_SPEED} and ${CONFIG.MAX_SPEED}` 
    };
  }
  
  return { valid: true, speed: numSpeed };
}

// ============================================
// CONTENT MODERATION (Optional - for TTS)
// ============================================

const INAPPROPRIATE_CONTENT = [
  // Add keywords you don't want TTS to speak
  // This is optional and can be customized
];

function moderateContent(text: string): { approved: boolean; reason?: string } {
  const lowerText = text.toLowerCase();
  
  for (const keyword of INAPPROPRIATE_CONTENT) {
    if (lowerText.includes(keyword.toLowerCase())) {
      return { 
        approved: false, 
        reason: `Content contains inappropriate material: "${keyword}"` 
      };
    }
  }
  
  return { approved: true };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function generateFileName(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `voice_${timestamp}_${random}.${CONFIG.FILE_EXTENSION}`;
}

function clampSpeed(speed: number): number {
  return Math.max(CONFIG.MIN_SPEED, Math.min(CONFIG.MAX_SPEED, speed));
}

// ============================================
// MAIN HANDLER
// ============================================

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  
  console.log(`[${requestId}] 🔊 TTS request started at ${new Date().toISOString()}`);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Method not allowed. Only POST requests are accepted.',
        requestId
      }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
  
  try {
    // Check environment variables
    if (!CONFIG.OPENAI_API_KEY) {
      console.error(`[${requestId}] ❌ OPENAI_API_KEY not configured`);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Server configuration error: OpenAI API key not configured',
          requestId,
          code: 'CONFIG_ERROR'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_SERVICE_ROLE_KEY) {
      console.error(`[${requestId}] ❌ Supabase configuration missing`);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Server configuration error: Storage not configured',
          requestId,
          code: 'CONFIG_ERROR'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Parse request body
    let body: any;
    try {
      body = await req.json();
    } catch (e) {
      console.error(`[${requestId}] ❌ Invalid JSON:`, e.message);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Invalid JSON in request body',
          details: e.message,
          requestId
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    const { text, voice, speed, userId, moderation = true } = body;
    
    console.log(`[${requestId}] Request details:`, {
      userId: userId || 'anonymous',
      voice: voice || 'default',
      speed: speed || 'default',
      textLength: text?.length || 0,
      moderationEnabled: moderation
    });
    
    // Rate limiting by IP or user
    const rateLimitId = userId || req.headers.get('x-forwarded-for') || 'anonymous';
    const rateCheck = rateLimiter.checkLimit(rateLimitId);
    
    if (!rateCheck.allowed) {
      const resetSeconds = Math.ceil((rateCheck.resetTime - Date.now()) / 1000);
      console.warn(`[${requestId}] ⚠️ Rate limit exceeded for ${rateLimitId}`);
      
      return new Response(
        JSON.stringify({ 
          success: false,
          error: `Rate limit exceeded. Please wait ${resetSeconds} seconds before trying again.`,
          requestId,
          code: 'RATE_LIMIT',
          retryAfter: resetSeconds
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': String(resetSeconds)
          } 
        }
      );
    }
    
    // Validate text
    const textValidation = validateText(text);
    if (!textValidation.valid) {
      console.warn(`[${requestId}] ⚠️ Text validation failed:`, textValidation.error);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: textValidation.error,
          requestId,
          code: 'VALIDATION_ERROR'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Validate voice
    const voiceValidation = validateVoice(voice);
    if (!voiceValidation.valid) {
      console.warn(`[${requestId}] ⚠️ Voice validation failed:`, voiceValidation.error);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: voiceValidation.error,
          requestId,
          code: 'VALIDATION_ERROR'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Validate speed
    const speedValidation = validateSpeed(speed);
    if (!speedValidation.valid) {
      console.warn(`[${requestId}] ⚠️ Speed validation failed:`, speedValidation.error);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: speedValidation.error,
          requestId,
          code: 'VALIDATION_ERROR'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Content moderation (if enabled)
    if (moderation) {
      const moderationResult = moderateContent(textValidation.sanitized!);
      if (!moderationResult.approved) {
        console.warn(`[${requestId}] ⚠️ Content moderation failed:`, moderationResult.reason);
        return new Response(
          JSON.stringify({ 
            success: false,
            error: moderationResult.reason,
            requestId,
            code: 'CONTENT_MODERATION'
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }
    
    const finalVoice = voiceValidation.voice!;
    const finalSpeed = clampSpeed(speedValidation.speed!);
    const finalText = textValidation.sanitized!;
    
    console.log(`[${requestId}] 🎯 Generating TTS: voice=${finalVoice}, speed=${finalSpeed}, length=${finalText.length}`);
    
    // Call OpenAI TTS API with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      console.error(`[${requestId}] ⏱️ TTS API timeout`);
      controller.abort();
    }, CONFIG.REQUEST_TIMEOUT_MS);
    
    let ttsResponse: Response;
    try {
      ttsResponse = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CONFIG.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1-hd',
          voice: finalVoice,
          input: finalText,
          speed: finalSpeed,
        }),
        signal: controller.signal,
      });
    } catch (fetchError) {
      clearTimeout(timeout);
      
      if (fetchError.name === 'AbortError') {
        return new Response(
          JSON.stringify({ 
            success: false,
            error: 'TTS generation timed out. Please try with shorter text.',
            requestId,
            code: 'TIMEOUT'
          }),
          { 
            status: 504, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      
      throw fetchError;
    }
    
    clearTimeout(timeout);
    
    // Handle OpenAI errors
    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text();
      console.error(`[${requestId}] ❌ OpenAI TTS error (${ttsResponse.status}):`, errorText);
      
      let errorMessage = 'TTS generation failed';
      let userMessage = 'Failed to generate speech';
      
      switch (ttsResponse.status) {
        case 400:
          errorMessage = 'Invalid request to TTS service';
          userMessage = 'Invalid text or parameters. Please check your input.';
          break;
        case 401:
          errorMessage = 'Authentication failed with TTS service';
          userMessage = 'Service authentication error. Please contact support.';
          break;
        case 429:
          errorMessage = 'Rate limit exceeded on TTS service';
          userMessage = 'Too many requests. Please wait a moment and try again.';
          break;
        case 500:
        case 502:
        case 503:
          errorMessage = 'TTS service temporarily unavailable';
          userMessage = 'Speech service is temporarily unavailable. Please try again later.';
          break;
        default:
          errorMessage = `TTS service error: ${errorText}`;
      }
      
      return new Response(
        JSON.stringify({ 
          success: false,
          error: userMessage,
          details: errorMessage,
          requestId,
          code: 'TTS_SERVICE_ERROR',
          statusCode: ttsResponse.status
        }),
        { 
          status: 502, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Get audio data
    let audioBuffer: ArrayBuffer;
    try {
      audioBuffer = await ttsResponse.arrayBuffer();
    } catch (e) {
      console.error(`[${requestId}] ❌ Failed to read audio buffer:`, e);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Failed to process audio data',
          requestId,
          code: 'AUDIO_PROCESSING_ERROR'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    const audioUint8 = new Uint8Array(audioBuffer);
    const audioSizeKB = (audioUint8.length / 1024).toFixed(1);
    
    console.log(`[${requestId}] 📦 Audio generated: ${audioSizeKB}KB`);
    
    // Initialize Supabase client
    const supabaseAdmin = createClient(
      CONFIG.SUPABASE_URL,
      CONFIG.SUPABASE_SERVICE_ROLE_KEY
    );
    
    // Generate unique filename
    const fileName = generateFileName();
    const filePath = `${CONFIG.FOLDER_PATH}/${fileName}`;
    
    // Upload to Supabase Storage with retry
    let uploadAttempts = 0;
    const maxUploadAttempts = 3;
    let uploadData: any = null;
    let uploadError: any = null;
    
    while (uploadAttempts < maxUploadAttempts) {
      uploadAttempts++;
      
      try {
        const result = await supabaseAdmin.storage
          .from(CONFIG.BUCKET_NAME)
          .upload(filePath, audioUint8, {
            contentType: CONFIG.CONTENT_TYPE,
            upsert: false, // Don't overwrite, we have unique filename
            cacheControl: '3600',
          });
        
        uploadData = result.data;
        uploadError = result.error;
        
        if (!uploadError) break;
        
        console.warn(`[${requestId}] ⚠️ Upload attempt ${uploadAttempts} failed:`, uploadError);
        
        if (uploadAttempts < maxUploadAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000 * uploadAttempts));
        }
      } catch (e) {
        console.error(`[${requestId}] ❌ Upload exception attempt ${uploadAttempts}:`, e);
        uploadError = e;
      }
    }
    
    if (uploadError || !uploadData) {
      console.error(`[${requestId}] ❌ All upload attempts failed:`, uploadError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Failed to store audio file after multiple attempts',
          details: uploadError?.message || 'Unknown upload error',
          requestId,
          code: 'STORAGE_ERROR'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from(CONFIG.BUCKET_NAME)
      .getPublicUrl(filePath);
    
    if (!urlData?.publicUrl) {
      console.error(`[${requestId}] ❌ Failed to get public URL`);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Failed to generate audio URL',
          requestId,
          code: 'URL_GENERATION_ERROR'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    const processingTime = Date.now() - startTime;
    
    console.log(`[${requestId}] ✅ TTS success in ${processingTime}ms: ${urlData.publicUrl}`);
    
    // Log to database (optional analytics)
    try {
      await supabaseAdmin.from('tts_logs').insert({
        request_id: requestId,
        user_id: userId || null,
        voice: finalVoice,
        speed: finalSpeed,
        text_length: finalText.length,
        audio_size_bytes: audioUint8.length,
        processing_time_ms: processingTime,
        created_at: new Date().toISOString()
      });
    } catch (e) {
      // Non-critical, just log
      console.warn(`[${requestId}] ⚠️ Failed to log analytics:`, e);
    }
    
    // Success response
    return new Response(
      JSON.stringify({ 
        success: true,
        audioUrl: urlData.publicUrl,
        metadata: {
          voice: finalVoice,
          speed: finalSpeed,
          textLength: finalText.length,
          audioSizeKB: parseFloat(audioSizeKB),
          processingTimeMs: processingTime,
          fileName: fileName
        },
        rateLimit: {
          remaining: rateCheck.remaining,
          resetTime: new Date(rateCheck.resetTime).toISOString()
        },
        requestId
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'X-Request-ID': requestId
        } 
      }
    );
    
  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error(`[${requestId}] ❌ Fatal error after ${processingTime}ms:`, error);
    console.error('  Stack:', error.stack);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'An unexpected error occurred during TTS generation',
        details: error.message || 'Unknown error',
        requestId,
        code: 'INTERNAL_ERROR'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
