import { NextRequest, NextResponse } from 'next/server';
import { KnowledgeProcessingAgent } from '@/lib/agents/knowledge-processing';

export async function POST(req: NextRequest) {
  try {
    // Parse the request body
    const { content, contentType, source, metadata, options } = await req.json();
    
    // Create the Knowledge Processing Agent
    const agent = new KnowledgeProcessingAgent();
    
    // Process the content
    const result = await agent.processContent({
      content,
      contentType,
      source,
      metadata,
      options
    });
    
    // Return the processed result
    return NextResponse.json({ 
      success: true, 
      result 
    });
    
  } catch (error) {
    console.error('Error in knowledge processing:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      },
      { status: 500 }
    );
  }
} 