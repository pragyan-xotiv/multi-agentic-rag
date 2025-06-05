/**
 * Browser interface for the new scraper implementation
 * Handles page fetching and JavaScript execution
 */

import { PageFetchResult } from '../types';
import type { Browser } from 'puppeteer';
import puppeteerCore from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import * as fs from 'fs';
import { execSync } from 'child_process';

// Determine if we're running in a serverless environment
const isServerless = process.env.VERCEL === '1';
console.log(`🔧 [BrowserInterface] Running in ${isServerless ? 'serverless' : 'local'} environment`);

/**
 * Options for fetching a page
 */
interface FetchOptions {
  headers?: Record<string, string>;
  executeJavaScript?: boolean;
  timeout?: number;
  cookies?: string;
}

/**
 * Fetch a page from a URL
 */
export async function fetchPage(
  url: string,
  options: FetchOptions = {}
): Promise<PageFetchResult> {
  const startTime = Date.now();
  console.log(`🌐 [BrowserInterface] Fetching URL: ${url}`);
  console.log(`🔧 [BrowserInterface] Options:`, JSON.stringify(options));
  
  // Set a reasonable timeout (default to 20 seconds)
  const timeout = options.timeout || 20000;
  
  // Use Puppeteer (headless browser) for JavaScript execution
  if (options.executeJavaScript) {
    console.log(`🔄 [BrowserInterface] Using Puppeteer for JavaScript execution`);
    return fetchWithPuppeteer(url, options, timeout);
  }
  
  // Use standard fetch for non-JS content
  try {
    console.log(`🔄 [BrowserInterface] Using standard fetch API`);
    console.time(`StandardFetch:${url}`);
    
    const headers = new Headers(options.headers || {});
    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Add cookies if provided
    if (options.cookies) {
      headers.set('Cookie', options.cookies);
    }
    
    const response = await fetch(url, { 
      headers,
      signal: AbortSignal.timeout(timeout) // Add timeout to the fetch request
    });
    
    console.timeEnd(`StandardFetch:${url}`);
    console.log(`📊 [BrowserInterface] Fetch status: ${response.status}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    console.time(`TextExtraction:${url}`);
    const html = await response.text();
    console.timeEnd(`TextExtraction:${url}`);
    console.log(`📏 [BrowserInterface] HTML size: ${html.length} bytes`);
    
    const endTime = Date.now();
    console.log(`⏱️ [BrowserInterface] Standard fetch completed in ${endTime - startTime}ms`);
    
    return {
      html,
      status: response.status,
      finalUrl: response.url,
      headers: Object.fromEntries(response.headers.entries())
    };
  } catch (error) {
    console.error(`❌ [BrowserInterface] Error fetching page with standard fetch:`, error);
    console.log(`⏱️ [BrowserInterface] Standard fetch failed after ${Date.now() - startTime}ms`);
    
    // If standard fetch fails, try with Puppeteer as fallback
    console.log(`🔄 [BrowserInterface] Falling back to Puppeteer for: ${url}`);
    return fetchWithPuppeteer(url, options, timeout);
  }
}

/**
 * Sleep for the specified milliseconds
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetch a page using Puppeteer (headless browser)
 */
async function fetchWithPuppeteer(url: string, options: FetchOptions = {}, timeout: number): Promise<PageFetchResult> {
  const startTime = Date.now();
  console.log(`🤖 [BrowserInterface] Using Puppeteer for: ${url}`);
  
  let browser: Browser | undefined;
  try {
    const browserStartTime = Date.now();
    
    // Get the executable path based on environment
    let executablePath;
    let launchArgs;

    // Use different strategies based on environment
    if (isServerless) {
      // For serverless environments, use @sparticuz/chromium
      console.log(`🔧 [BrowserInterface] Using serverless Chromium approach`);
      executablePath = await chromium.executablePath();
      launchArgs = chromium.args;
    } else {
      // For local environments, try to use locally installed Chrome/Chromium first
      console.log(`🔧 [BrowserInterface] Using local Chrome/Chromium approach`);
      
      // Attempt to find local Chrome on different platforms
      if (process.platform === 'darwin') {
        // macOS paths
        const possiblePaths = [
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
          '/Applications/Chromium.app/Contents/MacOS/Chromium'
        ];
        
        for (const path of possiblePaths) {
          if (fs.existsSync(path)) {
            executablePath = path;
            console.log(`🔧 [BrowserInterface] Found local Chrome at: ${executablePath}`);
            break;
          }
        }
      } else if (process.platform === 'win32') {
        // Windows paths
        const possiblePaths = [
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
        ];
        
        for (const path of possiblePaths) {
          if (fs.existsSync(path)) {
            executablePath = path;
            console.log(`🔧 [BrowserInterface] Found local Chrome at: ${executablePath}`);
            break;
          }
        }
      } else if (process.platform === 'linux') {
        // Linux paths
        const possiblePaths = [
          '/usr/bin/google-chrome',
          '/usr/bin/chromium-browser',
          '/usr/bin/chromium'
        ];
        
        for (const path of possiblePaths) {
          if (fs.existsSync(path)) {
            executablePath = path;
            console.log(`🔧 [BrowserInterface] Found local Chrome at: ${executablePath}`);
            break;
          }
        }
      }
      
      // If local Chrome wasn't found, fall back to @sparticuz/chromium
      if (!executablePath) {
        console.log(`🔧 [BrowserInterface] No local Chrome found, falling back to @sparticuz/chromium`);
        executablePath = await chromium.executablePath();
      }
      
      // Use default Chrome arguments for local environment
      launchArgs = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ];
    }

    console.log(`🔧 [BrowserInterface] Chromium executable path: ${executablePath}`);

    // Check if the file exists
    if (!fs.existsSync(executablePath)) {
      console.error(`❌ [BrowserInterface] Chromium executable not found at: ${executablePath}`);
      throw new Error(`Chromium executable not found at: ${executablePath}`);
    }

    // On macOS, explicitly make sure the executable has correct permissions
    if (process.platform === 'darwin') {
      try {
        console.log(`🔧 [BrowserInterface] Setting executable permissions for Chromium on macOS`);
        execSync(`chmod +x "${executablePath}"`);
      } catch (chmodError) {
        console.error(`❌ [BrowserInterface] Failed to set executable permissions: ${chmodError}`);
      }
    }
    
    // Launch the browser
    console.time('ChromiumLaunch');
    browser = await puppeteerCore.launch({
      args: launchArgs,
      defaultViewport: { width: 800, height: 600 },
      executablePath: executablePath,
      headless: true,
      timeout: 30000 // Increase timeout for launch
    }) as unknown as Browser;
    console.timeEnd('ChromiumLaunch');
    
    console.log(`🌐 [BrowserInterface] Chromium browser launched in ${Date.now() - browserStartTime}ms`);
    
    // Create a new page
    const page = await browser.newPage();
    
    // Set default user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Set headers if provided
    if (options.headers) {
      await page.setExtraHTTPHeaders(options.headers);
    }
    
    // Set cookies if provided
    if (options.cookies) {
      const parsedCookies = parseCookieString(options.cookies);
      await page.setCookie(...parsedCookies);
    }
    
    // Navigate to the URL with timeout
    console.log(`⏳ [BrowserInterface] Navigating to ${url} with Puppeteer...`);
    console.time(`Navigation:${url}`);
    try {
      await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: timeout
      });
    } catch (navError) {
      console.log(`⚠️ [BrowserInterface] Navigation timeout, but continuing: ${navError}`);
      // Continue anyway - we may have partially loaded content
    }
    console.timeEnd(`Navigation:${url}`);
    
    // Wait for additional time to let JavaScript execute
    await sleep(2000);
    
    // Get the status code
    const status = page.url().startsWith('http') ? 200 : 500;
    
    // Get the final URL (after any redirects)
    const finalUrl = page.url();
    
    // Get response headers
    const headers: Record<string, string> = {};
    
    // Get the page content
    const html = await page.content();
    
    // Close the browser
    await browser.close();
    browser = undefined;
    
    console.log(`✅ [BrowserInterface] Puppeteer fetch completed in ${Date.now() - startTime}ms`);
    
    return {
      html,
      status,
      finalUrl,
      headers
    };
  } catch (error) {
    console.error(`❌ [BrowserInterface] Error fetching with Puppeteer:`, error);
    
    // Make sure to close the browser in case of error
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error(`❌ [BrowserInterface] Error closing browser:`, closeError);
      }
    }
    
    // Return a basic error result
    return {
      html: '<html><body><p>Error fetching page</p></body></html>',
      status: 500,
      finalUrl: url,
      headers: {},
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Parse cookie string into format required by Puppeteer
 */
function parseCookieString(cookieString: string): Array<{name: string, value: string}> {
  return cookieString.split(';')
    .map(pair => pair.trim().split('='))
    .filter(pair => pair.length === 2)
    .map(([name, value]) => ({ name, value }));
} 