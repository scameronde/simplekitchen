/**
 * @module dietary-tags-constants
 * Shared constants for dietary tag display labels.
 * Ensures consistency across recipe entry and filtering UIs.
 */

import type { DietaryTag } from '../types/recipe';

/**
 * Canonical list of dietary tags with display labels.
 * Must match the DietaryTag type definition in database.ts.
 */
export const DIETARY_TAG_LABELS: Record<DietaryTag, string> = {
  'gluten-free': 'Gluten-Free',
  'lactose-free': 'Lactose-Free',
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  pescatarian: 'Pescatarian',
};

/**
 * Array of dietary tags with their labels for use in UI components.
 */
export const DIETARY_TAG_OPTIONS = (
  Object.entries(DIETARY_TAG_LABELS) as [DietaryTag, string][]
).map(([value, label]) => ({ value, label }));
