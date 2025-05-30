import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import { 
  RetrievalAgentState, 
  RetrievalResponse,
  RetrievalMethod,
  VectorResult,
  KeywordResult,
  EntityResult,
  GraphResult,
  RetrievedChunk,
  Entity,
  Relationship
} from "./types";

// Import functionality from separate modules
import { analyzeRetrievalRequest } from "./analysis";
import { evaluateResultQuality, formatRetrievalResponse } from "./evaluation";
import { executeHybridSearch } from "./result-processing";

/**
 * Define the state structure using Annotation
 */
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

/**
 * Create and compile the retrieval workflow
 */
export function createRetrievalWorkflow() {
  // Create a StateGraph with the annotation-based state structure
  const workflow = new StateGraph(RetrievalStateAnnotation)
    .addNode("analyzeRequest", analyzeRetrievalRequest)
    .addNode("hybridSearch", executeHybridSearch)
    .addNode("evaluateResults", evaluateResultQuality)
    .addNode("formatResponse", formatRetrievalResponse);
  
  // Define the sequential flow with the new node
  workflow.addEdge(START, "analyzeRequest");
  
  workflow.addEdge("analyzeRequest", "hybridSearch");
  workflow.addEdge("hybridSearch", "evaluateResults");
  workflow.addEdge("evaluateResults", "formatResponse");
  workflow.addEdge("formatResponse", END);
  
  // Compile the graph into a runnable
  return workflow.compile();
}

/**
 * Execute the retrieval workflow with a query
 */
export async function executeRetrieval(query: string, filters: Record<string, unknown> = {}): Promise<RetrievalResponse> {
  const workflow = createRetrievalWorkflow();
  
  // Prepare the initial state
  const initialState: RetrievalAgentState = {
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
  
  // Use type assertion with a specific interface
  interface WorkflowResult {
    response: RetrievalResponse;
  }
  
  // Extract the response using the typed interface
  const typedResult = result as unknown as WorkflowResult;
  
  // Return the response
  return typedResult.response;
} 