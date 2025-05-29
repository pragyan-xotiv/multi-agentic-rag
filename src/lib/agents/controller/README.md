# Controller Agent

The Controller Agent serves as the master orchestrator for the multi-agent system. It receives all user requests, determines the appropriate processing workflow, coordinates between specialized agents, and manages disambiguation when needed.

> **Implementation Phase:** This agent is central to the system architecture and coordinates the workflows defined in all other agent phases.

## Workflow Diagram

```mermaid
graph TD
    User([User]) --> Controller[Controller Agent]
    
    Controller --> |Question| Query[Query Agent]
    Controller --> |Scrape Request| Scraper[Scraper Agent]
    Controller --> |Process Content| Knowledge[Knowledge Processing Agent]
    
    Query --> |Retrieval Request| Retrieval[Retrieval Agent]
    Scraper --> |Raw Content| Knowledge
    Knowledge --> |Structured Knowledge| DB[(Knowledge Base)]
    Retrieval <--> |Search Operations| DB
    
    Query --> |Answer| Controller
    Scraper --> |Scraping Result| Controller
    Knowledge --> |Processing Result| Controller
    Retrieval --> |Search Results| Query
    
    Controller --> |Response| User
    
    %% Decision points
    Controller --> |Ambiguous Request| Disambiguate[Disambiguation]
    Disambiguate --> Controller
    
    Controller --> |Authentication Needed| Auth[Request Authentication]
    Auth --> User
    User --> |Provide Auth| Auth
    Auth --> Controller
    
    classDef masterNode fill:#ff9999,stroke:#333,stroke-width:2px;
    classDef agentNode fill:#d4f1f9,stroke:#05386b,stroke-width:1px;
    classDef decisionNode fill:#fcf3cf,stroke:#333,stroke-width:1px;
    classDef userNode fill:#f9d4af,stroke:#865a36,stroke-width:2px;
    classDef dbNode fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px;
    
    class Controller masterNode;
    class Query,Retrieval,Scraper,Knowledge agentNode;
    class Disambiguate,Auth decisionNode;
    class User userNode;
    class DB dbNode;
```

## Decision Flow Diagram

```mermaid
sequenceDiagram
    actor User
    participant Controller as Controller Agent
    participant Query as Query Agent
    participant Retrieval as Retrieval Agent
    participant Scraper as Scraper Agent
    participant Knowledge as Knowledge Processing Agent
    
    User->>Controller: Submit request
    
    %% Intent determination
    activate Controller
    Note over Controller: Analyze request intent
    
    alt General knowledge query
        Controller->>Query: Process query
        activate Query
        Query->>Retrieval: Retrieve information
        Retrieval-->>Query: Return results
        Query-->>Controller: Return answer
        deactivate Query
        
    else Entity with insufficient info
        Controller->>User: Ask for URL to scrape
        User->>Controller: Provide URL
        Controller->>Scraper: Scrape URL
        activate Scraper
        
        alt Authentication required
            Scraper->>User: Request authentication
            User->>Scraper: Provide authentication
        end
        
        Scraper->>Knowledge: Process scraped content
        activate Knowledge
        Knowledge-->>Scraper: Confirm processing
        deactivate Knowledge
        Scraper-->>Controller: Return scraping results
        deactivate Scraper
        Controller->>Query: Process original query with new info
        activate Query
        Query-->>Controller: Return answer
        deactivate Query
        
    else Ambiguous entity
        Controller->>User: Request disambiguation
        User->>Controller: Clarify intent
        Controller->>Query: Process clarified query
        activate Query
        Query-->>Controller: Return answer
        deactivate Query
    end
    
    Controller-->>User: Return final response
    deactivate Controller
```

## Controller Agent Workflow as Markdown Text

```
                        ┌────────────────────────────────────────────────────┐
                        │        🤖 CONTROLLER AGENT WORKFLOW 🤖             │
                        └────────────────────────────────────────────────────┘
                                                 │
                                                 ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│                              🧠 REQUEST ANALYSIS 🧠                                            │
│                                                                                                │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐        │
│  │                        📊 Analyze User Intent                                       │        │
│  │                                                                                    │        │
│  │  • 🔍 Identify request type (question, scraping request, hybrid)                   │        │
│  │  • 👤 Extract entity mentions and check knowledge coverage                         │        │
│  │  • 📏 Calculate confidence score for intent classification                         │        │
│  │  • 🧩 Determine if disambiguation is needed                                        │        │
│  └────────────────────────────────────────────────────────────────────────────────────┘        │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                 │
                                                 ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│                              🧩 DECISION PROCESSING 🧩                                         │
│                                                                                                │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐        │
│  │                       🔀 Route Request                                              │        │
│  │                                                                                    │        │
│  │  • 🗺️ Select appropriate agent(s) to handle request                                │        │
│  │  • 📋 Prepare necessary context for selected agent(s)                              │        │
│  │  • 🔄 Determine if workflow involves multiple agents                               │        │
│  └────────────────────────────────────────────────────────────────────────────────────┘        │
│                                            │                                                   │
│                                            ▼                                                   │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐        │
│  │                       🔍 Handle Ambiguity                                           │        │
│  │                                                                                    │        │
│  │  • ❓ Detect ambiguous entities or intents                                         │        │
│  │  • 📝 Generate disambiguation options                                              │        │
│  │  • 🔄 Process user clarification                                                   │        │
│  └────────────────────────────────────────────────────────────────────────────────────┘        │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                 │
                                                 ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│                            🔄 WORKFLOW ORCHESTRATION 🔄                                        │
│                                                                                                │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐        │
│  │                       🚀 Coordinate Agents                                          │        │
│  │                                                                                    │        │
│  │  • 📤 Dispatch requests to appropriate agents                                      │        │
│  │  • 🔄 Manage agent communication                                                   │        │
│  │  • 📊 Track workflow progress                                                      │        │
│  │  • 🔍 Handle exceptions and errors                                                 │        │
│  └────────────────────────────────────────────────────────────────────────────────────┘        │
│                                            │                                                   │
│                                            ▼                                                   │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐        │
│  │                      🔐 Manage Authentication                                       │        │
│  │                                                                                    │        │
│  │  • 🚪 Detect authentication requirements                                           │        │
│  │  • 📱 Request user authentication when needed                                      │        │
│  │  • 🔑 Securely pass credentials to agents                                          │        │
│  │  • 🔄 Handle authentication failures                                               │        │
│  └────────────────────────────────────────────────────────────────────────────────────┘        │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                 │
                                                 ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│                              📋 RESPONSE MANAGEMENT 📋                                         │
│                                                                                                │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐        │
│  │                      📝 Process Agent Responses                                     │        │
│  │                                                                                    │        │
│  │  • 🔄 Consolidate responses from multiple agents                                   │        │
│  │  • 📊 Ensure response quality and completeness                                     │        │
│  │  • 🧩 Format final response for user                                               │        │
│  └────────────────────────────────────────────────────────────────────────────────────┘        │
│                                            │                                                   │
│                                            ▼                                                   │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐        │
│  │                     📋 Update Memory                                                │        │
│  │                                                                                    │        │
│  │  • 💾 Update conversation history                                                  │        │
│  │  • 🧠 Track entities and user preferences                                          │        │
│  │  • 📊 Record workflow performance metrics                                          │        │
│  └────────────────────────────────────────────────────────────────────────────────────┘        │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                 │
                                                 ▼
                        ┌────────────────────────────────────────────────────┐
                        │              ✅ FINAL RESPONSE ✅                   │
                        │                                                    │
                        │  • 📄 Send formatted response to user              │
                        │  • 🔄 Prepare for next interaction                 │
                        └────────────────────────────────────────────────────┘
```

## Decision Tree

```
┌───────────────────────────────────────────────────────────────────────────┐
│                          CONTROLLER AGENT DECISION TREE                    │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ├─ Is this a QUESTION?                                                   │
│  │  ├─ YES                                                                │
│  │  │  ├─ Do we have sufficient information?                              │
│  │  │  │  ├─ YES → Route to Query Agent                                   │
│  │  │  │  └─ NO → Ask user for more information or URL to scrape          │
│  │  │  │                                                                  │
│  │  │  └─ Is entity ambiguous?                                            │
│  │  │     ├─ YES → Present disambiguation options                         │
│  │  │     └─ NO → Proceed with query                                      │
│  │  │                                                                     │
│  │  └─ NO                                                                 │
│  │                                                                        │
│  ├─ Is this a SCRAPING request?                                           │
│  │  ├─ YES                                                                │
│  │  │  ├─ Is URL provided?                                                │
│  │  │  │  ├─ YES → Route to Scraper Agent                                 │
│  │  │  │  └─ NO → Ask user for URL                                        │
│  │  │  │                                                                  │
│  │  │  └─ Will authentication be needed?                                  │
│  │  │     ├─ YES → Prepare for human authentication                       │
│  │  │     └─ NO → Proceed with scraping                                   │
│  │  │                                                                     │
│  │  └─ NO                                                                 │
│  │                                                                        │
│  └─ Is this a HYBRID request?                                             │
│     ├─ YES → Plan multi-agent workflow                                    │
│     └─ NO → Request clarification from user                               │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
``` 