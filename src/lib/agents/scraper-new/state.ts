import { Annotation } from "@langchain/langgraph";
import { ScraperOutput, HumanAuthRequest, PageContent, PriorityQueue, UrlQueueItem, ScraperStreamEvent } from "./types";

/**
 * Define the scraper workflow state using Annotation
 */
export const ScraperStateAnnotation = Annotation.Root({
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
  currentUrlDepth: Annotation<number>(),
  visitedUrls: Annotation<Set<string>>(),
  pageQueue: Annotation<PriorityQueue<UrlQueueItem>>(),
  
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
  
  // Authentication (simplified for now)
  requiresAuthentication: Annotation<boolean>(),
  authRequest: Annotation<HumanAuthRequest | null>(),
  
  // Final output
  finalOutput: Annotation<ScraperOutput>(),
  
  // URL normalization and content deduplication
  normalizedUrls: Annotation<Set<string>>(),
  contentSignatures: Annotation<Set<string>>(),
  
  // Debug information
  lastError: Annotation<string | null>(),
  
  // Batch processing additions
  discoveredUrls: Annotation<UrlQueueItem[]>(),
  processingComplete: Annotation<boolean>(),
  currentPageOutput: Annotation<PageContent | null>(),
  onEvent: Annotation<(event: ScraperStreamEvent) => Promise<void>>()
}); 

/**
 * Extended scraper agent state for workflow with additional tracking properties
 */
export interface ExtendedScraperAgentState {
  // Configuration
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
  
  // Current state
  currentUrl: string;
  currentUrlDepth?: number;
  visitedUrls: Set<string>;
  pageQueue: PriorityQueue<UrlQueueItem>;
  
  // Page data
  currentPageDOM: string;
  currentPageText: string;
  extractedContent: Map<string, PageContent>;
  
  // Value metrics
  valueMetrics: {
    informationDensity: number;
    relevance: number;
    uniqueness: number;
    completeness: number;
  };
  
  // Authentication
  requiresAuthentication: boolean;
  authRequest: HumanAuthRequest | null;
  
  // Final output
  finalOutput: ScraperOutput;
  
  // URL normalization and content deduplication
  normalizedUrls: Set<string>;
  contentSignatures: Set<string>;
  
  // Debug information
  lastError: string | null;
  
  // Batch processing additions
  discoveredUrls?: UrlQueueItem[]; // URLs discovered during processing for the orchestrator
  processingComplete?: boolean;     // Indicates if the current URL has been fully processed
  currentPageOutput?: PageContent | null; // Output for the current page, used by orchestrator
  
  // Callback functions
  onPageProcessed?: (pageContent: PageContent) => Promise<void>;
  onEvent?: (event: ScraperStreamEvent) => Promise<void>;
  onAuthRequired?: (authRequest: HumanAuthRequest) => Promise<boolean>;
} 