import { RunnableSequence } from "@langchain/core/runnables";
import { PromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";
import { extractContent } from "../../agents/scraper/core/content-extractor";
import type { ScraperAgentState, PageContent } from "../../agents/scraper/types";

// Define input interface
export interface ContentExtractionInput {
  html: string;
  url: string;
  currentState: ScraperAgentState;
}

// Define output interface
export interface ContentExtractionOutput {
  title: string;
  content: string;
  contentType: string;
  metrics: {
    informationDensity: number;
    relevance: number;
    uniqueness: number;
    contentQualityAnalysis?: string;
  };
  entities?: Array<{
    name: string;
    type: string;
    mentions: number;
  }>;
}

// Define the output schema for the LLM
const contentMetricsSchema = z.object({
  informationDensity: z.number().min(0).max(1).describe("A score from 0 to 1 indicating the density of useful information in the content"),
  relevance: z.number().min(0).max(1).describe("A score from 0 to 1 indicating how relevant the content is to the scraping goal"),
  uniqueness: z.number().min(0).max(1).describe("A score from 0 to 1 indicating how unique this content is compared to already extracted content"),
  contentQualityAnalysis: z.string().describe("A brief analysis of the content quality and value")
});

export async function runContentExtractionChain(
  input: ContentExtractionInput
): Promise<ContentExtractionOutput> {
  console.log(`🔍 [ContentExtraction Chain] Starting extraction chain for URL: ${input.url}`);
  console.log(`📄 [ContentExtraction Chain] HTML length: ${input.html ? input.html.length : 0} bytes`);
  
  if (!input.html || input.html.length === 0) {
    console.error(`❌ [ContentExtraction Chain] Received empty HTML for ${input.url}`);
    // Return an empty result instead of failing
    return {
      title: 'Empty Page',
      content: '',
      contentType: 'text/html',
      metrics: {
        informationDensity: 0,
        relevance: 0,
        uniqueness: 0
      }
    };
  }
  
  try {
    // Extract content using the core content-extractor module
    console.log(`🧪 [ContentExtraction Chain] Calling extractContent function...`);
    const extractionResult = await extractContent(input.html, input.url, input.currentState);
    console.log(`✅ [ContentExtraction Chain] Content extracted: title="${extractionResult.title}", content length=${extractionResult.content.length} bytes`);
    
    // If the extraction returned empty content, handle it
    if (!extractionResult.content || extractionResult.content.trim().length === 0) {
      console.warn(`⚠️ [ContentExtraction Chain] Extraction returned empty content. Using fallback values.`);
      return {
        title: extractionResult.title || 'Empty Content',
        content: 'No content was extracted from this page.',
        contentType: 'text/html',
        metrics: {
          informationDensity: 0.1,
          relevance: 0.1,
          uniqueness: 0.5
        }
      };
    }
  
    // Create structured output parser
    console.log(`🔧 [ContentExtraction Chain] Setting up LLM for metrics calculation...`);
    const parser = StructuredOutputParser.fromZodSchema(contentMetricsSchema);
    
    // Setup the model
    const model = new ChatOpenAI({
      modelName: "gpt-4-turbo-preview",
      temperature: 0.1,
    });

    // Create the prompt template
    const promptTemplate = PromptTemplate.fromTemplate(`
      You are an expert content analyst evaluating web content for its information value.

      # Content Evaluation Task
      Analyze the extracted content and evaluate its information density, relevance to the scraping goal,
      and uniqueness compared to previously gathered information.

      # Scraping Goal
      {scrapingGoal}

      # URL
      {url}

      # Extracted Title
      {title}

      # Content Preview (First 1000 characters)
      {contentPreview}
      
      # Content Type
      {contentType}
      
      # Previously Collected Information Topics
      {previousTopics}
      
      # Instructions
      Analyze the content and determine:
      1. Information Density: How dense is the useful information (score from 0 to 1)
      2. Relevance: How relevant is the content to the scraping goal (score from 0 to 1)
      3. Uniqueness: How unique is this content compared to already collected information (score from 0 to 1)
      4. Provide a brief analysis of the content quality and value

      {format_instructions}
    `);

    // Get a preview of the content (first 1000 chars)
    const contentPreview = extractionResult.content.substring(0, 1000) + 
      (extractionResult.content.length > 1000 ? '...' : '');
    
    // Get a summary of previously collected topics
    const previousTopics = getPreviousTopicsSummary(input.currentState);
    console.log(`📚 [ContentExtraction Chain] Previous topics: ${previousTopics}`);

    // Create the chain
    const chain = RunnableSequence.from([
      {
        format_instructions: async () => parser.getFormatInstructions(),
        url: () => input.url,
        title: () => extractionResult.title,
        contentPreview: () => contentPreview,
        contentType: () => extractionResult.contentType,
        scrapingGoal: () => input.currentState.scrapingGoal,
        previousTopics: () => previousTopics,
      },
      promptTemplate,
      model,
      parser
    ]);

    // Run the chain
    console.log(`🔄 [ContentExtraction Chain] Running LLM to evaluate content...`);
    const metricsResult = await chain.invoke({});
    console.log(`📊 [ContentExtraction Chain] Metrics calculated:`, metricsResult);
    
    // Combine the extracted content with the metrics
    const result: ContentExtractionOutput = {
      title: extractionResult.title,
      content: extractionResult.content,
      contentType: extractionResult.contentType,
      metrics: {
        informationDensity: metricsResult.informationDensity,
        relevance: metricsResult.relevance,
        uniqueness: metricsResult.uniqueness,
        contentQualityAnalysis: metricsResult.contentQualityAnalysis
      }
      // Note: entities field removed since it's not provided by the extractContent function
    };
    
    console.log(`✅ [ContentExtraction Chain] Chain execution complete`);
    console.log(`📈 [ContentExtraction Chain] Final metrics: density=${result.metrics.informationDensity.toFixed(2)}, relevance=${result.metrics.relevance.toFixed(2)}, uniqueness=${result.metrics.uniqueness.toFixed(2)}`);
    
    return result;
  } catch (error) {
    console.error(`❌ [ContentExtraction Chain] Error in content extraction chain:`, error);
    // Return fallback values instead of failing completely
    return {
      title: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      content: 'An error occurred during content extraction.',
      contentType: 'text/html',
      metrics: {
        informationDensity: 0.1,
        relevance: 0.1,
        uniqueness: 0.5
      }
    };
  }
}

/**
 * Helper function to summarize previously collected topics
 */
function getPreviousTopicsSummary(state: ScraperAgentState): string {
  if (!state.extractedContent || state.extractedContent.size === 0) {
    return "No previous content has been collected yet.";
  }
  
  // Convert Map to array of PageContent objects
  const contentArray: PageContent[] = Array.from(state.extractedContent.values());
  
  // Get the titles of previously extracted content
  const titles = contentArray.map(item => item.title);
  
  // Get unique topics/entities if available
  const entities = new Set<string>();
  contentArray.forEach(item => {
    if (item.entities) {
      item.entities.forEach(entity => {
        if (entity.type !== 'general') {
          entities.add(`${entity.name} (${entity.type})`);
        }
      });
    }
  });
  
  // Combine into a summary
  let summary = `Previously collected ${contentArray.length} pages including: ${titles.slice(0, 5).join(', ')}`;
  
  if (titles.length > 5) {
    summary += ` and ${titles.length - 5} more`;
  }
  
  if (entities.size > 0) {
    const entityList = Array.from(entities).slice(0, 10);
    summary += `\n\nKey entities found: ${entityList.join(', ')}`;
    
    if (entities.size > 10) {
      summary += ` and ${entities.size - 10} more`;
    }
  }
  
  return summary;
} 