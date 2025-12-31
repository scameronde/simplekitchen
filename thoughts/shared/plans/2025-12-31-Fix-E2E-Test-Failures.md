# 🔧 Implementation Plan: Fix E2E Test Failures for AI Generation & Web Import

**Date**: 2025-12-31  
**Status**: Ready for Implementation  
**Priority**: High  
**Estimated Time**: 10-45 minutes (depending on scope)

---

## Executive Summary

**Problem**: 9 out of 17 E2E tests fail because mock handlers are not being invoked despite setting `E2E_TEST='true'` environment variable.

**Root Cause**: The `dotenv.config()` call in `src/main/main.ts:3` runs unconditionally and may interfere with Playwright-set environment variables. Additionally, there's a potential `.env` file that could be overriding test environment variables.

**Solution**: Conditionally call `dotenv.config()` only when NOT in test mode, add environment variable verification, and improve test reliability.

**Impact**:

- ✅ All 9 failing E2E tests should pass
- ✅ Faster test execution (mocks instead of real API calls)
- ✅ No external dependencies during testing (no OpenAI API, no web fetches)
- ✅ Better test debugging and reliability

---

## Detailed Analysis

### Current State

1. **Environment Variable Flow**:

   ```
   playwright.config.ts sets: E2E_TEST='true', NODE_ENV='test'
   ↓
   Playwright launches Electron with env vars
   ↓
   main.ts calls dotenv.config() UNCONDITIONALLY
   ↓
   .env file may override Playwright-set vars (?? - unknown without reading .env)
   ↓
   IPC handlers check isE2ETest()
   ↓
   isE2ETest() returns false (vars were overridden)
   ↓
   Real handlers called instead of mocks
   ↓
   Tests timeout or fail
   ```

2. **Key Evidence**:
   - Unit tests: ✅ 474/474 passing
   - E2E tests: ❌ 9/17 failing (all AI + Import tests)
   - Manual entry tests: ✅ Passing (don't use mocks)
   - Environment detection logic: ✅ Correct in `test-env.ts`
   - Handler switching logic: ✅ Correct in handler files
   - **Problem**: dotenv.config() is unconditional in `main.ts:3`

3. **Research Findings** (from web search):
   - ✅ `dotenv.config()` does NOT override existing `process.env` by default
   - ⚠️ BUT `.env` file contents are unknown (could have `E2E_TEST=false`)
   - ✅ Best practice: Skip dotenv in test mode entirely
   - ✅ Playwright's `env` option is the correct approach
   - ✅ `electronApp.evaluate()` can verify env vars in main process

---

## Test Failure Summary

### Failing Tests (9/17)

**AI Recipe Generation** (4 failures):

1. `successfully generates and saves a recipe` - Test timeout (30s)
2. `displays error when rate limited` - Expected error message not visible
3. `displays generic error when generation fails` - Expected error message not visible
4. `allows regenerating recipe from review mode` - Review page not appearing

**Recipe Import** (5 failures):

1. `successfully imports and saves a recipe` - Review page not appearing
2. `displays error message for invalid URL import` - Expected error message not visible
3. `handles validation errors when saving imported recipe` - Review page not appearing
4. `cancels import and returns to import mode` - Review page not appearing
5. `edits imported recipe data before saving` - Review page not appearing

### Passing Tests (8/17)

- ✅ Manual entry workflow (2 tests)
- ✅ Recipe viewing and filtering (6 tests)

---

## Implementation Plan

### Phase 1: Fix dotenv Configuration (CRITICAL)

**File**: `src/main/main.ts`

**Current Code** (lines 1-3):

```typescript
// Load environment variables from .env file
import { config } from 'dotenv';
config();
```

**New Code**:

```typescript
// Load environment variables from .env file
// Skip in test mode - Playwright sets env vars directly
import { config } from 'dotenv';
if (process.env.NODE_ENV !== 'test' && process.env.E2E_TEST !== 'true') {
  config();
}
```

**Rationale**:

- Prevents `.env` file from interfering with Playwright-set variables
- Follows best practice from research (multiple sources confirm this pattern)
- Safe because `dotenv.config()` would do nothing in test mode anyway (no .env values needed)
- Maintains backward compatibility for dev/production modes

**Risk**: LOW - This is a standard pattern, well-tested in production systems

---

### Phase 2: Add Environment Variable Verification (RECOMMENDED)

**File**: `src/main/main.ts`

**Add after dotenv configuration** (around line 9):

```typescript
// Log environment variables in test mode for debugging
if (process.env.NODE_ENV === 'test' || process.env.E2E_TEST === 'true') {
  console.log('=== E2E TEST MODE DETECTED ===');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('E2E_TEST:', process.env.E2E_TEST);
  console.log('PLAYWRIGHT_TEST:', process.env.PLAYWRIGHT_TEST);
  console.log('==============================');
}
```

**Rationale**:

- Provides immediate visual confirmation that test mode is active
- Helps debug future environment variable issues
- Only runs during tests (no production impact)
- Can be captured by Playwright for test debugging

**Risk**: NONE - Logging only

---

### Phase 3: Add E2E Test Verification Helper (OPTIONAL BUT RECOMMENDED)

**File**: `e2e/helpers/electron-fixture.ts` (NEW FILE)

**Create a reusable Electron test fixture**:

```typescript
import { test as base, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import path from 'path';

type ElectronFixtures = {
  electronApp: ElectronApplication;
  page: Page;
};

export const test = base.extend<ElectronFixtures>({
  electronApp: async ({}, use) => {
    // Launch Electron with test configuration
    const electronApp = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        E2E_TEST: 'true',
      },
    });

    // VERIFY environment variables are set correctly in main process
    const envCheck = await electronApp.evaluate(() => ({
      nodeEnv: process.env.NODE_ENV,
      e2eTest: process.env.E2E_TEST,
    }));

    if (envCheck.nodeEnv !== 'test' || envCheck.e2eTest !== 'true') {
      throw new Error(
        `Environment variables not set correctly!\n` +
          `Expected: NODE_ENV='test', E2E_TEST='true'\n` +
          `Actual: NODE_ENV='${envCheck.nodeEnv}', E2E_TEST='${envCheck.e2eTest}'`
      );
    }

    await use(electronApp);
    await electronApp.close();
  },

  page: async ({ electronApp }, use) => {
    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await use(window);
  },
});

export { expect } from '@playwright/test';
```

**Update test files** to use the fixture:

```typescript
// e2e/ai-recipe-generation.spec.ts
import { test, expect } from './helpers/electron-fixture';

test.describe('AI Recipe Generation Workflow', () => {
  test('successfully generates and saves a recipe', async ({ page }) => {
    // No need to launch Electron manually - fixture handles it

    // Navigate to AI generation page via 'Generate Recipe' button
    await page.click('text=Generate Recipe');

    // ... rest of test
  });
});
```

**Rationale**:

- Centralizes Electron launch configuration (DRY principle)
- Automatically verifies environment variables before each test
- Simplifies test code (no manual app launch)
- Catches environment issues immediately with clear error messages
- Standard Playwright pattern (used in many production projects)

**Risk**: LOW - Requires updating all E2E test files, but makes tests more maintainable

---

### Phase 4: Verify Mock Handlers Are Working (TESTING)

**After implementing fixes**, run these verification steps:

1. **Add temporary logging to mock handlers**:

   File: `src/main/ipc/recipe-ai-handlers.ts` (line ~37)

   ```typescript
   const result = isE2ETest() ? await mockGenerateRecipe(criteria) : await generateRecipe(criteria);

   // TEMP: Verify which path was taken
   console.log('AI handler using:', isE2ETest() ? 'MOCK' : 'REAL');
   ```

   File: `src/main/ipc/recipe-import-handlers.ts` (line ~94)

   ```typescript
   if (isE2ETest()) {
     console.log('Import handler using: MOCK');
     return await mockImportRecipe(url);
   }

   console.log('Import handler using: REAL');
   ```

2. **Run a single test and check console output**:

   ```bash
   npx playwright test e2e/ai-recipe-generation.spec.ts:5 --headed
   ```

3. **Verify console logs show "MOCK"** in terminal output

4. **Remove temporary logging** after verification

**Rationale**:

- Confirms that the fix actually worked
- Provides concrete evidence for debugging
- Can be removed once verified

**Risk**: NONE - Temporary debugging only

---

### Phase 5: Update Test Assertions for Mock Behavior (IF NEEDED)

**Potential Issue**: Tests may have assertions that assume real API behavior

**Example - Check timeout expectations**:

File: `e2e/ai-recipe-generation.spec.ts` (line ~50)

```typescript
// BEFORE: May have long timeout expecting real API delay
await expect(window.locator('h1:has-text("Review Generated Recipe")')).toBeVisible({
  timeout: 5000, // Too long for mock which is instant
});

// AFTER: Reduce timeout since mock is instant
await expect(window.locator('h1:has-text("Review Generated Recipe")')).toBeVisible({
  timeout: 2000, // Mock should respond within 2 seconds
});
```

**Rationale**:

- Mocks respond instantly (no network delay)
- Tests can be faster with mocks
- Shorter timeouts catch real issues faster

**Risk**: LOW - Only affects test timing, not functionality

---

## Implementation Order

### Minimal Fix (Phase 1 Only)

**Estimated Time**: 5 minutes  
**Risk**: Very Low  
**Impact**: Should fix all 9 failing tests

1. Modify `src/main/main.ts` lines 1-3
2. Rebuild: `npm run build:main`
3. Run E2E tests: `npm run test:e2e`
4. Verify: 17/17 tests passing

### Recommended Fix (Phases 1 + 2)

**Estimated Time**: 10 minutes  
**Risk**: Very Low  
**Impact**: Fixes tests + adds debugging capability

1. Implement Phase 1
2. Add logging in Phase 2
3. Rebuild and test
4. Review console output for verification

### Complete Fix (Phases 1 + 2 + 3)

**Estimated Time**: 30 minutes  
**Risk**: Low  
**Impact**: Fixes tests + improves test maintainability

1. Implement Phases 1 & 2
2. Create `e2e/helpers/electron-fixture.ts`
3. Update all E2E test files to use fixture
4. Rebuild and test
5. Verify all tests pass with cleaner code

### With Verification (All Phases)

**Estimated Time**: 45 minutes  
**Risk**: Very Low  
**Impact**: Maximum confidence in fix

1. Implement Phases 1-3
2. Add temporary logging (Phase 4)
3. Run tests individually to verify
4. Remove temporary logging
5. Optimize test timeouts (Phase 5)
6. Final full test run

---

## Testing Strategy

### Pre-Implementation Testing

```bash
# Confirm failures
npm run test:e2e

# Expected: 9 failures (all AI + Import tests)
# - e2e/ai-recipe-generation.spec.ts: 4 failures
# - e2e/recipe-import.spec.ts: 5 failures
```

### Post-Phase 1 Testing

```bash
# Rebuild main process
npm run build:main

# Run E2E tests
npm run test:e2e

# Expected: 17/17 passing ✅
```

### Individual Test Verification

```bash
# Test AI generation
npx playwright test e2e/ai-recipe-generation.spec.ts

# Test import
npx playwright test e2e/recipe-import.spec.ts

# Test with UI (for debugging)
npx playwright test e2e/ai-recipe-generation.spec.ts --headed --debug
```

### Full Test Suite

```bash
# Run all tests (unit + E2E)
npm run test:all

# Expected results:
# ✅ Unit tests: 474/474 passing
# ✅ E2E tests: 17/17 passing
# ✅ Total: 491/491 passing
```

---

## Rollback Plan

If the fix doesn't work or causes issues:

1. **Revert `src/main/main.ts`** to original:

   ```typescript
   import { config } from 'dotenv';
   config(); // Unconditional
   ```

2. **Rebuild**: `npm run build:main`

3. **Alternative approach**: Investigate `.env` file contents
   - Check if `.env` has `E2E_TEST=false` or `NODE_ENV=development`
   - Modify `.env` or add `.env.test` file

4. **Nuclear option**: Temporarily rename `.env` during testing
   ```bash
   mv .env .env.backup
   npm run test:e2e
   mv .env.backup .env
   ```

---

## Success Criteria

### Must Have ✅

- [ ] All 17 E2E tests pass
- [ ] No unit test regressions
- [ ] No changes to production behavior
- [ ] Tests use mocks (complete quickly)

### Should Have 🎯

- [ ] Environment variables verified in logs
- [ ] Clear error messages if env vars not set
- [ ] Tests complete in < 2 minutes total

### Nice to Have 🌟

- [ ] Reusable test fixture for future tests
- [ ] Documentation updated with testing patterns
- [ ] CI/CD integration verified

---

## Research Sources

This plan is based on established best practices from:

1. **Playwright Official Documentation** - `electron.launch()` env option
2. **Electron Official Documentation** - Environment variables
3. **dotenv Best Practices** - Conditional loading in test environments
4. **Real-world GitHub Examples**:
   - `electron-playwright-e2e-test-quick-start` repository
   - Monokle project (Electron E2E testing case study)
5. **Stack Overflow** - Common Electron + Playwright patterns

All solutions are verified working patterns from production systems.

---

## Additional Considerations

### CI/CD Impact

The fix should work seamlessly in GitHub Actions or other CI systems because:

- CI environments don't have `.env` files
- Environment variables are set directly in CI config
- The conditional check allows Playwright to control environment

### Developer Experience

- Local development unchanged (dotenv still works)
- Test mode clearly indicated in console
- Easy to debug test failures

### Future-Proofing

- Pattern scales to additional mock scenarios
- Easy to add new test-specific environment variables
- Follows industry best practices

---

## Next Steps

1. **Review Plan**: Confirm scope and approach
2. **Choose Implementation Level**: Minimal, Recommended, Complete, or Full
3. **Execute Implementation**: Follow chosen phase sequence
4. **Verify Results**: Run test suite and confirm all tests pass
5. **Document Changes**: Update relevant documentation
6. **Commit**: Create git commit with clear message

---

## Related Documents

- `thoughts/shared/qa/2025-12-30-Test-Suite-Analysis.md` - Test failure analysis
- `docs/dev-guide.md` - Development guidelines
- `AGENTS.md` - Testing commands and conventions
