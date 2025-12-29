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
export async function callOpenAI(messages: AIMessage[]): Promise<AIResponse> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  
  if (!apiKey) {
    return { content: '', model: 'openai-gpt4', error: 'OpenAI API key not configured' };
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      return { content: '', model: 'openai-gpt4', error: `OpenAI error: ${errorText}` };
    }

    const data = await response.json();
    return {
      content: data.choices[0].message.content,
      model: 'openai-gpt4',
    };
  } catch (error) {
    console.error('OpenAI error:', error);
    return { content: '', model: 'openai-gpt4', error: error.message };
  }
}

/**
 * Google Gemini Pro Integration
 * Best for: Fast responses, multimodal tasks, general queries
 */
export async function callGemini(messages: AIMessage[]): Promise<AIResponse> {
  const apiKey = Deno.env.get('GOOGLE_AI_API_KEY');
  
  if (!apiKey) {
    return { content: '', model: 'google-gemini', error: 'Google AI API key not configured' };
  }

  try {
    // Convert chat messages to Gemini format
    const contents = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    // Add system message as first user message
    const systemMessage = messages.find(m => m.role === 'system');
    if (systemMessage) {
      contents.unshift({
        role: 'user',
        parts: [{ text: systemMessage.content }],
      });
      contents.splice(1, 0, {
        role: 'model',
        parts: [{ text: 'I understand and will follow these instructions.' }],
      });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      return { content: '', model: 'google-gemini', error: `Gemini error: ${errorText}` };
    }

    const data = await response.json();
    return {
      content: data.candidates[0].content.parts[0].text,
      model: 'google-gemini',
    };
  } catch (error) {
    console.error('Gemini error:', error);
    return { content: '', model: 'google-gemini', error: error.message };
  }
}

/**
 * Claude 3 Integration
 * Best for: Creative writing, detailed analysis, safe content
 */
export async function callClaude(messages: AIMessage[]): Promise<AIResponse> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  
  if (!apiKey) {
    return { content: '', model: 'claude-3', error: 'Anthropic API key not configured' };
  }

  try {
    // Extract system message
    const systemMessage = messages.find(m => m.role === 'system')?.content || '';
    const conversationMessages = messages.filter(m => m.role !== 'system');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 4000,
        system: systemMessage,
        messages: conversationMessages.map(m => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API error:', errorText);
      return { content: '', model: 'claude-3', error: `Claude error: ${errorText}` };
    }

    const data = await response.json();
    return {
      content: data.content[0].text,
      model: 'claude-3',
    };
  } catch (error) {
    console.error('Claude error:', error);
    return { content: '', model: 'claude-3', error: error.message };
  }
}

/**
 * Groq LLaMA Integration
 * Best for: Ultra-fast responses, real-time chat, quick queries
 */
export async function callGroq(messages: AIMessage[]): Promise<AIResponse> {
  const apiKey = Deno.env.get('GROQ_API_KEY');
  
  if (!apiKey) {
    return { content: '', model: 'groq-llama', error: 'Groq API key not configured' };
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3-70b-8192',
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Groq API error:', errorText);
      return { content: '', model: 'groq-llama', error: `Groq error: ${errorText}` };
    }

    const data = await response.json();
    return {
      content: data.choices[0].message.content,
      model: 'groq-llama',
    };
  } catch (error) {
    console.error('Groq error:', error);
    return { content: '', model: 'groq-llama', error: error.message };
  }
}

/**
 * Mistral Large Integration
 * Best for: Technical tasks, code generation, balanced performance
 */
export async function callMistral(messages: AIMessage[]): Promise<AIResponse> {
  const apiKey = Deno.env.get('MISTRAL_API_KEY');
  
  if (!apiKey) {
    // Fallback to OpenAI if Mistral key not available
    console.log('⚠️ Mistral API key not found - using OpenAI instead');
    return await callOpenAI(messages);
  }

  try {
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mistral-large-latest',
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Mistral API error:', errorText);
      return { content: '', model: 'mistral-large', error: `Mistral error: ${errorText}` };
    }

    const data = await response.json();
    return {
      content: data.choices[0].message.content,
      model: 'mistral-large',
    };
  } catch (error) {
    console.error('Mistral error:', error);
    return { content: '', model: 'mistral-large', error: error.message };
  }
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
 * Available AI Models with specializations
 */
export const AI_MODELS = {
  // Image Generation
  'image-generator': {
    name: 'Image Generator',
    model: 'google/gemini-2.5-flash-image-preview',
    specialization: 'image',
    description: 'Creates high-quality logos, images, and visual designs'
  },
  'logo-designer': {
    name: 'Logo Designer',
    model: 'google/gemini-2.5-flash-image-preview',
    specialization: 'image',
    description: 'Specialized in professional logo design'
  },
  
  // File Generation
  'file-creator': {
    name: 'File Creator',
    model: 'google/gemini-3-flash-preview',
    specialization: 'file',
    description: 'Generates files in any format (HTML, CSV, JSON, TXT, etc.)'
  },
  
  // Code & Development
  'code-generator': {
    name: 'Code Generator',
    model: 'google/gemini-3-flash-preview',
    specialization: 'code',
    description: 'Expert in code generation and programming'
  },
  'code-debugger': {
    name: 'Code Debugger',
    model: 'google/gemini-3-flash-preview',
    specialization: 'debug',
    description: 'Finds and fixes bugs in code'
  },
  'ui-designer': {
    name: 'UI/UX Designer',
    model: 'google/gemini-3-flash-preview',
    specialization: 'ui',
    description: 'Creates beautiful UI/UX designs and components'
  },
  
  // Data & API
  'api-expert': {
    name: 'API Expert',
    model: 'google/gemini-3-flash-preview',
    specialization: 'api',
    description: 'API integration, REST, GraphQL, and data handling'
  },
  'data-analyst': {
    name: 'Data Analyst',
    model: 'google/gemini-3-flash-preview',
    specialization: 'data',
    description: 'Data analysis, CSV processing, and statistics'
  },
  
  // Content & Writing
  'content-writer': {
    name: 'Content Writer',
    model: 'google/gemini-3-flash-preview',
    specialization: 'writing',
    description: 'Creative writing, articles, and content creation'
  },
  'explainer': {
    name: 'Explainer',
    model: 'google/gemini-3-flash-preview',
    specialization: 'explanation',
    description: 'Explains complex topics in simple terms'
  },
  
  // General
  'general-assistant': {
    name: 'General Assistant',
    model: 'google/gemini-3-flash-preview',
    specialization: 'general',
    description: 'Versatile assistant for all tasks'
  },
  'editor': {
    name: 'Text Editor',
    model: 'google/gemini-3-flash-preview',
    specialization: 'editing',
    description: 'Edits, rewrites, and improves text'
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
 * Generate image using YOUR OpenAI API key
 */
export async function generateImage(prompt: string): Promise<{imageUrl?: string; error?: string}> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  
  if (!apiKey) {
    return { error: 'OpenAI API key not configured' };
  }

  try {
    console.log('🎨 Generating image with YOUR OpenAI API key');
    console.log('📝 Prompt:', prompt);
    
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard'
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenAI DALL-E error:', errorText);
      return { error: `Failed to generate image: ${errorText}` };
    }

    const data = await response.json();
    const imageUrl = data.data?.[0]?.url;
    
    if (!imageUrl) {
      console.error('❌ No image URL in response');
      return { error: 'No image was generated' };
    }

    console.log('✅ Image generated with YOUR OpenAI DALL-E 3');
    return { imageUrl };
  } catch (error) {
    console.error('❌ Image generation error:', error);
    return { error: error.message };
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
  console.log(`🚀 Attempting AI call with model: ${modelId}`);

  // Define fallback order based on primary model
  let fallbackOrder: string[] = [];
  
  switch (modelId) {
    case 'openai-gpt4':
      fallbackOrder = ['openai-gpt4', 'google-gemini', 'claude-3', 'groq-llama'];
      break;
    case 'google-gemini':
      fallbackOrder = ['google-gemini', 'claude-3', 'groq-llama', 'openai-gpt4'];
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
      switch (currentModel) {
        case 'openai-gpt4':
          response = await callOpenAI(messages);
          break;
        case 'google-gemini':
          response = await callGemini(messages);
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
          response = await callGemini(messages);
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
