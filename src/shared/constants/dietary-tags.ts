/**
 * @module dietary-tags-constants
 * Shared constants for dietary tag display labels.
 * Ensures consistency across recipe entry and filtering UIs.
 */

import type { DietaryTag } from '../types/recipe';

/**
 * Canonical mapping of dietary tag IDs to human-readable display labels.
 * Used internally to generate DIETARY_TAG_OPTIONS and exported for direct UI use.
 *
 * This constant is intentionally exported for:
 * - Internal use: Generates DIETARY_TAG_OPTIONS array below
 * - Future UI use: Direct label lookup (e.g., DIETARY_TAG_LABELS['vegan'] → 'Vegan')
 * - Type safety: Record<DietaryTag, string> ensures all tags have labels
 *
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
