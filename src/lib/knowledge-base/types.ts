/**
 * Knowledge Base Interfaces
 *
 * These interfaces define the structure for entities and relationships
 * in the knowledge base, as well as search parameters and results.
 */
import { Document } from "langchain/document";

// Basic entity structure matching the database schema
export interface Entity {
  id: string;
  name: string;
  type: string;
  properties: Record<string, unknown>;
  sources: string[];
  embedding?: number[];
  confidence: number;
  createdAt?: Date;
  updatedAt?: Date;
}

// Basic relationship structure matching the database schema
export interface Relationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  properties: Record<string, unknown>;
  confidence: number;
  createdAt?: Date;
  updatedAt?: Date;
}

// Entity search parameters
export interface EntitySearchParams {
  query: string;
  types?: string[];
  limit?: number;
  threshold?: number;
  useEmbedding?: boolean;
}

/**
 * Parameters for relationship search
 */
export interface RelationshipSearchParams {
  /**
   * Starting entity IDs for graph traversal
   */
  startEntityIds: string[];
  
  /**
   * Types of relationships to search for (empty = all types)
   */
  types?: string[];
  
  /**
   * Maximum relationship traversal depth
   */
  maxDepth?: number;
  
  /**
   * Maximum number of results to return
   */
  maxResults?: number;
}

// Knowledge entity structure used by the Hybrid Search Chain
export interface KnowledgeEntity {
  id: string;
  type: string;
  name: string;
  properties: Record<string, unknown>;
  description: string;
}

// Knowledge relationship structure used by the Hybrid Search Chain
export interface KnowledgeRelationship {
  id: string;
  type: string;
  source: string;
  target: string;
  properties: Record<string, unknown>;
}

// Interface for entity search results
export interface EntitySearchResult {
  entity: KnowledgeEntity;
  similarity?: number;
}

// Interface for relationship search results
export interface RelationshipSearchResult {
  relationship: KnowledgeRelationship;
  sourceEntity: KnowledgeEntity;
  targetEntity: KnowledgeEntity;
  depth: number;
}

// Knowledge base search methods
export interface KnowledgeBaseSearchMethods {
  searchEntities: (params: EntitySearchParams) => Promise<EntitySearchResult[]>;
  searchRelationships: (params: RelationshipSearchParams) => Promise<RelationshipSearchResult[]>;
}

// Knowledge base CRUD operations
export interface KnowledgeBaseCrudMethods {
  createEntity: (entity: Omit<Entity, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Entity>;
  updateEntity: (id: string, entity: Partial<Entity>) => Promise<Entity>;
  deleteEntity: (id: string) => Promise<boolean>;
  createRelationship: (relationship: Omit<Relationship, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Relationship>;
  updateRelationship: (id: string, relationship: Partial<Relationship>) => Promise<Relationship>;
  deleteRelationship: (id: string) => Promise<boolean>;
}

/**
 * Interface for Knowledge Base implementations
 */
export interface KnowledgeBase {
  /**
   * Search for entities matching a query
   */
  searchEntities(params: EntitySearchParams): Promise<EntitySearchResult[]>;
  
  /**
   * Search for relationships between entities
   */
  searchRelationships(params: RelationshipSearchParams): Promise<RelationshipSearchResult[]>;
  
  /**
   * Search for entities and return results as Documents for retrieval chains
   */
  searchEntitiesForDocuments(
    query: string,
    options: {
      types?: string[];
      limit?: number;
      threshold?: number;
    }
  ): Promise<Document[]>;
  
  /**
   * Search for entity relationships and return results as Documents for retrieval chains
   */
  searchGraphForDocuments(
    query: string,
    options: {
      entityTypes?: string[];
      relationshipTypes?: string[];
      depth?: number;
      maxResults?: number;
      threshold?: number;
    }
  ): Promise<Document[]>;
  
  /**
   * Create a new entity
   */
  createEntity(entity: Omit<Entity, 'id' | 'createdAt' | 'updatedAt'>): Promise<Entity>;
  
  /**
   * Update an existing entity
   */
  updateEntity(id: string, entity: Partial<Entity>): Promise<Entity>;
  
  /**
   * Delete an entity
   */
  deleteEntity(id: string): Promise<boolean>;
  
  /**
   * Create a new relationship
   */
  createRelationship(relationship: Omit<Relationship, 'id' | 'createdAt' | 'updatedAt'>): Promise<Relationship>;
  
  /**
   * Update an existing relationship
   */
  updateRelationship(id: string, relationship: Partial<Relationship>): Promise<Relationship>;
  
  /**
   * Delete a relationship
   */
  deleteRelationship(id: string): Promise<boolean>;
  
  /**
   * Get an entity by ID
   */
  getEntityById(id: string): Promise<Entity | null>;
  
  /**
   * Get a relationship by ID
   */
  getRelationshipById(id: string): Promise<Relationship | null>;
  
  /**
   * Search for entities by name
   */
  searchEntitiesByName(name: string, type?: string): Promise<Entity[]>;

  /**
   * Initialize the knowledge base (optional)
   */
  initialize?(dimensions?: number): Promise<void>;
  
  /**
   * Close any open connections (optional)
   */
  close?(): Promise<void>;
} 