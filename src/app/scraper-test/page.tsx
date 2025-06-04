'use client';

import { useState, useEffect, useRef } from 'react';

// Interface for SSE events
interface SSEEvent extends MessageEvent {
  data: string;
}

// Interface for page metadata
interface PageMetadata {
  url: string;
  title: string;
  contentLength: number;
  linkCount: number;
  pageNumber: number;
  timestamp: number;
  processingTime?: number;
}

// Interface for final stats
interface ScrapingStats {
  pagesScraped: number;
  totalContentSize: number;
  executionTime: number;
  totalTimeMs?: number;
  pagesPerSecond?: string;
  goalCompletion: number;
  coverageScore: number;
}

export default function ScraperTestPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [baseUrl, setBaseUrl] = useState('https://xotiv.com');
  const [scrapingGoal, setScrapingGoal] = useState('Extract company information');
  const [totalPages, setTotalPages] = useState(0);
  const [queueSize, setQueueSize] = useState(0);
  const [progress, setProgress] = useState(0);
  const [scrapedPages, setScrapedPages] = useState<PageMetadata[]>([]);
  const [selectedPage, setSelectedPage] = useState<PageMetadata | null>(null);
  const [finalStats, setFinalStats] = useState<ScrapingStats | null>(null);
  const [liveEvents, setLiveEvents] = useState<string[]>([]);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const liveEventsRef = useRef<HTMLDivElement>(null);
  
  // Scroll to bottom of logs and live events whenever they update
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);
  
  useEffect(() => {
    if (liveEventsRef.current) {
      liveEventsRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [liveEvents]);
  
  // Connect to event stream on component mount
  useEffect(() => {
    console.log('Component mounted, connecting to event stream');
    // Initial connection is established when user clicks start
    
    // Clean up on unmount
    return () => {
      if (eventSourceRef.current) {
        console.log('Cleaning up event source connection');
        eventSourceRef.current.close();
      }
    };
  }, []);
  
  const addLog = (message: string) => {
    setLogs(prevLogs => [...prevLogs, `${new Date().toISOString().slice(11, 19)} - ${message}`]);
  };
  
  const addLiveEvent = (message: string) => {
    setLiveEvents(prev => {
      // Keep only last 10 events
      const newEvents = [...prev, `${new Date().toISOString().slice(11, 19)} - ${message}`];
      if (newEvents.length > 10) {
        return newEvents.slice(newEvents.length - 10);
      }
      return newEvents;
    });
  };
  
  const startScraping = async () => {
    // Reset logs and counters
    setLogs([]);
    setLiveEvents([]);
    setTotalPages(0);
    setQueueSize(0);
    setProgress(0);
    setScrapedPages([]);
    setSelectedPage(null);
    setFinalStats(null);
    
    // Close any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setIsRunning(true);
    addLog(`Starting scraping for ${baseUrl}`);
    
    try {
      // Set up the EventSource directly to the API endpoint
      const eventSource = new EventSource(`/api/scraper/non-recursive?baseUrl=${encodeURIComponent(baseUrl)}&scrapingGoal=${encodeURIComponent(scrapingGoal)}`);
      eventSourceRef.current = eventSource;
      
      // Connection opened
      eventSource.onopen = () => {
        setIsConnected(true);
        addLog('Event stream connection established');
        addLiveEvent('Connected to event stream');
      };
      
      // Connection error
      eventSource.onerror = (error) => {
        console.error('EventSource error:', error);
        addLog('Event stream connection error');
        addLiveEvent('Connection error');
        setIsConnected(false);
        setIsRunning(false);
        eventSource.close();
      };
      
      // Initial connection event
      eventSource.addEventListener('connection', (event: SSEEvent) => {
        try {
          const data = JSON.parse(event.data);
          addLog(`Connected: ${data.message}`);
        } catch (error) {
          console.error('Error parsing connection event:', error);
        }
      });
      
      // Generic scraper events
      eventSource.addEventListener('scraper-event', (event: SSEEvent) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Received scraper event:', data);
          
          // Handle workflow status events
          if (data.type === 'workflow-status') {
            // Update progress information
            const progress = data.progress || 0;
            setProgress(progress);
            
            // Add a log message for significant steps
            if (data.step) {
              addLiveEvent(`🔄 Workflow: ${data.step} - ${data.message || ''}`);
            }
          }
          
          // Handle URL processing events
          if (data.type === 'analyze-url') {
            addLiveEvent(`🔍 Analyzing: ${data.url}`);
          }
          
          // Handle fetch events
          if (data.type === 'fetch-start') {
            addLiveEvent(`📥 Fetching: ${data.url}`);
          }
          
          if (data.type === 'fetch-complete') {
            const size = data.contentLength ? `(${Math.round(data.contentLength / 1024)} KB)` : '';
            addLiveEvent(`📦 Fetched: ${data.url} ${size}`);
          }
          
          // Handle content extraction events
          if (data.type === 'extract-content') {
            addLiveEvent(`📄 Extracting: ${data.url}`);
          }
          
          // Handle link discovery events
          if (data.type === 'discover-links') {
            addLiveEvent(`🔗 Found ${data.linkCount} links: ${data.url}`);
          }
          
          // Handle page events directly
          if (data.type === 'page' && data.data) {
            console.log('📄 Page event received:', data);
            
            // Create page metadata
            const pageMetadata: PageMetadata = {
              url: data.data.url,
              title: data.data.title || data.data.url.split('/').pop() || 'No title',
              contentLength: data.data.content.length,
              linkCount: data.data.links.length,
              pageNumber: scrapedPages.length + 1,
              timestamp: data.timestamp || Date.now()
            };
            
            // Update UI state
            setScrapedPages(prev => [...prev, pageMetadata]);
            setTotalPages(prev => prev + 1);
            
            // Log the event
            addLiveEvent(`✅ New page: ${pageMetadata.title} (${Math.round(pageMetadata.contentLength / 1024)} KB)`);
            addLog(`Scraped page: ${pageMetadata.url}`);
          }
          
          // Only log certain important events to prevent log flooding
          if (['init', 'start', 'end', 'error'].includes(data.type)) {
            addLog(`Event: ${data.type} ${data.url || ''}`);
            addLiveEvent(`Event: ${data.type} ${data.url || ''}`);
          }
          
          // End of scraping
          if (data.type === 'end') {
            if (data.output) {
              console.log('🏁 Scraping output:', data.output);
              
              // Update final stats
              const stats: ScrapingStats = {
                pagesScraped: data.output.pages?.length || 0,
                totalContentSize: data.output.summary?.totalContentSize || 0,
                executionTime: data.output.summary?.executionTime || 0,
                totalTimeMs: data.output.summary?.executionTime,
                pagesPerSecond: data.output.summary?.executionTime > 0 
                  ? ((data.output.pages?.length || 0) / (data.output.summary.executionTime / 1000)).toFixed(2)
                  : '0',
                goalCompletion: data.output.summary?.goalCompletion || 0,
                coverageScore: data.output.summary?.coverageScore || 0
              };
              
              setFinalStats(stats);
              addLog(`Final stats: ${stats.pagesScraped} pages in ${(stats.executionTime / 1000).toFixed(1)}s`);
            }
            
            setIsRunning(false);
            eventSource.close();
            setIsConnected(false);
            addLog('Scraping completed');
          }
        } catch (error) {
          console.error('Error parsing event data:', error);
        }
      });
      
      // URL completion events
      eventSource.addEventListener('url-complete', (event: SSEEvent) => {
        try {
          const data = JSON.parse(event.data);
          
          // Enhanced logging for debugging
          console.log('🔍 URL COMPLETE EVENT:', data);
          
          // Store the page metadata
          const pageMetadata: PageMetadata = {
            url: data.url,
            title: data.title,
            contentLength: data.contentLength,
            linkCount: data.linkCount,
            pageNumber: data.pageNumber,
            timestamp: data.timestamp
          };
          
          setScrapedPages(prev => [...prev, pageMetadata]);
          setTotalPages(data.pageNumber);
          
          addLiveEvent(`✅ Complete #${data.pageNumber}: ${data.url.split('/').pop() || data.url}`);
          addLog(`Completed processing: ${data.url} (Title: ${data.title.substring(0, 30)}${data.title.length > 30 ? '...' : ''})`);
        } catch (error) {
          console.error('Error parsing url-complete event:', error);
        }
      });
      
      // Progress updates
      eventSource.addEventListener('progress', (event: SSEEvent) => {
        try {
          const data = JSON.parse(event.data);
          setTotalPages(data.pagesScraped);
          setQueueSize(data.queueSize);
          setProgress(data.goalCompletion);
          
          // Log progress at 25% intervals
          const progressPercentage = Math.round(data.goalCompletion * 100);
          if (progressPercentage % 25 === 0 || progressPercentage === 100) {
            addLog(`Progress: ${progressPercentage}% complete (${data.pagesScraped} pages, ${data.queueSize} in queue)`);
          }
        } catch (error) {
          console.error('Error parsing progress event:', error);
        }
      });
      
      // Scraping completion event
      eventSource.addEventListener('scraping-complete', (event: SSEEvent) => {
        try {
          const data = JSON.parse(event.data);
          
          // Enhanced logging for debugging
          console.log('🏁 SCRAPING COMPLETE EVENT:', data);
          
          // Log the completion message
          addLog(`Scraping completed: ${data.pagesScraped} pages scraped`);
          addLiveEvent(`🏁 ${data.message || 'Scraping finished'}`);
          
          // Add final statistics if available
          if (data.pagesScraped !== undefined) {
            const stats: ScrapingStats = {
              pagesScraped: data.pagesScraped || 0,
              totalContentSize: data.totalContentSize || 0,
              executionTime: data.executionTime || 0,
              totalTimeMs: data.totalTimeMs,
              pagesPerSecond: data.pagesScraped > 0 && data.executionTime > 0 
                ? (data.pagesScraped / (data.executionTime / 1000)).toFixed(2)
                : '0',
              goalCompletion: data.goalCompletion || 0,
              coverageScore: data.coverageScore || 0
            };
            
            setFinalStats(stats);
            addLog(`Stats: ${stats.pagesScraped} pages in ${(stats.executionTime / 1000).toFixed(1)}s (${stats.pagesPerSecond} pages/sec)`);
          }
          
          setIsRunning(false);
          eventSource.close();
          setIsConnected(false);
        } catch (error) {
          console.error('Error parsing scraping-complete event:', error);
        }
      });
      
      // Error events
      eventSource.addEventListener('error', (event: SSEEvent) => {
        try {
          const data = JSON.parse(event.data);
          addLog(`Error: ${data.error}`);
          addLiveEvent(`❌ Error: ${data.error}`);
        } catch (error) {
          console.error('Error parsing error event:', error);
        }
      });
      
    } catch (error) {
      addLog(`Error: ${error instanceof Error ? error.message : String(error)}`);
      setIsRunning(false);
      setIsConnected(false);
    }
  };

  // Handle page selection
  const handlePageSelect = (page: PageMetadata) => {
    setSelectedPage(prev => prev?.pageNumber === page.pageNumber ? null : page);
  };
  
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Scraper Event Stream Test</h1>
      
      <div className="mb-4 p-4 border rounded">
        <div className="mb-4">
          <label className="block mb-2">Base URL:</label>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            className="w-full p-2 border rounded"
            disabled={isRunning}
          />
        </div>
        
        <div className="mb-4">
          <label className="block mb-2">Scraping Goal:</label>
          <input
            type="text"
            value={scrapingGoal}
            onChange={(e) => setScrapingGoal(e.target.value)}
            className="w-full p-2 border rounded"
            disabled={isRunning}
          />
        </div>
        
        <button
          onClick={startScraping}
          disabled={isRunning}
          className={`px-4 py-2 rounded ${isRunning ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'} text-white`}
        >
          {isRunning ? 'Scraping in progress...' : 'Start Scraping'}
        </button>
        
        <div className="mt-2">
          Connection status:
          <span className={`ml-2 inline-block w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
          <span className="ml-1">{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>
      
      {/* Live Events Feed */}
      {isRunning && (
        <div className="mb-6 bg-gray-50 border border-gray-200 rounded p-4">
          <h3 className="text-lg font-semibold mb-2">Live Events</h3>
          <div className="h-32 overflow-y-auto bg-gray-100 p-2 font-mono text-xs">
            {liveEvents.map((event, index) => (
              <div key={index} className="mb-1">{event}</div>
            ))}
            <div ref={liveEventsRef} />
            {liveEvents.length === 0 && (
              <div className="text-gray-500">Waiting for events...</div>
            )}
          </div>
        </div>
      )}
      
      {/* Pages Counter */}
      <div className="mb-6 bg-blue-50 border border-blue-200 rounded p-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-4xl font-bold text-blue-700">{totalPages}</div>
            <div className="text-sm text-blue-600">Pages Scraped</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-blue-700">{queueSize}</div>
            <div className="text-sm text-blue-600">Queue Size</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-blue-700">{Math.round(progress * 100)}%</div>
            <div className="text-sm text-blue-600">Progress</div>
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="mt-4 w-full bg-gray-200 rounded-full h-4">
          <div 
            className="bg-blue-600 h-4 rounded-full transition-all duration-300" 
            style={{ width: `${Math.max(2, Math.round(progress * 100))}%` }}
          ></div>
        </div>
      </div>
      
      {/* Final Stats */}
      {finalStats && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded p-4">
          <h3 className="text-lg font-semibold mb-2 text-green-800">Final Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-600">Pages Scraped</div>
              <div className="text-xl font-bold text-green-700">{finalStats.pagesScraped}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Content Size</div>
              <div className="text-xl font-bold text-green-700">{(finalStats.totalContentSize / 1024).toFixed(1)} KB</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Execution Time</div>
              <div className="text-xl font-bold text-green-700">{(finalStats.executionTime / 1000).toFixed(1)}s</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Pages/Second</div>
              <div className="text-xl font-bold text-green-700">{finalStats.pagesPerSecond || '0'}</div>
            </div>
          </div>
        </div>
      )}
      
      {/* Scraped Pages Table */}
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-2">Scraped Pages ({scrapedPages.length})</h2>
        <div className="border rounded overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">URL</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Content</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Links</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {scrapedPages.map((page) => (
                <tr 
                  key={page.pageNumber} 
                  className={`${selectedPage?.pageNumber === page.pageNumber ? 'bg-blue-50' : ''} hover:bg-gray-50 cursor-pointer`}
                  onClick={() => handlePageSelect(page)}
                >
                  <td className="px-4 py-2 text-sm">{page.pageNumber}</td>
                  <td className="px-4 py-2 text-sm truncate max-w-xs" title={page.url}>
                    {page.url}
                  </td>
                  <td className="px-4 py-2 text-sm truncate max-w-xs" title={page.title}>
                    {page.title || 'No title'}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    {page.contentLength ? `${Math.round(page.contentLength / 1024)} KB` : '-'}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    {page.linkCount || 0}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    {page.processingTime ? `${page.processingTime} ms` : '-'}
                  </td>
                </tr>
              ))}
              {scrapedPages.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-4 text-center text-sm text-gray-500">
                    No pages scraped yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Page Details Panel */}
      {selectedPage && (
        <div className="mb-6 border rounded p-4 bg-blue-50">
          <h3 className="text-lg font-semibold mb-2">Page Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="mb-1"><span className="font-medium">Page #:</span> {selectedPage.pageNumber}</p>
              <p className="mb-1"><span className="font-medium">URL:</span> {selectedPage.url}</p>
              <p className="mb-1"><span className="font-medium">Title:</span> {selectedPage.title}</p>
              <p className="mb-1"><span className="font-medium">Content Size:</span> {Math.round(selectedPage.contentLength / 1024)} KB</p>
            </div>
            <div>
              <p className="mb-1"><span className="font-medium">Links Found:</span> {selectedPage.linkCount}</p>
              <p className="mb-1"><span className="font-medium">Processing Time:</span> {selectedPage.processingTime || 'N/A'} ms</p>
              <p className="mb-1"><span className="font-medium">Timestamp:</span> {new Date(selectedPage.timestamp).toLocaleTimeString()}</p>
            </div>
          </div>
        </div>
      )}
      
      <div className="mb-4">
        <h2 className="text-xl font-bold mb-2">Event Logs</h2>
        <div className="border rounded bg-gray-100 p-4 h-96 overflow-y-auto font-mono text-sm">
          {logs.map((log, index) => (
            <div key={index} className="mb-1">{log}</div>
          ))}
          <div ref={logsEndRef} />
          {logs.length === 0 && (
            <div className="text-gray-500">No logs yet. Start scraping to see events.</div>
          )}
        </div>
      </div>
    </div>
  );
} 