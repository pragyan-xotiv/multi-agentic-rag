import { NextResponse } from 'next/server';
import { ScraperAgent } from '@/lib/agents/scraper-new';

// Simple endpoint for scraper debugging
export async function GET() {
  console.log('📊 Debug endpoint called');
  
  try {
    // Create the scraper
    const agent = new ScraperAgent();
    
    // Run a simple test scrape operation
    const result = await agent.scrape({
      baseUrl: 'https://xotiv.com',
      scrapingGoal: 'Extract company information',
      maxPages: 3,
      maxDepth: 2,
      executeJavaScript: true,
    });
    
    // Log the detailed results for debugging
    console.log('🔍 Scraper results summary:', {
      pagesScraped: result.summary.pagesScraped,
      totalContentSize: result.summary.totalContentSize,
      executionTime: result.summary.executionTime,
      goalCompletion: result.summary.goalCompletion,
    });
    
    // Log the first page content if available
    if (result.pages.length > 0) {
      console.log('📄 First page title:', result.pages[0].title);
      console.log('📏 First page content length:', result.pages[0].content.length);
      console.log('🔗 First page links:', result.pages[0].links.length);
      
      // Log a sample of the content
      const contentSample = result.pages[0].content.substring(0, 200) + '...';
      console.log('📝 Content sample:', contentSample);
    } else {
      console.log('⚠️ No pages were scraped');
    }
    
    return NextResponse.json({
      success: true,
      summary: result.summary,
      pageCount: result.pages.length,
      pages: result.pages.map(page => ({
        url: page.url,
        title: page.title,
        contentLength: page.content.length,
        linkCount: page.links.length
      }))
    });
  } catch (error) {
    console.error('❌ Debug endpoint error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
} 