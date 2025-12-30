/**
 * @module schema-org-types
 * TypeScript type definitions for Schema.org Recipe format.
 * Based on https://schema.org/Recipe specification.
 * Used for web recipe import functionality.
 */

/**
 * Main Schema.org Recipe type.
 * Represents a recipe in Schema.org JSON-LD format with properties
 * commonly found in published web recipes.
 */
export interface SchemaOrgRecipe {
  '@context': string; // "https://schema.org"
  '@type': 'Recipe';
  name: string;
  image?: string | string[];
  author?: SchemaOrgPerson | string;
  datePublished?: string; // ISO 8601 date
  description?: string;
  recipeYield?: string | number; // "4 servings" or 4
  prepTime?: string; // ISO 8601 duration: "PT15M"
  cookTime?: string; // ISO 8601 duration: "PT30M"
  totalTime?: string; // ISO 8601 duration: "PT45M"
  recipeIngredient?: string[]; // ["2 cups flour", "1 tsp salt"]
  recipeInstructions?: string | SchemaOrgHowToStep[] | string[];
  recipeCuisine?: string;
  recipeCategory?: string;
  keywords?: string | string[];
  suitableForDiet?: string | string[]; // Schema.org diet type URLs
  tool?: string | SchemaOrgHowToTool[]; // Equipment/cookware
  nutrition?: SchemaOrgNutritionInformation;
  url?: string; // Original recipe URL
}

/**
 * Schema.org Person type.
 * Used to represent recipe authors.
 */
export interface SchemaOrgPerson {
  '@type': 'Person';
  name: string;
}

/**
 * Schema.org HowToStep type.
 * Represents a single step in recipe instructions.
 */
export interface SchemaOrgHowToStep {
  '@type': 'HowToStep';
  text: string;
  name?: string;
  url?: string;
}

/**
 * Schema.org HowToTool type.
 * Represents equipment or cookware needed for a recipe.
 */
export interface SchemaOrgHowToTool {
  '@type': 'HowToTool';
  name: string;
}

/**
 * Schema.org NutritionInformation type.
 * Represents nutritional information for a recipe.
 */
export interface SchemaOrgNutritionInformation {
  '@type': 'NutritionInformation';
  calories?: string;
  carbohydrateContent?: string;
  proteinContent?: string;
  fatContent?: string;
}
