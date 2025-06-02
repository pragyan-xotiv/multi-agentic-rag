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
 * Controller Agent request structure
 */
export interface ControllerRequest {
  requestType: RequestType;
  url?: string;
  scrapingGoal?: string;
  processingGoal?: string;
  options?: Record<string, string | number | boolean | string[]>;
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
    combinedSummary?: {
      pagesScraped?: number;
      entitiesExtracted?: number;
      relationshipsDiscovered?: number;
    };
  };
} 