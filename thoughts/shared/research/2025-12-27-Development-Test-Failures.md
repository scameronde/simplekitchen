---
date: 2025-12-27
researcher: research-architect
topic: 'npm run dev and npm run test failures'
status: complete
coverage:
  - package.json scripts
  - better-sqlite3 native module
  - vitest test setup
  - electron window API mocking
---

# Research: Development and Test Script Failures

## Executive Summary

- `npm run dev` fails due to NODE_MODULE_VERSION mismatch between better-sqlite3 binary (v127) and Electron runtime (v140)
- better-sqlite3 native module was compiled for Node.js v20.x but Electron 39.2.7 embeds Node.js v22.x
- `npm run test` has 5 failing tests in RecipeForm.test.tsx due to incomplete window.electron mock
- vitest.setup.ts mocks window.electron.ipcRenderer but tests expect window.electron.recipeAPI
- Main process tests (91/96) pass successfully

## Coverage Map

- `/home/eichens/workspaces/experiment-ai/opencode/simplekitchen/package.json`
- `/home/eichens/workspaces/experiment-ai/opencode/simplekitchen/vitest.setup.ts`
- `/home/eichens/workspaces/experiment-ai/opencode/simplekitchen/src/renderer/components/RecipeForm/RecipeForm.test.tsx`
- `/home/eichens/workspaces/experiment-ai/opencode/simplekitchen/src/shared/types/electron.d.ts`
- `/home/eichens/workspaces/experiment-ai/opencode/simplekitchen/node_modules/better-sqlite3/build/Release/better_sqlite3.node`
- Runtime inspection: Node.js version, Electron version, module versions

## Critical Findings (Verified, Planner Attention Required)

### Finding 1: Native Module Version Mismatch (npm run dev failure)

**Observation:** Electron process exits immediately on launch with error "The module '/home/eichens/workspaces/experiment-ai/opencode/simplekitchen/node_modules/better-sqlite3/build/Release/better_sqlite3.node' was compiled against a different Node.js version using NODE_MODULE_VERSION 127. This version of Node.js requires NODE_MODULE_VERSION 140."

**Direct consequence:** Development server cannot run. TypeScript compilation succeeds and Vite dev server starts on port 5173, but Electron main process crashes before window creation.

**Evidence:** `npm run dev` output, lines 24-26
**Excerpt:**

```
Error: The module '/home/eichens/workspaces/experiment-ai/opencode/simplekitchen/node_modules/better-sqlite3/build/Release/better_sqlite3.node'
was compiled against a different Node.js version using
NODE_MODULE_VERSION 127. This version of Node.js requires
NODE_MODULE_VERSION 140.
```

### Finding 2: Electron Version Uses Node.js 22.x

**Observation:** Electron 39.2.7 embeds Node.js with MODULE_VERSION 140, which corresponds to Node.js v22.x

**Direct consequence:** better-sqlite3 native binary must be compiled for Node.js v22.x to work with this Electron version

**Evidence:** `npm run dev` output, line 25
**Excerpt:**

```
NODE_MODULE_VERSION 127. This version of Node.js requires
NODE_MODULE_VERSION 140.
```

### Finding 3: better-sqlite3 Binary Compiled for Node.js v20.x

**Observation:** better-sqlite3 native module binary timestamp (Nov 28 22:57) predates current installation, MODULE_VERSION 127 corresponds to Node.js v20.x

**Direct consequence:** Binary was compiled during a previous installation with different Node.js version or downloaded as prebuilt for wrong version

**Evidence:** `ls -la node_modules/better-sqlite3/build/Release/` output
**Excerpt:**

```
-rwxr-xr-x 1 eichens eichens 2091392 Nov 28 22:57 better_sqlite3.node
```

### Finding 4: Incomplete window.electron Mock in Tests

**Observation:** vitest.setup.ts defines window.electron with only ipcRenderer.invoke property, but RecipeForm.test.tsx line 9 attempts to assign window.electron.recipeAPI.create

**Direct consequence:** All 5 RecipeForm tests fail with "TypeError: Cannot set properties of undefined (setting 'create')" because window.electron.recipeAPI is undefined

**Evidence:** `vitest.setup.ts:17-21` and `RecipeForm.test.tsx:9`
**Excerpt vitest.setup.ts:**

```typescript
globalThis.window.electron = {
  ipcRenderer: {
    invoke: vi.fn(),
  },
};
```

**Excerpt RecipeForm.test.tsx:**

```typescript
beforeEach(() => {
  vi.clearAllMocks();
  (window.electron.recipeAPI.create as any) = vi.fn();
});
```

### Finding 5: Type Definition Mismatch Between Setup and Usage

**Observation:** src/shared/types/electron.d.ts:13-19 defines ElectronAPI.recipeAPI with create method, but vitest.setup.ts:17-21 does not include recipeAPI in its mock

**Direct consequence:** Test setup does not match application runtime contract, causing test infrastructure to be incompatible with component expectations

**Evidence:** `src/shared/types/electron.d.ts:13-19` vs `vitest.setup.ts:17-21`
**Excerpt electron.d.ts:**

```typescript
recipeAPI: {
  create: (input: CreateRecipeInput) =>
    Promise<{
      success: boolean;
      recipe?: Recipe;
      errors?: Array<{ field: string; message: string }>;
    }>;
}
```

## Detailed Technical Analysis (Verified)

### npm run dev Script Execution Flow

**Observation:** package.json:13 defines dev script as concurrently running three processes: watch:main (TypeScript compiler), watch:renderer (Vite), and Electron launch after Vite is ready

**Evidence:** `package.json:13`
**Excerpt:**

```json
"dev": "concurrently \"npm run watch:main\" \"npm run watch:renderer\" \"wait-on http://localhost:5173 && cross-env NODE_ENV=development electron dist/main/main.js\""
```

**Observation:** TypeScript compilation completes successfully with 0 errors at 23:12:26, Vite starts successfully on port 5173 in 158ms, but Electron crashes immediately on require('better-sqlite3')

**Evidence:** `npm run dev` output lines 13, 21-22, 28-40

### npm run test Script Execution Flow

**Observation:** package.json:21 defines test script as "vitest run", which executes all test files

**Evidence:** `package.json:21`
**Excerpt:**

```json
"test": "vitest run"
```

**Observation:** 14 test files pass (91 tests total), only src/renderer/components/RecipeForm/RecipeForm.test.tsx fails (5 tests)

**Evidence:** `npm run test` output, summary section
**Excerpt:**

```
Test Files  1 failed | 14 passed (15)
     Tests  5 failed | 91 passed (96)
```

### Test Failure Root Cause

**Observation:** All 5 test failures occur at RecipeForm.test.tsx:9 during beforeEach hook, before any test logic executes

**Evidence:** `npm run test` output, error section
**Excerpt:**

```
TypeError: Cannot set properties of undefined (setting 'create')
 ❯ src/renderer/components/RecipeForm/RecipeForm.test.tsx:9:32
      7|   beforeEach(() => {
      8|     vi.clearAllMocks();
      9|     (window.electron.recipeAPI.create as any) = vi.fn();
       |                                ^
```

### Node.js Version Alignment

**Observation:** System Node.js version is v22.21.1 (verified via node --version), .nvmrc specifies "22", package.json:36 requires ">=22.0.0 <23.0.0"

**Direct consequence:** System Node.js version matches project requirements, but better-sqlite3 binary was not compiled for this version

**Evidence:** `node --version` output and `.nvmrc` content
**Excerpt:**

```
v22.21.1
```

## Verification Log

**Verified:**

- `/home/eichens/workspaces/experiment-ai/opencode/simplekitchen/package.json`
- `/home/eichens/workspaces/experiment-ai/opencode/simplekitchen/vitest.setup.ts`
- `/home/eichens/workspaces/experiment-ai/opencode/simplekitchen/src/renderer/components/RecipeForm/RecipeForm.test.tsx`
- `/home/eichens/workspaces/experiment-ai/opencode/simplekitchen/src/shared/types/electron.d.ts`
- `/home/eichens/workspaces/experiment-ai/opencode/simplekitchen/.nvmrc`

**Spot-checked excerpts captured:** yes

## Open Questions / Unverified Claims

- Whether better-sqlite3 v12.5.0 officially supports Electron 39.2.7 (would require web search of better-sqlite3 compatibility matrix)
- Whether electron-rebuild is installed or configured in the project (not found in package.json devDependencies)
- When the better-sqlite3 binary was originally compiled (Nov 28 22:57 timestamp, but no context for what triggered that build)

## References

- `package.json:13` - dev script definition
- `package.json:21` - test script definition
- `package.json:36` - Node.js engine requirement
- `package.json:40` - better-sqlite3 dependency version
- `package.json:41` - electron dependency version
- `vitest.setup.ts:17-21` - window.electron mock definition
- `src/renderer/components/RecipeForm/RecipeForm.test.tsx:9` - recipeAPI.create assignment causing test failure
- `src/shared/types/electron.d.ts:13-19` - ElectronAPI.recipeAPI type definition
- `.nvmrc:1` - Node.js version specification
