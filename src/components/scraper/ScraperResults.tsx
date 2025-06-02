import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, ExternalLink, FileText } from 'lucide-react';
import { ScraperResultsType } from '@/lib/types/scraper';

interface ScraperResultsProps {
  results: ScraperResultsType | null;
}

export function ScraperResults({ results }: ScraperResultsProps) {
  if (!results) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Scraping Results</CardTitle>
          <CardDescription>
            No results available yet. Run a scraping operation to see results here.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[500px] text-muted-foreground">
          <div className="text-center">
            <FileText className="mx-auto h-12 w-12 opacity-20 mb-2" />
            <p>Results will appear here after scraping is complete</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const downloadResults = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(results, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "scraper-results.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>Scraping Results</CardTitle>
            <CardDescription>
              Extracted information from {results.summary.pagesScraped} pages
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={downloadResults}>
            <Download className="h-4 w-4 mr-2" />
            Download JSON
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="border rounded-lg p-4">
            <div className="text-sm text-muted-foreground mb-1">Pages Scraped</div>
            <div className="text-2xl font-bold">{results.summary.pagesScraped}</div>
          </div>
          <div className="border rounded-lg p-4">
            <div className="text-sm text-muted-foreground mb-1">Goal Completion</div>
            <div className="text-2xl font-bold">{(results.summary.goalCompletion * 100).toFixed(0)}%</div>
          </div>
          <div className="border rounded-lg p-4">
            <div className="text-sm text-muted-foreground mb-1">Execution Time</div>
            <div className="text-2xl font-bold">{results.summary.executionTime.toFixed(2)}s</div>
          </div>
        </div>

        <Tabs defaultValue="pages">
          <TabsList className="mb-4">
            <TabsTrigger value="pages">Pages ({results.pages.length})</TabsTrigger>
            <TabsTrigger value="entities">Entities</TabsTrigger>
          </TabsList>

          <TabsContent value="pages">
            <ScrollArea className="h-[400px]">
              <div className="space-y-4">
                {results.pages.map((page, index) => (
                  <Card key={index} className="overflow-hidden">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">{page.title}</CardTitle>
                          <CardDescription>
                            <a 
                              href={page.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center hover:underline"
                            >
                              {page.url.length > 50 ? `${page.url.substring(0, 50)}...` : page.url}
                              <ExternalLink className="h-3 w-3 ml-1" />
                            </a>
                          </CardDescription>
                        </div>
                        <div className="flex space-x-2">
                          <Badge variant="outline">
                            Relevance: {page.metrics.relevance.toFixed(2)}
                          </Badge>
                          <Badge variant="outline">
                            Density: {page.metrics.informationDensity.toFixed(2)}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-muted-foreground mb-2">
                        Extracted at {new Date(page.extractionTime).toLocaleString()}
                      </div>
                      <div className="border rounded-md p-3 bg-muted/50 text-sm max-h-24 overflow-y-auto">
                        {page.content.length > 300 
                          ? `${page.content.substring(0, 300)}...` 
                          : page.content}
                      </div>
                      
                      {page.links && page.links.length > 0 && (
                        <div className="mt-3">
                          <div className="text-sm font-medium mb-1">Links ({page.links.length})</div>
                          <div className="flex flex-wrap gap-2">
                            {page.links.slice(0, 5).map((link, i) => (
                              <Badge key={i} variant={link.visited ? "default" : "secondary"} className="text-xs">
                                {link.url.split('/').pop() || link.url}
                              </Badge>
                            ))}
                            {page.links.length > 5 && (
                              <Badge variant="outline" className="text-xs">
                                +{page.links.length - 5} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="entities">
            <ScrollArea className="h-[400px]">
              <div className="space-y-4">
                {results.pages.flatMap(page => page.entities || [])
                  .reduce((acc, entity) => {
                    const existing = acc.find(e => e.name === entity.name && e.type === entity.type);
                    if (existing) {
                      existing.mentions += entity.mentions;
                    } else {
                      acc.push({ ...entity });
                    }
                    return acc;
                  }, [] as Array<{ name: string; type: string; mentions: number }>)
                  .sort((a, b) => b.mentions - a.mentions)
                  .map((entity, index) => (
                    <div 
                      key={index} 
                      className="border rounded-lg p-3 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-medium">{entity.name}</div>
                        <div className="text-xs text-muted-foreground">Type: {entity.type}</div>
                      </div>
                      <Badge variant="secondary">
                        {entity.mentions} {entity.mentions === 1 ? 'mention' : 'mentions'}
                      </Badge>
                    </div>
                  ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
} 