import type { CreateRecipeInput, UpdateRecipeInput } from '../../shared/types/recipe.js';
import type { ValidationError } from '../../shared/types/validation.js';

const MIN_COOKING_TIME = 0;
const MAX_COOKING_TIME = 60;

// Validate cooking time constraint
export function validateTimeConstraints(
  recipeInput: CreateRecipeInput | UpdateRecipeInput
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check if cookingTimeMinutes is provided (required for create, optional for update)
  if (recipeInput.cookingTimeMinutes === undefined) {
    return errors; // Skip validation if not provided (update case)
  }

  const cookingTime = recipeInput.cookingTimeMinutes;

  // Validate minimum cooking time (0 minutes or positive)
  if (cookingTime < MIN_COOKING_TIME) {
    errors.push({
      field: 'cookingTimeMinutes',
      constraint: 'time-minimum',
      message: `Cooking time must be at least ${MIN_COOKING_TIME} minutes (zero or positive). Current: ${cookingTime} minutes.`,
      suggestedFix: `Set cooking time to ${MIN_COOKING_TIME} minutes or more.`,
    });
  }

  // Validate maximum cooking time (60 minutes)
  if (cookingTime > MAX_COOKING_TIME) {
    errors.push({
      field: 'cookingTimeMinutes',
      constraint: 'time-maximum',
      message: `Cooking time must be at most ${MAX_COOKING_TIME} minutes. Current: ${cookingTime} minutes.`,
      suggestedFix: `Reduce cooking time to ${MAX_COOKING_TIME} minutes or less, or simplify the recipe.`,
    });
  }

  return errors;
}

// Get time constraint limits (for UI display)
export function getTimeConstraints(): { min: number; max: number } {
  return {
    min: MIN_COOKING_TIME,
    max: MAX_COOKING_TIME,
  };
}
