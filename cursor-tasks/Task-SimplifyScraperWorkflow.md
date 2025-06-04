## 🧩 Implement New Non-Recursive Scraper Agent

---

## 🎯 Objective
Create a new scraper agent implementation with a simplified, non-recursive LangGraph workflow in a separate folder to avoid disrupting the existing functionality. The new implementation will focus on solving the recursion problem first, while maintaining the same API interface for easy integration with the controller.

---

## 🔧 Steps to Implement

1. Create a new `scraper-new` directory in `src/lib/agents/`:
   - Copy and refactor the necessary type definitions and interfaces from the existing scraper
   - Set up the basic file structure (index.ts, workflow.ts, types.ts, state.ts)

2. Implement the simplified workflow structure in `src/lib/agents/scraper-new/workflow.ts`:
   - Create the `processNextUrl` node to handle URL queue management
   - Create the `queueManager` node to manage the queue and check termination conditions
   - Reuse existing nodes for content processing (fetchPage, extractContent, etc.) with minimal changes

3. Design a linear graph flow:
   - Implement the `createScraperWorkflow` function with the simplified structure
   - Use clear conditional edges with explicit termination conditions
   - Create a loop from queueManager back to processNextUrl with proper exit conditions

4. Create the main agent interface in `src/lib/agents/scraper-new/index.ts`:
   - Implement the `ScraperAgent` class with the same public API as the current one
   - Create methods for `scrape` and `streamScraping` that use the new workflow
   - Ensure backward compatibility with the existing controller integration

5. Implement state initialization:
   - Set up the initial state with the starting URL in the queue
   - Begin with an empty currentUrl
   - Initialize all necessary state properties

6. Update event handling:
   - Maintain all existing event types
   - Add appropriate events for the new nodes

7. Integrate with the controller:
   - Update the controller's import paths to support both the old and new scraper
   - Add a configuration option to choose between implementations
   - Ensure the controller can use the new scraper without API changes

8. Test the implementation:
   - Start with simple websites
   - Verify the workflow terminates properly
   - Ensure the basic scraping functionality works correctly
   - Compare results with the original implementation

---

## 🧪 Validation Criteria

- The new scraper completes without hitting recursion limits
- All pages are correctly scraped up to the specified maximum
- Event streaming capabilities work the same as the original implementation
- The workflow graph is simpler and more linear when visualized
- The controller can use the new scraper with minimal changes
- Existing functionality (URL normalization, content extraction, etc.) is preserved
- Both implementations can coexist until the new one is fully tested

---

## 📝 Notes

- Keep using the same LangChain and LangGraph libraries
- Maintain full compatibility with the existing API for controller integration
- Focus on creating a cleaner workflow structure, not changing the core scraping functionality
- Authentication handling should be included in the structure but can be simplified initially
- Copy necessary utility functions to avoid cross-dependencies between implementations
- The implementation should follow the approach described in NON_RECURSIVE_APPROACH.md
- Document key improvements and differences between the implementations 