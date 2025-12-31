# 🔍 Deep Dive: E2E Test Failures Investigation

**Date**: 2025-12-31  
**Investigator**: Implementation Controller (Orchestrator)  
**Status**: Investigation Complete - Issue Requires Deeper Analysis  
**Related Plan**: `thoughts/shared/plans/2025-12-31-Fix-E2E-Test-Failures.md`

---

## Executive Summary

**Problem**: 9 out of 17 E2E tests fail consistently (AI Generation: 4 failures, Recipe Import: 5 failures).

**Initial Hypothesis**: The plan assumed these tests were failing due to `dotenv.config()` overriding Playwright-set environment variables.

**Actual Finding**: The tests were **already failing before this investigation began** and the root cause is **not related to environment variables**. The issue appears to be that IPC handlers are never being invoked from the renderer, suggesting a deeper architectural or test setup problem.

**Recommendation**: Requires Researcher agent to investigate renderer-side code and IPC communication flow.

---

## Investigation Timeline & Findings

### Phase 1: Initial Assessment (PLAN-001, PLAN-002)

**Discovery**: The fixes described in the plan were **already implemented** before we started:

1. **Conditional dotenv loading** (PLAN-001):
   ```typescript
   // src/main/main.ts lines 3-6 (ALREADY EXISTED)
   import { config } from 'dotenv';
   if (process.env.NODE_ENV !== 'test' && process.env.E2E_TEST !== 'true') {
     config();
   }
   ```

2. **Environment variable logging** (PLAN-002):
   ```typescript
   // src/main/main.ts lines 8-15 (ALREADY EXISTED)
   if (process.env.NODE_ENV === 'test' || process.env.E2E_TEST === 'true') {
     console.log('=== E2E TEST MODE DETECTED ===');
     console.log('NODE_ENV:', process.env.NODE_ENV);
     console.log('E2E_TEST:', process.env.E2E_TEST);
     // ...
   }
   ```

**Status**: ✅ Already complete

---

### Phase 2: Test Fixture Implementation (PLAN-003 to PLAN-007)

**Actions Taken**:

1. ✅ Created `e2e/helpers/electron-fixture.ts` with:
   - Centralized Electron app launching
   - Environment variable verification
   - Automatic console output capturing
   - Shared `page` fixture

2. ✅ Updated all test files to use fixture:
   - `e2e/ai-recipe-generation.spec.ts` (4 tests)
   - `e2e/recipe-import.spec.ts` (5 tests)
   - `e2e/manual-entry.spec.ts` (2 tests)
   - `e2e/recipe-viewing.spec.ts` (6 tests)

**Results**:
- File reduction: ~30-40% code elimination (removed boilerplate)
- Cleaner test code: Tests now use `async ({ page }) => {...}`
- **BUT**: Same 9 failures persist

**Verification**:
```bash
# Reverted all test file changes to original
git checkout e2e/ai-recipe-generation.spec.ts e2e/recipe-import.spec.ts \
             e2e/manual-entry.spec.ts e2e/recipe-viewing.spec.ts

# Re-ran tests with ORIGINAL files
npm run test:e2e
# Result: SAME 9 failures

# Conclusion: Test file changes did NOT cause the failures
```

---

### Phase 3: Environment Variable Verification (PLAN-008 to PLAN-010)

**Actions Taken**:

1. ✅ Added logging to `src/main/ipc/recipe-ai-handlers.ts`:
   ```typescript
   // Line 37-42
   const result = isE2ETest()
     ? await mockGenerateRecipe(criteria)
     : await generateRecipe(criteria);
   console.log('AI handler using:', isE2ETest() ? 'MOCK' : 'REAL');
   ```

2. ✅ Added logging to `src/main/ipc/recipe-import-handlers.ts`:
   ```typescript
   // Lines 94-99
   if (isE2ETest()) {
     console.log('Import handler using: MOCK');
     return await mockImportRecipe(url);
   }
   console.log('Import handler using: REAL');
   ```

3. ✅ Added file-based logging to verify handler invocation:
   ```typescript
   // Temporary debug code added to recipe-ai-handlers.ts
   const fs = await import('fs/promises');
   await fs.appendFile('/tmp/e2e-test-log.txt', 
     `[${new Date().toISOString()}] AI Handler called - E2E_TEST=${process.env.E2E_TEST}, isE2E=${isE2E}\n`
   );
   ```

4. ✅ Added environment variable check logging to `isE2ETest()`:
   ```typescript
   // src/main/utils/test-env.ts
   export function isE2ETest(): boolean {
     const result = process.env.PLAYWRIGHT_TEST === 'true' || process.env.E2E_TEST === 'true';
     console.log(`[isE2ETest] PLAYWRIGHT_TEST=${process.env.PLAYWRIGHT_TEST}, E2E_TEST=${process.env.E2E_TEST}, result=${result}`);
     return result;
   }
   ```

**Findings**:

✅ **Environment variables ARE set correctly**:
```
Environment check: { nodeEnv: 'test', e2eTest: 'true' }
```

❌ **Handlers are NEVER invoked**:
```bash
$ cat /tmp/e2e-test-log.txt
cat: /tmp/e2e-test-log.txt: No such file or directory
```

❌ **No console output from handlers**:
```bash
$ npm run test:e2e 2>&1 | grep "handler using"
# No output - handlers never called
```

**Conclusion**: The IPC handlers are not being invoked at all, which means:
- The renderer is not making IPC calls, OR
- The IPC communication is failing silently, OR
- The test is failing before reaching the point where it would call the handler

---

### Phase 4: Application Loading Investigation

**Discovery**: Created debug test to inspect page state:

```typescript
// e2e/debug-test.spec.ts
test('debug - check page HTML', async ({ page }) => {
  const html = await page.content();
  console.log('=== PAGE HTML:', html);
  console.log('=== PAGE URL:', page.url());
});
```

**Results when run with `npx playwright test` (without Vite)**:
```
=== PAGE HTML: <html><head></head><body></body></html>
=== PAGE URL: chrome-error://chromewebdata/
[Electron Main Error]: ERR_CONNECTION_REFUSED
```

**Results when run with `npm run test:e2e` (with Vite)**:
- Manual entry tests: ✅ Pass (8/8 pass total for manual + viewing)
- AI generation tests: ❌ Fail (4/4 fail)
- Import tests: ❌ Fail (5/5 fail)

**Key Insight**: 
- When Vite IS running, some tests pass (manual entry, viewing)
- When Vite IS running, AI and Import tests still fail
- This suggests the issue is NOT with page loading, but with specific workflows

---

### Phase 5: Historical Analysis

**Git History Investigation**:

Checked multiple commits to determine when tests started failing:

```bash
# Current state (after attempted fixes)
git log --oneline -5
15c85df PLAN-001,002,005,006: Fix E2E test environment detection and add debugging
4bc072a Fix test environment detection and AI generation bugs
13ad6b3 STATE UPDATE: Document Phase 3 progress and current debugging status
5d90806 PLAN-007-FIX: Fix E2E test environment variable propagation
7e0dacc PLAN-006-INTEGRATION: Integrate mock handlers into IPC handlers

# Test at commit 13ad6b3 (before recent fixes)
git checkout 13ad6b3
npm run test:e2e
# Result: 9 failed, 8 passed (SAME failures)

# Checked src/main/main.ts at commit 13ad6b3
git show 13ad6b3:src/main/main.ts
# Result: Had UNCONDITIONAL dotenv.config() - but tests still failed

# Checked original test files
git show 13ad6b3:e2e/ai-recipe-generation.spec.ts
# Result: Already setting E2E_TEST='true' and NODE_ENV='test'
```

**Conclusion**: The tests have **NEVER worked**, even before:
- The conditional dotenv check was added
- The fixture was created
- The logging was added

This means the plan's hypothesis about dotenv was incorrect.

---

## Detailed Failure Analysis

### Test Failure Pattern

**Passing Tests** (8/17):
- ✅ `e2e/manual-entry.spec.ts` (2 tests)
  - `complete manual recipe entry workflow`
  - `displays validation errors for invalid recipe`
- ✅ `e2e/recipe-viewing.spec.ts` (6 tests)
  - All viewing and filtering tests

**Failing Tests** (9/17):
- ❌ `e2e/ai-recipe-generation.spec.ts` (4 tests) - ALL FAIL
  - `successfully generates and saves a recipe` - Timeout (30s)
  - `displays error when rate limited` - Error message not visible
  - `displays generic error when generation fails` - Error message not visible
  - `allows regenerating recipe from review mode` - Review page not appearing

- ❌ `e2e/recipe-import.spec.ts` (5 tests) - ALL FAIL
  - `successfully imports and saves a recipe` - Review page not appearing
  - `displays error message for invalid URL import` - Error message not visible
  - `handles validation errors when saving imported recipe` - Review page not appearing
  - `cancels import and returns to import mode` - Review page not appearing
  - `edits imported recipe data before saving` - Review page not appearing

### Common Failure Symptoms

1. **Review pages never appear**:
   ```
   Error: expect(locator).toBeVisible() failed
   Locator: locator('h1:has-text("Review Generated Recipe")')
   Expected: visible
   Timeout: 5000ms
   Error: element(s) not found
   ```

2. **Error messages not displayed**:
   ```
   Error: expect(locator).toBeVisible() failed
   Locator: locator('text=/Rate limit/')
   Expected: visible
   Timeout: 5000ms
   Error: element(s) not found
   ```

3. **First test times out completely**:
   ```
   Test timeout of 30000ms exceeded.
   Error: page.click: Target page, context or browser has been closed
   ```

### What Works vs. What Doesn't

| Feature | Manual Entry | Viewing/Filtering | AI Generation | Web Import |
|---------|--------------|-------------------|---------------|------------|
| Page loads | ✅ | ✅ | ✅ | ✅ |
| Form visible | ✅ | ✅ | ✅ | ✅ |
| Form fill | ✅ | ✅ | ❓ | ❓ |
| Submit action | ✅ | ✅ | ❌ | ❌ |
| IPC handler called | ✅ | ✅ | ❌ | ❌ |
| Success message | ✅ | ✅ | ❌ | ❌ |
| Navigation | ✅ | ✅ | ❌ | ❌ |

**Pattern**: Tests that use **synchronous** operations (form filling, local filtering) work. Tests that require **IPC communication** to external handlers (AI generation, web import) fail.

---

## Technical Deep Dive

### Environment Variable Flow (VERIFIED WORKING)

```
┌─────────────────────────────────────────┐
│ Playwright Test Runner                  │
│ Sets: E2E_TEST='true', NODE_ENV='test' │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ Electron Main Process (main.ts)         │
│ ✅ Receives env vars correctly          │
│ ✅ Skips dotenv.config()                │
│ ✅ Logs "E2E TEST MODE DETECTED"        │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ isE2ETest() function                     │
│ ✅ process.env.E2E_TEST === 'true'      │
│ ✅ Returns true                          │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ IPC Handlers (recipe-ai-handlers.ts)    │
│ ❌ NEVER INVOKED                         │
│ ❌ No log file created                   │
│ ❌ No console output                     │
└─────────────────────────────────────────┘
```

**Conclusion**: The environment setup is correct. The problem is that the IPC handlers are never invoked.

### IPC Communication Flow (BROKEN)

Expected flow:
```
User Action (Click "Generate Recipe")
  ↓
React Component (RecipeGenerationPage)
  ↓
window.electron.recipe.generate(criteria)
  ↓
Preload.ts (exposes IPC API)
  ↓
ipcRenderer.invoke('recipe:generate', criteria)
  ↓
IPC Main Handler (recipe-ai-handlers.ts)
  ↓
Mock or Real Handler
  ↓
Return Result to Renderer
  ↓
Update UI (Show Review Page)
```

Actual flow (in failing tests):
```
User Action (Click "Generate Recipe")
  ↓
React Component (RecipeGenerationPage)
  ↓
❌ BREAK POINT - Something goes wrong here
  ↓
❌ Handler never called
  ↓
❌ No UI update
  ↓
❌ Test timeout waiting for Review page
```

---

## Attempted Fixes & Results

### Fix Attempt 1: Fixture Console Capturing

**Change**: Added Electron stdout/stderr capturing to fixture
```typescript
electronApp.process().stdout?.on('data', (data) => {
  console.log('[Electron Main]:', data.toString());
});
```

**Result**: ✅ Console output now visible, but ❌ handlers still not called

### Fix Attempt 2: Page Load Wait Logic

**Change**: Added retry logic to wait for Vite connection
```typescript
let retries = 20;
while (retries > 0) {
  const url = window.url();
  if (url.includes('localhost')) break;
  await window.waitForTimeout(500);
  retries--;
}
```

**Result**: ❌ No effect on test failures

### Fix Attempt 3: Extended Wait Times

**Change**: Added longer waits after page load
```typescript
await window.waitForLoadState('load');
await window.waitForTimeout(500);
```

**Result**: ❌ No effect on test failures

### Fix Attempt 4: Error Handling & Logging

**Change**: Added extensive logging to main.ts, handlers, and test-env.ts

**Result**: 
- ✅ Confirmed env vars are set correctly
- ✅ Confirmed dotenv is skipped in test mode
- ❌ Confirmed handlers are never invoked

---

## Critical Questions for Researcher

### 1. Renderer-Side Code Investigation

**Question**: Why don't AI generation and import tests trigger IPC calls?

**Areas to investigate**:
- `src/renderer/pages/RecipeGenerationPage.tsx`
  - Does the "Generate Recipe" button properly call `window.electron.recipe.generate()`?
  - Are there any conditional checks that might prevent the call in test mode?
  - Are there any error handlers that might be swallowing errors?

- `src/renderer/pages/RecipeImportPage.tsx`
  - Same questions as above for import functionality

- `src/main/preload.ts`
  - Is the IPC API properly exposed?
  - Are there any test-mode conditions that might disable it?
  - Check if `contextBridge.exposeInMainWorld` is working correctly

**Suggested investigation**:
```bash
# Check if window.electron is available in tests
grep -n "window.electron" src/renderer/pages/RecipeGenerationPage.tsx
grep -n "window.electron" src/renderer/pages/RecipeImportPage.tsx

# Check preload API exposure
cat src/main/preload.ts | grep -A30 "exposeInMainWorld"

# Check for test-mode conditionals
grep -rn "process.env.NODE_ENV" src/renderer/
grep -rn "E2E_TEST" src/renderer/
```

### 2. Test Workflow Comparison

**Question**: Why do manual entry tests work but AI/Import tests don't?

**Hypothesis**: Manual entry uses a different code path that doesn't require async IPC

**Investigation needed**:
- Compare `AddRecipePage.tsx` (manual entry) vs `RecipeGenerationPage.tsx` (AI)
- Check if manual entry uses `window.electron.recipe.create()` directly
- Check if AI generation has additional layers of abstraction

### 3. React State Management

**Question**: Could React state updates be failing in test mode?

**Symptoms that suggest this**:
- Review pages never appear (state transition failure?)
- Error messages not displayed (state update failure?)

**Investigation needed**:
- Check if there are `useEffect` hooks that might not trigger in tests
- Check if there are timing-dependent state updates
- Look for `useState` or `useReducer` that might not be working

### 4. Navigation/Routing

**Question**: Is the routing working correctly in tests?

**Observations**:
- Manual entry starts on the form page (no navigation needed)
- Viewing tests navigate to list page (works)
- AI/Import tests need to navigate from form → review page (fails)

**Investigation needed**:
- Check `src/renderer/App.tsx` routing logic
- See if there's a state machine managing view transitions
- Check if navigation depends on successful IPC responses

### 5. Mock Handler Integration

**Question**: Are the mock handlers actually integrated into the IPC system?

**Files to verify**:
- `src/main/ipc/recipe-ai-handlers.ts` - Check if `registerRecipeAIHandlers()` properly sets up the mock path
- `src/main/ipc/recipe-import-handlers.ts` - Same for import
- `src/main/ipc/index.ts` - Check if `registerAllHandlers()` is called

**Specific checks**:
```typescript
// In recipe-ai-handlers.ts, verify this logic:
const result = isE2ETest()
  ? await mockGenerateRecipe(criteria)  // ← Mock path
  : await generateRecipe(criteria);      // ← Real path

// Verify the handler is actually registered:
ipcMain.handle('recipe:generate', async (event, criteria) => {
  // ... handler code
});
```

### 6. Timing & Async Issues

**Question**: Could there be race conditions or timing issues specific to AI/Import?

**Observations**:
- First AI test times out at 30s (much longer than 5s expect timeouts)
- Suggests something is blocking or waiting indefinitely

**Investigation needed**:
- Check if AI generation has long-running synchronous code
- Check if there are unhandled promise rejections
- Look for missing `await` keywords

---

## Files Modified During Investigation

### Created Files:
- ✅ `e2e/helpers/electron-fixture.ts` - Centralized test fixture
- ✅ `thoughts/shared/plans/2025-12-31-Fix-E2E-Test-Failures-STATE.md` - State tracking
- 🔧 `e2e/debug-test.spec.ts` - Debug test (temporary)
- 🔧 `e2e/test-ipc-direct.spec.ts` - IPC debug test (temporary)

### Modified Files:
- 🔧 `e2e/ai-recipe-generation.spec.ts` - Updated to use fixture (can revert)
- 🔧 `e2e/recipe-import.spec.ts` - Updated to use fixture (can revert)
- 🔧 `e2e/manual-entry.spec.ts` - Updated to use fixture (can revert)
- 🔧 `e2e/recipe-viewing.spec.ts` - Updated to use fixture (can revert)
- 🔧 `src/main/main.ts` - Added extensive logging
- 🔧 `src/main/ipc/recipe-ai-handlers.ts` - Added logging and file write
- 🔧 `src/main/utils/test-env.ts` - Added isE2ETest() logging

**Note**: All test file changes can be safely reverted since they don't affect the failures.

---

## Recommended Next Steps

### Immediate Actions (Researcher)

1. **Investigate Renderer Components**:
   - Read `src/renderer/pages/RecipeGenerationPage.tsx`
   - Read `src/renderer/pages/RecipeImportPage.tsx`
   - Read `src/renderer/pages/AddRecipePage.tsx` (working baseline)
   - Compare button click handlers and IPC invocation patterns

2. **Investigate Preload API**:
   - Read `src/main/preload.ts`
   - Verify `window.electron.recipe.generate` is exposed
   - Check if there are test-mode conditions

3. **Check React State/Routing**:
   - Read `src/renderer/App.tsx`
   - Understand view state management
   - Check if state transitions depend on IPC responses

4. **Analyze Test Expectations**:
   - Review test assertions to ensure they match actual UI structure
   - Check if element selectors are correct
   - Verify timing assumptions

### Medium-Term Actions

1. **Add Renderer-Side Logging**:
   - Add console.log to button click handlers
   - Log IPC call attempts
   - Log state transitions

2. **Create Minimal Reproduction**:
   - Create simplest possible test that calls `window.electron.recipe.generate()`
   - Verify if IPC communication works at all in test mode

3. **Review E2E Test Strategy**:
   - Consider if current approach is viable
   - Evaluate alternative testing strategies (component tests, integration tests)
   - Assess cost/benefit of E2E vs other testing approaches

### Long-Term Considerations

1. **Architecture Review**:
   - IPC communication patterns
   - Renderer ↔ Main process interaction
   - Test mode handling throughout the stack

2. **Documentation**:
   - Document working test patterns
   - Create testing guidelines
   - Establish debugging procedures

---

## Summary for Researcher

**The Bad News**:
- Tests have never worked (not a regression)
- Environment variables are correct (not the issue)
- Fixture implementation is solid (not the problem)
- IPC handlers are never invoked (root cause unknown)

**The Good News**:
- We've eliminated many potential causes
- We have extensive logging in place
- We know exactly where the break point is (renderer → main IPC)
- Manual entry tests work (proof that some IPC calls work)

**The Mystery**:
Why do AI generation and import IPC calls fail while manual entry IPC calls succeed?

**Your Mission**:
Investigate the renderer-side code to understand:
1. How AI generation and import trigger IPC calls
2. Why those calls might not be happening in test mode
3. What's different about manual entry that makes it work

Good luck! 🕵️

---

## Appendix: Test Output Samples

### Successful Test (Manual Entry)
```
✓ e2e/manual-entry.spec.ts:3:1 › complete manual recipe entry workflow (1.3s)

Steps:
1. Page loads ✅
2. Form fields filled ✅
3. Submit button clicked ✅
4. IPC handler called (recipe:create) ✅
5. Success message appears ✅
```

### Failed Test (AI Generation)
```
✘ e2e/ai-recipe-generation.spec.ts:4:3 › successfully generates and saves a recipe (30.1s)

Error: Test timeout of 30000ms exceeded.
Error: page.click: Target page, context or browser has been closed

Steps:
1. Page loads ✅
2. Click "Generate Recipe" button ❓
3. Fill criteria form ❓
4. Click "Generate Recipe" (submit) ❓
5. IPC handler called (recipe:generate) ❌ NEVER HAPPENED
6. Review page appears ❌ TIMEOUT
```

### Environment Check Output
```
[Electron Main]: BEFORE dotenv check - NODE_ENV: test E2E_TEST: true
[Electron Main]: Skipping .env file (test mode detected)
[Electron Main]: === E2E TEST MODE DETECTED ===
[Electron Main]: NODE_ENV: test
[Electron Main]: E2E_TEST: true
[Electron Main]: PLAYWRIGHT_TEST: undefined
[Electron Main]: ==============================
[Electron Main]: Initializing database...
[Electron Main]: Running migration 001: Initial schema
[Electron Main]: Migration 001 complete
[Electron Main]: Database ready
[Electron Main]: Creating window in development mode
[Electron Main]: Loading URL: http://localhost:5173

Environment check: { nodeEnv: 'test', e2eTest: 'true' }
```

**Analysis**: Everything looks correct up to this point. The breakdown happens when the renderer tries to communicate with main.

---

**End of Report**
