import { RetrievalAgentState, RetrievalResponse } from "./types";

/**
 * Evaluates the quality of the retrieval results
 */
export async function evaluateResultQuality(state: RetrievalAgentState): Promise<Partial<RetrievalAgentState>> {
  const { processedResults } = state;
  const { chunks } = processedResults;
  
  // If we have no results, return low scores
  if (chunks.length === 0) {
    return {
      resultEvaluation: {
        relevanceScore: 0,
        coverageScore: 0,
        confidenceScore: 0,
        feedback: "No results found for the query."
      }
    };
  }
  
  // For simplicity, calculate simple evaluation metrics
  // In a production system, we would use the LLM to evaluate
  
  // Average relevance score
  const avgRelevance = chunks.reduce((sum, chunk) => sum + chunk.relevanceScore, 0) / chunks.length;
  
  // Coverage is based on number of chunks relative to a target (5)
  const coverageScore = Math.min(chunks.length / 5, 1);
  
  // Confidence is a combination of relevance and coverage
  const confidenceScore = (avgRelevance + coverageScore) / 2;
  
  let feedback = "";
  if (confidenceScore > 0.7) {
    feedback = "High-quality results found that appear to address the query well.";
  } else if (confidenceScore > 0.4) {
    feedback = "Some relevant information found, but the results may not fully address the query.";
  } else {
    feedback = "Limited relevant information found. Consider refining the query.";
  }
  
  return {
    resultEvaluation: {
      relevanceScore: avgRelevance,
      coverageScore,
      confidenceScore,
      feedback
    }
  };
}

/**
 * Formats the final response from the retrieval agent
 */
export async function formatRetrievalResponse(state: RetrievalAgentState): Promise<{response: RetrievalResponse}> {
  const { processedResults, resultEvaluation, retrievalRequest } = state;
  const { query } = retrievalRequest;
  const { chunks } = processedResults;
  
  // For low-confidence results, use a more cautious response
  if (resultEvaluation.confidenceScore < 0.3) {
    return {
      response: {
        content: `I found limited information related to "${query}". ${resultEvaluation.feedback}`,
        results: chunks,
        evaluation: resultEvaluation
      }
    };
  }
  
  // Format a standard response with the results
  return {
    response: {
      content: `Here's what I found related to "${query}":`,
      results: chunks,
      evaluation: resultEvaluation
    }
  };
} 