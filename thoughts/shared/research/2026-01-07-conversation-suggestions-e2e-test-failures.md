---
date: 2026-01-07
researcher: assistant
topic: "Conversation Suggestions E2E Test Failures"
status: complete
coverage:
  - e2e/conversation-suggestions.spec.ts
  - e2e/*.spec.ts (all working tests for pattern comparison)
  - playwright.config.ts
---

# Research: Conversation Suggestions E2E Test Failures

## Executive Summary
- Both tests in `e2e/conversation-suggestions.spec.ts` fail with "Cannot navigate to invalid URL" error.
- Root cause: Missing Electron app launch setup; using standard web-based Playwright pattern instead of Electron pattern.
- All working E2E tests use `electron.launch()` + `firstWindow()` pattern.
- The failing test uses `page` fixture from `@playwright/test` which expects a web server.
- SimpleKitchen is an Electron desktop app, not a web app - requires Electron-specific launch.
- Fix requires replacing web test pattern with Electron test pattern (5 structural changes).

## Coverage Map
Inspected files:
- `e2e/conversation-suggestions.spec.ts` (failing test file)
- `e2e/manual-entry.spec.ts` (working test - reference pattern)
- `e2e/ai-recipe-generation.spec.ts` (working test - reference pattern)
- `e2e/recipe-viewing.spec.ts` (working test - reference pattern)
- `playwright.config.ts` (configuration verification)

Scope: E2E test architecture patterns only. Did not inspect conversation feature implementation or UI components.

## Critical Findings (Verified, Planner Attention Required)

### Finding 1: Test Uses Web App Pattern Instead of Electron Pattern

**Observation:** `e2e/conversation-suggestions.spec.ts` lines 4-6 use standard Playwright web test pattern:
```typescript
test('should display recipe suggestions after conversation', async ({ page }) => {
  // Navigate to conversation page
  await page.goto('/');
```

**Direct consequence:** `page.goto('/')` requires a valid HTTP URL (e.g., `http://localhost:3000/`). Without an Electron app launch or web server, `/` is an invalid URL, causing the protocol error.

**Evidence:** `e2e/conversation-suggestions.spec.ts:4-6` and `e2e/conversation-suggestions.spec.ts:43-45`

**Excerpt:**
```typescript
test('should display recipe suggestions after conversation', async ({ page }) => {
  // Navigate to conversation page
  await page.goto('/');
```

### Finding 2: Missing Electron Import

**Observation:** `e2e/conversation-suggestions.spec.ts` line 1 imports only `test` and `expect`:
```typescript
import { test, expect } from '@playwright/test';
```

**Direct consequence:** The `_electron` API is unavailable. Cannot call `electron.launch()` to start the Electron application.

**Evidence:** `e2e/conversation-suggestions.spec.ts:1`

### Finding 3: All Working Tests Follow Electron Launch Pattern

**Observation:** Every working E2E test file uses this exact pattern:
1. Import `_electron as electron` from `playwright`
2. Call `electron.launch({ args: ['.'], env: {...} })` at test start
3. Get window via `electronApp.firstWindow()`
4. Wait for DOM with `window.waitForLoadState('domcontentloaded')`
5. Use `window` (not `page`) for all interactions
6. Call `electronApp.close()` at test end

**Direct consequence:** This is the required pattern for testing Electron apps in this codebase. Deviating from it causes launch failures.

**Evidence:** 
- `e2e/manual-entry.spec.ts:2` and `e2e/manual-entry.spec.ts:4-14`
- `e2e/ai-recipe-generation.spec.ts:2` and `e2e/ai-recipe-generation.spec.ts:5-16`
- `e2e/recipe-viewing.spec.ts:2` and `e2e/recipe-viewing.spec.ts:29-39`

**Excerpt from `e2e/manual-entry.spec.ts:2-14`:**
```typescript
import { _electron as electron } from 'playwright';

test('complete manual recipe entry workflow', async () => {
  const electronApp = await electron.launch({
    args: ['.'],
    env: {
      ...process.env,
      NODE_ENV: 'development',
    },
  });

  const window = await electronApp.firstWindow();
  await window.waitForLoadState('domcontentloaded');
```

### Finding 4: Playwright Config Has No Web Server Configuration

**Observation:** `playwright.config.ts` lines 1-17 contains no `baseURL` or `webServer` configuration:
```typescript
export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 0,
  workers: 1,
  use: {
    trace: 'on-first-retry',
  },
});
```

**Direct consequence:** The Playwright configuration confirms this project uses Electron-only testing. There is no web server to serve pages at `/`. The `page.goto('/')` approach is architecturally incompatible.

**Evidence:** `playwright.config.ts:8-16`

### Finding 5: Test Function Signature Uses Page Fixture

**Observation:** Both failing tests use `async ({ page })` in the function signature:
```typescript
test('should display recipe suggestions after conversation', async ({ page }) => {
```

**Direct consequence:** The `page` fixture from `@playwright/test` is injected but uninitialized (no web server). This parameter must be removed and replaced with manual Electron app launch.

**Evidence:** `e2e/conversation-suggestions.spec.ts:4` and `e2e/conversation-suggestions.spec.ts:43`

## Detailed Technical Analysis (Verified)

### Test File Structure Comparison

**Failing test structure (`conversation-suggestions.spec.ts`):**
```
1. Import { test, expect } from '@playwright/test'
2. test.describe block
3. test('...', async ({ page }) => {
4.   await page.goto('/')
5.   [test actions using page]
6. })
```

**Working test structure (all other E2E tests):**
```
1. Import { test, expect } from '@playwright/test'
2. Import { _electron as electron } from 'playwright'
3. test.describe block OR direct test
4. test('...', async () => {  // NO page fixture
5.   const electronApp = await electron.launch({ args: ['.'], env: {...} })
6.   const window = await electronApp.firstWindow()
7.   await window.waitForLoadState('domcontentloaded')
8.   [test actions using window]
9.   await electronApp.close()
10. })
```

### Environment Variable Patterns

**Observation:** Working tests use different `NODE_ENV` values:
- `manual-entry.spec.ts`: `NODE_ENV: 'development'` (line 9)
- `ai-recipe-generation.spec.ts`: `NODE_ENV: 'test'` with `E2E_TEST: 'true'` (lines 10-11)
- `recipe-viewing.spec.ts`: `NODE_ENV: 'development'` with `E2E_TEST: 'true'` (lines 33-34)

**Direct consequence:** The conversation-suggestions test should likely use `NODE_ENV: 'test'` and `E2E_TEST: 'true'` to match the AI-related test patterns and enable test-specific code paths (as set in `playwright.config.ts:5`).

**Evidence:** 
- `e2e/manual-entry.spec.ts:7-10`
- `e2e/ai-recipe-generation.spec.ts:8-12`
- `e2e/recipe-viewing.spec.ts:31-35`
- `playwright.config.ts:5`

### Required Structural Changes

1. **Add import:** `import { _electron as electron } from 'playwright';`
2. **Remove page fixture:** Change `async ({ page })` to `async ()`
3. **Add launch code:** Insert `electronApp.launch()` + `firstWindow()` setup
4. **Replace references:** Change all `page.` to `window.`
5. **Remove goto:** Delete `await page.goto('/')` line (app launches to home by default)
6. **Add cleanup:** Insert `await electronApp.close()` at test end

### Error Message Analysis

**Observation:** The error message is:
```
Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
  - navigating to "/", waiting until "load"
```

**Direct consequence:** The Playwright `page` object exists but has no browser context or valid base URL. The `/` path cannot be resolved to an HTTP URL. This confirms the `page` fixture is for web testing, not Electron.

**Evidence:** Test output from command execution (lines 14-27 and 29-42 of test output)

## Verification Log

**Verified:** Personally read the following files with `read` tool:
- `e2e/conversation-suggestions.spec.ts`
- `playwright.config.ts`
- `e2e/manual-entry.spec.ts`
- `e2e/ai-recipe-generation.spec.ts`
- `e2e/recipe-viewing.spec.ts`

**Spot-checked excerpts captured:** Yes - all findings include exact line numbers and 1-6 line excerpts from verified reads.

## Open Questions / Unverified Claims

None. All findings were directly verified by reading source files and comparing test execution output.

## References

Verified file references:
- `e2e/conversation-suggestions.spec.ts:1` (import statement)
- `e2e/conversation-suggestions.spec.ts:4-6` (first test signature + goto)
- `e2e/conversation-suggestions.spec.ts:43-45` (second test signature + goto)
- `playwright.config.ts:8-16` (config structure)
- `playwright.config.ts:5` (E2E_TEST environment variable)
- `e2e/manual-entry.spec.ts:2` (electron import)
- `e2e/manual-entry.spec.ts:4-14` (launch pattern)
- `e2e/ai-recipe-generation.spec.ts:2` (electron import)
- `e2e/ai-recipe-generation.spec.ts:5-16` (launch pattern with test env)
- `e2e/recipe-viewing.spec.ts:2` (electron import)
- `e2e/recipe-viewing.spec.ts:29-39` (launch pattern with E2E_TEST flag)
