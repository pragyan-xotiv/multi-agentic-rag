/**
 * Result ranking and consolidation for the Hybrid Search Chain
 */
import { Document } from "langchain/document";
import { RetrievalMethod, HybridSearchResult, HybridSearchOutput } from "./types";

/**
 * Rank and consolidate search results from multiple methods
 */
export function rankAndConsolidateResults(input: {
  results: Document[];
  methodResults: Record<string, Document[]>;
  methods: RetrievalMethod[];
  timings: Record<string, number>;
  query: string;
}): HybridSearchOutput {
  // We only need methodResults, methods, and timings for processing
  const { methodResults, methods, timings } = input;
  
  // Track seen content to avoid duplicates
  const seenContents = new Set<string>();
  const consolidatedResults: HybridSearchResult[] = [];
  const methodCounts: Record<string, number> = {};
  
  // Get methods used
  const methodsUsed = Object.keys(methodResults).filter(
    method => methodResults[method].length > 0
  );
  
  // Process each method in priority order
  methods
    .sort((a, b) => b.priority - a.priority)
    .forEach(method => {
      const methodType = method.type;
      const docs = methodResults[methodType] || [];
      methodCounts[methodType] = docs.length;
      
      if (docs.length === 0) return;
      
      // Add results from this method, avoiding duplicates
      docs.forEach(doc => {
        // Create a normalized version of content for deduplication
        const normalizedContent = doc.pageContent.trim().toLowerCase();
        
        // Skip if we've seen this content before
        if (seenContents.has(normalizedContent)) return;
        
        // Mark as seen
        seenContents.add(normalizedContent);
        
        // Add to consolidated results
        consolidatedResults.push({
          content: doc.pageContent,
          metadata: doc.metadata,
          score: doc.metadata.score as number || 0,
          source: methodType
        });
      });
    });
  
  // Final ranking - combine scores with method priorities
  const finalResults = consolidatedResults.sort((a, b) => {
    // Get method priorities
    const methodA = methods.find(m => m.type === a.source);
    const methodB = methods.find(m => m.type === b.source);
    
    const priorityA = methodA?.priority || 0;
    const priorityB = methodB?.priority || 0;
    
    // Normalize scores (they could be from different search methods)
    const normalizedScoreA = a.score * (priorityA / 10);
    const normalizedScoreB = b.score * (priorityB / 10);
    
    // Return higher score first
    return normalizedScoreB - normalizedScoreA;
  });
  
  return {
    results: finalResults,
    methodsUsed,
    metrics: {
      methodCounts,
      timings,
      totalResults: finalResults.length
    }
  };
} 