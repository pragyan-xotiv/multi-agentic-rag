/**
 * Neo4j Knowledge Base Exports
 * 
 * Exports for the LangChain-based Neo4j Knowledge Base.
 */

// Export LangChain Neo4j implementation
export { createLangChainNeo4jKnowledgeBase } from './langchain';
export { getNeo4jConfig, type Neo4jConfig } from './config';

// Re-export types from the base knowledge-base module
export type {
  Entity,
  Relationship,
  KnowledgeBase,
  EntitySearchParams,
  RelationshipSearchParams,
  EntitySearchResult,
  RelationshipSearchResult,
  KnowledgeEntity,
  KnowledgeRelationship
} from '../types'; 