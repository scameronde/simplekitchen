import { describe, it, expect } from 'vitest';
import {
  lookupIngredient,
  getIngredientProperties,
  isKnownSafe,
  getKnownIngredientCount,
} from './ingredient-database';

describe('Static Ingredient Database', () => {
  it('should lookup ingredient by exact name', () => {
    const result = lookupIngredient('wheat flour');
    expect(result).not.toBeNull();
    expect(result!.dietaryProperties).toContain('contains-gluten');
  });

  it('should lookup ingredient case-insensitively', () => {
    const result = lookupIngredient('WHEAT FLOUR');
    expect(result).not.toBeNull();
    expect(result!.dietaryProperties).toContain('contains-gluten');
  });

  it('should lookup ingredient by alias', () => {
    const result = lookupIngredient('courgette');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('zucchini');
  });

  it('should return null for unknown ingredient', () => {
    const result = lookupIngredient('exotic-unknown-ingredient');
    expect(result).toBeNull();
  });

  it('should get dietary properties for known ingredient', () => {
    const properties = getIngredientProperties('butter');
    expect(properties).not.toBe('unknown');
    expect(properties).toContain('contains-lactose');
  });

  it('should return "unknown" for ingredient not in database', () => {
    const properties = getIngredientProperties('unknown-spice-xyz');
    expect(properties).toBe('unknown');
  });

  it('should identify known safe ingredients', () => {
    expect(isKnownSafe('rice')).toBe(true);
    expect(isKnownSafe('broccoli')).toBe(true); // No dietary properties
    expect(isKnownSafe('olive oil')).toBe(true);
  });

  it('should identify unsafe ingredients', () => {
    expect(isKnownSafe('wheat flour')).toBe(false);
    expect(isKnownSafe('butter')).toBe(false);
    expect(isKnownSafe('milk')).toBe(false);
  });

  it('should return false for unknown ingredients', () => {
    expect(isKnownSafe('unknown-ingredient')).toBe(false);
  });

  it('should have at least 100 known ingredients', () => {
    const count = getKnownIngredientCount();
    expect(count).toBeGreaterThanOrEqual(100);
  });

  it('should correctly identify gluten-free alternatives', () => {
    expect(getIngredientProperties('wheat pasta')).toContain('contains-gluten');
    expect(getIngredientProperties('gluten-free pasta')).not.toContain('contains-gluten');
    expect(isKnownSafe('gluten-free pasta')).toBe(true);
  });

  it('should correctly identify dairy alternatives', () => {
    expect(getIngredientProperties('milk')).toContain('contains-lactose');
    expect(getIngredientProperties('almond milk')).not.toContain('contains-lactose');
    expect(isKnownSafe('almond milk')).toBe(true);
  });

  it('should flag soy sauce as containing gluten', () => {
    const properties = getIngredientProperties('soy sauce');
    expect(properties).toContain('contains-gluten');
  });

  it('should identify tamari as gluten-free soy sauce alternative', () => {
    const properties = getIngredientProperties('tamari');
    expect(properties).not.toContain('contains-gluten');
    expect(isKnownSafe('tamari')).toBe(true);
  });

  it('should handle ingredients with multiple dietary properties', () => {
    // Most ingredients have single property, but verify structure supports multiple
    const result = lookupIngredient('wheat flour');
    expect(Array.isArray(result!.dietaryProperties)).toBe(true);
  });
});
