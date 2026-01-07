# E2E Recipe Viewing Test Fix - Implementation Plan

## Inputs
- **Research report**: `thoughts/shared/research/2026-01-07-e2e-recipe-viewing-test-failures.md`
- **User request**: Fix failing E2E tests in `recipe-viewing.spec.ts`
- **Failing tests**: 
  - "filters recipes by cookware type" (line 94)
  - "clears filters and shows all recipes" (line 128)

## Verified Current State

### Fact 1: Test Expects "One Pot" Label
- **Evidence**: `e2e/recipe-viewing.spec.ts:117`
- **Excerpt**:
  ```typescript
  // Select one-pot filter (which should hide our one-pan recipe)
  await window.click('text=One Pot');
  ```
- **Impact**: Playwright searches for element with text "One Pot" (capitalized, space-separated)

### Fact 2: FilterControls Renders Raw Type Values
- **Evidence**: `src/renderer/components/RecipeList/FilterControls.tsx:111-118`
- **Excerpt**:
  ```typescript
  {COOKWARE_OPTIONS.map(type => (
    <Checkbox
      key={type}
      label={type}  // Passes "one-pot" directly
      checked={selectedCookware.includes(type)}
      onChange={() => handleCookwareToggle(type)}
    />
  ))}
  ```
- **Impact**: UI displays "one-pot" (lowercase with hyphen), causing test to fail

### Fact 3: COOKWARE_OPTIONS Contains Type Values Only
- **Evidence**: `src/renderer/components/RecipeList/FilterControls.tsx:20`
- **Excerpt**:
  ```typescript
  const COOKWARE_OPTIONS: CookwareType[] = ['one-pot', 'one-pan', 'oven'];
  ```
- **Impact**: Array contains data values, not display labels

### Fact 4: RecipeBasicInfo Uses Formatted Labels
- **Evidence**: `src/renderer/components/RecipeForm/RecipeBasicInfo.tsx:46-50`
- **Excerpt**:
  ```typescript
  options={[
    { value: 'one-pot', label: 'One Pot' },
    { value: 'one-pan', label: 'One Pan' },
    { value: 'oven', label: 'Oven' },
  ]}
  ```
- **Impact**: Recipe form has correct labels; filter controls do not (inconsistency)

### Fact 5: Dietary Tags Use Shared Constants Pattern
- **Evidence**: `src/shared/constants/dietary-tags.ts:20-33`
- **Excerpt**:
  ```typescript
  export const DIETARY_TAG_LABELS: Record<DietaryTag, string> = {
    'gluten-free': 'Gluten-Free',
    'lactose-free': 'Lactose-Free',
    vegetarian: 'Vegetarian',
    vegan: 'Vegan',
    pescatarian: 'Pescatarian',
  };

  export const DIETARY_TAG_OPTIONS = (
    Object.entries(DIETARY_TAG_LABELS) as [DietaryTag, string][]
  ).map(([value, label]) => ({ value, label }));
  ```
- **Impact**: Established pattern exists for creating label constants; should replicate for cookware types

### Fact 6: CookwareType Is String Union
- **Evidence**: `src/shared/types/database.ts:11`
- **Excerpt**:
  ```typescript
  export type CookwareType = 'one-pot' | 'one-pan' | 'oven';
  ```
- **Impact**: Type enforces lowercase hyphenated values; labels must be separate mapping

### Fact 7: FilterControls Imports from shared/constants
- **Evidence**: `src/renderer/components/RecipeList/FilterControls.tsx:5`
- **Excerpt**:
  ```typescript
  import { DIETARY_TAG_OPTIONS } from '../../../shared/constants/dietary-tags';
  ```
- **Impact**: Component already imports from shared constants; can import cookware constants same way

## Goals / Non-Goals

### Goals
1. Fix failing E2E tests by ensuring UI renders "One Pot", "One Pan", "Oven" labels
2. Create shared cookware label constants following dietary-tags pattern
3. Eliminate label inconsistency between FilterControls and RecipeBasicInfo
4. Establish single source of truth for cookware display labels

### Non-Goals
- Not changing test expectations (tests are correct; UI is wrong)
- Not modifying CookwareType type definition (data values are correct)
- Not refactoring other components at this time (focused fix only)

## Design Overview

### Pattern Replication
- Follow exact pattern from `dietary-tags.ts`:
  1. Create `COOKWARE_TYPE_LABELS: Record<CookwareType, string>`
  2. Create `COOKWARE_TYPE_OPTIONS` array with `{ value, label }` objects
  3. Export both for UI flexibility

### Data Flow
1. **Source**: New `src/shared/constants/cookware-types.ts` file
2. **Consumer 1**: FilterControls.tsx imports `COOKWARE_TYPE_OPTIONS` and uses `.label` in Checkbox
3. **Consumer 2** (Future): RecipeBasicInfo.tsx can replace hardcoded labels (optional improvement)

### Label Mapping
- `'one-pot'` → `'One Pot'`
- `'one-pan'` → `'One Pan'`
- `'oven'` → `'Oven'`

## Implementation Instructions (For Implementor)

### PLAN-001: Create Shared Cookware Constants File

**Action ID**: PLAN-001  
**Change Type**: create  
**File(s)**: `src/shared/constants/cookware-types.ts`

**Instruction**:
1. Create new file `src/shared/constants/cookware-types.ts` in the shared constants directory
2. Add module documentation comment explaining purpose (ensure consistency across UIs)
3. Import `CookwareType` from `'../types/database'`
4. Define `COOKWARE_TYPE_LABELS: Record<CookwareType, string>` with mappings:
   - `'one-pot': 'One Pot'`
   - `'one-pan': 'One Pan'`
   - `'oven': 'Oven'`
5. Define `COOKWARE_TYPE_OPTIONS` using the same pattern as dietary-tags:
   ```typescript
   export const COOKWARE_TYPE_OPTIONS = (
     Object.entries(COOKWARE_TYPE_LABELS) as [CookwareType, string][]
   ).map(([value, label]) => ({ value, label }));
   ```
6. Export both constants

**Pseudocode/Template**:
```typescript
/**
 * @module cookware-types-constants
 * Shared constants for cookware type display labels.
 * Ensures consistency across recipe entry and filtering UIs.
 */

import type { CookwareType } from '../types/database';

/**
 * Canonical mapping of cookware type IDs to human-readable display labels.
 * Used internally to generate COOKWARE_TYPE_OPTIONS and exported for direct UI use.
 */
export const COOKWARE_TYPE_LABELS: Record<CookwareType, string> = {
  'one-pot': 'One Pot',
  'one-pan': 'One Pan',
  'oven': 'Oven',
};

/**
 * Array of cookware types with their labels for use in UI components.
 */
export const COOKWARE_TYPE_OPTIONS = (
  Object.entries(COOKWARE_TYPE_LABELS) as [CookwareType, string][]
).map(([value, label]) => ({ value, label }));
```

**Evidence**: Pattern from `src/shared/constants/dietary-tags.ts:20-33`

**Done When**:
- File exists at `src/shared/constants/cookware-types.ts`
- File exports `COOKWARE_TYPE_LABELS` and `COOKWARE_TYPE_OPTIONS`
- TypeScript compiles without errors
- File follows exact pattern from dietary-tags.ts

---

### PLAN-002: Update FilterControls to Use Shared Constants

**Action ID**: PLAN-002  
**Change Type**: modify  
**File(s)**: `src/renderer/components/RecipeList/FilterControls.tsx`

**Instruction**:
1. Add import statement at top (after existing imports, line ~5):
   ```typescript
   import { COOKWARE_TYPE_OPTIONS } from '../../../shared/constants/cookware-types';
   ```
2. Remove the local `COOKWARE_OPTIONS` constant definition at line 20
3. In the JSX map at lines 111-118, replace:
   ```typescript
   {COOKWARE_OPTIONS.map(type => (
     <Checkbox
       key={type}
       label={type}
       checked={selectedCookware.includes(type)}
       onChange={() => handleCookwareToggle(type)}
     />
   ))}
   ```
   With:
   ```typescript
   {COOKWARE_TYPE_OPTIONS.map(option => (
     <Checkbox
       key={option.value}
       label={option.label}
       checked={selectedCookware.includes(option.value)}
       onChange={() => handleCookwareToggle(option.value)}
     />
   ))}
   ```
4. Verify no other references to `COOKWARE_OPTIONS` exist in the file

**Evidence**: 
- Current code at `src/renderer/components/RecipeList/FilterControls.tsx:20` (constant to remove)
- Current code at `src/renderer/components/RecipeList/FilterControls.tsx:111-118` (map to update)
- Import pattern at `src/renderer/components/RecipeList/FilterControls.tsx:5` (existing shared import)

**Done When**:
- FilterControls.tsx imports `COOKWARE_TYPE_OPTIONS`
- Local `COOKWARE_OPTIONS` constant removed
- Checkbox map uses `option.label` instead of raw type value
- TypeScript compiles without errors
- No linting errors

---

### PLAN-003: Verify E2E Tests Pass

**Action ID**: PLAN-003  
**Change Type**: verify  
**File(s)**: N/A (test execution)

**Instruction**:
1. Run the specific failing E2E tests:
   ```bash
   npx playwright test e2e/recipe-viewing.spec.ts -g "filters recipes by cookware type"
   npx playwright test e2e/recipe-viewing.spec.ts -g "clears filters and shows all recipes"
   ```
2. Verify both tests now pass without timeout errors
3. Run the full E2E test suite to ensure no regressions:
   ```bash
   npx playwright test e2e/recipe-viewing.spec.ts
   ```
4. All 6 tests in the suite should pass

**Evidence**: Test expectations at `e2e/recipe-viewing.spec.ts:117` and `e2e/recipe-viewing.spec.ts:151`

**Done When**:
- Both previously failing tests pass
- All tests in `recipe-viewing.spec.ts` pass
- No new test failures introduced
- Test output shows 0 timeouts

---

### PLAN-004: Run Full Test Suite and Build

**Action ID**: PLAN-004  
**Change Type**: verify  
**File(s)**: N/A (build verification)

**Instruction**:
1. Run TypeScript type checking:
   ```bash
   npm run typecheck
   ```
2. Run linter:
   ```bash
   npm run lint
   ```
3. Run unit tests:
   ```bash
   npm test
   ```
4. Run build:
   ```bash
   npm run build
   ```
5. Address any errors that arise

**Evidence**: Project conventions from `AGENTS.md`

**Done When**:
- TypeScript compilation succeeds with no errors
- Linter passes with no errors
- All unit tests pass
- Build completes successfully
- No new warnings introduced

---

## Verification Tasks

No assumptions exist. All plan items are based on verified evidence.

## Acceptance Criteria

1. **Tests Pass**: Both failing E2E tests now pass without timeout errors
2. **UI Consistency**: FilterControls displays "One Pot", "One Pan", "Oven" (matching RecipeBasicInfo)
3. **Shared Constants**: New `cookware-types.ts` file exists and follows dietary-tags pattern
4. **No Regressions**: All existing tests continue to pass
5. **Code Quality**: No TypeScript errors, no linting errors, build succeeds

## Implementor Checklist

- [ ] PLAN-001: Create `src/shared/constants/cookware-types.ts`
- [ ] PLAN-002: Update FilterControls.tsx to use shared constants
- [ ] PLAN-003: Verify E2E tests pass
- [ ] PLAN-004: Run full test suite and build

## Additional Context

### Why This Fix Is Correct
- **Tests are correct**: E2E tests validate user-visible behavior; users see "One Pot" in the form, so they should see it in filters too
- **Pattern consistency**: Cookware labels should follow the same pattern as dietary tags (established convention)
- **Single source of truth**: Hardcoded labels in multiple places lead to inconsistency (RecipeBasicInfo had correct labels, FilterControls did not)

### Future Improvements (Out of Scope)
- RecipeBasicInfo.tsx could import `COOKWARE_TYPE_OPTIONS` to eliminate its hardcoded labels
- Other components that display cookware types could use the shared constants
- Consider creating a linter rule to prevent raw enum/type values in UI labels

### Risk Assessment
- **Low risk**: Change is isolated to FilterControls.tsx and new constants file
- **No data migration**: Only changes display labels, not database values
- **No API changes**: CookwareType type remains unchanged
- **Easy rollback**: Simple to revert if issues arise
