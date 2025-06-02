import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import { ScraperAgentState, ScraperOutput, HumanAuthRequest, PageContent, PriorityQueue, AuthenticationConfig } from "./types";
import { URLAnalysisOutput } from "../../chains/url-analysis-chain";

// Import functionality from the chain modules
import { runURLAnalysisChain } from "../../chains/url-analysis-chain";
import { runAuthenticationDetectionChain } from "../../chains/authentication-detection-chain";
import { runContentExtractionChain } from "../../chains/content-extraction-chain";
import { runLinkDiscoveryChain } from "../../chains/link-discovery-chain";
import { runProgressEvaluationChain } from "../../chains/progress-evaluation-chain";
import { runNavigationDecisionChain } from "../../chains/navigation-decision-chain";

// Import core modules
import { fetchPage } from "./core/browser-interface";

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

// Extend the ScraperAgentState with properties used in the workflow
interface ExtendedScraperAgentState extends ScraperAgentState {
  lastStatusCode?: number;
  maxDepth?: number;
  urlAnalysis?: URLAnalysisOutput;
  lastError?: string;
  authRequest?: HumanAuthRequest | null;
  includeImages?: boolean;
  executeJavaScript?: boolean;
  filters?: {
    mustIncludePatterns?: string[];
    excludePatterns?: string[];
  };
  onPageProcessed?: (pageContent: PageContent) => Promise<void>;
}

/**
 * Define the scraper workflow state using Annotation
 */
const ScraperStateAnnotation = Annotation.Root({
  // Configuration
  baseUrl: Annotation<string>(),
  scrapingGoal: Annotation<string>(),
  maxPages: Annotation<number>(),
  maxDepth: Annotation<number>(),
  includeImages: Annotation<boolean>(),
  executeJavaScript: Annotation<boolean>(),
  filters: Annotation<{
    mustIncludePatterns?: string[];
    excludePatterns?: string[];
  }>(),
  
  // Current state
  currentUrl: Annotation<string>(),
  visitedUrls: Annotation<Set<string>>(),
  pageQueue: Annotation<PriorityQueue<{
    url: string;
    expectedValue: number;
    depth: number;
  }>>(),
  
  // Page data
  currentPageDOM: Annotation<string>(),
  currentPageText: Annotation<string>(),
  extractedContent: Annotation<Map<string, PageContent>>(),
  
  // Value metrics
  valueMetrics: Annotation<{
    informationDensity: number;
    relevance: number;
    uniqueness: number;
    completeness: number;
  }>(),
  
  // Authentication
  requiresAuthentication: Annotation<boolean>(),
  authRequest: Annotation<HumanAuthRequest | null>(),
  
  // Final output
  finalOutput: Annotation<ScraperOutput>()
});

/**
 * URL Analysis Node - Analyzes the current URL
 */
async function analyzeURL(state: ExtendedScraperAgentState) {
  console.log(`Analyzing URL: ${state.currentUrl}`);
  
  try {
    const analysis = await runURLAnalysisChain({
      url: state.currentUrl,
      scrapingGoal: state.scrapingGoal,
      currentState: state
    });
    
    return {
      ...state,
      urlAnalysis: analysis
    };
  } catch (error) {
    console.error("Error analyzing URL:", error);
    // If analysis fails, mark the URL as low value
    return {
      ...state,
      urlAnalysis: {
        url: state.currentUrl,
        relevanceScore: 0.1,
        expectedValue: 0.1,
        isAllowedByRobots: true,
        domainAuthority: 0,
        wasVisitedBefore: state.visitedUrls.has(state.currentUrl)
      }
    };
  }
}

/**
 * Fetch Page Node - Fetches the page content
 */
async function fetchPageContent(state: ExtendedScraperAgentState) {
  console.log(`Fetching page: ${state.currentUrl}`);
  
  try {
    const fetchResult = await fetchPage(state.currentUrl, {
      executeJavaScript: state.executeJavaScript
    });
    
    return {
      ...state,
      currentPageDOM: fetchResult.html,
      currentPageText: fetchResult.html, // Use HTML as text since PageResult doesn't have a text field
      lastStatusCode: fetchResult.status
    };
  } catch (error) {
    console.error("Error fetching page:", error);
    return {
      ...state,
      currentPageDOM: "",
      currentPageText: "",
      lastStatusCode: 500,
      lastError: `Failed to fetch page: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Authentication Detection Node - Checks if authentication is required
 */
async function detectAuthentication(state: ExtendedScraperAgentState) {
  console.log(`Detecting authentication for: ${state.currentUrl}`);
  
  if (!state.currentPageDOM) {
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
    
    return {
      ...state,
      requiresAuthentication: authResult.requiresAuthentication,
      authRequest: authResult.authRequest || null
    };
  } catch (error) {
    console.error("Error detecting authentication:", error);
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
  console.log(`Handling authentication for: ${state.currentUrl}`);
  
  if (!state.requiresAuthentication || !state.authRequest) {
    return state;
  }
  
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
      console.error("Error handling authentication:", error);
    }
  }
  
  // If authentication failed or no handler, skip this URL
  const nextState = { ...state };
  
  // Mark this URL as visited to avoid trying again
  nextState.visitedUrls.add(state.currentUrl);
  
  // Get the next URL from the queue
  const nextItem = nextState.pageQueue.dequeue();
  
  if (nextItem) {
    nextState.currentUrl = nextItem.url;
  } else {
    // If no more URLs, prepare to finish
    nextState.currentUrl = "";
  }
  
  return nextState;
}

/**
 * Extract Content Node - Extracts content from the page
 */
async function extractPageContent(state: ExtendedScraperAgentState) {
  console.log(`Extracting content from: ${state.currentUrl}`);
  
  if (!state.currentPageDOM || state.requiresAuthentication) {
    console.error(`❌ [Workflow] Cannot extract content - ${!state.currentPageDOM ? 'No DOM content' : 'Authentication required'}`);
    return state;
  }
  
  try {
    console.log(`🔍 [Workflow] Calling content extraction chain for ${state.currentUrl}...`);
    const contentResult = await runContentExtractionChain({
      html: state.currentPageDOM,
      url: state.currentUrl,
      currentState: state
    });
    
    console.log(`✅ [Workflow] Content extraction chain completed`);
    console.log(`📊 [Workflow] Extracted content: title="${contentResult.title}", length=${contentResult.content.length}`);
    
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
    
    console.log(`📦 [Workflow] Added content to extractedContent map. Map now contains ${updatedContent.size} pages.`);
    
    // Call the onPageProcessed callback if provided
    if (state.onPageProcessed) {
      try {
        console.log(`📣 [Workflow] Calling onPageProcessed callback for ${state.currentUrl}`);
        await state.onPageProcessed(pageContent);
      } catch (callbackError) {
        console.error(`❌ [Workflow] Error in onPageProcessed callback:`, callbackError);
      }
    }
    
    return {
      ...state,
      extractedContent: updatedContent
    };
  } catch (error) {
    console.error(`❌ [Workflow] Error extracting content:`, error);
    return state;
  }
}

/**
 * Discover Links Node - Identifies and prioritizes links on the page
 */
async function discoverLinks(state: ExtendedScraperAgentState) {
  console.log(`Discovering links on: ${state.currentUrl}`);
  
  if (!state.currentPageDOM || state.requiresAuthentication) {
    console.error(`❌ [Workflow] Cannot discover links - ${!state.currentPageDOM ? 'No DOM content' : 'Authentication required'}`);
    return state;
  }
  
  try {
    console.log(`🔍 [Workflow] Calling link discovery chain for ${state.currentUrl}...`);
    const linkResult = await runLinkDiscoveryChain({
      html: state.currentPageDOM,
      currentUrl: state.currentUrl,
      currentState: state
    });
    
    console.log(`✅ [Workflow] Link discovery chain completed. Found ${linkResult.links.length} links`);
    
    // Create a copy of the page content
    const contentCopy = new Map(state.extractedContent);
    const pageContent = contentCopy.get(state.currentUrl);
    
    if (pageContent) {
      // Update the links in the page content
      pageContent.links = linkResult.links.map(link => ({
        url: link.url,
        context: link.context,
        predictedValue: link.predictedValue,
        visited: state.visitedUrls.has(link.url)
      }));
      
      contentCopy.set(state.currentUrl, pageContent);
      console.log(`📝 [Workflow] Updated page content with ${pageContent.links.length} links`);
    } else {
      console.warn(`⚠️ [Workflow] Page content not found in map for ${state.currentUrl}`);
    }
    
    // Add unvisited links to the queue
    const currentDepth = state.pageQueue.peek()?.depth || 0;
    let newLinksAdded = 0;
    
    linkResult.links.forEach(link => {
      if (!state.visitedUrls.has(link.url) && 
          (currentDepth + 1) <= (state.maxDepth || 3)) {
        state.pageQueue.enqueue({
          url: link.url,
          expectedValue: link.predictedValue,
          depth: currentDepth + 1
        }, link.predictedValue);
        newLinksAdded++;
      }
    });
    
    console.log(`🔗 [Workflow] Added ${newLinksAdded} new links to the queue. Queue now has ${state.pageQueue.size()} items.`);
    
    return {
      ...state,
      extractedContent: contentCopy
    };
  } catch (error) {
    console.error(`❌ [Workflow] Error discovering links:`, error);
    return state;
  }
}

/**
 * Evaluate Progress Node - Evaluates the progress of the scraping operation
 */
async function evaluateProgress(state: ExtendedScraperAgentState) {
  console.log(`Evaluating scraping progress...`);
  console.log(`📊 [Workflow] Current state: ${state.extractedContent.size} pages extracted, ${state.visitedUrls.size} URLs visited`);
  
  try {
    console.log(`🔍 [Workflow] Calling progress evaluation chain...`);
    const progressResult = await runProgressEvaluationChain({
      currentState: state
    });
    
    console.log(`✅ [Workflow] Progress evaluation complete: completeness=${progressResult.metrics.completeness.toFixed(2)}`);
    
    return {
      ...state,
      valueMetrics: progressResult.metrics
    };
  } catch (error) {
    console.error(`❌ [Workflow] Error evaluating progress:`, error);
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
  console.log(`Deciding next action...`);
  
  // Mark the current URL as visited
  state.visitedUrls.add(state.currentUrl);
  console.log(`✓ [Workflow] Marked ${state.currentUrl} as visited`);
  console.log(`📊 [Workflow] Current state: ${state.extractedContent.size} pages extracted, ${state.visitedUrls.size} URLs visited, ${state.pageQueue.size()} URLs in queue`);
  
  // Check if we've reached the maximum number of pages
  if (state.extractedContent.size >= state.maxPages) {
    console.log(`🏁 [Workflow] Maximum number of pages (${state.maxPages}) reached. Completing workflow.`);
    return {
      ...state,
      finalOutput: prepareOutput(state)
    };
  }
  
  try {
    console.log(`🔍 [Workflow] Calling navigation decision chain...`);
    const decisionResult = await runNavigationDecisionChain({
      currentState: state,
      progressMetrics: state.valueMetrics
    });
    
    console.log(`✅ [Workflow] Navigation decision: action="${decisionResult.action}", reason="${decisionResult.reason}"`);
    
    if (decisionResult.action === 'complete') {
      // We're done scraping, prepare the final output
      console.log(`🏁 [Workflow] Navigation chain decided to complete. Preparing final output with ${state.extractedContent.size} pages.`);
      return {
        ...state,
        finalOutput: prepareOutput(state)
      };
    } else {
      // Continue scraping with the next URL
      const nextItem = state.pageQueue.dequeue();
      
      if (nextItem) {
        console.log(`➡️ [Workflow] Next URL: ${nextItem.url} (depth: ${nextItem.depth}, value: ${nextItem.expectedValue.toFixed(2)})`);
        return {
          ...state,
          currentUrl: nextItem.url
        };
      } else {
        // No more URLs, prepare to finish
        console.log(`🏁 [Workflow] No more URLs in queue. Finishing with ${state.extractedContent.size} pages.`);
        return {
          ...state,
          currentUrl: "",
          finalOutput: prepareOutput(state)
        };
      }
    }
  } catch (error) {
    console.error(`❌ [Workflow] Error deciding next action:`, error);
    
    // In case of error, try to continue with the next URL
    const nextItem = state.pageQueue.dequeue();
    
    if (nextItem) {
      console.log(`⚠️ [Workflow] Error in decision chain. Continuing with next URL: ${nextItem.url}`);
      return {
        ...state,
        currentUrl: nextItem.url
      };
    } else {
      // No more URLs, prepare to finish
      console.log(`🏁 [Workflow] Error in decision chain. No more URLs. Finishing with ${state.extractedContent.size} pages.`);
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
 * Create the scraper workflow with LangGraph
 */
export function createScraperWorkflow(options: {
  onAuthRequired?: (authRequest: HumanAuthRequest) => Promise<boolean>;
  onPageProcessed?: (pageContent: PageContent) => Promise<void>;
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
  filters: {
    mustIncludePatterns?: string[];
    excludePatterns?: string[];
  };
  authConfig?: AuthenticationConfig;
  onAuthRequired?: (authRequest: HumanAuthRequest) => Promise<boolean>;
  onPageProcessed?: (pageContent: PageContent) => Promise<void>;
  config?: {
    recursionLimit?: number;
    maxIterations?: number;
  };
}): Promise<ScraperOutput> {
  const startTime = Date.now();
  
  // Initialize the priority queue
  const pageQueue = createPriorityQueue<{
    url: string;
    expectedValue: number;
    depth: number;
  }>();
  
  // Add the starting URL to the queue
  pageQueue.enqueue({
    url: options.baseUrl,
    expectedValue: 1.0, // Maximum value for the starting URL
    depth: 0
  }, 1.0);
  
  // Prepare the initial state
  const initialState: ExtendedScraperAgentState = {
    baseUrl: options.baseUrl,
    scrapingGoal: options.scrapingGoal,
    maxPages: options.maxPages,
    maxDepth: options.maxDepth,
    includeImages: options.includeImages,
    executeJavaScript: options.executeJavaScript,
    filters: options.filters,
    
    currentUrl: options.baseUrl,
    visitedUrls: new Set<string>(),
    pageQueue,
    
    extractedContent: new Map(),
    currentPageDOM: "",
    currentPageText: "",
    
    valueMetrics: {
      informationDensity: 0,
      relevance: 0,
      uniqueness: 0,
      completeness: 0
    },
    
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
    
    requiresAuthentication: false,
    onPageProcessed: options.onPageProcessed
  };
  
  // Set a reasonable max iterations for a small website
  const maxIterations = options.config?.maxIterations || 20; // Default to 20 iterations
  let iterations = 0;
  let extractedPagesCount = 0;
  let currentState = initialState;
  
  try {
    // Process the first URL to kick things off
    console.log(`🌐 [Workflow] Starting scraping with URL: ${options.baseUrl}`);
    
    // Use manual execution approach to avoid recursion limits
    while (iterations < maxIterations) {
      iterations++;
      console.log(`🔄 [Workflow] Starting iteration ${iterations}/${maxIterations}`);
      
      // First, analyze the URL
      console.log(`🔍 [Workflow] Analyzing URL: ${currentState.currentUrl}`);
      currentState = await analyzeURL(currentState);
      
      // Fetch the page
      console.log(`📥 [Workflow] Fetching page: ${currentState.currentUrl}`);
      currentState = await fetchPageContent(currentState);
      
      // Check if authentication is required
      console.log(`🔒 [Workflow] Checking authentication for: ${currentState.currentUrl}`);
      currentState = await detectAuthentication(currentState);
      
      if (currentState.requiresAuthentication) {
        console.log(`🔐 [Workflow] Authentication required for: ${currentState.currentUrl}`);
        currentState = await handleAuthentication(currentState, {
          onAuthRequired: options.onAuthRequired
        });
        continue; // Go back to the start of the loop
      }
      
      // Extract content
      console.log(`📑 [Workflow] Extracting content from: ${currentState.currentUrl}`);
      currentState = await extractPageContent(currentState);
      
      // Update the count of extracted pages
      const newCount = currentState.extractedContent.size;
      if (newCount > extractedPagesCount) {
        extractedPagesCount = newCount;
        console.log(`📊 [Workflow] Extracted content count increased to: ${extractedPagesCount}`);
      }
      
      // Discover links
      console.log(`🔗 [Workflow] Discovering links on: ${currentState.currentUrl}`);
      currentState = await discoverLinks(currentState);
      
      // Evaluate progress
      console.log(`📈 [Workflow] Evaluating progress...`);
      currentState = await evaluateProgress(currentState);
      
      // Decide next action
      console.log(`🧠 [Workflow] Deciding next action...`);
      currentState = await decideNextAction(currentState);
      
      // Mark the current URL as visited
      if (currentState.currentUrl) {
        currentState.visitedUrls.add(currentState.currentUrl);
      }
      
      // Check termination conditions
      
      // 1. If we already have a final output, we're done
      if (currentState.finalOutput.pages.length > 0) {
        console.log(`✅ [Workflow] Workflow finished with ${currentState.finalOutput.pages.length} pages in final output`);
        break;
      }
      
      // 2. If we've reached max pages, prepare output and finish
      if (currentState.extractedContent.size >= options.maxPages) {
        console.log(`🏁 [Workflow] Reached maximum pages (${options.maxPages}). Preparing output.`);
        currentState.finalOutput = prepareOutput(currentState);
        break;
      }
      
      // 3. If we have no current URL and queue is empty, we're done
      if (!currentState.currentUrl && currentState.pageQueue.isEmpty()) {
        console.log(`🏁 [Workflow] No more URLs to process. Preparing output.`);
        currentState.finalOutput = prepareOutput(currentState);
        break;
      }
      
      // 4. If we have no current URL but queue has items, get the next one
      if (!currentState.currentUrl && !currentState.pageQueue.isEmpty()) {
        const nextItem = currentState.pageQueue.dequeue();
        if (nextItem) {
          console.log(`➡️ [Workflow] Moving to next URL: ${nextItem.url}`);
          currentState.currentUrl = nextItem.url;
        } else {
          console.log(`🏁 [Workflow] Queue unexpectedly empty. Preparing output.`);
          currentState.finalOutput = prepareOutput(currentState);
          break;
        }
      }
    }
    
    // Handle max iterations reached
    if (iterations >= maxIterations) {
      console.log(`⚠️ [Workflow] Reached maximum iterations (${maxIterations}). Forcing completion.`);
      currentState.finalOutput = prepareOutput(currentState);
    }
    
  } catch (error) {
    console.error(`❌ [Workflow] Error during workflow execution:`, error);
    
    // If we've extracted pages but hit an error, still return what we have
    if (currentState.extractedContent.size > 0) {
      console.log(`🔄 [Workflow] Recovered ${currentState.extractedContent.size} pages despite error`);
      currentState.finalOutput = prepareOutput(currentState);
    } else {
      // Return an empty result
      console.error(`💥 [Workflow] No content was extracted before error occurred`);
      currentState.finalOutput = {
        pages: [],
        summary: {
          pagesScraped: 0,
          totalContentSize: 0,
          executionTime: (Date.now() - startTime) / 1000, 
          goalCompletion: 0,
          coverageScore: 0
        }
      };
    }
  }
  
  // Calculate execution time
  const executionTime = (Date.now() - startTime) / 1000; // Convert to seconds
  currentState.finalOutput.summary.executionTime = executionTime;
  
  console.log(`🏁 [Workflow] Scraping completed in ${executionTime.toFixed(2)}s with ${currentState.finalOutput.pages.length} pages`);
  
  // Always log the content extraction count to help diagnose issues
  console.log(`📊 [Workflow] Content extraction map has ${currentState.extractedContent.size} pages`);
  console.log(`📊 [Workflow] Final output has ${currentState.finalOutput.pages.length} pages`);
  
  return currentState.finalOutput;
} 