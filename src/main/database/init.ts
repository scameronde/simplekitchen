import path from 'path';
import { app } from 'electron';
import { Kysely, SqliteDialect } from 'kysely';
import type Database from 'better-sqlite3';
import type { Database as DatabaseSchema } from '../../shared/types/database.js';
import { createDatabaseClient } from './client.js';

// Database file location: app user data directory (or in-memory/temp for tests)
let dbPath: string;
if (process.env.VITEST || process.env.NODE_ENV === 'test') {
  // Use in-memory database for unit tests
  dbPath = ':memory:';
} else if (process.env.E2E_TEST === 'true') {
  // Use separate database file for E2E tests to avoid polluting development data
  // This file will be cleaned between test runs
  dbPath = path.join(app.getPath('userData'), 'recipes-e2e-test.db');
  console.log('E2E Test mode: Using isolated database for testing');
} else {
  // Production/development database
  dbPath = path.join(app.getPath('userData'), 'recipes.db');
}

// Initialize better-sqlite3 connection with durability settings
const sqlite = createDatabaseClient(dbPath);

// CRITICAL: Configure crash-safe durability
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('synchronous = FULL');
sqlite.pragma('foreign_keys = ON');

// macOS specific (uncomment if running on macOS for maximum durability)
// if (process.platform === 'darwin') {
//   sqlite.pragma('fullfsync = ON');
// }

// Optional performance optimizations (safe with WAL)
sqlite.pragma('cache_size = -64000'); // 64MB cache
sqlite.pragma('temp_store = MEMORY');

// Create Kysely instance with type-safe schema
export const db = new Kysely<DatabaseSchema>({
  dialect: new SqliteDialect({
    database: sqlite as Database.Database,
  }),
});

// Expose raw connection for direct SQLite operations if needed
export const rawDb = sqlite;

// Close database connection gracefully
export function closeDatabase(): void {
  db.destroy();
  sqlite.close();
}

// Log database location for debugging
console.log(`Database initialized at: ${dbPath}`);

// Expose database path for test cleanup
export function getDatabasePath(): string {
  return dbPath;
}

// Clear all data from database (E2E tests only)
export async function clearAllData(): Promise<void> {
  await db.deleteFrom('ingredients').execute();
  await db.deleteFrom('recipes').execute();
  await db.deleteFrom('cooking_sessions').execute();
}
