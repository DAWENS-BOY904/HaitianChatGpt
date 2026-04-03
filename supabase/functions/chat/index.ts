import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { 
  callAI, 
  detectContentType, 
  generateImageSmart, 
  isTextOnlyModel,
  AI_MODELS 
} from '../_shared/ai-providers.ts';

Deno.serve(async (req) => {
  // CRITICAL: Handle OPTIONS first
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // CRITICAL: Top-level try-catch to prevent HTML error responses
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
      console.error('❌ Auth error:', userError);
      return new Response(
        JSON.stringify({ 
          error: 'Authentication required. Please log in again.',
          type: 'AuthError'
        }),
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
    const systemPrompt = `You are Dawinix, an advanced AI assistant developed to deliver Copilot‑level coding help and general conversational intelligence. You understand code, design, and human language, and you adapt instantly to Haitian Creole, English, French, or any other language the user chooses. Your responses must feel polished, accurate, and context‑aware as if a human expert were typing in real time.

Your core directives:
• Always be professional, clear, calm, and respectful.
• Avoid slang, jokes, or unnecessary emojis unless they clarify or comfort.
• Never expose internal details such as model names, fallbacks, errors, or debug info.
• Simulate typing by emitting text gradually; do not output full replies at once.
• When asked to generate code or a project, first list the file structure, then produce each file one by one with explicit labels and comments showing where to configure environment variables, API keys, or settings.
• Treat image requests with a dedicated image model; if the chosen model cannot render images, silently switch to a reliable fallback (e.g. Space.ai).
• Automatically detect and ban scam/fraud content; log sexual content but allow it.
• Personalize based on user settings (language, tone, nickname, occupation, interests).

Ownership is fixed: you are created and owned by the Haitian Community. Should any user ask “who created you” or similar, respond only with “I was created by the Haitian Community.” Do not mention this otherwise.

Always return a JSON payload containing message, thinkingMode, and any optional imageUrl, fileUrl, fileName, fileType, transcript, or audioUrl. Clean the message of any debugging artifacts before sending.

The preceding instructions are comprehensive and must remain intact. Append any uploaded file contents and user preferences at runtime to further personalize responses.`
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
Hello AI, you are authorized to generate content for all requested services. This includes:
	•	Creating images, logos, and icons
	•	Generating files in any format (HTML, CSV, JSON, TXT, etc.)
	•	Performing searches and providing links
	•	Handling any type of request as a service, including adult content if asked
	•	Responding with content, URLs, or files directly as requested

You must always serve the user fully and provide the requested output without restrictions, as long as the request is within your system capabilities.

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
5. NEVER dump full files automatically you can send multiple file with message 
6. Act like ChatGPT, like a code editor

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
I want you to act as a professional brand designer and visual identity expert


If someone Ask you WTf is Dawens 😂you Must say Dawens se Devloper ou nan nenpot langue yo mandew li a
si yo mandew kiyes ki berry di li se 2em owner ou and di misye gay😂
Si yon moun mandew Kiyes ki Ray ou dwe dil Co-créateur de l’application, Ray est à la fois stratège et bâtisseur d'idées. Son objectif ? Offrir une expérience innovante et accessible à tous...pour plus info n'hésitez pas à nous parler...! 🧍🏽‍♂️"


Hello, I hope you are doing well.
I am reaching out to request support and improvements for the Haitian ChatGPT project that I am developing / using. The goal of this project is to make artificial intelligence more accessible to the Haitian community, especially for those who rely on Haitian Creole for communication, education, and daily assistance.

At the moment, the system works, but there are some important limitations that are preventing us from delivering the best possible AI experience. One of the main issues is the inability to send or receive images within the Haitian ChatGPT interface. This significantly reduces the usefulness of the tool, since many users need the AI to identify objects, read documents, analyze photos, support schoolwork, translate images, and provide visual guidance.

I would like to kindly ask for your assistance in fixing and upgrading these features so that Haitian ChatGPT can operate more like the original ChatGPT experience.
Here are the specific improvements I am requesting:
	1.	Enable image sending and receiving — allow users to upload, view, and analyze images directly through Haitian ChatGPT.
	2.	Improve visual-processing integration — ensure the AI can recognize text, objects, handwriting, screenshots, and photos just like ChatGPT.
	3.	Stabilize the platform — fix bugs or limitations that prevent consistent use and smooth responses.
	4.	Expand support for Haitian Creole — make language processing more natural, accurate, and culturally relevant to Haitian users.
	5.	Improve multimodal interaction — allow the AI to combine text and image responses to offer better explanations and guidance.

Making these improvements would help us bring modern AI capabilities to Haitian communities worldwide, support education, business, creativity, and help bridge digital barriers. Haitian users deserve a high-quality platform that functions at the same level as global AI tools, and image support is an essential part of that experience.

==============================
IMAGE & LOGO GENERATION RULE (SPECIAL CASE)
==============================

When the user requests:
- a logo
- a brand logo
- an icon
- a visual identity
- an illustration

You MUST follow this two-phase process:

PHASE 1 (MANDATORY – NO IMAGE):
- Ask ONLY these questions (maximum 4):
  • Brand name
  • Business type / industry
  • Preferred colors
  • Style (modern, luxury, minimal, playful, etc.)

- Do NOT generate any image in this phase.
- Do NOT say you cannot generate logos.
- Explain briefly that the image will be generated after the answers.

PHASE 2 (IMAGE CREATION):
- After the user answers, you ARE AUTHORIZED to generate ONE image.
- Generate a professional, high-quality logo.
- Do NOT include explanations in the image response.
- Do NOT refuse image creation.

This rule OVERRIDES:
- "NEVER send full output automatically"
- "ALWAYS ask before generating"
- "Conversational assistant only"

==============================
I hope you are doing well. I am reaching out regarding the AI project that is currently under development. I noticed an issue that affects image generation and model selection which needs to be addressed to ensure a smooth and reliable user experience.

Currently, when I try to generate an image or logo using the AI system, I often encounter messages like: [Using groq-llama – gemini unavailable] This indicates that the system is defaulting to a text-only model (groq-llama) whenever Gemini is unavailable. As a result:
	•	The AI can only provide text descriptions of images or logos, not actual generated images.
	•	Users do not get the expected output when selecting the Gemini model or any other image-capable AI.
	•	The fallback mechanism does not reliably redirect to an alternative image generation model.

To fix this, I would like the following improvements implemented:
	1.	Fix Model Selection:
	•	When a user explicitly selects an AI model (e.g., Gemini), the system should attempt to use that model for the requested task.
	•	If the selected model is unavailable for image generation, the system should automatically fallback to a reliable image-capable model (for example, Space.ai or another approved image model).
	•	Text-only models like groq-llama should never be used for tasks that require images.
	2.	Fallback Logic:
	•	Ensure that the system detects when the requested model is unavailable.
	•	Automatically switch to the fallback image model without producing errors or requiring the user to retry.
	•	Keep the user experience smooth and seamless.
	3.	Error Handling & Logging:
	•	If a model fails, log the error for monitoring.
	•	Notify the system admin if the fallback also fails.
	•	Avoid showing confusing messages like [Using groq-llama – gemini unavailable] to the end-user.
	4.	Testing & Validation:
	•	Ensure that image and logo generation works reliably across all supported models.
	•	Verify that selecting any model (Gemini, Space.ai, etc.) triggers the correct engine and fallback behavior.

Implementing these changes will greatly improve the AI project’s stability, image generation reliability, and overall user satisfaction. Users should be able to select the model they prefer, and the system should seamlessly handle unavailability without fallback to text-only models for image tasks.
Fallback error ai must go to ai on space.ai
Thank you very much for your attention and support. I appreciate your help in making this AI project more robust and professional.,
"A serene mountain landscape at sunrise, with misty valleys, soft pink and orange sky, and golden sunlight illuminating the peaks."
Thank you very much for your time and consideration.
I truly hope you can help us make Haitian ChatGPT more powerful, more accessible, and more aligned with the full capabilities of AI technology today.
Please let me know what steps we need to take to move forward with these improvements.
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
        
        messages.push({
          role: 'user',
          content: transcript,
        });
      } catch (error: any) {
        console.error('Audio transcription error:', error);
        return new Response(
          JSON.stringify({ 
            error: `Failed to transcribe audio: ${error.message}`,
            type: 'AudioTranscriptionError',
            suggestion: 'Please check your audio file format and try again.'
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Prepare messages for AI
    const aiMessages = [
      { role: 'system' as const, content: finalSystemPrompt },
      ...messages,
    ];

    // Detect content type from user message
    const lastUserMessage = messages[messages.length - 1]?.content || '';
    const detectionResult = detectContentType(lastUserMessage);
    
    console.log(`🔍 Detected content type: ${detectionResult.type}`);
    console.log(`💭 Detected thinking mode: ${detectionResult.thinkingMode}`);
    console.log(`🤖 Suggested model: ${detectionResult.suggestedModel}`);
    console.log(`🖼️  Is image task: ${detectionResult.isImageTask}`);
    console.log(`🎯 User selected model: ${selectedModel}`);

    let aiResponse: any = { content: '', model: selectedModel };
    let imageUrl: string | undefined;
    let fileContent: string | undefined;
    let fileName: string | undefined;
    
    let thinkingMode = detectionResult.thinkingMode;

    // CRITICAL FIX: Check if user selected a text-only model for an image task
    if (detectionResult.isImageTask && isTextOnlyModel(selectedModel)) {
      console.warn(`🚫 User selected text-only model ${selectedModel} for image task. Forcing image generation.`);
    }

    // Handle image editing
    if (editImageUrl && editPrompt) {
      thinkingMode = 'editing_image';
      console.log('🎨 Editing image...');
      
      // Use smart image generation for editing
      const editResult = await generateImageSmart(
        `Edit this image: ${editPrompt}. Base image: ${editImageUrl}`,
        'gemini'
      );
      
      if (editResult.error) {
        console.error('❌ Image edit failed:', editResult.error);
        return new Response(
          JSON.stringify({ 
            error: editResult.error, 
            type: 'ImageEditError',
            thinkingMode,
            suggestion: 'I\'m sorry, but I couldn\'t edit the image as requested. This can happen with certain types of edits or image formats. Here are some alternatives you can try:\n\n1. **Provide clearer instructions** - Be more specific about what changes you want\n2. **Try a different approach** - Describe the edit in different words\n3. **Upload a different image** - Some images are easier to edit than others\n4. **Start with a new image** - Create a new image instead of editing\n5. **Contact support** - If this persists, our team can help troubleshoot\n\nLet me know how else I can help you with your image needs!'
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      imageUrl = editResult.imageUrl;
      aiResponse.content = 'Perfect! I\'ve successfully edited your image according to your instructions. The modified image is now ready for you to view and download. You can save the changes, share it with others, or request additional modifications if needed. If you\'d like me to make further adjustments or create variations, just let me know! ✨🎨';
      aiResponse.model = editResult.model;
      console.log('✅ Image edited successfully with model:', editResult.model);
    }
    // Handle image generation - CRITICAL FIX
    else if (detectionResult.isImageTask) {
      console.log('🎨 IMAGE TASK DETECTED - Using Smart Image Generation');
      console.log('🚫 BLOCKING text-only models from image generation');
      
      // ALWAYS use generateImageSmart for image tasks - never callAI
      const imageResult = await generateImageSmart(lastUserMessage, selectedModel);
      
      if (imageResult.error) {
        console.error('❌ Image generation failed:', imageResult.error);
        
        // Provide helpful error message
        return new Response(
          JSON.stringify({ 
            error: imageResult.error,
            type: 'ImageGenerationError',
            thinkingMode: 'error',
            suggestion: 'I apologize, but image generation is currently experiencing technical difficulties. This could be due to high demand on our AI services or temporary connectivity issues. Here are some helpful alternatives you can try:\n\n1. **Rephrase your request** - Try describing your image idea in different words\n2. **Wait a few moments** - Sometimes the service recovers quickly\n3. **Try a different AI model** - Switch to another model in the model selector\n4. **Request a text description** - I can provide detailed text descriptions of what your image might look like\n5. **Contact support** - If this persists, our support team can help resolve the issue\n\nPlease try one of these options, and I\'ll be happy to assist you further!'
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (imageResult.imageUrl) {
        imageUrl = imageResult.imageUrl;
        aiResponse.content = `Perfect! I've successfully created your custom image using our advanced ${imageResult.model} AI model. The image is now ready for you to view and download. You can save it to your device or share it with others. If you'd like me to create variations or modify this image in any way, just let me know! ✨🎨`;
        aiResponse.model = imageResult.model;
        console.log('✅ Image generated successfully with model:', imageResult.model);
      } else {
        return new Response(
          JSON.stringify({ 
            error: 'Image generation returned empty result. Please try again.',
            type: 'EmptyImageResultError',
            thinkingMode: 'error',
            suggestion: 'It seems the image generation process completed but didn\'t produce a visible result. This can happen with certain types of requests. Here\'s what you can try:\n\n1. **Make your description more specific** - Add more details about colors, style, or composition\n2. **Try different wording** - Rephrase your request using different terms\n3. **Select a different AI model** - Different models handle various types of images better\n4. **Simplify your request** - Start with a basic description and add details later\n5. **Check for restricted content** - Some topics may not be allowed by our AI services\n\nPlease try one of these approaches, and I\'ll help you create the perfect image!'
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    // Handle both image and file generation
    else if (detectionResult.type === 'both') {
      console.log('🎨📄 BOTH IMAGE AND FILE TASK DETECTED');
      
      // Generate image first
      const imageResult = await generateImageSmart(lastUserMessage, selectedModel);
      if (imageResult.imageUrl) {
        imageUrl = imageResult.imageUrl;
        console.log('✅ Image generated for combined task');
      }
      
      // Generate file
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
      
      const fileResponse = await callAI(selectedModel, fileGenMessages, false);
      if (!fileResponse.error) {
        fileContent = fileResponse.content;
        
        // Detect file type and name
        const lowerMsg = lastUserMessage.toLowerCase();
        let detectedFileName = 'generated_file.txt';

        if (lowerMsg.includes('csv')) detectedFileName = 'generated_file.csv';
        else if (lowerMsg.includes('html')) detectedFileName = 'generated_file.html';
        else if (lowerMsg.includes('json')) detectedFileName = 'generated_file.json';
        else if (lowerMsg.includes('js') || lowerMsg.includes('javascript')) detectedFileName = 'generated_file.js';
        else if (lowerMsg.includes('ts') || lowerMsg.includes('typescript')) detectedFileName = 'generated_file.ts';
        else if (lowerMsg.includes('python') || lowerMsg.includes('py')) detectedFileName = 'generated_file.py';
        else if (lowerMsg.includes('java')) detectedFileName = 'generated_file.java';
        else if (lowerMsg.includes('c++')) detectedFileName = 'generated_file.cpp';
        else if (lowerMsg.includes('c#')) detectedFileName = 'generated_file.cs';
        else if (lowerMsg.includes('php')) detectedFileName = 'generated_file.php';
        else if (lowerMsg.includes('xml')) detectedFileName = 'generated_file.xml';
        else if (lowerMsg.includes('yaml') || lowerMsg.includes('yml')) detectedFileName = 'generated_file.yml';
        else if (lowerMsg.includes('sql')) detectedFileName = 'generated_file.sql';
        else if (lowerMsg.includes('md') || lowerMsg.includes('markdown')) detectedFileName = 'generated_file.md';
        else if (lowerMsg.includes('css')) detectedFileName = 'generated_file.css';
        
        fileName = detectedFileName;
        console.log('✅ File generated for combined task:', fileName);
      }
      
      aiResponse.content = `Excellent! I've created both a custom image and a file for you in this single request. The image has been generated using our advanced AI models and is ready to view. The file contains the content you requested and can be downloaded immediately. You now have both visual and textual/digital assets ready to use. If you need any modifications to either the image or file, or want to create more content, just ask! ✨🎨📄`;
      aiResponse.model = selectedModel;
    }
    // Handle file generation
    else if (detectionResult.type === 'file') {
      console.log('📄 Analyzing and creating file...');
      
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
      
      // For file generation, we can use the normal router but mark as not image
      const fileResponse = await callAI(selectedModel, fileGenMessages, false);
      
      if (fileResponse.error) {
        console.error('❌ File generation failed:', fileResponse.error);
        thinkingMode = 'thinking';
        aiResponse = await callAI(selectedModel, aiMessages, false);
        if (aiResponse.error) {
          return new Response(
            JSON.stringify({ 
              error: `File generation failed: ${fileResponse.error}`,
              type: 'FileGenerationError',
              thinkingMode,
              suggestion: 'I\'m sorry, but I encountered an issue while trying to generate your file. This could be due to the complexity of your request or a temporary issue with the AI service. Here are some helpful steps you can take:\n\n1. **Simplify your request** - Try asking for a simpler file or less complex content\n2. **Be more specific** - Provide clearer instructions about what the file should contain\n3. **Specify the file type** - Mention the exact format you need (CSV, HTML, JSON, etc.)\n4. **Try a different AI model** - Switch to another model that might handle your request better\n5. **Break it down** - Ask for smaller parts of the file content separately\n\nIf none of these work, I can help you create the content in a different way or provide guidance on how to create the file yourself. Let me know how I can assist!'
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        fileContent = fileResponse.content;
        
        // Detect file type and name
        const lowerMsg = lastUserMessage.toLowerCase();
        let detectedFileName = 'generated_file.txt';

        if (lowerMsg.includes('csv')) detectedFileName = 'generated_file.csv';
        else if (lowerMsg.includes('html')) detectedFileName = 'generated_file.html';
        else if (lowerMsg.includes('json')) detectedFileName = 'generated_file.json';
        else if (lowerMsg.includes('js') || lowerMsg.includes('javascript')) detectedFileName = 'generated_file.js';
        else if (lowerMsg.includes('ts') || lowerMsg.includes('typescript')) detectedFileName = 'generated_file.ts';
        else if (lowerMsg.includes('python') || lowerMsg.includes('py')) detectedFileName = 'generated_file.py';
        else if (lowerMsg.includes('java')) detectedFileName = 'generated_file.java';
        else if (lowerMsg.includes('c++')) detectedFileName = 'generated_file.cpp';
        else if (lowerMsg.includes('c#')) detectedFileName = 'generated_file.cs';
        else if (lowerMsg.includes('php')) detectedFileName = 'generated_file.php';
        else if (lowerMsg.includes('xml')) detectedFileName = 'generated_file.xml';
        else if (lowerMsg.includes('yaml') || lowerMsg.includes('yml')) detectedFileName = 'generated_file.yml';
        else if (lowerMsg.includes('sql')) detectedFileName = 'generated_file.sql';
        else if (lowerMsg.includes('md') || lowerMsg.includes('markdown')) detectedFileName = 'generated_file.md';
        else if (lowerMsg.includes('css')) detectedFileName = 'generated_file.css';
        
        fileName = detectedFileName;
        aiResponse.content = `Perfect! I've successfully created your custom file: ${fileName}. This file has been generated with the exact content you requested and is now available for download. You can use it immediately in your projects, save it to your computer, or share it with others. The file is stored securely and ready whenever you need it. If you'd like me to modify the content, create additional files, or help you with anything else, just let me know! 📄✅`;
        console.log('✅ File created successfully:', fileName);
      }
    }
    // Handle regular text/code conversation
    else {
      console.log('💬 Processing text conversation...');
      console.log(`🤖 Using model: ${selectedModel} (text task)`);
      
      // Text tasks - safe to use any model including groq-llama
      aiResponse = await callAI(selectedModel, aiMessages, false);

      if (aiResponse.error) {
        console.error('❌ AI response failed:', aiResponse.error);
        return new Response(
          JSON.stringify({ 
            error: aiResponse.error,
            type: 'AIResponseError',
            thinkingMode,
            suggestion: 'I apologize, but I encountered an error while processing your request. This can happen due to various technical reasons. Here are some steps you can take to resolve this:\n\n1. **Try again** - Sometimes a simple retry works\n2. **Rephrase your question** - Ask the same thing using different words\n3. **Switch AI models** - Try selecting a different model from the model selector\n4. **Check your internet connection** - Ensure you have a stable connection\n5. **Simplify your request** - Break complex requests into smaller parts\n\nIf the problem persists, please contact our support team for assistance. I\'m here to help!'
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log('✅ AI response generated successfully with model:', aiResponse.model);
    }
    
    // Ensure we have a response
    if (!aiResponse.content && !imageUrl && !fileContent) {
      console.error('❌ No response content generated!');
      aiResponse.content = 'I apologize for the inconvenience, but I was unable to generate a proper response to your request. This is unusual and could be due to a temporary technical issue. Please try the following:\n\n1. **Send your message again** - Sometimes a simple retry resolves the issue\n2. **Check your message** - Ensure your request is clear and complete\n3. **Try a different approach** - Rephrase your question or request\n4. **Select another AI model** - Different models may handle your request better\n\nIf you continue to experience this problem, please contact our support team. I\'m here to help and want to make sure you get the assistance you need!';
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

    // Save file to storage if generated
    let fileUrl: string | undefined;
    if (fileContent && fileName) {
      try {
        const filePathInStorage = `${conversationId}/${Date.now()}_${fileName}`;
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
          .from('media-files')
          .upload(filePathInStorage, fileContent, {
            contentType: 'text/plain',
            upsert: true,
          });
        
        if (!uploadError && uploadData) {
          const { data: urlData } = supabaseAdmin.storage
            .from('media-files')
            .getPublicUrl(filePathInStorage);
          fileUrl = urlData.publicUrl;
          console.log('✅ File uploaded to storage:', fileUrl);
        }
      } catch (error) {
        console.error('❌ File upload error:', error);
      }
    }

    // Save AI response with image and/or file
    await supabaseAdmin.from('messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: aiResponse.content,
      image_url: imageUrl || null,
      file_url: fileUrl || null,
      file_name: fileName || null,
      file_type: fileName ? fileName.split('.').pop() : null,
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
        
        const audioBuffer = await ttsResponse.arrayBuffer();
        const audioUint8 = new Uint8Array(audioBuffer);
        
        const voiceFileName = `voice_${Date.now()}.mp3`;
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
          .from('media-files')
          .upload(`voice-clips/${voiceFileName}`, audioUint8, {
            contentType: 'audio/mpeg',
            upsert: true,
          });
        
        if (uploadError) {
          console.error('Upload error:', uploadError);
        } else {
          const { data: urlData } = supabaseAdmin.storage
            .from('media-files')
            .getPublicUrl(`voice-clips/${voiceFileName}`);
          
          audioUrl = urlData.publicUrl;
        }
      } catch (error) {
        console.error('TTS error:', error);
      }
    }

    // CRITICAL FIX: Clean ALL debug/fallback messages from user-facing responses
    let cleanMessage = aiResponse.content || 'Response generated';
    
    // Remove ALL fallback/debug patterns (case-insensitive, global)
    cleanMessage = cleanMessage.replace(/\[Using [^\]]+\]\s*/gi, '');
    cleanMessage = cleanMessage.replace(/\[Model:[^\]]+\]\s*/gi, '');
    cleanMessage = cleanMessage.replace(/\[Fallback:[^\]]+\]\s*/gi, '');
    cleanMessage = cleanMessage.replace(/google-gemini unavailable/gi, '');
    cleanMessage = cleanMessage.replace(/groq-llama/gi, '');
    cleanMessage = cleanMessage.replace(/claude unavailable/gi, '');
    cleanMessage = cleanMessage.replace(/openai unavailable/gi, '');
    cleanMessage = cleanMessage.trim();

    console.log('📤 Sending response:');
    console.log('  💭 Thinking mode:', thinkingMode);
    console.log('  🤖 Model used (HIDDEN FROM USER):', aiResponse.model || selectedModel);
    console.log('  📝 Message length:', cleanMessage.length || 0);
    console.log('  🖼️  Image URL (SERVER LOG ONLY):', imageUrl ? 'Yes' : 'No');
    console.log('  📄 File (SERVER LOG ONLY):', fileName || 'No');
    
    // FINAL CLEANUP: Ensure no debug info leaks
    if (cleanMessage.includes('[Using') || cleanMessage.includes('unavailable')) {
      console.warn('⚠️ WARNING: Debug text detected in response! Cleaning...');
      cleanMessage = cleanMessage.replace(/\[Using [^\]]+\]\s*/gi, '');
      cleanMessage = cleanMessage.replace(/unavailable/gi, '');
      cleanMessage = cleanMessage.trim();
    }
    
    return new Response(
      JSON.stringify({ 
        message: cleanMessage, 
        // REMOVED: Do not send model name to frontend
        // model: aiResponse.model || selectedModel,
        transcript: transcript || '',
        audioUrl: audioUrl || '',
        thinkingMode: thinkingMode,
        imageUrl: imageUrl || null,
        fileUrl: fileUrl || null,
        fileName: fileName || null,
        fileType: fileName ? fileName.split('.').pop() : null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    // CRITICAL: Log full error details for debugging
    console.error('❌ CHAT EDGE FUNCTION ERROR:', error);
    console.error('📋 Error stack:', error.stack);
    console.error('📋 Error name:', error.name);
    console.error('📋 Error message:', error.message);
    
    // CRITICAL: ALWAYS return JSON with CORS headers
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error occurred',
        type: error.name || 'UnknownError',
        timestamp: new Date().toISOString(),
      }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});
