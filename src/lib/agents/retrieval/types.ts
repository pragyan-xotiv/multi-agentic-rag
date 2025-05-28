/**
 * Types and interfaces for the Retrieval Agent
 */

// Method types for retrieval operations
export enum RetrievalMethodType {
  VECTOR = 'vector',
  KEYWORD = 'keyword',
  ENTITY = 'entity',
  GRAPH = 'graph'
}

// Basic retrieval method interface
export interface RetrievalMethod {
  type: RetrievalMethodType;
  parameters: Record<string, unknown>;
  priority: number;
}

// Result types
export interface VectorResult {
  content: string;
  metadata: Record<string, unknown>;
  score: number;
}

export interface KeywordResult {
  content: string;
  metadata: Record<string, unknown>;
  matches: string[];
}

export interface EntityResult {
  entity: string;
  type: string;
  references: { content: string; metadata: Record<string, unknown> }[];
}

export interface GraphResult {
  nodes: { id: string; type: string; properties: Record<string, unknown> }[];
  edges: { source: string; target: string; type: string; properties: Record<string, unknown> }[];
}

// Processed result types
export interface RetrievedChunk {
  content: string;
  metadata: Record<string, unknown>;
  relevanceScore: number;
  source: string;
}

export interface Entity {
  name: string;
  type: string;
  references: string[];
}

export interface Relationship {
  source: string;
  target: string;
  type: string;
  evidence: string[];
}

// Main state interface for the Retrieval Agent
export interface RetrievalAgentState {
  retrievalRequest: {
    type: string;
    parameters: Record<string, unknown>;
    query: string;
    filters?: Record<string, unknown>;
    requiredSources?: string[];
  };
  requestAnalysis: {
    entityTypes: string[];
    semanticAspects: string[];
    structuralNeeds: string[];
    complexityScore: number;
  };
  retrievalMethods: RetrievalMethod[];
  rawResults: {
    vectorResults: VectorResult[];
    keywordResults: KeywordResult[];
    entityResults: EntityResult[];
    graphResults: GraphResult[];
  };
  processedResults: {
    chunks: RetrievedChunk[];
    entities: Entity[];
    relationships: Relationship[];
  };
  resultEvaluation: {
    relevanceScore: number;
    coverageScore: number;
    confidenceScore: number;
    feedback: string;
  };
} 