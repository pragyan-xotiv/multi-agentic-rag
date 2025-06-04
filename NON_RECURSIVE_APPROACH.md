# Simplified LangGraph Workflow for Scraper

## Problem

The current scraper implementation uses LangGraph's recursive graph traversal, leading to hitting recursion limits. The workflow is overly complex with many nodes and conditional paths, making it difficult for LangGraph to find termination conditions.

## Proposed Solution

Simplify the existing LangGraph workflow by redesigning the graph structure to be more linear with clearer termination conditions, while still maintaining authentication capabilities for future use.

## Implementation Plan

### 1. Redesign the Graph Structure

Instead of a recursive workflow, create a sequential workflow with a clear termination point:

```typescript
// Create the scraper workflow with a simplified LangGraph structure
export function createSimplifiedScraperWorkflow(options: {
  onAuthRequired?: (authRequest: HumanAuthRequest) => Promise<boolean>;
  onPageProcessed?: (pageContent: PageContent) => Promise<void>;
  onEvent?: (event: ScraperStreamEvent) => Promise<void>;
}) {
  // Create a StateGraph with the annotation-based state structure
  const workflow = new StateGraph(ScraperStateAnnotation)
    // Add nodes for each step
    .addNode("processNextUrl", processNextUrl)
    .addNode("fetchPage", fetchPageContent)
    .addNode("detectAuthentication", detectAuthentication)
    .addNode("handleAuthentication", (state) => handleAuthentication(state, options))
    .addNode("extractContent", extractPageContent)
    .addNode("discoverLinks", discoverLinks)
    .addNode("queueManager", queueManager);
  
  // Define a linear flow
  workflow.addEdge(START, "processNextUrl");
  
  // From processNextUrl, either terminate or fetch the page
  workflow.addConditionalEdges(
    "processNextUrl",
    (state) => {
      // If no more URLs or reached max pages, end the workflow
      if (state.pageQueue.isEmpty() || state.extractedContent.size >= state.maxPages) {
        return END;
      }
      return "fetchPage";
    }
  );
  
  // Standard page processing flow
  workflow.addEdge("fetchPage", "detectAuthentication");
  
  // Handle authentication if needed
  workflow.addConditionalEdges(
    "detectAuthentication",
    (state) => state.requiresAuthentication ? "handleAuthentication" : "extractContent"
  );
  
  // After authentication, go back to fetch the page
  workflow.addEdge("handleAuthentication", "fetchPage");
  
  // Linear content processing
  workflow.addEdge("extractContent", "discoverLinks");
  workflow.addEdge("discoverLinks", "queueManager");
  
  // Always go back to process the next URL, creating a loop
  // that will terminate via the conditional edge from processNextUrl
  workflow.addEdge("queueManager", "processNextUrl");
  
  return workflow.compile();
}
```

### 2. Implement a URL Queue Manager

Create a dedicated node for URL queue management:

```typescript
async function queueManager(state: ExtendedScraperAgentState) {
  console.log(`🔄 [QueueManager] Managing URL queue with ${state.pageQueue.size()} URLs`);
  
  // Get the current extracted content count
  const currentExtractedCount = state.extractedContent.size;
  
  // Check if we've hit the page limit
  if (currentExtractedCount >= state.maxPages) {
    console.log(`🏁 [QueueManager] Reached maximum pages (${state.maxPages}), preparing to finish`);
    
    // Prepare final output
    state.finalOutput = prepareOutput(state);
    return state;
  }
  
  // Sort the queue by priority
  // (This happens automatically in our priority queue implementation)
  
  // Log queue status
  console.log(`📊 [QueueManager] Current queue status: ${state.pageQueue.size()} URLs remaining`);
  console.log(`📊 [QueueManager] Extracted ${currentExtractedCount}/${state.maxPages} pages so far`);
  
  if (state.onEvent) {
    await state.onEvent({
      type: 'workflow-status',
      step: 'queue-manager',
      progress: currentExtractedCount / state.maxPages,
      message: `Processed ${currentExtractedCount} pages, ${state.pageQueue.size()} URLs in queue`
    });
  }
  
  return state;
}
```

### 3. Create a URL Processor Node

Implement a node that gets the next URL from the queue:

```typescript
async function processNextUrl(state: ExtendedScraperAgentState) {
  console.log(`🔍 [ProcessNextUrl] Selecting next URL from queue`);
  
  // Check for termination conditions
  if (state.pageQueue.isEmpty()) {
    console.log(`🏁 [ProcessNextUrl] No more URLs in queue, preparing to finish`);
    state.finalOutput = prepareOutput(state);
    return state;
  }
  
  if (state.extractedContent.size >= state.maxPages) {
    console.log(`🏁 [ProcessNextUrl] Reached maximum pages (${state.maxPages}), preparing to finish`);
    state.finalOutput = prepareOutput(state);
    return state;
  }
  
  // Get the next URL from the queue
  const nextItem = state.pageQueue.dequeue();
  
  if (!nextItem) {
    console.log(`🏁 [ProcessNextUrl] No items in queue, preparing to finish`);
    state.finalOutput = prepareOutput(state);
    return state;
  }
  
  // Set the current URL
  state.currentUrl = nextItem.url;
  
  console.log(`➡️ [ProcessNextUrl] Selected next URL: ${state.currentUrl} (depth: ${nextItem.depth}, priority: ${nextItem.expectedValue.toFixed(2)})`);
  
  // Send event if configured
  if (state.onEvent) {
    await state.onEvent({
      type: 'workflow-status',
      step: 'process-next-url',
      progress: state.extractedContent.size / state.maxPages,
      message: `Processing URL: ${state.currentUrl}`
    });
  }
  
  return state;
}
```

### 4. Initialize the Workflow with the Starting URL

Update the initial state to include the starting URL in the queue:

```typescript
// Initialize the state with the starting URL already in the queue
const initialState: ExtendedScraperAgentState = {
  // ... other state properties ...
  
  currentUrl: "",  // Start with empty current URL
  visitedUrls: new Set<string>(),
  pageQueue: createPriorityQueue(),
  
  // ... rest of state initialization ...
};

// Add the starting URL to the queue
initialState.pageQueue.enqueue({
  url: options.baseUrl,
  expectedValue: 1.0,  // Highest priority for the starting URL
  depth: 0
}, 1.0);
```

## Benefits of This Approach

1. **No Recursion**: The workflow has a clear linear path with a defined termination condition
2. **Simplified Decision Logic**: Each node has a single responsibility with simpler edges
3. **Maintained Authentication**: Still supports authentication requirements for future use
4. **Better Graph Visualization**: The workflow diagram will be clearer and easier to understand
5. **Same Event System**: Maintains all the current event streaming capabilities

## Implementation Steps

1. Create the new simplified LangGraph workflow structure
2. Implement the new `processNextUrl` and `queueManager` nodes
3. Update the initialization to add the starting URL to the queue
4. Update the edge definitions to follow the linear flow
5. Test with simple websites to verify functionality

## Potential Challenges

1. **URL Queue Management**: Ensuring proper queue management without creating infinite loops
2. **Edge Conditions**: Handling edge cases like authentication failures
3. **State Maintenance**: Ensuring all necessary state is maintained between steps

## Conclusion

This simplified approach maintains the use of LangGraph while eliminating the recursive complexity. The workflow becomes more linear and predictable, with clear entry and exit points, making it easier to debug and less likely to hit recursion limits. 