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

/**
 * Check if a model is text-only (cannot generate images)
 */
export function isTextOnlyModel(modelId: string): boolean {
  const normalized = modelId.toLowerCase();
  return TEXT_ONLY_MODELS.some(m => normalized.includes(m));
}

/**
 * OnSpace AI - PRIMARY TEXT GENERATION (uses configured ONSPACE_AI_API_KEY)
 */
export async function callOnSpaceAI(messages: AIMessage[]): Promise<AIResponse> {
  const apiKey = Deno.env.get('ONSPACE_AI_API_KEY');
  const baseUrl = Deno.env.get('ONSPACE_AI_BASE_URL') || 'https://api.onspace.ai';

  if (!apiKey) {
    return { content: '', model: 'onspace-ai', error: 'FALLBACK_NEEDED' };
  }

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error?.message || response.statusText;
      console.error('OnSpace AI error:', errorMsg);
      return { content: '', model: 'onspace-ai', error: 'FALLBACK_NEEDED' };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return { content: '', model: 'onspace-ai', error: 'FALLBACK_NEEDED' };
    }

    return { content, model: 'onspace-ai' };
  } catch (error: any) {
    console.error('OnSpace AI fetch error:', error);
    return { content: '', model: 'onspace-ai', error: 'FALLBACK_NEEDED' };
  }
}

/**
 * OpenAI GPT-4 Integration
 */
export async function callOpenAI(messages: AIMessage[]): Promise<AIResponse> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) return { content: '', model: 'openai-gpt4', error: 'FALLBACK_NEEDED' };

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        temperature: 0.7,
        max_tokens: 4096,
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
 * Google Gemini Integration
 */
export async function callGemini(messages: AIMessage[], modelName: string = 'gemini-1.5-flash'): Promise<AIResponse> {
  const apiKey = Deno.env.get('GOOGLE_AI_API_KEY');
  
  if (!apiKey) {
    return { content: '', model: 'google-gemini', error: 'FALLBACK_NEEDED' };
  }

  try {
    // Map to valid v1beta model names
    let validModelName = 'gemini-1.5-flash';
    if (modelName.includes('2.0') || modelName.includes('flash-exp')) {
      validModelName = 'gemini-2.0-flash-exp';
    } else if (modelName.includes('1.5-pro')) {
      validModelName = 'gemini-1.5-pro';
    }

    const requestBody: any = {
      contents: messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
      generationConfig: {
        maxOutputTokens: 4096,
        temperature: 0.7,
      },
    };

    const systemMessage = messages.find(m => m.role === 'system');
    if (systemMessage) {
      requestBody.system_instruction = {
        parts: [{ text: systemMessage.content }]
      };
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${validModelName}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Gemini API error:', errorData);
      return { content: '', model: 'google-gemini', error: 'FALLBACK_NEEDED' };
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!content) {
      return { content: '', model: 'google-gemini', error: 'FALLBACK_NEEDED' };
    }

    return { content, model: `google-gemini (${validModelName})` };

  } catch (error: any) {
    console.error('Gemini Fetch Error:', error);
    return { content: '', model: 'google-gemini', error: 'FALLBACK_NEEDED' };
  }
}

/**
 * Claude 3.5 Sonnet Integration
 */
export async function callClaude(messages: AIMessage[]): Promise<AIResponse> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  
  if (!apiKey) {
    return { content: '', model: 'claude-3-5', error: 'FALLBACK_NEEDED' };
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

    const data = await response.json();

    if (!response.ok) {
      return { content: '', model: 'claude-3-5', error: 'FALLBACK_NEEDED' };
    }

    const textContent = data.content?.find((c: any) => c.type === 'text')?.text;
    if (!textContent) {
      return { content: '', model: 'claude-3-5', error: 'FALLBACK_NEEDED' };
    }

    return { content: textContent, model: 'claude-3-5' };

  } catch (error: any) {
    return { content: '', model: 'claude-3-5', error: 'FALLBACK_NEEDED' };
  }
}

/**
 * Groq Llama Integration - TEXT ONLY (fast fallback)
 */
export async function callGroq(messages: AIMessage[]): Promise<AIResponse> {
  const apiKey = Deno.env.get('GROQ_API_KEY');
  if (!apiKey) {
    return { content: '', model: 'groq-llama-4', error: 'FALLBACK_NEEDED' };
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
      return { content: '', model: 'groq-llama-4', error: 'FALLBACK_NEEDED' };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return { content: '', model: 'groq-llama-4', error: 'FALLBACK_NEEDED' };
    }

    return { content, model: 'groq-llama-4' };

  } catch (error: any) {
    return { content: '', model: 'groq-llama-4', error: 'FALLBACK_NEEDED' };
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
    const response = await fetch(`${baseUrl}/v1/images/generations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-pro-image-preview',
        prompt: prompt,
        n: 1,
        size: '1024x1024',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { error: `OnSpace AI Image error: ${errorData.error?.message || response.statusText}` };
    }

    const data = await response.json();
    const imageUrl = data.data?.[0]?.url;
    
    if (imageUrl) {
      return { imageUrl };
    }

    return { error: 'No image URL received from OnSpace AI' };

  } catch (error: any) {
    return { error: error.message || 'Unknown error during OnSpace AI image generation' };
  }
}

/**
 * Gemini Image Generation
 */
export async function generateImageWithGemini(prompt: string): Promise<{
  imageUrl?: string;
  error?: string;
}> {
  const apiKey = Deno.env.get('GOOGLE_AI_API_KEY');
  
  if (!apiKey) {
    return { error: 'Google AI API key not configured' };
  }

  try {
    const requestBody = {
      contents: [{
        role: 'user',
        parts: [{ text: `Generate an image: ${prompt}` }]
      }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"]
      }
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      return { error: `Gemini Image error: ${response.statusText}` };
    }

    const data = await response.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p: any) => p.inlineData);
    
    if (imagePart?.inlineData?.data) {
      const mimeType = imagePart.inlineData.mimeType || 'image/png';
      const dataUrl = `data:${mimeType};base64,${imagePart.inlineData.data}`;
      return { imageUrl: dataUrl };
    }

    return { error: 'No image data received from Gemini' };

  } catch (error: any) {
    return { error: error.message || 'Unknown error during image generation' };
  }
}

/**
 * DALL-E 3 Image Generation (OpenAI)
 */
export async function generateImageWithDalle(prompt: string): Promise<{
  imageUrl?: string;
  revisedPrompt?: string;
  error?: string;
}> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) return { error: 'Missing OPENAI_API_KEY' };

  try {
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

    const data = await response.json();

    if (!response.ok) {
      return { error: data.error?.message || `OpenAI Error: ${response.status}` };
    }

    const imageResult = data.data?.[0];
    if (!imageResult?.url) {
      return { error: 'No image URL returned' };
    }

    return { imageUrl: imageResult.url, revisedPrompt: imageResult.revised_prompt };

  } catch (error: any) {
    return { error: error.message || 'Unknown generation error' };
  }
}

/**
 * SMART IMAGE GENERATION ROUTER
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
  // Priority 1: OnSpace AI
  const onspaceResult = await generateImageWithOnSpaceAI(prompt);
  if (onspaceResult.imageUrl) {
    return { imageUrl: onspaceResult.imageUrl, model: 'onspace-ai' };
  }

  // Priority 2: Gemini
  const geminiResult = await generateImageWithGemini(prompt);
  if (geminiResult.imageUrl) {
    return { imageUrl: geminiResult.imageUrl, model: 'gemini-image' };
  }

  // Priority 3: DALL-E
  const dalleResult = await generateImageWithDalle(prompt);
  if (dalleResult.imageUrl) {
    return { imageUrl: dalleResult.imageUrl, model: 'dalle-3', revisedPrompt: dalleResult.revisedPrompt };
  }

  return { 
    error: 'Image generation is currently unavailable. Please try again later.',
    model: 'none'
  };
}

/**
 * Main AI router with automatic fallback
 * Priority: OnSpace AI → Groq → Claude → OpenAI → Gemini
 */
export async function callAI(modelId: string, messages: AIMessage[], isImageTask: boolean = false): Promise<AIResponse> {
  console.log(`AI Request - model: ${modelId}, imageTask: ${isImageTask}`);

  // For image tasks, don't use text-only models
  if (isImageTask && isTextOnlyModel(modelId)) {
    modelId = 'google-gemini';
  }

  // PRIORITY ORDER: OnSpace AI first (always configured), then others
  const fallbackOrder = ['onspace-ai', 'groq-llama', 'claude-3', 'openai-gpt4', 'google-gemini'];

  // If user selected a specific model, put it first
  if (modelId && modelId !== 'gemini' && modelId !== 'google-gemini') {
    const modelMap: Record<string, string> = {
      'openai': 'openai-gpt4',
      'claude': 'claude-3',
      'llama': 'groq-llama',
      'onspace-ai': 'onspace-ai',
    };
    const mapped = modelMap[modelId] || modelId;
    const idx = fallbackOrder.indexOf(mapped);
    if (idx > 0) {
      fallbackOrder.splice(idx, 1);
      fallbackOrder.unshift(mapped);
    }
  }

  for (let i = 0; i < fallbackOrder.length; i++) {
    const currentModel = fallbackOrder[i];
    
    if (isImageTask && isTextOnlyModel(currentModel)) continue;
    
    console.log(`Trying: ${currentModel}${i > 0 ? ' (fallback)' : ''}`);
    
    let response: AIResponse;
    
    try {
      switch (currentModel) {
        case 'onspace-ai':
          response = await callOnSpaceAI(messages);
          break;
        case 'openai-gpt4':
          response = await callOpenAI(messages);
          break;
        case 'google-gemini':
          response = await callGemini(messages, 'gemini-1.5-flash');
          break;
        case 'claude-3':
          response = await callClaude(messages);
          break;
        case 'groq-llama':
          response = await callGroq(messages);
          break;
        default:
          response = await callOnSpaceAI(messages);
          break;
      }

      if (response.error) {
        console.log(`${currentModel} failed: ${response.error}`);
        if (i < fallbackOrder.length - 1) continue;
        return {
          content: '',
          model: modelId,
          error: 'AI service temporarily unavailable. Please try again in a moment.'
        };
      }

      console.log(`Success with: ${currentModel}`);
      return response;
      
    } catch (error: any) {
      console.log(`${currentModel} exception: ${error.message}`);
      if (i < fallbackOrder.length - 1) continue;
    }
  }

  return {
    content: '',
    model: modelId,
    error: 'AI service is temporarily busy. Please try again in a moment.'
  };
}

/**
 * Detect content type
 */
export function detectContentType(userMessage: string): {
  type: 'image' | 'file' | 'both' | 'code' | 'text';
  thinkingMode: 'thinking' | 'creating_image' | 'analyzing' | 'editing_image';
  suggestedModel: string;
  isImageTask: boolean;
  hasImageKeywords: boolean;
  hasFileKeywords: boolean;
} {
  const lowerMsg = userMessage.toLowerCase();
  
  const imageKeywords = [
    'create a logo', 'create logo', 'generate logo', 'make a logo', 'design a logo',
    'create an image', 'create image', 'generate image', 'make an image', 'design an image',
    'draw a', 'draw me', 'paint a', 'paint me', 'illustrate', 'sketch a',
    'generate a picture', 'make a picture',
    'kreye yon logo', 'kreye logo', 'fe yon logo', 'fe logo', 'desine logo',
    'kreye foto', 'kreye imaj', 'fe foto', 'fe imaj',
  ];
  
  const editKeywords = [
    'edit image', 'edit the image', 'modify image', 'edit photo', 'modify photo',
  ];
  
  const fileKeywords = [
    'create a file', 'generate file', 'make a file', 'csv file', 'html file',
    'json file', 'txt file', 'create csv', 'create html', 'create json',
    'generate csv', 'generate html', 'generate json',
  ];
  
  const hasImageKeywords = imageKeywords.some(keyword => lowerMsg.includes(keyword));
  const hasFileKeywords = fileKeywords.some(keyword => lowerMsg.includes(keyword));
  const hasEditKeywords = editKeywords.some(keyword => lowerMsg.includes(keyword));
  
  if (hasEditKeywords) {
    return { type: 'image', thinkingMode: 'editing_image', suggestedModel: 'google-gemini', isImageTask: true, hasImageKeywords: true, hasFileKeywords: false };
  }
  
  if (hasImageKeywords && hasFileKeywords) {
    return { type: 'both', thinkingMode: 'creating_image', suggestedModel: 'google-gemini', isImageTask: true, hasImageKeywords: true, hasFileKeywords: true };
  }
  
  if (hasImageKeywords) {
    return { type: 'image', thinkingMode: 'creating_image', suggestedModel: 'google-gemini', isImageTask: true, hasImageKeywords: true, hasFileKeywords: false };
  }
  
  if (hasFileKeywords) {
    return { type: 'file', thinkingMode: 'analyzing', suggestedModel: 'file-creator', isImageTask: false, hasImageKeywords: false, hasFileKeywords: true };
  }
  
  return { type: 'text', thinkingMode: 'thinking', suggestedModel: 'onspace-ai', isImageTask: false, hasImageKeywords: false, hasFileKeywords: false };
}

export const AI_MODELS = {
  'image-generator': { name: 'Image Generator', model: 'dalle-3', specialization: 'image' },
  'code-generator': { name: 'Code Generator', model: 'gpt-4o', specialization: 'code' },
  'general-assistant': { name: 'General Assistant', model: 'onspace-ai', specialization: 'general' },
};
