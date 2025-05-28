# Phase 2: Retrieval Agent

**Duration: 2-3 weeks**

Implement the Retrieval Agent as the first functional agent, as it provides the core search capabilities needed by other components.

## Overview

The Retrieval Agent serves as the bridge between user queries and the knowledge base. This phase focuses on building the agent that can intelligently search for and retrieve the most relevant information using multiple search strategies simultaneously.

## Key Objectives

- Establish the LangChain and LangGraph foundation for all agents
- Implement the core Retrieval Agent with multiple search methods
- Create API endpoints and UI components for search functionality
- Set up testing infrastructure for agent verification

## Tasks

### 1. LangChain & LangGraph Setup

- Configure LLM providers
  ```typescript
  import { ChatOpenAI } from "@langchain/openai";
  
  const llm = new ChatOpenAI({
    modelName: "gpt-4o",
    temperature: 0.2,
    streaming: true,
    verbose: true
  });
  ```

- Set up environment variables for API keys
  ```
  OPENAI_API_KEY=
  ANTHROPIC_API_KEY=
  SUPABASE_URL=
  SUPABASE_ANON_KEY=
  SUPABASE_SERVICE_ROLE_KEY=
  ```

- Implement base agent architecture
  - Create base agent class with common functionality
  - Set up agent factory pattern for different agent types
  - Implement utility functions for agent operations

### 2. Retrieval Agent Core Implementation

- Create state definition for Retrieval Agent
  ```typescript
  interface RetrievalAgentState {
    retrievalRequest: {
      type: string;
      parameters: Record<string, any>;
      query: string;
      filters?: Record<string, any>;
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
  ```

- Implement LangGraph workflow for the agent
  ```typescript
  import { StateGraph } from "@langchain/langgraph";
  import { RunnableConfig } from "@langchain/core/runnables";
  
  // Define the nodes (functions that process the state)
  async function analyzeRetrievalRequest(state: RetrievalAgentState) {
    // Implementation
    return { requestAnalysis: { /* analysis results */ } };
  }
  
  async function selectRetrievalMethods(state: RetrievalAgentState) {
    // Implementation
    return { retrievalMethods: [ /* selected methods */ ] };
  }
  
  async function executeRetrievalOperations(state: RetrievalAgentState) {
    // Implementation
    return { rawResults: { /* raw search results */ } };
  }
  
  async function rankAndFilterResults(state: RetrievalAgentState) {
    // Implementation
    return { processedResults: { /* processed results */ } };
  }
  
  async function evaluateResultQuality(state: RetrievalAgentState) {
    // Implementation
    return { resultEvaluation: { /* evaluation metrics */ } };
  }
  
  async function formatRetrievalResponse(state: RetrievalAgentState) {
    // Implementation
    return { /* final formatted results */ };
  }
  
  // Create the workflow
  const retrievalGraph = new StateGraph<RetrievalAgentState>({
    channels: {
      requestAnalysis: { value: null },
      retrievalMethods: { value: null },
      rawResults: { value: null }
    }
  });
  
  // Add nodes to the graph
  retrievalGraph
    .addNode("analyzeRequest", analyzeRetrievalRequest)
    .addNode("selectMethods", selectRetrievalMethods)
    .addNode("executeRetrieval", executeRetrievalOperations)
    .addNode("rankResults", rankAndFilterResults)
    .addNode("evaluateResults", evaluateResultQuality)
    .addNode("formatResponse", formatRetrievalResponse);
    
  // Add edges to connect the nodes
  retrievalGraph
    .addEdge("analyzeRequest", "selectMethods")
    .addEdge("selectMethods", "executeRetrieval")
    .addEdge("executeRetrieval", "rankResults")
    .addEdge("rankResults", "evaluateResults")
    .addEdge("evaluateResults", "formatResponse");
  
  // Compile the graph into a runnable
  const retrievalProcessor = retrievalGraph.compile();
  
  // Example usage
  const result = await retrievalProcessor.invoke({
    retrievalRequest: {
      type: "query",
      parameters: {},
      query: "What are the latest developments in quantum computing?"
    }
  });
  ```

- Develop retrieval methods
  - Vector search implementation
    ```typescript
    import { SupabaseVectorStore } from "@langchain/community";
    import { OpenAIEmbeddings } from "@langchain/openai";
    
    async function vectorSearch(query: string, filters: any = {}, k = 5) {
      const embeddings = new OpenAIEmbeddings({
        modelName: "text-embedding-3-large",
        dimensions: 3072
      });
      
      const vectorStore = new SupabaseVectorStore(embeddings, {
        client: supabaseClient,
        tableName: "documents",
        queryName: "match_documents"
      });
      
      return await vectorStore.similaritySearch(query, k, filters);
    }
    ```
  - Keyword search implementation
    ```typescript
    async function keywordSearch(query: string, filters: any = {}, k = 5) {
      // Implementation for lexical search with PostgreSQL
      const { data, error } = await supabaseClient
        .from("documents")
        .select("*")
        .textSearch("content", query)
        .limit(k);
        
      if (error) throw error;
      return data;
    }
    ```
  - Basic filtering implementation
    ```typescript
    function applyFilters(results: any[], filters: any) {
      if (!filters || Object.keys(filters).length === 0) {
        return results;
      }
      
      return results.filter(item => {
        if (!item.metadata) return false;
        
        return Object.entries(filters).every(([key, value]) => {
          return item.metadata[key] === value;
        });
      });
    }
    ```

### 3. API Endpoints for Retrieval

- Create `/api/retrieve` endpoint
  ```typescript
  // app/api/retrieve/route.ts
  import { NextResponse } from "next/server";
  import { RetrievalAgent } from "@/lib/agents/retrieval";
  
  export const runtime = "edge";
  
  export async function POST(req: Request) {
    try {
      const { query, filters, options } = await req.json();
      
      // Initialize retrieval agent
      const agent = new RetrievalAgent();
      
      // Use streaming response
      const encoder = new TextEncoder();
      const stream = new TransformStream();
      const writer = stream.writable.getWriter();
      
      // Process with agent and stream results
      agent.streamResults(query, filters, options, async (chunk) => {
        await writer.write(encoder.encode(JSON.stringify(chunk) + "\n"));
      });
      
      return new Response(stream.readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        },
      });
    } catch (error) {
      console.error("Retrieval error:", error);
      return NextResponse.json(
        { error: "Failed to process retrieval request" },
        { status: 500 }
      );
    }
  }
  ```

- Implement streaming responses
  - Set up server-sent events (SSE) for streaming
  - Create stream handlers for agent output
  - Add progress indicators for long-running operations

- Add error handling and rate limiting
  - Implement robust error handling for API endpoints
  - Add rate limiting middleware
  - Create standardized error responses

### 4. Retrieval UI

- Build basic search interface
  ```jsx
  "use client";
  
  import { useState } from "react";
  import { Button } from "@/components/ui/button";
  import { Input } from "@/components/ui/input";
  import { Card } from "@/components/ui/card";
  
  export default function SearchPage() {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    
    // Search function implementation
    const handleSearch = async () => {
      if (!query.trim()) return;
      
      setLoading(true);
      setResults([]);
      
      try {
        const response = await fetch("/api/retrieve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query })
        });
        
        if (!response.ok) {
          throw new Error("Search failed");
        }
        
        const data = await response.json();
        setResults(data.results);
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setLoading(false);
      }
    };
    
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-2xl font-bold mb-6">Knowledge Search</h1>
        <div className="flex gap-2 mb-8">
          <Input 
            type="text" 
            value={query} 
            onChange={(e) => setQuery(e.target.value)} 
            className="flex-1"
            placeholder="Ask a question..."
          />
          <Button 
            onClick={handleSearch}
            disabled={loading}
          >
            {loading ? "Searching..." : "Search"}
          </Button>
        </div>
        
        <div className="space-y-4">
          {results.map((result, index) => (
            <Card key={index} className="p-4">
              <div className="font-medium">{result.title}</div>
              <div className="text-sm text-gray-600">{result.content}</div>
              <div className="text-xs text-gray-400 mt-2">
                Relevance: {result.relevance.toFixed(2)}
              </div>
            </Card>
          ))}
          
          {results.length === 0 && !loading && (
            <div className="text-center text-gray-500 py-8">
              No results to display
            </div>
          )}
          
          {loading && (
            <div className="text-center py-8">
              <div className="animate-pulse">Searching...</div>
            </div>
          )}
        </div>
      </div>
    );
  }
  ```

- Implement result display components
  - Create components for displaying search results
  - Add formatting for different result types
  - Implement relevance indicators

- Add loading states and error handling
  - Create loading indicators for search operations
  - Implement error display components
  - Add retry functionality for failed searches

### 5. Basic Testing

- Write unit tests for retrieval functions
  ```typescript
  // tests/retrieval-agent.test.ts
  import { describe, test, expect, vi } from "vitest";
  import { RetrievalAgent } from "@/lib/agents/retrieval";
  
  describe("Retrieval Agent", () => {
    test("Vector search returns relevant results", async () => {
      // Mock the vector store
      const mockVectorStore = {
        similaritySearch: vi.fn().mockResolvedValue([
          { pageContent: "Quantum computing uses qubits", metadata: { source: "doc1" } },
          { pageContent: "Quantum algorithms provide speedup", metadata: { source: "doc2" } }
        ])
      };
      
      const agent = new RetrievalAgent(mockVectorStore);
      const results = await agent.search("quantum computing");
      
      expect(results).toHaveLength(2);
      expect(results[0].content).toContain("Quantum computing");
    });
    
    test("Keyword search matches exact terms", async () => {
      // Test implementation
    });
    
    test("Result ranking properly prioritizes relevance", async () => {
      // Test implementation
    });
  });
  ```

- Implement integration tests for the retrieval pipeline
  - Create test fixtures with sample knowledge
  - Test complete retrieval workflows
  - Validate result quality and performance

## Deliverables

- Fully functional Retrieval Agent implementation
- LangChain and LangGraph integration
- API endpoints for retrieval operations
- Search UI with result display
- Test suite for retrieval functionality

## Success Criteria

- Retrieval Agent can effectively search the knowledge base using multiple methods
- Search results are properly ranked and filtered
- UI provides a responsive and intuitive search experience
- API endpoints handle streaming responses correctly
- Tests verify the correctness of retrieval operations
- System is ready for Query Agent implementation in Phase 3 