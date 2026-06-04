/**
 * Context-Aware AI Router
 * Replaces keyword-based intent detection with semantic understanding
 * 
 * This module provides intelligent routing of user requests to appropriate AI functions
 * based on semantic analysis rather than keyword matching.
 */

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export type UserIntent = 
  | 'chat'
  | 'quiz'
  | 'image_generation'
  | 'video_generation'
  | 'web_search'
  | 'analysis'
  | 'code_generation'
  | 'translation'
  | 'summarization'
  | 'creative_writing';

export interface IntentMetadata {
  confidence: number; // 0-1
  reasoning: string;
  parameters?: Record<string, any>;
}

export interface StructuredAIResponse {
  content: string;
  intent: UserIntent;
  metadata: {
    shouldGenerateImage?: boolean;
    imagePrompt?: string;
    imageTopic?: string;
    shouldGenerateVideo?: boolean;
    videoPrompt?: string;
    videoDuration?: number;
    videoAspectRatio?: 'landscape' | 'portrait' | 'square';
    quizTopic?: string;
    quizDifficulty?: 'easy' | 'medium' | 'hard';
    requiresWebSearch?: boolean;
    searchQuery?: string;
    shouldGenerateCode?: boolean;
    codeLanguage?: string;
  };
  multimedia?: {
    images?: Array<{
      url: string;
      caption: string;
      alt: string;
      source?: string;
    }>;
    videos?: Array<{
      url: string;
      caption: string;
      duration?: number;
    }>;
    charts?: Array<{
      type: 'bar' | 'line' | 'pie' | 'scatter';
      data: any;
      title?: string;
    }>;
  };
  structuredData?: {
    type: 'weather' | 'map' | 'calculator' | 'code_block' | 'table' | 'timeline';
    props: Record<string, any>;
  };
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// ============================================================================
// SYSTEM PROMPT FOR CONTEXT-AWARE ROUTING
// ============================================================================

const CONTEXT_AWARE_SYSTEM_PROMPT = `You are an intelligent AI assistant that understands user intent contextually.

Your responses should include structured metadata to help the system understand what type of response is most appropriate.

IMPORTANT: Analyze the user's request and determine if any of these would enhance your response:
- Image generation: If the user asks for visual content, design, diagrams, or if visual representation would significantly enhance understanding
- Video generation: If the user asks for animated content, tutorials, or demonstrations
- Web search: If the user asks about current events, recent news, or real-time information
- Quiz generation: If the user asks to test knowledge, create practice questions, or study materials
- Code generation: If the user asks for code, algorithms, or technical implementations
- Web search: If you need current information to provide an accurate answer

When responding, include a JSON metadata block at the end of your response in this format:
\`\`\`json
{
  "intent": "chat|quiz|image_generation|video_generation|web_search|analysis|code_generation|translation|summarization|creative_writing",
  "metadata": {
    "shouldGenerateImage": boolean,
    "imagePrompt": "detailed prompt if shouldGenerateImage is true",
    "imageTopic": "category of image",
    "shouldGenerateVideo": boolean,
    "videoPrompt": "detailed prompt if shouldGenerateVideo is true",
    "videoDuration": number (in seconds),
    "videoAspectRatio": "landscape|portrait|square",
    "quizTopic": "topic if quiz generation is needed",
    "quizDifficulty": "easy|medium|hard",
    "requiresWebSearch": boolean,
    "searchQuery": "search query if web search is needed",
    "shouldGenerateCode": boolean,
    "codeLanguage": "language if code generation is needed"
  }
}
\`\`\`

RULES:
1. Always provide your main response content first
2. Only include metadata fields that are relevant to your response
3. Be conservative with image/video generation - only suggest when truly beneficial
4. Provide clear, actionable prompts for any generated content
5. Consider user context and conversation history when determining intent`;

// ============================================================================
// INTENT CLASSIFICATION ENGINE
// ============================================================================

/**
 * Classify user intent using the AI model itself
 * This is more intelligent than regex/keyword matching
 */
export async function classifyUserIntent(
  userMessage: string,
  conversationHistory: AIMessage[] = [],
  aiCallFunction: (messages: AIMessage[]) => Promise<string>
): Promise<{ intent: UserIntent; confidence: number; reasoning: string }> {
  const classificationPrompt = `Analyze this user message and determine their primary intent.

User message: "${userMessage}"

Possible intents:
- chat: General conversation or information request
- quiz: Request to test knowledge or create practice questions
- image_generation: Request for visual content, design, or diagrams
- video_generation: Request for animated content or demonstrations
- web_search: Request for current information or recent events
- analysis: Request to analyze data or provide insights
- code_generation: Request for code or technical implementation
- translation: Request to translate between languages
- summarization: Request to summarize content
- creative_writing: Request for creative or imaginative content

Respond with ONLY a JSON object (no markdown, no extra text):
{
  "intent": "one of the above",
  "confidence": 0.0 to 1.0,
  "reasoning": "brief explanation"
}`;

  const messages: AIMessage[] = [
    { role: 'system', content: 'You are an intent classification system. Respond with only valid JSON.' },
    ...conversationHistory,
    { role: 'user', content: classificationPrompt },
  ];

  try {
    const response = await aiCallFunction(messages);
    const parsed = JSON.parse(response);
    return {
      intent: parsed.intent as UserIntent,
      confidence: parsed.confidence,
      reasoning: parsed.reasoning,
    };
  } catch (error) {
    console.error('[Intent Classification] Failed to parse response:', error);
    return {
      intent: 'chat',
      confidence: 0.5,
      reasoning: 'Failed to classify intent, defaulting to chat',
    };
  }
}

// ============================================================================
// STRUCTURED RESPONSE EXTRACTION
// ============================================================================

/**
 * Extract structured metadata from AI response
 * Looks for JSON metadata block at the end of the response
 */
export function extractStructuredMetadata(response: string): {
  content: string;
  metadata: StructuredAIResponse['metadata'];
} {
  const jsonBlockRegex = /```json\n([\s\S]*?)\n```$/;
  const match = response.match(jsonBlockRegex);

  let content = response;
  let metadata: StructuredAIResponse['metadata'] = {};

  if (match) {
    try {
      const parsed = JSON.parse(match[1]);
      metadata = parsed.metadata || {};
      // Remove the JSON block from content
      content = response.replace(jsonBlockRegex, '').trim();
    } catch (error) {
      console.error('[Metadata Extraction] Failed to parse JSON block:', error);
    }
  }

  return { content, metadata };
}

// ============================================================================
// INTELLIGENT RESPONSE BUILDER
// ============================================================================

/**
 * Build a structured AI response with context-aware multimedia
 */
export async function buildStructuredResponse(
  userMessage: string,
  aiResponse: string,
  conversationHistory: AIMessage[] = [],
  aiCallFunction: (messages: AIMessage[]) => Promise<string>,
  imageGenerationFunction?: (prompt: string) => Promise<string>,
  videoGenerationFunction?: (prompt: string, duration: number) => Promise<string>,
  webSearchFunction?: (query: string) => Promise<any>
): Promise<StructuredAIResponse> {
  // Extract metadata from AI response
  const { content, metadata } = extractStructuredMetadata(aiResponse);

  // Classify intent for additional context
  const intentClassification = await classifyUserIntent(
    userMessage,
    conversationHistory,
    aiCallFunction
  );

  // Initialize multimedia object
  const multimedia: StructuredAIResponse['multimedia'] = {};

  // Handle image generation if requested
  if (metadata.shouldGenerateImage && imageGenerationFunction) {
    try {
      const imageUrl = await imageGenerationFunction(
        metadata.imagePrompt || userMessage
      );
      multimedia.images = [
        {
          url: imageUrl,
          caption: metadata.imagePrompt || 'Generated image',
          alt: metadata.imageTopic || 'AI generated image',
          source: 'ai-generated',
        },
      ];
    } catch (error) {
      console.error('[Image Generation] Failed:', error);
    }
  }

  // Handle video generation if requested
  if (metadata.shouldGenerateVideo && videoGenerationFunction) {
    try {
      const videoUrl = await videoGenerationFunction(
        metadata.videoPrompt || userMessage,
        metadata.videoDuration || 6
      );
      multimedia.videos = [
        {
          url: videoUrl,
          caption: metadata.videoPrompt || 'Generated video',
          duration: metadata.videoDuration || 6,
        },
      ];
    } catch (error) {
      console.error('[Video Generation] Failed:', error);
    }
  }

  // Handle web search if requested
  if (metadata.requiresWebSearch && webSearchFunction) {
    try {
      const searchResults = await webSearchFunction(
        metadata.searchQuery || userMessage
      );
      // Incorporate search results into response
      // This could be done by calling the AI again with search results
    } catch (error) {
      console.error('[Web Search] Failed:', error);
    }
  }

  return {
    content,
    intent: intentClassification.intent,
    metadata,
    multimedia: Object.keys(multimedia).length > 0 ? multimedia : undefined,
  };
}

// ============================================================================
// CONTEXT-AWARE ROUTING SYSTEM
// ============================================================================

/**
 * Main routing system that determines what to do with user input
 */
export async function routeUserRequest(
  userMessage: string,
  conversationHistory: AIMessage[] = [],
  aiCallFunction: (messages: AIMessage[]) => Promise<string>,
  handlers: {
    chat?: (message: string) => Promise<string>;
    quiz?: (topic: string, difficulty: string) => Promise<any>;
    imageGeneration?: (prompt: string) => Promise<string>;
    videoGeneration?: (prompt: string, duration: number) => Promise<string>;
    webSearch?: (query: string) => Promise<any>;
    codeGeneration?: (prompt: string, language: string) => Promise<string>;
  } = {}
): Promise<StructuredAIResponse> {
  // Classify user intent
  const intentClassification = await classifyUserIntent(
    userMessage,
    conversationHistory,
    aiCallFunction
  );

  console.log('[Routing] Detected intent:', intentClassification.intent);

  // Route to appropriate handler based on intent
  switch (intentClassification.intent) {
    case 'quiz':
      if (handlers.quiz) {
        const quizResult = await handlers.quiz('General Knowledge', 'medium');
        return {
          content: 'Quiz generated',
          intent: 'quiz',
          metadata: { quizTopic: 'General Knowledge', quizDifficulty: 'medium' },
          structuredData: { type: 'code_block', props: quizResult },
        };
      }
      break;

    case 'image_generation':
      if (handlers.imageGeneration) {
        const imageUrl = await handlers.imageGeneration(userMessage);
        return {
          content: 'Image generated',
          intent: 'image_generation',
          metadata: { shouldGenerateImage: true, imagePrompt: userMessage },
          multimedia: {
            images: [
              {
                url: imageUrl,
                caption: userMessage,
                alt: 'Generated image',
                source: 'ai-generated',
              },
            ],
          },
        };
      }
      break;

    case 'video_generation':
      if (handlers.videoGeneration) {
        const videoUrl = await handlers.videoGeneration(userMessage, 6);
        return {
          content: 'Video generated',
          intent: 'video_generation',
          metadata: { shouldGenerateVideo: true, videoPrompt: userMessage, videoDuration: 6 },
          multimedia: {
            videos: [
              {
                url: videoUrl,
                caption: userMessage,
                duration: 6,
              },
            ],
          },
        };
      }
      break;

    case 'code_generation':
      if (handlers.codeGeneration) {
        const code = await handlers.codeGeneration(userMessage, 'javascript');
        return {
          content: code,
          intent: 'code_generation',
          metadata: { shouldGenerateCode: true, codeLanguage: 'javascript' },
          structuredData: { type: 'code_block', props: { code, language: 'javascript' } },
        };
      }
      break;

    case 'web_search':
      if (handlers.webSearch) {
        const searchResults = await handlers.webSearch(userMessage);
        return {
          content: `Search results for: ${userMessage}`,
          intent: 'web_search',
          metadata: { requiresWebSearch: true, searchQuery: userMessage },
        };
      }
      break;

    case 'chat':
    default:
      // For general chat, use the AI to generate a response
      const aiResponse = await aiCallFunction([
        { role: 'system', content: CONTEXT_AWARE_SYSTEM_PROMPT },
        ...conversationHistory,
        { role: 'user', content: userMessage },
      ]);

      return await buildStructuredResponse(
        userMessage,
        aiResponse,
        conversationHistory,
        aiCallFunction,
        handlers.imageGeneration,
        handlers.videoGeneration,
        handlers.webSearch
      );
  }

  // Fallback to general chat
  const aiResponse = await aiCallFunction([
    { role: 'system', content: CONTEXT_AWARE_SYSTEM_PROMPT },
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ]);

  return await buildStructuredResponse(
    userMessage,
    aiResponse,
    conversationHistory,
    aiCallFunction,
    handlers.imageGeneration,
    handlers.videoGeneration,
    handlers.webSearch
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Convert structured response to message format for storage
 */
export function structuredResponseToMessage(response: StructuredAIResponse): {
  content: string;
  image_url?: string;
  image_urls?: string[];
  video_url?: string;
  multimedia?: any;
  structuredData?: any;
} {
  const message: any = {
    content: response.content,
  };

  if (response.multimedia?.images && response.multimedia.images.length > 0) {
    message.image_url = response.multimedia.images[0].url;
    if (response.multimedia.images.length > 1) {
      message.image_urls = response.multimedia.images.map(img => img.url);
    }
    message.multimedia = response.multimedia;
  }

  if (response.multimedia?.videos && response.multimedia.videos.length > 0) {
    message.video_url = response.multimedia.videos[0].url;
    message.multimedia = response.multimedia;
  }

  if (response.structuredData) {
    message.structuredData = response.structuredData;
  }

  return message;
}
