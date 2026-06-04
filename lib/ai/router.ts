
/**
 * Context-Aware AI Router for HaitianChatGpt
 * Simplified version for React Native
 */

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
    quizTopic?: string;
    quizDifficulty?: 'easy' | 'medium' | 'hard';
    requiresWebSearch?: boolean;
    searchQuery?: string;
  };
  multimedia?: {
    images?: Array<{
      url: string;
      caption: string;
      alt: string;
    }>;
    videos?: Array<{
      url: string;
      caption: string;
      duration?: number;
    }>;
  };
  structuredData?: {
    type: string;
    props: Record<string, any>;
  };
}

const CONTEXT_AWARE_SYSTEM_PROMPT = `You are an intelligent AI assistant that understands user intent contextually.

Your responses should include structured metadata to help the system understand what type of response is most appropriate.

IMPORTANT: Analyze the user's request and determine if any of these would enhance your response:
- Image generation: If the user asks for visual content, design, diagrams, or if visual representation would significantly enhance understanding
- Video generation: If the user asks for animated content, tutorials, or demonstrations
- Web search: If the user asks about current events, recent news, or real-time information
- Quiz generation: If the user asks to test knowledge, create practice questions, or study materials

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
    "videoDuration": number,
    "quizTopic": "topic if quiz generation is needed",
    "quizDifficulty": "easy|medium|hard",
    "requiresWebSearch": boolean,
    "searchQuery": "search query if web search is needed"
  }
}
\`\`\`

RULES:
1. Always provide your main response content first
2. Only include metadata fields that are relevant
3. Be conservative with image/video generation - only suggest when truly beneficial
4. Provide clear, actionable prompts for any generated content`;

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
      content = response.replace(jsonBlockRegex, '').trim();
    } catch (error) {
      console.error('[Metadata Extraction] Failed to parse JSON block:', error);
    }
  }

  return { content, metadata };
}

export function structuredResponseToMessage(response: StructuredAIResponse): any {
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

export function getContextAwareSystemPrompt(): string {
  return CONTEXT_AWARE_SYSTEM_PROMPT;
}
