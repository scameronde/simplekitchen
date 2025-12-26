import type { CreateRecipeInput, UpdateRecipeInput } from '../../shared/types/recipe';
import type { DietaryProfile } from '../../shared/types/recipe';
import type { ValidationError, ValidationResult } from '../../shared/types/validation';
import { validateDietaryConstraints } from './dietary-validator';
import { validateTimeConstraints } from './time-validator';
import { validateCookwareConstraints } from './cookware-validator';
import { validateServingsConstraints } from './servings-validator';
import { getDietaryProfile } from '../database/dal/dietary-profile';

// Validate recipe against ALL constraints
export async function validateRecipe(
  recipeInput: CreateRecipeInput | UpdateRecipeInput
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];

  // Get dietary profile for validation
  const profile = await getDietaryProfile();

  // Run all validators in parallel (they're independent)
  const [dietaryErrors, timeErrors, cookwareErrors, servingsErrors] = await Promise.all([
    validateDietaryConstraints(recipeInput, profile),
    Promise.resolve(validateTimeConstraints(recipeInput)),
    Promise.resolve(validateCookwareConstraints(recipeInput)),
    Promise.resolve(validateServingsConstraints(recipeInput)),
  ]);

  // Aggregate all errors
  errors.push(...dietaryErrors);
  errors.push(...timeErrors);
  errors.push(...cookwareErrors);
  errors.push(...servingsErrors);

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Validate recipe and throw error if invalid (for use in DAL)
export async function validateRecipeOrThrow(
  recipeInput: CreateRecipeInput | UpdateRecipeInput
): Promise<void> {
  const result = await validateRecipe(recipeInput);
  
  if (!result.valid) {
    const errorMessages = result.errors.map(e => `${e.field}: ${e.message}`).join('\n');
    throw new Error(`Recipe validation failed:\n${errorMessages}`);
  }
}
