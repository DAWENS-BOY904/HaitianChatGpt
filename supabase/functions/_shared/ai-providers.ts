// AI Provider Service - Handles all AI model integrations (PRODUCTION-READY 2026)

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

// CRITICAL: List of models that CANNOT generate images
const TEXT_ONLY_MODELS = ['groq-llama', 'groq-llama-4', 'llama-3.3-70b-versatile', 'llama-4-maverick'];

// List of models that CAN generate images
const IMAGE_CAPABLE_MODELS = ['gemini-2.0-flash-exp', 'gemini-1.5-pro', 'openai-gpt4', 'openai', 'dalle-3'];

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
 * Google Gemini Integration - FIXED MODEL NAMES FOR v1beta API
 * Available models:
 * - gemini-2.0-flash-exp (latest experimental - RECOMMENDED)
 * - gemini-1.5-flash (stable, fast)
 * - gemini-1.5-pro (most capable, slower)
 */
export async function callGemini(messages: AIMessage[], modelName: string = 'gemini-2.0-flash-exp'): Promise<AIResponse> {
  const apiKey = Deno.env.get('GOOGLE_AI_API_KEY');
  
  if (!apiKey) {
    console.log('⚠️ Google AI API key not configured, using fallback');
    return { content: '', model: 'google-gemini', error: 'FALLBACK_NEEDED' };
  }

  try {
    // CRITICAL FIX: Map to valid v1beta model names with proper fallbacks
    let validModelName = modelName;
    
    // Map all gemini-1.5-flash variations to the stable v1 name (not v1beta)
    if (modelName.includes('gemini-1.5-flash') || modelName === 'gemini-1.5-flash') {
      validModelName = 'gemini-1.5-flash';
      console.log(`🔄 Corrected: ${modelName} → ${validModelName}`);
    }
    // Map gemini-2.0-flash to experimental version
    else if (modelName === 'gemini-2.0-flash' || modelName === 'gemini-flash') {
      validModelName = 'gemini-2.0-flash-exp';
      console.log(`🔄 Corrected: ${modelName} → ${validModelName}`);
    }
    // Map gemini-1.5-pro
    else if (modelName.includes('gemini-1.5-pro')) {
      validModelName = 'gemini-1.5-pro';
      console.log(`🔄 Corrected: ${modelName} → ${validModelName}`);
    }

    // Prepare the request body
    const requestBody: any = {
      contents: messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
    };

    // Add system instruction correctly
    const systemMessage = messages.find(m => m.role === 'system');
    if (systemMessage) {
      requestBody.system_instruction = {
        parts: [{ text: systemMessage.content }]
      };
    }

    console.log(`🔷 Using Gemini model: ${validModelName}`);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${validModelName}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }
    );

    // Handle HTTP errors with smart fallback
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error?.message || response.statusText;
      console.error('Gemini API error:', errorMsg);
      
      // If model not found, trigger fallback instead of showing error to user
      if (errorMsg.includes('not found') || errorMsg.includes('not supported') || response.status === 404) {
        console.log('⚠️ Gemini model not available, triggering fallback');
        return { content: '', model: 'google-gemini', error: 'FALLBACK_NEEDED' };
      }
      
      return { content: '', model: 'google-gemini', error: `Gemini error: ${errorMsg}` };
    }

    const data = await response.json();

    // Validate and extract content
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
      model: `google-gemini (${validModelName})`,
    };

  } catch (error: any) {
    console.error('Gemini Fetch Error:', error);
    return { content: '', model: 'google-gemini', error: error.message || 'Unknown error' };
  }
}

/**
 * OnSpace AI Image Generation (PRIMARY METHOD)
 */
export async function generateImageWithOnSpaceAI(prompt: string): Promise<{
  imageUrl?: string;
  error?: string;
}> {
  const apiKey = Deno.env.get('ONSPACE_AI_API_KEY');
  const baseUrl = Deno.env.get('ONSPACE_AI_BASE_URL');
  
  if (!apiKey || !baseUrl) {
    return { error: 'OnSpace AI not configured' };
  }

  try {
    console.log('🎨 Generating image with OnSpace AI (Nano Banana Pro)...');

    const response = await fetch(`${baseUrl}/v1/images/generations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-pro-image-preview', // Nano Banana Pro
        prompt: prompt,
        n: 1,
        size: '1024x1024',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error?.message || response.statusText;
      console.error('OnSpace AI Image error:', errorMsg);
      
      // Check for quota/credit issues
      if (errorMsg.includes('Insufficient balance') || errorMsg.includes('quota')) {
        return { error: '❌ OnSpace AI credit limit reached. Falling back to DALL-E...' };
      }
      
      return { error: `OnSpace AI Image error: ${errorMsg}` };
    }

    const data = await response.json();
    const imageUrl = data.data?.[0]?.url;
    
    if (imageUrl) {
      console.log('✅ OnSpace AI image generated successfully');
      return { imageUrl };
    }

    return { error: 'No image URL received from OnSpace AI' };

  } catch (error: any) {
    console.error('OnSpace AI Image Generation Error:', error);
    return { error: error.message || 'Unknown error during OnSpace AI image generation' };
  }
}

/**
 * Gemini Image Generation using Imagen-3 (FALLBACK)
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
      
      // Check for quota errors
      if (errorMsg.includes('quota') || errorMsg.includes('exceeded')) {
        return { error: 'Gemini quota exceeded. Falling back to DALL-E...' };
      }
      
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

    // If no image in response, check for text response
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
 * SMART IMAGE GENERATION ROUTER - PRODUCTION-READY
 * Priority: OnSpace AI (Nano Banana Pro) → Gemini → DALL-E → Error
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
    console.warn(`⚠️  Text-only model ${preferredModel} selected for image task. Switching to OnSpace AI.`);
    preferredModel = 'onspace-ai';
  }

  // PRIORITY 1: Try OnSpace AI (Nano Banana Pro) FIRST
  console.log('🔄 Trying OnSpace AI (Nano Banana Pro) for image generation...');
  
  const onspaceResult = await generateImageWithOnSpaceAI(prompt);
  
  if (onspaceResult.imageUrl) {
    return { 
      imageUrl: onspaceResult.imageUrl, 
      model: 'nano-banana-pro',
      revisedPrompt: prompt 
    };
  }
  
  console.log('⚠️  OnSpace AI image generation failed:', onspaceResult.error);

  // PRIORITY 2: Fallback to Gemini (if preferred or as secondary)
  if (preferredModel.includes('gemini') || preferredModel === 'google-gemini' || preferredModel === 'onspace-ai') {
    console.log('🔄 Trying Gemini for image generation...');
    
    const geminiResult = await generateImageWithGemini(prompt, 'gemini-2.0-flash-exp-image-generation');
    
    if (geminiResult.imageUrl) {
      return { 
        imageUrl: geminiResult.imageUrl, 
        model: 'gemini-2.0-flash-image',
        revisedPrompt: prompt 
      };
    }
    
    console.log('⚠️  Gemini image generation failed:', geminiResult.error);
  }

  // PRIORITY 3: Final fallback to OpenAI DALL-E 3
  console.log('🔄 Final fallback to OpenAI DALL-E 3...');
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
    error: '❌ All image generation services are currently unavailable:\n\n1. OnSpace AI (Nano Banana Pro): ' + (onspaceResult.error || 'Failed') + '\n2. Gemini Imagen: Quota exceeded\n3. DALL-E 3: ' + (dalleResult.error || 'Failed') + '\n\nPlease try again later or contact support if this issue persists.',
    model: 'none'
  };
}

/**
 * Check if error requires fallback
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
 */
export async function callAI(modelId: string, messages: AIMessage[], isImageTask: boolean = false): Promise<AIResponse> {
  console.log(`🚀 User selected model: ${modelId}`);
  console.log(`🎯 Is image task: ${isImageTask}`);

  // CRITICAL: Block text-only models from image tasks
  if (isImageTask && isTextOnlyModel(modelId)) {
    console.error(`🚫 BLOCKED: ${modelId} cannot handle image tasks. Forcing image-capable model.`);
    modelId = 'google-gemini';
  }

  // Define fallback order with proper model availability
  let fallbackOrder: string[] = [];
  
  if (isImageTask) {
    fallbackOrder = ['google-gemini', 'openai-gpt4'];
  } else {
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

  let lastError = '';
  
  for (let i = 0; i < fallbackOrder.length; i++) {
    const currentModel = fallbackOrder[i];
    
    if (isImageTask && isTextOnlyModel(currentModel)) {
      console.log(`⏭️  Skipping ${currentModel} - text-only model`);
      continue;
    }
    
    console.log(`\n${i === 0 ? '🎯' : '🔄'} Trying: ${currentModel}${i > 0 ? ' (fallback)' : ''}`);
    
    let response: AIResponse;
    
    try {
      // CRITICAL FIX: Use valid Gemini model names for v1beta API
      let geminiModel = 'gemini-2.0-flash-exp';
      if (modelId === 'google-gemini-pro') {
        geminiModel = 'gemini-1.5-pro-002';
      } else if (modelId === 'google-gemini' || modelId === 'gemini') {
        geminiModel = 'gemini-1.5-flash-002';
      } else if (modelId === 'google-gemini-2.0-flash' || modelId === 'gemini-2.0-flash') {
        geminiModel = 'gemini-2.0-flash-exp';
      } else if (modelId.includes('gemini-1.5-flash')) {
        geminiModel = 'gemini-1.5-flash-002';
      } else if (modelId.includes('gemini-1.5-pro')) {
        geminiModel = 'gemini-1.5-pro-002';
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
          response = await callGemini(messages, 'gemini-2.0-flash-exp');
          break;
      }

      if (response.error) {
        lastError = response.error;
        console.log(`❌ ${currentModel} failed: ${response.error}`);
        
        // Smart fallback: if error is FALLBACK_NEEDED or quota/rate limit, try next model silently
        if ((response.error === 'FALLBACK_NEEDED' || shouldFallback(response.error)) && i < fallbackOrder.length - 1) {
          console.log(`⚠️  Trying next fallback silently (no user error)...`);
          continue;
        } else if (i === fallbackOrder.length - 1) {
          console.log(`❌ All models failed. Last error: ${response.error}`);
          // Don't show technical errors to users - generic message instead
          return {
            content: '',
            model: modelId,
            error: 'AI service temporarily unavailable. Please try again in a moment.'
          };
        } else {
          return response;
        }
      }

      if (i > 0) {
        console.log(`✅ Fallback successful! Using ${currentModel}`);
        response.content = `[Using ${currentModel} - ${modelId} unavailable]\n\n${response.content}`;
      } else {
        console.log(`✅ Primary model ${currentModel} succeeded`);
      }
      
      return response;
      
    } catch (error: any) {
      lastError = error.message || 'Unknown error';
      console.log(`❌ ${currentModel} exception: ${lastError}`);
      
      if (i < fallbackOrder.length - 1) {
        continue;
      }
    }
  }

  console.log(`❌ CRITICAL: All AI models failed!`);
  return {
    content: '',
    model: modelId,
    error: `All AI models are currently unavailable. Last error: ${lastError}. Please try again later.`
  };
}

/**
 * Detect content type - PRODUCTION VERSION
 */
export function detectContentType(userMessage: string): {
  type: 'image' | 'file' | 'code' | 'text';
  thinkingMode: 'thinking' | 'creating_image' | 'analyzing' | 'editing_image';
  suggestedModel: string;
  isImageTask: boolean;
} {
  const lowerMsg = userMessage.toLowerCase();
  
  // Image generation keywords
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
    'image of', 'picture of', 'photo of', 'drawing of', 'painting of',
  ];
  
  // Image editing keywords
  const editKeywords = [
    'edit image', 'edit the image', 'modify image', 'change image',
    'edit photo', 'modify photo', 'change photo',
  ];
  
  // File keywords
  const fileKeywords = [
    'send file', 'create a file', 'generate file', 'create file',
    'csv file', 'html file', 'json file', 'txt file',
  ];
  
  // Check for image editing
  for (const keyword of editKeywords) {
    if (lowerMsg.includes(keyword)) {
      return { 
        type: 'image', 
        thinkingMode: 'editing_image',
        suggestedModel: 'gemini-2.0-flash-exp',
        isImageTask: true
      };
    }
  }
  
  // Check for image generation
  for (const keyword of imageKeywords) {
    if (lowerMsg.includes(keyword)) {
      return { 
        type: 'image', 
        thinkingMode: 'creating_image',
        suggestedModel: 'gemini-2.0-flash-exp',
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
  
  // Default to text
  return { 
    type: 'text', 
    thinkingMode: 'thinking',
    suggestedModel: 'general-assistant',
    isImageTask: false
  };
}

export const AI_MODELS = {
  'image-generator': {
    name: 'Image Generator',
    model: 'dalle-3',
    specialization: 'image',
  },
  'code-generator': {
    name: 'Code Generator',
    model: 'gpt-4o',
    specialization: 'code',
  },
  'general-assistant': {
    name: 'General Assistant',
    model: 'gemini-2.0-flash-exp',
    specialization: 'general',
  },
};
