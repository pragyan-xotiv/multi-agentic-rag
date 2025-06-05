/**
 * State Manager Module
 * 
 * This module handles state initialization, persistence, and management 
 * for the scraper agent. It provides utilities for creating the initial state,
 * updating state during scraping, and formatting the final output.
 */

import type { ExtendedScraperAgentState } from '../state';
import type { PageContent, ScraperOutput, PriorityQueue, UrlQueueItem } from '../types';

/**
 * Create a priority queue implementation
 */
function createPriorityQueue<T>(): PriorityQueue<T> {
  const items: { item: T; priority: number }[] = [];
  
  return {
    enqueue: (item: T, priority: number) => {
      // Add the item with its priority
      items.push({ item, priority });
      
      // Sort the queue by priority (higher values have higher priority)
      items.sort((a, b) => b.priority - a.priority);
    },
    
    dequeue: () => {
      // Remove and return the highest priority item
      if (items.length === 0) return undefined;
      return items.shift()?.item;
    },
    
    peek: () => {
      // Return the highest priority item without removing it
      if (items.length === 0) return undefined;
      return items[0].item;
    },
    
    isEmpty: () => {
      return items.length === 0;
    },
    
    size: () => {
      return items.length;
    },
    
    items: items.map(i => i.item),
  };
}

/**
 * Initialize a new scraper agent state
 */
export function initializeState(config: {
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
}): ExtendedScraperAgentState {
  const pageQueue = createPriorityQueue<UrlQueueItem>();
  
  // Add the initial URL to the queue with a neutral expected value
  pageQueue.enqueue(
    {
      url: config.baseUrl,
      expectedValue: 0.5,
      depth: 0
    },
    0.5
  );
  
  return {
    baseUrl: config.baseUrl,
    scrapingGoal: config.scrapingGoal,
    maxPages: config.maxPages || 20,
    maxDepth: config.maxDepth || 5,
    includeImages: config.includeImages || false,
    executeJavaScript: config.executeJavaScript || false,
    filters: config.filters || {},
    
    currentUrl: '',
    currentUrlDepth: 0,
    visitedUrls: new Set<string>(),
    pageQueue,
    
    extractedContent: new Map<string, PageContent>(),
    currentPageDOM: '',
    currentPageText: '',
    
    valueMetrics: {
      informationDensity: 0,
      relevance: 0,
      uniqueness: 0,
      completeness: 0
    },
    
    requiresAuthentication: false,
    authRequest: null,
    
    normalizedUrls: new Set<string>(),
    contentSignatures: new Set<string>(),
    
    lastError: null,
    
    finalOutput: {
      pages: [],
      summary: {
        pagesScraped: 0,
        totalContentSize: 0,
        executionTime: 0,
        goalCompletion: 0,
        coverageScore: 0
      }
    }
  };
}

/**
 * Update the state with a new page content
 */
export function addPageToState(
  state: ExtendedScraperAgentState,
  url: string,
  pageContent: PageContent
): ExtendedScraperAgentState {
  // Add the URL to the visited set
  state.visitedUrls.add(url);
  
  // Add the content to the extracted content map
  state.extractedContent.set(url, pageContent);
  
  return state;
}

/**
 * Format the final output from the state
 */
export function formatOutput(
  state: ExtendedScraperAgentState,
  startTime: number
): ScraperOutput {
  // Calculate execution time
  const executionTime = (Date.now() - startTime) / 1000;
  
  // Convert the extracted content map to an array of pages
  const pages = Array.from(state.extractedContent.values());
  
  // Calculate total content size
  const totalContentSize = pages.reduce(
    (sum, page) => sum + page.content.length,
    0
  );
  
  return {
    pages,
    summary: {
      pagesScraped: state.visitedUrls.size,
      totalContentSize,
      executionTime,
      goalCompletion: state.valueMetrics.completeness,
      coverageScore: state.valueMetrics.relevance * state.valueMetrics.informationDensity
    }
  };
}

/**
 * Add links to the state's priority queue
 */
export function addLinksToQueue(
  state: ExtendedScraperAgentState,
  links: Array<{
    url: string;
    predictedValue: number;
  }>,
  currentDepth: number
): ExtendedScraperAgentState {
  // Filter out URLs that have already been visited
  const newLinks = links.filter(link => !state.visitedUrls.has(link.url));
  
  // Add new links to the queue
  for (const link of newLinks) {
    state.pageQueue.enqueue(
      {
        url: link.url,
        expectedValue: link.predictedValue,
        depth: currentDepth + 1
      },
      link.predictedValue
    );
  }
  
  return state;
}

/**
 * Save the state to persistent storage
 */
export async function persistState(
  state: ExtendedScraperAgentState,
  storageKey: string
): Promise<void> {
  // In a real implementation, this would save the state to disk or a database
  // For this example, we'll just log it
  console.log(`Would persist state with key ${storageKey}`);
  
  // We'd need to convert Set and Map to serializable objects
  const serializableState = {
    ...state,
    visitedUrls: Array.from(state.visitedUrls),
    extractedContent: Array.from(state.extractedContent.entries()),
  };
  
  // Then save it (in this case, just log it)
  console.log('State snapshot:', JSON.stringify(serializableState).slice(0, 100) + '...');
}

/**
 * Load the state from persistent storage
 */
export async function loadState(
  storageKey: string
): Promise<ExtendedScraperAgentState | undefined> {
  // In a real implementation, this would load the state from disk or a database
  // For this example, we'll just return undefined
  console.log(`Would load state with key ${storageKey}`);
  
  return undefined;
} 