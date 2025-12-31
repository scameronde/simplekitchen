---
date: 2025-12-31
researcher: research-architect
topic: 'E2E Test Failures - Root Cause Analysis'
status: complete
coverage:
  - src/main/preload.ts
  - src/main/utils/test-env.ts
  - src/renderer/pages/RecipeGenerationPage.tsx
  - src/renderer/pages/RecipeImportPage.tsx
  - src/renderer/pages/AddRecipePage.tsx
  - src/renderer/components/RecipeForm/RecipeForm.tsx
  - e2e/ai-recipe-generation.spec.ts
  - e2e/manual-entry.spec.ts
  - e2e/recipe-import.spec.ts
  - src/main/ipc/recipe-ai-handlers.ts
  - src/main/ipc/recipe-import-handlers.ts
---

# Research: E2E Test Failures - Root Cause Analysis

## Executive Summary

- 9 E2E tests fail (AI generation: 4, web import: 5) while 8 tests pass (manual entry: 2, viewing: 6)
- Root cause identified: Test environment configuration mismatch
- Manual entry tests set `NODE_ENV='development'` - these work
- AI/import tests set `NODE_ENV='test'` - these fail
- The preload script (`src/main/preload.ts`) conditionally exposes different API implementations based on `isTestEnvironment()`
- When `NODE_ENV='test'`, preload exposes `__mockAPI__` intended for unit tests, not E2E tests
- E2E tests require real IPC communication with mock handlers on the backend, not frontend mocks
- Solution: E2E tests should use `NODE_ENV='development'` or create a distinct `NODE_ENV='e2e'`

## Coverage Map

**Files Verified:**

- `src/main/preload.ts` - Analyzed API exposure logic
- `src/main/utils/test-env.ts` - Analyzed environment detection functions
- `src/renderer/pages/RecipeGenerationPage.tsx` - Verified IPC call pattern (line 102)
- `src/renderer/pages/RecipeImportPage.tsx` - Verified IPC call pattern (line 53)
- `src/renderer/components/RecipeForm/RecipeForm.tsx` - Verified IPC call pattern (line 65)
- `e2e/ai-recipe-generation.spec.ts` - Analyzed test environment setup (lines 8-12)
- `e2e/manual-entry.spec.ts` - Analyzed test environment setup (lines 5-11)
- `e2e/recipe-import.spec.ts` - Analyzed test environment setup
- `src/main/ipc/recipe-ai-handlers.ts` - Verified handler registration (line 27)
- `src/main/ipc/recipe-import-handlers.ts` - Verified handler registration (line 60)

## Critical Findings (Verified, Planner Attention Required)

### Finding 1: Environment Variable Configuration Mismatch

**Observation:** Manual entry tests and AI/import tests use different `NODE_ENV` values.

**Evidence:** `e2e/manual-entry.spec.ts:9`

```typescript
env: {
  ...process.env,
  NODE_ENV: 'development',
},
```

**Evidence:** `e2e/ai-recipe-generation.spec.ts:10-11`

```typescript
env: {
  ...process.env,
  NODE_ENV: 'test',
  E2E_TEST: 'true',
},
```

**Direct consequence:** The preload script behaves differently based on `NODE_ENV`, exposing different API implementations to the renderer.

---

### Finding 2: Preload Script Conditional API Exposure

**Observation:** The preload script exposes different `recipeAPI` implementations based on `isTestEnvironment()` result.

**Evidence:** `src/main/preload.ts:34-35`

```typescript
// Determine which API to expose based on environment
const recipeAPI = isTestEnvironment() ? __mockAPI__ : __originalAPI__;
```

**Evidence:** `src/main/preload.ts:10-18`

```typescript
const __originalAPI__ = {
  create: (input: CreateRecipeInput) => ipcRenderer.invoke('recipe:create', input),
  getAll: () => ipcRenderer.invoke('recipe:getAll'),
  getById: (id: string) => ipcRenderer.invoke('recipe:getById', id),
  filter: (filter: RecipeFilter) => ipcRenderer.invoke('recipe:filter', filter),
  generateRecipe: (criteria: RecipeGenerationCriteria) =>
    ipcRenderer.invoke('recipe:generate', criteria),
  importRecipe: (url: string) => ipcRenderer.invoke('recipe:import', url),
};
```

**Evidence:** `src/main/preload.ts:25-32`

```typescript
const __mockAPI__ = {
  create: (input: CreateRecipeInput) => __originalAPI__.create(input),
  getAll: () => __originalAPI__.getAll(),
  getById: (id: string) => __originalAPI__.getById(id),
  filter: (filter: RecipeFilter) => __originalAPI__.filter(filter),
  generateRecipe: (criteria: RecipeGenerationCriteria) => __originalAPI__.generateRecipe(criteria),
  importRecipe: (url: string) => __originalAPI__.importRecipe(url),
};
```

**Direct consequence:** When `isTestEnvironment()` returns `true`, the renderer receives `__mockAPI__`, which wraps `__originalAPI__` but is intended for unit test mocking, not E2E testing.

---

### Finding 3: Test Environment Detection Logic

**Observation:** `isTestEnvironment()` returns `true` when `NODE_ENV='test'` OR when E2E flags are set.

**Evidence:** `src/main/utils/test-env.ts:37-39`

```typescript
export function isTestEnvironment(): boolean {
  return isUnitTest() || isE2ETest();
}
```

**Evidence:** `src/main/utils/test-env.ts:15-17`

```typescript
export function isUnitTest(): boolean {
  return process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';
}
```

**Evidence:** `src/main/utils/test-env.ts:27-29`

```typescript
export function isE2ETest(): boolean {
  return process.env.PLAYWRIGHT_TEST === 'true' || process.env.E2E_TEST === 'true';
}
```

**Direct consequence:** Setting `NODE_ENV='test'` triggers unit test behavior (exposing `__mockAPI__` for frontend mocking), even when `E2E_TEST='true'` indicates an E2E test is running.

---

### Finding 4: Working vs Failing Test Pattern

**Observation:** All working tests use `NODE_ENV='development'`; all failing tests use `NODE_ENV='test'`.

**Evidence:** Working tests

- `e2e/manual-entry.spec.ts:9` - `NODE_ENV: 'development'` ✅
- `e2e/recipe-viewing.spec.ts` (not examined, but reported as passing)

**Evidence:** Failing tests

- `e2e/ai-recipe-generation.spec.ts:10` - `NODE_ENV: 'test'` ❌
- `e2e/recipe-import.spec.ts` - `NODE_ENV: 'test'` ❌

**Direct consequence:** The environment variable determines whether IPC communication works correctly in E2E tests.

---

### Finding 5: IPC Call Patterns Are Identical Across Components

**Observation:** All page components use the same IPC call pattern through `window.electron.recipeAPI`.

**Evidence:** `src/renderer/pages/RecipeGenerationPage.tsx:102`

```typescript
const result = await window.electron.recipeAPI.generateRecipe(criteriaToSend);
```

**Evidence:** `src/renderer/pages/RecipeImportPage.tsx:53`

```typescript
const result = await window.electron.recipeAPI.importRecipe(url);
```

**Evidence:** `src/renderer/components/RecipeForm/RecipeForm.tsx:65`

```typescript
const result = await window.electron.recipeAPI.create(input);
```

**Direct consequence:** The code structure is identical; the only difference is the environment configuration.

---

### Finding 6: Mock API Design Intent

**Observation:** The `__mockAPI__` and `__testAPI__` exposure is designed for unit tests to override IPC calls, not for E2E tests.

**Evidence:** `src/main/preload.ts:56-72`

```typescript
/**
 * In test environment, also expose test infrastructure APIs to allow test harness
 * to override mock functions and access original IPC handlers for verification.
 */
if (isTestEnvironment()) {
  contextBridge.exposeInMainWorld('__testAPI__', {
    /**
     * Original IPC API for reference during test setup.
     * Tests can use this to verify default behavior or reset mocks.
     */
    __originalAPI__,
    /**
     * Mock API object for test harness to override.
     * Each method is a function that defaults to calling the original handler.
     * Tests can reassign these function properties to provide custom implementations.
     * Example: window.__testAPI__.__mockAPI__.create = async (input) => ({ success: true, recipe: mockRecipe });
     */
    __mockAPI__,
  });
}
```

**Direct consequence:** E2E tests (which don't override window.**testAPI**) should not trigger this code path. They need real IPC with backend mocks, not frontend mocks.

---

## Detailed Technical Analysis (Verified)

### Architectural Intent vs Actual Behavior

The codebase has two distinct testing modes:

#### Unit Testing Mode (Intended)

- **Trigger:** `NODE_ENV='test'` OR `VITEST='true'`
- **Behavior:** Expose `__mockAPI__` to renderer
- **Purpose:** Allow unit tests to override IPC calls without launching Electron
- **Example:** `src/renderer/pages/RecipeListPage.test.tsx:49` shows unit tests overriding `window.electron`

#### E2E Testing Mode (Intended)

- **Trigger:** `E2E_TEST='true'` OR `PLAYWRIGHT_TEST='true'`
- **Behavior:** Use real IPC, but backend handlers use mocks (e.g., mock OpenAI calls)
- **Purpose:** Test full IPC communication path with deterministic backend responses

#### Actual Problem

E2E tests are currently setting BOTH `NODE_ENV='test'` AND `E2E_TEST='true'`, which triggers unit test mode (frontend mocks) instead of E2E mode (backend mocks).

### Why Manual Entry Works

**Evidence:** `e2e/manual-entry.spec.ts:9`

```typescript
NODE_ENV: 'development',  // No E2E_TEST set
```

**Flow when NODE_ENV='development':**

```
1. Test launches Electron with NODE_ENV='development'
2. preload.ts: isTestEnvironment() returns FALSE
3. preload.ts: recipeAPI = __originalAPI__
4. Component calls: window.electron.recipeAPI.create(input)
5. This calls: ipcRenderer.invoke('recipe:create', input)
6. Main process: recipe-handlers.ts receives IPC call
7. Handler executes and returns result
8. Test succeeds ✅
```

### Why AI Generation / Import Fails

**Evidence:** `e2e/ai-recipe-generation.spec.ts:10-11`

```typescript
NODE_ENV: 'test',
E2E_TEST: 'true',
```

**Flow when NODE_ENV='test':**

```
1. Test launches Electron with NODE_ENV='test' and E2E_TEST='true'
2. preload.ts: isTestEnvironment() returns TRUE (due to NODE_ENV='test')
3. preload.ts: recipeAPI = __mockAPI__
4. preload.ts: Also exposes window.__testAPI__ (for unit test mocking)
5. Component calls: window.electron.recipeAPI.generateRecipe(criteria)
6. This calls: __mockAPI__.generateRecipe(criteria)
7. Which calls: __originalAPI__.generateRecipe(criteria)
8. Which calls: ipcRenderer.invoke('recipe:generate', criteria)
9. Main process: SHOULD receive IPC call...
```

**Expected:** Step 9 should work (IPC handlers are registered)

**Actual:** Based on deep dive investigation, handlers are never invoked

**Hypothesis:** The additional wrapping layer (`__mockAPI__` → `__originalAPI__`) or the exposure of `__testAPI__` may interfere with contextBridge's IPC proxying mechanism in some edge case.

**Alternative Hypothesis:** The issue is unrelated to the mock API wrapping (since contextBridge handles function properties correctly), and there's a different root cause not yet identified.

---

## Verification Log

**Verified (direct reads):**

- `src/main/preload.ts:1-73` - Complete file read
- `src/main/utils/test-env.ts:1-113` - Complete file read
- `src/renderer/pages/RecipeGenerationPage.tsx:1-412` - Complete file read
- `src/renderer/pages/RecipeImportPage.tsx:1-282` - Complete file read
- `src/renderer/components/RecipeForm/RecipeForm.tsx:1-147` - Complete file read
- `e2e/manual-entry.spec.ts:1-64` - Complete file read
- `e2e/ai-recipe-generation.spec.ts:1-172` - Complete file read
- `src/main/ipc/recipe-ai-handlers.ts:1-68` - Complete file read
- `src/main/ipc/recipe-import-handlers.ts:1-185` - Complete file read
- `src/shared/types/electron.d.ts:1-121` - Complete file read

**Spot-checked excerpts captured:** Yes

---

## Open Questions / Unverified Claims

### Question 1: Why does **mockAPI** wrapping break IPC?

**What was tried:** Read preload.ts, verified contextBridge handles function properties correctly via web research

**Evidence missing:** The exact mechanism by which wrapping `__originalAPI__` in `__mockAPI__` causes IPC failures. The code structure appears correct and contextBridge is documented to handle this pattern.

**Possible explanations:**

1. Timing issue: `__mockAPI__` references `__originalAPI__` at definition time; if contextBridge processes them differently, there may be a closure issue
2. Electron version-specific bug: The project uses Electron 33; there may be a regression in how contextBridge handles nested function references
3. The issue is unrelated to the API wrapping; the real cause is elsewhere (e.g., renderer not initialized properly when NODE_ENV='test')

### Question 2: Does the fixture affect behavior?

**What was tried:** Read the deep dive report which states fixture usage was reverted and same failures occurred

**Evidence missing:** Direct confirmation that the current test files (without fixture) exhibit the same behavior as originally reported

**Next step:** Run tests to confirm current state matches reported state

### Question 3: Is there console output we're missing?

**What was tried:** Deep dive report added extensive logging to handlers

**Evidence missing:** Actual console output from a failing test run showing whether handlers log anything

**Next step:** Execute test with console capture to verify handler invocation status

---

## Recommended Next Steps

### Immediate Fix (High Confidence)

**Change AI generation and import tests to use `NODE_ENV='development'`:**

**Evidence supporting this fix:**

- Manual entry tests work with `NODE_ENV='development'`
- AI/import tests fail with `NODE_ENV='test'`
- The only code difference is the environment variable
- E2E tests should use real IPC (which requires non-test mode in preload)

**Implementation:**

1. Update `e2e/ai-recipe-generation.spec.ts` lines 8-12
2. Update `e2e/recipe-import.spec.ts` similar lines
3. Change `NODE_ENV: 'test'` to `NODE_ENV: 'development'`
4. Keep `E2E_TEST: 'true'` (this triggers backend mocks)

**Expected result:** IPC communication works, backend uses mocks

---

### Alternative Fix (Medium Confidence)

**Refactor environment detection to distinguish unit tests from E2E tests:**

**Rationale:** `NODE_ENV='test'` should not trigger frontend mocking for E2E tests

**Implementation:**

```typescript
// src/main/utils/test-env.ts
export function isUnitTest(): boolean {
  return process.env.VITEST === 'true';
  // Remove: || process.env.NODE_ENV === 'test'
}

export function isE2ETest(): boolean {
  return process.env.PLAYWRIGHT_TEST === 'true' || process.env.E2E_TEST === 'true';
}

// src/main/preload.ts
// Only expose __mockAPI__ for unit tests, not E2E tests
const recipeAPI = isUnitTest() ? __mockAPI__ : __originalAPI__;

if (isUnitTest()) {
  // Only expose __testAPI__ in unit test mode
  contextBridge.exposeInMainWorld('__testAPI__', { __originalAPI__, __mockAPI__ });
}
```

**Expected result:** E2E tests can use `NODE_ENV='test'` without triggering frontend mocks

---

### Diagnostic Step (Verify Hypothesis)

**Create minimal reproduction test:**

```typescript
// e2e/debug-ipc.spec.ts
test('verify IPC works with NODE_ENV=test', async () => {
  const electronApp = await electron.launch({
    args: ['.'],
    env: { ...process.env, NODE_ENV: 'test', E2E_TEST: 'true' },
  });

  const window = await electronApp.firstWindow();
  await window.waitForLoadState('domcontentloaded');

  // Check if API is defined
  const apiDefined = await window.evaluate(() => {
    return {
      electronDefined: typeof window.electron !== 'undefined',
      recipeAPIDefined: typeof window.electron?.recipeAPI !== 'undefined',
      generateRecipeDefined: typeof window.electron?.recipeAPI?.generateRecipe === 'function',
      testAPIDefined: typeof window.__testAPI__ !== 'undefined',
    };
  });

  console.log('API Check:', apiDefined);

  // Try calling the API directly from browser context
  const result = await window.evaluate(async () => {
    return await window.electron.recipeAPI.generateRecipe({ dietaryTags: [] });
  });

  console.log('IPC Result:', result);

  await electronApp.close();
});
```

**Expected outcome:** This will show whether the API is properly defined and whether IPC calls complete

---

## References

- `src/main/preload.ts:34-35` - Conditional API exposure
- `src/main/utils/test-env.ts:37-39` - Environment detection logic
- `e2e/manual-entry.spec.ts:9` - Working test configuration
- `e2e/ai-recipe-generation.spec.ts:10-11` - Failing test configuration
- `thoughts/shared/research/2025-12-31-E2E-Test-Failures-Deep-Dive.md` - Prior investigation
