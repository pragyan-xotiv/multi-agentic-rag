# Phase 3: Query Agent

**Duration: 2-3 weeks**

Build the Query Agent to handle natural language queries and coordinate with the Retrieval Agent.

## Overview

The Query Agent is responsible for understanding user questions, coordinating with the Retrieval Agent to gather information, and synthesizing comprehensive answers. This agent translates natural language questions into effective knowledge base queries by understanding semantic intent rather than just matching keywords.

## Key Objectives

- Implement the Query Agent that can understand complex questions
- Establish communication between Query and Retrieval Agents
- Create a conversational interface for user interactions
- Build a response synthesis system with citations

## Tasks

### 1. Query Agent Implementation

- Define Query Agent state
  ```typescript
  interface QueryAgentState {
    rawQuery: string;
    conversationHistory: Message[];
    
    queryAnalysis: {
      intent: string;
      topics: string[];
      entityReferences: EntityRef[];
      complexityScore: number;
      temporalAspects: {
        timeReferences: string[];
        requiresRecency: boolean;
      };
    };
    
    subQueries: SubQuery[];
    
    retrievalPlan: {
      strategies: RetrievalStrategy[];
      requiredSources: string[];
      filters: Record<string, any>;
    };
    
    retrievedInformation: {
      chunks: RetrievedChunk[];
      entities: Entity[];
      relationships: Relationship[];
    };
    
    generatedAnswer: {
      text: string;
      confidence: number;
      citations: Citation[];
      followupQuestions: string[];
    };
    
    responseEvaluation: {
      completeness: number;
      accuracy: number;
      relevance: number;
      feedback: string;
    };
  }
  
  interface SubQuery {
    id: string;
    text: string;
    purpose: string;
    requiredInformation: string[];
    dependsOn: string[];
  }
  ```

- Implement LangGraph workflow
  ```typescript
  const queryWorkflow = new StateGraph<QueryAgentState>({
    channels: {
      queryAnalysis: new Channel(),
      subQueries: new Channel(),
      retrievalPlan: new Channel(),
      retrievedInfo: new Channel()
    }
  })
    .addNode("analyzeQuery", analyzeQueryIntent)
    .addNode("decomposeQuery", breakDownComplexQuery)
    .addNode("planRetrieval", createRetrievalStrategy)
    .addNode("executeRetrieval", retrieveInformation)
    .addNode("synthesizeAnswer", generateComprehensiveAnswer)
    .addNode("evaluateResponse", assessAnswerQuality)
    
    .addEdge("analyzeQuery", "decomposeQuery")
    .addEdge("decomposeQuery", "planRetrieval")
    .addEdge("planRetrieval", "executeRetrieval")
    .addEdge("executeRetrieval", "synthesizeAnswer")
    .addEdge("synthesizeAnswer", "evaluateResponse")
    .addEdge("evaluateResponse", "FINAL");
  
  const queryProcessor = queryWorkflow.compile();
  ```

- Create query analysis components
  ```typescript
  async function analyzeQueryIntent(state: QueryAgentState, context: AgentContext): Promise<QueryAgentState> {
    const analysisPrompt = PromptTemplate.fromTemplate(`
      You are an expert in understanding user questions. Analyze this query and determine its characteristics.
      
      QUERY: {query}
      
      CONVERSATION HISTORY:
      {conversationHistory}
      
      Provide a detailed analysis with the following:
      1. Primary intent (e.g., factual information, explanation, comparison)
      2. Main topics and concepts referenced
      3. Entity references (specific people, organizations, concepts, etc.)
      4. Complexity score (0-1) - how complex is this query
      5. Temporal aspects:
         - Specific time periods mentioned
         - Whether recent/current information is required
         
      Format your response as JSON.
    `);
    
    const analysisChain = analysisPrompt.pipe(llm).pipe(JsonOutputParser);
    
    const analysis = await analysisChain.invoke({
      query: state.rawQuery,
      conversationHistory: formatConversationHistory(state.conversationHistory)
    });
    
    // Update state with analysis results
    state.queryAnalysis = {
      intent: analysis.primaryIntent,
      topics: analysis.mainTopics,
      entityReferences: analysis.entityReferences.map((e: any) => ({
        name: e.name,
        type: e.type
      })),
      complexityScore: analysis.complexityScore,
      temporalAspects: {
        timeReferences: analysis.temporalAspects.timePeriods,
        requiresRecency: analysis.temporalAspects.requiresRecent
      }
    };
    
    return state;
  }
  ```

- Build answer synthesis module
  ```typescript
  async function generateComprehensiveAnswer(state: QueryAgentState, context: AgentContext): Promise<QueryAgentState> {
    const synthesisPrompt = PromptTemplate.fromTemplate(`
      You are an expert knowledge assistant. Based on the following information, provide a comprehensive answer to the user's question.
      
      QUESTION: {query}
      
      RETRIEVED INFORMATION:
      {retrievedInformation}
      
      CONVERSATION HISTORY:
      {conversationHistory}
      
      Your task is to:
      1. Synthesize a comprehensive answer based on the retrieved information
      2. Provide accurate citations for all facts (using [doc-X] format)
      3. Acknowledge any limitations or uncertainties in the information
      4. Suggest 2-3 relevant follow-up questions the user might have
      
      Your answer should be well-structured, factually accurate, and directly address the user's question.
    `);
    
    const answerResult = await synthesisPrompt.pipe(llm).invoke({
      query: state.rawQuery,
      retrievedInformation: formatRetrievedInfo(state.retrievedInformation),
      conversationHistory: formatConversationHistory(state.conversationHistory)
    });
    
    // Extract citations from the generated answer
    const citations = extractCitations(answerResult.text, state.retrievedInformation);
    
    // Extract follow-up questions from the generated answer
    const followupQuestions = extractFollowupQuestions(answerResult.text);
    
    state.generatedAnswer = {
      text: cleanupGeneratedAnswer(answerResult.text),
      confidence: calculateConfidenceScore(state),
      citations: citations,
      followupQuestions: followupQuestions
    };
    
    return state;
  }
  ```

### 2. Integration with Retrieval Agent

- Establish communication protocol between agents
  ```typescript
  interface RetrievalRequest {
    query: string;
    type: 'semantic' | 'keyword' | 'entity' | 'hybrid';
    filters?: Record<string, any>;
    parameters?: Record<string, any>;
  }
  
  interface RetrievalResponse {
    chunks: RetrievedChunk[];
    entities: Entity[];
    relationships: Relationship[];
    metadata: {
      totalResults: number;
      executionTime: number;
      strategies: string[];
    };
  }
  ```

- Implement retrieval planning
  ```typescript
  async function createRetrievalStrategy(state: QueryAgentState, context: AgentContext): Promise<QueryAgentState> {
    // Based on query analysis, determine the best retrieval approach
    const retrievalPlan = {
      strategies: [] as RetrievalStrategy[],
      requiredSources: [] as string[],
      filters: {} as Record<string, any>
    };
    
    // Add vector search for semantic understanding
    retrievalPlan.strategies.push({
      type: 'semantic',
      parameters: {
        similarityThreshold: 0.7,
        maxResults: 5
      },
      priority: 1
    });
    
    // For queries with specific entities, add entity-based retrieval
    if (state.queryAnalysis.entityReferences.length > 0) {
      retrievalPlan.strategies.push({
        type: 'entity',
        parameters: {
          entities: state.queryAnalysis.entityReferences.map(e => e.name),
          maxHops: 2
        },
        priority: 2
      });
    }
    
    // For factual queries, add keyword search for precision
    if (state.queryAnalysis.intent === 'factual') {
      retrievalPlan.strategies.push({
        type: 'keyword',
        parameters: {
          boostExactMatches: true
        },
        priority: 3
      });
    }
    
    // Add time-based filters if temporal aspects are important
    if (state.queryAnalysis.temporalAspects.timeReferences.length > 0) {
      retrievalPlan.filters.timeframe = state.queryAnalysis.temporalAspects.timeReferences;
    }
    
    state.retrievalPlan = retrievalPlan;
    return state;
  }
  ```

- Create result processing pipeline
  ```typescript
  async function retrieveInformation(state: QueryAgentState, context: AgentContext): Promise<QueryAgentState> {
    // Call the Retrieval Agent with our plan
    const retrievalRequest: RetrievalRequest = {
      query: state.rawQuery,
      type: 'hybrid',
      filters: state.retrievalPlan.filters,
      parameters: {
        strategies: state.retrievalPlan.strategies,
        requiredSources: state.retrievalPlan.requiredSources
      }
    };
    
    // Make the request to the Retrieval Agent
    const retrievalAgent = new RetrievalAgent();
    const retrievalResponse = await retrievalAgent.retrieve(retrievalRequest);
    
    // Process and store the results
    state.retrievedInformation = {
      chunks: retrievalResponse.chunks,
      entities: retrievalResponse.entities,
      relationships: retrievalResponse.relationships
    };
    
    return state;
  }
  ```

### 3. Query API & UI

- Create `/api/query` endpoint
  ```typescript
  // app/api/query/route.ts
  export async function POST(req: Request) {
    const { query, conversationId } = await req.json();
    
    // Get conversation history if available
    const conversationHistory = conversationId 
      ? await getConversationHistory(conversationId) 
      : [];
    
    // Initialize query agent
    const agent = new QueryAgent();
    
    // Use streaming response
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    
    // Process with agent and stream results
    agent.streamResults(
      query, 
      conversationHistory, 
      async (chunk) => {
        await writer.write(encoder.encode(JSON.stringify(chunk) + "\n"));
      }
    );
    
    return new Response(stream.readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  }
  ```

- Build conversational interface
  ```jsx
  // app/chat/page.tsx
  export default function ChatPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [conversationId, setConversationId] = useState<string | null>(null);
    
    const handleSubmit = async (e: FormEvent) => {
      e.preventDefault();
      if (!input.trim()) return;
      
      // Add user message to chat
      const userMessage = { role: "user", content: input };
      setMessages(prev => [...prev, userMessage]);
      setInput("");
      setLoading(true);
      
      try {
        // Create placeholder for assistant response
        const pendingIndex = messages.length;
        setMessages(prev => [...prev, { role: "assistant", content: "", pending: true }]);
        
        // Stream response from API
        const response = await fetch("/api/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            query: userMessage.content,
            conversationId
          })
        });
        
        // Handle streaming response
        const reader = response.body?.getReader();
        if (!reader) throw new Error("Failed to get response reader");
        
        let partialResponse = "";
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          // Process the chunk
          const chunk = new TextDecoder().decode(value);
          const lines = chunk.split("\n").filter(Boolean);
          
          for (const line of lines) {
            const data = JSON.parse(line);
            
            if (data.type === "content") {
              partialResponse += data.content;
              // Update the message with streaming content
              setMessages(prev => {
                const updated = [...prev];
                updated[pendingIndex] = { 
                  role: "assistant", 
                  content: partialResponse,
                  pending: true
                };
                return updated;
              });
            } 
            else if (data.type === "complete") {
              // Final update with citations and follow-ups
              setMessages(prev => {
                const updated = [...prev];
                updated[pendingIndex] = {
                  role: "assistant",
                  content: partialResponse,
                  citations: data.citations,
                  followupQuestions: data.followupQuestions,
                  pending: false
                };
                return updated;
              });
              
              // Store conversation ID for context
              if (!conversationId && data.conversationId) {
                setConversationId(data.conversationId);
              }
            }
          }
        }
      } catch (error) {
        console.error("Error querying:", error);
        // Handle error in UI
      } finally {
        setLoading(false);
      }
    };
    
    return (
      <div className="flex flex-col h-screen">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message, i) => (
            <div key={i} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`p-3 rounded-lg max-w-3xl ${
                message.role === "user" 
                  ? "bg-blue-500 text-white" 
                  : "bg-gray-100"
              }`}>
                {message.content}
                
                {/* Citation UI */}
                {message.citations && message.citations.length > 0 && (
                  <div className="mt-2 text-xs">
                    <p className="font-semibold">Sources:</p>
                    <ul className="list-disc list-inside">
                      {message.citations.map((citation, j) => (
                        <li key={j}>{citation.text} - {citation.source}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {/* Follow-up questions UI */}
                {message.followupQuestions && message.followupQuestions.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-semibold">You might also want to ask:</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {message.followupQuestions.map((q, j) => (
                        <button 
                          key={j}
                          onClick={() => {
                            setInput(q);
                          }}
                          className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 border-t">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask a question..."
              className="flex-1 px-4 py-2 border rounded-lg"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:bg-blue-300"
            >
              {loading ? "..." : "Send"}
            </button>
          </div>
        </form>
      </div>
    );
  }
  ```

- Implement streaming response display
  - Create React components for handling streaming responses
  - Implement progressive rendering of content
  - Add typing indicator for responses being generated

- Add citation support in UI
  - Create citation components with source information
  - Implement highlighting for cited text
  - Add functionality to navigate to source documents

### 4. Testing & Optimization

- Create test suite for Query Agent
  ```typescript
  // tests/queryAgent.test.ts
  describe("Query Agent", () => {
    test("Query analysis identifies intent correctly", async () => {
      // Test implementation
    });
    
    test("Complex queries are decomposed properly", async () => {
      // Test implementation
    });
    
    test("Citations are correctly extracted from generated answers", async () => {
      // Test implementation
    });
    
    test("Integration with Retrieval Agent works as expected", async () => {
      // Test implementation
    });
  });
  ```

- Optimize prompt templates
  - Fine-tune prompt templates for different query types
  - Create specialized prompts for different domains
  - Implement prompt version control for A/B testing

- Implement response caching
  - Add caching layer for common queries
  - Implement cache invalidation strategy
  - Add cache hit/miss metrics

## Deliverables

- Fully functional Query Agent implementation
- Integration with the existing Retrieval Agent
- Conversational UI with streaming responses
- Citation support for knowledge attribution
- Test suite for query functionality

## Success Criteria

- Query Agent can understand complex natural language questions
- Successful coordination between Query and Retrieval Agents
- Answers are comprehensive and include relevant citations
- UI provides a responsive conversational experience
- System provides helpful follow-up questions
- Ready for implementing the Knowledge Processing Agent in Phase 4 