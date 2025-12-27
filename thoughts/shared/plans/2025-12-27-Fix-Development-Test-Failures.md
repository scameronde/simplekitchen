# Fix Development and Test Failures Implementation Plan

## Inputs

- **Research report used:** `thoughts/shared/research/2025-12-27-Development-Test-Failures.md`
- **User request summary:** Fix npm run dev failure (native module version mismatch) and npm run test failures (incomplete window.electron mock)

## Verified Current State

### Fact 1: better-sqlite3 Native Module Version Mismatch

**Fact:** better-sqlite3 native binary was compiled for Node.js MODULE_VERSION 127 (Node.js v20.x) but Electron 39.2.7 requires MODULE_VERSION 140 (Node.js v22.x)
**Evidence:** `thoughts/shared/research/2025-12-27-Development-Test-Failures.md:36-48`
**Excerpt:**

```
Error: The module '/home/eichens/workspaces/experiment-ai/opencode/simplekitchen/node_modules/better-sqlite3/build/Release/better_sqlite3.node'
was compiled against a different Node.js version using
NODE_MODULE_VERSION 127. This version of Node.js requires
NODE_MODULE_VERSION 140.
```

### Fact 2: Incomplete window.electron Mock in vitest.setup.ts

**Fact:** vitest.setup.ts:17-21 defines window.electron with only ipcRenderer.invoke but tests expect window.electron.recipeAPI
**Evidence:** `vitest.setup.ts:17-21`
**Excerpt:**

```typescript
globalThis.window.electron = {
  ipcRenderer: {
    invoke: vi.fn(),
  },
};
```

### Fact 3: RecipeForm Tests Reference window.electron.recipeAPI.create

**Fact:** RecipeForm.test.tsx:9 attempts to assign window.electron.recipeAPI.create which is undefined in the current mock
**Evidence:** `RecipeForm.test.tsx:9`
**Excerpt:**

```typescript
(window.electron.recipeAPI.create as any) = vi.fn();
```

### Fact 4: ElectronAPI Type Definition Includes recipeAPI

**Fact:** electron.d.ts:13-19 defines ElectronAPI.recipeAPI with create method matching runtime contract in preload.ts:15-17
**Evidence:** `electron.d.ts:13-19` and `preload.ts:15-17`
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

**Excerpt preload.ts:**

```typescript
recipeAPI: {
  create: (input: CreateRecipeInput) => ipcRenderer.invoke('recipe:create', input),
},
```

### Fact 5: System Node.js Version Aligns with Project Requirements

**Fact:** System uses Node.js v22.21.1, package.json:36 requires ">=22.0.0 <23.0.0", .nvmrc specifies "22"
**Evidence:** `thoughts/shared/research/2025-12-27-Development-Test-Failures.md:179-188`
**Excerpt:**

```
v22.21.1
```

## Goals / Non-Goals

### Goals

1. Fix `npm run dev` by rebuilding better-sqlite3 native module for Electron 39.2.7 (Node.js v22.x)
2. Fix `npm run test` by adding complete window.electron mock matching ElectronAPI interface
3. Ensure test mock structure matches production runtime contract from preload.ts
4. All 96 tests pass successfully

### Non-Goals

- Upgrading/downgrading Electron or Node.js versions
- Adding electron-rebuild as a permanent dependency (use npx for one-time rebuild)
- Modifying RecipeForm tests (they are correctly written)
- Changing production code (preload.ts, electron.d.ts)

## Design Overview

### Issue 1: Native Module Rebuild Strategy

- better-sqlite3 ships with prebuilt binaries for common Node.js versions
- When installed, it attempts to use prebuilt binary matching system Node.js
- Electron embeds its own Node.js version (v22.x) which differs from when better-sqlite3 was installed
- Solution: Use electron-rebuild to recompile better-sqlite3 specifically for Electron's embedded Node.js

### Issue 2: Test Mock Alignment Strategy

- vitest.setup.ts currently provides minimal mock (ipcRenderer only)
- Production runtime (preload.ts) exposes full ElectronAPI interface via contextBridge
- Tests expect window.electron.recipeAPI.create to exist
- Solution: Expand vitest.setup.ts mock to match full ElectronAPI interface from electron.d.ts
- Mock structure should mirror preload.ts structure (platform, versions, recipeAPI)

## Implementation Instructions (For Implementor)

### PLAN-001: Rebuild better-sqlite3 for Electron

**Action ID:** PLAN-001
**Change Type:** Execute rebuild command
**File(s):** `node_modules/better-sqlite3/build/Release/better_sqlite3.node` (modified via rebuild)
**Instruction:**

1. Run `npx electron-rebuild -f -w better-sqlite3` to force rebuild better-sqlite3 module for current Electron version
2. Command will:
   - Detect Electron 39.2.7 from package.json
   - Rebuild better-sqlite3 native module for NODE_MODULE_VERSION 140 (Node.js v22.x)
   - Replace existing better_sqlite3.node binary
3. Verify success by checking command exit code (0 = success)

**Evidence:** `package.json:40-41` (Electron 39.2.7 and better-sqlite3 12.5.0 installed)
**Done When:**

- Command completes with exit code 0
- No error messages in output
- better_sqlite3.node timestamp is updated to current time

### PLAN-002: Expand vitest.setup.ts Mock to Match ElectronAPI

**Action ID:** PLAN-002
**Change Type:** Modify
**File(s):** `vitest.setup.ts`
**Instruction:**

1. Replace the global Window interface declaration (lines 5-13) with import of ElectronAPI type
2. Add import statement at top: `import type { ElectronAPI } from './src/shared/types/electron';`
3. Update global interface declaration to use ElectronAPI type:

```typescript
declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
```

4. Replace window.electron mock assignment (lines 17-21) with complete mock matching ElectronAPI structure:

```typescript
globalThis.window.electron = {
  platform: 'test',
  versions: {
    node: '22.0.0',
    chrome: '126.0.0',
    electron: '39.0.0',
  },
  recipeAPI: {
    create: vi.fn(),
  },
};
```

5. Ensure all three properties (platform, versions, recipeAPI) are present to match preload.ts:6-18 structure

**Evidence:**

- `vitest.setup.ts:17-21` (current incomplete mock)
- `electron.d.ts:5-20` (full ElectronAPI interface)
- `preload.ts:6-18` (production contextBridge structure)

**Done When:**

- vitest.setup.ts imports ElectronAPI type from electron.d.ts
- Window interface uses ElectronAPI type
- window.electron mock includes all three properties: platform, versions, recipeAPI
- recipeAPI.create is a vi.fn() mock function
- TypeScript compilation succeeds with no type errors

### PLAN-003: Verify npm run dev Success

**Action ID:** PLAN-003
**Change Type:** Verification
**File(s):** N/A (runtime verification)
**Instruction:**

1. Run `npm run dev` command
2. Verify all three concurrent processes start:
   - TypeScript compilation completes with 0 errors
   - Vite dev server starts on http://localhost:5173
   - Electron main process starts WITHOUT native module error
3. Verify Electron window opens successfully (indicates better-sqlite3 loaded correctly)
4. Stop dev server with Ctrl+C after verification

**Evidence:** `package.json:13` (dev script definition)
**Done When:**

- `npm run dev` runs without errors
- Electron window opens
- No "NODE_MODULE_VERSION" error appears in console
- Can manually close the dev server

### PLAN-004: Verify npm run test Success

**Action ID:** PLAN-004
**Change Type:** Verification
**File(s):** N/A (runtime verification)
**Instruction:**

1. Run `npm run test` command
2. Verify test output shows:
   - Test Files: 15 passed (15) [no failures]
   - Tests: 96 passed (96) [no failures]
   - All RecipeForm.test.tsx tests pass (5 tests)
3. Specifically verify no "Cannot set properties of undefined" errors
4. Confirm all test files pass with no failures

**Evidence:**

- `package.json:21` (test script definition)
- `RecipeForm.test.tsx:9` (line that previously failed)

**Done When:**

- `npm run test` exits with code 0
- Console output shows "Test Files 15 passed (15)"
- Console output shows "Tests 96 passed (96)"
- No errors mentioning "recipeAPI" or "undefined"

## Verification Tasks

None. All claims verified against source code.

## Acceptance Criteria

1. **npm run dev starts successfully**
   - TypeScript compilation completes
   - Vite dev server starts on port 5173
   - Electron main process starts and window opens
   - No native module version mismatch errors
   - Database operations work (better-sqlite3 loads correctly)

2. **npm run test passes all tests**
   - 15/15 test files pass
   - 96/96 tests pass
   - RecipeForm.test.tsx tests all pass
   - No "Cannot set properties of undefined" errors
   - window.electron.recipeAPI.create mock works correctly in tests

3. **Type safety maintained**
   - vitest.setup.ts uses ElectronAPI type from electron.d.ts
   - No type errors in test setup
   - Mock structure matches production contract

4. **Development workflow restored**
   - Developers can run `npm run dev` to start development server
   - Developers can run `npm run test` to verify code changes
   - CI/CD pipelines can run tests successfully

## Implementor Checklist

- [ ] PLAN-001: Rebuild better-sqlite3 for Electron
- [ ] PLAN-002: Expand vitest.setup.ts mock to match ElectronAPI
- [ ] PLAN-003: Verify npm run dev success
- [ ] PLAN-004: Verify npm run test success

## Notes

### Why electron-rebuild?

- better-sqlite3 is a native Node.js addon (C++ compiled to .node binary)
- Electron bundles its own Node.js version which may differ from system Node.js
- Native addons must be compiled for the exact Node.js version that will load them
- electron-rebuild automates this recompilation process for all native dependencies

### Why npx instead of installing electron-rebuild?

- electron-rebuild is only needed when:
  - First setting up the project
  - After upgrading Electron versions
  - After npm install if node_modules was deleted
- Not needed during normal development (binary is cached)
- Using npx avoids adding devDependency that's rarely used
- If rebuilds are needed frequently, can add to postinstall script later

### Mock Structure Rationale

- vitest.setup.ts mock must match preload.ts structure exactly
- Tests depend on window.electron.recipeAPI.create being assignable
- Using ElectronAPI type ensures compile-time validation of mock completeness
- If ElectronAPI interface changes, TypeScript will catch mock drift
