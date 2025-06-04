# Non-Recursive Scraper API

This API provides access to the non-recursive scraper agent implementation, which is designed to avoid recursion depth issues while providing the same functionality as the original scraper.

## Endpoints

### Streaming Endpoint

`POST /api/scraper/non-recursive`

This endpoint streams scraper events in real-time, allowing the client to track progress and receive results incrementally.

### Synchronous Endpoint

`POST /api/scraper/non-recursive/sync`

This endpoint executes the scraping process and returns the complete result when finished.

## Request Format

Both endpoints accept the same request format:

```json
{
  "baseUrl": "https://example.com",
  "scrapingGoal": "Extract information about widgets and their specifications",
  "maxPages": 20,
  "maxDepth": 3,
  "includeImages": false,
  "executeJavaScript": true,
  "preventDuplicateUrls": true,
  "filters": {
    "mustIncludePatterns": ["product", "widget"],
    "excludePatterns": ["login", "checkout"]
  }
}
```

### Required Parameters

- `baseUrl` - The starting URL for the scraping process
- `scrapingGoal` - A description of what information to extract

### Optional Parameters

- `maxPages` - Maximum number of pages to scrape (default: 20)
- `maxDepth` - Maximum link depth to follow (default: 3)
- `includeImages` - Whether to include image information (default: false)
- `executeJavaScript` - Whether to execute JavaScript when rendering pages (default: true)
- `preventDuplicateUrls` - Whether to prevent visiting the same URL multiple times (default: true)
- `filters` - Patterns for URL filtering
  - `mustIncludePatterns` - URLs must contain at least one of these patterns
  - `excludePatterns` - URLs containing any of these patterns will be skipped

## Response Format

### Streaming Endpoint

Returns a stream of events in the following format:

```
{"type":"start","url":"https://example.com","goal":"Extract widget information"}
{"type":"fetch-start","url":"https://example.com","useJavaScript":true}
{"type":"fetch-complete","url":"https://example.com","statusCode":200,"contentLength":12345}
{"type":"extract-content","url":"https://example.com","contentType":"text/html"}
{"type":"page","data":{...page content object...}}
...
{"type":"end","output":{...complete result object...}}
```

### Synchronous Endpoint

Returns the complete scraping result as a JSON object:

```json
{
  "pages": [
    {
      "url": "https://example.com",
      "title": "Example Website",
      "content": "...",
      "contentType": "text/html",
      "extractionTime": "2023-10-24T12:34:56.789Z",
      "metrics": {
        "informationDensity": 0.85,
        "relevance": 0.92,
        "uniqueness": 0.78
      },
      "links": [...],
      "entities": [...]
    },
    ...
  ],
  "summary": {
    "pagesScraped": 15,
    "totalContentSize": 234567,
    "executionTime": 12345,
    "goalCompletion": 0.95,
    "coverageScore": 0.87
  }
}
```

## Error Handling

In case of errors, the API will respond with an appropriate HTTP status code and error message:

```json
{
  "error": "Scraping failed",
  "message": "Error details..."
}
```

## Examples

### Streaming Request Example

```javascript
const response = await fetch('/api/scraper/non-recursive', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    baseUrl: 'https://example.com',
    scrapingGoal: 'Extract product information'
  })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  
  const events = decoder.decode(value).split('\n').filter(Boolean);
  for (const eventText of events) {
    const event = JSON.parse(eventText);
    console.log(`Event: ${event.type}`, event);
  }
}
```

### Sync Request Example

```javascript
const response = await fetch('/api/scraper/non-recursive/sync', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    baseUrl: 'https://example.com',
    scrapingGoal: 'Extract product information'
  })
});

const result = await response.json();
console.log('Scraping result:', result);
``` 