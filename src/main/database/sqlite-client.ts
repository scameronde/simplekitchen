/**
 * @module database/sqlite-client
 * Production SQLite client wrapper using better-sqlite3 native module.
 *
 * This module provides a production implementation of IDatabaseClient using
 * the better-sqlite3 native module for optimal performance.
 */

import Database from 'better-sqlite3';
import type { IDatabaseClient, Statement } from './client.js';

/**
 * Production SQLite database client using better-sqlite3.
 * This class wraps the better-sqlite3 native module to implement the IDatabaseClient interface.
 */
export class SqliteDatabaseClient implements IDatabaseClient {
  private db: Database.Database;

  /**
   * Create a new SQLite database client.
   * @param dbPath - Path to the SQLite database file (or ":memory:" for in-memory database)
   */
  constructor(dbPath: string) {
    this.db = new Database(dbPath);
  }

  /**
   * Prepare a SQL statement for execution.
   * @param sql - SQL statement to prepare
   * @returns Prepared statement object
   */
  prepare(sql: string): Statement {
    return this.db.prepare(sql) as Statement;
  }

  /**
   * Execute a SQLite pragma command.
   * @param pragma - Pragma command to execute (e.g., "journal_mode = WAL")
   * @param simplify - Whether to simplify the result (better-sqlite3 option)
   * @returns Pragma result value
   */
  pragma(pragma: string, simplify?: boolean): unknown {
    if (simplify !== undefined) {
      return this.db.pragma(pragma, { simple: simplify });
    }
    return this.db.pragma(pragma);
  }

  /**
   * Close the database connection.
   */
  close(): void {
    this.db.close();
  }
}
