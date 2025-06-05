## 🧩 Migrate from Legacy Scraper to New Scraper Implementation

---

## 🎯 Objective
Replace all usages of the old scraper agent (`@/lib/agents/scraper`) with the new scraper agent (`@/lib/agents/scraper-new`) throughout the codebase to facilitate the deprecation of the legacy implementation.

---

## 🔧 Steps to Implement
1. Update API routes that use the old scraper:
   - Modify `src/app/api/scraper/stream/route.ts` to use the new scraper implementation
   - Ensure any type imports are updated to use the new scraper's type definitions

2. Update test files to use the new scraper:
   - Refactor `src/tests/scraper-integration.test.ts`
   - Refactor `src/tests/scraper-workflow.test.ts` 
   - Refactor `src/tests/scraper-chains.test.ts`
   - Refactor `src/tests/scraper-agent.test.ts`

3. Update chain implementations that import from the old scraper:
   - Update `src/lib/chains/content-extraction-chain/index.ts`
   - Update `src/lib/chains/navigation-decision-chain/index.ts`
   - Update `src/lib/chains/link-discovery-chain/index.ts`
   - Update `src/lib/chains/progress-evaluation-chain/index.ts`
   - Update `src/lib/chains/url-analysis-chain/index.ts`
   - Update `src/lib/chains/authentication-detection-chain/index.ts`

4. Update example usage:
   - Refactor `src/examples/scraper-agent-usage.ts`

5. Remove dependency on old scraper in the new implementation:
   - Modify `src/lib/agents/scraper-new/core/browser-interface.ts` to remove the import from `../../scraper/core/browser-interface`
   - Implement a standalone version of the `fetchPage` function without relying on the old scraper
   - Test to ensure the new implementation works correctly

6. Update any remaining references:
   - Check `src/app/api/test-fetch/route.ts` that uses browser interface from old scraper

7. Update documentation and README files:
   - Ensure all documentation refers to the new scraper implementation
   - Add deprecation notices to legacy scraper files

8. Verify all functionality works with the new implementation:
   - Run tests to ensure no regressions
   - Test API routes manually

---

## 🧪 Validation Criteria
- All imports from `@/lib/agents/scraper` are replaced with `@/lib/agents/scraper-new`
- The new scraper implementation has no dependencies on the old scraper
- All tests pass with the new scraper implementation
- API routes function correctly with the new implementation
- No runtime errors occur when using the scraper functionality
- Documentation accurately reflects the current implementation

---

## 📝 Notes
- Some core functionality might need to be mapped differently between the old and new implementations
- Pay special attention to type differences between the two implementations
- Consider adding a deprecation warning if any code still tries to import from the old scraper path
- The `fetchPage` function in the new scraper currently relies on the old implementation; this dependency needs to be removed by either copying the implementation or creating a new one 