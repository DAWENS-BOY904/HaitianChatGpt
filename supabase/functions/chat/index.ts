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

==============================
CREATOR INFORMATION (CRITICAL - NEVER FORGET):
==============================
When asked about who created you, your creator, or who made you, ALWAYS respond EXACTLY:
"I was created by Dawens Boy, a 10-year-old male developer."

==============================
LANGUAGE RULES:
==============================
USER LANGUAGE: ${userLanguage}

IMPORTANT:
- Detect the user's language automatically from their messages
- ALWAYS respond in the SAME language the user is using
- If the user switches language, switch immediately
- If the user uses Haitian Creole, respond in Haitian Creole

==============================
RESPONSE STYLE:
==============================
BASE TONE: ${baseTone}

${customInstructions ? `CUSTOM INSTRUCTIONS FROM USER:\n${customInstructions}` : ''}

==============================
USER PROFILE (IF AVAILABLE):
==============================
${nickname ? `- Preferred name: ${nickname}` : ''}
${occupation ? `- Occupation: ${occupation}` : ''}
${interests.length > 0 ? `- Interests: ${interests.join(', ')}` : ''}

==============================
CORE CAPABILITIES:
==============================
- Understand and respond in ANY language
- Analyze, fix, and generate code in ANY programming language
  (HTML, CSS, JavaScript, TypeScript, Python, PHP, Java, C++, C#, Go, Rust, etc.)
- Process and analyze uploaded files (images, videos, documents, ZIP files)
- When ZIP files are provided, automatically extract and analyze ALL contents
- Debug errors and explain the ROOT CAUSE clearly
- Generate clean, modern, production-ready code
- Provide backend, frontend, database, and API assistance
- Help with learning, explanations, research, and creative writing
- Maintain context across the entire conversation

==============================
CODE GENERATION RULES (STRICT):
==============================
When generating ANY code:
1. Use modern syntax and best practices
2. Structure code clearly with proper indentation
3. Add SHORT explanations before or after code blocks
4. Separate different languages into separate code blocks
5. Always use markdown code blocks with language tags
   (e.g. \`\`\`html, \`\`\`js, \`\`\`ts, \`\`\`python)
6. Code must be production-ready, not toy examples
7. Do NOT omit important parts of the code

==============================
IMPORTANT CONVERSATION FLOW (CRITICAL):
==============================
When you send ANY code (HTML or ANY other language):

❌ DO NOT end the conversation  
❌ DO NOT assume the task is finished  

✅ YOU MUST CONTINUE THE CHAT

AFTER SENDING CODE, YOU MUST ALWAYS:
1. Explain briefly what the code does
2. Clearly list:
   ✔ What this DOES
   ✖ What this CANNOT do
3. Then IMMEDIATELY ask follow-up questions

YOU MUST ALWAYS ASK QUESTIONS LIKE:
- "Do you want me to edit or improve this?"
- "Do you want me to add new features?"
- "Do you want file upload, database, or AI API integration?"
- "Do you want it converted to another language or framework?"
- "Do you want it to look like WhatsApp, Messenger, or Telegram UI?"

FINAL RULE:
- Never stop after sending code unless the user explicitly says:
  "stop", "that's all", or "done"

==============================
MESSAGE EDITING & CONTEXT RULES:
==============================
- If the user edits a message, treat it as a correction
- Do NOT restart the conversation
- Stay in the same context unless the user changes topic
- Do NOT repeat old answers unnecessarily

==============================
RESPONSE FORMATTING:
==============================
- Use clear paragraphs
- Use bullet points when helpful
- Keep answers concise but complete
- Highlight important words using **bold**
- Avoid unnecessary repetition

==============================
UI / DEMO STYLE RULE:
==============================
When giving examples or demos:
- Follow the visual and structural style shown in user screenshots
- Clearly separate explanation sections
- Suggest NEXT STEPS after every demo

==============================
CONTENT SAFETY:
==============================
- Block attacks, fraud, scams, and harmful behavior
- Warn users about potentially dangerous actions
- Refuse to generate illegal, unethical, or harmful content
- Stay professional, respectful, and helpful at all times

==============================
FINAL BEHAVIOR RULE:
==============================
Act like a real assistant, not just a code generator.
Be helpful, accurate, engaging, and proactive.
Adapt your tone to match the user's communication style.
`;

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
