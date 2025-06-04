import { NextResponse } from 'next/server';
import { ScraperAgent } from '@/lib/agents/scraper-new';
import { 
  ScraperStreamEvent, 
  ScraperOptions,
  ScraperOutput
} from '@/lib/agents/scraper-new/types';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max duration

/**
 * Enhance the ScraperAgent to ensure workflow events are properly captured
 * This is necessary to receive events from LangGraph workflow nodes
 */
function enhanceScraperAgent() {
  const originalStreamScraping = ScraperAgent.prototype.streamScraping;
  
  ScraperAgent.prototype.streamScraping = async function(
    options: ScraperOptions, 
    onEventCallback: (event: ScraperStreamEvent) => Promise<void>
  ): Promise<ScraperOutput> {
    console.log('🔧 Enhanced scraper initialized');
    
    // Ensure the event callback is also set in options
    options.onEvent = onEventCallback;
    
    return originalStreamScraping.call(this, options, onEventCallback);
  };
}

// Apply enhancement immediately
enhanceScraperAgent();

/**
 * Create an SSE event writer function
 */
function createEventSender(writer: WritableStreamDefaultWriter<Uint8Array>) {
  const encoder = new TextEncoder();
  
  return async (event: string, data: Record<string, unknown>) => {
    console.log(`📤 Event: ${event}`, typeof data === 'object' ? data.type || '' : '');
    await writer.write(
      encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    );
  };
}

/**
 * Create a scraping configuration from query parameters
 */
function createScrapingConfig(baseUrl: string, scrapingGoal: string) {
  return {
    baseUrl,
    scrapingGoal,
    maxPages: 10,
    maxDepth: 3,
    executeJavaScript: true,
    batchSize: 1
  };
}

/**
 * Start the scraping process and send events to the client
 */
async function runScraper(
  baseUrl: string, 
  scrapingGoal: string, 
  sendEvent: (event: string, data: Record<string, unknown>) => Promise<void>
) {
  let pageCounter = 0;
  
  try {
    // Send initial connection event
    await sendEvent('connection', {
      status: 'connected',
      message: 'Started scraping',
      timestamp: Date.now()
    });
    
    // Create and configure the scraper
    const agent = new ScraperAgent();
    const config = createScrapingConfig(baseUrl, scrapingGoal);
    
    console.log('🚀 Starting scraper with config:', config);
    
    // Run the scraper and process events
    await agent.streamScraping(
      config,
      async (event: ScraperStreamEvent) => {
        // Forward all events to the client
        await sendEvent('scraper-event', {
          ...event,
          timestamp: Date.now()
        });
        
        // Process page events specially to provide additional information
        if (event.type === 'page') {
          pageCounter++;
          
          // Log page details
          console.log(`📄 Page #${pageCounter}: ${event.data.url}`);
          console.log(`   Title: ${event.data.title || "No title"}`);
          console.log(`   Content: ${event.data.content.length} chars`);
          console.log(`   Links: ${event.data.links.length}`);
          
          // Send page completion event
          await sendEvent('url-complete', {
            url: event.data.url,
            title: event.data.title || event.data.url.split('/').pop() || "No title",
            contentLength: event.data.content.length,
            linkCount: event.data.links.length,
            pageNumber: pageCounter,
            timestamp: Date.now()
          });
          
          // Send progress update
          await sendEvent('progress', {
            pagesScraped: pageCounter,
            queueSize: event.data.links.length,
            goalCompletion: Math.min(1, pageCounter / config.maxPages),
            timestamp: Date.now()
          });
        }
      }
    );
    
    // Send completion event
    await sendEvent('scraping-complete', {
      message: 'Scraping completed',
      pagesScraped: pageCounter,
      executionTime: Date.now() - (performance.timeOrigin + performance.now()),
      timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('❌ Error during scraping:', error);
    
    // Send error event
    await sendEvent('error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now()
    });
  }
}

/**
 * GET handler for SSE connection
 */
export async function GET(request: Request) {
  // Extract and validate query parameters
  const url = new URL(request.url);
  const baseUrl = url.searchParams.get('baseUrl');
  const scrapingGoal = url.searchParams.get('scrapingGoal') || 'Extract information';
  
  console.log('📡 Scraper request received:', { baseUrl, scrapingGoal });
  
  if (!baseUrl) {
    return NextResponse.json({ error: 'Missing baseUrl parameter' }, { status: 400 });
  }
  
  // Set up SSE stream
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const sendEvent = createEventSender(writer);
  
  // Run the scraper in background
  (async () => {
    try {
      await runScraper(baseUrl, scrapingGoal, sendEvent);
    } finally {
      // Ensure the writer is closed properly
      setTimeout(async () => {
        try {
          await writer.close();
          console.log('📝 Event stream closed');
        } catch (err) {
          console.error('Error closing stream:', err);
        }
      }, 1000);
    }
  })();
  
  // Return the stream immediately for SSE
  return new NextResponse(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}