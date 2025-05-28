import { Message } from 'ai';
import { ChatOpenAI } from '@langchain/openai';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { PromptTemplate } from '@langchain/core/prompts';
import { LLM_MODEL } from '@/lib/langchain';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

const formatMessage = (message: Message) => {
  return `${message.role}: ${message.content}`;
};

export async function POST(req: Request) {
  const { messages } = await req.json();
  
  const formattedPreviousMessages = messages.slice(0, -1).map(formatMessage).join('\n');
  const currentMessageContent = messages[messages.length - 1].content;
  
  const prompt = PromptTemplate.fromTemplate(`
    <previous_messages>
    {previous_messages}
    </previous_messages>
    
    Human: {current_message}
    AI:
  `);
  
  const llm = new ChatOpenAI({
    modelName: LLM_MODEL,
    temperature: 0.7,
  });
  
  const outputParser = new StringOutputParser();
  
  const chain = prompt.pipe(llm).pipe(outputParser);
  
  const response = await chain.invoke({
    previous_messages: formattedPreviousMessages,
    current_message: currentMessageContent,
  });
  
  return NextResponse.json({ response });
} 