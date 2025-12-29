import { describe, it, expect } from 'vitest';
import { RecipeGenerationSchema, IngredientGenerationSchema } from './recipe-schema.js';
import type { RecipeGenerationOutput, IngredientGenerationOutput } from './recipe-schema.js';

describe('IngredientGenerationSchema', () => {
  const validIngredient: IngredientGenerationOutput = {
    name: 'chicken breast',
    quantity: 300,
    unit: 'g',
    dietaryProperties: ['contains-meat'],
    optional: false,
    orderIndex: 0,
  };

  describe('Valid Ingredients', () => {
    it('should validate correct ingredient structure', () => {
      expect(() => IngredientGenerationSchema.parse(validIngredient)).not.toThrow();
    });

    it('should validate ingredient with multiple dietary properties', () => {
      const ingredient = {
        ...validIngredient,
        dietaryProperties: ['contains-gluten', 'contains-lactose', 'contains-eggs'],
      };
      expect(() => IngredientGenerationSchema.parse(ingredient)).not.toThrow();
    });

    it('should validate ingredient with "none" dietary property', () => {
      const ingredient = {
        ...validIngredient,
        dietaryProperties: ['none'],
      };
      expect(() => IngredientGenerationSchema.parse(ingredient)).not.toThrow();
    });

    it('should default optional to false when not provided', () => {
      const ingredient = {
        name: 'salt',
        quantity: 1,
        unit: 'tsp',
        dietaryProperties: ['none'],
        orderIndex: 1,
      };
      const result = IngredientGenerationSchema.parse(ingredient);
      expect(result.optional).toBe(false);
    });

    it('should accept optional: true', () => {
      const ingredient = {
        ...validIngredient,
        optional: true,
      };
      expect(() => IngredientGenerationSchema.parse(ingredient)).not.toThrow();
    });
  });

  describe('Invalid Ingredient - Name', () => {
    it('should reject empty name', () => {
      const ingredient = { ...validIngredient, name: '' };
      expect(() => IngredientGenerationSchema.parse(ingredient)).toThrow();
    });

    it('should reject name longer than 200 characters', () => {
      const ingredient = { ...validIngredient, name: 'a'.repeat(201) };
      expect(() => IngredientGenerationSchema.parse(ingredient)).toThrow();
    });

    it('should reject missing name', () => {
      const { name, ...ingredient } = validIngredient;
      expect(() => IngredientGenerationSchema.parse(ingredient)).toThrow();
    });
  });

  describe('Invalid Ingredient - Quantity', () => {
    it('should reject zero quantity', () => {
      const ingredient = { ...validIngredient, quantity: 0 };
      expect(() => IngredientGenerationSchema.parse(ingredient)).toThrow();
    });

    it('should reject negative quantity', () => {
      const ingredient = { ...validIngredient, quantity: -5 };
      expect(() => IngredientGenerationSchema.parse(ingredient)).toThrow();
    });

    it('should reject missing quantity', () => {
      const { quantity, ...ingredient } = validIngredient;
      expect(() => IngredientGenerationSchema.parse(ingredient)).toThrow();
    });

    it('should reject string quantity', () => {
      const ingredient = { ...validIngredient, quantity: '100' };
      expect(() => IngredientGenerationSchema.parse(ingredient)).toThrow();
    });
  });

  describe('Invalid Ingredient - Unit', () => {
    it('should reject empty unit', () => {
      const ingredient = { ...validIngredient, unit: '' };
      expect(() => IngredientGenerationSchema.parse(ingredient)).toThrow();
    });

    it('should reject unit longer than 50 characters', () => {
      const ingredient = { ...validIngredient, unit: 'a'.repeat(51) };
      expect(() => IngredientGenerationSchema.parse(ingredient)).toThrow();
    });

    it('should reject missing unit', () => {
      const { unit, ...ingredient } = validIngredient;
      expect(() => IngredientGenerationSchema.parse(ingredient)).toThrow();
    });
  });

  describe('Invalid Ingredient - Dietary Properties', () => {
    it('should reject invalid dietary property', () => {
      const ingredient = {
        ...validIngredient,
        dietaryProperties: ['invalid-property'],
      };
      expect(() => IngredientGenerationSchema.parse(ingredient)).toThrow();
    });

    it('should accept empty dietary properties array', () => {
      const ingredient = {
        ...validIngredient,
        dietaryProperties: [],
      };
      expect(() => IngredientGenerationSchema.parse(ingredient)).not.toThrow();
    });

    it('should reject missing dietary properties', () => {
      const { dietaryProperties, ...ingredient } = validIngredient;
      expect(() => IngredientGenerationSchema.parse(ingredient)).toThrow();
    });
  });

  describe('Invalid Ingredient - Order Index', () => {
    it('should reject negative order index', () => {
      const ingredient = { ...validIngredient, orderIndex: -1 };
      expect(() => IngredientGenerationSchema.parse(ingredient)).toThrow();
    });

    it('should reject non-integer order index', () => {
      const ingredient = { ...validIngredient, orderIndex: 1.5 };
      expect(() => IngredientGenerationSchema.parse(ingredient)).toThrow();
    });

    it('should reject missing order index', () => {
      const { orderIndex, ...ingredient } = validIngredient;
      expect(() => IngredientGenerationSchema.parse(ingredient)).toThrow();
    });
  });
});

describe('RecipeGenerationSchema', () => {
  const validRecipe: RecipeGenerationOutput = {
    title: 'One-Pot Chicken and Rice',
    cookingTimeMinutes: 35,
    cookwareType: 'one-pot',
    servings: 2,
    dietaryTags: ['gluten-free', 'lactose-free'],
    seasonality: ['fall', 'winter'],
    ingredients: [
      {
        name: 'chicken breast',
        quantity: 300,
        unit: 'g',
        dietaryProperties: ['contains-meat'],
        optional: false,
        orderIndex: 0,
      },
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

  describe('Valid Recipes', () => {
    it('should validate correct recipe structure', () => {
      expect(() => RecipeGenerationSchema.parse(validRecipe)).not.toThrow();
    });

    it('should validate recipe without optional fields', () => {
      expect(() => RecipeGenerationSchema.parse(validRecipe)).not.toThrow();
    });

    it('should validate recipe with prepTimeMinutes', () => {
      const recipe = { ...validRecipe, prepTimeMinutes: 15 };
      expect(() => RecipeGenerationSchema.parse(recipe)).not.toThrow();
    });

    it('should validate recipe with instructions', () => {
      const recipe = {
        ...validRecipe,
        instructions:
          'Heat oil in pot. Add chicken and cook until browned. Add rice and water. Simmer for 20 minutes.',
      };
      expect(() => RecipeGenerationSchema.parse(recipe)).not.toThrow();
    });

    it('should validate recipe with all optional fields', () => {
      const recipe = {
        ...validRecipe,
        prepTimeMinutes: 20,
        instructions:
          'Detailed step-by-step instructions for preparing this delicious one-pot meal.',
      };
      expect(() => RecipeGenerationSchema.parse(recipe)).not.toThrow();
    });

    it('should validate recipe with single ingredient', () => {
      const recipe = {
        ...validRecipe,
        ingredients: [
          {
            name: 'pasta',
            quantity: 200,
            unit: 'g',
            dietaryProperties: ['contains-gluten'],
            optional: false,
            orderIndex: 0,
          },
        ],
      };
      expect(() => RecipeGenerationSchema.parse(recipe)).not.toThrow();
    });

    it('should validate recipe with 30 ingredients (maximum)', () => {
      const ingredients = Array.from({ length: 30 }, (_, i) => ({
        name: `ingredient-${i}`,
        quantity: 1,
        unit: 'unit',
        dietaryProperties: ['none'] as const,
        optional: false,
        orderIndex: i,
      }));
      const recipe = { ...validRecipe, ingredients };
      expect(() => RecipeGenerationSchema.parse(recipe)).not.toThrow();
    });
  });

  describe('Invalid Recipe - Title', () => {
    it('should reject empty title', () => {
      const recipe = { ...validRecipe, title: '' };
      expect(() => RecipeGenerationSchema.parse(recipe)).toThrow();
    });

    it('should reject title longer than 200 characters', () => {
      const recipe = { ...validRecipe, title: 'a'.repeat(201) };
      expect(() => RecipeGenerationSchema.parse(recipe)).toThrow();
    });

    it('should reject missing title', () => {
      const { title, ...recipe } = validRecipe;
      expect(() => RecipeGenerationSchema.parse(recipe)).toThrow();
    });
  });

  describe('Invalid Recipe - Cooking Time', () => {
    it('should reject cooking time less than 30 minutes', () => {
      const recipe = { ...validRecipe, cookingTimeMinutes: 29 };
      expect(() => RecipeGenerationSchema.parse(recipe)).toThrow();
    });

    it('should reject cooking time greater than 45 minutes', () => {
      const recipe = { ...validRecipe, cookingTimeMinutes: 46 };
      expect(() => RecipeGenerationSchema.parse(recipe)).toThrow();
    });

    it('should reject cooking time of 20 minutes', () => {
      const recipe = { ...validRecipe, cookingTimeMinutes: 20 };
      expect(() => RecipeGenerationSchema.parse(recipe)).toThrow();
    });

    it('should reject cooking time of 60 minutes', () => {
      const recipe = { ...validRecipe, cookingTimeMinutes: 60 };
      expect(() => RecipeGenerationSchema.parse(recipe)).toThrow();
    });

    it('should accept cooking time of exactly 30 minutes', () => {
      const recipe = { ...validRecipe, cookingTimeMinutes: 30 };
      expect(() => RecipeGenerationSchema.parse(recipe)).not.toThrow();
    });

    it('should accept cooking time of exactly 45 minutes', () => {
      const recipe = { ...validRecipe, cookingTimeMinutes: 45 };
      expect(() => RecipeGenerationSchema.parse(recipe)).not.toThrow();
    });

    it('should reject non-integer cooking time', () => {
      const recipe = { ...validRecipe, cookingTimeMinutes: 35.5 };
      expect(() => RecipeGenerationSchema.parse(recipe)).toThrow();
    });

    it('should reject missing cooking time', () => {
      const { cookingTimeMinutes, ...recipe } = validRecipe;
      expect(() => RecipeGenerationSchema.parse(recipe)).toThrow();
    });

    it('should reject string cooking time', () => {
      const recipe = { ...validRecipe, cookingTimeMinutes: '35' };
      expect(() => RecipeGenerationSchema.parse(recipe)).toThrow();
    });
  });

  describe('Invalid Recipe - Prep Time', () => {
    it('should reject prep time less than 0', () => {
      const recipe = { ...validRecipe, prepTimeMinutes: -1 };
      expect(() => RecipeGenerationSchema.parse(recipe)).toThrow();
    });

    it('should reject prep time greater than 30', () => {
      const recipe = { ...validRecipe, prepTimeMinutes: 31 };
      expect(() => RecipeGenerationSchema.parse(recipe)).toThrow();
    });

    it('should accept prep time of 0', () => {
      const recipe = { ...validRecipe, prepTimeMinutes: 0 };
      expect(() => RecipeGenerationSchema.parse(recipe)).not.toThrow();
    });

    it('should accept prep time of 30', () => {
      const recipe = { ...validRecipe, prepTimeMinutes: 30 };
      expect(() => RecipeGenerationSchema.parse(recipe)).not.toThrow();
    });

    it('should reject non-integer prep time', () => {
      const recipe = { ...validRecipe, prepTimeMinutes: 15.5 };
      expect(() => RecipeGenerationSchema.parse(recipe)).toThrow();
    });
  });

  describe('Invalid Recipe - Cookware Type', () => {
    it('should reject invalid cookware type', () => {
      const recipe = { ...validRecipe, cookwareType: 'wok' };
      expect(() => RecipeGenerationSchema.parse(recipe)).toThrow();
    });

    it('should reject empty cookware type', () => {
      const recipe = { ...validRecipe, cookwareType: '' };
      expect(() => RecipeGenerationSchema.parse(recipe)).toThrow();
    });

    it('should reject missing cookware type', () => {
      const { cookwareType, ...recipe } = validRecipe;
      expect(() => RecipeGenerationSchema.parse(recipe)).toThrow();
    });

    it('should accept "one-pot" cookware type', () => {
      const recipe = { ...validRecipe, cookwareType: 'one-pot' as const };
      expect(() => RecipeGenerationSchema.parse(recipe)).not.toThrow();
    });

    it('should accept "one-pan" cookware type', () => {
      const recipe = { ...validRecipe, cookwareType: 'one-pan' as const };
      expect(() => RecipeGenerationSchema.parse(recipe)).not.toThrow();
    });

    it('should accept "oven" cookware type', () => {
      const recipe = { ...validRecipe, cookwareType: 'oven' as const };
      expect(() => RecipeGenerationSchema.parse(recipe)).not.toThrow();
    });
  });

  describe('Invalid Recipe - Servings', () => {
    it('should reject servings of 1', () => {
      const recipe = { ...validRecipe, servings: 1 };
      expect(() => RecipeGenerationSchema.parse(recipe)).toThrow();
    });

    it('should reject servings of 3', () => {
      const recipe = { ...validRecipe, servings: 3 };
      expect(() => RecipeGenerationSchema.parse(recipe)).toThrow();
    });

    it('should reject servings of 4', () => {
      const recipe = { ...validRecipe, servings: 4 };
      expect(() => RecipeGenerationSchema.parse(recipe)).toThrow();
    });

    it('should reject servings of 6', () => {
      const recipe = { ...validRecipe, servings: 6 };
      expect(() => RecipeGenerationSchema.parse(recipe)).toThrow();
    });

    it('should accept servings of exactly 2', () => {
      const recipe = { ...validRecipe, servings: 2 };
      expect(() => RecipeGenerationSchema.parse(recipe)).not.toThrow();
    });

    it('should reject missing servings', () => {
      const { servings, ...recipe } = validRecipe;
      expect(() => RecipeGenerationSchema.parse(recipe)).toThrow();
    });

    it('should reject string servings', () => {
      const recipe = { ...validRecipe, servings: '2' };
      expect(() => RecipeGenerationSchema.parse(recipe)).toThrow();
    });
  });

  describe('Invalid Recipe - Dietary Tags', () => {
    it('should reject invalid dietary tag', () => {
      const recipe = { ...validRecipe, dietaryTags: ['keto'] };
      expect(() => RecipeGenerationSchema.parse(recipe)).toThrow();
    });

    it('should accept empty dietary tags array', () => {
      const recipe = { ...validRecipe, dietaryTags: [] };
      expect(() => RecipeGenerationSchema.parse(recipe)).not.toThrow();
    });

    it('should reject missing dietary tags', () => {
      const { dietaryTags, ...recipe } = validRecipe;
      expect(() => RecipeGenerationSchema.parse(recipe)).toThrow();
    });

    it('should accept all valid dietary tags', () => {
      const recipe = {
        ...validRecipe,
        dietaryTags: ['gluten-free', 'lactose-free', 'vegetarian', 'vegan', 'pescatarian'] as const,
      };
      expect(() => RecipeGenerationSchema.parse(recipe)).not.toThrow();
    });

    it('should accept single dietary tag', () => {
      const recipe = { ...validRecipe, dietaryTags: ['vegetarian'] as const };
      expect(() => RecipeGenerationSchema.parse(recipe)).not.toThrow();
    });
  });

  describe('Invalid Recipe - Seasonality', () => {
    it('should reject invalid seasonality', () => {
      const recipe = { ...validRecipe, seasonality: ['rainy-season'] };
      expect(() => RecipeGenerationSchema.parse(recipe)).toThrow();
    });

    it('should accept empty seasonality array', () => {
      const recipe = { ...validRecipe, seasonality: [] };
      expect(() => RecipeGenerationSchema.parse(recipe)).not.toThrow();
    });

    it('should reject missing seasonality', () => {
      const { seasonality, ...recipe } = validRecipe;
      expect(() => RecipeGenerationSchema.parse(recipe)).toThrow();
    });

    it('should accept all valid seasons', () => {
      const recipe = {
        ...validRecipe,
        seasonality: ['spring', 'summer', 'fall', 'winter', 'any'] as const,
      };
      expect(() => RecipeGenerationSchema.parse(recipe)).not.toThrow();
    });

    it('should accept "any" seasonality', () => {
      const recipe = { ...validRecipe, seasonality: ['any'] as const };
      expect(() => RecipeGenerationSchema.parse(recipe)).not.toThrow();
    });
  });

  describe('Invalid Recipe - Instructions', () => {
    it('should reject instructions shorter than 50 characters', () => {
      const recipe = { ...validRecipe, instructions: 'Cook it.' };
      expect(() => RecipeGenerationSchema.parse(recipe)).toThrow();
    });

    it('should reject instructions longer than 5000 characters', () => {
      const recipe = { ...validRecipe, instructions: 'a'.repeat(5001) };
      expect(() => RecipeGenerationSchema.parse(recipe)).toThrow();
    });

    it('should accept instructions of exactly 50 characters', () => {
      const recipe = { ...validRecipe, instructions: 'a'.repeat(50) };
      expect(() => RecipeGenerationSchema.parse(recipe)).not.toThrow();
    });

    it('should accept instructions of exactly 5000 characters', () => {
      const recipe = { ...validRecipe, instructions: 'a'.repeat(5000) };
      expect(() => RecipeGenerationSchema.parse(recipe)).not.toThrow();
    });

    it('should accept missing instructions (optional)', () => {
      const recipe = { ...validRecipe };
      expect(() => RecipeGenerationSchema.parse(recipe)).not.toThrow();
    });
  });

  describe('Invalid Recipe - Ingredients', () => {
    it('should reject empty ingredients array', () => {
      const recipe = { ...validRecipe, ingredients: [] };
      expect(() => RecipeGenerationSchema.parse(recipe)).toThrow();
    });

    it('should reject more than 30 ingredients', () => {
      const ingredients = Array.from({ length: 31 }, (_, i) => ({
        name: `ingredient-${i}`,
        quantity: 1,
        unit: 'unit',
        dietaryProperties: ['none'] as const,
        optional: false,
        orderIndex: i,
      }));
      const recipe = { ...validRecipe, ingredients };
      expect(() => RecipeGenerationSchema.parse(recipe)).toThrow();
    });

    it('should reject missing ingredients', () => {
      const { ingredients, ...recipe } = validRecipe;
      expect(() => RecipeGenerationSchema.parse(recipe)).toThrow();
    });

    it('should reject ingredients with invalid structure', () => {
      const recipe = {
        ...validRecipe,
        ingredients: [
          {
            name: 'chicken',
            // missing quantity
            unit: 'g',
            dietaryProperties: ['contains-meat'],
            optional: false,
            orderIndex: 0,
          },
        ],
      };
      expect(() => RecipeGenerationSchema.parse(recipe)).toThrow();
    });
  });

  describe('Complex Validation Scenarios', () => {
    it('should reject recipe with multiple validation errors', () => {
      const recipe = {
        title: '',
        cookingTimeMinutes: 60,
        cookwareType: 'invalid',
        servings: 4,
        dietaryTags: [],
        seasonality: [],
        ingredients: [],
      };
      expect(() => RecipeGenerationSchema.parse(recipe)).toThrow();
    });

    it('should validate recipe with edge case values', () => {
      const recipe = {
        title: 'A',
        cookingTimeMinutes: 30,
        prepTimeMinutes: 0,
        cookwareType: 'one-pot' as const,
        servings: 2,
        dietaryTags: ['vegan'] as const,
        seasonality: ['any'] as const,
        instructions: 'a'.repeat(50),
        ingredients: [
          {
            name: 'ingredient',
            quantity: 0.01,
            unit: 'g',
            dietaryProperties: ['none'] as const,
            optional: false,
            orderIndex: 0,
          },
        ],
      };
      expect(() => RecipeGenerationSchema.parse(recipe)).not.toThrow();
    });

    it('should return parsed object with correct types', () => {
      const result = RecipeGenerationSchema.parse(validRecipe);
      expect(result.title).toBe('One-Pot Chicken and Rice');
      expect(result.cookingTimeMinutes).toBe(35);
      expect(result.servings).toBe(2);
      expect(result.ingredients).toHaveLength(2);
      expect(result.ingredients[0]!.name).toBe('chicken breast');
    });

    it('should handle safeParse for valid recipe', () => {
      const result = RecipeGenerationSchema.safeParse(validRecipe);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe('One-Pot Chicken and Rice');
      }
    });

    it('should handle safeParse for invalid recipe', () => {
      const recipe = { ...validRecipe, servings: 4 };
      const result = RecipeGenerationSchema.safeParse(recipe);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });
  });
});
