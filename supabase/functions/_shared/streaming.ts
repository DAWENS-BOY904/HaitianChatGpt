/**
 * Streaming Response Handler
 * Converts non-streaming AI responses into SSE (Server-Sent Events) streams
 * for real-time token-by-token rendering in the client
 */

export interface StreamChunk {
  content: string
  done: boolean
  model?: string
  error?: string
  tokens?: string[]
  delay?: number
}

/**
 * Smart content analysis for adaptive streaming
 */
function analyzeContent(text: string) {
  const sentences = text.split(/([.!?]+)/).filter(s => s.trim().length > 0);
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const hasCode = text.includes('```');
  const hasLists = /^[\s]*[-*•]\s/m.test(text) || /^\d+\.\s/m.test(text);
  const avgWordLength = words.length > 0 
    ? words.reduce((sum, word) => sum + word.length, 0) / words.length 
    : 0;

  return {
    sentences,
    words,
    hasCode,
    hasLists,
    avgWordLength,
    isLong: text.length > 1000,
    isShort: text.length < 100
  };
}

/**
 * Calculate adaptive streaming delay based on content
 */
function getAdaptiveDelay(content: string, baseDelay: number = 15): number {
  const analysis = analyzeContent(content);

  // Faster for short responses
  if (analysis.isShort) return Math.max(8, baseDelay * 0.6);

  // Slower for code blocks
  if (analysis.hasCode) return Math.max(12, baseDelay * 1.2);

  // Normal for regular text
  return baseDelay;
}

/**
 * Smart chunking that preserves sentence boundaries and formatting
 */
function createSmartChunks(text: string): string[] {
  const analysis = analyzeContent(text);
  const chunks: string[] = [];

  if (analysis.hasCode) {
    // For code, chunk by lines but keep code blocks together
    const parts = text.split(/(```[\s\S]*?```)/g);
    for (const part of parts) {
      if (part.startsWith('```')) {
        // Code block - send as one chunk
        chunks.push(part);
      } else {
        // Regular text - chunk by sentences
        const sentences = part.split(/([.!?]+\s*)/).filter(s => s.trim());
        let currentSentence = '';
        for (const sentence of sentences) {
          currentSentence += sentence;
          // When we have a complete sentence (ends with punctuation), process it
          if (/[.!?]$/.test(sentence.trim())) {
            const words = currentSentence.trim().split(/\s+/);
            // Send 3-5 words at a time for natural flow
            for (let i = 0; i < words.length; i += 4) {
              const chunk = words.slice(i, i + 4).join(' ') + ' ';
              if (chunk.trim()) chunks.push(chunk);
            }
            currentSentence = '';
          }
        }
        // Handle any remaining text
        if (currentSentence.trim()) {
          const words = currentSentence.trim().split(/\s+/);
          for (let i = 0; i < words.length; i += 4) {
            const chunk = words.slice(i, i + 4).join(' ') + ' ';
            if (chunk.trim()) chunks.push(chunk);
          }
        }
      }
    }
  } else if (analysis.hasLists) {
    // For lists, preserve list item boundaries
    const lines = text.split('\n');
    let currentChunk = '';

    for (const line of lines) {
      if (line.match(/^[\s]*[-*•]\s/) || line.match(/^\d+\.\s/)) {
        // Start of new list item
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim() + '\n');
          currentChunk = '';
        }
        currentChunk = line + '\n';
      } else if (line.trim()) {
        currentChunk += line + '\n';
      }
    }
    if (currentChunk.trim()) chunks.push(currentChunk.trim());
  } else {
    // Regular text - chunk by natural language units
    const sentences = text.split(/([.!?]+\s*)/).filter(s => s.trim());
    let currentSentence = '';

    for (let i = 0; i < sentences.length; i++) {
      currentSentence += sentences[i];
      // When we have a complete sentence, process it
      if (/[.!?]$/.test(sentences[i].trim())) {
        const chunk = currentSentence.trim();
        if (chunk) {
          const words = chunk.split(/\s+/);
          // Send 2-3 words at a time for smooth flow
          for (let j = 0; j < words.length; j += 3) {
            const wordChunk = words.slice(j, j + 3).join(' ') + ' ';
            if (wordChunk.trim()) chunks.push(wordChunk);
          }
        }
        currentSentence = '';
      }
    }
    // Handle any remaining text
    if (currentSentence.trim()) {
      const words = currentSentence.trim().split(/\s+/);
      for (let j = 0; j < words.length; j += 3) {
        const wordChunk = words.slice(j, j + 3).join(' ') + ' ';
        if (wordChunk.trim()) chunks.push(wordChunk);
      }
    }
  }

  return chunks.filter(chunk => chunk.trim().length > 0);
}

/**
 * Create a streaming response from a complete text
 * Uses intelligent chunking and adaptive delays for better UX
 */
export function createStreamingResponse(text: string, model: string, delayMs: number = 15): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      let isClosed = false;

      const safeClose = () => {
        if (!isClosed) {
          isClosed = true;
          controller.close();
        }
      };

      const safeEnqueue = (data: Uint8Array) => {
        if (!isClosed) {
          controller.enqueue(data);
        }
      };

      try {
        // Use a generator-like approach for memory efficiency with large texts
        const chunks = createSmartChunks(text);
        const adaptiveDelay = getAdaptiveDelay(text, delayMs);
        let totalSent = 0;

        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          totalSent += chunk.length;

          // Calculate progress for potential future use
          const progress = Math.round((totalSent / text.length) * 100);

          const streamChunk: StreamChunk = {
            content: chunk,
            done: false,
            model,
            tokens: [chunk],
            delay: adaptiveDelay
          };

          safeEnqueue(encoder.encode(`data: ${JSON.stringify(streamChunk)}\n\n`));

          // Adaptive delay based on content type and position
          let currentDelay = adaptiveDelay;

          // Slightly faster at the beginning, slower at the end for dramatic effect
          if (i < chunks.length * 0.2) {
            currentDelay *= 0.8; // 20% faster at start
          } else if (i > chunks.length * 0.8) {
            currentDelay *= 1.2; // 20% slower at end
          }

          // Add punctuation pauses
          if (chunk.includes('.') || chunk.includes('!') || chunk.includes('?')) {
            currentDelay *= 1.5;
          }

          await new Promise(resolve => setTimeout(resolve, Math.max(5, currentDelay)));
        }

        // Send final completion chunk
        const finalChunk: StreamChunk = {
          content: '',
          done: true,
          model
        };
        safeEnqueue(encoder.encode(`data: ${JSON.stringify(finalChunk)}\n\n`));
        safeClose();

      } catch (error) {
        console.error('Streaming error:', error);
        const errorChunk: StreamChunk = {
          content: '',
          done: true,
          error: error instanceof Error ? error.message : 'Streaming failed'
        };
        safeEnqueue(encoder.encode(`data: ${JSON.stringify(errorChunk)}\n\n`));
        safeClose();
      }
    }
  });
}

/**
 * Create error stream with better error messaging
 */
export function createErrorStream(error: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      let isClosed = false;

      const safeClose = () => {
        if (!isClosed) {
          isClosed = true;
          controller.close();
        }
      };

      try {
        const errorChunk: StreamChunk = {
          content: '',
          done: true,
          error
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorChunk)}\n\n`));
        safeClose();
      } catch (e) {
        safeClose();
      }
    }
  });
}

/**
 * Create a streaming response with custom chunking strategy
 */
export function createCustomStreamingResponse(
  text: string,
  model: string,
  options: {
    chunkSize?: number;
    delayMs?: number;
    preserveFormatting?: boolean;
  } = {}
): ReadableStream<Uint8Array> {
  const {
    chunkSize = 50, // characters per chunk
    delayMs = 15,
    preserveFormatting = true
  } = options;

  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      let isClosed = false;

      const safeClose = () => {
        if (!isClosed) {
          isClosed = true;
          controller.close();
        }
      };

      const safeEnqueue = (data: Uint8Array) => {
        if (!isClosed) {
          controller.enqueue(data);
        }
      };

      try {
        let position = 0;

        while (position < text.length) {
          const endPos = Math.min(position + chunkSize, text.length);
          const chunk = text.slice(position, endPos);
          position = endPos;

          const isDone = position >= text.length;
          const streamChunk: StreamChunk = {
            content: chunk,
            done: isDone,
            model,
            delay: delayMs
          };

          safeEnqueue(encoder.encode(`data: ${JSON.stringify(streamChunk)}\n\n`));

          if (!isDone) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }
        }

        safeClose();

      } catch (error) {
        console.error('Custom streaming error:', error);
        const errorChunk: StreamChunk = {
          content: '',
          done: true,
          error: error instanceof Error ? error.message : 'Streaming failed'
        };
        safeEnqueue(encoder.encode(`data: ${JSON.stringify(errorChunk)}\n\n`));
        safeClose();
      }
    }
  });
}

/**
 * Memory-efficient streaming for very large texts
 * Uses lazy chunking instead of creating all chunks upfront
 */
export function createLazyStreamingResponse(
  text: string,
  model: string,
  delayMs: number = 15
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      let isClosed = false;
      let position = 0;

      const safeClose = () => {
        if (!isClosed) {
          isClosed = true;
          controller.close();
        }
      };

      const safeEnqueue = (data: Uint8Array) => {
        if (!isClosed) {
          controller.enqueue(data);
        }
      };

      try {
        const adaptiveDelay = getAdaptiveDelay(text, delayMs);

        // Simple word-based lazy chunking for memory efficiency
        const words = text.split(/(\s+)/); // Keep whitespace as separate tokens
        let currentChunk = '';
        let wordCount = 0;
        const wordsPerChunk = 3;

        for (let i = 0; i < words.length; i++) {
          const word = words[i];
          currentChunk += word;

          // Count non-whitespace words
          if (word.trim()) {
            wordCount++;
          }

          // Send chunk when we have enough words or at the end
          if (wordCount >= wordsPerChunk || i === words.length - 1) {
            if (currentChunk) {
              const isDone = i === words.length - 1;

              const streamChunk: StreamChunk = {
                content: currentChunk,
                done: isDone,
                model,
                delay: adaptiveDelay
              };

              safeEnqueue(encoder.encode(`data: ${JSON.stringify(streamChunk)}\n\n`));

              if (!isDone) {
                // Add punctuation pauses
                let currentDelay = adaptiveDelay;
                if (/[.!?]$/.test(currentChunk.trim())) {
                  currentDelay *= 1.5;
                }
                await new Promise(resolve => setTimeout(resolve, Math.max(5, currentDelay)));
              }

              currentChunk = '';
              wordCount = 0;
            }
          }
        }

        safeClose();

      } catch (error) {
        console.error('Lazy streaming error:', error);
        const errorChunk: StreamChunk = {
          content: '',
          done: true,
          error: error instanceof Error ? error.message : 'Streaming failed'
        };
        safeEnqueue(encoder.encode(`data: ${JSON.stringify(errorChunk)}\n\n`));
        safeClose();
      }
    }
  });
}
