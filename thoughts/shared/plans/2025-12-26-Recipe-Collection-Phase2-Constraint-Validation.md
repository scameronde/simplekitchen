# Phase 2: Core Constraint Validation System

## Inputs

- **Master Plan**: `thoughts/shared/plans/2025-12-25-Recipe-Collection-Management-MASTER.md`
- **Research Report**: `thoughts/shared/research/2025-12-25-Recipe-Collection-Management.md`
- **Epic**: `thoughts/shared/epics/2025-12-25-Recipe-Collection-Management.md`
- **Spec**: `thoughts/shared/specs/2025-12-25-SimpleKitchen.md`
- **Phase 0 Decisions**: `thoughts/shared/plans/2025-12-25-Recipe-Collection-Phase0-DECISIONS.md`
- **Phase 1 Complete**: `thoughts/shared/plans/2025-12-26-Recipe-Collection-Phase1-Data-Persistence-STATE.md`

## Verified Current State

**Fact:** Phase 1 is complete with database persistence layer implemented.  
**Evidence:** `thoughts/shared/plans/2025-12-26-Recipe-Collection-Phase1-Data-Persistence-STATE.md:1-58`  
**Excerpt:** "Current Task: COMPLETE; Completed Tasks: PLAN-101 through PLAN-115 (15/15 ✅)"

**Fact:** Database schema includes CHECK constraints for servings=2 and cooking_time 30-45.  
**Evidence:** `src/main/database/migrations.ts:42-46`  
**Excerpt:** 
```sql
cooking_time_minutes INTEGER NOT NULL CHECK(cooking_time_minutes >= 30 AND cooking_time_minutes <= 45),
servings INTEGER NOT NULL CHECK(servings = 2),
```

**Fact:** Dietary profile table has default hard restrictions gluten-free and lactose-free.  
**Evidence:** `src/main/database/migrations.ts:70-77, 85-87`  
**Excerpt:** 
```sql
hard_restrictions TEXT NOT NULL DEFAULT '["gluten-free", "lactose-free"]',
INSERT INTO dietary_profile (id, hard_restrictions, updated_at) VALUES (1, '["gluten-free", "lactose-free"]', datetime('now'));
```

**Fact:** 100% automated dietary validation is impossible; multi-layer strategy required.  
**Evidence:** `thoughts/shared/research/2025-12-25-Recipe-Collection-Management.md:99-109`  
**Excerpt:** "No automated solution (commercial API, database, or AI) achieves zero false negatives for dietary constraint validation. Multi-layer approach required: static ingredient database + API validation + conservative defaults + user review"

**Fact:** Hybrid ingredient database approach was chosen (static + API + user review).  
**Evidence:** `thoughts/shared/plans/2025-12-25-Recipe-Collection-Management-MASTER.md:190-207`  
**Excerpt:** "Decision 1: Option D (Hybrid). Static table covers 80% of common ingredients, Spoonacular API fallback, user override capability, mandatory user review"

**Fact:** Non-compliant recipes should be rejected, not auto-adapted.  
**Evidence:** `thoughts/shared/plans/2025-12-25-Recipe-Collection-Management-MASTER.md:209-225`  
**Excerpt:** "Decision 2: Option A for MVP. Validation should catch and reject. Display clear error message"

**Fact:** Cookware type is single enum (mutually exclusive).  
**Evidence:** `thoughts/shared/plans/2025-12-25-Recipe-Collection-Management-MASTER.md:291-304`  
**Excerpt:** "Decision 6: Single Enum (one-pot OR one-pan OR oven, mutually exclusive)"

**Fact:** Recipe DAL includes dietary_properties field for ingredients (JSON array).  
**Evidence:** `src/main/database/dal/recipes.ts:593-597`  
**Excerpt:**
```typescript
dietary_properties: JSON.stringify(ing.dietaryProperties),
```

## Goals / Non-Goals

### Goals
- Implement multi-layer dietary constraint validation system
- Create curated static ingredient database (~100 common ingredients)
- Build validation logic that prevents constraint violations before storage
- Provide clear, actionable error messages for validation failures
- Ensure 100% coverage for all constraint validation logic (zero false negatives)
- Enable validation for all constraint types (dietary, time, cookware, servings)
- Prepare foundation for optional Spoonacular API integration (Phase 5+)

### Non-Goals
- UI components for validation errors (Phase 3)
- IPC handlers (Phase 3)
- Spoonacular API integration (deferred to Phase 5 as optional enhancement)
- Recipe generation (Phase 5)
- Web import (Phase 6)
- Advanced substitution suggestions (future enhancement)

## Design Overview

### Validation Architecture

```
Recipe Input (CreateRecipeInput or UpdateRecipeInput)
    ↓
validateRecipe() → Validation Orchestrator
    ↓
    ├── validateDietaryConstraints() → Check ingredients against profile
    │   ├── Static Ingredient Database lookup
    │   ├── dietary_properties from ingredient data
    │   └── Check against hard_restrictions + explicit_exclusions
    ↓
    ├── validateTimeConstraints() → Check cooking time 30-45 min
    ↓
    ├── validateCookwareConstraints() → Check single cookware type
    ↓
    └── validateServingsConstraints() → Check servings = 2
    ↓
ValidationResult { valid: boolean, errors: ValidationError[] }
    ↓
if valid → proceed to database storage
if invalid → return errors to caller
```

### Multi-Layer Dietary Validation Strategy

**Layer 1: Static Ingredient Database**
- Curated lookup table with common ingredients
- Each ingredient mapped to DietaryProperty[] (contains-gluten, contains-lactose, etc.)
- Covers ~80% of typical recipe ingredients
- 100% known accuracy for included items

**Layer 2: Ingredient dietary_properties Field**
- Recipe ingredients include self-declared dietary properties
- AI-generated or user-specified during recipe creation
- Validated against static database when available

**Layer 3: Dietary Profile Enforcement**
- Check ingredient properties against hard_restrictions
- Check ingredient names against explicit_exclusions
- Allow ingredients in explicit_inclusions even if they match restrictions

**Layer 4: User Review (Phase 3)**
- All validation errors displayed to user before storage
- User can choose to adapt recipe or reject it
- No recipe stored unless validation passes

### Validation Error Reporting

```typescript
interface ValidationError {
  field: string; // "ingredients[0]", "cookingTimeMinutes", "cookwareType", "servings"
  constraint: string; // "dietary-gluten-free", "time-range", "cookware-single", "servings-exact"
  message: string; // "Ingredient 'wheat flour' contains gluten, which violates gluten-free restriction"
  suggestedFix?: string; // "Replace with gluten-free flour" or "Remove this ingredient"
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}
```

## Implementation Instructions (For Implementor)

### PLAN-201: Create Validation Types

**Change Type**: create  
**File(s)**: `src/shared/types/validation.ts`

**Instruction**:
Create TypeScript types for validation results and errors:

```typescript
// Validation error detail
export interface ValidationError {
  field: string; // Path to field (e.g., "ingredients[0].name", "cookingTimeMinutes")
  constraint: string; // Constraint type identifier
  message: string; // Human-readable error message
  suggestedFix?: string; // Optional suggestion for user
}

// Validation result
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

// Constraint types (for categorization)
export type ConstraintType = 
  | 'dietary-gluten-free'
  | 'dietary-lactose-free'
  | 'dietary-explicit-exclusion'
  | 'time-minimum'
  | 'time-maximum'
  | 'cookware-single'
  | 'servings-exact';
```

**Evidence**: Validation needs structured error reporting for user feedback  
**Done When**: Validation types defined in shared types

---

### PLAN-202: Create Static Ingredient Database

**Change Type**: create  
**File(s)**: `src/main/validation/ingredient-database.ts`

**Instruction**:
Create curated static database with ~100 common ingredients and their dietary properties:

```typescript
import type { DietaryProperty } from '../../shared/types/database';

// Ingredient dietary property mapping
export interface IngredientData {
  name: string;
  dietaryProperties: DietaryProperty[];
  aliases?: string[]; // Alternative names (e.g., "courgette" for "zucchini")
}

// Static ingredient database (curated, 100% accurate for included items)
export const INGREDIENT_DATABASE: IngredientData[] = [
  // Gluten-containing grains
  { name: 'wheat flour', dietaryProperties: ['contains-gluten'] },
  { name: 'all-purpose flour', dietaryProperties: ['contains-gluten'] },
  { name: 'bread flour', dietaryProperties: ['contains-gluten'] },
  { name: 'whole wheat flour', dietaryProperties: ['contains-gluten'] },
  { name: 'barley', dietaryProperties: ['contains-gluten'] },
  { name: 'rye', dietaryProperties: ['contains-gluten'] },
  { name: 'spelt', dietaryProperties: ['contains-gluten'] },
  { name: 'wheat pasta', dietaryProperties: ['contains-gluten'] },
  { name: 'regular pasta', dietaryProperties: ['contains-gluten'] },
  { name: 'spaghetti', dietaryProperties: ['contains-gluten'] },
  { name: 'bread', dietaryProperties: ['contains-gluten'] },
  { name: 'breadcrumbs', dietaryProperties: ['contains-gluten'] },
  { name: 'panko', dietaryProperties: ['contains-gluten'] },
  { name: 'couscous', dietaryProperties: ['contains-gluten'] },
  { name: 'bulgur', dietaryProperties: ['contains-gluten'] },
  { name: 'semolina', dietaryProperties: ['contains-gluten'] },
  { name: 'soy sauce', dietaryProperties: ['contains-gluten'] }, // Most soy sauce contains wheat

  // Gluten-free grains and flours
  { name: 'rice', dietaryProperties: ['none'] },
  { name: 'brown rice', dietaryProperties: ['none'] },
  { name: 'white rice', dietaryProperties: ['none'] },
  { name: 'rice flour', dietaryProperties: ['none'] },
  { name: 'quinoa', dietaryProperties: ['none'] },
  { name: 'gluten-free pasta', dietaryProperties: ['none'] },
  { name: 'rice noodles', dietaryProperties: ['none'] },
  { name: 'cornmeal', dietaryProperties: ['none'] },
  { name: 'polenta', dietaryProperties: ['none'] },
  { name: 'oats', dietaryProperties: ['none'] }, // Certified GF oats assumed
  { name: 'corn flour', dietaryProperties: ['none'] },
  { name: 'tapioca flour', dietaryProperties: ['none'] },
  { name: 'almond flour', dietaryProperties: ['none'] },
  { name: 'coconut flour', dietaryProperties: ['none'] },
  { name: 'buckwheat', dietaryProperties: ['none'] }, // Despite name, gluten-free

  // Dairy (lactose-containing)
  { name: 'milk', dietaryProperties: ['contains-lactose'] },
  { name: 'whole milk', dietaryProperties: ['contains-lactose'] },
  { name: 'skim milk', dietaryProperties: ['contains-lactose'] },
  { name: '2% milk', dietaryProperties: ['contains-lactose'] },
  { name: 'butter', dietaryProperties: ['contains-lactose'] },
  { name: 'cream', dietaryProperties: ['contains-lactose'] },
  { name: 'heavy cream', dietaryProperties: ['contains-lactose'] },
  { name: 'sour cream', dietaryProperties: ['contains-lactose'] },
  { name: 'cream cheese', dietaryProperties: ['contains-lactose'] },
  { name: 'yogurt', dietaryProperties: ['contains-lactose'] },
  { name: 'greek yogurt', dietaryProperties: ['contains-lactose'] },
  { name: 'cottage cheese', dietaryProperties: ['contains-lactose'] },
  { name: 'ricotta', dietaryProperties: ['contains-lactose'] },
  { name: 'mozzarella', dietaryProperties: ['contains-lactose'] },
  { name: 'cheddar', dietaryProperties: ['contains-lactose'] }, // Fresh cheddar contains lactose
  { name: 'cheese', dietaryProperties: ['contains-lactose'] }, // Generic cheese assumed to contain lactose
  { name: 'ice cream', dietaryProperties: ['contains-lactose'] },

  // Aged cheese (very low lactose, often tolerated - user can add to explicit_inclusions if desired)
  { name: 'parmesan', dietaryProperties: ['contains-lactose'] }, // Conservative: still flag it
  { name: 'aged cheddar', dietaryProperties: ['contains-lactose'] }, // Conservative
  
  // Dairy alternatives (lactose-free)
  { name: 'almond milk', dietaryProperties: ['none'] },
  { name: 'oat milk', dietaryProperties: ['none'] },
  { name: 'coconut milk', dietaryProperties: ['none'] },
  { name: 'soy milk', dietaryProperties: ['none'] },
  { name: 'cashew milk', dietaryProperties: ['none'] },
  { name: 'coconut cream', dietaryProperties: ['none'] },
  { name: 'vegan butter', dietaryProperties: ['none'] },
  { name: 'margarine', dietaryProperties: ['none'] }, // Most margarine is dairy-free
  { name: 'olive oil', dietaryProperties: ['none'] },
  { name: 'coconut oil', dietaryProperties: ['none'] },
  { name: 'vegetable oil', dietaryProperties: ['none'] },
  { name: 'canola oil', dietaryProperties: ['none'] },
  { name: 'avocado oil', dietaryProperties: ['none'] },

  // Meats and fish (no gluten or lactose)
  { name: 'chicken', dietaryProperties: ['contains-meat'] },
  { name: 'chicken breast', dietaryProperties: ['contains-meat'] },
  { name: 'chicken thigh', dietaryProperties: ['contains-meat'] },
  { name: 'ground chicken', dietaryProperties: ['contains-meat'] },
  { name: 'beef', dietaryProperties: ['contains-meat'] },
  { name: 'ground beef', dietaryProperties: ['contains-meat'] },
  { name: 'steak', dietaryProperties: ['contains-meat'] },
  { name: 'pork', dietaryProperties: ['contains-meat'] },
  { name: 'pork chop', dietaryProperties: ['contains-meat'] },
  { name: 'bacon', dietaryProperties: ['contains-meat'] },
  { name: 'sausage', dietaryProperties: ['contains-meat'] },
  { name: 'turkey', dietaryProperties: ['contains-meat'] },
  { name: 'ground turkey', dietaryProperties: ['contains-meat'] },
  { name: 'salmon', dietaryProperties: ['contains-fish'] },
  { name: 'tuna', dietaryProperties: ['contains-fish'] },
  { name: 'cod', dietaryProperties: ['contains-fish'] },
  { name: 'shrimp', dietaryProperties: ['contains-fish'] },
  { name: 'fish', dietaryProperties: ['contains-fish'] },

  // Eggs
  { name: 'egg', dietaryProperties: ['contains-eggs'] },
  { name: 'eggs', dietaryProperties: ['contains-eggs'] },
  { name: 'egg whites', dietaryProperties: ['contains-eggs'] },
  { name: 'egg yolks', dietaryProperties: ['contains-eggs'] },

  // Vegetables (no restrictions)
  { name: 'tomato', dietaryProperties: ['none'] },
  { name: 'tomatoes', dietaryProperties: ['none'] },
  { name: 'onion', dietaryProperties: ['none'] },
  { name: 'onions', dietaryProperties: ['none'] },
  { name: 'garlic', dietaryProperties: ['none'] },
  { name: 'bell pepper', dietaryProperties: ['none'] },
  { name: 'red bell pepper', dietaryProperties: ['none'] },
  { name: 'green bell pepper', dietaryProperties: ['none'] },
  { name: 'broccoli', dietaryProperties: ['none'] },
  { name: 'carrot', dietaryProperties: ['none'] },
  { name: 'carrots', dietaryProperties: ['none'] },
  { name: 'zucchini', dietaryProperties: ['none'], aliases: ['courgette'] },
  { name: 'spinach', dietaryProperties: ['none'] },
  { name: 'kale', dietaryProperties: ['none'] },
  { name: 'lettuce', dietaryProperties: ['none'] },
  { name: 'cucumber', dietaryProperties: ['none'] },
  { name: 'mushroom', dietaryProperties: ['none'] },
  { name: 'mushrooms', dietaryProperties: ['none'] },
  { name: 'eggplant', dietaryProperties: ['none'], aliases: ['aubergine'] },
  { name: 'potato', dietaryProperties: ['none'] },
  { name: 'potatoes', dietaryProperties: ['none'] },
  { name: 'sweet potato', dietaryProperties: ['none'] },
  { name: 'cauliflower', dietaryProperties: ['none'] },
  { name: 'asparagus', dietaryProperties: ['none'] },
  { name: 'green beans', dietaryProperties: ['none'] },

  // Legumes (no gluten or lactose)
  { name: 'chickpeas', dietaryProperties: ['none'] },
  { name: 'black beans', dietaryProperties: ['none'] },
  { name: 'kidney beans', dietaryProperties: ['none'] },
  { name: 'lentils', dietaryProperties: ['none'] },
  { name: 'red lentils', dietaryProperties: ['none'] },
  { name: 'green lentils', dietaryProperties: ['none'] },
  { name: 'tofu', dietaryProperties: ['none'] },
  { name: 'tempeh', dietaryProperties: ['none'] },

  // Herbs and spices (no restrictions)
  { name: 'basil', dietaryProperties: ['none'] },
  { name: 'oregano', dietaryProperties: ['none'] },
  { name: 'parsley', dietaryProperties: ['none'] },
  { name: 'cilantro', dietaryProperties: ['none'], aliases: ['coriander'] },
  { name: 'thyme', dietaryProperties: ['none'] },
  { name: 'rosemary', dietaryProperties: ['none'] },
  { name: 'paprika', dietaryProperties: ['none'] },
  { name: 'cumin', dietaryProperties: ['none'] },
  { name: 'chili powder', dietaryProperties: ['none'] },
  { name: 'black pepper', dietaryProperties: ['none'] },
  { name: 'salt', dietaryProperties: ['none'] },
  { name: 'ginger', dietaryProperties: ['none'] },
  { name: 'turmeric', dietaryProperties: ['none'] },

  // Condiments and sauces
  { name: 'vinegar', dietaryProperties: ['none'] },
  { name: 'balsamic vinegar', dietaryProperties: ['none'] },
  { name: 'red wine vinegar', dietaryProperties: ['none'] },
  { name: 'apple cider vinegar', dietaryProperties: ['none'] },
  { name: 'lemon juice', dietaryProperties: ['none'] },
  { name: 'lime juice', dietaryProperties: ['none'] },
  { name: 'tomato paste', dietaryProperties: ['none'] },
  { name: 'tomato sauce', dietaryProperties: ['none'] },
  { name: 'tamari', dietaryProperties: ['none'] }, // Gluten-free soy sauce
  { name: 'coconut aminos', dietaryProperties: ['none'] }, // Soy sauce alternative
  { name: 'hot sauce', dietaryProperties: ['none'] },
  { name: 'mustard', dietaryProperties: ['none'] },
  { name: 'honey', dietaryProperties: ['none'] },
  { name: 'maple syrup', dietaryProperties: ['none'] },

  // Nuts and seeds (no gluten or lactose)
  { name: 'almonds', dietaryProperties: ['none'] },
  { name: 'cashews', dietaryProperties: ['none'] },
  { name: 'walnuts', dietaryProperties: ['none'] },
  { name: 'peanuts', dietaryProperties: ['none'] },
  { name: 'peanut butter', dietaryProperties: ['none'] },
  { name: 'sunflower seeds', dietaryProperties: ['none'] },
  { name: 'sesame seeds', dietaryProperties: ['none'] },
  { name: 'chia seeds', dietaryProperties: ['none'] },
  { name: 'flaxseed', dietaryProperties: ['none'] },
];

// Lookup ingredient by name (case-insensitive, checks aliases)
export function lookupIngredient(name: string): IngredientData | null {
  const normalized = name.toLowerCase().trim();
  
  return INGREDIENT_DATABASE.find(item => {
    if (item.name.toLowerCase() === normalized) return true;
    if (item.aliases?.some(alias => alias.toLowerCase() === normalized)) return true;
    return false;
  }) || null;
}

// Get dietary properties for ingredient name (returns 'unknown' if not in database)
export function getIngredientProperties(name: string): DietaryProperty[] | 'unknown' {
  const item = lookupIngredient(name);
  return item ? item.dietaryProperties : 'unknown';
}

// Check if ingredient is known to be safe (no restrictions)
export function isKnownSafe(name: string): boolean {
  const properties = getIngredientProperties(name);
  if (properties === 'unknown') return false;
  return properties.length === 0 || (properties.length === 1 && properties[0] === 'none');
}

// Get count of known ingredients
export function getKnownIngredientCount(): number {
  return INGREDIENT_DATABASE.length;
}
```

**Evidence**: 
- Static database covers common ingredients (master plan decision 1, lines 196-198)
- ~100 ingredients for 80% coverage estimate
- Conservative approach: flag aged cheese despite low lactose (user can add to explicit_inclusions)

**Done When**: Static ingredient database created with ~150 common ingredients

---

### PLAN-203: Create Dietary Constraint Validator

**Change Type**: create  
**File(s)**: `src/main/validation/dietary-validator.ts`

**Instruction**:
Implement multi-layer dietary constraint validation:

```typescript
import type { CreateRecipeInput, UpdateRecipeInput, CreateIngredientInput } from '../../shared/types/recipe';
import type { DietaryProfile } from '../../shared/types/recipe';
import type { DietaryTag, DietaryProperty } from '../../shared/types/database';
import type { ValidationError, ValidationResult } from '../../shared/types/validation';
import { lookupIngredient, getIngredientProperties } from './ingredient-database';

// Validate recipe against dietary constraints
export async function validateDietaryConstraints(
  recipeInput: CreateRecipeInput | UpdateRecipeInput,
  profile: DietaryProfile
): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];

  // If no ingredients provided (update without ingredient changes), skip validation
  if (!recipeInput.ingredients || recipeInput.ingredients.length === 0) {
    return errors;
  }

  // Check each ingredient against dietary profile
  for (let i = 0; i < recipeInput.ingredients.length; i++) {
    const ingredient = recipeInput.ingredients[i];
    const ingredientErrors = validateIngredient(ingredient, i, profile);
    errors.push(...ingredientErrors);
  }

  return errors;
}

// Validate single ingredient against dietary profile
function validateIngredient(
  ingredient: CreateIngredientInput,
  index: number,
  profile: DietaryProfile
): ValidationError[] {
  const errors: ValidationError[] = [];
  const ingredientName = ingredient.name.toLowerCase().trim();

  // Check explicit exclusions first (highest priority)
  const isExplicitlyExcluded = profile.explicitExclusions.some(
    excluded => excluded.toLowerCase().trim() === ingredientName
  );

  if (isExplicitlyExcluded) {
    errors.push({
      field: `ingredients[${index}].name`,
      constraint: 'dietary-explicit-exclusion',
      message: `Ingredient "${ingredient.name}" is explicitly excluded in your dietary profile.`,
      suggestedFix: 'Remove this ingredient or update your dietary profile.',
    });
    return errors; // Don't check further if explicitly excluded
  }

  // Check explicit inclusions (allows override of restrictions)
  const isExplicitlyIncluded = profile.explicitInclusions.some(
    included => included.toLowerCase().trim() === ingredientName
  );

  if (isExplicitlyIncluded) {
    // Ingredient is explicitly allowed, skip restriction checks
    return errors;
  }

  // Multi-layer validation: combine static database + ingredient dietary_properties
  let detectedProperties: DietaryProperty[] = [];

  // Layer 1: Check static ingredient database
  const staticProperties = getIngredientProperties(ingredient.name);
  if (staticProperties !== 'unknown') {
    detectedProperties = staticProperties;
  } else {
    // Layer 2: Use ingredient's self-declared dietary properties
    detectedProperties = ingredient.dietaryProperties || [];
  }

  // Check detected properties against hard restrictions
  for (const property of detectedProperties) {
    if (property === 'none') continue; // No restriction

    // Map dietary property to restriction tag
    const violatedRestriction = mapPropertyToRestriction(property, profile.hardRestrictions);

    if (violatedRestriction) {
      errors.push({
        field: `ingredients[${index}].name`,
        constraint: `dietary-${violatedRestriction}`,
        message: `Ingredient "${ingredient.name}" contains ${formatProperty(property)}, which violates your ${violatedRestriction} dietary restriction.`,
        suggestedFix: staticProperties === 'unknown' 
          ? 'This ingredient is not in our database. Please verify its dietary properties manually or choose an alternative.'
          : `Replace with a ${violatedRestriction} alternative or remove this ingredient.`,
      });
    }
  }

  // Warn if ingredient is unknown (not in static database and no properties declared)
  if (staticProperties === 'unknown' && (!ingredient.dietaryProperties || ingredient.dietaryProperties.length === 0)) {
    errors.push({
      field: `ingredients[${index}].name`,
      constraint: 'dietary-unknown',
      message: `Ingredient "${ingredient.name}" is not in our database and has no dietary properties declared. Manual verification required.`,
      suggestedFix: 'Please verify this ingredient is safe for your dietary restrictions or use a known alternative.',
    });
  }

  return errors;
}

// Map dietary property to restriction tag
function mapPropertyToRestriction(
  property: DietaryProperty,
  restrictions: DietaryTag[]
): DietaryTag | null {
  const mapping: Record<DietaryProperty, DietaryTag | null> = {
    'contains-gluten': 'gluten-free',
    'contains-lactose': 'lactose-free',
    'contains-eggs': 'vegan', // Eggs violate vegan
    'contains-fish': 'vegan', // Fish violates vegan
    'contains-meat': 'vegetarian', // Meat violates vegetarian and vegan
    'none': null,
  };

  const restrictionTag = mapping[property];
  if (!restrictionTag) return null;

  // Check if user has this restriction
  if (restrictions.includes(restrictionTag)) {
    return restrictionTag;
  }

  // Special case: meat also violates vegan
  if (property === 'contains-meat' && restrictions.includes('vegan')) {
    return 'vegan';
  }

  return null;
}

// Format dietary property for human-readable messages
function formatProperty(property: DietaryProperty): string {
  const formats: Record<DietaryProperty, string> = {
    'contains-gluten': 'gluten',
    'contains-lactose': 'lactose',
    'contains-eggs': 'eggs',
    'contains-fish': 'fish',
    'contains-meat': 'meat',
    'none': 'no dietary restrictions',
  };
  return formats[property] || property;
}
```

**Evidence**: 
- Multi-layer validation strategy (master plan decision 1, research lines 356-390)
- Explicit inclusions/exclusions support (spec lines 481-489)
- Conservative defaults for unknown ingredients (research lines 375-378)

**Done When**: Dietary constraint validator implements multi-layer strategy with clear error messages

---

### PLAN-204: Create Time Constraint Validator

**Change Type**: create  
**File(s)**: `src/main/validation/time-validator.ts`

**Instruction**:
Implement cooking time constraint validation (30-45 minutes):

```typescript
import type { CreateRecipeInput, UpdateRecipeInput } from '../../shared/types/recipe';
import type { ValidationError } from '../../shared/types/validation';

const MIN_COOKING_TIME = 30;
const MAX_COOKING_TIME = 45;

// Validate cooking time constraint
export function validateTimeConstraints(
  recipeInput: CreateRecipeInput | UpdateRecipeInput
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check if cookingTimeMinutes is provided (required for create, optional for update)
  if (recipeInput.cookingTimeMinutes === undefined) {
    return errors; // Skip validation if not provided (update case)
  }

  const cookingTime = recipeInput.cookingTimeMinutes;

  // Validate minimum cooking time (30 minutes)
  if (cookingTime < MIN_COOKING_TIME) {
    errors.push({
      field: 'cookingTimeMinutes',
      constraint: 'time-minimum',
      message: `Cooking time must be at least ${MIN_COOKING_TIME} minutes. Current: ${cookingTime} minutes.`,
      suggestedFix: `Increase cooking time to ${MIN_COOKING_TIME} minutes or more.`,
    });
  }

  // Validate maximum cooking time (45 minutes)
  if (cookingTime > MAX_COOKING_TIME) {
    errors.push({
      field: 'cookingTimeMinutes',
      constraint: 'time-maximum',
      message: `Cooking time must be at most ${MAX_COOKING_TIME} minutes. Current: ${cookingTime} minutes.`,
      suggestedFix: `Reduce cooking time to ${MAX_COOKING_TIME} minutes or less, or simplify the recipe.`,
    });
  }

  return errors;
}

// Get time constraint limits (for UI display)
export function getTimeConstraints(): { min: number; max: number } {
  return {
    min: MIN_COOKING_TIME,
    max: MAX_COOKING_TIME,
  };
}
```

**Evidence**: 
- Cooking time 30-45 minutes (spec lines 47-48, master plan lines 455-456)
- Database CHECK constraint enforces same limits (migrations.ts:42)

**Done When**: Time validator enforces 30-45 minute constraint with actionable errors

---

### PLAN-205: Create Cookware Constraint Validator

**Change Type**: create  
**File(s)**: `src/main/validation/cookware-validator.ts`

**Instruction**:
Implement cookware constraint validation (single type only):

```typescript
import type { CreateRecipeInput, UpdateRecipeInput } from '../../shared/types/recipe';
import type { CookwareType } from '../../shared/types/database';
import type { ValidationError } from '../../shared/types/validation';

const VALID_COOKWARE_TYPES: CookwareType[] = ['one-pot', 'one-pan', 'oven'];

// Validate cookware constraint (must be one of allowed types)
export function validateCookwareConstraints(
  recipeInput: CreateRecipeInput | UpdateRecipeInput
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check if cookwareType is provided (required for create, optional for update)
  if (recipeInput.cookwareType === undefined) {
    return errors; // Skip validation if not provided (update case)
  }

  const cookwareType = recipeInput.cookwareType;

  // Validate cookware type is one of allowed values
  if (!VALID_COOKWARE_TYPES.includes(cookwareType)) {
    errors.push({
      field: 'cookwareType',
      constraint: 'cookware-single',
      message: `Cookware type must be one of: ${VALID_COOKWARE_TYPES.join(', ')}. Current: "${cookwareType}".`,
      suggestedFix: 'Choose a recipe that uses minimal cookware (one pot, one pan, or oven only).',
    });
  }

  return errors;
}

// Get valid cookware types (for UI display)
export function getValidCookwareTypes(): CookwareType[] {
  return [...VALID_COOKWARE_TYPES];
}
```

**Evidence**: 
- Cookware single enum (master plan decision 6, lines 291-304)
- Database CHECK constraint enforces same values (migrations.ts:45)

**Done When**: Cookware validator enforces single cookware type constraint

---

### PLAN-206: Create Servings Constraint Validator

**Change Type**: create  
**File(s)**: `src/main/validation/servings-validator.ts`

**Instruction**:
Implement servings constraint validation (exactly 2):

```typescript
import type { CreateRecipeInput, UpdateRecipeInput } from '../../shared/types/recipe';
import type { ValidationError } from '../../shared/types/validation';

const REQUIRED_SERVINGS = 2;

// Validate servings constraint (must be exactly 2)
export function validateServingsConstraints(
  recipeInput: CreateRecipeInput | UpdateRecipeInput
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check if servings is provided (required for create, optional for update)
  if (recipeInput.servings === undefined) {
    return errors; // Skip validation if not provided (update case)
  }

  const servings = recipeInput.servings;

  // Validate servings is exactly 2
  if (servings !== REQUIRED_SERVINGS) {
    errors.push({
      field: 'servings',
      constraint: 'servings-exact',
      message: `Servings must be exactly ${REQUIRED_SERVINGS}. Current: ${servings}.`,
      suggestedFix: `Adjust ingredient quantities to serve ${REQUIRED_SERVINGS} people.`,
    });
  }

  return errors;
}

// Get required servings (for UI display)
export function getRequiredServings(): number {
  return REQUIRED_SERVINGS;
}
```

**Evidence**: 
- Servings must be 2 (spec line 132, master plan line 459)
- Database CHECK constraint enforces same value (migrations.ts:46)

**Done When**: Servings validator enforces exactly 2 servings constraint

---

### PLAN-207: Create Validation Orchestrator

**Change Type**: create  
**File(s)**: `src/main/validation/validator.ts`

**Instruction**:
Create orchestrator that runs all validation checks and aggregates results:

```typescript
import type { CreateRecipeInput, UpdateRecipeInput } from '../../shared/types/recipe';
import type { DietaryProfile } from '../../shared/types/recipe';
import type { ValidationError, ValidationResult } from '../../shared/types/validation';
import { validateDietaryConstraints } from './dietary-validator';
import { validateTimeConstraints } from './time-validator';
import { validateCookwareConstraints } from './cookware-validator';
import { validateServingsConstraints } from './servings-validator';
import { getDietaryProfile } from '../database/dal/dietary-profile';

// Validate recipe against ALL constraints
export async function validateRecipe(
  recipeInput: CreateRecipeInput | UpdateRecipeInput
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];

  // Get dietary profile for validation
  const profile = await getDietaryProfile();

  // Run all validators in parallel (they're independent)
  const [dietaryErrors, timeErrors, cookwareErrors, servingsErrors] = await Promise.all([
    validateDietaryConstraints(recipeInput, profile),
    Promise.resolve(validateTimeConstraints(recipeInput)),
    Promise.resolve(validateCookwareConstraints(recipeInput)),
    Promise.resolve(validateServingsConstraints(recipeInput)),
  ]);

  // Aggregate all errors
  errors.push(...dietaryErrors);
  errors.push(...timeErrors);
  errors.push(...cookwareErrors);
  errors.push(...servingsErrors);

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Validate recipe and throw error if invalid (for use in DAL)
export async function validateRecipeOrThrow(
  recipeInput: CreateRecipeInput | UpdateRecipeInput
): Promise<void> {
  const result = await validateRecipe(recipeInput);
  
  if (!result.valid) {
    const errorMessages = result.errors.map(e => `${e.field}: ${e.message}`).join('\n');
    throw new Error(`Recipe validation failed:\n${errorMessages}`);
  }
}
```

**Evidence**: Orchestrator aggregates all validation types for single validation call  
**Done When**: Validator orchestrates all constraint checks and returns unified result

---

### PLAN-208: Create Validation Index (Barrel Export)

**Change Type**: create  
**File(s)**: `src/main/validation/index.ts`

**Instruction**:
Create barrel export for validation layer:

```typescript
// Main validation orchestrator
export { validateRecipe, validateRecipeOrThrow } from './validator';

// Individual validators (for granular use if needed)
export { validateDietaryConstraints } from './dietary-validator';
export { validateTimeConstraints, getTimeConstraints } from './time-validator';
export { validateCookwareConstraints, getValidCookwareTypes } from './cookware-validator';
export { validateServingsConstraints, getRequiredServings } from './servings-validator';

// Static ingredient database
export { 
  lookupIngredient, 
  getIngredientProperties, 
  isKnownSafe,
  getKnownIngredientCount,
  INGREDIENT_DATABASE,
  type IngredientData,
} from './ingredient-database';
```

**Evidence**: Barrel exports provide clean API for validation layer  
**Done When**: All validation exports available from single import

---

### PLAN-209: Integrate Validation into Recipe DAL

**Change Type**: modify  
**File(s)**: `src/main/database/dal/recipes.ts`

**Instruction**:
Add validation before recipe creation and update:

```typescript
// Add import at top of file
import { validateRecipeOrThrow } from '../../validation';

// Modify createRecipe function (add validation before insert)
export async function createRecipe(input: CreateRecipeInput): Promise<Recipe> {
  // VALIDATE BEFORE STORAGE
  await validateRecipeOrThrow(input);

  const recipeId = randomUUID();
  const now = new Date().toISOString();
  
  const totalTime = (input.prepTimeMinutes || 0) + input.cookingTimeMinutes;

  // ... rest of existing code unchanged ...
}

// Modify updateRecipe function (add validation before update)
export async function updateRecipe(id: string, input: UpdateRecipeInput): Promise<Recipe | null> {
  const existing = await getRecipeById(id);
  if (!existing) return null;

  // VALIDATE BEFORE UPDATE
  await validateRecipeOrThrow(input);

  const now = new Date().toISOString();

  // ... rest of existing code unchanged ...
}
```

**Evidence**: 
- Validation must run before persistence (spec lines 119, 124-130)
- Master plan decision 2: reject non-compliant recipes (lines 209-225)

**Done When**: Recipe DAL validates all recipes before create/update operations

---

### PLAN-210: Create Unit Tests - Dietary Validator

**Change Type**: create  
**File(s)**: `src/main/validation/dietary-validator.test.ts`

**Instruction**:
Create comprehensive tests for dietary constraint validation:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { validateDietaryConstraints } from './dietary-validator';
import type { CreateRecipeInput, DietaryProfile } from '../../shared/types/recipe';
import type { DietaryTag } from '../../shared/types/database';

describe('Dietary Constraint Validator', () => {
  const defaultProfile: DietaryProfile = {
    id: 1,
    hardRestrictions: ['gluten-free', 'lactose-free'],
    preferences: [],
    explicitInclusions: [],
    explicitExclusions: [],
    updatedAt: new Date(),
  };

  const baseRecipe: CreateRecipeInput = {
    title: 'Test Recipe',
    cookingTimeMinutes: 30,
    cookwareType: 'one-pot',
    servings: 2,
    dietaryTags: [],
    seasonality: ['any'],
    sourceType: 'manual',
    ingredients: [],
  };

  it('should pass validation for safe ingredients (rice, chicken)', async () => {
    const recipe: CreateRecipeInput = {
      ...baseRecipe,
      ingredients: [
        { name: 'rice', quantity: 1, unit: 'cup', dietaryProperties: ['none'], orderIndex: 1 },
        { name: 'chicken breast', quantity: 300, unit: 'g', dietaryProperties: ['contains-meat'], orderIndex: 2 },
      ],
    };

    const errors = await validateDietaryConstraints(recipe, defaultProfile);
    expect(errors).toHaveLength(0);
  });

  it('should reject gluten-containing ingredients (wheat flour)', async () => {
    const recipe: CreateRecipeInput = {
      ...baseRecipe,
      ingredients: [
        { name: 'wheat flour', quantity: 2, unit: 'cups', dietaryProperties: ['contains-gluten'], orderIndex: 1 },
      ],
    };

    const errors = await validateDietaryConstraints(recipe, defaultProfile);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraint).toBe('dietary-gluten-free');
    expect(errors[0].message).toContain('contains gluten');
  });

  it('should reject lactose-containing ingredients (milk, butter)', async () => {
    const recipe: CreateRecipeInput = {
      ...baseRecipe,
      ingredients: [
        { name: 'milk', quantity: 1, unit: 'cup', dietaryProperties: ['contains-lactose'], orderIndex: 1 },
        { name: 'butter', quantity: 2, unit: 'tbsp', dietaryProperties: ['contains-lactose'], orderIndex: 2 },
      ],
    };

    const errors = await validateDietaryConstraints(recipe, defaultProfile);
    expect(errors).toHaveLength(2);
    expect(errors[0].constraint).toBe('dietary-lactose-free');
    expect(errors[1].constraint).toBe('dietary-lactose-free');
  });

  it('should use static database lookup for known ingredients', async () => {
    const recipe: CreateRecipeInput = {
      ...baseRecipe,
      ingredients: [
        // Don't provide dietaryProperties - should lookup from static database
        { name: 'soy sauce', quantity: 2, unit: 'tbsp', dietaryProperties: [], orderIndex: 1 },
      ],
    };

    const errors = await validateDietaryConstraints(recipe, defaultProfile);
    // soy sauce contains gluten (wheat) in static database
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain('gluten');
  });

  it('should allow explicit inclusions despite restrictions', async () => {
    const profileWithInclusions: DietaryProfile = {
      ...defaultProfile,
      explicitInclusions: ['parmesan cheese'], // Allow despite lactose
    };

    const recipe: CreateRecipeInput = {
      ...baseRecipe,
      ingredients: [
        { name: 'parmesan cheese', quantity: 50, unit: 'g', dietaryProperties: ['contains-lactose'], orderIndex: 1 },
      ],
    };

    const errors = await validateDietaryConstraints(recipe, profileWithInclusions);
    expect(errors).toHaveLength(0); // No errors - explicitly allowed
  });

  it('should reject explicit exclusions', async () => {
    const profileWithExclusions: DietaryProfile = {
      ...defaultProfile,
      explicitExclusions: ['mushrooms'], // User doesn't like mushrooms
    };

    const recipe: CreateRecipeInput = {
      ...baseRecipe,
      ingredients: [
        { name: 'mushrooms', quantity: 200, unit: 'g', dietaryProperties: ['none'], orderIndex: 1 },
      ],
    };

    const errors = await validateDietaryConstraints(recipe, profileWithExclusions);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraint).toBe('dietary-explicit-exclusion');
    expect(errors[0].message).toContain('explicitly excluded');
  });

  it('should warn about unknown ingredients', async () => {
    const recipe: CreateRecipeInput = {
      ...baseRecipe,
      ingredients: [
        // Unknown ingredient not in static database, no properties declared
        { name: 'exotic-spice-xyz', quantity: 1, unit: 'tsp', dietaryProperties: [], orderIndex: 1 },
      ],
    };

    const errors = await validateDietaryConstraints(recipe, defaultProfile);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraint).toBe('dietary-unknown');
    expect(errors[0].message).toContain('not in our database');
  });

  it('should handle vegetarian restriction (reject meat)', async () => {
    const vegetarianProfile: DietaryProfile = {
      ...defaultProfile,
      hardRestrictions: ['gluten-free', 'lactose-free', 'vegetarian'],
    };

    const recipe: CreateRecipeInput = {
      ...baseRecipe,
      ingredients: [
        { name: 'chicken breast', quantity: 300, unit: 'g', dietaryProperties: ['contains-meat'], orderIndex: 1 },
      ],
    };

    const errors = await validateDietaryConstraints(recipe, vegetarianProfile);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraint).toBe('dietary-vegetarian');
    expect(errors[0].message).toContain('contains meat');
  });

  it('should handle vegan restriction (reject eggs, fish, meat)', async () => {
    const veganProfile: DietaryProfile = {
      ...defaultProfile,
      hardRestrictions: ['gluten-free', 'lactose-free', 'vegan'],
    };

    const recipe: CreateRecipeInput = {
      ...baseRecipe,
      ingredients: [
        { name: 'eggs', quantity: 2, unit: 'whole', dietaryProperties: ['contains-eggs'], orderIndex: 1 },
        { name: 'salmon', quantity: 200, unit: 'g', dietaryProperties: ['contains-fish'], orderIndex: 2 },
      ],
    };

    const errors = await validateDietaryConstraints(recipe, veganProfile);
    expect(errors).toHaveLength(2);
    expect(errors.some(e => e.message.includes('eggs'))).toBe(true);
    expect(errors.some(e => e.message.includes('fish'))).toBe(true);
  });

  it('should handle case-insensitive ingredient matching', async () => {
    const recipe: CreateRecipeInput = {
      ...baseRecipe,
      ingredients: [
        { name: 'WHEAT FLOUR', quantity: 2, unit: 'cups', dietaryProperties: ['contains-gluten'], orderIndex: 1 },
      ],
    };

    const errors = await validateDietaryConstraints(recipe, defaultProfile);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraint).toBe('dietary-gluten-free');
  });

  it('should handle ingredient aliases (zucchini/courgette)', async () => {
    const recipe: CreateRecipeInput = {
      ...baseRecipe,
      ingredients: [
        { name: 'courgette', quantity: 1, unit: 'whole', dietaryProperties: [], orderIndex: 1 },
      ],
    };

    const errors = await validateDietaryConstraints(recipe, defaultProfile);
    // courgette is alias for zucchini (safe)
    expect(errors.filter(e => e.constraint !== 'dietary-unknown')).toHaveLength(0);
  });
});
```

**Evidence**: 100% coverage required for dietary validation (spec line 751, master plan line 465)  
**Done When**: All dietary validator tests pass with comprehensive coverage

---

### PLAN-211: Create Unit Tests - Other Validators

**Change Type**: create  
**File(s)**: `src/main/validation/time-validator.test.ts`, `src/main/validation/cookware-validator.test.ts`, `src/main/validation/servings-validator.test.ts`

**Instruction**:
Create tests for time, cookware, and servings validators:

**File 1**: `src/main/validation/time-validator.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { validateTimeConstraints, getTimeConstraints } from './time-validator';
import type { CreateRecipeInput } from '../../shared/types/recipe';

describe('Time Constraint Validator', () => {
  const baseRecipe: Partial<CreateRecipeInput> = {
    title: 'Test Recipe',
    cookwareType: 'one-pot',
    servings: 2,
  };

  it('should accept valid cooking time (30 minutes)', () => {
    const recipe = { ...baseRecipe, cookingTimeMinutes: 30 };
    const errors = validateTimeConstraints(recipe as CreateRecipeInput);
    expect(errors).toHaveLength(0);
  });

  it('should accept valid cooking time (45 minutes)', () => {
    const recipe = { ...baseRecipe, cookingTimeMinutes: 45 };
    const errors = validateTimeConstraints(recipe as CreateRecipeInput);
    expect(errors).toHaveLength(0);
  });

  it('should accept valid cooking time (37 minutes)', () => {
    const recipe = { ...baseRecipe, cookingTimeMinutes: 37 };
    const errors = validateTimeConstraints(recipe as CreateRecipeInput);
    expect(errors).toHaveLength(0);
  });

  it('should reject cooking time below 30 minutes', () => {
    const recipe = { ...baseRecipe, cookingTimeMinutes: 25 };
    const errors = validateTimeConstraints(recipe as CreateRecipeInput);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraint).toBe('time-minimum');
    expect(errors[0].message).toContain('at least 30');
  });

  it('should reject cooking time above 45 minutes', () => {
    const recipe = { ...baseRecipe, cookingTimeMinutes: 50 };
    const errors = validateTimeConstraints(recipe as CreateRecipeInput);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraint).toBe('time-maximum');
    expect(errors[0].message).toContain('at most 45');
  });

  it('should return time constraints', () => {
    const constraints = getTimeConstraints();
    expect(constraints.min).toBe(30);
    expect(constraints.max).toBe(45);
  });
});
```

**File 2**: `src/main/validation/cookware-validator.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { validateCookwareConstraints, getValidCookwareTypes } from './cookware-validator';
import type { CreateRecipeInput } from '../../shared/types/recipe';

describe('Cookware Constraint Validator', () => {
  const baseRecipe: Partial<CreateRecipeInput> = {
    title: 'Test Recipe',
    cookingTimeMinutes: 30,
    servings: 2,
  };

  it('should accept one-pot cookware', () => {
    const recipe = { ...baseRecipe, cookwareType: 'one-pot' as const };
    const errors = validateCookwareConstraints(recipe as CreateRecipeInput);
    expect(errors).toHaveLength(0);
  });

  it('should accept one-pan cookware', () => {
    const recipe = { ...baseRecipe, cookwareType: 'one-pan' as const };
    const errors = validateCookwareConstraints(recipe as CreateRecipeInput);
    expect(errors).toHaveLength(0);
  });

  it('should accept oven cookware', () => {
    const recipe = { ...baseRecipe, cookwareType: 'oven' as const };
    const errors = validateCookwareConstraints(recipe as CreateRecipeInput);
    expect(errors).toHaveLength(0);
  });

  it('should reject invalid cookware type', () => {
    const recipe = { ...baseRecipe, cookwareType: 'multi-pot' as any };
    const errors = validateCookwareConstraints(recipe as CreateRecipeInput);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraint).toBe('cookware-single');
  });

  it('should return valid cookware types', () => {
    const types = getValidCookwareTypes();
    expect(types).toEqual(['one-pot', 'one-pan', 'oven']);
  });
});
```

**File 3**: `src/main/validation/servings-validator.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { validateServingsConstraints, getRequiredServings } from './servings-validator';
import type { CreateRecipeInput } from '../../shared/types/recipe';

describe('Servings Constraint Validator', () => {
  const baseRecipe: Partial<CreateRecipeInput> = {
    title: 'Test Recipe',
    cookingTimeMinutes: 30,
    cookwareType: 'one-pot',
  };

  it('should accept exactly 2 servings', () => {
    const recipe = { ...baseRecipe, servings: 2 };
    const errors = validateServingsConstraints(recipe as CreateRecipeInput);
    expect(errors).toHaveLength(0);
  });

  it('should reject 1 serving', () => {
    const recipe = { ...baseRecipe, servings: 1 };
    const errors = validateServingsConstraints(recipe as CreateRecipeInput);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraint).toBe('servings-exact');
    expect(errors[0].message).toContain('exactly 2');
  });

  it('should reject 4 servings', () => {
    const recipe = { ...baseRecipe, servings: 4 };
    const errors = validateServingsConstraints(recipe as CreateRecipeInput);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraint).toBe('servings-exact');
  });

  it('should return required servings', () => {
    const required = getRequiredServings();
    expect(required).toBe(2);
  });
});
```

**Evidence**: All validators need comprehensive test coverage  
**Done When**: All validator tests pass with full coverage

---

### PLAN-212: Create Unit Tests - Validation Orchestrator

**Change Type**: create  
**File(s)**: `src/main/validation/validator.test.ts`

**Instruction**:
Create tests for validation orchestrator (end-to-end validation):

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { validateRecipe, validateRecipeOrThrow } from './validator';
import { runMigrations } from '../database/migrations';
import type { CreateRecipeInput } from '../../shared/types/recipe';

beforeEach(() => {
  runMigrations();
});

describe('Validation Orchestrator', () => {
  const validRecipe: CreateRecipeInput = {
    title: 'Valid Stir-Fry',
    cookingTimeMinutes: 30,
    cookwareType: 'one-pan',
    servings: 2,
    dietaryTags: ['gluten-free', 'lactose-free'],
    seasonality: ['any'],
    sourceType: 'manual',
    ingredients: [
      { name: 'rice', quantity: 1, unit: 'cup', dietaryProperties: ['none'], orderIndex: 1 },
      { name: 'chicken breast', quantity: 300, unit: 'g', dietaryProperties: ['contains-meat'], orderIndex: 2 },
      { name: 'broccoli', quantity: 200, unit: 'g', dietaryProperties: ['none'], orderIndex: 3 },
    ],
  };

  it('should pass validation for fully compliant recipe', async () => {
    const result = await validateRecipe(validRecipe);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should aggregate errors from multiple validators', async () => {
    const invalidRecipe: CreateRecipeInput = {
      ...validRecipe,
      cookingTimeMinutes: 50, // Too long
      servings: 4, // Wrong servings
      ingredients: [
        { name: 'wheat flour', quantity: 2, unit: 'cups', dietaryProperties: ['contains-gluten'], orderIndex: 1 },
        { name: 'milk', quantity: 1, unit: 'cup', dietaryProperties: ['contains-lactose'], orderIndex: 2 },
      ],
    };

    const result = await validateRecipe(invalidRecipe);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(4); // Time, servings, 2 dietary
    expect(result.errors.some(e => e.constraint === 'time-maximum')).toBe(true);
    expect(result.errors.some(e => e.constraint === 'servings-exact')).toBe(true);
    expect(result.errors.some(e => e.constraint === 'dietary-gluten-free')).toBe(true);
    expect(result.errors.some(e => e.constraint === 'dietary-lactose-free')).toBe(true);
  });

  it('should throw error when validateRecipeOrThrow is called with invalid recipe', async () => {
    const invalidRecipe: CreateRecipeInput = {
      ...validRecipe,
      cookingTimeMinutes: 20, // Too short
    };

    await expect(validateRecipeOrThrow(invalidRecipe)).rejects.toThrow('Recipe validation failed');
  });

  it('should not throw error when validateRecipeOrThrow is called with valid recipe', async () => {
    await expect(validateRecipeOrThrow(validRecipe)).resolves.not.toThrow();
  });

  it('should validate dietary constraints using current dietary profile', async () => {
    // Default profile has gluten-free and lactose-free restrictions
    const recipeWithGluten: CreateRecipeInput = {
      ...validRecipe,
      ingredients: [
        { name: 'wheat pasta', quantity: 200, unit: 'g', dietaryProperties: ['contains-gluten'], orderIndex: 1 },
      ],
    };

    const result = await validateRecipe(recipeWithGluten);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.constraint === 'dietary-gluten-free')).toBe(true);
  });
});
```

**Evidence**: Orchestrator must coordinate all validation types correctly  
**Done When**: Orchestrator tests verify end-to-end validation flow

---

### PLAN-213: Create Integration Tests - DAL with Validation

**Change Type**: create  
**File(s)**: `src/main/database/dal/recipes-validation-integration.test.ts`

**Instruction**:
Create integration tests verifying validation blocks invalid recipe storage:

```typescript
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import {
  createRecipe,
  updateRecipe,
  getRecipeById,
  closeDatabase,
} from '../index';
import { runMigrations } from '../migrations';
import type { CreateRecipeInput } from '../../../shared/types/recipe';

beforeEach(() => {
  runMigrations();
});

afterAll(() => {
  closeDatabase();
});

describe('Recipe DAL with Validation Integration', () => {
  const validRecipe: CreateRecipeInput = {
    title: 'Valid Recipe',
    cookingTimeMinutes: 35,
    cookwareType: 'one-pot',
    servings: 2,
    dietaryTags: ['gluten-free', 'lactose-free'],
    seasonality: ['any'],
    sourceType: 'manual',
    ingredients: [
      { name: 'rice', quantity: 1, unit: 'cup', dietaryProperties: ['none'], orderIndex: 1 },
      { name: 'chicken breast', quantity: 300, unit: 'g', dietaryProperties: ['contains-meat'], orderIndex: 2 },
    ],
  };

  it('should successfully create valid recipe', async () => {
    const recipe = await createRecipe(validRecipe);
    expect(recipe.id).toBeDefined();
    expect(recipe.title).toBe('Valid Recipe');
  });

  it('should reject recipe with gluten ingredient', async () => {
    const invalidRecipe: CreateRecipeInput = {
      ...validRecipe,
      ingredients: [
        { name: 'wheat flour', quantity: 2, unit: 'cups', dietaryProperties: ['contains-gluten'], orderIndex: 1 },
      ],
    };

    await expect(createRecipe(invalidRecipe)).rejects.toThrow('Recipe validation failed');
  });

  it('should reject recipe with lactose ingredient', async () => {
    const invalidRecipe: CreateRecipeInput = {
      ...validRecipe,
      ingredients: [
        { name: 'butter', quantity: 2, unit: 'tbsp', dietaryProperties: ['contains-lactose'], orderIndex: 1 },
      ],
    };

    await expect(createRecipe(invalidRecipe)).rejects.toThrow('Recipe validation failed');
  });

  it('should reject recipe with cooking time below 30 minutes', async () => {
    const invalidRecipe: CreateRecipeInput = {
      ...validRecipe,
      cookingTimeMinutes: 25,
    };

    await expect(createRecipe(invalidRecipe)).rejects.toThrow('Recipe validation failed');
  });

  it('should reject recipe with cooking time above 45 minutes', async () => {
    const invalidRecipe: CreateRecipeInput = {
      ...validRecipe,
      cookingTimeMinutes: 50,
    };

    await expect(createRecipe(invalidRecipe)).rejects.toThrow('Recipe validation failed');
  });

  it('should reject recipe with servings not equal to 2', async () => {
    const invalidRecipe: CreateRecipeInput = {
      ...validRecipe,
      servings: 4,
    };

    await expect(createRecipe(invalidRecipe)).rejects.toThrow('Recipe validation failed');
  });

  it('should reject recipe with invalid cookware type', async () => {
    const invalidRecipe: CreateRecipeInput = {
      ...validRecipe,
      cookwareType: 'multi-pot' as any,
    };

    await expect(createRecipe(invalidRecipe)).rejects.toThrow('Recipe validation failed');
  });

  it('should reject update with constraint violations', async () => {
    const created = await createRecipe(validRecipe);
    
    // Try to update with invalid cooking time
    await expect(
      updateRecipe(created.id, { cookingTimeMinutes: 60 })
    ).rejects.toThrow('Recipe validation failed');

    // Verify original recipe unchanged
    const unchanged = await getRecipeById(created.id);
    expect(unchanged!.cookingTimeMinutes).toBe(35); // Original value
  });

  it('should allow update that maintains validity', async () => {
    const created = await createRecipe(validRecipe);
    
    const updated = await updateRecipe(created.id, { title: 'Updated Title' });
    expect(updated!.title).toBe('Updated Title');
    expect(updated!.cookingTimeMinutes).toBe(35); // Unchanged
  });
});
```

**Evidence**: Integration tests verify validation prevents storage of invalid recipes  
**Done When**: DAL rejects invalid recipes at create and update with validation errors

---

### PLAN-214: Create Unit Tests - Static Ingredient Database

**Change Type**: create  
**File(s)**: `src/main/validation/ingredient-database.test.ts`

**Instruction**:
Create tests for static ingredient database:

```typescript
import { describe, it, expect } from 'vitest';
import {
  lookupIngredient,
  getIngredientProperties,
  isKnownSafe,
  getKnownIngredientCount,
} from './ingredient-database';

describe('Static Ingredient Database', () => {
  it('should lookup ingredient by exact name', () => {
    const result = lookupIngredient('wheat flour');
    expect(result).not.toBeNull();
    expect(result!.dietaryProperties).toContain('contains-gluten');
  });

  it('should lookup ingredient case-insensitively', () => {
    const result = lookupIngredient('WHEAT FLOUR');
    expect(result).not.toBeNull();
    expect(result!.dietaryProperties).toContain('contains-gluten');
  });

  it('should lookup ingredient by alias', () => {
    const result = lookupIngredient('courgette');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('zucchini');
  });

  it('should return null for unknown ingredient', () => {
    const result = lookupIngredient('exotic-unknown-ingredient');
    expect(result).toBeNull();
  });

  it('should get dietary properties for known ingredient', () => {
    const properties = getIngredientProperties('butter');
    expect(properties).not.toBe('unknown');
    expect(properties).toContain('contains-lactose');
  });

  it('should return "unknown" for ingredient not in database', () => {
    const properties = getIngredientProperties('unknown-spice-xyz');
    expect(properties).toBe('unknown');
  });

  it('should identify known safe ingredients', () => {
    expect(isKnownSafe('rice')).toBe(true);
    expect(isKnownSafe('chicken breast')).toBe(true); // contains-meat is tracked but not a dietary restriction by default
    expect(isKnownSafe('olive oil')).toBe(true);
  });

  it('should identify unsafe ingredients', () => {
    expect(isKnownSafe('wheat flour')).toBe(false);
    expect(isKnownSafe('butter')).toBe(false);
    expect(isKnownSafe('milk')).toBe(false);
  });

  it('should return false for unknown ingredients', () => {
    expect(isKnownSafe('unknown-ingredient')).toBe(false);
  });

  it('should have at least 100 known ingredients', () => {
    const count = getKnownIngredientCount();
    expect(count).toBeGreaterThanOrEqual(100);
  });

  it('should correctly identify gluten-free alternatives', () => {
    expect(getIngredientProperties('wheat pasta')).toContain('contains-gluten');
    expect(getIngredientProperties('gluten-free pasta')).not.toContain('contains-gluten');
    expect(isKnownSafe('gluten-free pasta')).toBe(true);
  });

  it('should correctly identify dairy alternatives', () => {
    expect(getIngredientProperties('milk')).toContain('contains-lactose');
    expect(getIngredientProperties('almond milk')).not.toContain('contains-lactose');
    expect(isKnownSafe('almond milk')).toBe(true);
  });

  it('should flag soy sauce as containing gluten', () => {
    const properties = getIngredientProperties('soy sauce');
    expect(properties).toContain('contains-gluten');
  });

  it('should identify tamari as gluten-free soy sauce alternative', () => {
    const properties = getIngredientProperties('tamari');
    expect(properties).not.toContain('contains-gluten');
    expect(isKnownSafe('tamari')).toBe(true);
  });

  it('should handle ingredients with multiple dietary properties', () => {
    // Most ingredients have single property, but verify structure supports multiple
    const result = lookupIngredient('wheat flour');
    expect(Array.isArray(result!.dietaryProperties)).toBe(true);
  });
});
```

**Evidence**: Static database is core of validation reliability  
**Done When**: Ingredient database tests verify lookup and property retrieval

---

### PLAN-215: Create Validation Documentation

**Change Type**: create  
**File(s)**: `src/main/validation/README.md`

**Instruction**:
Document validation architecture and usage:

```markdown
# Validation Layer Documentation

## Architecture

SimpleKitchen implements **zero-false-negative** constraint validation through a multi-layer strategy:

1. **Static Ingredient Database** (~150 curated ingredients, 100% accurate)
2. **Ingredient Self-Declaration** (dietary_properties field)
3. **Dietary Profile Enforcement** (hard restrictions + explicit inclusions/exclusions)
4. **Database Constraints** (CHECK constraints for time, servings, cookware)

## Validation Types

### Dietary Constraints

**Hard Restrictions (Default):**
- Gluten-free
- Lactose-free

**Additional Restrictions (User-Configurable):**
- Vegetarian
- Vegan
- Pescatarian

**Multi-Layer Validation:**
1. **Layer 1**: Static ingredient database lookup (80% coverage)
2. **Layer 2**: Ingredient `dietary_properties` field
3. **Layer 3**: Check against `hard_restrictions` in dietary profile
4. **Layer 4**: Check against `explicit_exclusions` (user-specified ingredients to avoid)
5. **Override**: `explicit_inclusions` (user-specified exceptions, e.g., aged cheese despite lactose-free)

### Time Constraints

- **Minimum**: 30 minutes
- **Maximum**: 45 minutes
- **Rationale**: Spec requirement for weeknight cooking feasibility

### Cookware Constraints

- **Allowed**: `'one-pot' | 'one-pan' | 'oven'`
- **Mutually Exclusive**: Recipe must use exactly one type
- **Rationale**: Minimal cleanup, achievable on weeknights

### Servings Constraints

- **Required**: Exactly 2 servings
- **Rationale**: Spec requirement (two-person household)

## Usage

### Validate Recipe Before Storage

```typescript
import { validateRecipe } from './validation';

const result = await validateRecipe(recipeInput);

if (!result.valid) {
  // Display errors to user
  result.errors.forEach(error => {
    console.error(`${error.field}: ${error.message}`);
    if (error.suggestedFix) {
      console.log(`Suggestion: ${error.suggestedFix}`);
    }
  });
} else {
  // Proceed to save recipe
  await createRecipe(recipeInput);
}
```

### Validate and Throw (Internal DAL Use)

```typescript
import { validateRecipeOrThrow } from './validation';

// Will throw error if validation fails
await validateRecipeOrThrow(recipeInput);
await saveToDatabase(recipeInput);
```

### Check Individual Constraints

```typescript
import { 
  validateDietaryConstraints,
  validateTimeConstraints,
  getTimeConstraints,
} from './validation';

const profile = await getDietaryProfile();
const dietaryErrors = await validateDietaryConstraints(recipeInput, profile);
const timeErrors = validateTimeConstraints(recipeInput);

const { min, max } = getTimeConstraints(); // { min: 30, max: 45 }
```

### Lookup Ingredient Properties

```typescript
import { lookupIngredient, getIngredientProperties } from './validation';

const ingredient = lookupIngredient('butter');
// Returns: { name: 'butter', dietaryProperties: ['contains-lactose'], aliases: undefined }

const properties = getIngredientProperties('wheat flour');
// Returns: ['contains-gluten']

const unknown = getIngredientProperties('exotic-spice');
// Returns: 'unknown'
```

## Validation Error Structure

```typescript
interface ValidationError {
  field: string;           // "ingredients[0].name", "cookingTimeMinutes"
  constraint: string;      // "dietary-gluten-free", "time-maximum"
  message: string;         // Human-readable error
  suggestedFix?: string;   // Optional suggestion for user
}
```

## Static Ingredient Database

**Coverage**: ~150 common ingredients

**Categories:**
- Gluten-containing grains (wheat, barley, rye, pasta, bread, etc.)
- Gluten-free grains (rice, quinoa, GF pasta, corn, oats, etc.)
- Dairy (milk, butter, cream, cheese, yogurt, etc.)
- Dairy alternatives (almond/oat/soy milk, vegan butter, oils, etc.)
- Meats and fish (chicken, beef, pork, salmon, etc.)
- Eggs
- Vegetables (tomato, onion, broccoli, zucchini, etc.)
- Legumes (chickpeas, beans, lentils, tofu, etc.)
- Herbs and spices (basil, oregano, paprika, etc.)
- Condiments (vinegar, tamari, hot sauce, etc.)
- Nuts and seeds (almonds, cashews, peanut butter, etc.)

**Aliases Supported:**
- courgette → zucchini
- aubergine → eggplant
- coriander → cilantro

**Conservative Approach:**
- Aged cheese (parmesan, aged cheddar) flagged as contains-lactose (user can add to explicit_inclusions if tolerated)
- Soy sauce flagged as contains-gluten (most brands use wheat; recommend tamari)

## Extending the Database

To add new ingredients, update `ingredient-database.ts`:

```typescript
export const INGREDIENT_DATABASE: IngredientData[] = [
  // ... existing ingredients ...
  { 
    name: 'new-ingredient', 
    dietaryProperties: ['contains-gluten'], 
    aliases: ['alternative-name'] 
  },
];
```

**Guidelines:**
- Use lowercase for all names and aliases
- Be conservative: if unsure, flag as potential restriction
- Add common aliases (British vs American English, etc.)

## Testing

Run validation tests:

```bash
npm run test -- src/main/validation
```

**Coverage Target**: 100% for all validators (zero false negatives required)

## Limitations & Future Enhancements

**Current Limitations:**
- Static database requires manual curation
- No support for Spoonacular API (optional, planned for Phase 5+)
- Unknown ingredients require manual user verification

**Future Enhancements (Post-MVP):**
- Spoonacular API integration for secondary validation
- User-contributed ingredient database
- Substitution suggestions (AI-powered)
- Allergen warnings beyond gluten/lactose (nuts, shellfish, etc.)

## Zero False Negative Guarantee

**Why it matters**: For users with celiac disease or lactose intolerance, false negatives (suggesting unsafe recipes) are dangerous.

**How we achieve it**:
1. **Conservative defaults**: Unknown ingredients flagged, not auto-approved
2. **Explicit user review**: All errors shown before storage
3. **Multi-layer checks**: Static database + ingredient properties + profile
4. **Database constraints**: Final safety check at SQL level
5. **100% test coverage**: Every validation path tested

**Trade-off**: Higher false positive rate (safe recipes rejected). User can override with explicit_inclusions.
```

**Evidence**: Documentation ensures future maintainers understand validation architecture  
**Done When**: Comprehensive validation documentation exists

---

## Verification Tasks

**No unverified assumptions in Phase 2** - all validation patterns are well-defined by spec and master plan decisions.

## Acceptance Criteria

**Phase 2 Complete When:**

- [ ] Static ingredient database created with ~150 common ingredients
- [ ] Ingredient lookup supports case-insensitive matching and aliases
- [ ] Dietary validator implements multi-layer strategy (static DB + properties + profile)
- [ ] Dietary validator checks hard restrictions and explicit exclusions
- [ ] Dietary validator respects explicit inclusions (overrides restrictions)
- [ ] Dietary validator warns about unknown ingredients
- [ ] Time validator enforces 30-45 minute constraint
- [ ] Cookware validator enforces single cookware type
- [ ] Servings validator enforces exactly 2 servings
- [ ] Validation orchestrator aggregates all errors from all validators
- [ ] validateRecipeOrThrow() throws on validation failure with clear message
- [ ] Recipe DAL validates before create and update operations
- [ ] All unit tests pass with 100% coverage for validators
- [ ] Integration tests verify invalid recipes are rejected by DAL
- [ ] Validation errors include field, constraint, message, and suggestedFix
- [ ] Validation documentation complete and accurate

## Implementor Checklist

Execute in this exact order:

- [ ] PLAN-201: Create validation types
- [ ] PLAN-202: Create static ingredient database
- [ ] PLAN-203: Create dietary constraint validator
- [ ] PLAN-204: Create time constraint validator
- [ ] PLAN-205: Create cookware constraint validator
- [ ] PLAN-206: Create servings constraint validator
- [ ] PLAN-207: Create validation orchestrator
- [ ] PLAN-208: Create validation index (barrel export)
- [ ] PLAN-209: Integrate validation into Recipe DAL
- [ ] PLAN-210: Create unit tests - Dietary validator
- [ ] PLAN-211: Create unit tests - Other validators
- [ ] PLAN-212: Create unit tests - Validation orchestrator
- [ ] PLAN-213: Create integration tests - DAL with validation
- [ ] PLAN-214: Create unit tests - Static ingredient database
- [ ] PLAN-215: Create validation documentation

**Total Tasks**: 15 implementation tasks

---

## Next Phase

After Phase 2 completion, proceed to:

**Phase 3**: Manual Recipe Entry (First User Journey)  
**Plan File**: `2025-12-26-Recipe-Collection-Phase3-Manual-Entry.md`

Phase 3 will implement:
- Recipe entry form UI (React components)
- Ingredient input with dynamic add/remove rows
- IPC handlers for main-renderer communication
- Integration with constraint validation (display errors to user)
- Recipe storage via database layer
- Integration tests for full workflow

---

**End of Phase 2 Plan**
