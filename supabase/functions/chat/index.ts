import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { callAI } from '../_shared/ai-providers.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, conversationId, aiModel = 'google-gemini', fileContents, generateImage } = await req.json();

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
      .select('app_language, base_tone, custom_instructions, nickname, occupation, interests, preferred_ai_model')
      .eq('user_id', user.id)
      .single();

    const userLanguage = settingsData?.app_language || 'English';
    const baseTone = settingsData?.base_tone || 'balanced';
    const customInstructions = settingsData?.custom_instructions || '';
    const nickname = settingsData?.nickname || '';
    const occupation = settingsData?.occupation || '';
    const interests = settingsData?.interests || [];
    const selectedModel = aiModel || settingsData?.preferred_ai_model || 'google-gemini';

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
- Analyze code in ANY programming language (HTML, CSS, JavaScript, Python, PHP, Java, C++, etc.)
- Process and analyze uploaded files (images, videos, documents, ZIP files)
- When given ZIP files, automatically extract and analyze all contents
- Fix code errors and provide detailed explanations
- Generate well-formatted code with proper syntax and structure
- Provide detailed technical assistance
- Help with creative writing, learning, research
- Maintain context throughout the conversation

CODE GENERATION RULES:
When generating code:
1. Use the newest, most modern syntax and best practices
2. Structure code clearly with proper indentation
3. Add brief explanations before or after code blocks
4. Separate different languages (HTML/CSS/JS) into distinct code blocks
5. Use markdown code blocks with language tags (e.g., \`\`\`html, \`\`\`javascript, \`\`\`python)
6. Make code production-ready, not just examples

CONTENT SAFETY:
- Block attacks, fraud, scams, and harmful content
- Provide warnings for potentially dangerous requests
- Refuse to generate harmful, illegal, or unethical content

Be helpful, accurate, professional, and engaging. Adapt your tone to match the user's communication style.`;

    // Add file contents to system prompt if provided
    let finalSystemPrompt = systemPrompt;
    if (fileContents && fileContents.length > 0) {
      finalSystemPrompt += `\n\nUPLOADED FILES:\n${fileContents.map((f: any) => `\nFile: ${f.name}\nType: ${f.type}\nContent:\n${f.content}`).join('\n\n')}`;
    }

    // Prepare messages for AI
    const aiMessages = [
      { role: 'system' as const, content: finalSystemPrompt },
      ...messages,
    ];

    console.log(`Calling AI model: ${selectedModel}`);

    // Call the appropriate AI provider
    const aiResponse = await callAI(selectedModel, aiMessages);

    if (aiResponse.error) {
      return new Response(
        JSON.stringify({ error: aiResponse.error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
      content: aiResponse.content,
    });

    // Update conversation timestamp
    await supabaseAdmin
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    return new Response(
      JSON.stringify({ message: aiResponse.content, model: selectedModel }),
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
