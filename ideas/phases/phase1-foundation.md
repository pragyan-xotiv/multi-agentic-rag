# Phase 1: Foundation & Knowledge Base

**Duration: 2-3 weeks**

Focus on establishing the foundational infrastructure and knowledge storage components.

## Overview

The foundation phase focuses on setting up the core technical infrastructure that will support the entire multi-agent system. This includes the Next.js application framework, Supabase database with vector storage capabilities, and basic user interface components.

## Key Objectives

- Set up development environment and project structure
- Implement database schema and vector storage
- Create basic UI scaffolding and authentication system
- Establish a solid foundation for future agent implementations

## Tasks

### 1. Next.js Project Setup

- Initialize Next.js 14 project with App Router
  ```bash
  npx create-next-app@latest multi-agent-rag --typescript --tailwind --eslint --app
  ```
- Set up TypeScript configuration
  - Configure strict type checking
  - Set up path aliases for clean imports
- Configure development environment
  - Set up ESLint and Prettier
  - Create environment variable templates
  - Configure Husky for pre-commit hooks
- Set up LangChain, LangGraph, and LangSmith integration
  ```bash
  # Install LangChain and related packages
  npm install langchain @langchain/openai @langchain/community langsmith
  
  # Install LangGraph for agent orchestration
  npm install @langchain/langgraph
  ```
  
  ```typescript
  // lib/langchain/index.ts
  import { OpenAI } from '@langchain/openai';
  import { SupabaseVectorStore } from '@langchain/community/vectorstores/supabase';
  import { OpenAIEmbeddings } from '@langchain/openai';
  
  // Set up default models
  export const EMBEDDING_MODEL = 'text-embedding-3-large';
  export const LLM_MODEL = 'gpt-3.5-turbo';
  
  // Configure LangSmith for tracing
  if (process.env.LANGCHAIN_API_KEY) {
    process.env.LANGCHAIN_TRACING_V2 = 'true';
    process.env.LANGCHAIN_PROJECT = process.env.LANGCHAIN_PROJECT || 'multi-agent-rag';
  }
  
  // Create OpenAI embedding model
  export function createEmbeddings() {
    return new OpenAIEmbeddings({
      modelName: EMBEDDING_MODEL,
      dimensions: 3072,
      stripNewLines: true,
    });
  }
  
  // Create OpenAI chat model
  export function createLLM(options = {}) {
    return new OpenAI({
      modelName: LLM_MODEL,
      temperature: 0.7,
      ...options,
    });
  }
  ```

### 2. Supabase Integration

- Set up Supabase project
  - Create new project in Supabase dashboard
  - Configure database settings
  - Set up access policies
- Configure PostgreSQL with pgvector extension
  - Enable pgvector extension
  - Create vector-compatible columns
  - Set up appropriate indexes
- Create initial database schema using migrations
  ```bash
  # Create a new migration file
  npx supabase migration new create_documents_table
  ```
  
  Then add the SQL to the generated migration file:
  ```sql
  -- migration file: supabase/migrations/TIMESTAMP_create_documents_table.sql
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
  CREATE EXTENSION IF NOT EXISTS vector;

  CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content TEXT NOT NULL,
    metadata JSONB,
    embedding HALFVEC(3072),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  CREATE INDEX documents_embedding_idx ON documents 
  USING hnsw (embedding halfvec_cosine_ops);
  ```
  
  Apply the migration to the database:
  ```bash
  # Push the migration to the database
  npx supabase db push
  ```
  
  Add schema types generation for TypeScript:
  ```bash
  # Generate TypeScript types from the database schema
  npx supabase gen types typescript --local > lib/database.types.ts
  ```
- Implement basic CRUD operations
  - Create document repository class
  - Implement create, read, update, delete operations
  - Add filtering and pagination support

### 3. Vector Store Implementation

- Set up LangChain SupabaseVectorStore
  ```typescript
  // lib/vectorstore/index.ts
  import { SupabaseClient } from '@supabase/supabase-js';
  import { SupabaseVectorStore } from '@langchain/community/vectorstores/supabase';
  import { Document } from 'langchain/document';
  import { createEmbeddings } from '../langchain';
  
  // Initialize Supabase vector store with LangChain
  export async function createVectorStore(
    supabaseClient: SupabaseClient,
    tableName: string = 'documents',
    queryName: string = 'match_documents'
  ) {
    // Using OpenAI embeddings with dimensions=3072
    // We're storing these as HALFVEC (half-precision) to allow efficient 
    // indexing of all dimensions and reduce storage requirements by 50%
    const embeddings = createEmbeddings();
    
    return await SupabaseVectorStore.fromExistingIndex(
      embeddings,
      {
        client: supabaseClient,
        tableName,
        queryName,
      }
    );
  }
  
  // Helper to add documents to the vector store
  export async function addDocumentsToVectorStore(
    vectorStore: SupabaseVectorStore,
    texts: string[],
    metadatas: Record<string, any>[] = []
  ) {
    const documents = texts.map((text, i) => {
      return new Document({
        pageContent: text,
        metadata: metadatas[i] || {},
      });
    });
    
    await vectorStore.addDocuments(documents);
    return documents.length;
  }
  
  // Helper to search the vector store
  export async function searchVectorStore(
    vectorStore: SupabaseVectorStore,
    query: string,
    k: number = 4
  ) {
    const results = await vectorStore.similaritySearch(query, k);
    return results;
  }
  ```
- Implement stored procedure for similarity search
  ```bash
  # Create a new migration for similarity search function
  npx supabase migration new add_similarity_search
  ```
  
  Add the function to the migration:
  ```sql
  -- migration file: supabase/migrations/TIMESTAMP_add_similarity_search.sql
  CREATE OR REPLACE FUNCTION match_documents(
    query_embedding HALFVEC(3072),
    match_count INT DEFAULT 5,
    filter JSONB DEFAULT '{}'
  ) RETURNS TABLE (
    id UUID,
    content TEXT,
    metadata JSONB,
    embedding HALFVEC(3072),
    similarity FLOAT
  )
  LANGUAGE plpgsql
  AS $$
  #variable_conflict use_variable
  BEGIN
    RETURN QUERY
    SELECT
      documents.id,
      documents.content,
      documents.metadata,
      documents.embedding,
      1 - (documents.embedding <=> query_embedding) AS similarity
    FROM documents
    WHERE
      CASE
        WHEN filter->>'ids' IS NOT NULL THEN 
          id = ANY (SELECT jsonb_array_elements_text(filter->'ids')::UUID)
        ELSE TRUE
      END AND
      CASE
        WHEN filter->>'metadata' IS NOT NULL THEN 
          documents.metadata @> filter->'metadata'
        ELSE TRUE
      END
    ORDER BY documents.embedding <=> query_embedding
    LIMIT match_count;
  END;
  $$;
  ```
  
  Apply the migration:
  ```bash
  npx supabase db push
  ```
- Set up connection pooling
  - Configure database connection pooling
  - Implement query optimization techniques
  - Add caching layer for frequent queries

### 4. Basic UI Scaffolding

- Implement layout and navigation structure
  - Create responsive application layout
  - Implement navigation components
  - Set up protected routes
- Create placeholder pages for main functions
  - Dashboard page
  - Search interface
  - Knowledge explorer
  - Agent configuration pages
- Set up shadcn/ui component library
  ```bash
  # Initialize shadcn/ui in the project
  npx shadcn-ui@latest init
  ```
  - Configure component themes and animations
  ```typescript
  // lib/utils.ts - Configure shadcn/ui utilities
  import { type ClassValue, clsx } from "clsx"
  import { twMerge } from "tailwind-merge"
 
  export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
  }
  ```
  - Add core UI components:
  ```bash
  # Add essential UI components
  npx shadcn-ui@latest add button card dialog dropdown-menu input form toast
  ```
  - Create custom component compositions:
  ```tsx
  // components/ui/data-table.tsx
  import { DataTable } from "@/components/ui/data-table"
  import { Input } from "@/components/ui/input"
  import { Button } from "@/components/ui/button"
  
  export function DataTableWithSearch({ data, columns }) {
    // Implementation of data table with search functionality
  }
  ```
  - Implement responsive design with Tailwind utilities
  - Create custom theme with brand colors and typography

### 5. Authentication

- Implement NextAuth.js for user authentication
  - Configure authentication providers
  - Set up sign-in and sign-out flows
  - Create user profile management
- Set up basic role-based access control
  - Define user roles (admin, editor, viewer)
  - Implement role-based component rendering
  - Add permission checking utilities
- Configure Supabase RLS policies
  - Create row-level security policies using migrations
  ```bash
  # Create a new migration for RLS policies
  npx supabase migration new add_auth_policies
  ```
  
  Add the RLS policies to the migration file:
  ```sql
  -- migration file: supabase/migrations/TIMESTAMP_add_auth_policies.sql
  ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

  -- Policy for users to view documents they have access to
  CREATE POLICY "Users can view their documents" 
  ON documents FOR SELECT 
  USING (auth.uid() = ANY(metadata->>'allowed_users'));

  -- Policy for admins to view all documents
  CREATE POLICY "Admins can view all documents" 
  ON documents FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.uid() = id AND metadata->>'role' = 'admin'
    )
  );
  ```
  
  Apply the migration:
  ```bash
  npx supabase db push
  ```
  - Link policies to authenticated users
  - Test security rules

### 6. LangChain and LangGraph Integration

- Set up basic LangChain chains
  ```typescript
  // lib/langchain/chains.ts
  import { createLLM } from './index';
  import { PromptTemplate } from '@langchain/core/prompts';
  import { RunnableSequence } from '@langchain/core/runnables';
  import { StringOutputParser } from '@langchain/core/output_parsers';
  
  // Create a simple question answering chain
  export function createQAChain() {
    const llm = createLLM();
    const parser = new StringOutputParser();
    
    const template = `
      Answer the following question based on your knowledge:
      
      Question: {question}
      
      Answer:`;
    
    const prompt = PromptTemplate.fromTemplate(template);
    
    return RunnableSequence.from([
      prompt,
      llm,
      parser,
    ]);
  }
  ```

- Implement simple LangGraph workflow
  ```typescript
  // lib/langgraph/simple-workflow.ts
  import { StateGraph, END } from '@langchain/langgraph';
  import { createLLM } from '../langchain';
  import { PromptTemplate } from '@langchain/core/prompts';
  import { StringOutputParser } from '@langchain/core/output_parsers';
  
  // Define state interface
  interface WorkflowState {
    question: string;
    thoughts?: string;
    answer?: string;
  }
  
  // Create a simple workflow using LangGraph
  export function createSimpleWorkflow() {
    // Initialize the graph
    const graph = new StateGraph<WorkflowState>({
      channels: {
        question: {},
        thoughts: {},
        answer: {},
      }
    });
    
    // Create thinking node
    const thinkingNode = async (state: WorkflowState) => {
      const llm = createLLM({ temperature: 0.7 });
      const thinkingPrompt = PromptTemplate.fromTemplate(
        `Think step by step about how to answer the following question:
        
        Question: {question}
        
        Thoughts:`
      );
      
      const chain = thinkingPrompt.pipe(llm).pipe(new StringOutputParser());
      const thoughts = await chain.invoke({ question: state.question });
      
      return { ...state, thoughts };
    };
    
    // Create answering node
    const answeringNode = async (state: WorkflowState) => {
      const llm = createLLM({ temperature: 0.3 });
      const answerPrompt = PromptTemplate.fromTemplate(
        `Answer the following question. Use the thoughts to help form a comprehensive answer.
        
        Question: {question}
        Thoughts: {thoughts}
        
        Answer:`
      );
      
      const chain = answerPrompt.pipe(llm).pipe(new StringOutputParser());
      const answer = await chain.invoke({ 
        question: state.question, 
        thoughts: state.thoughts || ''
      });
      
      return { ...state, answer };
    };
    
    // Add nodes to the graph
    graph.addNode("thinking", thinkingNode);
    graph.addNode("answering", answeringNode);
    
    // Add edges
    graph.addEdge("thinking", "answering");
    graph.addEdge("answering", END);
    
    // Set the entry point
    graph.setEntryPoint("thinking");
    
    // Compile the graph
    return graph.compile();
  }
  ```

- Create API route for LLM interactions
  ```typescript
  // app/api/chat/route.ts
  import { StreamingTextResponse, Message } from 'ai';
  import { ChatOpenAI } from '@langchain/openai';
  import { BytesOutputParser } from '@langchain/core/output_parsers';
  import { PromptTemplate } from '@langchain/core/prompts';
  import { LLM_MODEL } from '@/lib/langchain';
  
  export const runtime = 'edge';
  
  const formatMessage = (message: Message) => {
    return `${message.role}: ${message.content}`;
  };
  
  export async function POST(req: Request) {
    const { messages } = await req.json();
    
    const formattedPreviousMessages = messages.slice(0, -1).map(formatMessage).join('\n');
    const currentMessageContent = messages[messages.length - 1].content;
    
    const prompt = PromptTemplate.fromTemplate(`
      <previous_messages>
      {previous_messages}
      </previous_messages>
      
      Human: {current_message}
      AI:
    `);
    
    const llm = new ChatOpenAI({
      modelName: LLM_MODEL,
      temperature: 0.7,
      streaming: true,
    });
    
    const outputParser = new BytesOutputParser();
    
    const chain = prompt.pipe(llm).pipe(outputParser);
    
    const stream = await chain.stream({
      previous_messages: formattedPreviousMessages,
      current_message: currentMessageContent,
    });
    
    return new StreamingTextResponse(stream);
  }
  ```

- Create API route for graph-based workflows
  ```typescript
  // app/api/workflow/route.ts
  import { NextResponse } from 'next/server';
  import { createSimpleWorkflow } from '@/lib/langgraph/simple-workflow';
  
  export async function POST(req: Request) {
    try {
      const { question } = await req.json();
      
      if (!question) {
        return NextResponse.json(
          { error: 'Question is required' },
          { status: 400 }
        );
      }
      
      // Create and run the workflow
      const workflow = createSimpleWorkflow();
      const result = await workflow.invoke({ question });
      
      return NextResponse.json({ result });
    } catch (error) {
      console.error('Workflow error:', error);
      return NextResponse.json(
        { error: 'An error occurred while processing the workflow' },
        { status: 500 }
      );
    }
  }
  ```

- Build basic chat interface for testing
  ```tsx
  // app/chat/page.tsx
  'use client';
  
  import { useState } from 'react';
  import { Button } from '@/components/ui/button';
  import { Input } from '@/components/ui/input';
  import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
  import { useChat } from 'ai/react';
  
  export default function ChatPage() {
    const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
      api: '/api/chat',
    });
    
    return (
      <div className="container mx-auto py-8 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Chat with LangChain & GPT-3.5 Turbo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 mb-4 h-[400px] overflow-y-auto">
              {messages.map((message) => (
                <div 
                  key={message.id} 
                  className={`p-3 rounded-lg ${
                    message.role === 'user' ? 'bg-blue-100 ml-12' : 'bg-gray-100 mr-12'
                  }`}
                >
                  <p className="text-sm font-medium mb-1">
                    {message.role === 'user' ? 'You' : 'AI'}
                  </p>
                  <p>{message.content}</p>
                </div>
              ))}
            </div>
            
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                value={input}
                onChange={handleInputChange}
                placeholder="Type your message..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button type="submit" disabled={isLoading}>
                Send
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }
  ```

- Create workflow testing interface
  ```tsx
  // app/workflow/page.tsx
  'use client';
  
  import { useState } from 'react';
  import { Button } from '@/components/ui/button';
  import { Input } from '@/components/ui/input';
  import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
  import { Textarea } from '@/components/ui/textarea';
  
  export default function WorkflowPage() {
    const [question, setQuestion] = useState('');
    const [result, setResult] = useState<{ thoughts?: string; answer?: string } | null>(null);
    const [loading, setLoading] = useState(false);
    
    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!question.trim()) return;
      
      setLoading(true);
      
      try {
        const response = await fetch('/api/workflow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question })
        });
        
        const data = await response.json();
        setResult(data.result);
      } catch (error) {
        console.error('Error running workflow:', error);
      } finally {
        setLoading(false);
      }
    };
    
    return (
      <div className="container mx-auto py-8 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Test LangGraph Workflow</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Enter your question..."
                  disabled={loading}
                  className="w-full"
                />
              </div>
              
              <Button type="submit" disabled={loading}>
                {loading ? 'Processing...' : 'Run Workflow'}
              </Button>
            </form>
            
            {result && (
              <div className="mt-6 space-y-4">
                {result.thoughts && (
                  <div>
                    <h3 className="text-sm font-medium mb-1">Agent Thoughts:</h3>
                    <Textarea 
                      readOnly 
                      value={result.thoughts} 
                      className="h-32 bg-gray-50"
                    />
                  </div>
                )}
                
                {result.answer && (
                  <div>
                    <h3 className="text-sm font-medium mb-1">Final Answer:</h3>
                    <div className="p-3 bg-blue-50 rounded-md">
                      {result.answer}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }
  ```

## Deliverables

- Fully configured Next.js project with TypeScript
- Supabase integration with pgvector support and database migrations
- LangChain integration with OpenAI models
- LangGraph implementation for agent workflows
- Working vector store implementation with text-embedding-3-large (3072 dimensions)
- UI system built with shadcn/ui and Tailwind CSS
- Basic application UI with authentication
- Database schema for document storage
- CRUD operations for knowledge management

## Success Criteria

- Database successfully stores and retrieves documents with vector embeddings
- Users can authenticate and access role-appropriate features
- Basic search functionality works with vector similarity
- LangChain chains can be created and executed with GPT-3.5 Turbo
- Simple LangGraph workflows demonstrate agent capabilities
- UI scaffolding provides navigation between key application areas with a cohesive design system
- Infrastructure is ready for agent implementation in Phase 2 