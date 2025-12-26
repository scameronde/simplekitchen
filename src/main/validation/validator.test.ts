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
