import { NextResponse } from 'next/server';
import { ScraperAgent } from '@/lib/agents/scraper';
import { ScraperStreamEvent } from '@/lib/agents/scraper/types';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    // Get the request body with scraping configuration
    const body = await request.json();
    
    // Validate required fields
    if (!body.baseUrl) {
      return NextResponse.json(
        { error: 'Missing baseUrl parameter' },
        { status: 400 }
      );
    }
    
    if (!body.scrapingGoal) {
      return NextResponse.json(
        { error: 'Missing scrapingGoal parameter' },
        { status: 400 }
      );
    }
    
    // Create a new response stream
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    
    // Setup scraper agent with options
    const agent = new ScraperAgent();
    
    // Start the scraping process in the background
    agent.streamScraping(
      {
        baseUrl: body.baseUrl,
        scrapingGoal: body.scrapingGoal,
        maxPages: body.maxPages || 20,
        maxDepth: body.maxDepth || 3,
        includeImages: body.includeImages || false,
        filters: {
          mustIncludePatterns: body.filters?.mustIncludePatterns || [],
          excludePatterns: body.filters?.excludePatterns || []
        }
      },
      async (event: ScraperStreamEvent) => {
        // Send each event to the client
        await writer.write(
          encoder.encode(JSON.stringify(event) + '\n')
        );
      }
    ).catch(async (error) => {
      console.error('Error during scraping:', error);
      
      // Send error event to the client
      await writer.write(
        encoder.encode(
          JSON.stringify({
            type: 'error',
            error: error.message || 'An unknown error occurred during scraping',
            timestamp: new Date().toISOString()
          }) + '\n'
        )
      );
    }).finally(async () => {
      // Close the stream when done
      await writer.close();
    });
    
    // Return the stream to the client
    return new NextResponse(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('API route error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 