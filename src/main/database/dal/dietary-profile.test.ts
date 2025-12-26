import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import {
  getDietaryProfile,
  updateDietaryProfile,
  resetDietaryProfile,
} from './dietary-profile';
import { runMigrations, closeDatabase } from '../index';

beforeEach(() => {
  runMigrations();
});

afterAll(() => {
  closeDatabase();
});

describe('Dietary Profile Operations', () => {
  it('should retrieve default dietary profile', async () => {
    const profile = await getDietaryProfile();

    expect(profile.id).toBe(1);
    expect(profile.hardRestrictions).toContain('gluten-free');
    expect(profile.hardRestrictions).toContain('lactose-free');
  });

  it('should update hard restrictions', async () => {
    const updated = await updateDietaryProfile({
      hardRestrictions: ['gluten-free', 'lactose-free', 'vegetarian'],
    });

    expect(updated.hardRestrictions).toHaveLength(3);
    expect(updated.hardRestrictions).toContain('vegetarian');
  });

  it('should update preferences', async () => {
    const updated = await updateDietaryProfile({
      preferences: ['pescatarian'],
    });

    expect(updated.preferences).toContain('pescatarian');
  });

  it('should update explicit inclusions', async () => {
    const updated = await updateDietaryProfile({
      explicitInclusions: ['parmesan cheese', 'aged cheddar'],
    });

    expect(updated.explicitInclusions).toHaveLength(2);
  });

  it('should update explicit exclusions', async () => {
    const updated = await updateDietaryProfile({
      explicitExclusions: ['mushrooms', 'olives'],
    });

    expect(updated.explicitExclusions).toContain('mushrooms');
  });

  it('should reset dietary profile to defaults', async () => {
    // First modify
    await updateDietaryProfile({
      hardRestrictions: ['vegan'],
      preferences: ['pescatarian'],
    });

    // Then reset
    const reset = await resetDietaryProfile();

    expect(reset.hardRestrictions).toEqual(['gluten-free', 'lactose-free']);
    expect(reset.preferences).toEqual([]);
    expect(reset.explicitInclusions).toEqual([]);
    expect(reset.explicitExclusions).toEqual([]);
  });
});
