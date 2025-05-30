import { RunnableSequence } from "@langchain/core/runnables";
import { PromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";
import { analyzeUrl } from "../../agents/scraper/core/url-analyzer";
import type { ScraperAgentState } from "../../agents/scraper/types";

// Define input interface
export interface URLAnalysisInput {
  url: string;
  scrapingGoal: string;
  currentState: ScraperAgentState;
}

// Define output interface
export interface URLAnalysisOutput {
  url: string;
  relevanceScore: number;
  expectedValue: number;
  isAllowedByRobots: boolean;
  domainAuthority: number;
  wasVisitedBefore: boolean;
}

// Define the output schema for the LLM
const urlAnalysisOutputSchema = z.object({
  relevanceScore: z.number().min(0).max(1).describe("A score from 0 to 1 indicating how relevant this URL is to the scraping goal"),
  expectedValue: z.number().min(0).max(1).describe("A score from 0 to 1 indicating the expected information value of this URL"),
  rationale: z.string().describe("A short explanation of why this URL is relevant or not")
});

export async function runURLAnalysisChain(input: URLAnalysisInput): Promise<URLAnalysisOutput> {
  // Use the core module to analyze the URL
  const initialAnalysis = await analyzeUrl(input.url, input.currentState);
  
  // Create structured output parser
  const parser = StructuredOutputParser.fromZodSchema(urlAnalysisOutputSchema);
  
  // Setup the model
  const model = new ChatOpenAI({
    modelName: "gpt-4-turbo-preview",
    temperature: 0.2,
  });

  // Create the prompt template
  const promptTemplate = PromptTemplate.fromTemplate(`
    You are an expert web scraper analyzing URLs to determine their relevance and value to a specific scraping goal.

    # URL Analysis Task
    Analyze the URL provided and determine its relevance to the scraping goal. Calculate an expected information value
    based on the URL structure, path components, and query parameters.

    # Scraping Goal
    {scrapingGoal}

    # URL to Analyze
    {url}

    # URL Components
    Path: {path}
    Hostname: {hostname}
    
    # Domain Information
    Domain Authority: {domainAuthority}
    
    # Current State Context
    URL previously visited: {wasVisitedBefore}
    
    # Instructions
    Analyze the URL and determine:
    1. How relevant is this URL to the scraping goal (score from 0 to 1)
    2. What is the expected information value (score from 0 to 1)
    3. Provide a short rationale for your assessment

    {format_instructions}
  `);

  // Parse the URL to get components
  const parsedUrl = new URL(input.url);

  // Create the chain
  const chain = RunnableSequence.from([
    {
      format_instructions: async () => parser.getFormatInstructions(),
      url: () => input.url,
      scrapingGoal: () => input.scrapingGoal,
      path: () => parsedUrl.pathname,
      hostname: () => parsedUrl.hostname,
      domainAuthority: () => initialAnalysis.domainAuthority,
      wasVisitedBefore: () => initialAnalysis.wasVisitedBefore ? "Yes" : "No",
    },
    promptTemplate,
    model,
    parser
  ]);

  // Run the chain
  const result = await chain.invoke({});
  
  // Combine all results into the output
  return {
    url: input.url,
    relevanceScore: result.relevanceScore,
    expectedValue: result.expectedValue,
    isAllowedByRobots: initialAnalysis.isAllowedByRobots,
    domainAuthority: initialAnalysis.domainAuthority,
    wasVisitedBefore: initialAnalysis.wasVisitedBefore
  };
} 