// Database initialization and connection
export { db, rawDb, closeDatabase } from './init.js';
export { runMigrations } from './migrations.js';

// Data Access Layer - Recipes
export {
  createRecipe,
  getRecipeById,
  getRecipes,
  updateRecipe,
  deleteRecipe,
  getRecipeCount,
} from './dal/recipes.js';

// Data Access Layer - Dietary Profile
export {
  getDietaryProfile,
  updateDietaryProfile,
  resetDietaryProfile,
} from './dal/dietary-profile.js';
