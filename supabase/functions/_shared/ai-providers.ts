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
        model: 'gpt-4-turbo-preview',
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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
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
    // Fallback to OnSpace AI if Mistral key not available
    return callOnSpaceAI(messages, 'mistral-large');
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
 * OnSpace AI Fallback (uses unified gateway)
 * Used when specific provider API keys are not configured
 */
async function callOnSpaceAI(messages: AIMessage[], modelHint: string): Promise<AIResponse> {
  const apiKey = Deno.env.get('ONSPACE_AI_API_KEY');
  const baseUrl = Deno.env.get('ONSPACE_AI_BASE_URL');
  
  if (!apiKey || !baseUrl) {
    return { content: '', model: modelHint, error: 'OnSpace AI not configured' };
  }

  try {
    const modelMap: Record<string, string> = {
      'openai-gpt4': 'openai/gpt-5.1',
      'google-gemini': 'google/gemini-3-flash-preview',
      'claude-3': 'google/gemini-3-flash-preview',
      'groq-llama': 'google/gemini-3-flash-preview',
      'mistral-large': 'google/gemini-3-flash-preview',
    };

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelMap[modelHint] || 'google/gemini-3-flash-preview',
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OnSpace AI error:', errorText);
      return { content: '', model: modelHint, error: `OnSpace AI error: ${errorText}` };
    }

    const data = await response.json();
    return {
      content: data.choices[0].message.content,
      model: modelHint,
    };
  } catch (error) {
    console.error('OnSpace AI error:', error);
    return { content: '', model: modelHint, error: error.message };
  }
}

/**
 * Router function - calls the appropriate AI provider
 */
export async function callAI(modelId: string, messages: AIMessage[]): Promise<AIResponse> {
  console.log(`Routing to AI provider: ${modelId}`);

  switch (modelId) {
    case 'openai-gpt4':
      return await callOpenAI(messages);
    
    case 'google-gemini':
      return await callGemini(messages);
    
    case 'claude-3':
      return await callClaude(messages);
    
    case 'groq-llama':
      return await callGroq(messages);
    
    case 'mistral-large':
      return await callMistral(messages);
    
    default:
      return await callOnSpaceAI(messages, modelId);
  }
}
