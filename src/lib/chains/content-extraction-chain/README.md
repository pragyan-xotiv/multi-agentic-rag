# Content Extraction Chain

## Purpose

The Content Extraction Chain extracts valuable content from web pages, focusing on high-value elements while ignoring navigation, ads, and boilerplate. It analyzes the extracted content to determine information density, relevance to the scraping goal, and uniqueness.

## Flow Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  HTML Content   │────►│  Title          │────►│  Main Content   │
│  & URL          │     │  Extraction     │     │  Extraction     │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Content        │◄────│  Relevance      │◄────│  HTML Content   │
│  Analysis       │     │  Assessment     │     │  Cleaning       │
│                 │     │                 │     │                 │
└────────┬────────┘     └─────────────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │
│  Uniqueness     │────►│  Extraction     │
│  Calculation    │     │  Result         │
│                 │     │                 │
└─────────────────┘     └─────────────────┘
```

## Core Module Usage

The chain uses the `content-extractor` core module at the following points:
- During Title Extraction to identify and extract the most relevant page title
- During Main Content Extraction to separate valuable content from navigation and boilerplate
- When cleaning HTML content to convert it to structured plain text
- During Relevance Assessment to compare content against the scraping goal
- When calculating Information Density metrics to determine content value
- During Uniqueness Calculation to compare against previously extracted content
- For optional Entity Recognition to identify key entities within the content

## Inputs

- `html`: The HTML content of the page
- `url`: The URL of the page
- `currentState`: The current state of the scraper agent

## Outputs

```typescript
{
  title: string;
  content: string;
  contentType: string;
  metrics: {
    informationDensity: number;
    relevance: number;
    uniqueness: number;
  };
  entities?: {
    name: string;
    type: string;
    mentions: number;
  }[];
}
```

## Chain Components

1. **Title Extraction**: Extract the page title
2. **Main Content Extraction**: Isolate the main content, removing boilerplate
3. **Content Cleaning**: Clean the HTML content to plain text
4. **Information Density Calculation**: Assess how much useful information is present
5. **Relevance Scoring**: Calculate how relevant the content is to the scraping goal
6. **Uniqueness Assessment**: Determine how unique the content is compared to already extracted content
7. **Entity Recognition**: (Optional) Identify key entities in the content

## Integration Points

- Utilizes the `content-extractor` core module for content extraction and analysis
- Feeds extracted content to the state manager for storage
- Provides metrics for the progress evaluation chain

## Example Usage

```typescript
import { runContentExtractionChain } from "./lib/chains/content-extraction-chain";

const result = await runContentExtractionChain({
  html: pageContent,
  url: "https://example.com/products/laptop",
  currentState: scraperState
});

console.log(`Extracted title: ${result.title}`);
console.log(`Content length: ${result.content.length} characters`);
console.log(`Information density: ${result.metrics.informationDensity}`);
console.log(`Relevance to goal: ${result.metrics.relevance}`);

// Add the extracted content to the scraper state
addPageToState(scraperState, "https://example.com/products/laptop", {
  url: "https://example.com/products/laptop",
  title: result.title,
  content: result.content,
  contentType: result.contentType,
  extractionTime: new Date().toISOString(),
  metrics: result.metrics,
  links: [],
  entities: result.entities || []
});
``` 