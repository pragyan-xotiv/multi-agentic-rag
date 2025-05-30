import {
  RetrievalAgentState,
  EntityResult,
  GraphResult,
  VectorResult,
  KeywordResult
} from "./types";
import { createVectorStore } from "../../vectorstore";
import supabaseClient from "../../supabase/client";
import createHybridSearchChain, { HybridSearchInput } from "../../chains/hybrid-search-chain";
import { analyzeQueryForSearchOptions } from "./analysis";

/**
 * Helper interface for result consolidation
 */
interface ConsolidatedResult {
  content: string;
  metadata: Record<string, unknown>;
  score?: number;
  matches?: string[];
  source: string;
}

/**
 * Executes hybrid search using the Hybrid Search Chain
 */
export async function executeHybridSearch(state: RetrievalAgentState): Promise<Partial<RetrievalAgentState>> {
  const { retrievalRequest, requestAnalysis } = state;
  const { query, filters } = retrievalRequest;
  
  // Create necessary objects for the hybrid search chain
  const vectorStore = await createVectorStore(supabaseClient);
  
  // Create the chain
  const hybridChain = createHybridSearchChain({
    vectorStore,
    supabaseClient,
    // knowledgeBase will be added later when implemented
  });
  
  // Prepare input with analysis options from request analysis
  const analysisOptions = analyzeQueryForSearchOptions(
    query, 
    requestAnalysis.entityTypes, 
    requestAnalysis.structuralNeeds
  );
  
  const input: HybridSearchInput = {
    query,
    filters,
    analysisOptions
  };
  
  // Execute the chain
  const results = await hybridChain.invoke(input);
  console.log(`Hybrid search completed with ${results.results.length} results from ${results.methodsUsed.join(', ')} methods`);
  
  // Convert the results to the format expected by the Retrieval Agent
  const vectorResults: VectorResult[] = [];
  const keywordResults: KeywordResult[] = [];
  const entityResults: EntityResult[] = [];
  const graphResults: GraphResult[] = [];
  
  // Map results to the appropriate categories based on source
  results.results.forEach(result => {
    if (result.source === 'vector') {
      vectorResults.push({
        content: result.content,
        metadata: result.metadata,
        score: result.score
      });
    } else if (result.source === 'keyword') {
      keywordResults.push({
        content: result.content,
        metadata: result.metadata,
        matches: query.split(/\s+/).filter(t => t.length > 2) // Simple tokenization
      });
    } else if (result.source.startsWith('entity')) {
      // For future entity search integration
      const entityType = result.source.split(':')[1] || 'unknown';
      
      // Find an existing entity result or create a new one
      let entityResult = entityResults.find(e => e.entity === entityType);
      if (!entityResult) {
        entityResult = {
          entity: entityType,
          type: entityType,
          references: []
        };
        entityResults.push(entityResult);
      }
      
      // Add the reference
      entityResult.references.push({
        content: result.content,
        metadata: result.metadata
      });
    } else if (result.source === 'graph') {
      // For future graph search integration
      const nodeId = result.metadata.id as string || 'unknown';
      const nodeType = result.metadata.type as string || 'unknown';
      
      // Add a simple node to graph results
      graphResults.push({
        nodes: [{
          id: nodeId,
          type: nodeType,
          properties: result.metadata
        }],
        edges: []
      });
    }
  });
  
  // Create processed results for the next steps
  const chunks = results.results.map(result => ({
    content: result.content,
    metadata: result.metadata,
    relevanceScore: result.score,
    source: result.source
  }));
  
  return {
    // Save the raw results for reference
    rawResults: {
      vectorResults,
      keywordResults,
      entityResults,
      graphResults
    },
    // Provide already processed results for evaluation
    processedResults: {
      chunks,
      entities: [],
      relationships: []
    }
  };
}

/**
 * Rank and filter the raw search results
 */
export async function rankAndFilterResults(state: RetrievalAgentState): Promise<Partial<RetrievalAgentState>> {
  const { rawResults, retrievalRequest } = state;
  const { query } = retrievalRequest;
  
  // Extract all results into a consolidated format
  // Cast each type to ensure it conforms to ConsolidatedResult
  const allResults: ConsolidatedResult[] = [
    ...rawResults.vectorResults.map((r): ConsolidatedResult => ({ ...r, source: 'vector' })),
    ...rawResults.keywordResults.map((r): ConsolidatedResult => ({ ...r, source: 'keyword' })),
    // For these types, we need to ensure they have the expected shape
    ...rawResults.entityResults
      .filter((r): r is EntityResult => 'entity' in r)
      .flatMap((r): ConsolidatedResult[] => 
        r.references.map(ref => ({ 
          content: ref.content,
          metadata: ref.metadata,
          source: `entity:${r.entity}`
        }))
      ),
    ...rawResults.graphResults
      .filter((r): r is GraphResult => 'nodes' in r)
      .flatMap((r): ConsolidatedResult[] => 
        r.nodes
          .filter(node => 'properties' in node)
          .map(node => ({
            content: JSON.stringify(node.properties),
            metadata: { id: node.id, type: node.type },
            source: 'graph'
          }))
      )
  ];
  
  // If we have very few results, just return them all
  if (allResults.length <= 3) {
    const chunks = allResults.map(r => ({
      content: r.content,
      metadata: r.metadata,
      relevanceScore: r.score || 0.5,
      source: r.source
    }));
    
    return {
      processedResults: {
        chunks,
        entities: [],
        relationships: []
      }
    };
  }
  
  // Simple deduplication based on content
  const uniqueContents = new Set<string>();
  const deduplicated = allResults.filter(r => {
    const content = r.content.trim();
    if (uniqueContents.has(content)) return false;
    uniqueContents.add(content);
    return true;
  });
  
  // Compute basic relevance by counting query terms in the content
  const chunks = deduplicated.map(r => {
    let relevanceScore = r.score || 0.5;
    
    // If no score is provided, calculate a basic one
    if (!r.score) {
      const queryTerms = query.toLowerCase().split(/\s+/);
      const contentLower = r.content.toLowerCase();
      
      let termMatches = 0;
      for (const term of queryTerms) {
        if (term.length > 2 && contentLower.includes(term)) {
          termMatches++;
        }
      }
      
      relevanceScore = queryTerms.length > 0 
        ? termMatches / queryTerms.length 
        : 0.5;
    }
    
    return {
      content: r.content,
      metadata: r.metadata,
      relevanceScore,
      source: r.source
    };
  });
  
  // Sort by relevance
  chunks.sort((a, b) => b.relevanceScore - a.relevanceScore);
  
  // Take top chunks
  const topChunks = chunks.slice(0, 5);
  
  return {
    processedResults: {
      chunks: topChunks,
      entities: [],
      relationships: []
    }
  };
} 