# QA-Driven Implementation Plan: TypeScript

## Inputs

- QA report: `thoughts/shared/qa/2025-12-29-TypeScript-QA-Report.md`
- Audit date: 2025-12-29
- Automated tools: TypeScript Compiler (tsc), ESLint, Knip
- Auditor: Quick QA Agent

## Verified Current State

### ESLint Configuration Issues

**Issue 2.1: Type Definition Files Not Properly Configured**

- **Fact:** ESLint parser cannot recognize TypeScript syntax in type-only files, causing 8 parsing errors
- **Evidence:**
  - `src/shared/types/electron.d.ts` (4 false positives)
  - `src/shared/types/database.ts` (1 parsing error)
  - `src/shared/types/recipe.ts` (1 parsing error)
  - `src/shared/types/validation.ts` (1 parsing error)
  - `src/shared/constants/dietary-tags.ts` (1 parsing error)
- **Excerpt:**
  ```javascript
  // Current eslint.config.js missing configuration for:
  // 'src/shared/types/**/*.ts', 'src/shared/constants/**/*.ts'
  ```

**Issue 2.2: Missing Global Declarations for Node.js APIs**

- **Fact:** ESLint config for main process doesn't include `performance` global, causing 12 linting errors
- **Evidence:** `src/main/database/benchmark.ts` (12 instances of `performance` API)
- **Excerpt:**
  ```javascript
  // Current globals (eslint.config.js lines 20-24):
  globals: {
    process: 'readonly',
    __dirname: 'readonly',
    console: 'readonly',
    Buffer: 'readonly',
    // Missing: performance: 'readonly'
  }
  ```

**Issue 2.3: E2E Test Files Missing Configuration**

- **Fact:** E2E test files not covered by ESLint config patterns, causing 8 linting errors
- **Evidence:**
  - `e2e/manual-entry.spec.ts` (2 instances)
  - `e2e/recipe-viewing.spec.ts` (6 instances)
- **Excerpt:**
  ```javascript
  // Current config only handles **/*.test.ts and **/*.spec.ts in src/
  // Missing configuration for e2e/**/*.spec.ts
  ```

### Code Quality Issues

**Issue 3.1: Unused Error Variables in Catch Blocks**

- **Fact:** Error variables defined but never used in catch blocks, preventing error logging
- **Evidence:**
  - `src/renderer/pages/RecipeDetailPage.tsx:29`
  - `src/renderer/pages/RecipeListPage.tsx:31`
  - `src/renderer/pages/RecipeListPage.tsx:54`
- **Excerpt:**
  ```typescript
  try {
    // ... operation
  } catch (err) {
    // 'err' defined but never used
    setError('Failed to load recipes');
  }
  ```

**Issue 3.2: Explicit `any` Types in Test Mocks**

- **Fact:** Test mocks use explicit `any` type assertions instead of proper types
- **Evidence:**
  - `src/renderer/pages/RecipeListPage.test.tsx:49`
  - `src/renderer/pages/RecipeListPage.test.tsx:80`
  - `src/renderer/pages/RecipeListPage.test.tsx:120`
- **Excerpt:**
  ```typescript
  window.api = {
    getRecipes: vi.fn().mockResolvedValue([...] as any),
    //                                          ^^^^^^ Explicit any
  }
  ```

### Dead Code Issues

**Issue 4.1: Unused Barrel Files**

- **Fact:** Barrel files (re-export modules) are never imported
- **Evidence:**
  - `src/renderer/components/RecipeList/index.ts`
  - `src/renderer/components/common/index.ts`

**Issue 4.3: Duplicate Export**

- **Fact:** `INGREDIENT_DATABASE` is exported from both internal module and public API
- **Evidence:**
  - `src/main/validation/ingredient-database.ts` (internal module export)
  - `src/main/validation/index.ts` (public API export)

**Issue 4.4: Unused Type Exports**

- **Fact:** Types defined but never imported
- **Evidence:**
  - `src/shared/types/recipe.ts`: `SourceType`, `DietaryProperty`
  - `src/shared/types/validation.ts`: `ConstraintType`

**Issue 4.5: Unused Constants**

- **Fact:** `DIETARY_TAG_LABELS` exported but never imported
- **Evidence:** `src/shared/constants/dietary-tags.ts`

### React Best Practices Issues

**Issue 5.1: Missing Hook Dependencies**

- **Fact:** React Hook useEffect has missing dependency 'loadRecipe'
- **Evidence:** `src/renderer/pages/RecipeDetailPage.tsx:17`
- **Excerpt:**

  ```typescript
  const loadRecipe = async () => { ... };

  useEffect(() => {
    loadRecipe();
  }, [id]); // Missing 'loadRecipe' dependency
  ```

### Test Configuration Issues

**Issue 6.1: Type Augmentation in Test Setup**

- **Fact:** Type augmentation for `Window` interface triggers linting warnings
- **Evidence:** `vitest.setup.ts:7,13`
- **Excerpt:**
  ```typescript
  declare global {
    interface Window {
      // 'Window' defined but never used
      api: ElectronAPI;
    }
  }
  ```

## Goals / Non-Goals

- **Goals**: Resolve all issues identified in QA report
  - High Priority: 3 items (28 linting errors fixed)
  - Medium Priority: 4 items (4 code quality issues fixed)
  - Low Priority: 4 items (5 minor improvements)
  - **Total**: 11 PLAN items, ~37 issues resolved
- **Non-Goals**: New features, performance optimization beyond QA scope, refactoring unrelated code

## Design Overview

This plan addresses quality issues across four categories:

1. **ESLint Configuration**: Update `eslint.config.js` to properly handle type definition files, E2E tests, and Node.js globals
2. **Error Handling**: Improve debugging capability by logging or intentionally ignoring caught errors
3. **Type Safety**: Replace explicit `any` types in test mocks with proper type annotations
4. **Code Cleanup**: Remove duplicate exports, unused types, and unused constants to reduce clutter

All issues are non-blocking. The codebase has **zero TypeScript compilation errors** and is production-ready.

## Phased Implementation

### Phase 1: High Priority Issues (ESLint Configuration)

Execute these items first; they resolve 28 linting errors.

#### PLAN-001: Fix Type Definition Files ESLint Config (was QA Issue 2.1)

- **Priority**: High
- **Category**: ESLint Configuration
- **Change Type**: modify
- **File(s)**: `eslint.config.js`
- **Instruction**: Add ESLint configuration for type definition and constant files to fix parsing errors. Add a new configuration object to handle `src/shared/types/**/*.ts` and `src/shared/constants/**/*.ts` files with TypeScript parser and disable unused-vars rules (these are type definitions).
- **Evidence**:
  ```javascript
  // Files affected by missing config:
  // - src/shared/types/electron.d.ts (4 false positives)
  // - src/shared/types/database.ts (1 parsing error)
  // - src/shared/types/recipe.ts (1 parsing error)
  // - src/shared/types/validation.ts (1 parsing error)
  // - src/shared/constants/dietary-tags.ts (1 parsing error)
  ```
  **Recommended Code**:
  ```javascript
  {
    files: ['src/shared/types/**/*.ts', 'src/shared/constants/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      'no-unused-vars': 'off', // Use TypeScript's unused check instead
      '@typescript-eslint/no-unused-vars': 'off', // These are type definitions
    },
  }
  ```
- **Done When**:
  - ESLint no longer reports parsing errors for type definition files
  - `npm run lint` passes for `src/shared/types/**/*.ts` and `src/shared/constants/**/*.ts`
  - 8 parsing errors resolved

#### PLAN-002: Add performance Global to ESLint Config (was QA Issue 2.2)

- **Priority**: High
- **Category**: ESLint Configuration
- **Change Type**: modify
- **File(s)**: `eslint.config.js` (lines 20-24)
- **Instruction**: Add `performance: 'readonly'` to the globals object in the main process ESLint configuration to fix 12 linting errors in benchmark.ts.
- **Evidence**:
  ```javascript
  // Current globals (eslint.config.js lines 20-24):
  globals: {
    process: 'readonly',
    __dirname: 'readonly',
    console: 'readonly',
    Buffer: 'readonly',
    // Missing: performance
  }
  // Affects: src/main/database/benchmark.ts (12 instances)
  ```
  **Recommended Code**:
  ```javascript
  globals: {
    process: 'readonly',
    __dirname: 'readonly',
    console: 'readonly',
    Buffer: 'readonly',
    performance: 'readonly', // Add this
  }
  ```
- **Done When**:
  - ESLint no longer reports `performance` as undefined in `src/main/database/benchmark.ts`
  - `npm run lint` passes for benchmark.ts
  - 12 linting errors resolved

#### PLAN-003: Add E2E Test Files ESLint Config (was QA Issue 2.3)

- **Priority**: High
- **Category**: ESLint Configuration
- **Change Type**: modify
- **File(s)**: `eslint.config.js`
- **Instruction**: Add ESLint configuration for E2E test files to fix 8 linting errors. Create a new configuration object for `e2e/**/*.spec.ts` files with TypeScript parser and Playwright globals.
- **Evidence**:
  ```javascript
  // Files affected:
  // - e2e/manual-entry.spec.ts (2 instances)
  // - e2e/recipe-viewing.spec.ts (6 instances)
  // Current config only handles **/*.test.ts and **/*.spec.ts in src/
  ```
  **Recommended Code**:
  ```javascript
  {
    files: ['e2e/**/*.spec.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        process: 'readonly',
        test: 'readonly',
        expect: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
    },
  }
  ```
- **Done When**:
  - ESLint no longer reports errors for E2E test files
  - `npm run lint` passes for `e2e/**/*.spec.ts`
  - 8 linting errors resolved

**Phase 1 Verification**:

```bash
npm run lint  # Should show 28 fewer errors
# Verify no errors in:
# - src/shared/types/
# - src/shared/constants/
# - src/main/database/benchmark.ts
# - e2e/*.spec.ts
```

---

### Phase 2: Medium Priority Issues (Code Quality)

Execute after Phase 1 passes verification.

#### PLAN-004: Fix Unused Error Variables (was QA Issue 3.1)

- **Priority**: Medium
- **Category**: Error Handling
- **Change Type**: modify
- **File(s)**:
  - `src/renderer/pages/RecipeDetailPage.tsx:29`
  - `src/renderer/pages/RecipeListPage.tsx:31`
  - `src/renderer/pages/RecipeListPage.tsx:54`
- **Instruction**: Either log caught errors for debugging or rename them with underscore prefix to indicate intentionally unused. Recommended approach is to log errors using console.error for better debugging capability.
- **Evidence**:
  ```typescript
  // Current pattern:
  try {
    // ... operation
  } catch (err) {
    // 'err' defined but never used
    setError('Failed to load recipes');
  }
  ```
  **Recommended Code (Option 1 - Log errors)**:
  ```typescript
  catch (err) {
    console.error('Failed to load recipes:', err);
    setError('Failed to load recipes');
  }
  ```
  **Recommended Code (Option 2 - Ignore intentionally)**:
  ```typescript
  catch (_err) { // Underscore indicates intentionally unused
    setError('Failed to load recipes');
  }
  ```
- **Done When**:
  - All 3 instances of unused error variables are either logged or prefixed with underscore
  - `npm run lint` no longer warns about unused error variables
  - Better debugging capability if errors are logged

#### PLAN-005: Fix Explicit Any Types in Test Mocks (was QA Issue 3.2)

- **Priority**: Medium
- **Category**: Type Safety
- **Change Type**: modify
- **File(s)**:
  - `src/renderer/pages/RecipeListPage.test.tsx:49`
  - `src/renderer/pages/RecipeListPage.test.tsx:80`
  - `src/renderer/pages/RecipeListPage.test.tsx:120`
- **Instruction**: Replace explicit `any` type assertions in test mocks with proper `Recipe[]` type. Import the Recipe type from shared types.
- **Evidence**:

  ```typescript
  // Current code:
  window.api = {
    getRecipes: vi.fn().mockResolvedValue([...] as any),
    //                                          ^^^^^^ Explicit any
  }
  ```

  **Recommended Code**:

  ```typescript
  import type { Recipe } from '@shared/types/recipe';

  window.api = {
    getRecipes: vi.fn().mockResolvedValue([...] as Recipe[]),
  }
  ```

- **Done When**:
  - All 3 instances of `as any` replaced with `as Recipe[]`
  - Recipe type imported from `@shared/types/recipe`
  - `npm run lint` passes with no explicit any warnings in test file
  - Type safety maintained in tests

#### PLAN-006: Remove Duplicate INGREDIENT_DATABASE Export (was QA Issue 4.3)

- **Priority**: Medium
- **Category**: Code Cleanup
- **Change Type**: modify
- **File(s)**: `src/main/validation/ingredient-database.ts`
- **Instruction**: Remove the `export` keyword from `INGREDIENT_DATABASE` constant in ingredient-database.ts since it's already exported from the public API (index.ts). Keep it as an internal constant.
- **Evidence**:

  ```typescript
  // Currently exported from both:
  // - ingredient-database.ts (internal module)
  // - index.ts (public API via re-export)
  ```

  **Recommended Code**:

  ```typescript
  // In ingredient-database.ts - remove export, keep internal
  const INGREDIENT_DATABASE = { ... };

  // Export only from index.ts (already done)
  export { INGREDIENT_DATABASE } from './ingredient-database.js';
  ```

- **Done When**:
  - `INGREDIENT_DATABASE` is not exported from `ingredient-database.ts`
  - `INGREDIENT_DATABASE` remains exported from `index.ts` (public API)
  - No build or test failures
  - Knip no longer reports duplicate export

#### PLAN-007: Review and Remove Unused Type Exports (was QA Issue 4.4)

- **Priority**: Medium
- **Category**: Code Cleanup
- **Change Type**: modify
- **File(s)**:
  - `src/shared/types/recipe.ts`
  - `src/shared/types/validation.ts`
- **Instruction**: Review the following unused type exports and either document them with a comment if planned for future use, or remove them: `SourceType`, `DietaryProperty` (from recipe.ts), and `ConstraintType` (from validation.ts). If removing, ensure no breaking changes.
- **Evidence**:
  ```typescript
  // Unused types detected by Knip:
  // - src/shared/types/recipe.ts: SourceType, DietaryProperty
  // - src/shared/types/validation.ts: ConstraintType
  ```
  **Recommended Action**:
  - Check if types are planned for future use
  - If yes, add comment: `// Reserved for future use`
  - If no, remove the type definitions
- **Done When**:
  - All unused type exports are either documented with future use comment or removed
  - No build or import errors
  - Knip no longer reports these types as unused (or they're documented)

**Phase 2 Verification**:

```bash
npm run lint      # Should pass with no warnings in modified files
npm test          # All tests should pass
npx knip          # Should show reduced unused exports count
```

---

### Phase 3: Low Priority Issues (Polish)

Execute after Phase 2 passes verification. Optional if time-constrained.

#### PLAN-008: Fix React Hook Dependencies (was QA Issue 5.1)

- **Priority**: Low
- **Category**: React Best Practices
- **Change Type**: modify
- **File(s)**: `src/renderer/pages/RecipeDetailPage.tsx:17`
- **Instruction**: Fix missing dependency warning by wrapping `loadRecipe` function in `useCallback` hook with proper dependencies, then include it in useEffect dependency array.
- **Evidence**:

  ```typescript
  // Current code:
  const loadRecipe = async () => { ... };

  useEffect(() => {
    loadRecipe();
  }, [id]); // Missing 'loadRecipe' dependency - React warns about this
  ```

  **Recommended Code**:

  ```typescript
  const loadRecipe = useCallback(async () => {
    // ... implementation
  }, [id]);

  useEffect(() => {
    loadRecipe();
  }, [loadRecipe]); // Now safe
  ```

- **Done When**:
  - `loadRecipe` function wrapped in `useCallback` with `[id]` dependency
  - `useEffect` dependency array includes `loadRecipe`
  - React no longer warns about missing dependencies in console
  - No test failures

#### PLAN-009: Add vitest.setup.ts ESLint Exception (was QA Issue 6.1)

- **Priority**: Low
- **Category**: ESLint Configuration
- **Change Type**: modify
- **File(s)**: `eslint.config.js`
- **Instruction**: Add ESLint rule override for vitest.setup.ts to disable unused-vars rules for type augmentation syntax (which ESLint doesn't understand).
- **Evidence**:
  ```typescript
  // vitest.setup.ts:7,13
  declare global {
    interface Window {
      // 'Window' defined but never used - false positive
      api: ElectronAPI;
    }
  }
  ```
  **Recommended Code**:
  ```javascript
  // In eslint.config.js
  {
    files: ['vitest.setup.ts'],
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  }
  ```
- **Done When**:
  - ESLint no longer warns about unused `Window` interface in vitest.setup.ts
  - `npm run lint` passes for vitest.setup.ts
  - Type augmentation continues to work correctly

#### PLAN-010: Review Barrel File Usage (was QA Issue 4.1)

- **Priority**: Low
- **Category**: Code Cleanup
- **Change Type**: modify or remove
- **File(s)**:
  - `src/renderer/components/RecipeList/index.ts`
  - `src/renderer/components/common/index.ts`
- **Instruction**: Review whether these barrel files are intended for convenience imports. If they're intended for use, add a comment documenting their purpose and example usage. If they're truly unused and not planned, delete the files.
- **Evidence**:
  ```typescript
  // These are barrel files (re-export modules) that are never imported
  // Detected by Knip as unused
  ```
  **Recommended Action**:
  - If keeping for convenience imports, add comment:
    ```typescript
    // Barrel file for convenient component imports
    // Usage: import { RecipeCard, RecipeGrid } from '@/components/RecipeList'
    ```
  - If truly unused, delete the files
- **Done When**:
  - Decision made: keep (with documentation) or delete
  - If kept, files have documentation comments
  - If deleted, no import errors in codebase
  - Knip no longer reports these as unused (or they're documented)

#### PLAN-011: Review DIETARY_TAG_LABELS Usage (was QA Issue 4.5)

- **Priority**: Low
- **Category**: Code Cleanup
- **Change Type**: modify or remove
- **File(s)**: `src/shared/constants/dietary-tags.ts`
- **Instruction**: Review whether `DIETARY_TAG_LABELS` constant is needed. If it's planned for UI display purposes, add a comment documenting its intended use. If it's truly unused and not planned, remove the export.
- **Evidence**:
  ```typescript
  // src/shared/constants/dietary-tags.ts
  // DIETARY_TAG_LABELS exported but never imported
  // Detected by Knip as unused
  ```
  **Recommended Action**:
  - If keeping for future use, add comment:
    ```typescript
    // Reserved for UI display of dietary tag labels
    export const DIETARY_TAG_LABELS = { ... };
    ```
  - If truly unused, remove the constant
- **Done When**:
  - Decision made: keep (with documentation) or remove
  - If kept, constant has documentation comment
  - If removed, no build errors
  - Knip no longer reports this as unused (or it's documented)

**Phase 3 Verification**:

```bash
npm run lint      # Should pass with no warnings
npm test          # All tests should pass
npm run dev       # App should run without React warnings in console
npx knip          # Should show minimal or zero unused exports
```

---

## Baseline Verification

Before starting Phase 1, run these commands to establish a baseline:

```bash
npm run typecheck  # Should pass with 0 errors (already verified)
npm run lint       # Record current error count (43 issues reported)
npx knip           # Record current unused export count
```

**Current Baseline** (from QA Report):

- TypeScript errors: 0 ✅
- Total issues: 43 (0 critical, 18 high, 15 medium, 10 low)
- Code Quality Score: 87/100

Each phase should improve these metrics:

- Phase 1: -28 issues (lint errors)
- Phase 2: -4 issues (code quality)
- Phase 3: -5 issues (polish)

---

## Acceptance Criteria

### Overall Success Criteria

1. ✅ **Zero TypeScript compilation errors** (already achieved, must maintain)
2. ✅ **All ESLint errors resolved** (Phase 1 target: 28 issues fixed)
3. ✅ **All code quality issues addressed** (Phase 2 target: 4 issues fixed)
4. ✅ **All low-priority items reviewed** (Phase 3 target: 5 issues fixed)
5. ✅ **All tests passing** (must maintain throughout)

### Per-Phase Acceptance

- **Phase 1 Complete**: `npm run lint` shows 28 fewer errors, all config-related issues resolved
- **Phase 2 Complete**: Error handling improved, no explicit `any` in tests, dead code reduced
- **Phase 3 Complete**: React warnings resolved, barrel files reviewed, all unused exports documented or removed

### Quality Metrics Target

- Type Safety: 100/100 (maintain)
- Linting: 100/100 (up from 70/100)
- Dead Code: 95/100 (up from 85/100)
- Test Quality: 95/100 (up from 90/100)
- **Overall Code Quality Score: 97+/100** (up from 87/100)

---

## Implementor Checklist

### Phase 1 (High Priority - ESLint Configuration)

- [ ] PLAN-001: Fix Type Definition Files ESLint Config (10 min)
- [ ] PLAN-002: Add performance Global to ESLint Config (2 min)
- [ ] PLAN-003: Add E2E Test Files ESLint Config (5 min)
- [ ] **Phase 1 Verification**: `npm run lint` (expect 28 fewer errors)

### Phase 2 (Medium Priority - Code Quality)

- [ ] PLAN-004: Fix Unused Error Variables (5 min)
- [ ] PLAN-005: Fix Explicit Any Types in Test Mocks (10 min)
- [ ] PLAN-006: Remove Duplicate INGREDIENT_DATABASE Export (3 min)
- [ ] PLAN-007: Review and Remove Unused Type Exports (5 min)
- [ ] **Phase 2 Verification**: `npm run lint && npm test` (all pass)

### Phase 3 (Low Priority - Polish)

- [ ] PLAN-008: Fix React Hook Dependencies (5 min)
- [ ] PLAN-009: Add vitest.setup.ts ESLint Exception (3 min)
- [ ] PLAN-010: Review Barrel File Usage (2 min)
- [ ] PLAN-011: Review DIETARY_TAG_LABELS Usage (2 min)
- [ ] **Phase 3 Verification**: `npm run dev` (no console warnings)

### Final Verification

- [ ] `npm run typecheck` - passes with 0 errors
- [ ] `npm run lint` - passes with 0 errors
- [ ] `npm test` - all tests pass
- [ ] `npx knip` - minimal or documented unused exports
- [ ] Code Quality Score: 97+/100

---

## References

- Source QA report: `thoughts/shared/qa/2025-12-29-TypeScript-QA-Report.md`
- Automated tools: TypeScript Compiler (tsc), ESLint, Knip
- Manual analysis categories: ESLint Configuration, Error Handling, Type Safety, Dead Code, React Best Practices
- Total estimated effort: ~52 minutes
- Expected issues resolved: 37 (from 43 total non-blocking issues)
