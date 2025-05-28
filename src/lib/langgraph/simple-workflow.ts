import { AIMessageChunk } from '@langchain/core/messages';
import { createLLM } from '../langchain';

/**
 * This is a simplified version of the workflow that doesn't use LangGraph directly
 * It simulates the behavior of a multi-step thinking process
 */

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// Create a simple workflow that thinks and then answers a question
export function createSimpleWorkflow() {
  return {
    // This is the method that will be called to invoke the workflow
    invoke: async (input: { messages: Message[] }) => {
      const question = input.messages[input.messages.length - 1].content;
      
      // Step 1: Think about the question
      const thoughts = await thinkAboutQuestion(question);
      
      // Step 2: Generate an answer based on the thoughts
      const answer = await generateAnswer(question, thoughts);
      
      // Return the result with the input messages and the new AI message
      return {
        messages: [
          ...input.messages,
          {
            role: 'assistant',
            content: answer
          }
        ]
      };
    }
  };
}

// Function to invoke the workflow with a question
export async function invokeWorkflow(question: string) {
  const workflow = createSimpleWorkflow();
  
  // Invoke the workflow with the question
  const result = await workflow.invoke({
    messages: [
      {
        role: 'user',
        content: question
      }
    ]
  });
  
  // Return the last message content as the answer
  return result.messages[result.messages.length - 1].content;
}

// Extract content from the LLM response
function extractContent(response: AIMessageChunk): string {
  if (typeof response === 'string') {
    return response;
  } else if (response && typeof response === 'object') {
    // Try to extract content from different possible response structures
    if ('content' in response && response.content !== undefined) {
      return typeof response.content === 'string' 
        ? response.content 
        : String(response.content);
    } else if ('text' in response && response.text !== undefined) {
      return String(response.text);
    } else if ('message' in response && response.message !== undefined) {
      if (typeof response.message === 'string') {
        return response.message;
      } else if (typeof response.message === 'object' && response.message && 'content' in response.message) {
        return String(response.message.content);
      }
    } else if ('result' in response && response.result !== undefined) {
      return String(response.result);
    }
    return JSON.stringify(response);
  }
  return "";
}

// Function to simulate the thinking step
async function thinkAboutQuestion(question: string): Promise<string> {
  const llm = createLLM({ temperature: 0.7 });
  
  const prompt = `
Think step by step about how to answer the following question:

Question: ${question}

Thoughts:`;
  
  try {
    // First cast to unknown, then to our custom type to avoid direct type errors
    const response = await llm.invoke(prompt);
    return extractContent(response) || `I need to analyze "${question}" carefully.`;
  } catch (error) {
    console.error('Error in thinking step:', error);
    return `I should carefully consider what the user is asking about regarding "${question}".`;
  }
}

// Function to generate an answer based on the thoughts
async function generateAnswer(question: string, thoughts: string): Promise<string> {
  const llm = createLLM({ temperature: 0.3 });
  
  const prompt = `
Answer the following question. Use the thoughts to help form a comprehensive answer.

Question: ${question}
Thoughts: ${thoughts}

Answer:`;
  
  try {
    const response = await llm.invoke(prompt);
    return extractContent(response) || `I'm sorry, I couldn't generate a proper answer for "${question}" at this time.`;
  } catch (error) {
    console.error('Error in answering step:', error);
    return `I'm sorry, I couldn't generate an answer for "${question}" at this time.`;
  }
} 