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
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_KEY;

// Add specific check and warning for environment variables
if (!supabaseUrl) {
  console.error("❌ [API] NEXT_PUBLIC_SUPABASE_URL environment variable is not set!");
}
if (!supabaseServiceKey) {
  console.error("❌ [API] SUPABASE_SERVICE_ROLE_KEY environment variable is not set!");
}

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
      console.log(`🔌 [API] Initializing Supabase client with URL: ${supabaseUrl.substring(0, 15)}...`);
      console.log(`🔑 [API] Service key available: ${supabaseServiceKey ? 'Yes (length: ' + supabaseServiceKey.length + ')' : 'No'}`);
      
      try {
        supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
        console.log('✅ [API] Supabase client initialized successfully');
        
        // Test connection
        console.log('🔍 [API] Testing Supabase connection...');
        const { error } = await supabaseClient.from('documents').select('count(*)', { count: 'exact', head: true });
        
        if (error) {
          console.error(`❌ [API] Supabase connection test failed:`, error);
        } else {
          console.log(`✅ [API] Supabase connection test successful`);
        }
        
        // Double check we have a proper client instance
        console.log(`📊 [API] Supabase client instance check: ${supabaseClient ? 'Valid' : 'Invalid'}`);
      } catch (err) {
        console.error(`❌ [API] Error initializing Supabase client:`, err);
        console.warn('⚠️ [API] Vector storage will be disabled due to client initialization failure');
        supabaseClient = undefined; // Ensure it's explicitly undefined
      }
    } else {
      console.warn(`⚠️ [API] Supabase environment variables not found: URL=${supabaseUrl ? 'defined' : 'undefined'}, Key=${supabaseServiceKey ? 'defined' : 'undefined'}`);
      console.warn('⚠️ [API] Vector storage will be disabled');
      supabaseClient = undefined; // Ensure it's explicitly undefined
    }
    
    // Process request through controller agent
    console.log(`🎮 [API] Received ${requestData.requestType} request (streaming: ${isStreaming})`);
    console.log(`🔌 [API] Supabase client being passed to controller: ${supabaseClient ? 'Yes' : 'No'}`);
    
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