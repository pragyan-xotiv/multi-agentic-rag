/**
 * Non-Recursive Scraper Workflow Implementation
 * 
 * This implementation uses a simplified LangGraph workflow with clear termination conditions
 * to avoid recursion issues while maintaining all core functionality.
 */

import { StateGraph, END, START } from '@langchain/langgraph';
import { JSDOM } from 'jsdom';

import { ScraperStateAnnotation, ExtendedScraperAgentState } from './state';
import { 
  ScraperOutput, 
  PageContent, 
  HumanAuthRequest, 
  ScraperStreamEvent,
  UrlQueueItem
} from './types';
import { fetchPage } from './core/browser-interface';

// Import chains from the original implementation
import { runContentExtractionChain } from '@/lib/chains/content-extraction-chain';
import { runLinkDiscoveryChain } from '@/lib/chains/link-discovery-chain';
import { runProgressEvaluationChain } from '@/lib/chains/progress-evaluation-chain';
import { runAuthenticationDetectionChain } from '@/lib/chains/authentication-detection-chain';

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
 * Process Next URL Node - Selects the next URL from the queue
 */
async function processNextUrl(state: ExtendedScraperAgentState) {
  console.log(`🔍 [ProcessNextUrl] Selecting next URL from queue`);
  
  // Check for termination conditions
  if (state.pageQueue.isEmpty()) {
    console.log(`🏁 [ProcessNextUrl] No more URLs in queue, preparing to finish`);
    state.finalOutput = prepareOutput(state);
    return state;
  }
  
  if (state.extractedContent.size >= state.maxPages) {
    console.log(`🏁 [ProcessNextUrl] Reached maximum pages (${state.maxPages}), preparing to finish`);
    state.finalOutput = prepareOutput(state);
    return state;
  }
  
  // Get the next URL from the queue
  const nextItem = state.pageQueue.dequeue();
  
  if (!nextItem) {
    console.log(`🏁 [ProcessNextUrl] No items in queue, preparing to finish`);
    state.finalOutput = prepareOutput(state);
    return state;
  }
  
  // Set the current URL
  state.currentUrl = nextItem.url;
  
  console.log(`➡️ [ProcessNextUrl] Selected next URL: ${state.currentUrl} (depth: ${nextItem.depth}, priority: ${nextItem.expectedValue.toFixed(2)})`);
  
  // Send event if configured
  if (state.onEvent) {
    await state.onEvent({
      type: 'workflow-status',
      step: 'process-next-url',
      progress: state.extractedContent.size / state.maxPages,
      message: `Processing URL: ${state.currentUrl}`
    });
  }
  
  return state;
}

/**
 * Fetch Page Node - Fetches the page content for the current URL
 */
async function fetchPageContent(state: ExtendedScraperAgentState) {
  // Skip if we don't have a current URL
  if (!state.currentUrl) {
    console.log(`⚠️ [FetchPage] No current URL to fetch`);
    return state;
  }
  
  console.log(`🌐 [FetchPage] Fetching page: ${state.currentUrl}`);
  
  // Send event about starting page fetch
  if (state.onEvent) {
    await state.onEvent({
      type: 'fetch-start',
      url: state.currentUrl,
      useJavaScript: state.executeJavaScript || false
    });
  }
  
  try {
    // Fetch the page content
    const fetchResult = await fetchPage(state.currentUrl, {
      executeJavaScript: state.executeJavaScript
    });
    
    // Store the result in state
    state.currentPageDOM = fetchResult.html;
    
    // Get the text content using JSDOM
    const dom = new JSDOM(fetchResult.html);
    state.currentPageText = dom.window.document.body?.textContent || '';
    
    console.log(`✅ [FetchPage] Page fetched: ${state.currentUrl} (status: ${fetchResult.status})`);
    console.log(`📊 [FetchPage] Page size: ${fetchResult.html.length} bytes`);
    
    // Send event about completed page fetch
    if (state.onEvent) {
      await state.onEvent({
        type: 'fetch-complete',
        url: state.currentUrl,
        statusCode: fetchResult.status,
        contentLength: fetchResult.html.length
      });
      
      // Send workflow status event
      await state.onEvent({
        type: 'workflow-status',
        step: 'fetch-page',
        progress: 0.2,
        message: `Fetched page content for ${state.currentUrl} (${(fetchResult.html.length / 1024).toFixed(1)} KB)`
      });
    }
    
    return state;
  } catch (error) {
    console.error(`❌ [FetchPage] Error fetching page ${state.currentUrl}:`, error);
    state.lastError = `Fetch error: ${error instanceof Error ? error.message : String(error)}`;
    
    // Send error event
    if (state.onEvent) {
      await state.onEvent({
        type: 'error',
        error: state.lastError
      });
    }
    
    return state;
  }
}

/**
 * Detect Authentication Node - Checks if authentication is required
 */
async function detectAuthentication(state: ExtendedScraperAgentState) {
  console.log(`🔒 [Authentication] Checking authentication for: ${state.currentUrl}`);
  
  if (!state.currentPageDOM) {
    console.log(`⚠️ [Authentication] No DOM content available to check authentication`);
    return {
      ...state,
      requiresAuthentication: false
    };
  }
  
  try {
    // Simplified auth detection for now - can be enhanced later
    const authResult = await runAuthenticationDetectionChain({
      html: state.currentPageDOM,
      url: state.currentUrl,
      statusCode: 200
    });
    
    console.log(`🔑 [Authentication] Result: requiresAuth=${authResult.requiresAuthentication}`);
    
    if (authResult.authRequest) {
      console.log(`🔐 [Authentication] Auth form detected: ${authResult.authRequest.authType}`);
    }
    
    return {
      ...state,
      requiresAuthentication: authResult.requiresAuthentication,
      authRequest: authResult.authRequest || null
    };
  } catch (error) {
    console.error(`❌ [Authentication] Error detecting authentication:`, error);
    return {
      ...state,
      requiresAuthentication: false,
      authRequest: null
    };
  }
}

/**
 * Handle Authentication Node - Placeholder for authentication handling
 */
async function handleAuthentication(state: ExtendedScraperAgentState, options: {
  onAuthRequired?: (authRequest: HumanAuthRequest) => Promise<boolean>;
}) {
  // Simplified implementation - mark the URL as visited and move on
  console.log(`🔒 [Authentication] Authentication required for ${state.currentUrl}, but handling is simplified for now`);
  
  // Mark this URL as visited to avoid trying again
  state.visitedUrls.add(state.currentUrl);
  
  // Try using the auth handler if provided
  if (state.authRequest && options.onAuthRequired) {
    try {
      console.log(`🔒 [Authentication] Calling onAuthRequired handler`);
      await options.onAuthRequired(state.authRequest);
    } catch (error) {
      console.error(`❌ [Authentication] Error in auth handler:`, error);
    }
  }
  
  // Log the authentication request for future enhancement
  if (state.authRequest && state.onEvent) {
    await state.onEvent({
      type: 'auth',
      request: state.authRequest
    });
  }
  
  return {
    ...state,
    requiresAuthentication: false,
    authRequest: null
  };
}

/**
 * Extract Content Node - Extracts content from the page
 */
async function extractPageContent(state: ExtendedScraperAgentState) {
  console.log(`📑 [ContentExtraction] Starting content extraction for: ${state.currentUrl}`);
  
  if (!state.currentPageDOM || state.requiresAuthentication) {
    console.error(`❌ [ContentExtraction] Cannot extract content - ${!state.currentPageDOM ? 'No DOM content' : 'Authentication required'}`);
    return state;
  }
  
  try {
    // Call the content extraction chain
    const contentResult = await runContentExtractionChain({
      html: state.currentPageDOM,
      url: state.currentUrl,
      currentState: state
    });
    
    console.log(`📊 [ContentExtraction] Metrics: density=${contentResult.metrics.informationDensity.toFixed(2)}, relevance=${contentResult.metrics.relevance.toFixed(2)}, uniqueness=${contentResult.metrics.uniqueness.toFixed(2)}`);
    
    // Create a copy of the extracted content map
    const updatedContent = new Map(state.extractedContent);
    
    // Create the page content object
    const pageContent: PageContent = {
      url: state.currentUrl,
      title: contentResult.title,
      content: contentResult.content,
      contentType: contentResult.contentType,
      extractionTime: new Date().toISOString(),
      metrics: contentResult.metrics,
      links: [],  // Will be populated by the link discovery step
      entities: contentResult.entities || []
    };
    
    // Add the new content
    updatedContent.set(state.currentUrl, pageContent);
    
    console.log(`📦 [ContentExtraction] Added content: title="${contentResult.title}", length=${contentResult.content.length} chars`);
    
    // Call the onPageProcessed callback if provided
    if (state.onPageProcessed) {
      try {
        await state.onPageProcessed(pageContent);
      } catch (callbackError) {
        console.error(`❌ [ContentExtraction] Error in onPageProcessed callback:`, callbackError);
      }
    }
    
    // Send event if configured
    if (state.onEvent) {
      await state.onEvent({
        type: 'page',
        data: pageContent
      });
    }
    
    return {
      ...state,
      extractedContent: updatedContent
    };
  } catch (error) {
    console.error(`❌ [ContentExtraction] Error extracting content:`, error);
    return state;
  }
}

/**
 * Discover Links Node - Identifies and prioritizes links on the page
 */
async function discoverLinks(state: ExtendedScraperAgentState) {
  console.log(`🔗 [LinkDiscovery] Starting link discovery for: ${state.currentUrl}`);
  
  if (!state.currentPageDOM || state.requiresAuthentication) {
    console.error(`❌ [LinkDiscovery] Cannot discover links - ${!state.currentPageDOM ? 'No DOM content' : 'Authentication required'}`);
    return state;
  }
  
  try {
    // Call the link discovery chain
    const linkResult = await runLinkDiscoveryChain({
      html: state.currentPageDOM,
      currentUrl: state.currentUrl,
      currentState: state
    });
    
    console.log(`📊 [LinkDiscovery] Found ${linkResult.links.length} links`);
    
    // Create a copy of the page content
    const contentCopy = new Map(state.extractedContent);
    const pageContent = contentCopy.get(state.currentUrl);
    
    if (pageContent) {
      // Update the links in the page content
      pageContent.links = linkResult.links.map(link => ({
        url: link.url,
        context: link.context,
        predictedValue: link.predictedValue,
        visited: Boolean(state.visitedUrls.has(link.url))
      }));
      
      contentCopy.set(state.currentUrl, pageContent);
      console.log(`📝 [LinkDiscovery] Updated page content with ${pageContent.links.length} links`);
    }
    
    return {
      ...state,
      extractedContent: contentCopy
    };
  } catch (error) {
    console.error(`❌ [LinkDiscovery] Error discovering links:`, error);
    return state;
  }
}

/**
 * Queue Manager Node - Manages the URL queue
 */
async function queueManager(state: ExtendedScraperAgentState) {
  console.log(`🔄 [QueueManager] Managing URL queue with ${state.pageQueue.size()} URLs`);
  
  // Mark current URL as visited
  if (state.currentUrl) {
    state.visitedUrls.add(state.currentUrl);
    console.log(`✓ [QueueManager] Marked ${state.currentUrl} as visited (total: ${state.visitedUrls.size})`);
  }
  
  // Get the current extracted content count
  const currentExtractedCount = state.extractedContent.size;
  
  // Check if we've hit the page limit
  if (currentExtractedCount >= state.maxPages) {
    console.log(`🏁 [QueueManager] Reached maximum pages (${state.maxPages}), preparing to finish`);
    state.finalOutput = prepareOutput(state);
    return state;
  }
  
  // Get the current depth from the current URL
  const currentPageContent = state.extractedContent.get(state.currentUrl);
  if (currentPageContent && state.currentUrl) {
    // Find current depth by checking the queue
    const currentDepth = Array.from(state.pageQueue.items)
      .find(item => item.url === state.currentUrl)?.depth || 0;
    
    // Check if we can add more URLs (depth limit)
    if (currentDepth < state.maxDepth) {
      // Add discovered links to the queue
      let newLinksAdded = 0;
      
      for (const link of currentPageContent.links) {
        // Skip already visited URLs
        if (state.visitedUrls.has(link.url)) {
          continue;
        }
        
        // Apply filters if provided
        let shouldEnqueue = true;
        
        // Check for must-include patterns
        if (state.filters.mustIncludePatterns && state.filters.mustIncludePatterns.length > 0) {
          shouldEnqueue = state.filters.mustIncludePatterns.some(pattern => 
            link.url.includes(pattern) || link.context.includes(pattern)
          );
        }
        
        // Check for exclude patterns
        if (shouldEnqueue && state.filters.excludePatterns && state.filters.excludePatterns.length > 0) {
          shouldEnqueue = !state.filters.excludePatterns.some(pattern => 
            link.url.includes(pattern)
          );
        }
        
        if (shouldEnqueue) {
          // Add to queue with priority based on predicted value
          state.pageQueue.enqueue(
            { 
              url: link.url, 
              depth: currentDepth + 1, 
              expectedValue: link.predictedValue 
            },
            link.predictedValue
          );
          newLinksAdded++;
        }
      }
      
      console.log(`🔗 [QueueManager] Added ${newLinksAdded} new links to the queue`);
    } else {
      console.log(`🛑 [QueueManager] Reached maximum depth (${state.maxDepth}), not adding new links`);
    }
  }
  
  // Log queue status
  console.log(`📊 [QueueManager] Current queue status: ${state.pageQueue.size()} URLs remaining`);
  console.log(`📊 [QueueManager] Extracted ${currentExtractedCount}/${state.maxPages} pages so far`);
  
  // Update progress metrics using the chain
  try {
    const progressResult = await runProgressEvaluationChain({
      currentState: state
    });
    
    state.valueMetrics = progressResult.metrics;
    console.log(`📈 [QueueManager] Progress metrics updated: completeness=${progressResult.metrics.completeness.toFixed(2)}`);
  } catch (error) {
    console.error(`❌ [QueueManager] Error evaluating progress:`, error);
  }
  
  // Send event if configured
  if (state.onEvent) {
    await state.onEvent({
      type: 'workflow-status',
      step: 'queue-manager',
      progress: currentExtractedCount / state.maxPages,
      message: `Processed ${currentExtractedCount} pages, ${state.pageQueue.size()} URLs in queue`
    });
    
    // Also send progress evaluation event
    await state.onEvent({
      type: 'evaluate-progress',
      pagesScraped: currentExtractedCount,
      queueSize: state.pageQueue.size(),
      goalCompletion: state.valueMetrics.completeness
    });
  }
  
  return state;
}

/**
 * Prepare the final output
 */
function prepareOutput(state: ExtendedScraperAgentState): ScraperOutput {
  console.log(`🔧 [Workflow] Preparing final output from state with ${state.extractedContent.size} pages`);
  
  if (state.extractedContent.size === 0) {
    console.warn(`⚠️ [Workflow] No pages were extracted during scraping!`);
    return {
      pages: [],
      summary: {
        pagesScraped: 0,
        totalContentSize: 0,
        executionTime: 0,
        goalCompletion: state.valueMetrics.completeness || 0,
        coverageScore: state.valueMetrics.relevance || 0
      }
    };
  }
  
  // Convert the Map to an array
  const pages = Array.from(state.extractedContent.values());
  
  console.log(`📊 [Workflow] Final output will contain ${pages.length} pages`);
  
  let totalContentSize = 0;
  pages.forEach(page => {
    // Calculate content size
    totalContentSize += page.content.length;
  });
  
  return {
    pages,
    summary: {
      pagesScraped: pages.length,
      totalContentSize,
      executionTime: 0, // Will be set during execution
      goalCompletion: state.valueMetrics.completeness || 0,
      coverageScore: state.valueMetrics.relevance || 0
    }
  };
}

/**
 * Create the scraper workflow with a simplified LangGraph structure
 */
export function createScraperWorkflow(options: {
  onAuthRequired?: (authRequest: HumanAuthRequest) => Promise<boolean>;
  onPageProcessed?: (pageContent: PageContent) => Promise<void>;
  onEvent?: (event: ScraperStreamEvent) => Promise<void>;
}) {
  // Create a StateGraph with the annotation-based state structure
  const workflow = new StateGraph(ScraperStateAnnotation)
    // Add nodes for each step
    .addNode("processNextUrl", processNextUrl)
    .addNode("fetchPage", fetchPageContent)
    .addNode("detectAuthentication", detectAuthentication)
    .addNode("handleAuthentication", (state) => handleAuthentication(state, options))
    .addNode("extractContent", extractPageContent)
    .addNode("discoverLinks", discoverLinks)
    .addNode("queueManager", queueManager);
  
  // Define a linear flow
  workflow.addEdge(START, "processNextUrl");
  
  // From processNextUrl, either terminate or fetch the page
  workflow.addConditionalEdges(
    "processNextUrl",
    (state) => {
      // If no more URLs or reached max pages, end the workflow
      if (state.pageQueue.isEmpty() || state.extractedContent.size >= state.maxPages) {
        return END;
      }
      return "fetchPage";
    }
  );
  
  // Standard page processing flow
  workflow.addEdge("fetchPage", "detectAuthentication");
  
  // Handle authentication if needed
  workflow.addConditionalEdges(
    "detectAuthentication",
    (state) => state.requiresAuthentication ? "handleAuthentication" : "extractContent"
  );
  
  // After authentication, go back to fetch the page
  workflow.addEdge("handleAuthentication", "fetchPage");
  
  // Linear content processing
  workflow.addEdge("extractContent", "discoverLinks");
  workflow.addEdge("discoverLinks", "queueManager");
  
  // Always go back to process the next URL, creating a loop
  // that will terminate via the conditional edge from processNextUrl
  workflow.addEdge("queueManager", "processNextUrl");
  
  return workflow.compile();
}

/**
 * Execute the scraper workflow
 */
export async function executeScraperWorkflow(options: {
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
}): Promise<ScraperOutput> {
  console.log(`🚀 [ScraperWorkflow] Starting workflow with baseUrl=${options.baseUrl}`);
  console.log(`📋 [ScraperWorkflow] Options:`, {
    scrapingGoal: options.scrapingGoal,
    maxPages: options.maxPages,
    maxDepth: options.maxDepth,
    includeImages: options.includeImages,
    executeJavaScript: options.executeJavaScript,
    preventDuplicateUrls: options.preventDuplicateUrls,
    filters: options.filters
  });
  
  console.time('TotalScrapingOperation');
  
  try {
    // Create the workflow
    const workflow = createScraperWorkflow({
      onAuthRequired: options.onAuthRequired,
      onPageProcessed: options.onPageProcessed,
      onEvent: options.onEvent,
    });
    
    // Initialize the state
    const initialState: ExtendedScraperAgentState = {
      baseUrl: options.baseUrl,
      scrapingGoal: options.scrapingGoal,
      maxPages: options.maxPages,
      maxDepth: options.maxDepth,
      includeImages: options.includeImages || false,
      executeJavaScript: options.executeJavaScript,
      filters: options.filters || {},
      
      currentUrl: "",
      visitedUrls: new Set<string>(),
      pageQueue: createPriorityQueue<UrlQueueItem>(),
      
      currentPageDOM: "",
      currentPageText: "",
      extractedContent: new Map(),
      
      valueMetrics: {
        informationDensity: 0,
        relevance: 0,
        uniqueness: 0,
        completeness: 0
      },
      
      requiresAuthentication: false,
      authRequest: null,
      
      finalOutput: {
        pages: [],
        summary: {
          pagesScraped: 0,
          totalContentSize: 0,
          executionTime: 0,
          goalCompletion: 0,
          coverageScore: 0
        }
      },
      
      normalizedUrls: new Set<string>(),
      contentSignatures: new Set<string>(),
      lastError: null,
      
      onPageProcessed: options.onPageProcessed,
      onEvent: options.onEvent,
      onAuthRequired: options.onAuthRequired
    };
    
    // Add the starting URL to the queue with highest priority
    initialState.pageQueue.enqueue({
      url: options.baseUrl,
      depth: 0,
      expectedValue: 1.0
    }, 1.0);
    
    // Send the start event if needed
    if (options.onEvent) {
      await options.onEvent({
        type: 'start',
        url: options.baseUrl,
        goal: options.scrapingGoal
      });
    }
    
    const startTime = Date.now();
    
    // Execute the workflow
    console.log(`⚙️ [ScraperWorkflow] Executing workflow...`);
    const result = await workflow.invoke(initialState);
    
    const endTime = Date.now();
    const executionTime = endTime - startTime;
    
    // Ensure we have a valid result
    if (!result.finalOutput || !result.finalOutput.pages) {
      console.warn(`⚠️ [ScraperWorkflow] Missing final output, generating from state`);
      result.finalOutput = prepareOutput(result);
    }
    
    // Update execution time
    result.finalOutput.summary.executionTime = executionTime;
    
    console.log(`🏁 [ScraperWorkflow] Workflow completed in ${executionTime}ms`);
    console.log(`📊 [ScraperWorkflow] Pages scraped: ${result.finalOutput.pages.length}`);
    
    // Send the end event if needed
    if (options.onEvent) {
      await options.onEvent({
        type: 'end',
        output: result.finalOutput
      });
    }
    
    console.timeEnd('TotalScrapingOperation');
    
    return result.finalOutput;
  } catch (error) {
    console.timeEnd('TotalScrapingOperation');
    console.error(`❌ [ScraperWorkflow] Error executing workflow:`, error);
    
    // Send error event if needed
    if (options.onEvent) {
      await options.onEvent({
        type: 'error',
        error: error instanceof Error ? error.message : String(error)
      });
    }
    
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