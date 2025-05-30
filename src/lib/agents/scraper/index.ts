import { executeScraperWorkflow } from './workflow';
import { ScraperOutput, AuthenticationConfig, HumanAuthRequest, PageContent } from './types';

/**
 * Event types for streaming responses from the scraper
 */
export type ScraperStreamEvent = 
  | { type: 'start'; url: string; goal: string }
  | { type: 'page'; data: PageContent }
  | { type: 'auth'; request: HumanAuthRequest }
  | { type: 'end'; output: ScraperOutput }
  | { type: 'error'; error: string };

/**
 * Scraper Agent for intelligently extracting content from websites
 */
export class ScraperAgent {
  private authConfig?: AuthenticationConfig;
  
  constructor(options?: { humanAuthentication?: AuthenticationConfig }) {
    this.authConfig = options?.humanAuthentication;
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
    filters?: {
      mustIncludePatterns?: string[];
      excludePatterns?: string[];
    };
    onAuthRequired?: (authRequest: HumanAuthRequest) => Promise<boolean>;
  }): Promise<ScraperOutput> {
    try {
      const result = await executeScraperWorkflow({
        baseUrl: options.baseUrl,
        scrapingGoal: options.scrapingGoal,
        maxPages: options.maxPages || 20,
        maxDepth: options.maxDepth || 3,
        includeImages: options.includeImages || false,
        filters: options.filters || {},
        authConfig: this.authConfig,
        onAuthRequired: options.onAuthRequired,
      });
      
      return result;
    } catch (error) {
      console.error('Scraper agent error:', error);
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
      filters?: {
        mustIncludePatterns?: string[];
        excludePatterns?: string[];
      };
    },
    onEvent: (event: ScraperStreamEvent) => Promise<void>
  ): Promise<ScraperOutput> {
    try {
      // Send the initial event
      await onEvent({
        type: 'start',
        url: options.baseUrl,
        goal: options.scrapingGoal
      });
      
      // Execute the workflow with callbacks
      const result = await executeScraperWorkflow({
        baseUrl: options.baseUrl,
        scrapingGoal: options.scrapingGoal,
        maxPages: options.maxPages || 20,
        maxDepth: options.maxDepth || 3,
        includeImages: options.includeImages || false,
        filters: options.filters || {},
        authConfig: this.authConfig,
        onPageProcessed: async (pageContent: PageContent) => {
          await onEvent({
            type: 'page',
            data: pageContent
          });
        },
        onAuthRequired: async (authRequest: HumanAuthRequest) => {
          await onEvent({
            type: 'auth',
            request: authRequest
          });
          
          // Wait for authentication to complete (implementation depends on the application)
          return new Promise<boolean>(resolve => {
            // In a real implementation, this would be handled by the application
            // For now, we'll just timeout after 1 minute and assume auth failed
            setTimeout(() => resolve(false), 60000);
          });
        }
      });
      
      // Send the final event
      await onEvent({
        type: 'end',
        output: result
      });
      
      return result;
    } catch (error) {
      console.error('Scraper agent streaming error:', error);
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