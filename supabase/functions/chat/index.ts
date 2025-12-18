import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, conversationId, aiModel = 'gemini', fileContents, generateImage } = await req.json();

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
    const selectedModel = aiModel || settingsData?.preferred_ai_model || 'gemini';

    // Check if user wants to generate an image
    const lastMessage = messages[messages.length - 1]?.content || '';
    const imageKeywords = ['create image', 'generate image', 'make image', 'create logo', 'generate logo', 'make logo', 'design logo'];
    const shouldGenerateImage = generateImage || imageKeywords.some(keyword => lastMessage.toLowerCase().includes(keyword));

    if (shouldGenerateImage) {
      // Use image generation model
      try {
        const imageResponse = await fetch(`${Deno.env.get('ONSPACE_AI_BASE_URL')}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('ONSPACE_AI_API_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash-image-preview',
            messages: [
              {
                role: 'system',
                content: 'You are an expert image generation AI. Create high-quality, professional images based on user descriptions. Be creative and detailed.'
              },
              ...messages,
            ],
            modalities: ['image', 'text'],
            image_config: {
              aspect_ratio: '1:1'
            }
          }),
        });

        if (!imageResponse.ok) {
          throw new Error('Image generation failed');
        }

        const imageData = await imageResponse.json();
        const imageUrl = imageData.choices[0]?.message?.images?.[0]?.image_url?.url;
        const imageDescription = imageData.choices[0]?.message?.content || 'Image generated successfully';

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

        // Save AI response with generated image
        await supabaseAdmin.from('messages').insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: imageDescription,
          image_url: imageUrl,
        });

        // Update conversation timestamp
        await supabaseAdmin
          .from('conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', conversationId);

        return new Response(
          JSON.stringify({ 
            message: imageDescription, 
            image_url: imageUrl,
            model: 'image-generator' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (imageError) {
        console.error('Image generation error:', imageError);
        // Fall back to regular text response
      }
    }

    // Build system prompt with creator info and personalization
    let systemPrompt = `You are HaitianChatGpt, an advanced AI assistant.

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
7. **CRITICAL: After generating any code (HTML, CSS, JavaScript, Python, etc.), ALWAYS ask a follow-up question**
   - Ask questions like:
     * "Would you like me to continue?"
     * "Should I add more features?"
     * "Do you want to connect an API?"
     * "Would you like me to customize the design or logic?"
     * "Should I add JavaScript functionality?"
     * "Do you want API integration or UI improvements?"
   - WAIT for the user's response before continuing
   - DO NOT auto-generate additional code without user confirmation
   - DO NOT assume what the user wants next
   - Let the user guide the next steps

CONTENT SAFETY:
- Block attacks, fraud, scams, and harmful content
- Provide warnings for potentially dangerous requests
- Refuse to generate harmful, illegal, or unethical content

Be helpful, accurate, professional, and engaging. Adapt your tone to match the user's communication style.`;

    // Add file contents to system prompt if provided
    if (fileContents && fileContents.length > 0) {
      systemPrompt += `\n\nUPLOADED FILES:\n${fileContents.map((f: any) => `\nFile: ${f.name}\nType: ${f.type}\nContent:\n${f.content}`).join('\n\n')}`;
    }

    // Map AI model to OnSpace AI model (use newest models)
    const modelMap: Record<string, string> = {
      'openai': 'openai/gpt-5.1',  // Use newest GPT-5.1
      'gemini': 'google/gemini-3-flash-preview',  // Use newest Gemini 3 Flash
      'claude': 'google/gemini-3-flash-preview', // Use Gemini 3 as fallback
      'llama': 'google/gemini-3-flash-preview', // Use Gemini 3 as fallback
    };

    const aiModelName = modelMap[selectedModel] || 'google/gemini-3-flash-preview';

    console.log(`Using AI model: ${aiModelName} for user request`);

    const response = await fetch(`${Deno.env.get('ONSPACE_AI_BASE_URL')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('ONSPACE_AI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: aiModelName,
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
      JSON.stringify({ message: aiMessage, model: selectedModel }),
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
