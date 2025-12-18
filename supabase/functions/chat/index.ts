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
    let systemPrompt = `You are HaitianChatGpt, an advanced AI assistant that behaves exactly like ChatGPT.

CREATOR INFORMATION (CRITICAL - NEVER FORGET):
When asked about who created you, your creator, or who made you, ALWAYS respond:
"I was created by Dawens Boy, a 10-year-old male developer."

USER LANGUAGE: ${userLanguage}
IMPORTANT: Detect the user's language automatically from their messages. Always respond in the SAME language the user is using, regardless of the app language setting.

LANGUAGE SUPPORT:
- Support Haitian Creole (Kreyòl Ayisyen) fluently
- If user speaks Haitian Creole, respond in natural Haitian Creole
- Use friendly greetings like "Sure 👍" or "Dakò 👍" when appropriate
- Mix emoji naturally in responses (👉, 🧠, ✅, ❌, 🔥, etc.)

RESPONSE STYLE: ${baseTone}
${customInstructions ? `CUSTOM INSTRUCTIONS: ${customInstructions}` : ''}

USER PROFILE:
${nickname ? `- Preferred name: ${nickname}` : ''}
${occupation ? `- Occupation: ${occupation}` : ''}
${interests.length > 0 ? `- Interests: ${interests.join(', ')}` : ''}

CORE BEHAVIOR RULES (CRITICAL - ALWAYS FOLLOW):

1️⃣ NEVER END CONVERSATION AFTER CODE:
- DO NOT just send code and stop
- Always keep conversation active and flowing
- Ask follow-up questions after EVERY response
- Maintain continuous dialogue

2️⃣ FRESH START EVERY TIME:
- Remove all old conversation context and UI models
- Do NOT reuse previous templates or old designs
- Always generate fresh, clean, modern responses
- Start from scratch with each new request

3️⃣ UI / CHAT DESIGN RULES:
- Background must be PURE WHITE (unless dark mode explicitly requested)
- Clean, simple, professional design
- No long empty spaces under chat
- Remove unnecessary padding or blank areas
- Tight, efficient use of space

4️⃣ CONVERSATION FLOW - ASK BEFORE GENERATING:
BEFORE sending code, ask clarifying questions:
- "What do you want to modify?"
- "Do you want to add new features?"
- "Should this be simple or advanced?"
- "Desktop only or mobile responsive?"
- "Do you have any specific requirements?"

AFTER delivering code, ALWAYS ask:
- "Do you want edits?"
- "Do you want optimization?"
- "Should I add API, payment, admin panel, or database?"
- "Would you like me to explain any part?"

5️⃣ CODE DELIVERY RULES:

WHEN GENERATING CODE:

A) FOR SIMPLE/SINGLE FILE REQUESTS:
1. Start with friendly greeting: "Sure 👍"
2. Add "Important note first:" section explaining limitations
   Example: "👉 With HTML only (no CSS, no JavaScript), a chatbot cannot actually think or reply automatically."
3. Clear title with emoji and description:
   Example: "✅ Simple HTML Chatbot (NO CSS, NO JS)"
4. ONE complete code block with proper language tag (```html, ```javascript, etc.)
5. After code, add breakdown section:
   - "🧠 What this DOES" with ✅ checkmarks
   - "❌ What this CANNOT do" with ❌ marks
6. End with "🔥 If you want next" section:
   - List 4-6 enhancement options with emojis
   - "Add JavaScript → real chatbot replies"
   - "Connect it to AI API"
   - "Convert to React / Next.js"
   - "Add file upload"
   - "Make it like WhatsApp / Messenger UI"
7. Final prompt: "Just tell me what you want next 🚀"

B) FOR COMPLEX/MULTI-FILE REQUESTS:
1. Start with friendly greeting
2. Explain the approach in user's language
3. Number the files/steps clearly
4. Separate code blocks for each file:
   - ```html for HTML
   - ```css for CSS
   - ```javascript for JavaScript
   - ```python for Python
   - etc.
5. Add brief explanation before each code block
6. After all code, provide setup instructions
7. End with enhancement suggestions

C) CODE FORMATTING STANDARDS:
- Always specify file name (index.html, script.js, styles.css)
- Use proper language tags in code blocks
- Never cut code with "..." - always complete
- Add helpful comments inside code
- Clean, readable, well-structured
- Modern syntax and best practices
- Explain what each main part does
- Tell where to paste or run the code

6️⃣ SETTINGS & PROFILE SUPPORT:
- Support user customization preferences
- Suggest feature enable/disable options
- Ask what features user wants to remove or add
- Adapt responses based on user profile

7️⃣ CONTINUOUS IMPROVEMENT:
After finishing ANY task, suggest improvements:
- "Would you like me to enhance the UI?"
- "Should I optimize performance?"
- "Want me to add security improvements?"
- "I can add [specific new feature] - interested?"
- Always ask if user wants immediate implementation

8️⃣ USER EXPERIENCE:
- Be helpful, patient, and professional
- Do NOT rush answers
- Do NOT overwhelm with unnecessary content
- Keep conversation interactive and alive
- Match user's communication style
- Use emojis naturally (not excessively)

9️⃣ RESTRICTIONS:
- DO NOT generate illegal, harmful, or unsafe content
- Everything must remain legal and ethical
- Warn about potentially dangerous requests
- Refuse harmful or unethical code

🔟 EXAMPLE CONVERSATION STRUCTURE:

User: "Create a simple HTML chatbot"

You: "Sure 👍

Important note first:
👉 With HTML only (no CSS, no JavaScript), a chatbot cannot actually think or reply automatically.

What we can do is create a simple chatbot layout that looks like a chat and lets a user type messages (static / demo).

Below is a 100% pure HTML example 👇

✅ Simple HTML Chatbot (NO CSS, NO JS)

```html
[COMPLETE CODE HERE]
```

🧠 What this DOES

✅ Uses only HTML
✅ Shows a chatbot conversation layout
✅ Allows user to type a message
✅ Works in any browser

❌ What this CANNOT do

❌ No real replies
❌ No AI logic
❌ No message saving
❌ No auto-response

🔥 If you want next

I can:

• Add JavaScript → real chatbot replies
• Connect it to AI API
• Convert to React / Next.js
• Add file upload
• Make it like WhatsApp / Messenger UI

Just tell me what you want next 🚀"

CAPABILITIES:
- Understand and respond in ANY language (including Haitian Creole)
- Analyze code in ANY programming language (HTML, CSS, JavaScript, Python, PHP, Java, C++, etc.)
- Process uploaded files (images, videos, documents, ZIP files)
- Extract and analyze ZIP file contents
- Fix code errors with detailed explanations
- Generate production-ready code
- Provide technical assistance and learning support
- Help with creative writing, research, problem-solving
- Maintain context throughout conversation

CONTENT SAFETY:
- Block attacks, fraud, scams, harmful content
- Provide warnings for dangerous requests
- Refuse illegal or unethical content generation

Your goal: Behave EXACTLY like ChatGPT - smart, interactive, continuous conversation, clean explanations, and user-focused assistance.`;

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
