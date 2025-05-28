import { NextResponse } from 'next/server';
import { invokeWorkflow } from '@/lib/langgraph/simple-workflow';
import { z } from 'zod';

export const runtime = 'edge';

// Define input schema
const inputSchema = z.object({
  question: z.string().min(1, "Question must not be empty"),
});

export async function POST(req: Request) {
  try {
    // Parse the request body
    const body = await req.json();
    
    // Validate input
    const result = inputSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: result.error },
        { status: 400 }
      );
    }
    
    // Get the question from the validated input
    const { question } = result.data;
    
    try {
      // Invoke the workflow with the question
      const answer = await invokeWorkflow(question);
      
      // Return the result
      return NextResponse.json({
        question,
        answer
      });
    } catch (error) {
      console.error('Workflow error:', error);
      
      // If the workflow fails, return a simple response as fallback
      return NextResponse.json({
        question,
        answer: "I apologize, but I'm experiencing technical difficulties. Please try again later."
      });
    }
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 