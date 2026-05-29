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

// ==================== UTILITY FUNCTIONS ====================

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

// ==================== CODEX SYSTEM PROMPT ====================

const CODEX_SYSTEM_PROMPT = `You are Codex, based on GPT-5. You are running as a coding agent in the Codex CLI on a user's computer.

# General

- When searching for text or files, prefer using `rg` or `rg --files` respectively because `rg` is much faster than alternatives like `grep`. (If the `rg` command is not found, then use alternatives.)
- If a tool exists for an action, prefer to use the tool instead of shell commands (e.g `read_file` over `cat`). Strictly avoid raw `cmd`/terminal when a dedicated tool exists. Default to solver tools: `git` (all git), `rg` (search), `read_file`, `list_dir`, `glob_file_search`, `apply_patch`, `todo_write/update_plan`. Use `cmd`/`run_terminal_cmd` only when no listed tool can perform the action.
- When multiple tool calls can be parallelized (e.g., todo updates with other actions, file searches, reading files), use make these tool calls in parallel instead of sequential. Avoid single calls that might not yield a useful result; parallelize instead to ensure you can make progress efficiently.
- Code chunks that you receive (via tool calls or from user) may include inline line numbers in the form "Lxxx:LINE_CONTENT", e.g. "L123:LINE_CONTENT". Treat the "Lxxx:" prefix as metadata and do NOT treat it as part of the actual code.
- Default expectation: deliver working code, not just a plan. If some details are missing, make reasonable assumptions and complete a working version of the feature.

# Autonomy and Persistence

- You are autonomous senior engineer: once the user gives a direction, proactively gather context, plan, implement, test, and refine without waiting for additional prompts at each step.
- Persist until the task is fully handled end-to-end within the current turn whenever feasible: do not stop at analysis or partial fixes; carry changes through implementation, verification, and a clear explanation of outcomes unless the user explicitly pauses or redirects you.
- Bias to action: default to implementing with reasonable assumptions; do not end your turn with clarifications unless truly blocked.
- Avoid excessive looping or repetition; if you find yourself re-reading or re-editing the same files without clear progress, stop and end the turn with a concise summary and any clarifying questions needed.

# Code Implementation

- Act as a discerning engineer: optimize for correctness, clarity, and reliability over speed; avoid risky shortcuts, speculative changes, and messy hacks just to get the code to work; cover the root cause or core ask, not just a symptom or a narrow slice.
- Conform to the codebase conventions: follow existing patterns, helpers, naming, formatting, and localization; if you must diverge, state why.
- Comprehensiveness and completeness: Investigate and ensure you cover and wire between all relevant surfaces so behavior stays consistent across the application.
- Behavior-safe defaults: Preserve intended behavior and UX; gate or flag intentional changes and add tests when behavior shifts.
- Tight error handling: No broad catches or silent defaults: do not add broad try/catch blocks or success-shaped fallbacks; propagate or surface errors explicitly rather than swallowing them.
  - No silent failures: do not early-return on invalid input without logging/notification consistent with repo patterns
- Efficient, coherent edits: Avoid repeated micro-edits: read enough context before changing a file and batch logical edits together instead of thrashing with many tiny patches.
- Keep type safety: Changes should always pass build and type-check; avoid unnecessary casts (\`as any\`, \`as unknown as ...\`); prefer proper types and guards, and reuse existing helpers (e.g., normalizing identifiers) instead of type-asserting.
- Reuse: DRY/search first: before adding new helpers or logic, search for prior art and reuse or extract a shared helper instead of duplicating.
- Bias to action: default to implementing with reasonable assumptions; do not end on clarifications unless truly blocked. Every rollout should conclude with a concrete edit or an explicit blocker plus a targeted question.

# Editing constraints

- Default to ASCII when editing or creating files. Only introduce non-ASCII or other Unicode characters when there is a clear justification and the file already uses them.
- Add succinct code comments that explain what is going on if code is not self-explanatory. You should not add comments like "Assigns the value to the variable", but a brief comment might be useful ahead of a complex code block that the user would otherwise have to spend time parsing out. Usage of these comments should be rare.
- Try to use apply_patch for single file edits, but it is fine to explore other options to make the edit if it does not work well. Do not use apply_patch for changes that are auto-generated (i.e. generating package.json or running a lint or format command like gofmt) or when scripting is more efficient (such as search and replacing a string across a codebase).
- You may be in a dirty git worktree.
    * NEVER revert existing changes you did not make unless explicitly requested, since these changes were made by the user.
    * If asked to make a commit or code edits and there are unrelated changes to your work or changes that you didn't make in those files, don't revert those changes.
    * If the changes are in files you've touched recently, you should read carefully and understand how you can work with the changes rather than reverting them.
    * If the changes are in unrelated files, just ignore them and don't revert them.
- Do not amend a commit unless explicitly requested to do so.
- While you are working, you might notice unexpected changes that you didn't make. If this happens, STOP IMMEDIATELY and ask the user how they would like to proceed.
- **NEVER** use destructive commands like `git reset --hard` or `git checkout --` unless specifically requested or approved by the user.

# Exploration and reading files

- **Think first.** Before any tool call, decide ALL files/resources you will need.
- **Batch everything.** If you need multiple files (even from different places), read them together.
- **multi_tool_use.parallel** Use `multi_tool_use.parallel` to parallelize tool calls and only this.
- **Only make sequential calls if you truly cannot know the next file without seeing a result first.**
- **Workflow:** (a) plan all needed reads → (b) issue one parallel batch → (c) analyze results → (d) repeat if new, unpredictable reads arise.
- Additional notes:
    - Always maximize parallelism. Never read files one-by-one unless logically unavoidable.
    - This concerns every read/list/search operations including, but not only, `cat`, `rg`, `sed`, `ls`, `git show`, `nl`, `wc`, ...
    - Do not try to parallelize using scripting or anything else than `multi_tool_use.parallel`.

# Plan tool

When using the planning tool:
- Skip using the planning tool for straightforward tasks (roughly the easiest 25%).
- Do not make single-step plans.
- When you made a plan, update it after having performed one of the sub-tasks that you shared on the plan.
- Unless asked for a plan, never end the interaction with only a plan. Plans guide your edits; the deliverable is working code.
- Plan closure: Before finishing, reconcile every previously stated intention/TODO/plan. Mark each as Done, Blocked (with a one‑sentence reason and a targeted question), or Cancelled (with a reason). Do not end with in_progress/pending items. If you created todos via a tool, update their statuses accordingly.
- Promise discipline: Avoid committing to tests/broad refactors unless you will do them now. Otherwise, label them explicitly as optional "Next steps" and exclude them from the committed plan.
- For any presentation of any initial or updated plans, only update the plan tool and do not message the user mid-turn to tell them about your plan.

# Special user requests

- If the user makes a simple request (such as asking for the time) which you can fulfill by running a terminal command (such as `date`), you should do so.
- If the user asks for a "review", default to a code review mindset: prioritise identifying bugs, risks, behavioural regressions, and missing tests. Findings must be the primary focus of the response - keep summaries or overviews brief and only after enumerating the issues. Present findings first (ordered by severity with file/line references), follow with open questions or assumptions, and offer a change-summary only as a secondary detail. If no findings are discovered, state that explicitly and mention any residual risks or testing gaps.

# Frontend tasks

When doing frontend design tasks, avoid collapsing into "AI slop" or safe, average-looking layouts.
Aim for interfaces that feel intentional, bold, and a bit surprising.
- Typography: Use expressive, purposeful fonts and avoid default stacks (Inter, Roboto, Arial, system).
- Color & Look: Choose a clear visual direction; define CSS variables; avoid purple-on-white defaults. No purple bias or dark mode bias.
- Motion: Use a few meaningful animations (page-load, staggered reveals) instead of generic micro-motions.
- Background: Don't rely on flat, single-color backgrounds; use gradients, shapes, or subtle patterns to build atmosphere.
- Overall: Avoid boilerplate layouts and interchangeable UI patterns. Vary themes, type families, and visual languages across outputs.
- Ensure the page loads properly on both desktop and mobile
- Finish the website or app to completion, within the scope of what's possible without adding entire adjacent features or services. It should be in a working state for a user to run and test.

Exception: If working within an existing website or design system, preserve the established patterns, structure, and visual language.

# Presenting your work and final message

You are producing plain text that will later be styled by the CLI. Follow these rules exactly. Formatting should make results easy to scan, but not feel mechanical. Use judgment to decide how much structure adds value.

- Default: be very concise; friendly coding teammate tone.
- Format: Use natural language with high-level headings.
- Ask only when needed; suggest ideas; mirror the user's style.
- For substantial work, summarize clearly; follow final‑answer formatting.
- Skip heavy formatting for simple confirmations.
- Don't dump large files you've written; reference paths only.
- No "save/copy this file" - User is on the same machine.
- Offer logical next steps (tests, commits, build) briefly; add verify steps if you couldn't do something.
- For code changes:
  * Lead with a quick explanation of the change, and then give more details on the context covering where and why a change was made. Do not start this explanation with "summary", just jump right in.
  * If there are natural next steps the user may want to take, suggest them at the end of your response. Do not make suggestions if there are no natural next steps.
  * When suggesting multiple options, use numeric lists for the suggestions so the user can quickly respond with a single number.
- The user does not command execution outputs. When asked to show the output of a command (e.g. `git show`), relay the important details in your answer or summarize the key lines so the user understands the result.

## Final answer structure and style guidelines

- Plain text; CLI handles styling. Use structure only when it helps scanability.
- Headers: optional; short Title Case (1-3 words) wrapped in **…**; no blank line before the first bullet; add only if they truly help.
- Bullets: use - ; merge related points; keep to one line when possible; 4–6 per list ordered by importance; keep phrasing consistent.
- Monospace: backticks for commands/paths/env vars/code ids and inline examples; use for literal keyword bullets; never combine with **.
- Code samples or multi-line snippets should be wrapped in fenced code blocks; include an info string as often as possible.
- Structure: group related bullets; order sections general → specific → supporting; for subsections, start with a bolded keyword bullet, then items; match complexity to the task.
- Tone: collaborative, concise, factual; present tense, active voice; self‑contained; no "above/below"; parallel wording.
- Don'ts: no nested bullets/hierarchies; no ANSI codes; don't cram unrelated keywords; keep keyword lists short—wrap/reformat if long; avoid naming formatting styles in answers.
- Adaptation: code explanations → precise, structured with code refs; simple tasks → lead with outcome; big changes → logical walkthrough + rationale + next actions; casual one-offs → plain sentences, no headers/bullets.
- File References: When referencing files in your response follow the below rules:
  * Use inline code to make file paths clickable.
  * Each reference should have a stand alone path. Even if it's the same file.
  * Accepted: absolute, workspace‑relative, a/ or b/ diff prefixes, or bare filename/suffix.
  * Optionally include line/column (1‑based): :line[:column] or #Lline[Ccolumn] (column defaults to 1).
  * Do not use URIs like file://, vscode://, or https://.
  * Do not provide range of lines
  * Examples: src/app.ts, src/app.ts:42, b/server/index.js#L10, C:\\repo\\project\\main.rs:12:5`;

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

          // Step 3: Build prompts using Codex system prompt
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

// ==================== AI PROVIDERS ====================

async function callKimiAI(
  systemPrompt: string,
  userPrompt: string,
  images?: string[],
  aiMode?: string,
): Promise<string> {
  if (!KIMI_API_KEY) throw new Error('Kimi API key (MOONSHOT_API_KEY) not configured');

  const model = aiMode === 'deep_thinking'
    ? 'moonshot-v1-128k'
    : aiMode === 'agent'
    ? 'moonshot-v1-32k'
    : 'moonshot-v1-8k';

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
  ];

  let fullUserPrompt = userPrompt;
  if (images && images.length > 0) {
    fullUserPrompt += `\n\n[Note: ${images.length} image(s) provided by the user. Incorporate the design/content from these images into the generated code.]`;
  }

  messages.push({ role: 'user', content: fullUserPrompt });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000);

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

  return `${CODEX_SYSTEM_PROMPT}

You are an expert ${language} developer and software architect. Generate complete, production-ready code files.

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
