// Validation error detail
export interface ValidationError {
  field: string; // Path to field (e.g., "ingredients[0].name", "cookingTimeMinutes")
  constraint: string; // Constraint type identifier
  message: string; // Human-readable error message
  suggestedFix?: string; // Optional suggestion for user
}

// Validation result
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

// Constraint types (for categorization)
export type ConstraintType = 
  | 'dietary-gluten-free'
  | 'dietary-lactose-free'
  | 'dietary-explicit-exclusion'
  | 'time-minimum'
  | 'time-maximum'
  | 'cookware-single'
  | 'servings-exact';
