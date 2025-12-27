/**
 * Validation Layer - Barrel Export
 * 
 * Central export point for all recipe validation functionality.
 * Provides both high-level orchestration and granular validators.
 */

// Main validation orchestrator
export { validateRecipe, validateRecipeOrThrow } from './validator.js';

// Individual validators (for granular use if needed)
export { validateDietaryConstraints } from './dietary-validator.js';
export { validateTimeConstraints, getTimeConstraints } from './time-validator.js';
export { validateCookwareConstraints, getValidCookwareTypes } from './cookware-validator.js';
export { validateServingsConstraints, getRequiredServings } from './servings-validator.js';

// Static ingredient database
export {
  lookupIngredient,
  getIngredientProperties,
  isKnownSafe,
  getKnownIngredientCount,
  INGREDIENT_DATABASE,
  type IngredientData,
} from './ingredient-database.js';
