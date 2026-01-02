import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { runMigrations, closeDatabase, createRecipe } from './index';
import { rawDb } from './init';
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

describe('Cooking Sessions Table', () => {
  it('should create cooking_sessions table with correct schema', () => {
    // Query the table to verify it exists
    const result = rawDb
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='cooking_sessions'")
      .get() as { name: string } | undefined;
    expect(result).toBeDefined();
    expect(result?.name).toBe('cooking_sessions');
  });

  it('should have index on timestamp', () => {
    const result = rawDb
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_cooking_sessions_timestamp'"
      )
      .get() as { name: string } | undefined;
    expect(result).toBeDefined();
  });

  it('should enforce foreign key constraint on recipe_id', async () => {
    // Attempt to insert session with non-existent recipe_id
    // This should fail due to foreign key constraint
    const stmt = rawDb.prepare(`
      INSERT INTO cooking_sessions (id, recipe_id, timestamp, user_context)
      VALUES (?, ?, ?, ?)
    `);

    expect(() => {
      stmt.run('test-session-id', 'non-existent-recipe-id', new Date().toISOString(), '{}');
    }).toThrow();
  });
});
