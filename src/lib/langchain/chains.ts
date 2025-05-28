import { createLLM } from './index';
import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';

// Create a simple question answering chain
export function createQAChain() {
  const llm = createLLM();
  const parser = new StringOutputParser();
  
  const template = `
    Answer the following question based on your knowledge:
    
    Question: {question}
    
    Answer:`;
  
  const prompt = PromptTemplate.fromTemplate(template);
  
  return RunnableSequence.from([
    prompt,
    llm,
    parser,
  ]);
} 