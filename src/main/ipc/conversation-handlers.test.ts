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
  updateSessionState: vi.fn(),
  updateUserContext: vi.fn(),
  abandonSession: vi.fn(),
}));

// Mock conversation service module
vi.mock('../conversation/conversation-service.js', () => ({
  processConversationTurn: vi.fn(),
}));

type ConversationStartResult = { success: boolean; sessionId?: string; error?: string };
type ConversationMessageResult = {
  success: boolean;
  aiMessage?: string;
  timestamp?: Date;
  shouldTransition?: boolean;
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
    it('processes AI conversation when session is valid', async () => {
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
        refinementCount: 0,
        turnsInCurrentState: 0,
        createdAt: new Date(),
        lastActivity: new Date(),
      });

      // Mock processConversationTurn to return AI response
      const { processConversationTurn } = await import('../conversation/conversation-service.js');
      vi.mocked(processConversationTurn).mockResolvedValue({
        aiMessage: 'How are you feeling today?',
        extractedContext: { energyLevel: 'medium' },
        shouldTransition: false,
      });

      const event = { senderFrame: { url: 'file://test' } };
      if (!messageHandlerFn) throw new Error('messageHandlerFn not initialized');
      const result = await messageHandlerFn(event, 'test-session-123', 'Hello');

      expect(result.success).toBe(true);
      expect(result.aiMessage).toBe('How are you feeling today?');
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.shouldTransition).toBe(false);

      // Verify session was retrieved
      expect(getSession).toHaveBeenCalledWith('test-session-123');

      // Verify conversation service was called
      expect(processConversationTurn).toHaveBeenCalledWith('test-session-123', 'Hello');

      // Verify user context was updated
      const { updateUserContext } = await import('../conversation/session-manager.js');
      expect(updateUserContext).toHaveBeenCalledWith('test-session-123', {
        energyLevel: 'medium',
      });

      // Verify state was NOT transitioned (shouldTransition=false)
      const { updateSessionState } = await import('../conversation/session-manager.js');
      expect(updateSessionState).not.toHaveBeenCalled();
    });

    it('transitions state when AI signals readiness', async () => {
      // Mock getSession to return a valid session
      const { getSession } = await import('../conversation/session-manager.js');
      vi.mocked(getSession).mockReturnValue({
        sessionId: 'test-session-123',
        messages: [],
        userContext: { energyLevel: 'low' },
        suggestedRecipes: [],
        rejectedRecipes: [],
        state: 'gathering',
        turnCount: 0,
        refinementCount: 0,
        turnsInCurrentState: 0,
        createdAt: new Date(),
        lastActivity: new Date(),
      });

      // Mock processConversationTurn to return AI response with transition
      const { processConversationTurn } = await import('../conversation/conversation-service.js');
      vi.mocked(processConversationTurn).mockResolvedValue({
        aiMessage: 'Perfect! Let me find some recipes for you.',
        extractedContext: { availableTime: 30 },
        shouldTransition: true,
      });

      const event = { senderFrame: { url: 'file://test' } };
      if (!messageHandlerFn) throw new Error('messageHandlerFn not initialized');
      const result = await messageHandlerFn(event, 'test-session-123', 'About 30 minutes');

      expect(result.success).toBe(true);
      expect(result.shouldTransition).toBe(true);

      // Verify user context was updated
      const { updateUserContext } = await import('../conversation/session-manager.js');
      expect(updateUserContext).toHaveBeenCalledWith('test-session-123', {
        availableTime: 30,
      });

      // Verify state WAS transitioned (shouldTransition=true)
      const { updateSessionState } = await import('../conversation/session-manager.js');
      expect(updateSessionState).toHaveBeenCalledWith('test-session-123', 'suggesting');
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

      // Verify conversation service was not called
      const { processConversationTurn } = await import('../conversation/conversation-service.js');
      expect(processConversationTurn).not.toHaveBeenCalled();
    });

    it('rejects unauthorized sender', async () => {
      const event = { senderFrame: { url: 'https://evil.com' } };
      if (!messageHandlerFn) throw new Error('messageHandlerFn not initialized');
      const result = await messageHandlerFn(event, 'test-session-123', 'Hello');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized IPC sender');

      // Verify getSession and conversation service were not called
      const { getSession } = await import('../conversation/session-manager.js');
      const { processConversationTurn } = await import('../conversation/conversation-service.js');
      expect(getSession).not.toHaveBeenCalled();
      expect(processConversationTurn).not.toHaveBeenCalled();
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

  describe('Conversation Flow (Phase 2)', () => {
    it('should gather context through multi-turn conversation', async () => {
      // Setup: Mock getSession to return a valid session
      const { getSession, updateUserContext, updateSessionState } =
        await import('../conversation/session-manager.js');
      vi.mocked(getSession).mockReturnValue({
        sessionId: 'test-session-123',
        messages: [],
        userContext: {},
        suggestedRecipes: [],
        rejectedRecipes: [],
        state: 'gathering',
        turnCount: 0,
        refinementCount: 0,
        turnsInCurrentState: 0,
        createdAt: new Date(),
        lastActivity: new Date(),
      });

      // Setup: Mock OpenAI responses for 3 turns
      const { processConversationTurn } = await import('../conversation/conversation-service.js');

      // Turn 1: Extract energyLevel='low', shouldTransition=false
      vi.mocked(processConversationTurn).mockResolvedValueOnce({
        aiMessage: "I understand you're feeling tired. How much time do you have to cook?",
        extractedContext: { energyLevel: 'low' },
        shouldTransition: false,
      });

      // Turn 2: Extract availableTime=30, shouldTransition=false
      vi.mocked(processConversationTurn).mockResolvedValueOnce({
        aiMessage: 'Great, 30 minutes is perfect. What kind of food are you in the mood for?',
        extractedContext: { availableTime: 30 },
        shouldTransition: false,
      });

      // Turn 3: Extract mood="comfort food", shouldTransition=true
      vi.mocked(processConversationTurn).mockResolvedValueOnce({
        aiMessage: 'Perfect! Let me find some comforting recipes for you.',
        extractedContext: { mood: 'comfort food' },
        shouldTransition: true,
      });

      const event = { senderFrame: { url: 'file://test' } };
      if (!messageHandlerFn) throw new Error('messageHandlerFn not initialized');

      // Execute Turn 1: "I'm tired"
      const result1 = await messageHandlerFn(event, 'test-session-123', "I'm tired");

      // Verify Turn 1
      expect(result1.success).toBe(true);
      expect(result1.aiMessage).toBe(
        "I understand you're feeling tired. How much time do you have to cook?"
      );
      expect(updateUserContext).toHaveBeenCalledWith('test-session-123', { energyLevel: 'low' });
      expect(updateSessionState).not.toHaveBeenCalled();

      // Execute Turn 2: "30 minutes"
      const result2 = await messageHandlerFn(event, 'test-session-123', '30 minutes');

      // Verify Turn 2
      expect(result2.success).toBe(true);
      expect(result2.aiMessage).toBe(
        'Great, 30 minutes is perfect. What kind of food are you in the mood for?'
      );
      expect(updateUserContext).toHaveBeenCalledWith('test-session-123', { availableTime: 30 });
      expect(updateSessionState).not.toHaveBeenCalled();

      // Execute Turn 3: "Want something comforting"
      const result3 = await messageHandlerFn(
        event,
        'test-session-123',
        'Want something comforting'
      );

      // Verify Turn 3
      expect(result3.success).toBe(true);
      expect(result3.aiMessage).toBe('Perfect! Let me find some comforting recipes for you.');
      expect(updateUserContext).toHaveBeenCalledWith('test-session-123', { mood: 'comfort food' });
      expect(updateSessionState).toHaveBeenCalledWith('test-session-123', 'suggesting');

      // Assert: All three turns completed successfully
      expect(processConversationTurn).toHaveBeenCalledTimes(3);
      expect(updateUserContext).toHaveBeenCalledTimes(3);
      expect(updateSessionState).toHaveBeenCalledTimes(1); // Only on turn 3
    });

    it('should handle AI failure mid-conversation', async () => {
      // Setup: Mock getSession to return a valid session
      const { getSession, updateUserContext } = await import('../conversation/session-manager.js');
      vi.mocked(getSession).mockReturnValue({
        sessionId: 'test-session-123',
        messages: [],
        userContext: {},
        suggestedRecipes: [],
        rejectedRecipes: [],
        state: 'gathering',
        turnCount: 0,
        refinementCount: 0,
        turnsInCurrentState: 0,
        createdAt: new Date(),
        lastActivity: new Date(),
      });

      // Setup: Mock processConversationTurn
      const { processConversationTurn } = await import('../conversation/conversation-service.js');

      // Turn 1: Successful
      vi.mocked(processConversationTurn).mockResolvedValueOnce({
        aiMessage: 'Tell me more about your preferences.',
        extractedContext: { energyLevel: 'medium' },
        shouldTransition: false,
      });

      // Turn 2: AI failure - throw error
      vi.mocked(processConversationTurn).mockRejectedValueOnce(new Error('OpenAI API failure'));

      const event = { senderFrame: { url: 'file://test' } };
      if (!messageHandlerFn) throw new Error('messageHandlerFn not initialized');

      // Execute Turn 1: Successful turn
      const result1 = await messageHandlerFn(event, 'test-session-123', 'I have some preferences');

      // Verify Turn 1 succeeded
      expect(result1.success).toBe(true);
      expect(result1.aiMessage).toBe('Tell me more about your preferences.');
      expect(updateUserContext).toHaveBeenCalledWith('test-session-123', {
        energyLevel: 'medium',
      });

      // Execute Turn 2: AI failure
      const result2 = await messageHandlerFn(event, 'test-session-123', 'More details here');

      // Verify: Error is caught, fallback response returned
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('OpenAI API failure');

      // Verify: No crash occurred (we got a response)
      expect(result2).toBeDefined();

      // Verify: processConversationTurn was called twice
      expect(processConversationTurn).toHaveBeenCalledTimes(2);
    });

    it('should support transition to suggestions after gathering context', async () => {
      // Setup: Mock getSession to return a valid session
      const { getSession, updateSessionState } = await import('../conversation/session-manager.js');
      vi.mocked(getSession).mockReturnValue({
        sessionId: 'test-session-123',
        messages: [],
        userContext: { energyLevel: 'low', availableTime: 30 },
        suggestedRecipes: [],
        rejectedRecipes: [],
        state: 'gathering',
        turnCount: 0,
        refinementCount: 0,
        turnsInCurrentState: 0,
        createdAt: new Date(),
        lastActivity: new Date(),
      });

      // Setup: Mock processConversationTurn to signal transition
      const { processConversationTurn } = await import('../conversation/conversation-service.js');
      vi.mocked(processConversationTurn).mockResolvedValueOnce({
        aiMessage: 'Perfect! Let me find some recipes.',
        extractedContext: {},
        shouldTransition: true,
      });

      const event = { senderFrame: { url: 'file://test' } };
      if (!messageHandlerFn) throw new Error('messageHandlerFn not initialized');

      // Execute: User confirms they want recipes
      const result = await messageHandlerFn(event, 'test-session-123', 'Yes, show me recipes');

      // Verify: Handler returned shouldTransition: true
      expect(result.success).toBe(true);
      expect(result.shouldTransition).toBe(true);
      expect(result.aiMessage).toBe('Perfect! Let me find some recipes.');

      // Verify: State was transitioned to 'suggesting'
      expect(updateSessionState).toHaveBeenCalledWith('test-session-123', 'suggesting');

      // Note: Frontend is responsible for calling getSuggestions when it sees shouldTransition: true
      // This test verifies the backend correctly signals the transition
    });
  });
});
