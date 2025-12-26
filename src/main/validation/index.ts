/**
 * Validation Layer - Barrel Export
 * 
 * Central export point for all recipe validation functionality.
 * Provides both high-level orchestration and granular validators.
 */

// Main validation orchestrator
export { validateRecipe, validateRecipeOrThrow } from './validator';

// Individual validators (for granular use if needed)
export { validateDietaryConstraints } from './dietary-validator';
export { validateTimeConstraints, getTimeConstraints } from './time-validator';
export { validateCookwareConstraints, getValidCookwareTypes } from './cookware-validator';
export { validateServingsConstraints, getRequiredServings } from './servings-validator';

// Static ingredient database
export {
  lookupIngredient,
  getIngredientProperties,
  isKnownSafe,
  getKnownIngredientCount,
  INGREDIENT_DATABASE,
  type IngredientData,
} from './ingredient-database';
