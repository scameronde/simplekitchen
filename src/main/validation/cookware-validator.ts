import type { CreateRecipeInput, UpdateRecipeInput } from '../../shared/types/recipe';
import type { CookwareType } from '../../shared/types/database';
import type { ValidationError } from '../../shared/types/validation';

const VALID_COOKWARE_TYPES: CookwareType[] = ['one-pot', 'one-pan', 'oven'];

// Validate cookware constraint (must be one of allowed types)
export function validateCookwareConstraints(
  recipeInput: CreateRecipeInput | UpdateRecipeInput
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check if cookwareType is provided (required for create, optional for update)
  if (recipeInput.cookwareType === undefined) {
    return errors; // Skip validation if not provided (update case)
  }

  const cookwareType = recipeInput.cookwareType;

  // Validate cookware type is one of allowed values
  if (!VALID_COOKWARE_TYPES.includes(cookwareType)) {
    errors.push({
      field: 'cookwareType',
      constraint: 'cookware-single',
      message: `Cookware type must be one of: ${VALID_COOKWARE_TYPES.join(', ')}. Current: "${cookwareType}".`,
      suggestedFix: 'Choose a recipe that uses minimal cookware (one pot, one pan, or oven only).',
    });
  }

  return errors;
}

// Get valid cookware types (for UI display)
export function getValidCookwareTypes(): CookwareType[] {
  return [...VALID_COOKWARE_TYPES];
}
