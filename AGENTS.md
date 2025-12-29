# AGENTS.md - SimpleKitchen Development Guide

This document provides essential information for AI coding agents working in this repository.

## Build, Lint, and Test Commands

### Build Commands

```bash
npm run build              # Build both main and renderer processes
npm run build:main         # Build main process only (TypeScript)
npm run build:renderer     # Build renderer process only (Vite)
npm run typecheck          # Type-check without emitting files
```

### Development Commands

```bash
npm run dev                # Run app in development mode with hot reload
npm run watch:main         # Watch main process (TypeScript)
npm run watch:renderer     # Watch renderer process (Vite)
npm start                  # Launch built application
```

### Linting and Formatting

```bash
npm run lint               # Check code for linting errors
npm run lint:fix           # Auto-fix linting errors
npm run format             # Format code with Prettier
npm run format:check       # Check code formatting without changes
```

### Testing Commands

```bash
npm test                   # Run all unit tests (vitest)
npm run test:watch         # Run tests in watch mode
npm run test:coverage      # Generate coverage report
npm run test:unit          # Run unit tests only
npm run test:integration   # Run integration tests (renderer)
npm run test:db            # Run database tests only
npm run test:db:watch      # Watch database tests
npm run test:e2e           # Run E2E tests (Playwright)
npm run test:e2e:ui        # Run E2E tests with UI
npm run test:all           # Run unit, integration, and E2E tests

# Run a single test file
npx vitest run src/main/database/dal/recipes.test.ts
npx vitest src/main/database/dal/recipes.test.ts  # watch mode

# Run a single E2E test
npx playwright test e2e/manual-entry.spec.ts
npx playwright test e2e/manual-entry.spec.ts --ui  # with UI

# Run specific test case
npx vitest run -t "should create recipe"
npx playwright test -g "should add a recipe"
```

### Other Commands

```bash
npm run package            # Create distributable package
npm run seed:db            # Seed database with sample data
npm run benchmark          # Run database benchmarks
```

## Project Structure

```
simplekitchen/
├── src/
│   ├── main/              # Electron main process (Node.js backend)
│   │   ├── database/      # Database layer (Kysely + SQLite)
│   │   ├── ipc/           # IPC handlers for renderer communication
│   │   └── validation/    # Business logic validation
│   ├── renderer/          # React UI (browser frontend)
│   │   ├── components/    # React components
│   │   ├── pages/         # Page-level components
│   │   ├── styles/        # CSS files
│   │   └── utils/         # Frontend utilities
│   └── shared/            # Shared types and constants
│       ├── types/         # TypeScript type definitions
│       └── constants/     # Shared constants
├── e2e/                   # Playwright E2E tests
├── thoughts/              # Documentation, plans, specs
└── dist/                  # Build output
```

## Code Style Guidelines

### TypeScript Configuration

- **Strict mode enabled**: All strict TypeScript checks are enforced
- **Target**: ES2022
- **Module**: ESNext with bundler resolution
- **No unused locals/parameters**: Must use or prefix with underscore
- **No unchecked indexed access**: Array/object access returns `T | undefined`

### Import Conventions

```typescript
// Always use type-only imports for types
import type { Recipe, CreateRecipeInput } from '../types/recipe.js';
import type { ValidationError } from '../types/validation.js';

// Use named imports for code
import { createRecipe, getRecipeById } from './recipes.js';
import { validateRecipe } from '../validation/index.js';

// Always include .js extension for relative imports in main process
import { db } from '../init.js';
import { runMigrations } from '../index.js';

// Path aliases available
import type { Recipe } from '@shared/types/recipe'; // Vitest only
import { Button } from '@/components/common'; // Vitest only
```

### File Naming

- **Components**: PascalCase (e.g., `RecipeForm.tsx`, `Button.tsx`)
- **Utilities/Modules**: kebab-case (e.g., `recipes.ts`, `ingredient-classifier.ts`)
- **Tests**: Same name as file + `.test.ts` or `.spec.ts`
- **Types**: kebab-case (e.g., `recipe.ts`, `validation.ts`)

### Formatting (Prettier)

```javascript
{
  "semi": true,                    // Use semicolons
  "singleQuote": true,             // Use single quotes
  "printWidth": 100,               // Max line length 100
  "tabWidth": 2,                   // 2 spaces for indentation
  "useTabs": false,                // Spaces, not tabs
  "trailingComma": "es5",          // Trailing commas where valid in ES5
  "arrowParens": "avoid"           // Omit parens when possible
}
```

### Naming Conventions

- **Variables/Functions**: camelCase (`createRecipe`, `recipeId`, `getDietaryProfile`)
- **Types/Interfaces**: PascalCase (`Recipe`, `CreateRecipeInput`, `ValidationResult`)
- **Constants**: camelCase for objects, UPPER_SNAKE_CASE for primitives
- **React Components**: PascalCase (`RecipeForm`, `Button`, `RecipeCard`)
- **Database columns**: snake_case (`cooking_time_minutes`, `created_at`)
- **Application properties**: camelCase (`cookingTimeMinutes`, `createdAt`)

### Type Annotations

```typescript
// Prefer explicit return types for public functions
export async function getRecipeById(id: string): Promise<Recipe | null> {
  // implementation
}

// Use type inference for simple cases
const recipeId = randomUUID(); // Type inferred as string
const count = Number(result?.count ?? 0); // Type inferred as number

// Always type function parameters
function validateRecipe(input: CreateRecipeInput, strict = false) {
  // implementation
}

// Use type guards for narrowing
if (!recipeRow) return null; // Narrows type in subsequent code
```

### Error Handling

```typescript
// Throw descriptive errors with context
if (!recipe) throw new Error('Failed to create recipe');

// Aggregate validation errors
const errors: ValidationError[] = [];
errors.push(...dietaryErrors);
errors.push(...timeErrors);

// Use Result pattern for validation
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

// Propagate errors with context
throw new Error(`Recipe validation failed:\n${errorMessages}`);
```

### Async/Await Patterns

```typescript
// Use async/await for database operations
export async function createRecipe(input: CreateRecipeInput): Promise<Recipe> {
  await db.insertInto('recipes').values({ ... }).execute();
  const recipe = await getRecipeById(recipeId);
  return recipe;
}

// Parallel execution for independent operations
const [dietaryErrors, timeErrors, cookwareErrors] = await Promise.all([
  validateDietaryConstraints(recipeInput, profile),
  Promise.resolve(validateTimeConstraints(recipeInput)),
  Promise.resolve(validateCookwareConstraints(recipeInput)),
]);
```

### React Conventions

```typescript
// Use functional components with hooks
export function RecipeForm() {
  const [formData, setFormData] = useState({ ... });
  const [errors, setErrors] = useState<ValidationError[]>([]);

  // Event handlers prefixed with "handle"
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // implementation
  };

  const handleFieldChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return <form onSubmit={handleSubmit}>...</form>;
}

// Props interface for components
interface RecipeCardProps {
  recipe: Recipe;
  onClick?: () => void;
}

// No React import needed in React 18+ (JSX transform)
```

### Testing Conventions

```typescript
// Use descriptive test names
describe('Recipe CRUD Operations', () => {
  it('should create recipe with ingredients', async () => {
    const recipe = await createRecipe(sampleRecipe);
    expect(recipe.id).toBeDefined();
    expect(recipe.ingredients).toHaveLength(2);
  });

  it('should return null when recipe not found', async () => {
    const recipe = await getRecipeById('non-existent');
    expect(recipe).toBeNull();
  });
});

// Setup/teardown hooks
beforeEach(() => {
  runMigrations();
});

afterAll(() => {
  closeDatabase();
});
```

## Important Notes

### Database Architecture

- **Production**: Uses `better-sqlite3` (native module)
- **Testing**: Uses `sql.js` (pure JavaScript, auto-selected)
- **Abstraction**: `IDatabaseClient` interface ensures identical behavior

### ESLint Rules

- Unused vars allowed if prefixed with `_`: `(argsIgnorePattern: '^_')`
- React in JSX scope not required (React 18+)
- PropTypes disabled (using TypeScript)

### Path Resolution

- Use `.js` extensions for imports in main process (TypeScript outputs ESM)
- Vite resolves without extensions in renderer process
- Test files can use `@` and `@shared` aliases (vitest.config.ts)

### Node.js Version

- **Required**: Node.js 22.x (matches Electron 39's internal version)
- Use `nvm use` or `fnm use` to switch to correct version
