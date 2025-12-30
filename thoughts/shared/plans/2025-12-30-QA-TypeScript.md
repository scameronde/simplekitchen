# QA-Driven Implementation Plan: TypeScript Full Codebase

## Inputs

- QA report: `thoughts/shared/qa/2025-12-30-TypeScript-QA-Report.md`
- Audit date: 2025-12-30
- Automated tools: TypeScript Compiler (tsc), ESLint, Knip
- Auditor: Quick QA Agent v1.0

## Verified Current State

### ESLint Configuration Issues

- **Fact:** ESLint configuration missing standard Node.js and browser globals causing false positive errors
- **Evidence:** `src/main/ipc/recipe-ai-handlers.ts:15`, `src/renderer/pages/RecipeDetailPage.tsx:26`, `src/renderer/pages/RecipeListPage.tsx:38,63`, `src/renderer/pages/RecipeGenerationPage.tsx:174`, `vitest.setup.ts:13`
- **Excerpt:**
  ```
  src/main/ipc/recipe-ai-handlers.ts:15:19  error  'URL' is not defined
  src/renderer/pages/RecipeDetailPage.tsx:26:7  error  'console' is not defined
  src/renderer/pages/RecipeListPage.tsx:38:7  error  'console' is not defined
  src/renderer/pages/RecipeListPage.tsx:63:7  error  'console' is not defined
  src/renderer/pages/RecipeGenerationPage.tsx:174:7  error  'setTimeout' is not defined
  vitest.setup.ts:13:68  error  'Window' is not defined
  ```

### Production Code Quality Issues

- **Fact:** Unused variable in production React component bypassing strict unused variable rules
- **Evidence:** `src/renderer/pages/RecipeGenerationPage.tsx:37`
- **Excerpt:**
  ```typescript
  const [_generatedRecipe, setGeneratedRecipe] = useState<Recipe | null>(null);
  ```

### Test Code Type Safety Issues

- **Fact:** Explicit `any` types in test code bypass TypeScript type safety (14 instances across 4 test files)
- **Evidence:**
  - `e2e/ai-recipe-generation.spec.ts:19,125,171,211` (4 instances)
  - `src/main/ai/recipe-generator.test.ts:56,57,58,59,246,262,277,288,299` (9 instances)
  - `src/main/ipc/recipe-ai-handlers.test.ts:35,365` (2 instances)
  - `src/main/database/dal/recipes-validation-integration.test.ts:156` (1 instance)
- **Excerpt:**
  ```typescript
  const mockEvent: any = {};
  ```

### Test Code Unused Variables

- **Fact:** Destructured variables in schema validation tests flagged as unused (12 instances in 1 file)
- **Evidence:** `src/main/ai/recipe-schema.test.ts:69,86,108,131,148,256,298,347,394,416,446,511`
- **Excerpt:**
  ```typescript
  const { name } = recipeIngredientSchema.parse({ quantity: 1 }); // 'name' never used
  ```

### Dead Code Issues

- **Fact:** Unused barrel export files (2 files)
- **Evidence:** `src/renderer/components/RecipeList/index.ts`, `src/renderer/components/common/index.ts`

- **Fact:** Unused module exports in barrel files (4 modules with multiple exports)
- **Evidence:**
  - `src/main/database/index.ts` (8 unused exports)
  - `src/main/validation/index.ts` (13 unused exports)
  - `src/main/validation/ingredient-database.ts` (1 unused export)
  - `src/shared/constants/dietary-tags.ts` (1 unused export)

- **Fact:** Unused type exports (2 types across 2 files)
- **Evidence:** `src/main/validation/index.ts` (IngredientData), `src/shared/types/validation.ts` (ConstraintType)

## Goals / Non-Goals

- **Goals**: Resolve all issues identified in QA report
  - Critical: 0 issues
  - High: 5 issues (ESLint globals + unused variable)
  - Medium: 26 issues (any types + unused vars)
  - Low: 6 issues (dead code)
- **Non-Goals**: New features, performance optimization beyond QA scope, refactoring unrelated code

## Design Overview

This plan addresses quality issues across four categories:

1. **ESLint Configuration**: Add missing global definitions to eliminate false positive linting errors
2. **Production Code Quality**: Remove or properly use state variables in React components
3. **Test Type Safety**: Replace explicit `any` types with proper mock types for better test reliability
4. **Dead Code Cleanup**: Review and remove unused exports, barrel files, and type definitions

All changes are non-breaking and focused on code quality improvements. No runtime behavior changes are expected.

## Phased Implementation

### Phase 1: Critical Issues (Security + Blocking Type Errors)

**No critical issues detected** - TypeScript compilation passes with 0 errors, no security vulnerabilities found.

**Phase 1 Verification**:

```bash
npm run typecheck  # Should pass with 0 errors
```

### Phase 2: High Priority Issues (ESLint Configuration + Production Code)

Execute these items first; they fix false positive linting errors and unused code warnings.

#### PLAN-001: Fix ESLint Global Definitions (was QA Issue #1)

- **Priority**: High
- **Category**: Configuration
- **Change Type**: modify
- **File(s)**: `eslint.config.js:20-26,48-55,133-137`
- **Instruction**:
  1. Add `URL: 'readonly'` to main process globals (line 20-26)
  2. Add `console: 'readonly'` and `setTimeout: 'readonly'` to renderer process globals (line 48-55)
  3. Add `Window: 'readonly'` to vitest.setup.ts globals (line 133-137)
- **Evidence**:
  ```
  src/main/ipc/recipe-ai-handlers.ts:15:19  error  'URL' is not defined
  src/renderer/pages/RecipeDetailPage.tsx:26:7  error  'console' is not defined
  src/renderer/pages/RecipeListPage.tsx:38:7  error  'console' is not defined
  src/renderer/pages/RecipeListPage.tsx:63:7  error  'console' is not defined
  src/renderer/pages/RecipeGenerationPage.tsx:174:7  error  'setTimeout' is not defined
  vitest.setup.ts:13:68  error  'Window' is not defined
  ```
- **Done When**:
  - `npm run lint` passes without "is not defined" errors for URL, console, setTimeout, Window
  - All 6 ESLint errors from these files are resolved

#### PLAN-002: Fix Unused \_generatedRecipe Variable (was QA Issue #2)

- **Priority**: High
- **Category**: Production Code Quality
- **Change Type**: modify
- **File(s)**: `src/renderer/pages/RecipeGenerationPage.tsx:37`
- **Instruction**:
  Choose one of these approaches:
  1. If the variable is truly unused and the setter is called elsewhere: Remove the leading underscore to fix the naming
  2. If both variable and setter are unused: Remove the entire useState declaration
  3. If keeping for future use: Add a comment explaining why and use the variable somewhere (e.g., console.debug for development)

  Recommended: Remove leading underscore if setGeneratedRecipe is used, otherwise remove the entire line.

- **Evidence**:
  ```typescript
  const [_generatedRecipe, setGeneratedRecipe] = useState<Recipe | null>(null);
  ```
  ESLint error: `'_generatedRecipe' is assigned a value but never used`
- **Done When**:
  - `npm run lint src/renderer/pages/RecipeGenerationPage.tsx` passes without unused variable error
  - Code behavior unchanged (if setter is used elsewhere, state still works)

**Phase 2 Verification**:

```bash
npm run lint  # Should pass with 5 fewer errors (6 globals + 1 unused var = 7 total fixed)
npm run typecheck  # Should still pass
```

### Phase 3: Medium Priority Issues (Test Type Safety)

Execute after Phase 2 passes verification.

#### PLAN-003: Replace any Types in E2E Tests (was QA Issue #3, part 1)

- **Priority**: Medium
- **Category**: Test Type Safety
- **Change Type**: modify
- **File(s)**: `e2e/ai-recipe-generation.spec.ts:19,125,171,211`
- **Instruction**:
  Replace all 4 instances of `any` with proper Playwright types:

  ```typescript
  // BEFORE
  const mockEvent: any = {};

  // AFTER
  import type { Page } from '@playwright/test';
  // Use proper types for test fixtures or create minimal mock types
  type MockConfig = { timeout?: number };
  const mockConfig: MockConfig = {};
  ```

  Review each usage to determine the appropriate type based on what properties are being accessed.

- **Evidence**:
  ```
  e2e/ai-recipe-generation.spec.ts:19:18  error  Unexpected any. Specify a different type
  e2e/ai-recipe-generation.spec.ts:125:18  error  Unexpected any. Specify a different type
  e2e/ai-recipe-generation.spec.ts:171:18  error  Unexpected any. Specify a different type
  e2e/ai-recipe-generation.spec.ts:211:18  error  Unexpected any. Specify a different type
  ```
- **Done When**:
  - `npm run lint e2e/ai-recipe-generation.spec.ts` passes without "Unexpected any" errors
  - All 4 instances replaced with proper types
  - Tests still pass: `npm run test:e2e -- ai-recipe-generation.spec.ts`

#### PLAN-004: Replace any Types in recipe-generator.test.ts (was QA Issue #3, part 2)

- **Priority**: Medium
- **Category**: Test Type Safety
- **Change Type**: modify
- **File(s)**: `src/main/ai/recipe-generator.test.ts:56,57,58,59,246,262,277,288,299`
- **Instruction**:
  Replace all 9 instances of `any` with proper types. Likely need to define mock types for AI responses:

  ```typescript
  // BEFORE
  const mockResponse: any = { data: { ... } };

  // AFTER
  type MockAIResponse = {
    data?: { content?: string };
    error?: Error;
  };
  const mockResponse: MockAIResponse = { data: { ... } };
  ```

  Lines 56-59 appear to be related (likely a single mock object with 4 properties).
  Lines 246, 262, 277, 288, 299 likely need similar treatment.

- **Evidence**:
  ```
  src/main/ai/recipe-generator.test.ts:56:18  error  Unexpected any
  src/main/ai/recipe-generator.test.ts:57:18  error  Unexpected any
  src/main/ai/recipe-generator.test.ts:58:18  error  Unexpected any
  src/main/ai/recipe-generator.test.ts:59:18  error  Unexpected any
  src/main/ai/recipe-generator.test.ts:246:36  error  Unexpected any
  src/main/ai/recipe-generator.test.ts:262:36  error  Unexpected any
  src/main/ai/recipe-generator.test.ts:277:36  error  Unexpected any
  src/main/ai/recipe-generator.test.ts:288:36  error  Unexpected any
  src/main/ai/recipe-generator.test.ts:299:36  error  Unexpected any
  ```
- **Done When**:
  - `npm run lint src/main/ai/recipe-generator.test.ts` passes without "Unexpected any" errors
  - All 9 instances replaced with proper types
  - Tests still pass: `npm run test -- recipe-generator.test.ts`

#### PLAN-005: Replace any Types in recipe-ai-handlers.test.ts (was QA Issue #3, part 3)

- **Priority**: Medium
- **Category**: Test Type Safety
- **Change Type**: modify
- **File(s)**: `src/main/ipc/recipe-ai-handlers.test.ts:35,365`
- **Instruction**:
  Replace both instances of `any` with proper Electron IPC types:

  ```typescript
  // BEFORE
  const mockEvent: any = {};

  // AFTER
  import type { IpcMainInvokeEvent } from 'electron';
  const mockEvent = {} as IpcMainInvokeEvent;
  // OR create a minimal mock type
  type MockIpcEvent = Partial<IpcMainInvokeEvent>;
  const mockEvent: MockIpcEvent = {};
  ```

- **Evidence**:
  ```
  src/main/ipc/recipe-ai-handlers.test.ts:35:18  error  Unexpected any
  src/main/ipc/recipe-ai-handlers.test.ts:365:36  error  Unexpected any
  ```
- **Done When**:
  - `npm run lint src/main/ipc/recipe-ai-handlers.test.ts` passes without "Unexpected any" errors
  - Both instances replaced with proper types
  - Tests still pass: `npm run test -- recipe-ai-handlers.test.ts`

#### PLAN-006: Replace any Type in recipes-validation-integration.test.ts (was QA Issue #3, part 4)

- **Priority**: Medium
- **Category**: Test Type Safety
- **Change Type**: modify
- **File(s)**: `src/main/database/dal/recipes-validation-integration.test.ts:156`
- **Instruction**:
  Replace the single instance of `any` with proper type. Review the context to determine appropriate type.
- **Evidence**:
  ```
  src/main/database/dal/recipes-validation-integration.test.ts:156:41  error  Unexpected any
  ```
- **Done When**:
  - `npm run lint src/main/database/dal/recipes-validation-integration.test.ts` passes without "Unexpected any" error
  - Instance replaced with proper type
  - Tests still pass: `npm run test -- recipes-validation-integration.test.ts`

#### PLAN-007: Fix Unused Variables in recipe-schema.test.ts (was QA Issue #4)

- **Priority**: Medium
- **Category**: Test Code Quality
- **Change Type**: modify
- **File(s)**: `src/main/ai/recipe-schema.test.ts:69,86,108,131,148,256,298,347,394,416,446,511`
- **Instruction**:
  Choose one consistent approach for all 12 instances:

  **Recommended Option**: Remove destructuring entirely (cleanest for validation tests)

  ```typescript
  // BEFORE
  const { name } = recipeIngredientSchema.parse({ quantity: 1 });

  // AFTER
  expect(() => recipeIngredientSchema.parse({ quantity: 1 })).toThrow();
  ```

  **Alternative**: Prefix with underscore if the value is needed for assertion

  ```typescript
  const { name: _name } = recipeIngredientSchema.parse({ quantity: 1 });
  ```

  Apply the chosen approach consistently across all 12 locations.

- **Evidence**:
  ```
  src/main/ai/recipe-schema.test.ts:69:15  error  'name' is assigned a value but never used
  src/main/ai/recipe-schema.test.ts:86:15  error  'quantity' is assigned a value but never used
  src/main/ai/recipe-schema.test.ts:108:15  error  'unit' is assigned a value but never used
  (... 9 more similar errors)
  ```
- **Done When**:
  - `npm run lint src/main/ai/recipe-schema.test.ts` passes without unused variable errors
  - All 12 instances fixed consistently
  - Tests still pass: `npm run test -- recipe-schema.test.ts`

**Phase 3 Verification**:

```bash
npm run lint  # Should pass with 26 fewer errors (14 any + 12 unused vars)
npm test  # All tests should still pass
```

### Phase 4: Low Priority Issues (Dead Code Cleanup)

Execute after Phase 3 passes verification. Optional if time-constrained.

#### PLAN-008: Review and Handle Unused Barrel Export Files (was QA Issue #5)

- **Priority**: Low
- **Category**: Dead Code
- **Change Type**: modify or remove
- **File(s)**: `src/renderer/components/RecipeList/index.ts`, `src/renderer/components/common/index.ts`
- **Instruction**:
  For each barrel export file, choose one approach:

  **Option A**: Use the barrel exports (if they provide value)

  ```typescript
  // In consuming files, change from:
  import { RecipeCard } from './RecipeList/RecipeCard';
  // To:
  import { RecipeCard } from './RecipeList';
  ```

  **Option B**: Delete the barrel export files (if they're not providing value)

  ```bash
  rm src/renderer/components/RecipeList/index.ts
  rm src/renderer/components/common/index.ts
  ```

  **Recommended**: Delete them since they're currently unused and direct imports are equally clear.

- **Evidence**:
  ```
  Unused files (2)
    src/renderer/components/RecipeList/index.ts
    src/renderer/components/common/index.ts
  ```
- **Done When**:
  - Either files are deleted OR they are now imported in consuming components
  - `npx knip` no longer reports these files as unused
  - `npm test` still passes

#### PLAN-009: Review Unused Database Module Exports (was QA Issue #6, part 1)

- **Priority**: Low
- **Category**: Dead Code
- **Change Type**: modify
- **File(s)**: `src/main/database/index.ts`
- **Instruction**:
  Determine if these 8 exports are part of the public API or truly unused:
  - `db`, `getRecipeById`, `getRecipes`, `deleteRecipe`, `getRecipeCount`
  - `getDietaryProfile`, `updateDietaryProfile`, `resetDietaryProfile`

  **If public API**: Add comment documenting this as the public database API

  ```typescript
  // Public database API - exported for future extension or external modules
  export { db, getRecipeById, ... }
  ```

  **If truly unused**: Remove the exports from index.ts (keep the implementations)

  **Recommended**: Keep them as public API since this is a barrel file meant to provide a stable interface.

- **Evidence**:
  ```
  src/main/database/index.ts:
    db, getRecipeById, getRecipes, deleteRecipe, getRecipeCount,
    getDietaryProfile, updateDietaryProfile, resetDietaryProfile
  ```
- **Done When**:
  - Decision documented in comments OR exports removed
  - `npx knip` no longer reports these if removed
  - `npm test` still passes

#### PLAN-010: Review Unused Validation Module Exports (was QA Issue #6, part 2)

- **Priority**: Low
- **Category**: Dead Code
- **Change Type**: modify
- **File(s)**: `src/main/validation/index.ts`
- **Instruction**:
  Determine if these 13 exports are part of the public API or truly unused:
  - `validateRecipe`, `validateDietaryConstraints`, `validateTimeConstraints`
  - `getTimeConstraints`, `validateCookwareConstraints`, `getValidCookwareTypes`
  - `validateServingsConstraints`, `getRequiredServings`, `lookupIngredient`
  - `getIngredientProperties`, `isKnownSafe`, `getKnownIngredientCount`
  - `INGREDIENT_DATABASE`

  **Recommended**: Keep as public API with documentation comment.

- **Evidence**:
  ```
  src/main/validation/index.ts:
    validateRecipe, validateDietaryConstraints, validateTimeConstraints,
    getTimeConstraints, validateCookwareConstraints, getValidCookwareTypes,
    validateServingsConstraints, getRequiredServings, lookupIngredient,
    getIngredientProperties, isKnownSafe, getKnownIngredientCount,
    INGREDIENT_DATABASE
  ```
- **Done When**:
  - Decision documented in comments OR exports removed
  - `npx knip` no longer reports these if removed
  - `npm test` still passes

#### PLAN-011: Review Unused Ingredient Database Export (was QA Issue #6, part 3)

- **Priority**: Low
- **Category**: Dead Code
- **Change Type**: modify
- **File(s)**: `src/main/validation/ingredient-database.ts`
- **Instruction**:
  The `INGREDIENT_DATABASE` constant is exported but unused. Since this is also re-exported from `src/main/validation/index.ts`, this is likely duplication.

  **Recommended**: Keep the export in ingredient-database.ts (it's the source of truth). The re-export in index.ts provides the public API.

- **Evidence**:
  ```
  src/main/validation/ingredient-database.ts:
    INGREDIENT_DATABASE
  ```
- **Done When**:
  - Decision documented OR export removed if truly redundant
  - `npm test` still passes

#### PLAN-012: Review Unused Dietary Tags Export (was QA Issue #6, part 4)

- **Priority**: Low
- **Category**: Dead Code
- **Change Type**: modify
- **File(s)**: `src/shared/constants/dietary-tags.ts`
- **Instruction**:
  The `DIETARY_TAG_LABELS` export is unused. Review if this was planned for future UI display or truly unnecessary.

  **If planned for UI**: Keep it and add a comment

  ```typescript
  // Used for displaying human-readable dietary tag labels in UI
  export const DIETARY_TAG_LABELS = { ... };
  ```

  **If truly unused**: Remove the export

- **Evidence**:
  ```
  src/shared/constants/dietary-tags.ts:
    DIETARY_TAG_LABELS
  ```
- **Done When**:
  - Decision documented OR export removed
  - `npx knip` no longer reports this if removed
  - `npm test` still passes

#### PLAN-013: Review Unused Type Exports (was QA Issue #7)

- **Priority**: Low
- **Category**: Dead Code
- **Change Type**: modify
- **File(s)**: `src/main/validation/index.ts`, `src/shared/types/validation.ts`
- **Instruction**:
  Remove or document these 2 unused type exports:
  - `IngredientData` in `src/main/validation/index.ts`
  - `ConstraintType` in `src/shared/types/validation.ts`

  **If part of public API**: Add comment

  ```typescript
  // Public type for future extension
  export type IngredientData = { ... };
  ```

  **If truly unused**: Remove the export (or the entire type if not used internally)

- **Evidence**:
  ```
  Unused exported types (2)
    src/main/validation/index.ts: IngredientData
    src/shared/types/validation.ts: ConstraintType
  ```
- **Done When**:
  - Decision documented OR exports removed
  - `npx knip` no longer reports these if removed
  - `npm run typecheck` still passes

**Phase 4 Verification**:

```bash
npx knip  # Should show 0 unused files/exports (or documented decisions)
npm run lint  # Should still pass
npm test  # All tests should still pass
```

## Baseline Verification

Before starting Phase 2, run these commands to establish a baseline:

```bash
npm run typecheck     # Current: 0 errors (should remain 0)
npm run lint          # Current: 35 errors (should reduce to 0)
npx knip              # Current: 12 unused items (should reduce or be documented)
npm test              # Current: All tests pass (should remain passing)
```

Record the current error/warning counts. Each phase should reduce these counts.

## Acceptance Criteria

### Phase 2 Complete When:

- [ ] `npm run lint` shows 7 fewer errors (6 global + 1 unused var fixed)
- [ ] ESLint no longer reports "is not defined" for URL, console, setTimeout, Window
- [ ] RecipeGenerationPage.tsx has no unused variable warnings

### Phase 3 Complete When:

- [ ] `npm run lint` shows 26 fewer errors (14 any + 12 unused vars fixed)
- [ ] No explicit `any` types remain in test files
- [ ] All schema validation tests pass without unused variable warnings
- [ ] All tests still pass (`npm test`)

### Phase 4 Complete When:

- [ ] All unused exports either removed or documented as intentional public API
- [ ] `npx knip` shows 0 issues or documents why remaining items are intentional
- [ ] All tests still pass (`npm test`)

### Overall Success Criteria:

- [ ] `npm run lint` passes with 0 errors (down from 35)
- [ ] `npm run typecheck` passes with 0 errors (unchanged)
- [ ] `npx knip` reports 0 unused code or all items documented
- [ ] All unit, integration, and E2E tests pass
- [ ] No runtime behavior changes
- [ ] Code is more maintainable with better type safety

## Implementor Checklist

### Phase 2 (High Priority)

- [ ] PLAN-001: Fix ESLint global definitions
- [ ] PLAN-002: Fix unused \_generatedRecipe variable

### Phase 3 (Medium Priority)

- [ ] PLAN-003: Replace any types in E2E tests
- [ ] PLAN-004: Replace any types in recipe-generator.test.ts
- [ ] PLAN-005: Replace any types in recipe-ai-handlers.test.ts
- [ ] PLAN-006: Replace any type in recipes-validation-integration.test.ts
- [ ] PLAN-007: Fix unused variables in recipe-schema.test.ts

### Phase 4 (Low Priority - Optional)

- [ ] PLAN-008: Review/handle unused barrel export files
- [ ] PLAN-009: Review unused database module exports
- [ ] PLAN-010: Review unused validation module exports
- [ ] PLAN-011: Review unused ingredient database export
- [ ] PLAN-012: Review unused dietary tags export
- [ ] PLAN-013: Review unused type exports

## References

- Source QA report: `thoughts/shared/qa/2025-12-30-TypeScript-QA-Report.md`
- Automated tools: TypeScript Compiler (tsc), ESLint, Knip
- Manual analysis: ESLint configuration, test code quality, dead code detection
