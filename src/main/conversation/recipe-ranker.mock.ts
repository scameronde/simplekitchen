/**
 * @module recipe-ranker.mock
 * Mock recipe ranking service for E2E tests.
 * Provides deterministic recipe suggestions based on user context without calling OpenAI.
 */

import { getRecipes } from '../database/dal/recipes.js';
import { getSession } from './session-manager.js';
import type { RecipeSuggestionOutput } from './ranking-schema.js';
import type { RecipeFilter } from '../../shared/types/recipe.js';

/**
 * Mock version of getRankedSuggestions for E2E testing.
 * Returns deterministic recipe suggestions based on user context.
 * Queries database dynamically to ensure recipes exist in the test database.
 *
 * @param sessionId - The conversation session ID to rank recipes for
 * @returns Mock-ranked recipe suggestions with scores and reasoning
 * @throws Error if session not found or test signal triggers error
 */
export async function mockGetRankedSuggestions(sessionId: string): Promise<RecipeSuggestionOutput> {
  // Step 1: Fetch session
  const session = getSession(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  // Step 2: Extract context
  const { userContext, rejectedRecipes } = session;

  // Step 3: Check for test signals
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((userContext as any).mock_error === 'NO_RECIPES') {
    throw new Error('No suitable recipes found');
  }

  // Step 4: Build filter based on user context
  const filter: RecipeFilter = {
    totalTimeMax: userContext.availableTime,
  };

  // Step 5: Query database for recipes
  const candidates = await getRecipes(filter);

  // Step 6: Filter out rejected recipes
  const rejectedIds = rejectedRecipes.map(r => r.recipeId);
  const availableRecipes = candidates.filter(recipe => !rejectedIds.includes(recipe.id));

  // Step 7: Validate we have enough recipes
  if (availableRecipes.length < 2) {
    throw new Error(
      `Insufficient recipes found. Need at least 2 recipes but found ${availableRecipes.length}`
    );
  }

  // Step 8: Select 2-4 recipes based on context
  const suggestionCount = determineSuggestionCount(userContext.energyLevel);
  const selectedRecipes = availableRecipes.slice(0, suggestionCount);

  // Step 9: Format suggestions with context-aware scoring and reasoning
  const suggestions = selectedRecipes.map((recipe, index) => {
    const { score, reasoning, factors } = generateSuggestionMetadata(
      recipe,
      userContext.energyLevel,
      userContext.availableTime,
      index
    );

    return {
      recipeId: recipe.id,
      relevanceScore: score,
      reasoning,
      matchedFactors: factors,
    };
  });

  return { suggestions };
}

/**
 * Determines how many suggestions to return based on energy level.
 * Low energy → 2 suggestions (minimize decision fatigue)
 * Medium energy → 3 suggestions (balanced)
 * High energy → 4 suggestions (more exploration)
 */
function determineSuggestionCount(energyLevel?: 'low' | 'medium' | 'high'): number {
  if (energyLevel === 'low') return 2;
  if (energyLevel === 'medium') return 3;
  if (energyLevel === 'high') return 4;
  return 3; // Default to 3 if energy level not specified
}

/**
 * Generates mock metadata (score, reasoning, matched factors) for a recipe suggestion.
 * Scores decrease slightly for each position to create realistic ranking.
 */
function generateSuggestionMetadata(
  recipe: {
    title: string;
    totalTimeMinutes: number;
    cookwareType: string;
    dietaryTags: string[];
  },
  energyLevel?: 'low' | 'medium' | 'high',
  availableTime?: number,
  position = 0
): { score: number; reasoning: string; factors: string[] } {
  // Base score starts at 95 and decreases by 5 for each position
  const baseScore = 95 - position * 5;

  // Build matched factors based on context
  const factors: string[] = [];

  if (energyLevel === 'low') {
    factors.push('Low energy friendly');
  } else if (energyLevel === 'medium') {
    factors.push('Moderate effort');
  } else if (energyLevel === 'high') {
    factors.push('Engaging to cook');
  }

  if (availableTime !== undefined) {
    factors.push(`${availableTime} minutes available`);
  }

  // Add cookware type factor
  if (recipe.cookwareType === 'one-pot' || recipe.cookwareType === 'one-pan') {
    factors.push('Minimal cleanup');
  } else if (recipe.cookwareType === 'oven') {
    factors.push('Hands-off cooking');
  }

  // Add dietary tags as factors
  if (recipe.dietaryTags.includes('vegetarian')) {
    factors.push('Vegetarian');
  }
  if (recipe.dietaryTags.includes('gluten-free')) {
    factors.push('Gluten-free');
  }

  // Generate reasoning based on recipe characteristics
  const reasoning = generateReasoning(recipe, energyLevel, availableTime);

  return {
    score: baseScore,
    reasoning,
    factors,
  };
}

/**
 * Generates context-aware reasoning for why a recipe matches user needs.
 */
function generateReasoning(
  recipe: {
    title: string;
    totalTimeMinutes: number;
    cookwareType: string;
  },
  energyLevel?: 'low' | 'medium' | 'high',
  availableTime?: number
): string {
  const timeDescription =
    recipe.totalTimeMinutes <= 30
      ? 'quick and easy'
      : recipe.totalTimeMinutes <= 45
        ? 'moderately paced'
        : 'relaxed timing';

  const energyDescription =
    energyLevel === 'low'
      ? 'perfect for low-energy cooking'
      : energyLevel === 'high'
        ? 'engaging and rewarding to make'
        : 'balanced effort and reward';

  const cookwareDescription =
    recipe.cookwareType === 'one-pot' || recipe.cookwareType === 'one-pan'
      ? 'with minimal cleanup'
      : recipe.cookwareType === 'oven'
        ? 'with hands-off oven cooking'
        : 'using standard cookware';

  const timeMatch =
    availableTime !== undefined && recipe.totalTimeMinutes <= availableTime
      ? `fits within your ${availableTime}-minute timeframe`
      : '';

  const parts = [`${recipe.title} is ${timeDescription}`, energyDescription, cookwareDescription];

  if (timeMatch) {
    parts.push(timeMatch);
  }

  return parts.join(', ') + '.';
}
