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
