import { describe, it, expect } from 'vitest';
import { validateServingsConstraints, getRequiredServings } from './servings-validator';
import type { CreateRecipeInput } from '../../shared/types/recipe';

describe('Servings Constraint Validator', () => {
  const baseRecipe: Partial<CreateRecipeInput> = {
    title: 'Test Recipe',
    cookingTimeMinutes: 30,
    cookwareType: 'one-pot',
  };

  it('should accept exactly 2 servings', () => {
    const recipe = { ...baseRecipe, servings: 2 };
    const errors = validateServingsConstraints(recipe as CreateRecipeInput);
    expect(errors).toHaveLength(0);
  });

  it('should reject 1 serving', () => {
    const recipe = { ...baseRecipe, servings: 1 };
    const errors = validateServingsConstraints(recipe as CreateRecipeInput);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.constraint).toBe('servings-exact');
    expect(errors[0]!.message).toContain('exactly 2');
  });

  it('should reject 4 servings', () => {
    const recipe = { ...baseRecipe, servings: 4 };
    const errors = validateServingsConstraints(recipe as CreateRecipeInput);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.constraint).toBe('servings-exact');
  });

  it('should return required servings', () => {
    const required = getRequiredServings();
    expect(required).toBe(2);
  });
});
