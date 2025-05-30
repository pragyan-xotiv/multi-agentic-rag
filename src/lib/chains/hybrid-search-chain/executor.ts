/**
 * Search execution logic for the Hybrid Search Chain
 */
import { Document } from "langchain/document";
import { searchVectorStore, keywordSearch, SearchFilterOptions } from "../../vectorstore";
import { RetrievalMethod, HybridSearchChainConfig } from "./types";

/**
 * Execute the selected search methods in parallel
 */
export async function executeSearchMethods(input: {
  query: string;
  filters: SearchFilterOptions;
  methods: RetrievalMethod[];
  analysisResult: Record<string, unknown>;
  config: HybridSearchChainConfig;
}): Promise<{
  results: Document[];
  methodResults: Record<string, Document[]>;
  methods: RetrievalMethod[];
  timings: Record<string, number>;
}> {
  const { query, filters, methods, config } = input;
  const methodResults: Record<string, Document[]> = {};
  const timings: Record<string, number> = {};
  
  // Execute all search methods in parallel
  const searchPromises = methods.map(async (method) => {
    const startTime = Date.now();
    
    try {
      let results: Document[] = [];
      
      switch (method.type) {
        case 'vector':
          results = await searchVectorStore(
            config.vectorStore,
            query,
            method.parameters.k as number,
            filters
          );
          break;
          
        case 'keyword':
          results = await keywordSearch(
            config.supabaseClient,
            query,
            method.parameters.k as number,
            filters
          );
          break;
          
        case 'entity':
          // Entity search requires knowledge base - skip if not available
          if (config.knowledgeBase) {
            // Implementation pending knowledge base schema
            console.log('Entity search not yet implemented - requires knowledge base');
          }
          break;
          
        case 'graph':
          // Graph search requires knowledge base - skip if not available
          if (config.knowledgeBase) {
            // Implementation pending knowledge base schema
            console.log('Graph search not yet implemented - requires knowledge base');
          }
          break;
      }
      
      const endTime = Date.now();
      timings[method.type] = endTime - startTime;
      
      // Store results by method type
      methodResults[method.type] = results;
      
      return results;
    } catch (error) {
      console.error(`Error executing ${method.type} search:`, error);
      const endTime = Date.now();
      timings[method.type] = endTime - startTime;
      methodResults[method.type] = [];
      return [];
    }
  });
  
  // Wait for all searches to complete
  await Promise.all(searchPromises);
  
  // Combine all results
  const allResults = Object.values(methodResults).flat();
  
  return {
    results: allResults,
    methodResults,
    methods,
    timings
  };
} 