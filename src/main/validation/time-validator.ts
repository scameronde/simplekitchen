import type { CreateRecipeInput, UpdateRecipeInput } from '../../shared/types/recipe.js';
import type { ValidationError } from '../../shared/types/validation.js';

const MIN_TOTAL_TIME = 0;
const MAX_TOTAL_TIME = 60;

/**
 * Validate time constraints for recipes.
 * Validates total time (prep time + cooking time) against minimum and maximum limits.
 * Total time = prepTimeMinutes + cookingTimeMinutes
 */
export function validateTimeConstraints(
  recipeInput: CreateRecipeInput | UpdateRecipeInput
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check if cookingTimeMinutes is provided (required for create, optional for update)
  if (recipeInput.cookingTimeMinutes === undefined) {
    return errors; // Skip validation if not provided (update case)
  }

  const cookingTime = recipeInput.cookingTimeMinutes;
  const totalTime = (recipeInput.prepTimeMinutes || 0) + cookingTime;

  // Validate minimum total time (0 minutes or positive)
  if (totalTime < MIN_TOTAL_TIME) {
    errors.push({
      field: 'totalTimeMinutes',
      constraint: 'time-minimum',
      message: `Total time (prep + cook) must be at least ${MIN_TOTAL_TIME} minutes (zero or positive). Current: ${totalTime} minutes.`,
      suggestedFix: `Reduce prep time or cook time to reach ${MIN_TOTAL_TIME} minutes or more.`,
    });
  }

  // Validate maximum total time (60 minutes)
  if (totalTime > MAX_TOTAL_TIME) {
    errors.push({
      field: 'totalTimeMinutes',
      constraint: 'time-maximum',
      message: `Total time (prep + cook) must be at most ${MAX_TOTAL_TIME} minutes. Current: ${totalTime} minutes.`,
      suggestedFix: `Reduce prep time or cook time to ${MAX_TOTAL_TIME} minutes or less, or simplify the recipe.`,
    });
  }

  return errors;
}

// Get time constraint limits (for UI display)
export function getTimeConstraints(): { min: number; max: number } {
  return {
    min: MIN_TOTAL_TIME,
    max: MAX_TOTAL_TIME,
  };
}
