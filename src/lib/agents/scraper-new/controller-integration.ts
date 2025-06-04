/**
 * Controller Integration for the Non-Recursive Scraper Agent
 * 
 * This file provides utilities to integrate the new scraper agent with the controller.
 * It maintains compatibility with the existing API to allow for seamless switching.
 */

import { ScraperAgent as NonRecursiveScraperAgent } from './index';
// import { ScraperAgent as OriginalScraperAgent } from '../scraper';
import { ScraperOptions, ScraperOutput, ScraperStreamEvent } from './types';

/**
 * Configuration for which scraper implementation to use
 */
export interface ScraperConfig {
  /**
   * Whether to use the non-recursive implementation
   * @default true
   */
  useNonRecursive: boolean;
}

/**
 * Get the appropriate scraper agent based on configuration
 * 
 * @param config Configuration options
 * @returns A scraper agent instance (either non-recursive or original)
 */
export function getScraperAgent(config?: Partial<ScraperConfig>) {
  const useNonRecursive = config?.useNonRecursive !== false; // Default to non-recursive
  
  if (useNonRecursive) {
    console.log('🔄 [Controller] Using non-recursive scraper implementation');
    return new NonRecursiveScraperAgent();
  } else {
    console.log('🔄 [Controller] Using original scraper implementation');
    // return new OriginalScraperAgent();
    return new NonRecursiveScraperAgent();
  }
}

/**
 * Execute a scraping operation with the configured scraper agent
 * 
 * @param options Scraper options
 * @param config Configuration options
 * @returns The scraper output
 */
export async function executeScraper(
  options: ScraperOptions,
  config?: Partial<ScraperConfig>
): Promise<ScraperOutput> {
  const agent = getScraperAgent(config);
  return agent.scrape(options);
}

/**
 * Stream results from a scraping operation with the configured scraper agent
 * 
 * @param options Scraper options
 * @param onEvent Event handler callback
 * @param config Configuration options
 * @returns The scraper output
 */
export async function streamScraper(
  options: ScraperOptions,
  onEvent: (event: ScraperStreamEvent) => Promise<void>,
  config?: Partial<ScraperConfig>
): Promise<ScraperOutput> {
  const agent = getScraperAgent(config);
  return agent.streamScraping(options, onEvent);
} 