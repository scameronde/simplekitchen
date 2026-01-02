/**
 * @module recipe-import-handlers.mock
 * Mock implementation of web recipe import handler for testing.
 * Provides realistic sample recipes without performing actual web fetches.
 * Supports test signals for various scenarios and error cases.
 *
 * Test Signal Usage:
 * - Pass URL containing 'network-error-test' to simulate fetch/network error
 * - Pass URL containing 'no-recipe-test' to simulate page with no Recipe markup
 * - Pass URL containing 'multiple-recipes-test' to simulate page with multiple recipes
 * - Pass URL with invalid format to simulate URL validation error
 * - Pass any valid URL format (http:// or https://) for successful recipe extraction
 *
 * Example:
 * ```typescript
 * // Success case - extracts sample recipe
 * const result = await mockImportRecipe('https://example.com/pasta-recipe');
 *
 * // Simulate network error
 * const result = await mockImportRecipe('https://network-error-test.com/recipe');
 *
 * // Simulate no recipe found
 * const result = await mockImportRecipe('https://no-recipe-test.com');
 *
 * // Simulate multiple recipes
 * const result = await mockImportRecipe('https://multiple-recipes-test.com/recipes');
 * ```
 */

import type { CreateRecipeInput, CreateIngredientInput } from '../../shared/types/recipe.js';
import type { SchemaOrgRecipe } from '../../shared/types/schema-org.js';

/**
 * Response type for web recipe import.
 * Either returns success with parsed recipe, or failure with validation errors.
 */
export type ImportResponse =
  | {
      success: true;
      recipe: CreateRecipeInput;
    }
  | {
      success: false;
      errors: Array<{ field: string; message: string }>;
    };

/**
 * Mock implementation of web recipe import handler.
 * Detects test signals in the URL to simulate various scenarios.
 *
 * @param url - The URL to "import" a recipe from
 * @returns Promise resolving to import result (success with recipe or error)
 *
 * Test Signals:
 * - URL contains 'network-error-test': Simulates fetch/network error
 * - URL contains 'no-recipe-test': Simulates page with no Schema.org recipe
 * - URL contains 'multiple-recipes-test': Simulates page with multiple recipes
 * - Invalid URL format (not http:// or https://): Simulates URL validation error
 * - Valid URL format: Returns mock recipe data
 */
export async function mockImportRecipe(url: unknown): Promise<ImportResponse> {
  // Validate URL format first
  const urlValidation = validateUrlFormat(url);
  if (!urlValidation.valid) {
    return {
      success: false,
      errors: [{ field: 'url', message: urlValidation.message }],
    };
  }

  const urlString = url as string;

  // Detect network error test signal
  if (urlString.includes('network-error-test')) {
    return {
      success: false,
      errors: [{ field: 'general', message: 'Failed to fetch recipe from URL' }],
    };
  }

  // Detect no recipe found test signal
  if (urlString.includes('no-recipe-test')) {
    return {
      success: false,
      errors: [{ field: 'general', message: 'No Schema.org recipe markup found on this page' }],
    };
  }

  // Detect multiple recipes test signal
  if (urlString.includes('multiple-recipes-test')) {
    return {
      success: false,
      errors: [
        {
          field: 'general',
          message: 'Multiple recipes found on this page. Please specify which recipe to use.',
        },
      ],
    };
  }

  // Success case: return mock recipe based on URL pattern
  const mockRecipe = selectMockRecipe(urlString);

  return {
    success: true,
    recipe: mockRecipe,
  };
}

/**
 * Validates URL format for web recipe import.
 * Must be a non-empty string starting with http:// or https://
 *
 * @param url - The URL to validate
 * @returns { valid: true } or { valid: false, message: string }
 */
function validateUrlFormat(url: unknown): { valid: true } | { valid: false; message: string } {
  if (typeof url !== 'string' || url.trim().length === 0) {
    return { valid: false, message: 'URL must be a non-empty string' };
  }

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return {
      valid: false,
      message: 'Invalid URL format. Must start with http:// or https://',
    };
  }

  return { valid: true };
}

/**
 * Selects and converts an appropriate mock recipe based on the URL.
 * Matches URLs to recipe templates and converts to CreateRecipeInput format.
 *
 * @param url - The recipe URL
 * @returns CreateRecipeInput ready for database insertion
 */
function selectMockRecipe(url: string): CreateRecipeInput {
  const lowerUrl = url.toLowerCase();

  // Select recipe based on URL keywords
  if (lowerUrl.includes('pasta')) {
    return schemaOrgToRecipeInput(getMockPastaRecipe(), url);
  }

  if (lowerUrl.includes('curry') || lowerUrl.includes('vegetarian')) {
    return schemaOrgToRecipeInput(getMockCurryRecipe(), url);
  }

  if (lowerUrl.includes('fish') || lowerUrl.includes('salmon') || lowerUrl.includes('grill')) {
    return schemaOrgToRecipeInput(getMockFishRecipe(), url);
  }

  // Long recipe for testing validation failures (60 minute cooking time)
  if (lowerUrl.includes('long-recipe')) {
    return schemaOrgToRecipeInput(getMockLongRecipe(), url);
  }

  // Default recipe
  return schemaOrgToRecipeInput(getMockDefaultRecipe(), url);
}

/**
 * Converts mock Schema.org recipe to CreateRecipeInput format.
 * Simplified version of schema-org-adapter that handles mock data conversion.
 *
 * @param schemaRecipe - Mock recipe in Schema.org JSON-LD format
 * @param sourceUrl - Original recipe URL
 * @returns CreateRecipeInput object
 */
function schemaOrgToRecipeInput(
  schemaRecipe: SchemaOrgRecipe,
  sourceUrl: string
): CreateRecipeInput {
  const prepTimeMinutes = schemaRecipe.prepTime ? parseDuration(schemaRecipe.prepTime) : 10;
  const cookingTimeMinutes = schemaRecipe.cookTime ? parseDuration(schemaRecipe.cookTime) : 30;
  const servings = parseServings(schemaRecipe.recipeYield);
  const instructions = concatenateInstructions(schemaRecipe.recipeInstructions);

  // Parse ingredients
  const ingredients: CreateIngredientInput[] = (schemaRecipe.recipeIngredient || []).map(
    (ingredientString, index) => parseIngredient(ingredientString, index)
  );

  return {
    title: schemaRecipe.name,
    cookingTimeMinutes: cookingTimeMinutes > 0 ? cookingTimeMinutes : 30,
    prepTimeMinutes: prepTimeMinutes > 0 ? prepTimeMinutes : undefined,
    cookwareType: inferCookwareType(instructions),
    servings: servings > 0 ? servings : 2,
    dietaryTags: [],
    seasonality: ['any'],
    sourceType: 'web-imported',
    sourceReference: sourceUrl,
    instructions,
    ingredients,
  };
}

/**
 * Parses ISO 8601 duration string to minutes.
 * Examples: "PT30M" → 30, "PT1H30M" → 90, "PT45S" → 1
 *
 * @param iso - ISO 8601 duration string
 * @returns Duration in minutes, or 0 if parsing fails
 */
function parseDuration(iso: string): number {
  const regex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
  const match = iso.match(regex);

  if (!match) {
    return 0;
  }

  const hours = match[1] ? parseInt(match[1], 10) : 0;
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const seconds = match[3] ? parseInt(match[3], 10) : 0;

  return hours * 60 + minutes + Math.ceil(seconds / 60);
}

/**
 * Parses servings from string or number format.
 *
 * @param yield_ - Servings in format "4 servings" or number 4
 * @returns Number of servings, or 2 if parsing fails
 */
function parseServings(yield_: string | number | undefined): number {
  if (typeof yield_ === 'number') {
    return yield_;
  }

  if (typeof yield_ === 'string') {
    const match = yield_.match(/\d+/);
    if (match) {
      return parseInt(match[0], 10);
    }
  }

  return 2;
}

/**
 * Parses ingredient string into structured format.
 * Examples: "2 cups flour" → { name: "flour", quantity: 2, unit: "cups" }
 *
 * @param ingredientString - Raw ingredient string from Schema.org
 * @param index - Order index for display
 * @returns CreateIngredientInput object
 */
function parseIngredient(ingredientString: string, index: number): CreateIngredientInput {
  // Defensive check for invalid input
  if (!ingredientString || typeof ingredientString !== 'string') {
    console.warn('[parseIngredient] Invalid ingredient string:', ingredientString);
    return {
      name: 'Unknown ingredient',
      quantity: 1,
      unit: '',
      dietaryProperties: [],
      optional: false,
      orderIndex: index,
    };
  }

  const match = ingredientString.match(/^(?:(\d+(?:\.\d+)?)\s*([a-zA-Z]+))?\s*(.+)$/);

  let quantity = 1;
  let unit = '';
  let name = ingredientString.trim();

  if (match && match[3]) {
    if (match[1]) {
      const parsedQuantity = parseFloat(match[1]);
      // Validate quantity is a positive number
      if (!isNaN(parsedQuantity) && parsedQuantity > 0) {
        quantity = parsedQuantity;
      }
    }
    if (match[2]) {
      unit = match[2].toLowerCase();
    }
    name = match[3].trim();
  }

  // Validate name is not empty after parsing
  if (!name) {
    console.warn('[parseIngredient] Empty ingredient name after parsing:', ingredientString);
    name = ingredientString.trim() || 'Unknown ingredient';
  }

  return {
    name,
    quantity,
    unit,
    dietaryProperties: [],
    optional: false,
    orderIndex: index,
  };
}

/**
 * Infers cookware type from recipe instructions.
 * Searches for common cookware keywords.
 *
 * @param instructions - Recipe instructions text
 * @returns Cookware type string
 */
function inferCookwareType(instructions?: string): 'one-pot' | 'one-pan' | 'oven' {
  if (!instructions) {
    return 'one-pan';
  }

  const lowerInstructions = instructions.toLowerCase();

  if (lowerInstructions.includes('pan') || lowerInstructions.includes('skillet')) {
    return 'one-pan';
  }

  if (lowerInstructions.includes('pot')) {
    return 'one-pot';
  }

  if (lowerInstructions.includes('oven')) {
    return 'oven';
  }

  return 'one-pan';
}

/**
 * Concatenates recipe instructions from various formats.
 * Handles string, array of strings, or array of HowToStep objects.
 *
 * @param instructions - Recipe instructions in various formats
 * @returns Concatenated instruction string
 */
function concatenateInstructions(
  instructions?: string | Array<{ text: string }> | string[]
): string | undefined {
  if (!instructions) {
    return undefined;
  }

  if (typeof instructions === 'string') {
    return instructions;
  }

  if (Array.isArray(instructions)) {
    if (
      instructions.length > 0 &&
      typeof instructions[0] === 'object' &&
      'text' in instructions[0]
    ) {
      return (instructions as Array<{ text: string }>).map(step => step.text).join('\n');
    }

    return (instructions as string[]).join('\n');
  }

  return undefined;
}

/**
 * Returns a mock pasta recipe in Schema.org JSON-LD format.
 *
 * @returns Mock Schema.org recipe object
 */
function getMockPastaRecipe(): SchemaOrgRecipe {
  return {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: 'Simple Pasta Carbonara',
    description: 'Classic Italian pasta carbonara with eggs, cheese, and pancetta',
    prepTime: 'PT10M',
    cookTime: 'PT15M',
    totalTime: 'PT25M',
    recipeYield: '2',
    recipeIngredient: [
      '250g spaghetti',
      '150g pancetta',
      '2 large eggs',
      '100g pecorino cheese',
      '2 cloves garlic',
      '1 tsp salt',
      '1 tsp black pepper',
    ],
    recipeInstructions: `1. Bring a large pot of salted water to a boil and cook spaghetti until al dente.
2. Meanwhile, cook pancetta in a large pan over medium heat until crispy, about 5 minutes.
3. In a bowl, whisk together eggs and grated cheese.
4. Reserve 1 cup of pasta cooking water, then drain pasta.
5. Add hot pasta to the pan with pancetta (off heat).
6. Pour egg mixture over pasta and toss quickly, adding reserved pasta water as needed to create a creamy sauce.
7. Season with salt and pepper, then serve immediately.`,
  };
}

/**
 * Returns a mock vegetarian curry recipe in Schema.org JSON-LD format.
 *
 * @returns Mock Schema.org recipe object
 */
function getMockCurryRecipe(): SchemaOrgRecipe {
  return {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: 'Vegetable Curry',
    description: 'Quick and aromatic vegetable curry with coconut milk',
    prepTime: 'PT15M',
    cookTime: 'PT25M',
    totalTime: 'PT40M',
    recipeYield: '2',
    recipeIngredient: [
      '2 tbsp vegetable oil',
      '1 onion, diced',
      '3 cloves garlic, minced',
      '2 tbsp curry paste',
      '400ml coconut milk',
      '300g mixed vegetables (bell peppers, zucchini, broccoli)',
      '1 tbsp fish sauce',
      '1 lime, juiced',
    ],
    recipeInstructions: [
      {
        '@type': 'HowToStep',
        text: 'Heat vegetable oil in a large pot or pan over medium heat.',
      },
      {
        '@type': 'HowToStep',
        text: 'Add diced onion and cook until softened, about 3 minutes.',
      },
      {
        '@type': 'HowToStep',
        text: 'Stir in minced garlic and curry paste, cook for 1 minute until fragrant.',
      },
      {
        '@type': 'HowToStep',
        text: 'Pour in coconut milk and bring to a simmer.',
      },
      {
        '@type': 'HowToStep',
        text: 'Add mixed vegetables and simmer for 15-20 minutes until tender.',
      },
      {
        '@type': 'HowToStep',
        text: 'Season with fish sauce and lime juice. Serve hot.',
      },
    ],
  };
}

/**
 * Returns a mock fish recipe in Schema.org JSON-LD format.
 *
 * @returns Mock Schema.org recipe object
 */
function getMockFishRecipe(): SchemaOrgRecipe {
  return {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: 'Baked Salmon with Herbs',
    description: 'Healthy baked salmon fillet with fresh herbs and lemon',
    prepTime: 'PT10M',
    cookTime: 'PT20M',
    totalTime: 'PT30M',
    recipeYield: '2',
    recipeIngredient: [
      '2 salmon fillets (150g each)',
      '2 tbsp olive oil',
      '1 lemon',
      '2 cloves garlic, minced',
      '1 tbsp fresh dill, chopped',
      '1 tbsp fresh parsley, chopped',
      'Salt and pepper to taste',
      '200g asparagus',
    ],
    recipeInstructions: `1. Preheat oven to 400°F (200°C).
2. Place salmon fillets on a baking sheet lined with parchment paper.
3. Drizzle with olive oil and season with salt and pepper.
4. Top with minced garlic, dill, and parsley.
5. Arrange asparagus around the salmon.
6. Squeeze lemon juice over everything and place lemon slices on top.
7. Bake for 15-20 minutes until salmon is cooked through and flakes easily.
8. Serve immediately with lemon wedges.`,
  };
}

/**
 * Returns a default mock recipe in Schema.org JSON-LD format.
 * Used when no specific recipe template matches the URL.
 *
 * @returns Mock Schema.org recipe object
 */
function getMockDefaultRecipe(): SchemaOrgRecipe {
  return {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: 'Stir-Fried Vegetables',
    description: 'Quick and easy vegetable stir-fry with soy sauce and garlic',
    prepTime: 'PT10M',
    cookTime: 'PT15M',
    totalTime: 'PT25M',
    recipeYield: '2',
    recipeIngredient: [
      '2 tbsp vegetable oil',
      '300g mixed vegetables (bell peppers, broccoli, snap peas, carrots)',
      '3 cloves garlic, minced',
      '1 tbsp soy sauce',
      '1 tsp sesame oil',
      '1 tsp ginger, minced',
      '100ml vegetable broth',
      '1 tbsp cornstarch',
    ],
    recipeInstructions: `1. Heat vegetable oil in a large pan or wok over high heat.
2. Add garlic and ginger, stir-fry for 30 seconds until fragrant.
3. Add all vegetables and stir-fry for 5-7 minutes until tender-crisp.
4. Mix cornstarch with vegetable broth and pour into the pan.
5. Add soy sauce and sesame oil, stirring constantly.
6. Cook for 2-3 minutes until sauce thickens.
7. Serve hot, optionally over rice.`,
  };
}

/**
 * Returns a mock recipe with 60-minute cooking time for validation testing.
 * Used to test validation failure and correction workflows.
 *
 * @returns Mock Schema.org recipe object with long cooking time
 */
function getMockLongRecipe(): SchemaOrgRecipe {
  return {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: 'Imported Recipe',
    description: 'A recipe with cooking time that violates the 60-minute maximum constraint',
    prepTime: 'PT15M',
    cookTime: 'PT75M',
    totalTime: 'PT90M',
    recipeYield: '2',
    recipeIngredient: [
      '500g pasta',
      '2 tbsp olive oil',
      '1 onion, diced',
      '3 cloves garlic, minced',
      '400ml vegetable broth',
      '200g tomatoes, diced',
      '1 tsp basil',
      'Salt and pepper to taste',
    ],
    recipeInstructions: `1. Heat olive oil in a large pot over medium heat.
2. Add diced onion and cook until softened, about 5 minutes.
3. Add garlic and cook for 1 minute until fragrant.
4. Add tomatoes and cook for 5 minutes.
5. Pour in vegetable broth and bring to a boil.
6. Add pasta and basil, cook for 12-15 minutes until pasta is al dente.
7. Season with salt and pepper, then serve hot.`,
  };
}
