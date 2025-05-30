/**
 * Query analysis and method selection for the Hybrid Search Chain
 */
import { createLLM } from "../../langchain";
import { SearchFilterOptions } from "../../vectorstore";
import { HybridSearchInput, RetrievalMethod } from "./types";

// Flags to disable graph and entity search by default
const GRAPH_SEARCH_ENABLED = false;
const ENTITY_SEARCH_ENABLED = false;

/**
 * Analyzes a search query and selects appropriate search methods
 */
export async function analyzeQueryAndSelectMethods(input: HybridSearchInput): Promise<{
  query: string;
  filters: SearchFilterOptions;
  methods: RetrievalMethod[];
  analysisResult: Record<string, unknown>;
}> {
  const { query, filters = {}, analysisOptions = {}, methodOptions = {} } = input;
  
  // Initialize methods array
  const methods: RetrievalMethod[] = [];
  
  // Run query analysis with LLM if not explicitly configured
  let analysisResult: Record<string, unknown> = {};
  
  if (!methodOptions.vector && !methodOptions.keyword && 
      !methodOptions.entity && !methodOptions.graph) {
    // Use LLM to analyze query characteristics
    const llm = createLLM({ temperature: 0.2 });
    
    const prompt = `
Analyze this search query to determine which search methods would be most effective.

Query: "${query}"

Rate each search method on a scale of 1-10 for effectiveness (10 being most effective):
- Vector search: Good for semantic meaning and conceptual similarity
- Keyword search: Good for specific terms, names, or exact phrases
- Entity search: Good for queries about specific entity types (people, organizations, etc.)
- Graph search: Good for relationship queries between entities

For each method, explain why it would or wouldn't be effective.
`;
    
    const response = await llm.invoke(prompt);
    const content = response.content as string;
    
    // Extract ratings from response (simplified parsing)
    const vectorMatch = content.match(/Vector search:.*?(\d+)/);
    const keywordMatch = content.match(/Keyword search:.*?(\d+)/);
    const entityMatch = content.match(/Entity search:.*?(\d+)/);
    const graphMatch = content.match(/Graph search:.*?(\d+)/);
    
    const vectorScore = vectorMatch ? parseInt(vectorMatch[1], 10) : 5;
    const keywordScore = keywordMatch ? parseInt(keywordMatch[1], 10) : 3;
    const entityScore = entityMatch ? parseInt(entityMatch[1], 10) : 0;
    const graphScore = graphMatch ? parseInt(graphMatch[1], 10) : 0;
    
    analysisResult = {
      vectorScore,
      keywordScore,
      entityScore,
      graphScore,
      analysisText: content
    };
    
    // Add methods based on scores
    if (vectorScore >= 4) {
      methods.push({
        type: 'vector',
        parameters: { 
          k: Math.min(10, Math.max(3, Math.floor(vectorScore))),
          similarityThreshold: 0.7
        },
        priority: vectorScore
      });
    }
    
    if (keywordScore >= 4) {
      methods.push({
        type: 'keyword',
        parameters: { 
          k: Math.min(10, Math.max(3, Math.floor(keywordScore))),
        },
        priority: keywordScore
      });
    }
    
    // Only add entity search if ENTITY_SEARCH_ENABLED is true
    if (entityScore >= 6 && analysisOptions.considerEntities && ENTITY_SEARCH_ENABLED) {
      methods.push({
        type: 'entity',
        parameters: { 
          k: Math.min(10, Math.max(3, Math.floor(entityScore))),
        },
        priority: entityScore
      });
    }
    
    // Only add graph search if GRAPH_SEARCH_ENABLED is true
    if (graphScore >= 6 && analysisOptions.considerRelationships && GRAPH_SEARCH_ENABLED) {
      methods.push({
        type: 'graph',
        parameters: { 
          depth: Math.min(3, Math.max(1, Math.floor(graphScore / 3))),
          maxResults: 20
        },
        priority: graphScore
      });
    }
  } else {
    // Use explicit method configuration from input
    if (methodOptions.vector?.enabled !== false) {
      methods.push({
        type: 'vector',
        parameters: {
          k: methodOptions.vector?.k || 5,
          similarityThreshold: methodOptions.vector?.similarityThreshold || 0.7
        },
        priority: 10
      });
    }
    
    if (methodOptions.keyword?.enabled === true) {
      methods.push({
        type: 'keyword',
        parameters: {
          k: methodOptions.keyword?.k || 5
        },
        priority: 8
      });
    }
    
    // Only add entity search if explicitly enabled in methodOptions AND ENTITY_SEARCH_ENABLED is true,
    // or if ENTITY_SEARCH_ENABLED is false but methodOptions.entity?.enabled is explicitly set to true
    if ((methodOptions.entity?.enabled === true && ENTITY_SEARCH_ENABLED) || 
        (!ENTITY_SEARCH_ENABLED && methodOptions.entity?.enabled === true)) {
      methods.push({
        type: 'entity',
        parameters: {
          types: methodOptions.entity?.types || [],
          k: methodOptions.entity?.k || 5
        },
        priority: 6
      });
    }
    
    // Only add graph search if explicitly enabled in methodOptions AND GRAPH_SEARCH_ENABLED is true,
    // or if GRAPH_SEARCH_ENABLED is false but methodOptions.graph?.enabled is explicitly set to true
    if ((methodOptions.graph?.enabled === true && GRAPH_SEARCH_ENABLED) || 
        (!GRAPH_SEARCH_ENABLED && methodOptions.graph?.enabled === true)) {
      methods.push({
        type: 'graph',
        parameters: {
          depth: methodOptions.graph?.depth || 2,
          entityTypes: methodOptions.graph?.entityTypes || [],
          relationshipTypes: methodOptions.graph?.relationshipTypes || [],
          maxResults: methodOptions.graph?.maxResults || 20
        },
        priority: 4
      });
    }
  }
  
  // If no methods were selected (unlikely), default to vector search
  if (methods.length === 0) {
    methods.push({
      type: 'vector',
      parameters: { k: 5, similarityThreshold: 0.7 },
      priority: 5
    });
  }
  
  // Convert generic filters to SearchFilterOptions
  const searchFilters: SearchFilterOptions = {};
  
  if (filters.namespace) {
    searchFilters.namespace = filters.namespace as string;
  }
  
  if (filters.ids && Array.isArray(filters.ids)) {
    searchFilters.ids = filters.ids as string[];
  }
  
  if (filters.metadata && typeof filters.metadata === 'object') {
    searchFilters.metadata = filters.metadata as Record<string, unknown>;
  }
  
  return {
    query,
    filters: searchFilters,
    methods,
    analysisResult
  };
} 