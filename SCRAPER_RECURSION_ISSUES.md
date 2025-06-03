# Scraper Recursion Issues

## Problem Identification

The web scraper workflow is hitting the LangGraph recursion limit with the following error:

```
❌ [ScraperWorkflow] Error executing workflow: Error [GraphRecursionError]: Recursion limit of 25 reached without hitting a stop condition. You can increase the limit by setting the "recursionLimit" config key.

Troubleshooting URL: https://langchain-ai.github.io/langgraphjs/troubleshooting/errors/GRAPH_RECURSION_LIMIT/
```

This issue occurs despite explicitly setting a higher recursion limit (100) in the configuration. This indicates either the configuration is not being applied correctly or there are fundamental issues with the workflow's termination conditions.

## Root Causes Analysis

### 1. Configuration Application Issue

The scraper sets `recursionLimit: 100`, but the error shows a limit of 25, suggesting the configuration is not being properly applied to the LangGraph workflow.

```typescript
const workflowPromise = workflow.invoke(
  initialState,
  {
    configurable: {
      recursionLimit: config.recursionLimit, // Set to 100
      maxIterations: config.maxIterations    // Set to 50
    }
  }
);
```

### 2. Circular Workflow Paths

The workflow graph contains a circular path structure that can lead to infinite recursion:

```
START → analyzeURL → fetchPage → detectAuthentication → extractContent → 
discoverLinks → evaluateProgress → decideNextAction → analyzeURL → ...
```

This cycle continues until a termination condition is met or the recursion limit is reached.

### 3. Termination Conditions Not Being Triggered

The `decideNextAction` function contains several termination conditions:

- If node visit count exceeds 25
- If we have a final output with pages
- If we've reached max pages
- If URL queue is empty
- If we have good progress (>0.8) and enough pages
- If too many URL revisits
- If low extraction efficiency
- If state stagnation detected

However, these conditions may not be triggering due to:
- High `maxPages` setting
- Complex websites with many links
- Content extraction failures
- Low completeness scores

### 4. State Management Issues

The workflow might be improperly managing state or failing to mark URLs as visited, causing revisits and loops.

## Debugging Approach

To properly debug and fix these issues, we need:

1. Detailed execution path logs
2. State snapshots before recursion limit is hit
3. Visualization of workflow transitions
4. Validation of configuration parameters

## Step-by-Step Fix Prompt

Follow these steps to resolve the scraper recursion issues:

### Step 1: Add Enhanced Debug Logging

Add detailed logging to better understand the workflow's behavior just before it hits the recursion limit:

```typescript
// Add to the decideNextAction function
if (state.nodeVisitCounts?.get('decideNextAction') > 20) {
  console.warn(`⚠️ [Debug] Near recursion limit! Dumping state:`);
  console.warn(`  Current URL: ${state.currentUrl}`);
  console.warn(`  Queue size: ${state.pageQueue.size()}`);
  console.warn(`  Visited URLs: ${state.visitedUrls.size}`);
  console.warn(`  Extracted content: ${state.extractedContent.size}`);
  console.warn(`  Last 5 execution steps: ${state.executionPath?.slice(-5).join(' → ')}`);
}
```

### Step 2: Verify Configuration Application

Modify the workflow invocation to explicitly log and ensure the configuration is being applied:

```typescript
console.log(`🔧 [Debug] Applying LangGraph config:`, JSON.stringify({
  recursionLimit: config.recursionLimit,
  maxIterations: config.maxIterations
}));

// Use the most current invocation syntax from LangGraph docs
const workflowPromise = workflow.invoke(
  initialState,
  {
    recursionLimit: config.recursionLimit,  // Try both formats
    maxIterations: config.maxIterations,
    configurable: {
      recursionLimit: config.recursionLimit,
      maxIterations: config.maxIterations
    }
  }
);
```

### Step 3: Add Forced Termination Fallback

Implement a more aggressive termination condition to prevent hitting the recursion limit:

```typescript
// Add to the top of the decideNextAction conditional logic
if (state.nodeVisitCounts?.get('decideNextAction') > 15) {
  console.warn(`⚠️ [Workflow] Force terminating after ${state.nodeVisitCounts.get('decideNextAction')} decision cycles`);
  return {
    ...state,
    finalOutput: prepareOutput(state)
  };
}
```

### Step 4: Fix URL Queue Processing

Ensure the URL queue is properly managed to prevent revisits:

```typescript
// Enhance the URL marking in decideNextAction
// Mark the current URL as visited
if (state.currentUrl) {
  state.visitedUrls.add(state.currentUrl);
  
  // Also mark in normalized form if that option is enabled
  if (state.preventDuplicateUrls && state.normalizedUrls) {
    state.normalizedUrls.add(normalizeUrl(state.currentUrl));
  }
  
  console.log(`✓ [Navigation] Marked ${state.currentUrl} as visited (total: ${state.visitedUrls.size})`);
}
```

### Step 5: Enhance URL Discovery Filter

Improve the link filtering to reduce unnecessary URLs:

```typescript
// In the discoverLinks function
// Add more aggressive filtering
let shouldEnqueue = true;

// Skip URLs that are too similar to already visited ones
const urlPath = new URL(link.url).pathname;
const similarVisitedPaths = Array.from(state.visitedUrls)
  .filter(visited => new URL(visited).pathname === urlPath)
  .length;

if (similarVisitedPaths > 0) {
  shouldEnqueue = false;
  console.log(`🔄 [LinkDiscovery] Skipping ${link.url} - similar path already visited`);
}

// Skip URLs with very low predicted value
if (link.predictedValue < 0.2) {
  shouldEnqueue = false;
  console.log(`🔄 [LinkDiscovery] Skipping ${link.url} - low value (${link.predictedValue.toFixed(2)})`);
}
```

### Step 6: Check LangGraph Library Version

Ensure you're using the latest version of LangGraph that properly supports configuration:

```bash
npm list @langchain/langgraph
# or
yarn why @langchain/langgraph
```

If needed, update to the latest version:

```bash
npm install @langchain/langgraph@latest
# or
yarn add @langchain/langgraph@latest
```

### Step 7: Implement a Circuit Breaker

Add a circuit breaker pattern to force termination after a certain number of pages:

```typescript
// Add to executeScraperWorkflow
// Create a safety circuit breaker
let pageCount = 0;
const originalOnPageProcessed = options.onPageProcessed;
options.onPageProcessed = async (pageContent) => {
  pageCount++;
  if (pageCount >= options.maxPages) {
    console.warn(`⚠️ [CircuitBreaker] Reached ${pageCount} pages, signaling to complete workflow`);
    // Force the current state to have a final output
    initialState.finalOutput = prepareOutput(initialState);
  }
  if (originalOnPageProcessed) {
    await originalOnPageProcessed(pageContent);
  }
};
```

### Step 8: Lower Initial Limits for Testing

Temporarily reduce limits to ensure the workflow can complete successfully:

```typescript
// For testing, lower these values
const config = {
  recursionLimit: 30,       // Lower from 100
  maxIterations: 20,        // Lower from 50
  maxPages: 10,             // Lower for testing
  maxExecutionTimeMs: 3 * 60 * 1000, // 3 minutes instead of 10
};
```

### Step 9: Verify Workflow Graph Structure

Ensure the workflow graph is correctly defined and there are no unintended loops:

```typescript
// After creating the workflow, log its structure
console.log(`📊 [Debug] Workflow graph structure:`);
console.log(`  Nodes: ${Object.keys(workflow.getGraph().nodes).join(', ')}`);
console.log(`  Edges: ${JSON.stringify(workflow.getGraph().edges)}`);
```

### Step 10: Progressive Testing

Test the scraper with increasingly complex websites:

1. Start with a simple static site (1-5 pages)
2. Move to a medium complexity site (10-20 pages)
3. Finally test with the actual target site

Document results at each stage to isolate when issues occur.

## Next Steps

After implementing these fixes, monitor the scraper behavior closely. If it completes successfully with smaller sites but still fails with larger ones, consider implementing a pagination approach where you scrape in batches rather than trying to do everything in one workflow execution.

This approach helps maintain the event streaming functionality while ensuring the workflow completes reliably. 