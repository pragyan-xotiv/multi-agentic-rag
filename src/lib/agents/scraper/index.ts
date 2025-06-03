import { executeScraperWorkflow } from './workflow';
import { ScraperOutput, AuthenticationConfig, HumanAuthRequest, PageContent, ScraperStreamEvent } from './types';

/**
 * Scraper Agent for intelligently extracting content from websites
 */
export class ScraperAgent {
  private authConfig?: AuthenticationConfig;
  
  constructor(options?: { humanAuthentication?: AuthenticationConfig }) {
    this.authConfig = options?.humanAuthentication;
    console.log('🤖 [ScraperAgent] Initialized', options ? 'with auth config' : 'without auth config');
  }
  
  /**
   * Execute a scraping operation
   */
  async scrape(options: {
    baseUrl: string;
    scrapingGoal: string;
    maxPages?: number;
    maxDepth?: number;
    includeImages?: boolean;
    executeJavaScript?: boolean;
    preventDuplicateUrls?: boolean;
    filters?: {
      mustIncludePatterns?: string[];
      excludePatterns?: string[];
    };
    onAuthRequired?: (authRequest: HumanAuthRequest) => Promise<boolean>;
  }): Promise<ScraperOutput> {
    console.log(`🔍 [ScraperAgent] Starting scrape operation for ${options.baseUrl}`);
    console.log(`📝 [ScraperAgent] Goal: ${options.scrapingGoal}`);
    console.log(`⚙️ [ScraperAgent] Config: maxPages=${options.maxPages || 20}, maxDepth=${options.maxDepth || 3}, executeJS=${options.executeJavaScript ? 'Yes' : 'No'}, preventDuplicates=${options.preventDuplicateUrls ? 'Yes' : 'No'}`);
    
    try {
      const result = await executeScraperWorkflow({
        baseUrl: options.baseUrl,
        scrapingGoal: options.scrapingGoal,
        maxPages: options.maxPages || 20,
        maxDepth: options.maxDepth || 3,
        includeImages: options.includeImages || false,
        executeJavaScript: options.executeJavaScript,
        preventDuplicateUrls: options.preventDuplicateUrls || false,
        filters: options.filters || {},
        authConfig: this.authConfig,
        onAuthRequired: options.onAuthRequired,
        config: {
          recursionLimit: 100, // Increased recursion limit to handle complex websites
          maxIterations: 50    // Increased max iterations to allow for more page processing
        }
      });
      
      console.log(`✅ [ScraperAgent] Scraping completed successfully`);
      console.log(`📊 [ScraperAgent] Pages scraped: ${result.summary.pagesScraped}`);
      console.log(`📈 [ScraperAgent] Goal completion: ${result.summary.goalCompletion}`);
      
      return result;
    } catch (error) {
      console.error('❌ [ScraperAgent] Scraper agent error:', error);
      throw new Error(`Failed to execute scraping: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Stream results from a scraping operation
   */
  async streamScraping(
    options: {
      baseUrl: string;
      scrapingGoal: string;
      maxPages?: number;
      maxDepth?: number;
      includeImages?: boolean;
      executeJavaScript?: boolean;
      preventDuplicateUrls?: boolean;
      filters?: {
        mustIncludePatterns?: string[];
        excludePatterns?: string[];
      };
    },
    onEvent: (event: ScraperStreamEvent) => Promise<void>
  ): Promise<ScraperOutput> {
    console.log(`🔍 [ScraperAgent] Starting streaming scrape for ${options.baseUrl}`);
    console.log(`📝 [ScraperAgent] Goal: ${options.scrapingGoal}`);
    console.log(`⚙️ [ScraperAgent] Config:`, JSON.stringify({
      maxPages: options.maxPages || 20,
      maxDepth: options.maxDepth || 3,
      includeImages: options.includeImages || false,
      executeJavaScript: options.executeJavaScript,
      preventDuplicateUrls: options.preventDuplicateUrls || false,
      filters: options.filters || {}
    }, null, 2));
    
    try {
      // Send the initial event
      console.log(`📢 [ScraperAgent] Sending 'start' event`);
      await onEvent({
        type: 'start',
        url: options.baseUrl,
        goal: options.scrapingGoal
      });
      
      // Track processed pages for debugging
      const processedPages = new Set<string>();
      
      // Execute the workflow with callbacks and increased recursion limit
      const result = await executeScraperWorkflow({
        baseUrl: options.baseUrl,
        scrapingGoal: options.scrapingGoal,
        maxPages: options.maxPages || 20,
        maxDepth: options.maxDepth || 3,
        includeImages: options.includeImages || false,
        executeJavaScript: options.executeJavaScript,
        preventDuplicateUrls: options.preventDuplicateUrls || false,
        filters: options.filters || {},
        authConfig: this.authConfig,
        onPageProcessed: async (pageContent: PageContent) => {
          console.log(`📄 [ScraperAgent] Page processed: ${pageContent.url}`);
          console.log(`📊 [ScraperAgent] Page metrics: relevance=${pageContent.metrics.relevance.toFixed(2)}, density=${pageContent.metrics.informationDensity.toFixed(2)}`);
          
          // Skip sending duplicate page events if preventDuplicateUrls is enabled
          if (options.preventDuplicateUrls && processedPages.has(pageContent.url)) {
            console.log(`🔄 [ScraperAgent] Skipping duplicate page event for ${pageContent.url}`);
            return;
          }
          
          // Add to our local tracking
          processedPages.add(pageContent.url);
          console.log(`📈 [ScraperAgent] Total pages processed so far: ${processedPages.size}`);
          
          await onEvent({
            type: 'page',
            data: pageContent
          });
        },
        onAuthRequired: async (authRequest) => {
          console.log(`🔒 [ScraperAgent] Authentication required for ${authRequest.url}`);
          
          await onEvent({
            type: 'auth',
            request: authRequest
          });
          
          // In streaming mode, we don't handle auth automatically
          return false;
        },
        config: {
          recursionLimit: 100, // Increased recursion limit to handle complex websites
          maxIterations: 50    // Increased max iterations to allow for more page processing
        }
      });
      
      // Send the end event
      console.log(`🏁 [ScraperAgent] Scraping completed, sending 'end' event`);
      console.log(`📊 [ScraperAgent] Pages scraped: ${result.pages.length}`);
      console.log(`📊 [ScraperAgent] Pages in output: ${result.pages.length}`);
      console.log(`📈 [ScraperAgent] Goal completion: ${result.summary.goalCompletion}`);
      
      await onEvent({
        type: 'end',
        output: result
      });
      
      return result;
    } catch (error) {
      console.error('❌ [ScraperAgent] Streaming scraper error:', error);
      
      // Send error event
      await onEvent({
        type: 'error',
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw error;
    }
  }
}

// Export types
export * from './types';

// Export workflow functions for direct access
export * from './workflow'; 