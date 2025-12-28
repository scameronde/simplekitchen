# QA-Driven Implementation Plan: TypeScript Codebase

## Inputs

- QA report: `thoughts/shared/qa/2025-12-28-TypeScript-QA-Report.md`
- Audit date: 2025-12-28
- Automated tools: tsc, eslint, knip
- Auditor: python-qa-thorough

## Verified Current State

### Configuration Issues

- **Fact:** ESLint is linting the `dist/` directory (compiled output) causing 207+ false errors
- **Evidence:** `eslint.config.js` (missing ignore patterns)
- **Excerpt:** ESLint config missing `ignores` array for compiled output

- **Fact:** ESLint config missing coverage for test files, config files, and type declaration files
- **Evidence:** `vite.config.ts`, `vitest.config.ts`, `**/*.test.ts`, `**/*.test.tsx`, `**/*.spec.ts`, `.d.ts` files
- **Excerpt:** Parsing errors for `__dirname` usage in config files, `process` in e2e tests, globals not defined in test files

- **Fact:** `.eslintignore` is deprecated - need to migrate ignores to `eslint.config.js`
- **Evidence:** ESLint warning about deprecated `.eslintignore` file
- **Excerpt:** Should use modern flat config format

### Type Safety Issues

- **Fact:** `@typescript-eslint/no-explicit-any` violation in error handler
- **Evidence:** `src/main/database/init.ts:35`
- **Excerpt:** Error handler uses `any` type

- **Fact:** `@typescript-eslint/no-explicit-any` violations in test mocks
- **Evidence:** `src/main/validation/cookware-validator.test.ts:31`, `src/renderer/components/RecipeForm/RecipeForm.test.tsx:9,24,57` (4 locations total)
- **Excerpt:** Tests use `any` for mocks instead of proper types

- **Fact:** Triple-slash reference directive in test setup
- **Evidence:** `src/renderer/test-setup.d.ts:1`
- **Excerpt:** Should use `import '@testing-library/jest-dom'` instead

### Dead Code Issues

- **Fact:** 4 unused files identified
- **Evidence:** Knip dead code detection
- **Files:**
  - `src/renderer/components/RecipeForm/BasicRecipeForm.tsx`
  - `src/renderer/components/RecipeForm/index.ts`
  - `src/renderer/components/common/index.ts`
  - `src/renderer/test-setup.d.ts`

- **Fact:** Unused exports in database index (9 exports)
- **Evidence:** `src/main/database/index.ts`
- **Exports:** `db`, `rawDb`, `getRecipeById`, `getRecipes`, `deleteRecipe`, `getRecipeCount`, `getDietaryProfile`, `updateDietaryProfile`, `resetDietaryProfile`
- **Note:** May be intentional API surface for future phases (Phase 4 viewing/filtering)

- **Fact:** Unused exports in validation index (13 exports)
- **Evidence:** `src/main/validation/index.ts`
- **Note:** May be intentional API surface for future phases

- **Fact:** Unused exported types (3 types)
- **Evidence:** `src/main/validation/index.ts`, `src/shared/types/recipe.ts`, `src/shared/types/validation.ts`
- **Types:** `IngredientData`, `SourceType`, `DietaryProperty`, `ConstraintType`

## Goals / Non-Goals

- **Goals**: Resolve all issues identified in QA report
  - Critical: 0 issues
  - High: 4 issues (ESLint configuration)
  - Medium: 5 issues (type safety + dead code)
  - Low: 1 issue (deprecated .eslintignore)
- **Non-Goals**: New features, performance optimization beyond QA scope, refactoring unrelated code

## Design Overview

This plan addresses quality issues across three categories:

1. **ESLint Configuration**: Fix configuration to ignore compiled output, support all file types (tests, configs, declarations), and use modern flat config format
2. **Type Safety**: Replace `any` types with proper type annotations in error handlers and test mocks
3. **Dead Code**: Remove unused files and review unused exports (some may be intentional API surface for future phases)

## Phased Implementation

### Phase 1: Critical Issues (Security + Blocking Type Errors)

**No critical issues identified.** TypeScript compilation passes with no errors. Proceed to Phase 2.

### Phase 2: High Priority Issues (ESLint Configuration)

Execute these items first; they are causing 200+ false positives and masking real issues.

#### PLAN-001: Add ignore patterns to eslint.config.js (was QA-001)

- **Priority**: High
- **Category**: Configuration
- **Change Type**: modify
- **File(s)**: `eslint.config.js`
- **Instruction**: Add an `ignores` configuration object at the top of the exported array to exclude compiled output, node_modules, and test results from ESLint scanning.
- **Evidence**:
  ```
  ESLint is scanning compiled `dist/` output and bundled files, causing 207+ false errors
  ```
- **Done When**: ESLint config includes:
  ```javascript
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '**/*.js', // Ignore compiled output
      'test-results/**',
    ],
  },
  ```

#### PLAN-002: Add config files scope to eslint (was QA-002)

- **Priority**: High
- **Category**: Configuration
- **Change Type**: modify
- **File(s)**: `eslint.config.js`
- **Instruction**: Add a configuration object for config files (`*.config.ts`, `vitest.setup.ts`) that provides Node.js globals like `__dirname` and `process`.
- **Evidence**:
  ```
  vite.config.ts, vitest.config.ts not covered by ESLint rules - parsing errors for `__dirname` usage
  ```
- **Done When**: ESLint config includes:
  ```javascript
  {
    files: ['*.config.ts', 'vitest.setup.ts'],
    languageOptions: {
      parser: tsParser,
      globals: {
        __dirname: 'readonly',
        process: 'readonly',
      },
    },
  },
  ```

#### PLAN-003: Add test files scope to eslint (was QA-003)

- **Priority**: High
- **Category**: Configuration
- **Change Type**: modify
- **File(s)**: `eslint.config.js`
- **Instruction**: Add a configuration object for test files (`**/*.test.ts`, `**/*.test.tsx`, `**/*.spec.ts`) that provides test framework globals like `describe`, `it`, `expect`, `beforeEach`, `afterEach`, `vi`.
- **Evidence**:
  ```
  Test files `**/*.test.ts`, `**/*.test.tsx`, `**/*.spec.ts` not covered by ESLint rules - Add globals for `process`, test framework APIs
  ```
- **Done When**: ESLint config includes:
  ```javascript
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts'],
    languageOptions: {
      parser: tsParser,
      globals: {
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        vi: 'readonly',
      },
    },
  },
  ```

#### PLAN-004: Add type declaration files scope (was QA-004)

- **Priority**: High
- **Category**: Configuration
- **Change Type**: modify
- **File(s)**: `eslint.config.js`
- **Instruction**: Add a configuration object for `.d.ts` files to ensure proper parser configuration for type declaration files.
- **Evidence**:
  ```
  .d.ts files (e.g., `electron.d.ts`, `database.ts`) getting parsing errors - Need parser config for declaration files
  ```
- **Done When**: ESLint config includes parser configuration for `**/*.d.ts` files OR declaration files no longer produce parsing errors when running `npm run lint`

**Phase 2 Verification**:

```bash
npm run lint  # Should show <10 errors (only real source code issues)
```

### Phase 3: Medium Priority Issues (Type Safety + Dead Code)

Execute after Phase 2 passes verification.

#### PLAN-005: Remove @typescript-eslint/no-explicit-any violation in init.ts (was QA-005)

- **Priority**: Medium
- **Category**: Type Safety
- **Change Type**: modify
- **File(s)**: `src/main/database/init.ts:35`
- **Instruction**: Replace `any` type in error handler with proper error type. Use `unknown` and type guard, or `Error` if appropriate.
- **Evidence**:
  ```typescript
  // src/main/database/init.ts:35
  // Error handler uses `any` type
  ```
- **Done When**: Line 35 of `src/main/database/init.ts` uses typed error handling (e.g., `error: unknown` with type guard or `error: Error`)

#### PLAN-006: Remove @typescript-eslint/no-explicit-any violation in cookware-validator.test.ts (was QA-006)

- **Priority**: Medium
- **Category**: Type Safety
- **Change Type**: modify
- **File(s)**: `src/main/validation/cookware-validator.test.ts:31`
- **Instruction**: Replace `any` type in test mock with proper type. Consider using `Partial<T>` or creating a test helper type.
- **Evidence**:
  ```typescript
  // src/main/validation/cookware-validator.test.ts:31
  // Test uses `any` for mock
  ```
- **Done When**: Line 31 of `src/main/validation/cookware-validator.test.ts` uses typed mock (no `any`)

#### PLAN-007: Remove @typescript-eslint/no-explicit-any violations in RecipeForm.test.tsx (was QA-007)

- **Priority**: Medium
- **Category**: Type Safety
- **Change Type**: modify
- **File(s)**: `src/renderer/components/RecipeForm/RecipeForm.test.tsx:9,24,57`
- **Instruction**: Replace `any` types in window.electron mock with proper types. Use `Partial<ElectronAPI>` or create a test helper type for mocking the Electron API.
- **Evidence**:
  ```typescript
  // src/renderer/components/RecipeForm/RecipeForm.test.tsx:9,24,57 (3 locations)
  // Tests use `any` for window.electron mock
  ```
- **Done When**: Lines 9, 24, and 57 of `src/renderer/components/RecipeForm/RecipeForm.test.tsx` use typed mocks (no `any`)

#### PLAN-008: Fix triple-slash reference directive in test-setup.d.ts (was QA-008)

- **Priority**: Medium
- **Category**: Type Safety
- **Change Type**: modify
- **File(s)**: `src/renderer/test-setup.d.ts:1`
- **Instruction**: Replace triple-slash reference directive with proper ES module import: `import '@testing-library/jest-dom'`
- **Evidence**:
  ```typescript
  // src/renderer/test-setup.d.ts:1
  // Use `import '@testing-library/jest-dom'` instead
  ```
- **Done When**: `src/renderer/test-setup.d.ts` uses `import` statement instead of `/// <reference ...>`

#### PLAN-009: Remove unused files (was QA-009)

- **Priority**: Medium
- **Category**: Dead Code
- **Change Type**: remove
- **File(s)**:
  - `src/renderer/components/RecipeForm/BasicRecipeForm.tsx`
  - `src/renderer/components/RecipeForm/index.ts`
  - `src/renderer/components/common/index.ts`
  - `src/renderer/test-setup.d.ts` (after PLAN-008 is complete)
- **Instruction**: Delete the 4 unused files identified by Knip. These appear to be leftover from refactoring.
- **Evidence**:
  ```
  Knip (Dead Code Detection):
  Unused files (4):
  - src/renderer/components/RecipeForm/BasicRecipeForm.tsx
  - src/renderer/components/RecipeForm/index.ts
  - src/renderer/components/common/index.ts
  - src/renderer/test-setup.d.ts
  ```
- **Done When**: All 4 files are deleted and `npx knip --reporter compact` no longer reports them as unused files

**Phase 3 Verification**:

```bash
npm run lint        # Should pass with no @typescript-eslint/no-explicit-any errors
npx knip --reporter compact  # Should show 0 unused files
```

### Phase 4: Low Priority Issues (Style + Polish)

Execute after Phase 3 passes verification. Optional if time-constrained.

#### PLAN-010: Migrate from .eslintignore to eslint.config.js (was QA-010)

- **Priority**: Low
- **Category**: Configuration
- **Change Type**: remove
- **File(s)**: `.eslintignore`
- **Instruction**: Delete `.eslintignore` file after verifying that all ignore patterns have been migrated to `eslint.config.js` (completed in PLAN-001).
- **Evidence**:
  ```
  ESLint warning about deprecated `.eslintignore` file
  Should use modern flat config format
  ```
- **Done When**: `.eslintignore` file is deleted and `npm run lint` shows no deprecation warnings

**Phase 4 Verification**:

```bash
npm run lint  # Should pass with no deprecation warnings
```

## Baseline Verification

Before starting Phase 2, run these commands to establish a baseline:

```bash
npm run lint
npx tsc --noEmit
npx knip --reporter compact
```

Record the current error/warning counts:

- ESLint: 207 errors (mostly false positives from dist/)
- TypeScript: 0 errors ✅
- Knip: 4 unused files, 22 unused exports

Each phase should reduce these counts.

## Acceptance Criteria

1. **ESLint Configuration Fixed**:
   - `npm run lint` shows <10 errors (only real source code issues)
   - No parsing errors for config files, test files, or declaration files
   - No false positives from `dist/` directory

2. **Type Safety Improved**:
   - All `@typescript-eslint/no-explicit-any` violations resolved
   - Triple-slash reference replaced with ES module import
   - `npm run lint` passes with no type safety violations

3. **Dead Code Removed**:
   - 4 unused files deleted
   - `npx knip --reporter compact` shows 0 unused files
   - Unused exports reviewed (intentional API surface documented or removed)

4. **Configuration Modernized**:
   - `.eslintignore` deleted
   - All ignore patterns in `eslint.config.js`
   - No deprecation warnings from ESLint

5. **All Tools Pass**:
   ```bash
   npm run lint           # ✅ Pass
   npx tsc --noEmit       # ✅ Pass (already passing)
   npx knip --reporter compact  # ✅ 0 unused files, minimal unused exports
   ```

## Implementor Checklist

### Phase 2 (High Priority - ESLint Configuration)

- [ ] PLAN-001: Add ignore patterns to eslint.config.js (was QA-001)
- [ ] PLAN-002: Add config files scope to eslint (was QA-002)
- [ ] PLAN-003: Add test files scope to eslint (was QA-003)
- [ ] PLAN-004: Add type declaration files scope (was QA-004)

### Phase 3 (Medium Priority - Type Safety + Dead Code)

- [ ] PLAN-005: Remove @typescript-eslint/no-explicit-any violation in init.ts (was QA-005)
- [ ] PLAN-006: Remove @typescript-eslint/no-explicit-any violation in cookware-validator.test.ts (was QA-006)
- [ ] PLAN-007: Remove @typescript-eslint/no-explicit-any violations in RecipeForm.test.tsx (was QA-007)
- [ ] PLAN-008: Fix triple-slash reference directive in test-setup.d.ts (was QA-008)
- [ ] PLAN-009: Remove unused files (was QA-009)

### Phase 4 (Low Priority - Configuration Cleanup)

- [ ] PLAN-010: Migrate from .eslintignore to eslint.config.js (was QA-010)

## Notes on Unused Exports

The following unused exports should be **reviewed but not automatically deleted**:

1. **`src/main/database/index.ts`** (9 exports):
   - `db`, `rawDb`, `getRecipeById`, `getRecipes`, `deleteRecipe`, `getRecipeCount`, `getDietaryProfile`, `updateDietaryProfile`, `resetDietaryProfile`
   - **Reason**: These are likely intentional public API for Phase 4 (Viewing & Filtering). Check `thoughts/shared/plans/2025-12-27-Recipe-Collection-Phase4-Viewing-Filtering.md` before deleting.

2. **`src/main/validation/index.ts`** (13 exports):
   - **Reason**: These are likely intentional public API for future validation features. Check against plans before deleting.

3. **Unused types** (`IngredientData`, `SourceType`, `DietaryProperty`, `ConstraintType`):
   - **Reason**: These types may be used in future phases. Review against type definitions in plans.

**Action**: Document these as "intentional API surface" or remove if confirmed unused by product owner.

## References

- Source QA report: `thoughts/shared/qa/2025-12-28-TypeScript-QA-Report.md`
- Automated tools: tsc, eslint, knip
- Manual analysis: Configuration review, dead code review
