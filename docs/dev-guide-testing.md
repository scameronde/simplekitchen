# SimpleKitchen - Testing Guide

## Overview

SimpleKitchen has a comprehensive test suite covering all layers of the application, from unit tests for business logic to end-to-end tests for complete user workflows. This guide explains how to run, write, and debug tests.

### Test Suite Statistics

- **Unit Tests**: 478 tests covering all business logic
- **Integration Tests**: 15 tests for renderer components
- **E2E Tests**: 22 tests for user workflows
- **Performance Tests**: Benchmark suite for scale validation
- **Security Tests**: Injection and sanitization tests

### Testing Philosophy

1. **Fast Feedback**: Unit tests run in milliseconds
2. **Isolation**: Each test is independent with clean database state
3. **Determinism**: Tests produce consistent results
4. **Comprehensive Coverage**: All critical paths are tested
5. **Real-World Scenarios**: E2E tests validate actual user workflows

---

## Quick Start

### Running Tests

```bash
# Quick test - run all unit tests (fastest)
npm test

# Full test suite - unit, integration, and E2E
npm run test:all

# Watch mode - re-run tests on file changes
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Targeted Test Runs

```bash
# Database tests only
npm run test:db
npm run test:db:watch  # with watch mode

# Unit tests only
npm run test:unit

# Integration tests (React components)
npm run test:integration

# E2E tests only
npm run test:e2e
npm run test:e2e:ui    # with Playwright UI
```

### Running Individual Tests

```bash
# Run a single test file (unit)
npx vitest run src/main/database/dal/recipes.test.ts
npx vitest src/main/database/dal/recipes.test.ts  # watch mode

# Run a single E2E test file
npx playwright test e2e/manual-entry.spec.ts
npx playwright test e2e/manual-entry.spec.ts --ui  # with UI

# Run specific test case by name
npx vitest run -t "should create recipe"
npx playwright test -g "should add a recipe"
```

---

## Test Architecture

### Test Environment Setup

#### Automatic Database Selection

The application automatically selects the appropriate database adapter based on the environment:

- **Production**: Uses `better-sqlite3` (native module)
- **Testing**: Uses `sql.js` (pure JavaScript WASM)
- **Detection**: Checks `process.env.VITEST === 'true'`

No manual configuration required - the `IDatabaseClient` interface ensures identical behavior across both adapters.

#### Environment Variables

Create a `.env.test` file (optional) for test-specific configuration:

```env
# Example .env.test
LOG_LEVEL=error
OPENAI_API_KEY=test-key-mocked
```

Environment variables are loaded via `dotenv` in test setup.

#### Vitest Configuration

Located in `vitest.config.ts`:

```typescript
{
  test: {
    globals: true,          // Global test APIs (describe, it, expect)
    environment: 'jsdom',   // Browser environment for React tests
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: './vitest.setup.ts',
    env: {
      VITEST: 'true',       // Auto-detected by database client
    },
  },
  resolve: {
    alias: {
      '@': './src',
      '@shared': './src/shared',
    },
  },
}
```

#### Global Setup (`vitest.setup.ts`)

Provides global mocks and test utilities:

```typescript
import '@testing-library/jest-dom';

// Mock window.electron for renderer tests
globalThis.window.electron = {
  platform: 'test',
  versions: { node: '22.0.0', chrome: '126.0.0', electron: '39.0.0' },
  recipeAPI: {
    create: vi.fn(),
    getAll: vi.fn(),
    getById: vi.fn(),
    filter: vi.fn(),
    generateRecipe: vi.fn(),
    importRecipe: vi.fn(),
  },
};
```

#### Playwright Configuration

Located in `playwright.config.ts`:

```typescript
{
  testDir: './e2e',
  timeout: 30000,
  retries: 0,
  workers: 1,              // Sequential execution for Electron
  use: {
    trace: 'on-first-retry',
  },
}
```

Environment variables set for E2E tests:

- `E2E_TEST=true` - Enables test-specific code paths
- `NODE_ENV=test` - Test environment mode

---

## Writing Tests

### Unit Test Template

```typescript
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createRecipe, getRecipeById } from './recipes';
import { runMigrations, closeDatabase } from '../index';
import type { CreateRecipeInput } from '../../../shared/types/recipe';

// Run migrations before each test for clean state
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
    dietaryTags: ['gluten-free'],
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
    ],
  };

  it('should create a new recipe with ingredients', async () => {
    const recipe = await createRecipe(sampleRecipe);

    expect(recipe.id).toBeDefined();
    expect(recipe.title).toBe('Simple Pasta');
    expect(recipe.cookingTimeMinutes).toBe(30);
    expect(recipe.ingredients).toHaveLength(1);
  });

  it('should return null for non-existent recipe', async () => {
    const result = await getRecipeById('non-existent-id');
    expect(result).toBeNull();
  });
});
```

### Integration Test Template (React Components)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecipeListPage } from './RecipeListPage';
import type { Recipe } from '../../shared/types/recipe';

const mockRecipes: Recipe[] = [
  {
    id: '1',
    title: 'Test Recipe',
    cookingTimeMinutes: 30,
    prepTimeMinutes: 10,
    totalTimeMinutes: 40,
    cookwareType: 'one-pan',
    servings: 2,
    dietaryTags: ['gluten-free'],
    seasonality: ['any'],
    sourceType: 'manual',
    sourceReference: null,
    instructions: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ingredients: [],
  },
];

describe('RecipeListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock window.electron.recipeAPI
    window.electron = {
      platform: 'test',
      versions: { node: '', chrome: '', electron: '' },
      recipeAPI: {
        create: vi.fn(),
        getAll: vi.fn().mockResolvedValue({ success: true, recipe: mockRecipes }),
        getById: vi.fn(),
        filter: vi.fn().mockResolvedValue({ success: true, recipe: mockRecipes }),
        generateRecipe: vi.fn(),
        importRecipe: vi.fn(),
      },
    };
  });

  it('loads and displays recipes on mount', async () => {
    const onRecipeClick = vi.fn();
    render(<RecipeListPage onRecipeClick={onRecipeClick} />);

    await waitFor(() => {
      expect(screen.getByText('Test Recipe')).toBeInTheDocument();
    });
  });

  it('handles user interaction', async () => {
    const user = userEvent.setup();
    render(<RecipeListPage onRecipeClick={vi.fn()} />);

    const filterInput = screen.getByPlaceholderText('Filter recipes...');
    await user.type(filterInput, 'pasta');

    expect(filterInput).toHaveValue('pasta');
  });
});
```

### E2E Test Template

```typescript
import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';

test('complete manual recipe entry workflow', async () => {
  const electronApp = await electron.launch({
    args: ['.'],
    env: {
      ...process.env,
      NODE_ENV: 'development',
    },
  });

  const window = await electronApp.firstWindow();
  await window.waitForLoadState('domcontentloaded');

  // Fill form
  await window.fill('#input-recipe-title', 'E2E Test Pasta');
  await window.fill('#input-cooking-time-\\(minutes\\)', '35');
  await window.selectOption('#select-cookware-type', 'one-pot');

  // Fill ingredient
  await window.fill('input[placeholder="Name"]', 'rice');
  await window.fill('input[placeholder="Qty"]', '200');
  await window.fill('input[placeholder="Unit"]', 'g');

  // Select seasonality
  await window.click('text=Any Season');

  // Submit
  await window.click('button:has-text("Save Recipe")');

  // Verify success
  await expect(window.locator('text=Recipe added successfully!')).toBeVisible({
    timeout: 5000,
  });

  await electronApp.close();
});
```

---

## Test Categories

### 1. Unit Tests

**Location**: Co-located with source files (`*.test.ts`)

**Purpose**: Test individual functions and classes in isolation

**Coverage Areas**:

- Database DAL operations (`src/main/database/dal/*.test.ts`)
- Validation logic (`src/main/validation/*.test.ts`)
- IPC handlers (`src/main/ipc/*.test.ts`)
- AI recipe generation (`src/main/ai/*.test.ts`)
- Web scraping and schema adapters (`src/main/web/*.test.ts`)
- Utility functions (`src/renderer/utils/*.test.ts`)

**Key Characteristics**:

- Fast execution (< 1ms per test)
- No external dependencies
- Database uses in-memory sql.js
- Fresh database state per test via `beforeEach(runMigrations)`

### 2. Integration Tests

**Location**: `src/renderer/**/*.test.tsx`

**Purpose**: Test React component behavior with mocked backend

**Coverage Areas**:

- Form components (`RecipeForm`, `IngredientRow`)
- List and filtering (`RecipeListPage`)
- Detail views (`RecipeDetailPage`)
- AI generation UI (`RecipeGenerationPage`)
- Import workflows (`RecipeImportPage`)

**Key Characteristics**:

- Uses `@testing-library/react` for user-centric testing
- Mocks `window.electron.recipeAPI` via Vitest
- Tests user interactions and state changes
- No real IPC or database calls

### 3. E2E Tests

**Location**: `e2e/*.spec.ts`

**Purpose**: Test complete user workflows with real Electron app

**Coverage Areas**:

- Manual recipe entry (`manual-entry.spec.ts`)
- Recipe viewing and filtering (`recipe-viewing.spec.ts`)
- Web import workflows (`recipe-import.spec.ts`)
- AI recipe generation (`ai-recipe-generation.spec.ts`)
- Cross-feature workflows (`cross-feature-workflows.spec.ts`)
- Performance validation (`performance.spec.ts`)

**Key Characteristics**:

- Launches real Electron application
- Real IPC communication
- Real database operations (in-memory)
- Playwright browser automation
- Slower execution (seconds per test)

### 4. Performance Tests

**Location**: `src/main/database/benchmark.ts`

**Purpose**: Validate performance at scale

**Run with**: `npm run benchmark`

**Benchmarks**:

- Database seeding (1000 recipes)
- Retrieve all recipes (target: < 1000ms)
- Filter by cooking time (target: < 50ms)
- Filter by cookware type (target: < 50ms)
- Filter by dietary tags (target: < 50ms)
- Complex multi-criteria filter (target: < 50ms)

**Sample Output**:

```
=== Recipe Database Performance Benchmark ===

Seeding database with 1000 recipes...
Seed time: 1245.32ms

Benchmark: getRecipes()
  - Retrieved 1000 recipes
  - Time: 823.45ms
  - Target: <1000ms ✓

Benchmark: getRecipes({ cookingTimeMin: 30, cookingTimeMax: 40 })
  - Retrieved 234 recipes
  - Time: 28.12ms
  - Target: <50ms ✓
```

### 5. Security Tests

**Location**: `src/main/ipc/security-sanitization.test.ts`, `src/main/database/security.test.ts`

**Purpose**: Prevent vulnerabilities and verify input handling

**Coverage Areas**:

- XSS prevention (HTML/script tags in inputs)
- SQL injection prevention (parameterized queries)
- Path traversal protection
- Unicode character handling (emojis, non-Latin scripts)
- Special character preservation (`<`, `>`, `&`, `'`, `"`, `\n`, `\t`)

**Example Test**:

```typescript
it('should safely store HTML/script tags in recipe title', async () => {
  const maliciousInput: CreateRecipeInput = {
    ...baseRecipe,
    title: "<script>alert('XSS')</script>",
  };

  const recipe = await createRecipe(maliciousInput);

  // Verify stored literally (not executed or escaped)
  expect(recipe.title).toBe("<script>alert('XSS')</script>");

  const retrieved = await getRecipeById(recipe.id);
  expect(retrieved!.title).toBe("<script>alert('XSS')</script>");
});
```

---

## Best Practices

### Test Isolation

**Rule**: Each test must be independent and not rely on other tests

**Implementation**:

```typescript
beforeEach(() => {
  runMigrations(); // Fresh database state
});

afterAll(() => {
  closeDatabase(); // Cleanup resources
});
```

**Anti-Pattern**:

```typescript
// ❌ BAD - Test depends on previous test
let recipeId: string;

it('creates recipe', async () => {
  const recipe = await createRecipe(sample);
  recipeId = recipe.id; // Shared state!
});

it('retrieves recipe', async () => {
  const recipe = await getRecipeById(recipeId); // Depends on previous test
  expect(recipe).not.toBeNull();
});
```

**Best Practice**:

```typescript
// ✅ GOOD - Each test is self-contained
it('creates and retrieves recipe', async () => {
  const created = await createRecipe(sample);
  const retrieved = await getRecipeById(created.id);
  expect(retrieved).not.toBeNull();
  expect(retrieved!.id).toBe(created.id);
});
```

### Deterministic Tests

**Rule**: Tests must produce the same result every time

**Use fixed data**:

```typescript
// ✅ GOOD - Deterministic
const sampleRecipe: CreateRecipeInput = {
  title: 'Test Recipe',
  cookingTimeMinutes: 30,
  // ... fixed values
};
```

**Avoid randomness**:

```typescript
// ❌ BAD - Non-deterministic
const sampleRecipe: CreateRecipeInput = {
  title: `Recipe ${Math.random()}`, // Different every run!
  // ...
};
```

**Handle time-based data**:

```typescript
// When testing timestamps, accept recent times
expect(recipe.createdAt.getTime()).toBeGreaterThan(Date.now() - 1000);
```

### Test Speed

**Rule**: Unit tests should be fast (< 10ms), E2E tests can be slow

**Fast unit tests**:

- Use in-memory database (sql.js)
- No network calls
- Minimal test data
- No file I/O

**Optimize slow tests**:

```typescript
// ✅ GOOD - Minimal data
const minimalRecipe = {
  title: 'Test',
  cookingTimeMinutes: 30,
  // ... only required fields
};

// ❌ BAD - Unnecessary complexity
const recipe = await createRecipe(hugeRecipeWithManyIngredients);
const allRecipes = await getRecipes(); // Fetches all
const filtered = allRecipes.filter(r => r.id === recipe.id); // Slow!
```

### Descriptive Test Names

**Rule**: Test names should describe what is being tested and expected outcome

```typescript
// ✅ GOOD
it('should return null when recipe does not exist', async () => { ... });
it('should filter recipes by cooking time range', async () => { ... });
it('should store HTML tags literally without executing', async () => { ... });

// ❌ BAD
it('test1', async () => { ... });
it('works', async () => { ... });
it('recipe', async () => { ... });
```

### Arrange-Act-Assert Pattern

```typescript
it('should create recipe with ingredients', async () => {
  // Arrange - Set up test data
  const sampleRecipe: CreateRecipeInput = {
    title: 'Pasta',
    ingredients: [{ name: 'pasta', quantity: 200, unit: 'g', ... }],
  };

  // Act - Perform the action
  const recipe = await createRecipe(sampleRecipe);

  // Assert - Verify the result
  expect(recipe.id).toBeDefined();
  expect(recipe.title).toBe('Pasta');
  expect(recipe.ingredients).toHaveLength(1);
});
```

---

## Debugging Test Failures

### Common Issues and Solutions

#### Issue 1: "Database is locked" Error

**Symptom**: `SQLITE_BUSY: database is locked`

**Cause**: Previous test didn't close database connection

**Solution**:

```typescript
afterAll(() => {
  closeDatabase(); // Always close in afterAll hook
});
```

#### Issue 2: "Test times out" in E2E

**Symptom**: E2E test exceeds 30s timeout

**Causes**:

- Vite dev server not ready
- Element selector not found
- App not loading

**Solutions**:

```typescript
// Increase timeout for slow tests
test('slow test', async () => { ... }, { timeout: 60000 });

// Wait for specific elements
await window.waitForSelector('button:has-text("Save")', { timeout: 10000 });

// Check Playwright trace
// Run with: npx playwright test --trace on
```

#### Issue 3: "Cannot read property of undefined"

**Symptom**: `TypeError: Cannot read property 'X' of undefined`

**Cause**: Mock not set up correctly

**Solution**:

```typescript
beforeEach(() => {
  vi.clearAllMocks();

  // Ensure complete mock structure
  window.electron = {
    platform: 'test',
    versions: { node: '', chrome: '', electron: '' },
    recipeAPI: {
      create: vi.fn().mockResolvedValue({ success: true, recipe: mockRecipe }),
      getAll: vi.fn().mockResolvedValue({ success: true, recipe: [] }),
      // ... all required methods
    },
  };
});
```

#### Issue 4: "Expected X but received Y"

**Symptom**: Assertion fails with unexpected value

**Debugging**:

```typescript
// Add console.log to inspect values
console.log('Recipe:', JSON.stringify(recipe, null, 2));

// Use Vitest's snapshot testing
expect(recipe).toMatchSnapshot();

// Debug specific property
expect(recipe.title).toBe('Expected'); // Fails
console.log('Actual title:', recipe.title); // Shows actual value
```

### Logging Strategies

#### Enable Debug Logging

```typescript
// In test file
import { debug } from 'vitest';

it('test with logging', async () => {
  const recipe = await createRecipe(sample);
  debug('Created recipe:', recipe); // Logged only when test fails
});
```

#### Playwright Debug Mode

```bash
# Run E2E tests in headed mode with debug logs
PWDEBUG=1 npx playwright test e2e/manual-entry.spec.ts

# Use Playwright Inspector
npx playwright test --debug
```

#### Database Query Logging

```typescript
// Temporarily enable query logging
import { db } from '../init';

// In test
const result = await db.selectFrom('recipes').selectAll().execute();

console.log('Query result:', result);
```

### Running Tests in Isolation

```bash
# Run single test file
npx vitest run src/main/database/dal/recipes.test.ts

# Run single test case
npx vitest run -t "should create recipe with ingredients"

# Run tests matching pattern
npx vitest run -t "filter"

# Run in watch mode for rapid debugging
npx vitest src/main/database/dal/recipes.test.ts
```

### Using Vitest UI for Debugging

```bash
# Launch Vitest UI (web-based test runner)
npx vitest --ui

# Features:
# - Visual test tree
# - Click to run individual tests
# - See assertion diffs
# - View console output
# - Filter by status (failed, passed, etc.)
```

---

## Performance Benchmarking

### Running Benchmarks

```bash
npm run benchmark
```

This seeds the database with 1000 recipes and measures query performance.

### Interpreting Results

Performance targets:

- **Seed 1000 recipes**: < 2000ms
- **Get all recipes (1000)**: < 1000ms
- **Filter queries**: < 50ms

**Example Output**:

```
Benchmark: getRecipes({ cookingTimeMin: 30, cookingTimeMax: 40 })
  - Retrieved 234 recipes
  - Time: 28.12ms
  - Target: <50ms ✓
```

If a benchmark fails (exceeds target), investigate:

1. Database indexes (check migration files)
2. Query complexity (check DAL implementation)
3. Unnecessary joins or subqueries

### When to Add New Benchmarks

Add benchmarks for:

- New filtering criteria (e.g., filter by ingredients)
- Complex queries with multiple joins
- Operations expected to handle large datasets
- Critical user-facing queries

**Example**:

```typescript
// Add to src/main/database/benchmark.ts
console.log('Benchmark: getRecipes({ ingredientName: "chicken" })');
const filterStart = performance.now();
const filtered = await getRecipes({ ingredientName: 'chicken' });
const filterEnd = performance.now();
console.log(`  - Retrieved ${filtered.length} recipes`);
console.log(`  - Time: ${(filterEnd - filterStart).toFixed(2)}ms`);
console.log(`  - Target: <50ms ${filterEnd - filterStart < 50 ? '✓' : '✗'}\n`);
```

---

## Security Testing

### Types of Security Tests

1. **Input Sanitization**: Verify malicious input is stored safely
2. **SQL Injection**: Ensure parameterized queries prevent injection
3. **XSS Prevention**: Verify script tags are not executed
4. **Path Traversal**: Block file system access attempts
5. **Unicode Handling**: Support international characters without corruption

### Testing for Vulnerabilities

#### XSS Prevention Test

```typescript
it('should safely store HTML/script tags in recipe title', async () => {
  const maliciousInput: CreateRecipeInput = {
    ...baseRecipe,
    title: "<script>alert('XSS')</script>",
  };

  const recipe = await createRecipe(maliciousInput);

  // Verify stored literally (not executed)
  expect(recipe.title).toBe("<script>alert('XSS')</script>");

  // TODO: E2E test verifies UI renders as text, not HTML
});
```

#### SQL Injection Prevention Test

```typescript
it('should prevent SQL injection in recipe search', async () => {
  const maliciousTitle = "'; DROP TABLE recipes; --";

  const recipe = await createRecipe({
    ...baseRecipe,
    title: maliciousTitle,
  });

  // Verify stored literally
  expect(recipe.title).toBe(maliciousTitle);

  // Verify database still intact
  const allRecipes = await getRecipes();
  expect(allRecipes).toBeDefined();
});
```

#### Unicode Character Test

```typescript
it('should handle emoji and Unicode characters', async () => {
  const recipe = await createRecipe({
    ...baseRecipe,
    title: '🍝 Pasta with 中文 and العربية',
  });

  expect(recipe.title).toBe('🍝 Pasta with 中文 and العربية');

  const retrieved = await getRecipeById(recipe.id);
  expect(retrieved!.title).toBe('🍝 Pasta with 中文 and العربية');
});
```

### When to Add Security Tests

Add security tests when:

- Adding new user input fields
- Implementing new database queries
- Adding file upload/download features
- Integrating with external APIs
- Handling untrusted data sources (web scraping)

**Checklist**:

- [ ] Test with HTML/script tags
- [ ] Test with SQL injection patterns
- [ ] Test with special characters (`<`, `>`, `&`, `'`, `"`)
- [ ] Test with Unicode (emojis, non-Latin scripts)
- [ ] Test with path traversal patterns (`../`, `..\\`)
- [ ] Test with extremely long inputs (DOS prevention)

---

## Continuous Integration

### Pre-Commit Checks

Before committing code:

```bash
# Type check
npm run typecheck

# Lint
npm run lint

# Format check
npm run format:check

# Unit tests
npm test

# Full suite (optional but recommended)
npm run test:all
```

### CI Pipeline (Future)

Recommended GitHub Actions workflow:

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '22'
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm test
      - run: npm run test:e2e
      - run: npm run benchmark
```

---

## Appendix: Test File Locations

### Unit Tests (478 tests)

```
src/main/
  database/
    dal/
      recipes.test.ts              (15 tests - CRUD operations)
      cookware-profiles.test.ts    (8 tests)
      dietary-profiles.test.ts     (10 tests)
      tags.test.ts                 (12 tests)
      ingredients.test.ts          (7 tests)
      recipe-tags.test.ts          (6 tests)
    init.test.ts                   (5 tests - migrations)
    migrations.test.ts             (8 tests - schema)
    security.test.ts               (25 tests - SQL injection)
  ipc/
    recipe-handlers.test.ts        (18 tests - IPC logic)
    recipe-ai-handlers.test.ts     (12 tests)
    recipe-import-handlers.test.ts (10 tests)
    security-sanitization.test.ts  (45 tests - XSS, Unicode)
  validation/
    validator.test.ts              (62 tests - orchestrator)
    dietary-validator.test.ts      (85 tests - constraints)
    time-validator.test.ts         (42 tests)
    cookware-validator.test.ts     (28 tests)
    servings-validator.test.ts     (15 tests)
    ingredient-database.test.ts    (35 tests)
  ai/
    recipe-generator.test.ts       (20 tests - AI generation)
    recipe-schema.test.ts          (15 tests - schema parsing)
  web/
    recipe-importer.test.ts        (8 tests - web scraping)
    schema-org-adapter.test.ts     (12 tests - schema.org)
```

### Integration Tests (15 tests)

```
src/renderer/
  pages/
    RecipeListPage.test.tsx        (5 tests - filtering, display)
  utils/
    ingredient-classifier.test.ts  (10 tests - classification)
```

### E2E Tests (22 tests)

```
e2e/
  manual-entry.spec.ts             (2 tests - form submission)
  recipe-viewing.spec.ts           (4 tests - list, detail, filter)
  recipe-import.spec.ts            (3 tests - web import)
  ai-recipe-generation.spec.ts     (5 tests - AI workflow)
  cross-feature-workflows.spec.ts  (6 tests - multi-feature)
  performance.spec.ts              (2 tests - large datasets)
```

---

## Summary

SimpleKitchen's test suite provides comprehensive coverage across all application layers:

- **Fast unit tests** validate business logic in isolation
- **Integration tests** ensure components work together
- **E2E tests** verify real user workflows
- **Performance benchmarks** validate scale
- **Security tests** prevent vulnerabilities

Follow the best practices in this guide to maintain high code quality and catch bugs early. When in doubt, write a test!

**Key Takeaways**:

1. Run `npm test` frequently during development
2. Use `npm run test:watch` for rapid feedback
3. Write tests alongside features (TDD recommended)
4. Keep tests isolated, deterministic, and fast
5. Add security tests for all user inputs
6. Run `npm run test:all` before pushing code

Happy testing! 🧪
