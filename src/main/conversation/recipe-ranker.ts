/**
 * @module recipe-ranker
 * OpenAI-powered recipe ranking service for conversational decision support.
 * Queries recipes from database, calls AI for intelligent ranking, and returns structured suggestions.
 */

import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { getRecipes } from '../database/dal/recipes.js';
import { getDietaryProfile } from '../database/dal/dietary-profile.js';
import { getSession } from './session-manager.js';
import { RANKING_SYSTEM_PROMPT, buildRankingPrompt } from './prompts.js';
import { RecipeSuggestionSchema } from './ranking-schema.js';
import type { RecipeSuggestionOutput } from './ranking-schema.js';
import type { RecipeFilter } from '../../shared/types/recipe.js';

// Lazy-initialize OpenAI client to avoid errors when API key is not set
// This allows the app to start even without an API key configured
let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error(
        'OPENAI_API_KEY is not configured. Please add your API key to the .env file.'
      );
    }
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 30000, // 30 seconds
      maxRetries: 2,
    });
  }
  return openai;
}

/**
 * Fetches recipes matching user context and returns AI-ranked suggestions.
 * Queries database with dietary restrictions and time constraints, then uses
 * OpenAI to rank recipes based on energy level, mood, and other contextual factors.
 *
 * @param sessionId - The conversation session ID to rank recipes for
 * @returns AI-ranked recipe suggestions with scores and reasoning
 * @throws Error if session not found, insufficient recipes, or AI service fails
 */
export async function getRankedSuggestions(sessionId: string): Promise<RecipeSuggestionOutput> {
  // Step 1: Fetch session
  const session = getSession(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  // Step 2: Extract context and already suggested recipes
  const { userContext, suggestedRecipes, rejectedRecipes } = session;

  // Step 3: Fetch dietary profile
  const dietaryProfile = await getDietaryProfile();

  // Step 4: Build RecipeFilter
  const filter: RecipeFilter = {
    dietaryTags:
      dietaryProfile.hardRestrictions.length > 0 ? dietaryProfile.hardRestrictions : undefined,
    cookingTimeMax: userContext.availableTime,
    // cookwareTypes left undefined to let AI rank all types
  };

  // Step 5: Query recipes with filter
  const candidates = await getRecipes(filter);

  // Step 5.5: Filter out rejected recipes
  const rejectedIds = rejectedRecipes.map(r => r.recipeId);
  const candidatesWithoutRejected = candidates.filter(recipe => !rejectedIds.includes(recipe.id));

  // Step 6: Validate candidate count
  if (candidatesWithoutRejected.length < 2) {
    throw new Error(
      `Insufficient recipes found after filtering rejections. Need at least 2 recipes but found ${candidatesWithoutRejected.length}. Consider relaxing constraints or restarting conversation.`
    );
  }

  // Step 7: Limit to 20 candidates max
  const limitedCandidates = candidatesWithoutRejected.slice(0, 20);

  // Step 8: Call OpenAI with ranking prompt
  const client = getOpenAIClient();
  // Pass session for refinement context
  const prompt = buildRankingPrompt(
    userContext,
    limitedCandidates,
    dietaryProfile,
    suggestedRecipes,
    session
  );

  const completion = await client.chat.completions.parse({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: RANKING_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    response_format: zodResponseFormat(RecipeSuggestionSchema, 'recipe_suggestions'),
    temperature: 0.3, // Lower temperature for more consistent ranking
    max_tokens: 1000, // More tokens for detailed reasoning
  });

  // Step 9: Extract and return parsed result
  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) {
    throw new Error('No response from AI ranking service');
  }

  return parsed;
}
