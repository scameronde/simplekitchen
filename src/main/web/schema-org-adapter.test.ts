/**
 * @module schema-org-adapter.test
 * Unit tests for Schema.org Recipe adapter
 * Tests conversion from Schema.org JSON-LD format to CreateRecipeInput format
 */

import { describe, it, expect } from 'vitest';
import { schemaOrgToRecipeInput } from './schema-org-adapter.js';
import type { SchemaOrgRecipe, SchemaOrgHowToStep } from '../../shared/types/schema-org.js';

describe('SchemaOrgAdapter', () => {
  // Sample test data from PLAN specification
  const sampleSchemaRecipe: SchemaOrgRecipe = {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: 'Quick Chicken Stir-Fry',
    cookTime: 'PT30M',
    prepTime: 'PT15M',
    recipeYield: '2 servings',
    recipeIngredient: ['1 lb chicken breast', '2 tbsp olive oil', '1 cup broccoli florets'],
    recipeInstructions: 'Cook chicken, add vegetables, serve.',
    suitableForDiet: ['https://schema.org/GlutenFreeDiet'],
    url: 'https://example.com/recipe/123',
  };

  describe('Complete Schema.org recipe conversion', () => {
    it('should convert complete Schema.org recipe to valid CreateRecipeInput', () => {
      const result = schemaOrgToRecipeInput(sampleSchemaRecipe, 'https://example.com/recipe/123');

      // Verify required fields
      expect(result.title).toBe('Quick Chicken Stir-Fry');
      expect(result.cookingTimeMinutes).toBe(30);
      expect(result.prepTimeMinutes).toBe(15);
      expect(result.servings).toBe(2);
      expect(result.cookwareType).toBe('one-pan');
      expect(result.sourceType).toBe('web-imported');
      expect(result.sourceReference).toBe('https://example.com/recipe/123');

      // Verify ingredients
      expect(result.ingredients).toHaveLength(3);
      expect(result.ingredients[0]!.name).toBe('chicken breast');
      expect(result.ingredients[0]!.quantity).toBe(1);
      expect(result.ingredients[0]!.unit).toBe('lb');

      // Verify dietary tags
      expect(result.dietaryTags).toContain('gluten-free');

      // Verify instructions
      expect(result.instructions).toBe('Cook chicken, add vegetables, serve.');

      // Verify defaults
      expect(result.seasonality).toEqual(['any']);
    });
  });

  describe('Optional fields handling', () => {
    it('should use defaults for missing prepTime', () => {
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Simple Recipe',
        cookTime: 'PT20M',
        recipeIngredient: ['ingredient 1'],
      };

      const result = schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/1');
      expect(result.prepTimeMinutes).toBeUndefined();
    });

    it('should use default cooking time if cookTime is missing', () => {
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Simple Recipe',
        recipeIngredient: ['ingredient 1'],
      };

      const result = schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/1');
      expect(result.cookingTimeMinutes).toBe(30);
    });

    it('should handle missing description gracefully', () => {
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Recipe Without Description',
        cookTime: 'PT30M',
        recipeIngredient: ['ingredient 1'],
      };

      const result = schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/1');
      expect(result.title).toBe('Recipe Without Description');
    });

    it('should handle missing instructions', () => {
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Recipe Without Instructions',
        cookTime: 'PT30M',
        recipeIngredient: ['ingredient 1'],
      };

      const result = schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/1');
      expect(result.instructions).toBeUndefined();
    });
  });

  describe('ISO 8601 duration parsing', () => {
    it('should parse PT30M as 30 minutes', () => {
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Test Recipe',
        cookTime: 'PT30M',
        recipeIngredient: ['ingredient 1'],
      };

      const result = schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/1');
      expect(result.cookingTimeMinutes).toBe(30);
    });

    it('should parse PT1H30M as 90 minutes', () => {
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Test Recipe',
        cookTime: 'PT1H30M',
        recipeIngredient: ['ingredient 1'],
      };

      const result = schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/1');
      expect(result.cookingTimeMinutes).toBe(90);
    });

    it('should parse PT45S as 1 minute (rounded up)', () => {
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Test Recipe',
        cookTime: 'PT45S',
        recipeIngredient: ['ingredient 1'],
      };

      const result = schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/1');
      expect(result.cookingTimeMinutes).toBe(1);
    });

    it('should parse PT2H as 120 minutes', () => {
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Test Recipe',
        cookTime: 'PT2H',
        recipeIngredient: ['ingredient 1'],
      };

      const result = schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/1');
      expect(result.cookingTimeMinutes).toBe(120);
    });

    it('should parse PT1H as 60 minutes', () => {
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Test Recipe',
        cookTime: 'PT1H',
        recipeIngredient: ['ingredient 1'],
      };

      const result = schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/1');
      expect(result.cookingTimeMinutes).toBe(60);
    });

    it('should parse PT30S as 1 minute (ceil of 0.5)', () => {
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Test Recipe',
        cookTime: 'PT30S',
        recipeIngredient: ['ingredient 1'],
      };

      const result = schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/1');
      expect(result.cookingTimeMinutes).toBe(1);
    });

    it('should use 30 minute default for invalid duration', () => {
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Test Recipe',
        cookTime: 'invalid',
        recipeIngredient: ['ingredient 1'],
      };

      const result = schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/1');
      expect(result.cookingTimeMinutes).toBe(30);
    });
  });

  describe('Ingredient parsing', () => {
    it('should parse "2 cups flour" to quantity: 2, unit: "cups", name: "flour"', () => {
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Test Recipe',
        cookTime: 'PT30M',
        recipeIngredient: ['2 cups flour'],
      };

      const result = schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/1');
      const ingredient = result.ingredients[0]!;

      expect(ingredient.quantity).toBe(2);
      expect(ingredient.unit).toBe('cups');
      expect(ingredient.name).toBe('flour');
    });

    it('should parse "1 tbsp olive oil"', () => {
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Test Recipe',
        cookTime: 'PT30M',
        recipeIngredient: ['1 tbsp olive oil'],
      };

      const result = schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/1');
      const ingredient = result.ingredients[0]!;

      expect(ingredient.quantity).toBe(1);
      expect(ingredient.unit).toBe('tbsp');
      expect(ingredient.name).toBe('olive oil');
    });

    it('should parse "salt to taste" with default quantity 1 and empty unit', () => {
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Test Recipe',
        cookTime: 'PT30M',
        recipeIngredient: ['salt to taste'],
      };

      const result = schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/1');
      const ingredient = result.ingredients[0]!;

      expect(ingredient.quantity).toBe(1);
      expect(ingredient.unit).toBe('');
      expect(ingredient.name).toBe('salt to taste');
    });

    it('should parse floating point quantities like "2.5 cups sugar"', () => {
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Test Recipe',
        cookTime: 'PT30M',
        recipeIngredient: ['2.5 cups sugar'],
      };

      const result = schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/1');
      const ingredient = result.ingredients[0]!;

      expect(ingredient.quantity).toBe(2.5);
      expect(ingredient.unit).toBe('cups');
      expect(ingredient.name).toBe('sugar');
    });

    it('should set correct orderIndex for multiple ingredients', () => {
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Test Recipe',
        cookTime: 'PT30M',
        recipeIngredient: ['1 cup flour', '2 eggs', '1 tsp salt'],
      };

      const result = schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/1');

      expect(result.ingredients[0]!.orderIndex).toBe(0);
      expect(result.ingredients[1]!.orderIndex).toBe(1);
      expect(result.ingredients[2]!.orderIndex).toBe(2);
    });

    it('should set dietary properties to empty array', () => {
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Test Recipe',
        cookTime: 'PT30M',
        recipeIngredient: ['1 cup flour'],
      };

      const result = schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/1');
      const ingredient = result.ingredients[0]!;

      expect(ingredient.dietaryProperties).toEqual([]);
    });

    it('should set optional to false by default', () => {
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Test Recipe',
        cookTime: 'PT30M',
        recipeIngredient: ['1 cup flour'],
      };

      const result = schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/1');
      const ingredient = result.ingredients[0]!;

      expect(ingredient.optional).toBe(false);
    });
  });

  describe('Dietary tags mapping', () => {
    it('should map single dietary tag', () => {
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Test Recipe',
        cookTime: 'PT30M',
        recipeIngredient: ['ingredient 1'],
        suitableForDiet: 'https://schema.org/GlutenFreeDiet',
      };

      const result = schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/1');
      expect(result.dietaryTags).toContain('gluten-free');
    });

    it('should map multiple dietary tags', () => {
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Test Recipe',
        cookTime: 'PT30M',
        recipeIngredient: ['ingredient 1'],
        suitableForDiet: ['https://schema.org/GlutenFreeDiet', 'https://schema.org/VeganDiet'],
      };

      const result = schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/1');
      expect(result.dietaryTags).toContain('gluten-free');
      expect(result.dietaryTags).toContain('vegan');
      expect(result.dietaryTags).toHaveLength(2);
    });

    it('should map LowLactoseDiet to lactose-free', () => {
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Test Recipe',
        cookTime: 'PT30M',
        recipeIngredient: ['ingredient 1'],
        suitableForDiet: 'https://schema.org/LowLactoseDiet',
      };

      const result = schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/1');
      expect(result.dietaryTags).toContain('lactose-free');
    });

    it('should map VegetarianDiet', () => {
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Test Recipe',
        cookTime: 'PT30M',
        recipeIngredient: ['ingredient 1'],
        suitableForDiet: 'https://schema.org/VegetarianDiet',
      };

      const result = schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/1');
      expect(result.dietaryTags).toContain('vegetarian');
    });

    it('should map PescatarianDiet', () => {
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Test Recipe',
        cookTime: 'PT30M',
        recipeIngredient: ['ingredient 1'],
        suitableForDiet: 'https://schema.org/PescatarianDiet',
      };

      const result = schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/1');
      expect(result.dietaryTags).toContain('pescatarian');
    });

    it('should ignore unknown dietary tags', () => {
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Test Recipe',
        cookTime: 'PT30M',
        recipeIngredient: ['ingredient 1'],
        suitableForDiet: ['https://schema.org/GlutenFreeDiet', 'https://schema.org/UnknownDiet'],
      };

      const result = schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/1');
      expect(result.dietaryTags).toContain('gluten-free');
      expect(result.dietaryTags).toHaveLength(1);
    });

    it('should return empty array for missing dietary tags', () => {
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Test Recipe',
        cookTime: 'PT30M',
        recipeIngredient: ['ingredient 1'],
      };

      const result = schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/1');
      expect(result.dietaryTags).toEqual([]);
    });
  });

  describe('Recipe instructions handling', () => {
    it('should handle recipeInstructions as string', () => {
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Test Recipe',
        cookTime: 'PT30M',
        recipeIngredient: ['ingredient 1'],
        recipeInstructions: 'Cook chicken, add vegetables, serve.',
      };

      const result = schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/1');
      expect(result.instructions).toBe('Cook chicken, add vegetables, serve.');
    });

    it('should concatenate recipeInstructions as HowToStep array', () => {
      const instructions: SchemaOrgHowToStep[] = [
        { '@type': 'HowToStep', text: 'Preheat oven to 350F' },
        { '@type': 'HowToStep', text: 'Mix ingredients together' },
        { '@type': 'HowToStep', text: 'Bake for 30 minutes' },
      ];

      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Test Recipe',
        cookTime: 'PT30M',
        recipeIngredient: ['ingredient 1'],
        recipeInstructions: instructions,
      };

      const result = schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/1');
      expect(result.instructions).toBe(
        'Preheat oven to 350F\nMix ingredients together\nBake for 30 minutes'
      );
    });

    it('should concatenate recipeInstructions as string array', () => {
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Test Recipe',
        cookTime: 'PT30M',
        recipeIngredient: ['ingredient 1'],
        recipeInstructions: ['Step 1: Prepare ingredients', 'Step 2: Cook', 'Step 3: Serve'],
      };

      const result = schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/1');
      expect(result.instructions).toBe('Step 1: Prepare ingredients\nStep 2: Cook\nStep 3: Serve');
    });

    it('should infer cookware type "one-pan" from instructions containing "pan"', () => {
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Test Recipe',
        cookTime: 'PT30M',
        recipeIngredient: ['ingredient 1'],
        recipeInstructions: 'Heat a pan and fry the ingredients.',
      };

      const result = schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/1');
      expect(result.cookwareType).toBe('one-pan');
    });

    it('should infer cookware type "one-pot" from instructions containing "pot"', () => {
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Test Recipe',
        cookTime: 'PT30M',
        recipeIngredient: ['ingredient 1'],
        recipeInstructions: 'Boil water in a pot.',
      };

      const result = schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/1');
      expect(result.cookwareType).toBe('one-pot');
    });

    it('should infer cookware type "oven" from instructions containing "oven"', () => {
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Test Recipe',
        cookTime: 'PT30M',
        recipeIngredient: ['ingredient 1'],
        recipeInstructions: 'Preheat oven to 350F and bake.',
      };

      const result = schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/1');
      expect(result.cookwareType).toBe('oven');
    });

    it('should default to one-pan when cookware cannot be inferred', () => {
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Test Recipe',
        cookTime: 'PT30M',
        recipeIngredient: ['ingredient 1'],
        recipeInstructions: 'Mix and serve',
      };

      const result = schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/1');
      expect(result.cookwareType).toBe('one-pan');
    });
  });

  describe('Servings parsing', () => {
    it('should parse recipeYield as string "4 servings" to servings: 4', () => {
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Test Recipe',
        cookTime: 'PT30M',
        recipeIngredient: ['ingredient 1'],
        recipeYield: '4 servings',
      };

      const result = schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/1');
      expect(result.servings).toBe(4);
    });

    it('should parse recipeYield as number 2 to servings: 2', () => {
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Test Recipe',
        cookTime: 'PT30M',
        recipeIngredient: ['ingredient 1'],
        recipeYield: 2,
      };

      const result = schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/1');
      expect(result.servings).toBe(2);
    });

    it('should parse "2-4 servings" to servings: 2', () => {
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Test Recipe',
        cookTime: 'PT30M',
        recipeIngredient: ['ingredient 1'],
        recipeYield: '2-4 servings',
      };

      const result = schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/1');
      expect(result.servings).toBe(2);
    });

    it('should parse "makes 6" to servings: 6', () => {
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Test Recipe',
        cookTime: 'PT30M',
        recipeIngredient: ['ingredient 1'],
        recipeYield: 'makes 6',
      };

      const result = schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/1');
      expect(result.servings).toBe(6);
    });

    it('should use default servings 2 for invalid format', () => {
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Test Recipe',
        cookTime: 'PT30M',
        recipeIngredient: ['ingredient 1'],
        recipeYield: 'unknown format',
      };

      const result = schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/1');
      expect(result.servings).toBe(2);
    });

    it('should use default servings 2 for missing recipeYield', () => {
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Test Recipe',
        cookTime: 'PT30M',
        recipeIngredient: ['ingredient 1'],
      };

      const result = schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/1');
      expect(result.servings).toBe(2);
    });

    it('should handle large servings numbers', () => {
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Test Recipe',
        cookTime: 'PT30M',
        recipeIngredient: ['ingredient 1'],
        recipeYield: '50 servings',
      };

      const result = schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/1');
      expect(result.servings).toBe(50);
    });
  });

  describe('Error handling', () => {
    it('should throw error when recipe name is missing', () => {
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: '',
        cookTime: 'PT30M',
        recipeIngredient: ['ingredient 1'],
      };

      expect(() => schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/1')).toThrow(
        'Recipe name is required'
      );
    });

    it('should throw error when recipe ingredients are missing', () => {
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Test Recipe',
        cookTime: 'PT30M',
        recipeIngredient: [],
      };

      expect(() => schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/1')).toThrow(
        'At least one ingredient is required'
      );
    });

    it('should throw error when ingredients array is undefined', () => {
      const recipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Test Recipe',
        cookTime: 'PT30M',
      } as SchemaOrgRecipe;

      expect(() => schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/1')).toThrow(
        'At least one ingredient is required'
      );
    });
  });

  describe('Source reference and metadata', () => {
    it('should set sourceType to "web-imported"', () => {
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Test Recipe',
        cookTime: 'PT30M',
        recipeIngredient: ['ingredient 1'],
      };

      const result = schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/1');
      expect(result.sourceType).toBe('web-imported');
    });

    it('should set seasonality to ["any"]', () => {
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Test Recipe',
        cookTime: 'PT30M',
        recipeIngredient: ['ingredient 1'],
      };

      const result = schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/1');
      expect(result.seasonality).toEqual(['any']);
    });

    it('should set sourceReference to provided URL', () => {
      const sourceUrl = 'https://cookingsite.com/recipes/pasta';
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Test Recipe',
        cookTime: 'PT30M',
        recipeIngredient: ['ingredient 1'],
      };

      const result = schemaOrgToRecipeInput(recipe, sourceUrl);
      expect(result.sourceReference).toBe(sourceUrl);
    });
  });

  describe('Edge cases', () => {
    it('should handle recipe title with whitespace', () => {
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: '  Test Recipe With Spaces  ',
        cookTime: 'PT30M',
        recipeIngredient: ['ingredient 1'],
      };

      const result = schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/1');
      expect(result.title).toBe('Test Recipe With Spaces');
    });

    it('should handle servings value of 0', () => {
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Test Recipe',
        cookTime: 'PT30M',
        recipeIngredient: ['ingredient 1'],
        recipeYield: 0,
      };

      const result = schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/1');
      expect(result.servings).toBe(2); // Should use default
    });

    it('should handle negative cooking time with default', () => {
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Test Recipe',
        cookTime: 'PT-30M',
        recipeIngredient: ['ingredient 1'],
      };

      const result = schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/1');
      expect(result.cookingTimeMinutes).toBe(30); // Should use default
    });

    it('should handle ingredient with only quantity', () => {
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Test Recipe',
        cookTime: 'PT30M',
        recipeIngredient: ['3'],
      };

      const result = schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/1');
      const ingredient = result.ingredients[0]!;

      expect(ingredient.quantity).toBe(1);
      expect(ingredient.name).toBe('3');
    });

    it('should handle very long ingredient names', () => {
      const longName = 'a'.repeat(200);
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Test Recipe',
        cookTime: 'PT30M',
        recipeIngredient: [longName],
      };

      const result = schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/1');
      const ingredient = result.ingredients[0]!;

      expect(ingredient.name).toBe(longName);
    });

    it('should handle single ingredient', () => {
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Test Recipe',
        cookTime: 'PT30M',
        recipeIngredient: ['1 cup water'],
      };

      const result = schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/1');
      expect(result.ingredients).toHaveLength(1);
    });

    it('should handle many ingredients', () => {
      const ingredients = Array.from({ length: 20 }, (_, i) => `ingredient ${i + 1}`);
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Test Recipe',
        cookTime: 'PT30M',
        recipeIngredient: ingredients,
      };

      const result = schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/1');
      expect(result.ingredients).toHaveLength(20);
    });

    it('should handle HowToStep with name field', () => {
      const instructions: SchemaOrgHowToStep[] = [
        {
          '@type': 'HowToStep',
          text: 'Mix ingredients',
          name: 'Mixing',
        },
        {
          '@type': 'HowToStep',
          text: 'Bake',
          name: 'Baking',
        },
      ];

      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Test Recipe',
        cookTime: 'PT30M',
        recipeIngredient: ['ingredient 1'],
        recipeInstructions: instructions,
      };

      const result = schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/1');
      expect(result.instructions).toBe('Mix ingredients\nBake');
    });

    it('should handle PT0M duration', () => {
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Test Recipe',
        cookTime: 'PT0M',
        recipeIngredient: ['ingredient 1'],
      };

      const result = schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/1');
      expect(result.cookingTimeMinutes).toBe(30); // Should use default
    });

    it('should handle mixed case in ingredient units', () => {
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Test Recipe',
        cookTime: 'PT30M',
        recipeIngredient: ['2 CUPS flour'],
      };

      const result = schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/1');
      const ingredient = result.ingredients[0]!;

      expect(ingredient.unit).toBe('cups'); // Should be lowercased
    });

    it('should handle ingredient with only unit and name', () => {
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Test Recipe',
        cookTime: 'PT30M',
        recipeIngredient: ['cups flour'],
      };

      const result = schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/1');
      const ingredient = result.ingredients[0]!;

      expect(ingredient.quantity).toBe(1);
      expect(ingredient.name).toBe('cups flour');
      expect(ingredient.unit).toBe('');
    });

    it('should handle recipe with all optional fields', () => {
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Complete Recipe',
        description: 'A complete recipe',
        author: { '@type': 'Person', name: 'Chef' },
        cookTime: 'PT45M',
        prepTime: 'PT20M',
        totalTime: 'PT65M',
        recipeYield: '6',
        recipeCuisine: 'French',
        recipeCategory: 'Dessert',
        keywords: 'sweet, delicious',
        recipeIngredient: ['2 cups flour', '1 cup sugar'],
        recipeInstructions: 'Mix and bake',
        suitableForDiet: 'https://schema.org/VegetarianDiet',
        url: 'https://example.com/recipe/complete',
      };

      const result = schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/complete');

      expect(result.title).toBe('Complete Recipe');
      expect(result.cookingTimeMinutes).toBe(45);
      expect(result.prepTimeMinutes).toBe(20);
      expect(result.servings).toBe(6);
      expect(result.dietaryTags).toContain('vegetarian');
      expect(result.ingredients).toHaveLength(2);
    });
  });

  describe('Complex real-world scenarios', () => {
    it('should convert a real recipe from AllRecipes style schema', () => {
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Chocolate Chip Cookies',
        description: 'Classic chocolate chip cookies',
        author: { '@type': 'Person', name: 'Betty Crocker' },
        datePublished: '2020-01-01',
        prepTime: 'PT15M',
        cookTime: 'PT12M',
        totalTime: 'PT27M',
        recipeYield: '24 cookies',
        recipeCuisine: 'American',
        recipeCategory: 'Dessert',
        keywords: 'cookies, chocolate, baked',
        recipeIngredient: [
          '2.25 cups all-purpose flour',
          '1 tsp baking soda',
          '1 tsp salt',
          '1 cup butter, softened',
          '0.75 cup granulated sugar',
          '0.75 cup packed brown sugar',
          '2 large eggs',
          '2 tsp vanilla extract',
          '2 cups chocolate chips',
        ],
        recipeInstructions: [
          { '@type': 'HowToStep', text: 'Preheat oven to 375°F.' },
          { '@type': 'HowToStep', text: 'Mix flour, baking soda and salt in small bowl.' },
          {
            '@type': 'HowToStep',
            text: 'Beat butter, granulated sugar and brown sugar in large mixer bowl until creamy.',
          },
          { '@type': 'HowToStep', text: 'Add eggs and vanilla extract; beat well.' },
          { '@type': 'HowToStep', text: 'Gradually beat in flour mixture.' },
          { '@type': 'HowToStep', text: 'Stir in chocolate chips.' },
          { '@type': 'HowToStep', text: 'Drop rounded tablespoon onto ungreased baking sheets.' },
          { '@type': 'HowToStep', text: 'Bake for 9 to 12 minutes or until golden brown.' },
        ],
        suitableForDiet: 'https://schema.org/VegetarianDiet',
        url: 'https://example.com/recipe/cookies',
      };

      const result = schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/cookies');

      expect(result.title).toBe('Chocolate Chip Cookies');
      expect(result.cookingTimeMinutes).toBe(12);
      expect(result.prepTimeMinutes).toBe(15);
      expect(result.servings).toBe(24);
      expect(result.cookwareType).toBe('oven');
      expect(result.ingredients).toHaveLength(9);
      expect(result.dietaryTags).toContain('vegetarian');
      expect(result.instructions).toContain('Preheat oven');
      expect(result.instructions).toContain('Bake for 9 to 12 minutes');
    });

    it('should convert a recipe with minimal required fields', () => {
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Minimal Recipe',
        recipeIngredient: ['salt', 'water'],
      };

      const result = schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/minimal');

      // Should have defaults for all optional fields
      expect(result.title).toBe('Minimal Recipe');
      expect(result.cookingTimeMinutes).toBe(30);
      expect(result.prepTimeMinutes).toBeUndefined();
      expect(result.servings).toBe(2);
      expect(result.cookwareType).toBe('one-pan');
      expect(result.ingredients).toHaveLength(2);
      expect(result.dietaryTags).toEqual([]);
      expect(result.instructions).toBeUndefined();
      expect(result.seasonality).toEqual(['any']);
      expect(result.sourceType).toBe('web-imported');
    });

    it('should handle PT2H45M duration correctly', () => {
      const recipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Slow Cook Recipe',
        cookTime: 'PT2H45M',
        recipeIngredient: ['ingredient 1'],
      };

      const result = schemaOrgToRecipeInput(recipe, 'https://example.com/recipe/slow');
      expect(result.cookingTimeMinutes).toBe(165); // 2*60 + 45
    });
  });
});
