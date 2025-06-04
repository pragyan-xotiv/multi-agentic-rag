/**
 * Browser interface for the new scraper implementation
 * Handles page fetching and JavaScript execution
 */

import { PageFetchResult } from '../types';
import { fetchPage as originalFetchPage } from '../../scraper/core/browser-interface';

// Simplified implementation that reuses the original browser interface
// This avoids duplicating the complex browser handling code
export async function fetchPage(
  url: string,
  options?: {
    executeJavaScript?: boolean;
    timeout?: number;
    headers?: Record<string, string>;
    cookies?: string;
  }
): Promise<PageFetchResult> {
  try {
    console.log(`🌐 [BrowserInterface] Fetching URL: ${url}`);
    console.log(`🌐 [BrowserInterface] Options: ${JSON.stringify(options || {})}`);
    
    // Call the original implementation
    const result = await originalFetchPage(url, options);
    
    console.log(`✅ [BrowserInterface] Fetched URL: ${url} (status: ${result.status})`);
    return result;
  } catch (error) {
    console.error(`❌ [BrowserInterface] Error fetching URL: ${url}`, error);
    
    // Fall back to a simple fetch implementation if the original fails
    return fallbackFetch(url, options);
  }
}

/**
 * Fallback implementation using JSDOM for simple fetching
 */
async function fallbackFetch(
  url: string,
  options?: {
    executeJavaScript?: boolean;
    timeout?: number;
    headers?: Record<string, string>;
    cookies?: string;
  }
): Promise<PageFetchResult> {
  console.log(`⚠️ [BrowserInterface] Using fallback fetch for URL: ${url}`);
  
  try {
    // Simple implementation using fetch API
    const timeout = options?.timeout || 30000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    // Prepare headers
    const headers = options?.headers || {};
    if (options?.cookies) {
      headers['Cookie'] = options.cookies;
    }
    
    // Fetch the page
    const response = await fetch(url, {
      headers,
      signal: controller.signal,
      redirect: 'follow',
    });
    
    clearTimeout(timeoutId);
    
    // Get the HTML content
    const html = await response.text();
    
    // Extract headers
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    
    return {
      html,
      status: response.status,
      finalUrl: response.url,
      headers: responseHeaders,
      fallbackMode: true
    };
  } catch (error) {
    console.error(`❌ [BrowserInterface] Fallback fetch error:`, error);
    
    // Return an error result
    return {
      html: '<html><body><p>Error fetching page</p></body></html>',
      status: 500,
      finalUrl: url,
      headers: {},
      error: error instanceof Error ? error.message : String(error),
      fallbackMode: true
    };
  }
} 