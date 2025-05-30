import { createLLM } from "../../langchain";
import { RetrievalAgentState } from "./types";

/**
 * Analyzes the retrieval request to understand what we're looking for
 */
export async function analyzeRetrievalRequest(state: RetrievalAgentState): Promise<Partial<RetrievalAgentState>> {
  // Check if state has the expected structure
  if (!state.retrievalRequest || !state.retrievalRequest.query) {
    throw new Error("Invalid state: retrievalRequest or query is missing");
  }

  const llm = createLLM({ temperature: 0.2 });
  const { query } = state.retrievalRequest;
  
  const prompt = `
Analyze the following search query to identify what kind of information we need to retrieve.

Query: "${query}"

Analyze the following aspects:
1. Entity Types: What types of entities (people, companies, concepts, etc.) are being asked about?
2. Semantic Aspects: What meaning or information is being sought?
3. Structural Needs: Does this require hierarchical, relational, or flat information?
4. Complexity: On a scale of 1-10, how complex is this query?

Provide your analysis as structured data.
`;
  
  const response = await llm.invoke(prompt);
  const content = response.content as string;
  
  // Extract key elements from the response
  // This is a simplified parsing approach - in a production system we'd use more robust parsing
  const entityMatch = content.match(/Entity Types:(.+?)(?=Semantic|$)/);
  const semanticMatch = content.match(/Semantic Aspects:(.+?)(?=Structural|$)/);
  const structuralMatch = content.match(/Structural Needs:(.+?)(?=Complexity|$)/);
  const complexityMatch = content.match(/Complexity:(.+?)(?=\n|$)/);
  
  // Extract and clean up the matches
  const entityTypes = entityMatch 
    ? entityMatch[1].split(',').map(e => e.trim()).filter(Boolean)
    : [];
  const semanticAspects = semanticMatch 
    ? semanticMatch[1].split(',').map(e => e.trim()).filter(Boolean)
    : [];
  const structuralNeeds = structuralMatch 
    ? structuralMatch[1].split(',').map(e => e.trim()).filter(Boolean)
    : [];
  
  // Parse complexity score, defaulting to 5 if we can't extract it
  let complexityScore = 5;
  if (complexityMatch) {
    const numberMatch = complexityMatch[1].match(/\d+/);
    if (numberMatch) {
      complexityScore = parseInt(numberMatch[0], 10);
      if (isNaN(complexityScore) || complexityScore < 1) {
        complexityScore = 1;
      } else if (complexityScore > 10) {
        complexityScore = 10;
      }
    }
  }
  
  return {
    requestAnalysis: {
      entityTypes,
      semanticAspects,
      structuralNeeds,
      complexityScore
    }
  };
}

/**
 * Analyzes a query and determines if it likely needs entity or relationship search
 */
export function analyzeQueryForSearchOptions(query: string, entityTypes: string[], structuralNeeds: string[]) {
  return {
    considerEntities: entityTypes.length > 0,
    considerRelationships: structuralNeeds.some(need => 
      need.toLowerCase().includes('relation') || 
      need.toLowerCase().includes('connection'))
  };
} 