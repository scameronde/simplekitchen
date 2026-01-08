/**
 * @module conversation-service-mock
 * Mock implementation of conversation service for E2E testing.
 * Provides deterministic responses based on pattern matching instead of OpenAI API calls.
 */

import type { ConversationTurnOutput } from './conversation-schema.js';
import type { SuggestionResult } from './conversation-service.js';
import {
  getSession,
  updateSessionMessages,
  updateUserContext,
  setSessionTransitionMessage,
} from './session-manager.js';
import { mockGetRankedSuggestions } from './recipe-ranker.mock.js';

/**
 * Mock implementation of processConversationTurn for E2E tests.
 * Uses pattern matching on userMessage to return deterministic responses.
 * Maintains conversation state in session via session-manager functions.
 *
 * @param sessionId - The session ID to process
 * @param userMessage - The user's message text
 * @returns AI response with extracted context and transition flag
 * @throws Error if session not found or test signal triggered
 */
export async function mockProcessConversationTurn(
  sessionId: string,
  userMessage: string
): Promise<ConversationTurnOutput> {
  // Test signal: Invalid session (check before getSession to test error handling)
  if (userMessage === 'MOCK_INVALID_SESSION') {
    throw new Error('Session not found');
  }

  // Step 1: Validate session exists
  const session = getSession(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  // Test signal: API error
  if (userMessage === 'MOCK_API_ERROR') {
    throw new Error('OpenAI API unavailable');
  }

  // Step 2: Add user message to session
  updateSessionMessages(sessionId, {
    role: 'user',
    content: userMessage,
    timestamp: new Date(),
  });

  // Step 3: Pattern match userMessage to extract context and generate response
  let aiMessage: string;
  const extractedContext: {
    energyLevel?: 'low' | 'medium' | 'high';
    availableTime?: number;
    mood?: string;
    canShop?: boolean;
  } = {};
  let shouldTransition = false;

  // Pattern 1: Energy level extraction (tired/low energy/exhausted)
  if (/tired|low energy|exhausted/i.test(userMessage)) {
    extractedContext.energyLevel = 'low';
    aiMessage = 'I hear you! How much time do you have? 30 minutes? 45?';
    shouldTransition = false;
  }
  // Pattern 2: Time extraction (30 minutes) - only transition if energyLevel exists
  else if (/30 minutes?|about 30|thirty/i.test(userMessage)) {
    // Check if energyLevel already exists in session
    if (session.userContext.energyLevel) {
      extractedContext.availableTime = 30;
      aiMessage =
        'Perfect! With low energy and 30 minutes, let me find you some quick and easy recipes!';
      shouldTransition = true;
    } else {
      // User mentioned time but we don't have energy level yet
      extractedContext.availableTime = 30;
      aiMessage = "30 minutes sounds good! But first, how's your energy level tonight?";
      shouldTransition = false;
    }
  }
  // Pattern 3: Greeting (hello/hi/hey) - initial conversation start
  else if (/hello|hi|hey/i.test(userMessage)) {
    aiMessage =
      "Hi! How's your energy level tonight? Feeling up for some cooking or need something really simple?";
    shouldTransition = false;
  }
  // Pattern 4: Default fallback for unrecognized input
  else {
    aiMessage = "I'd love to help! Could you tell me how you're feeling energy-wise tonight?";
    shouldTransition = false;
  }

  // Step 4: Update session with extracted context (if any)
  if (Object.keys(extractedContext).length > 0) {
    updateUserContext(sessionId, extractedContext);
  }

  // Step 5: Add AI message to session
  updateSessionMessages(sessionId, {
    role: 'assistant',
    content: aiMessage,
    timestamp: new Date(),
  });

  // Step 6: Store transition message if transitioning
  if (shouldTransition) {
    setSessionTransitionMessage(sessionId, aiMessage);
  }

  // Step 7: Return ConversationTurnOutput
  return {
    aiMessage,
    extractedContext,
    shouldTransition,
  };
}

/**
 * Mock implementation of processRefinement for E2E tests.
 * Handles refinement cycles when user rejects suggested recipes.
 * Enforces max 3 refinement cycles, escalating to manual browsing after limit.
 *
 * @param sessionId - The session ID to process refinement for
 * @returns Result with new suggestions and AI message, or escalation message
 * @throws Error if session not found
 */
export async function mockProcessRefinement(sessionId: string): Promise<SuggestionResult> {
  // Step 1: Validate session exists
  const session = getSession(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  // Step 2: Check if max refinements reached (3)
  if (session.refinementCount >= 3) {
    return {
      success: true,
      aiMessage:
        "I've shown you quite a few options. Would you like to browse recipes by category instead?",
      suggestions: [], // Escalation - no more suggestions
    };
  }

  // Step 3: Get new suggestions excluding rejected recipes
  // mockGetRankedSuggestions already handles filtering rejected recipes
  const result = await mockGetRankedSuggestions(sessionId);

  // Step 4: Return success result with AI message
  return {
    success: true,
    aiMessage: 'Let me find you some different options!',
    suggestions: result.suggestions,
  };
}
