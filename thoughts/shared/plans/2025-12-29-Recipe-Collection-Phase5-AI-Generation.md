# Phase 5: AI-Powered Recipe Generation - Implementation Plan

## Inputs

- **Research Report**: `thoughts/shared/research/2025-12-25-Recipe-Collection-Management.md`
- **Master Plan**: `thoughts/shared/plans/2025-12-25-Recipe-Collection-Management-MASTER.md`
- **Epic**: `thoughts/shared/epics/2025-12-25-Recipe-Collection-Management.md`
- **Web Research**: OpenAI Structured Outputs and SDK Integration (2025-12-29)
- **Previous Phase State**: `thoughts/shared/plans/2025-12-27-Recipe-Collection-Phase4-Viewing-Filtering-STATE.md`

## Verified Current State

**Fact:** Phase 0-4 are complete with working recipe CRUD, validation, and viewing/filtering.  
**Evidence:** `thoughts/shared/plans/2025-12-27-Recipe-Collection-Phase4-Viewing-Filtering-STATE.md:6` - "COMPLETE" with all tasks checked.  
**Excerpt:** "Current Task: COMPLETE" ... "PHASE 4 COMPLETE ✅"

**Fact:** Recipe validation system uses modular validators with async dietary profile lookup.  
**Evidence:** `src/main/validation/validator.ts:9-36`  
**Excerpt:**

```typescript
export async function validateRecipe(
  recipeInput: CreateRecipeInput | UpdateRecipeInput
): Promise<ValidationResult> {
  const profile = await getDietaryProfile();
  const [dietaryErrors, timeErrors, cookwareErrors, servingsErrors] = await Promise.all([...]);
}
```

**Fact:** Recipe types include CreateRecipeInput and Recipe with all required fields.  
**Evidence:** `src/shared/types/recipe.ts:58-80`  
**Excerpt:**

```typescript
export interface CreateRecipeInput {
  title: string;
  cookingTimeMinutes: number;
  prepTimeMinutes?: number;
  cookwareType: CookwareType;
  servings: number;
  dietaryTags: DietaryTag[];
  seasonality: Season[];
  sourceType: SourceType;
  sourceReference?: string;
  instructions?: string;
  ingredients: CreateIngredientInput[];
}
```

**Fact:** IPC handlers use structured response format with success/errors pattern.  
**Evidence:** `src/main/ipc/recipe-handlers.ts:6-37`  
**Excerpt:**

```typescript
ipcMain.handle('recipe:create', async (_event, input: CreateRecipeInput) => {
  try {
    const recipe = await createRecipe(input);
    return { success: true, recipe };
  } catch (error) {
    return { success: false, errors: [...] };
  }
});
```

**Fact:** Dietary types include DietaryTag and DietaryProperty enums.  
**Evidence:** `src/shared/types/database.ts:16-24`  
**Excerpt:**

```typescript
export type DietaryTag = 'gluten-free' | 'lactose-free' | 'vegetarian' | 'vegan' | 'pescatarian';
export type DietaryProperty =
  | 'contains-gluten'
  | 'contains-lactose'
  | 'contains-eggs'
  | 'contains-fish'
  | 'contains-meat'
  | 'none';
```

**Fact:** Project uses OpenAI SDK not installed yet.  
**Evidence:** `package.json:42-47` - dependencies list includes better-sqlite3, kysely, react but NOT openai or zod.  
**Excerpt:** Dependencies include electron, kysely, react, but no openai package.

**Fact:** Project uses Vitest for unit testing with vi.mock() support.  
**Evidence:** `package.json:21-29` test scripts use vitest.  
**Excerpt:** `"test": "vitest run"`, `"test:watch": "vitest"`

**Fact:** Existing RecipeForm component handles manual entry with validation.  
**Evidence:** `src/renderer/components/RecipeForm/RecipeForm.tsx` exists in file tree.

## Goals / Non-Goals

### Goals

- Enable users to generate recipes via AI with custom criteria (cuisine, main ingredient, dietary preferences)
- Guarantee schema compliance using OpenAI Structured Outputs + Zod
- Integrate AI-generated recipes with existing validation pipeline (dietary, time, cookware, servings)
- Provide user review/edit step before saving AI-generated recipes
- Handle API errors gracefully with clear user feedback
- Achieve cost-effective generation using gpt-4o-mini (~$0.001 per recipe)
- Provide comprehensive test coverage with mocked API calls

### Non-Goals

- Conversational AI interface (deferred to Epic 2)
- Recipe editing/adaptation suggestions (basic review only)
- Caching of AI responses (future optimization)
- Support for local LLMs (OpenAI only for MVP)
- Batch recipe generation (single recipe per request)
- Recipe variation generation (1 recipe at a time)

## Design Overview

### Architecture

**AI Recipe Generation Flow**:

```
User enters criteria → IPC call → Main process validates input →
OpenAI API request with Zod schema → Structured response parsed →
Recipe validated (dietary, time, cookware, servings) →
Recipe returned to renderer → User reviews/edits →
User confirms → Recipe saved via existing createRecipe() flow
```

**Component Layering**:

1. **Renderer**: `RecipeGenerationPage.tsx` - UI for criteria input + review
2. **IPC Bridge**: `preload.ts` exposes `generateRecipe()` via context bridge
3. **Main Process**: `recipe-ai-handlers.ts` - IPC handler orchestration
4. **AI Service**: `ai/recipe-generator.ts` - OpenAI SDK integration + prompt engineering
5. **Validation**: Existing `validator.ts` + dietary/time/cookware validators (reused)
6. **DAL**: Existing `createRecipe()` (reused)

### Zod Schema Strategy

**Approach**: Create Zod schema that maps 1:1 to `CreateRecipeInput` type.

**Rationale**:

- Ensures AI output can be directly passed to existing validation
- Maintains single source of truth for recipe structure
- TypeScript type inference provides type safety

**Implementation**:

```typescript
import { z } from 'zod';

export const IngredientSchema = z.object({
  name: z.string().min(1).max(200),
  quantity: z.number().positive(),
  unit: z.string().min(1).max(50),
  dietaryProperties: z.array(z.enum(['contains-gluten', 'contains-lactose', ...])),
  optional: z.boolean().default(false),
  orderIndex: z.number().int().min(0),
});

export const RecipeGenerationSchema = z.object({
  title: z.string().min(1).max(200),
  cookingTimeMinutes: z.number().int().min(30).max(45),
  prepTimeMinutes: z.number().int().min(0).max(30).optional(),
  cookwareType: z.enum(['one-pot', 'one-pan', 'oven']),
  servings: z.literal(2), // MUST be exactly 2
  dietaryTags: z.array(z.enum(['gluten-free', 'lactose-free', 'vegetarian', 'vegan', 'pescatarian'])),
  seasonality: z.array(z.enum(['spring', 'summer', 'fall', 'winter', 'any'])),
  instructions: z.string().min(50).max(5000).optional(),
  ingredients: z.array(IngredientSchema).min(1).max(30),
});
```

### Prompt Engineering Strategy

**System Prompt** (fixed):

```
You are a professional chef with expertise in diverse cuisines. Generate recipes that are:
- Practical and achievable for home cooks
- Balanced in nutrition and flavor
- Precise in measurements and cooking techniques
- STRICTLY compliant with the provided constraints

CRITICAL CONSTRAINTS (NEVER violate):
- Cooking time: MUST be between 30-45 minutes (active cooking only)
- Servings: MUST be exactly 2 portions
- Cookware: MUST use only ONE piece of cookware (one pot OR one pan OR oven)
- Dietary restrictions: MUST comply with specified tags

When specifying ingredients:
- Mark dietary properties accurately (contains-gluten, contains-lactose, etc.)
- Use common units (cup, tbsp, tsp, oz, lb, g, ml)
- Provide exact quantities, not ranges
```

**User Prompt** (dynamic based on criteria):

```
Generate a {cuisine} recipe with these requirements:

Main Ingredient: {mainIngredient}
Dietary Tags: {dietaryTags} (MUST be complied with)
Seasonality: {seasons}
Cookware Type: {cookwareType}
Skill Level: {skillLevel}

The recipe must:
- Take 30-45 minutes of active cooking time
- Serve exactly 2 people
- Use only {cookwareType}
- Be {dietaryTags.join(' and ')}

Focus on {flavorProfile} flavors.
```

### Error Handling Strategy

**API Error Types**:

1. **Rate Limit** (429): Display retry-after time, allow user to retry
2. **Network Error**: Display "Check internet connection", allow retry
3. **Authentication Error** (401): Display "Invalid API key configuration"
4. **Timeout**: Display "Request took too long", allow retry
5. **Refusal**: AI refused to generate (safety), display refusal reason

**Validation Error Types**:

1. **Constraint Violation**: AI generated non-compliant recipe (should be rare with good prompts)
2. **Missing Fields**: Structured Output incomplete (should never happen)

**User Experience**:

- Show loading spinner during generation (5-15 seconds typical)
- Display errors in toast/modal with actionable messages
- Provide "Try Again" button for transient errors
- Allow manual editing if generated recipe needs tweaks

## Implementation Instructions (For Implementor)

---

### PLAN-501: Install OpenAI SDK and Zod

**Change Type**: modify  
**File(s)**: `package.json`

**Instruction**:

1. Run `npm install openai zod` to add dependencies
2. Verify `package.json` includes:
   - `"openai": "^6.1.0"` (or latest 6.x)
   - `"zod": "^3.24.0"` (or latest 3.x)
3. Run `npm install` to update lockfile

**Evidence**: `package.json:42-47` - Current dependencies list requires openai and zod.

**Done When**: `package.json` includes both packages and `npm run typecheck` passes.

---

### PLAN-502: Create .env.example template for API key

**Change Type**: create  
**File(s)**: `.env.example`

**Instruction**:

1. Create `.env.example` in project root with content:

```
# OpenAI API Key for Recipe Generation (Phase 5)
# Get your key from: https://platform.openai.com/api-keys
# IMPORTANT: Never commit the actual .env file!
OPENAI_API_KEY=sk-proj-YOUR_KEY_HERE
```

2. Verify `.gitignore` includes `.env` (should already exist from Phase 0)

**Evidence**: New file - no prior evidence needed.

**Done When**: `.env.example` exists and contains clear instructions.

---

### PLAN-503: Create Zod schema for recipe generation

**Change Type**: create  
**File(s)**: `src/main/ai/recipe-schema.ts`

**Instruction**:

1. Create `src/main/ai/` directory if not exists
2. Create `recipe-schema.ts` with:
   - `IngredientGenerationSchema` matching `CreateIngredientInput` type
   - `RecipeGenerationSchema` matching `CreateRecipeInput` type (minus sourceType/sourceReference)
   - Use `z.literal(2)` for servings (MUST be exactly 2)
   - Use `z.number().int().min(30).max(45)` for cookingTimeMinutes
   - Use `z.enum(['one-pot', 'one-pan', 'oven'])` for cookwareType
   - Export type aliases: `RecipeGenerationOutput`, `IngredientGenerationOutput`

**Pseudocode**:

```typescript
import { z } from 'zod';

export const IngredientGenerationSchema = z.object({
  name: z.string().min(1).max(200),
  quantity: z.number().positive(),
  unit: z.string().min(1).max(50),
  dietaryProperties: z.array(
    z.enum([
      'contains-gluten',
      'contains-lactose',
      'contains-eggs',
      'contains-fish',
      'contains-meat',
      'none',
    ])
  ),
  optional: z.boolean().default(false),
  orderIndex: z.number().int().min(0),
});

export const RecipeGenerationSchema = z.object({
  title: z.string().min(1).max(200),
  cookingTimeMinutes: z.number().int().min(30).max(45),
  prepTimeMinutes: z.number().int().min(0).max(30).optional(),
  cookwareType: z.enum(['one-pot', 'one-pan', 'oven']),
  servings: z.literal(2),
  dietaryTags: z.array(
    z.enum(['gluten-free', 'lactose-free', 'vegetarian', 'vegan', 'pescatarian'])
  ),
  seasonality: z.array(z.enum(['spring', 'summer', 'fall', 'winter', 'any'])),
  instructions: z.string().min(50).max(5000).optional(),
  ingredients: z.array(IngredientGenerationSchema).min(1).max(30),
});

export type RecipeGenerationOutput = z.infer<typeof RecipeGenerationSchema>;
export type IngredientGenerationOutput = z.infer<typeof IngredientGenerationSchema>;
```

**Evidence**: `src/shared/types/recipe.ts:58-80` - CreateRecipeInput structure.

**Done When**: File compiles with TypeScript and exports schemas.

---

### PLAN-504: Create recipe generation criteria types

**Change Type**: create  
**File(s)**: `src/shared/types/ai.ts`

**Instruction**:

1. Create `src/shared/types/ai.ts` with:
   - `RecipeGenerationCriteria` interface for user input
   - `RecipeGenerationResult` interface for IPC response
   - `RecipeGenerationError` interface for error details

**Pseudocode**:

```typescript
import type { CookwareType, DietaryTag, Season } from './database.js';
import type { CreateRecipeInput } from './recipe.js';

export interface RecipeGenerationCriteria {
  cuisine?: string; // e.g., "Italian", "Thai", "Mexican"
  mainIngredient?: string; // e.g., "chicken", "tofu", "pasta"
  dietaryTags: DietaryTag[]; // Required dietary compliance
  seasonality?: Season[]; // Preferred seasons
  cookwareType?: CookwareType; // Preferred cookware (defaults to any)
  flavorProfile?: string; // e.g., "spicy", "savory", "comfort food"
  skillLevel?: 'beginner' | 'intermediate' | 'advanced';
}

export interface RecipeGenerationResult {
  success: boolean;
  recipe?: CreateRecipeInput; // Ready to save
  error?: RecipeGenerationError;
}

export interface RecipeGenerationError {
  type: 'rate-limit' | 'network' | 'auth' | 'timeout' | 'validation' | 'refusal' | 'unknown';
  message: string;
  retryAfter?: number; // Seconds (for rate-limit)
  details?: string; // Additional context
}
```

**Evidence**: New types - based on OpenAI SDK error types and IPC patterns.

**Done When**: File compiles and exports all types.

---

### PLAN-505: Create OpenAI recipe generator service

**Change Type**: create  
**File(s)**: `src/main/ai/recipe-generator.ts`

**Instruction**:

1. Create `recipe-generator.ts` with:
   - `generateRecipe(criteria)` function that calls OpenAI API
   - Use `zodResponseFormat(RecipeGenerationSchema, 'recipe')`
   - Implement system prompt (fixed)
   - Implement user prompt builder (dynamic from criteria)
   - Use `gpt-4o-mini` model
   - Set `temperature: 0.8` for creative but coherent output
   - Set `max_tokens: 2000` (sufficient for recipe)
   - Handle all OpenAI error types (RateLimit, Network, Auth, Timeout)
   - Return `CreateRecipeInput` on success with `sourceType: 'ai-generated'`

**Pseudocode**:

```typescript
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { RecipeGenerationSchema } from './recipe-schema.js';
import type { RecipeGenerationCriteria, RecipeGenerationResult } from '../../shared/types/ai.js';
import type { CreateRecipeInput } from '../../shared/types/recipe.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30000, // 30 seconds
  maxRetries: 2,
});

const SYSTEM_PROMPT = `You are a professional chef...`; // Full prompt from Design section

function buildUserPrompt(criteria: RecipeGenerationCriteria): string {
  // Build dynamic prompt from criteria
  const parts: string[] = [];

  if (criteria.cuisine) parts.push(`Cuisine: ${criteria.cuisine}`);
  if (criteria.mainIngredient) parts.push(`Main Ingredient: ${criteria.mainIngredient}`);
  parts.push(`Dietary Tags: ${criteria.dietaryTags.join(', ')} (MUST comply)`);
  // ... etc

  return parts.join('\n');
}

export async function generateRecipe(
  criteria: RecipeGenerationCriteria
): Promise<RecipeGenerationResult> {
  try {
    const completion = await openai.chat.completions.parse({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(criteria) },
      ],
      response_format: zodResponseFormat(RecipeGenerationSchema, 'recipe'),
      temperature: 0.8,
      max_tokens: 2000,
    });

    if (completion.choices[0]?.message.parsed) {
      const generated = completion.choices[0].message.parsed;

      // Convert to CreateRecipeInput
      const recipe: CreateRecipeInput = {
        ...generated,
        sourceType: 'ai-generated',
        sourceReference: `OpenAI gpt-4o-mini (${new Date().toISOString()})`,
      };

      return { success: true, recipe };
    } else if (completion.choices[0]?.message.refusal) {
      return {
        success: false,
        error: {
          type: 'refusal',
          message: 'AI refused to generate recipe',
          details: completion.choices[0].message.refusal,
        },
      };
    }

    throw new Error('No response from AI');
  } catch (error) {
    if (error instanceof OpenAI.RateLimitError) {
      return {
        success: false,
        error: {
          type: 'rate-limit',
          message: 'Rate limit exceeded. Please wait before trying again.',
          retryAfter: parseInt(error.headers?.['retry-after'] ?? '60'),
        },
      };
    } else if (error instanceof OpenAI.AuthenticationError) {
      return {
        success: false,
        error: {
          type: 'auth',
          message: 'Invalid OpenAI API key. Check configuration.',
        },
      };
    } else if (error instanceof OpenAI.APIConnectionError) {
      return {
        success: false,
        error: {
          type: 'network',
          message: 'Network error. Check internet connection.',
        },
      };
    } else if (error instanceof OpenAI.APIConnectionTimeoutError) {
      return {
        success: false,
        error: {
          type: 'timeout',
          message: 'Request timed out. Please try again.',
        },
      };
    }

    return {
      success: false,
      error: {
        type: 'unknown',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}
```

**Evidence**: OpenAI SDK patterns from web research.

**Done When**: File compiles and exports `generateRecipe()` function.

---

### PLAN-506: Create IPC handler for recipe generation

**Change Type**: create  
**File(s)**: `src/main/ipc/recipe-ai-handlers.ts`

**Instruction**:

1. Create `recipe-ai-handlers.ts` with:
   - `registerRecipeAIHandlers()` function
   - `ipcMain.handle('recipe:generate', ...)` handler
   - Validate `event.senderFrame` for security
   - Call `generateRecipe(criteria)` service
   - Optionally validate result with `validateRecipe()` (belt-and-suspenders)
   - Return structured result matching existing IPC pattern

**Pseudocode**:

```typescript
import { ipcMain } from 'electron';
import type { WebFrameMain } from 'electron/main';
import { generateRecipe } from '../ai/recipe-generator.js';
import { validateRecipe } from '../validation/validator.js';
import type { RecipeGenerationCriteria, RecipeGenerationResult } from '../../shared/types/ai.js';

function validateSender(frame: WebFrameMain): boolean {
  const url = new URL(frame.url);
  return url.protocol === 'file:' || url.host === 'localhost';
}

export function registerRecipeAIHandlers(): void {
  ipcMain.handle('recipe:generate', async (event, criteria: RecipeGenerationCriteria) => {
    // Security check
    if (!validateSender(event.senderFrame)) {
      return {
        success: false,
        error: { type: 'auth', message: 'Unauthorized IPC sender' },
      };
    }

    // Generate recipe via OpenAI
    const result = await generateRecipe(criteria);

    if (!result.success) {
      return result; // Return error as-is
    }

    // Belt-and-suspenders: Validate generated recipe
    // (Should always pass with good prompts, but catches edge cases)
    const validation = await validateRecipe(result.recipe!);

    if (!validation.valid) {
      return {
        success: false,
        error: {
          type: 'validation',
          message: 'Generated recipe failed validation',
          details: validation.errors.map(e => `${e.field}: ${e.message}`).join('\n'),
        },
      };
    }

    return result;
  });
}
```

**Evidence**: `src/main/ipc/recipe-handlers.ts:1-88` - Existing IPC pattern.

**Done When**: File compiles and exports `registerRecipeAIHandlers()`.

---

### PLAN-507: Register AI handlers in main.ts

**Change Type**: modify  
**File(s)**: `src/main/main.ts`

**Instruction**:

1. Import `registerRecipeAIHandlers` from `./ipc/recipe-ai-handlers.js`
2. Call `registerRecipeAIHandlers()` after `registerRecipeHandlers()`
3. Ensure handlers are registered before window is created

**Evidence**: `src/main/ipc/recipe-handlers.ts` exists, `main.ts` likely has similar registration pattern.

**Done When**: `main.ts` compiles and includes AI handler registration.

---

### PLAN-508: Update preload.ts to expose generateRecipe

**Change Type**: modify  
**File(s)**: `src/main/preload.ts`

**Instruction**:

1. Add `generateRecipe` method to context bridge:

```typescript
generateRecipe: (criteria: RecipeGenerationCriteria) =>
  ipcRenderer.invoke('recipe:generate', criteria),
```

**Evidence**: `src/main/preload.ts` exists and exposes IPC methods.

**Done When**: `preload.ts` compiles with new method.

---

### PLAN-509: Update electron.d.ts with generateRecipe type

**Change Type**: modify  
**File(s)**: `src/shared/types/electron.d.ts`

**Instruction**:

1. Import `RecipeGenerationCriteria`, `RecipeGenerationResult` from `./ai.js`
2. Add to `ElectronAPI` interface:

```typescript
generateRecipe: (criteria: RecipeGenerationCriteria) => Promise<RecipeGenerationResult>;
```

**Evidence**: `src/shared/types/electron.d.ts` defines ElectronAPI interface.

**Done When**: File compiles and provides type safety for `window.electronAPI.generateRecipe()`.

---

### PLAN-510: Create RecipeGenerationPage component

**Change Type**: create  
**File(s)**: `src/renderer/pages/RecipeGenerationPage.tsx`

**Instruction**:

1. Create page component with two modes:
   - **Criteria Input Mode**: Form for entering generation criteria
   - **Review Mode**: Display generated recipe with edit capability
2. Criteria form fields:
   - Cuisine (text input, optional)
   - Main Ingredient (text input, optional)
   - Dietary Tags (checkboxes from DietaryTag enum)
   - Seasonality (checkboxes from Season enum)
   - Cookware Type (radio buttons: one-pot, one-pan, oven, any)
   - Flavor Profile (text input, optional)
   - Skill Level (select: beginner, intermediate, advanced)
3. "Generate Recipe" button triggers `window.electronAPI.generateRecipe()`
4. Show loading spinner during generation
5. On success: Switch to Review Mode with generated recipe
6. On error: Display error message with "Try Again" button
7. Review Mode:
   - Display recipe using RecipeForm component (reuse from Phase 3)
   - Pre-populate form with generated data
   - Allow editing
   - "Save Recipe" button calls existing `window.electronAPI.createRecipe()`
   - "Regenerate" button returns to Criteria Input Mode

**Pseudocode**:

```typescript
import { useState } from 'react';
import type { RecipeGenerationCriteria, RecipeGenerationError } from '@shared/types/ai';
import type { CreateRecipeInput } from '@shared/types/recipe';
import { RecipeForm } from '../components/RecipeForm/RecipeForm';
import { Button } from '../components/common/Button';

type PageMode = 'criteria' | 'review';

export function RecipeGenerationPage() {
  const [mode, setMode] = useState<PageMode>('criteria');
  const [criteria, setCriteria] = useState<RecipeGenerationCriteria>({ dietaryTags: [] });
  const [generatedRecipe, setGeneratedRecipe] = useState<CreateRecipeInput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<RecipeGenerationError | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);

    const result = await window.electronAPI.generateRecipe(criteria);

    setLoading(false);

    if (result.success) {
      setGeneratedRecipe(result.recipe!);
      setMode('review');
    } else {
      setError(result.error!);
    }
  };

  const handleSave = async () => {
    if (!generatedRecipe) return;

    const result = await window.electronAPI.createRecipe(generatedRecipe);

    if (result.success) {
      // Navigate back to recipe list or show success message
      // Implementation depends on navigation strategy
    }
  };

  if (mode === 'review' && generatedRecipe) {
    return (
      <div>
        <h1>Review Generated Recipe</h1>
        <RecipeForm
          initialData={generatedRecipe}
          onSubmit={handleSave}
          submitLabel="Save to Collection"
        />
        <Button onClick={() => setMode('criteria')}>Regenerate</Button>
      </div>
    );
  }

  return (
    <div>
      <h1>Generate Recipe with AI</h1>
      <form onSubmit={(e) => { e.preventDefault(); handleGenerate(); }}>
        {/* Criteria input fields */}
        <Button type="submit" disabled={loading}>
          {loading ? 'Generating...' : 'Generate Recipe'}
        </Button>
      </form>

      {error && (
        <div className="error">
          <p>{error.message}</p>
          {error.retryAfter && <p>Retry in {error.retryAfter} seconds</p>}
          <Button onClick={handleGenerate}>Try Again</Button>
        </div>
      )}
    </div>
  );
}
```

**Evidence**: `src/renderer/components/RecipeForm/RecipeForm.tsx` exists, can be reused.

**Done When**: Component compiles and renders without errors.

---

### PLAN-511: Update App.tsx navigation to include AI generation page

**Change Type**: modify  
**File(s)**: `src/renderer/App.tsx`

**Instruction**:

1. Import `RecipeGenerationPage` from `./pages/RecipeGenerationPage.tsx`
2. Add to navigation state: `'ai-generation'` as possible page
3. Add navigation link in NavigationBar or main menu
4. Render `RecipeGenerationPage` when active

**Evidence**: `src/renderer/App.tsx` exists with navigation logic from Phase 4.

**Done When**: Can navigate to AI generation page in UI.

---

### PLAN-512: Create unit tests for Zod schema validation

**Change Type**: create  
**File(s)**: `src/main/ai/recipe-schema.test.ts`

**Instruction**:

1. Test valid recipe generation output
2. Test invalid outputs (missing required fields, wrong types, constraint violations)
3. Verify servings must be exactly 2
4. Verify cookingTimeMinutes must be 30-45
5. Verify cookwareType must be enum value

**Pseudocode**:

```typescript
import { describe, it, expect } from 'vitest';
import { RecipeGenerationSchema } from './recipe-schema.js';

describe('RecipeGenerationSchema', () => {
  it('should validate correct recipe structure', () => {
    const valid = {
      title: 'Test Recipe',
      cookingTimeMinutes: 35,
      cookwareType: 'one-pot',
      servings: 2,
      dietaryTags: ['gluten-free'],
      seasonality: ['fall'],
      ingredients: [
        {
          name: 'test',
          quantity: 1,
          unit: 'cup',
          dietaryProperties: ['none'],
          optional: false,
          orderIndex: 0,
        },
      ],
    };

    expect(() => RecipeGenerationSchema.parse(valid)).not.toThrow();
  });

  it('should reject servings other than 2', () => {
    const invalid = { /* ... */ servings: 4 };
    expect(() => RecipeGenerationSchema.parse(invalid)).toThrow();
  });

  it('should reject cooking time outside 30-45 range', () => {
    const invalid = { /* ... */ cookingTimeMinutes: 60 };
    expect(() => RecipeGenerationSchema.parse(invalid)).toThrow();
  });
});
```

**Evidence**: Vitest test pattern from existing tests.

**Done When**: Tests pass with `npm run test:unit`.

---

### PLAN-513: Create unit tests for recipe generator (mocked)

**Change Type**: create  
**File(s)**: `src/main/ai/recipe-generator.test.ts`

**Instruction**:

1. Mock OpenAI SDK with `vi.mock('openai')`
2. Test successful generation flow
3. Test rate limit error handling
4. Test network error handling
5. Test authentication error handling
6. Test timeout error handling
7. Test refusal handling
8. Verify prompt construction with different criteria

**Pseudocode**:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OpenAI from 'openai';
import { generateRecipe } from './recipe-generator.js';

vi.mock('openai', () => {
  const MockOpenAI = vi.fn(() => ({
    chat: {
      completions: {
        parse: vi.fn(),
      },
    },
  }));

  MockOpenAI.RateLimitError = class extends Error {
    headers?: Record<string, string>;
  };
  MockOpenAI.AuthenticationError = class extends Error {};
  MockOpenAI.APIConnectionError = class extends Error {};
  MockOpenAI.APIConnectionTimeoutError = class extends Error {};

  return { default: MockOpenAI };
});

describe('generateRecipe', () => {
  let mockParse: any;

  beforeEach(() => {
    const openai = new OpenAI();
    mockParse = openai.chat.completions.parse as any;
    vi.clearAllMocks();
  });

  it('should generate recipe successfully', async () => {
    const mockRecipe = {
      title: 'AI Pasta',
      cookingTimeMinutes: 35,
      cookwareType: 'one-pot' as const,
      servings: 2,
      dietaryTags: ['gluten-free'] as const,
      seasonality: ['fall'] as const,
      ingredients: [
        {
          name: 'pasta',
          quantity: 200,
          unit: 'g',
          dietaryProperties: ['none'] as const,
          optional: false,
          orderIndex: 0,
        },
      ],
    };

    mockParse.mockResolvedValue({
      choices: [{ message: { parsed: mockRecipe } }],
    });

    const result = await generateRecipe({ dietaryTags: ['gluten-free'] });

    expect(result.success).toBe(true);
    expect(result.recipe).toBeDefined();
    expect(result.recipe?.sourceType).toBe('ai-generated');
  });

  it('should handle rate limit error', async () => {
    const error = new OpenAI.RateLimitError('Rate limit');
    (error as any).headers = { 'retry-after': '60' };
    mockParse.mockRejectedValue(error);

    const result = await generateRecipe({ dietaryTags: [] });

    expect(result.success).toBe(false);
    expect(result.error?.type).toBe('rate-limit');
    expect(result.error?.retryAfter).toBe(60);
  });
});
```

**Evidence**: Vitest mock patterns from web research.

**Done When**: Tests pass with `npm run test:unit`.

---

### PLAN-514: Create integration test for IPC handler (mocked OpenAI)

**Change Type**: create  
**File(s)**: `src/main/ipc/recipe-ai-handlers.test.ts`

**Instruction**:

1. Mock OpenAI SDK
2. Test IPC handler with valid criteria
3. Test IPC handler with invalid sender (security)
4. Test validation failure handling (belt-and-suspenders)
5. Verify result structure matches IPC pattern

**Pseudocode**:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ipcMain } from 'electron';
import { registerRecipeAIHandlers } from './recipe-ai-handlers.js';

vi.mock('openai', () => {
  /* ... mock setup ... */
});

describe('Recipe AI IPC Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle recipe:generate IPC call', async () => {
    registerRecipeAIHandlers();

    const handler = (ipcMain.handle as any).mock.calls.find(
      (call: any) => call[0] === 'recipe:generate'
    )?.[1];

    expect(handler).toBeDefined();

    const mockEvent = {
      senderFrame: { url: 'file:///app/index.html' },
    };

    const result = await handler(mockEvent, { dietaryTags: ['gluten-free'] });

    expect(result).toHaveProperty('success');
  });
});
```

**Evidence**: Existing IPC test patterns from `recipe-handlers.test.ts`.

**Done When**: Tests pass with `npm run test:unit`.

---

### PLAN-515: Create E2E test for AI recipe generation workflow (mocked)

**Change Type**: create  
**File(s)**: `e2e/ai-recipe-generation.spec.ts`

**Instruction**:

1. Mock `window.electronAPI.generateRecipe()` to avoid real API calls
2. Test full workflow:
   - Navigate to AI generation page
   - Fill criteria form
   - Click "Generate Recipe"
   - Verify loading state
   - Verify generated recipe appears in review mode
   - Edit recipe (optional)
   - Save recipe
   - Verify recipe appears in collection
3. Test error handling:
   - Mock rate limit error
   - Verify error message displays
   - Verify "Try Again" button works

**Pseudocode**:

```typescript
import { test, expect } from '@playwright/test';

test.describe('AI Recipe Generation', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the IPC call
    await page.evaluate(() => {
      window.electronAPI.generateRecipe = async criteria => ({
        success: true,
        recipe: {
          title: 'AI Generated Pasta',
          cookingTimeMinutes: 35,
          cookwareType: 'one-pot',
          servings: 2,
          dietaryTags: criteria.dietaryTags,
          seasonality: ['fall'],
          sourceType: 'ai-generated',
          ingredients: [
            {
              name: 'pasta',
              quantity: 200,
              unit: 'g',
              dietaryProperties: ['none'],
              optional: false,
              orderIndex: 0,
            },
          ],
        },
      });
    });
  });

  test('should generate and save AI recipe', async ({ page }) => {
    await page.goto('http://localhost:5173');

    // Navigate to AI generation page
    await page.click('[data-testid="nav-ai-generation"]');

    // Fill criteria
    await page.fill('[name="mainIngredient"]', 'chicken');
    await page.check('[name="dietaryTags"][value="gluten-free"]');

    // Generate
    await page.click('[data-testid="generate-btn"]');

    // Wait for review mode
    await expect(page.locator('h1:has-text("Review Generated Recipe")')).toBeVisible();

    // Verify recipe title appears
    await expect(page.locator('[name="title"]')).toHaveValue('AI Generated Pasta');

    // Save recipe
    await page.click('[data-testid="save-recipe-btn"]');

    // Verify navigation to recipe list (or success message)
    await expect(page.locator('.recipe-card:has-text("AI Generated Pasta")')).toBeVisible();
  });

  test('should handle rate limit error', async ({ page }) => {
    await page.evaluate(() => {
      window.electronAPI.generateRecipe = async () => ({
        success: false,
        error: {
          type: 'rate-limit',
          message: 'Rate limit exceeded',
          retryAfter: 60,
        },
      });
    });

    await page.goto('http://localhost:5173');
    await page.click('[data-testid="nav-ai-generation"]');
    await page.click('[data-testid="generate-btn"]');

    await expect(page.locator('.error:has-text("Rate limit exceeded")')).toBeVisible();
    await expect(page.locator('.error:has-text("Retry in 60 seconds")')).toBeVisible();
  });
});
```

**Evidence**: Existing E2E patterns from `manual-entry.spec.ts` and `recipe-viewing.spec.ts`.

**Done When**: E2E tests pass with `npm run test:e2e`.

---

### PLAN-516: Create user documentation for AI recipe generation

**Change Type**: create  
**File(s)**: `docs/user-guide-ai-generation.md`

**Instruction**:

1. Document how to obtain OpenAI API key
2. Document how to configure `.env` file
3. Document AI generation workflow (criteria → review → save)
4. Document common errors and solutions
5. Document cost expectations (est. $0.001 per recipe)
6. Include screenshots (can be placeholders)

**Content**:

```markdown
# User Guide: AI Recipe Generation

## Setup

### 1. Obtain OpenAI API Key

1. Visit https://platform.openai.com/api-keys
2. Sign up or log in
3. Click "Create new secret key"
4. Copy the key (starts with `sk-proj-...`)

### 2. Configure SimpleKitchen

1. Copy `.env.example` to `.env` in the project root
2. Open `.env` in a text editor
3. Replace `YOUR_KEY_HERE` with your OpenAI API key
4. Save the file
5. Restart SimpleKitchen

**IMPORTANT**: Never share your API key or commit the `.env` file to version control.

## Generating Recipes

### Step 1: Navigate to AI Generation

Click "Generate with AI" in the main menu.

### Step 2: Enter Criteria

Fill in your preferences:

- **Cuisine** (optional): e.g., "Italian", "Thai", "Mexican"
- **Main Ingredient** (optional): e.g., "chicken", "tofu"
- **Dietary Tags** (required): Select all that apply
- **Seasonality** (optional): Choose preferred seasons
- **Cookware Type** (optional): Select preferred cookware or leave as "Any"
- **Flavor Profile** (optional): e.g., "spicy", "comfort food"
- **Skill Level** (optional): Beginner, Intermediate, or Advanced

### Step 3: Generate

Click "Generate Recipe". This typically takes 5-15 seconds.

### Step 4: Review & Edit

The generated recipe appears in an editable form. You can:

- Edit any field (title, ingredients, instructions, etc.)
- Add or remove ingredients
- Adjust quantities

### Step 5: Save or Regenerate

- Click "Save to Collection" to add the recipe
- Click "Regenerate" to try again with the same or different criteria

## Cost Information

AI recipe generation costs approximately **$0.001 per recipe** (less than 1/10th of a cent) using OpenAI's gpt-4o-mini model.

**Monthly estimates**:

- 100 recipes: ~$0.08
- 1,000 recipes: ~$0.82

You can monitor your usage at: https://platform.openai.com/account/usage

## Common Errors

### "Invalid OpenAI API key"

- **Cause**: API key not configured or incorrect
- **Solution**: Check `.env` file, verify key is correct, restart app

### "Rate limit exceeded"

- **Cause**: Too many requests in a short time
- **Solution**: Wait the indicated time (usually 60 seconds) and try again

### "Network error"

- **Cause**: No internet connection or OpenAI API is down
- **Solution**: Check internet connection, try again later

### "Generated recipe failed validation"

- **Cause**: AI generated a recipe that violates constraints (rare)
- **Solution**: Click "Regenerate" to try again

## Tips

- Be specific with criteria for better results (e.g., "spicy Thai noodles" vs "Thai food")
- If you don't like the first result, try "Regenerate" - AI output varies
- You can always edit the generated recipe before saving
- Leave criteria fields blank for more creative freedom

## Privacy & Security

- Your API key is stored locally and never transmitted to SimpleKitchen servers
- Recipe generation requests go directly to OpenAI
- SimpleKitchen does not log or store your prompts or generated recipes beyond your local database
```

**Evidence**: User documentation pattern from Phase 4.

**Done When**: Documentation exists and is accurate.

---

### PLAN-517: Create developer documentation for Phase 5

**Change Type**: create  
**File(s)**: `docs/dev-guide-phase5.md`

**Instruction**:

1. Document OpenAI SDK integration architecture
2. Document Zod schema design decisions
3. Document prompt engineering approach
4. Document error handling strategy
5. Document testing approach (mocks vs integration)
6. Document cost tracking recommendations
7. Include code examples for common tasks

**Content**:

```markdown
# Developer Guide: Phase 5 - AI Recipe Generation

## Architecture Overview

### Component Diagram
```

RecipeGenerationPage (Renderer)
↓ IPC: recipe:generate
recipe-ai-handlers.ts (Main Process)
↓ calls
recipe-generator.ts (AI Service)
↓ OpenAI API
gpt-4o-mini with Structured Outputs
↓ returns
CreateRecipeInput (validated)
↓ saved via
createRecipe() DAL (existing)

```

### File Structure

```

src/
├── main/
│ ├── ai/
│ │ ├── recipe-schema.ts # Zod schemas
│ │ ├── recipe-schema.test.ts
│ │ ├── recipe-generator.ts # OpenAI integration
│ │ └── recipe-generator.test.ts
│ └── ipc/
│ ├── recipe-ai-handlers.ts # IPC handlers
│ └── recipe-ai-handlers.test.ts
├── renderer/
│ └── pages/
│ └── RecipeGenerationPage.tsx
└── shared/
└── types/
└── ai.ts # AI-specific types

````

## OpenAI Structured Outputs

### Why Structured Outputs?

- **Guaranteed schema compliance**: 100% adherence vs ~40% with JSON mode
- **Type safety**: Zod schema → TypeScript types via `z.infer<>`
- **No parsing errors**: OpenAI handles JSON generation internally
- **Automatic validation**: Rejects invalid outputs before returning

### Schema Design

**Key Decision**: Zod schema mirrors `CreateRecipeInput` type exactly (minus `sourceType`/`sourceReference`).

**Rationale**:
- Single source of truth for recipe structure
- AI output can be directly passed to existing `createRecipe()` DAL
- TypeScript inference provides compile-time type safety

**Example**:
```typescript
export const RecipeGenerationSchema = z.object({
  title: z.string().min(1).max(200),
  cookingTimeMinutes: z.number().int().min(30).max(45), // HARD constraint
  servings: z.literal(2), // MUST be exactly 2
  // ... other fields
});

type RecipeGenerationOutput = z.infer<typeof RecipeGenerationSchema>;
// Type is compatible with CreateRecipeInput
````

## Prompt Engineering

### System Prompt Strategy

Fixed system prompt emphasizes:

1. **Constraint compliance**: NEVER violate cooking time, servings, cookware, dietary
2. **Precision**: Exact measurements, not ranges
3. **Dietary properties**: Accurate marking (contains-gluten, etc.)
4. **Home cook focus**: Practical, achievable recipes

### User Prompt Strategy

Dynamic prompt constructed from `RecipeGenerationCriteria`:

- Include only specified criteria (don't force defaults)
- Emphasize MUST vs SHOULD constraints
- Provide context (cuisine, flavor profile, skill level)

### Temperature Selection

- **0.8**: Creative but coherent (chosen for recipe generation)
- **0.3-0.5**: More deterministic (use for factual content)
- **1.0**: Maximum creativity (too random for recipes)

## Error Handling

### Error Type Hierarchy

```typescript
type ErrorType =
  | 'rate-limit' // 429 - Wait and retry
  | 'network' // Connection failed
  | 'auth' // 401 - Invalid API key
  | 'timeout' // Request took too long
  | 'validation' // Generated recipe failed constraints
  | 'refusal' // AI refused (safety)
  | 'unknown'; // Unexpected error
```

### Retry Strategy

**Built-in retries** (OpenAI SDK default):

- Max retries: 2
- Retry on: Connection errors, 408, 429, ≥500
- Exponential backoff

**User-initiated retries**:

- Rate limit: Show countdown timer, enable retry button
- Network: Immediate retry allowed
- Validation: Automatic regeneration (no user action)

### Belt-and-Suspenders Validation

Even though Structured Outputs enforces schema compliance, we still validate with `validateRecipe()`:

**Rationale**:

- Catches edge cases (e.g., AI marks butter as "none" instead of "contains-lactose")
- Provides consistent error messaging
- Defense in depth

## Testing Strategy

### Unit Tests (Mocked)

**DO**: Mock OpenAI SDK for all unit tests

```typescript
vi.mock('openai', () => {
  const MockOpenAI = vi.fn(() => ({
    chat: { completions: { parse: vi.fn() } },
  }));
  return { default: MockOpenAI };
});
```

**Rationale**:

- Zero API cost
- Fast execution (<100ms vs 5-15 seconds)
- Deterministic results
- Test error handling

### Integration Tests (Conditional)

**DO**: Gate real API tests behind environment variable

```typescript
const hasApiKey = !!process.env.OPENAI_API_KEY;

describe.skipIf(!hasApiKey)('OpenAI Integration', () => {
  it('should generate real recipe', async () => {
    // Real API call
  }, 30000); // 30s timeout
});
```

**Rationale**:

- Only run on CI or when explicitly testing
- Monitor cost (~$0.001 per test)
- Validate against real API behavior

### E2E Tests (Mocked)

**DO**: Mock `window.electronAPI.generateRecipe()` in E2E tests

```typescript
await page.evaluate(() => {
  window.electronAPI.generateRecipe = async () => ({
    success: true,
    recipe: {
      /* ... */
    },
  });
});
```

**Rationale**:

- E2E tests focus on UI/UX, not API integration
- Playwright tests run frequently (every commit)
- Avoid API costs in CI

## Cost Management

### Monitoring

1. **OpenAI Dashboard**: https://platform.openai.com/account/usage
2. **Set budget alerts**: Settings → Billing → Budget alerts
3. **Track usage**: Log recipe generation counts locally (optional)

### Optimization Opportunities (Future)

1. **Prompt caching**: OpenAI's cache feature reduces input token cost by 90%
   - System prompt is cached automatically after first use
   - Reduces cost to ~$0.0006 per recipe
2. **Batch generation**: Generate multiple recipes in one request
3. **Fine-tuning**: Train custom model on your recipe format (advanced)

### Cost Estimation

**Current (gpt-4o-mini)**:

- Input: ~1,500 tokens × $0.15/1M = $0.000225
- Output: ~1,000 tokens × $0.60/1M = $0.000600
- **Total: ~$0.000825 per recipe**

**With caching**:

- Input: ~1,500 tokens × $0.015/1M = $0.0000225 (cached system prompt)
- Output: ~1,000 tokens × $0.60/1M = $0.000600
- **Total: ~$0.0006225 per recipe** (25% reduction)

## Security

### API Key Management

**Development**:

```bash
# .env file (NEVER commit!)
OPENAI_API_KEY=sk-proj-...
```

**Production** (future):

```typescript
import { safeStorage } from 'electron';

// Encrypt and store
const encrypted = safeStorage.encryptString(apiKey);
fs.writeFileSync(configPath, encrypted);

// Load and decrypt
const decrypted = safeStorage.decryptString(fs.readFileSync(configPath));
```

### IPC Security

**Always validate sender**:

```typescript
function validateSender(frame: WebFrameMain): boolean {
  const url = new URL(frame.url);
  return url.protocol === 'file:' || url.host === 'localhost';
}
```

**Rationale**: Prevents malicious external pages from calling IPC handlers.

## Common Tasks

### Adding New Criteria Field

1. Update `RecipeGenerationCriteria` in `shared/types/ai.ts`
2. Update `buildUserPrompt()` in `recipe-generator.ts`
3. Add form field in `RecipeGenerationPage.tsx`
4. Update tests

### Changing Model

```typescript
// In recipe-generator.ts
const completion = await openai.chat.completions.parse({
  model: 'gpt-4o', // Change here
  // ... rest unchanged
});
```

**Note**: Verify model supports Structured Outputs (gpt-4o-2024-08-06+).

### Debugging Failed Generations

1. Check OpenAI dashboard for error logs
2. Log full prompt (system + user) to console
3. Check validation errors (belt-and-suspenders catch)
4. Verify schema constraints match prompt instructions

## Troubleshooting

### "Module not found: openai"

**Solution**: Run `npm install openai zod`

### "Cannot read property 'parsed' of undefined"

**Cause**: OpenAI API returned unexpected format  
**Solution**: Check if API key is valid, verify model supports Structured Outputs

### Tests fail with "OPENAI_API_KEY is not defined"

**Cause**: Unit tests should not access env vars (use mocks)  
**Solution**: Verify mocks are set up correctly, check `vi.mock('openai')` is called

### Generated recipes always fail validation

**Cause**: Mismatch between prompt constraints and Zod schema  
**Solution**: Ensure system prompt emphasizes same constraints as schema (30-45 min, servings=2, etc.)

````

**Evidence**: Developer documentation pattern from existing dev guides.

**Done When**: Documentation exists and is accurate.

---

### PLAN-518: Add README section for API key setup

**Change Type**: modify
**File(s)**: `README.md`

**Instruction**:
1. Add "AI Recipe Generation Setup" section after installation instructions
2. Document `.env` configuration with `.env.example` reference
3. Link to user guide for detailed instructions
4. Warn about API key security (never commit)

**Pseudocode**:
```markdown
## AI Recipe Generation Setup (Phase 5)

SimpleKitchen uses OpenAI's GPT-4o-mini to generate recipes based on your criteria.

### 1. Obtain API Key

1. Sign up at [OpenAI Platform](https://platform.openai.com/)
2. Create an API key at [API Keys](https://platform.openai.com/api-keys)
3. Copy the key (starts with `sk-proj-...`)

### 2. Configure

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
````

2. Edit `.env` and add your key:

   ```
   OPENAI_API_KEY=sk-proj-YOUR_ACTUAL_KEY
   ```

3. Restart the app

**⚠️ IMPORTANT**: Never commit the `.env` file. It's already in `.gitignore`.

### Cost

AI generation costs ~$0.001 per recipe (less than 1/10th of a cent).

For detailed usage instructions, see [User Guide: AI Recipe Generation](docs/user-guide-ai-generation.md).

```

**Evidence**: README.md exists in file tree.

**Done When**: README includes AI setup section.

---

### VERIFY-501: Verify recipe generation works end-to-end

**Change Type**: verification
**Manual Steps**:
1. Set up `.env` file with valid OpenAI API key
2. Start application in dev mode (`npm run dev`)
3. Navigate to AI generation page
4. Enter criteria (e.g., "Italian pasta, gluten-free")
5. Click "Generate Recipe"
6. Verify loading state appears
7. Verify generated recipe appears in review mode
8. Verify recipe complies with constraints (30-45 min, servings=2, gluten-free tag)
9. Edit recipe (change title)
10. Save recipe
11. Verify recipe appears in collection with sourceType='ai-generated'

**Done When**: Full workflow completes successfully without errors.

---

### VERIFY-502: Verify error handling for rate limits

**Change Type**: verification
**Manual Steps**:
1. Trigger rate limit by making 10+ rapid generation requests
2. Verify error message displays: "Rate limit exceeded"
3. Verify retry countdown appears
4. Wait for countdown to expire
5. Click "Try Again"
6. Verify generation succeeds

**Alternative**: Mock rate limit error in code temporarily.

**Done When**: Rate limit error displays correctly with retry mechanism.

---

### VERIFY-503: Verify error handling for invalid API key

**Change Type**: verification
**Manual Steps**:
1. Modify `.env` to use invalid API key
2. Restart application
3. Try to generate recipe
4. Verify error message: "Invalid OpenAI API key"
5. Verify clear guidance to check configuration
6. Restore valid API key
7. Verify generation works again

**Done When**: Invalid API key error displays with clear guidance.

---

### VERIFY-504: Verify error handling for network failure

**Change Type**: verification
**Manual Steps**:
1. Disconnect internet
2. Try to generate recipe
3. Verify error message: "Network error. Check internet connection."
4. Click "Try Again" (should fail again)
5. Reconnect internet
6. Click "Try Again"
7. Verify generation succeeds

**Done When**: Network error displays correctly with retry capability.

---

### VERIFY-505: Verify all unit tests pass

**Change Type**: verification
**Command**: `npm run test:unit`

**Done When**: All unit tests pass (including new AI tests).

---

### VERIFY-506: Verify all integration tests pass

**Change Type**: verification
**Command**: `npm run test:integration`

**Done When**: All integration tests pass.

---

### VERIFY-507: Verify all E2E tests pass

**Change Type**: verification
**Command**: `npm run test:e2e`

**Done When**: All E2E tests pass (including new AI generation test).

---

### VERIFY-508: Verify documentation accuracy

**Change Type**: verification
**Manual Steps**:
1. Follow user guide step-by-step as a new user
2. Verify all screenshots/instructions are accurate
3. Test all documented error scenarios
4. Verify developer guide code examples compile
5. Check for broken links

**Done When**: Documentation is accurate and complete.

---

## Acceptance Criteria (From Master Plan)

This phase addresses:

- [x] **Epic Functional AC 2**: User can request AI generation, review, and add to collection
- [x] **Epic Technical AC 1-4**: Recipes conform to schema, validation runs before persistence
- [x] **Epic Quality AC 2**: Integration tests demonstrate AI acquisition mode end-to-end

## Implementor Checklist

### Setup & Dependencies (Priority 1 - CRITICAL PATH)
- [ ] PLAN-501: Install OpenAI SDK and Zod
- [ ] PLAN-502: Create .env.example template

### Schema & Types (Priority 1 - CRITICAL PATH)
- [ ] PLAN-503: Create Zod schema for recipe generation
- [ ] PLAN-504: Create recipe generation criteria types

### AI Service Layer (Priority 1 - CRITICAL PATH)
- [ ] PLAN-505: Create OpenAI recipe generator service
- [ ] PLAN-506: Create IPC handler for recipe generation
- [ ] PLAN-507: Register AI handlers in main.ts

### IPC Bridge (Priority 1 - CRITICAL PATH)
- [ ] PLAN-508: Update preload.ts to expose generateRecipe
- [ ] PLAN-509: Update electron.d.ts with generateRecipe type

### UI (Priority 2)
- [ ] PLAN-510: Create RecipeGenerationPage component
- [ ] PLAN-511: Update App.tsx navigation

### Testing (Priority 3)
- [ ] PLAN-512: Create unit tests for Zod schema
- [ ] PLAN-513: Create unit tests for recipe generator (mocked)
- [ ] PLAN-514: Create integration test for IPC handler (mocked)
- [ ] PLAN-515: Create E2E test for AI workflow (mocked)

### Documentation (Priority 4)
- [ ] PLAN-516: Create user documentation
- [ ] PLAN-517: Create developer documentation
- [ ] PLAN-518: Add README section for API key setup

### Verification (Priority 5 - FINAL)
- [ ] VERIFY-501: Verify recipe generation end-to-end
- [ ] VERIFY-502: Verify error handling for rate limits
- [ ] VERIFY-503: Verify error handling for invalid API key
- [ ] VERIFY-504: Verify error handling for network failure
- [ ] VERIFY-505: Verify all unit tests pass
- [ ] VERIFY-506: Verify all integration tests pass
- [ ] VERIFY-507: Verify all E2E tests pass
- [ ] VERIFY-508: Verify documentation accuracy

---

## Risk Mitigation

### Risk 1: OpenAI API Costs During Development
**Impact**: Budget overruns if developers make excessive API calls
**Mitigation**:
- All unit/E2E tests use mocks (zero cost)
- Integration tests gated behind env var
- Document cost tracking in dev guide
**Verification**: Check OpenAI dashboard weekly, set budget alerts

### Risk 2: AI Generates Constraint-Violating Recipes
**Impact**: User receives non-compliant recipe despite validation
**Mitigation**:
- Strict Zod schema with literal/min/max constraints
- Emphatic system prompt
- Belt-and-suspenders validation with `validateRecipe()`
**Verification**: VERIFY-501 checks compliance, unit tests verify validation

### Risk 3: API Key Leakage
**Impact**: Security breach, unauthorized API usage
**Mitigation**:
- `.env` in `.gitignore` (already present from Phase 0)
- Document security best practices
- IPC sender validation
- Never expose key to renderer process
**Verification**: Code review, security checklist in VERIFY-508

### Risk 4: Poor AI Output Quality
**Impact**: Generated recipes are impractical or unappealing
**Mitigation**:
- Careful prompt engineering (system + user prompts)
- User review step (can edit before saving)
- Temperature tuning (0.8 for creativity + coherence)
- Allow regeneration
**Verification**: VERIFY-501 includes subjective quality check

### Risk 5: Network/API Unavailability
**Impact**: Feature unusable when OpenAI API is down
**Mitigation**:
- Clear error messages with retry capability
- Graceful degradation (manual entry still works)
- Timeout handling (30 seconds)
**Verification**: VERIFY-504 tests network failure handling

---

## Traceability Matrix

| User Story | Phase 5 Tasks | Acceptance Criteria |
|------------|---------------|---------------------|
| Story 2: AI Generation | PLAN-501 to PLAN-518 | Epic Functional AC 2 |
| Story 4: Constraint Validation | PLAN-505 (belt-and-suspenders) | Epic Technical AC 4 |
| Story 6: Persistence | Reuses existing createRecipe() | Epic Functional AC 8 |

---

## Next Steps (For Implementor)

1. **Review this plan** and confirm understanding
2. **Set up OpenAI API key** (free tier sufficient for development)
3. **Execute tasks sequentially** by priority:
   - Priority 1 (PLAN-501 to PLAN-509): Critical path for functionality
   - Priority 2 (PLAN-510 to PLAN-511): UI integration
   - Priority 3 (PLAN-512 to PLAN-515): Testing
   - Priority 4 (PLAN-516 to PLAN-518): Documentation
   - Priority 5 (VERIFY-501 to VERIFY-508): Final verification
4. **Update STATE file** after each task completion
5. **Run tests frequently** (`npm run test:unit` after each code change)
6. **Verify manually** with VERIFY tasks before marking phase complete

---

## Milestone: MVP 3

**Definition**: Users can generate recipes via AI with custom criteria, review generated recipes, and save to their collection.

**Evidence of Completion**:
- [ ] All 18 implementation tasks complete
- [ ] All 8 verification tasks pass
- [ ] User can generate recipe via AI in <30 seconds
- [ ] Generated recipes comply with all constraints (dietary, time, cookware, servings)
- [ ] AI generation errors display clearly with retry capability
- [ ] Documentation exists and is accurate
- [ ] All automated tests pass (unit, integration, E2E)

**Ready for**: Phase 6 (Web Recipe Import)

---

**End of Phase 5 Plan**
```
