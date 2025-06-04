"use client";

import { useState } from 'react';
import { ControllerResponse, ControllerStreamEvent } from '@/lib/agents/controller/types';
import { ScraperStreamEvent } from '@/lib/agents/scraper-new/types';

interface ControllerFormProps {
  onResultsReceived?: (results: ControllerResponse) => void;
  onStreamingEvent?: (event: ControllerStreamEvent) => void;
}

export default function ControllerForm({ onResultsReceived, onStreamingEvent }: ControllerFormProps) {
  const [url, setUrl] = useState('');
  const [scrapingGoal, setScrapingGoal] = useState('');
  const [processingGoal, setProcessingGoal] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Process streaming events from ScraperAgent
  const handleScraperEvents = async (reader: ReadableStreamDefaultReader<Uint8Array>) => {
    const decoder = new TextDecoder();
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          setIsLoading(false);
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        const events = chunk.split('\n').filter(Boolean);

        for (const eventText of events) {
          try {
            const event = JSON.parse(eventText) as ScraperStreamEvent;
            console.log('Scraper event:', event.type, event);
            
            // Forward event to parent component if handler exists
            if (onStreamingEvent) {
              // Map scraper event to controller event format for compatibility
              let controllerEvent: ControllerStreamEvent;
              
              switch (event.type) {
                case 'start':
                  controllerEvent = {
                    type: 'scraping-started',
                    message: `Starting to scrape ${event.url}`,
                    data: { url: event.url }
                  };
                  break;
                  
                case 'page':
                  controllerEvent = {
                    type: 'scraping-progress',
                    message: `Scraped page: ${event.data.url}`,
                    data: event.data
                  };
                  break;
                  
                case 'error':
                  controllerEvent = {
                    type: 'error',
                    error: event.error,
                    message: `Error: ${event.error}`
                  };
                  setError(event.error);
                  setIsLoading(false);
                  break;
                  
                case 'end':
                  controllerEvent = {
                    type: 'complete',
                    message: 'Scraping completed',
                    data: {
                      success: true,
                      result: {
                        scraperResult: event.output
                      }
                    }
                  };
                  
                  // Send final results to parent
                  if (onResultsReceived) {
                    onResultsReceived({
                      success: true,
                      result: {
                        scraperResult: event.output
                      }
                    });
                  }
                  
                  setIsLoading(false);
                  break;
                  
                default:
                  controllerEvent = {
                    type: 'scraping-progress',
                    message: `Event: ${event.type}`,
                    data: event
                  };
              }
              
              onStreamingEvent(controllerEvent);
            }
          } catch (err) {
            console.error('Error parsing scraper event:', err, eventText);
          }
        }
      }
    } catch (err) {
      console.error('Error reading stream:', err);
      setError('Error processing streaming data');
      setIsLoading(false);
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    
    try {
      // Prepare scraper request
      const scraperRequest = {
        baseUrl: url,
        scrapingGoal,
        maxPages: 10,
        maxDepth: 2,
        executeJavaScript: true,
        preventDuplicateUrls: true,
        filters: {
          mustIncludePatterns: [],
          excludePatterns: []
        }
      };
      
      console.log('📝 [Form] Using non-recursive scraper API directly');
      
      // Call the non-recursive scraper API
      const response = await fetch('/api/scraper/non-recursive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(scraperRequest),
      });
      
      if (!response.ok) {
        throw new Error(`Scraper API returned ${response.status}: ${response.statusText}`);
      }
      
      // Get the reader from the response body
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Unable to read response stream');
      }
      
      // Process the scraper events
      await handleScraperEvents(reader);
    } catch (err) {
      console.error('Error submitting form:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4">Web Content Processor</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="url" className="block text-sm font-medium text-gray-700">
            Website URL
          </label>
          <input
            type="url"
            id="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            placeholder="https://example.com"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        <div>
          <label htmlFor="scrapingGoal" className="block text-sm font-medium text-gray-700">
            Scraping Goal
          </label>
          <input
            type="text"
            id="scrapingGoal"
            value={scrapingGoal}
            onChange={(e) => setScrapingGoal(e.target.value)}
            required
            placeholder="Extract information about..."
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        <div>
          <label htmlFor="processingGoal" className="block text-sm font-medium text-gray-700">
            Processing Goal (Deprecated)
          </label>
          <input
            type="text"
            id="processingGoal"
            value={processingGoal}
            onChange={(e) => setProcessingGoal(e.target.value)}
            disabled
            placeholder="This field is deprecated"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Processing is now handled separately from scraping
          </p>
        </div>
        
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-700">
            <strong>Note:</strong> This form now uses the non-recursive scraper implementation for improved reliability on complex websites.
          </p>
        </div>
        
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}
        
        <div>
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
              isLoading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isLoading ? 'Processing...' : 'Process Website'}
          </button>
        </div>
      </form>
    </div>
  );
} 