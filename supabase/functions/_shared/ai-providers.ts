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

// List of models that CANNOT generate images - used for blocking
const TEXT_ONLY_MODELS = ['groq-llama', 'groq-llama-4', 'llama-3.3-70b-versatile', 'llama-4-maverick'];

// List of models that CAN generate images
const IMAGE_CAPABLE_MODELS = ['gemini-2.0-flash', 'gemini-1.5-pro', 'openai-gpt4', 'openai', 'dalle-3'];

/**
 * Check if a model is text-only (cannot generate images)
 */
export function isTextOnlyModel(modelId: string): boolean {
  const normalized = modelId.toLowerCase();
  return TEXT_ONLY_MODELS.some(m => normalized.includes(m));
}

/**
 * Check if a model can generate images
 */
export function isImageCapableModel(modelId: string): boolean {
  const normalized = modelId.toLowerCase();
  return IMAGE_CAPABLE_MODELS.some(m => normalized.includes(m)) || 
         normalized.includes('gemini') || 
         normalized.includes('openai') ||
         normalized.includes('dalle');
}

/**
 * OpenAI GPT-4 Integration
 * Best for: Complex reasoning, long conversations, detailed analysis
 */
export async function callOpenAI(messages: AIMessage[]): Promise<AIResponse> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) return { content: '', model: 'openai-gpt4', error: 'OpenAI API key not configured' };

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
 * Gemini Image Generation using Imagen-3
 * Supports: gemini-2.0-flash-exp-image-generation or dedicated image models
 */
export async function generateImageWithGemini(prompt: string, modelName: string = 'gemini-2.0-flash-exp-image-generation'): Promise<{
  imageUrl?: string;
  error?: string;
}> {
  const apiKey = Deno.env.get('GOOGLE_AI_API_KEY');
  
  if (!apiKey) {
    return { error: 'Google AI API key not configured' };
  }

  try {
    console.log(`🎨 Generating image with Gemini (${modelName})...`);

    const requestBody = {
      contents: [{
        role: 'user',
        parts: [
          { text: `Generate an image: ${prompt}. Create a high-quality, detailed image.` }
        ]
      }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"]
      }
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error?.message || response.statusText;
      console.error('Gemini Image API error:', errorMsg);
      return { error: `Gemini Image error: ${errorMsg}` };
    }

    const data = await response.json();
    
    // Extract image data from response
    const parts = data.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p: any) => p.inlineData);
    
    if (imagePart?.inlineData?.data) {
      // Convert base64 to data URL
      const mimeType = imagePart.inlineData.mimeType || 'image/png';
      const base64Data = imagePart.inlineData.data;
      const dataUrl = `data:${mimeType};base64,${base64Data}`;
      
      console.log('✅ Gemini image generated successfully');
      return { imageUrl: dataUrl };
    }

    // If no image in response, check for text response (might be refusal)
    const textPart = parts.find((p: any) => p.text);
    if (textPart?.text) {
      return { error: `Image generation failed: ${textPart.text}` };
    }

    return { error: 'No image data received from Gemini' };

  } catch (error: any) {
    console.error('Gemini Image Generation Error:', error);
    return { error: error.message || 'Unknown error during image generation' };
  }
}

/**
 * Claude 3.5 Sonnet Integration
 */
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
 * Groq Llama Integration - TEXT ONLY
 * ⚠️ CRITICAL: This model CANNOT generate images. Never use for image tasks.
 */
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
        model: 'llama-3.3-70b-versatile', 
        messages: messages.map(m => ({
          role: m.role,
          content: m.content || '',
        })),
        temperature: 0.6,
        max_completion_tokens: 4000,
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
 * Mistral Large Integration
 */
interface MistralChoice {
  message: { content: string };
  finish_reason: string;
}

export async function callMistral(messages: AIMessage[]): Promise<AIResponse> {
  const apiKey = Deno.env.get('MISTRAL_API_KEY');
  
  if (!apiKey) {
    console.warn('⚠️ Mistral API key missing. Redirecting to OpenAI...');
    return await callOpenAI(messages);
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
          model: 'mistral-large-latest', 
          messages: messages.map(m => ({
            role: m.role,
            content: m.content || '',
          })),
          temperature: 0.2,
          max_tokens: 4000,
          safe_prompt: false,
        }),
      });

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
 * DALL-E 3 Image Generation (OpenAI)
 */
interface DalleResponse {
  data: Array<{
    url: string;
    revised_prompt: string;
  }>;
  error?: { message: string };
}

export async function generateImageWithDalle(prompt: string): Promise<{
  imageUrl?: string;
  revisedPrompt?: string;
  error?: string;
}> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) return { error: 'Missing OPENAI_API_KEY' };

  try {
    console.log('🎨 Generating image with DALL-E 3...');

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: prompt.trim(),
        n: 1,
        size: '1024x1024',
        quality: 'hd',
        style: 'vivid',
      }),
    });

    const data: DalleResponse = await response.json();

    if (response.status === 400 && data.error?.message?.includes('safety')) {
      return { error: 'The request was flagged by the safety filter. Try rephrasing.' };
    }

    if (!response.ok) {
      return { error: data.error?.message || `OpenAI Error: ${response.status}` };
    }

    const imageResult = data.data?.[0];

    if (!imageResult?.url) {
      return { error: 'No image URL was returned from the API.' };
    }

    console.log('✅ DALL-E image generated successfully');
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
 * SMART IMAGE GENERATION ROUTER
 * This function ONLY uses image-capable models and NEVER falls back to text-only models
 * Priority: Gemini -> OpenAI DALL-E -> Error
 */
export async function generateImageSmart(
  prompt: string, 
  preferredModel: string = 'gemini'
): Promise<{
  imageUrl?: string;
  model: string;
  error?: string;
  revisedPrompt?: string;
}> {
  console.log(`🖼️  Smart Image Generation started`);
  console.log(`   Preferred model: ${preferredModel}`);
  console.log(`   Prompt: ${prompt.substring(0, 50)}...`);

  // Validate that preferred model is not text-only
  if (isTextOnlyModel(preferredModel)) {
    console.warn(`⚠️  Text-only model ${preferredModel} selected for image task. Switching to Gemini.`);
    preferredModel = 'gemini';
  }

  // Try Gemini first (if preferred or as default)
  if (preferredModel.includes('gemini') || preferredModel === 'google-gemini') {
    console.log('🔄 Trying Gemini for image generation...');
    
    // Try Gemini 2.0 Flash with image generation
    const geminiResult = await generateImageWithGemini(prompt, 'gemini-2.0-flash-exp-image-generation');
    
    if (geminiResult.imageUrl) {
      return { 
        imageUrl: geminiResult.imageUrl, 
        model: 'gemini-2.0-flash-image',
        revisedPrompt: prompt 
      };
    }
    
    console.log('⚠️  Gemini image generation failed:', geminiResult.error);
    // Continue to OpenAI fallback
  }

  // Fallback to OpenAI DALL-E 3
  console.log('🔄 Falling back to OpenAI DALL-E 3...');
  const dalleResult = await generateImageWithDalle(prompt);
  
  if (dalleResult.imageUrl) {
    return { 
      imageUrl: dalleResult.imageUrl, 
      model: 'dalle-3',
      revisedPrompt: dalleResult.revisedPrompt 
    };
  }

  console.error('❌ All image generation models failed');
  return { 
    error: 'Unable to generate image. Both Gemini and OpenAI image services are unavailable. Please try again later.',
    model: 'none'
  };
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
 * ⚠️ CRITICAL FIX: Blocks text-only models from image tasks
 */
export async function callAI(modelId: string, messages: AIMessage[], isImageTask: boolean = false): Promise<AIResponse> {
  console.log(`🚀 User selected model: ${modelId}`);
  console.log(`🎯 Is image task: ${isImageTask}`);

  // CRITICAL: Block text-only models from image tasks
  if (isImageTask && isTextOnlyModel(modelId)) {
    console.error(`🚫 BLOCKED: ${modelId} cannot handle image tasks. Forcing image-capable model.`);
    // Force redirect to image-capable model
    modelId = 'google-gemini';
  }

  // Define fallback order based on primary model and task type
  let fallbackOrder: string[] = [];
  
  if (isImageTask) {
    // For image tasks: ONLY use image-capable models, NEVER groq-llama
    fallbackOrder = ['google-gemini', 'openai-gpt4'];
  } else {
    // For text tasks: normal fallback chain
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
        fallbackOrder = ['google-gemini', 'claude-3', 'groq-llama', 'openai-gpt4'];
        break;
    }
  }

  console.log(`📋 Fallback order: ${fallbackOrder.join(' → ')}`);

  // Try each model in fallback order
  let lastError = '';
  
  for (let i = 0; i < fallbackOrder.length; i++) {
    const currentModel = fallbackOrder[i];
    
    // Double-check: skip text-only models for image tasks
    if (isImageTask && isTextOnlyModel(currentModel)) {
      console.log(`⏭️  Skipping ${currentModel} - text-only model cannot handle images`);
      continue;
    }
    
    console.log(`\n${i === 0 ? '🎯' : '🔄'} Trying model: ${currentModel}${i > 0 ? ' (fallback)' : ''}`);
    
    let response: AIResponse;
    
    try {
      // Determine which Gemini model to use based on context
      let geminiModel = 'gemini-2.0-flash';
      if (modelId === 'google-gemini-pro') {
        geminiModel = 'gemini-1.5-pro';
      } else if (modelId === 'google-gemini') {
        geminiModel = 'gemini-1.5-flash';
      } else if (modelId === 'google-gemini-2.0-flash') {
        geminiModel = 'gemini-2.0-flash';
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
          response = await callGemini(messages, 'gemini-2.0-flash');
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
          console.log(`❌ All models failed. Last error: ${response.error}`);
          return response;
        } else {
          console.log(`❌ Non-quota error - not falling back`);
          return response;
        }
      }

      // Success!
      if (i > 0) {
        console.log(`✅ Fallback successful! Using ${currentModel} instead of ${modelId}`);
        response.content = `[Using ${currentModel} - ${modelId} unavailable]\n\n${response.content}`;
      } else {
        console.log(`✅ Primary model ${currentModel} succeeded`);
      }
      
      return response;
      
    } catch (error: any) {
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

/**
 * Detect content type and select appropriate thinking mode
 * ENHANCED: Better detection for image generation requests
 */
export function detectContentType(userMessage: string): {
  type: 'image' | 'file' | 'code' | 'text';
  thinkingMode: 'thinking' | 'creating_image' | 'analyzing' | 'editing_image';
  suggestedModel: string;
  isImageTask: boolean;
} {
  const lowerMsg = userMessage.toLowerCase();
  
  // Image generation keywords (PRIORITY 1) - EXPANDED LIST
  const imageKeywords = [
    'create a logo', 'create logo', 'generate logo', 'make a logo', 'logo for',
    'create an image', 'create image', 'generate image', 'make an image', 'image for',
    'design a logo', 'design logo', 'design an image', 'design image',
    'draw', 'paint', 'illustrate', 'sketch',
    'create a picture', 'generate a picture', 'design an icon', 'icon for',
    'kreye yon logo', 'kreye logo', 'fe yon logo', 'fe logo',
    'generate a logo', 'make logo', 'logo design', 'brand logo',
    'create photo', 'generate photo', 'make photo', 'photo of',
    'create illustration', 'generate illustration', 'make illustration',
    'create artwork', 'generate artwork', 'make artwork',
    'create graphic', 'generate graphic', 'make graphic',
    'create banner', 'generate banner', 'make banner',
    'create poster', 'generate poster', 'make poster',
    'create avatar', 'generate avatar', 'make avatar',
    'create thumbnail', 'generate thumbnail', 'make thumbnail',
    'create meme', 'generate meme', 'make meme',
    'draw a', 'paint a', 'sketch a', 'illustrate a',
    'image of', 'picture of', 'photo of', 'drawing of', 'painting of',
    'visualize', 'render', 'generate art', 'create art', 'ai art',
    'text to image', 'text-to-image', 'image generation'
  ];
  
  // Image editing keywords (PRIORITY 1.5)
  const editKeywords = [
    'edit image', 'edit the image', 'modify image', 'change image',
    'update image', 'improve image', 'enhance image', 'fix image',
    'edit photo', 'modify photo', 'change photo', 'update photo',
    'edit picture', 'modify picture', 'change picture'
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
        suggestedModel: 'gemini-2.0-flash',
        isImageTask: true
      };
    }
  }
  
  // Check for image generation - STRICT DETECTION
  for (const keyword of imageKeywords) {
    if (lowerMsg.includes(keyword)) {
      return { 
        type: 'image', 
        thinkingMode: 'creating_image',
        suggestedModel: 'gemini-2.0-flash',
        isImageTask: true
      };
    }
  }
  
  // Check for file requests
  for (const keyword of fileKeywords) {
    if (lowerMsg.includes(keyword)) {
      return { 
        type: 'file', 
        thinkingMode: 'analyzing',
        suggestedModel: 'file-creator',
        isImageTask: false
      };
    }
  }
  
  // Check for code requests
  for (const keyword of codeKeywords) {
    if (lowerMsg.includes(keyword)) {
      return { 
        type: 'code', 
        thinkingMode: 'thinking',
        suggestedModel: 'code-generator',
        isImageTask: false
      };
    }
  }
  
  // Default to text
  return { 
    type: 'text', 
    thinkingMode: 'thinking',
    suggestedModel: 'general-assistant',
    isImageTask: false
  };
}

/**
 * Available AI Models - 2026 Optimized
 */
export const AI_MODELS = {
  // --- IMAGE & DESIGN (DALL-E 3 + Gemini Imagen) ---
  'image-generator': {
    name: 'Image Generator',
    model: 'dalle-3',
    specialization: 'image',
    description: 'Hyper-realistic imagery and complex scene generation via DALL-E 3 or Gemini Imagen'
  },
  'logo-designer': {
    name: 'Logo Designer',
    model: 'gemini-2.0-flash-image',
    specialization: 'image',
    description: 'Precision brand assets and professional logo generation'
  },

  // --- CODE & TECHNICAL (GPT-4 & Claude) ---
  'code-generator': {
    name: 'Code Generator',
    model: 'gpt-4o',
    specialization: 'code',
    description: 'Senior-level code generation with full project context'
  },
  'code-debugger': {
    name: 'Code Debugger',
    model: 'claude-3-5-sonnet',
    specialization: 'debug',
    description: 'Deep logic analysis and multi-file debugging'
  },
  'ui-designer': {
    name: 'UI/UX Designer',
    model: 'claude-3-5-sonnet',
    specialization: 'ui',
    description: 'High-fidelity UI components and design system architecture'
  },

  // --- DATA & PERFORMANCE (Gemini + Groq) ---
  'file-creator': {
    name: 'File Creator',
    model: 'gemini-2.0-flash',
    specialization: 'file',
    description: 'Instant generation of structured data and documents'
  },
  'data-analyst': {
    name: 'Data Analyst',
    model: 'gemini-1.5-pro',
    specialization: 'data',
    description: 'Deep insights from massive datasets and multi-file analysis'
  },
  'api-expert': {
    name: 'API Expert',
    model: 'groq-llama-4',
    specialization: 'api',
    description: 'Fast API schema generation and documentation'
  },

  // --- CONTENT & WRITING (Claude & GPT) ---
  'content-writer': {
    name: 'Content Writer',
    model: 'claude-3-5-sonnet',
    specialization: 'writing',
    description: 'Editorial-grade creative writing and brand storytelling'
  },
  'explainer': {
    name: 'Explainer',
    model: 'gpt-4o',
    specialization: 'explanation',
    description: 'Complex concept simplification using advanced reasoning'
  },

  // --- GENERAL UTILITY ---
  'general-assistant': {
    name: 'General Assistant',
    model: 'gemini-2.0-flash',
    specialization: 'general',
    description: 'Reliable all-purpose assistant for daily tasks'
  },
  'editor': {
    name: 'Text Editor',
    model: 'claude-3-5-haiku',
    specialization: 'editing',
    description: 'Grammar, tone refinement, and structural editing'
  },
};
