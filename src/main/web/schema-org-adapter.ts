/**
 * @module schema-org-adapter
 * Converts Schema.org Recipe format to CreateRecipeInput format.
 * Handles parsing of ISO 8601 durations, ingredient strings, and dietary mappings.
 */

import type { SchemaOrgRecipe, SchemaOrgHowToStep } from '../../shared/types/schema-org.js';
import type {
  CreateRecipeInput,
  CreateIngredientInput,
  DietaryTag,
} from '../../shared/types/recipe.js';

/**
 * Parses ISO 8601 duration string to minutes.
 * Examples:
 *   "PT30M" → 30
 *   "PT1H30M" → 90
 *   "PT45S" → 1 (rounded up)
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

  return 2; // Default to 2 servings
}

/**
 * Parses ingredient string into structured format.
 * Examples:
 *   "2 cups flour" → { name: "flour", quantity: 2, unit: "cups" }
 *   "1 teaspoon salt" → { name: "salt", quantity: 1, unit: "teaspoon" }
 * @param ingredientString - Raw ingredient string from Schema.org
 * @param index - Order index for display
 * @returns CreateIngredientInput object
 */
function parseIngredient(ingredientString: string, index: number): CreateIngredientInput {
  // Pattern: optional quantity/unit followed by ingredient name
  // Matches patterns like "2 cups flour", "1 tbsp olive oil", "salt to taste"
  const match = ingredientString.match(/^(?:(\d+(?:\.\d+)?)\s*([a-zA-Z]+))?\s*(.+)$/);

  let quantity = 1;
  let unit = '';
  let name = ingredientString;

  if (match && match[3]) {
    if (match[1]) {
      quantity = parseFloat(match[1]);
    }
    if (match[2]) {
      unit = match[2].toLowerCase();
    }
    name = match[3].trim();
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
 * Maps Schema.org diet types to application DietaryTag values.
 * Handles both string and array inputs.
 * @param suitableForDiet - Schema.org diet type URL(s)
 * @returns Array of matched DietaryTag values
 */
function mapDietaryTags(suitableForDiet: string | string[] | undefined): DietaryTag[] {
  if (!suitableForDiet) {
    return [];
  }

  const dietaryMap: Record<string, DietaryTag> = {
    'https://schema.org/GlutenFreeDiet': 'gluten-free',
    'https://schema.org/LowLactoseDiet': 'lactose-free',
    'https://schema.org/VegetarianDiet': 'vegetarian',
    'https://schema.org/VeganDiet': 'vegan',
    'https://schema.org/PescatarianDiet': 'pescatarian',
  };

  const diets = Array.isArray(suitableForDiet) ? suitableForDiet : [suitableForDiet];

  return diets.map(diet => dietaryMap[diet]).filter((tag): tag is DietaryTag => tag !== undefined);
}

/**
 * Infers cookware type from recipe instructions.
 * Searches for common cookware keywords in instructions.
 * @param instructions - Recipe instructions text
 * @returns Cookware type string
 */
function inferCookwareType(instructions?: string): 'one-pot' | 'one-pan' | 'oven' {
  if (!instructions) {
    return 'one-pan'; // Default
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

  if (lowerInstructions.includes('grill')) {
    return 'one-pan'; // Default to one-pan for grill
  }

  return 'one-pan'; // Default
}

/**
 * Concatenates recipe instructions from various formats.
 * Handles string, HowToStep array, or string array formats.
 * @param instructions - Recipe instructions in various formats
 * @returns Concatenated instruction string
 */
function concatenateInstructions(
  instructions?: string | SchemaOrgHowToStep[] | string[]
): string | undefined {
  if (!instructions) {
    return undefined;
  }

  if (typeof instructions === 'string') {
    return instructions;
  }

  if (Array.isArray(instructions)) {
    // Check if it's an array of HowToStep objects
    if (
      instructions.length > 0 &&
      typeof instructions[0] === 'object' &&
      'text' in instructions[0]
    ) {
      const howToSteps = instructions as SchemaOrgHowToStep[];
      return howToSteps.map(step => step.text).join('\n');
    }

    // Otherwise it's a string array
    const stringInstructions = instructions as string[];
    return stringInstructions.join('\n');
  }

  return undefined;
}

/**
 * Converts Schema.org Recipe format to CreateRecipeInput format.
 * Parses ISO 8601 durations, ingredient strings, and maps dietary tags.
 * @param schemaRecipe - Recipe in Schema.org JSON-LD format
 * @param sourceUrl - Original recipe URL
 * @returns CreateRecipeInput object ready for database insertion
 * @throws Error if required fields are missing or invalid
 */
export function schemaOrgToRecipeInput(
  schemaRecipe: SchemaOrgRecipe,
  sourceUrl: string
): CreateRecipeInput {
  // Validate required fields
  if (!schemaRecipe.name || !schemaRecipe.name.trim()) {
    throw new Error('Recipe name is required');
  }

  if (!schemaRecipe.recipeIngredient || schemaRecipe.recipeIngredient.length === 0) {
    throw new Error('At least one ingredient is required');
  }

  // Parse times
  const prepTimeMinutes = schemaRecipe.prepTime ? parseDuration(schemaRecipe.prepTime) : 0;
  const cookingTimeMinutes = schemaRecipe.cookTime ? parseDuration(schemaRecipe.cookTime) : 30;

  // Ensure we have a positive cooking time
  const finalCookingTime = cookingTimeMinutes > 0 ? cookingTimeMinutes : 30;

  // Parse instructions
  const instructionsText = concatenateInstructions(schemaRecipe.recipeInstructions);

  // Infer cookware type
  const cookwareType = inferCookwareType(instructionsText);

  // Parse ingredients
  const ingredients: CreateIngredientInput[] = schemaRecipe.recipeIngredient.map(
    (ingredientString, index) => parseIngredient(ingredientString, index)
  );

  // Parse servings
  const servings = parseServings(schemaRecipe.recipeYield);

  // Map dietary tags
  const dietaryTags = mapDietaryTags(schemaRecipe.suitableForDiet);

  return {
    title: schemaRecipe.name.trim(),
    cookingTimeMinutes: finalCookingTime,
    prepTimeMinutes: prepTimeMinutes > 0 ? prepTimeMinutes : undefined,
    cookwareType,
    servings: servings > 0 ? servings : 2,
    dietaryTags,
    seasonality: ['any'],
    sourceType: 'web-imported',
    sourceReference: sourceUrl,
    instructions: instructionsText,
    ingredients,
  };
}
