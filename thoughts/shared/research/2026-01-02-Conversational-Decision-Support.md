---
date: 2026-01-02
researcher: assistant
topic: 'Conversational Decision Support for Recipe Suggestion'
status: complete
coverage:
  - Existing codebase architecture (Electron 39, React 18, TypeScript, OpenAI integration)
  - AI service APIs and integration patterns
  - Conversation state management approaches
  - Conversational UI frameworks and patterns
  - Performance and accessibility considerations
---

# Research: Conversational Decision Support

## Executive Summary

- The project already has **OpenAI API integration** (`openai: ^6.15.0`) with structured output support (Zod schemas) for recipe generation
- **Recommended AI approach**: Use existing GPT-4o-mini for conversation (~$0.47 per 1,000 turns, 2-3s response time)
- **State management**: Hybrid architecture combining XState (conversation flow) + in-memory session state + SQLite (persistent user preferences)
- **UI framework**: @chatscope/chat-ui-kit-react is the leading React library for conversational interfaces
- **Conversation quality**: Implement turn limits (5 per state), refinement caps (3 cycles), and fallback strategies
- **Architecture pattern**: Main process handles AI calls and database queries; renderer process manages UI state with IPC communication
- The existing validation, database DAL, and IPC handler patterns are well-suited for extension to conversational features

## Coverage Map

**Inspected Files**:

- `package.json` - Dependencies and project configuration
- `src/main/main.ts` - Electron main process initialization
- `src/main/ai/recipe-generator.ts` - Existing OpenAI integration pattern
- `src/main/ipc/recipe-ai-handlers.ts` - IPC handler architecture
- `src/main/database/dal/recipes.ts` - Recipe query capabilities
- `src/shared/types/ai.ts` - AI type definitions
- `src/shared/types/database.ts` - Database schema
- `src/shared/types/recipe.ts` - Recipe application types
- `src/renderer/App.tsx` - Current UI architecture

**External Research**:

- OpenAI API documentation (pricing, rate limits, structured outputs)
- Anthropic Claude API comparison
- LangChain/LangGraph state management patterns
- XState v5 state machine documentation
- React conversation UI libraries
- ARIA accessibility standards for conversational interfaces

**Scope**: This research covers technical implementation patterns for Epic 002. It does NOT cover UX design decisions, prompt content creation, or specific conversation flows (those are planner/implementer concerns).

## Critical Findings (Verified, Planner Attention Required)

### Finding 1: Existing OpenAI Integration is Production-Ready

**Observation**: The codebase already uses OpenAI SDK v6.15.0 with structured outputs via Zod schemas for recipe generation.

**Direct consequence**: No new AI service integration is needed. The existing pattern can be extended for conversational interactions with minimal changes.

**Evidence**: `src/main/ai/recipe-generator.ts:126-135`

**Excerpt**:

```typescript
const completion = await client.chat.completions.parse({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildUserPrompt(criteria) },
  ],
  response_format: zodResponseFormat(RecipeGenerationSchema, 'recipe'),
  temperature: 0.8,
  max_tokens: 2000,
});
```

### Finding 2: GPT-4o-mini Meets Performance and Cost Requirements

**Observation**: GPT-4o-mini provides 2-3 second response times for typical conversational contexts (1K-10K tokens) at $0.15/1M input tokens and $0.60/1M output tokens.

**Direct consequence**: A typical conversation turn (1,500 input tokens + 400 output tokens) costs ~$0.00047, resulting in approximately $0.47 per 1,000 conversation sessions. This meets the <5 second per turn requirement with minimal cost.

**Evidence**: Official OpenAI pricing page (https://openai.com/api/pricing/) and independent benchmark study (https://www.workorb.com/blog/comparing-latency-of-gpt-4o-vs-gpt-4o-mini)

**Excerpt**:
| Model | Small Context (1K tokens) | Medium Context (10K tokens) |
|-------|--------------------------|----------------------------|
| GPT-4o-mini | 1.5s | 2.5s |
| GPT-4o | 2s | 4s |

### Finding 3: SDK Has Built-In Retry and Error Handling

**Observation**: OpenAI Node.js SDK v6.x includes automatic retry logic with exponential backoff for connection errors, timeouts, and rate limits.

**Direct consequence**: The existing error handling pattern (`src/main/ai/recipe-generator.ts:174-228`) already implements graceful degradation. Conversation handlers can follow the same pattern without reimplementing retry logic.

**Evidence**: `src/main/ai/recipe-generator.ts:23-30` and `recipe-generator.ts:174-228`

**Excerpt**:

```typescript
openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30000, // 30 seconds
  maxRetries: 2,
});
```

### Finding 4: Database Already Supports Recipe Filtering

**Observation**: The existing `recipes` DAL provides query capabilities for filtering by cookware type, cooking time, dietary tags, and seasonality.

**Direct consequence**: The Decision Support Engine can leverage existing database queries to fetch candidate recipes before AI ranking, avoiding unnecessary AI calls for constraint filtering.

**Evidence**: `src/main/database/dal/recipes.ts:1-100` (createRecipe, getRecipeById, filter operations)

**Excerpt**: Database schema supports JSON-parsed dietary_tags, seasonality, and numeric time filtering.

### Finding 5: IPC Architecture Supports Async AI Operations

**Observation**: The existing IPC handler pattern uses `ipcMain.handle` with async handlers and structured result types (success/error objects).

**Direct consequence**: Conversation handlers can follow the same pattern, with the renderer process sending user messages via IPC and receiving streamed or batched AI responses.

**Evidence**: `src/main/ipc/recipe-ai-handlers.ts:26-67`

**Excerpt**:

```typescript
ipcMain.handle('recipe:generate', async (event, criteria: RecipeGenerationCriteria) => {
  // Security check
  if (!event.senderFrame || !validateSender(event.senderFrame)) {
    return {
      success: false,
      error: { type: 'auth', message: 'Unauthorized IPC sender' },
    };
  }

  const result = isE2ETest()
    ? await mockGenerateRecipe(criteria)
    : await generateRecipe(criteria);
```

## Detailed Technical Analysis (Verified)

### AI Service Selection

**Comparison of Options**:

| Service          | Input Cost | Output Cost | Latency (10K context) | Quality                    | Integration Effort               |
| ---------------- | ---------- | ----------- | --------------------- | -------------------------- | -------------------------------- |
| GPT-4o-mini      | $0.15/1M   | $0.60/1M    | 2.5s                  | Excellent for conversation | ✅ Already integrated            |
| GPT-4o           | $5.00/1M   | $15.00/1M   | 4s                    | Best reasoning             | ✅ Same SDK, higher cost         |
| Claude Haiku 4.5 | $1.00/1M   | $5.00/1M    | 2s                    | Good conversational tone   | ⚠️ New dependency                |
| Local LLM        | $0         | $0          | 5-15s (CPU)           | Variable                   | ❌ Complex setup, large download |

**Evidence**: OpenAI pricing (https://openai.com/api/pricing/), Anthropic pricing (https://platform.claude.com/docs/en/about-claude/pricing), latency benchmarks (https://www.workorb.com/blog/comparing-latency-of-gpt-4o-vs-gpt-4o-mini)

**Recommendation**: Use GPT-4o-mini. The project already has the integration, costs are minimal, and performance meets requirements.

---

### Conversation State Management Patterns

**Research Finding**: Three-tier memory architecture is the industry standard for conversational AI.

**Pattern 1: Working Memory (In-Memory Sliding Window)**

Store the last 5-10 conversation turns in memory during an active session. This is the "working memory" that gets passed to the AI with each request.

**Evidence**: LangChain documentation (https://github.com/context7/langchain_oss_javascript), verified pattern from multiple sources.

**Example Structure**:

```typescript
interface ConversationSession {
  sessionId: string;
  userId: string;
  messages: Message[]; // Last 10 messages
  userContext: {
    energyLevel?: 'low' | 'medium' | 'high';
    availableTime?: number; // minutes
    mood?: string;
    canShop?: boolean;
  };
  suggestedRecipes: string[]; // Recipe IDs already shown
  rejectedRecipes: Array<{
    recipeId: string;
    reason?: string;
  }>;
  state: 'gathering' | 'suggesting' | 'refining' | 'confirmed';
  turnCount: number;
  createdAt: Date;
  lastActivity: Date;
}
```

**Pattern 2: State Machine for Flow Control**

Use XState to manage high-level conversation states (gathering context → suggesting recipes → refining → confirmed). This prevents the conversation from becoming chaotic.

**Evidence**: XState v5 documentation (https://github.com/context7/stately_ai), LangGraph state management patterns (https://deepwiki.com/langchain-ai/langgraph-101/3.1-state-management)

**Example States**:

- `gathering`: Collecting user preferences (energy, time, mood)
- `suggesting`: Presenting 2-4 recipe suggestions
- `refining`: User provided feedback, need alternatives
- `confirmed`: User selected a recipe, generate shopping list
- `abandoned`: User left without selecting

**Pattern 3: Persistent Memory (SQLite)**

Store long-term user preferences and cooking history in the existing SQLite database. This enables personalization across sessions.

**Evidence**: Existing database schema (`src/shared/types/database.ts:61-69`) already has `dietary_profile` table. Research indicates adding a `cooking_sessions` table for history tracking.

**Proposed Schema Extension**:

```typescript
export interface CookingSessionTable {
  id: string; // UUID
  recipe_id: string; // Foreign key to recipes.id
  timestamp: string; // ISO 8601 when decision was made
  user_context: string; // JSON of energy/mood/time
  conversation_summary: string | null; // Optional
}
```

---

### Prompting Strategies for Recipe Ranking

**Research Finding**: Structured outputs with Zod schemas (already used in the project) are superior to JSON mode for guaranteed schema compliance.

**Evidence**: OpenAI Structured Outputs documentation (https://platform.openai.com/docs/guides/structured-outputs), verified in existing codebase at `src/main/ai/recipe-generator.ts:132`

**Recommended Prompt Pattern**:

```typescript
// System prompt for recipe ranking
const RANKING_SYSTEM_PROMPT = `You are a recipe recommendation expert. Rank recipes based on:
1. User context (energy level, available time, mood)
2. Dietary constraints (NEVER suggest recipes violating restrictions)
3. Cooking history (deprioritize recently cooked recipes)
4. Seasonality (prefer seasonal ingredients)

# Output Format
Return JSON with ranked suggestions and reasoning.

# Example
User: "Tired, 30 minutes available, no shopping"
Ranked recipes:
1. One-Pot Pasta (simple, quick, uses pantry staples)
2. Oven-Baked Chicken (hands-off, no active cooking)`;

// User prompt includes context + candidate recipes
const buildRankingPrompt = (
  userContext: UserContext,
  candidateRecipes: Recipe[],
  recentRecipeIds: string[]
) => {
  return `
User Context:
- Energy level: ${userContext.energyLevel}
- Available time: ${userContext.availableTime} minutes
- Can shop today: ${userContext.canShop ? 'Yes' : 'No'}
- Mood: ${userContext.mood || 'Not specified'}

Recently cooked (deprioritize):
${recentRecipeIds.join(', ')}

Candidate recipes:
${JSON.stringify(candidateRecipes, null, 2)}

Rank the top 3-4 recipes and explain why each is a good match.
  `;
};
```

**Zod Schema for Structured Response**:

```typescript
import { z } from 'zod';

const RecipeSuggestionSchema = z.object({
  suggestions: z
    .array(
      z.object({
        recipeId: z.string(),
        title: z.string(),
        relevanceScore: z.number().min(0).max(100),
        reasoning: z.string(),
        matchedFactors: z.array(z.string()), // e.g., ["quick", "low-energy", "seasonal"]
      })
    )
    .max(4),
  followUpQuestion: z.string().optional(), // If clarification needed
});
```

---

### Iterative Refinement Pattern

**Research Finding**: Track rejected suggestions within the session and inject them into subsequent prompts to prevent re-suggesting the same recipes.

**Evidence**: @falai/agent framework pattern (https://github.com/falai-dev/agent), Mem0 pattern from Uplatz research report (https://uplatz.com/blog/multi-turn-conversation-state-management-and-memory-architectures-an-analytical-report/)

**Verified Pattern**:

```typescript
// Add to system prompt on subsequent requests
const buildRefinementContext = (session: ConversationSession) => {
  const rejectedList = session.rejectedRecipes
    .map(r => `- ${r.recipeId}${r.reason ? ` (reason: ${r.reason})` : ''}`)
    .join('\n');

  return `
# Previously Rejected Recipes
${rejectedList || 'None'}

# Instructions for Refinement
- DO NOT suggest any recipe from the rejected list
- Identify patterns (e.g., all pasta dishes rejected → user doesn't want pasta)
- Suggest recipes that address the rejection reasons
- If user rejected due to missing ingredient, suggest alternatives or substitutions
  `;
};
```

**Feedback Collection**:

- User clicks "Not this one" → Ask "Why not?" (optional free text or quick buttons: "Missing ingredient", "Not in the mood", "Too complex")
- Store rejection with reason in `session.rejectedRecipes`
- Include in next AI call context

---

### Conversational UI Architecture

**Research Finding**: @chatscope/chat-ui-kit-react is the leading open-source React library for chat interfaces (1.7k GitHub stars, active maintenance).

**Evidence**: GitHub repository (https://github.com/chatscope/chat-ui-kit-react), Vercel AI Chatbot production patterns (https://github.com/vercel/ai-chatbot)

**Installation**:

```bash
npm install @chatscope/chat-ui-kit-react @chatscope/chat-ui-kit-styles
```

**Component Structure**:

```typescript
import {
  MainContainer,
  ChatContainer,
  MessageList,
  Message,
  MessageInput,
  TypingIndicator
} from '@chatscope/chat-ui-kit-react';
import '@chatscope/chat-ui-kit-styles/dist/default/styles.min.css';

function ConversationView() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isAITyping, setIsAITyping] = useState(false);

  const handleSend = async (userMessage: string) => {
    // Add user message optimistically
    setMessages(prev => [...prev, {
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    }]);

    setIsAITyping(true);

    // Call IPC handler
    const response = await window.electron.sendConversationMessage(userMessage);

    setMessages(prev => [...prev, {
      role: 'assistant',
      content: response.message,
      suggestions: response.recipes,
      timestamp: new Date()
    }]);

    setIsAITyping(false);
  };

  return (
    <MainContainer>
      <ChatContainer>
        <MessageList
          typingIndicator={isAITyping ? <TypingIndicator content="AI is thinking..." /> : null}
        >
          {messages.map((msg, idx) => (
            <Message
              key={idx}
              model={{
                message: msg.content,
                sender: msg.role === 'user' ? 'You' : 'AI Assistant',
                direction: msg.role === 'user' ? 'outgoing' : 'incoming'
              }}
            />
          ))}
        </MessageList>
        <MessageInput
          placeholder="Tell me what you're in the mood for..."
          onSend={handleSend}
          attachButton={false}
        />
      </ChatContainer>
    </MainContainer>
  );
}
```

**State Management Recommendation**: Use `useReducer` for complex conversation state instead of multiple `useState` hooks.

**Evidence**: React official documentation (https://react.dev/learn/extracting-state-logic-into-a-reducer)

**Excerpt**:

```typescript
type ConversationAction =
  | { type: 'add_user_message'; content: string }
  | { type: 'add_ai_message'; content: string; suggestions?: Recipe[] }
  | { type: 'set_loading'; isLoading: boolean }
  | { type: 'select_recipe'; recipe: Recipe };

function conversationReducer(state: ConversationState, action: ConversationAction) {
  switch (action.type) {
    case 'add_user_message':
      return {
        ...state,
        messages: [...state.messages, { role: 'user', content: action.content }],
        isLoading: true,
      };
    // ... other cases
  }
}
```

---

### Accessibility Patterns

**Research Finding**: Conversational interfaces should use `role="log"` with `aria-live="polite"` for screen reader compatibility.

**Evidence**: W3C ARIA specification (https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/log_role)

**Verified Pattern**:

```typescript
<div
  role="log"
  aria-live="polite"
  aria-atomic="false"
  aria-label="Conversation history"
  className="message-container"
>
  {messages.map((message) => (
    <div
      key={message.id}
      aria-label={`${message.role === 'user' ? 'You said' : 'Assistant said'}: ${message.content}`}
    >
      {message.content}
    </div>
  ))}
</div>
```

**Keyboard Navigation**:

- Arrow Up/Down: Navigate between messages
- Home/End: Jump to first/last message
- Tab: Move focus to input field
- Enter: Send message

---

### Performance Optimization Patterns

**Research Finding**: Optimistic UI updates improve perceived responsiveness by showing user messages immediately without waiting for AI response.

**Evidence**: React documentation (https://react.dev/learn/you-might-not-need-an-effect), Vercel AI Chatbot patterns

**Pattern**:

1. User sends message → Immediately add to UI
2. Show loading indicator for AI response
3. When AI responds → Replace loading indicator with actual message
4. If error → Remove optimistic message, show error

**For Long Conversations**: Implement virtual scrolling to handle 100+ messages efficiently.

**Library**: `@tanstack/react-virtual`

---

### Conversation Quality Controls

**Research Finding**: Set turn limits and escalation strategies to prevent frustrating infinite loops.

**Evidence**: @falai/agent patterns (https://github.com/falai-dev/agent), LangGraph state management (https://deepwiki.com/langchain-ai/langgraph-101/3.1-state-management)

**Recommended Limits**:

- **Max turns in one state**: 5 (e.g., if user is stuck in "gathering preferences" for 5 turns, escalate)
- **Max refinement cycles**: 3 (after 3 rejections, offer compromise or broader search)
- **Session timeout**: 30 minutes of inactivity

**Escalation Strategy**:

```typescript
const conversationGuard = {
  turnsInState: 0,
  refinementCount: 0,

  checkStuck() {
    if (this.turnsInState > 5) {
      return {
        type: 'suggest-compromise',
        message:
          "I notice we're having trouble finding the perfect recipe. Would you like me to show our most popular quick dinners instead?",
      };
    }

    if (this.refinementCount > 3) {
      return {
        type: 'broaden-search',
        message:
          "We've tried several options. Let's try a different approach:\n1. Browse by category\n2. See recipes similar to ones you've liked before\n3. Start over with different preferences",
      };
    }

    return null;
  },
};
```

---

### Fallback Strategy for AI Service Failures

**Research Finding**: Implement graceful degradation to database-based filtering when AI is unavailable.

**Evidence**: Existing error handling pattern in `src/main/ai/recipe-generator.ts:174-228`

**Pattern**:

```typescript
async function getRecipeSuggestions(context: UserContext): Promise<SuggestionResult> {
  try {
    // Primary: AI-powered ranking
    const aiResponse = await rankRecipesWithAI(context);
    return { source: 'ai', suggestions: aiResponse.suggestions };
  } catch (error) {
    // Fallback: Database filtering only
    console.warn('AI unavailable, using database fallback', error);

    const recipes = await db
      .selectFrom('recipes')
      .selectAll()
      .where('cooking_time_minutes', '<=', context.availableTime)
      .orderBy('created_at', 'desc')
      .limit(5)
      .execute();

    return {
      source: 'database',
      suggestions: recipes,
      notice:
        'AI is temporarily unavailable. Showing recent recipes matching your time constraint.',
    };
  }
}
```

## Verification Log

**Verified Files** (read with `read` tool):

- `package.json`
- `src/main/main.ts`
- `src/main/ai/recipe-generator.ts`
- `src/main/ipc/recipe-ai-handlers.ts`
- `src/main/database/dal/recipes.ts` (first 100 lines)
- `src/shared/types/ai.ts`
- `src/shared/types/database.ts`
- `src/shared/types/recipe.ts`
- `src/renderer/App.tsx`

**Spot-checked excerpts captured**: Yes

**External Research Verified**: All web research conducted by specialized agents with source citations and confidence scores (HIGH for all findings).

## Open Questions / Unverified Claims

### Question 1: Streaming Responses

**Claim**: OpenAI SDK v6.x supports streaming responses for progressive display.

**What was tried**: Examined existing `recipe-generator.ts` which uses `chat.completions.parse()`. This method does NOT support streaming (structured outputs are incompatible with streaming).

**What evidence is missing**: Need to verify if conversation can use non-structured streaming (for natural language responses) while using structured output only for final recipe ranking.

**Alternative**: Use regular `chat.completions.create()` with `stream: true` for conversational turns, and switch to `parse()` only for recipe ranking.

### Question 2: Session Persistence Across App Restarts

**Specification ambiguity**: Epic 002 states "Conversation Context is ephemeral and does not persist after session completion" (line 184 of epic). But Open Questions section (line 270) asks "should the session resume on next launch?"

**What evidence is missing**: Planner decision needed on whether to persist in-progress conversations to SQLite or always start fresh.

**Recommendation**: Start with ephemeral sessions (simpler). Add persistence only if user feedback indicates need.

### Question 3: Ingredient Substitution Intelligence

**Claim**: AI can suggest ingredient substitutions during conversation.

**What was tried**: Research indicated this is feasible via natural language prompts ("User says they don't have bell peppers → AI suggests zucchini").

**What evidence is missing**: No verification that GPT-4o-mini's substitution suggestions are culinarily sound. May require few-shot examples in system prompt or a substitution knowledge base.

### Question 4: Conversation Summarization at Scale

**Claim**: For conversations exceeding 4,000 tokens, use summarization to compress history.

**What evidence is missing**: The epic assumes conversations complete in <10 minutes with <7 refinement turns. This likely stays under 4,000 tokens, making summarization unnecessary for MVP. Need verification of typical conversation length.

### Question 5: Multi-Day Shopping List Persistence

**Specification mention**: Epic Open Questions (line 275) asks if shopping list should persist for later retrieval.

**What evidence is missing**: Current recipe schema does not include a "shopping_lists" table. Need planner decision: should shopping lists be saved separately, or just regenerated from the recipe on demand?

## References

**Codebase References** (verified with `read`):

- `package.json` (OpenAI SDK version, dependencies)
- `src/main/ai/recipe-generator.ts:23-30` (OpenAI client initialization)
- `src/main/ai/recipe-generator.ts:126-135` (Structured output usage)
- `src/main/ai/recipe-generator.ts:174-228` (Error handling pattern)
- `src/main/ipc/recipe-ai-handlers.ts:26-67` (IPC handler pattern)
- `src/main/database/dal/recipes.ts:1-100` (Recipe DAL capabilities)
- `src/shared/types/database.ts:61-69` (Dietary profile table)
- `src/shared/types/ai.ts:10-31` (AI type definitions)

**External Documentation** (web research with citations):

- OpenAI Pricing: https://openai.com/api/pricing/
- OpenAI Structured Outputs: https://platform.openai.com/docs/guides/structured-outputs
- OpenAI Rate Limits: https://platform.openai.com/docs/guides/rate-limits
- OpenAI Node.js SDK: https://github.com/openai/openai-node
- Anthropic Pricing: https://platform.claude.com/docs/en/about-claude/pricing
- Latency Benchmarks: https://www.workorb.com/blog/comparing-latency-of-gpt-4o-vs-gpt-4o-mini
- Conversation State Management: https://uplatz.com/blog/multi-turn-conversation-state-management-and-memory-architectures-an-analytical-report/
- LangGraph State Management: https://deepwiki.com/langchain-ai/langgraph-101/3.1-state-management
- XState v5 Documentation: https://github.com/context7/stately_ai
- @chatscope/chat-ui-kit-react: https://github.com/chatscope/chat-ui-kit-react
- Vercel AI Chatbot: https://github.com/vercel/ai-chatbot
- React useReducer: https://react.dev/learn/extracting-state-logic-into-a-reducer
- ARIA Log Role: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/log_role
- @falai/agent Framework: https://github.com/falai-dev/agent

---

## Appendix: Architecture Recommendations for Planner

Based on verified research, the following architecture is recommended for implementing Epic 002:

### 1. Component Responsibilities

**Main Process** (`src/main/`):

- `conversation/conversation-service.ts`: Manages conversation sessions, calls OpenAI API
- `conversation/recipe-ranker.ts`: AI-powered recipe ranking logic
- `conversation/session-manager.ts`: Session lifecycle, cleanup, timeout handling
- `ipc/conversation-handlers.ts`: IPC handlers for conversation operations
- `database/dal/cooking-sessions.ts`: Persist completed cooking decisions

**Renderer Process** (`src/renderer/`):

- `pages/ConversationPage.tsx`: Main conversation UI
- `components/Conversation/MessageList.tsx`: Message display
- `components/Conversation/RecipeSuggestionCard.tsx`: Recipe cards within conversation
- `components/Conversation/MessageInput.tsx`: User input
- `hooks/useConversation.ts`: Conversation state management with useReducer

### 2. Data Flow

```
User types message
  → Renderer: Optimistically add to UI
  → IPC: window.electron.sendConversationMessage(message)
  → Main: conversation-handlers.ts receives message
  → Main: conversation-service.ts updates session state
  → Main: Calls OpenAI API with context + history
  → Main: Parses AI response (suggestions or follow-up question)
  → IPC: Returns response to renderer
  → Renderer: Updates UI with AI message + recipe cards

User clicks "Select Recipe"
  → IPC: window.electron.confirmRecipeSelection(recipeId)
  → Main: Saves cooking session to database
  → Main: Generates shopping list (existing ingredient extraction)
  → IPC: Returns shopping list
  → Renderer: Displays shopping list view
```

### 3. Session State Schema

```typescript
// Stored in memory during active session
interface ConversationSession {
  sessionId: string;
  userId: string; // For future multi-user support
  state: 'gathering' | 'suggesting' | 'refining' | 'confirmed' | 'abandoned';
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    suggestions?: Recipe[];
  }>;
  userContext: {
    energyLevel?: 'low' | 'medium' | 'high';
    availableTime?: number;
    mood?: string;
    canShop?: boolean;
  };
  suggestedRecipeIds: string[]; // Prevent re-suggesting
  rejectedRecipes: Array<{
    recipeId: string;
    reason?: string;
  }>;
  turnCount: number;
  turnsInCurrentState: number;
  refinementCount: number;
  createdAt: Date;
  lastActivity: Date;
}
```

### 4. Database Schema Extension

Add `cooking_sessions` table for history tracking:

```sql
CREATE TABLE cooking_sessions (
  id TEXT PRIMARY KEY,
  recipe_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  user_context TEXT, -- JSON
  conversation_summary TEXT,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id)
);

CREATE INDEX idx_cooking_sessions_timestamp ON cooking_sessions(timestamp DESC);
```

### 5. New Dependencies Needed

```bash
npm install @chatscope/chat-ui-kit-react @chatscope/chat-ui-kit-styles
npm install xstate  # Optional - for state machine
```

All other dependencies (OpenAI, Zod, React, TypeScript) are already present.

### 6. IPC API Contract

**New IPC Channels**:

```typescript
// Start new conversation session
window.electron.startConversation(): Promise<{ sessionId: string }>;

// Send user message
window.electron.sendConversationMessage(message: string): Promise<{
  aiMessage: string;
  suggestions?: Recipe[];
  followUpQuestion?: string;
}>;

// Provide feedback on suggestion
window.electron.rejectRecipe(recipeId: string, reason?: string): Promise<{
  aiMessage: string;
  suggestions: Recipe[];
}>;

// Confirm recipe selection
window.electron.confirmRecipeSelection(recipeId: string): Promise<{
  shoppingList: string[];
  recipe: Recipe;
}>;

// Abandon session
window.electron.abandonConversation(): Promise<void>;
```

### 7. Prompt Engineering Starting Point

```typescript
const CONVERSATION_SYSTEM_PROMPT = `You are a friendly, supportive recipe advisor. Your goal is to help the user decide what to cook tonight through natural conversation.

# User Profile
- Dietary restrictions: {dietaryRestrictions} (NEVER violate these)
- Cookware available: One pot, one pan, or oven
- Servings needed: 2 people
- Time constraint: 30-60 minutes max

# Conversation Style
- Warm and encouraging, not interrogative
- Ask one question at a time
- Acknowledge user's feelings (e.g., "I hear you're tired tonight")
- Offer choices, not overwhelming lists
- Explain reasoning for suggestions

# Your Tasks
1. Understand user's current context (energy level, time available, mood)
2. Suggest 2-4 recipes that match their needs
3. Handle feedback gracefully and refine suggestions
4. Help them find a recipe they're genuinely excited about

Remember: The user has had a long day. Be supportive and make this easy.`;
```

This architecture leverages existing patterns (IPC handlers, OpenAI integration, database DAL) and extends them with conversation-specific logic. The renderer process remains focused on UI rendering, while the main process handles all AI and database operations, maintaining security and separation of concerns.
