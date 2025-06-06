/**
 * Types for the Non-Recursive Scraper Agent
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
 * Queue item for URL processing
 */
export interface UrlQueueItem {
  url: string;
  depth: number;
  expectedValue: number;
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
 * Options for the scraper
 */
export interface ScraperOptions {
  baseUrl: string;
  scrapingGoal: string;
  maxPages?: number;
  maxDepth?: number;
  includeImages?: boolean;
  executeJavaScript?: boolean;
  preventDuplicateUrls?: boolean;
  filters?: {
    mustIncludePatterns?: string[];
    excludePatterns?: string[];
  };
  onAuthRequired?: (authRequest: HumanAuthRequest) => Promise<boolean>;
  onPageProcessed?: (pageContent: PageContent) => Promise<void>;
  onEvent?: (event: ScraperStreamEvent) => Promise<void>;
  batchSize?: number;
}

/**
 * Event types for streaming responses from the scraper
 */
export type ScraperStreamEvent = 
  | { type: 'start'; url: string; goal: string }
  | { type: 'page'; url: string; data: PageContent }
  | { type: 'auth'; url: string; request: HumanAuthRequest }
  | { type: 'end'; url: string; output: ScraperOutput }
  | { type: 'error'; url: string; error: string }
  | { type: 'analyze-url'; url: string; depth: number }
  | { type: 'fetch-start'; url: string; useJavaScript: boolean }
  | { type: 'fetch-complete'; url: string; statusCode: number; contentLength: number }
  | { type: 'extract-content'; url: string; contentType: string }
  | { type: 'discover-links'; url: string; linkCount: number }
  | { type: 'evaluate-progress'; url: string; pagesScraped: number; queueSize: number; goalCompletion: number }
  | { type: 'decide-next-action'; url: string; decision: 'continue' | 'stop' | 'change-strategy'; reason: string }
  | { type: 'workflow-status'; url: string; step: string; progress: number; message: string; batchStats?: {
      processedInBatch: number;
      totalProcessed: number;
      queueRemaining: number;
      extractedTotal: number;
      batchDuration: number;
      isComplete: boolean;
    } };

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

/**
 * URL processing result
 */
export interface UrlProcessingResult {
  content?: PageContent;
  links: { url: string; priority: number }[];
  metrics?: {
    informationDensity: number;
    relevance: number;
    uniqueness: number;
    completeness: number;
  };
} 