import { ipcMain } from 'electron';
import type { WebFrameMain } from 'electron/main';
import {
  createSession,
  getSession,
  updateSessionMessages,
  abandonSession,
} from '../conversation/session-manager.js';
import type { ConversationMessage } from '../../shared/types/conversation.js';

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
 * Handles conversation:start, conversation:sendMessage, and conversation:abandon channels
 * with security validation.
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

    // Add user message to session
    const userMessage: ConversationMessage = {
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    updateSessionMessages(sessionId, userMessage);

    // Phase 1: Echo back (NO AI)
    const aiMessage: ConversationMessage = {
      role: 'assistant',
      content: `Echo: ${message}`,
      timestamp: new Date(),
    };
    updateSessionMessages(sessionId, aiMessage);

    return {
      success: true,
      aiMessage: aiMessage.content,
      timestamp: aiMessage.timestamp,
    };
  });

  ipcMain.handle('conversation:abandon', async (event, sessionId: string) => {
    if (!event.senderFrame || !validateSender(event.senderFrame)) {
      return { success: false, error: 'Unauthorized IPC sender' };
    }

    abandonSession(sessionId);
    return { success: true };
  });
}
