import { NextResponse } from 'next/server';
import { ScraperAgent } from '@/lib/agents/scraper-new';

export const runtime = 'nodejs';

// Allow longer timeouts for complex scraping operations
export const maxDuration = 300; // 5 minutes max duration

export async function POST(request: Request) {
  console.log('🔍 [Non-Recursive Scraper API Sync] Starting scraping request');
  try {
    // Get the request body with scraping configuration
    const body = await request.json();
    console.log('📝 [Non-Recursive Scraper API Sync] Received config:', JSON.stringify(body, null, 2));
    
    // Validate required fields
    if (!body.baseUrl) {
      console.error('❌ [Non-Recursive Scraper API Sync] Missing baseUrl parameter');
      return NextResponse.json(
        { error: 'Missing baseUrl parameter' },
        { status: 400 }
      );
    }
    
    if (!body.scrapingGoal) {
      console.error('❌ [Non-Recursive Scraper API Sync] Missing scrapingGoal parameter');
      return NextResponse.json(
        { error: 'Missing scrapingGoal parameter' },
        { status: 400 }
      );
    }
    
    // Setup scraper agent with options
    console.log('🤖 [Non-Recursive Scraper API Sync] Initializing non-recursive scraper agent');
    const agent = new ScraperAgent();
    
    // Execute the scraping process synchronously
    const result = await agent.scrape({
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
    });
    
    console.log('✅ [Non-Recursive Scraper API Sync] Scraping completed successfully');
    console.log(`📊 [Non-Recursive Scraper API Sync] Pages scraped: ${result.summary.pagesScraped}`);
    
    // Return the result to the client
    return NextResponse.json(result);
  } catch (error) {
    console.error('💥 [Non-Recursive Scraper API Sync] Route error:', error);
    return NextResponse.json(
      { 
        error: 'Scraping failed',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 