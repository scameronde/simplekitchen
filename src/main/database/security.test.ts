import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createRecipe, getRecipes, deleteRecipe, getRecipeById } from './dal/recipes.js';
import { runMigrations, closeDatabase } from './index.js';
import type { CreateRecipeInput } from '../../shared/types/recipe.js';

// Run migrations before each test to ensure clean state
beforeEach(() => {
  runMigrations();
});

// Close database after all tests
afterAll(() => {
  closeDatabase();
});

describe('SQL Injection Prevention', () => {
  // Base valid recipe for testing
  const baseRecipe: CreateRecipeInput = {
    title: 'Safe Recipe',
    cookingTimeMinutes: 30,
    prepTimeMinutes: 10,
    cookwareType: 'one-pot',
    servings: 2,
    dietaryTags: ['gluten-free'],
    seasonality: ['any'],
    sourceType: 'manual',
    instructions: 'Cook normally.',
    ingredients: [
      {
        name: 'rice',
        quantity: 1,
        unit: 'cup',
        dietaryProperties: ['none'],
        optional: false,
        orderIndex: 1,
      },
    ],
  };

  it('should prevent SQL injection via recipe title', async () => {
    const maliciousInput: CreateRecipeInput = {
      ...baseRecipe,
      title: "Recipe'; DROP TABLE recipes; --",
    };

    const recipe = await createRecipe(maliciousInput);
    expect(recipe).toBeDefined();
    expect(recipe.id).toBeDefined();

    // Verify recipes table still exists and contains data
    const allRecipes = await getRecipes();
    expect(allRecipes.length).toBeGreaterThan(0);

    // Verify title is stored literally (no SQL execution)
    expect(recipe.title).toBe("Recipe'; DROP TABLE recipes; --");

    // Verify we can retrieve the recipe by ID
    const retrieved = await getRecipeById(recipe.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.title).toBe("Recipe'; DROP TABLE recipes; --");
  });

  it('should prevent SQL injection via ingredient name', async () => {
    const maliciousInput: CreateRecipeInput = {
      ...baseRecipe,
      ingredients: [
        {
          name: "chicken' OR '1'='1",
          quantity: 500,
          unit: 'g',
          dietaryProperties: ['contains-meat'],
          optional: false,
          orderIndex: 1,
        },
      ],
    };

    const recipe = await createRecipe(maliciousInput);
    expect(recipe).toBeDefined();
    expect(recipe.ingredients).toHaveLength(1);

    // Verify ingredient name is stored literally (no SQL execution)
    expect(recipe.ingredients[0]!.name).toBe("chicken' OR '1'='1");

    // Verify no data leakage - only this recipe should be returned
    const allRecipes = await getRecipes();
    const matchingRecipe = allRecipes.find(r => r.id === recipe.id);
    expect(matchingRecipe).toBeDefined();
    expect(matchingRecipe!.ingredients[0]!.name).toBe("chicken' OR '1'='1");
  });

  it('should prevent SQL injection via search query (dietary tags filter)', async () => {
    // Create a normal recipe first
    const normalRecipe = await createRecipe(baseRecipe);

    // Attempt SQL injection through dietary tags filter
    const maliciousFilter = {
      dietaryTags: ["gluten-free' UNION SELECT * FROM dietary_profile--"] as any,
    };

    // This should either return no results or handle the malicious input safely
    const results = await getRecipes(maliciousFilter);

    // Verify no data leak occurred
    // The malicious tag won't match any real tags, so should return empty or handle safely
    // Most importantly, it shouldn't leak data from dietary_profile table
    expect(Array.isArray(results)).toBe(true);

    // Verify the normal recipe still exists (no table corruption)
    const normalRecipeCheck = await getRecipeById(normalRecipe.id);
    expect(normalRecipeCheck).not.toBeNull();
  });

  it('should prevent SQL injection via instructions field', async () => {
    const maliciousInput: CreateRecipeInput = {
      ...baseRecipe,
      instructions: "1. Cook rice; DELETE FROM recipes WHERE '1'='1'; --",
    };

    const recipe = await createRecipe(maliciousInput);
    expect(recipe).toBeDefined();

    // Verify instructions are stored literally
    expect(recipe.instructions).toBe("1. Cook rice; DELETE FROM recipes WHERE '1'='1'; --");

    // Verify recipes table still has data
    const allRecipes = await getRecipes();
    expect(allRecipes.length).toBeGreaterThan(0);

    // Verify we can still retrieve recipes
    const retrieved = await getRecipeById(recipe.id);
    expect(retrieved).not.toBeNull();
  });

  it('should prevent SQL injection via source reference field', async () => {
    const maliciousInput: CreateRecipeInput = {
      ...baseRecipe,
      sourceReference: "https://example.com'; DROP TABLE ingredients; --",
    };

    const recipe = await createRecipe(maliciousInput);
    expect(recipe).toBeDefined();

    // Verify source reference is stored literally
    expect(recipe.sourceReference).toBe("https://example.com'; DROP TABLE ingredients; --");

    // Verify ingredients table still exists
    expect(recipe.ingredients).toHaveLength(1);

    // Verify ingredients table is functional
    const retrieved = await getRecipeById(recipe.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.ingredients).toHaveLength(1);
  });

  it('should handle numeric field type validation (reject string injection)', async () => {
    const maliciousInput = {
      ...baseRecipe,
      cookingTimeMinutes: '45; DELETE FROM recipes;' as any, // Type coercion attempt
    };

    // This should either:
    // 1. Be caught by TypeScript at compile time (type safety)
    // 2. Be rejected by validation if it gets through
    // 3. Be coerced to NaN and fail validation
    await expect(createRecipe(maliciousInput)).rejects.toThrow();
  });

  it('should store array fields as JSON (prevent injection in dietary tags)', async () => {
    const maliciousInput: CreateRecipeInput = {
      ...baseRecipe,
      dietaryTags: ["gluten-free'); DROP TABLE ingredients;--"] as any,
    };

    const recipe = await createRecipe(maliciousInput);
    expect(recipe).toBeDefined();

    // Verify dietary tags are stored as JSON array
    expect(Array.isArray(recipe.dietaryTags)).toBe(true);
    expect(recipe.dietaryTags[0]).toBe("gluten-free'); DROP TABLE ingredients;--");

    // Verify ingredients table still exists
    expect(recipe.ingredients).toHaveLength(1);

    // Verify we can still create more recipes with ingredients
    const normalRecipe = await createRecipe(baseRecipe);
    expect(normalRecipe.ingredients).toHaveLength(1);
  });

  it('should store array fields as JSON (prevent injection in seasonality)', async () => {
    const maliciousInput: CreateRecipeInput = {
      ...baseRecipe,
      seasonality: ["any'; DELETE FROM recipes WHERE id='"] as any,
    };

    const recipe = await createRecipe(maliciousInput);
    expect(recipe).toBeDefined();

    // Verify seasonality is stored as JSON array
    expect(Array.isArray(recipe.seasonality)).toBe(true);
    expect(recipe.seasonality[0]).toBe("any'; DELETE FROM recipes WHERE id='");

    // Verify recipes table still has data
    const allRecipes = await getRecipes();
    expect(allRecipes.length).toBeGreaterThan(0);
  });

  it('should prevent SQL injection in ingredient unit field', async () => {
    const maliciousInput: CreateRecipeInput = {
      ...baseRecipe,
      ingredients: [
        {
          name: 'rice',
          quantity: 1,
          unit: "cup'; DROP TABLE recipes; --",
          dietaryProperties: ['none'],
          optional: false,
          orderIndex: 1,
        },
      ],
    };

    const recipe = await createRecipe(maliciousInput);
    expect(recipe).toBeDefined();

    // Verify unit is stored literally
    expect(recipe.ingredients[0]!.unit).toBe("cup'; DROP TABLE recipes; --");

    // Verify recipes table still exists
    const allRecipes = await getRecipes();
    expect(allRecipes.length).toBeGreaterThan(0);
  });

  it('should prevent SQL injection in ingredient dietary properties', async () => {
    const maliciousInput: CreateRecipeInput = {
      ...baseRecipe,
      ingredients: [
        {
          name: 'mystery meat',
          quantity: 500,
          unit: 'g',
          dietaryProperties: ["none'); DELETE FROM dietary_profile WHERE ('1'='1"] as any,
          optional: false,
          orderIndex: 1,
        },
      ],
    };

    const recipe = await createRecipe(maliciousInput);
    expect(recipe).toBeDefined();

    // Verify dietary properties are stored as JSON
    expect(Array.isArray(recipe.ingredients[0]!.dietaryProperties)).toBe(true);
    expect(recipe.ingredients[0]!.dietaryProperties[0]).toBe(
      "none'); DELETE FROM dietary_profile WHERE ('1'='1"
    );

    // Verify we can still query recipes
    const allRecipes = await getRecipes();
    expect(allRecipes.length).toBeGreaterThan(0);
  });

  it('should prevent SQL injection via recipe ID in getRecipeById', async () => {
    const normalRecipe = await createRecipe(baseRecipe);

    // Attempt SQL injection through ID parameter
    const maliciousId = "' OR '1'='1";
    const result = await getRecipeById(maliciousId);

    // Should return null (no match) rather than returning all recipes or causing error
    expect(result).toBeNull();

    // Verify the normal recipe is still intact
    const validResult = await getRecipeById(normalRecipe.id);
    expect(validResult).not.toBeNull();
    expect(validResult!.id).toBe(normalRecipe.id);
  });

  it('should prevent SQL injection via recipe ID in deleteRecipe', async () => {
    const recipe1 = await createRecipe({ ...baseRecipe, title: 'Recipe 1' });
    const recipe2 = await createRecipe({ ...baseRecipe, title: 'Recipe 2' });

    // Attempt SQL injection to delete all recipes
    const maliciousId = "' OR '1'='1";
    await deleteRecipe(maliciousId);

    // Verify both recipes still exist (the key security check)
    // The malicious ID should not match any real ID, so nothing is deleted
    const check1 = await getRecipeById(recipe1.id);
    const check2 = await getRecipeById(recipe2.id);
    expect(check1).not.toBeNull();
    expect(check2).not.toBeNull();
    expect(check1!.title).toBe('Recipe 1');
    expect(check2!.title).toBe('Recipe 2');
  });

  it('should handle multiple injection attempts in single recipe', async () => {
    const multiMaliciousInput: CreateRecipeInput = {
      title: "Evil Recipe'; DROP TABLE recipes; --",
      cookingTimeMinutes: 30,
      prepTimeMinutes: 10,
      cookwareType: 'one-pot',
      servings: 2,
      dietaryTags: ["gluten-free'); DELETE FROM ingredients;--"] as any,
      seasonality: ["any'; DROP DATABASE;--"] as any,
      sourceType: 'manual',
      sourceReference: "https://evil.com'; UNION SELECT * FROM dietary_profile--",
      instructions: "Step 1'; DELETE FROM recipes WHERE '1'='1",
      ingredients: [
        {
          name: "ingredient' OR '1'='1",
          quantity: 1,
          unit: "cup'; DROP TABLE recipes;--",
          dietaryProperties: ["none'); DELETE FROM dietary_profile;--"] as any,
          optional: false,
          orderIndex: 1,
        },
      ],
    };

    const recipe = await createRecipe(multiMaliciousInput);
    expect(recipe).toBeDefined();

    // Verify all fields are stored literally
    expect(recipe.title).toBe("Evil Recipe'; DROP TABLE recipes; --");
    expect(recipe.dietaryTags[0]).toBe("gluten-free'); DELETE FROM ingredients;--");
    expect(recipe.seasonality[0]).toBe("any'; DROP DATABASE;--");
    expect(recipe.sourceReference).toBe("https://evil.com'; UNION SELECT * FROM dietary_profile--");
    expect(recipe.instructions).toBe("Step 1'; DELETE FROM recipes WHERE '1'='1");
    expect(recipe.ingredients[0]!.name).toBe("ingredient' OR '1'='1");
    expect(recipe.ingredients[0]!.unit).toBe("cup'; DROP TABLE recipes;--");
    expect(recipe.ingredients[0]!.dietaryProperties[0]).toBe(
      "none'); DELETE FROM dietary_profile;--"
    );

    // Verify all tables still exist and are functional
    const allRecipes = await getRecipes();
    expect(allRecipes.length).toBeGreaterThan(0);

    // Verify we can create another recipe
    const normalRecipe = await createRecipe(baseRecipe);
    expect(normalRecipe).toBeDefined();
    expect(normalRecipe.ingredients).toHaveLength(1);
  });
});
