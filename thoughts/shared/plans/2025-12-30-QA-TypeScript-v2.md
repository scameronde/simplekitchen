# QA-Driven Implementation Plan: TypeScript Code Quality

## Inputs

- QA report: `thoughts/shared/qa/2025-12-30-TypeScript-QA-Report.md`
- Audit date: 2025-12-30
- Automated tools: TypeScript Compiler (tsc), ESLint, Knip
- Auditor: Quick QA Agent v1.0

## Verified Current State

### Code Quality Issues (ESLint)

#### Missing Global Definitions

- **Fact**: ESLint configuration missing standard Node.js and browser globals causing false positive "is not defined" errors
- **Evidence**: `eslint.config.js` (main: lines 20-26, renderer: lines 48-55, vitest: lines 133-137)
- **Affected Files**:
  - `src/main/ipc/recipe-ai-handlers.ts:15` - `URL` is not defined
  - `src/renderer/pages/RecipeDetailPage.tsx:26` - `console` is not defined
  - `src/renderer/pages/RecipeListPage.tsx:38` - `console` is not defined
  - `src/renderer/pages/RecipeListPage.tsx:63` - `console` is not defined
  - `src/renderer/pages/RecipeGenerationPage.tsx:174` - `setTimeout` is not defined
  - `vitest.setup.ts:13` - `Window` is not defined

#### Unused Variable in Production Code

- **Fact**: Variable `_generatedRecipe` is assigned but never used
- **Evidence**: `src/renderer/pages/RecipeGenerationPage.tsx:37`
- **Excerpt**:
  ```typescript
  const [_generatedRecipe, setGeneratedRecipe] = useState<Recipe | null>(null);
  ```

### Type Safety Issues in Test Code

#### Explicit `any` Types (14 instances)

- **Fact**: Test code uses explicit `any` types bypassing TypeScript type safety
- **Evidence**:
  - `e2e/ai-recipe-generation.spec.ts`: lines 19, 125, 171, 211
  - `src/main/ai/recipe-generator.test.ts`: lines 56, 57, 58, 59, 246, 262, 277, 288, 299
  - `src/main/ipc/recipe-ai-handlers.test.ts`: lines 35, 365
  - `src/main/database/dal/recipes-validation-integration.test.ts`: line 156
- **Excerpt**:
  ```typescript
  const mockEvent: any = {};
  ```

#### Unused Variables in Schema Tests (12 instances)

- **Fact**: Destructured variables in `expect().toThrow()` tests are flagged as unused
- **Evidence**: `src/main/ai/recipe-schema.test.ts`
- **Lines**: 69, 86, 108, 131, 148, 256, 298, 347, 394, 416, 446, 511
- **Excerpt**:
  ```typescript
  const { name } = recipeIngredientSchema.parse({ quantity: 1 }); // 'name' never used
  ```

### Dead Code Issues (Knip)

#### Unused Barrel Export Files

- **Fact**: Index files exist but are never imported
- **Evidence**:
  - `src/renderer/components/RecipeList/index.ts`
  - `src/renderer/components/common/index.ts`

#### Unused Module Exports

- **Fact**: Barrel exports from index.ts files are never imported
- **Evidence**:
  - `src/main/database/index.ts`: `db`, `getRecipeById`, `getRecipes`, `deleteRecipe`, `getRecipeCount`, `getDietaryProfile`, `updateDietaryProfile`, `resetDietaryProfile`
  - `src/main/validation/index.ts`: `validateRecipe`, `validateDietaryConstraints`, `validateTimeConstraints`, `getTimeConstraints`, `validateCookwareConstraints`, `getValidCookwareTypes`, `validateServingsConstraints`, `getRequiredServings`, `lookupIngredient`, `getIngredientProperties`, `isKnownSafe`, `getKnownIngredientCount`, `INGREDIENT_DATABASE`
  - `src/main/validation/ingredient-database.ts`: `INGREDIENT_DATABASE`
  - `src/shared/constants/dietary-tags.ts`: `DIETARY_TAG_LABELS`

#### Unused Type Exports

- **Fact**: Type exports are never imported
- **Evidence**:
  - `src/main/validation/index.ts`: `IngredientData`
  - `src/shared/types/validation.ts`: `ConstraintType`

## Goals / Non-Goals

- **Goals**: Resolve all code quality issues identified in QA report
  - Critical: 0 issues
  - High: 5 issues (ESLint configuration, unused production code)
  - Medium: 26 issues (test code type safety, unused test variables)
  - Low: 6 issues (dead code cleanup)
- **Non-Goals**: New features, refactoring unrelated code, performance optimization

## Design Overview

This plan addresses code quality improvements across four categories:

1. **ESLint Configuration**: Add missing global definitions to eliminate false positive linting errors
2. **Production Code Quality**: Remove or properly handle unused variables in production code
3. **Test Code Type Safety**: Replace `any` types with proper type definitions in test mocks
4. **Dead Code Cleanup**: Review and remove or document unused exports and barrel files

All changes are non-functional improvements that enhance maintainability without affecting runtime behavior.

## Phased Implementation

### Phase 1: High Priority Issues (ESLint Configuration + Production Code)

Execute these items first; they affect production code and linting accuracy.

#### PLAN-001: Fix Missing Global Definitions in ESLint Config

- **Priority**: High
- **Category**: Code Quality (ESLint Configuration)
- **Change Type**: modify
- **File(s)**: `eslint.config.js:20-26, 48-55, 133-137`
- **Instruction**:
  1. Open `eslint.config.js`
  2. In main process globals section (line 20-26), add:
     ```javascript
     URL: 'readonly',
     ```
  3. In renderer process globals section (line 48-55), add:
     ```javascript
     console: 'readonly',
     setTimeout: 'readonly',
     ```
  4. In vitest.setup.ts globals section (line 133-137), add:
     ```javascript
     Window: 'readonly',
     ```
  5. Run `npm run lint` to verify no "is not defined" errors remain
- **Evidence**:
  - `src/main/ipc/recipe-ai-handlers.ts:15` - `URL` is not defined
  - `src/renderer/pages/RecipeDetailPage.tsx:26` - `console` is not defined
  - `src/renderer/pages/RecipeListPage.tsx:38,63` - `console` is not defined
  - `src/renderer/pages/RecipeGenerationPage.tsx:174` - `setTimeout` is not defined
  - `vitest.setup.ts:13` - `Window` is not defined
- **Done When**:
  - `npm run lint` passes without "is not defined" errors for URL, console, setTimeout, Window
  - All 6 affected locations no longer show ESLint errors

#### PLAN-002: Remove Unused Variable in RecipeGenerationPage

- **Priority**: High
- **Category**: Code Quality (Production Code)
- **Change Type**: modify
- **File(s)**: `src/renderer/pages/RecipeGenerationPage.tsx:37`
- **Instruction**:
  1. Review the usage of `_generatedRecipe` state variable
  2. If truly unused, remove both the state variable and setter:
     ```typescript
     // Remove this line:
     const [_generatedRecipe, setGeneratedRecipe] = useState<Recipe | null>(null);
     ```
  3. If needed for future use, either:
     - Remove the leading underscore and use it in the component
     - Add a TODO comment explaining why it's temporarily unused
  4. Run `npm run lint` to verify warning is resolved
- **Evidence**:
  ```typescript
  // Line 37
  const [_generatedRecipe, setGeneratedRecipe] = useState<Recipe | null>(null);
  ```
- **Done When**:
  - `npm run lint` passes without unused variable warning for `_generatedRecipe`
  - Code is cleaner (variable removed) or documented (TODO added)

**Phase 1 Verification**:

```bash
npm run lint              # Should pass without errors in affected files
npm run typecheck         # Should continue to pass (no type errors)
```

### Phase 2: Medium Priority Issues (Test Code Type Safety)

Execute after Phase 1 passes verification.

#### PLAN-003: Replace `any` Types in Test Mocks

- **Priority**: Medium
- **Category**: Test Code Quality (Type Safety)
- **Change Type**: modify
- **File(s)**:
  - `e2e/ai-recipe-generation.spec.ts:19,125,171,211`
  - `src/main/ai/recipe-generator.test.ts:56-59,246,262,277,288,299`
  - `src/main/ipc/recipe-ai-handlers.test.ts:35,365`
  - `src/main/database/dal/recipes-validation-integration.test.ts:156`
- **Instruction**:
  1. For IPC event mocks, replace `any` with proper Electron types:

     ```typescript
     // BEFORE
     const mockEvent: any = {};

     // AFTER
     import type { IpcMainInvokeEvent } from 'electron';
     const mockEvent = {} as IpcMainInvokeEvent;
     ```

  2. For other test mocks, define proper partial types:
     ```typescript
     // AFTER (alternative)
     type MockEvent = Partial<IpcMainInvokeEvent>;
     const mockEvent: MockEvent = {};
     ```
  3. Apply this pattern to all 14 instances across the test files
  4. Run `npm run lint` to verify no `any` type warnings remain
- **Evidence**:
  14 instances of `const mockEvent: any = {}` and similar patterns across 4 test files
- **Done When**:
  - All 14 `any` types replaced with proper typed mocks
  - `npm run lint` passes without "Unexpected any" errors
  - All tests continue to pass (`npm test`)

#### PLAN-004: Fix Unused Variables in Schema Validation Tests

- **Priority**: Medium
- **Category**: Test Code Quality (Linting)
- **Change Type**: modify
- **File(s)**: `src/main/ai/recipe-schema.test.ts:69,86,108,131,148,256,298,347,394,416,446,511`
- **Instruction**:
  1. Choose a consistent approach for all 12 instances:
     **Option A (Recommended)**: Remove destructuring since variables are unused:

     ```typescript
     // BEFORE
     const { name } = recipeIngredientSchema.parse({ quantity: 1 });

     // AFTER
     expect(() => recipeIngredientSchema.parse({ quantity: 1 })).toThrow();
     ```

     **Option B**: Prefix with underscore if keeping destructuring for documentation:

     ```typescript
     // AFTER (alternative)
     const { name: _name } = recipeIngredientSchema.parse({ quantity: 1 });
     ```

  2. Apply chosen approach to all 12 affected lines
  3. Run `npm run lint` to verify no unused variable warnings remain
- **Evidence**:
  12 instances in `src/main/ai/recipe-schema.test.ts` where destructured variables are never used in tests that expect errors
- **Done When**:
  - All 12 unused variable warnings resolved
  - `npm run lint` passes without errors in schema test file
  - All tests continue to pass (`npm test`)

**Phase 2 Verification**:

```bash
npm run lint              # Should pass with no 'any' or unused var errors
npm test                  # All tests should still pass
```

### Phase 3: Low Priority Issues (Dead Code Cleanup)

Execute after Phase 2 passes verification. Optional if time-constrained.

#### PLAN-005: Review and Handle Unused Barrel Export Files

- **Priority**: Low
- **Category**: Dead Code Cleanup
- **Change Type**: modify or remove
- **File(s)**:
  - `src/renderer/components/RecipeList/index.ts`
  - `src/renderer/components/common/index.ts`
- **Instruction**:
  1. Review if barrel exports are intended for cleaner component imports
  2. Choose one approach:
     - **If barrel exports are intended**: Start using them in component imports
       ```typescript
       // Instead of:
       import { RecipeCard } from './components/RecipeList/RecipeCard';
       // Use:
       import { RecipeCard } from './components/RecipeList';
       ```
     - **If not needed**: Delete both index.ts files
  3. Document decision in commit message
  4. Run `npm run lint` and `npm test` to ensure no breakage
- **Evidence**:
  Knip reports these files as unused (never imported)
- **Done When**:
  - Decision documented in commit message
  - Files either used in imports or deleted
  - All builds and tests pass

#### PLAN-006: Review and Document Unused Module Exports

- **Priority**: Low
- **Category**: Dead Code Cleanup
- **Change Type**: modify or document
- **File(s)**:
  - `src/main/database/index.ts`
  - `src/main/validation/index.ts`
  - `src/main/validation/ingredient-database.ts`
  - `src/shared/constants/dietary-tags.ts`
- **Instruction**:
  1. Review each module's barrel exports
  2. Determine if exports are part of intended public API for future features
  3. Choose one approach:
     - **If public API exports**: Keep them and document in README or comments
     - **If truly unused**: Remove unused exports from index.ts files
  4. Document decision in comments at top of index.ts files:
     ```typescript
     /**
      * Public API exports for database layer.
      * These exports provide a stable interface for future features.
      */
     ```
  5. Run `npm run lint` and `npm test` to ensure no breakage
- **Evidence**:
  Knip reports 4 modules with unused exports (db functions, validation functions, constants)
- **Done When**:
  - Decision documented in code comments or commit message
  - Unused exports either removed or justified as public API
  - All builds and tests pass

#### PLAN-007: Review and Handle Unused Type Exports

- **Priority**: Low
- **Category**: Dead Code Cleanup
- **Change Type**: modify or remove
- **File(s)**:
  - `src/main/validation/index.ts` (IngredientData)
  - `src/shared/types/validation.ts` (ConstraintType)
- **Instruction**:
  1. Review if these types are part of public API
  2. Choose one approach:
     - **If public API types**: Keep and document their purpose
     - **If truly unused**: Remove from exports
  3. Update type definitions:

     ```typescript
     // If removing from index.ts:
     // Remove: export type { IngredientData } from './ingredient-database.js';

     // If keeping, add comment:
     /** Public type for ingredient data structure. */
     export type { IngredientData } from './ingredient-database.js';
     ```

  4. Run `npm run typecheck` to ensure no breakage
- **Evidence**:
  Knip reports `IngredientData` and `ConstraintType` as unused type exports
- **Done When**:
  - Types either removed from exports or documented as public API
  - `npm run typecheck` passes
  - No type errors introduced

**Phase 3 Verification**:

```bash
npm run lint              # Should pass
npm run typecheck         # Should pass
npm test                  # All tests should pass
npm run build             # Should build successfully
```

## Baseline Verification

Before starting Phase 1, run these commands to establish a baseline:

```bash
npm run lint              # Current: 35 ESLint errors
npm run typecheck         # Current: 0 type errors (should remain 0)
npm test                  # Current: All tests passing (should remain passing)
```

Record the current error/warning counts. Each phase should reduce ESLint errors.

## Acceptance Criteria

All acceptance criteria extracted from QA report's recommended action plan:

### Phase 1 Complete When:

- ✅ `npm run lint` passes without "is not defined" errors for URL, console, setTimeout, Window
- ✅ `npm run lint` passes without unused variable warning for `_generatedRecipe`

### Phase 2 Complete When:

- ✅ All 14 instances of `any` replaced with proper typed mocks
- ✅ All 12 unused variable warnings in schema tests resolved
- ✅ `npm test` continues to pass (no test breakage)

### Phase 3 Complete When:

- ✅ Decision made and documented for all barrel export files
- ✅ Decision made and documented for all unused module/type exports
- ✅ `npm run build` produces successful build

### Overall Success Criteria:

- ✅ ESLint errors reduced from 35 to 0
- ✅ Type errors remain at 0 (no regressions)
- ✅ All tests continue to pass
- ✅ Code quality score improves to A+ (from current A-)

## Implementor Checklist

### Phase 1 (High Priority)

- [ ] PLAN-001: Fix Missing Global Definitions in ESLint Config
- [ ] PLAN-002: Remove Unused Variable in RecipeGenerationPage

### Phase 2 (Medium Priority)

- [ ] PLAN-003: Replace `any` Types in Test Mocks
- [ ] PLAN-004: Fix Unused Variables in Schema Validation Tests

### Phase 3 (Low Priority)

- [ ] PLAN-005: Review and Handle Unused Barrel Export Files
- [ ] PLAN-006: Review and Document Unused Module Exports
- [ ] PLAN-007: Review and Handle Unused Type Exports

## References

- Source QA report: `thoughts/shared/qa/2025-12-30-TypeScript-QA-Report.md`
- Automated tools: TypeScript Compiler (tsc --noEmit), ESLint, Knip
- Manual analysis: None (fully automated scan)
- QA Status: ✅ GOOD (no critical issues, no type errors)
- Risk Level: LOW (all issues are code quality improvements)
