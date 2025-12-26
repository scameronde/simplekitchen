import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import { fileURLToPath } from 'url';
import { Kysely, SqliteDialect } from 'kysely';
import type { Database as DatabaseSchema } from '../../shared/types/database';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database file location: app user data directory
const dbPath = path.join(app.getPath('userData'), 'recipes.db');

// Initialize better-sqlite3 connection with durability settings
const sqlite = new Database(dbPath);

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
    database: sqlite,
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
