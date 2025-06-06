/**
 * Type definitions for the Hybrid Search Chain
 */
import { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { KnowledgeBase as KnowledgeBaseInterface } from "../../knowledge-base/types";

/**
 * Input interface for the Hybrid Search Chain
 */
export interface HybridSearchInput {
  query: string;
  filters?: Record<string, unknown>; // Optional metadata filters
  analysisOptions?: {
    considerEntities?: boolean;
    considerRelationships?: boolean;
  };
  methodOptions?: {
    vector?: {
      enabled?: boolean;
      k?: number;
      similarityThreshold?: number;
    };
    keyword?: {
      enabled?: boolean;
      k?: number;
    };
    entity?: {
      enabled?: boolean;
      types?: string[];
      k?: number;
    };
    graph?: {
      enabled?: boolean;
      depth?: number;
      entityTypes?: string[];
      relationshipTypes?: string[];
      maxResults?: number;
    };
  };
}

/**
 * Search method types
 */
export type RetrievalMethodType = 'vector' | 'keyword' | 'entity' | 'graph';

/**
 * Retrieval method type and configuration
 */
export interface RetrievalMethod {
  type: RetrievalMethodType;
  parameters: Record<string, unknown>;
  priority: number;
}

/**
 * Individual search result
 */
export interface HybridSearchResult {
  content: string;
  metadata: Record<string, unknown>;
  score: number;
  source: string; // Which method found this result
}

/**
 * Output interface for the Hybrid Search Chain
 */
export interface HybridSearchOutput {
  results: HybridSearchResult[];
  methodsUsed: string[];
  metrics: {
    methodCounts: Record<string, number>;
    timings: Record<string, number>;
    totalResults: number;
  };
}

/**
 * Entity object returned from knowledge base
 */
export interface KnowledgeEntity {
  id: string;
  type: string;
  name: string;
  properties: Record<string, unknown>;
  description: string;
}

/**
 * Relationship object returned from knowledge base
 */
export interface KnowledgeRelationship {
  id: string;
  type: string;
  source: string;
  target: string;
  properties: Record<string, unknown>;
}

/**
 * Configuration for the Hybrid Search Chain
 */
export interface HybridSearchChainConfig {
  vectorStore: SupabaseVectorStore;
  supabaseClient: SupabaseClient;
  knowledgeBase?: KnowledgeBaseInterface;
  defaultLimit?: number;
} 