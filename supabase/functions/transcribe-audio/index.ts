import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Inline CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Scam/fraud keywords to detect (English, French, Haitian Creole)
const SCAM_KEYWORDS = [
  // English
  'scam', 'fraud', 'steal', 'hacking', 'hack', 'phishing', 'carding', 
  'credit card fraud', 'identity theft', 'ponzi', 'pyramid scheme',
  'money laundering', 'wire fraud', 'bank fraud', 'tax evasion',
  'fake check', 'counterfeit', 'forgery', 'embezzlement', 'bribery',
  'extortion', 'blackmail', 'racketeering', 'securities fraud',
  'investment fraud', 'insurance fraud', 'loan fraud', 'mortgage fraud',
  'medicare fraud', 'welfare fraud', 'unemployment fraud',
  'romance scam', 'catfishing', 'pig butchering', 'advance fee',
  'nigerian prince', 'lottery scam', 'inheritance scam', 'job scam',
  'fake job', 'reshipping', 'mule', 'money mule', 'drug trafficking',
  'human trafficking', 'arms dealing', 'terrorist financing',
  'sanctions evasion', 'shell company', 'offshore account', 'tax haven',
  'bitcoin scam', 'crypto scam', 'nft scam', 'defi exploit',
  'rug pull', 'pump and dump', 'wash trading', 'spoofing',
  'layering', 'structuring', 'smurfing', 'cuckoo smurfing',
  
  // French
  'arnaque', 'fraude', 'escroquerie', 'hameçonnage', 'pêche',
  'blanchiment', 'blanchiment d\'argent', 'faux chèque',
  'contrefaçon', 'chantage', 'extorsion', 'corruption',
  'détournement', 'détournement de fonds', 'tromperie',
  'abus de confiance', 'faux et usage de faux',
  'trafic de drogue', 'trafic d\'armes', 'trafic d\'êtres humains',
  
  // Haitian Creole
  'twonpe', 'fè twonpe', 'vòlè', 'vòl', 'pyès fòs', 'pyès fo',
  'fèbli', 'pwazon', 'pwazonnen', 'tiye', 'asasinen',
  'trafik dwòg', 'trafik zam', 'trafik moun',
  'lajan sale', 'lajan sal', 'kòb sale', 'kòb sal',
  'kawotchou', 'fèbli chèk', 'fèbli kat', 'kat kredi fo',
  'idanite vòlè', 'vòlè idanite', 'non fo', 'adrès fo',
  'nimewo fo', 'telefòn fo', 'imèl fo', 'fèbli dokiman',
]

// Sexual content keywords (allowed but logged)
const SEXUAL_KEYWORDS = [
  'sex', 'sexual', 'porn', 'pornography', 'nude', 'naked',
  'sexe', 'sexuel', 'porno', 'pornographie', 'nu', 'nue',
  'sek', 'seksyèl', 'ponografi', 'po', 'po devan',
]

// Check if text contains scam keywords
function detectScam(text: string): { isScam: boolean; matchedWords: string[] } {
  const lowerText = text.toLowerCase()
  const matchedWords: string[] = []
  
  for (const keyword of SCAM_KEYWORDS) {
    if (lowerText.includes(keyword.toLowerCase())) {
      matchedWords.push(keyword)
    }
  }
  
  return {
    isScam: matchedWords.length > 0,
    matchedWords
  }
}

// Check if text contains sexual content
function detectSexual(text: string): boolean {
  const lowerText = text.toLowerCase()
  return SEXUAL_KEYWORDS.some(keyword => 
    lowerText.includes(keyword.toLowerCase())
  )
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now()
  console.log('🎤 [transcribe-audio] Request received at', new Date().toISOString())

  try {
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
      console.error('❌ [transcribe-audio] OPENAI_API_KEY not configured')
      return new Response(
        JSON.stringify({ error: 'Server configuration error: Missing API key' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request with timeout protection
    let body
    try {
      const requestText = await req.text()
      if (!requestText) {
        throw new Error('Empty request body')
      }
      body = JSON.parse(requestText)
    } catch (e) {
      console.error('❌ [transcribe-audio] Invalid request:', e.message)
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body', details: e.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { audio, userId, conversationId } = body
    
    if (!audio || typeof audio !== 'string') {
      console.error('❌ [transcribe-audio] No audio data provided')
      return new Response(
        JSON.stringify({ error: 'No audio data provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('📊 [transcribe-audio] Processing request:')
    console.log('  - User ID:', userId || 'anonymous')
    console.log('  - Conversation ID:', conversationId || 'none')
    console.log('  - Audio size:', audio.length, 'chars')

    // Convert base64 with validation
    let audioBuffer: Uint8Array
    try {
      const decodedAudio = atob(audio)
      if (decodedAudio.length === 0) {
        throw new Error('Empty audio after decoding')
      }
      
      // Check minimum audio size (roughly 0.5 seconds at 16kHz mono)
      const minAudioSize = 16000 // 16kHz * 1 channel * 1 second * minimum 0.5 seconds
      if (decodedAudio.length < minAudioSize) {
        return new Response(
          JSON.stringify({ 
            error: 'Audio recording is too short. Please record for at least 1 second.',
            type: 'AudioTooShort'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      audioBuffer = Uint8Array.from(decodedAudio, c => c.charCodeAt(0))
      console.log('✅ [transcribe-audio] Audio decoded successfully:', audioBuffer.length, 'bytes')
      
      // Validate audio size (max 25MB for Whisper)
      const maxSize = 25 * 1024 * 1024
      if (audioBuffer.length > maxSize) {
        throw new Error(`Audio too large: ${(audioBuffer.length / 1024 / 1024).toFixed(2)}MB (max 25MB)`)
      }
    } catch (e) {
      console.error('❌ [transcribe-audio] Base64 decode error:', e.message)
      return new Response(
        JSON.stringify({ error: 'Invalid base64 audio data', details: e.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create FormData with proper audio format
    const formData = new FormData()
    
    // Convert audio buffer to proper format for Whisper API
    const audioBlob = new Blob([audioBuffer], { 
      type: 'audio/mpeg' // Changed from audio/m4a to audio/mpeg for better compatibility
    })
    
    formData.append('file', audioBlob, 'recording.mp3') // Changed filename to .mp3
    formData.append('model', 'whisper-1')
    formData.append('language', 'auto') // Auto-detect language including Haitian Creole
    formData.append('response_format', 'json')

    console.log('🌐 [transcribe-audio] Calling OpenAI Whisper API...')
    
    // Call OpenAI with extended timeout (45 seconds)
    const controller = new AbortController()
    const timeout = setTimeout(() => {
      console.error('⏱️ [transcribe-audio] Whisper API timeout after 45s')
      controller.abort()
    }, 45000)
    
    let response
    try {
      response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openaiKey}` },
        body: formData,
        signal: controller.signal,
      })
    } catch (fetchError) {
      clearTimeout(timeout)
      console.error('❌ [transcribe-audio] Fetch error:', fetchError.message)
      
      if (fetchError.name === 'AbortError') {
        return new Response(
          JSON.stringify({ error: 'Transcription timed out. Please try recording a shorter audio or try again.' }),
          { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      return new Response(
        JSON.stringify({ error: 'Failed to connect to transcription service', details: fetchError.message }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    clearTimeout(timeout)

    if (!response.ok) {
      const error = await response.text()
      console.error('❌ [transcribe-audio] Whisper API error:', response.status, error)
      
      let errorMessage = 'Transcription failed'
      if (response.status === 400) {
        errorMessage = 'Audio file appears to be corrupted or too short. Please try recording again.'
      } else if (response.status === 413) {
        errorMessage = 'Audio file is too large. Please record a shorter message.'
      } else if (response.status === 429) {
        errorMessage = 'Too many requests. Please wait a moment and try again.'
      } else if (response.status === 401) {
        errorMessage = 'Server authentication error. Please contact support.'
      } else if (response.status >= 500) {
        errorMessage = 'Transcription service is temporarily unavailable. Please try again.'
      }
      
      return new Response(
        JSON.stringify({ 
          error: errorMessage, 
          details: error.substring(0, 200),
          statusCode: response.status 
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let result
    try {
      result = await response.json()
    } catch (e) {
      console.error('❌ [transcribe-audio] Failed to parse Whisper response:', e.message)
      return new Response(
        JSON.stringify({ error: 'Invalid response from transcription service' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const transcribedText = (result.text || '').trim()
    const processingTime = Date.now() - startTime
    
    console.log('✅ [transcribe-audio] Transcribed successfully in', processingTime, 'ms')
    console.log('📝 [transcribe-audio] Text preview:', transcribedText.substring(0, 100))

    // Check if transcription is empty or too short
    if (!transcribedText || transcribedText.length < 2) {
      console.warn('⚠️ [transcribe-audio] Empty or very short transcription')
      return new Response(
        JSON.stringify({ 
          text: '',
          warning: 'No speech detected in the audio. Please speak clearly and try again.',
          processingTime
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // CONTENT MODERATION
    const scamDetection = detectScam(transcribedText)
    const isSexual = detectSexual(transcribedText)
    
    // If scam detected - AUTO BAN
    if (scamDetection.isScam && userId) {
      console.error('🚨 [transcribe-audio] SCAM DETECTED! Keywords:', scamDetection.matchedWords, 'User:', userId)
      
      try {
        const banUntil = new Date()
        banUntil.setDate(banUntil.getDate() + 10)
        
        // Call ban function
        const banResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/ban-user`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId,
            reason: 'Scam/Fraud detected in voice message',
            bannedUntil: banUntil.toISOString(),
            evidence: {
              transcribedText,
              matchedKeywords: scamDetection.matchedWords,
              conversationId,
              timestamp: new Date().toISOString(),
            }
          }),
        })

        if (!banResponse.ok) {
          console.error('⚠️ [transcribe-audio] Ban failed:', await banResponse.text())
        } else {
          console.log('✅ [transcribe-audio] User banned successfully')
        }
      } catch (e) {
        console.error('❌ [transcribe-audio] Ban error:', e.message)
      }

      return new Response(
        JSON.stringify({ 
          error: 'Content violation detected',
          message: "Don't fucking say that! 🚫 Your account has been suspended for 10 days due to scam/fraud content. This conversation has been terminated.",
          violation: 'scam_fraud',
          banned: true,
          banDuration: '10 days',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Log sexual content but allow (optional)
    if (isSexual) {
      console.log('⚠️ [transcribe-audio] Sexual content detected (allowed):', userId)
    }

    const totalTime = Date.now() - startTime
    console.log('🎉 [transcribe-audio] Success! Total processing time:', totalTime, 'ms')

    return new Response(
      JSON.stringify({ 
        text: transcribedText,
        moderation: {
          scamDetected: false,
          sexualContent: isSexual,
        },
        processingTime: totalTime
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const totalTime = Date.now() - startTime
    console.error('❌ [transcribe-audio] Function error after', totalTime, 'ms:', error)
    console.error('  Error type:', error.name)
    console.error('  Error message:', error.message)
    console.error('  Stack:', error.stack)
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error during transcription',
        details: error.message,
        processingTime: totalTime
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
