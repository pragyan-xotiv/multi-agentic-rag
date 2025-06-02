import puppeteer from 'puppeteer';
import { PageFetchResult } from '../types';

/**
 * Options for fetching a page
 */
interface FetchOptions {
  headers?: Record<string, string>;
  executeJavaScript?: boolean;
  timeout?: number;
}

/**
 * Fetch a page from a URL
 */
export async function fetchPage(url: string, options: FetchOptions = {}): Promise<PageFetchResult> {
  console.log(`🌐 [BrowserInterface] Fetching URL: ${url}`);
  console.log(`🔧 [BrowserInterface] Options:`, JSON.stringify(options));
  
  // Set a reasonable timeout (default to 20 seconds)
  const timeout = options.timeout || 20000;
  
  // Use Puppeteer (headless browser) for JavaScript execution
  if (options.executeJavaScript) {
    return fetchWithPuppeteer(url, options, timeout);
  }
  
  // Use standard fetch for non-JS content
  try {
    const headers = new Headers(options.headers || {});
    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    const response = await fetch(url, { 
      headers,
      signal: AbortSignal.timeout(timeout) // Add timeout to the fetch request
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const html = await response.text();
    
    return {
      html,
      status: response.status,
      finalUrl: response.url,
      headers: Object.fromEntries(response.headers.entries())
    };
  } catch (error) {
    console.error(`❌ [BrowserInterface] Error fetching page with standard fetch:`, error);
    
    // If standard fetch fails, try with Puppeteer as fallback
    console.log(`🔄 [BrowserInterface] Falling back to Puppeteer for: ${url}`);
    return fetchWithPuppeteer(url, options, timeout);
  }
}

/**
 * Fetch a page using Puppeteer (headless browser)
 */
async function fetchWithPuppeteer(url: string, options: FetchOptions = {}, timeout: number): Promise<PageFetchResult> {
  console.log(`🤖 [BrowserInterface] Using Puppeteer for: ${url}`);
  
  let browser;
  try {
    // Launch a headless browser
    browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    console.log(`🌐 [BrowserInterface] Puppeteer browser launched`);
    
    // Create a new page
    const page = await browser.newPage();
    
    // Set default user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Set headers if provided
    if (options.headers) {
      await page.setExtraHTTPHeaders(options.headers);
    }
    
    // Navigate to the URL with timeout
    console.log(`⏳ [BrowserInterface] Navigating to ${url} with Puppeteer...`);
    await page.goto(url, { 
      waitUntil: 'networkidle2', 
      timeout: timeout // Apply timeout to the navigation
    });
    console.log(`✅ [BrowserInterface] Puppeteer navigation complete`);
    
    // Get the status code
    const response = page.url().includes(url) ? 200 : 301;
    console.log(`📊 [BrowserInterface] Status: ${response}`);
    
    // Get the final URL (after any redirects)
    const finalUrl = page.url();
    console.log(`🔄 [BrowserInterface] Final URL: ${finalUrl}`);
    
    // Wait for content to be fully loaded
    await page.waitForSelector('body', { timeout: timeout / 2 });
    
    // Get the page content
    const html = await page.content();
    console.log(`📏 [BrowserInterface] HTML length (after JS execution): ${html.length} bytes`);
    
    // Special debugging for xotiv.com
    if (url.includes('xotiv.com')) {
      console.log(`🔎 [BrowserInterface] XOTIV.COM DEBUGGING: Special logging for xotiv.com`);
      console.log(`🔎 [BrowserInterface] Using Puppeteer with full JavaScript execution`);
      
      // Take a screenshot for debugging
      const screenshot = await page.screenshot();
      console.log(`🔎 [BrowserInterface] Screenshot taken, size: ${screenshot.length} bytes`);
      
      // Get the page title
      const title = await page.title();
      console.log(`🔎 [BrowserInterface] Page title: ${title}`);
      
      // Check if there's a main content area
      const hasMainContent = await page.evaluate(() => {
        return Boolean(document.querySelector('main') || document.querySelector('article') || document.querySelector('.content'));
      });
      console.log(`🔎 [BrowserInterface] Main content detected: ${hasMainContent}`);
    }
    
    return {
      html,
      status: response,
      finalUrl,
      headers: {}
    };
  } catch (error) {
    console.error(`❌ [BrowserInterface] Puppeteer error:`, error);
    // Return partial content if we can
    return {
      html: '<html><body><p>Error fetching page with Puppeteer</p></body></html>',
      status: 500,
      finalUrl: url,
      headers: {},
      error: String(error)
    };
  } finally {
    // Ensure browser is closed
    if (browser) {
      await browser.close();
      console.log(`🔒 [BrowserInterface] Puppeteer browser closed`);
    }
  }
} 