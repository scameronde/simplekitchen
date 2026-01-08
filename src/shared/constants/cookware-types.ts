/**
 * @module cookware-types-constants
 * Shared constants for cookware type display labels.
 * Ensures consistency across recipe entry and filtering UIs.
 */

import type { CookwareType } from '../types/database.js';

/**
 * Canonical mapping of cookware type IDs to human-readable display labels.
 * Used internally to generate COOKWARE_TYPE_OPTIONS and exported for direct UI use.
 *
 * This constant is intentionally exported for:
 * - Internal use: Generates COOKWARE_TYPE_OPTIONS array below
 * - Future UI use: Direct label lookup (e.g., COOKWARE_TYPE_LABELS['one-pot'] → 'One Pot')
 * - Type safety: Record<CookwareType, string> ensures all types have labels
 *
 * Must match the CookwareType type definition in database.ts.
 */
export const COOKWARE_TYPE_LABELS: Record<CookwareType, string> = {
  'one-pot': 'One Pot',
  'one-pan': 'One Pan',
  oven: 'Oven',
};

/**
 * Array of cookware types with their labels for use in UI components.
 */
export const COOKWARE_TYPE_OPTIONS = (
  Object.entries(COOKWARE_TYPE_LABELS) as [CookwareType, string][]
).map(([value, label]) => ({ value, label }));
