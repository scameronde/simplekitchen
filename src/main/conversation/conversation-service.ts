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
  setSessionTransitionMessage,
} from './session-manager.js';
import { getDietaryProfile } from '../database/dal/dietary-profile.js';
import { buildConversationMessages } from './prompts.js';
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
  suggestions?: RecipeSuggestionOutput['suggestions'];
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

    // Step 4: Re-fetch session with updated messages and build message array
    const updatedSession = getSession(sessionId);
    if (!updatedSession) throw new Error(`Session ${sessionId} not found`);
    const messages = buildConversationMessages(updatedSession, dietaryProfile);

    // Step 5: Call OpenAI API with full conversation history
    const client = getOpenAIClient();
    const completion = await client.chat.completions.parse({
      model: 'gpt-4o-mini',
      messages: messages, // ← Now an array of messages, not [system, user]
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

    // Step 8: If transitioning, store the AI message for use in transitionToSuggesting()
    if (parsed.shouldTransition) {
      setSessionTransitionMessage(sessionId, parsed.aiMessage);
    }

    // Step 9: Return parsed result
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
      suggestions: result.suggestions,
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

/**
 * Processes a refinement cycle when user rejects a suggested recipe.
 * Enforces max 3 refinement cycles, escalating to manual browsing after limit.
 * Fetches new ranked suggestions excluding rejected recipes.
 *
 * @param sessionId - The session ID to process refinement for
 * @returns Result with new suggestions and AI message, or escalation message, or error
 */
export async function processRefinement(sessionId: string): Promise<SuggestionResult> {
  try {
    // Step 1: Get session
    const session = getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Step 2: Validate current state (must be 'suggesting' or 'refining')
    if (session.state !== 'suggesting' && session.state !== 'refining') {
      throw new Error(
        `Cannot refine from state '${session.state}'. Must be 'suggesting' or 'refining'.`
      );
    }

    // Step 3: Check refinement count - if > 3, return escalation response
    if (session.refinementCount > 3) {
      const escalationMessage =
        "I've shown you quite a few options, but haven't found the perfect match yet. Let me suggest some alternatives:\n\n" +
        '1. **Browse by Category** - I can show you all recipes in a specific category (e.g., pasta, chicken, vegetarian)\n' +
        "2. **Relax Constraints** - Tell me which constraint to relax (e.g., 'I can spend more time' or 'I'll go shopping')\n" +
        "3. **Start Fresh** - Let's restart the conversation and try a different approach\n\n" +
        'Which would you prefer?';

      // Add escalation message to session
      updateSessionMessages(sessionId, {
        role: 'assistant',
        content: escalationMessage,
        timestamp: new Date(),
      });

      return {
        success: true,
        aiMessage: escalationMessage,
        suggestions: undefined,
      };
    }

    // Step 4: Verify required context (energyLevel and availableTime must exist)
    if (
      session.userContext.energyLevel === undefined ||
      session.userContext.availableTime === undefined
    ) {
      throw new Error('Missing required context (energyLevel and availableTime)');
    }

    // Step 5: Update session state to 'refining' if not already
    if (session.state !== 'refining') {
      updateSessionState(sessionId, 'refining');
    }

    // Step 6: Get new ranked suggestions (already excludes rejected recipes)
    const result = await getRankedSuggestions(sessionId);

    // Step 7: Extract recipe IDs
    const recipeIds = result.suggestions.map(suggestion => suggestion.recipeId);

    // Step 8: Update session with suggested recipes
    updateSessionSuggestedRecipes(sessionId, recipeIds);

    // Step 9: Build AI message based on refinementCount
    let aiMessage: string;
    if (session.refinementCount === 1) {
      aiMessage = 'Got it! Let me find some different options for you:';
    } else if (session.refinementCount === 2) {
      aiMessage = "No problem! Let's try a different approach with these recipes:";
    } else {
      // refinementCount >= 3
      aiMessage = "I'm determined to find the right recipe for you. How about these:";
    }

    // Step 10: Add AI message to session
    updateSessionMessages(sessionId, {
      role: 'assistant',
      content: aiMessage,
      timestamp: new Date(),
    });

    // Step 11: Return success result
    return {
      success: true,
      suggestions: result.suggestions,
      aiMessage,
    };
  } catch (error) {
    // Log error for debugging
    console.error('Error in processRefinement:', error);

    // Return error result
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
