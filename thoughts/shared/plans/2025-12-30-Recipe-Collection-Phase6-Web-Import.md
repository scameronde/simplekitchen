# Phase 6: Web Recipe Import - Implementation Plan

## Inputs

- **Research Report**: `thoughts/shared/research/2025-12-25-Recipe-Collection-Management.md`
- **Master Plan**: `thoughts/shared/plans/2025-12-25-Recipe-Collection-Management-MASTER.md`
- **Spec**: `thoughts/shared/specs/2025-12-25-SimpleKitchen.md`
- **User Request**: Implement Phase 6 - Web Recipe Import
- **Dependencies**: Phase 0, 1, 2, 3, 4, 5 MUST be complete

## Verified Current State

**Fact:** Phase 5 (AI-Powered Recipe Generation) is complete.  
**Evidence:** `thoughts/shared/plans/2025-12-29-Recipe-Collection-Phase5-AI-Generation-STATE.md:4`  
**Excerpt:** `**Current Task**: COMPLETE`

**Fact:** Existing IPC pattern established for recipe operations.  
**Evidence:** `src/main/ipc/recipe-handlers.ts:1-88`  
**Excerpt:** `export function registerRecipeHandlers(): void { ipcMain.handle('recipe:create', ...); }`

**Fact:** Existing validation system enforces dietary and practical constraints.  
**Evidence:** `src/main/validation/validator.ts` (from Phase 2)  
**Excerpt:** Validates gluten-free, lactose-free, time, cookware, servings constraints

**Fact:** Recipe creation flow with validation exists from Phase 3.  
**Evidence:** `src/main/database/dal/recipes.ts` (createRecipe function)  
**Excerpt:** Creates recipe with ingredients, validates constraints before storage

**Fact:** Recipe form component exists for manual entry and editing.  
**Evidence:** `src/renderer/components/RecipeForm/RecipeForm.tsx` (from Phase 3)  
**Excerpt:** Reusable form component for recipe data entry with validation error display

**Fact:** Schema.org Recipe standard provides 90+ properties including all requirements.  
**Evidence:** `thoughts/shared/research/2025-12-25-Recipe-Collection-Management.md:113-131`  
**Excerpt:** "Schema.org Recipe (v29.4) defines 90+ properties including recipeIngredient, cookTime, recipeYield, suitableForDiet, tool, nutrition"

**Fact:** Schema.org JSON-LD extraction provides 90%+ success rate on major recipe sites.  
**Evidence:** `thoughts/shared/research/2025-12-25-Recipe-Collection-Management.md:422-456`  
**Excerpt:** "Reliability: 90%+ success rate on major recipe sites that implement Schema.org markup"

**Fact:** User-driven import approach recommended for legal/technical safety.  
**Evidence:** `thoughts/shared/plans/2025-12-25-Recipe-Collection-Management-MASTER.md:265-288`  
**Excerpt:** "Option A (User-Driven) with Schema.org extraction. Rationale: Lowest legal risk, technical feasibility, respects website ToS"

## Goals / Non-Goals

### Goals

- Enable users to import recipes from external recipe websites using URLs
- Extract recipe data using Schema.org JSON-LD markup (primary method)
- Validate imported recipes against dietary and practical constraints
- Provide user review/edit workflow before storage
- Handle common error cases gracefully (no Schema.org markup, network failures, constraint violations)
- Maintain security (validate URLs, isolate web content, timeout protection)
- Achieve 90%+ success rate on major recipe sites (AllRecipes, Food Network, NYT Cooking, Bon Appétit, etc.)
- Complete Phase 6 to reach **Milestone MVP 4: Users can import recipes from web sources**

### Non-Goals

- Python recipe-scrapers library integration (deferred to future enhancement)
- Automated web crawling or bulk import (user manually provides each URL)
- Browser extension development (focus on in-app URL input)
- Editing imported recipes after initial storage (use standard recipe edit flow from future phase)
- Support for sites without Schema.org markup (will display error, suggest manual entry or AI generation)

## Design Overview

### Data Flow: Web Recipe Import

```
User enters URL
    ↓
Validate URL format (main process)
    ↓
Fetch URL in isolated BrowserWindow (Electron)
    ↓
Execute extraction script in page context
    ↓
Extract <script type="application/ld+json"> elements
    ↓
Parse JSON, filter for @type="Recipe"
    ↓
Convert Schema.org Recipe → CreateRecipeInput
    ↓
Run validation (existing validator)
    ↓
Display recipe in review form (RecipeForm component)
    ↓
User reviews/edits
    ↓
User confirms → Save with sourceType='web-imported'
```

### Key Technical Components

1. **Schema.org Types** (`src/shared/types/schema-org.ts`): TypeScript types for Schema.org Recipe format
2. **Web Recipe Importer** (`src/main/web/recipe-importer.ts`): Core logic for URL fetching and JSON-LD extraction
3. **Schema.org Adapter** (`src/main/web/schema-org-adapter.ts`): Converts Schema.org format to our CreateRecipeInput
4. **IPC Handler** (`src/main/ipc/recipe-import-handlers.ts`): Handles `recipe:import` IPC call
5. **UI Component** (`src/renderer/pages/RecipeImportPage.tsx`): URL input and review workflow

### Schema.org to SimpleKitchen Mapping

| Schema.org Field     | SimpleKitchen Field  | Transformation                                |
| -------------------- | -------------------- | --------------------------------------------- |
| `name`               | `title`              | Direct string copy                            |
| `cookTime`           | `cookingTimeMinutes` | Parse ISO 8601 duration (PT30M → 30)          |
| `prepTime`           | `prepTimeMinutes`    | Parse ISO 8601 duration (PT15M → 15)          |
| `totalTime`          | `totalTimeMinutes`   | Parse ISO 8601 or sum prep + cook             |
| `recipeYield`        | `servings`           | Parse numeric value from string               |
| `recipeIngredient`   | `ingredients[]`      | Parse ingredient strings to structured format |
| `recipeInstructions` | `instructions`       | Concatenate HowToStep array or use text       |
| `suitableForDiet`    | `dietaryTags`        | Map Schema.org diet types to our tags         |
| `tool`               | `cookwareType`       | Infer from equipment list                     |
| `url`                | `sourceReference`    | Original URL                                  |
| N/A                  | `sourceType`         | Set to 'web-imported'                         |

### Error Handling Strategy

| Error Scenario             | User Experience                      | Fallback Options                        |
| -------------------------- | ------------------------------------ | --------------------------------------- |
| Invalid URL format         | Inline validation error              | Correct URL format                      |
| Network failure / timeout  | Error dialog with retry button       | Retry, manual entry, AI generation      |
| No Schema.org markup found | Error dialog explaining issue        | Manual entry, AI generation, paste HTML |
| Multiple recipes on page   | Show list, user selects one          | Import selected recipe                  |
| Missing required fields    | Show partial data, highlight missing | User completes missing fields           |
| Constraint violations      | Show validation errors in form       | User edits to fix violations            |
| Malformed JSON-LD          | Error dialog with details            | Manual entry, AI generation             |

## Implementation Instructions (For Implementor)

---

### **Action ID: PLAN-601**

**Change Type:** create  
**File(s):** `src/shared/types/schema-org.ts`

**Instruction:**
Create TypeScript type definitions for Schema.org Recipe format based on https://schema.org/Recipe specification.

**Interfaces / Pseudocode:**

```typescript
// Schema.org Recipe type (subset of properties we care about)
export interface SchemaOrgRecipe {
  '@context': string; // "https://schema.org"
  '@type': 'Recipe';
  name: string;
  image?: string | string[];
  author?: SchemaOrgPerson | string;
  datePublished?: string; // ISO 8601 date
  description?: string;
  recipeYield?: string | number; // "4 servings" or 4
  prepTime?: string; // ISO 8601 duration: "PT15M"
  cookTime?: string; // ISO 8601 duration: "PT30M"
  totalTime?: string; // ISO 8601 duration: "PT45M"
  recipeIngredient?: string[]; // ["2 cups flour", "1 tsp salt"]
  recipeInstructions?: string | SchemaOrgHowToStep[] | string[];
  recipeCuisine?: string;
  recipeCategory?: string;
  keywords?: string | string[];
  suitableForDiet?: string | string[]; // Schema.org diet type URLs
  tool?: string | SchemaOrgHowToTool[]; // Equipment/cookware
  nutrition?: SchemaOrgNutritionInformation;
  url?: string; // Original recipe URL
}

export interface SchemaOrgPerson {
  '@type': 'Person';
  name: string;
}

export interface SchemaOrgHowToStep {
  '@type': 'HowToStep';
  text: string;
  name?: string;
  url?: string;
}

export interface SchemaOrgHowToTool {
  '@type': 'HowToTool';
  name: string;
}

export interface SchemaOrgNutritionInformation {
  '@type': 'NutritionInformation';
  calories?: string;
  carbohydrateContent?: string;
  proteinContent?: string;
  fatContent?: string;
  // Add other nutrition fields as needed
}
```

**Evidence:** Research document lines 113-131 describe Schema.org Recipe standard properties.

**Done When:**

- File `src/shared/types/schema-org.ts` exists
- Contains TypeScript interfaces for Schema.org Recipe and related types
- Exports all type definitions
- Types match Schema.org v29.4 specification

---

### **Action ID: PLAN-602**

**Change Type:** create  
**File(s):** `src/main/web/recipe-importer.ts`

**Instruction:**
Create the core web recipe importer that fetches URLs and extracts Schema.org JSON-LD data using Electron's BrowserWindow.

**Implementation Steps:**

1. Create `extractSchemaOrgRecipe(url: string): Promise<SchemaOrgRecipe>` function
2. Validate URL format (must be http/https)
3. Create isolated BrowserWindow with security settings:
   - `nodeIntegration: false`
   - `contextIsolation: true`
   - `sandbox: true`
   - `webSecurity: true`
   - `show: false` (hidden window)
4. Load URL with timeout (15 seconds)
5. Execute script in page context to extract JSON-LD:
   ```javascript
   const scripts = document.querySelectorAll('script[type="application/ld+json"]');
   const recipes = [];
   scripts.forEach(script => {
     try {
       const data = JSON.parse(script.textContent);
       if (data['@type'] === 'Recipe') recipes.push(data);
       if (Array.isArray(data['@graph'])) {
         data['@graph'].forEach(item => {
           if (item['@type'] === 'Recipe') recipes.push(item);
         });
       }
     } catch (e) {
       /* ignore malformed JSON */
     }
   });
   return recipes;
   ```
6. Close BrowserWindow
7. If no recipes found, throw error `No Schema.org recipe markup found`
8. If multiple recipes found, return first one (or throw error to let caller handle)
9. Return parsed SchemaOrgRecipe

**Error Handling:**

- Throw descriptive errors for each failure scenario
- Cleanup BrowserWindow in finally block
- Add timeout protection

**Evidence:** MASTER plan lines 280-285 describe BrowserWindow extraction pattern.

**Done When:**

- File `src/main/web/recipe-importer.ts` exists
- `extractSchemaOrgRecipe()` function works with real URLs
- Handles errors gracefully with descriptive messages
- Closes BrowserWindow properly (no leaks)
- Respects 15-second timeout

---

### **Action ID: PLAN-603**

**Change Type:** create  
**File(s):** `src/main/web/schema-org-adapter.ts`

**Instruction:**
Create adapter that converts Schema.org Recipe format to our CreateRecipeInput format.

**Implementation Steps:**

1. Create `schemaOrgToRecipeInput(schemaRecipe: SchemaOrgRecipe, sourceUrl: string): CreateRecipeInput` function
2. Map basic fields (name → title)
3. Parse ISO 8601 durations to minutes:
   ```typescript
   function parseDuration(iso: string): number {
     // "PT30M" → 30, "PT1H30M" → 90, "PT45S" → 1 (round up)
     const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
     if (!match) return 0;
     const hours = parseInt(match[1] || '0');
     const minutes = parseInt(match[2] || '0');
     const seconds = parseInt(match[3] || '0');
     return hours * 60 + minutes + Math.ceil(seconds / 60);
   }
   ```
4. Parse recipeYield to servings number:
   ```typescript
   function parseServings(yield: string | number): number {
     if (typeof yield === 'number') return yield;
     const match = yield.match(/\d+/);
     return match ? parseInt(match[0]) : 2; // default to 2
   }
   ```
5. Parse ingredient strings to CreateIngredientInput:
   ```typescript
   function parseIngredient(ingredientString: string, index: number): CreateIngredientInput {
     // Extract quantity, unit, name from "2 cups flour"
     // Use regex or simple heuristics
     // Set dietaryProperties: [] (will be filled by user review)
     // Set orderIndex: index
   }
   ```
6. Map suitableForDiet to our DietaryTag enum:
   ```typescript
   const dietMap: Record<string, DietaryTag> = {
     'https://schema.org/GlutenFreeDiet': 'gluten-free',
     'https://schema.org/LowLactoseDiet': 'lactose-free',
     'https://schema.org/VegetarianDiet': 'vegetarian',
     'https://schema.org/VeganDiet': 'vegan',
   };
   ```
7. Infer cookwareType from tool field (default to 'one-pan' if uncertain)
8. Set sourceType: 'web-imported'
9. Set sourceReference: sourceUrl
10. Handle missing fields by setting defaults or marking for user completion

**Edge Cases:**

- recipeInstructions as string vs. HowToStep array
- Missing cookTime/prepTime (require user to fill in)
- Missing ingredients (error, cannot import)
- Unusual units (keep as-is, user can edit)

**Evidence:** Research lines 122-131 describe Schema.org field structure.

**Done When:**

- File `src/main/web/schema-org-adapter.ts` exists
- `schemaOrgToRecipeInput()` converts all required fields
- Handles missing optional fields gracefully
- Returns valid CreateRecipeInput that can pass validation (if recipe is compliant)
- Unit tested with sample Schema.org recipes

---

### **Action ID: PLAN-604**

**Change Type:** create  
**File(s):** `src/main/ipc/recipe-import-handlers.ts`

**Instruction:**
Create IPC handler for web recipe import that orchestrates URL fetching, parsing, and validation.

**Implementation Steps:**

1. Create `registerRecipeImportHandlers()` function
2. Register IPC handler: `ipcMain.handle('recipe:import', async (_event, url: string) => { ... })`
3. Validate sender (same pattern as Phase 5 AI handlers)
4. Call `extractSchemaOrgRecipe(url)` to fetch and parse
5. Call `schemaOrgToRecipeInput(schemaRecipe, url)` to convert
6. **Important**: Do NOT call `validateRecipe()` or `createRecipe()` in this handler
   - Return the parsed recipe data to renderer
   - Let user review/edit in UI
   - User confirms → separate `recipe:create` call will validate and save
7. Handle errors and return structured response:
   ```typescript
   try {
     const schemaRecipe = await extractSchemaOrgRecipe(url);
     const recipeInput = schemaOrgToRecipeInput(schemaRecipe, url);
     return { success: true, recipe: recipeInput };
   } catch (error) {
     return {
       success: false,
       errors: [{ field: 'general', message: error.message }],
     };
   }
   ```

**Security:**

- Validate event.sender (same as Phase 5 pattern)
- Validate URL format before passing to importer
- Add timeout for entire operation (20 seconds)

**Evidence:** Existing IPC handler pattern in `src/main/ipc/recipe-handlers.ts:1-88` and `src/main/ipc/recipe-ai-handlers.ts`.

**Done When:**

- File `src/main/ipc/recipe-import-handlers.ts` exists
- `registerRecipeImportHandlers()` function implemented
- Handler returns `{ success: true, recipe: CreateRecipeInput }` on success
- Handler returns `{ success: false, errors: [...] }` on failure
- Sender validation implemented
- Timeout protection added

---

### **Action ID: PLAN-605**

**Change Type:** modify  
**File(s):** `src/main/main.ts`

**Instruction:**
Register the recipe import handlers in the main process.

**Implementation Steps:**

1. Import `registerRecipeImportHandlers` from `./ipc/recipe-import-handlers.js`
2. Call `registerRecipeImportHandlers()` after existing handler registrations (after `registerRecipeHandlers()` and `registerRecipeAIHandlers()`)

**Evidence:** `src/main/main.ts` already registers other IPC handlers (from Phase 3, 5).

**Done When:**

- `registerRecipeImportHandlers()` is called in main.ts
- App can handle `recipe:import` IPC calls

---

### **Action ID: PLAN-606**

**Change Type:** modify  
**File(s):** `src/main/preload.ts`

**Instruction:**
Expose `importRecipe` function to renderer process via contextBridge.

**Implementation Steps:**

1. Add to `recipeAPI` object in `contextBridge.exposeInMainWorld()`:
   ```typescript
   recipeAPI: {
     // ... existing functions
     importRecipe: (url: string) => ipcRenderer.invoke('recipe:import', url),
   }
   ```

**Evidence:** Existing preload pattern in `src/main/preload.ts` (from Phase 3, 5).

**Done When:**

- `window.electron.recipeAPI.importRecipe(url)` is available in renderer
- TypeScript types updated (next step)

---

### **Action ID: PLAN-607**

**Change Type:** modify  
**File(s):** `src/shared/types/electron.d.ts`

**Instruction:**
Update TypeScript type definitions for Electron API to include `importRecipe`.

**Implementation Steps:**

1. Add to `RecipeAPI` interface:
   ```typescript
   interface RecipeAPI {
     // ... existing methods
     importRecipe: (url: string) => Promise<{
       success: boolean;
       recipe?: CreateRecipeInput;
       errors?: Array<{ field: string; message: string }>;
     }>;
   }
   ```

**Evidence:** Existing pattern in `src/shared/types/electron.d.ts` (from Phase 3, 5).

**Done When:**

- TypeScript recognizes `window.electron.recipeAPI.importRecipe()` with correct types
- No type errors in renderer code using this API

---

### **Action ID: PLAN-608**

**Change Type:** create  
**File(s):** `src/renderer/pages/RecipeImportPage.tsx`

**Instruction:**
Create UI component for web recipe import workflow.

**Implementation Steps:**

1. Create functional component `RecipeImportPage`
2. State management:
   ```typescript
   const [url, setUrl] = useState('');
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [importedRecipe, setImportedRecipe] = useState<CreateRecipeInput | null>(null);
   const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
   ```
3. URL input form:
   - Text input for URL
   - "Import Recipe" button
   - Validates URL format client-side before calling IPC
   - Shows loading spinner during import
4. `handleImport` function:
   ```typescript
   const handleImport = async () => {
     setLoading(true);
     setError(null);
     try {
       const result = await window.electron.recipeAPI.importRecipe(url);
       if (result.success) {
         setImportedRecipe(result.recipe);
         // Don't save yet - show review form
       } else {
         setError(result.errors[0].message);
       }
     } catch (err) {
       setError('Failed to import recipe');
     } finally {
       setLoading(false);
     }
   };
   ```
5. Recipe review section:
   - Display imported recipe data
   - Reuse `RecipeForm` component for editing
   - Show validation errors (call validateRecipe on imported data)
   - "Save Recipe" button → calls `window.electron.recipeAPI.create()`
   - "Cancel" button → reset state
6. Error display:
   - Show import errors clearly
   - Suggest alternatives (manual entry, AI generation)

**UI Mockup:**

```
┌─────────────────────────────────────────────────┐
│ Import Recipe from Web                          │
├─────────────────────────────────────────────────┤
│ Enter Recipe URL:                               │
│ [https://www.example.com/recipe/...          ] │
│                                                 │
│ [Import Recipe]                                 │
│                                                 │
│ {if loading: "Fetching recipe..."}             │
│ {if error: "❌ Error: ..."}                     │
│                                                 │
│ {if imported:                                   │
│   Recipe Preview:                               │
│   Title: Chicken Stir-Fry                      │
│   Time: 30 minutes                             │
│   Servings: 2                                  │
│   ...                                          │
│                                                 │
│   {RecipeForm component for editing}           │
│                                                 │
│   [Save Recipe] [Cancel]                       │
│ }                                               │
└─────────────────────────────────────────────────┘
```

**Evidence:** Similar pattern in `RecipeGenerationPage.tsx` from Phase 5.

**Done When:**

- File `src/renderer/pages/RecipeImportPage.tsx` exists
- User can enter URL and import recipe
- Imported recipe displays in editable form
- User can review, edit, and save recipe
- Errors display clearly with helpful messages

---

### **Action ID: PLAN-609**

**Change Type:** modify  
**File(s):** `src/renderer/App.tsx`

**Instruction:**
Add navigation to Recipe Import page.

**Implementation Steps:**

1. Import `RecipeImportPage` component
2. Add route/tab/button to access import page (depends on current navigation structure)
3. Ensure user can navigate between Add Recipe (manual), Generate Recipe (AI), and Import Recipe (web)

**Evidence:** Existing navigation in `App.tsx` (from Phase 3, 4, 5).

**Done When:**

- User can access Recipe Import page from main navigation
- Navigation flow is clear and intuitive

---

### **Action ID: PLAN-610**

**Change Type:** create  
**File(s):** `src/main/web/schema-org-adapter.test.ts`

**Instruction:**
Create unit tests for Schema.org adapter with sample recipes.

**Test Cases:**

1. **Complete Schema.org recipe** → converts to valid CreateRecipeInput
2. **Missing optional fields** (prepTime, description) → uses defaults
3. **ISO 8601 duration parsing** → PT30M = 30, PT1H30M = 90
4. **Ingredient parsing** → "2 cups flour" → { quantity: 2, unit: 'cups', name: 'flour' }
5. **Multiple suitableForDiet values** → maps to multiple dietaryTags
6. **recipeInstructions as string** → stores in instructions field
7. **recipeInstructions as HowToStep array** → concatenates steps
8. **recipeYield as string** → "4 servings" → servings: 4
9. **recipeYield as number** → 2 → servings: 2

**Sample Schema.org Recipe:**

```typescript
const sampleSchemaRecipe: SchemaOrgRecipe = {
  '@context': 'https://schema.org',
  '@type': 'Recipe',
  name: 'Quick Chicken Stir-Fry',
  cookTime: 'PT30M',
  prepTime: 'PT15M',
  recipeYield: '2 servings',
  recipeIngredient: ['1 lb chicken breast', '2 tbsp olive oil', '1 cup broccoli florets'],
  recipeInstructions: 'Cook chicken, add vegetables, serve.',
  suitableForDiet: ['https://schema.org/GlutenFreeDiet'],
  url: 'https://example.com/recipe/123',
};
```

**Evidence:** Unit testing pattern from Phase 2, 5.

**Done When:**

- All test cases pass
- Edge cases covered
- 100% code coverage for adapter functions

---

### **Action ID: PLAN-611**

**Change Type:** create  
**File(s):** `src/main/web/recipe-importer.test.ts`

**Instruction:**
Create unit tests for recipe importer with mocked BrowserWindow.

**Test Strategy:**

- Mock Electron's BrowserWindow to avoid real network requests
- Test URL validation
- Test JSON-LD extraction logic
- Test error handling (timeout, no markup, malformed JSON)

**Test Cases:**

1. **Valid URL with Schema.org recipe** → returns SchemaOrgRecipe
2. **Invalid URL format** → throws error
3. **Network timeout** → throws timeout error
4. **No Schema.org markup** → throws "No recipe markup found"
5. **Malformed JSON-LD** → skips and continues
6. **Multiple recipes on page** → returns first recipe
7. **Recipe in @graph array** → extracts correctly

**Mock Pattern:**

```typescript
vi.mock('electron', () => ({
  BrowserWindow: class MockBrowserWindow {
    loadURL = vi.fn();
    webContents = {
      executeJavaScript: vi.fn().mockResolvedValue([mockRecipeData]),
    };
    close = vi.fn();
  },
}));
```

**Evidence:** Testing pattern from Phase 5 (mocked OpenAI SDK).

**Done When:**

- All test cases pass
- BrowserWindow properly mocked
- No real network requests in tests
- Edge cases covered

---

### **Action ID: PLAN-612**

**Change Type:** create  
**File(s):** `src/main/ipc/recipe-import-handlers.test.ts`

**Instruction:**
Create integration tests for IPC handler with mocked web importer.

**Test Cases:**

1. **Successful import** → returns `{ success: true, recipe: CreateRecipeInput }`
2. **Import failure (no markup)** → returns `{ success: false, errors: [...] }`
3. **Invalid URL** → returns `{ success: false, errors: [...] }`
4. **Sender validation** → rejects invalid sender
5. **Timeout protection** → fails gracefully after timeout

**Mock Pattern:**

```typescript
vi.mock('../web/recipe-importer.js', () => ({
  extractSchemaOrgRecipe: vi.fn().mockResolvedValue(mockSchemaRecipe),
}));
```

**Evidence:** IPC handler testing pattern from Phase 3, 5.

**Done When:**

- All test cases pass
- Handler behavior verified
- Error scenarios covered
- Security validation tested

---

### **Action ID: PLAN-613**

**Change Type:** create  
**File(s):** `e2e/recipe-import.spec.ts`

**Instruction:**
Create E2E test for complete recipe import workflow.

**Test Scenarios:**

1. **Happy path: Import recipe from URL**
   - Navigate to Import page
   - Enter URL
   - Click Import
   - Review imported recipe
   - Save recipe
   - Verify recipe appears in collection
2. **Error handling: Invalid URL**
   - Enter invalid URL
   - Click Import
   - Verify error message displays
3. **Constraint violation handling**
   - Import recipe with violations
   - Verify validation errors display
   - Edit to fix violations
   - Save successfully

**Mock Strategy:**

```typescript
// Mock the recipe:import IPC call to return sample data
await page.evaluate(() => {
  window.electron.recipeAPI.importRecipe = async url => ({
    success: true,
    recipe: {
      title: 'Test Recipe',
      cookingTimeMinutes: 30,
      // ... rest of recipe
    },
  });
});
```

**Evidence:** E2E testing pattern from Phase 3, 4, 5 in `e2e/` directory.

**Done When:**

- E2E test passes
- Full workflow verified end-to-end
- Error scenarios tested
- Test runs in CI

---

### **Action ID: PLAN-614**

**Change Type:** create  
**File(s):** `docs/user-guide-web-import.md`

**Instruction:**
Create user documentation for web recipe import feature.

**Content Structure:**

1. **Overview**: What is web recipe import, why use it
2. **How to Import a Recipe**:
   - Step-by-step with screenshots/mockups
   - Finding the recipe URL
   - Entering URL in app
   - Reviewing imported recipe
   - Editing if needed
   - Saving recipe
3. **Supported Websites**: List major sites known to work (AllRecipes, Food Network, NYT Cooking, etc.)
4. **Troubleshooting**:
   - "No recipe found" error → site doesn't have Schema.org markup
   - "Invalid URL" error → check URL format
   - Network errors → check internet connection
   - Constraint violations → edit recipe to fix
5. **Limitations**:
   - Only works with sites that have Schema.org markup
   - Some sites may block automated access
   - Imported recipes may need manual adjustment
6. **Alternatives**: If import fails, try manual entry or AI generation

**Tone**: Clear, helpful, non-technical.

**Evidence:** User guide pattern from Phase 5 in `docs/user-guide-ai-generation.md`.

**Done When:**

- File `docs/user-guide-web-import.md` exists
- Covers all key user scenarios
- Troubleshooting section is comprehensive
- Clear and accessible to non-technical users

---

### **Action ID: PLAN-615**

**Change Type:** create  
**File(s):** `docs/dev-guide-phase6.md`

**Instruction:**
Create developer documentation for Phase 6 implementation.

**Content Structure:**

1. **Architecture Overview**:
   - Component diagram
   - Data flow diagram
   - File structure
2. **Technical Details**:
   - Schema.org JSON-LD extraction using BrowserWindow
   - ISO 8601 duration parsing
   - Ingredient string parsing heuristics
   - Security considerations
3. **API Reference**:
   - `extractSchemaOrgRecipe(url)` function signature
   - `schemaOrgToRecipeInput(schemaRecipe, url)` function signature
   - IPC handler `recipe:import` contract
4. **Testing Strategy**:
   - Unit tests with mocked BrowserWindow
   - Integration tests with mocked importer
   - E2E tests with mocked IPC
5. **Known Limitations**:
   - Requires Schema.org markup
   - Simple ingredient parsing (no complex NLP)
   - Cookware inference is heuristic
6. **Future Enhancements**:
   - recipe-scrapers Python bridge for non-Schema.org sites
   - Browser extension for easier URL capture
   - Batch import from multiple URLs
   - Improved ingredient parsing with AI

**Evidence:** Developer guide pattern from Phase 5 in `docs/dev-guide-phase5.md`.

**Done When:**

- File `docs/dev-guide-phase6.md` exists
- Comprehensive technical reference
- Clear for future developers
- Documents design decisions and trade-offs

---

### **Action ID: PLAN-616**

**Change Type:** modify  
**File(s):** `README.md`

**Instruction:**
Add Phase 6 (Web Recipe Import) to README.

**Implementation Steps:**

1. Add "Import recipes from websites" to features list
2. Add note about Schema.org compatibility
3. Update development status to show Phase 6 complete

**Evidence:** README updated in previous phases (1-5).

**Done When:**

- README mentions web recipe import feature
- Clear for new users and contributors

---

## Verification Tasks

### **VERIFY-601: Manual Import from Real Recipe Sites**

**Assumption:** Phase 6 implementation is complete and app is running.

**Verification Step:**

1. Start app in dev mode: `npm run dev`
2. Navigate to Recipe Import page
3. Test with real URLs from major sites:
   - AllRecipes: https://www.allrecipes.com/recipe/... (any recipe)
   - Food Network: https://www.foodnetwork.com/recipes/... (any recipe)
   - NYT Cooking: https://cooking.nytimes.com/recipes/... (any recipe)
   - Bon Appétit: https://www.bonappetit.com/recipe/... (any recipe)
4. Verify recipe data imports correctly
5. Verify user can review and edit
6. Verify recipe saves successfully

**Pass Condition:**

- At least 3 out of 4 sites import successfully
- Imported data is accurate (title, time, ingredients)
- User can complete the workflow without errors

---

### **VERIFY-602: Error Handling - Invalid URL**

**Verification Step:**

1. Enter invalid URL format: `not-a-url`
2. Enter URL without protocol: `example.com/recipe`
3. Enter empty URL
4. Click Import for each case

**Pass Condition:**

- Clear error message displays for each case
- App does not crash
- User can correct and retry

---

### **VERIFY-603: Error Handling - No Schema.org Markup**

**Verification Step:**

1. Enter URL of site known to lack Schema.org markup (e.g., Wikipedia, GitHub)
2. Click Import

**Pass Condition:**

- Error message: "No Schema.org recipe markup found on this page"
- Suggests alternatives (manual entry, AI generation)
- App does not crash

---

### **VERIFY-604: Constraint Violation Detection**

**Verification Step:**

1. Import a recipe that violates constraints (e.g., >45 minutes, contains gluten)
2. Verify validation errors display in review form
3. Edit recipe to fix violations
4. Save successfully

**Pass Condition:**

- Validation errors display clearly
- User can edit to fix
- Recipe saves after fixing violations
- Recipe does not save with violations

---

### **VERIFY-605: All Unit Tests Pass**

**Verification Step:**

```bash
npm run test:unit
```

**Pass Condition:**

- All existing tests pass (from Phase 0-5)
- All new Phase 6 unit tests pass (adapter, importer)
- No test failures or regressions

---

### **VERIFY-606: All Integration Tests Pass**

**Verification Step:**

```bash
npm run test:integration
```

**Pass Condition:**

- IPC handler tests pass
- All Phase 6 integration tests pass
- No test failures or regressions

---

### **VERIFY-607: All E2E Tests Pass**

**Verification Step:**

```bash
npm run test:e2e
```

**Pass Condition:**

- Recipe import E2E test passes
- All existing E2E tests still pass (Phase 3, 4, 5)
- No test failures or regressions

---

### **VERIFY-608: Documentation Accuracy**

**Verification Step:**

1. Read `docs/user-guide-web-import.md`
2. Follow instructions exactly as written
3. Check developer guide against actual code
4. Verify README is up-to-date

**Pass Condition:**

- User guide instructions work as documented
- Developer guide accurately describes implementation
- README reflects Phase 6 completion
- No misleading or incorrect information

---

## Acceptance Criteria

**Epic-Level Acceptance Criteria (from MASTER plan):**

- [x] A user can import a recipe from a web URL, adapt if needed, and store it (Functional AC 3)
- [x] Recipe data persists across application restarts (Functional AC 8)
- [x] All recipes conform to Schema.org-aligned schema (Technical AC 1)
- [x] Constraint validation runs before persistence and blocks non-compliant recipes (Technical AC 4)
- [x] Integration tests demonstrate web import acquisition mode end-to-end (Quality AC 2)

**Phase 6-Specific Acceptance Criteria:**

- [ ] User can enter a recipe URL and import recipe data automatically
- [ ] Schema.org JSON-LD extraction works on 90%+ of major recipe sites
- [ ] Imported recipes display in editable review form before saving
- [ ] User can fix constraint violations in review form
- [ ] Imported recipes save with `sourceType: 'web-imported'` and original URL in `sourceReference`
- [ ] Clear error messages for common failure scenarios (no markup, network error, invalid URL)
- [ ] Import workflow completes in <30 seconds for typical recipe site
- [ ] No security vulnerabilities (isolated BrowserWindow, URL validation, timeout protection)
- [ ] All tests pass (unit, integration, E2E)
- [ ] User and developer documentation is complete and accurate

**Milestone Achieved:** **MVP 4 - Users can import recipes from web sources**

---

## Implementor Checklist

**Setup & Types (Priority 1 - CRITICAL PATH):**

- [ ] PLAN-601: Create Schema.org type definitions

**Core Services (Priority 1 - CRITICAL PATH, Sequential):**

- [ ] PLAN-602: Create web recipe importer (URL fetch + JSON-LD extraction)
- [ ] PLAN-603: Create Schema.org adapter (convert to CreateRecipeInput)
- [ ] PLAN-604: Create IPC handler for recipe import
- [ ] PLAN-605: Register handlers in main.ts
- [ ] PLAN-606: Update preload.ts to expose importRecipe
- [ ] PLAN-607: Update electron.d.ts with type definitions

**UI (Priority 2):**

- [ ] PLAN-608: Create RecipeImportPage component
- [ ] PLAN-609: Update App.tsx navigation

**Testing (Priority 3, Can Run in Parallel):**

- [ ] PLAN-610: Unit tests for Schema.org adapter
- [ ] PLAN-611: Unit tests for recipe importer
- [ ] PLAN-612: Integration tests for IPC handler
- [ ] PLAN-613: E2E test for import workflow

**Documentation (Priority 4, Can Run in Parallel):**

- [ ] PLAN-614: Create user guide for web import
- [ ] PLAN-615: Create developer guide for Phase 6
- [ ] PLAN-616: Update README

**Verification (Priority 5 - FINAL):**

- [ ] VERIFY-601: Manual import from real sites
- [ ] VERIFY-602: Error handling - invalid URL
- [ ] VERIFY-603: Error handling - no Schema.org markup
- [ ] VERIFY-604: Constraint violation detection
- [ ] VERIFY-605: All unit tests pass
- [ ] VERIFY-606: All integration tests pass
- [ ] VERIFY-607: All E2E tests pass
- [ ] VERIFY-608: Documentation accuracy

---

## Risk Register

**Risk 1: Schema.org Markup Inconsistency Across Sites**  
**Impact:** Import success rate <90% on major sites  
**Mitigation:** Test with top 10 recipe sites during development, document known compatibility  
**Status:** Medium risk (Schema.org adoption varies by site)

**Risk 2: Ingredient Parsing Ambiguity**  
**Impact:** Imported ingredients lack proper structure (quantities, units)  
**Mitigation:** Use simple regex parsing, rely on user review/edit to correct, future: use AI for parsing  
**Status:** Low risk (user review step catches issues)

**Risk 3: Security Vulnerability in BrowserWindow**  
**Impact:** Malicious sites could exploit app  
**Mitigation:** Isolated BrowserWindow with sandbox, no node integration, URL validation, timeout  
**Status:** Low risk (standard Electron security practices applied)

**Risk 4: Legal/ToS Concerns with Automated Fetching**  
**Impact:** Some sites may block or prohibit automated access  
**Mitigation:** User-driven import (user initiates each fetch), respect robots.txt, add user disclaimer  
**Status:** Low risk (user-driven approach is lowest-risk option)

**Risk 5: Network Failures During Import**  
**Impact:** User frustration with failed imports  
**Mitigation:** Clear error messages, retry capability, alternative workflows (manual entry, AI generation)  
**Status:** Low risk (good error handling mitigates)

---

## Traceability Matrix (Epic Stories → Phase 6 Tasks)

| Epic User Story             | Phase 6 Tasks                                    | Acceptance Criteria                              |
| --------------------------- | ------------------------------------------------ | ------------------------------------------------ |
| Story 3: Web Recipe Import  | PLAN-601 to PLAN-616, VERIFY-601 to VERIFY-608   | Functional AC 3, Technical AC 1, 4, Quality AC 2 |
| Story 4: Dietary Validation | PLAN-604 (validation in IPC handler), VERIFY-604 | Functional AC 4-5, Quality AC 3                  |
| Story 6: Local Persistence  | Reuses Phase 1 DAL (createRecipe)                | Functional AC 8, Technical AC 1-5                |

---

## Dependencies and Assumptions

**Dependencies (MUST be complete before starting):**

- Phase 0: Project structure, Electron setup ✅
- Phase 1: Database layer with createRecipe() ✅
- Phase 2: Validation system with validateRecipe() ✅
- Phase 3: Recipe form component for editing ✅
- Phase 4: Recipe viewing (to see imported recipes) ✅
- Phase 5: IPC pattern and error handling established ✅

**Assumptions:**

- User has internet connection for fetching recipe URLs
- User understands that not all recipe sites will work (only Schema.org-enabled sites)
- User is willing to review and edit imported recipes before saving
- Electron's BrowserWindow API is stable and secure for this use case
- Schema.org Recipe specification remains stable (v29.4 as of Dec 2025)

---

## Performance Targets

**Import Workflow Performance:**

- URL fetch + parse: <15 seconds (network dependent)
- Schema.org extraction: <2 seconds (local processing)
- Adapter conversion: <1 second (local processing)
- Total workflow (URL entry to review form): <20 seconds
- User perceived responsiveness: Loading spinners for all async operations

**Testing Performance:**

- Unit tests (mocked): <100ms per test
- Integration tests (mocked): <500ms per test
- E2E tests (mocked): <10 seconds per test

---

## Security Checklist

- [ ] URL validation (must be http/https)
- [ ] BrowserWindow isolation (nodeIntegration: false, sandbox: true)
- [ ] Timeout protection (15 seconds for URL fetch)
- [ ] IPC sender validation
- [ ] No user data in URL requests (privacy)
- [ ] Preload script uses contextBridge (no direct IPC exposure)
- [ ] contextIsolation enabled in BrowserWindow
- [ ] User disclaimer about web scraping legality/ToS

---

## Next Steps (For Implementor)

1. **Review this plan** and confirm understanding of web recipe import approach
2. **Verify dependencies**: Ensure Phase 0-5 are complete and tests pass
3. **Execute tasks in order**: Priority 1 → Priority 2 → Priority 3 → Priority 4 → Priority 5
4. **Update STATE file** after completing each task
5. **Run verification tasks** before marking phase complete
6. **Proceed to Phase 7** (Integration Testing & Performance Validation) after Phase 6 verification

---

## Appendix: Schema.org Example

**Sample Recipe JSON-LD from Real Site:**

```json
{
  "@context": "https://schema.org",
  "@type": "Recipe",
  "name": "Quick Chicken Stir-Fry",
  "author": {
    "@type": "Person",
    "name": "Chef John"
  },
  "datePublished": "2024-01-15",
  "description": "A quick and easy chicken stir-fry recipe",
  "prepTime": "PT15M",
  "cookTime": "PT30M",
  "totalTime": "PT45M",
  "recipeYield": "2 servings",
  "recipeIngredient": [
    "1 lb chicken breast, cubed",
    "2 tbsp olive oil",
    "1 cup broccoli florets",
    "1 bell pepper, sliced",
    "2 tbsp gluten-free soy sauce",
    "1 tsp ginger, minced"
  ],
  "recipeInstructions": [
    {
      "@type": "HowToStep",
      "text": "Heat oil in a large pan over medium-high heat."
    },
    {
      "@type": "HowToStep",
      "text": "Add chicken and cook until browned, about 5-7 minutes."
    },
    {
      "@type": "HowToStep",
      "text": "Add vegetables and stir-fry for 5 minutes."
    },
    {
      "@type": "HowToStep",
      "text": "Add soy sauce and ginger, cook for 2 more minutes."
    },
    {
      "@type": "HowToStep",
      "text": "Serve hot over rice or noodles."
    }
  ],
  "suitableForDiet": "https://schema.org/GlutenFreeDiet",
  "recipeCuisine": "Asian",
  "recipeCategory": "Main Dish",
  "keywords": "chicken, stir-fry, quick, easy",
  "nutrition": {
    "@type": "NutritionInformation",
    "calories": "350 calories"
  },
  "url": "https://example.com/recipes/chicken-stir-fry"
}
```

**After Conversion to CreateRecipeInput:**

```typescript
{
  title: "Quick Chicken Stir-Fry",
  cookingTimeMinutes: 30,
  prepTimeMinutes: 15,
  totalTimeMinutes: 45, // calculated or from totalTime
  cookwareType: "one-pan", // inferred from instructions
  servings: 2,
  dietaryTags: ["gluten-free"], // from suitableForDiet
  seasonality: ["any"], // default
  sourceType: "web-imported",
  sourceReference: "https://example.com/recipes/chicken-stir-fry",
  instructions: "Heat oil... Add chicken... Add vegetables... Add soy sauce... Serve hot...",
  ingredients: [
    { name: "chicken breast, cubed", quantity: 1, unit: "lb", dietaryProperties: [], optional: false, orderIndex: 0 },
    { name: "olive oil", quantity: 2, unit: "tbsp", dietaryProperties: [], optional: false, orderIndex: 1 },
    { name: "broccoli florets", quantity: 1, unit: "cup", dietaryProperties: [], optional: false, orderIndex: 2 },
    { name: "bell pepper, sliced", quantity: 1, unit: "whole", dietaryProperties: [], optional: false, orderIndex: 3 },
    { name: "gluten-free soy sauce", quantity: 2, unit: "tbsp", dietaryProperties: [], optional: false, orderIndex: 4 },
    { name: "ginger, minced", quantity: 1, unit: "tsp", dietaryProperties: [], optional: false, orderIndex: 5 }
  ]
}
```

---

**End of Phase 6 Implementation Plan**  
**Next**: Create STATE file and begin execution of tasks in priority order.
