/**
 * Controller Agent API
 * 
 * This API provides access to the Controller Agent, which orchestrates
 * the interaction between specialized agents (Scraper, Knowledge Processing, etc.).
 */
import { NextRequest, NextResponse } from 'next/server';
import { ControllerAgent } from '@/lib/agents/controller';
import { ControllerRequest, ControllerStreamEvent, ControllerEventType } from '@/lib/agents/controller/types';
import { createClient } from '@supabase/supabase-js';

// Extend the ControllerEventType to include our new types
type ExtendedControllerEventType = 
  | ControllerEventType 
  | 'heartbeat' 
  | 'warning'
  | 'analyze-url'
  | 'fetch-start'
  | 'fetch-complete'
  | 'extract-content'
  | 'discover-links'
  | 'evaluate-progress'
  | 'decide-next-action'
  | 'workflow-status';

// Define our extended event interface
interface ExtendedControllerStreamEvent extends Omit<ControllerStreamEvent, 'type'> {
  type: ExtendedControllerEventType;
  timestamp?: number;
  formatted_time?: string;
  friendly_title?: string;
  friendly_message?: string;
  elapsed_ms?: number;
}

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
          const sendEvent = async (event: ControllerStreamEvent | ExtendedControllerStreamEvent) => {
            // Add timestamp to all events
            const enhancedEvent: ExtendedControllerStreamEvent = {
              ...event,
              timestamp: Date.now(),
              formatted_time: new Date().toISOString()
            };

            // Add user-friendly messages for specific event types
            if (event.type === 'scraping-progress') {
              // Improve progress messages with more detail
              if (event.data && typeof event.data === 'object' && event.data !== null && 'url' in event.data) {
                enhancedEvent.friendly_title = `Processing page: ${event.data.url}`;
                enhancedEvent.friendly_message = `Extracting content from ${event.data.url}`;
                
                // Add progress percentage if available
                if (event.progress) {
                  enhancedEvent.friendly_message += ` (${Math.round(event.progress * 100)}% complete)`;
                }
              }
            } else if (event.type === 'scraping-complete') {
              enhancedEvent.friendly_title = 'Scraping completed';
              
              // Add details about pages scraped
              if (event.data && typeof event.data === 'object' && event.data !== null && 'pages' in event.data) {
                const pageCount = Array.isArray(event.data.pages) ? event.data.pages.length : 0;
                enhancedEvent.friendly_message = `Successfully scraped ${pageCount} page${pageCount !== 1 ? 's' : ''}`;
              }
            } else if (event.type === 'processing-started') {
              enhancedEvent.friendly_title = 'Processing content';
              enhancedEvent.friendly_message = 'Analyzing and extracting structured knowledge';
            } else if (event.type === 'processing-complete') {
              enhancedEvent.friendly_title = 'Processing completed';
              
              // Add details about entities extracted
              if (event.data && typeof event.data === 'object' && event.data !== null && 'entities' in event.data) {
                const entityCount = Array.isArray(event.data.entities) ? event.data.entities.length : 0;
                enhancedEvent.friendly_message = `Extracted ${entityCount} entity${entityCount !== 1 ? 'ies' : 'y'}`;
                
                // Safely check for relationships
                if (
                  event.data && 
                  typeof event.data === 'object' && 
                  'relationships' in event.data &&
                  Array.isArray(event.data.relationships) && 
                  event.data.relationships.length > 0
                ) {
                  const relationshipCount = event.data.relationships.length;
                  enhancedEvent.friendly_message += ` and ${relationshipCount} relationship${relationshipCount !== 1 ? 's' : ''}`;
                }
              }
            } else if (event.type === 'error') {
              // Provide user-friendly error messages
              enhancedEvent.friendly_title = 'Error occurred';
              
              // Special handling for common errors
              if (event.error && typeof event.error === 'string') {
                // Determine if this is a fatal error or a recoverable warning
                const isFatalError = 
                  event.error.includes('fatal') || 
                  event.error.includes('failed') ||
                  event.error.includes('timeout exceeded');
                
                // For content-related issues that might be temporary, treat as warnings
                const isContentWarning = 
                  event.error.includes('no content') || 
                  event.error.includes('returned no content') ||
                  event.error.includes('empty response');
                
                // Set appropriate event type and styling
                if (isContentWarning && !isFatalError) {
                  enhancedEvent.type = 'warning' as ExtendedControllerEventType;
                  enhancedEvent.friendly_title = 'Content warning';
                  enhancedEvent.friendly_message = 'Some content may be missing. The operation will continue.';
                } else if (event.error.includes('recursion limit')) {
                  enhancedEvent.friendly_message = 'The website structure is too complex. Try with fewer pages or a more specific URL.';
                } else if (event.error.includes('deadlock')) {
                  enhancedEvent.friendly_message = 'Processing stalled. This site may use anti-scraping measures or complex JavaScript.';
                } else if (event.error.includes('timeout')) {
                  enhancedEvent.friendly_message = 'The operation took too long to complete. Try with a smaller scope.';
                } else {
                  enhancedEvent.friendly_message = event.message || 'An unexpected error occurred while processing the request.';
                }
              } else {
                enhancedEvent.friendly_message = event.message || 'An unexpected error occurred while processing the request.';
              }
            }
            
            const data = `data: ${JSON.stringify(enhancedEvent)}\n\n`;
            streamController.enqueue(encoder.encode(data));
          };
          
          // Track operation timing
          const operationStart = Date.now();
          
          try {
            // Start streaming
            await sendEvent({ 
              type: 'start', 
              message: `Starting ${requestData.requestType} operation`,
              friendly_title: 'Starting operation',
              friendly_message: `Beginning to process ${requestData.url || 'content'}`
            });
            
            // Process with streaming
            const result = await controller.processRequestWithStreaming(
              requestData as ControllerRequest,
              sendEvent
            );

            console.log('🔍 [API] Streaming result:', result);
            
            // Add operation timing to the final result
            const resultWithTiming = {
              ...result,
              timing: {
                total_ms: Date.now() - operationStart,
                formatted: `${((Date.now() - operationStart) / 1000).toFixed(2)}s`
              }
            };
            
            // Final event with full result
            await sendEvent({
              type: 'complete',
              message: 'Operation complete',
              data: resultWithTiming,
              friendly_title: 'Operation complete',
              friendly_message: `Processed ${requestData.url || 'content'} in ${((Date.now() - operationStart) / 1000).toFixed(2)} seconds`
            });
            
            // Close the stream
            streamController.close();
          } catch (error) {
            console.error('❌ [API] Error in streaming processing:', error);
            
            // Send error event
            await sendEvent({
              type: 'error',
              error: error instanceof Error ? error.message : 'An unknown error occurred',
              message: 'Error processing request',
              friendly_title: 'Processing failed',
              friendly_message: error instanceof Error ? 
                error.message : 'The operation could not be completed'
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