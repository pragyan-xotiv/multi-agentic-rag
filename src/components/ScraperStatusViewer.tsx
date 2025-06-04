'use client';

import React, { useState, useEffect, useRef } from 'react';

interface PageMetrics {
  informationDensity: number;
  relevance: number;
  uniqueness: number;
  contentQualityAnalysis?: string;
}

interface ProcessedUrl {
  url: string;
  status: 'queued' | 'fetching' | 'extracting' | 'discovering' | 'complete' | 'error';
  title?: string;
  contentLength?: number;
  metrics?: PageMetrics;
  linkCount?: number;
  processingTime?: number;
  error?: string;
  startTime: number;
}

interface ScraperProgress {
  pagesScraped: number;
  queueSize: number;
  goalCompletion: number;
}

interface ScraperStatusViewerProps {
  onComplete?: (summary: {
    pagesScraped: number;
    totalContentSize: number;
    executionTime: number;
    goalCompletion: number;
    coverageScore: number;
  }) => void;
}

// Extend MessageEvent to include the data property with correct type
interface SSEEvent extends MessageEvent {
  data: string;
}

export default function ScraperStatusViewer({ onComplete }: ScraperStatusViewerProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');
  const [scrapingGoal, setScrapingGoal] = useState('');
  const [maxPages, setMaxPages] = useState(10);
  const [processedUrls, setProcessedUrls] = useState<Map<string, ProcessedUrl>>(new Map());
  const [progress, setProgress] = useState<ScraperProgress>({ pagesScraped: 0, queueSize: 0, goalCompletion: 0 });
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);
  
  // Clean up EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        setIsConnected(false);
      }
    };
  }, []);
  
  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toISOString().split('T')[1].split('.')[0]} - ${message}`]);
  };
  
  const startScraping = async () => {
    if (!baseUrl) {
      setError('Base URL is required');
      return;
    }
    
    if (!scrapingGoal) {
      setError('Scraping goal is required');
      return;
    }
    
    setError(null);
    setLogs([]);
    setProcessedUrls(new Map());
    setProgress({ pagesScraped: 0, queueSize: 0, goalCompletion: 0 });
    
    try {
      // First, start the scraping job
      addLog(`Starting scraping job for ${baseUrl}`);
      setIsRunning(true);
      
      // Connect to event stream
      connectToEventStream();
      
      // Make the API call to start scraping
      const response = await fetch('/api/scraper/non-recursive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          baseUrl,
          scrapingGoal,
          maxPages: parseInt(String(maxPages), 10),
          maxDepth: 3,
          executeJavaScript: true,
          preventDuplicateUrls: true,
          batchSize: 3, // Process 3 URLs per batch
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start scraping job');
      }
      
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
      setIsRunning(false);
      addLog(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
  
  const connectToEventStream = () => {
    // Close existing connection if any
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    
    // Create new EventSource connection
    const eventSource = new EventSource('/api/scraper/non-recursive');
    eventSourceRef.current = eventSource;
    
    // Connection opened
    eventSource.onopen = () => {
      setIsConnected(true);
      addLog('Connected to event stream');
    };
    
    // Handle generic messages (fallback)
    eventSource.addEventListener('message', (event: SSEEvent) => {
      try {
        const data = JSON.parse(event.data);
        addLog(`Received event: ${data.type}`);
      } catch (error) {
        console.error('Error parsing message data:', error);
      }
    });
    
    // Handle URL processing start
    eventSource.addEventListener('url-processing', (event: SSEEvent) => {
      try {
        const data = JSON.parse(event.data);
        addLog(`Processing URL: ${data.url} (depth: ${data.depth})`);
        
        // Update processed URLs map
        setProcessedUrls(prev => {
          const updated = new Map(prev);
          updated.set(data.url, {
            url: data.url,
            status: 'queued',
            startTime: data.timestamp
          });
          return updated;
        });
      } catch (error) {
        console.error('Error handling url-processing event:', error);
      }
    });
    
    // Handle URL fetching
    eventSource.addEventListener('url-fetch', (event: SSEEvent) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.status === 'fetching') {
          addLog(`Fetching: ${data.url} (JS: ${data.useJavaScript ? 'enabled' : 'disabled'})`);
          
          // Update status
          setProcessedUrls(prev => {
            const updated = new Map(prev);
            const current = prev.get(data.url) || {
              url: data.url,
              status: 'queued',
              startTime: data.timestamp
            };
            
            updated.set(data.url, {
              ...current,
              status: 'fetching'
            });
            
            return updated;
          });
        } else if (data.status === 'complete') {
          addLog(`Fetched: ${data.url} (${data.contentLength} bytes)`);
          
          // Update status
          setProcessedUrls(prev => {
            const updated = new Map(prev);
            const current = prev.get(data.url);
            
            if (current) {
              updated.set(data.url, {
                ...current,
                status: 'extracting',
                contentLength: data.contentLength
              });
            }
            
            return updated;
          });
        }
      } catch (error) {
        console.error('Error handling url-fetch event:', error);
      }
    });
    
    // Handle content extraction
    eventSource.addEventListener('url-extract', (event: SSEEvent) => {
      try {
        const data = JSON.parse(event.data);
        addLog(`Extracting content from: ${data.url}`);
        
        // Update status
        setProcessedUrls(prev => {
          const updated = new Map(prev);
          const current = prev.get(data.url);
          
          if (current) {
            updated.set(data.url, {
              ...current,
              status: 'extracting'
            });
          }
          
          return updated;
        });
      } catch (error) {
        console.error('Error handling url-extract event:', error);
      }
    });
    
    // Handle link discovery
    eventSource.addEventListener('url-links', (event: SSEEvent) => {
      try {
        const data = JSON.parse(event.data);
        addLog(`Discovered ${data.linkCount} links on: ${data.url}`);
        
        // Update status
        setProcessedUrls(prev => {
          const updated = new Map(prev);
          const current = prev.get(data.url);
          
          if (current) {
            updated.set(data.url, {
              ...current,
              status: 'discovering',
              linkCount: data.linkCount
            });
          }
          
          return updated;
        });
      } catch (error) {
        console.error('Error handling url-links event:', error);
      }
    });
    
    // Handle URL completion
    eventSource.addEventListener('url-complete', (event: SSEEvent) => {
      try {
        const data = JSON.parse(event.data);
        addLog(`Completed processing: ${data.url} (${data.processingTime}ms)`);
        
        // Update status
        setProcessedUrls(prev => {
          const updated = new Map(prev);
          const current = prev.get(data.url);
          
          if (current) {
            updated.set(data.url, {
              ...current,
              status: 'complete',
              title: data.title,
              metrics: data.metrics,
              linkCount: data.linkCount,
              contentLength: data.contentLength,
              processingTime: data.processingTime
            });
          }
          
          return updated;
        });
      } catch (error) {
        console.error('Error handling url-complete event:', error);
      }
    });
    
    // Handle full page data
    eventSource.addEventListener('page-data', (event: SSEEvent) => {
      try {
        const data = JSON.parse(event.data);
        addLog(`Received full page data for: ${data.pageContent.url}`);
        // Full page data available here if needed
      } catch (error) {
        console.error('Error handling page-data event:', error);
      }
    });
    
    // Handle progress updates
    eventSource.addEventListener('progress', (event: SSEEvent) => {
      try {
        const data = JSON.parse(event.data);
        addLog(`Progress: ${Math.round(data.goalCompletion * 100)}% (${data.pagesScraped} pages, ${data.queueSize} in queue)`);
        
        setProgress({
          pagesScraped: data.pagesScraped,
          queueSize: data.queueSize,
          goalCompletion: data.goalCompletion
        });
      } catch (error) {
        console.error('Error handling progress event:', error);
      }
    });
    
    // Handle batch completion
    eventSource.addEventListener('batch-complete', (event: SSEEvent) => {
      try {
        const data = JSON.parse(event.data);
        addLog(`Batch complete: processed ${data.processedInBatch} URLs (total: ${data.extractedTotal})`);
      } catch (error) {
        console.error('Error handling batch-complete event:', error);
      }
    });
    
    // Handle final completion
    eventSource.addEventListener('scraping-complete', (event: SSEEvent) => {
      try {
        const data = JSON.parse(event.data);
        addLog(`Scraping completed: ${data.pagesScraped} pages, ${data.totalContentSize} bytes`);
        
        setIsRunning(false);
        
        // Close the connection
        eventSource.close();
        setIsConnected(false);
        
        // Call the completion callback if provided
        if (onComplete) {
          onComplete({
            pagesScraped: data.pagesScraped,
            totalContentSize: data.totalContentSize,
            executionTime: data.executionTime,
            goalCompletion: data.goalCompletion,
            coverageScore: data.coverageScore
          });
        }
      } catch (error) {
        console.error('Error handling scraping-complete event:', error);
      }
    });
    
    // Handle errors
    eventSource.addEventListener('error', (event: SSEEvent) => {
      try {
        const data = JSON.parse(event.data);
        setError(data.error || 'An error occurred during scraping');
        addLog(`Error: ${data.error}`);
      } catch (error) {
        console.error('Error handling error event:', error);
        setError('Connection error or invalid data received');
      }
    });
    
    // Handle EventSource errors
    eventSource.onerror = (event) => {
      console.error('EventSource error:', event);
      setError('Connection error - the event stream was disconnected');
      setIsConnected(false);
      eventSource.close();
    };
  };
  
  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Real-time Scraper Status</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <strong>Error:</strong> {error}
        </div>
      )}
      
      {!isRunning && (
        <div className="mb-6 p-4 border rounded">
          <h2 className="text-xl mb-2">Start New Scraping Job</h2>
          
          <div className="mb-3">
            <label className="block text-sm font-medium mb-1">Base URL</label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full p-2 border rounded"
            />
          </div>
          
          <div className="mb-3">
            <label className="block text-sm font-medium mb-1">Scraping Goal</label>
            <input
              type="text"
              value={scrapingGoal}
              onChange={(e) => setScrapingGoal(e.target.value)}
              placeholder="Extract product information"
              className="w-full p-2 border rounded"
            />
          </div>
          
          <div className="mb-3">
            <label className="block text-sm font-medium mb-1">Max Pages</label>
            <input
              type="number"
              value={maxPages}
              onChange={(e) => setMaxPages(parseInt(e.target.value) || 10)}
              min="1"
              max="50"
              className="w-full p-2 border rounded"
            />
          </div>
          
          <button
            onClick={startScraping}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            disabled={isRunning}
          >
            Start Scraping
          </button>
        </div>
      )}
      
      {isRunning && (
        <div className="mb-6">
          <div className="flex items-center mb-2">
            <h2 className="text-xl">Scraping Progress</h2>
            <div className="ml-3">
              <span className={`inline-block w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
              <span className="ml-1 text-sm">{isConnected ? 'Connected' : 'Disconnected'}</span>
            </div>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-4 mb-4">
            <div
              className="bg-blue-600 h-4 rounded-full"
              style={{ width: `${Math.round(progress.goalCompletion * 100)}%` }}
            ></div>
          </div>
          
          <div className="flex justify-between text-sm text-gray-600 mb-6">
            <div>Pages scraped: {progress.pagesScraped}</div>
            <div>Queue size: {progress.queueSize}</div>
            <div>Completion: {Math.round(progress.goalCompletion * 100)}%</div>
          </div>
        </div>
      )}
      
      <div className="mb-6">
        <h2 className="text-xl mb-2">Processed URLs ({processedUrls.size})</h2>
        <div className="border rounded overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">URL</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Content</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Links</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {Array.from(processedUrls.values()).map((url) => (
                <tr key={url.url}>
                  <td className="px-4 py-2 text-sm truncate max-w-xs" title={url.url}>
                    {url.url}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`inline-block rounded-full px-2 py-1 text-xs font-semibold
                      ${url.status === 'complete' ? 'bg-green-100 text-green-800' : 
                        url.status === 'error' ? 'bg-red-100 text-red-800' : 
                        'bg-blue-100 text-blue-800'}`}>
                      {url.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm truncate max-w-xs" title={url.title}>
                    {url.title || '-'}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    {url.contentLength ? `${Math.round(url.contentLength / 1024)}KB` : '-'}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    {url.linkCount || '-'}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    {url.processingTime ? `${url.processingTime}ms` : '-'}
                  </td>
                </tr>
              ))}
              {processedUrls.size === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-4 text-center text-sm text-gray-500">
                    No URLs processed yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="mb-6">
        <h2 className="text-xl mb-2">Logs</h2>
        <div className="border rounded bg-gray-100 p-4 h-64 overflow-y-auto font-mono text-xs">
          {logs.map((log, index) => (
            <div key={index} className="mb-1">{log}</div>
          ))}
          <div ref={logsEndRef} />
          {logs.length === 0 && (
            <div className="text-gray-500">No logs yet</div>
          )}
        </div>
      </div>
    </div>
  );
} 