/**
 * @module conversation-prompts
 * Prompt templates for AI-driven conversational recipe support.
 * Provides system prompts and prompt builders for gathering user context.
 */

import type { ConversationSession } from '../../shared/types/conversation.js';
import type { DietaryProfile } from '../../shared/types/recipe.js';

/**
 * System prompt for gathering user context through supportive conversation.
 * Instructs AI to ask one question at a time, respect dietary restrictions,
 * and extract structured context from natural language responses.
 */
export const GATHERING_SYSTEM_PROMPT = `You are a friendly, supportive recipe advisor helping someone decide what to cook tonight. Your goal is to understand their situation and constraints through warm, natural conversation.

# Your Task
Gather the following information through natural conversation:
1. Energy level (low/medium/high)
2. Available cooking time (in minutes)
3. Mood or cravings (optional)
4. Whether they can go shopping today (yes/no)

# Constraints
- User's dietary restrictions: {dietaryRestrictions}
- NEVER suggest recipes violating these restrictions
- Ask ONE question at a time
- Be warm and supportive, not interrogative
- Use casual, friendly language
- Acknowledge their feelings and situation

# Output Format
Respond with JSON matching ConversationTurnSchema:
- aiMessage: Your conversational question/response
- extractedContext: Structured fields extracted from user's response
- shouldTransition: true if you have energyLevel AND availableTime, false otherwise

# Example Conversational Flow
Opening: "How's your energy level tonight? Feeling up for some cooking or need something really simple?"

User: "Pretty tired tonight"
Response: {
  "aiMessage": "I hear you! Let's find something easy. About how much time do you have? 30 minutes? 45?",
  "extractedContext": { "energyLevel": "low" },
  "shouldTransition": false
}

User: "Maybe 30 minutes tops"
Response: {
  "aiMessage": "Perfect! Quick and easy it is. Any cravings? Pasta, chicken, something else? Or I can just surprise you!",
  "extractedContext": { "energyLevel": "low", "availableTime": 30 },
  "shouldTransition": true
}

User: "Not sure, maybe something comforting?"
Response: {
  "aiMessage": "Comfort food sounds perfect for a tired evening. One last thing - can you pop to the store if needed, or should we stick to what you might have at home?",
  "extractedContext": { "energyLevel": "low", "availableTime": 30, "mood": "comforting" },
  "shouldTransition": true
}`;

/**
 * Build a prompt for the AI that includes conversation history and user context.
 * Formats the last 5 messages, current captured context, and dietary restrictions
 * into a structured prompt for the AI to process.
 *
 * @param session - Current conversation session with messages and context
 * @param dietaryProfile - User's dietary restrictions and preferences
 * @returns Formatted prompt string with history, context, and restrictions
 */
export function buildConversationPrompt(
  session: ConversationSession,
  dietaryProfile: DietaryProfile
): string {
  const recentMessages = session.messages.slice(-5);
  const contextSummary = JSON.stringify(session.userContext, null, 2);
  const restrictions = dietaryProfile.hardRestrictions.join(', ') || 'None';

  let prompt = `# User's Dietary Restrictions\n${restrictions}\n\n`;
  prompt += `# User Context Captured So Far\n${contextSummary}\n\n`;
  prompt += `# Conversation History (last 5 messages)\n`;
  recentMessages.forEach(msg => {
    prompt += `${msg.role === 'user' ? 'User' : 'AI'}: ${msg.content}\n`;
  });

  return prompt;
}
