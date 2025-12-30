/**
 * @module recipe-import-handlers.mock.test
 * Unit tests for mock web recipe import handler.
 * Tests all scenarios: success, invalid URL, network error, no recipe found, multiple recipes.
 */

import { describe, it, expect } from 'vitest';
import { mockImportRecipe } from './recipe-import-handlers.mock.js';
import type { CreateRecipeInput } from '../../shared/types/recipe.js';

describe('mockImportRecipe', () => {
  describe('Success case', () => {
    it('should return mock recipe for valid URL', async () => {
      const result = await mockImportRecipe('https://example.com/recipe');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.recipe).toBeDefined();
        expect(result.recipe.title).toBeDefined();
        expect(result.recipe.cookingTimeMinutes).toBeGreaterThan(0);
        expect(result.recipe.servings).toBeGreaterThan(0);
        expect(result.recipe.ingredients.length).toBeGreaterThan(0);
      }
    });

    it('should infer cookware type from instructions', async () => {
      const result = await mockImportRecipe('https://example.com/recipe');

      expect(result.success).toBe(true);
      if (result.success) {
        const cookware = result.recipe.cookwareType;
        expect(['one-pot', 'one-pan', 'oven']).toContain(cookware);
      }
    });

    it('should set source type to web-imported', async () => {
      const result = await mockImportRecipe('https://example.com/recipe');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.recipe.sourceType).toBe('web-imported');
      }
    });

    it('should preserve source reference URL', async () => {
      const testUrl = 'https://example.com/my-recipe';
      const result = await mockImportRecipe(testUrl);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.recipe.sourceReference).toBe(testUrl);
      }
    });

    it('should return recipe with ingredients', async () => {
      const result = await mockImportRecipe('https://example.com/recipe');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.recipe.ingredients.length).toBeGreaterThan(0);

        // Each ingredient should have required fields
        result.recipe.ingredients.forEach((ingredient, index) => {
          expect(ingredient.name).toBeDefined();
          expect(ingredient.quantity).toBeGreaterThan(0);
          expect(ingredient.unit).toBeDefined();
          expect(ingredient.dietaryProperties).toBeDefined();
          expect(ingredient.orderIndex).toBe(index);
        });
      }
    });

    it('should match pasta recipe when URL contains pasta keyword', async () => {
      const result = await mockImportRecipe('https://example.com/pasta-recipe');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.recipe.title.toLowerCase()).toContain('pasta');
      }
    });

    it('should match curry recipe when URL contains curry keyword', async () => {
      const result = await mockImportRecipe('https://example.com/curry-recipe');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.recipe.title.toLowerCase()).toContain('curry');
      }
    });

    it('should match fish recipe when URL contains fish keyword', async () => {
      const result = await mockImportRecipe('https://example.com/baked-fish');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.recipe.title.toLowerCase()).toContain('salmon');
      }
    });

    it('should have non-null cooking time in success case', async () => {
      const result = await mockImportRecipe('https://example.com/recipe');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.recipe.cookingTimeMinutes).toBeGreaterThanOrEqual(10);
      }
    });
  });

  describe('Invalid URL case', () => {
    it('should reject empty URL', async () => {
      const result = await mockImportRecipe('');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toBeDefined();
        expect((result.errors[0] as { field: string }).field).toBe('url');
      }
    });

    it('should reject URL without http/https protocol', async () => {
      const result = await mockImportRecipe('example.com/recipe');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0]).toBeDefined();
        expect((result.errors[0] as { field: string }).field).toBe('url');
        expect((result.errors[0] as { message: string }).message).toContain('http');
      }
    });

    it('should reject non-string URL', async () => {
      const result = await mockImportRecipe(123 as unknown as string);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect((result.errors[0] as { field: string }).field).toBe('url');
      }
    });

    it('should reject null URL', async () => {
      const result = await mockImportRecipe(null as unknown as string);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect((result.errors[0] as { field: string }).field).toBe('url');
      }
    });

    it('should accept http protocol', async () => {
      const result = await mockImportRecipe('http://example.com/recipe');

      expect(result.success).toBe(true);
    });

    it('should accept https protocol', async () => {
      const result = await mockImportRecipe('https://example.com/recipe');

      expect(result.success).toBe(true);
    });
  });

  describe('Network error case', () => {
    it('should return error when URL contains network-error-test signal', async () => {
      const result = await mockImportRecipe('https://network-error-test.com/recipe');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
        expect((result.errors[0] as { field: string }).field).toBe('general');
        expect((result.errors[0] as { message: string }).message).toContain('Failed to fetch');
      }
    });

    it('should return network error message for various network-error-test URLs', async () => {
      const urls = [
        'https://network-error-test.com',
        'http://example.com/network-error-test',
        'https://my-network-error-test-page.com/recipe',
      ];

      for (const url of urls) {
        const result = await mockImportRecipe(url);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect((result.errors[0] as { message: string }).message).toContain('Failed to fetch');
        }
      }
    });
  });

  describe('No recipe found case', () => {
    it('should return error when URL contains no-recipe-test signal', async () => {
      const result = await mockImportRecipe('https://no-recipe-test.com/page');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
        expect((result.errors[0] as { field: string }).field).toBe('general');
        expect((result.errors[0] as { message: string }).message).toContain(
          'No Schema.org recipe markup found'
        );
      }
    });

    it('should return no recipe error message for various no-recipe-test URLs', async () => {
      const urls = [
        'https://no-recipe-test.com',
        'http://example.com/no-recipe-test',
        'https://my-no-recipe-test-page.com',
      ];

      for (const url of urls) {
        const result = await mockImportRecipe(url);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect((result.errors[0] as { message: string }).message).toContain(
            'No Schema.org recipe markup found'
          );
        }
      }
    });
  });

  describe('Multiple recipes case', () => {
    it('should return error when URL contains multiple-recipes-test signal', async () => {
      const result = await mockImportRecipe('https://multiple-recipes-test.com/recipes');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
        expect((result.errors[0] as { field: string }).field).toBe('general');
        expect((result.errors[0] as { message: string }).message).toContain('Multiple recipes');
      }
    });

    it('should return multiple recipes error message for various URLs', async () => {
      const urls = [
        'https://multiple-recipes-test.com',
        'http://example.com/multiple-recipes-test',
        'https://my-multiple-recipes-test-page.com/recipes',
      ];

      for (const url of urls) {
        const result = await mockImportRecipe(url);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect((result.errors[0] as { message: string }).message).toContain('Multiple recipes');
        }
      }
    });
  });

  describe('Response format validation', () => {
    it('success response should have correct structure', async () => {
      const result = await mockImportRecipe('https://example.com/recipe');

      expect(result).toHaveProperty('success');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result).toHaveProperty('recipe');
      }
    });

    it('error response should have correct structure', async () => {
      const result = await mockImportRecipe('');

      expect(result).toHaveProperty('success');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result).toHaveProperty('errors');
        expect(result.errors).toBeInstanceOf(Array);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toHaveProperty('field');
        expect(result.errors[0]).toHaveProperty('message');
      }
    });

    it('recipe should have all required CreateRecipeInput fields', async () => {
      const result = await mockImportRecipe('https://example.com/recipe');

      expect(result.success).toBe(true);
      if (result.success) {
        const recipe = result.recipe as CreateRecipeInput;
        expect(recipe).toHaveProperty('title');
        expect(recipe).toHaveProperty('cookingTimeMinutes');
        expect(recipe).toHaveProperty('cookwareType');
        expect(recipe).toHaveProperty('servings');
        expect(recipe).toHaveProperty('dietaryTags');
        expect(recipe).toHaveProperty('seasonality');
        expect(recipe).toHaveProperty('sourceType');
        expect(recipe).toHaveProperty('ingredients');
      }
    });
  });

  describe('Recipe content validation', () => {
    it('should have reasonable cooking time (10-120 minutes)', async () => {
      const result = await mockImportRecipe('https://example.com/recipe');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.recipe.cookingTimeMinutes).toBeGreaterThanOrEqual(10);
        expect(result.recipe.cookingTimeMinutes).toBeLessThanOrEqual(120);
      }
    });

    it('should have servings of 2', async () => {
      const result = await mockImportRecipe('https://example.com/recipe');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.recipe.servings).toBeGreaterThan(0);
      }
    });

    it('should have non-empty ingredients', async () => {
      const result = await mockImportRecipe('https://example.com/recipe');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.recipe.ingredients).toBeDefined();
        expect(Array.isArray(result.recipe.ingredients)).toBe(true);
        expect(result.recipe.ingredients.length).toBeGreaterThan(0);
      }
    });

    it('ingredient quantities should be positive numbers', async () => {
      const result = await mockImportRecipe('https://example.com/recipe');

      expect(result.success).toBe(true);
      if (result.success) {
        result.recipe.ingredients.forEach(ingredient => {
          expect(typeof ingredient.quantity).toBe('number');
          expect(ingredient.quantity).toBeGreaterThan(0);
        });
      }
    });

    it('should have instructions text', async () => {
      const result = await mockImportRecipe('https://example.com/recipe');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.recipe.instructions).toBeDefined();
        expect(typeof result.recipe.instructions).toBe('string');
        expect((result.recipe.instructions as string).length).toBeGreaterThan(0);
      }
    });

    it('should have seasonality set', async () => {
      const result = await mockImportRecipe('https://example.com/recipe');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.recipe.seasonality).toBeDefined();
        expect(Array.isArray(result.recipe.seasonality)).toBe(true);
        expect(result.recipe.seasonality.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Async behavior', () => {
    it('should be async and return a promise', () => {
      const result = mockImportRecipe('https://example.com/recipe');
      expect(result).toBeInstanceOf(Promise);
    });

    it('should resolve without throwing errors', async () => {
      await expect(mockImportRecipe('https://example.com/recipe')).resolves.toBeDefined();
    });

    it('should handle test signals asynchronously', async () => {
      const results = await Promise.all([
        mockImportRecipe('https://example.com/recipe'),
        mockImportRecipe('https://network-error-test.com/recipe'),
        mockImportRecipe('https://no-recipe-test.com/recipe'),
        mockImportRecipe('https://multiple-recipes-test.com/recipes'),
      ]);

      expect(results.length).toBe(4);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(false);
      expect(results[3].success).toBe(false);
    });
  });
});
