import { RunnableSequence } from "@langchain/core/runnables";
import { PromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";
import { identifyLinks } from "../../agents/scraper/core/link-prioritizer";
import type { ScraperAgentState } from "../../agents/scraper/types";

// Define link interface
interface LinkInfo {
  url: string;
  text: string;
  context: string;
  predictedValue: number;
}

// Define input interface
export interface LinkDiscoveryInput {
  html: string;
  currentUrl: string;
  currentState: ScraperAgentState;
}

// Define output interface
export interface LinkDiscoveryOutput {
  links: LinkInfo[];
}

// Define the output schema for the LLM
const linkEvaluationSchema = z.object({
  linkEvaluations: z.array(z.object({
    url: z.string().describe("The URL of the link"),
    valueScore: z.number().min(0).max(1).describe("A score from 0 to 1 indicating the predicted information value of this link"),
    reasoning: z.string().describe("A brief explanation of why this link is valuable or not")
  })).describe("Evaluation of each link's potential value")
});

export async function runLinkDiscoveryChain(
  input: LinkDiscoveryInput
): Promise<LinkDiscoveryOutput> {
  // Discover links using the core link-prioritizer module
  const discoveredLinks = await identifyLinks(input.html, input.currentUrl, input.currentState);
  
  // If no links were found, return empty result
  if (!discoveredLinks.length) {
    return { links: [] };
  }
  
  // Take top 10 links for further evaluation (to avoid token limits)
  const topLinks = discoveredLinks.slice(0, 10);
  
  // Create structured output parser
  const parser = StructuredOutputParser.fromZodSchema(linkEvaluationSchema);
  
  // Setup the model
  const model = new ChatOpenAI({
    modelName: "gpt-4-turbo-preview",
    temperature: 0.2,
  });

  // Create the prompt template
  const promptTemplate = PromptTemplate.fromTemplate(`
    You are an expert web scraper evaluating links for their potential information value.

    # Link Evaluation Task
    Analyze the discovered links and evaluate their potential information value
    based on the link text, surrounding context, and the URL structure.

    # Scraping Goal
    {scrapingGoal}

    # Current URL
    {currentUrl}

    # Top Links to Evaluate (Limited to 10)
    {linkDetails}
    
    # Previously Visited URLs
    {visitedUrls}
    
    # Instructions
    For each link, evaluate:
    1. Potential information value (score from 0 to 1)
    2. Provide a brief explanation of why the link might be valuable

    {format_instructions}
  `);

  // Format link details for the prompt
  const linkDetails = topLinks.map((link: LinkInfo, index: number) => 
    `${index + 1}. URL: ${link.url}\n   Text: ${link.text}\n   Context: ${link.context}`
  ).join('\n\n');
  
  // Format visited URLs
  const visitedUrlsList = Array.from(input.currentState.visitedUrls).slice(0, 5);
  const visitedUrls = visitedUrlsList.length > 0 
    ? `Already visited: ${visitedUrlsList.join(', ')}${input.currentState.visitedUrls.size > 5 ? ` and ${input.currentState.visitedUrls.size - 5} more` : ''}`
    : "No URLs have been visited yet.";

  // Create the chain
  const chain = RunnableSequence.from([
    {
      format_instructions: async () => parser.getFormatInstructions(),
      currentUrl: () => input.currentUrl,
      scrapingGoal: () => input.currentState.scrapingGoal,
      linkDetails: () => linkDetails,
      visitedUrls: () => visitedUrls,
    },
    promptTemplate,
    model,
    parser
  ]);

  // Run the chain
  const result = await chain.invoke({});
  
  // Combine the LLM evaluations with the original discovered links
  const evaluatedLinks = new Map(
    result.linkEvaluations.map(evaluation => [evaluation.url, evaluation.valueScore])
  );
  
  // Update the predicted values of the original links
  const links = discoveredLinks.map((link: LinkInfo) => {
    // If the link was evaluated by the LLM, use that value
    if (evaluatedLinks.has(link.url)) {
      return {
        ...link,
        predictedValue: evaluatedLinks.get(link.url) || link.predictedValue
      };
    }
    // Otherwise use the original predicted value
    return link;
  });
  
  // Sort by predicted value (highest first)
  links.sort((a: LinkInfo, b: LinkInfo) => b.predictedValue - a.predictedValue);
  
  return { links };
} 