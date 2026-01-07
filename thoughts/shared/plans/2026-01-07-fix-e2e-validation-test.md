# Fix E2E Validation Test Implementation Plan

## Inputs
- **Research report used:** `thoughts/shared/research/2026-01-07-e2e-validation-test-failure.md`
- **User request summary:** Fix the failing E2E test `displays validation errors for invalid recipe` in `e2e/manual-entry.spec.ts`

## Verified Current State

### Fact 1: Time validation uses strict greater-than comparison
- **Evidence:** `src/main/validation/time-validator.ts:36`
- **Excerpt:**
```typescript
// Validate maximum total time (60 minutes)
if (totalTime > MAX_TOTAL_TIME) {
  errors.push({
```
- **Consequence:** 60 minutes equals the limit (60 > 60 = false), so validation passes. Only 61+ minutes trigger error.

### Fact 2: MAX_TOTAL_TIME constant is 60
- **Evidence:** `src/main/validation/time-validator.ts:5`
- **Excerpt:**
```typescript
const MAX_TOTAL_TIME = 60;
```

### Fact 3: Test uses 60 minutes expecting it to fail
- **Evidence:** `e2e/manual-entry.spec.ts:51`
- **Excerpt:**
```typescript
await window.fill('#input-cooking-time-\\(minutes\\)', '60'); // Exceeds limit
```
- **Consequence:** Comment is incorrect. 60 does not exceed the limit; it equals it.

### Fact 4: Default dietary profile has empty hard restrictions
- **Evidence:** `src/main/database/migrations.ts:108-111`
- **Excerpt:**
```typescript
// Initialize default dietary profile with NO restrictions
rawDb
  .prepare(
    `INSERT INTO dietary_profile (id, hard_restrictions, updated_at) 
     VALUES (?, ?, ?)`
  )
  .run(1, '[]', new Date().toISOString());
```

### Fact 5: Migration 003 resets profile to empty restrictions
- **Evidence:** `src/main/database/migrations.ts:139-145`
- **Excerpt:**
```typescript
// Clear hard restrictions for existing users (they can re-add if needed)
rawDb
  .prepare(
    `UPDATE dietary_profile 
     SET hard_restrictions = '[]', updated_at = ? 
     WHERE id = 1`
  )
  .run(new Date().toISOString());
```

### Fact 6: Dietary validation requires profile restrictions to exist
- **Evidence:** `src/main/validation/dietary-validator.ts:84-86`
- **Excerpt:**
```typescript
// Map dietary property to restriction tag
const violatedRestriction = mapPropertyToRestriction(property, profile.hardRestrictions);

if (violatedRestriction) {
```
- **Consequence:** With empty hardRestrictions array, mapPropertyToRestriction will never find a match, so butter (contains-lactose) passes validation.

### Fact 7: Test expects "Please fix the following" message to appear
- **Evidence:** `e2e/manual-entry.spec.ts:60`
- **Excerpt:**
```typescript
// Verify errors displayed
await expect(window.locator('text=/Please fix the following/')).toBeVisible({ timeout: 5000 });
```
- **Consequence:** This message only appears when errors exist. With current test data (60 minutes + butter), zero errors are generated, so test fails.

## Goals / Non-Goals

### Goals
- Fix the E2E test `displays validation errors for invalid recipe` so it passes
- Use test data that actually triggers validation errors
- Ensure test verifies the validation system is working correctly

### Non-Goals
- Modify validation logic (it works correctly)
- Change the MAX_TOTAL_TIME constant
- Add new validation rules
- Modify the dietary profile system

## Design Overview

The test currently fails because its assumptions about what triggers validation errors are incorrect:
1. **Time validation:** Test uses 60 minutes, but this equals the limit (not exceeds). Need 61+ minutes.
2. **Dietary validation:** Test uses butter expecting lactose error, but default profile has no lactose-free restriction.

**Solution:** Update test data to trigger actual validation errors:
1. Change cooking time from 60 to 61 minutes (exceeds MAX_TOTAL_TIME)
2. Either:
   - **Option A:** Set up dietary profile with lactose-free restriction before test
   - **Option B:** Use a simpler validation error (time is sufficient for this test)

**Recommended approach:** Option B (simpler, faster, requires only one-line change)
- The test is validating that error display works
- Time validation error is sufficient to prove this
- No need to set up dietary profile state

## Implementation Instructions (For Implementor)

### PLAN-001: Update test to use time value that exceeds limit
- **Action ID:** PLAN-001
- **Change Type:** modify
- **File:** `e2e/manual-entry.spec.ts`
- **Instruction:**
  1. Locate line 51: `await window.fill('#input-cooking-time-\\(minutes\\)', '60');`
  2. Change the value from `'60'` to `'61'`
  3. Update the inline comment from `// Exceeds limit` to `// Exceeds 60 minute limit`
  4. The line should become:
     ```typescript
     await window.fill('#input-cooking-time-\\(minutes\\)', '61'); // Exceeds 60 minute limit
     ```
- **Evidence:** `src/main/validation/time-validator.ts:36` - uses `totalTime > MAX_TOTAL_TIME`, so 61 > 60 = true (triggers error)
- **Done When:** 
  - Line 51 contains `'61'` instead of `'60'`
  - Comment accurately reflects that 61 exceeds the 60-minute limit

### PLAN-002: Verify test passes with updated data
- **Action ID:** PLAN-002
- **Change Type:** verify
- **Instruction:**
  1. Run the specific E2E test: `npx playwright test e2e/manual-entry.spec.ts -g "displays validation errors"`
  2. Verify the test passes (exits with code 0)
  3. Verify test output shows "1 passed"
- **Evidence:** After PLAN-001, the test will:
  - Submit form with cookingTime=61
  - Trigger time validation error (61 > 60)
  - Render "Please fix the following 1 error(s):" message
  - Pass the assertion on line 60
- **Done When:**
  - Test run completes successfully
  - Console output shows "1 passed, 1 total" for the validation error test
  - No test failures reported

## Alternative Approach (Not Recommended)

If the team wants to test dietary validation as well, use this approach instead:

### ALT-PLAN-001: Set up dietary profile before test
- **File:** `e2e/manual-entry.spec.ts`
- **Instruction:**
  1. After line 47 (after `await window.waitForLoadState('domcontentloaded')`), add profile setup:
     ```typescript
     // Set up dietary profile with lactose-free restriction
     await electronApp.evaluate(async ({ ipcMain }) => {
       const { updateDietaryProfile } = await import('./src/main/database/dal/dietary-profile.js');
       await updateDietaryProfile({
         hardRestrictions: ['lactose-free'],
         preferences: [],
         explicitInclusions: [],
         explicitExclusions: [],
       });
     });
     ```
  2. Keep cooking time at 60 (now we rely on dietary error instead)
  3. Update comment on line 51: `// Valid time (60 is at limit)`
  4. Update comment on line 53: `// Violates lactose-free restriction`

**Why not recommended:**
- More complex (requires understanding electron.evaluate + IPC)
- Slower (adds async profile update)
- Tests two systems instead of one (time validation is sufficient)
- Requires imports and state setup

## Acceptance Criteria

1. **Test passes:** Running `npx playwright test e2e/manual-entry.spec.ts` shows 2 passing tests
2. **Validation triggered:** Test logs show validation error for time constraint
3. **Error UI displayed:** The "Please fix the following" message appears in the test
4. **No false positives:** The first test (valid recipe) still passes
5. **Comments accurate:** Inline comments correctly describe why each value triggers/avoids validation

## Implementor Checklist

- [ ] PLAN-001: Update cooking time from 60 to 61 in test file
- [ ] PLAN-002: Run E2E test and verify it passes
