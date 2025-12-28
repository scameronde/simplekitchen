# Native Module Testing Strategy Implementation Plan

## Inputs

- **Research report used:** `thoughts/shared/research/2025-12-28-Electron-Native-Module-Testing-Strategy.md`
- **User request summary:** Implement abstraction layer to eliminate MODULE_VERSION conflicts between Electron (v140) and Node.js (v127) when running tests
- **Problem:** better-sqlite3 native module requires different builds for Electron vs. Node.js, causing test failures when running `npm test` without manual rebuild
- **Solution:** Industry-standard abstraction layer + pure JavaScript mock for tests (sql.js)

## Verified Current State

### Fact 1: Single Point of Native Module Import

- **Fact:** better-sqlite3 is imported only in `src/main/database/init.ts:1`
- **Evidence:** `src/main/database/init.ts:1`
- **Excerpt:**
  ```typescript
  import Database from 'better-sqlite3';
  ```

### Fact 2: DAL Layer Imports from init.ts

- **Fact:** Only 2 DAL files import from init.ts: `recipes.ts` and `dietary-profile.ts`
- **Evidence:** `src/main/database/dal/recipes.ts:1`, `src/main/database/dal/dietary-profile.ts:1`
- **Excerpt (recipes.ts:1):**
  ```typescript
  import { db } from '../init.js';
  ```
- **Excerpt (dietary-profile.ts:1):**
  ```typescript
  import { db } from '../init.js';
  ```

### Fact 3: Tests Use In-Memory Database

- **Fact:** init.ts already detects test environment and uses `:memory:` database
- **Evidence:** `src/main/database/init.ts:9-14`
- **Excerpt:**
  ```typescript
  if (process.env.VITEST || process.env.NODE_ENV === 'test') {
    // Use in-memory database for tests
    dbPath = ':memory:';
  } else {
    dbPath = path.join(app.getPath('userData'), 'recipes.db');
  }
  ```

### Fact 4: Kysely Wraps Raw SQLite Connection

- **Fact:** init.ts exports both Kysely instance (`db`) and raw better-sqlite3 instance (`rawDb`)
- **Evidence:** `src/main/database/init.ts:33-40`
- **Excerpt:**

  ```typescript
  export const db = new Kysely<DatabaseSchema>({
    dialect: new SqliteDialect({
      database: sqlite,
    }),
  });

  export const rawDb = sqlite;
  ```

### Fact 5: Tests Import DAL Functions, Not init.ts

- **Fact:** Test files import DAL functions (createRecipe, getRecipeById, etc.) and never import init.ts directly
- **Evidence:** `src/main/database/dal/recipes.test.ts:1-11`
- **Excerpt:**
  ```typescript
  import {
    createRecipe,
    getRecipeById,
    getRecipes,
    updateRecipe,
    deleteRecipe,
    getRecipeCount,
  } from './recipes';
  import { runMigrations, closeDatabase } from '../index';
  ```

### Fact 6: Current Dependencies

- **Fact:** better-sqlite3 v12.5.0 is production dependency, no sql.js present
- **Evidence:** `package.json:40`
- **Excerpt:**
  ```json
  "dependencies": {
    "better-sqlite3": "12.5.0",
    "electron": "^39.2.7",
    "kysely": "^0.27.6",
  ```

### Fact 7: Vitest Configuration

- **Fact:** Vitest uses jsdom environment and includes all `*.test.ts` and `*.test.tsx` files
- **Evidence:** `vitest.config.ts:5-9`
- **Excerpt:**
  ```typescript
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: './vitest.setup.ts',
  ```

## Goals / Non-Goals

### Goals

1. Eliminate MODULE_VERSION conflicts between Electron and Node.js test runner
2. Enable `npm test` to run without manual rebuild steps
3. Maintain 100% test compatibility (all existing tests pass without modification)
4. Use industry-standard abstraction pattern (factory + dependency injection)
5. Preserve production behavior (better-sqlite3 in Electron, sql.js in tests)
6. Ensure zero changes required to DAL layer, IPC handlers, or test files

### Non-Goals

1. NOT changing test logic or assertions
2. NOT modifying DAL layer (recipes.ts, dietary-profile.ts)
3. NOT changing IPC handlers or renderer code
4. NOT implementing custom SQL parser (use sql.js for full SQLite compatibility)
5. NOT running tests in Electron's Node.js (ELECTRON_RUN_AS_NODE approach rejected)

## Design Overview

### Architecture Pattern: Factory + Adapter

```
Production Flow:
  better-sqlite3 (native) → SqliteDatabaseClient → init.ts → Kysely → DAL

Test Flow:
  sql.js (pure JS) → SqlJsAdapter → init.ts → Kysely → DAL
```

### Key Design Decisions

1. **Factory Pattern**: `createDatabaseClient()` returns different implementations based on environment
2. **Adapter Pattern**: `SqlJsAdapter` wraps sql.js to match better-sqlite3 API surface
3. **Minimal Interface**: Only expose methods actually used by init.ts (prepare, pragma, close)
4. **Type Safety**: Use TypeScript interfaces to ensure API compatibility
5. **Zero DAL Changes**: Kysely continues to work with both implementations transparently

### Data Flow

1. **init.ts** calls `createDatabaseClient()` instead of `new Database()`
2. **Factory** checks `process.env.VITEST` or `process.env.NODE_ENV === 'test'`
3. **Production**: Returns `SqliteDatabaseClient` wrapping better-sqlite3
4. **Test**: Returns `SqlJsAdapter` wrapping sql.js
5. **Kysely** receives compatible database instance via SqliteDialect
6. **DAL** continues using Kysely with zero changes

## Implementation Instructions (For Implementor)

### PLAN-001: Install sql.js Dependency

- **Action ID:** PLAN-001
- **Change Type:** modify
- **File(s):** `package.json`
- **Instruction:**
  1. Add `sql.js` version `^1.12.0` to `devDependencies` section
  2. Run `npm install` to install the package
- **Interfaces / Pseudocode:**
  ```json
  "devDependencies": {
    "sql.js": "^1.12.0",
    // ... existing devDependencies
  }
  ```
- **Evidence:** `package.json:46-76` (devDependencies section exists)
- **Done When:**
  - `sql.js` appears in `package.json` devDependencies
  - `node_modules/sql.js` directory exists
  - `npm install` completes without errors

### PLAN-002: Create Database Client Interface

- **Action ID:** PLAN-002
- **Change Type:** create
- **File(s):** `src/main/database/client.ts`
- **Instruction:**
  1. Create new file `src/main/database/client.ts`
  2. Define `IDatabaseClient` interface with minimal API surface:
     - `prepare(sql: string): Statement` - prepare SQL statement
     - `pragma(pragma: string, simplify?: boolean): unknown` - execute pragma
     - `close(): void` - close connection
  3. Define `Statement` interface matching better-sqlite3:
     - `run(...params: unknown[]): RunResult`
     - `get(...params: unknown[]): unknown`
     - `all(...params: unknown[]): unknown[]`
  4. Define `RunResult` interface:
     - `changes: number`
     - `lastInsertRowid: number | bigint`
  5. Export factory function `createDatabaseClient(dbPath: string): IDatabaseClient`
     - Check `process.env.VITEST || process.env.NODE_ENV === 'test'`
     - If test: return `new SqlJsAdapter(dbPath)`
     - If production: return `new SqliteDatabaseClient(dbPath)`
- **Interfaces / Pseudocode:**

  ```typescript
  export interface RunResult {
    changes: number;
    lastInsertRowid: number | bigint;
  }

  export interface Statement {
    run(...params: unknown[]): RunResult;
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
  }

  export interface IDatabaseClient {
    prepare(sql: string): Statement;
    pragma(pragma: string, simplify?: boolean): unknown;
    close(): void;
  }

  export function createDatabaseClient(dbPath: string): IDatabaseClient {
    if (process.env.VITEST || process.env.NODE_ENV === 'test') {
      return new SqlJsAdapter(dbPath);
    }
    return new SqliteDatabaseClient(dbPath);
  }
  ```

- **Evidence:** Research recommendation (lines 246-266), no existing client.ts file
- **Done When:**
  - File `src/main/database/client.ts` exists
  - TypeScript compiles without errors
  - Exports: `IDatabaseClient`, `Statement`, `RunResult`, `createDatabaseClient`

### PLAN-003: Create Production SQLite Client Wrapper

- **Action ID:** PLAN-003
- **Change Type:** create
- **File(s):** `src/main/database/sqlite-client.ts`
- **Instruction:**
  1. Create new file `src/main/database/sqlite-client.ts`
  2. Import `Database` from `better-sqlite3`
  3. Import `IDatabaseClient` from `./client.js`
  4. Implement `SqliteDatabaseClient` class:
     - Constructor accepts `dbPath: string`
     - Create `new Database(dbPath)` and store as private field
     - Implement `prepare(sql)`: delegate to `this.db.prepare(sql)`
     - Implement `pragma(pragma, simplify)`: delegate to `this.db.pragma(pragma, simplify)`
     - Implement `close()`: delegate to `this.db.close()`
  5. Export `SqliteDatabaseClient` class
- **Interfaces / Pseudocode:**

  ```typescript
  import Database from 'better-sqlite3';
  import type { IDatabaseClient } from './client.js';

  export class SqliteDatabaseClient implements IDatabaseClient {
    private db: Database.Database;

    constructor(dbPath: string) {
      this.db = new Database(dbPath);
    }

    prepare(sql: string) {
      return this.db.prepare(sql);
    }

    pragma(pragma: string, simplify?: boolean) {
      return this.db.pragma(pragma, simplify);
    }

    close() {
      this.db.close();
    }
  }
  ```

- **Evidence:** `src/main/database/init.ts:1` (better-sqlite3 import pattern)
- **Done When:**
  - File `src/main/database/sqlite-client.ts` exists
  - TypeScript compiles without errors
  - Class implements `IDatabaseClient` interface

### PLAN-004: Create sql.js Adapter for Tests

- **Action ID:** PLAN-004
- **Change Type:** create
- **File(s):** `src/main/database/sql-js-adapter.ts`
- **Instruction:**
  1. Create new file `src/main/database/sql-js-adapter.ts`
  2. Import `initSqlJs` from `sql.js`
  3. Import `IDatabaseClient`, `Statement`, `RunResult` from `./client.js`
  4. Import `readFileSync` from `fs` (for loading existing db file if needed)
  5. Implement `SqlJsAdapter` class:
     - Constructor accepts `dbPath: string`
     - Synchronously initialize sql.js: `const SQL = await initSqlJs()`
     - If `dbPath === ':memory:'`: create new database `new SQL.Database()`
     - If `dbPath` is file path and exists: load file `new SQL.Database(readFileSync(dbPath))`
     - Store database instance as private field
  6. Implement `prepare(sql)` method:
     - Return object implementing `Statement` interface
     - `run(...params)`: execute `this.db.run(sql, params)`, return `{ changes, lastInsertRowid }`
     - `get(...params)`: execute `this.db.exec(sql, params)`, return first row or undefined
     - `all(...params)`: execute `this.db.exec(sql, params)`, return all rows
  7. Implement `pragma(pragma, simplify)` method:
     - Parse pragma string (e.g., "journal_mode = WAL")
     - Execute as SQL: `PRAGMA ${pragma}`
     - Return result (sql.js supports most pragmas, some are no-ops)
  8. Implement `close()` method:
     - Call `this.db.close()`
  9. Export `SqlJsAdapter` class
- **Interfaces / Pseudocode:**

  ```typescript
  import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
  import { readFileSync, existsSync } from 'fs';
  import type { IDatabaseClient, Statement, RunResult } from './client.js';

  export class SqlJsAdapter implements IDatabaseClient {
    private db: SqlJsDatabase;
    private SQL: any;

    constructor(dbPath: string) {
      // Initialize sql.js synchronously (use await at top-level or in async context)
      const SQL = await initSqlJs();
      this.SQL = SQL;

      if (dbPath === ':memory:') {
        this.db = new SQL.Database();
      } else if (existsSync(dbPath)) {
        const buffer = readFileSync(dbPath);
        this.db = new SQL.Database(buffer);
      } else {
        this.db = new SQL.Database();
      }
    }

    prepare(sql: string): Statement {
      const db = this.db;
      return {
        run(...params: unknown[]): RunResult {
          db.run(sql, params);
          const changes = db.getRowsModified();
          // sql.js doesn't expose lastInsertRowid directly, query it
          const result = db.exec('SELECT last_insert_rowid() as id');
          const lastInsertRowid = result[0]?.values[0]?.[0] ?? 0;
          return { changes, lastInsertRowid };
        },
        get(...params: unknown[]): unknown {
          const result = db.exec(sql, params);
          if (!result[0]) return undefined;
          const columns = result[0].columns;
          const values = result[0].values[0];
          if (!values) return undefined;
          // Convert to object
          const row: any = {};
          columns.forEach((col, i) => {
            row[col] = values[i];
          });
          return row;
        },
        all(...params: unknown[]): unknown[] {
          const result = db.exec(sql, params);
          if (!result[0]) return [];
          const columns = result[0].columns;
          const values = result[0].values;
          return values.map(row => {
            const obj: any = {};
            columns.forEach((col, i) => {
              obj[col] = row[i];
            });
            return obj;
          });
        },
      };
    }

    pragma(pragma: string, simplify?: boolean): unknown {
      const result = this.db.exec(`PRAGMA ${pragma}`);
      if (!result[0]) return undefined;
      if (simplify && result[0].values.length === 1 && result[0].values[0].length === 1) {
        return result[0].values[0][0];
      }
      return result;
    }

    close(): void {
      this.db.close();
    }
  }
  ```

- **Evidence:** Research recommendation (lines 306-322), sql.js documentation
- **Done When:**
  - File `src/main/database/sql-js-adapter.ts` exists
  - TypeScript compiles without errors
  - Class implements `IDatabaseClient` interface
  - Handles `:memory:` database path correctly

### PLAN-005: Refactor init.ts to Use Factory

- **Action ID:** PLAN-005
- **Change Type:** modify
- **File(s):** `src/main/database/init.ts`
- **Instruction:**
  1. Remove direct import: `import Database from 'better-sqlite3';` (line 1)
  2. Add new import: `import { createDatabaseClient } from './client.js';`
  3. Keep existing dbPath logic (lines 8-14) unchanged
  4. Replace `const sqlite = new Database(dbPath);` (line 17) with:
     ```typescript
     const sqlite = createDatabaseClient(dbPath);
     ```
  5. Keep all pragma calls unchanged (lines 20-30)
  6. Keep Kysely initialization unchanged (lines 33-37)
  7. Keep `rawDb` export unchanged (line 40)
  8. Keep `closeDatabase()` function unchanged (lines 43-46)
  9. Keep console.log unchanged (line 49)
- **Interfaces / Pseudocode:**

  ```typescript
  // OLD (line 1):
  import Database from 'better-sqlite3';

  // NEW (line 1):
  import { createDatabaseClient } from './client.js';

  // OLD (line 17):
  const sqlite = new Database(dbPath);

  // NEW (line 17):
  const sqlite = createDatabaseClient(dbPath);

  // Everything else remains unchanged
  ```

- **Evidence:** `src/main/database/init.ts:1,17` (current implementation)
- **Done When:**
  - `init.ts` no longer imports `better-sqlite3` directly
  - `init.ts` imports and uses `createDatabaseClient`
  - TypeScript compiles without errors
  - All pragma calls still work (factory returns compatible interface)

### PLAN-006: Handle Async Initialization in sql.js Adapter

- **Action ID:** PLAN-006
- **Change Type:** modify
- **File(s):** `src/main/database/sql-js-adapter.ts`
- **Instruction:**
  1. sql.js `initSqlJs()` is async, but init.ts expects synchronous construction
  2. Solution: Use top-level await or lazy initialization
  3. Recommended approach: Lazy initialization pattern
     - Store promise in static field
     - Constructor waits for initialization before creating database
     - First call initializes, subsequent calls reuse
  4. Update `SqlJsAdapter` constructor:

     ```typescript
     private static sqlPromise: Promise<any> | null = null;
     private static getSql() {
       if (!this.sqlPromise) {
         this.sqlPromise = initSqlJs();
       }
       return this.sqlPromise;
     }

     constructor(dbPath: string) {
       // This needs to be async, but init.ts expects sync
       // Solution: Make createDatabaseClient async or use sync wrapper
     }
     ```

  5. **CRITICAL DECISION POINT**: init.ts is imported at module load time (synchronous)
  6. **Resolution**: Use synchronous wrapper with lazy loading
     - On first test run, initialize sql.js
     - Cache initialized instance
     - Use `deasync` library or restructure to async init
  7. **ALTERNATIVE (SIMPLER)**: Make init.ts async-aware
     - Export async `initDatabase()` function
     - Tests call `await initDatabase()` before running
     - This requires test file changes (violates Non-Goal #1)
  8. **RECOMMENDED**: Use `@types/better-sqlite3` compatible sync API
     - sql.js supports synchronous loading via wasm file
     - Use `initSqlJs({ locateFile: file => ... })` with bundled wasm
     - This keeps init.ts synchronous

- **Interfaces / Pseudocode:**

  ```typescript
  import initSqlJs from 'sql.js';
  import { readFileSync } from 'fs';
  import path from 'path';

  let SQL: any = null;

  function getSqlSync() {
    if (!SQL) {
      // Load wasm file synchronously (requires bundling wasm)
      const wasmBinary = readFileSync(
        path.join(__dirname, '../../../node_modules/sql.js/dist/sql-wasm.wasm')
      );
      SQL = initSqlJs({ wasmBinary }); // Returns promise
      // This is still async - need different approach
    }
    return SQL;
  }
  ```

- **Evidence:** sql.js documentation (async initialization requirement)
- **Done When:**
  - SqlJsAdapter can be constructed synchronously
  - No changes required to test files
  - TypeScript compiles without errors

### PLAN-007: Add Electron Rebuild to postinstall

- **Action ID:** PLAN-007
- **Change Type:** modify
- **File(s):** `package.json`
- **Instruction:**
  1. Add `postinstall` script to automatically rebuild better-sqlite3 for Electron after `npm install`
  2. This ensures production builds always have correct MODULE_VERSION 140
  3. Add to `scripts` section:
     ```json
     "postinstall": "electron-rebuild -f -w better-sqlite3"
     ```
  4. Verify `electron-rebuild` is already in devDependencies (it should be from electron-builder)
  5. If not present, add `electron-rebuild` to devDependencies
- **Interfaces / Pseudocode:**
  ```json
  "scripts": {
    "postinstall": "electron-rebuild -f -w better-sqlite3",
    // ... existing scripts
  }
  ```
- **Evidence:** Research recommendation (line 298-304), `package.json:7-30` (scripts section)
- **Done When:**
  - `postinstall` script exists in package.json
  - Running `npm install` automatically rebuilds better-sqlite3 for Electron
  - No manual rebuild required for `npm run dev`

## Verification Tasks (Assumptions to Validate)

### Assumption 1: sql.js Supports All Required Pragmas

- **Assumption:** sql.js supports `journal_mode`, `synchronous`, `cache_size`, `temp_store` pragmas used in init.ts
- **Verification Step:**
  1. Read sql.js documentation on pragma support
  2. Test pragmas in sql.js REPL or minimal test
  3. Verify that unsupported pragmas are silently ignored (acceptable for tests)
- **Pass Condition:**
  - All pragmas either work or are safely ignored
  - No errors thrown during pragma execution
- **Implementor Action:** If pragmas fail, wrap pragma calls in try-catch in SqlJsAdapter

### Assumption 2: sql.js API Matches better-sqlite3 Sufficiently

- **Assumption:** sql.js `exec()` method can be adapted to match better-sqlite3 `prepare().run/get/all()` pattern
- **Verification Step:**
  1. Review sql.js API documentation
  2. Verify `exec()` returns `{ columns: string[], values: any[][] }` format
  3. Confirm parameter binding works with `exec(sql, [params])`
- **Pass Condition:**
  - sql.js can execute parameterized queries
  - Results can be transformed to match better-sqlite3 format
- **Implementor Action:** If API mismatch found, adjust SqlJsAdapter implementation

### Assumption 3: Kysely Works with sql.js Adapter

- **Assumption:** Kysely's SqliteDialect accepts any object with `prepare()` method
- **Verification Step:**
  1. Read Kysely SqliteDialect source code or documentation
  2. Verify it only calls `database.prepare(sql)` and statement methods
  3. Confirm no direct better-sqlite3 type checks
- **Pass Condition:**
  - Kysely works with duck-typed database interface
  - No runtime type errors when using SqlJsAdapter
- **Implementor Action:** If Kysely requires specific types, add type assertions or wrapper

### Assumption 4: Synchronous Initialization is Possible

- **Assumption:** sql.js can be initialized synchronously or init.ts can be made async without breaking imports
- **Verification Step:**
  1. Test sql.js initialization with bundled wasm file
  2. Verify if top-level await works in current Node.js version (22.x supports it)
  3. Check if DAL imports would break with async init
- **Pass Condition:**
  - Either sql.js initializes synchronously, OR
  - init.ts can use top-level await without breaking DAL imports
- **Implementor Action:**
  - If sync not possible: Use top-level await in init.ts
  - If top-level await breaks imports: Restructure to lazy initialization pattern

## Acceptance Criteria

1. **Test Execution**: Running `npm test` completes successfully without manual rebuild steps
2. **Test Pass Rate**: All existing tests pass (100% compatibility)
3. **Production Behavior**: Running `npm run dev` uses better-sqlite3 (MODULE_VERSION 140)
4. **Test Behavior**: Running `npm test` uses sql.js (pure JavaScript, no native module)
5. **Zero DAL Changes**: No modifications to `recipes.ts`, `dietary-profile.ts`, or any test files
6. **Type Safety**: TypeScript compilation succeeds with no errors
7. **Performance**: Test execution time does not increase by more than 20% (sql.js overhead acceptable)
8. **Developer Experience**: No manual rebuild commands required in development workflow
9. **CI/CD Ready**: Tests run in CI without Electron-specific setup

## Implementor Checklist

### Phase 1: Setup (Dependencies & Interfaces)

- [ ] PLAN-001: Install sql.js dependency
- [ ] PLAN-002: Create database client interface

### Phase 2: Implementation (Adapters)

- [ ] PLAN-003: Create production SQLite client wrapper
- [ ] PLAN-004: Create sql.js adapter for tests
- [ ] PLAN-006: Handle async initialization in sql.js adapter

### Phase 3: Integration (Refactor init.ts)

- [ ] PLAN-005: Refactor init.ts to use factory

### Phase 4: Automation (Build Scripts)

- [ ] PLAN-007: Add Electron rebuild to postinstall

### Phase 5: Verification (Test & Validate)

- [ ] Run `npm test` - verify all tests pass
- [ ] Run `npm run dev` - verify app starts and database works
- [ ] Verify no better-sqlite3 import in init.ts
- [ ] Verify sql.js only used in test environment
- [ ] Run `npm run typecheck` - verify no TypeScript errors

## Notes for Implementor

### Critical Path Dependencies

1. PLAN-001 must complete before PLAN-004 (sql.js needed for adapter)
2. PLAN-002 must complete before PLAN-003 and PLAN-004 (interface needed for implementations)
3. PLAN-003, PLAN-004, PLAN-006 must complete before PLAN-005 (factory needs implementations)
4. PLAN-005 must complete before final testing (init.ts must use factory)

### Async Initialization Challenge

**PLAN-006 is the most complex task.** sql.js requires async initialization, but init.ts is imported synchronously. Three solutions:

1. **Top-level await** (RECOMMENDED if Node.js 22.x supports it in ESM):

   ```typescript
   // src/main/database/sql-js-adapter.ts
   const SQL = await initSqlJs();
   export class SqlJsAdapter { ... }
   ```

2. **Lazy initialization** (if top-level await not available):

   ```typescript
   let sqlInstance: any = null;
   async function getSql() {
     if (!sqlInstance) sqlInstance = await initSqlJs();
     return sqlInstance;
   }
   ```

3. **Synchronous wasm loading** (complex, requires bundling):
   ```typescript
   const wasmBinary = readFileSync('sql-wasm.wasm');
   const SQL = await initSqlJs({ wasmBinary });
   ```

**Implementor Decision**: Try option 1 first (top-level await). If that fails, use option 2 with lazy initialization and make `createDatabaseClient` async.

### Testing Strategy

After implementation, verify:

1. Run `npm test` from clean state (no prior rebuilds)
2. Run `npm run dev` and create a recipe manually
3. Check `node_modules/better-sqlite3/build/Release/.forge-meta` contains "140"
4. Verify test output shows sql.js being used (add debug log if needed)

### Rollback Plan

If implementation fails:

1. Revert init.ts to original state (restore `import Database from 'better-sqlite3'`)
2. Remove new files: `client.ts`, `sqlite-client.ts`, `sql-js-adapter.ts`
3. Remove sql.js from package.json
4. Run `npm install` to restore original state
