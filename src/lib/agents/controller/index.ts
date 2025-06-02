/**
 * Controller Agent Implementation
 * 
 * This agent orchestrates the interaction between specialized agents like
 * the Scraper Agent and Knowledge Processing Agent.
 */
import { ScraperAgent } from "../scraper";
import { KnowledgeProcessingAgent } from "../knowledge-processing";
import { ControllerRequest, ControllerResponse, StorageOptions, StorageResult, ControllerStreamEvent } from "./types";
import { addDocumentsToVectorStore, createVectorStore } from "../../vectorstore";
import { Entity, Relationship, ProcessingResult } from "../knowledge-processing/types";
import { SupabaseClient } from "@supabase/supabase-js";
import { ScraperStreamEvent } from "../scraper/types";

export class ControllerAgent {
  private scraperAgent: ScraperAgent;
  private knowledgeAgent: KnowledgeProcessingAgent;
  private supabaseClient?: SupabaseClient;
  
  constructor(options?: { supabaseClient?: SupabaseClient }) {
    this.scraperAgent = new ScraperAgent();
    this.knowledgeAgent = new KnowledgeProcessingAgent();
    this.supabaseClient = options?.supabaseClient;
    
    // Log Supabase client status
    console.log(`🔌 [ControllerAgent] Supabase client available: ${this.supabaseClient ? 'Yes' : 'No'}`);
    
    if (!this.supabaseClient) {
      console.warn(`⚠️ [ControllerAgent] Vector storage will be disabled due to missing Supabase client`);
    }
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
   * Process a controller request with streaming support
   * @param request The request to process
   * @param onEvent Callback for streaming events
   * @returns The final response from processing the request
   */
  async processRequestWithStreaming(
    request: ControllerRequest,
    onEvent: (event: ControllerStreamEvent) => Promise<void>
  ): Promise<ControllerResponse> {
    try {
      // Send the initial event
      await onEvent({
        type: "start",
        message: `Starting ${request.requestType} operation`,
      });
      
      console.log(`🎮 [ControllerAgent] Processing streaming ${request.requestType} request`);
      
      switch(request.requestType) {
        case "scrape":
          return await this.handleScrapeRequestWithStreaming(request, onEvent);
        case "process":
          await onEvent({
            type: "error",
            error: "Process-only requests not implemented in MVP",
            message: "Process-only requests are not supported"
          });
          return { success: false, error: "Process-only requests not implemented in MVP" };
        case "scrape-and-process":
          return await this.handleScrapeAndProcessWithStreaming(request, onEvent);
        default:
          await onEvent({
            type: "error",
            error: `Unsupported request type: ${request.requestType}`,
            message: "Invalid request type"
          });
          return {
            success: false,
            error: `Unsupported request type: ${request.requestType}`
          };
      }
    } catch (error) {
      console.error(`❌ [ControllerAgent] Error processing streaming request:`, error);
      
      await onEvent({
        type: "error",
        error: error instanceof Error ? error.message : "Unknown error",
        message: "An error occurred while processing your request"
      });
      
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
   * Handle a scrape request with streaming
   * @param request The scrape request
   * @param onEvent Callback for streaming events
   * @returns The response from scraping
   */
  private async handleScrapeRequestWithStreaming(
    request: ControllerRequest,
    onEvent: (event: ControllerStreamEvent) => Promise<void>
  ): Promise<ControllerResponse> {
    if (!request.url) {
      await onEvent({
        type: "error",
        error: "URL is required for scraping",
        message: "URL is required for scraping operations"
      });
      return { success: false, error: "URL is required for scraping" };
    }
    
    await onEvent({
      type: "scraping-started",
      message: `Starting to scrape ${request.url}`,
      data: { url: request.url }
    });
    
    console.log(`🎮 [ControllerAgent] Streaming scrape for ${request.url}`);
    
    // Use the streaming API of the scraper
    const scraperResult = await this.scraperAgent.streamScraping(
      {
        baseUrl: request.url,
        scrapingGoal: request.scrapingGoal || "Extract all relevant information",
        maxPages: request.options?.maxPages as number || 20,
        maxDepth: request.options?.maxDepth as number || 3,
        executeJavaScript: request.options?.executeJavaScript as boolean || true
      },
      async (scraperEvent: ScraperStreamEvent) => {
        // Forward scraper events as controller events
        let controllerEvent: ControllerStreamEvent;
        
        switch(scraperEvent.type) {
          case "start":
            controllerEvent = {
              type: "scraping-started",
              message: `Started scraping ${scraperEvent.url}`,
              data: scraperEvent
            };
            break;
          
          case "page":
            controllerEvent = {
              type: "scraping-progress",
              message: `Scraped page: ${scraperEvent.data.url}`,
              data: scraperEvent.data,
              progress: undefined  // Can't access direct progress metric
            };
            break;
            
          case "auth":
            controllerEvent = {
              type: "scraping-progress",
              message: "Authentication required",
              data: scraperEvent.request
            };
            break;
            
          case "error":
            controllerEvent = {
              type: "error",
              error: scraperEvent.error,
              message: `Scraping error: ${scraperEvent.error}`
            };
            break;
            
          case "end":
            controllerEvent = {
              type: "scraping-complete",
              message: `Scraping complete. Processed ${scraperEvent.output.pages.length} pages.`,
              data: scraperEvent.output
            };
            break;
            
          default:
            controllerEvent = {
              type: "scraping-progress",
              message: "Scraping in progress",
              data: scraperEvent
            };
        }
        
        await onEvent(controllerEvent);
      }
    );
    
    await onEvent({
      type: "complete",
      message: "Operation complete",
      data: {
        pagesScraped: scraperResult.pages.length
      }
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
    
    // Step 3: Store results in vector database if requested
    let storageResult: StorageResult | undefined;
    
    // Check if storage is requested and supabase client is available
    if (request.storageOptions?.storeResults !== false && this.supabaseClient) {
      try {
        storageResult = await this.storeProcessedKnowledge(knowledgeResult, request.url, request.storageOptions);
        console.log(`🎮 [ControllerAgent] Storage complete. Stored ${storageResult.storedItems} items.`);
      } catch (error) {
        console.error(`❌ [ControllerAgent] Error storing knowledge:`, error);
        storageResult = {
          success: false,
          storedItems: 0,
          namespace: request.storageOptions?.namespace || 'default',
          error: error instanceof Error ? error.message : "Unknown storage error"
        };
      }
    }
    
    // Step 4: Return combined result
    return {
      success: true,
      result: {
        scraperResult,
        knowledgeResult,
        storageResult,
        combinedSummary: {
          pagesScraped: scraperResult.summary.pagesScraped,
          entitiesExtracted: knowledgeResult.entities.length,
          relationshipsDiscovered: knowledgeResult.relationships.length,
          itemsStored: storageResult?.storedItems || 0
        }
      }
    };
  }
  
  /**
   * Handle a scrape-and-process request with streaming
   * @param request The scrape-and-process request
   * @param onEvent Callback for streaming events
   * @returns The combined response from scraping and processing
   */
  private async handleScrapeAndProcessWithStreaming(
    request: ControllerRequest,
    onEvent: (event: ControllerStreamEvent) => Promise<void>
  ): Promise<ControllerResponse> {
    if (!request.url) {
      await onEvent({
        type: "error",
        error: "URL is required for scraping",
        message: "URL is required for scraping operations"
      });
      return { success: false, error: "URL is required for scraping" };
    }
    
    // Step 1: Scrape the URL with streaming
    await onEvent({
      type: "scraping-started",
      message: `Starting to scrape ${request.url}`,
      data: { url: request.url }
    });
    
    console.log(`🎮 [ControllerAgent] Streaming scrape for ${request.url}`);
    
    let scraperResult;
    try {
      // Extract options from request
      const maxPages = request.options?.maxPages ?? 20;
      const maxDepth = request.options?.maxDepth ?? 3;
      const executeJs = request.options?.executeJavaScript !== false;
      const preventDuplicates = request.options?.preventDuplicateUrls === true;
      const includeImages = request.options?.includeImages === true;
      
      // Use the streaming API of the scraper
      scraperResult = await this.scraperAgent.streamScraping(
        {
          baseUrl: request.url,
          scrapingGoal: request.scrapingGoal || "Extract all relevant information",
          maxPages: maxPages,
          maxDepth: maxDepth,
          includeImages: includeImages,
          executeJavaScript: executeJs,
          preventDuplicateUrls: preventDuplicates,
          filters: {
            mustIncludePatterns: request.options?.filters?.mustIncludePatterns || [],
            excludePatterns: request.options?.filters?.excludePatterns || []
          }
        },
        async (scraperEvent: ScraperStreamEvent) => {
          // Forward scraper events as controller events
          let controllerEvent: ControllerStreamEvent;
          
          switch(scraperEvent.type) {
            case "start":
              controllerEvent = {
                type: "scraping-started",
                message: `Started scraping ${scraperEvent.url}`,
                data: scraperEvent
              };
              break;
            
            case "page":
              controllerEvent = {
                type: "scraping-progress",
                message: `Scraped page: ${scraperEvent.data.url}`,
                data: scraperEvent.data,
                progress: undefined  // Can't access direct progress metric
              };
              break;
              
            case "auth":
              controllerEvent = {
                type: "scraping-progress",
                message: "Authentication required",
                data: scraperEvent.request
              };
              break;
              
            case "error":
              controllerEvent = {
                type: "error",
                error: scraperEvent.error,
                message: `Scraping error: ${scraperEvent.error}`
              };
              break;
            
            case "end":
              controllerEvent = {
                type: "scraping-complete",
                message: `Scraping complete. Processed ${scraperEvent.output.pages.length} pages.`,
                data: scraperEvent.output
              };
              break;
            
            default:
              controllerEvent = {
                type: "scraping-progress",
                message: "Scraping in progress",
                data: scraperEvent
              };
          }
          
          await onEvent(controllerEvent);
        }
      );
    } catch (error) {
      console.error(`❌ [ControllerAgent] Error during streaming scrape:`, error);
      await onEvent({
        type: "error",
        error: error instanceof Error ? error.message : "Unknown scraping error",
        message: "An error occurred during scraping"
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown scraping error"
      };
    }
    
    if (!scraperResult || scraperResult.pages.length === 0) {
      await onEvent({
        type: "error",
        error: "Scraping failed or returned no content",
        message: "Scraping did not return any content"
      });
      return {
        success: false,
        error: "Scraping failed or returned no content",
        result: { scraperResult }
      };
    }
    
    // Step 2: Process the scraped content
    await onEvent({
      type: "processing-started",
      message: `Starting knowledge processing on ${scraperResult.pages.length} pages`,
      data: { pageCount: scraperResult.pages.length }
    });
    
    console.log(`🎮 [ControllerAgent] Scraped ${scraperResult.pages.length} pages. Processing content...`);
    
    let knowledgeResult;
    try {
      // Process the content - add progress updates at fixed intervals
      const processingStartTime = Date.now();
      
      // Schedule periodic progress updates
      const progressInterval = setInterval(async () => {
        const elapsedSeconds = Math.floor((Date.now() - processingStartTime) / 1000);
        await onEvent({
          type: "processing-progress",
          message: `Processing content... (${elapsedSeconds}s elapsed)`,
          progress: undefined // We don't have actual progress metrics
        });
      }, 2000);
      
      // Actual processing
      knowledgeResult = await this.knowledgeAgent.processContent({
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
      
      // Stop progress updates
      clearInterval(progressInterval);
      
      await onEvent({
        type: "processing-complete",
        message: `Knowledge processing complete. Extracted ${knowledgeResult.entities.length} entities and ${knowledgeResult.relationships.length} relationships.`,
        data: {
          entityCount: knowledgeResult.entities.length,
          relationshipCount: knowledgeResult.relationships.length,
          processingTime: Math.floor((Date.now() - processingStartTime) / 1000)
        }
      });
    } catch (error) {
      console.error(`❌ [ControllerAgent] Error during knowledge processing:`, error);
      await onEvent({
        type: "error",
        error: error instanceof Error ? error.message : "Unknown processing error",
        message: "An error occurred during knowledge processing"
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown processing error",
        result: { scraperResult }
      };
    }
    
    console.log(`🎮 [ControllerAgent] Knowledge processing complete. Extracted ${knowledgeResult.entities.length} entities and ${knowledgeResult.relationships.length} relationships.`);
    
    // Step 3: Store results in vector database if requested
    let storageResult: StorageResult | undefined;
    
    // Check if storage is requested and supabase client is available
    const storeInVectorDb = request.options?.storeInVectorDb !== false;
    const namespace = request.options?.namespace || 'default';

    console.log(`🎮 [ControllerAgent] Storing knowledge in vector database: ${storeInVectorDb}`);
    console.log(`🎮 [ControllerAgent] Supabase client available: ${this.supabaseClient ? 'Yes' : 'No'}`);
    
    if (storeInVectorDb && this.supabaseClient) {
      try {
        await onEvent({
          type: "storage-started",
          message: "Storing knowledge in vector database",
          data: {
            namespace: namespace,
            entityCount: knowledgeResult.entities.length,
            relationshipCount: knowledgeResult.relationships.length
          }
        });
        
        storageResult = await this.storeProcessedKnowledge(
          knowledgeResult, 
          request.url, 
          {
            namespace: namespace,
            storeEntities: true,
            storeRelationships: true,
            storeContentChunks: true
          }
        );
        
        await onEvent({
          type: "storage-complete",
          message: `Storage complete. Stored ${storageResult.storedItems} items.`,
          data: storageResult
        });
        
        console.log(`🎮 [ControllerAgent] Storage complete. Stored ${storageResult.storedItems} items.`);
      } catch (error) {
        console.error(`❌ [ControllerAgent] Error storing knowledge:`, error);
        
        storageResult = {
          success: false,
          storedItems: 0,
          namespace: namespace,
          error: error instanceof Error ? error.message : "Unknown storage error"
        };
        
        await onEvent({
          type: "error",
          error: error instanceof Error ? error.message : "Unknown storage error",
          message: "An error occurred during storage",
          data: storageResult
        });
      }
    }
    
    // Step 4: Send complete event and return combined result
    await onEvent({
      type: "complete",
      message: "Operation complete",
      data: {
        pagesScraped: scraperResult.summary.pagesScraped,
        entitiesExtracted: knowledgeResult.entities.length,
        relationshipsDiscovered: knowledgeResult.relationships.length,
        itemsStored: storageResult?.storedItems || 0
      }
    });
    
    return {
      success: true,
      result: {
        scraperResult,
        knowledgeResult,
        storageResult,
        combinedSummary: {
          pagesScraped: scraperResult.summary.pagesScraped,
          entitiesExtracted: knowledgeResult.entities.length,
          relationshipsDiscovered: knowledgeResult.relationships.length,
          itemsStored: storageResult?.storedItems || 0
        }
      }
    };
  }
  
  /**
   * Store processed knowledge in the vector database
   * @param knowledgeResult The processing result
   * @param sourceUrl The source URL of the content
   * @param options Storage options
   * @returns Storage result
   */
  private async storeProcessedKnowledge(
    knowledgeResult: ProcessingResult, 
    sourceUrl: string,
    options?: StorageOptions
  ): Promise<StorageResult> {
    if (!this.supabaseClient) {
      console.error(`❌ [ControllerAgent] No Supabase client available for storage`);
      return {
        success: false,
        storedItems: 0,
        namespace: options?.namespace || 'default',
        error: 'Supabase client not available'
      };
    }
    
    console.log(`💾 [ControllerAgent] Starting vector database storage with Supabase client`);
    
    // Initialize vectorstore
    console.log(`🛠️ [ControllerAgent] Creating vector store...`);
    const vectorStore = await createVectorStore(this.supabaseClient);
    console.log(`✅ [ControllerAgent] Vector store created successfully`);
    
    // Determine what to store based on options
    const storeEntities = options?.storeEntities !== false;
    const storeRelationships = options?.storeRelationships !== false;
    const storeContentChunks = options?.storeContentChunks !== false;
    
    console.log(`📊 [ControllerAgent] Storage options: entities=${storeEntities}, relationships=${storeRelationships}, chunks=${storeContentChunks}`);
    
    // Use provided namespace or create a domain-based one
    const domainMatch = sourceUrl.match(/^https?:\/\/(?:www\.)?([^\/]+)/);
    const domain = domainMatch ? domainMatch[1] : 'unknown-domain';
    const namespace = options?.namespace || `${domain}-${new Date().toISOString().split('T')[0]}`;
    
    console.log(`🏷️ [ControllerAgent] Using namespace: ${namespace}`);
    
    // Initialize counts
    let contentChunksStored = 0;
    let entitiesStored = 0;
    let relationshipsStored = 0;
    
    // 1. Store content chunks
    if (storeContentChunks && knowledgeResult.chunks && knowledgeResult.chunks.length > 0) {
      console.log(`📄 [ControllerAgent] Preparing ${knowledgeResult.chunks.length} content chunks for storage`);
      
      const chunkTexts: string[] = [];
      const chunkMetadata: Record<string, unknown>[] = [];
      
      knowledgeResult.chunks.forEach(chunk => {
        chunkTexts.push(chunk.content);
        chunkMetadata.push({
          chunkId: chunk.id,
          sourceUrl,
          contentType: 'chunk',
          entities: chunk.metadata.entities,
          source: chunk.metadata.source,
          startChar: chunk.metadata.startChar,
          endChar: chunk.metadata.endChar,
          timestamp: new Date().toISOString()
        });
      });
      
      if (chunkTexts.length > 0) {
        console.log(`💾 [ControllerAgent] Storing ${chunkTexts.length} chunks with addDocumentsToVectorStore...`);
        try {
          contentChunksStored = await addDocumentsToVectorStore(
            vectorStore,
            chunkTexts,
            chunkMetadata,
            `${namespace}-chunks`
          );
          console.log(`✅ [ControllerAgent] Successfully stored ${contentChunksStored} chunks`);
        } catch (error) {
          console.error(`❌ [ControllerAgent] Error storing chunks:`, error);
        }
      }
    } else {
      console.log(`ℹ️ [ControllerAgent] Skipping chunk storage: storeContentChunks=${storeContentChunks}, chunksAvailable=${knowledgeResult.chunks?.length || 0}`);
    }
    
    // 2. Store entities
    if (storeEntities && knowledgeResult.entities.length > 0) {
      console.log(`🧩 [ControllerAgent] Preparing ${knowledgeResult.entities.length} entities for storage`);
      
      const entityTexts: string[] = [];
      const entityMetadata: Record<string, unknown>[] = [];
      
      knowledgeResult.entities.forEach(entity => {
        const entityText = this.formatEntityForStorage(entity);
        entityTexts.push(entityText);
        entityMetadata.push({
          entityId: entity.id,
          entityType: entity.type,
          sourceUrl,
          contentType: 'entity',
          confidence: entity.confidence,
          sources: entity.sources,
          timestamp: new Date().toISOString()
        });
      });
      
      if (entityTexts.length > 0) {
        console.log(`💾 [ControllerAgent] Storing ${entityTexts.length} entities with addDocumentsToVectorStore...`);
        try {
          entitiesStored = await addDocumentsToVectorStore(
            vectorStore,
            entityTexts,
            entityMetadata,
            `${namespace}-entities`
          );
          console.log(`✅ [ControllerAgent] Successfully stored ${entitiesStored} entities`);
        } catch (error) {
          console.error(`❌ [ControllerAgent] Error storing entities:`, error);
        }
      }
    } else {
      console.log(`ℹ️ [ControllerAgent] Skipping entity storage: storeEntities=${storeEntities}, entitiesAvailable=${knowledgeResult.entities.length}`);
    }
    
    // 3. Store relationships
    if (storeRelationships && knowledgeResult.relationships.length > 0) {
      console.log(`🔗 [ControllerAgent] Preparing ${knowledgeResult.relationships.length} relationships for storage`);
      
      const relationshipTexts: string[] = [];
      const relationshipMetadata: Record<string, unknown>[] = [];
      
      knowledgeResult.relationships.forEach(relationship => {
        const relationshipText = this.formatRelationshipForStorage(relationship, knowledgeResult.entities);
        relationshipTexts.push(relationshipText);
        relationshipMetadata.push({
          relationshipId: relationship.id,
          relationshipType: relationship.type,
          sourceEntityId: relationship.source,
          targetEntityId: relationship.target,
          sourceUrl,
          contentType: 'relationship',
          confidence: relationship.confidence,
          timestamp: new Date().toISOString()
        });
      });
      
      if (relationshipTexts.length > 0) {
        console.log(`💾 [ControllerAgent] Storing ${relationshipTexts.length} relationships with addDocumentsToVectorStore...`);
        try {
          relationshipsStored = await addDocumentsToVectorStore(
            vectorStore,
            relationshipTexts,
            relationshipMetadata,
            `${namespace}-relationships`
          );
          console.log(`✅ [ControllerAgent] Successfully stored ${relationshipsStored} relationships`);
        } catch (error) {
          console.error(`❌ [ControllerAgent] Error storing relationships:`, error);
        }
      }
    } else {
      console.log(`ℹ️ [ControllerAgent] Skipping relationship storage: storeRelationships=${storeRelationships}, relationshipsAvailable=${knowledgeResult.relationships.length}`);
    }
    
    // Calculate total stored items
    const totalStored = contentChunksStored + entitiesStored + relationshipsStored;
    
    console.log(`📊 [ControllerAgent] Storage summary: ${totalStored} total items stored (${contentChunksStored} chunks, ${entitiesStored} entities, ${relationshipsStored} relationships)`);
    
    return {
      success: totalStored > 0,
      storedItems: totalStored,
      namespace,
      contentChunksStored,
      entitiesStored,
      relationshipsStored
    };
  }
  
  /**
   * Format an entity as text for storage
   * @param entity The entity to format
   * @returns Formatted entity text
   */
  private formatEntityForStorage(entity: Entity): string {
    const properties = Object.entries(entity.properties)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
      
    return `Entity: ${entity.name}\nType: ${entity.type}\nProperties:\n${properties}`;
  }
  
  /**
   * Format a relationship as text for storage
   * @param relationship The relationship to format
   * @param entities All entities for reference
   * @returns Formatted relationship text
   */
  private formatRelationshipForStorage(relationship: Relationship, entities: Entity[]): string {
    const sourceEntity = entities.find(e => e.id === relationship.source);
    const targetEntity = entities.find(e => e.id === relationship.target);
    
    const properties = Object.entries(relationship.properties)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
      
    return `Relationship: ${relationship.type}\nSource: ${sourceEntity?.name || relationship.source}\nTarget: ${targetEntity?.name || relationship.target}\nProperties:\n${properties}`;
  }
}

// Export types
export * from './types'; 