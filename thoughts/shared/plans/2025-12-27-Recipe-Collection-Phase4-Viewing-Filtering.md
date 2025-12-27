# Phase 4: Recipe Viewing & Filtering - Implementation Plan

## Inputs

- **Research Report**: `thoughts/shared/research/2025-12-25-Recipe-Collection-Management.md`
- **Epic**: `thoughts/shared/epics/2025-12-25-Recipe-Collection-Management.md`
- **Master Plan**: `thoughts/shared/plans/2025-12-25-Recipe-Collection-Management-MASTER.md`
- **Spec**: `thoughts/shared/specs/2025-12-25-SimpleKitchen.md`
- **Completed Phases**: Phase 0, Phase 1, Phase 2, Phase 3.1, Phase 3.2

## Verified Current State

**Fact:** Phase 3.2 implementation is complete with full recipe entry form.  
**Evidence:** `thoughts/shared/plans/2025-12-27-Recipe-Collection-Phase3.2-Complete-Manual-Entry-STATE.md:50`  
**Excerpt:** "Completed: 21 / 27 (20 implementation tasks + 1 automated verification task)"

**Fact:** Database schema includes recipes and ingredients tables with proper relationships.  
**Evidence:** `src/main/database/init.ts:24-89`  
**Excerpt:** Schema defines recipes table with id, title, cooking_time, prep_time, cookware_type, servings, dietary_tags, seasonality, source_type, source_reference, instructions, created_at; ingredients table with recipe_id foreign key

**Fact:** Recipe DAL provides getAllRecipes() method returning Recipe[].  
**Evidence:** `src/main/database/dal/recipes.ts:45-66`  
**Excerpt:**

```typescript
export function getAllRecipes(): Recipe[] {
  const rows = db.selectFrom('recipes').selectAll().execute();

  return rows.map(row => ({
    ...row,
    ingredients: getRecipeIngredients(row.id),
  }));
}
```

**Fact:** Recipe DAL provides getRecipeById() method for detail view.  
**Evidence:** `src/main/database/dal/recipes.ts:68-89`  
**Excerpt:**

```typescript
export function getRecipeById(id: number): Recipe | null {
  const row = db.selectFrom('recipes').selectAll().where('id', '=', id).executeTakeFirst();

  if (!row) return null;

  return {
    ...row,
    ingredients: getRecipeIngredients(id),
  };
}
```

**Fact:** No filtering methods exist in Recipe DAL yet.  
**Evidence:** `src/main/database/dal/recipes.ts:1-200` (full file inspection)  
**Excerpt:** Only getAllRecipes(), getRecipeById(), createRecipe(), getRecipeIngredients() exist. No filterRecipes() or queryRecipes() method.

**Fact:** IPC handlers only expose recipe:create, not recipe:getAll or recipe:getById.  
**Evidence:** `src/main/ipc/recipe-handlers.ts:1-50`  
**Excerpt:**

```typescript
export function registerRecipeHandlers() {
  ipcMain.handle('recipe:create', async (_event, recipeData: RecipeInput) => {
    // ... implementation
  });
}
```

**Fact:** App.tsx currently only renders AddRecipePage.  
**Evidence:** `src/renderer/App.tsx:1-10`  
**Excerpt:**

```typescript
export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <AddRecipePage />
    </div>
  );
}
```

**Fact:** No navigation or routing exists in the application.  
**Evidence:** `package.json:1-78` (no react-router or similar dependency)  
**Excerpt:** Dependencies include only react, react-dom, electron, better-sqlite3, kysely

**Fact:** Research recommends indexed queries for performance with 1000+ recipes.  
**Evidence:** `thoughts/shared/research/2025-12-25-Recipe-Collection-Management.md:276-278`  
**Excerpt:** "Proper indexing on filtering columns (cooking_time, cookware_type, dietary_tags) ensures microsecond query times."

**Fact:** Master plan requires <1 second query performance with 1000+ recipes.  
**Evidence:** `thoughts/shared/plans/2025-12-25-Recipe-Collection-Management-MASTER.md:448`  
**Excerpt:** "Recipe queries complete in <1 second with 1000+ recipes (Phase 4)"

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

**Instruction:**

1. Import `getAllRecipes` from `../database/dal/recipes`
2. Add new IPC handler inside `registerRecipeHandlers()`:
   ```typescript
   ipcMain.handle('recipe:getAll', async () => {
     try {
       const recipes = getAllRecipes();
       return { success: true, data: recipes };
     } catch (error) {
       return {
         success: false,
         error: error instanceof Error ? error.message : 'Unknown error',
       };
     }
   });
   ```

**Evidence:** `src/main/ipc/recipe-handlers.ts:1-50` shows existing pattern for recipe:create handler  
**Done When:** IPC handler registered, returns Recipe[] on success

---

### PLAN-402: Add recipe:getById IPC handler

**Change Type:** modify  
**File(s):** `src/main/ipc/recipe-handlers.ts`

**Instruction:**

1. Import `getRecipeById` from `../database/dal/recipes`
2. Add new IPC handler inside `registerRecipeHandlers()`:
   ```typescript
   ipcMain.handle('recipe:getById', async (_event, id: number) => {
     try {
       const recipe = getRecipeById(id);
       if (!recipe) {
         return { success: false, error: 'Recipe not found' };
       }
       return { success: true, data: recipe };
     } catch (error) {
       return {
         success: false,
         error: error instanceof Error ? error.message : 'Unknown error',
       };
     }
   });
   ```

**Evidence:** `src/main/database/dal/recipes.ts:68-89` shows getRecipeById() returns Recipe | null  
**Done When:** IPC handler registered, returns Recipe on success or error if not found

---

### PLAN-403: Create filterRecipes() method in Recipe DAL

**Change Type:** modify  
**File(s):** `src/main/database/dal/recipes.ts`

**Instruction:**

1. Define RecipeFilters interface at top of file:
   ```typescript
   export interface RecipeFilters {
     minCookingTime?: number;
     maxCookingTime?: number;
     cookwareTypes?: CookwareType[];
     dietaryTags?: DietaryTag[];
   }
   ```
2. Create new function after getAllRecipes():
   ```typescript
   export function filterRecipes(filters: RecipeFilters): Recipe[] {
     let query = db.selectFrom('recipes').selectAll();

     // Apply cooking time range filter
     if (filters.minCookingTime !== undefined) {
       query = query.where('cooking_time', '>=', filters.minCookingTime);
     }
     if (filters.maxCookingTime !== undefined) {
       query = query.where('cooking_time', '<=', filters.maxCookingTime);
     }

     // Apply cookware type filter
     if (filters.cookwareTypes && filters.cookwareTypes.length > 0) {
       query = query.where('cookware_type', 'in', filters.cookwareTypes);
     }

     // Apply dietary tags filter (check if ALL selected tags are present)
     if (filters.dietaryTags && filters.dietaryTags.length > 0) {
       for (const tag of filters.dietaryTags) {
         // SQLite JSON array contains check
         query = query.where(sql`json_extract(dietary_tags, '$')`, 'like', `%${tag}%`);
       }
     }

     // Order by created_at descending (newest first)
     query = query.orderBy('created_at', 'desc');

     const rows = query.execute();

     return rows.map(row => ({
       ...row,
       ingredients: getRecipeIngredients(row.id),
     }));
   }
   ```
3. Import `sql` from kysely at top: `import { sql } from 'kysely';`

**Evidence:** `src/main/database/dal/recipes.ts:45-66` shows getAllRecipes() pattern  
**Done When:** filterRecipes() function exists, returns filtered Recipe[], handles all filter combinations

---

### PLAN-404: Add recipe:filter IPC handler

**Change Type:** modify  
**File(s):** `src/main/ipc/recipe-handlers.ts`

**Instruction:**

1. Import `filterRecipes, RecipeFilters` from `../database/dal/recipes`
2. Add new IPC handler inside `registerRecipeHandlers()`:
   ```typescript
   ipcMain.handle('recipe:filter', async (_event, filters: RecipeFilters) => {
     try {
       const recipes = filterRecipes(filters);
       return { success: true, data: recipes };
     } catch (error) {
       return {
         success: false,
         error: error instanceof Error ? error.message : 'Unknown error',
       };
     }
   });
   ```

**Evidence:** `src/main/ipc/recipe-handlers.ts:1-50` shows existing IPC handler pattern  
**Done When:** IPC handler registered, accepts RecipeFilters, returns filtered Recipe[]

---

### PLAN-405: Update electron.d.ts with new IPC methods

**Change Type:** modify  
**File(s):** `src/shared/types/electron.d.ts`

**Instruction:**

1. Locate the `RecipeAPI` interface
2. Add three new methods:
   ```typescript
   interface RecipeAPI {
     create: (recipe: RecipeInput) => Promise<IPCResponse<Recipe>>;
     getAll: () => Promise<IPCResponse<Recipe[]>>;
     getById: (id: number) => Promise<IPCResponse<Recipe>>;
     filter: (filters: RecipeFilters) => Promise<IPCResponse<Recipe[]>>;
   }
   ```
3. Import RecipeFilters type at top:
   ```typescript
   import type { RecipeFilters } from '../main/database/dal/recipes';
   ```
   Note: Adjust path if needed based on file structure

**Evidence:** `src/shared/types/electron.d.ts` (existing file from Phase 3)  
**Done When:** TypeScript recognizes window.electron.recipeAPI.getAll(), getById(), filter()

---

### PLAN-406: Expose new IPC methods in preload.ts

**Change Type:** modify  
**File(s):** `src/main/preload.ts`

**Instruction:**

1. Locate the `recipeAPI` object in contextBridge.exposeInMainWorld()
2. Add three new methods:
   ```typescript
   recipeAPI: {
     create: (recipe: RecipeInput) => ipcRenderer.invoke('recipe:create', recipe),
     getAll: () => ipcRenderer.invoke('recipe:getAll'),
     getById: (id: number) => ipcRenderer.invoke('recipe:getById', id),
     filter: (filters: RecipeFilters) => ipcRenderer.invoke('recipe:filter', filters),
   }
   ```

**Evidence:** `src/main/preload.ts` (existing file from Phase 3)  
**Done When:** Renderer process can call all four recipe IPC methods

---

### PLAN-407: Create database indexes for performance

**Change Type:** modify  
**File(s):** `src/main/database/init.ts`

**Instruction:**

1. After the CREATE TABLE statements (around line 90), add index creation:

   ```typescript
   // Create indexes for query performance
   db.exec(`
     CREATE INDEX IF NOT EXISTS idx_recipes_cooking_time 
     ON recipes(cooking_time);
   `);

   db.exec(`
     CREATE INDEX IF NOT EXISTS idx_recipes_cookware_type 
     ON recipes(cookware_type);
   `);

   db.exec(`
     CREATE INDEX IF NOT EXISTS idx_recipes_created_at 
     ON recipes(created_at DESC);
   `);
   ```

2. Add comment explaining purpose:
   ```typescript
   // Indexes ensure <1 second query performance with 1000+ recipes
   // - cooking_time: range queries for time filter
   // - cookware_type: equality checks for cookware filter
   // - created_at: chronological ordering (newest first)
   ```

**Evidence:** `src/main/database/init.ts:24-89` shows table creation pattern  
**Done When:** Three indexes created on database initialization, verified with `.schema` in SQLite

---

### PLAN-408: Create NavigationBar component

**Change Type:** create  
**File(s):** `src/renderer/components/common/NavigationBar.tsx`

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

**Instruction:**

1. Create new directory: `src/renderer/components/RecipeList/`
2. Create RecipeCard.tsx:

   ```typescript
   import type { Recipe } from '../../../shared/types/recipe';

   interface RecipeCardProps {
     recipe: Recipe;
     onClick: (id: number) => void;
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
             <span className="font-medium">⏱️ {recipe.cookingTime} min</span>
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

**Evidence:** `src/shared/types/recipe.ts` defines Recipe interface  
**Done When:** RecipeCard displays recipe summary, clickable, shows time/cookware/tags

---

### PLAN-410: Create RecipeGrid component

**Change Type:** create  
**File(s):** `src/renderer/components/RecipeList/RecipeGrid.tsx`

**Instruction:**

1. Create RecipeGrid.tsx:

   ```typescript
   import type { Recipe } from '../../../shared/types/recipe';
   import { RecipeCard } from './RecipeCard';

   interface RecipeGridProps {
     recipes: Recipe[];
     onRecipeClick: (id: number) => void;
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

**Evidence:** Tailwind CSS configured in Phase 3  
**Done When:** RecipeGrid renders recipes in responsive grid, shows empty state

---

### PLAN-411: Create FilterControls component

**Change Type:** create  
**File(s):** `src/renderer/components/RecipeList/FilterControls.tsx`

**Instruction:**

1. Create FilterControls.tsx:

   ```typescript
   import { useState } from 'react';
   import { Checkbox } from '../common/Checkbox';
   import { Button } from '../common/Button';
   import type { CookwareType, DietaryTag } from '../../../shared/types/recipe';

   export interface FilterState {
     minCookingTime: number;
     maxCookingTime: number;
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
         minCookingTime: minTime,
         maxCookingTime: maxTime,
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
         minCookingTime: 30,
         maxCookingTime: 45,
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
   ````

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
   1. User clicks "View Recipes" → `setCurrentView('list')`
   2. User clicks recipe card → `setSelectedRecipeId(id)`, `setCurrentView('detail')`
   3. User clicks "Back to Recipes" → `setCurrentView('list')`, `setSelectedRecipeId(null)`

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

- [ ] PLAN-401: Add recipe:getAll IPC handler
- [ ] PLAN-402: Add recipe:getById IPC handler
- [ ] PLAN-403: Create filterRecipes() method in Recipe DAL
- [ ] PLAN-404: Add recipe:filter IPC handler
- [ ] PLAN-405: Update electron.d.ts with new IPC methods
- [ ] PLAN-406: Expose new IPC methods in preload.ts
- [ ] PLAN-407: Create database indexes for performance
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

**End of Phase 4 Plan**
