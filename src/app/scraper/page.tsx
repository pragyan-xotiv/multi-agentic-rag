"use client";

import { useState } from "react";
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

export default function ScraperPage() {
  const [isLoading, setIsLoading] = useState(false);
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

      // Prepare the config object
      const config = {
        ...scrapingConfig,
        filters: {
          mustIncludePatterns: scrapingConfig.filters.mustIncludePatterns
            ? scrapingConfig.filters.mustIncludePatterns
                .split(",")
                .map((p) => p.trim())
            : [],
          excludePatterns: scrapingConfig.filters.excludePatterns
            ? scrapingConfig.filters.excludePatterns
                .split(",")
                .map((p) => p.trim())
            : [],
        },
      };

      console.log(
        "📋 [Scraper UI] Prepared config:",
        JSON.stringify(config, null, 2),
      );

      // Format data for controller agent
      const controllerRequest = {
        requestType: "scrape-and-process",
        url: config.baseUrl,
        scrapingGoal: config.scrapingGoal,
        processingGoal: "Extract key entities, relationships, and structured knowledge from content",
        stream: isStreaming,
        options: {
          maxPages: config.maxPages,
          maxDepth: config.maxDepth,
          includeImages: config.includeImages,
          executeJavaScript: config.executeJavaScript,
          filters: config.filters,
          storeInVectorDb: true,
          namespace: `scrape-${Date.now()}`,
          preventDuplicateUrls: true
        }
      };

      console.log("🎮 [Scraper UI] Using Controller Agent with streaming:", isStreaming);

      if (isStreaming) {
        // Streaming API call
        const response = await fetch("/api/controller", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(controllerRequest),
        });

        if (!response.ok) {
          console.error(
            "❌ [Scraper UI] API response error:",
            response.status,
            response.statusText,
          );
          throw new Error(`Failed to start scraping: ${response.statusText}`);
        }

        console.log(
          "✅ [Scraper UI] API connection established, status:",
          response.status,
        );

        // Handle the streaming response
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("Response body is null");
        }

        const decoder = new TextDecoder();
        console.log("📡 [Scraper UI] Starting to read stream");

        let eventCount = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            console.log("🏁 [Scraper UI] Stream completed");
            break;
          }

          const chunk = decoder.decode(value);
          console.log(`📦 [Scraper UI] Received chunk: ${chunk.length} bytes`);

          const lines = chunk.split("\n").filter((line) => line.trim());
          console.log(`📜 [Scraper UI] Chunk contains ${lines.length} events`);

          for (const line of lines) {
            try {
              // Extract the data part from the SSE format
              const dataMatch = line.match(/^data: (.+)$/);
              const eventData = dataMatch ? JSON.parse(dataMatch[1]) : JSON.parse(line);
              
              eventCount++;
              console.log(
                `🔄 [Scraper UI] Processing event #${eventCount}:`,
                eventData.type,
                eventData.friendly_title ? `(${eventData.friendly_title})` : ''
              );

              // Map controller events to scraper events with enhanced UI information
              if (eventData.type === "start") {
                setEvents(prev => [...prev, {
                  type: "start",
                  url: eventData.data?.url || config.baseUrl,
                  goal: config.scrapingGoal,
                  friendly_title: eventData.friendly_title,
                  friendly_message: eventData.friendly_message
                }]);
              } else if (eventData.type === "scraping-started") {
                setEvents(prev => [...prev, {
                  type: "start",
                  url: eventData.data?.url || config.baseUrl,
                  goal: config.scrapingGoal,
                  friendly_title: eventData.friendly_title,
                  friendly_message: eventData.friendly_message
                }]);
              } else if (eventData.type === "scraping-progress") {
                // Extract URL from the friendly title if available
                let url = config.baseUrl;
                if (eventData.friendly_title && eventData.friendly_title.includes(':')) {
                  url = eventData.friendly_title.split(':')[1].trim();
                }
                
                // Create a more informative page event
                setEvents(prev => [...prev, {
                  type: "page",
                  data: {
                    url: eventData.data?.url || url,
                    title: eventData.friendly_title || 'Processing page',
                    metrics: {
                      relevance: eventData.data?.metrics?.relevance || 0,
                      informationDensity: eventData.data?.metrics?.informationDensity || 0,
                    },
                    status: eventData.friendly_message,
                    progress: eventData.progress ? Math.round(eventData.progress * 100) : null
                  }
                }]);
              } else if (eventData.type === "scraping-complete") {
                setEvents(prev => [...prev, {
                  type: "end",
                  output: eventData.data,
                  friendly_title: eventData.friendly_title,
                  friendly_message: eventData.friendly_message,
                  timing: eventData.data?.timing
                }]);
                
                setResults(eventData.data);
                setActiveTab("results");
              } else if (eventData.type === "processing-started" || eventData.type === "processing-progress") {
                // Add processing events as a special type of page event
                setEvents(prev => [...prev, {
                  type: "processing",
                  data: {
                    title: eventData.friendly_title || 'Processing content',
                    status: eventData.friendly_message || 'Analyzing and extracting knowledge',
                    progress: eventData.progress ? Math.round(eventData.progress * 100) : null
                  }
                }]);
              } else if (eventData.type === "processing-complete") {
                setEvents(prev => [...prev, {
                  type: "processing-complete",
                  data: {
                    title: eventData.friendly_title || 'Processing complete',
                    details: eventData.friendly_message || 'Knowledge extraction finished',
                    entities: eventData.data?.entities?.length || 0,
                    relationships: eventData.data?.relationships?.length || 0
                  }
                }]);
              } else if (eventData.type === "error") {
                setEvents(prev => [...prev, {
                  type: "error",
                  error: eventData.error || "Unknown error",
                  friendly_title: eventData.friendly_title,
                  friendly_message: eventData.friendly_message
                }]);
              } else if (eventData.type === "warning") {
                // Handle warnings (non-fatal errors that allow the process to continue)
                setEvents(prev => [...prev, {
                  type: "warning",
                  message: eventData.error || eventData.message || "Warning",
                  friendly_title: eventData.friendly_title || "Warning",
                  friendly_message: eventData.friendly_message || "The operation encountered an issue but will continue."
                }]);
                
                // Show toast notification for warnings
                toast.warning(eventData.friendly_title || "Warning", {
                  description: eventData.friendly_message || "The operation encountered an issue but will continue."
                });
              } else if (eventData.type === "analyze-url") {
                // URL analysis events
                setEvents(prev => [...prev, {
                  type: "processing",
                  data: {
                    title: `Analyzing URL`,
                    status: `Evaluating ${eventData.url} (depth: ${eventData.depth})`,
                    progress: 10
                  }
                }]);
              } else if (eventData.type === "fetch-start") {
                // Fetch start events
                setEvents(prev => [...prev, {
                  type: "processing",
                  data: {
                    title: `Fetching page`,
                    status: `Loading ${eventData.url} (JavaScript: ${eventData.useJavaScript ? 'enabled' : 'disabled'})`,
                    progress: 20
                  }
                }]);
              } else if (eventData.type === "fetch-complete") {
                // Fetch complete events
                setEvents(prev => [...prev, {
                  type: "processing",
                  data: {
                    title: `Page loaded`,
                    status: `Loaded ${eventData.url} (status: ${eventData.statusCode}, size: ${(eventData.contentLength / 1024).toFixed(1)} KB)`,
                    progress: 30
                  }
                }]);
              } else if (eventData.type === "extract-content") {
                // Content extraction events
                setEvents(prev => [...prev, {
                  type: "processing",
                  data: {
                    title: `Extracting content`,
                    status: `Processing ${eventData.url} (type: ${eventData.contentType})`,
                    progress: 40
                  }
                }]);
              } else if (eventData.type === "discover-links") {
                // Link discovery events
                setEvents(prev => [...prev, {
                  type: "processing",
                  data: {
                    title: `Discovering links`,
                    status: `Found ${eventData.linkCount} links on ${eventData.url}`,
                    progress: 50
                  }
                }]);
              } else if (eventData.type === "evaluate-progress") {
                // Progress evaluation events
                setEvents(prev => [...prev, {
                  type: "processing",
                  data: {
                    title: `Evaluating progress`,
                    status: `Scraped ${eventData.pagesScraped} pages, ${eventData.queueSize} in queue (${Math.round(eventData.goalCompletion * 100)}% complete)`,
                    progress: 60
                  }
                }]);
              } else if (eventData.type === "decide-next-action") {
                // Decision events
                setEvents(prev => [...prev, {
                  type: "processing",
                  data: {
                    title: `Planning next steps`,
                    status: `Decision: ${eventData.decision} - ${eventData.reason}`,
                    progress: 70
                  }
                }]);
              } else if (eventData.type === "workflow-status") {
                // General workflow status events
                setEvents(prev => [...prev, {
                  type: "processing",
                  data: {
                    title: `Workflow step: ${eventData.step}`,
                    status: eventData.message,
                    progress: Math.round(eventData.progress * 100)
                  }
                }]);
              } else if (eventData.type === "heartbeat") {
                // We don't need to add heartbeat events to the UI
                console.log(`💓 [Scraper UI] Heartbeat received: ${eventData.elapsed_ms}ms elapsed`);
              } else if (eventData.type === "complete") {
                // Final completion message
                setEvents(prev => [...prev, {
                  type: "complete",
                  friendly_title: eventData.friendly_title || 'Operation complete',
                  friendly_message: eventData.friendly_message || 'Processing completed successfully',
                  timing: eventData.data?.timing
                }]);
              }
            } catch (e) {
              console.error("❌ [Scraper UI] Failed to parse event:", line, e);
            }
          }
        }
      } else {
        // Non-streaming API call
        console.log("🚀 [Scraper UI] Using non-streaming controller endpoint");
        const response = await fetch("/api/controller", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(controllerRequest),
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
        
        if (!result.success) {
          throw new Error(result.error || "Failed to scrape content");
        }
        
        const scraperResult = result.result.scraperResult;
        
        // Create a synthetic end event
        const endEvent: ScraperEvent = {
          type: "end",
          output: scraperResult,
        };
        
        setEvents([endEvent]);
        setResults(scraperResult);
        setActiveTab("results");
      }

      toast.success("Scraping Complete", {
        description: "Web scraping operation has finished successfully.",
      });
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
