# Phase 3.2: Complete Manual Entry (Full Featured Form) - Implementation Plan

## Inputs

- **Research Report**: `thoughts/shared/research/2025-12-25-Recipe-Collection-Management.md`
- **Epic**: `thoughts/shared/epics/2025-12-25-Recipe-Collection-Management.md`
- **Master Plan**: `thoughts/shared/plans/2025-12-25-Recipe-Collection-Management-MASTER.md`
- **Phase 3.1 State**: `thoughts/shared/plans/2025-12-27-Recipe-Collection-Phase3.1-Basic-Manual-Entry-STATE.md` (MUST BE COMPLETE)
- **Original Phase 3 Plan**: `thoughts/shared/plans/2025-12-26-Recipe-Collection-Phase3-Manual-Entry.md` (SPLIT)

## Verified Current State

**Fact:** Phase 3.1 is complete with basic recipe form working.  
**Evidence:** Phase 3.1 STATE file shows all tasks completed  
**Excerpt:** "Completed: 22 / 22"

**Fact:** IPC communication infrastructure exists and works.  
**Evidence:** `src/main/ipc/recipe-handlers.ts` exists with `recipe:create` handler  
**Excerpt:** IPC handler tested in VERIFY-314

**Fact:** Basic UI components exist (Button, Input, Select).  
**Evidence:** `src/renderer/components/common/` directory contains Button.tsx, Input.tsx, Select.tsx  
**Excerpt:** Created in Phase 3.1 (PLAN-316, 317, 318)

**Fact:** Tailwind CSS is configured and working.  
**Evidence:** Tailwind config files exist, global.css has Tailwind directives  
**Excerpt:** Created in Phase 3.1 (PLAN-323 to 326)

**Fact:** BasicRecipeForm exists with minimal fields.  
**Evidence:** `src/renderer/components/RecipeForm/BasicRecipeForm.tsx` exists  
**Excerpt:** Single hardcoded ingredient, basic fields only (Phase 3.1)

## Goals / Non-Goals

### Goals (Phase 3.2)

- Upgrade BasicRecipeForm to full-featured RecipeForm
- Add dynamic ingredient list with add/remove functionality
- Add dietary tags selection UI
- Add seasonality selection UI
- Add optional fields (prep time, instructions)
- Create professional ValidationErrors display component
- Implement comprehensive testing suite (unit, integration, E2E)
- Write user and developer documentation
- **Deliverable**: Complete, production-ready manual recipe entry feature

### Non-Goals (Still Deferred)

- Recipe editing UI (UPDATE operation)
- Recipe viewing/browsing UI
- Recipe deletion UI
- AI-powered recipe generation
- Web import functionality

## Design Overview

### Enhanced Form Components

**New Components:**

1. **Checkbox** - For dietary tags and seasonality
2. **IngredientRow** - Single ingredient input with remove button
3. **IngredientList** - Manager for dynamic ingredient rows
4. **RecipeBasicInfo** - Organized basic fields section
5. **RecipeDietaryTags** - Dietary tag checkboxes
6. **RecipeSeasonality** - Seasonality checkboxes
7. **ValidationErrors** - Professional error display

**Upgraded Component:**

- **RecipeForm** - Replace BasicRecipeForm with full-featured version

### Component Hierarchy

```
RecipeForm (orchestrator)
├── ValidationErrors
├── RecipeBasicInfo
│   ├── Input (title, cooking time, prep time)
│   └── Select (cookware)
├── RecipeDietaryTags
│   └── Checkbox[] (gluten-free, lactose-free, etc.)
├── RecipeSeasonality
│   └── Checkbox[] (spring, summer, fall, winter, any)
├── IngredientList
│   ├── IngredientRow[] (dynamic, with remove buttons)
│   └── Button (add ingredient)
├── Textarea (instructions)
└── Button (submit)
```

## Implementation Instructions (For Implementor)

---

### **Action ID:** PLAN-321

**Change Type:** create  
**File(s):** `src/renderer/components/common/Checkbox.tsx`  
**Instruction:** Create reusable Checkbox component for dietary tags and seasonality.

Implementation:

```typescript
import React from 'react';

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
}

export function Checkbox({ label, ...props }: CheckboxProps) {
  return (
    <label className="flex items-center space-x-2 cursor-pointer">
      <input
        type="checkbox"
        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
        {...props}
      />
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}
```

**Evidence:** Needed for multiple-selection fields (dietaryTags, seasonality)  
**Done When:** Checkbox renders with label, supports checked state

---

### **Action ID:** PLAN-322

**Change Type:** create  
**File(s):** `src/renderer/components/RecipeForm/IngredientRow.tsx`  
**Instruction:** Create single ingredient input row component.

Implementation:

```typescript
import React from 'react';

interface IngredientRowProps {
  index: number;
  ingredient: { name: string; quantity: string; unit: string; optional: boolean };
  onChange: (index: number, field: string, value: string | boolean) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
}

export function IngredientRow({ index, ingredient, onChange, onRemove, canRemove }: IngredientRowProps) {
  return (
    <div className="grid grid-cols-12 gap-2 mb-2">
      <input
        type="text"
        placeholder="Name"
        className="col-span-5 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={ingredient.name}
        onChange={(e) => onChange(index, 'name', e.target.value)}
        required
      />
      <input
        type="number"
        step="0.01"
        placeholder="Qty"
        className="col-span-2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={ingredient.quantity}
        onChange={(e) => onChange(index, 'quantity', e.target.value)}
        required
      />
      <input
        type="text"
        placeholder="Unit"
        className="col-span-2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={ingredient.unit}
        onChange={(e) => onChange(index, 'unit', e.target.value)}
        required
      />
      <label className="col-span-2 flex items-center text-sm">
        <input
          type="checkbox"
          className="mr-1"
          checked={ingredient.optional}
          onChange={(e) => onChange(index, 'optional', e.target.checked)}
        />
        Optional
      </label>
      {canRemove && (
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="col-span-1 text-red-600 hover:text-red-800 font-bold"
          title="Remove ingredient"
        >
          ×
        </button>
      )}
    </div>
  );
}
```

**Evidence:** Dynamic ingredient list is core requirement (Epic Story 1)  
**Done When:** Row renders 4 inputs, remove button works, onChange/onRemove callbacks fire correctly

---

### **Action ID:** PLAN-323

**Change Type:** create  
**File(s):** `src/renderer/components/RecipeForm/IngredientList.tsx`  
**Instruction:** Create ingredient list manager with add/remove functionality.

Implementation:

```typescript
import React from 'react';
import { IngredientRow } from './IngredientRow';

interface Ingredient {
  name: string;
  quantity: string;
  unit: string;
  optional: boolean;
}

interface IngredientListProps {
  ingredients: Ingredient[];
  setIngredients: (ingredients: Ingredient[]) => void;
}

export function IngredientList({ ingredients, setIngredients }: IngredientListProps) {
  const handleChange = (index: number, field: string, value: string | boolean) => {
    const updated = [...ingredients];
    (updated[index] as any)[field] = value;
    setIngredients(updated);
  };

  const handleRemove = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const handleAdd = () => {
    setIngredients([...ingredients, { name: '', quantity: '', unit: '', optional: false }]);
  };

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Ingredients <span className="text-red-500">*</span>
      </label>
      {ingredients.map((ingredient, index) => (
        <IngredientRow
          key={index}
          index={index}
          ingredient={ingredient}
          onChange={handleChange}
          onRemove={handleRemove}
          canRemove={ingredients.length > 1}
        />
      ))}
      <button
        type="button"
        onClick={handleAdd}
        className="mt-2 px-4 py-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
      >
        + Add Ingredient
      </button>
    </div>
  );
}
```

**Evidence:** Required for user story (manual entry with multiple ingredients)  
**Done When:** Can add/remove ingredients, state updates correctly, at least 1 ingredient always present

---

### **Action ID:** PLAN-324

**Change Type:** create  
**File(s):** `src/renderer/components/RecipeForm/RecipeBasicInfo.tsx`  
**Instruction:** Create organized section for basic recipe fields.

Implementation:

```typescript
import React from 'react';
import { Input } from '../common/Input';
import { Select } from '../common/Select';

interface RecipeBasicInfoProps {
  formData: {
    title: string;
    cookingTimeMinutes: string;
    prepTimeMinutes: string;
    cookwareType: string;
  };
  onChange: (field: string, value: string) => void;
}

export function RecipeBasicInfo({ formData, onChange }: RecipeBasicInfoProps) {
  return (
    <div className="space-y-4">
      <Input
        label="Recipe Title"
        value={formData.title}
        onChange={(e) => onChange('title', e.target.value)}
        required
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Cooking Time (minutes)"
          type="number"
          value={formData.cookingTimeMinutes}
          onChange={(e) => onChange('cookingTimeMinutes', e.target.value)}
          required
          placeholder="30-45"
        />
        <Input
          label="Prep Time (minutes)"
          type="number"
          value={formData.prepTimeMinutes}
          onChange={(e) => onChange('prepTimeMinutes', e.target.value)}
          placeholder="Optional"
        />
      </div>

      <Select
        label="Cookware Type"
        value={formData.cookwareType}
        onChange={(e) => onChange('cookwareType', e.target.value)}
        options={[
          { value: 'one-pot', label: 'One Pot' },
          { value: 'one-pan', label: 'One Pan' },
          { value: 'oven', label: 'Oven' }
        ]}
        required
      />

      <div className="text-sm text-gray-600">
        <strong>Servings:</strong> 2 people (fixed)
      </div>
    </div>
  );
}
```

**Evidence:** All fields map to CreateRecipeInput type  
**Done When:** All inputs render, servings is displayed as fixed value

---

### **Action ID:** PLAN-325

**Change Type:** create  
**File(s):** `src/renderer/components/RecipeForm/RecipeDietaryTags.tsx`  
**Instruction:** Create component for dietary tag checkboxes.

Implementation:

```typescript
import React from 'react';
import { Checkbox } from '../common/Checkbox';

const DIETARY_TAGS = [
  { value: 'gluten-free', label: 'Gluten-Free' },
  { value: 'lactose-free', label: 'Lactose-Free' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'low-carb', label: 'Low-Carb' },
  { value: 'keto', label: 'Keto' },
  { value: 'paleo', label: 'Paleo' },
];

interface RecipeDietaryTagsProps {
  selectedTags: string[];
  onChange: (tags: string[]) => void;
}

export function RecipeDietaryTags({ selectedTags, onChange }: RecipeDietaryTagsProps) {
  const handleToggle = (tag: string) => {
    const updated = selectedTags.includes(tag)
      ? selectedTags.filter(t => t !== tag)
      : [...selectedTags, tag];
    onChange(updated);
  };

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Dietary Tags
      </label>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {DIETARY_TAGS.map(tag => (
          <Checkbox
            key={tag.value}
            label={tag.label}
            checked={selectedTags.includes(tag.value)}
            onChange={() => handleToggle(tag.value)}
          />
        ))}
      </div>
    </div>
  );
}
```

**Evidence:** dietaryTags is array field in CreateRecipeInput  
**Done When:** Can select/deselect tags, state updates correctly

---

### **Action ID:** PLAN-326

**Change Type:** create  
**File(s):** `src/renderer/components/RecipeForm/RecipeSeasonality.tsx`  
**Instruction:** Create component for seasonality checkboxes.

Implementation:

```typescript
import React from 'react';
import { Checkbox } from '../common/Checkbox';

const SEASONS = [
  { value: 'spring', label: 'Spring' },
  { value: 'summer', label: 'Summer' },
  { value: 'fall', label: 'Fall' },
  { value: 'winter', label: 'Winter' },
  { value: 'any', label: 'Any Season' },
];

interface RecipeSeasonalityProps {
  selectedSeasons: string[];
  onChange: (seasons: string[]) => void;
}

export function RecipeSeasonality({ selectedSeasons, onChange }: RecipeSeasonalityProps) {
  const handleToggle = (season: string) => {
    const updated = selectedSeasons.includes(season)
      ? selectedSeasons.filter(s => s !== season)
      : [...selectedSeasons, season];
    onChange(updated);
  };

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Seasonality
      </label>
      <div className="flex flex-wrap gap-4">
        {SEASONS.map(season => (
          <Checkbox
            key={season.value}
            label={season.label}
            checked={selectedSeasons.includes(season.value)}
            onChange={() => handleToggle(season.value)}
          />
        ))}
      </div>
    </div>
  );
}
```

**Evidence:** seasonality is array field in CreateRecipeInput  
**Done When:** Can select/deselect seasons, state updates correctly

---

### **Action ID:** PLAN-327

**Change Type:** create  
**File(s):** `src/renderer/components/RecipeForm/ValidationErrors.tsx`  
**Instruction:** Create professional validation error display component.

Implementation:

```typescript
import React from 'react';

interface ValidationErrorsProps {
  errors: Array<{ field: string; message: string }>;
}

export function ValidationErrors({ errors }: ValidationErrorsProps) {
  if (errors.length === 0) return null;

  return (
    <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-red-800">
            Please fix the following {errors.length} {errors.length === 1 ? 'error' : 'errors'}:
          </h3>
          <ul className="mt-2 text-sm text-red-700 list-disc list-inside space-y-1">
            {errors.map((error, i) => (
              <li key={i}>
                <strong className="font-semibold">{error.field}:</strong> {error.message}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
```

**Evidence:** Spec requirement for "actionable validation errors"  
**Done When:** Errors display with icon, field names highlighted, professional styling

---

### **Action ID:** PLAN-328

**Change Type:** create  
**File(s):** `src/renderer/components/RecipeForm/RecipeForm.tsx`  
**Instruction:** Create full-featured RecipeForm, replacing BasicRecipeForm.

Implementation:

1. Import all sub-components
2. Initialize state for all form fields
3. Render ValidationErrors, RecipeBasicInfo, RecipeDietaryTags, RecipeSeasonality, IngredientList, instructions textarea
4. On submit: build full CreateRecipeInput with all fields
5. Display success message and reset on success

**Pseudocode:**

```typescript
import React, { useState } from 'react';
import { ValidationErrors } from './ValidationErrors';
import { RecipeBasicInfo } from './RecipeBasicInfo';
import { RecipeDietaryTags } from './RecipeDietaryTags';
import { RecipeSeasonality } from './RecipeSeasonality';
import { IngredientList } from './IngredientList';
import { Button } from '../common/Button';
import { determineDietaryProperties } from '../../utils/ingredient-classifier';
import type { CreateRecipeInput, CookwareType } from '../../../shared/types/recipe';

export function RecipeForm() {
  const [formData, setFormData] = useState({
    title: '',
    cookingTimeMinutes: '',
    prepTimeMinutes: '',
    cookwareType: '',
    dietaryTags: [] as string[],
    seasonality: [] as string[],
    instructions: '',
  });

  const [ingredients, setIngredients] = useState([
    { name: '', quantity: '', unit: '', optional: false }
  ]);

  const [errors, setErrors] = useState<Array<{ field: string; message: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleFieldChange = (field: string, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors([]);
    setSuccess(false);

    const input: CreateRecipeInput = {
      title: formData.title,
      cookingTimeMinutes: parseInt(formData.cookingTimeMinutes),
      prepTimeMinutes: formData.prepTimeMinutes ? parseInt(formData.prepTimeMinutes) : undefined,
      cookwareType: formData.cookwareType as CookwareType,
      servings: 2,
      dietaryTags: formData.dietaryTags as any[],
      seasonality: formData.seasonality.length > 0 ? formData.seasonality as any[] : ['any'],
      sourceType: 'manual',
      instructions: formData.instructions || undefined,
      ingredients: ingredients.map((ing, i) => ({
        name: ing.name,
        quantity: parseFloat(ing.quantity),
        unit: ing.unit,
        dietaryProperties: determineDietaryProperties(ing.name),
        optional: ing.optional,
        orderIndex: i + 1,
      })),
    };

    const result = await window.electron.recipeAPI.create(input);
    setLoading(false);

    if (result.success) {
      setSuccess(true);
      // Reset form
      setFormData({
        title: '',
        cookingTimeMinutes: '',
        prepTimeMinutes: '',
        cookwareType: '',
        dietaryTags: [],
        seasonality: [],
        instructions: '',
      });
      setIngredients([{ name: '', quantity: '', unit: '', optional: false }]);
    } else {
      setErrors(result.errors || []);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h1 className="text-3xl font-bold mb-6 text-gray-900">Add New Recipe</h1>

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800">
                Recipe added successfully!
              </p>
            </div>
          </div>
        </div>
      )}

      <ValidationErrors errors={errors} />

      <RecipeBasicInfo formData={formData} onChange={handleFieldChange} />

      <RecipeDietaryTags
        selectedTags={formData.dietaryTags}
        onChange={(tags) => handleFieldChange('dietaryTags', tags)}
      />

      <RecipeSeasonality
        selectedSeasons={formData.seasonality}
        onChange={(seasons) => handleFieldChange('seasonality', seasons)}
      />

      <IngredientList ingredients={ingredients} setIngredients={setIngredients} />

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Instructions (optional)
        </label>
        <textarea
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={5}
          placeholder="Enter cooking instructions..."
          value={formData.instructions}
          onChange={(e) => handleFieldChange('instructions', e.target.value)}
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" loading={loading}>
          Save Recipe
        </Button>
      </div>
    </form>
  );
}
```

**Evidence:** Orchestrates all form components, integrates with IPC  
**Done When:** Form submits, creates recipe with all fields, displays errors/success

---

### **Action ID:** PLAN-329

**Change Type:** modify  
**File(s):** `src/renderer/pages/AddRecipePage.tsx`  
**Instruction:** Update page to use new RecipeForm instead of BasicRecipeForm.

Change import and component:

```typescript
import React from 'react';
import { RecipeForm } from '../components/RecipeForm/RecipeForm';

export function AddRecipePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <RecipeForm />
    </div>
  );
}
```

**Evidence:** Page wrapper needs to use new full-featured form  
**Done When:** Page renders RecipeForm (not BasicRecipeForm)

---

### **Action ID:** PLAN-330

**Change Type:** create  
**File(s):** `src/renderer/components/RecipeForm/index.ts`  
**Instruction:** Create barrel export for RecipeForm components.

Implementation:

```typescript
export { RecipeForm } from './RecipeForm';
export { RecipeBasicInfo } from './RecipeBasicInfo';
export { RecipeDietaryTags } from './RecipeDietaryTags';
export { RecipeSeasonality } from './RecipeSeasonality';
export { IngredientList } from './IngredientList';
export { IngredientRow } from './IngredientRow';
export { ValidationErrors } from './ValidationErrors';
```

**Evidence:** Standard module organization pattern  
**Done When:** Components can be imported from `components/RecipeForm`

---

### **Action ID:** PLAN-331

**Change Type:** create  
**File(s):** `src/renderer/components/common/index.ts`  
**Instruction:** Create barrel export for common components.

Implementation:

```typescript
export { Button } from './Button';
export { Input } from './Input';
export { Select } from './Select';
export { Checkbox } from './Checkbox';
```

**Evidence:** Standard module organization pattern  
**Done When:** Components can be imported from `components/common`

---

### **Action ID:** PLAN-332

**Change Type:** modify  
**File(s):** `package.json`  
**Instruction:** Add testing library dependencies for React component testing.

Run: `npm install -D @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom @vitejs/plugin-react`

**Evidence:** Component tests require React Testing Library  
**Done When:** `npm install` succeeds, testing libraries available

---

### **Action ID:** PLAN-333

**Change Type:** modify  
**File(s):** `vitest.config.ts`  
**Instruction:** Configure Vitest for React component testing with jsdom.

Update config:

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

Create `vitest.setup.ts`:

```typescript
import '@testing-library/jest-dom';

// Mock window.electron for renderer tests
global.window = global.window || {};
(global.window as any).electron = {
  recipeAPI: {
    create: vi.fn(),
  },
};
```

**Evidence:** React components need jsdom environment for testing  
**Done When:** Vitest can render React components in tests

---

### **Action ID:** PLAN-334

**Change Type:** create  
**File(s):** `src/renderer/components/RecipeForm/RecipeForm.test.tsx`  
**Instruction:** Create comprehensive integration test for RecipeForm.

Implementation:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecipeForm } from './RecipeForm';

describe('RecipeForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window.electron.recipeAPI.create as any) = vi.fn();
  });

  it('renders all form sections', () => {
    render(<RecipeForm />);
    expect(screen.getByLabelText(/recipe title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/cooking time/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/cookware type/i)).toBeInTheDocument();
    expect(screen.getByText(/dietary tags/i)).toBeInTheDocument();
    expect(screen.getByText(/seasonality/i)).toBeInTheDocument();
    expect(screen.getByText(/ingredients/i)).toBeInTheDocument();
  });

  it('submits valid recipe successfully', async () => {
    const user = userEvent.setup();
    (window.electron.recipeAPI.create as any).mockResolvedValue({
      success: true,
      recipe: { id: '123', title: 'Test Recipe' }
    });

    render(<RecipeForm />);

    await user.type(screen.getByLabelText(/recipe title/i), 'Test Pasta');
    await user.type(screen.getByLabelText(/cooking time/i), '35');
    await user.selectOptions(screen.getByLabelText(/cookware type/i), 'one-pot');

    const ingredientInputs = screen.getAllByPlaceholderText(/name/i);
    await user.type(ingredientInputs[0], 'pasta');
    await user.type(screen.getByPlaceholderText(/qty/i), '200');
    await user.type(screen.getByPlaceholderText(/unit/i), 'g');

    await user.click(screen.getByText(/save recipe/i));

    await waitFor(() => {
      expect(screen.getByText(/recipe added successfully/i)).toBeInTheDocument();
    });

    expect(window.electron.recipeAPI.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Test Pasta',
        cookingTimeMinutes: 35,
        cookwareType: 'one-pot',
      })
    );
  });

  it('displays validation errors on failure', async () => {
    const user = userEvent.setup();
    (window.electron.recipeAPI.create as any).mockResolvedValue({
      success: false,
      errors: [
        { field: 'cookingTimeMinutes', message: 'Must be between 30-45 minutes' }
      ]
    });

    render(<RecipeForm />);
    await user.click(screen.getByText(/save recipe/i));

    await waitFor(() => {
      expect(screen.getByText(/please fix the following/i)).toBeInTheDocument();
      expect(screen.getByText(/must be between 30-45 minutes/i)).toBeInTheDocument();
    });
  });

  it('adds and removes ingredients dynamically', async () => {
    const user = userEvent.setup();
    render(<RecipeForm />);

    expect(screen.getAllByPlaceholderText(/name/i)).toHaveLength(1);

    await user.click(screen.getByText(/add ingredient/i));
    expect(screen.getAllByPlaceholderText(/name/i)).toHaveLength(2);

    const removeButtons = screen.getAllByTitle(/remove ingredient/i);
    await user.click(removeButtons[0]);
    expect(screen.getAllByPlaceholderText(/name/i)).toHaveLength(1);
  });

  it('toggles dietary tags', async () => {
    const user = userEvent.setup();
    render(<RecipeForm />);

    const veganCheckbox = screen.getByLabelText(/vegan/i);
    expect(veganCheckbox).not.toBeChecked();

    await user.click(veganCheckbox);
    expect(veganCheckbox).toBeChecked();

    await user.click(veganCheckbox);
    expect(veganCheckbox).not.toBeChecked();
  });
});
```

**Evidence:** Integration testing required for quality criteria  
**Done When:** All tests pass, form behavior verified

---

### **Action ID:** PLAN-335

**Change Type:** create  
**File(s):** `src/renderer/utils/ingredient-classifier.test.ts`  
**Instruction:** Create unit test for ingredient classifier.

Implementation:

```typescript
import { describe, it, expect } from 'vitest';
import { determineDietaryProperties } from './ingredient-classifier';

describe('determineDietaryProperties', () => {
  it('identifies gluten in wheat flour', () => {
    const result = determineDietaryProperties('wheat flour');
    expect(result).toContain('contains-gluten');
  });

  it('identifies lactose in butter', () => {
    const result = determineDietaryProperties('butter');
    expect(result).toContain('contains-lactose');
  });

  it('returns empty array for unknown ingredient', () => {
    const result = determineDietaryProperties('mystery ingredient');
    expect(result).toEqual([]);
  });

  it('normalizes ingredient names (case-insensitive)', () => {
    expect(determineDietaryProperties('BUTTER')).toContain('contains-lactose');
    expect(determineDietaryProperties('  butter  ')).toContain('contains-lactose');
  });

  it('returns empty array for gluten-free, lactose-free ingredients', () => {
    expect(determineDietaryProperties('rice')).toEqual([]);
    expect(determineDietaryProperties('olive oil')).toEqual([]);
    expect(determineDietaryProperties('garlic')).toEqual([]);
  });
});
```

**Evidence:** Dietary classification is critical for constraint validation  
**Done When:** Tests pass, classification works correctly

---

### **Action ID:** PLAN-336

**Change Type:** modify  
**File(s):** `package.json`  
**Instruction:** Add Playwright for E2E testing.

Run: `npm install -D playwright @playwright/test`

Add scripts:

```json
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui",
"test:unit": "vitest run",
"test:integration": "vitest run src/renderer",
"test:all": "npm run test:unit && npm run test:integration && npm run test:e2e"
```

**Evidence:** E2E tests require Playwright  
**Done When:** Playwright installed, scripts defined

---

### **Action ID:** PLAN-337

**Change Type:** create  
**File(s):** `playwright.config.ts`  
**Instruction:** Configure Playwright for Electron E2E testing.

Create config:

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 0,
  workers: 1,
  use: {
    trace: 'on-first-retry',
  },
});
```

**Evidence:** Playwright needs configuration for Electron app testing  
**Done When:** Playwright can find and run E2E tests

---

### **Action ID:** PLAN-338

**Change Type:** create  
**File(s):** `e2e/manual-entry.spec.ts`  
**Instruction:** Create end-to-end test for complete manual recipe entry workflow.

Implementation:

```typescript
import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';

test('complete manual recipe entry workflow', async () => {
  const electronApp = await electron.launch({
    args: ['.'],
    env: {
      ...process.env,
      NODE_ENV: 'test',
    },
  });

  const window = await electronApp.firstWindow();
  await window.waitForLoadState('domcontentloaded');

  // Fill form
  await window.fill('input[label*="Recipe Title"]', 'E2E Test Pasta');
  await window.fill('input[label*="Cooking Time"]', '35');
  await window.selectOption('select[label*="Cookware"]', 'one-pot');

  // Fill ingredient
  await window.fill('input[placeholder="Name"]', 'pasta');
  await window.fill('input[placeholder="Qty"]', '200');
  await window.fill('input[placeholder="Unit"]', 'g');

  // Submit
  await window.click('button:has-text("Save Recipe")');

  // Verify success
  await expect(window.locator('text=Recipe added successfully')).toBeVisible({ timeout: 5000 });

  await electronApp.close();
});

test('displays validation errors for invalid recipe', async () => {
  const electronApp = await electron.launch({ args: ['.'] });
  const window = await electronApp.firstWindow();
  await window.waitForLoadState('domcontentloaded');

  // Fill with invalid data
  await window.fill('input[label*="Recipe Title"]', 'Test');
  await window.fill('input[label*="Cooking Time"]', '60'); // Exceeds limit
  await window.selectOption('select[label*="Cookware"]', 'one-pot');
  await window.fill('input[placeholder="Name"]', 'butter'); // Contains lactose
  await window.fill('input[placeholder="Qty"]', '50');
  await window.fill('input[placeholder="Unit"]', 'g');

  await window.click('button:has-text("Save Recipe")');

  // Verify errors displayed
  await expect(window.locator('text=Please fix the following')).toBeVisible({ timeout: 5000 });

  await electronApp.close();
});
```

**Evidence:** E2E testing required for acceptance criteria  
**Done When:** Tests launch app, interact with form, verify behavior

---

### **Action ID:** PLAN-339

**Change Type:** create  
**File(s):** `docs/user-guide-manual-entry.md`  
**Instruction:** Create user documentation for manual recipe entry feature.

Content:

```markdown
# Manual Recipe Entry - User Guide

## Overview

Add your favorite recipes manually to SimpleKitchen through an intuitive form interface.

## How to Add a Recipe

1. **Launch SimpleKitchen** - The recipe entry form displays on app launch
2. **Fill in Basic Information**:
   - **Recipe Title** (required): Give your recipe a descriptive name
   - **Cooking Time** (required): Enter time in minutes (must be 30-45 minutes)
   - **Prep Time** (optional): Time needed for preparation
   - **Cookware Type** (required): Choose One-Pot, One-Pan, or Oven
   - **Servings**: Fixed at 2 people

3. **Select Dietary Tags** (optional):
   - Check any that apply: Gluten-Free, Lactose-Free, Vegetarian, Vegan, Low-Carb, Keto, Paleo

4. **Choose Seasonality** (optional):
   - Select when the recipe is best: Spring, Summer, Fall, Winter, or Any Season

5. **Add Ingredients**:
   - Enter ingredient name, quantity, and unit
   - Check "Optional" for non-essential ingredients
   - Click "+ Add Ingredient" to add more
   - Click "×" to remove an ingredient (minimum 1 required)

6. **Add Instructions** (optional):
   - Enter step-by-step cooking instructions

7. **Save Recipe**:
   - Click "Save Recipe" button
   - If successful, you'll see a green confirmation message
   - If there are errors, they'll be displayed in a red box with specific fixes needed

## Validation Rules

Your recipes must meet these requirements:

- **Cooking Time**: 30-45 minutes
- **Cookware**: Only one-pot, one-pan, or oven recipes
- **Servings**: Exactly 2 people
- **Dietary Compliance**: Must be gluten-free and lactose-free (system enforces)
- **Ingredients**: At least 1 ingredient required

## Common Errors and Solutions

**Error: "Cooking time must be between 30-45 minutes"**

- Adjust your cooking time to fit within the range

**Error: "Recipe contains [ingredient] which has lactose"**

- Remove the ingredient or replace with a dairy-free alternative
- Common lactose sources: butter, milk, cheese, cream, yogurt

**Error: "Recipe contains [ingredient] which has gluten"**

- Remove the ingredient or replace with a gluten-free alternative
- Common gluten sources: wheat flour, bread, pasta (use gluten-free versions)

**Error: "At least one ingredient is required"**

- Add at least one ingredient to your recipe

## Tips

- Use the dietary tags to help organize your recipes
- Seasonality helps you find recipes appropriate for the current season
- Mark garnishes and optional toppings as "Optional" ingredients
- Be specific with ingredient names for better dietary classification

## Need Help?

If you encounter issues or have questions, please refer to the developer documentation or submit an issue.
```

**Evidence:** Documentation requirement for user-facing feature  
**Done When:** Documentation is clear, comprehensive, and helpful

---

### **Action ID:** PLAN-340

**Change Type:** create  
**File(s):** `docs/dev-guide-phase3.md`  
**Instruction:** Create developer documentation for Phase 3 implementation.

Content:

```markdown
# Phase 3: Manual Recipe Entry - Developer Guide

## Overview

Phase 3 delivers the first complete user journey: manual recipe entry through a React form UI with IPC communication to the Electron main process.

## Architecture

### IPC Communication Flow

1. User interacts with RecipeForm (renderer process)
2. Form submits data via `window.electron.recipeAPI.create()`
3. Preload script (`src/main/preload.ts`) bridges to main process via `ipcRenderer.invoke('recipe:create')`
4. Main process handler (`src/main/ipc/recipe-handlers.ts`) receives request
5. Handler calls validation system and DAL
6. Response returned to renderer with success/errors
7. Renderer displays result

### Component Hierarchy
```

App
└── AddRecipePage
└── RecipeForm (orchestrator)
├── ValidationErrors
├── RecipeBasicInfo
│ ├── Input (title, cooking time, prep time)
│ └── Select (cookware type)
├── RecipeDietaryTags
│ └── Checkbox[] (7 dietary tags)
├── RecipeSeasonality
│ └── Checkbox[] (5 seasons)
├── IngredientList
│ ├── IngredientRow[] (dynamic)
│ └── Button (add ingredient)
├── Textarea (instructions)
└── Button (submit)

````

## Key Components

### RecipeForm (`src/renderer/components/RecipeForm/RecipeForm.tsx`)
- Main orchestrator component
- Manages all form state
- Handles submission and error display
- Resets form on success

### IPC Handler (`src/main/ipc/recipe-handlers.ts`)
- Handles `recipe:create` IPC channel
- Calls validation and DAL
- Parses validation errors into structured format
- Returns success/error response

### Ingredient Classifier (`src/renderer/utils/ingredient-classifier.ts`)
- Determines dietary properties for ingredients
- Used during form submission to classify ingredients
- Syncs with main process ingredient database

## Testing Strategy

### Unit Tests
- `recipe-handlers.test.ts`: IPC handler logic and error parsing
- `ingredient-classifier.test.ts`: Dietary property determination

### Integration Tests
- `RecipeForm.test.tsx`: Full form submission flow with mocked IPC

### E2E Tests
- `e2e/manual-entry.spec.ts`: End-to-end workflow with real Electron app

## Running Tests

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
````

## Development Workflow

```bash
# Install dependencies
npm install

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

## Common Issues

### Issue: Tailwind classes not applying

**Solution**: Ensure PostCSS config is correct, restart Vite dev server

### Issue: IPC calls return undefined

**Solution**:

1. Check preload script is loaded in BrowserWindow options
2. Verify contextBridge exposes API correctly
3. Check TypeScript types match between preload and electron.d.ts

### Issue: Validation errors not displaying

**Solution**: Verify error parsing in `recipe-handlers.ts` matches validation error format from `validator.ts`

### Issue: Form state not updating

**Solution**: Check that state setters are called correctly, especially for nested objects/arrays

## Architecture Decisions

### Why IPC instead of direct database access?

- Security: Renderer process should not have direct database access
- Separation of concerns: Main process handles all business logic
- Type safety: IPC boundaries enforce clean interfaces

### Why Tailwind CSS?

- Rapid UI development without custom CSS files
- Consistent design system
- Small bundle size (only used classes are included)

### Why separate components for form sections?

- Maintainability: Each section is independently testable
- Reusability: Components can be reused in edit forms (Phase 4+)
- Clarity: Clear separation of concerns

## Next Steps (Phase 4+)

- Recipe viewing and filtering UI
- Recipe editing (UPDATE operation)
- Recipe deletion UI
- Advanced search and filtering
- AI-powered recipe generation (Phase 5)
- Web import functionality (Phase 6)

## Contributing

When adding features:

1. Follow existing component patterns
2. Add TypeScript types for all props and state
3. Write unit/integration tests
4. Update documentation
5. Test manually before committing

```

**Evidence:** Developer documentation helps future maintainers
**Done When:** Documentation is accurate, comprehensive, and helpful

---

## Verification Tasks

### **Verification ID:** VERIFY-321
**Task:** Verify full form renders with all sections
**Steps:**
1. Run `npm run dev`
2. Form displays with all sections: basic info, dietary tags, seasonality, ingredients, instructions
3. No console errors

**Pass Condition:** All form sections visible and functional

---

### **Verification ID:** VERIFY-322
**Task:** Verify dynamic ingredient list works
**Steps:**
1. Form starts with 1 ingredient row
2. Click "+ Add Ingredient" multiple times
3. Fill in several ingredients
4. Click "×" to remove an ingredient
5. Verify cannot remove last ingredient (button disabled or not shown)

**Pass Condition:** Can add/remove ingredients, minimum 1 enforced

---

### **Verification ID:** VERIFY-323
**Task:** Verify dietary tags and seasonality selection
**Steps:**
1. Click various dietary tag checkboxes
2. Click various season checkboxes
3. Verify selections are retained when scrolling

**Pass Condition:** Checkboxes toggle correctly, state persists

---

### **Verification ID:** VERIFY-324
**Task:** Submit complete recipe with all fields
**Steps:**
1. Fill all fields including optional ones
2. Add multiple ingredients
3. Select dietary tags and seasons
4. Submit recipe
5. Verify success message
6. Verify form resets

**Pass Condition:** Recipe created with all data, form cleared

---

### **Verification ID:** VERIFY-325
**Task:** Verify validation error display
**Steps:**
1. Submit recipe with invalid cooking time (e.g., 60 minutes)
2. Verify professional error display component appears
3. Error messages are clear and actionable

**Pass Condition:** Errors displayed professionally with icon and formatting

---

### **Verification ID:** VERIFY-326
**Task:** Run all unit and integration tests
**Steps:**
1. Run `npm run test:unit`
2. All unit tests pass
3. Run `npm run test:integration`
4. All integration tests pass

**Pass Condition:** All tests pass

---

### **Verification ID:** VERIFY-327
**Task:** Run E2E tests
**Steps:**
1. Run `npm run test:e2e`
2. E2E tests launch app, interact with form, verify behavior
3. Both success and error scenarios pass

**Pass Condition:** E2E tests pass

---

## Acceptance Criteria for Phase 3.2

- [ ] **AC 1**: Full-featured form with all fields functional
  - **Verified by**: VERIFY-321

- [ ] **AC 2**: Dynamic ingredient list with add/remove works
  - **Verified by**: VERIFY-322

- [ ] **AC 3**: Dietary tags and seasonality selection works
  - **Verified by**: VERIFY-323

- [ ] **AC 4**: Can create recipe with all fields and it persists
  - **Verified by**: VERIFY-324

- [ ] **AC 5**: Professional validation error display
  - **Verified by**: VERIFY-325

- [ ] **AC 6**: Comprehensive test coverage
  - **Verified by**: VERIFY-326, VERIFY-327

- [ ] **AC 7**: Documentation complete
  - **Verified by**: User guide and dev guide exist

## Implementor Checklist

Execute tasks in order:

### UI Components (Priority 1)
- [ ] PLAN-321: Create Checkbox component
- [ ] PLAN-322: Create IngredientRow component
- [ ] PLAN-323: Create IngredientList component
- [ ] PLAN-324: Create RecipeBasicInfo component
- [ ] PLAN-325: Create RecipeDietaryTags component
- [ ] PLAN-326: Create RecipeSeasonality component
- [ ] PLAN-327: Create ValidationErrors component
- [ ] PLAN-328: Create full RecipeForm (replaces BasicRecipeForm)
- [ ] PLAN-329: Update AddRecipePage to use RecipeForm
- [ ] PLAN-330: Create RecipeForm barrel export
- [ ] PLAN-331: Create common components barrel export

### Testing Setup (Priority 2)
- [ ] PLAN-332: Install testing libraries
- [ ] PLAN-333: Configure Vitest for React
- [ ] PLAN-336: Install Playwright
- [ ] PLAN-337: Configure Playwright

### Tests (Priority 3)
- [ ] PLAN-334: Create RecipeForm integration test
- [ ] PLAN-335: Create ingredient-classifier test
- [ ] PLAN-338: Create E2E test

### Documentation (Priority 4)
- [ ] PLAN-339: Create user guide
- [ ] PLAN-340: Create developer guide

### Verification (Priority 5)
- [ ] VERIFY-321: Verify full form renders
- [ ] VERIFY-322: Verify dynamic ingredient list
- [ ] VERIFY-323: Verify dietary tags and seasonality
- [ ] VERIFY-324: Verify complete recipe submission
- [ ] VERIFY-325: Verify validation error display
- [ ] VERIFY-326: Verify unit/integration tests
- [ ] VERIFY-327: Verify E2E tests

**Total Tasks**: 20 implementation tasks + 7 verification tasks = 27 total

---

## Notes for Implementor

### Prerequisites
- Phase 3.1 MUST be complete before starting Phase 3.2
- BasicRecipeForm should be working and tested

### What's Being Added
- Dynamic ingredient management (add/remove)
- Dietary tags UI
- Seasonality UI
- Optional fields (prep time, instructions)
- Professional error display
- Comprehensive testing
- Documentation

### Critical Path
1. **Build remaining components** (PLAN-321 to 327)
2. **Integrate into full RecipeForm** (PLAN-328)
3. **Set up testing infrastructure** (PLAN-332, 333, 336, 337)
4. **Write tests** (PLAN-334, 335, 338)
5. **Document** (PLAN-339, 340)
6. **Verify** (all VERIFY tasks)

### Deferred to Future Phases
- Recipe editing UI
- Recipe viewing/browsing UI
- Recipe deletion UI
- Advanced filtering
- AI generation
- Web import

---

**End of Phase 3.2 Plan**
**Together with Phase 3.1, this completes the original Phase 3 scope**
```
