import { describe, it, expect } from 'vitest';
import { validateDietaryConstraints } from './dietary-validator';
import type { CreateRecipeInput, DietaryProfile } from '../../shared/types/recipe';

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
        {
          name: 'chicken breast',
          quantity: 300,
          unit: 'g',
          dietaryProperties: ['contains-meat'],
          orderIndex: 2,
        },
      ],
    };

    const errors = await validateDietaryConstraints(recipe, defaultProfile);
    expect(errors).toHaveLength(0);
  });

  it('should reject gluten-containing ingredients (wheat flour)', async () => {
    const recipe: CreateRecipeInput = {
      ...baseRecipe,
      ingredients: [
        {
          name: 'wheat flour',
          quantity: 2,
          unit: 'cups',
          dietaryProperties: ['contains-gluten'],
          orderIndex: 1,
        },
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
        {
          name: 'milk',
          quantity: 1,
          unit: 'cup',
          dietaryProperties: ['contains-lactose'],
          orderIndex: 1,
        },
        {
          name: 'butter',
          quantity: 2,
          unit: 'tbsp',
          dietaryProperties: ['contains-lactose'],
          orderIndex: 2,
        },
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
        {
          name: 'parmesan cheese',
          quantity: 50,
          unit: 'g',
          dietaryProperties: ['contains-lactose'],
          orderIndex: 1,
        },
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
        {
          name: 'exotic-spice-xyz',
          quantity: 1,
          unit: 'tsp',
          dietaryProperties: [],
          orderIndex: 1,
        },
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
        {
          name: 'chicken breast',
          quantity: 300,
          unit: 'g',
          dietaryProperties: ['contains-meat'],
          orderIndex: 1,
        },
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
        {
          name: 'eggs',
          quantity: 2,
          unit: 'whole',
          dietaryProperties: ['contains-eggs'],
          orderIndex: 1,
        },
        {
          name: 'salmon',
          quantity: 200,
          unit: 'g',
          dietaryProperties: ['contains-fish'],
          orderIndex: 2,
        },
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
        {
          name: 'WHEAT FLOUR',
          quantity: 2,
          unit: 'cups',
          dietaryProperties: ['contains-gluten'],
          orderIndex: 1,
        },
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
