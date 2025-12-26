// Database initialization and connection
export { db, rawDb, closeDatabase } from './init';
export { runMigrations } from './migrations';

// Data Access Layer - Recipes
export {
  createRecipe,
  getRecipeById,
  getRecipes,
  updateRecipe,
  deleteRecipe,
  getRecipeCount,
} from './dal/recipes';

// Data Access Layer - Dietary Profile
export {
  getDietaryProfile,
  updateDietaryProfile,
  resetDietaryProfile,
} from './dal/dietary-profile';
