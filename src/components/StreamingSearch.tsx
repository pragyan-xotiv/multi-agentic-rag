'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';

interface SearchResult {
  content: string;
  metadata: Record<string, unknown>;
  relevanceScore: number;
  source: string;
}

interface StreamEvent {
  type: string;
  data?: SearchResult;
  query?: string;
  content?: string;
  evaluation?: {
    relevanceScore: number;
    coverageScore: number;
    confidenceScore: number;
    feedback: string;
  };
  error?: string;
}

export function StreamingSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [status, setStatus] = useState('');
  const eventSourceRef = useRef<EventSource | null>(null);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);
  
  const handleSearch = async () => {
    if (!query.trim()) return;
    
    // Clear previous results
    setResults([]);
    setFeedback('');
    setStatus('Analyzing query...');
    setLoading(true);
    
    // Close any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    
    try {
      // Create a request to start the search but don't await the response
      await fetch('/api/retrieve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query,
          options: { streamDelay: 100 } // Add a small delay between chunks
        })
      });
      
      // Create EventSource to receive streaming updates
      const evtSource = new EventSource('/api/retrieve/stream');
      eventSourceRef.current = evtSource;
      
      evtSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as StreamEvent;
          
          switch (data.type) {
            case 'start':
              setStatus('Searching...');
              break;
              
            case 'chunk':
              if (data.data) {
                setResults(prev => [...prev, data.data as SearchResult]);
                setStatus('Receiving results...');
              }
              break;
              
            case 'end':
              if (data.evaluation) {
                setFeedback(data.evaluation.feedback);
              }
              if (data.content) {
                setStatus(data.content);
              } else {
                setStatus('Search complete');
              }
              setLoading(false);
              evtSource.close();
              break;
              
            case 'error':
              toast.error(data.error || 'An error occurred during search');
              setStatus('Search failed');
              setLoading(false);
              evtSource.close();
              break;
          }
        } catch (err) {
          console.error('Failed to parse event data', err);
        }
      };
      
      evtSource.onerror = () => {
        toast.error('Connection to server lost');
        setStatus('Connection lost');
        setLoading(false);
        evtSource.close();
      };
      
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Failed to initiate search');
      setStatus('Search failed');
      setLoading(false);
    }
  };
  
  return (
    <div className="w-full">
      <div className="flex gap-2 mb-4">
        <Input 
          type="text" 
          value={query} 
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1"
          placeholder="Enter your search query..."
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          disabled={loading}
        />
        <Button 
          onClick={handleSearch}
          disabled={loading}
        >
          Search
        </Button>
      </div>
      
      {status && (
        <div className="mb-4 text-sm p-2 bg-muted rounded-md">
          {loading && <span className="inline-block w-2 h-2 bg-primary rounded-full mr-2 animate-pulse"></span>}
          {status}
        </div>
      )}
      
      {feedback && (
        <div className="mb-4 text-sm text-muted-foreground">
          {feedback}
        </div>
      )}
      
      <div className="space-y-4">
        {results.map((result, index) => (
          <Card key={index} className="p-4 transition-opacity duration-300" style={{ opacity: 1 }}>
            <div className="text-sm text-gray-600">{result.content}</div>
            <div className="flex justify-between items-center mt-2">
              <div className="text-xs text-gray-400">
                Source: {result.source}
              </div>
              <div className="text-xs text-gray-400">
                Relevance: {(result.relevanceScore * 100).toFixed(0)}%
              </div>
            </div>
          </Card>
        ))}
        
        {results.length === 0 && !loading && !status && (
          <div className="text-center text-gray-500 py-8">
            Enter a query to search the knowledge base
          </div>
        )}
      </div>
    </div>
  );
} 