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
    
    // Create a new response stream with properly configured transformers
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    
    // Track whether the scraping is complete to avoid premature stream closure
    let isScrapingComplete = false;
    
    // Helper function to format Server-Sent Events properly
    const writeSSE = async (event: string, data: Record<string, unknown>) => {
      try {
        await writer.write(
          encoder.encode(`event: ${event}\n`)
        );
        await writer.write(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        );
      } catch (error) {
        console.error(`❌ [Non-Recursive Scraper API] Error writing to stream:`, error);
      }
    };
    
    // Send heartbeat to keep connection alive
    const heartbeatInterval = setInterval(async () => {
      try {
        // Send a heartbeat event every 10 seconds to keep the connection alive
        await writeSSE('heartbeat', { 
          timestamp: Date.now(),
          message: 'Connection alive'
        });
      } catch (error) {
        console.error(`❌ [Non-Recursive Scraper API] Heartbeat error:`, error);
      }
    }, 10000);
    
    // Setup scraper agent with options
    console.log('🤖 [Non-Recursive Scraper API] Initializing non-recursive scraper agent');
    const agent = new ScraperAgent();
    
    // Start the scraping process in the background
    (async () => {
      try {
        // Write initial message to keep the connection alive
        await writeSSE('message', { type: 'init', message: 'Starting batch scraper...' });
        
        await agent.streamScraping(
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
            },
            batchSize: body.batchSize || 3  // Configure batch size (default: 3 for streaming)
          },
          async (event: ScraperStreamEvent) => {
            // Log the event type for debugging
            console.log(`📊 [Non-Recursive Scraper API] Event: ${event.type}`);
            
            // Send event using SSE format
            await writeSSE('message', event);
            
            // Check if this is the end event
            if (event.type === 'end') {
              console.log('✅ [Non-Recursive Scraper API] Received end event, marking scraping as complete');
              isScrapingComplete = true;
            }
            
            // Special handling for batch processing status updates
            if (event.type === 'workflow-status' && event.step === 'batch-complete') {
              console.log(`📊 [Non-Recursive Scraper API] Batch complete: ${event.message}`);
              
              // Additional batch status information can be included here
              await writeSSE('batch-status', {
                timestamp: Date.now(),
                ...event
              });
            }
          }
        );
        
        // Scraping completed successfully
        console.log('✅ [Non-Recursive Scraper API] Scraping process completed normally');
        
        // Ensure we send a final message if we didn't receive an end event
        if (!isScrapingComplete) {
          await writeSSE('message', { 
            type: 'end', 
            output: { pages: [], summary: { pagesScraped: 0, totalContentSize: 0, executionTime: 0 } }
          });
        }
        
      } catch (error) {
        console.error('🔥 [Non-Recursive Scraper API] Error during scraping:', error);
        
        // Send error event to the client
        await writeSSE('message', {
          type: 'error',
          error: error instanceof Error ? error.message : 'An unknown error occurred during scraping',
          timestamp: Date.now()
        });
        
      } finally {
        // Clean up the heartbeat interval
        clearInterval(heartbeatInterval);
        
        // Ensure we've sent an end message before closing
        if (!isScrapingComplete) {
          await writeSSE('message', { type: 'complete', message: 'Scraping process complete' });
        }
        
        // Add a small delay to ensure all messages have been sent
        await new Promise(resolve => setTimeout(resolve, 500));
        
        console.log('👋 [Non-Recursive Scraper API] Closing stream writer');
        await writer.close();
      }
    })();
    
    // Return the stream to the client immediately, while processing continues
    return new NextResponse(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable Nginx buffering
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