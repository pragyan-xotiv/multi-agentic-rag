/**
 * Non-Recursive Scraper Workflow Implementation
 * 
 * This implementation uses a simplified LangGraph workflow with clear termination conditions
 * to avoid recursion issues while maintaining all core functionality.
 * 
 * BATCH PROCESSING VERSION: Processes a single URL per workflow invocation
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
import { runAuthenticationDetectionChain } from '@/lib/chains/authentication-detection-chain';

/**
 * Process URL Node - Processes the current URL (in batch mode)
 * This is a modified version of the original processNextUrl function
 * that does not dequeue the next URL, but instead processes the URL 
 * that was passed in the state
 */
async function processUrl(state: ExtendedScraperAgentState) {
  console.log(`🔍 [ProcessUrl] Processing URL: ${state.currentUrl} (depth: ${state.currentUrlDepth})`);
  
  // Ensure we have a URL to process
  if (!state.currentUrl) {
    console.log(`⚠️ [ProcessUrl] No URL to process, ending workflow`);
    state.finalOutput = prepareOutput(state);
    return state;
  }

  console.log('🔍 [ProcessUrl] Event 1:', state.onEvent);
  
  // Send event if configured
  if (state.onEvent) {
    await state.onEvent({
      type: 'workflow-status',
      step: 'process-url',
      progress: state.extractedContent.size / state.maxPages,
      message: `Processing URL: ${state.currentUrl}`
    });
    
    // Also send an analyze-url event for UI feedback
    await state.onEvent({
      type: 'analyze-url',
      url: state.currentUrl,
      depth: state.currentUrlDepth || 0
    });
  }
  
  console.log(`⏭️ [WorkflowTransition] processUrl → fetchPage`);
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
  
  // Mark this URL as visited to prevent re-processing
  state.visitedUrls.add(state.currentUrl);
  
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
    console.log(`🕐 [FetchPage] Starting fetch with executeJavaScript=${state.executeJavaScript}`);
    const fetchResult = await fetchPage(state.currentUrl, {
      executeJavaScript: state.executeJavaScript
    });
    
    // Store the result in state
    state.currentPageDOM = fetchResult.html;
    
    // Get the text content using JSDOM
    const dom = new JSDOM(fetchResult.html);
    state.currentPageText = dom.window.document.body?.textContent || '';
    
    console.log(`✅ [FetchPage] Page fetched: ${state.currentUrl} (status: ${fetchResult.status})`);
    console.log(`📊 [FetchPage] Page size: ${fetchResult.html.length} bytes, text length: ${state.currentPageText.length} chars`);
    console.log(`⏭️ [WorkflowTransition] fetchPage → detectAuthentication`);
    
    console.log('🔍 [ProcessUrl] Event 2:', state.onEvent);
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
    console.log(`⏭️ [WorkflowTransition] detectAuthentication → extractContent (no DOM content)`);
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
      console.log(`⏭️ [WorkflowTransition] detectAuthentication → handleAuthentication`);
    } else {
      console.log(`⏭️ [WorkflowTransition] detectAuthentication → extractContent`);
    }
    
    return {
      ...state,
      requiresAuthentication: authResult.requiresAuthentication,
      authRequest: authResult.authRequest || null
    };
  } catch (error) {
    console.error(`❌ [Authentication] Error detecting authentication:`, error);
    console.log(`⏭️ [WorkflowTransition] detectAuthentication → extractContent (error case)`);
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
  
  console.log(`⏭️ [WorkflowTransition] handleAuthentication → fetchPage (retry after auth)`);
  
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
    console.log(`⏭️ [WorkflowTransition] extractContent → discoverLinks (skipping extraction)`);
    return state;
  }
  
  try {
    // Send event about starting content extraction
    if (state.onEvent) {
      await state.onEvent({
        type: 'extract-content',
        url: state.currentUrl,
        contentType: 'text/html'
      });
    }
    
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
    console.log(`⏭️ [WorkflowTransition] extractContent → discoverLinks`);
    
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
    console.log(`⏭️ [WorkflowTransition] extractContent → discoverLinks (error case)`);
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
    console.log(`⏭️ [WorkflowTransition] discoverLinks → queueDiscovery (skipping discovery)`);
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
      
      // Send event about discovered links
      if (state.onEvent) {
        await state.onEvent({
          type: 'discover-links',
          url: state.currentUrl,
          linkCount: pageContent.links.length
        });
      }
    }
    
    console.log(`⏭️ [WorkflowTransition] discoverLinks → queueDiscovery`);
    
    return {
      ...state,
      extractedContent: contentCopy
    };
  } catch (error) {
    console.error(`❌ [LinkDiscovery] Error discovering links:`, error);
    console.log(`⏭️ [WorkflowTransition] discoverLinks → queueDiscovery (error case)`);
    return state;
  }
}

/**
 * Queue Discovery Node - Discovers and prepares links for external queue management
 * This is a modified version of the original queueManager function
 * that collects links but doesn't handle the queue directly
 */
async function queueDiscovery(state: ExtendedScraperAgentState) {
  console.log(`🔄 [QueueDiscovery] Discovering links for external queue management`);
  
  // Get the current page content
  const currentPageContent = state.extractedContent.get(state.currentUrl);
  
  if (!currentPageContent || !state.currentUrl) {
    console.log(`⚠️ [QueueDiscovery] No page content or current URL available`);
    state.discoveredUrls = [];
    
    // Go to finalize node
    console.log(`⏭️ [WorkflowTransition] queueDiscovery → finalizeProcessing`);
    return state;
  }
  
  // Use currentUrlDepth to determine if we can add more URLs
  const currentDepth = state.currentUrlDepth || 0;
  
  if (currentDepth >= state.maxDepth) {
    console.log(`🛑 [QueueDiscovery] At max depth (${currentDepth}), not adding more URLs`);
    state.discoveredUrls = [];
    
    // Go to finalize node
    console.log(`⏭️ [WorkflowTransition] queueDiscovery → finalizeProcessing`);
    return state;
  }
  
  // Prepare a list of discovered URLs for the external orchestrator
  const discoveredUrls: UrlQueueItem[] = [];
  
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
        link.url.toLowerCase().includes(pattern.toLowerCase())
      );
    }
    
    // If passed must-include check, now check exclude patterns
    if (shouldEnqueue && state.filters.excludePatterns && state.filters.excludePatterns.length > 0) {
      shouldEnqueue = !state.filters.excludePatterns.some(pattern => 
        link.url.toLowerCase().includes(pattern.toLowerCase())
      );
    }
    
    if (shouldEnqueue) {
      // Add the link to the discovered URLs list
      discoveredUrls.push({
        url: link.url,
        depth: currentDepth + 1,
        expectedValue: link.predictedValue
      });
    }
  }
  
  console.log(`📈 [QueueDiscovery] Discovered ${discoveredUrls.length} new URLs for external queue`);
  
  // Store discovered URLs in state for the orchestrator to use
  state.discoveredUrls = discoveredUrls;
  
  // Send queue status event
  if (state.onEvent) {
    await state.onEvent({
      type: 'evaluate-progress',
      pagesScraped: state.extractedContent.size,
      queueSize: discoveredUrls.length, // This is just the newly discovered URLs
      goalCompletion: Math.min(state.extractedContent.size / state.maxPages, 1.0)
    });
  }
  
  console.log(`⏭️ [WorkflowTransition] queueDiscovery → finalizeProcessing`);
  return state;
}

/**
 * Finalize Processing Node - Completes the processing of a single URL
 * This is a new node that prepares the state for returning to the orchestrator
 */
async function finalizeProcessing(state: ExtendedScraperAgentState) {
  console.log(`🏁 [Finalize] Completing single URL processing for: ${state.currentUrl}`);
  
  // Mark processing as complete for this URL
  state.processingComplete = true;
  
  // Prepare a partial output just for this URL
  const currentPageContent = state.extractedContent.get(state.currentUrl);
  if (currentPageContent) {
    state.currentPageOutput = currentPageContent;
    console.log(`📦 [Finalize] Prepared output for ${state.currentUrl}`);
  }
  
  console.log('🔍 [ProcessUrl] Event 3:', state.onEvent);
  // Send completion event
  if (state.onEvent) {
    await state.onEvent({
      type: 'workflow-status',
      step: 'url-complete',
      progress: state.extractedContent.size / state.maxPages,
      message: `Completed processing for ${state.currentUrl}`
    });
  }
  
  console.log(`✅ [Finalize] URL processing complete`);
  return state;
}

/**
 * Prepare the final output - Used by the orchestrator to combine results
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
 * Create the scraper workflow with a batch-oriented LangGraph structure
 * This version processes a single URL and then terminates
 */
export function createScraperWorkflow(options: {
  onAuthRequired?: (authRequest: HumanAuthRequest) => Promise<boolean>;
  onPageProcessed?: (pageContent: PageContent) => Promise<void>;
  onEvent?: (event: ScraperStreamEvent) => Promise<void>;
}) {
  // Create a StateGraph with the annotation-based state structure
  const workflow = new StateGraph(ScraperStateAnnotation)
    // Add nodes for each step
    .addNode("processUrl", processUrl)
    .addNode("fetchPage", fetchPageContent)
    .addNode("detectAuthentication", detectAuthentication)
    .addNode("handleAuthentication", (state) => handleAuthentication(state, options))
    .addNode("extractContent", extractPageContent)
    .addNode("discoverLinks", discoverLinks)
    .addNode("queueDiscovery", queueDiscovery)
    .addNode("finalizeProcessing", finalizeProcessing);
  
  // Define a linear flow for single URL processing
  workflow.addEdge(START, "processUrl");
  workflow.addEdge("processUrl", "fetchPage");
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
  workflow.addEdge("discoverLinks", "queueDiscovery");
  
  // After queue discovery, finalize processing
  workflow.addEdge("queueDiscovery", "finalizeProcessing");
  
  // Always terminate after finalizing (no looping back)
  workflow.addEdge("finalizeProcessing", END);
  
  return workflow.compile();
}

/**
 * Process a single URL using the workflow
 * This is a utility function that will be called by the orchestrator
 */
export async function processSingleUrl(options: {
  url: string;
  depth: number;
  state: Partial<ExtendedScraperAgentState>;
  onAuthRequired?: (authRequest: HumanAuthRequest) => Promise<boolean>;
  onPageProcessed?: (pageContent: PageContent) => Promise<void>;
  onEvent?: (event: ScraperStreamEvent) => Promise<void>;
}): Promise<ExtendedScraperAgentState> {
  console.log(`🚀 [SingleUrlProcessor] Processing URL: ${options.url} (depth: ${options.depth})`);
  
  try {
    // Create the workflow
    const workflow = createScraperWorkflow({
      onAuthRequired: options.onAuthRequired,
      onPageProcessed: options.onPageProcessed,
      onEvent: options.onEvent,
    });
    
    // Initialize the minimal state needed for processing this URL
    const initialState: ExtendedScraperAgentState = {
      ...(options.state as ExtendedScraperAgentState),
      currentUrl: options.url,
      currentUrlDepth: options.depth,
      discoveredUrls: [],
      processingComplete: false,
      currentPageOutput: null,
      onEvent: options.onEvent
    };
    
    // Execute the workflow for a single URL
    console.log(`⚙️ [SingleUrlProcessor] Executing workflow for ${options.url}`);
    
    const result = await workflow.invoke(initialState);
    
    console.log(`✅ [SingleUrlProcessor] Completed processing URL: ${options.url}`);
    
    return result;
  } catch (error) {
    console.error(`❌ [SingleUrlProcessor] Error processing URL ${options.url}:`, error);
    throw error;
  }
} 