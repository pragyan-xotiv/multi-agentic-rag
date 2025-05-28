// Streaming endpoint to maintain SSE connection using an extremely simple approach
export async function GET() {
  // Simple implementation that just returns a static message
  // with no ongoing stream to avoid the controller closed issues
  return new Response('retry: 30000\n\ndata: {"status": "connected"}\n\n', {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
} 