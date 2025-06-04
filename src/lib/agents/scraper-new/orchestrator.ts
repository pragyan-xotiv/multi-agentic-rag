/**
 * Batch Orchestrator for Non-Recursive Scraper
 * 
 * This module manages the batch processing of URLs, maintaining state between workflow invocations
 * and implementing queue management outside of the LangGraph workflow.
 */

import { ExtendedScraperAgentState } from './state';
import { 
  ScraperOutput, 
  PageContent, 
  HumanAuthRequest, 
  ScraperStreamEvent,
  UrlQueueItem,
  PriorityQueue
} from './types';
import { processSingleUrl } from './workflow';

/**
 * Create a priority queue implementation
 */
function createPriorityQueue<T>() {
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
    
    get items() {
      return items.map(i => i.item);
    },
  };
}

/**
 * Batch Scraper Orchestrator
 * 
 * Manages the batch processing of URLs, maintaining state between workflow invocations
 * and implementing queue management outside of the LangGraph workflow.
 */
export class ScraperOrchestrator {
  private urlQueue: PriorityQueue<UrlQueueItem>;
  private visitedUrls: Set<string>;
  private extractedContent: Map<string, PageContent>;
  private baseState: Partial<ExtendedScraperAgentState>;
  private processingStatus: {
    totalProcessed: number;
    startTime: number;
    lastUpdateTime: number;
    isComplete: boolean;
  };
  
  constructor(options: {
    baseUrl: string;
    scrapingGoal: string;
    maxPages: number;
    maxDepth: number;
    includeImages: boolean;
    executeJavaScript?: boolean;
    preventDuplicateUrls?: boolean;
    filters: {
      mustIncludePatterns?: string[];
      excludePatterns?: string[];
    };
    onAuthRequired?: (authRequest: HumanAuthRequest) => Promise<boolean>;
    onPageProcessed?: (pageContent: PageContent) => Promise<void>;
    onEvent?: (event: ScraperStreamEvent) => Promise<void>;
  }) {
    // Initialize queue and tracking sets
    this.urlQueue = createPriorityQueue<UrlQueueItem>();
    this.visitedUrls = new Set<string>();
    this.extractedContent = new Map<string, PageContent>();
    
    // Initialize processing status
    this.processingStatus = {
      totalProcessed: 0,
      startTime: Date.now(),
      lastUpdateTime: Date.now(),
      isComplete: false
    };
    
    // Add the starting URL to the queue
    this.urlQueue.enqueue({
      url: options.baseUrl,
      depth: 0,
      expectedValue: 1.0
    }, 1.0);
    
    // Set up base state that will be shared across all URL processing
    this.baseState = {
      baseUrl: options.baseUrl,
      scrapingGoal: options.scrapingGoal,
      maxPages: options.maxPages,
      maxDepth: options.maxDepth,
      includeImages: options.includeImages || false,
      executeJavaScript: options.executeJavaScript,
      filters: options.filters || {},
      
      // Initialize collections
      visitedUrls: this.visitedUrls,
      extractedContent: this.extractedContent,
      
      // Initialize value metrics
      valueMetrics: {
        informationDensity: 0,
        relevance: 0,
        uniqueness: 0,
        completeness: 0
      },
      
      // Initialize state with empty values
      currentPageDOM: "",
      currentPageText: "",
      requiresAuthentication: false,
      authRequest: null,
      
      // Initialize URL sets
      normalizedUrls: new Set<string>(),
      contentSignatures: new Set<string>(),
      lastError: null,
      
      // Set callbacks
      onPageProcessed: options.onPageProcessed,
      onEvent: options.onEvent,
      onAuthRequired: options.onAuthRequired
    };
  }
  
  /**
   * Get the current processing status
   */
  getStatus() {
    return {
      ...this.processingStatus,
      queueSize: this.urlQueue.size(),
      visitedUrls: this.visitedUrls.size,
      extractedContent: this.extractedContent.size
    };
  }
  
  /**
   * Process a batch of URLs
   * 
   * @param batchSize Number of URLs to process in this batch
   * @returns True if more URLs are available for processing, false if done
   */
  async processBatch(batchSize: number = 1): Promise<boolean> {
    console.log(`🔄 [Orchestrator] Processing batch of ${batchSize} URLs`);
    
    let processedCount = 0;
    const batchStartTime = Date.now();
    
    // Process URLs until batch size is reached or queue is empty
    while (processedCount < batchSize && !this.urlQueue.isEmpty()) {
      // Check if we've reached the maximum pages
      if (this.extractedContent.size >= (this.baseState.maxPages || 20)) {
        console.log(`🏁 [Orchestrator] Reached maximum pages (${this.baseState.maxPages})`);
        this.processingStatus.isComplete = true;
        return false;
      }
      
      // Get the next URL from the queue
      const nextItem = this.urlQueue.dequeue();
      
      if (!nextItem) {
        console.log(`⚠️ [Orchestrator] Queue empty, but size reported ${this.urlQueue.size()}`);
        break;
      }
      
      // Skip if already visited
      if (this.visitedUrls.has(nextItem.url)) {
        console.log(`🔄 [Orchestrator] Skipping already visited URL: ${nextItem.url}`);
        continue;
      }
      
      console.log(`🔍 [Orchestrator] Processing URL: ${nextItem.url} (depth: ${nextItem.depth})`);
      
      try {
        // Process this URL using the single URL processor
        const result = await processSingleUrl({
          url: nextItem.url,
          depth: nextItem.depth,
          state: this.baseState,
          onAuthRequired: this.baseState.onAuthRequired,
          onPageProcessed: this.baseState.onPageProcessed,
          onEvent: this.baseState.onEvent
        });
        
        // Mark as visited
        this.visitedUrls.add(nextItem.url);
        
        // Add any discovered URLs to the queue
        if (result.discoveredUrls && result.discoveredUrls.length > 0) {
          console.log(`🔗 [Orchestrator] Adding ${result.discoveredUrls.length} discovered URLs to queue`);
          
          for (const item of result.discoveredUrls) {
            // Skip already visited or queued URLs
            if (this.visitedUrls.has(item.url)) {
              continue;
            }
            
            // Add to queue
            this.urlQueue.enqueue(item, item.expectedValue);
          }
        }
        
        // Update processing status
        this.processingStatus.totalProcessed++;
        this.processingStatus.lastUpdateTime = Date.now();
        
        processedCount++;
      } catch (error) {
        console.error(`❌ [Orchestrator] Error processing URL ${nextItem.url}:`, error);
        
        // Send error event
        if (this.baseState.onEvent) {
          await this.baseState.onEvent({
            type: 'error',
            error: error instanceof Error ? error.message : String(error)
          });
        }
        
        // Continue with next URL
        continue;
      }
    }
    
    // Update status
    const hasMoreUrls = !this.urlQueue.isEmpty();
    if (!hasMoreUrls) {
      this.processingStatus.isComplete = true;
    }
    
    console.log(`✅ [Orchestrator] Batch complete: processed ${processedCount} URLs`);
    console.log(`📊 [Orchestrator] Status: queue=${this.urlQueue.size()}, visited=${this.visitedUrls.size}, extracted=${this.extractedContent.size}`);
    
    // Send batch completion event for the client
    if (this.baseState.onEvent) {
      const batchDuration = Date.now() - batchStartTime;
      await this.baseState.onEvent({
        type: 'workflow-status',
        step: 'batch-complete',
        progress: this.extractedContent.size / (this.baseState.maxPages || 20),
        message: `Completed batch of ${processedCount} URLs in ${batchDuration}ms. Queue: ${this.urlQueue.size()}, Extracted: ${this.extractedContent.size}`,
        batchStats: {
          processedInBatch: processedCount,
          totalProcessed: this.processingStatus.totalProcessed,
          queueRemaining: this.urlQueue.size(),
          extractedTotal: this.extractedContent.size,
          batchDuration: batchDuration,
          isComplete: this.processingStatus.isComplete
        }
      });
    }
    
    return hasMoreUrls;
  }
  
  /**
   * Execute the scraper workflow to completion
   * 
   * @param batchSize Number of URLs to process in each batch (default: 5)
   */
  async execute(batchSize: number = 5): Promise<ScraperOutput> {
    console.log(`🚀 [Orchestrator] Starting scraping with ${this.urlQueue.size()} URLs in queue`);
    console.time('TotalScrapingOperation');
    
    // Send the start event
    if (this.baseState.onEvent) {
      await this.baseState.onEvent({
        type: 'start',
        url: this.baseState.baseUrl || '',
        goal: this.baseState.scrapingGoal || ''
      });
    }
    
    try {
      // Process in batches
      let hasMoreUrls = true;
      let batchNumber = 0;
      
      while (hasMoreUrls) {
        batchNumber++;
        console.log(`🔄 [Orchestrator] Starting batch #${batchNumber} (size: ${batchSize})`);
        hasMoreUrls = await this.processBatch(batchSize);
      }
      
      // Prepare the final output
      const finalOutput = this.prepareFinalOutput();
      
      // Send the end event
      if (this.baseState.onEvent) {
        await this.baseState.onEvent({
          type: 'end',
          output: finalOutput
        });
      }
      
      console.log(`🏁 [Orchestrator] Scraping complete: ${finalOutput.pages.length} pages scraped in ${batchNumber} batches`);
      console.timeEnd('TotalScrapingOperation');
      
      return finalOutput;
    } catch (error) {
      console.error(`❌ [Orchestrator] Error executing scraper:`, error);
      
      // Send error event
      if (this.baseState.onEvent) {
        await this.baseState.onEvent({
          type: 'error',
          error: error instanceof Error ? error.message : String(error)
        });
      }
      
      // Return empty output
      return {
        pages: [],
        summary: {
          pagesScraped: 0,
          totalContentSize: 0,
          executionTime: 0,
          goalCompletion: 0,
          coverageScore: 0
        }
      };
    }
  }
  
  /**
   * Prepare the final output from the collected data
   */
  private prepareFinalOutput(): ScraperOutput {
    // Convert the Map to an array
    const pages = Array.from(this.extractedContent.values());
    
    // Calculate total content size
    let totalContentSize = 0;
    pages.forEach(page => {
      totalContentSize += page.content.length;
    });
    
    // Calculate execution time
    const executionTime = Date.now() - this.processingStatus.startTime;
    
    return {
      pages,
      summary: {
        pagesScraped: pages.length,
        totalContentSize,
        executionTime,
        goalCompletion: this.baseState.valueMetrics?.completeness || 0,
        coverageScore: this.baseState.valueMetrics?.relevance || 0
      }
    };
  }
} 