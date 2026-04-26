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
        model: 'gpt-4o',
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        temperature: 0.7,
        max_tokens: 4096,
      }),
      signal: AbortSignal.timeout(30000),
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
      return { content: '', model: 'google-gemini', error: 'FALLBACK_NEEDED' };
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      return { content: '', model: 'google-gemini', error: 'FALLBACK_NEEDED' };
    }

    return { content, model: `google-gemini (${validModelName})` };

  } catch (error: any) {
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

// ─────────────────────────────────────────────────────────────────────────────
// IMAGE GENERATION — FIXED DALL-E 3 + STABILITY AI FALLBACK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build an enhanced image prompt for logos and designs
 */
function buildEnhancedImagePrompt(userPrompt: string): string {
  const lowerPrompt = userPrompt.toLowerCase();
  const isLogo = lowerPrompt.includes('logo') || lowerPrompt.includes('brand') || lowerPrompt.includes('icon');
  const isDesign = lowerPrompt.includes('design') || lowerPrompt.includes('banner') || lowerPrompt.includes('poster');

  if (isLogo) {
    return `Professional logo design: ${userPrompt}. High quality, clean vector-style design, transparent background preferred, modern typography, suitable for business use. Sharp edges, vibrant colors, scalable design. Studio quality, ultra high resolution.`;
  }
  if (isDesign) {
    return `Professional graphic design: ${userPrompt}. High quality, modern aesthetic, clean layout, vibrant colors, professional finish. Ultra high resolution, studio quality.`;
  }
  return `${userPrompt}. High quality, detailed, professional, ultra high resolution, photorealistic or artistic as appropriate.`;
}

/**
 * DALL-E 3 Image Generation via OpenAI (FIXED endpoint)
 */
export async function generateImageWithDalle(prompt: string): Promise<{
  imageUrl?: string;
  revisedPrompt?: string;
  error?: string;
}> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    console.log('[Image] OPENAI_API_KEY not set — skipping DALL-E');
    return { error: 'Missing OPENAI_API_KEY' };
  }

  const enhancedPrompt = buildEnhancedImagePrompt(prompt);

  try {
    console.log('[Image] Trying DALL-E 3 via OpenAI...');
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: enhancedPrompt.slice(0, 4000),
        n: 1,
        size: '1024x1024',
        quality: 'hd',
        style: 'vivid',
        response_format: 'url',
      }),
      signal: AbortSignal.timeout(60000),
    });

    const data = await response.json();

    if (!response.ok) {
      const errMsg = data.error?.message || `OpenAI Error: ${response.status}`;
      console.log(`[Image] DALL-E 3 failed (${response.status}): ${errMsg.slice(0, 200)}`);
      // If quota exceeded, try the b64_json format as alternative
      if (response.status === 429) {
        console.log('[Image] DALL-E quota exceeded');
      }
      return { error: errMsg };
    }

    const imageResult = data.data?.[0];
    if (!imageResult) {
      return { error: 'No image data in DALL-E response' };
    }

    // Handle both URL and base64 responses
    const imageUrl = imageResult.url || (imageResult.b64_json ? `data:image/png;base64,${imageResult.b64_json}` : undefined);
    if (!imageUrl) {
      return { error: 'No image URL returned from DALL-E' };
    }

    console.log('[Image] DALL-E 3 success!');
    return { imageUrl, revisedPrompt: imageResult.revised_prompt };

  } catch (error: any) {
    console.log('[Image] DALL-E 3 exception:', error.message);
    return { error: error.message || 'DALL-E request failed' };
  }
}

/**
 * ElevenLabs Image Generation (Priority 2 — after DALL-E 3)
 * Uses the ElevenLabs text-to-image endpoint
 */
export async function generateImageWithElevenLabs(prompt: string): Promise<{
  imageUrl?: string;
  error?: string;
}> {
  const apiKey = Deno.env.get('ELEVENLABS_API_KEY');
  if (!apiKey) {
    console.log('[Image] ELEVENLABS_API_KEY not set — skipping ElevenLabs');
    return { error: 'ElevenLabs key not configured' };
  }

  const enhancedPrompt = buildEnhancedImagePrompt(prompt);

  try {
    console.log('[Image] Trying ElevenLabs image generation...');
    const response = await fetch('https://api.elevenlabs.io/v1/text-to-image', {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: enhancedPrompt.slice(0, 2000),
        output_format: 'jpeg',
        width: 1024,
        height: 1024,
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => response.statusText);
      console.log(`[Image] ElevenLabs failed (${response.status}): ${errText.slice(0, 200)}`);
      return { error: `ElevenLabs error: ${response.status}` };
    }

    // ElevenLabs returns binary image data directly
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    if (contentType.startsWith('image/')) {
      const arrayBuffer = await response.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);
      const imageUrl = `data:${contentType};base64,${base64}`;
      console.log('[Image] ElevenLabs success!');
      return { imageUrl };
    }

    // If JSON response with URL
    const data = await response.json().catch(() => null);
    if (data?.url) {
      console.log('[Image] ElevenLabs success (URL response)');
      return { imageUrl: data.url };
    }
    if (data?.image_url) {
      console.log('[Image] ElevenLabs success (image_url field)');
      return { imageUrl: data.image_url };
    }
    if (data?.data?.[0]?.url) {
      return { imageUrl: data.data[0].url };
    }

    return { error: 'No image data returned from ElevenLabs' };
  } catch (error: any) {
    console.log('[Image] ElevenLabs exception:', error.message);
    return { error: error.message || 'ElevenLabs request failed' };
  }
}

/**
 * Stability AI Image Generation (FALLBACK)
 * Uses the stable-diffusion-xl-1024-v1-0 model
 */
export async function generateImageWithStabilityAI(prompt: string): Promise<{
  imageUrl?: string;
  error?: string;
}> {
  const apiKey = Deno.env.get('STABILITY_AI_API_KEY');
  if (!apiKey) {
    console.log('[Image] STABILITY_AI_API_KEY not set — skipping Stability AI');
    return { error: 'Stability AI key not configured' };
  }

  const enhancedPrompt = buildEnhancedImagePrompt(prompt);

  try {
    console.log('[Image] Trying Stability AI SDXL...');
    const response = await fetch('https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        text_prompts: [
          { text: enhancedPrompt.slice(0, 2000), weight: 1 },
          { text: 'blurry, low quality, distorted, ugly, bad anatomy, watermark', weight: -0.8 },
        ],
        cfg_scale: 8,
        height: 1024,
        width: 1024,
        samples: 1,
        steps: 35,
        style_preset: 'digital-art',
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => response.statusText);
      console.log(`[Image] Stability AI failed (${response.status}): ${errText.slice(0, 200)}`);
      return { error: `Stability AI error: ${response.status}` };
    }

    const data = await response.json();
    const artifact = data.artifacts?.[0];

    if (!artifact?.base64) {
      return { error: 'No image data from Stability AI' };
    }

    const imageUrl = `data:image/png;base64,${artifact.base64}`;
    console.log('[Image] Stability AI success!');
    return { imageUrl };

  } catch (error: any) {
    console.log('[Image] Stability AI exception:', error.message);
    return { error: error.message };
  }
}

/**
 * OnSpace AI Image Generation via chat completions
 * Tries multiple image-capable models
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

  const enhancedPrompt = buildEnhancedImagePrompt(prompt);

  // Try Gemini image generation models via OnSpace AI gateway
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
              content: `Generate a high-quality image based on this description: ${enhancedPrompt}\n\nRespond with ONLY a base64 encoded PNG image in this exact format: data:image/png;base64,[BASE64_DATA]\n\nDo not include any text explanation.`,
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

      if (content.startsWith('data:image/')) {
        console.log(`[OnSpace AI Image] Got base64 image from ${model}`);
        return { imageUrl: content.trim() };
      }

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

  return { error: 'OnSpace AI image generation unavailable' };
}

/**
 * Gemini Native Image Generation
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
    const enhancedPrompt = buildEnhancedImagePrompt(prompt);
    const requestBody = {
      contents: [{
        role: 'user',
        parts: [{ text: `Generate a high quality image of: ${enhancedPrompt}` }]
      }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE']
      }
    };

    const models = [
      'gemini-2.0-flash-exp-image-generation',
      'gemini-2.0-flash-preview-image-generation',
    ];

    for (const modelName of models) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(45000),
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
        console.log(`[Gemini Image] Success with ${modelName}`);
        return { imageUrl: dataUrl };
      }
    }

    return { error: 'No image data received from Gemini' };

  } catch (error: any) {
    return { error: error.message || 'Gemini image error' };
  }
}

/**
 * SMART IMAGE GENERATION ROUTER
 * Priority: DALL-E 3 → Stability AI → Gemini → OnSpace AI
 * Uploads base64 images to Supabase storage and returns public URL
 */
export async function generateImageSmart(
  prompt: string,
  preferredModel: string = 'gemini',
  supabaseAdmin?: any
): Promise<{
  imageUrl?: string;
  model: string;
  error?: string;
  revisedPrompt?: string;
}> {
  console.log('[Image] Smart generation for prompt:', prompt.slice(0, 100));

  // Helper to upload base64 to storage
  async function uploadBase64Image(dataUrl: string): Promise<string | null> {
    if (!supabaseAdmin) return null;
    try {
      const matches = dataUrl.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
      if (!matches) return null;
      const mimeType = matches[1];
      const ext = mimeType.split('/')[1]?.replace('+xml', '') || 'png';
      const base64Data = matches[2];
      const binary = atob(base64Data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const fileName = `ai-gen/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadErr } = await supabaseAdmin.storage
        .from('chat-images')
        .upload(fileName, bytes, { contentType: mimeType, upsert: true });
      if (uploadErr) {
        console.error('[Image] Storage upload error:', uploadErr.message);
        return null;
      }
      const { data: urlData } = supabaseAdmin.storage.from('chat-images').getPublicUrl(fileName);
      return urlData?.publicUrl || null;
    } catch (e: any) {
      console.error('[Image] Upload exception:', e.message);
      return null;
    }
  }

  async function resolveImageUrl(rawUrl: string): Promise<string> {
    if (rawUrl.startsWith('data:image/')) {
      const uploaded = await uploadBase64Image(rawUrl);
      return uploaded || rawUrl; // Fall back to data URL if upload fails
    }
    return rawUrl;
  }

  // ── Priority 1: DALL-E 3 (OpenAI) ─────────────────────────────────────────
  const dalleResult = await generateImageWithDalle(prompt);
  if (dalleResult.imageUrl) {
    const resolvedUrl = await resolveImageUrl(dalleResult.imageUrl);
    console.log('[Image] DALL-E 3 success, URL resolved:', resolvedUrl.startsWith('http') ? 'public URL' : 'data URL');
    return { imageUrl: resolvedUrl, model: 'dalle-3', revisedPrompt: dalleResult.revisedPrompt };
  }
  console.log('[Image] DALL-E 3 failed:', dalleResult.error);

  // ── Priority 2: ElevenLabs ────────────────────────────────────────────────
  const elevenLabsResult = await generateImageWithElevenLabs(prompt);
  if (elevenLabsResult.imageUrl) {
    const resolvedUrl = await resolveImageUrl(elevenLabsResult.imageUrl);
    console.log('[Image] ElevenLabs success');
    return { imageUrl: resolvedUrl, model: 'elevenlabs' };
  }
  console.log('[Image] ElevenLabs failed:', elevenLabsResult.error);

  const stabilityResult = await generateImageWithStabilityAI(prompt);
  if (stabilityResult.imageUrl) {
    const resolvedUrl = await resolveImageUrl(stabilityResult.imageUrl);
    console.log('[Image] Stability AI success');
    return { imageUrl: resolvedUrl, model: 'stability-ai' };
  }
  console.log('[Image] Stability AI failed:', stabilityResult.error);

  // ── Priority 4: Gemini native ──────────────────────────────────────────────
  const geminiResult = await generateImageWithGemini(prompt);
  if (geminiResult.imageUrl) {
    const resolvedUrl = await resolveImageUrl(geminiResult.imageUrl);
    console.log('[Image] Gemini image success');
    return { imageUrl: resolvedUrl, model: 'gemini-image' };
  }
  console.log('[Image] Gemini image failed:', geminiResult.error);

  // ── Priority 5: OnSpace AI ─────────────────────────────────────────────────
  const onspaceResult = await generateImageWithOnSpaceAI(prompt);
  if (onspaceResult.imageUrl) {
    const resolvedUrl = await resolveImageUrl(onspaceResult.imageUrl);
    console.log('[Image] OnSpace AI image success');
    return { imageUrl: resolvedUrl, model: 'onspace-ai' };
  }
  console.log('[Image] OnSpace AI failed:', onspaceResult.error);

  return {
    error: 'Image generation is temporarily unavailable. All providers failed.',
    model: 'none'
  };
}

/**
 * Main AI router with automatic fallback
 */
export async function callAI(modelId: string, messages: AIMessage[], isImageTask: boolean = false): Promise<AIResponse> {
  console.log(`AI Request - model: ${modelId}, imageTask: ${isImageTask}`);

  if (isImageTask && isTextOnlyModel(modelId)) {
    modelId = 'google-gemini';
  }

  const fallbackOrder = ['onspace-ai', 'groq-llama', 'claude-3', 'openai-gpt4', 'google-gemini'];

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

  // HARD FALLBACK
  console.log('All AI providers failed — returning guaranteed fallback response');
  return {
    content: "I'm sorry, I'm having trouble connecting right now. Please try again in a moment. If the issue persists, try rephrasing your question.",
    model: 'fallback',
    error: undefined,
  };
}

/**
 * Detect content type from user message
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
    // English — explicit creation intent only
    'create a logo', 'create logo', 'generate logo', 'make a logo', 'design a logo', 'build a logo',
    'generate a logo', 'make me a logo', 'design me a logo',
    'create an image', 'create image', 'generate image', 'make an image', 'design an image',
    'generate a photo', 'create a photo', 'make a photo',
    'generate a picture', 'make a picture', 'generate picture', 'create picture', 'create a picture',
    'draw a picture', 'draw me a', 'draw me an', 'draw me a picture',
    'paint a picture', 'paint me a', 'paint me an',
    'illustrate a', 'illustrate me',
    'sketch a picture', 'sketch me a',
    'create art', 'generate art', 'make art', 'create artwork', 'generate artwork',
    'create an icon', 'create icon', 'generate icon', 'make an icon', 'design an icon',
    'create a banner', 'generate banner', 'make a banner', 'design a banner',
    'create a thumbnail', 'generate thumbnail',
    'generate a visual', 'create a visual', 'make a visual',
    'create an illustration', 'generate an illustration',
    // Haitian Creole — explicit creation
    'kreye yon logo', 'kreye logo', 'fe yon logo', 'fe logo', 'desine logo',
    'kreye foto', 'kreye imaj', 'fe imaj', 'kreye yon imaj', 'kreye yon foto',
    'fè yon logo', 'fè logo', 'fè yon imaj', 'fè imaj',
    // French — explicit creation
    'créer un logo', 'creer un logo', 'générer une image', 'generer une image',
    'créer une image', 'faire un logo', 'dessine moi', 'génère une image',
    // Spanish — explicit creation
    'crear un logo', 'generar una imagen', 'crear una imagen', 'hacer un logo',
    // Generic generation phrases (must contain action verbs)
    'generate an image of', 'create an image of', 'make an image of',
    'generate a picture of', 'create a picture of', 'make a picture of',
    'generate a photo of', 'create a photo of', 'make a photo of',
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
