# Database Layer Documentation

## Architecture

SimpleKitchen uses SQLite for local data persistence with a dual-client architecture:

- **Production**: better-sqlite3 (native module with superior performance)
- **Testing**: sql.js (pure JavaScript SQLite compiled to WebAssembly)
- **Abstraction**: `IDatabaseClient` interface ensures identical behavior

### Database Guarantees

- **Crash-safe durability**: WAL mode + FULL synchronous + fsync
- **Type safety**: Kysely query builder with generated TypeScript types
- **Schema versioning**: Migration system tracks applied changes
- **Performance**: Indexed queries for filtering operations
- **Test isolation**: sql.js runs in-memory for fast, isolated tests

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

- `cooking_time_minutes`: Must be 0-60 (spec requirement)
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
    {
      name: 'chicken breast',
      quantity: 300,
      unit: 'g',
      dietaryProperties: ['contains-meat'],
      optional: false,
      orderIndex: 1,
    },
    {
      name: 'broccoli',
      quantity: 200,
      unit: 'g',
      dietaryProperties: ['none'],
      optional: false,
      orderIndex: 2,
    },
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

### Testing Strategy

Database tests use **sql.js** (pure JavaScript SQLite) instead of better-sqlite3:

**Benefits:**

- ✅ No native module compilation required
- ✅ Fast execution in CI/CD environments
- ✅ Isolated in-memory databases for each test suite
- ✅ Identical SQL behavior via `IDatabaseClient` abstraction

**Implementation:**

- Factory function in `client.ts` detects `VITEST` or `NODE_ENV=test`
- Returns `SqlJsAdapter` instance instead of `SqliteDatabaseClient`
- All tests use in-memory database (`:memory:`)
- Kysely queries work identically with both clients

Run database tests:

```bash
npm run test:db          # Run once (uses sql.js)
npm run test:db:watch    # Watch mode (uses sql.js)
npm test                 # All tests (uses sql.js)
```

**Production vs Testing:**

- Production (`npm run dev`, `npm run package`): better-sqlite3
- Testing (`npm test`): sql.js
- Migrations are idempotent and run on both clients

## Durability Configuration

Critical PRAGMA settings applied at initialization:

```typescript
db.pragma('journal_mode = WAL'); // Write-Ahead Logging
db.pragma('synchronous = FULL'); // Full fsync guarantees
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
