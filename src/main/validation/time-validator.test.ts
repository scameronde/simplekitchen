import { describe, it, expect } from 'vitest';
import { validateTimeConstraints, getTimeConstraints } from './time-validator';
import type { CreateRecipeInput } from '../../shared/types/recipe';

describe('Time Constraint Validator', () => {
  const baseRecipe: Partial<CreateRecipeInput> = {
    title: 'Test Recipe',
    cookwareType: 'one-pot',
    servings: 2,
  };

  it('should accept valid cooking time (0 minutes)', () => {
    const recipe = { ...baseRecipe, cookingTimeMinutes: 0 };
    const errors = validateTimeConstraints(recipe as CreateRecipeInput);
    expect(errors).toHaveLength(0);
  });

  it('should accept valid cooking time (30 minutes)', () => {
    const recipe = { ...baseRecipe, cookingTimeMinutes: 30 };
    const errors = validateTimeConstraints(recipe as CreateRecipeInput);
    expect(errors).toHaveLength(0);
  });

  it('should accept valid cooking time (60 minutes)', () => {
    const recipe = { ...baseRecipe, cookingTimeMinutes: 60 };
    const errors = validateTimeConstraints(recipe as CreateRecipeInput);
    expect(errors).toHaveLength(0);
  });

  it('should accept valid cooking time (45 minutes)', () => {
    const recipe = { ...baseRecipe, cookingTimeMinutes: 45 };
    const errors = validateTimeConstraints(recipe as CreateRecipeInput);
    expect(errors).toHaveLength(0);
  });

  it('should accept valid cooking time (15 minutes)', () => {
    const recipe = { ...baseRecipe, cookingTimeMinutes: 15 };
    const errors = validateTimeConstraints(recipe as CreateRecipeInput);
    expect(errors).toHaveLength(0);
  });

  it('should reject negative cooking time', () => {
    const recipe = { ...baseRecipe, cookingTimeMinutes: -5 };
    const errors = validateTimeConstraints(recipe as CreateRecipeInput);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.constraint).toBe('time-minimum');
    expect(errors[0]!.message).toContain('at least 0');
  });

  it('should reject cooking time above 60 minutes', () => {
    const recipe = { ...baseRecipe, cookingTimeMinutes: 65 };
    const errors = validateTimeConstraints(recipe as CreateRecipeInput);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.constraint).toBe('time-maximum');
    expect(errors[0]!.message).toContain('at most 60');
  });

  it('should return time constraints', () => {
    const constraints = getTimeConstraints();
    expect(constraints.min).toBe(0);
    expect(constraints.max).toBe(60);
  });
});
