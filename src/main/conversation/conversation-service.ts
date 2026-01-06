/**
 * @module conversation-service
 * OpenAI-powered conversational service for gathering user context.
 * Processes user messages and extracts structured context using AI.
 */

import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import {
  getSession,
  updateSessionMessages,
  updateSessionState,
  updateSessionSuggestedRecipes,
} from './session-manager.js';
import { getDietaryProfile } from '../database/dal/dietary-profile.js';
import { GATHERING_SYSTEM_PROMPT, buildConversationPrompt } from './prompts.js';
import { ConversationTurnSchema } from './conversation-schema.js';
import type { ConversationTurnOutput } from './conversation-schema.js';
import { getRankedSuggestions } from './recipe-ranker.js';
import type { RecipeSuggestionOutput } from './ranking-schema.js';

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
 * Result type for transition to suggesting state.
 */
export interface SuggestionResult {
  success: boolean;
  suggestions?: RecipeSuggestionOutput;
  aiMessage?: string;
  error?: string;
}

/**
 * Processes a single conversation turn with the user.
 * Sends user message to AI, extracts context, and returns AI response.
 *
 * @param sessionId - The session ID to process
 * @param userMessage - The user's message text
 * @returns AI response with extracted context and transition flag
 */
export async function processConversationTurn(
  sessionId: string,
  userMessage: string
): Promise<ConversationTurnOutput> {
  try {
    // Step 1: Fetch session
    const session = getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Step 2: Add user message to session
    updateSessionMessages(sessionId, {
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    });

    // Step 3: Fetch dietary profile
    const dietaryProfile = await getDietaryProfile();

    // Step 4: Build prompt
    const prompt = buildConversationPrompt(session, dietaryProfile);

    // Step 5: Call OpenAI API
    const client = getOpenAIClient();
    const completion = await client.chat.completions.parse({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: GATHERING_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      response_format: zodResponseFormat(ConversationTurnSchema, 'conversation_turn'),
      temperature: 0.7,
      max_tokens: 500,
    });

    // Step 6: Extract parsed result
    const parsed = completion.choices[0]?.message.parsed;
    if (!parsed) {
      throw new Error('No response from AI');
    }

    // Step 7: Add AI message to session
    updateSessionMessages(sessionId, {
      role: 'assistant',
      content: parsed.aiMessage,
      timestamp: new Date(),
    });

    // Step 8: Return parsed result
    return parsed;
  } catch (error) {
    // Log error for debugging
    console.error('Error in processConversationTurn:', error);

    // Return fallback response
    return {
      aiMessage: "Sorry, I'm having trouble right now. Let's move forward with default settings.",
      extractedContext: {},
      shouldTransition: true,
      reasoning: 'AI service unavailable',
    };
  }
}

/**
 * Transitions a session from gathering to suggesting state.
 * Verifies required context, fetches ranked suggestions, and updates session.
 *
 * @param sessionId - The session ID to transition
 * @returns Result with suggestions and AI message, or error
 */
export async function transitionToSuggesting(sessionId: string): Promise<SuggestionResult> {
  try {
    // Step 1: Get session
    const session = getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Step 2: Verify required context
    if (
      session.userContext.energyLevel === undefined ||
      session.userContext.availableTime === undefined
    ) {
      throw new Error('Missing required context (energyLevel and availableTime)');
    }

    // Step 3: Update session state to suggesting
    updateSessionState(sessionId, 'suggesting');

    // Step 4: Get ranked suggestions
    const result = await getRankedSuggestions(sessionId);

    // Step 5: Extract recipe IDs
    const recipeIds = result.suggestions.map(suggestion => suggestion.recipeId);

    // Step 6: Update session with suggested recipes
    updateSessionSuggestedRecipes(sessionId, recipeIds);

    // Step 7: Build AI message
    const aiMessage = "Great! Based on your context, here are some recipes I think you'll love:";

    // Step 8: Return success result
    return {
      success: true,
      suggestions: result,
      aiMessage,
    };
  } catch (error) {
    // Log error for debugging
    console.error('Error in transitionToSuggesting:', error);

    // Return error result
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
