import { describe, it, expect } from 'vitest';
import { validateCookwareConstraints, getValidCookwareTypes } from './cookware-validator';
import type { CreateRecipeInput } from '../../shared/types/recipe';

describe('Cookware Constraint Validator', () => {
  const baseRecipe: Partial<CreateRecipeInput> = {
    title: 'Test Recipe',
    cookingTimeMinutes: 30,
    servings: 2,
  };

  it('should accept one-pot cookware', () => {
    const recipe = { ...baseRecipe, cookwareType: 'one-pot' as const };
    const errors = validateCookwareConstraints(recipe as CreateRecipeInput);
    expect(errors).toHaveLength(0);
  });

  it('should accept one-pan cookware', () => {
    const recipe = { ...baseRecipe, cookwareType: 'one-pan' as const };
    const errors = validateCookwareConstraints(recipe as CreateRecipeInput);
    expect(errors).toHaveLength(0);
  });

  it('should accept oven cookware', () => {
    const recipe = { ...baseRecipe, cookwareType: 'oven' as const };
    const errors = validateCookwareConstraints(recipe as CreateRecipeInput);
    expect(errors).toHaveLength(0);
  });

  it('should reject invalid cookware type', () => {
    const recipe = { ...baseRecipe, cookwareType: 'multi-pot' as any };
    const errors = validateCookwareConstraints(recipe as CreateRecipeInput);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraint).toBe('cookware-single');
  });

  it('should return valid cookware types', () => {
    const types = getValidCookwareTypes();
    expect(types).toEqual(['one-pot', 'one-pan', 'oven']);
  });
});
