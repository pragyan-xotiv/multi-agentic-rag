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