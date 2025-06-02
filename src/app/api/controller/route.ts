/**
 * Controller Agent API
 * 
 * This API provides access to the Controller Agent, which orchestrates
 * the interaction between specialized agents (Scraper, Knowledge Processing, etc.).
 */
import { NextRequest, NextResponse } from 'next/server';
import { ControllerAgent } from '@/lib/agents/controller';
import { ControllerRequest } from '@/lib/agents/controller/types';

export async function POST(req: NextRequest) {
  try {
    // Parse request
    const requestData = await req.json();
    
    // Validate request
    if (!requestData.requestType) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required field: requestType' 
        }, 
        { status: 400 }
      );
    }
    
    if (requestData.requestType === 'scrape' || requestData.requestType === 'scrape-and-process') {
      if (!requestData.url) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'URL is required for scraping operations' 
          }, 
          { status: 400 }
        );
      }
    }
    
    // Process request through controller agent
    console.log(`🎮 [API] Received ${requestData.requestType} request`);
    const controller = new ControllerAgent();
    const result = await controller.processRequest(requestData as ControllerRequest);
    
    // Return response
    return NextResponse.json(result);
  } catch (error) {
    console.error('❌ [API] Error in controller API:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      },
      { status: 500 }
    );
  }
} 