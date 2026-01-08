import { ipcMain } from 'electron';
import type { WebFrameMain } from 'electron/main';
import type { UserContext } from '../../shared/types/conversation.js';
import {
  createSession,
  getSession,
  updateSessionState,
  updateUserContext,
  addRejectedRecipe,
  abandonSession,
  getSessionTransitionMessage,
  clearSessionTransitionMessage,
  updateSessionSuggestedRecipes,
} from '../conversation/session-manager.js';
import {
  processConversationTurn,
  transitionToSuggesting,
  processRefinement,
} from '../conversation/conversation-service.js';
import { isE2ETest } from '../utils/test-env.js';
import {
  mockProcessConversationTurn,
  mockProcessRefinement,
} from '../conversation/conversation-service.mock.js';
import { mockGetRankedSuggestions } from '../conversation/recipe-ranker.mock.js';

/**
 * Validates the sender of an IPC message for security.
 * Only allows requests from file: protocol or localhost.
 *
 * @param frame - The WebFrameMain that sent the IPC message
 * @returns true if sender is authorized, false otherwise
 */
function validateSender(frame: WebFrameMain): boolean {
  const url = new URL(frame.url);
  return url.protocol === 'file:' || url.hostname === 'localhost';
}

/**
 * Registers IPC handlers for conversation decision support.
 * Handles conversation:start, conversation:sendMessage, conversation:reject-recipe,
 * conversation:refine, conversation:get-suggestions, and conversation:abandon channels with security validation.
 */
export function registerConversationHandlers(): void {
  ipcMain.handle('conversation:start', async event => {
    if (!event.senderFrame || !validateSender(event.senderFrame)) {
      return { success: false, error: 'Unauthorized IPC sender' };
    }

    const sessionId = await createSession();
    return { success: true, sessionId };
  });

  ipcMain.handle('conversation:sendMessage', async (event, sessionId: string, message: string) => {
    if (!event.senderFrame || !validateSender(event.senderFrame)) {
      return { success: false, error: 'Unauthorized IPC sender' };
    }

    const session = getSession(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    try {
      // Phase 2: AI-powered conversation
      const turnResult = isE2ETest()
        ? await mockProcessConversationTurn(sessionId, message)
        : await processConversationTurn(sessionId, message);

      console.log('Conversation handler using:', isE2ETest() ? 'MOCK' : 'REAL');

      // Update session context if AI extracted new information (filter out null values)
      const extractedContext = Object.fromEntries(
        Object.entries(turnResult.extractedContext).filter(([_, value]) => value != null)
      ) as Partial<UserContext>;

      if (Object.keys(extractedContext).length > 0) {
        updateUserContext(sessionId, extractedContext);
      }

      // Transition state if AI indicates readiness
      if (turnResult.shouldTransition) {
        updateSessionState(sessionId, 'suggesting');
      }

      return {
        success: true,
        aiMessage: turnResult.aiMessage,
        timestamp: new Date(),
        shouldTransition: turnResult.shouldTransition,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  });

  ipcMain.handle(
    'conversation:reject-recipe',
    async (event, sessionId: string, recipeId: string, reason?: string) => {
      if (!event.senderFrame || !validateSender(event.senderFrame)) {
        return { success: false, error: 'Unauthorized IPC sender' };
      }

      const session = getSession(sessionId);
      if (!session) {
        return { success: false, error: 'Session not found' };
      }

      try {
        addRejectedRecipe(sessionId, recipeId, reason);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred',
        };
      }
    }
  );

  ipcMain.handle('conversation:refine', async (event, sessionId: string) => {
    if (!event.senderFrame || !validateSender(event.senderFrame)) {
      return { success: false, error: 'Unauthorized IPC sender' };
    }

    const session = getSession(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    try {
      const result = isE2ETest()
        ? await mockProcessRefinement(sessionId)
        : await processRefinement(sessionId);

      console.log('Refinement handler using:', isE2ETest() ? 'MOCK' : 'REAL');

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  });

  ipcMain.handle('conversation:abandon', async (event, sessionId: string) => {
    if (!event.senderFrame || !validateSender(event.senderFrame)) {
      return { success: false, error: 'Unauthorized IPC sender' };
    }

    abandonSession(sessionId);
    return { success: true };
  });

  ipcMain.handle('conversation:get-suggestions', async (event, sessionId: string) => {
    if (!event.senderFrame || !validateSender(event.senderFrame)) {
      return { success: false, error: 'Unauthorized IPC sender' };
    }

    const session = getSession(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    try {
      let result;

      if (isE2ETest()) {
        // E2E mode: Inline mock logic to avoid creating additional mock function
        // Retrieve stored transition message from previous conversation turn
        const contextualMessage = getSessionTransitionMessage(sessionId);

        // Clear the stored message (one-time use)
        if (contextualMessage) {
          clearSessionTransitionMessage(sessionId);
        }

        // Verify required context
        if (
          session.userContext.energyLevel === undefined ||
          session.userContext.availableTime === undefined
        ) {
          throw new Error('Missing required context (energyLevel and availableTime)');
        }

        // Update session state to suggesting
        updateSessionState(sessionId, 'suggesting');

        // Get ranked suggestions using mock ranker
        const rankingResult = await mockGetRankedSuggestions(sessionId);

        // Extract recipe IDs
        const recipeIds = rankingResult.suggestions.map(suggestion => suggestion.recipeId);

        // Update session with suggested recipes
        updateSessionSuggestedRecipes(sessionId, recipeIds);

        // Use contextual AI message from conversation turn, or fallback to generic message
        const aiMessage =
          contextualMessage ||
          "Great! Based on your context, here are some recipes I think you'll love:";

        // Return success result
        result = {
          success: true,
          suggestions: rankingResult.suggestions,
          aiMessage,
        };
      } else {
        // Production mode: Use real transitionToSuggesting function
        result = await transitionToSuggesting(sessionId);
      }

      console.log('Suggestion handler using:', isE2ETest() ? 'MOCK' : 'REAL');

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  });
}
