# QA-Driven Implementation Plan: TypeScript

## Inputs

- QA report: `thoughts/shared/qa/2025-12-27-TypeScript-QA-Report.md`
- Audit date: 2025-12-27
- Automated tools: tsc, eslint, knip
- Auditor: Quick QA Agent

## Verified Current State

### Configuration Issues

- **Fact:** TypeScript configuration prevents proper compilation checking
- **Evidence:** Base `tsconfig.json` lacks JSX configuration and project references
- **Excerpt:**

  ```
  src/renderer/App.tsx(2,31): error TS6142: Module './pages/AddRecipePage' was resolved to
    '...AddRecipePage.tsx', but '--jsx' is not set.
  src/renderer/App.tsx(6,5): error TS17004: Cannot use JSX unless the '--jsx' flag is provided.
  ```

- **Fact:** Missing type export breaks RecipeForm compilation
- **Evidence:** `src/shared/types/recipe.ts:9`
- **Excerpt:**

  ```
  src/renderer/components/RecipeForm/RecipeForm.tsx(9,34): error TS2459:
    Module '"../../../shared/types/recipe"' declares 'CookwareType' locally,
    but it is not exported.
  ```

- **Fact:** Knip reports entry points as unused files
- **Evidence:** Entry points not configured in knip
- **Excerpt:**
  ```
  Unused files (10):
  - src/main/main.ts
  - src/main/preload.ts
  - src/renderer/main.tsx
  - src/renderer/App.tsx
  ```

### Type Safety Issues

- **Fact:** 8 instances of explicit `any` type bypass type checking
- **Evidence:** Multiple files using `any` for event handlers and database queries
- **Excerpt:**

  ```typescript
  // src/main/database/dal/recipes.ts:8
  const row = await this.db.selectFrom('recipes').selectAll().where('id', '=', id).executeTakeFirst() as any;

  // src/renderer/components/RecipeForm/IngredientList.tsx:19
  const handleChange = (e: any) => { ... }
  ```

### Code Quality Issues

- **Fact:** 7 unused imports clutter the codebase
- **Evidence:** eslint (@typescript-eslint/no-unused-vars)
- **Excerpt:**

  ```typescript
  // src/main/database/dal/recipes-validation-integration.test.ts:2
  import { getRecipeById } from './recipes'; // unused

  // src/main/validation/dietary-validator.test.ts:1
  import { beforeEach } from 'vitest'; // unused
  ```

- **Fact:** 19 exported functions/values never used
- **Evidence:** knip unused exports report
- **Excerpt:**
  ```
  Unused exports (19 total):
  - src/main/database/index.ts: db, rawDb, getRecipes, deleteRecipe, etc.
  - src/main/validation/index.ts: validateRecipe, lookupIngredient, etc.
  ```

### Configuration and Dependency Issues

- **Fact:** Build artifacts (`dist/`) included in linting, generating 150+ false errors
- **Evidence:** eslint scanning compiled JavaScript
- **Excerpt:**

  ```
  dist/main/main.js:1: 'console' is not defined
  dist/renderer/index.js:523: 'window' is not defined
  [... 150+ similar errors ...]
  ```

- **Fact:** ESLint global configuration doesn't distinguish main vs renderer environments
- **Evidence:** 10 false `no-undef` warnings for environment-specific globals
- **Excerpt:**

  ```
  src/renderer/components/common/Button.tsx:3: 'HTMLButtonElement' is not defined
  src/main/main.ts:41: 'console' is not defined
  ```

- **Fact:** Unlisted dependency `@eslint/js` used but not in package.json
- **Evidence:** knip dependency analysis
- **Excerpt:**

  ```javascript
  // eslint.config.js
  import js from '@eslint/js'; // not in package.json devDependencies
  ```

- **Fact:** DevDependency `kysely-codegen` never imported
- **Evidence:** knip unused dependency report
- **Excerpt:**
  ```
  Unused devDependencies (1):
  - kysely-codegen
  ```

## Goals / Non-Goals

- **Goals**: Resolve all issues identified in QA report
  - Critical: 2 issues (TypeScript configuration blocking)
  - High: 1 issue (Knip configuration)
  - Medium: 42 issues (type safety, code quality, dependencies)
  - Low: 163+ issues (mostly build artifacts noise)
- **Non-Goals**: New features, performance optimization beyond QA scope, refactoring unrelated code

## Design Overview

This plan addresses quality issues across five categories:

1. **Configuration**: Fix TypeScript project references and JSX settings to enable proper type checking
2. **Type Safety**: Remove explicit `any` types and add proper type annotations
3. **Code Quality**: Remove unused imports and clarify API surface with documentation
4. **Build Tooling**: Configure knip, eslint, and linting exclusions properly
5. **Dependencies**: Resolve missing/unused dependency declarations

## Phased Implementation

### Phase 1: Critical Issues (Configuration Blocking Type Checking)

Execute these items first; they block proper TypeScript validation.

#### PLAN-001: Fix TypeScript Project References (was C1)

- **Priority**: Critical
- **Category**: Configuration
- **Change Type**: modify
- **File(s)**: `tsconfig.json`, `package.json`
- **Instruction**:
  1. Modify base `tsconfig.json` to use project references:
     ```json
     {
       "files": [],
       "references": [{ "path": "./tsconfig.main.json" }, { "path": "./tsconfig.renderer.json" }]
     }
     ```
  2. Update `package.json` scripts section:
     ```json
     "typecheck": "tsc --noEmit -p tsconfig.main.json && tsc --noEmit -p tsconfig.renderer.json"
     ```
  3. Run `npm run typecheck` to verify
- **Evidence**:
  ```
  src/renderer/App.tsx(2,31): error TS6142: Module './pages/AddRecipePage' was resolved to
    '...AddRecipePage.tsx', but '--jsx' is not set.
  src/renderer/App.tsx(6,5): error TS17004: Cannot use JSX unless the '--jsx' flag is provided.
  ```
- **Done When**: `npm run typecheck` executes both main and renderer type checks without JSX configuration errors

#### PLAN-002: Export CookwareType from recipe.ts (was C2)

- **Priority**: Critical
- **Category**: Type Safety
- **Change Type**: modify
- **File(s)**: `src/shared/types/recipe.ts:7`
- **Instruction**:
  Add type re-export after line 6:
  ```typescript
  export type { CookwareType, Season, SourceType, DietaryTag, DietaryProperty } from './database';
  ```
- **Evidence**:
  ```
  src/renderer/components/RecipeForm/RecipeForm.tsx(9,34): error TS2459:
    Module '"../../../shared/types/recipe"' declares 'CookwareType' locally,
    but it is not exported.
  ```
- **Done When**: `RecipeForm.tsx` can successfully import `CookwareType` from `../../../shared/types/recipe` without TypeScript errors

**Phase 1 Verification**:

```bash
npm run typecheck  # Should execute successfully with project references
tsc --noEmit -p tsconfig.renderer.json  # Should compile RecipeForm.tsx without CookwareType error
```

### Phase 2: High Priority Issues (Tool Configuration)

Execute after Phase 1 passes verification.

#### PLAN-003: Configure Knip Entry Points (was H1)

- **Priority**: High
- **Category**: Configuration
- **Change Type**: create
- **File(s)**: `knip.json` (new file)
- **Instruction**:
  Create `knip.json` in project root:
  ```json
  {
    "entry": [
      "src/main/main.ts",
      "src/main/preload.ts",
      "src/renderer/main.tsx",
      "vite.config.ts",
      "vitest.config.ts",
      "playwright.config.ts",
      "eslint.config.js"
    ],
    "project": ["src/**/*.{ts,tsx}"],
    "ignore": ["dist/**", "**/*.test.ts", "**/*.spec.ts"]
  }
  ```
- **Evidence**:
  ```
  Unused files (10):
  - src/main/main.ts (Electron main process entry)
  - src/main/preload.ts (Preload script)
  - src/renderer/main.tsx (React entry)
  - src/renderer/App.tsx (Root component)
  ```
- **Done When**: `npx knip --reporter compact` no longer reports entry point files as unused

**Phase 2 Verification**:

```bash
npx knip --reporter compact  # Should not report entry points as unused files
```

### Phase 3: Medium Priority Issues (Code Quality)

Execute after Phase 2 passes verification.

#### PLAN-004: Remove Explicit `any` Types in Production Code (was M1)

- **Priority**: Medium
- **Category**: Type Safety
- **Change Type**: modify
- **File(s)**:
  - `src/main/database/dal/recipes.ts:8`
  - `src/renderer/components/RecipeForm/IngredientList.tsx:19`
  - `src/renderer/components/RecipeForm/RecipeForm.tsx:46,47`
- **Instruction**:
  1. In `src/main/database/dal/recipes.ts:8`, remove `as any` and use Kysely's typed result:

     ```typescript
     // Before:
     const row = (await this.db
       .selectFrom('recipes')
       .selectAll()
       .where('id', '=', id)
       .executeTakeFirst()) as any;

     // After:
     const row = await this.db
       .selectFrom('recipes')
       .selectAll()
       .where('id', '=', id)
       .executeTakeFirst();
     ```

  2. In `src/renderer/components/RecipeForm/IngredientList.tsx:19`, use React event type:

     ```typescript
     // Before:
     const handleChange = (e: any) => { ... }

     // After:
     const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => { ... }
     ```

  3. In `src/renderer/components/RecipeForm/RecipeForm.tsx:46,47`, type event handlers properly:
     ```typescript
     // Use appropriate React event types (ChangeEvent, FormEvent, etc.)
     ```

- **Evidence**:
  ```
  eslint warning: Unexpected any. Specify a different type. (@typescript-eslint/no-explicit-any)
  - recipes.ts:8
  - IngredientList.tsx:19
  - RecipeForm.tsx:46,47
  ```
- **Done When**: ESLint reports no `@typescript-eslint/no-explicit-any` warnings in these 3 production files

#### PLAN-005: Remove Explicit `any` Types in Test Code (was M1 - Test Files)

- **Priority**: Medium
- **Category**: Type Safety
- **Change Type**: modify
- **File(s)**:
  - `src/main/database/dal/recipes-validation-integration.test.ts:126`
  - `src/main/ipc/recipe-handlers.test.ts:17,27,38`
  - `vitest.setup.ts:5,6`
- **Instruction**:
  1. In test files, replace `any` with proper mock types:

     ```typescript
     // Before:
     const mockFn = vi.fn() as any;

     // After:
     const mockFn = vi.fn() as MockedFunction<typeof originalFn>;
     ```

  2. For IPC event mocks, create a type:
     ```typescript
     type MockIpcEvent = { sender: { send: (channel: string, ...args: unknown[]) => void } };
     ```
  3. For vitest.setup.ts, see PLAN-012 (Low priority - complex fix)

- **Evidence**:
  ```
  eslint warning: Unexpected any in test files
  - recipes-validation-integration.test.ts:126
  - recipe-handlers.test.ts:17,27,38
  - vitest.setup.ts:5,6
  ```
- **Done When**: ESLint reports no `@typescript-eslint/no-explicit-any` warnings in test files (except vitest.setup.ts if deferred to PLAN-012)

#### PLAN-006: Remove Unused Imports (was M2)

- **Priority**: Medium
- **Category**: Code Quality
- **Change Type**: modify
- **File(s)**:
  - `src/main/database/dal/recipes-validation-integration.test.ts:2`
  - `src/main/validation/dietary-validator.test.ts:1,4`
  - `src/main/validation/dietary-validator.ts:8,9`
  - `src/main/validation/validator.ts:2`
  - `src/main/database/init.ts:9`
- **Instruction**:
  Remove the following unused imports:
  1. `recipes-validation-integration.test.ts:2` - Remove `getRecipeById`
  2. `dietary-validator.test.ts:1` - Remove `beforeEach`
  3. `dietary-validator.test.ts:4` - Remove `DietaryTag`
  4. `dietary-validator.ts:8` - Remove `ValidationResult`
  5. `dietary-validator.ts:9` - Remove `lookupIngredient`
  6. `validator.ts:2` - Remove `DietaryProfile`
  7. `init.ts:9` - Remove `__dirname` variable declaration (if truly unused)
- **Evidence**:
  ```
  eslint warning: '@typescript-eslint/no-unused-vars' - 7 instances
  ```
- **Done When**: ESLint reports no unused import warnings for these 7 instances

#### PLAN-007: Document Intentional Unused Exports (was M3 + M4)

- **Priority**: Medium
- **Category**: Code Quality
- **Change Type**: modify
- **File(s)**:
  - `src/main/database/index.ts`
  - `src/main/validation/index.ts`
  - `src/shared/types/database.ts`
  - `src/shared/types/recipe.ts`
  - `src/shared/types/validation.ts`
- **Instruction**:
  1. Add JSDoc comments to unused exports indicating future use:

     ```typescript
     /**
      * Public API for Phase 4+ features.
      * @future Phase 4 - Recipe browsing and filtering
      */
     export const getRecipes = ...;

     /**
      * Ingredient lookup API for future import features.
      * @future Phase 5 - Recipe import validation
      */
     export const lookupIngredient = ...;
     ```

  2. Review `rawDb` export - consider removing if it's internal-only:
     ```typescript
     // Remove rawDb from public exports if not needed externally
     ```
  3. Add file-level documentation explaining the API surface:
     ```typescript
     /**
      * @module database
      * Public database API for recipe management.
      * Many functions are exported for future phases but not yet used.
      * See Phase 4 plan for usage.
      */
     ```

- **Evidence**:
  ```
  knip report: 19 unused exports across database and validation modules
  knip report: 5 unused exported types (IngredientData, IngredientTable, Ingredient, ConstraintType)
  ```
- **Done When**: All unused exports have JSDoc comments indicating future use, or are removed if truly internal-only

#### PLAN-008: Install Missing Dependency @eslint/js (was M5)

- **Priority**: Medium
- **Category**: Dependencies
- **Change Type**: modify
- **File(s)**: `package.json`
- **Instruction**:
  Run:

  ```bash
  npm install --save-dev @eslint/js
  ```

  Alternatively, if it's a peer dependency of another package, configure knip to ignore it:

  ```json
  // knip.json
  {
    "ignoreDependencies": ["@eslint/js"]
  }
  ```

- **Evidence**:
  ```
  knip warning: Unlisted dependency '@eslint/js' used in eslint.config.js
  ```
- **Done When**: `@eslint/js` appears in `package.json` devDependencies OR knip no longer reports it as unlisted

#### PLAN-009: Resolve kysely-codegen Unused Dependency (was M6)

- **Priority**: Medium
- **Category**: Dependencies
- **Change Type**: modify
- **File(s)**: `package.json` or `knip.json`
- **Instruction**:
  Determine if `kysely-codegen` is used manually:

  **Option A (if used as CLI tool)**: Configure knip to recognize it:

  ```json
  // knip.json
  {
    "ignoreDependencies": ["kysely-codegen"]
  }
  ```

  **Option B (if unused)**: Remove it:

  ```bash
  npm uninstall kysely-codegen
  ```

- **Evidence**:
  ```
  knip warning: Unused devDependency 'kysely-codegen'
  ```
- **Done When**: `kysely-codegen` is either removed from package.json OR knip no longer reports it as unused

**Phase 3 Verification**:

```bash
npx eslint . --ext .ts,.tsx  # Should show reduced warnings (no unused imports, no `any` in production code)
npx knip --reporter compact  # Should show reduced unused exports (with JSDoc comments added)
```

### Phase 4: Low Priority Issues (Build Tool Noise)

Execute after Phase 3 passes verification. Optional if time-constrained.

#### PLAN-010: Exclude Build Artifacts from Linting (was L1)

- **Priority**: Low
- **Category**: Configuration
- **Change Type**: create
- **File(s)**: `.eslintignore` (new file)
- **Instruction**:
  Create `.eslintignore` in project root:
  ```
  dist/
  node_modules/
  *.min.js
  ```
- **Evidence**:
  ```
  ESLint scanning dist/: 150+ errors
  dist/main/main.js:1: 'console' is not defined
  dist/renderer/index.js:523: 'window' is not defined
  ```
- **Done When**: `npx eslint . --ext .ts,.tsx` does not report any errors from `dist/` directory

#### PLAN-011: Split ESLint Config by Environment (was L2)

- **Priority**: Low
- **Category**: Configuration
- **Change Type**: modify
- **File(s)**: `eslint.config.js`
- **Instruction**:
  Update `eslint.config.js` with environment-specific global configurations:

  ```javascript
  import js from '@eslint/js';

  export default [
    js.configs.recommended,
    {
      files: ['src/main/**/*.ts'],
      languageOptions: {
        globals: {
          process: 'readonly',
          __dirname: 'readonly',
          console: 'readonly',
          Buffer: 'readonly',
        },
      },
    },
    {
      files: ['src/renderer/**/*.tsx', 'src/renderer/**/*.ts'],
      languageOptions: {
        globals: {
          window: 'readonly',
          document: 'readonly',
          HTMLElement: 'readonly',
          HTMLButtonElement: 'readonly',
          HTMLInputElement: 'readonly',
          HTMLSelectElement: 'readonly',
        },
      },
    },
  ];
  ```

- **Evidence**:
  ```
  eslint no-undef warnings (10 instances):
  - Button.tsx:3 - HTMLButtonElement
  - Checkbox.tsx:3 - HTMLInputElement
  - main.ts:41,43 - console
  ```
- **Done When**: ESLint reports no `no-undef` warnings for environment-specific globals (HTMLButtonElement, console, etc.)

#### PLAN-012: Fix Vitest Global Type Declarations (was L3)

- **Priority**: Low
- **Category**: Type Safety
- **Change Type**: modify
- **File(s)**: `vitest.setup.ts:5-6`
- **Instruction**:
  Add proper type declarations for vitest globals:

  ```typescript
  // vitest.setup.ts
  import { vi } from 'vitest';

  declare global {
    var window: typeof globalThis & {
      electron: {
        ipcRenderer: {
          invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
        };
      };
    };
  }

  // Type-safe global setup
  globalThis.window = globalThis as typeof globalThis & { electron: typeof window.electron };
  globalThis.window.electron = {
    ipcRenderer: {
      invoke: vi.fn(),
    },
  };
  ```

- **Evidence**:
  ```
  tsc errors in vitest.setup.ts:5-6
  global.window = global as any;
  global.window.electron = { ... } as any;
  ```
- **Done When**: `tsc --noEmit` reports no errors in `vitest.setup.ts`

**Phase 4 Verification**:

```bash
npx eslint . --ext .ts,.tsx  # Should show ~40 actionable errors (not 223)
tsc --noEmit -p tsconfig.main.json  # Should pass with no errors
```

## Baseline Verification

Before starting Phase 1, run these commands to establish a baseline:

```bash
npx tsc --noEmit  # Will fail due to missing project references
npx tsc --noEmit -p tsconfig.main.json  # Current main errors
npx tsc --noEmit -p tsconfig.renderer.json  # Current renderer errors (150+ JSX errors)
npx eslint . --ext .ts,.tsx  # 223 errors (150+ in dist/)
npx knip --reporter compact  # 10 false "unused files", 19 unused exports
```

Record the current error/warning counts. Each phase should reduce these counts.

## Acceptance Criteria

### Phase 1 Complete When:

- ✅ `npm run typecheck` executes successfully using project references
- ✅ No JSX configuration errors in renderer code
- ✅ RecipeForm can import CookwareType without TypeScript errors
- ✅ TypeScript error count reduced from 150+ to <10

### Phase 2 Complete When:

- ✅ Knip recognizes all 10 entry point files
- ✅ No false "unused file" warnings for application entry points

### Phase 3 Complete When:

- ✅ Zero `any` types in production code (3 files)
- ✅ `any` types in test code reduced or properly typed
- ✅ Zero unused import warnings (7 instances removed)
- ✅ All intentional unused exports documented with JSDoc
- ✅ `@eslint/js` dependency resolved (installed or knip-ignored)
- ✅ `kysely-codegen` dependency resolved (removed or knip-ignored)

### Phase 4 Complete When:

- ✅ ESLint ignores `dist/` directory (no false errors from build artifacts)
- ✅ ESLint globals configured per environment (main vs renderer)
- ✅ Vitest setup file has proper type declarations
- ✅ Total ESLint errors reduced from 223 to ~40 actionable errors

### Final Success Criteria:

```bash
# Expected final state:
npx tsc --noEmit -p tsconfig.main.json     # ✅ 0 errors
npx tsc --noEmit -p tsconfig.renderer.json # ✅ 0 errors
npx eslint . --ext .ts,.tsx                # ✅ ~40 actionable errors (down from 223)
npx knip --reporter compact                # ✅ 0 false positives, documented exports only
```

## Implementor Checklist

### Phase 1 (Critical)

- [ ] PLAN-001: Fix TypeScript Project References (was C1)
- [ ] PLAN-002: Export CookwareType from recipe.ts (was C2)

### Phase 2 (High)

- [ ] PLAN-003: Configure Knip Entry Points (was H1)

### Phase 3 (Medium)

- [ ] PLAN-004: Remove Explicit `any` Types in Production Code (was M1)
- [ ] PLAN-005: Remove Explicit `any` Types in Test Code (was M1 - Test Files)
- [ ] PLAN-006: Remove Unused Imports (was M2)
- [ ] PLAN-007: Document Intentional Unused Exports (was M3 + M4)
- [ ] PLAN-008: Install Missing Dependency @eslint/js (was M5)
- [ ] PLAN-009: Resolve kysely-codegen Unused Dependency (was M6)

### Phase 4 (Low)

- [ ] PLAN-010: Exclude Build Artifacts from Linting (was L1)
- [ ] PLAN-011: Split ESLint Config by Environment (was L2)
- [ ] PLAN-012: Fix Vitest Global Type Declarations (was L3)

## References

- Source QA report: `thoughts/shared/qa/2025-12-27-TypeScript-QA-Report.md`
- Automated tools: tsc, eslint, knip
- Manual analysis: Configuration, type safety, code quality, dependencies
