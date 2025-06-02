/**
 * Controller Agent Streaming API
 * 
 * This API provides streaming access to the Controller Agent.
 * It uses Server-Sent Events (SSE) to stream progress updates.
 */
import { NextRequest } from 'next/server';
import { ControllerAgent } from '@/lib/agents/controller';
import { ControllerRequest, ControllerStreamEvent } from '@/lib/agents/controller/types';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(req: NextRequest) {
  // Get request data from query params
  const searchParams = req.nextUrl.searchParams;
  const dataParam = searchParams.get('data');
  
  if (!dataParam) {
    return new Response(
      JSON.stringify({
        type: 'error',
        error: 'Missing data parameter',
        message: 'Request data is required'
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
  
  let requestData: ControllerRequest;
  
  try {
    requestData = JSON.parse(dataParam);
  } catch {
    return new Response(
      JSON.stringify({
        type: 'error',
        error: 'Invalid JSON in data parameter',
        message: 'Request data must be valid JSON'
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
  
  // Validate request
  if (!requestData.requestType) {
    return new Response(
      JSON.stringify({
        type: 'error',
        error: 'Missing required field: requestType',
        message: 'Request type is required'
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
  
  if (requestData.requestType === 'scrape' || requestData.requestType === 'scrape-and-process') {
    if (!requestData.url) {
      return new Response(
        JSON.stringify({
          type: 'error',
          error: 'URL is required for scraping operations',
          message: 'URL is required for scraping operations'
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    }
  }
  
  // Force streaming mode
  requestData.stream = true;
  
  // Initialize Supabase client if environment variables are available
  let supabaseClient: SupabaseClient | undefined;
  if (supabaseUrl && supabaseServiceKey) {
    supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    console.log('🔌 [API/Stream] Supabase client initialized');
  } else {
    console.warn('⚠️ [API/Stream] Supabase environment variables not found, vector storage will be disabled');
  }
  
  // Process request through controller agent with streaming
  console.log(`🎮 [API/Stream] Received ${requestData.requestType} request`);
  
  // Setup streaming response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(streamController) {
      const sendEvent = async (event: ControllerStreamEvent) => {
        const data = `data: ${JSON.stringify(event)}\n\n`;
        streamController.enqueue(encoder.encode(data));
      };
      
      try {
        const controller = new ControllerAgent({ supabaseClient });
        
        // Start streaming
        await sendEvent({ 
          type: 'start', 
          message: `Starting ${requestData.requestType} operation` 
        });
        
        // Process with streaming
        const result = await controller.processRequestWithStreaming(
          requestData,
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
        console.error('❌ [API/Stream] Error in streaming processing:', error);
        
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
} 