/**
 * Updated Chat Edge Function with Context-Aware Routing and Error Handling
 * This is a reference implementation showing how to integrate the new systems
 * 
 * Integration steps:
 * 1. Import the new modules
 * 2. Add the context-aware system prompt to messages
 * 3. Extract structured metadata from AI responses
 * 4. Return structured responses to the client
 */

import { corsHeaders } from '../_shared/cors.ts';
import { callAI, generateImageSmart, searchImages } from '../_shared/ai-providers.ts';
import { createStreamingResponse } from '../_shared/streaming.ts';

// Import new modules
import { 
  extractStructuredMetadata, 
  getContextAwareSystemPrompt,
  StructuredAIResponse 
} from '../_shared/context-aware-router.ts';

interface ChatBody {
  messages: Array<{ role: string; content: unknown; image_url?: string }>;
  conversationId: string;
  aiModel?: string;
  fileContents?: Array<{ name: string; type: string; content: string }>;
  base64Image?: string;
}

// ── Enhanced handler with context-aware routing ────────────────────────────

async function handleChatRequest(body: ChatBody, userId: string): Promise<Response> {
  try {
    // Validate input
    if (!body.messages || !Array.isArray(body.messages)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid messages format', 
          code: 'INVALID_INPUT' 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Build messages with context-aware system prompt
    const systemPrompt = getContextAwareSystemPrompt();
    const messagesWithSystem = [
      { role: 'system', content: systemPrompt },
      ...body.messages,
    ];

    // Call AI with context-aware system prompt
    const aiResponse = await callAI(
      body.aiModel || 'google-gemini',
      messagesWithSystem as any
    );

    if (aiResponse.error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: aiResponse.error,
          code: 'AI_ERROR'
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Extract structured metadata from AI response
    const { content, metadata } = extractStructuredMetadata(aiResponse.content || '');

    // Build structured response
    const structuredResponse: StructuredAIResponse = {
      content,
      intent: 'chat', // Default intent; could be enhanced with AI classification
      metadata,
      multimedia: {},
    };

    // Handle image generation if requested
    if (metadata.shouldGenerateImage && metadata.imagePrompt) {
      try {
        const imageResult = await generateImageSmart(metadata.imagePrompt);
        if (imageResult.imageUrl) {
          structuredResponse.multimedia!.images = [
            {
              url: imageResult.imageUrl,
              caption: metadata.imagePrompt,
              alt: metadata.imageTopic || 'Generated image',
            },
          ];
        }
      } catch (error) {
        console.error('[Image Generation] Failed:', error);
      }
    }

    // Handle web search if requested
    if (metadata.requiresWebSearch && metadata.searchQuery) {
      try {
        const searchResult = await searchImages(metadata.searchQuery);
        if (searchResult.images && searchResult.images.length > 0) {
          structuredResponse.multimedia!.images = searchResult.images.map(img => ({
            url: img.url,
            caption: img.title || metadata.searchQuery,
            alt: img.title || 'Search result',
          }));
        }
      } catch (error) {
        console.error('[Web Search] Failed:', error);
      }
    }

    // Return structured response
    return new Response(
      JSON.stringify({
        success: true,
        data: structuredResponse,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Chat Handler] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        code: 'INTERNAL_ERROR'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// ── Main handler ───────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json() as ChatBody;
    const userId = req.headers.get('x-user-id') || 'anonymous';

    // Handle the chat request
    return await handleChatRequest(body, userId);
  } catch (error) {
    console.error('[Main Handler] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        code: 'INTERNAL_ERROR'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});
