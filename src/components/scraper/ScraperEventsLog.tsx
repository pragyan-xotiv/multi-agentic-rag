import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { EventTypes, ScraperEvent } from '@/lib/types/scraper';

interface ScraperEventsLogProps {
  events: ScraperEvent[];
  isLoading: boolean;
}

export function ScraperEventsLog({ events, isLoading }: ScraperEventsLogProps) {
  const getEventColor = (type: EventTypes) => {
    switch (type) {
      case 'start':
        return 'bg-blue-100 text-blue-800';
      case 'page':
        return 'bg-green-100 text-green-800';
      case 'auth':
        return 'bg-purple-100 text-purple-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      case 'end':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatTime = () => {
    const now = new Date();
    return now.toLocaleTimeString();
  };

  const renderEventContent = (event: ScraperEvent) => {
    switch (event.type) {
      case 'start':
        return (
          <div>
            <p>Starting scraping operation for URL: <span className="font-semibold">{event.url}</span></p>
            <p className="mt-1 text-sm">Goal: {event.goal}</p>
          </div>
        );

      case 'page':
        return (
          <div>
            <p>Processed page: <span className="font-semibold">{event.data.url}</span></p>
            <p className="mt-1 text-sm">Title: {event.data.title}</p>
            <p className="mt-1 text-sm">
              Metrics: 
              <span className="ml-1">Relevance: {event.data.metrics.relevance.toFixed(2)}</span>, 
              <span className="ml-1">Density: {event.data.metrics.informationDensity.toFixed(2)}</span>
            </p>
            {event.data.links && (
              <p className="mt-1 text-sm">Found {event.data.links.length} links</p>
            )}
          </div>
        );

      case 'auth':
        return (
          <div>
            <p>Authentication required at: <span className="font-semibold">{event.request.url}</span></p>
            <p className="mt-1 text-sm">Type: {event.request.authType}</p>
            {event.request.formFields && (
              <p className="mt-1 text-sm">Form fields: {event.request.formFields.join(', ')}</p>
            )}
          </div>
        );

      case 'error':
        return (
          <div>
            <p className="text-red-600">Error occurred: {event.error}</p>
          </div>
        );

      case 'end':
        return (
          <div>
            <p>Scraping completed</p>
            <p className="mt-1 text-sm">Pages scraped: {event.output.summary.pagesScraped}</p>
            <p className="mt-1 text-sm">
              Goal completion: {(event.output.summary.goalCompletion * 100).toFixed(0)}%
            </p>
            <p className="mt-1 text-sm">
              Execution time: {event.output.summary.executionTime.toFixed(2)}s
            </p>
          </div>
        );

      default:
        // This should never happen if we've handled all the types properly
        return <p>Unknown event type</p>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Event Log</span>
          {isLoading && (
            <div className="flex items-center">
              <Spinner className="h-4 w-4 mr-2" />
              <span className="text-sm">Scraping in progress...</span>
            </div>
          )}
        </CardTitle>
        <CardDescription>
          Real-time events from the scraping operation
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px] rounded-md border p-4">
          {events.length === 0 && !isLoading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No events to display. Start a scraping operation to see events.
            </div>
          ) : (
            <div className="space-y-4">
              {events.map((event, index) => (
                <div key={index} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <Badge className={getEventColor(event.type)}>
                      {event.type.toUpperCase()}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{formatTime()}</span>
                  </div>
                  {renderEventContent(event)}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
} 