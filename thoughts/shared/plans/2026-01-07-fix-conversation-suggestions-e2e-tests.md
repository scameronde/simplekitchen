# Fix Conversation Suggestions E2E Test Failures

## Inputs
- Research report used: `thoughts/shared/research/2026-01-07-conversation-suggestions-e2e-test-failures.md`
- User request summary: Fix the failing e2e tests in `conversation-suggestions.spec.ts`

## Verified Current State

### Fact 1: Test File Uses Web App Pattern Instead of Electron Pattern
**Evidence:** `e2e/conversation-suggestions.spec.ts:1-6`
**Excerpt:**
```typescript
import { test, expect } from '@playwright/test';

test.describe('Conversation to Suggestions Flow', () => {
  test('should display recipe suggestions after conversation', async ({ page }) => {
    // Navigate to conversation page
    await page.goto('/');
```
**Impact:** The test uses the standard Playwright web test pattern with `page` fixture and `page.goto('/')`, which requires an HTTP server. SimpleKitchen is an Electron app and has no web server configured.

### Fact 2: Missing Electron Import
**Evidence:** `e2e/conversation-suggestions.spec.ts:1`
**Excerpt:**
```typescript
import { test, expect } from '@playwright/test';
```
**Impact:** The `_electron` API is not imported, making it impossible to launch the Electron application.

### Fact 3: All Working Tests Use Electron Launch Pattern
**Evidence:** `e2e/ai-recipe-generation.spec.ts:1-16`
**Excerpt:**
```typescript
import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';

test.describe('AI Recipe Generation Workflow', () => {
  test('successfully generates and saves a recipe', async () => {
    const electronApp = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        E2E_TEST: 'true',
      },
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
```
**Impact:** This is the established pattern for all working E2E tests. The conversation suggestions test must follow this exact pattern.

### Fact 4: Test Uses Page Fixture in Function Signature
**Evidence:** `e2e/conversation-suggestions.spec.ts:4` and `e2e/conversation-suggestions.spec.ts:43`
**Excerpt:**
```typescript
test('should display recipe suggestions after conversation', async ({ page }) => {
```
**Impact:** The `{ page }` fixture parameter must be removed since Electron tests manually create the window object.

### Fact 5: Working Tests Use NODE_ENV='test' and E2E_TEST='true'
**Evidence:** `e2e/ai-recipe-generation.spec.ts:9-11`
**Excerpt:**
```typescript
env: {
  ...process.env,
  NODE_ENV: 'test',
  E2E_TEST: 'true',
},
```
**Impact:** The conversation suggestions tests should use the same environment configuration to enable test-specific code paths and AI mocking.

### Fact 6: Test Has Two Test Cases
**Evidence:** `e2e/conversation-suggestions.spec.ts:4` and `e2e/conversation-suggestions.spec.ts:43`
**Test 1:** "should display recipe suggestions after conversation" (lines 4-41)
**Test 2:** "should continue conversation if AI needs more info" (lines 43-67)
**Impact:** Both test cases need identical structural changes to use the Electron pattern.

## Goals / Non-Goals

### Goals
1. Convert both test cases to use Electron launch pattern
2. Replace web `page` fixture with Electron `window` object
3. Remove invalid `page.goto('/')` calls
4. Add proper Electron app cleanup (`electronApp.close()`)
5. Ensure tests use correct environment variables (`NODE_ENV: 'test'`, `E2E_TEST: 'true'`)
6. Maintain all existing test logic and assertions

### Non-Goals
- Modifying the conversation feature implementation
- Changing test assertions or test coverage
- Updating other E2E test files
- Investigating whether the tests will pass after structural fixes (that's a separate verification step)

## Design Overview

The fix involves converting the test file from a web-based Playwright pattern to an Electron-based Playwright pattern:

1. **Import Change**: Add `import { _electron as electron } from 'playwright'`
2. **Test Signature Change**: Remove `{ page }` fixture from both test function signatures
3. **Launch Setup**: Add Electron app launch code at the start of each test
4. **Window Initialization**: Replace `page` references with `window` object from `electronApp.firstWindow()`
5. **Navigation Removal**: Remove `await page.goto('/')` since the Electron app launches to home by default
6. **Cleanup Addition**: Add `await electronApp.close()` at the end of each test

The Electron app will automatically navigate to the home page on launch, so the test can immediately click the "What's for dinner?" button to enter the conversation flow.

## Implementation Instructions (For Implementor)

### PLAN-001: Add Electron Import
**Change Type:** modify
**File:** `e2e/conversation-suggestions.spec.ts`
**Instruction:**
1. Locate line 1: `import { test, expect } from '@playwright/test';`
2. After line 1, add a new line 2: `import { _electron as electron } from 'playwright';`

**Evidence:** `e2e/ai-recipe-generation.spec.ts:1-2` shows this is the required import pattern for Electron tests.

**Done When:** The file has both imports at the top:
```typescript
import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';
```

### PLAN-002: Update First Test - Remove Page Fixture and Add Electron Launch
**Change Type:** modify
**File:** `e2e/conversation-suggestions.spec.ts`
**Instruction:**
1. Locate line 4: `test('should display recipe suggestions after conversation', async ({ page }) => {`
2. Remove the `{ page }` parameter, changing it to: `test('should display recipe suggestions after conversation', async () => {`
3. After line 4 (the updated test signature), insert the Electron launch code:
```typescript
    const electronApp = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        E2E_TEST: 'true',
      },
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
```
4. Delete lines 5-6 (the comment and `await page.goto('/')` line)
5. Keep the `await page.click("text=What's for dinner?");` line but it will be updated in PLAN-003

**Evidence:** `e2e/ai-recipe-generation.spec.ts:5-16` shows the exact Electron launch pattern to use.

**Done When:** 
- Test signature has no `{ page }` parameter
- Electron launch code exists at the start of the test
- No `page.goto('/')` line exists

### PLAN-003: Update First Test - Replace All Page References with Window
**Change Type:** modify
**File:** `e2e/conversation-suggestions.spec.ts`
**Instruction:**
1. Within the first test case (lines 4-41), find all instances of `page.` and replace with `window.`
2. Specifically replace:
   - `await page.click("text=What's for dinner?");` → `await window.click("text=What's for dinner?");`
   - `await expect(page.locator('h1')).toContainText("What's for dinner?");` → `await expect(window.locator('h1')).toContainText("What's for dinner?");`
   - `const input = page.locator(...)` → `const input = window.locator(...)`
   - `const sendButton = page.locator(...)` → `const sendButton = window.locator(...)`
   - All remaining `page.locator(...)` → `window.locator(...)`

**Evidence:** `e2e/ai-recipe-generation.spec.ts:19-70` shows consistent use of `window.` instead of `page.`

**Done When:** No references to `page` exist within the first test case; all are `window`.

### PLAN-004: Update First Test - Add Cleanup
**Change Type:** modify
**File:** `e2e/conversation-suggestions.spec.ts`
**Instruction:**
1. Locate the end of the first test case (after the last assertion with the "Not this one" button check)
2. Before the closing `});` of the test function, add a new line: `await electronApp.close();`

**Evidence:** `e2e/ai-recipe-generation.spec.ts:71` shows the cleanup pattern.

**Done When:** The first test case ends with `await electronApp.close();` before the closing brace.

### PLAN-005: Update Second Test - Remove Page Fixture and Add Electron Launch
**Change Type:** modify
**File:** `e2e/conversation-suggestions.spec.ts`
**Instruction:**
1. Locate line 43: `test('should continue conversation if AI needs more info', async ({ page }) => {`
2. Remove the `{ page }` parameter, changing it to: `test('should continue conversation if AI needs more info', async () => {`
3. After line 43 (the updated test signature), insert the Electron launch code:
```typescript
    const electronApp = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        E2E_TEST: 'true',
      },
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
```
4. Delete the comment and `await page.goto('/')` line (lines 44-45)
5. Keep the `await page.click("text=What's for dinner?");` line but it will be updated in PLAN-006

**Evidence:** `e2e/ai-recipe-generation.spec.ts:74-85` shows the pattern for second and subsequent tests in a describe block.

**Done When:** 
- Test signature has no `{ page }` parameter
- Electron launch code exists at the start of the test
- No `page.goto('/')` line exists

### PLAN-006: Update Second Test - Replace All Page References with Window
**Change Type:** modify
**File:** `e2e/conversation-suggestions.spec.ts`
**Instruction:**
1. Within the second test case (lines 43-67), find all instances of `page.` and replace with `window.`
2. Specifically replace:
   - `await page.click("text=What's for dinner?");` → `await window.click("text=What's for dinner?");`
   - `await expect(page.locator('h1')).toContainText("What's for dinner?");` → `await expect(window.locator('h1')).toContainText("What's for dinner?");`
   - `const input = page.locator(...)` → `const input = window.locator(...)`
   - `const sendButton = page.locator(...)` → `const sendButton = window.locator(...)`
   - `await expect(page.locator(...)).not.toBeVisible();` → `await expect(window.locator(...)).not.toBeVisible();`
   - `const aiMessages = page.locator(...)` → `const aiMessages = window.locator(...)`

**Evidence:** `e2e/ai-recipe-generation.spec.ts:88-103` shows consistent use of `window.` in all test cases.

**Done When:** No references to `page` exist within the second test case; all are `window`.

### PLAN-007: Update Second Test - Add Cleanup
**Change Type:** modify
**File:** `e2e/conversation-suggestions.spec.ts`
**Instruction:**
1. Locate the end of the second test case (after the last assertion checking `aiMessages` count)
2. Before the closing `});` of the test function, add a new line: `await electronApp.close();`

**Evidence:** `e2e/ai-recipe-generation.spec.ts:104` shows the cleanup pattern for the second test.

**Done When:** The second test case ends with `await electronApp.close();` before the closing brace.

## Acceptance Criteria

1. **File compiles without errors**: `npm run typecheck` passes
2. **Import structure matches working tests**: File has both `@playwright/test` and `playwright` imports
3. **Both tests use Electron pattern**: No `{ page }` fixtures, both tests have `electronApp.launch()` and `firstWindow()`
4. **No web-based navigation**: No `page.goto()` calls exist
5. **All references updated**: No `page.` references exist; all are `window.`
6. **Proper cleanup**: Both tests call `await electronApp.close()` at the end
7. **Environment variables set**: Both tests use `NODE_ENV: 'test'` and `E2E_TEST: 'true'`
8. **Tests run without "invalid URL" error**: Running `npm run test:e2e -- e2e/conversation-suggestions.spec.ts` does not produce "Cannot navigate to invalid URL" error

## Implementor Checklist

- [ ] PLAN-001: Add Electron import
- [ ] PLAN-002: Update first test - remove page fixture and add Electron launch
- [ ] PLAN-003: Update first test - replace all page references with window
- [ ] PLAN-004: Update first test - add cleanup
- [ ] PLAN-005: Update second test - remove page fixture and add Electron launch
- [ ] PLAN-006: Update second test - replace all page references with window
- [ ] PLAN-007: Update second test - add cleanup

## Notes

After implementation, the tests may still fail if:
- The conversation feature implementation has bugs
- The AI mocking for conversation is not properly configured
- The UI selectors have changed
- The conversation flow has timing issues

However, those failures will be **feature/implementation failures**, not **architectural failures**. The "Cannot navigate to invalid URL" error will be resolved, which is the goal of this plan.

The Implementor should run the tests after completion to verify the architectural fix worked, but should NOT attempt to fix feature-level test failures as part of this plan.
