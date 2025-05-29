# Multi-Agent Communication

## Agent Communication Workflow

```mermaid
graph TD
    User([User]) --> |Questions/Requests| Controller
    
    Controller[Controller Agent] --> |Query Processing| Query
    Controller --> |Scrape Requests| Scraper
    Controller --> |Content Processing| Knowledge
    Controller --> |Authentication Requests| User
    
    Query[Query Agent] --> |Retrieval Requests| Retrieval
    Retrieval[Retrieval Agent] --> |Search Results| Query
    Query --> |Answers| Controller
    
    Scraper[Scraper Agent] --> |Raw Content| Knowledge
    Knowledge[Knowledge Processing Agent] --> |Structured Knowledge| DB[(Knowledge Base)]
    Knowledge --> |Processing Result| Controller
    Scraper --> |Scraping Result| Controller
    
    Retrieval <--> |Database Operations| DB
    
    %% Event-based communication
    Knowledge --> |Knowledge Update Events| Retrieval
    Knowledge --> |Entity Updates| Query
    
    classDef userNode fill:#f9d4af,stroke:#865a36,stroke-width:2px;
    classDef masterNode fill:#ff9999,stroke:#333,stroke-width:2px;
    classDef agentNode fill:#d4f1f9,stroke:#05386b,stroke-width:1px;
    classDef dbNode fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px;
    
    class User userNode;
    class Controller masterNode;
    class Query,Retrieval,Scraper,Knowledge agentNode;
    class DB dbNode;
```

## Message Flow Diagram

```mermaid
sequenceDiagram
    actor User
    participant Controller as Controller Agent
    participant Query as Query Agent
    participant Retrieval as Retrieval Agent
    participant Scraper as Scraper Agent
    participant Knowledge as Knowledge Processing Agent
    participant DB as Knowledge Base
    
    %% Initial request
    User->>Controller: Submit request
    activate Controller
    
    %% Controller analyzes request
    Note over Controller: Analyze request intent
    
    %% Query flow
    alt Question request
        Controller->>Query: Process query
        activate Query
        Query->>Retrieval: Send retrieval request
        activate Retrieval
        Retrieval->>DB: Execute search operations
        DB-->>Retrieval: Return search results
        Retrieval-->>Query: Return structured results
        deactivate Retrieval
        Query-->>Controller: Return answer
        deactivate Query
        Controller-->>User: Return final response
        
    %% Scraping flow
    else Scraping request
        Controller->>Scraper: Request content scraping
        activate Scraper
        
        alt Authentication required
            Scraper->>Controller: Signal authentication needed
            Controller->>User: Request authentication
            User-->>Controller: Provide authentication
            Controller-->>Scraper: Forward authentication
        end
        
        Scraper->>Knowledge: Send extracted content
        activate Knowledge
        Knowledge->>DB: Store processed knowledge
        Knowledge-->>Scraper: Confirm processing
        deactivate Knowledge
        Scraper-->>Controller: Return scraping results
        deactivate Scraper
        Controller-->>User: Return final response
        
    %% Hybrid flow
    else Hybrid request
        Controller->>Scraper: Request content scraping
        activate Scraper
        Scraper-->>Controller: Return scraping results
        deactivate Scraper
        
        Controller->>Knowledge: Process scraped content
        activate Knowledge
        Knowledge->>DB: Store processed knowledge
        Knowledge-->>Controller: Confirm processing
        deactivate Knowledge
        
        Controller->>Query: Process original query with new info
        activate Query
        Query->>Retrieval: Send retrieval request
        activate Retrieval
        Retrieval->>DB: Execute search operations
        DB-->>Retrieval: Return search results
        Retrieval-->>Query: Return structured results
        deactivate Retrieval
        Query-->>Controller: Return answer
        deactivate Query
        
        Controller-->>User: Return final response
    end
    
    deactivate Controller
    
    %% Knowledge update flow
    Knowledge->>Retrieval: Publish knowledge update event
    activate Retrieval
    Retrieval->>DB: Refresh indexes
    Retrieval-->>Knowledge: Acknowledge update
    deactivate Retrieval
```

## Agent Communication Workflow as Markdown Text

```
                        ┌────────────────────────────────────────────────────┐
                        │        🤖 MULTI-AGENT COMMUNICATION FLOW 🤖        │
                        └────────────────────────────────────────────────────┘
                                                 │
                                                 ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                              👤 USER INTERACTION LAYER 👤                                    │
│                                                                                              │
│     ┌──────────────────────────────────┐                ┌────────────────────────────┐       │
│     │      🔍 Query Submission         │                │    🌐 Scrape Request       │       │
│     │                                  │                │                            │       │
│     │  User submits natural            │                │  User requests scraping    │       │
│     │  language questions              │                │  of specific websites      │       │
│     └──────────────────┬───────────────┘                └───────────────┬────────────┘       │
│                        │                                                │                    │
└────────────────────────┼────────────────────────────────────────────────┼────────────────────┘
                         │                                                │
                         └────────────────────┬───────────────────────────┘
                                              │
                                              ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                              🎮 CONTROLLER AGENT LAYER 🎮                                    │
│                                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐      │
│  │                                                                                    │      │
│  │  • 🧠 Analyzes user request intent                                                 │      │
│  │  • 🔀 Routes requests to appropriate specialized agents                            │      │
│  │  • 🧩 Handles disambiguation when intent or entities are unclear                   │      │
│  │  • 🔐 Coordinates authentication when needed                                       │      │
│  │  • 📊 Aggregates responses from multiple agents                                    │      │
│  │  • 📝 Formats final response for user                                              │      │
│  │                                                                                    │      │
│  └───────────┬──────────────────────┬───────────────────────┬──────────────────┬─────┘      │
│              │                      │                       │                  │            │
└──────────────┼──────────────────────┼───────────────────────┼──────────────────┼────────────┘
               │                      │                       │                  │
               ▼                      ▼                       ▼                  ▼
┌─────────────────────┐   ┌──────────────────┐   ┌────────────────────┐   ┌─────────────────┐
│   🧠 QUERY AGENT    │   │ 🔍 RETRIEVAL AGENT│   │ 🕸️ SCRAPER AGENT   │   │📊 KNOWLEDGE AGENT│
│                     │   │                  │   │                    │   │                 │
│ • Analyzes questions│   │ • Executes search│   │ • Navigates websites│   │ • Analyzes content│
│ • Decomposes queries│   │ • Ranks results  │   │ • Extracts content │   │ • Extracts entities│
│ • Plans retrieval   │   │ • Filters info   │   │ • Handles auth     │   │ • Finds relations │
│ • Synthesizes answer│   │ • Returns results│   │ • Prioritizes data │   │ • Integrates data │
└──────────┬──────────┘   └────────┬─────────┘   └──────────┬─────────┘   └─────────┬───────┘
           │                       │                        │                       │
           │                       │                        │                       │
           │                       ▼                        │                       │
           │             ┌──────────────────┐              │                       │
           │             │    Knowledge     │◀─────────────┘                       │
           └────────────▶│      Base        │◀──────────────────────────────────────┘
                         └──────────────────┘
```

## Message Types and Channels

```
┌─────────────────────────────────────────────────────────────────┐
│       Controller Agent ←→ Specialized Agents Messages           │
├─────────────────────────────┬───────────────────────────────────┤
│    agentRequest             │    agentResponse                  │
├─────────────────────────────┼───────────────────────────────────┤
│  • requestId: string        │  • requestId: string              │
│  • intent: RequestIntent    │  • content: string                │
│  • payload: object          │  • metadata: object               │
│  • options: object          │  • status: ResponseStatus         │
└─────────────────────────────┴───────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│            Query Agent ←→ Retrieval Agent Messages              │
├─────────────────────────────┬───────────────────────────────────┤
│    retrievalRequest         │    retrievalResponse              │
├─────────────────────────────┼───────────────────────────────────┤
│  • query: string            │  • content: string                │
│  • filters: object          │  • results: RetrievedChunk[]      │
│  • strategies: string[]     │  • evaluation: object             │
└─────────────────────────────┴───────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│         Scraper Agent ←→ Knowledge Agent Messages               │
├─────────────────────────────┬───────────────────────────────────┤
│    processingRequest        │    processingResponse             │
├─────────────────────────────┼───────────────────────────────────┤
│  • content: ContentItem[]   │  • entities: Entity[]             │
│  • metadata: object         │  • relationships: Relationship[]  │
│  • options: object          │  • chunks: ProcessedChunk[]       │
└─────────────────────────────┴───────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│         Knowledge Agent ←→ Retrieval Agent Messages             │
├─────────────────────────────┬───────────────────────────────────┤
│    knowledgeUpdateEvent     │    indexUpdateConfirmation        │
├─────────────────────────────┼───────────────────────────────────┤
│  • timestamp: Date          │  • success: boolean               │
│  • changeSet: object        │  • updatedIndexes: string[]       │
│  • source: string           │  • timestamp: Date                │
└─────────────────────────────┴───────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│         Controller Agent ←→ User Messages                       │
├─────────────────────────────┬───────────────────────────────────┤
│    disambiguationRequest    │    disambiguationResponse         │
├─────────────────────────────┼───────────────────────────────────┤
│  • options: Option[]        │  • selectedOption: Option         │
│  • context: string          │  • additionalInfo: string         │
│  • requestId: string        │  • requestId: string              │
└─────────────────────────────┴───────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│         Controller Agent ←→ User Authentication                 │
├─────────────────────────────┬───────────────────────────────────┤
│    authenticationRequest    │    authenticationResponse         │
├─────────────────────────────┼───────────────────────────────────┤
│  • url: string              │  • credentials: object            │
│  • authType: string         │  • success: boolean               │
│  • requestId: string        │  • requestId: string              │
└─────────────────────────────┴───────────────────────────────────┘
``` 