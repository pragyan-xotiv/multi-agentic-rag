import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { EventTypes, ScraperEvent } from '@/lib/types/scraper';
import { Progress } from '@/components/ui/progress';

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
      case 'warning':
        return 'bg-amber-100 text-amber-800';
      case 'end':
        return 'bg-green-100 text-green-800 font-semibold';
      case 'processing':
        return 'bg-amber-100 text-amber-800';
      case 'processing-complete':
        return 'bg-indigo-100 text-indigo-800';
      case 'complete':
        return 'bg-green-200 text-green-900 font-semibold';
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
            <p className="font-semibold">{event.friendly_title || 'Starting scraping operation'}</p>
            <p className="text-sm">{event.friendly_message || `Scraping URL: ${event.url}`}</p>
            <p className="mt-1 text-sm">Goal: {event.goal}</p>
          </div>
        );

      case 'page':
        return (
          <div>
            <p className="font-semibold">{event.data.title || 'Processed page'}</p>
            <p className="text-sm">{event.data.status || `URL: ${event.data.url}`}</p>
            
            {event.data.progress && (
              <div className="mt-2">
                <Progress value={event.data.progress} className="h-2" />
                <p className="text-xs text-right mt-1">{event.data.progress}% complete</p>
              </div>
            )}

            {event.data.metrics && (
              <p className="mt-1 text-xs text-muted-foreground">
                {event.data.metrics.relevance > 0 && (
                  <span className="ml-1">Relevance: {event.data.metrics.relevance.toFixed(2)}</span>
                )}
                {event.data.metrics.informationDensity > 0 && (
                  <span className="ml-1">Density: {event.data.metrics.informationDensity.toFixed(2)}</span>
                )}
              </p>
            )}
            
            {event.data.links && event.data.links.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">Found {event.data.links.length} links</p>
            )}
          </div>
        );
        
      case 'processing':
        return (
          <div>
            <p className="font-semibold">{event.data.title}</p>
            <p className="text-sm">{event.data.status}</p>
            
            {event.data.progress && (
              <div className="mt-2">
                <Progress value={event.data.progress} className="h-2" />
                <p className="text-xs text-right mt-1">{event.data.progress}% complete</p>
              </div>
            )}
          </div>
        );
        
      case 'processing-complete':
        return (
          <div>
            <p className="font-semibold">{event.data.title}</p>
            <p className="text-sm">{event.data.details}</p>
            <div className="mt-2 flex space-x-2">
              <Badge variant="secondary">{event.data.entities} entities</Badge>
              <Badge variant="secondary">{event.data.relationships} relationships</Badge>
            </div>
          </div>
        );

      case 'auth':
        return (
          <div>
            <p className="font-semibold">Authentication required</p>
            <p className="text-sm">URL: {event.request.url}</p>
            <p className="mt-1 text-xs">Type: {event.request.authType}</p>
            {event.request.formFields && (
              <p className="mt-1 text-xs">Form fields: {event.request.formFields.join(', ')}</p>
            )}
          </div>
        );

      case 'error':
        return (
          <div>
            <p className="font-semibold text-red-600">{event.friendly_title || 'Error occurred'}</p>
            <p className="text-sm text-red-500">{event.friendly_message || event.error}</p>
          </div>
        );

      case 'warning':
        return (
          <div>
            <p className="font-semibold text-amber-600">{event.friendly_title || 'Warning'}</p>
            <p className="text-sm text-amber-600">{event.friendly_message || event.message}</p>
            <p className="text-xs text-gray-500 mt-1">The operation will continue despite this warning.</p>
          </div>
        );

      case 'end':
        return (
          <div>
            <p className="font-semibold">{event.friendly_title || 'Scraping completed'}</p>
            <p className="text-sm">{event.friendly_message || 'Web scraping operation has completed successfully'}</p>
            
            {event.output.summary && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="bg-green-50 p-2 rounded text-center">
                  <span className="text-xs block">Pages scraped</span>
                  <span className="font-semibold">{event.output.summary.pagesScraped}</span>
                </div>
                <div className="bg-blue-50 p-2 rounded text-center">
                  <span className="text-xs block">Completion</span>
                  <span className="font-semibold">{(event.output.summary.goalCompletion * 100).toFixed(0)}%</span>
                </div>
              </div>
            )}
            
            {event.timing && (
              <p className="mt-2 text-xs text-right text-muted-foreground">
                Total time: {event.timing.formatted}
              </p>
            )}
          </div>
        );
        
      case 'complete':
        return (
          <div>
            <p className="font-semibold">{event.friendly_title}</p>
            <p className="text-sm">{event.friendly_message}</p>
            
            {event.timing && (
              <p className="mt-2 text-xs text-right text-muted-foreground">
                Total time: {event.timing.formatted}
              </p>
            )}
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
              <span className="text-sm">Operation in progress...</span>
            </div>
          )}
        </CardTitle>
        <CardDescription>
          Real-time events from the scraping and processing operation
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
                <div key={index} className="border rounded-lg p-3 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <Badge className={getEventColor(event.type)}>
                      {event.type.toUpperCase().replace('-', ' ')}
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