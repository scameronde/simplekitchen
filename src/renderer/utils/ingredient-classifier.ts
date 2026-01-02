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
  // Defensive checks for edge cases
  if (!ingredientName || typeof ingredientName !== 'string') {
    console.warn('[determineDietaryProperties] Invalid ingredient name:', ingredientName);
    return [];
  }

  // Normalize by removing special characters and extra whitespace
  const normalized = ingredientName
    .toLowerCase()
    .trim()
    .replace(/[,;:()]/g, '') // Remove common punctuation
    .replace(/\s+/g, ' '); // Normalize whitespace

  // Try exact match first
  if (INGREDIENT_DATABASE[normalized]) {
    return INGREDIENT_DATABASE[normalized];
  }

  // Try to match the first word (e.g., "cheese, grated" → "cheese")
  const firstWord = normalized.split(' ')[0];
  if (firstWord && INGREDIENT_DATABASE[firstWord]) {
    return INGREDIENT_DATABASE[firstWord];
  }

  // Return empty array if no match found
  return [];
}
