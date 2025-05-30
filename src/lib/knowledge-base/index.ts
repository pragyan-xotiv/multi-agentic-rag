/**
 * Knowledge Base Module
 * 
 * This is the main entry point for the Neo4j knowledge base module using LangChain.
 */

// Export the Neo4j implementation
export {
  createLangChainNeo4jKnowledgeBase as createNeo4jKnowledgeBase,
  getNeo4jConfig,
  type Neo4jConfig
} from './neo4j/exports';

// Export all types
export type {
  Entity,
  Relationship,
  KnowledgeBase,
  EntitySearchParams,
  RelationshipSearchParams,
  EntitySearchResult,
  RelationshipSearchResult,
  KnowledgeEntity,
  KnowledgeRelationship,
  KnowledgeBaseSearchMethods,
  KnowledgeBaseCrudMethods
} from './types'; 