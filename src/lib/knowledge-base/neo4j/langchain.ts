/**
 * Neo4j Knowledge Base Implementation using LangChain
 *
 * This implementation leverages LangChain's Neo4jVectorStore to simplify
 * vector search and graph operations.
 */
import { v4 as uuidv4 } from 'uuid';
import { Neo4jVectorStore } from "@langchain/community/vectorstores/neo4j_vector";
import { Embeddings } from "@langchain/core/embeddings";
import { Document } from "langchain/document";
import { createEmbeddings } from '../../langchain';
import {
  Entity,
  Relationship,
  KnowledgeBase,
  EntitySearchParams,
  RelationshipSearchParams,
  EntitySearchResult,
  RelationshipSearchResult,
  KnowledgeEntity
} from '../types';
import { Neo4jConfig } from './config';

/**
 * Convert a Neo4j entity to a KnowledgeEntity
 */
function toKnowledgeEntity(entity: Record<string, string | number | Record<string, unknown>>): KnowledgeEntity {
  const properties = typeof entity.properties === 'object' && entity.properties !== null 
    ? entity.properties as Record<string, unknown>
    : {};
    
  return {
    id: String(entity.id),
    type: String(entity.type),
    name: String(entity.name),
    properties,
    description: (properties.description as string) || ''
  };
}

/**
 * Type for Neo4j record from query
 */
interface Neo4jRecord {
  get: (key: string) => {
    properties: Record<string, string | number | Record<string, unknown>>;
    type?: string;
    segments?: Array<{
      relationship: {
        type: string;
        properties: Record<string, unknown>;
      };
      start: {
        properties: Record<string, string | number | Record<string, unknown>>;
      };
      end: {
        properties: Record<string, string | number | Record<string, unknown>>;
      };
    }>;
  };
}

/**
 * Type for Neo4j query result
 */
interface Neo4jQueryResult {
  records: Neo4jRecord[];
}

/**
 * Extended Neo4jVectorStore type that includes the client property
 */
interface ExtendedNeo4jVectorStore extends Neo4jVectorStore {
  client: {
    query: (query: string, params: Record<string, unknown>) => Promise<Neo4jQueryResult>;
  };
}

/**
 * Knowledge Base implementation using Neo4j with LangChain integration
 */
export class LangChainNeo4jKnowledgeBase implements KnowledgeBase {
  private vectorStore!: ExtendedNeo4jVectorStore;
  private embeddings: Embeddings;
  private config: Neo4jConfig;
  
  constructor(config: Neo4jConfig, embeddings?: Embeddings) {
    this.config = config;
    this.embeddings = embeddings || createEmbeddings();
  }
  
  /**
   * Initialize the database and vector store
   */
  async initialize(): Promise<void> {
    // Initialize Neo4jVectorStore
    this.vectorStore = await Neo4jVectorStore.fromExistingIndex(
      this.embeddings,
      {
        url: this.config.uri,
        username: this.config.username,
        password: this.config.password,
        database: this.config.database,
        nodeLabel: "Entity",
        textNodeProperty: "name",
        embeddingNodeProperty: "embedding",
        keywordIndexName: "entity_name_index"
      }
    ) as ExtendedNeo4jVectorStore;
    
    // Create necessary indexes using vectorStore's client
    const createIndexQueries = [
      'CREATE INDEX IF NOT EXISTS FOR (e:Entity) ON (e.id)',
      'CREATE INDEX IF NOT EXISTS FOR (e:Entity) ON (e.name)',
      'CREATE INDEX IF NOT EXISTS FOR (e:Entity) ON (e.type)'
    ];
    
    for (const query of createIndexQueries) {
      await this.vectorStore.client.query(query, {});
    }
  }
  
  /**
   * Close database connections - no longer needed as Neo4jVectorStore manages connections
   */
  async close(): Promise<void> {
    // Neo4jVectorStore manages its own connections
  }
  
  /**
   * Search for entities matching a query
   */
  async searchEntities(params: EntitySearchParams): Promise<EntitySearchResult[]> {
    const { query, types = [], limit = 10, useEmbedding = true } = params;
    
    try {
      let results: EntitySearchResult[] = [];
      
      if (useEmbedding) {
        // Use Neo4jVectorStore for similarity search
        const searchFilter = types.length > 0 
          ? `e.type IN [${types.map(t => `'${t}'`).join(', ')}]` 
          : '';
        
        const docs = await this.vectorStore.similaritySearch(
          query,
          limit,
          searchFilter ? { filter: searchFilter } : undefined
        );
        
        // Convert to EntitySearchResult format
        results = docs.map(doc => {
          const metadata = doc.metadata;
          return {
            entity: {
              id: metadata.id,
              type: metadata.type,
              name: metadata.name,
              properties: metadata.properties || {},
              description: metadata.properties?.description || ''
            },
            similarity: metadata.score
          };
        });
      } else {
        // Use text search for name-based queries using vectorStore's client
        const queryText = `
          MATCH (e:Entity)
          WHERE e.name CONTAINS $query
          ${types.length > 0 ? 'AND e.type IN $types' : ''}
          RETURN e
          LIMIT $limit
        `;
        
        const result = await this.vectorStore.client.query(queryText, { 
          query, 
          types: types.length > 0 ? types : null,
          limit 
        });
        
        // Process results
        results = result.records.map((record) => {
          const node = record.get('e').properties;
          const properties = typeof node.properties === 'object' && node.properties !== null
            ? node.properties as Record<string, unknown>
            : {};
            
          return {
            entity: {
              id: String(node.id),
              type: String(node.type),
              name: String(node.name),
              properties,
              description: (properties.description as string) || ''
            }
          };
        });
      }
      
      return results;
    } catch (error) {
      console.error('Error searching entities:', error);
      return [];
    }
  }
  
  /**
   * Search for entities and convert to Document format for retrieval chains
   */
  async searchEntitiesForDocuments(
    query: string,
    options: {
      types?: string[];
      limit?: number;
      threshold?: number;
    }
  ): Promise<Document[]> {
    const entitySearchParams: EntitySearchParams = {
      query,
      types: options.types || [],
      limit: options.limit || 5,
      threshold: options.threshold || 0.7
    };
    
    const entityResults = await this.searchEntities(entitySearchParams);
    
    // Convert entity results to documents
    return entityResults.map((result: EntitySearchResult) => {
      const { entity } = result;
      return new Document({
        pageContent: entity.description || `${entity.name} (${entity.type})`,
        metadata: {
          id: entity.id,
          type: entity.type,
          name: entity.name,
          score: result.similarity || 0.8,
          source: `entity:${entity.type}`,
          properties: entity.properties
        }
      });
    });
  }
  
  /**
   * Search for relationships between entities
   */
  async searchRelationships(params: RelationshipSearchParams): Promise<RelationshipSearchResult[]> {
    const { 
      startEntityIds, 
      types = [], 
      maxDepth = 2, 
      maxResults = 100 
    } = params;
    
    try {
      const typeFilter = types.length > 0 
        ? `AND ALL(r IN relationships(path) WHERE type(r) IN [${types.map(t => `'${t}'`).join(', ')}])` 
        : '';
      
      const queryText = `
        MATCH path = (source:Entity)-[*1..${maxDepth}]->(target:Entity)
        WHERE source.id IN $startIds
        ${typeFilter}
        RETURN path, length(path) AS depth
        LIMIT $maxResults
      `;
      
      const result = await this.vectorStore.client.query(queryText, { 
        startIds: startEntityIds,
        maxResults
      });
      
      const relationships: RelationshipSearchResult[] = [];
      
      for (const record of result.records) {
        const path = record.get('path');
        const depth = record.get('depth');
        
        // Process the path to extract relationships and nodes
        if (path.segments) {
          for (const segment of path.segments) {
            const relationship = segment.relationship;
            const sourceNode = segment.start;
            const targetNode = segment.end;
            
            // Ensure properties is a valid object
            const relProperties = typeof relationship.properties === 'object' && relationship.properties !== null
              ? relationship.properties
              : {};
              
            relationships.push({
              relationship: {
                id: String(relProperties.id || ''),
                type: relationship.type || '',
                source: String(sourceNode.properties.id || ''),
                target: String(targetNode.properties.id || ''),
                properties: relProperties
              },
              sourceEntity: toKnowledgeEntity(sourceNode.properties),
              targetEntity: toKnowledgeEntity(targetNode.properties),
              depth: Number(depth)
            });
          }
        }
      }
      
      return relationships;
    } catch (error) {
      console.error('Error searching relationships:', error);
      return [];
    }
  }
  
  /**
   * Search graph relationships and convert to Document format for retrieval chains
   */
  async searchGraphForDocuments(
    query: string,
    options: {
      entityTypes?: string[];
      relationshipTypes?: string[];
      depth?: number;
      maxResults?: number;
      threshold?: number;
    }
  ): Promise<Document[]> {
    // First, find entities related to the query
    const entitySearchParams: EntitySearchParams = {
      query,
      limit: 5,
      threshold: options.threshold || 0.6,
      types: options.entityTypes || []
    };
    
    const entityResults = await this.searchEntities(entitySearchParams);
    
    if (entityResults.length === 0) {
      return [];
    }
    
    // Get starting entity IDs
    const startEntityIds = entityResults.map((result: EntitySearchResult) => result.entity.id);
    
    // Create relationship search parameters
    const relationshipSearchParams: RelationshipSearchParams = {
      startEntityIds,
      types: options.relationshipTypes || [],
      maxDepth: options.depth || 2,
      maxResults: options.maxResults || 20
    };
    
    // Execute graph search
    const relationshipResults = await this.searchRelationships(relationshipSearchParams);
    
    // Convert relationship results to documents with richer metadata
    const results = relationshipResults.map((result: RelationshipSearchResult) => {
      const { relationship, sourceEntity, targetEntity, depth } = result;
      
      // Create a descriptive content string
      const content = `${sourceEntity.name} (${sourceEntity.type}) → ${relationship.type} → ${targetEntity.name} (${targetEntity.type})`;
      
      // Add more context if available in properties
      const contextDetails: string[] = [];
      if (relationship.properties) {
        Object.entries(relationship.properties).forEach(([key, value]) => {
          if (key !== 'id' && key !== 'createdAt' && key !== 'updatedAt') {
            contextDetails.push(`${key}: ${String(value)}`);
          }
        });
      }
      
      const enhancedContent = contextDetails.length > 0 
        ? `${content}\nDetails: ${contextDetails.join(', ')}`
        : content;
      
      // Create document with detailed metadata
      return new Document({
        pageContent: enhancedContent,
        metadata: {
          id: relationship.id,
          type: 'relationship',
          relationshipType: relationship.type,
          // Source entity info
          sourceId: sourceEntity.id,
          sourceName: sourceEntity.name,
          sourceType: sourceEntity.type,
          sourceProperties: sourceEntity.properties,
          // Target entity info
          targetId: targetEntity.id,
          targetName: targetEntity.name,
          targetType: targetEntity.type,
          targetProperties: targetEntity.properties,
          // Relationship info
          properties: relationship.properties,
          // Scoring and source info
          score: 0.8 + (0.2 / Math.max(1, depth)),
          source: 'graph',
          depth
        }
      });
    });
    
    // If we found related entities but no relationships,
    // include the entities themselves as results
    if (results.length === 0 && entityResults.length > 0) {
      return entityResults.map((result: EntitySearchResult) => {
        const { entity } = result;
        return new Document({
          pageContent: `Found entity: ${entity.name} (${entity.type})${entity.description ? `\nDescription: ${entity.description}` : ''}`,
          metadata: {
            id: entity.id,
            type: entity.type,
            name: entity.name,
            score: result.similarity || 0.7,
            source: 'graph:entity',
            properties: entity.properties
          }
        });
      });
    }
    
    return results;
  }
  
  /**
   * Create a new entity
   */
  async createEntity(entity: Omit<Entity, 'id' | 'createdAt' | 'updatedAt'>): Promise<Entity> {
    const id = uuidv4();
    const now = new Date();
    
    // Create properties object for Neo4j
    const newEntity: Entity = {
      ...entity,
      id,
      createdAt: now,
      updatedAt: now
    };
    
    // Generate embedding if not provided
    if (!newEntity.embedding && entity.name) {
      const embeddings = await this.embeddings.embedDocuments([entity.name]);
      newEntity.embedding = embeddings[0];
    }
    
    // Create entity using vectorStore's client
    const query = `
      CREATE (e:Entity {
        id: $id,
        name: $name,
        type: $type,
        properties: $properties,
        sources: $sources,
        embedding: $embedding,
        confidence: $confidence,
        createdAt: datetime($createdAt),
        updatedAt: datetime($updatedAt)
      })
      RETURN e
    `;
    
    const params = {
      id: newEntity.id,
      name: newEntity.name,
      type: newEntity.type,
      properties: newEntity.properties || {},
      sources: newEntity.sources || [],
      embedding: newEntity.embedding,
      confidence: newEntity.confidence,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };
    
    const result = await this.vectorStore.client.query(query, params);
    
    if (result.records.length === 0) {
      throw new Error('Failed to create entity');
    }
    
    return newEntity;
  }
  
  /**
   * Get an entity by ID
   */
  async getEntityById(id: string): Promise<Entity | null> {
    const query = `
      MATCH (e:Entity {id: $id})
      RETURN e
    `;
    
    const result = await this.vectorStore.client.query(query, { id });
    
    if (result.records.length === 0) {
      return null;
    }
    
    const entityNode = result.records[0].get('e');
    const entity = entityNode.properties;
    
    // Ensure properties is a valid object
    const properties = typeof entity.properties === 'object' && entity.properties !== null
      ? entity.properties as Record<string, unknown>
      : {};
    
    // Convert date strings to Date objects
    return {
      id: String(entity.id),
      name: String(entity.name),
      type: String(entity.type),
      properties,
      sources: Array.isArray(entity.sources) ? entity.sources : [],
      confidence: Number(entity.confidence),
      embedding: Array.isArray(entity.embedding) ? entity.embedding : undefined,
      createdAt: new Date(String(entity.createdAt)),
      updatedAt: new Date(String(entity.updatedAt))
    };
  }
  
  /**
   * Update an existing entity
   */
  async updateEntity(id: string, entity: Partial<Entity>): Promise<Entity> {
    // Get current entity
    const currentEntity = await this.getEntityById(id);
    
    if (!currentEntity) {
      throw new Error(`Entity with ID ${id} not found`);
    }
    
    const now = new Date();
    
    // Create updated entity
    const updatedEntity: Entity = {
      ...currentEntity,
      ...entity,
      id, // Ensure ID doesn't change
      updatedAt: now
    };
    
    // Generate embedding if name changed and embedding not provided
    if (entity.name && !entity.embedding) {
      const embeddings = await this.embeddings.embedDocuments([entity.name]);
      updatedEntity.embedding = embeddings[0];
    }
    
    // Update entity using vectorStore's client
    const query = `
      MATCH (e:Entity {id: $id})
      SET e.name = $name,
          e.type = $type,
          e.properties = $properties,
          e.sources = $sources,
          e.embedding = $embedding,
          e.confidence = $confidence,
          e.updatedAt = datetime($updatedAt)
      RETURN e
    `;
    
    const params = {
      id: updatedEntity.id,
      name: updatedEntity.name,
      type: updatedEntity.type,
      properties: updatedEntity.properties || {},
      sources: updatedEntity.sources || [],
      embedding: updatedEntity.embedding,
      confidence: updatedEntity.confidence,
      updatedAt: now.toISOString()
    };
    
    const result = await this.vectorStore.client.query(query, params);
    
    if (result.records.length === 0) {
      throw new Error(`Failed to update entity with ID ${id}`);
    }
    
    return updatedEntity;
  }
  
  /**
   * Delete an entity
   */
  async deleteEntity(id: string): Promise<boolean> {
    const query = `
      MATCH (e:Entity {id: $id})
      DETACH DELETE e
      RETURN count(e) AS deleted
    `;
    
    const result = await this.vectorStore.client.query(query, { id });
    
    return Number(result.records[0].get('deleted')) > 0;
  }
  
  /**
   * Create a new relationship
   */
  async createRelationship(relationship: Omit<Relationship, 'id' | 'createdAt' | 'updatedAt'>): Promise<Relationship> {
    const id = uuidv4();
    const now = new Date();
    
    // Create properties object for Neo4j
    const newRelationship: Relationship = {
      ...relationship,
      id,
      createdAt: now,
      updatedAt: now
    };
    
    // Create relationship using vectorStore's client
    const query = `
      MATCH (source:Entity {id: $sourceId})
      MATCH (target:Entity {id: $targetId})
      CREATE (source)-[r:${relationship.type} {
        id: $id,
        properties: $properties,
        confidence: $confidence,
        createdAt: datetime($createdAt),
        updatedAt: datetime($updatedAt)
      }]->(target)
      RETURN r
    `;
    
    const params = {
      id: newRelationship.id,
      sourceId: newRelationship.sourceId,
      targetId: newRelationship.targetId,
      properties: newRelationship.properties || {},
      confidence: newRelationship.confidence,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };
    
    const result = await this.vectorStore.client.query(query, params);
    
    if (result.records.length === 0) {
      throw new Error('Failed to create relationship');
    }
    
    return newRelationship;
  }
  
  /**
   * Get a relationship by ID
   */
  async getRelationshipById(id: string): Promise<Relationship | null> {
    const query = `
      MATCH ()-[r {id: $id}]->()
      RETURN r, startNode(r) AS source, endNode(r) AS target
    `;
    
    const result = await this.vectorStore.client.query(query, { id });
    
    if (result.records.length === 0) {
      return null;
    }
    
    const record = result.records[0];
    const relationship = record.get('r');
    const source = record.get('source');
    const target = record.get('target');
    
    // Ensure properties is a valid object
    const properties = typeof relationship.properties.properties === 'object' && relationship.properties.properties !== null
      ? relationship.properties.properties
      : {};
    
    return {
      id: String(relationship.properties.id),
      sourceId: String(source.properties.id),
      targetId: String(target.properties.id),
      type: String(relationship.type),
      properties,
      confidence: Number(relationship.properties.confidence),
      createdAt: new Date(String(relationship.properties.createdAt)),
      updatedAt: new Date(String(relationship.properties.updatedAt))
    };
  }
  
  /**
   * Update an existing relationship
   */
  async updateRelationship(id: string, relationship: Partial<Relationship>): Promise<Relationship> {
    // Get current relationship
    const currentRelationship = await this.getRelationshipById(id);
    
    if (!currentRelationship) {
      throw new Error(`Relationship with ID ${id} not found`);
    }
    
    const now = new Date();
    
    // Create updated relationship
    const updatedRelationship: Relationship = {
      ...currentRelationship,
      ...relationship,
      id, // Ensure ID doesn't change
      updatedAt: now
    };
    
    // Update relationship using vectorStore's client
    const query = `
      MATCH ()-[r {id: $id}]->()
      SET r.properties = $properties,
          r.confidence = $confidence,
          r.updatedAt = datetime($updatedAt)
      RETURN r
    `;
    
    const params = {
      id,
      properties: updatedRelationship.properties || {},
      confidence: updatedRelationship.confidence,
      updatedAt: now.toISOString()
    };
    
    const result = await this.vectorStore.client.query(query, params);
    
    if (result.records.length === 0) {
      throw new Error(`Failed to update relationship with ID ${id}`);
    }
    
    return updatedRelationship;
  }
  
  /**
   * Delete a relationship
   */
  async deleteRelationship(id: string): Promise<boolean> {
    const query = `
      MATCH ()-[r {id: $id}]->()
      DELETE r
      RETURN count(r) AS deleted
    `;
    
    const result = await this.vectorStore.client.query(query, { id });
    
    return Number(result.records[0].get('deleted')) > 0;
  }
  
  /**
   * Search for entities by name
   */
  async searchEntitiesByName(name: string, type?: string): Promise<Entity[]> {
    const query = `
      MATCH (e:Entity)
      WHERE e.name CONTAINS $name
      ${type ? 'AND e.type = $type' : ''}
      RETURN e
      LIMIT 10
    `;
    
    const result = await this.vectorStore.client.query(query, { 
      name,
      type
    });
    
    return result.records.map((record) => {
      const entity = record.get('e').properties;
      
      // Ensure properties is a valid object
      const properties = typeof entity.properties === 'object' && entity.properties !== null
        ? entity.properties as Record<string, unknown>
        : {};
        
      return {
        id: String(entity.id),
        name: String(entity.name),
        type: String(entity.type),
        properties,
        sources: Array.isArray(entity.sources) ? entity.sources : [],
        confidence: Number(entity.confidence),
        embedding: Array.isArray(entity.embedding) ? entity.embedding : undefined,
        createdAt: new Date(String(entity.createdAt)),
        updatedAt: new Date(String(entity.updatedAt))
      };
    });
  }
}

/**
 * Create a LangChain Neo4j Knowledge Base
 */
export function createLangChainNeo4jKnowledgeBase(
  config: Neo4jConfig, 
  embeddings?: Embeddings
): KnowledgeBase {
  return new LangChainNeo4jKnowledgeBase(config, embeddings);
}

export * from './config'; 