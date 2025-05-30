# Navigation Decision Chain

## Purpose

The Navigation Decision Chain determines the next action in the scraping process: whether to continue scraping by visiting another URL or to complete the process because the goal has been adequately met. It selects the most valuable URL to visit next from the priority queue if scraping should continue.

## Flow Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Scraper State  │────►│  Goal           │────►│  Max Pages      │
│  & Progress     │     │  Completion     │     │  Check          │
│  Metrics        │     │  Check          │     │                 │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Decision       │◄────│  Decision       │◄────│  URL Queue      │
│  Result         │     │  Logic          │     │  Processing     │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Core Module Usage

The chain uses the `navigation-decision` and `state-manager` core modules at the following points:
- During Goal Completion Check to determine if sufficient information has been gathered
- When performing Maximum Pages Check to enforce scraping limits
- During Diminishing Returns Analysis to detect when additional scraping yields minimal value
- When accessing and managing the URL Queue from the scraper state
- During Decision Logic to determine whether to continue or complete the scraping process
- For selecting the next URL to visit based on priority scores
- When updating the state with navigation decisions and current position

## Inputs

- `currentState`: The current state of the scraper agent
- `progressMetrics`: The latest progress metrics from the progress evaluation chain

## Outputs

```typescript
{
  action: 'continue' | 'complete';
  nextUrl?: string;
  completionEstimate: number;
  reason: string;
  actionDetails?: {
    expectedValue?: number;
    pageDepth?: number;
    queueSize?: number;
  };
}
```

## Chain Components

1. **Goal Completion Check**: Assess if enough information has been gathered
2. **Maximum Pages Check**: Check if the maximum page limit has been reached
3. **Diminishing Returns Analysis**: Determine if new pages are adding minimal value
4. **Queue Management**: Get the next URL from the priority queue
5. **Decision Logic**: Make the final decision about continuing or stopping

## Integration Points

- Utilizes the `navigation-decision` core module for decision-making logic
- Connects with the state manager to access the priority queue
- Drives the overall scraping workflow

## Example Usage

```typescript
import { runNavigationDecisionChain } from "./lib/chains/navigation-decision-chain";

const result = await runNavigationDecisionChain({
  currentState: scraperState,
  progressMetrics: progressMetrics
});

if (result.action === 'continue' && result.nextUrl) {
  console.log(`Continuing scraping at: ${result.nextUrl}`);
  console.log(`Reason: ${result.reason}`);
  
  // Set the new current URL in the state
  scraperState.currentUrl = result.nextUrl;
  
  // Fetch and process the next page
  await fetchAndProcessPage(result.nextUrl, scraperState);
  
} else {
  console.log(`Completing scraping process`);
  console.log(`Reason: ${result.reason}`);
  console.log(`Completion estimate: ${(result.completionEstimate * 100).toFixed(0)}%`);
  
  // Generate the final output
  const finalOutput = formatOutput(scraperState, startTime);
  return finalOutput;
}
``` 