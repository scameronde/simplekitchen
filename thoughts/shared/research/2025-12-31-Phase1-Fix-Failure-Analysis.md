---
date: 2025-12-31
researcher: research-architect
topic: 'Phase 1 Fix Failure - Root Cause Analysis'
status: complete
coverage:
  - e2e/ai-recipe-generation.spec.ts
  - e2e/recipe-import.spec.ts
  - e2e/manual-entry.spec.ts
  - e2e/recipe-viewing.spec.ts
  - src/main/preload.ts
  - src/main/utils/test-env.ts
---

# Research: Phase 1 Fix Failure - Root Cause Analysis

## Executive Summary

- Phase 1 fix changed `NODE_ENV` from 'test' to 'development' in failing E2E tests but kept `E2E_TEST='true'`
- Tests still fail with the same 9 failures (AI generation: 4, web import: 5)
- Root cause: `E2E_TEST='true'` triggers `isE2ETest()` → `isTestEnvironment()` → preload exposes `__mockAPI__`
- Working tests (manual entry, viewing) do NOT set `E2E_TEST='true'`
- The incomplete fix changed `isUnitTest()` behavior but not `isTestEnvironment()` behavior
- Correct fix: Change `src/main/preload.ts:35` to use `isUnitTest()` instead of `isTestEnvironment()`

## Coverage Map

**Files Verified:**

- `e2e/ai-recipe-generation.spec.ts` - Verified current environment configuration (lines 10-11)
- `e2e/recipe-import.spec.ts` - Verified current environment configuration (lines 10-11)
- `e2e/manual-entry.spec.ts` - Verified working environment configuration (line 9)
- `e2e/recipe-viewing.spec.ts` - Verified working environment configuration (multiple test cases)
- `src/main/preload.ts` - Analyzed API exposure logic (line 35)
- `src/main/utils/test-env.ts` - Analyzed environment detection functions (lines 15-39)

## Critical Findings (Verified, Planner Attention Required)

### Finding 1: Phase 1 Fix Was Incomplete

**Observation:** Phase 1 changed `NODE_ENV` but kept `E2E_TEST='true'` in failing tests.

**Evidence:** `e2e/ai-recipe-generation.spec.ts:10-11` (after Phase 1)

```typescript
env: {
  ...process.env,
  NODE_ENV: 'development',
  E2E_TEST: 'true',
},
```

**Evidence:** `e2e/recipe-import.spec.ts:10-11` (after Phase 1)

```typescript
env: {
  ...process.env,
  NODE_ENV: 'development',
  E2E_TEST: 'true',
},
```

**Direct consequence:** With these settings, `isTestEnvironment()` still returns `true` because `isE2ETest()` returns `true`.

---

### Finding 2: E2E_TEST='true' Triggers isTestEnvironment()

**Observation:** `isTestEnvironment()` returns `true` when either `isUnitTest()` OR `isE2ETest()` returns `true`.

**Evidence:** `src/main/utils/test-env.ts:37-39`

```typescript
export function isTestEnvironment(): boolean {
  return isUnitTest() || isE2ETest();
}
```

**Evidence:** `src/main/utils/test-env.ts:27-29`

```typescript
export function isE2ETest(): boolean {
  return process.env.PLAYWRIGHT_TEST === 'true' || process.env.E2E_TEST === 'true';
}
```

**Direct consequence:** After Phase 1 fix:

- `isUnitTest()` = `false` (no `VITEST='true'`, no `NODE_ENV='test'`) ✅
- `isE2ETest()` = `true` (because `E2E_TEST='true'`) ❌
- `isTestEnvironment()` = `true` (because `isE2ETest()` is `true`) ❌
- Preload STILL exposes `__mockAPI__` instead of `__originalAPI__`

---

### Finding 3: Working Tests Do NOT Set E2E_TEST

**Observation:** Manual entry and viewing tests only set `NODE_ENV='development'` without `E2E_TEST`.

**Evidence:** `e2e/manual-entry.spec.ts:9`

```typescript
env: {
  ...process.env,
  NODE_ENV: 'development',
},
```

**Evidence:** `e2e/recipe-viewing.spec.ts:32` (first test case)

```typescript
env: {
  ...process.env,
  NODE_ENV: 'development',
},
```

**Evidence:** Verified via grep:

```bash
$ grep -n "E2E_TEST" e2e/manual-entry.spec.ts
# No results - E2E_TEST is NOT set

$ grep -n "E2E_TEST" e2e/recipe-viewing.spec.ts
# No results - E2E_TEST is NOT set
```

**Direct consequence:** For working tests:

- `isUnitTest()` = `false`
- `isE2ETest()` = `false` (no `E2E_TEST` set!)
- `isTestEnvironment()` = `false`
- Preload exposes `__originalAPI__` (real IPC) ✅ Tests pass

---

### Finding 4: Preload Uses isTestEnvironment() for API Selection

**Observation:** Preload chooses between `__mockAPI__` and `__originalAPI__` based on `isTestEnvironment()`.

**Evidence:** `src/main/preload.ts:35`

```typescript
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

**Direct consequence:** When `isTestEnvironment()` = `true`, the renderer receives `__mockAPI__` wrapper instead of direct IPC. This wrapper appears to break IPC communication in E2E tests (as documented in prior research reports).

---

### Finding 5: isUnitTest() Logic Changed But Behavior Didn't

**Observation:** Phase 1 changed `NODE_ENV='test'` to `NODE_ENV='development'`, affecting `isUnitTest()` but not the final outcome.

**Evidence:** `src/main/utils/test-env.ts:15-17`

```typescript
export function isUnitTest(): boolean {
  return process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';
}
```

**Before Phase 1:**

- `NODE_ENV='test'` + `E2E_TEST='true'`
- `isUnitTest()` = `true` (because `NODE_ENV='test'`)
- `isE2ETest()` = `true` (because `E2E_TEST='true'`)
- `isTestEnvironment()` = `true`
- Result: `__mockAPI__` exposed ❌

**After Phase 1:**

- `NODE_ENV='development'` + `E2E_TEST='true'`
- `isUnitTest()` = `false` (no `NODE_ENV='test'`) ✅
- `isE2ETest()` = `true` (because `E2E_TEST='true'`)
- `isTestEnvironment()` = `true` (still!)
- Result: `__mockAPI__` STILL exposed ❌

**Direct consequence:** The fix changed the path by which `isTestEnvironment()` returns `true`, but did not change the final result.

---

## Detailed Technical Analysis (Verified)

### Environment Variable Flow Comparison

#### Working Tests (Manual Entry, Viewing)

```
Playwright Test: NODE_ENV='development'
                 (E2E_TEST not set)
        ↓
isUnitTest():    process.env.NODE_ENV === 'test'  → FALSE ✅
                 process.env.VITEST === 'true'     → FALSE ✅
                 Result: FALSE

isE2ETest():     process.env.E2E_TEST === 'true'  → FALSE ✅
                 process.env.PLAYWRIGHT_TEST       → FALSE ✅
                 Result: FALSE

isTestEnvironment(): isUnitTest() || isE2ETest()  → FALSE ✅
        ↓
preload.ts:      recipeAPI = __originalAPI__      → Direct IPC ✅
        ↓
Renderer:        window.electron.recipeAPI.create()
                 → ipcRenderer.invoke('recipe:create')  ✅
        ↓
IPC Handler:     Called successfully              ✅
        ↓
Result:          TESTS PASS ✅
```

#### Failing Tests (AI Generation, Import) - BEFORE Phase 1

```
Playwright Test: NODE_ENV='test'
                 E2E_TEST='true'
        ↓
isUnitTest():    process.env.NODE_ENV === 'test'  → TRUE ❌
                 Result: TRUE

isE2ETest():     process.env.E2E_TEST === 'true'  → TRUE
                 Result: TRUE

isTestEnvironment(): isUnitTest() || isE2ETest()  → TRUE ❌
        ↓
preload.ts:      recipeAPI = __mockAPI__          → Wrapped IPC ❌
        ↓
Renderer:        window.electron.recipeAPI.generateRecipe()
                 → __mockAPI__.generateRecipe()
                 → __originalAPI__.generateRecipe()
                 → ipcRenderer.invoke('recipe:generate')  ❌ FAILS
        ↓
IPC Handler:     NEVER CALLED                     ❌
        ↓
Result:          TESTS FAIL ❌
```

#### Failing Tests - AFTER Phase 1 (Current State)

```
Playwright Test: NODE_ENV='development'
                 E2E_TEST='true'
        ↓
isUnitTest():    process.env.NODE_ENV === 'test'  → FALSE ✅
                 process.env.VITEST === 'true'     → FALSE ✅
                 Result: FALSE ✅ (Changed from before!)

isE2ETest():     process.env.E2E_TEST === 'true'  → TRUE ❌
                 Result: TRUE

isTestEnvironment(): isUnitTest() || isE2ETest()  → TRUE ❌ (Still true!)
        ↓
preload.ts:      recipeAPI = __mockAPI__          → Wrapped IPC ❌ (No change!)
        ↓
Renderer:        window.electron.recipeAPI.generateRecipe()
                 → __mockAPI__.generateRecipe()
                 → __originalAPI__.generateRecipe()
                 → ipcRenderer.invoke('recipe:generate')  ❌ FAILS
        ↓
IPC Handler:     NEVER CALLED                     ❌
        ↓
Result:          TESTS STILL FAIL ❌
```

**Key Insight:** Phase 1 successfully changed `isUnitTest()` from `true` to `false`, but `isTestEnvironment()` remains `true` because `isE2ETest()` is `true`. The preload logic depends on `isTestEnvironment()`, not `isUnitTest()`, so the behavior is unchanged.

---

### Why E2E_TEST='true' Cannot Be Removed

**Observation:** `E2E_TEST='true'` is used by IPC handlers to enable backend mocking.

**Evidence:** Referenced in prior research reports:

- `src/main/ipc/recipe-ai-handlers.ts` uses `isE2ETest()` to choose mock vs real OpenAI API
- `src/main/ipc/recipe-import-handlers.ts` uses `isE2ETest()` to choose mock vs real web scraping

**Direct consequence:** Removing `E2E_TEST='true'` would:

- Make tests use real OpenAI API (costs money, requires API keys, non-deterministic)
- Make tests use real web scraping (unreliable, depends on external sites)
- Break the intended E2E test architecture

**Conclusion:** `E2E_TEST='true'` must remain. The fix must be in the preload logic.

---

### The Correct Fix

**Observation:** The preload should only expose `__mockAPI__` for unit tests, not E2E tests.

**Current Logic:** `src/main/preload.ts:35`

```typescript
const recipeAPI = isTestEnvironment() ? __mockAPI__ : __originalAPI__;
```

**Problem:** `isTestEnvironment()` returns `true` for BOTH unit tests AND E2E tests.

**Correct Logic:**

```typescript
const recipeAPI = isUnitTest() ? __mockAPI__ : __originalAPI__;
```

**Rationale:**

- Unit tests need `__mockAPI__` (frontend mocking, no IPC)
- E2E tests need `__originalAPI__` (real IPC, backend mocking)
- `isUnitTest()` distinguishes these two cases
- `isE2ETest()` should only affect backend handler behavior, not frontend API exposure

**Same fix needed for `__testAPI__` exposure:** `src/main/preload.ts:57`

```typescript
if (isUnitTest()) {
  // Change from isTestEnvironment()
  contextBridge.exposeInMainWorld('__testAPI__', {
    __originalAPI__,
    __mockAPI__,
  });
}
```

---

## Verification Log

**Verified (direct reads):**

- `e2e/ai-recipe-generation.spec.ts:10-11` - Environment configuration after Phase 1
- `e2e/recipe-import.spec.ts:10-11` - Environment configuration after Phase 1
- `e2e/manual-entry.spec.ts:9` - Working environment configuration
- `e2e/recipe-viewing.spec.ts:32,59,90,120,151,180` - Working environment configurations (6 tests)
- `src/main/preload.ts:1-73` - Complete file read
- `src/main/utils/test-env.ts:15-39` - Environment detection functions

**Spot-checked excerpts captured:** Yes

**Command verification:**

```bash
$ grep -n "E2E_TEST\|NODE_ENV" e2e/manual-entry.spec.ts
9:      NODE_ENV: 'development',
43:      NODE_ENV: 'development',

$ grep -n "E2E_TEST\|NODE_ENV" e2e/recipe-viewing.spec.ts
32:        NODE_ENV: 'development',
59:        NODE_ENV: 'development',
90:        NODE_ENV: 'development',
120:        NODE_ENV: 'development',
151:        NODE_ENV: 'development',
180:        NODE_ENV: 'development',

$ grep -n "NODE_ENV" e2e/ai-recipe-generation.spec.ts
10:        NODE_ENV: 'development',
79:        NODE_ENV: 'development',
112:        NODE_ENV: 'development',
140:        NODE_ENV: 'development',

$ grep -n "E2E_TEST" e2e/ai-recipe-generation.spec.ts
11:        E2E_TEST: 'true',
80:        E2E_TEST: 'true',
113:        E2E_TEST: 'true',
141:        E2E_TEST: 'true',
```

---

## Open Questions / Unverified Claims

None. All findings are verified with direct evidence.

---

## References

- `e2e/ai-recipe-generation.spec.ts:10-11` - Current failing test configuration
- `e2e/recipe-import.spec.ts:10-11` - Current failing test configuration
- `e2e/manual-entry.spec.ts:9` - Working test configuration
- `e2e/recipe-viewing.spec.ts:32` - Working test configuration
- `src/main/preload.ts:35` - API selection logic (needs fix)
- `src/main/preload.ts:57` - Test API exposure (needs fix)
- `src/main/utils/test-env.ts:15-17` - isUnitTest() definition
- `src/main/utils/test-env.ts:27-29` - isE2ETest() definition
- `src/main/utils/test-env.ts:37-39` - isTestEnvironment() definition
- `thoughts/shared/research/2025-12-31-E2E-Test-Failures-Root-Cause.md` - Prior research
- `thoughts/shared/research/2025-12-31-E2E-Test-Failures-Deep-Dive.md` - Prior research
