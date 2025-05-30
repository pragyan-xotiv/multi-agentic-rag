# Retrieval Agent

The Retrieval Agent is a sophisticated component that enables intelligent, multi-strategy information retrieval from various knowledge sources. It analyzes user queries to determine the most effective retrieval methods and combines results for comprehensive answers.

> **Implementation Phase:** This agent is part of [Phase 2: Retrieval Agent](../../../ideas/phases/phase2-retrieval-agent.md) in the project implementation roadmap.

## Workflow Architecture

The Retrieval Agent uses a LangGraph StateGraph to implement a sequential workflow for intelligent information retrieval. This creates a modular, maintainable, and extensible system.

### Flow Diagram

Below is a diagram of the Retrieval Agent workflow:

```mermaid
graph TD
    %% Node definitions with descriptions
    start[Entry Point] --> analyzeRequest
    
    subgraph "Retrieval Agent Workflow"
        analyzeRequest[Analyze Request\nAnalyzes the query and determines\noptimal retrieval methods]
        hybridSearch[Hybrid Search\nExecutes multiple search methods\nin parallel based on analysis]
        evaluateResults[Evaluate Results\nAssesses quality and relevance\nof retrieved information]
        formatResponse[Format Response\nStructures the final response\nwith relevant content]
    end
    
    %% Edge definitions with flow direction
    analyzeRequest --> hybridSearch
    hybridSearch --> evaluateResults
    evaluateResults --> formatResponse
    formatResponse --> end[End]
    
    %% Additional information - State flow between nodes
    classDef processNode fill:#f9f,stroke:#333,stroke-width:2px;
    classDef dataNode fill:#bbf,stroke:#333,stroke-width:1px;
    
    class analyzeRequest,hybridSearch,evaluateResults,formatResponse processNode;
    class start,end dataNode;
    
    %% Node descriptions
    subgraph "State Flow"
        retrievalRequest[retrievalRequest\nQuery and filters]
        requestAnalysis[requestAnalysis\nAnalysis of query]
        rawResults[rawResults\nRaw search results]
        processedResults[processedResults\nConsolidated results]
        resultEvaluation[resultEvaluation\nQuality metrics]
        response[response\nFinal formatted response]
    end
    
    retrievalRequest -.-> analyzeRequest
    analyzeRequest -.-> requestAnalysis
    requestAnalysis -.-> hybridSearch
    hybridSearch -.-> rawResults
    rawResults -.-> processedResults
    processedResults -.-> evaluateResults
    evaluateResults -.-> resultEvaluation
    resultEvaluation -.-> formatResponse
    formatResponse -.-> response
```

For environments where Mermaid diagrams aren't supported, here's a traditional ASCII diagram of the workflow:

```
                        ┌───────────────┐
START ───────────────> │ analyzeRequest │
                        └───────┬───────┘
                                │
                                ▼
                        ┌───────────────┐
                        │ hybridSearch  │
                        └───────┬───────┘
                                │
                                ▼
                        ┌───────────────┐
                        │evaluateResults│
                        └───────┬───────┘
                                │
                                ▼
                        ┌───────────────┐
                        │formatResponse │
                        └───────┬───────┘
                                │
                                ▼
                               END

State Flow:
┌────────────────┐    ┌────────────────┐    ┌────────────────┐
│retrievalRequest│───>│requestAnalysis │───>│  rawResults    │
└────────────────┘    └────────────────┘    └────────┬───────┘
                                                     │
                                                     ▼
┌────────────────┐    ┌────────────────┐    ┌────────────────┐
│    response    │<───│resultEvaluation│<───│processedResults│
└────────────────┘    └────────────────┘    └────────────────┘
```

## Workflow Diagram

```
                                    RETRIEVAL AGENT WORKFLOW
                                    ========================

    +-------------+         +-------------+         +-------------+         +-------------+
    | Query       |         | Hybrid      |         | Result      |         | Response    |
    | Analysis    +-------->+ Search      +-------->+ Evaluation  +-------->+ Format      |
    +------+------+         +------+------+         +------+------+         +------+------+
           |                       |                       |                       |
           |                       |                       |                       |
           v                       v                       v                       v
    +-------------+         +-------------+         +-------------+         +-------------+
    | Method      |         | Parallel    |         | Quality     |         | Result      |
    | Selection   |         | Execution   |         | Assessment  |         | Organization|
    +------+------+         +------+------+         +------+------+         +------+------+
           |                       |                       |                       |
           |                       |                       |                       |
           v                       v                       v                       v
    +-------------+         +-------------+         +-------------+         +-------------+
    | Intent      |         | Result      |         | Relevance   |         | Citation    |
    | Recognition |         | Consolidation|        | Scoring     |         | Generation  |
    +-------------+         +-------------+         +-------------+         +-------------+

LEGEND:
- Query Analysis: Uses LLM to understand user intent [→ #1 Analyze Request](#workflow-nodes)
- Hybrid Search: Combines multiple search strategies [→ #2 Hybrid Search](#workflow-nodes)
- Result Evaluation: Assesses result quality [→ #3 Evaluate Results](#workflow-nodes)
- Response Format: Structures the final output [→ #4 Format Response](#workflow-nodes)

- Method Selection: Statistical analysis of query components [→ #1 Analyze Request](#workflow-nodes)
- Parallel Execution: Concurrent execution of search methods [→ #2 Hybrid Search](#workflow-nodes)
- Quality Assessment: Quality metrics calculation [→ #3 Evaluate Results](#workflow-nodes)
- Result Organization: Logical organization of information [→ #4 Format Response](#workflow-nodes)

- Intent Recognition: Natural language understanding [→ #1 Analyze Request](#workflow-nodes)
- Result Consolidation: Merging and deduplicating results [→ #2 Hybrid Search](#workflow-nodes)
- Relevance Scoring: Calculating relevance scores [→ #3 Evaluate Results](#workflow-nodes)
- Citation Generation: Adding source attribution [→ #4 Format Response](#workflow-nodes)
```

### Workflow Nodes

The workflow consists of four main processing nodes:

1. **Analyze Request (analyzeRequest)**
   - Analyzes the user query to determine optimal retrieval strategies
   - Identifies entity types, semantic aspects, and query complexity
   - Outputs structured analysis to guide the retrieval process

2. **Hybrid Search (hybridSearch)**
   - Executes multiple search methods in parallel based on query analysis
   - Methods include vector search, keyword search, entity search, and graph search
   - Results are consolidated and ranked for further processing

3. **Evaluate Results (evaluateResults)**
   - Assesses the quality and relevance of retrieved information
   - Calculates relevance, coverage, and confidence scores
   - Provides feedback on the retrieval process

4. **Format Response (formatResponse)**
   - Structures the final response with the most relevant content
   - Organizes information in a coherent, consumable format
   - Includes metadata and source references

### State Management

The workflow uses a shared state object that passes through each node. Each node updates specific portions of the state:

- **retrievalRequest**: Initial query and filters
- **requestAnalysis**: Analysis of the query structure and intent
- **retrievalMethods**: Selected methods for information retrieval
- **rawResults**: Raw search results from different methods
- **processedResults**: Consolidated and ranked information
- **resultEvaluation**: Quality metrics for the retrieval process
- **response**: Final formatted response with retrieved information

This state-based architecture allows for easy debugging, extension, and modification of the retrieval process.

## Components

The Retrieval Agent is built using LangGraph and integrates with the standalone Hybrid Search Chain:

```typescript
import { RetrievalAgent } from './lib/agents/retrieval';
import { createHybridSearchChain } from './lib/chains/hybrid-search-chain';
import { StateGraph, START, END } from '@langchain/langgraph';

// Create the hybrid search chain
const hybridSearchChain = createHybridSearchChain({
  vectorStore,
  supabaseClient,
  knowledgeBase
});

// Create the retrieval workflow that uses the hybrid search chain
function createRetrievalWorkflow() {
  const workflow = new StateGraph(RetrievalStateAnnotation)
    .addNode("analyzeRequest", analyzeRetrievalRequest)
    .addNode("hybridSearch", async (state) => {
      // Analyze query to determine optimal search strategies
      const results = await hybridSearchChain.invoke({
        query: state.retrievalRequest.query,
        filters: state.retrievalRequest.filters,
        analysisOptions: {
          // Pass analysis data to help with method selection
          considerEntities: state.requestAnalysis.entityTypes.length > 0,
          considerRelationships: state.requestAnalysis.structuralNeeds.includes("relationships")
        }
      });
      
      // Process results for next steps
      return {
        processedResults: {
          chunks: results.results.map(r => ({
            content: r.content,
            metadata: r.metadata,
            relevanceScore: r.score,
            source: r.source
          })),
          entities: [],
          relationships: []
        }
      };
    })
    .addNode("evaluateResults", evaluateResultQuality)
    .addNode("formatResponse", formatRetrievalResponse);
  
  // Define workflow edges using START and END constants
  workflow.addEdge(START, "analyzeRequest");
  workflow.addEdge("analyzeRequest", "hybridSearch");
  workflow.addEdge("hybridSearch", "evaluateResults");
  workflow.addEdge("evaluateResults", "formatResponse");
  workflow.addEdge("formatResponse", END);
  
  return workflow.compile();
}
```

## Usage

```typescript
import { RetrievalAgent } from './lib/agents/retrieval';

// Create a new retrieval agent
const agent = new RetrievalAgent();

// Basic search returning just the chunks
const results = await agent.search("What are the key features of our product?");

// Full retrieval with evaluation and formatted response
const response = await agent.retrieve("How does our pricing compare to competitors?");

// Stream results as they're found
await agent.streamResults(
  "What customer feedback did we receive last quarter?",
  {},
  { streamDelay: 100 },
  async (chunk) => {
    // Process each chunk as it's retrieved
    console.log(chunk);
  }
);
```

## Implemented Search Methods

The Retrieval Agent currently uses the following search methods through the Hybrid Search Chain:

- ✅ **Vector Search**: Semantic search using embeddings and cosine similarity
- ✅ **Keyword Search**: Text-based search using Supabase text search capabilities
- 🚧 **Entity Search**: Search focused on structured entity data (requires Knowledge Base)
- 🚧 **Graph Search**: Search through relationship networks (requires Knowledge Base)

## Benefits of the Current Architecture

1. **Separation of Concerns**: The agent focuses on orchestration while the chain handles search execution
2. **Reusability**: The Hybrid Search Chain can be used by other components
3. **Maintainability**: Search logic can be updated independently of the agent
4. **Extensibility**: New search methods can be added to the chain without modifying the agent
5. **Testability**: Components can be tested independently 