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
}

/**
 * Create a streaming response from a complete text
 * Simulates token-by-token streaming for better UX
 */
export function createStreamingResponse(text: string, model: string, delayMs: number = 20): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  
  return new ReadableStream({
    async start(controller) {
      try {
        // Split text into characters for streaming effect
        const chars = text.split('')
        let buffer = ''
        
        // Stream character by character
        for (let i = 0; i < chars.length; i++) {
          buffer += chars[i]
          
          // Send chunks every 1-3 characters for natural typing effect
          if (buffer.length >= 3 || i === chars.length - 1) {
            const chunk: StreamChunk = {
              content: buffer,
              done: false,
              model
            }
            
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))
            buffer = ''
            
            // Small delay between chunks
            await new Promise(resolve => setTimeout(resolve, delayMs))
          }
        }
        
        // Send final chunk
        const finalChunk: StreamChunk = {
          content: '',
          done: true,
          model
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalChunk)}\n\n`))
        controller.close()
        
      } catch (error) {
        console.error('Streaming error:', error)
        const errorChunk: StreamChunk = {
          content: '',
          done: true,
          error: error.message
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorChunk)}\n\n`))
        controller.close()
      }
    }
  })
}

/**
 * Create error stream
 */
export function createErrorStream(error: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  
  return new ReadableStream({
    start(controller) {
      const errorChunk: StreamChunk = {
        content: '',
        done: true,
        error
      }
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorChunk)}\n\n`))
      controller.close()
    }
  })
}
