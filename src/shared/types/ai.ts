/**
 * @module ai-types
 * Types for AI-powered recipe generation.
 * Defines criteria, results, and error handling for OpenAI integration.
 */

import type { CookwareType, DietaryTag, Season } from './database.js';
import type { CreateRecipeInput } from './recipe.js';

export interface RecipeGenerationCriteria {
  cuisine?: string; // e.g., "Italian", "Thai", "Mexican"
  mainIngredient?: string; // e.g., "chicken", "tofu", "pasta"
  dietaryTags: DietaryTag[]; // Required dietary compliance
  seasonality?: Season[]; // Preferred seasons
  cookwareType?: CookwareType; // Preferred cookware (defaults to any)
  flavorProfile?: string; // e.g., "spicy", "savory", "comfort food"
  skillLevel?: 'beginner' | 'intermediate' | 'advanced';
}

export interface RecipeGenerationResult {
  success: boolean;
  recipe?: CreateRecipeInput; // Ready to save
  error?: RecipeGenerationError;
}

export interface RecipeGenerationError {
  type: 'rate-limit' | 'network' | 'auth' | 'timeout' | 'validation' | 'refusal' | 'unknown';
  message: string;
  retryAfter?: number; // Seconds (for rate-limit)
  details?: string; // Additional context
}
