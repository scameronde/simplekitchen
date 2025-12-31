# E2E Test Failures Fix - Two-Phase Implementation Plan

## Inputs

- **Research report used:** `thoughts/shared/research/2025-12-31-E2E-Test-Failures-Root-Cause.md`
- **User request summary:** Create a two-step plan: (1) immediate fix to make tests pass and establish baseline, (2) long-term fix to properly separate unit test and E2E test environment detection
- **Current failing tests:** 9 tests (4 AI generation, 5 web import)
- **Current passing tests:** 8 tests (2 manual entry, 6 viewing)

## Verified Current State

### Fact 1: Manual entry tests use NODE_ENV='development' and pass

**Evidence:** `e2e/manual-entry.spec.ts:9`

```typescript
NODE_ENV: 'development',
```

### Fact 2: AI generation tests use NODE_ENV='test' and fail

**Evidence:** `e2e/ai-recipe-generation.spec.ts:10-11`

```typescript
NODE_ENV: 'test',
E2E_TEST: 'true',
```

### Fact 3: Recipe import tests use NODE_ENV='test' and fail

**Evidence:** `e2e/recipe-import.spec.ts:10-11`

```typescript
NODE_ENV: 'test',
E2E_TEST: 'true',
```

### Fact 4: Preload exposes different APIs based on isTestEnvironment()

**Evidence:** `src/main/preload.ts:35`

```typescript
const recipeAPI = isTestEnvironment() ? __mockAPI__ : __originalAPI__;
```

### Fact 5: isTestEnvironment() returns true for both unit tests AND E2E tests

**Evidence:** `src/main/utils/test-env.ts:37-39`

```typescript
export function isTestEnvironment(): boolean {
  return isUnitTest() || isE2ETest();
}
```

### Fact 6: isUnitTest() returns true when NODE_ENV='test'

**Evidence:** `src/main/utils/test-env.ts:15-16`

```typescript
export function isUnitTest(): boolean {
  return process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';
}
```

### Fact 7: **testAPI** is exposed when isTestEnvironment() is true

**Evidence:** `src/main/preload.ts:57`

```typescript
if (isTestEnvironment()) {
  contextBridge.exposeInMainWorld('__testAPI__', {
```

## Goals / Non-Goals

### Goals

- **Phase 1:** Make all E2E tests pass by using the same environment configuration as manual entry tests
- **Phase 1:** Establish a working baseline for the user to verify
- **Phase 2:** Refactor environment detection to properly distinguish unit tests from E2E tests
- **Phase 2:** Allow E2E tests to use semantically correct `NODE_ENV='test'` without triggering frontend mocks
- **Phase 2:** Ensure unit tests continue to work with frontend mocks

### Non-Goals

- Changing test logic or assertions
- Modifying IPC handlers or business logic
- Adding new test infrastructure beyond environment detection
- Changing the existing `__mockAPI__` / `__originalAPI__` design

## Design Overview

### Current Problem

1. E2E tests set `NODE_ENV='test'` + `E2E_TEST='true'`
2. This triggers `isTestEnvironment()` → true
3. Preload exposes `__mockAPI__` (intended for unit tests with frontend mocking)
4. E2E tests need `__originalAPI__` (real IPC with backend mocking)

### Phase 1 Solution (Immediate Fix)

1. Change failing E2E tests to use `NODE_ENV='development'` (matches working manual entry tests)
2. Keep `E2E_TEST='true'` (triggers backend mocks in IPC handlers)
3. This bypasses the frontend mocking and uses real IPC communication
4. User runs tests to verify all 17 E2E tests pass

### Phase 2 Solution (Long-term Fix)

1. Refactor `isUnitTest()` to only check `VITEST='true'` (remove `NODE_ENV='test'` check)
2. Update preload to only expose frontend mocks for `isUnitTest()` (not `isTestEnvironment()`)
3. Revert E2E tests back to `NODE_ENV='test'` (semantically correct)
4. E2E tests now use real IPC because `isUnitTest()` returns false
5. Unit tests still get frontend mocks because `VITEST='true'` → `isUnitTest()` returns true

### Why This Works

- **Phase 1:** Uses proven working pattern from manual entry tests (low risk)
- **Phase 2:** Separates concerns: `isUnitTest()` controls frontend mocking, `isE2ETest()` controls backend mocking
- **Phase 2:** E2E tests can use proper `NODE_ENV='test'` without breaking IPC communication

## Phase 1: Immediate Fix (Establish Baseline)

### PLAN-101: Update AI Recipe Generation Test Environment

**Change Type:** modify  
**File:** `e2e/ai-recipe-generation.spec.ts`

**Instruction:**

1. Locate line 10: `NODE_ENV: 'test',`
2. Change to: `NODE_ENV: 'development',`
3. Keep line 11 unchanged: `E2E_TEST: 'true',`

**Evidence:** `e2e/manual-entry.spec.ts:9` shows this pattern works for E2E tests

**Expected Result:**

```typescript
env: {
  ...process.env,
  NODE_ENV: 'development',
  E2E_TEST: 'true',
},
```

**Done When:** File modified, `NODE_ENV` changed from `'test'` to `'development'`

---

### PLAN-102: Update Recipe Import Test Environment

**Change Type:** modify  
**File:** `e2e/recipe-import.spec.ts`

**Instruction:**

1. Locate line 10: `NODE_ENV: 'test',`
2. Change to: `NODE_ENV: 'development',`
3. Keep line 11 unchanged: `E2E_TEST: 'true',`

**Evidence:** `e2e/manual-entry.spec.ts:9` shows this pattern works for E2E tests

**Expected Result:**

```typescript
env: {
  ...process.env,
  NODE_ENV: 'development',
  E2E_TEST: 'true',
},
```

**Done When:** File modified, `NODE_ENV` changed from `'test'` to `'development'`

---

### PLAN-103: Verify Phase 1 Baseline (USER ACTION REQUIRED)

**Change Type:** verification (user-executed)  
**Files:** All E2E test files

**Instruction:**
The user must run all E2E tests to verify they pass before proceeding to Phase 2.

**Verification Commands:**

```bash
# Run all E2E tests
npm run test:e2e

# Or run specific test suites
npx playwright test e2e/ai-recipe-generation.spec.ts
npx playwright test e2e/recipe-import.spec.ts
npx playwright test e2e/manual-entry.spec.ts
npx playwright test e2e/recipe-viewing.spec.ts
```

**Pass Condition:**

- All 17 E2E tests pass (9 previously failing + 8 previously passing)
- No timeout errors
- No "handler not found" errors
- Tests complete successfully

**Done When:**

- User confirms all E2E tests pass
- User explicitly approves proceeding to Phase 2

**CRITICAL:** Do not proceed to Phase 2 until user confirms tests pass.

---

## Phase 2: Long-term Fix (Proper Environment Separation)

**PREREQUISITE:** Phase 1 must be complete and verified by user before starting Phase 2.

### PLAN-201: Refactor isUnitTest() Environment Detection

**Change Type:** modify  
**File:** `src/main/utils/test-env.ts`

**Instruction:**

1. Locate line 15-16: `isUnitTest()` function
2. Change line 16 from:
   ```typescript
   return process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';
   ```
   To:
   ```typescript
   return process.env.VITEST === 'true';
   ```
3. Remove the `|| process.env.NODE_ENV === 'test'` clause

**Rationale:**

- Unit tests are explicitly run with `VITEST='true'` (set by vitest runner)
- `NODE_ENV='test'` is a generic environment variable that should not trigger frontend mocking
- E2E tests use `NODE_ENV='test'` for semantic correctness, not to trigger unit test behavior

**Evidence:**

- `src/main/utils/test-env.ts:16` - Current implementation incorrectly conflates unit tests with generic test environment
- Research report Section "Alternative Fix" recommends this change

**Expected Result:**

```typescript
export function isUnitTest(): boolean {
  return process.env.VITEST === 'true';
}
```

**Done When:** Function only returns true when `VITEST='true'`, not when `NODE_ENV='test'`

---

### PLAN-202: Update Preload API Selection Logic

**Change Type:** modify  
**File:** `src/main/preload.ts`

**Instruction:**

1. Locate line 35: `const recipeAPI = isTestEnvironment() ? __mockAPI__ : __originalAPI__;`
2. Change to: `const recipeAPI = isUnitTest() ? __mockAPI__ : __originalAPI__;`
3. Add import for `isUnitTest` at line 4:
   ```typescript
   import { isTestEnvironment, isUnitTest } from './utils/test-env.js';
   ```

**Rationale:**

- Only unit tests should get `__mockAPI__` (frontend mocking)
- E2E tests should get `__originalAPI__` (real IPC with backend mocking)
- Current `isTestEnvironment()` returns true for both unit and E2E tests, causing the bug

**Evidence:**

- `src/main/preload.ts:35` - Current implementation
- Research report Finding 2 shows this conditional API exposure is the root cause

**Expected Result:**

```typescript
import { isTestEnvironment, isUnitTest } from './utils/test-env.js';
// ... (lines 5-34 unchanged)
const recipeAPI = isUnitTest() ? __mockAPI__ : __originalAPI__;
```

**Done When:** Preload only exposes `__mockAPI__` when `isUnitTest()` is true

---

### PLAN-203: Update Test API Exposure Logic

**Change Type:** modify  
**File:** `src/main/preload.ts`

**Instruction:**

1. Locate line 57: `if (isTestEnvironment()) {`
2. Change to: `if (isUnitTest()) {`
3. Leave the rest of the block unchanged (lines 58-72)

**Rationale:**

- `__testAPI__` should only be exposed for unit tests that need to override mocks
- E2E tests don't override frontend mocks (they use backend mocks)
- This prevents unnecessary API exposure during E2E tests

**Evidence:**

- `src/main/preload.ts:57` - Current implementation
- Research report Finding 6 explains this API is for unit test harness, not E2E tests

**Expected Result:**

```typescript
if (isUnitTest()) {
  contextBridge.exposeInMainWorld('__testAPI__', {
    __originalAPI__,
    __mockAPI__,
  });
}
```

**Done When:** `__testAPI__` only exposed when `isUnitTest()` is true

---

### PLAN-204: Revert AI Recipe Generation Test Environment

**Change Type:** modify  
**File:** `e2e/ai-recipe-generation.spec.ts`

**Instruction:**

1. Locate line 10: `NODE_ENV: 'development',` (changed in PLAN-101)
2. Change back to: `NODE_ENV: 'test',`
3. Keep line 11 unchanged: `E2E_TEST: 'true',`

**Rationale:**

- With the refactored environment detection, `NODE_ENV='test'` no longer triggers frontend mocking
- `NODE_ENV='test'` is semantically correct for E2E tests
- `isUnitTest()` now returns false (no `NODE_ENV='test'` check), so preload uses `__originalAPI__`

**Evidence:**

- Research report "Alternative Fix" section recommends this as the final state
- Phase 2 refactoring makes this safe

**Expected Result:**

```typescript
env: {
  ...process.env,
  NODE_ENV: 'test',
  E2E_TEST: 'true',
},
```

**Done When:** File uses `NODE_ENV='test'` (semantically correct for test environment)

---

### PLAN-205: Revert Recipe Import Test Environment

**Change Type:** modify  
**File:** `e2e/recipe-import.spec.ts`

**Instruction:**

1. Locate line 10: `NODE_ENV: 'development',` (changed in PLAN-102)
2. Change back to: `NODE_ENV: 'test',`
3. Keep line 11 unchanged: `E2E_TEST: 'true',`

**Rationale:**

- With the refactored environment detection, `NODE_ENV='test'` no longer triggers frontend mocking
- `NODE_ENV='test'` is semantically correct for E2E tests
- `isUnitTest()` now returns false, so preload uses `__originalAPI__`

**Evidence:**

- Research report "Alternative Fix" section recommends this as the final state
- Phase 2 refactoring makes this safe

**Expected Result:**

```typescript
env: {
  ...process.env,
  NODE_ENV: 'test',
  E2E_TEST: 'true',
},
```

**Done When:** File uses `NODE_ENV='test'` (semantically correct for test environment)

---

### PLAN-206: Verify Phase 2 Final State

**Change Type:** verification  
**Files:** All test files

**Instruction:**
Run all tests (unit tests AND E2E tests) to verify the refactoring maintains correct behavior.

**Verification Commands:**

```bash
# Run all unit tests (should still work with frontend mocks)
npm run test:unit

# Run all E2E tests (should work with real IPC + backend mocks)
npm run test:e2e

# Run all tests together
npm run test:all
```

**Pass Condition:**

- All unit tests pass (frontend mocking still works when `VITEST='true'`)
- All 17 E2E tests pass (real IPC works when `NODE_ENV='test'` but `VITEST` is not set)
- No regressions in any test suite

**Evidence of Success:**

- Unit tests can still override `window.electron` (frontend mocking)
- E2E tests use real IPC communication
- Both test types work correctly with semantically appropriate environment variables

**Done When:**

- All tests pass
- User confirms no regressions
- Environment detection properly separates unit tests from E2E tests

---

## Acceptance Criteria

### Phase 1 Acceptance Criteria

- [ ] `e2e/ai-recipe-generation.spec.ts` uses `NODE_ENV='development'`
- [ ] `e2e/recipe-import.spec.ts` uses `NODE_ENV='development'`
- [ ] All 17 E2E tests pass when run with `npm run test:e2e`
- [ ] User confirms baseline is established

### Phase 2 Acceptance Criteria

- [ ] `isUnitTest()` only checks `VITEST='true'` (no `NODE_ENV='test'` check)
- [ ] Preload uses `isUnitTest()` instead of `isTestEnvironment()` for API selection
- [ ] `__testAPI__` only exposed when `isUnitTest()` is true
- [ ] E2E tests use `NODE_ENV='test'` (semantically correct)
- [ ] All unit tests pass (frontend mocking still works)
- [ ] All E2E tests pass (real IPC works)
- [ ] No test regressions

## Implementor Checklist

### Phase 1: Immediate Fix

- [ ] PLAN-101: Update AI generation test to use NODE_ENV='development'
- [ ] PLAN-102: Update recipe import test to use NODE_ENV='development'
- [ ] PLAN-103: USER VERIFICATION - Run E2E tests and confirm all pass
- [ ] **STOP HERE** - Wait for user approval before proceeding to Phase 2

### Phase 2: Long-term Fix

- [ ] PLAN-201: Refactor isUnitTest() to only check VITEST
- [ ] PLAN-202: Update preload API selection to use isUnitTest()
- [ ] PLAN-203: Update test API exposure to use isUnitTest()
- [ ] PLAN-204: Revert AI generation test to use NODE_ENV='test'
- [ ] PLAN-205: Revert recipe import test to use NODE_ENV='test'
- [ ] PLAN-206: Verify all tests (unit + E2E) pass

## Notes

### Critical Dependencies

- **Phase 2 depends on Phase 1:** User must confirm Phase 1 baseline works before starting Phase 2
- **PLAN-103 is a gate:** No Phase 2 work until user approves
- **Phase 2 is all-or-nothing:** All PLAN-20X tasks must be completed together (they're interdependent)

### Rollback Strategy

- **If Phase 1 fails:** Revert PLAN-101 and PLAN-102, investigate with user
- **If Phase 2 fails:** Revert all PLAN-20X changes, keep Phase 1 fixes (working baseline)

### Why Two Phases?

1. **Risk mitigation:** Phase 1 uses proven working pattern (low risk)
2. **User confidence:** User can verify tests work before architectural changes
3. **Incremental progress:** If Phase 2 has issues, Phase 1 still provides value
4. **Clear rollback points:** Easy to identify which phase caused issues if tests fail

### Design Intent After Phase 2

- `isUnitTest()`: Controls **frontend mocking** (renderer-side test overrides)
- `isE2ETest()`: Controls **backend mocking** (main process mock handlers)
- `isTestEnvironment()`: Remains as helper (returns true for any test type)
- Unit tests: `VITEST='true'` → frontend mocks enabled
- E2E tests: `E2E_TEST='true'` + `NODE_ENV='test'` → backend mocks enabled, frontend uses real IPC
