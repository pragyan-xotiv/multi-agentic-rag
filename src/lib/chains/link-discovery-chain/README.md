# Link Discovery Chain

## Purpose

The Link Discovery Chain identifies links on a web page, analyzes their context, and assigns priority scores based on their expected information value. It creates a prioritized list of URLs to be added to the scraping queue.

## Flow Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  HTML Content   │────►│  Link           │────►│  Link           │
│  & Current URL  │     │  Extraction     │     │  Filtering      │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Prioritized    │◄────│  Priority       │◄────│  Link Context   │
│  Link List      │     │  Calculation    │     │  Analysis       │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Core Module Usage

The chain uses the `link-prioritizer` core module at the following points:
- During Link Extraction to identify and parse all hyperlinks in the HTML
- During Link Filtering to remove irrelevant, duplicate, or already visited links
- When analyzing Link Context to understand the surrounding text and semantics
- During Priority Calculation to score links based on predicted information value
- For normalizing and canonicalizing URLs before adding them to the queue
- When organizing links into a prioritized list based on their scores

## Inputs

- `html`: The HTML content of the page
- `currentUrl`: The URL of the current page
- `currentState`: The current state of the scraper agent

## Outputs

```typescript
{
  links: Array<{
    url: string;
    text: string;
    context: string;
    predictedValue: number;
  }>;
}
```

## Chain Components

1. **Link Extraction**: Extract all links from the HTML content
2. **Link Filtering**: Filter out links that shouldn't be followed
3. **Link Context Analysis**: Analyze the context around each link
4. **Value Prediction**: Calculate the predicted information value of each link
5. **Link Prioritization**: Sort links by their predicted value

## Integration Points

- Utilizes the `link-prioritizer` core module for link analysis and prioritization
- Feeds prioritized links to the state manager for queueing
- Provides input for the navigation decision chain

## Example Usage

```typescript
import { runLinkDiscoveryChain } from "./lib/chains/link-discovery-chain";
import { addLinksToQueue } from "./lib/agents/scraper/core/state-manager";

const result = await runLinkDiscoveryChain({
  html: pageContent,
  currentUrl: "https://example.com/products",
  currentState: scraperState
});

console.log(`Discovered ${result.links.length} links`);

// Add the discovered links to the scraping queue
const currentDepth = getCurrentPageDepth(scraperState);
addLinksToQueue(scraperState, result.links, currentDepth);

// Log the most valuable links
const topLinks = result.links.slice(0, 3);
console.log("Top links to explore:");
topLinks.forEach(link => {
  console.log(`- ${link.url} (value: ${link.predictedValue.toFixed(2)})`);
});
``` 