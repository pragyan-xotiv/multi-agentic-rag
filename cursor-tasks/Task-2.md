## 🧩 Refactor Scraper to Batch Processing Architecture

---

## 🎯 Objective
Refactor the non-recursive scraper implementation to use a batch processing architecture instead of a continuous loop workflow to avoid hitting LangGraph's recursion limit. This will prevent the `GraphRecursionError` and ensure the scraper can process sites with many pages without terminating prematurely.

---

## 🔧 Steps to Implement

1. Modify `src/lib/agents/scraper-new/workflow.ts` to handle single-URL processing:
   - Remove the edge from queueManager back to processNextUrl
   - Add a definite END node after a single URL is processed
   - Ensure state for a single URL is properly isolated

2. Create a new orchestrator module `src/lib/agents/scraper-new/orchestrator.ts`:
   - Implement an external queue management system
   - Create a function to process URLs in batches
   - Maintain global state (visited URLs, extracted content)
   - Track termination conditions outside the workflow

3. Update `src/lib/agents/scraper-new/index.ts`:
   - Modify the ScraperAgent class to use the new orchestrator
   - Update the API interface to support batch processing
   - Maintain backward compatibility with existing API calls

4. Enhance `src/app/api/scraper/non-recursive/route.ts`:
   - Add support for processing status updates between batches
   - Ensure the event stream stays open during batch transitions
   - Implement proper error handling for batch-oriented processing

5. Add utility functions for state persistence:
   - Create methods to serialize/deserialize workflow state
   - Implement progress tracking across multiple workflow invocations
   - Add functionality to pause/resume scraping operations

---

## 🧪 Validation Criteria

- The scraper successfully processes multiple pages without hitting recursion limits
- Each URL is processed exactly once
- The workflow terminates properly after processing all URLs or reaching maxPages
- Proper events are sent to the client throughout the batch processing
- Performance is maintained or improved compared to the current implementation
- All extracted content is correctly collected and returned in the final output
- Processing can be paused and resumed if needed

---

## 📝 Notes

This architectural change addresses the fundamental issue in our workflow design rather than simply increasing recursion limits. By processing URLs in controlled batches and maintaining state externally, we create a more resilient system that can handle large websites without hitting LangGraph's internal limits.

The batch processing approach also opens up future possibilities for distributed processing, where multiple workers could process different URLs in parallel. 