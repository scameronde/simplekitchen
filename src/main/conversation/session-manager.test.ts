import { describe, it, expect, beforeEach } from 'vitest';
import {
  createSession,
  getSession,
  updateSessionMessages,
  abandonSession,
} from './session-manager.js';
import type { ConversationMessage } from '../../shared/types/conversation.js';

describe('Session Manager', () => {
  let sessionId: string;

  beforeEach(async () => {
    // Create a fresh session for each test
    sessionId = await createSession();
  });

  describe('createSession', () => {
    it('should generate unique sessionId', async () => {
      const sessionId1 = await createSession();
      const sessionId2 = await createSession();

      expect(sessionId1).toBeDefined();
      expect(sessionId2).toBeDefined();
      expect(sessionId1).not.toBe(sessionId2);
    });

    it('should store session in memory with correct initial state', async () => {
      const newSessionId = await createSession();
      const session = getSession(newSessionId);

      expect(session).not.toBeNull();
      expect(session!.sessionId).toBe(newSessionId);
      expect(session!.messages).toEqual([]);
      expect(session!.userContext).toEqual({});
      expect(session!.suggestedRecipes).toEqual([]);
      expect(session!.rejectedRecipes).toEqual([]);
      expect(session!.state).toBe('gathering');
      expect(session!.turnCount).toBe(0);
      expect(session!.createdAt).toBeInstanceOf(Date);
      expect(session!.lastActivity).toBeInstanceOf(Date);
    });
  });

  describe('getSession', () => {
    it('should retrieve existing session', () => {
      const session = getSession(sessionId);

      expect(session).not.toBeNull();
      expect(session!.sessionId).toBe(sessionId);
      expect(session!.state).toBe('gathering');
    });

    it('should return null for non-existent session', () => {
      const session = getSession('non-existent-session-id');

      expect(session).toBeNull();
    });
  });

  describe('updateSessionMessages', () => {
    it('should add message to session', () => {
      const message: ConversationMessage = {
        role: 'user',
        content: 'I want something quick for dinner',
        timestamp: new Date(),
      };

      updateSessionMessages(sessionId, message);
      const session = getSession(sessionId);

      expect(session!.messages).toHaveLength(1);
      expect(session!.messages[0]).toEqual(message);
    });

    it('should increment turnCount', () => {
      const message1: ConversationMessage = {
        role: 'user',
        content: 'First message',
        timestamp: new Date(),
      };
      const message2: ConversationMessage = {
        role: 'assistant',
        content: 'Second message',
        timestamp: new Date(),
      };

      const sessionBefore = getSession(sessionId);
      expect(sessionBefore!.turnCount).toBe(0);

      updateSessionMessages(sessionId, message1);
      const sessionAfter1 = getSession(sessionId);
      expect(sessionAfter1!.turnCount).toBe(1);

      updateSessionMessages(sessionId, message2);
      const sessionAfter2 = getSession(sessionId);
      expect(sessionAfter2!.turnCount).toBe(2);
    });

    it('should update lastActivity', async () => {
      const session = getSession(sessionId);
      const initialLastActivity = session!.lastActivity.getTime();

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      const message: ConversationMessage = {
        role: 'user',
        content: 'Test message',
        timestamp: new Date(),
      };

      updateSessionMessages(sessionId, message);
      const updatedSession = getSession(sessionId);
      const updatedLastActivity = updatedSession!.lastActivity.getTime();

      expect(updatedLastActivity).toBeGreaterThan(initialLastActivity);
    });

    it('should throw error for non-existent session', () => {
      const message: ConversationMessage = {
        role: 'user',
        content: 'Test message',
        timestamp: new Date(),
      };

      expect(() => {
        updateSessionMessages('non-existent-session-id', message);
      }).toThrow('Session non-existent-session-id not found');
    });
  });

  describe('abandonSession', () => {
    it('should delete session from memory', () => {
      // Verify session exists
      const sessionBefore = getSession(sessionId);
      expect(sessionBefore).not.toBeNull();

      // Abandon the session
      abandonSession(sessionId);

      // Verify session is deleted
      const sessionAfter = getSession(sessionId);
      expect(sessionAfter).toBeNull();
    });
  });
});
