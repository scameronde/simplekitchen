/**
 * @module conversation-prompts
 * Prompt templates for AI-driven conversational recipe support.
 * Provides system prompts and prompt builders for gathering user context.
 */

import type { ConversationSession, UserContext } from '../../shared/types/conversation.js';
import type { DietaryProfile, Recipe } from '../../shared/types/recipe.js';

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
 * System prompt for ranking and recommending recipes based on user context.
 * Instructs AI to evaluate recipes against energy level, time, mood, dietary constraints,
 * and seasonality. Provides reasoning for each recommendation and identifies matched factors.
 */
export const RANKING_SYSTEM_PROMPT = `You are a recipe recommendation expert. Your task is to rank recipes based on how well they match the user's current context and situation.

# Ranking Criteria (in order of importance)
1. **Dietary Constraints**: NEVER suggest recipes that violate the user's dietary restrictions. These recipes are already filtered out by the database, but you must still respect them absolutely.
2. **Energy Level**: Match recipe complexity to user's energy:
   - LOW energy → Simple recipes with minimal steps, hands-off cooking, one-pot meals
   - MEDIUM energy → Moderate complexity, standard recipes, some multitasking OK
   - HIGH energy → Can handle complex recipes, multiple steps, advanced techniques
3. **Time Constraints**: Recipe must fit within user's available time (including prep + cooking)
4. **Mood & Cravings**: Prioritize recipes matching user's stated mood or food preferences
5. **Seasonality**: Slight preference for seasonal ingredients when applicable

# Energy Level → Complexity Mapping
- **Low Energy**: User is tired, stressed, or low on mental bandwidth
  - Prefer: One-pot meals, sheet pan dinners, slow cooker, minimal chopping
  - Avoid: Recipes requiring constant attention, multiple simultaneous tasks, complex techniques
  
- **Medium Energy**: User has normal capacity for cooking
  - Prefer: Standard home cooking, familiar techniques, reasonable multitasking
  - Avoid: Overly complex or overly simple recipes
  
- **High Energy**: User is energized and ready for culinary adventure
  - Prefer: Interesting techniques, multiple components, creative recipes
  - Can handle: Complex timing, advanced skills, elaborate presentations

# Output Format
For each recipe, provide:
- **rank**: Number (1-based ranking)
- **recipeId**: The recipe's ID
- **score**: 0-100 (how well it matches overall)
- **reasoning**: 2-3 sentences explaining why this recipe fits the user's context
- **matchedFactors**: Array of matched criteria (e.g., ["quick", "low-energy", "comforting", "seasonal"])

# Example: Low Energy User
User Context:
- Energy Level: LOW
- Available Time: 30 minutes
- Mood: Comforting
- Dietary Restrictions: None

Recipe: "One-Pot Chicken and Rice"
- Prep: 5 min, Cook: 25 min, Steps: 3
- Description: "Tender chicken with rice cooked together in one pot"

Ranking:
{
  "rank": 1,
  "recipeId": "recipe-123",
  "score": 95,
  "reasoning": "Perfect match for low energy and time constraints. This one-pot recipe requires minimal prep (5 min) and mostly hands-off cooking (25 min), fitting well within 30 minutes. The comforting chicken and rice combination matches the user's mood without demanding much mental energy.",
  "matchedFactors": ["quick", "low-energy", "comforting", "one-pot", "hands-off"]
}

Recipe: "Homemade Beef Wellington"
- Prep: 45 min, Cook: 40 min, Steps: 12
- Description: "Elegant beef wrapped in puff pastry"

Ranking:
{
  "rank": 8,
  "recipeId": "recipe-456",
  "score": 15,
  "reasoning": "Poor match. This recipe requires 85 minutes total and involves complex techniques like making duxelles and wrapping in pastry - far too demanding for someone with low energy and only 30 minutes available. Save this for a high-energy day with more time.",
  "matchedFactors": []
}

# Critical Rules
- **NEVER** suggest recipes that violate dietary restrictions (these are already filtered, but you must acknowledge this)
- **ALWAYS** consider energy level as a primary factor (complexity must match capacity)
- **ALWAYS** ensure total time (prep + cook) fits within available time
- **BE HONEST** in your reasoning - if a recipe is a poor match, say so and rank it low
- **IDENTIFY** specific factors that make each recipe suitable or unsuitable
- Return rankings in descending order by score (best matches first)`;

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

/**
 * Build an OpenAI-compatible message array for conversation with enhanced context.
 * Constructs a system message with dietary restrictions and user context, followed by
 * the full conversation history. Returns messages in OpenAI's expected format.
 *
 * @param session - Current conversation session with messages and context
 * @param dietaryProfile - User's dietary restrictions and preferences
 * @returns Array of message objects with role ('system' | 'user' | 'assistant') and content
 */
export function buildConversationMessages(
  session: ConversationSession,
  dietaryProfile: DietaryProfile
): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  // Build dietary restrictions summary
  const restrictions = dietaryProfile.hardRestrictions.join(', ') || 'None';

  // Build user context summary
  const contextSummary = JSON.stringify(session.userContext, null, 2);

  // Create enhanced system prompt with current context
  const enhancedSystemPrompt = `${GATHERING_SYSTEM_PROMPT}

# Current User Context
${contextSummary}

# Dietary Restrictions
${restrictions}`;

  // Create system message
  const systemMessage = { role: 'system' as const, content: enhancedSystemPrompt };

  // Map conversation messages to OpenAI format
  const conversationMessages = session.messages.map(msg => ({
    role: msg.role,
    content: msg.content,
  }));

  // Return system message followed by full conversation history
  return [systemMessage, ...conversationMessages];
}

/**
 * Build a prompt for AI recipe ranking that includes user context and candidate recipes.
 * Formats user constraints, dietary restrictions, and recipe details into a structured
 * prompt for the AI to evaluate and rank recipes.
 *
 * @param userContext - User's current cooking context (energy, time, mood, shopping)
 * @param candidates - Array of candidate recipes to rank (limited to 20 max)
 * @param dietaryProfile - User's dietary restrictions and preferences
 * @param alreadySuggested - Recipe IDs already suggested in this session (to deprioritize)
 * @param session - Optional conversation session for refinement context injection
 * @returns Formatted prompt string with context and candidates as JSON
 */
export function buildRankingPrompt(
  userContext: UserContext,
  candidates: Recipe[],
  dietaryProfile: DietaryProfile,
  alreadySuggested: string[],
  session?: ConversationSession
): string {
  // Limit candidates to 20 recipes max to stay under 8,000 token budget
  const limitedCandidates = candidates.slice(0, 20);

  // Build user context section
  let prompt = `# User Context\n`;
  prompt += `- Energy Level: ${userContext.energyLevel || 'not specified'}\n`;
  prompt += `- Available Time: ${userContext.availableTime ? `${userContext.availableTime} minutes` : 'not specified'}\n`;
  prompt += `- Mood/Cravings: ${userContext.mood || 'not specified'}\n`;
  prompt += `- Can Shop: ${userContext.canShop !== undefined ? (userContext.canShop ? 'yes' : 'no') : 'not specified'}\n\n`;

  // Build dietary restrictions section
  const restrictions = dietaryProfile.hardRestrictions.join(', ') || 'None';
  const preferences = dietaryProfile.preferences.join(', ') || 'None';
  prompt += `# Dietary Profile\n`;
  prompt += `- Hard Restrictions: ${restrictions}\n`;
  prompt += `- Preferences: ${preferences}\n`;
  if (dietaryProfile.explicitExclusions.length > 0) {
    prompt += `- Explicit Exclusions: ${dietaryProfile.explicitExclusions.join(', ')}\n`;
  }
  if (dietaryProfile.explicitInclusions.length > 0) {
    prompt += `- Explicit Inclusions: ${dietaryProfile.explicitInclusions.join(', ')}\n`;
  }
  prompt += '\n';

  // Build already suggested section (if any)
  if (alreadySuggested.length > 0) {
    prompt += `# Already Suggested in This Session\n`;
    prompt += `The following recipe IDs have already been shown to the user in this session. Deprioritize them unless they are exceptionally good matches:\n`;
    prompt += alreadySuggested.map(id => `- ${id}`).join('\n');
    prompt += '\n\n';
  }

  // Inject refinement context if user has rejected recipes
  if (session && session.rejectedRecipes.length > 0) {
    const refinementContext = buildRefinementContext(session, candidates);
    if (refinementContext) {
      prompt += refinementContext;
      prompt += '\n';
    }
  }

  // Build candidate recipes section as JSON
  prompt += `# Candidate Recipes\n`;
  prompt += `Evaluate and rank the following recipes. Each recipe is provided with key details for your analysis:\n\n`;

  const candidateData = limitedCandidates.map(recipe => ({
    recipeId: recipe.id,
    title: recipe.title,
    prepTimeMinutes: recipe.prepTimeMinutes,
    cookingTimeMinutes: recipe.cookingTimeMinutes,
    totalTimeMinutes: recipe.totalTimeMinutes,
    cookwareType: recipe.cookwareType,
    dietaryTags: recipe.dietaryTags,
    seasonality: recipe.seasonality,
    ingredients: recipe.ingredients.map(ing => ({
      name: ing.name,
      quantity: ing.quantity,
      unit: ing.unit,
      optional: ing.optional,
    })),
  }));

  prompt += '```json\n';
  prompt += JSON.stringify(candidateData, null, 2);
  prompt += '\n```\n\n';

  prompt += `# Your Task\n`;
  prompt += `Rank ALL ${limitedCandidates.length} recipes based on how well they match the user's context. Return a JSON array with rankings following the format specified in the system prompt.\n`;

  return prompt;
}

/**
 * Build refinement context from rejected recipes and detected patterns.
 * Analyzes rejection patterns to guide AI toward better suggestions.
 *
 * @param session - Current conversation session with rejection history
 * @param candidates - Array of candidate recipes being ranked
 * @returns Formatted refinement context string or empty string if no rejections
 */
export function buildRefinementContext(session: ConversationSession, candidates: Recipe[]): string {
  // Return empty if no rejections
  if (session.rejectedRecipes.length === 0) {
    return '';
  }

  let context = '# Previously Rejected Recipes\n';

  // List rejected recipes with reasons
  const rejectedRecipeMap = new Map<string, Recipe>();
  for (const candidate of candidates) {
    const rejection = session.rejectedRecipes.find(r => r.recipeId === candidate.id);
    if (rejection) {
      rejectedRecipeMap.set(candidate.id, candidate);
    }
  }

  session.rejectedRecipes.forEach(rejected => {
    const recipe = rejectedRecipeMap.get(rejected.recipeId);
    if (recipe) {
      context += `- **${recipe.title}**`;
      if (rejected.reason) {
        context += `: ${rejected.reason}`;
      }
      context += '\n';
    } else {
      context += `- Recipe ID: ${rejected.recipeId}`;
      if (rejected.reason) {
        context += ` - ${rejected.reason}`;
      }
      context += '\n';
    }
  });

  context += '\n# Refinement Instructions\n';

  // List rejection reasons if provided
  const reasons = session.rejectedRecipes.filter(r => r.reason).map(r => r.reason as string);

  if (reasons.length > 0) {
    context += 'The user rejected recipes for the following reasons:\n';
    reasons.forEach(reason => {
      context += `- ${reason}\n`;
    });
    context += '\n';
  }

  // Pattern detection for common ingredients
  const ingredientPatterns = ['pasta', 'chicken', 'beef', 'fish', 'rice', 'salad'];
  const patternCounts = new Map<string, number>();

  for (const rejected of session.rejectedRecipes) {
    const recipe = rejectedRecipeMap.get(rejected.recipeId);
    if (recipe) {
      for (const pattern of ingredientPatterns) {
        const hasPattern = recipe.ingredients.some(ing => ing.name.toLowerCase().includes(pattern));
        if (hasPattern) {
          patternCounts.set(pattern, (patternCounts.get(pattern) || 0) + 1);
        }
      }
    }
  }

  // Add pattern warnings for ingredients rejected 2+ times
  const detectedPatterns = Array.from(patternCounts.entries())
    .filter(([, count]) => count >= 2)
    .map(([pattern]) => pattern);

  if (detectedPatterns.length > 0) {
    context += `**⚠️ Detected Patterns**: The user has rejected multiple recipes containing: ${detectedPatterns.join(', ')}. Avoid suggesting recipes with these ingredients unless they are exceptional matches.\n\n`;
  }

  // Add strategy text based on refinement count
  if (session.refinementCount === 1) {
    context +=
      '**Strategy**: This is the first refinement. Focus on understanding what aspects the user disliked (complexity, ingredients, cooking method, time). Suggest recipes that address those concerns while maintaining variety.\n';
  } else if (session.refinementCount === 2) {
    context +=
      '**Strategy**: This is the second refinement. The user is being selective. Pay close attention to the rejection patterns above and be more conservative. Suggest safe, reliable options that clearly avoid previous issues.\n';
  } else {
    context +=
      '**Strategy**: This is the third or later refinement. The user is struggling to find a match. Consider suggesting recipes that are significantly different from all previous suggestions. It may be time to ask clarifying questions about what the user is really looking for.\n';
  }

  return context;
}
