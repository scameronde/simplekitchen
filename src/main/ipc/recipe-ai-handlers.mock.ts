/**
 * @module recipe-ai-handlers.mock
 * Mock implementation of AI recipe generation handler for testing.
 * Provides realistic sample recipes without calling OpenAI API.
 * Supports test signals for error scenarios.
 *
 * Test Signal Usage:
 * - Pass `mainIngredient: 'rate-limit-test'` to simulate rate limit error
 * - Pass `mainIngredient: 'invalid-test'` to simulate validation error
 * - Pass `mainIngredient: 'failure-test'` to simulate generic failure
 * - Pass any other criteria for successful mock recipe generation
 *
 * Example:
 * ```typescript
 * // Success case
 * const result = await mockGenerateRecipe({
 *   dietaryTags: ['vegetarian'],
 *   cookwareType: 'one-pot'
 * });
 *
 * // Simulate rate limit error
 * const result = await mockGenerateRecipe({
 *   dietaryTags: ['vegetarian'],
 *   mainIngredient: 'rate-limit-test'
 * });
 * ```
 */

import type { RecipeGenerationCriteria, RecipeGenerationResult } from '../../shared/types/ai.js';
import type { CreateRecipeInput, CreateIngredientInput } from '../../shared/types/recipe.js';
import type { DietaryTag, DietaryProperty } from '../../shared/types/database.js';

/**
 * Generates a mock recipe matching the specified criteria.
 * Detects test signals to simulate error scenarios.
 *
 * @param criteria - Recipe generation criteria
 * @returns Promise resolving to mock generation result
 *
 * Test Signals:
 * - mainIngredient === 'rate-limit-test': Simulates OpenAI rate limit error
 * - mainIngredient === 'invalid-test': Simulates validation error
 * - mainIngredient === 'failure-test': Simulates generic failure error
 */
export async function mockGenerateRecipe(
  criteria: RecipeGenerationCriteria
): Promise<RecipeGenerationResult> {
  // Detect test signals for error simulation
  if (criteria.mainIngredient === 'rate-limit-test') {
    return {
      success: false,
      error: {
        type: 'rate-limit',
        message: 'Rate limit exceeded. Please wait before trying again.',
        retryAfter: 60,
        details: 'OpenAI API rate limit exceeded. Test signal triggered.',
      },
    };
  }

  if (criteria.mainIngredient === 'invalid-test') {
    return {
      success: false,
      error: {
        type: 'validation',
        message: 'Invalid recipe generation criteria',
        details: 'Test signal triggered for validation error. Check required fields.',
      },
    };
  }

  if (criteria.mainIngredient === 'failure-test') {
    return {
      success: false,
      error: {
        type: 'unknown',
        message: 'An unexpected error occurred during recipe generation',
        details: 'Test signal triggered for generic failure.',
      },
    };
  }

  // Generate successful mock recipe based on criteria
  const recipe = generateMockRecipe(criteria);

  return {
    success: true,
    recipe,
  };
}

/**
 * Generates a realistic mock recipe based on the provided criteria.
 * Ensures the recipe matches dietary tags, cookware preferences, and other constraints.
 *
 * @param criteria - Recipe generation criteria
 * @returns Mock recipe ready for database insertion
 */
function generateMockRecipe(criteria: RecipeGenerationCriteria): CreateRecipeInput {
  const baseRecipes = getBaseRecipes(criteria.dietaryTags, criteria.mainIngredient);
  const selected = baseRecipes[0] || getDefaultRecipe(criteria);

  // Customize based on criteria
  const title = customizeTitle(selected.title ?? 'Simple Recipe', criteria);
  const ingredients = customizeIngredients(selected.ingredients ?? [], criteria);

  return {
    title,
    cookingTimeMinutes: selected.cookingTimeMinutes ?? 30,
    prepTimeMinutes: selected.prepTimeMinutes || 10,
    cookwareType: criteria.cookwareType || 'one-pot',
    servings: 2, // Always 2 per spec
    dietaryTags: criteria.dietaryTags,
    seasonality: criteria.seasonality || ['any'],
    sourceType: 'ai-generated',
    sourceReference: 'Mock AI Generator',
    instructions: selected.instructions ?? 'Cook and serve.',
    ingredients,
  };
}

/**
 * Retrieves base recipe templates that match the dietary constraints.
 * Prioritizes recipes that match the specified main ingredient.
 *
 * @param dietaryTags - Required dietary tags for the recipe
 * @param mainIngredient - Optional preferred main ingredient
 * @returns Array of matching recipe templates, most relevant first
 */
function getBaseRecipes(
  dietaryTags: DietaryTag[],
  mainIngredient?: string
): Array<Partial<CreateRecipeInput>> {
  const recipes: Record<string, Partial<CreateRecipeInput>[]> = {
    vegetarian: [
      {
        title: 'Vegetable Stir-Fry',
        cookingTimeMinutes: 30,
        prepTimeMinutes: 15,
        instructions:
          'Heat oil in a pan. Add vegetables and stir-fry until tender-crisp. Season with soy sauce and serve over rice.',
        ingredients: [
          createIngredient('soy sauce', 2, 'tbsp', ['none']),
          createIngredient('mixed vegetables', 300, 'g', ['none']),
          createIngredient('vegetable oil', 1, 'tbsp', ['none']),
          createIngredient('garlic', 3, 'cloves', ['none']),
          createIngredient('ginger', 1, 'tbsp', ['none']),
        ],
      },
      {
        title: 'Vegetarian Pasta Primavera',
        cookingTimeMinutes: 30,
        prepTimeMinutes: 10,
        instructions:
          'Cook pasta according to package directions. Toss with sautéed vegetables, olive oil, and fresh herbs. Serve warm.',
        ingredients: [
          createIngredient('pasta', 250, 'g', ['contains-gluten']),
          createIngredient('seasonal vegetables', 400, 'g', ['none']),
          createIngredient('olive oil', 2, 'tbsp', ['none']),
          createIngredient('garlic', 2, 'cloves', ['none']),
          createIngredient('fresh basil', 10, 'g', ['none']),
        ],
      },
      {
        title: 'Bean Chili',
        cookingTimeMinutes: 40,
        prepTimeMinutes: 10,
        instructions:
          'Sauté onions and peppers. Add beans, tomatoes, and spices. Simmer for 30 minutes. Serve with cornbread.',
        ingredients: [
          createIngredient('canned beans', 400, 'g', ['none']),
          createIngredient('tomato sauce', 400, 'ml', ['none']),
          createIngredient('onion', 1, 'whole', ['none']),
          createIngredient('bell pepper', 1, 'whole', ['none']),
          createIngredient('chili powder', 1, 'tbsp', ['none']),
        ],
      },
    ],
    vegan: [
      {
        title: 'Vegan Curry',
        cookingTimeMinutes: 35,
        prepTimeMinutes: 15,
        instructions:
          'Sauté aromatics with curry paste. Add vegetables and coconut milk. Simmer until cooked through. Serve over rice.',
        ingredients: [
          createIngredient('canned coconut milk', 400, 'ml', ['none']),
          createIngredient('vegetables', 400, 'g', ['none']),
          createIngredient('curry paste', 2, 'tbsp', ['none']),
          createIngredient('vegetable oil', 1, 'tbsp', ['none']),
          createIngredient('garlic', 3, 'cloves', ['none']),
        ],
      },
      {
        title: 'Tofu Stir-Fry',
        cookingTimeMinutes: 30,
        prepTimeMinutes: 10,
        instructions:
          'Press tofu and cube. Stir-fry with vegetables in sesame oil. Add soy sauce and serve over rice.',
        ingredients: [
          createIngredient('firm tofu', 300, 'g', ['none']),
          createIngredient('mixed vegetables', 250, 'g', ['none']),
          createIngredient('sesame oil', 1, 'tbsp', ['none']),
          createIngredient('soy sauce', 2, 'tbsp', ['none']),
          createIngredient('garlic', 2, 'cloves', ['none']),
        ],
      },
    ],
    'gluten-free': [
      {
        title: 'Gluten-Free Rice Bowl',
        cookingTimeMinutes: 30,
        prepTimeMinutes: 10,
        instructions:
          'Cook rice according to package directions. Top with roasted vegetables and protein of choice. Drizzle with sauce.',
        ingredients: [
          createIngredient('rice', 150, 'g', ['none']),
          createIngredient('vegetables', 300, 'g', ['none']),
          createIngredient('olive oil', 2, 'tbsp', ['none']),
          createIngredient('garlic', 2, 'cloves', ['none']),
          createIngredient('soy sauce', 1, 'tbsp', ['none']),
        ],
      },
    ],
    'lactose-free': [
      {
        title: 'Lactose-Free Pasta',
        cookingTimeMinutes: 30,
        prepTimeMinutes: 10,
        instructions:
          'Cook pasta. Make sauce with olive oil, garlic, and tomatoes. Toss pasta with sauce and fresh herbs.',
        ingredients: [
          createIngredient('pasta', 250, 'g', ['contains-gluten']),
          createIngredient('canned tomatoes', 400, 'g', ['none']),
          createIngredient('olive oil', 2, 'tbsp', ['none']),
          createIngredient('garlic', 3, 'cloves', ['none']),
          createIngredient('fresh basil', 10, 'g', ['none']),
        ],
      },
    ],
    pescatarian: [
      {
        title: 'Baked Fish with Vegetables',
        cookingTimeMinutes: 30,
        prepTimeMinutes: 10,
        instructions:
          'Season fish with herbs and lemon. Bake with vegetables at 400°F for 20-25 minutes until cooked through.',
        ingredients: [
          createIngredient('fish fillet', 300, 'g', ['contains-fish']),
          createIngredient('vegetables', 300, 'g', ['none']),
          createIngredient('lemon', 1, 'whole', ['none']),
          createIngredient('olive oil', 1, 'tbsp', ['none']),
          createIngredient('fresh herbs', 5, 'g', ['none']),
        ],
      },
      {
        title: 'Shrimp Pasta',
        cookingTimeMinutes: 30,
        prepTimeMinutes: 10,
        instructions:
          'Cook pasta. Sauté shrimp with garlic and white wine. Toss with cooked pasta and fresh herbs.',
        ingredients: [
          createIngredient('shrimp', 250, 'g', ['contains-fish']),
          createIngredient('pasta', 250, 'g', ['contains-gluten']),
          createIngredient('white wine', 100, 'ml', ['none']),
          createIngredient('garlic', 3, 'cloves', ['none']),
          createIngredient('olive oil', 1, 'tbsp', ['none']),
        ],
      },
    ],
  };

  const matches: Array<Partial<CreateRecipeInput>> = [];

  // Find recipes matching all dietary tags
  for (const tag of dietaryTags) {
    if (recipes[tag]) {
      matches.push(...recipes[tag]);
    }
  }

  // If main ingredient specified and found, prioritize those recipes
  if (mainIngredient) {
    const mainMatches = matches.filter(r =>
      r.title?.toLowerCase().includes(mainIngredient.toLowerCase())
    );
    if (mainMatches.length > 0) {
      return mainMatches;
    }
  }

  return matches.length > 0 ? matches : [];
}

/**
 * Customizes the recipe title based on generation criteria.
 * Includes information about main ingredients, cuisine, or flavor profile if specified.
 *
 * @param baseTitle - Base recipe title
 * @param criteria - Generation criteria
 * @returns Customized recipe title
 */
function customizeTitle(baseTitle: string, criteria: RecipeGenerationCriteria): string {
  let title = baseTitle;

  if (criteria.cuisine) {
    title = `${criteria.cuisine} ${title}`;
  }

  if (criteria.flavorProfile && !title.includes(criteria.flavorProfile)) {
    title = `${title} (${criteria.flavorProfile})`;
  }

  return title;
}

/**
 * Customizes ingredients based on generation criteria.
 * Adjusts dietary properties and ingredient selections based on constraints.
 *
 * @param baseIngredients - Base recipe ingredients
 * @param criteria - Generation criteria
 * @returns Customized ingredients list
 */
function customizeIngredients(
  baseIngredients: CreateIngredientInput[],
  criteria: RecipeGenerationCriteria
): CreateIngredientInput[] {
  let ingredients = [...baseIngredients];

  // Adjust dietary properties based on constraints
  const hasGlutenFree = criteria.dietaryTags.includes('gluten-free');
  const hasVegan = criteria.dietaryTags.includes('vegan');
  const hasLactoseFree = criteria.dietaryTags.includes('lactose-free');

  ingredients = ingredients.map(ing => {
    const properties = [...ing.dietaryProperties];

    // Remove conflicting properties
    if (hasGlutenFree && properties.includes('contains-gluten')) {
      return { ...ing, dietaryProperties: properties.filter(p => p !== 'contains-gluten') };
    }
    if (
      hasVegan &&
      (properties.includes('contains-meat') || properties.includes('contains-eggs'))
    ) {
      return {
        ...ing,
        dietaryProperties: properties.filter(p => p !== 'contains-meat' && p !== 'contains-eggs'),
      };
    }
    if (hasLactoseFree && properties.includes('contains-lactose')) {
      return { ...ing, dietaryProperties: properties.filter(p => p !== 'contains-lactose') };
    }

    return ing;
  });

  return ingredients;
}

/**
 * Returns a default generic recipe when no specific match is found.
 * Ensures a recipe can always be generated.
 *
 * @param criteria - Generation criteria
 * @returns Default recipe template
 */
function getDefaultRecipe(criteria: RecipeGenerationCriteria): CreateRecipeInput {
  return {
    title: 'Simple Vegetable Dish',
    cookingTimeMinutes: 30,
    prepTimeMinutes: 10,
    cookwareType: criteria.cookwareType || 'one-pot',
    servings: 2,
    dietaryTags: criteria.dietaryTags,
    seasonality: criteria.seasonality || ['any'],
    sourceType: 'ai-generated',
    sourceReference: 'Mock AI Generator',
    instructions:
      'Prepare vegetables and add to cooking vessel. Cook over medium heat until tender. Season to taste and serve.',
    ingredients: [
      createIngredient('vegetables', 400, 'g', ['none']),
      createIngredient('olive oil', 1, 'tbsp', ['none']),
      createIngredient('salt', 1, 'tsp', ['none']),
      createIngredient('pepper', 0.5, 'tsp', ['none']),
      createIngredient('water', 100, 'ml', ['none']),
    ],
  };
}

/**
 * Helper function to create a standardized ingredient object.
 *
 * @param name - Ingredient name
 * @param quantity - Ingredient quantity
 * @param unit - Unit of measurement
 * @param dietaryProperties - Dietary properties
 * @param orderIndex - Display order
 * @param optional - Whether ingredient is optional
 * @returns Ingredient object
 */
function createIngredient(
  name: string,
  quantity: number,
  unit: string,
  dietaryProperties: DietaryProperty[],
  orderIndex = 0,
  optional = false
): CreateIngredientInput {
  return {
    name,
    quantity,
    unit,
    dietaryProperties,
    optional,
    orderIndex,
  };
}
