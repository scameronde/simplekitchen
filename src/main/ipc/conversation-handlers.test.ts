/**
 * @module conversation-handlers.test
 * Integration tests for conversation decision support IPC handlers.
 * Tests security validation, session management, and message flow.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock electron module
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}));

// Mock session manager module
vi.mock('../conversation/session-manager.js', () => ({
  createSession: vi.fn(),
  getSession: vi.fn(),
  updateSessionMessages: vi.fn(),
  abandonSession: vi.fn(),
}));

type ConversationStartResult = { success: boolean; sessionId?: string; error?: string };
type ConversationMessageResult = {
  success: boolean;
  aiMessage?: string;
  timestamp?: Date;
  error?: string;
};
type ConversationAbandonResult = { success: boolean; error?: string };

type StartHandler = (event: { senderFrame?: { url: string } }) => Promise<ConversationStartResult>;
type MessageHandler = (
  event: { senderFrame?: { url: string } },
  sessionId: string,
  message: string
) => Promise<ConversationMessageResult>;
type AbandonHandler = (
  event: { senderFrame?: { url: string } },
  sessionId: string
) => Promise<ConversationAbandonResult>;

describe('Conversation IPC Handlers', () => {
  let startHandlerFn: StartHandler | undefined;
  let messageHandlerFn: MessageHandler | undefined;
  let abandonHandlerFn: AbandonHandler | undefined;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();

    // Import electron to get the mocked ipcMain
    const { ipcMain } = await import('electron');

    // Capture handler functions when handle is called
    vi.mocked(ipcMain.handle).mockImplementation((channel, fn) => {
      if (channel === 'conversation:start') startHandlerFn = fn as StartHandler;
      if (channel === 'conversation:sendMessage') messageHandlerFn = fn as MessageHandler;
      if (channel === 'conversation:abandon') abandonHandlerFn = fn as AbandonHandler;
    });

    // Import and register handlers after mocks are set up
    const { registerConversationHandlers } = await import('./conversation-handlers.js');
    registerConversationHandlers();
  });

  describe('conversation:start', () => {
    it('returns sessionId when authorized', async () => {
      // Mock createSession to return a test session ID
      const { createSession } = await import('../conversation/session-manager.js');
      vi.mocked(createSession).mockResolvedValue('test-session-123');

      const event = { senderFrame: { url: 'file://test' } };
      if (!startHandlerFn) throw new Error('startHandlerFn not initialized');
      const result = await startHandlerFn(event);

      expect(result.success).toBe(true);
      expect(result.sessionId).toBe('test-session-123');
      expect(createSession).toHaveBeenCalledTimes(1);
    });

    it('rejects unauthorized sender', async () => {
      const event = { senderFrame: { url: 'https://evil.com' } };
      if (!startHandlerFn) throw new Error('startHandlerFn not initialized');
      const result = await startHandlerFn(event);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized IPC sender');

      // Verify createSession was not called
      const { createSession } = await import('../conversation/session-manager.js');
      expect(createSession).not.toHaveBeenCalled();
    });
  });

  describe('conversation:sendMessage', () => {
    it('echoes message back when session is valid', async () => {
      // Mock getSession to return a valid session
      const { getSession } = await import('../conversation/session-manager.js');
      vi.mocked(getSession).mockReturnValue({
        sessionId: 'test-session-123',
        messages: [],
        userContext: {},
        suggestedRecipes: [],
        rejectedRecipes: [],
        state: 'gathering',
        turnCount: 0,
        createdAt: new Date(),
        lastActivity: new Date(),
      });

      const event = { senderFrame: { url: 'file://test' } };
      if (!messageHandlerFn) throw new Error('messageHandlerFn not initialized');
      const result = await messageHandlerFn(event, 'test-session-123', 'Hello');

      expect(result.success).toBe(true);
      expect(result.aiMessage).toBe('Echo: Hello');
      expect(result.timestamp).toBeInstanceOf(Date);

      // Verify session was retrieved
      expect(getSession).toHaveBeenCalledWith('test-session-123');

      // Verify messages were updated (2 calls: user message + AI message)
      const { updateSessionMessages } = await import('../conversation/session-manager.js');
      expect(updateSessionMessages).toHaveBeenCalledTimes(2);

      // Verify first call was user message
      const firstCall = vi.mocked(updateSessionMessages).mock.calls[0];
      expect(firstCall).toBeDefined();
      expect(firstCall?.[0]).toBe('test-session-123');
      expect(firstCall?.[1]).toMatchObject({
        role: 'user',
        content: 'Hello',
      });

      // Verify second call was AI message
      const secondCall = vi.mocked(updateSessionMessages).mock.calls[1];
      expect(secondCall).toBeDefined();
      expect(secondCall?.[0]).toBe('test-session-123');
      expect(secondCall?.[1]).toMatchObject({
        role: 'assistant',
        content: 'Echo: Hello',
      });
    });

    it('rejects invalid sessionId', async () => {
      // Mock getSession to return null (session not found)
      const { getSession } = await import('../conversation/session-manager.js');
      vi.mocked(getSession).mockReturnValue(null);

      const event = { senderFrame: { url: 'file://test' } };
      if (!messageHandlerFn) throw new Error('messageHandlerFn not initialized');
      const result = await messageHandlerFn(event, 'invalid-session', 'Hello');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Session not found');

      // Verify updateSessionMessages was not called
      const { updateSessionMessages } = await import('../conversation/session-manager.js');
      expect(updateSessionMessages).not.toHaveBeenCalled();
    });

    it('rejects unauthorized sender', async () => {
      const event = { senderFrame: { url: 'https://evil.com' } };
      if (!messageHandlerFn) throw new Error('messageHandlerFn not initialized');
      const result = await messageHandlerFn(event, 'test-session-123', 'Hello');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized IPC sender');

      // Verify getSession and updateSessionMessages were not called
      const { getSession, updateSessionMessages } =
        await import('../conversation/session-manager.js');
      expect(getSession).not.toHaveBeenCalled();
      expect(updateSessionMessages).not.toHaveBeenCalled();
    });
  });

  describe('conversation:abandon', () => {
    it('cleans up session when authorized', async () => {
      const event = { senderFrame: { url: 'file://test' } };
      if (!abandonHandlerFn) throw new Error('abandonHandlerFn not initialized');
      const result = await abandonHandlerFn(event, 'test-session-123');

      expect(result.success).toBe(true);

      // Verify abandonSession was called
      const { abandonSession } = await import('../conversation/session-manager.js');
      expect(abandonSession).toHaveBeenCalledWith('test-session-123');
    });

    it('rejects unauthorized sender', async () => {
      const event = { senderFrame: { url: 'https://evil.com' } };
      if (!abandonHandlerFn) throw new Error('abandonHandlerFn not initialized');
      const result = await abandonHandlerFn(event, 'test-session-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized IPC sender');

      // Verify abandonSession was not called
      const { abandonSession } = await import('../conversation/session-manager.js');
      expect(abandonSession).not.toHaveBeenCalled();
    });
  });
});
