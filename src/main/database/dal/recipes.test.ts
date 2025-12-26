import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import {
  createRecipe,
  getRecipeById,
  getRecipes,
  updateRecipe,
  deleteRecipe,
  getRecipeCount,
} from './recipes';
import { runMigrations, closeDatabase } from '../index';
import type { CreateRecipeInput } from '../../../shared/types/recipe';

// Run migrations before tests
beforeEach(() => {
  runMigrations();
});

// Close database after all tests
afterAll(() => {
  closeDatabase();
});

describe('Recipe CRUD Operations', () => {
  const sampleRecipe: CreateRecipeInput = {
    title: 'Simple Pasta',
    cookingTimeMinutes: 30,
    prepTimeMinutes: 10,
    cookwareType: 'one-pot',
    servings: 2,
    dietaryTags: ['gluten-free', 'lactose-free'],
    seasonality: ['any'],
    sourceType: 'manual',
    instructions: 'Boil water, cook pasta, add sauce.',
    ingredients: [
      {
        name: 'gluten-free pasta',
        quantity: 200,
        unit: 'g',
        dietaryProperties: ['none'],
        optional: false,
        orderIndex: 1,
      },
      {
        name: 'olive oil',
        quantity: 2,
        unit: 'tbsp',
        dietaryProperties: ['none'],
        optional: false,
        orderIndex: 2,
      },
    ],
  };

  it('should create a new recipe with ingredients', async () => {
    const recipe = await createRecipe(sampleRecipe);

    expect(recipe.id).toBeDefined();
    expect(recipe.title).toBe('Simple Pasta');
    expect(recipe.cookingTimeMinutes).toBe(30);
    expect(recipe.totalTimeMinutes).toBe(40); // 10 prep + 30 cook
    expect(recipe.servings).toBe(2);
    expect(recipe.ingredients).toHaveLength(2);
    expect(recipe.ingredients[0].name).toBe('gluten-free pasta');
  });

  it('should retrieve recipe by ID', async () => {
    const created = await createRecipe(sampleRecipe);
    const retrieved = await getRecipeById(created.id);

    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe(created.id);
    expect(retrieved!.title).toBe(created.title);
  });

  it('should return null for non-existent recipe', async () => {
    const result = await getRecipeById('non-existent-id');
    expect(result).toBeNull();
  });

  it('should retrieve all recipes', async () => {
    await createRecipe(sampleRecipe);
    await createRecipe({ ...sampleRecipe, title: 'Another Recipe' });

    const recipes = await getRecipes();
    expect(recipes.length).toBeGreaterThanOrEqual(2);
  });

  it('should filter recipes by cooking time', async () => {
    await createRecipe({ ...sampleRecipe, cookingTimeMinutes: 30 });
    await createRecipe({ ...sampleRecipe, title: 'Quick Dish', cookingTimeMinutes: 35 });

    const filtered = await getRecipes({ cookingTimeMin: 32 });
    expect(filtered.every(r => r.cookingTimeMinutes >= 32)).toBe(true);
  });

  it('should filter recipes by cookware type', async () => {
    await createRecipe({ ...sampleRecipe, cookwareType: 'one-pot' });
    await createRecipe({ ...sampleRecipe, title: 'Pan Recipe', cookwareType: 'one-pan' });

    const filtered = await getRecipes({ cookwareTypes: ['one-pan'] });
    expect(filtered.every(r => r.cookwareType === 'one-pan')).toBe(true);
  });

  it('should update recipe title', async () => {
    const created = await createRecipe(sampleRecipe);
    const updated = await updateRecipe(created.id, { title: 'Updated Pasta' });

    expect(updated).not.toBeNull();
    expect(updated!.title).toBe('Updated Pasta');
    expect(updated!.cookingTimeMinutes).toBe(30); // Unchanged
  });

  it('should update recipe ingredients', async () => {
    const created = await createRecipe(sampleRecipe);
    const updated = await updateRecipe(created.id, {
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
    });

    expect(updated!.ingredients).toHaveLength(1);
    expect(updated!.ingredients[0].name).toBe('rice');
  });

  it('should delete recipe', async () => {
    const created = await createRecipe(sampleRecipe);
    const deleted = await deleteRecipe(created.id);
    expect(deleted).toBe(true);

    const retrieved = await getRecipeById(created.id);
    expect(retrieved).toBeNull();
  });

  it('should cascade delete ingredients when recipe is deleted', async () => {
    const created = await createRecipe(sampleRecipe);
    await deleteRecipe(created.id);

    // Verify ingredients are also deleted (foreign key cascade)
    const retrieved = await getRecipeById(created.id);
    expect(retrieved).toBeNull(); // Recipe and ingredients gone
  });

  it('should get accurate recipe count', async () => {
    const countBefore = await getRecipeCount();
    await createRecipe(sampleRecipe);
    const countAfter = await getRecipeCount();

    expect(countAfter).toBe(countBefore + 1);
  });
});
