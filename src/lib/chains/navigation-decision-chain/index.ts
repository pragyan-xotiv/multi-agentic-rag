import { RunnableSequence } from "@langchain/core/runnables";
import { PromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";
import { decideNextAction } from "../../agents/scraper-new/core/navigation-decision";
import type { ExtendedScraperAgentState } from "../../agents/scraper-new/state";

// Define input interface
export interface NavigationDecisionInput {
  currentState: ExtendedScraperAgentState;
  progressMetrics: {
    informationDensity: number;
    relevance: number;
    uniqueness: number;
    completeness: number;
  };
}

// Define output interface
export interface NavigationDecisionOutput {
  action: 'continue' | 'complete';
  nextUrl?: string;
  completionEstimate: number;
  reason: string;
  actionDetails?: {
    expectedValue?: number;
    pageDepth?: number;
    queueSize?: number;
  };
}

// Define the output schema for the LLM
const navigationDecisionSchema = z.object({
  action: z.enum(['continue', 'complete']).describe("Whether to continue scraping or complete the process"),
  reason: z.string().describe("Explanation for the decision"),
  completionEstimate: z.number().min(0).max(1).describe("Estimated completion percentage of the goal"),
  shouldExploreNewAreas: z.boolean().optional().describe("Whether to explore new content areas instead of following the current path")
});

export async function runNavigationDecisionChain(
  input: NavigationDecisionInput
): Promise<NavigationDecisionOutput> {
  // First get the preliminary decision from the core module
  const preliminaryDecision = await decideNextAction(input.currentState);
  
  // Short-circuit if there are no more URLs in the queue
  if (preliminaryDecision.action === 'complete' && 
      preliminaryDecision.reason.includes('No more URLs')) {
    return {
      action: 'complete',
      completionEstimate: preliminaryDecision.completionEstimate,
      reason: preliminaryDecision.reason,
      actionDetails: {
        queueSize: 0
      }
    };
  }
  
  // Create structured output parser
  const parser = StructuredOutputParser.fromZodSchema(navigationDecisionSchema);
  
  // Setup the model
  const model = new ChatOpenAI({
    modelName: "gpt-4-turbo-preview",
    temperature: 0.1,
  });

  // Create the prompt template
  const promptTemplate = PromptTemplate.fromTemplate(`
    You are an expert web scraper making decisions about whether to continue or complete a scraping operation.

    # Navigation Decision Task
    Based on the current state of the scraping operation, decide whether to continue scraping or complete the process.

    # Scraping Goal
    {scrapingGoal}

    # Current Progress
    Pages scraped: {pagesScraped}
    Max pages: {maxPages}
    URL queue size: {queueSize}
    
    # Progress Metrics
    Information Density: {informationDensity}
    Relevance: {relevance}
    Uniqueness: {uniqueness}
    Completeness: {completeness}
    
    # Next URL if Continuing
    {nextUrl}
    
    # Preliminary Decision
    {preliminaryDecision}
    
    # Instructions
    Make the final decision:
    1. Action: Whether to 'continue' scraping or 'complete' the process
    2. Reason: Provide a clear explanation for your decision
    3. Completion Estimate: Estimated percentage of the goal that has been completed (0-1)
    4. Optionally, recommend whether to explore new content areas

    {format_instructions}
  `);

  // Create the chain
  const chain = RunnableSequence.from([
    {
      format_instructions: async () => parser.getFormatInstructions(),
      scrapingGoal: () => input.currentState.scrapingGoal,
      pagesScraped: () => input.currentState.visitedUrls.size,
      maxPages: () => input.currentState.maxPages,
      queueSize: () => input.currentState.pageQueue.size(),
      informationDensity: () => input.progressMetrics.informationDensity.toFixed(2),
      relevance: () => input.progressMetrics.relevance.toFixed(2),
      uniqueness: () => input.progressMetrics.uniqueness.toFixed(2),
      completeness: () => input.progressMetrics.completeness.toFixed(2),
      nextUrl: () => preliminaryDecision.nextUrl || "No URL available",
      preliminaryDecision: () => `${preliminaryDecision.action} - ${preliminaryDecision.reason}`,
    },
    promptTemplate,
    model,
    parser
  ]);

  // Run the chain
  const result = await chain.invoke({});
  
  // Prepare the output
  const output: NavigationDecisionOutput = {
    action: result.action,
    completionEstimate: result.completionEstimate,
    reason: result.reason,
    actionDetails: {
      queueSize: input.currentState.pageQueue.size(),
    }
  };
  
  // If we're continuing, include the next URL from the preliminary decision
  if (output.action === 'continue' && preliminaryDecision.nextUrl) {
    output.nextUrl = preliminaryDecision.nextUrl;
    
    // Get page depth and expected value if available
    const queuePeek = input.currentState.pageQueue.peek();
    if (queuePeek) {
      output.actionDetails!.expectedValue = queuePeek.expectedValue;
      output.actionDetails!.pageDepth = queuePeek.depth;
    }
    
    // If the LLM suggests exploring new areas, we could adjust the URL selection strategy here
    if (result.shouldExploreNewAreas) {
      // This could involve reordering the queue, selecting a URL from a different domain, etc.
      // For now, we'll just note it in the reason
      output.reason += " (Recommend exploring new content areas)";
    }
  }
  
  return output;
} 