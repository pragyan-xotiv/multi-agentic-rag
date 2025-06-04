import { Annotation } from "@langchain/langgraph";
import { ScraperOutput, HumanAuthRequest, PageContent, PriorityQueue, ScraperStreamEvent } from "./types";

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
  finalOutput: Annotation<ScraperOutput>(),
  
  // Debugging and tracking
  nodeVisitCounts: Annotation<Map<string, number>>(),
  executionPath: Annotation<string[]>(),
  lastStateSnapshot: Annotation<{
    timestamp: number;
    currentUrl: string;
    queueSize: number;
    extractedSize: number;
    nodeSequence: string;
  }[]>(),
  
  // URL normalization and content deduplication
  normalizedUrls: Annotation<Set<string>>(),
  contentSignatures: Annotation<Set<string>>(),
  authAttempts: Annotation<Map<string, number>>(),
  onEvent: Annotation<((event: ScraperStreamEvent) => Promise<void>) | undefined>()
}); 