// AI Provider Service - Handles all AI model integrations

interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  image_url?: string;
}

interface AIResponse {
  content: string;
  model: string;
  error?: string;
}

/**
 * OpenAI GPT-4 Integration
 * Best for: Complex reasoning, long conversations, detailed analysis
 */
/**
 * AI Provider Service - Optimized and Fixed
 */

// 1. Ranje callOpenAI (URL ak Endpoint)
export async function callOpenAI(messages: AIMessage[]): Promise<AIResponse> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) return { content: '', model: 'openai-gpt4', error: 'OpenAI API key not configured' };

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', { // FIXED URL
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    if (!response.ok) return { content: '', model: 'openai-gpt4', error: data.error?.message || 'OpenAI Error' };

    return { content: data.choices[0].message.content, model: 'openai-gpt4' };
  } catch (error: any) {
    return { content: '', model: 'openai-gpt4', error: error.message };
  }
}

/**
 * Google Gemini Integration (with dynamic model selection)
 * Best for: Fast responses, multimodal tasks, general queries
 * Available models:
 * - gemini-2.0-flash (latest, fastest, multimodal - RECOMMENDED)
 * - gemini-1.5-flash (fast, efficient, stable)
 * - gemini-1.5-pro (more capable, slower, more expensive)
 */
export async function callGemini(messages: AIMessage[], modelName: string = 'gemini-2.0-flash'): Promise<AIResponse> {
  const apiKey = Deno.env.get('GOOGLE_AI_API_KEY');
  
  if (!apiKey) {
    return { content: '', model: 'google-gemini', error: 'Google AI API key not configured' };
  }

  try {
    // 1. Prepare the request body
    const requestBody: any = {
      contents: messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
    };

    // 2. Add system instruction correctly (not as a user message)
    const systemMessage = messages.find(m => m.role === 'system');
    if (systemMessage) {
      requestBody.system_instruction = {
        parts: [{ text: systemMessage.content }]
      };
    }

    console.log(`🔷 Using Gemini model: ${modelName}`);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }
    );

    // 3. Handle HTTP errors
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error?.message || response.statusText;
      console.error('Gemini API error:', errorMsg);
      return { content: '', model: 'google-gemini', error: `Gemini error: ${errorMsg}` };
    }

    const data = await response.json();

    // 4. Validate and extract content
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!content) {
      const finishReason = data.candidates?.[0]?.finishReason;
      return { 
        content: '', 
        model: 'google-gemini', 
        error: finishReason ? `Blocked by safety: ${finishReason}` : 'Empty response from Gemini' 
      };
    }

    return {
      content: content,
      model: `google-gemini (${modelName})`,
    };

  } catch (error: any) {
    console.error('Gemini Fetch Error:', error);
    return { content: '', model: 'google-gemini', error: error.message || 'Unknown error' };
  }
}

/**
 * Claude 3.5 Sonnet Integration
 * Optimizations: Type safety, error handling, and message validation.
 */

// Define internal types for the Anthropic API response
interface AnthropicResponse {
  content: Array<{ text: string; type: string }>;
  error?: { message: string };
}

export async function callClaude(messages: AIMessage[]): Promise<AIResponse> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  
  if (!apiKey) {
    return { content: '', model: 'claude-3-5', error: 'Anthropic API key is missing' };
  }

  try {
    const systemMessage = messages.find(m => m.role === 'system')?.content;
    const conversationMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
        content: m.content || '',
      }));

    // Ensure we don't send an empty message array
    if (conversationMessages.length === 0) {
      return { content: '', model: 'claude-3-5', error: 'No user messages provided' };
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-latest',
        max_tokens: 4000,
        system: systemMessage,
        messages: conversationMessages,
      }),
    });

    const data: AnthropicResponse = await response.json();

    if (!response.ok) {
      return { 
        content: '', 
        model: 'claude-3-5', 
        error: data.error?.message || `Anthropic API error: ${response.status}` 
      };
    }

    // Claude returns content as an array; ensure the text block exists
    const textContent = data.content.find(c => c.type === 'text')?.text;

    if (!textContent) {
      return { content: '', model: 'claude-3-5', error: 'Empty response from Claude' };
    }

    return { content: textContent, model: 'claude-3-5' };

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown network error';
    return { content: '', model: 'claude-3-5', error: errorMessage };
  }
}

/**
 * Groq Llama Integration (2026 Optimized)
 * Best for: Sub-second latency, real-time agentic workflows.
 */

// Define the response shape for better TS support
interface GroqChatResponse {
  choices: Array<{
    message: { content: string };
    finish_reason: string;
  }>;
  usage?: { total_tokens: number };
}

export async function callGroq(messages: AIMessage[]): Promise<AIResponse> {
  const apiKey = Deno.env.get('GROQ_API_KEY');
  if (!apiKey) {
    return { content: '', model: 'groq-llama-4', error: 'Missing GROQ_API_KEY' };
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // llama-4-maverick is the 2026 flagship for speed/intelligence balance
        model: 'llama-3.3-70b-versatile', 
        messages: messages.map(m => ({
          role: m.role,
          content: m.content || '',
        })),
        temperature: 0.6, // Slightly lower for better consistency in fast chat
        max_completion_tokens: 4000, // Updated from deprecated 'max_tokens'
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { 
        content: '', 
        model: 'groq-llama-4', 
        error: errorData.error?.message || `HTTP ${response.status}` 
      };
    }

    const data: GroqChatResponse = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return { content: '', model: 'groq-llama-4', error: 'Groq returned an empty choice.' };
    }

    return { content, model: 'groq-llama-4' };

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown Groq Error';
    return { content: '', model: 'groq-llama-4', error: msg };
  }
}

/**
 * Mistral Large 24.11 / Codestral Integration
 * Features: Automatic retries, safe parsing, and intelligent fallbacks.
 */

interface MistralChoice {
  message: { content: string };
  finish_reason: string;
}

export async function callMistral(messages: AIMessage[]): Promise<AIResponse> {
  const apiKey = Deno.env.get('MISTRAL_API_KEY');
  
  // High-intelligence Fallback Logic
  if (!apiKey) {
    console.warn('⚠️ Mistral API key missing. Redirecting to OpenAI...');
    // Ensure callOpenAI is imported or defined in scope
    return typeof callOpenAI === 'function' 
      ? await callOpenAI(messages) 
      : { content: '', model: 'mistral-fallback', error: 'No API provider available' };
  }

  const executeRequest = async (retries = 2): Promise<AIResponse> => {
    try {
      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          // 'mistral-large-latest' points to the most capable reasoning model
          model: 'mistral-large-latest', 
          messages: messages.map(m => ({
            role: m.role,
            content: m.content || '',
          })),
          temperature: 0.2, // Lowered for technical accuracy
          max_tokens: 4000,
          safe_prompt: false, // Set to true if building a public-facing wrapper
        }),
      });

      // Handle Rate Limiting (429) with exponential backoff
      if (response.status === 429 && retries > 0) {
        const wait = Math.pow(2, 3 - retries) * 1000;
        await new Promise(res => setTimeout(res, wait));
        return executeRequest(retries - 1);
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown Mistral Error' }));
        return { 
          content: '', 
          model: 'mistral-large', 
          error: errorData.error?.message || `HTTP ${response.status}` 
        };
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('Mistral returned an empty response body');
      }

      return {
        content: content.trim(),
        model: 'mistral-large',
      };

    } catch (error: any) {
      if (retries > 0) return executeRequest(retries - 1);
      return { 
        content: '', 
        model: 'mistral-large', 
        error: error.message || 'Connection to Mistral failed' 
      };
    }
  };

  return executeRequest();
}

/**
 * DEPRECATED: OnSpace AI is no longer used
 * The app now uses only your own API keys (OpenAI, Gemini, etc.)
 */
async function callOnSpaceAI(messages: AIMessage[], modelHint: string): Promise<AIResponse> {
  // This function is no longer used - fallback to OpenAI
  console.log('⚠️ OnSpace AI called but deprecated - using OpenAI instead');
  return await callOpenAI(messages);
}

/**
 * Available AI Models - 2026 Optimized
 * Mapped to industry-leading model IDs for specialized workflows.
 */
export const AI_MODELS = {
  // --- IMAGE & DESIGN (DALL-E 4 + Imagen 4) ---
  'image-generator': {
    name: 'Image Generator',
    model: 'dalle-4', // Next-gen fidelity and text rendering
    specialization: 'image',
    description: 'Hyper-realistic imagery and complex scene generation via DALL-E 4'
  },
  'logo-designer': {
    name: 'Logo Designer',
    model: 'imagen-4.0-ultra', // Best for vector-like clarity and typography
    specialization: 'image',
    description: 'Precision brand assets and professional logo typography'
  },

  // --- CODE & TECHNICAL (GPT-5 & Claude Opus 4) ---
  'code-generator': {
    name: 'Code Generator',
    model: 'gpt-5.2-codex', // OpenAI's flagship for long-horizon agentic coding
    specialization: 'code',
    description: 'Senior-level code generation with full project context'
  },
  'code-debugger': {
    name: 'Code Debugger',
    model: 'claude-opus-4.6', // Anthropic's highest reasoning for finding logical edge cases
    specialization: 'debug',
    description: 'Deep logic analysis and multi-file debugging'
  },
  'ui-designer': {
    name: 'UI/UX Designer',
    model: 'claude-sonnet-4.5', // Fast artifacts and better CSS/Frontend spatial reasoning
    specialization: 'ui',
    description: 'High-fidelity UI components and design system architecture'
  },

  // --- DATA & PERFORMANCE (Gemini 3 + Groq) ---
  'file-creator': {
    name: 'File Creator',
    model: 'gemini-3-flash', // Unmatched speed for generating large CSV/JSON sets
    specialization: 'file',
    description: 'Instant generation of structured data and documents'
  },
  'data-analyst': {
    name: 'Data Analyst',
    model: 'gemini-3-pro', // 2M+ token context window for huge datasets
    specialization: 'data',
    description: 'Deep insights from massive datasets and multi-file analysis'
  },
  'api-expert': {
    name: 'API Expert',
    model: 'llama-4-maverick', // Powered by Groq for sub-second API schema generation
    specialization: 'api',
    description: 'Instant REST/GraphQL integration and documentation'
  },

  // --- CONTENT & WRITING (Claude & GPT-5 Thinking) ---
  'content-writer': {
    name: 'Content Writer',
    model: 'claude-opus-4.6', // The current "gold standard" for human-like prose
    specialization: 'writing',
    description: 'Editorial-grade creative writing and brand storytelling'
  },
  'explainer': {
    name: 'Explainer',
    model: 'gpt-5.2-thinking', // Best for chain-of-thought educational breakdowns
    specialization: 'explanation',
    description: 'Complex concept simplification using advanced reasoning'
  },

  // --- GENERAL UTILITY ---
  'general-assistant': {
    name: 'General Assistant',
    model: 'gpt-5.2-mini', // The 2026 standard for smart, fast, general chat
    specialization: 'general',
    description: 'Reliable all-purpose assistant for daily tasks'
  },
  'editor': {
    name: 'Text Editor',
    model: 'claude-haiku-4.5', // Extremely fast and precise for stylistic editing
    specialization: 'editing',
    description: 'Grammar, tone refinement, and structural editing'
  },
};

/**
 * Detect content type and select appropriate thinking mode
 */
export function detectContentType(userMessage: string): {
  type: 'image' | 'file' | 'code' | 'text';
  thinkingMode: 'thinking' | 'creating_image' | 'analyzing' | 'editing_image';
  suggestedModel: string;
} {
  const lowerMsg = userMessage.toLowerCase();
  
  // Image generation keywords (PRIORITY 1)
  const imageKeywords = [
    'create a logo', 'create logo', 'generate logo', 'make a logo', 'logo for',
    'create an image', 'create image', 'generate image', 'make an image', 'image for',
    'design a logo', 'design logo', 'design an image', 'design image',
    'draw', 'paint', 'illustrate', 'sketch',
    'create a picture', 'generate a picture', 'design an icon', 'icon for',
    'kreye yon logo', 'kreye logo', 'fe yon logo', 'fe logo'
  ];
  
  // Image editing keywords (PRIORITY 1.5)
  const editKeywords = [
    'edit image', 'edit the image', 'modify image', 'change image',
    'update image', 'improve image', 'enhance image', 'fix image'
  ];
  
  // File creation keywords (PRIORITY 2)
  const fileKeywords = [
    'send file', 'send a file', 'send yon file',
    'create a file', 'generate file', 'create file', 'make a file', 'gen file',
    'csv file', 'html file', 'json file', 'txt file', 'text file',
    'create .txt', 'create .csv', 'create .html', 'create .json',
    'download file', 'file ki gen', 'file with', 'ligne', 'ladan',
    'ki gen', 'lines', 'rows of'
  ];
  
  // Code keywords (PRIORITY 3)
  const codeKeywords = [
    'write code', 'create code', 'generate code', 'code for',
    'function', 'class', 'api', 'javascript', 'python', 'html',
    'css', 'react', 'component', 'fix bug', 'debug', 'error',
    'koma ka add', 'fason senp', 'html shop'
  ];
  
  // Check for image editing first
  for (const keyword of editKeywords) {
    if (lowerMsg.includes(keyword)) {
      return { 
        type: 'image', 
        thinkingMode: 'editing_image',
        suggestedModel: 'logo-designer' 
      };
    }
  }
  
  // Check for image generation
  for (const keyword of imageKeywords) {
    if (lowerMsg.includes(keyword)) {
      return { 
        type: 'image', 
        thinkingMode: 'creating_image',
        suggestedModel: 'logo-designer' 
      };
    }
  }
  
  // Check for file requests (must show "Analyzing")
  for (const keyword of fileKeywords) {
    if (lowerMsg.includes(keyword)) {
      return { 
        type: 'file', 
        thinkingMode: 'analyzing',
        suggestedModel: 'file-creator' 
      };
    }
  }
  
  // Check for code requests (show "Thinking")
  for (const keyword of codeKeywords) {
    if (lowerMsg.includes(keyword)) {
      return { 
        type: 'code', 
        thinkingMode: 'thinking',
        suggestedModel: 'code-generator' 
      };
    }
  }
  
  // Default to text (show "Thinking")
  return { 
    type: 'text', 
    thinkingMode: 'thinking',
    suggestedModel: 'general-assistant' 
  };
}

/**
 * DALL-E 3 Production Integration
 * Optimized for: Image fidelity, safety handling, and prompt transparency.
 */

interface DalleResponse {
  data: Array<{
    url: string;
    revised_prompt: string; // Crucial for seeing how OpenAI changed your prompt
  }>;
  error?: { message: string };
}

export async function generateImage(prompt: string): Promise<{
  imageUrl?: string;
  revisedPrompt?: string;
  error?: string;
}> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) return { error: 'Missing OPENAI_API_KEY' };

  try {
    // 1. Prompt Pre-processing
    // Adding a subtle style guide ensures better consistency in 2026
    const enhancedPrompt = prompt.trim();

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: enhancedPrompt,
        n: 1,
        size: '1024x1024',
        quality: 'hd', // Upgraded to 'hd' for 2026 professional standard
        style: 'vivid', // 'vivid' for dramatic art, 'natural' for realism
        user: 'app-user-id-001', // Helpful for tracking/preventing abuse
      }),
    });

    const data: DalleResponse = await response.json();

    // 2. Handle Safety Blocks (HTTP 400)
    if (response.status === 400 && data.error?.message.includes('safety')) {
      return { 
        error: 'The request was flagged by the safety filter. Try rephrasing.' 
      };
    }

    if (!response.ok) {
      return { error: data.error?.message || `OpenAI Error: ${response.status}` };
    }

    const imageResult = data.data?.[0];

    if (!imageResult?.url) {
      return { error: 'No image URL was returned from the API.' };
    }

    // 3. Return both the image AND the revised prompt
    // This allows you to show the user exactly how the AI interpreted them
    return { 
      imageUrl: imageResult.url, 
      revisedPrompt: imageResult.revised_prompt 
    };

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown generation error';
    return { error: msg };
  }
}

/**
 * Check if error is a quota/rate limit error that should trigger fallback
 */
function shouldFallback(error: string): boolean {
  const lowerError = error.toLowerCase();
  return (
    lowerError.includes('insufficient_quota') ||
    lowerError.includes('quota') ||
    lowerError.includes('rate_limit') ||
    lowerError.includes('429') ||
    lowerError.includes('billing') ||
    lowerError.includes('exceeded') ||
    lowerError.includes('limit')
  );
}

/**
 * Router function with AUTOMATIC FALLBACK
 * Tries multiple AI providers if one fails due to quota/rate limits
 * USES ONLY YOUR OWN API KEYS - NO OnSpace AI
 */
export async function callAI(modelId: string, messages: AIMessage[]): Promise<AIResponse> {
  console.log(`🚀 User selected model: ${modelId}`);
  console.log(`🎯 This is the model the user wants to use`);

  // Define fallback order based on primary model
  let fallbackOrder: string[] = [];
  
  switch (modelId) {
    case 'openai-gpt4':
      fallbackOrder = ['openai-gpt4', 'google-gemini', 'claude-3', 'groq-llama'];
      break;
    case 'google-gemini':
    case 'google-gemini-2.0-flash':
      fallbackOrder = ['google-gemini', 'claude-3', 'groq-llama', 'openai-gpt4'];
      break;
    case 'google-gemini-pro':
      fallbackOrder = ['google-gemini-pro', 'google-gemini', 'claude-3', 'openai-gpt4'];
      break;
    case 'claude-3':
      fallbackOrder = ['claude-3', 'google-gemini', 'groq-llama', 'openai-gpt4'];
      break;
    case 'groq-llama':
      fallbackOrder = ['groq-llama', 'google-gemini', 'claude-3', 'openai-gpt4'];
      break;
    case 'mistral-large':
      fallbackOrder = ['mistral-large', 'google-gemini', 'claude-3', 'openai-gpt4'];
      break;
    default:
      // Default fallback order
      fallbackOrder = ['google-gemini', 'claude-3', 'groq-llama', 'openai-gpt4'];
      break;
  }

  console.log(`📋 Fallback order: ${fallbackOrder.join(' → ')}`);

  // Try each model in fallback order
  let lastError = '';
  
  for (let i = 0; i < fallbackOrder.length; i++) {
    const currentModel = fallbackOrder[i];
    console.log(`\n${i === 0 ? '🎯' : '🔄'} Trying model: ${currentModel}${i > 0 ? ' (fallback)' : ''}`);
    
    let response: AIResponse;
    
    try {
      // Determine which Gemini model to use based on context
      let geminiModel = 'gemini-2.0-flash'; // Default to latest fast model
      if (modelId === 'google-gemini-pro') {
        geminiModel = 'gemini-1.5-pro'; // User explicitly requested Pro
      } else if (modelId === 'google-gemini') {
        geminiModel = 'gemini-1.5-flash'; // Classic Gemini Flash
      } else if (modelId === 'google-gemini-2.0-flash') {
        geminiModel = 'gemini-2.0-flash'; // Latest 2.0 Flash
      }

      switch (currentModel) {
        case 'openai-gpt4':
          response = await callOpenAI(messages);
          break;
        case 'google-gemini':
        case 'google-gemini-pro':
          response = await callGemini(messages, geminiModel);
          break;
        case 'claude-3':
          response = await callClaude(messages);
          break;
        case 'groq-llama':
          response = await callGroq(messages);
          break;
        case 'mistral-large':
          response = await callMistral(messages);
          break;
        default:
          response = await callGemini(messages, 'gemini-1.5-flash');
          break;
      }

      // Check if response has an error
      if (response.error) {
        lastError = response.error;
        console.log(`❌ ${currentModel} failed: ${response.error}`);
        
        // Check if we should try next fallback
        if (shouldFallback(response.error) && i < fallbackOrder.length - 1) {
          console.log(`⚠️  Quota/rate limit detected - trying next fallback...`);
          continue;
        } else if (i === fallbackOrder.length - 1) {
          // Last model also failed
          console.log(`❌ All models failed. Last error: ${response.error}`);
          return response;
        } else {
          // Non-quota error, return immediately
          console.log(`❌ Non-quota error - not falling back`);
          return response;
        }
      }

      // Success!
      if (i > 0) {
        console.log(`✅ Fallback successful! Using ${currentModel} instead of ${modelId}`);
        // Add note to response that we used fallback
        response.content = `[Using ${currentModel} - ${modelId} unavailable]\n\n${response.content}`;
      } else {
        console.log(`✅ Primary model ${currentModel} succeeded`);
      }
      
      return response;
      
    } catch (error) {
      lastError = error.message || 'Unknown error';
      console.log(`❌ ${currentModel} threw exception: ${lastError}`);
      
      if (i < fallbackOrder.length - 1) {
        console.log(`⚠️  Trying next fallback...`);
        continue;
      }
    }
  }

  // All models failed
  console.log(`❌ CRITICAL: All AI models failed!`);
  return {
    content: '',
    model: modelId,
    error: `All AI models are currently unavailable. Last error: ${lastError}. Please try again later or check your API keys.`
  };
}
