# Phase 8: Controller Agent

**Duration: 3-4 weeks**

Implement the Controller Agent to serve as the master orchestrator for the multi-agent RAG system.

## Overview

The Controller Agent serves as the central coordination component for the entire multi-agent system. It handles all user requests, determines the appropriate processing workflow, coordinates between specialized agents, and manages disambiguation when needed.

## Key Objectives

- Build the Controller Agent infrastructure with LangGraph
- Implement decision-making workflows for request routing
- Create disambiguation handling mechanisms
- Develop authentication coordination
- Implement inter-agent communication management

## Tasks

### 1. Controller Agent Infrastructure

- Set up the core controller state management
  ```typescript
  // agents/controller/types.ts
  export interface ControllerAgentState {
    userId: string;
    conversationId: string;
    currentRequest: UserRequest;
    
    requestAnalysis: {
      intent: RequestIntent;
      entities: Entity[];
      confidence: number;
      requiresDisambiguation: boolean;
    };
    
    workflowState: {
      activeAgents: AgentType[];
      pendingResponses: Map<AgentType, boolean>;
      authentication: AuthenticationState;
    };
    
    agentResponses: Map<AgentType, AgentResponse>;
    finalResponse: FinalResponse | null;
  }
  
  export enum RequestIntent {
    QUESTION = "question",
    SCRAPING = "scraping",
    HYBRID = "hybrid"
  }
  
  export enum AgentType {
    QUERY = "query",
    RETRIEVAL = "retrieval",
    KNOWLEDGE_PROCESSING = "knowledge_processing",
    SCRAPER = "scraper"
  }
  ```

- Define controller workflow
  ```typescript
  // agents/controller/workflow.ts
  import { StateGraph, Channel } from "langchain/graphs";
  
  const controllerWorkflow = new StateGraph<ControllerAgentState>({
    channels: {
      requestAnalysis: new Channel(),
      agentCoordination: new Channel(),
      userInteraction: new Channel()
    }
  })
    .addNode("analyzeRequest", analyzeUserRequest)
    .addNode("routeRequest", determineAgentRouting)
    .addNode("handleDisambiguation", processDisambiguation)
    .addNode("coordinateAgents", manageAgentWorkflow)
    .addNode("processAuthentication", handleAuthenticationRequests)
    .addNode("aggregateResponses", combineAgentResponses)
    .addNode("formatFinalResponse", prepareFinalResponse)
    
    .addEdge("analyzeRequest", "routeRequest")
    
    .addConditionalEdge(
      "routeRequest",
      (state) => {
        if (state.requestAnalysis.requiresDisambiguation) {
          return "handleDisambiguation";
        }
        return "coordinateAgents";
      }
    )
    
    .addEdge("handleDisambiguation", "coordinateAgents")
    .addEdge("coordinateAgents", "aggregateResponses")
    .addEdge("aggregateResponses", "formatFinalResponse")
    .addEdge("formatFinalResponse", "FINAL");
  
  export const controllerAgent = controllerWorkflow.compile();
  ```

### 2. Decision-Making Components

- Implement request analysis engine
  ```typescript
  // agents/controller/components/requestAnalyzer.ts
  async function analyzeUserRequest(
    state: ControllerAgentState, 
    context: AgentContext
  ): Promise<ControllerAgentState> {
    const { currentRequest } = state;
    
    // Use LLM to analyze intent
    const intentAnalysis = await context.llm.invoke(
      `Analyze the following user request and determine:
      1. The primary intent (QUESTION, SCRAPING, or HYBRID)
      2. Any entities mentioned
      3. If disambiguation is needed
      
      User request: ${currentRequest.text}
      
      Respond in JSON format.`
    );
    
    // Parse the LLM response and update state
    const analysis = JSON.parse(intentAnalysis);
    
    return {
      ...state,
      requestAnalysis: {
        intent: analysis.intent,
        entities: analysis.entities,
        confidence: analysis.confidence,
        requiresDisambiguation: analysis.requiresDisambiguation
      }
    };
  }
  ```

- Build agent routing system
  ```typescript
  // agents/controller/components/router.ts
  async function determineAgentRouting(
    state: ControllerAgentState, 
    context: AgentContext
  ): Promise<ControllerAgentState> {
    const { requestAnalysis } = state;
    const activeAgents: AgentType[] = [];
    
    switch(requestAnalysis.intent) {
      case RequestIntent.QUESTION:
        activeAgents.push(AgentType.QUERY);
        activeAgents.push(AgentType.RETRIEVAL);
        break;
      case RequestIntent.SCRAPING:
        activeAgents.push(AgentType.SCRAPER);
        activeAgents.push(AgentType.KNOWLEDGE_PROCESSING);
        break;
      case RequestIntent.HYBRID:
        activeAgents.push(AgentType.QUERY);
        activeAgents.push(AgentType.SCRAPER);
        activeAgents.push(AgentType.KNOWLEDGE_PROCESSING);
        activeAgents.push(AgentType.RETRIEVAL);
        break;
    }
    
    return {
      ...state,
      workflowState: {
        ...state.workflowState,
        activeAgents,
        pendingResponses: new Map(
          activeAgents.map(agent => [agent, true])
        )
      }
    };
  }
  ```

- Create disambiguation handler
  ```typescript
  // agents/controller/components/disambiguator.ts
  async function processDisambiguation(
    state: ControllerAgentState, 
    context: AgentContext
  ): Promise<ControllerAgentState> {
    const { requestAnalysis, currentRequest } = state;
    
    // Generate disambiguation options based on entities
    const options = await generateDisambiguationOptions(
      requestAnalysis.entities,
      context
    );
    
    // Present options to user and get clarification
    const userClarification = await context.userInteraction.requestClarification(
      options
    );
    
    // Update request analysis with clarified intent
    return {
      ...state,
      requestAnalysis: {
        ...state.requestAnalysis,
        entities: updateEntitiesWithClarification(
          requestAnalysis.entities,
          userClarification
        ),
        requiresDisambiguation: false
      }
    };
  }
  ```

### 3. Authentication Coordination

- Implement authentication detection
  ```typescript
  // agents/controller/components/authHandler.ts
  async function detectAuthenticationNeeds(
    url: string,
    context: AgentContext
  ): Promise<boolean> {
    // Check if URL likely requires authentication
    const authDetection = await context.llm.invoke(
      `Does the URL ${url} likely require authentication to access its content?
      Consider factors like:
      - Is it a private platform (GitHub private repo, LinkedIn, etc.)
      - Does it typically have login walls
      - Is it a platform with authentication requirements
      
      Answer YES or NO.`
    );
    
    return authDetection.trim().toUpperCase().includes("YES");
  }
  ```

- Create authentication request manager
  ```typescript
  // agents/controller/components/authManager.ts
  async function handleAuthenticationRequests(
    state: ControllerAgentState,
    context: AgentContext
  ): Promise<ControllerAgentState> {
    if (!state.workflowState.authentication.required) {
      return state;
    }
    
    // Request authentication from user
    const authCredentials = await context.userInteraction.requestAuthentication(
      state.workflowState.authentication.url,
      state.workflowState.authentication.authType
    );
    
    // Update authentication state
    return {
      ...state,
      workflowState: {
        ...state.workflowState,
        authentication: {
          ...state.workflowState.authentication,
          credentials: authCredentials,
          completed: true
        }
      }
    };
  }
  ```

### 4. Inter-Agent Communication

- Build agent coordinator
  ```typescript
  // agents/controller/components/coordinator.ts
  async function manageAgentWorkflow(
    state: ControllerAgentState,
    context: AgentContext
  ): Promise<ControllerAgentState> {
    const { workflowState, currentRequest } = state;
    const { activeAgents } = workflowState;
    
    // Prepare requests for each active agent
    const agentRequests = prepareAgentRequests(
      activeAgents,
      currentRequest,
      state
    );
    
    // Dispatch requests to agents
    const agentPromises = activeAgents.map(agentType => 
      dispatchToAgent(agentType, agentRequests[agentType], context)
    );
    
    // Wait for all agent responses
    const agentResponses = await Promise.all(agentPromises);
    
    // Update state with agent responses
    const responseMap = new Map();
    activeAgents.forEach((agent, index) => {
      responseMap.set(agent, agentResponses[index]);
    });
    
    return {
      ...state,
      agentResponses: responseMap,
      workflowState: {
        ...workflowState,
        pendingResponses: new Map(
          Array.from(workflowState.pendingResponses.entries())
            .map(([agent, _]) => [agent, false])
        )
      }
    };
  }
  ```

- Implement response aggregation
  ```typescript
  // agents/controller/components/responseAggregator.ts
  async function combineAgentResponses(
    state: ControllerAgentState,
    context: AgentContext
  ): Promise<ControllerAgentState> {
    const { agentResponses, requestAnalysis } = state;
    
    // Merge responses based on request intent
    let mergedResponse;
    
    switch(requestAnalysis.intent) {
      case RequestIntent.QUESTION:
        mergedResponse = agentResponses.get(AgentType.QUERY);
        break;
      case RequestIntent.SCRAPING:
        mergedResponse = combineScrapingResponses(
          agentResponses.get(AgentType.SCRAPER),
          agentResponses.get(AgentType.KNOWLEDGE_PROCESSING)
        );
        break;
      case RequestIntent.HYBRID:
        mergedResponse = createHybridResponse(agentResponses, context);
        break;
    }
    
    return {
      ...state,
      finalResponse: {
        content: mergedResponse,
        metadata: {
          timestamp: new Date().toISOString(),
          sources: extractSources(agentResponses)
        }
      }
    };
  }
  ```

### 5. UI Integration

- Create controller API endpoints
  ```typescript
  // app/api/controller/route.ts
  import { NextRequest, NextResponse } from "next/server";
  import { ControllerAgent } from "@/lib/agents/controller";
  
  export async function POST(req: NextRequest) {
    const { userId, conversationId, message } = await req.json();
    
    const controller = new ControllerAgent();
    const response = await controller.handleRequest({
      userId,
      conversationId,
      text: message
    });
    
    return NextResponse.json(response);
  }
  ```

- Build UI components for disambiguation
  ```tsx
  // components/DisambiguationDialog.tsx
  import { useState } from "react";
  import { Dialog } from "@/components/ui/dialog";
  
  export function DisambiguationDialog({ 
    options, 
    onSelect 
  }: {
    options: DisambiguationOption[];
    onSelect: (selected: DisambiguationOption) => void;
  }) {
    const [open, setOpen] = useState(true);
    
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <Dialog.Title>Clarification Needed</Dialog.Title>
        <Dialog.Description>
          Please select one of the following options to clarify your request:
        </Dialog.Description>
        
        <div className="grid gap-4 py-4">
          {options.map((option) => (
            <button
              key={option.id}
              className="text-left p-4 border rounded hover:bg-gray-100"
              onClick={() => {
                onSelect(option);
                setOpen(false);
              }}
            >
              <h3 className="font-medium">{option.title}</h3>
              <p className="text-sm text-gray-500">{option.description}</p>
            </button>
          ))}
        </div>
      </Dialog>
    );
  }
  ```

- Implement authentication request components
  ```tsx
  // components/AuthenticationRequest.tsx
  import { useState } from "react";
  import { Dialog } from "@/components/ui/dialog";
  import { Input } from "@/components/ui/input";
  import { Button } from "@/components/ui/button";
  
  export function AuthenticationRequest({
    url,
    authType,
    onSubmit
  }: {
    url: string;
    authType: string;
    onSubmit: (credentials: any) => void;
  }) {
    const [open, setOpen] = useState(true);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <Dialog.Title>Authentication Required</Dialog.Title>
        <Dialog.Description>
          The page at {url} requires authentication to access its content.
        </Dialog.Description>
        
        <form
          className="grid gap-4 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({ username, password });
            setOpen(false);
          }}
        >
          <Input
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          
          <Button type="submit">Submit</Button>
        </form>
      </Dialog>
    );
  }
  ```

## Integration with Other Agents

The Controller Agent interfaces with all other agents in the system:

1. **Query Agent** - Directs complex question processing
2. **Retrieval Agent** - Coordinates knowledge retrieval operations
3. **Knowledge Processing Agent** - Manages content processing requests
4. **Scraper Agent** - Handles web scraping operations and authentication

## References

For detailed Controller Agent workflow and decision trees, refer to:
- [Controller Agent README](../../../src/lib/agents/controller/README.md) 