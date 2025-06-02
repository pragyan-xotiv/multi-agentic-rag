/**
 * Controller Agent API
 * 
 * This API provides access to the Controller Agent, which orchestrates
 * the interaction between specialized agents (Scraper, Knowledge Processing, etc.).
 */
import { NextRequest, NextResponse } from 'next/server';
import { ControllerAgent } from '@/lib/agents/controller';
import { ControllerRequest, ControllerStreamEvent } from '@/lib/agents/controller/types';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
    
    // Check if streaming is requested
    const isStreaming = requestData.stream === true;
    
    // Initialize Supabase client if environment variables are available
    let supabaseClient;
    if (supabaseUrl && supabaseServiceKey) {
      supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
      console.log('🔌 [API] Supabase client initialized');
    } else {
      console.warn('⚠️ [API] Supabase environment variables not found, vector storage will be disabled');
    }
    
    // Process request through controller agent
    console.log(`🎮 [API] Received ${requestData.requestType} request (streaming: ${isStreaming})`);
    
    const controller = new ControllerAgent({ supabaseClient });
    
    if (isStreaming) {
      // Handle streaming response
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(streamController) {
          const sendEvent = async (event: ControllerStreamEvent) => {
            const data = `data: ${JSON.stringify(event)}\n\n`;
            streamController.enqueue(encoder.encode(data));
          };
          
          try {
            // Start streaming
            await sendEvent({ 
              type: 'start', 
              message: `Starting ${requestData.requestType} operation` 
            });
            
            // Process with streaming
            const result = await controller.processRequestWithStreaming(
              requestData as ControllerRequest,
              sendEvent
            );
            
            // Final event with full result
            await sendEvent({
              type: 'complete',
              message: 'Operation complete',
              data: result
            });
            
            // Close the stream
            streamController.close();
          } catch (error) {
            console.error('❌ [API] Error in streaming processing:', error);
            
            // Send error event
            await sendEvent({
              type: 'error',
              error: error instanceof Error ? error.message : 'An unknown error occurred',
              message: 'Error processing request'
            });
            
            // Close the stream
            streamController.close();
          }
        }
      });
      
      // Return streaming response
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      });
    } else {
      // Standard non-streaming response
      const result = await controller.processRequest(requestData as ControllerRequest);
      return NextResponse.json(result);
    }
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