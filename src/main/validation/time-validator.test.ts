import { describe, it, expect } from 'vitest';
import { validateTimeConstraints, getTimeConstraints } from './time-validator';
import type { CreateRecipeInput } from '../../shared/types/recipe';

describe('Time Constraint Validator', () => {
  const baseRecipe: Partial<CreateRecipeInput> = {
    title: 'Test Recipe',
    cookwareType: 'one-pot',
    servings: 2,
  };

  it('should accept valid cooking time (30 minutes)', () => {
    const recipe = { ...baseRecipe, cookingTimeMinutes: 30 };
    const errors = validateTimeConstraints(recipe as CreateRecipeInput);
    expect(errors).toHaveLength(0);
  });

  it('should accept valid cooking time (45 minutes)', () => {
    const recipe = { ...baseRecipe, cookingTimeMinutes: 45 };
    const errors = validateTimeConstraints(recipe as CreateRecipeInput);
    expect(errors).toHaveLength(0);
  });

  it('should accept valid cooking time (37 minutes)', () => {
    const recipe = { ...baseRecipe, cookingTimeMinutes: 37 };
    const errors = validateTimeConstraints(recipe as CreateRecipeInput);
    expect(errors).toHaveLength(0);
  });

  it('should reject cooking time below 30 minutes', () => {
    const recipe = { ...baseRecipe, cookingTimeMinutes: 25 };
    const errors = validateTimeConstraints(recipe as CreateRecipeInput);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.constraint).toBe('time-minimum');
    expect(errors[0]!.message).toContain('at least 30');
  });

  it('should reject cooking time above 45 minutes', () => {
    const recipe = { ...baseRecipe, cookingTimeMinutes: 50 };
    const errors = validateTimeConstraints(recipe as CreateRecipeInput);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.constraint).toBe('time-maximum');
    expect(errors[0]!.message).toContain('at most 45');
  });

  it('should return time constraints', () => {
    const constraints = getTimeConstraints();
    expect(constraints.min).toBe(30);
    expect(constraints.max).toBe(45);
  });
});
