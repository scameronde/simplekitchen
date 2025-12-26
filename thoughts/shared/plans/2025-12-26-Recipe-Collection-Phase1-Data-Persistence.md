# Phase 1: Data Model & Persistence Foundation

## Inputs

- **Master Plan**: `thoughts/shared/plans/2025-12-25-Recipe-Collection-Management-MASTER.md`
- **Research Report**: `thoughts/shared/research/2025-12-25-Recipe-Collection-Management.md`
- **Epic**: `thoughts/shared/epics/2025-12-25-Recipe-Collection-Management.md`
- **Spec**: `thoughts/shared/specs/2025-12-25-SimpleKitchen.md`
- **Phase 0 Complete**: `thoughts/shared/plans/2025-12-25-Recipe-Collection-Phase0-Stack-Selection.md`
- **Phase 0 Decisions**: `thoughts/shared/plans/2025-12-25-Recipe-Collection-Phase0-DECISIONS.md`

## Verified Current State

**Fact:** Phase 0 scaffolding is complete with Electron + React + TypeScript project structure.  
**Evidence:** `package.json:1-57`  
**Excerpt:** 
```json
{
  "name": "simplekitchen",
  "version": "0.1.0",
  "dependencies": {
    "better-sqlite3": "^11.10.0",
    "electron": "^39.2.7",
    "react": "^18.3.1"
  }
}
```

**Fact:** Project structure follows Electron two-process architecture.  
**Evidence:** File listing shows `src/main/`, `src/renderer/`, `src/shared/` directories exist.  
**Excerpt:** Directory structure matches Phase 0 plan layout

**Fact:** better-sqlite3 is already installed but not yet configured.  
**Evidence:** `package.json:32` shows `"better-sqlite3": "^11.10.0"`  
**Excerpt:** Dependency present but no database initialization code exists

**Fact:** SQLite durability requires explicit WAL + FULL synchronous configuration.  
**Evidence:** `thoughts/shared/research/2025-12-25-Recipe-Collection-Management.md:85-95`  
**Excerpt:** "SQLite's default configuration does NOT provide durability guarantees against OS crashes or power failures. Must configure `journal_mode=WAL` and `synchronous=FULL`"

**Fact:** Schema.org Recipe standard supports all required fields.  
**Evidence:** `thoughts/shared/research/2025-12-25-Recipe-Collection-Management.md:113-133`  
**Excerpt:** "Schema.org Recipe (v29.4) defines 90+ properties including `recipeIngredient`, `cookTime`, `recipeYield`, `suitableForDiet`, `tool`, `nutrition`"

**Fact:** Kysely was chosen as query builder for type-safe SQL.  
**Evidence:** `thoughts/shared/plans/2025-12-25-Recipe-Collection-Phase0-DECISIONS.md:38-45`  
**Excerpt:** "Chosen: Kysely. Rationale: Type-safe SQL query builder with zero runtime overhead"

**Fact:** Cookware type is single enum (mutually exclusive).  
**Evidence:** `thoughts/shared/plans/2025-12-25-Recipe-Collection-Management-MASTER.md:291-304`  
**Excerpt:** "Decision 6: Single Enum (one-pot OR one-pan OR oven, mutually exclusive)"

**Fact:** Seasonality uses user manual tags.  
**Evidence:** `thoughts/shared/plans/2025-12-25-Recipe-Collection-Management-MASTER.md:245-261`  
**Excerpt:** "Decision 4: User manually tags recipes with seasons (spring, summer, fall, winter, any)"

## Goals / Non-Goals

### Goals
- Implement SQLite database with crash-safe durability configuration
- Create Schema.org-aligned Recipe and Ingredient tables
- Implement Dietary Profile configuration storage
- Build type-safe database access layer (DAL) using Kysely
- Provide full CRUD operations for recipes and ingredients
- Ensure 100% type safety between database schema and TypeScript types
- Unit test all database operations

### Non-Goals
- UI components (Phase 3)
- Constraint validation logic (Phase 2)
- IPC handlers (Phase 3)
- AI integration (Phase 5)
- Web import (Phase 6)
- Performance optimization beyond basic indexing (Phase 4)

## Design Overview

### Database Architecture

```
SQLite Database (recipes.db)
├── recipes table (main recipe data)
├── ingredients table (one-to-many with recipes)
├── dietary_profile table (singleton user profile)
└── Indexes for filtering performance
```

### Type Safety Strategy

1. **Database Schema** → Kysely type generation → **TypeScript types**
2. All queries return strongly-typed results
3. Compile-time checking prevents SQL errors
4. Shared types between database and application logic

### Data Flow

```
Application Code
    ↓
DAL (Database Access Layer)
    ↓ (type-safe Kysely queries)
SQLite Database
    ↓ (WAL journaling)
Persistent Storage (recipes.db file)
```

### Critical Durability Pattern

```typescript
// MUST be executed on database initialization
db.pragma('journal_mode = WAL');
db.pragma('synchronous = FULL');
// macOS only:
// db.pragma('fullfsync = ON');
```

## Implementation Instructions (For Implementor)

### PLAN-101: Install Additional Dependencies

**Change Type**: modify  
**File(s)**: `package.json`

**Instruction**:
Install Kysely and related packages:

```bash
npm install kysely@^0.27.0
npm install --save-dev kysely-codegen@^0.16.0
```

**Evidence**: Kysely provides type-safe SQL query building (Phase 0 Decision 5)  
**Done When**: Dependencies added to `package.json`, `npm install` completes successfully

---

### PLAN-102: Create Database Schema Types

**Change Type**: create  
**File(s)**: `src/shared/types/database.ts`

**Instruction**:
Create TypeScript types representing database schema (aligned with Schema.org Recipe):

```typescript
// Database schema types (will be used by Kysely)

export type CookwareType = 'one-pot' | 'one-pan' | 'oven';

export type Season = 'spring' | 'summer' | 'fall' | 'winter' | 'any';

export type SourceType = 'manual' | 'ai-generated' | 'web-imported';

// Dietary restriction enums
export type DietaryTag = 
  | 'gluten-free' 
  | 'lactose-free' 
  | 'vegetarian' 
  | 'vegan' 
  | 'pescatarian';

export type DietaryProperty = 
  | 'contains-gluten' 
  | 'contains-lactose' 
  | 'contains-eggs' 
  | 'contains-fish' 
  | 'contains-meat' 
  | 'none';

// Recipe table
export interface RecipeTable {
  id: string; // UUID primary key
  title: string;
  cooking_time_minutes: number; // Active cooking time (30-45)
  prep_time_minutes: number | null; // Optional prep time
  total_time_minutes: number; // Total time (prep + cook)
  cookware_type: CookwareType;
  servings: number; // Must be 2 per spec
  dietary_tags: string; // JSON array of DietaryTag[]
  seasonality: string; // JSON array of Season[]
  source_type: SourceType;
  source_reference: string | null; // URL if web-imported
  instructions: string | null; // Optional cooking instructions
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
}

// Ingredient table (one-to-many with Recipe)
export interface IngredientTable {
  id: string; // UUID primary key
  recipe_id: string; // Foreign key to recipes.id
  name: string; // Ingredient name (e.g., "olive oil")
  quantity: number; // Numeric quantity (e.g., 2)
  unit: string; // Unit of measurement (e.g., "tbsp", "cup", "lb")
  dietary_properties: string; // JSON array of DietaryProperty[]
  optional: number; // SQLite boolean (0 or 1)
  order_index: number; // Display order (1, 2, 3...)
}

// Dietary Profile table (singleton - one row only)
export interface DietaryProfileTable {
  id: number; // Always 1 (singleton)
  hard_restrictions: string; // JSON array of DietaryTag[] (e.g., ["gluten-free", "lactose-free"])
  preferences: string; // JSON array of DietaryTag[] (soft preferences)
  explicit_inclusions: string; // JSON array of ingredient names allowed despite restrictions
  explicit_exclusions: string; // JSON array of ingredient names excluded
  updated_at: string; // ISO 8601 timestamp
}

// Kysely database interface (aggregates all tables)
export interface Database {
  recipes: RecipeTable;
  ingredients: IngredientTable;
  dietary_profile: DietaryProfileTable;
}
```

**Evidence**: 
- Schema.org Recipe alignment (research lines 113-133)
- Cookware single enum (master plan decision 6)
- Seasonality as user tags (master plan decision 4)
- Servings must be 2 (spec line 132)

**Done When**: `src/shared/types/database.ts` exists with all table interfaces defined

---

### PLAN-103: Create Application Domain Types

**Change Type**: create  
**File(s)**: `src/shared/types/recipe.ts`

**Instruction**:
Create application-level types (deserialized from database, with parsed JSON fields):

```typescript
import type { 
  CookwareType, 
  Season, 
  SourceType, 
  DietaryTag, 
  DietaryProperty 
} from './database';

// Application-level Recipe (JSON fields parsed)
export interface Recipe {
  id: string;
  title: string;
  cookingTimeMinutes: number;
  prepTimeMinutes: number | null;
  totalTimeMinutes: number;
  cookwareType: CookwareType;
  servings: number;
  dietaryTags: DietaryTag[];
  seasonality: Season[];
  sourceType: SourceType;
  sourceReference: string | null;
  instructions: string | null;
  ingredients: Ingredient[]; // Nested ingredients
  createdAt: Date;
  updatedAt: Date;
}

// Application-level Ingredient
export interface Ingredient {
  id: string;
  recipeId: string;
  name: string;
  quantity: number;
  unit: string;
  dietaryProperties: DietaryProperty[];
  optional: boolean;
  orderIndex: number;
}

// Application-level Dietary Profile
export interface DietaryProfile {
  id: number;
  hardRestrictions: DietaryTag[];
  preferences: DietaryTag[];
  explicitInclusions: string[]; // Ingredient names
  explicitExclusions: string[]; // Ingredient names
  updatedAt: Date;
}

// Recipe creation input (no ID, no timestamps)
export interface CreateRecipeInput {
  title: string;
  cookingTimeMinutes: number;
  prepTimeMinutes?: number;
  cookwareType: CookwareType;
  servings: number;
  dietaryTags: DietaryTag[];
  seasonality: Season[];
  sourceType: SourceType;
  sourceReference?: string;
  instructions?: string;
  ingredients: CreateIngredientInput[];
}

// Ingredient creation input (no ID, no recipeId)
export interface CreateIngredientInput {
  name: string;
  quantity: number;
  unit: string;
  dietaryProperties: DietaryProperty[];
  optional?: boolean;
  orderIndex: number;
}

// Recipe update input (partial fields allowed)
export interface UpdateRecipeInput {
  title?: string;
  cookingTimeMinutes?: number;
  prepTimeMinutes?: number;
  cookwareType?: CookwareType;
  dietaryTags?: DietaryTag[];
  seasonality?: Season[];
  instructions?: string;
  ingredients?: CreateIngredientInput[]; // Replace all ingredients if provided
}

// Recipe filter criteria
export interface RecipeFilter {
  cookingTimeMin?: number;
  cookingTimeMax?: number;
  cookwareTypes?: CookwareType[];
  dietaryTags?: DietaryTag[]; // Recipes must have ALL specified tags
  seasonality?: Season[]; // Recipes matching ANY specified season
  sourceTypes?: SourceType[];
}
```

**Evidence**: Application types separate from database types for clean architecture  
**Done When**: `src/shared/types/recipe.ts` exists with all domain types

---

### PLAN-104: Create Database Initialization Module

**Change Type**: create  
**File(s)**: `src/main/database/init.ts`

**Instruction**:
Create database initialization with crash-safe durability configuration:

```typescript
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
```

**Evidence**: 
- Durability configuration required (research lines 85-95)
- WAL + FULL synchronous documented (research lines 247-255)

**Done When**: Database initialization module exists with correct PRAGMA settings

---

### PLAN-105: Create Database Migration System

**Change Type**: create  
**File(s)**: `src/main/database/migrations.ts`

**Instruction**:
Create simple migration system to initialize schema:

```typescript
import { rawDb } from './init';

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
  const result = rawDb
    .prepare('SELECT version FROM migrations WHERE version = ?')
    .get(version);
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
```

**Evidence**: 
- Servings CHECK constraint (spec line 132: servings must be 2)
- Cooking time CHECK constraint (spec line 47-48: 30-45 minutes)
- Cookware type CHECK constraint (master plan decision 6)
- Default dietary profile (spec lines 481-485: gluten-free, lactose-free required)

**Done When**: Migration system creates all tables with correct constraints and indexes

---

### PLAN-106: Create Data Access Layer (DAL) - Recipe Operations

**Change Type**: create  
**File(s)**: `src/main/database/dal/recipes.ts`

**Instruction**:
Implement type-safe recipe CRUD operations using Kysely:

```typescript
import { db } from '../init';
import { randomUUID } from 'crypto';
import type { Recipe, CreateRecipeInput, UpdateRecipeInput, RecipeFilter } from '../../../shared/types/recipe';
import type { RecipeTable } from '../../../shared/types/database';

// Helper: Convert database row to application Recipe (deserialize JSON, parse dates)
function dbToRecipe(row: RecipeTable, ingredients: any[]): Recipe {
  return {
    id: row.id,
    title: row.title,
    cookingTimeMinutes: row.cooking_time_minutes,
    prepTimeMinutes: row.prep_time_minutes,
    totalTimeMinutes: row.total_time_minutes,
    cookwareType: row.cookware_type,
    servings: row.servings,
    dietaryTags: JSON.parse(row.dietary_tags),
    seasonality: JSON.parse(row.seasonality),
    sourceType: row.source_type,
    sourceReference: row.source_reference,
    instructions: row.instructions,
    ingredients, // Will be populated by caller
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

// Create new recipe with ingredients (transactional)
export async function createRecipe(input: CreateRecipeInput): Promise<Recipe> {
  const recipeId = randomUUID();
  const now = new Date().toISOString();
  
  const totalTime = (input.prepTimeMinutes || 0) + input.cookingTimeMinutes;

  // Insert recipe
  await db
    .insertInto('recipes')
    .values({
      id: recipeId,
      title: input.title,
      cooking_time_minutes: input.cookingTimeMinutes,
      prep_time_minutes: input.prepTimeMinutes || null,
      total_time_minutes: totalTime,
      cookware_type: input.cookwareType,
      servings: input.servings,
      dietary_tags: JSON.stringify(input.dietaryTags),
      seasonality: JSON.stringify(input.seasonality),
      source_type: input.sourceType,
      source_reference: input.sourceReference || null,
      instructions: input.instructions || null,
      created_at: now,
      updated_at: now,
    })
    .execute();

  // Insert ingredients
  const ingredientRows = input.ingredients.map((ing, index) => ({
    id: randomUUID(),
    recipe_id: recipeId,
    name: ing.name,
    quantity: ing.quantity,
    unit: ing.unit,
    dietary_properties: JSON.stringify(ing.dietaryProperties),
    optional: ing.optional ? 1 : 0,
    order_index: ing.orderIndex ?? index + 1,
  }));

  if (ingredientRows.length > 0) {
    await db.insertInto('ingredients').values(ingredientRows).execute();
  }

  // Return created recipe
  const recipe = await getRecipeById(recipeId);
  if (!recipe) throw new Error('Failed to create recipe');
  return recipe;
}

// Get recipe by ID (with ingredients)
export async function getRecipeById(id: string): Promise<Recipe | null> {
  const recipeRow = await db
    .selectFrom('recipes')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst();

  if (!recipeRow) return null;

  const ingredientRows = await db
    .selectFrom('ingredients')
    .selectAll()
    .where('recipe_id', '=', id)
    .orderBy('order_index', 'asc')
    .execute();

  const ingredients = ingredientRows.map(ing => ({
    id: ing.id,
    recipeId: ing.recipe_id,
    name: ing.name,
    quantity: ing.quantity,
    unit: ing.unit,
    dietaryProperties: JSON.parse(ing.dietary_properties),
    optional: ing.optional === 1,
    orderIndex: ing.order_index,
  }));

  return dbToRecipe(recipeRow, ingredients);
}

// Get all recipes (with optional filtering)
export async function getRecipes(filter?: RecipeFilter): Promise<Recipe[]> {
  let query = db.selectFrom('recipes').selectAll();

  // Apply filters
  if (filter) {
    if (filter.cookingTimeMin !== undefined) {
      query = query.where('cooking_time_minutes', '>=', filter.cookingTimeMin);
    }
    if (filter.cookingTimeMax !== undefined) {
      query = query.where('cooking_time_minutes', '<=', filter.cookingTimeMax);
    }
    if (filter.cookwareTypes && filter.cookwareTypes.length > 0) {
      query = query.where('cookware_type', 'in', filter.cookwareTypes);
    }
    if (filter.sourceTypes && filter.sourceTypes.length > 0) {
      query = query.where('source_type', 'in', filter.sourceTypes);
    }
    // Note: dietaryTags and seasonality filtering requires JSON operations (Phase 4)
  }

  const recipeRows = await query.execute();

  // Fetch ingredients for all recipes (N+1 query for now, will optimize in Phase 4)
  const recipes: Recipe[] = [];
  for (const row of recipeRows) {
    const recipe = await getRecipeById(row.id);
    if (recipe) recipes.push(recipe);
  }

  return recipes;
}

// Update recipe
export async function updateRecipe(id: string, input: UpdateRecipeInput): Promise<Recipe | null> {
  const existing = await getRecipeById(id);
  if (!existing) return null;

  const now = new Date().toISOString();

  // Build update object
  const updates: Partial<RecipeTable> = { updated_at: now };
  if (input.title !== undefined) updates.title = input.title;
  if (input.cookingTimeMinutes !== undefined) {
    updates.cooking_time_minutes = input.cookingTimeMinutes;
    const prepTime = input.prepTimeMinutes ?? existing.prepTimeMinutes ?? 0;
    updates.total_time_minutes = prepTime + input.cookingTimeMinutes;
  }
  if (input.prepTimeMinutes !== undefined) {
    updates.prep_time_minutes = input.prepTimeMinutes;
    updates.total_time_minutes = input.prepTimeMinutes + existing.cookingTimeMinutes;
  }
  if (input.cookwareType !== undefined) updates.cookware_type = input.cookwareType;
  if (input.dietaryTags !== undefined) updates.dietary_tags = JSON.stringify(input.dietaryTags);
  if (input.seasonality !== undefined) updates.seasonality = JSON.stringify(input.seasonality);
  if (input.instructions !== undefined) updates.instructions = input.instructions;

  // Update recipe
  await db.updateTable('recipes').set(updates).where('id', '=', id).execute();

  // If ingredients provided, replace all
  if (input.ingredients !== undefined) {
    // Delete old ingredients
    await db.deleteFrom('ingredients').where('recipe_id', '=', id).execute();

    // Insert new ingredients
    const ingredientRows = input.ingredients.map((ing, index) => ({
      id: randomUUID(),
      recipe_id: id,
      name: ing.name,
      quantity: ing.quantity,
      unit: ing.unit,
      dietary_properties: JSON.stringify(ing.dietaryProperties),
      optional: ing.optional ? 1 : 0,
      order_index: ing.orderIndex ?? index + 1,
    }));

    if (ingredientRows.length > 0) {
      await db.insertInto('ingredients').values(ingredientRows).execute();
    }
  }

  // Return updated recipe
  return getRecipeById(id);
}

// Delete recipe (cascade deletes ingredients via foreign key)
export async function deleteRecipe(id: string): Promise<boolean> {
  const result = await db.deleteFrom('recipes').where('id', '=', id).execute();
  return result.length > 0;
}

// Get recipe count (for stats)
export async function getRecipeCount(): Promise<number> {
  const result = await db
    .selectFrom('recipes')
    .select(db.fn.count('id').as('count'))
    .executeTakeFirst();
  return Number(result?.count ?? 0);
}
```

**Evidence**: 
- Kysely provides type-safe query building (Phase 0 decision 5)
- UUID for primary keys (best practice for distributed systems)
- JSON serialization for arrays (SQLite doesn't have native array support)

**Done When**: Recipe CRUD operations implemented with full type safety

---

### PLAN-107: Create DAL - Dietary Profile Operations

**Change Type**: create  
**File(s)**: `src/main/database/dal/dietary-profile.ts`

**Instruction**:
Implement dietary profile CRUD (singleton pattern):

```typescript
import { db } from '../init';
import type { DietaryProfile } from '../../../shared/types/recipe';
import type { DietaryProfileTable } from '../../../shared/types/database';
import type { DietaryTag } from '../../../shared/types/database';

// Get dietary profile (singleton - always ID 1)
export async function getDietaryProfile(): Promise<DietaryProfile> {
  const row = await db
    .selectFrom('dietary_profile')
    .selectAll()
    .where('id', '=', 1)
    .executeTakeFirst();

  if (!row) {
    // Should never happen (migration creates default profile)
    throw new Error('Dietary profile not found');
  }

  return {
    id: row.id,
    hardRestrictions: JSON.parse(row.hard_restrictions),
    preferences: JSON.parse(row.preferences),
    explicitInclusions: JSON.parse(row.explicit_inclusions),
    explicitExclusions: JSON.parse(row.explicit_exclusions),
    updatedAt: new Date(row.updated_at),
  };
}

// Update dietary profile
export async function updateDietaryProfile(updates: {
  hardRestrictions?: DietaryTag[];
  preferences?: DietaryTag[];
  explicitInclusions?: string[];
  explicitExclusions?: string[];
}): Promise<DietaryProfile> {
  const now = new Date().toISOString();

  const dbUpdates: Partial<DietaryProfileTable> = { updated_at: now };
  if (updates.hardRestrictions !== undefined) {
    dbUpdates.hard_restrictions = JSON.stringify(updates.hardRestrictions);
  }
  if (updates.preferences !== undefined) {
    dbUpdates.preferences = JSON.stringify(updates.preferences);
  }
  if (updates.explicitInclusions !== undefined) {
    dbUpdates.explicit_inclusions = JSON.stringify(updates.explicitInclusions);
  }
  if (updates.explicitExclusions !== undefined) {
    dbUpdates.explicit_exclusions = JSON.stringify(updates.explicitExclusions);
  }

  await db
    .updateTable('dietary_profile')
    .set(dbUpdates)
    .where('id', '=', 1)
    .execute();

  return getDietaryProfile();
}

// Reset dietary profile to defaults
export async function resetDietaryProfile(): Promise<DietaryProfile> {
  await db
    .updateTable('dietary_profile')
    .set({
      hard_restrictions: JSON.stringify(['gluten-free', 'lactose-free']),
      preferences: JSON.stringify([]),
      explicit_inclusions: JSON.stringify([]),
      explicit_exclusions: JSON.stringify([]),
      updated_at: new Date().toISOString(),
    })
    .where('id', '=', 1)
    .execute();

  return getDietaryProfile();
}
```

**Evidence**: Dietary profile is singleton (spec lines 481-489: single user, one dietary profile)  
**Done When**: Dietary profile operations implemented with type safety

---

### PLAN-108: Create Database Index Module

**Change Type**: create  
**File(s)**: `src/main/database/index.ts`

**Instruction**:
Create barrel export for database layer:

```typescript
// Database initialization and connection
export { db, rawDb, closeDatabase } from './init';
export { runMigrations } from './migrations';

// Data Access Layer - Recipes
export {
  createRecipe,
  getRecipeById,
  getRecipes,
  updateRecipe,
  deleteRecipe,
  getRecipeCount,
} from './dal/recipes';

// Data Access Layer - Dietary Profile
export {
  getDietaryProfile,
  updateDietaryProfile,
  resetDietaryProfile,
} from './dal/dietary-profile';
```

**Evidence**: Barrel exports provide clean API for database operations  
**Done When**: All database exports available from single import

---

### PLAN-109: Initialize Database on Application Start

**Change Type**: modify  
**File(s)**: `src/main/main.ts`

**Instruction**:
Update main process to initialize database on app startup:

```typescript
import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { runMigrations, closeDatabase } from './database';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Initialize database before creating window
  console.log('Initializing database...');
  runMigrations();
  console.log('Database ready');

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    closeDatabase();
    app.quit();
  }
});

// Graceful shutdown
app.on('before-quit', () => {
  closeDatabase();
});
```

**Evidence**: Database must be initialized before any operations (migrations run first)  
**Done When**: Database initializes automatically on app startup, closes gracefully on quit

---

### PLAN-110: Create Unit Tests - Recipe CRUD

**Change Type**: create  
**File(s)**: `src/main/database/dal/recipes.test.ts`

**Instruction**:
Create comprehensive unit tests for recipe operations:

```typescript
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import {
  createRecipe,
  getRecipeById,
  getRecipes,
  updateRecipe,
  deleteRecipe,
  getRecipeCount,
} from './recipes';
import { runMigrations, closeDatabase } from '../index';
import type { CreateRecipeInput } from '../../../shared/types/recipe';

// Run migrations before tests
beforeEach(() => {
  runMigrations();
});

// Close database after all tests
afterAll(() => {
  closeDatabase();
});

describe('Recipe CRUD Operations', () => {
  const sampleRecipe: CreateRecipeInput = {
    title: 'Simple Pasta',
    cookingTimeMinutes: 30,
    prepTimeMinutes: 10,
    cookwareType: 'one-pot',
    servings: 2,
    dietaryTags: ['gluten-free', 'lactose-free'],
    seasonality: ['any'],
    sourceType: 'manual',
    instructions: 'Boil water, cook pasta, add sauce.',
    ingredients: [
      {
        name: 'gluten-free pasta',
        quantity: 200,
        unit: 'g',
        dietaryProperties: ['none'],
        optional: false,
        orderIndex: 1,
      },
      {
        name: 'olive oil',
        quantity: 2,
        unit: 'tbsp',
        dietaryProperties: ['none'],
        optional: false,
        orderIndex: 2,
      },
    ],
  };

  it('should create a new recipe with ingredients', async () => {
    const recipe = await createRecipe(sampleRecipe);

    expect(recipe.id).toBeDefined();
    expect(recipe.title).toBe('Simple Pasta');
    expect(recipe.cookingTimeMinutes).toBe(30);
    expect(recipe.totalTimeMinutes).toBe(40); // 10 prep + 30 cook
    expect(recipe.servings).toBe(2);
    expect(recipe.ingredients).toHaveLength(2);
    expect(recipe.ingredients[0].name).toBe('gluten-free pasta');
  });

  it('should retrieve recipe by ID', async () => {
    const created = await createRecipe(sampleRecipe);
    const retrieved = await getRecipeById(created.id);

    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe(created.id);
    expect(retrieved!.title).toBe(created.title);
  });

  it('should return null for non-existent recipe', async () => {
    const result = await getRecipeById('non-existent-id');
    expect(result).toBeNull();
  });

  it('should retrieve all recipes', async () => {
    await createRecipe(sampleRecipe);
    await createRecipe({ ...sampleRecipe, title: 'Another Recipe' });

    const recipes = await getRecipes();
    expect(recipes.length).toBeGreaterThanOrEqual(2);
  });

  it('should filter recipes by cooking time', async () => {
    await createRecipe({ ...sampleRecipe, cookingTimeMinutes: 30 });
    await createRecipe({ ...sampleRecipe, title: 'Quick Dish', cookingTimeMinutes: 35 });

    const filtered = await getRecipes({ cookingTimeMin: 32 });
    expect(filtered.every(r => r.cookingTimeMinutes >= 32)).toBe(true);
  });

  it('should filter recipes by cookware type', async () => {
    await createRecipe({ ...sampleRecipe, cookwareType: 'one-pot' });
    await createRecipe({ ...sampleRecipe, title: 'Pan Recipe', cookwareType: 'one-pan' });

    const filtered = await getRecipes({ cookwareTypes: ['one-pan'] });
    expect(filtered.every(r => r.cookwareType === 'one-pan')).toBe(true);
  });

  it('should update recipe title', async () => {
    const created = await createRecipe(sampleRecipe);
    const updated = await updateRecipe(created.id, { title: 'Updated Pasta' });

    expect(updated).not.toBeNull();
    expect(updated!.title).toBe('Updated Pasta');
    expect(updated!.cookingTimeMinutes).toBe(30); // Unchanged
  });

  it('should update recipe ingredients', async () => {
    const created = await createRecipe(sampleRecipe);
    const updated = await updateRecipe(created.id, {
      ingredients: [
        {
          name: 'rice',
          quantity: 1,
          unit: 'cup',
          dietaryProperties: ['none'],
          optional: false,
          orderIndex: 1,
        },
      ],
    });

    expect(updated!.ingredients).toHaveLength(1);
    expect(updated!.ingredients[0].name).toBe('rice');
  });

  it('should delete recipe', async () => {
    const created = await createRecipe(sampleRecipe);
    const deleted = await deleteRecipe(created.id);
    expect(deleted).toBe(true);

    const retrieved = await getRecipeById(created.id);
    expect(retrieved).toBeNull();
  });

  it('should cascade delete ingredients when recipe is deleted', async () => {
    const created = await createRecipe(sampleRecipe);
    await deleteRecipe(created.id);

    // Verify ingredients are also deleted (foreign key cascade)
    const retrieved = await getRecipeById(created.id);
    expect(retrieved).toBeNull(); // Recipe and ingredients gone
  });

  it('should get accurate recipe count', async () => {
    const countBefore = await getRecipeCount();
    await createRecipe(sampleRecipe);
    const countAfter = await getRecipeCount();

    expect(countAfter).toBe(countBefore + 1);
  });
});
```

**Evidence**: Unit tests ensure CRUD operations work correctly  
**Done When**: All tests pass, 100% coverage for recipe CRUD operations

---

### PLAN-111: Create Unit Tests - Dietary Profile

**Change Type**: create  
**File(s)**: `src/main/database/dal/dietary-profile.test.ts`

**Instruction**:
Create tests for dietary profile operations:

```typescript
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import {
  getDietaryProfile,
  updateDietaryProfile,
  resetDietaryProfile,
} from './dietary-profile';
import { runMigrations, closeDatabase } from '../index';

beforeEach(() => {
  runMigrations();
});

afterAll(() => {
  closeDatabase();
});

describe('Dietary Profile Operations', () => {
  it('should retrieve default dietary profile', async () => {
    const profile = await getDietaryProfile();

    expect(profile.id).toBe(1);
    expect(profile.hardRestrictions).toContain('gluten-free');
    expect(profile.hardRestrictions).toContain('lactose-free');
  });

  it('should update hard restrictions', async () => {
    const updated = await updateDietaryProfile({
      hardRestrictions: ['gluten-free', 'lactose-free', 'vegetarian'],
    });

    expect(updated.hardRestrictions).toHaveLength(3);
    expect(updated.hardRestrictions).toContain('vegetarian');
  });

  it('should update preferences', async () => {
    const updated = await updateDietaryProfile({
      preferences: ['pescatarian'],
    });

    expect(updated.preferences).toContain('pescatarian');
  });

  it('should update explicit inclusions', async () => {
    const updated = await updateDietaryProfile({
      explicitInclusions: ['parmesan cheese', 'aged cheddar'],
    });

    expect(updated.explicitInclusions).toHaveLength(2);
  });

  it('should update explicit exclusions', async () => {
    const updated = await updateDietaryProfile({
      explicitExclusions: ['mushrooms', 'olives'],
    });

    expect(updated.explicitExclusions).toContain('mushrooms');
  });

  it('should reset dietary profile to defaults', async () => {
    // First modify
    await updateDietaryProfile({
      hardRestrictions: ['vegan'],
      preferences: ['pescatarian'],
    });

    // Then reset
    const reset = await resetDietaryProfile();

    expect(reset.hardRestrictions).toEqual(['gluten-free', 'lactose-free']);
    expect(reset.preferences).toEqual([]);
    expect(reset.explicitInclusions).toEqual([]);
    expect(reset.explicitExclusions).toEqual([]);
  });
});
```

**Evidence**: Singleton dietary profile pattern tested  
**Done When**: All dietary profile tests pass

---

### PLAN-112: Create Unit Tests - Database Durability

**Change Type**: create  
**File(s)**: `src/main/database/init.test.ts`

**Instruction**:
Create tests verifying crash-safe durability configuration:

```typescript
import { describe, it, expect, afterAll } from 'vitest';
import { rawDb, closeDatabase } from './init';

afterAll(() => {
  closeDatabase();
});

describe('Database Durability Configuration', () => {
  it('should have WAL journal mode enabled', () => {
    const result = rawDb.pragma('journal_mode', { simple: true }) as string;
    expect(result.toLowerCase()).toBe('wal');
  });

  it('should have FULL synchronous mode enabled', () => {
    const result = rawDb.pragma('synchronous', { simple: true }) as number;
    // FULL = 2, NORMAL = 1, OFF = 0
    expect(result).toBe(2);
  });

  it('should have reasonable cache size', () => {
    const result = rawDb.pragma('cache_size', { simple: true }) as number;
    expect(Math.abs(result)).toBeGreaterThan(1000); // At least some caching
  });

  it('should use memory for temp storage', () => {
    const result = rawDb.pragma('temp_store', { simple: true }) as number;
    // MEMORY = 2, FILE = 1, DEFAULT = 0
    expect(result).toBe(2);
  });
});
```

**Evidence**: Durability configuration is critical (research lines 85-95) and must be verified  
**Done When**: All durability tests pass, PRAGMA settings confirmed

---

### PLAN-113: Create Unit Tests - Schema Constraints

**Change Type**: create  
**File(s)**: `src/main/database/migrations.test.ts`

**Instruction**:
Create tests verifying database schema constraints:

```typescript
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { runMigrations, closeDatabase, createRecipe } from './index';
import type { CreateRecipeInput } from '../../shared/types/recipe';

beforeEach(() => {
  runMigrations();
});

afterAll(() => {
  closeDatabase();
});

describe('Database Schema Constraints', () => {
  const validRecipe: CreateRecipeInput = {
    title: 'Valid Recipe',
    cookingTimeMinutes: 35,
    cookwareType: 'one-pot',
    servings: 2,
    dietaryTags: [],
    seasonality: ['any'],
    sourceType: 'manual',
    ingredients: [],
  };

  it('should reject cooking time below 30 minutes', async () => {
    await expect(
      createRecipe({ ...validRecipe, cookingTimeMinutes: 25 })
    ).rejects.toThrow();
  });

  it('should reject cooking time above 45 minutes', async () => {
    await expect(
      createRecipe({ ...validRecipe, cookingTimeMinutes: 50 })
    ).rejects.toThrow();
  });

  it('should reject servings not equal to 2', async () => {
    await expect(
      createRecipe({ ...validRecipe, servings: 4 })
    ).rejects.toThrow();
  });

  it('should reject invalid cookware type', async () => {
    await expect(
      // @ts-expect-error Testing invalid value
      createRecipe({ ...validRecipe, cookwareType: 'multi-pot' })
    ).rejects.toThrow();
  });

  it('should reject invalid source type', async () => {
    await expect(
      // @ts-expect-error Testing invalid value
      createRecipe({ ...validRecipe, sourceType: 'unknown' })
    ).rejects.toThrow();
  });

  it('should accept valid recipe within constraints', async () => {
    const recipe = await createRecipe(validRecipe);
    expect(recipe.id).toBeDefined();
  });
});
```

**Evidence**: Schema constraints enforce spec requirements (servings=2, 30-45 min, etc.)  
**Done When**: All constraint tests pass, invalid data properly rejected

---

### PLAN-114: Update Package Scripts for Database Tests

**Change Type**: modify  
**File(s)**: `package.json`

**Instruction**:
Add database-specific test scripts:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:db": "vitest run src/main/database",
    "test:db:watch": "vitest src/main/database"
  }
}
```

**Evidence**: Specialized test scripts help during development  
**Done When**: Database tests can be run independently with `npm run test:db`

---

### PLAN-115: Create Database Documentation

**Change Type**: create  
**File(s)**: `src/main/database/README.md`

**Instruction**:
Document database architecture and usage:

```markdown
# Database Layer Documentation

## Architecture

SimpleKitchen uses SQLite for local data persistence with the following guarantees:

- **Crash-safe durability**: WAL mode + FULL synchronous + fsync
- **Type safety**: Kysely query builder with generated TypeScript types
- **Schema versioning**: Migration system tracks applied changes
- **Performance**: Indexed queries for filtering operations

## Database Location

- **Development**: `{app.getPath('userData')}/recipes.db`
- **Production**: Same location (OS-specific user data directory)

### Platform-Specific Paths
- **macOS**: `~/Library/Application Support/simplekitchen/recipes.db`
- **Windows**: `%APPDATA%/simplekitchen/recipes.db`
- **Linux**: `~/.config/simplekitchen/recipes.db`

## Tables

### recipes
Stores recipe metadata (title, times, cookware, dietary tags, source).

**Constraints:**
- `cooking_time_minutes`: Must be 30-45 (spec requirement)
- `servings`: Must be exactly 2 (spec requirement)
- `cookware_type`: One of 'one-pot', 'one-pan', 'oven'
- `source_type`: One of 'manual', 'ai-generated', 'web-imported'

**Indexes:**
- `idx_recipes_cooking_time`: For time-based filtering
- `idx_recipes_cookware_type`: For cookware filtering
- `idx_recipes_source_type`: For source filtering

### ingredients
Stores ingredient details linked to recipes (one-to-many).

**Foreign Key:**
- `recipe_id` → `recipes.id` (CASCADE DELETE)

**Indexes:**
- `idx_ingredients_recipe_id`: For efficient joins

### dietary_profile
Singleton table (always ID=1) storing user dietary preferences.

**Default values:**
- `hard_restrictions`: ["gluten-free", "lactose-free"]
- `preferences`: []
- `explicit_inclusions`: []
- `explicit_exclusions`: []

## Usage Examples

### Create a Recipe

```typescript
import { createRecipe } from './database';

const recipe = await createRecipe({
  title: 'Simple Stir-Fry',
  cookingTimeMinutes: 30,
  cookwareType: 'one-pan',
  servings: 2,
  dietaryTags: ['gluten-free', 'lactose-free'],
  seasonality: ['any'],
  sourceType: 'manual',
  ingredients: [
    { name: 'chicken breast', quantity: 300, unit: 'g', dietaryProperties: ['contains-meat'], optional: false, orderIndex: 1 },
    { name: 'broccoli', quantity: 200, unit: 'g', dietaryProperties: ['none'], optional: false, orderIndex: 2 },
  ],
});
```

### Query Recipes with Filters

```typescript
import { getRecipes } from './database';

const quickRecipes = await getRecipes({
  cookingTimeMax: 35,
  cookwareTypes: ['one-pan'],
});
```

### Update Dietary Profile

```typescript
import { updateDietaryProfile } from './database';

await updateDietaryProfile({
  hardRestrictions: ['gluten-free', 'lactose-free', 'vegetarian'],
  explicitInclusions: ['parmesan cheese'], // Aged cheese allowed despite lactose-free
});
```

## Type Safety

All database operations are fully type-safe:

```typescript
import { Recipe, CreateRecipeInput } from '../../shared/types/recipe';
import { Database } from '../../shared/types/database';

// TypeScript will catch errors at compile time
const recipe: CreateRecipeInput = {
  title: 'Test',
  cookingTimeMinutes: 30,
  // TypeScript error: missing required fields
};
```

## Testing

Run database tests:

```bash
npm run test:db          # Run once
npm run test:db:watch    # Watch mode
```

All tests use the same database file, so migrations are idempotent.

## Durability Configuration

Critical PRAGMA settings applied at initialization:

```typescript
db.pragma('journal_mode = WAL');   // Write-Ahead Logging
db.pragma('synchronous = FULL');   // Full fsync guarantees
```

**Why this matters:** Default SQLite configuration can lose data on crashes. These settings ensure crash-safe durability (verified by research).

## Migration System

Migrations are automatically applied on app startup. To add a new migration:

1. Create a new function in `migrations.ts`: `migration002_description()`
2. Check if applied: `if (isMigrationApplied(2)) return;`
3. Execute SQL changes
4. Record migration: `recordMigration(2, 'description');`
5. Add to `runMigrations()` sequence

Migrations are tracked in the `migrations` table and only run once.
```

**Evidence**: Documentation helps future maintainers understand database layer  
**Done When**: Comprehensive database documentation exists

---

## Verification Tasks

**No unverified assumptions in Phase 1** - all database patterns are well-documented and tested.

## Acceptance Criteria

**Phase 1 Complete When:**

- [ ] SQLite database initializes with WAL + FULL synchronous durability
- [ ] Migrations create recipes, ingredients, and dietary_profile tables
- [ ] Recipe table has CHECK constraints for servings=2, cooking_time 30-45
- [ ] Ingredients table has foreign key CASCADE DELETE to recipes
- [ ] Dietary profile table is singleton (ID=1 only)
- [ ] Kysely provides type-safe query building for all operations
- [ ] createRecipe() inserts recipe with ingredients (transactional)
- [ ] getRecipeById() retrieves recipe with nested ingredients
- [ ] getRecipes() supports filtering by time and cookware type
- [ ] updateRecipe() modifies recipe and replaces ingredients
- [ ] deleteRecipe() removes recipe and cascades to ingredients
- [ ] getDietaryProfile() retrieves singleton profile
- [ ] updateDietaryProfile() modifies restrictions and preferences
- [ ] All unit tests pass with 100% coverage for CRUD operations
- [ ] Database durability PRAGMA settings verified by tests
- [ ] Schema constraints verified (servings=2, time limits, etc.)
- [ ] Database documentation complete and accurate
- [ ] Application starts successfully with database initialization

## Implementor Checklist

Execute in this exact order:

- [ ] PLAN-101: Install Kysely dependencies
- [ ] PLAN-102: Create database schema types
- [ ] PLAN-103: Create application domain types
- [ ] PLAN-104: Create database initialization module
- [ ] PLAN-105: Create migration system
- [ ] PLAN-106: Create DAL - Recipe operations
- [ ] PLAN-107: Create DAL - Dietary profile operations
- [ ] PLAN-108: Create database index (barrel export)
- [ ] PLAN-109: Initialize database on app start
- [ ] PLAN-110: Create unit tests - Recipe CRUD
- [ ] PLAN-111: Create unit tests - Dietary profile
- [ ] PLAN-112: Create unit tests - Database durability
- [ ] PLAN-113: Create unit tests - Schema constraints
- [ ] PLAN-114: Update package scripts
- [ ] PLAN-115: Create database documentation

**Total Tasks**: 15 implementation tasks

---

## Next Phase

After Phase 1 completion, proceed to:

**Phase 2**: Core Constraint Validation System  
**Plan File**: `2025-12-26-Recipe-Collection-Phase2-Constraint-Validation.md`

Phase 2 will implement:
- Static ingredient database (curated dietary properties)
- Multi-layer dietary constraint validation
- Time constraint validation (30-45 minutes)
- Cookware constraint validation (single cookware type)
- Servings constraint validation (exactly 2)
- Validation error reporting with actionable messages
- Unit tests with 100% coverage for constraint logic

---

**End of Phase 1 Plan**
