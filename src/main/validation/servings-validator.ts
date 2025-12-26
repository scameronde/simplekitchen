import type { CreateRecipeInput, UpdateRecipeInput } from '../../shared/types/recipe';
import type { ValidationError } from '../../shared/types/validation';

const REQUIRED_SERVINGS = 2;

// Validate servings constraint (must be exactly 2)
export function validateServingsConstraints(
  recipeInput: CreateRecipeInput | UpdateRecipeInput
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check if servings is provided (required for create, optional for update)
  if (recipeInput.servings === undefined) {
    return errors; // Skip validation if not provided (update case)
  }

  const servings = recipeInput.servings;

  // Validate servings is exactly 2
  if (servings !== REQUIRED_SERVINGS) {
    errors.push({
      field: 'servings',
      constraint: 'servings-exact',
      message: `Servings must be exactly ${REQUIRED_SERVINGS}. Current: ${servings}.`,
      suggestedFix: `Adjust ingredient quantities to serve ${REQUIRED_SERVINGS} people.`,
    });
  }

  return errors;
}

// Get required servings (for UI display)
export function getRequiredServings(): number {
  return REQUIRED_SERVINGS;
}
