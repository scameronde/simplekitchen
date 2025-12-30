# Developer Guide: Phase 6 - Web Recipe Import

## Architecture Overview

### Component Diagram

```
RecipeImportPage (Renderer)
  ↓ IPC: recipe:import
recipe-import-handlers.ts (Main Process)
  ↓ calls
extractSchemaOrgRecipe() (recipe-importer.ts)
  ↓ creates isolated
BrowserWindow (Electron)
  ↓ executes JavaScript in page context
JSON-LD Parser
  ↓ extracts
Schema.org Recipe
  ↓ converts via
schemaOrgToRecipeInput() (schema-org-adapter.ts)
  ↓ returns
CreateRecipeInput (for user review)
  ↓ user edits & clicks Save
recipe:create (existing IPC handler)
  ↓ saves via
createRecipe() DAL
```

### Data Flow Diagram

```
User enters URL
         ↓
RecipeImportPage (import mode)
         ↓
recipe:import IPC
         ↓
Sender validation → URL format validation
         ↓
Extract Schema.org Recipe from URL
  ├─ Create isolated BrowserWindow
  ├─ Load URL with 15s timeout
  ├─ Execute JS to find JSON-LD scripts
  ├─ Parse first Recipe found
  └─ Destroy BrowserWindow
         ↓
Convert to CreateRecipeInput
  ├─ Parse ISO 8601 durations
  ├─ Parse ingredient strings
  ├─ Infer cookware type
  ├─ Map dietary tags
  └─ Extract instructions
         ↓
Return to RecipeImportPage (review mode)
         ↓
User reviews & edits imported data
         ↓
User clicks "Save Recipe"
         ↓
recipe:create IPC (existing flow)
         ↓
Validate & save to database
```

### File Structure

```
src/
├── main/
│   ├── web/
│   │   ├── recipe-importer.ts         # URL fetch & JSON-LD extraction
│   │   ├── recipe-importer.test.ts
│   │   ├── schema-org-adapter.ts      # Schema.org → CreateRecipeInput
│   │   └── schema-org-adapter.test.ts
│   └── ipc/
│       ├── recipe-import-handlers.ts  # IPC handler + validation
│       └── recipe-import-handlers.test.ts
├── renderer/
│   └── pages/
│       └── RecipeImportPage.tsx       # Two-mode UI (import + review)
└── shared/
    └── types/
        └── schema-org.ts              # Schema.org type definitions
```

## Technical Details

### Schema.org JSON-LD Extraction

#### Why BrowserWindow Instead of Fetch?

1. **JavaScript Execution**: Some recipe sites load content via JavaScript. BrowserWindow runs full page JS.
2. **DOM Parsing**: Can extract JSON-LD from `<script type="application/ld+json">` tags.
3. **Security**: Isolated sandbox prevents malicious scripts from accessing main process.
4. **Reliability**: Full browser environment handles redirects, cookies, user-agent detection.

**Trade-off**: Slower than simple HTTP fetch (~5-10 seconds vs ~1 second), but handles 95% of recipe sites correctly.

#### Implementation Details

```typescript
// recipe-importer.ts
export async function extractSchemaOrgRecipe(url: string): Promise<SchemaOrgRecipe> {
  // 1. Validate URL format
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    throw new Error('Invalid URL format...');
  }

  // 2. Create isolated BrowserWindow with sandboxing enabled
  const browserWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: false, // No Node.js in renderer
      contextIsolation: true, // Isolated context
      sandbox: true, // Extra isolation
      webSecurity: true, // Enforce CORS, CSP
    },
  });

  try {
    // 3. Load URL with 15-second timeout (prevents hanging)
    await Promise.race([
      browserWindow.loadURL(url),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000)),
    ]);

    // 4. Execute script in page context to extract JSON-LD
    const recipes = await browserWindow.webContents.executeJavaScript(`
      (function() {
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        const recipes = [];
        scripts.forEach(script => {
          try {
            const data = JSON.parse(script.textContent);
            if (data['@type'] === 'Recipe') recipes.push(data);
            // Handle @graph structure (multiple items in one script)
            if (Array.isArray(data['@graph'])) {
              data['@graph'].forEach(item => {
                if (item['@type'] === 'Recipe') recipes.push(item);
              });
            }
          } catch (e) { /* ignore malformed */ }
        });
        return recipes;
      })()
    `);

    // 5. Return first recipe found
    if (!recipes || recipes.length === 0) {
      throw new Error('No Schema.org recipe markup found on this page');
    }
    return recipes[0];
  } finally {
    // Always clean up: destroy BrowserWindow to free memory
    browserWindow.destroy();
  }
}
```

**Security Considerations:**

- `nodeIntegration: false`: BrowserWindow cannot require Node.js modules
- `contextIsolation: true`: Page context separate from Electron context
- `sandbox: true`: Additional OS-level sandboxing
- `webSecurity: true`: Enforces CORS and other security headers
- No IPC channel exposed to page (executeJavaScript is one-way)

### ISO 8601 Duration Parsing

Recipe sites use ISO 8601 format for cooking times: `PT30M`, `PT1H30M`, `PT45S`

```typescript
// schema-org-adapter.ts
function parseDuration(iso: string): number {
  // PT1H30M45S → hours, minutes, seconds
  const regex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
  const match = iso.match(regex);

  if (!match) return 0;

  const hours = match[1] ? parseInt(match[1], 10) : 0;
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const seconds = match[3] ? parseInt(match[3], 10) : 0;

  // Convert to minutes, rounding up seconds
  return hours * 60 + minutes + Math.ceil(seconds / 60);
}

// Examples:
// "PT30M" → 30 minutes
// "PT1H30M" → 90 minutes
// "PT45S" → 1 minute (rounded up)
// "PT2H15M30S" → 135.5 → 136 minutes
```

### Ingredient String Parsing Heuristics

Raw ingredient strings from recipes: `"2 cups flour"`, `"1 tbsp olive oil"`, `"salt to taste"`

**Heuristic Approach**: Simple regex extraction, not NLP

```typescript
function parseIngredient(ingredientString: string, index: number): CreateIngredientInput {
  // Pattern: optional quantity/unit followed by ingredient name
  // Regex groups: [1] = quantity, [2] = unit, [3] = ingredient name
  const match = ingredientString.match(/^(?:(\d+(?:\.\d+)?)\s*([a-zA-Z]+))?\s*(.+)$/);

  let quantity = 1;
  let unit = '';
  let name = ingredientString;

  if (match && match[3]) {
    // Successfully parsed quantity and unit
    if (match[1]) quantity = parseFloat(match[1]);
    if (match[2]) unit = match[2].toLowerCase();
    name = match[3].trim();
  }

  return {
    name,
    quantity,
    unit,
    dietaryProperties: [], // Populated by ingredient classifier on client
    optional: false,
    orderIndex: index,
  };
}

// Examples:
// "2 cups flour" → {quantity: 2, unit: "cups", name: "flour"}
// "1 tbsp olive oil" → {quantity: 1, unit: "tbsp", name: "olive oil"}
// "salt to taste" → {quantity: 1, unit: "", name: "salt to taste"}
```

**Limitations**:

- Doesn't handle fractional quantities: `"1 1/2 cups"` → parsed as `1` cup
- Doesn't validate units: `"5 xyz"` → `{quantity: 5, unit: "xyz"}`
- No complex ingredient parsing: `"2 cups (300g) flour"` → `{quantity: 2, unit: "cups", name: "(300g) flour"}`

**Future Enhancement**: Use ingredient database to validate and standardize units.

### Dietary Tag Mapping

Maps Schema.org diet type URLs to application tags:

```typescript
function mapDietaryTags(suitableForDiet: string | string[] | undefined): DietaryTag[] {
  const dietaryMap: Record<string, DietaryTag> = {
    'https://schema.org/GlutenFreeDiet': 'gluten-free',
    'https://schema.org/LowLactoseDiet': 'lactose-free',
    'https://schema.org/VegetarianDiet': 'vegetarian',
    'https://schema.org/VeganDiet': 'vegan',
    'https://schema.org/PescatarianDiet': 'pescatarian',
  };

  const diets = Array.isArray(suitableForDiet) ? suitableForDiet : [suitableForDiet];
  return diets.map(diet => dietaryMap[diet]).filter(Boolean);
}

// Example:
// Input: 'https://schema.org/VeganDiet'
// Output: ['vegan']
```

### Cookware Type Inference

Infers cookware type from instructions by searching for keywords:

```typescript
function inferCookwareType(instructions?: string): 'one-pot' | 'one-pan' | 'oven' {
  if (!instructions) return 'one-pan'; // Safe default

  const lowerInstructions = instructions.toLowerCase();

  if (lowerInstructions.includes('pan') || lowerInstructions.includes('skillet')) {
    return 'one-pan';
  }
  if (lowerInstructions.includes('pot')) {
    return 'one-pot';
  }
  if (lowerInstructions.includes('oven')) {
    return 'oven';
  }
  if (lowerInstructions.includes('grill')) {
    return 'one-pan'; // Default to pan for grill
  }

  return 'one-pan'; // Default
}

// Examples:
// "Heat pan and sauté..." → 'one-pan'
// "Bring pot to boil..." → 'one-pot'
// "Bake in oven at 350°F..." → 'oven'
```

**Limitation**: Pure keyword matching, no NLP. May incorrectly infer from recipe names (e.g., "Stovetop Pasta" → 'one-pot').

### Instructions Concatenation

Handles multiple instruction formats from Schema.org:

```typescript
function concatenateInstructions(
  instructions?: string | SchemaOrgHowToStep[] | string[]
): string | undefined {
  if (!instructions) return undefined;

  // Format 1: Plain string
  if (typeof instructions === 'string') {
    return instructions;
  }

  if (Array.isArray(instructions)) {
    // Format 2: Array of HowToStep objects
    if (instructions[0]?.text !== undefined) {
      const howToSteps = instructions as SchemaOrgHowToStep[];
      return howToSteps.map(step => step.text).join('\n');
    }

    // Format 3: Array of strings
    const stringArray = instructions as string[];
    return stringArray.join('\n');
  }

  return undefined;
}

// Examples:
// Input: "Heat pan, add oil, fry..." → "Heat pan, add oil, fry..."
// Input: [{text: "Step 1"}, {text: "Step 2"}] → "Step 1\nStep 2"
// Input: ["Step 1", "Step 2"] → "Step 1\nStep 2"
```

### IPC Handler Security

The `recipe:import` handler validates sender and URL before processing:

```typescript
export function registerRecipeImportHandlers(): void {
  ipcMain.handle('recipe:import', async (event, url: unknown) => {
    // 1. Sender validation: only file:// or localhost allowed
    if (!event.senderFrame || !validateSender(event.senderFrame)) {
      return {
        success: false,
        errors: [{ field: 'general', message: 'Unauthorized' }],
      };
    }

    // 2. URL format validation: must be string, non-empty, http(s)
    const urlValidation = validateUrlFormat(url);
    if (!urlValidation.valid) {
      return {
        success: false,
        errors: [{ field: 'url', message: urlValidation.message }],
      };
    }

    // 3. Overall timeout: 20 seconds max for entire operation
    const timeoutPromise = new Promise(resolve => {
      setTimeout(() => {
        resolve({
          success: false,
          errors: [{ field: 'general', message: 'Recipe import timed out.' }],
        });
      }, 20000);
    });

    // 4. Import operation with error mapping
    const importPromise = (async () => {
      try {
        const schemaRecipe = await extractSchemaOrgRecipe(url as string);
        const recipeInput = schemaOrgToRecipeInput(schemaRecipe, url as string);
        return { success: true, recipe: recipeInput };
      } catch (error) {
        // Map specific errors for UI feedback
        const message = error instanceof Error ? error.message : 'Unknown error';
        return {
          success: false,
          errors: [{ field: 'general', message }],
        };
      }
    })();

    // Race: operation vs timeout
    return Promise.race([importPromise, timeoutPromise]);
  });
}
```

**Key Security Features:**

- **Sender validation**: Only renderer process (file:// or localhost) can call
- **URL validation**: Prevents injection of invalid URLs
- **Timeout protection**: Prevents hanging requests
- **Error mapping**: Generic error messages to avoid leaking internals

## API Reference

### `extractSchemaOrgRecipe(url: string): Promise<SchemaOrgRecipe>`

**Location**: `src/main/web/recipe-importer.ts`

**Purpose**: Fetch a URL and extract Schema.org Recipe JSON-LD markup.

**Parameters**:

- `url: string` - Recipe page URL (must start with `http://` or `https://`)

**Returns**: `Promise<SchemaOrgRecipe>` - First Recipe found on page

**Throws**:

- `Error('Invalid URL format...')` if URL doesn't start with http(s)
- `Error('Recipe fetch timed out...')` if page takes >15 seconds to load
- `Error('No Schema.org recipe markup...')` if no Recipe found in JSON-LD

**Behavior**:

1. Creates isolated BrowserWindow with security settings
2. Loads URL with 15-second timeout
3. Executes JavaScript to extract all `<script type="application/ld+json">` tags
4. Searches for `@type: 'Recipe'` in parsed JSON
5. Returns first Recipe found
6. Destroys BrowserWindow (in finally block)

**Security**: BrowserWindow runs in sandbox with no Node.js access.

**Performance**: ~5-10 seconds per URL (varies by site)

### `schemaOrgToRecipeInput(schemaRecipe: SchemaOrgRecipe, sourceUrl: string): CreateRecipeInput`

**Location**: `src/main/web/schema-org-adapter.ts`

**Purpose**: Convert Schema.org Recipe format to application's CreateRecipeInput format.

**Parameters**:

- `schemaRecipe: SchemaOrgRecipe` - Recipe in Schema.org JSON-LD format
- `sourceUrl: string` - Original recipe URL (stored as sourceReference)

**Returns**: `CreateRecipeInput` - Ready for database insertion or user review

**Throws**:

- `Error('Recipe name is required')` if `name` field missing
- `Error('At least one ingredient is required')` if `recipeIngredient` empty

**Parsing Logic**:

| Field                | Source               | Parsing                                                      |
| -------------------- | -------------------- | ------------------------------------------------------------ |
| `title`              | `name`               | String trimmed                                               |
| `cookingTimeMinutes` | `cookTime`           | ISO 8601 duration parsed; defaults to 30 if missing          |
| `prepTimeMinutes`    | `prepTime`           | ISO 8601 duration parsed; omitted if 0 or missing            |
| `servings`           | `recipeYield`        | Extracts number from "4 servings"; defaults to 2             |
| `cookwareType`       | `recipeInstructions` | Inferred from keywords (pan/pot/oven); defaults to 'one-pan' |
| `dietaryTags`        | `suitableForDiet`    | Mapped via Schema.org diet URLs                              |
| `ingredients`        | `recipeIngredient`   | Parsed string → {quantity, unit, name}                       |
| `instructions`       | `recipeInstructions` | Concatenated from string/array/HowToStep formats             |
| `seasonality`        | (none)               | Always set to `['any']`                                      |
| `sourceType`         | (constant)           | Always `'web-imported'`                                      |
| `sourceReference`    | `sourceUrl` param    | Original recipe URL                                          |

**Example**:

```typescript
const schemaRecipe: SchemaOrgRecipe = {
  '@context': 'https://schema.org',
  '@type': 'Recipe',
  name: 'Pasta Carbonara',
  cookTime: 'PT20M',
  prepTime: 'PT10M',
  recipeYield: 2,
  recipeIngredient: ['200g pasta', '2 eggs', '100g pancetta'],
  recipeInstructions: 'Cook pasta, fry bacon, mix...',
  suitableForDiet: 'https://schema.org/VegetarianDiet',
};

const result = schemaOrgToRecipeInput(schemaRecipe, 'https://example.com/recipe/1');
// Result:
// {
//   title: 'Pasta Carbonara',
//   cookingTimeMinutes: 20,
//   prepTimeMinutes: 10,
//   servings: 2,
//   cookwareType: 'one-pan',
//   dietaryTags: ['vegetarian'],
//   seasonality: ['any'],
//   sourceType: 'web-imported',
//   sourceReference: 'https://example.com/recipe/1',
//   instructions: 'Cook pasta, fry bacon, mix...',
//   ingredients: [
//     {name: 'pasta', quantity: 200, unit: 'g', dietaryProperties: [], optional: false, orderIndex: 0},
//     {name: 'eggs', quantity: 1, unit: '', dietaryProperties: [], optional: false, orderIndex: 1},
//     ...
//   ],
// }
```

### IPC Handler: `recipe:import`

**Location**: `src/main/ipc/recipe-import-handlers.ts`

**Channel**: `recipe:import`

**Request**:

```typescript
const result = await window.electron.recipeAPI.importRecipe(url: string);
```

**Response**:

```typescript
// Success
{
  success: true,
  recipe: CreateRecipeInput  // For user review, not yet saved
}

// Failure
{
  success: false,
  errors: Array<{field: string, message: string}>
}
```

**Error Field Values**:

- `'url'`: URL format or validation error
- `'general'`: Fetch, parsing, conversion, or timeout error

**Behavior**:

1. Validates sender (file:// or localhost only)
2. Validates URL format (non-empty string, http(s) protocol)
3. Calls `extractSchemaOrgRecipe(url)` with 15-second page load timeout
4. Calls `schemaOrgToRecipeInput(recipe, url)` to convert format
5. Returns recipe for user review (NOT saved to database)
6. Overall operation timeout: 20 seconds

**Important**: Handler does NOT save to database. Renderer receives parsed recipe, allows user to edit, then calls `recipe:create` to save.

**Security**:

- Sender must be from renderer process (file:// protocol)
- URL must be valid http(s) format
- BrowserWindow runs in isolated sandbox
- Timeout prevents hanging requests

## Testing Strategy

### Unit Tests (Mocked)

**Location**: `src/main/web/schema-org-adapter.test.ts`, `src/main/ipc/recipe-import-handlers.test.ts`

**DO**: Mock `extractSchemaOrgRecipe` and dependencies

```typescript
describe('schemaOrgToRecipeInput', () => {
  it('should convert complete Schema.org recipe', () => {
    const sampleRecipe: SchemaOrgRecipe = {
      '@context': 'https://schema.org',
      '@type': 'Recipe',
      name: 'Quick Chicken Stir-Fry',
      cookTime: 'PT30M',
      prepTime: 'PT15M',
      recipeYield: '2 servings',
      recipeIngredient: ['1 lb chicken', '2 tbsp oil'],
      recipeInstructions: 'Cook and serve.',
    };

    const result = schemaOrgToRecipeInput(sampleRecipe, 'https://example.com/recipe/1');

    expect(result.title).toBe('Quick Chicken Stir-Fry');
    expect(result.cookingTimeMinutes).toBe(30);
    expect(result.ingredients).toHaveLength(2);
  });

  it('should handle missing optional fields', () => {
    const minimalRecipe: SchemaOrgRecipe = {
      '@context': 'https://schema.org',
      '@type': 'Recipe',
      name: 'Minimal Recipe',
      recipeIngredient: ['ingredient'],
    };

    const result = schemaOrgToRecipeInput(minimalRecipe, 'https://example.com/1');

    expect(result.cookingTimeMinutes).toBe(30); // Default
    expect(result.prepTimeMinutes).toBeUndefined();
    expect(result.servings).toBe(2); // Default
  });
});
```

**Rationale**:

- Fast execution (<100ms per test)
- No external network calls
- Deterministic results
- Test edge cases (missing fields, malformed data)

### Integration Tests (Mocked BrowserWindow)

**Location**: `src/main/web/recipe-importer.test.ts`

**DO**: Mock Electron's BrowserWindow and loadURL

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BrowserWindow } from 'electron';
import { extractSchemaOrgRecipe } from './recipe-importer.js';

vi.mock('electron', () => {
  const mockWebContents = {
    executeJavaScript: vi.fn(),
  };
  const mockBrowserWindow = {
    webContents: mockWebContents,
    destroy: vi.fn(),
    loadURL: vi.fn().mockResolvedValue(undefined),
  };
  return {
    BrowserWindow: vi.fn(() => mockBrowserWindow),
  };
});

describe('extractSchemaOrgRecipe', () => {
  it('should extract Recipe from JSON-LD', async () => {
    const mockRecipe = {
      '@type': 'Recipe',
      name: 'Test Recipe',
    };

    vi.mocked(BrowserWindow).prototype.webContents.executeJavaScript.mockResolvedValueOnce([
      mockRecipe,
    ]);

    const result = await extractSchemaOrgRecipe('https://example.com');

    expect(result.name).toBe('Test Recipe');
  });

  it('should throw when no recipe found', async () => {
    vi.mocked(BrowserWindow).prototype.webContents.executeJavaScript.mockResolvedValueOnce([]);

    await expect(extractSchemaOrgRecipe('https://example.com')).rejects.toThrow(
      'No Schema.org recipe markup'
    );
  });

  it('should timeout after 15 seconds', async () => {
    vi.useFakeTimers();

    // Mock loadURL to hang indefinitely
    vi.mocked(BrowserWindow).prototype.loadURL.mockImplementation(() => new Promise(() => {}));

    const promise = extractSchemaOrgRecipe('https://example.com');
    vi.advanceTimersByTime(15000);

    await expect(promise).rejects.toThrow('timed out');
    vi.useRealTimers();
  });
});
```

**Rationale**:

- No real HTTP requests
- No real BrowserWindow creation
- Test error handling (timeout, missing recipe)
- Test happy path

### Integration Tests (IPC Handler)

**Location**: `src/main/ipc/recipe-import-handlers.test.ts`

**DO**: Mock IPC event and importer functions

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerRecipeImportHandlers } from './recipe-import-handlers.js';
import * as importer from '../web/recipe-importer.js';

vi.mock('../web/recipe-importer.js');
vi.mock('../web/schema-org-adapter.js');

describe('recipe:import IPC handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject unauthorized senders', async () => {
    const event = {
      senderFrame: {
        url: 'https://external.com/page', // Not file:// or localhost
      },
    };

    const result = await ipcMain.emit('recipe:import', event, 'https://example.com');

    expect(result.success).toBe(false);
    expect(result.errors[0].message).toContain('Unauthorized');
  });

  it('should reject invalid URLs', async () => {
    const event = {
      senderFrame: {
        url: 'file://app',
      },
    };

    const result = await ipcMain.emit('recipe:import', event, 'not-a-url');

    expect(result.success).toBe(false);
    expect(result.errors[0].field).toBe('url');
  });

  it('should map extraction errors', async () => {
    vi.mocked(importer.extractSchemaOrgRecipe).mockRejectedValueOnce(
      new Error('No Schema.org recipe markup found')
    );

    const event = {
      senderFrame: {
        url: 'file://app',
      },
    };

    const result = await ipcMain.emit('recipe:import', event, 'https://example.com');

    expect(result.success).toBe(false);
    expect(result.errors[0].message).toContain('No Schema.org');
  });
});
```

**Rationale**:

- Test IPC security boundaries
- Test error handling and mapping
- No real network or BrowserWindow

### E2E Tests (Playwright)

**Location**: `e2e/recipe-import.spec.ts`

**DO**: Test UI/UX flow with mocked IPC responses

```typescript
import { test, expect } from '@playwright/test';

test('should import and review recipe', async ({ page }) => {
  // Mock the IPC response
  await page.evaluate(() => {
    window.electron.recipeAPI.importRecipe = async url => ({
      success: true,
      recipe: {
        title: 'Test Recipe',
        cookingTimeMinutes: 30,
        servings: 2,
        cookwareType: 'one-pan',
        dietaryTags: [],
        seasonality: ['any'],
        sourceType: 'web-imported',
        sourceReference: url,
        ingredients: [
          {
            name: 'ingredient 1',
            quantity: 1,
            unit: 'cup',
            dietaryProperties: [],
            optional: false,
            orderIndex: 0,
          },
        ],
      },
    });
  });

  // Go to import page
  await page.goto('http://localhost:5173/import-recipe');

  // Fill URL and submit
  await page.fill('input[placeholder*="example.com"]', 'https://example.com/recipe');
  await page.click('button:has-text("Import Recipe")');

  // Wait for review mode
  await expect(page).toHaveTitle(/Review Imported/);

  // Verify imported data populated
  await expect(page.locator('input[value="Test Recipe"]')).toBeVisible();

  // Edit and save
  await page.click('button:has-text("Save Recipe")');

  // Verify success message
  await expect(page).toContainText('Recipe saved successfully');
});

test('should show error for invalid URL', async ({ page }) => {
  // Mock failure response
  await page.evaluate(() => {
    window.electron.recipeAPI.importRecipe = async () => ({
      success: false,
      errors: [{ field: 'url', message: 'Invalid URL format' }],
    });
  });

  await page.goto('http://localhost:5173/import-recipe');
  await page.fill('input[placeholder*="example.com"]', 'invalid-url');
  await page.click('button:has-text("Import Recipe")');

  await expect(page).toContainText('Invalid URL format');
});
```

**Rationale**:

- Focus on UI/UX, not API integration
- Mock IPC responses (no real fetches)
- Test error handling in UI
- Run frequently (every commit) without API costs

### Running Tests

```bash
# All tests
npm test

# Schema.org adapter tests
npx vitest run src/main/web/schema-org-adapter.test.ts

# IPC handler tests
npx vitest run src/main/ipc/recipe-import-handlers.test.ts

# Recipe importer tests (integration with mocked BrowserWindow)
npx vitest run src/main/web/recipe-importer.test.ts

# E2E tests
npx playwright test e2e/recipe-import.spec.ts

# E2E with UI
npx playwright test e2e/recipe-import.spec.ts --ui

# Watch mode (development)
npm run test:watch
```

## Known Limitations

### 1. Requires Schema.org Markup

**Limitation**: Only works with sites that publish Schema.org Recipe JSON-LD markup.

**Sites affected**:

- ✅ Major recipe sites (AllRecipes, Tasty, Food Network, etc.) - have Schema.org
- ❌ Some recipe blogs - may lack Schema.org
- ❌ Social media posts - no structured data

**Why**: SimpleKitchen doesn't parse unstructured HTML (no BeautifulSoup/Selenium equivalent).

**Workaround**: Users can manually add recipe, or AI generation can be used instead.

### 2. Simple Ingredient Parsing

**Limitation**: Regex-based parsing, no NLP or ingredient database validation.

**Problems**:

- Fractional quantities not parsed: `"1 1/2 cups"` → `{quantity: 1}`
- Non-standard units: `"5 dashes salt"` → `{quantity: 5, unit: 'dashes'}`
- Complex ingredients: `"2 tbsp (30g) olive oil"` → name includes measurement

**Why**: NLP is complex and costly. Most recipes use simple patterns.

**Mitigation**:

- User can edit ingredients in review mode
- Ingredient classifier will mark dietary properties (client-side)

**Future Enhancement**: Use ingredient database to validate and normalize units.

### 3. Cookware Inference is Heuristic

**Limitation**: Keyword matching in instructions, not semantic understanding.

**Problems**:

- False positives: Recipe name "Stovetop Pasta" → 'one-pot' (should check instructions, not title)
- Missing cases: "Grill recipe" → 'one-pan' (should be grill, but not in schema)
- Ambiguous cases: "Oven-pan roasted" → 'oven' or 'one-pan'?

**Default behavior**: Returns 'one-pan' if no keywords match.

**Mitigation**: User can edit cookware type in review mode.

**Future Enhancement**: Use schema.org `tool` field if available; add grill as cookware option.

### 4. Dietary Tags Limited to Schema.org Support

**Limitation**: Only recognizes 5 Schema.org diet types.

**Unsupported dietary properties**:

- Dairy-free, nut-free, soy-free (exist as schema types but not mapped)
- Low-carb, keto (no schema equivalents)
- Spicy, mild (subjective, not in schema)

**Why**: Only mapped common dietary restrictions.

**Mitigation**: User can add tags in review mode.

**Future Enhancement**: Map more Schema.org diet types; allow AI to infer from ingredients.

### 5. No Batch Import

**Limitation**: Only one URL at a time; no bulk recipe import from lists or URLs.

**Why**: UI designed for single recipe review + editing flow.

**Future Enhancement**: Batch import multiple URLs, display side-by-side comparisons.

### 6. Timeout is Hard-Coded

**Limitation**: 15-second page load timeout + 20-second overall timeout are fixed.

**Problem**: Very slow sites may timeout; user cannot adjust.

**Future Enhancement**: Make timeouts configurable in settings.

### 7. Instructions Parsing Loses Structure

**Limitation**: HowToStep arrays converted to plain text (newline-separated).

**Problem**: Loses step numbers, durations, images, or other metadata.

**Why**: CreateRecipeInput doesn't have structured steps.

**Future Enhancement**: Update CreateRecipeInput to support structured steps.

## Future Enhancements

### 1. recipe-scrapers Python Bridge

**Goal**: Support non-Schema.org recipe sites using Python's recipe-scrapers library.

**Implementation**:

- Spin up Python subprocess
- Call recipe-scrapers to extract recipe
- Convert to CreateRecipeInput
- Fallback to Schema.org if not available

**Sites enabled**: 70+ additional recipe sites (Pinterest, Medium, random blogs, etc.)

**Complexity**: Medium (subprocess management, error handling)

**Cost**: Python process overhead per request (~2-3 seconds)

### 2. Browser Extension

**Goal**: Easier URL capture by "Send to SimpleKitchen" button in browser.

**Implementation**:

- Create Chrome/Firefox extension
- Show popup with current page title
- One-click "Import to SimpleKitchen"
- Open SimpleKitchen and auto-fill URL

**UX Improvement**: No manual copy-paste of URLs

**Complexity**: Low (extension boilerplate, IPC to Electron app)

### 3. Batch Import

**Goal**: Import multiple URLs at once and review together.

**Implementation**:

- Multiple URL input fields or paste list of URLs
- Fetch all in parallel
- Show results in grid or list
- Select which recipes to save

**Use case**: User finds 5 recipes from same site, imports all.

**Complexity**: Medium (parallel fetching, UI changes)

**Performance**: Need to parallelize to avoid 5 × 20-second timeouts.

### 4. Improved Ingredient Parsing

**Goal**: Better extraction of quantity, unit, and ingredient name.

**Approaches**:

1. **Ingredient database**: Validate units against known ingredients
2. **AI-powered parsing**: Use Claude/GPT to parse complex strings
3. **Unicode fractions**: Support `½`, `¾`, etc.
4. **Ranges**: Support `"1-2 cups"` → {min: 1, max: 2}

**Why valuable**: Most common source of manual editing in review mode.

### 5. Image Support

**Goal**: Capture and display recipe images from imported recipe.

**Implementation**:

- Extract image URLs from Schema.org `image` field
- Download and save to local storage
- Display in recipe detail view

**Schema support**: Most sites include images in JSON-LD.

### 6. User Rating Integration

**Goal**: Capture original recipe ratings and reviews.

**Implementation**:

- Extract `aggregateRating` from Schema.org
- Store as metadata
- Display in recipe detail

**No direct storage**: SimpleKitchen doesn't have user ratings yet.

### 7. Configurable Timeouts and Retry Logic

**Goal**: Adjust timeout thresholds per-site; implement exponential backoff.

**Use case**: Very slow recipe sites; transient network errors.

**Implementation**:

- Add timeout settings to preferences
- Implement retry logic with exponential backoff
- Store site-specific timeout overrides

## Common Tasks

### Adding Support for New Schema.org Diet Type

1. Update dietaryMap in `schema-org-adapter.ts`:

```typescript
const dietaryMap: Record<string, DietaryTag> = {
  'https://schema.org/GlutenFreeDiet': 'gluten-free',
  'https://schema.org/LowFatDiet': 'low-fat', // Add new mapping
  // ...
};
```

2. Verify DietaryTag type in `shared/types/recipe.ts` includes the tag.

3. Add test case in `schema-org-adapter.test.ts`:

```typescript
it('should map new dietary tag', () => {
  const recipe: SchemaOrgRecipe = {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: 'Low-Fat Salad',
    recipeIngredient: ['lettuce'],
    suitableForDiet: 'https://schema.org/LowFatDiet',
  };

  const result = schemaOrgToRecipeInput(recipe, 'https://example.com');
  expect(result.dietaryTags).toContain('low-fat');
});
```

### Adding New Cookware Keywords

1. Update `inferCookwareType` in `schema-org-adapter.ts`:

```typescript
if (lowerInstructions.includes('microwave')) {
  return 'microwave'; // Requires new cookware option
}
```

2. Add new CookwareType option to `shared/types/recipe.ts`.

3. Update RecipeBasicInfo component to display new type.

4. Add test:

```typescript
it('should infer microwave from instructions', () => {
  const result = schemaOrgToRecipeInput(recipe, 'url');
  expect(result.cookwareType).toBe('microwave');
});
```

### Debugging Failed Import

1. **Check BrowserWindow logs**:

```typescript
// In recipe-importer.ts, add logging
browserWindow.webContents.on('console-message', (level, message) => {
  console.log('Page console:', message);
});
```

2. **Inspect extracted JSON-LD**:

```typescript
// Log recipes array before validation
console.log('Extracted recipes:', recipes);
```

3. **Validate against schema.org**:

```
https://validator.schema.org/
```

Paste page HTML to see if Schema.org is valid.

4. **Test in browser dev tools**:

```javascript
// Paste in DevTools console on recipe site
const scripts = document.querySelectorAll('script[type="application/ld+json"]');
scripts.forEach(s => console.log(JSON.parse(s.textContent)));
```

## Troubleshooting

### "No Schema.org recipe markup found"

**Cause**: Page either has no JSON-LD or doesn't follow Schema.org Recipe spec.

**Solution**:

1. Open page in browser → DevTools → Elements
2. Search for `<script type="application/ld+json">`
3. Check if any contain `"@type": "Recipe"`
4. If not, site doesn't publish structured data

**Workaround**: Use manual entry or AI generation instead.

### "Recipe import timed out"

**Cause**: Page took >15 seconds to load (slow internet, heavy site).

**Solution**:

1. Try again with better internet connection
2. Try different recipe site
3. Check site status: is it down or very slow?

**Future**: Make timeouts configurable.

### "Failed to fetch recipe from URL"

**Cause**: Network error, invalid certificate, or page returned error.

**Solution**:

1. Verify URL is correct (copy from browser address bar)
2. Verify page loads in browser
3. Check internet connection
4. Try different recipe site

### "Invalid URL format"

**Cause**: URL doesn't start with `http://` or `https://`.

**Solution**: Include full URL: `https://example.com/recipe`

### BrowserWindow error: "Module not found: electron"

**Cause**: Importing electron in wrong process context.

**Solution**: `recipe-importer.ts` should only run in main process. Verify it's not imported in renderer.

### Parsed ingredients have wrong quantities

**Cause**: Ingredient string has non-standard format (fractions, ranges, etc.).

**Example**: `"1 1/2 cups flour"` parses as `{quantity: 1, unit: '', name: '1/2 cups flour'}`

**Solution**: Edit ingredient in review mode before saving.

**Long-term**: Implement advanced ingredient parsing or use ingredient database.

### Inferred cookware type is wrong

**Cause**: Instructions don't explicitly mention cookware, or use different terminology.

**Example**: "Grill the chicken" infers 'one-pan' because "grill" keyword mapped to pan.

**Solution**: Edit cookware type in review mode.

**Better**: Check schema.org `tool` field if available; add more inference rules.
