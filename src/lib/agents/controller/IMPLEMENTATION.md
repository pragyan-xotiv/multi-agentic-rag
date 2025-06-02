# Controller Agent MVP Implementation

This document outlines the implementation plan for the Minimum Viable Product (MVP) version of the Controller Agent, focusing specifically on orchestrating the Scraper Agent and Knowledge Processing Agent workflow.

## Architecture Overview

```
                    ┌───────────────────────┐
                    │                       │
                    │       User API        │
                    │                       │
                    └──────────┬────────────┘
                               │
                               ▼
                    ┌───────────────────────┐
                    │                       │
                    │   Controller Agent    │
                    │                       │
                    └──────────┬────────────┘
                               │
                 ┌─────────────┴─────────────┐
                 │                           │
    ┌────────────▼───────────┐   ┌───────────▼────────────┐
    │                        │   │                        │
    │     Scraper Agent      │──▶│ Knowledge Processing   │
    │                        │   │      Agent             │
    └────────────────────────┘   └────────────────────────┘
```

## MVP Scope

For the MVP, we'll focus on:

1. Implementing the core Controller Agent functionality
2. Creating a workflow that connects Scraper and Knowledge Processing agents
3. Providing a simple API interface
4. Adding basic error handling and logging

## Implementation Components

### 1. Types and Interfaces

```typescript
// src/lib/agents/controller/types.ts

import { ScraperOutput } from "../scraper/types";
import { ProcessingResult } from "../knowledge-processing/types";

export type RequestType = "scrape" | "process" | "scrape-and-process";

export interface ControllerRequest {
  requestType: RequestType;
  url?: string;
  scrapingGoal?: string;
  processingGoal?: string;
  options?: Record<string, any>;
}

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
```

### 2. Controller Agent Implementation

```typescript
// src/lib/agents/controller/index.ts

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
  
  async processRequest(request: ControllerRequest): Promise<ControllerResponse> {
    try {
      console.log(`🎮 [ControllerAgent] Processing ${request.requestType} request`);
      
      switch(request.requestType) {
        case "scrape":
          return await this.handleScrapeRequest(request);
        case "process":
          return await this.handleProcessRequest(request);
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
  
  private async handleScrapeRequest(request: ControllerRequest): Promise<ControllerResponse> {
    if (!request.url) {
      return { success: false, error: "URL is required for scraping" };
    }
    
    const scraperResult = await this.scraperAgent.scrapeUrl(request.url, {
      scrapingGoal: request.scrapingGoal || "Extract all relevant information",
      ...request.options
    });
    
    return {
      success: true,
      result: { scraperResult }
    };
  }
  
  private async handleProcessRequest(request: ControllerRequest): Promise<ControllerResponse> {
    // This would handle pre-existing content to process
    // Not implementing in MVP
    return { success: false, error: "Not implemented in MVP" };
  }
  
  private async handleScrapeAndProcess(request: ControllerRequest): Promise<ControllerResponse> {
    if (!request.url) {
      return { success: false, error: "URL is required for scraping" };
    }
    
    // Step 1: Scrape the URL
    console.log(`🎮 [ControllerAgent] Scraping ${request.url}`);
    const scraperResult = await this.scraperAgent.scrapeUrl(request.url, {
      scrapingGoal: request.scrapingGoal || "Extract all relevant information",
      ...request.options
    });
    
    if (!scraperResult || scraperResult.pages.length === 0) {
      return {
        success: false,
        error: "Scraping failed or returned no content",
        result: { scraperResult }
      };
    }
    
    // Step 2: Process the scraped content
    console.log(`🎮 [ControllerAgent] Processing scraped content`);
    const knowledgeResult = await this.knowledgeAgent.processContent({
      content: scraperResult,
      contentType: "scraped-content",
      source: request.url,
      metadata: {
        processingGoal: request.processingGoal || `Extract structured knowledge from content about: ${request.scrapingGoal}`,
        scrapeGoal: request.scrapingGoal
      }
    });
    
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
```

### 3. API Endpoint

```typescript
// src/app/api/controller/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { ControllerAgent } from '@/lib/agents/controller';

export async function POST(req: NextRequest) {
  try {
    const requestData = await req.json();
    
    const controller = new ControllerAgent();
    const result = await controller.processRequest(requestData);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in controller API:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      },
      { status: 500 }
    );
  }
}
```

## Request Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  Client Request                                                              │
│  {                                                                           │
│    "requestType": "scrape-and-process",                                      │
│    "url": "https://example.com",                                             │
│    "scrapingGoal": "Extract information about XYZ",                          │
│    "processingGoal": "Identify key entities and relationships"               │
│  }                                                                           │
│                                                                              │
└────────────────────────────────────┬─────────────────────────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  Controller Agent                                                            │
│  1. Validates request                                                        │
│  2. Routes to appropriate handler                                            │
│  3. Orchestrates agent communication                                         │
│  4. Handles errors                                                           │
│  5. Returns consolidated response                                            │
│                                                                              │
└───────────────┬──────────────────────────────────────────┬───────────────────┘
                │                                          │
                ▼                                          ▼
┌───────────────────────────────┐              ┌────────────────────────────────┐
│                               │              │                                │
│  Scraper Agent                │              │  Knowledge Processing Agent    │
│  1. Analyzes URL              │───Results───▶│  1. Analyzes content           │
│  2. Crawls website            │              │  2. Extracts entities          │
│  3. Extracts content          │              │  3. Discovers relationships    │
│  4. Returns structured data   │              │  4. Returns structured knowledge│
│                               │              │                                │
└───────────────────────────────┘              └────────────────────────────────┘
```

## MVP Workflow Sequence

```
┌──────────┐          ┌────────────┐          ┌──────────┐          ┌────────────┐
│  Client  │          │ Controller │          │ Scraper  │          │ Knowledge  │
│          │          │   Agent    │          │  Agent   │          │   Agent    │
└────┬─────┘          └─────┬──────┘          └────┬─────┘          └─────┬──────┘
     │                      │                      │                      │
     │ POST /api/controller │                      │                      │
     │─────────────────────>│                      │                      │
     │                      │                      │                      │
     │                      │  scrapeUrl(url, opts)│                      │
     │                      │─────────────────────>│                      │
     │                      │                      │                      │
     │                      │                      │  fetch and process   │
     │                      │                      │<─────────────────────│
     │                      │                      │                      │
     │                      │    scraperResult     │                      │
     │                      │<─────────────────────│                      │
     │                      │                      │                      │
     │                      │                      │  processContent(data)│
     │                      │─────────────────────────────────────────────>
     │                      │                      │                      │
     │                      │                      │   analyze and extract│
     │                      │                      │<─────────────────────│
     │                      │                      │                      │
     │                      │                     knowledgeResult         │
     │                      │<─────────────────────────────────────────────
     │                      │                      │                      │
     │  JSON Response       │                      │                      │
     │<─────────────────────│                      │                      │
     │                      │                      │                      │
┌────┴─────┐          ┌─────┴──────┐          ┌────┴─────┐          ┌─────┴──────┐
│  Client  │          │ Controller │          │ Scraper  │          │ Knowledge  │
│          │          │   Agent    │          │  Agent   │          │   Agent    │
└──────────┘          └────────────┘          └──────────┘          └────────────┘
```

## Implementation Steps

1. **Create basic types and interfaces**
   - Define request/response types
   - Define agent communication interfaces

2. **Implement Controller Agent core**
   - Create the main controller class
   - Implement request routing logic
   - Add error handling

3. **Implement Scraper integration**
   - Connect to Scraper Agent
   - Handle scraping responses
   - Manage errors

4. **Implement Knowledge Processing integration**
   - Connect to Knowledge Processing Agent
   - Handle processing responses
   - Manage errors

5. **Create API endpoint**
   - Implement REST API
   - Add validation
   - Add error handling

6. **Testing**
   - Test with simple websites
   - Test error cases
   - Measure performance

## Limitations and Future Enhancements

### MVP Limitations
- No authentication handling
- No complex decision-making for agent routing
- Limited error recovery
- No streaming responses
- No state persistence between requests

### Future Enhancements
- Add Query Agent integration
- Add authentication handling
- Implement disambiguation workflows
- Add streaming response support
- Implement state persistence
- Add more advanced error recovery
- Add more sophisticated routing logic

## Usage Example

```typescript
// Example client code
const response = await fetch('/api/controller', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    requestType: 'scrape-and-process',
    url: 'https://example.com',
    scrapingGoal: 'Extract information about their products and services',
    options: {
      maxPages: 10,
      maxDepth: 2
    }
  }),
});

const result = await response.json();
console.log(`Scraped ${result.result.combinedSummary.pagesScraped} pages`);
console.log(`Extracted ${result.result.combinedSummary.entitiesExtracted} entities`);
``` 