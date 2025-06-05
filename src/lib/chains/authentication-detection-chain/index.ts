import { RunnableSequence } from "@langchain/core/runnables";
import { PromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";
import { 
  detectAuthRequirements,
  createAuthRequest
} from "../../agents/scraper-new/core/auth-handler";
import type { HumanAuthRequest } from "../../agents/scraper-new/types";

// Define input interface
export interface AuthenticationDetectionInput {
  html: string;
  url: string;
  statusCode: number;
}

// Define output interface
export interface AuthenticationDetectionOutput {
  requiresAuthentication: boolean;
  authType: 'basic' | 'form' | 'oauth' | 'unknown';
  loginUrl?: string;
  formFields?: string[];
  authRequest?: HumanAuthRequest;
}

// Define the output schema for the LLM
const authDetectionOutputSchema = z.object({
  requiresAuthentication: z.boolean().describe("Whether the page requires authentication"),
  authType: z.enum(['basic', 'form', 'oauth', 'unknown']).describe("The type of authentication required"),
  loginUrl: z.string().optional().describe("URL of the login page if detected"),
  isLoginPage: z.boolean().describe("Whether the current page is a login page"),
  reasonForDetection: z.string().describe("Explanation of why authentication was detected")
});

export async function runAuthenticationDetectionChain(
  input: AuthenticationDetectionInput
): Promise<AuthenticationDetectionOutput> {
  // Check for authentication patterns using auth-handler module
  const authResult = await detectAuthRequirements(input.html, input.url, input.statusCode);
  
  // Create structured output parser
  const parser = StructuredOutputParser.fromZodSchema(authDetectionOutputSchema);
  
  // Setup the model
  const model = new ChatOpenAI({
    modelName: "gpt-4-turbo-preview",
    temperature: 0.1,
  });

  // Create the prompt template
  const promptTemplate = PromptTemplate.fromTemplate(`
    You are an expert web authentication detector analyzing web pages to determine if they require authentication.

    # Authentication Detection Task
    Analyze the HTML content and determine if the page requires authentication, what type of authentication is needed,
    and extract any login-related information.

    # URL
    {url}

    # HTTP Status Code
    {statusCode}

    # HTML Content Snippets (Relevant Sections)
    {htmlSnippets}
    
    # Preliminary Analysis
    Detected Authentication Type: {detectedAuthType}
    
    # Instructions
    Analyze the page and determine:
    1. Does this page require authentication to access content?
    2. What type of authentication is required (basic, form, oauth, unknown)?
    3. If this isn't a login page but requires auth, can you identify a login URL?
    4. Is this page itself a login page?
    5. Provide a brief explanation for your detection

    {format_instructions}
  `);

  // Extract relevant HTML snippets for authentication detection
  const htmlSnippets = extractAuthRelevantHtml(input.html);

  // Create the chain
  const chain = RunnableSequence.from([
    {
      format_instructions: async () => parser.getFormatInstructions(),
      url: () => input.url,
      statusCode: () => input.statusCode,
      htmlSnippets: () => htmlSnippets,
      detectedAuthType: () => authResult.authType,
    },
    promptTemplate,
    model,
    parser
  ]);

  // Run the chain
  const result = await chain.invoke({});
  
  // Prepare the output
  const output: AuthenticationDetectionOutput = {
    requiresAuthentication: result.requiresAuthentication,
    authType: result.authType,
    loginUrl: result.loginUrl || authResult.loginUrl,
    formFields: authResult.formFields,
  };
  
  // If authentication is required and it's a form, generate an auth request
  if (result.requiresAuthentication && result.authType === 'form' && result.isLoginPage) {
    output.authRequest = await createAuthRequest(
      input.url, 
      result.authType, 
      authResult.formFields
    );
  }
  
  return output;
}

// Helper function to extract authentication-relevant HTML sections
function extractAuthRelevantHtml(html: string): string {
  // Extract only the parts of HTML that might indicate authentication
  // This is a simplified implementation - in reality, we would use more sophisticated parsing
  const relevantSections: string[] = [];
  
  // Look for forms
  const formRegex = /<form[^>]*>[\s\S]*?<\/form>/gi;
  const forms = html.match(formRegex) || [];
  forms.forEach(form => {
    if (form.toLowerCase().includes('login') || 
        form.toLowerCase().includes('password') || 
        form.toLowerCase().includes('sign in')) {
      relevantSections.push(form);
    }
  });
  
  // Look for login links
  const loginLinkRegex = /<a[^>]*>(.*?login.*?|.*?sign in.*?)<\/a>/gi;
  const loginLinks = html.match(loginLinkRegex) || [];
  loginLinks.forEach(link => {
    relevantSections.push(link);
  });
  
  // Look for auth headers or login sections
  const headingsRegex = /<h[1-6][^>]*>(.*?login.*?|.*?sign in.*?|.*?account.*?)<\/h[1-6]>/gi;
  const headings = html.match(headingsRegex) || [];
  headings.forEach(heading => {
    relevantSections.push(heading);
  });
  
  // If we have too much content, truncate it
  let combinedSections = relevantSections.join('\n\n');
  if (combinedSections.length > 3000) {
    combinedSections = combinedSections.substring(0, 3000) + '... [truncated]';
  }
  
  return combinedSections || "No authentication-relevant HTML sections found.";
} 