"use client";

import { useState } from 'react';
import StreamingToggle from './StreamingToggle';
import { ControllerResponse, ControllerStreamEvent } from '@/lib/agents/controller/types';

interface ControllerFormProps {
  onResultsReceived?: (results: ControllerResponse) => void;
  onStreamingEvent?: (event: ControllerStreamEvent) => void;
}

export default function ControllerForm({ onResultsReceived, onStreamingEvent }: ControllerFormProps) {
  const [url, setUrl] = useState('');
  const [scrapingGoal, setScrapingGoal] = useState('');
  const [processingGoal, setProcessingGoal] = useState('');
  const [isStreaming, setIsStreaming] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Process streaming events from EventSource
  const handleStreamingEvents = (eventSource: EventSource) => {
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Streaming event:', data);
        
        // Forward event to parent component if handler exists
        if (onStreamingEvent) {
          onStreamingEvent(data);
        }
        
        // Handle completion
        if (data.type === 'complete') {
          setIsLoading(false);
          eventSource.close();
          
          // Send final results to parent
          if (onResultsReceived && data.data) {
            onResultsReceived(data.data);
          }
        }
        
        // Handle errors
        if (data.type === 'error') {
          setError(data.message || 'An error occurred');
          setIsLoading(false);
          eventSource.close();
        }
      } catch (err) {
        console.error('Error parsing streaming event:', err);
        setError('Error processing streaming data');
        setIsLoading(false);
        eventSource.close();
      }
    };
    
    eventSource.onerror = () => {
      setError('Connection error');
      setIsLoading(false);
      eventSource.close();
    };
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    
    try {
      const requestData = {
        requestType: 'scrape-and-process',
        url,
        scrapingGoal,
        processingGoal,
        stream: isStreaming,
        options: {
          maxPages: 10,
          maxDepth: 2,
          executeJavaScript: true
        },
        storageOptions: {
          storeResults: true,
          storeEntities: true,
          storeRelationships: true,
          storeContentChunks: true
        }
      };
      
      if (isStreaming) {
        // Use EventSource for streaming
        const queryParams = new URLSearchParams({
          data: JSON.stringify(requestData)
        }).toString();
        
        const eventSource = new EventSource(`/api/controller/stream?${queryParams}`);
        handleStreamingEvents(eventSource);
      } else {
        // Standard fetch for non-streaming
        const response = await fetch('/api/controller', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestData),
        });
        
        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.error || 'Failed to process request');
        }
        
        // Send results to parent component
        if (onResultsReceived) {
          onResultsReceived(result);
        }
        
        setIsLoading(false);
      }
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
            Processing Goal
          </label>
          <input
            type="text"
            id="processingGoal"
            value={processingGoal}
            onChange={(e) => setProcessingGoal(e.target.value)}
            placeholder="Identify entities and relationships..."
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        <div>
          <StreamingToggle 
            initialState={isStreaming} 
            onToggle={setIsStreaming}
          />
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