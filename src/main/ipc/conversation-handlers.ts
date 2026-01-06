import { ipcMain } from 'electron';
import type { WebFrameMain } from 'electron/main';
import {
  createSession,
  getSession,
  updateSessionState,
  updateUserContext,
  addRejectedRecipe,
  abandonSession,
} from '../conversation/session-manager.js';
import {
  processConversationTurn,
  transitionToSuggesting,
  processRefinement,
} from '../conversation/conversation-service.js';

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
      const turnResult = await processConversationTurn(sessionId, message);

      // Update session context if AI extracted new information
      if (Object.keys(turnResult.extractedContext).length > 0) {
        updateUserContext(sessionId, turnResult.extractedContext);
      }

      // Transition state if AI indicates readiness
      if (turnResult.shouldTransition) {
        updateSessionState(sessionId, 'suggesting');
      }

      return {
        success: true,
        aiMessage: turnResult.aiMessage,
        timestamp: new Date(),
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
      const result = await processRefinement(sessionId);
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
      const result = await transitionToSuggesting(sessionId);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  });
}
