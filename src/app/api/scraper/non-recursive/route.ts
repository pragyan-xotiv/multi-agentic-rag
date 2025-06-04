import { NextResponse } from 'next/server';
import { ScraperAgent } from '@/lib/agents/scraper-new';
import { ScraperStreamEvent } from '@/lib/agents/scraper-new/types';

export const runtime = 'nodejs';

// Allow longer timeouts for complex scraping operations
export const maxDuration = 300; // 5 minutes max duration

export async function POST(request: Request) {
  console.log('🔍 [Non-Recursive Scraper API] Starting scraping request');
  try {
    // Get the request body with scraping configuration
    const body = await request.json();
    console.log('📝 [Non-Recursive Scraper API] Received config:', JSON.stringify(body, null, 2));
    
    // Validate required fields
    if (!body.baseUrl) {
      console.error('❌ [Non-Recursive Scraper API] Missing baseUrl parameter');
      return NextResponse.json(
        { error: 'Missing baseUrl parameter' },
        { status: 400 }
      );
    }
    
    if (!body.scrapingGoal) {
      console.error('❌ [Non-Recursive Scraper API] Missing scrapingGoal parameter');
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
    console.log('🤖 [Non-Recursive Scraper API] Initializing non-recursive scraper agent');
    const agent = new ScraperAgent();
    
    // Start the scraping process in the background
    agent.streamScraping(
      {
        baseUrl: body.baseUrl,
        scrapingGoal: body.scrapingGoal,
        maxPages: body.maxPages || 20,
        maxDepth: body.maxDepth || 3,
        includeImages: body.includeImages || false,
        executeJavaScript: body.executeJavaScript !== false, // Default to true if not specified
        preventDuplicateUrls: body.preventDuplicateUrls !== false, // Default to true if not specified
        filters: {
          mustIncludePatterns: body.filters?.mustIncludePatterns || [],
          excludePatterns: body.filters?.excludePatterns || []
        }
      },
      async (event: ScraperStreamEvent) => {
        // Log the event type for debugging
        console.log(`📊 [Non-Recursive Scraper API] Event: ${event.type}`, 
          event.type === 'error' ? event.error : '');
        
        // Send each event to the client
        await writer.write(
          encoder.encode(JSON.stringify(event) + '\n')
        );
      }
    ).catch(async (error) => {
      console.error('🔥 [Non-Recursive Scraper API] Error during scraping:', error);
      
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
      console.log('✅ [Non-Recursive Scraper API] Scraping process completed');
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
    console.error('💥 [Non-Recursive Scraper API] Route error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 