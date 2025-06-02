'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { ScraperResults } from '@/components/scraper/ScraperResults';
import { ScraperEventsLog } from '@/components/scraper/ScraperEventsLog';
import { ScrapingConfig, ScraperEvent, ScraperResultsType } from '@/lib/types/scraper';
import { toast } from "sonner";

export default function ScraperPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('config');
  const [scrapingConfig, setScrapingConfig] = useState<ScrapingConfig>({
    baseUrl: '',
    scrapingGoal: '',
    maxPages: 20,
    maxDepth: 3,
    includeImages: false,
    filters: {
      mustIncludePatterns: '',
      excludePatterns: ''
    }
  });
  const [results, setResults] = useState<ScraperResultsType | null>(null);
  const [events, setEvents] = useState<ScraperEvent[]>([]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setScrapingConfig(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent as keyof ScrapingConfig] as Record<string, unknown>,
          [child]: value
        }
      }));
    } else if (type === 'checkbox' || type === 'switch') {
      setScrapingConfig(prev => ({
        ...prev,
        [name]: checked
      }));
    } else {
      setScrapingConfig(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSliderChange = (name: keyof ScrapingConfig, value: number[]) => {
    setScrapingConfig(prev => ({
      ...prev,
      [name]: value[0]
    }));
  };

  const startScraping = async () => {
    try {
      setIsLoading(true);
      setEvents([]);
      setResults(null);
      setActiveTab('logs');

      // Prepare the config object
      const config = {
        ...scrapingConfig,
        filters: {
          mustIncludePatterns: scrapingConfig.filters.mustIncludePatterns 
            ? scrapingConfig.filters.mustIncludePatterns.split(',').map(p => p.trim())
            : [],
          excludePatterns: scrapingConfig.filters.excludePatterns
            ? scrapingConfig.filters.excludePatterns.split(',').map(p => p.trim())
            : []
        }
      };

      // Make the API call
      const response = await fetch('/api/scraper/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error(`Failed to start scraping: ${response.statusText}`);
      }

      // Handle the streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is null');
      }
      
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const event = JSON.parse(line);
            setEvents(prev => [...prev, event]);
            
            if (event.type === 'end') {
              setResults(event.output);
              setActiveTab('results');
            }
          } catch (e) {
            console.error('Failed to parse event:', line, e);
          }
        }
      }

      toast.success('Scraping Complete', {
        description: 'Web scraping operation has finished successfully.'
      });

    } catch (error) {
      console.error('Scraping error:', error);
      toast.error('Scraping Failed', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-6">Web Scraper Agent</h1>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 mb-6">
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="logs">Event Log</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>
        
        <TabsContent value="config">
          <Card>
            <CardHeader>
              <CardTitle>Scraper Configuration</CardTitle>
              <CardDescription>
                Configure your web scraping operation with the parameters below.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="baseUrl">Target Website URL</Label>
                  <Input
                    id="baseUrl"
                    name="baseUrl"
                    placeholder="https://example.com"
                    value={scrapingConfig.baseUrl}
                    onChange={handleChange}
                    className="mt-1"
                  />
                </div>
                
                <div>
                  <Label htmlFor="scrapingGoal">Scraping Goal</Label>
                  <Textarea
                    id="scrapingGoal"
                    name="scrapingGoal"
                    placeholder="Describe what information you're looking to extract..."
                    value={scrapingConfig.scrapingGoal}
                    onChange={handleChange}
                    className="mt-1"
                    rows={3}
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="maxPages">Maximum Pages ({scrapingConfig.maxPages})</Label>
                    <Slider
                      id="maxPages"
                      min={1}
                      max={50}
                      step={1}
                      value={[scrapingConfig.maxPages]}
                      onValueChange={(value) => handleSliderChange('maxPages', value)}
                      className="mt-2"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="maxDepth">Maximum Depth ({scrapingConfig.maxDepth})</Label>
                    <Slider
                      id="maxDepth"
                      min={1}
                      max={10}
                      step={1}
                      value={[scrapingConfig.maxDepth]}
                      onValueChange={(value) => handleSliderChange('maxDepth', value)}
                      className="mt-2"
                    />
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id="includeImages"
                    name="includeImages"
                    checked={scrapingConfig.includeImages}
                    onCheckedChange={(checked) => 
                      setScrapingConfig(prev => ({ ...prev, includeImages: checked }))
                    }
                  />
                  <Label htmlFor="includeImages">Include Images</Label>
                </div>
                
                <div className="border rounded-lg p-4 space-y-4">
                  <h3 className="font-medium">URL Filters</h3>
                  
                  <div>
                    <Label htmlFor="mustIncludePatterns">Must Include Patterns</Label>
                    <Input
                      id="mustIncludePatterns"
                      name="filters.mustIncludePatterns"
                      placeholder="about,product,docs (comma separated)"
                      value={scrapingConfig.filters.mustIncludePatterns}
                      onChange={handleChange}
                      className="mt-1"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Only URLs containing these patterns will be scraped
                    </p>
                  </div>
                  
                  <div>
                    <Label htmlFor="excludePatterns">Exclude Patterns</Label>
                    <Input
                      id="excludePatterns"
                      name="filters.excludePatterns"
                      placeholder="login,signup,cart (comma separated)"
                      value={scrapingConfig.filters.excludePatterns}
                      onChange={handleChange}
                      className="mt-1"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      URLs containing these patterns will be skipped
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={startScraping} 
                disabled={isLoading || !scrapingConfig.baseUrl || !scrapingConfig.scrapingGoal}
                className="w-full"
              >
                {isLoading ? 'Scraping in progress...' : 'Start Scraping'}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="logs">
          <ScraperEventsLog events={events} isLoading={isLoading} />
        </TabsContent>
        
        <TabsContent value="results">
          <ScraperResults results={results} />
        </TabsContent>
      </Tabs>
    </div>
  );
} 