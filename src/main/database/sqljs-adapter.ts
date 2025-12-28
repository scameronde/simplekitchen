/**
 * @module database/sqljs-adapter
 * Test SQLite client wrapper using sql.js pure JavaScript implementation.
 *
 * This module provides a test implementation of IDatabaseClient using sql.js,
 * which runs entirely in JavaScript without native dependencies.
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - sql.js doesn't have type definitions, but the API is well-documented
import initSqlJs, { Database } from 'sql.js';
import { readFileSync, existsSync } from 'fs';
import type { IDatabaseClient, Statement, RunResult } from './client.js';

// Initialize sql.js at module load time using top-level await (Node.js 22+ ESM)
// This resolves the async initialization problem - SQL is ready before any code runs
const SQL = await initSqlJs();

/**
 * Wrapper class that adapts sql.js Statement API to match better-sqlite3 Statement interface.
 */
class SqlJsStatementAdapter implements Statement {
  readonly reader: boolean;

  constructor(
    private db: Database,
    private sql: string
  ) {
    // Prepare statement once to detect if it's a reader (SELECT) or writer (INSERT/UPDATE/DELETE)
    const stmt = db.prepare(sql);
    this.reader = stmt.getColumnNames().length > 0;
    stmt.free();
  }

  /**
   * Execute the statement and return metadata about changes.
   * @param params - Parameters to bind to the SQL statement
   * @returns Metadata about the operation (rows changed, last insert ID)
   */
  run(...params: unknown[]): RunResult {
    // Execute the statement with parameters using prepare/bind/step pattern
    const stmt = this.db.prepare(this.sql);
    try {
      // sql.js bind() expects parameters as an array (0-based indexing for ?)
      // Kysely passes parameters as a nested array [[param1, param2]], so we need to flatten
      if (params.length > 0) {
        // If params is a single-element array containing another array, flatten it
        const bindParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        stmt.bind(bindParams);
      }
      stmt.step(); // Execute the statement

      // Query SQLite for changes and last insert rowid
      const changesResult = this.db.exec('SELECT changes()');
      const changes =
        changesResult.length > 0 && changesResult[0]?.values.length > 0
          ? (changesResult[0].values[0]?.[0] as number)
          : 0;

      const rowidResult = this.db.exec('SELECT last_insert_rowid()');
      const lastInsertRowid =
        rowidResult.length > 0 && rowidResult[0]?.values.length > 0
          ? (rowidResult[0].values[0]?.[0] as number)
          : 0;

      return { changes, lastInsertRowid };
    } finally {
      stmt.free();
    }
  }

  /**
   * Execute the statement and return the first result row.
   * @param params - Parameters to bind to the SQL statement
   * @returns First row as object or undefined if no results
   */
  get(...params: unknown[]): unknown {
    const stmt = this.db.prepare(this.sql);
    try {
      if (params.length > 0) {
        // Flatten Kysely's nested array format
        const bindParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        stmt.bind(bindParams);
      }
      if (stmt.step()) {
        return stmt.getAsObject();
      }
      return undefined;
    } finally {
      stmt.free();
    }
  }

  /**
   * Execute the statement and return all result rows.
   * @param params - Parameters to bind to the SQL statement
   * @returns Array of all matching rows as objects
   */
  all(...params: unknown[]): unknown[] {
    const stmt = this.db.prepare(this.sql);
    try {
      if (params.length > 0) {
        // Flatten Kysely's nested array format
        const bindParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        stmt.bind(bindParams);
      }
      const results: unknown[] = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      return results;
    } finally {
      stmt.free();
    }
  }

  /**
   * Execute the statement and return an iterator over result rows.
   * @param params - Parameters to bind to the SQL statement
   * @returns Iterator that yields rows one at a time
   */
  *iterate(...params: unknown[]): IterableIterator<unknown> {
    const stmt = this.db.prepare(this.sql);
    try {
      if (params.length > 0) {
        // Flatten Kysely's nested array format
        const bindParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        stmt.bind(bindParams);
      }
      while (stmt.step()) {
        yield stmt.getAsObject();
      }
    } finally {
      stmt.free();
    }
  }
}

/**
 * Test SQLite database client using sql.js.
 * This class wraps the sql.js pure JavaScript implementation to implement the IDatabaseClient interface.
 */
export class SqlJsAdapter implements IDatabaseClient {
  private db: Database;

  /**
   * Create a new sql.js database client.
   * @param dbPath - Path to the SQLite database file (or ":memory:" for in-memory database)
   */
  constructor(dbPath: string) {
    // SQL is already initialized via top-level await, so constructor is synchronous
    if (dbPath === ':memory:') {
      // Create in-memory database
      this.db = new SQL.Database();
    } else if (existsSync(dbPath)) {
      // Load existing database from file
      const buffer = readFileSync(dbPath);
      this.db = new SQL.Database(buffer);
    } else {
      // Create new empty database (will be saved to file if needed)
      this.db = new SQL.Database();
    }
  }

  /**
   * Prepare a SQL statement for execution.
   * @param sql - SQL statement to prepare
   * @returns Prepared statement object
   */
  prepare(sql: string): Statement {
    return new SqlJsStatementAdapter(this.db, sql);
  }

  /**
   * Execute a SQLite pragma command.
   * @param pragma - Pragma command to execute (e.g., "journal_mode = WAL")
   * @param simplify - Whether to simplify the result (ignored for sql.js compatibility)
   * @returns Pragma result value
   */
  pragma(pragma: string, simplify?: boolean): unknown {
    // Execute pragma as SQL statement
    const result = this.db.exec(`PRAGMA ${pragma}`);

    // If no results, return undefined
    if (result.length === 0) {
      return undefined;
    }

    // Extract first result value
    const firstResult = result[0];
    if (!firstResult || firstResult.values.length === 0) {
      return undefined;
    }

    // If simplify is requested or only one column, return the value directly
    if (simplify || firstResult.columns.length === 1) {
      return firstResult.values[0]?.[0];
    }

    // Otherwise return the first row as an object
    const row: Record<string, unknown> = {};
    firstResult.columns.forEach((col: string, idx: number) => {
      row[col] = firstResult.values[0]?.[idx];
    });
    return row;
  }

  /**
   * Close the database connection.
   */
  close(): void {
    this.db.close();
  }
}
