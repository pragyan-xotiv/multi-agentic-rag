# URL Analysis Chain

## Purpose

The URL Analysis Chain evaluates URLs to determine their relevance to the scraping goal, estimate their information value, and assign priority scores for the scraping queue.

## Flow Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Input URL &    │────►│  URL Component  │────►│   Relevance     │
│  Scraping Goal  │     │    Analysis     │     │   Scoring       │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│   Analysis      │◄────│  Domain Auth    │◄────│  Expected Value │
│   Result        │     │  Assessment     │     │  Calculation    │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Core Module Usage

The chain uses the `url-analyzer` core module at the following points:
- During URL Component Analysis to parse and extract URL components
- During Relevance Scoring to analyze the URL path and query parameters
- When calculating the Expected Value by comparing URL structure with the scraping goal
- During Domain Authority Assessment to check domain reputation and trust signals
- For Robot.txt compliance checking before adding URLs to the scraping queue

## Inputs

- `url`: The URL to analyze
- `scrapingGoal`: The goal of the scraping operation
- `currentState`: The current state of the scraper agent

## Outputs

```typescript
{
  url: string;
  relevanceScore: number;
  expectedValue: number;
  isAllowedByRobots: boolean;
  domainAuthority: number;
  wasVisitedBefore: boolean;
}
```

## Chain Components

1. **URL Parsing**: Parse the URL to extract components and structure
2. **Relevance Scoring**: Calculate how relevant the URL is to the scraping goal
3. **Value Estimation**: Estimate the expected information value
4. **Robot Compliance Check**: Verify if the URL is allowed by robots.txt
5. **Domain Authority Assessment**: Evaluate the authority of the domain

## Integration Points

- Utilizes the `url-analyzer` core module for URL analysis functionality
- Feeds into the navigation decision chain for prioritizing scraping targets
- Assists the progress evaluation chain in calculating completeness

## Example Usage

```typescript
import { runURLAnalysisChain } from "./lib/chains/url-analysis-chain";

const result = await runURLAnalysisChain({
  url: "https://example.com/products",
  scrapingGoal: "Gather product information and pricing details",
  currentState: scraperState
});

console.log(`URL relevance: ${result.relevanceScore}`);
console.log(`Expected value: ${result.expectedValue}`);

// Add to priority queue if valuable
if (result.expectedValue > 0.5 && result.isAllowedByRobots) {
  // Proceed with scraping this URL
}
``` 