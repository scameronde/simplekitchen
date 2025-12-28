# SimpleKitchen - Developer Guide

## Phase 3: Manual Recipe Entry

### Overview

Phase 3 delivers the first complete user journey: manual recipe entry through a React form UI with IPC communication to the Electron main process.

### Architecture

#### IPC Communication Flow

1. User interacts with RecipeForm (renderer process)
2. Form submits data via `window.electron.recipeAPI.create()`
3. Preload script (`src/main/preload.ts`) bridges to main process via `ipcRenderer.invoke('recipe:create')`
4. Main process handler (`src/main/ipc/recipe-handlers.ts`) receives request
5. Handler calls validation system and DAL
6. Response returned to renderer with success/errors
7. Renderer displays result

#### Component Hierarchy

```
App
└── AddRecipePage
    └── RecipeForm (orchestrator)
        ├── ValidationErrors
        ├── RecipeBasicInfo
        │   ├── Input (title, cooking time, prep time)
        │   └── Select (cookware type)
        ├── RecipeDietaryTags
        │   └── Checkbox[] (7 dietary tags)
        ├── RecipeSeasonality
        │   └── Checkbox[] (5 seasons)
        ├── IngredientList
        │   ├── IngredientRow[] (dynamic)
        │   └── Button (add ingredient)
        ├── Textarea (instructions)
        └── Button (submit)
```

### Key Components

#### RecipeForm (`src/renderer/components/RecipeForm/RecipeForm.tsx`)

- Main orchestrator component
- Manages all form state
- Handles submission and error display
- Resets form on success

#### IPC Handler (`src/main/ipc/recipe-handlers.ts`)

- Handles `recipe:create` IPC channel
- Calls validation and DAL
- Parses validation errors into structured format
- Returns success/error response

#### Ingredient Classifier (`src/renderer/utils/ingredient-classifier.ts`)

- Determines dietary properties for ingredients
- Used during form submission to classify ingredients
- Syncs with main process ingredient database

### Testing Strategy

#### Unit Tests

- `recipe-handlers.test.ts`: IPC handler logic and error parsing
- `ingredient-classifier.test.ts`: Dietary property determination

#### Integration Tests

- `RecipeForm.test.tsx`: Full form submission flow with mocked IPC

#### E2E Tests

- `e2e/manual-entry.spec.ts`: End-to-end workflow with real Electron app

### Running Tests

```bash
# All tests
npm run test:all

# Unit tests only
npm run test:unit

# Integration tests only (renderer components)
npm run test:integration

# E2E tests only
npm run test:e2e

# E2E with UI
npm run test:e2e:ui
```

### Development Workflow

```bash
# Install dependencies
npm install

# Rebuild native modules for Electron (required after npm install)
npx @electron/rebuild -f

# Run in development mode (hot reload)
npm run dev

# Build for production
npm run build

# Run production build
npm start

# Run linter
npm run lint

# Format code
npm run format
```

### Build Configuration

#### TypeScript Configuration

The project uses ES modules with TypeScript. Key configuration points:

**`tsconfig.main.json`** (Main process):

```json
{
  "compilerOptions": {
    "outDir": "dist", // Output to dist/main/*, dist/shared/*
    "rootDir": "src", // Source root to preserve structure
    "module": "ESNext", // ES modules
    "noEmit": false // Actually emit files
  },
  "include": ["src/main/**/*", "src/shared/**/*"]
}
```

**Important**: All imports in the main process must use `.js` extensions:

```typescript
// Correct
import { db } from './database/index.js';
import type { Recipe } from '../../shared/types/recipe.js';

// Incorrect
import { db } from './database';
import type { Recipe } from '../../shared/types/recipe';
```

This is required because Node.js ES modules need explicit file extensions.

#### Development Mode Detection

The main process detects development mode using two checks:

```typescript
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
```

- `NODE_ENV=development`: Set by `cross-env` in dev script
- `!app.isPackaged`: Fallback - true when running from source

In dev mode:

- Loads renderer from Vite dev server (`http://localhost:5173`)
- Opens DevTools automatically

In production mode:

- Loads renderer from `dist/renderer/index.html`
- No DevTools

#### Native Modules

**better-sqlite3** is used in production and development mode:

- Version: `12.5.0` (required for Electron 39)
- Automatically rebuilt for Electron via postinstall hook
- Manual rebuild: `npx @electron/rebuild -f`

**Testing Environment:**

Tests use **sql.js** (pure JavaScript) instead of better-sqlite3:

- ✅ No native module compilation required for `npm test`
- ✅ Fast CI/CD execution without C++ build tools
- ✅ Identical SQL behavior via `IDatabaseClient` abstraction
- Factory function in `src/main/database/client.ts` switches based on environment

**When native module rebuild is needed:**

- Running `npm run dev` (development mode with Electron)
- Running `npm run test:e2e` (E2E tests use real Electron)
- Creating production builds with `npm run package`

**When native module rebuild is NOT needed:**

- Running `npm test` (unit/integration tests use sql.js)
- Running `npm run test:watch` (watch mode also uses sql.js)
- CI/CD pipelines running unit tests only

**Troubleshooting native module issues** (for dev/E2E/production only):

1. Check Electron version matches better-sqlite3 compatibility
2. Ensure C++ build tools installed (gcc, make, Python)
3. Clear node-gyp cache: `rm -rf ~/.electron-gyp`
4. Reinstall and rebuild: `npm install && npx @electron/rebuild -f`

### Common Issues

#### Issue: Empty window when running `npm run dev`

**Cause**: Development mode not properly detected, or renderer trying to load wrong URL.

**Solution**:

1. Ensure `NODE_ENV=development` is set in dev script (uses `cross-env`)
2. Check `main.ts` uses `!app.isPackaged` as fallback for dev mode detection
3. Verify Vite dev server is running on port 5173
4. Check that production path uses `index.html` not `index.html.js`

#### Issue: Module resolution errors with ES modules

**Cause**: TypeScript ES modules require explicit `.js` file extensions in imports.

**Solution**:

1. All relative imports in `src/main/` must include `.js` extension
2. Example: `import { db } from './init.js'` not `'./init'`
3. This applies even though source files are `.ts` - the extension refers to the compiled output

#### Issue: better-sqlite3 native module version mismatch

**Cause**: Native module was compiled for different Node.js/Electron version.

**Solution**:

```bash
# Rebuild native modules for Electron
npx @electron/rebuild -f

# Or if that fails, ensure compatible version
npm install --save-exact better-sqlite3@12.5.0
npx @electron/rebuild -f
```

**Note**: better-sqlite3 v12.5.0+ is required for Electron 39 compatibility.

#### Issue: TypeScript compiling to wrong output directory

**Cause**: Incorrect `rootDir` and `outDir` in `tsconfig.main.json`.

**Solution**: Ensure `tsconfig.main.json` has:

```json
{
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/main/**/*", "src/shared/**/*"]
}
```

#### Issue: Tailwind classes not applying

**Solution**: Ensure PostCSS config is correct, restart Vite dev server

#### Issue: IPC calls return undefined

**Solution**:

1. Check preload script is loaded in BrowserWindow options
2. Verify contextBridge exposes API correctly
3. Check TypeScript types match between preload and electron.d.ts

#### Issue: Validation errors not displaying

**Solution**: Verify error parsing in `recipe-handlers.ts` matches validation error format from `validator.ts`

#### Issue: Form state not updating

**Solution**: Check that state setters are called correctly, especially for nested objects/arrays

### Architecture Decisions

#### Why IPC instead of direct database access?

- Security: Renderer process should not have direct database access
- Separation of concerns: Main process handles all business logic
- Type safety: IPC boundaries enforce clean interfaces

#### Why Tailwind CSS?

- Rapid UI development without custom CSS files
- Consistent design system
- Small bundle size (only used classes are included)

#### Why separate components for form sections?

- Maintainability: Each section is independently testable
- Reusability: Components can be reused in edit forms (Phase 4+)
- Clarity: Clear separation of concerns

### Troubleshooting Guide

#### Seeing old/cached UI (wrong dietary tags, outdated components)

**Symptoms**: UI shows old content even after updating source code.

**Cause**: Vite dev server or compiled dist files are cached/stale.

**Solution**:

```bash
# Stop all running processes
pkill -f electron
pkill -f vite

# Clean build
rm -rf dist/
npm run build

# Restart dev server
npm run dev
```

#### `ERR_MODULE_NOT_FOUND` errors when running app

**Symptoms**: Node.js can't find modules, error mentions `.js` extension missing.

**Cause**: ES module imports missing `.js` extensions.

**Solution**: Add `.js` to all relative imports in `src/main/`:

```typescript
// Before
import { validateRecipe } from './validator';

// After
import { validateRecipe } from './validator.js';
```

#### `NODE_MODULE_VERSION` mismatch error

**Symptoms**:

```
was compiled against a different Node.js version using NODE_MODULE_VERSION 141.
This version of Node.js requires NODE_MODULE_VERSION 140.
```

**Cause**: better-sqlite3 compiled for system Node.js instead of Electron.

**Solution**:

```bash
npx @electron/rebuild -f
```

If that fails, ensure you have the correct version:

```bash
npm install --save-exact better-sqlite3@12.5.0
npx @electron/rebuild -f
```

#### Build outputs to wrong directory (nested `dist/main/main/`)

**Symptoms**: TypeScript creates `dist/main/main/main.js` instead of `dist/main/main.js`.

**Cause**: `rootDir` not set in `tsconfig.main.json`.

**Solution**: Set `rootDir: "src"` in `tsconfig.main.json` to preserve structure correctly.

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

## Contributing

When adding features:

1. Follow existing component patterns
2. Add TypeScript types for all props and state
3. Write unit/integration tests
4. Update documentation
5. Test manually before committing
6. Remember to use `.js` extensions in ES module imports
7. Rebuild native modules after dependency changes
