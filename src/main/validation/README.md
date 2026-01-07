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

- **Total Time Constraint**: 0-60 minutes (prep + cook combined)
- **prepTimeMinutes**: Optional (nullable), defaults to 0 for calculation
- **cookingTimeMinutes**: Required
- **Validation**: `(prepTimeMinutes ?? 0) + cookingTimeMinutes` must be within 0-60 minutes
- **Rationale**: Flexible time range to accommodate quick snacks to full meals

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

const { min, max } = getTimeConstraints(); // { min: 0, max: 60 } - total time (prep + cook)
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
  field: string; // "ingredients[0].name", "cookingTimeMinutes"
  constraint: string; // "dietary-gluten-free", "time-maximum"
  message: string; // Human-readable error
  suggestedFix?: string; // Optional suggestion for user
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
    aliases: ['alternative-name'],
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
