# Phase 9: Memory Management System

**Duration: 3-4 weeks**

Implement the Memory Management System to provide comprehensive storage, retrieval, and update capabilities across the multi-agent RAG system.

## Overview

The Memory Management System serves as the central memory architecture for the entire multi-agent system. It enables agents to maintain context, learn from interactions, and build a persistent knowledge base that evolves over time.

## Key Objectives

- Build a multi-layered memory architecture with short-term and long-term storage
- Implement efficient memory retrieval mechanisms
- Create memory update protocols for knowledge evolution
- Develop entity memory with relationship tracking
- Implement conversation memory for context preservation

## Tasks

### 1. Memory Storage Infrastructure

- Set up core memory storage systems
  ```typescript
  // memory/storage/index.ts
  import { createClient } from '@supabase/supabase-js';
  import { Redis } from 'ioredis';
  
  // Vector database for semantic search
  export const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
  
  // Redis for short-term memory
  export const redis = new Redis(process.env.REDIS_URL!);
  
  // Initialize storage systems
  export async function initializeMemoryStorage() {
    // Ensure required extensions and tables
    await setupVectorStorage();
    await setupGraphStorage();
    await setupRedisStructures();
  }
  ```

- Implement vector storage for semantic memory
  ```typescript
  // memory/storage/vector.ts
  import { supabase } from './index';
  
  export async function setupVectorStorage() {
    // Check if pgvector extension is enabled
    const { error: extensionError } = await supabase.rpc('check_extension', {
      extension_name: 'vector'
    });
    
    if (extensionError) {
      throw new Error(`Vector extension not available: ${extensionError.message}`);
    }
    
    // Create document chunks table with vector support
    const { error } = await supabase.rpc('create_document_chunks_table');
    
    if (error) {
      console.error('Error creating document chunks table:', error);
    }
  }
  ```

- Create graph structures for entity relationships
  ```typescript
  // memory/storage/graph.ts
  import { supabase } from './index';
  
  export async function setupGraphStorage() {
    // Create entities table
    const { error: entitiesError } = await supabase.query(`
      CREATE TABLE IF NOT EXISTS entities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        type VARCHAR NOT NULL,
        name VARCHAR NOT NULL,
        properties JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    
    if (entitiesError) {
      console.error('Error creating entities table:', entitiesError);
    }
    
    // Create relationships table
    const { error: relationshipsError } = await supabase.query(`
      CREATE TABLE IF NOT EXISTS relationships (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_id UUID REFERENCES entities(id) ON DELETE CASCADE,
        target_id UUID REFERENCES entities(id) ON DELETE CASCADE,
        type VARCHAR NOT NULL,
        properties JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    
    if (relationshipsError) {
      console.error('Error creating relationships table:', relationshipsError);
    }
  }
  ```

- Configure Redis for short-term memory
  ```typescript
  // memory/storage/redis.ts
  import { redis } from './index';
  
  export async function setupRedisStructures() {
    // Create memory maintenance schedule
    await redis.set('memory:maintenance:last_run', Date.now());
    
    // Set up expiration policies
    await redis.config('SET', 'maxmemory-policy', 'volatile-ttl');
    
    console.log('Redis configured for short-term memory');
  }
  ```

### 2. Memory Types Implementation

- Implement short-term memory
  ```typescript
  // memory/types/short-term.ts
  import { redis } from '../storage';
  
  export class ShortTermMemory {
    // Session memory for conversation context
    async storeConversationContext(conversationId: string, context: any) {
      const key = `conversation:${conversationId}:context`;
      
      await redis.set(key, JSON.stringify(context));
      await redis.expire(key, 60 * 60 * 24); // 24 hour TTL
    }
    
    async getConversationContext(conversationId: string) {
      const key = `conversation:${conversationId}:context`;
      const data = await redis.get(key);
      
      return data ? JSON.parse(data) : null;
    }
    
    // Working memory for agent operations
    async setWorkingMemory(agentId: string, taskId: string, data: any) {
      const key = `agent:${agentId}:task:${taskId}:working_memory`;
      
      await redis.set(key, JSON.stringify(data));
      await redis.expire(key, 60 * 30); // 30 minute TTL
    }
    
    async getWorkingMemory(agentId: string, taskId: string) {
      const key = `agent:${agentId}:task:${taskId}:working_memory`;
      const data = await redis.get(key);
      
      return data ? JSON.parse(data) : null;
    }
  }
  ```

- Build long-term memory
  ```typescript
  // memory/types/long-term.ts
  import { supabase } from '../storage';
  import { createEmbedding } from '../embeddings';
  
  export class LongTermMemory {
    // Knowledge base operations
    async storeKnowledge(chunks: any[]) {
      const embeddedChunks = await Promise.all(
        chunks.map(async (chunk) => {
          const embedding = await createEmbedding(chunk.content);
          
          return {
            content: chunk.content,
            embedding,
            document_id: chunk.documentId,
            metadata: chunk.metadata
          };
        })
      );
      
      const { error } = await supabase
        .from('document_chunks')
        .insert(embeddedChunks);
        
      if (error) {
        throw new Error(`Error storing knowledge: ${error.message}`);
      }
      
      return embeddedChunks.length;
    }
    
    async retrieveKnowledge(query: string, options: any = {}) {
      const embedding = await createEmbedding(query);
      
      const { data, error } = await supabase.rpc('match_documents', {
        query_embedding: embedding,
        match_threshold: options.threshold || 0.7,
        match_count: options.limit || 10,
        filter_object: options.filters || {}
      });
      
      if (error) {
        throw new Error(`Error retrieving knowledge: ${error.message}`);
      }
      
      return data;
    }
  }
  ```

- Create entity memory
  ```typescript
  // memory/types/entity.ts
  import { supabase } from '../storage';
  
  export class EntityMemory {
    // Entity operations
    async storeEntity(entity: any) {
      const { data, error } = await supabase
        .from('entities')
        .insert({
          type: entity.type,
          name: entity.name,
          properties: entity.properties
        })
        .select()
        .single();
        
      if (error) {
        throw new Error(`Error storing entity: ${error.message}`);
      }
      
      return data;
    }
    
    async getEntity(entityId: string) {
      const { data, error } = await supabase
        .from('entities')
        .select('*, relationships(*)')
        .eq('id', entityId)
        .single();
        
      if (error) {
        throw new Error(`Error retrieving entity: ${error.message}`);
      }
      
      return data;
    }
    
    // Relationship operations
    async createRelationship(sourceId: string, targetId: string, type: string, properties: any = {}) {
      const { data, error } = await supabase
        .from('relationships')
        .insert({
          source_id: sourceId,
          target_id: targetId,
          type,
          properties
        })
        .select()
        .single();
        
      if (error) {
        throw new Error(`Error creating relationship: ${error.message}`);
      }
      
      return data;
    }
  }
  ```

- Implement user memory
  ```typescript
  // memory/types/user.ts
  import { supabase } from '../storage';
  import { redis } from '../storage';
  
  export class UserMemory {
    // User profile operations
    async getUserProfile(userId: string) {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
        
      if (error) {
        throw new Error(`Error retrieving user profile: ${error.message}`);
      }
      
      return data;
    }
    
    // User preferences
    async updateUserPreference(userId: string, key: string, value: any) {
      // Get current preferences
      const { data: currentProfile } = await supabase
        .from('user_profiles')
        .select('preferences')
        .eq('user_id', userId)
        .single();
      
      const preferences = currentProfile?.preferences || {};
      
      // Update preferences
      const { error } = await supabase
        .from('user_profiles')
        .update({
          preferences: {
            ...preferences,
            [key]: value
          }
        })
        .eq('user_id', userId);
        
      if (error) {
        throw new Error(`Error updating user preference: ${error.message}`);
      }
    }
    
    // Recent user activity
    async trackUserActivity(userId: string, activity: any) {
      // Store in redis for quick access
      await redis.lpush(`user:${userId}:recent_activity`, JSON.stringify({
        ...activity,
        timestamp: Date.now()
      }));
      
      // Keep only recent activities
      await redis.ltrim(`user:${userId}:recent_activity`, 0, 99);
      
      // Store in permanent storage
      await supabase
        .from('user_activities')
        .insert({
          user_id: userId,
          activity_type: activity.type,
          details: activity
        });
    }
  }
  ```

### 3. Memory Retrieval System

- Implement vector-based retrieval
  ```typescript
  // memory/retrieval/vector.ts
  import { LongTermMemory } from '../types/long-term';
  
  export async function retrieveByVector(query: string, options: any = {}) {
    const longTermMemory = new LongTermMemory();
    return await longTermMemory.retrieveKnowledge(query, options);
  }
  ```

- Create graph-based traversal retrieval
  ```typescript
  // memory/retrieval/graph.ts
  import { supabase } from '../storage';
  
  export async function retrieveByGraph(startEntityId: string, options: any = {}) {
    const maxDepth = options.maxDepth || 2;
    
    const { data, error } = await supabase.rpc('traverse_relationships', {
      start_entity_id: startEntityId,
      max_depth: maxDepth,
      relationship_types: options.relationshipTypes || []
    });
    
    if (error) {
      throw new Error(`Error in graph retrieval: ${error.message}`);
    }
    
    return data;
  }
  ```

- Build context-aware retrieval
  ```typescript
  // memory/retrieval/context.ts
  import { redis } from '../storage';
  import { extractEntities } from '../utils/entity-extraction';
  
  export async function retrieveByContext(conversationId: string) {
    // Get recent conversation history
    const recentTurns = await redis.lrange(
      `conversation:${conversationId}:history`,
      0,
      4
    );
    
    // Parse conversation turns
    const parsedTurns = recentTurns.map(turn => JSON.parse(turn));
    
    // Extract entities mentioned in conversation
    const mentionedEntities = await extractEntities(
      parsedTurns.flatMap(turn => [turn.user, turn.system]).filter(Boolean)
    );
    
    return {
      conversationHistory: parsedTurns,
      entities: mentionedEntities,
      topics: await extractTopics(parsedTurns)
    };
  }
  ```

- Implement multi-strategy retrieval
  ```typescript
  // memory/retrieval/multi-strategy.ts
  import { retrieveByVector } from './vector';
  import { retrieveByGraph } from './graph';
  import { retrieveByContext } from './context';
  
  export async function multiStrategyRetrieval(query: string, options: any = {}) {
    // Execute retrieval strategies in parallel
    const [
      vectorResults,
      contextResults
    ] = await Promise.all([
      retrieveByVector(query, options),
      options.conversationId ? retrieveByContext(options.conversationId) : null
    ]);
    
    // If entities were found in context, get graph information
    let graphResults = [];
    if (contextResults?.entities.length) {
      graphResults = await Promise.all(
        contextResults.entities.slice(0, 3).map(entity =>
          retrieveByGraph(entity.id, { maxDepth: 1 })
        )
      );
    }
    
    // Combine and rank results
    return rankAndDeduplicate([
      ...vectorResults,
      ...graphResults.flat()
    ], {
      context: contextResults,
      query
    });
  }
  ```

### 4. Memory Update Mechanisms

- Implement knowledge base updates
  ```typescript
  // memory/updates/knowledge.ts
  import { LongTermMemory } from '../types/long-term';
  import { EntityMemory } from '../types/entity';
  import { extractEntities, extractRelationships } from '../utils/extraction';
  import { eventBus } from '../events';
  
  export async function updateKnowledge(documents: any[]) {
    const longTermMemory = new LongTermMemory();
    const entityMemory = new EntityMemory();
    
    // Process and chunk documents
    const chunks = await processDocuments(documents);
    
    // Store chunks in vector database
    await longTermMemory.storeKnowledge(chunks);
    
    // Extract entities from chunks
    const entities = await extractEntities(chunks.map(c => c.content));
    
    // Store entities
    const storedEntities = await Promise.all(
      entities.map(entity => entityMemory.storeEntity(entity))
    );
    
    // Extract and store relationships
    const relationships = await extractRelationships(chunks, storedEntities);
    
    await Promise.all(
      relationships.map(rel =>
        entityMemory.createRelationship(
          rel.sourceId,
          rel.targetId,
          rel.type,
          rel.properties
        )
      )
    );
    
    // Emit knowledge update event
    eventBus.emit('knowledge_updated', {
      chunks: chunks.length,
      entities: storedEntities.length,
      relationships: relationships.length
    });
    
    return {
      chunks: chunks.length,
      entities: storedEntities.length,
      relationships: relationships.length
    };
  }
  ```

- Create entity update mechanism
  ```typescript
  // memory/updates/entity.ts
  import { EntityMemory } from '../types/entity';
  import { LongTermMemory } from '../types/long-term';
  import { createEmbedding } from '../embeddings';
  import { eventBus } from '../events';
  
  export async function updateEntity(entityId: string, updates: any) {
    const entityMemory = new EntityMemory();
    
    // Get current entity
    const currentEntity = await entityMemory.getEntity(entityId);
    
    // Update entity
    const { data, error } = await supabase
      .from('entities')
      .update({
        ...updates,
        properties: {
          ...currentEntity.properties,
          ...updates.properties
        }
      })
      .eq('id', entityId)
      .select()
      .single();
      
    if (error) {
      throw new Error(`Error updating entity: ${error.message}`);
    }
    
    // Update entity embedding
    await updateEntityEmbedding(entityId, data);
    
    // Emit entity update event
    eventBus.emit('entity_updated', {
      entityId,
      updates
    });
    
    return data;
  }
  
  async function updateEntityEmbedding(entityId: string, entity: any) {
    // Create text representation of entity
    const entityText = `${entity.name}: ${JSON.stringify(entity.properties)}`;
    
    // Create embedding
    const embedding = await createEmbedding(entityText);
    
    // Store embedding
    await supabase
      .from('entity_embeddings')
      .upsert({
        entity_id: entityId,
        embedding,
        updated_at: new Date().toISOString()
      });
  }
  ```

- Implement conversation memory updates
  ```typescript
  // memory/updates/conversation.ts
  import { redis } from '../storage';
  import { extractEntities } from '../utils/entity-extraction';
  import { eventBus } from '../events';
  
  export async function updateConversationMemory(conversationId: string, turn: any) {
    // Add turn to conversation history
    await redis.lpush(
      `conversation:${conversationId}:history`,
      JSON.stringify(turn)
    );
    
    // Keep only recent history
    await redis.ltrim(
      `conversation:${conversationId}:history`,
      0,
      19
    );
    
    // Extract entities from turn
    const entities = await extractEntities([turn.user, turn.system]);
    
    // Update active entities in conversation
    for (const entity of entities) {
      await redis.zadd(
        `conversation:${conversationId}:entities`,
        Date.now(),
        JSON.stringify(entity)
      );
    }
    
    // Set TTL on conversation data (24 hours)
    const CONVERSATION_TTL = 60 * 60 * 24;
    await redis.expire(`conversation:${conversationId}:history`, CONVERSATION_TTL);
    await redis.expire(`conversation:${conversationId}:entities`, CONVERSATION_TTL);
    
    // Emit conversation update event
    eventBus.emit('conversation_updated', {
      conversationId,
      turn,
      entities
    });
  }
  ```

- Create memory consolidation system
  ```typescript
  // memory/updates/consolidation.ts
  import { redis } from '../storage';
  import { supabase } from '../storage';
  import { eventBus } from '../events';
  
  export async function consolidateMemory() {
    // Get conversations that need consolidation
    const conversationsToConsolidate = await getConversationsForConsolidation();
    
    for (const conversationId of conversationsToConsolidate) {
      // Get conversation data
      const conversationData = await getFullConversation(conversationId);
      
      // Extract valuable knowledge
      const knowledgeInsights = await extractKnowledgeInsights(conversationData);
      
      if (knowledgeInsights.length > 0) {
        // Store insights in long-term memory
        await storeConsolidatedKnowledge(knowledgeInsights);
        
        // Mark conversation as consolidated
        await redis.set(
          `conversation:${conversationId}:consolidated`,
          'true',
          'EX',
          60 * 60 * 24 * 30 // 30 days
        );
      }
    }
    
    // Emit consolidation event
    eventBus.emit('memory_consolidated', {
      conversationsProcessed: conversationsToConsolidate.length
    });
  }
  ```

### 5. Memory Integration with Agents

- Create Memory Manager service
  ```typescript
  // memory/MemoryManager.ts
  import { ShortTermMemory } from './types/short-term';
  import { LongTermMemory } from './types/long-term';
  import { EntityMemory } from './types/entity';
  import { UserMemory } from './types/user';
  import { multiStrategyRetrieval } from './retrieval/multi-strategy';
  import { updateKnowledge } from './updates/knowledge';
  import { updateConversationMemory } from './updates/conversation';
  import { updateEntity } from './updates/entity';
  
  export class MemoryManager {
    private shortTerm: ShortTermMemory;
    private longTerm: LongTermMemory;
    private entity: EntityMemory;
    private user: UserMemory;
    
    constructor() {
      this.shortTerm = new ShortTermMemory();
      this.longTerm = new LongTermMemory();
      this.entity = new EntityMemory();
      this.user = new UserMemory();
    }
    
    // Memory retrieval methods
    async retrieveMemory(query: string, options: any = {}) {
      return await multiStrategyRetrieval(query, options);
    }
    
    // Memory update methods
    async updateKnowledgeBase(documents: any[]) {
      return await updateKnowledge(documents);
    }
    
    async updateConversation(conversationId: string, turn: any) {
      return await updateConversationMemory(conversationId, turn);
    }
    
    async updateEntityInfo(entityId: string, updates: any) {
      return await updateEntity(entityId, updates);
    }
    
    // Context management
    async getConversationContext(conversationId: string) {
      const context = await this.shortTerm.getConversationContext(conversationId);
      
      if (!context) {
        // If no context in short-term, build from conversation history
        return await retrieveByContext(conversationId);
      }
      
      return context;
    }
    
    // Working memory for agents
    async getWorkingMemory(agentId: string, taskId: string) {
      return await this.shortTerm.getWorkingMemory(agentId, taskId);
    }
    
    async setWorkingMemory(agentId: string, taskId: string, data: any) {
      return await this.shortTerm.setWorkingMemory(agentId, taskId, data);
    }
    
    // User memory methods
    async getUserMemory(userId: string) {
      return await this.user.getUserProfile(userId);
    }
    
    async updateUserMemory(userId: string, key: string, value: any) {
      return await this.user.updateUserPreference(userId, key, value);
    }
  }
  ```

- Integrate with Controller Agent
  ```typescript
  // agents/controller/index.ts
  import { MemoryManager } from '../../memory/MemoryManager';
  
  export class ControllerAgent {
    private memoryManager: MemoryManager;
    
    constructor() {
      this.memoryManager = new MemoryManager();
    }
    
    async handleRequest(request: any) {
      // Get conversation context from memory
      const context = await this.memoryManager.getConversationContext(
        request.conversationId
      );
      
      // Enhance request with memory context
      const enhancedRequest = {
        ...request,
        context
      };
      
      // Process request through agent workflow
      const response = await this.processRequest(enhancedRequest);
      
      // Update conversation memory
      await this.memoryManager.updateConversation(
        request.conversationId,
        {
          user: request.text,
          system: response.text,
          timestamp: new Date().toISOString()
        }
      );
      
      return response;
    }
  }
  ```

- Integrate with Query Agent
  ```typescript
  // agents/query/index.ts
  import { MemoryManager } from '../../memory/MemoryManager';
  
  export class QueryAgent {
    private memoryManager: MemoryManager;
    
    constructor() {
      this.memoryManager = new MemoryManager();
    }
    
    async processQuery(query: string, options: any) {
      // Create task ID
      const taskId = generateTaskId();
      
      // Initialize working memory for this task
      await this.memoryManager.setWorkingMemory('query', taskId, {
        query,
        status: 'started',
        timestamp: Date.now()
      });
      
      // Retrieve relevant memory
      const relevantMemory = await this.memoryManager.retrieveMemory(query, {
        conversationId: options.conversationId,
        limit: 10
      });
      
      // Generate answer using retrieved memory
      const answer = await this.generateAnswer(query, relevantMemory);
      
      // Extract and store new knowledge
      const newKnowledge = this.extractNewKnowledge(query, answer);
      if (newKnowledge.length > 0) {
        await this.memoryManager.updateKnowledgeBase(newKnowledge);
      }
      
      // Update working memory
      await this.memoryManager.setWorkingMemory('query', taskId, {
        query,
        status: 'completed',
        timestamp: Date.now(),
        result: {
          answer,
          memoryUsed: relevantMemory.length
        }
      });
      
      return answer;
    }
  }
  ```

- Integrate with Retrieval Agent
  ```typescript
  // agents/retrieval/index.ts
  import { MemoryManager } from '../../memory/MemoryManager';
  
  export class RetrievalAgent {
    private memoryManager: MemoryManager;
    
    constructor() {
      this.memoryManager = new MemoryManager();
    }
    
    async retrieve(query: string, options: any) {
      // Get user context if available
      let userContext = null;
      if (options.userId) {
        userContext = await this.memoryManager.getUserMemory(options.userId);
      }
      
      // Enhance query with user context if available
      const enhancedQuery = userContext 
        ? this.enhanceQueryWithUserContext(query, userContext)
        : query;
      
      // Perform retrieval
      const results = await this.memoryManager.retrieveMemory(enhancedQuery, {
        ...options,
        strategy: 'hybrid'
      });
      
      // Track successful retrieval patterns
      await this.memoryManager.setWorkingMemory('retrieval', 'patterns', {
        query,
        strategy: options.strategy || 'hybrid',
        successful: results.length > 0,
        timestamp: Date.now()
      });
      
      return results;
    }
  }
  ```

## Integration with Other Agents

The Memory Management System interfaces with all agents in the system:

1. **Controller Agent** - Uses memory for context and disambiguation
2. **Query Agent** - Retrieves relevant memory for answering questions
3. **Retrieval Agent** - Accesses and updates knowledge structures
4. **Knowledge Processing Agent** - Updates entity memory with new information
5. **Scraper Agent** - Provides new content for memory storage

## References

For detailed Memory Management System architecture, refer to:
- [Memory Management README](../../../src/lib/memory/README.md) 