import { executeRetrieval, RetrievalResponse } from './workflow';
import { SupabaseVectorStore } from '@langchain/community/vectorstores/supabase';
import { RetrievedChunk } from './types';

/**
 * Event types for streaming responses
 */
export type RetrievalStreamEvent = 
  | { type: 'start'; query: string }
  | { type: 'chunk'; data: RetrievedChunk }
  | { type: 'end'; content: string; evaluation: RetrievalResponse['evaluation'] }
  | { type: 'error'; error: string };

/**
 * Retrieval Agent for finding relevant information from the knowledge base
 */
export class RetrievalAgent {
  private vectorStore?: SupabaseVectorStore;
  
  constructor(vectorStore?: SupabaseVectorStore) {
    this.vectorStore = vectorStore;
  }
  
  /**
   * Execute a search query and return results
   */
  async search(query: string, filters: Record<string, unknown> = {}): Promise<RetrievedChunk[]> {
    try {
      const response = await executeRetrieval(query, filters);
      return response.results;
    } catch (error) {
      console.error('Retrieval agent search error:', error);
      throw new Error(`Failed to execute search: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Execute a search query and return the full response
   */
  async retrieve(query: string, filters: Record<string, unknown> = {}): Promise<RetrievalResponse> {
    try {
      return await executeRetrieval(query, filters);
    } catch (error) {
      console.error('Retrieval agent error:', error);
      throw new Error(`Failed to execute retrieval: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Stream results from a search query
   */
  async streamResults(
    query: string, 
    filters: Record<string, unknown> = {}, 
    options: Record<string, unknown> = {}, 
    onChunk: (chunk: RetrievalStreamEvent) => Promise<void>
  ): Promise<RetrievalResponse> {
    try {
      // First get the complete results
      const response = await executeRetrieval(query, filters);
      
      // Send the initial response
      await onChunk({
        type: 'start',
        query
      });
      
      // Send the processed chunks in sequence
      for (const chunk of response.results) {
        await onChunk({
          type: 'chunk',
          data: chunk
        });
        
        // Add a small delay for streaming effect if needed
        if (options.streamDelay && typeof options.streamDelay === 'number') {
          await new Promise(resolve => setTimeout(resolve, options.streamDelay as number));
        }
      }
      
      // Send the final message
      await onChunk({
        type: 'end',
        content: response.content,
        evaluation: response.evaluation
      });
      
      return response;
    } catch (error) {
      console.error('Retrieval agent streaming error:', error);
      await onChunk({
        type: 'error',
        error: `Search failed: ${error instanceof Error ? error.message : String(error)}`
      });
      throw error;
    }
  }
}

// Export types
export * from './types';

// Export workflow functions and types for direct access
export * from './workflow'; 