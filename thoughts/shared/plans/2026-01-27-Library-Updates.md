# Library Updates Implementation Plan

## Inputs
- **Research report**: `thoughts/shared/research/2026-01-27-electron-ui-library-versions.md`
- **User request**: Update libraries based on research findings of available newer versions
- **Current package.json**: `/home/eichens/workspaces/experiment-ai/opencode/simplekitchen/package.json`

## Verified Current State

### React Ecosystem (Major Version Gap)
- **Fact:** React and react-dom are at version 18.3.1 with caret ranges `^18.3.1`. React 19.2.4 is available.
- **Evidence:** `package.json:50-51`, research report lines 29-38
- **Excerpt:**
  ```json
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  ```
- **Implication:** Major version upgrade with potential breaking changes. Related packages @types/react (18.3.27 → 19.2.10), @types/react-dom (18.3.7 → 19.2.3), and eslint-plugin-react-hooks (5.2.0 → 7.0.1) must be updated together.

### Build Tooling (Vite - Major Version Gap)
- **Fact:** Vite is at version 6.4.1 with caret range `^6.4.1`. Vite 7.3.1 is available.
- **Evidence:** `package.json:84`, research report lines 40-48
- **Excerpt:**
  ```json
  "vite": "^6.4.1",
  ```
- **Implication:** Major version upgrade. Plugin @vitejs/plugin-react at 4.7.0 has update to 5.1.2 which may be required for Vite 7 compatibility.

### Build Plugin (Vite React Plugin)
- **Fact:** @vitejs/plugin-react is at version 4.7.0 with caret range `^4.7.0`. Version 5.1.2 is available.
- **Evidence:** `package.json:66`, research report lines 104-112
- **Excerpt:**
  ```json
  "@vitejs/plugin-react": "^4.7.0",
  ```
- **Implication:** Must be coordinated with Vite 7 upgrade.

### Testing Framework (Vitest - TWO Major Version Gap)
- **Fact:** Vitest and @vitest/coverage-v8 are at version 2.1.9 with caret range `^2.1.9`. Version 4.0.18 is available (two major versions ahead).
- **Evidence:** `package.json:85,67`, research report lines 50-59
- **Excerpt:**
  ```json
  "@vitest/coverage-v8": "^2.1.9",
  "vitest": "^2.1.9",
  ```
- **Implication:** Large version jump may require vitest.config.ts changes.

### Electron Runtime (Major Version Gap)
- **Fact:** Electron is at version 39.2.7 with caret range `^39.2.7`. Electron 40.0.0 (major) and 39.3.0 (minor) are available.
- **Evidence:** `package.json:47`, research report lines 61-69
- **Excerpt:**
  ```json
  "electron": "^39.2.7",
  ```
- **Implication:** Major version 40 may have new Chromium/Node.js versions affecting native modules. Minor version 39.3.0 is safer alternative.

### Database ORM (Minor Version Update)
- **Fact:** Kysely is at version 0.27.6 with caret range `^0.27.6`. Version 0.28.10 is available.
- **Evidence:** `package.json:48`, research report lines 145-154
- **Excerpt:**
  ```json
  "kysely": "^0.27.6",
  ```
- **Implication:** Minor version update, lower risk.

### Native Database Module (Patch Update)
- **Fact:** better-sqlite3 is pinned to exact version 12.5.0 (no caret). Version 12.6.2 is available. Uses electron-rebuild in postinstall script.
- **Evidence:** `package.json:45,33`, research report lines 145-154
- **Excerpt:**
  ```json
  "better-sqlite3": "12.5.0",
  "postinstall": "electron-rebuild -f -w better-sqlite3"
  ```
- **Implication:** Native module requiring rebuild. Version update should be tested carefully with current Electron version.

### E2E Testing (Minor Version Update)
- **Fact:** Playwright and @playwright/test are both at version 1.57.0 with caret ranges. Version 1.58.0 is available.
- **Evidence:** `package.json:56,77`, research report lines 134-141
- **Excerpt:**
  ```json
  "@playwright/test": "^1.57.0",
  "playwright": "^1.57.0",
  ```
- **Implication:** Minor version update, low risk.

### Additional Safe Updates (Minor/Patch)
- **Fact:** Multiple packages have minor/patch updates available with low risk:
  - openai: 6.15.0 → 6.16.0
  - zod: 4.2.1 → 4.3.6
  - @typescript-eslint/eslint-plugin: 8.50.1 → 8.54.0
  - @typescript-eslint/parser: 8.50.1 → 8.54.0
  - prettier: 3.7.4 → 3.8.1
  - @testing-library/react: 16.3.1 → 16.3.2
  - xstate: 5.18.2 → 5.26.0 (installed 5.25.0)
  - wait-on: 8.0.5 → 9.0.3 (major, but low risk utility)
  - electron-builder: 24.13.3 → 26.4.0 (major, coordinated with Electron)
- **Evidence:** Research report lines 166-232
- **Implication:** These can be grouped into low-risk update batch.

### Packages Already at Latest
- **Fact:** The following packages have no newer versions available:
  - @chatscope/chat-ui-kit-react: 2.0.3
  - @chatscope/chat-ui-kit-styles: 1.4.0
  - tailwindcss: 4.1.18
  - @tailwindcss/postcss: 4.1.18
  - typescript: 5.9.3
  - eslint: 9.39.2
  - eslint-plugin-react: 7.37.5
- **Evidence:** Research report lines 84-101, 115-120, 186-194
- **Implication:** No action needed for these packages.

## Goals / Non-Goals

### Goals
1. Update all dependencies to their latest compatible versions where updates are available
2. Minimize breaking changes through phased rollout
3. Maintain full test coverage and passing builds after each phase
4. Document any required code changes for major version upgrades
5. Provide rollback points via git commits between phases

### Non-Goals
1. NOT updating packages already at latest versions (no busywork)
2. NOT making functional changes to application features
3. NOT updating Electron to 40.x without explicit approval (high risk)
4. NOT combining high-risk updates in a single phase
5. NOT proceeding without verification between phases

## Design Overview

### Phased Rollout Strategy

Updates are organized into 6 phases based on risk level and interdependencies:

```
Phase 1: Safe Updates (Minor/Patch)
├─ Low risk, no breaking changes
├─ Reduces scope for later phases
└─ Includes: Kysely, Playwright, OpenAI, Zod, ESLint, Prettier, XState

Phase 2: Build Tooling (Vite + Plugin)
├─ Must be coordinated together
├─ Affects build process only
└─ Includes: Vite 6→7, @vitejs/plugin-react 4→5

Phase 3: Testing Framework (Vitest)
├─ Two major version jump
├─ May require config changes
└─ Includes: vitest 2→4, @vitest/coverage-v8 2→4

Phase 4: React Ecosystem (Coordinated Major)
├─ Highest risk user-facing changes
├─ Multiple packages must update together
└─ Includes: React 18→19, types, react-hooks plugin

Phase 5: Electron Ecosystem (Optional/Deferred)
├─ Decision point: 39.3 (safe) vs 40.0 (risky)
├─ Affects native modules
└─ Includes: Electron, electron-builder, better-sqlite3

Phase 6: Remaining Utilities
├─ Low priority cleanup
└─ Includes: wait-on
```

### Dependency Graph
```
Phase 1 (Safe) → Phase 2 (Vite) → Phase 3 (Vitest) → Phase 4 (React)
                                                             ↓
                                                    Phase 5 (Electron)*
                                                             ↓
                                                    Phase 6 (Utils)

* Phase 5 can be deferred or skipped based on user decision
```

### Rollback Strategy
- Each phase ends with a git commit
- If a phase fails, revert to previous commit
- Phases are independent enough to skip problematic updates

### Verification Strategy
After each phase:
1. `npm install` - Ensure dependencies resolve
2. `npm run typecheck` - Ensure TypeScript compilation succeeds
3. `npm run build` - Ensure build outputs are generated
4. `npm run lint` - Ensure code style compliance
5. `npm run test` - Ensure unit tests pass
6. `npm run test:e2e` - Ensure E2E tests pass (Phase 4 onward)

## User Decision Points (APPROVAL REQUIRED)

### Decision 1: Electron Update Strategy
**Question:** How should Electron be updated?

**Option A - Conservative (Recommended):**
- Update to Electron 39.3.0 (minor version within same major)
- Lower risk for native modules (better-sqlite3)
- Update better-sqlite3 to 12.6.2
- Update electron-builder to 25.x or defer

**Option B - Aggressive:**
- Update to Electron 40.0.0 (major version)
- Higher risk: new Chromium/Node.js versions
- May require better-sqlite3 testing/rebuild verification
- Update electron-builder to 26.4.0

**Option C - Defer:**
- Skip Electron ecosystem updates entirely
- Keep current 39.2.7
- Revisit after other updates are stable

**Planner Recommendation:** Option A (Conservative) - Update to 39.3.0

### Decision 2: Implementation Approach
**Question:** Should all phases be implemented sequentially, or pause for approval between high-risk phases?

**Option A - Continuous (Recommended if low risk tolerance):**
- Implement Phase 1, verify, commit
- Implement Phase 2, verify, commit
- **PAUSE** - User approval before Phase 3
- Implement Phase 3, verify, commit
- **PAUSE** - User approval before Phase 4
- Implement Phase 4, verify, commit
- **PAUSE** - User decision on Phase 5

**Option B - Batch (Recommended if high risk tolerance):**
- Implement Phases 1-3, verify each, commit
- **PAUSE** - User approval before React update
- Implement Phase 4, verify, commit
- **PAUSE** - User decision on Phase 5

**Planner Recommendation:** Option A (Continuous with approval gates)

### Decision 3: React 19 Update Timing
**Question:** When should React 19 upgrade occur?

**Option A - Include in this plan:**
- React 19 is stable and widely adopted
- Breaking changes are well-documented
- Includes in Phase 4 of this plan

**Option B - Defer to separate effort:**
- Keep React 18.3.1 for now
- Focus on build tooling and testing updates first
- Tackle React 19 as separate initiative after observing ecosystem maturity

**Planner Recommendation:** Option A (Include in this plan)

## Implementation Instructions (For Implementor)

### PHASE 1: Safe Minor/Patch Updates

#### PLAN-001: Update Kysely ORM
- **Change Type:** modify
- **File:** `package.json`
- **Instruction:**
  1. Change line 48 from `"kysely": "^0.27.6"` to `"kysely": "^0.27.6"`
  2. Run `npm install kysely@0.28.10`
  3. Verify installation with `npm list kysely`
- **Evidence:** Research report lines 145-154, package.json:48
- **Done When:** `npm list kysely` shows version 0.28.10

#### PLAN-002: Update Playwright E2E Testing
- **Change Type:** modify
- **File:** `package.json`
- **Instruction:**
  1. Run `npm install -D @playwright/test@1.58.0 playwright@1.58.0`
  2. Verify installation with `npm list playwright`
- **Evidence:** Research report lines 134-141, package.json:56,77
- **Done When:** `npm list playwright` shows version 1.58.0 for both packages

#### PLAN-003: Update OpenAI SDK
- **Change Type:** modify
- **File:** `package.json`
- **Instruction:**
  1. Run `npm install openai@6.16.0`
  2. Verify installation with `npm list openai`
- **Evidence:** Research report lines 166-173, package.json:49
- **Done When:** `npm list openai` shows version 6.16.0

#### PLAN-004: Update Zod Schema Validation
- **Change Type:** modify
- **File:** `package.json`
- **Instruction:**
  1. Run `npm install zod@4.3.6`
  2. Verify installation with `npm list zod`
- **Evidence:** Research report lines 175-181, package.json:52
- **Done When:** `npm list zod` shows version 4.3.6

#### PLAN-005: Update TypeScript ESLint Packages
- **Change Type:** modify
- **File:** `package.json`
- **Instruction:**
  1. Run `npm install -D @typescript-eslint/eslint-plugin@8.54.0 @typescript-eslint/parser@8.54.0`
  2. Verify installation with `npm list @typescript-eslint/eslint-plugin`
- **Evidence:** Research report lines 186-193, package.json:64-65
- **Done When:** Both packages show version 8.54.0

#### PLAN-006: Update Prettier
- **Change Type:** modify
- **File:** `package.json`
- **Instruction:**
  1. Run `npm install -D prettier@3.8.1`
  2. Verify installation with `npm list prettier`
- **Evidence:** Research report lines 204-210, package.json:79
- **Done When:** `npm list prettier` shows version 3.8.1

#### PLAN-007: Update XState
- **Change Type:** modify
- **File:** `package.json`
- **Instruction:**
  1. Run `npm install xstate@5.26.0`
  2. Verify installation with `npm list xstate`
- **Evidence:** Research report lines 156-163, package.json:87
- **Done When:** `npm list xstate` shows version 5.26.0

#### PLAN-008: Update Testing Library React
- **Change Type:** modify
- **File:** `package.json`
- **Instruction:**
  1. Run `npm install -D @testing-library/react@16.3.2`
  2. Verify installation with `npm list @testing-library/react`
- **Evidence:** Research report lines 125-132, package.json:59
- **Done When:** `npm list @testing-library/react` shows version 16.3.2

#### PLAN-009: Update better-sqlite3 (Native Module)
- **Change Type:** modify
- **File:** `package.json`
- **Instruction:**
  1. Change line 45 from `"better-sqlite3": "12.5.0"` to `"better-sqlite3": "12.6.2"`
  2. Run `npm install`
  3. The postinstall script will run `electron-rebuild -f -w better-sqlite3`
  4. Verify rebuild succeeds without errors
  5. Run database tests: `npm run test:db`
- **Evidence:** Research report lines 145-154, package.json:45,33
- **Done When:** Postinstall succeeds, `npm run test:db` passes
- **Note:** Native module requiring rebuild; test thoroughly

#### PLAN-010: Verify Phase 1 Updates
- **Change Type:** verify
- **File:** (none)
- **Instruction:**
  1. Run `npm run typecheck` - must succeed
  2. Run `npm run build` - must succeed
  3. Run `npm run lint` - must succeed
  4. Run `npm run test` - must succeed
  5. Manually test app launch: `npm run dev` - app should start without errors
- **Evidence:** Standard verification process
- **Done When:** All commands succeed, app starts successfully
- **Note:** If any failures occur, investigate and fix before proceeding to Phase 2

#### PLAN-011: Commit Phase 1 Changes
- **Change Type:** commit
- **File:** (git)
- **Instruction:**
  1. Run `git add package.json package-lock.json`
  2. Run `git commit -m "chore: update dependencies - Phase 1 (safe minor/patch updates)"`
  3. Record commit hash for rollback point
- **Evidence:** Rollback strategy design
- **Done When:** Commit created successfully

### PHASE 2: Build Tooling (Vite + Plugin)

#### PLAN-012: Research Vite 7 Migration Guide
- **Change Type:** research
- **File:** (none)
- **Instruction:**
  1. Check official Vite migration guide: https://vitejs.dev/guide/migration
  2. Identify breaking changes between Vite 6 and 7
  3. Note any required vite.config.ts changes
  4. Document findings in Phase 2 verification notes
- **Evidence:** Research report lines 40-48 identifies major version gap
- **Done When:** Migration guide reviewed, breaking changes documented
- **Note:** May require config adjustments; investigate before proceeding

#### PLAN-013: Update Vite and React Plugin
- **Change Type:** modify
- **File:** `package.json`, potentially `vite.config.ts`
- **Instruction:**
  1. Run `npm install -D vite@7.3.1 @vitejs/plugin-react@5.1.2`
  2. Check vite.config.ts for compatibility (current: lines 1-23)
  3. If migration guide from PLAN-012 identified config changes, apply them to vite.config.ts
  4. Common changes to check:
     - Plugin configuration syntax
     - Server options format
     - Build options format
  5. Verify installation with `npm list vite`
- **Evidence:** Research report lines 40-48, 104-112, package.json:84,66, vite.config.ts:1-23
- **Done When:** Both packages updated, vite.config.ts compatible
- **Note:** Config changes may be required; test build thoroughly

#### PLAN-014: Verify Phase 2 Updates
- **Change Type:** verify
- **File:** (none)
- **Instruction:**
  1. Run `npm run build:renderer` - must succeed
  2. Run `npm run build` - must succeed (both main and renderer)
  3. Check dist/renderer output files exist and look correct
  4. Run `npm run dev` - app should start, hot reload should work
  5. Test that React components render correctly in dev mode
- **Evidence:** Standard verification process
- **Done When:** Build succeeds, dev mode works, hot reload functional
- **Note:** This verifies the new build tooling is working correctly

#### PLAN-015: Commit Phase 2 Changes
- **Change Type:** commit
- **File:** (git)
- **Instruction:**
  1. If vite.config.ts was modified, run `git add vite.config.ts`
  2. Run `git add package.json package-lock.json`
  3. Run `git commit -m "chore: update build tooling - Phase 2 (Vite 7 + plugin)"`
  4. Record commit hash for rollback point
- **Evidence:** Rollback strategy design
- **Done When:** Commit created successfully

### PHASE 3: Testing Framework (Vitest)

#### PLAN-016: Research Vitest 2→3→4 Migration Guides
- **Change Type:** research
- **File:** (none)
- **Instruction:**
  1. Check Vitest migration guides for v3 and v4:
     - https://vitest.dev/guide/migration.html
  2. Identify breaking changes across two major versions
  3. Note any required vitest.config.ts changes
  4. Note any test syntax changes
  5. Document findings in Phase 3 verification notes
- **Evidence:** Research report lines 50-59 identifies TWO major version gap
- **Done When:** Migration guides reviewed, breaking changes documented
- **Note:** Large version jump; expect config/API changes

#### PLAN-017: Update Vitest and Coverage Plugin
- **Change Type:** modify
- **File:** `package.json`, potentially `vitest.config.ts`
- **Instruction:**
  1. Run `npm install -D vitest@4.0.18 @vitest/coverage-v8@4.0.18`
  2. Check vitest.config.ts for compatibility (current: lines 1-26)
  3. If migration guides from PLAN-016 identified config changes, apply them to vitest.config.ts
  4. Common changes to check (based on Vitest 3/4 changelog):
     - `test.globals` may be renamed or moved
     - `test.environment` options may have changed
     - Coverage configuration may have new options
     - setupFiles syntax may have changed
  5. Verify installation with `npm list vitest`
- **Evidence:** Research report lines 50-59, package.json:85,67, vitest.config.ts:1-26
- **Done When:** Both packages updated, vitest.config.ts compatible
- **Note:** Major config changes likely; test thoroughly

#### PLAN-018: Verify Phase 3 Updates
- **Change Type:** verify
- **File:** (none)
- **Instruction:**
  1. Run `npm run test` - must succeed (all unit tests pass)
  2. Run `npm run test:db` - must succeed (database tests pass)
  3. Run `npm run test:integration` - must succeed
  4. Run `npm run test:coverage` - must succeed and generate coverage report
  5. Check that coverage reports are generated in expected location
  6. If any test syntax errors occur, update test files to Vitest 4 syntax
- **Evidence:** Standard verification process
- **Done When:** All test commands succeed, coverage reports generated
- **Note:** If test failures occur, may need to update test syntax or config

#### PLAN-019: Commit Phase 3 Changes
- **Change Type:** commit
- **File:** (git)
- **Instruction:**
  1. If vitest.config.ts was modified, run `git add vitest.config.ts`
  2. If test files were modified for syntax, run `git add src/**/*.test.ts src/**/*.test.tsx`
  3. Run `git add package.json package-lock.json`
  4. Run `git commit -m "chore: update testing framework - Phase 3 (Vitest 4)"`
  5. Record commit hash for rollback point
- **Evidence:** Rollback strategy design
- **Done When:** Commit created successfully

### PHASE 4: React Ecosystem (Major Upgrade)

#### PLAN-020: Research React 19 Migration Guide
- **Change Type:** research
- **File:** (none)
- **Instruction:**
  1. Check official React 19 migration guide: https://react.dev/blog/2024/04/25/react-19-upgrade-guide
  2. Identify breaking changes from React 18 to 19
  3. Key areas to check:
     - Removed deprecated APIs (e.g., ReactDOM.render - not used in modern setup)
     - Changes to hooks behavior
     - Changes to TypeScript types
     - Changes to component patterns
  4. Review current React usage in codebase:
     - Functional components with hooks (verified in Button.tsx:1-31)
     - react-jsx transform (verified in tsconfig.renderer.json:5)
     - No class components observed
  5. Document findings in Phase 4 verification notes
- **Evidence:** Research report lines 29-38, Button.tsx:1-31, tsconfig.renderer.json:5
- **Done When:** Migration guide reviewed, breaking changes documented
- **Note:** React 19 is generally backward compatible for modern functional components

#### PLAN-021: Update React Core and Types
- **Change Type:** modify
- **File:** `package.json`
- **Instruction:**
  1. Run `npm install react@19.2.4 react-dom@19.2.4`
  2. Run `npm install -D @types/react@19.2.10 @types/react-dom@19.2.3`
  3. Verify installation with `npm list react`
  4. Check for TypeScript errors: `npm run typecheck`
- **Evidence:** Research report lines 29-38, package.json:50-51,62-63
- **Done When:** All packages updated, typecheck passes
- **Note:** Type definitions must match React version

#### PLAN-022: Update React ESLint Plugin
- **Change Type:** modify
- **File:** `package.json`
- **Instruction:**
  1. Run `npm install -D eslint-plugin-react-hooks@7.0.1`
  2. Verify installation with `npm list eslint-plugin-react-hooks`
  3. Run lint to ensure no new errors: `npm run lint`
- **Evidence:** Research report lines 196-202, package.json:75
- **Done When:** Plugin updated to v7 (React 19 compatible), lint passes
- **Note:** This plugin version is aligned with React 19

#### PLAN-023: Verify Phase 4 Updates - TypeScript
- **Change Type:** verify
- **File:** (none)
- **Instruction:**
  1. Run `npm run typecheck` - must succeed
  2. If type errors occur, review and fix:
     - Check React component prop types
     - Check event handler types
     - Check ref types
     - Check common patterns from Button.tsx and other components
  3. Document any code changes needed
- **Evidence:** Standard verification process
- **Done When:** Typecheck passes without errors
- **Note:** React 19 types are stricter; may require minor fixes

#### PLAN-024: Verify Phase 4 Updates - Build and Tests
- **Change Type:** verify
- **File:** (none)
- **Instruction:**
  1. Run `npm run build` - must succeed
  2. Run `npm run lint` - must succeed
  3. Run `npm run test` - must succeed (unit tests)
  4. Run `npm run test:integration` - must succeed (renderer tests)
  5. Check for React warnings in test output
- **Evidence:** Standard verification process
- **Done When:** All builds and tests pass
- **Note:** Tests will catch runtime React 19 issues

#### PLAN-025: Verify Phase 4 Updates - E2E and Manual Testing
- **Change Type:** verify
- **File:** (none)
- **Instruction:**
  1. Run `npm run test:e2e` - must succeed
  2. Run `npm run dev` - app should start without errors
  3. Manually test key user flows:
     - Recipe creation
     - Recipe editing
     - Chat interface
     - Navigation between pages
  4. Check browser console for React warnings or errors
  5. Verify UI renders correctly with React 19
- **Evidence:** Standard verification process
- **Done When:** E2E tests pass, manual testing confirms app works correctly
- **Note:** This is the most critical verification phase

#### PLAN-026: Commit Phase 4 Changes
- **Change Type:** commit
- **File:** (git)
- **Instruction:**
  1. If any component files were modified for React 19 compatibility, run `git add src/renderer/**/*.tsx`
  2. Run `git add package.json package-lock.json`
  3. Run `git commit -m "chore: upgrade React ecosystem - Phase 4 (React 19)"`
  4. Record commit hash for rollback point
- **Evidence:** Rollback strategy design
- **Done When:** Commit created successfully
- **Note:** Major milestone - React 19 upgrade complete

### PHASE 5: Electron Ecosystem (Conditional)

**Note:** This phase depends on User Decision Point #1. Implementor should PAUSE and confirm user decision before proceeding.

#### PLAN-027: (If Option A - Conservative) Update Electron to 39.3.0
- **Change Type:** modify
- **File:** `package.json`
- **Instruction:**
  1. Run `npm install electron@39.3.0`
  2. Verify installation with `npm list electron`
  3. Check that postinstall script runs successfully (electron-rebuild for better-sqlite3)
  4. Test native module: `npm run test:db`
- **Evidence:** Research report lines 61-69, package.json:47
- **Done When:** Electron 39.3.0 installed, native module rebuilt, database tests pass
- **Condition:** User selected Option A (Conservative)

#### PLAN-028: (If Option B - Aggressive) Update Electron to 40.0.0
- **Change Type:** modify
- **File:** `package.json`
- **Instruction:**
  1. Run `npm install electron@40.0.0`
  2. Verify installation with `npm list electron`
  3. Check that postinstall script runs successfully (electron-rebuild for better-sqlite3)
  4. If rebuild fails, investigate:
     - Check Electron 40's Node.js version compatibility with better-sqlite3 12.6.2
     - Check electron-rebuild compatibility
     - May need to update electron-rebuild or better-sqlite3
  5. Test native module: `npm run test:db`
- **Evidence:** Research report lines 61-69, package.json:47
- **Done When:** Electron 40.0.0 installed, native module rebuilt, database tests pass
- **Condition:** User selected Option B (Aggressive)
- **Note:** Higher risk; may require additional troubleshooting

#### PLAN-029: (If Option A or B) Update electron-builder
- **Change Type:** modify
- **File:** `package.json`
- **Instruction:**
  1. If Option A (Electron 39.3.0): Run `npm install -D electron-builder@25.9.7` (or latest 25.x)
  2. If Option B (Electron 40.0.0): Run `npm install -D electron-builder@26.4.0`
  3. Verify installation with `npm list electron-builder`
  4. Test packaging: `npm run package` (may take several minutes)
  5. Verify distributable is created successfully
- **Evidence:** Research report lines 214-220, package.json:71
- **Done When:** electron-builder updated, packaging succeeds
- **Condition:** User selected Option A or B
- **Note:** Version must be compatible with Electron version

#### PLAN-030: (If Option C) Skip Electron Updates
- **Change Type:** skip
- **File:** (none)
- **Instruction:**
  1. Document in Phase 5 notes: "Electron updates deferred per user decision"
  2. No package changes needed
  3. Proceed to Phase 6
- **Evidence:** User Decision Point #1
- **Done When:** Skip acknowledged
- **Condition:** User selected Option C (Defer)

#### PLAN-031: Verify Phase 5 Updates
- **Change Type:** verify
- **File:** (none)
- **Instruction:**
  1. If Phase 5 was skipped (Option C), skip this verification
  2. Run `npm run typecheck` - must succeed
  3. Run `npm run build` - must succeed
  4. Run `npm run test:db` - must succeed (native module test)
  5. Run `npm run test:all` - must succeed
  6. Run `npm run dev` - app should start in Electron window
  7. Test Electron-specific features:
     - Window management
     - IPC communication
     - File system access
     - Database operations
  8. Run `npm run package` - verify distributable builds
- **Evidence:** Standard verification process
- **Done When:** All tests pass, Electron app runs correctly
- **Note:** Critical to test native modules and Electron runtime

#### PLAN-032: Commit Phase 5 Changes
- **Change Type:** commit
- **File:** (git)
- **Instruction:**
  1. If Phase 5 was skipped, skip this commit
  2. Run `git add package.json package-lock.json`
  3. If Option A: Run `git commit -m "chore: update Electron ecosystem - Phase 5 (Electron 39.3)"`
  4. If Option B: Run `git commit -m "chore: update Electron ecosystem - Phase 5 (Electron 40)"`
  5. Record commit hash for rollback point
- **Evidence:** Rollback strategy design
- **Done When:** Commit created successfully (or skipped)

### PHASE 6: Remaining Utilities

#### PLAN-033: Update wait-on Utility
- **Change Type:** modify
- **File:** `package.json`
- **Instruction:**
  1. Run `npm install -D wait-on@9.0.3`
  2. Verify installation with `npm list wait-on`
  3. Test dev script: `npm run dev` - should start without errors
  4. Test E2E script: `npm run test:e2e` - should wait for Vite server correctly
- **Evidence:** Research report lines 223-231, package.json:86
- **Done When:** wait-on updated, dev and E2E scripts work correctly
- **Note:** Low risk utility upgrade

#### PLAN-034: Final Verification - Full Test Suite
- **Change Type:** verify
- **File:** (none)
- **Instruction:**
  1. Run `npm run typecheck` - must succeed
  2. Run `npm run build` - must succeed
  3. Run `npm run lint` - must succeed
  4. Run `npm run format:check` - must succeed
  5. Run `npm run test:all` - must succeed (unit + integration + E2E)
  6. Run `npm run dev` - app should start correctly
  7. Run `npm run package` - should create distributable
  8. Manual smoke test of key features
- **Evidence:** Standard verification process
- **Done When:** All verification steps pass
- **Note:** Final comprehensive check before completion

#### PLAN-035: Commit Phase 6 Changes and Tag Release
- **Change Type:** commit
- **File:** (git)
- **Instruction:**
  1. Run `git add package.json package-lock.json`
  2. Run `git commit -m "chore: update remaining utilities - Phase 6 (complete)"`
  3. Run `git tag -a "library-updates-2026-01-27" -m "All library updates completed"`
  4. Record final commit hash
- **Evidence:** Rollback strategy design
- **Done When:** Commit and tag created successfully
- **Note:** Marks completion of all updates

#### PLAN-036: Generate Update Summary Report
- **Change Type:** document
- **File:** Create new file `thoughts/shared/plans/2026-01-27-Library-Updates-SUMMARY.md`
- **Instruction:**
  1. Create a summary document with:
     - List of all updated packages with before/after versions
     - List of any code changes made (component updates, config changes)
     - List of any breaking changes encountered and how they were resolved
     - Final verification results (all tests passed)
     - Git commits for each phase (rollback points)
     - Any deferred updates (e.g., if Electron was skipped)
     - Recommendations for future updates
  2. Format as markdown for easy reading
- **Evidence:** Plan completion documentation
- **Done When:** Summary file created with all required information
- **Note:** Provides audit trail and knowledge for future updates

## Verification Tasks

### After Each Phase
- Run full verification suite (typecheck, build, lint, tests)
- Verify application still launches and functions
- Commit changes to create rollback point
- Document any issues or code changes required

### Before Proceeding to Next Phase
- Ensure all tasks in current phase are marked "Done"
- Ensure all verification steps passed
- Review any code changes needed for compatibility
- If high-risk phase (3, 4, 5), consider user approval checkpoint

### Final Acceptance Testing
After all phases complete:
1. Full build from clean state (`rm -rf node_modules dist && npm install && npm run build`)
2. Complete test suite (`npm run test:all`)
3. Manual testing of all major features
4. Package creation (`npm run package`)
5. Smoke test of packaged application

## Acceptance Criteria

### Technical Success Criteria
1. ✅ All planned package updates completed (except explicitly deferred ones)
2. ✅ `npm run typecheck` passes without errors
3. ✅ `npm run build` produces valid output in dist/
4. ✅ `npm run lint` passes without errors
5. ✅ `npm run test:all` passes (unit + integration + E2E)
6. ✅ Application launches in development mode (`npm run dev`)
7. ✅ Application can be packaged (`npm run package`)
8. ✅ No new console errors or warnings in browser/Electron

### Functional Success Criteria
1. ✅ All existing features work correctly after updates
2. ✅ Recipe CRUD operations function properly
3. ✅ Chat interface works correctly
4. ✅ Database operations complete successfully
5. ✅ UI renders correctly with updated React
6. ✅ No regression in user-facing functionality

### Documentation Success Criteria
1. ✅ package.json reflects all updates
2. ✅ Git history shows clean commits for each phase
3. ✅ Summary report documents all changes
4. ✅ Rollback points identified for each phase
5. ✅ Any code changes are documented with rationale

## Rollback Plan

### If Phase Fails
1. Identify failing phase (e.g., Phase 3 Vitest update)
2. Revert to previous commit: `git reset --hard <PHASE-2-COMMIT-HASH>`
3. Run `npm install` to restore package-lock.json state
4. Verify rollback: `npm run build && npm run test`
5. Document failure reason in State file
6. Decide: Fix issue, skip phase, or halt updates

### If Multiple Phases Need Rollback
1. Identify last known good commit (e.g., Phase 1 complete)
2. Revert: `git reset --hard <LAST-GOOD-COMMIT-HASH>`
3. Verify rollback
4. Optionally cherry-pick successful updates from later phases

### Emergency Full Rollback
1. Revert to commit before any updates began
2. Verify application works in original state
3. Review what went wrong before attempting again

## Implementor Checklist

### Phase 1: Safe Updates (9 tasks)
- [ ] PLAN-001: Update Kysely to 0.28.10
- [ ] PLAN-002: Update Playwright to 1.58.0
- [ ] PLAN-003: Update OpenAI to 6.16.0
- [ ] PLAN-004: Update Zod to 4.3.6
- [ ] PLAN-005: Update TypeScript ESLint to 8.54.0
- [ ] PLAN-006: Update Prettier to 3.8.1
- [ ] PLAN-007: Update XState to 5.26.0
- [ ] PLAN-008: Update Testing Library React to 16.3.2
- [ ] PLAN-009: Update better-sqlite3 to 12.6.2
- [ ] PLAN-010: Verify Phase 1 updates
- [ ] PLAN-011: Commit Phase 1 changes

### Phase 2: Build Tooling (4 tasks)
- [ ] PLAN-012: Research Vite 7 migration guide
- [ ] PLAN-013: Update Vite to 7.3.1 and plugin to 5.1.2
- [ ] PLAN-014: Verify Phase 2 updates
- [ ] PLAN-015: Commit Phase 2 changes

### Phase 3: Testing Framework (4 tasks)
- [ ] PLAN-016: Research Vitest 2→4 migration guides
- [ ] PLAN-017: Update Vitest to 4.0.18
- [ ] PLAN-018: Verify Phase 3 updates
- [ ] PLAN-019: Commit Phase 3 changes

### Phase 4: React Ecosystem (7 tasks)
- [ ] PLAN-020: Research React 19 migration guide
- [ ] PLAN-021: Update React to 19.2.4 and types
- [ ] PLAN-022: Update eslint-plugin-react-hooks to 7.0.1
- [ ] PLAN-023: Verify TypeScript compilation
- [ ] PLAN-024: Verify build and tests
- [ ] PLAN-025: Verify E2E and manual testing
- [ ] PLAN-026: Commit Phase 4 changes

### Phase 5: Electron Ecosystem (6 tasks, conditional)
- [ ] USER DECISION: Select Option A, B, or C for Electron update
- [ ] PLAN-027: (Option A) Update Electron to 39.3.0
- [ ] PLAN-028: (Option B) Update Electron to 40.0.0
- [ ] PLAN-029: (Option A/B) Update electron-builder
- [ ] PLAN-030: (Option C) Skip Electron updates
- [ ] PLAN-031: Verify Phase 5 updates
- [ ] PLAN-032: Commit Phase 5 changes

### Phase 6: Remaining Utilities (4 tasks)
- [ ] PLAN-033: Update wait-on to 9.0.3
- [ ] PLAN-034: Final verification - full test suite
- [ ] PLAN-035: Commit Phase 6 and tag release
- [ ] PLAN-036: Generate update summary report

### Total Tasks: 34 implementation tasks + 3 user decision points

## Notes for Implementor

### Critical Warnings
1. **Native Modules**: better-sqlite3 requires electron-rebuild. Test thoroughly after updates.
2. **Major Version Jumps**: Vitest (2→4) and React (18→19) have breaking changes. Follow migration guides carefully.
3. **Build Tooling**: Vite 7 may require config changes. Test build process after update.
4. **Electron Updates**: Deferred/optional due to native module risk. User approval required.

### Time Estimates
- Phase 1: 30-45 minutes
- Phase 2: 20-30 minutes (may need config changes)
- Phase 3: 30-60 minutes (migration guide research + config changes)
- Phase 4: 45-90 minutes (migration guide + testing + potential code fixes)
- Phase 5: 30-60 minutes (if pursued)
- Phase 6: 15-20 minutes

**Total Estimated Time: 3-5 hours** (depending on issues encountered)

### Success Indicators
- Each phase ends with passing tests
- No new TypeScript errors introduced
- Application functionality unchanged
- Clean git history with rollback points

### When to Escalate
- If migration guides indicate breaking changes not covered in plan
- If tests fail after update and fix is not obvious
- If native module rebuild fails
- If application behavior changes unexpectedly

## Approval Gate Summary

**IMPLEMENTOR: STOP HERE AND PRESENT PLAN TO USER**

This plan requires user approval before implementation due to:
1. Multiple major version updates with breaking change potential
2. Strategic decision needed on Electron update approach
3. Estimated 3-5 hours of implementation time
4. Risk of temporary application instability during updates

**Required User Decisions:**
1. **Electron Strategy**: Option A (39.3 - safe), Option B (40.0 - aggressive), or Option C (defer)?
2. **Implementation Approach**: Continuous with approval gates, or batch with checkpoints?
3. **React 19 Timing**: Include in this plan, or defer to separate effort?

**User Questions to Answer:**
- Are you comfortable with React 19 update now, or prefer to defer?
- What is your risk tolerance for Electron 40 update?
- Do you want to review/approve after each high-risk phase, or trust the process?

**After receiving user approval and decisions, proceed with Phase 1.**
