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
  filters?: {
    mustIncludePatterns?: string[];
    excludePatterns?: string[];
  };
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
    const fetchResult = await fetchPage(state.currentUrl);
    
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
    return state;
  }
  
  try {
    const contentResult = await runContentExtractionChain({
      html: state.currentPageDOM,
      url: state.currentUrl,
      currentState: state
    });
    
    // Create a copy of the extracted content map
    const updatedContent = new Map(state.extractedContent);
    
    // Add the new content
    updatedContent.set(state.currentUrl, {
      url: state.currentUrl,
      title: contentResult.title,
      content: contentResult.content,
      contentType: contentResult.contentType,
      extractionTime: new Date().toISOString(),
      metrics: contentResult.metrics,
      links: [],  // Will be populated by the link discovery step
      entities: contentResult.entities || []
    });
    
    return {
      ...state,
      extractedContent: updatedContent
    };
  } catch (error) {
    console.error("Error extracting content:", error);
    return state;
  }
}

/**
 * Discover Links Node - Identifies and prioritizes links on the page
 */
async function discoverLinks(state: ExtendedScraperAgentState) {
  console.log(`Discovering links on: ${state.currentUrl}`);
  
  if (!state.currentPageDOM || state.requiresAuthentication) {
    return state;
  }
  
  try {
    const linkResult = await runLinkDiscoveryChain({
      html: state.currentPageDOM,
      currentUrl: state.currentUrl,
      currentState: state
    });
    
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
    }
    
    // Add unvisited links to the queue
    const currentDepth = state.pageQueue.peek()?.depth || 0;
    
    linkResult.links.forEach(link => {
      if (!state.visitedUrls.has(link.url) && 
          (currentDepth + 1) <= (state.maxDepth || 3)) {
        state.pageQueue.enqueue({
          url: link.url,
          expectedValue: link.predictedValue,
          depth: currentDepth + 1
        }, link.predictedValue);
      }
    });
    
    return {
      ...state,
      extractedContent: contentCopy
    };
  } catch (error) {
    console.error("Error discovering links:", error);
    return state;
  }
}

/**
 * Evaluate Progress Node - Evaluates the progress of the scraping operation
 */
async function evaluateProgress(state: ExtendedScraperAgentState) {
  console.log(`Evaluating scraping progress...`);
  
  try {
    const progressResult = await runProgressEvaluationChain({
      currentState: state
    });
    
    return {
      ...state,
      valueMetrics: progressResult.metrics
    };
  } catch (error) {
    console.error("Error evaluating progress:", error);
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
  
  try {
    const decisionResult = await runNavigationDecisionChain({
      currentState: state,
      progressMetrics: state.valueMetrics
    });
    
    if (decisionResult.action === 'complete') {
      // We're done scraping, prepare the final output
      return {
        ...state,
        finalOutput: prepareOutput(state)
      };
    } else {
      // Continue scraping with the next URL
      const nextItem = state.pageQueue.dequeue();
      
      if (nextItem) {
        return {
          ...state,
          currentUrl: nextItem.url
        };
      } else {
        // No more URLs, prepare to finish
        return {
          ...state,
          currentUrl: "",
          finalOutput: prepareOutput(state)
        };
      }
    }
  } catch (error) {
    console.error("Error deciding next action:", error);
    
    // In case of error, try to continue with the next URL
    const nextItem = state.pageQueue.dequeue();
    
    if (nextItem) {
      return {
        ...state,
        currentUrl: nextItem.url
      };
    } else {
      // No more URLs, prepare to finish
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
  const pages = Array.from(state.extractedContent.values());
  
  return {
    pages,
    summary: {
      pagesScraped: pages.length,
      totalContentSize: pages.reduce((sum, page) => sum + page.content.length, 0),
      executionTime: 0, // Will be calculated in the executeScraperWorkflow function
      goalCompletion: state.valueMetrics.completeness,
      coverageScore: state.valueMetrics.relevance
    }
  };
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
      // If we have a final output or no current URL, we're done
      if (state.finalOutput || !state.currentUrl) {
        return END;
      }
      
      // Otherwise, continue with the next URL
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
  filters: {
    mustIncludePatterns?: string[];
    excludePatterns?: string[];
  };
  authConfig?: AuthenticationConfig;
  onAuthRequired?: (authRequest: HumanAuthRequest) => Promise<boolean>;
  onPageProcessed?: (pageContent: PageContent) => Promise<void>;
}): Promise<ScraperOutput> {
  const startTime = Date.now();
  
  // Create the workflow
  const workflow = createScraperWorkflow({
    onAuthRequired: options.onAuthRequired,
    onPageProcessed: options.onPageProcessed
  });
  
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
    
    requiresAuthentication: false
  };
  
  // Run the workflow
  const result = await workflow.invoke(initialState);
  
  // Calculate execution time
  const executionTime = (Date.now() - startTime) / 1000; // Convert to seconds
  
  // Extract the final output
  const typedResult = result as unknown as { finalOutput: ScraperOutput };
  const output = typedResult.finalOutput;
  
  // Update the execution time
  output.summary.executionTime = executionTime;
  
  return output;
} 