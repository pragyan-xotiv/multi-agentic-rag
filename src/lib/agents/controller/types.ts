/**
 * Types for the Controller Agent
 */
import { ScraperOutput } from "../scraper/types";
import { ProcessingResult } from "../knowledge-processing/types";

/**
 * Types of requests the Controller Agent can handle
 */
export type RequestType = "scrape" | "process" | "scrape-and-process";

/**
 * Controller event types for streaming responses
 */
export type ControllerEventType = 
  | "start" 
  | "scraping-started" 
  | "scraping-progress" 
  | "scraping-complete" 
  | "processing-started" 
  | "processing-progress" 
  | "processing-complete" 
  | "storage-started" 
  | "storage-complete" 
  | "complete" 
  | "error";

/**
 * Controller stream event for streaming responses
 */
export interface ControllerStreamEvent {
  type: ControllerEventType;
  data?: unknown;
  error?: string;
  message?: string;
  progress?: number;
}

/**
 * Storage options for the Controller Agent
 */
export interface StorageOptions {
  storeResults?: boolean;
  namespace?: string;
  storeEntities?: boolean;
  storeRelationships?: boolean;
  storeContentChunks?: boolean;
}

/**
 * Scraping filter options
 */
export interface ScrapingFilters {
  mustIncludePatterns?: string[];
  excludePatterns?: string[];
}

/**
 * Scraping options
 */
export interface ScrapingOptions {
  maxPages?: number;
  maxDepth?: number;
  executeJavaScript?: boolean;
  includeImages?: boolean;
  preventDuplicateUrls?: boolean;
  filters?: ScrapingFilters;
  
  // Storage related options
  storeInVectorDb?: boolean;
  namespace?: string;
  
  // Knowledge processing options
  entityTypes?: string[];
  maxEntities?: number;
  
  // Any additional options
  [key: string]: unknown;
}

/**
 * Controller Agent request structure
 */
export interface ControllerRequest {
  requestType: RequestType;
  url?: string;
  scrapingGoal?: string;
  processingGoal?: string;
  options?: ScrapingOptions;
  storageOptions?: StorageOptions;
  stream?: boolean;
}

/**
 * Storage result information
 */
export interface StorageResult {
  success: boolean;
  storedItems: number;
  namespace: string;
  error?: string;
  contentChunksStored?: number;
  entitiesStored?: number;
  relationshipsStored?: number;
}

/**
 * Controller Agent response structure
 */
export interface ControllerResponse {
  success: boolean;
  error?: string;
  result?: {
    scraperResult?: ScraperOutput;
    knowledgeResult?: ProcessingResult;
    storageResult?: StorageResult;
    combinedSummary?: {
      pagesScraped?: number;
      entitiesExtracted?: number;
      relationshipsDiscovered?: number;
      itemsStored?: number;
    };
  };
} 