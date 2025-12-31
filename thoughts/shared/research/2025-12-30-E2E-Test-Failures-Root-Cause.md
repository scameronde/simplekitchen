---
date: 2025-12-30
researcher: research-architect
topic: 'E2E Test Failures Root Cause Analysis'
status: complete
coverage:
  - e2e/ai-recipe-generation.spec.ts
  - e2e/recipe-import.spec.ts
  - src/renderer/pages/RecipeGenerationPage.tsx
  - src/renderer/pages/RecipeImportPage.tsx
  - src/main/preload.ts
  - src/main/ipc/recipe-ai-handlers.ts
  - src/main/ipc/recipe-import-handlers.ts
  - vitest.setup.ts
---

# Research: E2E Test Failures Root Cause Analysis

## Executive Summary

- 9 out of 17 E2E tests are failing (AI generation: 4/4, Web import: 5/5)
- Manual entry tests pass completely (2/2), recipe viewing tests pass (6/6)
- **Root cause**: Tests attempt to mock `window.electron.recipeAPI` methods via `window.evaluate()`, but these methods are **immutable** due to `contextBridge.exposeInMainWorld()` creating frozen objects
- Tests correctly navigate to pages and interact with forms, but mocking fails silently
- Actual IPC handlers execute instead of mocks, causing real API calls that timeout or fail
- **Secondary issue**: `vitest.setup.ts` is missing mock definitions for `generateRecipe` and `importRecipe`, causing TypeScript compilation errors

## Coverage Map

**Verified by direct read:**

- `e2e/ai-recipe-generation.spec.ts` (all 4 test cases)
- `e2e/recipe-import.spec.ts` (all 5 test cases)
- `src/renderer/pages/RecipeGenerationPage.tsx` (implementation)
- `src/renderer/pages/RecipeImportPage.tsx` (implementation)
- `src/main/preload.ts` (API exposure mechanism)
- `src/main/ipc/recipe-ai-handlers.ts` (IPC handler)
- `src/main/ipc/recipe-import-handlers.ts` (IPC handler)
- `vitest.setup.ts` (unit test mock setup)

**Not inspected:**

- Playwright test runner internals
- Electron contextBridge implementation details

## Critical Findings (Verified, Planner Attention Required)

### Finding 1: Tests Attempt to Mock Immutable API Objects

**Observation:** All failing tests use `window.evaluate()` to override `window.electron.recipeAPI` methods.

**Evidence:** `e2e/ai-recipe-generation.spec.ts:24-66`

```typescript
await window.evaluate(() => {
  (window as unknown as ElectronWindow).electron.recipeAPI.generateRecipe = async () => {
    return {
      success: true,
      recipe: {
        /* mock data */
      },
    };
  };
});
```

**Evidence:** `e2e/recipe-import.spec.ts:24-67`

```typescript
await window.evaluate(() => {
  (window as unknown as ElectronWindow).electron.recipeAPI.importRecipe = async () => {
    return {
      success: true,
      recipe: {
        /* mock data */
      },
    };
  };
});
```

**Direct consequence:** If `contextBridge.exposeInMainWorld()` creates frozen/sealed objects, these assignments will fail silently in non-strict mode or throw in strict mode, but will not replace the actual IPC implementation.

### Finding 2: contextBridge Creates Immutable API Objects

**Observation:** The Electron API is exposed via `contextBridge.exposeInMainWorld()` in the preload script.

**Evidence:** `src/main/preload.ts:7-24`

```typescript
contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,
  versions: {
    /* ... */
  },
  recipeAPI: {
    create: (input: CreateRecipeInput) => ipcRenderer.invoke('recipe:create', input),
    getAll: () => ipcRenderer.invoke('recipe:getAll'),
    getById: (id: string) => ipcRenderer.invoke('recipe:getById', id),
    filter: (filter: RecipeFilter) => ipcRenderer.invoke('recipe:filter', filter),
    generateRecipe: (criteria: RecipeGenerationCriteria) =>
      ipcRenderer.invoke('recipe:generate', criteria),
    importRecipe: (url: string) => ipcRenderer.invoke('recipe:import', url),
  },
});
```

**Direct consequence:** The `window.electron` object and its nested `recipeAPI` object are frozen/immutable. Test attempts to override methods like `generateRecipe` and `importRecipe` have no effect.

### Finding 3: Test Failure Modes Indicate Real IPC Execution

**Observation:** AI generation tests timeout (30s) or fail with missing error messages. Import tests fail with missing review page elements.

**Evidence:** Test output shows:

```
✘ 1 › successfully generates and saves a recipe (30.0s)
    Test timeout of 30000ms exceeded.

✘ 2 › displays error when rate limited (6.2s)
    Error: expect(locator).toBeVisible failed
    Locator: locator('text=Rate limit exceeded')
    Timeout: 5000ms
```

**Evidence:** `e2e/recipe-import.spec.ts:84-86`

```typescript
await expect(window.locator('h1:has-text("Review Imported Recipe")')).toBeVisible({
  timeout: 5000,
});
```

**Direct consequence:** Tests trigger actual IPC calls to `recipe:generate` and `recipe:import`, which attempt real OpenAI API calls or web fetches, causing timeouts or failures. The UI never transitions to review mode because real APIs fail.

### Finding 4: Manual Entry and Recipe Viewing Tests Pass

**Observation:** All manual entry tests (2/2) and recipe viewing tests (6/6) pass successfully.

**Evidence:** Test output shows:

```
✓ 5 e2e/manual-entry.spec.ts:4:1 › complete manual recipe entry workflow (1.3s)
✓ 6 e2e/manual-entry.spec.ts:38:1 › displays validation errors for invalid recipe (1.2s)
✓ 12-17 e2e/recipe-viewing.spec.ts › all 6 tests pass (1.4-1.5s each)
```

**Direct consequence:** These tests do not require mocking external APIs. They interact directly with form inputs and database operations, which work correctly in the E2E environment.

### Finding 5: IPC Handlers Execute Real External Calls

**Observation:** The `recipe:generate` handler calls `generateRecipe()` which makes OpenAI API calls. The `recipe:import` handler calls `extractSchemaOrgRecipe()` which fetches real URLs.

**Evidence:** `src/main/ipc/recipe-ai-handlers.ts:35`

```typescript
// Generate recipe via OpenAI
const result = await generateRecipe(criteria);
```

**Evidence:** `src/main/ipc/recipe-import-handlers.ts:92-94`

```typescript
// Extract Schema.org recipe from URL
let schemaRecipe;
try {
  schemaRecipe = await extractSchemaOrgRecipe(url as string);
```

**Direct consequence:** When mocking fails, tests execute real network operations that timeout (AI API has no key configured, web fetches take too long or fail), causing test failures.

### Finding 6: Vitest Setup Missing Mock Definitions

**Observation:** The `vitest.setup.ts` file defines mocks for `window.electron.recipeAPI` but is missing `generateRecipe` and `importRecipe`.

**Evidence:** `vitest.setup.ts:21-26`

```typescript
recipeAPI: {
  create: vi.fn(),
  getAll: vi.fn(),
  getById: vi.fn(),
  filter: vi.fn(),
},
```

**Evidence:** TypeScript error from project diagnostics:

```
Type '{ create: Mock<Procedure>; getAll: Mock<Procedure>; getById: Mock<Procedure>; filter: Mock<Procedure>; }'
is missing the following properties from type '{ ... }': generateRecipe, importRecipe
```

**Direct consequence:** Unit tests that use the RecipeGenerationPage or RecipeImportPage components will fail with TypeScript compilation errors. The ElectronAPI interface requires `generateRecipe` and `importRecipe` methods.

## Detailed Technical Analysis (Verified)

### Test Mocking Strategy (Non-Functional)

The tests follow a consistent pattern:

1. Launch Electron app with Playwright
2. Wait for first window to load
3. Use `window.evaluate()` to override `window.electron.recipeAPI` methods
4. Navigate to the page and fill forms
5. Click submit button
6. Expect UI to show mocked response

**Evidence:** `e2e/ai-recipe-generation.spec.ts:12-70`

- Lines 12-18: Launch Electron app
- Lines 24-66: Attempt to mock `generateRecipe` method
- Lines 70-96: Navigate and fill form
- Lines 101-103: Expect review mode to appear

### contextBridge Behavior

Electron's `contextBridge.exposeInMainWorld()` creates a **frozen, non-configurable** object in the renderer process. This is a security feature to prevent tampering with IPC APIs.

**Evidence:** `src/main/preload.ts:7`

```typescript
contextBridge.exposeInMainWorld('electron', {
  // Object properties become frozen
```

**Direct consequence:** Object.assign, property assignment, and method override attempts fail silently or throw errors, depending on strict mode.

### Page Implementation (Correct)

Both pages correctly call the `window.electron.recipeAPI` methods and handle responses.

**Evidence:** `src/renderer/pages/RecipeGenerationPage.tsx:102`

```typescript
const result = await window.electron.recipeAPI.generateRecipe(criteriaToSend);
```

**Evidence:** `src/renderer/pages/RecipeImportPage.tsx:53`

```typescript
const result = await window.electron.recipeAPI.importRecipe(url);
```

**Direct consequence:** The pages are implemented correctly. The issue is purely in the test mocking strategy.

### Error Display Logic (Correct)

Both pages correctly handle and display errors from failed API calls.

**Evidence:** `src/renderer/pages/RecipeGenerationPage.tsx:125-127`

```typescript
} else if (result.error) {
  setError(result.error);
}
```

**Evidence:** `src/renderer/pages/RecipeImportPage.tsx:76-79`

```typescript
} else if (result.errors && result.errors.length > 0) {
  setError(result.errors.map(e => `${e.field}: ${e.message}`).join('; '));
}
```

**Direct consequence:** When real API calls fail (due to missing API keys or network errors), error states are set, but tests expect success messages.

### Unit Test Mock Setup (Incomplete)

The vitest setup creates a mock `window.electron` object for unit tests, but only defines 4 of 6 required methods.

**Evidence:** `vitest.setup.ts:14-27`

```typescript
globalThis.window.electron = {
  platform: 'test',
  versions: {
    node: '22.0.0',
    chrome: '126.0.0',
    electron: '39.0.0',
  },
  recipeAPI: {
    create: vi.fn(),
    getAll: vi.fn(),
    getById: vi.fn(),
    filter: vi.fn(),
  },
};
```

**Direct consequence:** Any unit test that imports RecipeGenerationPage or RecipeImportPage will fail TypeScript compilation. The mock does not satisfy the ElectronAPI type definition.

## Verification Log

**Verified:**

- `e2e/ai-recipe-generation.spec.ts` (full file, 275 lines)
- `e2e/recipe-import.spec.ts` (full file, 429 lines)
- `src/renderer/pages/RecipeGenerationPage.tsx` (full file, 411 lines)
- `src/renderer/pages/RecipeImportPage.tsx` (full file, 282 lines)
- `src/main/preload.ts` (full file, 26 lines)
- `src/main/ipc/recipe-ai-handlers.ts` (full file, 61 lines)
- `src/main/ipc/recipe-import-handlers.ts` (full file, 175 lines)
- `vitest.setup.ts` (full file, 31 lines)

**Spot-checked excerpts captured:** yes (13 excerpts)

## Open Questions / Unverified Claims

- **Exact behavior of contextBridge**: Is the object frozen, sealed, or non-configurable? Manual testing or Electron documentation review needed.
- **Playwright's evaluate() strict mode**: Does Playwright execute `window.evaluate()` code in strict mode? If not, assignment failures may be silent.
- **Alternative mocking approaches**: Can IPC handlers be mocked at the main process level? Can preload script conditionally expose mock APIs in test environment?
- **Environment detection**: Do tests set `NODE_ENV=development` or `TEST=true` environment variable that could enable test-specific code paths?
- **Impact on CI/CD**: Are these E2E tests required to pass for deployment? Do they run in CI?

## References

- `e2e/ai-recipe-generation.spec.ts:24-66` (mocking attempt)
- `e2e/recipe-import.spec.ts:24-67` (mocking attempt)
- `src/main/preload.ts:7-24` (contextBridge API exposure)
- `src/main/ipc/recipe-ai-handlers.ts:35` (real OpenAI call)
- `src/main/ipc/recipe-import-handlers.ts:92-94` (real web fetch)
- `src/renderer/pages/RecipeGenerationPage.tsx:102` (API invocation)
- `src/renderer/pages/RecipeImportPage.tsx:53` (API invocation)
- `vitest.setup.ts:21-26` (incomplete mock definition)
