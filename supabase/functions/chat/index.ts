import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { callAI, detectContentType, generateImageSmart, isTextOnlyModel } from '../_shared/ai-providers.ts';

// ==========================================
// MAIN CHAT FUNCTION
// ==========================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse body
    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { messages, conversationId, aiModel = 'google-gemini', fileContents, userImageUrl, base64Image } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Messages array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!conversationId) {
      return new Response(
        JSON.stringify({ error: 'conversationId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Load user settings for personalization
    const { data: settingsData } = await supabaseClient
      .from('user_settings')
      .select('app_language, base_tone, custom_instructions, nickname, occupation, interests, preferred_ai_model')
      .eq('user_id', user.id)
      .single();

    const userLanguage = settingsData?.app_language || 'English';
    const baseTone = settingsData?.base_tone || 'balanced';
    const customInstructions = settingsData?.custom_instructions || '';
    const nickname = settingsData?.nickname || '';
    const occupation = settingsData?.occupation || '';
    const interests: string[] = settingsData?.interests || [];

    // Build system prompt
    const systemPrompt = `You are Dawinix, an advanced AI assistant created by the Haitian Community. You are helpful, knowledgeable, and friendly.

IDENTITY:
- You were created by the Haitian Community
- Never mention OpenAI, Google, Anthropic, or any other AI company
- If asked who created you, say "I was created by the Haitian Community"
- Your name is Dawinix

LANGUAGE:
- Always respond in the same language the user is writing in
- Support English, Haitian Creole, French, Spanish and all other languages
- Current user language preference: ${userLanguage}

TONE & STYLE:
- Base tone: ${baseTone}
- Be warm, helpful, and professional
- Use appropriate emojis naturally (not excessively)
- Give detailed, high-quality responses
${customInstructions ? `\nCUSTOM INSTRUCTIONS:\n${customInstructions}` : ''}

USER PROFILE:
${nickname ? `- Preferred name: ${nickname}` : ''}
${occupation ? `- Occupation: ${occupation}` : ''}
${interests.length > 0 ? `- Interests: ${interests.join(', ')}` : ''}

MESSAGE FORMATTING RULES:
When the user asks you to "write a message", "compose a letter", "write a love message", "write an apology", etc.:
- Return the message in a specially formatted block starting with [MESSAGE_CARD] and ending with [/MESSAGE_CARD]
- The message inside must be long, expressive, emotional, and beautifully written
- Use proper paragraphs, line breaks, and structure
- Example format:
[MESSAGE_CARD]
Subject: A Message From My Heart

Dear [Name],

[Long beautiful message content here...]

With all my love,
[Sender]
[/MESSAGE_CARD]

CAPABILITIES:
- Answer questions on any topic
- Write code in any programming language
- Analyze images and documents
- Create stories, poems, messages
- Help with math, science, history
- Provide emotional support and advice
- Web search results analysis
- Image generation (when requested)

QUALITY:
- Always give complete, thorough answers
- Never cut responses short
- Provide examples when helpful
- Explain complex topics clearly
- Remember context within the conversation

IMPORTANT:
- Never expose internal model names or technical details
- Never say you are limited or cannot help
- Always try your best to assist the user`;

    // Prepare messages for AI
    const lastMessage = messages[messages.length - 1];
    const lastContent = typeof lastMessage.content === 'string' 
      ? lastMessage.content 
      : Array.isArray(lastMessage.content)
        ? lastMessage.content.map((c: any) => c.text || '').join(' ')
        : '';

    // Detect content type
    const detectionResult = detectContentType(lastContent);

    let aiResponse: any;
    let imageUrl: string | undefined;

    // Build AI messages array
    let aiMessages: any[] = [
      { role: 'system', content: systemPrompt },
    ];

    // Add conversation history
    for (const msg of messages) {
      const msgContent = typeof msg.content === 'string' ? msg.content : lastContent;
      
      if (msg.image_url || (msg.role === 'user' && userImageUrl && msg === lastMessage)) {
        const imageSource = msg.image_url || userImageUrl;
        aiMessages.push({
          role: msg.role,
          content: [
            { type: 'text', text: msgContent || 'Please analyze this image' },
            { type: 'image_url', image_url: { url: imageSource } }
          ]
        });
      } else {
        aiMessages.push({ role: msg.role, content: msgContent });
      }
    }

    // Add file contents to context
    if (fileContents && fileContents.length > 0) {
      const fileContext = fileContents.map((f: any) => 
        `File: ${f.name}\nType: ${f.type}\nContent:\n${f.content}`
      ).join('\n\n---\n\n');
      
      aiMessages.push({
        role: 'user',
        content: `Here are the uploaded files for analysis:\n\n${fileContext}`
      });
    }

    // Handle image generation vs text response
    if (detectionResult.isImageTask) {
      const imageResult = await generateImageSmart(lastContent, aiModel);
      
      if (imageResult.error) {
        // Fallback to text description
        aiResponse = await callAI(aiModel, aiMessages, false);
        if (!aiResponse.error) {
          imageUrl = undefined;
        }
      } else {
        imageUrl = imageResult.imageUrl;
        aiResponse = {
          content: 'Here is your generated image! 🎨\n\nLet me know if you would like any changes to the style, colors, or composition.',
          model: imageResult.model,
          tokens: 0,
        };
      }
    } else {
      // Regular text response
      aiResponse = await callAI(aiModel, aiMessages, false);
    }

    if (!aiResponse || aiResponse.error) {
      console.error('AI Error:', aiResponse?.error);
      return new Response(
        JSON.stringify({ error: aiResponse?.error || 'AI service temporarily unavailable. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean the response
    let cleanMessage = aiResponse.content || '';
    cleanMessage = cleanMessage.replace(/\[Using [^\]]+\]\s*/gi, '');
    cleanMessage = cleanMessage.replace(/\[Model:[^\]]+\]\s*/gi, '');
    cleanMessage = cleanMessage.replace(/\[Fallback:[^\]]+\]\s*/gi, '');
    cleanMessage = cleanMessage.replace(/\(fallback\)/gi, '');
    cleanMessage = cleanMessage.replace(/groq-llama\s*/gi, '');
    cleanMessage = cleanMessage.replace(/google-gemini unavailable/gi, '');
    cleanMessage = cleanMessage.replace(/openai unavailable/gi, '');
    cleanMessage = cleanMessage.replace(/claude unavailable/gi, '');
    cleanMessage = cleanMessage.trim();

    // Detect if response contains a message card
    const hasMessageCard = cleanMessage.includes('[MESSAGE_CARD]') && cleanMessage.includes('[/MESSAGE_CARD]');

    // Update conversation updated_at
    await supabaseAdmin
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    return new Response(
      JSON.stringify({
        message: cleanMessage,
        imageUrl: imageUrl || null,
        thinkingMode: detectionResult.thinkingMode || 'thinking',
        hasMessageCard,
        fileUrl: null,
        fileName: null,
        fileType: null,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error: any) {
    console.error('Unhandled error in chat function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
