import { rawDb } from './init.js';

// Migration version tracking table
function createMigrationsTable(): void {
  rawDb.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version INTEGER UNIQUE NOT NULL,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `);
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

  rawDb.exec(`
    -- Recipes table
    CREATE TABLE recipes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      cooking_time_minutes INTEGER NOT NULL CHECK(cooking_time_minutes >= 30 AND cooking_time_minutes <= 45),
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
    );

    -- Ingredients table
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
    );

    -- Dietary Profile table (singleton)
    CREATE TABLE dietary_profile (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      hard_restrictions TEXT NOT NULL DEFAULT '["gluten-free", "lactose-free"]',
      preferences TEXT NOT NULL DEFAULT '[]',
      explicit_inclusions TEXT NOT NULL DEFAULT '[]',
      explicit_exclusions TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL
    );

    -- Indexes for query performance
    CREATE INDEX idx_recipes_cooking_time ON recipes(cooking_time_minutes);
    CREATE INDEX idx_recipes_cookware_type ON recipes(cookware_type);
    CREATE INDEX idx_recipes_source_type ON recipes(source_type);
    CREATE INDEX idx_ingredients_recipe_id ON ingredients(recipe_id);
    
    -- Initialize default dietary profile
    INSERT INTO dietary_profile (id, hard_restrictions, updated_at) 
    VALUES (1, '["gluten-free", "lactose-free"]', datetime('now'));
  `);

  recordMigration(version, 'initial_schema');
  console.log('Migration 001 complete');
}

// Run all migrations
export function runMigrations(): void {
  createMigrationsTable();
  migration001_initialSchema();
  // Future migrations will be added here
  console.log('All migrations applied');
}
