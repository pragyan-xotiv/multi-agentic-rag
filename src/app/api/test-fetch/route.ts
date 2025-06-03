import { NextRequest, NextResponse } from 'next/server';
import { fetchPage } from '@/lib/agents/scraper/core/browser-interface';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // Get request body
    const body = await req.json();
    const { url, useJavaScript = false, headers = {} } = body;
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }
    
    console.log(`📝 [test-fetch] Testing URL fetch for: ${url}`);
    console.log(`📝 [test-fetch] Options: useJavaScript=${useJavaScript}`);
    
    // Call fetchPage function
    const result = await fetchPage(url, {
      executeJavaScript: useJavaScript,
      headers,
      timeout: 30000
    });
    
    // Return HTML content directly
    return new NextResponse(result.html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
      }
    });
    
  } catch (error) {
    console.error(`❌ [test-fetch] Error:`, error);
    return NextResponse.json({ 
      error: 'Failed to fetch page',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 