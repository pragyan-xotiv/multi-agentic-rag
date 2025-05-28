import { ChatOpenAI } from '@langchain/openai';
import { OpenAIEmbeddings } from '@langchain/openai';

// Set up default models
export const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-3-large';
export const LLM_MODEL = process.env.LLM_MODEL || 'gpt-3.5-turbo';

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
  return new ChatOpenAI({
    modelName: LLM_MODEL,
    temperature: 0.7,
    ...options,
  });
} 