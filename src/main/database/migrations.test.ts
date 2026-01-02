import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { runMigrations, closeDatabase, createRecipe } from './index';
import type { CreateRecipeInput } from '../../shared/types/recipe';

beforeEach(() => {
  runMigrations();
});

afterAll(() => {
  closeDatabase();
});

describe('Database Schema Constraints', () => {
  const validRecipe: CreateRecipeInput = {
    title: 'Valid Recipe',
    cookingTimeMinutes: 35,
    cookwareType: 'one-pot',
    servings: 2,
    dietaryTags: [],
    seasonality: ['any'],
    sourceType: 'manual',
    ingredients: [],
  };

  it('should reject negative cooking time', async () => {
    await expect(createRecipe({ ...validRecipe, cookingTimeMinutes: -1 })).rejects.toThrow();
  });

  it('should reject cooking time above 60 minutes', async () => {
    await expect(createRecipe({ ...validRecipe, cookingTimeMinutes: 65 })).rejects.toThrow();
  });

  it('should reject servings not equal to 2', async () => {
    await expect(createRecipe({ ...validRecipe, servings: 4 })).rejects.toThrow();
  });

  it('should reject invalid cookware type', async () => {
    await expect(
      // @ts-expect-error Testing invalid value
      createRecipe({ ...validRecipe, cookwareType: 'multi-pot' })
    ).rejects.toThrow();
  });

  it('should reject invalid source type', async () => {
    await expect(
      // @ts-expect-error Testing invalid value
      createRecipe({ ...validRecipe, sourceType: 'unknown' })
    ).rejects.toThrow();
  });

  it('should accept valid recipe within constraints', async () => {
    const recipe = await createRecipe(validRecipe);
    expect(recipe.id).toBeDefined();
  });
});
