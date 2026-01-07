import { describe, it, expect } from 'vitest';
import { validateTimeConstraints, getTimeConstraints } from './time-validator';
import type { CreateRecipeInput } from '../../shared/types/recipe';

describe('Time Constraint Validator', () => {
  const baseRecipe: Partial<CreateRecipeInput> = {
    title: 'Test Recipe',
    cookwareType: 'one-pot',
    servings: 2,
  };

  it('should accept valid total time (prep=0, cook=0, total=0)', () => {
    const recipe = { ...baseRecipe, prepTimeMinutes: 0, cookingTimeMinutes: 0 };
    const errors = validateTimeConstraints(recipe as CreateRecipeInput);
    expect(errors).toHaveLength(0);
  });

  it('should accept valid total time (prep=10, cook=50, total=60)', () => {
    const recipe = { ...baseRecipe, prepTimeMinutes: 10, cookingTimeMinutes: 50 };
    const errors = validateTimeConstraints(recipe as CreateRecipeInput);
    expect(errors).toHaveLength(0);
  });

  it('should accept valid total time (prep=null, cook=60, total=60)', () => {
    const recipe = { ...baseRecipe, prepTimeMinutes: undefined, cookingTimeMinutes: 60 };
    const errors = validateTimeConstraints(recipe as CreateRecipeInput);
    expect(errors).toHaveLength(0);
  });

  it('should accept valid total time (prep=15, cook=30, total=45)', () => {
    const recipe = { ...baseRecipe, prepTimeMinutes: 15, cookingTimeMinutes: 30 };
    const errors = validateTimeConstraints(recipe as CreateRecipeInput);
    expect(errors).toHaveLength(0);
  });

  it('should accept valid total time (cook only, total=30)', () => {
    const recipe = { ...baseRecipe, cookingTimeMinutes: 30 };
    const errors = validateTimeConstraints(recipe as CreateRecipeInput);
    expect(errors).toHaveLength(0);
  });

  it('should reject negative total time (prep=-5, cook=0, total=-5)', () => {
    const recipe = { ...baseRecipe, prepTimeMinutes: -5, cookingTimeMinutes: 0 };
    const errors = validateTimeConstraints(recipe as CreateRecipeInput);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.field).toBe('totalTimeMinutes');
    expect(errors[0]!.constraint).toBe('time-minimum');
    expect(errors[0]!.message).toContain('Total time (prep + cook)');
    expect(errors[0]!.message).toContain('at least 0');
  });

  it('should reject total time above 60 minutes (prep=30, cook=35, total=65)', () => {
    const recipe = { ...baseRecipe, prepTimeMinutes: 30, cookingTimeMinutes: 35 };
    const errors = validateTimeConstraints(recipe as CreateRecipeInput);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.field).toBe('totalTimeMinutes');
    expect(errors[0]!.constraint).toBe('time-maximum');
    expect(errors[0]!.message).toContain('Total time (prep + cook)');
    expect(errors[0]!.message).toContain('at most 60');
  });

  it('should reject total time above 60 minutes (prep=10, cook=55, total=65)', () => {
    const recipe = { ...baseRecipe, prepTimeMinutes: 10, cookingTimeMinutes: 55 };
    const errors = validateTimeConstraints(recipe as CreateRecipeInput);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.field).toBe('totalTimeMinutes');
    expect(errors[0]!.constraint).toBe('time-maximum');
    expect(errors[0]!.message).toContain('Total time (prep + cook)');
    expect(errors[0]!.message).toContain('at most 60');
  });

  it('should return time constraints', () => {
    const constraints = getTimeConstraints();
    expect(constraints.min).toBe(0);
    expect(constraints.max).toBe(60);
  });
});
