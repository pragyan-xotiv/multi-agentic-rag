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
    filters?: {
      mustIncludePatterns?: string[];
      excludePatterns?: string[];
    };
    onAuthRequired?: (authRequest: HumanAuthRequest) => Promise<boolean>;
  }): Promise<ScraperOutput> {
    console.log(`🔍 [ScraperAgent] Starting scrape operation for ${options.baseUrl}`);
    console.log(`📝 [ScraperAgent] Goal: ${options.scrapingGoal}`);
    console.log(`⚙️ [ScraperAgent] Config: maxPages=${options.maxPages || 20}, maxDepth=${options.maxDepth || 3}, executeJS=${options.executeJavaScript ? 'Yes' : 'No'}`);
    
    try {
      const result = await executeScraperWorkflow({
        baseUrl: options.baseUrl,
        scrapingGoal: options.scrapingGoal,
        maxPages: options.maxPages || 20,
        maxDepth: options.maxDepth || 3,
        includeImages: options.includeImages || false,
        executeJavaScript: options.executeJavaScript,
        filters: options.filters || {},
        authConfig: this.authConfig,
        onAuthRequired: options.onAuthRequired,
        config: {
          recursionLimit: 100, // Increase recursion limit to handle more pages
          maxIterations: 50    // Add a safety mechanism to limit total iterations
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
        filters: options.filters || {},
        authConfig: this.authConfig,
        onPageProcessed: async (pageContent: PageContent) => {
          console.log(`📄 [ScraperAgent] Page processed: ${pageContent.url}`);
          console.log(`📊 [ScraperAgent] Page metrics: relevance=${pageContent.metrics.relevance.toFixed(2)}, density=${pageContent.metrics.informationDensity.toFixed(2)}`);
          
          // Add to our local tracking
          processedPages.add(pageContent.url);
          console.log(`📈 [ScraperAgent] Total pages processed so far: ${processedPages.size}`);
          
          await onEvent({
            type: 'page',
            data: pageContent
          });
        },
        onAuthRequired: async (authRequest: HumanAuthRequest) => {
          console.log(`🔒 [ScraperAgent] Authentication required for: ${authRequest.url}`);
          console.log(`🔑 [ScraperAgent] Auth type: ${authRequest.authType}`);
          await onEvent({
            type: 'auth',
            request: authRequest
          });
          
          // Wait for authentication to complete (implementation depends on the application)
          return new Promise<boolean>(resolve => {
            // In a real implementation, this would be handled by the application
            // For now, we'll just timeout after 1 minute and assume auth failed
            console.log(`⏱️ [ScraperAgent] Waiting for authentication (will timeout in 60s)`);
            setTimeout(() => {
              console.log(`⌛ [ScraperAgent] Authentication timed out`);
              resolve(false);
            }, 60000);
          });
        },
        config: {
          recursionLimit: 100, // Increase recursion limit to handle more pages
          maxIterations: 50    // Add a safety mechanism to limit total iterations
        }
      });
      
      // Send the final event
      console.log(`🏁 [ScraperAgent] Scraping completed, sending 'end' event`);
      console.log(`📊 [ScraperAgent] Pages scraped: ${result.pages.length}`);
      console.log(`📊 [ScraperAgent] Pages in output: ${result.pages.length}`);
      console.log(`📈 [ScraperAgent] Goal completion: ${result.summary.goalCompletion}`);
      
      // Verify the result against our tracking
      if (result.pages.length === 0 && processedPages.size > 0) {
        console.warn(`⚠️ [ScraperAgent] Result has 0 pages but ${processedPages.size} pages were processed!`);
        console.warn(`⚠️ [ScraperAgent] This indicates a data flow problem in the workflow.`);
      }
      
      await onEvent({
        type: 'end',
        output: result
      });
      
      return result;
    } catch (error) {
      console.error('❌ [ScraperAgent] Scraper agent streaming error:', error);
      await onEvent({
        type: 'error',
        error: `Scraping failed: ${error instanceof Error ? error.message : String(error)}`
      });
      throw error;
    }
  }
}

// Export types
export * from './types';

// Export workflow functions for direct access
export * from './workflow'; 