import type { Browser, Page } from 'puppeteer';
import { PageFetchResult } from '../types';
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
}

/**
 * Fetch a page from a URL
 */
export async function fetchPage(url: string, options: FetchOptions = {}): Promise<PageFetchResult> {
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
 * Fetch a page using Puppeteer (headless browser)
 */
async function fetchWithPuppeteer(url: string, options: FetchOptions = {}, timeout: number): Promise<PageFetchResult> {
  const startTime = Date.now();
  console.log(`🤖 [BrowserInterface] Using Puppeteer for: ${url}`);
  
  let browser: Browser | undefined;
  try {
    const browserStartTime = Date.now();
    
    // On macOS, spawn error -8 is often related to executable permissions or path issues
    // Let's explicitly get the executable path and verify it exists
    let executablePath;
    let launchArgs;

    // Use different strategies based on environment
    if (isServerless) {
      // For serverless environments, use @sparticuz/chromium as intended
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
    
    console.log(`🔧 [BrowserInterface] Launching Chromium with minimal args: ${launchArgs.join(' ')}`);
    
    // Set up Puppeteer launch options with careful error handling
    const launchOptions = {
      args: launchArgs,
      defaultViewport: { width: 800, height: 600 },
      executablePath: executablePath,
      headless: true,
      timeout: 30000, // Increase timeout for launch
      env: process.env // Pass through environment variables
    };
    
    // console.log(`🔧 [BrowserInterface] Launch options: ${JSON.stringify(launchOptions, null, 2)}`);
    
    // Try to launch the browser
    console.time('ChromiumLaunch');
    browser = await puppeteerCore.launch(launchOptions) as unknown as Browser;
    console.timeEnd('ChromiumLaunch');
    
    console.log(`🌐 [BrowserInterface] Chromium browser launched successfully in ${Date.now() - browserStartTime}ms`);
    
    // Check if browser was successfully initialized
    if (!browser) {
      throw new Error('Failed to initialize browser');
    }
    
    // Create a new page
    console.time('PageCreation');
    const page = await browser.newPage();
    console.timeEnd('PageCreation');
    
    // Set default user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Set headers if provided
    if (options.headers) {
      await page.setExtraHTTPHeaders(options.headers);
    }
    
    // Navigate to the URL with timeout
    console.log(`⏳ [BrowserInterface] Navigating to ${url} with Puppeteer...`);
    console.time(`Navigation:${url}`);
    try {
      await page.goto(url, { 
        waitUntil: 'domcontentloaded', // Less strict than networkidle2
        timeout: timeout * 1.5 // Increase timeout for navigation
      });
    } catch (navError) {
      console.log(`⚠️ [BrowserInterface] Navigation timeout, but continuing: ${navError}`);
      // Continue anyway - we may have partially loaded content
    }
    console.timeEnd(`Navigation:${url}`);
    console.log(`✅ [BrowserInterface] Puppeteer navigation attempt complete in ${Date.now() - startTime}ms`);
    
    // Get the status code - be more lenient about what constitutes a success
    const response = page.url().startsWith('http') ? 200 : 500;
    console.log(`📊 [BrowserInterface] Status: ${response}`);
    
    // Get the final URL (after any redirects)
    const finalUrl = page.url();
    console.log(`🔄 [BrowserInterface] Final URL: ${finalUrl}`);
    
    // Enhanced waiting for content to stabilize - with better error handling
    console.log(`⏳ [BrowserInterface] Waiting for DOM to be ready...`);
    console.time('DOMReadyWait');
    // Wait for DOM to be ready with a safety timeout
    try {
      // A more robust approach to checking if DOM is ready
      await Promise.race([
        page.waitForFunction(() => document.readyState === 'complete', { 
          timeout: Math.min(timeout / 2, 10000) 
        }),
        // Fallback timer in case readyState never becomes 'complete'
        new Promise(r => setTimeout(r, Math.min(timeout / 2, 10000)))
      ]);
    } catch (readyError) {
      console.log(`⚠️ [BrowserInterface] DOM ready wait timed out, but continuing: ${readyError}`);
    }
    console.timeEnd('DOMReadyWait');
    
    // Simplified content stabilization and SPA handling with better error handling
    try {
      // Wait for important content elements with a short timeout
      console.log(`⏳ [BrowserInterface] Waiting for content elements...`);
      console.time('ContentElementsWait');
      await Promise.race([
        page.waitForSelector('body', { timeout: 5000 }),
        page.waitForSelector('main', { timeout: 5000 }),
        page.waitForSelector('article', { timeout: 5000 }),
        page.waitForSelector('p', { timeout: 5000 }),
        // Fallback timer
        new Promise(r => setTimeout(r, 5000))
      ]);
      console.timeEnd('ContentElementsWait');
      
      // Quick check for SPA
      console.time('SPADetection');
      await detectAndHandleSPA(page);
      console.timeEnd('SPADetection');
    } catch (contentError) {
      console.log(`⚠️ [BrowserInterface] Content element waiting failed, but continuing: ${contentError}`);
    }
    
    // Get the page content
    console.time('ContentExtraction');
    const html = await page.content();
    console.timeEnd('ContentExtraction');
    console.log(`📏 [BrowserInterface] HTML length (after JS execution): ${html.length} bytes`);
    
    const endTime = Date.now();
    console.log(`⏱️ [BrowserInterface] Total Puppeteer processing time: ${endTime - startTime}ms`);
    
    return {
      html,
      status: response,
      finalUrl,
      headers: {}
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error(`❌ [BrowserInterface] Puppeteer error:`, error);
    
    const endTime = Date.now();
    console.log(`⏱️ [BrowserInterface] Puppeteer failed after ${endTime - startTime}ms`);
    
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
      console.time('BrowserClose');
      await browser.close();
      console.timeEnd('BrowserClose');
      console.log(`🔒 [BrowserInterface] Puppeteer browser closed`);
    }
  }
}

/**
 * Detect and handle Single Page Applications (SPAs) - Simplified version
 */
async function detectAndHandleSPA(page: Page): Promise<void> {
  try {
    // Quick check for SPA frameworks with a timeout
    const isSPA = await Promise.race([
      page.evaluate(() => {
        // Quick check for common framework indicators
        const hasReact = document.querySelector('[data-reactroot]') !== null;
        const hasAngular = document.querySelector('[ng-app]') !== null;
        
        // Check for Next.js data safely
        let hasNextData = false;
        try {
          hasNextData = Boolean(window && '__NEXT_DATA__' in window);
        } catch {
          // Ignore any errors
        }
        
        const hasVue = document.querySelector('[data-v-]') !== null;
        const hasApp = document.querySelector('#app, #root') !== null;
        
        return hasReact || hasAngular || hasNextData || hasVue || hasApp;
      }).catch(() => false),
      // Timeout after 2 seconds
      new Promise<boolean>(resolve => setTimeout(() => resolve(false), 2000))
    ]);
    
    if (isSPA) {
      console.log('🔍 [BrowserInterface] Detected SPA, applying minimal handling');
      
      // Simple scroll to trigger lazy loading
      await page.evaluate(() => {
        window.scrollTo(0, 100);
        setTimeout(() => window.scrollTo(0, 0), 300);
      }).catch(err => {
        console.log('⚠️ [BrowserInterface] Scroll in SPA failed:', err);
      });
    }
  } catch (err) {
    // Don't let SPA detection errors affect the main process
    console.log('⚠️ [BrowserInterface] SPA detection error (ignored):', err);
  }
} 