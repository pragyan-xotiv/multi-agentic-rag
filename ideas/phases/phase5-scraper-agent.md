# Phase 5: Scraper Agent

**Duration: 3-4 weeks**

Implement the Intelligent Scraper Agent to gather content from the web.

## Overview

The Scraper Agent is responsible for intelligently gathering web content for processing by the Knowledge Agent. Unlike traditional scrapers that follow fixed rules, this agent makes dynamic decisions about what content to extract, optimizing for value and relevance.

## Key Objectives

- Build the scraper infrastructure with background job processing
- Implement the Intelligent Scraper Agent with LangGraph
- Create integrations with the Knowledge Processing Agent
- Develop a scraping control UI for monitoring and configuration
- Implement ethical web scraping practices

## Tasks

### 1. Scraper Infrastructure

- Set up background job processing
  ```typescript
  // utils/queue.ts
  import { Queue, Worker } from "bullmq";
  
  export const scrapingQueue = new Queue("scraping", {
    connection: {
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || "6379")
    }
  });
  
  export function setupScrapingWorkers(concurrency: number = 5) {
    const worker = new Worker("scraping", async (job) => {
      const { baseUrl, maxPages, depth, scrapingGoal } = job.data;
      
      const scraper = new ScraperAgent({
        baseUrl,
        maxPages,
        scrapingGoal
      });
      
      return await scraper.run();
    }, {
      connection: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || "6379")
      },
      concurrency
    });
    
    worker.on("completed", (job, result) => {
      console.log(`Job ${job.id} completed`);
    });
    
    worker.on("failed", (job, err) => {
      console.error(`Job ${job.id} failed: ${err.message}`);
    });
    
    return worker;
  }
  ```

- Implement rate limiting and politeness policies
  ```typescript
  // utils/rateLimiter.ts
  import { RateLimiter } from "limiter";
  
  export class DomainRateLimiter {
    private limiters = new Map<string, RateLimiter>();
    
    constructor(
      private defaultRatePerMinute: number = 10,
      private robotsTxtRates: Map<string, number> = new Map()
    ) {}
    
    public async acquireToken(url: string): Promise<void> {
      const domain = new URL(url).hostname;
      
      if (!this.limiters.has(domain)) {
        const rate = this.robotsTxtRates.get(domain) || this.defaultRatePerMinute;
        this.limiters.set(domain, new RateLimiter({ tokensPerInterval: rate, interval: "minute" }));
      }
      
      const limiter = this.limiters.get(domain)!;
      const remainingRequests = await limiter.removeTokens(1);
      
      if (remainingRequests < 0) {
        // Wait until the next token is available
        const waitTime = Math.abs(remainingRequests) * (60 * 1000 / limiter.tokensPerInterval);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  ```

- Create scraping job management system
  ```typescript
  // models/ScrapingJob.ts
  import { supabase } from "../lib/supabase";
  
  export enum ScrapingJobStatus {
    PENDING = "pending",
    RUNNING = "running",
    COMPLETED = "completed",
    FAILED = "failed"
  }
  
  export interface ScrapingJobConfig {
    baseUrl: string;
    maxPages: number;
    scrapingGoal: string;
    allowedDomains?: string[];
    followExternalLinks?: boolean;
    depth?: number;
  }
  
  export interface ScrapingJobResults {
    pagesScraped: number;
    contentExtracted: number;
    timeElapsed: number;
    errors?: string[];
  }
  
  export class ScrapingJob {
    // Implementation
  }
  ```

### 2. Scraper Agent Implementation

- Define agent state and workflow
  ```typescript
  interface ScraperAgentState {
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
  }
  
  const scraperWorkflow = new StateGraph<ScraperAgentState>({
    channels: {
      currentUrl: new Channel(),
      extractedContent: new Channel(),
      nextActions: new Channel()
    }
  })
    .addNode("analyzeURL", analyzePage)
    .addNode("extractContent", extractContentFromPage)
    .addNode("identifyLinks", findRelevantLinks)
    .addNode("evaluateProgress", assessScrapingProgress)
    .addNode("decideNextAction", determineNextStep)
    .addNode("structureOutput", organizeExtractedData)
    
    .addEdge("analyzeURL", "extractContent")
    .addEdge("extractContent", "identifyLinks")
    .addEdge("identifyLinks", "evaluateProgress")
    .addEdge("evaluateProgress", "decideNextAction")
    
    .addConditionalEdge(
      "decideNextAction",
      (state) => {
        if (state.valueMetrics.completeness > 0.85 || 
            state.visitedUrls.size >= state.maxPages) {
          return "structureOutput";
        }
        return "analyzeURL";
      }
    )
    .addEdge("structureOutput", "FINAL");
  ```

- Implement page analysis components
  ```typescript
  async function analyzePage(state: ScraperAgentState, context: AgentContext): Promise<ScraperAgentState> {
    // Implementation for page analysis
    return state;
  }
  ```

- Create content extraction modules
  ```typescript
  async function extractContentFromPage(state: ScraperAgentState, context: AgentContext): Promise<ScraperAgentState> {
    // Implementation for content extraction
    return state;
  }
  ```

- Build URL prioritization system
  ```typescript
  async function findRelevantLinks(state: ScraperAgentState, context: AgentContext): Promise<ScraperAgentState> {
    // Implementation for link analysis and prioritization
    return state;
  }
  ```

### 3. Integration with Knowledge Processing

- Establish content handoff mechanism
  ```typescript
  async function handoffToKnowledgeAgent(content: ScraperOutput): Promise<void> {
    const knowledgeAgent = new KnowledgeProcessingAgent();
    await knowledgeAgent.processContent(content);
  }
  ```

- Create content normalization pipeline
  ```typescript
  function normalizeContent(rawContent: ScraperOutput): NormalizedContent {
    // Implementation for content normalization
    return normalizedContent;
  }
  ```

- Implement validation of scraped data
  ```typescript
  function validateScrapedContent(content: ScraperOutput): ValidationResult {
    // Implementation for content validation
    return validationResult;
  }
  ```

### 4. Scraping UI

- Build scraping job configuration interface
  ```jsx
  // app/scraping/new/page.tsx
  export default function NewScrapingJobPage() {
    // Implementation for job configuration UI
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-2xl font-bold mb-6">Create Scraping Job</h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Form fields */}
        </form>
      </div>
    );
  }
  ```

- Create job monitoring dashboard
  ```jsx
  // app/scraping/dashboard/page.tsx
  export default function ScrapingDashboardPage() {
    // Implementation for dashboard UI
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-2xl font-bold mb-6">Scraping Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Dashboard cards */}
        </div>
        {/* Job list */}
      </div>
    );
  }
  ```

- Implement results preview
  ```jsx
  // components/ScrapingResultPreview.tsx
  export default function ScrapingResultPreview({ job }) {
    // Implementation for results preview
    return (
      <div className="border rounded-lg p-4">
        <h2 className="text-xl font-semibold mb-2">Results Preview</h2>
        {/* Preview content */}
      </div>
    );
  }
  ```

### 5. Legal & Ethical Compliance

- Implement robots.txt compliance
  ```typescript
  // utils/robotsTxt.ts
  import { RobotsParser } from "robots-parser";
  
  export class RobotsTxtManager {
    private parsers = new Map<string, RobotsParser>();
    
    async canFetch(url: string, userAgent: string = "MultiAgentRAG"): Promise<boolean> {
      // Implementation for robots.txt checking
      return true; // Placeholder
    }
    
    // Additional methods
  }
  ```

- Add source attribution system
  ```typescript
  // utils/attribution.ts
  export interface SourceAttribution {
    url: string;
    title: string;
    author?: string;
    publishDate?: Date;
    accessDate: Date;
    license?: string;
  }
  
  export class AttributionManager {
    // Implementation for attribution management
  }
  ```

- Create content filtering pipeline
  ```typescript
  // utils/contentFilter.ts
  export enum ContentFilterCategory {
    UNSAFE = "unsafe",
    SENSITIVE = "sensitive",
    SAFE = "safe"
  }
  
  export class ContentFilter {
    // Implementation for content filtering
  }
  ```

## Deliverables

- Fully functional Scraper Agent with intelligent decision-making
- Background job processing infrastructure for scalable scraping
- Integration with Knowledge Processing Agent
- Scraping UI for job configuration and monitoring
- Ethical scraping implementation with compliance checks

## Success Criteria

- Scraper Agent can intelligently navigate websites to find relevant content
- System properly respects robots.txt and implements rate limiting
- Scraped content is successfully handed off to the Knowledge Processing Agent
- UI provides intuitive job management and monitoring
- System is ready for full integration in Phase 6 