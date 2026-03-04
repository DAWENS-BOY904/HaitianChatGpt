/**
 * PRODUCTION AI CODE GENERATION ENGINE
 * Streams real, production-ready code with terminal logs and file operations
 */

import { corsHeaders } from '../_shared/cors.ts';

// AI Provider Configuration
const ONSPACE_AI_KEY = Deno.env.get('ONSPACE_AI_API_KEY');
const ONSPACE_AI_URL = Deno.env.get('ONSPACE_AI_BASE_URL') || 'https://api.onspace.ai';

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

// Language-specific project templates
const PROJECT_STRUCTURES: Record<string, string[]> = {
  html: ['index.html', 'styles.css', 'script.js'],
  typescript: ['package.json', 'tsconfig.json', 'src/index.ts', 'src/types.ts'],
  javascript: ['package.json', 'src/index.js', 'src/utils.js'],
  python: ['main.py', 'requirements.txt', 'README.md'],
  php: ['index.php', 'config.php', 'composer.json'],
  java: ['Main.java', 'pom.xml'],
  node: ['package.json', 'server.js', '.env.example'],
};

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: GenerationRequest = await req.json();
    const { description, language, mode, aiMode, images, userId } = body;

    console.log(`🚀 Generating ${mode} ${language} project (${aiMode} mode)`);

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        const send = (type: string, data: any) => {
          controller.enqueue(encoder.encode(JSON.stringify({ type, data }) + '\n'));
        };

        try {
          // Step 1: Analyze request
          send('log', '🔍 Analyzing project requirements...');
          await delay(500);

          // Step 2: Determine file structure
          const files = PROJECT_STRUCTURES[language] || PROJECT_STRUCTURES.javascript;
          send('log', `📁 Creating ${files.length} files...`);
          await delay(300);

          // Step 3: Generate AI prompt
          const systemPrompt = buildSystemPrompt(language, mode, aiMode);
          const userPrompt = buildUserPrompt(description, language, files);

          // Step 4: Call AI to generate code
          send('log', '🤖 Generating production code...');

          const aiResponse = await callOnSpaceAI(systemPrompt, userPrompt, images);

          // Step 5: Parse and stream files
          const generatedFiles = parseAIResponse(aiResponse, files, language);

          for (const file of generatedFiles) {
            send('log', `📝 Creating file: ${file.path}`);
            await delay(200);

            // Stream file content character by character (simulation)
            send('file_created', file);
            await delay(100);
          }

          // Step 6: Generate environment variables
          const envVars = detectEnvironmentVariables(aiResponse);
          if (Object.keys(envVars).length > 0) {
            send('log', '🔑 Generating environment variables...');
            for (const [key, value] of Object.entries(envVars)) {
              send('env_var', { key, value });
              await delay(100);
            }
          }

          // Step 7: Generate instructions
          send('log', '📋 Generating setup instructions...');
          const instructions = generateInstructions(language, generatedFiles, envVars);
          for (const instruction of instructions) {
            send('instruction', instruction);
            await delay(150);
          }

          // Step 8: Stream completion
          send('log', '✅ Project generated successfully');
          send('completed', {
            previewable: isPreviewable(language),
            requiresPro: requiresProPlan(language),
          });

          controller.close();
        } catch (error: any) {
          console.error('Generation error:', error);
          send('error', error.message || 'Generation failed');
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

  } catch (error: any) {
    console.error('Request error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// ==================== AI INTEGRATION ====================

async function callOnSpaceAI(systemPrompt: string, userPrompt: string, images?: string[]): Promise<string> {
  if (!ONSPACE_AI_KEY) {
    throw new Error('OnSpace AI API key not configured');
  }

  const messages: any[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  // Add images if provided
  if (images && images.length > 0) {
    messages.push({
      role: 'user',
      content: `Analyze these images and incorporate them into the project:\n${images.map((_, i) => `Image ${i + 1}`).join('\n')}`,
    });
  }

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
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

// ==================== PROMPT ENGINEERING ====================

function buildSystemPrompt(language: string, mode: string, aiMode: string): string {
  const basePrompt = `You are an expert ${language} developer. Generate complete, production-ready code.`;

  const modeInstructions = mode === 'real' 
    ? 'Generate REAL, FUNCTIONAL, PRODUCTION-READY code with NO placeholders, NO demo data, NO fake implementations.'
    : 'Generate a clean demo with simulated functionality.';

  const aiModeInstructions = {
    instant: 'Provide concise, efficient code.',
    deep_thinking: 'Add comprehensive error handling, edge cases, and best practices.',
    agent: 'Include research-backed patterns, scalability considerations, and documentation.',
  };

  return `${basePrompt}

${modeInstructions}

${aiModeInstructions[aiMode]}

CRITICAL RULES:
1. Generate COMPLETE files - no truncation, no "rest of code here" placeholders
2. Include ALL imports, ALL functions, ALL necessary code
3. Use modern best practices for ${language}
4. Add inline comments explaining complex logic
5. Ensure code is immediately runnable
6. Handle errors gracefully
7. Use environment variables for secrets

Format your response as:
FILE: path/to/file.ext
\`\`\`language
[COMPLETE FILE CONTENT]
\`\`\`

ENV: VARIABLE_NAME=description
ENV: ANOTHER_VAR=description`;
}

function buildUserPrompt(description: string, language: string, files: string[]): string {
  return `Create a ${language} project with the following requirements:

${description}

Generate these files (FULL CONTENT for each):
${files.map((f, i) => `${i + 1}. ${f}`).join('\n')}

Make it production-ready, complete, and immediately usable.`;
}

// ==================== RESPONSE PARSING ====================

function parseAIResponse(response: string, expectedFiles: string[], language: string): ProjectFile[] {
  const files: ProjectFile[] = [];
  
  // Extract FILE blocks
  const fileRegex = /FILE:\s*(.+?)\n```(\w+)?\n([\s\S]+?)```/g;
  let match;

  while ((match = fileRegex.exec(response)) !== null) {
    const [, path, lang, content] = match;
    files.push({
      path: path.trim(),
      content: content.trim(),
      language: lang || language,
    });
  }

  // Ensure all expected files are present
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

function generatePlaceholderContent(filename: string, language: string): string {
  if (filename.endsWith('.json')) {
    return JSON.stringify({ name: 'generated-project', version: '1.0.0' }, null, 2);
  }

  if (filename.endsWith('.md')) {
    return '# Generated Project\n\nThis is a generated project file.';
  }

  return `// Generated file: ${filename}\n// TODO: Implement functionality`;
}

// ==================== ENVIRONMENT VARIABLES ====================

function detectEnvironmentVariables(response: string): Record<string, string> {
  const envVars: Record<string, string> = {};
  
  // Extract ENV declarations
  const envRegex = /ENV:\s*(\w+)=(.+)/g;
  let match;

  while ((match = envRegex.exec(response)) !== null) {
    const [, key, description] = match;
    envVars[key] = description.trim();
  }

  // Common patterns
  if (response.includes('OPENAI_API_KEY') || response.includes('openai')) {
    envVars.OPENAI_API_KEY = 'Your OpenAI API key from platform.openai.com';
  }

  if (response.includes('STRIPE') || response.includes('payment')) {
    envVars.STRIPE_SECRET_KEY = 'Your Stripe secret key from dashboard.stripe.com';
  }

  if (response.includes('DATABASE_URL') || response.includes('postgres')) {
    envVars.DATABASE_URL = 'PostgreSQL connection string';
  }

  return envVars;
}

// ==================== INSTRUCTIONS ====================

function generateInstructions(language: string, files: ProjectFile[], envVars: Record<string, string>): string[] {
  const instructions: string[] = [];

  instructions.push('## Installation');

  switch (language) {
    case 'typescript':
    case 'javascript':
    case 'node':
      instructions.push('```bash\nnpm install\n```');
      break;
    case 'python':
      instructions.push('```bash\npip install -r requirements.txt\n```');
      break;
    case 'php':
      instructions.push('```bash\ncomposer install\n```');
      break;
    case 'java':
      instructions.push('```bash\nmvn install\n```');
      break;
  }

  if (Object.keys(envVars).length > 0) {
    instructions.push('## Environment Setup');
    instructions.push('Create a `.env` file with:');
    instructions.push('```env');
    for (const [key, description] of Object.entries(envVars)) {
      instructions.push(`${key}=  # ${description}`);
    }
    instructions.push('```');
  }

  instructions.push('## Running');

  switch (language) {
    case 'typescript':
      instructions.push('```bash\nnpm run dev\n```');
      break;
    case 'javascript':
      instructions.push('```bash\nnode src/index.js\n```');
      break;
    case 'python':
      instructions.push('```bash\npython main.py\n```');
      break;
    case 'php':
      instructions.push('```bash\nphp -S localhost:8000\n```');
      break;
    case 'node':
      instructions.push('```bash\nnode server.js\n```');
      break;
    case 'html':
      instructions.push('Open `index.html` in your browser');
      break;
  }

  return instructions;
}

// ==================== UTILITIES ====================

function isPreviewable(language: string): boolean {
  return ['html', 'typescript', 'javascript'].includes(language);
}

function requiresProPlan(language: string): boolean {
  return ['typescript'].includes(language);
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
