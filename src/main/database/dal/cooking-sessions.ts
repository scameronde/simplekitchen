import { db } from '../init.js';
import type {
  CookingSession,
  CookingSessionTable,
  UserContext,
} from '../../../shared/types/conversation.js';
import { randomUUID } from 'crypto';

// Create a new cooking session
export async function createCookingSession(
  recipeId: string,
  userContext: UserContext,
  conversationSummary?: string
): Promise<CookingSession> {
  const id = randomUUID();
  const timestamp = new Date().toISOString();
  const userContextJson = JSON.stringify(userContext);

  const row: CookingSessionTable = {
    id,
    recipe_id: recipeId,
    timestamp,
    user_context: userContextJson,
    conversation_summary: conversationSummary ?? null,
  };

  await db.insertInto('cooking_sessions').values(row).execute();

  return {
    id,
    recipeId,
    timestamp: new Date(timestamp),
    userContext,
    conversationSummary: conversationSummary ?? null,
  };
}

// Get cooking session by ID
export async function getCookingSessionById(id: string): Promise<CookingSession | null> {
  const row = await db
    .selectFrom('cooking_sessions')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst();

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    recipeId: row.recipe_id,
    timestamp: new Date(row.timestamp),
    userContext: JSON.parse(row.user_context),
    conversationSummary: row.conversation_summary,
  };
}

// Get recent cooking sessions with optional limit
export async function getRecentCookingSessions(limit = 10): Promise<CookingSession[]> {
  const rows = await db
    .selectFrom('cooking_sessions')
    .selectAll()
    .orderBy('timestamp', 'desc')
    .limit(limit)
    .execute();

  return rows.map(row => ({
    id: row.id,
    recipeId: row.recipe_id,
    timestamp: new Date(row.timestamp),
    userContext: JSON.parse(row.user_context),
    conversationSummary: row.conversation_summary,
  }));
}
