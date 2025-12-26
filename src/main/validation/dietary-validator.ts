import type { CreateRecipeInput, UpdateRecipeInput, CreateIngredientInput } from '../../shared/types/recipe';
import type { DietaryProfile } from '../../shared/types/recipe';
import type { DietaryTag, DietaryProperty } from '../../shared/types/database';
import type { ValidationError, ValidationResult } from '../../shared/types/validation';
import { lookupIngredient, getIngredientProperties } from './ingredient-database';

// Validate recipe against dietary constraints
export async function validateDietaryConstraints(
  recipeInput: CreateRecipeInput | UpdateRecipeInput,
  profile: DietaryProfile
): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];

  // If no ingredients provided (update without ingredient changes), skip validation
  if (!recipeInput.ingredients || recipeInput.ingredients.length === 0) {
    return errors;
  }

  // Check each ingredient against dietary profile
  for (let i = 0; i < recipeInput.ingredients.length; i++) {
    const ingredient = recipeInput.ingredients[i];
    const ingredientErrors = validateIngredient(ingredient, i, profile);
    errors.push(...ingredientErrors);
  }

  return errors;
}

// Validate single ingredient against dietary profile
function validateIngredient(
  ingredient: CreateIngredientInput,
  index: number,
  profile: DietaryProfile
): ValidationError[] {
  const errors: ValidationError[] = [];
  const ingredientName = ingredient.name.toLowerCase().trim();

  // Check explicit exclusions first (highest priority)
  const isExplicitlyExcluded = profile.explicitExclusions.some(
    excluded => excluded.toLowerCase().trim() === ingredientName
  );

  if (isExplicitlyExcluded) {
    errors.push({
      field: `ingredients[${index}].name`,
      constraint: 'dietary-explicit-exclusion',
      message: `Ingredient "${ingredient.name}" is explicitly excluded in your dietary profile.`,
      suggestedFix: 'Remove this ingredient or update your dietary profile.',
    });
    return errors; // Don't check further if explicitly excluded
  }

  // Check explicit inclusions (allows override of restrictions)
  const isExplicitlyIncluded = profile.explicitInclusions.some(
    included => included.toLowerCase().trim() === ingredientName
  );

  if (isExplicitlyIncluded) {
    // Ingredient is explicitly allowed, skip restriction checks
    return errors;
  }

  // Multi-layer validation: combine static database + ingredient dietary_properties
  let detectedProperties: DietaryProperty[] = [];

  // Layer 1: Check static ingredient database
  const staticProperties = getIngredientProperties(ingredient.name);
  if (staticProperties !== 'unknown') {
    detectedProperties = staticProperties;
  } else {
    // Layer 2: Use ingredient's self-declared dietary properties
    detectedProperties = ingredient.dietaryProperties || [];
  }

  // Check detected properties against hard restrictions
  for (const property of detectedProperties) {
    if (property === 'none') continue; // No restriction

    // Map dietary property to restriction tag
    const violatedRestriction = mapPropertyToRestriction(property, profile.hardRestrictions);

    if (violatedRestriction) {
      errors.push({
        field: `ingredients[${index}].name`,
        constraint: `dietary-${violatedRestriction}`,
        message: `Ingredient "${ingredient.name}" contains ${formatProperty(property)}, which violates your ${violatedRestriction} dietary restriction.`,
        suggestedFix: staticProperties === 'unknown' 
          ? 'This ingredient is not in our database. Please verify its dietary properties manually or choose an alternative.'
          : `Replace with a ${violatedRestriction} alternative or remove this ingredient.`,
      });
    }
  }

  // Warn if ingredient is unknown (not in static database and no properties declared)
  if (staticProperties === 'unknown' && (!ingredient.dietaryProperties || ingredient.dietaryProperties.length === 0)) {
    errors.push({
      field: `ingredients[${index}].name`,
      constraint: 'dietary-unknown',
      message: `Ingredient "${ingredient.name}" is not in our database and has no dietary properties declared. Manual verification required.`,
      suggestedFix: 'Please verify this ingredient is safe for your dietary restrictions or use a known alternative.',
    });
  }

  return errors;
}

// Map dietary property to restriction tag
function mapPropertyToRestriction(
  property: DietaryProperty,
  restrictions: DietaryTag[]
): DietaryTag | null {
  const mapping: Record<DietaryProperty, DietaryTag | null> = {
    'contains-gluten': 'gluten-free',
    'contains-lactose': 'lactose-free',
    'contains-eggs': 'vegan', // Eggs violate vegan
    'contains-fish': 'vegan', // Fish violates vegan
    'contains-meat': 'vegetarian', // Meat violates vegetarian and vegan
    'none': null,
  };

  const restrictionTag = mapping[property];
  if (!restrictionTag) return null;

  // Check if user has this restriction
  if (restrictions.includes(restrictionTag)) {
    return restrictionTag;
  }

  // Special case: meat also violates vegan
  if (property === 'contains-meat' && restrictions.includes('vegan')) {
    return 'vegan';
  }

  return null;
}

// Format dietary property for human-readable messages
function formatProperty(property: DietaryProperty): string {
  const formats: Record<DietaryProperty, string> = {
    'contains-gluten': 'gluten',
    'contains-lactose': 'lactose',
    'contains-eggs': 'eggs',
    'contains-fish': 'fish',
    'contains-meat': 'meat',
    'none': 'no dietary restrictions',
  };
  return formats[property] || property;
}
