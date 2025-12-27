import { describe, it, expect } from 'vitest';
import { determineDietaryProperties } from './ingredient-classifier';

describe('determineDietaryProperties', () => {
  it('identifies gluten in wheat flour', () => {
    const result = determineDietaryProperties('wheat flour');
    expect(result).toContain('contains-gluten');
  });

  it('identifies lactose in butter', () => {
    const result = determineDietaryProperties('butter');
    expect(result).toContain('contains-lactose');
  });

  it('returns empty array for unknown ingredient', () => {
    const result = determineDietaryProperties('mystery ingredient');
    expect(result).toEqual([]);
  });

  it('normalizes ingredient names (case-insensitive)', () => {
    expect(determineDietaryProperties('BUTTER')).toContain('contains-lactose');
    expect(determineDietaryProperties('  butter  ')).toContain('contains-lactose');
  });

  it('returns empty array for gluten-free, lactose-free ingredients', () => {
    expect(determineDietaryProperties('rice')).toEqual([]);
    expect(determineDietaryProperties('olive oil')).toEqual([]);
    expect(determineDietaryProperties('garlic')).toEqual([]);
  });
});
