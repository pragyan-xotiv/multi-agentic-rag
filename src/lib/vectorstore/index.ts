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
  metadatas: Record<string, unknown>[] = []
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
  k: number = 4,
  filter?: Record<string, unknown>
) {
  try {
    // Use similaritySearchWithScore to get relevance scores
    const results = await vectorStore.similaritySearch(
      query, 
      k,
      filter ? { filter: JSON.stringify(filter) } : undefined
    );
    
    return results;
  } catch (error) {
    console.error("Error in vector search:", error);
    // Return empty results rather than throwing
    return [];
  }
} 