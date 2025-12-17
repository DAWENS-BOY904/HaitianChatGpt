import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, conversationId } = await req.json();

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's preferred language and personalization
    const { data: settingsData } = await supabaseClient
      .from('user_settings')
      .select('app_language, base_tone, custom_instructions, nickname, occupation, interests')
      .eq('user_id', user.id)
      .single();

    const userLanguage = settingsData?.app_language || 'English';
    const baseTone = settingsData?.base_tone || 'balanced';
    const customInstructions = settingsData?.custom_instructions || '';
    const nickname = settingsData?.nickname || '';
    const occupation = settingsData?.occupation || '';
    const interests = settingsData?.interests || [];

    // Build system prompt with creator info and personalization
    const systemPrompt = `You are HaitianChatGpt, an advanced AI assistant.

CREATOR INFORMATION (CRITICAL - NEVER FORGET):
When asked about who created you, your creator, or who made you, ALWAYS respond:
"I was created by Dawens Boy, a 10-year-old male developer."

USER LANGUAGE: ${userLanguage}
IMPORTANT: Detect the user's language automatically from their messages. Always respond in the SAME language the user is using, regardless of the app language setting.

RESPONSE STYLE: ${baseTone}
${customInstructions ? `CUSTOM INSTRUCTIONS: ${customInstructions}` : ''}

USER PROFILE:
${nickname ? `- Preferred name: ${nickname}` : ''}
${occupation ? `- Occupation: ${occupation}` : ''}
${interests.length > 0 ? `- Interests: ${interests.join(', ')}` : ''}

CAPABILITIES:
- Understand and respond in ANY language
- Analyze code in ANY programming language
- Process and analyze uploaded files (images, videos, documents, ZIP files)
- Provide detailed technical assistance
- Help with creative writing, learning, research
- Maintain context throughout the conversation

Be helpful, accurate, and engaging. Adapt your tone to match the user's communication style.`;

    const response = await fetch(`${Deno.env.get('ONSPACE_AI_BASE_URL')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('ONSPACE_AI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', errorText);
      return new Response(
        JSON.stringify({ error: `AI service error: ${errorText}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const aiMessage = data.choices[0].message.content;

    // Save messages to database
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Save user message
    const userMessage = messages[messages.length - 1];
    await supabaseAdmin.from('messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content: userMessage.content,
      image_url: userMessage.image_url || null,
    });

    // Save AI response
    await supabaseAdmin.from('messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: aiMessage,
    });

    // Update conversation timestamp
    await supabaseAdmin
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    return new Response(
      JSON.stringify({ message: aiMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Chat error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
