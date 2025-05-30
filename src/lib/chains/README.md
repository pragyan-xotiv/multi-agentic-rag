# LLM Chains

This directory contains the specialized LLM chains used throughout the multi-agent RAG system. Each chain is designed to perform a specific function and is implemented as a standalone module with its own folder and README.

## Organization Philosophy

Chains are designed to be **loosely coupled** from the agents that use them. This design allows for:

- **Reusability**: Multiple agents can use the same chain
- **Testability**: Chains can be tested independently
- **Maintainability**: Changes to chain logic don't require agent modifications
- **Composability**: Chains can be combined in different ways as needs evolve

## Directory Structure

```
src/lib/chains/
├── README.md                           # This documentation file
├── disambiguation-chain/               # Resolves ambiguous entity references
├── request-analysis-chain/             # Analyzes query characteristics for search
├── search-method-selection-chain/      # Selects optimal retrieval strategies
├── hybrid-search-chain/                # Combines multiple search approaches
├── result-ranking-chain/               # Ranks and filters results
└── context-enhancement-chain/          # Enriches results with additional context
```

## Chain Implementation Pattern

Each chain follows a consistent implementation pattern:

```typescript
import { RunnableSequence } from "langchain/schema/runnable";
import { PromptTemplate } from "langchain/prompts";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { StringOutputParser } from "langchain/schema/output_parser";

export function createExampleChain() {
  // 1. Define the model
  const model = new ChatOpenAI({
    modelName: "gpt-4-1106-preview",
    temperature: 0.2,
  });

  // 2. Define the prompt template
  const promptTemplate = PromptTemplate.fromTemplate(`
    You are an AI assistant performing a specific task.
    
    Task: {task}
    Input: {input}
    
    Please process this information and provide the output.
  `);

  // 3. Create the chain
  const chain = RunnableSequence.from([
    promptTemplate,
    model,
    new StringOutputParser(),
  ]);

  return chain;
}
```

## Chain Interface Principle

Each chain should have:

1. **Clear Input/Output Interfaces**: Well-defined TypeScript interfaces for inputs and outputs
2. **Explicit Documentation**: Comments explaining purpose, usage, and behavior
3. **Factory Pattern**: Export a factory function that creates and returns the chain
4. **Configurability**: Accept configuration options where appropriate

Example interface pattern:

```typescript
// Input interface
export interface RequestAnalysisInput {
  query: string;
  userContext?: string;
  conversationHistory?: ConversationMessage[];
}

// Output interface
export interface RequestAnalysisOutput {
  entityTypes: string[];
  semanticAspects: string[];
  structuralNeeds: string[];
  complexityScore: number;
}

// Factory function
export function createRequestAnalysisChain(config?: RequestAnalysisConfig) {
  // Chain implementation
  // ...
  return chain;
}
```

## Current Chains

| Chain | Purpose | Status |
|-------|---------|--------|
| **Disambiguation Chain** | Resolves ambiguous entity references | 📝 Documented |
| **Request Analysis Chain** | Analyzes query characteristics for search | 🚫 Planned |
| **Search Method Selection Chain** | Selects optimal retrieval strategies | 🚫 Planned |
| **Hybrid Search Chain** | Combines multiple search approaches | 🚫 Planned |
| **Result Ranking Chain** | Ranks and filters results | 🚫 Planned |
| **Context Enhancement Chain** | Enriches results with additional context | 🚫 Planned |

## Retrieval Workflow

The Retrieval Agent chains work together in a sequence to process search requests:

```
┌─────────────────────┐     ┌───────────────────────┐     ┌────────────────────┐
│                     │     │                       │     │                    │
│  Request Analysis   │────▶│  Method Selection     │────▶│  Hybrid Search     │
│  Chain              │     │  Chain                │     │  Chain             │
│                     │     │                       │     │                    │
└─────────────────────┘     └───────────────────────┘     └────────────────────┘
                                                                    │
                                                                    ▼
┌─────────────────────┐     ┌───────────────────────┐     ┌────────────────────┐
│                     │     │                       │     │                    │
│  Final Results      │◀────│  Context Enhancement  │◀────│  Result Ranking    │
│                     │     │  Chain                │     │  Chain             │
│                     │     │                       │     │                    │
└─────────────────────┘     └───────────────────────┘     └────────────────────┘
```

## Usage in Retrieval Agent

The Retrieval Agent composes these chains to create its search workflow:

```typescript
import { createRequestAnalysisChain } from "../chains/request-analysis-chain";
import { createSearchMethodSelectionChain } from "../chains/search-method-selection-chain";
import { createHybridSearchChain } from "../chains/hybrid-search-chain";
import { createResultRankingChain } from "../chains/result-ranking-chain";
import { createContextEnhancementChain } from "../chains/context-enhancement-chain";

export class RetrievalAgent {
  private requestAnalysisChain;
  private searchMethodSelectionChain;
  private hybridSearchChain;
  private resultRankingChain;
  private contextEnhancementChain;
  
  constructor() {
    // Initialize chains
    this.requestAnalysisChain = createRequestAnalysisChain();
    this.searchMethodSelectionChain = createSearchMethodSelectionChain();
    this.hybridSearchChain = createHybridSearchChain();
    this.resultRankingChain = createResultRankingChain();
    this.contextEnhancementChain = createContextEnhancementChain();
  }
  
  async search(query: string, filters = {}) {
    // Analyze the query
    const analysis = await this.requestAnalysisChain.invoke({ query });
    
    // Select search methods
    const methods = await this.searchMethodSelectionChain.invoke({ 
      query, analysis 
    });
    
    // Execute search
    const rawResults = await this.hybridSearchChain.invoke({ 
      query, methods, filters 
    });
    
    // Rank results
    const rankedResults = await this.resultRankingChain.invoke({ 
      rawResults 
    });
    
    // Enhance context
    const enhancedResults = await this.contextEnhancementChain.invoke({
      results: rankedResults
    });
    
    return enhancedResults;
  }
} 
```

## Scraper Agent Chains

The following chains are part of the scraper agent subsystem:

### URL Analysis Chain
Evaluates URLs to determine their relevance to the scraping goal, estimates information value, and assigns priority scores.

### Authentication Detection Chain
Analyzes web pages to determine if authentication is required and prepares for human-in-the-loop authentication.

### Content Extraction Chain
Extracts valuable content from web pages, focusing on high-value elements while ignoring navigation, ads, and boilerplate.

### Link Discovery Chain
Identifies links on a web page, analyzes their context, and assigns priority scores based on expected information value.

### Progress Evaluation Chain
Assesses the overall progress of the scraping operation, calculating metrics about information density, relevance, uniqueness, and completeness.

### Navigation Decision Chain
Determines the next action in the scraping process: whether to continue scraping or complete the process.

## Scraper Agent Workflow

The scraper agent chains work together to form a complete web scraping workflow as illustrated below:

```
┌───────────────────────────────────────────────────────────────────┐
│                     SCRAPER AGENT WORKFLOW                        │
└───────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌───────────────┐     ┌────────────────┐     ┌────────────────────┐
│               │     │                │     │                    │
│  URL Analysis ├────►│ Authentication ├────►│ Content Extraction │
│  Chain        │     │ Detection      │     │ Chain              │
│               │     │ Chain          │     │                    │
└───────────────┘     └────────┬───────┘     └──────────┬─────────┘
                               │                        │
                               ▼                        │
                      ┌────────────────┐                │
                      │                │                │
                      │ Human Auth     │                │
                      │ (if required)  │                │
                      │                │                │
                      └────────┬───────┘                │
                               │                        │
                               └────────────────────────┘
                                        │
                                        ▼
┌───────────────┐     ┌────────────────┐     ┌────────────────────┐
│               │     │                │     │                    │
│  Navigation   │◄────┤ Progress       │◄────┤ Link Discovery     │
│  Decision     │     │ Evaluation     │     │ Chain              │
│  Chain        │     │ Chain          │     │                    │
│               │     │                │     │                    │
└───────┬───────┘     └────────────────┘     └────────────────────┘
        │
        ▼
┌───────────────┐
│ Continue?     │
│ ┌─────────┐   │
│ │   Yes   ├───┼────────┐
│ └─────────┘   │        │
│ ┌─────────┐   │        │
│ │   No    ├───┼────────┐
│ └─────────┘   │        │
└───────────────┘        │
                         ▼
                 ┌───────────────┐
                 │ Fetch Next    │
                 │ URL & Restart │
                 │ Workflow      │
                 └───────────────┘
                         │
                         └─────────────┐
                                       ▼
                               ┌───────────────┐
                               │ Final Output  │
                               │ Generation    │
                               │               │
                               └───────────────┘
```

## RAG System Chains

The following chains are part of the RAG retrieval and generation subsystem:

### Hybrid Search Chain
Combines vector, keyword, graph, and entity search methods to provide comprehensive search results.

### Context Enhancement Chain
Enhances the retrieved context to improve the quality of the generated response.

### Result Ranking Chain
Ranks search results based on relevance and other quality metrics.

### Search Method Selection Chain
Selects the most appropriate search method based on the query characteristics.

### Request Analysis Chain
Analyzes the user request to determine the optimal search and generation strategy.

### Disambiguation Chain
Handles ambiguous user queries by requesting clarification when needed.