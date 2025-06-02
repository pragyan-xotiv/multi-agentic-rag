/**
 * Types for the Knowledge Processing Agent
 */
import { ScraperOutput } from "../scraper/types";

/**
 * Raw content input for the knowledge processor
 */
export interface KnowledgeProcessingInput {
  content: string | ScraperOutput;
  contentType: string;
  source: string;
  metadata?: Record<string, string | number | boolean>;
  options?: Record<string, string | number | boolean | string[]>;
}

/**
 * Options for knowledge processing
 */
export type KnowledgeProcessingOptions = Record<string, string | number | boolean | string[]>;

/**
 * Entity representation
 */
export interface Entity {
  id: string;
  name: string;
  type: string;
  properties: Record<string, string | number | boolean>;
  sources: string[];
  confidence: number;
  embedding?: number[];
  sourceLocations: SourceLocation[];
}

/**
 * Relationship between entities
 */
export interface Relationship {
  id: string;
  source: string; // Source entity ID
  target: string; // Target entity ID
  type: string;
  properties: Record<string, string | number | boolean>;
  confidence: number;
  sourceLocations: SourceLocation[];
}

/**
 * Source location in the original content
 */
export interface SourceLocation {
  startChar: number;
  endChar: number;
  context: string;
}

/**
 * Content chunk for storage and retrieval
 */
export interface ContentChunk {
  id: string;
  content: string;
  embedding: number[];
  metadata: {
    source: string;
    startChar: number;
    endChar: number;
    entities: string[];
  };
}

/**
 * Content analysis result
 */
export interface ContentAnalysis {
  contentType: string;
  domainSpecific: boolean;
  complexity: number;
  structuredDataTypes: string[];
  mainTopics: string[];
  estimatedEntitiesCount: number;
}

/**
 * Processing strategy
 */
export interface ProcessingStrategy {
  chunkingMethod: "semantic" | "fixed" | "hierarchical" | "dialogue";
  chunkSize: number;
  overlapSize: number;
  entityExtractionApproach: "general" | "domain-specific" | "hybrid";
  relationshipDiscoveryMethod: "co-occurrence" | "explicit" | "inference" | "combined";
  embeddingModel: string;
}

/**
 * Knowledge processing result
 */
export interface ProcessingResult {
  entities: Entity[];
  relationships: Relationship[];
  chunks: ContentChunk[];
  metadata: {
    processingTime: number;
    contentLength: number;
    contentType: string;
    extractionQuality: number;
  };
}

/**
 * Knowledge processing agent state
 */
export interface KnowledgeAgentState {
  // Input state
  rawContent: string | ScraperOutput;
  processingGoal: string;
  processingOptions: KnowledgeProcessingOptions;
  
  // Analysis state
  contentAnalysis?: ContentAnalysis;
  processingStrategy?: ProcessingStrategy;
  
  // Processing state
  processedContent?: string[];
  entities: Entity[];
  relationships: Relationship[];
  chunks: ContentChunk[];
  
  // Metrics and output
  processingMetrics: {
    documentCount: number;
    entityCount: number;
    relationshipCount: number;
    processingStage: string;
    validationScore: number;
  };
  
  // Final output
  structuredKnowledge?: ProcessingResult;
} 