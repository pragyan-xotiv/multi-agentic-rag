import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseVectorStore } from '@langchain/community/vectorstores/supabase';
import { Document } from 'langchain/document';
import { createEmbeddings } from '../langchain';

// Interface for vector store configuration
export interface VectorStoreConfig {
  tableName?: string;
  queryName?: string;
  defaultNamespace?: string;
}

// Default configuration
const DEFAULT_CONFIG: VectorStoreConfig = {
  tableName: 'documents',
  queryName: 'match_documents',
  defaultNamespace: 'default'
};

// VectorStore health check result
export interface VectorStoreHealth {
  isAvailable: boolean;
  documentCount: number;
  namespaces: { namespace: string; count: number }[];
  error?: string;
}

// Search filter options
export interface SearchFilterOptions {
  metadata?: Record<string, unknown>;
  ids?: string[];
  namespace?: string;
}

/**
 * Initialize Supabase vector store with LangChain
 * @param supabaseClient Supabase client
 * @param config Vector store configuration
 * @returns Initialized SupabaseVectorStore
 */
export async function createVectorStore(
  supabaseClient: SupabaseClient,
  config: VectorStoreConfig = {}
) {
  // Merge default config with provided config
  const { tableName, queryName } = { ...DEFAULT_CONFIG, ...config };
  
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

/**
 * Check health of vector store
 * @param supabaseClient Supabase client
 * @param tableName Table name
 * @returns Health check result
 */
export async function checkVectorStoreHealth(
  supabaseClient: SupabaseClient,
  tableName: string = DEFAULT_CONFIG.tableName!
): Promise<VectorStoreHealth> {
  try {
    // Check if table exists
    const { error: tableError } = await supabaseClient.from(tableName)
      .select('id')
      .limit(1);
      
    if (tableError) {
      return {
        isAvailable: false,
        documentCount: 0,
        namespaces: [],
        error: `Table error: ${tableError.message}`
      };
    }
    
    // Get document count
    const { count: documentCount, error: countError } = await supabaseClient.from(tableName)
      .select('id', { count: 'exact', head: true });
      
    if (countError) {
      return {
        isAvailable: true,
        documentCount: 0,
        namespaces: [],
        error: `Count error: ${countError.message}`
      };
    }
    
    // Get namespace statistics
    const { data: namespaceData, error: namespaceError } = await supabaseClient
      .from(tableName)
      .select('namespace')
      .then(async ({ data, error }) => {
        if (error) return { data: [], error };
        
        // Count documents per namespace
        const namespaceCounts = data.reduce((acc, item) => {
          const ns = item.namespace || DEFAULT_CONFIG.defaultNamespace!;
          acc[ns] = (acc[ns] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        // Format namespace counts
        const namespaces = Object.entries(namespaceCounts).map(([namespace, count]) => ({
          namespace,
          count
        }));
        
        return { data: namespaces, error: null };
      });
    
    return {
      isAvailable: true,
      documentCount: documentCount || 0,
      namespaces: namespaceData || [],
      error: namespaceError ? `Namespace error: ${namespaceError.message}` : undefined
    };
  } catch (error) {
    return {
      isAvailable: false,
      documentCount: 0,
      namespaces: [],
      error: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Add documents to the vector store
 * @param vectorStore Vector store
 * @param texts Text content to add
 * @param metadatas Metadata for each text
 * @param namespace Namespace to store documents in
 * @returns Number of documents added
 */
export async function addDocumentsToVectorStore(
  vectorStore: SupabaseVectorStore,
  texts: string[],
  metadatas: Record<string, unknown>[] = [],
  namespace: string = DEFAULT_CONFIG.defaultNamespace!
) {
  const documents = texts.map((text, i) => {
    // Add namespace to metadata
    const metadata = {
      ...(metadatas[i] || {}),
      namespace
    };
    
    return new Document({
      pageContent: text,
      metadata,
    });
  });
  
  await vectorStore.addDocuments(documents);
  return documents.length;
}

/**
 * Perform vector search using embeddings
 * @param vectorStore Vector store
 * @param query Query string
 * @param k Number of results to return
 * @param filter Filter options
 * @returns Vector search results
 */
export async function searchVectorStore(
  vectorStore: SupabaseVectorStore,
  query: string,
  k: number = 4,
  filter?: SearchFilterOptions
) {
  try {
    // Create filter object from options
    const filterObj: Record<string, unknown> = {};
    
    if (filter?.ids) {
      filterObj.ids = filter.ids;
    }
    
    if (filter?.metadata) {
      filterObj.metadata = filter.metadata;
    }
    
    if (filter?.namespace) {
      filterObj.namespace = filter.namespace;
    }
    
    // Use similaritySearch to get results
    const results = await vectorStore.similaritySearch(
      query, 
      k,
      Object.keys(filterObj).length > 0 ? { filter: filterObj } : undefined
    );
    
    return results;
  } catch (error) {
    console.error("Error in vector search:", error);
    // Return empty results rather than throwing
    return [];
  }
}

/**
 * Perform keyword-based search directly in Supabase
 * @param supabaseClient Supabase client
 * @param query Query string
 * @param k Number of results to return
 * @param filter Filter options
 * @param tableName Table name
 * @returns Keyword search results
 */
export async function keywordSearch(
  supabaseClient: SupabaseClient,
  query: string,
  k: number = 4,
  filter?: SearchFilterOptions,
  tableName: string = DEFAULT_CONFIG.tableName!
) {
  try {
    // Build text search query
    const searchTerms = query
      .split(' ')
      .filter(term => term.length > 2)
      .map(term => term.trim())
      .join(' & ');
      
    if (!searchTerms) {
      return [];
    }
    
    // Start building the query
    let dbQuery = supabaseClient
      .from(tableName)
      .select('id, content, metadata, namespace')
      .textSearch('content', searchTerms);
      
    // Apply filters if available
    if (filter?.namespace) {
      dbQuery = dbQuery.eq('namespace', filter.namespace);
    }
    
    if (filter?.ids && filter.ids.length > 0) {
      dbQuery = dbQuery.in('id', filter.ids);
    }
    
    // Execute the query with limit
    const { data, error } = await dbQuery.limit(k);
    
    if (error) {
      console.error("Keyword search error:", error);
      return [];
    }
    
    // Convert to Document format for consistent interface
    return data.map(item => new Document({
      pageContent: item.content,
      metadata: {
        ...item.metadata,
        id: item.id,
        namespace: item.namespace
      }
    }));
  } catch (error) {
    console.error("Error in keyword search:", error);
    return [];
  }
}

/**
 * Delete documents from vector store by filter
 * @param supabaseClient Supabase client
 * @param filter Filter criteria
 * @param tableName Table name
 * @returns Number of documents deleted
 */
export async function deleteDocuments(
  supabaseClient: SupabaseClient,
  filter: SearchFilterOptions,
  tableName: string = DEFAULT_CONFIG.tableName!
): Promise<number> {
  try {
    let query = supabaseClient.from(tableName).delete();
    
    // Apply filters
    if (filter.ids && filter.ids.length > 0) {
      query = query.in('id', filter.ids);
    }
    
    if (filter.namespace) {
      query = query.eq('namespace', filter.namespace);
    }
    
    if (filter.metadata) {
      // For each metadata key, apply the filter
      Object.entries(filter.metadata).forEach(([key, value]) => {
        query = query.eq(`metadata->>${key}`, value);
      });
    }
    
    const { data, error } = await query.select('id');
    
    if (error) {
      console.error("Error deleting documents:", error);
      return 0;
    }
    
    return data?.length || 0;
  } catch (error) {
    console.error("Error deleting documents:", error);
    return 0;
  }
} 