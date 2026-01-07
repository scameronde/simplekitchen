import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createRecipe, getRecipes } from './recipes';
import { runMigrations, closeDatabase, rawDb } from '../index';
import type { CreateRecipeInput } from '../../../shared/types/recipe';

// Run migrations before each test to get a clean database
beforeEach(() => {
  runMigrations();
  // Clean all data between tests for proper test isolation
  rawDb.prepare('DELETE FROM ingredients').run();
  rawDb.prepare('DELETE FROM recipes').run();
});

// Close database after all tests
afterAll(() => {
  closeDatabase();
});

describe('Recipe Filtering - getRecipes()', () => {
  // Helper function to create test recipes with different attributes
  const createTestRecipe = (overrides: Partial<CreateRecipeInput> = {}): CreateRecipeInput => ({
    title: 'Test Recipe',
    cookingTimeMinutes: 30,
    prepTimeMinutes: 10,
    cookwareType: 'one-pot',
    servings: 2,
    dietaryTags: ['gluten-free', 'lactose-free'],
    seasonality: ['any'],
    sourceType: 'manual',
    instructions: 'Test instructions',
    ingredients: [
      {
        name: 'test ingredient',
        quantity: 100,
        unit: 'g',
        dietaryProperties: ['none'],
        optional: false,
        orderIndex: 1,
      },
    ],
    ...overrides,
  });

  describe('Total Time Filtering', () => {
    it('should filter by minimum total time', async () => {
      // Create recipes with different cooking times (all within 30-45 valid range)
      await createRecipe(createTestRecipe({ title: 'Quick Recipe', cookingTimeMinutes: 30 }));
      await createRecipe(createTestRecipe({ title: 'Medium Recipe', cookingTimeMinutes: 35 }));
      await createRecipe(createTestRecipe({ title: 'Slow Recipe', cookingTimeMinutes: 45 }));

      // Filter for recipes with total time >= 45 minutes
      const filtered = await getRecipes({ totalTimeMin: 45 });

      expect(filtered).toHaveLength(2);
      expect(filtered.every(r => r.totalTimeMinutes >= 45)).toBe(true);
      expect(filtered.some(r => r.title === 'Medium Recipe')).toBe(true);
      expect(filtered.some(r => r.title === 'Slow Recipe')).toBe(true);
      expect(filtered.some(r => r.title === 'Quick Recipe')).toBe(false);
    });

    it('should filter by maximum total time', async () => {
      // Create recipes with different cooking times (all within 30-45 valid range)
      await createRecipe(createTestRecipe({ title: 'Quick Recipe', cookingTimeMinutes: 30 }));
      await createRecipe(createTestRecipe({ title: 'Medium Recipe', cookingTimeMinutes: 35 }));
      await createRecipe(createTestRecipe({ title: 'Slow Recipe', cookingTimeMinutes: 45 }));

      // Filter for recipes with total time <= 45 minutes
      const filtered = await getRecipes({ totalTimeMax: 45 });

      expect(filtered).toHaveLength(2);
      expect(filtered.every(r => r.totalTimeMinutes <= 45)).toBe(true);
      expect(filtered.some(r => r.title === 'Quick Recipe')).toBe(true);
      expect(filtered.some(r => r.title === 'Medium Recipe')).toBe(true);
      expect(filtered.some(r => r.title === 'Slow Recipe')).toBe(false);
    });

    it('should filter by total time range', async () => {
      // Create recipes with different cooking times (all within 30-45 valid range)
      await createRecipe(createTestRecipe({ title: 'Quick Recipe', cookingTimeMinutes: 30 }));
      await createRecipe(createTestRecipe({ title: 'Medium Recipe 1', cookingTimeMinutes: 33 }));
      await createRecipe(createTestRecipe({ title: 'Medium Recipe 2', cookingTimeMinutes: 38 }));
      await createRecipe(createTestRecipe({ title: 'Slow Recipe', cookingTimeMinutes: 45 }));

      // Filter for recipes with total time between 43 and 48 minutes
      const filtered = await getRecipes({ totalTimeMin: 43, totalTimeMax: 48 });

      expect(filtered).toHaveLength(2);
      expect(filtered.every(r => r.totalTimeMinutes >= 43 && r.totalTimeMinutes <= 48)).toBe(true);
      expect(filtered.some(r => r.title === 'Medium Recipe 1')).toBe(true);
      expect(filtered.some(r => r.title === 'Medium Recipe 2')).toBe(true);
    });

    it('should handle edge case with exact total time match', async () => {
      await createRecipe(createTestRecipe({ title: 'Exact Match', cookingTimeMinutes: 35 }));
      await createRecipe(createTestRecipe({ title: 'Too Quick', cookingTimeMinutes: 30 }));
      await createRecipe(createTestRecipe({ title: 'Too Slow', cookingTimeMinutes: 40 }));

      const filtered = await getRecipes({ totalTimeMin: 45, totalTimeMax: 45 });

      expect(filtered).toHaveLength(1);
      expect(filtered[0]!.title).toBe('Exact Match');
      expect(filtered[0]!.totalTimeMinutes).toBe(45);
    });
  });

  describe('Cookware Type Filtering', () => {
    it('should filter by single cookware type', async () => {
      await createRecipe(createTestRecipe({ title: 'One Pot Meal', cookwareType: 'one-pot' }));
      await createRecipe(createTestRecipe({ title: 'One Pan Meal', cookwareType: 'one-pan' }));
      await createRecipe(createTestRecipe({ title: 'Oven Meal', cookwareType: 'oven' }));

      const filtered = await getRecipes({ cookwareTypes: ['one-pot'] });

      expect(filtered).toHaveLength(1);
      expect(filtered[0]!.title).toBe('One Pot Meal');
      expect(filtered[0]!.cookwareType).toBe('one-pot');
    });

    it('should filter by multiple cookware types', async () => {
      await createRecipe(createTestRecipe({ title: 'One Pot Meal', cookwareType: 'one-pot' }));
      await createRecipe(createTestRecipe({ title: 'One Pan Meal', cookwareType: 'one-pan' }));
      await createRecipe(createTestRecipe({ title: 'Oven Meal', cookwareType: 'oven' }));

      const filtered = await getRecipes({ cookwareTypes: ['one-pot', 'oven'] });

      expect(filtered).toHaveLength(2);
      expect(filtered.some(r => r.title === 'One Pot Meal')).toBe(true);
      expect(filtered.some(r => r.title === 'Oven Meal')).toBe(true);
      expect(filtered.every(r => ['one-pot', 'oven'].includes(r.cookwareType))).toBe(true);
    });

    it('should return empty array when no cookware types match', async () => {
      await createRecipe(createTestRecipe({ title: 'One Pot Meal', cookwareType: 'one-pot' }));
      await createRecipe(createTestRecipe({ title: 'One Pan Meal', cookwareType: 'one-pan' }));

      const filtered = await getRecipes({ cookwareTypes: ['oven'] });

      expect(filtered).toHaveLength(0);
    });
  });

  describe('Dietary Tags Filtering', () => {
    it('should filter by single dietary tag', async () => {
      await createRecipe(createTestRecipe({ title: 'GF Recipe', dietaryTags: ['gluten-free'] }));
      await createRecipe(
        createTestRecipe({ title: 'GF+LF Recipe', dietaryTags: ['gluten-free', 'lactose-free'] })
      );
      await createRecipe(createTestRecipe({ title: 'Vegan Recipe', dietaryTags: ['vegan'] }));

      const filtered = await getRecipes({ dietaryTags: ['gluten-free'] });

      expect(filtered).toHaveLength(2);
      expect(filtered.every(r => r.dietaryTags.includes('gluten-free'))).toBe(true);
      expect(filtered.some(r => r.title === 'GF Recipe')).toBe(true);
      expect(filtered.some(r => r.title === 'GF+LF Recipe')).toBe(true);
    });

    it('should filter by multiple dietary tags with AND logic', async () => {
      await createRecipe(
        createTestRecipe({
          title: 'GF Only',
          dietaryTags: ['gluten-free'],
        })
      );
      await createRecipe(
        createTestRecipe({
          title: 'LF Only',
          dietaryTags: ['lactose-free'],
        })
      );
      await createRecipe(
        createTestRecipe({
          title: 'GF+LF',
          dietaryTags: ['gluten-free', 'lactose-free'],
        })
      );
      await createRecipe(
        createTestRecipe({
          title: 'GF+LF+Veg',
          dietaryTags: ['gluten-free', 'lactose-free', 'vegetarian'],
        })
      );

      // Filter requires BOTH gluten-free AND lactose-free
      const filtered = await getRecipes({ dietaryTags: ['gluten-free', 'lactose-free'] });

      expect(filtered).toHaveLength(2);
      expect(
        filtered.every(
          r => r.dietaryTags.includes('gluten-free') && r.dietaryTags.includes('lactose-free')
        )
      ).toBe(true);
      expect(filtered.some(r => r.title === 'GF+LF')).toBe(true);
      expect(filtered.some(r => r.title === 'GF+LF+Veg')).toBe(true);
    });

    it('should handle dietary tags in different order', async () => {
      await createRecipe(
        createTestRecipe({
          title: 'Recipe 1',
          dietaryTags: ['gluten-free', 'lactose-free', 'vegetarian'],
        })
      );
      await createRecipe(
        createTestRecipe({
          title: 'Recipe 2',
          dietaryTags: ['vegetarian', 'gluten-free', 'lactose-free'],
        })
      );

      const filtered = await getRecipes({ dietaryTags: ['gluten-free', 'vegetarian'] });

      expect(filtered).toHaveLength(2);
      expect(
        filtered.every(
          r => r.dietaryTags.includes('gluten-free') && r.dietaryTags.includes('vegetarian')
        )
      ).toBe(true);
    });

    it('should return empty array when no recipes match all dietary tags', async () => {
      await createRecipe(
        createTestRecipe({
          title: 'GF Only',
          dietaryTags: ['gluten-free'],
        })
      );
      await createRecipe(
        createTestRecipe({
          title: 'Vegan Only',
          dietaryTags: ['vegan'],
        })
      );

      const filtered = await getRecipes({ dietaryTags: ['gluten-free', 'vegan'] });

      expect(filtered).toHaveLength(0);
    });
  });

  describe('Seasonality Filtering', () => {
    it('should filter by single season', async () => {
      await createRecipe(createTestRecipe({ title: 'Summer Salad', seasonality: ['summer'] }));
      await createRecipe(createTestRecipe({ title: 'Winter Stew', seasonality: ['winter'] }));
      await createRecipe(createTestRecipe({ title: 'Summer Pasta', seasonality: ['summer'] }));

      const filtered = await getRecipes({ seasonality: ['summer'] });

      expect(filtered).toHaveLength(2);
      expect(filtered.every(r => r.seasonality.includes('summer'))).toBe(true);
      expect(filtered.some(r => r.title === 'Summer Salad')).toBe(true);
      expect(filtered.some(r => r.title === 'Summer Pasta')).toBe(true);
    });

    it('should filter by multiple seasons with OR logic', async () => {
      await createRecipe(createTestRecipe({ title: 'Summer Salad', seasonality: ['summer'] }));
      await createRecipe(createTestRecipe({ title: 'Winter Stew', seasonality: ['winter'] }));
      await createRecipe(createTestRecipe({ title: 'Spring Soup', seasonality: ['spring'] }));
      await createRecipe(createTestRecipe({ title: 'Fall Harvest', seasonality: ['fall'] }));

      // Filter matches recipes with summer OR winter
      const filtered = await getRecipes({ seasonality: ['summer', 'winter'] });

      expect(filtered).toHaveLength(2);
      expect(filtered.some(r => r.title === 'Summer Salad')).toBe(true);
      expect(filtered.some(r => r.title === 'Winter Stew')).toBe(true);
    });

    it('should match recipes with "any" season when filtering by specific season', async () => {
      await createRecipe(createTestRecipe({ title: 'Anytime Meal', seasonality: ['any'] }));
      await createRecipe(createTestRecipe({ title: 'Summer Meal', seasonality: ['summer'] }));
      await createRecipe(createTestRecipe({ title: 'Winter Meal', seasonality: ['winter'] }));

      const filtered = await getRecipes({ seasonality: ['any'] });

      expect(filtered).toHaveLength(1);
      expect(filtered[0]!.title).toBe('Anytime Meal');
    });

    it('should handle multi-season recipes', async () => {
      await createRecipe(
        createTestRecipe({
          title: 'Multi-Season',
          seasonality: ['spring', 'summer', 'fall'],
        })
      );
      await createRecipe(
        createTestRecipe({
          title: 'Summer Only',
          seasonality: ['summer'],
        })
      );
      await createRecipe(
        createTestRecipe({
          title: 'Winter Only',
          seasonality: ['winter'],
        })
      );

      const filtered = await getRecipes({ seasonality: ['summer'] });

      expect(filtered).toHaveLength(2);
      expect(filtered.every(r => r.seasonality.includes('summer'))).toBe(true);
      expect(filtered.some(r => r.title === 'Multi-Season')).toBe(true);
      expect(filtered.some(r => r.title === 'Summer Only')).toBe(true);
    });
  });

  describe('Combined Filters', () => {
    it('should apply multiple filter criteria together', async () => {
      await createRecipe(
        createTestRecipe({
          title: 'Perfect Match',
          cookingTimeMinutes: 35,
          cookwareType: 'one-pot',
          dietaryTags: ['gluten-free', 'lactose-free'],
          seasonality: ['summer'],
        })
      );
      await createRecipe(
        createTestRecipe({
          title: 'Wrong Time',
          cookingTimeMinutes: 45,
          cookwareType: 'one-pot',
          dietaryTags: ['gluten-free', 'lactose-free'],
          seasonality: ['summer'],
        })
      );
      await createRecipe(
        createTestRecipe({
          title: 'Wrong Cookware',
          cookingTimeMinutes: 35,
          cookwareType: 'oven',
          dietaryTags: ['gluten-free', 'lactose-free'],
          seasonality: ['summer'],
        })
      );
      await createRecipe(
        createTestRecipe({
          title: 'Wrong Tags',
          cookingTimeMinutes: 35,
          cookwareType: 'one-pot',
          dietaryTags: ['vegan'],
          seasonality: ['summer'],
        })
      );

      const filtered = await getRecipes({
        totalTimeMin: 40,
        totalTimeMax: 50,
        cookwareTypes: ['one-pot'],
        dietaryTags: ['gluten-free', 'lactose-free'],
        seasonality: ['summer'],
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0]!.title).toBe('Perfect Match');
    });

    it('should combine time range with cookware filter', async () => {
      await createRecipe(
        createTestRecipe({
          title: 'Quick One-Pot',
          cookingTimeMinutes: 30,
          cookwareType: 'one-pot',
        })
      );
      await createRecipe(
        createTestRecipe({
          title: 'Quick One-Pan',
          cookingTimeMinutes: 32,
          cookwareType: 'one-pan',
        })
      );
      await createRecipe(
        createTestRecipe({
          title: 'Slow One-Pot',
          cookingTimeMinutes: 45,
          cookwareType: 'one-pot',
        })
      );

      const filtered = await getRecipes({
        totalTimeMax: 40,
        cookwareTypes: ['one-pot'],
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0]!.title).toBe('Quick One-Pot');
    });

    it('should combine dietary tags with seasonality filter', async () => {
      await createRecipe(
        createTestRecipe({
          title: 'Summer GF+LF',
          dietaryTags: ['gluten-free', 'lactose-free'],
          seasonality: ['summer'],
        })
      );
      await createRecipe(
        createTestRecipe({
          title: 'Winter GF+LF',
          dietaryTags: ['gluten-free', 'lactose-free'],
          seasonality: ['winter'],
        })
      );
      await createRecipe(
        createTestRecipe({
          title: 'Summer Vegan',
          dietaryTags: ['vegan'],
          seasonality: ['summer'],
        })
      );

      const filtered = await getRecipes({
        dietaryTags: ['gluten-free', 'lactose-free'],
        seasonality: ['summer'],
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0]!.title).toBe('Summer GF+LF');
    });
  });

  describe('Edge Cases', () => {
    it('should return all recipes when no filters applied', async () => {
      await createRecipe(createTestRecipe({ title: 'Recipe 1' }));
      await createRecipe(createTestRecipe({ title: 'Recipe 2' }));
      await createRecipe(createTestRecipe({ title: 'Recipe 3' }));

      const noFilterResults = await getRecipes();
      const emptyFilterResults = await getRecipes({});

      expect(noFilterResults).toHaveLength(3);
      expect(emptyFilterResults).toHaveLength(3);
    });

    it('should return empty array when no recipes match filters', async () => {
      await createRecipe(
        createTestRecipe({
          title: 'Recipe 1',
          cookingTimeMinutes: 30,
          cookwareType: 'one-pot',
        })
      );

      const filtered = await getRecipes({
        totalTimeMin: 40,
        cookwareTypes: ['oven'],
      });

      expect(filtered).toHaveLength(0);
    });

    it('should handle empty cookware types array', async () => {
      await createRecipe(createTestRecipe({ title: 'Recipe 1' }));
      await createRecipe(createTestRecipe({ title: 'Recipe 2' }));

      const filtered = await getRecipes({ cookwareTypes: [] });

      expect(filtered).toHaveLength(2);
    });

    it('should handle empty dietary tags array', async () => {
      await createRecipe(createTestRecipe({ title: 'Recipe 1' }));
      await createRecipe(createTestRecipe({ title: 'Recipe 2' }));

      const filtered = await getRecipes({ dietaryTags: [] });

      expect(filtered).toHaveLength(2);
    });

    it('should handle empty seasonality array', async () => {
      await createRecipe(createTestRecipe({ title: 'Recipe 1' }));
      await createRecipe(createTestRecipe({ title: 'Recipe 2' }));

      const filtered = await getRecipes({ seasonality: [] });

      expect(filtered).toHaveLength(2);
    });

    it('should handle total time filtering at lower boundary', async () => {
      await createRecipe(
        createTestRecipe({
          title: 'Minimum Time Recipe',
          cookingTimeMinutes: 30,
        })
      );
      await createRecipe(
        createTestRecipe({
          title: 'Longer Recipe',
          cookingTimeMinutes: 35,
        })
      );

      const filtered = await getRecipes({ totalTimeMax: 40 });

      expect(filtered).toHaveLength(1);
      expect(filtered[0]!.title).toBe('Minimum Time Recipe');
    });
  });

  describe('Recipe Ordering and Data Integrity', () => {
    it('should return recipes with all required fields populated', async () => {
      await createRecipe(
        createTestRecipe({
          title: 'Complete Recipe',
          cookingTimeMinutes: 30,
          prepTimeMinutes: 10,
          cookwareType: 'one-pot',
          servings: 2,
          dietaryTags: ['gluten-free', 'lactose-free'],
          seasonality: ['summer'],
          sourceType: 'manual',
          sourceReference: 'test-source',
          instructions: 'Test instructions',
        })
      );

      const filtered = await getRecipes({ cookwareTypes: ['one-pot'] });

      expect(filtered).toHaveLength(1);
      const recipe = filtered[0]!;

      // Verify all fields are present and correctly mapped
      expect(recipe.id).toBeDefined();
      expect(recipe.title).toBe('Complete Recipe');
      expect(recipe.cookingTimeMinutes).toBe(30);
      expect(recipe.prepTimeMinutes).toBe(10);
      expect(recipe.totalTimeMinutes).toBe(40);
      expect(recipe.cookwareType).toBe('one-pot');
      expect(recipe.servings).toBe(2);
      expect(recipe.dietaryTags).toEqual(['gluten-free', 'lactose-free']);
      expect(recipe.seasonality).toEqual(['summer']);
      expect(recipe.sourceType).toBe('manual');
      expect(recipe.sourceReference).toBe('test-source');
      expect(recipe.instructions).toBe('Test instructions');
      expect(recipe.ingredients).toHaveLength(1);
      expect(recipe.createdAt).toBeInstanceOf(Date);
      expect(recipe.updatedAt).toBeInstanceOf(Date);
    });

    it('should return recipes with ingredients populated', async () => {
      await createRecipe(
        createTestRecipe({
          title: 'Multi-Ingredient Recipe',
          ingredients: [
            {
              name: 'ingredient 1',
              quantity: 100,
              unit: 'g',
              dietaryProperties: ['none'],
              optional: false,
              orderIndex: 1,
            },
            {
              name: 'ingredient 2',
              quantity: 200,
              unit: 'ml',
              dietaryProperties: ['none'],
              optional: true,
              orderIndex: 2,
            },
          ],
        })
      );

      const filtered = await getRecipes();

      expect(filtered).toHaveLength(1);
      expect(filtered[0]!.ingredients).toHaveLength(2);
      expect(filtered[0]!.ingredients[0]!.name).toBe('ingredient 1');
      expect(filtered[0]!.ingredients[1]!.name).toBe('ingredient 2');
      expect(filtered[0]!.ingredients[1]!.optional).toBe(true);
    });

    it('should handle recipes with null optional fields', async () => {
      await createRecipe(
        createTestRecipe({
          title: 'Minimal Recipe',
          prepTimeMinutes: undefined,
          sourceReference: undefined,
          instructions: undefined,
        })
      );

      const filtered = await getRecipes();

      expect(filtered).toHaveLength(1);
      expect(filtered[0]!.prepTimeMinutes).toBeNull();
      expect(filtered[0]!.sourceReference).toBeNull();
      expect(filtered[0]!.instructions).toBeNull();
    });
  });

  describe('Source Type Filtering', () => {
    it('should filter by single source type', async () => {
      await createRecipe(createTestRecipe({ title: 'Manual Recipe', sourceType: 'manual' }));
      await createRecipe(createTestRecipe({ title: 'AI Recipe', sourceType: 'ai-generated' }));
      await createRecipe(createTestRecipe({ title: 'Web Recipe', sourceType: 'web-imported' }));

      const filtered = await getRecipes({ sourceTypes: ['manual'] });

      expect(filtered).toHaveLength(1);
      expect(filtered[0]!.title).toBe('Manual Recipe');
      expect(filtered[0]!.sourceType).toBe('manual');
    });

    it('should filter by multiple source types', async () => {
      await createRecipe(createTestRecipe({ title: 'Manual Recipe', sourceType: 'manual' }));
      await createRecipe(createTestRecipe({ title: 'AI Recipe', sourceType: 'ai-generated' }));
      await createRecipe(createTestRecipe({ title: 'Web Recipe', sourceType: 'web-imported' }));

      const filtered = await getRecipes({ sourceTypes: ['manual', 'ai-generated'] });

      expect(filtered).toHaveLength(2);
      expect(filtered.some(r => r.title === 'Manual Recipe')).toBe(true);
      expect(filtered.some(r => r.title === 'AI Recipe')).toBe(true);
    });
  });
});
