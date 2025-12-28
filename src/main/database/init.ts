import path from 'path';
import { app } from 'electron';
import { Kysely, SqliteDialect } from 'kysely';
import type { Database as DatabaseSchema } from '../../shared/types/database.js';
import { createDatabaseClient } from './client.js';

// Database file location: app user data directory (or temp for tests)
let dbPath: string;
if (process.env.VITEST || process.env.NODE_ENV === 'test') {
  // Use in-memory database for tests
  dbPath = ':memory:';
} else {
  dbPath = path.join(app.getPath('userData'), 'recipes.db');
}

// Initialize better-sqlite3 connection with durability settings
const sqlite = createDatabaseClient(dbPath);

// CRITICAL: Configure crash-safe durability
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('synchronous = FULL');

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
    database: sqlite as any,
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
