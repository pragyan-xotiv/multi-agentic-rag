import { RunnableSequence } from "@langchain/core/runnables";
import { PromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";
import { evaluateProgress } from "../../agents/scraper-new/core/navigation-decision";
import type { ExtendedScraperAgentState } from "../../agents/scraper-new/state";
import type { PageContent } from "../../agents/scraper-new/types";

// Define input interface
export interface ProgressEvaluationInput {
  currentState: ExtendedScraperAgentState;
}

// Define output interface
export interface ProgressEvaluationOutput {
  metrics: {
    informationDensity: number;
    relevance: number;
    uniqueness: number;
    completeness: number;
  };
  analysisDetails: {
    pagesScraped: number;
    totalContentSize: number;
    coverageScore: number;
    diminishingReturns: boolean;
    remainingValueEstimate: number;
  };
}

// Define the output schema for the LLM
const progressEvaluationSchema = z.object({
  informationDensity: z.number().min(0).max(1).describe("Average information density across all scraped pages"),
  relevance: z.number().min(0).max(1).describe("Average relevance of scraped content to the goal"),
  uniqueness: z.number().min(0).max(1).describe("Uniqueness of scraped content (low value indicates duplicated content)"),
  completeness: z.number().min(0).max(1).describe("Estimated completeness of the information gathering"),
  diminishingReturns: z.boolean().describe("Whether new pages are adding minimal unique information"),
  remainingValueEstimate: z.number().min(0).max(1).describe("Estimated value of continuing to scrape"),
  progressAnalysis: z.string().describe("Brief analysis of the scraping progress")
});

export async function runProgressEvaluationChain(
  input: ProgressEvaluationInput
): Promise<ProgressEvaluationOutput> {
  // Use the core module to evaluate progress
  const preliminaryEvaluation = await evaluateProgress(input.currentState);
  
  // If no content has been extracted yet, return the preliminary evaluation
  if (input.currentState.extractedContent.size === 0) {
    return {
      metrics: {
        informationDensity: 0,
        relevance: 0,
        uniqueness: 0,
        completeness: 0
      },
      analysisDetails: {
        pagesScraped: 0,
        totalContentSize: 0,
        coverageScore: 0,
        diminishingReturns: false,
        remainingValueEstimate: 1 // High value to continue scraping
      }
    };
  }
  
  // Create structured output parser
  const parser = StructuredOutputParser.fromZodSchema(progressEvaluationSchema);
  
  // Setup the model
  const model = new ChatOpenAI({
    modelName: "gpt-4-turbo-preview",
    temperature: 0.1,
  });

  // Create the prompt template
  const promptTemplate = PromptTemplate.fromTemplate(`
    You are an expert web scraper evaluating the progress of a scraping operation.

    # Progress Evaluation Task
    Analyze the current state of the scraping operation and evaluate progress towards the goal.
    Determine if enough information has been gathered or if more scraping is needed.

    # Scraping Goal
    {scrapingGoal}

    # Current Progress
    Pages scraped: {pagesScraped}
    Total content size: {contentSize} characters
    
    # Content Summary
    {contentSummary}
    
    # Previous Metrics
    Information Density: {previousDensity}
    Relevance: {previousRelevance}
    Uniqueness: {previousUniqueness}
    
    # Instructions
    Analyze the current progress and determine:
    1. Information Density: Average information density across all scraped pages (0-1)
    2. Relevance: Average relevance of scraped content to the goal (0-1)
    3. Uniqueness: Uniqueness of scraped content (0-1, low value indicates duplicated content)
    4. Completeness: Estimated completeness of the information gathering (0-1)
    5. Diminishing Returns: Whether new pages are adding minimal unique information (true/false)
    6. Remaining Value Estimate: Estimated value of continuing to scrape (0-1)
    7. Provide a brief analysis of the scraping progress

    {format_instructions}
  `);

  // Get content array from the state
  const contentArray: PageContent[] = Array.from(input.currentState.extractedContent.values());
  
  // Calculate total content size
  const totalContentSize = contentArray.reduce((sum, page) => sum + page.content.length, 0);
  
  // Prepare content summary
  const contentSummary = prepareContentSummary(contentArray);

  // Create the chain
  const chain = RunnableSequence.from([
    {
      format_instructions: async () => parser.getFormatInstructions(),
      scrapingGoal: () => input.currentState.scrapingGoal,
      pagesScraped: () => contentArray.length,
      contentSize: () => totalContentSize,
      contentSummary: () => contentSummary,
      previousDensity: () => preliminaryEvaluation.informationDensity.toFixed(2),
      previousRelevance: () => preliminaryEvaluation.relevance.toFixed(2),
      previousUniqueness: () => preliminaryEvaluation.uniqueness.toFixed(2),
    },
    promptTemplate,
    model,
    parser
  ]);

  // Run the chain
  const result = await chain.invoke({});
  
  // Prepare the output
  return {
    metrics: {
      informationDensity: result.informationDensity,
      relevance: result.relevance,
      uniqueness: result.uniqueness,
      completeness: result.completeness
    },
    analysisDetails: {
      pagesScraped: contentArray.length,
      totalContentSize,
      coverageScore: calculateCoverageScore(contentArray, input.currentState.scrapingGoal),
      diminishingReturns: result.diminishingReturns,
      remainingValueEstimate: result.remainingValueEstimate
    }
  };
}

/**
 * Prepare a summary of the extracted content
 */
function prepareContentSummary(contentArray: PageContent[]): string {
  if (contentArray.length === 0) {
    return "No content has been extracted yet.";
  }
  
  // Create a summary of titles
  const titles = contentArray.map(page => page.title).slice(0, 5);
  let summary = `Extracted pages: ${titles.join(', ')}`;
  
  if (contentArray.length > 5) {
    summary += ` and ${contentArray.length - 5} more`;
  }
  
  // Add information about top entities if available.
  const entities = new Map<string, number>();
  contentArray.forEach(page => {
    page.entities.forEach(entity => {
      if (entity.type !== 'general') {
        const key = `${entity.name} (${entity.type})`;
        entities.set(key, (entities.get(key) || 0) + (entity.mentions || 0));
      }
    });
  });
  
  // Sort entities by mention count and take top 10
  const topEntities = Array.from(entities.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => `${name} (${count} mentions)`);
  
  if (topEntities.length > 0) {
    summary += `\n\nTop entities: ${topEntities.join(', ')}`;
  }
  
  return summary;
}

/**
 * Calculate a coverage score based on extracted content and scraping goal
 */
function calculateCoverageScore(contentArray: PageContent[], scrapingGoal: string): number {
  if (contentArray.length === 0) return 0;
  
  // Extract keywords from the scraping goal
  const goalKeywords = scrapingGoal.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3);
  
  if (goalKeywords.length === 0) return 0.5;
  
  // Check how many keywords are mentioned in the content
  const keywordCounts = new Map<string, number>();
  
  contentArray.forEach(page => {
    const content = page.content.toLowerCase();
    goalKeywords.forEach(keyword => {
      // Count occurrences of the keyword
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      const matches = content.match(regex);
      if (matches) {
        keywordCounts.set(keyword, (keywordCounts.get(keyword) || 0) + matches.length);
      }
    });
  });
  
  // Calculate what percentage of keywords have been covered
  const coveredKeywords = goalKeywords.filter(keyword => keywordCounts.has(keyword));
  const keywordCoverage = coveredKeywords.length / goalKeywords.length;
  
  // Calculate content volume factor (more content generally means better coverage)
  // Cap at a reasonable maximum (e.g., 10 pages)
  const volumeFactor = Math.min(contentArray.length / 10, 1);
  
  // Combine factors
  return 0.7 * keywordCoverage + 0.3 * volumeFactor;
} 