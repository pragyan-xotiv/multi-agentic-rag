# Progress Evaluation Chain

## Purpose

The Progress Evaluation Chain assesses the overall progress of the scraping operation, calculating metrics about information density, relevance, uniqueness, and completeness. It helps determine when enough information has been gathered to meet the scraping goal.

## Flow Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Scraper State  │────►│  Information    │────►│  Relevance      │
│  & Content      │     │  Density        │     │  Analysis       │
│                 │     │  Analysis       │     │                 │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Progress       │◄────│  Completeness   │◄────│  Uniqueness     │
│  Metrics        │     │  Estimation     │     │  Analysis       │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Core Module Usage

The chain uses the `navigation-decision` and `state-manager` core modules at the following points:
- During Information Density Analysis to calculate metrics across all extracted content
- When assessing Relevance to compare all content against the scraping goal
- During Uniqueness Analysis to identify content overlap and repetition
- When estimating Completeness to determine if the scraping goal has been met
- During Diminishing Returns Assessment to detect when new content adds minimal value
- For generating progress metrics that will inform navigation decisions
- When updating the scraper state with the latest evaluation metrics

## Inputs

- `currentState`: The current state of the scraper agent with all extracted content

## Outputs

```typescript
{
  metrics: {
    informationDensity: number;
    relevance: number;
    uniqueness: number;
    completeness: number;
  };
  analysisDetails: {
    pagesScraped: number;
    totalContentSize: number;
    coverageScore: number;
    diminishingReturns: boolean;
    remainingValueEstimate: number;
  };
}
```

## Chain Components

1. **Information Density Analysis**: Calculate the average information density across all scraped pages
2. **Relevance Analysis**: Assess how relevant the scraped content is to the goal
3. **Uniqueness Analysis**: Evaluate how unique the information is (avoiding duplication)
4. **Completeness Estimation**: Estimate how complete the gathered information is relative to the goal
5. **Diminishing Returns Assessment**: Detect if new pages are adding less unique information

## Integration Points

- Utilizes the `navigation-decision` core module for progress evaluation metrics
- Provides input for the navigation decision chain
- Updates the state with new progress metrics

## Example Usage

```typescript
import { runProgressEvaluationChain } from "./lib/chains/progress-evaluation-chain";

const result = await runProgressEvaluationChain({
  currentState: scraperState
});

console.log("Scraping Progress:");
console.log(`- Pages scraped: ${result.analysisDetails.pagesScraped}`);
console.log(`- Information density: ${result.metrics.informationDensity.toFixed(2)}`);
console.log(`- Content relevance: ${result.metrics.relevance.toFixed(2)}`);
console.log(`- Estimated completion: ${(result.metrics.completeness * 100).toFixed(0)}%`);

// Update the state with the new metrics
scraperState.valueMetrics = result.metrics;

// Check if we should continue or stop
if (result.metrics.completeness > 0.85) {
  console.log("Scraping goal is nearly complete, finalizing...");
  // Proceed to final output generation
}
``` 