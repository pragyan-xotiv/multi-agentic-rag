/**
 * Controller Agent Implementation
 * 
 * This agent orchestrates the interaction between specialized agents like
 * the Scraper Agent and Knowledge Processing Agent.
 */
import { ScraperAgent } from "../scraper";
import { KnowledgeProcessingAgent } from "../knowledge-processing";
import { ControllerRequest, ControllerResponse } from "./types";

export class ControllerAgent {
  private scraperAgent: ScraperAgent;
  private knowledgeAgent: KnowledgeProcessingAgent;
  
  constructor() {
    this.scraperAgent = new ScraperAgent();
    this.knowledgeAgent = new KnowledgeProcessingAgent();
  }
  
  /**
   * Process a controller request
   * @param request The request to process
   * @returns The response from processing the request
   */
  async processRequest(request: ControllerRequest): Promise<ControllerResponse> {
    try {
      console.log(`🎮 [ControllerAgent] Processing ${request.requestType} request`);
      
      switch(request.requestType) {
        case "scrape":
          return await this.handleScrapeRequest(request);
        case "process":
          return await this.handleProcessRequest();
        case "scrape-and-process":
          return await this.handleScrapeAndProcess(request);
        default:
          return {
            success: false,
            error: `Unsupported request type: ${request.requestType}`
          };
      }
    } catch (error) {
      console.error(`❌ [ControllerAgent] Error processing request:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }
  
  /**
   * Handle a scrape request
   * @param request The scrape request
   * @returns The response from scraping
   */
  private async handleScrapeRequest(request: ControllerRequest): Promise<ControllerResponse> {
    if (!request.url) {
      return { success: false, error: "URL is required for scraping" };
    }
    
    console.log(`🎮 [ControllerAgent] Scraping ${request.url}`);
    
    const scraperResult = await this.scraperAgent.scrape({
      baseUrl: request.url,
      scrapingGoal: request.scrapingGoal || "Extract all relevant information",
      maxPages: request.options?.maxPages as number || 20,
      maxDepth: request.options?.maxDepth as number || 3,
      executeJavaScript: request.options?.executeJavaScript as boolean || true
    });
    
    return {
      success: true,
      result: { 
        scraperResult,
        combinedSummary: {
          pagesScraped: scraperResult.summary.pagesScraped
        }
      }
    };
  }
  
  /**
   * Handle a process request - not implemented in MVP
   * @returns Error response
   */
  private async handleProcessRequest(): Promise<ControllerResponse> {
    // Not implementing in MVP
    return { success: false, error: "Process-only requests not implemented in MVP" };
  }
  
  /**
   * Handle a scrape-and-process request
   * @param request The scrape-and-process request
   * @returns The combined response from scraping and processing
   */
  private async handleScrapeAndProcess(request: ControllerRequest): Promise<ControllerResponse> {
    if (!request.url) {
      return { success: false, error: "URL is required for scraping" };
    }
    
    // Step 1: Scrape the URL
    console.log(`🎮 [ControllerAgent] Scraping ${request.url}`);
    const scraperResult = await this.scraperAgent.scrape({
      baseUrl: request.url,
      scrapingGoal: request.scrapingGoal || "Extract all relevant information",
      maxPages: request.options?.maxPages as number || 20,
      maxDepth: request.options?.maxDepth as number || 3,
      executeJavaScript: request.options?.executeJavaScript as boolean || true
    });
    
    if (!scraperResult || scraperResult.pages.length === 0) {
      return {
        success: false,
        error: "Scraping failed or returned no content",
        result: { scraperResult }
      };
    }
    
    console.log(`🎮 [ControllerAgent] Scraped ${scraperResult.pages.length} pages. Processing content...`);
    
    // Step 2: Process the scraped content
    const knowledgeResult = await this.knowledgeAgent.processContent({
      content: scraperResult,
      contentType: "scraped-content",
      source: request.url,
      metadata: {
        processingGoal: request.processingGoal || `Extract structured knowledge from content about: ${request.scrapingGoal}`
      },
      options: {
        entityTypes: request.options?.entityTypes as string[] || undefined,
        maxEntities: request.options?.maxEntities as number || 100
      }
    });
    
    console.log(`🎮 [ControllerAgent] Knowledge processing complete. Extracted ${knowledgeResult.entities.length} entities and ${knowledgeResult.relationships.length} relationships.`);
    
    // Step 3: Return combined result
    return {
      success: true,
      result: {
        scraperResult,
        knowledgeResult,
        combinedSummary: {
          pagesScraped: scraperResult.summary.pagesScraped,
          entitiesExtracted: knowledgeResult.entities.length,
          relationshipsDiscovered: knowledgeResult.relationships.length
        }
      }
    };
  }
}

// Export types
export * from './types'; 