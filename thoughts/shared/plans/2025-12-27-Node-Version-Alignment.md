# Node.js Version Alignment Implementation Plan

## Inputs

- **User Request**: Fix Node.js version mismatch between system (v25.2.1) and Electron runtime (v22.21.1)
- **Research**: Web search confirmed Electron 39.2.7 uses Node.js 22.21.1
- **Strategy**: Option 1 (downgrade system Node.js to v22) + Option 3 (lock package.json engines)

## Verified Current State

### System Environment

- **Fact**: System Node.js version is v25.2.1
- **Evidence**: `bash: node --version` output
- **Excerpt**: `v25.2.1`

### Electron Configuration

- **Fact**: Project uses Electron 39.2.7
- **Evidence**: `package.json:41`
- **Excerpt**: `"electron": "^39.2.7"`

### Electron Internal Node.js Version

- **Fact**: Electron 39.2.7 bundles Node.js 22.21.1
- **Evidence**: Official Electron releases page (https://releases.electronjs.org/release/v39.2.7)
- **Excerpt**: Chromium 142.0.7444.235, Node.js 22.21.1, V8 14.2.231.21

### Current Engine Requirements

- **Fact**: package.json requires Node.js >=20.0.0
- **Evidence**: `package.json:35-37`
- **Excerpt**:

```json
"engines": {
  "node": ">=20.0.0",
  "npm": ">=10.0.0"
}
```

### Native Module Dependency

- **Fact**: Project uses better-sqlite3, a native Node.js module
- **Evidence**: `package.json:40`
- **Excerpt**: `"better-sqlite3": "12.5.0"`

### Documentation

- **Fact**: README.md states "Node.js 20+" requirement
- **Evidence**: `README.md:28`
- **Excerpt**: `- Node.js 20+ and npm 10+`

### Version Manager Files

- **Fact**: No .nvmrc or .node-version file exists
- **Evidence**: `find` command returned no results
- **Excerpt**: (no files found)

## Problem Statement

**Version Mismatch**: System Node.js (v25.2.1) is 3 major versions ahead of Electron's internal Node.js (v22.21.1).

**Impact**:

1. **Native Module Risk**: better-sqlite3 compiled against Node v25 may fail in Electron (Node v22)
2. **API Divergence**: Tests run on v25 may pass but fail in Electron runtime due to API differences
3. **Behavioral Inconsistency**: Main process code behavior differs between test and production environments

## Goals / Non-Goals

### Goals

- Align system Node.js version to match Electron's internal Node.js (v22.x)
- Lock package.json engines to prevent future version drift
- Create version manager configuration for team consistency
- Update documentation to reflect correct Node.js requirement
- Ensure native modules are rebuilt for correct Node.js version

### Non-Goals

- Upgrading Electron to a newer version
- Changing the build tooling or test framework
- Modifying CI/CD pipelines (none exist currently)

## Design Overview

### Two-Phase Approach

**Phase 1: Manual Prerequisites** (User-executed)

- Install Node.js version manager (nvm or fnm)
- Install Node.js 22.x (specifically 22.21.1 or latest 22.x)
- Switch to Node.js 22.x
- Clean and reinstall node_modules to rebuild native modules

**Phase 2: Configuration Updates** (Automated)

- Create .nvmrc file to lock version for nvm users
- Update package.json engines to require Node.js 22.x range
- Update README.md to reflect Node.js 22+ requirement
- Verify all changes work correctly

## Manual Prerequisites (User Must Execute)

Before running the automated implementation tasks, the user must:

### Step 1: Install Node Version Manager

**Option A: nvm (recommended for Linux/macOS)**

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Reload shell configuration
source ~/.bashrc  # or ~/.zshrc
```

**Option B: fnm (faster alternative)**

```bash
# Install fnm
curl -fsSL https://fnm.vercel.app/install | bash

# Reload shell configuration
source ~/.bashrc  # or ~/.zshrc
```

### Step 2: Install Node.js 22.x

**Using nvm:**

```bash
# Install Node.js 22 (latest 22.x version)
nvm install 22

# Use Node.js 22
nvm use 22

# Verify version
node --version  # Should show v22.x.x
```

**Using fnm:**

```bash
# Install Node.js 22
fnm install 22

# Use Node.js 22
fnm use 22

# Verify version
node --version  # Should show v22.x.x
```

### Step 3: Clean Reinstall Dependencies

```bash
# Navigate to project directory
cd /home/eichens/workspaces/experiment-ai/opencode/simplekitchen

# Remove existing node_modules and lock file
rm -rf node_modules package-lock.json

# Reinstall dependencies (this rebuilds native modules for Node 22)
npm install

# Verify better-sqlite3 works
npm test -- src/main/database/init.test.ts
```

**Pass Condition**:

- `node --version` shows v22.x.x
- `npm install` completes without errors
- Database tests pass

## Implementation Instructions (For Implementor)

### PLAN-001: Create .nvmrc File

- **Change Type**: create
- **File**: `.nvmrc`
- **Instruction**: Create a new file `.nvmrc` in the project root with the content `22` (just the major version number, no quotes, no newline at end)
- **Rationale**: This file tells nvm which Node.js version to use automatically when entering the project directory
- **Evidence**: No .nvmrc file currently exists (verified by find command)
- **Done When**: File `.nvmrc` exists with content `22`

### PLAN-002: Update package.json Engines

- **Change Type**: modify
- **File**: `package.json`
- **Instruction**:
  1. Locate the `engines` section (lines 35-37)
  2. Change `"node": ">=20.0.0"` to `"node": ">=22.0.0 <23.0.0"`
  3. Keep `"npm": ">=10.0.0"` unchanged
- **Rationale**: Locks Node.js to version 22.x range, preventing accidental use of incompatible versions (like v25)
- **Evidence**: `package.json:35-37` currently allows Node.js 20+
- **Pseudocode**:

```json
"engines": {
  "node": ">=22.0.0 <23.0.0",
  "npm": ">=10.0.0"
}
```

- **Done When**: package.json engines.node is `">=22.0.0 <23.0.0"`

### PLAN-003: Update README.md Prerequisites

- **Change Type**: modify
- **File**: `README.md`
- **Instruction**:
  1. Locate line 28: `- Node.js 20+ and npm 10+`
  2. Change to: `- Node.js 22+ and npm 10+`
  3. Add a new line after line 29 (after `- Git`):

     ```

     **Note**: This project requires Node.js 22.x to match Electron 39's internal Node.js version. Use `nvm` or `fnm` to manage Node.js versions.
     ```
- **Rationale**: Documentation should reflect the actual requirement and explain why
- **Evidence**: `README.md:28` currently states "Node.js 20+"
- **Done When**:
  - README.md line 28 shows "Node.js 22+"
  - Explanatory note about version requirement is present

### PLAN-004: Verify Node.js Version

- **Change Type**: verify
- **Instruction**: Run `node --version` and confirm output is v22.x.x
- **Rationale**: Ensure manual prerequisites were completed successfully
- **Done When**: `node --version` outputs a version starting with `v22.`

### PLAN-005: Verify Native Module Rebuild

- **Change Type**: verify
- **Instruction**: Run database tests to confirm better-sqlite3 works correctly
- **Command**: `npm test -- src/main/database/init.test.ts`
- **Rationale**: Confirms native module was rebuilt for Node.js 22
- **Done When**: All database initialization tests pass

### PLAN-006: Run Full Test Suite

- **Change Type**: verify
- **Instruction**: Run complete test suite to ensure no regressions
- **Command**: `npm test`
- **Rationale**: Comprehensive verification that all code works with Node.js 22
- **Done When**: All tests pass

## Verification Tasks

### Verify Node.js Version Alignment

- **Check**: `node --version` matches Electron's Node.js version (22.x)
- **Pass Condition**: Output is v22.x.x (where x can be any number)

### Verify Native Module Compatibility

- **Check**: better-sqlite3 can create and query databases
- **Pass Condition**: Database tests in `src/main/database/` all pass

### Verify Version Manager Configuration

- **Check**: .nvmrc file exists and contains correct version
- **Pass Condition**: `cat .nvmrc` outputs `22`

### Verify Engine Constraints

- **Check**: package.json engines prevent wrong Node.js versions
- **Pass Condition**: `npm install` with Node.js 25 would fail (can test after completion)

## Acceptance Criteria

1. ✅ System Node.js version is 22.x.x (verified by `node --version`)
2. ✅ .nvmrc file exists with content `22`
3. ✅ package.json engines.node is `">=22.0.0 <23.0.0"`
4. ✅ README.md states "Node.js 22+" requirement with explanation
5. ✅ All unit tests pass (`npm test`)
6. ✅ Database tests pass (confirming better-sqlite3 works)
7. ✅ Application runs in development mode (`npm run dev`)
8. ✅ No build errors or warnings related to Node.js version

## Implementor Checklist

- [ ] **MANUAL**: User installs Node.js version manager (nvm/fnm)
- [ ] **MANUAL**: User installs Node.js 22.x
- [ ] **MANUAL**: User cleans and reinstalls node_modules
- [ ] PLAN-001: Create .nvmrc file
- [ ] PLAN-002: Update package.json engines
- [ ] PLAN-003: Update README.md prerequisites
- [ ] PLAN-004: Verify Node.js version
- [ ] PLAN-005: Verify native module rebuild
- [ ] PLAN-006: Run full test suite

## Risk Assessment

### Low Risk

- Creating .nvmrc file (non-breaking, optional for users without nvm)
- Updating documentation (informational only)

### Medium Risk

- Updating package.json engines (could prevent installation on wrong Node.js versions - this is desired behavior)
- Node.js version downgrade (requires clean reinstall, but reversible)

### Mitigation

- Manual prerequisites are clearly documented with verification steps
- Each step has explicit pass conditions
- Full test suite run ensures no regressions
- Changes are version-controlled and can be reverted if needed

## Notes

- This plan assumes the user has shell access and can install software
- The .nvmrc file only works with nvm; fnm users can use `fnm use` manually
- After completion, team members should run `nvm use` or `fnm use` when entering the project directory
- Future CI/CD setup should use Node.js 22.x in build pipelines
