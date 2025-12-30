/**
 * @module validation
 * Public validation API for recipe constraint checking.
 *
 * This barrel file provides a stable public interface for the validation layer.
 * Many functions are exported for future phases but not yet used in Phase 3.
 * See Phase 4-6 plans for usage in recipe browsing, AI generation, and import features.
 *
 * NOTE: Current internal code imports directly from validator files (e.g., './validator.js')
 * rather than using this barrel file. These exports are intentional and provide:
 * 1. A stable public API surface for future extension
 * 2. A clear contract for external modules
 * 3. Forward compatibility for planned features (Phase 4+)
 *
 * These exports are NOT dead code - they are part of the public API design.
 */

// Main validation orchestrator
export { validateRecipeOrThrow } from './validator.js';

/**
 * Validate a recipe and return detailed validation result.
 * @future Phase 4 - Recipe editing UI with inline validation feedback
 */
export { validateRecipe } from './validator.js';

// Individual validators (for granular use if needed)
/**
 * Validate dietary constraints against user profile.
 * @future Phase 4 - Recipe filtering by dietary compatibility
 */
export { validateDietaryConstraints } from './dietary-validator.js';

/**
 * Validate time constraints.
 * @future Phase 4 - Recipe filtering by time range
 */
export { validateTimeConstraints } from './time-validator.js';

/**
 * Get time constraint configuration.
 * @future Phase 4 - Display time constraints in filter UI
 */
export { getTimeConstraints } from './time-validator.js';

/**
 * Validate cookware constraints.
 * @future Phase 4 - Recipe filtering by cookware type
 */
export { validateCookwareConstraints } from './cookware-validator.js';

/**
 * Get valid cookware types.
 * @future Phase 4 - Populate cookware filter dropdown
 */
export { getValidCookwareTypes } from './cookware-validator.js';

/**
 * Validate servings constraints.
 * @future Phase 4 - Recipe editing validation
 */
export { validateServingsConstraints } from './servings-validator.js';

/**
 * Get required servings value.
 * @future Phase 4 - Display servings constraint in UI
 */
export { getRequiredServings } from './servings-validator.js';

// Static ingredient database
/**
 * Look up ingredient by name.
 * @future Phase 5 - AI recipe generation validation
 * @future Phase 6 - Web recipe import validation
 */
export { lookupIngredient } from './ingredient-database.js';

/**
 * Get ingredient dietary properties.
 * @future Phase 5 - AI recipe generation validation
 * @future Phase 6 - Web recipe import validation
 */
export { getIngredientProperties } from './ingredient-database.js';

/**
 * Check if ingredient is known safe.
 * @future Phase 5 - AI recipe generation validation
 * @future Phase 6 - Web recipe import validation
 */
export { isKnownSafe } from './ingredient-database.js';

/**
 * Get count of known ingredients in database.
 * @future Phase 4 - Display ingredient database statistics
 */
export { getKnownIngredientCount } from './ingredient-database.js';

/**
 * Raw ingredient database for advanced queries.
 * @future Phase 5 - AI recipe generation validation
 * @future Phase 6 - Web recipe import validation
 */
export { INGREDIENT_DATABASE } from './ingredient-database.js';

/**
 * Ingredient data type definition.
 * Public type for ingredient database entries. Required for consumers of lookupIngredient().
 * @future Phase 5 - AI recipe generation validation
 * @future Phase 6 - Web recipe import validation
 */
export { type IngredientData } from './ingredient-database.js';
