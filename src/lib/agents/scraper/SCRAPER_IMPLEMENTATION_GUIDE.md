# Scraper Implementation Guide

This document provides targeted technical solutions for the issues identified in the Scraper Agent. Each solution is designed to work within the existing architecture and maintains high coding standards without workarounds.

## Issue 1: Content Extraction Problems

### Current Problem
```
❌ [ContentExtractor] No <main> element found
❌ [ContentExtractor] No <article> element found
❌ [ContentExtractor] No content div found
```

### Solution Implementation

#### 1. Expand Content Selectors
Enhance the content extraction by adding more targeted content selectors:

```typescript
// In ContentExtractor class - expand the existing selector list
const contentSelectors = [
  // Current selectors
  'main', 
  'article',
  'div#content',
  'div.content',
  
  // Add these additional selectors for better coverage
  '.main-content',
  '#main-content',
  '.post-content',
  '.entry-content',
  '[role="main"]',
  '.page-content',
  '.site-content',
  'section.content'
];

// Use existing iteration approach with expanded selectors
```

#### 2. Implement Text Density Analysis
Add a fallback mechanism that identifies content by text density when standard selectors fail:

```typescript
// Add this method to ContentExtractor class
private findContentByTextDensity(document: Document): Element | null {
  // Get all potential content containers
  const contentContainers = Array.from(document.querySelectorAll('div, section'))
    .filter(el => {
      // Filter out obvious non-content elements
      const isLikelyContent = 
        !el.closest('nav, footer, header, aside') && // Not in navigation/header/footer
        (el.textContent?.length || 0) > 150 &&       // Has substantial text
        el.querySelectorAll('p, h1, h2, h3, li').length > 0; // Has content elements
      
      return isLikelyContent;
    });
  
  if (contentContainers.length === 0) return null;
  
  // Find the container with highest text-to-HTML ratio
  return contentContainers.reduce((best, current) => {
    const bestRatio = best.textContent!.length / best.innerHTML.length;
    const currentRatio = current.textContent!.length / current.innerHTML.length;
    return currentRatio > bestRatio ? current : best;
  });
}

// Integrate this into the existing extraction flow
// In the extractContent method after trying standard selectors:
if (!contentElement) {
  console.log('🔍 [ContentExtractor] Using text density analysis to find content');
  contentElement = this.findContentByTextDensity(document);
  if (contentElement) {
    console.log('✅ [ContentExtractor] Found content using text density analysis');
  }
}
```

#### 3. Wait For Content Strategy
Enhance the existing page loading mechanism in `browser-interface.ts`:

```typescript
// In browser-interface.ts - enhance the existing fetchWithPuppeteer function
// After navigating to the URL:

// First wait for navigation to complete
await page.goto(url, { waitUntil: 'networkidle2', timeout });

// Then add these enhanced waiting strategies:
try {
  // Wait for DOM to be ready
  await page.waitForFunction(() => {
    return document.readyState === 'complete';
  }, { timeout: timeout / 2 });
  
  // Wait for content to stabilize (check if DOM size stops changing)
  await page.waitForFunction(() => {
    return new Promise(resolve => {
      // Store current DOM size
      const initialSize = document.querySelectorAll('*').length;
      
      // Check again after a short delay
      setTimeout(() => {
        const newSize = document.querySelectorAll('*').length;
        resolve(newSize === initialSize); // Resolve when stable
      }, 1000);
    });
  }, { timeout: timeout / 2 }).catch(e => {
    console.log('⚠️ [BrowserInterface] DOM stabilization check timed out');
  });
  
  // Wait for important content elements
  await Promise.race([
    page.waitForSelector('main', { timeout: 3000 }),
    page.waitForSelector('article', { timeout: 3000 }),
    page.waitForSelector('p', { timeout: 3000 })
  ]).catch(e => {
    console.log('⚠️ [BrowserInterface] Content element waiting timed out');
  });
  
} catch (e) {
  console.log('⚠️ [BrowserInterface] Enhanced waiting strategy partially failed, proceeding anyway');
}
```

## Issue 2: Repetitive URL Processing

### Current Problem
The scraper processes the same or similar URLs multiple times, wasting resources.

### Solution Implementation

#### 1. Enhanced URL Normalization
Implement a robust URL normalization function in the ScraperAgent workflow:

```typescript
// Add to the workflow.ts file where URLs are processed
function normalizeUrl(url: string): string {
  try {
    // Parse the URL
    const parsed = new URL(url);
    
    // Convert hostname to lowercase
    let normalized = parsed.protocol + '//' + parsed.hostname.toLowerCase();
    
    // Add port if non-standard
    if (parsed.port && 
        !((parsed.protocol === 'http:' && parsed.port === '80') || 
          (parsed.protocol === 'https:' && parsed.port === '443'))) {
      normalized += ':' + parsed.port;
    }
    
    // Add path, removing trailing slashes and default index files
    let path = parsed.pathname.replace(/\/(index\.(html?|php|aspx?))?\/?$/, '');
    normalized += path || '/';
    
    // Handle query parameters - remove tracking params
    if (parsed.search) {
      const params = new URLSearchParams(parsed.search);
      const sortedParams = new URLSearchParams();
      
      // Remove tracking parameters
      Array.from(params.keys())
        .filter(key => !['utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'gclid'].includes(key))
        .sort()
        .forEach(key => sortedParams.append(key, params.get(key) || ''));
      
      const search = sortedParams.toString();
      if (search) normalized += '?' + search;
    }
    
    return normalized;
  } catch (e) {
    console.error(`⚠️ [ScraperAgent] Error normalizing URL: ${url}`, e);
    return url;
  }
}

// Use this in the workflow where URL deduplication is performed
// Update the existing URL tracking mechanism:
const seenUrls = new Set<string>();
// ...
if (seenUrls.has(normalizeUrl(url))) {
  console.log(`🔄 [ScraperAgent] Skipping already processed URL: ${url}`);
  continue;
}
seenUrls.add(normalizeUrl(url));
```

#### 2. Simple Content Similarity Check
Add a lightweight content similarity check to avoid processing near-duplicate pages:

```typescript
// Add to workflow.ts where page content is analyzed
function getContentSignature(html: string): string {
  try {
    // Create a simple DOM parser
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Extract headings and first paragraph of content
    const headings = Array.from(doc.querySelectorAll('h1, h2, h3'))
      .map(h => h.textContent?.trim())
      .filter(Boolean)
      .slice(0, 3)
      .join('|');
    
    // Get first 100 chars of content
    const firstPara = doc.querySelector('p')?.textContent?.trim().substring(0, 100) || '';
    
    // Return signature
    return `${headings}|${firstPara}`;
  } catch (e) {
    return '';
  }
}

// Track content signatures
const contentSignatures = new Set<string>();

// In the page processing logic:
const signature = getContentSignature(pageContent.html);
if (signature && contentSignatures.has(signature)) {
  console.log(`🔄 [ScraperAgent] Skipping page with duplicate content signature`);
  continue;
}
if (signature) contentSignatures.add(signature);
```

## Issue 3: JavaScript Rendering Issues

### Current Problem
Content appears to include JavaScript variables rather than rendered content, suggesting incomplete rendering.

### Solution Implementation

#### 1. Improve Rendering Wait Strategy
Enhance the JavaScript execution in the browser-interface.ts file:

```typescript
// In browser-interface.ts - enhance fetchWithPuppeteer
// After navigating to the URL:

// First wait for navigation to complete
await page.goto(url, { waitUntil: 'networkidle2', timeout });

// Then add these enhanced waiting strategies:
try {
  // Wait for DOM to be ready
  await page.waitForFunction(() => {
    return document.readyState === 'complete';
  }, { timeout: timeout / 2 });
  
  // Wait for content to stabilize (check if DOM size stops changing)
  await page.waitForFunction(() => {
    return new Promise(resolve => {
      // Store current DOM size
      const initialSize = document.querySelectorAll('*').length;
      
      // Check again after a short delay
      setTimeout(() => {
        const newSize = document.querySelectorAll('*').length;
        resolve(newSize === initialSize); // Resolve when stable
      }, 1000);
    });
  }, { timeout: timeout / 2 }).catch(e => {
    console.log('⚠️ [BrowserInterface] DOM stabilization check timed out');
  });
  
  // Wait for important content elements
  await Promise.race([
    page.waitForSelector('main', { timeout: 3000 }),
    page.waitForSelector('article', { timeout: 3000 }),
    page.waitForSelector('p', { timeout: 3000 })
  ]).catch(e => {
    console.log('⚠️ [BrowserInterface] Content element waiting timed out');
  });
  
} catch (e) {
  console.log('⚠️ [BrowserInterface] Enhanced waiting strategy partially failed, proceeding anyway');
}
```

#### 2. SPA Detection and Handling
Add special handling for Single Page Applications:

```typescript
// In browser-interface.ts - add after initial page load
async function detectAndHandleSPA(page: puppeteer.Page): Promise<void> {
  try {
    // Check if this is likely an SPA
    const isSPA = await page.evaluate(() => {
      return Boolean(
        window.angular || 
        window.React || 
        window.__NEXT_DATA__ || 
        document.querySelector('[ng-app], [data-reactroot], #__nuxt, #app')
      );
    });
    
    if (isSPA) {
      console.log('🔍 [BrowserInterface] Detected SPA, applying special handling');
      
      // Scroll down to trigger lazy loading
      await page.evaluate(() => {
        window.scrollTo(0, window.innerHeight);
        return new Promise(resolve => setTimeout(resolve, 500));
      });
      
      // Scroll back up
      await page.evaluate(() => {
        window.scrollTo(0, 0);
        return new Promise(resolve => setTimeout(resolve, 300));
      });
    }
  } catch (e) {
    console.log('⚠️ [BrowserInterface] Error in SPA detection:', e);
  }
}

// Use it after navigation completes
await detectAndHandleSPA(page);
```

## Issue 4: Low Information Quality

### Current Problem
Content quality metrics show poor results:
```
📈 [ContentExtraction Chain] Final metrics: density=0.10, relevance=0.00, uniqueness=0.00
```

### Solution Implementation

#### 1. Content Cleaning
Implement preprocessing to clean content before quality assessment:

```typescript
// Add to the content extraction process
function cleanContent(html: string): string {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Remove script and style tags
    doc.querySelectorAll('script, style, noscript, iframe').forEach(el => el.remove());
    
    // Remove hidden elements
    doc.querySelectorAll('[style*="display:none"], [style*="visibility:hidden"], [hidden]').forEach(el => el.remove());
    
    // Remove common tracking and noise elements
    doc.querySelectorAll(
      '[id*="cookie"], [class*="cookie"], ' +
      '[id*="popup"], [class*="popup"], ' +
      '[id*="banner"], [class*="banner"]'
    ).forEach(el => el.remove());
    
    return doc.body.innerHTML;
  } catch (e) {
    console.error('⚠️ Error cleaning content:', e);
    return html;
  }
}

// Use this before processing content for metrics
// In the content extraction process:
const cleanedHtml = cleanContent(html);
// ... continue with metrics calculation using cleanedHtml
```

#### 2. Improved Content Relevance Metrics
Enhance the content relevance calculation:

```typescript
// Update the content relevance assessment in the workflow
function assessContentQuality(content: string): { 
  density: number; 
  uniqueness: number; 
  relevance: number; 
} {
  // Text to HTML ratio (information density)
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'text/html');
  const text = doc.body.textContent || '';
  const density = Math.min(text.length / Math.max(content.length, 1), 1);
  
  // Check for content-like elements (indicators of real content)
  const hasHeadings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6').length > 0;
  const hasParagraphs = doc.querySelectorAll('p').length > 0;
  const hasLists = doc.querySelectorAll('ul, ol').length > 0;
  const hasImages = doc.querySelectorAll('img').length > 0;
  
  // Calculate content quality score based on structural elements
  const contentElements = [hasHeadings, hasParagraphs, hasLists, hasImages];
  const contentScore = contentElements.filter(Boolean).length / contentElements.length;
  
  // Check for boilerplate content
  const boilerplatePatterns = [
    /404 not found/i,
    /page not found/i,
    /access denied/i,
    /login required/i,
    /javascript is required/i
  ];
  
  const hasBoilerplate = boilerplatePatterns.some(pattern => pattern.test(text));
  
  // Relevance score calculation
  let relevance = contentScore;
  if (hasBoilerplate) relevance *= 0.2;
  if (text.length < 200) relevance *= 0.5;
  
  // Basic uniqueness estimate (can be enhanced)
  const uniqueness = 0.5; // Placeholder - would need comparison with other pages
  
  return { 
    density: Math.max(0, Math.min(density, 1)), 
    uniqueness: Math.max(0, Math.min(uniqueness, 1)), 
    relevance: Math.max(0, Math.min(relevance, 1))
  };
}
```

## Issue 5: Non-Specific Scraping Goals

### Current Problem
Generic scraping goals lead to unfocused content extraction.

### Solution Implementation

#### 1. Structured Comprehensive Scraping
Enhance the scraping goal processing in the workflow:

```typescript
// In workflow.ts - update how scraping goals are processed
// This preserves comprehensive scraping while adding structure

function processScrapingGoal(goal: string): {
  isComprehensive: boolean;
  contentFocus: string[];
  goalKeywords: string[];
} {
  // Check if this is a comprehensive scraping request
  const isComprehensive = goal.toLowerCase().includes('all') || 
                         goal.toLowerCase().includes('comprehensive') ||
                         goal === "Extract all relevant information";
  
  // Extract key content types to focus on
  const contentTypes = [];
  if (goal.toLowerCase().includes('product')) contentTypes.push('product');
  if (goal.toLowerCase().includes('blog') || goal.toLowerCase().includes('article')) contentTypes.push('blog');
  if (goal.toLowerCase().includes('doc') || goal.toLowerCase().includes('guide')) contentTypes.push('documentation');
  if (goal.toLowerCase().includes('about') || goal.toLowerCase().includes('company')) contentTypes.push('company');
  
  // If no specific types but comprehensive, include all major types
  if (isComprehensive && contentTypes.length === 0) {
    contentTypes.push('product', 'blog', 'documentation', 'company');
  }
  
  // Extract keywords for relevance scoring
  const goalKeywords = goal.toLowerCase()
    .replace(/extract|all|information|relevant|content|about/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3)
    .map(word => word.trim());
  
  return {
    isComprehensive,
    contentFocus: contentTypes,
    goalKeywords
  };
}

// Use this in the workflow when processing pages
const goalAnalysis = processScrapingGoal(options.scrapingGoal);
console.log(`🎯 [ScraperAgent] Goal analysis: comprehensive=${goalAnalysis.isComprehensive}, focus=${goalAnalysis.contentFocus.join(',')}`);

// Then use goalAnalysis to prioritize pages when making decisions
// For comprehensive scraping, we'll process more pages but still prioritize quality
```

#### 2. Content Type Detection
Add basic content type detection to better organize results:

```typescript
// Add to the page processing logic
function detectContentType(url: string, html: string): string[] {
  const types: string[] = [];
  
  // URL-based detection
  if (url.includes('/blog') || url.includes('/news') || url.includes('/article')) {
    types.push('blog');
  } else if (url.includes('/product') || url.includes('/shop') || url.includes('/item')) {
    types.push('product');
  } else if (url.includes('/doc') || url.includes('/documentation') || url.includes('/guide')) {
    types.push('documentation');
  } else if (url.includes('/about') || url.includes('/company') || url.includes('/team')) {
    types.push('company');
  }
  
  // Content-based detection
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const text = doc.body.textContent || '';
    
    if (doc.querySelector('.product, [data-product]') || 
        text.match(/add to cart|buy now|product description/i)) {
      types.push('product');
    }
    
    if (doc.querySelector('.blog-post, .article') || 
        doc.querySelector('article time, .published-date, .post-date')) {
      types.push('blog');
    }
    
    if (text.match(/our team|our mission|founded in|company history/i)) {
      types.push('company');
    }
    
    if (doc.querySelector('.documentation, .docs, .guide')) {
      types.push('documentation');
    }
  } catch (e) {
    console.error('⚠️ Error detecting content type:', e);
  }
  
  // Default if nothing detected
  if (types.length === 0) {
    types.push('general');
  }
  
  // Remove duplicates
  return [...new Set(types)];
}

// Use this when processing pages
const contentTypes = detectContentType(pageUrl, pageContent.html);
console.log(`📋 [ScraperAgent] Content types detected: ${contentTypes.join(', ')}`);

// Add content types to the page metadata
pageContent.metadata = {
  ...pageContent.metadata,
  contentTypes
};
```

## Conclusion

These targeted improvements address the identified issues while staying within the existing architecture and maintaining good coding standards. The solutions focus on:

1. Better content extraction with expanded selectors and text density analysis
2. Eliminating duplicate processing with improved URL normalization
3. More robust JavaScript rendering with enhanced waiting strategies
4. Improved content quality metrics for better filtering
5. Structured approach to comprehensive scraping

Implementation priority order:
1. JavaScript rendering improvements (Issue 3)
2. Content extraction enhancements (Issue 1)
3. URL normalization and deduplication (Issue 2)
4. Content quality metrics (Issue 4)
5. Structured scraping approach (Issue 5)

These solutions can be implemented incrementally and do not require a complete rewrite of the existing codebase. 