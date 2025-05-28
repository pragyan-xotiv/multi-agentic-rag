import { RetrievalStreamEvent } from '@/lib/agents/retrieval';

export const runtime = 'edge';

/**
 * Implements a proper Server-Sent Events (SSE) stream endpoint
 * that maintains an active connection with the client
 */
export async function GET(req: Request) {
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  
  // Write the initial connection message
  await writer.write(
    encoder.encode('retry: 3000\n\n') // Retry every 3 seconds if connection is lost
  );
  
  // Send an initial connection event
  await writer.write(
    encoder.encode(`data: ${JSON.stringify({ type: 'connected' })}\n\n`)
  );
  
  // Send periodic keep-alive messages to prevent connection timeout
  const keepAliveInterval = setInterval(async () => {
    try {
      await writer.write(
        encoder.encode(`: keep-alive ${new Date().toISOString()}\n\n`)
      );
    } catch (error) {
      console.error('Keep-alive write error:', error);
      clearInterval(keepAliveInterval);
    }
  }, 15000); // Every 15 seconds
  
  // Simulate a real retrieval event after a moment to test the connection
  setTimeout(async () => {
    try {
      const testEvent: RetrievalStreamEvent = {
        type: 'start',
        query: 'Test query'
      };
      
      await writer.write(
        encoder.encode(`data: ${JSON.stringify(testEvent)}\n\n`)
      );
      
      // Simulate an end event after a short delay
      setTimeout(async () => {
        const endEvent: RetrievalStreamEvent = {
          type: 'end',
          content: 'Test successful',
          evaluation: {
            relevanceScore: 0.95,
            coverageScore: 0.8,
            confidenceScore: 0.9,
            feedback: 'Test completed successfully'
          }
        };
        
        await writer.write(
          encoder.encode(`data: ${JSON.stringify(endEvent)}\n\n`)
        );
      }, 2000);
      
    } catch (error) {
      console.error('Test event write error:', error);
    }
  }, 1000);
  
  // Handle connection close
  req.signal.addEventListener('abort', () => {
    clearInterval(keepAliveInterval);
    writer.close().catch(console.error);
  });
  
  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
} 