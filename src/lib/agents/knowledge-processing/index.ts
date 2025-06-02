// Knowledge Processing Agent index file

import { KnowledgeProcessingInput, ProcessingResult } from './types';
import { executeKnowledgeWorkflow } from './workflow';

/**
 * Knowledge Processing Agent
 * 
 * Transforms raw web content into structured, interconnected knowledge using content-adaptive processing.
 */
export class KnowledgeProcessingAgent {
  /**
   * Process a single piece of content
   */
  async processContent(input: KnowledgeProcessingInput): Promise<ProcessingResult> {
    console.log(`🧠 [KnowledgeProcessingAgent] Processing content from: ${input.source}`);
    
    try {
      const result = await executeKnowledgeWorkflow(
        input.content, 
        input.metadata?.processingGoal as string || "Extract all relevant knowledge", 
        input.options || {}
      );
      
      console.log(`✅ [KnowledgeProcessingAgent] Processing complete. Extracted ${result.entities.length} entities and ${result.relationships.length} relationships.`);
      
      return result;
    } catch (error) {
      console.error(`❌ [KnowledgeProcessingAgent] Error processing content:`, error);
      throw error;
    }
  }
  
  /**
   * Process a batch of content
   */
  async processBatch(inputs: KnowledgeProcessingInput[]): Promise<ProcessingResult[]> {
    console.log(`🧠 [KnowledgeProcessingAgent] Processing batch of ${inputs.length} items`);
    
    const results: ProcessingResult[] = [];
    
    for (const input of inputs) {
      try {
        const result = await this.processContent(input);
        results.push(result);
      } catch (error) {
        console.error(`❌ [KnowledgeProcessingAgent] Error processing batch item:`, error);
        // Continue with next item instead of failing the entire batch
      }
    }
    
    console.log(`✅ [KnowledgeProcessingAgent] Batch processing complete. Processed ${results.length}/${inputs.length} items successfully.`);
    
    return results;
  }
}

// Export types
export * from './types';
