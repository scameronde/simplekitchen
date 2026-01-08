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
    refinementCount: 0,
    turnsInCurrentState: 0,
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
  session.turnsInCurrentState += 1;
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
  session.turnsInCurrentState = 0;
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
 * Updates the suggested recipes for a conversation session.
 * Appends the provided recipe IDs to suggestedRecipes and deduplicates.
 * @param sessionId - The session ID to update
 * @param recipeIds - Array of recipe IDs to append
 * @throws Error if session not found
 */
export function updateSessionSuggestedRecipes(sessionId: string, recipeIds: string[]): void {
  const session = activeSessions.get(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);

  // Append and deduplicate
  const combined = [...session.suggestedRecipes, ...recipeIds];
  session.suggestedRecipes = Array.from(new Set(combined));
  session.lastActivity = new Date();
}

/**
 * Sets the transition message for the session.
 * Used when shouldTransition=true to store AI's contextual intro.
 * @param sessionId - The session ID to update
 * @param message - The transition message to store
 * @throws Error if session not found
 */
export function setSessionTransitionMessage(sessionId: string, message: string): void {
  const session = activeSessions.get(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);

  session.transitionMessage = message;
  session.lastActivity = new Date();
}

/**
 * Retrieves the stored transition message from the session.
 * @param sessionId - The session ID to retrieve from
 * @returns The transition message or undefined if not set or session not found
 */
export function getSessionTransitionMessage(sessionId: string): string | undefined {
  const session = activeSessions.get(sessionId);
  return session?.transitionMessage;
}

/**
 * Clears the transition message from the session after it has been consumed.
 * @param sessionId - The session ID to update
 * @throws Error if session not found
 */
export function clearSessionTransitionMessage(sessionId: string): void {
  const session = activeSessions.get(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);

  session.transitionMessage = undefined;
  session.lastActivity = new Date();
}

/**
 * Adds a rejected recipe to the session's rejection list.
 * Records recipe ID and optional reason for rejection.
 * Increments refinement count to track refinement cycles.
 * @param sessionId - The session ID to update
 * @param recipeId - The recipe ID that was rejected
 * @param reason - Optional reason for rejection (e.g., "Missing ingredient")
 * @throws Error if session not found
 */
export function addRejectedRecipe(sessionId: string, recipeId: string, reason?: string): void {
  const session = activeSessions.get(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);

  session.rejectedRecipes.push({ recipeId, reason });
  session.refinementCount += 1;
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
