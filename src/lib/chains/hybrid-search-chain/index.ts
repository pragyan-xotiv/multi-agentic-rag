/**
 * Hybrid Search Chain
 * 
 * Executes multiple search strategies based on query analysis and combines the results.
 */
import { RunnableSequence } from "@langchain/core/runnables";

import { analyzeQueryAndSelectMethods } from "./analyzer";
import { executeSearchMethods } from "./executor";
import { rankAndConsolidateResults } from "./ranker";
import { 
  HybridSearchInput,
  HybridSearchOutput,
  HybridSearchChainConfig,
  RetrievalMethod,
  HybridSearchResult,
  KnowledgeBase
} from "./types";

/**
 * Create a Hybrid Search Chain
 * 
 * @param config Configuration for the chain
 * @returns A chain that analyzes queries, selects search methods, and combines results
 */
export function createHybridSearchChain(config: HybridSearchChainConfig) {
  // Create a LangChain Runnable sequence
  const chain = RunnableSequence.from([
    // Step 1: Analyze query and select methods
    async (input: HybridSearchInput) => {
      const result = await analyzeQueryAndSelectMethods(input);
      return {
        ...result,
        config
      };
    },
    
    // Step 2: Execute search methods in parallel
    executeSearchMethods,
    
    // Step 3: Rank and consolidate results
    rankAndConsolidateResults
  ]);
  
  return chain;
}

// Export all components and types
export {
  analyzeQueryAndSelectMethods,
  executeSearchMethods,
  rankAndConsolidateResults
};

export type {
  HybridSearchInput,
  HybridSearchOutput,
  HybridSearchChainConfig,
  RetrievalMethod,
  HybridSearchResult,
  KnowledgeBase
};

// Default export
export default createHybridSearchChain; 