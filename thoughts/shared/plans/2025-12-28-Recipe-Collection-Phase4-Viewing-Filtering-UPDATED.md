# Phase 4: Recipe Viewing & Filtering - Implementation Plan (UPDATED 2025-12-28)

**IMPORTANT**: This is an UPDATED version of the original Phase 4 plan created on 2025-12-27. Significant architectural changes occurred between 2025-12-27 and 2025-12-28 that required plan corrections.

## Updates from Original Plan

**Original Plan**: `thoughts/shared/plans/2025-12-27-Recipe-Collection-Phase4-Viewing-Filtering.md`  
**Updated**: 2025-12-28  
**Reason**: Database architecture migration, type system changes, partial DAL implementation

### Key Changes Since Original Plan

1. **Database Architecture**: Migrated from single better-sqlite3 to dual-client (better-sqlite3 for production, sql.js for testing)
2. **Type System**: Recipe IDs changed from `number` to `string` (UUID), all DAL methods now async
3. **DAL Methods**: `getRecipes(filter?: RecipeFilter)` replaces separate `getAllRecipes()` and `filterRecipes()`
4. **Field Naming**: Application types use camelCase (`cookingTimeMinutes`), filter uses `cookingTimeMin/Max` not `minCookingTime/maxCookingTime`
5. **Indexes**: 3 of 4 planned indexes already exist in migrations.ts (cooking_time, cookware_type, source_type)
6. **Partial Implementation**: Dietary tags and seasonality filtering marked incomplete in DAL (line 135-136)

See analysis at end of document for detailed task-by-task changes.

## Inputs

- **Research Report**: `thoughts/shared/research/2025-12-25-Recipe-Collection-Management.md`
- **Epic**: `thoughts/shared/epics/2025-12-25-Recipe-Collection-Management.md`
- **Master Plan**: `thoughts/shared/plans/2025-12-25-Recipe-Collection-Management-MASTER.md`
- **Spec**: `thoughts/shared/specs/2025-12-25-SimpleKitchen.md`
- **Completed Phases**: Phase 0, Phase 1, Phase 2, Phase 3.1, Phase 3.2
- **Architecture Changes**: sql.js migration (2025-12-28), Native Module Testing Strategy

## Verified Current State (Updated 2025-12-28)

**Fact:** Phase 3.2 implementation is complete with full recipe entry form.  
**Evidence:** `thoughts/shared/plans/2025-12-27-Recipe-Collection-Phase3.2-Complete-Manual-Entry-STATE.md:50`  
**Excerpt:** "Completed: 21 / 27 (20 implementation tasks + 1 automated verification task)"

**Fact:** Database uses dual-client architecture with UUID primary keys.  
**Evidence:** `src/main/database/client.ts:96-101`, `src/main/database/migrations.ts:44`  
**Excerpt:** Production uses better-sqlite3, testing uses sql.js; Recipe IDs are TEXT (UUID) not INTEGER

**Fact:** Recipe DAL provides async getRecipes(filter?) method with partial filtering.  
**Evidence:** `src/main/database/dal/recipes.ts:118-148`  
**Excerpt:**

```typescript
export async function getRecipes(filter?: RecipeFilter): Promise<Recipe[]> {
  let query = db.selectFrom('recipes').selectAll();

  // Filtering for cookingTimeMin/Max, cookwareTypes, sourceTypes implemented
  // Line 135-136 NOTE: dietaryTags and seasonality filtering requires JSON operations (Phase 4)
}
```

**Fact:** Recipe DAL provides async getRecipeById() with string ID parameter.  
**Evidence:** `src/main/database/dal/recipes.ts:87-115`  
**Excerpt:**

```typescript
export async function getRecipeById(id: string): Promise<Recipe | null> {
  const recipeRow = await db
    .selectFrom('recipes')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst();
}
```

**Fact:** RecipeFilter interface exists with specific field naming convention.  
**Evidence:** `src/shared/types/recipe.ts:96-103`  
**Excerpt:**

```typescript
export interface RecipeFilter {
  cookingTimeMin?: number;
  cookingTimeMax?: number;
  cookwareTypes?: CookwareType[];
  dietaryTags?: DietaryTag[]; // Not yet implemented in getRecipes()
  seasonality?: Season[]; // Not yet implemented in getRecipes()
  sourceTypes?: SourceType[];
}
```

**Fact:** Three database indexes already exist from initial migration.  
**Evidence:** `src/main/database/migrations.ts:99-102`  
**Excerpt:**

```sql
CREATE INDEX idx_recipes_cooking_time ON recipes(cooking_time_minutes);
CREATE INDEX idx_recipes_cookware_type ON recipes(cookware_type);
CREATE INDEX idx_recipes_source_type ON recipes(source_type);
```

**Fact:** IPC handlers only expose recipe:create, not getAll/getById/filter.  
**Evidence:** `src/main/ipc/recipe-handlers.ts:1-40`  
**Excerpt:** Only `ipcMain.handle('recipe:create', ...)` registered

**Fact:** electron.d.ts only exposes create method.  
**Evidence:** `src/shared/types/electron.d.ts:13-19`  
**Excerpt:** Only `recipeAPI.create` defined, no getAll/getById/filter

**Fact:** App.tsx only renders AddRecipePage with no navigation.  
**Evidence:** `src/renderer/App.tsx:1-10`  
**Excerpt:** Single component render, no routing or state management

**Fact:** No Phase 4 UI components exist yet.  
**Evidence:** `src/renderer/components/` and `src/renderer/pages/`  
**Excerpt:** Only RecipeForm components and AddRecipePage exist, no RecipeList\* components

**Fact:** Research requires <1 second query performance with 1000+ recipes.  
**Evidence:** `thoughts/shared/research/2025-12-25-Recipe-Collection-Management.md:276-278`  
**Excerpt:** "Proper indexing on filtering columns ensures microsecond query times."

## Goals / Non-Goals

### Goals

- Enable users to view their complete recipe collection
- Implement filtering by cooking time range, cookware type, and dietary tags
- Display recipe details in a dedicated view
- Achieve <1 second query performance with 1000+ recipes through database indexing
- Provide intuitive navigation between Add Recipe and View Recipes
- Create synthetic dataset for load testing (1000-2000 recipes)

### Non-Goals

- Recipe editing (defer to future phase)
- Recipe deletion (defer to future phase)
- Recipe search by text/keywords (defer to future phase)
- Recipe sorting (basic chronological order only)
- Recipe favorites/bookmarks (defer to future phase)
- Recipe export/sharing (defer to future phase)

## Design Overview

### Data Flow

```
User clicks "View Recipes"
  → App.tsx switches to RecipeListPage
  → RecipeListPage renders FilterControls + RecipeGrid
  → FilterControls captures user filter selections (time, cookware, dietary tags)
  → On filter change, RecipeListPage calls window.electron.recipeAPI.filter(filters)
  → IPC handler recipe:filter invokes RecipeDAL.filterRecipes(filters)
  → RecipeDAL builds SQL query with WHERE clauses for each filter
  → Database returns filtered Recipe[] (with indexed query performance)
  → RecipeListPage updates state, RecipeGrid re-renders with filtered results
  → User clicks recipe card → App.tsx switches to RecipeDetailPage
  → RecipeDetailPage calls window.electron.recipeAPI.getById(id)
  → IPC handler recipe:getById invokes RecipeDAL.getRecipeById(id)
  → RecipeDetailPage displays full recipe with ingredients, instructions, metadata
```

### Component Hierarchy

```
App.tsx (navigation state: 'add' | 'list' | 'detail')
├── NavigationBar (new)
│   ├── Button: "Add Recipe"
│   └── Button: "View Recipes"
├── AddRecipePage (existing, from Phase 3)
├── RecipeListPage (new)
│   ├── FilterControls (new)
│   │   ├── TimeRangeFilter (slider: 30-45 minutes)
│   │   ├── CookwareFilter (checkboxes: one-pot, one-pan, oven)
│   │   └── DietaryTagsFilter (checkboxes: 7 dietary tags)
│   └── RecipeGrid (new)
│       └── RecipeCard[] (new, one per recipe)
│           ├── Recipe title
│           ├── Cooking time badge
│           ├── Cookware type icon
│           └── Dietary tags badges
└── RecipeDetailPage (new)
    ├── RecipeHeader (title, metadata)
    ├── RecipeMetadata (time, cookware, servings, tags, seasonality)
    ├── IngredientList (read-only display)
    └── InstructionsSection (optional)
```

### Database Query Strategy

**Filtering Logic:**

- Time filter: `WHERE cooking_time >= ? AND cooking_time <= ?`
- Cookware filter: `WHERE cookware_type IN (?, ?, ?)`
- Dietary tags filter: Use JSON functions to check array membership
  - SQLite: `WHERE json_extract(dietary_tags, '$') LIKE '%gluten-free%'`
  - Or: Store dietary_tags as comma-separated TEXT and use `LIKE '%gluten-free%'`

**Indexing Strategy:**

- Create index on `cooking_time` for range queries
- Create index on `cookware_type` for equality checks
- Create index on `created_at` for chronological ordering
- Dietary tags stored as JSON TEXT (no index needed for MVP, acceptable performance)

**Performance Target:**

- Unfiltered query (all recipes): <10ms for 1000 recipes
- Filtered query (1-3 filters active): <50ms for 1000 recipes
- Single recipe retrieval by ID: <1ms (primary key lookup)

## Implementation Instructions (For Implementor)

---

### PLAN-401: Add recipe:getAll IPC handler

**Change Type:** modify  
**File(s):** `src/main/ipc/recipe-handlers.ts`

**UPDATED**: Changed from `getAllRecipes()` to `getRecipes()`, added async/await

**Instruction:**

1. Import `getRecipes` from `../database/dal/recipes.js`
2. Add new IPC handler inside `registerRecipeHandlers()`:
   ```typescript
   ipcMain.handle('recipe:getAll', async () => {
     try {
       const recipes = await getRecipes(); // No filter = all recipes
       return { success: true, recipe: recipes };
     } catch (error) {
       return {
         success: false,
         errors: [
           { field: 'general', message: error instanceof Error ? error.message : 'Unknown error' },
         ],
       };
     }
   });
   ```

**Evidence:** `src/main/database/dal/recipes.ts:118` shows `async function getRecipes(filter?: RecipeFilter)`  
**Done When:** IPC handler registered, returns `Promise<Recipe[]>` on success, matches existing error pattern from recipe:create

---

### PLAN-402: Add recipe:getById IPC handler

**Change Type:** modify  
**File(s):** `src/main/ipc/recipe-handlers.ts`

**UPDATED**: Changed ID type from `number` to `string`, added async/await

**Instruction:**

1. Import `getRecipeById` from `../database/dal/recipes.js`
2. Add new IPC handler inside `registerRecipeHandlers()`:
   ```typescript
   ipcMain.handle('recipe:getById', async (_event, id: string) => {
     try {
       const recipe = await getRecipeById(id);
       if (!recipe) {
         return {
           success: false,
           errors: [{ field: 'general', message: 'Recipe not found' }],
         };
       }
       return { success: true, recipe };
     } catch (error) {
       return {
         success: false,
         errors: [
           { field: 'general', message: error instanceof Error ? error.message : 'Unknown error' },
         ],
       };
     }
   });
   ```

**Evidence:** `src/main/database/dal/recipes.ts:87` shows `async function getRecipeById(id: string): Promise<Recipe | null>`  
**Done When:** IPC handler registered, accepts string UUID, returns Recipe or error, matches existing error pattern

---

### PLAN-403: Complete dietary tags and seasonality filtering in getRecipes()

**Change Type:** modify  
**File(s):** `src/main/database/dal/recipes.ts`

**UPDATED**: Method already exists as `getRecipes(filter)`, only needs dietary tags and seasonality filtering completed

**Current State:** Lines 118-148 implement partial filtering. Line 135-136 has NOTE: "dietaryTags and seasonality filtering requires JSON operations (Phase 4)"

**Instruction:**

1. Import `sql` from kysely at top if not already imported: `import { sql } from 'kysely';`
2. Locate the `getRecipes()` function around line 118
3. Find the comment at line 135-136: "Note: dietaryTags and seasonality filtering requires JSON operations (Phase 4)"
4. Add dietary tags filtering logic after the sourceTypes filter (before the final execute):

   ```typescript
   // Apply dietary tags filter (check if ALL selected tags are present)
   if (filter.dietaryTags && filter.dietaryTags.length > 0) {
     for (const tag of filter.dietaryTags) {
       // SQLite JSON array contains check using LIKE pattern
       query = query.where(sql`dietary_tags`, 'like', `%"${tag}"%`);
     }
   }

   // Apply seasonality filter (check if ANY selected season matches)
   if (filter.seasonality && filter.seasonality.length > 0) {
     const seasonalityConditions = filter.seasonality.map(
       season => sql`seasonality LIKE ${'%"' + season + '"%'}`
     );
     // Combine with OR logic
     query = query.where(sql`(${sql.join(seasonalityConditions, sql` OR `)})`);
   }
   ```

5. Remove the TODO comment at line 135-136

**Evidence:** `src/main/database/dal/recipes.ts:135-136` shows incomplete implementation  
**Done When:** `getRecipes()` filters by dietaryTags (AND logic) and seasonality (OR logic), comment removed

---

### PLAN-404: Add recipe:filter IPC handler

**Change Type:** modify  
**File(s):** `src/main/ipc/recipe-handlers.ts`

**UPDATED**: Use `getRecipes(filter)` instead of `filterRecipes()`, import `RecipeFilter` from shared types, add async/await

**Instruction:**

1. Import `getRecipes` from `../database/dal/recipes.js`
2. Import `RecipeFilter` from `../../shared/types/recipe.js`
3. Add new IPC handler inside `registerRecipeHandlers()`:
   ```typescript
   ipcMain.handle('recipe:filter', async (_event, filter: RecipeFilter) => {
     try {
       const recipes = await getRecipes(filter);
       return { success: true, recipe: recipes };
     } catch (error) {
       return {
         success: false,
         errors: [
           { field: 'general', message: error instanceof Error ? error.message : 'Unknown error' },
         ],
       };
     }
   });
   ```

**Evidence:** `src/main/database/dal/recipes.ts:118` shows `getRecipes(filter?: RecipeFilter)`, `src/shared/types/recipe.ts:96-103` defines RecipeFilter  
**Done When:** IPC handler registered, accepts RecipeFilter with fields (cookingTimeMin/Max, cookwareTypes, dietaryTags, seasonality, sourceTypes), returns filtered recipes, matches existing error pattern

---

### PLAN-405: Update electron.d.ts with new IPC methods

**Change Type:** modify  
**File(s):** `src/shared/types/electron.d.ts`

**UPDATED**: ID type is `string`, import RecipeFilter from recipe.ts, response format matches existing pattern

**Instruction:**

1. Import RecipeFilter at top:
   ```typescript
   import type { Recipe, CreateRecipeInput, RecipeFilter } from './recipe';
   ```
2. Locate the `recipeAPI` interface (currently around line 13)
3. Add three new methods to the interface:
   ```typescript
   recipeAPI: {
     create: (input: CreateRecipeInput) =>
       Promise<{
         success: boolean;
         recipe?: Recipe;
         errors?: Array<{ field: string; message: string }>;
       }>;
     getAll: () =>
       Promise<{
         success: boolean;
         recipe?: Recipe[];
         errors?: Array<{ field: string; message: string }>;
       }>;
     getById: (id: string) =>
       Promise<{
         success: boolean;
         recipe?: Recipe;
         errors?: Array<{ field: string; message: string }>;
       }>;
     filter: (filter: RecipeFilter) =>
       Promise<{
         success: boolean;
         recipe?: Recipe[];
         errors?: Array<{ field: string; message: string }>;
       }>;
   }
   ```

**Evidence:** `src/shared/types/electron.d.ts:13-19` shows current recipeAPI structure, `src/shared/types/recipe.ts:96-103` defines RecipeFilter  
**Done When:** TypeScript recognizes window.electron.recipeAPI.getAll(), getById(string), filter(RecipeFilter), all return types match existing create pattern

---

### PLAN-406: Expose new IPC methods in preload.ts

**Change Type:** modify  
**File(s):** `src/main/preload.ts`

**UPDATED**: ID parameter type is `string`, filter parameter type is `RecipeFilter`

**Instruction:**

1. Locate the `recipeAPI` object in contextBridge.exposeInMainWorld() (around line 15)
2. Add three new methods to the existing object:
   ```typescript
   recipeAPI: {
     create: (input: CreateRecipeInput) => ipcRenderer.invoke('recipe:create', input),
     getAll: () => ipcRenderer.invoke('recipe:getAll'),
     getById: (id: string) => ipcRenderer.invoke('recipe:getById', id),
     filter: (filter: RecipeFilter) => ipcRenderer.invoke('recipe:filter', filter),
   }
   ```

**Evidence:** `src/main/preload.ts:15-17` shows current recipeAPI with only create method  
**Done When:** Renderer process can call all four recipe IPC methods, getById accepts string UUID, filter accepts RecipeFilter type

---

### PLAN-407: Add created_at index for chronological ordering

**Change Type:** modify  
**File(s):** `src/main/database/migrations.ts`

**UPDATED**: 3 of 4 indexes already exist in migration 001. Only need to add created_at index via new migration.

**Current State:** Lines 99-102 already create indexes for cooking_time, cookware_type, source_type

**Instruction:**

1. Add new migration function after `migration001_initialSchema()` (after line 114):

   ```typescript
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
   ```

2. Update `runMigrations()` function to call new migration (after line 119):
   ```typescript
   export function runMigrations(): void {
     createMigrationsTable();
     migration001_initialSchema();
     migration002_addCreatedAtIndex(); // Add this line
     console.log('All migrations applied');
   }
   ```

**Evidence:** `src/main/database/migrations.ts:99-102` shows existing indexes, line 118-122 shows runMigrations pattern  
**Done When:** New migration creates idx_recipes_created_at index, migration registered in migrations table, runs on database initialization
// Indexes ensure <1 second query performance with 1000+ recipes
// - cooking_time: range queries for time filter
// - cookware_type: equality checks for cookware filter
// - created_at: chronological ordering (newest first)

`````

**Evidence:** `src/main/database/init.ts:24-89` shows table creation pattern
**Done When:** Three indexes created on database initialization, verified with `.schema` in SQLite

---

---

## UI Component Tasks (PLAN-408 to PLAN-416)

**IMPORTANT NOTE FOR ALL UI COMPONENTS**:
- Recipe ID type is `string` (UUID) not `number`
- Recipe fields use camelCase: `cookingTimeMinutes`, `prepTimeMinutes`, `totalTimeMinutes`
- Filter fields use different convention: `cookingTimeMin`, `cookingTimeMax` (not `minCookingTime`, `maxCookingTime`)
- All IPC calls are async and return promises
- RecipeFilter type is defined in `src/shared/types/recipe.ts`

---

### PLAN-408: Create NavigationBar component

**Change Type:** create
**File(s):** `src/renderer/components/common/NavigationBar.tsx`

**UPDATED**: No changes needed, component doesn't use Recipe types directly

**Instruction:**

1. Create new file with this structure:

   ```typescript
   import { Button } from './Button';

   interface NavigationBarProps {
     currentView: 'add' | 'list' | 'detail';
     onNavigate: (view: 'add' | 'list') => void;
   }

   export function NavigationBar({ currentView, onNavigate }: NavigationBarProps) {
     return (
       <nav className="bg-white shadow-sm border-b border-gray-200">
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
           <div className="flex justify-between h-16 items-center">
             <div className="flex items-center space-x-4">
               <h1 className="text-2xl font-bold text-gray-900">SimpleKitchen</h1>
             </div>
             <div className="flex space-x-4">
               <Button
                 onClick={() => onNavigate('add')}
                 variant={currentView === 'add' ? 'primary' : 'secondary'}
               >
                 Add Recipe
               </Button>
               <Button
                 onClick={() => onNavigate('list')}
                 variant={currentView === 'list' ? 'primary' : 'secondary'}
               >
                 View Recipes
               </Button>
             </div>
           </div>
         </div>
       </nav>
     );
   }
   ```

**Evidence:** `src/renderer/components/common/Button.tsx` exists from Phase 3
**Done When:** NavigationBar component renders with two buttons, highlights active view

---

### PLAN-409: Create RecipeCard component

**Change Type:** create
**File(s):** `src/renderer/components/RecipeList/RecipeCard.tsx`

**UPDATED**: ID type changed to `string`, field names changed to camelCase

**Instruction:**

1. Create new directory: `src/renderer/components/RecipeList/`
2. Create RecipeCard.tsx:

   ```typescript
   import type { Recipe } from '../../../shared/types/recipe';

   interface RecipeCardProps {
     recipe: Recipe;
     onClick: (id: string) => void;  // Changed from number to string
   }

   export function RecipeCard({ recipe, onClick }: RecipeCardProps) {
     return (
       <div
         onClick={() => onClick(recipe.id)}
         className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer p-6 border border-gray-200"
       >
         <h3 className="text-xl font-semibold text-gray-900 mb-2">
           {recipe.title}
         </h3>

         <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
           <div className="flex items-center">
             <span className="font-medium">⏱️ {recipe.cookingTimeMinutes} min</span>
           </div>
           <div className="flex items-center">
             <span className="font-medium">
               {recipe.cookwareType === 'one-pot' && '🍲 One Pot'}
               {recipe.cookwareType === 'one-pan' && '🍳 One Pan'}
               {recipe.cookwareType === 'oven' && '🔥 Oven'}
             </span>
           </div>
         </div>

         <div className="flex flex-wrap gap-2">
           {recipe.dietaryTags.map((tag) => (
             <span
               key={tag}
               className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded"
             >
               {tag}
             </span>
           ))}
         </div>
       </div>
     );
   }
   ```

**Evidence:** `src/shared/types/recipe.ts:12-28` defines Recipe interface with string id and cookingTimeMinutes field
**Done When:** RecipeCard displays recipe summary, accepts string ID callback, shows time/cookware/tags using correct field names

---

### PLAN-410: Create RecipeGrid component

**Change Type:** create
**File(s):** `src/renderer/components/RecipeList/RecipeGrid.tsx`

**UPDATED**: ID callback type changed to `string`

**Instruction:**

1. Create RecipeGrid.tsx:

   ```typescript
   import type { Recipe } from '../../../shared/types/recipe';
   import { RecipeCard } from './RecipeCard';

   interface RecipeGridProps {
     recipes: Recipe[];
     onRecipeClick: (id: string) => void;  // Changed from number to string
   }

   export function RecipeGrid({ recipes, onRecipeClick }: RecipeGridProps) {
     if (recipes.length === 0) {
       return (
         <div className="text-center py-12">
           <p className="text-gray-500 text-lg">
             No recipes found. Try adjusting your filters or add a new recipe.
           </p>
         </div>
       );
     }

     return (
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         {recipes.map((recipe) => (
           <RecipeCard
             key={recipe.id}
             recipe={recipe}
             onClick={onRecipeClick}
           />
         ))}
       </div>
     );
   }
   ```

**Evidence:** Tailwind CSS configured in Phase 3, Recipe.id is string type
**Done When:** RecipeGrid renders recipes in responsive grid, shows empty state, passes string IDs to callback

---

### PLAN-411: Create FilterControls component

**Change Type:** create
**File(s):** `src/renderer/components/RecipeList/FilterControls.tsx`

**UPDATED**: FilterState field names changed to match RecipeFilter type (cookingTimeMin/Max not minCookingTime/maxCookingTime)

**Instruction:**

1. Create FilterControls.tsx:

   ```typescript
   import { useState } from 'react';
   import { Checkbox } from '../common/Checkbox';
   import { Button } from '../common/Button';
   import type { CookwareType, DietaryTag, RecipeFilter } from '../../../shared/types/recipe';

   // Local state mirrors RecipeFilter structure
   export interface FilterState {
     cookingTimeMin: number;
     cookingTimeMax: number;
     cookwareTypes: CookwareType[];
     dietaryTags: DietaryTag[];
   }

   interface FilterControlsProps {
     onFilterChange: (filters: FilterState) => void;
   }

   const COOKWARE_OPTIONS: CookwareType[] = ['one-pot', 'one-pan', 'oven'];
   const DIETARY_OPTIONS: DietaryTag[] = [
     'gluten-free',
     'lactose-free',
     'vegetarian',
     'vegan',
     'pescatarian',
     'nut-free',
     'soy-free',
   ];

   export function FilterControls({ onFilterChange }: FilterControlsProps) {
     const [minTime, setMinTime] = useState(30);
     const [maxTime, setMaxTime] = useState(45);
     const [selectedCookware, setSelectedCookware] = useState<CookwareType[]>([]);
     const [selectedDietary, setSelectedDietary] = useState<DietaryTag[]>([]);

     const handleCookwareToggle = (type: CookwareType) => {
       const updated = selectedCookware.includes(type)
         ? selectedCookware.filter((t) => t !== type)
         : [...selectedCookware, type];
       setSelectedCookware(updated);
     };

     const handleDietaryToggle = (tag: DietaryTag) => {
       const updated = selectedDietary.includes(tag)
         ? selectedDietary.filter((t) => t !== tag)
         : [...selectedDietary, tag];
       setSelectedDietary(updated);
     };

     const handleApplyFilters = () => {
       onFilterChange({
         cookingTimeMin: minTime,
         cookingTimeMax: maxTime,
         cookwareTypes: selectedCookware,
         dietaryTags: selectedDietary,
       });
     };

     const handleClearFilters = () => {
       setMinTime(30);
       setMaxTime(45);
       setSelectedCookware([]);
       setSelectedDietary([]);
       onFilterChange({
         cookingTimeMin: 30,
         cookingTimeMax: 45,
         cookwareTypes: [],
         dietaryTags: [],
       });
     };

     return (
       <div className="bg-white rounded-lg shadow-md p-6 mb-6">
         <h2 className="text-lg font-semibold text-gray-900 mb-4">Filter Recipes</h2>

         {/* Cooking Time Range */}
         <div className="mb-6">
           <label className="block text-sm font-medium text-gray-700 mb-2">
             Cooking Time: {minTime}-{maxTime} minutes
           </label>
           <div className="flex items-center space-x-4">
             <input
               type="range"
               min="15"
               max="60"
               value={minTime}
               onChange={(e) => setMinTime(Number(e.target.value))}
               className="flex-1"
             />
             <input
               type="range"
               min="15"
               max="60"
               value={maxTime}
               onChange={(e) => setMaxTime(Number(e.target.value))}
               className="flex-1"
             />
           </div>
         </div>

         {/* Cookware Type */}
         <div className="mb-6">
           <label className="block text-sm font-medium text-gray-700 mb-2">
             Cookware Type
           </label>
           <div className="space-y-2">
             {COOKWARE_OPTIONS.map((type) => (
               <Checkbox
                 key={type}
                 label={type}
                 checked={selectedCookware.includes(type)}
                 onChange={() => handleCookwareToggle(type)}
               />
             ))}
           </div>
         </div>

         {/* Dietary Tags */}
         <div className="mb-6">
           <label className="block text-sm font-medium text-gray-700 mb-2">
             Dietary Tags
           </label>
           <div className="space-y-2">
             {DIETARY_OPTIONS.map((tag) => (
               <Checkbox
                 key={tag}
                 label={tag}
                 checked={selectedDietary.includes(tag)}
                 onChange={() => handleDietaryToggle(tag)}
               />
             ))}
           </div>
         </div>

         {/* Action Buttons */}
         <div className="flex space-x-4">
           <Button onClick={handleApplyFilters} variant="primary">
             Apply Filters
           </Button>
           <Button onClick={handleClearFilters} variant="secondary">
             Clear Filters
           </Button>
         </div>
       </div>
     );
   }
   ```

**Evidence:** `src/renderer/components/common/Checkbox.tsx` exists from Phase 3.2
**Done When:** FilterControls renders all filter options, calls onFilterChange with current state

---

### PLAN-412: Create RecipeListPage

**Change Type:** create
**File(s):** `src/renderer/pages/RecipeListPage.tsx`

**Instruction:**

1. Create RecipeListPage.tsx:

   ```typescript
   import { useState, useEffect } from 'react';
   import { FilterControls, type FilterState } from '../components/RecipeList/FilterControls';
   import { RecipeGrid } from '../components/RecipeList/RecipeGrid';
   import type { Recipe } from '../../shared/types/recipe';

   interface RecipeListPageProps {
     onRecipeClick: (id: number) => void;
   }

   export function RecipeListPage({ onRecipeClick }: RecipeListPageProps) {
     const [recipes, setRecipes] = useState<Recipe[]>([]);
     const [loading, setLoading] = useState(true);
     const [error, setError] = useState<string | null>(null);

     // Load all recipes on mount
     useEffect(() => {
       loadAllRecipes();
     }, []);

     const loadAllRecipes = async () => {
       setLoading(true);
       setError(null);
       try {
         const response = await window.electron.recipeAPI.getAll();
         if (response.success) {
           setRecipes(response.data);
         } else {
           setError(response.error || 'Failed to load recipes');
         }
       } catch (err) {
         setError('Failed to load recipes');
       } finally {
         setLoading(false);
       }
     };

     const handleFilterChange = async (filters: FilterState) => {
       setLoading(true);
       setError(null);
       try {
         const response = await window.electron.recipeAPI.filter({
           minCookingTime: filters.minCookingTime,
           maxCookingTime: filters.maxCookingTime,
           cookwareTypes: filters.cookwareTypes.length > 0 ? filters.cookwareTypes : undefined,
           dietaryTags: filters.dietaryTags.length > 0 ? filters.dietaryTags : undefined,
         });
         if (response.success) {
           setRecipes(response.data);
         } else {
           setError(response.error || 'Failed to filter recipes');
         }
       } catch (err) {
         setError('Failed to filter recipes');
       } finally {
         setLoading(false);
       }
     };

     if (loading) {
       return (
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
           <p className="text-center text-gray-500">Loading recipes...</p>
         </div>
       );
     }

     if (error) {
       return (
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
           <p className="text-center text-red-600">{error}</p>
         </div>
       );
     }

     return (
       <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
         <h1 className="text-3xl font-bold text-gray-900 mb-8">My Recipes</h1>

         <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
           <div className="lg:col-span-1">
             <FilterControls onFilterChange={handleFilterChange} />
           </div>

           <div className="lg:col-span-3">
             <RecipeGrid recipes={recipes} onRecipeClick={onRecipeClick} />
           </div>
         </div>
       </div>
     );
   }
   ```

**Evidence:** `src/renderer/pages/AddRecipePage.tsx` exists from Phase 3
**Done When:** RecipeListPage loads recipes, applies filters, displays grid

---

### PLAN-413: Create RecipeDetailPage

**Change Type:** create
**File(s):** `src/renderer/pages/RecipeDetailPage.tsx`

**Instruction:**

1. Create RecipeDetailPage.tsx:

   ```typescript
   import { useState, useEffect } from 'react';
   import { Button } from '../components/common/Button';
   import type { Recipe } from '../../shared/types/recipe';

   interface RecipeDetailPageProps {
     recipeId: number;
     onBack: () => void;
   }

   export function RecipeDetailPage({ recipeId, onBack }: RecipeDetailPageProps) {
     const [recipe, setRecipe] = useState<Recipe | null>(null);
     const [loading, setLoading] = useState(true);
     const [error, setError] = useState<string | null>(null);

     useEffect(() => {
       loadRecipe();
     }, [recipeId]);

     const loadRecipe = async () => {
       setLoading(true);
       setError(null);
       try {
         const response = await window.electron.recipeAPI.getById(recipeId);
         if (response.success) {
           setRecipe(response.data);
         } else {
           setError(response.error || 'Recipe not found');
         }
       } catch (err) {
         setError('Failed to load recipe');
       } finally {
         setLoading(false);
       }
     };

     if (loading) {
       return (
         <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
           <p className="text-center text-gray-500">Loading recipe...</p>
         </div>
       );
     }

     if (error || !recipe) {
       return (
         <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
           <p className="text-center text-red-600">{error || 'Recipe not found'}</p>
           <div className="text-center mt-4">
             <Button onClick={onBack} variant="secondary">
               Back to Recipes
             </Button>
           </div>
         </div>
       );
     }

     return (
       <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
         <div className="mb-6">
           <Button onClick={onBack} variant="secondary">
             ← Back to Recipes
           </Button>
         </div>

         <div className="bg-white rounded-lg shadow-md p-8">
           {/* Header */}
           <h1 className="text-4xl font-bold text-gray-900 mb-4">{recipe.title}</h1>

           {/* Metadata */}
           <div className="flex flex-wrap gap-4 mb-6 text-sm text-gray-600">
             <div className="flex items-center">
               <span className="font-medium">⏱️ Cooking Time:</span>
               <span className="ml-2">{recipe.cookingTime} minutes</span>
             </div>
             {recipe.prepTime && (
               <div className="flex items-center">
                 <span className="font-medium">🔪 Prep Time:</span>
                 <span className="ml-2">{recipe.prepTime} minutes</span>
               </div>
             )}
             <div className="flex items-center">
               <span className="font-medium">🍽️ Servings:</span>
               <span className="ml-2">{recipe.servings}</span>
             </div>
             <div className="flex items-center">
               <span className="font-medium">
                 {recipe.cookwareType === 'one-pot' && '🍲 One Pot'}
                 {recipe.cookwareType === 'one-pan' && '🍳 One Pan'}
                 {recipe.cookwareType === 'oven' && '🔥 Oven'}
               </span>
             </div>
           </div>

           {/* Dietary Tags */}
           {recipe.dietaryTags.length > 0 && (
             <div className="mb-6">
               <h2 className="text-lg font-semibold text-gray-900 mb-2">Dietary Tags</h2>
               <div className="flex flex-wrap gap-2">
                 {recipe.dietaryTags.map((tag) => (
                   <span
                     key={tag}
                     className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded"
                   >
                     {tag}
                   </span>
                 ))}
               </div>
             </div>
           )}

           {/* Seasonality */}
           {recipe.seasonality.length > 0 && (
             <div className="mb-6">
               <h2 className="text-lg font-semibold text-gray-900 mb-2">Seasonality</h2>
               <div className="flex flex-wrap gap-2">
                 {recipe.seasonality.map((season) => (
                   <span
                     key={season}
                     className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded"
                   >
                     {season}
                   </span>
                 ))}
               </div>
             </div>
           )}

           {/* Ingredients */}
           <div className="mb-6">
             <h2 className="text-2xl font-semibold text-gray-900 mb-4">Ingredients</h2>
             <ul className="space-y-2">
               {recipe.ingredients.map((ingredient, index) => (
                 <li key={index} className="flex items-start">
                   <span className="text-gray-700">
                     {ingredient.quantity} {ingredient.unit} {ingredient.name}
                     {ingredient.optional && (
                       <span className="text-gray-500 italic ml-2">(optional)</span>
                     )}
                   </span>
                 </li>
               ))}
             </ul>
           </div>

           {/* Instructions */}
           {recipe.instructions && (
             <div className="mb-6">
               <h2 className="text-2xl font-semibold text-gray-900 mb-4">Instructions</h2>
               <div className="prose max-w-none text-gray-700 whitespace-pre-wrap">
                 {recipe.instructions}
               </div>
             </div>
           )}

           {/* Source */}
           {recipe.sourceReference && (
             <div className="mt-6 pt-6 border-t border-gray-200">
               <p className="text-sm text-gray-500">
                 Source: <a href={recipe.sourceReference} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{recipe.sourceReference}</a>
               </p>
             </div>
           )}
         </div>
       </div>
     );
   }
   ```

**Evidence:** `src/shared/types/recipe.ts` defines Recipe interface with all fields
**Done When:** RecipeDetailPage displays full recipe details, back button works

---

### PLAN-414: Update App.tsx with navigation logic

**Change Type:** modify
**File(s):** `src/renderer/App.tsx`

**Instruction:**

1. Replace entire file content:

   ```typescript
   import { useState } from 'react';
   import { NavigationBar } from './components/common/NavigationBar';
   import { AddRecipePage } from './pages/AddRecipePage';
   import { RecipeListPage } from './pages/RecipeListPage';
   import { RecipeDetailPage } from './pages/RecipeDetailPage';

   type View = 'add' | 'list' | 'detail';

   export default function App() {
     const [currentView, setCurrentView] = useState<View>('add');
     const [selectedRecipeId, setSelectedRecipeId] = useState<number | null>(null);

     const handleNavigate = (view: 'add' | 'list') => {
       setCurrentView(view);
       setSelectedRecipeId(null);
     };

     const handleRecipeClick = (id: number) => {
       setSelectedRecipeId(id);
       setCurrentView('detail');
     };

     const handleBackToList = () => {
       setCurrentView('list');
       setSelectedRecipeId(null);
     };

     return (
       <div className="min-h-screen bg-gray-50">
         <NavigationBar currentView={currentView} onNavigate={handleNavigate} />

         {currentView === 'add' && <AddRecipePage />}
         {currentView === 'list' && <RecipeListPage onRecipeClick={handleRecipeClick} />}
         {currentView === 'detail' && selectedRecipeId !== null && (
           <RecipeDetailPage recipeId={selectedRecipeId} onBack={handleBackToList} />
         )}
       </div>
     );
   }
   ```

**Evidence:** `src/renderer/App.tsx:1-10` shows current simple structure
**Done When:** App.tsx manages navigation state, renders correct page based on view

---

### PLAN-415: Create RecipeList barrel export

**Change Type:** create
**File(s):** `src/renderer/components/RecipeList/index.ts`

**Instruction:**

1. Create index.ts:
   ```typescript
   export { RecipeCard } from './RecipeCard';
   export { RecipeGrid } from './RecipeGrid';
   export { FilterControls, type FilterState } from './FilterControls';
   ```

**Evidence:** `src/renderer/components/common/index.ts` exists from Phase 3
**Done When:** Components can be imported from `components/RecipeList`

---

### PLAN-416: Update common components barrel export

**Change Type:** modify
**File(s):** `src/renderer/components/common/index.ts`

**Instruction:**

1. Add NavigationBar to exports:
   ```typescript
   export { Button } from './Button';
   export { Input } from './Input';
   export { Select } from './Select';
   export { Checkbox } from './Checkbox';
   export { NavigationBar } from './NavigationBar';
   ```

**Evidence:** `src/renderer/components/common/index.ts` exists from Phase 3.2
**Done When:** NavigationBar can be imported from `components/common`

---

### PLAN-417: Create synthetic dataset generator utility

**Change Type:** create
**File(s):** `src/main/database/seed-data.ts`

**Instruction:**

1. Create seed-data.ts:

   ```typescript
   import { createRecipe } from './dal/recipes';
   import type { RecipeInput } from '../../shared/types/recipe';

   const SAMPLE_RECIPES: RecipeInput[] = [
     {
       title: 'Quick Chicken Stir-Fry',
       cookingTime: 30,
       prepTime: 15,
       cookwareType: 'one-pan',
       servings: 2,
       dietaryTags: ['gluten-free', 'lactose-free'],
       seasonality: ['any'],
       sourceType: 'manual',
       ingredients: [
         { name: 'chicken breast', quantity: 1, unit: 'lb', optional: false },
         { name: 'bell peppers', quantity: 2, unit: 'whole', optional: false },
         { name: 'soy sauce', quantity: 2, unit: 'tbsp', optional: false },
         { name: 'olive oil', quantity: 1, unit: 'tbsp', optional: false },
       ],
       instructions:
         'Heat oil in pan. Cook chicken until done. Add vegetables and sauce. Stir-fry for 5 minutes.',
     },
     {
       title: 'One-Pot Pasta Primavera',
       cookingTime: 35,
       prepTime: 10,
       cookwareType: 'one-pot',
       servings: 2,
       dietaryTags: ['vegetarian', 'lactose-free'],
       seasonality: ['spring', 'summer'],
       sourceType: 'manual',
       ingredients: [
         { name: 'gluten-free pasta', quantity: 8, unit: 'oz', optional: false },
         { name: 'zucchini', quantity: 1, unit: 'whole', optional: false },
         { name: 'cherry tomatoes', quantity: 1, unit: 'cup', optional: false },
         { name: 'olive oil', quantity: 2, unit: 'tbsp', optional: false },
         { name: 'garlic', quantity: 3, unit: 'cloves', optional: false },
       ],
       instructions:
         'Boil pasta with vegetables in one pot. Drain and toss with olive oil and garlic.',
     },
     {
       title: 'Baked Salmon with Vegetables',
       cookingTime: 40,
       prepTime: 10,
       cookwareType: 'oven',
       servings: 2,
       dietaryTags: ['gluten-free', 'lactose-free', 'pescatarian'],
       seasonality: ['any'],
       sourceType: 'manual',
       ingredients: [
         { name: 'salmon fillet', quantity: 12, unit: 'oz', optional: false },
         { name: 'asparagus', quantity: 1, unit: 'bunch', optional: false },
         { name: 'lemon', quantity: 1, unit: 'whole', optional: false },
         { name: 'olive oil', quantity: 2, unit: 'tbsp', optional: false },
       ],
       instructions:
         'Place salmon and vegetables on baking sheet. Drizzle with oil and lemon. Bake at 400°F for 20 minutes.',
     },
     // Add more sample recipes as needed
   ];

   export function seedDatabase(count: number = 10): void {
     console.log(`Seeding database with ${count} recipes...`);

     for (let i = 0; i < count; i++) {
       const recipe = SAMPLE_RECIPES[i % SAMPLE_RECIPES.length];
       const uniqueRecipe = {
         ...recipe,
         title: `${recipe.title} (${i + 1})`,
       };

       try {
         createRecipe(uniqueRecipe);
       } catch (error) {
         console.error(`Failed to seed recipe ${i + 1}:`, error);
       }
     }

     console.log(`Successfully seeded ${count} recipes.`);
   }

   // For manual testing: uncomment to seed on import
   // seedDatabase(50);
   ```

**Evidence:** `src/main/database/dal/recipes.ts:91-200` shows createRecipe() function
**Done When:** seedDatabase() function creates N recipes for testing

---

### PLAN-418: Create performance benchmark script

**Change Type:** create
**File(s):** `src/main/database/benchmark.ts`

**Instruction:**

1. Create benchmark.ts:

   ```typescript
   import { seedDatabase } from './seed-data';
   import { getAllRecipes, filterRecipes } from './dal/recipes';

   export function runPerformanceBenchmark(): void {
     console.log('=== Recipe Database Performance Benchmark ===\n');

     // Seed database with 1000 recipes
     console.log('Seeding database with 1000 recipes...');
     const seedStart = performance.now();
     seedDatabase(1000);
     const seedEnd = performance.now();
     console.log(`Seed time: ${(seedEnd - seedStart).toFixed(2)}ms\n`);

     // Benchmark: Get all recipes
     console.log('Benchmark: getAllRecipes()');
     const getAllStart = performance.now();
     const allRecipes = getAllRecipes();
     const getAllEnd = performance.now();
     console.log(`  - Retrieved ${allRecipes.length} recipes`);
     console.log(`  - Time: ${(getAllEnd - getAllStart).toFixed(2)}ms`);
     console.log(`  - Target: <1000ms ✓\n`);

     // Benchmark: Filter by cooking time
     console.log('Benchmark: filterRecipes({ minCookingTime: 30, maxCookingTime: 40 })');
     const filterTimeStart = performance.now();
     const filteredByTime = filterRecipes({ minCookingTime: 30, maxCookingTime: 40 });
     const filterTimeEnd = performance.now();
     console.log(`  - Retrieved ${filteredByTime.length} recipes`);
     console.log(`  - Time: ${(filterTimeEnd - filterTimeStart).toFixed(2)}ms`);
     console.log(`  - Target: <50ms ✓\n`);

     // Benchmark: Filter by cookware
     console.log('Benchmark: filterRecipes({ cookwareTypes: ["one-pan"] })');
     const filterCookwareStart = performance.now();
     const filteredByCookware = filterRecipes({ cookwareTypes: ['one-pan'] });
     const filterCookwareEnd = performance.now();
     console.log(`  - Retrieved ${filteredByCookware.length} recipes`);
     console.log(`  - Time: ${(filterCookwareEnd - filterCookwareStart).toFixed(2)}ms`);
     console.log(`  - Target: <50ms ✓\n`);

     // Benchmark: Filter by dietary tags
     console.log('Benchmark: filterRecipes({ dietaryTags: ["gluten-free"] })');
     const filterDietaryStart = performance.now();
     const filteredByDietary = filterRecipes({ dietaryTags: ['gluten-free'] });
     const filterDietaryEnd = performance.now();
     console.log(`  - Retrieved ${filteredByDietary.length} recipes`);
     console.log(`  - Time: ${(filterDietaryEnd - filterDietaryStart).toFixed(2)}ms`);
     console.log(`  - Target: <50ms ✓\n`);

     // Benchmark: Complex filter (all criteria)
     console.log(
       'Benchmark: filterRecipes({ minCookingTime: 30, maxCookingTime: 40, cookwareTypes: ["one-pan"], dietaryTags: ["gluten-free"] })'
     );
     const filterComplexStart = performance.now();
     const filteredComplex = filterRecipes({
       minCookingTime: 30,
       maxCookingTime: 40,
       cookwareTypes: ['one-pan'],
       dietaryTags: ['gluten-free'],
     });
     const filterComplexEnd = performance.now();
     console.log(`  - Retrieved ${filteredComplex.length} recipes`);
     console.log(`  - Time: ${(filterComplexEnd - filterComplexStart).toFixed(2)}ms`);
     console.log(`  - Target: <50ms ✓\n`);

     console.log('=== Benchmark Complete ===');
   }

   // For manual testing: uncomment to run on import
   // runPerformanceBenchmark();
   ```

**Evidence:** Research recommends <1s for 1000+ recipes
**Done When:** Benchmark script measures query performance, logs results

---

### PLAN-419: Create unit tests for filterRecipes()

**Change Type:** create
**File(s):** `src/main/database/dal/recipes-filter.test.ts`

**Instruction:**

1. Create recipes-filter.test.ts:

   ```typescript
   import { describe, it, expect, beforeEach, afterEach } from 'vitest';
   import { createRecipe, filterRecipes, getAllRecipes } from './recipes';
   import { initDatabase, closeDatabase } from '../init';
   import type { RecipeInput } from '../../../shared/types/recipe';

   describe('Recipe Filtering', () => {
     beforeEach(() => {
       initDatabase(':memory:');
     });

     afterEach(() => {
       closeDatabase();
     });

     const createTestRecipe = (overrides: Partial<RecipeInput> = {}): void => {
       const baseRecipe: RecipeInput = {
         title: 'Test Recipe',
         cookingTime: 35,
         prepTime: 10,
         cookwareType: 'one-pan',
         servings: 2,
         dietaryTags: ['gluten-free', 'lactose-free'],
         seasonality: ['any'],
         sourceType: 'manual',
         ingredients: [{ name: 'test ingredient', quantity: 1, unit: 'cup', optional: false }],
       };
       createRecipe({ ...baseRecipe, ...overrides });
     };

     it('filters recipes by minimum cooking time', () => {
       createTestRecipe({ title: 'Quick Recipe', cookingTime: 25 });
       createTestRecipe({ title: 'Medium Recipe', cookingTime: 35 });
       createTestRecipe({ title: 'Slow Recipe', cookingTime: 45 });

       const results = filterRecipes({ minCookingTime: 30 });
       expect(results).toHaveLength(2);
       expect(results.map(r => r.title)).toContain('Medium Recipe');
       expect(results.map(r => r.title)).toContain('Slow Recipe');
     });

     it('filters recipes by maximum cooking time', () => {
       createTestRecipe({ title: 'Quick Recipe', cookingTime: 25 });
       createTestRecipe({ title: 'Medium Recipe', cookingTime: 35 });
       createTestRecipe({ title: 'Slow Recipe', cookingTime: 45 });

       const results = filterRecipes({ maxCookingTime: 40 });
       expect(results).toHaveLength(2);
       expect(results.map(r => r.title)).toContain('Quick Recipe');
       expect(results.map(r => r.title)).toContain('Medium Recipe');
     });

     it('filters recipes by cooking time range', () => {
       createTestRecipe({ title: 'Quick Recipe', cookingTime: 25 });
       createTestRecipe({ title: 'Medium Recipe', cookingTime: 35 });
       createTestRecipe({ title: 'Slow Recipe', cookingTime: 45 });

       const results = filterRecipes({ minCookingTime: 30, maxCookingTime: 40 });
       expect(results).toHaveLength(1);
       expect(results[0].title).toBe('Medium Recipe');
     });

     it('filters recipes by cookware type', () => {
       createTestRecipe({ title: 'Pan Recipe', cookwareType: 'one-pan' });
       createTestRecipe({ title: 'Pot Recipe', cookwareType: 'one-pot' });
       createTestRecipe({ title: 'Oven Recipe', cookwareType: 'oven' });

       const results = filterRecipes({ cookwareTypes: ['one-pan', 'oven'] });
       expect(results).toHaveLength(2);
       expect(results.map(r => r.title)).toContain('Pan Recipe');
       expect(results.map(r => r.title)).toContain('Oven Recipe');
     });

     it('filters recipes by dietary tags', () => {
       createTestRecipe({ title: 'GF Recipe', dietaryTags: ['gluten-free'] });
       createTestRecipe({ title: 'LF Recipe', dietaryTags: ['lactose-free'] });
       createTestRecipe({ title: 'Both Recipe', dietaryTags: ['gluten-free', 'lactose-free'] });

       const results = filterRecipes({ dietaryTags: ['gluten-free'] });
       expect(results).toHaveLength(2);
       expect(results.map(r => r.title)).toContain('GF Recipe');
       expect(results.map(r => r.title)).toContain('Both Recipe');
     });

     it('filters recipes by multiple dietary tags (AND logic)', () => {
       createTestRecipe({ title: 'GF Only', dietaryTags: ['gluten-free'] });
       createTestRecipe({ title: 'LF Only', dietaryTags: ['lactose-free'] });
       createTestRecipe({ title: 'Both', dietaryTags: ['gluten-free', 'lactose-free'] });

       const results = filterRecipes({ dietaryTags: ['gluten-free', 'lactose-free'] });
       expect(results).toHaveLength(1);
       expect(results[0].title).toBe('Both');
     });

     it('combines multiple filter criteria', () => {
       createTestRecipe({
         title: 'Match All',
         cookingTime: 35,
         cookwareType: 'one-pan',
         dietaryTags: ['gluten-free'],
       });
       createTestRecipe({
         title: 'Wrong Time',
         cookingTime: 50,
         cookwareType: 'one-pan',
         dietaryTags: ['gluten-free'],
       });
       createTestRecipe({
         title: 'Wrong Cookware',
         cookingTime: 35,
         cookwareType: 'oven',
         dietaryTags: ['gluten-free'],
       });

       const results = filterRecipes({
         minCookingTime: 30,
         maxCookingTime: 40,
         cookwareTypes: ['one-pan'],
         dietaryTags: ['gluten-free'],
       });
       expect(results).toHaveLength(1);
       expect(results[0].title).toBe('Match All');
     });

     it('returns all recipes when no filters applied', () => {
       createTestRecipe({ title: 'Recipe 1' });
       createTestRecipe({ title: 'Recipe 2' });
       createTestRecipe({ title: 'Recipe 3' });

       const results = filterRecipes({});
       expect(results).toHaveLength(3);
     });

     it('returns empty array when no recipes match filters', () => {
       createTestRecipe({ cookingTime: 30 });

       const results = filterRecipes({ minCookingTime: 50 });
       expect(results).toHaveLength(0);
     });

     it('orders results by created_at descending (newest first)', () => {
       createTestRecipe({ title: 'First' });
       createTestRecipe({ title: 'Second' });
       createTestRecipe({ title: 'Third' });

       const results = filterRecipes({});
       expect(results[0].title).toBe('Third');
       expect(results[2].title).toBe('First');
     });
   });
   ```

**Evidence:** `src/main/database/dal/recipes.test.ts` exists with similar test patterns
**Done When:** All filter tests pass, 100% coverage for filterRecipes()

---

### PLAN-420: Create integration test for RecipeListPage

**Change Type:** create
**File(s):** `src/renderer/pages/RecipeListPage.test.tsx`

**Instruction:**

1. Create RecipeListPage.test.tsx:

   ```typescript
   import { describe, it, expect, vi, beforeEach } from 'vitest';
   import { render, screen, waitFor } from '@testing-library/react';
   import userEvent from '@testing-library/user-event';
   import { RecipeListPage } from './RecipeListPage';
   import type { Recipe } from '../../shared/types/recipe';

   const mockRecipes: Recipe[] = [
     {
       id: 1,
       title: 'Test Recipe 1',
       cookingTime: 30,
       prepTime: 10,
       cookwareType: 'one-pan',
       servings: 2,
       dietaryTags: ['gluten-free'],
       seasonality: ['any'],
       sourceType: 'manual',
       sourceReference: null,
       instructions: null,
       createdAt: new Date().toISOString(),
       ingredients: [],
     },
     {
       id: 2,
       title: 'Test Recipe 2',
       cookingTime: 40,
       prepTime: 15,
       cookwareType: 'oven',
       servings: 2,
       dietaryTags: ['lactose-free'],
       seasonality: ['summer'],
       sourceType: 'manual',
       sourceReference: null,
       instructions: null,
       createdAt: new Date().toISOString(),
       ingredients: [],
     },
   ];

   describe('RecipeListPage', () => {
     beforeEach(() => {
       vi.clearAllMocks();

       // Mock window.electron.recipeAPI
       (window as any).electron = {
         recipeAPI: {
           getAll: vi.fn().mockResolvedValue({ success: true, data: mockRecipes }),
           filter: vi.fn().mockResolvedValue({ success: true, data: mockRecipes }),
         },
       };
     });

     it('loads and displays recipes on mount', async () => {
       const onRecipeClick = vi.fn();
       render(<RecipeListPage onRecipeClick={onRecipeClick} />);

       await waitFor(() => {
         expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
         expect(screen.getByText('Test Recipe 2')).toBeInTheDocument();
       });
     });

     it('displays loading state initially', () => {
       const onRecipeClick = vi.fn();
       render(<RecipeListPage onRecipeClick={onRecipeClick} />);

       expect(screen.getByText('Loading recipes...')).toBeInTheDocument();
     });

     it('displays error state on failure', async () => {
       (window as any).electron.recipeAPI.getAll = vi.fn().mockResolvedValue({
         success: false,
         error: 'Database error',
       });

       const onRecipeClick = vi.fn();
       render(<RecipeListPage onRecipeClick={onRecipeClick} />);

       await waitFor(() => {
         expect(screen.getByText('Database error')).toBeInTheDocument();
       });
     });

     it('calls onRecipeClick when recipe card is clicked', async () => {
       const onRecipeClick = vi.fn();
       const user = userEvent.setup();
       render(<RecipeListPage onRecipeClick={onRecipeClick} />);

       await waitFor(() => {
         expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
       });

       await user.click(screen.getByText('Test Recipe 1'));
       expect(onRecipeClick).toHaveBeenCalledWith(1);
     });

     it('applies filters when Apply Filters is clicked', async () => {
       const onRecipeClick = vi.fn();
       const user = userEvent.setup();
       render(<RecipeListPage onRecipeClick={onRecipeClick} />);

       await waitFor(() => {
         expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
       });

       // Click Apply Filters button
       const applyButton = screen.getByText('Apply Filters');
       await user.click(applyButton);

       await waitFor(() => {
         expect((window as any).electron.recipeAPI.filter).toHaveBeenCalled();
       });
     });
   });
   ```

**Evidence:** `src/renderer/components/RecipeForm/RecipeForm.test.tsx` shows testing pattern
**Done When:** RecipeListPage tests pass, cover loading/error/success states

---

### PLAN-421: Create E2E test for recipe viewing workflow

**Change Type:** create
**File(s):** `e2e/recipe-viewing.spec.ts`

**Instruction:**

1. Create recipe-viewing.spec.ts:

   ```typescript
   import { test, expect } from '@playwright/test';

   test.describe('Recipe Viewing and Filtering', () => {
     test.beforeEach(async ({ page }) => {
       await page.goto('http://localhost:5173');

       // Create a test recipe first
       await page.click('text=Add Recipe');
       await page.fill('input[name="title"]', 'E2E Test Recipe');
       await page.fill('input[name="cookingTime"]', '35');
       await page.selectOption('select[name="cookwareType"]', 'one-pan');
       await page.fill('input[name="ingredients[0].name"]', 'test ingredient');
       await page.fill('input[name="ingredients[0].quantity"]', '1');
       await page.fill('input[name="ingredients[0].unit"]', 'cup');
       await page.click('button:has-text("Add Recipe")');

       // Wait for success message
       await expect(page.locator('text=Recipe added successfully')).toBeVisible();
     });

     test('navigates to recipe list and displays recipes', async ({ page }) => {
       // Navigate to View Recipes
       await page.click('text=View Recipes');

       // Verify recipe list page loads
       await expect(page.locator('h1:has-text("My Recipes")')).toBeVisible();

       // Verify test recipe is displayed
       await expect(page.locator('text=E2E Test Recipe')).toBeVisible();
     });

     test('filters recipes by cooking time', async ({ page }) => {
       await page.click('text=View Recipes');

       // Adjust time range sliders
       const minSlider = page.locator('input[type="range"]').first();
       await minSlider.fill('40');

       // Apply filters
       await page.click('button:has-text("Apply Filters")');

       // Verify recipe is filtered out (cooking time 35 < 40)
       await expect(page.locator('text=E2E Test Recipe')).not.toBeVisible();
     });

     test('filters recipes by cookware type', async ({ page }) => {
       await page.click('text=View Recipes');

       // Select only "oven" cookware
       await page.check('label:has-text("oven")');

       // Apply filters
       await page.click('button:has-text("Apply Filters")');

       // Verify recipe is filtered out (cookware is one-pan, not oven)
       await expect(page.locator('text=E2E Test Recipe')).not.toBeVisible();
     });

     test('clears filters and shows all recipes', async ({ page }) => {
       await page.click('text=View Recipes');

       // Apply a filter
       await page.check('label:has-text("oven")');
       await page.click('button:has-text("Apply Filters")');

       // Clear filters
       await page.click('button:has-text("Clear Filters")');

       // Verify recipe is visible again
       await expect(page.locator('text=E2E Test Recipe')).toBeVisible();
     });

     test('navigates to recipe detail page', async ({ page }) => {
       await page.click('text=View Recipes');

       // Click on recipe card
       await page.click('text=E2E Test Recipe');

       // Verify detail page loads
       await expect(page.locator('h1:has-text("E2E Test Recipe")')).toBeVisible();
       await expect(page.locator('text=test ingredient')).toBeVisible();
       await expect(page.locator('text=1 cup')).toBeVisible();
     });

     test('navigates back from detail page to list', async ({ page }) => {
       await page.click('text=View Recipes');
       await page.click('text=E2E Test Recipe');

       // Click back button
       await page.click('button:has-text("Back to Recipes")');

       // Verify back on list page
       await expect(page.locator('h1:has-text("My Recipes")')).toBeVisible();
     });
   });
   ```

**Evidence:** `e2e/manual-entry.spec.ts` exists from Phase 3.2
**Done When:** E2E tests pass, cover navigation and filtering workflows

---

### PLAN-422: Update package.json scripts for benchmarking

**Change Type:** modify
**File(s):** `package.json`

**Instruction:**

1. Add new scripts to the `scripts` section:
   ```json
   "seed:db": "tsx src/main/database/seed-data.ts",
   "benchmark": "tsx src/main/database/benchmark.ts"
   ```
2. Install tsx if not already present: `npm install --save-dev tsx`

**Evidence:** `package.json:7-31` shows existing scripts
**Done When:** `npm run seed:db` and `npm run benchmark` commands work

---

### PLAN-423: Create user documentation for viewing recipes

**Change Type:** modify
**File(s):** `docs/user-guide-manual-entry.md`

**Instruction:**

1. Rename file to `docs/user-guide.md`
2. Add new section after "Adding Recipes Manually":

   ```markdown
   ## Viewing and Filtering Recipes

   ### Accessing Your Recipe Collection

   1. Click the **View Recipes** button in the navigation bar
   2. Your recipe collection will load, displaying all recipes in a grid layout

   ### Understanding Recipe Cards

   Each recipe card shows:

   - **Title**: The name of the recipe
   - **Cooking Time**: Total cooking time in minutes (⏱️)
   - **Cookware Type**: One-pot (🍲), one-pan (🍳), or oven (🔥)
   - **Dietary Tags**: Green badges showing dietary attributes (gluten-free, lactose-free, etc.)

   ### Filtering Recipes

   Use the filter panel on the left to narrow down your recipe collection:

   #### Cooking Time Filter

   - Adjust the two sliders to set minimum and maximum cooking time
   - Range: 15-60 minutes
   - Default: 30-45 minutes

   #### Cookware Type Filter

   - Check one or more cookware types:
     - **one-pot**: Recipes cooked in a single pot
     - **one-pan**: Recipes cooked in a single pan
     - **oven**: Recipes baked in the oven
   - Leave all unchecked to show all cookware types

   #### Dietary Tags Filter

   - Check one or more dietary tags:
     - gluten-free
     - lactose-free
     - vegetarian
     - vegan
     - pescatarian
     - nut-free
     - soy-free
   - Only recipes with ALL selected tags will be shown

   #### Applying Filters

   1. Adjust filter controls to your preferences
   2. Click **Apply Filters** to update the recipe grid
   3. Click **Clear Filters** to reset all filters and show all recipes

   ### Viewing Recipe Details

   1. Click on any recipe card in the grid
   2. The recipe detail page will open, showing:
      - Full recipe title
      - Cooking time, prep time, servings, and cookware type
      - Dietary tags and seasonality
      - Complete ingredient list with quantities and units
      - Cooking instructions (if provided)
      - Source reference (if imported from web)
   3. Click **Back to Recipes** to return to the recipe list

   ### Tips

   - **No recipes found?** Try adjusting your filters or adding more recipes
   - **Performance**: The app can handle 1000+ recipes with fast filtering
   - **Sorting**: Recipes are displayed with newest first
   ```

**Evidence:** `docs/user-guide-manual-entry.md` exists from Phase 3.2
**Done When:** User guide includes comprehensive viewing/filtering documentation

---

### PLAN-424: Create developer documentation for Phase 4

**Change Type:** modify
**File(s):** `docs/dev-guide-phase3.md`

**Instruction:**

1. Rename file to `docs/dev-guide.md`
2. Add new section after Phase 3 content:

   ````markdown
   ## Phase 4: Recipe Viewing & Filtering

   ### Architecture Overview

   Phase 4 adds recipe browsing and filtering capabilities with three new pages:

   - **RecipeListPage**: Main recipe collection view with filtering
   - **RecipeDetailPage**: Full recipe details view
   - **NavigationBar**: App-wide navigation component

   ### Database Layer

   #### New DAL Methods

   **`filterRecipes(filters: RecipeFilters): Recipe[]`**

   - Location: `src/main/database/dal/recipes.ts`
   - Purpose: Query recipes with optional filters
   - Filters:
     - `minCookingTime`: Minimum cooking time in minutes
     - `maxCookingTime`: Maximum cooking time in minutes
     - `cookwareTypes`: Array of cookware types (OR logic)
     - `dietaryTags`: Array of dietary tags (AND logic)
   - Returns: Filtered recipes ordered by `created_at DESC`

   #### Database Indexes

   Three indexes created for performance:

   ```sql
   CREATE INDEX idx_recipes_cooking_time ON recipes(cooking_time);
   CREATE INDEX idx_recipes_cookware_type ON recipes(cookware_type);
   CREATE INDEX idx_recipes_created_at ON recipes(created_at DESC);
   ```
`````

**Performance Targets:**

- Unfiltered query (1000 recipes): <10ms
- Filtered query (1-3 filters): <50ms
- Single recipe by ID: <1ms

### IPC Layer

#### New IPC Handlers

**`recipe:getAll`**

- Returns: `IPCResponse<Recipe[]>`
- Usage: Load all recipes for initial display

**`recipe:getById`**

- Input: `id: number`
- Returns: `IPCResponse<Recipe>`
- Usage: Load single recipe for detail view

**`recipe:filter`**

- Input: `filters: RecipeFilters`
- Returns: `IPCResponse<Recipe[]>`
- Usage: Apply user-selected filters

### UI Components

#### NavigationBar

- Location: `src/renderer/components/common/NavigationBar.tsx`
- Props:
  - `currentView: 'add' | 'list' | 'detail'`
  - `onNavigate: (view: 'add' | 'list') => void`
- Highlights active view

#### RecipeCard

- Location: `src/renderer/components/RecipeList/RecipeCard.tsx`
- Props:
  - `recipe: Recipe`
  - `onClick: (id: number) => void`
- Displays recipe summary with icons and badges

#### RecipeGrid

- Location: `src/renderer/components/RecipeList/RecipeGrid.tsx`
- Props:
  - `recipes: Recipe[]`
  - `onRecipeClick: (id: number) => void`
- Responsive grid layout (1/2/3 columns)
- Empty state when no recipes

#### FilterControls

- Location: `src/renderer/components/RecipeList/FilterControls.tsx`
- Props:
  - `onFilterChange: (filters: FilterState) => void`
- Manages filter state internally
- Calls `onFilterChange` when Apply Filters clicked

### Navigation State Management

**App.tsx** manages navigation state:

```typescript
type View = 'add' | 'list' | 'detail';
const [currentView, setCurrentView] = useState<View>('add');
const [selectedRecipeId, setSelectedRecipeId] = useState<number | null>(null);
```

**Navigation Flow:**

1.  User clicks "View Recipes" → `setCurrentView('list')`
2.  User clicks recipe card → `setSelectedRecipeId(id)`, `setCurrentView('detail')`
3.  User clicks "Back to Recipes" → `setCurrentView('list')`, `setSelectedRecipeId(null)`

### Testing

#### Unit Tests

- `recipes-filter.test.ts`: Tests all filter combinations
- Coverage: 100% for `filterRecipes()` function

#### Integration Tests

- `RecipeListPage.test.tsx`: Tests page loading, filtering, error states

#### E2E Tests

- `recipe-viewing.spec.ts`: Tests full navigation and filtering workflow

### Performance Benchmarking

**Seed Database:**

```bash
npm run seed:db
```

**Run Benchmark:**

```bash
npm run benchmark
```

Benchmark measures:

- Database seeding time (1000 recipes)
- `getAllRecipes()` performance
- `filterRecipes()` with various filter combinations

### Troubleshooting

**Slow filtering with large datasets:**

- Verify indexes exist: `sqlite3 recipes.db ".schema"`
- Check query plan: `EXPLAIN QUERY PLAN SELECT ...`
- Ensure WAL mode enabled: `PRAGMA journal_mode;` should return `wal`

**Recipes not displaying:**

- Check browser console for IPC errors
- Verify `recipe:getAll` handler registered in `main.ts`
- Check database has recipes: `sqlite3 recipes.db "SELECT COUNT(*) FROM recipes;"`

```

```

**Evidence:** `docs/dev-guide-phase3.md` exists from Phase 3.2  
**Done When:** Developer guide includes Phase 4 architecture and troubleshooting

---

## Verification Tasks

### VERIFY-401: Verify recipe list displays correctly

**Manual Test:**

1. Run `npm run dev`
2. Add 2-3 test recipes via Add Recipe page
3. Click "View Recipes" in navigation
4. Verify:
   - Recipe list page loads
   - All recipes display in grid
   - Recipe cards show title, time, cookware, tags
   - No console errors

**Done When:** Recipe list displays all recipes correctly

---

### VERIFY-402: Verify filtering works correctly

**Manual Test:**

1. With 5+ recipes in database (varying times, cookware, tags)
2. Navigate to View Recipes
3. Test time filter:
   - Set min=35, max=40
   - Click Apply Filters
   - Verify only recipes in range shown
4. Test cookware filter:
   - Check "one-pan" only
   - Click Apply Filters
   - Verify only one-pan recipes shown
5. Test dietary filter:
   - Check "gluten-free"
   - Click Apply Filters
   - Verify only gluten-free recipes shown
6. Test Clear Filters:
   - Click Clear Filters
   - Verify all recipes shown again

**Done When:** All filter types work correctly, Clear Filters resets

---

### VERIFY-403: Verify recipe detail page works

**Manual Test:**

1. Navigate to View Recipes
2. Click on a recipe card
3. Verify:
   - Detail page loads
   - Recipe title displayed
   - All metadata shown (time, cookware, servings, tags, seasonality)
   - Ingredient list complete with quantities/units
   - Instructions displayed (if present)
   - Back button works and returns to list

**Done When:** Recipe detail page displays all information correctly

---

### VERIFY-404: Verify navigation between pages

**Manual Test:**

1. Start on Add Recipe page
2. Click "View Recipes" → verify list page loads
3. Click "Add Recipe" → verify add page loads
4. Click "View Recipes" → click recipe → verify detail page loads
5. Click "Back to Recipes" → verify list page loads
6. Verify navigation bar highlights active view

**Done When:** All navigation flows work smoothly

---

### VERIFY-405: Verify performance with 1000+ recipes

**Manual Test:**

1. Run `npm run seed:db` (seeds 50 recipes by default)
2. Edit `src/main/database/seed-data.ts` to seed 1000 recipes
3. Run `npm run benchmark`
4. Verify:
   - `getAllRecipes()` completes in <1000ms
   - `filterRecipes()` completes in <50ms for all filter types
   - Benchmark output shows ✓ for all targets
5. Open app, navigate to View Recipes
6. Verify:
   - Page loads quickly (<2 seconds)
   - Filtering is responsive (<1 second)
   - No lag when scrolling grid

**Done When:** Performance targets met with 1000+ recipes

---

### VERIFY-406: Verify all unit tests pass

**Automated Test:**

```bash
npm run test:unit
```

**Done When:** All unit tests pass, including new `recipes-filter.test.ts`

---

### VERIFY-407: Verify all integration tests pass

**Automated Test:**

```bash
npm run test:integration
```

**Done When:** All integration tests pass, including `RecipeListPage.test.tsx`

---

### VERIFY-408: Verify all E2E tests pass

**Automated Test:**

```bash
npm run test:e2e
```

**Done When:** All E2E tests pass, including `recipe-viewing.spec.ts`

---

## Acceptance Criteria (Phase-Level)

This phase addresses the following epic acceptance criteria:

- [ ] **Epic Functional AC 6**: A user can view their entire recipe collection
- [ ] **Epic Functional AC 7**: A user can filter recipes by time, cookware, and dietary tags
- [ ] **Epic Technical AC 5**: Recipe queries complete in <1 second with 1000+ recipes
- [ ] **Epic Quality AC 4**: Performance tests confirm <1s filtering with 1000+ recipes

## Implementor Checklist

- [ ] PLAN-401: Add recipe:getAll IPC handler (UPDATED: use getRecipes(), async/await)
- [ ] PLAN-402: Add recipe:getById IPC handler (UPDATED: string ID, async/await)
- [ ] PLAN-403: Complete dietary tags/seasonality filtering in getRecipes() (UPDATED: method exists, add JSON filtering)
- [ ] PLAN-404: Add recipe:filter IPC handler (UPDATED: use getRecipes(filter), RecipeFilter type)
- [ ] PLAN-405: Update electron.d.ts with new IPC methods (UPDATED: string IDs, correct field names)
- [ ] PLAN-406: Expose new IPC methods in preload.ts (UPDATED: string IDs)
- [ ] PLAN-407: Add created_at index via migration (UPDATED: 3 indexes exist, add 1 more)
- [ ] PLAN-408: Create NavigationBar component
- [ ] PLAN-409: Create RecipeCard component
- [ ] PLAN-410: Create RecipeGrid component
- [ ] PLAN-411: Create FilterControls component
- [ ] PLAN-412: Create RecipeListPage
- [ ] PLAN-413: Create RecipeDetailPage
- [ ] PLAN-414: Update App.tsx with navigation logic
- [ ] PLAN-415: Create RecipeList barrel export
- [ ] PLAN-416: Update common components barrel export
- [ ] PLAN-417: Create synthetic dataset generator utility
- [ ] PLAN-418: Create performance benchmark script
- [ ] PLAN-419: Create unit tests for filterRecipes()
- [ ] PLAN-420: Create integration test for RecipeListPage
- [ ] PLAN-421: Create E2E test for recipe viewing workflow
- [ ] PLAN-422: Update package.json scripts for benchmarking
- [ ] PLAN-423: Create user documentation for viewing recipes
- [ ] PLAN-424: Create developer documentation for Phase 4
- [ ] VERIFY-401: Verify recipe list displays correctly
- [ ] VERIFY-402: Verify filtering works correctly
- [ ] VERIFY-403: Verify recipe detail page works
- [ ] VERIFY-404: Verify navigation between pages
- [ ] VERIFY-405: Verify performance with 1000+ recipes
- [ ] VERIFY-406: Verify all unit tests pass
- [ ] VERIFY-407: Verify all integration tests pass
- [ ] VERIFY-408: Verify all E2E tests pass

**Total Tasks**: 32 (24 implementation + 8 verification)

---

## Dependencies

**Prerequisites (MUST be complete):**

- Phase 0: Technology stack selection ✓
- Phase 1: Data model and persistence ✓
- Phase 2: Constraint validation ✓
- Phase 3.1: Basic manual entry ✓
- Phase 3.2: Complete manual entry ✓

**Blocks:**

- Phase 5: AI-Powered Recipe Generation (needs recipe viewing for generated recipes)
- Phase 6: Web Recipe Import (needs recipe viewing for imported recipes)

---

## Risk Register

**Risk 1**: Performance degradation with 1000+ recipes  
**Mitigation**: Database indexes created in PLAN-407, benchmark in PLAN-418  
**Status**: Mitigated

**Risk 2**: Complex filter logic with dietary tags (JSON array)  
**Mitigation**: Comprehensive unit tests in PLAN-419  
**Status**: Monitoring

**Risk 3**: Navigation state management complexity  
**Mitigation**: Simple state in App.tsx, tested in E2E  
**Status**: Low risk

**Risk 4**: Slow initial load with many recipes  
**Mitigation**: Lazy loading ingredients only when needed  
**Status**: Monitoring

---

## Notes

- Phase 4 created: 2025-12-27
- Milestone: **MVP 2** - Users can browse and filter their recipe collection
- Next phase: Phase 5 - AI-Powered Recipe Generation
- This phase completes the core recipe management functionality (add + view + filter)
- Future enhancements: text search, sorting, editing, deletion

---

## APPENDIX: Detailed Change Analysis (2025-12-28)

This appendix documents all changes between the original plan (2025-12-27) and this updated version (2025-12-28).

### Architecture Changes

| Component       | Original Assumption    | Current Reality                       | Impact                                 |
| --------------- | ---------------------- | ------------------------------------- | -------------------------------------- |
| Database Client | Single better-sqlite3  | Dual-client (better-sqlite3 + sql.js) | Testing uses sql.js, no rebuild needed |
| Primary Keys    | Auto-increment INTEGER | UUID strings                          | All ID parameters changed to `string`  |
| DAL Methods     | Synchronous            | Async/await                           | All IPC handlers must use `await`      |
| Field Naming    | snake_case everywhere  | camelCase in app types                | Component field references updated     |

### Type System Changes

#### Recipe Interface

```typescript
// Original Plan Assumption
interface Recipe {
  id: number;
  cookingTime: number;
  prepTime: number | null;
  // ...
}

// Current Reality
interface Recipe {
  id: string; // UUID
  cookingTimeMinutes: number;
  prepTimeMinutes: number | null;
  totalTimeMinutes: number;
  // ...
}
```

#### RecipeFilter Interface

```typescript
// Original Plan Assumption
interface RecipeFilters {
  minCookingTime?: number;
  maxCookingTime?: number;
  cookwareTypes?: CookwareType[];
  dietaryTags?: DietaryTag[];
}

// Current Reality
export interface RecipeFilter {
  cookingTimeMin?: number;
  cookingTimeMax?: number;
  cookwareTypes?: CookwareType[];
  dietaryTags?: DietaryTag[];
  seasonality?: Season[];
  sourceTypes?: SourceType[];
}
```

### DAL Method Changes

| Original Plan                               | Current Implementation                                 | Status                                |
| ------------------------------------------- | ------------------------------------------------------ | ------------------------------------- |
| `getAllRecipes(): Recipe[]`                 | `getRecipes(): Promise<Recipe[]>`                      | Exists, use without filter            |
| `getRecipeById(id: number): Recipe \| null` | `getRecipeById(id: string): Promise<Recipe \| null>`   | Exists, ID is string                  |
| `filterRecipes(filters): Recipe[]`          | `getRecipes(filter?: RecipeFilter): Promise<Recipe[]>` | Partial - missing dietary/seasonality |

### Database Schema Changes

#### Field Names

| Plan Assumed   | Actual Database        | Actual App Type           |
| -------------- | ---------------------- | ------------------------- |
| `cooking_time` | `cooking_time_minutes` | `cookingTimeMinutes`      |
| `prep_time`    | `prep_time_minutes`    | `prepTimeMinutes`         |
| N/A            | `total_time_minutes`   | `totalTimeMinutes`        |
| `created_at`   | `created_at`           | `createdAt` (Date object) |
| `updated_at`   | `updated_at`           | `updatedAt` (Date object) |

#### Indexes

| Index                       | Status                  | Location           |
| --------------------------- | ----------------------- | ------------------ |
| `idx_recipes_cooking_time`  | ✅ Exists               | migrations.ts:99   |
| `idx_recipes_cookware_type` | ✅ Exists               | migrations.ts:100  |
| `idx_recipes_source_type`   | ✅ Exists (not in plan) | migrations.ts:101  |
| `idx_recipes_created_at`    | ❌ Missing              | PLAN-407 adds this |
| `idx_ingredients_recipe_id` | ✅ Exists (not in plan) | migrations.ts:102  |

### Task-by-Task Updates

#### IPC Layer

- **PLAN-401**: Changed from `getAllRecipes()` to `await getRecipes()`
- **PLAN-402**: ID parameter `number` → `string`, added async/await
- **PLAN-403**: Method exists, only needs dietaryTags/seasonality JSON filtering added
- **PLAN-404**: Use `await getRecipes(filter)`, import RecipeFilter type
- **PLAN-405**: ID type `string`, filter fields `cookingTimeMin/Max`
- **PLAN-406**: ID type `string`, RecipeFilter type

#### Database

- **PLAN-407**: 3 indexes exist, add migration for `created_at` index only

#### UI Components

All components need these changes:

- Recipe ID callbacks: `(id: number) => void` → `(id: string) => void`
- Recipe fields: `cookingTime` → `cookingTimeMinutes`, `prepTime` → `prepTimeMinutes`
- Filter fields: `minCookingTime` → `cookingTimeMin`, `maxCookingTime` → `cookingTimeMax`

Specific components:

- **PLAN-408** (NavigationBar): No changes needed
- **PLAN-409** (RecipeCard): ID type, field names
- **PLAN-410** (RecipeGrid): ID callback type
- **PLAN-411** (FilterControls): FilterState field names
- **PLAN-412** (RecipeListPage): ID type, IPC response format, async calls
- **PLAN-413** (RecipeDetailPage): ID type, field names, async calls
- **PLAN-414** (App.tsx): selectedRecipeId type `string | null`

#### Testing

- **PLAN-417** (seed data): Use `await createRecipe()`, CreateRecipeInput type, camelCase fields
- **PLAN-418** (benchmark): Use `await getRecipes()`, correct filter field names, all async
- **PLAN-419** (filter tests): Test `getRecipes(filter)`, string IDs, all async, correct field names
- **PLAN-420** (integration tests): String IDs, camelCase field refs
- **PLAN-421** (E2E tests): CamelCase field refs in assertions

### IPC Response Format

All IPC handlers use consistent error format:

```typescript
// Success
{ success: true, recipe: Recipe | Recipe[] }

// Error
{
  success: false,
  errors: Array<{ field: string; message: string }>
}
```

Note: Field is `recipe` not `data` to match existing `recipe:create` handler.

### Incomplete Implementation

**getRecipes() Filtering**: Lines 135-136 of `src/main/database/dal/recipes.ts` note:

```typescript
// Note: dietaryTags and seasonality filtering requires JSON operations (Phase 4)
```

PLAN-403 must implement:

- Dietary tags filtering using SQLite JSON LIKE patterns (AND logic)
- Seasonality filtering using SQLite JSON LIKE patterns (OR logic)

### Testing Environment

Tests automatically use sql.js via environment detection:

```typescript
// src/main/database/client.ts:96-101
if (process.env.VITEST || process.env.NODE_ENV === 'test') {
  return new SqlJsAdapter(dbPath);
}
return new SqliteDatabaseClient(dbPath);
```

No special test configuration needed - Vitest tests run with sql.js automatically.

### Documentation Updates Needed

Original plan references outdated methods and types throughout documentation tasks (PLAN-423, PLAN-424). Updated documentation must use:

- `getRecipes()` not `getAllRecipes()` or `filterRecipes()`
- String UUIDs not integer IDs
- CamelCase field names
- RecipeFilter interface with correct field names
- Dual-client architecture explanation

---

**End of Phase 4 Updated Plan**
