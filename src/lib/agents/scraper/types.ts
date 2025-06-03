/**
 * Types for the Scraper Agent
 */

/**
 * Priority Queue interface for URL processing
 */
export interface PriorityQueue<T> {
  enqueue: (item: T, priority: number) => void;
  dequeue: () => T | undefined;
  peek: () => T | undefined;
  isEmpty: () => boolean;
  size: () => number;
  items: T[];
}

/**
 * Page content structure
 */
export interface PageContent {
  url: string;
  title: string;
  content: string;
  contentType: string;
  extractionTime: string;
  metrics: {
    informationDensity: number;
    relevance: number;
    uniqueness: number;
    contentQualityAnalysis?: string;
  };
  links: {
    url: string;
    context: string;
    predictedValue: number;
    visited: boolean;
  }[];
  entities: {
    name: string;
    type: string;
    relevance?: number;
    mentions?: number;
  }[];
}

/**
 * Authentication configuration
 */
export interface AuthenticationConfig {
  enableHumanAuth: boolean;
  authTimeout: number;
  credentialStorage: {
    type: 'memory' | 'encrypted';
    encryptionKey?: string;
    expiration: number;
  };
  notificationChannels: {
    email?: string;
    webhook?: string;
    browserNotification?: boolean;
  };
}

/**
 * Human authentication request
 */
export interface HumanAuthRequest {
  url: string;
  authType: 'basic' | 'form' | 'oauth' | 'unknown';
  formFields?: string[];
  instructions?: string;
  callbackUrl: string;
  sessionToken: string;
  authPortalUrl: string;
}

/**
 * Final scraper output structure
 */
export interface ScraperOutput {
  pages: PageContent[];
  summary: {
    pagesScraped: number;
    totalContentSize: number;
    executionTime: number;
    goalCompletion: number;
    coverageScore: number;
  };
}

/**
 * Scraper agent state
 */
export interface ScraperAgentState {
  baseUrl: string;
  scrapingGoal: string;
  maxPages: number;
  
  currentUrl: string;
  visitedUrls: Set<string>;
  pageQueue: PriorityQueue<{
    url: string;
    expectedValue: number;
    depth: number;
  }>;
  
  extractedContent: Map<string, PageContent>;
  currentPageDOM: string;
  currentPageText: string;
  
  valueMetrics: {
    informationDensity: number;
    relevance: number;
    uniqueness: number;
    completeness: number;
  };
  
  finalOutput: ScraperOutput;
  
  // Authentication related state
  requiresAuthentication?: boolean;
  authConfig?: AuthenticationConfig;
} 

/**
 * Event types for streaming responses from the scraper
 */
export type ScraperStreamEvent = 
  | { type: 'start'; url: string; goal: string }
  | { type: 'page'; data: PageContent }
  | { type: 'auth'; request: HumanAuthRequest }
  | { type: 'end'; output: ScraperOutput }
  | { type: 'error'; error: string }
  | { type: 'analyze-url'; url: string; depth: number }
  | { type: 'fetch-start'; url: string; useJavaScript: boolean }
  | { type: 'fetch-complete'; url: string; statusCode: number; contentLength: number }
  | { type: 'extract-content'; url: string; contentType: string }
  | { type: 'discover-links'; url: string; linkCount: number }
  | { type: 'evaluate-progress'; pagesScraped: number; queueSize: number; goalCompletion: number }
  | { type: 'decide-next-action'; decision: 'continue' | 'stop' | 'change-strategy'; reason: string }
  | { type: 'workflow-status'; step: string; progress: number; message: string };

/**
 * Result from fetching a page
 */
export interface PageFetchResult {
  html: string;
  status: number;
  finalUrl: string;
  headers: Record<string, string>;
  error?: string;
  fallbackMode?: boolean;
}