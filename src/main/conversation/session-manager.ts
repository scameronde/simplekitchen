/**
 * @module session-manager
 * In-memory conversation session management for decision support feature.
 * Manages active conversation sessions with automatic cleanup of stale sessions.
 */

import type {
  ConversationSession,
  ConversationMessage,
  ConversationState,
  UserContext,
} from '../../shared/types/conversation.js';
import { randomUUID } from 'crypto';

// In-memory session storage (Map<sessionId, ConversationSession>)
const activeSessions = new Map<string, ConversationSession>();

/**
 * Creates a new conversation session.
 * Initializes session with empty messages, gathering state, and zero turn count.
 * @returns Promise resolving to the new session ID (UUID)
 */
export async function createSession(): Promise<string> {
  const sessionId = randomUUID();
  const session: ConversationSession = {
    sessionId,
    messages: [],
    userContext: {},
    suggestedRecipes: [],
    rejectedRecipes: [],
    state: 'gathering',
    turnCount: 0,
    createdAt: new Date(),
    lastActivity: new Date(),
  };
  activeSessions.set(sessionId, session);
  return sessionId;
}

/**
 * Retrieves a conversation session by ID.
 * @param sessionId - The session ID to retrieve
 * @returns The conversation session or null if not found
 */
export function getSession(sessionId: string): ConversationSession | null {
  return activeSessions.get(sessionId) ?? null;
}

/**
 * Adds a message to a session and updates session metadata.
 * Updates turnCount and lastActivity timestamp.
 * @param sessionId - The session ID to update
 * @param message - The message to add to the session
 * @throws Error if session not found
 */
export function updateSessionMessages(sessionId: string, message: ConversationMessage): void {
  const session = activeSessions.get(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);

  session.messages.push(message);
  session.turnCount += 1;
  session.lastActivity = new Date();
}

/**
 * Updates the state of a conversation session.
 * Transitions session through workflow states (gathering → suggesting → refining → confirmed/abandoned).
 * @param sessionId - The session ID to update
 * @param newState - The new conversation state
 * @throws Error if session not found
 */
export function updateSessionState(sessionId: string, newState: ConversationState): void {
  const session = activeSessions.get(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);

  session.state = newState;
  session.lastActivity = new Date();
}

/**
 * Updates the user context for a conversation session.
 * Merges new context data (e.g., energyLevel, availableTime) with existing context.
 * @param sessionId - The session ID to update
 * @param contextUpdates - Partial context fields to merge
 * @throws Error if session not found
 */
export function updateUserContext(sessionId: string, contextUpdates: Partial<UserContext>): void {
  const session = activeSessions.get(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);

  session.userContext = { ...session.userContext, ...contextUpdates };
  session.lastActivity = new Date();
}

/**
 * Deletes a session from active sessions.
 * Used when user explicitly abandons conversation or confirms recipe selection.
 * @param sessionId - The session ID to abandon
 */
export function abandonSession(sessionId: string): void {
  activeSessions.delete(sessionId);
}

/**
 * Removes sessions that have been inactive for more than 30 minutes.
 * Called periodically by cleanup timer.
 */
export function cleanupStaleSessions(): void {
  const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
  for (const [sessionId, session] of activeSessions.entries()) {
    if (session.lastActivity.getTime() < thirtyMinutesAgo) {
      activeSessions.delete(sessionId);
    }
  }
}

// Start cleanup timer (runs every 10 minutes)
setInterval(cleanupStaleSessions, 10 * 60 * 1000);
