// Knowledge Processing Agent workflow file

import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import { KnowledgeAgentState, ProcessingResult, ContentAnalysis, ProcessingStrategy, Entity, Relationship, ContentChunk } from "./types";
import { ScraperOutput } from "../scraper/types";

// Import LangChain components
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { JsonOutputParser } from "@langchain/core/output_parsers";

// Default LLM
const llm = new ChatOpenAI({
  modelName: "gpt-4o",
  temperature: 0.2,
});

/**
 * Define the knowledge processor workflow state using Annotation
 */
const KnowledgeStateAnnotation = Annotation.Root({
  // Input state
  rawContent: Annotation<string | ScraperOutput>(),
  processingGoal: Annotation<string>(),
  processingOptions: Annotation<Record<string, string | number | boolean | string[]>>(),
  
  // Analysis state
  contentAnalysis: Annotation<ContentAnalysis | undefined>(),
  processingStrategy: Annotation<ProcessingStrategy | undefined>(),
  
  // Processing state
  processedContent: Annotation<string[] | undefined>(),
  entities: Annotation<Entity[]>(),
  relationships: Annotation<Relationship[]>(),
  chunks: Annotation<ContentChunk[]>(),
  
  // Metrics and output
  processingMetrics: Annotation<{
    documentCount: number;
    entityCount: number;
    relationshipCount: number;
    processingStage: string;
    validationScore: number;
  }>(),
  
  // Final output
  structuredKnowledge: Annotation<ProcessingResult | undefined>()
});

/**
 * Step 1: Analyze Content - Determines the content type and characteristics
 */
async function analyzeContent(state: KnowledgeAgentState): Promise<KnowledgeAgentState> {
  console.log(`🧠 [KnowledgeProcessor] Analyzing content...`);
  
  // Extract text samples from raw content
  const contentSamples = extractContentSamples(state.rawContent);
  
  // Create prompt for content analysis
  const analysisPrompt = PromptTemplate.fromTemplate(`
    You are an expert content analyst specializing in knowledge extraction.
    Analyze the following content samples and determine their characteristics.

    CONTENT SAMPLES:
    {contentSamples}

    PROCESSING GOAL:
    {processingGoal}

    Provide a detailed analysis with the following:
    1. Content type (article, documentation, product, etc.)
    2. Is this domain-specific knowledge?
    3. Complexity score (0-1)
    4. Types of structured data present (tables, lists, code blocks, etc.)
    5. Main topics covered (list up to 5)
    6. Estimated number of entities present

    Format your response as a JSON object with these keys:
    {
      "contentType": string,
      "domainSpecific": boolean,
      "complexity": number,
      "structuredDataTypes": string[],
      "mainTopics": string[],
      "estimatedEntitiesCount": number
    }
  `);
  
  try {
    // Create and run the chain
    const analysisChain = analysisPrompt.pipe(llm).pipe(
      new JsonOutputParser<ContentAnalysis>()
    );
    
    const analysis = await analysisChain.invoke({
      contentSamples,
      processingGoal: state.processingGoal
    });
    
    console.log(`✅ [KnowledgeProcessor] Content analysis complete`);
    console.log(`📊 [KnowledgeProcessor] Content type: ${analysis.contentType}, Complexity: ${analysis.complexity}`);
    
    return {
      ...state,
      contentAnalysis: analysis,
      processingMetrics: {
        ...state.processingMetrics,
        processingStage: "contentAnalyzed"
      }
    };
  } catch (error) {
    console.error(`❌ [KnowledgeProcessor] Error analyzing content:`, error);
    
    // Provide a default analysis in case of error
    return {
      ...state,
      contentAnalysis: {
        contentType: "unknown",
        domainSpecific: false,
        complexity: 0.5,
        structuredDataTypes: [],
        mainTopics: ["unknown"],
        estimatedEntitiesCount: 10
      },
      processingMetrics: {
        ...state.processingMetrics,
        processingStage: "contentAnalyzed"
      }
    };
  }
}

/**
 * Extract representative content samples from raw content
 */
function extractContentSamples(rawContent: string | ScraperOutput): string {
  if (typeof rawContent === 'string') {
    // If raw content is a string, take samples from it
    const contentLength = rawContent.length;
    
    if (contentLength <= 3000) {
      return rawContent;
    }
    
    // Take beginning, middle, and end samples
    const beginning = rawContent.substring(0, 1000);
    const middle = rawContent.substring(Math.floor(contentLength / 2) - 500, Math.floor(contentLength / 2) + 500);
    const end = rawContent.substring(contentLength - 1000);
    
    return `BEGINNING SAMPLE:\n${beginning}\n\nMIDDLE SAMPLE:\n${middle}\n\nEND SAMPLE:\n${end}`;
  } else {
    // If it's a ScraperOutput, take samples from the first few pages
    const pages = rawContent.pages.slice(0, Math.min(3, rawContent.pages.length));
    let samples = "";
    
    pages.forEach((page, index) => {
      const contentSample = page.content.length <= 1000 
        ? page.content
        : page.content.substring(0, 1000) + "...";
        
      samples += `PAGE ${index + 1} SAMPLE (${page.url}):\n${contentSample}\n\n`;
    });
    
    return samples;
  }
}

/**
 * Step 2: Plan Processing Strategy - Selects the optimal processing approach
 */
async function planProcessingStrategy(state: KnowledgeAgentState): Promise<KnowledgeAgentState> {
  console.log(`🧩 [KnowledgeProcessor] Planning processing strategy...`);
  
  if (!state.contentAnalysis) {
    console.error(`❌ [KnowledgeProcessor] Missing content analysis, cannot plan strategy`);
    return state;
  }
  
  // Create prompt for strategy planning
  const strategyPrompt = PromptTemplate.fromTemplate(`
    You are a knowledge processing expert who specializes in optimal content extraction strategies.
    Based on the content analysis, determine the best processing approach.

    CONTENT ANALYSIS:
    {contentAnalysis}

    PROCESSING GOAL:
    {processingGoal}

    USER OPTIONS:
    {options}

    Select the optimal processing strategy with these parameters:
    1. Chunking method (semantic, fixed, hierarchical, dialogue)
    2. Chunk size (in tokens)
    3. Chunk overlap (in tokens)
    4. Entity extraction approach (general, domain-specific, hybrid)
    5. Relationship discovery method (co-occurrence, explicit, inference, combined)
    6. Embedding model recommendation

    Format your response as a JSON object with these keys:
    {
      "chunkingMethod": "semantic" | "fixed" | "hierarchical" | "dialogue",
      "chunkSize": number,
      "overlapSize": number,
      "entityExtractionApproach": "general" | "domain-specific" | "hybrid",
      "relationshipDiscoveryMethod": "co-occurrence" | "explicit" | "inference" | "combined",
      "embeddingModel": string
    }
  `);
  
  try {
    // Create and run the chain
    const strategyChain = strategyPrompt.pipe(llm).pipe(
      new JsonOutputParser<ProcessingStrategy>()
    );
    
    const strategy = await strategyChain.invoke({
      contentAnalysis: JSON.stringify(state.contentAnalysis),
      processingGoal: state.processingGoal,
      options: JSON.stringify(state.processingOptions)
    });
    
    console.log(`✅ [KnowledgeProcessor] Strategy planning complete`);
    console.log(`📊 [KnowledgeProcessor] Chunking method: ${strategy.chunkingMethod}, Entity approach: ${strategy.entityExtractionApproach}`);
    
    return {
      ...state,
      processingStrategy: strategy,
      processingMetrics: {
        ...state.processingMetrics,
        processingStage: "strategyPlanned"
      }
    };
  } catch (error) {
    console.error(`❌ [KnowledgeProcessor] Error planning strategy:`, error);
    
    // Provide a default strategy in case of error
    return {
      ...state,
      processingStrategy: {
        chunkingMethod: "semantic",
        chunkSize: 1000,
        overlapSize: 200,
        entityExtractionApproach: "general",
        relationshipDiscoveryMethod: "co-occurrence",
        embeddingModel: "text-embedding-3-small"
      },
      processingMetrics: {
        ...state.processingMetrics,
        processingStage: "strategyPlanned"
      }
    };
  }
}

/**
 * Create the knowledge processing workflow
 */
export function createKnowledgeWorkflow() {
  // Create a StateGraph with the annotation-based state structure
  const workflow = new StateGraph(KnowledgeStateAnnotation)
    // Add nodes for each step
    .addNode("analyzeContent", analyzeContent)
    .addNode("planStrategy", planProcessingStrategy);
  
  // Define the workflow flow
  workflow.addEdge(START, "analyzeContent");
  workflow.addEdge("analyzeContent", "planStrategy");
  workflow.addEdge("planStrategy", END);
  
  // Compile the graph into a runnable
  return workflow.compile();
}

/**
 * Initialize the knowledge processing state
 */
export function initializeKnowledgeState(
  content: string | ScraperOutput,
  processingGoal: string,
  options: Record<string, string | number | boolean | string[]> = {}
): KnowledgeAgentState {
  return {
    rawContent: content,
    processingGoal,
    processingOptions: options,
    
    entities: [],
    relationships: [],
    chunks: [],
    
    processingMetrics: {
      documentCount: typeof content === 'string' ? 1 : content.pages.length,
      entityCount: 0,
      relationshipCount: 0,
      processingStage: "initialized",
      validationScore: 0
    }
  };
}

/**
 * Execute the knowledge processing workflow
 */
export async function executeKnowledgeWorkflow(
  content: string | ScraperOutput,
  processingGoal: string,
  options: Record<string, string | number | boolean | string[]> = {}
): Promise<ProcessingResult> {
  const startTime = Date.now();
  
  // Initialize the state
  const initialState = initializeKnowledgeState(content, processingGoal, options);
  
  try {
    // Create and execute the workflow
    const workflow = createKnowledgeWorkflow();
    const result = await workflow.invoke(initialState);
    
    // Calculate execution time
    const executionTime = (Date.now() - startTime) / 1000; // Convert to seconds
    
    // Format the final result
    return {
      entities: result.entities,
      relationships: result.relationships,
      chunks: result.chunks,
      metadata: {
        processingTime: executionTime,
        contentLength: typeof content === 'string' ? content.length : content.summary.totalContentSize,
        contentType: result.contentAnalysis?.contentType || "unknown",
        extractionQuality: result.processingMetrics.validationScore
      }
    };
  } catch (error) {
    console.error(`❌ [KnowledgeProcessor] Error executing workflow:`, error);
    
    // Return empty result in case of error
    return {
      entities: [],
      relationships: [],
      chunks: [],
      metadata: {
        processingTime: (Date.now() - startTime) / 1000,
        contentLength: typeof content === 'string' ? content.length : content.summary.totalContentSize,
        contentType: "unknown",
        extractionQuality: 0
      }
    };
  }
}
