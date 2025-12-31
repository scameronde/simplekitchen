# QA-Driven Implementation Plan: E2E Test Failures

## Inputs

- Research report: `thoughts/shared/research/2025-12-30-E2E-Test-Failures-Root-Cause.md`
- Analysis date: 2025-12-30
- Researcher: research-architect
- Manual analysis: E2E test failure patterns, contextBridge behavior, IPC handler execution

## Verified Current State

### E2E Test Failures

- **Fact:** 9 out of 17 E2E tests are failing (AI generation: 4/4, Web import: 5/5)
- **Evidence:** Research document executive summary
- **Excerpt:**
  ```
  9 out of 17 E2E tests are failing (AI generation: 4/4, Web import: 5/5)
  Manual entry tests pass completely (2/2), recipe viewing tests pass (6/6)
  ```

### Root Cause: Immutable contextBridge API

- **Fact:** Tests attempt to mock `window.electron.recipeAPI` methods via `window.evaluate()`, but contextBridge creates frozen objects
- **Evidence:** `e2e/ai-recipe-generation.spec.ts:24-66`, `src/main/preload.ts:7-24`
- **Excerpt:**

  ```typescript
  // e2e/ai-recipe-generation.spec.ts:24-66
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

  // src/main/preload.ts:7-24
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

### Real IPC Execution When Mocks Fail

- **Fact:** When mocking fails, actual IPC handlers execute, causing real OpenAI API calls and web fetches that timeout or fail
- **Evidence:** `src/main/ipc/recipe-ai-handlers.ts:35`, `src/main/ipc/recipe-import-handlers.ts:92-94`
- **Excerpt:**

  ```typescript
  // src/main/ipc/recipe-ai-handlers.ts:35
  // Generate recipe via OpenAI
  const result = await generateRecipe(criteria);

  // src/main/ipc/recipe-import-handlers.ts:92-94
  // Extract Schema.org recipe from URL
  let schemaRecipe;
  try {
    schemaRecipe = await extractSchemaOrgRecipe(url as string);
  ```

### TypeScript Compilation Error in Vitest Setup

- **Fact:** `vitest.setup.ts` is missing mock definitions for `generateRecipe` and `importRecipe`, causing TypeScript compilation errors
- **Evidence:** `vitest.setup.ts:21-26`
- **Excerpt:**
  ```typescript
  recipeAPI: {
    create: vi.fn(),
    getAll: vi.fn(),
    getById: vi.fn(),
    filter: vi.fn(),
    // Missing: generateRecipe, importRecipe
  },
  ```
- **TypeScript Error:**
  ```
  Type '{ create: Mock<Procedure>; getAll: Mock<Procedure>; getById: Mock<Procedure>; filter: Mock<Procedure>; }'
  is missing the following properties from type '{ ... }': generateRecipe, importRecipe
  ```

### Test Failure Modes

- **Fact:** AI generation tests timeout (30s), import tests fail with missing review page elements
- **Evidence:** Research document Finding 3
- **Excerpt:**

  ```
  ✘ 1 › successfully generates and saves a recipe (30.0s)
      Test timeout of 30000ms exceeded.

  ✘ 2 › displays error when rate limited (6.2s)
      Error: expect(locator).toBeVisible failed
      Locator: locator('text=Rate limit exceeded')
      Timeout: 5000ms
  ```

### Passing Tests (Baseline)

- **Fact:** Manual entry tests (2/2) and recipe viewing tests (6/6) pass because they don't require external API mocking
- **Evidence:** Research document Finding 4
- **Excerpt:**
  ```
  ✓ 5 e2e/manual-entry.spec.ts:4:1 › complete manual recipe entry workflow (1.3s)
  ✓ 6 e2e/manual-entry.spec.ts:38:1 › displays validation errors for invalid recipe (1.2s)
  ✓ 12-17 e2e/recipe-viewing.spec.ts › all 6 tests pass (1.4-1.5s each)
  ```

## Goals / Non-Goals

- **Goals**: Resolve E2E test failures by implementing proper mocking infrastructure
  - Critical: 1 issue (TypeScript compilation)
  - High: 4 issues (E2E mocking infrastructure)
  - Medium: 4 issues (test updates and verification)
- **Non-Goals**: Refactoring IPC architecture, changing real API implementations, adding new test coverage

## Design Overview

This plan addresses E2E test failures through a three-phase approach:

1. **TypeScript Fixes**: Complete the vitest.setup.ts mock to satisfy ElectronAPI interface
2. **Environment-Based Mocking**: Implement test environment detection and conditional mock API exposure in the preload script
3. **Test Updates**: Modify E2E tests to leverage the new mocking infrastructure and verify all tests pass

The solution avoids runtime mutation of frozen contextBridge objects by conditionally exposing mockable APIs during test initialization.

## Phased Implementation

### Phase 1: Critical Issues (TypeScript Compilation)

Execute this item first; it blocks unit test compilation.

#### PLAN-001: Add Missing Mock Methods to vitest.setup.ts

- **Priority**: Critical
- **Category**: TypeScript
- **Change Type**: modify
- **File(s)**: `vitest.setup.ts:21-26`
- **Instruction**:
  1. Add `generateRecipe: vi.fn()` to the `recipeAPI` mock object
  2. Add `importRecipe: vi.fn()` to the `recipeAPI` mock object
  3. Ensure the mock satisfies the complete `ElectronAPI` interface from `src/shared/types/electron.d.ts`
  4. Run `npm run typecheck` to verify TypeScript compilation succeeds
- **Evidence**:
  ```typescript
  // vitest.setup.ts:21-26 (current - incomplete)
  recipeAPI: {
    create: vi.fn(),
    getAll: vi.fn(),
    getById: vi.fn(),
    filter: vi.fn(),
  },
  ```
- **Done When**: TypeScript compilation passes with no errors related to ElectronAPI interface, `npm run typecheck` succeeds

**Phase 1 Verification**:

```bash
npm run typecheck  # Should pass with no errors
```

### Phase 2: High Priority Issues (E2E Mocking Infrastructure)

Execute after Phase 1 passes verification.

#### PLAN-002: Create Environment Detection Utility

- **Priority**: High
- **Category**: Infrastructure
- **Change Type**: create
- **File(s)**: New file `src/main/utils/test-env.ts`
- **Instruction**:
  1. Create a new file `src/main/utils/test-env.ts`
  2. Export a function `isTestEnvironment(): boolean` that checks:
     - `process.env.NODE_ENV === 'test'` OR
     - `process.env.PLAYWRIGHT_TEST === 'true'` OR
     - `process.env.E2E_TEST === 'true'`
  3. Export a function `getTestMockData(): any` that returns predefined mock data for tests
  4. Add unit tests in `src/main/utils/test-env.test.ts`
- **Evidence**:
  Research document "Open Questions" mentions:
  ```
  Environment detection: Do tests set NODE_ENV=development or TEST=true
  environment variable that could enable test-specific code paths?
  ```
- **Done When**: `isTestEnvironment()` returns true when any test environment variable is set, unit tests pass

#### PLAN-003: Add Conditional Mock API Exposure in preload.ts

- **Priority**: High
- **Category**: E2E Mocking
- **Change Type**: modify
- **File(s)**: `src/main/preload.ts:7-24`
- **Instruction**:
  1. Import `isTestEnvironment` from `./utils/test-env.js`
  2. Check if test environment is active using `isTestEnvironment()`
  3. If in test environment:
     - Store IPC invoke functions in a global `__originalAPI__` object
     - Create `__mockAPI__` object with vi.fn() style mocks that can be overridden
     - Expose both via contextBridge for test harness access
  4. If not in test environment:
     - Keep existing contextBridge.exposeInMainWorld implementation unchanged
  5. Ensure mocks default to calling original IPC handlers unless overridden
- **Evidence**:
  ```typescript
  // src/main/preload.ts:7-24 (current - always exposes real IPC)
  contextBridge.exposeInMainWorld('electron', {
    platform: process.platform,
    versions: {
      /* ... */
    },
    recipeAPI: {
      create: (input: CreateRecipeInput) => ipcRenderer.invoke('recipe:create', input),
      // ...
    },
  });
  ```
- **Done When**: In test environment, `window.electron.recipeAPI` methods can be overridden at test initialization; in production, API remains frozen and secure

#### PLAN-004: Create Mock IPC Handler for AI Generation

- **Priority**: High
- **Category**: E2E Mocking
- **Change Type**: create
- **File(s)**: New file `src/main/ipc/recipe-ai-handlers.mock.ts`
- **Instruction**:
  1. Create `src/main/ipc/recipe-ai-handlers.mock.ts`
  2. Export `mockGenerateRecipe(criteria: RecipeGenerationCriteria)` that returns success/error responses based on criteria
  3. Include mock responses for:
     - Success case (return sample recipe matching criteria)
     - Rate limit error case (detect test signal, return rate limit error)
     - Validation error case (detect invalid criteria, return validation errors)
     - Generic failure case (detect test signal, return generic error)
  4. Import in `recipe-ai-handlers.ts` and conditionally use when `isTestEnvironment()` is true
- **Evidence**:
  ```typescript
  // src/main/ipc/recipe-ai-handlers.ts:35 (current - always calls real API)
  const result = await generateRecipe(criteria);
  ```
- **Done When**: Mock handler returns appropriate responses for all test cases, can be conditionally enabled via environment detection

#### PLAN-005: Create Mock IPC Handler for Web Import

- **Priority**: High
- **Category**: E2E Mocking
- **Change Type**: create
- **File(s)**: New file `src/main/ipc/recipe-import-handlers.mock.ts`
- **Instruction**:
  1. Create `src/main/ipc/recipe-import-handlers.mock.ts`
  2. Export `mockImportRecipe(url: string)` that returns success/error responses based on URL
  3. Include mock responses for:
     - Success case (return sample Schema.org recipe data)
     - Invalid URL case (return validation error)
     - Network error case (return fetch error)
     - No recipe found case (return "no Schema.org recipe" error)
     - Multiple recipes case (return multiple recipe options)
  4. Import in `recipe-import-handlers.ts` and conditionally use when `isTestEnvironment()` is true
- **Evidence**:
  ```typescript
  // src/main/ipc/recipe-import-handlers.ts:92-94 (current - always fetches real URLs)
  let schemaRecipe;
  try {
    schemaRecipe = await extractSchemaOrgRecipe(url as string);
  ```
- **Done When**: Mock handler returns appropriate responses for all test cases, can be conditionally enabled via environment detection

**Phase 2 Verification**:

```bash
npm run build        # Should compile successfully
npm run typecheck    # Should pass with no errors
```

### Phase 3: Medium Priority Issues (Test Updates and Verification)

Execute after Phase 2 passes verification.

#### PLAN-006: Update E2E Tests to Remove Runtime Mocking

- **Priority**: Medium
- **Category**: E2E Testing
- **Change Type**: modify
- **File(s)**: `e2e/ai-recipe-generation.spec.ts:24-66`, `e2e/recipe-import.spec.ts:24-67`
- **Instruction**:
  1. Remove all `window.evaluate()` blocks that attempt to override `window.electron.recipeAPI` methods
  2. Instead, add test signal parameters to form inputs that trigger specific mock responses:
     - For rate limit test: Use criteria with `mealType: 'rate-limit-test'` or similar signal
     - For validation error test: Use criteria with invalid values
     - For success test: Use normal valid criteria
  3. Update mock handlers (PLAN-004, PLAN-005) to detect these test signals
  4. Ensure tests maintain same assertions and expectations
- **Evidence**:
  ```typescript
  // e2e/ai-recipe-generation.spec.ts:24-66 (current - attempts runtime override)
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
- **Done When**: E2E tests no longer attempt to override frozen API methods, instead rely on test signals to trigger specific mock behaviors

#### PLAN-007: Update Playwright Configuration for Test Environment

- **Priority**: Medium
- **Category**: E2E Testing
- **Change Type**: modify
- **File(s)**: `playwright.config.ts`
- **Instruction**:
  1. Add `env` configuration to Playwright test runner
  2. Set `E2E_TEST: 'true'` for all test runs
  3. Optionally add `NODE_ENV: 'test'` if not already set
  4. Ensure environment variables are passed to Electron app during launch
- **Evidence**:
  Research document mentions environment-based detection as solution approach
- **Done When**: Playwright configuration passes `E2E_TEST=true` to launched Electron app, `isTestEnvironment()` returns true during E2E tests

#### PLAN-008: Verify All 9 Failing Tests Now Pass

- **Priority**: Medium
- **Category**: Verification
- **Change Type**: verify
- **File(s)**: `e2e/ai-recipe-generation.spec.ts`, `e2e/recipe-import.spec.ts`
- **Instruction**:
  1. Run `npm run test:e2e` to execute all E2E tests
  2. Verify all 4 AI generation tests pass:
     - Successfully generates and saves a recipe
     - Displays error when rate limited
     - Displays validation errors for invalid criteria
     - Allows editing generated recipe before saving
  3. Verify all 5 web import tests pass:
     - Successfully imports recipe from valid URL
     - Displays error for invalid URL
     - Displays error when no recipe found
     - Handles network errors gracefully
     - Shows multiple recipe options when available
  4. Document pass/fail status for each test
- **Evidence**:
  Research document executive summary states "9 out of 17 E2E tests are failing"
- **Done When**: All 9 previously failing tests pass, `npm run test:e2e` shows 17/17 tests passing

#### PLAN-009: Regression Check on Passing Tests

- **Priority**: Medium
- **Category**: Verification
- **Change Type**: verify
- **File(s)**: `e2e/manual-entry.spec.ts`, `e2e/recipe-viewing.spec.ts`
- **Instruction**:
  1. Run `npm run test:e2e` to execute all E2E tests
  2. Verify manual entry tests still pass (2/2):
     - Complete manual recipe entry workflow
     - Displays validation errors for invalid recipe
  3. Verify recipe viewing tests still pass (6/6):
     - All viewing and filtering tests
  4. Ensure no regressions introduced by environment detection or preload changes
- **Evidence**:
  Research document Finding 4 states these tests currently pass
- **Done When**: All 8 previously passing tests still pass after implementation changes

**Phase 3 Verification**:

```bash
npm run test:e2e     # Should show 17/17 tests passing
npm run test:all     # Should pass all unit, integration, and E2E tests
```

## Baseline Verification

Before starting Phase 1, run these commands to establish a baseline:

```bash
npm run typecheck           # Current status: Fails with missing mock properties
npm run test:e2e            # Current status: 9/17 tests failing
npm run test                # Current status: Should pass (unit tests)
```

Record the current error counts. Each phase should reduce these counts.

## Acceptance Criteria

From research document analysis:

1. **All E2E tests pass**: `npm run test:e2e` shows 17/17 tests passing
   - AI generation tests: 4/4 passing
   - Web import tests: 5/5 passing
   - Manual entry tests: 2/2 passing (no regression)
   - Recipe viewing tests: 6/6 passing (no regression)

2. **No real external API calls during E2E tests**: Tests execute with mock handlers, no OpenAI API calls or real web fetches

3. **TypeScript compilation succeeds**: `npm run typecheck` passes with no errors

4. **Test execution time improves**: E2E tests complete faster without real API timeouts (should complete in <10s total, not 30s+ with timeouts)

5. **Production behavior unchanged**: When not in test environment, preload script exposes frozen, secure contextBridge APIs as before

## Implementor Checklist

### Phase 1 (Critical)

- [ ] PLAN-001: Add Missing Mock Methods to vitest.setup.ts

### Phase 2 (High)

- [ ] PLAN-002: Create Environment Detection Utility
- [ ] PLAN-003: Add Conditional Mock API Exposure in preload.ts
- [ ] PLAN-004: Create Mock IPC Handler for AI Generation
- [ ] PLAN-005: Create Mock IPC Handler for Web Import

### Phase 3 (Medium)

- [ ] PLAN-006: Update E2E Tests to Remove Runtime Mocking
- [ ] PLAN-007: Update Playwright Configuration for Test Environment
- [ ] PLAN-008: Verify All 9 Failing Tests Now Pass
- [ ] PLAN-009: Regression Check on Passing Tests

## References

- Source research report: `thoughts/shared/research/2025-12-30-E2E-Test-Failures-Root-Cause.md`
- Manual analysis: E2E test failure patterns, contextBridge immutability, IPC execution flow
- Coverage: 8 files analyzed (2 E2E test files, 2 page components, 1 preload script, 2 IPC handlers, 1 vitest setup)
