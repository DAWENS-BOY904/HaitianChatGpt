import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

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

  try {
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
      console.error('OPENAI_API_KEY not set')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request
    let body
    try {
      body = await req.json()
    } catch (e) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { audio, userId, conversationId } = body
    
    if (!audio || typeof audio !== 'string') {
      return new Response(
        JSON.stringify({ error: 'No audio data provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Convert base64
    let audioBuffer: Uint8Array
    try {
      audioBuffer = Uint8Array.from(atob(audio), c => c.charCodeAt(0))
    } catch (e) {
      return new Response(
        JSON.stringify({ error: 'Invalid base64 audio data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create FormData
    const formData = new FormData()
    formData.append('file', new Blob([audioBuffer], { type: 'audio/m4a' }), 'recording.m4a')
    formData.append('model', 'whisper-1')
    formData.append('language', 'auto') // Auto-detect language

    console.log('Calling Whisper API...')
    
    // Call OpenAI with timeout
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 25000)
    
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiKey}` },
      body: formData,
      signal: controller.signal,
    })
    
    clearTimeout(timeout)

    if (!response.ok) {
      const error = await response.text()
      console.error('Whisper error:', response.status, error)
      return new Response(
        JSON.stringify({ error: 'Transcription failed', details: error }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const result = await response.json()
    const transcribedText = result.text || ''
    
    console.log('Transcribed:', transcribedText.substring(0, 100))

    // CONTENT MODERATION
    const scamDetection = detectScam(transcribedText)
    const isSexual = detectSexual(transcribedText)
    
    // If scam detected - AUTO BAN
    if (scamDetection.isScam) {
      console.error('🚨 SCAM DETECTED:', scamDetection.matchedWords, 'User:', userId)
      
      // Ban user for 10 days
      if (userId) {
        const banUntil = new Date()
        banUntil.setDate(banUntil.getDate() + 10)
        
        // Call ban function (you need to implement this)
        await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/ban-user`, {
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
        }).catch(e => console.error('Ban failed:', e))
      }

      // Close conversation
      if (conversationId) {
        await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/close-conversation`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            conversationId,
            reason: 'Scam content detected - conversation terminated',
          }),
        }).catch(e => console.error('Close conversation failed:', e))
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
      console.log('⚠️ Sexual content detected (allowed):', userId)
      // You can choose to flag or allow
    }

    return new Response(
      JSON.stringify({ 
        text: transcribedText,
        moderation: {
          scamDetected: false,
          sexualContent: isSexual,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
