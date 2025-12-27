import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createRecipe, updateRecipe, closeDatabase } from '../index';
import { runMigrations } from '../migrations';
import type { CreateRecipeInput, CookwareType } from '../../../shared/types/recipe';

// Run migrations before each test to ensure clean state
beforeEach(() => {
  runMigrations();
});

// Close database after all tests
afterAll(() => {
  closeDatabase();
});

describe('Recipe DAL with Validation Integration', () => {
  // Valid recipe that meets all constraints
  const validRecipe: CreateRecipeInput = {
    title: 'Simple Rice and Chicken',
    cookingTimeMinutes: 35,
    cookwareType: 'one-pot',
    servings: 2,
    dietaryTags: ['gluten-free', 'lactose-free'],
    seasonality: ['any'],
    sourceType: 'manual',
    instructions: 'Cook rice and chicken together.',
    ingredients: [
      {
        name: 'rice',
        quantity: 1,
        unit: 'cup',
        dietaryProperties: ['none'],
        optional: false,
        orderIndex: 1,
      },
      {
        name: 'chicken',
        quantity: 200,
        unit: 'g',
        dietaryProperties: ['contains-meat'],
        optional: false,
        orderIndex: 2,
      },
    ],
  };

  it('should successfully create valid recipe', async () => {
    const recipe = await createRecipe(validRecipe);

    expect(recipe.id).toBeDefined();
    expect(recipe.title).toBe('Simple Rice and Chicken');
    expect(recipe.cookingTimeMinutes).toBe(35);
    expect(recipe.servings).toBe(2);
    expect(recipe.cookwareType).toBe('one-pot');
    expect(recipe.ingredients).toHaveLength(2);
  });

  it('should reject recipe with gluten ingredient (wheat flour)', async () => {
    const invalidRecipe: CreateRecipeInput = {
      ...validRecipe,
      title: 'Gluten Recipe',
      ingredients: [
        {
          name: 'wheat flour',
          quantity: 2,
          unit: 'cup',
          dietaryProperties: ['contains-gluten'],
          optional: false,
          orderIndex: 1,
        },
      ],
    };

    await expect(createRecipe(invalidRecipe)).rejects.toThrow('Recipe validation failed');
  });

  it('should reject recipe with lactose ingredient (butter)', async () => {
    const invalidRecipe: CreateRecipeInput = {
      ...validRecipe,
      title: 'Lactose Recipe',
      ingredients: [
        {
          name: 'butter',
          quantity: 50,
          unit: 'g',
          dietaryProperties: ['contains-lactose'],
          optional: false,
          orderIndex: 1,
        },
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
      cookwareType: 'multi-pot' as unknown as CookwareType, // Invalid cookware type
    };

    await expect(createRecipe(invalidRecipe)).rejects.toThrow('Recipe validation failed');
  });

  it('should reject update with constraint violations', async () => {
    // First create a valid recipe
    const recipe = await createRecipe(validRecipe);

    // Try to update with invalid cooking time
    await expect(updateRecipe(recipe.id, { cookingTimeMinutes: 60 })).rejects.toThrow(
      'Recipe validation failed'
    );

    // Try to update with invalid servings
    await expect(updateRecipe(recipe.id, { servings: 3 })).rejects.toThrow(
      'Recipe validation failed'
    );

    // Try to update with gluten ingredient
    await expect(
      updateRecipe(recipe.id, {
        ingredients: [
          {
            name: 'wheat flour',
            quantity: 2,
            unit: 'cup',
            dietaryProperties: ['contains-gluten'],
            optional: false,
            orderIndex: 1,
          },
        ],
      })
    ).rejects.toThrow('Recipe validation failed');
  });

  it('should allow update that maintains validity', async () => {
    // First create a valid recipe
    const recipe = await createRecipe(validRecipe);

    // Update with valid changes
    const updated = await updateRecipe(recipe.id, {
      title: 'Updated Rice and Chicken',
      cookingTimeMinutes: 40, // Still within 30-45 range
      ingredients: [
        {
          name: 'brown rice',
          quantity: 1.5,
          unit: 'cup',
          dietaryProperties: ['none'],
          optional: false,
          orderIndex: 1,
        },
        {
          name: 'chicken breast',
          quantity: 250,
          unit: 'g',
          dietaryProperties: ['contains-meat'],
          optional: false,
          orderIndex: 2,
        },
      ],
    });

    expect(updated).not.toBeNull();
    expect(updated!.title).toBe('Updated Rice and Chicken');
    expect(updated!.cookingTimeMinutes).toBe(40);
    expect(updated!.ingredients).toHaveLength(2);
    expect(updated!.ingredients[0].name).toBe('brown rice');
  });
});
