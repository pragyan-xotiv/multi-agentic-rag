/**
 * Non-Recursive Scraper Agent Implementation
 * 
 * This implementation provides the same API as the original scraper agent
 * but uses a batch-oriented workflow with an external orchestrator to avoid
 * recursion issues while maintaining all core functionality.
 */

import { ScraperOrchestrator } from './orchestrator';
import { 
  ScraperOutput, 
  ScraperOptions, 
  AuthenticationConfig, 
  ScraperStreamEvent 
} from './types';

/**
 * Batch-oriented Scraper Agent for intelligently extracting content from websites
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
  async scrape(options: ScraperOptions): Promise<ScraperOutput> {
    console.log(`🔍 [ScraperAgent] Starting scrape operation for ${options.baseUrl}`);
    console.log(`📝 [ScraperAgent] Goal: ${options.scrapingGoal}`);
    console.log(`⚙️ [ScraperAgent] Config: maxPages=${options.maxPages || 20}, maxDepth=${options.maxDepth || 3}, executeJS=${options.executeJavaScript ? 'Yes' : 'No'}, preventDuplicates=${options.preventDuplicateUrls ? 'Yes' : 'No'}`);
    
    try {
      // Create orchestrator with options
      const orchestrator = new ScraperOrchestrator({
        baseUrl: options.baseUrl,
        scrapingGoal: options.scrapingGoal,
        maxPages: options.maxPages || 20,
        maxDepth: options.maxDepth || 3,
        includeImages: options.includeImages || false,
        executeJavaScript: options.executeJavaScript,
        preventDuplicateUrls: options.preventDuplicateUrls || false,
        filters: options.filters || {},
        onAuthRequired: options.onAuthRequired,
        onPageProcessed: options.onPageProcessed,
        onEvent: options.onEvent
      });
      
      // Execute the orchestrator to completion with configurable batch size
      const batchSize = options.batchSize || 5;
      console.log(`🔄 [ScraperAgent] Using batch size: ${batchSize}`);
      const result = await orchestrator.execute(batchSize);
      
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
    options: ScraperOptions,
    onEvent: (event: ScraperStreamEvent) => Promise<void>
  ): Promise<ScraperOutput> {
    console.log(`🔍 [ScraperAgent] Starting streaming scrape for ${options.baseUrl}`);
    console.log(`📝 [ScraperAgent] Goal: ${options.scrapingGoal}`);
    
    try {
      // Send the initial event
      console.log(`📢 [ScraperAgent] Sending 'start' event`);
      await onEvent({
        type: 'start',
        url: options.baseUrl,
        goal: options.scrapingGoal
      });
      
      // Create orchestrator with the onEvent callback
      const orchestrator = new ScraperOrchestrator({
        baseUrl: options.baseUrl,
        scrapingGoal: options.scrapingGoal,
        maxPages: options.maxPages || 20,
        maxDepth: options.maxDepth || 3,
        includeImages: options.includeImages || false,
        executeJavaScript: options.executeJavaScript,
        preventDuplicateUrls: options.preventDuplicateUrls || false,
        filters: options.filters || {},
        onAuthRequired: options.onAuthRequired,
        onPageProcessed: options.onPageProcessed,
        onEvent
      });
      
      // Execute the orchestrator to completion with configurable batch size
      const batchSize = options.batchSize || 3; // Use smaller default batch size for streaming
      console.log(`🔄 [ScraperAgent] Using batch size: ${batchSize}`);
      const result = await orchestrator.execute(batchSize);
      
      // Send the end event
      console.log(`🏁 [ScraperAgent] Scraping completed, sending 'end' event`);
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

// Export orchestrator and workflow functions for direct access
export * from './orchestrator';
export * from './workflow'; 