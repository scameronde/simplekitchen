import type { CreateRecipeInput, UpdateRecipeInput } from '../../shared/types/recipe.js';
import type { ValidationError, ValidationResult } from '../../shared/types/validation.js';
import { validateDietaryConstraints } from './dietary-validator.js';
import { validateTimeConstraints } from './time-validator.js';
import { validateCookwareConstraints } from './cookware-validator.js';
import { validateServingsConstraints } from './servings-validator.js';
import { getDietaryProfile } from '../database/dal/dietary-profile.js';

export interface ValidationOptions {
  skipDietaryValidation?: boolean;
}

// Validate recipe against ALL constraints
export async function validateRecipe(
  recipeInput: CreateRecipeInput | UpdateRecipeInput,
  options: ValidationOptions = {}
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];

  // Get dietary profile for validation (unless skipped)
  const profile = options.skipDietaryValidation ? null : await getDietaryProfile();

  // Run all validators in parallel (they're independent)
  const [dietaryErrors, timeErrors, cookwareErrors, servingsErrors] = await Promise.all([
    profile ? validateDietaryConstraints(recipeInput, profile) : Promise.resolve([]),
    Promise.resolve(validateTimeConstraints(recipeInput)),
    Promise.resolve(validateCookwareConstraints(recipeInput)),
    Promise.resolve(validateServingsConstraints(recipeInput)),
  ]);

  // Aggregate all errors
  errors.push(...dietaryErrors);
  errors.push(...timeErrors);
  errors.push(...cookwareErrors);
  errors.push(...servingsErrors);

  // Only fail validation if there are actual errors (not warnings)
  const actualErrors = errors.filter(e => (e.severity ?? 'error') === 'error');

  return {
    valid: actualErrors.length === 0,
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
