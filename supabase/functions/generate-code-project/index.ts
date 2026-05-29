/**
 * PRODUCTION AI CODE GENERATION ENGINE
 * Primary: Kimi API (Moonshot)
 * Fallback 1: OnSpace AI
 * Fallback 2: OpenAI
 */

import { corsHeaders } from '../_shared/cors.ts';

// AI Provider Keys
const KIMI_API_KEY = Deno.env.get('MOONSHOT_API_KEY');
const KIMI_API_URL = 'https://api.moonshot.cn/v1';

const ONSPACE_AI_KEY = Deno.env.get('ONSPACE_AI_API_KEY');
const ONSPACE_AI_URL = Deno.env.get('ONSPACE_AI_BASE_URL') || 'https://api.onspace.ai';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const OPENAI_API_URL = 'https://api.openai.com/v1';

interface GenerationRequest {
  description: string;
  language: string;
  mode: 'demo' | 'real';
  aiMode: 'instant' | 'deep_thinking' | 'agent';
  images?: string[];
  userId?: string;
}

interface ProjectFile {
  path: string;
  content: string;
  language: string;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string; detail?: string } }>;
}

// Language-specific project templates
const PROJECT_STRUCTURES: Record<string, string[]> = {
  html: ['index.html', 'styles.css', 'script.js'],
  typescript: ['package.json', 'tsconfig.json', 'src/index.ts', 'src/types.ts'],
  javascript: ['package.json', 'src/index.js', 'src/utils.js'],
  python: ['main.py', 'requirements.txt', 'README.md'],
  php: ['index.php', 'config.php', 'composer.json'],
  java: ['Main.java', 'pom.xml'],
  node: ['package.json', 'server.js', '.env.example'],
  css: ['index.html', 'styles.css'],
  react: ['package.json', 'src/App.jsx', 'src/index.js', 'public/index.html'],
  vue: ['package.json', 'src/App.vue', 'src/main.js'],
};

// ==================== UTILITY FUNCTIONS (defined early) ====================

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isPreviewable(language: string): boolean {
  return ['html', 'css', 'javascript', 'typescript', 'react', 'vue'].includes(language);
}

function requiresProPlan(language: string): boolean {
  return ['react', 'vue', 'java'].includes(language);
}

function langToExt(lang: string): string {
  const map: Record<string, string> = {
    html: 'html', css: 'css', javascript: 'js', js: 'js',
    typescript: 'ts', ts: 'ts', python: 'py', php: 'php',
    java: 'java', json: 'json', bash: 'sh', shell: 'sh',
    markdown: 'md', sql: 'sql', vue: 'vue', jsx: 'jsx', tsx: 'tsx',
  };
  return map[lang] || 'txt';
}

function generatePlaceholderContent(filename: string, language: string): string {
  if (filename.endsWith('.json')) {
    return JSON.stringify({ name: 'generated-project', version: '1.0.0', description: 'AI-generated project' }, null, 2);
  }
  if (filename.endsWith('.md')) {
    return `# Generated Project\n\nAI-generated ${language} project.\n\n## Setup\n\nSee instructions below.`;
  }
  if (filename.endsWith('.env.example')) {
    return '# Copy this to .env and fill in your values\n# API_KEY=your_key_here\n';
  }
  if (filename.endsWith('requirements.txt')) {
    return '# Python dependencies\n# Add your requirements here\n';
  }
  return `# Generated: ${filename}\n# This file is part of the AI-generated project`;
}

// ==================== MAIN HANDLER ====================

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: GenerationRequest = await req.json();
    const { description, language, mode, aiMode, images, userId } = body;

    console.log(`🚀 Generating ${mode} ${language} project (${aiMode} mode) | Kimi-first strategy`);

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let isClosed = false;

        const send = (type: string, data: unknown) => {
          if (isClosed) return;
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, data })}\n\n`));
          } catch {
            isClosed = true;
          }
        };

        try {
          // Step 1: Analyze request
          send('log', '🔍 Analyzing project requirements...');
          await delay(400);

          // Step 2: Determine file structure
          const files = PROJECT_STRUCTURES[language] || PROJECT_STRUCTURES.javascript;
          send('log', `📁 Planning ${files.length}-file project structure...`);
          await delay(200);

          // Step 3: Build prompts
          const systemPrompt = buildSystemPrompt(language, mode, aiMode);
          const userPrompt = buildUserPrompt(description, language, files);

          // Step 4: Call AI with fallback chain
          send('log', '🤖 Connecting to Kimi AI...');
          let aiResponse = '';

          // ── Try Kimi first ──────────────────────────────────────────────
          try {
            aiResponse = await callKimiAI(systemPrompt, userPrompt, images, aiMode);
            send('log', '✅ Kimi AI responded');
          } catch (kimiErr: unknown) {
            const kimiError = kimiErr instanceof Error ? kimiErr : new Error(String(kimiErr));
            console.error('Kimi failed:', kimiError.message);
            send('log', '⚡ Switching to OnSpace AI...');

            // ── Try OnSpace AI second ───────────────────────────────────
            try {
              aiResponse = await callOnSpaceAI(systemPrompt, userPrompt, images);
              send('log', '✅ OnSpace AI responded');
            } catch (onspaceErr: unknown) {
              const onspaceError = onspaceErr instanceof Error ? onspaceErr : new Error(String(onspaceErr));
              console.error('OnSpace AI failed:', onspaceError.message);
              send('log', '⚡ Switching to OpenAI...');

              // ── Try OpenAI third ────────────────────────────────────────
              try {
                aiResponse = await callOpenAI(systemPrompt, userPrompt, images, aiMode);
                send('log', '✅ OpenAI responded');
              } catch (openaiErr: unknown) {
                const openaiError = openaiErr instanceof Error ? openaiErr : new Error(String(openaiErr));
                console.error('OpenAI also failed:', openaiError.message);
                throw new Error('All AI providers failed. Please try again.');
              }
            }
          }

          if (!aiResponse || aiResponse.trim().length < 50) {
            throw new Error('AI returned an empty response. Please try again.');
          }

          // Step 5: Parse and stream files
          send('log', '📝 Parsing generated files...');
          const generatedFiles = parseAIResponse(aiResponse, files, language);

          for (const file of generatedFiles) {
            send('log', `📄 Creating: ${file.path}`);
            await delay(150);
            send('file_created', file);
            await delay(80);
          }

          // Step 6: Detect and emit environment variables
          const envVars = detectEnvironmentVariables(aiResponse);
          if (Object.keys(envVars).length > 0) {
            send('log', '🔑 Detecting environment variables...');
            for (const [key, value] of Object.entries(envVars)) {
              send('env_var', { key, value });
              await delay(80);
            }
          }

          // Step 7: Generate instructions
          send('log', '📋 Generating setup guide...');
          const instructions = generateInstructions(language, generatedFiles, envVars);
          for (const instruction of instructions) {
            send('instruction', instruction);
            await delay(100);
          }

          send('log', '✅ Project generated successfully!');
          send('completed', {
            previewable: isPreviewable(language),
            requiresPro: requiresProPlan(language),
            filesCount: generatedFiles.length,
          });

          isClosed = true;
          controller.close();
        } catch (error: unknown) {
          const err = error instanceof Error ? error : new Error(String(error));
          console.error('Generation error:', err);
          send('error', err.message || 'Code generation failed. Please try again.');
          isClosed = true;
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('Request error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// ==================== KIMI AI (PRIMARY) ====================

async function callKimiAI(
  systemPrompt: string,
  userPrompt: string,
  images?: string[],
  aiMode?: string,
): Promise<string> {
  if (!KIMI_API_KEY) throw new Error('Kimi API key (MOONSHOT_API_KEY) not configured');

  // Select model based on aiMode
  const model = aiMode === 'deep_thinking'
    ? 'moonshot-v1-128k'
    : aiMode === 'agent'
    ? 'moonshot-v1-32k'
    : 'moonshot-v1-8k';

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
  ];

  // Build user content with image support
  let fullUserPrompt = userPrompt;
  if (images && images.length > 0) {
    fullUserPrompt += `\n\n[Note: ${images.length} image(s) provided by the user. Incorporate the design/content from these images into the generated code.]`;
  }

  messages.push({ role: 'user', content: fullUserPrompt });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 min timeout

  try {
    const response = await fetch(`${KIMI_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${KIMI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 16000,
        temperature: 0.3,
        top_p: 1,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Kimi API error ${response.status}: ${errText.slice(0, 300)}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('Kimi returned empty content');
    return content;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

// ==================== ONSPACE AI (FALLBACK 1) ====================

async function callOnSpaceAI(
  systemPrompt: string,
  userPrompt: string,
  images?: string[],
): Promise<string> {
  if (!ONSPACE_AI_KEY) throw new Error('OnSpace AI key not configured');

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  if (images && images.length > 0) {
    messages.push({
      role: 'user',
      content: `Analyze the provided ${images.length} image(s) and incorporate their design/content into the generated code.`,
    });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000);

  try {
    const response = await fetch(`${ONSPACE_AI_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ONSPACE_AI_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo',
        messages,
        max_tokens: 8000,
        temperature: 0.4,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OnSpace AI error ${response.status}: ${errText.slice(0, 300)}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('OnSpace AI returned empty content');
    return content;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

// ==================== OPENAI (FALLBACK 2) ====================

async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
  images?: string[],
  aiMode?: string,
): Promise<string> {
  if (!OPENAI_API_KEY) throw new Error('OpenAI API key not configured');

  const model = aiMode === 'deep_thinking' ? 'gpt-4o' : 'gpt-4o-mini';

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
  ];

  // Build vision-capable user message if images provided
  if (images && images.length > 0) {
    const content: Array<{ type: string; text?: string; image_url?: { url: string; detail: string } }> = [
      { type: 'text', text: userPrompt }
    ];
    for (const img of images.slice(0, 3)) {
      content.push({
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${img}`, detail: 'low' },
      });
    }
    messages.push({ role: 'user', content });
  } else {
    messages.push({ role: 'user', content: userPrompt });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000);

  try {
    const response = await fetch(`${OPENAI_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 8000,
        temperature: 0.4,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI error ${response.status}: ${errText.slice(0, 300)}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('OpenAI returned empty content');
    return content;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

// ==================== PROMPT ENGINEERING ====================

function buildSystemPrompt(language: string, mode: string, aiMode: string): string {
  const modeInstructions = mode === 'real'
    ? 'Generate REAL, FUNCTIONAL, PRODUCTION-READY code with NO placeholders, NO demo data, NO fake implementations. Every function must actually work.'
    : 'Generate a clean demo with clearly labeled simulated functionality.';

  const depthMap: Record<string, string> = {
    instant: 'Be concise and efficient. Focus on core functionality.',
    deep_thinking: 'Add comprehensive error handling, edge cases, accessibility, and full best practices. Write complete, deeply commented code.',
    agent: 'Apply research-backed architecture patterns, scalability considerations, full documentation, and production-grade code quality.',
  };

  return `You are an expert ${language} developer and software architect. Generate complete, production-ready code files.

${modeInstructions}

${depthMap[aiMode] || depthMap.instant}

ABSOLUTE RULES — NEVER BREAK THESE:
1. Generate COMPLETE files — NO truncation, NO "// ... rest of code", NO placeholders
2. Include ALL imports, ALL functions, ALL logic — nothing omitted
3. Use modern best practices for ${language}
4. Add meaningful inline comments for complex logic
5. Code must be immediately runnable without modifications
6. Handle errors gracefully with try/catch
7. Use environment variables for ALL secrets/API keys
8. Write clean, readable, well-structured code

RESPONSE FORMAT — use EXACTLY this pattern for each file:
FILE: path/to/file.ext
\`\`\`language
[COMPLETE, FULLY FUNCTIONAL FILE CONTENT HERE]
\`\`\`

For environment variables needed:
ENV: VARIABLE_NAME=description of what to put here`;
}

function buildUserPrompt(description: string, language: string, files: string[]): string {
  return `Build a complete, production-ready ${language} project:

PROJECT REQUIREMENTS:
${description}

GENERATE THESE FILES (provide FULL content for every file — no omissions):
${files.map((f, i) => `${i + 1}. ${f}`).join('\n')}

Requirements:
- Every file must be complete and immediately usable
- No placeholder comments or TODO stubs (unless genuinely needed for user to fill in API keys)
- Include real logic, real UI, real functionality
- Make it impressive and professional`;
}

// ==================== RESPONSE PARSING ====================

function parseAIResponse(response: string, expectedFiles: string[], language: string): ProjectFile[] {
  const files: ProjectFile[] = [];

  // Match FILE: path\n\`\`\`lang\ncontent\n\`\`\` blocks
  const fileRegex = /FILE:\s*(.+?)\s*\n\`\`\`(\w*)\n?([\s\S]+?)\`\`\`/g;
  let match;

  while ((match = fileRegex.exec(response)) !== null) {
    const [, path, lang, content] = match;
    if (path && content) {
      files.push({
        path: path.trim(),
        content: content.trim(),
        language: lang?.trim() || language,
      });
    }
  }

  // Fallback: try to detect fenced blocks without FILE: header
  if (files.length === 0) {
    const fenceRegex = /\`\`\`(\w+)\n([\s\S]+?)\`\`\`/g;
    let idx = 0;
    while ((match = fenceRegex.exec(response)) !== null) {
      const lang = match[1]?.toLowerCase() || language;
      const content = match[2]?.trim();
      if (content && content.length > 20) {
        const ext = langToExt(lang);
        const filePath = expectedFiles[idx] || `file${idx}.${ext}`;
        files.push({ path: filePath, content, language: lang });
        idx++;
      }
    }
  }

  // Ensure all expected files have at least a placeholder
  for (const expectedFile of expectedFiles) {
    if (!files.find(f => f.path === expectedFile)) {
      files.push({
        path: expectedFile,
        content: generatePlaceholderContent(expectedFile, language),
        language,
      });
    }
  }

  return files;
}

// ==================== ENVIRONMENT VARIABLES ====================

function detectEnvironmentVariables(response: string): Record<string, string> {
  const envVars: Record<string, string> = {};

  const envRegex = /ENV:\s*(\w+)=(.+)/g;
  let match;
  while ((match = envRegex.exec(response)) !== null) {
    const [, key, description] = match;
    envVars[key.trim()] = description.trim();
  }

  // Auto-detect common patterns in code
  if (/OPENAI_API_KEY|openai\.com/.test(response) && !envVars.OPENAI_API_KEY) {
    envVars.OPENAI_API_KEY = 'Your OpenAI API key from platform.openai.com';
  }
  if (/STRIPE_SECRET|stripe\.com/.test(response) && !envVars.STRIPE_SECRET_KEY) {
    envVars.STRIPE_SECRET_KEY = 'Your Stripe secret key from dashboard.stripe.com';
  }
  if (/DATABASE_URL|postgres|mysql/.test(response) && !envVars.DATABASE_URL) {
    envVars.DATABASE_URL = 'Your database connection string';
  }
  if (/KIMI|moonshot/.test(response) && !envVars.MOONSHOT_API_KEY) {
    envVars.MOONSHOT_API_KEY = 'Your Kimi API key from platform.moonshot.cn';
  }

  return envVars;
}

// ==================== SETUP INSTRUCTIONS ====================

function generateInstructions(language: string, files: ProjectFile[], envVars: Record<string, string>): string[] {
  const instructions: string[] = [];

  const hasEnv = Object.keys(envVars).length > 0;

  switch (language) {
    case 'typescript':
    case 'javascript':
    case 'node':
    case 'react':
    case 'vue':
      instructions.push('\`\`\`bash\nnpm install\n\`\`\`');
      if (hasEnv) instructions.push('Create a `.env` file with the variables listed below, then run:');
      instructions.push(language === 'typescript' ? '\`\`\`bash\nnpm run dev\n\`\`\`' : '\`\`\`bash\nnode src/index.js\n\`\`\`');
      break;
    case 'python':
      instructions.push('\`\`\`bash\npip install -r requirements.txt\n\`\`\`');
      if (hasEnv) instructions.push('Set the environment variables in a `.env` file, then:');
      instructions.push('\`\`\`bash\npython main.py\n\`\`\`');
      break;
    case 'php':
      instructions.push('\`\`\`bash\ncomposer install\n\`\`\`');
      instructions.push('\`\`\`bash\nphp -S localhost:8000\n\`\`\`');
      break;
    case 'java':
      instructions.push('\`\`\`bash\nmvn install && mvn exec:java\n\`\`\`');
      break;
    case 'html':
    case 'css':
      instructions.push('Open `index.html` in your browser — no build step required!');
      break;
    default:
      instructions.push(`Run the main entry file for ${language}.`);
  }

  if (hasEnv) {
    instructions.push('\n**Required environment variables:**');
    for (const [key, desc] of Object.entries(envVars)) {
      instructions.push(`- \`${key}\` — ${desc}`);
    }
  }

  return instructions;
}
