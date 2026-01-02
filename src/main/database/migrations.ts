import { rawDb } from './init.js';

// Migration version tracking table
function createMigrationsTable(): void {
  rawDb
    .prepare(
      `
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version INTEGER UNIQUE NOT NULL,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `
    )
    .run();
}

// Check if migration has been applied
function isMigrationApplied(version: number): boolean {
  const result = rawDb.prepare('SELECT version FROM migrations WHERE version = ?').get(version);
  return result !== undefined;
}

// Record migration as applied
function recordMigration(version: number, name: string): void {
  rawDb
    .prepare('INSERT INTO migrations (version, name, applied_at) VALUES (?, ?, ?)')
    .run(version, name, new Date().toISOString());
}

// Migration 1: Initial schema
function migration001_initialSchema(): void {
  const version = 1;
  if (isMigrationApplied(version)) return;

  console.log('Running migration 001: Initial schema');

  // Create recipes table
  rawDb
    .prepare(
      `
    CREATE TABLE recipes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      cooking_time_minutes INTEGER NOT NULL CHECK(cooking_time_minutes >= 0 AND cooking_time_minutes <= 60),
      prep_time_minutes INTEGER,
      total_time_minutes INTEGER NOT NULL,
      cookware_type TEXT NOT NULL CHECK(cookware_type IN ('one-pot', 'one-pan', 'oven')),
      servings INTEGER NOT NULL CHECK(servings = 2),
      dietary_tags TEXT NOT NULL DEFAULT '[]',
      seasonality TEXT NOT NULL DEFAULT '["any"]',
      source_type TEXT NOT NULL CHECK(source_type IN ('manual', 'ai-generated', 'web-imported')),
      source_reference TEXT,
      instructions TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `
    )
    .run();

  // Create ingredients table
  rawDb
    .prepare(
      `
    CREATE TABLE ingredients (
      id TEXT PRIMARY KEY,
      recipe_id TEXT NOT NULL,
      name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      dietary_properties TEXT NOT NULL DEFAULT '[]',
      optional INTEGER NOT NULL DEFAULT 0 CHECK(optional IN (0, 1)),
      order_index INTEGER NOT NULL,
      FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
    )
  `
    )
    .run();

  // Create dietary profile table (singleton)
  rawDb
    .prepare(
      `
    CREATE TABLE dietary_profile (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      hard_restrictions TEXT NOT NULL DEFAULT '[]',
      preferences TEXT NOT NULL DEFAULT '[]',
      explicit_inclusions TEXT NOT NULL DEFAULT '[]',
      explicit_exclusions TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL
    )
  `
    )
    .run();

  // Create indexes for query performance
  rawDb.prepare('CREATE INDEX idx_recipes_cooking_time ON recipes(cooking_time_minutes)').run();
  rawDb.prepare('CREATE INDEX idx_recipes_cookware_type ON recipes(cookware_type)').run();
  rawDb.prepare('CREATE INDEX idx_recipes_source_type ON recipes(source_type)').run();
  rawDb.prepare('CREATE INDEX idx_ingredients_recipe_id ON ingredients(recipe_id)').run();

  // Initialize default dietary profile with NO restrictions
  rawDb
    .prepare(
      `INSERT INTO dietary_profile (id, hard_restrictions, updated_at) 
       VALUES (?, ?, ?)`
    )
    .run(1, '[]', new Date().toISOString());

  recordMigration(version, 'initial_schema');
  console.log('Migration 001 complete');
}

// Migration 2: Add created_at index for chronological ordering
function migration002_addCreatedAtIndex(): void {
  const version = 2;
  if (isMigrationApplied(version)) return;

  console.log('Running migration 002: Add created_at index');

  // Create index for chronological ordering (newest first)
  rawDb.prepare('CREATE INDEX idx_recipes_created_at ON recipes(created_at DESC)').run();

  recordMigration(version, 'add_created_at_index');
  console.log('Migration 002 complete');
}

// Migration 3: Reset dietary profile to have no default restrictions
function migration003_resetDietaryProfile(): void {
  const version = 3;
  if (isMigrationApplied(version)) return;

  console.log('Running migration 003: Reset dietary profile defaults');

  // Clear hard restrictions for existing users (they can re-add if needed)
  rawDb
    .prepare(
      `UPDATE dietary_profile 
       SET hard_restrictions = '[]', updated_at = ? 
       WHERE id = 1`
    )
    .run(new Date().toISOString());

  recordMigration(version, 'reset_dietary_profile');
  console.log('Migration 003 complete');
}

// Run all migrations
export function runMigrations(): void {
  createMigrationsTable();
  migration001_initialSchema();
  migration002_addCreatedAtIndex();
  migration003_resetDietaryProfile();
  // Future migrations will be added here
  console.log('All migrations applied');
}
