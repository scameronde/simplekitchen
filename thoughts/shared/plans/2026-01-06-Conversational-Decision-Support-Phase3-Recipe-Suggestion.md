---
date: 2026-01-06
planner: assistant
phase: 3
epic-id: 'EPIC-002'
master-plan: 'thoughts/shared/plans/2026-01-02-Conversational-Decision-Support-MASTER.md'
research-source: 'thoughts/shared/research/2026-01-02-Conversational-Decision-Support.md'
status: ready-for-implementation
dependencies:
  - 'Phase 2: AI Integration & Contextual Questions (COMPLETE)'
---

# Phase 3 Implementation Plan: Recipe Suggestion & Ranking

## Inputs

### Source Documents

- **Master Plan**: `thoughts/shared/plans/2026-01-02-Conversational-Decision-Support-MASTER.md`
- **Research Report**: `thoughts/shared/research/2026-01-02-Conversational-Decision-Support.md`
- **Epic Definition**: `thoughts/shared/epics/2025-12-25-Conversational-Decision-Support.md`
- **Spec**: `thoughts/shared/specs/2025-12-25-SimpleKitchen.md`

### User Request Summary

Implement recipe suggestion and AI-powered ranking based on user context captured in Phase 2. After gathering user context (energy level, available time, mood, shopping capability), the system should query the recipe database with hard constraints (dietary, time, cookware), then use AI to rank 2-4 recipes based on contextual fit. Display ranked suggestions in conversation UI with reasoning.

---

## Verified Current State

### Evidence 1: Recipe DAL Supports Filtering

**Fact**: The existing recipe DAL provides filtering by cookware type, cooking time, dietary tags, and seasonality.

**Evidence**: `src/main/database/dal/recipes.ts:119-154`

**Excerpt**:

```typescript
export async function getRecipes(filter?: RecipeFilter): Promise<Recipe[]> {
  let query = db.selectFrom('recipes').selectAll();

  // Apply filters
  if (filter) {
    if (filter.cookingTimeMin !== undefined) {
      query = query.where('cooking_time_minutes', '>=', filter.cookingTimeMin);
    }
    if (filter.cookingTimeMax !== undefined) {
      query = query.where('cooking_time_minutes', '<=', filter.cookingTimeMax);
    }
    if (filter.cookwareTypes && filter.cookwareTypes.length > 0) {
      query = query.where('cookware_type', 'in', filter.cookwareTypes);
    }
    // Apply dietary tags filter (check if ALL selected tags are present)
    if (filter.dietaryTags && filter.dietaryTags.length > 0) {
      for (const tag of filter.dietaryTags) {
        // SQLite JSON array contains check using LIKE pattern
        query = query.where(sql<boolean>`dietary_tags LIKE ${'%"' + tag + '"%'}`);
      }
    }
```

### Evidence 2: Dietary Profile DAL Exists

**Fact**: A dietary profile DAL exists with `getDietaryProfile()` function returning hard restrictions and preferences.

**Evidence**: `src/main/database/dal/dietary-profile.ts:6-27`

**Excerpt**:

```typescript
export async function getDietaryProfile(): Promise<DietaryProfile> {
  const row = await db
    .selectFrom('dietary_profile')
    .selectAll()
    .where('id', '=', 1)
    .executeTakeFirst();

  if (!row) {
    throw new Error('Dietary profile not found');
  }

  return {
    id: row.id,
    hardRestrictions: JSON.parse(row.hard_restrictions),
    preferences: JSON.parse(row.preferences),
    explicitInclusions: JSON.parse(row.explicit_inclusions),
    explicitExclusions: JSON.parse(row.explicit_exclusions),
    updatedAt: new Date(row.updated_at),
  };
}
```

### Evidence 3: Conversation Service from Phase 2

**Fact**: Phase 2 delivered `conversation-service.ts` with OpenAI integration and `processConversationTurn()` function.

**Evidence**: `src/main/conversation/conversation-service.ts:43-95`

**Excerpt**:

```typescript
export async function processConversationTurn(
  sessionId: string,
  userMessage: string
): Promise<ConversationTurnOutput> {
  try {
    const session = getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Add user message, fetch dietary profile, build prompt, call OpenAI
    const client = getOpenAIClient();
    const completion = await client.chat.completions.parse({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: GATHERING_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      response_format: zodResponseFormat(ConversationTurnSchema, 'conversation_turn'),
```

### Evidence 4: OpenAI Structured Output Pattern

**Fact**: The codebase uses `zodResponseFormat()` for structured outputs with Zod schemas.

**Evidence**: `src/main/ai/recipe-schema.ts:21-33`

**Excerpt**:

```typescript
export const RecipeGenerationSchema = z.object({
  title: z.string().min(1).max(200),
  cookingTimeMinutes: z.number().int().min(0).max(60),
  prepTimeMinutes: z.number().int().min(0).max(30).nullable(),
  cookwareType: z.enum(['one-pot', 'one-pan', 'oven']),
  servings: z.literal(2),
  dietaryTags: z.array(
    z.enum(['gluten-free', 'lactose-free', 'vegetarian', 'vegan', 'pescatarian'])
  ),
  seasonality: z.array(z.enum(['spring', 'summer', 'fall', 'winter', 'any'])),
  instructions: z.string().min(50).max(5000).nullable(),
  ingredients: z.array(IngredientGenerationSchema).min(1).max(30),
});
```

### Evidence 5: Conversation Types Include UserContext

**Fact**: `UserContext` type is defined in conversation types with energyLevel, availableTime, mood, canShop.

**Evidence**: `src/shared/types/conversation.ts:41-46`

**Excerpt**:

```typescript
export interface UserContext {
  energyLevel?: 'low' | 'medium' | 'high';
  availableTime?: number; // minutes (30-60 range)
  mood?: string; // free-text description
  canShop?: boolean; // whether user can go shopping
}
```

---

## Goals / Non-Goals

### Goals

1. **Query candidate recipes** from database with hard constraints (dietary, time, cookware)
2. **Rank recipes with AI** based on user context (energy, time, mood, seasonality)
3. **Display 2-4 suggestions** in conversation UI with reasoning
4. **Track suggested recipes** in session state to avoid re-suggesting
5. **Enforce dietary constraints** at database level (100% enforcement)
6. **Meet performance targets**: DB query <1s, AI ranking <5s

### Non-Goals

1. **NOT** implementing feedback handling (Phase 4)
2. **NOT** implementing shopping list generation (Phase 5)
3. **NOT** tracking cooking history for variety (EPIC-003)
4. **NOT** handling recipe selection confirmation (Phase 5)
5. **NOT** implementing refinement loop (Phase 4)

---

## Design Overview

### Architecture: Two-Stage Filtering + AI Ranking

**Stage 1: Database Filtering (Hard Constraints)**

- Query recipes from database with:
  - Dietary tags matching `DietaryProfile.hardRestrictions` (ALL must be present)
  - Cooking time ≤ `UserContext.availableTime`
  - Cookware type preference (if specified)
  - Exclude recipes already suggested in this session (`session.suggestedRecipes`)

**Stage 2: AI Ranking (Soft Factors)**

- Send candidate recipes + user context to OpenAI GPT-4o-mini
- AI ranks recipes based on:
  - Energy level → complexity/effort mapping (low energy = simpler recipes)
  - Mood → flavor profile matching
  - Seasonality → prefer seasonal ingredients
  - Cookware preference (soft: prefer one-pot if low energy)
- Return top 2-4 recipes with reasoning

**Data Flow**:

```
ConversationService (state: suggesting)
  → RecipeRanker.getRankedSuggestions(sessionId)
    → SessionManager.getSession() → UserContext
    → DietaryProfileDAL.getDietaryProfile() → hardRestrictions
    → RecipeDAL.getRecipes(filter) → candidates
    → OpenAI.rankRecipes(candidates, context) → ranked suggestions
    → Return RecipeSuggestion[]
  → Update session.suggestedRecipes (track for Phase 4)
  → Return to renderer with suggestions
```

**Structured Output Schema**:

```typescript
RecipeSuggestionSchema = z.object({
  suggestions: z
    .array(
      z.object({
        recipeId: z.string(),
        relevanceScore: z.number().min(0).max(100),
        reasoning: z.string().min(20).max(500),
        matchedFactors: z.array(z.string()),
      })
    )
    .min(2)
    .max(4),
});
```

---

## Implementation Instructions (For Implementor)

### PLAN-001: Create Recipe Ranking Zod Schema

**Change Type**: create

**File**: `src/main/conversation/ranking-schema.ts`

**Instruction**:

1. Create a new file `src/main/conversation/ranking-schema.ts`
2. Import `z` from 'zod'
3. Define `RecipeSuggestionSchema` as a Zod object schema with:
   - `suggestions`: array of objects (min 2, max 4) with:
     - `recipeId`: string (UUID)
     - `relevanceScore`: number (0-100)
     - `reasoning`: string (20-500 characters)
     - `matchedFactors`: array of strings (e.g., ["quick", "low-energy", "seasonal"])
4. Export the schema and its inferred type `RecipeSuggestionOutput`

**Pseudocode**:

```typescript
import { z } from 'zod';

export const RecipeSuggestionSchema = z.object({
  suggestions: z
    .array(
      z.object({
        recipeId: z.string().uuid(),
        relevanceScore: z.number().min(0).max(100),
        reasoning: z.string().min(20).max(500),
        matchedFactors: z.array(z.string()),
      })
    )
    .min(2)
    .max(4),
});

export type RecipeSuggestionOutput = z.infer<typeof RecipeSuggestionSchema>;
```

**Evidence**: Pattern from `src/main/ai/recipe-schema.ts:21-36` (existing Zod schema structure)

**Done When**:

- File compiles without errors (`npm run typecheck`)
- Schema validates sample data in test

---

### PLAN-002: Add Ranking System Prompt

**Change Type**: modify

**File**: `src/main/conversation/prompts.ts`

**Instruction**:

1. Open `src/main/conversation/prompts.ts`
2. After the existing `GATHERING_SYSTEM_PROMPT`, add a new constant `RANKING_SYSTEM_PROMPT`
3. The prompt should instruct the AI to:
   - Act as a recipe recommendation expert
   - Rank recipes based on: energy level, time, mood, dietary constraints (NEVER violate), seasonality
   - Consider energy level → complexity mapping (low = simple, high = can be complex)
   - Provide reasoning for each suggestion (why it matches user's context)
   - Identify matched factors (quick, low-energy, comforting, seasonal, etc.)
4. Include a few-shot example showing low-energy user getting simple recipes
5. Emphasize: **NEVER suggest recipes violating dietary restrictions** (already filtered by database, but reinforce)

**Pseudocode**:

```typescript
export const RANKING_SYSTEM_PROMPT = `You are a recipe recommendation expert. Rank recipes based on the user's current context and constraints.

# Ranking Factors (in order of importance)
1. **Dietary Constraints**: NEVER violate these (recipes are pre-filtered, but double-check)
2. **Energy Level**: 
   - Low → Simple recipes with minimal active work (e.g., sheet pan, one-pot)
   - Medium → Moderate complexity okay (e.g., some chopping, multitasking)
   - High → Can handle complex techniques (e.g., searing + sauce)
3. **Available Time**: Match to cooking_time_minutes (already filtered, but prioritize shorter if near limit)
4. **Mood**: Match flavor profiles to mood descriptors (comforting = hearty, light = fresh)
5. **Seasonality**: Prefer recipes with in-season ingredients
6. **Shopping**: If canShop=false, prioritize pantry-friendly recipes

# Output Format
Return JSON matching RecipeSuggestionSchema with 2-4 ranked suggestions.

# Example
User Context: { energyLevel: "low", availableTime: 30, mood: "comforting", canShop: false }
Ranked Suggestions:
1. One-Pot Creamy Pasta (relevanceScore: 95)
   Reasoning: "Minimal effort with only one pot to clean. Comforting creamy sauce ready in 25 minutes using pantry staples."
   Matched Factors: ["low-energy", "quick", "comforting", "pantry-friendly"]
2. Sheet Pan Chicken & Veggies (relevanceScore: 88)
   Reasoning: "Hands-off cooking—just prep and bake. Hearty and satisfying."
   Matched Factors: ["low-energy", "comforting", "simple-prep"]
...`;
```

**Evidence**: Pattern from `src/main/conversation/prompts.ts:15-60` (existing GATHERING_SYSTEM_PROMPT)

**Done When**:

- Prompt reads naturally and covers all ranking factors
- File compiles without errors

---

### PLAN-003: Add Ranking User Prompt Builder

**Change Type**: modify

**File**: `src/main/conversation/prompts.ts`

**Instruction**:

1. In the same file, add a new function `buildRankingPrompt`
2. Function signature: `buildRankingPrompt(userContext: UserContext, candidates: Recipe[], dietaryProfile: DietaryProfile, alreadySuggested: string[]): string`
3. Build a prompt that includes:
   - User context (energy, time, mood, canShop)
   - Dietary restrictions (from profile)
   - Candidate recipes (title, cooking time, cookware, ingredients summary)
   - Already suggested recipe IDs in this session (to deprioritize if they appear again)
4. Format candidate recipes as JSON for clarity
5. Keep total prompt under 8,000 tokens (limit candidates to ~20 recipes max)

**Pseudocode**:

```typescript
export function buildRankingPrompt(
  userContext: UserContext,
  candidates: Recipe[],
  dietaryProfile: DietaryProfile,
  alreadySuggested: string[]
): string {
  let prompt = `# User Context\n`;
  prompt += `- Energy Level: ${userContext.energyLevel || 'Not specified'}\n`;
  prompt += `- Available Time: ${userContext.availableTime || 'Not specified'} minutes\n`;
  prompt += `- Mood: ${userContext.mood || 'Not specified'}\n`;
  prompt += `- Can Shop: ${userContext.canShop !== undefined ? (userContext.canShop ? 'Yes' : 'No') : 'Not specified'}\n\n`;

  prompt += `# Dietary Restrictions (NEVER VIOLATE)\n`;
  prompt += dietaryProfile.hardRestrictions.join(', ') || 'None';
  prompt += `\n\n`;

  if (alreadySuggested.length > 0) {
    prompt += `# Already Suggested (deprioritize if present)\n`;
    prompt += alreadySuggested.join(', ') + '\n\n';
  }

  prompt += `# Candidate Recipes\n`;
  prompt += JSON.stringify(
    candidates.map(r => ({
      id: r.id,
      title: r.title,
      cookingTime: r.cookingTimeMinutes,
      cookware: r.cookwareType,
      ingredientCount: r.ingredients.length,
      keyIngredients: r.ingredients.slice(0, 5).map(i => i.name),
      seasonality: r.seasonality,
    })),
    null,
    2
  );

  prompt += `\n\nRank the top 2-4 recipes and explain why each matches the user's context.`;
  return prompt;
}
```

**Evidence**: Pattern from `src/main/conversation/prompts.ts:71-87` (existing buildConversationPrompt)

**Done When**:

- Function compiles and exports correctly
- Prompt structure is clear and includes all necessary context

---

### PLAN-004: Create Recipe Ranker Service

**Change Type**: create

**File**: `src/main/conversation/recipe-ranker.ts`

**Instruction**:

1. Create `src/main/conversation/recipe-ranker.ts`
2. Import dependencies:
   - OpenAI client (follow lazy initialization pattern from conversation-service.ts)
   - `getRecipes` from database/dal/recipes.ts
   - `getDietaryProfile` from database/dal/dietary-profile.ts
   - `getSession` from session-manager.ts
   - `RANKING_SYSTEM_PROMPT`, `buildRankingPrompt` from prompts.ts
   - `RecipeSuggestionSchema` from ranking-schema.ts
3. Implement `getRankedSuggestions(sessionId: string): Promise<RecipeSuggestionOutput>`
4. Logic:
   - Fetch session → extract userContext, suggestedRecipes
   - Fetch dietary profile → extract hardRestrictions
   - Build RecipeFilter:
     - `dietaryTags`: hardRestrictions (ALL must be present)
     - `cookingTimeMax`: userContext.availableTime (if specified)
     - `cookwareTypes`: undefined (let AI rank all cookware types, unless we want to filter)
   - Query recipes with filter
   - If <2 recipes found, throw error (will be caught in Phase 6 for escalation)
   - Limit candidates to 20 recipes max (to avoid token limits)
   - Call OpenAI with RANKING_SYSTEM_PROMPT + buildRankingPrompt(context, candidates, profile, session.suggestedRecipes)
   - Parse structured output (RecipeSuggestionSchema)
   - Return RecipeSuggestionOutput
5. Add error handling:
   - If OpenAI fails, throw error (let conversation-service handle fallback in Phase 6)
   - If no candidates, throw descriptive error ("No recipes match your constraints")

**Pseudocode**:

```typescript
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { getRecipes } from '../database/dal/recipes.js';
import { getDietaryProfile } from '../database/dal/dietary-profile.js';
import { getSession } from './session-manager.js';
import { RANKING_SYSTEM_PROMPT, buildRankingPrompt } from './prompts.js';
import { RecipeSuggestionSchema } from './ranking-schema.js';
import type { RecipeSuggestionOutput } from './ranking-schema.js';

let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured.');
    }
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 30000,
      maxRetries: 2,
    });
  }
  return openai;
}

export async function getRankedSuggestions(sessionId: string): Promise<RecipeSuggestionOutput> {
  // Step 1: Fetch session
  const session = getSession(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);

  // Step 2: Fetch dietary profile
  const profile = await getDietaryProfile();

  // Step 3: Build recipe filter
  const filter = {
    dietaryTags: profile.hardRestrictions,
    cookingTimeMax: session.userContext.availableTime,
  };

  // Step 4: Query recipes
  let candidates = await getRecipes(filter);

  // Exclude already suggested recipes (exact match)
  candidates = candidates.filter(r => !session.suggestedRecipes.includes(r.id));

  // Check if we have enough candidates
  if (candidates.length < 2) {
    throw new Error(
      `Only ${candidates.length} recipe(s) match your constraints. Try relaxing time or dietary restrictions.`
    );
  }

  // Limit to 20 recipes to avoid token overflow
  candidates = candidates.slice(0, 20);

  // Step 5: Call OpenAI
  const client = getOpenAIClient();
  const userPrompt = buildRankingPrompt(
    session.userContext,
    candidates,
    profile,
    session.suggestedRecipes
  );

  const completion = await client.chat.completions.parse({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: RANKING_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    response_format: zodResponseFormat(RecipeSuggestionSchema, 'recipe_suggestions'),
    temperature: 0.7,
    max_tokens: 1000,
  });

  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) throw new Error('No response from AI');

  return parsed;
}
```

**Evidence**: Pattern from `src/main/conversation/conversation-service.ts:19-95` (OpenAI client initialization and structured output usage)

**Done When**:

- File compiles without errors
- Function signature matches expected interface
- Error handling covers all edge cases

---

### PLAN-005: Extend Conversation Service for Suggestion State

**Change Type**: modify

**File**: `src/main/conversation/conversation-service.ts`

**Instruction**:

1. Open `src/main/conversation/conversation-service.ts`
2. Import `getRankedSuggestions` from `./recipe-ranker.js`
3. Import `updateSessionState`, `updateSessionSuggestedRecipes` from `./session-manager.js` (may need to add these functions to session-manager in prerequisite)
4. Add a new exported function `transitionToSuggesting(sessionId: string): Promise<SuggestionResult>`
5. Logic:
   - Get session, verify state is 'gathering' (throw error if not)
   - Verify that `userContext.energyLevel` AND `userContext.availableTime` are defined (required for suggestions)
   - Update session state to 'suggesting'
   - Call `getRankedSuggestions(sessionId)`
   - For each suggestion, add recipeId to `session.suggestedRecipes`
   - Return result with suggestions and AI message ("Here are some recipes I think you'll love...")
6. Add error handling (if getRankedSuggestions throws, catch and return error state)

**Interface**:

```typescript
export interface SuggestionResult {
  success: boolean;
  suggestions?: RecipeSuggestionOutput;
  aiMessage?: string;
  error?: string;
}
```

**Pseudocode**:

```typescript
import { getRankedSuggestions } from './recipe-ranker.js';

export interface SuggestionResult {
  success: boolean;
  suggestions?: RecipeSuggestionOutput;
  aiMessage?: string;
  error?: string;
}

export async function transitionToSuggesting(sessionId: string): Promise<SuggestionResult> {
  try {
    const session = getSession(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    // Verify prerequisites
    if (!session.userContext.energyLevel || !session.userContext.availableTime) {
      throw new Error('Missing required context (energyLevel and availableTime)');
    }

    // Update state
    updateSessionState(sessionId, 'suggesting');

    // Get ranked suggestions
    const result = await getRankedSuggestions(sessionId);

    // Track suggested recipes
    const recipeIds = result.suggestions.map(s => s.recipeId);
    updateSessionSuggestedRecipes(sessionId, recipeIds);

    // Build AI message
    const aiMessage = `Great! Based on your context, here are some recipes I think you'll love:`;

    return {
      success: true,
      suggestions: result,
      aiMessage,
    };
  } catch (error) {
    console.error('Error in transitionToSuggesting:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
```

**Evidence**: Pattern from existing `processConversationTurn` function (lines 43-107)

**Done When**:

- Function compiles and exports correctly
- State transition logic is sound
- Error handling covers edge cases

---

### PLAN-006: Extend Session Manager with State Update Functions

**Change Type**: modify

**File**: `src/main/conversation/session-manager.ts`

**Instruction**:

1. Open `src/main/conversation/session-manager.ts`
2. Add new exported function `updateSessionState(sessionId: string, state: ConversationState): void`
3. Add new exported function `updateSessionSuggestedRecipes(sessionId: string, recipeIds: string[]): void`
4. Add new exported function `updateSessionContext(sessionId: string, context: Partial<UserContext>): void` (may already exist from Phase 2, verify)
5. Logic:
   - For `updateSessionState`: Find session in sessions Map, update `session.state`, update `session.lastActivity`
   - For `updateSessionSuggestedRecipes`: Find session, append new recipeIds to `session.suggestedRecipes` array (deduplicate)
   - For `updateSessionContext`: Merge partial context into `session.userContext`
6. Add error handling (throw if session not found)

**Pseudocode**:

```typescript
export function updateSessionState(sessionId: string, state: ConversationState): void {
  const session = sessions.get(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);

  session.state = state;
  session.lastActivity = new Date();
}

export function updateSessionSuggestedRecipes(sessionId: string, recipeIds: string[]): void {
  const session = sessions.get(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);

  // Append and deduplicate
  const combined = [...session.suggestedRecipes, ...recipeIds];
  session.suggestedRecipes = Array.from(new Set(combined));
  session.lastActivity = new Date();
}

export function updateSessionContext(sessionId: string, context: Partial<UserContext>): void {
  const session = sessions.get(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);

  session.userContext = { ...session.userContext, ...context };
  session.lastActivity = new Date();
}
```

**Evidence**: Existing session-manager.ts patterns (need to read file to verify exact structure)

**Done When**:

- Functions compile and export correctly
- Session updates work as expected in tests

---

### PLAN-007: Create RecipeSuggestionCard Component

**Change Type**: create

**File**: `src/renderer/components/Conversation/RecipeSuggestionCard.tsx`

**Instruction**:

1. Create `src/renderer/components/Conversation/RecipeSuggestionCard.tsx`
2. Import React
3. Import `Recipe` type from `@shared/types/recipe`
4. Define props interface:
   ```typescript
   interface RecipeSuggestionCardProps {
     recipe: Recipe;
     reasoning: string;
     matchedFactors: string[];
     onSelect: () => void;
     onReject: () => void;
   }
   ```
5. Component should display:
   - Recipe title (h3)
   - Cooking time with clock icon
   - Cookware type with icon (pot/pan/oven)
   - Brief ingredient summary (first 4-5 ingredients)
   - AI reasoning text (styled differently, perhaps italic or in a callout)
   - Matched factors as pills/tags
   - Two buttons: "Select this recipe" (primary) and "Not this one" (secondary)
6. Style with Tailwind CSS classes (consistent with existing app theme)
7. Make accessible: ARIA labels, keyboard navigation

**Pseudocode**:

```typescript
import type { Recipe } from '../../../shared/types/recipe';

interface RecipeSuggestionCardProps {
  recipe: Recipe;
  reasoning: string;
  matchedFactors: string[];
  onSelect: () => void;
  onReject: () => void;
}

export function RecipeSuggestionCard({
  recipe,
  reasoning,
  matchedFactors,
  onSelect,
  onReject,
}: RecipeSuggestionCardProps) {
  const ingredientSummary = recipe.ingredients
    .slice(0, 5)
    .map(i => i.name)
    .join(', ');

  return (
    <div className="recipe-suggestion-card border rounded-lg p-4 mb-3 bg-white shadow-sm">
      <h3 className="text-lg font-semibold mb-2">{recipe.title}</h3>

      <div className="flex gap-4 mb-2 text-sm text-gray-600">
        <span>🕐 {recipe.totalTimeMinutes} min</span>
        <span>🍳 {recipe.cookwareType}</span>
      </div>

      <p className="text-sm text-gray-700 mb-2">
        <strong>Key ingredients:</strong> {ingredientSummary}
      </p>

      <div className="bg-blue-50 border-l-4 border-blue-400 p-3 mb-3">
        <p className="text-sm italic text-gray-800">{reasoning}</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {matchedFactors.map(factor => (
          <span
            key={factor}
            className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full"
          >
            {factor}
          </span>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={onSelect}
          className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          aria-label={`Select ${recipe.title}`}
        >
          Select this recipe
        </button>
        <button
          onClick={onReject}
          className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
          aria-label={`Reject ${recipe.title}`}
        >
          Not this one
        </button>
      </div>
    </div>
  );
}
```

**Evidence**: Existing component patterns in `src/renderer/components/` (check existing card components for styling consistency)

**Done When**:

- Component renders correctly
- Buttons trigger callbacks
- Styling matches app theme
- Passes accessibility audit (ARIA labels present)

---

### PLAN-008: Update ConversationPage to Handle Suggestions

**Change Type**: modify

**File**: `src/renderer/pages/ConversationPage.tsx`

**Instruction**:

1. Open `src/renderer/pages/ConversationPage.tsx` (created in Phase 1)
2. Import `RecipeSuggestionCard` from components/Conversation
3. Import `getRecipeById` IPC handler (need to verify this exists, or use a different mechanism)
4. Extend conversation state/reducer to handle suggestion messages
5. When rendering messages, check if message contains `suggestions` field
6. If suggestions present:
   - Render AI message text
   - For each suggestion, fetch full recipe data (by recipeId)
   - Render RecipeSuggestionCard for each recipe
   - Wire up `onSelect` and `onReject` handlers (for Phase 4, these can be stubs for now)
7. Handle loading state while fetching recipe details

**Pseudocode**:

```typescript
import { RecipeSuggestionCard } from '../components/Conversation/RecipeSuggestionCard';

// Inside ConversationPage component
const handleSelectRecipe = (recipeId: string) => {
  // Phase 5 implementation - for now, just log
  console.log('Selected recipe:', recipeId);
};

const handleRejectRecipe = (recipeId: string) => {
  // Phase 4 implementation - for now, just log
  console.log('Rejected recipe:', recipeId);
};

// In message rendering logic
{messages.map((msg, idx) => {
  if (msg.suggestions) {
    return (
      <div key={idx} className="assistant-message">
        <p>{msg.content}</p>
        <div className="suggestions-container mt-4">
          {msg.suggestions.map(suggestion => {
            const recipe = fetchedRecipes[suggestion.recipeId]; // assume fetched earlier
            if (!recipe) return <div>Loading...</div>;

            return (
              <RecipeSuggestionCard
                key={suggestion.recipeId}
                recipe={recipe}
                reasoning={suggestion.reasoning}
                matchedFactors={suggestion.matchedFactors}
                onSelect={() => handleSelectRecipe(suggestion.recipeId)}
                onReject={() => handleRejectRecipe(suggestion.recipeId)}
              />
            );
          })}
        </div>
      </div>
    );
  }

  // Regular message rendering
  return <MessageComponent key={idx} message={msg} />;
})}
```

**Evidence**: Existing ConversationPage structure from Phase 1 (need to read file to verify)

**Done When**:

- Suggestions render in conversation flow
- RecipeSuggestionCard components display correctly
- Button handlers connect (even if stubbed)

---

### PLAN-009: Add IPC Handler for Fetching Suggestions

**Change Type**: modify

**File**: `src/main/ipc/conversation-handlers.ts`

**Instruction**:

1. Open `src/main/ipc/conversation-handlers.ts` (created in Phase 1)
2. Import `transitionToSuggesting` from `../conversation/conversation-service.js`
3. Add new IPC handler: `conversation:get-suggestions`
4. Handler logic:
   - Validate sender (existing security pattern)
   - Call `transitionToSuggesting(sessionId)`
   - Return result (success/error)
5. Follow existing IPC handler pattern with structured result types

**Pseudocode**:

```typescript
import { transitionToSuggesting } from '../conversation/conversation-service.js';

ipcMain.handle('conversation:get-suggestions', async (event, sessionId: string) => {
  // Security check
  if (!event.senderFrame || !validateSender(event.senderFrame)) {
    return {
      success: false,
      error: 'Unauthorized IPC sender',
    };
  }

  try {
    const result = await transitionToSuggesting(sessionId);
    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});
```

**Evidence**: Pattern from `src/main/ipc/recipe-ai-handlers.ts:26-67` (existing IPC handler structure)

**Done When**:

- IPC handler registered correctly
- Security validation in place
- Returns structured result type

---

### PLAN-010: Update Shared Types for Suggestion IPC

**Change Type**: modify

**File**: `src/shared/types/conversation.ts`

**Instruction**:

1. Open `src/shared/types/conversation.ts`
2. Add new interface `RecipeSuggestion`:
   ```typescript
   export interface RecipeSuggestion {
     recipeId: string;
     relevanceScore: number;
     reasoning: string;
     matchedFactors: string[];
   }
   ```
3. Extend `ConversationMessage` interface to optionally include `suggestions`:
   ```typescript
   export interface ConversationMessage {
     role: 'user' | 'assistant';
     content: string;
     timestamp: Date;
     suggestedRecipes?: string[]; // Recipe IDs (for assistant messages)
     suggestions?: RecipeSuggestion[]; // Full suggestion data (Phase 3+)
   }
   ```
4. Ensure backwards compatibility with Phase 1/2 messages (suggestions is optional)

**Evidence**: Existing type definitions at `src/shared/types/conversation.ts:61-67`

**Done When**:

- Types compile without errors
- Backwards compatible with existing code

---

### PLAN-011: Write Unit Tests for Recipe Ranker

**Change Type**: create

**File**: `src/main/conversation/recipe-ranker.test.ts`

**Instruction**:

1. Create `src/main/conversation/recipe-ranker.test.ts`
2. Import necessary test utilities (vitest)
3. Mock dependencies:
   - Mock `getSession` from session-manager
   - Mock `getDietaryProfile` from dietary-profile DAL
   - Mock `getRecipes` from recipes DAL
   - Mock OpenAI client (use existing mock pattern from recipe-generator.test.ts)
4. Write tests:
   - **Test 1**: Successfully ranks recipes with valid context
   - **Test 2**: Throws error when <2 recipes available
   - **Test 3**: Filters out already-suggested recipes
   - **Test 4**: Enforces dietary constraints in filter
   - **Test 5**: Limits candidates to 20 recipes
   - **Test 6**: Handles OpenAI errors gracefully
5. Use sample data from seed-data.ts

**Pseudocode**:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getRankedSuggestions } from './recipe-ranker';

vi.mock('./session-manager', () => ({
  getSession: vi.fn(),
}));

vi.mock('../database/dal/dietary-profile', () => ({
  getDietaryProfile: vi.fn(),
}));

vi.mock('../database/dal/recipes', () => ({
  getRecipes: vi.fn(),
}));

describe('getRankedSuggestions', () => {
  it('should return 2-4 ranked suggestions with reasoning', async () => {
    // Mock session with context
    // Mock dietary profile
    // Mock recipes query returning 10 candidates
    // Mock OpenAI response
    const result = await getRankedSuggestions('session-123');
    expect(result.suggestions).toHaveLength(3);
    expect(result.suggestions[0].reasoning).toBeDefined();
  });

  it('should throw error when <2 recipes match', async () => {
    // Mock only 1 recipe returned
    await expect(getRankedSuggestions('session-123')).rejects.toThrow('Only 1 recipe(s) match');
  });

  // ... more tests
});
```

**Evidence**: Pattern from `src/main/ai/recipe-generator.test.ts` (existing test structure)

**Done When**:

- All tests pass (`npm test`)
- Code coverage >80% for recipe-ranker.ts

---

### PLAN-012: Write Integration Tests for Suggestion Flow

**Change Type**: modify

**File**: `src/main/conversation/conversation-service.test.ts`

**Instruction**:

1. Open `src/main/conversation/conversation-service.test.ts` (created in Phase 2)
2. Add new test suite: `describe('transitionToSuggesting', () => { ... })`
3. Write integration tests:
   - **Test 1**: Successful transition from gathering to suggesting with valid context
   - **Test 2**: Error when context incomplete (missing energyLevel or availableTime)
   - **Test 3**: Session state updates to 'suggesting'
   - **Test 4**: Suggested recipe IDs tracked in session
   - **Test 5**: Returns AI message + suggestions
4. Use real database (with migrations) and mock only OpenAI
5. Verify session state changes persist

**Pseudocode**:

```typescript
describe('transitionToSuggesting', () => {
  it('should transition to suggesting state and return ranked recipes', async () => {
    // Setup: Create session in gathering state with complete context
    const sessionId = createSession();
    updateSessionContext(sessionId, { energyLevel: 'low', availableTime: 30 });

    // Mock OpenAI to return 3 suggestions
    const result = await transitionToSuggesting(sessionId);

    expect(result.success).toBe(true);
    expect(result.suggestions?.suggestions).toHaveLength(3);

    const session = getSession(sessionId);
    expect(session?.state).toBe('suggesting');
    expect(session?.suggestedRecipes).toHaveLength(3);
  });

  // ... more tests
});
```

**Evidence**: Existing test patterns in conversation-service.test.ts

**Done When**:

- All integration tests pass
- State transitions verified

---

### PLAN-013: Write Component Tests for RecipeSuggestionCard

**Change Type**: create

**File**: `src/renderer/components/Conversation/RecipeSuggestionCard.test.tsx`

**Instruction**:

1. Create test file for RecipeSuggestionCard component
2. Use React Testing Library
3. Write tests:
   - **Test 1**: Renders recipe title, time, cookware, ingredients
   - **Test 2**: Renders reasoning text
   - **Test 3**: Renders matched factors as pills
   - **Test 4**: Calls onSelect when "Select" button clicked
   - **Test 5**: Calls onReject when "Not this one" button clicked
   - **Test 6**: Accessibility - has proper ARIA labels
4. Use mock recipe data from shared test fixtures

**Pseudocode**:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RecipeSuggestionCard } from './RecipeSuggestionCard';

describe('RecipeSuggestionCard', () => {
  const mockRecipe = {
    id: 'recipe-1',
    title: 'One-Pot Pasta',
    totalTimeMinutes: 30,
    cookwareType: 'one-pot',
    ingredients: [
      { name: 'pasta' },
      { name: 'tomatoes' },
      { name: 'garlic' },
    ],
    // ... other fields
  };

  it('should render recipe details correctly', () => {
    render(
      <RecipeSuggestionCard
        recipe={mockRecipe}
        reasoning="Quick and easy"
        matchedFactors={['quick', 'low-energy']}
        onSelect={vi.fn()}
        onReject={vi.fn()}
      />
    );

    expect(screen.getByText('One-Pot Pasta')).toBeInTheDocument();
    expect(screen.getByText(/30 min/)).toBeInTheDocument();
    expect(screen.getByText(/one-pot/)).toBeInTheDocument();
  });

  it('should call onSelect when button clicked', () => {
    const onSelect = vi.fn();
    render(
      <RecipeSuggestionCard
        recipe={mockRecipe}
        reasoning="Test"
        matchedFactors={[]}
        onSelect={onSelect}
        onReject={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Select this recipe'));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  // ... more tests
});
```

**Evidence**: Existing component test patterns in src/renderer (check for .test.tsx files)

**Done When**:

- All component tests pass
- Coverage >80% for component

---

## Verification Tasks

**No assumptions requiring verification.** All dependencies verified from existing code.

---

## Acceptance Criteria

Phase 3 is complete when ALL of the following are true:

### Functional Criteria

- [ ] After gathering context, system queries recipes from database
- [ ] Recipes filtered by time constraint (≤ availableTime)
- [ ] Recipes filtered by dietary constraints (ALL hardRestrictions tags present)
- [ ] AI ranks top 2-4 recipes based on user context
- [ ] Recipe cards displayed in conversation with:
  - [ ] Recipe title
  - [ ] Cooking time
  - [ ] Cookware type
  - [ ] Key ingredients (first 4-5)
  - [ ] AI reasoning (why it matches)
  - [ ] Matched factors (tags)
  - [ ] "Select" and "Reject" buttons
- [ ] Suggestions feel relevant (low energy → simpler recipes)
- [ ] No recipes violate dietary constraints (100% enforcement)

### Technical Criteria

- [ ] Recipe filtering completes in <1 second
- [ ] AI ranking completes in <5 seconds
- [ ] Session state transitions to 'suggesting'
- [ ] Suggested recipe IDs tracked in `session.suggestedRecipes`
- [ ] Structured output schema validates correctly

### Testing Criteria

- [ ] Unit tests pass for recipe-ranker.ts (>80% coverage)
- [ ] Integration tests pass for transitionToSuggesting flow
- [ ] Component tests pass for RecipeSuggestionCard
- [ ] All tests run successfully: `npm test`
- [ ] Type checking passes: `npm run typecheck`
- [ ] Linting passes: `npm run lint`

### Quality Criteria

- [ ] Code follows existing patterns (OpenAI client, IPC handlers, Zod schemas)
- [ ] Error handling consistent with Phase 2
- [ ] Accessibility: ARIA labels on buttons and cards
- [ ] UI styling consistent with app theme

---

## Implementor Checklist

Copy this checklist to the STATE file and update after each task:

- [ ] PLAN-001: Create ranking-schema.ts with Zod schema
- [ ] PLAN-002: Add RANKING_SYSTEM_PROMPT to prompts.ts
- [ ] PLAN-003: Add buildRankingPrompt function to prompts.ts
- [ ] PLAN-004: Create recipe-ranker.ts service
- [ ] PLAN-005: Extend conversation-service.ts with transitionToSuggesting
- [ ] PLAN-006: Extend session-manager.ts with state update functions
- [ ] PLAN-007: Create RecipeSuggestionCard component
- [ ] PLAN-008: Update ConversationPage to handle suggestions
- [ ] PLAN-009: Add IPC handler for fetching suggestions
- [ ] PLAN-010: Update shared types for suggestions
- [ ] PLAN-011: Write unit tests for recipe-ranker
- [ ] PLAN-012: Write integration tests for suggestion flow
- [ ] PLAN-013: Write component tests for RecipeSuggestionCard
- [ ] Verify all acceptance criteria met
- [ ] Run full test suite and confirm passing
- [ ] Manual smoke test in app UI

---

## Dependencies

### Prerequisites (Must be Complete)

- **Phase 2: AI Integration & Contextual Questions**
  - `conversation-service.ts` exists with OpenAI integration
  - `session-manager.ts` exists with session lifecycle
  - `prompts.ts` exists with GATHERING_SYSTEM_PROMPT
  - `ConversationPage.tsx` exists and displays messages
  - User context capturing works (energyLevel, availableTime, mood, canShop)

### Provides (For Phase 4)

- `transitionToSuggesting()` function for suggestion generation
- `RecipeSuggestionCard` component with onSelect/onReject callbacks
- Session tracking of suggested recipes (`session.suggestedRecipes`)
- Recipe ranking infrastructure for refinement loop

---

## Next Steps

After Phase 3 is complete:

1. **Update Phase 3 STATE file** with all completed tasks
2. **Verify all acceptance criteria** manually in running app
3. **Proceed to Phase 4: Feedback & Iterative Refinement**
   - Implement onReject handler to capture feedback
   - Track rejected recipes with reasons
   - Refine suggestions based on patterns
   - Implement substitution suggestions

---

## Appendix: Key References

### Research Report References

- Finding 4: Database filtering capabilities (lines 108-116)
- Finding 5: IPC architecture (lines 118-141)
- Prompting strategies for ranking (lines 231-298)
- Iterative refinement pattern (lines 302-329)
- UI architecture with @chatscope (lines 341-416)

### Codebase References (Verified)

- Recipe DAL: `src/main/database/dal/recipes.ts:119-166`
- Dietary profile DAL: `src/main/database/dal/dietary-profile.ts:6-27`
- OpenAI client pattern: `src/main/ai/recipe-generator.ts:17-32`
- Structured output usage: `src/main/ai/recipe-generator.ts:126-135`
- Zod schema pattern: `src/main/ai/recipe-schema.ts:21-36`
- IPC handler pattern: `src/main/ipc/recipe-ai-handlers.ts:26-67`
- Conversation service: `src/main/conversation/conversation-service.ts:43-95`
- UserContext type: `src/shared/types/conversation.ts:41-46`

---

**End of Phase 3 Implementation Plan**

**Status**: Ready for implementation

**Next Document**: `2026-01-06-Conversational-Decision-Support-Phase3-STATE.md`
