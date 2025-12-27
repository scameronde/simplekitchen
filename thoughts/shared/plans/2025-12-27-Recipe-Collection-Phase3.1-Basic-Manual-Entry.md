# Phase 3.1: Basic Manual Entry (Minimal Viable Form) - Implementation Plan

## Inputs

- **Research Report**: `thoughts/shared/research/2025-12-25-Recipe-Collection-Management.md`
- **Epic**: `thoughts/shared/epics/2025-12-25-Recipe-Collection-Management.md`
- **Master Plan**: `thoughts/shared/plans/2025-12-25-Recipe-Collection-Management-MASTER.md`
- **Phase 0 State**: `thoughts/shared/plans/2025-12-25-Recipe-Collection-Phase0-Stack-Selection-STATE.md` (COMPLETE)
- **Phase 1 State**: `thoughts/shared/plans/2025-12-26-Recipe-Collection-Phase1-Data-Persistence-STATE.md` (COMPLETE)
- **Phase 2 State**: `thoughts/shared/plans/2025-12-26-Recipe-Collection-Phase2-Constraint-Validation-STATE.md` (COMPLETE)
- **Original Phase 3 Plan**: `thoughts/shared/plans/2025-12-26-Recipe-Collection-Phase3-Manual-Entry.md` (SPLIT)

## Verified Current State

**Fact:** Phase 0, 1, and 2 are complete with all tests passing.  
**Evidence:** STATE files show all tasks completed (18/18, 15/15, 15/15 respectively)  
**Excerpt:** Phase 0: "Current Task: COMPLETE", Phase 1: "Completed: 15 / 15 ✅", Phase 2: "Completed: 15 / 15 ✅"

**Fact:** Database layer with Recipe and Ingredient CRUD operations exists.  
**Evidence:** `src/main/database/dal/recipes.ts:28-79`  
**Excerpt:**

```typescript
export async function createRecipe(input: CreateRecipeInput): Promise<Recipe> {
  const recipeId = randomUUID();
  // Validate recipe before persisting
  await validateRecipeOrThrow(input);
  // Insert recipe and ingredients...
}
```

**Fact:** Validation orchestrator integrates all constraint validators.  
**Evidence:** `src/main/validation/validator.ts:10-49`  
**Excerpt:**

```typescript
export async function validateRecipe(
  recipeInput: CreateRecipeInput | UpdateRecipeInput
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  // Run all validators in parallel...
}
```

**Fact:** Recipe type definitions include CreateRecipeInput with all required fields.  
**Evidence:** `src/shared/types/recipe.ts:50-63`  
**Excerpt:**

```typescript
export interface CreateRecipeInput {
  title: string;
  cookingTimeMinutes: number;
  cookwareType: CookwareType;
  servings: number;
  dietaryTags: DietaryTag[];
  seasonality: Season[];
  sourceType: SourceType;
  ingredients: CreateIngredientInput[];
}
```

**Fact:** No IPC handlers exist yet for recipe operations.  
**Evidence:** `src/main/main.ts` exists but doesn't export IPC handlers (verified from file listing - no `ipc/` directory)  
**Excerpt:** Directory listing shows `src/main/` contains only `database/`, `validation/`, not `ipc/`

**Fact:** No React components exist beyond the placeholder App.  
**Evidence:** `src/renderer/` only contains `App.tsx`, `main.tsx`, `index.html`, `styles/global.css`  
**Excerpt:** No `components/` directory in renderer

## Goals / Non-Goals

### Goals (Phase 3.1)

- Establish IPC communication between renderer and main process
- Create minimal working recipe form with basic fields only
- Demonstrate end-to-end flow: form submission → validation → persistence → confirmation
- Set up Tailwind CSS for UI styling
- Verify basic recipe creation works with one simple test
- **Deliverable**: A working (but minimal) recipe entry form

### Non-Goals (Deferred to Phase 3.2)

- Dynamic ingredient list with add/remove functionality
- Dietary tags UI
- Seasonality selection UI
- Advanced error display component
- Comprehensive testing suite (unit, integration, E2E)
- Documentation
- Recipe editing, viewing, deletion

## Design Overview

### Minimal Viable Form (Phase 3.1)

**Included Fields:**

- Title (text input) - required
- Cooking Time (number input) - required
- Cookware Type (select dropdown) - required
- **Single hardcoded ingredient row** (name, quantity, unit)
- Submit button

**Excluded (Phase 3.2):**

- Prep time
- Dietary tags checkboxes
- Seasonality checkboxes
- Instructions textarea
- Dynamic ingredient add/remove
- Proper validation error display component

### IPC Architecture

**Renderer → Main Communication:**

1. User fills minimal form in renderer process (React)
2. Clicks "Save Recipe" button
3. Renderer calls `window.electron.recipeAPI.create(recipeInput)`
4. IPC message sent to main process via preload script (contextBridge)
5. Main process handler validates and persists via DAL
6. Success/error response returned to renderer
7. Renderer displays simple confirmation or error message

## Implementation Instructions (For Implementor)

---

### **Action ID:** PLAN-311

**Change Type:** create  
**File(s):** `src/shared/types/electron.d.ts`  
**Instruction:** Add RecipeAPI interface to electron type definitions.

Add the following interface to the existing `ElectronAPI`:

```typescript
recipeAPI: {
  create: (input: CreateRecipeInput) =>
    Promise<{
      success: boolean;
      recipe?: Recipe;
      errors?: Array<{ field: string; message: string }>;
    }>;
}
```

**Evidence:** `src/shared/types/electron.d.ts` exists (shown in file listing)  
**Done When:** TypeScript compilation succeeds, `window.electron.recipeAPI.create` is typed in renderer code

---

### **Action ID:** PLAN-312

**Change Type:** create  
**File(s):** `src/main/ipc/recipe-handlers.ts`  
**Instruction:** Create IPC handler for recipe creation.

Implementation:

1. Import `ipcMain`, `createRecipe` from DAL, `CreateRecipeInput`, `Recipe` types
2. Create `registerRecipeHandlers()` function
3. Implement `recipe:create` handler:
   - Accept `CreateRecipeInput` from event args
   - Call `createRecipe(input)` (validation happens in DAL)
   - Catch errors and parse validation messages
   - Return `{ success: true, recipe }` on success
   - Return `{ success: false, errors: [...] }` on validation failure
4. Export `registerRecipeHandlers`

**Pseudocode:**

```typescript
export function registerRecipeHandlers() {
  ipcMain.handle('recipe:create', async (_event, input: CreateRecipeInput) => {
    try {
      const recipe = await createRecipe(input);
      return { success: true, recipe };
    } catch (error) {
      // Parse error message and extract field-level errors
      const errorMsg = error.message;
      if (errorMsg.includes('Recipe validation failed:')) {
        const lines = errorMsg.split('\n').slice(1); // Skip first line
        const errors = lines.map(line => {
          const [field, ...msgParts] = line.split(':');
          return { field: field.trim(), message: msgParts.join(':').trim() };
        });
        return { success: false, errors };
      }
      return { success: false, errors: [{ field: 'general', message: errorMsg }] };
    }
  });
}
```

**Evidence:** No IPC directory exists yet (verified from file listing)  
**Done When:** Handler compiles, TypeScript types match electron.d.ts interface

---

### **Action ID:** PLAN-313

**Change Type:** create  
**File(s):** `src/main/ipc/index.ts`  
**Instruction:** Create IPC barrel export for handler registration.

Implementation:

```typescript
import { registerRecipeHandlers } from './recipe-handlers';

export function registerAllHandlers() {
  registerRecipeHandlers();
}
```

**Evidence:** Standard Electron pattern for organizing IPC handlers  
**Done When:** File compiles without errors

---

### **Action ID:** PLAN-314

**Change Type:** modify  
**File(s):** `src/main/main.ts`  
**Instruction:** Register IPC handlers in Electron app initialization.

1. Import `registerAllHandlers` from `./ipc`
2. Call `registerAllHandlers()` before `app.whenReady()` or inside the ready handler
3. Ensure handlers are registered before any renderer can connect

**Evidence:** `src/main/main.ts` exists and initializes Electron app (Phase 0)  
**Done When:** Application starts without errors, handlers are registered before window creation

---

### **Action ID:** PLAN-315

**Change Type:** modify  
**File(s):** `src/main/preload.ts`  
**Instruction:** Expose recipeAPI via contextBridge in preload script.

Add to existing `contextBridge.exposeInMainWorld('electron', { ... })`:

```typescript
recipeAPI: {
  create: (input: CreateRecipeInput) => ipcRenderer.invoke('recipe:create', input),
}
```

Import `CreateRecipeInput` type at top of file.

**Evidence:** `src/main/preload.ts` exists (Phase 0)  
**Done When:** Renderer can call `window.electron.recipeAPI.create()`, TypeScript recognizes type

---

### **Action ID:** PLAN-316

**Change Type:** create  
**File(s):** `src/renderer/components/common/Button.tsx`  
**Instruction:** Create reusable Button component.

Implementation:

```typescript
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-800',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
  };

  return (
    <button
      className={`px-4 py-2 rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? 'Loading...' : children}
    </button>
  );
}
```

**Evidence:** No common components exist yet (file listing shows no `components/` directory)  
**Done When:** Button renders correctly, supports variants and loading state

---

### **Action ID:** PLAN-317

**Change Type:** create  
**File(s):** `src/renderer/components/common/Input.tsx`  
**Instruction:** Create reusable Input component with label and error display.

Implementation:

```typescript
import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  required?: boolean;
}

export function Input({ label, error, required, ...props }: InputProps) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
          error
            ? 'border-red-500 focus:ring-red-500'
            : 'border-gray-300 focus:ring-blue-500'
        }`}
        {...props}
      />
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    </div>
  );
}
```

**Evidence:** Standard React form component pattern  
**Done When:** Input renders with label, shows error styling when error prop provided

---

### **Action ID:** PLAN-318

**Change Type:** create  
**File(s):** `src/renderer/components/common/Select.tsx`  
**Instruction:** Create reusable Select dropdown component.

Implementation:

```typescript
import React from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  required?: boolean;
  options: Array<{ value: string; label: string }>;
}

export function Select({ label, error, required, options, ...props }: SelectProps) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <select
        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
          error
            ? 'border-red-500 focus:ring-red-500'
            : 'border-gray-300 focus:ring-blue-500'
        }`}
        {...props}
      >
        <option value="">Select...</option>
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    </div>
  );
}
```

**Evidence:** Needed for cookware type selection (enum)  
**Done When:** Select renders with options, shows error styling

---

### **Action ID:** PLAN-319

**Change Type:** create  
**File(s):** `src/renderer/utils/ingredient-classifier.ts`  
**Instruction:** Create helper function to determine dietary properties for ingredients during form submission.

Implementation:

1. Import static ingredient database (will need to expose it or duplicate minimal version)
2. Create `determineDietaryProperties(ingredientName: string): DietaryProperty[]` function
3. Normalize ingredient name (lowercase, trim)
4. Look up in static database
5. Return dietary properties array (or empty if unknown - validation will catch violations)

**Pseudocode:**

```typescript
import type { DietaryProperty } from '../../shared/types/database';

// Minimal ingredient database for client-side classification
const INGREDIENT_DATABASE: Record<string, DietaryProperty[]> = {
  butter: ['contains-lactose'],
  milk: ['contains-lactose'],
  cheese: ['contains-lactose'],
  'wheat flour': ['contains-gluten'],
  bread: ['contains-gluten'],
  pasta: ['contains-gluten'],
  'olive oil': [],
  garlic: [],
  onion: [],
  tomato: [],
  rice: [],
  chicken: [],
  salt: [],
  pepper: [],
};

export function determineDietaryProperties(ingredientName: string): DietaryProperty[] {
  const normalized = ingredientName.toLowerCase().trim();
  return INGREDIENT_DATABASE[normalized] || [];
}
```

**Evidence:** Ingredients need dietaryProperties populated (recipe.ts:35), ingredient-database exists in main process (validation/ingredient-database.ts)  
**Done When:** Function returns correct dietary properties for known ingredients, empty array for unknown

---

### **Action ID:** PLAN-320

**Change Type:** create  
**File(s):** `src/renderer/components/RecipeForm/BasicRecipeForm.tsx`  
**Instruction:** Create minimal recipe form with basic fields only (Phase 3.1 version).

Implementation:

1. Initialize state for: title, cookingTimeMinutes, cookwareType, single ingredient (name, quantity, unit)
2. Initialize state for: validation errors, loading, success
3. Render Input for title
4. Render Input (number) for cookingTimeMinutes
5. Render Select for cookwareType
6. Render simple ingredient inputs (3 inputs: name, quantity, unit) - HARDCODED, no add/remove
7. On form submit:
   - Build CreateRecipeInput with hardcoded values for dietaryTags=[], seasonality=['any'], servings=2, sourceType='manual'
   - Call determineDietaryProperties for the single ingredient
   - Call `window.electron.recipeAPI.create(input)`
   - Display simple success/error message
   - Reset form on success

**Pseudocode:**

```typescript
import React, { useState } from 'react';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { Button } from '../common/Button';
import { determineDietaryProperties } from '../../utils/ingredient-classifier';
import type { CreateRecipeInput, CookwareType } from '../../../shared/types/recipe';

export function BasicRecipeForm() {
  const [title, setTitle] = useState('');
  const [cookingTimeMinutes, setCookingTimeMinutes] = useState('');
  const [cookwareType, setCookwareType] = useState<CookwareType | ''>('');
  const [ingredientName, setIngredientName] = useState('');
  const [ingredientQuantity, setIngredientQuantity] = useState('');
  const [ingredientUnit, setIngredientUnit] = useState('');

  const [errors, setErrors] = useState<Array<{ field: string; message: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors([]);
    setSuccess(false);

    const input: CreateRecipeInput = {
      title,
      cookingTimeMinutes: parseInt(cookingTimeMinutes),
      cookwareType: cookwareType as CookwareType,
      servings: 2,
      dietaryTags: [],
      seasonality: ['any'],
      sourceType: 'manual',
      ingredients: [{
        name: ingredientName,
        quantity: parseFloat(ingredientQuantity),
        unit: ingredientUnit,
        dietaryProperties: determineDietaryProperties(ingredientName),
        optional: false,
        orderIndex: 1,
      }],
    };

    const result = await window.electron.recipeAPI.create(input);
    setLoading(false);

    if (result.success) {
      setSuccess(true);
      // Reset form
      setTitle('');
      setCookingTimeMinutes('');
      setCookwareType('');
      setIngredientName('');
      setIngredientQuantity('');
      setIngredientUnit('');
    } else {
      setErrors(result.errors || []);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow">
      <h1 className="text-2xl font-bold mb-6">Add New Recipe (Basic)</h1>

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded text-green-800">
          Recipe added successfully!
        </div>
      )}

      {errors.length > 0 && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded">
          <h3 className="text-red-800 font-semibold mb-2">Please fix the following errors:</h3>
          <ul className="list-disc list-inside text-red-700 text-sm">
            {errors.map((error, i) => (
              <li key={i}><strong>{error.field}:</strong> {error.message}</li>
            ))}
          </ul>
        </div>
      )}

      <Input
        label="Recipe Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />

      <Input
        label="Cooking Time (minutes)"
        type="number"
        value={cookingTimeMinutes}
        onChange={(e) => setCookingTimeMinutes(e.target.value)}
        required
      />

      <Select
        label="Cookware Type"
        value={cookwareType}
        onChange={(e) => setCookwareType(e.target.value as CookwareType)}
        options={[
          { value: 'one-pot', label: 'One Pot' },
          { value: 'one-pan', label: 'One Pan' },
          { value: 'oven', label: 'Oven' }
        ]}
        required
      />

      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Ingredient</h3>
        <div className="grid grid-cols-3 gap-2">
          <input
            type="text"
            placeholder="Name"
            className="px-3 py-2 border border-gray-300 rounded-md"
            value={ingredientName}
            onChange={(e) => setIngredientName(e.target.value)}
            required
          />
          <input
            type="number"
            placeholder="Quantity"
            className="px-3 py-2 border border-gray-300 rounded-md"
            value={ingredientQuantity}
            onChange={(e) => setIngredientQuantity(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="Unit"
            className="px-3 py-2 border border-gray-300 rounded-md"
            value={ingredientUnit}
            onChange={(e) => setIngredientUnit(e.target.value)}
            required
          />
        </div>
      </div>

      <Button type="submit" loading={loading}>
        Save Recipe
      </Button>
    </form>
  );
}
```

**Evidence:** Minimal form demonstrates IPC and validation work  
**Done When:** Form submits, creates recipe on success, displays errors on failure

---

### **Action ID:** PLAN-321

**Change Type:** create  
**File(s):** `src/renderer/pages/AddRecipePage.tsx`  
**Instruction:** Create page wrapper for BasicRecipeForm.

Implementation:

```typescript
import React from 'react';
import { BasicRecipeForm } from '../components/RecipeForm/BasicRecipeForm';

export function AddRecipePage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <BasicRecipeForm />
    </div>
  );
}
```

**Evidence:** Standard page wrapper pattern  
**Done When:** Page renders BasicRecipeForm in centered container

---

### **Action ID:** PLAN-322

**Change Type:** modify  
**File(s):** `src/renderer/App.tsx`  
**Instruction:** Update App component to display AddRecipePage.

For MVP Phase 3.1, directly render AddRecipePage (no routing library needed yet):

```typescript
import React from 'react';
import { AddRecipePage } from './pages/AddRecipePage';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <AddRecipePage />
    </div>
  );
}
```

**Evidence:** App.tsx exists as placeholder (Phase 0)  
**Done When:** Application loads and displays recipe form

---

### **Action ID:** PLAN-323

**Change Type:** modify  
**File(s):** `package.json`  
**Instruction:** Install Tailwind CSS dependencies.

Run: `npm install -D tailwindcss autoprefixer postcss`

**Evidence:** Tailwind classes used in components require Tailwind installed  
**Done When:** `npm install` succeeds, tailwind binary available

---

### **Action ID:** PLAN-324

**Change Type:** modify  
**File(s):** `src/renderer/styles/global.css`  
**Instruction:** Add Tailwind CSS directives and base styles.

Add at the top:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Base styles */
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell',
    'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

**Evidence:** Tailwind classes used in components, global.css exists (Phase 0)  
**Done When:** Tailwind classes render correctly, base styles applied

---

### **Action ID:** PLAN-325

**Change Type:** create  
**File(s):** `tailwind.config.js`  
**Instruction:** Configure Tailwind CSS for the renderer process.

Create config:

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

**Evidence:** Tailwind classes used throughout components  
**Done When:** Tailwind builds CSS, classes apply styling

---

### **Action ID:** PLAN-326

**Change Type:** create  
**File(s):** `postcss.config.js`  
**Instruction:** Configure PostCSS for Tailwind processing.

Create config:

```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

**Evidence:** Required for Tailwind CSS processing in Vite  
**Done When:** PostCSS processes Tailwind directives without errors

---

### **Action ID:** PLAN-327

**Change Type:** create  
**File(s):** `src/main/ipc/recipe-handlers.test.ts`  
**Instruction:** Create basic unit test for IPC recipe handlers.

Implementation:

1. Mock `createRecipe` DAL function
2. Mock `ipcMain.handle` to capture handler function
3. Test: Valid recipe input → handler calls createRecipe, returns success
4. Test: Invalid recipe (validation error) → handler returns errors array

**Pseudocode:**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerRecipeHandlers } from './recipe-handlers';
import * as recipeDAL from '../database/dal/recipes';

vi.mock('../database/dal/recipes');

describe('Recipe IPC Handlers', () => {
  let handlerFn: any;

  beforeEach(() => {
    const ipcMainMock = {
      handle: vi.fn((channel, fn) => {
        if (channel === 'recipe:create') handlerFn = fn;
      }),
    };
    vi.stubGlobal('ipcMain', ipcMainMock);
    registerRecipeHandlers();
  });

  it('returns success when recipe is created', async () => {
    const mockRecipe = { id: '123', title: 'Test', cookingTimeMinutes: 35 };
    vi.mocked(recipeDAL.createRecipe).mockResolvedValue(mockRecipe as any);

    const input = {
      title: 'Test',
      cookingTimeMinutes: 35,
      cookwareType: 'one-pot',
      servings: 2,
      dietaryTags: [],
      seasonality: ['any'],
      sourceType: 'manual',
      ingredients: [
        {
          name: 'pasta',
          quantity: 200,
          unit: 'g',
          dietaryProperties: [],
          optional: false,
          orderIndex: 1,
        },
      ],
    };

    const result = await handlerFn(null, input);

    expect(result.success).toBe(true);
    expect(result.recipe).toEqual(mockRecipe);
  });

  it('returns errors when validation fails', async () => {
    vi.mocked(recipeDAL.createRecipe).mockRejectedValue(
      new Error('Recipe validation failed:\ntitle: Title is required')
    );

    const result = await handlerFn(null, { title: '' });

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
```

**Evidence:** IPC handlers need testing for reliability  
**Done When:** Tests pass, basic IPC handler behavior verified

---

## Verification Tasks

### **Verification ID:** VERIFY-311

**Task:** Launch application and verify basic form renders  
**Steps:**

1. Run `npm run dev`
2. Application window opens
3. Basic recipe form displays with title, cooking time, cookware, ingredient fields
4. No console errors

**Pass Condition:** Form visible, all basic inputs present, no errors

---

### **Verification ID:** VERIFY-312

**Task:** Submit valid minimal recipe and verify creation  
**Steps:**

1. Fill form: title="Simple Pasta", cookingTime=35, cookware=one-pot
2. Fill ingredient: name="pasta", quantity=200, unit="g"
3. Click "Save Recipe"
4. Success message appears
5. Form resets

**Pass Condition:** Recipe saved successfully, form cleared

---

### **Verification ID:** VERIFY-313

**Task:** Submit invalid recipe and verify validation  
**Steps:**

1. Fill form: title="Test", cookingTime=60 (exceeds limit)
2. Fill ingredient: name="butter", quantity=50, unit="g"
3. Click "Save Recipe"
4. Validation errors display

**Pass Condition:** Errors shown for cooking time and lactose constraint

---

### **Verification ID:** VERIFY-314

**Task:** Run IPC handler test  
**Steps:**

1. Run `npm test src/main/ipc/recipe-handlers.test.ts`
2. Tests pass

**Pass Condition:** IPC handler test passes

---

## Acceptance Criteria for Phase 3.1

- [ ] **AC 1**: IPC communication established between renderer and main process
  - **Verified by**: VERIFY-311, VERIFY-312

- [ ] **AC 2**: Minimal recipe form renders with basic fields
  - **Verified by**: VERIFY-311

- [ ] **AC 3**: User can create a recipe with minimal fields and it persists
  - **Verified by**: VERIFY-312

- [ ] **AC 4**: Validation works and errors are displayed
  - **Verified by**: VERIFY-313

- [ ] **AC 5**: IPC handlers are tested
  - **Verified by**: VERIFY-314

## Implementor Checklist

Execute tasks in order:

### IPC Infrastructure (CRITICAL - Do First)

- [ ] PLAN-311: Add RecipeAPI to electron.d.ts
- [ ] PLAN-312: Create recipe IPC handlers
- [ ] PLAN-313: Create IPC index barrel export
- [ ] PLAN-314: Register handlers in main.ts
- [ ] PLAN-315: Expose recipeAPI in preload.ts

### Tailwind Setup (Do Second)

- [ ] PLAN-323: Install Tailwind dependencies
- [ ] PLAN-324: Update global.css with Tailwind
- [ ] PLAN-325: Create tailwind.config.js
- [ ] PLAN-326: Create postcss.config.js

### UI Components (Do Third)

- [ ] PLAN-316: Create Button component
- [ ] PLAN-317: Create Input component
- [ ] PLAN-318: Create Select component
- [ ] PLAN-319: Create ingredient-classifier utility
- [ ] PLAN-320: Create BasicRecipeForm component
- [ ] PLAN-321: Create AddRecipePage
- [ ] PLAN-322: Update App.tsx

### Testing (Do Last)

- [ ] PLAN-327: Create IPC handler test
- [ ] VERIFY-311: Verify form renders
- [ ] VERIFY-312: Verify valid recipe creation
- [ ] VERIFY-313: Verify validation errors
- [ ] VERIFY-314: Verify IPC handler test

**Total Tasks**: 18 implementation tasks + 4 verification tasks = 22 total

---

## Notes for Implementor

### Critical Path

1. **IPC Infrastructure First** (PLAN-311 to PLAN-315): Must work before UI can function
2. **Tailwind Setup** (PLAN-323 to PLAN-326): Needed for component styling
3. **UI Components** (PLAN-316 to PLAN-322): Build minimal form
4. **Basic Testing** (PLAN-327): Verify IPC works
5. **Manual Verification** (VERIFY-311 to VERIFY-314): Confirm everything works

### What's Different from Full Phase 3

- **Minimal form**: Only basic fields (title, cooking time, cookware, single ingredient)
- **No dynamic lists**: Ingredient list is hardcoded (one ingredient only)
- **No advanced UI**: No dietary tags, seasonality, or fancy error display
- **Minimal testing**: Just IPC handler test, no comprehensive suite
- **No documentation**: Deferred to Phase 3.2

### What Phase 3.2 Will Add

- Dynamic ingredient list with add/remove
- Dietary tags checkboxes
- Seasonality checkboxes
- Prep time and instructions fields
- Advanced error display component
- Comprehensive testing (unit, integration, E2E)
- Full documentation

---

**End of Phase 3.1 Plan**  
**Next**: Create Phase 3.1 STATE file and Phase 3.2 plan
