import type { ScraperAgentState, ScraperOutput, PageContent, ScraperStreamEvent, HumanAuthRequest, AuthenticationConfig } from './types';
import { JSDOM } from 'jsdom';
import { URLAnalysisOutput } from '@/lib/chains/url-analysis-chain';
import { runURLAnalysisChain } from '@/lib/chains/url-analysis-chain';
import { runContentExtractionChain } from '@/lib/chains/content-extraction-chain';
import { runLinkDiscoveryChain } from '@/lib/chains/link-discovery-chain';
import { runProgressEvaluationChain } from '@/lib/chains/progress-evaluation-chain';
import { runNavigationDecisionChain } from '@/lib/chains/navigation-decision-chain';
import { runAuthenticationDetectionChain } from '@/lib/chains/authentication-detection-chain';
import { fetchPage } from './core/browser-interface';
import { StateGraph, END, START } from '@langchain/langgraph';
import { ScraperStateAnnotation } from './state';

/**
 * Extended scraper agent state for workflow
 */
interface ExtendedScraperAgentState extends ScraperAgentState {
  lastStatusCode?: number;
  maxDepth?: number;
  urlAnalysis?: URLAnalysisOutput;
  lastError?: string;
  authRequest?: HumanAuthRequest | null;
  includeImages: boolean;
  executeJavaScript?: boolean;
  preventDuplicateUrls?: boolean;
  filters: {
    mustIncludePatterns?: string[];
    excludePatterns?: string[];
  };
  onPageProcessed?: (pageContent: PageContent) => Promise<void>;
  onEvent?: (event: ScraperStreamEvent) => Promise<void>;
  normalizedUrls?: Set<string>;
  contentSignatures?: Set<string>;
  authAttempts?: Map<string, number>;
  // Tracking variables for debugging recursion issues
  nodeVisitCounts?: Map<string, number>;
  executionPath?: string[];
  lastStateSnapshot?: {
    timestamp: number;
    currentUrl: string;
    queueSize: number;
    extractedSize: number;
    nodeSequence: string;
  }[];
}

/**
 * Helper function to increment node visit counter
 */
function incrementNodeVisit(state: ExtendedScraperAgentState, nodeName: string) {
  // Initialize tracking maps if they don't exist
  if (!state.nodeVisitCounts) {
    state.nodeVisitCounts = new Map<string, number>();
  }
  if (!state.executionPath) {
    state.executionPath = [];
  }
  
  // Increment visit count
  const currentCount = state.nodeVisitCounts.get(nodeName) || 0;
  state.nodeVisitCounts.set(nodeName, currentCount + 1);
  
  // Add to execution path
  state.executionPath.push(nodeName);
  
  // If the execution path gets too long, keep only the last 100 steps
  if (state.executionPath.length > 100) {
    state.executionPath = state.executionPath.slice(-100);
  }
  
  // Log the current node visit counts
  if ((currentCount + 1) % 5 === 0) { // Log every 5 visits to avoid too much noise
    console.log(`🔄 [Workflow Debug] Node visit counts:`, Object.fromEntries(state.nodeVisitCounts.entries()));
    
    // Check for potential loops in the execution path
    const recentPath = state.executionPath.slice(-20).join(' → ');
    console.log(`🔄 [Workflow Debug] Recent execution path: ${recentPath}`);
  }
}

/**
 * Take a snapshot of the current state for debugging
 */
function takeStateSnapshot(state: ExtendedScraperAgentState) {
  if (!state.lastStateSnapshot) {
    state.lastStateSnapshot = [];
  }
  
  // Create a snapshot with essential state data
  const snapshot = {
    timestamp: Date.now(),
    currentUrl: state.currentUrl || 'none',
    queueSize: state.pageQueue.size(),
    extractedSize: state.extractedContent.size,
    nodeSequence: state.executionPath ? state.executionPath.slice(-5).join(' → ') : ''
  };
  
  // Add to snapshots array
  state.lastStateSnapshot.push(snapshot);
  
  // Keep only the last 10 snapshots
  if (state.lastStateSnapshot.length > 10) {
    state.lastStateSnapshot = state.lastStateSnapshot.slice(-10);
  }
  
  // Check for potential state loops
  if (state.lastStateSnapshot.length >= 3) {
    const lastSnapshots = state.lastStateSnapshot.slice(-3);
    
    // Check if the queue size and extracted content size haven't changed in 3 consecutive snapshots
    if (lastSnapshots.every(s => s.queueSize === lastSnapshots[0].queueSize) &&
        lastSnapshots.every(s => s.extractedSize === lastSnapshots[0].extractedSize)) {
      console.warn(`⚠️ [Workflow Debug] Potential state loop detected! No progress in queue or extracted content for 3 consecutive snapshots.`);
      
      // Log detailed state info for debugging
      console.warn(`⚠️ [Workflow Debug] Current URL: ${state.currentUrl}`);
      console.warn(`⚠️ [Workflow Debug] Queue size: ${state.pageQueue.size()}`);
      console.warn(`⚠️ [Workflow Debug] Extracted content size: ${state.extractedContent.size}`);
      console.warn(`⚠️ [Workflow Debug] Last node sequence: ${snapshot.nodeSequence}`);
    }
  }
}

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
    
    items: items.map(i => i.item),
  };
}

/**
 * Analyze the current URL
 */
async function analyzeURL(state: ExtendedScraperAgentState) {
  incrementNodeVisit(state, 'analyzeURL');
  takeStateSnapshot(state);
  
  try {
    console.log(`🔍 [Workflow] Analyzing URL: ${state.currentUrl}`);
    
    // Get the current depth from the queue
    const currentQueueItem = Array.from(state.pageQueue.items).find(item => item.url === state.currentUrl);
    const currentDepth = currentQueueItem?.depth || 0;
    
    // Send event about starting URL analysis
    if (state.onEvent) {
      await state.onEvent({
        type: 'analyze-url',
        url: state.currentUrl,
        depth: currentDepth
      });
    }
    
    // Run the URL analysis chain
    const analysis = await runURLAnalysisChain({
      url: state.currentUrl,
      scrapingGoal: state.scrapingGoal,
      currentState: state
    });
    
    console.log(`✅ [Workflow] URL analysis complete for ${state.currentUrl}`);
    console.log(`📋 [Workflow] Analysis: relevance=${analysis.relevanceScore.toFixed(2)}, expectedValue=${analysis.expectedValue.toFixed(2)}`);
    
    // Store the analysis in state
    state.urlAnalysis = analysis;
    
    // Send event about workflow status
    if (state.onEvent) {
      await state.onEvent({
        type: 'workflow-status',
        step: 'analyze-url',
        progress: 0.1,
        message: `Analyzed URL ${state.currentUrl} with relevance score ${analysis.relevanceScore.toFixed(2)}`
      });
    }
    
    return state;
  } catch (error) {
    console.error(`❌ [Workflow] Error analyzing URL ${state.currentUrl}:`, error);
    state.lastError = `URL analysis error: ${error instanceof Error ? error.message : String(error)}`;
    
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
 * Fetch the page content for the current URL
 */
async function fetchPageContent(state: ExtendedScraperAgentState) {
  incrementNodeVisit(state, 'fetchPageContent');
  takeStateSnapshot(state);
  
  // Skip if we don't have a current URL
  if (!state.currentUrl) {
    console.log(`⚠️ [Workflow] No current URL to fetch`);
    return state;
  }
  
  console.log(`🌐 [Workflow] Fetching page: ${state.currentUrl}`);
  
  // Send event about starting page fetch
  if (state.onEvent) {
    await state.onEvent({
      type: 'fetch-start',
      url: state.currentUrl,
      useJavaScript: state.executeJavaScript || false
    });
  }
  
  try {
    // Fetch the page content - remove the includeImages parameter
    const fetchResult = await fetchPage(state.currentUrl, {
      executeJavaScript: state.executeJavaScript
    });
    
    // Store the result in state
    state.currentPageDOM = fetchResult.html;
    state.lastStatusCode = fetchResult.status;
    
    // Get the text content using JSDOM
    const dom = new JSDOM(fetchResult.html);
    state.currentPageText = dom.window.document.body?.textContent || '';
    
    console.log(`✅ [Workflow] Page fetched: ${state.currentUrl} (status: ${fetchResult.status})`);
    console.log(`📊 [Workflow] Page size: ${fetchResult.html.length} bytes`);
    
    // Add to visited URLs
    state.visitedUrls.add(state.currentUrl);
    
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
    console.error(`❌ [Workflow] Error fetching page ${state.currentUrl}:`, error);
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
 * Authentication Detection Node - Checks if authentication is required
 */
async function detectAuthentication(state: ExtendedScraperAgentState) {
  // Increment node visit counter for debugging
  incrementNodeVisit(state, 'detectAuthentication');
  const startTime = Date.now();
  console.log(`🔒 [Authentication] Checking authentication for: ${state.currentUrl}`);
  
  if (!state.currentPageDOM) {
    console.log(`⚠️ [Authentication] No DOM content available to check authentication`);
    return {
      ...state,
      requiresAuthentication: false
    };
  }
  
  try {
    const authResult = await runAuthenticationDetectionChain({
      html: state.currentPageDOM,
      url: state.currentUrl,
      statusCode: state.lastStatusCode || 200
    });
    
    const endTime = Date.now();
    console.log(`✅ [Authentication] Check completed in ${endTime - startTime}ms`);
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
    const endTime = Date.now();
    console.error(`❌ [Authentication] Error detecting authentication in ${endTime - startTime}ms:`, error);
    return {
      ...state,
      requiresAuthentication: false,
      authRequest: null
    };
  }
}

/**
 * Handle Authentication Node - Handles authentication process if required
 */
async function handleAuthentication(state: ExtendedScraperAgentState, options: {
  onAuthRequired?: (authRequest: HumanAuthRequest) => Promise<boolean>;
}) {
  // Increment node visit counter for debugging
  incrementNodeVisit(state, 'handleAuthentication');
  console.log(`🔒 [Authentication] Handling authentication for: ${state.currentUrl}`);
  
  if (!state.requiresAuthentication || !state.authRequest) {
    return state;
  }
  
  // Initialize auth attempts tracking if not exists
  if (!state.authAttempts) {
    state.authAttempts = new Map<string, number>();
  }
  
  // Get current attempts for this URL
  const currentAttempts = state.authAttempts.get(state.currentUrl) || 0;
  
  // If we've already tried auth too many times on this URL, skip it
  if (currentAttempts >= 2) {
    console.log(`⚠️ [Authentication] Too many auth attempts (${currentAttempts}) for ${state.currentUrl}, skipping`);
    
    // Skip this URL and move to the next one
    const nextState = { ...state };
    
    // Mark this URL as visited to avoid trying again
    nextState.visitedUrls.add(state.currentUrl);
    
    // Get the next URL from the queue
    const nextItem = nextState.pageQueue.dequeue();
    
    if (nextItem) {
      console.log(`⏭️ [Authentication] Moving to next URL: ${nextItem.url}`);
      nextState.currentUrl = nextItem.url;
      // Clear auth flags to prevent loop
      nextState.requiresAuthentication = false;
      nextState.authRequest = null;
    } else {
      // If no more URLs, prepare to finish
      console.log(`🏁 [Authentication] No more URLs in queue after skipping auth required URL`);
      nextState.currentUrl = "";
    }
    
    return nextState;
  }
  
  // Increment attempt counter for this URL
  state.authAttempts.set(state.currentUrl, currentAttempts + 1);
  console.log(`🔄 [Authentication] Auth attempt #${currentAttempts + 1} for ${state.currentUrl}`);
  
  // If there's an auth handler, use it
  if (options.onAuthRequired) {
    try {
      const authSuccess = await options.onAuthRequired(state.authRequest);
      
      if (authSuccess) {
        // If authentication was successful, fetch the page again
        const fetchResult = await fetchPage(state.currentUrl);
        
        return {
          ...state,
          requiresAuthentication: false,
          currentPageDOM: fetchResult.html,
          currentPageText: fetchResult.html, // Use HTML as text
          lastStatusCode: fetchResult.status
        };
      }
    } catch (error) {
      console.error("❌ [Authentication] Error handling authentication:", error);
    }
  }
  
  // If authentication failed or no handler, skip this URL and move to the next one
  console.log(`⚠️ [Authentication] No authentication handler or auth failed. Skipping URL: ${state.currentUrl}`);
  const nextState = { ...state };
  
  // Mark this URL as visited to avoid trying again
  nextState.visitedUrls.add(state.currentUrl);
  
  // Get the next URL from the queue
  const nextItem = nextState.pageQueue.dequeue();
  
  if (nextItem) {
    console.log(`⏭️ [Authentication] Moving to next URL: ${nextItem.url}`);
    nextState.currentUrl = nextItem.url;
    // Clear auth flags to prevent loop
    nextState.requiresAuthentication = false;
    nextState.authRequest = null;
  } else {
    // If no more URLs, prepare to finish
    console.log(`🏁 [Authentication] No more URLs in queue after skipping auth required URL`);
    nextState.currentUrl = "";
  }
  
  return nextState;
}

/**
 * Extract Content Node - Extracts content from the page
 */
async function extractPageContent(state: ExtendedScraperAgentState) {
  // Increment node visit counter for debugging
  incrementNodeVisit(state, 'extractContent');
  const startTime = Date.now();
  console.log(`📑 [ContentExtraction] Starting content extraction for: ${state.currentUrl}`);
  
  if (!state.currentPageDOM || state.requiresAuthentication) {
    console.error(`❌ [ContentExtraction] Cannot extract content - ${!state.currentPageDOM ? 'No DOM content' : 'Authentication required'}`);
    return state;
  }
  
  try {
    console.log(`🔍 [ContentExtraction] Calling content extraction chain...`);
    const extractStartTime = Date.now();
    
    const contentResult = await runContentExtractionChain({
      html: state.currentPageDOM,
      url: state.currentUrl,
      currentState: state
    });
    
    const extractEndTime = Date.now();
    console.log(`⏱️ [ContentExtraction] Extraction process took ${extractEndTime - extractStartTime}ms`);
    console.log(`📊 [ContentExtraction] Metrics: density=${contentResult.metrics.informationDensity.toFixed(2)}, relevance=${contentResult.metrics.relevance.toFixed(2)}, uniqueness=${contentResult.metrics.uniqueness.toFixed(2)}`);
    
    // Create a copy of the extracted content map
    const updatedContent = new Map(state.extractedContent);
    
    // Create the page content object
    const pageContent = {
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
    console.log(`📦 [ContentExtraction] Map now contains ${updatedContent.size} pages`);
    
    // Call the onPageProcessed callback if provided
    if (state.onPageProcessed) {
      try {
        const callbackStartTime = Date.now();
        console.log(`📣 [ContentExtraction] Calling onPageProcessed callback...`);
        await state.onPageProcessed(pageContent);
        console.log(`⏱️ [ContentExtraction] Callback executed in ${Date.now() - callbackStartTime}ms`);
      } catch (callbackError) {
        console.error(`❌ [ContentExtraction] Error in onPageProcessed callback:`, callbackError);
      }
    }
    
    const endTime = Date.now();
    console.log(`✅ [ContentExtraction] Content extraction completed in ${endTime - startTime}ms total`);
    
    return {
      ...state,
      extractedContent: updatedContent
    };
  } catch (error) {
    const endTime = Date.now();
    console.error(`❌ [ContentExtraction] Error extracting content in ${endTime - startTime}ms:`, error);
    return state;
  }
}

/**
 * Discover Links Node - Identifies and prioritizes links on the page
 */
async function discoverLinks(state: ExtendedScraperAgentState) {
  // Increment node visit counter for debugging
  incrementNodeVisit(state, 'discoverLinks');
  const startTime = Date.now();
  console.log(`🔗 [LinkDiscovery] Starting link discovery for: ${state.currentUrl}`);
  
  if (!state.currentPageDOM || state.requiresAuthentication) {
    console.error(`❌ [LinkDiscovery] Cannot discover links - ${!state.currentPageDOM ? 'No DOM content' : 'Authentication required'}`);
    return state;
  }
  
  try {
    console.log(`🔍 [LinkDiscovery] Calling link discovery chain...`);
    const discoveryStartTime = Date.now();
    
    const linkResult = await runLinkDiscoveryChain({
      html: state.currentPageDOM,
      currentUrl: state.currentUrl,
      currentState: state
    });
    
    const discoveryEndTime = Date.now();
    console.log(`⏱️ [LinkDiscovery] Discovery process took ${discoveryEndTime - discoveryStartTime}ms`);
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
        visited: Boolean(state.visitedUrls.has(link.url) || 
                (state.normalizedUrls && state.normalizedUrls.has(normalizeUrl(link.url))))
      }));
      
      contentCopy.set(state.currentUrl, pageContent);
      console.log(`📝 [LinkDiscovery] Updated page content with ${pageContent.links.length} links`);
    } else {
      console.warn(`⚠️ [LinkDiscovery] Page content not found in map for ${state.currentUrl}`);
    }
    
    // Add unvisited links to the queue
    const queueStartTime = Date.now();
    const currentDepth = state.pageQueue.peek()?.depth || 0;
    let newLinksAdded = 0;
    
    linkResult.links.forEach(link => {
      const normalizedLink = normalizeUrl(link.url);
      const alreadyVisitedNormalized = state.normalizedUrls ? state.normalizedUrls.has(normalizedLink) : false;
      const alreadyVisitedExact = state.visitedUrls.has(link.url);
      
      if (!alreadyVisitedExact && !alreadyVisitedNormalized && 
          (currentDepth + 1) <= (state.maxDepth || 3)) {
        
        // Apply filters if provided
        let shouldEnqueue = true;
        
        // Enhanced URL Discovery Filter
        try {
          // Skip URLs that are too similar to already visited ones
          const urlPath = new URL(link.url).pathname;
          const similarVisitedPaths = Array.from(state.visitedUrls)
            .filter(visited => {
              try {
                return new URL(visited).pathname === urlPath;
              } catch (error) {
                console.warn(`⚠️ [LinkDiscovery] Error in URL comparison: ${error}`);
                return false;
              }
            })
            .length;

          if (similarVisitedPaths > 0) {
            shouldEnqueue = false;
            console.log(`🔄 [LinkDiscovery] Skipping ${link.url} - similar path already visited`);
          }

          // Skip URLs with very low predicted value
          if (link.predictedValue < 0.2) {
            shouldEnqueue = false;
            console.log(`🔄 [LinkDiscovery] Skipping ${link.url} - low value (${link.predictedValue.toFixed(2)})`);
          }
        } catch (filterError) {
          // If URL parsing fails, continue with original filter logic
          console.warn(`⚠️ [LinkDiscovery] Error in enhanced filter: ${filterError}`);
        }
        
        // Check for must-include patterns
        if (shouldEnqueue && state.filters.mustIncludePatterns && state.filters.mustIncludePatterns.length > 0) {
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
          state.pageQueue.enqueue({
            url: link.url,
            expectedValue: link.predictedValue,
            depth: currentDepth + 1
          }, link.predictedValue);
          newLinksAdded++;
        }
      }
    });
    
    console.log(`⏱️ [LinkDiscovery] Queue update took ${Date.now() - queueStartTime}ms`);
    console.log(`🔗 [LinkDiscovery] Added ${newLinksAdded} new links to the queue. Queue now has ${state.pageQueue.size()} items.`);
    
    const endTime = Date.now();
    console.log(`✅ [LinkDiscovery] Link discovery completed in ${endTime - startTime}ms total`);
    
    return {
      ...state,
      extractedContent: contentCopy
    };
  } catch (error) {
    const endTime = Date.now();
    console.error(`❌ [LinkDiscovery] Error discovering links in ${endTime - startTime}ms:`, error);
    return state;
  }
}

/**
 * Evaluate Progress Node - Evaluates the progress of the scraping operation
 */
async function evaluateProgress(state: ExtendedScraperAgentState) {
  // Increment node visit counter for debugging
  incrementNodeVisit(state, 'evaluateProgress');
  const startTime = Date.now();
  console.log(`📈 [Progress] Evaluating scraping progress...`);
  console.log(`📊 [Progress] Current state: ${state.extractedContent.size} pages extracted, ${state.visitedUrls.size} URLs visited`);
  
  try {
    console.log(`🔍 [Progress] Calling progress evaluation chain...`);
    const evalStartTime = Date.now();
    
    const progressResult = await runProgressEvaluationChain({
      currentState: state
    });
    
    const evalEndTime = Date.now();
    console.log(`⏱️ [Progress] Evaluation process took ${evalEndTime - evalStartTime}ms`);
    console.log(`📊 [Progress] Metrics: completeness=${progressResult.metrics.completeness.toFixed(2)}, relevance=${progressResult.metrics.relevance.toFixed(2)}`);
    
    const endTime = Date.now();
    console.log(`✅ [Progress] Evaluation completed in ${endTime - startTime}ms total`);
    
    return {
      ...state,
      valueMetrics: progressResult.metrics
    };
  } catch (error) {
    const endTime = Date.now();
    console.error(`❌ [Progress] Error evaluating progress in ${endTime - startTime}ms:`, error);
    return {
      ...state,
      valueMetrics: {
        informationDensity: 0.5,
        relevance: 0.5,
        uniqueness: 0.5,
        completeness: 0.5
      }
    };
  }
}

/**
 * Navigation Decision Node - Decides what to do next
 */
async function decideNextAction(state: ExtendedScraperAgentState) {
  // Increment node visit counter for debugging
  incrementNodeVisit(state, 'decideNextAction');
  const startTime = Date.now();
  console.log(`🧭 [Navigation] Deciding next action...`);
  
  // Enhanced debug logging when approaching recursion limit
  const decisionCount = state.nodeVisitCounts?.get('decideNextAction') || 0;
  if (decisionCount > 20) {
    console.warn(`⚠️ [Debug] Near recursion limit! Dumping state:`);
    console.warn(`  Current URL: ${state.currentUrl}`);
    console.warn(`  Queue size: ${state.pageQueue.size()}`);
    console.warn(`  Visited URLs: ${state.visitedUrls.size}`);
    console.warn(`  Extracted content: ${state.extractedContent.size}`);
  }
  
  // Forced termination fallback to prevent hitting recursion limit
  if (decisionCount > 15) {
    console.warn(`⚠️ [Workflow] Force terminating after ${decisionCount} decision cycles`);
    return {
      ...state,
      finalOutput: prepareOutput(state)
    };
  }
  
  // Take state snapshot for debugging
  takeStateSnapshot(state);
  
  // Enhanced URL marking - Fix URL Queue Processing
  if (state.currentUrl) {
    state.visitedUrls.add(state.currentUrl);
    
    // Also mark in normalized form if that option is enabled
    if (state.preventDuplicateUrls && state.normalizedUrls) {
      state.normalizedUrls.add(normalizeUrl(state.currentUrl));
    }
    
    console.log(`✓ [Navigation] Marked ${state.currentUrl} as visited (total: ${state.visitedUrls.size})`);
  }
  
  console.log(`📊 [Navigation] Current state: ${state.extractedContent.size} pages extracted, ${state.visitedUrls.size} URLs visited, ${state.pageQueue.size()} URLs in queue`);
  
  // Check if we've reached the maximum number of pages
  if (state.extractedContent.size >= state.maxPages) {
    console.log(`🏁 [Navigation] Maximum number of pages (${state.maxPages}) reached. Completing workflow.`);
    return {
      ...state,
      finalOutput: prepareOutput(state)
    };
  }
  
  try {
    console.log(`🔍 [Navigation] Calling navigation decision chain...`);
    const decisionStartTime = Date.now();
    
    const decisionResult = await runNavigationDecisionChain({
      currentState: state,
      progressMetrics: state.valueMetrics
    });
    
    const decisionEndTime = Date.now();
    console.log(`⏱️ [Navigation] Decision process took ${decisionEndTime - decisionStartTime}ms`);
    console.log(`🔄 [Navigation] Decision: action="${decisionResult.action}", reason="${decisionResult.reason}"`);
    
    if (decisionResult.action === 'complete') {
      // We're done scraping, prepare the final output
      console.log(`🏁 [Navigation] Navigation chain decided to complete. Preparing final output with ${state.extractedContent.size} pages.`);
      return {
        ...state,
        finalOutput: prepareOutput(state)
      };
    } else {
      // Continue scraping with the next URL
      const nextItem = state.pageQueue.dequeue();
      
      if (nextItem) {
        console.log(`➡️ [Navigation] Next URL: ${nextItem.url} (depth: ${nextItem.depth}, value: ${nextItem.expectedValue.toFixed(2)})`);
        return {
          ...state,
          currentUrl: nextItem.url
        };
      } else {
        // No more URLs, prepare to finish
        console.log(`🏁 [Navigation] No more URLs in queue. Finishing with ${state.extractedContent.size} pages.`);
        return {
          ...state,
          currentUrl: "",
          finalOutput: prepareOutput(state)
        };
      }
    }
  } catch (error) {
    const endTime = Date.now();
    console.error(`❌ [Navigation] Error deciding next action in ${endTime - startTime}ms:`, error);
    
    // In case of error, try to continue with the next URL
    const nextItem = state.pageQueue.dequeue();
    
    if (nextItem) {
      console.log(`⚠️ [Navigation] Error in decision chain. Continuing with next URL: ${nextItem.url}`);
      return {
        ...state,
        currentUrl: nextItem.url
      };
    } else {
      // No more URLs, prepare to finish
      console.log(`🏁 [Navigation] Error in decision chain. No more URLs. Finishing with ${state.extractedContent.size} pages.`);
      return {
        ...state,
        currentUrl: "",
        finalOutput: prepareOutput(state)
      };
    }
  }
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
  
  try {
    // Convert the Map to an array
    const pages = Array.from(state.extractedContent.values());
    
    console.log(`📊 [Workflow] Final output will contain ${pages.length} pages`);
    console.log(`📑 [Workflow] Pages summary:`);
    
    let totalContentSize = 0;
    pages.forEach((page, index) => {
      // Ensure we have valid content
      if (!page.content) {
        console.warn(`⚠️ [Workflow] Page #${index + 1} (${page.url}) has empty content!`);
        page.content = "No content extracted";
      }
      
      // Calculate content size
      totalContentSize += page.content.length;
      
      // Log summary info
      console.log(`  📄 #${index + 1}: ${page.url}`);
      console.log(`     Title: "${page.title || 'Untitled'}"`);
      console.log(`     Content: ${page.content.length} chars`);
      console.log(`     Links: ${(page.links || []).length}`);
      
      // Ensure all required fields exist
      if (!page.links) page.links = [];
      if (!page.entities) page.entities = [];
      if (!page.extractionTime) page.extractionTime = new Date().toISOString();
      
      // Ensure metrics exist
      if (!page.metrics) {
        console.warn(`⚠️ [Workflow] Page #${index + 1} (${page.url}) has no metrics!`);
        page.metrics = {
          informationDensity: 0.5,
          relevance: 0.5,
          uniqueness: 0.5
        };
      }
      
      console.log(`     Metrics: relevance=${page.metrics.relevance.toFixed(2)}, density=${page.metrics.informationDensity.toFixed(2)}`);
      
      if (page.metrics.contentQualityAnalysis) {
        console.log(`     Analysis: ${page.metrics.contentQualityAnalysis.substring(0, 100)}...`);
      }
    });
    
    console.log(`📈 [Workflow] Total content size: ${totalContentSize} chars`);
    console.log(`📈 [Workflow] Goal completion: ${state.valueMetrics.completeness.toFixed(2)}`);
    console.log(`📈 [Workflow] Coverage score: ${state.valueMetrics.relevance.toFixed(2)}`);
    
    return {
      pages,
      summary: {
        pagesScraped: pages.length,
        totalContentSize,
        executionTime: 0, // Will be calculated in the executeScraperWorkflow function
        goalCompletion: state.valueMetrics.completeness,
        coverageScore: state.valueMetrics.relevance
      }
    };
  } catch (error) {
    console.error(`❌ [Workflow] Error preparing output:`, error);
    // Return empty output as fallback
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
}

/**
 * Normalize a URL to create a consistent representation for deduplication
 */
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
    const path = parsed.pathname.replace(/\/(index\.(html?|php|aspx?))?\/?$/, '');
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

/**
 * Generate a signature for content to detect duplicates with different URLs
 */
export function getContentSignature(html: string): string {
  try {
    // Create a DOM parser using JSDOM
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    
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
    console.error(`⚠️ [ScraperAgent] Error generating content signature`, e);
    return '';
  }
}

/**
 * Create the scraper workflow with LangGraph
 */
export function createScraperWorkflow(options: {
  onAuthRequired?: (authRequest: HumanAuthRequest) => Promise<boolean>;
  onPageProcessed?: (pageContent: PageContent) => Promise<void>;
  onEvent?: (event: ScraperStreamEvent) => Promise<void>;
}) {
  // Create a StateGraph with the annotation-based state structure
  const workflow = new StateGraph(ScraperStateAnnotation)
    // Add nodes for each step
    .addNode("analyzeURL", analyzeURL)
    .addNode("fetchPage", fetchPageContent)
    .addNode("detectAuthentication", detectAuthentication)
    .addNode("handleAuthentication", (state) => handleAuthentication(state, options))
    .addNode("extractContent", extractPageContent)
    .addNode("discoverLinks", discoverLinks)
    .addNode("evaluateProgress", evaluateProgress)
    .addNode("decideNextAction", decideNextAction);
  
  // Define the main flow
  workflow.addEdge(START, "analyzeURL");
  workflow.addEdge("analyzeURL", "fetchPage");
  workflow.addEdge("fetchPage", "detectAuthentication");
  
  // Add conditional edge for authentication
  workflow.addConditionalEdges(
    "detectAuthentication",
    (state) => state.requiresAuthentication ? "handleAuthentication" : "extractContent"
  );
  
  workflow.addEdge("handleAuthentication", "analyzeURL");
  workflow.addEdge("extractContent", "discoverLinks");
  workflow.addEdge("discoverLinks", "evaluateProgress");
  workflow.addEdge("evaluateProgress", "decideNextAction");
  
  // Add conditional edge for deciding the next action
  workflow.addConditionalEdges(
    "decideNextAction",
    (state) => {
      console.log(`🔄 [Workflow] Checking if scraping should continue or end...`);
      
      // Force termination if node visit counts are excessive, indicating a potential loop
      if ('nodeVisitCounts' in state && state.nodeVisitCounts instanceof Map) {
        const decideNextActionCount = state.nodeVisitCounts.get('decideNextAction');
        if (decideNextActionCount && decideNextActionCount > 25) {
          console.warn(`⚠️ [Workflow] Reached excessive node visit count for decideNextAction (${decideNextActionCount}). Forcing termination to prevent infinite recursion.`);
          return END;
        }
      }
      
      // If we have a final output, we're done
      if (state.finalOutput && state.finalOutput.summary.pagesScraped > 0) {
        console.log(`🏁 [Workflow] Final output is ready with ${state.finalOutput.summary.pagesScraped} pages. Ending workflow.`);
        return END;
      }
      
      // If we've reached the maximum number of pages, we're done
      if (state.extractedContent.size >= state.maxPages) {
        console.log(`🏁 [Workflow] Maximum number of pages (${state.maxPages}) reached. Ending workflow.`);
        return END;
      }
      
      // If we have no current URL but pages in queue, continue to next URL
      if (!state.currentUrl && state.pageQueue.size() > 0) {
        console.log(`⚠️ [Workflow] Empty current URL but queue has items. Continuing to next URL.`);
        return "analyzeURL";
      }
      
      // If we have no current URL and no pages in queue, we're done
      if (!state.currentUrl) {
        console.log(`🏁 [Workflow] No current URL and empty queue. Ending workflow.`);
        return END;
      }
      
      // Safety check: if we've processed this URL too many times, end workflow
      const url = state.currentUrl;
      const processCount = state.visitedUrls ? Array.from(state.visitedUrls).filter(u => u === url).length : 0;
      if (processCount > 2) {
        console.log(`🏁 [Workflow] URL ${url} has been processed ${processCount} times. Ending to avoid loops.`);
        return END;
      }

      // If queue is empty and we've processed at least one page, we can end
      if (state.pageQueue.size() === 0 && state.extractedContent.size > 0) {
        console.log(`🏁 [Workflow] Queue is empty and we've extracted content. Ending workflow.`);
        return END;
      }
      
      // Enhanced progress check - if we have good progress and enough pages, consider ending
      if (state.valueMetrics.completeness > 0.8 && state.extractedContent.size >= Math.max(3, Math.floor(state.maxPages * 0.5))) {
        console.log(`🏁 [Workflow] Reached sufficient completeness (${state.valueMetrics.completeness.toFixed(2)}) with ${state.extractedContent.size} pages. Ending workflow.`);
        return END;
      }
      
      // Check for potential cycles in the graph by looking at the number of times URLs have been visited
      const visitCountMap = new Map<string, number>();
      Array.from(state.visitedUrls).forEach(visitedUrl => {
        visitCountMap.set(visitedUrl, (visitCountMap.get(visitedUrl) || 0) + 1);
      });
      
      // If we have too many repeated visits across multiple URLs, end the workflow
      const maxVisitCount = Math.max(...Array.from(visitCountMap.values()));
      const urlsWithMultipleVisits = Array.from(visitCountMap.entries()).filter(([, count]) => count > 1).length;
      
      if (maxVisitCount > 2 && urlsWithMultipleVisits >= 3) {
        console.log(`🏁 [Workflow] Detected multiple URL revisits (${urlsWithMultipleVisits} URLs visited multiple times). Ending workflow to avoid cycles.`);
        return END;
      }
      
      // Check for stagnation - if we have visited many nodes but extracted few pages
      if ('nodeVisitCounts' in state && state.nodeVisitCounts instanceof Map) {
        const totalNodeVisits = Array.from(state.nodeVisitCounts.values()).reduce((sum: number, count: number) => sum + count, 0);
        const extractionEfficiency = state.extractedContent.size / Math.max(1, totalNodeVisits / 7); // 7 nodes per cycle
        
        if (totalNodeVisits > 50 && extractionEfficiency < 0.1) {
          console.warn(`⚠️ [Workflow] Low extraction efficiency detected (${extractionEfficiency.toFixed(3)}). ${state.extractedContent.size} pages extracted in ${totalNodeVisits} node visits. Ending workflow.`);
          return END;
        }
      }
      
      // Check for state stagnation using snapshots
      if ('lastStateSnapshot' in state && Array.isArray(state.lastStateSnapshot) && state.lastStateSnapshot.length >= 5) {
        const lastFiveSnapshots = state.lastStateSnapshot.slice(-5);
        
        // Check if queue and extracted content haven't changed in last 5 snapshots
        const queueSizes = new Set(lastFiveSnapshots.map((s: {queueSize: number}) => s.queueSize));
        const extractedSizes = new Set(lastFiveSnapshots.map((s: {extractedSize: number}) => s.extractedSize));
        
        if (queueSizes.size === 1 && extractedSizes.size === 1 && state.extractedContent.size > 0) {
          console.warn(`⚠️ [Workflow] State stagnation detected! No changes in queue or extracted content for 5 consecutive checks. Ending workflow.`);
          return END;
        }
      }
      
      // Otherwise, continue with the next URL
      console.log(`🔄 [Workflow] Continuing to process URL: ${state.currentUrl}`);
      return "analyzeURL";
    }
  );
  
  // Compile the graph into a runnable
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
  authConfig?: AuthenticationConfig;
  onAuthRequired?: (authRequest: HumanAuthRequest) => Promise<boolean>;
  onPageProcessed?: (pageContent: PageContent) => Promise<void>;
  onEvent?: (event: ScraperStreamEvent) => Promise<void>;
  config?: {
    recursionLimit?: number;
    maxIterations?: number;
    maxExecutionTimeMs?: number;  // Add timeout option
    deadlockDetectionMs?: number; // Add deadlock detection interval
  };
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
  
  // Create a wrapped event handler that handles stream closure
  const safeEventHandler = options.onEvent ? 
    async (event: ScraperStreamEvent): Promise<void> => {
      try {
        await options?.onEvent?.(event);
      } catch (eventError) {
        // Stream might be closed, just log the error
        console.warn(`⚠️ [Workflow] Could not send event (${event.type}): ${eventError instanceof Error ? eventError.message : String(eventError)}`);
      }
    } : undefined;

  // Create a safe send event function that checks if handler exists
  const safeSendEvent = async (event: ScraperStreamEvent): Promise<void> => {
    if (safeEventHandler) {
      try {
        await safeEventHandler(event);
      } catch (error) {
        console.warn(`⚠️ [Workflow] Error in safeSendEvent: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  };
  
  // Implement a circuit breaker to force termination after a certain number of pages
  let pageCount = 0;
  const originalOnPageProcessed = options.onPageProcessed;
  
  const circuitBreakerPageProcessor = async (pageContent: PageContent): Promise<void> => {
    pageCount++;
    console.log(`📊 [CircuitBreaker] Processed page ${pageCount}/${options.maxPages}`);
    
    if (pageCount >= options.maxPages) {
      console.warn(`⚠️ [CircuitBreaker] Reached ${pageCount} pages, signaling to complete workflow`);
    }
    
    if (originalOnPageProcessed) {
      try {
        await originalOnPageProcessed(pageContent);
      } catch (error) {
        console.warn(`⚠️ [CircuitBreaker] Error in original page processor: ${error}`);
      }
    }
  };

  try {
    console.log(`🌐 [Workflow] Starting scraping with URL: ${options.baseUrl}`);
    
    // Use LangGraph workflow with adjusted config for testing
    const config = {
      recursionLimit: options.config?.recursionLimit || 30,       // Lower from 100 for testing
      maxIterations: options.config?.maxIterations || 20,         // Lower from 50 for testing
      maxExecutionTimeMs: options.config?.maxExecutionTimeMs || 3 * 60 * 1000, // 3 minutes instead of 10
      deadlockDetectionMs: options.config?.deadlockDetectionMs || 20 * 1000,
    };
    
    // Wrap the callbacks with safe event handling
    const safePageProcessed = circuitBreakerPageProcessor;
    
    // Create the workflow with safe callbacks
    const workflow = createScraperWorkflow({
      onAuthRequired: options.onAuthRequired,
      onPageProcessed: safePageProcessed,
      onEvent: safeEventHandler,
    });
    
    // Initialize the state
    const initialState: ExtendedScraperAgentState = {
      baseUrl: options.baseUrl,
      scrapingGoal: options.scrapingGoal,
      maxPages: options.maxPages,
      maxDepth: options.maxDepth,
      includeImages: options.includeImages || false,
      executeJavaScript: options.executeJavaScript,
      preventDuplicateUrls: options.preventDuplicateUrls,
      filters: options.filters || {},
      
      currentUrl: options.baseUrl,
      visitedUrls: new Set<string>(),
      pageQueue: createPriorityQueue(),
      
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
      
      onPageProcessed: options.onPageProcessed,
      onEvent: options.onEvent,
      normalizedUrls: new Set<string>(),
      contentSignatures: new Set<string>(),
      authAttempts: new Map<string, number>(),
      
      // Initialize debugging tracking variables
      nodeVisitCounts: new Map<string, number>(),
      executionPath: [],
      lastStateSnapshot: []
    };
    
    const startTime = Date.now();
    
    console.log(`⚙️ [Workflow] Running with config: recursionLimit=${config.recursionLimit}, maxIterations=${config.maxIterations}, maxExecutionTimeMs=${config.maxExecutionTimeMs}, deadlockDetectionMs=${config.deadlockDetectionMs}`);
    
    // Log explicit configuration for debugging
    console.log(`🔧 [Debug] Applying LangGraph config:`, JSON.stringify({
      recursionLimit: config.recursionLimit,
      maxIterations: config.maxIterations
    }));
    
    console.time('LangGraphWorkflowExecution');
    
    // Execute the workflow with timeout and deadlock detection - use correct options format
    const workflowPromise = workflow.invoke(initialState, {
      recursionLimit: config.recursionLimit
    });
    
    // Set up timeout monitoring through events rather than competing promises
    const timeoutId = setTimeout(async () => {
      console.warn(`⚠️ [Workflow] Maximum execution time of ${config.maxExecutionTimeMs}ms reached.`);
      
      // Send warning event but don't stop the workflow
      await safeSendEvent({
        type: 'workflow-status',
        step: 'timeout-warning',
        progress: 0.5,
        message: `Execution time exceeded ${config.maxExecutionTimeMs/1000}s. Process will continue but may be incomplete.`
      });
    }, config.maxExecutionTimeMs);
    
    // Set up deadlock detection through events
    let lastProgressTime = Date.now();
    let lastExtractedSize = 0;
    let lastVisitedSize = 0;
    let isWorkflowComplete = false;
    
    const deadlockDetectorId = setInterval(async () => {
      // If workflow is already complete, stop checking
      if (isWorkflowComplete) {
        clearInterval(deadlockDetectorId);
        return;
      }
      
      const currentExtractedSize = initialState.extractedContent.size;
      const currentVisitedSize = initialState.visitedUrls.size;
      
      // Check if there's been any progress
      if (currentExtractedSize > lastExtractedSize || currentVisitedSize > lastVisitedSize) {
        // Progress detected, update tracking variables
        lastProgressTime = Date.now();
        lastExtractedSize = currentExtractedSize;
        lastVisitedSize = currentVisitedSize;
        console.log(`🔄 [Workflow] Progress detected: ${currentExtractedSize} pages extracted, ${currentVisitedSize} URLs visited`);
      } else {
        // No progress detected, check how long we've been stuck
        const stuckTime = Date.now() - lastProgressTime;
        
        if (stuckTime >= config.deadlockDetectionMs) {
          console.warn(`⚠️ [Workflow] Potential deadlock detected! No progress for ${stuckTime}ms.`);
          
          // Send warning event but don't stop the workflow
          await safeSendEvent({
            type: 'workflow-status',
            step: 'deadlock-warning',
            progress: 0.5,
            message: `No progress detected for ${Math.round(stuckTime/1000)}s. Process will continue.`
          });
        } else {
          // Log a warning if we've been stuck for a while
          if (stuckTime > config.deadlockDetectionMs / 2) {
            console.warn(`⚠️ [Workflow] No progress for ${stuckTime}ms. Potential deadlock!`);
          }
        }
      }
    }, 2000); // Check every 2 seconds
    
    // Let the workflow run to completion
    const result = await workflowPromise;
    
    // Mark workflow as complete to stop the detectors
    isWorkflowComplete = true;
    
    // Clean up timeout and interval
    clearTimeout(timeoutId);
    clearInterval(deadlockDetectorId);
    
    console.timeEnd('LangGraphWorkflowExecution');
    
    console.log(`✅ [Workflow] Workflow execution completed`);
    
    // Log node visit statistics
    if (result && 'nodeVisitCounts' in result && result.nodeVisitCounts instanceof Map) {
      console.log(`📊 [Workflow Debug] Final node visit counts:`, Object.fromEntries(result.nodeVisitCounts.entries()));
    }
    
    // Log execution path summary
    if (result && 'executionPath' in result && Array.isArray(result.executionPath)) {
      const pathSegments: Record<string, number> = {};
      for (let i = 0; i < result.executionPath.length - 1; i++) {
        const transition = `${result.executionPath[i]} → ${result.executionPath[i+1]}`;
        pathSegments[transition] = (pathSegments[transition] || 0) + 1;
      }
      
      // Get the top 5 most frequent transitions
      const topTransitions = Object.entries(pathSegments)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      
      console.log(`📊 [Workflow Debug] Most frequent transitions:`, topTransitions);
    }
    
    // Ensure we have a valid result with a final output
    if (!result.finalOutput || !result.finalOutput.pages) {
      console.warn(`⚠️ [Workflow] Missing final output, generating from state`);
      result.finalOutput = prepareOutput(result);
    }
    
    // Calculate execution time
    const endTime = Date.now();
    const executionTime = endTime - startTime;
    
    // Update final output with execution time
    result.finalOutput.summary.executionTime = executionTime;
    
    console.log(`🏁 [Workflow] Workflow completed in ${executionTime}ms`);
    console.log(`📊 [Workflow] Pages scraped: ${result.finalOutput.pages.length}`);
    console.log(`📊 [Workflow] Total content size: ${result.finalOutput.summary.totalContentSize} bytes`);
    console.log(`📈 [Workflow] Goal completion: ${result.finalOutput.summary.goalCompletion.toFixed(2)}`);
    console.log(`📈 [Workflow] Coverage score: ${result.finalOutput.summary.coverageScore.toFixed(2)}`);
    
    // Generate workflow execution path visualization for debugging
    if (result && 'executionPath' in result && Array.isArray(result.executionPath) && result.executionPath.length > 0) {
      generateWorkflowVisualization(result.executionPath);
    }
    
    // Log detailed page information
    console.log(`📑 [Workflow] Page details:`, result.finalOutput.pages);
    result.finalOutput.pages.forEach((page: PageContent, index) => {
      console.log(`  [${index + 1}] ${page.url} - "${page.title}"`);
      console.log(`      Content: ${page.content.length} chars, Links: ${page.links.length}, Relevance: ${page.metrics.relevance.toFixed(2)}`);
    });
    
    console.timeEnd('TotalScrapingOperation');
    
    return result.finalOutput;
  } catch (error) {
    console.timeEnd('TotalScrapingOperation');
    console.error(`❌ [ScraperWorkflow] Error executing workflow:`, error);
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
 * Generate a visualization of the workflow execution path for debugging
 */
function generateWorkflowVisualization(executionPath: string[]) {
  console.log(`\n📊 [Workflow Visualization] Execution Path Analysis:`);
  
  // Count transitions between nodes
  const transitions: Record<string, number> = {};
  for (let i = 0; i < executionPath.length - 1; i++) {
    const transition = `${executionPath[i]} → ${executionPath[i+1]}`;
    transitions[transition] = (transitions[transition] || 0) + 1;
  }
  
  // Count node visits
  const nodeCounts: Record<string, number> = {};
  executionPath.forEach(node => {
    nodeCounts[node] = (nodeCounts[node] || 0) + 1;
  });
  
  // Sort nodes by visit count
  const sortedNodes = Object.entries(nodeCounts)
    .sort((a, b) => b[1] - a[1]);
  
  // Sort transitions by frequency
  const sortedTransitions = Object.entries(transitions)
    .sort((a, b) => b[1] - a[1]);
  
  // Calculate percentages
  const totalTransitions = executionPath.length - 1;
  
  // Display ASCII visualization
  console.log(`\n📈 Node Visit Counts:`);
  sortedNodes.forEach(([node, count]) => {
    const percentage = ((count / executionPath.length) * 100).toFixed(1);
    const bar = '█'.repeat(Math.floor(parseFloat(percentage) / 2));
    console.log(`  ${node.padEnd(20)} | ${count.toString().padStart(4)} | ${percentage.padStart(5)}% | ${bar}`);
  });
  
  console.log(`\n🔄 Most Common Transitions:`);
  sortedTransitions.slice(0, 10).forEach(([transition, count]) => {
    const percentage = ((count / totalTransitions) * 100).toFixed(1);
    const bar = '█'.repeat(Math.floor(parseFloat(percentage) / 2));
    console.log(`  ${transition.padEnd(40)} | ${count.toString().padStart(4)} | ${percentage.padStart(5)}% | ${bar}`);
  });
  
  // Detect cycles
  console.log(`\n🔁 Detected Cycles:`);
  const cycles = detectCycles(executionPath);
  if (cycles.length === 0) {
    console.log(`  No significant cycles detected.`);
  } else {
    cycles.forEach((cycle, index) => {
      console.log(`  Cycle #${index + 1}: ${cycle.join(' → ')} (length: ${cycle.length})`);
    });
  }
  
  console.log(`\n📊 [Workflow Visualization] End of Execution Path Analysis\n`);
}

/**
 * Detect cycles in the execution path
 */
function detectCycles(executionPath: string[]): string[][] {
  const cycles: string[][] = [];
  const minCycleLength = 2;
  const maxCycleLength = 7;
  
  // Look for repeating patterns
  for (let length = minCycleLength; length <= maxCycleLength; length++) {
    for (let i = 0; i < executionPath.length - length * 2; i++) {
      const potentialCycle = executionPath.slice(i, i + length);
      const nextSegment = executionPath.slice(i + length, i + length * 2);
      
      // Check if the pattern repeats exactly
      if (potentialCycle.join(',') === nextSegment.join(',')) {
        // Check if this cycle is a subset of an already detected cycle
        const isSubset = cycles.some(cycle => 
          cycle.length > length && 
          cycle.join(',').includes(potentialCycle.join(','))
        );
        
        if (!isSubset) {
          cycles.push(potentialCycle);
        }
      }
    }
  }
  
  return cycles;
}