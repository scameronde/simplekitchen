/**
 * @module database/client
 * Database client abstraction layer for testing and production.
 *
 * This module provides a unified interface for database operations that can be
 * backed by either better-sqlite3 (production) or sql.js (testing).
 */

/**
 * Result of a database write operation (INSERT, UPDATE, DELETE).
 */
export interface RunResult {
  /** Number of rows affected by the operation */
  changes: number;
  /** Row ID of the last inserted row (for INSERT operations) */
  lastInsertRowid: number | bigint;
}

/**
 * Prepared SQL statement interface matching better-sqlite3 API.
 */
export interface Statement {
  /**
   * Indicates whether this statement returns data (SELECT) or not (INSERT/UPDATE/DELETE).
   */
  readonly reader: boolean;

  /**
   * Execute the statement and return metadata about changes.
   * @param params - Parameters to bind to the SQL statement
   * @returns Metadata about the operation (rows changed, last insert ID)
   */
  run(...params: unknown[]): RunResult;

  /**
   * Execute the statement and return the first result row.
   * @param params - Parameters to bind to the SQL statement
   * @returns First row or undefined if no results
   */
  get(...params: unknown[]): unknown;

  /**
   * Execute the statement and return all result rows.
   * @param params - Parameters to bind to the SQL statement
   * @returns Array of all matching rows
   */
  all(...params: unknown[]): unknown[];

  /**
   * Execute the statement and return an iterator over result rows.
   * @param params - Parameters to bind to the SQL statement
   * @returns Iterator over all matching rows
   */
  iterate(...params: unknown[]): IterableIterator<unknown>;
}

/**
 * Database client interface providing minimal API surface for SQLite operations.
 * This interface is implemented by both production (better-sqlite3) and test (sql.js) clients.
 */
export interface IDatabaseClient {
  /**
   * Prepare a SQL statement for execution.
   * @param sql - SQL statement to prepare
   * @returns Prepared statement object
   */
  prepare(sql: string): Statement;

  /**
   * Execute a SQLite pragma command.
   * @param pragma - Pragma command to execute (e.g., "journal_mode = WAL")
   * @param simplify - Whether to simplify the result (better-sqlite3 option)
   * @returns Pragma result value
   */
  pragma(pragma: string, simplify?: boolean): unknown;

  /**
   * Close the database connection.
   */
  close(): void;
}

// Import both implementations - tree-shaking will remove unused code in production
import { SqlJsAdapter } from './sqljs-adapter.js';
import { SqliteDatabaseClient } from './sqlite-client.js';

/**
 * Factory function to create appropriate database client based on environment.
 *
 * - In test environment (VITEST or NODE_ENV=test): Returns SqlJsAdapter (pure JavaScript)
 * - In production: Returns SqliteDatabaseClient (better-sqlite3 native module)
 *
 * @param dbPath - Path to database file (or ":memory:" for in-memory database)
 * @returns Database client instance
 */
export function createDatabaseClient(dbPath: string): IDatabaseClient {
  if (process.env.VITEST || process.env.NODE_ENV === 'test') {
    return new SqlJsAdapter(dbPath);
  }
  return new SqliteDatabaseClient(dbPath);
}
