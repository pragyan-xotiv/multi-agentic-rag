# Phase 6: System Integration & Enhancement

**Duration: 3-4 weeks**

Integrate all agents into a cohesive system and enhance with advanced features.

## Overview

Phase 6 focuses on bringing together all the individual agent components into a unified, coherent system. This phase addresses cross-agent communication, unified interfaces, performance optimization, and security enhancements to create a production-ready multi-agent RAG system.

## Key Objectives

- Implement a comprehensive agent communication system
- Create advanced UI features for system-wide monitoring and control
- Optimize performance for production deployment
- Enhance security across the entire system
- Prepare comprehensive documentation for deployment

## Tasks

### 1. Full Agent Communication System

- Implement comprehensive message bus
  ```typescript
  // lib/messaging/messageBus.ts
  import { EventEmitter } from "events";
  import Redis from "ioredis";
  
  export class MessageBus {
    private local = new EventEmitter();
    private redis: Redis;
    
    constructor(redisOptions?: Redis.RedisOptions) {
      this.redis = new Redis(redisOptions);
      
      // Subscribe to Redis channels
      this.redis.subscribe("agent-events");
      this.redis.on("message", (channel, message) => {
        const event = JSON.parse(message);
        this.local.emit(event.type, event.payload);
      });
    }
    
    public async publish(eventType: string, payload: any): Promise<void> {
      // Publish to both local and Redis
      this.local.emit(eventType, payload);
      await this.redis.publish("agent-events", JSON.stringify({
        type: eventType,
        payload,
        timestamp: new Date().toISOString()
      }));
    }
    
    public subscribe(eventType: string, handler: (payload: any) => void): void {
      this.local.on(eventType, handler);
    }
    
    public unsubscribe(eventType: string, handler: (payload: any) => void): void {
      this.local.off(eventType, handler);
    }
    
    public async close(): Promise<void> {
      await this.redis.quit();
    }
  }
  ```

- Create standardized JSON schemas for all agent interactions
  ```typescript
  // lib/schemas/index.ts
  import { z } from "zod";
  
  // Base message schema
  export const AgentMessageSchema = z.object({
    id: z.string().uuid(),
    timestamp: z.string().datetime(),
    sender: z.string(),
    recipient: z.string(),
    messageType: z.string(),
    payload: z.any()
  });
  
  // Specific message schemas
  export const QueryRequestSchema = AgentMessageSchema.extend({
    messageType: z.literal("query-request"),
    payload: z.object({
      query: z.string(),
      conversationId: z.string().optional(),
      parameters: z.record(z.any()).optional()
    })
  });
  
  export const RetrievalRequestSchema = AgentMessageSchema.extend({
    messageType: z.literal("retrieval-request"),
    payload: z.object({
      query: z.string(),
      type: z.enum(["semantic", "keyword", "entity", "hybrid"]),
      filters: z.record(z.any()).optional(),
      parameters: z.record(z.any()).optional()
    })
  });
  
  // Additional message schemas for other agent interactions
  ```

- Build agent state persistence
  ```typescript
  // lib/state/persistentState.ts
  import { supabase } from "../supabase";
  
  export class PersistentStateManager<T> {
    constructor(
      private tableName: string,
      private primaryKey: keyof T = "id" as keyof T
    ) {}
    
    async saveState(state: T): Promise<void> {
      const { error } = await supabase
        .from(this.tableName)
        .upsert(state as any);
        
      if (error) {
        throw new Error(`Failed to save state: ${error.message}`);
      }
    }
    
    async loadState(id: string): Promise<T | null> {
      const { data, error } = await supabase
        .from(this.tableName)
        .select("*")
        .eq(this.primaryKey as string, id)
        .single();
        
      if (error) {
        if (error.code === "PGRST116") {
          return null; // Not found
        }
        throw new Error(`Failed to load state: ${error.message}`);
      }
      
      return data as T;
    }
    
    // Additional methods for state management
  }
  ```

### 2. Advanced UI Features

- Create unified dashboard
  ```jsx
  // app/dashboard/page.tsx
  export default function DashboardPage() {
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-2xl font-bold mb-6">Multi-Agent System Dashboard</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <DashboardCard
            title="Knowledge Base"
            value={documentCount}
            icon="document"
            trend={documentTrend}
          />
          <DashboardCard
            title="Entities"
            value={entityCount}
            icon="entity"
            trend={entityTrend}
          />
          <DashboardCard
            title="Scraping Jobs"
            value={activeScrapingJobs}
            icon="spider"
            trend={scrapingJobTrend}
          />
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <QueryMetricsChart />
          <AgentActivityStream />
        </div>
      </div>
    );
  }
  ```

- Implement agent execution visualization
  ```jsx
  // components/AgentExecutionVisualizer.tsx
  export default function AgentExecutionVisualizer({ executionTrace }) {
    return (
      <div className="border rounded-lg p-4">
        <h2 className="text-xl font-semibold mb-4">Agent Execution Trace</h2>
        
        {/* Visualization implementation */}
        <div className="flow-chart">
          {executionTrace.nodes.map(node => (
            <div 
              key={node.id}
              className={`node ${node.status}`}
              style={{ left: node.x, top: node.y }}
            >
              {node.name}
            </div>
          ))}
          
          {executionTrace.edges.map(edge => (
            <svg key={`${edge.source}-${edge.target}`} className="edge">
              {/* SVG path implementation */}
            </svg>
          ))}
        </div>
        
        {/* Execution details */}
        <div className="mt-4">
          <h3 className="text-lg font-medium mb-2">Execution Details</h3>
          <div className="space-y-2">
            {executionTrace.steps.map((step, i) => (
              <div key={i} className="p-2 bg-gray-50 rounded">
                <p className="font-medium">{step.node}</p>
                <p className="text-sm text-gray-600">{step.description}</p>
                <p className="text-xs text-gray-500">{step.timestamp}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  ```

- Build system monitoring interfaces
  ```jsx
  // components/SystemMonitor.tsx
  export default function SystemMonitor() {
    const [metrics, setMetrics] = useState({
      cpuUsage: 0,
      memoryUsage: 0,
      activeJobs: 0,
      queuedRequests: 0,
      responseTime: 0
    });
    
    useEffect(() => {
      // Set up real-time metrics subscription
      const subscription = supabase
        .channel('system-metrics')
        .on('broadcast', { event: 'metrics' }, payload => {
          setMetrics(payload);
        })
        .subscribe();
        
      return () => {
        subscription.unsubscribe();
      };
    }, []);
    
    return (
      <div className="border rounded-lg p-4">
        <h2 className="text-xl font-semibold mb-4">System Metrics</h2>
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <MetricCard
            title="CPU Usage"
            value={`${metrics.cpuUsage}%`}
            icon="cpu"
            trend={metrics.cpuUsage > 80 ? "negative" : "neutral"}
          />
          <MetricCard
            title="Memory Usage"
            value={`${metrics.memoryUsage}%`}
            icon="memory"
            trend={metrics.memoryUsage > 80 ? "negative" : "neutral"}
          />
          <MetricCard
            title="Active Jobs"
            value={metrics.activeJobs}
            icon="activity"
            trend="neutral"
          />
          <MetricCard
            title="Queued Requests"
            value={metrics.queuedRequests}
            icon="queue"
            trend={metrics.queuedRequests > 20 ? "negative" : "neutral"}
          />
          <MetricCard
            title="Avg Response Time"
            value={`${metrics.responseTime}ms`}
            icon="clock"
            trend={metrics.responseTime > 1000 ? "negative" : "neutral"}
          />
        </div>
      </div>
    );
  }
  ```

- Add admin configuration panels
  ```jsx
  // app/admin/config/page.tsx
  export default function SystemConfigurationPage() {
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-2xl font-bold mb-6">System Configuration</h1>
        
        <div className="space-y-8">
          <ConfigSection
            title="Agent Configuration"
            description="Configure behavior of individual agents"
            configItems={agentConfigItems}
          />
          
          <ConfigSection
            title="Performance Settings"
            description="Tune system performance parameters"
            configItems={performanceConfigItems}
          />
          
          <ConfigSection
            title="Integration Settings"
            description="Configure external service integrations"
            configItems={integrationConfigItems}
          />
        </div>
      </div>
    );
  }
  ```

### 3. Performance Optimization

- Implement comprehensive caching
  ```typescript
  // lib/cache/index.ts
  import { Redis } from "ioredis";
  
  export class CacheManager {
    private redis: Redis;
    
    constructor(redisOptions?: Redis.RedisOptions) {
      this.redis = new Redis(redisOptions);
    }
    
    async get<T>(key: string): Promise<T | null> {
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    }
    
    async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await this.redis.setex(key, ttlSeconds, serialized);
      } else {
        await this.redis.set(key, serialized);
      }
    }
    
    async invalidate(keyPattern: string): Promise<void> {
      const keys = await this.redis.keys(keyPattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    }
    
    // Additional cache management methods
  }
  ```

- Add parallel processing for high-volume operations
  ```typescript
  // lib/parallel/index.ts
  export async function processInParallel<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    concurrency: number = 5
  ): Promise<R[]> {
    const results: R[] = [];
    const queue = [...items];
    
    const workers = Array(Math.min(concurrency, items.length))
      .fill(null)
      .map(async () => {
        while (queue.length > 0) {
          const item = queue.shift()!;
          const result = await processor(item);
          results.push(result);
        }
      });
    
    await Promise.all(workers);
    return results;
  }
  ```

- Optimize database queries and indexes
  ```sql
  -- Optimized indexes for common query patterns
  CREATE INDEX idx_documents_metadata_gin ON documents USING GIN (metadata);
  CREATE INDEX idx_entities_type ON entities (type);
  CREATE INDEX idx_relationships_source_target ON relationships (source_id, target_id);
  CREATE INDEX idx_documents_embedding_cosine ON documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
  ```

### 4. Security Enhancements

- Implement comprehensive input validation
  ```typescript
  // middleware.ts
  import { NextResponse } from 'next/server';
  import type { NextRequest } from 'next/server';
  import { ZodError } from 'zod';
  import { apiSchemas } from './lib/schemas/api';
  
  export async function middleware(request: NextRequest) {
    // Only apply to API routes
    if (!request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.next();
    }
    
    try {
      // Get the schema for this endpoint
      const path = request.nextUrl.pathname.replace('/api/', '');
      const schema = apiSchemas[path];
      
      if (!schema) {
        return NextResponse.next();
      }
      
      // Validate request body against schema
      const body = await request.json();
      schema.parse(body);
      
      return NextResponse.next();
    } catch (error) {
      if (error instanceof ZodError) {
        return NextResponse.json(
          { error: 'Validation error', details: error.errors },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: 'Invalid request' },
        { status: 400 }
      );
    }
  }
  ```

- Add content moderation system
  ```typescript
  // lib/moderation/index.ts
  export enum ContentModerationResult {
    SAFE = 'safe',
    WARNING = 'warning',
    BLOCKED = 'blocked'
  }
  
  export interface ModerationResponse {
    result: ContentModerationResult;
    reason?: string;
    confidence: number;
  }
  
  export class ContentModerator {
    async moderateText(text: string): Promise<ModerationResponse> {
      // Implementation using OpenAI moderation API or similar
      return {
        result: ContentModerationResult.SAFE,
        confidence: 1.0
      };
    }
    
    async moderateUrl(url: string): Promise<ModerationResponse> {
      // Implementation for URL moderation
      return {
        result: ContentModerationResult.SAFE,
        confidence: 1.0
      };
    }
  }
  ```

- Create API key management for external access
  ```typescript
  // lib/auth/apiKeys.ts
  import { randomBytes, createHmac } from 'crypto';
  import { supabase } from '../supabase';
  
  export class ApiKeyManager {
    async generateApiKey(userId: string, description: string, scopes: string[]): Promise<string> {
      // Generate a secure API key
      const keyBuffer = randomBytes(32);
      const apiKey = keyBuffer.toString('base64');
      
      // Store a hash of the key, not the key itself
      const keyHash = createHmac('sha256', process.env.API_KEY_SECRET!)
        .update(apiKey)
        .digest('hex');
      
      // Save to database
      const { error } = await supabase
        .from('api_keys')
        .insert({
          user_id: userId,
          key_hash: keyHash,
          description,
          scopes,
          created_at: new Date()
        });
      
      if (error) {
        throw new Error(`Failed to create API key: ${error.message}`);
      }
      
      // Return the key to the user - this is the only time it will be visible
      return apiKey;
    }
    
    async validateApiKey(apiKey: string): Promise<{valid: boolean, userId?: string, scopes?: string[]}> {
      // Implementation for API key validation
      return { valid: false };
    }
  }
  ```

### 5. Documentation & Deployment

- Create comprehensive API documentation
  ```typescript
  // scripts/generateApiDocs.ts
  import { writeFileSync } from 'fs';
  import { apiSchemas } from '../lib/schemas/api';
  import { zodToOpenAPI } from 'zod-to-openapi';
  
  // Convert Zod schemas to OpenAPI
  const openApiSpec = {
    openapi: '3.0.0',
    info: {
      title: 'Multi-Agent RAG System API',
      version: '1.0.0',
      description: 'API documentation for the Multi-Agent RAG system'
    },
    paths: {}
  };
  
  // Generate documentation for each endpoint
  for (const [path, schema] of Object.entries(apiSchemas)) {
    openApiSpec.paths[`/api/${path}`] = {
      post: {
        summary: `${path} endpoint`,
        requestBody: {
          content: {
            'application/json': {
              schema: zodToOpenAPI(schema)
            }
          }
        },
        responses: {
          '200': {
            description: 'Successful operation'
          },
          '400': {
            description: 'Invalid request'
          }
        }
      }
    };
  }
  
  // Write to file
  writeFileSync('./public/api-docs.json', JSON.stringify(openApiSpec, null, 2));
  ```

- Build user guides and tutorials
  ```jsx
  // app/docs/page.tsx
  export default function DocumentationPage() {
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-2xl font-bold mb-6">Documentation</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <DocCard
            title="Getting Started"
            description="Learn the basics of using the system"
            href="/docs/getting-started"
            icon="rocket"
          />
          <DocCard
            title="Knowledge Base"
            description="How to manage your knowledge base"
            href="/docs/knowledge-base"
            icon="database"
          />
          <DocCard
            title="Web Scraping"
            description="Configure and manage scraping jobs"
            href="/docs/scraping"
            icon="spider"
          />
          <DocCard
            title="Querying Knowledge"
            description="How to ask questions and get answers"
            href="/docs/querying"
            icon="search"
          />
          <DocCard
            title="API Reference"
            description="Complete API documentation"
            href="/docs/api"
            icon="code"
          />
          <DocCard
            title="Administration"
            description="System administration guide"
            href="/docs/admin"
            icon="settings"
          />
        </div>
      </div>
    );
  }
  ```

- Set up production deployment pipeline
  ```yaml
  # .github/workflows/deploy.yml
  name: Deploy
  
  on:
    push:
      branches: [main]
  
  jobs:
    deploy:
      runs-on: ubuntu-latest
      
      steps:
        - uses: actions/checkout@v3
        
        - name: Set up Node.js
          uses: actions/setup-node@v3
          with:
            node-version: '18'
            cache: 'npm'
            
        - name: Install dependencies
          run: npm ci
          
        - name: Run tests
          run: npm test
          
        - name: Build application
          run: npm run build
          
        - name: Deploy to Vercel
          uses: amondnet/vercel-action@v20
          with:
            vercel-token: ${{ secrets.VERCEL_TOKEN }}
            vercel-org-id: ${{ secrets.ORG_ID }}
            vercel-project-id: ${{ secrets.PROJECT_ID }}
            vercel-args: '--prod'
  ```

- Implement monitoring and alerting
  ```typescript
  // lib/monitoring/index.ts
  import { Metrics } from '@opentelemetry/api-metrics';
  import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
  
  export class MonitoringService {
    private metrics: Metrics;
    private counters: Record<string, any> = {};
    private histograms: Record<string, any> = {};
    
    constructor() {
      // Set up Prometheus exporter
      const exporter = new PrometheusExporter({ port: 9464 });
      this.metrics = exporter.getMetricProvider().getMeter('multi-agent-rag');
      
      // Initialize common metrics
      this.counters.apiRequests = this.metrics.createCounter('api_requests', {
        description: 'Count of API requests'
      });
      
      this.histograms.responseTime = this.metrics.createHistogram('response_time', {
        description: 'API response time in milliseconds'
      });
      
      // Additional metrics setup
    }
    
    // Methods for recording metrics
  }
  ```

## Deliverables

- Unified agent communication system with message schemas
- Advanced dashboard and monitoring UI
- Performance-optimized system ready for production
- Enhanced security features and content moderation
- Comprehensive documentation and deployment pipeline

## Success Criteria

- All agents communicate seamlessly through the messaging system
- System dashboard provides comprehensive visibility into operations
- Performance optimizations enable efficient handling of high loads
- Security measures protect against common vulnerabilities
- Documentation covers all aspects of system operation and API usage
- System is ready for final testing and refinement in Phase 7 