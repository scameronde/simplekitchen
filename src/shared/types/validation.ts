/**
 * @module validation-types
 * Validation result types for recipe constraint checking.
 * Used by validation layer to report errors and constraint violations.
 */

// Validation error detail
export interface ValidationError {
  field: string; // Path to field (e.g., "ingredients[0].name", "cookingTimeMinutes")
  constraint: string; // Constraint type identifier
  message: string; // Human-readable error message
  suggestedFix?: string; // Optional suggestion for user
  severity?: 'error' | 'warning'; // Severity level (defaults to 'error')
}

// Validation result
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Constraint type identifiers for categorization.
 * @future Phase 4 - Used in validation error display and filtering
 * @future Phase 5 - Used in AI recipe generation validation feedback
 */
export type ConstraintType =
  | 'dietary-gluten-free'
  | 'dietary-lactose-free'
  | 'dietary-explicit-exclusion'
  | 'time-minimum'
  | 'time-maximum'
  | 'cookware-single'
  | 'servings-exact';
