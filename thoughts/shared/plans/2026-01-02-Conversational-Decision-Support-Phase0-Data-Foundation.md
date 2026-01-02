---
date: 2026-01-02
planner: assistant
epic-id: 'EPIC-002'
phase: Phase 0
phase-name: Data Foundation & Schema
master-plan: 'thoughts/shared/plans/2026-01-02-Conversational-Decision-Support-MASTER.md'
research-source: 'thoughts/shared/research/2026-01-02-Conversational-Decision-Support.md'
status: ready-for-implementation
type: phase-plan
---

# Phase 0: Data Foundation & Schema - Implementation Plan

## Inputs

- **MASTER Plan**: `thoughts/shared/plans/2026-01-02-Conversational-Decision-Support-MASTER.md`
- **Research Report**: `thoughts/shared/research/2026-01-02-Conversational-Decision-Support.md`
- **User Request**: Proceed with Phase 0 implementation for Conversational Decision Support

## Phase Goals

**Primary Goal**: Establish the data foundation for conversational AI decision support—database schema, TypeScript types, and dependencies—before building features.

**Success Criteria**: All types compile, migration runs successfully, dependencies installed, no new feature code written (pure foundation).

## Verified Current State

### Database Migration System

- **Fact**: Migration system uses version tracking with sequential integer versions
- **Evidence**: `src/main/database/migrations.ts:20-30`
- **Excerpt**:

```typescript
function isMigrationApplied(version: number): boolean {
  const result = rawDb.prepare('SELECT version FROM migrations WHERE version = ?').get(version);
  return result !== undefined;
}
```

- **Fact**: Latest migration is version 3 (reset dietary profile)
- **Evidence**: `src/main/database/migrations.ts:151-158`
- **Excerpt**:

```typescript
export function runMigrations(): void {
  createMigrationsTable();
  migration001_initialSchema();
  migration002_addCreatedAtIndex();
  migration003_resetDietaryProfile();
  // Future migrations will be added here
  console.log('All migrations applied');
}
```

- **Fact**: Migrations use `rawDb.prepare()` for SQL execution
- **Evidence**: `src/main/database/migrations.ts:40-61`
- **Excerpt**: Shows CREATE TABLE pattern with constraints

### Type System Patterns

- **Fact**: Database types use `Table` suffix with snake_case fields (matching SQL)
- **Evidence**: `src/shared/types/database.ts:27-42`
- **Excerpt**:

```typescript
export interface RecipeTable {
  id: string; // UUID primary key
  title: string;
  cooking_time_minutes: number; // snake_case
  // ...
}
```

- **Fact**: Application types use PascalCase with camelCase fields (for TypeScript/React)
- **Evidence**: `src/shared/types/recipe.ts:12-28`
- **Excerpt**:

```typescript
export interface Recipe {
  id: string;
  title: string;
  cookingTimeMinutes: number; // camelCase
  // ...
}
```

- **Fact**: JSON fields stored as strings in database, parsed to arrays/objects in application types
- **Evidence**: `src/shared/types/database.ts:35-36` and `src/shared/types/recipe.ts:20-21`
- **Excerpt**:

```typescript
// Database (Table type)
dietary_tags: string; // JSON array of DietaryTag[]

// Application type
dietaryTags: DietaryTag[]; // Parsed array
```

- **Fact**: Database interface aggregates all table types
- **Evidence**: `src/shared/types/database.ts:72-76`
- **Excerpt**:

```typescript
export interface Database {
  recipes: RecipeTable;
  ingredients: IngredientTable;
  dietary_profile: DietaryProfileTable;
}
```

### Current Dependencies

- **Fact**: OpenAI SDK already installed (v6.15.0)
- **Evidence**: `package.json:47`
- **Excerpt**: `"openai": "^6.15.0"`

- **Fact**: Zod already installed (v4.2.1) for schema validation
- **Evidence**: `package.json:50`
- **Excerpt**: `"zod": "^4.2.1"`

- **Fact**: React 18.3.1 installed (modern JSX transform, hooks)
- **Evidence**: `package.json:48-49`
- **Excerpt**: `"react": "^18.3.1", "react-dom": "^18.3.1"`

### Testing Patterns

- **Fact**: Migration tests verify constraints and basic CRUD operations
- **Evidence**: `src/main/database/migrations.test.ts:13-55`
- **Excerpt**:

```typescript
describe('Database Schema Constraints', () => {
  it('should reject negative cooking time', async () => {
    await expect(createRecipe({ ...validRecipe, cookingTimeMinutes: -1 })).rejects.toThrow();
  });
  // ...
});
```

## Goals / Non-Goals

### Goals

- ✅ Add `cooking_sessions` table to database schema via migration
- ✅ Create TypeScript types for conversation entities
- ✅ Install UI and state management dependencies
- ✅ Update Database interface to include new table
- ✅ Verify all types compile without errors
- ✅ Verify migration runs successfully

### Non-Goals

- ❌ No UI components created (Phase 1)
- ❌ No IPC handlers created (Phase 1)
- ❌ No AI prompting logic (Phase 2)
- ❌ No conversation state management implementation (Phase 1)
- ❌ No session manager implementation (Phase 1)

## Design Overview

### Database Schema Addition

Add a single table `cooking_sessions` to track completed decision sessions:

- **Primary Key**: UUID string (matches existing pattern)
- **Foreign Key**: `recipe_id` references `recipes.id` with CASCADE delete
- **JSON Fields**: `user_context` stores energy/mood/time as JSON string
- **Timestamps**: ISO 8601 strings (matches existing pattern)

**Data Flow**: Session completed → Store in `cooking_sessions` → Future history analysis (EPIC-003)

### TypeScript Type Structure

Create new file `src/shared/types/conversation.ts` with four layers:

1. **Table Types** (snake_case): `CookingSessionTable` for database schema
2. **Application Types** (camelCase): `CookingSession`, `ConversationSession`, `ConversationMessage`, `UserContext`
3. **State Types**: Conversation state enum, session metadata
4. **IPC Types**: Will be used in Phase 1 for renderer ↔ main communication

### Dependencies

Install two new packages:

1. **@chatscope/chat-ui-kit-react** (v2.0.3): Production-ready chat UI components
2. **@chatscope/chat-ui-kit-styles** (v1.4.0): Required CSS for chat UI
3. **xstate** (v5.18.2): Optional state machine library (decision deferred to Phase 1)

## Implementation Instructions (For Implementor)

### PLAN-001: Add Database Migration for cooking_sessions Table

**Action ID**: PLAN-001  
**Change Type**: modify  
**File(s)**: `src/main/database/migrations.ts`

**Instruction**:

1. Add a new function `migration004_addCookingSessions()` after `migration003_resetDietaryProfile()` (after line 148)
2. Follow the existing migration pattern: check if applied, log start, execute SQL, record migration, log completion
3. Create the `cooking_sessions` table with the following schema:

```sql
CREATE TABLE cooking_sessions (
  id TEXT PRIMARY KEY,
  recipe_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  user_context TEXT NOT NULL DEFAULT '{}',
  conversation_summary TEXT,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
)
```

4. Create an index on `timestamp` for chronological queries:

```sql
CREATE INDEX idx_cooking_sessions_timestamp ON cooking_sessions(timestamp DESC)
```

5. Add the migration call to `runMigrations()` function after `migration003_resetDietaryProfile()` (line 155)

**Evidence**:

- Migration pattern: `src/main/database/migrations.ts:20-30` (version checking)
- CREATE TABLE pattern: `src/main/database/migrations.ts:40-61` (recipes table)
- Index pattern: `src/main/database/migrations.ts:99-102`
- Foreign key pattern: `src/main/database/migrations.ts:76` (ingredients table)

**Done When**:

- Function `migration004_addCookingSessions()` exists and follows pattern
- `runMigrations()` calls the new migration
- Migration version is 4
- Migration name is 'add_cooking_sessions'

---

### PLAN-002: Create Conversation TypeScript Types

**Action ID**: PLAN-002  
**Change Type**: create  
**File(s)**: `src/shared/types/conversation.ts`

**Instruction**:

Create a new file `src/shared/types/conversation.ts` with the following structure:

1. **Imports**: Import necessary types from `./database.js` and `./recipe.js`

2. **Table Type** (matches database schema):

```typescript
export interface CookingSessionTable {
  id: string; // UUID primary key
  recipe_id: string; // Foreign key to recipes.id
  timestamp: string; // ISO 8601 timestamp
  user_context: string; // JSON object (energy, time, mood, canShop)
  conversation_summary: string | null; // Optional summary
}
```

3. **Application Types** (camelCase, parsed JSON):

```typescript
export interface CookingSession {
  id: string;
  recipeId: string;
  timestamp: Date; // Parsed from ISO string
  userContext: UserContext;
  conversationSummary: string | null;
}

export interface UserContext {
  energyLevel?: 'low' | 'medium' | 'high';
  availableTime?: number; // minutes (30-60 range)
  mood?: string; // free-text description
  canShop?: boolean; // whether user can go shopping
}

export type ConversationState = 'gathering' | 'suggesting' | 'refining' | 'confirmed' | 'abandoned';

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestedRecipes?: string[]; // Recipe IDs (for assistant messages)
}

export interface ConversationSession {
  sessionId: string; // UUID
  messages: ConversationMessage[]; // Last 5-10 messages (working memory)
  userContext: UserContext;
  suggestedRecipes: string[]; // All recipe IDs shown in this session
  rejectedRecipes: Array<{
    recipeId: string;
    reason?: string;
  }>;
  state: ConversationState;
  turnCount: number; // Track conversation length
  createdAt: Date;
  lastActivity: Date;
}
```

4. **Add JSDoc comments** to each interface explaining purpose and usage phase (following existing pattern in `recipe.ts:31-34`)

**Evidence**:

- Type structure pattern: `src/shared/types/recipe.ts:12-55` (Table vs Application types)
- JSON field pattern: `src/shared/types/database.ts:35-36` (string in DB, parsed in app)
- Import pattern: `src/shared/types/recipe.ts:7-8` (type-only imports with .js extension)
- Research recommendation: `thoughts/shared/research/2026-01-02-Conversational-Decision-Support.md:174-194`

**Done When**:

- File `src/shared/types/conversation.ts` exists
- All five interfaces defined: `CookingSessionTable`, `CookingSession`, `UserContext`, `ConversationMessage`, `ConversationSession`
- Type exports follow existing pattern (named exports)
- Imports use `.js` extension for local files

---

### PLAN-003: Update Database Interface

**Action ID**: PLAN-003  
**Change Type**: modify  
**File(s)**: `src/shared/types/database.ts`

**Instruction**:

1. Add import statement for `CookingSessionTable` at the top of the file (after line 6, before type definitions):

```typescript
import type { CookingSessionTable } from './conversation.js';
```

2. Update the `Database` interface (lines 72-76) to include the new table:

```typescript
export interface Database {
  recipes: RecipeTable;
  ingredients: IngredientTable;
  dietary_profile: DietaryProfileTable;
  cooking_sessions: CookingSessionTable;
}
```

**Evidence**:

- Existing Database interface: `src/shared/types/database.ts:72-76`
- Import pattern: `src/shared/types/recipe.ts:7-8`

**Done When**:

- Import statement added for `CookingSessionTable`
- `Database` interface includes `cooking_sessions: CookingSessionTable`
- TypeScript compiler does not error on this file

---

### PLAN-004: Install npm Dependencies

**Action ID**: PLAN-004  
**Change Type**: modify  
**File(s)**: `package.json`, `package-lock.json`, `node_modules/`

**Instruction**:

Run the following npm install commands in sequence:

```bash
npm install @chatscope/chat-ui-kit-react@^2.0.3 @chatscope/chat-ui-kit-styles@^1.4.0
npm install --save-dev xstate@^5.18.2
```

**Why these versions**:

- `@chatscope/chat-ui-kit-react@2.0.3`: Latest stable, React 18 compatible
- `@chatscope/chat-ui-kit-styles@1.4.0`: Required peer dependency for chat-ui-kit-react
- `xstate@5.18.2`: Latest v5 (actor model, TypeScript-first) - installed as devDependency since decision to use it is deferred to Phase 1

**Evidence**:

- Research recommendation: `thoughts/shared/research/2026-01-02-Conversational-Decision-Support.md:341-416` (chat UI library evaluation)
- Research recommendation: `thoughts/shared/research/2026-01-02-Conversational-Decision-Support.md:197-209` (XState for state machine)
- Existing dependency pattern: `package.json:42-50`

**Done When**:

- `package.json` includes all three dependencies
- `npm install` completes without errors
- No peer dependency warnings
- Libraries are importable in TypeScript (test with a simple import check)

---

### PLAN-005: Add Migration Test

**Action ID**: PLAN-005  
**Change Type**: modify  
**File(s)**: `src/main/database/migrations.test.ts`

**Instruction**:

1. Add a new test suite at the end of the file (after line 55):

```typescript
describe('Cooking Sessions Table', () => {
  it('should create cooking_sessions table with correct schema', () => {
    // Query the table to verify it exists
    const result = rawDb
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='cooking_sessions'")
      .get();
    expect(result).toBeDefined();
    expect(result.name).toBe('cooking_sessions');
  });

  it('should have index on timestamp', () => {
    const result = rawDb
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_cooking_sessions_timestamp'"
      )
      .get();
    expect(result).toBeDefined();
  });

  it('should enforce foreign key constraint on recipe_id', async () => {
    // Attempt to insert session with non-existent recipe_id
    // This should fail due to foreign key constraint
    const stmt = rawDb.prepare(`
      INSERT INTO cooking_sessions (id, recipe_id, timestamp, user_context)
      VALUES (?, ?, ?, ?)
    `);

    expect(() => {
      stmt.run('test-session-id', 'non-existent-recipe-id', new Date().toISOString(), '{}');
    }).toThrow();
  });
});
```

2. Add import for `rawDb` at the top of the file if not already present:

```typescript
import { rawDb } from './init';
```

**Evidence**:

- Test pattern: `src/main/database/migrations.test.ts:13-55`
- Migration verification approach: Query `sqlite_master` table for metadata
- Foreign key test pattern: Similar to constraint tests in existing suite

**Done When**:

- Test suite "Cooking Sessions Table" exists with 3 tests
- Tests pass when running `npm run test:db`
- No TypeScript errors in test file

---

### PLAN-006: Verify Type Compilation

**Action ID**: PLAN-006  
**Change Type**: verify  
**File(s)**: N/A (verification only)

**Instruction**:

Run the following commands to verify all changes compile correctly:

```bash
npm run typecheck
```

If there are errors:

1. Read the error output carefully
2. Fix import paths (ensure `.js` extensions are present)
3. Fix type mismatches (snake_case vs camelCase)
4. Verify circular dependency issues (shouldn't occur, but check)

**Evidence**:

- Existing typecheck script: `package.json:16`
- TypeScript configuration: `tsconfig.main.json`, `tsconfig.renderer.json`

**Done When**:

- `npm run typecheck` completes with 0 errors
- Both main and renderer processes type-check successfully
- No warnings related to new conversation types

---

## Verification Tasks

**No assumptions requiring verification**. All implementation details are verified against existing code patterns.

## Acceptance Criteria

The Phase 0 implementation is complete when ALL of the following are true:

### Database Criteria

- [ ] Migration 004 runs successfully (`npm run dev` shows "Running migration 004" log)
- [ ] `cooking_sessions` table exists in database (verified via test)
- [ ] `cooking_sessions` table has correct schema (id, recipe_id, timestamp, user_context, conversation_summary)
- [ ] Foreign key constraint on `recipe_id` is enforced (verified via test)
- [ ] Index `idx_cooking_sessions_timestamp` exists (verified via test)

### Type System Criteria

- [ ] File `src/shared/types/conversation.ts` exists
- [ ] All 5 required interfaces are defined: `CookingSessionTable`, `CookingSession`, `UserContext`, `ConversationMessage`, `ConversationSession`
- [ ] `ConversationState` type enum is defined
- [ ] `Database` interface includes `cooking_sessions: CookingSessionTable`
- [ ] Type imports use `.js` extension (follows existing pattern)
- [ ] TypeScript compilation succeeds: `npm run typecheck` passes with 0 errors

### Dependency Criteria

- [ ] `@chatscope/chat-ui-kit-react` installed (verify in `package.json` and `node_modules/`)
- [ ] `@chatscope/chat-ui-kit-styles` installed (verify in `package.json` and `node_modules/`)
- [ ] `xstate` installed as devDependency (verify in `package.json` devDependencies)
- [ ] `npm install` completes without errors or peer dependency warnings

### Testing Criteria

- [ ] Migration test suite "Cooking Sessions Table" exists with 3 tests
- [ ] All migration tests pass: `npm run test:db` succeeds
- [ ] No new test failures introduced (all existing tests still pass)

### Code Quality Criteria

- [ ] All code follows existing naming conventions (PascalCase types, camelCase fields)
- [ ] JSDoc comments added to new types (following existing pattern)
- [ ] No linting errors: `npm run lint` passes
- [ ] No formatting errors: `npm run format:check` passes

## Implementor Checklist

Execute in this exact order:

- [ ] **PLAN-001**: Add database migration for `cooking_sessions` table
  - [ ] Create `migration004_addCookingSessions()` function
  - [ ] Add migration call to `runMigrations()`
  - [ ] Run migration manually to verify (`npm run dev` and check logs)

- [ ] **PLAN-002**: Create `src/shared/types/conversation.ts`
  - [ ] Define `CookingSessionTable` interface
  - [ ] Define `CookingSession`, `UserContext`, `ConversationMessage`, `ConversationSession` interfaces
  - [ ] Define `ConversationState` type
  - [ ] Add JSDoc comments

- [ ] **PLAN-003**: Update `src/shared/types/database.ts`
  - [ ] Add import for `CookingSessionTable`
  - [ ] Update `Database` interface

- [ ] **PLAN-004**: Install npm dependencies
  - [ ] Run `npm install @chatscope/chat-ui-kit-react@^2.0.3 @chatscope/chat-ui-kit-styles@^1.4.0`
  - [ ] Run `npm install --save-dev xstate@^5.18.2`
  - [ ] Verify no peer dependency warnings

- [ ] **PLAN-005**: Add migration test
  - [ ] Add "Cooking Sessions Table" test suite
  - [ ] Add 3 tests: schema verification, index verification, foreign key constraint
  - [ ] Run tests to verify: `npm run test:db`

- [ ] **PLAN-006**: Verify type compilation
  - [ ] Run `npm run typecheck` (must pass with 0 errors)
  - [ ] Run `npm run lint` (must pass)
  - [ ] Run `npm run format:check` (must pass)

## Next Steps

After Phase 0 completion and verification:

1. **Update STATE file**: Mark all tasks as completed
2. **Notify Planner**: Phase 0 complete, ready for Phase 1
3. **Planner Action**: Create detailed Phase 1 plan (Conversation Infrastructure)

**Estimated Duration**: 2-3 days

---

## Appendix: Key Evidence References

### Codebase References (Verified)

- Migration pattern: `src/main/database/migrations.ts:20-30`
- Latest migration: `src/main/database/migrations.ts:151-158`
- Database types pattern: `src/shared/types/database.ts:27-76`
- Application types pattern: `src/shared/types/recipe.ts:12-55`
- Migration test pattern: `src/main/database/migrations.test.ts:13-55`
- Dependencies: `package.json:42-50`

### Research References

- Conversation state management: Research lines 162-228
- Chat UI library evaluation: Research lines 341-416
- XState recommendation: Research lines 197-209

### MASTER Plan References

- Phase 0 goals: MASTER lines 63-80
- Dependencies requirement: MASTER lines 68-72
- Duration estimate: MASTER line 80

---

**End of Phase 0 Implementation Plan**

**Status**: Ready for implementation  
**Next Document**: `2026-01-02-Conversational-Decision-Support-Phase0-Data-Foundation-STATE.md`
