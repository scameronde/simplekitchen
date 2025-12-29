/**
 * @module recipe-generator
 * OpenAI-powered recipe generation service.
 * Generates recipes based on user criteria with structured output validation.
 */

import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { RecipeGenerationSchema } from './recipe-schema.js';
import type { RecipeGenerationCriteria, RecipeGenerationResult } from '../../shared/types/ai.js';
import type { CreateRecipeInput } from '../../shared/types/recipe.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30000, // 30 seconds
  maxRetries: 2,
});

const SYSTEM_PROMPT = `You are a professional chef with expertise in diverse cuisines. Generate recipes that are:
- Practical and achievable for home cooks
- Balanced in nutrition and flavor
- Precise in measurements and cooking techniques
- STRICTLY compliant with the provided constraints

CRITICAL CONSTRAINTS (NEVER violate):
- Cooking time: MUST be between 30-45 minutes (active cooking only)
- Servings: MUST be exactly 2 portions
- Cookware: MUST use only ONE piece of cookware (one pot OR one pan OR oven)
- Dietary restrictions: MUST comply with specified tags

When specifying ingredients:
- Mark dietary properties accurately (contains-gluten, contains-lactose, etc.)
- Use common units (cup, tbsp, tsp, oz, lb, g, ml)
- Provide exact quantities, not ranges`;

/**
 * Builds a dynamic user prompt from recipe generation criteria.
 * @param criteria - User-specified recipe requirements
 * @returns Formatted prompt string
 */
function buildUserPrompt(criteria: RecipeGenerationCriteria): string {
  const parts: string[] = [];

  // Add cuisine if specified
  if (criteria.cuisine) {
    parts.push(`Cuisine: ${criteria.cuisine}`);
  }

  // Add main ingredient if specified
  if (criteria.mainIngredient) {
    parts.push(`Main Ingredient: ${criteria.mainIngredient}`);
  }

  // Always include dietary tags (required field)
  if (criteria.dietaryTags.length > 0) {
    parts.push(`Dietary Tags: ${criteria.dietaryTags.join(', ')} (MUST comply)`);
  }

  // Add seasonality if specified
  if (criteria.seasonality && criteria.seasonality.length > 0) {
    parts.push(`Seasonality: ${criteria.seasonality.join(', ')}`);
  }

  // Add cookware type if specified
  if (criteria.cookwareType) {
    parts.push(`Cookware Type: ${criteria.cookwareType}`);
  }

  // Add flavor profile if specified
  if (criteria.flavorProfile) {
    parts.push(`Flavor Profile: ${criteria.flavorProfile}`);
  }

  // Add skill level if specified
  if (criteria.skillLevel) {
    parts.push(`Skill Level: ${criteria.skillLevel}`);
  }

  // Add requirements summary
  parts.push('');
  parts.push('The recipe must:');
  parts.push('- Take 30-45 minutes of active cooking time');
  parts.push('- Serve exactly 2 people');
  if (criteria.cookwareType) {
    parts.push(`- Use only ${criteria.cookwareType}`);
  } else {
    parts.push('- Use only ONE piece of cookware (one-pot, one-pan, or oven)');
  }
  if (criteria.dietaryTags.length > 0) {
    parts.push(`- Be ${criteria.dietaryTags.join(' and ')}`);
  }

  return parts.join('\n');
}

/**
 * Generates a recipe using OpenAI API based on user criteria.
 * Uses structured output with Zod schema validation.
 *
 * @param criteria - Recipe generation requirements
 * @returns Result object with recipe or error details
 */
export async function generateRecipe(
  criteria: RecipeGenerationCriteria
): Promise<RecipeGenerationResult> {
  try {
    const completion = await openai.chat.completions.parse({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(criteria) },
      ],
      response_format: zodResponseFormat(RecipeGenerationSchema, 'recipe'),
      temperature: 0.8,
      max_tokens: 2000,
    });

    // Handle successful parsing
    if (completion.choices[0]?.message.parsed) {
      const generated = completion.choices[0].message.parsed;

      // Convert to CreateRecipeInput format
      const recipe: CreateRecipeInput = {
        title: generated.title,
        cookingTimeMinutes: generated.cookingTimeMinutes,
        prepTimeMinutes: generated.prepTimeMinutes,
        cookwareType: generated.cookwareType,
        servings: generated.servings,
        dietaryTags: generated.dietaryTags,
        seasonality: generated.seasonality,
        instructions: generated.instructions,
        ingredients: generated.ingredients,
        sourceType: 'ai-generated',
        sourceReference: `OpenAI gpt-4o-mini (${new Date().toISOString()})`,
      };

      return { success: true, recipe };
    }

    // Handle refusal
    if (completion.choices[0]?.message.refusal) {
      return {
        success: false,
        error: {
          type: 'refusal',
          message: 'AI refused to generate recipe',
          details: completion.choices[0].message.refusal,
        },
      };
    }

    // No parsed result and no refusal - unexpected state
    throw new Error('No response from AI');
  } catch (error) {
    // Handle OpenAI-specific errors
    if (error instanceof OpenAI.RateLimitError) {
      const retryAfterHeader = error.headers?.get?.('retry-after');
      const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader) : 60;

      return {
        success: false,
        error: {
          type: 'rate-limit',
          message: 'Rate limit exceeded. Please wait before trying again.',
          retryAfter,
        },
      };
    }

    if (error instanceof OpenAI.AuthenticationError) {
      return {
        success: false,
        error: {
          type: 'auth',
          message: 'Invalid OpenAI API key. Check configuration.',
        },
      };
    }

    if (error instanceof OpenAI.APIConnectionError) {
      return {
        success: false,
        error: {
          type: 'network',
          message: 'Network error. Check internet connection.',
        },
      };
    }

    if (error instanceof OpenAI.APIConnectionTimeoutError) {
      return {
        success: false,
        error: {
          type: 'timeout',
          message: 'Request timed out. Please try again.',
        },
      };
    }

    // Handle unknown errors
    return {
      success: false,
      error: {
        type: 'unknown',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}
