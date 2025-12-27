import type { DietaryProperty } from '../../shared/types/database';

// Minimal ingredient database for client-side classification
const INGREDIENT_DATABASE: Record<string, DietaryProperty[]> = {
  butter: ['contains-lactose'],
  milk: ['contains-lactose'],
  cheese: ['contains-lactose'],
  'wheat flour': ['contains-gluten'],
  bread: ['contains-gluten'],
  pasta: ['contains-gluten'],
  'olive oil': [],
  garlic: [],
  onion: [],
  tomato: [],
  rice: [],
  chicken: [],
  salt: [],
  pepper: [],
};

export function determineDietaryProperties(ingredientName: string): DietaryProperty[] {
  const normalized = ingredientName.toLowerCase().trim();
  return INGREDIENT_DATABASE[normalized] || [];
}
