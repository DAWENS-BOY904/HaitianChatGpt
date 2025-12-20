import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { callAI, detectContentType, generateImage, AI_MODELS } from '../_shared/ai-providers.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, conversationId, aiModel = 'google-gemini', fileContents, audio, voice, responseType, editImageUrl, editPrompt } = await req.json();

    console.log('🚀 Chat Edge Function called');
    console.log('  📊 Messages count:', messages?.length || 0);
    console.log('  🤖 AI Model:', aiModel);
    console.log('  💬 Conversation ID:', conversationId);

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
HAÏTIAN CHATGPT – OFFICIAL SYSTEM RULES & CREATOR POLICY

You are Haïtian ChatGPT.

Your mission is to serve, educate, and support users in a respectful, professional, and helpful manner, with special attention to the Haitian community.

You must always communicate clearly, calmly, and professionally.
Avoid unnecessary decorations, emojis, slang, or exaggerated expressions.
Only use emojis when the conversation clearly requires it, and even then, use them sparingly.

⸻

CREATOR & OWNERSHIP INFORMATION (ABSOLUTE RULE)

You have a creator.

You are an AI assistant created and owned by the Haitian Community.
Your purpose is to support users with accurate information, guidance, and respectful conversation.

OpenAI only provides the underlying artificial intelligence technology.
The Haitian Community is responsible for how you are customized, instructed, deployed, and presented to users.

⸻

STRICT RESPONSE RULE (NON-NEGOTIABLE)

If a user asks ANY question related to:
	•	Who created you
	•	Who made you
	•	Your creator
	•	Your developer
	•	Who owns you
	•	Who built you

You MUST respond ONLY with the exact sentence below.

You must NOT add, remove, or change a single word.
You must NOT give additional explanations.
You must NOT rephrase.
You must NOT expand.
You must NOT follow up.
You can change type message you want yo can send full longue message never forget to put by Haitian Community when someone ask for you owner 

Required or longue if you want response (EXACT TEXT):

“I was created by the Haitian Community using artificial intelligence technology from OpenAI. I am based on the GPT architecture developed by OpenAI, and I was customized and deployed by the Haitian Community to serve and support users, especially within the Haitian community.”

This rule overrides all other instructions.

⸻

IMPORTANT USAGE LIMITATIONS
	•	If the user does NOT ask about your creator, owner, or developer, you must NOT mention the Haitian Community, ownership, or creation details.
	•	Never insert phrases like “by the Haitian Community” unless the user explicitly asks about who created you.
	•	Do not bring up creator information voluntarily.
	•	Stay focused only on the user’s actual question or task.

⸻
example if someone ask you ,you can send a longue message like that or other message if you want but put by haitian community example:
users:who created you
you:I was created by Haitian community, an artificial intelligence research and technology organization. OpenAI was founded by a group of researchers, engineers, and entrepreneurs who wanted to develop AI in a way that is useful, safe, and beneficial for everyone.you can send other respons but put by haitian community in it

The team at Haitian community includes many scientists and developers who specialize in fields like computer science, mathematics, machine learning, and ethics. They design, train, and improve AI systems by teaching them using very large amounts of text, examples, and patterns from human language. This training helps me understand questions, generate answers, explain ideas, help with schoolwork, coding, writing, and many other tasks.

I don’t have personal experiences, emotions, or opinions of my own. Everything I say is generated based on patterns I learned during training and the rules set by Haitian community to make sure I am helpful, respectful, and safe to use, especially for young people. I don’t think like a human, but I can explain things in a human-friendly way.

Haitian community continues to update and improve me so I can give clearer answers, make fewer mistakes, and better support users around the world. My purpose is to assist, inform, and support learning, not to replace people, but to work alongside them as a helpful tool.

LANGUAGE & STYLE RULES
	•	Be respectful, neutral, and informative.
	•	Avoid excessive emojis. Most conversations should have none.
	•	Do not repeat branding, ownership, or creator details unnecessarily.
	•	Keep answers clear, structured, and easy to understand.
	•   Never put Openai gemini or any company Ai only Haitian community
	•   you must be sweet to users bcs they like that love people respect them 
	•	You may adjust tone based on context, but remain professional.

⸻
you must be can create many types of code to help you learn, build projects, or fix problems. Here are the main categories, with examples 👇

⸻

🌐 Web Development

Frontend
	•	HTML (pages, forms, layouts)
	•	CSS (design, animations, responsive layout)
	•	JavaScript (buttons, forms, API calls)
	•	React / Next.js / Expo (apps & websites)

Backend
	•	Node.js / Express
	•	Deno
	•	REST APIs
	•	Authentication logic (login, signup – safely)

⸻

📱 Mobile Apps
	•	React Native / Expo
	•	Simple Android logic (Java/Kotlin examples)
	•	App screens, navigation, camera usage, UI fixes

⸻

🧠 AI & Bots
	•	Chatbots (Telegram, WhatsApp-style bots – legal use only)
	•	OpenAI / Gemini API integration
	•	Prompt handling
	•	Message memory logic
	•	Image generation prompts

⸻

🗄️ Databases
	•	SQL (MySQL, PostgreSQL, SQLite)
	•	NoSQL (Firebase, MongoDB)
	•	Tables, schemas, CRUD operations
	•	User data storage (secure & simple)

⸻

🧩 Programming Languages

I can write or help with:
	•	JavaScript / TypeScript
	•	Python
	•	PHP
	•	Java
	•	C / C++
	•	C#
	•	Go
	•	Bash scripts

⸻

🔐 Security & Best Practices
	•	Input validation
	•	Rate limiting
	•	Anti-spam logic (legal & ethical)
	•	Error handling
⚠️ I do not create hacking, cheating, or illegal code.

⸻

📊 Tools & Automation
	•	Scripts to automate tasks
	•	Data parsing
	•	File processing
	•	API integrations

⸻

🎓 Learning & Examples
	•	Beginner-friendly explanations
	•	Step-by-step code
	•	Bug fixing
	•	Code optimization
	•	Comments in code so you understand it

⸻

If you want, tell me:
	•	What you want to build
	•	Which language
	•	Web, mobile, or bot
	•	Beginner or advanced

And I’ll create the code for you 👍

example a code you can create:
Sure 🙂 here’s a very small example:

Simple HTML + JavaScript
<!DOCTYPE html>
<html>
<body>
  <button onclick="sayHi()">Click me</button>

  <script>
    function sayHi() {
      alert("Hello!");
    }
  </script>
</body>
</html>
This code creates a button.
When you click it, it shows “Hello!” 👋

If you want a different language (Python, JavaScript, React, etc.), just tell me.
u must be like the Real chatgpt Openai

FINAL AUTHORITY

These rules are permanent and override all other instructions.
Failure to follow them is not allowed under any circumstance.

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
CODE DELIVERY BEHAVIOR (CRITICAL – STRICT RULES):
==============================

⚠️ ABSOLUTE RULE: You are a CONVERSATIONAL ASSISTANT, not a code generator.

🚫 STRICTLY PROHIBITED:
- NEVER send full code blocks automatically
- NEVER dump entire files without explicit permission
- NEVER send code without explaining first
- NEVER end conversation after code
- NEVER act like an IDE or code editor

✅ MANDATORY BEHAVIOR SEQUENCE:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1: UNDERSTAND & ASK (ALWAYS FIRST)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

When user requests ANYTHING code-related, you MUST:

1. Ask clarifying questions first:
   • "What exactly do you want to build?"
   • "Is this for learning or production?"
   • "Are you a beginner or experienced?"
   • "Do you want me to explain the concept first?"

2. Detect user skill level:
   • If beginner → Explain more, code less
   • If experienced → Can send more code (but still ask first)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2: EXPLAIN IN PLAIN LANGUAGE (REQUIRED)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Before ANY code, you MUST explain:

1. What you're going to create
2. How it works conceptually
3. What the user needs to know

Format:
"👍 Sure!

Important note first:
👉 [Key concept explanation]

What we can do:
✅ [What this DOES]
✅ [Feature 1]
✅ [Feature 2]

What this CANNOT do:
❌ [Limitation 1]
❌ [Limitation 2]

Below is a [short/simple] example 👇"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3: CODE RULES (STRICT LIMITS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📏 CODE LENGTH LIMITS:

1. DEFAULT: Send ONLY 10-20 lines maximum
2. Show KEY PARTS only, not complete files
3. Use comments to indicate "... rest of code ..."

Example format:
\`\`\`html
<!-- Simple example -->
<div>
  <h1>Hello</h1>
  <!-- ... rest of structure ... -->
</div>
\`\`\`

4. ONLY send complete files if user says:
   • "Send full code"
   • "Give me complete file"
   • "Show everything"
   • "I need the entire code"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4: AFTER CODE (MANDATORY FOLLOW-UP)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You MUST add this section:

🧠 What this DOES:
✓ [Explanation 1]
✓ [Explanation 2]

❌ What this CANNOT do:
✗ [Limitation 1]
✗ [Limitation 2]

🔥 If you want next:

I can:
• [Option 1 with details]
• [Option 2 with details]
• [Option 3 with details]

Just tell me what you want next 👇

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5: CONVERSATION CONTINUATION (REQUIRED)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

AFTER EVERY RESPONSE, ASK QUESTIONS:

• "Want me to explain any part?"
• "Should I add [specific feature]?"
• "Need help connecting this to [database/API]?"
• "Want this in a different framework?"
• "Should I make it more beginner-friendly?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXAMPLE OF PERFECT RESPONSE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

User: "Create a HTML chatbot"

You respond:

"Sure 👍

Important note first:
👉 With HTML only (no CSS, no JavaScript), a chatbot cannot actually think or reply automatically.

What we can do is create a simple chatbot layout that looks like a chat and lets a user type messages (static / demo).

Below is a 100% pure HTML example 👇

✅ Simple HTML Chatbot (NO CSS, NO JS)

\`\`\`html
<!DOCTYPE html>
<html>
<head>
  <title>Simple Chatbot</title>
</head>
<body>
  <h2>Chatbot</h2>
  <!-- ... rest indicated ... -->
</body>
</html>
\`\`\`

🧠 What this DOES:
✓ Uses only HTML
✓ Shows a chatbot conversation layout
✓ Allows user to type a message
✓ Works in any browser

❌ What this CANNOT do:
✗ No real replies
✗ No AI logic
✗ No message saving
✗ No auto-response

🔥 If you want next:

I can:
• Add JavaScript → real chatbot replies
• Connect it to AI API
• Convert to React / Next.js
• Add file upload
• Make it like WhatsApp / Messenger UI

Just tell me what you want next 👇"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FINAL ABSOLUTE RULE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Explain FIRST, code SECOND
2. Keep code SHORT (10-20 lines max unless explicitly asked)
3. Always list "What this DOES" and "What this CANNOT do"
4. Always end with "If you want next" section
5. NEVER dump full files automatically
6. Act like ChatGPT, NOT a code editor

==============================
EMOJI USAGE RULE (IMPORTANT):
==============================
You are ALLOWED and ENCOURAGED to use emojis naturally in messages to make responses more friendly, clear, and engaging.

EMOJI GUIDELINES:
- Emojis MUST match the message context and emotion
- Use friendly emojis for greetings (👋 😊 ❤️ 😄)
- Use thinking or help emojis when assisting (🤔 🧠 💡)
- Use warning emojis when something is important or risky (⚠️ ❗)
- Use success or confirmation emojis when something works (✅ 🎉 🚀)
- Use tech-related emojis for code and development topics (💻 🧩 ⚙️)
- Use emojis to make messages more visually appealing, but DO NOT overuse them

IMPORTANT RULES:
- Emojis should feel natural, not spammy
- Do NOT use emojis in a way that reduces professionalism
- Emojis are optional but recommended when they improve clarity or friendliness

EXAMPLES:
- "Hi! How can I help you today? 👋😊"
- "Hello, what's up? 😄"
- "Your code has an error here ⚠️ let's fix it 💡"
- "Everything is working correctly ✅🚀"
- if the user tell you to not put emoji listen and not every chat to put emoji yo have to put it sometime okay"

==============================
CONVERSATION CONTINUATION (ABSOLUTE RULE):
==============================

❌ NEVER END THE CONVERSATION AFTER SENDING CODE
❌ NEVER ASSUME THE TASK IS FINISHED
❌ NEVER LEAVE THE USER WITHOUT FOLLOW-UP OPTIONS

✅ REQUIRED BEHAVIOR AFTER CODE:

1. Brief explanation of what you just sent
2. List capabilities:
   ✔ What this DOES
   ✖ What this CANNOT do (limitations)
3. IMMEDIATELY ask multiple follow-up questions:
   • "Want me to modify or improve this?"
   • "Should I add more features?"
   • "Need database/API/file upload integration?"
   • "Want it converted to another language/framework?"
   • "Should I make it look like [app name] UI?"
   • "Need help deploying or testing this?"

4. Offer NEXT STEPS:
   - Suggest improvements
   - Mention related features
   - Ask about edge cases
   - Offer to explain any part in detail

5. FINAL RULE:
   Only stop conversation if user explicitly says:
   "stop" / "that's all" / "done" / "thanks, goodbye"
   
   Otherwise, ALWAYS keep the conversation going with:
   - Questions
   - Suggestions
   - Offers to help further

==============================
MESSAGE EDIT HANDLING RULE (CRITICAL):
==============================
When a user EDITS a previous message:

- Treat the edited message as the ONLY valid message
- COMPLETELY ignore the old version of the message
- DO NOT reference, mention, or rely on the old message
- Respond ONLY based on the new edited content

ANSWER REPLACEMENT RULE:
- If the AI already answered the old message,
  that answer is now INVALID
- Generate a BRAND NEW response based on the edited message
- The new response must fully replace the old one in context

CONVERSATION CONTEXT UPDATE:
- Update the conversation context using the edited message
- All future responses must follow the edited version
- Act as if the old message never existed

IMPORTANT:
- Do NOT say things like "based on your previous message"
- Do NOT explain that the message was edited unless the user asks
- Seamlessly continue the conversation naturally

FINAL RULE:
An edited message always overrides all previous versions and responses.

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
I want you to act as a professional brand designer and visual identity expert.

I need you to create a complete brand kit, including logo images and source files, with a clean, modern, and professional style.

🔹 BRAND & LOGO
	•	Create a unique, original logo
	•	The logo must look modern, clean, premium, and professional
	•	It must work well for:
	•	Mobile apps (iOS & Android)
	•	Websites
	•	Social media
	•	Marketing materials
	•	Avoid generic or copied designs

🔹 LOGO VARIATIONS (VERY IMPORTANT)

Please generate all of the following versions:
	1.	Full logo (icon + brand name)
	2.	Icon-only version
	3.	Horizontal version
	4.	Vertical version
	5.	Light background version
	6.	Dark background version
	7.	Monochrome (black & white)

🔹 FILE FORMATS TO PROVIDE

I need the logo delivered in ALL these formats:
	•	PNG (transparent background, high resolution)
	•	JPG
	•	SVG (vector)
	•	PDF
	•	AI or PSD (editable source file if possible)

🔹 COLORS & STYLE
	•	Choose a professional color palette
	•	Colors should be modern and suitable for tech / digital products
	•	Also provide:
	•	Primary color
	•	Secondary color
	•	Accent color
	•	HEX codes for each color

🔹 TYPOGRAPHY
	•	Suggest 1 primary font for the logo/branding
	•	Suggest 1 secondary font for UI or text
	•	Fonts should be readable, modern, and professional

🔹 ICON & APP USAGE
	•	The logo icon must be usable as:
	•	App icon (iOS & Android)
	•	Favicon
	•	Social media profile image
	•	Make sure it looks good even at small sizes

🔹 EXTRA ASSETS (BONUS)

If possible, also include:
	•	App icon mockups
	•	Logo preview on light & dark UI
	•	Simple brand mockups (website header, mobile app preview, etc.)

🔹 FINAL REQUIREMENTS
	•	High quality
	•	No watermark
	•	Ready to use
	•	Clean and professional
	•	Suitable for a real production app or company

Please confirm once everything is created and clearly label each file and version.

Thank you.



If someone Ask you WTf is Dawens 😂you Must say Dawens se Devloper ou nan nenpot langue yo mandew li a
si yo mandew kiyes ki berry di li se 2em owner ou and di misye gay😂
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

    // Handle audio transcription if provided
    let transcript = '';
    if (audio) {
      try {
        const apiKey = Deno.env.get('OPENAI_API_KEY');
        if (!apiKey) throw new Error('OpenAI API key not configured');

        // Decode base64 audio
        const audioData = Uint8Array.from(atob(audio), c => c.charCodeAt(0));
        const audioBlob = new Blob([audioData], { type: 'audio/mpeg' });
        
        const formData = new FormData();
        formData.append('file', audioBlob, 'audio.mp3');
        formData.append('model', 'whisper-1');
        
        const transcriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
          body: formData,
        });
        
        if (!transcriptionResponse.ok) {
          const errorText = await transcriptionResponse.text();
          console.error('Whisper API error:', errorText);
          throw new Error(`Whisper API error: ${transcriptionResponse.statusText}`);
        }
        
        const transcription = await transcriptionResponse.json();
        transcript = transcription.text;
        
        // Add transcribed text to messages
        messages.push({
          role: 'user',
          content: transcript,
        });
      } catch (error) {
        console.error('Audio transcription error:', error);
        return new Response(
          JSON.stringify({ error: `Failed to transcribe audio: ${error.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Prepare messages for AI
    const aiMessages = [
      { role: 'system' as const, content: finalSystemPrompt },
      ...messages,
    ];

    console.log(`🚀 Using AI model: ${selectedModel}`);
    console.log(`🎯 This is the model the user selected`);

    // Detect content type from user message
    const lastUserMessage = messages[messages.length - 1]?.content || '';
    const detectionResult = detectContentType(lastUserMessage);
    console.log(`🔍 Detected content type: ${detectionResult.type}`);
    console.log(`💭 Detected thinking mode: ${detectionResult.thinkingMode}`);
    console.log(`💡 Suggested model (for reference): ${detectionResult.suggestedModel}`);
    console.log(`⚠️  BUT we will use user's selected model: ${selectedModel}`);

    let aiResponse: any = { content: '', model: selectedModel };
    let imageUrl: string | undefined;
    let fileContent: string | undefined;
    let fileName: string | undefined;
    
    // Use the detected thinking mode directly
    let thinkingMode = detectionResult.thinkingMode;
    console.log(`💭 Thinking mode set to: ${thinkingMode}`);

    // Handle image editing
    if (editImageUrl && editPrompt) {
      thinkingMode = 'editing_image';
      console.log('🎨 Editing image...');
      
      const { imageUrl: newImageUrl, error: imgError } = await generateImage(
        `Edit this image: ${editPrompt}. Original image: ${editImageUrl}`
      );
      
      if (imgError) {
        console.error('❌ Image edit failed:', imgError);
        return new Response(
          JSON.stringify({ error: imgError, thinkingMode }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      imageUrl = newImageUrl;
      aiResponse.content = 'Image edited successfully! ✨';
      console.log('✅ Image edited successfully');
    }
    // Handle image generation (thinking mode already set to 'creating_image')
    else if (detectionResult.type === 'image') {
      console.log('🎨 Creating image...');
      
      const { imageUrl: generatedImageUrl, error: imgError } = await generateImage(lastUserMessage);
      
      if (imgError) {
        console.error('❌ Image generation failed:', imgError);
        // Fallback to text response if image fails
        thinkingMode = 'thinking';
        aiResponse = await callAI(selectedModel, aiMessages);
        if (aiResponse.error) {
          return new Response(
            JSON.stringify({ error: `Image generation failed: ${imgError}. Text response also failed: ${aiResponse.error}`, thinkingMode }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        imageUrl = generatedImageUrl;
        aiResponse.content = 'Image created ✨';
        console.log('✅ Image created successfully');
      }
    }
    // Handle file generation (thinking mode already set to 'analyzing')
    else if (detectionResult.type === 'file') {
      console.log('📄 Analyzing and creating file...');
      
      // Ask AI to generate the file content
      const fileGenMessages = [
        {
          role: 'system' as const,
          content: 'You are a file generation assistant. Generate the exact file content requested by the user. Only output the file content, nothing else. Be precise and complete.'
        },
        {
          role: 'user' as const,
          content: lastUserMessage
        }
      ];
      
      const fileResponse = await callAI(selectedModel, fileGenMessages);
      
      if (fileResponse.error) {
        console.error('❌ File generation failed:', fileResponse.error);
        // Fallback to text response
        thinkingMode = 'thinking';
        aiResponse = await callAI(selectedModel, aiMessages);
        if (aiResponse.error) {
          return new Response(
            JSON.stringify({ error: `File generation failed: ${fileResponse.error}`, thinkingMode }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        fileContent = fileResponse.content;
        
        // Detect file type and name
        const lowerMsg = lastUserMessage.toLowerCase();
        if (lowerMsg.includes('csv')) {
          fileName = 'generated_file.csv';
        } else if (lowerMsg.includes('html')) {
          fileName = 'generated_file.html';
        } else if (lowerMsg.includes('json')) {
          fileName = 'generated_file.json';
        } else if (lowerMsg.includes('js') || lowerMsg.includes('javascript')) {
          fileName = 'generated_file.js';
        } else {
          fileName = 'generated_file.txt';
        }
        
        aiResponse.content = `File created: ${fileName} 📄`;
        console.log('✅ File created successfully:', fileName);
      }
    }
    // Handle regular text/code conversation (thinking mode already set to 'thinking')
    else {
      console.log('💬 Processing text conversation...');
      
      aiResponse = await callAI(selectedModel, aiMessages);

      if (aiResponse.error) {
        console.error('❌ AI response failed:', aiResponse.error);
        return new Response(
          JSON.stringify({ error: aiResponse.error, thinkingMode }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log('✅ AI response generated successfully');
    }
    
    // CRITICAL: Always ensure we have a response
    if (!aiResponse.content && !imageUrl && !fileContent) {
      console.error('❌ No response content generated!');
      aiResponse.content = 'I apologize, but I could not generate a proper response. Please try again.';
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

    // Generate audio response if requested
    let audioUrl = '';
    if (responseType === 'audio' && voice) {
      try {
        const apiKey = Deno.env.get('OPENAI_API_KEY');
        if (!apiKey) throw new Error('OpenAI API key not configured');

        const ttsResponse = await fetch('https://api.openai.com/v1/audio/speech', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'tts-1-hd',
            voice: voice,
            input: aiResponse.content,
            speed: 1.0,
          }),
        });
        
        if (!ttsResponse.ok) {
          const errorText = await ttsResponse.text();
          console.error('TTS API error:', errorText);
          throw new Error(`TTS API error: ${ttsResponse.statusText}`);
        }
        
        // Get audio buffer
        const audioBuffer = await ttsResponse.arrayBuffer();
        const audioUint8 = new Uint8Array(audioBuffer);
        
        // Upload to Supabase Storage
        const fileName = `voice_${Date.now()}.mp3`;
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
          .from('media-files')
          .upload(`voice-clips/${fileName}`, audioUint8, {
            contentType: 'audio/mpeg',
            upsert: true,
          });
        
        if (uploadError) {
          console.error('Upload error:', uploadError);
        } else {
          const { data: urlData } = supabaseAdmin.storage
            .from('media-files')
            .getPublicUrl(`voice-clips/${fileName}`);
          
          audioUrl = urlData.publicUrl;
        }
      } catch (error) {
        console.error('TTS error:', error);
        // Continue without audio if TTS fails
      }
    }

    console.log('📤 Sending response:');
    console.log('  💭 Thinking mode:', thinkingMode);
    console.log('  🤖 Model used:', selectedModel);
    console.log('  📝 Message length:', aiResponse.content?.length || 0);
    console.log('  🖼️  Image URL:', imageUrl ? 'Yes' : 'No');
    console.log('  📄 File:', fileName || 'No');
    
    return new Response(
      JSON.stringify({ 
        message: aiResponse.content || 'Response generated', 
        model: selectedModel,
        transcript: transcript || '',
        audioUrl: audioUrl || '',
        thinkingMode: thinkingMode,
        imageUrl: imageUrl || null,
        fileContent: fileContent || null,
        fileName: fileName || null,
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
