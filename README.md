# Multi-Agentic RAG System

A multi-agent system for enhanced retrieval augmented generation using LangChain, LangGraph, and pgvector in Supabase.

## Features

- Next.js with App Router for the frontend
- TypeScript for type safety
- Supabase with pgvector for vector storage
- OpenAI embeddings (text-embedding-3-large) with 3072 dimensions stored as HALFVEC
- LangChain for LLM interactions
- LangGraph for agent workflows
- shadcn/ui for UI components

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account
- OpenAI API key

### Installation

1. Clone the repository

```bash
git clone https://github.com/yourusername/multi-agentic-rag.git
cd multi-agentic-rag
```

2. Install dependencies

```bash
npm install
```

3. Create a `.env.local` file in the root directory with the following variables:

```
# OpenAI API Key - Required for embeddings and chat
OPENAI_API_KEY=your_openai_key_here

# Supabase Configuration
SUPABASE_URL=your_supabase_url_here
SUPABASE_KEY=your_supabase_service_key_here

# LangSmith Configuration - Optional for tracing
LANGCHAIN_API_KEY=your_langchain_api_key_here
LANGCHAIN_PROJECT=multi-agent-rag
LANGCHAIN_TRACING_V2=true

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

4. Set up the Supabase database

```bash
# Install Supabase CLI if you haven't already
npm install -g supabase

# Login to Supabase
supabase login

# Initialize Supabase
supabase init

# Push migrations to your Supabase instance
npx supabase db push
```

5. Start the development server

```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Architecture

### Database Schema

- `documents` table with HALFVEC(3072) for storing embeddings
- Efficient HNSW index for fast similarity search

### Vector Store

- Using pgvector with HALFVEC data type for 3072-dimensional embeddings
- Cosine similarity for semantic search

### LLM Integration

- OpenAI GPT-3.5-turbo for generating responses
- text-embedding-3-large for embeddings with 3072 dimensions

### Multi-Agent System

- Simple workflow with thinking and answering nodes
- Future extensions to support specialized agents

## Usage

### Adding Documents

Documents can be added to the vector store programmatically:

```typescript
import { addDocumentsToVectorStore } from '@/lib/vectorstore';
import supabaseClient from '@/lib/supabase/client';
import { createVectorStore } from '@/lib/vectorstore';

async function addDocuments() {
  const vectorStore = await createVectorStore(supabaseClient);
  
  const texts = [
    "This is a sample document about AI",
    "Another document about machine learning"
  ];
  
  const metadatas = [
    { source: "AI textbook", page: 42 },
    { source: "ML course", lecture: 3 }
  ];
  
  await addDocumentsToVectorStore(vectorStore, texts, metadatas);
}
```

### Querying

Use the chat interface to interact with the system. It will use the workflow to process your query and generate a response.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
