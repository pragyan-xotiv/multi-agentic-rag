"use client";

import { useState, useRef, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { ScraperResults } from "@/components/scraper/ScraperResults";
import { ScraperEventsLog } from "@/components/scraper/ScraperEventsLog";
import {
  ScrapingConfig,
  ScraperEvent,
  ScraperResultsType,
} from "@/lib/types/scraper";
import { toast } from "sonner";
import StreamingToggle from "@/app/components/StreamingToggle";

// Interface for SSE events
interface SSEEvent extends MessageEvent {
  data: string;
}

export default function ScraperPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [activeTab, setActiveTab] = useState("config");
  const [scrapingConfig, setScrapingConfig] = useState<ScrapingConfig>({
    baseUrl: "",
    scrapingGoal: "",
    maxPages: 20,
    maxDepth: 3,
    includeImages: false,
    executeJavaScript: true,
    filters: {
      mustIncludePatterns: "",
      excludePatterns: "",
    },
  });
  const [results, setResults] = useState<ScraperResultsType | null>(null);
  const [events, setEvents] = useState<ScraperEvent[]>([]);
  const [useJavaScript, setUseJavaScript] = useState(true);
  const [isStreaming, setIsStreaming] = useState(true);
  
  const eventSourceRef = useRef<EventSource | null>(null);

  // Clean up event source on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        console.log('Cleaning up event source connection');
        eventSourceRef.current.close();
      }
    };
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    if (name.includes(".")) {
      const [parent, child] = name.split(".");
      setScrapingConfig((prev) => ({
        ...prev,
        [parent]: {
          ...(prev[parent as keyof ScrapingConfig] as Record<string, unknown>),
          [child]: value,
        },
      }));
    } else if (type === "checkbox" || type === "switch") {
      setScrapingConfig((prev) => ({
        ...prev,
        [name]: checked,
      }));
    } else {
      setScrapingConfig((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleSliderChange = (name: keyof ScrapingConfig, value: number[]) => {
    setScrapingConfig((prev) => ({
      ...prev,
      [name]: value[0],
    }));
  };

  const startScraping = async () => {
    try {
      setIsLoading(true);
      setEvents([]);
      setResults(null);
      setActiveTab("logs");

      console.log(
        "🚀 [Scraper UI] Starting scraping for:",
        scrapingConfig.baseUrl,
      );

      // Format filters if present
      const mustIncludePatterns = scrapingConfig.filters.mustIncludePatterns
        ? scrapingConfig.filters.mustIncludePatterns
            .split(",")
            .map((p) => p.trim())
        : [];
      
      const excludePatterns = scrapingConfig.filters.excludePatterns
        ? scrapingConfig.filters.excludePatterns
            .split(",")
            .map((p) => p.trim())
        : [];
      
      // Close any existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
        setIsConnected(false);
      }

      if (isStreaming) {
        // Build query string for EventSource with GET parameters
        const queryParams = new URLSearchParams();
        queryParams.append('baseUrl', scrapingConfig.baseUrl);
        queryParams.append('scrapingGoal', scrapingConfig.scrapingGoal);
        
        // The API expects these as query params for GET requests
        const apiUrl = `/api/scraper/non-recursive?${queryParams.toString()}`;
        console.log("📡 [Scraper UI] Setting up EventSource with URL:", apiUrl);
        
        try {
          // Set up EventSource for SSE (always uses GET)
          const eventSource = new EventSource(apiUrl);
          eventSourceRef.current = eventSource;
          
          // Add initial status event
          setEvents(prev => [...prev, {
            type: "processing",
            data: {
              title: "Connecting to scraper service",
              status: "Establishing connection...",
              progress: 0
            }
          }]);
          
          // Connection opened
          eventSource.onopen = () => {
            console.log("✅ [Scraper UI] EventSource connection established");
            setIsConnected(true);
            setEvents(prev => [...prev, {
              type: "start",
              url: scrapingConfig.baseUrl,
              goal: scrapingConfig.scrapingGoal,
              friendly_title: "Starting scrape operation",
              friendly_message: `Beginning to scrape ${scrapingConfig.baseUrl}`
            }]);
          };
          
          // Connection error
          eventSource.onerror = (error) => {
            console.error("❌ [Scraper UI] EventSource error:", error);
            setEvents(prev => [...prev, {
              type: "error",
              error: "Connection error with the scraper service",
              friendly_title: "Connection error",
              friendly_message: "Lost connection to the scraper service"
            }]);
            setIsConnected(false);
            setIsLoading(false);
            eventSource.close();
          };
          
          // Initial connection event
          eventSource.addEventListener('connection', (event: SSEEvent) => {
            try {
              const data = JSON.parse(event.data);
              console.log("🔌 [Scraper UI] Connection event:", data);
              setEvents(prev => [...prev, {
                type: "processing",
                data: {
                  title: "Connection established",
                  status: data.message || "Connected to scraper service",
                  progress: 5
                }
              }]);
            } catch (error) {
              console.error("Error parsing connection event:", error);
            }
          });
          
          // Generic scraper events
          eventSource.addEventListener('scraper-event', (event: SSEEvent) => {
            try {
              const data = JSON.parse(event.data);
              console.log("📥 [Scraper UI] Received scraper event:", data.type);
              
              // Handle workflow status events
              if (data.type === "workflow-status") {
                setEvents(prev => [...prev, {
                  type: "processing",
                  data: {
                    title: `Workflow step: ${data.step}`,
                    status: data.message || "Processing workflow step",
                    progress: Math.round((data.progress || 0) * 100)
                  }
                }]);
              }
              
              // Handle URL processing events
              if (data.type === "analyze-url") {
                setEvents(prev => [...prev, {
                  type: "processing",
                  data: {
                    title: "Analyzing URL",
                    status: `Evaluating ${data.url} (depth: ${data.depth})`,
                    progress: 10
                  }
                }]);
              }
              
              // Handle fetch events
              if (data.type === "fetch-start") {
                setEvents(prev => [...prev, {
                  type: "processing",
                  data: {
                    title: "Fetching page",
                    status: `Loading ${data.url} (JavaScript: ${data.useJavaScript ? 'enabled' : 'disabled'})`,
                    progress: 20
                  }
                }]);
              }
              
              if (data.type === "fetch-complete") {
                setEvents(prev => [...prev, {
                  type: "processing",
                  data: {
                    title: "Page loaded",
                    status: `Loaded ${data.url} (status: ${data.statusCode}, size: ${(data.contentLength / 1024).toFixed(1)} KB)`,
                    progress: 30
                  }
                }]);
              }
              
              // Handle content extraction events
              if (data.type === "extract-content") {
                setEvents(prev => [...prev, {
                  type: "processing",
                  data: {
                    title: "Extracting content",
                    status: `Processing ${data.url} (type: ${data.contentType})`,
                    progress: 40
                  }
                }]);
              }
              
              // Handle link discovery events
              if (data.type === "discover-links") {
                setEvents(prev => [...prev, {
                  type: "processing",
                  data: {
                    title: "Discovering links",
                    status: `Found ${data.linkCount} links on ${data.url}`,
                    progress: 50
                  }
                }]);
              }
              
              // Handle page events directly
              if (data.type === "page" && data.data) {
                setEvents(prev => [...prev, {
                  type: "page",
                  data: {
                    url: data.data.url,
                    title: data.data.title || 'Processed page',
                    metrics: {
                      relevance: data.data.metrics?.relevance || 0,
                      informationDensity: data.data.metrics?.informationDensity || 0,
                      contentQualityAnalysis: data.data.metrics?.contentQualityAnalysis || 'Unknown',
                      uniqueness: data.data.metrics?.uniqueness || 0,
                    },
                    status: `Extracted content (${data.data.content.length} characters)`,
                  }
                }]);
              }
              
              // Handle end event
              if (data.type === "end") {
                console.log("🏁 [Scraper UI] Received end event with results:", data.output);
                
                setEvents(prev => [...prev, {
                  type: "end",
                  output: data.output,
                  friendly_title: "Scraping complete",
                  friendly_message: `Successfully scraped ${data.output.summary.pagesScraped} pages`
                }]);
                
                setResults(data.output);
                setActiveTab("results");
                setIsLoading(false);
                setIsConnected(false);
                eventSource.close();
                
                toast.success("Scraping Complete", {
                  description: `Successfully scraped ${data.output.summary.pagesScraped} pages.`,
                });
              }
              
              // Handle error event
              if (data.type === "error") {
                setEvents(prev => [...prev, {
                  type: "error",
                  error: data.error || "Unknown error",
                  friendly_title: "Error occurred",
                  friendly_message: data.error || "An error occurred during scraping"
                }]);
                
                toast.error("Scraping Error", {
                  description: data.error || "An unknown error occurred",
                });
              }
            } catch (error) {
              console.error("Error parsing scraper event:", error);
            }
          });
        } catch (error) {
          console.error("Error setting up EventSource:", error);
          setEvents(prev => [...prev, {
            type: "error",
            error: "Failed to connect to scraper service",
            friendly_title: "Connection failed",
            friendly_message: "Could not establish connection to the scraper service"
          }]);
          setIsConnected(false);
          setIsLoading(false);
          toast.error("Connection Failed", {
            description: "Could not connect to the scraper service",
          });
        }
      } else {
        // Non-streaming API call
        console.log("🚀 [Scraper UI] Using non-streaming scraper endpoint");
        
        // Format data for non-recursive scraper API
        const scraperRequest = {
          baseUrl: scrapingConfig.baseUrl,
          scrapingGoal: scrapingConfig.scrapingGoal,
          maxPages: scrapingConfig.maxPages,
          maxDepth: scrapingConfig.maxDepth,
          includeImages: scrapingConfig.includeImages,
          executeJavaScript: scrapingConfig.executeJavaScript,
          preventDuplicateUrls: true,
          filters: {
            mustIncludePatterns,
            excludePatterns
          }
        };
        
        const response = await fetch("/api/scraper/non-recursive/sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(scraperRequest),
        });

        if (!response.ok) {
          console.error(
            "❌ [Scraper UI] API response error:",
            response.status,
            response.statusText,
          );
          throw new Error(`Failed to start scraping: ${response.statusText}`);
        }

        const result = await response.json();
        console.log("✅ [Scraper UI] Received complete results:", result);
        
        if (!result || !result.pages) {
          throw new Error("Failed to receive valid scraper result");
        }
        
        // Create a synthetic end event
        const endEvent: ScraperEvent = {
          type: "end",
          output: result,
          friendly_title: "Scraping complete",
          friendly_message: `Successfully scraped ${result.summary.pagesScraped} pages`
        };
        
        setEvents([endEvent]);
        setResults(result);
        setActiveTab("results");
        
        toast.success("Scraping Complete", {
          description: "Web scraping operation has finished successfully.",
        });
      }
    } catch (error) {
      console.error("💥 [Scraper UI] Scraping error:", error);
      toast.error("Scraping Failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      console.log("🔚 [Scraper UI] Scraping process finalized");
      setIsLoading(false);
    }
  };

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-6">Web Scraper Agent</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-4 mb-6">
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="logs">Event Log</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="debug">Debug</TabsTrigger>
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
                  {scrapingConfig.baseUrl.includes('xotiv.com') && (
                    <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-md text-amber-700 text-sm">
                      <div className="font-medium mb-1">⚠️ JavaScript-heavy website detected</div>
                      <p>
                        xotiv.com appears to be a Single Page Application (SPA) that requires JavaScript execution to render content.
                        Our basic scraper might not be able to extract all content. See the Debug tab for more information.
                      </p>
                    </div>
                  )}
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
                    <Label htmlFor="maxPages">
                      Maximum Pages ({scrapingConfig.maxPages})
                    </Label>
                    <Slider
                      id="maxPages"
                      min={1}
                      max={50}
                      step={1}
                      value={[scrapingConfig.maxPages]}
                      onValueChange={(value) =>
                        handleSliderChange("maxPages", value)
                      }
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label htmlFor="maxDepth">
                      Maximum Depth ({scrapingConfig.maxDepth})
                    </Label>
                    <Slider
                      id="maxDepth"
                      min={1}
                      max={10}
                      step={1}
                      value={[scrapingConfig.maxDepth]}
                      onValueChange={(value) =>
                        handleSliderChange("maxDepth", value)
                      }
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
                      setScrapingConfig((prev) => ({
                        ...prev,
                        includeImages: checked,
                      }))
                    }
                  />
                  <Label htmlFor="includeImages">Include Images</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="executeJavaScript"
                    name="executeJavaScript"
                    checked={scrapingConfig.executeJavaScript}
                    onCheckedChange={(checked) => 
                      setScrapingConfig(prev => ({ ...prev, executeJavaScript: checked }))
                    }
                  />
                  <Label htmlFor="executeJavaScript">Execute JavaScript (Use Puppeteer)</Label>
                  <p className="text-xs text-muted-foreground ml-auto">
                    Required for SPAs and JS-heavy sites
                  </p>
                </div>

                <div className="border rounded-lg p-4 space-y-4">
                  <h3 className="font-medium">URL Filters</h3>

                  <div>
                    <Label htmlFor="mustIncludePatterns">
                      Must Include Patterns
                    </Label>
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

                <div className="mt-4">
                  <StreamingToggle
                    initialState={isStreaming}
                    onToggle={setIsStreaming}
                  />
                  {isLoading && (
                    <div className="mt-2 flex items-center text-sm">
                      <span className="mr-2">Connection status:</span>
                      <span 
                        className={`inline-block w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-yellow-500'}`}
                      ></span>
                      <span className="ml-1">
                        {isConnected ? 'Connected' : 'Connecting...'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                onClick={startScraping}
                disabled={
                  isLoading ||
                  !scrapingConfig.baseUrl ||
                  !scrapingConfig.scrapingGoal
                }
                className="w-full"
              >
                {isLoading ? "Scraping in progress..." : "Start Scraping"}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <div className="mb-2 flex justify-between items-center">
            {isLoading && (
              <div className="flex items-center text-sm">
                <span className="mr-2">Connection status:</span>
                <span 
                  className={`inline-block w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-yellow-500'}`}
                ></span>
                <span className="ml-1">
                  {isConnected ? 'Connected' : 'Connecting...'}
                </span>
              </div>
            )}
          </div>
          <ScraperEventsLog events={events} isLoading={isLoading} />
        </TabsContent>

        <TabsContent value="results">
          <ScraperResults results={results} />
        </TabsContent>

        <TabsContent value="debug">
          <Card>
            <CardHeader>
              <CardTitle>Debugging Tools</CardTitle>
              <CardDescription>
                Tools to help debug scraping issues with specific URLs
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="testUrl">Test URL Fetch</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      id="testUrl"
                      placeholder="https://example.com"
                      value={scrapingConfig.baseUrl}
                      onChange={(e) =>
                        setScrapingConfig((prev) => ({
                          ...prev,
                          baseUrl: e.target.value,
                        }))
                      }
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      onClick={async () => {
                        try {
                          toast.info("Testing URL fetch...");
                          const response = await fetch("/api/test-fetch", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              url: scrapingConfig.baseUrl,
                              useJavaScript: useJavaScript
                            }),
                          });

                          const result = await response.json();

                          if (response.ok) {
                            console.log("Test fetch result:", result);
                            toast.success("Fetch test completed", {
                              description: `Status: ${result.status}, Content length: ${result.contentLength} bytes, JavaScript: ${result.usedJavaScript ? 'Yes' : 'No'}`
                            });
                          } else {
                            console.error("Test fetch error:", result);
                            toast.error("Fetch test failed", {
                              description: result.error || "Unknown error"
                            });
                          }
                        } catch (error) {
                          console.error("Test fetch error:", error);
                          toast.error("Fetch test error", {
                            description: error instanceof Error ? error.message : "Unknown error"
                          });
                        }
                      }}
                    >
                      Test Fetch
                    </Button>
                  </div>
                  <div className="flex items-center space-x-2 mt-2">
                    <Switch
                      id="executeJavaScript"
                      checked={useJavaScript}
                      onCheckedChange={setUseJavaScript}
                    />
                    <Label htmlFor="executeJavaScript">Execute JavaScript (Puppeteer)</Label>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Directly test fetching a URL to check if it&apos;s accessible
                  </p>
                </div>

                <div className="border rounded-lg p-4">
                  <h3 className="font-medium mb-2">Common Issues</h3>
                  <ul className="space-y-2 text-sm">
                    <li>
                      <strong>CORS issues:</strong> Some websites block requests
                      from other domains
                    </li>
                    <li>
                      <strong>JavaScript-rendered content:</strong> Simple
                      fetching may not work for JS-heavy sites
                    </li>
                    <li>
                      <strong>Rate limiting:</strong> Sites may block rapid or
                      automated requests
                    </li>
                    <li>
                      <strong>Authentication:</strong> Sites requiring login
                      won&apos;t provide full content
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
