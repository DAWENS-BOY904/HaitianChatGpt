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

  // Try multiple models in priority order
  const models = [
    'google/gemini-3-flash-preview',
    'google/gemini-2.5-flash',
    'google/gemini-2.5-flash-lite',
  ];

  for (const model of models) {
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          temperature: 0.7,
          max_tokens: 4096,
          stream: false,
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => response.statusText);
        console.log(`OnSpace AI ${model} failed (${response.status}): ${errText.slice(0, 100)}`);
        continue;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content || content.trim().length === 0) {
        console.log(`OnSpace AI ${model} returned empty content`);
        continue;
      }

      return { content, model: `onspace-ai (${model})` };
    } catch (error: any) {
      console.log(`OnSpace AI ${model} exception:`, error.message);
    }
  }

  return { content: '', model: 'onspace-ai', error: 'FALLBACK_NEEDED' };
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
 * OnSpace AI Image Generation — uses Gemini multimodal via chat/completions
 * The /images/generations endpoint does not exist on OnSpace AI gateway.
 * Instead, we use Gemini image generation models via chat/completions.
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

  // Image-capable models on OnSpace AI gateway (Gemini multimodal)
  const imageModels = [
    'google/gemini-2.0-flash-exp',
    'google/gemini-2.5-flash',
    'google/gemini-3-flash-preview',
  ];

  for (const model of imageModels) {
    try {
      console.log(`[OnSpace AI Image] Trying model: ${model}`);
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'user',
              content: `Generate a high-quality, detailed image based on this description: ${prompt}\n\nRespond with ONLY a base64 encoded PNG image in this exact format: data:image/png;base64,[BASE64_DATA]\n\nDo not include any text explanation.`,
            },
          ],
          max_tokens: 8192,
          temperature: 0.7,
        }),
        signal: AbortSignal.timeout(45000),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => response.statusText);
        console.log(`[OnSpace AI Image] ${model} failed (${response.status}): ${errText.slice(0, 120)}`);
        continue;
      }

      const data = await response.json();
      const content: string = data.choices?.[0]?.message?.content || '';

      // Check for base64 image in response
      if (content.startsWith('data:image/')) {
        console.log(`[OnSpace AI Image] Got base64 image from ${model}`);
        return { imageUrl: content.trim() };
      }

      // Check if response contains a URL
      const urlMatch = content.match(/https?:\/\/[^\s"']+\.(png|jpg|jpeg|webp|gif)/i);
      if (urlMatch) {
        console.log(`[OnSpace AI Image] Got URL from ${model}: ${urlMatch[0]}`);
        return { imageUrl: urlMatch[0] };
      }

      console.log(`[OnSpace AI Image] ${model} returned text-only, trying next model`);
    } catch (e: any) {
      console.log(`[OnSpace AI Image] ${model} exception:`, e.message);
    }
  }

  return { error: 'OnSpace AI image generation unavailable — no image data returned' };
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
    // Try Gemini Imagen model
    const requestBody = {
      contents: [{
        role: 'user',
        parts: [{ text: `Generate a high quality image of: ${prompt}` }]
      }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE']
      }
    };

    // Try gemini-2.0-flash-exp-image-generation first, then fallback
    const models = [
      'gemini-2.0-flash-exp-image-generation',
      'gemini-2.0-flash-preview-image-generation',
      'gemini-1.5-flash',
    ];

    for (const modelName of models) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        console.log(`[Gemini Image] ${modelName} failed:`, response.status);
        continue;
      }

      const data = await response.json();
      const parts = data.candidates?.[0]?.content?.parts || [];
      const imagePart = parts.find((p: any) => p.inlineData);
      
      if (imagePart?.inlineData?.data) {
        const mimeType = imagePart.inlineData.mimeType || 'image/png';
        const dataUrl = `data:${mimeType};base64,${imagePart.inlineData.data}`;
        return { imageUrl: dataUrl };
      }
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
 * Tries all available providers in order, uploads result to Supabase storage
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
  console.log('[Image] Starting smart image generation for prompt:', prompt.slice(0, 80));

  // Priority 1: DALL-E 3 (most reliable if OpenAI key is set)
  const dalleResult = await generateImageWithDalle(prompt);
  if (dalleResult.imageUrl) {
    console.log('[Image] DALL-E 3 success');
    return { imageUrl: dalleResult.imageUrl, model: 'dalle-3', revisedPrompt: dalleResult.revisedPrompt };
  }
  console.log('[Image] DALL-E 3 failed:', dalleResult.error);

  // Priority 2: Gemini native image generation
  const geminiResult = await generateImageWithGemini(prompt);
  if (geminiResult.imageUrl) {
    console.log('[Image] Gemini image success');
    return { imageUrl: geminiResult.imageUrl, model: 'gemini-image' };
  }
  console.log('[Image] Gemini image failed:', geminiResult.error);

  // Priority 3: OnSpace AI (chat/completions with Gemini)
  const onspaceResult = await generateImageWithOnSpaceAI(prompt);
  if (onspaceResult.imageUrl) {
    console.log('[Image] OnSpace AI image success');
    return { imageUrl: onspaceResult.imageUrl, model: 'onspace-ai' };
  }
  console.log('[Image] OnSpace AI image failed:', onspaceResult.error);

  return {
    error: 'Image generation is currently unavailable. All providers failed.',
    model: 'none'
  };
}

/**
 * Main AI router with automatic fallback
 * Priority: OnSpace AI → Groq → Claude → OpenAI → Gemini
 * GUARANTEED: Always returns a valid content string, never empty.
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

      if (response.error || !response.content || response.content.trim().length === 0) {
        console.log(`${currentModel} failed or returned empty: ${response.error || 'empty content'}`);
        continue;
      }

      console.log(`Success with: ${currentModel}`);
      return response;

    } catch (error: any) {
      console.log(`${currentModel} exception: ${error.message}`);
    }
  }

  // HARD FALLBACK — never return empty to the user
  console.log('All AI providers failed — returning guaranteed fallback response');
  return {
    content: "I'm sorry, I'm having trouble connecting right now. Please try again in a moment. If the issue persists, try rephrasing your question.",
    model: 'fallback',
    error: undefined,
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
    // English - logo
    'create a logo', 'create logo', 'generate logo', 'make a logo', 'design a logo', 'build a logo',
    'generate a logo', 'make me a logo', 'design me a logo',
    // English - image/photo/picture
    'create an image', 'create image', 'generate image', 'make an image', 'design an image',
    'generate a photo', 'create a photo', 'make a photo', 'take a photo',
    'generate a picture', 'make a picture', 'generate picture', 'create picture', 'create a picture',
    // English - art/illustration
    'draw a', 'draw me', 'paint a', 'paint me', 'illustrate', 'sketch a', 'sketch me',
    'create art', 'generate art', 'make art', 'create artwork', 'generate artwork',
    // English - icon/banner/thumbnail
    'create an icon', 'create icon', 'generate icon', 'make an icon', 'design an icon',
    'create a banner', 'generate banner', 'make a banner', 'design a banner',
    'create a thumbnail', 'generate thumbnail',
    // English - visual
    'generate a visual', 'create a visual', 'make a visual',
    'create an illustration', 'generate an illustration',
    // Haitian Creole
    'kreye yon logo', 'kreye logo', 'fe yon logo', 'fe logo', 'desine logo',
    'kreye foto', 'kreye imaj', 'fe foto', 'fe imaj', 'kreye yon imaj',
    'fè yon logo', 'fè logo', 'kreye yon foto', 'fè foto',
    // French
    'créer un logo', 'creer un logo', 'générer une image', 'generer une image',
    'créer une image', 'faire un logo', 'dessiner',
    // Spanish
    'crear un logo', 'generar una imagen', 'crear una imagen', 'hacer un logo',
    // Short patterns
    'photo of', 'picture of', 'image of', 'logo for', 'logo of',
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
