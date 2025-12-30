/**
 * @module database
 * Public database API for recipe management.
 *
 * This barrel file provides a stable public interface for the database layer.
 * Many functions are exported for future phases but not yet used in Phase 3.
 * See Phase 4 plan for recipe browsing/filtering usage.
 *
 * NOTE: Current internal code imports directly from DAL files (e.g., './dal/recipes.js')
 * rather than using this barrel file. These exports are intentional and provide:
 * 1. A stable public API surface for future extension
 * 2. A clear contract for external modules
 * 3. Forward compatibility for planned features (Phase 4+)
 *
 * These exports are NOT dead code - they are part of the public API design.
 */

// Database initialization and connection
export { db, closeDatabase } from './init.js';

/**
 * Raw database instance for advanced queries.
 * @internal Consider removing from public API - should be internal-only
 * @deprecated Use typed `db` instance instead
 */
export { rawDb } from './init.js';

export { runMigrations } from './migrations.js';

// Data Access Layer - Recipes
export { createRecipe, getRecipeById, updateRecipe } from './dal/recipes.js';

/**
 * Fetch all recipes with optional filtering.
 * @future Phase 4 - Recipe browsing and filtering UI
 */
export { getRecipes } from './dal/recipes.js';

/**
 * Delete a recipe by ID.
 * @future Phase 4 - Recipe management UI
 */
export { deleteRecipe } from './dal/recipes.js';

/**
 * Get total recipe count.
 * @future Phase 4 - Recipe list pagination and statistics
 */
export { getRecipeCount } from './dal/recipes.js';

// Data Access Layer - Dietary Profile
/**
 * Get user's dietary profile.
 * @future Phase 4 - Profile management UI
 */
export { getDietaryProfile } from './dal/dietary-profile.js';

/**
 * Update user's dietary profile.
 * @future Phase 4 - Profile management UI
 */
export { updateDietaryProfile } from './dal/dietary-profile.js';

/**
 * Reset dietary profile to defaults.
 * @future Phase 4 - Profile management UI
 */
export { resetDietaryProfile } from './dal/dietary-profile.js';
