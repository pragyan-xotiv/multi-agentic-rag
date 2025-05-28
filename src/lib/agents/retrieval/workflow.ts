import { StateGraph, Annotation } from "@langchain/langgraph";
import { 
  RetrievalAgentState, 
  RetrievalMethodType, 
  RetrievalMethod, 
  VectorResult, 
  KeywordResult,
  EntityResult,
  GraphResult,
  RetrievedChunk,
  Entity,
  Relationship
} from "./types";
import { createLLM } from "../../langchain";
import { searchVectorStore, createVectorStore } from "../../vectorstore";
import supabaseClient from "../../supabase/client";

/**
 * Node implementations for the retrieval workflow
 */

// Define a response type
export interface RetrievalResponse {
  content: string;
  results: RetrievedChunk[];
  evaluation: {
    relevanceScore: number;
    coverageScore: number;
    confidenceScore: number;
    feedback: string;
  };
}

// Define the state structure using Annotation
const RetrievalStateAnnotation = Annotation.Root({
  retrievalRequest: Annotation<{
    type: string;
    parameters: Record<string, unknown>;
    query: string;
    filters?: Record<string, unknown>;
    requiredSources?: string[];
  }>(),
  requestAnalysis: Annotation<{
    entityTypes: string[];
    semanticAspects: string[];
    structuralNeeds: string[];
    complexityScore: number;
  }>(),
  retrievalMethods: Annotation<RetrievalMethod[]>(),
  rawResults: Annotation<{
    vectorResults: VectorResult[];
    keywordResults: KeywordResult[];
    entityResults: EntityResult[];
    graphResults: GraphResult[];
  }>(),
  processedResults: Annotation<{
    chunks: RetrievedChunk[];
    entities: Entity[];
    relationships: Relationship[];
  }>(),
  resultEvaluation: Annotation<{
    relevanceScore: number;
    coverageScore: number;
    confidenceScore: number;
    feedback: string;
  }>(),
  response: Annotation<RetrievalResponse>()
});

// Analyze the retrieval request to understand what we're looking for
export async function analyzeRetrievalRequest(state: RetrievalAgentState): Promise<Partial<RetrievalAgentState>> {
  // Check if state has the expected structure
  if (!state.retrievalRequest || !state.retrievalRequest.query) {
    throw new Error("Invalid state: retrievalRequest or query is missing");
  }

  const llm = createLLM({ temperature: 0.2 });
  const { query } = state.retrievalRequest;
  
  const prompt = `
Analyze the following search query to identify what kind of information we need to retrieve.

Query: "${query}"

Analyze the following aspects:
1. Entity Types: What types of entities (people, companies, concepts, etc.) are being asked about?
2. Semantic Aspects: What meaning or information is being sought?
3. Structural Needs: Does this require hierarchical, relational, or flat information?
4. Complexity: On a scale of 1-10, how complex is this query?

Provide your analysis as structured data.
`;
  
  const response = await llm.invoke(prompt);
  const content = response.content as string;
  
  // Extract key elements from the response
  // This is a simplified parsing approach - in a production system we'd use more robust parsing
  const entityMatch = content.match(/Entity Types:(.+?)(?=Semantic|$)/);
  const semanticMatch = content.match(/Semantic Aspects:(.+?)(?=Structural|$)/);
  const structuralMatch = content.match(/Structural Needs:(.+?)(?=Complexity|$)/);
  const complexityMatch = content.match(/Complexity:(.+?)(?=\n|$)/);
  
  // Extract and clean up the matches
  const entityTypes = entityMatch 
    ? entityMatch[1].split(',').map(e => e.trim()).filter(Boolean)
    : [];
  const semanticAspects = semanticMatch 
    ? semanticMatch[1].split(',').map(e => e.trim()).filter(Boolean)
    : [];
  const structuralNeeds = structuralMatch 
    ? structuralMatch[1].split(',').map(e => e.trim()).filter(Boolean)
    : [];
  
  // Parse complexity score, defaulting to 5 if we can't extract it
  let complexityScore = 5;
  if (complexityMatch) {
    const numberMatch = complexityMatch[1].match(/\d+/);
    if (numberMatch) {
      complexityScore = parseInt(numberMatch[0], 10);
      if (isNaN(complexityScore) || complexityScore < 1) {
        complexityScore = 1;
      } else if (complexityScore > 10) {
        complexityScore = 10;
      }
    }
  }
  
  return {
    requestAnalysis: {
      entityTypes,
      semanticAspects,
      structuralNeeds,
      complexityScore
    }
  };
}

// Select the appropriate retrieval methods based on the request analysis
export async function selectRetrievalMethods(state: RetrievalAgentState): Promise<Partial<RetrievalAgentState>> {
  const { requestAnalysis } = state;
  
  // Always include vector search as a baseline method
  const methods: RetrievalMethod[] = [
    {
      type: RetrievalMethodType.VECTOR,
      parameters: { k: 5 },
      priority: 1
    }
  ];
  
  // Add keyword search for specific terms or if complexity is low
  if (requestAnalysis.complexityScore <= 6) {
    methods.push({
      type: RetrievalMethodType.KEYWORD,
      parameters: { k: 3 },
      priority: 2
    });
  }
  
  // Entity search if we have specific entity types
  if (requestAnalysis.entityTypes.length > 0) {
    methods.push({
      type: RetrievalMethodType.ENTITY,
      parameters: { 
        entityTypes: requestAnalysis.entityTypes,
        k: 3
      } as Record<string, unknown>,
      priority: 3
    });
  }
  
  // Graph search for complex relational queries
  if (requestAnalysis.complexityScore >= 7 && 
      requestAnalysis.structuralNeeds.some(need => 
        need.toLowerCase().includes('relation') || 
        need.toLowerCase().includes('connection'))) {
    methods.push({
      type: RetrievalMethodType.GRAPH,
      parameters: { depth: 2 } as Record<string, unknown>,
      priority: 4
    });
  }
  
  return {
    retrievalMethods: methods
  };
}

// Execute the selected retrieval methods
export async function executeRetrievalOperations(state: RetrievalAgentState): Promise<Partial<RetrievalAgentState>> {
  const { retrievalMethods, retrievalRequest } = state;
  const { query, filters } = retrievalRequest;
  
  // Initialize results
  const vectorResults: VectorResult[] = [];
  const keywordResults: KeywordResult[] = [];
  const entityResults: EntityResult[] = [];
  const graphResults: GraphResult[] = [];
  
  // Process each method
  for (const method of retrievalMethods) {
    switch (method.type) {
      case RetrievalMethodType.VECTOR: {
        // Execute vector search
        try {
          const vectorStore = await createVectorStore(supabaseClient);
          
          // Extract filter if available
          const filter = method.parameters.filter || filters;
          
          const results = await searchVectorStore(
            vectorStore,
            query,
            method.parameters.k as number || 4,
            filter as Record<string, unknown>
          );
          
          // Convert to our result format
          vectorResults.push(...results.map(doc => ({
            content: doc.pageContent,
            metadata: doc.metadata as Record<string, unknown>,
            score: 0.9 // Placeholder score
          })));
        } catch (error) {
          console.error("Vector search error:", error);
        }
        break;
      }
      
      case RetrievalMethodType.KEYWORD: {
        // For now, implement a basic keyword search using Supabase text search
        try {
          const { data, error } = await supabaseClient
            .from("documents")
            .select("*")
            .textSearch("content", query.split(" ").join(" & "))
            .limit(method.parameters.k as number || 3);
            
          if (error) throw error;
          
          keywordResults.push(...(data || []).map(item => ({
            content: item.content,
            metadata: item.metadata || {},
            matches: query.split(" ")
          })));
        } catch (error) {
          console.error("Keyword search error:", error);
        }
        break;
      }
      
      // Note: Entity and Graph search are more complex and would
      // require additional infrastructure. For this implementation,
      // we'll leave them as placeholders.
      
      case RetrievalMethodType.ENTITY:
        // Placeholder for entity search implementation
        console.log("Entity search not yet implemented");
        break;
        
      case RetrievalMethodType.GRAPH:
        // Placeholder for graph search implementation
        console.log("Graph search not yet implemented");
        break;
    }
  }
  
  return {
    rawResults: {
      vectorResults,
      keywordResults,
      entityResults,
      graphResults
    }
  };
}

// Helper interface for result consolidation
interface ConsolidatedResult {
  content: string;
  metadata: Record<string, unknown>;
  score?: number;
  matches?: string[];
  source: string;
}

// Rank and filter the raw results
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
  
  // For more results, we need to re-rank them
  // Here we'd normally use an embedding model to compute relevance
  // For simplicity, we'll use a basic approach for now
  
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

// Evaluate the quality of the results
export async function evaluateResultQuality(state: RetrievalAgentState): Promise<Partial<RetrievalAgentState>> {
  const { processedResults } = state;
  const { chunks } = processedResults;
  
  // If we have no results, return low scores
  if (chunks.length === 0) {
    return {
      resultEvaluation: {
        relevanceScore: 0,
        coverageScore: 0,
        confidenceScore: 0,
        feedback: "No results found for the query."
      }
    };
  }
  
  // For simplicity, calculate simple evaluation metrics
  // In a production system, we would use the LLM to evaluate
  
  // Average relevance score
  const avgRelevance = chunks.reduce((sum, chunk) => sum + chunk.relevanceScore, 0) / chunks.length;
  
  // Coverage is based on number of chunks relative to a target (5)
  const coverageScore = Math.min(chunks.length / 5, 1);
  
  // Confidence is a combination of relevance and coverage
  const confidenceScore = (avgRelevance + coverageScore) / 2;
  
  let feedback = "";
  if (confidenceScore > 0.7) {
    feedback = "High-quality results found that appear to address the query well.";
  } else if (confidenceScore > 0.4) {
    feedback = "Some relevant information found, but the results may not fully address the query.";
  } else {
    feedback = "Limited relevant information found. Consider refining the query.";
  }
  
  return {
    resultEvaluation: {
      relevanceScore: avgRelevance,
      coverageScore,
      confidenceScore,
      feedback
    }
  };
}

// Format the final response
export async function formatRetrievalResponse(state: RetrievalAgentState): Promise<{response: RetrievalResponse}> {
  const { processedResults, resultEvaluation, retrievalRequest } = state;
  const { query } = retrievalRequest;
  const { chunks } = processedResults;
  
  // For low-confidence results, use a more cautious response
  if (resultEvaluation.confidenceScore < 0.3) {
    return {
      response: {
        content: `I found limited information related to "${query}". ${resultEvaluation.feedback}`,
        results: chunks,
        evaluation: resultEvaluation
      }
    };
  }
  
  // Format a standard response with the results
  return {
    response: {
      content: `Here's what I found related to "${query}":`,
      results: chunks,
      evaluation: resultEvaluation
    }
  };
}

/**
 * Create and compile the retrieval workflow
 */
export function createRetrievalWorkflow() {
  // Create a StateGraph with the annotation-based state structure
  const workflow = new StateGraph(RetrievalStateAnnotation)
    .addNode("analyzeRequest", analyzeRetrievalRequest)
    .addNode("selectMethods", selectRetrievalMethods)
    .addNode("executeRetrieval", executeRetrievalOperations)
    .addNode("rankResults", rankAndFilterResults)
    .addNode("evaluateResults", evaluateResultQuality)
    .addNode("formatResponse", formatRetrievalResponse);
  
  // Define the sequential flow
  workflow.setEntryPoint("analyzeRequest");
  
  workflow.addEdge("analyzeRequest", "selectMethods");
  workflow.addEdge("selectMethods", "executeRetrieval");
  workflow.addEdge("executeRetrieval", "rankResults");
  workflow.addEdge("rankResults", "evaluateResults");
  workflow.addEdge("evaluateResults", "formatResponse");
  
  // Compile the graph into a runnable
  return workflow.compile();
}

/**
 * Execute the retrieval workflow with a query
 */
export async function executeRetrieval(query: string, filters: Record<string, unknown> = {}): Promise<RetrievalResponse> {
  const workflow = createRetrievalWorkflow();
  
  // Prepare the initial state
  const initialState = {
    retrievalRequest: {
      type: "query",
      parameters: {},
      query,
      filters
    },
    requestAnalysis: {
      entityTypes: [],
      semanticAspects: [],
      structuralNeeds: [],
      complexityScore: 5
    },
    retrievalMethods: [],
    rawResults: {
      vectorResults: [],
      keywordResults: [],
      entityResults: [],
      graphResults: []
    },
    processedResults: {
      chunks: [],
      entities: [],
      relationships: []
    },
    resultEvaluation: {
      relevanceScore: 0,
      coverageScore: 0,
      confidenceScore: 0,
      feedback: ""
    }
  };
  
  // Run the workflow
  const result = await workflow.invoke(initialState);
  
  // Use type assertion with a specific interface instead of 'any'
  interface WorkflowResult {
    response: RetrievalResponse;
  }
  
  // Extract the response using the typed interface
  const typedResult = result as unknown as WorkflowResult;
  
  // Return the response
  return typedResult.response;
} 