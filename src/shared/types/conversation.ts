/**
 * @module conversation-types
 * Application-level conversation types for decision support feature.
 * These types manage conversational recipe suggestions and cooking session history.
 */

/**
 * Database table for cooking session history.
 * Stores completed cooking decisions for personalization across sessions.
 * @future Phase 0 - Database schema definition
 * @future Phase 1 - Used in cooking history tracking
 */
export interface CookingSessionTable {
  id: string; // UUID primary key
  recipe_id: string; // Foreign key to recipes.id
  timestamp: string; // ISO 8601 timestamp
  user_context: string; // JSON object (energy, time, mood, canShop)
  conversation_summary: string | null; // Optional summary
}

/**
 * Application-level cooking session with parsed fields.
 * Represents a completed cooking decision from conversational interaction.
 * @future Phase 1 - Used in cooking history analysis
 * @future Phase 2 - Used in variety intelligence
 */
export interface CookingSession {
  id: string;
  recipeId: string;
  timestamp: Date; // Parsed from ISO string
  userContext: UserContext;
  conversationSummary: string | null;
}

/**
 * User context gathered during conversation.
 * Represents current cooking constraints and preferences.
 * @future Phase 0 - Used in conversation gathering state
 * @future Phase 1 - Used in AI recipe ranking
 */
export interface UserContext {
  energyLevel?: 'low' | 'medium' | 'high';
  availableTime?: number; // minutes (30-60 range)
  mood?: string; // free-text description
  canShop?: boolean; // whether user can go shopping
}

/**
 * AI-ranked recipe suggestion with relevance scoring.
 * Used in Phase 3+ to provide detailed reasoning for recipe recommendations.
 * Extends basic recipe ID suggestions with scoring and explanation.
 * @future Phase 3 - Used in AI-ranked recipe suggestion display
 */
export interface RecipeSuggestion {
  recipeId: string;
  relevanceScore: number;
  reasoning: string; // 20-500 characters describing why it matches
  matchedFactors: string[]; // Tags like 'quick', 'low-energy', 'seasonal'
}

/**
 * Conversation state for flow control.
 * Tracks progression through decision support workflow.
 * @future Phase 0 - Used in state machine management
 */
export type ConversationState = 'gathering' | 'suggesting' | 'refining' | 'confirmed' | 'abandoned';

/**
 * Individual message in conversation thread.
 * Represents one turn in the conversational exchange.
 * @future Phase 0 - Used in message list rendering
 * @future Phase 1 - Passed to AI for context
 * @future Phase 3 - Uses suggestions field for displaying ranked recipe recommendations
 */
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestedRecipes?: string[]; // Recipe IDs (for assistant messages)
  suggestions?: RecipeSuggestion[]; // Full suggestion data for Phase 3+ AI-ranked recommendations
}

/**
 * Active conversation session (in-memory working state).
 * Manages conversation context, message history, and suggested recipes.
 * Session is ephemeral and does not persist after completion.
 * @future Phase 0 - Used in conversation service
 * @future Phase 1 - Used in iterative refinement
 */
export interface ConversationSession {
  sessionId: string; // UUID
  messages: ConversationMessage[]; // Last 5-10 messages (working memory)
  userContext: UserContext;
  suggestedRecipes: string[]; // All recipe IDs shown in this session
  rejectedRecipes: Array<{
    recipeId: string;
    reason?: string;
  }>;
  state: ConversationState;
  turnCount: number; // Track conversation length
  refinementCount: number; // Track refinement cycles (max 3)
  turnsInCurrentState: number; // Track turns in current state (for escalation)
  createdAt: Date;
  lastActivity: Date;
}
