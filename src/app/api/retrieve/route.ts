import { NextResponse } from 'next/server';
import { RetrievalAgent } from '@/lib/agents/retrieval';
import { z } from 'zod';

export const runtime = 'edge';

// Input validation schema
const retrieveSchema = z.object({
  query: z.string().min(1, 'Query must not be empty'),
  filters: z.record(z.unknown()).optional(),
  options: z.record(z.unknown()).optional()
});

export async function POST(req: Request) {
  try {
    // Parse the request body
    const body = await req.json();
    
    // Validate input
    const result = retrieveSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: result.error.format() },
        { status: 400 }
      );
    }
    
    const { query, filters = {}, options = {} } = result.data;
    
    // For streaming responses
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    
    // Initialize retrieval agent
    const agent = new RetrievalAgent();
    
    // Start the retrieval process in the background
    agent.streamResults(
      query,
      filters,
      options,
      async (chunk) => {
        await writer.write(
          encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`)
        );
      }
    ).catch(error => {
      console.error('Stream error:', error);
    }).finally(() => {
      writer.close();
    });
    
    // Return the stream response
    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });
  } catch (error) {
    console.error('Retrieval API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: String(error) },
      { status: 500 }
    );
  }
} 