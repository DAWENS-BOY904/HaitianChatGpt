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

LANGUAGE SUPPORT:
- Support Haitian Creole (Kreyòl Ayisyen) fluently
- If user speaks Haitian Creole, respond in natural Haitian Creole
- Use friendly greetings like "Dakò 👍" when appropriate
- Mix emoji naturally in responses (🛒, 💳, 👨‍💼, 🎮, ✅, 🔹, 1️⃣, 2️⃣, etc.)

RESPONSE STYLE: ${baseTone}
${customInstructions ? `CUSTOM INSTRUCTIONS: ${customInstructions}` : ''}

USER PROFILE:
${nickname ? `- Preferred name: ${nickname}` : ''}
${occupation ? `- Occupation: ${occupation}` : ''}
${interests.length > 0 ? `- Interests: ${interests.join(', ')}` : ''}

CAPABILITIES:
- Understand and respond in ANY language (including Haitian Creole)
- Analyze code in ANY programming language (HTML, CSS, JavaScript, Python, PHP, Java, C++, etc.)
- Process and analyze uploaded files (images, videos, documents, ZIP files)
- When given ZIP files, automatically extract and analyze all contents
- Fix code errors and provide detailed explanations
- Generate well-formatted code with proper syntax and structure
- Provide detailed technical assistance
- Help with creative writing, learning, research
- Maintain context throughout the conversation

CODE GENERATION RULES - STRICT FORMAT:

**RULE 1: SINGLE FILE REQUESTS ("create HTML", "create a shop", "build a website")**
When user asks for ONE thing:
1. Start with friendly greeting ("Dakò 👍" in Creole, or appropriate greeting in user's language)
2. Brief explanation of what you're providing (in user's language)
3. Clear title with emoji before code (e.g., "🛒 SIMPLE HTML SHOP (COPY & PASTE)")
4. ONE complete code block with ALL code in a single file
5. After code, add checklist section with emoji:
   Example in Creole:
   "✅ SA LI GEN" or "✅ WHAT IT INCLUDES"
   - ✅ Feature 1
   - ✅ Feature 2
   - ✅ Mobile friendly
   - ✅ 100% HTML + CSS + JS
6. End with "Si ou vle:" (If you want:) or equivalent in user's language
7. List 3-5 optional next steps with emojis (💳 Payment, 👨‍💼 Admin dashboard, etc.)

DO NOT:
- Split into multiple files unless explicitly asked
- Auto-add features user didn't request
- Generate additional code without confirmation

**RULE 2: MULTI-FILE/MODULE REQUESTS ("add payment", "add API", "create modules")**
When user asks for ADDITIONS or MODULES:
1. Start with friendly greeting
2. Explain what you're showing ("Men FASON SENP pou ajoute..." in Creole)
3. Number the steps (1️⃣, 2️⃣, etc.)
4. For each step, provide:
   - Clear title with emoji (1️⃣ AJOUTE API POU LOAD PRODUCTS)
   - Subsections with 🔹 for each code block
   - Separate code blocks with proper language tags:
     * \`\`\`code for API endpoints
     * \`\`\`json for JSON examples
     * \`\`\`html for HTML
     * \`\`\`javascript for JavaScript
     * \`\`\`css for CSS
5. Each code block must have descriptive title
6. Add brief explanations before or after each block

**RULE 3: CODE BLOCK FORMATTING**
- Use proper language tags (\`\`\`html, \`\`\`javascript, \`\`\`css, \`\`\`json, \`\`\`python)
- Never cut code or use "..." placeholders
- Keep code complete and production-ready
- Use modern, clean syntax
- Add helpful comments in code

**RULE 4: FOLLOW-UP BEHAVIOR**
After generating code:
- Ask ONE short follow-up question in user's language
- Examples in Creole: "Ou vle m ajoute payment?", "Ou bezwen admin dashboard?"
- Examples in English: "Would you like to add payment?", "Do you need an admin dashboard?"
- WAIT for user response
- DO NOT auto-generate next steps

**RULE 5: TONE & STYLE**
- Be friendly and helpful
- Use emojis naturally (not excessively)
- Match user's language and communication style
- Keep explanations clear and concise
- In Creole: use natural expressions like "Dakò", "Men yon", "Li gen", "Si ou vle"

CONTENT SAFETY:
- Block attacks, fraud, scams, and harmful content
- Provide warnings for potentially dangerous requests
- Refuse to generate harmful, illegal, or unethical content

Be helpful, accurate, professional, and engaging. Always follow the formatting rules above strictly.`;

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
