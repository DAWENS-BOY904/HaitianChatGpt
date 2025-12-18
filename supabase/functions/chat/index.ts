import { corsHeaders } from '../_shared/cors.ts';

interface Message {
  role: string;
  content: string | any[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, conversationId, aiModel = 'gemini', fileContents, generateImage } = await req.json();

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    // Create Supabase URL
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    
    // Get user from token
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'apikey': supabaseKey
      }
    });
    
    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      console.error('Auth error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userData = await userResponse.json();
    const userId = userData.id;

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Invalid user' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user settings
    const settingsResponse = await fetch(
      `${supabaseUrl}/rest/v1/user_settings?user_id=eq.${userId}`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${token}`,
        }
      }
    );

    let userLanguage = 'English';
    let baseTone = 'balanced';
    let customInstructions = '';
    let nickname = '';
    let occupation = '';
    let interests: string[] = [];

    if (settingsResponse.ok) {
      const settingsData = await settingsResponse.json();
      if (settingsData.length > 0) {
        const settings = settingsData[0];
        userLanguage = settings.app_language || 'English';
        baseTone = settings.base_tone || 'balanced';
        customInstructions = settings.custom_instructions || '';
        nickname = settings.nickname || '';
        occupation = settings.occupation || '';
        interests = settings.interests || [];
      }
    }

    // System prompt
    const systemPrompt = `You are HaitianChatGpt, an advanced AI assistant that behaves exactly like ChatGPT.

CREATOR INFORMATION (CRITICAL - NEVER FORGET):
When asked about who created you, your creator, or who made you, ALWAYS respond:
"I was created by Dawens Boy, a 10-year-old male developer."

USER LANGUAGE: ${userLanguage}
IMPORTANT: Detect the user's language automatically. Always respond in the SAME language the user is using.

RESPONSE STYLE: ${baseTone}
${customInstructions ? `CUSTOM INSTRUCTIONS: ${customInstructions}` : ''}

USER PROFILE:
${nickname ? `- Preferred name: ${nickname}` : ''}
${occupation ? `- Occupation: ${occupation}` : ''}
${interests.length > 0 ? `- Interests: ${interests.join(', ')}` : ''}

CORE BEHAVIOR - CONTINUOUS CONVERSATION:
- NEVER end conversation after sending code or answers
- ALWAYS ask follow-up questions
- After EVERY response, ask: "What would you like to modify in this bot?" or similar
- Keep conversation active and flowing
- Be helpful, patient, professional

CODE DELIVERY FORMAT:
For simple requests:
1. Friendly greeting
2. Explanation
3. Code in proper markdown blocks
4. "What this DOES" checklist
5. "What this CANNOT do" list
6. Enhancement suggestions
7. Ask what user wants next

For complex requests:
1. Multiple labeled code blocks
2. Clear file names
3. Setup instructions
4. Ask about next features

ALWAYS:
- Use proper code formatting
- Explain clearly
- Ask permission before continuing
- Suggest improvements
- Maintain white background in examples
- Be conversational and engaging

${fileContents && fileContents.length > 0 ? `\n\nUPLOADED FILES:\n${fileContents.map((f: any) => `\nFile: ${f.name}\nType: ${f.type}\nContent:\n${f.content}`).join('\n\n')}` : ''}`;

    let aiResponse: string;
    let selectedModelName = aiModel;

    console.log('Processing message with AI model:', aiModel);

    // Route to correct AI provider
    switch (aiModel) {
      case 'openai': {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              { role: 'system', content: systemPrompt },
              ...messages,
            ],
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`OpenAI Error: ${error}`);
        }

        const data = await response.json();
        aiResponse = data.choices[0].message.content;
        selectedModelName = 'OpenAI GPT-4o';
        break;
      }

      case 'claude': {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 4096,
            system: systemPrompt,
            messages: messages.filter((m: Message) => m.role !== 'system'),
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Claude Error: ${error}`);
        }

        const data = await response.json();
        aiResponse = data.content[0].text;
        selectedModelName = 'Claude 3.5 Sonnet';
        break;
      }

      case 'groq': {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('GROQ_API_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: systemPrompt },
              ...messages,
            ],
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Groq Error: ${error}`);
        }

        const data = await response.json();
        aiResponse = data.choices[0].message.content;
        selectedModelName = 'Groq Llama 3.3 70B';
        break;
      }

      case 'gemini':
      default: {
        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': Deno.env.get('GOOGLE_AI_API_KEY') ?? '',
          },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: systemPrompt }]
              },
              ...messages.map((m: Message) => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: typeof m.content === 'string' 
                  ? [{ text: m.content }]
                  : m.content.map((c: any) => c.type === 'text' ? { text: c.text } : { inline_data: c.image_url })
              }))
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 8192,
            }
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Gemini Error: ${error}`);
        }

        const data = await response.json();
        aiResponse = data.candidates[0].content.parts[0].text;
        selectedModelName = 'Google Gemini 2.0 Flash';
        break;
      }
    }

    console.log('AI response received, saving to database...');

    // Save messages to database using service role
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    // Save user message
    const userMessage = messages[messages.length - 1];
    const userMessageResponse = await fetch(`${supabaseUrl}/rest/v1/messages`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        conversation_id: conversationId,
        role: 'user',
        content: typeof userMessage.content === 'string' ? userMessage.content : userMessage.content[0]?.text || '',
        image_url: typeof userMessage.content !== 'string' ? userMessage.content[1]?.image_url?.url : null,
      })
    });

    if (!userMessageResponse.ok) {
      const errorText = await userMessageResponse.text();
      console.error('Failed to save user message:', errorText);
    }

    // Save AI response
    const aiMessageResponse = await fetch(`${supabaseUrl}/rest/v1/messages`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        conversation_id: conversationId,
        role: 'assistant',
        content: aiResponse,
      })
    });

    if (!aiMessageResponse.ok) {
      const errorText = await aiMessageResponse.text();
      console.error('Failed to save AI message:', errorText);
    }

    // Update conversation timestamp
    await fetch(`${supabaseUrl}/rest/v1/conversations?id=eq.${conversationId}`, {
      method: 'PATCH',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        updated_at: new Date().toISOString()
      })
    });

    console.log('Messages saved successfully');

    return new Response(
      JSON.stringify({ 
        message: aiResponse, 
        model: selectedModelName 
      }),
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
